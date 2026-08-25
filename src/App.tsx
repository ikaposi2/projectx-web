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
  fixed_price_eur?: number;
  consultancy_budget_eur?: number;
};

type ProjectStaffing = {
  id?: string;
  consultant_rate_id?: string;
  partner_id?: string;
  display_name: string;
  rate_eur: number;
  share_pct: number;
  hours?: number;
};

type StaffingDraftRow = {
  key: string;
  partner_id: string;
  consultant_rate_id: string;
  display_name: string;
  rate_eur: string;
  share_pct: string;
};

type ProjectDetail = {
  id: string;
  name: string;
  customer_name: string;
  service_id: string;
  status: string;
  contracted_hours: number;
  remaining_hours: number;
  fixed_price_eur: number;
  risk_mode: "rate" | "fixed";
  risk_rate: number;
  risk_fixed_eur: number;
  profit_mode: "rate" | "fixed";
  profit_rate: number;
  profit_fixed_eur: number;
  overhead_mode: "rate" | "fixed";
  overhead_rate: number;
  overhead_fixed_eur: number;
  consultancy_budget_eur: number;
  progress?: string;
  report_url?: string | null;
  staffing: ProjectStaffing[];
};

type ReserveSnapshot = {
  target_eur: number;
  current_reserve_eur: number;
  surplus_eur: number;
  internal_rate_eur: number;
  chargeback_hours: number;
  chargeback_eur: number;
  billable_hours: number;
  invoice_draft_eur: number;
  invoice_issued_eur: number;
  invoice_paid_eur: number;
};

type VatQuarter = {
  year: number;
  quarter: number;
  label: string;
  collected_eur: number;
  remitted_eur: number;
  outstanding_eur: number;
  can_remit: boolean;
};

type VatAccount = {
  balance_eur: number;
  current_quarter: string;
  quarters: VatQuarter[];
};

type CompensationEffect = {
  time_entry_id: string;
  partner_id: string;
  partner_name: string;
  project_id?: string | null;
  classification: string;
  hours: number;
  rate_eur: number;
  amount_eur: number;
  can_undo: boolean;
  updated_at?: string | null;
};

type FinanceInvoice = {
  id: string;
  invoice_number: string;
  kind: string;
  project_id: string | null;
  project_name: string;
  customer_id: string | null;
  customer_name: string;
  buyer_vat_id?: string | null;
  buyer_address?: string | null;
  seller_name: string;
  seller_vat_id?: string | null;
  seller_address?: string | null;
  seller_bank_account?: string | null;
  description?: string | null;
  period_label?: string | null;
  subtotal_eur: number;
  vat_rate: number;
  vat_eur: number;
  amount_eur: number;
  payment_terms_days: number;
  issued_at?: string | null;
  due_date?: string | null;
  returned_at?: string | null;
  pdf_path?: string | null;
  status: string;
  notes: string | null;
  lines: {
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price_eur: number;
    amount_eur: number;
  }[];
};

type BillingCandidate = {
  project_id: string;
  project_name: string;
  customer_name: string;
  fixed_price_eur: number;
  progress: string;
  report_url?: string | null;
  actions: {
    kind: string;
    label: string;
    amount_eur: number;
    enabled: boolean;
    hours?: number;
    rate_eur?: number;
  }[];
};

