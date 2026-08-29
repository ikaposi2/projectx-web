import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FinanceMonthPoint } from "../financeMetrics";

/** Recharts sets SVG presentation attributes; CSS custom properties do not resolve there. */
const CHART_COLORS = {
  muted: "#9aabbf",
  border: "#3a4c63",
  grid: "rgba(58, 76, 99, 0.55)",
} as const;

type MetricKey = "costs" | "grossProfit" | "netProfit" | "funnel";

type MetricConfig = {
  key: MetricKey;
  title: string;
  color: string;
};

type FinanceOverviewChartsProps = {
  year: number;
  onYearChange: (year: number) => void;
  data: FinanceMonthPoint[];
  metrics: MetricConfig[];
  yearLabel: string;
  lineChartLabel: string;
  barChartLabel: string;
  emptyLabel: string;
  currencyTooltip: (value: number) => string;
};

function euroAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}k`;
  return `€${value.toFixed(0)}`;
}

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: readonly { value?: unknown }[];
  label?: unknown;
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const raw = payload[0]?.value;
  const value = typeof raw === "number" ? raw : Number(raw);
  return (
    <div className="finance-chart-tooltip">
      <strong>{String(label ?? "")}</strong>
      <div>{formatValue(Number.isFinite(value) ? value : 0)}</div>
    </div>
  );
}

function MetricCharts({
  metric,
  data,
  lineChartLabel,
  barChartLabel,
  formatValue,
}: {
  metric: MetricConfig;
  data: FinanceMonthPoint[];
  lineChartLabel: string;
  barChartLabel: string;
  formatValue: (value: number) => string;
}) {
  const chartData = data.map((row) => ({
    label: row.label,
    value: row[metric.key],
  }));

  return (
    <article className="finance-chart-card">
      <h3>{metric.title}</h3>
      <div className="finance-chart-block">
        <h4>{lineChartLabel}</h4>
        <ResponsiveContainer width="100%" height={180} minWidth={0}>
          <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_COLORS.muted, fontSize: 11 }}
              axisLine={{ stroke: CHART_COLORS.border }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={euroAxis}
              tick={{ fill: CHART_COLORS.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={({ active, payload, label }) => (
                <ChartTooltip
                  active={active}
                  payload={payload as readonly { value?: unknown }[] | undefined}
                  label={label}
                  formatValue={formatValue}
                />
              )}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={metric.color}
              strokeWidth={2}
              dot={{ r: 3, fill: metric.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="finance-chart-block">
        <h4>{barChartLabel}</h4>
        <ResponsiveContainer width="100%" height={180} minWidth={0}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={CHART_COLORS.grid} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: CHART_COLORS.muted, fontSize: 11 }}
              axisLine={{ stroke: CHART_COLORS.border }}
              tickLine={false}
            />
            <YAxis
              tickFormatter={euroAxis}
              tick={{ fill: CHART_COLORS.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip
              content={({ active, payload, label }) => (
                <ChartTooltip
                  active={active}
                  payload={payload as readonly { value?: unknown }[] | undefined}
                  label={label}
                  formatValue={formatValue}
                />
              )}
            />
            <Bar dataKey="value" fill={metric.color} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export function FinanceOverviewCharts({
  year,
  onYearChange,
  data,
  metrics,
  yearLabel,
  lineChartLabel,
  barChartLabel,
  emptyLabel,
  currencyTooltip,
}: FinanceOverviewChartsProps) {
  const hasData = data.some(
    (row) => row.costs !== 0 || row.grossProfit !== 0 || row.netProfit !== 0 || row.funnel !== 0,
  );

  return (
    <section className="finance-overview-charts">
      <div className="finance-overview-header">
        <h2>{yearLabel}</h2>
        <label htmlFor="financeChartYear">
          <input
            id="financeChartYear"
            type="number"
            min={2000}
            max={2100}
            value={year}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (next >= 2000 && next <= 2100) onYearChange(next);
            }}
          />
        </label>
      </div>
      {!hasData ? <p className="status">{emptyLabel}</p> : null}
      <div className="finance-charts-grid">
        {metrics.map((metric) => (
          <MetricCharts
            key={metric.key}
            metric={metric}
            data={data}
            lineChartLabel={lineChartLabel}
            barChartLabel={barChartLabel}
            formatValue={currencyTooltip}
          />
        ))}
      </div>
    </section>
  );
}
