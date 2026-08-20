import { supabase } from "@/integrations/supabase/client";
import type { MapElement } from "@/types/project";

export const MAP_IMAGES_BUCKET = "map-images";

export type MapImageScope = "main-map" | "project";

/** مصدر عرض الصورة المرجعية — يدعم imageUrl الجديد و color القديم (Base64/HTTP) */
export const getReferenceImageSrc = (el: MapElement): string | null => {
  if (el.type !== "reference_image") return null;
  if (el.imageUrl) return el.imageUrl;
  if (
    el.color &&
    (el.color.startsWith("data:") || el.color.startsWith("http"))
  ) {
    return el.color;
  }
  return null;
};

export const isEmbeddedReferenceImage = (el: MapElement): boolean =>
  el.type === "reference_image" && !!el.color?.startsWith("data:");

const extensionFromMime = (mime: string): string => {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "webp";
};

/** يكتشف نوع الصورة من بايتات الملف (أدق من data URL header) */
const sniffMimeFromBytes = (bytes: Uint8Array): { mime: string; ext: string } => {
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return { mime: "image/png", ext: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: "image/webp", ext: "webp" };
  }
  return { mime: "image/png", ext: "png" };
};

/** يكتشف نوع الصورة الحقيقي — الصور القديمة مخزّنة أحياناً كـ application/octet-stream */
const detectImageMetaFromDataUrl = (
  dataUrl: string,
): { mime: string; ext: string } => {
  const headerMatch = dataUrl.match(/^data:([^;]+);base64,/i);
  const declared = headerMatch?.[1]?.toLowerCase() ?? "";

  if (declared.startsWith("image/")) {
    return { mime: declared, ext: extensionFromMime(declared) };
  }

  const comma = dataUrl.indexOf(",");
  const base64Start = dataUrl.slice(comma + 1, comma + 32);
  if (base64Start.startsWith("iVBORw0KGgo")) {
    return { mime: "image/png", ext: "png" };
  }
  if (base64Start.startsWith("/9j/")) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (base64Start.startsWith("UklGR")) {
    return { mime: "image/webp", ext: "webp" };
  }

  return { mime: "image/png", ext: "png" };
};

