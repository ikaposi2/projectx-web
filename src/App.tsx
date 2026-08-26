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
  partner_id: string;
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
  undo_blocked_reason?: string | null;
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
  period_label?: string | null;
  actions: {
    kind: string;
    label: string;
    amount_eur: number;
    enabled: boolean;
    hours?: number;
    rate_eur?: number;
    period_label?: string | null;
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
  is_senior: boolean;
  is_partner: boolean;
  active: boolean;
  company_name?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  vat_id?: string | null;
  bank_account?: string | null;
  invoice_email?: string | null;
};

type PersonnelCandidate = {
  partner_id: string;
  resource_id?: string | null;
  display_name: string;
  month: string;
  hours: number;
  rate_eur: number;
  subtotal_eur: number;
  vat_rate: number;
  vat_eur: number;
  total_eur: number;
  already_generated: boolean;
  invoice_id?: string | null;
  invoice_number?: string | null;
};

type FinanceFunnelSnapshot = {
  backlog_count: number;
  backlog_value_eur: number;
  backlog_remaining_hours: number;
  backlog_contracted_hours: number;
  stages: {
    funnel_status: string;
    count: number;
    value_eur: number;
    remaining_hours: number;
    contracted_hours: number;
  }[];
  monthly_sold: {
    month: string;
    count: number;
    value_eur: number;
    contracted_hours: number;
  }[];
  projects: {
    id: string;
    customer_name: string;
    name: string;
    funnel_status: string;
    fixed_price_eur: number;
    remaining_hours: number;
    contracted_hours: number;
    created_at?: string | null;
  }[];
};

type AppView =
  | "home"
  | "hours"
  | "admin"
  | "customers"
  | "finance"
  | "reporting"
  | "catalog"
  | "projects"
  | "resources"
  | "unavailable"
  | "planning";
type FinancePanel = "operational" | "billing" | "costs" | "kpis" | "funnel" | null;
type KpiHorizon = "monthly" | "quarterly" | "annually";
type NavIconName =
  | "home"
  | "hours"
  | "admin"
  | "customers"
  | "projects"
  | "planning"
  | "finance"
  | "reporting"
  | "catalog"
  | "resources"
  | "menu"
  | "flowCustomer"
  | "flowProject"
  | "flowConfig"
  | "flowHours"
  | "flowApprove"
  | "flowClose"
  | "flowBill";

type ReportSummary = {
  from_date: string;
  to_date: string;
  funnel: {
    funnel_status: string;
    count: number;
    value_eur: number;
    remaining_hours: number;
    contracted_hours: number;
  }[];
  in_progress: {
    total_eur: number;
    fixed_remaining_eur: number;
    tm_wip_eur: number;
    project_count: number;
    fixed_project_count: number;
    tm_project_count: number;
  };
  utilization: {
    billable_hours: number;
    non_billable_hours: number;
    capacity_hours: number;
    utilization_pct: number;
    resource_count: number;
    working_days: number;
    hours_per_day: number;
  };
  delivered_eur: number;
  received_eur: number;
};

function NavIcon({ name }: { name: NavIconName }) {
  const common = {
    className: name.startsWith("flow") ? "flow-icon" : "nav-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 11.5 12 4l9 7.5" />
          <path d="M6 10.5V20h12v-9.5" />
        </svg>
      );
    case "hours":
    case "flowHours":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v5l3 2" />
        </svg>
      );
    case "admin":
    case "flowApprove":
      return (
        <svg {...common}>
          <path d="M9 12l2 2 4-4" />
          <path d="M5 6h14v12H5z" />
        </svg>
      );
    case "customers":
    case "flowCustomer":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3 19c0-3 2.5-5 6-5s6 2 6 5" />
          <circle cx="17" cy="9" r="2.5" />
          <path d="M16 19c1.5-.8 3-2.2 3-4.5" />
        </svg>
      );
    case "projects":
    case "flowProject":
      return (
        <svg {...common}>
          <path d="M4 8h16v11H4z" />
          <path d="M8 8V6h8v2" />
        </svg>
      );
    case "planning":
      return (
        <svg {...common}>
          <path d="M5 5h14v14H5z" />
          <path d="M5 10h14M10 5v14" />
        </svg>
      );
    case "finance":
    case "flowBill":
      return (
        <svg {...common}>
          <path d="M6 4h12v16H6z" />
          <path d="M9 9h6M9 13h6M9 17h4" />
        </svg>
      );
    case "reporting":
      return (
        <svg {...common}>
          <path d="M4 19V5" />
          <path d="M4 19h16" />
          <path d="M8 16V10" />
          <path d="M12 16V7" />
          <path d="M16 16v-4" />
        </svg>
      );
    case "catalog":
      return (
        <svg {...common}>
          <path d="M6 4h9l3 3v13H6z" />
          <path d="M15 4v3h3M9 12h6M9 16h6" />
        </svg>
      );
    case "resources":
      return (
        <svg {...common}>
          <circle cx="8" cy="9" r="2.5" />
          <circle cx="16" cy="9" r="2.5" />
          <path d="M4 19c0-2.5 2-4 4-4s4 1.5 4 4M12 19c0-2.5 2-4 4-4s4 1.5 4 4" />
        </svg>
      );
    case "flowConfig":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v2M12 19v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M3 12h2M19 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      );
    case "flowClose":
      return (
        <svg {...common}>
          <path d="M6 6h12v12H6z" />
          <path d="M9 12h6" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    default:
      return null;
  }
}

const PROJECT_DIAL_STAGES = [
  "ordered",
  "kickoff_planned",
  "validated",
  "in_delivery",
  "delivered",
  "invoiced",
  "closed",
] as const;

function normalizeDialStage(status: string | null | undefined): (typeof PROJECT_DIAL_STAGES)[number] {
  const raw = (status || "ordered").trim();
  if (raw === "finalizing") return "delivered";
  if (raw === "registered") return "ordered";
  if (raw === "paid") return "closed";
  if ((PROJECT_DIAL_STAGES as readonly string[]).includes(raw)) {
    return raw as (typeof PROJECT_DIAL_STAGES)[number];
  }
  return "ordered";
}

function ProjectPhaseDial({
  stage,
  label,
}: {
  stage: string | null | undefined;
  label: (key: string) => string;
}) {
  const current = normalizeDialStage(stage);
  const idx = PROJECT_DIAL_STAGES.indexOf(current);
  const n = PROJECT_DIAL_STAGES.length;
  const cx = 110;
  const cy = 110;
  const r = 78;
  const startAngle = Math.PI * 0.75; // lower-left
  const endAngle = Math.PI * 2.25; // lower-right (sweep 270°)
  const sweep = endAngle - startAngle;
  const angleAt = (i: number) => startAngle + (sweep * i) / (n - 1);
  const pt = (ang: number, radius: number) => ({
    x: cx + Math.cos(ang) * radius,
    y: cy + Math.sin(ang) * radius,
  });
  const arcPath = (from: number, to: number) => {
    const a0 = angleAt(from);
    const a1 = angleAt(to);
    const p0 = pt(a0, r);
    const p1 = pt(a1, r);
    const large = a1 - a0 > Math.PI ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y}`;
  };
  const needle = pt(angleAt(Math.max(0, idx)), r - 18);
  const knob = pt(angleAt(Math.max(0, idx)), r);

  return (
    <div className="phase-dial" aria-label={label(`project.funnel.${current}`)}>
      <svg className="phase-dial-svg" viewBox="0 0 220 200" role="img">
        <path className="phase-dial-arc" d={arcPath(0, n - 1)} />
        {idx > 0 ? <path className="phase-dial-progress" d={arcPath(0, idx)} /> : null}
        {PROJECT_DIAL_STAGES.map((s, i) => {
          const p = pt(angleAt(i), r);
          const cls =
            i < idx ? "phase-dial-tick done" : i === idx ? "phase-dial-tick active" : "phase-dial-tick";
          return <circle key={s} className={cls} cx={p.x} cy={p.y} r={i === idx ? 5.5 : 3.5} />;
        })}
        <line className="phase-dial-needle" x1={cx} y1={cy} x2={needle.x} y2={needle.y} />
        <circle cx={cx} cy={cy} r={6} fill="var(--brand-primary)" />
        <circle className="phase-dial-knob" cx={knob.x} cy={knob.y} r={8} />
      </svg>
      <p className="phase-dial-label">{label(`project.funnel.${current}`)}</p>
      <div className="phase-dial-track">
        {PROJECT_DIAL_STAGES.map((s, i) => (
          <span
            key={s}
            className={
              i < idx ? "phase-dial-chip done" : i === idx ? "phase-dial-chip active" : "phase-dial-chip"
            }
          >
            {label(`project.funnel.${s}`)}
          </span>
        ))}
      </div>
    </div>
  );
}

function defaultUnavailLocalRange(): { starts_at: string; ends_at: string } {
  const start = new Date();
  start.setHours(9, 0, 0, 0);
  if (start.getTime() < Date.now()) {
    start.setDate(start.getDate() + 1);
  }
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);
  return {
    starts_at: toDateTimeLocalValue(start.toISOString()),
    ends_at: toDateTimeLocalValue(end.toISOString()),
  };
}

/** True when an appointment interval overlaps the local calendar day `dayIso` (YYYY-MM-DD). */
function appointmentOverlapsDay(startsAt: string, endsAt: string, dayIso: string): boolean {
  const dayStart = new Date(`${dayIso}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  return start < dayEnd && end > dayStart;
}

const CORP_TAX_RATE = 0.258;
/** Dutch default VAT; personnel rates are stored ex-VAT. */
const DEFAULT_VAT_RATE = 0.21;

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
/** Kickoff office-hour starts (Europe/Amsterdam), Mon–Fri 09:00–16:00. */
const KICKOFF_HOUR_STARTS = [9, 10, 11, 12, 13, 14, 15, 16] as const;
const KICKOFF_HORIZON_DAYS = 90;

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

/** Date (YYYY-MM-DD) + hour in Europe/Amsterdam for agenda matching. */
function amsterdamDateHour(iso: string): { date: string; hour: number; minute: number } {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

/** Convert Europe/Amsterdam wall time on a calendar date to a UTC Date. */
function amsterdamWallToUtc(date: string, hour: number, minute = 0): Date {
  let t = Date.parse(
    `${date}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00Z`,
  );
  for (let i = 0; i < 4; i++) {
    const parts = amsterdamDateHour(new Date(t).toISOString());
    if (parts.date === date && parts.hour === hour && parts.minute === minute) {
      return new Date(t);
    }
    const got = Date.parse(`${parts.date}T00:00:00Z`) + (parts.hour * 60 + parts.minute) * 60000;
    const want = Date.parse(`${date}T00:00:00Z`) + (hour * 60 + minute) * 60000;
    t += want - got;
  }
  return new Date(t);
}

function amsterdamWeekdayMon0(date: string): number {
  const probe = amsterdamWallToUtc(date, 12, 0);
  const wd = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
  }).format(probe);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[wd] ?? 0;
}

/** Office-hour (Mon–Fri 09–17 Amsterdam) overlaps for an unavailable range. */
function unavailableOfficeDayHours(
  startsIso: string,
  endsIso: string,
): { date: string; hours: number }[] {
  const rangeStart = new Date(startsIso);
  const rangeEnd = new Date(endsIso);
  if (!(rangeEnd > rangeStart)) return [];
  const dates: string[] = [];
  for (let t = rangeStart.getTime(); t <= rangeEnd.getTime(); t += 12 * 3600 * 1000) {
    const { date } = amsterdamDateHour(new Date(t).toISOString());
    if (!dates.includes(date)) dates.push(date);
  }
  const endDate = amsterdamDateHour(endsIso).date;
  if (!dates.includes(endDate)) dates.push(endDate);

  const out: { date: string; hours: number }[] = [];
  for (const date of dates) {
    if (amsterdamWeekdayMon0(date) >= 5) continue;
    const officeStart = amsterdamWallToUtc(date, 9, 0);
    const officeEnd = amsterdamWallToUtc(date, 17, 0);
    const a = Math.max(rangeStart.getTime(), officeStart.getTime());
    const b = Math.min(rangeEnd.getTime(), officeEnd.getTime());
    if (b <= a) continue;
    const hours = Math.round(((b - a) / 3600000) * 100) / 100;
    if (hours > 0) out.push({ date, hours: Math.min(8, hours) });
  }
  return out;
}

