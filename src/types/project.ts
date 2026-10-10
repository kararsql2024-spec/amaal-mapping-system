export type ElementType = 'house' | 'tower' | 'road' | 'sidewalk' | 'green' | 'amenity' | 'label_area' | 'pitch' | 'text' | 'reference_image';

export interface Point {
  y: number;
  x: number;
}

export interface MapElement {
  id: string;
  type: ElementType;
  label: string;
  points: Point[];
  rotation: number;
  orientation?: 'horizontal' | 'vertical';
  color?: string;
  /** رابط صورة مرجعية في Supabase Storage (بديل عن Base64 في color) */
  imageUrl?: string;
  textColor?: string;
  opacity?: number; 
  hideIcon?: boolean;
  floors?: number;
  apartmentsPerFloor?: number;
  groundFloorSizes?: number[]; // مساحات شقق الطابق الأرضي
  typicalFloorSizes?: number[]; // مساحات شقق الطابق المتكرر
  customArea?: number; // المساحة المخصصة للمنزل يدوياً (تتجاوز المساحة القياسية للصنف)
  x: number; 
  y: number;
  width: number;
  height: number;
  amenityType?: string;
  strokeWidth?: number;
  isStroke?: boolean;
  fontSize?: number;
  fontFamily?: string;
  locked?: boolean;
  showInMain?: boolean;
  isBold?: boolean;
  hasBorder?: boolean;
  borderColor?: string;
  hasTexture?: boolean;
  textureType?: string;
  textureColor?: string;
  textureSize?: number;
  linkProjectId?: string; // معرف المشروع السكني المرتبط بهذا العنصر كزر انتقال
  /** مسار وسط الطريق أو الرصيف. التوليد يبني العرض حوله */
  centerline?: Point[];
  /** تفرعات تبدأ من نقطة على المسار بعد الربط */
  centerlineBranches?: Point[][];
  /** عرض الشريط بالبكسل */
  pathWidth?: number;
  /** اتجاه الضلع الأول بالدرجات. لا يدوّر الشكل، بل يحدد القفل المحلي */
  pathAngle?: number;
  /** المسار مغلق على نقطة البداية */
  pathClosed?: boolean;
  /** فراغات داخل الطريق المغلق أو المتداخل */
  pathHoles?: Point[][];
  /** حلقات مغلقة إضافية، مثل شارع يحيط ببلوك ولم يُدمج ضلعه */
  pathLoops?: Point[][];
  /** نُتج من توليد الشوارع داخل منطقة، لا من رسم المسار يدوياً */
  pathGenerated?: boolean;

  /**
   * حقول مؤقتة تُضاف أثناء دمج عناصر عدة مشاريع في قائمة واحدة (لوحة التقارير).
   * ليست جزءاً من المخطط المخزّن في قاعدة البيانات.
   */
  _projectId?: string;
  _projectName?: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  elements: MapElement[];
  mapWidth: number;
  mapHeight: number;
  createdAt: string;
  houseTypeAreas?: Record<string, number>; // مساحات الأصناف القياسية للمنازل (مثال: TYPE D = 240)
}