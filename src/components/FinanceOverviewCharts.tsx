import { useEffect, useMemo, useRef, useState } from "react";
import {
  enrichFinanceChartSeries,
  type FinanceChartPoint,
  type FinanceMonthPoint,
  type FinanceYtdTotals,
} from "../financeMetrics";

export type MetricKey = "revenue" | "costs" | "grossProfit" | "netProfit" | "funnel";

export type MetricConfig = {
  key: MetricKey;
  title: string;
  color: string;
};

/** Distinct colors on the dark finance theme (max hue separation). */
export const FINANCE_LINE_COLORS: Record<MetricKey, string> = {
  revenue: "#38bdf8",
  costs: "#fb923c",
  grossProfit: "#4ade80",
  netProfit: "#facc15",
  funnel: "#f87171",
};

const BAR_METRICS = new Set<MetricKey>(["revenue", "costs", "funnel"]);
const YTD_LINE_METRICS = new Set<MetricKey>(["costs", "grossProfit", "netProfit"]);

type FinanceOverviewChartsProps = {
  year: number;
  onYearChange: (year: number) => void;
  data: FinanceMonthPoint[];
  metrics: MetricConfig[];
  yearLabel: string;
  lineChartLabel: string;
  legendHint: string;
  emptyLabel: string;
  currencyTooltip: (value: number) => string;
  ytd: FinanceYtdTotals;
  ytdTitle: string;
  ytdRevenueLabel: string;
  ytdCostsLabel: string;
  ytdGrossProfitLabel: string;
  ytdNetProfitLabel: string;
  ytdNetProfitHint: string;
  ytdSuffix: string;
  monthlySuffix: string;
  corpTaxRate: number;
};

const CHART_HEIGHT = 260;
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

function monthlyValue(row: FinanceChartPoint, key: MetricKey): number {
  return row[key];
}

function ytdLineValue(row: FinanceChartPoint, key: MetricKey): number {
  if (key === "costs") return row.costsYtd;
  if (key === "grossProfit") return row.grossProfitYtd;
  return row.netProfitYtd;
}

function legendStyle(key: MetricKey): "bar" | "bar-line" | "line" {
  if (key === "costs") return "bar-line";
  if (BAR_METRICS.has(key)) return "bar";
  return "line";
}

function LegendIcon({ metric, on }: { metric: MetricConfig; on: boolean }) {
  const style = legendStyle(metric.key);
  const opacity = on ? 1 : 0.45;
  if (style === "bar") {
    return (
      <span
        className="finance-legend-bar"
        style={{
          background: on ? metric.color : "transparent",
          borderColor: metric.color,
          opacity,
        }}
        aria-hidden
      />
    );
  }
  if (style === "bar-line") {
    return (
      <span className="finance-legend-combo" aria-hidden>
        <span
          className="finance-legend-bar"
          style={{
            background: on ? metric.color : "transparent",
            borderColor: metric.color,
            opacity,
          }}
        />
        <span
          className="finance-legend-line dashed"
          style={{
            background: on ? metric.color : "transparent",
            borderColor: metric.color,
            opacity,
          }}
        />
      </span>
    );
  }
  return (
    <span
      className="finance-legend-line"
      style={{
        background: on ? metric.color : "transparent",
        borderColor: metric.color,
        opacity,
      }}
      aria-hidden
    />
  );
}

