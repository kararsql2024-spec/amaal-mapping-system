import { houseSpec } from "./specs";
import { loadTours } from "./storage";
import type { TourTemplate } from "./types";

const isApartment = (unitId?: string | null) => Boolean(unitId && unitId.includes("_F") && unitId.includes("_A"));

/** الجولة لصنف داخل مشروع: Type C أو شقة 192، لا لوحدة واحدة ولا لمدينة أخرى. */
export const findTourForUnit = (
  unit: {
    unitId?: string | null;
    unitLabel?: string;
    unitSize?: number;
    projectId?: string;
  },
  tours: TourTemplate[] = loadTours(),
): TourTemplate | null => {
  const apartment = isApartment(unit.unitId);
  return (
    tours
      .filter((tour) => tour.projectId && tour.unitKey && (!unit.projectId || tour.projectId === unit.projectId))
      .filter((tour) => tour.walls.length + tour.openings.length + tour.items.length > 0)
      .filter((tour) => {
        if (apartment) return tour.kind === "apartment" && Math.abs(Number(tour.unitKey) - Number(unit.unitSize || 0)) < 0.6;
        return tour.kind === "house" && tour.unitKey.toUpperCase() === houseSpec(unit.unitLabel || "");
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] || null
  );
};
