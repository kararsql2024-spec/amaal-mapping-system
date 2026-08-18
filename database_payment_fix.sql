-- إصلاح جداول الدفعات إذا نُفّذ database_payment.sql سابقاً بأنواع UUID
-- نفّذ هذا الملف في Supabase SQL Editor

ALTER TABLE payment_bookings
  ALTER COLUMN project_id TYPE TEXT USING project_id::text;

ALTER TABLE payment_bookings
  ALTER COLUMN marketing_center_id TYPE TEXT USING marketing_center_id::text;

ALTER TABLE payment_audit_logs
  ALTER COLUMN marketing_center_id TYPE TEXT USING marketing_center_id::text;
