import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStoredCenterSessionToken } from "@/lib/center-auth";
import type { TourTemplate } from "./types";

const KEY = "amaal-tour-templates-v1";

export type TourLoad = {
  tours: TourTemplate[];
  source: "database" | "local";
  pendingUpload: boolean;
};

export type TourSave = {
  ok: boolean;
  where: "database" | "local";
};

let cache: TourTemplate[] = [];
let loaded = false;
let loadPromise: Promise<TourLoad> | null = null;
const listeners = new Set<(tours: TourTemplate[]) => void>();

const notify = () => {
  listeners.forEach((listener) => listener(cache));
};

export const subscribeTours = (listener: (tours: TourTemplate[]) => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const normalize = (tour: TourTemplate): TourTemplate => {
  const listed = Array.isArray(tour.projectIds) ? tour.projectIds.map((id) => String(id || "").trim()).filter(Boolean) : [];
  const projectIds = Array.from(new Set(listed.length ? listed : tour.projectId ? [tour.projectId] : []));
  return {
  ...tour,
  projectId: projectIds[0] || "",
  projectIds,
  unitKey: tour.unitKey || "",
  unitLabel: tour.unitLabel || "",
  grid: tour.grid !== false,
  plans: tour.plans || {},
  walls: tour.walls || [],
  openings: tour.openings || [],
  items: (tour.items || [])
    .filter((item) => item.kind === "room" || item.kind === "balcony" || item.kind === "furniture" || item.kind === "hotspot" || item.kind === "stairs" || item.kind === "text")
    .map((item) => {
      const legacy = item as typeof item & { turn?: number };
      const rot = typeof item.rot === "number" ? item.rot : typeof legacy.turn === "number" ? legacy.turn * 90 : 0;
      return { ...item, rot, scale: item.scale || 1, note: item.note || "" };
    }),
  };
};

const readLocal = (): TourTemplate[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TourTemplate[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalize);
  } catch {
    return [];
  }
};

const writeLocal = (tours: TourTemplate[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(tours));
    return true;
  } catch {
    return false;
  }
};

const sessionToken = () => {
  const token = getStoredCenterSessionToken();
  return token && /^[0-9a-f-]{36}$/i.test(token) ? token : null;
};

export const ensureTours = (): Promise<TourLoad> => {
  if (loaded) return Promise.resolve({ tours: cache, source: "database", pendingUpload: false });
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const local = readLocal();
    const { data, error } = await supabase.from("tour_templates").select("payload");
    if (error) {
      cache = local;
      loaded = true;
      notify();
      return { tours: cache, source: "local" as const, pendingUpload: local.length > 0 };
    }
    const remote = ((data || []) as { payload: TourTemplate }[])
      .map((row) => (row?.payload ? normalize(row.payload) : null))
      .filter((tour): tour is TourTemplate => Boolean(tour?.id));
    if (remote.length === 0 && local.length > 0) {
      cache = local;
      loaded = true;
      notify();
      return { tours: cache, source: "local", pendingUpload: true };
    }
    cache = remote;
    writeLocal(remote);
    loaded = true;
    notify();
    return { tours: cache, source: "database", pendingUpload: false };
  })().finally(() => {
    loadPromise = null;
  });
  return loadPromise;
};

export const loadTours = (): TourTemplate[] => (cache.length ? cache : readLocal());

export const loadTour = (id: string) => loadTours().find((tour) => tour.id === id) || null;

export const useTourTemplates = () => {
  const [tours, setTours] = useState<TourTemplate[]>(() => loadTours());
  useEffect(() => {
    let cancel = false;
    ensureTours().then((result) => {
      if (!cancel) setTours(result.tours);
    });
    return subscribeTours((next) => {
      if (!cancel) setTours(next);
    });
  }, []);
  return tours;
};

/** يكتب كل القوالب. زر الحفظ هو المستدعي الوحيد. */
export const saveTours = async (tours: TourTemplate[]): Promise<TourSave> => {
  const next = tours.map(normalize);
  cache = next;
  loaded = true;
  const localOk = writeLocal(next);
  notify();
  const { data, error } = await supabase.rpc("save_tour_templates", {
    p_session_token: sessionToken(),
    p_tours: next,
  });
  const payload = (data || null) as { ok?: boolean } | null;
  if (error || payload?.ok === false) return { ok: localOk, where: "local" };
  return { ok: true, where: "database" };
};

export const shrinkPlanImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const limit = 1200;
      const scale = Math.min(1, limit / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error("canvas"));
        return;
      }
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.68));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image"));
    };
    image.src = url;
  });
