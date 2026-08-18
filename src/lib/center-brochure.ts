import type { SupabaseClient } from "@supabase/supabase-js";

export interface CenterBrochureProfile {
  phone?: string;
  phone2?: string;
  marketingLogo?: string;
}

export type CenterBrochureProfiles = Record<string, CenterBrochureProfile>;

export const CENTER_BROCHURE_SETTINGS_KEY = "center_brochure_profiles";

export const emptyCenterBrochureProfile = (): CenterBrochureProfile => ({
  phone: "",
  phone2: "",
  marketingLogo: "",
});

export async function fetchCenterBrochureProfiles(
  supabase: SupabaseClient,
): Promise<CenterBrochureProfiles> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", CENTER_BROCHURE_SETTINGS_KEY)
    .maybeSingle();

  const value = data?.value;
  return value && typeof value === "object" ? (value as CenterBrochureProfiles) : {};
}

export async function saveCenterBrochureProfile(
  supabase: SupabaseClient,
  centerId: string,
  profile: CenterBrochureProfile,
  existing?: CenterBrochureProfiles,
): Promise<void> {
  const current = existing ?? (await fetchCenterBrochureProfiles(supabase));
  const updated: CenterBrochureProfiles = {
    ...current,
    [centerId]: {
      phone: profile.phone?.trim() || "",
      phone2: profile.phone2?.trim() || "",
      marketingLogo: profile.marketingLogo?.trim() || "",
    },
  };

  const { error } = await supabase
    .from("settings")
    .upsert({ key: CENTER_BROCHURE_SETTINGS_KEY, value: updated });

  if (error) throw error;
}

export function getCenterBrochureProfile(
  profiles: CenterBrochureProfiles,
  centerId?: string | null,
): CenterBrochureProfile {
  if (!centerId) return emptyCenterBrochureProfile();
  return profiles[centerId] ?? emptyCenterBrochureProfile();
}

/** يقرأ معرف القسم من الرابط أو localStorage */
export function resolveActiveCenterId(searchParams?: URLSearchParams | null): string | null {
  const fromQuery = searchParams?.get("center")?.trim();
  if (fromQuery) return fromQuery;
  try {
    return localStorage.getItem("marketing_center_session");
  } catch {
    return null;
  }
}

export function getActiveCenterName(): string {
  try {
    return localStorage.getItem("marketing_center_name") || "";
  } catch {
    return "";
  }
}
