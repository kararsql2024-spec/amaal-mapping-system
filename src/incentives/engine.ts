import { formatSentence } from "./format";
import { firstMatch, matchesValue, normalizeText } from "./match";
import type {
  Center,
  IncentiveResult,
  IncentiveSettings,
  IncentiveSummary,
  SaleRow,
  UnitCenterOverride,
} from "./types";
import { parseUnitCode } from "./unit-code";

export interface ComputeOptions {
  skipEligibility?: boolean;
  centers?: Center[];
}

const findById = <T extends { id: string }>(items: T[], id?: string): T | undefined =>
  id ? items.find((item) => item.id === id) : undefined;

const isEligible = (row: SaleRow, settings: IncentiveSettings): boolean => {
  const { eligibility } = settings;
  if (!eligibility.enabled) return true;
  const values = eligibility.values.map(normalizeText).filter(Boolean);
  if (values.length === 0) return true;
  return values.some((value) =>
    matchesValue(row.contractPurpose, value, eligibility.matchMode),
  );
};

const cityMatches = (
  row: SaleRow,
  projectId: string | undefined,
  cityValue: string | undefined,
  matchMode: IncentiveSettings["cityRules"][number]["matchMode"] = "equals",
): boolean => {
  if (projectId && row.projectId) return projectId === row.projectId;
  if (!cityValue) return false;
  return matchesValue(row.city, cityValue, matchMode);
};

export const computeRow = (
  row: SaleRow,
  settings: IncentiveSettings,
  options: ComputeOptions = {},
): IncentiveResult => {
  const parsed = parseUnitCode(row.unitNumber);
  const centers = options.centers || settings.centers;
  const eligible = Boolean(options.skipEligibility || isEligible(row, settings));

  const cityRule = firstMatch(settings.cityRules, (rule) =>
    cityMatches(row, rule.projectId, rule.cityValue, rule.matchMode),
  );
  const company = findById(settings.companies, cityRule?.companyId);

  const matchingCenterRules = settings.centerRules.filter((rule) => {
    if (rule.source === "userName") {
      return matchesValue(row.userName, rule.matchValue, rule.matchMode || "equals");
    }

    const cityOk = cityMatches(
      row,
      rule.projectId,
      rule.cityValue,
      rule.cityMatchMode || "equals",
    );
    const unitOk = matchesValue(
      row.unitNumber,
      rule.matchValue,
      rule.matchMode || "startsWith",
    );
    return cityOk && unitOk;
  });
  const userNameRule = matchingCenterRules.find((rule) => rule.source === "userName");
  const prefixRules = matchingCenterRules.filter((rule) => rule.source !== "userName");
  const longestPrefix = prefixRules.reduce<(typeof prefixRules)[number] | undefined>(
    (best, rule) => {
      if (!best) return rule;
      return rule.matchValue.length > best.matchValue.length ? rule : best;
    },
    undefined,
  );
  const centerRule = longestPrefix || userNameRule;
  const center = findById(centers, centerRule?.centerId);
  const userNameCenter = findById(centers, userNameRule?.centerId);
  const conflictNote =
    longestPrefix &&
    userNameRule &&
    longestPrefix.centerId !== userNameRule.centerId
      ? `أدخلها ${row.userName.trim() || userNameRule.matchValue} (${userNameCenter?.name || "مركز المستخدم"}) والبادئة تابعة لـ ${center?.name || "مركز البادئة"}`
      : undefined;

  let unitType = undefined as IncentiveResult["unitType"];

  if (parsed.kind === "house" && parsed.typeCode) {
    const houseRule = firstMatch(settings.houseTypeRules, (rule) =>
      matchesValue(
        parsed.typeCode.toUpperCase(),
        rule.typeCode.toUpperCase(),
        "equals",
      ),
    );
    unitType = findById(settings.unitTypes, houseRule?.unitTypeId);
  }

  if (parsed.kind === "apartment") {
    const apartmentRule = firstMatch(settings.apartmentTypeRules, (rule) => {
      const source =
        rule.source === "houseType"
          ? row.houseType
          : rule.source === "area"
            ? row.area
            : row.unitNumber;
      return matchesValue(source, rule.matchValue, rule.matchMode);
    });
    unitType = findById(settings.unitTypes, apartmentRule?.unitTypeId);
  }

  const missing: string[] = [];
  if (!company) missing.push("الشركة");
  if (!center) missing.push("مركز التسويق");
  if (!unitType) missing.push("نوع الوحدة / المبلغ");

  const amount = eligible ? unitType?.amount || 0 : 0;

  return {
    row,
    parsed,
    included: eligible,
    skipReason: eligible ? undefined : "غاية العقد لا تطابق شروط الاحتساب",
    company,
    center,
    unitType,
    amount,
    sentence: eligible
      ? formatSentence(center?.name, company?.name, unitType?.name, amount)
      : "",
    missing,
    autoCenterId: center?.id,
    conflictNote,
  };
};

