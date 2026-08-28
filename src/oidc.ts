const VERIFIER_KEY = "projectx.oidc.verifier";
const STATE_KEY = "projectx.oidc.state";

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomUrlSafe(byteLength: number): string {
  return b64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256UrlSafe(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return b64url(new Uint8Array(hash));
}

export type OidcPublicConfig = {
  issuer: string;
  client_id: string;
  authorization_endpoint: string;
  end_session_endpoint?: string;
};

export function oidcRedirectUri(): string {
  return `${window.location.origin}/auth/callback`;
}

export function isOidcCallback(): boolean {
  return window.location.pathname === "/auth/callback";
}

export async function startOidcLogin(cfg: OidcPublicConfig): Promise<void> {
  const verifier = randomUrlSafe(32);
  const state = randomUrlSafe(16);
  const challenge = await sha256UrlSafe(verifier);
  sessionStorage.setItem(VERIFIER_KEY, verifier);
  sessionStorage.setItem(STATE_KEY, state);
  const url = new URL(cfg.authorization_endpoint);
  url.searchParams.set("client_id", cfg.client_id);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("redirect_uri", oidcRedirectUri());
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  window.location.assign(url.toString());
}

export function consumeOidcCallback(): { code: string; codeVerifier: string } | { error: string } | null {
  if (!isOidcCallback()) return null;
  const params = new URLSearchParams(window.location.search);
  const err = params.get("error");
  const state = params.get("state");
  const expected = sessionStorage.getItem(STATE_KEY);
  const verifier = sessionStorage.getItem(VERIFIER_KEY);
  sessionStorage.removeItem(STATE_KEY);
  sessionStorage.removeItem(VERIFIER_KEY);
  if (err) return { error: params.get("error_description") || err };
  if (!state || !expected || state !== expected) return { error: "invalid_state" };
  const code = params.get("code");
  if (!code || !verifier) return { error: "missing_code" };
  return { code, codeVerifier: verifier };
}

export function clearOidcCallbackUrl(): void {
  window.history.replaceState({}, document.title, "/");
}
