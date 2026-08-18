import React from "react";
import {
  Bed,
  Calendar,
  CreditCard,
  FileImage,
  Maximize,
  Phone,
  Sparkle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrochureConfig, BrochureUnitDetail } from "@/lib/brochure-types";
import type { CenterBrochureProfile } from "@/lib/center-brochure";
import { normalizeTemplateId } from "@/lib/brochure-types";
import { BrandMark, BrandWordmark } from "@/components/layout/Brand";
import {
  TemplateBackground,
  isCoverHeaderLight,
  getSpecBarStyle,
  getContactBoxStyle,
} from "./TemplateBackgrounds";
import "@/styles/brochure-print.css";

export interface BrochureDocumentProps {
  config: BrochureConfig;
  projectName: string;
  specKey: string;
  specArea: string;
  unitLabel?: string;
  footerLeft?: string;
  centerProfile?: CenterBrochureProfile;
  centerName?: string;
  className?: string;
}

const BrochurePageShell = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "brochure-page relative flex shrink-0 flex-col justify-between overflow-hidden bg-white p-14 text-right shadow-2xl print:shadow-none",
      className,
    )}
    style={{
      width: "210mm",
      height: "297mm",
      fontFamily: '"IBM Plex Sans Arabic", sans-serif',
    }}
  >
    {children}
  </div>
);

const BrochureHeader = ({
  config,
  projectName,
  centerProfile,
  centerName,
  light,
}: {
  config: BrochureConfig;
  projectName: string;
  centerProfile?: CenterBrochureProfile;
  centerName?: string;
  light?: boolean;
}) => (
  <div className="relative z-10 flex items-center justify-between">
    {centerProfile?.marketingLogo ? (
      <img
        src={centerProfile.marketingLogo}
        alt={centerName || "القسم"}
        className="h-14 max-w-[140px] object-contain"
      />
    ) : (
      <div className={cn("flex items-center gap-2", light && "text-white")}>
        <BrandMark className={cn("h-5 w-5", light && "text-white")} />
        <div className={cn("min-w-0", light && "text-white")}>
          <BrandWordmark className={light ? "text-white [&_span]:text-white/80" : undefined} />
          {centerName ? (
            <span className={cn("mt-0.5 block truncate text-[10px]", light ? "text-white/70" : "text-[#9CA3AF]")}>
              {centerName}
            </span>
          ) : null}
        </div>
      </div>
    )}

    {config.projectLogo ? (
      <img
        src={config.projectLogo}
        alt="المشروع"
        className="h-14 max-w-[140px] object-contain"
      />
    ) : (
      <div
        className={cn(
          "flex items-center gap-2 border-s ps-4",
          light ? "border-white/30 text-white" : "border-[#E8EAEC] text-[#304653]",
        )}
      >
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: config.primaryColor || "#1B6B52" }}
        >
          {projectName.charAt(0)}
        </div>
        <span className="max-w-[120px] truncate text-xs font-semibold">{projectName}</span>
      </div>
    )}
  </div>
);

