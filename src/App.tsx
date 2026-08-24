import { FormEvent, useCallback, useEffect, useState } from "react";
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

type TimeEntry = {
  id: string;
  work_date: string;
  hours: number;
  classification: "billable" | "non_billable";
  status: "submitted" | "approved" | "rejected";
  description: string;
  project_id: string | null;
};

const API = "/api/identity";
const TIME_API = "/api/time";

export default function App() {
  const { t, i18n } = useTranslation();
  const [brand, setBrand] = useState<Brand | null>(null);
  const [health, setHealth] = useState<string>("…");
  const [timeHealth, setTimeHealth] = useState<string>("…");
  const [token, setToken] = useState<string | null>(localStorage.getItem("projectx.token"));
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("8");
  const [classification, setClassification] = useState<"billable" | "non_billable">("billable");
  const [description, setDescription] = useState("");
  const [timeError, setTimeError] = useState<string | null>(null);

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

    void fetch(`${TIME_API}/health`)
      .then((r) => r.json())
      .then((h) => setTimeHealth(h.status ?? "ok"))
      .catch(() => setTimeHealth("offline"));
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

  const loadEntries = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${TIME_API}/entries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setEntries((await res.json()) as TimeEntry[]);
      setTimeError(null);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token]);

  useEffect(() => {
    if (user && token) void loadEntries();
  }, [user, token, loadEntries]);

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
    setEntries([]);
  }

  async function createEntry(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setTimeError(null);
    try {
      const res = await fetch(`${TIME_API}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          work_date: workDate,
          hours: Number(hours),
          classification,
          description,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? res.statusText);
      }
      setDescription("");
      await loadEntries();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function approveEntry(id: string) {
    if (!token) return;
    setTimeError(null);
    try {
      const res = await fetch(`${TIME_API}/entries/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? res.statusText);
      }
      await loadEntries();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
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

      <main className={user ? "workspace" : "hero"}>
        {!user ? (
          <section className="panel">
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
                <button type="button" onClick={() => setMode(mode === "login" ? "register" : "login")}>
                  {mode === "login" ? t("app.register") : t("app.login")}
                </button>
              </div>
            </form>
            {error && <p className="status error">{error}</p>}
            <p className="status">
              {t("app.health")}: {health} · {t("time.health")}: {timeHealth}
            </p>
          </section>
        ) : (
          <>
            <section className="panel wide">
              <div className="row-between">
                <div>
                  <h1>{t("app.welcome", { name: user.full_name })}</h1>
                  <p>{t("time.intro")}</p>
                </div>
                <button type="button" onClick={logout}>
                  {t("app.logout")}
                </button>
              </div>
              <p className="status">
                {t("app.health")}: {health} · {t("time.health")}: {timeHealth}
              </p>
            </section>

            <section className="panel wide">
              <h2>{t("time.new")}</h2>
              <form className="time-form" onSubmit={createEntry}>
                <label htmlFor="workDate">{t("time.date")}</label>
                <input
                  id="workDate"
                  type="date"
                  value={workDate}
                  onChange={(e) => setWorkDate(e.target.value)}
                  required
                />
                <label htmlFor="hours">{t("time.hours")}</label>
                <input
                  id="hours"
                  type="number"
                  min={0.25}
                  max={24}
                  step={0.25}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  required
                />
                <label htmlFor="classification">{t("time.classification")}</label>
                <select
                  id="classification"
                  value={classification}
                  onChange={(e) => setClassification(e.target.value as "billable" | "non_billable")}
                >
                  <option value="billable">{t("time.billable")}</option>
                  <option value="non_billable">{t("time.nonBillable")}</option>
                </select>
                <label htmlFor="description">{t("time.description")}</label>
                <input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <div className="actions">
                  <button className="primary" type="submit">
                    {t("time.submit")}
                  </button>
                </div>
              </form>
              {timeError && <p className="status error">{timeError}</p>}
            </section>

            <section className="panel wide">
              <h2>{t("time.entries")}</h2>
              {entries.length === 0 ? (
                <p className="status">{t("time.empty")}</p>
              ) : (
                <ul className="entry-list">
                  {entries.map((entry) => (
                    <li key={entry.id}>
                      <div>
                        <strong>{entry.work_date}</strong> · {entry.hours}h ·{" "}
                        {entry.classification === "billable" ? t("time.billable") : t("time.nonBillable")} ·{" "}
                        {t(`time.status.${entry.status}`)}
                        {entry.description ? <span className="muted"> — {entry.description}</span> : null}
                      </div>
                      {entry.status === "submitted" ? (
                        <button type="button" className="primary" onClick={() => void approveEntry(entry.id)}>
                          {t("time.approve")}
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
