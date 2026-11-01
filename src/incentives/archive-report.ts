import { applyUnitOverrides, monthKeyOf } from "./engine";
import { monthLabel } from "./months";
import type { Center, IncentiveResult, MonthSnapshot, UnitCenterOverride } from "./types";

export const MAX_REPORT_MONTHS = 36;

export interface ReportSlice {
  name: string;
  count: number;
  amount: number;
}

export interface ArchiveMonthLine {
  monthKey: string;
  label: string;
  saved: boolean;
  savedAt: string;
  includedCount: number;
  amount: number;
}

export interface ArchiveReport {
  months: ArchiveMonthLine[];
  savedCount: number;
  missingCount: number;
  includedCount: number;
  totalAmount: number;
  byCenter: ReportSlice[];
  byCompany: ReportSlice[];
  byCity: ReportSlice[];
  byUnitType: ReportSlice[];
  centerName: string;
  truncated: boolean;
}

const parseMonthKey = (key: string): { year: number; month: number } => {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
};

export const listMonthKeys = (fromKey: string, toKey: string): { keys: string[]; truncated: boolean } => {
  const start = parseMonthKey(fromKey);
  const end = parseMonthKey(toKey);
  const keys: string[] = [];
  let year = start.year;
  let month = start.month;
  let truncated = false;
  while (year < end.year || (year === end.year && month <= end.month)) {
    if (keys.length >= MAX_REPORT_MONTHS) {
      truncated = true;
      break;
    }
    keys.push(monthKeyOf(year, month));
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
  return { keys, truncated };
};

export const monthTitle = (monthKey: string): string => {
  const { year, month } = parseMonthKey(monthKey);
  return `${monthLabel(month)} ${year}`;
};

const slicesOf = (
  rows: IncentiveResult[],
  pick: (result: IncentiveResult) => string,
): ReportSlice[] => {
  const map = new Map<string, ReportSlice>();
  rows.forEach((result) => {
    const name = pick(result).trim() || "غير محدد";
    const current = map.get(name) || { name, count: 0, amount: 0 };
    current.count += 1;
    current.amount += result.amount;
    map.set(name, current);
  });
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "ar"));
};

const belongsToCenter = (result: IncentiveResult, centerId: string): boolean => {
  if (!centerId) return true;
  return result.center?.id === centerId;
};

export const buildArchiveReport = (
  snapshots: MonthSnapshot[],
  overrides: UnitCenterOverride[],
  centers: Center[],
  fromKey: string,
  toKey: string,
  centerId = "",
): ArchiveReport => {
  const { keys, truncated } = listMonthKeys(fromKey, toKey);
  const savedByKey = new Map(snapshots.map((item) => [item.monthKey, item]));
  const archivedCenterName = centerId
    ? snapshots.flatMap((snapshot) => snapshot.results).find((result) => result.center?.id === centerId)?.center?.name || ""
    : "";
  const centerName = centerId
    ? centers.find((center) => center.id === centerId)?.name || archivedCenterName
    : "";
  const included: IncentiveResult[] = [];
  const months = keys.map((monthKey) => {
    const snap = savedByKey.get(monthKey);
    if (!snap) {
      return {
        monthKey,
        label: monthTitle(monthKey),
        saved: false,
        savedAt: "",
        includedCount: 0,
        amount: 0,
      };
    }
    const rows = applyUnitOverrides(snap.results, overrides, monthKey, centers)
      .filter((result) => result.included && belongsToCenter(result, centerId));
    included.push(...rows);
    return {
      monthKey,
      label: monthTitle(monthKey),
      saved: true,
      savedAt: snap.savedAt,
      includedCount: rows.length,
      amount: rows.reduce((sum, result) => sum + result.amount, 0),
    };
  });
  return {
    months,
    savedCount: months.filter((item) => item.saved).length,
    missingCount: months.filter((item) => !item.saved).length,
    includedCount: included.length,
    totalAmount: included.reduce((sum, result) => sum + result.amount, 0),
    byCenter: slicesOf(included, (result) => result.center?.name || "غير محدد"),
    byCompany: slicesOf(included, (result) => result.company?.name || "غير محدد"),
    byCity: slicesOf(included, (result) => result.row.city || "مدينة غير معروفة"),
    byUnitType: slicesOf(included, (result) => result.unitType?.name || "غير محدد"),
    centerName,
    truncated,
  };
};

export interface ArchivePrintLine {
  name: string;
  count: number;
  amount: number;
}

export interface ArchivePrintMonth {
  label: string;
  saved: boolean;
  count: number;
  amount: number;
}

export interface ArchivePrintGroup {
  name: string;
  count: number;
  amount: number;
  types: ArchivePrintLine[];
}

export interface ArchivePrintCenter {
  id: string;
  name: string;
  count: number;
  amount: number;
  months: ArchivePrintMonth[];
  companies: ArchivePrintGroup[];
  cities: ArchivePrintGroup[];
}

export interface ArchivePrintModel {
  periodLabel: string;
  centerName: string;
  truncated: boolean;
  savedCount: number;
  missingCount: number;
  includedCount: number;
  totalAmount: number;
  months: ArchivePrintMonth[];
  centers: ArchivePrintCenter[];
}

