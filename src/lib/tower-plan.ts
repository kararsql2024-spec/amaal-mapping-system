import type { MapElement, Point } from "@/types/project";
import { getApartmentKey, getApartmentSize } from "@/lib/units";

/**
 * ترقيم الشقق كحرف N: كل عمود زوج.
 * الفردي أسفل والزوجي أعلى، من اليسار إلى اليمين.
 * 4 شقق: 1 أسفل يسار، 2 أعلى يسار، 3 أسفل يمين، 4 أعلى يمين.
 */
const apartmentSlot = (apt: number, total: number) => {
  const cols = Math.max(1, Math.ceil(total / 2));
  if (cols === 1) return { col: 0, row: apt <= 1 ? 0 : 1 };
  const index = apt - 1;
  return {
    col: Math.floor(index / 2),
    row: index % 2 === 0 ? 0 : 1,
  };
};

export type FloorCell = { apt: number; along: number; across: number; span: number; cross: number };
export type PlanJoint = { along: number; across: number; span: number; cross: number };

/** يقسم بصمة الطابق حسب مساحات الشقق، مع فاصل ظاهر بين كل شقة وجارتها. */
export const floorPlan = (
  el: MapElement,
  total: number,
  span: number,
  cross: number,
): { cells: FloorCell[]; joints: PlanJoint[]; seam: number } => {
  const cols = Math.max(1, Math.ceil(total / 2));
  const sourceFloor = (el.floors || 1) > 1 ? 2 : 1;
  const areaOf = (apt: number) => {
    const typical = getApartmentSize(el, sourceFloor, apt);
    if (typical > 0) return typical;
    const ground = getApartmentSize(el, 1, apt);
    return ground > 0 ? ground : 1;
  };
  const seam = Math.min(0.9, Math.max(0.45, Math.min(span, cross) * 0.022));
  const bite = 0.05;
  const slots = Array.from({ length: total }, (_, index) => {
    const apt = index + 1;
    return { apt, ...apartmentSlot(apt, total), area: areaOf(apt) };
  });

  const colWeight = Array.from({ length: cols }, () => 0);
  slots.forEach((slot) => {
    colWeight[slot.col] += slot.area;
  });
  const weightSum = colWeight.reduce((sum, weight) => sum + weight, 0) || 1;
  const innerSpan = Math.max(span - seam * Math.max(cols - 1, 0), span * 0.5);
  let cursor = -span / 2;
  const columns = colWeight.map((weight) => {
    const size = innerSpan * (weight / weightSum);
    const start = cursor;
    cursor += size + seam;
    return { start, size };
  });

  const splitColumn = (col: number) => {
    const top = slots.find((slot) => slot.col === col && slot.row === 1);
    const bottom = slots.find((slot) => slot.col === col && slot.row === 0);
    if (!top || !bottom) return null;
    const innerCross = Math.max(cross - seam, cross * 0.55);
    const topDepth = innerCross * (top.area / (top.area + bottom.area));
    return { topDepth, bottomDepth: innerCross - topDepth };
  };

  const cells = slots.map((slot) => {
    const column = columns[slot.col];
    const split = splitColumn(slot.col);
    let depth = cross;
    let acrossStart = -cross / 2;
    if (split && slot.row === 1) {
      depth = split.topDepth;
    } else if (split && slot.row === 0) {
      depth = split.bottomDepth;
      acrossStart = -cross / 2 + split.topDepth + seam;
    }
    return {
      apt: slot.apt,
      along: column.start + column.size / 2,
      across: acrossStart + depth / 2,
      span: column.size,
      cross: depth,
    };
  });

  const joints: PlanJoint[] = [];
  for (let index = 0; index < columns.length - 1; index++) {
    joints.push({
      along: columns[index].start + columns[index].size + seam / 2,
      across: 0,
      span: seam + bite,
      cross: cross + seam,
    });
  }
  columns.forEach((column, col) => {
    const split = splitColumn(col);
    if (!split) return;
    joints.push({
      along: column.start + column.size / 2,
      across: -cross / 2 + split.topDepth + seam / 2,
      span: column.size + seam,
      cross: seam + bite,
    });
  });

  return { cells, joints, seam };
};

/** قلب الواجهة ثم تدوير الخطة داخل البصمة بخطوات 90 درجة. بلا قلب وبلا تدوير تبقى القيم كما هي. */
export const orientPlanBox = (
  along: number,
  across: number,
  span: number,
  cross: number,
  quarter: number,
  flip: boolean,
) => {
  const a = along;
  const c = flip ? -across : across;
  const turn = ((quarter % 4) + 4) % 4;
  if (turn === 1) return { along: -c, across: a, span: cross, cross: span };
  if (turn === 2) return { along: -a, across: -c, span, cross };
  if (turn === 3) return { along: c, across: -a, span: cross, cross: span };
  return { along: a, across: c, span, cross };
};

export type TowerPlanCell = { apt: number; x: number; y: number; w: number; h: number };

type PlanFrame = {
  cx: number;
  cy: number;
  alongX: boolean;
  span: number;
  cross: number;
  quarter: number;
  flip: boolean;
};

const planFrame = (el: MapElement, points: Point[]): PlanFrame | null => {
  if (points.length < 3) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let cx = 0;
  let cy = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    cx += point.x;
    cy += point.y;
  }
  cx /= points.length;
  cy /= points.length;
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const alongX = width >= height;
  return {
    cx,
    cy,
    alongX,
    span: alongX ? width : height,
    cross: alongX ? height : width,
    quarter: el.planQuarter || 0,
    flip: !!el.planFlip,
  };
};

