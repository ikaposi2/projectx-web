import { useEffect, useId, useRef, useState } from "react";
import type { FinanceMonthPoint } from "../financeMetrics";

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

type ChartPoint = {
  label: string;
  value: number;
};

const CHART_HEIGHT = 180;
const CHART_PAD = { top: 14, right: 10, bottom: 28, left: 52 };

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

function FinanceLineChart({
  data,
  color,
  formatValue,
}: {
  data: ChartPoint[];
  color: string;
  formatValue: (value: number) => string;
}) {
  const [containerRef, width] = useChartWidth();
  const gradientId = useId();
  const plotW = Math.max(0, width - CHART_PAD.left - CHART_PAD.right);
  const plotH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
  const values = data.map((d) => d.value);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const min = rawMin === rawMax ? rawMin - 1 : rawMin;
  const max = rawMin === rawMax ? rawMax + 1 : rawMax;
  const range = max - min || 1;
  const toX = (index: number) =>
    CHART_PAD.left + (data.length <= 1 ? plotW / 2 : (index / (data.length - 1)) * plotW);
  const toY = (value: number) => CHART_PAD.top + plotH - ((value - min) / range) * plotH;
  const zeroY = toY(0);
  const points = data.map((row, i) => ({ x: toX(i), y: toY(row.value), row }));
  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const [hover, setHover] = useState<number | null>(null);

  return (
    <div ref={containerRef} className="finance-chart-frame">
      <svg
        className="finance-line-chart"
        width={width}
        height={CHART_HEIGHT}
        viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
        role="img"
        aria-label={data.map((d) => `${d.label}: ${formatValue(d.value)}`).join(", ")}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
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
        {points.length > 1 ? (
          <path
            d={`${linePath} L ${points[points.length - 1].x.toFixed(1)} ${zeroY.toFixed(1)} L ${points[0].x.toFixed(1)} ${zeroY.toFixed(1)} Z`}
            fill={`url(#${gradientId})`}
          />
        ) : null}
        <path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.row.label}>
            <circle
              cx={p.x}
              cy={p.y}
              r={hover === i ? 5 : 3.5}
              fill={color}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
            <text x={p.x} y={CHART_HEIGHT - 8} textAnchor="middle" className="finance-chart-axis">
              {p.row.label}
            </text>
          </g>
        ))}
        {hover != null && points[hover] ? (
          <g pointerEvents="none">
            <rect
              x={Math.min(points[hover].x - 54, width - 118)}
              y={Math.max(points[hover].y - 34, 4)}
              width={108}
              height={26}
              rx={4}
              fill="#273449"
              stroke="#3a4c63"
            />
            <text x={Math.min(points[hover].x, width - 64)} y={Math.max(points[hover].y - 16, 21)} textAnchor="middle" className="finance-chart-tooltip-text">
              {formatValue(points[hover].row.value)}
            </text>
          </g>
        ) : null}
      </svg>
    </div>
  );
}

function FinanceBarChart({
  data,
  color,
  formatValue,
}: {
  data: ChartPoint[];
  color: string;
  formatValue: (value: number) => string;
}) {
  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <div className="funnel-bar-chart finance-metric-bar-chart" role="img" aria-label={data.map((d) => `${d.label}: ${formatValue(d.value)}`).join(", ")}>
      {data.map((row) => {
        const magnitude = Math.abs(row.value);
        const pct = Math.max(magnitude === 0 ? 0 : 4, (magnitude / max) * 100);
        return (
          <div key={row.label} className="funnel-bar-col">
            <div className="funnel-bar-meta muted">{formatValue(row.value)}</div>
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
  const chartData: ChartPoint[] = data.map((row) => ({
    label: row.label,
    value: row[metric.key],
  }));

  return (
    <article className="finance-chart-card">
      <h3>{metric.title}</h3>
      <div className="finance-chart-block">
        <h4>{lineChartLabel}</h4>
        <FinanceLineChart data={chartData} color={metric.color} formatValue={formatValue} />
      </div>
      <div className="finance-chart-block">
        <h4>{barChartLabel}</h4>
        <FinanceBarChart data={chartData} color={metric.color} formatValue={formatValue} />
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
