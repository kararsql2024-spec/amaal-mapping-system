import type { WorldPoint } from "./types";

export const centroid = (points: WorldPoint[]): WorldPoint => {
  let x = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    z += p.z;
  }
  const n = points.length || 1;
  return { x: x / n, z: z / n };
};

/** يقرّب المضلع نحو مركزه بمسافة تقريبية، فيحفظ الشكل الخماسي وغيره. */
export const insetPoly = (points: WorldPoint[], margin: number): WorldPoint[] => {
  const c = centroid(points);
  let radius = 0;
  for (const point of points) radius += Math.hypot(point.x - c.x, point.z - c.z);
  radius /= points.length || 1;
  if (radius < 0.25) return points;
  const scale = Math.max(0.68, (radius - margin) / radius);
  return points.map((point) => ({
    x: c.x + (point.x - c.x) * scale,
    z: c.z + (point.z - c.z) * scale,
  }));
};

export const boundsOf = (points: WorldPoint[]) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  return { minX, maxX, minZ, maxZ, width: maxX - minX, depth: maxZ - minZ };
};

/** توسيع المضلع للخارج بمسافة ثابتة — يكفي للرصيف حول الطرق. */
export const expandPoly = (points: WorldPoint[], meters: number): WorldPoint[] => {
  const c = centroid(points);
  return points.map((p) => {
    const dx = p.x - c.x;
    const dz = p.z - c.z;
    const len = Math.hypot(dx, dz) || 1;
    return { x: p.x + (dx / len) * meters, z: p.z + (dz / len) * meters };
  });
};

export const pointInPoly = (x: number, z: number, poly: WorldPoint[]): boolean => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const zi = poly[i].z;
    const xj = poly[j].x;
    const zj = poly[j].z;
    const crosses = zi > z !== zj > z;
    if (!crosses) continue;
    const xAtZ = ((xj - xi) * (z - zi)) / (zj - zi || 1e-9) + xi;
    if (x < xAtZ) inside = !inside;
  }
  return inside;
};

/** يحوّل إزاحة محلية (قبل الدوران) إلى إزاحة عالمية. */
export const yawOffset = (lx: number, lz: number, rotY: number) => {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return { x: lx * c + lz * s, z: -lx * s + lz * c };
};

export const hashString = (value: string): number => {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  }
  return h >>> 0;
};
