import type { SupabaseClient } from "@supabase/supabase-js";

/** مفاتيح الأقسام المخفية من قائمة تسجيل الدخول. الغياب يعني أن القسم ظاهر. */
export type CenterLoginVisibility = Record<string, boolean>;

export const CENTER_LOGIN_VISIBILITY_KEY = "center_login_visibility";

export function isCenterListedForLogin(
  visibility: CenterLoginVisibility | null | undefined,
  centerId: string,
): boolean {
  if (!visibility) return true;
  return visibility[centerId] !== false;
}

export async function fetchCenterLoginVisibility(
  supabase: SupabaseClient,
): Promise<CenterLoginVisibility> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", CENTER_LOGIN_VISIBILITY_KEY)
    .maybeSingle();

  const value = data?.value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as CenterLoginVisibility;
}

export async function saveCenterLoginVisibility(
  supabase: SupabaseClient,
  centerId: string,
  listed: boolean,
  existing?: CenterLoginVisibility,
): Promise<CenterLoginVisibility> {
  const current = existing ?? (await fetchCenterLoginVisibility(supabase));
  const updated: CenterLoginVisibility = { ...current, [centerId]: listed };
  const { error } = await supabase
    .from("settings")
    .upsert({ key: CENTER_LOGIN_VISIBILITY_KEY, value: updated });
  if (error) throw error;
  return updated;
}

export async function deleteCenterLoginVisibility(
  supabase: SupabaseClient,
  centerId: string,
  existing?: CenterLoginVisibility,
): Promise<void> {
  const current = existing ?? (await fetchCenterLoginVisibility(supabase));
  if (!(centerId in current)) return;
  const updated = { ...current };
  delete updated[centerId];
  const { error } = await supabase
    .from("settings")
    .upsert({ key: CENTER_LOGIN_VISIBILITY_KEY, value: updated });
  if (error) throw error;
}
