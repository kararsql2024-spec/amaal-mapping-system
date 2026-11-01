export type UnitKind = "house" | "apartment";
export type MatchMode = "equals" | "contains" | "startsWith";
export type CenterSource = "userName" | "unitNumber";
export type ApartmentSource = "houseType" | "area" | "unitNumber";

export interface NamedEntity {
  id: string;
  name: string;
}

export interface Company extends NamedEntity {}
export interface Center extends NamedEntity {}

export interface UnitType extends NamedEntity {
  kind: UnitKind;
  amount: number;
}

export interface CityRule {
  id: string;
  cityValue: string;
  matchMode: MatchMode;
  companyId: string;
  projectId?: string;
}

export interface CenterRule {
  id: string;
  source: CenterSource;
  matchValue: string;
  matchMode: MatchMode;
  centerId: string;
  /** مطلوب عند الاعتماد على رقم الدار حتى لا يتكرر الرقم بين المدن */
  cityValue?: string;
  cityMatchMode?: MatchMode;
  projectId?: string;
}

export interface HouseTypeRule {
  id: string;
  typeCode: string;
  unitTypeId: string;
}

export interface ApartmentTypeRule {
  id: string;
  source: ApartmentSource;
  matchValue: string;
  matchMode: MatchMode;
  unitTypeId: string;
}

export interface ColumnMapping {
  city: string;
  zone: string;
  unitNumber: string;
  userName: string;
  contractPurpose: string;
  houseType: string;
  area: string;
  contractNumber: string;
  buyerName: string;
}

export interface EligibilityConfig {
  enabled: boolean;
  matchMode: MatchMode;
  values: string[];
}

export type IncentivePrintTheme =
  | "midnight"
  | "ivory"
  | "broadsheet"
  | "atelier"
  | "carbon";

export const LEGACY_PRINT_THEMES: Record<string, IncentivePrintTheme> = {
  navy: "midnight",
  gold: "ivory",
  emerald: "broadsheet",
  classic: "atelier",
  certificate: "carbon",
  ledger: "midnight",
  folio: "ivory",
  blueprint: "broadsheet",
  sand: "atelier",
  mosaic: "carbon",
};

export interface IncentivePrintStyle {
  theme: IncentivePrintTheme;
  accentColor: string;
  documentTitle: string;
  footerNote: string;
  showWatermark: boolean;
}

export const PRINT_THEMES: Array<{
  id: IncentivePrintTheme;
  label: string;
  hint: string;
  accentColor: string;
  pageBackground: string;
}> = [
  {
    id: "midnight",
    label: "ليلي",
    hint: "ورق داكن وخطوط ذهبية رفيعة",
    accentColor: "#d4af37",
    pageBackground: "#111827",
  },
  {
    id: "ivory",
    label: "تحريري",
    hint: "عنوان كبير وعمود جانبي رفيع كمجلّة",
    accentColor: "#9a3412",
    pageBackground: "#fbf7ef",
  },
  {
    id: "broadsheet",
    label: "جريدة",
    hint: "ماستهد عريض وقواعد سوداء كثيفة",
    accentColor: "#111111",
    pageBackground: "#fffdf8",
  },
  {
    id: "atelier",
    label: "معرض",
    hint: "مساحات واسعة وتسمية لوحة فنية",
    accentColor: "#57534e",
    pageBackground: "#f4f3ef",
  },
  {
    id: "carbon",
    label: "بيانات",
    hint: "سكة يسار وتقسيم رقمي حديث",
    accentColor: "#0ea5e9",
    pageBackground: "#f1f5f9",
  },
];

export const DEFAULT_PRINT_STYLE: IncentivePrintStyle = {
  theme: "midnight",
  accentColor: "#d4af37",
  documentTitle: "كشف حافز المبيعات",
  footerNote: "نظام الحوافز",
  showWatermark: true,
};

/** تخصيص يدوي لوحدة مباعة داخل شهر معيّن: تضمين/استبعاد وتعيين المركز */
export interface UnitCenterOverride {
  id: string;
  monthKey: string;
  projectId: string;
  unitKey: string;
  unitNumber: string;
  included: boolean;
  centerId: string;
}

export interface MonthSnapshot {
  monthKey: string;
  savedAt: string;
  results: IncentiveResult[];
}

export interface IncentiveSettings {
  companies: Company[];
  centers: Center[];
  unitTypes: UnitType[];
  cityRules: CityRule[];
  centerRules: CenterRule[];
  houseTypeRules: HouseTypeRule[];
  apartmentTypeRules: ApartmentTypeRule[];
  unitOverrides: UnitCenterOverride[];
  monthSnapshots: MonthSnapshot[];
  eligibility: EligibilityConfig;
  printStyle: IncentivePrintStyle;
  columns: ColumnMapping;
  updatedAt?: string;
}

export interface ParsedUnitCode {
  kind: UnitKind | "unknown";
  raw: string;
  typeCode: string;
  zone?: string;
  block?: string;
  houseNum?: string;
  building?: string;
  floor?: string;
  apartment?: string;
}

export interface SaleRow {
  rowNumber: number;
  cells: Record<string, string>;
  city: string;
  zone: string;
  unitNumber: string;
  userName: string;
  contractPurpose: string;
  houseType: string;
  area: string;
  contractNumber: string;
  buyerName: string;
  projectId?: string;
  unitKey?: string;
  saleDate?: string;
}

export interface IncentiveResult {
  row: SaleRow;
  parsed: ParsedUnitCode;
  included: boolean;
  skipReason?: string;
  company?: Company;
  center?: Center;
  unitType?: UnitType;
  amount: number;
  sentence: string;
  missing: string[];
  autoCenterId?: string;
  overrideApplied?: boolean;
  conflictNote?: string;
}

export interface IncentiveSummary {
  totalRows: number;
  includedCount: number;
  skippedCount: number;
  completeCount: number;
  incompleteCount: number;
  totalAmount: number;
  byCenter: Array<{ name: string; count: number; amount: number; id?: string }>;
  byCompany: Array<{ name: string; count: number; amount: number }>;
  byUnitType: Array<{ name: string; count: number; amount: number }>;
  byUserName: Array<{ name: string; count: number; amount: number }>;
  conflictCount: number;
}

export const DEFAULT_COLUMNS: ColumnMapping = {
  city: "اسم المدينة",
  zone: "اسم الزون",
  unitNumber: "رقم الدار",
  userName: "اسم المستخدم",
  contractPurpose: "الغاية من العقد",
  houseType: "نوع المنزل",
  area: "المساحة",
  contractNumber: "رقم العقد",
  buyerName: "اسم المشتري",
};

export const EMPTY_SETTINGS: IncentiveSettings = {
  companies: [],
  centers: [],
  unitTypes: [],
  cityRules: [],
  centerRules: [],
  houseTypeRules: [],
  apartmentTypeRules: [],
  unitOverrides: [],
  monthSnapshots: [],
  eligibility: {
    enabled: true,
    matchMode: "equals",
    values: [],
  },
  printStyle: { ...DEFAULT_PRINT_STYLE },
  columns: { ...DEFAULT_COLUMNS },
};
