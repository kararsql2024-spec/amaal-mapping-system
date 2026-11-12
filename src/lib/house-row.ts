import type { Point } from "@/types/project";

export interface HouseParcel {
  points: Point[];
  label: string;
}

export interface HouseExit {
  edge: [Point, Point];
  mid: Point;
  along: number;
  across: number;
}

/** آخر رقم في التسمية. stride=1 تسلسل عادي، stride=2 التسلسل الفردي المستخدم في التكرار. */
export const nextLabel = (label: string, steps = 1, stride = 2): string => {
  const parts = label.split("-");
  const lastPart = parts[parts.length - 1] || "";
  const match = lastPart.match(/([a-zA-Z]+)(\d+)/);
  if (!match) return label;
  parts[parts.length - 1] = `${match[1]}${parseInt(match[2], 10) + steps * stride}`;
  return parts.join("-");
};

export const nextOddLabel = (label: string, steps = 1): string => nextLabel(label, steps, 2);

export const rotatePoints = (points: Point[], degrees: number): Point[] => {
  if (!degrees || points.length === 0) return points.map((point) => ({ ...point }));
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map((point) => ({
    x: cx + (point.x - cx) * cos - (point.y - cy) * sin,
    y: cy + (point.x - cx) * sin + (point.y - cy) * cos,
  }));
};

const hypot = (dx: number, dy: number) => Math.hypot(dx, dy);

const unit = (x: number, y: number): Point => {
  const length = hypot(x, y);
  if (length < 1e-6) return { x: 1, y: 0 };
  return { x: x / length, y: y / length };
};

const leftOf = (tangent: Point): Point => ({ x: -tangent.y, y: tangent.x });

interface Frame {
  point: Point;
  tangent: Point;
}

const pathLength = (path: Point[]): number => {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += hypot(path[index].x - path[index - 1].x, path[index].y - path[index - 1].y);
  }
  return total;
};

const frameAt = (path: Point[], distance: number): Frame => {
  const total = pathLength(path);
  const target = Math.max(0, Math.min(distance, total));
  let walked = 0;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    const span = hypot(to.x - from.x, to.y - from.y);
    if (span < 1e-6) continue;
    if (walked + span >= target - 1e-4 || index === path.length - 1) {
      const local = span < 1e-6 ? 0 : (target - walked) / span;
      const atVertex = local <= 0.02 && index > 1;
      const atEndVertex = local >= 0.98 && index < path.length - 1;
      let tangent = unit(to.x - from.x, to.y - from.y);
      if (atVertex) {
        const previous = path[index - 2];
        const incoming = unit(from.x - previous.x, from.y - previous.y);
        tangent = unit(incoming.x + tangent.x, incoming.y + tangent.y);
      } else if (atEndVertex) {
        const next = path[index + 1];
        const outgoing = unit(next.x - to.x, next.y - to.y);
        tangent = unit(tangent.x + outgoing.x, tangent.y + outgoing.y);
      }
      const clamped = Math.max(0, Math.min(1, local));
      return {
        point: {
          x: from.x + (to.x - from.x) * clamped,
          y: from.y + (to.y - from.y) * clamped,
        },
        tangent,
      };
    }
    walked += span;
  }
  const last = path[path.length - 1];
  const prev = path[path.length - 2] || last;
  return { point: { ...last }, tangent: unit(last.x - prev.x, last.y - prev.y) };
};

export const polylineLength = (path: Point[]): number => pathLength(path);

const fitPath = (path: Point[], length: number): Point[] => {
  if (path.length < 2) return path.map((point) => ({ ...point }));
  const total = pathLength(path);
  if (total < 1) return path.map((point) => ({ ...point }));
  if (total + 0.5 < length) return extendPath(path, length);
  const fitted: Point[] = [{ ...path[0] }];
  let walked = 0;
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1];
    const to = path[index];
    const span = hypot(to.x - from.x, to.y - from.y);
    if (walked + span >= length) {
      const local = span < 1e-6 ? 0 : (length - walked) / span;
      fitted.push({
        x: from.x + (to.x - from.x) * local,
        y: from.y + (to.y - from.y) * local,
      });
      break;
    }
    fitted.push({ ...to });
    walked += span;
  }
  return fitted;
};

