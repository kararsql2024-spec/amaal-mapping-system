import type { IncentiveSettings } from "@/incentives/types";
import { getCurrencyType, parsePrice, type CurrencyType } from "@/lib/format";
import {
  buildUnitCatalog,
  groupFollowupUnits,
  resolveMarketingCenter,
  type CatalogEntry,
  type FollowupInstallment,
  type FollowupRecord,
} from "@/lib/payment-followup";
import { getApartmentSize, getHouseClass, getZone, forEachTowerUnit } from "@/lib/units";
import type { MapElement } from "@/types/project";

export interface ReportUnit {
  key: string;
  projectId: string;
  projectName: string;
  kind: "house" | "apartment";
  zone: string;
  towerId: string;
  towerLabel: string;
  typeKey: string;
  typeLabel: string;
  status: string;
  systemPrice: number;
  systemCurrency: CurrencyType;
  saleDate: string;
  tabo: string;
  handover: boolean;
  centerName: string;
  /** المشروع رُفع له ملف دفعات. */
  fileReady: boolean;
  /** مباعة أو استثمار، والتحصيل معروف من الملف. */
  tracked: boolean;
  paidInFull: boolean;
  filePrice: number;
  received: number;
  remaining: number;
  fileCurrency: CurrencyType;
  installments: FollowupInstallment[];
  /** مجمدة تُحسب ضمن الإجمالي، مثل التقارير السابقة. */
  frozenCounted: boolean;
  /** مجمدة تُذكر في عداد التجميد وتخرج من الإجمالي. */
  frozenUncounted: boolean;
}

export interface ReportFilters {
  zones: string[];
  towers: string[];
  types: string[];
  investors: "with" | "without";
  center: string;
  currency: "all" | CurrencyType;
  saleFrom: string;
  saleTo: string;
  settlement: "all" | "remaining" | "paid";
}

export const EMPTY_REPORT_FILTERS: ReportFilters = {
  zones: [],
  towers: [],
  types: [],
  investors: "with",
  center: "all",
  currency: "all",
  saleFrom: "",
  saleTo: "",
  settlement: "all",
};

const saleDay = (value: string): string => {
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(String(value || "").trim());
  if (iso) return iso[1];
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
};

export const inDayRange = (value: string, from: string, to: string): boolean => {
  if (!from && !to) return true;
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
};

export const currencyOn = (filter: ReportFilters["currency"], currency: CurrencyType): boolean =>
  filter === "all" || filter === currency;

/** فلاتر الوحدة: الزون للمنزل، العمارة للشقة، والنوع يجمع الاثنين. */
export const matchStructure = (unit: ReportUnit, filters: ReportFilters): boolean => {
  if (filters.investors === "without" && unit.status === "investment") return false;
  if (filters.center !== "all" && unit.centerName !== filters.center) return false;
  if (unit.kind === "house" && filters.zones.length > 0 && !filters.zones.includes(unit.zone)) return false;
  if (unit.kind === "apartment" && filters.towers.length > 0 && !filters.towers.includes(unit.towerId)) return false;
  if (filters.types.length > 0 && !filters.types.includes(unit.typeKey)) return false;
  return true;
};

const soldLike = (status: string): boolean => status === "sold" || status === "investment";

/** تصفية السداد تخص الواصل والمتبقي. الوحدة بلا ملف لا تدخل أي الطرفين. */
export const matchSettlement = (unit: ReportUnit, filters: ReportFilters): boolean => {
  if (!unit.tracked) return false;
  if (filters.settlement === "paid") return unit.paidInFull;
  if (filters.settlement === "remaining") return !unit.paidInFull;
  return true;
};

