import { formatNumber } from "@/lib/format";
import { collectionRate, type CollectionRow, type ObligationUnit } from "@/lib/report-collection";
import {
  buildBriefs,
  formatPct,
  type NarrativeInput,
  type ReportSectionId,
} from "@/lib/report-narrative";

export interface ReportTable {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  footer?: (string | number)[];
}

export interface PerformancePoint {
  name: string;
  bars: { key: string; value: number; color: string }[];
}

export interface PerformanceView {
  houses: PerformancePoint[];
  apartments: PerformancePoint[];
  houseTotal: PerformancePoint | null;
  apartmentTotal: PerformancePoint | null;
}

export interface ReportPack {
  title: string;
  projectName: string;
  projectNames: string[];
  salePeriod: string;
  exportedAt: string;
  scope: string[];
  sections: ReportSectionId[];
  briefs: Record<ReportSectionId, string>;
  showIQD: boolean;
  showUSD: boolean;
  cards: { label: string; value: string; hint: string }[];
  tables: Partial<Record<ReportSectionId, ReportTable[]>>;
  status: { name: string; value: number; color: string }[];
  performanceChart: PerformancePoint[] | null;
  performanceMeasure: NarrativeInput["performanceMode"];
  performanceHouses: PerformancePoint[];
  performanceApartments: PerformancePoint[];
  performanceViews?: Record<"count" | "contract" | "remaining", PerformanceView>;
  trend: NarrativeInput["trend"];
  trendChart: boolean;
  duesMeters: { group: string; label: string; value: number; total: number }[];
  dueMonths: NarrativeInput["dueMonths"];
  dueMonthsChart: boolean;
  legal: { label: string; value: number; total: number }[];
}

export interface PackColors {
  total: string;
  sold: string;
  investment: string;
  contractIqd: string;
  contractUsd: string;
  remaining: string;
}

const TOP = 5;

const takeTop = <T,>(rows: T[], on: boolean, score: (row: T) => number): { rows: T[]; capped: boolean } => {
  if (!on || rows.length <= TOP) return { rows, capped: false };
  return {
    rows: [...rows].sort((a, b) => score(b) - score(a)).slice(0, TOP),
    capped: true,
  };
};

const titled = (title: string, capped: boolean) => (capped ? `${title} — أعلى 5` : title);

const rateCell = (received: number, remaining: number) => formatPct(collectionRate(received, remaining));

const moneyHeaders = (showIQD: boolean, showUSD: boolean, withRate = true): string[] => [
  ...(showIQD ? ["عقد د.ع", "واصل د.ع", "متبقي د.ع", ...(withRate ? ["نسبة د.ع"] : [])] : []),
  ...(showUSD ? ["عقد $", "واصل $", "متبقي $", ...(withRate ? ["نسبة $"] : [])] : []),
];

const moneyCells = (row: CollectionRow, showIQD: boolean, showUSD: boolean, withRate = true): (string | number)[] => [
  ...(showIQD ? [row.fileIQD, row.receivedIQD, row.remainingIQD, ...(withRate ? [rateCell(row.receivedIQD, row.remainingIQD)] : [])] : []),
  ...(showUSD ? [row.fileUSD, row.receivedUSD, row.remainingUSD, ...(withRate ? [rateCell(row.receivedUSD, row.remainingUSD)] : [])] : []),
];

const unitTable = (title: string, rows: ObligationUnit[], currency: "IQD" | "USD"): ReportTable => {
  const visible = rows.filter((row) => row.currency === currency);
  return {
    title,
    headers: ["الزبون", "الوحدة", "الهاتف", "المتبقي"],
    rows: visible.map((row) => [row.customerName || "—", row.label || "—", row.phone || "—", row.amount]),
    footer: visible.length > 0 ? ["المجموع", "—", "—", visible.reduce((sum, row) => sum + row.amount, 0)] : undefined,
  };
};

const sumBy = <T,>(rows: T[], pick: (row: T) => number) => rows.reduce((sum, row) => sum + pick(row), 0);

