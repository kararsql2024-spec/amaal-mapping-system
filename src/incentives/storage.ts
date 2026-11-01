import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_PRINT_STYLE,
  EMPTY_SETTINGS,
  LEGACY_PRINT_THEMES,
  PRINT_THEMES,
  type IncentivePrintStyle,
  type IncentivePrintTheme,
  type IncentiveResult,
  type IncentiveSettings,
  type MonthSnapshot,
  type UnitCenterOverride,
} from "./types";

export const STORAGE_KEY = "amaal-incentive-system-v1";
export const SETTINGS_DB_KEY = "incentive_system";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const asArray = <T,>(value: unknown, fallback: T[]): T[] =>
  Array.isArray(value) ? (value as T[]) : fallback;

const resolveTheme = (value: unknown): IncentivePrintTheme => {
  if (typeof value !== "string") return DEFAULT_PRINT_STYLE.theme;
  if (PRINT_THEMES.some((item) => item.id === value)) {
    return value as IncentivePrintTheme;
  }
  return LEGACY_PRINT_THEMES[value] || DEFAULT_PRINT_STYLE.theme;
};

const asPrintStyle = (value: unknown): IncentivePrintStyle => {
  const data = isRecord(value) ? value : {};
  const theme = resolveTheme(data.theme);
  const preset = PRINT_THEMES.find((item) => item.id === theme);
  return {
    theme,
    accentColor:
      typeof data.accentColor === "string" && data.accentColor.trim()
        ? data.accentColor.trim()
        : preset?.accentColor || DEFAULT_PRINT_STYLE.accentColor,
    documentTitle:
      typeof data.documentTitle === "string" && data.documentTitle.trim()
        ? data.documentTitle.trim()
        : DEFAULT_PRINT_STYLE.documentTitle,
    footerNote:
      typeof data.footerNote === "string"
        ? data.footerNote
        : DEFAULT_PRINT_STYLE.footerNote,
    showWatermark:
      typeof data.showWatermark === "boolean"
        ? data.showWatermark
        : DEFAULT_PRINT_STYLE.showWatermark,
  };
};

const asOverrides = (value: unknown): UnitCenterOverride[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter(isRecord)
    .map((item) => ({
      id: String(item.id || ""),
      monthKey: String(item.monthKey || ""),
      projectId: String(item.projectId || ""),
      unitKey: String(item.unitKey || ""),
      unitNumber: String(item.unitNumber || ""),
      included: item.included !== false,
      centerId: String(item.centerId || ""),
    }))
    .filter((item) => item.monthKey && (item.unitKey || item.unitNumber));
};

const asSnapshots = (value: unknown): MonthSnapshot[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).flatMap((item) => {
    const monthKey = String(item.monthKey || "");
    const results = Array.isArray(item.results) ? (item.results as IncentiveResult[]) : [];
    if (!/^\d{4}-\d{2}$/.test(monthKey) || results.length === 0) return [];
    return [{
      monthKey,
      savedAt: typeof item.savedAt === "string" ? item.savedAt : "",
      results,
    }];
  });
};

