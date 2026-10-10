import polygonClipping from "polygon-clipping";

const clipUnion = polygonClipping.union;
import type { Point } from "@/types/project";

export interface RoadMarkings {
  center: Point[];
  edges: Point[][];
}

const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

const pointAlong = (pts: Point[], t: number): Point => {
  if (pts.length === 0) return { x: 0, y: 0 };
  if (pts.length === 1 || t <= 0) return pts[0];
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += distance(pts[i - 1], pts[i]);
  if (total === 0 || t >= 1) return pts[pts.length - 1];
  let remain = total * t;
  for (let i = 1; i < pts.length; i++) {
    const step = distance(pts[i - 1], pts[i]);
    if (remain <= step) {
      const u = step === 0 ? 0 : remain / step;
      return {
        x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * u,
        y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * u,
      };
    }
    remain -= step;
  }
  return pts[pts.length - 1];
};

const chainBetween = (points: Point[], fromEdge: number, toEdge: number): Point[] => {
  const count = points.length;
  const chain: Point[] = [];
  let index = (fromEdge + 1) % count;
  chain.push(points[index]);
  let guard = 0;
  while (index !== toEdge && guard < count) {
    index = (index + 1) % count;
    chain.push(points[index]);
    guard += 1;
  }
  return chain;
};

/** خط السير وحافتا الطريق داخل البصمة المرسومة، بما فيها الانعطاف والزيادة من جهة. */
export const roadMarkings = (points: Point[]): RoadMarkings => {
  const empty = { center: [] as Point[], edges: [] as Point[][] };
  const count = points.length;
  if (count < 4) return empty;

  let caps: { a: number; b: number; gap: number } | null = null;
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const adjacent = j === (i + 1) % count || i === (j + 1) % count;
      if (adjacent) continue;
      const midA = {
        x: (points[i].x + points[(i + 1) % count].x) / 2,
        y: (points[i].y + points[(i + 1) % count].y) / 2,
      };
      const midB = {
        x: (points[j].x + points[(j + 1) % count].x) / 2,
        y: (points[j].y + points[(j + 1) % count].y) / 2,
      };
      const gap = distance(midA, midB);
      if (!caps || gap > caps.gap) caps = { a: i, b: j, gap };
    }
  }
  if (!caps) return empty;

  const sideA = chainBetween(points, caps.a, caps.b);
  const sideB = chainBetween(points, caps.b, caps.a);
  if (sideA.length < 2 || sideB.length < 2) return empty;

  const samples = Math.max(sideA.length, sideB.length, 8);
  const center: Point[] = [];
  const left: Point[] = [];
  const right: Point[] = [];
  for (let sample = 0; sample < samples; sample++) {
    const t = samples === 1 ? 0 : sample / (samples - 1);
    const a = pointAlong(sideA, t);
    const b = pointAlong(sideB, 1 - t);
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    center.push(mid);
    left.push({ x: mid.x + (a.x - mid.x) * 0.62, y: mid.y + (a.y - mid.y) * 0.62 });
    right.push({ x: mid.x + (b.x - mid.x) * 0.62, y: mid.y + (b.y - mid.y) * 0.62 });
  }
  return { center, edges: [left, right] };
};

export interface PathHit {
  point: Point;
  segment: number;
  distance: number;
  atStart: boolean;
  atEnd: boolean;
}

export interface Corridor {
  outline: Point[];
  left: Point[];
  right: Point[];
}

const sub = (a: Point, b: Point) => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point) => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (a: Point, n: number) => ({ x: a.x * n, y: a.y * n });
const perp = (d: Point) => ({ x: -d.y, y: d.x });

const normalize = (d: Point) => {
  const len = Math.hypot(d.x, d.y);
  if (len < 1e-6) return null;
  return { x: d.x / len, y: d.y / len };
};

const dedupe = (points: Point[]) => {
  const clean: Point[] = [];
  for (const point of points) {
    const prev = clean[clean.length - 1];
    if (!prev || distance(prev, point) > 0.4) clean.push(point);
  }
  return clean;
};