const moneyFooter = (rows: CollectionRow[], showIQD: boolean, showUSD: boolean): (string | number)[] => [
  ...(showIQD ? [sumBy(rows, (row) => row.fileIQD), sumBy(rows, (row) => row.receivedIQD), sumBy(rows, (row) => row.remainingIQD), rateCell(sumBy(rows, (row) => row.receivedIQD), sumBy(rows, (row) => row.remainingIQD))] : []),
  ...(showUSD ? [sumBy(rows, (row) => row.fileUSD), sumBy(rows, (row) => row.receivedUSD), sumBy(rows, (row) => row.remainingUSD), rateCell(sumBy(rows, (row) => row.receivedUSD), sumBy(rows, (row) => row.remainingUSD))] : []),
];

export const buildReportPack = (
  input: NarrativeInput,
  extras: {
    title: string;
    projectName: string;
    projectNames: string[];
    salePeriod: string;
    scope: string[];
    sections: ReportSectionId[];
    briefSections: ReportSectionId[];
    cards: ReportPack["cards"];
    status: ReportPack["status"];
    legal: ReportPack["legal"];
    colors: PackColors;
  },
): ReportPack => {
  const briefs = buildBriefs(input);
  const { showIQD, showUSD } = input;
  const briefOn = (id: ReportSectionId) => extras.briefSections.includes(id);
  const remainScore = <T extends { remainingIQD: number; remainingUSD: number }>(row: T) => (showIQD ? row.remainingIQD : row.remainingUSD);
  const tables: ReportPack["tables"] = {};

  const collectionPick = takeTop(input.collection, briefOn("collection"), remainScore);
  tables.collection = [{
    title: titled("موقف التسديد", collectionPick.capped),
    headers: ["النطاق", ...moneyHeaders(showIQD, showUSD), "سددوا", "عليهم"],
    rows: collectionPick.rows.map((row) => [row.name, ...moneyCells(row, showIQD, showUSD), row.paid, row.owing]),
    footer: input.collection.length > 0 ? ["المجموع", ...moneyFooter(input.collection, showIQD, showUSD), sumBy(input.collection, (row) => row.paid), sumBy(input.collection, (row) => row.owing)] : undefined,
  }];

  const cohortPick = takeTop(input.cohorts, briefOn("cohort"), remainScore);
  tables.cohort = [{
    title: titled("عمر الدين", cohortPick.capped),
    headers: ["السنة", "الوحدات", ...moneyHeaders(showIQD, showUSD)],
    rows: cohortPick.rows.map((row) => [row.name, row.count, ...moneyCells(row, showIQD, showUSD)]),
    footer: input.cohorts.length > 0 ? ["المجموع", sumBy(input.cohorts, (row) => row.count), ...moneyFooter(input.cohorts, showIQD, showUSD)] : undefined,
  }];

  const centerPick = takeTop(input.centers, briefOn("centers"), remainScore);
  tables.centers = [{
    title: titled("المراكز", centerPick.capped),
    headers: ["المركز", ...moneyHeaders(showIQD, showUSD), "عليهم"],
    rows: centerPick.rows.map((row) => [row.name, ...moneyCells(row, showIQD, showUSD), row.owing]),
    footer: input.centers.length > 0 ? ["المجموع", ...moneyFooter(input.centers, showIQD, showUSD), sumBy(input.centers, (row) => row.owing)] : undefined,
  }];

  const duesRows: (string | number)[][] = [];
  if (showIQD) {
    duesRows.push(["دينار", "متأخر", input.overdueIQD]);
    duesRows.push(["دينار", "مستحق اليوم", input.todayIQD]);
    duesRows.push(["دينار", "قادم", input.upcomingIQD]);
    duesRows.push(["دينار", "مستحق خلال 30 يوماً", input.soonIQD]);
    if (input.ageMode === "slices") duesRows.push(["دينار", "أكثر من 90 يوماً", input.ageOverIQD]);
  }
  if (showUSD) {
    duesRows.push(["دولار", "متأخر", input.overdueUSD]);
    duesRows.push(["دولار", "مستحق اليوم", input.todayUSD]);
    duesRows.push(["دولار", "قادم", input.upcomingUSD]);
    duesRows.push(["دولار", "مستحق خلال 30 يوماً", input.soonUSD]);
    if (input.ageMode === "slices") duesRows.push(["دولار", "أكثر من 90 يوماً", input.ageOverUSD]);
  }
  const monthPick = takeTop(input.dueMonths, briefOn("dues"), (month) => (showIQD ? month.iqd : month.usd));
  monthPick.rows.forEach((month) => {
    duesRows.push(["شهر", month.name, ...(showIQD ? [month.iqd] : []), ...(showUSD ? [month.usd] : [])]);
  });
  tables.dues = [{
    title: titled("الاستحقاقات", monthPick.capped),
    headers: ["النطاق", "البند", "المبلغ", ...(monthPick.rows.length > 0 && showIQD && showUSD ? ["دولار الشهر"] : [])],
    rows: duesRows,
  }];

  const overdueTables: ReportTable[] = [];
  const overdueSlice = (rows: NarrativeInput["overdueHits"]["iqd"]) => {
    const picked = takeTop(rows, briefOn("overdue"), (row) => row.amount);
    return picked;
  };
  const overdueIqd = overdueSlice(input.overdueHits.iqd);
  const overdueUsd = overdueSlice(input.overdueHits.usd);
  if (showIQD) {
    overdueTables.push({
      title: titled("أكبر المتأخرات — دينار", overdueIqd.capped),
      headers: ["الزبون", "الوحدة", "الهاتف", "المتأخر", "أقدم دفعة"],
      rows: overdueIqd.rows.map((row) => [row.customerName || "—", row.label || "—", row.phone || "—", row.amount, row.ageLabel || "—"]),
      footer: overdueIqd.rows.length > 0 ? ["المجموع", "—", "—", sumBy(overdueIqd.rows, (row) => row.amount), "—"] : undefined,
    });
  }
  if (showUSD) {
    overdueTables.push({
      title: titled("أكبر المتأخرات — دولار", overdueUsd.capped),
      headers: ["الزبون", "الوحدة", "الهاتف", "المتأخر", "أقدم دفعة"],
      rows: overdueUsd.rows.map((row) => [row.customerName || "—", row.label || "—", row.phone || "—", row.amount, row.ageLabel || "—"]),
      footer: overdueUsd.rows.length > 0 ? ["المجموع", "—", "—", sumBy(overdueUsd.rows, (row) => row.amount), "—"] : undefined,
    });
  }
  tables.overdue = overdueTables;

  tables.status = [{
    title: "توزيع المبيعات",
    headers: ["الحالة", "العدد"],
    rows: extras.status.map((row) => [row.name, row.value]),
    footer: extras.status.length > 0 ? ["المجموع", sumBy(extras.status, (row) => row.value)] : undefined,
  }];

  const performanceScore = (row: NarrativeInput["performance"][number]) => {
    if (input.performanceMode === "count") return input.saleScoped ? row.periodContracts : row.sold;
    if (input.performanceMode === "contract") return showIQD ? row.contractIQD : row.contractUSD;
    return showIQD ? row.remainingIQD : row.remainingUSD;
  };
  const countBars = (row: NarrativeInput["performance"][number]) => input.saleScoped
    ? [
      { key: "عقود الفترة", value: row.periodContracts, color: extras.colors.sold },
      { key: "إجمالي المبيعات", value: row.lifetimeSales, color: extras.colors.contractIqd },
      { key: "إجمالي الوحدات السكنية", value: row.lifetimeUnits, color: extras.colors.total },
    ]
    : [
      { key: "الإجمالي", value: row.total, color: extras.colors.total },
      { key: "المباعة", value: row.sold, color: extras.colors.sold },
      { key: "الاستثمار", value: row.investment, color: extras.colors.investment },
    ];
  const toPerformancePoints = (rows: NarrativeInput["performance"], mode: NarrativeInput["performanceMode"]): PerformancePoint[] => rows.map((row) => ({
    name: row.name,
    bars: mode === "count"
      ? countBars(row)
      : [
        ...(showIQD ? [{
          key: mode === "contract" ? "قيمة العقود د.ع" : "المتبقي د.ع",
          value: mode === "contract" ? row.contractIQD : row.remainingIQD,
          color: mode === "contract" ? extras.colors.contractIqd : extras.colors.remaining,
        }] : []),
        ...(showUSD ? [{
          key: mode === "contract" ? "قيمة العقود $" : "المتبقي $",
          value: mode === "contract" ? row.contractUSD : row.remainingUSD,
          color: extras.colors.contractUsd,
        }] : []),
      ],
  }));
  const summarizePerformance = (rows: NarrativeInput["performance"]): NarrativeInput["performance"][number] => ({
    name: "المجموع",
    total: sumBy(rows, (row) => row.total),
    sold: sumBy(rows, (row) => row.sold),
    investment: sumBy(rows, (row) => row.investment),
    periodContracts: sumBy(rows, (row) => row.periodContracts),
    lifetimeSales: sumBy(rows, (row) => row.lifetimeSales),
    lifetimeUnits: sumBy(rows, (row) => row.lifetimeUnits),
    contractIQD: sumBy(rows, (row) => row.contractIQD),
    contractUSD: sumBy(rows, (row) => row.contractUSD),
    remainingIQD: sumBy(rows, (row) => row.remainingIQD),
    remainingUSD: sumBy(rows, (row) => row.remainingUSD),
  });
  const housesPick = takeTop(input.performanceHouses, briefOn("performance"), performanceScore);
  const apartmentsPick = takeTop(input.performanceApartments, briefOn("performance"), performanceScore);
  const performanceHouses = toPerformancePoints(housesPick.rows, input.performanceMode);
  const performanceApartments = toPerformancePoints(apartmentsPick.rows, input.performanceMode);
  const performanceHeaders = [
    "النطاق",
    ...(input.saleScoped ? ["عقود الفترة", "إجمالي المبيعات", "إجمالي الوحدات السكنية"] : ["الإجمالي", "المباعة", "الاستثمار"]),
    ...(showIQD ? ["قيمة العقود د.ع", "المتبقي د.ع"] : []),
    ...(showUSD ? ["قيمة العقود $", "المتبقي $"] : []),
  ];
  const performanceCells = (row: NarrativeInput["performance"][number]): (string | number)[] => [
    row.name,
    ...(input.saleScoped ? [row.periodContracts, row.lifetimeSales, row.lifetimeUnits] : [row.total, row.sold, row.investment]),
    ...(showIQD ? [row.contractIQD, row.remainingIQD] : []),
    ...(showUSD ? [row.contractUSD, row.remainingUSD] : []),
  ];
  const performanceTable = (title: string, picked: { rows: NarrativeInput["performance"]; capped: boolean }, source: NarrativeInput["performance"]): ReportTable => ({
    title: titled(title, picked.capped),
    headers: performanceHeaders,
    rows: picked.rows.map(performanceCells),
    footer: source.length > 0 ? performanceCells(summarizePerformance(source)) : undefined,
  });
  tables.performance = [
    performanceTable("المنازل حسب الزون", housesPick, input.performanceHouses),
    performanceTable("الشقق حسب العمارة", apartmentsPick, input.performanceApartments),
  ];
  const hasMeasure = (row: NarrativeInput["performance"][number], mode: NarrativeInput["performanceMode"]) => {
    if (mode === "count") return input.saleScoped ? row.lifetimeUnits > 0 : row.total > 0 || row.sold > 0 || row.investment > 0;
    if (mode === "contract") return row.contractIQD > 0 || row.contractUSD > 0;
    return row.remainingIQD > 0 || row.remainingUSD > 0;
  };
  const trimEmptyBars = (points: PerformancePoint[], total: PerformancePoint | null) => {
    const used = new Set<string>();
    [...points, ...(total ? [total] : [])].forEach((point) => point.bars.forEach((bar) => { if (bar.value !== 0) used.add(bar.key); }));
    const trim = (point: PerformancePoint): PerformancePoint => ({ ...point, bars: point.bars.filter((bar) => used.has(bar.key)) });
    return { points: points.map(trim), total: total ? trim(total) : null };
  };
  const performanceView = (mode: NarrativeInput["performanceMode"]): PerformanceView => {
    const houseTotal = input.performanceHouses.length > 0 ? toPerformancePoints([summarizePerformance(input.performanceHouses)], mode)[0] : null;
    const apartmentTotal = input.performanceApartments.length > 0 ? toPerformancePoints([summarizePerformance(input.performanceApartments)], mode)[0] : null;
    const houses = trimEmptyBars(toPerformancePoints(housesPick.rows.filter((row) => hasMeasure(row, mode)), mode), houseTotal);
    const apartments = trimEmptyBars(toPerformancePoints(apartmentsPick.rows.filter((row) => hasMeasure(row, mode)), mode), apartmentTotal);
    return {
      houses: houses.points,
      apartments: apartments.points,
      houseTotal: houses.total,
      apartmentTotal: apartments.total,
    };
  };
  const performanceViews: Record<"count" | "contract" | "remaining", PerformanceView> = {
    count: performanceView("count"),
    contract: performanceView("contract"),
    remaining: performanceView("remaining"),
  };

  const trendPick = takeTop(input.trend, briefOn("trend"), (row) => (showIQD ? row.iqd : showUSD ? row.usd : row.count));
  const trendSource = trendPick.capped ? trendPick.rows : input.trend;
  tables.trend = [{
    title: titled("منحنى المبيعات", trendPick.capped),
    headers: ["الشهر", "عدد الوحدات", ...(showIQD ? ["قيمة البيع د.ع"] : []), ...(showUSD ? ["قيمة البيع $"] : [])],
    rows: trendPick.rows.map((row) => [row.name, row.count, ...(showIQD ? [row.iqd] : []), ...(showUSD ? [row.usd] : [])]),
    footer: trendSource.length > 0 ? ["المجموع", sumBy(trendSource, (row) => row.count), ...(showIQD ? [sumBy(trendSource, (row) => row.iqd)] : []), ...(showUSD ? [sumBy(trendSource, (row) => row.usd)] : [])] : undefined,
  }];

  tables.legal = [{
    title: "الموقف القانوني",
    headers: ["البند", "العدد", "من أصل"],
    rows: extras.legal.map((row) => [row.label, row.value, row.total]),
  }];

  tables.obligation = [{
    title: "الطابو والتسليم",
    headers: ["البند", "العملة", "الوحدات", "المتبقي"],
    rows: [
      ...(showIQD ? [
        ["استلم الطابو", "دينار", input.obligations.taboCountIQD, input.obligations.taboIQD],
        ["استلم المفاتيح", "دينار", input.obligations.handoverCountIQD, input.obligations.handoverIQD],
      ] : []),
      ...(showUSD ? [
        ["استلم الطابو", "دولار", input.obligations.taboCountUSD, input.obligations.taboUSD],
        ["استلم المفاتيح", "دولار", input.obligations.handoverCountUSD, input.obligations.handoverUSD],
      ] : []),
    ],
  }];

  const detailTables: ReportTable[] = [];
  const capUnits = (table: ReportTable): ReportTable => {
    if (!briefOn("obligationUnits") || table.rows.length <= TOP) return table;
    return { ...table, title: titled(table.title, true), rows: table.rows.slice(0, TOP) };
  };
  if (showIQD) {
    detailTables.push(capUnits(unitTable("استلم الطابو — دينار", input.obligations.tabo, "IQD")));
    detailTables.push(capUnits(unitTable("استلم المفاتيح — دينار", input.obligations.handover, "IQD")));
  }
  if (showUSD) {
    detailTables.push(capUnits(unitTable("استلم الطابو — دولار", input.obligations.tabo, "USD")));
    detailTables.push(capUnits(unitTable("استلم المفاتيح — دولار", input.obligations.handover, "USD")));
  }
  tables.obligationUnits = detailTables;

  const priceRows = (title: string, rows: NarrativeInput["pricesHouses"]): ReportTable => {
    const picked = takeTop(rows, briefOn("prices"), (row) => (showIQD ? row.iqd : row.usd));
    return {
      title: titled(title, picked.capped),
      headers: ["النوع", ...(showIQD ? ["متوسط د.ع"] : []), ...(showUSD ? ["متوسط $"] : [])],
      rows: picked.rows.map((row) => [row.name, ...(showIQD ? [row.iqd] : []), ...(showUSD ? [row.usd] : [])]),
    };
  };
  tables.prices = [priceRows("المنازل", input.pricesHouses), priceRows("الشقق", input.pricesApartments)];

  const performanceChart = housesPick.rows.length > 0 && housesPick.rows.length <= 8
    ? housesPick.rows.map((row) => ({
      name: row.name,
      bars: input.performanceMode === "count"
        ? countBars(row)
        : [
          ...(showIQD ? [{
            key: input.performanceMode === "contract" ? "عقود د.ع" : "متبقي د.ع",
            value: input.performanceMode === "contract" ? row.contractIQD : row.remainingIQD,
            color: input.performanceMode === "contract" ? extras.colors.contractIqd : extras.colors.remaining,
          }] : []),
          ...(showUSD ? [{
            key: input.performanceMode === "contract" ? "عقود $" : "متبقي $",
            value: input.performanceMode === "contract" ? row.contractUSD : row.remainingUSD,
            color: extras.colors.contractUsd,
          }] : []),
        ],
    }))
    : null;

  const openIQD = input.overdueIQD + input.todayIQD + input.upcomingIQD;
  const openUSD = input.overdueUSD + input.todayUSD + input.upcomingUSD;
  const meter = (group: string, label: string, value: number, total: number) => ({ group, label, value, total });
  const duesMeters = [
    ...(showIQD ? [
      meter("دينار", "متأخر", input.overdueIQD, openIQD),
      meter("دينار", "مستحق اليوم", input.todayIQD, openIQD),
      meter("دينار", "قادم", input.upcomingIQD, openIQD),
    ] : []),
    ...(showUSD ? [
      meter("دولار", "متأخر", input.overdueUSD, openUSD),
      meter("دولار", "مستحق اليوم", input.todayUSD, openUSD),
      meter("دولار", "قادم", input.upcomingUSD, openUSD),
    ] : []),
  ];

  return {
    title: extras.title,
    projectName: extras.projectName,
    projectNames: extras.projectNames,
    salePeriod: extras.salePeriod,
    exportedAt: new Date().toLocaleString("ar-IQ", { dateStyle: "medium", timeStyle: "short" }),
    scope: extras.scope,
    sections: extras.sections,
    briefs,
    showIQD,
    showUSD,
    cards: extras.cards,
    tables,
    status: extras.status,
    performanceChart,
    performanceMeasure: input.performanceMode,
    performanceHouses,
    performanceApartments,
    performanceViews,
    trend: trendPick.capped ? trendPick.rows : input.trend,
    trendChart: !trendPick.capped && input.trend.length > 0 && input.trend.length <= 12,
    duesMeters,
    dueMonths: monthPick.rows,
    dueMonthsChart: monthPick.rows.length > 0,
    legal: extras.legal,
  };
};

export const PRINT_STORAGE_KEY = "amaal-report-print-v1";

export const saveReportPack = (pack: ReportPack) => {
  localStorage.setItem(PRINT_STORAGE_KEY, JSON.stringify(pack));
};

export const loadReportPack = (): ReportPack | null => {
  try {
    const raw = localStorage.getItem(PRINT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ReportPack;
  } catch {
    return null;
  }
};

export const amountLabel = (value: number) => formatNumber(value);
