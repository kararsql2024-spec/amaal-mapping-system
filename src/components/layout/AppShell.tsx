import React from "react";
import { cn } from "@/lib/utils";
import {
  getQuickStatTheme,
  getStatusMeta,
  type UnitStatus,
} from "@/lib/unit-status";
import { Brand } from "./Brand";

/**
 * Page chrome shared by the operational screens.
 * Depth comes from hairlines and spacing, never from shadows or fills.
 */
export const AppShell = ({
  nav,
  actions,
  children,
  brandSubtitle,
  className,
}: {
  nav?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  brandSubtitle?: string;
  className?: string;
}) => (
  <div className="min-h-screen bg-background text-fg">
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-5 px-5 lg:px-8">
        <Brand subtitle={brandSubtitle} />
        {nav ? (
          <>
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">{nav}</div>
          </>
        ) : null}
        {actions ? (
          <div className="ms-auto flex items-center gap-2">{actions}</div>
        ) : null}
      </div>
    </header>

    <main className={cn("mx-auto max-w-[1440px] px-5 pb-24 lg:px-8", className)}>
      {children}
    </main>
  </div>
);

/** Small uppercase mono marker used above section titles. */
export const Eyebrow = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => <div className={cn("eyebrow", className)}>{children}</div>;

export const SectionHeading = ({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between",
      className,
    )}
  >
    <div className="min-w-0 space-y-2">
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 className="text-2xl font-normal leading-tight text-fg">{title}</h2>
      {description ? (
        <p className="max-w-2xl text-[13px] leading-relaxed text-fg-muted">
          {description}
        </p>
      ) : null}
    </div>
    {actions ? (
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    ) : null}
  </div>
);

/**
 * Bordered content block: the only container style in the app.
 * Cards elsewhere should be replaced by this rather than growing new variants.
 */
export const Panel = ({
  title,
  description,
  icon,
  actions,
  footer,
  bodyClassName,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  bodyClassName?: string;
  className?: string;
  children: React.ReactNode;
}) => (
  <section className={cn("flex flex-col border border-line bg-surface", className)}>
    {(title || actions) && (
      <header className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            {icon ? <span className="shrink-0 text-fg-muted">{icon}</span> : null}
            <h3 className="truncate text-[14px] font-medium text-fg">{title}</h3>
          </div>
          {description ? (
            <p className="text-[11px] leading-relaxed text-fg-muted">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </header>
    )}
    <div className={cn("min-h-0 flex-1 p-5", bodyClassName)}>{children}</div>
    {footer ? (
      <footer className="border-t border-line px-5 py-3">{footer}</footer>
    ) : null}
  </section>
);

/** Segmented control used for in-panel view switches. */
export const SegmentedControl = <T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: React.ReactNode }[];
  className?: string;
}) => (
  <div className={cn("inline-flex border border-line", className)}>
    {options.map((option, i) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={cn(
          "px-3 py-1.5 text-[11px] transition-colors",
          i > 0 && "border-s border-line",
          value === option.value
            ? "bg-fg text-background"
            : "text-fg-secondary hover:bg-surface-sunken hover:text-fg",
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export interface StatCell {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  accent?: string;
}

export interface QuickStatCell extends StatCell {
  statusKey?: UnitStatus | "total";
}

/**
 * Hairline-separated metric row. The 1px gaps are produced by the container
 * background showing through, which keeps borders correct in both directions.
 */
export const StatGrid = ({
  items,
  columns = 4,
  numbered = true,
  className,
}: {
  items: StatCell[];
  columns?: 2 | 3 | 4 | 5;
  numbered?: boolean;
  className?: string;
}) => {
  if (items.length === 0) return null;

  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-3 lg:grid-cols-5",
  }[columns];

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-px border-y border-line bg-line",
        cols,
        className,
      )}
    >
      {items.map((item, i) => (
        <div key={i} className="relative bg-background px-4 py-5 lg:px-5 lg:py-6">
          <div
            className="text-[26px] font-light leading-none tracking-display tabular lg:text-[30px]"
            style={item.accent ? { color: item.accent } : undefined}
          >
            {item.value}
          </div>
          <div className="mt-2.5 text-[12px] leading-tight text-fg-secondary">
            {item.label}
          </div>
          {item.hint ? (
            <div className="mt-1 text-[11px] leading-tight text-fg-faint">
              {item.hint}
            </div>
          ) : null}
          {numbered ? (
            <span className="eyebrow-mono absolute bottom-2.5 start-4 lg:start-5">
              {String(i + 1).padStart(2, "0")}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
};

/** بطاقات الإحصائيات السريعة — تدرجات وأرقام بارزة مثل مخطط الطابق */
export const QuickStatGrid = ({
  items,
  columns = 4,
  className,
}: {
  items: QuickStatCell[];
  columns?: 2 | 3 | 4;
  className?: string;
}) => {
  if (items.length === 0) return null;

  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];

  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 lg:gap-4",
        cols,
        className,
      )}
    >
      {items.map((item, i) => {
        const kind = item.statusKey ?? "total";
        const theme = getQuickStatTheme(kind);
        const meta = kind === "total" ? null : getStatusMeta(kind);
        const displayValue =
          typeof item.value === "number"
            ? item.value.toLocaleString("en-US")
            : item.value;

        return (
          <div
            key={i}
            className="relative flex min-h-[112px] flex-col justify-between overflow-hidden border p-4 lg:min-h-[124px] lg:p-5"
            style={{
              background: theme.background,
              borderColor: theme.border,
              boxShadow: `inset 0 1px 0 ${theme.glow}`,
            }}
          >
            <span
              className="pointer-events-none absolute -end-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-80"
              style={{ backgroundColor: theme.glow }}
              aria-hidden="true"
            />
            <span
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
              style={{ background: theme.bar }}
              aria-hidden="true"
            />

            <div className="relative flex items-start justify-between gap-2">
              <span
                className="text-[34px] font-semibold leading-none tabular lg:text-[42px]"
                style={{ color: meta?.fill ?? "#1E2E38" }}
              >
                {displayValue}
              </span>
              {meta ? (
                <span
                  className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white/70"
                  style={{ backgroundColor: meta.fill }}
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <div className="relative mt-3 space-y-1">
              <div className="text-[13px] font-medium leading-tight text-fg">
                {item.label}
              </div>
              {item.hint ? (
                <div className="text-[11px] leading-tight text-fg-muted">
                  {item.hint}
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const EmptyState = ({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-3 border border-dashed border-line px-6 py-20 text-center",
      className,
    )}
  >
    {icon ? <div className="text-fg-faint">{icon}</div> : null}
    <p className="text-[15px] font-normal text-fg-secondary">{title}</p>
    {description ? (
      <p className="max-w-sm text-xs leading-relaxed text-fg-faint">
        {description}
      </p>
    ) : null}
    {action ? <div className="mt-2">{action}</div> : null}
  </div>
);

/** Determinate-looking placeholder used while a screen's data resolves. */
export const LoadingBlock = ({
  label,
  className,
}: {
  label: string;
  className?: string;
}) => (
  <div
    className={cn(
      "flex flex-col items-center justify-center gap-4 border border-line bg-surface px-6 py-24",
      className,
    )}
  >
    <div className="flex gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1 w-6 animate-pulse bg-line-strong"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </div>
    <p className="text-[13px] text-fg-muted">{label}</p>
  </div>
);
