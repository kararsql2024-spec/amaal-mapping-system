import type { PaymentInstallment } from "@/lib/payment-types";

const MILLION_STEP = 1_000_000;
const REMAINDER_SPLIT_STEP = 2_000_000;

export const sumInstallmentAmounts = (installments: PaymentInstallment[]): number =>
  installments.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

export const calculatePaymentTotal = (
  signingAmount: number | string,
  installments: PaymentInstallment[],
): number => (Number(signingAmount) || 0) + sumInstallmentAmounts(installments);

export interface PaymentTotalValidationResult {
  ok: boolean;
  message?: string;
  expected?: number;
  actual?: number;
  difference?: number;
}

/** التوقيع + مجموع الدفعات يجب أن يساويا سعر البيع بالضبط */
export const validatePaymentTotals = (
  totalPrice: number | string,
  signingAmount: number | string,
  installments: PaymentInstallment[],
): PaymentTotalValidationResult => {
  const expected = Number(totalPrice) || 0;
  const actual = calculatePaymentTotal(signingAmount, installments);

  if (expected <= 0) {
    return {
      ok: false,
      message: "يرجى إدخال السعر الإجمالي",
      expected,
      actual,
      difference: expected - actual,
    };
  }

  if (actual !== expected) {
    const difference = expected - actual;
    return {
      ok: false,
      message:
        difference > 0
          ? `مجموع الدفعات (${actual.toLocaleString("en-US")} د.ع) أقل من سعر البيع (${expected.toLocaleString("en-US")} د.ع) بمقدار ${difference.toLocaleString("en-US")} د.ع`
          : `مجموع الدفعات (${actual.toLocaleString("en-US")} د.ع) أكبر من سعر البيع (${expected.toLocaleString("en-US")} د.ع) بمقدار ${Math.abs(difference).toLocaleString("en-US")} د.ع`,
      expected,
      actual,
      difference,
    };
  }

  return { ok: true, expected, actual, difference: 0 };
};

const distributeRemainderAmount = (
  baseMillion: number,
  diff: number,
  unlockedCount: number,
  unlockedIndex: number,
): number => {
  let currentAmount = baseMillion;

  if (unlockedCount >= 2) {
    if (unlockedIndex === unlockedCount - 2) {
      if (diff > 0 && diff % REMAINDER_SPLIT_STEP === 0) currentAmount += diff / 2;
    } else if (unlockedIndex === unlockedCount - 1) {
      if (diff > 0) {
        if (diff % REMAINDER_SPLIT_STEP === 0) currentAmount += diff / 2;
        else currentAmount += diff;
      }
    }
  } else if (unlockedIndex === unlockedCount - 1) {
    currentAmount += diff;
  }

  return Math.floor(currentAmount);
};

export const recalculateUnlockedInstallments = (
  currentInstallments: PaymentInstallment[],
  totalPrice: number | string,
  signingAmount: number | string,
): PaymentInstallment[] => {
  const price = Number(totalPrice) || 0;
  const signing = Number(signingAmount) || 0;
  const totalToDistribute = price - signing;

  const lockedSum = currentInstallments
    .filter((item) => item.isLocked)
    .reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const remainingToDistribute = totalToDistribute - lockedSum;
  const unlocked = currentInstallments.filter((item) => !item.isLocked);
  const unlockedCount = unlocked.length;

  if (unlockedCount === 0) {
    return currentInstallments;
  }

  const baseMillion =
    Math.floor(remainingToDistribute / unlockedCount / MILLION_STEP) * MILLION_STEP;
  const totalBase = baseMillion * unlockedCount;
  const diff = remainingToDistribute - totalBase;

  let unlockedIndex = 0;
  return currentInstallments.map((inst) => {
    if (inst.isLocked) {
      return inst;
    }

    const currentAmount = distributeRemainderAmount(
      baseMillion,
      diff,
      unlockedCount,
      unlockedIndex,
    );
    unlockedIndex++;

    return {
      ...inst,
      amount: currentAmount.toString(),
    };
  });
};

export const generateInstallments = (
  totalPrice: number | string,
  signingAmount: number | string,
  count: number,
  startDate = new Date(),
  intervalMonths = 6,
): PaymentInstallment[] => {
  const price = Number(totalPrice) || 0;
  const signing = Number(signingAmount) || 0;
  const totalToDistribute = price - signing;

  const baseMillion =
    Math.floor(totalToDistribute / count / MILLION_STEP) * MILLION_STEP;
  const totalBase = baseMillion * count;
  const diff = totalToDistribute - totalBase;

  const installments: PaymentInstallment[] = [];

  for (let i = 0; i < count; i++) {
    const currentAmount = distributeRemainderAmount(baseMillion, diff, count, i);
    const date = addMonths(startDate, (i + 1) * intervalMonths);

    installments.push({
      id: createInstallmentId(),
      date: formatDateOnly(date),
      amount: currentAmount.toString(),
      label: `الدفعة ${i + 1}`,
      isLocked: false,
    });
  }

  return installments;
};

export const createInstallmentId = (): string =>
  Math.random().toString(36).slice(2, 11);

export const addMonths = (date: Date, months: number): Date => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
};

export const formatDateOnly = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatPaymentDisplayDate = (
  date: Date | string,
  withTime = false,
): string => {
  const value = new Date(date);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  if (!withTime) return `${year}/${month}/${day}`;
  const hours = String(value.getHours()).padStart(2, "0");
  const minutes = String(value.getMinutes()).padStart(2, "0");
  return `${year}/${month}/${day} ${hours}:${minutes}`;
};

export const calculateInstallmentDurationLabel = (dateStr: string): string => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(0, 0, 0, 0);

  let months =
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;
  let res = "(بعد ";
  if (years > 0) res += `${years} سنة `;
  if (years > 0 && remainingMonths > 0) res += "و ";
  if (remainingMonths > 0) res += `${remainingMonths} شهر`;
  res += ")";
  return years > 0 || remainingMonths > 0 ? res : "";
};
