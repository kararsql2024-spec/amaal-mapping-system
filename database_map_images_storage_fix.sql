-- إصلاح bucket: إزالة قيد MIME (الصور القديمة application/octet-stream)
-- نفّذ هذا في Supabase SQL Editor ثم أعد محاولة «تحويل الصور»

UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'map-images';

-- تأكيد أن bucket عام
UPDATE storage.buckets
SET public = true
WHERE id = 'map-images';
