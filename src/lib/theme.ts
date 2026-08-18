/**
 * Design tokens for surfaces that cannot read CSS custom properties:
 * the Canvas renderer (InteractiveMap) and the SVG editor (MapEditor).
 *
 * These values mirror the custom properties in src/globals.css.
 * Changing one side requires changing the other.
 */

export const palette = {
  background: "#F8F8F7",
  surface: "#FFFFFF",
  surfaceSunken: "#F3F3F1",

  fg: "#020202",
  fgSecondary: "#656565",
  fgMuted: "#7C7C7C",
  fgFaint: "#A3A3A3",

  line: "#DEDDD9",
  lineStrong: "#C9C7C1",

  accent: "#1A1A1A",
  accentFg: "#F8F8F7",
} as const;

/** Neutral fills for non-sellable map elements. */
export const mapPalette = {
  grid: "#EAE9E5",
  gridStrong: "#DEDDD9",
  boundary: "#1A1A1A",

  road: "#E4E3DF",
  roadStroke: "#CFCDC7",

  green: "#CBD9C9",
  greenStroke: "#A8BCA5",

  pitch: "#BFD2BC",
  pitchStroke: "#9AB396",

  amenity: "#DCD5CB",
  amenityStroke: "#BFB4A6",

  labelArea: "#EFEEEA",
  labelAreaStroke: "#D6D4CE",

  selection: "#1A1A1A",
  highlight: "#B95646",
} as const;

/** Font stack for canvas text, matching the DOM typography. */
export const canvasFont =
  '"IBM Plex Sans Arabic", ui-sans-serif, system-ui, "Segoe UI", sans-serif';

export type ThemeMode = "light" | "dark";
