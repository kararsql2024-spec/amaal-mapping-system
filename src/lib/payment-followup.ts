import type { MapElement } from "@/types/project";
import type { IncentiveSettings } from "@/incentives/types";
import { matchesValue } from "@/incentives/match";
import { getCurrencyType, parsePrice, type CurrencyType } from "@/lib/format";
import { getStatusLabel } from "@/lib/unit-status";
import {
  forEachTowerUnit,
  getApartmentLabel,
  getApartmentSize,
  getHouseClass,
  type HousesData,
} from "@/lib/units";

export const FOLLOWUP_MAPPING_KEY = "payment_followup_mapping";
export const FOLLOWUP_EXCEPTIONS_KEY = "payment_followup_exceptions";
export const FOLLOWUP_TABLE = "payment_followup_rows";

export const DEFAULT_FOLLOWUP_MAPPING = {
  receivedCol: "C",
  installmentCol: "D",
  dueDateCol: "E",
  saleDateCol: "F",
  salePriceCol: "G",
  currencyCol: "H",
  unitCol: "I",
  phoneCol: "J",
  ownerCol: "K",
  contractCol: "M",
};

export type FollowupMapping = typeof DEFAULT_FOLLOWUP_MAPPING;

export interface FollowupRecord {
  id?: string;
  project_id: string;
  import_id?: string;
  unit_key: string;
  unit_label: string;
  customer_name: string;
  phone: string;
  contract_no: string;
  currency: CurrencyType;
  sale_price: number;
  sale_date: string;
  due_date: string;
  installment_amount: number;
  received_amount: number;
}

export interface CatalogEntry {
  unitKey: string;
  label: string;
  kind: "house" | "apartment";
  typeKey: string;
  typeLabel: string;
  status: string;
  name: string;
  phone: string;
  saleDate: string;
  price: string;
  currency: string;
}

export interface ParsedLine {
  rowNumber: number;
  unitLabel: string;
  customerName: string;
  phone: string;
  contractNo: string;
  currency: CurrencyType;
  salePrice: number;
  saleDate: string;
  dueDate: string;
  installmentAmount: number;
  receivedAmount: number;
}

export interface RejectedLine extends ParsedLine {
  reason: string;
}

export interface PreparedImport {
  accepted: FollowupRecord[];
  rejected: RejectedLine[];
}

export interface FollowupInstallment {
  id: string;
  dueDate: string;
  amount: number;
  received: number;
  remaining: number;
  days: number | null;
  whenLabel: string;
  whenKind: "overdue" | "today" | "upcoming" | "unknown";
}

export interface FollowupUnit {
  projectId: string;
  projectName: string;
  unitKey: string;
  unitLabel: string;
  customerName: string;
  phone: string;
  contractNo: string;
  currency: CurrencyType;
  salePrice: number;
  saleDate: string;
  typeKey: string;
  typeLabel: string;
  centerName: string;
  installments: FollowupInstallment[];
  remaining: number;
  totalReceived: number;
  /** متبقي الدفعات التي فات استحقاقها. دفعة اليوم والقادمة لا تدخلان. */
  overdue: number;
  paidInFull: boolean;
  status: string;
  duplicate: boolean;
  warnings: string[];
  minDays: number | null;
}

const COLUMN_KEYS = Object.keys(DEFAULT_FOLLOWUP_MAPPING) as (keyof FollowupMapping)[];

export const normalizeFollowupMapping = (value: unknown): FollowupMapping => {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const next = { ...DEFAULT_FOLLOWUP_MAPPING };
  COLUMN_KEYS.forEach((key) => {
    const column = String(raw[key] ?? "").trim().toUpperCase();
    if (/^[A-Z]{1,3}$/.test(column)) next[key] = column;
  });
  return next;
};

export const cleanUnitLabel = (value: string): string =>
  value.replace(/\s+/g, "").toUpperCase();

const text = (value: unknown): string => String(value ?? "").trim();

