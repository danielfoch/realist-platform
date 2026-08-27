"use client";

/**
 * ReportCharts — the ONE client island in a config report. Renders a
 * ChartBlock as an interactive recharts chart; every other block (narrative,
 * stat grids, callouts, images, sources) stays server-rendered so the report
 * text ships in the HTML. The server also emits each chart's data as an
 * accessible <details> table, so nothing here is load-bearing for SEO.
 *
 * Supports line / bar / area / composed via the block's `chartType` (and, for
 * composed, per-series `type`). Colors come from the shared CHART_PALETTE
 * (globals.css design tokens) unless a series overrides `color`. Axes,
 * tooltips, and the optional reference line are formatted with the shared
 * formatValue / formatAxisTick helpers so the interactive numbers match the
 * server table fallback exactly.
 */
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  formatAxisTick,
  formatValue,
  seriesColor,
  type ChartBlock,
} from "@/lib/research/reportContent";

const GRID_STROKE = "var(--color-hairline)";
const AXIS_STROKE = "var(--color-ink-faint)";

export function ReportCharts({ block }: { block: ChartBlock }) {
  const height = Math.max(300, block.data.length > 12 ? block.data.length * 22 : 320);
  const fmt = block.format ?? "number";

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} opacity={0.6} />
      <XAxis
        dataKey={block.xKey}
        stroke={AXIS_STROKE}
        tick={{ fontSize: 12 }}
        tickLine={false}
        label={
          block.xAxisLabel
            ? { value: block.xAxisLabel, position: "insideBottom", offset: -4, fontSize: 11, fill: AXIS_STROKE }
            : undefined
        }
      />
      <YAxis
        stroke={AXIS_STROKE}
        tick={{ fontSize: 12 }}
        tickLine={false}
        tickFormatter={(v) => formatAxisTick(Number(v), fmt)}
        label={
          block.yAxisLabel
            ? { value: block.yAxisLabel, angle: -90, position: "insideLeft", fontSize: 11, fill: AXIS_STROKE }
            : undefined
        }
      />
      <Tooltip
        formatter={(value, name) => [
          typeof value === "number" ? formatValue(value, fmt) : String(value),
          String(name),
        ]}
        contentStyle={{
          background: "var(--color-surface)",
          border: `1px solid ${GRID_STROKE}`,
          borderRadius: 8,
          fontSize: 12,
          color: "var(--color-ink)",
        }}
      />
      {block.series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
      {block.referenceLine && (
        <ReferenceLine
          y={block.referenceLine.value}
          stroke={AXIS_STROKE}
          strokeDasharray="4 4"
          label={{ value: block.referenceLine.label, position: "right", fontSize: 10, fill: AXIS_STROKE }}
        />
      )}
    </>
  );

  const renderChart = () => {
    switch (block.chartType) {
      case "line":
        return (
          <LineChart data={block.data} margin={{ top: 8, right: 24, left: 4, bottom: block.xAxisLabel ? 20 : 4 }}>
            {commonAxes}
            {block.series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={seriesColor(s, i)}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        );
      case "area":
        return (
          <AreaChart data={block.data} margin={{ top: 8, right: 24, left: 4, bottom: block.xAxisLabel ? 20 : 4 }}>
            {commonAxes}
            {block.series.map((s, i) => {
              const color = seriesColor(s, i);
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
              );
            })}
          </AreaChart>
        );
      case "composed":
        return (
          <ComposedChart data={block.data} margin={{ top: 8, right: 24, left: 4, bottom: block.xAxisLabel ? 20 : 4 }}>
            {commonAxes}
            {block.series.map((s, i) => {
              const color = seriesColor(s, i);
              if (s.type === "line") {
                return <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} dot={false} />;
              }
              if (s.type === "area") {
                return <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={color} fill={color} fillOpacity={0.2} strokeWidth={2} />;
              }
              return <Bar key={s.key} dataKey={s.key} name={s.label} fill={color} radius={[3, 3, 0, 0]} />;
            })}
          </ComposedChart>
        );
      case "bar":
      default:
        return (
          <BarChart data={block.data} margin={{ top: 8, right: 24, left: 4, bottom: block.xAxisLabel ? 20 : 4 }}>
            {commonAxes}
            {block.series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={seriesColor(s, i)} radius={[3, 3, 0, 0]} />
            ))}
          </BarChart>
        );
    }
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      {renderChart()}
    </ResponsiveContainer>
  );
}
