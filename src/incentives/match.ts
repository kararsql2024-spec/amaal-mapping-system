import type { MatchMode } from "./types";

export const normalizeText = (value: unknown): string =>
  String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const matchesValue = (
  haystack: string,
  needle: string,
  mode: MatchMode,
): boolean => {
  const source = normalizeText(haystack);
  const target = normalizeText(needle);
  if (!target) return false;
  if (mode === "contains") {
    return source.includes(target);
  }
  if (mode === "startsWith") {
    return source.toUpperCase().startsWith(target.toUpperCase());
  }
  return source === target;
};

export const firstMatch = <T,>(
  items: T[],
  predicate: (item: T) => boolean,
): T | undefined => items.find(predicate);
