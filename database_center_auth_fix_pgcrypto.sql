-- إصلاح سريع: crypt() غير موجود داخل الدوال لأن pgcrypto في schema extensions
-- نفّذ هذا الملف في Supabase SQL Editor (بعد database_center_auth.sql)

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

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
BEGIN
  IF p_center_id IS NULL OR COALESCE(trim(p_password), '') = '' THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  SELECT * INTO v_center FROM marketing_centers WHERE id = p_center_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

  IF COALESCE(v_center.password_hash, '') <> '' THEN
    IF v_center.password_hash <> crypt(p_password, v_center.password_hash) THEN
      RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
    END IF;
  ELSIF COALESCE(v_center.password, '') <> '' THEN
    IF v_center.password <> p_password THEN
      RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
    END IF;
    UPDATE marketing_centers
    SET password_hash = crypt(p_password, gen_salt('bf')),
        password = NULL
    WHERE id = p_center_id;
  ELSE
    RETURN json_build_object('ok', false, 'error', 'invalid_credentials');
  END IF;

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

CREATE OR REPLACE FUNCTION validate_center_session(p_session_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row center_login_sessions%ROWTYPE;
  v_center marketing_centers%ROWTYPE;
BEGIN
  IF p_session_token IS NULL THEN
    RETURN json_build_object('ok', false);
  END IF;

  DELETE FROM center_login_sessions WHERE expires_at < now();

  SELECT * INTO v_row
  FROM center_login_sessions
  WHERE token = p_session_token
    AND expires_at > now();

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false);
  END IF;

  SELECT * INTO v_center FROM marketing_centers WHERE id = v_row.center_id;
  IF NOT FOUND THEN
    DELETE FROM center_login_sessions WHERE token = p_session_token;
    RETURN json_build_object('ok', false);
  END IF;

  RETURN json_build_object(
    'ok', true,
    'session_token', v_row.token,
    'center_id', v_center.id,
    'center_name', v_center.name,
    'center_type', v_center.type,
    'allowed_projects', COALESCE(to_jsonb(v_center.allowed_projects), '[]'::jsonb),
    'expires_at', v_row.expires_at
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
BEGIN
  IF p_center_id IS NULL OR COALESCE(trim(p_password), '') = '' THEN
    RETURN false;
  END IF;

  SELECT * INTO v_center FROM marketing_centers WHERE id = p_center_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF COALESCE(v_center.password_hash, '') <> '' THEN
    RETURN v_center.password_hash = crypt(p_password, v_center.password_hash);
  END IF;

  IF COALESCE(v_center.password, '') <> '' THEN
    IF v_center.password = p_password THEN
      UPDATE marketing_centers
      SET password_hash = crypt(p_password, gen_salt('bf')),
          password = NULL
      WHERE id = p_center_id;
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION hash_marketing_center_password()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.password IS NOT NULL AND btrim(NEW.password) <> '' THEN
    NEW.password_hash := crypt(NEW.password, gen_salt('bf'));
    NEW.password := NULL;
  END IF;
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_center_login(UUID, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION validate_center_session(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION verify_center_password(UUID, TEXT) TO anon, authenticated;
