/** وحدة الاستكشاف الثلاثي الأبعاد — مستقلة عن الخريطة الحالية. */

/** الضلع الأقصر لقطعة منزل نموذجية. المخطط بلا مقياس، فهذا هو مرجع المتر. */
export const HOUSE_LOT_SHORT_M = 12;
/** مرجع بديل للمشاريع التي فيها عمارات فقط. */
export const TOWER_FRONTAGE_M = 36;
/** ارتفاع الشقة من أرضية إلى أرضية، شاملاً سماكة البلاطة. */
export const FLOOR_HEIGHT_M = 3.5;
/** المنزل طابقان، ثم بيتونة حتى يقارب الارتفاع 8.5 م. */
export const HOUSE_WALL_M = 6;
export const HOUSE_PARAPET_M = 2.5;
export const HOUSE_HEIGHT_M = HOUSE_WALL_M + HOUSE_PARAPET_M;
export const HOUSE_WIDTH_M = 8;
export const HOUSE_DEPTH_M = 10;
export const FLOOR_BAND_M = 0.42;
export const TOWER_ROOF_M = 0.9;
export const AMENITY_HEIGHT_M = 6;
/** شارع مرسوم كخط رفيع لا يبقى بعرض مترين. */
export const STREET_MIN_M = 8;
export const MIN_FOOTPRINT_M = 4.5;
export const APT_BAY_M = 3.4;
export const MAX_TREES = 700;
export const MAX_TREES_PER_GREEN = 72;
export const MAX_SHRUBS = 900;
export const MAX_SHRUBS_PER_GREEN = 110;
export const SIDEWALK_M = 1.6;
export const TARGET_MAP_SPAN_M = 480;
export const TREE_SPACING_M = 11;
export const SHRUB_SPACING_M = 6.5;

export const COLORS = {
  sky: 0xe7eef2,
  horizon: 0xf6f4ef,
  ground: 0xf4f1ea,
  road: 0xe6e2d8,
  sidewalk: 0xeeeae2,
  green: 0xc9d4bc,
  pitch: 0xb7c6a8,
  treeTrunk: 0x8a7560,
  treeFoliage: 0x9aaf86,
  shrub: 0xa8b992,
  houseBody: 0xf7f4ee,
  houseRoof: 0xf7f4ee,
  towerBody: 0xf3f0e8,
  towerJoint: 0xe4dfd4,
  towerRoof: 0xf7f4ee,
  amenity: 0xe7e1d4,
} as const;

export const AMENITY_COLORS: Record<string, number> = {
  shop: 0xd4c4a8,
  school: 0xc7b7d8,
  medical: 0xd7c2c2,
  nursery: 0xe3d2b8,
  mall: 0xc5c9d4,
  gym: 0xc9d0c4,
  supermarket: 0xd8d2c0,
  mosque: 0xd9d3c8,
};

export const AMENITY_LABELS: Record<string, string> = {
  shop: "محل تجاري",
  school: "مدرسة",
  medical: "مركز طبي",
  nursery: "حضانة",
  mall: "مول",
  gym: "جم",
  supermarket: "أسواق مركزية",
  mosque: "مسجد",
};
