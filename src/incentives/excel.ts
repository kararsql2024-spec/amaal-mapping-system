import type { ColumnMapping, SaleRow } from "./types";
import { normalizeText } from "./match";

const cellText = (value: unknown): string => {
  if (value == null || value === "") return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return normalizeText(value);
};

const pick = (
  record: Record<string, unknown>,
  columnName: string,
): string => {
  const wanted = normalizeText(columnName);
  if (!wanted) return "";
  if (wanted in record) return cellText(record[wanted]);
  const key = Object.keys(record).find(
    (item) => normalizeText(item) === wanted,
  );
  return key ? cellText(record[key]) : "";
};

export interface ParsedWorkbook {
  columns: string[];
  rows: SaleRow[];
}

export const parseWorkbookSheet = (
  rawRows: Record<string, unknown>[],
  columns: ColumnMapping,
): ParsedWorkbook => {
  const headerSet = new Set<string>();
  const rows: SaleRow[] = rawRows.map((record, index) => {
    Object.keys(record).forEach((key) => {
      const name = normalizeText(key);
      if (name) headerSet.add(name);
    });
    const cells: Record<string, string> = {};
    Object.entries(record).forEach(([key, value]) => {
      cells[normalizeText(key)] = cellText(value);
    });
    return {
      rowNumber: index + 2,
      cells,
      city: pick(record, columns.city),
      zone: pick(record, columns.zone),
      unitNumber: pick(record, columns.unitNumber),
      userName: pick(record, columns.userName),
      contractPurpose: pick(record, columns.contractPurpose),
      houseType: pick(record, columns.houseType),
      area: pick(record, columns.area),
      contractNumber: pick(record, columns.contractNumber),
      buyerName: pick(record, columns.buyerName),
    };
  });

  return {
    columns: Array.from(headerSet),
    rows,
  };
};

export const readExcelFile = async (
  file: File,
  columns: ColumnMapping,
): Promise<ParsedWorkbook> => {
  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    return { columns: [], rows: [] };
  }
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  return parseWorkbookSheet(rawRows, columns);
};
