import type {
  PaymentApartmentAreaConfig,
  PaymentHouseTypeConfig,
  PaymentProjectUnitSettings,
  PaymentProjectUnitSettingsMap,
} from "@/lib/payment-types";
import { EMPTY_PAYMENT_UNIT_SETTINGS } from "@/lib/payment-types";

export function getHouseLabelLastPart(label: string): string {
  const parts = label.split("-").map((part) => part.trim()).filter(Boolean);
  return parts[2] || parts[parts.length - 1] || "";
}

export function extractHouseBaseType(labelLastPart: string): string {
  const match = labelLastPart.match(/^([A-Za-z]+)/);
  return match?.[1]?.toUpperCase() || labelLastPart.toUpperCase();
}

export function matchPaymentHouseTypeByPrefix(
  labelLastPart: string,
  configs: PaymentHouseTypeConfig[],
): PaymentHouseTypeConfig | null {
  if (!labelLastPart || configs.length === 0) return null;

  const sorted = [...configs].sort(
    (a, b) => b.type.trim().length - a.type.trim().length,
  );
  const upper = labelLastPart.toUpperCase();

  for (const config of sorted) {
    const typeUpper = config.type.trim().toUpperCase();
    if (typeUpper && upper.startsWith(typeUpper)) {
      return config;
    }
  }

  return null;
}

const formatAreaValue = (area: number): string => (area > 0 ? String(area) : "");

const resolveConfiguredHouseArea = (
  config: PaymentHouseTypeConfig,
  mapArea: number,
): string => {
  if (config.area != null && Number(config.area) > 0) {
    return formatAreaValue(Number(config.area));
  }
  return formatAreaValue(mapArea);
};

const hasFixedArea = (config: PaymentHouseTypeConfig): boolean =>
  config.area != null && Number(config.area) > 0;

const areaMatchesMap = (config: PaymentHouseTypeConfig, mapArea: number): boolean =>
  mapArea <= 0 || !hasFixedArea(config) || Math.abs(Number(config.area) - mapArea) < 0.01;

/** يحلّ نوع المنزل بعد تطابق الترميز، مع دعم C+ عند اختلاف المساحة عن النوع القياسي */
const resolveLabelMatchedHouseType = (
  config: PaymentHouseTypeConfig,
  mapArea: number,
  configs: PaymentHouseTypeConfig[],
): { houseType: string; totalArea: string } => {
  if (areaMatchesMap(config, mapArea)) {
    return {
      houseType: config.type,
      totalArea: resolveConfiguredHouseArea(config, mapArea),
    };
  }

  const plusVariant = configs.find(
    (item) =>
      item.type.trim().toUpperCase() === `${config.type.trim().toUpperCase()}+` &&
      !hasFixedArea(item),
  );
  if (plusVariant) {
    return {
      houseType: plusVariant.type,
      totalArea: resolveConfiguredHouseArea(plusVariant, mapArea),
    };
  }

  // الترميز في عنوان المنزل له الأولوية على مطابقة المساحة وحدها
  return {
    houseType: config.type,
    totalArea: resolveConfiguredHouseArea(config, mapArea),
  };
};

/** يطابق نوع المنزل من تسمية الخريطة ومساحتها مع إعدادات الدفعات */
export function resolveHousePaymentFields(
  houseLabel: string,
  mapArea: number,
  configs: PaymentHouseTypeConfig[],
  parsedHouseType = "",
): { houseType: string; totalArea: string } {
  const lastPart = getHouseLabelLastPart(houseLabel);
  const baseType = extractHouseBaseType(lastPart) || parsedHouseType.toUpperCase();

  // 1) مطابقة الترميز من الجزء الأخير من عنوان المنزل (مثل A في Z1-B1-A1)
  const prefixMatch = matchPaymentHouseTypeByPrefix(lastPart, configs);
  if (prefixMatch) {
    return resolveLabelMatchedHouseType(prefixMatch, mapArea, configs);
  }

  const exactMatch = configs.find(
    (config) => config.type.trim().toUpperCase() === baseType,
  );
  if (exactMatch) {
    return resolveLabelMatchedHouseType(exactMatch, mapArea, configs);
  }

  // 2) عند غياب تطابق ترميز: مطابقة بالمساحة فقط
  if (mapArea > 0) {
    const areaMatches = configs.filter(
      (config) => hasFixedArea(config) && Math.abs(Number(config.area) - mapArea) < 0.01,
    );

    if (areaMatches.length === 1) {
      return {
        houseType: areaMatches[0].type,
        totalArea: formatAreaValue(Number(areaMatches[0].area)),
      };
    }

    if (areaMatches.length > 1) {
      const labelMatch = areaMatches.find((config) =>
        lastPart.toUpperCase().startsWith(config.type.trim().toUpperCase()),
      );
      if (labelMatch) {
        return {
          houseType: labelMatch.type,
          totalArea: formatAreaValue(Number(labelMatch.area)),
        };
      }
    }
  }

  const plusVariant = configs.find(
    (config) => config.type.trim().toUpperCase() === `${baseType}+` && !hasFixedArea(config),
  );
  if (plusVariant) {
    return {
      houseType: plusVariant.type,
      totalArea: resolveConfiguredHouseArea(plusVariant, mapArea),
    };
  }

  return {
    houseType: parsedHouseType || baseType,
    totalArea: formatAreaValue(mapArea),
  };
}

