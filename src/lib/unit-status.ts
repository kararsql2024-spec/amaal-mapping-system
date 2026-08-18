/**
 * Single source of truth for unit status: keys, Arabic labels, and colors.
 *
 * Before this module the same six statuses were re-declared in Index,
 * Reports, DetailedStatsTable, InteractiveMap, TowerDetailsModal and Brochure,
 * each with its own hex values and its own Arabic wording.
 *
 * Status semantics are unchanged: the raw string values stored in
 * houses_data.data.status are exactly the same as before.
 */

export type UnitStatus =
  | "available"
  | "sold"
  | "investment"
  | "reserved"
  | "pending"
  | "frozen_counted"
  | "frozen_uncounted"
  | "frozen_hidden";

export interface ApartmentCardTheme {
  /** خلفية متدرجة داخل بطاقة الشقة */
  background: string;
  /** لون الحد */
  border: string;
  /** توهج زاوي خفيف */
  glow: string;
  /** شريط سفلي متدرج */
  bar: string;
  /** خلفية شارة الحالة */
  badgeBg: string;
  /** لون نص الشارة */
  badgeText: string;
}

const hexAlpha = (hex: string, alpha: number): string => {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
};

export interface StatusMeta {
  key: UnitStatus;
  label: string;
  /** Canvas/SVG fill. */
  fill: string;
  /** Canvas/SVG stroke. */
  stroke: string;
  /** Tailwind classes for badges and legends. */
  badge: string;
  /** Tailwind text color for standalone labels. */
  text: string;
  /** Recharts series color. */
  chart: string;
}

export const STATUS_META: Record<UnitStatus, StatusMeta> = {
  available: {
    key: "available",
    label: "متوفر",
    fill: "#6EC9A0",
    stroke: "#3FAF7E",
    badge: "bg-status-available/15 text-status-available border-status-available/30",
    text: "text-status-available",
    chart: "#6EC9A0",
  },
  sold: {
    key: "sold",
    label: "مباع",
    fill: "#FF9494",
    stroke: "#E85C5C",
    badge: "bg-status-sold/15 text-status-sold border-status-sold/30",
    text: "text-status-sold",
    chart: "#FF9494",
  },
  investment: {
    key: "investment",
    label: "استثمار",
    fill: "#B5A3D9",
    stroke: "#9178C4",
    badge: "bg-status-investment/15 text-status-investment border-status-investment/30",
    text: "text-status-investment",
    chart: "#B5A3D9",
  },
  reserved: {
    key: "reserved",
    label: "محجوز",
    fill: "#F0B860",
    stroke: "#D99540",
    badge: "bg-status-reserved/15 text-status-reserved border-status-reserved/30",
    text: "text-status-reserved",
    chart: "#F0B860",
  },
  pending: {
    key: "pending",
    label: "حجز أولي",
    fill: "#85C4E0",
    stroke: "#5AA8CC",
    badge: "bg-status-pending/15 text-status-pending border-status-pending/30",
    text: "text-status-pending",
    chart: "#85C4E0",
  },
  frozen_counted: {
    key: "frozen_counted",
    label: "مجمدة (محتسبة)",
    fill: "#D4CCC4",
    stroke: "#B8B0A8",
    badge: "bg-status-frozen/25 text-fg-secondary border-status-frozen/40",
    text: "text-fg-secondary",
    chart: "#D4CCC4",
  },
  frozen_uncounted: {
    key: "frozen_uncounted",
    label: "مجمدة (غير محتسبة)",
    fill: "#D4CCC4",
    stroke: "#B8B0A8",
    badge: "bg-status-frozen/25 text-fg-secondary border-status-frozen/40",
    text: "text-fg-secondary",
    chart: "#D4CCC4",
  },
  frozen_hidden: {
    key: "frozen_hidden",
    label: "مجمدة (مخفية)",
    fill: "#D4CCC4",
    stroke: "#B8B0A8",
    badge: "bg-status-frozen/25 text-fg-secondary border-status-frozen/40",
    text: "text-fg-secondary",
    chart: "#D4CCC4",
  },
};

const FALLBACK = STATUS_META.available;

export const getStatusMeta = (status?: string | null): StatusMeta =>
  (status && STATUS_META[status as UnitStatus]) || FALLBACK;

export const getStatusLabel = (status?: string | null): string =>
  getStatusMeta(status).label;

export const isFrozen = (status?: string | null): boolean =>
  typeof status === "string" && status.startsWith("frozen");

/** تنسيق بطاقة الشقة في مخطط الطابق — تدرجات احترافية حسب الحالة */
export const getApartmentCardTheme = (
  status?: string | null,
): ApartmentCardTheme => {
  const meta = getStatusMeta(status);
  const { fill, stroke } = meta;
  const frozen = isFrozen(status);

  if (frozen) {
    return {
      background: `linear-gradient(155deg, ${hexAlpha(fill, 0.22)} 0%, ${hexAlpha(fill, 0.08)} 38%, #fafafa 100%)`,
      border: hexAlpha(stroke, 0.45),
      glow: hexAlpha(fill, 0.28),
      bar: `linear-gradient(90deg, transparent, ${hexAlpha(fill, 0.55)}, transparent)`,
      badgeBg: hexAlpha(fill, 0.2),
      badgeText: stroke,
    };
  }

  return {
    background: `linear-gradient(145deg, ${hexAlpha(fill, 0.26)} 0%, ${hexAlpha(fill, 0.1)} 36%, rgba(255,255,255,0.97) 68%, #ffffff 100%)`,
    border: hexAlpha(fill, 0.34),
    glow: hexAlpha(fill, 0.32),
    bar: `linear-gradient(90deg, ${hexAlpha(fill, 0.15)}, ${hexAlpha(fill, 0.75)}, ${hexAlpha(fill, 0.15)})`,
    badgeBg: hexAlpha(fill, 0.14),
    badgeText: stroke,
  };
};

/** Statuses offered in the unit editor, in display order. */
export const SELECTABLE_STATUSES: UnitStatus[] = [
  "available",
  "sold",
  "investment",
  "reserved",
  "pending",
  "frozen_counted",
  "frozen_uncounted",
  "frozen_hidden",
];

/** Statuses shown in map filters and distribution charts, in display order. */
export const PRIMARY_STATUSES: UnitStatus[] = [
  "available",
  "sold",
  "investment",
  "reserved",
  "pending",
];

/** تنسيق بطاقات الإحصائيات السريعة في الصفحة الرئيسية */
export const getQuickStatTheme = (
  kind: UnitStatus | "total",
): ApartmentCardTheme => {
  if (kind === "total") {
    const fill = "#304653";
    const stroke = "#1E2E38";
    return {
      background: `linear-gradient(145deg, ${hexAlpha(fill, 0.14)} 0%, ${hexAlpha(fill, 0.05)} 36%, rgba(255,255,255,0.97) 68%, #ffffff 100%)`,
      border: hexAlpha(fill, 0.28),
      glow: hexAlpha(fill, 0.22),
      bar: `linear-gradient(90deg, ${hexAlpha(fill, 0.12)}, ${hexAlpha(fill, 0.55)}, ${hexAlpha(fill, 0.12)})`,
      badgeBg: hexAlpha(fill, 0.1),
      badgeText: stroke,
    };
  }
  return getApartmentCardTheme(kind);
};

/** Categorical series colors for charts that are not status-based. */
export const CHART_SERIES = [
  "#304653",
  "#85C4E0",
  "#AB8A7B",
  "#6EC9A0",
  "#F0B860",
  "#B5A3D9",
  "#FF9494",
  "#D4CCC4",
] as const;