const lineHit = (origin: Point, direction: Point, otherOrigin: Point, otherDirection: Point) => {
  const cross = direction.x * otherDirection.y - direction.y * otherDirection.x;
  if (Math.abs(cross) < 1e-6) return null;
  const delta = sub(otherOrigin, origin);
  const t = (delta.x * otherDirection.y - delta.y * otherDirection.x) / cross;
  return add(origin, scale(direction, t));
};

/** يبني شريطاً حول المسار. الانعطاف يلتقي عند الزاوية بدل تداخل قطعتين. */
export const buildCorridor = (points: Point[], width: number): Corridor => {
  const empty = { outline: [] as Point[], left: [] as Point[], right: [] as Point[] };
  const path = dedupe(points);
  if (path.length < 2 || width < 2) return empty;
  const half = width / 2;
  const dirs: Point[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const dir = normalize(sub(path[i + 1], path[i]));
    if (dir) dirs.push(dir);
  }
  if (dirs.length === 0) return empty;

  const left: Point[] = [];
  const right: Point[] = [];
  const pushSide = (bucket: Point[], point: Point) => {
    const prev = bucket[bucket.length - 1];
    if (!prev || distance(prev, point) > 0.4) bucket.push(point);
  };
  const cap = (point: Point, dir: Point) => {
    const normal = perp(dir);
    pushSide(left, add(point, scale(normal, half)));
    pushSide(right, add(point, scale(normal, -half)));
  };

  cap(path[0], dirs[0]);
  for (let i = 1; i < path.length - 1; i++) {
    const incoming = dirs[i - 1];
    const outgoing = dirs[Math.min(i, dirs.length - 1)];
    const dot = Math.max(-1, Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y));
    const normalIn = perp(incoming);
    const normalOut = perp(outgoing);
    const join = (sign: 1 | -1, bucket: Point[]) => {
      const a = scale(normalIn, sign * half);
      const b = scale(normalOut, sign * half);
      const from = add(path[i], a);
      const to = add(path[i], b);
      if (dot > 0.996) {
        pushSide(bucket, from);
        return;
      }
      const hit = lineHit(from, incoming, to, outgoing);
      const miter = hit ? distance(hit, path[i]) : Infinity;
      if (!hit || miter > half * 3 || dot < -0.2) {
        pushSide(bucket, from);
        pushSide(bucket, to);
        return;
      }
      pushSide(bucket, hit);
    };
    join(1, left);
    join(-1, right);
  }
  cap(path[path.length - 1], dirs[dirs.length - 1]);

  return { outline: [...left, ...right.slice().reverse()], left, right };
};

const ringArea = (points: Point[]) => {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    area += points[i].x * next.y - next.x * points[i].y;
  }
  return area / 2;
};

export interface RoadShape {
  outline: Point[];
  holes: Point[][];
}

const emptyShape = (): RoadShape => ({ outline: [], holes: [] });

const segmentRect = (start: Point, end: Point, width: number) => {
  const dir = normalize(sub(end, start));
  if (!dir) return [];
  const offset = scale(perp(dir), width / 2);
  return [add(start, offset), add(end, offset), sub(end, offset), sub(start, offset)];
};

const jointExtension = (incoming: Point | null, outgoing: Point | null, half: number) => {
  if (!incoming || !outgoing) return 0;
  const dot = Math.max(-1, Math.min(1, incoming.x * outgoing.x + incoming.y * outgoing.y));
  const cross = incoming.x * outgoing.y - incoming.y * outgoing.x;
  const angle = Math.abs(Math.atan2(cross, dot));
  if (angle < 0.03) return 0.8;
  return Math.min(Math.max(half * Math.tan(angle / 2), 0.8), half * 3);
};

