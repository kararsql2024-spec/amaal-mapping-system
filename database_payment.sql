-- جداول نظام تنظيم آلية الدفعات (دمج مع نظام الخرائط)
-- نفّذ هذا الملف في Supabase SQL Editor

CREATE TABLE IF NOT EXISTS payment_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  unit_key TEXT NOT NULL,
  marketing_center_id TEXT NOT NULL,
  created_by_center_name TEXT,
  client_name TEXT NOT NULL,
  phone1 TEXT NOT NULL,
  phone2 TEXT,
  address TEXT,
  education TEXT,
  unit_type TEXT NOT NULL CHECK (unit_type IN ('house', 'apartment')),
  zone TEXT,
  block TEXT,
  house_type TEXT,
  house_num TEXT,
  building TEXT,
  floor TEXT,
  apartment TEXT,
  total_area TEXT,
  net_area TEXT,
  delivery_period TEXT,
  total_price NUMERIC NOT NULL,
  discovery_method TEXT,
  discovery_relation TEXT,
  discovery_phone TEXT,
  signing_amount NUMERIC NOT NULL,
  housing_condition_amount NUMERIC,
  show_commission_note BOOLEAN DEFAULT true,
  installments JSONB NOT NULL DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES payment_bookings(id) ON DELETE CASCADE,
  marketing_center_id TEXT,
  change_reason TEXT,
  changed_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_bookings_center ON payment_bookings(marketing_center_id);
CREATE INDEX IF NOT EXISTS idx_payment_bookings_project ON payment_bookings(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_bookings_unit ON payment_bookings(unit_key);

ALTER TABLE payment_bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE payment_audit_logs DISABLE ROW LEVEL SECURITY;

-- إذا أنشأت الجداول سابقاً بـ UUID، نفّذ هذا:
-- ALTER TABLE payment_bookings ALTER COLUMN project_id TYPE TEXT USING project_id::text;
-- ALTER TABLE payment_bookings ALTER COLUMN marketing_center_id TYPE TEXT USING marketing_center_id::text;
-- ALTER TABLE payment_audit_logs ALTER COLUMN marketing_center_id TYPE TEXT USING marketing_center_id::text;
