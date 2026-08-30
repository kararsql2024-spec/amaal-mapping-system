export const formatAmount = (amount: number): string =>
  new Intl.NumberFormat("en-US").format(Math.round(amount || 0));

export const formatSentence = (
  centerName?: string,
  companyName?: string,
  unitTypeName?: string,
  amount?: number,
): string => {
  const center = centerName?.trim() || "مركز غير محدد";
  const company = companyName?.trim() || "شركة غير محددة";
  const unitType = unitTypeName?.trim() || "وحدة غير محددة";
  const money = formatAmount(amount || 0);
  return `حافز ${center} ل${company} ل${unitType} يساوي ${money} د.ع`;
};
