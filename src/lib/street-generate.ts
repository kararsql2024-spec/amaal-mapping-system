import polygonClipping from "polygon-clipping";
import type { MapElement, Point } from "@/types/project";
import type { RoadShape } from "@/lib/road-geometry";

const clipUnion = polygonClipping.union;
const clipDifference = polygonClipping.difference;
const clipIntersection = polygonClipping.intersection;

export interface StreetPiece {
  centerline: Point[];
  branches: Point[][];
  loops: Point[][];
  closed: boolean;
  width: number;
  shape: RoadShape;
}

export interface StreetNetwork {
  roads: StreetPiece[];
  sidewalks: StreetPiece[];
  blocks: number;
}

type Ring = [number, number][];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const sub = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point, n: number) => ({ x: a.x * n, y: a.y * n });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

const dedupe = (points: Point[], gap = 0.4) => {
  const clean: Point[] = [];
  for (const point of points) {
    const prev = clean[clean.length - 1];
    if (!prev || distance(prev, point) > gap) clean.push(point);
  }
  if (clean.length > 2 && distance(clean[0], clean[clean.length - 1]) <= gap) clean.pop();
  return clean;
};

const ringArea = (points: Point[]) => {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return area / 2;
};

const normalize = (d: Point) => {
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-6) return null;
  return { x: d.x / len, y: d.y / len };
};

const pointInRing = (point: Point, ring: Point[]) => {
  let inside = false;
  for (let index = 0, prev = ring.length - 1; index < ring.length; prev = index++) {
    const a = ring[index];
    const b = ring[prev];
    if ((a.y > point.y) !== (b.y > point.y)) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < x) inside = !inside;
    }
  }
  return inside;
};

const centroid = (points: Point[]) => {
  const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
};

const positiveRing = (ring: Point[]) => (ringArea(ring) >= 0 ? ring : ring.slice().reverse());

const roundPoint = (point: Point): Point => ({
  x: Math.round(point.x * 10) / 10,
  y: Math.round(point.y * 10) / 10,
});

const roundRing = (ring: Point[]) => dedupe(ring.map(roundPoint), 0.2);

const toClip = (ring: Point[], step = 0.05): Ring => {
  const points = ring.map((point) => [
    Math.round(point.x / step) * step,
    Math.round(point.y / step) * step,
  ] as [number, number]);
  const first = points[0];
  const last = points[points.length - 1];
  if (!last || first[0] !== last[0] || first[1] !== last[1]) points.push([first[0], first[1]]);
  return points;
};

const fromClip = (ring: Ring) => {
  const points = ring.map(([x, y]) => ({ x, y }));
  if (points.length > 1 && distance(points[0], points[points.length - 1]) < 0.4) points.pop();
  return dedupe(points, 0.2);
};

const asPolygons = (rings: Point[][]): MultiPolygon =>
  rings.filter((ring) => ring.length >= 3).map((ring) => [toClip(positiveRing(ring))]);

const pieceArea = (piece: StreetPiece) => {
  const holes = piece.shape.holes.reduce((sum, hole) => sum + Math.abs(ringArea(hole)), 0);
  return Math.abs(ringArea(piece.shape.outline)) - holes;
};

const combine = (op: "union" | "difference" | "intersection", parts: MultiPolygon[]): MultiPolygon => {
  const ready = parts.filter((part) => part.length > 0);
  if (ready.length === 0) return [];
  const apply = (acc: MultiPolygon, polygon: MultiPolygon) => {
    if (op === "union") return clipUnion(acc, polygon);
    if (op === "intersection") return clipIntersection(acc, polygon);
    return clipDifference(acc, polygon);
  };
  const run = (step: number) => {
    const scaled = ready.map((multi) => multi.map((polygon) => polygon.map((ring) => ring.map(([x, y]) => [
      Math.round(x / step) * step,
      Math.round(y / step) * step,
    ] as [number, number]))));
    return scaled.slice(1).reduce((acc, polygon) => apply(acc, polygon), scaled[0]);
  };
  try {
    return run(0.05);
  } catch {
    try {
      return run(0.5);
    } catch {
      return ready[0];
    }
  }
};

