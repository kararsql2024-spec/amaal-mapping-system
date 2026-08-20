/**
 * إعداد bucket map-images عبر REST (بديل لـ SQL Editor)
 * الاستخدام: node scripts/setup-map-storage.mjs
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://byvzmxrvetgcxstlsszd.supabase.co";
const SUPABASE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5dnpteHJ2ZXRnY3hzdGxzc3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjU0OTUsImV4cCI6MjA5MDAwMTQ5NX0.Fv3e4bLYBPO94GmU_dT2TG5Ata41eaTgVOcI2iQFl3s";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
if (listErr) {
  console.error("Cannot list buckets:", listErr.message);
  console.error("Please run database_map_images_storage.sql in Supabase SQL Editor.");
  process.exit(1);
}

const exists = buckets?.some((b) => b.id === "map-images");
if (exists) {
  console.log("Bucket map-images already exists.");
  process.exit(0);
}

const { data, error } = await supabase.storage.createBucket("map-images", {
  public: true,
  fileSizeLimit: 52428800,
  allowedMimeTypes: ["image/webp", "image/png", "image/jpeg", "image/jpg"],
});

if (error) {
  console.error("createBucket failed:", error.message);
  console.error("Run database_map_images_storage.sql manually in Supabase SQL Editor.");
  process.exit(1);
}

console.log("Bucket map-images created:", data);