const segmentStrips = (points: Point[], width: number, closed: boolean) => {
  const path = dedupe(points);
  if (closed && path.length >= 2 && distance(path[0], path[path.length - 1]) < 0.8) path.pop();
  if (path.length < 2 || width < 2) return [];
  const count = path.length;
  const segmentCount = closed && count >= 3 ? count : count - 1;
  const dirs: Array<Point | null> = [];
  for (let index = 0; index < segmentCount; index++) {
    dirs.push(normalize(sub(path[(index + 1) % count], path[index])));
  }
  const half = width / 2;
  const strips: Point[][] = [];
  for (let index = 0; index < segmentCount; index++) {
    const dir = dirs[index];
    if (!dir) continue;
    const prevDir = index > 0 ? dirs[index - 1] : closed ? dirs[segmentCount - 1] : null;
    const nextDir = index < segmentCount - 1 ? dirs[index + 1] : closed ? dirs[0] : null;
    const start = path[index];
    const end = path[(index + 1) % count];
    const extendedStart = add(start, scale(dir, -jointExtension(prevDir, dir, half)));
    const extendedEnd = add(end, scale(dir, jointExtension(dir, nextDir, half)));
    const rect = segmentRect(extendedStart, extendedEnd, width);
    if (rect.length === 4) strips.push(rect);
  }
  return strips;
};

const unionPolygons = (shapes: Point[][]): RoadShape => {
  const build = (step: number) => shapes
    .filter((shape) => shape.length >= 3)
    .map((shape) => {
      const ring = shape.map((point) => [
        Math.round(point.x / step) * step,
        Math.round(point.y / step) * step,
      ] as [number, number]);
      const first = ring[0];
      const last = ring[ring.length - 1];
      if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
      return [ring];
    });
  const polygons = build(0.1);
  if (polygons.length === 0) return emptyShape();
  if (polygons.length === 1) return { outline: dedupe(shapes[0]), holes: [] };
  let merged;
  try {
    merged = polygons.slice(1).reduce((acc, polygon) => clipUnion(acc, polygon), polygons[0]);
  } catch {
    const coarse = build(1);
    try {
      merged = coarse.slice(1).reduce((acc, polygon) => clipUnion(acc, polygon), coarse[0]);
    } catch {
      return { outline: dedupe(shapes[0]), holes: [] };
    }
  }
  let best = emptyShape();
  let bestArea = -1;
  for (const polygon of merged) {
    const rings = polygon
      .map((ring) => {
        const points = ring.map(([x, y]) => ({ x, y }));
        if (points.length > 1 && distance(points[0], points[points.length - 1]) < 0.4) points.pop();
        return dedupe(points);
      })
      .filter((ring) => ring.length >= 3);
    if (rings.length === 0) continue;
    const area = Math.abs(ringArea(rings[0]));
    if (area > bestArea) {
      bestArea = area;
      best = { outline: rings[0], holes: rings.slice(1) };
    }
  }
  return best;
};

/** شكل واحد من المسار وتفرعاته وحلقاته المغلقة. التداخل يصبح قطعة واحدة وفيها فراغ إن لزم. */
export const networkShape = (
  centerline: Point[],
  branches: Point[][],
  width: number,
  closed = false,
  loops: Point[][] = [],
): RoadShape => {
  const strips = [
    ...segmentStrips(centerline, width, closed),
    ...loops.flatMap((loop) => segmentStrips(loop, width, true)),
    ...branches.flatMap((branch) => segmentStrips(branch, width, false)),
  ];
  if (strips.length === 0) return emptyShape();
  if (strips.length === 1) return { outline: strips[0], holes: [] };
  return unionPolygons(strips);
};

export type DirectionMode = "global" | "local";

/** زاوية الضلع الأول. هذا اتجاه العنصر أثناء القفل المحلي. */
export const pathAxis = (points: Point[]) => {
  if (points.length < 2) return null;
  return Math.atan2(points[1].y - points[0].y, points[1].x - points[0].x);
};

/** يلصق النقطة على الأفقي أو العمودي، عاماً للخريطة أو محلياً لاتجاه الضلع الأول. */
export const snapDirection = (previous: Point, raw: Point, mode: DirectionMode, axisAngle: number | null) => {
  const dx = raw.x - previous.x;
  const dy = raw.y - previous.y;
  if (Math.hypot(dx, dy) < 0.5) return { ...previous };
  if (mode === "local" && axisAngle != null) {
    const ax = Math.cos(axisAngle);
    const ay = Math.sin(axisAngle);
    const along = dx * ax + dy * ay;
    const across = dx * -ay + dy * ax;
    if (Math.abs(along) >= Math.abs(across)) {
      return { x: previous.x + ax * along, y: previous.y + ay * along };
    }
    return { x: previous.x + -ay * across, y: previous.y + ax * across };
  }
  if (Math.abs(dx) >= Math.abs(dy)) return { x: raw.x, y: previous.y };
  return { x: previous.x, y: raw.y };
};

