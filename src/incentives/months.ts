export const MONTHS = [
  { value: 1, label: "كانون الثاني" },
  { value: 2, label: "شباط" },
  { value: 3, label: "آذار" },
  { value: 4, label: "نيسان" },
  { value: 5, label: "أيار" },
  { value: 6, label: "حزيران" },
  { value: 7, label: "تموز" },
  { value: 8, label: "آب" },
  { value: 9, label: "أيلول" },
  { value: 10, label: "تشرين الأول" },
  { value: 11, label: "تشرين الثاني" },
  { value: 12, label: "كانون الأول" },
];

export const monthLabel = (month: number): string =>
  MONTHS.find((item) => item.value === month)?.label || String(month);
