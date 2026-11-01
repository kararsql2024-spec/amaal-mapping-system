import React, { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import {
  EmptyState,
  Panel,
  SectionHeading,
  SegmentedControl,
  StatGrid,
} from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Link } from "react-router-dom";
import { showError, showSuccess } from "@/utils/toast";
import { cn } from "@/lib/utils";
import { useIncentiveCatalog } from "../catalog-context";
import { Field } from "../components/forms";
import {
  applyUnitOverrides,
  computeAll,
  matchUnitOverride,
  monthKeyOf,
  summarize,
} from "../engine";
import { exportGroupedWorkbook } from "../excel-export";
import { formatAmount } from "../format";
import { kindLabel, statusLabel } from "../group-export";
import { MONTHS, monthLabel } from "../months";
import {
  loadSummaryColumns,
  savePrintPayload,
  saveSummaryColumns,
  SUMMARY_COLUMNS,
  toPrintRows,
  type SummaryColumnChoice,
} from "../print-payload";
import { createId } from "../id";
import { useIncentiveSettings } from "../settings-context";
import { fetchSoldSaleRowsForMonth } from "../system-data";
import { DEFAULT_PRINT_STYLE, type IncentiveResult, type MonthSnapshot } from "../types";

type ResultFilter = "all" | "complete" | "incomplete" | "excluded" | "conflict";
type ViewBy = "userName" | "unit";

const ALL = "__all__";
const NONE = "__none__";

const userNameLabel = (value: string) => value.trim() || "بدون اسم مستخدم";

const upsertSnapshot = (snapshots: MonthSnapshot[] | undefined, next: MonthSnapshot): MonthSnapshot[] => {
  const rest = (snapshots || []).filter((item) => item.monthKey !== next.monthKey);
  return [...rest, next];
};

const resultKey = (result: IncentiveResult) =>
  `${result.row.projectId || ""}-${result.row.unitKey || result.row.unitNumber}-${result.row.rowNumber}`;