const ringsOf = (multi: MultiPolygon) =>
  multi
    .map((polygon) => ({
      outline: fromClip(polygon[0] || []),
      holes: polygon.slice(1).map((ring) => fromClip(ring)).filter((ring) => ring.length >= 3),
    }))
    .filter((polygon) => polygon.outline.length >= 3);

const elementRing = (el: MapElement): Point[] => {
  const pts = el.points && el.points.length >= 3
    ? el.points
    : [
      { x: el.x, y: el.y },
      { x: el.x + (el.width || 0), y: el.y },
      { x: el.x + (el.width || 0), y: el.y + (el.height || 0) },
      { x: el.x, y: el.y + (el.height || 0) },
    ];
  if (!el.rotation || pts.length === 0) return dedupe(pts);
  const center = centroid(pts);
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return dedupe(pts.map((point) => ({
    x: center.x + (point.x - center.x) * cos - (point.y - center.y) * sin,
    y: center.y + (point.x - center.x) * sin + (point.y - center.y) * cos,
  })));
};

const outwardNormal = (a: Point, b: Point) => {
  const dir = normalize(sub(b, a));
  if (!dir) return null;
  return { x: dir.y, y: -dir.x };
};

const ringGap = (a: Point[], b: Point[]) => {
  const pointSeg = (point: Point, start: Point, end: Point) => {
    const vx = end.x - start.x;
    const vy = end.y - start.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 < 1e-8 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * vx + (point.y - start.y) * vy) / len2));
    return Math.hypot(point.x - (start.x + vx * t), point.y - (start.y + vy * t));
  };
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j];
      const b1 = b[(j + 1) % b.length];
      best = Math.min(best, pointSeg(a[i], b0, b1), pointSeg(a2, b0, b1), pointSeg(b0, a[i], a2), pointSeg(b1, a[i], a2));
      if (best === 0) return 0;
    }
  }
  return best;
};

const pointOnEdge = (start: Point, end: Point, target: number, axis: Point) => {
  const origin = start.x * axis.x + start.y * axis.y;
  const span = (end.x - start.x) * axis.x + (end.y - start.y) * axis.y;
  const t = Math.abs(span) < 1e-6 ? 0 : (target - origin) / span;
  return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t };
};

/** جسر على الجزء المتقابل فقط، حتى لا يمتد ضلع قصير على ضلع الحديقة الطويل. */
const overlapQuad = (a0: Point, a1: Point, b0: Point, b1: Point): Point[] | null => {
  const axis = normalize(sub(a1, a0));
  if (!axis) return null;
  const project = (point: Point) => point.x * axis.x + point.y * axis.y;
  const aMin = Math.min(project(a0), project(a1));
  const aMax = Math.max(project(a0), project(a1));
  const bMin = Math.min(project(b0), project(b1));
  const bMax = Math.max(project(b0), project(b1));
  const overlapLow = Math.max(aMin, bMin);
  const overlapHigh = Math.min(aMax, bMax);
  if (overlapHigh - overlapLow < 2) return null;
  const pad = 6;
  const low = Math.max(Math.min(aMin, bMin), overlapLow - pad);
  const high = Math.min(Math.max(aMax, bMax), overlapHigh + pad);
  return [
    pointOnEdge(a0, a1, low, axis),
    pointOnEdge(a0, a1, high, axis),
    pointOnEdge(b0, b1, high, axis),
    pointOnEdge(b0, b1, low, axis),
  ];
};

const closestBridge = (a: Point[], b: Point[]): Point[][] => {
  let best = Infinity;
  let first = a[0];
  let second = b[0];
  const consider = (point: Point, start: Point, end: Point) => {
    const vx = end.x - start.x;
    const vy = end.y - start.y;
    const len2 = vx * vx + vy * vy;
    const t = len2 < 1e-8 ? 0 : Math.max(0, Math.min(1, ((point.x - start.x) * vx + (point.y - start.y) * vy) / len2));
    const hit = { x: start.x + vx * t, y: start.y + vy * t };
    const gap = Math.hypot(point.x - hit.x, point.y - hit.y);
    if (gap < best) {
      best = gap;
      first = point;
      second = hit;
    }
  };
  for (let i = 0; i < a.length; i++) {
    const a1 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j];
      const b1 = b[(j + 1) % b.length];
      consider(a[i], b0, b1);
      consider(a1, b0, b1);
      consider(b0, a[i], a1);
      consider(b1, a[i], a1);
    }
  }
  const axis = normalize(sub(second, first));
  if (!axis) return [];
  const side = { x: -axis.y, y: axis.x };
  const start = add(first, scale(axis, -2));
  const end = add(second, scale(axis, 2));
  return [[
    add(start, scale(side, 3)),
    add(end, scale(side, 3)),
    add(end, scale(side, -3)),
    add(start, scale(side, -3)),
  ]];
};

