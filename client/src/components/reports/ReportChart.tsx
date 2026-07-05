/**
 * ReportChart — renders a config ChartBlock as an interactive recharts chart.
 *
 * Supports line / bar / area / composed via the block's `chartType` (and, for
 * composed, per-series `type`). Colors come from the shared CHART_PALETTE
 * (--chart-1..5) unless a series overrides `color`. Axes, tooltips, and the
 * optional reference line are formatted with the shared formatValue /
 * formatAxisTick helpers so the interactive numbers match the crawler table
 * fallback exactly.
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
} from "@shared/reportContent";

const GRID_STROKE = "hsl(var(--border))";
const AXIS_STROKE = "hsl(var(--muted-foreground))";

export function ReportChart({ block }: { block: ChartBlock }) {
  const height = Math.max(300, block.data.length > 12 ? block.data.length * 22 : 320);
  const fmt = block.format ?? "number";

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} opacity={0.4} />
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
        formatter={(value: number | string, name: string) => [
          typeof value === "number" ? formatValue(value, fmt) : String(value),
          name,
        ]}
        contentStyle={{
          background: "hsl(var(--popover))",
          border: `1px solid ${GRID_STROKE}`,
          borderRadius: 8,
          fontSize: 12,
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
