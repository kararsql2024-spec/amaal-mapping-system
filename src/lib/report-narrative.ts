import { formatNumber } from "@/lib/format";
import { collectionRate, type CollectionRow, type CohortRow, type ObligationCross, type OverdueHit } from "@/lib/report-collection";

export const EMPTY_BRIEF = "لا توجد بيانات ضمن هذه التصفية";

export type ReportSectionId =
  | "cards"
  | "collection"
  | "cohort"
  | "centers"
  | "dues"
  | "overdue"
  | "status"
  | "performance"
  | "trend"
  | "legal"
  | "obligation"
  | "obligationUnits"
  | "prices";

export const REPORT_SECTIONS: { id: ReportSectionId; label: string; hint: string; defaultOn: boolean; briefable: boolean }[] = [
  { id: "cards", label: "الملخص", hint: "العقود والواصل والمتبقي ونسب التسديد والمبيعات", defaultOn: true, briefable: false },
  { id: "collection", label: "موقف التسديد", hint: "حسب النوع أو الزون", defaultOn: true, briefable: true },
  { id: "cohort", label: "عمر الدين حسب تاريخ البيع", hint: "سنة البيع وما زال مفتوحاً منها", defaultOn: true, briefable: true },
  { id: "centers", label: "ترتيب المراكز التسويقية", hint: "المتبقي ونسبة التسديد", defaultOn: true, briefable: true },
  { id: "dues", label: "الاستحقاقات", hint: "المتأخر ومستحق 30 يوماً وأشهر الاستحقاق", defaultOn: true, briefable: true },
  { id: "overdue", label: "أكبر المتأخرات", hint: "أسماء الوحدات والهواتف", defaultOn: false, briefable: true },
  { id: "status", label: "توزيع المبيعات", hint: "متاحة ومباعة واستثمار", defaultOn: true, briefable: false },
  { id: "performance", label: "أداء المبيعات", hint: "العدد أو قيمة العقود أو المتبقي", defaultOn: true, briefable: true },
  { id: "trend", label: "منحنى المبيعات", hint: "قيمة البيع عبر الأشهر", defaultOn: true, briefable: true },
  { id: "legal", label: "الموقف القانوني والاستلام", hint: "الطابو وتسليم المفاتيح", defaultOn: true, briefable: false },
  { id: "obligation", label: "الطابو والتسليم مع المتبقي", hint: "المجاميع فقط", defaultOn: true, briefable: false },
  { id: "obligationUnits", label: "تفاصيل وحدات الطابو والتسليم", hint: "الأسماء والهواتف والمبالغ", defaultOn: false, briefable: true },
  { id: "prices", label: "متوسط الأسعار", hint: "المنازل والشقق", defaultOn: true, briefable: true },
];

const STORAGE_KEY = "amaal-report-export-sections-v1";

export const defaultSections = (): ReportSectionId[] =>
  REPORT_SECTIONS.filter((section) => section.defaultOn).map((section) => section.id);

const knownSection = (id: unknown): id is ReportSectionId =>
  typeof id === "string" && REPORT_SECTIONS.some((section) => section.id === id);

const readIds = (value: unknown): ReportSectionId[] =>
  Array.isArray(value) ? value.filter(knownSection) : [];

export const loadExportChoice = (): { sections: ReportSectionId[]; brief: ReportSectionId[] } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { sections: defaultSections(), brief: [] };
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return { sections: readIds(parsed), brief: [] };
    if (parsed && typeof parsed === "object") {
      const record = parsed as { sections?: unknown; brief?: unknown };
      const sections = readIds(record.sections);
      return {
        sections: sections.length > 0 || Array.isArray(record.sections) ? sections : defaultSections(),
        brief: readIds(record.brief).filter((id) => REPORT_SECTIONS.find((section) => section.id === id)?.briefable),
      };
    }
  } catch {
    return { sections: defaultSections(), brief: [] };
  }
  return { sections: defaultSections(), brief: [] };
};

export const saveExportChoice = (sections: ReportSectionId[], brief: ReportSectionId[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ sections, brief }));
};

export const loadSectionSelection = (): ReportSectionId[] => loadExportChoice().sections;

export const saveSectionSelection = (ids: ReportSectionId[]) => {
  saveExportChoice(ids, loadExportChoice().brief);
};

export const formatPct = (value: number | null): string => {
  if (value == null || !Number.isFinite(value)) return "—";
  const rounded = Math.round(value * 10) / 10;
  const text = Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
  return `${text}%`;
};

