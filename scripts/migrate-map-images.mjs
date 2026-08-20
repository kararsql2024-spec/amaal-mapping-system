/**
 * ترحيل صور المخططات المضمّنة (Base64) إلى Supabase Storage
 * الاستخدام: node scripts/migrate-map-images.mjs
 *
 * تأكد من تنفيذ database_map_images_storage.sql في Supabase أولاً.
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://byvzmxrvetgcxstlsszd.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5dnpteHJ2ZXRnY3hzdGxzc3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjU0OTUsImV4cCI6MjA5MDAwMTQ5NX0.Fv3e4bLYBPO94GmU_dT2TG5Ata41eaTgVOcI2iQFl3s";

const BUCKET = "map-images";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const isEmbedded = (el) =>
  el?.type === "reference_image" && typeof el.color === "string" && el.color.startsWith("data:");

const detectImageMeta = (dataUrl) => {
  const declared = (dataUrl.match(/^data:([^;]+);base64,/i)?.[1] || "").toLowerCase();
  if (declared.startsWith("image/")) {
    const ext = declared === "image/jpeg" ? "jpg" : declared.replace("image/", "");
    return { mime: declared, ext: ext === "jpeg" ? "jpg" : ext };
  }
  const comma = dataUrl.indexOf(",");
  const b64 = dataUrl.slice(comma + 1, comma + 32);
  if (b64.startsWith("iVBORw0KGgo")) return { mime: "image/png", ext: "png" };
  if (b64.startsWith("/9j/")) return { mime: "image/jpeg", ext: "jpg" };
  if (b64.startsWith("UklGR")) return { mime: "image/webp", ext: "webp" };
  return { mime: "image/png", ext: "png" };
};

const dataUrlToBytes = (dataUrl) => {
  const comma = dataUrl.indexOf(",");
  const b64 = dataUrl.slice(comma + 1);
  const binary = Buffer.from(b64, "base64");
  return new Uint8Array(binary);
};

const sniffMimeFromBytes = (bytes) => {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: "image/png", ext: "png" };
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: "image/jpeg", ext: "jpg" };
  }
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
    return { mime: "image/webp", ext: "webp" };
  }
  return { mime: "image/png", ext: "png" };
};

const buildPath = (scope, scopeId, elementId, ext) => {
  const safeId = elementId.replace(/[^a-zA-Z0-9_-]/g, "_");
  if (scope === "main-map") return `main-map/${safeId}.${ext}`;
  return `projects/${scopeId}/${safeId}.${ext}`;
};

async function uploadDataUrl(dataUrl, scope, scopeId, elementId) {
  const bytes = dataUrlToBytes(dataUrl);
  const { mime, ext } = sniffMimeFromBytes(bytes);
  const path = buildPath(scope, scopeId, elementId, ext);
  const blob = new Blob([bytes], { type: mime });

  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    upsert: true,
    contentType: mime,
    cacheControl: "31536000",
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function migrateElement(el, scope, scopeId) {
  if (!isEmbedded(el)) return { el, migrated: false };
  const imageUrl = await uploadDataUrl(el.color, scope, scopeId, el.id);
  const { color: _c, ...rest } = el;
  return { el: { ...rest, imageUrl }, migrated: true };
}

async function main() {
  let total = 0;
  let mainCount = 0;
  let projectCount = 0;

  const { data: mainRow, error: mainErr } = await supabase
    .from("settings")
    .select("value")
    .eq("key", "main_map_config")
    .maybeSingle();

  if (mainErr) throw mainErr;

  if (mainRow?.value?.elements) {
    const elements = mainRow.value.elements;
    let changed = false;
    const next = [];
    for (const el of elements) {
      const { el: migrated, migrated: did } = await migrateElement(el, "main-map", "main-map");
      next.push(migrated);
      if (did) {
        changed = true;
        mainCount += 1;
        total += 1;
        console.log(`  ✓ main-map / ${el.id}`);
      }
    }
    if (changed) {
      await supabase.from("settings").upsert([
        { key: "main_map_config", value: { ...mainRow.value, elements: next } },
        { key: "main_map_version", value: Date.now() },
      ]);
      console.log(`Main map: ${mainCount} image(s) migrated`);
    }
  }

  const { data: projects, error: projErr } = await supabase.from("projects").select("id, name, elements");
  if (projErr) throw projErr;

  for (const project of projects ?? []) {
    const elements = project.elements ?? [];
    let changed = false;
    const next = [];
    for (const el of elements) {
      const { el: migrated, migrated: did } = await migrateElement(el, "project", project.id);
      next.push(migrated);
      if (did) {
        changed = true;
        projectCount += 1;
        total += 1;
        console.log(`  ✓ ${project.name} / ${el.id}`);
      }
    }
    if (changed) {
      await supabase.from("projects").update({ elements: next }).eq("id", project.id);
      console.log(`Project "${project.name}": migrated`);
    }
  }

  console.log(`\nDone. Total: ${total} (main: ${mainCount}, projects: ${projectCount})`);
}

main().catch((err) => {
  console.error("Migration failed:", err.message || err);
  process.exit(1);
});
