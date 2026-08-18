import type { SupabaseClient } from "@supabase/supabase-js";

export type CenterSubscriptionStatus = "active" | "expired" | "suspended";

export interface CenterSubscription {
  subscription_start?: string;
  subscription_end?: string;
  subscription_status?: CenterSubscriptionStatus;
  subscription_notes?: string;
}

export type CenterSubscriptions = Record<string, CenterSubscription>;

export const CENTER_SUBSCRIPTION_SETTINGS_KEY = "center_subscriptions";

export const SUBSCRIPTION_WARNING_DAYS = 7;

export const emptyCenterSubscription = (): CenterSubscription => ({
  subscription_start: "",
  subscription_end: "",
  subscription_status: "active",
  subscription_notes: "",
});

export async function fetchCenterSubscriptions(
  supabase: SupabaseClient,
): Promise<CenterSubscriptions> {
  const { data } = await supabase
    .from("settings")
    .select("value")
    .eq("key", CENTER_SUBSCRIPTION_SETTINGS_KEY)
    .maybeSingle();

  const value = data?.value;
  return value && typeof value === "object" ? (value as CenterSubscriptions) : {};
}

export async function saveCenterSubscription(
  supabase: SupabaseClient,
  centerId: string,
  subscription: CenterSubscription,
  existing?: CenterSubscriptions,
): Promise<void> {
  const current = existing ?? (await fetchCenterSubscriptions(supabase));
  const updated: CenterSubscriptions = {
    ...current,
    [centerId]: {
      subscription_start: subscription.subscription_start?.trim() || "",
      subscription_end: subscription.subscription_end?.trim() || "",
      subscription_status: subscription.subscription_status || "active",
      subscription_notes: subscription.subscription_notes?.trim() || "",
    },
  };

  const { error } = await supabase
    .from("settings")
    .upsert({ key: CENTER_SUBSCRIPTION_SETTINGS_KEY, value: updated });

  if (error) throw error;
}

export async function deleteCenterSubscription(
  supabase: SupabaseClient,
  centerId: string,
  existing?: CenterSubscriptions,
): Promise<void> {
  const current = existing ?? (await fetchCenterSubscriptions(supabase));
  if (!(centerId in current)) return;

  const updated = { ...current };
  delete updated[centerId];

  const { error } = await supabase
    .from("settings")
    .upsert({ key: CENTER_SUBSCRIPTION_SETTINGS_KEY, value: updated });

  if (error) throw error;
}

export function getCenterSubscription(
  subscriptions: CenterSubscriptions,
  centerId?: string | null,
): CenterSubscription {
  if (!centerId) return emptyCenterSubscription();
  return subscriptions[centerId] ?? emptyCenterSubscription();
}

function parseDateOnly(value: string): Date | null {
  if (!value?.trim()) return null;
  const [year, month, day] = value.trim().split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
}

function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function hasSubscriptionWindow(subscription?: CenterSubscription): boolean {
  return Boolean(subscription?.subscription_end?.trim());
}

export interface SubscriptionAccessResult {
  allowed: boolean;
  reason?: "expired" | "suspended" | "not_started";
  warning?: {
    daysRemaining: number;
    endDate: string;
  };
}

export function evaluateCenterSubscription(
  subscription?: CenterSubscription,
  now = new Date(),
): SubscriptionAccessResult {
  if (!hasSubscriptionWindow(subscription)) {
    return { allowed: true };
  }

  if (subscription?.subscription_status === "suspended") {
    return { allowed: false, reason: "suspended" };
  }

  const start = parseDateOnly(subscription?.subscription_start || "");
  const end = parseDateOnly(subscription?.subscription_end || "");

  if (!end) {
    return { allowed: true };
  }

  if (start && now < startOfDay(start)) {
    return { allowed: false, reason: "not_started" };
  }

  if (now > endOfDay(end)) {
    return { allowed: false, reason: "expired" };
  }

  const msRemaining = endOfDay(end).getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));

  if (daysRemaining <= SUBSCRIPTION_WARNING_DAYS) {
    return {
      allowed: true,
      warning: {
        daysRemaining,
        endDate: subscription?.subscription_end || "",
      },
    };
  }

  return { allowed: true };
}

export function formatSubscriptionDate(value: string): string {
  const date = parseDateOnly(value);
  if (!date) return value;
  return date.toLocaleDateString("ar-EG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function addDaysToDateString(base: Date, days: number): string {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  const year = next.getFullYear();
  const month = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getSubscriptionStatusLabel(subscription?: CenterSubscription): string {
  const access = evaluateCenterSubscription(subscription);
  if (!hasSubscriptionWindow(subscription)) return "بدون حد";
  if (!access.allowed) {
    if (access.reason === "suspended") return "معلّق";
    if (access.reason === "not_started") return "لم يبدأ";
    return "منتهي";
  }
  if (access.warning) return `ينتهي خلال ${access.warning.daysRemaining} يوم`;
  return "نشط";
}
