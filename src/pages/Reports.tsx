"use client";

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Project, MapElement } from '@/types/project';
import { useNavigate } from 'react-router-dom';
import { SectionNav } from '@/components/layout/SectionNav';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    TrendingUp, Building2, ShieldCheck, PieChart as PieIcon,
    Filter, Tags, AlertTriangle, RefreshCcw, Wallet, CalendarRange, Download,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { showError } from '@/utils/toast';
import { AppShell, Panel, StatGrid, StatCell, EmptyState, LoadingBlock, SegmentedControl } from '@/components/layout/AppShell';
import {
  chartAxis, chartGrid, chartMargin, formatAxisValue,
  ChartTooltip, ChartLegend, ChartEmpty, Meter,
} from '@/components/charts/chart-kit';
import { formatNumber } from '@/lib/format';
import { fetchRemoteSettings, loadSettings, resolveSettingsSources } from "@/incentives/storage";
import type { IncentiveSettings } from "@/incentives/types";
import { fetchFollowupRows, isMissingFollowupTable } from "@/lib/payment-followup-import";
import type { FollowupRecord } from "@/lib/payment-followup";
import {
  EMPTY_REPORT_FILTERS,
  buildReportUnits,
  centerRows,
  collectionRate,
  collectionRows,
  currencyOn,
  inDayRange,
  largestOverdue,
  matchSettlement,
  matchStructure,
  obligationCross,
  saleCohortRows,
  sortCenterRows,
  summarizeDues,
  summarizeMoney,
  type ReportFilters,
  type ReportUnit,
} from "@/lib/report-collection";
import { palette } from "@/lib/theme";
import {
  buildBriefs,
  defaultSections,
  formatPct,
  loadExportChoice,
  REPORT_SECTIONS,
  saveExportChoice,
  type NarrativeInput,
  type ReportSectionId,
} from "@/lib/report-narrative";
import { buildReportPack, saveReportPack } from "@/lib/report-pack";
import { exportReportWorkbook } from "@/lib/report-excel";
import { STATUS_META, PRIMARY_STATUSES } from '@/lib/unit-status';
import { validateCenterSession } from '@/lib/center-auth';
import {
  fetchWithRetry,
  fetchNativeSupabase,
  fetchProjectUnitsParallel,
  formatLightweightUnits,
} from "@/lib/supabase-rest";

interface ReportsProps {
  projects: Project[];
  /** تمرّرها App لكن الصفحة تجلب بياناتها بنفسها. */
  housesData?: Record<string, any>;
}

