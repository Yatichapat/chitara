import { AuthUser } from "@/lib/types";

export const USER_STORAGE_KEY = "chitara.auth.user";

export function storeAuthUser(user: AuthUser) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
}

export function clearAuthUser() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(USER_STORAGE_KEY);
}

export function getStoredAuthUser(): AuthUser | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as AuthUser;
    if (parsed?.user_id && parsed?.email) {
      return parsed;
    }
  } catch {
    // Invalid session payload should be ignored by callers.
  }

  window.localStorage.removeItem(USER_STORAGE_KEY);
  return null;
}

export function consumeGoogleAuthCallback(searchParams: URLSearchParams): AuthUser | null {
  if (searchParams.get("google_auth") !== "success") {
    return null;
  }

  const userId = Number(searchParams.get("user_id"));
  const name = searchParams.get("name") || "Google User";
  const email = searchParams.get("email") || "";
  const generationQuota = Number(searchParams.get("generation_quota") || "0");

  if (!Number.isFinite(userId) || userId <= 0 || !email) {
    return null;
  }

  return {
    user_id: userId,
    name,
    email,
    generation_quota: Number.isFinite(generationQuota) ? generationQuota : 0,
  };
}