const UNAVAILABLE_ENTRY_TAG = "Unavailable:";
const DEMO_PARTNER_IDS = new Set(["senior-demo", "junior-demo", "partner-demo"]);

/** True when partner_id is a real login user (not a seed placeholder or auto-generated orphan). */
function isLinkedLoginUserId(partnerId: string, userId: string, tenantUserIds: Set<string>): boolean {
  const id = (partnerId || "").trim();
  if (!id || DEMO_PARTNER_IDS.has(id) || id.startsWith("unlinked-") || id.startsWith("u-")) return false;
  if (id === userId) return true;
  return tenantUserIds.has(id);
}

/** datetime-local value from ISO (local timezone). */
function toDateTimeLocalValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Split `YYYY-MM-DDTHH:mm` into date + time parts for separate inputs. */
function splitDateTimeLocal(value: string): { date: string; time: string } {
  const [date = "", rest = ""] = value.split("T");
  return { date, time: rest.slice(0, 5) || "09:00" };
}

function joinDateTimeLocal(date: string, time: string): string {
  if (!date.trim()) return "";
  return `${date.trim()}T${(time.trim() || "00:00").slice(0, 5)}`;
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

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthBoundsIso(month: string): { from: string; to: string } {
  const [ys, ms] = month.split("-");
  const y = Number(ys);
  const m = Number(ms);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return {
    from: `${month}-01`,
    to: `${month}-${String(last).padStart(2, "0")}`,
  };
}

/** Months covered by a KPI horizon anchored on YYYY-MM. */
function monthsForKpiHorizon(anchorMonth: string, horizon: KpiHorizon): string[] {
  const y = Number(anchorMonth.slice(0, 4));
  const m = Number(anchorMonth.slice(5, 7));
  if (!y || !m) return [];
  if (horizon === "monthly") return [anchorMonth];
  if (horizon === "quarterly") {
    const qStart = Math.floor((m - 1) / 3) * 3 + 1;
    return [0, 1, 2].map((i) => `${y}-${String(qStart + i).padStart(2, "0")}`);
  }
  return Array.from({ length: 12 }, (_, i) => `${y}-${String(i + 1).padStart(2, "0")}`);
}

function kpiPeriodLabel(anchorMonth: string, horizon: KpiHorizon): string {
  const y = anchorMonth.slice(0, 4);
  const m = Number(anchorMonth.slice(5, 7));
  if (horizon === "monthly") return anchorMonth;
  if (horizon === "quarterly") return `${y}-Q${Math.ceil(m / 3)}`;
  return y;
}

/**
 * Non-personnel costs for a set of months.
 * One-offs counted when their month is in range; recurring counted × months active in range
 * (so a full quarter/year of an ongoing cost is ×3 / ×12).
 */
function nonPersonnelForMonths(
  costs: {
    amount_eur: number;
    cadence: string;
    start_month: string;
    end_month: string | null;
  }[],
  months: string[],
): number {
  if (months.length === 0) return 0;
  const monthSet = new Set(months);
  let sum = 0;
  for (const c of costs) {
    if (c.cadence === "one_off") {
      if (monthSet.has(c.start_month)) sum += c.amount_eur || 0;
      continue;
    }
    const active = months.filter(
      (mo) => mo >= c.start_month && (!c.end_month || mo <= c.end_month),
    ).length;
    sum += (c.amount_eur || 0) * active;
  }
  return sum;
}

function isoInMonths(iso: string | null | undefined, months: string[]): boolean {
  if (!iso) return false;
  const key = iso.slice(0, 7);
  return months.includes(key);
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
  const [view, setView] = useState<AppView>("home");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
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
  const [kpiHorizon, setKpiHorizon] = useState<KpiHorizon>("monthly");
  const [kpiAnchorMonth, setKpiAnchorMonth] = useState(() => monthKey(new Date()));
  const [invoiceSearch, setInvoiceSearch] = useState({ q: "", date: "", id: "" });
  const [financeWeekStart, setFinanceWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const [invoiceAgenda, setInvoiceAgenda] = useState<InvoiceAgendaItem[]>([]);
  const [kickoffAppointments, setKickoffAppointments] = useState<KickoffAppointment[]>([]);
  const [kickoffPickerProjectId, setKickoffPickerProjectId] = useState<string | null>(null);
  const [kickoffSlots, setKickoffSlots] = useState<AvailabilitySlot[]>([]);
  const [kickoffLoading, setKickoffLoading] = useState(false);
  const [kickoffWeekStart, setKickoffWeekStart] = useState(() => startOfIsoWeek(new Date()));
  const [kickoffHorizonEnd, setKickoffHorizonEnd] = useState(() =>
    toIsoDate(addDays(new Date(), KICKOFF_HORIZON_DAYS)),
  );
  const [resourceCalendarWeek, setResourceCalendarWeek] = useState(() => startOfIsoWeek(new Date()));
  const [resourceCalendar, setResourceCalendar] = useState<KickoffAppointment[]>([]);
  const [agendaResourceId, setAgendaResourceId] = useState<string>("");
  const [projectAgendaId, setProjectAgendaId] = useState<string>("");
  const [projectAgenda, setProjectAgenda] = useState<KickoffAppointment[]>([]);
  const [calendarForm, setCalendarForm] = useState(() => ({
    consultant_rate_id: "",
    starts_at: defaultUnavailLocalRange().starts_at,
    ends_at: defaultUnavailLocalRange().ends_at,
    notes: "",
  }));
  const [monthlyCosts, setMonthlyCosts] = useState<MonthlyCost[]>([]);
  const [allMonthlyCosts, setAllMonthlyCosts] = useState<MonthlyCost[]>([]);
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
  const [billingMonth, setBillingMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [reportSummary, setReportSummary] = useState<ReportSummary | null>(null);
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
  const [tenantUserIds, setTenantUserIds] = useState<Set<string>>(() => new Set());
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [creatingResource, setCreatingResource] = useState(false);
  const unavailableRepairDone = useRef(false);
  const emptyResourceForm = {
    display_name: "",
    kind: "external" as "internal" | "external",
    billable_rate_eur: "150",
    partner_id: "",
    is_senior: false,
    is_partner: false,
    company_name: "",
    address_line1: "",
    address_line2: "",
    postal_code: "",
    city: "",
    country: "",
    vat_id: "",
    bank_account: "",
    invoice_email: "",
  };
  const [resourceForm, setResourceForm] = useState(emptyResourceForm);
  const [personnelCandidates, setPersonnelCandidates] = useState<PersonnelCandidate[]>([]);
  const [personnelProposals, setPersonnelProposals] = useState<FinanceInvoice[]>([]);
  const [generatingProposalFor, setGeneratingProposalFor] = useState<string | null>(null);
  const [financeFunnel, setFinanceFunnel] = useState<FinanceFunnelSnapshot | null>(null);
  const [projectCreateCustomerId, setProjectCreateCustomerId] = useState("");
  const [projectCreateCustomerQuery, setProjectCreateCustomerQuery] = useState("");
  const [projectCreateCustomers, setProjectCreateCustomers] = useState<Customer[]>([]);
  const [projectBillable, setProjectBillable] = useState<BillableCheck | null>(null);
  const [projectCreateServiceId, setProjectCreateServiceId] = useState("");
  const [projectCreateName, setProjectCreateName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const activeCellKey = useRef<string | null>(null);

  const weekDates = useMemo(
    () => DAY_KEYS.map((_, i) => toIsoDate(addDays(weekStart, i))),
    [weekStart],
  );

  const myEntries = useMemo(
    () => (user ? entries.filter((entry) => entry.partner_id === user.id) : entries),
    [entries, user],
  );

  const pendingHoursByProject = useMemo(() => {
    const map = new Map<string, number>();
    const weekSet = new Set(weekDates);
    const weekCellKeys = new Set<string>();

    for (const date of weekDates) {
      for (const rowId of [...projects.map((p) => p.id), ...budgets.map((b) => b.id)]) {
        const key = `${rowId}|${date}`;
        weekCellKeys.add(key);
        const entry = myEntries.find((e) => e.project_id === rowId && e.work_date === date);
        // Approved hours are already deducted from remaining_hours; rejected do not count.
        if (entry?.status === "approved" || entry?.status === "rejected") continue;

        const draft = draftHours[key];
        if (draft !== undefined) {
          const n = Number(String(draft).replace(",", "."));
          const hours = Number.isFinite(n) && n > 0 ? n : 0;
          if (hours > 0) map.set(rowId, (map.get(rowId) || 0) + hours);
          continue;
        }
        if (entry?.status === "submitted") {
          map.set(rowId, (map.get(rowId) || 0) + entry.hours);
        }
      }
    }

    for (const entry of myEntries) {
      if (!entry.project_id || entry.status !== "submitted") continue;
      if (weekSet.has(entry.work_date) && weekCellKeys.has(`${entry.project_id}|${entry.work_date}`)) {
        continue;
      }
      map.set(entry.project_id, (map.get(entry.project_id) || 0) + entry.hours);
    }
    return map;
  }, [myEntries, weekDates, projects, budgets, draftHours]);

  const rows: GridRow[] = useMemo(() => {
    const formatRemain = (n: number) => {
      const rounded = Math.round(n * 10) / 10;
      return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
    };
    const bookable: GridRow[] = [
      ...projects.map((p) => {
        const pending = pendingHoursByProject.get(p.id) || 0;
        const live = (p.remaining_hours || 0) - pending;
        return {
          id: p.id,
          label: `${p.customer_name} · ${p.name}`,
          subtitle: formatRemain(live),
          classification: "billable" as const,
        };
      }),
      ...budgets.map((b) => {
        const pending = pendingHoursByProject.get(b.id) || 0;
        const live = (b.remaining_hours || 0) - pending;
        return {
          id: b.id,
          label: b.name,
          subtitle: formatRemain(live),
          classification: "non_billable" as const,
        };
      }),
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
  }, [projects, budgets, myEntries, projectLabels, pendingHoursByProject]);

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
    const monthParam = billingMonth ? `?month=${encodeURIComponent(billingMonth)}` : "";
    try {
      const [reserveRes, vatRes, compRes, invRes, candRes, companyRes, agendaRes, kickoffRes] =
        await Promise.all([
          fetch(`${FINANCE_API}/reserve`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/vat`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/compensation`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/invoices`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${FINANCE_API}/billing/candidates${monthParam}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
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
  }, [token, financeWeekStart, billingMonth]);

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

  const loadPersonnelCandidates = useCallback(async () => {
    if (!token || !costMonth) return;
    try {
      const res = await fetch(
        `${FINANCE_API}/personnel-invoices/candidates?month=${encodeURIComponent(costMonth)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      setPersonnelCandidates((await res.json()) as PersonnelCandidate[]);
    } catch (err) {
      setPersonnelCandidates([]);
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token, costMonth]);

  const loadPersonnelProposals = useCallback(async () => {
    if (!token || !costMonth) return;
    try {
      const res = await fetch(
        `${FINANCE_API}/personnel-invoices?month=${encodeURIComponent(costMonth)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      setPersonnelProposals((await res.json()) as FinanceInvoice[]);
    } catch (err) {
      setPersonnelProposals([]);
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token, costMonth]);

  const loadFinanceFunnel = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${PROJECT_API}/projects/funnel/finance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setFinanceFunnel((await res.json()) as FinanceFunnelSnapshot);
    } catch (err) {
      setFinanceFunnel(null);
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token]);

  const loadReportSummary = useCallback(async () => {
    if (!token || !reportMonth) return;
    try {
      const { from, to } = monthBoundsIso(reportMonth);
      const res = await fetch(
        `${FINANCE_API}/reports/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(await res.text());
      setTimeError(null);
      setReportSummary((await res.json()) as ReportSummary);
    } catch (err) {
      setReportSummary(null);
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token, reportMonth]);

  const loadAllMonthlyCosts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${FINANCE_API}/costs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(await res.text());
      setAllMonthlyCosts((await res.json()) as MonthlyCost[]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }, [token]);

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

  const loadTenantUsers = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const rows = (await res.json()) as { id: string }[];
      setTenantUserIds(new Set(rows.map((r) => r.id)));
    } catch {
      /* optional directory — unavailable booking still works with user.id */
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
      if (MANAGER_ROLES.has(user.role)) void loadTenantUsers();
    }
  }, [user, token, loadBookable, loadEntries, loadTenantUsers]);

  useEffect(() => {
    if (!token || !user || view !== "hours") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    if (unavailableRepairDone.current) return;
    unavailableRepairDone.current = true;
    void repairOrphanedUnavailableHours();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot repair when opening hours
  }, [token, user, view]);

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
    if (!token || !user || view !== "reporting") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadReportSummary();
  }, [token, user, view, loadReportSummary, reportMonth]);

  useEffect(() => {
    if (!token || !user || view !== "finance") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadFinance();
    void loadManagedProjects();
    void loadResources();
    void loadMonthlyCosts();
    void loadAllMonthlyCosts();
    void loadPersonnelCandidates();
    void loadPersonnelProposals();
    void loadFinanceFunnel();
  }, [
    token,
    user,
    view,
    loadFinance,
    financeWeekStart,
    loadManagedProjects,
    loadResources,
    loadMonthlyCosts,
    loadAllMonthlyCosts,
    loadPersonnelCandidates,
    loadPersonnelProposals,
    loadFinanceFunnel,
    costMonth,
  ]);

  useEffect(() => {
    if (!token || !user || view !== "catalog") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadCatalog();
  }, [token, user, view, loadCatalog]);

  useEffect(() => {
    if (!token || !user || (view !== "resources" && view !== "planning" && view !== "unavailable")) return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadResources();
    if (view !== "unavailable") {
      void loadResourceCalendar();
      void loadManagedProjects();
    }
  }, [token, user, view, loadResources, loadResourceCalendar, resourceCalendarWeek, loadManagedProjects]);

  useEffect(() => {
    if (!token || !user || view !== "resources") return;
    void loadProjectAgenda();
  }, [token, user, view, loadProjectAgenda]);

  useEffect(() => {
    if (!token || !user || view !== "home") return;
    if (!MANAGER_ROLES.has(user.role)) return;
    void loadManagedProjects();
  }, [token, user, view, loadManagedProjects]);

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
      if (detail === "proposal_already_exists") return t("finance.personnelProposalExists");
      if (detail === "no_hours_for_month") return t("finance.noHoursForMonth");
      if (detail === "no_billable_hours") return t("finance.noHoursForMonth");
      if (detail === "invalid_month") return t("finance.invalidBillingMonth");
      if (detail === "billing_not_available") return t("finance.billingNotAvailable");
      if (detail === "already_invoiced") return t("finance.compensationInvoiced");
      if (detail === "project_closed") return t("finance.compensationProjectClosed");
      if (detail === "slot_unavailable") return t("agenda.slotUnavailable");
      if (detail === "invalid_range") return t("agenda.invalidRange");
      if (detail === "range_too_large") return t("agenda.rangeTooLarge");
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
    const target = adminEntries.find((e) => e.id === id) || entries.find((e) => e.id === id);
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
      // Optimistic remaining so the counter does not jump while NATS catches up.
      if (target?.project_id) {
        let delta = 0;
        if (action === "approve") delta = -target.hours;
        else if (action === "refuse" && target.status === "approved") delta = target.hours;
        if (delta !== 0) {
          if (target.classification === "billable") {
            setProjects((prev) =>
              prev.map((p) =>
                p.id === target.project_id
                  ? {
                      ...p,
                      remaining_hours: Math.round((p.remaining_hours + delta) * 100) / 100,
                    }
                  : p,
              ),
            );
          } else {
            setBudgets((prev) =>
              prev.map((b) =>
                b.id === target.project_id
                  ? {
                      ...b,
                      remaining_hours: Math.round((b.remaining_hours + delta) * 100) / 100,
                    }
                  : b,
              ),
            );
          }
        }
      }
      await Promise.all([loadEntries(), loadAdminEntries()]);
      for (let i = 0; i < 5; i++) {
        await new Promise((resolve) => setTimeout(resolve, 250 + i * 150));
        await loadBookable();
      }
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
    setCreatingProject(false);
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
    const todayWeek = startOfIsoWeek(new Date());
    setKickoffWeekStart(todayWeek);
    const from = toIsoDate(new Date());
    const to = toIsoDate(addDays(new Date(), KICKOFF_HORIZON_DAYS));
    setKickoffHorizonEnd(to);
    setKickoffLoading(true);
    try {
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

      // First paid hour: 1h billable kickoff on the senior, auto-approved.
      const workDate = amsterdamDateHour(slot.starts_at).date;
      const resource = resources.find((r) => r.id === slot.consultant_rate_id);
      const partnerId = (resource?.partner_id || slot.partner_id || "").trim();
      let hoursWarning: string | null = null;
      if (partnerId) {
        const hoursRes = await fetch(`${TIME_API}/entries`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            work_date: workDate,
            hours: 1,
            classification: "billable",
            description: t("agenda.kickoffHoursDescription"),
            project_id: project.id,
            partner_id: partnerId,
            auto_approve: true,
          }),
        });
        if (!hoursRes.ok) {
          const detail = await hoursRes.json().catch(() => ({}));
          hoursWarning = formatApiError(detail.detail, hoursRes.statusText);
        }
      } else {
        hoursWarning = t("agenda.kickoffHoursMissingPartner");
      }

      setAdminStatus(
        hoursWarning
          ? `${t("agenda.booked", {
              when: new Date(slot.starts_at).toLocaleString(),
              who: slot.display_name,
            })} ${t("agenda.kickoffHoursFailed", { detail: hoursWarning })}`
          : t("agenda.bookedWithHours", {
              when: new Date(slot.starts_at).toLocaleString(),
              who: slot.display_name,
            }),
      );
      setKickoffPickerProjectId(null);
      setKickoffSlots([]);
      await Promise.all([
        loadManagedProjects(),
        loadBookable(),
        loadFinance(),
        loadEntries(),
        loadAdminEntries(),
      ]);
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
      const body: { project_id: string; kind: string; period_label?: string } = {
        project_id: projectId,
        kind,
      };
      if (kind === "tm_hours") {
        body.period_label = billingMonth;
      }
      const res = await fetch(`${FINANCE_API}/invoices/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
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
      await Promise.all([loadFinance(), loadManagedProjects(), loadBookable()]);
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
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      setFinanceStatus(t("finance.compensationUndone"));
      await loadFinance();
      await Promise.all([loadEntries(), loadAdminEntries(), loadBookable()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function remitVat(year: number, quarter: number, amountEur?: number) {
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
        body: JSON.stringify({
          year,
          quarter,
          ...(amountEur != null ? { amount_eur: amountEur } : {}),
        }),
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
      await Promise.all([loadMonthlyCosts(), loadAllMonthlyCosts()]);
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
      await Promise.all([loadMonthlyCosts(), loadAllMonthlyCosts()]);
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
      await Promise.all([loadMonthlyCosts(), loadAllMonthlyCosts()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function generatePersonnelProposal(partnerId: string) {
    if (!token || !costMonth) return;
    setTimeError(null);
    setFinanceStatus(null);
    setGeneratingProposalFor(partnerId);
    try {
      const res = await fetch(`${FINANCE_API}/personnel-invoices/generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ partner_id: partnerId, month: costMonth }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }
      const created = (await res.json()) as FinanceInvoice;
      setFinanceStatus(t("finance.personnelProposalGenerated"));
      await Promise.all([loadPersonnelCandidates(), loadPersonnelProposals()]);
      if (created.id) {
        await downloadInvoicePdf(created.id);
      }
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    } finally {
      setGeneratingProposalFor(null);
    }
  }

  async function downloadInvoicePdf(invoiceId: string) {
    if (!token) return;
    try {
      const res = await fetch(`${FINANCE_API}/invoices/${invoiceId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText || "pdf_missing"));
      }
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
    setResourceForm(emptyResourceForm);
  }

  function openResourceEdit(r: Resource) {
    setCreatingResource(false);
    setEditingResourceId(r.id);
    setResourceForm({
      display_name: r.display_name,
      kind: r.kind === "internal" ? "internal" : "external",
      billable_rate_eur: String(r.billable_rate_eur),
      partner_id: r.partner_id || "",
      is_senior: r.is_senior,
      is_partner: r.is_partner,
      company_name: r.company_name || "",
      address_line1: r.address_line1 || "",
      address_line2: r.address_line2 || "",
      postal_code: r.postal_code || "",
      city: r.city || "",
      country: r.country || "",
      vat_id: r.vat_id || "",
      bank_account: r.bank_account || "",
      invoice_email: r.invoice_email || "",
    });
  }

  function openUnavailablePage(resourceId?: string) {
    const range = defaultUnavailLocalRange();
    const mine =
      resourceId ||
      resources.find((r) => (r.partner_id || "").trim() === user?.id)?.id ||
      "";
    setCreatingResource(false);
    setEditingResourceId(null);
    setCalendarForm({
      consultant_rate_id: mine,
      starts_at: range.starts_at,
      ends_at: range.ends_at,
      notes: "",
    });
    setTimeError(null);
    goToView("unavailable");
  }

  async function saveResource() {
    if (!token) return;
    setTimeError(null);
    setAdminStatus(null);
    const name = resourceForm.display_name.trim();
    const billable = Number(resourceForm.billable_rate_eur);
    if (!name) {
      setTimeError(t("resources.missingName"));
      return;
    }
    if (!Number.isFinite(billable) || billable <= 0) {
      setTimeError(t("resources.invalidRates"));
      return;
    }
    const body = {
      display_name: name,
      kind: resourceForm.kind,
      billable_rate_eur: billable,
      partner_id: resourceForm.partner_id.trim() || undefined,
      is_senior: resourceForm.is_senior,
      is_partner: resourceForm.is_partner,
      active: true,
      company_name: resourceForm.company_name.trim() || null,
      address_line1: resourceForm.address_line1.trim() || null,
      address_line2: resourceForm.address_line2.trim() || null,
      postal_code: resourceForm.postal_code.trim() || null,
      city: resourceForm.city.trim() || null,
      country: resourceForm.country.trim() || null,
      vat_id: resourceForm.vat_id.trim() || null,
      bank_account: resourceForm.bank_account.trim() || null,
      invoice_email: resourceForm.invoice_email.trim() || null,
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

  async function linkResourceToUser(resourceId: string, partnerId: string): Promise<boolean> {
    if (!token) return false;
    const res = await fetch(`${PARTNER_API}/resources/${resourceId}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ partner_id: partnerId }),
    });
    if (!res.ok) return false;
    setResources((prev) =>
      prev.map((r) => (r.id === resourceId ? { ...r, partner_id: partnerId } : r)),
    );
    return true;
  }

  async function refuseEntryFully(entryId: string) {
    if (!token) return;
    const refuseOnce = () =>
      fetch(`${TIME_API}/entries/${entryId}/refuse`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    await refuseOnce();
    await refuseOnce();
  }

  async function bookUnavailableHoursForAppointment(opts: {
    appointmentId: string;
    starts: string;
    ends: string;
    partnerId: string;
    budgetId: string;
  }): Promise<string | null> {
    if (!token) return "no token";
    const days = unavailableOfficeDayHours(opts.starts, opts.ends);
    if (days.length === 0) return null;
    const tag = `${UNAVAILABLE_ENTRY_TAG}${opts.appointmentId}`;
    const from = days[0].date;
    const to = days[days.length - 1].date;
    const listRes = await fetch(`${TIME_API}/entries?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (listRes.ok) {
      const list = (await listRes.json()) as TimeEntry[];
      for (const entry of list) {
        if (!entry.description?.includes(tag)) continue;
        if (entry.partner_id === opts.partnerId) continue;
        // Orphaned under a resource placeholder / wrong id — move onto the linked user.
        await refuseEntryFully(entry.id);
      }
    }
    const freshRes = await fetch(`${TIME_API}/entries?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const existing = freshRes.ok
      ? ((await freshRes.json()) as TimeEntry[]).filter((e) => e.description?.includes(tag))
      : [];
    for (const day of days) {
      if (
        existing.some(
          (e) =>
            e.work_date === day.date &&
            e.partner_id === opts.partnerId &&
            Math.abs(e.hours - day.hours) < 0.01,
        )
      ) {
        continue;
      }
      const hoursRes = await fetch(`${TIME_API}/entries`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          work_date: day.date,
          hours: day.hours,
          classification: "non_billable",
          description: `${tag} ${t("agenda.unavailableHoursDescription")}`,
          project_id: opts.budgetId,
          partner_id: opts.partnerId,
          auto_approve: true,
          rate_eur: 0,
        }),
      });
      if (!hoursRes.ok) {
        const detail = await hoursRes.json().catch(() => ({}));
        return formatApiError(detail.detail, hoursRes.statusText);
      }
    }
    return null;
  }

  /** Resolve whose timesheet gets unavailable hours; auto-link unlinked resources to the current user when safe. */
  async function resolveUnavailablePartnerId(resource: Resource): Promise<{
    partnerId: string | null;
    autoLinked: boolean;
    warning: string | null;
  }> {
    if (!user) return { partnerId: null, autoLinked: false, warning: t("agenda.unavailableHoursMissingPartner") };
    const raw = (resource.partner_id || "").trim();
    if (isLinkedLoginUserId(raw, user.id, tenantUserIds)) {
      return { partnerId: raw, autoLinked: false, warning: null };
    }
    const alreadyMine = resources.some(
      (r) => r.id !== resource.id && isLinkedLoginUserId(r.partner_id || "", user.id, tenantUserIds) && r.partner_id === user.id,
    );
    if (alreadyMine) {
      return {
        partnerId: null,
        autoLinked: false,
        warning: t("agenda.unavailableHoursMissingPartner"),
      };
    }
    const linked = await linkResourceToUser(resource.id, user.id);
    if (!linked) {
      return {
        partnerId: null,
        autoLinked: false,
        warning: t("agenda.unavailableHoursLinkFailed"),
      };
    }
    return { partnerId: user.id, autoLinked: true, warning: null };
  }

  async function repairOrphanedUnavailableHours() {
    if (!token || !user || !MANAGER_ROLES.has(user.role)) return;
    const usersRes = await fetch(`${API}/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    let userIds = tenantUserIds;
    if (usersRes.ok) {
      const rows = (await usersRes.json()) as { id: string }[];
      userIds = new Set(rows.map((r) => r.id));
      setTenantUserIds(userIds);
    }

    const listRes = await fetch(`${PARTNER_API}/resources`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!listRes.ok) return;
    const resourcesNow = (await listRes.json()) as Resource[];
    setResources(resourcesNow);

    const budgetRes = await fetch(`${PARTNER_API}/budgets/internal`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!budgetRes.ok) return;
    const budgetList = (await budgetRes.json()) as InternalBudget[];
    const unavailableBudget =
      budgetList.find((b) => b.name.toLowerCase() === "unavailable") ||
      budgetList.find((b) => b.id === "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
    if (!unavailableBudget) return;

    const from = toIsoDate(addDays(new Date(), -120));
    const to = toIsoDate(addDays(new Date(), 120));
    const apptRes = await fetch(
      `${PARTNER_API}/appointments?from_day=${from}&to_day=${to}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!apptRes.ok) return;
    const appointments = (await apptRes.json()) as KickoffAppointment[];
    const unavailable = appointments.filter((a) => a.kind === "unavailable" || a.kind === "pto");

    let mine = resourcesNow.filter((r) => (r.partner_id || "").trim() === user.id);
    if (mine.length === 0) {
      const orphans = resourcesNow.filter(
        (r) => r.active && !isLinkedLoginUserId(r.partner_id || "", user.id, userIds),
      );
      const byName = orphans.find(
        (r) => r.display_name.trim().toLowerCase() === (user.full_name || "").trim().toLowerCase(),
      );
      const claim = byName || (orphans.length === 1 ? orphans[0] : null);
      if (claim) {
        const ok = await linkResourceToUser(claim.id, user.id);
        if (ok) mine = [{ ...claim, partner_id: user.id }];
      }
    }

    const mineIds = new Set(mine.map((r) => r.id));
    let touched = false;
    for (const appt of unavailable) {
      if (!mineIds.has(appt.consultant_rate_id)) continue;
      const err = await bookUnavailableHoursForAppointment({
        appointmentId: appt.id,
        starts: appt.starts_at,
        ends: appt.ends_at,
        partnerId: user.id,
        budgetId: unavailableBudget.id,
      });
      if (err === null) touched = true;
    }
    if (touched) await loadEntries();
  }

  async function saveCalendarBlock() {
    if (!token || !user) return;
    if (!calendarForm.consultant_rate_id) {
      setTimeError(t("agenda.resourceRequired"));
      return;
    }
    const starts = fromDateTimeLocalValue(calendarForm.starts_at);
    const ends = fromDateTimeLocalValue(calendarForm.ends_at);
    if (!starts || !ends) {
      setTimeError(t("agenda.endsRequired"));
      return;
    }
    if (new Date(ends).getTime() <= new Date(starts).getTime()) {
      setTimeError(t("agenda.invalidRange"));
      return;
    }
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
      const appointment = (await res.json()) as KickoffAppointment;
      const resource = resources.find((r) => r.id === calendarForm.consultant_rate_id);
      let hoursWarning: string | null = null;
      let autoLinked = false;
      if (!resource) {
        hoursWarning = t("agenda.unavailableHoursMissingPartner");
      } else {
        const resolved = await resolveUnavailablePartnerId(resource);
        autoLinked = resolved.autoLinked;
        if (!resolved.partnerId) {
          hoursWarning = resolved.warning;
        } else {
          await loadBookable();
          const budgetRes = await fetch(`${PARTNER_API}/budgets/internal`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!budgetRes.ok) throw new Error(await budgetRes.text());
          const budgetList = (await budgetRes.json()) as InternalBudget[];
          const unavailableBudget =
            budgetList.find((b) => b.name.toLowerCase() === "unavailable") ||
            budgetList.find((b) => b.id === "dddddddd-dddd-4ddd-8ddd-dddddddddddd");
          if (!unavailableBudget) {
            hoursWarning = t("agenda.unavailableBudgetMissing");
          } else {
            hoursWarning = await bookUnavailableHoursForAppointment({
              appointmentId: appointment.id,
              starts,
              ends,
              partnerId: resolved.partnerId,
              budgetId: unavailableBudget.id,
            });
          }
        }
      }

      setAdminStatus(
        hoursWarning
          ? `${t("agenda.blockSaved")} ${t("agenda.unavailableHoursFailed", { detail: hoursWarning })}`
          : autoLinked
            ? t("agenda.blockSavedWithHoursLinked")
            : t("agenda.blockSavedWithHours"),
      );
      const range = defaultUnavailLocalRange();
      setCalendarForm({
        consultant_rate_id: "",
        starts_at: range.starts_at,
        ends_at: range.ends_at,
        notes: "",
      });
      goToView("resources");
      await Promise.all([loadResourceCalendar(), loadFinance(), loadEntries(), loadBookable(), loadResources()]);
    } catch (err) {
      setTimeError(err instanceof Error ? err.message : "error");
    }
  }

  async function cancelCalendarBlock(id: string) {
    if (!token) return;
    if (!window.confirm(t("agenda.confirmCancelBlock"))) return;
    setTimeError(null);
    try {
      const block = resourceCalendar.find((a) => a.id === id);
      const res = await fetch(`${PARTNER_API}/appointments/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        throw new Error(formatApiError(detail.detail, res.statusText));
      }

      // Reverse auto-approved unavailable time-off (refuse twice: unlock then delete).
      const tag = `${UNAVAILABLE_ENTRY_TAG}${id}`;
      const from = block ? amsterdamDateHour(block.starts_at).date : toIsoDate(addDays(new Date(), -7));
      const to = block ? amsterdamDateHour(block.ends_at).date : toIsoDate(addDays(new Date(), 90));
      const listRes = await fetch(`${TIME_API}/entries?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (listRes.ok) {
        const list = (await listRes.json()) as TimeEntry[];
        for (const entry of list) {
          if (!entry.description?.includes(tag)) continue;
          const refuseOnce = async () =>
            fetch(`${TIME_API}/entries/${entry.id}/refuse`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
          await refuseOnce();
          await refuseOnce();
        }
      }

      setAdminStatus(t("agenda.blockCancelled"));
      await Promise.all([loadResourceCalendar(), loadFinance(), loadEntries(), loadBookable()]);
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
      setProjectBillable(null);
      setCreatingProject(false);
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
      view === "reporting" ||
      view === "catalog" ||
      view === "projects" ||
      view === "resources" ||
      view === "unavailable" ||
      view === "planning") &&
    !isManager
      ? "home"
      : view;
  const overdueCount = invoiceAgenda.filter((a) => a.overdue).length;
  const weekKickoffs = kickoffAppointments.filter((a) => a.kind === "kickoff");
  const resourceWeekBlocks = resourceCalendar.filter(
    (a) => a.kind === "pto" || a.kind === "unavailable" || a.kind === "kickoff",
  );
  const resourceAgendaDates = DAY_KEYS.map((_, i) => toIsoDate(addDays(resourceCalendarWeek, i)));
  const kickoffAgendaDates = DAY_KEYS.slice(0, 5).map((_, i) => toIsoDate(addDays(kickoffWeekStart, i)));
  const kickoffMinWeek = startOfIsoWeek(new Date());
  const kickoffMaxWeek = startOfIsoWeek(addDays(new Date(kickoffHorizonEnd + "T12:00:00Z"), 0));
  const kickoffFreeByCell = useMemo(() => {
    const map = new Map<string, AvailabilitySlot>();
    for (const slot of kickoffSlots) {
      const { date, hour } = amsterdamDateHour(slot.starts_at);
      if (!(KICKOFF_HOUR_STARTS as readonly number[]).includes(hour)) continue;
      const key = `${date}|${hour}`;
      if (!map.has(key)) map.set(key, slot);
    }
    return map;
  }, [kickoffSlots]);
  const agendaResources = resources
    .filter((r) => r.active)
    .filter((r) => !agendaResourceId || r.id === agendaResourceId);
  const openProjects = managedProjects.filter(
    (p) => !["paid", "closed"].includes(normalizeDialStage(p.funnel_status)),
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
  const kpiMonths = monthsForKpiHorizon(kpiAnchorMonth, kpiHorizon);
  const kpiPeriod = kpiPeriodLabel(kpiAnchorMonth, kpiHorizon);
  const periodCompensation = compensation.filter((c) => isoInMonths(c.updated_at, kpiMonths));
  const periodInvoices = invoices.filter((i) => isoInMonths(i.issued_at, kpiMonths));
  const billedPeriod = periodInvoices
    .filter((i) => i.status === "issued" || i.status === "paid")
    .reduce((s, i) => s + i.subtotal_eur, 0);
  const receivedPeriod = periodInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount_eur, 0);
  const revenueNetPaid = periodInvoices
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.subtotal_eur, 0);
  const otherCostsTotal = monthlyCosts.reduce((s, row) => s + (row.amount_eur || 0), 0);
  const resourceByPartner = new Map<string, Resource>();
  const resourceById = new Map<string, Resource>();
  for (const r of resources) {
    if (r.partner_id) resourceByPartner.set(r.partner_id, r);
    resourceById.set(r.id, r);
  }
  const staffingFor = (partnerId: string, projectId: string | null | undefined) => {
    if (!projectId) return undefined;
    const project = managedProjects.find((p) => p.id === projectId);
    if (!project?.staffing.length) return undefined;
    return (
      project.staffing.find((s) => s.partner_id === partnerId) ||
      (project.staffing.length === 1 ? project.staffing[0] : undefined)
    );
  };
  const resourceForPartner = (partnerId: string, projectId: string | null | undefined) => {
    const direct = resourceByPartner.get(partnerId);
    if (direct) return direct;
    const staff = staffingFor(partnerId, projectId);
    if (staff?.consultant_rate_id) {
      const byStaff = resourceById.get(staff.consultant_rate_id);
      if (byStaff) return byStaff;
    }
    const active = resources.filter((r) => r.active);
    return active.length === 1 ? active[0] : undefined;
  };
  const expectedBillableRate = (partnerId: string, projectId: string | null | undefined) => {
    const staff = staffingFor(partnerId, projectId);
    if (staff && staff.rate_eur > 0) return staff.rate_eur;
    if (projectId) {
      const project = managedProjects.find((p) => p.id === projectId);
      if (project && project.staffing.length > 1) {
        const shareSum = project.staffing.reduce((s, st) => s + (st.share_pct || 0), 0);
        if (shareSum > 0) {
          return (
            project.staffing.reduce((s, st) => s + st.rate_eur * (st.share_pct || 0), 0) / shareSum
          );
        }
      }
    }
    return resourceForPartner(partnerId, projectId)?.billable_rate_eur || 0;
  };
  const actualResourceRate = (partnerId: string, projectId: string | null | undefined) =>
    resourceForPartner(partnerId, projectId)?.billable_rate_eur || 0;
  const isExternalResource = (partnerId: string, projectId: string | null | undefined) =>
    resourceForPartner(partnerId, projectId)?.kind === "external";
  const personnelCostBase = (c: CompensationEffect) => {
    if (c.classification === "approved_non_billable") return Math.abs(c.amount_eur);
    return c.hours * actualResourceRate(c.partner_id, c.project_id);
  };
  // Billable ledger stores rate=0 by design; derive expected (staffing) vs actual (resource billable).
  const approvedBillableHours = periodCompensation
    .filter((c) => c.classification !== "approved_non_billable")
    .reduce((s, c) => s + c.hours, 0);
  const personnelExpectedCost = periodCompensation.reduce((s, c) => {
    if (c.classification === "approved_non_billable") return s + Math.abs(c.amount_eur);
    return s + c.hours * expectedBillableRate(c.partner_id, c.project_id);
  }, 0);
  const personnelActualCost = periodCompensation.reduce((s, c) => s + personnelCostBase(c), 0);
  const personnelNonBillableCost = periodCompensation
    .filter((c) => c.classification === "approved_non_billable")
    .reduce((s, c) => s + Math.abs(c.amount_eur), 0);
  // External personnel invoices: rate is ex-VAT → VAT is paid then reclaimable as input VAT.
  const personnelInputVat = periodCompensation.reduce((s, c) => {
    if (!isExternalResource(c.partner_id, c.project_id)) return s;
    return s + personnelCostBase(c) * DEFAULT_VAT_RATE;
  }, 0);
  const personnelCostTotal = personnelActualCost;
  // Recurring monthly costs × months in the selected horizon (×1 / ×3 / ×12 when fully active).
  const nonPersonnelCostTotal = nonPersonnelForMonths(allMonthlyCosts, kpiMonths);
  const grossProfit = revenueNetPaid - personnelCostTotal - nonPersonnelCostTotal;
  const projectedTax = Math.max(0, grossProfit * CORP_TAX_RATE);
  const profitAfterTax = grossProfit - projectedTax;
  const personnelInputVatByQuarter = (() => {
    const map = new Map<string, number>();
    for (const c of compensation) {
      if (!isExternalResource(c.partner_id, c.project_id)) continue;
      const iso = c.updated_at || "";
      if (!iso) continue;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) continue;
      const label = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
      map.set(label, (map.get(label) || 0) + personnelCostBase(c) * DEFAULT_VAT_RATE);
    }
    return map;
  })();
  const vatThisQuarter =
    vatAccount?.quarters.find((q) => q.label === vatAccount.current_quarter)?.outstanding_eur ?? 0;
  const vatInputThisQuarter =
    personnelInputVatByQuarter.get(vatAccount?.current_quarter || "") || 0;
  const vatNetThisQuarter = Math.max(0, vatThisQuarter - vatInputThisQuarter);

  function projectProfitStatus(p: ProjectDetail): {
    spent: number;
    sales: number;
    status: "green" | "yellow" | "red";
    pct: number;
    hoursBooked: number;
  } {
    // Prefer approved hours from the finance ledger — contracted−remaining is capped at
    // the budget once remaining hits 0, so overruns would look artificially profitable.
    const billableComp = compensation.filter(
      (c) => c.project_id === p.id && c.classification !== "approved_non_billable",
    );
    const hoursFromLedger = billableComp.reduce((s, c) => s + c.hours, 0);
    const spentFromLedger = billableComp.reduce(
      (s, c) => s + c.hours * (c.rate_eur || 0),
      0,
    );
    const hoursFromBudget = Math.max(0, (p.contracted_hours || 0) - (p.remaining_hours || 0));
    const hoursBooked = hoursFromLedger > 0 ? hoursFromLedger : hoursFromBudget;

    const shareSum = p.staffing.reduce((s, st) => s + (st.share_pct || 0), 0);
    const weightedRate =
      p.staffing.length > 0
        ? shareSum > 0
          ? p.staffing.reduce((s, st) => s + st.rate_eur * (st.share_pct || 0), 0) / shareSum
          : p.staffing.reduce((s, st) => s + st.rate_eur, 0) / p.staffing.length
        : 0;
    const spent =
      spentFromLedger > 0
        ? spentFromLedger
        : hoursBooked * (weightedRate || 0);
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
    return { spent, sales, status, pct, hoursBooked };
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
    if (next === "projects") {
      setCreatingProject(false);
    }
    setView(next);
    setNavOpen(false);
  }

  function openProjectCreate() {
    setCreatingProject(true);
    setEditingProjectId(null);
    setKickoffPickerProjectId(null);
    setKickoffSlots([]);
    setProjectCreateCustomerId("");
    setProjectCreateCustomerQuery("");
    setProjectCreateCustomers([]);
    setProjectCreateServiceId("");
    setProjectCreateName("");
    setProjectBillable(null);
    setTimeError(null);
    setAdminStatus(null);
  }

  function closeProjectCreate() {
    setCreatingProject(false);
    setProjectCreateCustomerId("");
    setProjectCreateCustomerQuery("");
    setProjectCreateCustomers([]);
    setProjectCreateServiceId("");
    setProjectCreateName("");
    setProjectBillable(null);
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
        <div className="topbar-left">
          {user ? (
            <>
              <button
                type="button"
                className="nav-toggle"
                aria-expanded={navOpen}
                aria-controls="side-nav"
                onClick={() => {
                  if (typeof window !== "undefined" && window.matchMedia("(max-width: 800px)").matches) {
                    setNavOpen((o) => !o);
                  } else {
                    setNavCollapsed((c) => !c);
                  }
                }}
              >
                <NavIcon name="menu" />
                <span className="nav-label">{t("nav.toggle")}</span>
              </button>
              <div className="brand">
                {displayName}
                <span>.</span>
              </div>
            </>
          ) : (
            <div className="brand">
              {displayName}
              <span>.</span>
            </div>
          )}
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
        <div
          className={`app-body${navCollapsed ? " nav-collapsed" : ""}${navOpen ? " nav-open" : ""}`}
        >
          <nav id="side-nav" className="side-nav" aria-label={t("nav.menu")}>
            <p className="nav-user">{t("app.welcome", { name: user.full_name })}</p>
            <button
              type="button"
              className={activeView === "home" ? "nav-item active" : "nav-item"}
              onClick={() => goToView("home")}
              title={t("nav.home")}
            >
              <NavIcon name="home" />
              <span className="nav-label">{t("nav.home")}</span>
            </button>
            <button
              type="button"
              className={activeView === "customers" ? "nav-item active" : "nav-item"}
              onClick={() => goToView("customers")}
              title={t("nav.customers")}
            >
              <NavIcon name="customers" />
              <span className="nav-label">{t("nav.customers")}</span>
            </button>
            {isManager ? (
              <button
                type="button"
                className={activeView === "projects" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("projects")}
                title={t("nav.projects")}
              >
                <NavIcon name="projects" />
                <span className="nav-label">{t("nav.projects")}</span>
              </button>
            ) : null}
            {isManager ? (
              <button
                type="button"
                className={activeView === "planning" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("planning")}
                title={t("nav.planning")}
              >
                <NavIcon name="planning" />
                <span className="nav-label">{t("nav.planning")}</span>
              </button>
            ) : null}
            <button
              type="button"
              className={activeView === "hours" ? "nav-item active" : "nav-item"}
              onClick={() => goToView("hours")}
              title={t("nav.hours")}
            >
              <NavIcon name="hours" />
              <span className="nav-label">{t("nav.hours")}</span>
            </button>
            {isManager ? (
              <button
                type="button"
                className={activeView === "admin" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("admin")}
                title={t("nav.admin")}
              >
                <NavIcon name="admin" />
                <span className="nav-label">{t("nav.admin")}</span>
              </button>
            ) : null}
            {isManager ? (
              <button
                type="button"
                className={activeView === "finance" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("finance")}
                title={t("nav.finance")}
              >
                <NavIcon name="finance" />
                <span className="nav-label">{t("nav.finance")}</span>
                {openProjects.length > 0 ? (
                  <span className="nav-badge" title={t("home.openProjects", { count: openProjects.length })}>
                    {openProjects.length}
                  </span>
                ) : null}
              </button>
            ) : null}
            {isManager ? (
              <button
                type="button"
                className={activeView === "reporting" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("reporting")}
                title={t("nav.reporting")}
              >
                <NavIcon name="reporting" />
                <span className="nav-label">{t("nav.reporting")}</span>
              </button>
            ) : null}
            {isManager ? (
              <button
                type="button"
                className={activeView === "catalog" ? "nav-item active" : "nav-item"}
                onClick={() => goToView("catalog")}
                title={t("nav.catalog")}
              >
                <NavIcon name="catalog" />
                <span className="nav-label">{t("nav.catalog")}</span>
              </button>
            ) : null}
            {isManager ? (
              <button
                type="button"
                className={
                  activeView === "resources" || activeView === "unavailable" ? "nav-item active" : "nav-item"
                }
                onClick={() => goToView("resources")}
                title={t("nav.resources")}
              >
                <NavIcon name="resources" />
                <span className="nav-label">{t("nav.resources")}</span>
              </button>
            ) : null}
          </nav>

          <main className="workspace">
            {activeView === "home" ? (
              <section className="panel wide">
                <div className="week-nav">
                  <div>
                    <h1>{t("home.title")}</h1>
                    <p>{t("home.intro")}</p>
                  </div>
                </div>
                <div className="home-flow" aria-label={t("home.flowLabel")}>
                  {(
                    [
                      {
                        key: "customer",
                        icon: "flowCustomer" as const,
                        view: "customers" as AppView,
                        title: t("home.steps.customer"),
                        hint: t("home.steps.customerHint"),
                      },
                      {
                        key: "project",
                        icon: "flowProject" as const,
                        view: "projects" as AppView,
                        title: t("home.steps.project"),
                        hint: t("home.steps.projectHint"),
                        managerOnly: true,
                      },
                      {
                        key: "configure",
                        icon: "flowConfig" as const,
                        view: "projects" as AppView,
                        title: t("home.steps.configure"),
                        hint: t("home.steps.configureHint"),
                        managerOnly: true,
                      },
                      {
                        key: "hours",
                        icon: "flowHours" as const,
                        view: "hours" as AppView,
                        title: t("home.steps.hours"),
                        hint: t("home.steps.hoursHint"),
                      },
                      {
                        key: "approve",
                        icon: "flowApprove" as const,
                        view: "admin" as AppView,
                        title: t("home.steps.approve"),
                        hint: t("home.steps.approveHint"),
                        managerOnly: true,
                      },
                      {
                        key: "close",
                        icon: "flowClose" as const,
                        view: "projects" as AppView,
                        title: t("home.steps.close"),
                        hint: t("home.steps.closeHint"),
                        managerOnly: true,
                      },
                      {
                        key: "bill",
                        icon: "flowBill" as const,
                        view: "finance" as AppView,
                        title: t("home.steps.bill"),
                        hint: t("home.steps.billHint"),
                        managerOnly: true,
                        badge: openProjects.length,
                      },
                    ] as const
                  )
                    .filter((step) => !("managerOnly" in step && step.managerOnly) || isManager)
                    .map((step) => (
                      <button
                        key={step.key}
                        type="button"
                        className="flow-step"
                        onClick={() => goToView(step.view)}
                      >
                        {"badge" in step && step.badge && step.badge > 0 ? (
                          <span className="flow-badge">{step.badge}</span>
                        ) : null}
                        <NavIcon name={step.icon} />
                        <strong>{step.title}</strong>
                        <span>{step.hint}</span>
                      </button>
                    ))}
                </div>
                {isManager && openProjects.length > 0 ? (
                  <p className="status">
                    {t("home.openProjectsCue", { count: openProjects.length })}
                  </p>
                ) : null}
              </section>
            ) : null}

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

            {activeView === "reporting" && isManager ? (
              <section className="panel wide">
                <h1>{t("reporting.title")}</h1>
                <p>{t("reporting.intro")}</p>
                <label htmlFor="reportMonth">{t("reporting.period")}</label>
                <input
                  id="reportMonth"
                  type="month"
                  value={reportMonth}
                  onChange={(e) => setReportMonth(e.target.value)}
                />
                {reportSummary ? (
                  <p className="muted">
                    {t("reporting.periodLine", {
                      from: reportSummary.from_date,
                      to: reportSummary.to_date,
                    })}
                  </p>
                ) : null}
                {timeError ? <p className="status error">{timeError}</p> : null}
                {!reportSummary && !timeError ? (
                  <p className="status">{t("reporting.loading")}</p>
                ) : reportSummary ? (
                  <>
                    <div className="funnel-totals">
                      <div>
                        <strong>{t("reporting.inProgressTitle")}</strong>
                        <div className="funnel-total-value">
                          €{reportSummary.in_progress.total_eur.toFixed(0)}
                        </div>
                        <div className="muted">
                          {t("reporting.inProgressDetail", {
                            fixed: reportSummary.in_progress.fixed_remaining_eur.toFixed(0),
                            tm: reportSummary.in_progress.tm_wip_eur.toFixed(0),
                            count: reportSummary.in_progress.project_count,
                          })}
                        </div>
                      </div>
                      <div>
                        <strong>{t("reporting.utilizationTitle")}</strong>
                        <div className="funnel-total-value">
                          {reportSummary.utilization.utilization_pct.toFixed(1)}%
                        </div>
                        <div className="muted">
                          {t("reporting.utilizationDetail", {
                            billable: reportSummary.utilization.billable_hours,
                            capacity: reportSummary.utilization.capacity_hours,
                            resources: reportSummary.utilization.resource_count,
                            days: reportSummary.utilization.working_days,
                          })}
                        </div>
                      </div>
                      <div>
                        <strong>{t("reporting.deliveredTitle")}</strong>
                        <div className="funnel-total-value">
                          €{reportSummary.delivered_eur.toFixed(0)}
                        </div>
                        <div className="muted">{t("reporting.deliveredHint")}</div>
                      </div>
                      <div>
                        <strong>{t("reporting.receivedTitle")}</strong>
                        <div className="funnel-total-value">
                          €{reportSummary.received_eur.toFixed(0)}
                        </div>
                        <div className="muted">{t("reporting.receivedHint")}</div>
                      </div>
                    </div>

                    <h2>{t("reporting.funnelTitle")}</h2>
                    <p className="status">{t("reporting.funnelIntro")}</p>
                    <ul className="entry-list">
                      {reportSummary.funnel
                        .filter((s) => s.count > 0)
                        .map((s) => (
                          <li key={s.funnel_status}>
                            <div>
                              <strong>{t(`project.funnel.${s.funnel_status}`)}</strong>
                              <div className="muted">
                                {t("reporting.funnelLine", {
                                  count: s.count,
                                  eur: s.value_eur.toFixed(0),
                                  hours: s.remaining_hours,
                                })}
                              </div>
                            </div>
                          </li>
                        ))}
                    </ul>
                    {reportSummary.funnel.every((s) => s.count === 0) ? (
                      <p className="status">{t("reporting.funnelEmpty")}</p>
                    ) : null}
                  </>
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
                        ["funnel", "finance.panelFunnel"],
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

                {financePanel === "funnel" ? (
                  <section className="panel wide">
                    <h2>{t("finance.funnelTitle")}</h2>
                    <p className="status">{t("finance.funnelIntro")}</p>
                    {!financeFunnel ? (
                      <p className="status">{t("finance.funnelEmpty")}</p>
                    ) : (
                      <>
                        <div className="funnel-totals">
                          <div>
                            <strong>{t("finance.funnelBacklogValue")}</strong>
                            <div className="funnel-total-value">
                              €{financeFunnel.backlog_value_eur.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            <div className="muted">
                              {t("finance.funnelBacklogCount", { count: financeFunnel.backlog_count })}
                            </div>
                          </div>
                          <div>
                            <strong>{t("finance.funnelSchedulableHours")}</strong>
                            <div className="funnel-total-value">
                              {financeFunnel.backlog_remaining_hours.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                              })}
                              h
                            </div>
                            <div className="muted">
                              {t("finance.funnelContractedHours", {
                                hours: financeFunnel.backlog_contracted_hours.toLocaleString(undefined, {
                                  maximumFractionDigits: 1,
                                }),
                              })}
                            </div>
                          </div>
                        </div>

                        <h3>{t("finance.funnelStagesTitle")}</h3>
                        <ul className="entry-list">
                          {financeFunnel.stages.map((s) => (
                            <li key={s.funnel_status}>
                              <div>
                                <strong>{t(`project.funnel.${s.funnel_status}`)}</strong>
                                <div className="muted">
                                  {t("finance.funnelStageLine", {
                                    count: s.count,
                                    eur: s.value_eur.toFixed(2),
                                    hours: s.remaining_hours.toFixed(1),
                                  })}
                                </div>
                              </div>
                            </li>
                          ))}
                        </ul>

                        <h3>{t("finance.funnelMonthlyTitle")}</h3>
                        <p className="status">{t("finance.funnelMonthlyIntro")}</p>
                        {financeFunnel.monthly_sold.length === 0 ? (
                          <p className="status">{t("finance.funnelMonthlyEmpty")}</p>
                        ) : (
                          <div className="funnel-bar-chart" role="img" aria-label={t("finance.funnelMonthlyTitle")}>
                            {(() => {
                              const max = Math.max(
                                ...financeFunnel.monthly_sold.map((m) => m.value_eur),
                                1,
                              );
                              return financeFunnel.monthly_sold.map((m) => {
                                const pct = Math.max(4, (m.value_eur / max) * 100);
                                return (
                                  <div key={m.month} className="funnel-bar-col">
                                    <div className="funnel-bar-meta muted">
                                      €{m.value_eur.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </div>
                                    <div className="funnel-bar-track">
                                      <div className="funnel-bar-fill" style={{ height: `${pct}%` }} />
                                    </div>
                                    <div className="funnel-bar-label">{m.month.slice(2)}</div>
                                    <div className="funnel-bar-hours muted">
                                      {t("finance.funnelMonthHours", {
                                        hours: m.contracted_hours.toFixed(0),
                                      })}
                                    </div>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        )}

                        <h3>{t("finance.funnelProjectsTitle")}</h3>
                        {financeFunnel.projects.length === 0 ? (
                          <p className="status">{t("finance.funnelEmpty")}</p>
                        ) : (
                          <ul className="entry-list">
                            {financeFunnel.projects.map((p) => (
                              <li key={p.id}>
                                <div>
                                  <strong>
                                    {p.customer_name} · {p.name}
                                  </strong>
                                  <div className="muted">
                                    {t(`project.funnel.${normalizeDialStage(p.funnel_status)}`)} · €
                                    {p.fixed_price_eur.toFixed(2)} ·{" "}
                                    {t("finance.funnelProjectHours", {
                                      remaining: p.remaining_hours.toFixed(1),
                                      contracted: p.contracted_hours.toFixed(1),
                                    })}
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </section>
                ) : null}

                {financePanel === "operational" ? (
                  <section className="panel wide">
                    <h2>{t("finance.operationalTitle")}</h2>
                    <p className="status">{t("finance.operationalIntro")}</p>
                    {openProjects.length === 0 ? (
                      <p className="status">{t("finance.operationalEmpty")}</p>
                    ) : (
                      <ul className="entry-list">
                        {openProjects.map((p) => {
                          const dial = normalizeDialStage(p.funnel_status);
                          const dialIdx = PROJECT_DIAL_STAGES.indexOf(dial);
                          const dialPct =
                            PROJECT_DIAL_STAGES.length > 1
                              ? (Math.max(0, dialIdx) / (PROJECT_DIAL_STAGES.length - 1)) * 100
                              : 0;
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
                                  {t(`project.funnel.${dial}`)} ·{" "}
                                  {t("finance.projectedHours", { hours: p.remaining_hours })}
                                </div>
                                <div className="bar-track" aria-hidden title={t(`project.funnel.${dial}`)}>
                                  <div className="bar-fill" style={{ width: `${dialPct}%` }} />
                                </div>
                                <div className="bar-track" aria-hidden>
                                  <div
                                    className={`bar-fill ${withinBudget ? "bar-ok" : "bar-warn"}`}
                                    style={{ width: `${Math.min(100, Math.max(0, budgetUsed))}%` }}
                                  />
                                </div>
                                <div className="muted">
                                  {t("finance.budgetBar", {
                                    pct: Math.round(dialPct),
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
                      <label htmlFor="billingMonth">{t("finance.billingMonth")}</label>
                      <input
                        id="billingMonth"
                        type="month"
                        value={billingMonth}
                        onChange={(e) => setBillingMonth(e.target.value)}
                      />
                      <p className="muted">{t("finance.billingMonthHint")}</p>
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
                                  €{c.fixed_price_eur} · {t(`project.funnel.${normalizeDialStage(c.progress)}`)}
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
                                  {inv.period_label
                                    ? ` · ${t("finance.invoicePeriod", { period: inv.period_label })}`
                                    : ""}
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

                    <h3>{t("finance.personnelProposalsTitle")}</h3>
                    <p className="status">{t("finance.personnelProposalsIntro")}</p>
                    {personnelCandidates.length === 0 ? (
                      <p className="status">{t("finance.personnelProposalsEmpty")}</p>
                    ) : (
                      <ul className="entry-list">
                        {personnelCandidates.map((row) => (
                          <li key={row.partner_id}>
                            <div>
                              <strong>{row.display_name}</strong>
                              <div className="muted">
                                {t("finance.personnelProposalLine", {
                                  hours: row.hours,
                                  rate: row.rate_eur.toFixed(2),
                                  amount: row.subtotal_eur.toFixed(2),
                                  vat: row.vat_eur.toFixed(2),
                                  total: row.total_eur.toFixed(2),
                                })}
                              </div>
                              {row.already_generated && row.invoice_number ? (
                                <div className="muted">
                                  {t("finance.personnelProposalRef", { number: row.invoice_number })}
                                </div>
                              ) : null}
                            </div>
                            <div className="entry-actions">
                              {row.already_generated && row.invoice_id ? (
                                <button
                                  type="button"
                                  onClick={() => void downloadInvoicePdf(row.invoice_id!)}
                                >
                                  {t("finance.viewPdf")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className="primary"
                                  disabled={generatingProposalFor === row.partner_id}
                                  onClick={() => void generatePersonnelProposal(row.partner_id)}
                                >
                                  {generatingProposalFor === row.partner_id
                                    ? t("finance.generatingProposal")
                                    : t("finance.generatePersonnelProposal")}
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <h3>{t("finance.personnelProposalsListTitle")}</h3>
                    {personnelProposals.length === 0 ? (
                      <p className="status">{t("finance.personnelProposalsListEmpty")}</p>
                    ) : (
                      <ul className="entry-list">
                        {personnelProposals.map((inv) => (
                          <li key={inv.id}>
                            <div>
                              <strong>{inv.invoice_number}</strong>
                              <div className="muted">
                                {inv.seller_name} · €{inv.amount_eur.toFixed(2)} · {inv.status}
                              </div>
                            </div>
                            <div className="entry-actions">
                              {inv.pdf_path ? (
                                <button type="button" onClick={() => void downloadInvoicePdf(inv.id)}>
                                  {t("finance.viewPdf")}
                                </button>
                              ) : (
                                <span className="muted">{t("finance.pdfMissing")}</span>
                              )}
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
                                title={
                                  row.undo_blocked_reason === "project_closed"
                                    ? t("finance.compensationProjectClosed")
                                    : row.undo_blocked_reason === "already_invoiced"
                                      ? t("finance.compensationInvoiced")
                                      : undefined
                                }
                                onClick={() => void undoCompensation(row.time_entry_id)}
                              >
                                {t("finance.compensationUndo")}
                              </button>
                              {!row.can_undo ? (
                                <div className="muted">
                                  {row.undo_blocked_reason === "project_closed"
                                    ? t("finance.compensationProjectClosed")
                                    : t("finance.compensationInvoiced")}
                                </div>
                              ) : null}
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
                    <div className="finance-hub-actions" role="tablist" aria-label={t("finance.kpiHorizons")}>
                      {(
                        [
                          ["monthly", "finance.kpiMonthly"],
                          ["quarterly", "finance.kpiQuarterly"],
                          ["annually", "finance.kpiAnnually"],
                        ] as const
                      ).map(([id, labelKey]) => (
                        <button
                          key={id}
                          type="button"
                          role="tab"
                          aria-selected={kpiHorizon === id}
                          className={kpiHorizon === id ? "primary" : ""}
                          onClick={() => setKpiHorizon(id)}
                        >
                          {t(labelKey)}
                        </button>
                      ))}
                    </div>
                    <label htmlFor="kpiAnchorMonth">{t("finance.kpiAnchor")}</label>
                    <input
                      id="kpiAnchorMonth"
                      type="month"
                      value={kpiAnchorMonth}
                      onChange={(e) => setKpiAnchorMonth(e.target.value)}
                    />
                    <p className="status">
                      {t("finance.kpiPeriodLine", {
                        period: kpiPeriod,
                        months: kpiMonths.length,
                      })}
                    </p>
                    <p className="muted">{t("finance.kpiRecurringHint")}</p>

                    <h3>{t("finance.profitByProject")}</h3>
                    {managedProjects.length === 0 ? (
                      <p className="status">{t("finance.kpiEmpty")}</p>
                    ) : (
                      <ul className="entry-list">
                        {managedProjects.map((p) => {
                          const { spent, sales, status, pct, hoursBooked } = projectProfitStatus(p);
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
                                    hours: hoursBooked,
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
                    {kpiHorizon !== "monthly" &&
                    billedByQuarter.filter(([label]) =>
                      kpiHorizon === "quarterly"
                        ? label === kpiPeriod
                        : label.startsWith(`${kpiPeriod}-`),
                    ).length > 0 ? (
                      <ul className="entry-list">
                        {billedByQuarter
                          .filter(([label]) =>
                            kpiHorizon === "quarterly"
                              ? label === kpiPeriod
                              : label.startsWith(`${kpiPeriod}-`),
                          )
                          .map(([label, amount]) => (
                            <li key={label}>
                              <div>
                                <strong>{label}</strong>
                                <div className="muted">€{amount.toFixed(2)}</div>
                              </div>
                            </li>
                          ))}
                      </ul>
                    ) : null}
                    <p className="status">
                      {t("finance.billedPeriod", {
                        period: kpiPeriod,
                        eur: billedPeriod.toFixed(2),
                      })}
                    </p>
                    <p className="status">
                      {t("finance.receivedPeriod", {
                        period: kpiPeriod,
                        eur: receivedPeriod.toFixed(2),
                      })}
                    </p>
                    <h3>{t("finance.costOverviewTitle")}</h3>
                    <p className="status">{t("finance.costOverviewIntroPeriod")}</p>
                    <p className="status">
                      {t("finance.approvedHoursLine", { hours: approvedBillableHours })}
                    </p>
                    <p className="status">
                      {t("finance.personnelExpectedCost", { eur: personnelExpectedCost.toFixed(2) })}
                    </p>
                    <p className="muted">{t("finance.personnelExpectedHint")}</p>
                    <p className="status">
                      {t("finance.personnelActualCost", { eur: personnelActualCost.toFixed(2) })}
                    </p>
                    <p className="muted">
                      {t("finance.personnelActualHint", {
                        chargeback: personnelNonBillableCost.toFixed(2),
                      })}
                    </p>
                    <p className="status">
                      {t("finance.personnelVatLine", {
                        eur: personnelInputVat.toFixed(2),
                        rate: Math.round(DEFAULT_VAT_RATE * 100),
                      })}
                    </p>
                    <p className="muted">{t("finance.personnelVatHint")}</p>
                    <p className="status">
                      {t("finance.nonPersonnelCostTotal", { eur: nonPersonnelCostTotal.toFixed(2) })}
                    </p>
                    <p className="muted">
                      {t("finance.nonPersonnelPeriodHint", {
                        months: kpiMonths.length,
                        period: kpiPeriod,
                      })}
                    </p>
                    <p className="status">
                      {t("finance.grossProfit", { eur: grossProfit.toFixed(2) })}
                    </p>
                    <p className="muted">
                      {t("finance.grossProfitDetail", {
                        revenue: revenueNetPaid.toFixed(2),
                        personnel: personnelCostTotal.toFixed(2),
                        nonPersonnel: nonPersonnelCostTotal.toFixed(2),
                      })}
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
                    <p className="status">
                      {t("finance.vatNetAfterInput", {
                        eur: vatNetThisQuarter.toFixed(2),
                        input: vatInputThisQuarter.toFixed(2),
                      })}
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
                        <p className="status">{t("finance.vatIntro")}</p>
                        <p className="muted">{t("finance.vatInputIntro")}</p>
                        <p className="status">
                          {t("finance.vatBalance", {
                            balance: Math.max(
                              0,
                              vatAccount.balance_eur -
                                [...personnelInputVatByQuarter.values()].reduce((a, b) => a + b, 0),
                            ).toFixed(2),
                            quarter: vatAccount.current_quarter,
                          })}
                        </p>
                        <ul className="entry-list">
                          {vatAccount.quarters
                            .filter(
                              (q) =>
                                q.collected_eur > 0 ||
                                q.remitted_eur > 0 ||
                                (personnelInputVatByQuarter.get(q.label) || 0) > 0,
                            )
                            .map((q) => {
                              const inputVat = personnelInputVatByQuarter.get(q.label) || 0;
                              const netDue = Math.max(0, q.outstanding_eur - inputVat);
                              return (
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
                                  <div className="muted">
                                    {t("finance.vatQuarterInputLine", {
                                      input: inputVat.toFixed(2),
                                      net: netDue.toFixed(2),
                                    })}
                                  </div>
                                </div>
                                <div className="entry-actions">
                                  {netDue > 0.009 ? (
                                    <button
                                      type="button"
                                      onClick={() => void remitVat(q.year, q.quarter, netDue)}
                                    >
                                      {t("finance.vatRemit")}
                                    </button>
                                  ) : null}
                                </div>
                              </li>
                              );
                            })}
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

            {activeView === "planning" && isManager ? (
              <section className="panel wide">
                <div className="week-nav">
                  <div>
                    <h1>{t("planning.title")}</h1>
                    <p>{t("planning.intro")}</p>
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => openUnavailablePage()}>
                      {t("agenda.planBlock")}
                    </button>
                    <button type="button" className="primary" onClick={() => goToView("projects")}>
                      {t("agenda.planKickoff")}
                    </button>
                  </div>
                </div>
                <p className="status">{t("planning.autoResolveHint")}</p>
                {timeError ? <p className="status error">{timeError}</p> : null}
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
                <label htmlFor="planningResourceFilter">{t("agenda.filterResource")}</label>
                <select
                  id="planningResourceFilter"
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
                                  appointmentOverlapsDay(a.starts_at, a.ends_at, date),
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
                                            {new Date(item.starts_at).toLocaleDateString([], {
                                              month: "short",
                                              day: "numeric",
                                            })}
                                            {"–"}
                                            {new Date(item.ends_at).toLocaleDateString([], {
                                              month: "short",
                                              day: "numeric",
                                            })}
                                          </div>
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
                                          {item.customer_name ? (
                                            <div className="muted">{item.customer_name}</div>
                                          ) : null}
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
              </section>
            ) : null}

            {activeView === "unavailable" && isManager ? (
              <section className="panel wide">
                <div className="week-nav">
                  <div>
                    <h1>{t("agenda.planBlockTitle")}</h1>
                    <p>{t("agenda.planBlockIntro")}</p>
                  </div>
                  <div className="actions">
                    <button type="button" onClick={() => goToView("resources")}>
                      {t("agenda.backToResources")}
                    </button>
                  </div>
                </div>
                {adminStatus ? <p className="status">{adminStatus}</p> : null}
                {timeError ? <p className="status error">{timeError}</p> : null}
                <div className="customer-form">
                  <label htmlFor="calStartsDate">{t("agenda.startsAt")}</label>
                  <input
                    id="calStartsDate"
                    type="date"
                    value={splitDateTimeLocal(calendarForm.starts_at).date}
                    onChange={(e) => {
                      const { time } = splitDateTimeLocal(calendarForm.starts_at);
                      setCalendarForm((p) => ({
                        ...p,
                        starts_at: joinDateTimeLocal(e.target.value, time),
                      }));
                    }}
                  />
                  <label htmlFor="calStartsTime">{t("agenda.startsTime")}</label>
                  <input
                    id="calStartsTime"
                    type="time"
                    value={splitDateTimeLocal(calendarForm.starts_at).time}
                    onChange={(e) => {
                      const { date } = splitDateTimeLocal(calendarForm.starts_at);
                      setCalendarForm((p) => ({
                        ...p,
                        starts_at: joinDateTimeLocal(date, e.target.value),
                      }));
                    }}
                  />
                  <label htmlFor="calEndsDate">{t("agenda.endsAt")}</label>
                  <input
                    id="calEndsDate"
                    type="date"
                    value={splitDateTimeLocal(calendarForm.ends_at).date}
                    onChange={(e) => {
                      const { time } = splitDateTimeLocal(calendarForm.ends_at);
                      setCalendarForm((p) => ({
                        ...p,
                        ends_at: joinDateTimeLocal(e.target.value, time),
                      }));
                    }}
                  />
                  <label htmlFor="calEndsTime">{t("agenda.endsTime")}</label>
                  <input
                    id="calEndsTime"
                    type="time"
                    value={splitDateTimeLocal(calendarForm.ends_at).time}
                    onChange={(e) => {
                      const { date } = splitDateTimeLocal(calendarForm.ends_at);
                      setCalendarForm((p) => ({
                        ...p,
                        ends_at: joinDateTimeLocal(date, e.target.value),
                      }));
                    }}
                  />
                  <p className="field-hint">{t("agenda.rangeHint")}</p>
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
                    <button type="button" onClick={() => goToView("resources")}>
                      {t("customer.cancel")}
                    </button>
                  </div>
                </div>
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
                    <button type="button" onClick={() => openUnavailablePage()}>
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
                                  appointmentOverlapsDay(a.starts_at, a.ends_at, date),
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
                                            {new Date(item.starts_at).toLocaleDateString([], {
                                              month: "short",
                                              day: "numeric",
                                            })}
                                            {"–"}
                                            {new Date(item.ends_at).toLocaleDateString([], {
                                              month: "short",
                                              day: "numeric",
                                            })}
                                          </div>
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

                {creatingResource || editingResourceId ? (
                  <div className="customer-form">
                    <h2>{editingResourceId ? t("resources.editTitle") : t("resources.createTitle")}</h2>
                    <label htmlFor="resName">{t("resources.name")}</label>
                    <input
                      id="resName"
                      value={resourceForm.display_name}
                      onChange={(e) => setResourceForm((p) => ({ ...p, display_name: e.target.value }))}
                    />
                    <label htmlFor="resPartnerId">{t("resources.linkedUserId")}</label>
                    <input
                      id="resPartnerId"
                      value={resourceForm.partner_id}
                      onChange={(e) => setResourceForm((p) => ({ ...p, partner_id: e.target.value }))}
                      placeholder={user?.id || ""}
                    />
                    <p className="field-hint">
                      {t("resources.linkedUserHint", { id: user?.id || "—" })}
                    </p>
                    {user?.id && resourceForm.partner_id.trim() !== user.id ? (
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => setResourceForm((p) => ({ ...p, partner_id: user.id }))}
                      >
                        {t("resources.linkToMe")}
                      </button>
                    ) : null}
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
                    <p className="field-hint">{t("resources.rateVatHint")}</p>
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
                    {resourceForm.kind === "external" ? (
                      <>
                        <h3>{t("resources.billingTitle")}</h3>
                        <p className="field-hint">{t("resources.billingHint")}</p>
                        <label htmlFor="resCompany">{t("resources.companyName")}</label>
                        <input
                          id="resCompany"
                          value={resourceForm.company_name}
                          onChange={(e) => setResourceForm((p) => ({ ...p, company_name: e.target.value }))}
                        />
                        <label htmlFor="resAddr1">{t("resources.addressLine1")}</label>
                        <input
                          id="resAddr1"
                          value={resourceForm.address_line1}
                          onChange={(e) => setResourceForm((p) => ({ ...p, address_line1: e.target.value }))}
                        />
                        <label htmlFor="resAddr2">{t("resources.addressLine2")}</label>
                        <input
                          id="resAddr2"
                          value={resourceForm.address_line2}
                          onChange={(e) => setResourceForm((p) => ({ ...p, address_line2: e.target.value }))}
                        />
                        <div className="form-row">
                          <div>
                            <label htmlFor="resPostal">{t("resources.postalCode")}</label>
                            <input
                              id="resPostal"
                              value={resourceForm.postal_code}
                              onChange={(e) =>
                                setResourceForm((p) => ({ ...p, postal_code: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <label htmlFor="resCity">{t("resources.city")}</label>
                            <input
                              id="resCity"
                              value={resourceForm.city}
                              onChange={(e) => setResourceForm((p) => ({ ...p, city: e.target.value }))}
                            />
                          </div>
                        </div>
                        <label htmlFor="resCountry">{t("resources.country")}</label>
                        <input
                          id="resCountry"
                          value={resourceForm.country}
                          onChange={(e) => setResourceForm((p) => ({ ...p, country: e.target.value }))}
                        />
                        <label htmlFor="resVat">{t("resources.vatId")}</label>
                        <input
                          id="resVat"
                          value={resourceForm.vat_id}
                          onChange={(e) => setResourceForm((p) => ({ ...p, vat_id: e.target.value }))}
                        />
                        <label htmlFor="resIban">{t("resources.bankAccount")}</label>
                        <input
                          id="resIban"
                          value={resourceForm.bank_account}
                          onChange={(e) => setResourceForm((p) => ({ ...p, bank_account: e.target.value }))}
                        />
                        <label htmlFor="resEmail">{t("resources.invoiceEmail")}</label>
                        <input
                          id="resEmail"
                          type="email"
                          value={resourceForm.invoice_email}
                          onChange={(e) =>
                            setResourceForm((p) => ({ ...p, invoice_email: e.target.value }))
                          }
                        />
                      </>
                    ) : null}
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
                              {r.company_name ? `${r.company_name} · ` : ""}
                              {t(`resources.kind.${r.kind}`)} · {t("resources.billableRate")} €
                              {r.billable_rate_eur}
                              {r.is_senior ? ` · ${t("resources.seniorBadge")}` : ""}
                              {r.is_partner ? ` · ${t("resources.partnerBadge")}` : ""}
                            </div>
                            {r.kind === "external" && (r.vat_id || r.bank_account || r.address_line1) ? (
                              <div className="muted">
                                {[
                                  r.vat_id ? `${t("resources.vatId")}: ${r.vat_id}` : null,
                                  r.bank_account ? `${t("resources.bankAccount")}: ${r.bank_account}` : null,
                                  [r.address_line1, r.postal_code, r.city].filter(Boolean).join(", ") || null,
                                ]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            ) : null}
                          </div>
                          <div className="entry-actions">
                            <button type="button" onClick={() => openUnavailablePage(r.id)}>
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
                  <div className="week-nav">
                    <div>
                      <h1>{creatingProject ? t("project.createTitle") : t("project.runningTitle")}</h1>
                      <p>{creatingProject ? t("project.createIntro") : t("project.pageIntro")}</p>
                    </div>
                    <div className="actions">
                      {creatingProject ? (
                        <button type="button" onClick={() => closeProjectCreate()}>
                          {t("project.backToRunning")}
                        </button>
                      ) : (
                        <button type="button" className="primary" onClick={() => openProjectCreate()}>
                          {t("project.newProject")}
                        </button>
                      )}
                    </div>
                  </div>
                  {timeError ? <p className="status error">{timeError}</p> : null}
                  {adminStatus ? <p className="status">{adminStatus}</p> : null}
                </section>

                {creatingProject ? (
                  <section className="panel wide">
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
                      <button type="button" onClick={() => closeProjectCreate()}>
                        {t("customer.cancel")}
                      </button>
                    </div>
                  </section>
                ) : (
                <section className="panel wide">
                  <h2>{t("budget.projectsTitle")}</h2>
                  <p className="status">{t("budget.projectsIntro")}</p>
                  {openProjects.length === 0 ? (
                    <p className="status">{t("project.runningEmpty")}</p>
                  ) : (
                  <ul className="entry-list">
                    {openProjects.map((project) => {
                      const stage = normalizeDialStage(project.funnel_status);
                      const next = (project.next_funnel || []).map((s) =>
                        s === "finalizing" ? "delivered" : s,
                      );
                      const canPlanKickoff = next.includes("kickoff_planned");
                      const hoursBookable = stage === "in_delivery";
                      const canReopenDelivery = next.includes("in_delivery") && stage === "delivered";
                      return (
                      <li key={project.id}>
                        <div className="project-list-item">
                          <div>
                            <strong>
                              {project.customer_name} · {project.name}
                            </strong>
                            <div className="muted">
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
                            <div className="muted">
                              {hoursBookable
                                ? t("project.hoursBookableYes")
                                : t("project.hoursBookableNo")}
                            </div>
                            <div className="entry-actions" style={{ marginTop: "0.65rem" }}>
                              {canPlanKickoff ? (
                                <button
                                  type="button"
                                  className="primary"
                                  onClick={() => void openKickoffPicker(project)}
                                >
                                  {t("agenda.planKickoff")}
                                </button>
                              ) : null}
                              {canReopenDelivery ? (
                                <button
                                  type="button"
                                  className="primary"
                                  onClick={() => void advanceProjectFunnel(project.id, "in_delivery")}
                                >
                                  {t("project.reopenDelivery")}
                                </button>
                              ) : null}
                              {next
                                .filter(
                                  (target) =>
                                    target !== "kickoff_planned" &&
                                    !(canReopenDelivery && target === "in_delivery") &&
                                    target !== "invoiced" &&
                                    target !== "paid" &&
                                    target !== "closed",
                                )
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
                          </div>
                          <ProjectPhaseDial stage={stage} label={(key) => t(key)} />
                        </div>
                      </li>
                      );
                    })}
                  </ul>
                  )}

                  {kickoffPickerProjectId ? (
                    <div className="customer-form">
                      <h2>{t("agenda.pickerTitle")}</h2>
                      <p className="status">{t("agenda.pickerIntro")}</p>
                      <p className="field-hint">{t("agenda.pickerBusyHint")}</p>
                      <div className="actions week-actions">
                        <button
                          type="button"
                          disabled={kickoffWeekStart.getTime() <= kickoffMinWeek.getTime()}
                          onClick={() =>
                            setKickoffWeekStart((w) => {
                              const prev = addDays(w, -7);
                              return prev.getTime() < kickoffMinWeek.getTime() ? kickoffMinWeek : prev;
                            })
                          }
                        >
                          {t("time.prevWeek")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setKickoffWeekStart(startOfIsoWeek(new Date()))}
                        >
                          {t("time.thisWeek")}
                        </button>
                        <button
                          type="button"
                          disabled={kickoffWeekStart.getTime() >= kickoffMaxWeek.getTime()}
                          onClick={() =>
                            setKickoffWeekStart((w) => {
                              const next = addDays(w, 7);
                              return next.getTime() > kickoffMaxWeek.getTime() ? kickoffMaxWeek : next;
                            })
                          }
                        >
                          {t("time.nextWeek")}
                        </button>
                      </div>
                      <p className="week-range">
                        {formatWeekRange(kickoffWeekStart, i18n.language)} · {t("agenda.pickerHorizon")}
                      </p>
                      {kickoffLoading ? <p className="status">{t("agenda.loading")}</p> : null}
                      {!kickoffLoading ? (
                        <div className="timesheet-scroll">
                          <table className="timesheet-grid agenda-grid kickoff-agenda-grid">
                            <thead>
                              <tr>
                                <th scope="col">{t("agenda.hour")}</th>
                                {DAY_KEYS.slice(0, 5).map((day, i) => (
                                  <th key={day} scope="col">
                                    <span className="day-name">{t(`time.days.${day}`)}</span>
                                    <span className="day-date">{kickoffAgendaDates[i].slice(8)}</span>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {KICKOFF_HOUR_STARTS.map((hour) => (
                                <tr key={hour}>
                                  <th scope="row">
                                    <span className="row-label">
                                      {String(hour).padStart(2, "0")}:00
                                    </span>
                                  </th>
                                  {kickoffAgendaDates.map((date) => {
                                    const slot = kickoffFreeByCell.get(`${date}|${hour}`);
                                    const past =
                                      new Date(`${date}T${String(hour).padStart(2, "0")}:00:00`).getTime() <
                                      Date.now();
                                    return (
                                      <td key={`${date}-${hour}`}>
                                        {past ? (
                                          <span className="muted">—</span>
                                        ) : slot ? (
                                          <button
                                            type="button"
                                            className="primary kickoff-free-btn"
                                            disabled={kickoffLoading}
                                            title={slot.display_name}
                                            onClick={() => void bookKickoffSlot(slot)}
                                          >
                                            {t("agenda.slotFree")}
                                          </button>
                                        ) : (
                                          <span className="muted kickoff-busy">
                                            {t("agenda.notAvailable")}
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : null}
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

                      <label htmlFor="projectKickoff">{t("project.kickoffAt")}</label>
                      <input
                        id="projectKickoff"
                        type="datetime-local"
                        value={budgetForm.kickoff_at}
                        onChange={(e) => setBudgetForm((p) => ({ ...p, kickoff_at: e.target.value }))}
                      />
                      <p className="field-hint">{t("project.kickoffHint")}</p>

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
                )}
              </>
            ) : null}
          </main>
        </div>
      )}
    </div>
  );
}
