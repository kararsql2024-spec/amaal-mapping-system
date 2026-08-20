import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://byvzmxrvetgcxstlsszd.supabase.co";
const KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5dnpteHJ2ZXRnY3hzdGxzc3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjU0OTUsImV4cCI6MjA5MDAwMTQ5NX0.Fv3e4bLYBPO94GmU_dT2TG5Ata41eaTgVOcI2iQFl3s";

const supabase = createClient(SUPABASE_URL, KEY);

console.log("=== 1. List buckets ===");
const { data: buckets, error: bErr } = await supabase.storage.listBuckets();
console.log("error:", bErr?.message || "none");
console.log("buckets:", buckets?.map((b) => ({ id: b.id, public: b.public })));

console.log("\n=== 2. Tiny upload test (direct to map-images) ===");
const tinyWebp = Buffer.from(
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AAAAAA",
  "base64",
);
const path = `_diagnose/test-${Date.now()}.webp`;
const { data: up, error: upErr } = await supabase.storage
  .from("map-images")
  .upload(path, tinyWebp, {
    upsert: true,
    contentType: "image/webp",
  });
console.log("upload error:", upErr?.message || "none", upErr?.statusCode, upErr);
console.log("upload data:", up);

console.log("\n=== 3. Fetch main map embedded image header ===");
const { data: row, error: rowErr } = await supabase
  .from("settings")
  .select("value")
  .eq("key", "main_map_config")
  .maybeSingle();
if (rowErr) console.log("settings error:", rowErr.message);
else {
  const els = row?.value?.elements || [];
  const ref = els.find((e) => e.type === "reference_image" && e.color?.startsWith("data:"));
  if (ref) {
    const header = ref.color.slice(0, 80);
    console.log("ref id:", ref.id, "header:", header);
    const blob = await (await fetch(ref.color)).blob();
    console.log("blob size KB:", Math.round(blob.size / 1024), "type:", blob.type || "(empty)");
  } else {
    console.log("no embedded ref in main map");
  }
}

if (up?.path) {
  await supabase.storage.from("map-images").remove([path]);
}
