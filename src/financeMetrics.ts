export type FinanceMonthPoint = {
  month: string;
  label: string;
  revenue: number;
  costs: number;
  grossProfit: number;
  netProfit: number;
  funnel: number;
};

type MonthlyCostLike = {
  amount_eur: number;
  cadence: string;
  start_month: string;
  end_month: string | null;
  invoice_matched?: boolean;
  invoice_paid?: boolean;
  paid_at?: string | null;
  personnel_invoice_id?: string | null;
};

type InvoiceLike = {
  status: string;
  kind?: string;
  subtotal_eur: number;
  amount_eur?: number;
  vat_eur?: number;
  issued_at?: string | null;
  paid_at?: string | null;
};

type CompensationLike = {
  updated_at?: string | null;
  work_date?: string | null;
  classification: string;
  hours: number;
  amount_eur: number;
  partner_id: string;
  project_id?: string | null;
};

export function monthsForYear(year: number): string[] {
  if (!year) return [];
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
}

function isoInMonth(iso: string | null | undefined, month: string): boolean {
  if (!iso) return false;
  return iso.slice(0, 7) === month;
}

/** Cash-basis: invoice received, paid, and payment date recorded. */
export function costCountsTowardKpi(cost: MonthlyCostLike): boolean {
  return Boolean(cost.invoice_matched && cost.invoice_paid && cost.paid_at);
}

function customerSalesInvoice(inv: InvoiceLike): boolean {
  return inv.kind !== "personnel_proposal";
}

/** Net revenue (ex VAT) for cash-basis KPI. */
export function invoiceNetRevenue(inv: InvoiceLike): number {
  const sub = inv.subtotal_eur || 0;
  if (sub > 0) return sub;
  const gross = inv.amount_eur || 0;
  const vat = inv.vat_eur || 0;
  if (gross > 0 && vat > 0) return Math.max(0, gross - vat);
  return gross;
}

/** Month (YYYY-MM) when customer payment counts — paid_at, else issued_at for legacy paid rows. */
export function invoicePaymentMonth(inv: InvoiceLike): string | null {
  if (inv.status !== "paid") return null;
  const iso = inv.paid_at || inv.issued_at || null;
  return iso ? iso.slice(0, 7) : null;
}

function costActiveInMonth(cost: MonthlyCostLike, month: string): boolean {
  if (cost.cadence === "one_off") return true;
  if (month < cost.start_month) return false;
  if (cost.end_month && month > cost.end_month) return false;
  return true;
}

/** Customer cash received (net ex VAT) in month — payment date. */
export function cashRevenueForMonth(invoices: InvoiceLike[], month: string): number {
  return invoices
    .filter((i) => customerSalesInvoice(i) && invoicePaymentMonth(i) === month)
    .reduce((s, i) => s + invoiceNetRevenue(i), 0);
}

/** Supplier cash paid (net) in month — payment date only. */
export function cashCostsForMonth(costs: MonthlyCostLike[], month: string): number {
  let sum = 0;
  for (const c of costs) {
    if (!costCountsTowardKpi(c)) continue;
    if (!isoInMonth(c.paid_at, month)) continue;
    if (!costActiveInMonth(c, month)) continue;
    sum += c.amount_eur || 0;
  }
  return sum;
}

export function cashRevenueForMonths(invoices: InvoiceLike[], months: string[]): number {
  return months.reduce((sum, month) => sum + cashRevenueForMonth(invoices, month), 0);
}

export function cashCostsForMonths(costs: MonthlyCostLike[], months: string[]): number {
  return months.reduce((sum, month) => sum + cashCostsForMonth(costs, month), 0);
}

/** @deprecated Use cashCostsForMonth — kept for gradual migration. */
export function personnelCostForMonth<T extends CompensationLike>(params: {
  month: string;
  compensation: T[];
  monthlyCosts: MonthlyCostLike[];
  personnelCostForEntry: (entry: T) => number;
}): number {
  void params.compensation;
  void params.personnelCostForEntry;
  return cashCostsForMonth(
    params.monthlyCosts.filter((c) => c.personnel_invoice_id),
    params.month,
  );
}

export function buildFinanceMonthlySeries<T extends CompensationLike>(params: {
  year: number;
  monthLabels: string[];
  invoices: InvoiceLike[];
  compensation: T[];
  monthlyCosts: MonthlyCostLike[];
  funnelByMonth: Map<string, number>;
  corpTaxRate: number;
  personnelCostForEntry: (entry: T) => number;
}): FinanceMonthPoint[] {
  void params.compensation;
  void params.personnelCostForEntry;
  const months = monthsForYear(params.year);
  return months.map((month, idx) => {
    const revenue = cashRevenueForMonth(params.invoices, month);
    const costs = cashCostsForMonth(params.monthlyCosts, month);
    const grossProfit = revenue - costs;
    const projectedTax = Math.max(0, grossProfit * params.corpTaxRate);
    const netProfit = grossProfit - projectedTax;
    const funnel = params.funnelByMonth.get(month) ?? 0;
    return {
      month,
      label: params.monthLabels[idx] ?? month.slice(5),
      revenue,
      costs,
      grossProfit,
      netProfit,
      funnel,
    };
  });
}

export type FinanceChartPoint = FinanceMonthPoint & {
  costsYtd: number;
  grossProfitYtd: number;
  netProfitYtd: number;
};

/** Running year-to-date totals for line series on the overview chart. */
export function enrichFinanceChartSeries(
  data: FinanceMonthPoint[],
  corpTaxRate = 0.258,
): FinanceChartPoint[] {
  let revenueYtd = 0;
  let costsYtd = 0;
  return data.map((row) => {
    revenueYtd += row.revenue;
    costsYtd += row.costs;
    const grossProfitYtd = revenueYtd - costsYtd;
    const projectedTax = Math.max(0, grossProfitYtd * corpTaxRate);
    const netProfitYtd = grossProfitYtd - projectedTax;
    return {
      ...row,
      costsYtd,
      grossProfitYtd,
      netProfitYtd,
    };
  });
}

export type FinanceYtdTotals = {
  revenue: number;
  costs: number;
  grossProfit: number;
  netProfit: number;
  monthsIncluded: number;
};

/** Sum chart months through current month for the selected year (full year if past). */
export function financeYtdTotals(
  data: FinanceMonthPoint[],
  year: number,
  corpTaxRate = 0.258,
  now = new Date(),
): FinanceYtdTotals {
  const currentYear = now.getFullYear();
  const through =
    year < currentYear ? 12 : year > currentYear ? 0 : now.getMonth() + 1;
  const rows = data.slice(0, through);
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const costs = rows.reduce((s, r) => s + r.costs, 0);
  const grossProfit = revenue - costs;
  const projectedTax = Math.max(0, grossProfit * corpTaxRate);
  const netProfit = grossProfit - projectedTax;
  return { revenue, costs, grossProfit, netProfit, monthsIncluded: through };
}
