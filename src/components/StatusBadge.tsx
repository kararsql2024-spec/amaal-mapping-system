import { cn } from "@/lib/utils";
import { getStatusMeta } from "@/lib/unit-status";

/** Status chip driven by the shared status registry. */
export const StatusBadge = ({
  status,
  className,
  showDot = true,
}: {
  status?: string | null;
  className?: string;
  showDot?: boolean;
}) => {
  const meta = getStatusMeta(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 text-[11px] font-medium leading-tight",
        meta.badge,
        className,
      )}
    >
      {showDot ? (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: meta.fill }}
          aria-hidden="true"
        />
      ) : null}
      {meta.label}
    </span>
  );
};

/** Legend swatch used under the map and in charts. */
export const StatusDot = ({
  status,
  className,
}: {
  status?: string | null;
  className?: string;
}) => (
  <span
    className={cn("inline-block h-2 w-2 shrink-0 rounded-full", className)}
    style={{ backgroundColor: getStatusMeta(status).fill }}
    aria-hidden="true"
  />
);
