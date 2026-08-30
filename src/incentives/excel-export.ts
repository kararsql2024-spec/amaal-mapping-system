import {
  groupByCompanyCity,
  kindLabel,
  statusLabel,
  type CompanyGroup,
} from "./group-export";
import type { IncentiveResult } from "./types";

const HEADERS = [
  "المدينة",
  "رقم الدار",
  "اسم المستخدم",
  "الغاية من العقد",
  "التصنيف",
  "نوع الوحدة",
  "تاريخ البيع",
  "مركز التسويق",
  "المبلغ (د.ع)",
  "الحالة",
];

const COL_COUNT = HEADERS.length;

const dataRow = (result: IncentiveResult): Array<string | number> => [
  result.row.city,
  result.row.unitNumber,
  result.row.userName,
  result.row.contractPurpose,
  kindLabel(result.parsed.kind),
  result.unitType?.name || "",
  (result.row.saleDate || "").slice(0, 10),
  result.center?.name || "",
  result.included ? result.amount : 0,
  statusLabel(result),
];

const buildDetailRows = (groups: CompanyGroup[]) => {
  const rows: Array<Array<string | number>> = [];
  const merges: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = [];

  groups.forEach((company, index) => {
    if (index > 0) rows.push([]);

    const titleIndex = rows.length;
    rows.push([`شركة: ${company.name}`]);
    merges.push({
      s: { r: titleIndex, c: 0 },
      e: { r: titleIndex, c: COL_COUNT - 1 },
    });

    rows.push(HEADERS);

    company.cities.forEach((city) => {
      const cityIndex = rows.length;
      rows.push([`المدينة: ${city.name}  —  ${city.count} وحدة`]);
      merges.push({
        s: { r: cityIndex, c: 0 },
        e: { r: cityIndex, c: COL_COUNT - 1 },
      });
      city.rows.forEach((result) => rows.push(dataRow(result)));
    });

    rows.push([
      `إجمالي حافز ${company.name}`,
      "",
      "",
      "",
      "",
      "",
      `${company.count} وحدة`,
      "",
      company.amount,
      "",
    ]);
  });

  const grandCount = groups.reduce((sum, company) => sum + company.count, 0);
  const grandAmount = groups.reduce((sum, company) => sum + company.amount, 0);
  rows.push([]);
  rows.push([
    "الإجمالي العام لكل الشركات",
    "",
    "",
    "",
    "",
    "",
    `${grandCount} وحدة`,
    "",
    grandAmount,
    "",
  ]);

  return { rows, merges };
};

const buildSummaryRows = (groups: CompanyGroup[]) => {
  const rows: Array<Array<string | number>> = [
    ["الملخص حسب الشركة ثم المدينة"],
    [],
    ["الشركة", "المدينة", "عدد الوحدات", "إجمالي الحافز (د.ع)"],
  ];
  groups.forEach((company) => {
    company.cities.forEach((city, index) => {
      rows.push([
        index === 0 ? company.name : "",
        city.name,
        city.count,
        city.amount,
      ]);
    });
    rows.push([`إجمالي ${company.name}`, "", company.count, company.amount]);
    rows.push([]);
  });
  rows.push([
    "الإجمالي العام",
    "",
    groups.reduce((sum, company) => sum + company.count, 0),
    groups.reduce((sum, company) => sum + company.amount, 0),
  ]);
  return rows;
};

export const exportGroupedWorkbook = async (
  results: IncentiveResult[],
  fileName: string,
): Promise<void> => {
  const XLSX = await import("xlsx");
  const groups = groupByCompanyCity(results);
  const detail = buildDetailRows(groups);
  const summaryRows = buildSummaryRows(groups);

  const detailSheet = XLSX.utils.aoa_to_sheet(detail.rows);
  detailSheet["!merges"] = detail.merges;
  detailSheet["!cols"] = [
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 18 },
    { wch: 10 },
    { wch: 20 },
    { wch: 14 },
    { wch: 18 },
    { wch: 16 },
    { wch: 16 },
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryRows);
  summarySheet["!cols"] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 22 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, detailSheet, "حسب الشركة");
  XLSX.utils.book_append_sheet(workbook, summarySheet, "الملخص");
  XLSX.writeFile(workbook, fileName);
};