const samplesBetween = (path: Point[], start: number, end: number): Frame[] => {
  const first = frameAt(path, start);
  const last = frameAt(path, end);
  const heading = (frame: Frame) => Math.atan2(frame.tangent.y, frame.tangent.x);
  let turn = heading(last) - heading(first);
  while (turn <= -Math.PI) turn += Math.PI * 2;
  while (turn > Math.PI) turn -= Math.PI * 2;
  const chord = hypot(last.point.x - first.point.x, last.point.y - first.point.y);
  const absTurn = Math.abs(turn);
  const radius = absTurn > 0.02 && chord > 1 ? (chord / 2) / Math.sin(absTurn / 2) : Infinity;
  const tolerance = 1.5;
  const maxSlice = !Number.isFinite(radius)
    ? Math.PI
    : 2 * Math.acos(Math.max(-1, Math.min(1, 1 - tolerance / Math.max(radius, tolerance))));
  const segments = Math.max(1, Math.min(4, Math.ceil(absTurn / Math.max(maxSlice, 0.05))));
  const frames = [first];
  for (let index = 1; index < segments; index += 1) {
    frames.push(frameAt(path, start + ((end - start) * index) / segments));
  }
  frames.push(last);
  return frames;
};

const offset = (frame: Frame, amount: number): Point => {
  const normal = leftOf(frame.tangent);
  return {
    x: frame.point.x + normal.x * amount,
    y: frame.point.y + normal.y * amount,
  };
};

const ring = (frames: Frame[], across: number, side: 1 | -1, centered: boolean): Point[] => {
  const positive = centered ? across / 2 : (side > 0 ? across : 0);
  const negative = centered ? -across / 2 : (side > 0 ? 0 : -across);
  const left = frames.map((frame) => offset(frame, positive));
  const right = frames.map((frame) => offset(frame, negative));
  return [...left, ...right.reverse()];
};

export const measureHouseExit = (world: Point[], toward: Point): HouseExit | null => {
  if (world.length < 3) return null;
  const cx = world.reduce((sum, point) => sum + point.x, 0) / world.length;
  const cy = world.reduce((sum, point) => sum + point.y, 0) / world.length;
  const direction = unit(toward.x - cx, toward.y - cy);
  let best: HouseExit | null = null;
  let bestDot = -Infinity;
  world.forEach((start, index) => {
    const end = world[(index + 1) % world.length];
    const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
    const outward = unit(mid.x - cx, mid.y - cy);
    const score = outward.x * direction.x + outward.y * direction.y;
    if (score <= bestDot) return;
    const projections = world.map((point) => (point.x - mid.x) * outward.x + (point.y - mid.y) * outward.y);
    bestDot = score;
    best = {
      edge: [start, end],
      mid,
      across: Math.max(4, hypot(end.x - start.x, end.y - start.y)),
      along: Math.max(4, Math.max(...projections) - Math.min(...projections)),
    };
  });
  return best;
};

const orderEdge = (edge: [Point, Point], frame: Frame, across: number, side: 1 | -1, centered: boolean): [Point, Point] => {
  const positive = centered ? across / 2 : (side > 0 ? across : 0);
  const negative = centered ? -across / 2 : (side > 0 ? 0 : -across);
  const left = offset(frame, positive);
  const right = offset(frame, negative);
  const score = (point: Point, target: Point) => hypot(point.x - target.x, point.y - target.y);
  const [a, b] = edge;
  const straight = score(a, left) + score(b, right);
  const flipped = score(a, right) + score(b, left);
  return straight <= flipped ? [a, b] : [b, a];
};

export const buildHouseRow = ({
  path,
  count,
  along,
  across,
  firstLabel,
  side = 1,
  centered = true,
  startEdge,
  stride = 2,
}: {
  path: Point[];
  count: number;
  along: number;
  across: number;
  firstLabel: string;
  side?: 1 | -1;
  centered?: boolean;
  startEdge?: [Point, Point];
  stride?: 1 | 2;
}): HouseParcel[] => {
  const houses = Math.max(0, Math.floor(count));
  if (houses < 1 || along < 4 || across < 4 || path.length < 2) return [];
  const spine = fitPath(path, houses * along);
  if (pathLength(spine) < along * 0.5) return [];
  return Array.from({ length: houses }, (_, index) => {
    const frames = samplesBetween(spine, index * along, (index + 1) * along);
    let points = ring(frames, across, side, centered);
    if (index === 0 && startEdge && frames.length >= 2) {
      const [nearLeft, nearRight] = orderEdge(startEdge, frames[0], across, side, centered);
      const body = ring(frames.slice(1), across, side, centered);
      const half = Math.floor(body.length / 2);
      points = [nearLeft, ...body.slice(0, half), ...body.slice(half), nearRight];
    }
    return {
      points,
      label: index === 0 ? firstLabel : nextLabel(firstLabel, index, stride),
    };
  });
};

