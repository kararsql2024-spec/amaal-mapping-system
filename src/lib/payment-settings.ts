import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_PAYMENT_DEFAULTS,
  type PaymentDefaults,
  type PaymentPrintSettings,
  type PaymentProjectUnitSettings,
  type PaymentProjectUnitSettingsMap,
} from "@/lib/payment-types";
import {
  getPaymentProjectUnitSettings,
  normalizePaymentProjectUnitSettings,
} from "@/lib/payment-unit-resolver";

export const PAYMENT_DEFAULTS_KEY = "payment_defaults";
export const PAYMENT_PRINT_SETTINGS_KEY = "payment_print_settings";
export const PAYMENT_HOUSE_TYPES_KEY = "payment_house_types";
export const PAYMENT_UNIT_SETTINGS_KEY = "payment_unit_settings";

export type PaymentPrintSettingsMap = Record<string, PaymentPrintSettings>;
/** @deprecated استخدم PaymentProjectUnitSettingsMap */
export type PaymentHouseTypesMap = Record<string, string[]>;

export async function fetchPaymentDefaults(
  supabase: SupabaseClient,
): Promise<PaymentDefaults> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", PAYMENT_DEFAULTS_KEY)
    .maybeSingle();

  return {
    ...DEFAULT_PAYMENT_DEFAULTS,
    ...(data?.value && typeof data.value === "object" ? data.value : {}),
  };
}

export async function fetchPaymentPrintSettings(
  supabase: SupabaseClient,
): Promise<PaymentPrintSettingsMap> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", PAYMENT_PRINT_SETTINGS_KEY)
    .maybeSingle();

  const value = data?.value;
  return value && typeof value === "object" ? (value as PaymentPrintSettingsMap) : {};
}

export async function fetchPaymentUnitSettings(
  supabase: SupabaseClient,
): Promise<PaymentProjectUnitSettingsMap> {
  const [{ data: unitSettingsRow }, { data: legacyHouseTypesRow }] = await Promise.all([
    supabase.from("settings").select("value").eq("key", PAYMENT_UNIT_SETTINGS_KEY).maybeSingle(),
    supabase.from("settings").select("value").eq("key", PAYMENT_HOUSE_TYPES_KEY).maybeSingle(),
  ]);

  const normalized: PaymentProjectUnitSettingsMap = {};

  if (unitSettingsRow?.value && typeof unitSettingsRow.value === "object") {
    Object.entries(unitSettingsRow.value as Record<string, unknown>).forEach(([projectId, raw]) => {
      normalized[projectId] = normalizePaymentProjectUnitSettings(raw);
    });
  }

  if (legacyHouseTypesRow?.value && typeof legacyHouseTypesRow.value === "object") {
    Object.entries(legacyHouseTypesRow.value as Record<string, unknown>).forEach(
      ([projectId, raw]) => {
        if (!Array.isArray(raw)) return;

        if (!normalized[projectId]) {
          normalized[projectId] = normalizePaymentProjectUnitSettings({
            house_types: raw,
            apartment_areas: [],
          });
          return;
        }

        if (normalized[projectId].house_types.length === 0 && raw.length > 0) {
          normalized[projectId] = normalizePaymentProjectUnitSettings({
            ...normalized[projectId],
            house_types: raw,
          });
        }
      },
    );
  }

  return normalized;
}

/** توافق مع الكود القديم */
export async function fetchPaymentHouseTypes(
  supabase: SupabaseClient,
): Promise<Record<string, string[]>> {
  const map = await fetchPaymentUnitSettings(supabase);
  return Object.fromEntries(
    Object.entries(map).map(([projectId, settings]) => [
      projectId,
      settings.house_types.map((item) => item.type),
    ]),
  );
}

export function getPaymentPrintSettings(
  settings: PaymentPrintSettingsMap,
  projectId?: string | null,
): PaymentPrintSettings {
  if (!projectId) return {};
  return settings[projectId] || {};
}

/** JSON-safe payload — يزيل undefined ويضمن أرقاماً صالحة */
export function serializePaymentUnitSettingsMap(
  map: PaymentProjectUnitSettingsMap,
): PaymentProjectUnitSettingsMap {
  return Object.fromEntries(
    Object.entries(map).map(([projectId, settings]) => {
      const normalized = normalizePaymentProjectUnitSettings(settings);
      return [
        projectId,
        {
          house_types: normalized.house_types.map((item) => ({
            type: item.type,
            ...(item.area != null && Number(item.area) > 0 ? { area: Number(item.area) } : {}),
          })),
          apartment_areas: normalized.apartment_areas.map((item) => ({
            total_area: Number(item.total_area),
            net_area: Number(item.net_area),
          })),
        },
      ];
    }),
  );
}

async function upsertSettingsValue(
  supabase: SupabaseClient,
  key: string,
  value: unknown,
): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "key" });
  if (error) throw error;
}

export async function savePaymentDefaults(
  supabase: SupabaseClient,
  defaults: PaymentDefaults,
): Promise<void> {
  await upsertSettingsValue(supabase, PAYMENT_DEFAULTS_KEY, defaults);
}

export async function savePaymentPrintSettings(
  supabase: SupabaseClient,
  settings: PaymentPrintSettingsMap,
): Promise<void> {
  await upsertSettingsValue(supabase, PAYMENT_PRINT_SETTINGS_KEY, settings);
}

export async function savePaymentUnitSettings(
  supabase: SupabaseClient,
  map: PaymentProjectUnitSettingsMap,
): Promise<void> {
  const payload = serializePaymentUnitSettingsMap(map);
  await upsertSettingsValue(supabase, PAYMENT_UNIT_SETTINGS_KEY, payload);
}

/** يحفظ الإعدادات الجديدة ويُحدّث المفتاح القديم للتوافق */
export async function savePaymentHouseTypes(
  supabase: SupabaseClient,
  map: PaymentProjectUnitSettingsMap,
): Promise<void> {
  const payload = serializePaymentUnitSettingsMap(map);
  await upsertSettingsValue(supabase, PAYMENT_UNIT_SETTINGS_KEY, payload);

  const legacyMap = Object.fromEntries(
    Object.entries(payload).map(([projectId, settings]) => [
      projectId,
      settings.house_types.map((item) => item.type),
    ]),
  );

  await upsertSettingsValue(supabase, PAYMENT_HOUSE_TYPES_KEY, legacyMap);
}

export function getPaymentHouseTypes(
  map: PaymentProjectUnitSettingsMap,
  projectId?: string | null,
): string[] {
  return getPaymentProjectUnitSettings(map, projectId).house_types.map((item) => item.type);
}

export { getPaymentProjectUnitSettings };