export const formatExcelDate = (value: unknown): string => {
  if (value == null || value === "") return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const raw = text(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return raw;
};

export const parseIsoDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

export const startOfToday = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const daySpan = (from: Date, to: Date): number =>
  Math.round((to.getTime() - from.getTime()) / 86400000);

const calendarParts = (from: Date, to: Date) => {
  let years = to.getFullYear() - from.getFullYear();
  let months = to.getMonth() - from.getMonth();
  let days = to.getDate() - from.getDate();
  if (days < 0) {
    months -= 1;
    days += new Date(to.getFullYear(), to.getMonth(), 0).getDate();
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  return { years, months, days };
};

const arabicCount = (count: number, one: string, two: string, few: string, many: string): string => {
  if (count === 1) return one;
  if (count === 2) return two;
  if (count >= 3 && count <= 10) return `${count} ${few}`;
  return `${count} ${many}`;
};

export const describeDue = (
  dueDate: string,
  today = startOfToday(),
): Pick<FollowupInstallment, "days" | "whenLabel" | "whenKind"> => {
  const due = parseIsoDate(dueDate);
  if (!due) return { days: null, whenLabel: "بدون تاريخ", whenKind: "unknown" };
  const days = daySpan(today, due);
  if (days === 0) return { days: 0, whenLabel: "مستحقة اليوم", whenKind: "today" };
  const past = days < 0;
  const parts = calendarParts(past ? due : today, past ? today : due);
  const words = [
    parts.years ? arabicCount(parts.years, "سنة", "سنتان", "سنوات", "سنة") : "",
    parts.months ? arabicCount(parts.months, "شهر", "شهران", "أشهر", "شهراً") : "",
    parts.days ? arabicCount(parts.days, "يوم", "يومان", "أيام", "يوماً") : "",
  ].filter(Boolean);
  const phrase = words.join(" و");
  return {
    days,
    whenKind: past ? "overdue" : "upcoming",
    whenLabel: past ? `متأخر ${phrase}` : `متبقي ${phrase}`,
  };
};

const isoDay = (value: string): string => {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value.trim());
  return match ? match[1] : value.trim();
};

export const buildUnitCatalog = (
  elements: MapElement[],
  units: Record<string, { status?: string; name?: string; phone?: string; saleDate?: string; price?: string; currency?: string }>,
): Map<string, CatalogEntry> => {
  const byLabel = new Map<string, CatalogEntry>();
  const houses = (units || {}) as HousesData;

  const put = (entry: CatalogEntry) => {
    const key = cleanUnitLabel(entry.label);
    if (key && !byLabel.has(key)) byLabel.set(key, entry);
  };

  elements.forEach((element) => {
    if (element.type === "house") {
      const letter = getHouseClass(element.label || "");
      const data = units[element.id] || {};
      put({
        unitKey: element.id,
        label: element.label || element.id,
        kind: "house",
        typeKey: letter ? `house:${letter.toUpperCase()}` : "house:",
        typeLabel: letter ? `منزل ${letter.toUpperCase()}` : "منزل",
        status: data.status || "available",
        name: data.name || "",
        phone: data.phone || "",
        saleDate: isoDay(data.saleDate || ""),
        price: data.price || "",
        currency: data.currency || "",
      });
      return;
    }
    if (element.type !== "tower") return;
    forEachTowerUnit(element, (unitKey, floor, apt) => {
      const label = getApartmentLabel(element, floor, apt, houses);
      const size = getApartmentSize(element, floor, apt);
      const data = units[unitKey] || {};
      put({
        unitKey,
        label: label || unitKey,
        kind: "apartment",
        typeKey: size > 0 ? `apt:${size}` : "apt:",
        typeLabel: size > 0 ? `شقة ${size}` : "شقة",
        status: data.status || "available",
        name: data.name || "",
        phone: data.phone || "",
        saleDate: isoDay(data.saleDate || ""),
        price: data.price || "",
        currency: data.currency || "",
      });
    }, 1);
  });

  return byLabel;
};

const cell = (row: Record<string, unknown>, column: string): unknown => {
  if (!column) return "";
  return row[column] ?? row[column.toUpperCase()] ?? "";
};

export const parseFollowupSheet = (
  rows: Record<string, unknown>[],
  mapping: FollowupMapping,
): { lines: ParsedLine[]; rejected: RejectedLine[] } => {
  const lines: ParsedLine[] = [];
  const rejected: RejectedLine[] = [];
  rows.forEach((row, index) => {
    if (index === 0) return;
    const unitLabel = text(cell(row, mapping.unitCol));
    const customerName = text(cell(row, mapping.ownerCol));
    const phone = text(cell(row, mapping.phoneCol));
    const contractNo = text(cell(row, mapping.contractCol));
    const saleDate = formatExcelDate(cell(row, mapping.saleDateCol));
    const dueDate = formatExcelDate(cell(row, mapping.dueDateCol));
    const salePrice = parsePrice(cell(row, mapping.salePriceCol));
    const installmentAmount = parsePrice(cell(row, mapping.installmentCol));
    const receivedAmount = parsePrice(cell(row, mapping.receivedCol));
    const currency = getCurrencyType(cell(row, mapping.currencyCol));
    const empty = !unitLabel && !customerName && !phone && salePrice === 0 && installmentAmount === 0 && receivedAmount === 0;
    if (empty) return;
    const line: ParsedLine = {
      rowNumber: index + 1,
      unitLabel,
      customerName,
      phone,
      contractNo,
      currency,
      salePrice,
      saleDate,
      dueDate,
      installmentAmount,
      receivedAmount,
    };
    if (!unitLabel) {
      rejected.push({ ...line, reason: "بدون رقم وحدة" });
      return;
    }
    lines.push(line);
  });
  return { lines, rejected };
};

const sameMoney = (left: number, right: number): boolean => Math.abs(left - right) <= 1;

export const prepareFollowupImport = (
  lines: ParsedLine[],
  catalog: Map<string, CatalogEntry>,
  projectId: string,
): PreparedImport => {
  const groups = new Map<string, ParsedLine[]>();
  lines.forEach((line) => {
    const key = cleanUnitLabel(line.unitLabel);
    const bucket = groups.get(key) || [];
    bucket.push(line);
    groups.set(key, bucket);
  });

  const accepted: FollowupRecord[] = [];
  const rejected: RejectedLine[] = [];

  groups.forEach((group) => {
    const entry = catalog.get(cleanUnitLabel(group[0].unitLabel));
    const rejectAll = (reason: string) => {
      group.forEach((line) => rejected.push({ ...line, reason }));
    };
    if (!entry) {
      rejectAll("الوحدة غير موجودة في المشروع");
      return;
    }
    if (entry.status !== "sold" && entry.status !== "investment") {
      rejectAll(`حالتها ${getStatusLabel(entry.status)} وليست مباعاً أو استثماراً`);
      return;
    }
    const prices = Array.from(new Set(group.map((line) => Math.round(line.salePrice)).filter((price) => price > 0)));
    if (prices.length > 1) {
      rejectAll("للوحدة أكثر من سعر بيع في الملف");
      return;
    }
    const currencies = Array.from(new Set(group.map((line) => line.currency)));
    if (currencies.length > 1) {
      rejectAll("للوحدة أكثر من عملة في الملف");
      return;
    }
    const salePrice = prices[0] || 0;
    const customerName = group.find((line) => line.customerName)?.customerName || "";
    const phone = group.find((line) => line.phone)?.phone || "";
    const contractNo = group.find((line) => line.contractNo)?.contractNo || "";
    const saleDate = group.find((line) => line.saleDate)?.saleDate || "";
    group.forEach((line) => {
      accepted.push({
        project_id: projectId,
        unit_key: entry.unitKey,
        unit_label: entry.label,
        customer_name: customerName,
        phone,
        contract_no: contractNo,
        currency: line.currency,
        sale_price: salePrice,
        sale_date: saleDate,
        due_date: line.dueDate,
        installment_amount: line.installmentAmount,
        received_amount: line.receivedAmount,
      });
    });
  });

  return { accepted, rejected };
};

const normalizeName = (value: string): string =>
  value.replace(/\s+/g, " ").trim().toLowerCase();

export const resolveMarketingCenter = (
  labels: string[],
  projectId: string,
  projectName: string,
  settings: IncentiveSettings | null,
  centers: { id: string; name: string }[] = [],
): string => {
  if (!settings) return "غير محدد";
  const rules = settings.centerRules.filter((rule) => rule.source !== "userName" && String(rule.matchValue || "").trim());
  const matched = rules.filter((rule) => {
    const sameProject = rule.projectId ? String(rule.projectId) === String(projectId) : false;
    const sameCity = rule.cityValue
      ? matchesValue(projectName, rule.cityValue, rule.cityMatchMode || "equals")
      : false;
    if (rule.projectId && !sameProject) return false;
    if (!rule.projectId && rule.cityValue && !sameCity) return false;
    if (!rule.projectId && !rule.cityValue) return false;
    return labels.some((label) =>
      matchesValue(label, rule.matchValue, rule.matchMode || "startsWith"),
    );
  });
  const winner = matched.reduce<(typeof matched)[number] | undefined>((best, rule) => {
    if (!best) return rule;
    return rule.matchValue.length > best.matchValue.length ? rule : best;
  }, undefined);
  if (!winner) return "غير محدد";
  const wanted = String(winner.centerId);
  const pool = [...centers, ...settings.centers];
  return pool.find((center) => String(center.id) === wanted)?.name || "غير محدد";
};

export const groupFollowupUnits = (
  rows: FollowupRecord[],
  catalog: Map<string, CatalogEntry>,
  projectId: string,
  projectName: string,
  settings: IncentiveSettings | null,
  centers: { id: string; name: string }[] = [],
  today = startOfToday(),
): FollowupUnit[] => {
  const buckets = new Map<string, FollowupRecord[]>();
  rows.forEach((row) => {
    const key = row.unit_key || cleanUnitLabel(row.unit_label);
    const bucket = buckets.get(key) || [];
    bucket.push(row);
    buckets.set(key, bucket);
  });

  const owing = Array.from(buckets.values()).map((bucket) => {
    const first = bucket[0];
    const entry = catalog.get(cleanUnitLabel(first.unit_label));
    const installments = bucket
      .map((row, index) => {
        const due = describeDue(row.due_date || "", today);
        const amount = Number(row.installment_amount) || 0;
        const received = Number(row.received_amount) || 0;
        return {
          id: row.id || `${first.unit_key}-${index}`,
          dueDate: row.due_date || "",
          amount,
          received,
          remaining: amount - received,
          ...due,
        };
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const remaining = installments.reduce((sum, item) => sum + item.remaining, 0);
    const overdue = installments.reduce((sum, item) => (
      item.whenKind === "overdue" && item.remaining > 0 ? sum + item.remaining : sum
    ), 0);
    const salePrice = Number(first.sale_price) || 0;
    const totalReceived = salePrice - remaining;
    const signature = new Map<string, number>();
    installments.forEach((item) => {
      const key = `${item.dueDate}|${item.amount}`;
      signature.set(key, (signature.get(key) || 0) + 1);
    });
    const warnings: string[] = [];
    if (Array.from(signature.values()).some((count) => count > 1)) {
      warnings.push("في الملف دفعتان متطابقتان بالتاريخ والمبلغ");
    }
    if (entry && normalizeName(entry.name) && normalizeName(entry.name) !== normalizeName(first.customer_name)) {
      warnings.push("اسم الزبون في النظام يختلف عن ملف الدفعات");
    }
    if (entry && parsePrice(entry.price) > 0 && !sameMoney(parsePrice(entry.price), salePrice)) {
      warnings.push("سعر الوحدة في النظام يختلف عن ملف الدفعات");
    }
    if (entry?.currency && getCurrencyType(entry.currency) !== first.currency) {
      warnings.push("عملة الوحدة في النظام تختلف عن ملف الدفعات");
    }
    const knownDays = installments.map((item) => item.days).filter((days): days is number => days != null);

    return {
      projectId,
      projectName,
      unitKey: first.unit_key,
      unitLabel: entry?.label || first.unit_label,
      customerName: first.customer_name || "",
      phone: first.phone || "",
      contractNo: first.contract_no || "",
      currency: first.currency,
      salePrice,
      saleDate: first.sale_date || "",
      typeKey: entry?.typeKey || "",
      typeLabel: entry?.typeLabel || "غير محدد",
      centerName: resolveMarketingCenter(
        [entry?.label, first.unit_label].filter((label): label is string => Boolean(label)),
        projectId,
        projectName,
        settings,
        centers,
      ),
      installments,
      remaining,
      totalReceived,
      overdue,
      paidInFull: false,
      status: entry?.status || "",
      duplicate: warnings.some((note) => note.startsWith("في الملف")),
      warnings,
      minDays: knownDays.length ? Math.min(...knownDays) : null,
    };
  });

  if (rows.length === 0) return owing;

  const seen = new Set<string>();
  owing.forEach((unit) => {
    seen.add(unit.unitKey);
    seen.add(cleanUnitLabel(unit.unitLabel));
  });

  const settled: FollowupUnit[] = [];
  catalog.forEach((entry) => {
    if (entry.status !== "sold" && entry.status !== "investment") return;
    if (seen.has(entry.unitKey) || seen.has(cleanUnitLabel(entry.label))) return;
    const salePrice = parsePrice(entry.price);
    settled.push({
      projectId,
      projectName,
      unitKey: entry.unitKey,
      unitLabel: entry.label,
      customerName: entry.name || "",
      phone: entry.phone || "",
      contractNo: "",
      currency: getCurrencyType(entry.currency),
      salePrice,
      saleDate: entry.saleDate || "",
      typeKey: entry.typeKey,
      typeLabel: entry.typeLabel,
      centerName: resolveMarketingCenter([entry.label], projectId, projectName, settings, centers),
      installments: [],
      remaining: 0,
      totalReceived: salePrice,
      overdue: 0,
      paidInFull: true,
      status: entry.status,
      duplicate: false,
      warnings: [],
      minDays: null,
    });
  });

  return [...owing, ...settled];
};

export interface FollowupExceptionGroup {
  id: string;
  name: string;
  names: string[];
}

export const normalizePersonName = (value: string): string =>
  value
    .replace(/\u0640/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

export const normalizeFollowupExceptions = (value: unknown): FollowupExceptionGroup[] => {
  if (!Array.isArray(value)) return [];
  const groups: FollowupExceptionGroup[] = [];
  value.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const row = item as { id?: unknown; name?: unknown; names?: unknown };
    const id = String(row.id || "").trim();
    const name = String(row.name || "").trim();
    if (!id || !name) return;
    const seen = new Set<string>();
    const names: string[] = [];
    const source = Array.isArray(row.names) ? row.names : [];
    source.forEach((entry) => {
      const text = String(entry || "").trim().replace(/\s+/g, " ");
      const key = normalizePersonName(text);
      if (!text || !key || seen.has(key)) return;
      seen.add(key);
      names.push(text);
    });
    groups.push({ id, name, names });
  });
  return groups;
};

export interface FollowupFilters {
  search: string;
  receivedFrom: string;
  receivedTo: string;
  dueFrom: string;
  dueTo: string;
  saleFrom: string;
  saleTo: string;
  currency: "all" | CurrencyType;
  dueState: "all" | "overdue" | "today" | "upcoming";
  settlement: "all" | "remaining" | "paid";
  investors: "with" | "without";
  center: string;
  types: string[];
  excludedNames: string[];
  /** عند وجودها تُعرض هذه الأسماء فقط. المصفوفة الفارغة لا تُظهر أحداً. */
  includedNames: string[] | null;
}

const inDateRange = (value: string, from: string, to: string): boolean => {
  if (!from && !to) return true;
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
};

const phoneHaystack = (phone: string): string => phone.replace(/[^\d]/g, "");

/** يقرأ مبلغاً مكتوباً بأرقام عربية أو فواصل. الحقل الفارغ يعني بلا حد. */
export const parseMoneyBound = (value: string): number | null => {
  const digits = value
    .trim()
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[,\s،٬]/g, "");
  if (!digits) return null;
  if (!/^\d+(\.\d+)?$/.test(digits)) return null;
  const amount = Number(digits);
  return Number.isFinite(amount) ? Math.round(amount) : null;
};

export const filterFollowupUnits = (units: FollowupUnit[], filters: FollowupFilters): FollowupUnit[] => {
  const needle = filters.search.trim().toLowerCase();
  const needleDigits = needle.replace(/[^\d]/g, "");
  const receivedFrom = parseMoneyBound(filters.receivedFrom || "");
  const receivedTo = parseMoneyBound(filters.receivedTo || "");
  const excluded = new Set((filters.excludedNames || []).map(normalizePersonName).filter(Boolean));
  const included = filters.includedNames
    ? new Set(filters.includedNames.map(normalizePersonName).filter(Boolean))
    : null;
  return units.flatMap((unit) => {
    const person = normalizePersonName(unit.customerName);
    if (included && !included.has(person)) return [];
    if (excluded.size > 0 && excluded.has(person)) return [];
    if (filters.investors === "without" && unit.status === "investment") return [];
    if (filters.settlement === "paid" && !unit.paidInFull) return [];
    if (filters.settlement === "remaining" && unit.paidInFull) return [];
    if (filters.currency !== "all" && unit.currency !== filters.currency) return [];
    if (filters.center !== "all" && unit.centerName !== filters.center) return [];
    if (filters.types.length > 0 && !filters.types.includes(unit.typeKey)) return [];
    if (!inDateRange(unit.saleDate, filters.saleFrom, filters.saleTo)) return [];
    const received = Math.round(unit.totalReceived);
    if (receivedFrom != null && received < receivedFrom) return [];
    if (receivedTo != null && received > receivedTo) return [];
    if (needle) {
      const phone = phoneHaystack(unit.phone);
      const hit =
        unit.unitLabel.toLowerCase().includes(needle) ||
        unit.customerName.toLowerCase().includes(needle) ||
        (needleDigits.length >= 3 && phone.includes(needleDigits));
      if (!hit) return [];
    }
    if (unit.paidInFull) {
      const dueFilterOn = Boolean(filters.dueFrom || filters.dueTo || filters.dueState !== "all");
      if (dueFilterOn && filters.settlement !== "paid") return [];
      return [unit];
    }
    const installments = unit.installments.filter((item) => {
      if (!inDateRange(item.dueDate, filters.dueFrom, filters.dueTo)) return false;
      if (filters.dueState === "all") return true;
      return item.whenKind === filters.dueState;
    });
    if (installments.length === 0) return [];
    return [{ ...unit, installments }];
  });
};

export type FollowupSort = "overdue" | "arrears" | "unit" | "name";

export const sortFollowupUnits = (units: FollowupUnit[], mode: FollowupSort): FollowupUnit[] => {
  const next = [...units];
  if (mode === "arrears") {
    next.sort((a, b) => b.overdue - a.overdue || a.unitLabel.localeCompare(b.unitLabel, "ar", { numeric: true }));
    return next;
  }
  if (mode === "unit") {
    next.sort((a, b) => a.unitLabel.localeCompare(b.unitLabel, "ar", { numeric: true }));
    return next;
  }
  if (mode === "name") {
    next.sort((a, b) => a.customerName.localeCompare(b.customerName, "ar"));
    return next;
  }
  next.sort((a, b) => {
    const left = a.installments.reduce((min, item) => (item.days == null ? min : Math.min(min, item.days)), Number.POSITIVE_INFINITY);
    const right = b.installments.reduce((min, item) => (item.days == null ? min : Math.min(min, item.days)), Number.POSITIVE_INFINITY);
    if (left !== right) return left - right;
    return a.unitLabel.localeCompare(b.unitLabel, "ar", { numeric: true });
  });
  return next;
};
