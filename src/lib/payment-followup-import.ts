import type { MapElement } from "@/types/project";
import { supabase } from "@/integrations/supabase/client";
import { fetchNativeSupabase, fetchWithRetry } from "@/lib/supabase-rest";
import {
  FOLLOWUP_MAPPING_KEY,
  FOLLOWUP_TABLE,
  buildUnitCatalog,
  parseFollowupSheet,
  prepareFollowupImport,
  type CatalogEntry,
  type FollowupMapping,
  type FollowupRecord,
  type RejectedLine,
} from "@/lib/payment-followup";

export const FOLLOWUP_NOTES_TABLE = "payment_followup_notes";

export interface FollowupNote {
  id: string;
  project_id: string;
  unit_key: string;
  body: string;
  center_name: string;
  created_at: string;
}

export const isMissingFollowupTable = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String((error as { message?: string })?.message || error || "");
  return (
    message.includes(FOLLOWUP_TABLE) ||
    message.includes(FOLLOWUP_NOTES_TABLE) ||
    message.includes("schema cache") ||
    message.includes("42P01")
  );
};

export const fetchFollowupNotes = async (projectId: string): Promise<FollowupNote[]> => {
  const all: FollowupNote[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(FOLLOWUP_NOTES_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) throw error;
    const chunk = (data || []) as FollowupNote[];
    all.push(...chunk);
    if (chunk.length < 1000) break;
    from += 1000;
  }
  return all;
};