export const buildReportUnits = (
  elements: MapElement[],
  housesData: Record<string, { status?: string; price?: string; currency?: string; saleDate?: string; taboStatus?: string; handoverDate?: string }>,
  rows: FollowupRecord[],
  settings: IncentiveSettings | null,
  centers: { id: string; name: string }[],
): ReportUnit[] => {
  const byProject = new Map<string, MapElement[]>();
  elements.forEach((element) => {
    const projectId = element._projectId || "";
    const list = byProject.get(projectId) || [];
    list.push(element);
    byProject.set(projectId, list);
  });

  const followupByUnit = new Map<string, ReturnType<typeof groupFollowupUnits>[number]>();
  const catalogByUnit = new Map<string, CatalogEntry>();
  const fileReady = new Set<string>();
  byProject.forEach((projectElements, projectId) => {
    const projectRows = rows.filter((row) => row.project_id === projectId);
    if (projectRows.length > 0) fileReady.add(projectId);
    const catalog = buildUnitCatalog(projectElements, housesData);
    catalog.forEach((entry) => catalogByUnit.set(`${projectId}::${entry.unitKey}`, entry));
    const grouped = groupFollowupUnits(
      projectRows,
      catalog,
      projectId,
      projectElements[0]?._projectName || "",
      settings,
      centers,
    );
    grouped.forEach((unit) => followupByUnit.set(`${projectId}::${unit.unitKey}`, unit));
  });

  const list: ReportUnit[] = [];
  elements.forEach((element) => {
    const projectId = element._projectId || "";
    const projectName = element._projectName || "";
    const ready = fileReady.has(projectId);

    const push = (key: string, kind: ReportUnit["kind"], zone: string, towerId: string, towerLabel: string, typeKey: string, typeLabel: string, label: string) => {
      const data = housesData[key] || {};
      const status = data.status || "available";
      if (status === "frozen_hidden") return;
      const entry = catalogByUnit.get(`${projectId}::${key}`);
      const visibleLabel = entry?.label || label;
      const follow = followupByUnit.get(`${projectId}::${key}`);
      const tracked = Boolean(follow) && soldLike(status) && ready;
      list.push({
        key,
        projectId,
        projectName,
        kind,
        zone,
        towerId,
        towerLabel,
        typeKey: entry?.typeKey || typeKey,
        typeLabel: entry?.typeLabel || typeLabel,
        status,
        systemPrice: parsePrice(data.price),
        systemCurrency: getCurrencyType(data.currency),
        saleDate: saleDay(data.saleDate || ""),
        tabo: String(data.taboStatus || "").trim(),
        handover: Boolean(data.handoverDate),
        centerName: resolveMarketingCenter([visibleLabel], projectId, projectName, settings, centers),
        fileReady: ready,
        tracked,
        paidInFull: tracked ? Boolean(follow?.paidInFull) : false,
        filePrice: tracked ? follow?.salePrice || 0 : 0,
        received: tracked ? follow?.totalReceived || 0 : 0,
        remaining: tracked ? follow?.remaining || 0 : 0,
        fileCurrency: tracked ? follow?.currency || getCurrencyType(data.currency) : getCurrencyType(data.currency),
        installments: tracked && follow && !follow.paidInFull ? follow.installments : [],
        frozenCounted: status === "frozen_counted",
        frozenUncounted: status === "frozen_uncounted",
      });
    };

    if (element.type === "house") {
      const letter = getHouseClass(element.label || "");
      const zone = getZone(element.label || "");
      push(
        element.id,
        "house",
        zone,
        "",
        "",
        letter ? `house:${letter.toUpperCase()}` : "house:",
        letter ? `منزل ${letter.toUpperCase()}` : "منزل",
        element.label || element.id,
      );
      return;
    }
    if (element.type !== "tower") return;
    forEachTowerUnit(element, (unitKey, floor, apt) => {
      const size = getApartmentSize(element, floor, apt);
      push(
        unitKey,
        "apartment",
        "",
        element.id,
        element.label || "",
        size > 0 ? `apt:${size}` : "apt:",
        size > 0 ? `شقة ${size}` : "شقة",
        element.label || unitKey,
      );
    }, 0);
  });

  return list;
};

export interface HeadlineMoney {
  contractIQD: number;
  contractUSD: number;
  expectedIQD: number;
  expectedUSD: number;
  receivedIQD: number;
  receivedUSD: number;
  remainingIQD: number;
  remainingUSD: number;
  untrackedIQD: number;
  untrackedUSD: number;
}

export const summarizeMoney = (units: ReportUnit[], filters: ReportFilters): HeadlineMoney => {
  const money: HeadlineMoney = {
    contractIQD: 0,
    contractUSD: 0,
    expectedIQD: 0,
    expectedUSD: 0,
    receivedIQD: 0,
    receivedUSD: 0,
    remainingIQD: 0,
    remainingUSD: 0,
    untrackedIQD: 0,
    untrackedUSD: 0,
  };

  units.forEach((unit) => {
    if (unit.frozenUncounted || !matchStructure(unit, filters)) return;
    const priced = unit.systemPrice > 0;
    if (priced && currencyOn(filters.currency, unit.systemCurrency)) {
      const expected = unit.status === "reserved" || unit.status === "pending";
      if (expected) {
        if (unit.systemCurrency === "IQD") money.expectedIQD += unit.systemPrice;
        else money.expectedUSD += unit.systemPrice;
      }
    }
    if (!soldLike(unit.status)) return;
    if (!inDayRange(unit.saleDate, filters.saleFrom, filters.saleTo)) return;
    if (currencyOn(filters.currency, unit.systemCurrency)) {
      if (priced) {
        if (unit.systemCurrency === "IQD") money.contractIQD += unit.systemPrice;
        else money.contractUSD += unit.systemPrice;
      }
      if (!unit.fileReady) {
        if (unit.systemCurrency === "IQD") money.untrackedIQD += 1;
        else money.untrackedUSD += 1;
      }
    }
    if (!matchSettlement(unit, filters)) return;
    if (!currencyOn(filters.currency, unit.fileCurrency)) return;
    if (unit.fileCurrency === "IQD") {
      money.receivedIQD += unit.received;
      money.remainingIQD += unit.remaining;
    } else {
      money.receivedUSD += unit.received;
      money.remainingUSD += unit.remaining;
    }
  });

  return money;
};

