import React from "react";
import { normalizeTemplateId } from "@/lib/brochure-types";

const hexAlpha = (hex: string, alpha: number): string => {
  const a = Math.round(Math.min(1, Math.max(0, alpha)) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
};

interface TemplateBackgroundProps {
  templateId: string;
  primary: string;
  secondary: string;
  page: 1 | 2;
}

/** خلفيات زخرفية لكل قالب — صفحة الغلاف أو التفاصيل */
export const TemplateBackground = ({
  templateId,
  primary,
  secondary,
  page,
}: TemplateBackgroundProps) => {
  const id = normalizeTemplateId(templateId);

  if (page === 1) {
    switch (id) {
      case "emerald_luxe":
        return (
          <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(155deg, ${secondary} 0%, #fff 42%, ${hexAlpha(primary, 0.06)} 100%)`,
              }}
            />
            <div
              className="absolute -left-20 top-0 h-full w-[38%] -skew-x-6"
              style={{
                background: `linear-gradient(180deg, ${primary} 0%, ${hexAlpha(primary, 0.75)} 100%)`,
              }}
            />
            <div
              className="absolute bottom-16 right-12 h-1 w-32 rounded-full"
              style={{ background: hexAlpha(primary, 0.35) }}
            />
            <div
              className="absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl"
              style={{ background: hexAlpha(primary, 0.12) }}
            />
          </div>
        );

      case "royal_navy":
        return (
          <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
            <div
              className="absolute inset-x-0 top-0 h-[340px]"
              style={{
                background: `linear-gradient(180deg, ${primary} 0%, ${hexAlpha(primary, 0.88)} 100%)`,
              }}
            />
            <div className="absolute inset-x-0 top-[340px] h-[3px]" style={{ background: "#C0C8D4" }} />
            <div
              className="absolute inset-0 top-[343px]"
              style={{ background: secondary }}
            />
            <div
              className="absolute left-10 top-10 h-24 w-24 rounded-full border-2 opacity-20"
              style={{ borderColor: "#fff" }}
            />
          </div>
        );

      case "midnight_gold":
        return (
          <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
            <div className="absolute inset-0" style={{ background: secondary }} />
            <div
              className="absolute inset-y-0 right-0 w-[32%]"
              style={{
                background: `linear-gradient(180deg, ${hexAlpha(primary, 0.15)} 0%, ${hexAlpha(primary, 0.05)} 100%)`,
                borderInlineStart: `2px solid ${hexAlpha(primary, 0.4)}`,
              }}
            />
            <div
              className="absolute bottom-0 left-0 h-[2px] w-full"
              style={{ background: `linear-gradient(90deg, transparent, ${primary}, transparent)` }}
            />
            <div
              className="absolute left-8 top-8 h-16 w-16 rotate-45 border opacity-15"
              style={{ borderColor: primary }}
            />
          </div>
        );

      case "sunset_terracotta":
        return (
          <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(145deg, ${secondary} 0%, ${hexAlpha(primary, 0.08)} 55%, #fff 100%)`,
              }}
            />
            <div
              className="absolute -right-24 -top-24 h-80 w-80 rounded-full blur-3xl"
              style={{ background: hexAlpha(primary, 0.2) }}
            />
            <div
              className="absolute bottom-0 left-0 right-0 h-24"
              style={{
                background: `linear-gradient(0deg, ${hexAlpha(primary, 0.12)} 0%, transparent 100%)`,
              }}
            />
            <div
              className="absolute left-0 top-0 h-2 w-full"
              style={{ background: `linear-gradient(90deg, ${primary}, ${hexAlpha(primary, 0.5)})` }}
            />
          </div>
        );

      case "marble_minimal":
        return (
          <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, #fff 0%, ${secondary} 40%, #fff 100%)`,
              }}
            />
            <div
              className="absolute inset-8 border"
              style={{ borderColor: hexAlpha(primary, 0.12) }}
            />
            <div
              className="absolute left-0 top-0 h-1 w-full"
              style={{ background: primary }}
            />
          </div>
        );

      case "forest_retreat":
        return (
          <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
            <div className="absolute inset-6" style={{ background: secondary }}>
              <div
                className="absolute inset-0 border-2"
                style={{ borderColor: hexAlpha(primary, 0.25) }}
              />
            </div>
            <div
              className="absolute left-0 top-0 h-3 w-full"
              style={{ background: primary }}
            />
            <div
              className="absolute bottom-10 right-10 h-20 w-20 rounded-full opacity-10"
              style={{ background: primary }}
            />
          </div>
        );

      case "copper_urban":
        return (
          <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(160deg, #f5f5f5 0%, #fff 50%, ${hexAlpha(primary, 0.06)} 100%)`,
              }}
            />
            <div
              className="absolute inset-y-0 left-0 w-2"
              style={{ background: `linear-gradient(180deg, ${secondary}, ${primary})` }}
            />
            <div
              className="absolute bottom-0 right-0 h-40 w-40 opacity-[0.07]"
              style={{
                background: `repeating-linear-gradient(45deg, ${secondary} 0px, ${secondary} 8px, transparent 8px, transparent 16px)`,
              }}
            />
          </div>
        );

      case "azure_coast":
        return (
          <div className="pointer-events-none absolute inset-0 -z-20 overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(180deg, ${secondary} 0%, #fff 55%, ${hexAlpha(primary, 0.05)} 100%)`,
              }}
            />
            <div
              className="absolute -left-10 bottom-0 h-[45%] w-[120%] rounded-t-[100%] opacity-15"
              style={{ background: primary }}
            />
            <div
              className="absolute right-0 top-0 h-full w-1"
              style={{ background: `linear-gradient(180deg, ${primary}, transparent)` }}
            />
          </div>
        );

      default:
        return null;
    }
  }

  /* Page 2 backgrounds */
  switch (id) {
    case "emerald_luxe":
      return (
        <div className="pointer-events-none absolute inset-0 -z-20">
          <div className="absolute inset-x-0 top-0 h-5" style={{ background: primary }} />
          <div
            className="absolute inset-0 top-5"
            style={{ background: `linear-gradient(180deg, ${hexAlpha(primary, 0.04)} 0%, #fff 120px)` }}
          />
        </div>
      );
    case "royal_navy":
      return (
        <div className="pointer-events-none absolute inset-0 -z-20">
          <div
            className="absolute inset-x-0 top-0 h-28"
            style={{ background: primary }}
          />
          <div className="absolute inset-0 top-28 bg-white" />
        </div>
      );
    case "midnight_gold":
      return (
        <div className="pointer-events-none absolute inset-0 -z-20 bg-white">
          <div
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ background: `linear-gradient(90deg, ${primary}, ${hexAlpha(primary, 0.3)}, ${primary})` }}
          />
          <div
            className="absolute bottom-0 right-0 h-32 w-32 opacity-[0.06]"
            style={{ background: secondary }}
          />
        </div>
      );
    case "sunset_terracotta":
      return (
        <div className="pointer-events-none absolute inset-0 -z-20">
          <div className="absolute inset-x-0 top-0 h-4" style={{ background: primary }} />
          <div className="absolute inset-0 bg-[#FFFBF7]" />
        </div>
      );
    case "marble_minimal":
      return (
        <div className="pointer-events-none absolute inset-0 -z-20 bg-white">
          <div className="absolute inset-x-8 top-8 bottom-8 border border-[#E8EAEC]" />
          <div className="absolute inset-x-0 top-0 h-0.5" style={{ background: primary }} />
        </div>
      );
    case "forest_retreat":
      return (
        <div className="pointer-events-none absolute inset-0 -z-20">
          <div className="absolute inset-4 border-2" style={{ borderColor: hexAlpha(primary, 0.2) }} />
          <div className="absolute inset-x-0 top-0 h-3" style={{ background: primary }} />
        </div>
      );
    case "copper_urban":
      return (
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[#FAFAFA]">
          <div className="absolute inset-y-0 left-0 w-1.5" style={{ background: primary }} />
        </div>
      );
    case "azure_coast":
      return (
        <div className="pointer-events-none absolute inset-0 -z-20">
          <div
            className="absolute inset-x-0 top-0 h-20 opacity-90"
            style={{ background: `linear-gradient(180deg, ${hexAlpha(primary, 0.15)}, transparent)` }}
          />
          <div className="absolute inset-0 bg-white" />
        </div>
      );
    default:
      return (
        <div className="pointer-events-none absolute inset-0 -z-20">
          <div className="absolute inset-x-0 top-0 h-4" style={{ background: primary }} />
        </div>
      );
  }
};

