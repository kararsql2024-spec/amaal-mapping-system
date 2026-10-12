import type { ItemKind, OpeningKind, PieceId, TourItem } from "./types";

export const PIECES: { id: PieceId; label: string; w: number; h: number; house?: boolean }[] = [
  { id: "sofa", label: "كنبة", w: 2.2, h: 0.95 },
  { id: "armchair", label: "كرسي", w: 0.85, h: 0.85 },
  { id: "coffee", label: "طاولة وسط", w: 1.1, h: 0.6 },
  { id: "doubleBed", label: "سرير مزدوج", w: 2.05, h: 1.7 },
  { id: "singleBed", label: "سرير مفرد", w: 2.0, h: 1.0 },
  { id: "wardrobe", label: "دولاب", w: 1.8, h: 0.6 },
  { id: "dining", label: "سفرة", w: 1.7, h: 0.95 },
  { id: "kitchen", label: "مطبخ", w: 2.6, h: 0.65 },
  { id: "bathroom", label: "حمام", w: 1.7, h: 1.35 },
  { id: "rug", label: "سجادة", w: 2.2, h: 1.5 },
  { id: "tv", label: "تلفاز", w: 1.5, h: 0.4 },
  { id: "kidsBed", label: "سرير أطفال", w: 1.55, h: 0.85 },
  { id: "toyBox", label: "صندوق ألعاب", w: 0.7, h: 0.45 },
  { id: "kidsShelf", label: "رف أطفال", w: 0.9, h: 0.35 },
  { id: "desk", label: "مكتب", w: 1.4, h: 0.65 },
  { id: "officeChair", label: "كرسي مكتب", w: 0.55, h: 0.55 },
  { id: "nightstand", label: "كومودينو", w: 0.5, h: 0.42 },
  { id: "bookshelf", label: "مكتبة", w: 0.9, h: 0.32 },
  { id: "dresser", label: "تسريحة", w: 1.2, h: 0.48 },
  { id: "curtain", label: "ستارة", w: 1.6, h: 0.12 },
  { id: "plant", label: "نبتة", w: 0.5, h: 0.5 },
  { id: "lamp", label: "مصباح", w: 0.35, h: 0.35 },
  { id: "car", label: "سيارة", w: 4.2, h: 1.8, house: true },
  { id: "garden", label: "حديقة", w: 4.5, h: 3.2, house: true },
];

export const pieceOf = (id?: PieceId) => PIECES.find((piece) => piece.id === id);

export const OPENING_WIDTH: Record<OpeningKind, number> = {
  door: 0.9,
  mainDoor: 1.1,
  slideDoor: 1.7,
  window: 1.4,
  balcony: 2.4,
};

export const PLACE_SIZE: Partial<Record<ItemKind, { w: number; h: number }>> = {
  hotspot: { w: 0.8, h: 0.8 },
  stairs: { w: 1.15, h: 3 },
  room: { w: 4, h: 3.2 },
  text: { w: 2.2, h: 0.45 },
};

export const itemFoot = (item: TourItem) => ({
  w: item.w * (item.scale || 1),
  h: item.h * (item.scale || 1),
});

export const hitItem = (item: TourItem, x: number, y: number) => {
  const foot = itemFoot(item);
  const angle = -((item.rot || 0) * Math.PI) / 180;
  const dx = x - item.x;
  const dy = y - item.y;
  const localX = dx * Math.cos(angle) - dy * Math.sin(angle);
  const localY = dx * Math.sin(angle) + dy * Math.cos(angle);
  return Math.abs(localX) <= foot.w / 2 && Math.abs(localY) <= foot.h / 2;
};