const dataUrlToBytes = (dataUrl: string): Uint8Array => {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Invalid data URL");
  const b64 = dataUrl.slice(comma + 1);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

const normalizeImageMime = (mime: string | undefined, ext: string): string => {
  if (mime && mime.startsWith("image/") && mime !== "application/octet-stream") {
    return mime;
  }
  if (ext === "jpg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return "image/png";
};

const extensionFromFile = (file: File): string => {
  if (file.type) return extensionFromMime(file.type);
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext === "jpeg") return "jpg";
  if (ext && ["webp", "png", "jpg"].includes(ext)) return ext;
  return "webp";
};

const extensionFromDataUrl = (dataUrl: string): string =>
  detectImageMetaFromDataUrl(dataUrl).ext;

export const buildMapImageStoragePath = (
  scope: MapImageScope,
  scopeId: string,
  elementId: string,
  ext: string,
): string => {
  const safeId = elementId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (scope === "main-map") return `main-map/${safeId}.${ext}`;
  return `projects/${scopeId}/${safeId}.${ext}`;
};

export const uploadMapImageFile = async (
  file: File,
  scope: MapImageScope,
  scopeId: string,
  elementId: string,
): Promise<string> => {
  const ext = extensionFromFile(file);
  const path = buildMapImageStoragePath(scope, scopeId, elementId, ext);
  const contentType = normalizeImageMime(file.type, ext);
  const body =
    file.type === "application/octet-stream" || !file.type
      ? new Blob([await file.arrayBuffer()], { type: contentType })
      : file;

  const { error } = await supabase.storage
    .from(MAP_IMAGES_BUCKET)
    .upload(path, body, {
      upsert: true,
      contentType,
      cacheControl: "31536000",
    });

  if (error) throw error;

  const { data } = supabase.storage.from(MAP_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

export const uploadMapImageDataUrl = async (
  dataUrl: string,
  scope: MapImageScope,
  scopeId: string,
  elementId: string,
): Promise<string> => {
  const bytes = dataUrlToBytes(dataUrl);
  const sniffed = sniffMimeFromBytes(bytes);
  const fallback = detectImageMetaFromDataUrl(dataUrl);
  const ext = sniffed.ext || fallback.ext;
  const mime = sniffed.mime || fallback.mime;
  const path = buildMapImageStoragePath(scope, scopeId, elementId, ext);
  const body = new Blob([bytes], { type: mime });

  const { error } = await supabase.storage.from(MAP_IMAGES_BUCKET).upload(path, body, {
    upsert: true,
    contentType: mime,
    cacheControl: "31536000",
  });

  if (error) throw error;

  const { data } = supabase.storage.from(MAP_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

/** اختبار سريع أن bucket map-images يقبل الرفع */
export const verifyMapImagesStorageReady = async (): Promise<{
  ok: boolean;
  message: string;
}> => {
  const probe = new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const path = `_diagnose/probe-${Date.now()}.png`;

  const { error } = await supabase.storage.from(MAP_IMAGES_BUCKET).upload(path, probe, {
    upsert: true,
    contentType: "image/png",
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  await supabase.storage.from(MAP_IMAGES_BUCKET).remove([path]);
  return { ok: true, message: "Storage جاهز" };
};

/** يرفع أي صورة Base64 متبقية ويُرجع عناصر جاهزة للحفظ (بدون Base64 في color) */
export const prepareElementsForSave = async (
  elements: MapElement[],
  scope: MapImageScope,
  scopeId: string,
): Promise<MapElement[]> => {
  const prepared: MapElement[] = [];

  for (const el of elements) {
    if (!isEmbeddedReferenceImage(el)) {
      prepared.push(el);
      continue;
    }

    const imageUrl = await uploadMapImageDataUrl(
      el.color!,
      scope,
      scopeId,
      el.id,
    );

    const { color: _removed, ...rest } = el;
    prepared.push({ ...rest, imageUrl });
  }

  return prepared;
};

export const migrateReferenceImageElement = async (
  el: MapElement,
  scope: MapImageScope,
  scopeId: string,
): Promise<MapElement> => {
  if (!isEmbeddedReferenceImage(el)) return el;

  const imageUrl = await uploadMapImageDataUrl(el.color!, scope, scopeId, el.id);
  const { color: _removed, ...rest } = el;
  return { ...rest, imageUrl };
};

export interface MapImageMigrationResult {
  mainMapMigrated: number;
  projectsMigrated: number;
  totalImages: number;
}

export interface EmbeddedMapImageScan {
  mainMapCount: number;
  projectCounts: { projectId: string; projectName: string; count: number }[];
  total: number;
}

/** فحص عدد الصور المضمّنة (Base64) في قاعدة البيانات — بدون رفع أو تعديل */
export const scanEmbeddedMapImages = async (): Promise<EmbeddedMapImageScan> => {
  let mainMapCount = 0;
  const projectCounts: EmbeddedMapImageScan["projectCounts"] = [];

  const { data: mainMapRow } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "main_map_config")
    .maybeSingle();

  if (mainMapRow?.value?.elements) {
    for (const el of mainMapRow.value.elements as MapElement[]) {
      if (isEmbeddedReferenceImage(el)) mainMapCount += 1;
    }
  }

  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id, name, elements");

  if (projErr) throw projErr;

  for (const project of projects ?? []) {
    let count = 0;
    for (const el of (project.elements ?? []) as MapElement[]) {
      if (isEmbeddedReferenceImage(el)) count += 1;
    }
    if (count > 0) {
      projectCounts.push({
        projectId: project.id,
        projectName: project.name ?? project.id,
        count,
      });
    }
  }

  const projectsTotal = projectCounts.reduce((sum, p) => sum + p.count, 0);
  return {
    mainMapCount,
    projectCounts,
    total: mainMapCount + projectsTotal,
  };
};

/** ترحيل كل الصور المضمّنة (Base64) إلى Storage */
export const migrateAllEmbeddedMapImages = async (): Promise<MapImageMigrationResult> => {
  let mainMapMigrated = 0;
  let projectsMigrated = 0;

  const { data: mainMapRow, error: mainErr } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "main_map_config")
    .maybeSingle();

  if (mainErr) throw mainErr;

  if (mainMapRow?.value?.elements) {
    const elements = mainMapRow.value.elements as MapElement[];
    let changed = false;
    const migratedElements: MapElement[] = [];

    for (const el of elements) {
      if (isEmbeddedReferenceImage(el)) {
        migratedElements.push(
          await migrateReferenceImageElement(el, "main-map", "main-map"),
        );
        mainMapMigrated += 1;
        changed = true;
      } else {
        migratedElements.push(el);
      }
    }

    if (changed) {
      const config = { ...mainMapRow.value, elements: migratedElements };
      const { error: saveErr } = await supabase.from("settings").upsert([
        { key: "main_map_config", value: config },
        { key: "main_map_version", value: Date.now() },
      ]);
      if (saveErr) throw saveErr;
    }
  }

  const { data: projects, error: projErr } = await supabase
    .from("projects")
    .select("id, elements");

  if (projErr) throw projErr;

  for (const project of projects ?? []) {
    const elements = (project.elements ?? []) as MapElement[];
    let changed = false;
    const migratedElements: MapElement[] = [];

    for (const el of elements) {
      if (isEmbeddedReferenceImage(el)) {
        migratedElements.push(
          await migrateReferenceImageElement(el, "project", project.id),
        );
        projectsMigrated += 1;
        changed = true;
      } else {
        migratedElements.push(el);
      }
    }

    if (changed) {
      const { error: saveErr } = await supabase
        .from("projects")
        .update({ elements: migratedElements })
        .eq("id", project.id);
      if (saveErr) throw saveErr;
    }
  }

  return {
    mainMapMigrated,
    projectsMigrated,
    totalImages: mainMapMigrated + projectsMigrated,
  };
};