export const projectOntoPath = (path: Point[], target: Point, endSlop = 8): PathHit | null => {
  let best: PathHit | null = null;
  for (let i = 0; i < path.length - 1; i++) {
    const start = path[i];
    const end = path[i + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-6) continue;
    const t = Math.max(0, Math.min(1, ((target.x - start.x) * dx + (target.y - start.y) * dy) / len2));
    const point = { x: start.x + dx * t, y: start.y + dy * t };
    const gap = distance(target, point);
    if (!best || gap < best.distance) {
      best = { point, segment: i, distance: gap, atStart: false, atEnd: false };
    }
  }
  if (!best) return null;
  if (distance(best.point, path[0]) <= endSlop) {
    best.atStart = true;
    best.point = { ...path[0] };
  } else if (distance(best.point, path[path.length - 1]) <= endSlop) {
    best.atEnd = true;
    best.point = { ...path[path.length - 1] };
  }
  return best;
};

const snapToJoint = (path: Point[], joint: Point) => {
  const oriented = distance(path[0], joint) <= distance(path[path.length - 1], joint)
    ? path.map((point) => ({ ...point }))
    : path.slice().reverse().map((point) => ({ ...point }));
  oriented[0] = { ...joint };
  return dedupe(oriented);
};

const insertOnPath = (path: Point[], hit: PathHit) => {
  const next = path.map((point) => ({ ...point }));
  if (hit.atStart || hit.atEnd) return next;
  const start = path[hit.segment];
  const end = path[hit.segment + 1];
  if (distance(hit.point, start) <= 0.8 || distance(hit.point, end) <= 0.8) return next;
  next.splice(hit.segment + 1, 0, { ...hit.point });
  return next;
};

/** تقاطع شعاع مع مسار. t يبدأ بعد نقطة الأصل حتى لا يلتقط المسار نفسه. */
export const rayHitOnPath = (origin: Point, toward: Point, path: Point[], endSlop = 8): PathHit | null => {
  const dx = toward.x - origin.x;
  const dy = toward.y - origin.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.5 || path.length < 2) return null;
  const ux = dx / len;
  const uy = dy / len;
  let best: PathHit | null = null;
  let bestAlong = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i].x;
    const ay = path[i].y;
    const ex = path[i + 1].x - ax;
    const ey = path[i + 1].y - ay;
    const den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-8) continue;
    const ox = ax - origin.x;
    const oy = ay - origin.y;
    const t = (ox * ey - oy * ex) / den;
    const u = (ox * uy - oy * ux) / den;
    if (t > 1 && u >= -0.001 && u <= 1.001 && t < bestAlong) {
      bestAlong = t;
      best = {
        point: { x: origin.x + ux * t, y: origin.y + uy * t },
        segment: i,
        distance: 0,
        atStart: false,
        atEnd: false,
      };
    }
  }
  for (let i = 0; i < path.length; i++) {
    const vx = path[i].x - origin.x;
    const vy = path[i].y - origin.y;
    const along = vx * ux + vy * uy;
    if (along < 1) continue;
    const perp = Math.hypot(vx - ux * along, vy - uy * along);
    if (perp <= endSlop && along < bestAlong) {
      bestAlong = along;
      best = {
        point: { ...path[i] },
        segment: Math.max(0, Math.min(i, path.length - 2)),
        distance: perp,
        atStart: i === 0,
        atEnd: i === path.length - 1,
      };
    }
  }
  if (!best) return null;
  if (distance(best.point, path[0]) <= endSlop) {
    best.atStart = true;
    best.point = { ...path[0] };
  } else if (distance(best.point, path[path.length - 1]) <= endSlop) {
    best.atEnd = true;
    best.point = { ...path[path.length - 1] };
  }
  return best;
};

