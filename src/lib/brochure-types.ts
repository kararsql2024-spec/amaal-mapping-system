export interface BrochureUnitDetail {
  rooms?: string;
  roomsSizes?: string;
  unitImage?: string;
  unitImage2?: string;
  unitDescription?: string;
  housePlan?: string;
  totalPrice?: string;
  contractAmount?: string;
  paymentDuration?: string;
  firstInstallment?: string;
  paymentPlanDetails?: string;
}

export interface BrochureConfig {
  primaryColor?: string;
  secondaryColor?: string;
  slogan?: string;
  projectLogo?: string;
  selectedTemplate?: string;
  advantages?: Record<string, string[]>;
  unitDetails?: Record<string, BrochureUnitDetail>;
}

export interface BrochureTemplateMeta {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  /** Gradient shown in the template picker */
  preview: string;
}

/** قوالب البروشور — كل قالب له هوية بصرية مميزة */
export const BROCHURE_TEMPLATES: BrochureTemplateMeta[] = [
  {
    id: "emerald_luxe",
    name: "الزمردي الفاخر",
    description: "أخضر عميق مع تدرجات ذهبية — مناسب للمشاريع الراقية",
    primary: "#1B6B52",
    secondary: "#F4F9F6",
    preview: "linear-gradient(135deg, #1B6B52 0%, #3F9B78 50%, #D4AF37 100%)",
  },
  {
    id: "royal_navy",
    name: "الملكي الكحلي",
    description: "كحلي ملكي مع خطوط فضية — طابع نخبوي",
    primary: "#1E3A5F",
    secondary: "#EEF2F7",
    preview: "linear-gradient(160deg, #0F2440 0%, #1E3A5F 45%, #C0C8D4 100%)",
  },
  {
    id: "midnight_gold",
    name: "منتصف الليل الذهبي",
    description: "أسود أنيق مع لمسات ذهبية — فخامة عصرية",
    primary: "#C9A227",
    secondary: "#141820",
    preview: "linear-gradient(145deg, #141820 0%, #2A3040 40%, #C9A227 100%)",
  },
  {
    id: "sunset_terracotta",
    name: "غروب تراكوتا",
    description: "دفء ترابي وبرتقالي — أجواء متوسطية",
    primary: "#C45C26",
    secondary: "#FFF8F2",
    preview: "linear-gradient(135deg, #8B3A1A 0%, #C45C26 50%, #F5D0A8 100%)",
  },
  {
    id: "marble_minimal",
    name: "الرخامي البسيط",
    description: "أبيض نظيف مع خطوط رمادية — أناقة سويسرية",
    primary: "#304653",
    secondary: "#FAFAFA",
    preview: "linear-gradient(180deg, #FAFAFA 0%, #E8EAEC 50%, #304653 100%)",
  },
  {
    id: "forest_retreat",
    name: "ملاذ الغابة",
    description: "أخضر طبيعي مع beige — هدوء واستثمار",
    primary: "#2D5A3D",
    secondary: "#F5F0E8",
    preview: "linear-gradient(140deg, #1A3D28 0%, #2D5A3D 55%, #E8DFD0 100%)",
  },
  {
    id: "copper_urban",
    name: "النحاسي الحضري",
    description: "نحاس ورمادي داكن — عصري وحضري",
    primary: "#B87333",
    secondary: "#2C2C2C",
    preview: "linear-gradient(150deg, #2C2C2C 0%, #4A4A4A 40%, #B87333 100%)",
  },
  {
    id: "azure_coast",
    name: "الساحلي الأزرق",
    description: "أزرق سماوي منعش — مشاريع الواجهة المائية",
    primary: "#1A6B8A",
    secondary: "#F0F8FC",
    preview: "linear-gradient(135deg, #0D4F6E 0%, #1A6B8A 50%, #7EC8E3 100%)",
  },
];

const LEGACY_TEMPLATE_MAP: Record<string, string> = {
  classic_gold: "emerald_luxe",
  modern_dark: "midnight_gold",
  prestige_blue: "royal_navy",
  emerald_garden: "forest_retreat",
};

export const normalizeTemplateId = (id?: string | null): string => {
  if (!id) return "emerald_luxe";
  return LEGACY_TEMPLATE_MAP[id] || id;
};

export const getBrochureTemplate = (id?: string | null): BrochureTemplateMeta => {
  const normalized = normalizeTemplateId(id);
  return (
    BROCHURE_TEMPLATES.find((t) => t.id === normalized) ??
    BROCHURE_TEMPLATES[0]
  );
};

export const DEFAULT_BROCHURE_CONFIG: BrochureConfig = {
  primaryColor: BROCHURE_TEMPLATES[0].primary,
  secondaryColor: BROCHURE_TEMPLATES[0].secondary,
  slogan: "حيث ترتقي الرفاهية المعمارية وتلتقي مع الهدوء والاستثمار المضمون",
  projectLogo: "",
  selectedTemplate: "emerald_luxe",
  advantages: {},
  unitDetails: {},
};
