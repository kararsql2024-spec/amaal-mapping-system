/**
 * Shared Recharts presentation layer.
 *
 * Recharts styles its axes, grid, tooltip and legend through props rather than
 * CSS, so the visual language has to be expressed as objects. Everything the
 * charts in Reports need is declared once here instead of being repeated with
 * slightly different values on every chart.
 */

import React from "react";
import { palette, canvasFont } from "@/lib/theme";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

export const chartGrid = {
  stroke: palette.line,
  strokeDasharray: "0",
  vertical: false,
} as const;

export const chartAxis = {
  tick: {
    fontSize: 10,
    fontFamily: canvasFont,
    fill: palette.fgMuted,
    fontWeight: 400,
  },
  tickLine: false,
  axisLine: { stroke: palette.line },
} as const;

export const chartMargin = { top: 8, right: 8, left: 8, bottom: 0 } as const;

/**
 * Compact axis labels: 1.2 مليار / 340 مليون / 12,500.
 * The separator is a non-breaking space so Recharts keeps the tick on one line.
 */
export const formatAxisValue = (value: number): string => {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}\u00a0مليار`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}\u00a0مليون`;
  if (Math.abs(value) >= 1e4) return `${(value / 1e3).toFixed(0)}\u00a0ألف`;
  return formatNumber(value);
};

interface TooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
}

interface ChartTooltipProps {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  /** Maps a raw series value to its display string. */
  format?: (value: number, name: string) => string;
}

export const ChartTooltip = ({
  active,
  label,
  payload,
  format,
}: ChartTooltipProps) => {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-[10rem] border border-line bg-surface px-3 py-2 shadow-pop">
      {label !== undefined && label !== "" && (
        <p className="mb-1.5 border-b border-line pb-1.5 text-[11px] text-fg">
          {label}
        </p>
      )}
      <div className="space-y-1">
        {payload.map((entry, i) => {
          const name = String(entry.name ?? "");
          const raw = Number(entry.value ?? 0);
          return (
            <div
              key={`${name}-${i}`}
              className="flex items-center justify-between gap-4 text-[11px]"
            >
              <span className="flex items-center gap-1.5 text-fg-secondary">
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {name}
              </span>
              <span className="font-mono tabular-nums text-fg">
                {format ? format(raw, name) : formatNumber(raw)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface LegendItem {
  name: string;
  color: string;
  value?: React.ReactNode;
}

/**
 * Recharts' own <Legend> renders inline styles we cannot theme cleanly, so
 * charts render this next to the plot instead.
 */
export const ChartLegend = ({
  items,
  className,
}: {
  items: LegendItem[];
  className?: string;
}) => (
  <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", className)}>
    {items.map((item) => (
      <div key={item.name} className="flex items-center gap-2 text-[11px]">
        <span
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: item.color }}
        />
        <span className="text-fg-secondary">{item.name}</span>
        {item.value !== undefined && (
          <span className="font-mono tabular-nums text-fg">{item.value}</span>
        )}
      </div>
    ))}
  </div>
);

/** Placeholder shown where a chart would be when there is nothing to plot. */
export const ChartEmpty = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full items-center justify-center text-center text-[11px] text-fg-faint">
    {children}
  </div>
);

/** Thin horizontal meter used for the legal / handover progress rows. */
export const Meter = ({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) => {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-[11px]">
        <span className="text-fg-secondary">{label}</span>
        <span className="font-mono tabular-nums text-fg">
          {formatNumber(value)}
          <span className="text-fg-faint"> · {Math.round(pct)}%</span>
        </span>
      </div>
      <div className="h-[3px] w-full bg-surface-sunken">
        <div
          className="h-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};