const pathsFromJoint = (path: Point[], hit: PathHit): Point[][] => {
  if (hit.atStart) return [path.map((point) => ({ ...point }))];
  if (hit.atEnd) return [path.slice().reverse().map((point) => ({ ...point }))];
  const withVertex = insertOnPath(path, hit);
  const index = withVertex.findIndex((point) => distance(point, hit.point) <= 0.8);
  if (index <= 0 || index >= withVertex.length - 1) return [withVertex];
  return [withVertex.slice(0, index + 1).reverse(), withVertex.slice(index)].filter((part) => part.length >= 2);
};

/** يمد مساراً من موضع على طوله. الطرف يكمل المسار، والوسط يصبح فرعاً. */
export const extendPath = (path: Point[], source: PathHit, extra: Point[], asBranch = false) => {
  const tail = extra.filter((point) => distance(point, source.point) > 0.8);
  if (asBranch || (!source.atStart && !source.atEnd)) {
    const branch = dedupe([{ ...source.point }, ...tail]);
    return { path: insertOnPath(path, source), branch: branch.length >= 2 ? branch : null };
  }
  const oriented = (source.atStart ? path.slice().reverse() : path.slice()).map((point) => ({ ...point }));
  if (distance(oriented[oriented.length - 1], source.point) > 0.8) oriented.push({ ...source.point });
  return { path: dedupe([...oriented, ...tail]), branch: null as Point[] | null };
};

/** يصل المسار الحالي من نقطة يختارها المستخدم، بطرف أو من منتصف المسار. */
export const connectPaths = (
  current: Point[],
  source: PathHit,
  other: Point[],
  hit: PathHit,
  currentBranches: Point[][] = [],
  otherBranches: Point[][] = [],
  fromInterior = false,
) => {
  const withSource = insertOnPath(current, source);
  const sourcePoint = { ...source.point };
  const joint = { ...hit.point };
  const atEnd = !fromInterior && (source.atStart || source.atEnd);
  const attached = pathsFromJoint(other, { ...hit, point: joint });
  if (!atEnd) {
    const arm = distance(sourcePoint, joint) > 0.8 ? [sourcePoint, joint] : [joint];
    const [first, ...rest] = attached;
    const branches = [...currentBranches, ...otherBranches];
    if (first) branches.push(dedupe([...arm, ...first.slice(1)]));
    else if (arm.length >= 2) branches.push(arm);
    rest.forEach((part) => branches.push(part));
    return {
      centerline: withSource,
      branches: branches.filter((path) => path.length >= 2),
    };
  }
  const line = (source.atStart ? withSource.slice().reverse() : withSource.slice()).map((point) => ({ ...point }));
  if (distance(line[line.length - 1], joint) > 0.8) line.push(joint);
  if (hit.atStart || hit.atEnd) {
    const rest = (hit.atStart ? other : other.slice().reverse()).map((point) => ({ ...point }));
    return {
      centerline: dedupe([...line, ...rest.slice(1)]),
      branches: [...currentBranches, ...otherBranches].filter((path) => path.length >= 2),
    };
  }
  return {
    centerline: dedupe(line),
    branches: [...currentBranches, ...otherBranches, ...attached].filter((path) => path.length >= 2),
  };
};

/** يجمع مسارين عند نقطة الربط. الطرف بطرف يصبح منعطفاً، والوسط يصبح تفرعاً. */
export const joinPaths = (
  current: Point[],
  other: Point[],
  hit: PathHit,
  currentBranches: Point[][] = [],
  otherBranches: Point[][] = [],
) => {
  const branch = snapToJoint(current, hit.point);
  if (hit.atStart || hit.atEnd) {
    const main = (hit.atStart ? other.slice().reverse() : other.slice()).map((point) => ({ ...point }));
    main[main.length - 1] = { ...hit.point };
    return {
      centerline: dedupe([...main, ...branch.slice(1)]),
      branches: [...otherBranches, ...currentBranches].filter((path) => path.length >= 2),
    };
  }
  return {
    centerline: insertOnPath(other, hit),
    branches: [...otherBranches, branch, ...currentBranches].filter((path) => path.length >= 2),
  };
};
