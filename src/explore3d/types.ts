export type GroundKind = "road" | "sidewalk" | "green" | "pitch";

export interface WorldPoint {
  x: number;
  z: number;
}

export interface GroundPoly {
  id: string;
  kind: GroundKind;
  points: WorldPoint[];
  holes?: WorldPoint[][];
  /** محاور الشارع، لرسم الخط المتقطع وأعمدة الإنارة. */
  lanes?: WorldPoint[][];
  widthM?: number;
}

export type PlaceKind = "house" | "tower" | "apartment" | "tree" | "amenity";

export interface PlacedInstance {
  id: string;
  kind: PlaceKind;
  amenityType?: string;
  label: string;
  x: number;
  y?: number;
  z: number;
  rotY: number;
  /** مفتاح الشقة في النظام الحالي، مثل towerId_F2_A3. */
  unitKey?: string;
  sx: number;
  sy: number;
  sz: number;
  /** بصمة المنزل بعد الدوران. تُرسم كما هي، لا كمستطيل الطول والعرض. */
  points?: WorldPoint[];
  color: number;
  status?: string;
  floors?: number;
  apartmentsPerFloor?: number;
  /** طابق البرج، من 1. */
  floor?: number;
  /** رقم الشقة في الطابق، من 1. */
  apt?: number;
  /** رمز الوحدة كما في بقية النظام، مثل A19-F1-P7. الطابق الأرضي FG. */
  code?: string;
}

export interface ExplorePick {
  id: string;
  kind: PlaceKind;
  amenityType?: string;
  label: string;
  status?: string;
  floors?: number;
  apartmentsPerFloor?: number;
  floor?: number;
  apt?: number;
  unitKey?: string;
}

export interface ExploreWorld {
  metersPerPixel: number;
  /** امتداد المشهد بالأمتار، لضبط الكاميرا. */
  spanM: number;
  /** أرضية المشروع فقط، بلا إطار الصورة المرجعية. */
  siteWidthM: number;
  siteDepthM: number;
  ground: GroundPoly[];
  houses: PlacedInstance[];
  /** كتلة كل عمارة مرة واحدة، بمقاس بصمتها في المخطط. */
  towers: PlacedInstance[];
  /** واجهة كل شقة، ملوّنة بحالتها. */
  apartments: PlacedInstance[];
  /** فواصل بين الشقق وبين الطوابق، وكتلة السطح. */
  joints: PlacedInstance[];
  trees: PlacedInstance[];
  shrubs: PlacedInstance[];
  amenities: PlacedInstance[];
}

export interface UnitLite {
  status?: string;
  price?: string;
  currency?: string;
}
