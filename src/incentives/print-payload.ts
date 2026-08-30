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

export interface IncentivePrintPayload {
  monthKey: string;
  monthLabel: string;
  year: number;
  month: number;
  style: IncentivePrintStyle;
  unitTypeNames: string[];
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