function CombinedFinanceChart({
  data,
  metrics,
  enabled,
  onToggle,
  lineChartLabel,
  legendHint,
  formatValue,
  ytdSuffix,
  monthlySuffix,
}: {
  data: FinanceChartPoint[];
  metrics: MetricConfig[];
  enabled: Record<MetricKey, boolean>;
  onToggle: (key: MetricKey) => void;
  lineChartLabel: string;
  legendHint: string;
  formatValue: (value: number) => string;
  ytdSuffix: string;
  monthlySuffix: string;
}) {
  const [containerRef, width] = useChartWidth();
  const [hover, setHover] = useState<number | null>(null);

  const activeMetrics = metrics.filter((m) => enabled[m.key]);
  const activeBars = activeMetrics.filter((m) => BAR_METRICS.has(m.key));
  const activeLines = activeMetrics.filter((m) => YTD_LINE_METRICS.has(m.key));
  const plotW = Math.max(0, width - CHART_PAD.left - CHART_PAD.right);
  const plotH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;

  const activeValues = data.flatMap((row) => [
    ...activeBars.map((m) => monthlyValue(row, m.key)),
    ...activeLines.map((m) => ytdLineValue(row, m.key)),
  ]);
  const rawMin = activeValues.length ? Math.min(0, ...activeValues) : 0;
  const rawMax = activeValues.length ? Math.max(0, ...activeValues) : 1;
  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;
  const range = max - min || 1;

  const toX = (index: number) =>
    CHART_PAD.left + (data.length <= 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const toY = (value: number) => CHART_PAD.top + plotH - ((value - min) / range) * plotH;
  const zeroY = toY(0);
  const slotWidth = data.length > 0 ? plotW / data.length : plotW;
  const barGap = 2;
  const barWidth =
    activeBars.length > 0
      ? Math.min((slotWidth * 0.72 - barGap * (activeBars.length - 1)) / activeBars.length, 22)
      : 0;

  const lineSeries = activeLines.map((metric) => ({
    metric,
    dashed: metric.key === "costs",
    points: data.map((row, i) => ({
      x: toX(i),
      y: toY(ytdLineValue(row, metric.key)),
      value: ytdLineValue(row, metric.key),
    })),
  }));

  const tooltipRows = useMemo(() => {
    if (hover == null || !data[hover]) return [];
    const row = data[hover];
    const rows: { color: string; label: string }[] = [];
    for (const metric of activeMetrics) {
      if (BAR_METRICS.has(metric.key)) {
        rows.push({
          color: metric.color,
          label: `${metric.title} (${monthlySuffix}): ${formatValue(monthlyValue(row, metric.key))}`,
        });
      }
      if (YTD_LINE_METRICS.has(metric.key) && enabled[metric.key]) {
        rows.push({
          color: metric.color,
          label: `${metric.title} (${ytdSuffix}): ${formatValue(ytdLineValue(row, metric.key))}`,
        });
      }
    }
    return rows;
  }, [activeMetrics, data, enabled, formatValue, hover, monthlySuffix, ytdSuffix]);

  return (
    <article className="finance-chart-card finance-combined-line-card">
      <div className="finance-combined-line-layout">
        <div className="finance-combined-line-main">
          <h3>{lineChartLabel}</h3>
          <div ref={containerRef} className="finance-chart-frame finance-combined-line-frame">
            {activeMetrics.length === 0 ? (
              <p className="status finance-line-empty">{legendHint}</p>
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
                      .map((m) => {
                        const parts = BAR_METRICS.has(m.key)
                          ? `${m.title} ${monthlySuffix}: ${formatValue(monthlyValue(row, m.key))}`
                          : `${m.title} ${ytdSuffix}: ${formatValue(ytdLineValue(row, m.key))}`;
                        return `${monthLabel(row.month)} ${parts}`;
                      })
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
                    x={toX(i) - slotWidth * 0.45}
                    y={CHART_PAD.top}
                    width={slotWidth * 0.9}
                    height={plotH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
                {data.map((row, i) => {
                  const groupWidth = activeBars.length * barWidth + barGap * Math.max(0, activeBars.length - 1);
                  const groupStart = toX(i) - groupWidth / 2;
                  return activeBars.map((metric, barIndex) => {
                    const value = monthlyValue(row, metric.key);
                    const x = groupStart + barIndex * (barWidth + barGap);
                    const yValue = toY(value);
                    const yTop = Math.min(yValue, zeroY);
                    const height = Math.max(1, Math.abs(yValue - zeroY));
                    return (
                      <rect
                        key={`${row.month}-${metric.key}`}
                        x={x}
                        y={yTop}
                        width={barWidth}
                        height={height}
                        fill={metric.color}
                        opacity={hover === i ? 0.95 : 0.82}
                        rx={2}
                        pointerEvents="none"
                      />
                    );
                  });
                })}
                {lineSeries.map(({ metric, dashed, points }) => {
                  const linePath = points
                    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
                    .join(" ");
                  return (
                    <g key={`line-${metric.key}`}>
                      <path
                        d={linePath}
                        fill="none"
                        stroke={metric.color}
                        strokeWidth={metric.key === "netProfit" ? 2.25 : 2.75}
                        strokeDasharray={dashed ? "7 5" : undefined}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      {points.map((p, i) => (
                        <circle
                          key={`${metric.key}-${i}`}
                          cx={p.x}
                          cy={p.y}
                          r={hover === i ? 5 : 3.5}
                          fill={metric.color}
                          stroke="#1b2433"
                          strokeWidth={1}
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
                {hover != null && data[hover] && tooltipRows.length > 0 ? (
                  <g pointerEvents="none">
                    <rect
                      x={Math.min(toX(hover) - 88, width - 176)}
                      y={8}
                      width={176}
                      height={16 + tooltipRows.length * 14}
                      rx={4}
                      fill="#273449"
                      stroke="#3a4c63"
                    />
                    <text
                      x={Math.min(toX(hover), width - 92)}
                      y={22}
                      textAnchor="middle"
                      className="finance-chart-tooltip-text"
                    >
                      {monthLabel(data[hover].month)}
                    </text>
                    {tooltipRows.map((row, idx) => (
                      <text
                        key={`${row.label}-${idx}`}
                        x={Math.min(toX(hover) - 82, width - 170)}
                        y={36 + idx * 14}
                        className="finance-chart-tooltip-text"
                      >
                        <tspan fill={row.color}>● </tspan>
                        {row.label}
                      </text>
                    ))}
                  </g>
                ) : null}
              </svg>
            )}
          </div>
        </div>
        <div className="finance-chart-legend-panel">
          <p className="finance-legend-hint muted">{legendHint}</p>
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
                    <LegendIcon metric={metric} on={on} />
                    <span className={on ? "finance-legend-label" : "finance-legend-label muted off"}>
                      {metric.title}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </article>
  );
}

const DEFAULT_ENABLED: Record<MetricKey, boolean> = {
  revenue: true,
  costs: true,
  grossProfit: true,
  netProfit: false,
  funnel: false,
};

export function FinanceOverviewCharts({
  year,
  onYearChange,
  data,
  metrics,
  yearLabel,
  lineChartLabel,
  legendHint,
  emptyLabel,
  currencyTooltip,
  ytd,
  ytdTitle,
  ytdRevenueLabel,
  ytdCostsLabel,
  ytdGrossProfitLabel,
  ytdNetProfitLabel,
  ytdNetProfitHint,
  ytdSuffix,
  monthlySuffix,
  corpTaxRate,
}: FinanceOverviewChartsProps) {
  const [enabled, setEnabled] = useState<Record<MetricKey, boolean>>(DEFAULT_ENABLED);
  const chartData = useMemo(() => enrichFinanceChartSeries(data, corpTaxRate), [corpTaxRate, data]);

  const metricsWithColors = metrics.map((m) => ({
    ...m,
    color: FINANCE_LINE_COLORS[m.key],
  }));

  const hasData = data.some(
    (row) =>
      row.revenue !== 0 ||
      row.costs !== 0 ||
      row.grossProfit !== 0 ||
      row.netProfit !== 0 ||
      row.funnel !== 0,
  );

  const toggleMetric = (key: MetricKey) => {
    setEnabled((prev) => ({ ...prev, [key]: !prev[key] }));
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
      <CombinedFinanceChart
        data={chartData}
        metrics={metricsWithColors}
        enabled={enabled}
        onToggle={toggleMetric}
        lineChartLabel={lineChartLabel}
        legendHint={legendHint}
        formatValue={currencyTooltip}
        ytdSuffix={ytdSuffix}
        monthlySuffix={monthlySuffix}
      />
      <div className="finance-ytd-totals">
        <h3>{ytdTitle}</h3>
        <div className="funnel-totals finance-ytd-grid">
          <div>
            <strong>{ytdRevenueLabel}</strong>
            <div className="funnel-total-value">{currencyTooltip(ytd.revenue)}</div>
          </div>
          <div>
            <strong>{ytdCostsLabel}</strong>
            <div className="funnel-total-value">{currencyTooltip(ytd.costs)}</div>
          </div>
          <div>
            <strong>{ytdGrossProfitLabel}</strong>
            <div className="funnel-total-value">{currencyTooltip(ytd.grossProfit)}</div>
          </div>
          <div>
            <strong>{ytdNetProfitLabel}</strong>
            <div className="funnel-total-value">{currencyTooltip(ytd.netProfit)}</div>
            <p className="status finance-ytd-hint">{ytdNetProfitHint}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
