-- إصلاح تحديث كلمة مرور القسم + تتبع الجلسات المفتوحة (IP / الجهاز)
-- نفّذ في Supabase SQL Editor بعد ملفات center_auth

ALTER TABLE center_login_sessions
  ADD COLUMN IF NOT EXISTS client_ip INET,
  ADD COLUMN IF NOT EXISTS user_agent TEXT,
  ADD COLUMN IF NOT EXISTS public_id UUID;

UPDATE center_login_sessions
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;

ALTER TABLE center_login_sessions
  ALTER COLUMN public_id SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_center_login_sessions_public_id
  ON center_login_sessions(public_id);

CREATE OR REPLACE FUNCTION get_request_user_agent()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers TEXT;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true);
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;

  IF v_headers IS NULL OR btrim(v_headers) = '' THEN
    RETURN NULL;
  END IF;

  RETURN NULLIF(btrim((v_headers::json)->>'user-agent'), '');
END;
$$;

CREATE OR REPLACE FUNCTION revoke_center_sessions_on_password_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND (
      NEW.password_hash IS DISTINCT FROM OLD.password_hash
      OR COALESCE(NEW.password, '') IS DISTINCT FROM COALESCE(OLD.password, '')
    ) THEN
    DELETE FROM center_login_sessions WHERE center_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_revoke_center_sessions_on_password_change ON marketing_centers;
CREATE TRIGGER trg_revoke_center_sessions_on_password_change
AFTER UPDATE ON marketing_centers
FOR EACH ROW
EXECUTE FUNCTION revoke_center_sessions_on_password_change();

CREATE OR REPLACE FUNCTION verify_center_login(p_center_id UUID, p_password TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_center marketing_centers%ROWTYPE;
  v_token UUID;
  v_expires TIMESTAMPTZ;
  v_rate JSON;
BEGIN
  IF p_center_id IS NULL OR COALESCE(btrim(p_password), '') = '' THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  v_rate := center_login_check_rate_limit(p_center_id);
  IF COALESCE((v_rate->>'allowed')::boolean, false) = false THEN
    RETURN json_build_object(
      'ok', false,
      'error', COALESCE(v_rate->>'error', 'too_many_attempts'),
      'retry_after_seconds', COALESCE((v_rate->>'retry_after_seconds')::INT, 900)
    );
  END IF;

  SELECT * INTO v_center FROM marketing_centers WHERE id = p_center_id;
  IF NOT FOUND THEN
    PERFORM center_login_record_attempt(p_center_id, false);
    RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  IF COALESCE(v_center.password_hash, '') <> '' THEN
    IF v_center.password_hash <> crypt(p_password, v_center.password_hash) THEN
      PERFORM center_login_record_attempt(p_center_id, false);
      RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
    END IF;
  ELSIF COALESCE(v_center.password, '') <> '' THEN
    IF v_center.password <> p_password THEN
      PERFORM center_login_record_attempt(p_center_id, false);
      RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
    END IF;
    UPDATE marketing_centers
    SET password_hash = crypt(p_password, gen_salt('bf')),
        password = NULL
    WHERE id = p_center_id;
  ELSE
    PERFORM center_login_record_attempt(p_center_id, false);
    RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  PERFORM center_login_record_attempt(p_center_id, true);

  DELETE FROM center_login_sessions WHERE expires_at < now();

  v_expires := now() + interval '12 hours';
  INSERT INTO center_login_sessions (center_id, expires_at, client_ip, user_agent)
  VALUES (p_center_id, v_expires, get_request_client_ip(), get_request_user_agent())
  RETURNING token INTO v_token;

  RETURN json_build_object(
    'ok', true,
    'session_token', v_token,
    'center_id', v_center.id,
    'center_name', v_center.name,
    'center_type', v_center.type,
    'allowed_projects', COALESCE(to_jsonb(v_center.allowed_projects), '[]'::jsonb),
    'expires_at', v_expires
  );
END;
$$;

CREATE OR REPLACE FUNCTION list_open_center_sessions()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM center_login_sessions WHERE expires_at < now();

  RETURN COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', public_id,
        'center_id', center_id,
        'client_ip', host(client_ip),
        'user_agent', user_agent,
        'created_at', created_at,
        'expires_at', expires_at
      )
      ORDER BY created_at DESC
    )
    FROM center_login_sessions
    WHERE expires_at > now()
  ), '[]'::json);
END;
$$;

CREATE OR REPLACE FUNCTION revoke_center_session_admin(p_public_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_public_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM center_login_sessions WHERE public_id = p_public_id;
  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_center_login(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION list_open_center_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_center_session_admin(UUID) TO authenticated;
REVOKE ALL ON FUNCTION list_open_center_sessions() FROM anon;
REVOKE ALL ON FUNCTION revoke_center_session_admin(UUID) FROM anon;