const projectBox = (box: PlanJoint, frame: PlanFrame) => {
  const turned = orientPlanBox(box.along, box.across, box.span, box.cross, frame.quarter, frame.flip);
  if (frame.alongX) {
    return {
      x: frame.cx + turned.along - turned.span / 2,
      y: frame.cy + turned.across - turned.cross / 2,
      w: turned.span,
      h: turned.cross,
    };
  }
  return {
    x: frame.cx + turned.across - turned.cross / 2,
    y: frame.cy + turned.along - turned.span / 2,
    w: turned.cross,
    h: turned.span,
  };
};

/** مستطيلات الشقق في إحداثيات المخطط قبل دوران قطعة الأرض. */
export const towerPlanCells = (el: MapElement, points: Point[]): TowerPlanCell[] => {
  const frame = planFrame(el, points);
  if (!frame) return [];
  const plan = floorPlan(el, Math.max(1, el.apartmentsPerFloor || 1), frame.span, frame.cross);
  return plan.cells.map((cell) => ({ apt: cell.apt, ...projectBox(cell, frame) }));
};

/** شقق الطابق الأرضي المجمّدة، وهي الفراغ الذي يحل محله باب العمارة. */
export const groundFrozenApartments = (
  el: MapElement,
  houses: Record<string, { status?: string } | undefined> = {},
): number[] => {
  const total = Math.max(1, el.apartmentsPerFloor || 1);
  const frozen: number[] = [];
  for (let apt = 1; apt <= total; apt++) {
    const status = houses[getApartmentKey(el.id, 1, apt)]?.status;
    if (status === "frozen_hidden" || status === "frozen_uncounted") frozen.push(apt);
  }
  return frozen;
};

export type TowerEntrance = { apt: number | null; along: number; edge: number; reach: number };

/**
 * مكان الباب على واجهة الصف الفردي.
 * أربع شقق: بين 1 و3. صف أعرض: مكان الشقة الأمامية الوسطى المجمّدة.
 */
export const towerEntrance = (
  el: MapElement,
  total: number,
  span: number,
  cross: number,
  frozenApts: Iterable<number> = [],
): TowerEntrance | null => {
  if (total < 1 || span < 1 || cross < 1) return null;
  const plan = floorPlan(el, total, span, cross);
  const cells = new Map(plan.cells.map((cell) => [cell.apt, cell]));
  const front: FloorCell[] = [];
  for (let apt = 1; apt <= total; apt += 2) {
    const cell = cells.get(apt);
    if (cell) front.push(cell);
  }
  if (front.length === 0) return null;
  const frozen = new Set(frozenApts);
  const edgeOf = (cell: FloorCell) => cell.across + cell.cross / 2;
  const mark = (cell: FloorCell, apt: number | null, along = cell.along): TowerEntrance => ({
    apt,
    along,
    edge: edgeOf(cell),
    reach: Math.max(cell.cross * 0.72, plan.seam * 4),
  });

  if (front.length >= 3) {
    const inner = front.slice(1, -1);
    const missing = inner.filter((cell) => frozen.has(cell.apt));
    if (missing.length > 0) {
      const mid = (front[0].along + front[front.length - 1].along) / 2;
      missing.sort((a, b) => Math.abs(a.along - mid) - Math.abs(b.along - mid) || a.apt - b.apt);
      return mark(missing[0], missing[0].apt);
    }
    if (front.length % 2 === 1) return mark(front[(front.length - 1) / 2], null);
  }

  if (front.length === 1) return mark(front[0], null);

  const mid = (front[0].along + front[front.length - 1].along) / 2;
  let pair = 0;
  let best = Infinity;
  for (let index = 0; index < front.length - 1; index++) {
    const seam = (front[index].along + front[index + 1].along) / 2;
    const dist = Math.abs(seam - mid);
    if (dist < best) {
      best = dist;
      pair = index;
    }
  }
  const left = front[pair];
  const right = front[pair + 1];
  const edge = Math.max(edgeOf(left), edgeOf(right));
  return {
    apt: null,
    along: (left.along + right.along) / 2,
    edge,
    reach: Math.max(Math.min(left.cross, right.cross) * 0.72, plan.seam * 4),
  };
};

const projectPoint = (along: number, across: number, frame: PlanFrame) => {
  const turned = orientPlanBox(along, across, 0, 0, frame.quarter, frame.flip);
  if (frame.alongX) return { x: frame.cx + turned.along, y: frame.cy + turned.across };
  return { x: frame.cx + turned.across, y: frame.cy + turned.along };
};

export type TowerDoorMark = { apt: number | null; x1: number; y1: number; x2: number; y2: number };

/** سهم مكان الباب في إحداثيات المخطط. الرأس نحو خارج الواجهة. */
export const towerPlanDoor = (
  el: MapElement,
  points: Point[],
  houses: Record<string, { status?: string } | undefined> = {},
): TowerDoorMark | null => {
  const frame = planFrame(el, points);
  if (!frame) return null;
  const total = Math.max(1, el.apartmentsPerFloor || 1);
  const entrance = towerEntrance(el, total, frame.span, frame.cross, groundFrozenApartments(el, houses));
  if (!entrance) return null;
  const tail = projectPoint(entrance.along, entrance.edge - entrance.reach * 0.2, frame);
  const head = projectPoint(entrance.along, entrance.edge + entrance.reach * 0.95, frame);
  return { apt: entrance.apt, x1: tail.x, y1: tail.y, x2: head.x, y2: head.y };
};
