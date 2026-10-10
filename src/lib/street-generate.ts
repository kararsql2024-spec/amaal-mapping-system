import polygonClipping from "polygon-clipping";
import type { MapElement, Point } from "@/types/project";
import { networkShape, type RoadShape } from "@/lib/road-geometry";

const clipUnion = polygonClipping.union;

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

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
const sub = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point, n: number) => ({ x: a.x * n, y: a.y * n });
const dot = (a: Point, b: Point) => a.x * b.x + a.y * b.y;

const dedupe = (points: Point[], gap = 0.8) => {
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

const leftNormal = (dir: Point) => ({ x: -dir.y, y: dir.x });

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

const toClip = (ring: Point[]) => {
  const points = ring.map((point) => [point.x, point.y] as [number, number]);
  const first = points[0];
  const last = points[points.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) points.push([first[0], first[1]]);
  return points;
};

const fromClip = (ring: [number, number][]) => {
  const points = ring.map(([x, y]) => ({ x, y }));
  if (points.length > 1 && distance(points[0], points[points.length - 1]) < 0.4) points.pop();
  return dedupe(points);
};

const uniteOutlines = (rings: Point[][]) => {
  const polygons = rings.filter((ring) => ring.length >= 3).map((ring) => [toClip(ring)]);
  if (polygons.length === 0) return [] as Point[][];
  if (polygons.length === 1) return [dedupe(rings.find((ring) => ring.length >= 3) || [])];
  const merged = polygons.slice(1).reduce((acc, polygon) => clipUnion(acc, polygon), polygons[0]);
  return merged
    .map((polygon) => fromClip(polygon[0] as [number, number][]))
    .filter((ring) => ring.length >= 3);
};

/** إزاحة حلقة مغلقة. الموجب للخارج عندما تكون المساحة موجبة. */
const offsetClosed = (ring: Point[], delta: number) => {
  const source = dedupe(ring);
  if (source.length < 3 || Math.abs(delta) < 0.35) return source;
  const shape = networkShape(source, [], Math.abs(delta) * 2, true);
  if (delta > 0) return shape.outline.length >= 3 ? dedupe(shape.outline) : [];
  const inner = shape.holes[0];
  return inner && inner.length >= 3 ? dedupe(inner) : [];
};

const positiveRing = (ring: Point[]) => (ringArea(ring) >= 0 ? ring : ring.slice().reverse());

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

const axisDelta = (a: number, b: number) => {
  let delta = Math.abs(a - b) % 180;
  if (delta > 90) delta = 180 - delta;
  return delta;
};

const segmentDistance = (a: Point, b: Point, c: Point, d: Point) => {
  const samples = 4;
  let best = Infinity;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    for (let j = 0; j <= samples; j++) {
      const u = j / samples;
      const q = { x: c.x + (d.x - c.x) * u, y: c.y + (d.y - c.y) * u };
      best = Math.min(best, distance(p, q));
    }
  }
  return best;
};

const ringsTouch = (a: Point[], b: Point[]) => {
  if (pointInRing(centroid(a), b) || pointInRing(centroid(b), a)) return 0;
  let best = Infinity;
  for (let i = 0; i < a.length; i++) {
    const a2 = a[(i + 1) % a.length];
    for (let j = 0; j < b.length; j++) {
      best = Math.min(best, segmentDistance(a[i], a2, b[j], b[(j + 1) % b.length]));
      if (best === 0) return 0;
    }
  }
  return best;
};

interface Block {
  rings: Point[][];
  obstacle: boolean;
  road: Point[];
}

interface EdgeRef {
  block: number;
  index: number;
  a: Point;
  b: Point;
  dir: Point;
  normal: Point;
}

const edgesOf = (ring: Point[], block: number): EdgeRef[] => {
  const edges: EdgeRef[] = [];
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const dir = normalize(sub(b, a));
    if (!dir) continue;
    edges.push({ block, index, a, b, dir, normal: leftNormal(dir) });
  }
  return edges;
};

