"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    ArrowRight, TrendingUp, Building2, ShieldCheck, PieChart as PieIcon,
    Filter, Tags, AlertTriangle, RefreshCcw, Wallet, CalendarRange,
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
  collectionRows,
  currencyOn,
  inDayRange,
  matchSettlement,
  matchStructure,
  summarizeDues,
  summarizeMoney,
  type ReportFilters,
  type ReportUnit,
} from "@/lib/report-collection";
import { palette } from "@/lib/theme";
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
  }, [selectedProjectId]);

  const structural = useMemo(
    () => reportUnits.filter((unit) => matchStructure(unit, filters)),
    [reportUnits, filters],
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

  const salesPerformanceData = useMemo(() => {
    const groups = new Map<string, {
      total: number;
      sold: number;
      investment: number;
      contractIQD: number;
      contractUSD: number;
      remainingIQD: number;
      remainingUSD: number;
    }>();
    const bucket = (name: string) => {
      const current = groups.get(name) || {
        total: 0, sold: 0, investment: 0,
        contractIQD: 0, contractUSD: 0, remainingIQD: 0, remainingUSD: 0,
      };
      groups.set(name, current);
      return current;
    };
    const groupName = (unit: ReportUnit): string | null => {
      if (selectedProjectId === "all") return unit.projectName || "مشروع";
      if (salesViewMode === "houses") return unit.kind === "house" ? `زون ${unit.zone || "عام"}` : null;
      return unit.kind === "apartment" ? (unit.towerLabel || "عمارة") : null;
    };

    structural.forEach((unit) => {
      if (unit.frozenUncounted) return;
      const name = groupName(unit);
      if (!name) return;
      if (moneyMeasure === "count") {
        const row = bucket(name);
        row.total += 1;
        if (unit.status === "sold") row.sold += 1;
        if (unit.status === "investment") row.investment += 1;
        return;
      }
      if (unit.status !== "sold" && unit.status !== "investment") return;
      if (!inDayRange(unit.saleDate, filters.saleFrom, filters.saleTo)) return;
      if (moneyMeasure === "contract") {
        if (!currencyOn(filters.currency, unit.systemCurrency) || unit.systemPrice <= 0) return;
        const row = bucket(name);
        if (unit.systemCurrency === "IQD") row.contractIQD += unit.systemPrice;
        else row.contractUSD += unit.systemPrice;
        return;
      }
      if (!matchSettlement(unit, filters) || !currencyOn(filters.currency, unit.fileCurrency)) return;
      const row = bucket(name);
      if (unit.fileCurrency === "IQD") row.remainingIQD += unit.remaining;
      else row.remainingUSD += unit.remaining;
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "ar", { numeric: true }))
      .map(([name, row]) => {
        if (moneyMeasure === "contract") {
          return { name, "قيمة العقود (د.ع)": row.contractIQD, "قيمة العقود ($)": row.contractUSD };
        }
        if (moneyMeasure === "remaining") {
          return { name, "المتبقي (د.ع)": row.remainingIQD, "المتبقي ($)": row.remainingUSD };
        }
        return {
          name,
          "إجمالي الوحدات": row.total,
          "المباعة": row.sold,
          "الاستثمار": row.investment,
        };
      });
  }, [structural, selectedProjectId, salesViewMode, moneyMeasure, filters]);

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
      .map(([, row]) => ({
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

  const salesRatio = stats.total > 0
    ? Math.round(((stats.sold + stats.investment) / stats.total) * 100)
    : 0;

  const showIQD = filters.currency !== "USD";
  const showUSD = filters.currency !== "IQD";
  const collectionHint = (count: number) => {
    if (followupMissing) return "جدول الدفعات غير منشأ، والتحصيل غير محسوب";
    const settlement = filters.settlement === "paid"
      ? "سددوا كامل المبلغ"
      : filters.settlement === "remaining"
        ? "متبقي عليهم"
        : "";
    const gap = count > 0 ? `بلا ملف دفعات: ${formatNumber(count)} وحدة` : "من ملف الدفعات";
    return settlement ? `${gap} · ${settlement}` : gap;
  };

  const statCells: StatCell[] = [
    {
      label: "قيمة العقود (د.ع)",
      value: showIQD ? formatNumber(money.contractIQD) : "—",
      hint: showIQD ? `محجوز متوقع ${formatNumber(money.expectedIQD)} د.ع` : "خارج تصفية العملة",
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
      label: "نسبة المبيعات العامة",
      value: `${salesRatio}%`,
      hint: `مباع ${stats.sold} · استثمار ${stats.investment}`,
    },
    {
      label: "قيمة العقود ($)",
      value: showUSD ? `$${formatNumber(money.contractUSD)}` : "—",
      hint: showUSD ? `محجوز متوقع $${formatNumber(money.expectedUSD)}` : "خارج تصفية العملة",
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
      label: "الوحدات المتاحة للبيع",
      value: formatNumber(stats.available),
      hint: `من أصل ${formatNumber(stats.total)} وحدة`,
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
            العودة للرئيسية
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      brandSubtitle="التقارير والتحليلات"
      nav={
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-1.5 text-fg-secondary">
            <ArrowRight size={14} />
            الرئيسية
          </Button>
        </Link>
      }
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
      {/* Filter bar — يظهر فقط بعد اختيار مشروع */}
      {hasSelectedProject && (
      <div className="mt-8 space-y-4 border-y border-line py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-fg-muted">
            <Filter size={13} />
            <span className="eyebrow">تصفية</span>
          </div>
          <span className="text-[11px] text-fg-faint">الزون للمنزل، والعمارة للشقة، والنوع يجمع الاثنين معاً</span>
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
              className="ms-auto text-status-sold hover:text-status-sold"
            >
              إعادة تعيين
            </Button>
          )}
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
          <div className="mt-10">
            <StatGrid items={statCells} columns={4} />
          </div>

          <Panel
            className="mt-6"
            icon={<Wallet size={14} />}
            title="موقف التحصيل"
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
            {collection.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13px]">
                  <thead className="bg-surface text-fg-muted">
                    <tr className="border-b border-line">
                      {["النطاق", ...(showIQD ? ["عقد د.ع", "واصل د.ع", "متبقي د.ع"] : []), ...(showUSD ? ["عقد $", "واصل $", "متبقي $"] : []), "سددوا", "عليهم"].map((heading) => (
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
                        {showUSD && <MoneyCell value={row.fileUSD} prefix="$" />}
                        {showUSD && <MoneyCell value={row.receivedUSD} prefix="$" tone="in" />}
                        {showUSD && <MoneyCell value={row.remainingUSD} prefix="$" tone="out" />}
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
                      {showUSD && <MoneyCell value={collectionTotal.fileUSD} prefix="$" strong />}
                      {showUSD && <MoneyCell value={collectionTotal.receivedUSD} prefix="$" tone="in" strong />}
                      {showUSD && <MoneyCell value={collectionTotal.remainingUSD} prefix="$" tone="out" strong />}
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
                    : "لا يوجد تحصيل محسوب ضمن هذه التصفية. المشروع بلا ملف دفعات لا يُعامل كسداد كامل"}
                </ChartEmpty>
              </div>
            )}
          </Panel>

          <div className="mt-6">
            <Panel
              icon={<CalendarRange size={14} />}
              title="الاستحقاقات"
              description="المتبقي على الدفعات المفتوحة فقط، حسب موعد الاستحقاق. هذا الفلتر لا يغيّر بقية التقارير."
              bodyClassName="space-y-5 p-5"
            >
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
                  {showIQD && (
                    <div className="space-y-3">
                      <div className="eyebrow">دينار</div>
                      <Meter label="متأخر" value={dues.overdueIQD} total={dues.overdueIQD + dues.todayIQD + dues.upcomingIQD} color={STATUS_META.sold.chart} />
                      <Meter label="مستحق اليوم" value={dues.todayIQD} total={dues.overdueIQD + dues.todayIQD + dues.upcomingIQD} color={STATUS_META.reserved.chart} />
                      <Meter label="قادم" value={dues.upcomingIQD} total={dues.overdueIQD + dues.todayIQD + dues.upcomingIQD} color={STATUS_META.available.chart} />
                    </div>
                  )}
                  {showUSD && (
                    <div className="space-y-3">
                      <div className="eyebrow">دولار</div>
                      <Meter label="متأخر" value={dues.overdueUSD} total={dues.overdueUSD + dues.todayUSD + dues.upcomingUSD} color={STATUS_META.sold.chart} />
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
              title="توزيع حالات الوحدات"
              description="نسبة كل حالة من إجمالي الوحدات المحتسبة"
              className="lg:col-span-1"
              bodyClassName="flex flex-col gap-4 p-5"
            >
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
                    <span className="w-10 text-end font-mono tabular-nums text-fg-faint">
                      {stats.total > 0 ? `${Math.round((entry.value / stats.total) * 100)}%` : '—'}
                    </span>
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
              <div className={moneyMeasure !== "count" && showIQD && showUSD ? "grid gap-4 overflow-x-auto lg:grid-cols-2" : "overflow-x-auto"}>
                {salesPerformanceData.length > 0 ? (
                  (moneyMeasure === "count"
                    ? [{ key: "count", label: "" }]
                    : [
                        ...(showIQD ? [{ key: moneyMeasure === "contract" ? "قيمة العقود (د.ع)" : "المتبقي (د.ع)", label: "دينار" }] : []),
                        ...(showUSD ? [{ key: moneyMeasure === "contract" ? "قيمة العقود ($)" : "المتبقي ($)", label: "دولار" }] : []),
                      ]
                  ).map((series) => {
                    const plotWidth = Math.max(640, salesPerformanceData.length * (series.key === "count" ? 56 : 40));
                    const plotHeight = series.label ? 220 : 256;
                    return (
                    <div key={series.key} style={{ width: plotWidth, height: plotHeight + (series.label ? 28 : 0) }}>
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
                          {series.key === "count" && <Bar dataKey="إجمالي الوحدات" fill={palette.lineStrong} maxBarSize={22} />}
                          {series.key === "count" && <Bar dataKey="المباعة" fill={STATUS_META.sold.chart} maxBarSize={22} />}
                          {series.key === "count" && <Bar dataKey="الاستثمار" fill={STATUS_META.investment.chart} maxBarSize={22} />}
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
                    ? [
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
              <div className="h-64">
                {salesTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesTrendData} margin={chartMargin}>
                      <CartesianGrid {...chartGrid} />
                      <XAxis dataKey="name" {...chartAxis} />
                      <YAxis tickFormatter={formatAxisValue} width={64} {...chartAxis} />
                      <Tooltip
                        cursor={{ stroke: palette.lineStrong, strokeWidth: 1 }}
                        content={
                          <ChartTooltip
                            format={(value, name) => {
                              if (name.includes('د.ع')) return `${formatNumber(value)} د.ع`;
                              if (name.includes('$')) return `$${formatNumber(value)}`;
                              return formatNumber(value);
                            }}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="عدد الوحدات المباعة"
                        stroke={palette.fg}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                      {showIQD && (
                        <Line
                          type="monotone"
                          dataKey="قيمة البيع (د.ع)"
                          stroke={STATUS_META.available.chart}
                          strokeWidth={1.5}
                          dot={false}
                          activeDot={{ r: 3, strokeWidth: 0 }}
                        />
                      )}
                      {showUSD && (
                        <Line
                          type="monotone"
                          dataKey="قيمة البيع ($)"
                          stroke={STATUS_META.pending.chart}
                          strokeWidth={1.5}
                          dot={false}
                          activeDot={{ r: 3, strokeWidth: 0 }}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty>
                    لا توجد بيانات مبيعات زمنية كافية — تأكد من إدخال تواريخ البيع للوحدات
                  </ChartEmpty>
                )}
              </div>
              <ChartLegend
                className="border-t border-line pt-4"
                items={[
                  { name: 'عدد الوحدات المباعة', color: palette.fg },
                  ...(showIQD ? [{ name: 'قيمة البيع (د.ع)', color: STATUS_META.available.chart }] : []),
                  ...(showUSD ? [{ name: 'قيمة البيع ($)', color: STATUS_META.pending.chart }] : []),
                ]}
              />
            </Panel>

            <Panel
              icon={<ShieldCheck size={14} />}
              title="الموقف القانوني والاستلام"
              description="متابعة معاملات الطابو وتسليم المفاتيح"
              className="lg:col-span-1"
              bodyClassName="space-y-7 p-5"
            >
              <div className="space-y-4">
                <div className="eyebrow">موقف معاملات الطابو</div>
                <Meter label="مستلم الطابو" value={stats.receivedTabo} total={stats.total} color={STATUS_META.available.chart} />
                <Meter label="قيد الترويج" value={stats.promotedTabo} total={stats.total} color={STATUS_META.reserved.chart} />
                <Meter label="غير مروج" value={stats.notPromotedTabo} total={stats.total} color={palette.lineStrong} />
              </div>

              <div className="space-y-4 border-t border-line pt-6">
                <div className="eyebrow">موقف تسليم الوحدات</div>
                <Meter label="تم تسليم المفتاح" value={stats.receivedUnit} total={stats.total} color={STATUS_META.pending.chart} />
                <Meter label="غير مستلم بعد" value={stats.notReceivedUnit} total={stats.total} color={STATUS_META.sold.chart} />
              </div>
            </Panel>
          </div>

          {/* Average prices */}
          <Panel
            className="mt-6"
            icon={<Tags size={14} />}
            title="تحليل متوسط أسعار الوحدات السكنية"
            description="متوسط سعر البيع المسجل على الوحدة المباعة أو المستثمرة، لا المتبقي"
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
            bodyClassName="p-5"
          >
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
