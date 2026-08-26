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
  funnel_status?: string;
  engagement_type?: "fixed" | "tm";
  kickoff_at?: string | null;
  next_funnel?: string[];
  staffing: ProjectStaffing[];
};

type AvailabilitySlot = {
  starts_at: string;
  ends_at: string;
  consultant_rate_id: string;
  display_name: string;
  duration_minutes: number;
};

type KickoffAppointment = {
  id: string;
  kind: string;
  consultant_rate_id: string;
  display_name: string;
  project_id?: string | null;
  project_name?: string | null;
  customer_name?: string | null;
  notes?: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  duration_minutes: number;
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

type MonthlyCost = {
  id: string;
  label: string;
  amount_eur: number;
  cadence: "one_off" | "recurring";
  start_month: string;
  end_month: string | null;
  notes: string | null;
  invoice_matched: boolean;
  invoice_paid: boolean;
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
  /** Closed / historical project — show booked hours, do not allow new booking. */
  readOnly?: boolean;
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

type Resource = {
  id: string;
  partner_id: string;
  display_name: string;
  billable_rate_eur: number;
  kind: "internal" | "external";
  internal_rate_eur: number;
  is_senior: boolean;
  is_partner: boolean;
  active: boolean;
};

type AppView = "hours" | "admin" | "customers" | "finance" | "catalog" | "projects" | "resources";
type FinancePanel = "operational" | "billing" | "costs" | "kpis" | null;
type UnavailSlot = "am" | "pm" | "after";

const UNAVAIL_SLOTS: { id: UnavailSlot; labelKey: string; startHour: number }[] = [
  { id: "am", labelKey: "agenda.slotAm", startHour: 9 },
  { id: "pm", labelKey: "agenda.slotPm", startHour: 13 },
  { id: "after", labelKey: "agenda.slotAfter", startHour: 17 },
];

const CORP_TAX_RATE = 0.258;

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

/** datetime-local value from ISO (local timezone). */
function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** ISO string from datetime-local, or null if empty. */
function fromDateTimeLocalValue(local: string): string | null {
  const v = local.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
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
  const [projectLabels, setProjectLabels] = useState<Record<string, string>>({});
  const [budgets, setBudgets] = useState<InternalBudget[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [mspCustomers, setMspCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerForm, setCustomerForm] = useState(emptyCustomerForm);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
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
    kickoff_at: "",
  });
  const [staffingDraft, setStaffingDraft] = useState<StaffingDraftRow[]>([]);
  const [reserve, setReserve] = useState<ReserveSnapshot | null>(null);
  const [vatAccount, setVatAccount] = useState<VatAccount | null>(null);
  const [compensation, setCompensation] = useState<CompensationEffect[]>([]);
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [billingCandidates, setBillingCandidates] = useState<BillingCandidate[]>([]);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null);
  const [financeStatus, setFinanceStatus] = useState<string | null>(null);
  const [financePanel, setFinancePanel] = useState<FinancePanel>(null);
  const [invoiceSearch, setInvoiceSearch] = useState({ q: "", date: "", id: "" });
  const [financeWeekStart, setFinanceWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const [invoiceAgenda, setInvoiceAgenda] = useState<InvoiceAgendaItem[]>([]);
  const [kickoffAppointments, setKickoffAppointments] = useState<KickoffAppointment[]>([]);
  const [kickoffPickerProjectId, setKickoffPickerProjectId] = useState<string | null>(null);
  const [kickoffSlots, setKickoffSlots] = useState<AvailabilitySlot[]>([]);
  const [kickoffLoading, setKickoffLoading] = useState(false);
  const [resourceCalendarWeek, setResourceCalendarWeek] = useState(() => startOfIsoWeek(new Date()));
  const [resourceCalendar, setResourceCalendar] = useState<KickoffAppointment[]>([]);
  const [agendaResourceId, setAgendaResourceId] = useState<string>("");
  const [projectAgendaId, setProjectAgendaId] = useState<string>("");
  const [projectAgenda, setProjectAgenda] = useState<KickoffAppointment[]>([]);
  const [calendarForm, setCalendarForm] = useState({
    consultant_rate_id: "",
    day: "",
    slot: "am" as UnavailSlot,
    notes: "",
  });
  const [planningCalendar, setPlanningCalendar] = useState(false);
  const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCost[]>([]);
  const [otherCostForm, setOtherCostForm] = useState({
    label: "",
    amount: "",
    cadence: "one_off" as "one_off" | "recurring",
    start_month: "",
    end_month: "",
    notes: "",
  });
  const [costMonth, setCostMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>([]);
  const [editingCatalogId, setEditingCatalogId] = useState<string | null>(null);
  const [creatingCatalog, setCreatingCatalog] = useState(false);
  const [catalogForm, setCatalogForm] = useState({ list_price_eur: "", estimated_hours: "", name_en: "" });
  const [newCatalogForm, setNewCatalogForm] = useState({
    service_id: "",
    version: "1.0.0",
    name_en: "",
    list_price_eur: "",
    estimated_hours: "",
  });
  const [resources, setResources] = useState<Resource[]>([]);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [creatingResource, setCreatingResource] = useState(false);
  const emptyResourceForm = {
    display_name: "",
    kind: "external" as "internal" | "external",
    billable_rate_eur: "150",
    internal_rate_eur: "75",
    is_senior: false,
    is_partner: false,
  };
  const [resourceForm, setResourceForm] = useState(emptyResourceForm);
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

  const myEntries = useMemo(
    () => (user ? entries.filter((entry) => entry.partner_id === user.id) : entries),
    [entries, user],
  );

  const rows: GridRow[] = useMemo(() => {
    const bookable: GridRow[] = [
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
    ];
    const known = new Set(bookable.map((r) => r.id));
    const historical: GridRow[] = [];
    for (const entry of myEntries) {
      if (!entry.project_id || known.has(entry.project_id)) continue;
      if (historical.some((h) => h.id === entry.project_id)) continue;
      historical.push({
        id: entry.project_id,
        label: projectLabels[entry.project_id] ?? entry.project_id,
        subtitle: undefined,
        classification: entry.classification,
        readOnly: true,
      });
      known.add(entry.project_id);
    }
    return [...bookable, ...historical];
  }, [projects, budgets, myEntries, projectLabels]);

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
      const [projRes, budRes, allRes] = await Promise.all([
        fetch(`${PROJECT_API}/projects/bookable`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${PARTNER_API}/budgets/internal`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${PROJECT_API}/projects/bookable?include_complete=true`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (!projRes.ok) throw new Error(await projRes.text());
      if (!budRes.ok) throw new Error(await budRes.text());
      setProjects((await projRes.json()) as BookableProject[]);
      setBudgets((await budRes.json()) as InternalBudget[]);
      if (allRes.ok) {
        const all = (await allRes.json()) as BookableProject[];
        const labels: Record<string, string> = {};
        for (const p of all) {
          labels[p.id] = `${p.customer_name} · ${p.name}`;
        }
        setProjectLabels(labels);
      }
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
      const res = await fetch(`${PROJECT_API}/projects/bookable?include_complete=true`, {
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
      const [reserveRes, vatRes, compRes, invRes, candRes, companyRes, agendaRes, kickoffRes] =
        await Promise.all([
          fetch(`${FINANCE_API}/reserve`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/vat`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/compensation`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/invoices`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/billing/candidates`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/company`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/invoices/agenda?week_start=${weekStartIso}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${PARTNER_API}/appointments?week_start=${weekStartIso}`, {
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
      if (kickoffRes.ok) {
        setKickoffAppointments((await kickoffRes.json()) as KickoffAppointment[]);
      } else {
        setKickoffAppointments([]);
      }
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token, financeWeekStart]);

  const loadMonthlyCosts = useCallback(async () => {
    if (!token || !costMonth) return;
    try {
      const res = await fetch(`${FINANCE_API}/costs?month=${encodeURIComponent(costMonth)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setMonthlyCosts((await res.json()) as MonthlyCost[]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token, costMonth]);

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

  const loadResources = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${PARTNER_API}/resources`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setResources((await res.json()) as Resource[]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token]);

  const loadResourceCalendar = useCallback(async () => {
    if (!token) return;
    const weekStartIso = toIsoDate(resourceCalendarWeek);
    try {
      const res = await fetch(`${PARTNER_API}/appointments?week_start=${weekStartIso}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setResourceCalendar((await res.json()) as KickoffAppointment[]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token, resourceCalendarWeek]);

  const loadProjectAgenda = useCallback(async () => {
    if (!token || !projectAgendaId) {
      setProjectAgenda([]);
      return;
    }
    const from = toIsoDate(new Date());
    const to = toIsoDate(addDays(new Date(), 90));
    try {
      const res = await fetch(
        `${PARTNER_API}/appointments?from_day=${from}&to_day=${to}&project_id=${encodeURIComponent(projectAgendaId)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      setProjectAgenda((await res.json()) as KickoffAppointment[]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token, projectAgendaId]);

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
  }, [token, user, view, loadAdminEntries]);

  useEffect(() => {
    if (!token || !user || view !== "projects") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadManagedProjects();
    void loadCatalog();
    void loadResources();
  }, [token, user, view, loadManagedProjects, loadCatalog, loadResources]);

  useEffect(() => {
    if (!token || !user || view !== "finance") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadFinance();
    void loadManagedProjects();
    void loadMonthlyCosts();
  }, [token, user, view, loadFinance, financeWeekStart, loadManagedProjects, loadMonthlyCosts]);

  useEffect(() => {
    if (!token || !user || view !== "catalog") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadCatalog();
  }, [token, user, view, loadCatalog]);

  useEffect(() => {
    if (!token || !user || view !== "resources") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadResources();
    void loadResourceCalendar();
    void loadManagedProjects();
  }, [token, user, view, loadResources, loadResourceCalendar, resourceCalendarWeek, loadManagedProjects]);

  useEffect(() => {
    if (!token || !user || view !== "resources") return;
    void loadProjectAgenda();
  }, [token, user, view, loadProjectAgenda]);

  useEffect(() => {
    if (!token || view !== "projects" || !projectCreateCustomerQuery.trim()) {
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
    if (!token || row.readOnly) return;
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
      if (detail === "invalid_funnel_transition") return t("project.invalidFunnelTransition");
      if (detail === "invalid_funnel_status") return t("project.invalidFunnelStatus");
      if (detail === "staffing_resource_required") return t("budget.staffingResourceRequired");
      if (detail === "duplicate_staffing") return t("budget.duplicateStaffing");
      if (detail === "shares_must_sum_100") return t("budget.sharesMustSum");
      if (detail === "invalid_staffing") return t("budget.invalidStaffing");
      if (detail === "invalid_rate") return t("budget.invalidRate");
      if (detail === "slot_unavailable") return t("agenda.slotUnavailable");
      if (detail === "block_must_be_4h") return t("agenda.blockMustBe4h");
      if (detail === "kickoff_already_booked") return t("agenda.alreadyBooked");
      if (detail === "slot_in_past") return t("agenda.slotInPast");
      if (detail === "no_seniors") return t("agenda.noSeniors");
      if (detail === "senior_not_found") return t("agenda.seniorNotFound");
      if (detail === "resource_not_found") return t("agenda.resourceNotFound");
      if (detail === "ends_at_required") return t("agenda.endsRequired");
      if (detail === "consultant_rate_id_required") return t("agenda.resourceRequired");
      if (detail === "invalid_appointment_kind") return t("agenda.invalidKind");
      if (detail === "not_allowed") return t("agenda.notAllowed");
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
    setCreatingCustomer(false);
    setCustomerForm(customerToForm(customer));
    setCustomerError(null);
  }

  function startCreateCustomer() {
    setEditingCustomerId(null);
    setCreatingCustomer(true);
    setCustomerForm(emptyCustomerForm);
    setCustomerError(null);
  }

  function cancelEditCustomer() {
    setEditingCustomerId(null);
    setCreatingCustomer(false);
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
      kickoff_at: toDateTimeLocalValue(project.kickoff_at),
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
    if (staffingDraft.some((s) => !s.consultant_rate_id.trim())) {
      setTimeError(t("budget.staffingResourceRequired"));
      return;
    }
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
          kickoff_at: fromDateTimeLocalValue(budgetForm.kickoff_at),
          staffing: staffingDraft.map((s) => ({
            consultant_rate_id: s.consultant_rate_id,
            display_name: s.display_name.trim(),
            rate_eur: Number(s.rate_eur) || 0,
            share_pct: Number(s.share_pct) || 0,
            partner_id: s.partner_id || undefined,
          })),
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      setAdminStatus(t("budget.saved"));
      setEditingProjectId(null);
      await Promise.all([loadManagedProjects(), loadBookable()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  function assignStaffingResource(idx: number, resourceId: string) {
    const resource = resources.find((r) => r.id === resourceId && r.active);
    setStaffingDraft((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r;
        if (!resource) {
          return {
            ...r,
            consultant_rate_id: "",
            partner_id: "",
            display_name: "",
            rate_eur: "",
          };
        }
        return {
          ...r,
          consultant_rate_id: resource.id,
          partner_id: resource.partner_id,
          display_name: resource.display_name,
          rate_eur: String(resource.billable_rate_eur),
        };
      }),
    );
  }

  async function advanceProjectFunnel(projectId: string, funnelStatus: string) {
    if (!token) return;
    setTimeError(null);
    setAdminStatus(null);
    const project = managedProjects.find((p) => p.id === projectId);
    const kickoff =
      funnelStatus === "kickoff_planned"
        ? fromDateTimeLocalValue(budgetForm.kickoff_at) || project?.kickoff_at || null
        : undefined;
    try {
      const res = await fetch(`${PROJECT_API}/projects/${projectId}/funnel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          funnel_status: funnelStatus,
          ...(kickoff ? { kickoff_at: kickoff } : {}),
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      setAdminStatus(t("project.funnelAdvanced", { stage: t(`project.funnel.${funnelStatus}`) }));
      if (editingProjectId === projectId) setEditingProjectId(null);
      await Promise.all([loadManagedProjects(), loadBookable()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function openKickoffPicker(project: ProjectDetail) {
    if (!token) return;
    setTimeError(null);
    setKickoffPickerProjectId(project.id);
    setKickoffSlots([]);
    setKickoffLoading(true);
    try {
      const from = toIsoDate(new Date());
      const to = toIsoDate(addDays(new Date(), 13));
      const res = await fetch(
        `${PARTNER_API}/availability?from=${from}&to=${to}&senior=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      setKickoffSlots((await res.json()) as AvailabilitySlot[]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
      setKickoffPickerProjectId(null);
    } finally {
      setKickoffLoading(false);
    }
  }

  async function bookKickoffSlot(slot: AvailabilitySlot) {
    if (!token || !kickoffPickerProjectId) return;
    const project = managedProjects.find((p) => p.id === kickoffPickerProjectId);
    if (!project) return;
    setTimeError(null);
    setAdminStatus(null);
    setKickoffLoading(true);
    try {
      const bookRes = await fetch(`${PARTNER_API}/appointments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          starts_at: slot.starts_at,
          consultant_rate_id: slot.consultant_rate_id,
          project_id: project.id,
          project_name: project.name,
          customer_name: project.customer_name,
        }),
      });
      if (!bookRes.ok) {
        const detail = await bookRes.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, bookRes.statusText));
      }
      const funnelRes = await fetch(`${PROJECT_API}/projects/${project.id}/funnel`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          funnel_status: "kickoff_planned",
          kickoff_at: slot.starts_at,
        }),
      });
      if (!funnelRes.ok) {
        const detail = await funnelRes.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, funnelRes.statusText));
      }
      setAdminStatus(
        t("agenda.booked", {
          when: new Date(slot.starts_at).toLocaleString(),
          who: slot.display_name,
        }),
      );
      setKickoffPickerProjectId(null);
      setKickoffSlots([]);
      await Promise.all([loadManagedProjects(), loadBookable(), loadFinance()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    } finally {
      setKickoffLoading(false);
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

  async function deleteInvoice(id: string, invoiceNumber: string) {
    if (!token) return;
    if (!window.confirm(t("finance.deleteInvoiceConfirm", { number: invoiceNumber }))) return;
    setTimeError(null);
    setFinanceStatus(null);
    try {
      const res = await fetch(`${FINANCE_API}/invoices/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(typeof detail.detail === "string" ? detail.detail : res.statusText);
      }
      setFinanceStatus(t("finance.invoiceDeleted"));
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

  async function saveMonthlyCost() {
    if (!token) return;
    const label = otherCostForm.label.trim();
    const amount = Number(otherCostForm.amount);
    const start = otherCostForm.start_month || costMonth;
    if (!label || !Number.isFinite(amount) || amount < 0 || !start) {
      setTimeError(t("finance.costInvalid"));
      return;
    }
    setTimeError(null);
    setFinanceStatus(null);
    try {
      const res = await fetch(`${FINANCE_API}/costs`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label,
          amount_eur: amount,
          cadence: otherCostForm.cadence,
          start_month: start,
          end_month:
            otherCostForm.cadence === "recurring" && otherCostForm.end_month
              ? otherCostForm.end_month
              : null,
          notes: otherCostForm.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      setOtherCostForm({
        label: "",
        amount: "",
        cadence: "one_off",
        start_month: "",
        end_month: "",
        notes: "",
      });
      setFinanceStatus(t("finance.costSaved"));
      await loadMonthlyCosts();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function patchMonthlyCost(
    id: string,
    patch: Partial<Pick<MonthlyCost, "invoice_matched" | "invoice_paid">>,
  ) {
    if (!token) return;
    setTimeError(null);
    try {
      const res = await fetch(`${FINANCE_API}/costs/${id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      await loadMonthlyCosts();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function deleteMonthlyCost(id: string, label: string) {
    if (!token) return;
    if (!window.confirm(t("finance.costDeleteConfirm", { label }))) return;
    setTimeError(null);
    try {
      const res = await fetch(`${FINANCE_API}/costs/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      setFinanceStatus(t("finance.costDeleted"));
      await loadMonthlyCosts();
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
    const listPrice = Number(catalogForm.list_price_eur);
    const estimatedHours = Number(catalogForm.estimated_hours);
    if (!Number.isFinite(listPrice) || listPrice < 0) {
      setTimeError(t("catalog.invalidPrice"));
      return;
    }
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) {
      setTimeError(t("catalog.invalidHours"));
      return;
    }
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
            list_price_eur: listPrice,
            estimated_hours: estimatedHours,
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

  async function createCatalogService() {
    if (!token) return;
    setTimeError(null);
    setAdminStatus(null);
    const listPrice = Number(newCatalogForm.list_price_eur);
    const estimatedHours = Number(newCatalogForm.estimated_hours);
    const serviceId = newCatalogForm.service_id.trim();
    const nameEn = newCatalogForm.name_en.trim();
    if (!serviceId || !nameEn) {
      setTimeError(t("catalog.missingRequired"));
      return;
    }
    if (!Number.isFinite(listPrice) || listPrice < 0) {
      setTimeError(t("catalog.invalidPrice"));
      return;
    }
    if (!Number.isFinite(estimatedHours) || estimatedHours <= 0) {
      setTimeError(t("catalog.invalidHours"));
      return;
    }
    try {
      const res = await fetch(`${CATALOG_API}/services`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          service_id: serviceId,
          version: newCatalogForm.version.trim() || "1.0.0",
          name_en: nameEn,
          list_price_eur: listPrice,
          estimated_hours: estimatedHours,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setAdminStatus(t("catalog.created"));
      setCreatingCatalog(false);
      setNewCatalogForm({
        service_id: "",
        version: "1.0.0",
        name_en: "",
        list_price_eur: "",
        estimated_hours: "",
      });
      await loadCatalog();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function deleteCatalogService(serviceId: string, version: string) {
    if (!token) return;
    if (!window.confirm(t("catalog.confirmDelete"))) return;
    setTimeError(null);
    setAdminStatus(null);
    try {
      const res = await fetch(
        `${CATALOG_API}/services/${serviceId}?version=${encodeURIComponent(version)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (!res.ok) throw new Error(await res.text());
      if (editingCatalogId === `${serviceId}|${version}`) setEditingCatalogId(null);
      setAdminStatus(t("catalog.deleted"));
      await loadCatalog();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  function openResourceCreate() {
    setCreatingResource(true);
    setEditingResourceId(null);
    setPlanningCalendar(false);
    setResourceForm(emptyResourceForm);
  }

  function openResourceEdit(r: Resource) {
    setCreatingResource(false);
    setEditingResourceId(r.id);
    setPlanningCalendar(false);
    setResourceForm({
      display_name: r.display_name,
      kind: r.kind === "internal" ? "internal" : "external",
      billable_rate_eur: String(r.billable_rate_eur),
      internal_rate_eur: String(r.internal_rate_eur),
      is_senior: r.is_senior,
      is_partner: r.is_partner,
    });
  }

  async function saveResource() {
    if (!token) return;
    setTimeError(null);
    setAdminStatus(null);
    const name = resourceForm.display_name.trim();
    const billable = Number(resourceForm.billable_rate_eur);
    const internal = Number(resourceForm.internal_rate_eur);
    if (!name) {
      setTimeError(t("resources.missingName"));
      return;
    }
    if (!Number.isFinite(billable) || billable <= 0 || !Number.isFinite(internal) || internal < 0) {
      setTimeError(t("resources.invalidRates"));
      return;
    }
    const body = {
      display_name: name,
      kind: resourceForm.kind,
      billable_rate_eur: billable,
      internal_rate_eur: internal,
      is_senior: resourceForm.is_senior,
      is_partner: resourceForm.is_partner,
      active: true,
    };
    try {
      const url = editingResourceId
        ? `${PARTNER_API}/resources/${editingResourceId}`
        : `${PARTNER_API}/resources`;
      const res = await fetch(url, {
        method: editingResourceId ? "PATCH" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setAdminStatus(editingResourceId ? t("resources.saved") : t("resources.created"));
      setEditingResourceId(null);
      setCreatingResource(false);
      await loadResources();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function deleteResource(id: string, name: string) {
    if (!token) return;
    if (!window.confirm(t("resources.confirmDelete", { name }))) return;
    setTimeError(null);
    setAdminStatus(null);
    try {
      const res = await fetch(`${PARTNER_API}/resources/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      if (editingResourceId === id) setEditingResourceId(null);
      setAdminStatus(t("resources.deleted"));
      await loadResources();
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function saveCalendarBlock() {
    if (!token) return;
    if (!calendarForm.consultant_rate_id) {
      setTimeError(t("agenda.resourceRequired"));
      return;
    }
    if (!calendarForm.day) {
      setTimeError(t("agenda.endsRequired"));
      return;
    }
    const slot = UNAVAIL_SLOTS.find((s) => s.id === calendarForm.slot) ?? UNAVAIL_SLOTS[0];
    const [y, m, d] = calendarForm.day.split("-").map(Number);
    const startLocal = new Date(y, m - 1, d, slot.startHour, 0, 0, 0);
    const endLocal = new Date(y, m - 1, d, slot.startHour + 4, 0, 0, 0);
    const starts = startLocal.toISOString();
    const ends = endLocal.toISOString();
    setTimeError(null);
    setAdminStatus(null);
    try {
      const res = await fetch(`${PARTNER_API}/appointments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          kind: "unavailable",
          consultant_rate_id: calendarForm.consultant_rate_id,
          starts_at: starts,
          ends_at: ends,
          notes: calendarForm.notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      setAdminStatus(t("agenda.blockSaved"));
      setPlanningCalendar(false);
      setCalendarForm({
        consultant_rate_id: "",
        day: "",
        slot: "am",
        notes: "",
      });
      await Promise.all([loadResourceCalendar(), loadFinance()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function cancelCalendarBlock(id: string) {
    if (!token) return;
    if (!window.confirm(t("agenda.confirmCancelBlock"))) return;
    setTimeError(null);
    try {
      const res = await fetch(`${PARTNER_API}/appointments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      setAdminStatus(t("agenda.blockCancelled"));
      await Promise.all([loadResourceCalendar(), loadFinance()]);
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
    (view === "admin" ||
      view === "finance" ||
      view === "catalog" ||
      view === "projects" ||
      view === "resources") &&
    !isManager
      ? "hours"
      : view;
  const overdueCount = invoiceAgenda.filter((a) => a.overdue).length;
  const weekKickoffs = kickoffAppointments.filter((a) => a.kind === "kickoff");
  const resourceWeekBlocks = resourceCalendar.filter(
    (a) => a.kind === "pto" || a.kind === "unavailable" || a.kind === "kickoff",
  );
  const resourceAgendaDates = DAY_KEYS.map((_, i) => toIsoDate(addDays(resourceCalendarWeek, i)));
  const agendaResources = resources
    .filter((r) => r.active)
    .filter((r) => !agendaResourceId || r.id === agendaResourceId);
  const openProjects = managedProjects.filter(
    (p) =>
      (p.progress || "none") !== "complete" &&
      !["paid", "closed"].includes(p.funnel_status || ""),
  );
  const unpaidInvoices = invoices.filter((inv) => inv.status === "issued");
  const filteredInvoices = invoices.filter((inv) => {
    const q = invoiceSearch.q.trim().toLowerCase();
    const idq = invoiceSearch.id.trim().toLowerCase();
    const dateq = invoiceSearch.date.trim();
    if (q && !inv.customer_name.toLowerCase().includes(q)) return false;
    if (idq && !inv.invoice_number.toLowerCase().includes(idq) && !inv.id.toLowerCase().includes(idq))
      return false;
    if (dateq) {
      const issued = (inv.issued_at || "").slice(0, 10);
      if (issued !== dateq) return false;
    }
    return true;
  });
  const costMonthPrefix = costMonth;
  const monthCompensation = compensation.filter((c) => {
    if (!c.updated_at) return true;
    return c.updated_at.startsWith(costMonthPrefix);
  });
  const billableMonthCost = monthCompensation
    .filter((c) => c.classification !== "approved_non_billable")
    .reduce((s, c) => s + c.hours * (c.rate_eur || 0), 0);
  const nonBillableMonthCost = monthCompensation
    .filter((c) => c.classification === "approved_non_billable")
    .reduce((s, c) => s + Math.abs(c.amount_eur), 0);
  const hoursByResourceMonth = (() => {
    const map = new Map<string, { name: string; billable: number; nonBillable: number }>();
    for (const c of monthCompensation) {
      const row = map.get(c.partner_id) || {
        name: c.partner_name,
        billable: 0,
        nonBillable: 0,
      };
      if (c.classification === "approved_non_billable") row.nonBillable += c.hours;
      else row.billable += c.hours;
      map.set(c.partner_id, row);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  })();
  const billedByQuarter = (() => {
    const map = new Map<string, number>();
    for (const inv of invoices.filter((i) => i.status === "issued" || i.status === "paid")) {
      const d = (inv.issued_at || "").slice(0, 10);
      if (!d) continue;
      const y = Number(d.slice(0, 4));
      const m = Number(d.slice(5, 7));
      const q = Math.ceil(m / 3);
      const key = `${y}-Q${q}`;
      map.set(key, (map.get(key) || 0) + inv.subtotal_eur);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  })();
  const billedAnnual = invoices
    .filter((i) => i.status === "issued" || i.status === "paid")
    .reduce((s, i) => s + i.subtotal_eur, 0);
  const receivedTotal = invoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount_eur, 0);
  const otherCostsTotal = monthlyCosts.reduce((s, row) => s + (row.amount_eur || 0), 0);
  const grossProfit =
    invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.subtotal_eur, 0) -
    nonBillableMonthCost -
    otherCostsTotal;
  const projectedTax = Math.max(0, grossProfit * CORP_TAX_RATE);
  const profitAfterTax = grossProfit - projectedTax;
  const vatThisQuarter =
    vatAccount?.quarters.find((q) => q.label === vatAccount.current_quarter)?.outstanding_eur ?? 0;

  function projectProfitStatus(p: ProjectDetail): {
    spent: number;
    sales: number;
    status: "green" | "yellow" | "red";
    pct: number;
  } {
    const hoursBooked = Math.max(0, (p.contracted_hours || 0) - (p.remaining_hours || 0));
    const avgRate =
      p.staffing.length > 0
        ? p.staffing.reduce((s, st) => s + st.rate_eur, 0) / p.staffing.length
        : 0;
    const spent = hoursBooked * avgRate;
    const risk =
      p.risk_mode === "fixed" ? p.risk_fixed_eur : (p.fixed_price_eur * p.risk_rate) / 100;
    const profit =
      p.profit_mode === "fixed" ? p.profit_fixed_eur : (p.fixed_price_eur * p.profit_rate) / 100;
    const sales = p.fixed_price_eur > 0 ? p.fixed_price_eur : spent + risk + profit;
    const thresholdYellow = sales - risk - profit;
    let status: "green" | "yellow" | "red" = "green";
    if (spent > sales) status = "red";
    else if (spent > thresholdYellow) status = "yellow";
    const pct = sales > 0 ? Math.min(100, (spent / sales) * 100) : 0;
    return { spent, sales, status, pct };
  }
  const weekDateSet = new Set(weekDates);
  // Pending inbox is cross-week; approved list for refuse/reopen stays week-scoped.
  const submittedEntries = adminEntries.filter((e) => e.status === "submitted");
  const correctionEntries = adminEntries.filter(
    (e) => e.status === "approved" && weekDateSet.has(e.work_date),
  );
  const displayName = brand?.display_name ?? "Platform";
  const rowLabel = (id: string) =>
    rows.find((r) => r.id === id)?.label ?? projectLabels[id] ?? id;
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
    const locked =
      Boolean(row.readOnly) || entry?.status === "approved" || entry?.status === "rejected";
    const cellClass =
      entry?.status === "rejected"
        ? "hours-cell rejected"
        : entry?.status === "approved" || row.readOnly
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
            row.readOnly
              ? t("time.historicalCell")
              : entry?.status === "rejected"
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

  function projectRows(kind: "billable" | "non_billable", opts?: { historical?: boolean }) {
    const historical = Boolean(opts?.historical);
    return rows
      .filter((r) => r.classification === kind && Boolean(r.readOnly) === historical)
      .map((row) => (
        <tr key={row.id} className={row.readOnly ? "historical-row" : undefined}>
          <th scope="row">
            <span className="row-label">{row.label}</span>
            {row.readOnly ? (
              <span className="row-sub">{t("time.historicalProject")}</span>
            ) : row.subtitle ? (
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
                className={view === "projects" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("projects")}
              >
                {t("nav.projects")}
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
            {isManager ? (
              <button
                type="button"
                className={view === "resources" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("resources")}
              >
                {t("nav.resources")}
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
                <div className="week-nav">
                  <div>
                    <h1>{t("customer.title")}</h1>
                    <p>{t("customer.intro")}</p>
                  </div>
                  <div className="actions">
                    <button type="button" className="primary" onClick={() => startCreateCustomer()}>
                      {t("customer.add")}
                    </button>
                  </div>
                </div>

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
                  {customerError && !creatingCustomer && !editingCustomerId ? (
                    <p className="status error">{customerError}</p>
                  ) : null}
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

                {creatingCustomer || editingCustomerId ? (
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
                    <button type="button" onClick={cancelEditCustomer}>
                      {t("customer.cancel")}
                    </button>
                  </div>
                  {customerError ? <p className="status error">{customerError}</p> : null}
                </form>
                ) : null}
              </section>
            ) : null}

            {activeView === "finance" && isManager ? (
              <>
                <section className="panel wide">
                  <h1>{t("finance.title")}</h1>
                  <p>{t("finance.hubIntro")}</p>
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
                  <div className="finance-hub-actions">
                    {(
                      [
                        ["operational", "finance.panelOperational"],
                        ["billing", "finance.panelBilling"],
                        ["costs", "finance.panelCosts"],
                        ["kpis", "finance.panelKpis"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={financePanel === id ? "primary" : ""}
                        onClick={() => setFinancePanel((p) => (p === id ? null : id))}
                      >
                        {t(label)}
                      </button>
                    ))}
                  </div>
                </section>

                {financePanel === "operational" ? (
                  <section className="panel wide">
                    <h2>{t("finance.operationalTitle")}</h2>
                    <p className="status">{t("finance.operationalIntro")}</p>
                    {openProjects.length === 0 ? (
                      <p className="status">{t("finance.operationalEmpty")}</p>
                    ) : (
                      <ul className="entry-list">
                        {openProjects.map((p) => {
                          const progressPct =
                            p.progress === "complete"
                              ? 100
                              : p.progress === "none"
                                ? 0
                                : Number(p.progress) || 0;
                          const budgetUsed =
                            p.fixed_price_eur > 0
                              ? Math.min(
                                  100,
                                  ((p.fixed_price_eur - (p.consultancy_budget_eur || 0)) /
                                    p.fixed_price_eur) *
                                    100,
                                )
                              : p.contracted_hours > 0
                                ? Math.min(
                                    100,
                                    ((p.contracted_hours - p.remaining_hours) / p.contracted_hours) *
                                      100,
                                  )
                                : 0;
                          const withinBudget = p.remaining_hours >= 0 && budgetUsed <= 100;
                          return (
                            <li key={p.id}>
                              <div className="finance-project-card">
                                <strong>
                                  {p.customer_name} · {p.name}
                                </strong>
                                <div className="muted">
                                  {t(`project.funnel.${p.funnel_status || "registered"}`)} ·{" "}
                                  {t(`finance.progress.${p.progress || "none"}`)} ·{" "}
                                  {t("finance.projectedHours", { hours: p.remaining_hours })}
                                </div>
                                <div className="bar-track" aria-hidden>
                                  <div
                                    className={`bar-fill ${withinBudget ? "bar-ok" : "bar-warn"}`}
                                    style={{ width: `${Math.min(100, Math.max(0, budgetUsed))}%` }}
                                  />
                                </div>
                                <div className="muted">
                                  {t("finance.budgetBar", {
                                    pct: Math.round(progressPct),
                                    used: Math.round(budgetUsed),
                                  })}
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </section>
                ) : null}

                {financePanel === "billing" ? (
                  <>
                    <section className="panel wide">
                      <h2>{t("finance.billingTitle")}</h2>
                      <p>{t("finance.billingIntro")}</p>
                      <h3>{t("finance.readyToBill")}</h3>
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

                      <h3>{t("finance.awaitingPayment")}</h3>
                      {unpaidInvoices.length === 0 ? (
                        <p className="status">{t("finance.awaitingPaymentEmpty")}</p>
                      ) : (
                        <ul className="entry-list">
                          {unpaidInvoices.map((inv) => (
                            <li key={inv.id}>
                              <div>
                                <strong>
                                  {inv.invoice_number} · {inv.customer_name} · €
                                  {inv.amount_eur.toFixed(2)}
                                </strong>
                                <div className="muted">
                                  {inv.project_name}
                                  {inv.due_date ? ` · ${t("finance.due")} ${inv.due_date.slice(0, 10)}` : ""}
                                </div>
                              </div>
                              <div className="entry-actions">
                                <button type="button" onClick={() => void patchInvoiceStatus(inv.id, "paid")}>
                                  {t("finance.markPaid")}
                                </button>
                                {inv.pdf_path ? (
                                  <button type="button" onClick={() => void downloadInvoicePdf(inv.id)}>
                                    {t("finance.downloadPdf")}
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}

                      <h3>{t("finance.invoiceSearchTitle")}</h3>
                      <div className="form-row">
                        <div>
                          <label htmlFor="invSearchCustomer">{t("finance.searchCustomer")}</label>
                          <input
                            id="invSearchCustomer"
                            value={invoiceSearch.q}
                            onChange={(e) => setInvoiceSearch((p) => ({ ...p, q: e.target.value }))}
                            placeholder={t("finance.searchCustomerHint")}
                          />
                        </div>
                        <div>
                          <label htmlFor="invSearchDate">{t("finance.searchDate")}</label>
                          <input
                            id="invSearchDate"
                            type="date"
                            value={invoiceSearch.date}
                            onChange={(e) => setInvoiceSearch((p) => ({ ...p, date: e.target.value }))}
                          />
                        </div>
                      </div>
                      <label htmlFor="invSearchId">{t("finance.searchId")}</label>
                      <input
                        id="invSearchId"
                        value={invoiceSearch.id}
                        onChange={(e) => setInvoiceSearch((p) => ({ ...p, id: e.target.value }))}
                        placeholder="INV-…"
                      />
                      {filteredInvoices.length === 0 ? (
                        <p className="status">{t("finance.invoicesEmpty")}</p>
                      ) : (
                        <ul className="entry-list">
                          {filteredInvoices.map((inv) => (
                            <li key={inv.id}>
                              <div>
                                <strong>
                                  {inv.invoice_number} · {inv.customer_name} · €
                                  {inv.amount_eur.toFixed(2)}
                                </strong>
                                <div className="muted">
                                  {inv.project_name} ·{" "}
                                  {t(`finance.kind.${inv.kind}`, { defaultValue: inv.kind })} ·{" "}
                                  {t(`finance.status.${inv.status}`, { defaultValue: inv.status })}
                                </div>
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
                                  <>
                                    <button type="button" onClick={() => void patchInvoiceStatus(inv.id, "issued")}>
                                      {t("finance.sendInvoice")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void deleteInvoice(inv.id, inv.invoice_number)}
                                    >
                                      {t("finance.deleteInvoice")}
                                    </button>
                                  </>
                                ) : null}
                                {inv.status === "issued" ? (
                                  <>
                                    <button type="button" onClick={() => void patchInvoiceStatus(inv.id, "paid")}>
                                      {t("finance.markPaid")}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void patchInvoiceStatus(inv.id, "returned")}
                                    >
                                      {t("finance.markReturned")}
                                    </button>
                                  </>
                                ) : null}
                                {inv.pdf_path ? (
                                  <button type="button" onClick={() => void downloadInvoicePdf(inv.id)}>
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
                      <h2>{t("finance.agendaTitle")}</h2>
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
                      <h3>{t("agenda.kickoffsTitle")}</h3>
                      {weekKickoffs.length === 0 ? (
                        <p className="status">{t("agenda.kickoffsEmpty")}</p>
                      ) : (
                        <ul className="entry-list">
                          {weekKickoffs.map((item) => (
                            <li key={item.id}>
                              <div>
                                <strong>
                                  {t("agenda.kickoffLabel")} · {item.customer_name || "—"} ·{" "}
                                  {item.project_name || "—"}
                                </strong>
                                <div className="muted">
                                  {new Date(item.starts_at).toLocaleString()} · {item.display_name}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                      <h3>{t("finance.agendaInvoicesTitle")}</h3>
                      {invoiceAgenda.length === 0 ? (
                        <p className="status">{t("finance.agendaEmpty")}</p>
                      ) : (
                        <ul className="entry-list">
                          {invoiceAgenda.map((item) => (
                            <li key={item.invoice_id}>
                              <div>
                                <strong>
                                  {item.invoice_number} · {item.customer_name} · €
                                  {item.amount_eur.toFixed(2)}
                                </strong>
                                <div className={item.overdue ? "muted error" : "muted"}>
                                  {t("finance.dueLine", {
                                    date: item.due_date,
                                    days: item.days_until_due,
                                  })}
                                  {item.overdue ? ` · ${t("finance.overdue")}` : ""}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </>
                ) : null}

                {financePanel === "costs" ? (
                  <section className="panel wide">
                    <h2>{t("finance.costsTitle")}</h2>
                    <label htmlFor="costMonth">{t("finance.costMonth")}</label>
                    <input
                      id="costMonth"
                      type="month"
                      value={costMonth}
                      onChange={(e) => setCostMonth(e.target.value)}
                    />
                    <p className="status">
                      {t("finance.costBillable", { eur: billableMonthCost.toFixed(2) })}
                    </p>
                    <p className="status">
                      {t("finance.costNonBillable", { eur: nonBillableMonthCost.toFixed(2) })}
                    </p>
                    <h3>{t("finance.hoursByResource")}</h3>
                    {hoursByResourceMonth.length === 0 ? (
                      <p className="status">{t("finance.hoursByResourceEmpty")}</p>
                    ) : (
                      <ul className="entry-list">
                        {hoursByResourceMonth.map((row) => (
                          <li key={row.name}>
                            <div>
                              <strong>{row.name}</strong>
                              <div className="muted">
                                {t("finance.resourceHoursLine", {
                                  billable: row.billable,
                                  nonBillable: row.nonBillable,
                                })}
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <h3>{t("finance.monthlyCostsTitle")}</h3>
                    <p className="status">{t("finance.monthlyCostsIntro")}</p>
                    <p className="status">
                      {t("finance.otherCostsTotal", { eur: otherCostsTotal.toFixed(2) })}
                    </p>
                    <div className="form-row">
                      <div>
                        <label htmlFor="supLabel">{t("finance.supplierLabel")}</label>
                        <input
                          id="supLabel"
                          value={otherCostForm.label}
                          onChange={(e) => setOtherCostForm((p) => ({ ...p, label: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label htmlFor="supAmount">{t("finance.supplierAmount")}</label>
                        <input
                          id="supAmount"
                          type="number"
                          min="0"
                          step="0.01"
                          value={otherCostForm.amount}
                          onChange={(e) => setOtherCostForm((p) => ({ ...p, amount: e.target.value }))}
                        />
                      </div>
                    </div>
                    <label htmlFor="costCadence">{t("finance.costCadence")}</label>
                    <select
                      id="costCadence"
                      value={otherCostForm.cadence}
                      onChange={(e) =>
                        setOtherCostForm((p) => ({
                          ...p,
                          cadence: e.target.value === "recurring" ? "recurring" : "one_off",
                        }))
                      }
                    >
                      <option value="one_off">{t("finance.costOneOff")}</option>
                      <option value="recurring">{t("finance.costRecurring")}</option>
                    </select>
                    <div className="form-row">
                      <div>
                        <label htmlFor="costStart">{t("finance.costStartMonth")}</label>
                        <input
                          id="costStart"
                          type="month"
                          value={otherCostForm.start_month || costMonth}
                          onChange={(e) =>
                            setOtherCostForm((p) => ({ ...p, start_month: e.target.value }))
                          }
                        />
                      </div>
                      <div>
                        <label htmlFor="costEnd">{t("finance.costEndMonth")}</label>
                        <input
                          id="costEnd"
                          type="month"
                          value={otherCostForm.end_month}
                          disabled={otherCostForm.cadence !== "recurring"}
                          onChange={(e) =>
                            setOtherCostForm((p) => ({ ...p, end_month: e.target.value }))
                          }
                        />
                        <p className="field-hint">{t("finance.costEndHint")}</p>
                      </div>
                    </div>
                    <label htmlFor="costNotes">{t("finance.costNotes")}</label>
                    <input
                      id="costNotes"
                      value={otherCostForm.notes}
                      onChange={(e) => setOtherCostForm((p) => ({ ...p, notes: e.target.value }))}
                      maxLength={500}
                    />
                    <div className="actions">
                      <button type="button" className="primary" onClick={() => void saveMonthlyCost()}>
                        {t("finance.addMonthlyCost")}
                      </button>
                    </div>
                    {monthlyCosts.length === 0 ? (
                      <p className="status">{t("finance.monthlyCostsEmpty")}</p>
                    ) : (
                      <ul className="entry-list">
                        {monthlyCosts.map((row) => (
                          <li key={row.id}>
                            <div>
                              <strong>
                                {row.label} · €{row.amount_eur.toFixed(2)}
                              </strong>
                              <div className="muted">
                                {row.cadence === "recurring"
                                  ? t("finance.costRecurringRange", {
                                      start: row.start_month,
                                      end: row.end_month || t("finance.costOngoing"),
                                    })
                                  : t("finance.costOneOffMonth", { month: row.start_month })}
                                {row.notes ? ` · ${row.notes}` : ""}
                              </div>
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={row.invoice_matched}
                                  onChange={(e) =>
                                    void patchMonthlyCost(row.id, {
                                      invoice_matched: e.target.checked,
                                    })
                                  }
                                />
                                {t("finance.invoiceMatches")}
                              </label>
                              <label className="checkbox-row">
                                <input
                                  type="checkbox"
                                  checked={row.invoice_paid}
                                  onChange={(e) =>
                                    void patchMonthlyCost(row.id, {
                                      invoice_paid: e.target.checked,
                                    })
                                  }
                                />
                                {t("finance.invoicePayed")}
                              </label>
                              {row.invoice_matched && row.invoice_paid ? (
                                <div className="muted">{t("finance.supplierCompleted")}</div>
                              ) : null}
                            </div>
                            <div className="entry-actions">
                              <button
                                type="button"
                                onClick={() => void deleteMonthlyCost(row.id, row.label)}
                              >
                                {t("customer.delete")}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
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
                ) : null}

                {financePanel === "kpis" ? (
                  <section className="panel wide">
                    <h2>{t("finance.kpisTitle")}</h2>
                    <h3>{t("finance.profitByProject")}</h3>
                    {managedProjects.length === 0 ? (
                      <p className="status">{t("finance.kpiEmpty")}</p>
                    ) : (
                      <ul className="entry-list">
                        {managedProjects.map((p) => {
                          const { spent, sales, status, pct } = projectProfitStatus(p);
                          return (
                            <li key={p.id}>
                              <div className="finance-project-card">
                                <strong>
                                  {p.customer_name} · {p.name}
                                </strong>
                                <div className="muted">
                                  {t("finance.profitLine", {
                                    spent: spent.toFixed(0),
                                    sales: sales.toFixed(0),
                                  })}
                                </div>
                                <div className="bar-track" aria-hidden>
                                  <div
                                    className={`bar-fill bar-${status}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    <h3>{t("finance.billedOverview")}</h3>
                    {billedByQuarter.length === 0 ? (
                      <p className="status">{t("finance.billedEmpty")}</p>
                    ) : (
                      <ul className="entry-list">
                        {billedByQuarter.map(([label, amount]) => (
                          <li key={label}>
                            <div>
                              <strong>{label}</strong>
                              <div className="muted">€{amount.toFixed(2)}</div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="status">
                      {t("finance.billedAnnual", { eur: billedAnnual.toFixed(2) })}
                    </p>
                    <p className="status">
                      {t("finance.receivedTotal", { eur: receivedTotal.toFixed(2) })}
                    </p>
                    <p className="status">
                      {t("finance.grossProfit", { eur: grossProfit.toFixed(2) })}
                    </p>
                    <p className="status">
                      {t("finance.projectedTax", {
                        eur: projectedTax.toFixed(2),
                        rate: Math.round(CORP_TAX_RATE * 1000) / 10,
                      })}
                    </p>
                    <p className="status">
                      {t("finance.profitAfterTax", { eur: profitAfterTax.toFixed(2) })}
                    </p>
                    <p className="status">
                      {t("finance.vatQuarterAmount", { eur: vatThisQuarter.toFixed(2) })}
                    </p>
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
                        <p className="status">
                          {t("finance.vatBalance", {
                            balance: vatAccount.balance_eur.toFixed(2),
                            quarter: vatAccount.current_quarter,
                          })}
                        </p>
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
                      </>
                    ) : null}
                  </section>
                ) : null}
              </>
            ) : null}

            {activeView === "catalog" && isManager ? (
              <section className="panel wide">
                <div className="week-nav">
                  <div>
                    <h1>{t("catalog.title")}</h1>
                    <p>{t("catalog.intro")}</p>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => {
                        setCreatingCatalog(true);
                        setEditingCatalogId(null);
                      }}
                    >
                      {t("catalog.add")}
                    </button>
                  </div>
                </div>
                {adminStatus ? <p className="status">{adminStatus}</p> : null}
                {timeError ? <p className="status error">{timeError}</p> : null}
                {creatingCatalog ? (
                  <div className="customer-form">
                    <h2>{t("catalog.createTitle")}</h2>
                    <label htmlFor="catNewId">{t("catalog.serviceId")}</label>
                    <input
                      id="catNewId"
                      value={newCatalogForm.service_id}
                      onChange={(e) => setNewCatalogForm((p) => ({ ...p, service_id: e.target.value }))}
                    />
                    <label htmlFor="catNewVersion">{t("catalog.version")}</label>
                    <input
                      id="catNewVersion"
                      value={newCatalogForm.version}
                      onChange={(e) => setNewCatalogForm((p) => ({ ...p, version: e.target.value }))}
                    />
                    <label htmlFor="catNewName">{t("catalog.name")}</label>
                    <input
                      id="catNewName"
                      value={newCatalogForm.name_en}
                      onChange={(e) => setNewCatalogForm((p) => ({ ...p, name_en: e.target.value }))}
                    />
                    <label htmlFor="catNewPrice">{t("catalog.listPrice")}</label>
                    <input
                      id="catNewPrice"
                      type="number"
                      min="0"
                      step="0.01"
                      value={newCatalogForm.list_price_eur}
                      onChange={(e) => setNewCatalogForm((p) => ({ ...p, list_price_eur: e.target.value }))}
                    />
                    <label htmlFor="catNewHours">{t("catalog.typicalHours")}</label>
                    <input
                      id="catNewHours"
                      type="number"
                      min="1"
                      step="1"
                      value={newCatalogForm.estimated_hours}
                      onChange={(e) => setNewCatalogForm((p) => ({ ...p, estimated_hours: e.target.value }))}
                    />
                    <div className="actions">
                      <button type="button" className="primary" onClick={() => void createCatalogService()}>
                        {t("catalog.create")}
                      </button>
                      <button type="button" onClick={() => setCreatingCatalog(false)}>
                        {t("customer.cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}
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
                              setCreatingCatalog(false);
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
                          <button
                            type="button"
                            onClick={() => void deleteCatalogService(s.service_id, s.version)}
                          >
                            {t("catalog.delete")}
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

            {activeView === "resources" && isManager ? (
              <section className="panel wide">
                <div className="week-nav">
                  <div>
                    <h1>{t("resources.title")}</h1>
                    <p>{t("resources.intro")}</p>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      onClick={() => {
                        setPlanningCalendar(true);
                        setCreatingResource(false);
                        setEditingResourceId(null);
                      }}
                    >
                      {t("agenda.planBlock")}
                    </button>
                    <button type="button" className="primary" onClick={() => openResourceCreate()}>
                      {t("resources.add")}
                    </button>
                  </div>
                </div>
                {adminStatus ? <p className="status">{adminStatus}</p> : null}
                {timeError ? <p className="status error">{timeError}</p> : null}

                <h2>{t("agenda.resourceCalendarTitle")}</h2>
                <p className="status">{t("agenda.resourceCalendarIntro")}</p>
                <div className="actions week-actions">
                  <button type="button" onClick={() => setResourceCalendarWeek((w) => addDays(w, -7))}>
                    {t("time.prevWeek")}
                  </button>
                  <button type="button" onClick={() => setResourceCalendarWeek(startOfIsoWeek(new Date()))}>
                    {t("time.thisWeek")}
                  </button>
                  <button type="button" onClick={() => setResourceCalendarWeek((w) => addDays(w, 7))}>
                    {t("time.nextWeek")}
                  </button>
                </div>
                <p className="week-range">{formatWeekRange(resourceCalendarWeek, i18n.language)}</p>
                <label htmlFor="agendaResourceFilter">{t("agenda.filterResource")}</label>
                <select
                  id="agendaResourceFilter"
                  value={agendaResourceId}
                  onChange={(e) => setAgendaResourceId(e.target.value)}
                >
                  <option value="">{t("agenda.allResources")}</option>
                  {resources
                    .filter((r) => r.active)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.display_name}
                      </option>
                    ))}
                </select>
                <div className="timesheet-scroll">
                  <table className="timesheet-grid agenda-grid">
                    <thead>
                      <tr>
                        <th scope="col">{t("agenda.resource")}</th>
                        {DAY_KEYS.map((day, i) => (
                          <th key={day} scope="col">
                            <span className="day-name">{t(`time.days.${day}`)}</span>
                            <span className="day-date">{resourceAgendaDates[i].slice(8)}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {agendaResources.length === 0 ? (
                        <tr>
                          <td colSpan={8}>
                            <p className="status">{t("resources.empty")}</p>
                          </td>
                        </tr>
                      ) : (
                        agendaResources.map((r) => (
                          <tr key={r.id}>
                            <th scope="row">
                              <span className="row-label">{r.display_name}</span>
                            </th>
                            {resourceAgendaDates.map((date) => {
                              const dayItems = resourceWeekBlocks.filter(
                                (a) =>
                                  a.consultant_rate_id === r.id &&
                                  a.starts_at.slice(0, 10) === date,
                              );
                              return (
                                <td key={date}>
                                  {dayItems.length === 0 ? (
                                    <span className="muted">—</span>
                                  ) : (
                                    <ul className="agenda-day-list">
                                      {dayItems.map((item) => (
                                        <li key={item.id}>
                                          <strong>
                                            {item.kind === "kickoff"
                                              ? t("agenda.kind.kickoff")
                                              : t("agenda.kind.unavailable")}
                                          </strong>
                                          <div className="muted">
                                            {new Date(item.starts_at).toLocaleTimeString([], {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                            {"–"}
                                            {new Date(item.ends_at).toLocaleTimeString([], {
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </div>
                                          {item.project_name ? (
                                            <div className="muted">{item.project_name}</div>
                                          ) : null}
                                          {item.kind !== "kickoff" ? (
                                            <button
                                              type="button"
                                              onClick={() => void cancelCalendarBlock(item.id)}
                                            >
                                              {t("agenda.cancelBlock")}
                                            </button>
                                          ) : null}
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <h2>{t("agenda.projectAgendaTitle")}</h2>
                <p className="status">{t("agenda.projectAgendaIntro")}</p>
                <label htmlFor="projectAgendaPick">{t("agenda.pickProject")}</label>
                <select
                  id="projectAgendaPick"
                  value={projectAgendaId}
                  onChange={(e) => setProjectAgendaId(e.target.value)}
                >
                  <option value="">{t("agenda.pickProject")}</option>
                  {managedProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.customer_name} · {p.name}
                    </option>
                  ))}
                </select>
                {!projectAgendaId ? (
                  <p className="status">{t("agenda.projectAgendaHint")}</p>
                ) : projectAgenda.length === 0 ? (
                  <p className="status">{t("agenda.projectAgendaEmpty")}</p>
                ) : (
                  <ul className="entry-list">
                    {projectAgenda.map((item) => (
                      <li key={item.id}>
                        <div>
                          <strong>
                            {t(`agenda.kind.${item.kind === "pto" ? "unavailable" : item.kind}`)} ·{" "}
                            {item.display_name}
                          </strong>
                          <div className="muted">
                            {new Date(item.starts_at).toLocaleString()} →{" "}
                            {new Date(item.ends_at).toLocaleString()}
                            {item.notes ? ` · ${item.notes}` : ""}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {planningCalendar ? (
                  <div className="customer-form">
                    <h2>{t("agenda.planBlockTitle")}</h2>
                    <p className="status">{t("agenda.planBlockIntro")}</p>
                    <label htmlFor="calResource">{t("agenda.resource")}</label>
                    <select
                      id="calResource"
                      value={calendarForm.consultant_rate_id}
                      onChange={(e) =>
                        setCalendarForm((p) => ({ ...p, consultant_rate_id: e.target.value }))
                      }
                    >
                      <option value="">{t("agenda.pickResource")}</option>
                      {resources
                        .filter((r) => r.active)
                        .map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.display_name}
                          </option>
                        ))}
                    </select>
                    <label htmlFor="calDay">{t("agenda.blockDay")}</label>
                    <input
                      id="calDay"
                      type="date"
                      value={calendarForm.day}
                      onChange={(e) => setCalendarForm((p) => ({ ...p, day: e.target.value }))}
                    />
                    <label htmlFor="calSlot">{t("agenda.blockSlot")}</label>
                    <select
                      id="calSlot"
                      value={calendarForm.slot}
                      onChange={(e) =>
                        setCalendarForm((p) => ({
                          ...p,
                          slot: e.target.value as UnavailSlot,
                        }))
                      }
                    >
                      {UNAVAIL_SLOTS.map((s) => (
                        <option key={s.id} value={s.id}>
                          {t(s.labelKey)}
                        </option>
                      ))}
                    </select>
                    <p className="field-hint">{t("agenda.slotHint")}</p>
                    <label htmlFor="calNotes">{t("agenda.notes")}</label>
                    <input
                      id="calNotes"
                      value={calendarForm.notes}
                      onChange={(e) => setCalendarForm((p) => ({ ...p, notes: e.target.value }))}
                      maxLength={500}
                      placeholder={t("agenda.notesHint")}
                    />
                    <div className="actions">
                      <button type="button" className="primary" onClick={() => void saveCalendarBlock()}>
                        {t("agenda.saveBlock")}
                      </button>
                      <button type="button" onClick={() => setPlanningCalendar(false)}>
                        {t("customer.cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}

                {creatingResource || editingResourceId ? (
                  <div className="customer-form">
                    <h2>{editingResourceId ? t("resources.editTitle") : t("resources.createTitle")}</h2>
                    <label htmlFor="resName">{t("resources.name")}</label>
                    <input
                      id="resName"
                      value={resourceForm.display_name}
                      onChange={(e) => setResourceForm((p) => ({ ...p, display_name: e.target.value }))}
                    />
                    <label htmlFor="resKind">{t("resources.kindLabel")}</label>
                    <select
                      id="resKind"
                      value={resourceForm.kind}
                      onChange={(e) =>
                        setResourceForm((p) => ({
                          ...p,
                          kind: e.target.value === "internal" ? "internal" : "external",
                        }))
                      }
                    >
                      <option value="external">{t("resources.kindExternal")}</option>
                      <option value="internal">{t("resources.kindInternal")}</option>
                    </select>
                    <label htmlFor="resBillable">{t("resources.billableRate")}</label>
                    <input
                      id="resBillable"
                      type="number"
                      min="1"
                      step="0.01"
                      value={resourceForm.billable_rate_eur}
                      onChange={(e) => setResourceForm((p) => ({ ...p, billable_rate_eur: e.target.value }))}
                    />
                    <label htmlFor="resInternal">{t("resources.internalRate")}</label>
                    <input
                      id="resInternal"
                      type="number"
                      min="0"
                      step="0.01"
                      value={resourceForm.internal_rate_eur}
                      onChange={(e) => setResourceForm((p) => ({ ...p, internal_rate_eur: e.target.value }))}
                    />
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={resourceForm.is_senior}
                        onChange={(e) => setResourceForm((p) => ({ ...p, is_senior: e.target.checked }))}
                      />
                      {t("resources.isSenior")}
                    </label>
                    <label className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={resourceForm.is_partner}
                        onChange={(e) => setResourceForm((p) => ({ ...p, is_partner: e.target.checked }))}
                      />
                      {t("resources.isPartner")}
                    </label>
                    <div className="actions">
                      <button type="button" className="primary" onClick={() => void saveResource()}>
                        {editingResourceId ? t("resources.save") : t("resources.create")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCreatingResource(false);
                          setEditingResourceId(null);
                        }}
                      >
                        {t("customer.cancel")}
                      </button>
                    </div>
                  </div>
                ) : null}
                <h2>{t("resources.listTitle")}</h2>
                {resources.filter((r) => r.active).length === 0 ? (
                  <p className="status">{t("resources.empty")}</p>
                ) : (
                  <ul className="entry-list">
                    {resources
                      .filter((r) => r.active)
                      .map((r) => (
                        <li key={r.id}>
                          <div>
                            <strong>{r.display_name}</strong>
                            <div className="muted">
                              {t(`resources.kind.${r.kind}`)} · {t("resources.billableRate")} €
                              {r.billable_rate_eur} · {t("resources.internalRate")} €{r.internal_rate_eur}
                              {r.is_senior ? ` · ${t("resources.seniorBadge")}` : ""}
                              {r.is_partner ? ` · ${t("resources.partnerBadge")}` : ""}
                            </div>
                          </div>
                          <div className="entry-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setPlanningCalendar(true);
                                setCalendarForm((p) => ({ ...p, consultant_rate_id: r.id }));
                                setCreatingResource(false);
                                setEditingResourceId(null);
                              }}
                            >
                              {t("agenda.planBlock")}
                            </button>
                            <button type="button" onClick={() => openResourceEdit(r)}>
                              {t("resources.edit")}
                            </button>
                            <button type="button" onClick={() => void deleteResource(r.id, r.display_name)}>
                              {t("resources.delete")}
                            </button>
                          </div>
                        </li>
                      ))}
                  </ul>
                )}
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
                      {rows.some((r) => r.readOnly) ? (
                        <>
                          <tr className="section-row">
                            <td colSpan={8}>{t("time.historicalSection")}</td>
                          </tr>
                          {projectRows("billable", { historical: true })}
                          {projectRows("non_billable", { historical: true })}
                        </>
                      ) : null}
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
              </>
            ) : null}

            {activeView === "projects" && isManager ? (
              <>
                <section className="panel wide">
                  <h1>{t("nav.projects")}</h1>
                  <p>{t("project.pageIntro")}</p>
                  {timeError ? <p className="status error">{timeError}</p> : null}
                  {adminStatus ? <p className="status">{adminStatus}</p> : null}
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
                    {managedProjects.map((project) => {
                      const stage = project.funnel_status || "ordered";
                      const next = project.next_funnel || [];
                      const canPlanKickoff = next.includes("kickoff_planned");
                      return (
                      <li key={project.id}>
                        <div>
                          <strong>
                            {project.customer_name} · {project.name}
                          </strong>
                          <div className="muted">
                            {t(`project.funnel.${stage}`)}
                            {" · "}
                            {project.engagement_type === "tm"
                              ? t("project.engagementTm")
                              : t("project.engagementFixed")}
                            {" · "}
                            €{project.fixed_price_eur} → €{project.consultancy_budget_eur} ·{" "}
                            {project.contracted_hours}h ({t("time.remaining", { hours: project.remaining_hours })})
                            {project.kickoff_at
                              ? ` · ${t("project.kickoffAt")}: ${new Date(project.kickoff_at).toLocaleString()}`
                              : ""}
                          </div>
                        </div>
                        <div className="entry-actions">
                          {canPlanKickoff ? (
                            <button
                              type="button"
                              className="primary"
                              onClick={() => void openKickoffPicker(project)}
                            >
                              {t("agenda.planKickoff")}
                            </button>
                          ) : null}
                          {next
                            .filter((target) => target !== "kickoff_planned")
                            .map((target) => (
                            <button
                              key={target}
                              type="button"
                              onClick={() => void advanceProjectFunnel(project.id, target)}
                            >
                              {t("project.advanceTo", { stage: t(`project.funnel.${target}`) })}
                            </button>
                          ))}
                          <button type="button" onClick={() => startEditProject(project)}>
                            {t("budget.edit")}
                          </button>
                        </div>
                      </li>
                      );
                    })}
                  </ul>

                  {kickoffPickerProjectId ? (
                    <div className="customer-form">
                      <h2>{t("agenda.pickerTitle")}</h2>
                      <p className="status">{t("agenda.pickerIntro")}</p>
                      {kickoffLoading ? <p className="status">{t("agenda.loading")}</p> : null}
                      {!kickoffLoading && kickoffSlots.length === 0 ? (
                        <p className="status">{t("agenda.noSlots")}</p>
                      ) : null}
                      <ul className="entry-list">
                        {kickoffSlots.map((slot) => (
                          <li key={`${slot.consultant_rate_id}-${slot.starts_at}`}>
                            <div>
                              <strong>{new Date(slot.starts_at).toLocaleString()}</strong>
                              <div className="muted">
                                {slot.display_name} · {slot.duration_minutes}m
                              </div>
                            </div>
                            <div className="entry-actions">
                              <button
                                type="button"
                                className="primary"
                                disabled={kickoffLoading}
                                onClick={() => void bookKickoffSlot(slot)}
                              >
                                {t("agenda.bookSlot")}
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                      <div className="actions">
                        <button
                          type="button"
                          onClick={() => {
                            setKickoffPickerProjectId(null);
                            setKickoffSlots([]);
                          }}
                        >
                          {t("customer.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : null}

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
                      <label htmlFor="projectKickoff">{t("project.kickoffAt")}</label>
                      <input
                        id="projectKickoff"
                        type="datetime-local"
                        value={budgetForm.kickoff_at}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, kickoff_at: e.target.value }))}
                      />
                      <p className="field-hint">{t("project.kickoffHint")}</p>
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
                      {staffingDraft.map((row, idx) => {
                        const usedIds = new Set(
                          staffingDraft
                            .filter((_, i) => i !== idx)
                            .map((s) => s.consultant_rate_id)
                            .filter(Boolean),
                        );
                        const options = resources.filter(
                          (r) =>
                            r.active &&
                            (!usedIds.has(r.id) || r.id === row.consultant_rate_id),
                        );
                        return (
                        <div key={row.key} className="form-row">
                          <div>
                            <label>{t("budget.consultant")}</label>
                            <select
                              value={row.consultant_rate_id}
                              onChange={(e) => assignStaffingResource(idx, e.target.value)}
                              required
                            >
                              <option value="">{t("budget.pickResource")}</option>
                              {options.map((r) => (
                                <option key={r.id} value={r.id}>
                                  {r.display_name} · €{r.billable_rate_eur}/h
                                </option>
                              ))}
                            </select>
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
                            <p className="field-hint">{t("budget.rateHint")}</p>
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
                        );
                      })}
                      <div className="actions">
                        <button
                          type="button"
                          disabled={
                            resources.filter((r) => r.active).length === 0 ||
                            staffingDraft.length >= resources.filter((r) => r.active).length
                          }
                          onClick={() =>
                            setStaffingDraft((prev) => [
                              ...prev,
                              {
                                key: crypto.randomUUID(),
                                partner_id: "",
                                consultant_rate_id: "",
                                display_name: "",
                                rate_eur: "",
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
