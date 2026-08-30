-- إزالة كلمات المرور النصية بعد الترحيل إلى password_hash
-- نفّذ في Supabase SQL Editor (بعد database_center_auth.sql + fix_pgcrypto)

-- 1) السماح بـ NULL — العمود كان NOT NULL من الإعداد القديم
ALTER TABLE marketing_centers
  ALTER COLUMN password DROP NOT NULL;

-- 2) مسح النصوص حيث exists hash
UPDATE marketing_centers
SET password = NULL
WHERE password_hash IS NOT NULL
  AND password IS NOT NULL;

-- تحقق
SELECT
  id,
  name,
  password IS NULL AS password_cleared,
  password_hash IS NOT NULL AS has_hash
FROM marketing_centers
ORDER BY name;

-- اختياري لاحقاً (بعد أسبوع استقرار):
-- ALTER TABLE marketing_centers DROP COLUMN IF EXISTS password;
