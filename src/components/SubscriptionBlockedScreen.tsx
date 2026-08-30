import React from "react";
import { AlertTriangle, Ban, CalendarClock, Phone, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandMark, BrandWordmark } from "@/components/layout/Brand";
import { formatSubscriptionDate } from "@/lib/center-subscription";

export type SubscriptionBlockReason = "expired" | "suspended" | "not_started";

export interface SubscriptionBlockedScreenProps {
  reason: SubscriptionBlockReason;
  centerName?: string;
  endDate?: string;
  notes?: string;
  onBackToLogin: () => void;
}

const BLOCK_CONTENT: Record<
  SubscriptionBlockReason,
  { title: string; description: string; icon: React.ReactNode; accent: string }
> = {
  expired: {
    title: "انتهى اشتراك هذا القسم",
    description:
      "لا يمكن الوصول إلى المخططات وبيانات المبيعات لأن فترة الاشتراك قد انتهت. يرجى التواصل مع مشرف النظام لتجديد الاشتراك.",
    icon: <CalendarClock size={36} strokeWidth={1.25} />,
    accent: "text-status-sold",
  },
  suspended: {
    title: "تم تعليق هذا القسم",
    description:
      "تم إيقاف وصول القسم مؤقتاً من قبل الإدارة. يرجى التواصل مع مشرف النظام لمعرفة السبب وإعادة التفعيل.",
    icon: <Ban size={36} strokeWidth={1.25} />,
    accent: "text-status-sold",
  },
  not_started: {
    title: "لم يبدأ اشتراك هذا القسم بعد",
    description:
      "فترة الاشتراك لم تبدأ بعد. يرجى التواصل مع مشرف النظام لتفعيل الحساب في الموعد المحدد.",
    icon: <AlertTriangle size={36} strokeWidth={1.25} />,
    accent: "text-status-reserved",
  },
};

export const SubscriptionBlockedScreen = ({
  reason,
  centerName,
  endDate,
  notes,
  onBackToLogin,
}: SubscriptionBlockedScreenProps) => {
  const content = BLOCK_CONTENT[reason];

  return (
    <div className="flex min-h-screen flex-col bg-background" dir="rtl">
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center px-5 lg:px-8">
          <div className="flex items-center gap-2.5">
            <BrandMark />
            <BrandWordmark />
          </div>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-lg border border-line bg-surface p-8 text-center shadow-sm sm:p-10">
          <div
            className={`mx-auto mb-6 flex size-20 items-center justify-center rounded-full border border-line bg-background ${content.accent}`}
          >
            {content.icon}
          </div>

          <p className="eyebrow text-status-sold">الوصول غير متاح</p>
          <h1 className="mt-3 text-2xl font-normal leading-snug text-fg sm:text-[28px]">
            {content.title}
          </h1>

          {centerName ? (
            <p className="mt-4 inline-block rounded-full border border-line bg-background px-4 py-1.5 text-[13px] font-medium text-fg-secondary">
              {centerName}
            </p>
          ) : null}

          <p className="mt-5 text-[13px] leading-relaxed text-fg-muted">
            {content.description}
          </p>

          {(reason === "expired" && endDate) || notes ? (
            <div className="mt-6 space-y-2 border border-dashed border-line bg-background/60 px-4 py-4 text-start text-[12px]">
              {reason === "expired" && endDate ? (
                <p className="text-fg-secondary">
                  <span className="font-medium text-fg">تاريخ انتهاء الاشتراك: </span>
                  {formatSubscriptionDate(endDate)}
                </p>
              ) : null}
              {notes ? (
                <p className="text-fg-secondary">
                  <span className="font-medium text-fg">ملاحظة الإدارة: </span>
                  {notes}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-center gap-2 text-[12px] text-fg-muted">
            <Phone size={14} className="shrink-0" />
            <span>للتجديد أو الاستفسار، تواصل مع مشرف النظام</span>
          </div>

          <Button
            type="button"
            variant="outline"
            size="lg"
            className="mt-8 w-full gap-2"
            onClick={onBackToLogin}
          >
            <LogIn size={16} />
            العودة لتسجيل الدخول
          </Button>
        </div>
      </div>

      <footer className="border-t border-line">
        <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between px-5 lg:px-8">
          <span className="eyebrow">Amaal</span>
          <span className="text-[11px] text-fg-faint">برمجة وتطوير: كرار عبدالكريم</span>
        </div>
      </footer>
    </div>
  );
};
