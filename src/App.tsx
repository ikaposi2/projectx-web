import { FormEvent, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type Brand = {
  display_name: string;
  default_locale: string;
  logo_url: string | null;
};

type User = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  locale: string;
  tenant_id: string;
};

const API = "/api/identity";

export default function App() {
  const { t, i18n } = useTranslation();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [health, setHealth] = useState<string>("…");
  const [token, setToken] = useState<string | null>(localStorage.getItem("projectx.token"));
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch(`${API}/brand`)
      .then((r) => r.json())
      .then((b: Brand) => {
        setBrand(b);
        document.title = b.display_name;
      })
      .catch(() => setBrand({ display_name: "Platform", default_locale: "nl", logo_url: null }));

    void fetch(`${API}/health`)
      .then((r) => r.json())
      .then((h) => setHealth(h.status ?? "ok"))
      .catch(() => setHealth("offline"));
  }, []);

  useEffect(() => {
    if (!token) {
      setUser(null);
      return;
    }
    void fetch(`${API}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("session");
        return r.json();
      })
      .then((u: User) => setUser(u))
      .catch(() => {
        localStorage.removeItem("projectx.token");
        setToken(null);
      });
  }, [token]);

  function setLocale(lng: "nl" | "en") {
    void i18n.changeLanguage(lng);
    localStorage.setItem("projectx.locale", lng);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const path = mode === "login" ? "/auth/login" : "/auth/register";
    const body =
      mode === "login"
        ? { email, password }
        : { email, password, full_name: fullName, tenant_name: brand?.display_name ?? "Platform" };

    try {
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? res.statusText);
      }
      const data = (await res.json()) as { access_token: string };
      localStorage.setItem("projectx.token", data.access_token);
      setToken(data.access_token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "error");
    }
  }

  function logout() {
    localStorage.removeItem("projectx.token");
    setToken(null);
    setUser(null);
  }

  const displayName = brand?.display_name ?? "Platform";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          {displayName}
          <span>.</span>
        </div>
        <div className="lang" aria-label={t("app.language")}>
          <button type="button" className={i18n.language === "nl" ? "active" : ""} onClick={() => setLocale("nl")}>
            NL
          </button>
          <button type="button" className={i18n.language.startsWith("en") ? "active" : ""} onClick={() => setLocale("en")}>
            EN
          </button>
        </div>
      </header>

      <main className="hero">
        <section className="panel">
          {user ? (
            <>
              <h1>{t("app.welcome", { name: user.full_name })}</h1>
              <p>{t("app.tagline")}</p>
              <div className="actions">
                <button type="button" onClick={logout}>
                  {t("app.logout")}
                </button>
              </div>
              <p className="status">
                {t("app.health")}: {health}
              </p>
            </>
          ) : (
            <>
              <h1>{displayName}</h1>
              <p>{t("app.tagline")}</p>
              <form onSubmit={submit}>
                {mode === "register" && (
                  <>
                    <label htmlFor="fullName">{t("app.fullName")}</label>
                    <input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </>
                )}
                <label htmlFor="email">{t("app.email")}</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <label htmlFor="password">{t("app.password")}</label>
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
                <div className="actions">
                  <button className="primary" type="submit">
                    {mode === "login" ? t("app.login") : t("app.register")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(mode === "login" ? "register" : "login")}
                  >
                    {mode === "login" ? t("app.register") : t("app.login")}
                  </button>
                </div>
              </form>
              {error && <p className="status error">{error}</p>}
              <p className="status">
                {t("app.health")}: {health}
              </p>
            </>
          )}
        </section>
      </main>
    </div>
  );
}