export const normalizeSettings = (raw: unknown): IncentiveSettings => {
  const data = isRecord(raw) ? raw : {};
  const eligibility = isRecord(data.eligibility) ? data.eligibility : {};
  const columns = isRecord(data.columns) ? data.columns : {};
  return {
    companies: asArray(data.companies, EMPTY_SETTINGS.companies),
    centers: asArray(data.centers, EMPTY_SETTINGS.centers),
    unitTypes: asArray(data.unitTypes, EMPTY_SETTINGS.unitTypes),
    cityRules: asArray(data.cityRules, EMPTY_SETTINGS.cityRules),
    centerRules: asArray(data.centerRules, EMPTY_SETTINGS.centerRules),
    houseTypeRules: asArray(data.houseTypeRules, EMPTY_SETTINGS.houseTypeRules),
    apartmentTypeRules: asArray(
      data.apartmentTypeRules,
      EMPTY_SETTINGS.apartmentTypeRules,
    ),
    unitOverrides: asOverrides(data.unitOverrides),
    monthSnapshots: asSnapshots(data.monthSnapshots),
    printStyle: asPrintStyle(data.printStyle),
    eligibility: {
      enabled:
        typeof eligibility.enabled === "boolean"
          ? eligibility.enabled
          : EMPTY_SETTINGS.eligibility.enabled,
      matchMode:
        eligibility.matchMode === "equals" || eligibility.matchMode === "contains"
          ? eligibility.matchMode
          : EMPTY_SETTINGS.eligibility.matchMode,
      values: (() => {
        const values = asArray(eligibility.values, EMPTY_SETTINGS.eligibility.values)
          .map((item) => String(item || "").trim())
          .filter(Boolean);
        const isLegacyDefault =
          values.length === 1 &&
          values[0] === "عقد جديد" &&
          eligibility.matchMode !== "equals";
        return isLegacyDefault ? [] : values;
      })(),
    },
    columns: {
      ...EMPTY_SETTINGS.columns,
      ...Object.fromEntries(
        Object.entries(columns).filter(([, value]) => typeof value === "string"),
      ),
    },
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
  };
};

export const settingsWeight = (settings: IncentiveSettings): number =>
  settings.companies.length +
  settings.centers.length +
  settings.unitTypes.length +
  settings.cityRules.length +
  settings.centerRules.length +
  settings.houseTypeRules.length +
  settings.apartmentTypeRules.length +
  settings.unitOverrides.length +
  settings.monthSnapshots.length +
  settings.eligibility.values.length;

export const stampSettings = (settings: IncentiveSettings): IncentiveSettings => ({
  ...settings,
  updatedAt: new Date().toISOString(),
});

export const fetchRemoteSettings = async (
  client: SupabaseClient,
): Promise<IncentiveSettings | null> => {
  const { data, error } = await client
    .from("settings")
    .select("value")
    .eq("key", SETTINGS_DB_KEY)
    .maybeSingle();
  if (error) throw error;
  if (!data?.value) return null;
  const next = normalizeSettings(data.value);
  return settingsWeight(next) > 0 || next.updatedAt ? next : null;
};

export const saveRemoteSettings = async (
  client: SupabaseClient,
  settings: IncentiveSettings,
): Promise<void> => {
  const payload = stampSettings(settings);
  const { error } = await client
    .from("settings")
    .upsert({ key: SETTINGS_DB_KEY, value: payload }, { onConflict: "key" });
  if (error) throw error;
};

export const resolveSettingsSources = (
  local: IncentiveSettings,
  remote: IncentiveSettings | null,
): { settings: IncentiveSettings; shouldUpload: boolean } => {
  const localWeight = settingsWeight(local);
  const remoteWeight = remote ? settingsWeight(remote) : 0;

  if (!remote || remoteWeight === 0) {
    return { settings: local, shouldUpload: localWeight > 0 };
  }
  if (localWeight === 0) {
    return { settings: remote, shouldUpload: false };
  }

  const localTime = Date.parse(local.updatedAt || "");
  const remoteTime = Date.parse(remote.updatedAt || "");
  if (Number.isFinite(localTime) && Number.isFinite(remoteTime)) {
    if (remoteTime > localTime) return { settings: remote, shouldUpload: false };
    if (localTime > remoteTime) return { settings: local, shouldUpload: true };
  }

  if (remoteWeight > localWeight) return { settings: remote, shouldUpload: false };
  if (localWeight > remoteWeight) return { settings: local, shouldUpload: true };
  return { settings: remote, shouldUpload: false };
};

export const loadSettings = (): IncentiveSettings => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY_SETTINGS, columns: { ...EMPTY_SETTINGS.columns } };
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return { ...EMPTY_SETTINGS, columns: { ...EMPTY_SETTINGS.columns } };
  }
};

export const saveSettings = (settings: IncentiveSettings): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

export const exportSettingsJson = (settings: IncentiveSettings): string =>
  JSON.stringify(settings, null, 2);
