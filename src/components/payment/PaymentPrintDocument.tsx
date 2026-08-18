"use client";

import React, { useMemo } from "react";
import {
  calculateInstallmentDurationLabel,
  formatPaymentDisplayDate,
} from "@/lib/payment-installments";
import { resolvePaymentTableLayout } from "@/lib/payment-print-layout";
import { resolvePaymentPrintTheme } from "@/lib/payment-print-styles";
import type { PaymentBookingRecord, PaymentInstallment, PaymentPrintSettings } from "@/lib/payment-types";

interface PaymentPrintDocumentProps {
  booking: PaymentBookingRecord;
  projectName: string;
  centerName?: string;
  centerLogoUrl?: string;
  projectLogoUrl?: string;
  printSettings?: PaymentPrintSettings;
}

const Field = ({
  label,
  value,
  labelColor,
  valueColor,
  valueClassName = "",
  fieldClassName = "",
}: {
  label: string;
  value: React.ReactNode;
  labelColor: string;
  valueColor?: string;
  valueClassName?: string;
  fieldClassName?: string;
}) => (
  <div className={`payment-print-field ${fieldClassName}`.trim()}>
    <span className="payment-print-field-label" style={{ color: labelColor }}>
      {label}
    </span>
    <span
      className={`payment-print-field-value ${valueClassName}`.trim()}
      style={{ color: valueColor }}
    >
      {value}
    </span>
  </div>
);

const formatUnitAddressPreview = (booking: PaymentBookingRecord, dynamicColor: string) => {
  if (booking.unit_type === "house") {
    return (
      <>
        Z: <span style={{ color: dynamicColor }}>{booking.zone}</span> B:{" "}
        <span style={{ color: dynamicColor }}>{booking.block}</span> T:{" "}
        <span style={{ color: dynamicColor }}>{booking.house_type}</span> NO:{" "}
        <span style={{ color: dynamicColor }}>{booking.house_num}</span>
      </>
    );
  }
  const displayFloor = booking.floor === "0" ? "G" : booking.floor;
  return (
    <>
      A: <span style={{ color: dynamicColor }}>{booking.building}</span> F:{" "}
      <span style={{ color: dynamicColor }}>{displayFloor}</span> P:{" "}
      <span style={{ color: dynamicColor }}>{booking.apartment}</span>
    </>
  );
};

