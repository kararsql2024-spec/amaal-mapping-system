-- إنهاء جلسة قسم محددة من لوحة الإدارة
-- نفّذ في Supabase SQL Editor بعد database_center_sessions_admin.sql

ALTER TABLE center_login_sessions
  ADD COLUMN IF NOT EXISTS public_id UUID;

UPDATE center_login_sessions
SET public_id = gen_random_uuid()
WHERE public_id IS NULL;

ALTER TABLE center_login_sessions
  ALTER COLUMN public_id SET DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_center_login_sessions_public_id
  ON center_login_sessions(public_id);

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

GRANT EXECUTE ON FUNCTION list_open_center_sessions() TO authenticated;
GRANT EXECUTE ON FUNCTION revoke_center_session_admin(UUID) TO authenticated;
REVOKE ALL ON FUNCTION list_open_center_sessions() FROM anon;
REVOKE ALL ON FUNCTION revoke_center_session_admin(UUID) FROM anon;
