import type { MapElement, Point } from "@/types/project";
import { getApartmentSize } from "@/lib/units";

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

/** مستطيلات الشقق في إحداثيات المخطط قبل دوران قطعة الأرض. */
export const towerPlanCells = (el: MapElement, points: Point[]): TowerPlanCell[] => {
  if (points.length < 3) return [];
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
  const span = alongX ? width : height;
  const cross = alongX ? height : width;
  const plan = floorPlan(el, Math.max(1, el.apartmentsPerFloor || 1), span, cross);
  const quarter = el.planQuarter || 0;
  const flip = !!el.planFlip;
  return plan.cells.map((cell) => {
    const box = orientPlanBox(cell.along, cell.across, cell.span, cell.cross, quarter, flip);
    if (alongX) {
      return {
        apt: cell.apt,
        x: cx + box.along - box.span / 2,
        y: cy + box.across - box.cross / 2,
        w: box.span,
        h: box.cross,
      };
    }
    return {
      apt: cell.apt,
      x: cx + box.across - box.cross / 2,
      y: cy + box.along - box.span / 2,
      w: box.cross,
      h: box.span,
    };
  });
};
