import type { IncentiveResult } from "./types";

export interface CityGroup {
  name: string;
  rows: IncentiveResult[];
  count: number;
  amount: number;
}

export interface CompanyGroup {
  name: string;
  cities: CityGroup[];
  count: number;
  amount: number;
}

export interface CenterGroup {
  id: string;
  name: string;
  companies: CompanyGroup[];
  count: number;
  amount: number;
}

const byAr = (a: string, b: string) => a.localeCompare(b, "ar", { numeric: true });

const includedAmount = (result: IncentiveResult) =>
  result.included ? result.amount : 0;

const groupCities = (rows: IncentiveResult[]): CityGroup[] => {
  const map = new Map<string, IncentiveResult[]>();
  rows.forEach((result) => {
    const name = result.row.city.trim() || "مدينة غير معروفة";
    const list = map.get(name) || [];
    list.push(result);
    map.set(name, list);
  });
  return Array.from(map.entries())
    .sort((a, b) => byAr(a[0], b[0]))
    .map(([name, list]) => {
      const sorted = [...list].sort((a, b) =>
        byAr(a.row.unitNumber, b.row.unitNumber),
      );
      return {
        name,
        rows: sorted,
        count: sorted.filter((item) => item.included).length,
        amount: sorted.reduce((sum, item) => sum + includedAmount(item), 0),
      };
    });
};

export const groupByCompanyCity = (results: IncentiveResult[]): CompanyGroup[] => {
  const map = new Map<string, IncentiveResult[]>();
  results.forEach((result) => {
    const name = result.company?.name.trim() || "بدون شركة";
    const list = map.get(name) || [];
    list.push(result);
    map.set(name, list);
  });
  return Array.from(map.entries())
    .sort((a, b) => byAr(a[0], b[0]))
    .map(([name, list]) => {
      const cities = groupCities(list);
      return {
        name,
        cities,
        count: cities.reduce((sum, city) => sum + city.count, 0),
        amount: cities.reduce((sum, city) => sum + city.amount, 0),
      };
    });
};

export const groupByCenterCompanyCity = (
  results: IncentiveResult[],
): CenterGroup[] => {
  const map = new Map<string, { name: string; rows: IncentiveResult[] }>();
  results.forEach((result) => {
    const id = result.center?.id || "__none__";
    const name = result.center?.name.trim() || "بدون مركز";
    const current = map.get(id) || { name, rows: [] };
    current.rows.push(result);
    map.set(id, current);
  });
  return Array.from(map.entries())
    .sort((a, b) => byAr(a[1].name, b[1].name))
    .map(([id, value]) => {
      const companies = groupByCompanyCity(value.rows);
      return {
        id,
        name: value.name,
        companies,
        count: companies.reduce((sum, company) => sum + company.count, 0),
        amount: companies.reduce((sum, company) => sum + company.amount, 0),
      };
    });
};

export const statusLabel = (result: IncentiveResult): string => {
  if (!result.included) {
    return result.skipReason === "غاية العقد لا تطابق شروط الاحتساب"
      ? "غاية غير مشمولة"
      : "مستبعد";
  }
  if (result.missing.length) return "ناقص";
  return "مكتمل";
};

export const kindLabel = (kind: IncentiveResult["parsed"]["kind"]): string => {
  if (kind === "house") return "منزل";
  if (kind === "apartment") return "شقة";
  return "غير معروف";
};
