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
  | "curtain";

export type ItemKind = "room" | "balcony" | "furniture" | "hotspot" | "stairs" | "text";

export type OpeningKind = "door" | "mainDoor" | "slideDoor" | "window" | "balcony";

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
  walls: TourWall[];
  openings: TourOpening[];
  items: TourItem[];
  updatedAt: string;
}

export const SHEET_W = 22;
export const SHEET_H = 16;
export const FLOOR_STEP = 3.2;
export const WALL_HEIGHT = 2.7;
