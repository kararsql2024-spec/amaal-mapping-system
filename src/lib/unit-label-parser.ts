import type { MapElement } from "@/types/project";
import {
  getApartmentLabel,
  getTowerIdFromKey,
  isApartmentKey,
} from "@/lib/units";
import type { PaymentUnitType } from "@/lib/payment-types";

export interface ParsedUnitAddress {
  unitType: PaymentUnitType;
  zone?: string;
  block?: string;
  houseType?: string;
  houseNum?: string;
  building?: string;
  floor?: string;
  apartment?: string;
}

const stripPrefix = (value: string, prefix: string): string => {
  const upper = value.toUpperCase();
  return upper.startsWith(prefix) ? value.slice(prefix.length) : value;
};

/** رقم العمارة فقط — الاستمارة تضيف ترميز A في العرض */
export const extractBuildingNumber = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const withoutLetterPrefix = trimmed.replace(/^[A-Za-z]+/, "");
  return withoutLetterPrefix || trimmed;
};

export interface ResolvedPaymentUnit extends ParsedUnitAddress {
  displayLabel: string;
}

/** يحلّ حقول الوحدة من مفتاح الخريطة + عناصر المشروع (الطريقة الصحيحة للشقق) */
export const resolvePaymentUnitFromMap = (
  unitKey: string,
  elements: MapElement[],
  housesData: Record<string, any> = {},
): ResolvedPaymentUnit => {
  if (isApartmentKey(unitKey)) {
    const towerId = getTowerIdFromKey(unitKey);
    const tower = elements.find((el) => el.id === towerId && el.type === "tower");
    const match = unitKey.match(/_F(\d+)_A(\d+)/i);
    const floorNum = match ? Number(match[1]) : 1;
    const aptNum = match ? Number(match[2]) : 1;

    const displayLabel = tower
      ? getApartmentLabel(tower, floorNum, aptNum, housesData)
      : unitKey;

    const parts = displayLabel.split("-").map((part) => part.trim()).filter(Boolean);
    const floorPart = parts[1] || "";
    const aptPart = parts[2] || parts[parts.length - 1] || "";

    return {
      unitType: "apartment",
      building: extractBuildingNumber(tower?.label || parts[0] || ""),
      floor: floorPart.toUpperCase() === "FG" ? "0" : stripPrefix(floorPart, "F"),
      apartment: stripPrefix(aptPart, "P") || String(aptNum),
      displayLabel,
    };
  }

  const house = elements.find((el) => el.id === unitKey && el.type === "house");
  const label = house?.label || unitKey;
  return {
    ...parseHouseLabel(label),
    displayLabel: label,
  };
};

/** يحوّل تسمية الوحدة في النظام إلى حقول استمارة الدفعات */
export const parseUnitLabelToPaymentFields = (
  unitLabel: string,
  unitKey?: string | null,
): ParsedUnitAddress => {
  if (unitKey && isApartmentKey(unitKey)) {
    return parseApartmentLabel(unitLabel, unitKey);
  }

  if (/^A\d+/i.test(unitLabel) || unitLabel.includes("-F") || unitLabel.includes("-P")) {
    return parseApartmentLabel(unitLabel, unitKey);
  }

  return parseHouseLabel(unitLabel);
};

const parseHouseLabel = (unitLabel: string): ParsedUnitAddress => {
  const parts = unitLabel.split("-").map((part) => part.trim()).filter(Boolean);
  const zone = stripPrefix(parts[0] || "", "Z");
  const block = stripPrefix(parts[1] || "", "B");
  const lastPart = parts[2] || parts[parts.length - 1] || "";
  const typeMatch = lastPart.match(/^([A-Za-z]+\+?)/);
  const numMatch = lastPart.match(/(\d+)$/);
  const houseType = typeMatch?.[1]?.toUpperCase() || lastPart.toUpperCase();
  const houseNum = numMatch?.[1] || lastPart.replace(/^[A-Za-z]+\+?/i, "");

  return {
    unitType: "house",
    zone,
    block,
    houseType,
    houseNum,
  };
};

const parseApartmentLabel = (
  unitLabel: string,
  unitKey?: string | null,
): ParsedUnitAddress => {
  const parts = unitLabel.split("-").map((part) => part.trim()).filter(Boolean);
  const building = extractBuildingNumber(parts[0] || "");
  const floorPart = parts[1] || "";
  const aptPart = parts[2] || parts[parts.length - 1] || "";

  let floor = floorPart.toUpperCase() === "FG" ? "0" : stripPrefix(floorPart, "F");
  let apartment = stripPrefix(aptPart, "P");

  if (unitKey) {
    const floorMatch = unitKey.match(/_F(\d+)_A(\d+)/i);
    if (floorMatch) {
      const floorNum = Number(floorMatch[1]);
      floor = floorNum === 1 ? "0" : String(floorNum - 1);
      apartment = floorMatch[2];
    }
  }

  return {
    unitType: "apartment",
    building,
    floor,
    apartment,
  };
};

export const formatPaymentUnitNumber = (booking: {
  unit_type?: PaymentUnitType;
  zone?: string;
  block?: string;
  house_type?: string;
  house_num?: string;
  building?: string;
  floor?: string;
  apartment?: string;
}): string => {
  if (booking.unit_type === "house") {
    return `Z${booking.zone || ""}-B${booking.block || ""}-${booking.house_type || ""}${booking.house_num || ""}`;
  }

  const displayFloor = booking.floor === "0" ? "G" : booking.floor;
  return `A${booking.building || ""}-F${displayFloor}-P${booking.apartment || ""}`;
};
