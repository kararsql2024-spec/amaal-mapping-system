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
    fill: "#2ECC71",
    stroke: "#1FA85A",
    badge: "bg-status-available/20 text-status-available border-status-available/45",
    text: "text-status-available",
    chart: "#2ECC71",
  },
  sold: {
    key: "sold",
    label: "مباع",
    fill: "#FF4444",
    stroke: "#FF2222",
    badge: "bg-status-sold/20 text-status-sold border-status-sold/45",
    text: "text-status-sold",
    chart: "#FF4444",
  },
  investment: {
    key: "investment",
    label: "استثمار",
    fill: "#B24BF3",
    stroke: "#9D2FEE",
    badge: "bg-status-investment/20 text-status-investment border-status-investment/45",
    text: "text-status-investment",
    chart: "#B24BF3",
  },
  reserved: {
    key: "reserved",
    label: "محجوز",
    fill: "#FFAA00",
    stroke: "#FF9500",
    badge: "bg-status-reserved/20 text-status-reserved border-status-reserved/45",
    text: "text-status-reserved",
    chart: "#FFAA00",
  },
  pending: {
    key: "pending",
    label: "حجز أولي",
    fill: "#29B6F6",
    stroke: "#039BE5",
    badge: "bg-status-pending/20 text-status-pending border-status-pending/45",
    text: "text-status-pending",
    chart: "#29B6F6",
  },
  frozen_counted: {
    key: "frozen_counted",
    label: "مجمدة (محتسبة)",
    fill: "#BDBDBD",
    stroke: "#9E9E9E",
    badge: "bg-status-frozen/30 text-fg-secondary border-status-frozen/50",
    text: "text-fg-secondary",
    chart: "#BDBDBD",
  },
  frozen_uncounted: {
    key: "frozen_uncounted",
    label: "مجمدة (غير محتسبة)",
    fill: "#BDBDBD",
    stroke: "#9E9E9E",
    badge: "bg-status-frozen/30 text-fg-secondary border-status-frozen/50",
    text: "text-fg-secondary",
    chart: "#BDBDBD",
  },
  frozen_hidden: {
    key: "frozen_hidden",
    label: "مجمدة (مخفية)",
    fill: "#BDBDBD",
    stroke: "#9E9E9E",
    badge: "bg-status-frozen/30 text-fg-secondary border-status-frozen/50",
    text: "text-fg-secondary",
    chart: "#BDBDBD",
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
      background: `linear-gradient(155deg, ${hexAlpha(fill, 0.35)} 0%, ${hexAlpha(fill, 0.16)} 42%, #f5f5f5 100%)`,
      border: hexAlpha(stroke, 0.55),
      glow: hexAlpha(fill, 0.38),
      bar: `linear-gradient(90deg, transparent, ${hexAlpha(fill, 0.7)}, transparent)`,
      badgeBg: hexAlpha(fill, 0.28),
      badgeText: stroke,
    };
  }

  return {
    background: `linear-gradient(145deg, ${hexAlpha(fill, 0.44)} 0%, ${hexAlpha(fill, 0.26)} 38%, ${hexAlpha(fill, 0.1)} 100%)`,
    border: hexAlpha(fill, 0.58),
    glow: hexAlpha(fill, 0.48),
    bar: `linear-gradient(90deg, ${hexAlpha(fill, 0.3)}, ${fill}, ${hexAlpha(fill, 0.3)})`,
    badgeBg: hexAlpha(fill, 0.24),
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
  "#29B6F6",
  "#AB8A7B",
  "#2ECC71",
  "#FFAA00",
  "#B24BF3",
  "#FF4444",
  "#BDBDBD",
] as const;
