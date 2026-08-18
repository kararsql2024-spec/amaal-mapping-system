import { cn } from "@/lib/utils";

export const BRAND_NAME = "RealKarar";

/** RealKarar mark — R letterform + decision point (Karar). */
export const BrandMark = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    className={cn("h-5 w-5 shrink-0 text-fg", className)}
  >
    <rect
      x="2"
      y="2"
      width="20"
      height="20"
      rx="5"
      fill="currentColor"
      opacity="0.07"
    />
    <path
      d="M7.5 7v10M7.5 7h4.2a3 3 0 0 1 0 6H7.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="17.25" cy="16.75" r="2.25" fill="currentColor" />
  </svg>
);

export const BrandWordmark = ({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) => (
  <span
    className={cn(
      "leading-none tracking-tight text-fg",
      compact ? "text-[12px]" : "text-[13px]",
      className,
    )}
  >
    <span className="font-normal text-fg-secondary">Real</span>
    <span className="font-semibold">Karar</span>
  </span>
);

export const Brand = ({
  subtitle,
  className,
}: {
  subtitle?: string;
  className?: string;
}) => (
  <div className={cn("flex items-center gap-2.5", className)}>
    <BrandMark />
    <div className="flex items-baseline gap-2">
      <BrandWordmark />
      <span className="hidden text-[11px] leading-none text-fg-faint sm:inline">
        {subtitle ?? "إدارة الوحدات السكنية"}
      </span>
    </div>
  </div>
);