export const computeAll = (
  rows: SaleRow[],
  settings: IncentiveSettings,
  options: ComputeOptions = {},
): IncentiveResult[] => rows.map((row) => computeRow(row, settings, options));

export const monthKeyOf = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}`;

export const matchUnitOverride = (
  override: UnitCenterOverride,
  row: SaleRow,
  monthKey: string,
): boolean => {
  if (override.monthKey !== monthKey) return false;
  if (override.unitKey && row.unitKey) return override.unitKey === row.unitKey;
  return (
    override.unitNumber === row.unitNumber &&
    (override.projectId || "") === (row.projectId || "")
  );
};

export const applyUnitOverrides = (
  results: IncentiveResult[],
  overrides: UnitCenterOverride[],
  monthKey: string,
  centers: Center[],
): IncentiveResult[] => {
  if (overrides.length === 0) return results;
  return results.map((result) => {
    const override = overrides.find((item) =>
      matchUnitOverride(item, result.row, monthKey),
    );
    if (!override) return result;

    const autoCenterId = result.autoCenterId || result.center?.id;
    const assigned = override.centerId
      ? findById(centers, override.centerId) || result.center
      : result.center;

    if (!override.included) {
      return {
        ...result,
        included: false,
        skipReason: "مستبعد يدوياً من الحافز",
        amount: 0,
        sentence: "",
        center: assigned,
        autoCenterId,
        overrideApplied: true,
      };
    }

    const amount = result.unitType?.amount || 0;
    const missing = result.missing.filter((item) => item !== "مركز التسويق");
    if (!assigned) missing.push("مركز التسويق");

    return {
      ...result,
      included: true,
      skipReason: undefined,
      center: assigned,
      amount,
      missing,
      sentence: formatSentence(
        assigned?.name,
        result.company?.name,
        result.unitType?.name,
        amount,
      ),
      autoCenterId,
      overrideApplied: true,
    };
  });
};

const groupAmounts = (
  results: IncentiveResult[],
  pick: (result: IncentiveResult) => { name: string; id?: string },
): Array<{ name: string; count: number; amount: number; id?: string }> => {
  const map = new Map<string, { name: string; id?: string; count: number; amount: number }>();
  for (const result of results) {
    if (!result.included) continue;
    const picked = pick(result);
    const key = picked.id || picked.name || "غير محدد";
    const current = map.get(key) || {
      name: picked.name || "غير محدد",
      id: picked.id,
      count: 0,
      amount: 0,
    };
    current.count += 1;
    current.amount += result.amount;
    map.set(key, current);
  }
  return Array.from(map.values()).sort((a, b) => b.amount - a.amount);
};

export const summarize = (results: IncentiveResult[]): IncentiveSummary => {
  const included = results.filter((result) => result.included);
  const complete = included.filter((result) => result.missing.length === 0);
  return {
    totalRows: results.length,
    includedCount: included.length,
    skippedCount: results.length - included.length,
    completeCount: complete.length,
    incompleteCount: included.length - complete.length,
    totalAmount: included.reduce((sum, result) => sum + result.amount, 0),
    byCenter: groupAmounts(included, (result) => ({
      name: result.center?.name || "غير محدد",
      id: result.center?.id,
    })),
    byCompany: groupAmounts(included, (result) => ({
      name: result.company?.name || "غير محدد",
    })),
    byUnitType: groupAmounts(included, (result) => ({
      name: result.unitType?.name || "غير محدد",
    })),
    byUserName: groupAmounts(included, (result) => ({
      name: result.row.userName.trim() || "بدون اسم مستخدم",
    })),
    conflictCount: results.filter((result) => Boolean(result.conflictNote)).length,
  };
};
