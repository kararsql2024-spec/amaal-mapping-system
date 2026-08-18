import type { SupabaseClient } from "@supabase/supabase-js";

export type DeptPermissionMap = Record<string, boolean | string | undefined>;

/** الوصول إلى استمارة تنظيم آلية الدفعات */
export function canAccessPaymentForm(perms?: DeptPermissionMap | null): boolean {
  if (!perms) return true;
  if (typeof perms.canAccessPaymentForm === "boolean") return perms.canAccessPaymentForm;
  return perms.showPaymentPlanButton !== false;
}

/** الوصول إلى أرشيف استمارات الدفعات */
export function canAccessPaymentArchive(perms?: DeptPermissionMap | null): boolean {
  if (!perms) return true;
  return perms.canAccessPaymentArchive !== false;
}

/** معاينة/طباعة استمارة محفوظة */
export function canAccessPaymentPrint(perms?: DeptPermissionMap | null): boolean {
  return canAccessPaymentForm(perms) || canAccessPaymentArchive(perms);
}

export async function fetchSessionDeptPermissions(supabase: SupabaseClient) {
  const savedCenterId = localStorage.getItem("marketing_center_session");
  const savedCenterPass = localStorage.getItem("marketing_center_password");

  if (!savedCenterId) {
    return { center: null, permissions: null as DeptPermissionMap | null };
  }

  const { data: center } = await supabase
    .from("marketing_centers")
    .select("*")
    .eq("id", savedCenterId)
    .maybeSingle();

  if (!center || center.password !== savedCenterPass) {
    return { center: null, permissions: null };
  }

  const { data: settingsRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "dept_permissions")
    .maybeSingle();

  const permissions =
    center.type && settingsRow?.value && typeof settingsRow.value === "object"
      ? ((settingsRow.value as Record<string, DeptPermissionMap>)[center.type] ?? null)
      : null;

  return { center, permissions };
}