interface Pair {
  left: EdgeRef;
  right: EdgeRef;
  a: Point;
  b: Point;
  gap: number;
}

const facingPair = (left: EdgeRef, right: EdgeRef, roadWidth: number): Pair | null => {
  if (left.block === right.block) return null;
  if (dot(left.dir, right.dir) > -0.965) return null;
  const midL = { x: (left.a.x + left.b.x) / 2, y: (left.a.y + left.b.y) / 2 };
  const midR = { x: (right.a.x + right.b.x) / 2, y: (right.a.y + right.b.y) / 2 };
  const between = sub(midR, midL);
  const gap = Math.hypot(between.x, between.y);
  if (gap < 1.2 || gap > roadWidth * 1.15) return null;
  const outward = dot(between, left.normal) / gap;
  if (outward < 0.65) return null;
  const origin = left.a;
  const project = (point: Point) => dot(sub(point, origin), left.dir);
  const l0 = 0;
  const l1 = project(left.b);
  const r0 = project(right.a);
  const r1 = project(right.b);
  const lo = Math.max(Math.min(l0, l1), Math.min(r0, r1));
  const hi = Math.min(Math.max(l0, l1), Math.max(r0, r1));
  if (hi - lo < Math.max(roadWidth * 0.45, 8)) return null;
  const sep = dot(sub(right.a, left.a), left.normal);
  const at = (t: number) => add(add(origin, scale(left.dir, t)), scale(left.normal, sep / 2));
  return { left, right, a: at(lo), b: at(hi), gap };
};

const crossesObstacle = (a: Point, b: Point, obstacles: Point[][]) => {
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  return obstacles.some((ring) => pointInRing(mid, ring) || pointInRing(a, ring) || pointInRing(b, ring));
};

const chainsFromLoop = (loop: Point[], consumed: Map<number, { a: Point; b: Point }>) => {
  const count = loop.length;
  if (consumed.size === 0 || consumed.size >= count) return [] as Point[][];
  let start = 0;
  for (let index = 0; index < count; index++) {
    if (consumed.has(index)) {
      start = (index + 1) % count;
      break;
    }
  }
  const chains: Point[][] = [];
  let chain: Point[] = [];
  for (let step = 0; step < count; step++) {
    const index = (start + step) % count;
    const prev = (index - 1 + count) % count;
    const opened = consumed.has(prev) && chain.length === 0;
    if (opened) chain.push(consumed.get(prev)!.b);
    if (consumed.has(index)) {
      const joint = consumed.get(index)!.a;
      if (chain.length === 0) chain.push(joint);
      else chain[chain.length - 1] = joint;
      const cleaned = dedupe(chain);
      if (cleaned.length >= 2) chains.push(cleaned);
      chain = [];
      continue;
    }
    if (!opened) chain.push(loop[index]);
  }
  const tail = dedupe(chain);
  if (tail.length >= 2) chains.push(tail);
  return chains;
};

const stitchSegments = (segments: Point[][]) => {
  const pending = segments.map((segment) => ({ points: segment.map((point) => ({ ...point })), used: false }));
  const lines: Point[][] = [];
  const aligned = (from: Point, to: Point, next: Point) => {
    const dir = normalize(sub(to, from));
    const step = normalize(sub(next, to));
    return !!dir && !!step && dot(dir, step) > 0.94;
  };
  for (let index = 0; index < pending.length; index++) {
    if (pending[index].used) continue;
    pending[index].used = true;
    const line = pending[index].points.map((point) => ({ ...point }));
    let grew = true;
    while (grew) {
      grew = false;
      for (const piece of pending) {
        if (piece.used || piece.points.length < 2) continue;
        const head = line[0];
        const tail = line[line.length - 1];
        const before = line.length > 1 ? line[line.length - 2] : head;
        const after = line.length > 1 ? line[1] : head;
        const first = piece.points[0];
        const last = piece.points[piece.points.length - 1];
        if (distance(first, tail) <= 3 && (line.length < 2 || aligned(before, tail, last))) {
          line.push(...piece.points.slice(1));
          piece.used = true;
          grew = true;
        } else if (distance(last, tail) <= 3 && (line.length < 2 || aligned(before, tail, first))) {
          line.push(...piece.points.slice(0, -1).reverse());
          piece.used = true;
          grew = true;
        } else if (distance(last, head) <= 3 && (line.length < 2 || aligned(first, head, after))) {
          line.unshift(...piece.points.slice(0, -1));
          piece.used = true;
          grew = true;
        } else if (distance(first, head) <= 3 && (line.length < 2 || aligned(last, head, after))) {
          line.unshift(...piece.points.slice(1).reverse());
          piece.used = true;
          grew = true;
        }
      }
    }
    const cleaned = dedupe(line);
    if (cleaned.length >= 2) lines.push(cleaned);
  }
  return lines;
};