const byAr = (a: string, b: string) => a.localeCompare(b, "ar", { numeric: true });

const typeLines = (rows: IncentiveResult[], unitTypeNames: string[]): ArchivePrintLine[] => {
  const map = new Map<string, ArchivePrintLine>();
  rows.forEach((result) => {
    const name = result.unitType?.name?.trim() || "غير محدد";
    const current = map.get(name) || { name, count: 0, amount: 0 };
    current.count += 1;
    current.amount += result.amount;
    map.set(name, current);
  });
  const ordered: ArchivePrintLine[] = [];
  unitTypeNames.forEach((name) => {
    const line = map.get(name);
    if (!line) return;
    ordered.push(line);
    map.delete(name);
  });
  Array.from(map.values())
    .sort((a, b) => byAr(a.name, b.name))
    .forEach((line) => ordered.push(line));
  return ordered;
};

const groupsOf = (
  rows: IncentiveResult[],
  pick: (result: IncentiveResult) => string,
  unitTypeNames: string[],
): ArchivePrintGroup[] => {
  const map = new Map<string, IncentiveResult[]>();
  rows.forEach((result) => {
    const name = pick(result).trim() || "غير محدد";
    const list = map.get(name) || [];
    list.push(result);
    map.set(name, list);
  });
  return Array.from(map.entries())
    .map(([name, list]) => ({
      name,
      count: list.length,
      amount: list.reduce((sum, result) => sum + result.amount, 0),
      types: typeLines(list, unitTypeNames),
    }))
    .sort((a, b) => byAr(a.name, b.name));
};

export const buildArchivePrint = (
  snapshots: MonthSnapshot[],
  overrides: UnitCenterOverride[],
  centers: Center[],
  fromKey: string,
  toKey: string,
  unitTypeNames: string[],
  periodLabel: string,
  centerId = "",
): ArchivePrintModel => {
  const { keys, truncated } = listMonthKeys(fromKey, toKey);
  const savedByKey = new Map(snapshots.map((item) => [item.monthKey, item]));
  const archivedCenterName = centerId
    ? snapshots.flatMap((snapshot) => snapshot.results).find((result) => result.center?.id === centerId)?.center?.name || ""
    : "";
  const centerName = centerId
    ? centers.find((center) => center.id === centerId)?.name || archivedCenterName
    : "";
  const tagged: Array<{ monthKey: string; result: IncentiveResult }> = [];
  const months = keys.map((monthKey) => {
    const snap = savedByKey.get(monthKey);
    if (!snap) {
      return { label: monthTitle(monthKey), saved: false, count: 0, amount: 0 };
    }
    const rows = applyUnitOverrides(snap.results, overrides, monthKey, centers)
      .filter((result) => result.included && belongsToCenter(result, centerId));
    rows.forEach((result) => tagged.push({ monthKey, result }));
    return {
      label: monthTitle(monthKey),
      saved: true,
      count: rows.length,
      amount: rows.reduce((sum, result) => sum + result.amount, 0),
    };
  });
  const centerMap = new Map<string, { name: string; rows: IncentiveResult[]; byMonth: Map<string, IncentiveResult[]> }>();
  tagged.forEach(({ monthKey, result }) => {
    const id = result.center?.id || "__none__";
    const current = centerMap.get(id) || {
      name: result.center?.name?.trim() || "بدون مركز",
      rows: [],
      byMonth: new Map<string, IncentiveResult[]>(),
    };
    current.rows.push(result);
    const bucket = current.byMonth.get(monthKey) || [];
    bucket.push(result);
    current.byMonth.set(monthKey, bucket);
    centerMap.set(id, current);
  });
  let printCenters: ArchivePrintCenter[] = Array.from(centerMap.entries())
    .map(([id, center]) => ({
      id,
      name: center.name,
      count: center.rows.length,
      amount: center.rows.reduce((sum, result) => sum + result.amount, 0),
      months: keys.map((monthKey) => {
        const rows = center.byMonth.get(monthKey) || [];
        return {
          label: monthTitle(monthKey),
          saved: savedByKey.has(monthKey),
          count: rows.length,
          amount: rows.reduce((sum, result) => sum + result.amount, 0),
        };
      }),
      companies: groupsOf(center.rows, (result) => result.company?.name || "بدون شركة", unitTypeNames),
      cities: groupsOf(center.rows, (result) => result.row.city || "مدينة غير معروفة", unitTypeNames),
    }))
    .sort((a, b) => byAr(a.name, b.name));
  if (centerId && printCenters.length === 0) {
    printCenters = [{
      id: centerId,
      name: centerName || "مركز غير محدد",
      count: 0,
      amount: 0,
      months,
      companies: [],
      cities: [],
    }];
  }
  const included = tagged.map((item) => item.result);
  return {
    periodLabel,
    centerName,
    truncated,
    savedCount: months.filter((item) => item.saved).length,
    missingCount: months.filter((item) => !item.saved).length,
    includedCount: included.length,
    totalAmount: included.reduce((sum, result) => sum + result.amount, 0),
    months,
    centers: printCenters,
  };
};
