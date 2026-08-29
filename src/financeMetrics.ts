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
};

type InvoiceLike = {
  status: string;
  subtotal_eur: number;
  issued_at?: string | null;
};

type CompensationLike = {
  updated_at?: string | null;
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

function nonPersonnelForMonth(costs: MonthlyCostLike[], month: string): number {
  let sum = 0;
  for (const c of costs) {
    if (c.cadence === "one_off") {
      if (c.start_month === month) sum += c.amount_eur || 0;
      continue;
    }
    if (month >= c.start_month && (!c.end_month || month <= c.end_month)) {
      sum += c.amount_eur || 0;
    }
  }
  return sum;
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
  const months = monthsForYear(params.year);
  return months.map((month, idx) => {
    const revenueNetPaid = params.invoices
      .filter((i) => i.status === "paid" && isoInMonth(i.issued_at, month))
      .reduce((s, i) => s + i.subtotal_eur, 0);
    const personnelCost = params.compensation
      .filter((c) => isoInMonth(c.updated_at, month))
      .reduce((s, c) => s + params.personnelCostForEntry(c), 0);
    const nonPersonnelCost = nonPersonnelForMonth(params.monthlyCosts, month);
    const costs = personnelCost + nonPersonnelCost;
    const revenue = revenueNetPaid;
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