const money = (amount: number, currency: "IQD" | "USD") =>
  currency === "USD" ? `$${formatNumber(amount)}` : `${formatNumber(amount)} دينار`;

const shareOf = (part: number, total: number): string | null => {
  if (!(total > 0)) return null;
  return formatPct((part / total) * 100);
};

const join = (parts: string[]) => parts.filter(Boolean).join(" ");

interface Rank {
  name: string;
  value: number;
}

const topValue = (rows: { name: string }[], pick: (row: { name: string }) => number): Rank | null => {
  let best: Rank | null = null;
  rows.forEach((row) => {
    const value = pick(row);
    if (!best || value > best.value) best = { name: row.name, value };
  });
  return best && best.value > 0 ? best : null;
};

const weakestRate = (rows: CollectionRow[], currency: "IQD" | "USD"): { name: string; rate: number } | null => {
  let best: { name: string; rate: number } | null = null;
  rows.forEach((row) => {
    const rate = currency === "IQD"
      ? collectionRate(row.receivedIQD, row.remainingIQD)
      : collectionRate(row.receivedUSD, row.remainingUSD);
    if (rate == null) return;
    if (!best || rate < best.rate) best = { name: row.name, rate };
  });
  return best;
};

const currencyLines = (
  showIQD: boolean,
  showUSD: boolean,
  iqd: string,
  usd: string,
): string => join([showIQD ? iqd : "", showUSD ? usd : ""]);

export interface NarrativeInput {
  showIQD: boolean;
  showUSD: boolean;
  receivedIQD: number;
  remainingIQD: number;
  receivedUSD: number;
  remainingUSD: number;
  untrackedIQD: number;
  untrackedUSD: number;
  salesRatio: number;
  saleScoped: boolean;
  sold: number;
  investment: number;
  lifetimeSales: number;
  lifetimeUnits: number;
  total: number;
  available: number;
  paid: number;
  owing: number;
  receivedTabo: number;
  receivedUnit: number;
  legalBase: number;
  legalInvestment: number;
  collection: CollectionRow[];
  cohorts: CohortRow[];
  centers: CollectionRow[];
  overdueIQD: number;
  overdueUSD: number;
  todayIQD: number;
  todayUSD: number;
  upcomingIQD: number;
  upcomingUSD: number;
  soonIQD: number;
  soonUSD: number;
  ageOverIQD: number;
  ageOverUSD: number;
  ageMode: "all" | "slices";
  dueMonths: { key: string; name: string; iqd: number; usd: number }[];
  overdueHits: { iqd: OverdueHit[]; usd: OverdueHit[] };
  performanceMode: "count" | "contract" | "remaining";
  performance: { name: string; total: number; sold: number; investment: number; periodContracts: number; lifetimeSales: number; lifetimeUnits: number; contractIQD: number; contractUSD: number; remainingIQD: number; remainingUSD: number }[];
  performanceHouses: NarrativeInput["performance"];
  performanceApartments: NarrativeInput["performance"];
  trend: { key: string; name: string; count: number; iqd: number; usd: number }[];
  obligations: ObligationCross;
  pricesHouses: { name: string; iqd: number; usd: number }[];
  pricesApartments: { name: string; iqd: number; usd: number }[];
}

const bookLine = (label: string, received: number, remaining: number, currency: "IQD" | "USD"): string => {
  const rate = collectionRate(received, remaining);
  if (rate == null) return "";
  const base = received + remaining;
  const remainingShare = shareOf(remaining, base);
  return `${label} ${formatPct(rate)}، والمتبقي ${money(remaining, currency)} أي ${remainingShare} من قيمة العقد.`;
};

const extremeRateLine = (rows: CollectionRow[], currency: "IQD" | "USD", noun: string): string => {
  const high = topValue(rows, (row) => (currency === "IQD" ? (row as CollectionRow).remainingIQD : (row as CollectionRow).remainingUSD));
  const weak = weakestRate(rows, currency);
  if (!high && !weak) return "";
  const parts: string[] = [];
  if (high) parts.push(`أكبر متبقي ${noun} عند ${high.name}: ${money(high.value, currency)}.`);
  if (weak) parts.push(`أضعف نسبة تسديد ${noun} عند ${weak.name}: ${formatPct(weak.rate)}.`);
  return parts.join(" ");
};