export interface CollectionRow {
  name: string;
  fileIQD: number;
  receivedIQD: number;
  remainingIQD: number;
  fileUSD: number;
  receivedUSD: number;
  remainingUSD: number;
  paid: number;
  owing: number;
}

const addCollection = (row: CollectionRow, unit: ReportUnit) => {
  if (unit.fileCurrency === "IQD") {
    row.fileIQD += unit.filePrice;
    row.receivedIQD += unit.received;
    row.remainingIQD += unit.remaining;
  } else {
    row.fileUSD += unit.filePrice;
    row.receivedUSD += unit.received;
    row.remainingUSD += unit.remaining;
  }
  if (unit.paidInFull) row.paid += 1;
  else row.owing += 1;
};

export const collectionRows = (
  units: ReportUnit[],
  filters: ReportFilters,
  group: "zone" | "type",
  prefixProject: boolean,
): CollectionRow[] => {
  const rows = new Map<string, CollectionRow>();
  units.forEach((unit) => {
    if (unit.frozenUncounted || !matchStructure(unit, filters)) return;
    if (!soldLike(unit.status)) return;
    if (!inDayRange(unit.saleDate, filters.saleFrom, filters.saleTo)) return;
    if (!matchSettlement(unit, filters)) return;
    if (!currencyOn(filters.currency, unit.fileCurrency)) return;
    const own = group === "type"
      ? unit.typeLabel
      : unit.kind === "house"
        ? `زون ${unit.zone || "عام"}`
        : `عمارة ${unit.towerLabel || "—"}`;
    const name = prefixProject && unit.projectName ? `${unit.projectName} — ${own}` : own;
    const row = rows.get(name) || {
      name,
      fileIQD: 0,
      receivedIQD: 0,
      remainingIQD: 0,
      fileUSD: 0,
      receivedUSD: 0,
      remainingUSD: 0,
      paid: 0,
      owing: 0,
    };
    addCollection(row, unit);
    rows.set(name, row);
  });
  return Array.from(rows.values()).sort((a, b) => a.name.localeCompare(b.name, "ar", { numeric: true }));
};

export interface DueMonth {
  key: string;
  name: string;
  remainingIQD: number;
  remainingUSD: number;
}

export interface DueSummary {
  overdueIQD: number;
  todayIQD: number;
  upcomingIQD: number;
  overdueUSD: number;
  todayUSD: number;
  upcomingUSD: number;
  count: number;
  months: DueMonth[];
}

export const summarizeDues = (
  units: ReportUnit[],
  filters: ReportFilters,
  dueFrom: string,
  dueTo: string,
  dueState: "all" | "overdue" | "today" | "upcoming",
): DueSummary => {
  const summary: DueSummary = {
    overdueIQD: 0,
    todayIQD: 0,
    upcomingIQD: 0,
    overdueUSD: 0,
    todayUSD: 0,
    upcomingUSD: 0,
    count: 0,
    months: [],
  };
  const months = new Map<string, DueMonth>();

  units.forEach((unit) => {
    if (unit.frozenUncounted || !matchStructure(unit, filters)) return;
    if (!inDayRange(unit.saleDate, filters.saleFrom, filters.saleTo)) return;
    if (!matchSettlement(unit, filters)) return;
    if (!currencyOn(filters.currency, unit.fileCurrency)) return;
    unit.installments.forEach((item) => {
      if (!inDayRange(item.dueDate, dueFrom, dueTo)) return;
      if (dueState !== "all" && item.whenKind !== dueState) return;
      summary.count += 1;
      const iqd = unit.fileCurrency === "IQD";
      if (item.whenKind === "overdue") {
        if (iqd) summary.overdueIQD += item.remaining;
        else summary.overdueUSD += item.remaining;
      } else if (item.whenKind === "today") {
        if (iqd) summary.todayIQD += item.remaining;
        else summary.todayUSD += item.remaining;
      } else if (item.whenKind === "upcoming") {
        if (iqd) summary.upcomingIQD += item.remaining;
        else summary.upcomingUSD += item.remaining;
      }
      const key = /^(\d{4}-\d{2})/.exec(item.dueDate)?.[1] || "";
      if (!key) return;
      const [year, month] = key.split("-").map(Number);
      const name = new Date(year, month - 1, 1).toLocaleString("ar-EG", { month: "long", year: "numeric" });
      const bucket = months.get(key) || { key, name, remainingIQD: 0, remainingUSD: 0 };
      if (iqd) bucket.remainingIQD += item.remaining;
      else bucket.remainingUSD += item.remaining;
      months.set(key, bucket);
    });
  });

  summary.months = Array.from(months.values()).sort((a, b) => a.key.localeCompare(b.key));
  return summary;
};
