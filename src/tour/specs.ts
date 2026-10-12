import type { MapElement } from "@/types/project";

export interface TourSpec {
  key: string;
  label: string;
}

/** حرف النوع كما في البروشور، مع الإبقاء على + حتى يبقى C و C+ صنفين. */
export const houseSpec = (label: string) => {
  const last = (label || "").split("-").pop() || "";
  const match = last.match(/^([A-Za-z]+\+?)/);
  return match ? match[1].toUpperCase() : last.toUpperCase();
};

/** نفس أصناف البروشور: نوع المنزل من آخر مقطع، ومساحة الشقة من المخطط. */
export const discoverSpecs = (elements: MapElement[] | undefined) => {
  const houses = new Set<string>();
  const apartments = new Set<number>();
  (Array.isArray(elements) ? elements : []).forEach((element) => {
    if (element.type === "house") {
      const type = houseSpec(element.label || "");
      if (type) houses.add(type);
      return;
    }
    if (element.type !== "tower") return;
    const floors = Math.max(1, element.floors || 1);
    const apartmentsPerFloor = Math.max(1, element.apartmentsPerFloor || 1);
    for (let floor = 1; floor <= floors; floor++) {
      for (let apt = 1; apt <= apartmentsPerFloor; apt++) {
        const size = floor === 1 ? element.groundFloorSizes?.[apt - 1] || 0 : element.typicalFloorSizes?.[apt - 1] || 0;
        if (size > 0) apartments.add(size);
      }
    }
  });
  return {
    houses: Array.from(houses)
      .sort((a, b) => a.localeCompare(b))
      .map((type) => ({ key: type, label: `منزل — Type ${type}` })),
    apartments: Array.from(apartments)
      .sort((a, b) => a - b)
      .map((size) => ({ key: String(size), label: `شقة — ${size} م²` })),
  };
};
