import type { SupabaseClient } from "@supabase/supabase-js";

export const CENTER_SESSION_TOKEN_KEY = "marketing_center_session_token";
export const CENTER_SESSION_ID_KEY = "marketing_center_session";
export const CENTER_SESSION_NAME_KEY = "marketing_center_name";
const LEGACY_CENTER_PASSWORD_KEY = "marketing_center_password";

export interface CenterPublicInfo {
  id: string;
  name: string;
  type: string;
  allowed_projects?: string[];
}

export interface CenterSessionInfo extends CenterPublicInfo {
  sessionToken: string;
  expiresAt?: string;
}

type RpcLoginResult = {
  ok?: boolean;
  error?: string;
  retry_after_seconds?: number;
  session_token?: string;
  center_id?: string;
  center_name?: string;
  center_type?: string;
  allowed_projects?: string[] | null;
  expires_at?: string;
};

export type CenterLoginError =
  | "invalid_credentials"
  | "auth_unavailable"
  | "too_many_attempts";

export function formatCenterLoginError(
  error?: string,
  retryAfterSeconds?: number,
): string {
  if (error === "auth_unavailable") {
    return "خدمة تسجيل الدخول غير متاحة حالياً. تأكد من تنفيذ database_center_auth.sql في Supabase.";
  }
  if (error === "too_many_attempts") {
    const minutes = Math.max(1, Math.ceil((retryAfterSeconds ?? 900) / 60));
    return `تم تجاوز عدد محاولات الدخول المسموحة. حاول مرة أخرى بعد ${minutes} دقيقة.`;
  }
  return "بيانات الدخول غير صحيحة";
}

type RpcSessionResult = {
  ok?: boolean;
  session_token?: string;
  center_id?: string;
  center_name?: string;
  center_type?: string;
  allowed_projects?: string[] | null;
  expires_at?: string;
};

const normalizeAllowedProjects = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
};

const toCenterSession = (payload: RpcLoginResult | RpcSessionResult): CenterSessionInfo | null => {
  if (!payload.ok || !payload.session_token || !payload.center_id) return null;

  return {
    sessionToken: payload.session_token,
    id: payload.center_id,
    name: payload.center_name || "",
    type: payload.center_type || "",
    allowed_projects: normalizeAllowedProjects(payload.allowed_projects),
    expiresAt: payload.expires_at,
  };
};

export const clearCenterSession = (): void => {
  localStorage.removeItem(CENTER_SESSION_TOKEN_KEY);
  localStorage.removeItem(CENTER_SESSION_ID_KEY);
  localStorage.removeItem(CENTER_SESSION_NAME_KEY);
  localStorage.removeItem(LEGACY_CENTER_PASSWORD_KEY);
};

export const persistCenterSession = (session: CenterSessionInfo): void => {
  localStorage.setItem(CENTER_SESSION_TOKEN_KEY, session.sessionToken);
  localStorage.setItem(CENTER_SESSION_ID_KEY, session.id);
  localStorage.setItem(CENTER_SESSION_NAME_KEY, session.name);
  localStorage.removeItem(LEGACY_CENTER_PASSWORD_KEY);
};

export const getStoredCenterSessionToken = (): string | null => {
  try {
    return localStorage.getItem(CENTER_SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
};

export async function verifyCenterLogin(
  supabase: SupabaseClient,
  centerId: string,
  password: string,
): Promise<{ session: CenterSessionInfo | null; error?: CenterLoginError; retryAfterSeconds?: number }> {
  const { data, error } = await supabase.rpc("verify_center_login", {
    p_center_id: centerId,
    p_password: password,
  });

  if (error) {
    console.error("verify_center_login failed:", error);
    return { session: null, error: "auth_unavailable" };
  }

  const payload = (data || {}) as RpcLoginResult;
  if (!payload.ok) {
    return {
      session: null,
      error: (payload.error as CenterLoginError) || "invalid_credentials",
      retryAfterSeconds: payload.retry_after_seconds,
    };
  }

  const session = toCenterSession(payload);
  if (!session) {
    return { session: null, error: "invalid_credentials" };
  }

  return { session };
}

export async function validateCenterSession(
  supabase: SupabaseClient,
  sessionToken?: string | null,
): Promise<{ session: CenterSessionInfo | null }> {
  const token = sessionToken ?? getStoredCenterSessionToken();
  if (!token) {
    return { session: null };
  }

  const { data, error } = await supabase.rpc("validate_center_session", {
    p_session_token: token,
  });

  if (error) {
    console.error("validate_center_session failed:", error);
    return { session: null };
  }

  const payload = (data || {}) as RpcSessionResult;
  const session = toCenterSession(payload);
  return { session: session ?? null };
}

export async function revokeCenterSession(supabase: SupabaseClient): Promise<void> {
  const token = getStoredCenterSessionToken();
  if (token) {
    await supabase.rpc("revoke_center_session", { p_session_token: token });
  }
  clearCenterSession();
}

export async function verifyCenterPassword(
  supabase: SupabaseClient,
  centerId: string,
  password: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_center_password", {
    p_center_id: centerId,
    p_password: password,
  });

  if (error) {
    console.error("verify_center_password failed:", error);
    return false;
  }

  return data === true;
}

export const centerSessionToRecord = (session: CenterSessionInfo) => ({
  id: session.id,
  name: session.name,
  type: session.type,
  allowed_projects: session.allowed_projects ?? [],
});
