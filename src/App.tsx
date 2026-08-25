import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  partner_id: string;
  work_date: string;
  hours: number;
  classification: "billable" | "non_billable";
  status: "submitted" | "approved" | "rejected";
  description: string;
  project_id: string | null;
};

const MANAGER_ROLES = new Set(["partner", "manager", "admin"]);

type BookableProject = {
  id: string;
  customer_name: string;
  name: string;
  service_id: string;
  status: string;
  contracted_hours: number;
  remaining_hours: number;
};

type InternalBudget = {
  id: string;
  name: string;
  annual_hours: number;
  remaining_hours: number;
};

type GridRow = {
  id: string;
  label: string;
  subtitle?: string;
  classification: "billable" | "non_billable";
};

type AppView = "hours" | "admin" | "customers";

const API = "/api/identity";
const TIME_API = "/api/time";
const PROJECT_API = "/api/project";
const PARTNER_API = "/api/partner";
const CUSTOMER_API = "/api/customer";

type Customer = {
  id: string;
  name: string;
  status: "prospect" | "active" | "inactive";
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  technical_contact_name: string | null;
  technical_contact_email: string | null;
  technical_contact_phone: string | null;
  notes: string | null;
};

const emptyCustomerForm = {
  name: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  address_line1: "",
  address_line2: "",
  postal_code: "",
  city: "",
  country: "",
  technical_contact_name: "",
  technical_contact_email: "",
  technical_contact_phone: "",
  notes: "",
};

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

