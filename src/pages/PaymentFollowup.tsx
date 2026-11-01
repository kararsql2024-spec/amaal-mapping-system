"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Search } from "lucide-react";
import type { Project } from "@/types/project";
import { supabase } from "@/integrations/supabase/client";
import { validateCenterSession } from "@/lib/center-auth";
import { canAccessPaymentFollowup } from "@/lib/dept-permissions";
import { formatMoney, formatNumber } from "@/lib/format";
import { fetchRemoteSettings, loadSettings, resolveSettingsSources } from "@/incentives/storage";
import type { IncentiveSettings } from "@/incentives/types";
import { AppShell, EmptyState, Eyebrow, LoadingBlock, Panel } from "@/components/layout/AppShell";
import { SectionNav } from "@/components/layout/SectionNav";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showError } from "@/utils/toast";
import { cn } from "@/lib/utils";
import {
  filterFollowupUnits,
  FOLLOWUP_EXCEPTIONS_KEY,
  groupFollowupUnits,
  normalizeFollowupExceptions,
  normalizePersonName,
  sortFollowupUnits,
  type FollowupSort,
  type CatalogEntry,
  type FollowupExceptionGroup,
  type FollowupFilters,
  type FollowupRecord,
  type FollowupUnit,
} from "@/lib/payment-followup";
import {
  addFollowupNote,
  fetchFollowupNotes,
  fetchFollowupRows,
  isMissingFollowupTable,
  loadFollowupCatalog,
  type FollowupNote,
} from "@/lib/payment-followup-import";

const EXPORT_FIELDS = [
  { id: "project", label: "المشروع", sheets: "both" },
  { id: "unit", label: "رقم الوحدة", sheets: "both" },
  { id: "name", label: "اسم الزبون", sheets: "both" },
  { id: "phone", label: "الهاتف", sheets: "both" },
  { id: "type", label: "النوع", sheets: "both" },
  { id: "center", label: "المركز التسويقي", sheets: "both" },
  { id: "currency", label: "العملة", sheets: "both" },
  { id: "price", label: "سعر الوحدة", sheets: "both" },
  { id: "saleDate", label: "تاريخ البيع", sheets: "both" },
  { id: "received", label: "الواصل الكلي", sheets: "both" },
  { id: "remaining", label: "مجموع المتبقي", sheets: "both" },
  { id: "overdue", label: "مجموع المتلكئ", sheets: "both" },
  { id: "status", label: "الحالة", sheets: "both" },
  { id: "due", label: "تاريخ الدفعة", sheets: "lines" },
  { id: "amount", label: "مبلغ الدفعة", sheets: "lines" },
  { id: "lineReceived", label: "الواصل من الدفعة", sheets: "lines" },
  { id: "lineRemaining", label: "المتبقي من الدفعة", sheets: "lines" },
  { id: "duration", label: "المدة", sheets: "lines" },
  { id: "warning", label: "تنبيه", sheets: "lines" },
  { id: "count", label: "عدد الدفعات الظاهرة", sheets: "units" },
  { id: "notes", label: "ملاحظات", sheets: "both" },
] as const;

type ExportFieldId = (typeof EXPORT_FIELDS)[number]["id"];

const EXPORT_FIELD_KEY = "amaal-followup-export-fields-v1";

const loadExportFields = (): ExportFieldId[] => {
  const all = EXPORT_FIELDS.map((field) => field.id);
  const defaults = all.filter((id) => id !== "notes");
  try {
    const raw = JSON.parse(localStorage.getItem(EXPORT_FIELD_KEY) || "null");
    if (!Array.isArray(raw)) return defaults;
    const known = new Set(all);
    const picked = raw.filter((id): id is ExportFieldId => known.has(id));
    if (picked.length === defaults.length - 1 && !picked.includes("overdue") && !picked.includes("notes")) return defaults;
    return picked;
  } catch {
    return defaults;
  }
};

const noteKey = (projectId: string, unitKey: string) => `${projectId}::${unitKey}`;