const CalculatePage = () => {
  const { settings, setSettings, syncState } = useIncentiveSettings();
  const catalog = useIncentiveCatalog();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [baseResults, setBaseResults] = useState<IncentiveResult[]>([]);
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [viewBy, setViewBy] = useState<ViewBy>("unit");
  const [viewCenterId, setViewCenterId] = useState(ALL);
  const [viewProjectId, setViewProjectId] = useState(ALL);
  const [viewUserName, setViewUserName] = useState(ALL);
  const [unitQuery, setUnitQuery] = useState("");
  const [viewUnitKey, setViewUnitKey] = useState(ALL);
  const [busy, setBusy] = useState(false);
  const [scanned, setScanned] = useState<number | null>(null);
  const [calculatedMonthKey, setCalculatedMonthKey] = useState("");
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [overwriteOpen, setOverwriteOpen] = useState(false);
  const [summaryColumns, setSummaryColumns] = useState<SummaryColumnChoice>(() => loadSummaryColumns());
  const preparing = syncState === "loading" || catalog.loading;

  const monthKey = monthKeyOf(year, month);
  const appliedMonthKey = calculatedMonthKey || monthKey;
  const savedSnapshot = (settings.monthSnapshots || []).find((item) => item.monthKey === monthKey);

  useEffect(() => {
    if (preparing) return;
    const snap = (settings.monthSnapshots || []).find((item) => item.monthKey === monthKey);
    if (!snap) {
      setBaseResults([]);
      setCalculatedMonthKey("");
      setScanned(null);
      return;
    }
    setBaseResults(snap.results);
    setCalculatedMonthKey(monthKey);
    setScanned(snap.results.length);
  }, [monthKey, preparing, savedSnapshot?.savedAt]);
  const hasRules =
    settings.companies.length > 0 ||
    settings.unitTypes.length > 0 ||
    settings.cityRules.length > 0 ||
    settings.centerRules.length > 0;

  const years = useMemo(() => {
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2];
  }, []);

  const results = useMemo(
    () =>
      applyUnitOverrides(
        baseResults,
        settings.unitOverrides,
        appliedMonthKey,
        catalog.centers,
      ),
    [appliedMonthKey, baseResults, catalog.centers, settings.unitOverrides],
  );

  const monthSummary = useMemo(() => summarize(results), [results]);

  const userNameOptions = useMemo(() => {
    const names = new Set<string>();
    results.forEach((result) => {
      const name = result.row.userName.trim();
      if (name) names.add(name);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ar"));
  }, [results]);

  const scopedForUnits = useMemo(
    () =>
      results.filter((result) => {
        if (viewProjectId !== ALL && result.row.projectId !== viewProjectId) {
          return false;
        }
        if (viewCenterId === NONE) return !result.center;
        if (viewCenterId !== ALL && result.center?.id !== viewCenterId) {
          return false;
        }
        return true;
      }),
    [results, viewCenterId, viewProjectId],
  );

  const unitOptions = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ key: string; label: string; city: string }> = [];
    scopedForUnits.forEach((result) => {
      const key = result.row.unitKey || `${result.row.projectId || ""}:${result.row.unitNumber}`;
      if (seen.has(key)) return;
      seen.add(key);
      list.push({
        key,
        label: result.row.unitNumber,
        city: result.row.city,
      });
    });
    return list.sort((a, b) => a.label.localeCompare(b.label, "ar", { numeric: true }));
  }, [scopedForUnits]);

  const visible = useMemo(() => {
    const needle = unitQuery.trim();
    return results.filter((result) => {
      if (viewCenterId === NONE && result.center) return false;
      if (viewCenterId !== ALL && viewCenterId !== NONE && result.center?.id !== viewCenterId) {
        return false;
      }
      if (viewProjectId !== ALL && result.row.projectId !== viewProjectId) return false;

      if (viewBy === "userName") {
        if (viewUserName === NONE && result.row.userName.trim()) return false;
        if (
          viewUserName !== ALL &&
          viewUserName !== NONE &&
          result.row.userName.trim() !== viewUserName
        ) {
          return false;
        }
      } else {
        if (viewUnitKey !== ALL) {
          const key = result.row.unitKey || `${result.row.projectId || ""}:${result.row.unitNumber}`;
          if (key !== viewUnitKey) return false;
        }
        if (
          needle &&
          !result.row.unitNumber.includes(needle) &&
          !(result.row.unitKey || "").includes(needle)
        ) {
          return false;
        }
      }

      if (filter === "complete") return result.included && result.missing.length === 0;
      if (filter === "incomplete") return result.included && result.missing.length > 0;
      if (filter === "excluded") return !result.included;
      if (filter === "conflict") return Boolean(result.conflictNote);
      return true;
    });
  }, [
    filter,
    results,
    unitQuery,
    viewBy,
    viewCenterId,
    viewProjectId,
    viewUnitKey,
    viewUserName,
  ]);

  const summary = useMemo(() => summarize(visible), [visible]);

  const groupedRows = useMemo(() => {
    const map = new Map<string, { title: string; rows: IncentiveResult[] }>();
    visible.forEach((result) => {
      const title =
        viewBy === "userName"
          ? userNameLabel(result.row.userName)
          : result.row.city || "مدينة غير معروفة";
      const current = map.get(title) || { title, rows: [] };
      current.rows.push(result);
      map.set(title, current);
    });
    return Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title, "ar"));
  }, [viewBy, visible]);

  const saveOverride = (
    result: IncentiveResult,
    patch: { included?: boolean; centerId?: string },
  ) => {
    const included = patch.included ?? result.included;
    const centerId = patch.centerId ?? result.center?.id ?? "";
    const autoId = result.autoCenterId || "";
    const isDefault = included && centerId === autoId;

    setSettings((prev) => {
      const rest = prev.unitOverrides.filter(
        (item) => !matchUnitOverride(item, result.row, appliedMonthKey),
      );
      if (isDefault) return { ...prev, unitOverrides: rest };
      return {
        ...prev,
        unitOverrides: [
          ...rest,
          {
            id: createId(),
            monthKey: appliedMonthKey,
            projectId: result.row.projectId || "",
            unitKey: result.row.unitKey || "",
            unitNumber: result.row.unitNumber,
            included,
            centerId,
          },
        ],
      };
    });
  };

  const storeSnapshot = (key: string, results: IncentiveResult[]) => {
    const next: MonthSnapshot = {
      monthKey: key,
      savedAt: new Date().toISOString(),
      results,
    };
    setSettings((prev) => ({
      ...prev,
      monthSnapshots: upsertSnapshot(prev.monthSnapshots, next),
    }));
  };

  const runCalculate = async (replaceSaved: boolean) => {
    setBusy(true);
    try {
      const rows = await fetchSoldSaleRowsForMonth(year, month);
      setScanned(rows.length);
      if (rows.length === 0) {
        if (!replaceSaved) setBaseResults([]);
        showError("لا توجد وحدات مباعة في هذا الشهر");
        return;
      }
      const next = computeAll(rows, settings, {
        centers: catalog.centers,
      });
      const key = monthKeyOf(year, month);
      setCalculatedMonthKey(key);
      setBaseResults(next);
      if (replaceSaved) storeSnapshot(key, next);
      showSuccess(
        replaceSaved
          ? `تم استبدال بيانات الشهر واحتساب ${rows.length} وحدة مباعة`
          : `تم احتساب ${rows.length} وحدة مباعة`,
      );
    } catch (error) {
      console.error(error);
      showError("تعذر جلب المبيعات من قاعدة البيانات");
    } finally {
      setBusy(false);
    }
  };

  const requestCalculate = () => {
    if ((settings.monthSnapshots || []).some((item) => item.monthKey === monthKey)) {
      setOverwriteOpen(true);
      return;
    }
    void runCalculate(false);
  };

  const saveMonth = () => {
    if (!calculatedMonthKey || baseResults.length === 0) return;
    storeSnapshot(calculatedMonthKey, baseResults);
    showSuccess("تم حفظ بيانات الشهر");
  };

  const exportResults = async () => {
    if (visible.length === 0) return;
    await exportGroupedWorkbook(visible, `حوافز_${appliedMonthKey}.xlsx`);
    showSuccess("تم تنزيل النتائج مرتبة حسب الشركة والمدينة");
  };

  const openPrintSummary = () => {
    if (!visible.some((result) => result.included)) {
      showError("لا توجد وحدات مضمّنة في العرض الحالي");
      return;
    }
    setSummaryOpen(true);
  };

  const confirmPrintSummary = () => {
    const included = visible.filter((result) => result.included);
    if (included.length === 0 || !SUMMARY_COLUMNS.some((column) => summaryColumns[column.id])) return;
    saveSummaryColumns(summaryColumns);
    savePrintPayload({
      monthKey: appliedMonthKey,
      monthLabel: monthLabel(Number(appliedMonthKey.split("-")[1]) || month),
      year: Number(appliedMonthKey.split("-")[0]) || year,
      month: Number(appliedMonthKey.split("-")[1]) || month,
      style: settings.printStyle || DEFAULT_PRINT_STYLE,
      unitTypeNames: settings.unitTypes.map((item) => item.name),
      columns: summaryColumns,
      rows: toPrintRows(included, statusLabel, kindLabel),
    });
    setSummaryOpen(false);
    window.open("/incentives/print", "_blank");
  };

  return (
    <div className="space-y-8 pt-8">
      <SectionHeading
        eyebrow="احتساب"
        title="حافز المبيعات"
        description="يُحسب من الوحدات المباعة فقط. يمكنك تصفية النتائج حسب المركز والمدينة واسم المستخدم أو الوحدة، وتضمين أو استبعاد أي وحدة من حافز مركز معيّن."
        actions={
          visible.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => void exportResults()}>
                <Download className="h-4 w-4" />
                تصدير الإكسل
              </Button>
              <Button type="button" onClick={openPrintSummary}>
                <Printer className="h-4 w-4" />
                تصدير الملخص
              </Button>
            </div>
          ) : null
        }
      />

      {!hasRules ? (
        <Panel title="ابدأ من لوحة التحكم">
          <p className="text-[13px] leading-relaxed text-fg-muted">
            أضف الشركات وأنواع الوحدات وقواعد الربط أولاً. المدن والمراكز تُجلب تلقائياً من النظام.
          </p>
          <Button asChild className="mt-4">
            <Link to="/incentives/settings">فتح لوحة التحكم</Link>
          </Button>
        </Panel>
      ) : null}

      <Panel
        title="شهر الاحتساب"
        description={
            preparing
            ? "جاري جلب التخصيصات من لوحة التحكم: المراكز والقواعد والأنواع"
            : savedSnapshot
              ? `بيانات محفوظة لهذا الشهر${savedSnapshot.savedAt ? ` · ${new Date(savedSnapshot.savedAt).toLocaleString("ar-IQ")}` : ""}`
              : scanned == null
                ? "تُقرأ الوحدات ذات الحالة «مباع» وتاريخ البيع داخل الشهر"
                : `آخر احتساب: ${scanned} وحدة مباعة. احفظ الشهر بعد التصفية.`
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-[11px] text-fg-muted">الشهر</span>
              <Select
                value={String(month)}
                onValueChange={(value) => setMonth(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((item) => (
                    <SelectItem key={item.value} value={String(item.value)}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] text-fg-muted">السنة</span>
              <Select
                value={String(year)}
                onValueChange={(value) => setYear(Number(value))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((item) => (
                    <SelectItem key={item} value={String(item)}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="button" onClick={requestCalculate} disabled={busy || preparing}>
            {busy ? "جاري الاحتساب..." : preparing ? "جاري جلب التخصيصات" : "احتساب الحافز"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={saveMonth}
            disabled={busy || preparing || baseResults.length === 0 || calculatedMonthKey !== monthKey}
          >
            حفظ بيانات الشهر
          </Button>
        </div>
      </Panel>

      {results.length > 0 ? (
        <>
          <Panel
            title="تخصيص العرض"
            description="العرض لا يغيّر القواعد العامة. تضمين الوحدة أو استبعادها يُحفظ لهذا الشهر فقط."
          >
            <div className="mb-4">
              <SegmentedControl
                value={viewBy}
                onChange={(value) => {
                  setViewBy(value);
                  setViewUnitKey(ALL);
                  setUnitQuery("");
                  setViewUserName(ALL);
                }}
                options={[
                  { value: "unit", label: "حسب الوحدة السكنية" },
                  { value: "userName", label: "حسب اسم المستخدم" },
                ]}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="مركز التسويق">
                <Select value={viewCenterId} onValueChange={setViewCenterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="كل المراكز" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>كل المراكز</SelectItem>
                    <SelectItem value={NONE}>بدون مركز</SelectItem>
                    {catalog.centers.map((center) => (
                      <SelectItem key={center.id} value={center.id}>
                        {center.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="المدينة">
                <Select
                  value={viewProjectId}
                  onValueChange={(value) => {
                    setViewProjectId(value);
                    setViewUnitKey(ALL);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="جميع المدن" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL}>جميع المدن</SelectItem>
                    {catalog.projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {viewBy === "userName" ? (
                <Field label="اسم المستخدم">
                  <Select value={viewUserName} onValueChange={setViewUserName}>
                    <SelectTrigger>
                      <SelectValue placeholder="كل الأسماء" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>كل الأسماء</SelectItem>
                      <SelectItem value={NONE}>بدون اسم مستخدم</SelectItem>
                      {userNameOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              ) : (
                <>
                  <Field label="الوحدة السكنية">
                    <Select value={viewUnitKey} onValueChange={setViewUnitKey}>
                      <SelectTrigger>
                        <SelectValue placeholder="كل الوحدات" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ALL}>كل الوحدات</SelectItem>
                        {unitOptions.slice(0, 120).map((unit) => (
                          <SelectItem key={unit.key} value={unit.key}>
                            {viewProjectId === ALL
                              ? `${unit.label} — ${unit.city}`
                              : unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="بحث رقم الدار">
                    <Input
                      value={unitQuery}
                      onChange={(event) => setUnitQuery(event.target.value)}
                      placeholder="Z1- أو A1-"
                    />
                  </Field>
                </>
              )}
            </div>
          </Panel>

          <StatGrid
            columns={4}
            items={[
              {
                label: "وحدات معروضة",
                value: summary.totalRows,
                hint: `من ${monthSummary.totalRows} في الشهر`,
              },
              { label: "مضمّن في الحافز", value: summary.includedCount },
              { label: "مستبعد", value: summary.skippedCount },
              {
                label: "إجمالي الحافز المعروض",
                value: `${formatAmount(summary.totalAmount)} د.ع`,
                hint:
                  monthSummary.conflictCount > 0
                    ? `${monthSummary.conflictCount} تضارب بادئة/مستخدم في الشهر`
                    : undefined,
              },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-4">
            <Panel title="حسب المركز" description="اضغط مركزاً لعرض بياناته فقط" bodyClassName="p-0">
              <SummaryList
                items={summary.byCenter}
                activeId={viewCenterId === ALL || viewCenterId === NONE ? undefined : viewCenterId}
                onSelect={(id) => {
                  if (!id || id === "غير محدد") {
                    setViewCenterId((current) => (current === NONE ? ALL : NONE));
                    return;
                  }
                  setViewCenterId((current) => (current === id ? ALL : id));
                }}
              />
            </Panel>
            <Panel title="حسب اسم المستخدم" bodyClassName="p-0">
              <SummaryList
                items={summary.byUserName}
                onSelect={(name) => {
                  setViewBy("userName");
                  if (!name || name === "بدون اسم مستخدم") {
                    setViewUserName((current) => (current === NONE ? ALL : NONE));
                    return;
                  }
                  setViewUserName((current) => (current === name ? ALL : name));
                }}
              />
            </Panel>
            <Panel title="حسب الشركة" bodyClassName="p-0">
              <SummaryList items={summary.byCompany} />
            </Panel>
            <Panel title="حسب نوع الوحدة" bodyClassName="p-0">
              <SummaryList items={summary.byUnitType} />
            </Panel>
          </div>

          <Panel
            title="التفاصيل"
            description={`${visible.length} من ${results.length} — بدّل التضمين أو غيّر المركز لأي وحدة`}
            actions={
              <SegmentedControl
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "الكل" },
                  { value: "complete", label: "مكتمل" },
                  { value: "incomplete", label: "ناقص" },
                  { value: "excluded", label: "مستبعد" },
                  { value: "conflict", label: "تضارب" },
                ]}
              />
            }
            bodyClassName="overflow-x-auto p-0"
          >
            {visible.length === 0 ? (
              <EmptyState title="لا صفوف في هذا التصفية" className="border-0" />
            ) : (
              <div className="space-y-6 px-0 py-2">
                {groupedRows.map((group) => (
                  <div key={group.title}>
                    <h4 className="border-b border-line bg-surface-sunken px-3 py-2 text-[12px] font-medium text-fg">
                      {group.title}
                      <span className="ms-2 font-normal text-fg-muted">
                        {group.rows.length} وحدة
                      </span>
                    </h4>
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr className="border-b border-line">
                          {[
                            "تضمين",
                            "المركز",
                            viewBy === "userName" ? "المدينة" : "اسم المستخدم",
                            "رقم الدار",
                            "النوع",
                            "تاريخ البيع",
                            "المبلغ",
                          ].map((header) => (
                            <th
                              key={header}
                              className="h-9 px-3 text-start text-[11px] font-medium text-fg-muted"
                            >
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((result) => (
                          <ResultRow
                            key={resultKey(result)}
                            result={result}
                            viewBy={viewBy}
                            centers={catalog.centers}
                            onIncludeChange={(included) =>
                              saveOverride(result, {
                                included,
                                centerId: result.center?.id,
                              })
                            }
                            onCenterChange={(centerId) =>
                              saveOverride(result, { included: true, centerId })
                            }
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      ) : (
        <EmptyState
          icon={<FileSpreadsheet className="h-8 w-8" />}
          title="لم يُحتسب شهر بعد"
          description="اختر الشهر ثم احتساب الحافز. بعدها يمكنك تخصيص العرض لكل مركز أو مستخدم أو وحدة."
        />
      )}
      <Dialog open={overwriteOpen} onOpenChange={setOverwriteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>استبدال بيانات الشهر</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] leading-relaxed text-fg-muted">
            هذا الشهر محفوظ. الاحتساب الجديد يستبدل البيانات السابقة. هل تريد الاستبدال؟
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOverwriteOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                setOverwriteOpen(false);
                void runCalculate(true);
              }}
            >
              استبدال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>أعمدة الملخص</DialogTitle>
          </DialogHeader>
          <p className="text-[12px] leading-relaxed text-fg-muted">
            الملخص يضم الوحدات المضمّنة فقط. ألغِ أي عمود لا تريده في الكشف.
          </p>
          <div className="flex flex-wrap gap-2">
            {SUMMARY_COLUMNS.map((column) => {
              const active = summaryColumns[column.id];
              return (
                <button
                  key={column.id}
                  type="button"
                  onClick={() => setSummaryColumns((current) => ({ ...current, [column.id]: !current[column.id] }))}
                  className={cn(
                    "border px-2.5 py-1 text-[12px]",
                    active ? "border-fg bg-fg text-background" : "border-line text-fg-secondary",
                  )}
                >
                  {column.label}
                </button>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSummaryOpen(false)}>إلغاء</Button>
            <Button
              onClick={confirmPrintSummary}
              disabled={!SUMMARY_COLUMNS.some((column) => summaryColumns[column.id])}
            >
              فتح الملخص
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const ResultRow = ({
  result,
  viewBy,
  centers,
  onIncludeChange,
  onCenterChange,
}: {
  result: IncentiveResult;
  viewBy: ViewBy;
  centers: Array<{ id: string; name: string }>;
  onIncludeChange: (included: boolean) => void;
  onCenterChange: (centerId: string) => void;
}) => {
  const centerOptions =
    result.center && !centers.some((center) => center.id === result.center?.id)
      ? [result.center, ...centers]
      : centers;

  return (
  <tr
    className={cn(
      "border-b border-line last:border-0",
      !result.included && "bg-surface-sunken/60 text-fg-muted",
    )}
  >
    <td className="px-3 py-2">
      <div className="flex items-center gap-2">
        <Switch
          checked={result.included}
          onCheckedChange={onIncludeChange}
          aria-label="تضمين في الحافز"
        />
        {result.overrideApplied ? (
          <span className="text-[10px] text-fg-muted">يدوي</span>
        ) : null}
      </div>
    </td>
    <td className="min-w-[160px] px-3 py-2">
      <Select
        value={result.center?.id}
        onValueChange={onCenterChange}
      >
        <SelectTrigger className="h-8 text-[12px]">
          <SelectValue placeholder="تعيين مركز" />
        </SelectTrigger>
        <SelectContent>
          {centerOptions.map((center) => (
            <SelectItem key={center.id} value={center.id}>
              {center.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </td>
    <td className="px-3 py-2">
      {viewBy === "userName"
        ? result.row.city || "—"
        : userNameLabel(result.row.userName)}
    </td>
    <td className="px-3 py-2 font-medium">
      {result.row.unitNumber}
      <div className="text-[11px] font-normal text-fg-muted">
        {kindLabel(result.parsed.kind)}
        {result.parsed.typeCode ? ` · ${result.parsed.typeCode}` : ""}
      </div>
      {result.row.contractPurpose ? (
        <div className="text-[11px] font-normal text-fg-muted">
          الغاية: {result.row.contractPurpose}
        </div>
      ) : null}
      {result.sentence ? (
        <div className="mt-1 max-w-xs text-[11px] font-normal leading-relaxed text-fg-muted">
          {result.sentence}
        </div>
      ) : result.skipReason ? (
        <div className="mt-1 text-[11px] font-normal text-fg-muted">{result.skipReason}</div>
      ) : null}
      {result.included && result.missing.length > 0 ? (
        <div className="mt-1 text-[11px] font-normal text-fg-muted">
          ينقص: {result.missing.join("، ")}
        </div>
      ) : null}
      {result.conflictNote ? (
        <div className="mt-1 text-[11px] font-normal text-amber-700 dark:text-amber-400">
          تضارب: {result.conflictNote}
        </div>
      ) : null}
    </td>
    <td className="px-3 py-2">{result.unitType?.name || "—"}</td>
    <td className="px-3 py-2 text-fg-muted">{(result.row.saleDate || "").slice(0, 10)}</td>
    <td className="px-3 py-2 tabular">
      {result.included ? formatAmount(result.amount) : "0"}
    </td>
  </tr>
  );
};

const SummaryList = ({
  items,
  activeId,
  onSelect,
}: {
  items: Array<{ name: string; count: number; amount: number; id?: string }>;
  activeId?: string;
  onSelect?: (idOrName?: string) => void;
}) => {
  if (items.length === 0) {
    return <p className="px-5 py-8 text-center text-[12px] text-fg-muted">لا بيانات</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => {
        const key = item.id || item.name;
        const active = Boolean(activeId && item.id === activeId);
        const content = (
          <>
            <div className="min-w-0">
              <p className="truncate text-[13px] text-fg">{item.name}</p>
              <p className="text-[11px] text-fg-muted">{item.count} وحدة</p>
            </div>
            <p className="shrink-0 text-[13px] tabular">{formatAmount(item.amount)}</p>
          </>
        );
        return (
          <li key={key}>
            {onSelect ? (
              <button
                type="button"
                onClick={() => onSelect(item.id || item.name)}
                className={cn(
                  "flex w-full items-center justify-between gap-3 px-5 py-2.5 text-start transition-colors hover:bg-surface-sunken",
                  active && "bg-surface-sunken",
                )}
              >
                {content}
              </button>
            ) : (
              <div className="flex items-center justify-between gap-3 px-5 py-2.5">
                {content}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
};

export default CalculatePage;