const closedCohort = (row: CohortRow): boolean => {
  const iqd = collectionRate(row.receivedIQD, row.remainingIQD);
  const usd = collectionRate(row.receivedUSD, row.remainingUSD);
  const rates = [iqd, usd].filter((rate): rate is number => rate != null);
  return rates.length > 0 && rates.every((rate) => rate >= 99.95) && row.remainingIQD === 0 && row.remainingUSD === 0;
};

const priceSpan = (rows: { name: string; iqd: number; usd: number }[], currency: "IQD" | "USD", label: string): string => {
  const valued = rows
    .map((row) => ({ name: row.name, value: currency === "IQD" ? row.iqd : row.usd }))
    .filter((row) => row.value > 0);
  if (valued.length === 0) return "";
  const high = valued.reduce((best, row) => (row.value > best.value ? row : best));
  const low = valued.reduce((best, row) => (row.value < best.value ? row : best));
  if (high.name === low.name) return `${label}: ${high.name} بمتوسط ${money(high.value, currency)}.`;
  return `${label}: أعلاها ${high.name} (${money(high.value, currency)}) وأدناها ${low.name} (${money(low.value, currency)}).`;
};

export const buildBriefs = (input: NarrativeInput): Record<ReportSectionId, string> => {
  const periodCount = input.sold + input.investment;
  const periodLine = periodCount > 0
    ? join([
      `عقود الفترة: مباع ${formatNumber(input.sold)} واستثمار ${formatNumber(input.investment)}.`,
      shareOf(periodCount, input.lifetimeSales) ? `${shareOf(periodCount, input.lifetimeSales)} من إجمالي المبيعات (${formatNumber(input.lifetimeSales)} عقد).` : "",
      shareOf(periodCount, input.lifetimeUnits) ? `${shareOf(periodCount, input.lifetimeUnits)} من إجمالي الوحدات السكنية (${formatNumber(input.lifetimeUnits)} وحدة).` : "",
    ])
    : "لا توجد عقود ضمن فترة البيع.";
  const cards = join([
    input.saleScoped
      ? periodLine
      : `نسبة المبيعات ${input.salesRatio}%: مباع ${formatNumber(input.sold)} واستثمار ${formatNumber(input.investment)} من ${formatNumber(input.total)} وحدة.`,
    currencyLines(
      input.showIQD,
      input.showUSD,
      bookLine("التسديد بالدينار", input.receivedIQD, input.remainingIQD, "IQD"),
      bookLine("التسديد بالدولار", input.receivedUSD, input.remainingUSD, "USD"),
    ),
    input.paid + input.owing > 0 ? `سدد ${formatNumber(input.paid)} وما زال على ${formatNumber(input.owing)}.` : "",
    input.untrackedIQD + input.untrackedUSD > 0
      ? `${formatNumber(input.untrackedIQD + input.untrackedUSD)} وحدة بلا تسديد محسوب، وهي خارج نسبة التسديد.`
      : "",
  ]) || EMPTY_BRIEF;

  const collection = join([
    input.showIQD ? extremeRateLine(input.collection, "IQD", "بالدينار") : "",
    input.showUSD ? extremeRateLine(input.collection, "USD", "بالدولار") : "",
  ]) || EMPTY_BRIEF;

  const openCohorts = input.cohorts.filter((row) => row.sort !== "9999" && (row.remainingIQD > 0 || row.remainingUSD > 0));
  const oldest = openCohorts[0];
  const cohortYears = new Set(input.cohorts.filter((row) => row.sort !== "9999").map((row) => row.name));
  const closed = input.cohorts.filter(closedCohort).length;
  const cohort = join([
    input.showIQD && topValue(input.cohorts, (row) => (row as CohortRow).remainingIQD)
      ? `أكبر متبقي بالدينار من مبيعات ${topValue(input.cohorts, (row) => (row as CohortRow).remainingIQD)?.name}: ${money(topValue(input.cohorts, (row) => (row as CohortRow).remainingIQD)?.value || 0, "IQD")}.`
      : "",
    input.showUSD && topValue(input.cohorts, (row) => (row as CohortRow).remainingUSD)
      ? `أكبر متبقي بالدولار من مبيعات ${topValue(input.cohorts, (row) => (row as CohortRow).remainingUSD)?.name}: ${money(topValue(input.cohorts, (row) => (row as CohortRow).remainingUSD)?.value || 0, "USD")}.`
      : "",
    oldest && cohortYears.size > 1 ? `أقدم سنة ما زال عليها متبقي هي ${oldest.name}.` : "",
    closed > 0 && cohortYears.size > 1 ? `${formatNumber(closed)} ${closed === 1 ? "سنة تسددت بالكامل." : "سنوات تسددت بالكامل."}` : "",
  ]) || EMPTY_BRIEF;

  const unspecified = input.centers.find((row) => row.name === "غير محدد");
  const centerShare = (currency: "IQD" | "USD") => {
    if (!unspecified) return "";
    const part = currency === "IQD" ? unspecified.remainingIQD : unspecified.remainingUSD;
    const total = input.centers.reduce((sum, row) => sum + (currency === "IQD" ? row.remainingIQD : row.remainingUSD), 0);
    const pct = shareOf(part, total);
    if (!(part > 0) || !pct) return "";
    return `غير محدد عليه ${money(part, currency)} أي ${pct} من متبقي ${currency === "IQD" ? "الدينار" : "الدولار"}.`;
  };
  const centers = join([
    input.showIQD ? extremeRateLine(input.centers, "IQD", "بالدينار") : "",
    input.showUSD ? extremeRateLine(input.centers, "USD", "بالدولار") : "",
    input.showIQD ? centerShare("IQD") : "",
    input.showUSD ? centerShare("USD") : "",
  ]) || EMPTY_BRIEF;

  const openIQD = input.overdueIQD + input.todayIQD + input.upcomingIQD;
  const openUSD = input.overdueUSD + input.todayUSD + input.upcomingUSD;
  const heavy = (currency: "IQD" | "USD") => {
    const month = topValue(input.dueMonths, (row) => (currency === "IQD" ? (row as NarrativeInput["dueMonths"][number]).iqd : (row as NarrativeInput["dueMonths"][number]).usd));
    return month ? `أثقل شهر ${currency === "IQD" ? "بالدينار" : "بالدولار"} هو ${month.name}: ${money(month.value, currency)}.` : "";
  };
  const dues = join([
    input.showIQD && openIQD > 0 ? `المتأخر بالدينار ${money(input.overdueIQD, "IQD")}، وهو ${shareOf(input.overdueIQD, openIQD)} من الدفعات المفتوحة. مستحق خلال 30 يوماً ${money(input.soonIQD, "IQD")}.` : "",
    input.showUSD && openUSD > 0 ? `المتأخر بالدولار ${money(input.overdueUSD, "USD")}، وهو ${shareOf(input.overdueUSD, openUSD)} من الدفعات المفتوحة. مستحق خلال 30 يوماً ${money(input.soonUSD, "USD")}.` : "",
    input.ageMode === "slices" && input.showIQD && input.overdueIQD > 0
      ? `أكثر من 90 يوماً يمثّل ${shareOf(input.ageOverIQD, input.overdueIQD)} من المتأخر بالدينار.`
      : "",
    input.ageMode === "slices" && input.showUSD && input.overdueUSD > 0
      ? `أكثر من 90 يوماً يمثّل ${shareOf(input.ageOverUSD, input.overdueUSD)} من المتأخر بالدولار.`
      : "",
    input.showIQD ? heavy("IQD") : "",
    input.showUSD ? heavy("USD") : "",
  ]) || EMPTY_BRIEF;

  const hitLine = (hits: OverdueHit[], total: number, currency: "IQD" | "USD") => {
    if (hits.length === 0 || !(total > 0)) return "";
    const top = hits[0];
    const sum = hits.reduce((acc, hit) => acc + hit.amount, 0);
    return `أكبر متأخر ${currency === "IQD" ? "بالدينار" : "بالدولار"} ${top.customerName || "بدون اسم"} على ${top.label}: ${money(top.amount, currency)}. مجموع القائمة ${money(sum, currency)} أي ${shareOf(sum, total)} من المتأخر.`;
  };
  const overdue = join([
    input.showIQD ? hitLine(input.overdueHits.iqd, input.overdueIQD, "IQD") : "",
    input.showUSD ? hitLine(input.overdueHits.usd, input.overdueUSD, "USD") : "",
  ]) || EMPTY_BRIEF;

  const status = input.saleScoped
    ? (input.sold + input.investment > 0 ? periodLine : EMPTY_BRIEF)
    : input.total > 0
      ? `المباع ${formatNumber(input.sold)} والاستثمار ${formatNumber(input.investment)} من ${formatNumber(input.total)}، بنسبة ${input.salesRatio}%. المتاحة ${formatNumber(input.available)}.`
      : EMPTY_BRIEF;

  const performanceTop = (): string => {
    if (input.performance.length === 0) return EMPTY_BRIEF;
    if (input.performanceMode === "count") {
      if (input.saleScoped) {
        const best = topValue(input.performance, (row) => (row as NarrativeInput["performance"][number]).periodContracts);
        if (!best) return periodLine;
        const row = input.performance.find((item) => item.name === best.name);
        return `أعلى نطاقاً في عقود الفترة: ${best.name} بعدد ${formatNumber(best.value)}، من إجمالي مبيعات ${formatNumber(row?.lifetimeSales || 0)} وإجمالي وحدات سكنية ${formatNumber(row?.lifetimeUnits || 0)}.`;
      }
      const best = topValue(input.performance, (row) => (row as NarrativeInput["performance"][number]).sold);
      return best ? `أعلى نطاقاً في الوحدات المباعة: ${best.name} بعدد ${formatNumber(best.value)}.` : EMPTY_BRIEF;
    }
    const field = input.performanceMode === "contract" ? "contract" : "remaining";
    return join([
      input.showIQD
        ? (() => {
          const best = topValue(input.performance, (row) => (row as NarrativeInput["performance"][number])[`${field}IQD`]);
          return best ? `أعلى ${input.performanceMode === "contract" ? "قيمة عقود" : "متبقي"} بالدينار: ${best.name} بمبلغ ${money(best.value, "IQD")}.` : "";
        })()
        : "",
      input.showUSD
        ? (() => {
          const best = topValue(input.performance, (row) => (row as NarrativeInput["performance"][number])[`${field}USD`]);
          return best ? `أعلى ${input.performanceMode === "contract" ? "قيمة عقود" : "متبقي"} بالدولار: ${best.name} بمبلغ ${money(best.value, "USD")}.` : "";
        })()
        : "",
    ]) || EMPTY_BRIEF;
  };

  const trend = input.saleScoped
    ? periodLine
    : input.trend.length > 0 ? "" : EMPTY_BRIEF;

  const legalBaseLabel = input.legalInvestment > 0 ? "وحدة مباعة أو استثمار" : "وحدة مباعة";
  const legal = input.legalBase > 0
    ? `مستلم الطابو ${formatNumber(input.receivedTabo)} من ${formatNumber(input.legalBase)} ${legalBaseLabel} (${shareOf(input.receivedTabo, input.legalBase)}). تسليم المفاتيح ${formatNumber(input.receivedUnit)} من ${formatNumber(input.legalBase)} (${shareOf(input.receivedUnit, input.legalBase)}).`
    : EMPTY_BRIEF;

  const side = (countIQD: number, amountIQD: number, countUSD: number, amountUSD: number, label: string) => {
    const parts: string[] = [];
    if (input.showIQD) parts.push(`${formatNumber(countIQD)} وحدة بمبلغ ${money(amountIQD, "IQD")}`);
    if (input.showUSD) parts.push(`${formatNumber(countUSD)} وحدة بمبلغ ${money(amountUSD, "USD")}`);
    if (countIQD + countUSD === 0) return "";
    return `${label}: ${parts.join("، ")}.`;
  };
  const obligation = join([
    side(input.obligations.taboCountIQD, input.obligations.taboIQD, input.obligations.taboCountUSD, input.obligations.taboUSD, "استلم الطابو وعليه متبقي"),
    side(input.obligations.handoverCountIQD, input.obligations.handoverIQD, input.obligations.handoverCountUSD, input.obligations.handoverUSD, "استلم المفاتيح وعليه متبقي"),
  ]) || "لا توجد وحدات استلمت الطابو أو المفاتيح وما زال عليها مبلغ.";

  const prices = join([
    input.showIQD ? priceSpan(input.pricesHouses, "IQD", "متوسط المنازل بالدينار") : "",
    input.showUSD ? priceSpan(input.pricesHouses, "USD", "متوسط المنازل بالدولار") : "",
    input.showIQD ? priceSpan(input.pricesApartments, "IQD", "متوسط الشقق بالدينار") : "",
    input.showUSD ? priceSpan(input.pricesApartments, "USD", "متوسط الشقق بالدولار") : "",
  ]) || EMPTY_BRIEF;

  return {
    cards,
    collection,
    cohort,
    centers,
    dues,
    overdue,
    status,
    performance: performanceTop(),
    trend,
    legal,
    obligation,
    obligationUnits: obligation,
    prices,
  };
};
