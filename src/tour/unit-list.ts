import type { MapElement } from "@/types/project";
import { getApartmentKey, getFloorLabel } from "@/lib/units";
import type { TourKind } from "./types";

export interface TourUnitOption {
  key: string;
  label: string;
}

/** وحدات المشروع كما هي في قاعدة البيانات، بيت أو شقة بعينها. */
export const listTourUnits = (elements: MapElement[] | undefined, kind: TourKind): TourUnitOption[] => {
  const list = Array.isArray(elements) ? elements : [];
  if (kind === "house") {
    return list
      .filter((element) => element.type === "house")
      .map((element) => ({ key: element.id, label: element.label || element.id }));
  }
  const options: TourUnitOption[] = [];
  list
    .filter((element) => element.type === "tower")
    .forEach((tower) => {
      const floors = Math.max(1, tower.floors || 1);
      const apartments = Math.max(1, tower.apartmentsPerFloor || 1);
      for (let floor = 1; floor <= floors; floor++) {
        for (let apt = 1; apt <= apartments; apt++) {
          options.push({
            key: getApartmentKey(tower.id, floor, apt),
            label: `${tower.label || "عمارة"} · ${getFloorLabel(floor)} · شقة ${apt}`,
          });
        }
      }
    });
  return options;
};