export const addFollowupNote = async (
  projectId: string,
  unitKey: string,
  body: string,
  centerName: string,
): Promise<FollowupNote> => {
  const { data, error } = await supabase
    .from(FOLLOWUP_NOTES_TABLE)
    .insert({
      project_id: projectId,
      unit_key: unitKey,
      body,
      center_name: centerName,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as FollowupNote;
};

export const fetchFollowupRows = async (projectId: string): Promise<FollowupRecord[]> => {
  const all: FollowupRecord[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from(FOLLOWUP_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .range(from, from + 999);
    if (error) throw error;
    const chunk = (data || []) as FollowupRecord[];
    all.push(...chunk);
    if (chunk.length < 1000) break;
    from += 1000;
  }
  return all;
};

export const loadFollowupCatalog = async (projectId: string): Promise<Map<string, CatalogEntry>> => {
  const [elementRows, unitRows] = await Promise.all([
    fetchWithRetry(() =>
      fetchNativeSupabase(`projects?select=elements&id=eq.${encodeURIComponent(projectId)}`),
    ),
    fetchUnitMeta(projectId),
  ]);
  const elements = (Array.isArray(elementRows) ? elementRows[0]?.elements : []) as MapElement[];
  const units: Record<string, { status?: string; name?: string; phone?: string; saleDate?: string; price?: string; currency?: string }> = {};
  unitRows.forEach((row) => {
    units[row.unit_key] = {
      status: row.status || "available",
      name: row.name || "",
      phone: row.phone || "",
      saleDate: row.saleDate || "",
      price: row.price || "",
      currency: row.currency || "",
    };
  });
  return buildUnitCatalog(elements || [], units);
};

const fetchUnitMeta = async (projectId: string) => {
  const all: { unit_key: string; status?: string; name?: string; phone?: string; saleDate?: string; price?: string; currency?: string }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("houses_data")
      .select("unit_key, status:data->>status, name:data->>name, phone:data->>phone, saleDate:data->>saleDate, price:data->>price, currency:data->>currency")
      .eq("project_id", projectId)
      .range(from, from + 999);
    if (error) throw error;
    const chunk = data || [];
    all.push(...chunk);
    if (chunk.length < 1000) break;
    from += 1000;
  }
  return all;
};

const columnLine = (mapping: FollowupMapping): string =>
  [
    `الوحدة ${mapping.unitCol}`,
    `المالك ${mapping.ownerCol}`,
    `الهاتف ${mapping.phoneCol}`,
    `العقد ${mapping.contractCol}`,
    `السعر ${mapping.salePriceCol}`,
    `العملة ${mapping.currencyCol}`,
    `البيع ${mapping.saleDateCol}`,
    `الاستحقاق ${mapping.dueDateCol}`,
    `الدفعة ${mapping.installmentCol}`,
    `الواصل ${mapping.receivedCol}`,
  ].join(" · ");

const logGroups = (rows: RejectedLine[], onLog: (line: string) => void) => {
  const groups = new Map<string, RejectedLine[]>();
  rows.forEach((row) => {
    const list = groups.get(row.reason) || [];
    list.push(row);
    groups.set(row.reason, list);
  });
  groups.forEach((list, reason) => {
    const units = Array.from(new Set(list.map((row) => row.unitLabel || "بدون رقم")));
    onLog(`${reason}: ${list.length} صفاً ضمن ${units.length} وحدة`);
    const shown = units.slice(0, 12).join("، ");
    const rest = units.length > 12 ? ` … و${units.length - 12} غيرها` : "";
    onLog(`← ${shown}${rest}`);
  });
};

export const importFollowupWorkbook = async ({
  file,
  projectId,
  projectName,
  mapping,
  onLog,
}: {
  file: File;
  projectId: string;
  projectName: string;
  mapping: FollowupMapping;
  onLog: (line: string) => void;
}): Promise<{ rejected: RejectedLine[]; stored: boolean }> => {
  onLog(`قراءة «${file.name}» لمشروع ${projectName}`);
  onLog(`الأعمدة: ${columnLine(mapping)}`);
  const { error: mappingError } = await supabase.from("settings").upsert({
    key: FOLLOWUP_MAPPING_KEY,
    value: mapping,
  });
  onLog(mappingError ? "تعذر حفظ الأعمدة، وستُستخدم الظاهرة في هذه القراءة فقط" : "حُفظت الأعمدة الظاهرة قبل القراءة");

  const XLSX = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const book = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = book.SheetNames[0];
  const table = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[sheetName], {
    header: "A",
    defval: "",
    raw: true,
  });
  onLog(`الورقة «${sheetName}» وفيها ${Math.max(table.length - 1, 0)} صفاً تحت العنوان`);

  onLog("جلب مخطط المشروع وحالات الوحدات للمطابقة");
  const catalog = await loadFollowupCatalog(projectId);
  let houses = 0;
  let apartments = 0;
  catalog.forEach((entry) => {
    if (entry.kind === "house") houses += 1;
    else apartments += 1;
  });
  onLog(`فهرس المشروع: ${houses} منزلاً و${apartments} شقة`);

  const parsed = parseFollowupSheet(table, mapping);
  onLog(`صفوف فيها بيانات: ${parsed.lines.length + parsed.rejected.length}`);
  if (parsed.rejected.length) logGroups(parsed.rejected, onLog);

  const prepared = prepareFollowupImport(parsed.lines, catalog, projectId);
  const rejected = [...parsed.rejected, ...prepared.rejected];
  const acceptedUnits = new Set(prepared.accepted.map((row) => row.unit_key));
  onLog(`نتيجة المطابقة: ${acceptedUnits.size} وحدة مقبولة و${prepared.accepted.length} دفعة`);
  if (prepared.rejected.length) logGroups(prepared.rejected, onLog);

  const iqd = prepared.accepted.filter((row) => row.currency === "IQD").length;
  const usd = prepared.accepted.filter((row) => row.currency === "USD").length;
  if (prepared.accepted.length) onLog(`دفعات مقبولة: ${iqd} بالدينار و${usd} بالدولار`);

  if (prepared.accepted.length === 0) {
    onLog("لم تُقبل أي دفعة. لقطة المشروع السابقة بقيت كما هي");
    return { rejected, stored: false };
  }

  const importId = crypto.randomUUID();
  const payload = prepared.accepted.map((row) => ({ ...row, import_id: importId }));
  try {
    for (let index = 0; index < payload.length; index += 400) {
      const chunk = payload.slice(index, index + 400);
      onLog(`حفظ الدفعات ${index + 1}–${index + chunk.length}`);
      const { error } = await supabase.from(FOLLOWUP_TABLE).insert(chunk);
      if (error) throw error;
    }
    onLog("حذف لقطة المشروع السابقة");
    const { error: deleteError } = await supabase
      .from(FOLLOWUP_TABLE)
      .delete()
      .eq("project_id", projectId)
      .neq("import_id", importId);
    if (deleteError) throw deleteError;
  } catch (error) {
    onLog("فشل الحفظ. التراجع عن الدفعة الجديدة حتى لا تختلط بالقديمة");
    await supabase.from(FOLLOWUP_TABLE).delete().eq("import_id", importId);
    throw error;
  }

  onLog(`اكتمل التحديث: ${acceptedUnits.size} وحدة و${prepared.accepted.length} دفعة، وأُهمل ${rejected.length} صفاً`);
  return { rejected, stored: true };
};
