/** عند تجاوز هذا العدد تُفعَّل ضغط صفوف جدول الدفعات */
export const PAYMENT_TABLE_COMPACT_THRESHOLD = 10;

/** مساحة تقديرية لجسم الجدول داخل صفحة A4 بعد الحقول الثابتة */
const COMPACT_TABLE_BODY_BUDGET_PX = 400;
const COMPACT_TABLE_HEADER_PX = 24;

export interface PaymentTableLayout {
  isCompact: boolean;
  fontSize: number;
  cellPadding: string;
  rowHeight?: string;
  lineHeight: number;
}

export function resolvePaymentTableLayout(
  installmentCount: number,
  options?: { hasHousingRow?: boolean; showCommissionNote?: boolean },
): PaymentTableLayout {
  const hasHousingRow = options?.hasHousingRow ?? false;
  const showCommissionNote = options?.showCommissionNote ?? false;
  const dataRowCount = 1 + installmentCount + (hasHousingRow ? 1 : 0);
  const isCompact = installmentCount > PAYMENT_TABLE_COMPACT_THRESHOLD;

  if (!isCompact) {
    return {
      isCompact: false,
      fontSize: Math.max(10, Math.min(18, Math.floor(520 / (dataRowCount + 10)))),
      cellPadding: "4px 6px",
      lineHeight: 1.35,
    };
  }

  const bodyBudget =
    COMPACT_TABLE_BODY_BUDGET_PX - (showCommissionNote ? 28 : 0);
  const availableForRows = bodyBudget - COMPACT_TABLE_HEADER_PX;
  const rowHeightPx = Math.max(11, Math.floor(availableForRows / dataRowCount));
  const fontSize = Math.max(7, Math.min(11, rowHeightPx - 4));
  const paddingY = Math.max(0, Math.floor((rowHeightPx - fontSize * 1.08) / 2));

  return {
    isCompact: true,
    fontSize,
    cellPadding: `${paddingY}px 4px`,
    rowHeight: `${rowHeightPx}px`,
    lineHeight: 1.08,
  };
}
