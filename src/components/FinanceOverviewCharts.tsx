import { useEffect, useRef, useState } from "react";
import type { FinanceMonthPoint } from "../financeMetrics";

export type MetricKey = "revenue" | "costs" | "grossProfit" | "netProfit" | "funnel";

export type MetricConfig = {
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

const CHART_HEIGHT = 220;
const CHART_PAD = { top: 14, right: 8, bottom: 30, left: 46 };

function euroAxis(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `€${(value / 1_000).toFixed(0)}k`;
  return `€${value.toFixed(0)}`;
}

function useChartWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = Math.round(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, width];
}

function yTicks(min: number, max: number, count = 4): number[] {
  if (min === max) return [min];
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + step * i);
}

function monthLabel(month: string): string {
  return String(Number(month.slice(5, 7)));
}

function CombinedFinanceLineChart({
  data,
  metrics,
  enabled,
  onToggle,
  lineChartLabel,
  formatValue,
}: {
  data: FinanceMonthPoint[];
  metrics: MetricConfig[];
  enabled: Record<MetricKey, boolean>;
  onToggle: (key: MetricKey) => void;
  lineChartLabel: string;
  formatValue: (value: number) => string;
}) {
  const [containerRef, width] = useChartWidth();
  const [hover, setHover] = useState<number | null>(null);
  const activeMetrics = metrics.filter((m) => enabled[m.key]);
  const plotW = Math.max(0, width - CHART_PAD.left - CHART_PAD.right);
  const plotH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

  const activeValues = data.flatMap((row) =>
    activeMetrics.map((m) => row[m.key]),
  );
  const rawMin = activeValues.length ? Math.min(0, ...activeValues) : 0;
  const rawMax = activeValues.length ? Math.max(0, ...activeValues) : 1;
  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;
  const range = max - min || 1;

  const toX = (index: number) =>
    CHART_PAD.left + (data.length <= 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const toY = (value: number) => CHART_PAD.top + plotH - ((value - min) / range) * plotH;
  const zeroY = toY(0);

  const series = activeMetrics.map((metric) => ({
    metric,
    points: data.map((row, i) => ({
      x: toX(i),
      y: toY(row[metric.key]),
      value: row[metric.key],
      label: monthLabel(row.month),
    })),
  }));

  return (
    <article className="finance-chart-card finance-combined-line-card">
      <h3>{lineChartLabel}</h3>
      <div className="finance-combined-line-layout">
        <div ref={containerRef} className="finance-chart-frame finance-combined-line-frame">
          {activeMetrics.length === 0 ? (
            <p className="status finance-line-empty">—</p>
          ) : (
            <svg
              className="finance-line-chart"
              width={width}
              height={CHART_HEIGHT}
              viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
              role="img"
              aria-label={data
                .map((row) =>
                  activeMetrics
                    .map((m) => `${monthLabel(row.month)} ${m.title}: ${formatValue(row[m.key])}`)
                    .join(", "),
                )
                .join("; ")}
            >
              {yTicks(min, max).map((tick) => {
                const y = toY(tick);
                return (
                  <g key={tick}>
                    <line
                      x1={CHART_PAD.left}
                      y1={y}
                      x2={width - CHART_PAD.right}
                      y2={y}
                      stroke="rgba(58, 76, 99, 0.55)"
                      strokeDasharray="3 3"
                    />
                    <text x={CHART_PAD.left - 6} y={y + 4} textAnchor="end" className="finance-chart-axis">
                      {euroAxis(tick)}
                    </text>
                  </g>
                );
              })}
              <line
                x1={CHART_PAD.left}
                y1={zeroY}
                x2={width - CHART_PAD.right}
                y2={zeroY}
                stroke="#3a4c63"
              />
              {data.map((row, i) => (
                <rect
                  key={row.month}
                  x={toX(i) - (plotW / data.length) * 0.35}
                  y={CHART_PAD.top}
                  width={(plotW / data.length) * 0.7}
                  height={plotH}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              ))}
              {series.map(({ metric, points }) => {
                const linePath = points
                  .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                  .join(" ");
                return (
                  <g key={metric.key}>
                    <path
                      d={linePath}
                      fill="none"
                      stroke={metric.color}
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {points.map((p, i) => (
                      <circle
                        key={`${metric.key}-${i}`}
                        cx={p.x}
                        cy={p.y}
                        r={hover === i ? 4.5 : 3}
                        fill={metric.color}
                        pointerEvents="none"
                      />
                    ))}
                  </g>
                );
              })}
              {data.map((row, i) => (
                <text
                  key={`${row.month}-label`}
                  x={toX(i)}
                  y={CHART_HEIGHT - 8}
                  textAnchor="middle"
                  className="finance-chart-axis"
                >
                  {monthLabel(row.month)}
                </text>
              ))}
              {hover != null && data[hover] ? (
                <g pointerEvents="none">
                  <rect
                    x={Math.min(toX(hover) - 72, width - 148)}
                    y={8}
                    width={144}
                    height={16 + activeMetrics.length * 14}
                    rx={4}
                    fill="#273449"
                    stroke="#3a4c63"
                  />
                  <text
                    x={Math.min(toX(hover), width - 80)}
                    y={22}
                    textAnchor="middle"
                    className="finance-chart-tooltip-text"
                  >
                    {monthLabel(data[hover].month)}
                  </text>
                  {activeMetrics.map((m, idx) => (
                    <text
                      key={m.key}
                      x={Math.min(toX(hover) - 66, width - 142)}
                      y={36 + idx * 14}
                      className="finance-chart-tooltip-text"
                    >
                      <tspan fill={m.color}>● </tspan>
                      {m.title}: {formatValue(data[hover][m.key])}
                    </text>
                  ))}
                </g>
              ) : null}
            </svg>
          )}
        </div>
        <ul className="finance-chart-legend" aria-label={lineChartLabel}>
          {metrics.map((metric) => {
            const on = enabled[metric.key];
            return (
              <li key={metric.key}>
                <button
                  type="button"
                  className={on ? "finance-legend-item active" : "finance-legend-item"}
                  aria-pressed={on}
                  onClick={() => onToggle(metric.key)}
                >
                  <span className="finance-legend-swatch" style={{ background: metric.color, opacity: on ? 1 : 0.35 }} />
                  <span className={on ? "" : "muted"}>{metric.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </article>
  );
}

function FinanceBarChart({
  data,
  color,
}: {
  data: { label: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <div
      className="funnel-bar-chart finance-metric-bar-chart"
      role="img"
      aria-label={data.map((d) => `${d.label}: ${euroAxis(d.value)}`).join(", ")}
    >
      {data.map((row) => {
        const magnitude = Math.abs(row.value);
        const pct = Math.max(magnitude === 0 ? 0 : 4, (magnitude / max) * 100);
        return (
          <div key={row.label} className="funnel-bar-col">
            <div className="funnel-bar-meta muted">{euroAxis(row.value)}</div>
            <div className="funnel-bar-track">
              <div
                className="funnel-bar-fill"
                style={{
                  height: `${pct}%`,
                  background: row.value < 0 ? "#e07070" : color,
                }}
              />
            </div>
            <div className="funnel-bar-label">{row.label}</div>
          </div>
        );
      })}
    </div>
  );
}

function MetricBarChart({
  metric,
  data,
  barChartLabel,
}: {
  metric: MetricConfig;
  data: FinanceMonthPoint[];
  barChartLabel: string;
}) {
  const chartData = data.map((row) => ({
    label: monthLabel(row.month),
    value: row[metric.key],
  }));

  return (
    <article className="finance-chart-card">
      <h3>{metric.title}</h3>
      <div className="finance-chart-block">
        <h4>{barChartLabel}</h4>
        <FinanceBarChart data={chartData} color={metric.color} />
      </div>
    </article>
  );
}

const DEFAULT_ENABLED: Record<MetricKey, boolean> = {
  revenue: true,
  costs: true,
  grossProfit: true,
  netProfit: true,
  funnel: true,
};

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
  const [enabled, setEnabled] = useState<Record<MetricKey, boolean>>(DEFAULT_ENABLED);
  const hasData = data.some(
    (row) =>
      row.revenue !== 0 ||
      row.costs !== 0 ||
      row.grossProfit !== 0 ||
      row.netProfit !== 0 ||
      row.funnel !== 0,
  );

  const toggleMetric = (key: MetricKey) => {
    setEnabled((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (!Object.values(next).some(Boolean)) return prev;
      return next;
    });
  };

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
        <CombinedFinanceLineChart
          data={data}
          metrics={metrics}
          enabled={enabled}
          onToggle={toggleMetric}
          lineChartLabel={lineChartLabel}
          formatValue={currencyTooltip}
        />
        {metrics.map((metric) => (
          <MetricBarChart
            key={metric.key}
            metric={metric}
            data={data}
            barChartLabel={barChartLabel}
          />
        ))}
      </div>
    </section>
  );
}
