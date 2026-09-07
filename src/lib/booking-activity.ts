import { supabase } from "@/integrations/supabase/client";
import type { MapElement } from "@/types/project";

export const BOOKING_WINDOW_DAYS = 7;
export const ALERT_WITHIN_DAYS = 2;
export const RECENT_BOOKINGS_LIMIT = 30;

export type BookingAlertKind = "expired" | "expiring";

export type BookingActivityItem = {
  key: string;
  label: string;
  projectId?: string;
  status: string;
  saleDate: string;
  saleTime: number;
  name?: string;
  daysLeft: number | null;
  kind?: BookingAlertKind;
  data: Record<string, any>;
};

const startOfLocalDay = (date: Date) =>
  Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());

export const bookingDaysLeft = (saleDate: string, now = new Date()): number | null => {
  const parsed = Date.parse(saleDate);
  if (!Number.isFinite(parsed)) return null;
  const booked = new Date(parsed);
  const elapsed = Math.floor((startOfLocalDay(now) - startOfLocalDay(booked)) / 86_400_000);
  return BOOKING_WINDOW_DAYS - elapsed;
};

const forEachProjectUnit = (
  elements: MapElement[],
  units: Record<string, any>,
  visit: (key: string, label: string, data: any) => void,
) => {
  elements.forEach((el) => {
    if (el.type === "house") {
      visit(el.id, el.label, units[el.id]);
      return;
    }
    if (el.type !== "tower") return;

    const floors = el.floors || 0;
    const aptsPerFloor = el.apartmentsPerFloor || 0;
    let visibleIndex = 0;

    for (let floor = 1; floor <= floors; floor += 1) {
      for (let apt = 1; apt <= aptsPerFloor; apt += 1) {
        const key = `${el.id}_F${floor}_A${apt}`;
        const data = units[key];
        const frozen =
          data?.status === "frozen_uncounted" || data?.status === "frozen_hidden";
        if (!frozen) visibleIndex += 1;
        const floorCode = floor === 1 ? "FG" : `F${floor - 1}`;
        const aptCode = frozen ? "مجمدة" : `P${visibleIndex}`;
        visit(key, `${el.label}-${floorCode}-${aptCode}`, data);
      }
    }
  });
};

const toItem = (
  key: string,
  label: string,
  data: any,
  now: Date,
  projectId?: string,
): BookingActivityItem | null => {
  const saleDate = String(data?.saleDate || "").trim();
  if (!saleDate) return null;
  const saleTime = Date.parse(saleDate);
  if (!Number.isFinite(saleTime)) return null;
  const status = data.status || "available";
  const daysLeft = status === "pending" ? bookingDaysLeft(saleDate, now) : null;
  return {
    key,
    label,
    projectId,
    status,
    saleDate,
    saleTime,
    name: data.name || "",
    daysLeft,
    kind:
      status === "pending" && daysLeft !== null && daysLeft < 0
        ? "expired"
        : status === "pending" && daysLeft !== null && daysLeft <= ALERT_WITHIN_DAYS
          ? "expiring"
          : undefined,
    data,
  };
};

export const collectProjectBookingActivity = (
  elements: MapElement[],
  units: Record<string, any>,
  now = new Date(),
) => {
  const alerts: BookingActivityItem[] = [];
  const recent: BookingActivityItem[] = [];

  forEachProjectUnit(elements, units, (key, label, data) => {
    const item = toItem(key, label, data, now);
    if (!item) return;
    if (item.kind) alerts.push(item);
    if (item.status === "pending" || item.status === "reserved" || item.status === "sold") {
      recent.push(item);
    }
  });

  alerts.sort((a, b) => (a.daysLeft ?? 0) - (b.daysLeft ?? 0));
  recent.sort((a, b) => b.saleTime - a.saleTime);

  return {
    alerts,
    recent: recent.slice(0, RECENT_BOOKINGS_LIMIT),
  };
};

export const sortRecentBookingRows = (
  rows: Array<Record<string, any>>,
  limit = RECENT_BOOKINGS_LIMIT,
): BookingActivityItem[] => {
  return rows
    .map((row) => {
      const item = toItem(
        row.unit_key,
        row.unit_key,
        { status: row.status, saleDate: row.saleDate, name: row.name },
        new Date(),
        row.project_id,
      );
      return item;
    })
    .filter((item): item is BookingActivityItem => !!item)
    .sort((a, b) => b.saleTime - a.saleTime)
    .slice(0, limit);
};

export const fetchCityRecentBookings = async (projectIds: string[]) => {
  if (projectIds.length === 0) return [] as BookingActivityItem[];

  const { data, error } = await supabase
    .from("houses_data")
    .select("unit_key, project_id, status:data->>status, saleDate:data->>saleDate, name:data->>name")
    .in("project_id", projectIds)
    .or("data->>status.eq.pending,data->>status.eq.reserved")
    .limit(200);

  if (error) throw error;
  return sortRecentBookingRows(data || []);
};