function startOfIsoWeek(d: Date): Date {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  if (day !== 1) date.setUTCDate(date.getUTCDate() - (day - 1));
  return date;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatWeekRange(monday: Date, locale: string): string {
  const sunday = addDays(monday, 6);
  const fmt = new Intl.DateTimeFormat(locale.startsWith("en") ? "en-GB" : "nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${fmt.format(monday)} – ${fmt.format(sunday)}`;
}

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
  const [projects, setProjects] = useState<BookableProject[]>([]);
  const [budgets, setBudgets] = useState<InternalBudget[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const [draftHours, setDraftHours] = useState<Record<string, string>>({});
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("hours");
  const activeCellKey = useRef<string | null>(null);

  const weekDates = useMemo(
    () => DAY_KEYS.map((_, i) => toIsoDate(addDays(weekStart, i))),
    [weekStart],
  );

  const rows: GridRow[] = useMemo(
    () => [
      ...projects.map((p) => ({
        id: p.id,
        label: `${p.customer_name} · ${p.name}`,
        subtitle: String(p.remaining_hours),
        classification: "billable" as const,
      })),
      ...budgets.map((b) => ({
        id: b.id,
        label: b.name,
        subtitle: String(b.remaining_hours),
        classification: "non_billable" as const,
      })),
    ],
    [projects, budgets],
  );

  const myEntries = useMemo(
    () => (user ? entries.filter((entry) => entry.partner_id === user.id) : entries),
    [entries, user],
  );

  const entryByKey = useMemo(() => {
    const rank = (status: TimeEntry["status"]) =>
      status === "rejected" ? 0 : status === "submitted" ? 1 : 2;
    const map = new Map<string, TimeEntry>();
    for (const entry of myEntries) {
      if (!entry.project_id) continue;
      const key = `${entry.project_id}|${entry.work_date}`;
      const existing = map.get(key);
      if (!existing || rank(entry.status) >= rank(existing.status)) {
        map.set(key, entry);
      }
    }
    return map;
  }, [myEntries]);

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

  const searchCustomers = useCallback(
    async (query: string) => {
      if (!token) return;
      const term = query.trim();
      if (!term) {
        setCustomers([]);
        setCustomerError(null);
        return;
      }
      try {
        const res = await fetch(`${CUSTOMER_API}/customers?q=${encodeURIComponent(term)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        setCustomers((await res.json()) as Customer[]);
        setCustomerError(null);
      } catch (err) {
        setCustomerError(err instanceof Error ? err.message : "error");
      }
    },
    [token],
  );

  const loadBookable = useCallback(async () => {
    if (!token) return;
    try {
      const [projRes, budRes] = await Promise.all([
        fetch(`${PROJECT_API}/projects/bookable`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${PARTNER_API}/budgets/internal`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!projRes.ok) throw new Error(await projRes.text());
      if (!budRes.ok) throw new Error(await budRes.text());
      setProjects((await projRes.json()) as BookableProject[]);
      setBudgets((await budRes.json()) as InternalBudget[]);
      setTimeError(null);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token]);

  const loadEntries = useCallback(async () => {
    if (!token) return;
    const from = weekDates[0];
    const to = weekDates[6];
    try {
      const res = await fetch(`${TIME_API}/entries?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setEntries((await res.json()) as TimeEntry[]);
      setTimeError(null);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token, weekDates]);

  useEffect(() => {
    if (user && token) {
      void loadBookable();
      void loadEntries();
    }
  }, [user, token, loadBookable, loadEntries]);

  useEffect(() => {
    if (!token || view !== "customers") return;
    const handle = window.setTimeout(() => {
      void searchCustomers(customerQuery);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [token, view, customerQuery, searchCustomers]);

  useEffect(() => {
    setDraftHours((prev) => {
      const next: Record<string, string> = {};
      for (const row of rows) {
        for (const date of weekDates) {
          const key = `${row.id}|${date}`;
          if (key === activeCellKey.current && prev[key] !== undefined) {
            next[key] = prev[key];
            continue;
          }
          const entry = entryByKey.get(key);
          next[key] = entry ? String(entry.hours) : "";
        }
      }
      return next;
    });
  }, [rows, weekDates, entryByKey]);

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
    setProjects([]);
    setBudgets([]);
    setCustomers([]);
  }

  async function persistCell(row: GridRow, date: string, raw: string) {
    if (!token) return;
    const key = `${row.id}|${date}`;
    const entry = entryByKey.get(key);
    const trimmed = raw.trim();
    const hours = trimmed === "" ? 0 : Number(trimmed);

    if (entry?.status === "approved" || entry?.status === "rejected") {
      setDraftHours((prev) => ({ ...prev, [key]: String(entry.hours) }));
      return;
    }

    if (Number.isNaN(hours) || hours < 0 || hours > 24) {
      setTimeError("invalid hours");
      setDraftHours((prev) => ({ ...prev, [key]: entry ? String(entry.hours) : "" }));
      return;
    }

    if (!entry && hours === 0) return;
    if (entry && hours === entry.hours) return;

    setSavingCell(key);
    setTimeError(null);
    try {
      if (hours === 0 && entry) {
        const res = await fetch(`${TIME_API}/entries/${entry.id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail ?? res.statusText);
        }
      } else if (entry) {
        const res = await fetch(`${TIME_API}/entries/${entry.id}`, {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ hours }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail ?? res.statusText);
        }
      } else if (hours > 0) {
        const res = await fetch(`${TIME_API}/entries`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            work_date: date,
            hours,
            classification: row.classification,
            project_id: row.id,
            description: "",
          }),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => ({}));
          throw new Error(detail.detail ?? res.statusText);
        }
      }
      await loadEntries();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
      setDraftHours((prev) => ({ ...prev, [key]: entry ? String(entry.hours) : "" }));
    } finally {
      setSavingCell(null);
    }
  }

  function formatApiError(detail: unknown, fallback: string): string {
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => (typeof item === "object" && item && "msg" in item ? String(item.msg) : String(item)))
        .join("; ");
    }
    return fallback;
  }

  function customerToForm(customer: Customer) {
    return {
      name: customer.name,
      contact_name: customer.contact_name,
      contact_email: customer.contact_email ?? "",
      contact_phone: customer.contact_phone ?? "",
      address_line1: customer.address_line1 ?? "",
      address_line2: customer.address_line2 ?? "",
      postal_code: customer.postal_code ?? "",
      city: customer.city ?? "",
      country: customer.country ?? "",
      technical_contact_name: customer.technical_contact_name ?? "",
      technical_contact_email: customer.technical_contact_email ?? "",
      technical_contact_phone: customer.technical_contact_phone ?? "",
      notes: customer.notes ?? "",
    };
  }

  function startEditCustomer(customer: Customer) {
    setEditingCustomerId(customer.id);
    setCustomerForm(customerToForm(customer));
    setCustomerError(null);
  }

  function cancelEditCustomer() {
    setEditingCustomerId(null);
    setCustomerForm(emptyCustomerForm);
    setCustomerError(null);
  }

  async function saveCustomer(e: FormEvent) {
    e.preventDefault();
    if (!token || !customerForm.name.trim() || !customerForm.contact_name.trim()) return;
    if (!customerForm.contact_email.trim() && !customerForm.contact_phone.trim()) {
      setCustomerError(t("customer.channelRequired"));
      return;
    }
    setCustomerError(null);
    const payload = {
      name: customerForm.name.trim(),
      status: "active" as const,
      contact_name: customerForm.contact_name.trim(),
      contact_email: customerForm.contact_email.trim() || null,
      contact_phone: customerForm.contact_phone.trim() || null,
      address_line1: customerForm.address_line1.trim() || null,
      address_line2: customerForm.address_line2.trim() || null,
      postal_code: customerForm.postal_code.trim() || null,
      city: customerForm.city.trim() || null,
      country: customerForm.country.trim() || null,
      technical_contact_name: customerForm.technical_contact_name.trim() || null,
      technical_contact_email: customerForm.technical_contact_email.trim() || null,
      technical_contact_phone: customerForm.technical_contact_phone.trim() || null,
      notes: customerForm.notes.trim() || null,
    };
    try {
      const res = await fetch(
        editingCustomerId ? `${CUSTOMER_API}/customers/${editingCustomerId}` : `${CUSTOMER_API}/customers`,
        {
          method: editingCustomerId ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      cancelEditCustomer();
      await searchCustomers(customerQuery);
    } catch (err) {
      setCustomerError(err instanceof Error ? err.message : "error");
    }
  }

  function customerChannel(customer: Customer): string {
    const parts = [customer.contact_email, customer.contact_phone].filter(Boolean);
    return parts.join(" · ");
  }

  function customerAddress(customer: Customer): string | null {
    const line = [customer.address_line1, customer.postal_code, customer.city, customer.country]
      .filter(Boolean)
      .join(", ");
    return line || null;
  }

  async function deleteCustomer(id: string, name: string) {
    if (!token) return;
    if (!window.confirm(t("customer.deleteConfirm", { name }))) return;
    setCustomerError(null);
    try {
      const res = await fetch(`${CUSTOMER_API}/customers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      if (editingCustomerId === id) cancelEditCustomer();
      await searchCustomers(customerQuery);
    } catch (err) {
      setCustomerError(err instanceof Error ? err.message : "error");
    }
  }

  async function postEntryAction(id: string, action: "approve" | "refuse" | "reset") {
    if (!token) return;
    setTimeError(null);
    try {
      const res = await fetch(`${TIME_API}/entries/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(detail.detail ?? res.statusText);
      }
      await loadEntries();
      // Partner consumes the NATS event asynchronously; brief wait then refresh remaining hours.
      await new Promise((resolve) => setTimeout(resolve, 600));
      await loadBookable();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  const dayTotals = weekDates.map((date) =>
    rows.reduce((sum, row) => {
      const key = `${row.id}|${date}`;
      const entry = entryByKey.get(key);
      if (entry?.status === "rejected") return sum;
      const draft = draftHours[key];
      if (draft !== undefined && draft.trim() !== "") {
        const n = Number(draft.replace(",", "."));
        return sum + (Number.isFinite(n) && n > 0 ? n : 0);
      }
      return sum + (entry?.hours ?? 0);
    }, 0),
  );
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  const isManager = Boolean(user && MANAGER_ROLES.has(user.role));
  const activeView: AppView = view === "admin" && !isManager ? "hours" : view;
  const submittedEntries = entries.filter((e) => e.status === "submitted");
  const correctionEntries = entries.filter((e) => e.status === "approved" || e.status === "rejected");
  const displayName = brand?.display_name ?? "Platform";
  const rowLabel = (id: string) => rows.find((r) => r.id === id)?.label ?? id;
  const whoLabel = (entry: TimeEntry) =>
    user && entry.partner_id === user.id ? t("time.you") : t("time.colleague");

  function dayClass(index: number): string {
    const total = dayTotals[index] ?? 0;
    const weekend = index >= 5;
    const warn = weekend ? total > 0 : total > 8;
    if (weekend) return warn ? "day-off day-warn" : "day-off";
    return warn ? "day-normal day-warn" : "day-normal";
  }

  function hoursInput(row: GridRow, date: string, dayIndex: number) {
    const key = `${row.id}|${date}`;
    const entry = entryByKey.get(key);
    const locked = entry?.status === "approved" || entry?.status === "rejected";
    const cellClass =
      entry?.status === "rejected"
        ? "hours-cell rejected"
        : entry?.status === "approved"
          ? "hours-cell approved"
          : "hours-cell";
    return (
      <td key={date} className={dayClass(dayIndex)}>
        <input
          className={cellClass}
          type="text"
          inputMode="decimal"
          aria-label={`${row.label} ${date}`}
          value={draftHours[key] ?? ""}
          readOnly={locked}
          disabled={locked}
          aria-busy={savingCell === key}
          title={
            entry?.status === "rejected"
              ? t("time.rejectedCell")
              : entry?.status === "approved"
                ? t("time.approvedCell")
                : undefined
          }
          onFocus={() => {
            if (locked) return;
            activeCellKey.current = key;
            setDraftHours((prev) => {
              const current = prev[key];
              if (current === undefined || current.trim() === "") {
                return { ...prev, [key]: "8" };
              }
              return prev;
            });
          }}
          onChange={(e) => {
            const value = e.target.value;
            if (value !== "" && !/^\d{0,2}([.,]\d{0,2})?$/.test(value)) return;
            setDraftHours((prev) => ({ ...prev, [key]: value.replace(",", ".") }));
          }}
          onBlur={(e) => {
            const typed = e.currentTarget.value.trim();
            const hours = typed === "" ? (entry ? "" : "8") : typed;
            activeCellKey.current = null;
            void persistCell(row, date, hours);
          }}
        />
      </td>
    );
  }

  function projectRows(kind: "billable" | "non_billable") {
    return rows
      .filter((r) => r.classification === kind)
      .map((row) => (
        <tr key={row.id}>
          <th scope="row">
            <span className="row-label">{row.label}</span>
            {row.subtitle ? (
              <span className="row-sub">{t("time.remaining", { hours: row.subtitle })}</span>
            ) : null}
          </th>
          {weekDates.map((date, i) => hoursInput(row, date, i))}
        </tr>
      ));
  }

  return (
    <div className={user ? "shell app-shell" : "shell"}>
      <header className="topbar">
        <div className="brand">
          {displayName}
          <span>.</span>
        </div>
        <div className="topbar-right">
          {user ? (
            <button type="button" onClick={logout}>
              {t("app.logout")}
            </button>
          ) : null}
          <div className="lang" aria-label={t("app.language")}>
            <button type="button" className={i18n.language === "nl" ? "active" : ""} onClick={() => setLocale("nl")}>
              NL
            </button>
            <button
              type="button"
              className={i18n.language.startsWith("en") ? "active" : ""}
              onClick={() => setLocale("en")}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      {!user ? (
        <main className="hero">
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
        </main>
      ) : (
        <div className="app-body">
          <nav className="side-nav" aria-label={t("nav.menu")}>
            <p className="nav-user">{t("app.welcome", { name: user.full_name })}</p>
            <button
              type="button"
              className={view === "hours" ? "nav-item active" : "nav-item"}
              onClick={() => setView("hours")}
            >
              {t("nav.hours")}
            </button>
            {isManager ? (
              <button
                type="button"
                className={view === "admin" ? "nav-item active" : "nav-item"}
                onClick={() => setView("admin")}
              >
                {t("nav.admin")}
              </button>
            ) : null}
            <button
              type="button"
              className={view === "customers" ? "nav-item active" : "nav-item"}
              onClick={() => setView("customers")}
            >
              {t("nav.customers")}
            </button>
          </nav>

          <main className="workspace">
            {activeView === "customers" ? (
              <section className="panel wide">
                <h1>{t("customer.title")}</h1>
                <p>{t("customer.intro")}</p>

                <div className="customer-search">
                  <label htmlFor="customerSearch">{t("customer.search")}</label>
                  <input
                    id="customerSearch"
                    type="search"
                    value={customerQuery}
                    onChange={(e) => setCustomerQuery(e.target.value)}
                    placeholder={t("customer.searchPlaceholder")}
                    autoComplete="off"
                  />
                  {!customerQuery.trim() ? (
                    <p className="status">{t("customer.searchHint")}</p>
                  ) : customers.length === 0 ? (
                    <p className="status">{t("customer.noMatches")}</p>
                  ) : (
                    <ul className="entry-list">
                      {customers.map((customer) => (
                        <li key={customer.id}>
                          <div>
                            <strong>{customer.name}</strong>
                            <div className="muted">
                              {customer.contact_name}
                              {customerChannel(customer) ? ` · ${customerChannel(customer)}` : ""}
                            </div>
                            {customerAddress(customer) ? (
                              <div className="muted">{customerAddress(customer)}</div>
                            ) : null}
                            {customer.technical_contact_name ||
                            customer.technical_contact_email ||
                            customer.technical_contact_phone ? (
                              <div className="muted">
                                {t("customer.technicalShort")}:{" "}
                                {[
                                  customer.technical_contact_name,
                                  customer.technical_contact_email,
                                  customer.technical_contact_phone,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            ) : null}
                          </div>
                          <div className="entry-actions">
                            <button type="button" onClick={() => startEditCustomer(customer)}>
                              {t("customer.edit")}
                            </button>
                            <button type="button" onClick={() => void deleteCustomer(customer.id, customer.name)}>
                              {t("customer.delete")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <form className="customer-form" onSubmit={(e) => void saveCustomer(e)}>
                  <h2>{editingCustomerId ? t("customer.editTitle") : t("customer.addTitle")}</h2>
                  <fieldset className="fields-required">
                    <legend>{t("customer.sectionCompany")}</legend>
                    <label htmlFor="customerName">{t("customer.name")}</label>
                    <input
                      id="customerName"
                      value={customerForm.name}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))}
                      required
                      maxLength={200}
                    />
                  </fieldset>

                  <fieldset className="fields-required">
                    <legend>{t("customer.sectionPrimary")}</legend>
                    <label htmlFor="contactName">{t("customer.contactName")}</label>
                    <input
                      id="contactName"
                      value={customerForm.contact_name}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, contact_name: e.target.value }))}
                      required
                      maxLength={200}
                    />
                    <label htmlFor="contactEmail">{t("customer.contactEmail")}</label>
                    <input
                      id="contactEmail"
                      type="email"
                      value={customerForm.contact_email}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, contact_email: e.target.value }))}
                      maxLength={320}
                    />
                    <label htmlFor="contactPhone">{t("customer.contactPhone")}</label>
                    <input
                      id="contactPhone"
                      type="tel"
                      value={customerForm.contact_phone}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, contact_phone: e.target.value }))}
                      maxLength={40}
                    />
                    <p className="field-hint">{t("customer.channelHint")}</p>
                  </fieldset>

                  <fieldset className="fields-optional">
                    <legend>{t("customer.sectionAddress")}</legend>
                    <label htmlFor="addressLine1">{t("customer.addressLine1")}</label>
                    <input
                      id="addressLine1"
                      value={customerForm.address_line1}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, address_line1: e.target.value }))}
                      maxLength={200}
                    />
                    <label htmlFor="addressLine2">{t("customer.addressLine2")}</label>
                    <input
                      id="addressLine2"
                      value={customerForm.address_line2}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, address_line2: e.target.value }))}
                      maxLength={200}
                    />
                    <div className="form-row">
                      <div>
                        <label htmlFor="postalCode">{t("customer.postalCode")}</label>
                        <input
                          id="postalCode"
                          value={customerForm.postal_code}
                          onChange={(e) => setCustomerForm((prev) => ({ ...prev, postal_code: e.target.value }))}
                          maxLength={32}
                        />
                      </div>
                      <div>
                        <label htmlFor="city">{t("customer.city")}</label>
                        <input
                          id="city"
                          value={customerForm.city}
                          onChange={(e) => setCustomerForm((prev) => ({ ...prev, city: e.target.value }))}
                          maxLength={120}
                        />
                      </div>
                    </div>
                    <label htmlFor="country">{t("customer.country")}</label>
                    <input
                      id="country"
                      value={customerForm.country}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, country: e.target.value }))}
                      maxLength={120}
                    />
                  </fieldset>

                  <fieldset className="fields-optional">
                    <legend>{t("customer.sectionTechnical")}</legend>
                    <label htmlFor="techName">{t("customer.technicalContactName")}</label>
                    <input
                      id="techName"
                      value={customerForm.technical_contact_name}
                      onChange={(e) =>
                        setCustomerForm((prev) => ({ ...prev, technical_contact_name: e.target.value }))
                      }
                      maxLength={200}
                    />
                    <label htmlFor="techEmail">{t("customer.technicalContactEmail")}</label>
                    <input
                      id="techEmail"
                      type="email"
                      value={customerForm.technical_contact_email}
                      onChange={(e) =>
                        setCustomerForm((prev) => ({ ...prev, technical_contact_email: e.target.value }))
                      }
                      maxLength={320}
                    />
                    <label htmlFor="techPhone">{t("customer.technicalContactPhone")}</label>
                    <input
                      id="techPhone"
                      type="tel"
                      value={customerForm.technical_contact_phone}
                      onChange={(e) =>
                        setCustomerForm((prev) => ({ ...prev, technical_contact_phone: e.target.value }))
                      }
                      maxLength={40}
                    />
                  </fieldset>

                  <div className="actions">
                    <button className="primary" type="submit">
                      {editingCustomerId ? t("customer.save") : t("customer.add")}
                    </button>
                    {editingCustomerId ? (
                      <button type="button" onClick={cancelEditCustomer}>
                        {t("customer.cancel")}
                      </button>
                    ) : null}
                  </div>
                </form>
                {customerError && <p className="status error">{customerError}</p>}
              </section>
            ) : null}

            {activeView === "hours" ? (
              <section className="panel wide timesheet">
                <div className="week-nav">
                  <div>
                    <h1>{t("nav.hours")}</h1>
                    <p>{t("time.intro")}</p>
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => setWeekStart((w) => addDays(w, -7))}>
                      {t("time.prevWeek")}
                    </button>
                    <button type="button" onClick={() => setWeekStart(startOfIsoWeek(new Date()))}>
                      {t("time.thisWeek")}
                    </button>
                    <button type="button" onClick={() => setWeekStart((w) => addDays(w, 7))}>
                      {t("time.nextWeek")}
                    </button>
                  </div>
                </div>
                <p className="week-range">{formatWeekRange(weekStart, i18n.language)}</p>

                <div className="timesheet-scroll">
                  <table className="timesheet-grid">
                    <thead>
                      <tr>
                        <th scope="col">{t("time.hours")}</th>
                        {DAY_KEYS.map((day, i) => (
                          <th key={day} scope="col" className={dayClass(i)}>
                            <span className="day-name">{t(`time.days.${day}`)}</span>
                            <span className="day-date">{weekDates[i].slice(8)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {projects.length > 0 && (
                        <tr className="section-row">
                          <td colSpan={8}>{t("time.billableProjects")}</td>
                        </tr>
                      )}
                      {projectRows("billable")}
                      {budgets.length > 0 && (
                        <tr className="section-row">
                          <td colSpan={8}>{t("time.internalBudgets")}</td>
                        </tr>
                      )}
                      {projectRows("non_billable")}
                      <tr className="totals-row">
                        <th scope="row">{t("time.dayTotal")}</th>
                        {dayTotals.map((total, i) => (
                          <td key={weekDates[i]} className={dayClass(i)}>
                            {total > 0 ? total : "—"}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
                <p className="week-total">
                  {t("time.weekTotal")}: <strong>{weekTotal}</strong>
                </p>
                {timeError && <p className="status error">{timeError}</p>}
              </section>
            ) : null}

            {activeView === "admin" && isManager ? (
              <>
                <section className="panel wide">
                  <h1>{t("nav.admin")}</h1>
                  <p>{t("time.adminIntro")}</p>
                  <div className="actions week-actions">
                    <button type="button" onClick={() => setWeekStart((w) => addDays(w, -7))}>
                      {t("time.prevWeek")}
                    </button>
                    <button type="button" onClick={() => setWeekStart(startOfIsoWeek(new Date()))}>
                      {t("time.thisWeek")}
                    </button>
                    <button type="button" onClick={() => setWeekStart((w) => addDays(w, 7))}>
                      {t("time.nextWeek")}
                    </button>
                  </div>
                  <p className="week-range">{formatWeekRange(weekStart, i18n.language)}</p>
                  {timeError && <p className="status error">{timeError}</p>}
                </section>

                <section className="panel wide">
                  <h2>{t("time.entries")}</h2>
                  {submittedEntries.length === 0 ? (
                    <p className="status">{t("time.empty")}</p>
                  ) : (
                    <ul className="entry-list">
                      {submittedEntries.map((entry) => (
                        <li key={entry.id}>
                          <div>
                            <strong>{entry.work_date}</strong> · {entry.hours}h · {whoLabel(entry)} ·{" "}
                            {entry.classification === "billable" ? t("time.billable") : t("time.nonBillable")}
                            {entry.project_id ? (
                              <span className="muted"> — {rowLabel(entry.project_id)}</span>
                            ) : null}
                          </div>
                          <div className="entry-actions">
                            <button
                              type="button"
                              className="primary"
                              onClick={() => void postEntryAction(entry.id, "approve")}
                            >
                              {t("time.approve")}
                            </button>
                            <button type="button" onClick={() => void postEntryAction(entry.id, "refuse")}>
                              {t("time.refuse")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="panel wide">
                  <h2>{t("time.correction")}</h2>
                  <p className="status">{t("time.correctionHint")}</p>
                  {correctionEntries.length === 0 ? (
                    <p className="status">{t("time.correctionEmpty")}</p>
                  ) : (
                    <ul className="entry-list">
                      {correctionEntries.map((entry) => (
                        <li key={entry.id}>
                          <div>
                            <strong>{entry.work_date}</strong> · {entry.hours}h · {whoLabel(entry)} ·{" "}
                            {t(`time.status.${entry.status}`)}
                            {entry.project_id ? (
                              <span className="muted"> — {rowLabel(entry.project_id)}</span>
                            ) : null}
                          </div>
                          <div className="entry-actions">
                            {entry.status === "approved" ? (
                              <button type="button" onClick={() => void postEntryAction(entry.id, "refuse")}>
                                {t("time.refuse")}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="primary"
                              onClick={() => void postEntryAction(entry.id, "reset")}
                            >
                              {t("time.reset")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            ) : null}
          </main>
        </div>
      )}
    </div>
  );
}
