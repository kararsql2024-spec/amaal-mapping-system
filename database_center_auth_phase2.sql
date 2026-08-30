-- المرحلة 2: rate limiting + تسجيل محاولات الدخول
-- نفّذ في Supabase SQL Editor (بعد phase 1 + fix_pgcrypto)

CREATE TABLE IF NOT EXISTS center_login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  center_id UUID REFERENCES marketing_centers(id) ON DELETE SET NULL,
  client_ip INET,
  success BOOLEAN NOT NULL DEFAULT false,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_center_login_attempts_center_time
  ON center_login_attempts(center_id, attempted_at DESC)
  WHERE success = false;

CREATE INDEX IF NOT EXISTS idx_center_login_attempts_ip_time
  ON center_login_attempts(client_ip, attempted_at DESC)
  WHERE success = false;

ALTER TABLE center_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON center_login_attempts FROM anon, authenticated;

CREATE OR REPLACE FUNCTION get_request_client_ip()
RETURNS INET
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers TEXT;
  v_ip TEXT;
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

  v_ip := NULLIF(btrim(split_part((v_headers::json)->>'x-forwarded-for', ',', 1)), '');
  IF v_ip IS NULL THEN
    RETURN NULL;
  END IF;

  BEGIN
    RETURN v_ip::inet;
  EXCEPTION
    WHEN OTHERS THEN
      RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION center_login_purge_old_attempts()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM center_login_attempts
  WHERE attempted_at < now() - interval '7 days';
$$;

CREATE OR REPLACE FUNCTION center_login_check_rate_limit(p_center_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ip INET;
  v_failed_center INT;
  v_failed_ip INT;
  v_oldest TIMESTAMPTZ;
  v_retry INT;
  v_window INTERVAL := interval '15 minutes';
  v_max_center INT := 5;
  v_max_ip INT := 40;
BEGIN
  PERFORM center_login_purge_old_attempts();

  v_ip := get_request_client_ip();

  IF p_center_id IS NOT NULL THEN
    SELECT COUNT(*), MIN(attempted_at)
    INTO v_failed_center, v_oldest
    FROM center_login_attempts
    WHERE center_id = p_center_id
      AND success = false
      AND attempted_at > now() - v_window;

    IF v_failed_center >= v_max_center THEN
      v_retry := GREATEST(1, EXTRACT(EPOCH FROM (v_oldest + v_window - now()))::INT);
      RETURN json_build_object(
        'allowed', false,
        'error', 'too_many_attempts',
        'retry_after_seconds', v_retry
      );
    END IF;
  END IF;

  IF v_ip IS NOT NULL THEN
    SELECT COUNT(*), MIN(attempted_at)
    INTO v_failed_ip, v_oldest
    FROM center_login_attempts
    WHERE client_ip = v_ip
      AND success = false
      AND attempted_at > now() - v_window;

    IF v_failed_ip >= v_max_ip THEN
      v_retry := GREATEST(1, EXTRACT(EPOCH FROM (v_oldest + v_window - now()))::INT);
      RETURN json_build_object(
        'allowed', false,
        'error', 'too_many_attempts',
        'retry_after_seconds', v_retry
      );
    END IF;
  END IF;

  RETURN json_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION center_login_record_attempt(
  p_center_id UUID,
  p_success BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO center_login_attempts (center_id, client_ip, success)
  VALUES (p_center_id, get_request_client_ip(), p_success);
END;
$$;

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

  DELETE FROM center_login_sessions
  WHERE center_id = p_center_id OR expires_at < now();

  v_expires := now() + interval '12 hours';
  INSERT INTO center_login_sessions (center_id, expires_at)
  VALUES (p_center_id, v_expires)
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

CREATE OR REPLACE FUNCTION verify_center_password(p_center_id UUID, p_password TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_center marketing_centers%ROWTYPE;
  v_rate JSON;
BEGIN
  IF p_center_id IS NULL OR COALESCE(btrim(p_password), '') = '' THEN
    RETURN false;
  END IF;

  v_rate := center_login_check_rate_limit(p_center_id);
  IF COALESCE((v_rate->>'allowed')::boolean, false) = false THEN
    RETURN false;
  END IF;

  SELECT * INTO v_center FROM marketing_centers WHERE id = p_center_id;
  IF NOT FOUND THEN
    PERFORM center_login_record_attempt(p_center_id, false);
    RETURN false;
  END IF;

  IF COALESCE(v_center.password_hash, '') <> '' THEN
    IF v_center.password_hash = crypt(p_password, v_center.password_hash) THEN
      PERFORM center_login_record_attempt(p_center_id, true);
      RETURN true;
    END IF;
    PERFORM center_login_record_attempt(p_center_id, false);
    RETURN false;
  END IF;

  IF COALESCE(v_center.password, '') <> '' THEN
    IF v_center.password = p_password THEN
      UPDATE marketing_centers
      SET password_hash = crypt(p_password, gen_salt('bf')),
          password = NULL
      WHERE id = p_center_id;
      PERFORM center_login_record_attempt(p_center_id, true);
      RETURN true;
    END IF;
  END IF;

  PERFORM center_login_record_attempt(p_center_id, false);
  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_center_login(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_center_password(UUID, TEXT) TO anon, authenticated;

-- تحقق (اختياري):
-- SELECT center_login_check_rate_limit('00000000-0000-0000-0000-000000000001'::uuid);