export function resolveHouseTypeSelection(
  selectedType: string,
  mapArea: number,
  configs: PaymentHouseTypeConfig[],
): { houseType: string; totalArea: string } {
  const config = configs.find((item) => item.type === selectedType);
  if (!config) {
    return { houseType: selectedType, totalArea: formatAreaValue(mapArea) };
  }
  return {
    houseType: config.type,
    totalArea: resolveConfiguredHouseArea(config, mapArea),
  };
}

/** يطابق مساحة الشقة من الخريطة مع الإعدادات المسبقة */
export function resolveApartmentPaymentAreas(
  mapTotalArea: number,
  configs: PaymentApartmentAreaConfig[],
): { totalArea: string; netArea: string } {
  if (mapTotalArea <= 0) {
    return { totalArea: "", netArea: "" };
  }

  const match = configs.find(
    (config) => Math.abs(Number(config.total_area) - mapTotalArea) < 0.01,
  );

  if (match) {
    return {
      totalArea: String(match.total_area),
      netArea: String(match.net_area),
    };
  }

  return {
    totalArea: String(mapTotalArea),
    netArea: "",
  };
}

export function normalizePaymentProjectUnitSettings(
  raw: unknown,
): PaymentProjectUnitSettings {
  if (!raw || typeof raw !== "object") {
    return { ...EMPTY_PAYMENT_UNIT_SETTINGS };
  }

  const value = raw as Partial<PaymentProjectUnitSettings> & { house_types?: unknown[] };

  if (Array.isArray(value.house_types) && value.house_types.every((item) => typeof item === "string")) {
    return {
      house_types: (value.house_types as string[]).map((type) => ({ type })),
      apartment_areas: Array.isArray(value.apartment_areas)
        ? normalizeApartmentAreas(value.apartment_areas)
        : [],
    };
  }

  return {
    house_types: normalizeHouseTypes(value.house_types),
    apartment_areas: normalizeApartmentAreas(value.apartment_areas),
  };
}

function normalizeHouseTypes(raw: unknown): PaymentHouseTypeConfig[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (typeof item === "string") {
        return { type: item.trim() };
      }
      if (item && typeof item === "object" && "type" in item) {
        const typed = item as PaymentHouseTypeConfig;
        const area =
          typed.area == null || typed.area === ("" as unknown)
            ? undefined
            : Number(typed.area);
        return {
          type: String(typed.type || "").trim(),
          area: area != null && !Number.isNaN(area) && area > 0 ? area : undefined,
        };
      }
      return null;
    })
    .filter((item): item is PaymentHouseTypeConfig => !!item?.type);
}

function normalizeApartmentAreas(raw: unknown): PaymentApartmentAreaConfig[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const typed = item as PaymentApartmentAreaConfig;
      const total = Number(typed.total_area);
      const net = Number(typed.net_area);
      if (!total || Number.isNaN(total) || !net || Number.isNaN(net)) return null;
      return { total_area: total, net_area: net };
    })
    .filter((item): item is PaymentApartmentAreaConfig => item != null);
}

export function getPaymentProjectUnitSettings(
  map: PaymentProjectUnitSettingsMap,
  projectId?: string | null,
): PaymentProjectUnitSettings {
  if (!projectId) return { ...EMPTY_PAYMENT_UNIT_SETTINGS };
  return normalizePaymentProjectUnitSettings(map[projectId]);
}

export function getPaymentHouseTypeOptions(
  settings: PaymentProjectUnitSettings,
): PaymentHouseTypeConfig[] {
  return settings.house_types;
}

/** يسمح بكتابة أرقام عشرية تدريجياً (مثل 168.5) */
export const isValidAreaInput = (value: string): boolean =>
  value === "" || /^\d*(?:[.,]\d*)?$/.test(value);

export const parseAreaInput = (value: string): number | undefined => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (Number.isNaN(parsed) || parsed <= 0) return undefined;
  return parsed;
};

export const formatAreaInput = (area?: number | null): string =>
  area != null && !Number.isNaN(area) ? String(area) : "";
