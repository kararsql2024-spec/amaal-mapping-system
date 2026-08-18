/**
 * Number, price and currency formatting.
 *
 * Previously duplicated verbatim in Reports.tsx and DetailedStatsTable.tsx.
 * The implementations below are the same logic, moved not rewritten.
 */

export type CurrencyType = "IQD" | "USD";

/** Strips separators and non-numeric characters, then parses. Never returns NaN. */
export const parsePrice = (price: unknown): number => {
  if (price === null || price === undefined) return 0;
  const cleaned = price.toString().replace(/,/g, "").replace(/[^\d.]/g, "");
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
};

/** Resolves free-text currency values (Arabic or Latin) to a known type. */
export const getCurrencyType = (curr: unknown): CurrencyType => {
  if (!curr) return "IQD";
  const c = curr.toString().trim().toLowerCase();
  if (
    c.includes("دينار") ||
    c.includes("iqd") ||
    c.includes("د.ع") ||
    c.includes("عراقي")
  )
    return "IQD";
  if (c.includes("دولار") || c.includes("usd") || c.includes("$")) return "USD";
  return "IQD";
};

/** Grouped integer, Latin digits (kept for alignment in tables and charts). */
export const formatNumber = (num: number): string =>
  new Intl.NumberFormat("en-US").format(Math.round(num));

/** Abbreviated form for chart axes. */
export const formatCompactNumber = (value: number): string => {
  if (value >= 1e9) return (value / 1e9).toFixed(1) + " مليار";
  if (value >= 1e6) return (value / 1e6).toFixed(1) + " مليون";
  return formatNumber(value);
};

export const CURRENCY_SUFFIX: Record<CurrencyType, string> = {
  IQD: "د.ع",
  USD: "$",
};

/** Formats an amount with its currency marker on the correct side. */
export const formatMoney = (value: number, currency: CurrencyType): string =>
  currency === "USD"
    ? `$${formatNumber(value)}`
    : `${formatNumber(value)} د.ع`;
