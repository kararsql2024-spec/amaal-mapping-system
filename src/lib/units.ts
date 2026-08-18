/**
 * Unit addressing: tower apartment keys, floor codes, display labels, areas,
 * and the label-parsing conventions used across the app.
 *
 * These helpers were previously inlined in Index, Admin, Reports,
 * DetailedStatsTable, TowerDetailsModal and Brochure. The logic here is a
 * direct move — key formats, P-numbering and area lookups are unchanged.
 */

import { MapElement } from "@/types/project";

export type HousesData = Record<string, any>;

/** Storage key for a single apartment: `{towerId}_F{floor}_A{apartment}`. */
export const getApartmentKey = (
  towerId: string,
  floor: number,
  apt: number,
): string => `${towerId}_F${floor}_A${apt}`;

/** True when a unit key belongs to a tower apartment rather than a house. */
export const isApartmentKey = (unitKey: string): boolean =>
  unitKey.includes("_F") && unitKey.includes("_A");

/** Extracts the owning tower id from an apartment key. */
export const getTowerIdFromKey = (unitKey: string): string =>
  unitKey.split("_F")[0];

/** Ground floor is FG; every floor above is numbered from 1. */
export const getFloorCode = (floor: number): string =>
  floor === 1 ? "FG" : `F${floor - 1}`;

export const getFloorLabel = (floor: number): string =>
  floor === 1 ? "الطابق الأرضي" : `الطابق ${floor - 1}`;

/** Ground floor apartments and typical floor apartments have separate sizes. */
export const getApartmentSize = (tower: MapElement, floor: number, apt: number): number =>
  floor === 1
    ? tower.groundFloorSizes?.[apt - 1] || 0
    : tower.typicalFloorSizes?.[apt - 1] || 0;

/**
 * Iterates every apartment of a tower.
 *
 * `emptyFallback` reproduces an existing inconsistency: aggregation code
 * treats a tower with no configured floors as having zero units, while
 * listing code treats it as having one. Callers pass the value their
 * original implementation used.
 */
export const forEachTowerUnit = (
  tower: MapElement,
  cb: (key: string, floor: number, apt: number) => void,
  emptyFallback: 0 | 1 = 0,
): void => {
  const floors = tower.floors || emptyFallback;
  const aptsPerFloor = tower.apartmentsPerFloor || emptyFallback;
  for (let f = 1; f <= floors; f++) {
    for (let a = 1; a <= aptsPerFloor; a++) {
      cb(getApartmentKey(tower.id, f, a), f, a);
    }
  }
};

/** Iterates every sellable unit across a set of map elements. */
export const forEachSellableUnit = (
  elements: MapElement[],
  cb: (key: string, element: MapElement, floor?: number, apt?: number) => void,
  emptyFallback: 0 | 1 = 0,
): void => {
  elements.forEach((el) => {
    if (el.type === "house") {
      cb(el.id, el);
    } else if (el.type === "tower") {
      forEachTowerUnit(el, (key, f, a) => cb(key, el, f, a), emptyFallback);
    }
  });
};

/**
 * Sequential apartment code within a tower, e.g. `B1-FG-P3`.
 *
 * Frozen apartments do not consume a sequence number and render as "مجمدة",
 * so the visible numbering stays continuous for sellable units.
 */
export const getApartmentLabel = (
  tower: MapElement,
  floor: number,
  apt: number,
  housesData: HousesData,
): string => {
  let pCounter = 0;

  for (let f = 1; f <= (tower.floors || 1); f++) {
    for (let a = 1; a <= (tower.apartmentsPerFloor || 1); a++) {
      const data = housesData[getApartmentKey(tower.id, f, a)];
      const isFrozenSequence =
        data?.status === "frozen_uncounted" || data?.status === "frozen_hidden";

      if (!isFrozenSequence) pCounter++;

      if (f === floor && a === apt) {
        const aptCode = isFrozenSequence ? "مجمدة" : `P${pCounter}`;
        return `${tower.label}-${getFloorCode(f)}-${aptCode}`;
      }
    }
  }

  return "";
};

/** Trailing segment of a full apartment label, e.g. `P3`. */
export const getApartmentShortLabel = (fullLabel: string): string => {
  if (!fullLabel) return "";
  const parts = fullLabel.split("-");
  return parts[parts.length - 1];
};

/** Zone is the first segment of a house label, e.g. `Z1` in `Z1-B1-D1`. */
export const getZone = (label: string): string => label.split("-")[0] || "";

/**
 * House class from the third label segment, e.g. `D` in `Z1-B1-D1`.
 * Used by reporting and the statistics table.
 */
export const getHouseClass = (label: string): string | null => {
  const parts = label.split("-");
  if (parts.length < 3) return null;
  const match = parts[2].match(/[a-zA-Z]+/);
  return match ? match[0] : null;
};

/**
 * House type from the final label segment, uppercased.
 * Used to look up standard areas and brochure specs; this is a different
 * convention from `getHouseClass` and the two are not interchangeable.
 */
export const getHouseType = (label: string): string => {
  const parts = label.split("-");
  const lastPart = parts[parts.length - 1] || "";
  const match = lastPart.match(/^([a-zA-Z]+)/);
  return match ? match[1].toUpperCase() : lastPart.toUpperCase();
};

/** A per-element override wins over the project's standard area for its type. */
export const getHouseArea = (
  el: MapElement,
  houseTypeAreas: Record<string, number> = {},
): number => {
  if (el.customArea !== undefined && el.customArea > 0) return el.customArea;
  return houseTypeAreas[getHouseType(el.label)] || 0;
};