const PaymentFollowup = ({ projects }: { projects: Project[] }) => {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [permitted, setPermitted] = useState(false);
  const [allowedProjectIds, setAllowedProjectIds] = useState<string[] | null>(null);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);
  const [packs, setPacks] = useState<{ projectId: string; projectName: string; rows: FollowupRecord[]; catalog: Map<string, CatalogEntry> }[]>([]);
  const [settings, setSettings] = useState<IncentiveSettings | null>(null);
  const [marketingCenters, setMarketingCenters] = useState<{ id: string; name: string }[]>([]);
  const [authorCenter, setAuthorCenter] = useState("");
  const [notesByUnit, setNotesByUnit] = useState<Record<string, FollowupNote[]>>({});
  const [filters, setFilters] = useState<FollowupFilters>({
    search: "",
    receivedFrom: "",
    receivedTo: "",
    dueFrom: "",
    dueTo: "",
    saleFrom: "",
    saleTo: "",
    currency: "all",
    dueState: "all",
    settlement: "all",
    investors: "with",
    center: "all",
    types: [],
    excludedNames: [],
    includedNames: null,
  });
  const [exceptionGroups, setExceptionGroups] = useState<FollowupExceptionGroup[]>([]);
  const [excludedGroupIds, setExcludedGroupIds] = useState<string[]>([]);
  const [exceptionOnly, setExceptionOnly] = useState(false);
  const [onlyGroupIds, setOnlyGroupIds] = useState<string[]>([]);
  const [sortMode, setSortMode] = useState<FollowupSort>("overdue");
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFields, setExportFields] = useState<ExportFieldId[]>(() => loadExportFields());

  const visibleProjects = useMemo(() => {
    if (!allowedProjectIds || allowedProjectIds.length === 0) return projects;
    return projects.filter((project) => allowedProjectIds.includes(project.id));
  }, [allowedProjectIds, projects]);

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      const { session } = await validateCenterSession(supabase);
      if (cancelled) return;
      if (!session) {
        setAllowed(false);
        return;
      }
      setAllowed(true);
      setAllowedProjectIds(session.allowed_projects || []);
      setAuthorCenter(session.name || "قسم غير معروف");
      const [{ data }, remote, centerRows, exceptionRow] = await Promise.all([
        supabase.from("settings").select("key, value").eq("key", "dept_permissions").maybeSingle(),
        fetchRemoteSettings(supabase).catch(() => null),
        supabase.from("marketing_centers").select("id, name"),
        supabase.from("settings").select("value").eq("key", FOLLOWUP_EXCEPTIONS_KEY).maybeSingle(),
      ]);
      const perms = data?.value?.[session.type];
      setPermitted(canAccessPaymentFollowup(perms));
      if (!cancelled) {
        setExceptionGroups(normalizeFollowupExceptions(exceptionRow.data?.value));
        setSettings(resolveSettingsSources(loadSettings(), remote).settings);
        setMarketingCenters(
          (centerRows.data || []).map((center) => ({
            id: String(center.id),
            name: String(center.name || "").trim(),
          })),
        );
      }
    };
    boot();
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedKey = [...projectIds].sort().join("|");

  useEffect(() => {
    const ids = selectedKey ? selectedKey.split("|") : [];
    if (ids.length === 0) {
      setPacks([]);
      setNotesByUnit({});
      setTableMissing(false);
      return;
    }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const loaded = await Promise.all(ids.map(async (id) => {
          const projectName = projects.find((project) => project.id === id)?.name || "";
          const [catalog, rows, noteRows] = await Promise.all([
            loadFollowupCatalog(id),
            fetchFollowupRows(id),
            fetchFollowupNotes(id).catch(() => [] as FollowupNote[]),
          ]);
          return { id, projectName, catalog, rows, noteRows };
        }));
        if (cancelled) return;
        setPacks(loaded.map((pack) => ({
          projectId: pack.id,
          projectName: pack.projectName,
          rows: pack.rows,
          catalog: pack.catalog,
        })));
        const grouped: Record<string, FollowupNote[]> = {};
        loaded.forEach((pack) => {
          pack.noteRows.forEach((note) => {
            const key = noteKey(pack.id, note.unit_key);
            const list = grouped[key] || [];
            list.push(note);
            grouped[key] = list;
          });
        });
        setNotesByUnit(grouped);
        setTableMissing(false);
      } catch (error) {
        if (!cancelled) {
          setPacks([]);
          if (isMissingFollowupTable(error)) setTableMissing(true);
          else showError("تعذر تحميل دفعات المشروع");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedKey, projects]);

  const units = useMemo(
    () => packs.flatMap((pack) => groupFollowupUnits(pack.rows, pack.catalog, pack.projectId, pack.projectName, settings, marketingCenters)),
    [packs, settings, marketingCenters],
  );
  const namesInGroups = (ids: string[]) => {
    const names: string[] = [];
    exceptionGroups.forEach((group) => {
      if (!ids.includes(group.id)) return;
      group.names.forEach((name) => {
        const key = normalizePersonName(name);
        if (key) names.push(name);
      });
    });
    return names;
  };
  const excludedNames = useMemo(
    () => (exceptionOnly ? [] : namesInGroups(excludedGroupIds)),
    [exceptionOnly, excludedGroupIds, exceptionGroups],
  );
  const includedNames = useMemo(
    () => (exceptionOnly ? namesInGroups(onlyGroupIds) : null),
    [exceptionOnly, onlyGroupIds, exceptionGroups],
  );
  const filtered = useMemo(
    () => sortFollowupUnits(filterFollowupUnits(units, { ...filters, excludedNames, includedNames }), sortMode),
    [units, filters, excludedNames, includedNames, sortMode],
  );
  const typeOptions = useMemo(() => {
    const map = new Map<string, string>();
    units.forEach((unit) => {
      if (unit.typeKey) map.set(unit.typeKey, unit.typeLabel);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1], "ar"));
  }, [units]);
  const centerOptions = useMemo(
    () => Array.from(new Set(units.map((unit) => unit.centerName))).sort((a, b) => a.localeCompare(b, "ar")),
    [units],
  );
  const summary = useMemo(() => {
    let iqd = 0;
    let usd = 0;
    let overdueIqd = 0;
    let overdueUsd = 0;
    let installmentCount = 0;
    filtered.forEach((unit) => {
      if (unit.currency === "USD") overdueUsd += unit.overdue;
      else overdueIqd += unit.overdue;
      unit.installments.forEach((item) => {
        installmentCount += 1;
        if (unit.currency === "USD") usd += item.remaining;
        else iqd += item.remaining;
      });
    });
    return { units: filtered.length, installmentCount, iqd, usd, overdueIqd, overdueUsd };
  }, [filtered]);

  const addNote = async (projectId: string, unitKey: string, body: string) => {
    const text = body.trim();
    if (!projectId || !text) return;
    try {
      const note = await addFollowupNote(projectId, unitKey, text, authorCenter || "قسم غير معروف");
      const key = noteKey(projectId, unitKey);
      setNotesByUnit((current) => ({
        ...current,
        [key]: [note, ...(current[key] || [])],
      }));
    } catch (error) {
      if (isMissingFollowupTable(error)) {
        showError("جدول الملاحظات غير موجود. نفّذ ملف database_payment_followup.sql في Supabase");
      } else {
        showError("تعذر حفظ الملاحظة");
      }
      throw error;
    }
  };

  const fieldOn = (id: ExportFieldId) => exportFields.includes(id);
  const keepFields = (row: Record<string, string | number>, sheet: "lines" | "units") => {
    const next: Record<string, string | number> = {};
    EXPORT_FIELDS.forEach((field) => {
      if (!fieldOn(field.id) || !(field.sheets === "both" || field.sheets === sheet)) return;
      if (field.label in row) next[field.label] = row[field.label];
    });
    return next;
  };
  const exportExcel = async () => {
    if (exportFields.length === 0) return;
    localStorage.setItem(EXPORT_FIELD_KEY, JSON.stringify(exportFields));
    const XLSX = await import("xlsx");
    const base = (unit: FollowupUnit): Record<string, string | number> => ({
      "المشروع": unit.projectName,
      "رقم الوحدة": unit.unitLabel,
      "اسم الزبون": unit.customerName,
      "الهاتف": unit.phone,
      "النوع": unit.typeLabel,
      "المركز التسويقي": unit.centerName,
      "العملة": unit.currency === "USD" ? "دولار" : "دينار",
      "سعر الوحدة": unit.salePrice,
      "تاريخ البيع": unit.saleDate,
      "الواصل الكلي": unit.totalReceived,
      "مجموع المتبقي": unit.remaining,
      "مجموع المتلكئ": unit.overdue,
      "الحالة": unit.paidInFull ? "سدد كامل المبلغ" : "متبقي",
      "ملاحظات": "",
    });
    const installmentRows = filtered.flatMap((unit) => {
      const head = base(unit);
      const line = (extra: Record<string, string | number>) => keepFields({ ...head, ...extra }, "lines");
      if (unit.paidInFull) {
        return [line({
          "تاريخ الدفعة": "",
          "مبلغ الدفعة": "",
          "الواصل من الدفعة": "",
          "المتبقي من الدفعة": "",
          "المدة": "",
          "تنبيه": "",
        })];
      }
      return unit.installments.map((item) => line({
        "تاريخ الدفعة": item.dueDate,
        "مبلغ الدفعة": item.amount,
        "الواصل من الدفعة": item.received,
        "المتبقي من الدفعة": item.remaining,
        "المدة": item.whenLabel,
        "تنبيه": unit.warnings.join(" · "),
      }));
    });
    const unitRows = filtered.map((unit) => keepFields({
      ...base(unit),
      "عدد الدفعات الظاهرة": unit.installments.length,
    }, "units"));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(installmentRows), "الدفعات");
    XLSX.utils.book_append_sheet(book, XLSX.utils.json_to_sheet(unitRows), "الوحدات");
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = projectIds.length === 1
      ? (packs[0]?.projectName || "مشروع")
      : visibleProjects.length > 0 && projectIds.length === visibleProjects.length
        ? "كافة-المشاريع"
        : "عدة-مشاريع";
    XLSX.writeFile(book, `متابعة-الدفعات-${scope}-${stamp}.xlsx`);
    setExportOpen(false);
  };
  const showAllCustomers = !exceptionOnly && excludedGroupIds.length === 0;
  const pressExceptionAll = () => {
    if (showAllCustomers) {
      setExceptionOnly(true);
      setOnlyGroupIds([]);
      setExcludedGroupIds([]);
      return;
    }
    setExceptionOnly(false);
    setOnlyGroupIds([]);
    setExcludedGroupIds([]);
  };
  const pressExceptionGroup = (id: string) => {
    if (exceptionOnly) {
      setOnlyGroupIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
      return;
    }
    setExcludedGroupIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  };
  const allProjectsOn = visibleProjects.length > 0 && visibleProjects.every((project) => projectIds.includes(project.id));
  const pressProjectsAll = () => {
    setProjectIds(allProjectsOn ? [] : visibleProjects.map((project) => project.id));
  };

  if (allowed === null) {
    return <div className="flex h-screen items-center justify-center bg-background text-[13px] text-fg-muted">جاري التحقق من الجلسة</div>;
  }
  if (!allowed) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-[14px]">يلزم تسجيل الدخول لفتح متابعة الدفعات.</p>
        <Link to="/"><Button variant="outline">العودة إلى الأقسام</Button></Link>
      </div>
    );
  }
  if (!permitted) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-[14px]">لا تملك صلاحية متابعة الدفعات.</p>
        <Link to="/"><Button variant="outline">العودة إلى الأقسام</Button></Link>
      </div>
    );
  }

  return (
    <AppShell
      brandSubtitle="متابعة الدفعات"
      nav={<SectionNav />}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" disabled={projectIds.length === 0 || filtered.length === 0} onClick={() => setExportOpen(true)} className="gap-1.5">
            <Download size={13} /> تصدير
          </Button>
        </div>
      }
    >
      <div className="py-8">
        <Eyebrow>المتابعة</Eyebrow>
        <h1 className="mt-3 text-[32px] font-light leading-tight text-fg">المبالغ المتبقية</h1>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-fg-muted">
          الملف يغطي الدفعات المتبقية فقط. الواصل الكلي هو سعر الوحدة ناقص ما تبقى. مجموع المتلكئ هو متبقي الدفعات التي فات موعدها، ولا يشمل دفعة اليوم ولا الدفعات القادمة. الوحدة المباعة أو الاستثمار الغائبة عن الملف تظهر كمن سدّد المبلغ كاملاً.
        </p>
      </div>

      <div className="mb-6 space-y-4">
        <div className="space-y-2">
          <Label>المشروع</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={pressProjectsAll}
              className={cn(
                "border px-2.5 py-1 text-[12px]",
                allProjectsOn ? "border-fg bg-fg text-background" : "border-line text-fg-secondary",
              )}
            >
              الكل
            </button>
            {visibleProjects.map((project) => {
              const active = projectIds.includes(project.id);
              return (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => setProjectIds((current) => (
                    active ? current.filter((id) => id !== project.id) : [...current, project.id]
                  ))}
                  className={cn(
                    "border px-2.5 py-1 text-[12px]",
                    active ? "border-fg bg-fg text-background" : "border-line text-fg-secondary",
                  )}
                >
                  {project.name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-3 xl:grid-cols-6">
          <SummaryCell label="الوحدات" value={formatNumber(summary.units)} />
          <SummaryCell label="الدفعات الظاهرة" value={formatNumber(summary.installmentCount)} />
          <SummaryCell label="متبقي دينار" value={formatMoney(summary.iqd, "IQD")} />
          <SummaryCell label="متبقي دولار" value={formatMoney(summary.usd, "USD")} />
          <SummaryCell label="متلكئ دينار" value={formatMoney(summary.overdueIqd, "IQD")} />
          <SummaryCell label="متلكئ دولار" value={formatMoney(summary.overdueUsd, "USD")} />
        </div>
      </div>

      {tableMissing && (
        <Panel title="جدول المتابعة غير موجود" className="mb-6">
          <p className="text-[13px] leading-relaxed text-fg-secondary">
            نفّذ ملف database_payment_followup.sql مرة واحدة في محرر SQL داخل Supabase، ثم أعد تحميل الصفحة.
          </p>
        </Panel>
      )}

      <Panel title="تصفية" className="mb-6" bodyClassName="space-y-4 p-5">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterField label="الواصل الكلي من">
            <Input
              inputMode="numeric"
              value={filters.receivedFrom}
              onChange={(event) => setFilters({ ...filters, receivedFrom: event.target.value })}
              placeholder="20,000,000"
            />
          </FilterField>
          <FilterField label="الواصل الكلي إلى">
            <Input
              inputMode="numeric"
              value={filters.receivedTo}
              onChange={(event) => setFilters({ ...filters, receivedTo: event.target.value })}
              placeholder="20,000,000"
            />
          </FilterField>
          <FilterField label="بحث">
            <div className="relative">
              <Search size={13} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-fg-faint" />
              <Input
                value={filters.search}
                onChange={(event) => setFilters({ ...filters, search: event.target.value })}
                placeholder="وحدة، زبون، أو هاتف"
                className="ps-8"
              />
            </div>
          </FilterField>
          <FilterField label="استحقاق الدفعة من">
            <Input type="date" value={filters.dueFrom} onChange={(event) => setFilters({ ...filters, dueFrom: event.target.value })} />
          </FilterField>
          <FilterField label="استحقاق الدفعة إلى">
            <Input type="date" value={filters.dueTo} onChange={(event) => setFilters({ ...filters, dueTo: event.target.value })} />
          </FilterField>
          <FilterField label="حالة الدفعة">
            <Select value={filters.dueState} onValueChange={(value) => setFilters({ ...filters, dueState: value as FollowupFilters["dueState"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="overdue">متأخرة</SelectItem>
                <SelectItem value="today">اليوم</SelectItem>
                <SelectItem value="upcoming">قادمة</SelectItem>
                <SelectItem value="upcomingClear">قادمة بلا متلكئ</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="تاريخ البيع من">
            <Input type="date" value={filters.saleFrom} onChange={(event) => setFilters({ ...filters, saleFrom: event.target.value })} />
          </FilterField>
          <FilterField label="تاريخ البيع إلى">
            <Input type="date" value={filters.saleTo} onChange={(event) => setFilters({ ...filters, saleTo: event.target.value })} />
          </FilterField>
          <FilterField label="العملة">
            <Select value={filters.currency} onValueChange={(value) => setFilters({ ...filters, currency: value as FollowupFilters["currency"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="IQD">دينار</SelectItem>
                <SelectItem value="USD">دولار</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="السداد">
            <Select value={filters.settlement} onValueChange={(value) => setFilters({ ...filters, settlement: value as FollowupFilters["settlement"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="remaining">متبقي عليهم</SelectItem>
                <SelectItem value="paid">سددوا كامل المبلغ</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="المستثمرون">
            <Select value={filters.investors} onValueChange={(value) => setFilters({ ...filters, investors: value as FollowupFilters["investors"] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="with">ضمن القائمة</SelectItem>
                <SelectItem value="without">إخفاؤهم</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="المركز التسويقي">
            <Select value={filters.center} onValueChange={(value) => setFilters({ ...filters, center: value })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {centerOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="الترتيب">
            <Select value={sortMode} onValueChange={(value) => setSortMode(value as typeof sortMode)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="overdue">الأكثر تأخراً</SelectItem>
                <SelectItem value="arrears">أكبر متلكئ</SelectItem>
                <SelectItem value="unit">رقم الوحدة</SelectItem>
                <SelectItem value="name">اسم الزبون</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>نوع الوحدة</Label>
            <button type="button" className="text-[11px] text-fg-muted" onClick={() => setFilters({ ...filters, types: [] })}>الكل</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map(([key, label]) => {
              const active = filters.types.includes(key);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilters({
                    ...filters,
                    types: active ? filters.types.filter((item) => item !== key) : [...filters.types, key],
                  })}
                  className={cn(
                    "border px-2.5 py-1 text-[12px]",
                    active ? "border-fg bg-fg text-background" : "border-line text-fg-secondary",
                  )}
                >
                  {label}
                </button>
              );
            })}
            {typeOptions.length === 0 && <span className="text-[12px] text-fg-faint">يظهر بعد اختيار مشروع فيه دفعات</span>}
          </div>
        </div>
        {exceptionGroups.length > 0 && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label>الاستثناءات</Label>
              <span className="text-[11px] text-fg-muted">
                {exceptionOnly
                  ? "المجموعات المحددة هي الظاهرة فقط. الكل يعيد الجميع."
                  : "الكل مفعّل: الضغط على مجموعة يُخفيها. اضغط الكل لإخفاء القائمة ثم اختر ما تريد إظهاره."}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={pressExceptionAll}
                className={cn(
                  "border px-2.5 py-1 text-[12px]",
                  showAllCustomers ? "border-fg bg-fg text-background" : "border-line text-fg-secondary",
                )}
              >
                الكل
              </button>
              {exceptionGroups.map((group) => {
                const active = exceptionOnly ? onlyGroupIds.includes(group.id) : !excludedGroupIds.includes(group.id);
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => pressExceptionGroup(group.id)}
                    className={cn(
                      "border px-2.5 py-1 text-[12px]",
                      active ? "border-fg bg-fg text-background" : "border-line text-fg-secondary",
                    )}
                  >
                    {group.name}
                    <span className="ms-1.5 font-mono tabular-nums opacity-70">{formatNumber(group.names.length)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </Panel>

      {loading ? (
        <LoadingBlock label="جاري تحميل الدفعات" />
      ) : projectIds.length === 0 ? (
        <EmptyState title="اختر المشروع" description="يمكن تحديد أكثر من مشروع، أو الكل." />
      ) : filtered.length === 0 ? (
        <EmptyState title="لا توجد وحدات مطابقة" description="حدّث الملف من لوحة الإدارة، أو وسّع التصفية." />
      ) : (
        <div className="space-y-5">
          {filtered.map((unit) => (
            <UnitBox
              key={noteKey(unit.projectId, unit.unitKey)}
              unit={unit}
              showProject={projectIds.length > 1}
              full={units.find((item) => item.projectId === unit.projectId && item.unitKey === unit.unitKey) || unit}
              notes={notesByUnit[noteKey(unit.projectId, unit.unitKey)] || []}
              onAdd={(body) => addNote(unit.projectId, unit.unitKey, body)}
            />
          ))}
        </div>
      )}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>حقول التصدير</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] leading-relaxed text-fg-muted">ألغِ تحديد أي حقل لا تريده في ملف الإكسل. الاختيار يُحفظ للمرة القادمة.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExportFields(EXPORT_FIELDS.map((field) => field.id))}
              className="border border-line px-2.5 py-1 text-[12px] text-fg-secondary"
            >
              الكل
            </button>
            {EXPORT_FIELDS.map((field) => {
              const active = exportFields.includes(field.id);
              return (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => setExportFields((current) => (
                    active ? current.filter((id) => id !== field.id) : [...current, field.id]
                  ))}
                  className={cn(
                    "border px-2.5 py-1 text-[12px]",
                    active ? "border-fg bg-fg text-background" : "border-line text-fg-secondary",
                  )}
                >
                  {field.label}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>إلغاء</Button>
            <Button onClick={exportExcel} disabled={exportFields.length === 0}>تنزيل</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

const UnitBox = ({
  unit,
  full,
  notes,
  showProject,
  onAdd,
}: {
  unit: FollowupUnit;
  full: FollowupUnit;
  notes: FollowupNote[];
  showProject: boolean;
  onAdd: (body: string) => Promise<void>;
}) => {
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      await onAdd(draft);
      setDraft("");
    } catch {
      /* the page already reports the error */
    } finally {
      setSaving(false);
    }
  };

  const overdue = unit.installments.some((item) => item.whenKind === "overdue");
  const spine = unit.paidInFull || !overdue
    ? "linear-gradient(180deg, #1f8a4c 0%, #b7e0c6 100%)"
    : "linear-gradient(180deg, #c4382f 0%, #f0b2ab 100%)";

  return (
    <section
      className="relative overflow-hidden rounded-2xl text-[#241c16] shadow-[0_18px_36px_-26px_rgba(48,28,10,0.55)]"
      style={{ background: "linear-gradient(165deg, #fffdf8 0%, #f7f1e6 46%, #efe4d2 100%)" }}
    >
      <span className="absolute inset-y-0 start-0 w-1.5" style={{ background: spine }} />
      <header
        className="relative px-6 py-5 text-[#fbf6ee]"
        style={{ background: "linear-gradient(118deg, #241c16 0%, #3d342b 52%, #2a231c 100%)" }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: "radial-gradient(90% 120% at 100% 0%, rgba(214,176,112,0.28), transparent 58%)" }}
        />
        <div className="relative grid gap-4 md:grid-cols-3">
          <Identity label="رقم الوحدة" value={unit.unitLabel} />
          <Identity label="الزبون" value={unit.customerName || "بدون اسم"} edge />
          <Identity label="الهاتف" value={unit.phone || "بدون هاتف"} edge />
        </div>
        <div className="relative mt-4 flex flex-wrap items-center gap-2">
          {showProject && <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold">{unit.projectName}</span>}
          <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold">{unit.typeLabel}</span>
          {unit.status === "investment" && (
            <span className="rounded-full bg-white/10 px-3 py-1 text-[13px] font-semibold">استثمار</span>
          )}
          {unit.paidInFull && (
            <span className="rounded-full px-3 py-1 text-[13px] font-bold text-[#e8fff0]" style={{ background: "linear-gradient(180deg, #1f8a4c, #146636)" }}>
              سدد كامل المبلغ
            </span>
          )}
          <span className="ms-auto text-[15px] font-semibold text-[#f0e2c8]">{unit.centerName}</span>
        </div>
      </header>
      <dl className="grid grid-cols-2 lg:grid-cols-6">
        <Fact label="العملة" value={unit.currency === "USD" ? "دولار" : "دينار"} />
        <Fact label="سعر الوحدة" value={formatMoney(full.salePrice, full.currency)} />
        <Fact label="تاريخ البيع" value={full.saleDate || "—"} />
        <Fact label="الواصل الكلي" value={formatMoney(full.totalReceived, full.currency)} tone="in" />
        <Fact label="مجموع المتبقي" value={formatMoney(full.remaining, full.currency)} tone="out" />
        <Fact label="مجموع المتلكئ" value={formatMoney(full.overdue, full.currency)} tone="out" />
      </dl>
      {full.warnings.length > 0 && (
        <p
          className="px-6 py-3 text-[14px] font-semibold text-[#6a4b16]"
          style={{ background: "linear-gradient(90deg, #fff8ea, #ffe8bf 50%, #fff6e4)" }}
        >
          {full.warnings.join(" · ")}
        </p>
      )}
      {unit.paidInFull ? (
        <p
          className="px-6 py-4 text-[16px] font-bold text-[#146636]"
          style={{ background: "linear-gradient(90deg, #f3fbf6 0%, #d9f3e3 52%, #eef8f2 100%)" }}
        >
          سدد كامل المبلغ
        </p>
      ) : (
        <div>
          <div
            className="grid gap-2 px-5 py-2 text-[12px] font-bold text-[#6d5e50] md:grid-cols-[140px_1.15fr_repeat(3,minmax(0,1fr))] md:items-center"
            style={{ background: "linear-gradient(90deg, rgba(255,252,247,0.2), rgba(92,68,36,0.07), rgba(255,252,247,0.15))" }}
          >
            <span>تاريخ الدفعة</span>
            <span className="hidden md:block md:ps-4">المدة</span>
            <span className="hidden md:block md:ps-4">مبلغ الدفعة</span>
            <span className="hidden md:block md:ps-4">الواصل</span>
            <span className="hidden md:block md:ps-4">المتبقي</span>
          </div>
          <div>
            {unit.installments.map((item) => (
              <div
                key={item.id}
                className="grid gap-2 px-5 py-3.5 text-[15px] font-semibold md:grid-cols-[140px_1.15fr_repeat(3,minmax(0,1fr))] md:items-center"
                style={{ background: installmentWash(item.whenKind) }}
              >
                <span className="tabular text-[15px] font-bold">{item.dueDate || "—"}</span>
                <span className={cn("md:ps-4 md:relative md:before:absolute md:before:inset-y-0.5 md:before:start-0 md:before:w-px md:before:bg-gradient-to-b md:before:from-transparent md:before:via-[#6b5340]/35 md:before:to-transparent", item.whenKind === "overdue" && "font-bold")}>{item.whenLabel}</span>
                <span className="tabular md:ps-4 md:relative md:before:absolute md:before:inset-y-0.5 md:before:start-0 md:before:w-px md:before:bg-gradient-to-b md:before:from-transparent md:before:via-[#6b5340]/35 md:before:to-transparent">{formatMoney(item.amount, unit.currency)}</span>
                <span className="tabular md:ps-4 md:relative md:before:absolute md:before:inset-y-0.5 md:before:start-0 md:before:w-px md:before:bg-gradient-to-b md:before:from-transparent md:before:via-[#1f7a45]/40 md:before:to-transparent"><Money tone="in">{formatMoney(item.received, unit.currency)}</Money></span>
                <span className="tabular md:ps-4 md:relative md:before:absolute md:before:inset-y-0.5 md:before:start-0 md:before:w-px md:before:bg-gradient-to-b md:before:from-transparent md:before:via-[#b42318]/40 md:before:to-transparent"><Money tone="out">{formatMoney(item.remaining, unit.currency)}</Money></span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div
        className="px-6 py-4"
        style={{ background: "linear-gradient(180deg, rgba(255,252,247,0.15), rgba(226,214,194,0.55))" }}
      >
        <h3 className="text-[16px] font-bold">ملاحظات</h3>
        {notes.length > 0 && (
          <ul className="mt-3">
            {notes.map((note) => (
              <li key={note.id} className="border-t border-[#cbbfa8]/70 py-3 first:border-t-0">
                <p className="text-[16px] font-semibold leading-relaxed">{note.body}</p>
                <p className="mt-1 text-[14px] font-bold text-[#5c4d3c]">
                  {note.center_name} · {formatNoteDate(note.created_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="اكتب ملاحظة على هذا الزبون"
            className="min-h-[72px] border-[#d9cbb6] bg-white/70 text-[15px] font-semibold"
          />
          <Button type="button" onClick={save} disabled={saving || !draft.trim()} className="shrink-0 font-semibold">
            {saving ? "جاري الحفظ" : "إضافة ملاحظة"}
          </Button>
        </div>
      </div>
    </section>
  );
};

const Identity = ({ label, value, edge = false }: { label: string; value: string; edge?: boolean }) => (
  <div className={cn("min-w-0", edge && "md:ps-5 md:relative md:before:absolute md:before:inset-y-1 md:before:start-0 md:before:w-px md:before:bg-gradient-to-b md:before:from-transparent md:before:via-[#ead9b8] md:before:to-transparent")}>
    <div className="text-[12px] font-semibold text-[#e4d0ae]">{label}</div>
    <div className="mt-1 break-words text-[24px] font-bold leading-tight text-[#fbf6ee]">{value}</div>
  </div>
);

const installmentWash = (kind: "overdue" | "today" | "upcoming" | "unknown") => {
  if (kind === "overdue") return "linear-gradient(90deg, #fff7f5 0%, #ffd5ce 50%, #fff1ee 100%)";
  if (kind === "today") return "linear-gradient(90deg, #fffaf1 0%, #ffe3b4 50%, #fff5e2 100%)";
  if (kind === "upcoming") return "linear-gradient(90deg, #f5fbf7 0%, #d5f0df 50%, #eef8f2 100%)";
  return "linear-gradient(90deg, #fbf8f3 0%, #f1e8db 100%)";
};

const Money = ({ tone, children }: { tone: "in" | "out"; children: string }) => (
  <span
    className={cn(
      "inline-block bg-clip-text font-bold text-transparent",
      tone === "in"
        ? "bg-[linear-gradient(180deg,#1ea14f,#0c5a30)]"
        : "bg-[linear-gradient(180deg,#e24b40,#8d1c16)]",
    )}
  >
    {children}
  </span>
);

const Fact = ({ label, value, tone }: { label: string; value: string; tone?: "in" | "out" }) => (
  <div
    className="relative px-4 py-3 max-lg:[&:nth-child(odd)]:before:hidden lg:[&:nth-child(6n+1)]:before:hidden before:absolute before:inset-y-3 before:start-0 before:w-px before:bg-gradient-to-b before:from-transparent before:via-[#8a7358]/45 before:to-transparent"
    style={tone === "in"
      ? { background: "linear-gradient(180deg, rgba(220,244,228,0.95), rgba(245,252,247,0.2))" }
      : tone === "out"
        ? { background: "linear-gradient(180deg, rgba(255,228,224,0.95), rgba(255,248,246,0.2))" }
        : undefined}
  >
    <dt className="text-[12px] font-semibold text-[#6d5e50]">{label}</dt>
    <dd className="mt-1 text-[17px] font-bold tabular">
      {tone ? <Money tone={tone}>{value}</Money> : value}
    </dd>
  </div>
);

const formatNoteDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ar-IQ", { dateStyle: "medium", timeStyle: "short" });
};

const SummaryCell = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-surface px-4 py-3">
    <div className="text-[11px] text-fg-muted">{label}</div>
    <div className="mt-1 text-[14px] tabular text-fg">{value}</div>
  </div>
);

const FilterField = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label>{label}</Label>
    {children}
  </div>
);

export default PaymentFollowup;