const facingBridges = (a: Point[], b: Point[], seam: number) => {
  const quads: Point[][] = [];
  for (let i = 0; i < a.length; i++) {
    const a0 = a[i];
    const a1 = a[(i + 1) % a.length];
    const normalA = outwardNormal(a0, a1);
    if (!normalA) continue;
    for (let j = 0; j < b.length; j++) {
      const b0 = b[j];
      const b1 = b[(j + 1) % b.length];
      const normalB = outwardNormal(b0, b1);
      if (!normalB || dot(normalA, normalB) > -0.7) continue;
      const gap = ringGap([a0, a1], [b0, b1]);
      if (gap <= 0.4 || gap >= seam) continue;
      const quad = overlapQuad(a0, a1, b0, b1);
      if (quad) quads.push(quad);
    }
  }
  return quads;
};

const bufferOut = (ring: Point[], amount: number): Point[][] => {
  const source = positiveRing(dedupe(ring));
  if (source.length < 3) return [];
  if (amount < 0.35) return [source];
  const polygons: MultiPolygon = [[toClip(source)]];
  const count = source.length;
  for (let index = 0; index < count; index++) {
    const a = source[index];
    const b = source[(index + 1) % count];
    const normal = outwardNormal(a, b);
    if (!normal) continue;
    const aOff = add(a, scale(normal, amount));
    const bOff = add(b, scale(normal, amount));
    polygons.push([toClip([a, b, bOff, aOff])]);
    const prev = source[(index - 1 + count) % count];
    const prevNormal = outwardNormal(prev, a);
    const nextDir = normalize(sub(b, a));
    const prevDir = normalize(sub(a, prev));
    if (!prevNormal || !nextDir || !prevDir) continue;
    const cross = prevDir.x * nextDir.y - prevDir.y * nextDir.x;
    if (cross <= 0.02) continue;
    const prevOff = add(a, scale(prevNormal, amount));
    polygons.push([toClip([a, prevOff, aOff])]);
  }
  return ringsOf(combine("union", polygons.map((polygon) => [polygon]))).map((polygon) => positiveRing(polygon.outline));
};

const mostlyInside = (ring: Point[], fence: Point[]) => {
  const samples = [...ring, centroid(ring)];
  const hits = samples.filter((point) => pointInRing(point, fence)).length;
  return hits / samples.length >= 0.34;
};

const fillPiece = (outline: Point[], holes: Point[][], width: number): StreetPiece | null => {
  const outer = roundRing(positiveRing(outline));
  const inner = holes.map((hole) => roundRing(positiveRing(hole))).filter((hole) => hole.length >= 3);
  if (outer.length < 3) return null;
  return {
    centerline: [],
    branches: [],
    loops: [],
    closed: true,
    width,
    shape: { outline: outer, holes: inner },
  };
};

/**
 * داخل الإطار: كل بلوك ومرفق وحديقة يأخذ رصيفاً حول محيطه،
 * والشارع هو المساحة الباقية. الشارع المرسوم يدوياً يُقتطع ولا يُحذف.
 */
