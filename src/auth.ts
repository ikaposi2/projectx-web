/** Client-side JWT helpers (decode only — verification is server-side). */

export function decodeTokenPayload(
  token: string | null | undefined,
): Record<string, unknown> | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True when `exp` is in the past (or missing / unreadable). */
export function isTokenExpired(token: string | null | undefined): boolean {
  const payload = decodeTokenPayload(token);
  if (!payload) return true;
  const exp = payload.exp;
  if (typeof exp !== "number") return false;
  return exp * 1000 <= Date.now();
}

export function clearStoredSession(): void {
  localStorage.removeItem("projectx.token");
}