/** هل نص الغلاف يكون فاتحاً (على خلفية داكنة) */
export const isCoverHeaderLight = (templateId: string): boolean => {
  const id = normalizeTemplateId(templateId);
  return id === "royal_navy";
};

/** لون شريط المواصفات في صفحة الغلاف */
export const getSpecBarStyle = (
  templateId: string,
  primary: string,
  secondary: string,
): React.CSSProperties => {
  const id = normalizeTemplateId(templateId);
  if (id === "midnight_gold" || id === "copper_urban") {
    return {
      background: `linear-gradient(135deg, ${secondary} 0%, ${hexAlpha(primary, 0.25)} 100%)`,
      color: "#fff",
      border: `1px solid ${hexAlpha(primary, 0.35)}`,
    };
  }
  if (id === "royal_navy") {
    return {
      background: `linear-gradient(135deg, ${primary} 0%, ${hexAlpha(primary, 0.85)} 100%)`,
      color: "#fff",
    };
  }
  return {
    background: `linear-gradient(135deg, ${hexAlpha(primary, 0.92)} 0%, ${primary} 100%)`,
    color: "#fff",
  };
};

/** صندوق التواصل في صفحة 2 */
export const getContactBoxStyle = (
  templateId: string,
  primary: string,
  secondary: string,
): React.CSSProperties => {
  const id = normalizeTemplateId(templateId);
  if (id === "midnight_gold" || id === "copper_urban") {
    return {
      background: `linear-gradient(145deg, ${secondary} 0%, ${hexAlpha(primary, 0.2)} 100%)`,
      border: `1px solid ${hexAlpha(primary, 0.35)}`,
      color: "#fff",
    };
  }
  return {
    background: `linear-gradient(145deg, ${hexAlpha(primary, 0.95)} 0%, ${primary} 100%)`,
    color: "#fff",
  };
};