type CompanyProfile = {
  legal_name: string;
  address_line1: string | null;
  vat_id: string | null;
  coc_number: string | null;
  bank_account: string | null;
  invoice_email: string | null;
  payment_terms_days: number;
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

type InvoiceAgendaItem = {
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  amount_eur: number;
  due_date: string;
  days_until_due: number;
  overdue: boolean;
  has_pdf: boolean;
};

type CatalogService = {
  service_id: string;
  version: string;
  family: string;
  status: string;
  name: Record<string, string>;
  estimated_hours: number | null;
  billing_model: string | null;
  list_price_eur: number | null;
};

type BillableCheck = {
  ok: boolean;
  missing: string[];
};

type AppView = "hours" | "admin" | "customers" | "finance" | "catalog";

const API = "/api/identity";
const TIME_API = "/api/time";
const PROJECT_API = "/api/project";
const PARTNER_API = "/api/partner";
const CUSTOMER_API = "/api/customer";
const FINANCE_API = "/api/finance";
const CATALOG_API = "/api/catalog";

type Customer = {
  id: string;
  name: string;
  status: "prospect" | "active" | "inactive";
  is_msp: boolean;
  parent_id: string | null;
  parent_name?: string | null;
  bill_to_customer_id?: string | null;
  bill_to_name?: string | null;
  contact_name: string;
  contact_email: string | null;
  contact_phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  vat_id: string | null;
  bank_account: string | null;
  coc_number: string | null;
  payment_terms_days: number;
  billing_same_as_address: boolean;
  billing_name: string | null;
  billing_contact_name: string | null;
  billing_email: string | null;
  billing_address_line1: string | null;
  billing_address_line2: string | null;
  billing_postal_code: string | null;
  billing_city: string | null;
  billing_country: string | null;
  technical_contact_name: string | null;
  technical_contact_email: string | null;
  technical_contact_phone: string | null;
  notes: string | null;
};

const emptyCustomerForm = {
  name: "",
  is_msp: false,
  parent_id: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  address_line1: "",
  address_line2: "",
  postal_code: "",
  city: "",
  country: "",
  vat_id: "",
  bank_account: "",
  coc_number: "",
  payment_terms_days: "30",
  billing_same_as_address: true,
  billing_name: "",
  billing_contact_name: "",
  billing_email: "",
  billing_address_line1: "",
  billing_address_line2: "",
  billing_postal_code: "",
  billing_city: "",
  billing_country: "",
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
  const [adminEntries, setAdminEntries] = useState<TimeEntry[]>([]);
  const [projects, setProjects] = useState<BookableProject[]>([]);
  const [budgets, setBudgets] = useState<InternalBudget[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mspCustomers, setMspCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerError, setCustomerError] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const [draftHours, setDraftHours] = useState<Record<string, string>>({});
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [timeError, setTimeError] = useState<string | null>(null);
  const [adminStatus, setAdminStatus] = useState<string | null>(null);
  const [view, setView] = useState<AppView>("hours");
  const [managedProjects, setManagedProjects] = useState<ProjectDetail[]>([]);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [budgetForm, setBudgetForm] = useState({
    fixed_price_eur: "0",
    risk_mode: "rate" as "rate" | "fixed",
    risk_rate: "10",
    risk_fixed_eur: "0",
    profit_mode: "rate" as "rate" | "fixed",
    profit_rate: "15",
    profit_fixed_eur: "0",
    overhead_mode: "rate" as "rate" | "fixed",
    overhead_rate: "10",
    overhead_fixed_eur: "0",
    progress: "none",
    report_url: "",
  });
  const [staffingDraft, setStaffingDraft] = useState<StaffingDraftRow[]>([]);
  const [reserve, setReserve] = useState<ReserveSnapshot | null>(null);
  const [vatAccount, setVatAccount] = useState<VatAccount | null>(null);
  const [compensation, setCompensation] = useState<CompensationEffect[]>([]);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [billingCandidates, setBillingCandidates] = useState<BillingCandidate[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [financeStatus, setFinanceStatus] = useState<string | null>(null);
  const [financeWeekStart, setFinanceWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const [invoiceAgenda, setInvoiceAgenda] = useState<InvoiceAgendaItem[]>([]);
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [catalogForm, setCatalogForm] = useState({ list_price_eur: "", estimated_hours: "", name_en: "" });
  const [projectCreateCustomerId, setProjectCreateCustomerId] = useState("");
  const [projectCreateCustomerQuery, setProjectCreateCustomerQuery] = useState("");
  const [projectCreateCustomers, setProjectCreateCustomers] = useState<Customer[]>([]);
  const [projectBillable, setProjectBillable] = useState<BillableCheck | null>(null);
  const [projectCreateServiceId, setProjectCreateServiceId] = useState("");
  const [projectCreateName, setProjectCreateName] = useState("");
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
    setMspCustomers([]);
        setCustomerError(null);
        return;
      }
      try {
        const res = await fetch(`${CUSTOMER_API}/customers?q=${encodeURIComponent(term)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(await res.text());
        setCustomers((await res.json()) as Customer[]);
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

  const loadAdminEntries = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${TIME_API}/entries`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setAdminEntries((await res.json()) as TimeEntry[]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token]);

  const loadManagedProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${PROJECT_API}/projects/bookable`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      const list = (await res.json()) as BookableProject[];
      const details = await Promise.all(
        list.map(async (p) => {
          const r = await fetch(`${PROJECT_API}/projects/${p.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) throw new Error(await r.text());
          return (await r.json()) as ProjectDetail;
        }),
      );
      setManagedProjects(details);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token]);

  const loadFinance = useCallback(async () => {
    if (!token) return;
    const weekStartIso = toIsoDate(financeWeekStart);
    try {
      const [reserveRes, vatRes, compRes, invRes, candRes, companyRes, agendaRes] = await Promise.all([
        fetch(`${FINANCE_API}/reserve`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${FINANCE_API}/vat`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${FINANCE_API}/compensation`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${FINANCE_API}/invoices`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${FINANCE_API}/billing/candidates`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${FINANCE_API}/company`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${FINANCE_API}/invoices/agenda?week_start=${weekStartIso}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (
        !reserveRes.ok ||
        !vatRes.ok ||
        !compRes.ok ||
        !invRes.ok ||
        !candRes.ok ||
        !companyRes.ok ||
        !agendaRes.ok
      ) {
        throw new Error("finance_unavailable");
      }
      setReserve((await reserveRes.json()) as ReserveSnapshot);
      setVatAccount((await vatRes.json()) as VatAccount);
      setCompensation((await compRes.json()) as CompensationEffect[]);
      setInvoices((await invRes.json()) as FinanceInvoice[]);
      setBillingCandidates((await candRes.json()) as BillingCandidate[]);
      setCompanyProfile((await companyRes.json()) as CompanyProfile);
      setInvoiceAgenda((await agendaRes.json()) as InvoiceAgendaItem[]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token, financeWeekStart]);

  const loadCatalog = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${CATALOG_API}/services`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(await res.text());
      setCatalogServices((await res.json()) as CatalogService[]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token]);

  useEffect(() => {
    if (user && token) {
      void loadBookable();
      void loadEntries();
    }
  }, [user, token, loadBookable, loadEntries]);

  useEffect(() => {
    if (!token || !user || view !== "admin") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadAdminEntries();
    void loadManagedProjects();
  }, [token, user, view, loadAdminEntries, loadManagedProjects]);

  useEffect(() => {
    if (!token || !user || view !== "finance") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadFinance();
  }, [token, user, view, loadFinance, financeWeekStart]);

  useEffect(() => {
    if (!token || !user || view !== "catalog") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadCatalog();
  }, [token, user, view, loadCatalog]);

  useEffect(() => {
    if (!token || view !== "admin" || !projectCreateCustomerQuery.trim()) {
      setProjectCreateCustomers([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `${CUSTOMER_API}/customers?q=${encodeURIComponent(projectCreateCustomerQuery.trim())}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!res.ok) return;
        setProjectCreateCustomers((await res.json()) as Customer[]);
      } catch {
        setProjectCreateCustomers([]);
      }
    }, 200);
    return () => window.clearTimeout(handle);
  }, [token, view, projectCreateCustomerQuery]);

  const loadMsps = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${CUSTOMER_API}/customers/msps`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setMspCustomers((await res.json()) as Customer[]);
    } catch {
      setMspCustomers([]);
    }
  }, [token]);

  useEffect(() => {
    if (!token || !projectCreateCustomerId) {
      setProjectBillable(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(`${CUSTOMER_API}/customers/${projectCreateCustomerId}/billable`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        setProjectBillable((await res.json()) as BillableCheck);
      } catch {
        setProjectBillable(null);
      }
    })();
  }, [token, projectCreateCustomerId]);

  useEffect(() => {
    if (!token || view !== "admin") return;
    void loadCatalog();
  }, [token, view, loadCatalog]);

  useEffect(() => {
    if (!token || view !== "customers") return;
    void loadMsps();
    const handle = window.setTimeout(() => {
      void searchCustomers(customerQuery);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [token, view, customerQuery, searchCustomers, loadMsps]);

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
    setAdminEntries([]);
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
    if (typeof detail === "string") {
      if (detail === "has_open_projects") return t("customer.hasOpenProjects");
      if (detail === "has_child_accounts") return t("customer.hasChildAccounts");
      if (detail === "project_service_unavailable") return t("customer.projectServiceUnavailable");
      if (detail === "parent_not_msp") return t("customer.parentNotMsp");
      if (detail === "parent_not_found") return t("customer.parentNotFound");
      if (detail === "msp_cannot_have_parent") return t("customer.mspCannotHaveParent");
      return detail;
    }
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
      is_msp: Boolean(customer.is_msp),
      parent_id: customer.parent_id ?? "",
      contact_name: customer.contact_name,
      contact_email: customer.contact_email ?? "",
      contact_phone: customer.contact_phone ?? "",
      address_line1: customer.address_line1 ?? "",
      address_line2: customer.address_line2 ?? "",
      postal_code: customer.postal_code ?? "",
      city: customer.city ?? "",
      country: customer.country ?? "",
      vat_id: customer.vat_id ?? "",
      bank_account: customer.bank_account ?? "",
      coc_number: customer.coc_number ?? "",
      payment_terms_days: String(customer.payment_terms_days ?? 30),
      billing_same_as_address: customer.billing_same_as_address !== false,
      billing_name: customer.billing_name ?? "",
      billing_contact_name: customer.billing_contact_name ?? "",
      billing_email: customer.billing_email ?? "",
      billing_address_line1: customer.billing_address_line1 ?? "",
      billing_address_line2: customer.billing_address_line2 ?? "",
      billing_postal_code: customer.billing_postal_code ?? "",
      billing_city: customer.billing_city ?? "",
      billing_country: customer.billing_country ?? "",
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
      is_msp: customerForm.is_msp,
      parent_id: customerForm.is_msp ? null : customerForm.parent_id.trim() || null,
      contact_name: customerForm.contact_name.trim(),
      contact_email: customerForm.contact_email.trim() || null,
      contact_phone: customerForm.contact_phone.trim() || null,
      address_line1: customerForm.address_line1.trim() || null,
      address_line2: customerForm.address_line2.trim() || null,
      postal_code: customerForm.postal_code.trim() || null,
      city: customerForm.city.trim() || null,
      country: customerForm.country.trim() || null,
      vat_id: customerForm.vat_id.trim() || null,
      bank_account: customerForm.bank_account.trim() || null,
      coc_number: customerForm.coc_number.trim() || null,
      payment_terms_days: Number(customerForm.payment_terms_days) || 30,
      billing_same_as_address: customerForm.billing_same_as_address,
      billing_name: customerForm.billing_name.trim() || null,
      billing_contact_name: customerForm.billing_contact_name.trim() || null,
      billing_email: customerForm.billing_email.trim() || null,
      billing_address_line1: customerForm.billing_same_as_address
        ? null
        : customerForm.billing_address_line1.trim() || null,
      billing_address_line2: customerForm.billing_same_as_address
        ? null
        : customerForm.billing_address_line2.trim() || null,
      billing_postal_code: customerForm.billing_same_as_address
        ? null
        : customerForm.billing_postal_code.trim() || null,
      billing_city: customerForm.billing_same_as_address ? null : customerForm.billing_city.trim() || null,
      billing_country: customerForm.billing_same_as_address
        ? null
        : customerForm.billing_country.trim() || null,
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
      setCustomerQuery(payload.name);
      await Promise.all([searchCustomers(payload.name), loadMsps()]);
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

  async function postEntryAction(id: string, action: "approve" | "refuse") {
    if (!token) return;
    setTimeError(null);
    setAdminStatus(null);
    try {
      const res = await fetch(`${TIME_API}/entries/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.detail === "string" ? detail.detail : res.statusText);
      }
      setAdminStatus(t(`time.actionOk.${action}`));
      await Promise.all([loadEntries(), loadAdminEntries()]);
      // Partner/project consumers apply remaining hours asynchronously.
      await new Promise((resolve) => setTimeout(resolve, 600));
      await loadBookable();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  function deduction(assignment: number, mode: "rate" | "fixed", rate: number, fixed: number): number {
    return mode === "fixed" ? Math.max(0, fixed) : Math.max(0, (assignment * rate) / 100);
  }

  function previewBudget() {
    const assignment = Number(budgetForm.fixed_price_eur) || 0;
    const budget =
      assignment -
      deduction(assignment, budgetForm.risk_mode, Number(budgetForm.risk_rate) || 0, Number(budgetForm.risk_fixed_eur) || 0) -
      deduction(assignment, budgetForm.profit_mode, Number(budgetForm.profit_rate) || 0, Number(budgetForm.profit_fixed_eur) || 0) -
      deduction(
        assignment,
        budgetForm.overhead_mode,
        Number(budgetForm.overhead_rate) || 0,
        Number(budgetForm.overhead_fixed_eur) || 0,
      );
    const safeBudget = Math.max(0, budget);
    const rows = staffingDraft.map((s) => {
      const rate = Number(s.rate_eur) || 0;
      const share = Number(s.share_pct) || 0;
      const euro = safeBudget * (share / 100);
      const hours = rate > 0 ? euro / rate : 0;
      return {
        key: s.key,
        label: s.display_name.trim() || "—",
        rate,
        share,
        hours,
      };
    });
    return {
      budget: safeBudget,
      hours: rows.reduce((sum, r) => sum + r.hours, 0),
      shareSum: rows.reduce((sum, r) => sum + r.share, 0),
      rows,
    };
  }

  function startEditProject(project: ProjectDetail) {
    setEditingProjectId(project.id);
    setBudgetForm({
      fixed_price_eur: String(project.fixed_price_eur ?? 0),
      risk_mode: project.risk_mode || "rate",
      risk_rate: String(project.risk_rate ?? 0),
      risk_fixed_eur: String(project.risk_fixed_eur ?? 0),
      profit_mode: project.profit_mode || "rate",
      profit_rate: String(project.profit_rate ?? 0),
      profit_fixed_eur: String(project.profit_fixed_eur ?? 0),
      overhead_mode: project.overhead_mode || "rate",
      overhead_rate: String(project.overhead_rate ?? 0),
      overhead_fixed_eur: String(project.overhead_fixed_eur ?? 0),
      progress: project.progress || "none",
      report_url: project.report_url || "",
    });
    setStaffingDraft(
      project.staffing.length
        ? project.staffing.map((s) => ({
            key: s.id || s.consultant_rate_id || crypto.randomUUID(),
            partner_id: s.partner_id || "",
            consultant_rate_id: s.consultant_rate_id || "",
            display_name: s.display_name || "",
            rate_eur: String(s.rate_eur ?? ""),
            share_pct: String(s.share_pct),
          }))
        : [],
    );
    setAdminStatus(null);
  }

  async function saveProjectBudget() {
    if (!token || !editingProjectId) return;
    setTimeError(null);
    setAdminStatus(null);
    try {
      const res = await fetch(`${PROJECT_API}/projects/${editingProjectId}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fixed_price_eur: Number(budgetForm.fixed_price_eur) || 0,
          risk_mode: budgetForm.risk_mode,
          risk_rate: Number(budgetForm.risk_rate) || 0,
          risk_fixed_eur: Number(budgetForm.risk_fixed_eur) || 0,
          profit_mode: budgetForm.profit_mode,
          profit_rate: Number(budgetForm.profit_rate) || 0,
          profit_fixed_eur: Number(budgetForm.profit_fixed_eur) || 0,
          overhead_mode: budgetForm.overhead_mode,
          overhead_rate: Number(budgetForm.overhead_rate) || 0,
          overhead_fixed_eur: Number(budgetForm.overhead_fixed_eur) || 0,
          progress: budgetForm.progress,
          report_url: budgetForm.progress === "complete" ? budgetForm.report_url.trim() || null : null,
          staffing: staffingDraft.map((s) => ({
            display_name: s.display_name.trim(),
            rate_eur: Number(s.rate_eur) || 0,
            share_pct: Number(s.share_pct) || 0,
            partner_id: s.partner_id || undefined,
            consultant_rate_id: s.consultant_rate_id || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.detail === "string" ? detail.detail : res.statusText);
      }
      setAdminStatus(t("budget.saved"));
      setEditingProjectId(null);
      await Promise.all([loadManagedProjects(), loadBookable()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function generateProjectInvoice(projectId: string, kind: string) {
    if (!token) return;
    setTimeError(null);
    setFinanceStatus(null);
    try {
      const res = await fetch(`${FINANCE_API}/invoices/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ project_id: projectId, kind }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.detail === "string" ? detail.detail : res.statusText);
      }
      setFinanceStatus(t("finance.invoiceGenerated"));
      await loadFinance();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function patchInvoiceStatus(id: string, nextStatus: string) {
    if (!token) return;
    setTimeError(null);
    setFinanceStatus(null);
    try {
      const res = await fetch(`${FINANCE_API}/invoices/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.detail === "string" ? detail.detail : res.statusText);
      }
      setFinanceStatus(t("finance.invoiceUpdated"));
      await loadFinance();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function undoCompensation(timeEntryId: string) {
    if (!token) return;
    setTimeError(null);
    setFinanceStatus(null);
    try {
      const res = await fetch(`${FINANCE_API}/compensation/${timeEntryId}/undo`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.detail === "string" ? detail.detail : res.statusText);
      }
      setFinanceStatus(t("finance.compensationUndone"));
      await loadFinance();
      await Promise.all([loadEntries(), loadAdminEntries(), loadBookable()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function remitVat(year: number, quarter: number) {
    if (!token) return;
    setTimeError(null);
    setFinanceStatus(null);
    try {
      const res = await fetch(`${FINANCE_API}/vat/remit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ year, quarter }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.detail === "string" ? detail.detail : res.statusText);
      }
      setVatAccount((await res.json()) as VatAccount);
      setFinanceStatus(t("finance.vatRemitted"));
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function downloadInvoicePdf(invoiceId: string) {
    if (!token) return;
    try {
      const res = await fetch(`${FINANCE_API}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(res.statusText);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function saveCatalogService(serviceId: string, version: string) {
    if (!token) return;
    setTimeError(null);
    setAdminStatus(null);
    try {
      const res = await fetch(
        `${CATALOG_API}/services/${serviceId}?version=${encodeURIComponent(version)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            list_price_eur: Number(catalogForm.list_price_eur) || 0,
            estimated_hours: Number(catalogForm.estimated_hours) || 0,
            name_en: catalogForm.name_en.trim() || undefined,
          }),
        },
      );
      if (!res.ok) throw new Error(await res.text());
      setAdminStatus(t("catalog.saved"));
      setEditingCatalogId(null);
      await loadCatalog();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function createProjectFromCatalog() {
    if (!token || !projectCreateCustomerId || !projectCreateServiceId) return;
    setTimeError(null);
    setAdminStatus(null);
    const customer = projectCreateCustomers.find((c) => c.id === projectCreateCustomerId);
    const service = catalogServices.find((s) => s.service_id === projectCreateServiceId);
    if (!customer || !service) return;
    try {
      const res = await fetch(`${PROJECT_API}/projects`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customer_id: customer.id,
          customer_name: customer.name,
          service_id: service.service_id,
          service_version: service.version,
          name: projectCreateName.trim() || undefined,
          fixed_price_eur: service.list_price_eur ?? undefined,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        if (detail.detail?.code === "customer_not_billable") {
          throw new Error(t("project.notBillable", { missing: (detail.detail.missing || []).join(", ") }));
        }
        throw new Error(typeof detail.detail === "string" ? detail.detail : res.statusText);
      }
      setAdminStatus(t("project.created"));
      setProjectCreateCustomerId("");
      setProjectCreateCustomerQuery("");
      setProjectCreateServiceId("");
      setProjectCreateName("");
      await Promise.all([loadManagedProjects(), loadBookable()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  const budgetPreview = previewBudget();

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
  const activeView: AppView =
    (view === "admin" || view === "finance" || view === "catalog") && !isManager ? "hours" : view;
  const overdueCount = invoiceAgenda.filter((a) => a.overdue).length;
  const weekDateSet = new Set(weekDates);
  // Pending inbox is cross-week; approved list for refuse/reopen stays week-scoped.
  const submittedEntries = adminEntries.filter((e) => e.status === "submitted");
  const correctionEntries = adminEntries.filter(
    (e) => e.status === "approved" && weekDateSet.has(e.work_date),
  );
  const displayName = brand?.display_name ?? "Platform";
  const rowLabel = (id: string) => rows.find((r) => r.id === id)?.label ?? id;
  const whoLabel = (entry: TimeEntry) =>
    user && entry.partner_id === user.id ? t("time.you") : t("time.colleague");

  function goToView(next: AppView) {
    if (typeof document !== "undefined") {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    }
    setAdminStatus(null);
    setView(next);
  }

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
          }}
          onDoubleClick={() => {
            if (locked) return;
            activeCellKey.current = key;
            setDraftHours((prev) => {
              const current = prev[key];
              if (current !== undefined && current.trim() !== "") return prev;
              return { ...prev, [key]: "8" };
            });
          }}
          onChange={(e) => {
            const value = e.target.value;
            if (value !== "" && !/^\d{0,2}([.,]\d{0,2})?$/.test(value)) return;
            setDraftHours((prev) => ({ ...prev, [key]: value.replace(",", ".") }));
          }}
          onBlur={(e) => {
            const hours = e.currentTarget.value.trim();
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
              onClick={() => goToView("hours")}
            >
              {t("nav.hours")}
            </button>
            {isManager ? (
              <button
                type="button"
                className={view === "admin" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("admin")}
              >
                {t("nav.admin")}
              </button>
            ) : null}
            {isManager ? (
              <button
                type="button"
                className={view === "finance" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("finance")}
              >
                {t("nav.finance")}
              </button>
            ) : null}
            {isManager ? (
              <button
                type="button"
                className={view === "catalog" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("catalog")}
              >
                {t("nav.catalog")}
              </button>
            ) : null}
            <button
              type="button"
              className={view === "customers" ? "nav-item active" : "nav-item"}
              onClick={() => goToView("customers")}
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
                    onChange={(e) => {
                      setCustomerError(null);
                      setCustomerQuery(e.target.value);
                    }}
                    placeholder={t("customer.searchPlaceholder")}
                    autoComplete="off"
                  />
                  {customerError ? <p className="status error">{customerError}</p> : null}
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
                              {customer.is_msp ? t("customer.badgeMsp") : null}
                              {customer.is_msp && customer.parent_name ? " · " : null}
                              {customer.parent_name
                                ? t("customer.childOf", { name: customer.parent_name })
                                : null}
                              {(customer.is_msp || customer.parent_name) && customer.contact_name
                                ? " · "
                                : null}
                              {customer.contact_name}
                              {customerChannel(customer) ? ` · ${customerChannel(customer)}` : ""}
                            </div>
                            {customer.parent_id && customer.bill_to_name ? (
                              <div className="muted">
                                {t("customer.billedTo", { name: customer.bill_to_name })}
                              </div>
                            ) : null}
                            {customer.vat_id ? (
                              <div className="muted">
                                {t("customer.vatId")}: {customer.vat_id}
                              </div>
                            ) : null}
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
                    <label className="checkbox-row" htmlFor="customerIsMsp">
                      <input
                        id="customerIsMsp"
                        type="checkbox"
                        checked={customerForm.is_msp}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({
                            ...prev,
                            is_msp: e.target.checked,
                            parent_id: e.target.checked ? "" : prev.parent_id,
                          }))
                        }
                      />
                      {t("customer.isMsp")}
                    </label>
                    {!customerForm.is_msp ? (
                      <>
                        <label htmlFor="customerParent">{t("customer.parentMsp")}</label>
                        <select
                          id="customerParent"
                          value={customerForm.parent_id}
                          onChange={(e) =>
                            setCustomerForm((prev) => ({ ...prev, parent_id: e.target.value }))
                          }
                        >
                          <option value="">{t("customer.parentNone")}</option>
                          {mspCustomers
                            .filter((m) => m.id !== editingCustomerId)
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                        </select>
                        <p className="field-hint">{t("customer.parentHint")}</p>
                      </>
                    ) : (
                      <p className="field-hint">{t("customer.mspHint")}</p>
                    )}
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
                    <legend>{t("customer.sectionBilling")}</legend>
                    <label htmlFor="vatId">{t("customer.vatId")}</label>
                    <input
                      id="vatId"
                      value={customerForm.vat_id}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, vat_id: e.target.value }))}
                      maxLength={64}
                    />
                    <label htmlFor="cocNumber">{t("customer.cocNumber")}</label>
                    <input
                      id="cocNumber"
                      value={customerForm.coc_number}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, coc_number: e.target.value }))}
                      maxLength={64}
                    />
                    <label htmlFor="bankAccount">{t("customer.bankAccount")}</label>
                    <input
                      id="bankAccount"
                      value={customerForm.bank_account}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, bank_account: e.target.value }))}
                      maxLength={64}
                    />
                    <label htmlFor="paymentTerms">{t("customer.paymentTerms")}</label>
                    <input
                      id="paymentTerms"
                      type="number"
                      min="0"
                      max="365"
                      value={customerForm.payment_terms_days}
                      onChange={(e) =>
                        setCustomerForm((prev) => ({ ...prev, payment_terms_days: e.target.value }))
                      }
                    />
                    <label htmlFor="billingName">{t("customer.billingName")}</label>
                    <input
                      id="billingName"
                      value={customerForm.billing_name}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, billing_name: e.target.value }))}
                      maxLength={200}
                    />
                    <label htmlFor="billingContact">{t("customer.billingContactName")}</label>
                    <input
                      id="billingContact"
                      value={customerForm.billing_contact_name}
                      onChange={(e) =>
                        setCustomerForm((prev) => ({ ...prev, billing_contact_name: e.target.value }))
                      }
                      maxLength={200}
                    />
                    <label htmlFor="billingEmail">{t("customer.billingEmail")}</label>
                    <input
                      id="billingEmail"
                      type="email"
                      value={customerForm.billing_email}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, billing_email: e.target.value }))}
                      maxLength={320}
                    />
                    <label className="checkbox-row" htmlFor="billingSame">
                      <input
                        id="billingSame"
                        type="checkbox"
                        checked={customerForm.billing_same_as_address}
                        onChange={(e) =>
                          setCustomerForm((prev) => ({
                            ...prev,
                            billing_same_as_address: e.target.checked,
                          }))
                        }
                      />
                      {t("customer.billingSameAsAddress")}
                    </label>
                    {!customerForm.billing_same_as_address ? (
                      <>
                        <label htmlFor="billingLine1">{t("customer.billingAddressLine1")}</label>
                        <input
                          id="billingLine1"
                          value={customerForm.billing_address_line1}
                          onChange={(e) =>
                            setCustomerForm((prev) => ({ ...prev, billing_address_line1: e.target.value }))
                          }
                          maxLength={200}
                        />
                        <label htmlFor="billingLine2">{t("customer.billingAddressLine2")}</label>
                        <input
                          id="billingLine2"
                          value={customerForm.billing_address_line2}
                          onChange={(e) =>
                            setCustomerForm((prev) => ({ ...prev, billing_address_line2: e.target.value }))
                          }
                          maxLength={200}
                        />
                        <div className="form-row">
                          <div>
                            <label htmlFor="billingPostal">{t("customer.billingPostalCode")}</label>
                            <input
                              id="billingPostal"
                              value={customerForm.billing_postal_code}
                              onChange={(e) =>
                                setCustomerForm((prev) => ({
                                  ...prev,
                                  billing_postal_code: e.target.value,
                                }))
                              }
                              maxLength={32}
                            />
                          </div>
                          <div>
                            <label htmlFor="billingCity">{t("customer.billingCity")}</label>
                            <input
                              id="billingCity"
                              value={customerForm.billing_city}
                              onChange={(e) =>
                                setCustomerForm((prev) => ({ ...prev, billing_city: e.target.value }))
                              }
                              maxLength={120}
                            />
                          </div>
                        </div>
                        <label htmlFor="billingCountry">{t("customer.billingCountry")}</label>
                        <input
                          id="billingCountry"
                          value={customerForm.billing_country}
                          onChange={(e) =>
                            setCustomerForm((prev) => ({ ...prev, billing_country: e.target.value }))
                          }
                          maxLength={120}
                        />
                      </>
                    ) : null}
                    <label htmlFor="customerNotes">{t("customer.notes")}</label>
                    <textarea
                      id="customerNotes"
                      value={customerForm.notes}
                      onChange={(e) => setCustomerForm((prev) => ({ ...prev, notes: e.target.value }))}
                      rows={3}
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
                  {customerError ? <p className="status error">{customerError}</p> : null}
                </form>
              </section>
            ) : null}

            {activeView === "finance" && isManager ? (
              <>
                <section className="panel wide">
                  <h1>{t("finance.agendaTitle")}</h1>
                  <div className="actions week-actions">
                    <button type="button" onClick={() => setFinanceWeekStart((w) => addDays(w, -7))}>
                      {t("time.prevWeek")}
                    </button>
                    <button type="button" onClick={() => setFinanceWeekStart(startOfIsoWeek(new Date()))}>
                      {t("time.thisWeek")}
                    </button>
                    <button type="button" onClick={() => setFinanceWeekStart((w) => addDays(w, 7))}>
                      {t("time.nextWeek")}
                    </button>
                  </div>
                  <p className="week-range">{formatWeekRange(financeWeekStart, i18n.language)}</p>
                  {overdueCount > 0 ? (
                    <p className="status error">{t("finance.overdueAlert", { count: overdueCount })}</p>
                  ) : null}
                  {invoiceAgenda.length === 0 ? (
                    <p className="status">{t("finance.agendaEmpty")}</p>
                  ) : (
                    <ul className="entry-list">
                      {invoiceAgenda.map((item) => (
                        <li key={item.invoice_id}>
                          <div>
                            <strong>
                              {item.invoice_number} · {item.customer_name} · €{item.amount_eur.toFixed(2)}
                            </strong>
                            <div className={item.overdue ? "muted error" : "muted"}>
                              {t("finance.dueLine", {
                                date: item.due_date,
                                days: item.days_until_due,
                              })}
                              {item.overdue ? ` · ${t("finance.overdue")}` : ""}
                            </div>
                          </div>
                          <div className="entry-actions">
                            {item.has_pdf ? (
                              <button type="button" onClick={() => void downloadInvoicePdf(item.invoice_id)}>
                                {t("finance.downloadPdf")}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="panel wide">
                  <h1>{t("finance.billingTitle")}</h1>
                  <p>{t("finance.billingIntro")}</p>
                  {financeStatus ? <p className="status">{financeStatus}</p> : null}
                  {timeError ? <p className="status error">{timeError}</p> : null}
                  {companyProfile ? (
                    <p className="status">
                      {t("finance.sellerLine", {
                        name: companyProfile.legal_name,
                        vat: companyProfile.vat_id || "—",
                        iban: companyProfile.bank_account || "—",
                      })}
                    </p>
                  ) : null}
                  {billingCandidates.length === 0 ? (
                    <p className="status">{t("finance.billingEmpty")}</p>
                  ) : (
                    <ul className="entry-list">
                      {billingCandidates.map((c) => (
                        <li key={c.project_id}>
                          <div>
                            <strong>
                              {c.customer_name} · {c.project_name}
                            </strong>
                            <div className="muted">
                              €{c.fixed_price_eur} · {t(`finance.progress.${c.progress}`)}
                              {c.report_url ? (
                                <>
                                  {" · "}
                                  <a href={c.report_url} target="_blank" rel="noreferrer">
                                    {t("finance.clientReport")}
                                  </a>
                                </>
                              ) : null}
                            </div>
                          </div>
                          <div className="entry-actions">
                            {c.actions.map((a) => (
                              <button
                                key={a.kind}
                                type="button"
                                className="primary"
                                disabled={!a.enabled}
                                onClick={() => void generateProjectInvoice(c.project_id, a.kind)}
                              >
                                {a.label}
                                {a.amount_eur > 0 ? ` (€${a.amount_eur.toFixed(2)})` : ""}
                              </button>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="panel wide">
                  <h2>{t("finance.invoices")}</h2>
                  {invoices.length === 0 ? (
                    <p className="status">{t("finance.invoicesEmpty")}</p>
                  ) : (
                    <ul className="entry-list">
                      {invoices.map((inv) => (
                        <li key={inv.id}>
                          <div>
                            <strong>
                              {inv.invoice_number} · {inv.customer_name} · €{inv.amount_eur.toFixed(2)}
                            </strong>
                            <div className="muted">
                              {inv.project_name} · {t(`finance.kind.${inv.kind}`, { defaultValue: inv.kind })} ·{" "}
                              {t(`finance.status.${inv.status}`, { defaultValue: inv.status })}
                              {inv.due_date ? ` · ${t("finance.due")} ${inv.due_date.slice(0, 10)}` : ""}
                            </div>
                            <div className="muted">
                              {t("finance.invoiceParties", {
                                seller: inv.seller_name || "—",
                                buyer: inv.customer_name,
                              })}
                            </div>
                            {inv.lines?.map((line) => (
                              <div key={line.id} className="muted">
                                {line.description}: {line.quantity}
                                {line.unit === "hour" ? "h" : ""} × €{line.unit_price_eur} = €
                                {line.amount_eur.toFixed(2)}
                              </div>
                            ))}
                            <div className="muted">
                              {t("finance.vatLine", {
                                subtotal: inv.subtotal_eur.toFixed(2),
                                vat: inv.vat_eur.toFixed(2),
                                rate: inv.vat_rate,
                                total: inv.amount_eur.toFixed(2),
                              })}
                            </div>
                          </div>
                          <div className="entry-actions">
                            {inv.status === "draft" ? (
                              <button type="button" onClick={() => void patchInvoiceStatus(inv.id, "issued")}>
                                {t("finance.sendInvoice")}
                              </button>
                            ) : null}
                            {inv.status === "issued" ? (
                              <>
                                <button type="button" onClick={() => void patchInvoiceStatus(inv.id, "paid")}>
                                  {t("finance.markPaid")}
                                </button>
                                <button type="button" onClick={() => void patchInvoiceStatus(inv.id, "returned")}>
                                  {t("finance.markReturned")}
                                </button>
                                {inv.pdf_path ? (
                                  <button type="button" onClick={() => void downloadInvoicePdf(inv.id)}>
                                    {t("finance.downloadPdf")}
                                  </button>
                                ) : null}
                              </>
                            ) : null}
                            {inv.status === "paid" && inv.pdf_path ? (
                              <button type="button" onClick={() => void downloadInvoicePdf(inv.id)}>
                                {t("finance.downloadPdf")}
                              </button>
                            ) : null}
                            {inv.status === "returned" ? (
                              <button type="button" onClick={() => void patchInvoiceStatus(inv.id, "draft")}>
                                {t("finance.reopenDraft")}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                <section className="panel wide">
                  <h2>{t("finance.internalTitle")}</h2>
                  <p className="status">{t("finance.internalIntro")}</p>
                  {reserve ? (
                    <p className="status">
                      {t("finance.reserveLine", {
                        current: reserve.current_reserve_eur.toFixed(2),
                        target: reserve.target_eur.toFixed(2),
                        surplus: reserve.surplus_eur.toFixed(2),
                      })}
                    </p>
                  ) : null}
                  {vatAccount ? (
                    <>
                      <h3>{t("finance.vatAccount")}</h3>
                      <p className="status">{t("finance.vatIntro")}</p>
                      <p className="status">
                        {t("finance.vatBalance", {
                          balance: vatAccount.balance_eur.toFixed(2),
                          quarter: vatAccount.current_quarter,
                        })}
                      </p>
                      {vatAccount.quarters.some((q) => q.collected_eur > 0 || q.remitted_eur > 0) ? (
                        <ul className="entry-list">
                          {vatAccount.quarters
                            .filter((q) => q.collected_eur > 0 || q.remitted_eur > 0)
                            .map((q) => (
                              <li key={q.label}>
                                <div>
                                  <strong>{q.label}</strong>
                                  <div className="muted">
                                    {t("finance.vatQuarterLine", {
                                      collected: q.collected_eur.toFixed(2),
                                      remitted: q.remitted_eur.toFixed(2),
                                      outstanding: q.outstanding_eur.toFixed(2),
                                    })}
                                  </div>
                                </div>
                                <div className="entry-actions">
                                  {q.can_remit ? (
                                    <button type="button" onClick={() => void remitVat(q.year, q.quarter)}>
                                      {t("finance.vatRemit")}
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="status">{t("finance.vatEmpty")}</p>
                      )}
                    </>
                  ) : null}
                  <h3>{t("finance.compensation")}</h3>
                  {compensation.length > 0 ? (
                    <ul className="entry-list">
                      {compensation.map((row) => (
                        <li key={row.time_entry_id}>
                          <div>
                            <strong>{row.partner_name}</strong>
                            <div className="muted">
                              {t(
                                row.classification === "approved_non_billable"
                                  ? "finance.compensationChargeback"
                                  : "finance.compensationBillable",
                                {
                                  hours: row.hours,
                                  rate: row.rate_eur.toFixed(2),
                                  eur: row.amount_eur.toFixed(2),
                                },
                              )}
                              {row.project_id ? ` · ${rowLabel(row.project_id)}` : ""}
                            </div>
                            {!row.can_undo ? (
                              <div className="muted">{t("finance.compensationInvoiced")}</div>
                            ) : null}
                          </div>
                          <div className="entry-actions">
                            <button
                              type="button"
                              disabled={!row.can_undo}
                              onClick={() => void undoCompensation(row.time_entry_id)}
                            >
                              {t("finance.compensationUndo")}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="status">{t("finance.compensationEmpty")}</p>
                  )}
                </section>
              </>
            ) : null}

            {activeView === "catalog" && isManager ? (
              <section className="panel wide">
                <h1>{t("catalog.title")}</h1>
                <p>{t("catalog.intro")}</p>
                {adminStatus ? <p className="status">{adminStatus}</p> : null}
                {timeError ? <p className="status error">{timeError}</p> : null}
                {catalogServices.length === 0 ? (
                  <p className="status">{t("catalog.empty")}</p>
                ) : (
                  <ul className="entry-list">
                    {catalogServices.map((s) => (
                      <li key={`${s.service_id}-${s.version}`}>
                        <div>
                          <strong>{s.name.en || s.service_id}</strong>
                          <div className="muted">
                            {s.service_id} v{s.version} · {s.estimated_hours ?? "—"}h · €
                            {s.list_price_eur?.toLocaleString() ?? "—"}
                          </div>
                        </div>
                        <div className="entry-actions">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCatalogId(`${s.service_id}|${s.version}`);
                              setCatalogForm({
                                name_en: s.name.en || "",
                                list_price_eur: String(s.list_price_eur ?? ""),
                                estimated_hours: String(s.estimated_hours ?? ""),
                              });
                            }}
                          >
                            {t("catalog.edit")}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {editingCatalogId ? (
                  <div className="customer-form">
                    <h2>{t("catalog.editTitle")}</h2>
                    <label htmlFor="catName">{t("catalog.name")}</label>
                    <input
                      id="catName"
                      value={catalogForm.name_en}
                      onChange={(e) => setCatalogForm((p) => ({ ...p, name_en: e.target.value }))}
                    />
                    <label htmlFor="catPrice">{t("catalog.listPrice")}</label>
                    <input
                      id="catPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={catalogForm.list_price_eur}
                      onChange={(e) => setCatalogForm((p) => ({ ...p, list_price_eur: e.target.value }))}
                    />
                    <label htmlFor="catHours">{t("catalog.typicalHours")}</label>
                    <input
                      id="catHours"
                      type="number"
                      min="1"
                      step="1"
                      value={catalogForm.estimated_hours}
                      onChange={(e) => setCatalogForm((p) => ({ ...p, estimated_hours: e.target.value }))}
                    />
                    <div className="actions">
                      <button
                        type="button"
                        className="primary"
                        onClick={() => {
                          const [sid, ver] = editingCatalogId.split("|");
                          void saveCatalogService(sid, ver);
                        }}
                      >
                        {t("catalog.save")}
                      </button>
                      <button type="button" onClick={() => setEditingCatalogId(null)}>
                        {t("customer.cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}
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
                  {timeError ? <p className="status error">{timeError}</p> : null}
                  {adminStatus ? <p className="status">{adminStatus}</p> : null}
                </section>

                <section className="panel wide">
                  <h2>{t("time.entries")}</h2>
                  <p className="status">{t("time.pendingHint")}</p>
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
                  <h2>{t("project.createTitle")}</h2>
                  <p className="status">{t("project.createIntro")}</p>
                  <label htmlFor="projectCustomerSearch">{t("project.customerSearch")}</label>
                  <input
                    id="projectCustomerSearch"
                    value={projectCreateCustomerQuery}
                    onChange={(e) => setProjectCreateCustomerQuery(e.target.value)}
                    placeholder={t("project.customerSearchHint")}
                  />
                  {projectCreateCustomers.length > 0 ? (
                    <ul className="entry-list">
                      {projectCreateCustomers.map((c) => (
                        <li key={c.id}>
                          <button
                            type="button"
                            className={projectCreateCustomerId === c.id ? "primary" : ""}
                            onClick={() => setProjectCreateCustomerId(c.id)}
                          >
                            {c.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {projectBillable && !projectBillable.ok ? (
                    <p className="status error">
                      {t("project.notBillable", { missing: projectBillable.missing.join(", ") })}
                    </p>
                  ) : projectBillable?.ok ? (
                    <p className="status">{t("project.billableOk")}</p>
                  ) : null}
                  <label htmlFor="projectService">{t("project.catalogOffering")}</label>
                  <select
                    id="projectService"
                    value={projectCreateServiceId}
                    onChange={(e) => setProjectCreateServiceId(e.target.value)}
                  >
                    <option value="">{t("project.pickService")}</option>
                    {catalogServices.map((s) => (
                      <option key={`${s.service_id}-${s.version}`} value={s.service_id}>
                        {(s.name.en || s.service_id) +
                          (s.list_price_eur != null ? ` · €${s.list_price_eur}` : "")}
                      </option>
                    ))}
                  </select>
                  <label htmlFor="projectName">{t("project.nameOptional")}</label>
                  <input
                    id="projectName"
                    value={projectCreateName}
                    onChange={(e) => setProjectCreateName(e.target.value)}
                  />
                  <div className="actions">
                    <button
                      type="button"
                      className="primary"
                      disabled={!projectCreateCustomerId || !projectCreateServiceId || !projectBillable?.ok}
                      onClick={() => void createProjectFromCatalog()}
                    >
                      {t("project.create")}
                    </button>
                  </div>
                </section>

                <section className="panel wide">
                  <h2>{t("budget.projectsTitle")}</h2>
                  <p className="status">{t("budget.projectsIntro")}</p>
                  <ul className="entry-list">
                    {managedProjects.map((project) => (
                      <li key={project.id}>
                        <div>
                          <strong>
                            {project.customer_name} · {project.name}
                          </strong>
                          <div className="muted">
                            €{project.fixed_price_eur} → €{project.consultancy_budget_eur} ·{" "}
                            {project.contracted_hours}h ({t("time.remaining", { hours: project.remaining_hours })})
                          </div>
                        </div>
                        <div className="entry-actions">
                          <button type="button" onClick={() => startEditProject(project)}>
                            {t("budget.edit")}
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>

                  {editingProjectId ? (
                    <div className="customer-form">
                      <h2>{t("budget.editTitle")}</h2>
                      <label htmlFor="fixedPrice">{t("budget.fixedPrice")}</label>
                      <input
                        id="fixedPrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={budgetForm.fixed_price_eur}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, fixed_price_eur: e.target.value }))}
                      />

                      {(
                        [
                          ["risk", "risk_mode", "risk_rate", "risk_fixed_eur"],
                          ["profit", "profit_mode", "profit_rate", "profit_fixed_eur"],
                          ["overhead", "overhead_mode", "overhead_rate", "overhead_fixed_eur"],
                        ] as const
                      ).map(([key, modeKey, rateKey, fixedKey]) => (
                        <fieldset key={key} className="fields-optional">
                          <legend>{t(`budget.${key}`)}</legend>
                          <label htmlFor={`${key}Mode`}>{t("budget.mode")}</label>
                          <select
                            id={`${key}Mode`}
                            value={budgetForm[modeKey]}
                            onChange={(e) =>
                              setBudgetForm((p) => ({
                                ...p,
                                [modeKey]: e.target.value as "rate" | "fixed",
                              }))
                            }
                          >
                            <option value="rate">{t("budget.modeRate")}</option>
                            <option value="fixed">{t("budget.modeFixed")}</option>
                          </select>
                          {budgetForm[modeKey] === "rate" ? (
                            <>
                              <label htmlFor={`${key}Rate`}>{t("budget.ratePct")}</label>
                              <input
                                id={`${key}Rate`}
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                value={budgetForm[rateKey]}
                                onChange={(e) => setBudgetForm((p) => ({ ...p, [rateKey]: e.target.value }))}
                              />
                            </>
                          ) : (
                            <>
                              <label htmlFor={`${key}Fixed`}>{t("budget.fixedEur")}</label>
                              <input
                                id={`${key}Fixed`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={budgetForm[fixedKey]}
                                onChange={(e) => setBudgetForm((p) => ({ ...p, [fixedKey]: e.target.value }))}
                              />
                            </>
                          )}
                        </fieldset>
                      ))}

                      <h3>{t("budget.progress")}</h3>
                      <label htmlFor="projectProgress">{t("budget.progressLabel")}</label>
                      <select
                        id="projectProgress"
                        value={budgetForm.progress}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, progress: e.target.value }))}
                      >
                        <option value="none">{t("budget.progressNone")}</option>
                        <option value="25">25%</option>
                        <option value="50">50%</option>
                        <option value="75">75%</option>
                        <option value="complete">{t("budget.progressComplete")}</option>
                      </select>
                      {budgetForm.progress === "complete" ? (
                        <>
                          <label htmlFor="reportUrl">{t("budget.reportUrl")}</label>
                          <input
                            id="reportUrl"
                            type="url"
                            value={budgetForm.report_url}
                            onChange={(e) => setBudgetForm((p) => ({ ...p, report_url: e.target.value }))}
                            placeholder="https://"
                          />
                          <p className="field-hint">{t("budget.reportHint")}</p>
                        </>
                      ) : null}

                      <h3>{t("budget.staffing")}</h3>
                      <p className="status">{t("budget.staffingHint")}</p>
                      {staffingDraft.map((row, idx) => (
                        <div key={row.key} className="form-row">
                          <div>
                            <label>{t("budget.consultant")}</label>
                            <input
                              value={row.display_name}
                              onChange={(e) =>
                                setStaffingDraft((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, display_name: e.target.value } : r)),
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            <label>{t("budget.hourlyRate")}</label>
                            <input
                              type="number"
                              min="1"
                              step="0.01"
                              value={row.rate_eur}
                              onChange={(e) =>
                                setStaffingDraft((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, rate_eur: e.target.value } : r)),
                                )
                              }
                              required
                            />
                          </div>
                          <div>
                            <label>{t("budget.sharePct")}</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={row.share_pct}
                              onChange={(e) =>
                                setStaffingDraft((prev) =>
                                  prev.map((r, i) => (i === idx ? { ...r, share_pct: e.target.value } : r)),
                                )
                              }
                            />
                          </div>
                          <div className="actions">
                            <button
                              type="button"
                              onClick={() => setStaffingDraft((prev) => prev.filter((_, i) => i !== idx))}
                            >
                              {t("budget.remove")}
                            </button>
                          </div>
                        </div>
                      ))}
                      <div className="actions">
                        <button
                          type="button"
                          onClick={() =>
                            setStaffingDraft((prev) => [
                              ...prev,
                              {
                                key: crypto.randomUUID(),
                                partner_id: "",
                                consultant_rate_id: "",
                                display_name: "",
                                rate_eur: "100",
                                share_pct: prev.length ? "0" : "100",
                              },
                            ])
                          }
                        >
                          {t("budget.addStaff")}
                        </button>
                      </div>

                      <p className="status">
                        {t("budget.preview", {
                          budget: budgetPreview.budget.toFixed(2),
                          hours: budgetPreview.hours.toFixed(2),
                          share: budgetPreview.shareSum.toFixed(1),
                        })}
                      </p>
                      <ul className="entry-list">
                        {budgetPreview.rows.map((r) => (
                          <li key={r.key}>
                            <div>
                              <strong>{r.label}</strong>
                              <div className="muted">
                                {r.share}% · €{r.rate}/h · {r.hours.toFixed(2)}h
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>

                      <div className="actions">
                        <button className="primary" type="button" onClick={() => void saveProjectBudget()}>
                          {t("budget.save")}
                        </button>
                        <button type="button" onClick={() => setEditingProjectId(null)}>
                          {t("customer.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </section>
              </>
            ) : null}
          </main>
        </div>
      )}
    </div>
  );
}
