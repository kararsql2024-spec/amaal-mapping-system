import type { ArchivePrintModel } from "./archive-report";
import {
  DEFAULT_PRINT_STYLE,
  LEGACY_PRINT_THEMES,
  PRINT_THEMES,
  type IncentivePrintStyle,
  type IncentivePrintTheme,
  type IncentiveResult,
} from "./types";

const resolvePrintStyle = (value: IncentivePrintStyle | undefined): IncentivePrintStyle => {
  const themeValue = value?.theme;
  const theme = PRINT_THEMES.some((item) => item.id === themeValue)
    ? (themeValue as IncentivePrintTheme)
    : LEGACY_PRINT_THEMES[String(themeValue || "")] || DEFAULT_PRINT_STYLE.theme;
  const preset = PRINT_THEMES.find((item) => item.id === theme);
  return {
    theme,
    accentColor: value?.accentColor || preset?.accentColor || DEFAULT_PRINT_STYLE.accentColor,
    documentTitle: value?.documentTitle || DEFAULT_PRINT_STYLE.documentTitle,
    footerNote: value?.footerNote ?? DEFAULT_PRINT_STYLE.footerNote,
    showWatermark: value?.showWatermark !== false,
  };
};

export const PRINT_STORAGE_KEY = "amaal-incentive-print-v1";
export const ARCHIVE_PRINT_STORAGE_KEY = "amaal-incentive-archive-print-v1";

export interface ArchivePrintPayload {
  style: IncentivePrintStyle;
  model: ArchivePrintModel;
}

export const saveArchivePrintPayload = (payload: ArchivePrintPayload): void => {
  localStorage.setItem(ARCHIVE_PRINT_STORAGE_KEY, JSON.stringify(payload));
};

export const loadArchivePrintPayload = (): ArchivePrintPayload | null => {
  try {
    const raw = localStorage.getItem(ARCHIVE_PRINT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ArchivePrintPayload;
    if (!data?.model || !Array.isArray(data.model.months) || !Array.isArray(data.model.centers)) return null;
    return { ...data, style: resolvePrintStyle(data.style) };
  } catch {
    return null;
  }
};

export interface IncentivePrintRow {
  city: string;
  unitNumber: string;
  userName: string;
  contractPurpose: string;
  company: string;
  center: string;
  centerId: string;
  unitType: string;
  kind: string;
  amount: number;
  included: boolean;
  saleDate: string;
  status: string;
}

export type SummaryColumnId = "unitNumber" | "unitType" | "userName" | "purpose" | "amount";

export const SUMMARY_COLUMNS: Array<{ id: SummaryColumnId; label: string }> = [
  { id: "unitNumber", label: "رقم الدار" },
  { id: "unitType", label: "النوع" },
  { id: "userName", label: "اسم المستخدم" },
  { id: "purpose", label: "الغاية" },
  { id: "amount", label: "المبلغ" },
];

export type SummaryColumnChoice = Record<SummaryColumnId, boolean>;

export const defaultSummaryColumns = (): SummaryColumnChoice => ({
  unitNumber: true,
  unitType: true,
  userName: true,
  purpose: true,
  amount: true,
});

const SUMMARY_COLUMN_KEY = "amaal-incentive-summary-columns-v1";

export const loadSummaryColumns = (): SummaryColumnChoice => {
  const defaults = defaultSummaryColumns();
  try {
    const raw = JSON.parse(localStorage.getItem(SUMMARY_COLUMN_KEY) || "null");
    if (!raw || typeof raw !== "object") return defaults;
    SUMMARY_COLUMNS.forEach((column) => {
      if (typeof raw[column.id] === "boolean") defaults[column.id] = raw[column.id];
    });
    return defaults;
  } catch {
    return defaultSummaryColumns();
  }
};

export const saveSummaryColumns = (columns: SummaryColumnChoice): void => {
  localStorage.setItem(SUMMARY_COLUMN_KEY, JSON.stringify(columns));
};

export interface IncentivePrintPayload {
  monthKey: string;
  monthLabel: string;
  year: number;
  month: number;
  style: IncentivePrintStyle;
  unitTypeNames: string[];
  columns?: SummaryColumnChoice;
  rows: IncentivePrintRow[];
}

export const savePrintPayload = (payload: IncentivePrintPayload): void => {
  localStorage.setItem(PRINT_STORAGE_KEY, JSON.stringify(payload));
};

export const loadPrintPayload = (): IncentivePrintPayload | null => {
  try {
    const raw = localStorage.getItem(PRINT_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as IncentivePrintPayload;
    if (!data || !Array.isArray(data.rows)) return null;
    return {
      ...data,
      style: resolvePrintStyle(data.style),
      unitTypeNames: Array.isArray(data.unitTypeNames) ? data.unitTypeNames : [],
      columns: data.columns ? { ...defaultSummaryColumns(), ...data.columns } : defaultSummaryColumns(),
    };
  } catch {
    return null;
  }
};

export const toPrintRows = (
  results: IncentiveResult[],
  statusOf: (result: IncentiveResult) => string,
  kindOf: (kind: IncentiveResult["parsed"]["kind"]) => string,
): IncentivePrintRow[] =>
  results.map((result) => ({
    city: result.row.city,
    unitNumber: result.row.unitNumber,
    userName: result.row.userName,
    contractPurpose: result.row.contractPurpose,
    company: result.company?.name || "بدون شركة",
    center: result.center?.name || "بدون مركز",
    centerId: result.center?.id || "",
    unitType: result.unitType?.name || "",
    kind: kindOf(result.parsed.kind),
    amount: result.included ? result.amount : 0,
    included: result.included,
    saleDate: (result.row.saleDate || "").slice(0, 10),
    status: statusOf(result),
  }));