export const PaymentPrintDocument = ({
  booking,
  projectName,
  centerName,
  centerLogoUrl,
  projectLogoUrl,
  printSettings = {},
}: PaymentPrintDocumentProps) => {
  const mergedSettings = useMemo(
    () => ({
      ...printSettings,
      logo_url: printSettings.logo_url || projectLogoUrl,
    }),
    [printSettings, projectLogoUrl],
  );

  const theme = resolvePaymentPrintTheme(mergedSettings);
  const cityLogoUrl = theme.logoUrl;

  const sortedInstallments = useMemo(
    () =>
      [...(booking.installments || [])].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
      ),
    [booking.installments],
  );

  const tableLayout = useMemo(
    () =>
      resolvePaymentTableLayout(sortedInstallments.length, {
        hasHousingRow: Boolean(booking.housing_condition_amount),
        showCommissionNote: Boolean(booking.show_commission_note),
      }),
    [sortedInstallments.length, booking.housing_condition_amount, booking.show_commission_note],
  );

  const tableWrapStyle = tableLayout.isCompact
    ? ({
        ["--payment-table-font-size" as string]: `${tableLayout.fontSize}px`,
        ["--payment-table-cell-padding" as string]: tableLayout.cellPadding,
        ["--payment-table-row-height" as string]: tableLayout.rowHeight,
        ["--payment-table-line-height" as string]: String(tableLayout.lineHeight),
      } as React.CSSProperties)
    : undefined;

  return (
    <div className="payment-print-root mx-auto" dir="rtl">
      <div className="payment-print-page">
        <div
          className={["payment-print-sheet", theme.themeClass].filter(Boolean).join(" ")}
          style={{
            ...theme.borderStyle,
            ["--payment-frame-color" as string]: theme.frameColor,
          }}
        >
          {cityLogoUrl && (
            <div className="payment-print-watermark" aria-hidden="true">
              <img src={cityLogoUrl} alt="" style={{ opacity: theme.watermarkOpacity }} />
            </div>
          )}

          <div className="payment-print-content">
            <header className="payment-print-header">
              {cityLogoUrl ? (
                <img src={cityLogoUrl} alt="" className="payment-print-header-logo" />
              ) : (
                <span className="payment-print-header-logo" />
              )}

              <div className="payment-print-header-center">
                <div className="payment-print-title-main" style={{ color: theme.frameColor }}>
                  {projectName}
                </div>
                {centerName && <div className="payment-print-title-sub">{centerName}</div>}
              </div>

              {centerLogoUrl ? (
                <img src={centerLogoUrl} alt="" className="payment-print-header-logo" />
              ) : (
                <span className="payment-print-header-logo" />
              )}
            </header>

            <div className="payment-print-title-form">استمارة تنظيم الدفعات</div>

            <div className="payment-print-grid-3">
              <Field
                label="اسم الزبون الكامل"
                value={booking.client_name}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
                valueClassName="payment-print-field-value-lg"
              />
              <Field
                label="رقم الهاتف 1"
                value={booking.phone1}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
              />
              <Field
                label="رقم الهاتف 2"
                value={booking.phone2}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
              />
            </div>

            <div className="payment-print-grid-2">
              <Field
                label="عنوان السكن الحالي"
                value={booking.address}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
              />
              <Field
                label="التحصيل الدراسي"
                value={booking.education}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
              />
            </div>

            <div className="payment-print-grid-unit">
              <Field
                label="نوع الوحدة السكنية"
                value={booking.unit_type === "house" ? "منزل" : "شقة سكنية"}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
              />
              <Field
                label="عنوان الوحدة السكنية"
                value={formatUnitAddressPreview(booking, theme.dynamicColor)}
                labelColor={theme.staticColor}
                valueClassName="payment-print-field-value-md payment-print-field-value-nowrap"
                fieldClassName="payment-print-field--unit-address"
              />
              <Field
                label={`المساحة ${booking.unit_type === "apartment" ? "(كلية / صافية)" : "(كلية)"}`}
                value={
                  <>
                    {booking.total_area} م²
                    {booking.unit_type === "apartment" && booking.net_area
                      ? ` / ${booking.net_area} م²`
                      : ""}
                  </>
                }
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
                valueClassName="payment-print-field-value-nowrap"
              />
              <Field
                label="مدة التسليم"
                value={`${booking.delivery_period} شهراً`}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
                valueClassName="payment-print-field-value-nowrap"
              />
            </div>

            <div className="payment-print-grid-3">
              <Field
                label="آلية المعرفة بالمشروع"
                value={booking.discovery_method || "—"}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
              />
              <Field
                label="صلة القرابة"
                value={booking.discovery_relation || "—"}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
              />
              <Field
                label="رقم الهاتف"
                value={booking.discovery_phone || "—"}
                labelColor={theme.staticColor}
                valueColor={theme.dynamicColor}
              />
            </div>

            {booking.show_commission_note && (
              <p className="payment-print-note">
                ملاحظة: عمولة الوسيط تصرف خلال مدة اقصاها 3 اشهر من تاريخ توقيع العقد, ويسقط حق
                الوسيط بالمطالبة بها نهائيا بعد انقضاء هذه المدة دون اي استثناء
              </p>
            )}

            <div className="payment-print-price-box">
              <div className="payment-print-price-label" style={{ color: theme.staticColor }}>
                السعر الإجمالي للوحدة السكنية
              </div>
              <div className="payment-print-price-value" style={{ color: theme.dynamicColor }}>
                {Number(booking.total_price).toLocaleString("en-US")} د.ع
              </div>
              <p className="payment-print-price-desc">
                يكون تسديد المبلغ اعلاه على شكل دفعات وحسب التفاصيل المدرجة ادناه:
              </p>
            </div>

            <div
              className={`payment-print-table-wrap${tableLayout.isCompact ? " payment-print-table-wrap--compact" : ""}`}
              style={tableWrapStyle}
            >
              <div className="payment-print-table-border">
                <table
                  className="payment-print-table"
                  style={tableLayout.isCompact ? undefined : { fontSize: `${tableLayout.fontSize}px` }}
                >
                  <thead>
                    <tr>
                      <th style={{ width: "8%" }}>ت</th>
                      <th style={{ width: "42%" }}>الدفعات</th>
                      <th style={{ width: "22%" }}>تاريخ التسديد</th>
                      <th style={{ width: "28%" }}>المبلغ (د.ع)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="text-center">1</td>
                      <td>دفعة توقيع العقد</td>
                      <td className="text-center">{formatPaymentDisplayDate(booking.created_at)}</td>
                      <td className="text-center tabular-nums">
                        {Number(booking.signing_amount).toLocaleString("en-US")}
                      </td>
                    </tr>
                    {sortedInstallments.map((inst: PaymentInstallment, idx: number) => (
                      <tr key={inst.id}>
                        <td className="text-center">{idx + 2}</td>
                        <td>
                          {inst.label}{" "}
                          {idx === sortedInstallments.length - 1
                            ? calculateInstallmentDurationLabel(inst.date)
                            : ""}
                        </td>
                        <td className="text-center">{inst.date.replace(/-/g, "/")}</td>
                        <td
                          className="text-center tabular-nums font-bold"
                          style={{ color: theme.dynamicColor }}
                        >
                          {Number(inst.amount).toLocaleString("en-US")}
                        </td>
                      </tr>
                    ))}
                    {booking.housing_condition_amount ? (
                      <tr>
                        <td colSpan={4} className="text-center" style={{ color: theme.dynamicColor }}>
                          مبلغ شرط السكن:{" "}
                          {Number(booking.housing_condition_amount).toLocaleString("en-US")} د.ع
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="payment-print-notes-box">
              <div className="payment-print-notes-box-head">ملاحظات إضافية:</div>
              <div className="payment-print-notes-box-body">
                {booking.notes || "لا توجد ملاحظات إضافية"}
              </div>
            </div>

            <p className="payment-print-consent">
              اطلعت ووافقت على تفاصيل الدفعات اعلاه ولأجل ذلك وقعت بتاريخ:{" "}
              {formatPaymentDisplayDate(booking.created_at)}
            </p>

            <div className="payment-print-signatures">
              <div className="payment-print-signature-box">
                <p>توقيع الموظف</p>
              </div>
              <div className="payment-print-signature-box">
                <p>توقيع المشتري</p>
              </div>
              <div className="payment-print-signature-box">
                <p>توقيع م. المركز التسويقي</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentPrintDocument;
