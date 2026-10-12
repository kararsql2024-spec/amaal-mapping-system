import type { SupabaseClient } from "@supabase/supabase-js";
import { centerSessionToRecord, validateCenterSession } from "@/lib/center-auth";

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

/** الخريطة التفاعلية ثلاثية الأبعاد */
export function canAccessExplore(perms?: DeptPermissionMap | null): boolean {
  if (!perms) return true;
  return perms.canAccessExplore !== false;
}

/** جولة داخل الوحدة */
export function canAccessTour(perms?: DeptPermissionMap | null): boolean {
  if (!perms) return true;
  return perms.canAccessTour !== false;
}

export async function fetchSessionDeptPermissions(supabase: SupabaseClient) {
  const { session } = await validateCenterSession(supabase);

  if (!session) {
    return { center: null, permissions: null as DeptPermissionMap | null };
  }

  const center = centerSessionToRecord(session);

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