export const generateStreetNetwork = (
  region: Point[],
  elements: MapElement[],
  roadWidth: number,
  sidewalkWidth: number,
): StreetNetwork | null => {
  const fence = positiveRing(dedupe(region, 0.8));
  if (fence.length < 3 || roadWidth < 4) return null;
  const seam = 6;
  const tagged = elements
    .filter((el) => el.type === "house" || el.type === "tower" || el.type === "amenity" || el.type === "green" || el.type === "pitch")
    .map((el) => ({ ring: positiveRing(elementRing(el)), kind: el.type }))
    .filter((item) => item.ring.length >= 3 && mostlyInside(item.ring, fence));
  if (tagged.length === 0) return null;
  const obstacles = tagged.map((item) => item.ring);
  const linkable = tagged.filter((item) => item.kind === "house" || item.kind === "tower").map((item) => item.ring);

  const bridges: Point[][] = [];
  for (let i = 0; i < linkable.length; i++) {
    for (let j = i + 1; j < linkable.length; j++) {
      if (ringGap(linkable[i], linkable[j]) >= seam) continue;
      const quads = facingBridges(linkable[i], linkable[j], seam);
      bridges.push(...(quads.length > 0 ? quads : closestBridge(linkable[i], linkable[j])));
    }
  }
  const islands = ringsOf(combine("union", [...obstacles, ...bridges].map((ring) => [[toClip(ring)]])))
    .map((polygon) => ({
      outline: positiveRing(polygon.outline),
      holes: polygon.holes.map((hole) => positiveRing(hole)).filter((hole) => hole.length >= 3),
    }))
    .filter((island) => island.outline.length >= 3);

  const manual = elements
    .filter((el) => (el.type === "road" || el.type === "sidewalk") && !el.pathGenerated)
    .map((el) => ({
      outline: positiveRing(elementRing(el)),
      holes: (el.pathHoles || []).map((hole) => positiveRing(hole)).filter((hole) => hole.length >= 3),
    }))
    .filter((road) => road.outline.length >= 3 && (mostlyInside(road.outline, fence) || road.outline.some((point) => pointInRing(point, fence))));

  const cutManual = (shape: MultiPolygon) => {
    let current = shape;
    for (const road of manual) {
      current = combine("difference", [current, [[toClip(road.outline), ...road.holes.map((hole) => toClip(hole))]]]);
    }
    return current;
  };

  const sidewalks: StreetPiece[] = [];
  const covers: Point[][] = [];
  const yards: Point[][] = [];
  for (const island of islands) {
    if (sidewalkWidth < 1) {
      covers.push(island.outline);
    } else {
      const outers = bufferOut(island.outline, sidewalkWidth).filter((ring) => ring.length >= 3);
      if (outers.length > 0) {
        let band = combine("difference", [
          combine("union", outers.map((ring) => [[toClip(ring)]])),
          [[toClip(island.outline)]],
        ]);
        band = combine("intersection", [band, [[toClip(fence)]]]);
        band = cutManual(band);
        for (const polygon of ringsOf(band)) {
          const piece = fillPiece(polygon.outline, polygon.holes, sidewalkWidth);
          if (piece && pieceArea(piece) >= 36) sidewalks.push(piece);
        }
        covers.push(...outers);
      } else {
        covers.push(island.outline);
      }
    }
    for (const hole of island.holes) yards.push(hole);
  }

  let asphalt = [[toClip(fence)]] as MultiPolygon;
  for (const cover of covers) {
    asphalt = combine("difference", [asphalt, [[toClip(cover)]]]);
  }
  for (const yard of yards) {
    let opening = [[toClip(yard)]] as MultiPolygon;
    for (const cover of covers) {
      const samples = [...cover, centroid(cover)];
      const inside = samples.filter((point) => pointInRing(point, yard)).length;
      if (samples.length === 0 || inside / samples.length < 0.6) continue;
      opening = combine("difference", [opening, [[toClip(cover)]]]);
    }
    asphalt = combine("union", [asphalt, opening]);
  }

  const roads = ringsOf(cutManual(asphalt))
    .map((polygon) => fillPiece(polygon.outline, polygon.holes, roadWidth))
    .filter((piece): piece is StreetPiece => !!piece && pieceArea(piece) >= 36);

  return { roads, sidewalks, blocks: islands.length };
};

/** أكثر المسار داخل منطقة التحديد، فيُستبدل عند إعادة التوليد. */
export const streetMostlyInside = (el: MapElement, region: Point[]) => {
  if (el.type !== "road" && el.type !== "sidewalk") return false;
  const samples = [
    ...(el.centerline || []),
    ...(el.centerlineBranches || []).flat(),
    ...(el.pathLoops || []).flat(),
    ...(el.points || []),
  ];
  if (samples.length === 0 || region.length < 3) return false;
  const inside = samples.filter((point) => pointInRing(point, region)).length;
  return inside / samples.length >= 0.6;
};
