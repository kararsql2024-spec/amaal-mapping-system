export type TourKind = "apartment" | "house";

export type PieceId =
  | "sofa"
  | "armchair"
  | "coffee"
  | "doubleBed"
  | "singleBed"
  | "wardrobe"
  | "dining"
  | "kitchen"
  | "bathroom"
  | "rug"
  | "tv"
  | "kidsBed"
  | "toyBox"
  | "kidsShelf"
  | "car"
  | "garden"
  | "desk"
  | "officeChair"
  | "plant"
  | "lamp"
  | "nightstand"
  | "bookshelf"
  | "dresser"
  | "curtain"
  | "catLadder";

export type ItemKind = "room" | "balcony" | "furniture" | "hotspot" | "stairs" | "garden" | "text";

export type OpeningKind = "door" | "mainDoor" | "outerDoor" | "slideDoor" | "window" | "balcony";

export interface TourPoint {
  x: number;
  y: number;
}

export interface TourWall {
  id: string;
  floor: number;
  points: TourPoint[];
}

export interface TourOpening {
  id: string;
  kind: OpeningKind;
  floor: number;
  wallId: string;
  /** مسافة مركز الفتحة من أول نقطة في الجدار. */
  at: number;
  width: number;
  /** جهة خروج البلكونة عن محور الجدار: 1 أو -1. */
  side?: number;
}

export interface TourItem {
  id: string;
  kind: ItemKind;
  floor: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** درجات باتجاه عقارب المخطط. */
  rot: number;
  scale: number;
  label?: string;
  /** نص يظهر تحت الاسم عند التأشير على نقطة الجولة. */
  note?: string;
  piece?: PieceId;
  /** حدود الحديقة أو الدرج على المخطط. */
  points?: TourPoint[];
  /** إزاحة فتحة السلم على الطابق الأعلى فقط. لا تحرّك السلم في طابقه. */
  above?: TourPoint;
}

export interface PlanFrame {
  scale: number;
  x: number;
  y: number;
}

export interface TourTemplate {
  id: string;
  name: string;
  kind: TourKind;
  floors: number;
  projectId: string;
  /** كل المشاريع التي تستخدم هذا القالب. projectId يبقى أولها للتوافق. */
  projectIds: string[];
  unitKey: string;
  unitLabel: string;
  grid: boolean;
  plans: Record<string, string>;
  /** تكبير وإزاحة صورة المخطط لكل طابق. */
  planLayout?: Record<string, PlanFrame>;
  /** صورة واحدة وإزاحة واحدة لكل طوابق المنزل. */
  sharedPlan?: boolean;
  walls: TourWall[];
  openings: TourOpening[];
  items: TourItem[];
  updatedAt: string;
}

export const SHEET_W = 22;
export const SHEET_H = 16;
export const WALL_HEIGHT = 2.7;
/** سطح الطابق التالي عند أعلى الجدار، والدرج يقف عنده. */
export const FLOOR_STEP = WALL_HEIGHT;