const pieceShape = (closedLines: Point[][], openLines: Point[][], width: number): StreetPiece | null => {
  const loops = closedLines.filter((line) => line.length >= 3).map((line) => line.map((point) => ({ ...point })));
  const opens = openLines.filter((line) => line.length >= 2);
  let centerline: Point[] = [];
  let closed = false;
  let branches = opens;
  let extraLoops = loops;
  if (opens.length > 0) {
    let longest = -1;
    let longestIndex = 0;
    opens.forEach((line, index) => {
      let length = 0;
      for (let point = 1; point < line.length; point++) length += distance(line[point - 1], line[point]);
      if (length > longest) {
        longest = length;
        longestIndex = index;
      }
    });
    centerline = opens[longestIndex];
    branches = opens.filter((_, index) => index !== longestIndex);
  } else if (loops.length > 0) {
    centerline = loops[0];
    closed = true;
    extraLoops = loops.slice(1);
  }
  if (centerline.length < 2 && extraLoops.length === 0) return null;
  const shape = networkShape(centerline, branches, width, closed, extraLoops);
  if (shape.outline.length < 3) return null;
  return { centerline, branches, loops: extraLoops, closed, width, shape };
};

const groupTouching = (parts: { points: Point[]; closed: boolean }[], reach: number) => {
  const parent = parts.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      let near = false;
      for (const p of parts[i].points) {
        for (const q of parts[j].points) {
          if (distance(p, q) <= reach) {
            near = true;
            break;
          }
        }
        if (near) break;
      }
      if (near) join(i, j);
    }
  }
  const groups = new Map<number, { points: Point[]; closed: boolean }[]>();
  parts.forEach((part, index) => {
    const root = find(index);
    const list = groups.get(root) || [];
    list.push(part);
    groups.set(root, list);
  });
  return [...groups.values()];
};

/**
 * يولّد شوارع المنطقة: حلقة حول شكل كل بلوك، ثم شارع واحد بين الضلعين المتقابلين، ثم رصيف.
 * الفراغ الأضيق من عرض الشارع يبقى داخل البلوك ولا يُشق.
 */
