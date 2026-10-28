import { REPORT_SECTIONS, type ReportSectionId } from "@/lib/report-narrative";
import type { ReportPack, ReportTable } from "@/lib/report-pack";

const SHEET_NAMES: Record<ReportSectionId, string> = {
  cards: "الملخص",
  collection: "موقف التسديد",
  cohort: "عمر الدين",
  centers: "المراكز",
  dues: "الاستحقاقات",
  overdue: "أكبر المتأخرات",
  status: "توزيع المبيعات",
  performance: "أداء المبيعات",
  trend: "منحنى المبيعات",
  legal: "الموقف القانوني",
  obligation: "الطابو والتسليم",
  obligationUnits: "تفاصيل الطابو",
  prices: "متوسط الأسعار",
};

const appendTable = (rows: (string | number)[][], table: ReportTable) => {
  if (rows.length > 0) rows.push([]);
  if (table.title) rows.push([table.title]);
  if (table.headers.length > 0) rows.push(table.headers);
  table.rows.forEach((row) => rows.push(row));
  if (table.footer) rows.push(table.footer);
};

export const exportReportWorkbook = async (pack: ReportPack) => {
  const XLSX = await import("xlsx");
  const book = XLSX.utils.book_new();

  const scopeRows: (string | number)[][] = [
    [pack.title],
    ...(pack.salePeriod ? [[pack.salePeriod]] : []),
    [pack.exportedAt],
    ...(pack.projectNames.length > 0 ? [[], ["المشاريع"], ...pack.projectNames.map((name) => [name])] : []),
    [],
    ["نطاق التقرير"],
    ...pack.scope.map((line) => [line]),
    [],
    ["الأقسام المضمّنة"],
    ...pack.sections.map((id) => [REPORT_SECTIONS.find((section) => section.id === id)?.label || id]),
  ];
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(scopeRows), "نطاق التقرير");

  pack.sections.forEach((id) => {
    const rows: (string | number)[][] = [[pack.briefs[id] || ""], []];
    if (id === "cards") {
      rows.push(["البند", "القيمة", "ملاحظة"]);
      pack.cards.forEach((card) => rows.push([card.label, card.value, card.hint]));
    }
    (pack.tables[id] || []).forEach((table) => appendTable(rows, table));
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const width = Math.max(1, ...rows.map((row) => row.length));
    sheet["!cols"] = Array.from({ length: width }, () => ({ wch: 22 }));
    XLSX.utils.book_append_sheet(book, sheet, SHEET_NAMES[id].slice(0, 31));
  });

  const stamp = new Date().toISOString().slice(0, 10);
  const safeName = pack.projectName.replace(/[\\/:*?"<>|]/g, "").trim() || "مشروع";
  XLSX.writeFile(book, `تقرير-${safeName}-${stamp}.xlsx`);
};
