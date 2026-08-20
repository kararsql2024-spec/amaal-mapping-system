-- Supabase Storage: bucket لصور مخططات المدينة والمشاريع
-- نفّذ هذا الملف مرة واحدة من SQL Editor في لوحة Supabase

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'map-images',
  'map-images',
  true,
  52428800,
  ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/jpg']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = NULL;

DROP POLICY IF EXISTS "map_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "map_images_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "map_images_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "map_images_anon_delete" ON storage.objects;

CREATE POLICY "map_images_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'map-images');

CREATE POLICY "map_images_anon_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'map-images');

CREATE POLICY "map_images_anon_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'map-images');

CREATE POLICY "map_images_anon_delete"
ON storage.objects FOR DELETE
USING (bucket_id = 'map-images');
