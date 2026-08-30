import type { ParsedUnitCode } from "./types";

const stripPrefix = (value: string, prefix: string): string => {
  const upper = value.toUpperCase();
  const needle = prefix.toUpperCase();
  return upper.startsWith(needle) ? value.slice(prefix.length) : value;
};

const extractTypeCode = (lastPart: string): { typeCode: string; houseNum: string } => {
  const match = lastPart.match(/^([A-Za-z]+(?:\+)?)\s*(\d+)?$/);
  if (!match) {
    return { typeCode: lastPart.toUpperCase(), houseNum: "" };
  }
  return {
    typeCode: match[1].toUpperCase(),
    houseNum: match[2] || "",
  };
};

/** يصنّف رقم الوحدة: المنزل Z1-B1-C1 والشقة A1-F1-P1 — حرف F في المنزل نوع وليس طابقاً */
export const parseUnitCode = (rawValue: string): ParsedUnitCode => {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return { kind: "unknown", raw: "", typeCode: "" };
  }

  const parts = raw
    .split("-")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return { kind: "unknown", raw, typeCode: "" };
  }

  const first = parts[0].toUpperCase();

  const looksApartment =
    /^A\d+/i.test(parts[0]) &&
    (/^F/i.test(parts[1] || "") || (parts[1] || "").toUpperCase() === "FG") &&
    /^P/i.test(parts[2] || parts[parts.length - 1] || "");

  if (looksApartment) {
    const floorPart = parts[1] || "";
    const aptPart = parts[2] || parts[parts.length - 1] || "";
    return {
      kind: "apartment",
      raw,
      typeCode: "",
      building: stripPrefix(parts[0], "A"),
      floor: floorPart.toUpperCase() === "FG" ? "G" : stripPrefix(floorPart, "F"),
      apartment: stripPrefix(aptPart, "P"),
    };
  }

  const houseParts =
    first === "G" && /^Z/i.test(parts[1] || "") ? parts.slice(1) : parts;

  const zonePart = houseParts[0] || "";
  const blockPart = houseParts[1] || "";
  const lastPart = houseParts[2] || houseParts[houseParts.length - 1] || "";

  const looksHouse =
    /^Z/i.test(zonePart) &&
    /^B/i.test(blockPart) &&
    houseParts.length >= 3;

  if (looksHouse) {
    const { typeCode, houseNum } = extractTypeCode(lastPart);
    return {
      kind: "house",
      raw,
      typeCode,
      zone: stripPrefix(zonePart, "Z"),
      block: stripPrefix(blockPart, "B"),
      houseNum,
    };
  }

  return { kind: "unknown", raw, typeCode: "" };
};