const ImageSlot = ({
  src,
  alt,
  placeholder,
  className,
}: {
  src?: string;
  alt: string;
  placeholder: string;
  className?: string;
}) => (
  <div className={cn("relative overflow-hidden rounded-xl bg-[#F0F2F4]", className)}>
    {src ? (
      <>
        <img src={src} alt={alt} className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
      </>
    ) : (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[#9CA3AF]">
        <FileImage size={36} strokeWidth={1.25} />
        <span className="px-4 text-center text-[11px] font-medium">{placeholder}</span>
      </div>
    )}
  </div>
);

export const BrochureDocument = ({
  config,
  projectName,
  specKey,
  specArea,
  unitLabel,
  footerLeft,
  centerProfile,
  centerName,
  className,
}: BrochureDocumentProps) => {
  const primary = config.primaryColor || "#1B6B52";
  const secondary = config.secondaryColor || "#F4F9F6";
  const templateId = normalizeTemplateId(config.selectedTemplate);
  const lightHeader = isCoverHeaderLight(templateId);
  const specDetails: BrochureUnitDetail = config.unitDetails?.[specKey] || {};
  const advantages = config.advantages?.[specKey] || [];
  const issueDate = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  return (
    <div className={cn("brochure-print-root flex flex-col items-center gap-10 print:gap-0", className)}>
      {/* ── Page 1: Cover ── */}
      <BrochurePageShell>
        <TemplateBackground
          templateId={templateId}
          primary={primary}
          secondary={secondary}
          page={1}
        />

        <BrochureHeader
          config={config}
          projectName={projectName}
          centerProfile={centerProfile}
          centerName={centerName}
          light={lightHeader}
        />

        <div className="relative z-10 my-auto space-y-7">
          <div className="space-y-4">
            <span
              className="inline-block rounded-full px-4 py-1.5 text-[11px] font-semibold tracking-wide text-white"
              style={{ backgroundColor: primary }}
            >
              بروشور مبيعات رسمي
            </span>

            <h1
              className={cn(
                "text-[42px] font-bold leading-[1.15] tracking-tight",
                lightHeader ? "text-white" : "text-[#1A1A1A]",
              )}
            >
              اكتشف وحدتك السكنية
              <br />
              <span style={{ color: lightHeader ? "#E8ECF0" : primary }}>{projectName}</span>
            </h1>

            {unitLabel && (
              <p className={cn("text-sm font-medium", lightHeader ? "text-white/75" : "text-[#6B7280]")}>
                {unitLabel}
              </p>
            )}

            <p
              className={cn(
                "max-w-xl border-s-4 ps-4 text-[15px] leading-relaxed",
                lightHeader
                  ? "border-white/40 text-white/85"
                  : "border-[#D1D5DB] text-[#4B5563]",
              )}
            >
              {config.slogan ||
                "حيث تلتقي الرفاهية المعمارية مع فرصة استثمارية موثوقة."}
            </p>
          </div>

          {specDetails.unitDescription && (
            <p className="max-w-2xl rounded-xl border border-[#E8EAEC] bg-white/80 p-4 text-[13px] leading-relaxed text-[#374151] backdrop-blur-sm">
              {specDetails.unitDescription}
            </p>
          )}

          <div className="grid grid-cols-12 gap-3">
            <ImageSlot
              src={specDetails.unitImage}
              alt="الواجهة الخارجية"
              placeholder="صورة الواجهة الخارجية للمشروع"
              className={cn(
                specDetails.unitImage2 ? "col-span-8 h-[260px]" : "col-span-12 h-[300px]",
              )}
            />
            {specDetails.unitImage2 && (
              <ImageSlot
                src={specDetails.unitImage2}
                alt="الواجهة الثانية"
                placeholder=""
                className="col-span-4 h-[260px]"
              />
            )}
          </div>

          <div
            className="flex items-center justify-between rounded-xl px-6 py-5"
            style={getSpecBarStyle(templateId, primary, secondary)}
          >
            <div>
              <span className="text-[11px] font-medium opacity-80">فئة الوحدة</span>
              <h4 className="text-lg font-bold">{specKey || "—"}</h4>
            </div>
            <div className="text-left">
              <span className="text-[11px] font-medium opacity-80">المساحة الكلية</span>
              <h4 className="text-xl font-bold tabular-nums">{specArea || "—"}</h4>
            </div>
          </div>
        </div>

        <div
          className={cn(
            "relative z-10 flex items-center justify-between border-t pt-6 text-[11px]",
            lightHeader ? "border-white/20 text-white/60" : "border-[#E8EAEC] text-[#9CA3AF]",
          )}
        >
          <span>{footerLeft ?? "RealKarar — إدارة الوحدات السكنية"}</span>
          <span className={cn("rounded-lg px-3 py-1.5 font-medium tabular-nums", lightHeader ? "bg-white/10 text-white" : "bg-[#F5F6F7] text-[#374151]")}>
            {issueDate}
          </span>
        </div>
      </BrochurePageShell>

      {/* ── Page 2: Details ── */}
      <BrochurePageShell>
        <TemplateBackground
          templateId={templateId}
          primary={primary}
          secondary={secondary}
          page={2}
        />

        <div className="relative z-10 flex items-center justify-between border-b border-[#E8EAEC] pb-5">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: primary }}>
              التفاصيل المالية والمواصفات
            </h2>
            <p className="mt-1 text-[11px] text-[#9CA3AF]">صنف {specKey || "—"} — {projectName}</p>
          </div>
          <span
            className="rounded-full px-4 py-1.5 text-[11px] font-semibold tabular-nums"
            style={{ backgroundColor: `${primary}14`, color: primary }}
          >
            {specKey || "—"}
          </span>
        </div>

        <div className="relative z-10 my-auto grid grid-cols-2 gap-7">
          {/* Right column */}
          <div className="space-y-5">
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#1A1A1A]">
                <Bed size={16} style={{ color: primary }} />
                توزيع الغرف والمرافق
              </h3>
              <div className="overflow-hidden rounded-xl border border-[#E8EAEC]">
                <div
                  className="flex items-center justify-between px-3.5 py-2.5 text-[11px] font-semibold text-white"
                  style={{ background: primary }}
                >
                  <span>المرفق</span>
                  <span>التفاصيل</span>
                </div>
                <div className="flex items-center justify-between border-b px-3 py-2.5 text-[11px]">
                  <span className="text-[#6B7280]">توزيع الغرف</span>
                  <span className="max-w-[55%] text-left font-semibold text-[#1A1A1A]">
                    {specDetails.rooms || "4 غرف نوم + 3 حمامات + صالة"}
                  </span>
                </div>
                <div className="flex items-center justify-between bg-[#FAFAFA] px-3 py-2.5 text-[11px]">
                  <span className="text-[#6B7280]">مساحات الغرف</span>
                  <span className="max-w-[55%] text-left font-semibold text-[#1A1A1A]">
                    {specDetails.roomsSizes || "صالة 6×4، نوم 5×4، مطبخ 4×4"}
                  </span>
                </div>
              </div>
            </section>

            {advantages.length > 0 && (
              <section className="space-y-2">
                <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#1A1A1A]">
                  <Sparkle size={16} style={{ color: primary }} />
                  المزايا الخاصة
                </h3>
                <ul className="space-y-2 rounded-xl border border-[#E8EAEC] bg-[#FAFAFA] p-4">
                  {advantages.map((adv, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-[11px] leading-relaxed text-[#374151]">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: primary }}
                      />
                      {adv}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#1A1A1A]">
                <CreditCard size={16} style={{ color: primary }} />
                خطة الدفعات
              </h3>
              <div className="overflow-hidden rounded-xl border border-[#E8EAEC] shadow-sm">
                <div
                  className="flex items-center justify-between px-3.5 py-2.5 text-[11px] font-semibold text-white"
                  style={{ background: `linear-gradient(90deg, ${primary}, ${primary}CC)` }}
                >
                  <span>البند</span>
                  <span>المبلغ</span>
                </div>
                <div className="flex items-center justify-between border-b px-3 py-2.5 text-[11px]">
                  <span className="text-[#6B7280]">السعر الإجمالي</span>
                  <span className="font-bold tabular-nums" style={{ color: primary }}>
                    {specDetails.totalPrice || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b bg-[#FAFAFA] px-3 py-2.5 text-[11px]">
                  <span className="text-[#6B7280]">مبلغ العقد</span>
                  <span className="font-bold tabular-nums text-[#1A1A1A]">
                    {specDetails.contractAmount || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2.5 text-[11px]">
                  <span className="text-[#6B7280]">مدة التسديد</span>
                  <span className="max-w-[55%] text-left font-bold text-[#1A1A1A]">
                    {specDetails.paymentDuration || "—"}
                  </span>
                </div>
              </div>
              {specDetails.paymentPlanDetails && (
                <p className="rounded-lg border border-amber-100 bg-amber-50/80 p-2.5 text-[10px] leading-relaxed text-amber-900">
                  <strong>ملاحظات:</strong> {specDetails.paymentPlanDetails}
                </p>
              )}
            </section>
          </div>

          {/* Left column */}
          <div className="flex flex-col justify-between gap-5">
            <section className="space-y-2">
              <h3 className="flex items-center gap-2 text-[14px] font-bold text-[#1A1A1A]">
                <Maximize size={16} style={{ color: primary }} />
                مخطط الطابق
              </h3>
              <div className="flex h-[320px] items-center justify-center overflow-hidden rounded-xl border border-[#E8EAEC] bg-[#FAFAFA] p-3">
                {specDetails.housePlan ? (
                  <img
                    src={specDetails.housePlan}
                    alt="House Plan"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="space-y-2 text-center text-[#9CA3AF]">
                    <Maximize size={28} className="mx-auto opacity-40" />
                    <p className="text-[11px]">أضف مخطط الطابق من لوحة التحكم</p>
                  </div>
                )}
              </div>
            </section>

            <div className="space-y-3 rounded-xl p-5" style={getContactBoxStyle(templateId, primary, secondary)}>
              <div className="flex items-center gap-2 border-b border-white/20 pb-2">
                <Calendar size={15} className="opacity-90" />
                <h4 className="text-[12px] font-bold">احجز موعد المعاينة</h4>
              </div>
              <p className="text-[10px] leading-relaxed opacity-85">
                تواصل مع قسم المبيعات للحجز والاستفسار عن التسهيلات التمويلية.
              </p>
              <div className="flex flex-wrap gap-2">
                {centerProfile?.phone && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/20 px-3 py-1.5 text-[11px] font-semibold tabular-nums">
                    <Phone size={12} /> {centerProfile.phone}
                  </span>
                )}
                {centerProfile?.phone2 && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-black/20 px-3 py-1.5 text-[11px] font-semibold tabular-nums">
                    <Phone size={12} /> {centerProfile.phone2}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t border-[#E8EAEC] pt-5 text-[11px] text-[#9CA3AF]">
          <span>{footerLeft ?? "RealKarar"}</span>
          <span className="tabular-nums">2 / 2</span>
        </div>
      </BrochurePageShell>
    </div>
  );
};

/** غلاف المعاينة في لوحة Admin — يقلّص A4 لتناسب الشاشة */
export const BrochurePreviewFrame = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "overflow-x-auto rounded-lg bg-[#1A1A1A] p-6",
      className,
    )}
  >
    <div
      className="mx-auto origin-top"
      style={{ transform: "scale(0.55)", transformOrigin: "top center", width: "210mm" }}
    >
      {children}
    </div>
  </div>
);
