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
  sky: 0x4eb6ee,
  horizon: 0xd7f0fc,
  ground: 0x9c967e,
  road: 0x8c8f96,
  sidewalk: 0xddd6cb,
  green: 0x6aaa58,
  pitch: 0x5c9854,
  treeTrunk: 0x6b4b34,
  treeFoliage: 0x3e8c46,
  shrub: 0x8fbf5c,
  houseBody: 0xe8e0d4,
  houseRoof: 0x8a5a4a,
  towerBody: 0xc9cdd4,
  towerJoint: 0x3a3836,
  towerRoof: 0xd7cbb8,
  amenity: 0xd4c4a8,
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
