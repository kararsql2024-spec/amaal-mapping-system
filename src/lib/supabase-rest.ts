import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = "https://byvzmxrvetgcxstlsszd.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5dnpteHJ2ZXRnY3hzdGxzc3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjU0OTUsImV4cCI6MjA5MDAwMTQ5NX0.Fv3e4bLYBPO94GmU_dT2TG5Ata41eaTgVOcI2iQFl3s";

export const fetchWithRetry = async <T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 1) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return fetchWithRetry(fn, retries - 1, delay * 1.5);
  }
};

/** REST fetch خفيف للحمولات الكبيرة (elements / main_map_config) */
export const fetchNativeSupabase = async (
  path: string,
  signal?: AbortSignal,
) => {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const response = await fetch(url, {
    signal,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Accept: "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
};

export const fetchNativeSupabaseHead = async (
  path: string,
  signal?: AbortSignal,
): Promise<number | null> => {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const response = await fetch(url, {
    signal,
    method: "HEAD",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      Prefer: "count=exact",
    },
  });
  if (!response.ok) return null;
  const range = response.headers.get("content-range");
  if (!range) return null;
  const total = range.split("/")[1];
  return total === "*" ? null : parseInt(total, 10);
};

/** جلب عدد صفوف houses_data لمشروع */
export const fetchProjectUnitsCount = async (
  projectId: string,
  signal?: AbortSignal,
) => {
  const { count, error } = await supabase
    .from("houses_data")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);
  if (error) throw error;
  return count ?? 0;
};

export const UNIT_LIGHT_SELECT =
  "unit_key, project_id, status:data->>status, taboStatus:data->>taboStatus, handoverDate:data->>handoverDate, price:data->>price, currency:data->>currency, saleDate:data->>saleDate";

export const formatLightweightUnits = (
  rows: any[],
): Record<string, any> => {
  const formatted: Record<string, any> = {};
  for (const u of rows) {
    formatted[u.unit_key] = {
      status: u.status || "available",
      taboStatus: u.taboStatus || "غير مروج",
      handoverDate: u.handoverDate || "",
      price: u.price || "",
      currency: u.currency || "IQD",
      saleDate: u.saleDate || "",
      _isLightweight: true,
    };
  }
  return formatted;
};

/** جلب وحدات مشروع على دفعات متوازية */
export const fetchProjectUnitsParallel = async (
  projectId: string,
  signal?: AbortSignal,
  onProgress?: (loaded: number) => void,
): Promise<any[]> => {
  const step = 1000;
  const parallel = 3;

  let total = 0;
  try {
    total = await fetchProjectUnitsCount(projectId, signal);
  } catch {
    total = 0;
  }

  const fetchChunk = async (from: number) => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    const { data, error } = await supabase
      .from("houses_data")
      .select(UNIT_LIGHT_SELECT)
      .eq("project_id", projectId)
      .range(from, from + step - 1);
    if (error) throw error;
    return data ?? [];
  };

  const allUnits: any[] = [];

  if (total > 0) {
    const offsets: number[] = [];
    for (let from = 0; from < total; from += step) {
      offsets.push(from);
    }
    for (let i = 0; i < offsets.length; i += parallel) {
      const batch = offsets.slice(i, i + parallel);
      const chunks = await Promise.all(
        batch.map((from) =>
          fetchWithRetry(() => fetchChunk(from)),
        ),
      );
      for (const chunk of chunks) {
        for (const row of chunk) allUnits.push(row);
      }
      onProgress?.(allUnits.length);
    }
    return allUnits;
  }

  // fallback: لا count — جلب متسلسل
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const chunk = await fetchWithRetry(() => fetchChunk(from));
    if (!chunk.length) break;
    for (const row of chunk) allUnits.push(row);
    onProgress?.(allUnits.length);
    from += chunk.length;
    if (chunk.length < step) hasMore = false;
  }
  return allUnits;
};
