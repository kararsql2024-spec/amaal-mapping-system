export type Pt = { x: number; y: number };

export const WALL_THICKNESS = 0.15;

/** الضلع التالي أفقي أو عمودي تماماً، حتى لا يميل الطول. */
export const axisPoint = (prev: Pt, raw: Pt, grid: boolean): Pt => {
  const horizontal = Math.abs(raw.x - prev.x) >= Math.abs(raw.y - prev.y);
  const snapped = snapPoint(horizontal ? { x: raw.x, y: prev.y } : { x: prev.x, y: raw.y }, grid);
  return horizontal ? { x: snapped.x, y: prev.y } : { x: prev.x, y: snapped.y };
};

export const snapPoint = (point: Pt, grid: boolean): Pt => {
  if (!grid) return point;
  const step = 0.25;
  return { x: Math.round(point.x / step) * step, y: Math.round(point.y / step) * step };
};

export const pathLength = (points: Pt[]) => {
  let length = 0;
  for (let index = 1; index < points.length; index++) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return length;
};

/** أقرب موضع على المسار، بالمسافة من أول نقطة. */
export const closestOnPath = (points: Pt[], point: Pt) => {
  let best = { along: 0, x: points[0]?.x || 0, y: points[0]?.y || 0, gap: Infinity };
  let cursor = 0;
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1];
    const end = points[index];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len2 = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / len2));
    const x = start.x + dx * t;
    const y = start.y + dy * t;
    const gap = Math.hypot(point.x - x, point.y - y);
    const along = cursor + Math.hypot(dx, dy) * t;
    if (gap < best.gap) best = { along, x, y, gap };
    cursor += Math.hypot(dx, dy);
  }
  return best;
};

export const poseAt = (points: Pt[], along: number) => {
  let cursor = 0;
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1];
    const end = points[index];
    const len = Math.hypot(end.x - start.x, end.y - start.y);
    if (cursor + len >= along || index === points.length - 1) {
      const t = len ? Math.max(0, Math.min(1, (along - cursor) / len)) : 0;
      return {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
        angle: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
      };
    }
    cursor += len;
  }
  return { x: points[0]?.x || 0, y: points[0]?.y || 0, angle: 0 };
};

export const nearestVertex = (points: Pt[], point: Pt, limit: number) => {
  let best = -1;
  let gap = limit;
  points.forEach((vertex, index) => {
    const distance = Math.hypot(vertex.x - point.x, vertex.y - point.y);
    if (distance <= gap) {
      gap = distance;
      best = index;
    }
  });
  return best;
};

export type WallGuides = {
  vertices: Pt[];
  segments: { a: Pt; b: Pt }[];
};

const SNAP_VERTEX = 0.42;
const SNAP_EDGE = 0.34;
const SNAP_ALIGN = 0.3;

const closestVertexPoint = (points: Pt[], raw: Pt, limit: number) => {
  let best: Pt | null = null;
  let gap = limit;
  points.forEach((vertex) => {
    const distance = Math.hypot(vertex.x - raw.x, vertex.y - raw.y);
    if (distance <= gap) {
      gap = distance;
      best = vertex;
    }
  });
  return best;
};

const pullGuide = (value: number, pool: number[], limit: number) => {
  let best = value;
  let gap = limit;
  pool.forEach((guide) => {
    const distance = Math.abs(value - guide);
    if (distance < gap) {
      gap = distance;
      best = guide;
    }
  });
  return { value: best, hit: gap < limit };
};

/** يلتصق حسب الخيار فقط: الركن بالحواف، الشبكة بالمربعات، والزاوية القائمة بالمحور. الرسم الحر لا يجذب النقطة. */
export const snapWallPoint = (
  raw: Pt,
  prev: Pt | null,
  guides: WallGuides,
  options: { free: boolean; grid: boolean; vertex?: boolean; lock?: "x" | "y" | null },
): Pt => {
  const vertexSnap = options.vertex === true;
  const onGrid = (value: number) => (options.grid ? Math.round(value / 0.25) * 0.25 : value);
  const gridded = (point: Pt) => ({ x: onGrid(point.x), y: onGrid(point.y) });

  if (vertexSnap) {
    const vertex = closestVertexPoint(guides.vertices, raw, SNAP_VERTEX);
    if (vertex) return { x: vertex.x, y: vertex.y };
    let edge: Pt | null = null;
    let edgeGap = SNAP_EDGE;
    guides.segments.forEach((segment) => {
      const hit = closestOnPath([segment.a, segment.b], raw);
      if (hit.gap <= edgeGap) {
        edgeGap = hit.gap;
        edge = { x: hit.x, y: hit.y };
      }
    });
    if (edge) return edge;
  }

  let lock = options.lock || null;
  if (!lock && prev && !options.free) {
    lock = Math.abs(raw.x - prev.x) >= Math.abs(raw.y - prev.y) ? "y" : "x";
  }
  if (prev && lock === "y") return { x: onGrid(raw.x), y: prev.y };
  if (prev && lock === "x") return { x: prev.x, y: onGrid(raw.y) };
  if (!vertexSnap) return gridded(raw);

  const xs = guides.vertices.map((point) => point.x);
  const ys = guides.vertices.map((point) => point.y);
  if (prev) {
    xs.push(prev.x);
    ys.push(prev.y);
  }
  const x = pullGuide(raw.x, xs, SNAP_ALIGN);
  const y = pullGuide(raw.y, ys, SNAP_ALIGN);
  return { x: x.hit ? x.value : onGrid(raw.x), y: y.hit ? y.value : onGrid(raw.y) };
};
