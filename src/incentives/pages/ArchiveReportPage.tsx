import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Printer } from "lucide-react";
import { EmptyState, LoadingBlock, Panel, SectionHeading, StatGrid } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIncentiveCatalog } from "../catalog-context";
import {
  buildArchivePrint,
  buildArchiveReport,
  monthTitle,
  type ArchiveReport,
  type ReportSlice,
} from "../archive-report";
import { monthKeyOf } from "../engine";
import { formatAmount } from "../format";
import { MONTHS } from "../months";
import { saveArchivePrintPayload } from "../print-payload";
import { useIncentiveSettings } from "../settings-context";
import { DEFAULT_PRINT_STYLE } from "../types";

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] text-fg-muted">{children}</span>
);

const SliceList = ({ items }: { items: ReportSlice[] }) => {
  if (items.length === 0) {
    return <p className="px-5 py-8 text-center text-[12px] text-fg-muted">لا وحدات محفوظة في هذه الفترة</p>;
  }
  return (
    <ul className="divide-y divide-line">
      {items.map((item) => (
        <li key={item.name} className="flex items-center justify-between gap-3 px-5 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-[13px] text-fg">{item.name}</p>
            <p className="text-[11px] text-fg-muted">{item.count} وحدة</p>
          </div>
          <p className="shrink-0 text-[13px] tabular">{formatAmount(item.amount)}</p>
        </li>
      ))}
    </ul>
  );
};

