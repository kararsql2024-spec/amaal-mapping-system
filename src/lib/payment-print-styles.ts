import type { CSSProperties } from "react";
import type { PaymentPrintSettings } from "@/lib/payment-types";

export const PAYMENT_BORDER_STYLES = [
  { id: "solid", label: "كلاسيك", group: "كلاسيك" },
  { id: "minimalist", label: "بسيط", group: "كلاسيك" },
  { id: "double", label: "ملكي مزدوج", group: "كلاسيك" },
  { id: "dashed", label: "منقط", group: "كلاسيك" },
  { id: "zen", label: "هادئ", group: "كلاسيك" },
  { id: "modern_bold", label: "عصري جريء", group: "حديث" },
  { id: "tech_edge", label: "تقني Cyber", group: "حديث" },
  { id: "geometric", label: "مضلع", group: "حديث" },
  { id: "brutalist", label: "Brutalist", group: "حديث" },
  { id: "organic", label: "انسيابي", group: "حديث" },
  { id: "architect", label: "هندسي", group: "حديث" },
  { id: "luxury_gold", label: "ذهبي فاخر", group: "حديث" },
  { id: "royal_crest", label: "👑 ملكي مزخرف", group: "فاخر" },
  { id: "midnight_gold", label: "🌙 ليلي فاخر", group: "فاخر" },
  { id: "marble_luxe", label: "◆ رخامي", group: "فاخر" },
  { id: "ribbon_premium", label: "🎗 شريط العنوان", group: "فاخر" },
  { id: "heritage_parchment", label: "📜 تراثي", group: "فاخر" },
  { id: "corporate_sidebar", label: "💼 تنفيذي", group: "احترافي" },
  { id: "glass_gradient", label: "✦ زجاجي", group: "احترافي" },
  { id: "blueprint", label: "📐 مخطط هندسي", group: "احترافي" },
  { id: "art_deco", label: "◇ Art Deco", group: "احترافي" },
  { id: "national_pride", label: "🏛 وطني أنيق", group: "احترافي" },
  { id: "desert_sunset", label: "🌅 صحراوي", group: "فاخر" },
  { id: "copper_luxe", label: "🥉 نحاسي فاخر", group: "فاخر" },
  { id: "islamic_arch", label: "🕌 قوس إسلامي", group: "فاخر" },
  { id: "emerald_estate", label: "🏡 عقاري أخضر", group: "احترافي" },
  { id: "certificate", label: "🎓 شهادة رسمية", group: "احترافي" },
  { id: "stamp_official", label: "📮 رسمي مختوم", group: "احترافي" },
  { id: "neon_city", label: "🌃 مدينة ليلية", group: "حديث" },
  { id: "gradient_wave", label: "🌊 موجي", group: "حديث" },
  { id: "newspaper", label: "📰 صحفي", group: "حديث" },
] as const;

export type PaymentPrintThemeId = (typeof PAYMENT_BORDER_STYLES)[number]["id"];

const STYLE_GROUP_ORDER = ["فاخر", "احترافي", "حديث", "كلاسيك"] as const;

export const getPaymentStyleGroups = () =>
  STYLE_GROUP_ORDER.map((group) => ({
    group,
    items: PAYMENT_BORDER_STYLES.filter((style) => style.group === group),
  })).filter((entry) => entry.items.length > 0);

const THEMED_STYLES = new Set<string>([
  "royal_crest",
  "midnight_gold",
  "marble_luxe",
  "ribbon_premium",
  "heritage_parchment",
  "corporate_sidebar",
  "glass_gradient",
  "blueprint",
  "art_deco",
  "national_pride",
  "desert_sunset",
  "copper_luxe",
  "islamic_arch",
  "emerald_estate",
  "certificate",
  "stamp_official",
  "neon_city",
  "gradient_wave",
  "newspaper",
]);

export const getPaymentThemeClass = (style?: string): string => {
  if (!style || !THEMED_STYLES.has(style)) return "";
  return `payment-theme-${style}`;
};