const Reports = ({ projects }: ReportsProps) => {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [housesData, setHousesData] = useState<Record<string, any>>({});
  const [fetchedElements, setFetchedElements] = useState<MapElement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasAccess, setHasAccess] = useState<boolean>(true);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(true);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);
  const [followupRows, setFollowupRows] = useState<FollowupRecord[]>([]);
  const [followupMissing, setFollowupMissing] = useState(false);
  const [settings, setSettings] = useState<IncentiveSettings | null>(null);
  const [centers, setCenters] = useState<{ id: string; name: string }[]>([]);

  const [filters, setFilters] = useState<ReportFilters>(EMPTY_REPORT_FILTERS);
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [dueState, setDueState] = useState<"all" | "overdue" | "today" | "upcoming">("all");
  const [salesViewMode, setSalesViewMode] = useState<'houses' | 'towers'>('houses');
  const [moneyMeasure, setMoneyMeasure] = useState<"count" | "contract" | "remaining">("count");
  const [collectionGroup, setCollectionGroup] = useState<"zone" | "type">("type");
  const [ageMode, setAgeMode] = useState<"all" | "slices">("all");
  const [centerSort, setCenterSort] = useState<"remaining" | "rate">("remaining");
  const [obligationOpen, setObligationOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportSections, setExportSections] = useState<ReportSectionId[]>(() => loadExportChoice().sections);
  const [briefSections, setBriefSections] = useState<ReportSectionId[]>(() => loadExportChoice().brief);
  const chartRowRef = useRef<HTMLDivElement>(null);
  const [chartRowWidth, setChartRowWidth] = useState(720);

  // التحقق من صلاحية الوصول للقسم الحالي
  useEffect(() => {
    const checkAccessPermission = async () => {
      setCheckingAccess(true);
      try {
        const { session } = await validateCenterSession(supabase);
        if (!session) {
          setHasAccess(false);
          setCheckingAccess(false);
          return;
        }

        const { data: settings } = await supabase
          .from('settings')
          .select('key, value')
          .eq('key', 'dept_permissions')
          .maybeSingle();

        if (settings?.value && session.type) {
          const deptPerms = (settings.value as Record<string, Record<string, boolean>>)[session.type];
          if (deptPerms && deptPerms.canAccessReports === false) {
            setHasAccess(false);
          } else {
            setHasAccess(true);
          }
        } else {
          setHasAccess(true);
        }
      } catch (e) {
        console.error("Error checking reports access:", e);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccessPermission();
  }, []);

  // جلب البيانات فقط بعد اختيار مشروع أو «كافة المشاريع» — لا تحميل تلقائي عند الدخول
  useEffect(() => {
    if (!hasAccess || !selectedProjectId) {
      setFetchedElements([]);
      setHousesData({});
      setFollowupRows([]);
      setFollowupMissing(false);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const slimReportElements = (
      elements: MapElement[] | undefined,
      projectId: string,
      projectName: string,
    ): MapElement[] => {
      if (!Array.isArray(elements)) return [];
      return elements
        .filter((el) => el?.type === "house" || el?.type === "tower")
        .map((el) => ({
          id: el.id,
          type: el.type,
          label: el.label || "",
          points: [],
          rotation: 0,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          floors: el.floors,
          apartmentsPerFloor: el.apartmentsPerFloor,
          groundFloorSizes: el.groundFloorSizes,
          typicalFloorSizes: el.typicalFloorSizes,
          customArea: el.customArea,
          _projectName: projectName,
          _projectId: projectId,
        }));
    };

    const fetchProjectRow = async (projectId: string, projectName: string) => {
      const rows = await fetchWithRetry(() =>
        fetchNativeSupabase(
          `projects?select=id,name,elements&id=eq.${encodeURIComponent(projectId)}`,
        ),
      );
      const row = Array.isArray(rows) ? rows[0] : rows;
      return slimReportElements(
        row?.elements,
        row?.id || projectId,
        row?.name || projectName,
      );
    };

    const fetchReportsData = async () => {
      setLoading(true);
      setFetchedElements([]);
      setHousesData({});
      setFollowupRows([]);
      try {
        const targets =
          selectedProjectId === "all"
            ? projects
            : projects.filter((project) => project.id === selectedProjectId);

        let tableMissing = false;
        const [packs, remote, centerRows] = await Promise.all([
          Promise.all(
            targets.map(async (project) => {
              const [elements, units, followup] = await Promise.all([
                fetchProjectRow(project.id, project.name),
                fetchProjectUnitsParallel(project.id),
                fetchFollowupRows(project.id).catch((error) => {
                  if (isMissingFollowupTable(error)) {
                    tableMissing = true;
                    return [] as FollowupRecord[];
                  }
                  throw error;
                }),
              ]);
              return { elements, units, followup };
            }),
          ),
          fetchRemoteSettings(supabase).catch(() => null),
          supabase.from("marketing_centers").select("id, name"),
        ]);

        if (cancelled) return;

        setFetchedElements(packs.flatMap((pack) => pack.elements));
        setHousesData(formatLightweightUnits(packs.flatMap((pack) => pack.units)));
        setFollowupRows(packs.flatMap((pack) => pack.followup));
        setFollowupMissing(tableMissing);
        setSettings(resolveSettingsSources(loadSettings(), remote).settings);
        setCenters(
          (centerRows.data || []).map((center) => ({
            id: String(center.id),
            name: String(center.name || "").trim(),
          })),
        );
      } catch (err) {
        if (cancelled) return;
        console.error("Error fetching reports data:", err);
        showError("فشل الاتصال بقاعدة البيانات. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchReportsData();
    return () => {
      cancelled = true;
    };
  }, [selectedProjectId, hasAccess, retryTrigger, projects]);

  const reportUnits = useMemo(
    () => buildReportUnits(fetchedElements, housesData, followupRows, settings, centers),
    [fetchedElements, housesData, followupRows, settings, centers],
  );

  const options = useMemo(() => {
    const zones = new Set<string>();
    const towers = new Map<string, string>();
    const types = new Map<string, string>();
    const centerNames = new Set<string>();
    reportUnits.forEach((unit) => {
      if (unit.centerName) centerNames.add(unit.centerName);
      if (unit.typeKey) types.set(unit.typeKey, unit.typeLabel);
      if (unit.kind === "house" && unit.zone) zones.add(unit.zone);
      if (unit.kind === "apartment" && unit.towerId) {
        const label = selectedProjectId === "all" && unit.projectName
          ? `${unit.projectName} — ${unit.towerLabel}`
          : unit.towerLabel;
        towers.set(unit.towerId, label || unit.towerId);
      }
    });
    const typeList = Array.from(types.entries()).sort((a, b) => {
      const rank = (key: string) => (key.startsWith("house:") ? 0 : 1);
      if (rank(a[0]) !== rank(b[0])) return rank(a[0]) - rank(b[0]);
      return a[1].localeCompare(b[1], "ar", { numeric: true });
    });
    return {
      zones: Array.from(zones).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      towers: Array.from(towers.entries()).sort((a, b) => a[1].localeCompare(b[1], "ar", { numeric: true })),
      types: typeList,
      centers: Array.from(centerNames).sort((a, b) => a.localeCompare(b, "ar")),
    };
  }, [reportUnits, selectedProjectId]);

  useEffect(() => {
    setFilters(EMPTY_REPORT_FILTERS);
    setDueFrom("");
    setDueTo("");
    setDueState("all");
    setSalesViewMode("houses");
    setMoneyMeasure("count");
    setCollectionGroup("type");
    setAgeMode("all");
    setCenterSort("remaining");
    setObligationOpen(false);
  }, [selectedProjectId]);

  const saleScoped = Boolean(filters.saleFrom || filters.saleTo);

  const structural = useMemo(
    () => reportUnits.filter((unit) => {
      if (!matchStructure(unit, filters)) return false;
      if (!saleScoped) return true;
      if (unit.status !== "sold" && unit.status !== "investment") return false;
      return inDayRange(unit.saleDate, filters.saleFrom, filters.saleTo);
    }),
    [reportUnits, filters, saleScoped],
  );

  const stats = useMemo(() => {
    let total = 0;
    let sold = 0;
    let investment = 0;
    let available = 0;
    let reserved = 0;
    let pending = 0;
    let frozen = 0;
    let promotedTabo = 0;
    let receivedTabo = 0;
    let notPromotedTabo = 0;
    let receivedUnit = 0;
    let notReceivedUnit = 0;

    structural.forEach((unit) => {
      if (unit.frozenCounted || unit.frozenUncounted) frozen += 1;
      if (unit.frozenUncounted) return;
      total += 1;
      if (unit.status === "sold") sold += 1;
      else if (unit.status === "investment") investment += 1;
      else if (unit.status === "reserved") reserved += 1;
      else if (unit.status === "pending") pending += 1;
      else available += 1;

      if (unit.status !== "sold" && unit.status !== "investment") return;
      if (unit.tabo === "مروج") promotedTabo += 1;
      else if (unit.tabo === "مستلم") receivedTabo += 1;
      else notPromotedTabo += 1;
      if (unit.handover) receivedUnit += 1;
      else notReceivedUnit += 1;
    });

    return {
      total, sold, investment, available, reserved, pending, frozen,
      promotedTabo, receivedTabo, notPromotedTabo, receivedUnit, notReceivedUnit,
    };
  }, [structural]);

  const money = useMemo(() => summarizeMoney(reportUnits, filters), [reportUnits, filters]);

  const statusDistributionData = useMemo(() => {
    return PRIMARY_STATUSES.map((key) => ({
      name: STATUS_META[key].label,
      value: stats[key],
      color: STATUS_META[key].chart,
    })).filter((item) => item.value > 0);
  }, [stats]);

  const buildPerformance = (view: "houses" | "towers" | "screen") => {
    const groups = new Map<string, {
      total: number;
      sold: number;
      investment: number;
      periodContracts: number;
      lifetimeSales: number;
      lifetimeUnits: number;
      contractIQD: number;
      contractUSD: number;
      remainingIQD: number;
      remainingUSD: number;
    }>();
    const bucket = (name: string) => {
      const current = groups.get(name) || {
        total: 0, sold: 0, investment: 0, periodContracts: 0, lifetimeSales: 0, lifetimeUnits: 0,
        contractIQD: 0, contractUSD: 0, remainingIQD: 0, remainingUSD: 0,
      };
      groups.set(name, current);
      return current;
    };
    const groupName = (unit: ReportUnit): string | null => {
      const projectPrefix = selectedProjectId === "all" && unit.projectName ? `${unit.projectName} — ` : "";
      if (view === "houses") {
        return unit.kind === "house" ? `${projectPrefix}زون ${unit.zone || "عام"}` : null;
      }
      if (view === "towers") {
        return unit.kind === "apartment" ? `${projectPrefix}${unit.towerLabel || "عمارة"}` : null;
      }
      if (selectedProjectId === "all") return unit.projectName || "مشروع";
      if (salesViewMode === "houses") return unit.kind === "house" ? `زون ${unit.zone || "عام"}` : null;
      return unit.kind === "apartment" ? (unit.towerLabel || "عمارة") : null;
    };

    reportUnits.forEach((unit) => {
      if (!matchStructure(unit, filters) || unit.frozenUncounted) return;
      const name = groupName(unit);
      if (!name) return;
      const row = bucket(name);
      row.lifetimeUnits += 1;
      if (unit.status !== "sold" && unit.status !== "investment") return;
      if (filters.settlement !== "all" && !matchSettlement(unit, filters)) return;
      row.lifetimeSales += 1;
    });

    structural.forEach((unit) => {
      if (unit.frozenUncounted) return;
      const name = groupName(unit);
      if (!name) return;
      const row = bucket(name);
      row.total += 1;
      if (unit.status === "sold") row.sold += 1;
      if (unit.status === "investment") row.investment += 1;
      if (unit.status !== "sold" && unit.status !== "investment") return;
      if ((filters.settlement === "all" || matchSettlement(unit, filters)) && inDayRange(unit.saleDate, filters.saleFrom, filters.saleTo)) {
        row.periodContracts += 1;
      }
      if (!inDayRange(unit.saleDate, filters.saleFrom, filters.saleTo)) return;
      const settlementOk = filters.settlement === "all" || matchSettlement(unit, filters);
      if (settlementOk && currencyOn(filters.currency, unit.systemCurrency) && unit.systemPrice > 0) {
        if (unit.systemCurrency === "IQD") row.contractIQD += unit.systemPrice;
        else row.contractUSD += unit.systemPrice;
      }
      if (matchSettlement(unit, filters) && currencyOn(filters.currency, unit.fileCurrency)) {
        if (unit.fileCurrency === "IQD") row.remainingIQD += unit.remaining;
        else row.remainingUSD += unit.remaining;
      }
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ar", { numeric: true }))
      .map(([name, row]) => ({ name, ...row }));
  };

  const salesPerformanceData = useMemo(() => {
    return buildPerformance("screen").filter((row) => {
      if (moneyMeasure === "contract") return row.contractIQD > 0 || row.contractUSD > 0;
      if (moneyMeasure === "remaining") return row.remainingIQD > 0 || row.remainingUSD > 0;
      return saleScoped ? row.lifetimeUnits > 0 : true;
    }).map((row) => {
      if (moneyMeasure === "contract") {
        return { name: row.name, "قيمة العقود (د.ع)": row.contractIQD, "قيمة العقود ($)": row.contractUSD };
      }
      if (moneyMeasure === "remaining") {
        return { name: row.name, "المتبقي (د.ع)": row.remainingIQD, "المتبقي ($)": row.remainingUSD };
      }
      if (saleScoped) {
        return {
          name: row.name,
          "عقود الفترة": row.periodContracts,
          "إجمالي المبيعات": row.lifetimeSales,
          "إجمالي الوحدات السكنية": row.lifetimeUnits,
        };
      }
      return {
        name: row.name,
        "إجمالي الوحدات": row.total,
        "المباعة": row.sold,
        "الاستثمار": row.investment,
      };
    });
  }, [structural, reportUnits, selectedProjectId, salesViewMode, moneyMeasure, filters, saleScoped]);

  useEffect(() => {
    const node = chartRowRef.current;
    if (!node) return;
    const update = () => setChartRowWidth(Math.max(320, Math.floor(node.clientWidth)));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [salesPerformanceData.length, moneyMeasure, loading]);

  const salesTrendData = useMemo(() => {
    const monthly = new Map<string, { count: number; revenueIQD: number; revenueUSD: number; date: Date }>();
    structural.forEach((unit) => {
      if (unit.frozenUncounted) return;
      if (unit.status !== "sold" && unit.status !== "investment") return;
      if (!unit.saleDate) return;
      if (!inDayRange(unit.saleDate, filters.saleFrom, filters.saleTo)) return;
      if (!currencyOn(filters.currency, unit.systemCurrency)) return;
      const [yearText, monthText] = unit.saleDate.split("-");
      const year = Number(yearText);
      const month = Number(monthText) - 1;
      if (!year || month < 0) return;
      const key = `${yearText}-${monthText}`;
      const row = monthly.get(key) || { count: 0, revenueIQD: 0, revenueUSD: 0, date: new Date(year, month, 1) };
      row.count += 1;
      if (unit.systemPrice > 0) {
        if (unit.systemCurrency === "IQD") row.revenueIQD += unit.systemPrice;
        else row.revenueUSD += unit.systemPrice;
      }
      monthly.set(key, row);
    });
    return Array.from(monthly.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, row]) => ({
        key,
        name: row.date.toLocaleString("ar-EG", { month: "long", year: "numeric" }),
        "عدد الوحدات المباعة": row.count,
        "قيمة البيع (د.ع)": row.revenueIQD,
        "قيمة البيع ($)": row.revenueUSD,
      }));
  }, [structural, filters]);

  const priced = (kind: ReportUnit["kind"]) => {
    const groups = new Map<string, { sumIQD: number; countIQD: number; sumUSD: number; countUSD: number }>();
    structural.forEach((unit) => {
      if (unit.kind !== kind || unit.frozenUncounted) return;
      if (unit.status !== "sold" && unit.status !== "investment") return;
      if (unit.systemPrice <= 0) return;
      if (!currencyOn(filters.currency, unit.systemCurrency)) return;
      const own = kind === "house" ? unit.typeLabel : unit.typeLabel;
      const name = selectedProjectId === "all" && unit.projectName ? `${unit.projectName} - ${own}` : own;
      const row = groups.get(name) || { sumIQD: 0, countIQD: 0, sumUSD: 0, countUSD: 0 };
      if (unit.systemCurrency === "IQD") {
        row.sumIQD += unit.systemPrice;
        row.countIQD += 1;
      } else {
        row.sumUSD += unit.systemPrice;
        row.countUSD += 1;
      }
      groups.set(name, row);
    });
    return Array.from(groups.entries()).map(([name, row]) => ({
      name,
      "متوسط السعر (د.ع)": row.countIQD > 0 ? Math.round(row.sumIQD / row.countIQD) : 0,
      "متوسط السعر ($)": row.countUSD > 0 ? Math.round(row.sumUSD / row.countUSD) : 0,
    })).filter((item) => item["متوسط السعر (د.ع)"] > 0 || item["متوسط السعر ($)"] > 0);
  };

  const averagePriceDataHouses = useMemo(() => priced("house"), [structural, filters.currency, selectedProjectId]);
  const averagePriceDataApartments = useMemo(() => priced("apartment"), [structural, filters.currency, selectedProjectId]);

  const collection = useMemo(
    () => collectionRows(reportUnits, filters, collectionGroup, selectedProjectId === "all"),
    [reportUnits, filters, collectionGroup, selectedProjectId],
  );

  const collectionTotal = useMemo(() => collection.reduce((sum, row) => ({
    fileIQD: sum.fileIQD + row.fileIQD,
    receivedIQD: sum.receivedIQD + row.receivedIQD,
    remainingIQD: sum.remainingIQD + row.remainingIQD,
    fileUSD: sum.fileUSD + row.fileUSD,
    receivedUSD: sum.receivedUSD + row.receivedUSD,
    remainingUSD: sum.remainingUSD + row.remainingUSD,
    paid: sum.paid + row.paid,
    owing: sum.owing + row.owing,
  }), {
    fileIQD: 0,
    receivedIQD: 0,
    remainingIQD: 0,
    fileUSD: 0,
    receivedUSD: 0,
    remainingUSD: 0,
    paid: 0,
    owing: 0,
  }), [collection]);

  const dues = useMemo(
    () => summarizeDues(reportUnits, filters, dueFrom, dueTo, dueState),
    [reportUnits, filters, dueFrom, dueTo, dueState],
  );

  const cohorts = useMemo(() => saleCohortRows(reportUnits, filters), [reportUnits, filters]);
  const centersRanked = useMemo(
    () => sortCenterRows(centerRows(reportUnits, filters), centerSort, filters.currency),
    [reportUnits, filters, centerSort],
  );
  const overdueHits = useMemo(
    () => largestOverdue(reportUnits, filters, dueFrom, dueTo, dueState),
    [reportUnits, filters, dueFrom, dueTo, dueState],
  );
  const obligations = useMemo(() => obligationCross(reportUnits, filters), [reportUnits, filters]);

  const settledSales = useMemo(() => {
    let sold = 0;
    let investment = 0;
    structural.forEach((unit) => {
      if (unit.frozenUncounted) return;
      if (unit.status !== "sold" && unit.status !== "investment") return;
      if (filters.settlement !== "all" && !matchSettlement(unit, filters)) return;
      if (unit.status === "sold") sold += 1;
      else investment += 1;
    });
    return { sold, investment };
  }, [structural, filters.settlement]);

  const stockTotals = useMemo(() => {
    let units = 0;
    let sales = 0;
    reportUnits.forEach((unit) => {
      if (!matchStructure(unit, filters) || unit.frozenUncounted) return;
      units += 1;
      if (unit.status !== "sold" && unit.status !== "investment") return;
      if (filters.settlement !== "all" && !matchSettlement(unit, filters)) return;
      sales += 1;
    });
    return { units, sales };
  }, [reportUnits, filters]);

  const salesRatio = stats.total > 0
    ? Math.round(((settledSales.sold + settledSales.investment) / stats.total) * 100)
    : 0;

  const salesRatioHint = filters.settlement === "paid"
    ? `سددوا كامل المبلغ · مباع ${settledSales.sold} · استثمار ${settledSales.investment}`
    : filters.settlement === "remaining"
      ? `متبقي عليهم · مباع ${settledSales.sold} · استثمار ${settledSales.investment}`
      : `مباع ${settledSales.sold} · استثمار ${settledSales.investment}`;

  const showIQD = filters.currency !== "USD";
  const showUSD = filters.currency !== "IQD";

  const narrative = useMemo<NarrativeInput>(() => ({
    showIQD,
    showUSD,
    receivedIQD: money.receivedIQD,
    remainingIQD: money.remainingIQD,
    receivedUSD: money.receivedUSD,
    remainingUSD: money.remainingUSD,
    untrackedIQD: money.untrackedIQD,
    untrackedUSD: money.untrackedUSD,
    salesRatio,
    saleScoped,
    sold: settledSales.sold,
    investment: settledSales.investment,
    lifetimeSales: stockTotals.sales,
    lifetimeUnits: stockTotals.units,
    total: stats.total,
    available: stats.available,
    paid: collectionTotal.paid,
    owing: collectionTotal.owing,
    receivedTabo: stats.receivedTabo,
    receivedUnit: stats.receivedUnit,
    legalBase: stats.sold + stats.investment,
    legalInvestment: stats.investment,
    collection,
    cohorts,
    centers: centersRanked,
    overdueIQD: dues.overdueIQD,
    overdueUSD: dues.overdueUSD,
    todayIQD: dues.todayIQD,
    todayUSD: dues.todayUSD,
    upcomingIQD: dues.upcomingIQD,
    upcomingUSD: dues.upcomingUSD,
    soonIQD: dues.soonIQD,
    soonUSD: dues.soonUSD,
    ageOverIQD: dues.ageOverIQD,
    ageOverUSD: dues.ageOverUSD,
    ageMode,
    dueMonths: dues.months.map((month) => ({ key: month.key, name: month.name, iqd: month.remainingIQD, usd: month.remainingUSD })),
    overdueHits,
    performanceMode: moneyMeasure,
    performance: buildPerformance("screen"),
    performanceHouses: buildPerformance("houses"),
    performanceApartments: buildPerformance("towers"),
    trend: salesTrendData.map((row) => ({
      key: row.key,
      name: row.name,
      count: row["عدد الوحدات المباعة"],
      iqd: row["قيمة البيع (د.ع)"],
      usd: row["قيمة البيع ($)"],
    })),
    obligations,
    pricesHouses: averagePriceDataHouses.map((row) => ({ name: row.name, iqd: row["متوسط السعر (د.ع)"], usd: row["متوسط السعر ($)"] })),
    pricesApartments: averagePriceDataApartments.map((row) => ({ name: row.name, iqd: row["متوسط السعر (د.ع)"], usd: row["متوسط السعر ($)"] })),
  }), [
    showIQD, showUSD, money, salesRatio, settledSales, stockTotals, stats, collectionTotal, collection, cohorts, centersRanked,
    dues, ageMode, overdueHits, moneyMeasure, salesPerformanceData, salesTrendData, obligations,
    averagePriceDataHouses, averagePriceDataApartments,
  ]);
  const briefs = useMemo(() => buildBriefs(narrative), [narrative]);
  const contractScope = filters.settlement === "paid"
    ? "سددوا كامل المبلغ"
    : filters.settlement === "remaining"
      ? "متبقي عليهم"
      : "";
  const contractHint = (expected: number, text: string) => {
    const reserved = expected > 0 ? `محجوز متوقع ${text}` : "";
    return [contractScope, reserved].filter(Boolean).join(" · ");
  };
  const collectionHint = (count: number) => {
    if (followupMissing) return "جدول الدفعات غير منشأ، والتسديد غير محسوب";
    const settlement = filters.settlement === "paid"
      ? "سددوا كامل المبلغ"
      : filters.settlement === "remaining"
        ? "متبقي عليهم"
        : "";
    const gap = count > 0 ? `بلا ملف دفعات: ${formatNumber(count)} وحدة` : "من ملف الدفعات";
    return settlement ? `${gap} · ${settlement}` : gap;
  };
  const formatRate = (received: number, remaining: number) => {
    const rate = collectionRate(received, remaining);
    if (rate == null) return "—";
    const rounded = Math.round(rate * 10) / 10;
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
  };

  const periodCount = settledSales.sold + settledSales.investment;
  const periodShareHint = () => {
    if (periodCount <= 0) return "لا توجد عقود ضمن فترة البيع";
    const parts = [
      stockTotals.sales > 0 ? `${formatPct((periodCount / stockTotals.sales) * 100)} من إجمالي المبيعات (${formatNumber(stockTotals.sales)})` : "",
      stockTotals.units > 0 ? `${formatPct((periodCount / stockTotals.units) * 100)} من إجمالي الوحدات السكنية (${formatNumber(stockTotals.units)})` : "",
    ].filter(Boolean);
    return parts.join(" · ");
  };
  const statCells: StatCell[] = [
    {
      label: "قيمة العقود (د.ع)",
      value: showIQD ? formatNumber(money.contractIQD) : "—",
      hint: showIQD ? contractHint(money.expectedIQD, `${formatNumber(money.expectedIQD)} د.ع`) : "خارج تصفية العملة",
    },
    {
      label: "الواصل الكلي (د.ع)",
      value: showIQD ? formatNumber(money.receivedIQD) : "—",
      hint: showIQD ? collectionHint(money.untrackedIQD) : "خارج تصفية العملة",
      accent: showIQD ? STATUS_META.available.chart : undefined,
    },
    {
      label: "المتبقي (د.ع)",
      value: showIQD ? formatNumber(money.remainingIQD) : "—",
      hint: showIQD ? collectionHint(money.untrackedIQD) : "خارج تصفية العملة",
      accent: showIQD ? STATUS_META.sold.chart : undefined,
    },
    {
      label: saleScoped ? "عقود الفترة" : "نسبة المبيعات العامة",
      value: saleScoped ? formatNumber(settledSales.sold + settledSales.investment) : `${salesRatio}%`,
      hint: saleScoped ? periodShareHint() : salesRatioHint,
    },
    {
      label: "قيمة العقود ($)",
      value: showUSD ? `$${formatNumber(money.contractUSD)}` : "—",
      hint: showUSD ? contractHint(money.expectedUSD, `$${formatNumber(money.expectedUSD)}`) : "خارج تصفية العملة",
    },
    {
      label: "الواصل الكلي ($)",
      value: showUSD ? `$${formatNumber(money.receivedUSD)}` : "—",
      hint: showUSD ? collectionHint(money.untrackedUSD) : "خارج تصفية العملة",
      accent: showUSD ? STATUS_META.available.chart : undefined,
    },
    {
      label: "المتبقي ($)",
      value: showUSD ? `$${formatNumber(money.remainingUSD)}` : "—",
      hint: showUSD ? collectionHint(money.untrackedUSD) : "خارج تصفية العملة",
      accent: showUSD ? STATUS_META.sold.chart : undefined,
    },
    {
      label: saleScoped ? "استثمار ضمن الفترة" : "الوحدات المتاحة للبيع",
      value: saleScoped ? formatNumber(settledSales.investment) : formatNumber(stats.available),
      hint: saleScoped ? `مباع ${formatNumber(settledSales.sold)}` : `من أصل ${formatNumber(stats.total)} وحدة`,
    },
    {
      label: "نسبة التسديد (د.ع)",
      value: showIQD ? formatRate(money.receivedIQD, money.remainingIQD) : "—",
      hint: showIQD ? "الواصل من عقد الملف" : "خارج تصفية العملة",
      accent: showIQD ? STATUS_META.available.chart : undefined,
    },
    {
      label: "نسبة التسديد ($)",
      value: showUSD ? formatRate(money.receivedUSD, money.remainingUSD) : "—",
      hint: showUSD ? "الواصل من عقد الملف" : "خارج تصفية العملة",
      accent: showUSD ? STATUS_META.available.chart : undefined,
    },
  ];

  const filtersActive =
    filters.zones.length > 0 || filters.towers.length > 0 || filters.types.length > 0
    || filters.investors !== "with" || filters.center !== "all" || filters.currency !== "all"
    || filters.saleFrom !== "" || filters.saleTo !== "" || filters.settlement !== "all"
    || dueFrom !== "" || dueTo !== "" || dueState !== "all";

  const toggleValue = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

  const priceChartProps = {
    grid: chartGrid,
    axis: chartAxis,
  };

  const renderPriceChart = (data: typeof averagePriceDataHouses) => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={chartMargin} barCategoryGap="28%">
        <CartesianGrid {...priceChartProps.grid} />
        <XAxis dataKey="name" {...priceChartProps.axis} interval={0} height={48} angle={-18} textAnchor="end" />
        <YAxis tickFormatter={formatAxisValue} width={64} {...priceChartProps.axis} />
        <Tooltip
          cursor={{ fill: palette.surfaceSunken }}
          content={
            <ChartTooltip
              format={(value, name) =>
                name.includes('$') ? `$${formatNumber(value)}` : `${formatNumber(value)} د.ع`
              }
            />
          }
        />
        {showIQD && <Bar dataKey="متوسط السعر (د.ع)" fill={STATUS_META.available.chart} maxBarSize={26} />}
        {showUSD && <Bar dataKey="متوسط السعر ($)" fill={STATUS_META.pending.chart} maxBarSize={26} />}
      </BarChart>
    </ResponsiveContainer>
  );

  const priceLegend = (
    <ChartLegend
      items={[
        ...(showIQD ? [{ name: 'متوسط السعر (د.ع)', color: STATUS_META.available.chart }] : []),
        ...(showUSD ? [{ name: 'متوسط السعر ($)', color: STATUS_META.pending.chart }] : []),
      ]}
    />
  );

  const managementHint = (hint: string) => hint
    .replace(/بلا ملف دفعات/g, "بلا تسديد محسوب")
    .replace(/من ملف الدفعات/g, "")
    .replace(/ملف الدفعات/g, "")
    .replace(/ملف المتابعة/g, "")
    .replace(/عقد الملف/g, "قيمة العقد")
    .replace(/\s*·\s*·\s*/g, " · ")
    .replace(/^[\s·]+|[\s·]+$/g, "")
    .trim();

  const makePack = (sections: ReportSectionId[], brief: ReportSectionId[]) => {
    const isAll = selectedProjectId === "all";
    const projectName = isAll
      ? "كافة المشاريع"
      : projects.find((project) => project.id === selectedProjectId)?.name || "مشروع";
    const projectNames = isAll
      ? Array.from(new Set(reportUnits.map((unit) => unit.projectName).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, "ar"))
      : [];
    const title = isAll ? "تقرير مفصل" : `تقرير مفصل ${projectName}`;
    const saleDay = (value: string) => {
      const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
      if (!match) return value;
      return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString("ar-IQ", { day: "numeric", month: "long", year: "numeric" });
    };
    const salePeriod = filters.saleFrom || filters.saleTo
      ? `يشمل عقود الوحدات السكنية المباعة في الفترة من ${filters.saleFrom ? saleDay(filters.saleFrom) : "بداية السجلات"} إلى ${filters.saleTo ? saleDay(filters.saleTo) : "اليوم"}`
      : "";
    const settlementLabel = filters.settlement === "paid" ? "سددوا كامل المبلغ" : filters.settlement === "remaining" ? "متبقي عليهم" : "الكل";
    const dueLabel = dueState === "overdue" ? "متأخرة" : dueState === "today" ? "اليوم" : dueState === "upcoming" ? "قادمة" : "الكل";
    const measureLabel = moneyMeasure === "contract" ? "قيمة العقود" : moneyMeasure === "remaining" ? "المتبقي" : "العدد";
    const scope = [
      `العملة: ${filters.currency === "IQD" ? "دينار" : filters.currency === "USD" ? "دولار" : "الكل"}`,
      `السداد: ${settlementLabel}`,
      `المستثمرون: ${filters.investors === "without" ? "مخفيون" : "ضمن الأرقام"}`,
      `المركز التسويقي: ${filters.center === "all" ? "الكل" : filters.center}`,
      filters.zones.length > 0 ? `زونات: ${filters.zones.join("، ")}` : "",
      filters.towers.length > 0 ? `عمارات: ${filters.towers.map((id) => options.towers.find((tower) => tower[0] === id)?.[1] || id).join("، ")}` : "",
      filters.types.length > 0 ? `الأنواع: ${filters.types.map((key) => options.types.find((type) => type[0] === key)?.[1] || key).join("، ")}` : "",
      filters.saleFrom || filters.saleTo ? `تاريخ البيع: ${filters.saleFrom || "…"} → ${filters.saleTo || "…"}` : "",
      dueFrom || dueTo || dueState !== "all" ? `الاستحقاق: ${dueFrom || "…"} → ${dueTo || "…"} · ${dueLabel}` : "",
      `أعمار المتأخر: ${ageMode === "slices" ? "الشرائح" : "المتأخر كله"}`,
      `أداء المبيعات: ${measureLabel}${selectedProjectId === "all" ? "" : salesViewMode === "houses" ? " · المنازل" : " · العمارات"}`,
      `ترتيب المراكز: ${centerSort === "rate" ? "الأضعف تسديداً" : "الأكبر متبقياً"}`,
      `موقف التسديد: ${collectionGroup === "zone" ? "حسب الزون" : "حسب النوع"}`,
    ].filter(Boolean);
    return buildReportPack(narrative, {
      title,
      projectName,
      projectNames,
      salePeriod,
      scope,
      sections,
      briefSections: brief.filter((id) => sections.includes(id)),
      cards: statCells.map((cell) => ({
        label: String(cell.label),
        value: String(cell.value),
        hint: managementHint(String(cell.hint || "")),
      })),
      status: statusDistributionData.map((item) => ({ name: item.name, value: item.value, color: item.color })),
      legal: [
        { label: "مستلم الطابو", value: stats.receivedTabo, total: stats.sold + stats.investment },
        { label: "قيد الترويج", value: stats.promotedTabo, total: stats.sold + stats.investment },
        { label: "غير مروج", value: stats.notPromotedTabo, total: stats.sold + stats.investment },
        { label: "تم تسليم المفتاح", value: stats.receivedUnit, total: stats.sold + stats.investment },
        { label: "غير مستلم بعد", value: stats.notReceivedUnit, total: stats.sold + stats.investment },
      ],
      colors: {
        total: palette.lineStrong,
        sold: STATUS_META.sold.chart,
        investment: STATUS_META.investment.chart,
        contractIqd: palette.fg,
        contractUsd: STATUS_META.pending.chart,
        remaining: STATUS_META.sold.chart,
      },
    });
  };

  const toggleExportSection = (id: ReportSectionId, checked: boolean) => {
    const next = checked
      ? [...exportSections, id]
      : exportSections.filter((item) => item !== id);
    const brief = checked ? briefSections : briefSections.filter((item) => item !== id);
    setExportSections(next);
    setBriefSections(brief);
    saveExportChoice(next, brief);
  };

  const toggleBriefSection = (id: ReportSectionId, checked: boolean) => {
    const next = checked
      ? [...briefSections, id]
      : briefSections.filter((item) => item !== id);
    setBriefSections(next);
    saveExportChoice(exportSections, next);
  };

  const hasSelectedProject = selectedProjectId !== '';

  if (checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-[13px] text-fg-muted">
        جاري التحقق من صلاحيات الوصول
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-md space-y-6 border border-line bg-surface p-8 text-center">
          <AlertTriangle size={26} strokeWidth={1.25} className="mx-auto text-status-sold" />
          <div className="space-y-2">
            <h2 className="text-lg font-normal text-fg">لا تملك صلاحية الوصول</h2>
            <p className="text-[12px] leading-relaxed text-fg-muted">
              تم تقييد وصول هذا القسم إلى لوحة التقارير والتحليلات المالية من قبل الإدارة.
              يرجى مراجعة المسؤول للحصول على الصلاحية.
            </p>
          </div>
          <Button onClick={() => navigate('/')} className="w-full">
            العودة إلى الأقسام
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      brandSubtitle="التقارير والتحليلات"
      nav={<SectionNav />}
      actions={
        <Select
          value={selectedProjectId || undefined}
          onValueChange={setSelectedProjectId}
        >
          <SelectTrigger className="h-8 w-[200px] text-[12px]">
            <SelectValue placeholder="اختر المشروع أو المدينة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كافة المشاريع المدمجة</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-h-[85vh] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تصدير التقرير</DialogTitle>
            <DialogDescription>
              النبذة تبقى كاملة. «مختصر» يكتفي بأعلى 5 بنود في الجدول التفصيلي.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            {REPORT_SECTIONS.map((section) => {
              const included = exportSections.includes(section.id);
              return (
                <div key={section.id} className="flex items-start gap-2">
                  <Checkbox
                    checked={included}
                    onCheckedChange={(checked) => toggleExportSection(section.id, checked === true)}
                  />
                  <span>
                    <span className="block text-[13px] text-fg">{section.label}</span>
                    <span className="block text-[11px] text-fg-muted">{section.hint}</span>
                    {section.briefable && included && (
                      <label className="mt-1 flex items-center gap-1.5 text-[11px] text-fg">
                        <Checkbox
                          checked={briefSections.includes(section.id)}
                          onCheckedChange={(checked) => toggleBriefSection(section.id, checked === true)}
                        />
                        مختصر
                      </label>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                const next = defaultSections();
                setExportSections(next);
                setBriefSections([]);
                saveExportChoice(next, []);
              }}
            >
              المقترح
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={exportSections.length === 0}
              onClick={() => {
                void exportReportWorkbook(makePack(exportSections, briefSections));
                setExportOpen(false);
              }}
            >
              Excel
            </Button>
            <Button
              type="button"
              disabled={exportSections.length === 0}
              onClick={() => {
                saveReportPack(makePack(exportSections, briefSections));
                window.open("/reports/print", "_blank");
                setExportOpen(false);
              }}
            >
              تقرير الإدارة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Filter bar — يظهر فقط بعد اختيار مشروع */}
      {hasSelectedProject && (
      <div className="mt-8 space-y-4 border-y border-line py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-fg-muted">
            <Filter size={13} />
            <span className="eyebrow">تصفية</span>
          </div>
          <span className="text-[11px] text-fg-faint">الزون للمنزل، والعمارة للشقة، والنوع يجمع الاثنين معاً</span>
          <div className="ms-auto flex items-center gap-2">
            {filtersActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilters(EMPTY_REPORT_FILTERS);
                  setDueFrom("");
                  setDueTo("");
                  setDueState("all");
                }}
                className="text-status-sold hover:text-status-sold"
              >
                إعادة تعيين
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={loading || fetchedElements.length === 0}
              onClick={() => setExportOpen(true)}
            >
              <Download size={14} />
              تصدير
            </Button>
          </div>
        </div>

        {options.zones.length > 0 && (
          <ChipRow label="زونات المنازل">
            {options.zones.map((zone) => (
              <ChoiceChip
                key={zone}
                active={filters.zones.includes(zone)}
                onClick={() => setFilters({ ...filters, zones: toggleValue(filters.zones, zone) })}
              >
                زون {zone}
              </ChoiceChip>
            ))}
          </ChipRow>
        )}

        {options.towers.length > 0 && (
          <ChipRow label="العمارات">
            {options.towers.map(([id, label]) => (
              <ChoiceChip
                key={id}
                active={filters.towers.includes(id)}
                onClick={() => setFilters({ ...filters, towers: toggleValue(filters.towers, id) })}
              >
                {label}
              </ChoiceChip>
            ))}
          </ChipRow>
        )}

        {options.types.length > 0 && (
          <ChipRow label="نوع الوحدة">
            {options.types.map(([key, label]) => (
              <ChoiceChip
                key={key}
                active={filters.types.includes(key)}
                onClick={() => setFilters({ ...filters, types: toggleValue(filters.types, key) })}
              >
                {label}
              </ChoiceChip>
            ))}
          </ChipRow>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <FilterSelect label="العملة" value={filters.currency} onChange={(value) => setFilters({ ...filters, currency: value as ReportFilters["currency"] })}>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="IQD">دينار</SelectItem>
            <SelectItem value="USD">دولار</SelectItem>
          </FilterSelect>
          <FilterSelect label="السداد" value={filters.settlement} onChange={(value) => setFilters({ ...filters, settlement: value as ReportFilters["settlement"] })}>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="remaining">متبقي عليهم</SelectItem>
            <SelectItem value="paid">سددوا كامل المبلغ</SelectItem>
          </FilterSelect>
          <FilterSelect label="المستثمرون" value={filters.investors} onChange={(value) => setFilters({ ...filters, investors: value as ReportFilters["investors"] })}>
            <SelectItem value="with">ضمن الأرقام</SelectItem>
            <SelectItem value="without">إخفاؤهم</SelectItem>
          </FilterSelect>
          <FilterSelect label="المركز التسويقي" value={filters.center} onChange={(value) => setFilters({ ...filters, center: value })}>
            <SelectItem value="all">الكل</SelectItem>
            {options.centers.map((name) => (
              <SelectItem key={name} value={name}>{name}</SelectItem>
            ))}
          </FilterSelect>
          <label className="space-y-1">
            <span className="text-[11px] text-fg-muted">تاريخ البيع من</span>
            <Input type="date" value={filters.saleFrom} onChange={(event) => setFilters({ ...filters, saleFrom: event.target.value })} className="h-8" />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] text-fg-muted">تاريخ البيع إلى</span>
            <Input type="date" value={filters.saleTo} onChange={(event) => setFilters({ ...filters, saleTo: event.target.value })} className="h-8" />
          </label>
        </div>
      </div>
      )}

      {!hasSelectedProject ? (
        <div className="mt-10">
          <EmptyState
            icon={<PieIcon size={26} strokeWidth={1.25} />}
            title="اختر مشروعاً لعرض التقرير"
            description="لم يتم تحميل أي بيانات بعد. اختر مدينة أو مشروعاً محدداً من القائمة أعلاه، أو «كافة المشاريع المدمجة» لإنشاء التقرير الشامل."
          />
        </div>
      ) : loading ? (
        <div className="mt-10">
          <LoadingBlock label="جاري تحميل وتحليل البيانات المالية" />
        </div>
      ) : fetchedElements.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<AlertTriangle size={26} strokeWidth={1.25} />}
            title="لم يتم تحميل أي بيانات"
            description="تعذّر الاتصال بقاعدة البيانات أو لا توجد مخططات محمّلة لهذا المشروع."
            action={
              <Button variant="outline" onClick={() => setRetryTrigger(prev => prev + 1)} className="gap-2">
                <RefreshCcw size={14} /> إعادة المحاولة
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-10 space-y-4">
            <StatGrid items={statCells} columns={4} />
            <SectionBrief text={briefs.cards} />
          </div>

          <Panel
            className="mt-6"
            icon={<Wallet size={14} />}
            title="موقف التسديد"
            description="قيمة العقد من ملف الدفعات، وتساوي الواصل زائد المتبقي. البطاقات أعلاه تُبقي سعر البيع المسجل على الوحدة."
            actions={
              <SegmentedControl
                value={collectionGroup}
                onChange={(value) => setCollectionGroup(value)}
                options={[
                  { value: "type", label: "حسب النوع" },
                  { value: "zone", label: "حسب الزون" },
                ]}
              />
            }
            bodyClassName="p-0"
          >
            <SectionBrief text={briefs.collection} inset />
            {collection.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-surface text-fg-muted">
                    <tr className="border-b border-line">
                      {["النطاق", ...(showIQD ? ["عقد د.ع", "واصل د.ع", "متبقي د.ع", "نسبة د.ع"] : []), ...(showUSD ? ["عقد $", "واصل $", "متبقي $", "نسبة $"] : []), "سددوا", "عليهم"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-start font-normal">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {collection.map((row) => (
                      <tr key={row.name} className="border-b border-line">
                        <td className="px-4 py-3 text-fg">{row.name}</td>
                        {showIQD && <MoneyCell value={row.fileIQD} />}
                        {showIQD && <MoneyCell value={row.receivedIQD} tone="in" />}
                        {showIQD && <MoneyCell value={row.remainingIQD} tone="out" />}
                        {showIQD && <RateCell received={row.receivedIQD} remaining={row.remainingIQD} />}
                        {showUSD && <MoneyCell value={row.fileUSD} prefix="$" />}
                        {showUSD && <MoneyCell value={row.receivedUSD} prefix="$" tone="in" />}
                        {showUSD && <MoneyCell value={row.remainingUSD} prefix="$" tone="out" />}
                        {showUSD && <RateCell received={row.receivedUSD} remaining={row.remainingUSD} />}
                        <td className="px-4 py-3 font-mono tabular-nums text-fg">{formatNumber(row.paid)}</td>
                        <td className="px-4 py-3 font-mono tabular-nums text-fg">{formatNumber(row.owing)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-surface-sunken">
                      <td className="px-4 py-3 font-semibold text-fg">المجموع الكلي</td>
                      {showIQD && <MoneyCell value={collectionTotal.fileIQD} strong />}
                      {showIQD && <MoneyCell value={collectionTotal.receivedIQD} tone="in" strong />}
                      {showIQD && <MoneyCell value={collectionTotal.remainingIQD} tone="out" strong />}
                      {showIQD && <RateCell received={collectionTotal.receivedIQD} remaining={collectionTotal.remainingIQD} strong />}
                      {showUSD && <MoneyCell value={collectionTotal.fileUSD} prefix="$" strong />}
                      {showUSD && <MoneyCell value={collectionTotal.receivedUSD} prefix="$" tone="in" strong />}
                      {showUSD && <MoneyCell value={collectionTotal.remainingUSD} prefix="$" tone="out" strong />}
                      {showUSD && <RateCell received={collectionTotal.receivedUSD} remaining={collectionTotal.remainingUSD} strong />}
                      <td className="px-4 py-3 font-mono text-[13px] font-semibold tabular-nums text-fg">{formatNumber(collectionTotal.paid)}</td>
                      <td className="px-4 py-3 font-mono text-[13px] font-semibold tabular-nums text-fg">{formatNumber(collectionTotal.owing)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-5">
                <ChartEmpty>
                  {followupMissing
                    ? "جدول الدفعات غير منشأ، نفّذ ملف المتابعة في قاعدة البيانات"
                    : "لا يوجد تسديد محسوب ضمن هذه التصفية. المشروع بلا ملف دفعات لا يُعامل كسداد كامل"}
                </ChartEmpty>
              </div>
            )}
          </Panel>

          <Panel
            className="mt-6"
            icon={<Wallet size={14} />}
            title="عمر الدين حسب تاريخ البيع"
            description="كل صف سنة بيع. المتبقي هو ما زال مفتوحاً الآن من مبيعات تلك السنة، والعقد من ملف الدفعات."
            bodyClassName="p-0"
          >
            <SectionBrief text={briefs.cohort} inset />
            {cohorts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-surface text-fg-muted">
                    <tr className="border-b border-line">
                      {["السنة", "الوحدات", ...(showIQD ? ["عقد د.ع", "واصل د.ع", "متبقي د.ع", "نسبة د.ع"] : []), ...(showUSD ? ["عقد $", "واصل $", "متبقي $", "نسبة $"] : [])].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-start font-normal">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.map((row) => (
                      <tr key={row.name} className="border-b border-line last:border-0">
                        <td className="px-4 py-3 text-fg">{row.name}</td>
                        <td className="px-4 py-3 font-mono tabular-nums text-fg">{formatNumber(row.count)}</td>
                        {showIQD && <MoneyCell value={row.fileIQD} />}
                        {showIQD && <MoneyCell value={row.receivedIQD} tone="in" />}
                        {showIQD && <MoneyCell value={row.remainingIQD} tone="out" />}
                        {showIQD && <RateCell received={row.receivedIQD} remaining={row.remainingIQD} />}
                        {showUSD && <MoneyCell value={row.fileUSD} prefix="$" />}
                        {showUSD && <MoneyCell value={row.receivedUSD} prefix="$" tone="in" />}
                        {showUSD && <MoneyCell value={row.remainingUSD} prefix="$" tone="out" />}
                        {showUSD && <RateCell received={row.receivedUSD} remaining={row.remainingUSD} />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-5"><ChartEmpty>لا توجد وحدات بعقد ملف ضمن هذه التصفية</ChartEmpty></div>
            )}
          </Panel>

          <Panel
            className="mt-6"
            icon={<Building2 size={14} />}
            title="ترتيب المراكز التسويقية"
            description="حسب المتبقي أو أضعف نسبة تسديد. غير محدد هو ما لم تطابقه بادئة المركز."
            actions={
              <SegmentedControl
                value={centerSort}
                onChange={(value) => setCenterSort(value)}
                options={[
                  { value: "remaining", label: "الأكبر متبقياً" },
                  { value: "rate", label: "الأضعف تسديداً" },
                ]}
              />
            }
            bodyClassName="p-0"
          >
            <SectionBrief text={briefs.centers} inset />
            {centersRanked.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-surface text-fg-muted">
                    <tr className="border-b border-line">
                      {["المركز", ...(showIQD ? ["عقد د.ع", "واصل د.ع", "متبقي د.ع", "نسبة د.ع"] : []), ...(showUSD ? ["عقد $", "واصل $", "متبقي $", "نسبة $"] : []), "عليهم"].map((heading) => (
                        <th key={heading} className="px-4 py-3 text-start font-normal">{heading}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {centersRanked.map((row) => (
                      <tr key={row.name} className="border-b border-line">
                        <td className="px-4 py-3 text-fg">{row.name}</td>
                        {showIQD && <MoneyCell value={row.fileIQD} />}
                        {showIQD && <MoneyCell value={row.receivedIQD} tone="in" />}
                        {showIQD && <MoneyCell value={row.remainingIQD} tone="out" />}
                        {showIQD && <RateCell received={row.receivedIQD} remaining={row.remainingIQD} />}
                        {showUSD && <MoneyCell value={row.fileUSD} prefix="$" />}
                        {showUSD && <MoneyCell value={row.receivedUSD} prefix="$" tone="in" />}
                        {showUSD && <MoneyCell value={row.remainingUSD} prefix="$" tone="out" />}
                        {showUSD && <RateCell received={row.receivedUSD} remaining={row.remainingUSD} />}
                        <td className="px-4 py-3 font-mono tabular-nums text-fg">{formatNumber(row.owing)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-line bg-surface-sunken">
                      <td className="px-4 py-3 font-semibold text-fg">المجموع الكلي</td>
                      {showIQD && <MoneyCell value={collectionTotal.fileIQD} strong />}
                      {showIQD && <MoneyCell value={collectionTotal.receivedIQD} tone="in" strong />}
                      {showIQD && <MoneyCell value={collectionTotal.remainingIQD} tone="out" strong />}
                      {showIQD && <RateCell received={collectionTotal.receivedIQD} remaining={collectionTotal.remainingIQD} strong />}
                      {showUSD && <MoneyCell value={collectionTotal.fileUSD} prefix="$" strong />}
                      {showUSD && <MoneyCell value={collectionTotal.receivedUSD} prefix="$" tone="in" strong />}
                      {showUSD && <MoneyCell value={collectionTotal.remainingUSD} prefix="$" tone="out" strong />}
                      {showUSD && <RateCell received={collectionTotal.receivedUSD} remaining={collectionTotal.remainingUSD} strong />}
                      <td className="px-4 py-3 font-mono text-[13px] font-semibold tabular-nums text-fg">{formatNumber(collectionTotal.owing)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="p-5"><ChartEmpty>لا توجد مراكز ضمن هذه التصفية</ChartEmpty></div>
            )}
          </Panel>

          <div className="mt-6">
            <Panel
              icon={<CalendarRange size={14} />}
              title="الاستحقاقات"
              description="المتبقي على الدفعات المفتوحة فقط، حسب موعد الاستحقاق. هذا الفلتر لا يغيّر بقية التقارير."
              actions={
                <SegmentedControl
                  value={ageMode}
                  onChange={(value) => setAgeMode(value)}
                  options={[
                    { value: "all", label: "المتأخر كله" },
                    { value: "slices", label: "الشرائح" },
                  ]}
                />
              }
              bodyClassName="space-y-5 p-5"
            >
              <SectionBrief text={briefs.dues} />
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="space-y-1">
                  <span className="text-[11px] text-fg-muted">من</span>
                  <Input type="date" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} className="h-8" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-fg-muted">إلى</span>
                  <Input type="date" value={dueTo} onChange={(event) => setDueTo(event.target.value)} className="h-8" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] text-fg-muted">حالة الدفعة</span>
                  <Select value={dueState} onValueChange={(value) => setDueState(value as typeof dueState)}>
                    <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      <SelectItem value="overdue">متأخرة</SelectItem>
                      <SelectItem value="today">اليوم</SelectItem>
                      <SelectItem value="upcoming">قادمة</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
              </div>
              {dues.count > 0 ? (
                <>
                  <div className="text-[11px] text-fg-muted">{formatNumber(dues.count)} دفعة مفتوحة</div>
                  <div className={showIQD && showUSD ? "grid gap-3 sm:grid-cols-2" : ""}>
                    {showIQD && (
                      <div className="border border-line px-4 py-3">
                        <div className="text-[11px] text-fg-muted">مستحق خلال 30 يوماً — دينار</div>
                        <div className="mt-1 font-mono text-[18px] tabular-nums text-fg">{formatNumber(dues.soonIQD)}</div>
                        <div className="mt-1 text-[11px] text-fg-muted">المتأخر، واليوم، والقادم حتى 30 يوماً</div>
                      </div>
                    )}
                    {showUSD && (
                      <div className="border border-line px-4 py-3">
                        <div className="text-[11px] text-fg-muted">مستحق خلال 30 يوماً — دولار</div>
                        <div className="mt-1 font-mono text-[18px] tabular-nums text-fg">${formatNumber(dues.soonUSD)}</div>
                        <div className="mt-1 text-[11px] text-fg-muted">المتأخر، واليوم، والقادم حتى 30 يوماً</div>
                      </div>
                    )}
                  </div>
                  {showIQD && (
                    <div className="space-y-3">
                      <div className="eyebrow">دينار</div>
                      {ageMode === "all" ? (
                        <Meter label="متأخر" value={dues.overdueIQD} total={dues.overdueIQD + dues.todayIQD + dues.upcomingIQD} color={STATUS_META.sold.chart} />
                      ) : (
                        <>
                          <Meter label="حتى 30 يوماً" value={dues.age30IQD} total={dues.overdueIQD} color={STATUS_META.sold.chart} />
                          <Meter label="من 31 إلى 60" value={dues.age60IQD} total={dues.overdueIQD} color={STATUS_META.reserved.chart} />
                          <Meter label="من 61 إلى 90" value={dues.age90IQD} total={dues.overdueIQD} color={STATUS_META.pending.chart} />
                          <Meter label="أكثر من 90" value={dues.ageOverIQD} total={dues.overdueIQD} color={palette.fg} />
                        </>
                      )}
                      <Meter label="مستحق اليوم" value={dues.todayIQD} total={dues.overdueIQD + dues.todayIQD + dues.upcomingIQD} color={STATUS_META.reserved.chart} />
                      <Meter label="قادم" value={dues.upcomingIQD} total={dues.overdueIQD + dues.todayIQD + dues.upcomingIQD} color={STATUS_META.available.chart} />
                    </div>
                  )}
                  {showUSD && (
                    <div className="space-y-3">
                      <div className="eyebrow">دولار</div>
                      {ageMode === "all" ? (
                        <Meter label="متأخر" value={dues.overdueUSD} total={dues.overdueUSD + dues.todayUSD + dues.upcomingUSD} color={STATUS_META.sold.chart} />
                      ) : (
                        <>
                          <Meter label="حتى 30 يوماً" value={dues.age30USD} total={dues.overdueUSD} color={STATUS_META.sold.chart} />
                          <Meter label="من 31 إلى 60" value={dues.age60USD} total={dues.overdueUSD} color={STATUS_META.reserved.chart} />
                          <Meter label="من 61 إلى 90" value={dues.age90USD} total={dues.overdueUSD} color={STATUS_META.pending.chart} />
                          <Meter label="أكثر من 90" value={dues.ageOverUSD} total={dues.overdueUSD} color={palette.fg} />
                        </>
                      )}
                      <Meter label="مستحق اليوم" value={dues.todayUSD} total={dues.overdueUSD + dues.todayUSD + dues.upcomingUSD} color={STATUS_META.reserved.chart} />
                      <Meter label="قادم" value={dues.upcomingUSD} total={dues.overdueUSD + dues.todayUSD + dues.upcomingUSD} color={STATUS_META.available.chart} />
                    </div>
                  )}
                  {(showIQD || showUSD) && dues.months.length > 0 && (
                    <div className={showIQD && showUSD ? "grid gap-4" : ""}>
                      {showIQD && dues.months.some((month) => month.remainingIQD !== 0) && (
                        <div className="h-44">
                          <div className="eyebrow mb-1">حسب شهر الاستحقاق — دينار</div>
                          <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={dues.months} margin={chartMargin}>
                              <CartesianGrid {...chartGrid} />
                              <XAxis dataKey="name" {...chartAxis} interval={0} />
                              <YAxis tickFormatter={formatAxisValue} width={64} {...chartAxis} />
                              <Tooltip cursor={{ fill: palette.surfaceSunken }} content={<ChartTooltip format={(value) => `${formatNumber(value)} د.ع`} />} />
                              <Bar dataKey="remainingIQD" name="المتبقي (د.ع)" fill={STATUS_META.sold.chart} maxBarSize={18} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                      {showUSD && dues.months.some((month) => month.remainingUSD !== 0) && (
                        <div className="h-44">
                          <div className="eyebrow mb-1">حسب شهر الاستحقاق — دولار</div>
                          <ResponsiveContainer width="100%" height="85%">
                            <BarChart data={dues.months} margin={chartMargin}>
                              <CartesianGrid {...chartGrid} />
                              <XAxis dataKey="name" {...chartAxis} interval={0} />
                              <YAxis tickFormatter={formatAxisValue} width={64} {...chartAxis} />
                              <Tooltip cursor={{ fill: palette.surfaceSunken }} content={<ChartTooltip format={(value) => `$${formatNumber(value)}`} />} />
                              <Bar dataKey="remainingUSD" name="المتبقي ($)" fill={STATUS_META.pending.chart} maxBarSize={18} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-6 border-t border-line pt-5">
                    <div>
                      <div className="text-[14px] font-semibold text-fg">أكبر المتأخرات</div>
                      <SectionBrief text={briefs.overdue} />
                      <div className="mt-1 text-[11px] text-fg-muted">أول 20 وحدة حسب مجموع الدفعات المتأخرة، مع عمر أقدم دفعة.</div>
                    </div>
                    {showIQD && <OverdueTable title="دينار" rows={overdueHits.iqd} prefix="" />}
                    {showUSD && <OverdueTable title="دولار" rows={overdueHits.usd} prefix="$" />}
                  </div>
                </>
              ) : (
                <ChartEmpty>لا توجد دفعات مفتوحة ضمن هذه التصفية</ChartEmpty>
              )}
            </Panel>
          </div>

          {/* Distribution + performance */}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              icon={<PieIcon size={14} />}
              title="توزيع المبيعات"
              description="نسبة كل حالة من إجمالي الوحدات المحتسبة"
              className="lg:col-span-1"
              bodyClassName="flex flex-col gap-4 p-5"
            >
              <SectionBrief text={briefs.status} />
              <div className="h-52">
                {statusDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={1}
                        dataKey="value"
                        stroke={palette.surface}
                        strokeWidth={1}
                      >
                        {statusDistributionData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip format={(v) => `${formatNumber(v)} وحدة`} />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty>لا توجد وحدات لعرضها</ChartEmpty>
                )}
              </div>
              <div className="divide-y divide-line border-t border-line">
                {statusDistributionData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 py-2 text-[11px]">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-fg-secondary">{entry.name}</span>
                    <span className="ms-auto font-mono tabular-nums text-fg">
                      {formatNumber(entry.value)}
                    </span>
                    {!saleScoped && (
                      <span className="w-10 text-end font-mono tabular-nums text-fg-faint">
                        {stats.total > 0 ? `${Math.round((entry.value / stats.total) * 100)}%` : "—"}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              icon={<Building2 size={14} />}
              title={
                moneyMeasure === "count"
                  ? selectedProjectId === "all"
                    ? "أداء المبيعات حسب المشاريع"
                    : salesViewMode === "houses"
                      ? "أداء مبيعات المنازل حسب الزونات"
                      : "أداء مبيعات العمارات"
                  : moneyMeasure === "contract"
                    ? "قيمة العقود"
                    : "المتبقي على الدفعات"
              }
              description={
                moneyMeasure === "remaining"
                  ? "مجموع المتبقي ضمن التصفية. الوحدة التي بلا ملف دفعات لا تُحسب صفراً"
                  : moneyMeasure === "contract"
                    ? "سعر البيع المسجل على الوحدة المباعة أو الاستثمار، حسب تاريخ البيع"
                    : saleScoped
                      ? "عقود الفترة مقابل إجمالي المبيعات وإجمالي الوحدات السكنية"
                      : selectedProjectId === "all"
                      ? "مقارنة الوحدات المباعة والاستثمارية مقابل الإجمالي لكل مشروع"
                      : salesViewMode === "houses"
                        ? "مقارنة الوحدات المباعة والاستثمارية مقابل الإجمالي لكل زون"
                        : "مقارنة الوحدات المباعة والاستثمارية لكل عمارة على حدة"
              }
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <SegmentedControl
                    value={moneyMeasure}
                    onChange={(value) => setMoneyMeasure(value)}
                    options={[
                      { value: "count", label: "العدد" },
                      { value: "contract", label: "قيمة العقود" },
                      { value: "remaining", label: "المتبقي" },
                    ]}
                  />
                  {selectedProjectId !== "all" && (
                    <SegmentedControl
                      value={salesViewMode}
                      onChange={(value) => setSalesViewMode(value)}
                      options={[
                        { value: "houses", label: "المنازل" },
                        { value: "towers", label: "العمارات" },
                      ]}
                    />
                  )}
                </div>
              }
              className="lg:col-span-2"
              bodyClassName="flex flex-col gap-4 p-5"
            >
              <SectionBrief text={briefs.performance} />
              <div ref={chartRowRef} className="flex w-full min-w-0 flex-col gap-8">
                {salesPerformanceData.length > 0 ? (
                  (moneyMeasure === "count"
                    ? [{ key: "count", label: "" }]
                    : [
                        ...(showIQD ? [{ key: moneyMeasure === "contract" ? "قيمة العقود (د.ع)" : "المتبقي (د.ع)", label: "دينار" }] : []),
                        ...(showUSD ? [{ key: moneyMeasure === "contract" ? "قيمة العقود ($)" : "المتبقي ($)", label: "دولار" }] : []),
                      ]
                  ).map((series) => {
                    const plotWidth = Math.max(chartRowWidth, salesPerformanceData.length * (series.key === "count" ? (saleScoped ? 96 : 56) : 44));
                    const plotHeight = series.label ? 220 : 256;
                    return (
                    <div key={series.key} className="w-full overflow-x-auto">
                      {series.label && <div className="eyebrow mb-2">{series.label}</div>}
                      <BarChart data={salesPerformanceData} width={plotWidth} height={plotHeight} margin={chartMargin} barCategoryGap="18%" barGap={2}>
                          <CartesianGrid {...chartGrid} />
                          <XAxis dataKey="name" {...chartAxis} interval={0} />
                          <YAxis tickFormatter={formatAxisValue} width={series.key === "count" ? 48 : 64} {...chartAxis} />
                          <Tooltip
                            cursor={{ fill: palette.surfaceSunken }}
                            content={
                              <ChartTooltip
                                format={(value, name) => {
                                  if (name.includes("$")) return `$${formatNumber(value)}`;
                                  if (name.includes("د.ع")) return `${formatNumber(value)} د.ع`;
                                  return formatNumber(value);
                                }}
                              />
                            }
                          />
                          {series.key === "count" && !saleScoped && <Bar dataKey="إجمالي الوحدات" fill={palette.lineStrong} maxBarSize={22} />}
                          {series.key === "count" && !saleScoped && <Bar dataKey="المباعة" fill={STATUS_META.sold.chart} maxBarSize={22} />}
                          {series.key === "count" && !saleScoped && <Bar dataKey="الاستثمار" fill={STATUS_META.investment.chart} maxBarSize={22} />}
                          {series.key === "count" && saleScoped && <Bar dataKey="عقود الفترة" fill={STATUS_META.sold.chart} maxBarSize={18} />}
                          {series.key === "count" && saleScoped && <Bar dataKey="إجمالي المبيعات" fill={palette.fg} maxBarSize={18} />}
                          {series.key === "count" && saleScoped && <Bar dataKey="إجمالي الوحدات السكنية" fill={palette.lineStrong} maxBarSize={18} />}
                          {series.key !== "count" && (
                            <Bar
                              dataKey={series.key}
                              fill={series.key.includes("متبقي") ? STATUS_META.sold.chart : series.key.includes("$") ? STATUS_META.pending.chart : palette.fg}
                              maxBarSize={22}
                            />
                          )}
                        </BarChart>
                    </div>
                    );
                  })
                ) : (
                  <ChartEmpty>لا توجد بيانات كافية للعرض</ChartEmpty>
                )}
              </div>
              <ChartLegend
                className="border-t border-line pt-4"
                items={
                  moneyMeasure === "count"
                    ? saleScoped
                      ? [
                          { name: "عقود الفترة", color: STATUS_META.sold.chart },
                          { name: "إجمالي المبيعات", color: palette.fg },
                          { name: "إجمالي الوحدات السكنية", color: palette.lineStrong },
                        ]
                      : [
                          { name: "إجمالي الوحدات", color: palette.lineStrong },
                          { name: "المباعة", color: STATUS_META.sold.chart },
                          { name: "الاستثمار", color: STATUS_META.investment.chart },
                        ]
                    : [
                        ...(showIQD ? [{ name: moneyMeasure === "contract" ? "قيمة العقود (د.ع)" : "المتبقي (د.ع)", color: moneyMeasure === "remaining" ? STATUS_META.sold.chart : palette.fg }] : []),
                        ...(showUSD ? [{ name: moneyMeasure === "contract" ? "قيمة العقود ($)" : "المتبقي ($)", color: STATUS_META.pending.chart }] : []),
                      ]
                }
              />
            </Panel>
          </div>

          {/* Trend + legal */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              icon={<TrendingUp size={14} />}
              title="منحنى المبيعات عبر الزمن"
              description="قيمة البيع حسب تاريخ البيع، من الأقدم للأحدث. ليست المبالغ الواصلة"
              className="lg:col-span-2"
              bodyClassName="flex flex-col gap-4 p-5"
            >
              <SectionBrief text={briefs.trend} />
              {salesTrendData.length > 0 ? (
                <div className="flex flex-col gap-6">
                  {(
                    [
                      { key: "عدد الوحدات المباعة", label: "عدد الوحدات", color: palette.fg, format: (value: number) => formatNumber(value) },
                      ...(showIQD ? [{ key: "قيمة البيع (د.ع)", label: "دينار", color: STATUS_META.available.chart, format: (value: number) => `${formatNumber(value)} د.ع` }] : []),
                      ...(showUSD ? [{ key: "قيمة البيع ($)", label: "دولار", color: STATUS_META.pending.chart, format: (value: number) => `$${formatNumber(value)}` }] : []),
                    ] as { key: string; label: string; color: string; format: (value: number) => string }[]
                  ).map((series) => (
                    <div key={series.key}>
                      <div className="eyebrow mb-2">{series.label}</div>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={salesTrendData} margin={chartMargin}>
                            <CartesianGrid {...chartGrid} />
                            <XAxis dataKey="name" {...chartAxis} />
                            <YAxis tickFormatter={formatAxisValue} width={series.key === "عدد الوحدات المباعة" ? 40 : 64} {...chartAxis} />
                            <Tooltip
                              cursor={{ stroke: palette.lineStrong, strokeWidth: 1 }}
                              content={<ChartTooltip format={(value) => series.format(value)} />}
                            />
                            <Line
                              type="monotone"
                              dataKey={series.key}
                              stroke={series.color}
                              strokeWidth={1.5}
                              dot={false}
                              activeDot={{ r: 3, strokeWidth: 0 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <ChartEmpty>
                  لا توجد بيانات مبيعات زمنية كافية — تأكد من إدخال تواريخ البيع للوحدات
                </ChartEmpty>
              )}
            </Panel>

            <Panel
              icon={<ShieldCheck size={14} />}
              title="الموقف القانوني والاستلام"
              description="متابعة معاملات الطابو وتسليم المفاتيح"
              className="lg:col-span-1"
              bodyClassName="space-y-7 p-5"
            >
              <SectionBrief text={briefs.legal} />
              <div className="space-y-4">
                <div className="eyebrow">موقف معاملات الطابو</div>
                <Meter label="مستلم الطابو" value={stats.receivedTabo} total={stats.sold + stats.investment} color={STATUS_META.available.chart} />
                <Meter label="قيد الترويج" value={stats.promotedTabo} total={stats.sold + stats.investment} color={STATUS_META.reserved.chart} />
                <Meter label="غير مروج" value={stats.notPromotedTabo} total={stats.sold + stats.investment} color={palette.lineStrong} />
              </div>

              <div className="space-y-4 border-t border-line pt-6">
                <div className="eyebrow">موقف تسليم الوحدات</div>
                <Meter label="تم تسليم المفتاح" value={stats.receivedUnit} total={stats.sold + stats.investment} color={STATUS_META.pending.chart} />
                <Meter label="غير مستلم بعد" value={stats.notReceivedUnit} total={stats.sold + stats.investment} color={STATUS_META.sold.chart} />
              </div>
            </Panel>
          </div>

          <Panel
            className="mt-6"
            icon={<ShieldCheck size={14} />}
            title="الطابو والتسليم مع المتبقي"
            description="وحدات ما زال عليها مبلغ من ملف الدفعات، وقد استلمت الطابو أو المفاتيح. الوحدة المسددة لا تظهر."
            actions={
              <Button variant="outline" className="h-8 text-[12px]" onClick={() => setObligationOpen((open) => !open)}>
                {obligationOpen ? "إخفاء الوحدات" : "إظهار الوحدات"}
              </Button>
            }
            bodyClassName="space-y-6 p-5"
          >
            <SectionBrief text={briefs.obligation} />
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-3">
                <div className="eyebrow">استلم الطابو وعليه متبقي</div>
                {showIQD && <ObligationLine label="دينار" count={obligations.taboCountIQD} amount={obligations.taboIQD} />}
                {showUSD && <ObligationLine label="دولار" count={obligations.taboCountUSD} amount={obligations.taboUSD} prefix="$" />}
              </div>
              <div className="space-y-3">
                <div className="eyebrow">استلم المفاتيح وعليه متبقي</div>
                {showIQD && <ObligationLine label="دينار" count={obligations.handoverCountIQD} amount={obligations.handoverIQD} />}
                {showUSD && <ObligationLine label="دولار" count={obligations.handoverCountUSD} amount={obligations.handoverUSD} prefix="$" />}
              </div>
            </div>
            {obligationOpen && (
              <div className="space-y-8 border-t border-line pt-5">
                <ObligationTables title="استلم الطابو وعليه متبقي" rows={obligations.tabo} showIQD={showIQD} showUSD={showUSD} />
                <ObligationTables title="استلم المفاتيح وعليه متبقي" rows={obligations.handover} showIQD={showIQD} showUSD={showUSD} />
              </div>
            )}
          </Panel>

          {/* Average prices */}
          <Panel
            className="mt-6"
            icon={<Tags size={14} />}
            title="تحليل متوسط أسعار الوحدات السكنية"
            description="متوسط سعر البيع المسجل على الوحدة المباعة أو المستثمرة، لا المتبقي"
            bodyClassName="space-y-4 p-5"
            actions={
              <div className="flex items-center gap-5 border border-line px-4 py-2">
                <div className="text-end">
                  <div className="eyebrow">قيمة العقود د.ع</div>
                  <div className="mt-0.5 font-mono text-[13px] tabular-nums text-fg">
                    {showIQD ? formatNumber(money.contractIQD) : "—"}
                  </div>
                </div>
                <span className="h-7 w-px bg-line" />
                <div className="text-end">
                  <div className="eyebrow">قيمة العقود $</div>
                  <div className="mt-0.5 font-mono text-[13px] tabular-nums text-fg">
                    {showUSD ? formatNumber(money.contractUSD) : "—"}
                  </div>
                </div>
              </div>
            }
          >
            <SectionBrief text={briefs.prices} />
            <Tabs defaultValue="houses_prices" className="w-full">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <TabsList>
                  <TabsTrigger value="houses_prices">أصناف المنازل</TabsTrigger>
                  <TabsTrigger value="apartments_prices">مساحات الشقق</TabsTrigger>
                </TabsList>
                {priceLegend}
              </div>

              <TabsContent value="houses_prices" className="mt-5 h-80">
                {averagePriceDataHouses.length > 0
                  ? renderPriceChart(averagePriceDataHouses)
                  : <ChartEmpty>لا توجد مبيعات منازل مسجلة بأسعار صالحة</ChartEmpty>}
              </TabsContent>

              <TabsContent value="apartments_prices" className="mt-5 h-80">
                {averagePriceDataApartments.length > 0
                  ? renderPriceChart(averagePriceDataApartments)
                  : <ChartEmpty>لا توجد مبيعات شقق مسجلة بأسعار صالحة</ChartEmpty>}
              </TabsContent>
            </Tabs>
          </Panel>
        </>
      )}
    </AppShell>
  );
};

const ChoiceChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    className={
      active
        ? "border border-fg bg-fg px-2.5 py-1 text-[12px] text-background"
        : "border border-line px-2.5 py-1 text-[12px] text-fg-secondary"
    }
  >
    {children}
  </button>
);

const ChipRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-2">
    <div className="text-[11px] text-fg-muted">{label}</div>
    <div className="flex max-h-24 flex-wrap gap-2 overflow-auto">{children}</div>
  </div>
);

const FilterSelect = ({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) => (
  <label className="space-y-1">
    <span className="text-[11px] text-fg-muted">{label}</span>
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-[12px]"><SelectValue /></SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  </label>
);

const SectionBrief = ({ text, inset = false }: { text: string; inset?: boolean }) => {
  if (!text) return null;
  return (
    <p className={inset
      ? "border-b border-line px-5 py-3 text-[13px] leading-7 text-fg"
      : "text-[13px] leading-7 text-fg"}
    >
      {text}
    </p>
  );
};

const RateCell = ({
  received,
  remaining,
  strong = false,
}: {
  received: number;
  remaining: number;
  strong?: boolean;
}) => {
  const rate = collectionRate(received, remaining);
  const text = rate == null
    ? "—"
    : `${Number.isInteger(Math.round(rate * 10) / 10) ? (Math.round(rate * 10) / 10).toFixed(0) : (Math.round(rate * 10) / 10).toFixed(1)}%`;
  return (
    <td className={`px-4 py-3 font-mono tabular-nums text-fg ${strong ? "font-semibold" : ""}`}>{text}</td>
  );
};

const OverdueTable = ({
  title,
  rows,
  prefix,
}: {
  title: string;
  rows: { key: string; label: string; customerName: string; phone: string; amount: number; ageLabel: string }[];
  prefix: string;
}) => (
  <div className="space-y-2">
    <div className="eyebrow">{title}</div>
    {rows.length === 0 ? (
      <div className="text-[12px] text-fg-muted">لا توجد دفعات متأخرة ضمن هذه التصفية</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="text-fg-muted">
            <tr className="border-b border-line">
              {["الزبون", "الوحدة", "الهاتف", "المتأخر", "أقدم دفعة"].map((heading) => (
                <th key={heading} className="px-3 py-2 text-start font-normal">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line last:border-0">
                <td className="px-3 py-2 text-fg">{row.customerName || "—"}</td>
                <td className="px-3 py-2 font-mono text-fg">{row.label || "—"}</td>
                <td className="px-3 py-2 font-mono text-fg">{row.phone || "—"}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-[#8d1c16]">{prefix}{formatNumber(row.amount)}</td>
                <td className="px-3 py-2 text-fg">{row.ageLabel || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const ObligationTables = ({
  title,
  rows,
  showIQD,
  showUSD,
}: {
  title: string;
  rows: { key: string; label: string; customerName: string; phone: string; amount: number; currency: "IQD" | "USD" }[];
  showIQD: boolean;
  showUSD: boolean;
}) => (
  <div className="space-y-4">
    <div className="text-[14px] font-semibold text-fg">{title}</div>
    {showIQD && <ObligationCurrencyTable title="دينار" rows={rows.filter((row) => row.currency === "IQD")} prefix="" />}
    {showUSD && <ObligationCurrencyTable title="دولار" rows={rows.filter((row) => row.currency === "USD")} prefix="$" />}
  </div>
);

const ObligationCurrencyTable = ({
  title,
  rows,
  prefix,
}: {
  title: string;
  rows: { key: string; label: string; customerName: string; phone: string; amount: number }[];
  prefix: string;
}) => (
  <div className="space-y-2">
    <div className="eyebrow">{title}</div>
    {rows.length === 0 ? (
      <div className="text-[12px] text-fg-muted">لا توجد وحدات ضمن هذه التصفية</div>
    ) : (
      <div className="max-h-80 overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 bg-surface text-fg-muted">
            <tr className="border-b border-line">
              {["الزبون", "الوحدة", "الهاتف", "المتبقي"].map((heading) => (
                <th key={heading} className="px-3 py-2 text-start font-normal">{heading}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-line last:border-0">
                <td className="px-3 py-2 text-fg">{row.customerName || "—"}</td>
                <td className="px-3 py-2 font-mono text-fg">{row.label || "—"}</td>
                <td className="px-3 py-2 font-mono text-fg">{row.phone || "—"}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-[#8d1c16]">{prefix}{formatNumber(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const ObligationLine = ({
  label,
  count,
  amount,
  prefix = "",
}: {
  label: string;
  count: number;
  amount: number;
  prefix?: string;
}) => (
  <div className="flex items-baseline justify-between gap-3 border border-line px-4 py-3">
    <div>
      <div className="text-[12px] text-fg-secondary">{label}</div>
      <div className="mt-1 text-[11px] text-fg-muted">{formatNumber(count)} وحدة</div>
    </div>
    <div className="font-mono text-[16px] tabular-nums text-[#8d1c16]">{prefix}{formatNumber(amount)}</div>
  </div>
);

const MoneyCell = ({
  value,
  prefix = "",
  tone = "plain",
  strong = false,
}: {
  value: number;
  prefix?: string;
  tone?: "plain" | "in" | "out";
  strong?: boolean;
}) => (
  <td
    className={
      tone === "in"
        ? `px-4 py-3 font-mono tabular-nums text-[#0c5a30] ${strong ? "font-semibold" : ""}`
        : tone === "out"
          ? `px-4 py-3 font-mono tabular-nums text-[#8d1c16] ${strong ? "font-semibold" : ""}`
          : `px-4 py-3 font-mono tabular-nums text-fg ${strong ? "font-semibold" : ""}`
    }
  >
    {prefix}{formatNumber(value)}
  </td>
);

export default Reports;