const ArchiveReportPage = () => {
  const { settings, syncState } = useIncentiveSettings();
  const catalog = useIncentiveCatalog();
  const snapshots = settings.monthSnapshots || [];
  const preparing = syncState === "loading" || catalog.loading;

  const yearOptions = useMemo(() => {
    const years = new Set<number>();
    const current = new Date().getFullYear();
    years.add(current);
    years.add(current - 1);
    years.add(current - 2);
    snapshots.forEach((item) => {
      const year = Number(item.monthKey.slice(0, 4));
      if (year) years.add(year);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [snapshots]);

  const bounds = useMemo(() => {
    const keys = snapshots.map((item) => item.monthKey).sort();
    if (keys.length === 0) {
      const now = new Date();
      const key = monthKeyOf(now.getFullYear(), now.getMonth() + 1);
      return { from: key, to: key };
    }
    return { from: keys[0], to: keys[keys.length - 1] };
  }, [snapshots]);

  const [fromYear, setFromYear] = useState(() => Number(bounds.from.slice(0, 4)));
  const [fromMonth, setFromMonth] = useState(() => Number(bounds.from.slice(5, 7)));
  const [toYear, setToYear] = useState(() => Number(bounds.to.slice(0, 4)));
  const [toMonth, setToMonth] = useState(() => Number(bounds.to.slice(5, 7)));
  const [centerId, setCenterId] = useState("all");
  const [report, setReport] = useState<ArchiveReport | null>(null);
  const [builtLabel, setBuiltLabel] = useState("");
  const seeded = useRef(false);

  const centerOptions = useMemo(() => {
    const map = new Map<string, string>();
    catalog.centers.forEach((center) => {
      if (center.id && center.name) map.set(center.id, center.name);
    });
    snapshots.forEach((snapshot) => {
      snapshot.results.forEach((result) => {
        const id = result.center?.id || "";
        const name = result.center?.name?.trim() || "";
        if (id && name && !map.has(id)) map.set(id, name);
      });
    });
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }, [catalog.centers, snapshots]);

  const publish = (fromKey: string, toKey: string, selectedCenter = centerId) => {
    if (fromKey > toKey) {
      setReport(null);
      setBuiltLabel("بداية الفترة بعد نهايتها");
      return;
    }
    const picked = selectedCenter === "all" ? "" : selectedCenter;
    const next = buildArchiveReport(
      snapshots,
      settings.unitOverrides || [],
      catalog.centers,
      fromKey,
      toKey,
      picked,
    );
    const period = `${monthTitle(fromKey)} — ${monthTitle(toKey)}`;
    setReport(next);
    setBuiltLabel(next.centerName ? `${period} · ${next.centerName}` : period);
  };

  useEffect(() => {
    if (preparing || seeded.current) return;
    seeded.current = true;
    const fromKey = bounds.from;
    const toKey = bounds.to;
    setFromYear(Number(fromKey.slice(0, 4)));
    setFromMonth(Number(fromKey.slice(5, 7)));
    setToYear(Number(toKey.slice(0, 4)));
    setToMonth(Number(toKey.slice(5, 7)));
    if (snapshots.length === 0) return;
    publish(fromKey, toKey, "all");
  }, [preparing, bounds, snapshots, settings.unitOverrides, catalog.centers]);

  const build = () => publish(monthKeyOf(fromYear, fromMonth), monthKeyOf(toYear, toMonth));

  const exportReport = () => {
    const fromKey = monthKeyOf(fromYear, fromMonth);
    const toKey = monthKeyOf(toYear, toMonth);
    if (!report || fromKey > toKey) return;
    const picked = centerId === "all" ? "" : centerId;
    const period = `${monthTitle(fromKey)} — ${monthTitle(toKey)}`;
    saveArchivePrintPayload({
      style: settings.printStyle || DEFAULT_PRINT_STYLE,
      model: buildArchivePrint(
        snapshots,
        settings.unitOverrides || [],
        catalog.centers,
        fromKey,
        toKey,
        settings.unitTypes.map((item) => item.name),
        period,
        picked,
      ),
    });
    window.open("/incentives/archive/print", "_blank");
  };

  if (preparing) {
    return <LoadingBlock label="جاري جلب أرشيف الحوافز" />;
  }

  return (
    <div className="space-y-8 pt-8">
      <SectionHeading
        eyebrow="الأرشيف"
        title="تقرير الحوافز"
        description="يُبنى من الأشهر المحفوظة فقط. شهر بلا حفظ يبقى فارغاً ولا يُؤخذ من الوحدات الحالية في النظام."
        actions={
          report ? (
            <Button type="button" onClick={exportReport}>
              <Printer className="h-4 w-4" />
              تصدير التقرير
            </Button>
          ) : null
        }
      />

      <Panel
        title="الأشهر المحفوظة"
        description={snapshots.length === 0 ? "لا توجد أشهر محفوظة بعد" : `${snapshots.length} شهر في الأرشيف`}
      >
        {snapshots.length === 0 ? (
          <EmptyState
            title="الأرشيف فارغ"
            description="احفظ شهرًا من شاشة احتساب الحافز ليظهر هنا."
            action={
              <Button asChild variant="outline">
                <Link to="/incentives">احتساب الحافز</Link>
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {[...snapshots].sort((a, b) => b.monthKey.localeCompare(a.monthKey)).map((item) => (
              <li key={item.monthKey} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="text-[13px] text-fg">{monthTitle(item.monthKey)}</p>
                  <p className="text-[11px] text-fg-muted">
                    {item.savedAt ? new Date(item.savedAt).toLocaleString("ar-IQ") : "محفوظ"}
                  </p>
                </div>
                <p className="text-[12px] text-fg-muted">{item.results.length} وحدة في النسخة</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="فترة التقرير" description="من شهر محفوظ إلى شهر محفوظ. يمكن حصر الأرقام بمركز تسويقي واحد من الأرشيف، والأشهر بلا حفظ تُذكر ولا تُحسب.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 xl:items-end">
          <label className="space-y-1.5">
            <FieldLabel>من شهر</FieldLabel>
            <Select value={String(fromMonth)} onValueChange={(value) => setFromMonth(Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((item) => (
                  <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5">
            <FieldLabel>من سنة</FieldLabel>
            <Select value={String(fromYear)} onValueChange={(value) => setFromYear(Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5">
            <FieldLabel>إلى شهر</FieldLabel>
            <Select value={String(toMonth)} onValueChange={(value) => setToMonth(Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map((item) => (
                  <SelectItem key={item.value} value={String(item.value)}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5">
            <FieldLabel>إلى سنة</FieldLabel>
            <Select value={String(toYear)} onValueChange={(value) => setToYear(Number(value))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="space-y-1.5">
            <FieldLabel>المركز التسويقي</FieldLabel>
            <Select value={centerId} onValueChange={setCenterId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المراكز</SelectItem>
                {centerOptions.map((center) => (
                  <SelectItem key={center.id} value={center.id}>{center.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <Button type="button" onClick={build}>بناء التقرير</Button>
        </div>
      </Panel>

      {builtLabel && !report ? (
        <EmptyState title={builtLabel} description="اجعل بداية الفترة قبل نهايتها ثم أعد البناء." />
      ) : null}

      {report ? (
        <>
          <p className="text-[13px] text-fg-secondary">{builtLabel}</p>
          <StatGrid
            columns={4}
            items={[
              { label: "أشهر محفوظة", value: report.savedCount, hint: "من الأرشيف" },
              { label: "أشهر غير محفوظة", value: report.missingCount, hint: "بلا مبلغ" },
              { label: "وحدات مضمّنة", value: report.includedCount, hint: report.centerName || "كل المراكز" },
              { label: "إجمالي الحافز", value: formatAmount(report.totalAmount), hint: "دينار" },
            ]}
          />
          {report.truncated ? (
            <p className="text-[12px] text-fg-muted">الفترة أطول من ٣٦ شهراً، وعُرضت أول ٣٦ شهراً فقط.</p>
          ) : null}

          <Panel title="الأشهر داخل الفترة" bodyClassName="overflow-x-auto p-0">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line">
                  {["الشهر", "الحالة", "الوحدات المضمّنة", "المبلغ"].map((header) => (
                    <th key={header} className="h-9 px-3 text-start text-[11px] font-medium text-fg-muted">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.months.map((item) => (
                  <tr key={item.monthKey} className="border-b border-line last:border-0">
                    <td className="px-3 py-2">{item.label}</td>
                    <td className="px-3 py-2 text-fg-muted">{item.saved ? "محفوظ" : "غير محفوظ"}</td>
                    <td className="px-3 py-2 tabular">{item.saved ? item.includedCount : "—"}</td>
                    <td className="px-3 py-2 tabular">{item.saved ? formatAmount(item.amount) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="حسب المركز" bodyClassName="p-0"><SliceList items={report.byCenter} /></Panel>
            <Panel title="حسب الشركة" bodyClassName="p-0"><SliceList items={report.byCompany} /></Panel>
            <Panel title="حسب المدينة" bodyClassName="p-0"><SliceList items={report.byCity} /></Panel>
            <Panel title="حسب نوع الوحدة" bodyClassName="p-0"><SliceList items={report.byUnitType} /></Panel>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default ArchiveReportPage;
