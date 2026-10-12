-- قوالب جولات الوحدات
-- نفّذ هذا الملف مرة واحدة من SQL Editor في لوحة Supabase
-- القراءة مفتوحة حتى يظهر زر الجولة على الخريطة
-- الكتابة عبر الدالة فقط: جلسة قسم صالحة أو حساب لوحة التحكم

CREATE TABLE IF NOT EXISTS public.tour_templates (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tour_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tour_templates_read ON public.tour_templates;
CREATE POLICY tour_templates_read
ON public.tour_templates
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.tour_templates FROM anon, authenticated;
GRANT SELECT ON public.tour_templates TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_tour_templates(p_session_token UUID, p_tours JSONB)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed BOOLEAN := false;
BEGIN
  IF p_tours IS NULL OR jsonb_typeof(p_tours) <> 'array' THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_payload');
  END IF;

  IF auth.uid() IS NOT NULL THEN
    v_allowed := true;
  ELSIF p_session_token IS NOT NULL AND EXISTS (
    SELECT 1
    FROM center_login_sessions
    WHERE token = p_session_token
      AND expires_at > now()
  ) THEN
    v_allowed := true;
  END IF;

  IF NOT v_allowed THEN
    RETURN json_build_object('ok', false, 'error', 'unauthorized');
  END IF;

  DELETE FROM tour_templates
  WHERE id NOT IN (
    SELECT item->>'id'
    FROM jsonb_array_elements(p_tours) AS item
    WHERE COALESCE(item->>'id', '') <> ''
  );

  INSERT INTO tour_templates (id, payload, updated_at)
  SELECT
    item->>'id',
    item,
    COALESCE(NULLIF(item->>'updatedAt', '')::timestamptz, now())
  FROM jsonb_array_elements(p_tours) AS item
  WHERE COALESCE(item->>'id', '') <> ''
  ON CONFLICT (id) DO UPDATE
  SET payload = EXCLUDED.payload,
      updated_at = EXCLUDED.updated_at;

  RETURN json_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.save_tour_templates(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_tour_templates(UUID, JSONB) TO anon, authenticated;