export const generateStreetNetwork = (
  region: Point[],
  elements: MapElement[],
  roadWidth: number,
  sidewalkWidth: number,
): StreetNetwork | null => {
  const fence = dedupe(region);
  if (fence.length < 3 || roadWidth < 4) return null;
  const bridge = roadWidth * 0.5;
  const items = elements
    .filter((el) => el.type === "house" || el.type === "tower" || el.type === "amenity" || el.type === "green" || el.type === "pitch")
    .map((el) => {
      const ring = positiveRing(elementRing(el));
      return {
        ring,
        angle: el.rotation || 0,
        obstacle: el.type === "green" || el.type === "pitch",
        center: centroid(ring),
      };
    })
    .filter((item) => item.ring.length >= 3 && pointInRing(item.center, fence));
  if (items.length === 0) return null;

  const parent = items.map((_, index) => index);
  const find = (index: number): number => (parent[index] === index ? index : (parent[index] = find(parent[index])));
  const join = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  for (let i = 0; i < items.length; i++) {
    if (items[i].obstacle) continue;
    for (let j = i + 1; j < items.length; j++) {
      if (items[j].obstacle) continue;
      if (axisDelta(items[i].angle, items[j].angle) > 15) continue;
      if (distance(items[i].center, items[j].center) > 280) continue;
      if (ringsTouch(items[i].ring, items[j].ring) < roadWidth) join(i, j);
    }
  }

  const clusters = new Map<number, typeof items>();
  items.forEach((item, index) => {
    const root = item.obstacle ? -(index + 1) : find(index);
    const list = clusters.get(root) || [];
    list.push(item);
    clusters.set(root, list);
  });

  const blocks: Block[] = [];
  for (const cluster of clusters.values()) {
    const inflated = uniteOutlines(cluster.map((item) => {
      const grown = networkShape(item.ring, [], bridge * 2, true).outline;
      return grown.length >= 3 ? grown : item.ring;
    }));
    const contour = inflated.sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0];
    if (!contour || contour.length < 3) continue;
    const outward = sidewalkWidth + roadWidth / 2 - bridge;
    const road = positiveRing(outward >= 0.35 ? offsetClosed(contour, outward) : outward < -0.35 ? offsetClosed(contour, outward) : contour);
    if (road.length < 3) continue;
    blocks.push({ rings: cluster.map((item) => item.ring), obstacle: cluster[0].obstacle, road });
  }
  if (blocks.length === 0) return null;

  const obstacles = blocks.filter((block) => block.obstacle).map((block) => block.rings[0]);
  const edges = blocks.flatMap((block, index) => edgesOf(block.road, index));
  const pairs: Pair[] = [];
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const pair = facingPair(edges[i], edges[j], roadWidth);
      if (!pair || crossesObstacle(pair.a, pair.b, obstacles)) continue;
      pairs.push(pair);
    }
  }
  pairs.sort((a, b) => a.gap - b.gap);
  const taken = new Set<string>();
  const consumed = blocks.map(() => new Map<number, { a: Point; b: Point }>());
  const publicSegments: Point[][] = [];
  for (const pair of pairs) {
    const leftKey = `${pair.left.block}:${pair.left.index}`;
    const rightKey = `${pair.right.block}:${pair.right.index}`;
    if (taken.has(leftKey) || taken.has(rightKey)) continue;
    taken.add(leftKey);
    taken.add(rightKey);
    consumed[pair.left.block].set(pair.left.index, { a: pair.a, b: pair.b });
    const reverse = { a: pair.b, b: pair.a };
    consumed[pair.right.block].set(pair.right.index, reverse);
    publicSegments.push([pair.a, pair.b]);
  }

  const roadParts: { points: Point[]; closed: boolean }[] = [];
  blocks.forEach((block, index) => {
    if (consumed[index].size === 0) {
      roadParts.push({ points: block.road, closed: true });
      return;
    }
    chainsFromLoop(block.road, consumed[index]).forEach((chain) => roadParts.push({ points: chain, closed: false }));
  });
  stitchSegments(publicSegments).forEach((line) => roadParts.push({ points: line, closed: false }));

  const roads = groupTouching(roadParts, roadWidth * 0.8)
    .map((group) => pieceShape(
      group.filter((part) => part.closed).map((part) => part.points),
      group.filter((part) => !part.closed).map((part) => part.points),
      roadWidth,
    ))
    .filter((piece): piece is StreetPiece => !!piece);

  const sidewalks: StreetPiece[] = [];
  if (sidewalkWidth >= 4) {
    for (const block of blocks) {
      const contour = uniteOutlines(block.rings.map((ring) => {
        const grown = networkShape(ring, [], bridge * 2, true).outline;
        return grown.length >= 3 ? grown : ring;
      })).sort((a, b) => Math.abs(ringArea(b)) - Math.abs(ringArea(a)))[0];
      if (!contour) continue;
      const inset = sidewalkWidth / 2 - bridge;
      const loop = positiveRing(offsetClosed(contour, inset));
      const piece = pieceShape([loop], [], sidewalkWidth);
      if (piece) sidewalks.push(piece);
    }
  }

  return { roads, sidewalks, blocks: blocks.length };
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