export const getPaymentBorderStyle = (
  style: string | undefined,
  color: string,
): CSSProperties => {
  switch (style) {
    case "minimalist":
      return { border: `1px solid ${color}`, borderRadius: "4px" };
    case "modern_bold":
      return { border: `12px solid ${color}`, borderRadius: "60px 0 60px 0" };
    case "tech_edge":
      return {
        border: `6px solid ${color}`,
        clipPath: "polygon(8% 0, 100% 0, 100% 92%, 92% 100%, 0 100%, 0 8%)",
      };
    case "luxury_gold":
      return {
        border: `3px double ${color}`,
        outline: `1px solid ${color}`,
        outlineOffset: "6px",
        margin: "10px",
      };
    case "brutalist":
      return { border: `8px solid ${color}`, boxShadow: `12px 12px 0px ${color}` };
    case "organic":
      return { border: `6px solid ${color}`, borderRadius: "100px 40px 120px 50px" };
    case "architect":
      return {
        border: `2px solid ${color}`,
        padding: "15px",
        position: "relative",
        outline: `1px solid ${color}`,
        outlineOffset: "-12px",
      };
    case "zen":
      return {
        borderTop: `15px solid ${color}`,
        borderBottom: `15px solid ${color}`,
        borderLeft: `1px solid ${color}`,
        borderRight: `1px solid ${color}`,
      };
    case "geometric":
      return {
        border: `8px solid ${color}`,
        clipPath:
          "polygon(20% 0%, 80% 0%, 100% 20%, 100% 80%, 80% 100%, 20% 100%, 0% 80%, 0% 20%)",
      };
    case "double":
      return { border: `10px double ${color}` };
    case "dashed":
      return { border: `6px dashed ${color}`, borderRadius: "20px" };
    case "royal_crest":
      return { border: `3px double ${color}` };
    case "midnight_gold":
      return { border: `3px solid #0f172a`, padding: 0 };
    case "marble_luxe":
      return { border: `1px solid ${color}`, borderRadius: "2px" };
    case "ribbon_premium":
      return { border: `2px solid ${color}` };
    case "heritage_parchment":
      return {
        border: `2px solid ${color}`,
        boxShadow: `inset 0 0 100px rgba(120, 80, 40, 0.07)`,
      };
    case "corporate_sidebar":
      return { border: `1px solid #e2e8f0`, borderRight: `14px solid ${color}` };
    case "glass_gradient":
      return { border: `1px solid rgba(148, 163, 184, 0.5)`, borderRadius: "12px" };
    case "blueprint":
      return { border: `3px solid ${color}` };
    case "art_deco":
      return {
        border: `4px solid ${color}`,
        outline: `2px solid ${color}`,
        outlineOffset: "4px",
      };
    case "national_pride":
      return {
        borderTop: `8px solid ${color}`,
        borderBottom: `8px solid ${color}`,
        borderLeft: `2px solid ${color}`,
        borderRight: `2px solid ${color}`,
      };
    case "desert_sunset":
      return { border: `2px solid #c2783a`, borderRadius: "6px" };
    case "copper_luxe":
      return {
        border: `3px solid ${color}`,
        boxShadow: `inset 0 0 0 1px #d4a574, inset 0 0 60px rgba(180, 120, 60, 0.08)`,
      };
    case "islamic_arch":
      return { border: `2px solid ${color}`, padding: "0" };
    case "emerald_estate":
      return { border: `2px solid #059669`, borderRadius: "8px" };
    case "certificate":
      return {
        border: `6px double ${color}`,
        padding: "20px",
      };
    case "stamp_official":
      return { border: `1px solid #94a3b8`, borderTop: `4px solid ${color}` };
    case "neon_city":
      return {
        border: `1px solid ${color}`,
        boxShadow: `0 0 12px color-mix(in srgb, ${color} 40%, transparent), inset 0 0 20px rgba(15, 23, 42, 0.04)`,
      };
    case "gradient_wave":
      return { border: "none", padding: 0 };
    case "newspaper":
      return { border: `3px solid #0f172a`, borderTop: `6px solid #0f172a` };
    default:
      return { border: `8px solid ${color}` };
  }
};

export const resolvePaymentPrintTheme = (
  settings: PaymentPrintSettings = {},
): {
  themeId: string;
  themeClass: string;
  frameColor: string;
  staticColor: string;
  dynamicColor: string;
  borderStyle: CSSProperties;
  watermarkOpacity: number;
  logoUrl?: string;
} => {
  const themeId = settings.border_style || "solid";
  const frameColor = settings.frame_color || "#1e40af";
  return {
    themeId,
    themeClass: getPaymentThemeClass(themeId),
    frameColor,
    staticColor: settings.static_text_color || "#000000",
    dynamicColor: settings.dynamic_text_color || "#991b1b",
    borderStyle: getPaymentBorderStyle(themeId, frameColor),
    watermarkOpacity: settings.watermark_opacity ?? 0.1,
    logoUrl: settings.logo_url,
  };
};
