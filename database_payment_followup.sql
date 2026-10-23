-- متابعة المبالغ المتبقية. نفّذ هذا الملف مرة واحدة في Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS payment_followup_rows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  import_id TEXT NOT NULL,
  unit_key TEXT NOT NULL,
  unit_label TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  contract_no TEXT,
  currency TEXT NOT NULL,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  sale_date TEXT,
  due_date TEXT,
  installment_amount NUMERIC NOT NULL DEFAULT 0,
  received_amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_followup_project ON payment_followup_rows(project_id);
CREATE INDEX IF NOT EXISTS idx_payment_followup_import ON payment_followup_rows(import_id);

ALTER TABLE payment_followup_rows DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS payment_followup_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id TEXT NOT NULL,
  unit_key TEXT NOT NULL,
  body TEXT NOT NULL,
  center_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_followup_notes_unit
  ON payment_followup_notes(project_id, unit_key);

ALTER TABLE payment_followup_notes DISABLE ROW LEVEL SECURITY;