const signedDelta = (from: number, to: number) => {
  let delta = to - from;
  while (delta <= -Math.PI) delta += Math.PI * 2;
  while (delta > Math.PI) delta -= Math.PI * 2;
  return delta;
};

const circumcenter = (a: Point, b: Point, c: Point): Point | null => {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-3) return null;
  const a2 = a.x * a.x + a.y * a.y;
  const b2 = b.x * b.x + b.y * b.y;
  const c2 = c.x * c.x + c.y * c.y;
  return {
    x: (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d,
    y: (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d,
  };
};

/** قوس دائري من a إلى b. الزاوية الموجبة تحني منتصف الخط لليسار بالنسبة لاتجاهه. الطرفان ثابتان. */
export const arcBetween = (a: Point, b: Point, sweepDeg: number): Point[] => {
  const sweep = Math.max(-170, Math.min(170, sweepDeg)) * Math.PI / 180;
  if (Math.abs(sweep) < 0.004) return [{ ...a }, { ...b }];
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const chord = hypot(dx, dy);
  if (chord < 1) return [{ ...a }, { ...b }];
  const radius = Math.abs(chord / (2 * Math.sin(sweep / 2)));
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const left = { x: -dy / chord, y: dx / chord };
  const offset = radius * Math.cos(Math.abs(sweep) / 2);
  const candidates = [
    { x: mid.x + left.x * offset, y: mid.y + left.y * offset },
    { x: mid.x - left.x * offset, y: mid.y - left.y * offset },
  ];
  const match = candidates
    .map((center) => {
      const start = Math.atan2(a.y - center.y, a.x - center.x);
      const end = Math.atan2(b.y - center.y, b.x - center.x);
      const delta = signedDelta(start, end);
      return { center, start, delta };
    })
    .find((item) => Math.sign(item.delta) === Math.sign(sweep) && Math.abs(Math.abs(item.delta) - Math.abs(sweep)) < 0.08);
  if (!match) return [{ ...a }, { ...b }];
  const arcLength = radius * Math.abs(match.delta);
  const steps = Math.max(2, Math.ceil(arcLength / 6));
  const points: Point[] = [];
  for (let index = 0; index <= steps; index += 1) {
    const angle = match.start + match.delta * (index / steps);
    points.push({
      x: match.center.x + Math.cos(angle) * radius,
      y: match.center.y + Math.sin(angle) * radius,
    });
  }
  points[0] = { ...a };
  points[points.length - 1] = { ...b };
  return points;
};

/** يحني كل قطعة من منتصفها بالقوس، من غير تحريك النقاط التي وضعها المستخدم. */
export const bendPath = (points: Point[], sweepDeg: number): Point[] => {
  if (points.length < 2 || Math.abs(sweepDeg) < 0.2) return points.map((point) => ({ ...point }));
  const bent: Point[] = [];
  for (let index = 1; index < points.length; index += 1) {
    const arc = arcBetween(points[index - 1], points[index], sweepDeg);
    if (bent.length > 0) arc.shift();
    bent.push(...arc);
  }
  return bent;
};

const pointBack = (path: Point[], distance: number): Point => {
  const total = pathLength(path);
  return frameAt(path, Math.max(0, total - distance)).point;
};

const extendPath = (path: Point[], length: number): Point[] => {
  const total = pathLength(path);
  const last = path[path.length - 1];
  const prev = path[path.length - 2];
  const extra = length - total;
  const straight = () => {
    const tangent = unit(last.x - prev.x, last.y - prev.y);
    return [...path.map((point) => ({ ...point })), { x: last.x + tangent.x * extra, y: last.y + tangent.y * extra }];
  };
  if (path.length < 3 || extra < 1) return straight();
  const mid = pointBack(path, Math.min(80, total / 2));
  const start = pointBack(path, Math.min(160, total));
  const center = circumcenter(start, mid, last);
  if (!center) return straight();
  const radius = hypot(last.x - center.x, last.y - center.y);
  if (radius < 8 || radius > 20000) return straight();
  const endAngle = Math.atan2(last.y - center.y, last.x - center.x);
  const midAngle = Math.atan2(mid.y - center.y, mid.x - center.x);
  const turn = signedDelta(midAngle, endAngle);
  if (Math.abs(turn) < 1e-4) return straight();
  const extraAngle = (extra / radius) * Math.sign(turn);
  const steps = Math.max(1, Math.ceil(extra / 6));
  const added: Point[] = [];
  for (let index = 1; index <= steps; index += 1) {
    const angle = endAngle + extraAngle * (index / steps);
    added.push({
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    });
  }
  return [...path.map((point) => ({ ...point })), ...added];
};
