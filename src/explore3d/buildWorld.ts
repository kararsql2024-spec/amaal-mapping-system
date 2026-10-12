import type { MapElement, Point } from "@/types/project";
import { getStatusMeta } from "@/lib/unit-status";
import { getApartmentLabel } from "@/lib/units";
import { floorPlan, orientPlanBox } from "@/lib/tower-plan";
import {
  AMENITY_COLORS,
  COLORS,
  AMENITY_HEIGHT_M,
  FLOOR_BAND_M,
  FLOOR_HEIGHT_M,
  HOUSE_LOT_SHORT_M,
  MAX_SHRUBS,
  MAX_SHRUBS_PER_GREEN,
  MAX_TREES,
  MAX_TREES_PER_GREEN,
  SHRUB_SPACING_M,
  TARGET_MAP_SPAN_M,
  TOWER_FRONTAGE_M,
  TOWER_ROOF_M,
  TREE_SPACING_M,
} from "./constants";
import { boundsOf, centroid, hashString, pointInPoly, yawOffset } from "./geometry";
import { networkShape } from "@/lib/road-geometry";
import type { ExploreWorld, GroundPoly, PlacedInstance, UnitLite, WorldPoint } from "./types";

const elementPoints = (el: MapElement): Point[] => {
  if (el.points && el.points.length > 0) return el.points;
  const x = el.x || 0;
  const y = el.y || 0;
  const w = el.width || 0;
  const h = el.height || 0;
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ];
};

/** نفس دوران المخطط: النقاط مخزّنة بلا دوران، والدوران حول مركز الشكل. */
const orientedPoints = (el: MapElement): Point[] => {
  const pts = elementPoints(el);
  if (!el.rotation || pts.length === 0) return pts;
  let cx = 0;
  let cy = 0;
  for (const point of pts) {
    cx += point.x;
    cy += point.y;
  }
  cx /= pts.length;
  cy /= pts.length;
  const rad = (el.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return pts.map((point) => ({
    x: cx + (point.x - cx) * cos - (point.y - cy) * sin,
    y: cy + (point.x - cx) * sin + (point.y - cy) * cos,
  }));
};

const cleanRing = (points: WorldPoint[]): WorldPoint[] => {
  const ring: WorldPoint[] = [];
  for (const point of points) {
    const prev = ring[ring.length - 1];
    if (prev && Math.hypot(point.x - prev.x, point.z - prev.z) < 0.04) continue;
    ring.push(point);
  }
  if (ring.length > 2) {
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (Math.hypot(first.x - last.x, first.z - last.z) < 0.04) ring.pop();
  }
  return ring;
};

export const statusHex = (status?: string): number => {
  const fill = getStatusMeta(status).fill;
  return Number.parseInt(fill.replace("#", ""), 16);
};

const median = (values: number[]) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const medianShortSide = (list: MapElement[], type: string) => {
  const sides: number[] = [];
  for (const el of list) {
    if (el?.type !== type) continue;
    const pts = elementPoints(el);
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const point of pts) {
      minX = Math.min(minX, point.x);
      maxX = Math.max(maxX, point.x);
      minY = Math.min(minY, point.y);
      maxY = Math.max(maxY, point.y);
    }
    const short = Math.min(maxX - minX, maxY - minY);
    if (short > 1) sides.push(short);
  }
  return median(sides);
};

/**
 * المخطط مرسوم بالبكسل بلا مقياس مساحي.
 * واجهة المنزل النموذجية تساوي 12 م، وبقية العناصر تتبع نفس المقياس.
 */
const resolveMetersPerPixel = (list: MapElement[], spanX: number, spanY: number) => {
  const house = medianShortSide(list, "house");
  if (house > 1) return HOUSE_LOT_SHORT_M / house;
  const tower = medianShortSide(list, "tower");
  if (tower > 1) return TOWER_FRONTAGE_M / tower;
  return TARGET_MAP_SPAN_M / Math.max(spanX, spanY, 1);
};

/**
 * يحوّل عناصر المخطط الحالي إلى مشهد خفيف.
 * لا يحتفظ بمراجع العناصر ولا بالصور.
 */
export const buildWorld = (
  elements: MapElement[] | undefined,
  mapWidth: number,
  mapHeight: number,
  units: Record<string, UnitLite>,
): ExploreWorld => {
  const list = Array.isArray(elements) ? elements : [];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of list) {
    if (!el || el.type === "reference_image" || el.type === "text") continue;
    for (const p of elementPoints(el)) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
  }

  if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
    minX = 0;
    minY = 0;
    maxX = mapWidth || 1;
    maxY = mapHeight || 1;
  }

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const metersPerPixel = resolveMetersPerPixel(list, spanX, spanY);
  const originX = (minX + maxX) / 2;
  const originY = (minY + maxY) / 2;

  const toWorld = (points: Point[]): WorldPoint[] =>
    points.map((p) => ({
      x: (p.x - originX) * metersPerPixel,
      z: (p.y - originY) * metersPerPixel,
    }));

  const ground: GroundPoly[] = [];
  const houses: PlacedInstance[] = [];
  const towers: PlacedInstance[] = [];
  const apartments: PlacedInstance[] = [];
  const joints: PlacedInstance[] = [];
  const trees: PlacedInstance[] = [];
  const shrubs: PlacedInstance[] = [];
  const amenities: PlacedInstance[] = [];

  for (const el of list) {
    if (!el?.id || !el.type) continue;
    const worldPts = toWorld(elementPoints(el));
    if (worldPts.length < 3) continue;

    if (el.type === "road" || el.type === "sidewalk" || el.type === "green" || el.type === "pitch") {
      let outline = elementPoints(el);
      let holeRings = el.pathHoles || [];
      if ((el.type === "road" || el.type === "sidewalk") && el.centerline && el.centerline.length >= 2 && el.pathWidth) {
        const shape = networkShape(el.centerline, el.centerlineBranches || [], el.pathWidth, !!el.pathClosed, el.pathLoops || []);
        if (shape.outline.length >= 3) {
          outline = shape.outline;
          holeRings = shape.holes;
        }
      }
      const roadPts = toWorld(outline);
      const holes = holeRings
        .map((hole) => toWorld(hole))
        .filter((hole) => hole.length >= 3);
      ground.push({ id: el.id, kind: el.type, points: roadPts.length >= 3 ? roadPts : worldPts, holes: holes.length > 0 ? holes : undefined });
      if (el.type === "green") {
        scatterPlanting(el.id, worldPts, trees, shrubs);
      }
      continue;
    }

    const box = boundsOf(worldPts);
    const center = centroid(worldPts);
    const rotY = -((el.rotation || 0) * Math.PI) / 180;

    if (el.type === "house") {
      const unit = units[el.id];
      if (unit?.status === "frozen_hidden") continue;
      const status = unit?.status || "available";
      const footprint = cleanRing(toWorld(orientedPoints(el)));
      const footprintBox = boundsOf(footprint);
      const footprintCenter = centroid(footprint);
      houses.push({
        id: el.id,
        kind: "house",
        label: el.label || "منزل",
        x: footprintCenter.x,
        z: footprintCenter.z,
        rotY: 0,
        sx: Math.max(footprintBox.width, 0.8),
        sy: 1,
        sz: Math.max(footprintBox.depth, 0.8),
        points: footprint.length >= 3 ? footprint : undefined,
        color: statusHex(status),
        status,
      });
      continue;
    }

    if (el.type === "tower") {
      const floors = Math.max(1, el.floors || 1);
      const apartmentsPerFloor = Math.max(1, el.apartmentsPerFloor || 1);
      const width = Math.max(box.width, 0.8);
      const depth = Math.max(box.depth, 0.8);
      const height = floors * FLOOR_HEIGHT_M + TOWER_ROOF_M;
      towers.push({
        id: el.id,
        kind: "tower",
        label: el.label || "عمارة",
        x: center.x,
        z: center.z,
        rotY,
        sx: width,
        sy: height,
        sz: depth,
        color: COLORS.towerRoof,
        floors,
        apartmentsPerFloor,
      });

      const alongX = width >= depth;
      const span = alongX ? width : depth;
      const cross = alongX ? depth : width;
      const plan = floorPlan(el, apartmentsPerFloor, span, cross);
      const cellH = Math.max(FLOOR_HEIGHT_M - FLOOR_BAND_M, FLOOR_HEIGHT_M * 0.72);
      const turnBox = (along: number, across: number, boxSpan: number, boxCross: number) =>
        orientPlanBox(along, across, boxSpan, boxCross, el.planQuarter || 0, !!el.planFlip);
      const placeBox = (
        bucket: PlacedInstance[],
        along: number,
        across: number,
        boxSpan: number,
        boxCross: number,
        y: number,
        sy: number,
        extra: Partial<PlacedInstance>,
      ) => {
        const local = alongX ? { x: along, z: across } : { x: across, z: along };
        const offset = yawOffset(local.x, local.z, rotY);
        bucket.push({
          id: el.id,
          kind: "tower",
          label: el.label || "عمارة",
          x: center.x + offset.x,
          y,
          z: center.z + offset.z,
          rotY,
          sx: alongX ? boxSpan : boxCross,
          sy,
          sz: alongX ? boxCross : boxSpan,
          color: COLORS.towerJoint,
          floors,
          apartmentsPerFloor,
          ...extra,
        });
      };

      for (let floor = 1; floor <= floors; floor++) {
        for (const cell of plan.cells) {
          const unitKey = `${el.id}_F${floor}_A${cell.apt}`;
          const status = units[unitKey]?.status || "available";
          if (status === "frozen_hidden") continue;
          const turned = turnBox(cell.along, cell.across, cell.span, cell.cross);
          placeBox(
            apartments,
            turned.along,
            turned.across,
            turned.span,
            turned.cross,
            (floor - 1) * FLOOR_HEIGHT_M,
            cellH,
            {
              kind: "apartment",
              unitKey,
              code: getApartmentLabel(el, floor, cell.apt, units),
              color: statusHex(status),
              status,
              floor,
              apt: cell.apt,
            },
          );
        }
        placeBox(
          joints,
          0,
          0,
          span + plan.seam,
          cross + plan.seam,
          floor * FLOOR_HEIGHT_M - FLOOR_BAND_M,
          FLOOR_BAND_M + 0.04,
          {},
        );
      }

      const bodyH = floors * FLOOR_HEIGHT_M;
      plan.joints.forEach((joint) => {
        const turned = turnBox(joint.along, joint.across, joint.span, joint.cross);
        placeBox(joints, turned.along, turned.across, turned.span, turned.cross, 0, bodyH, {});
      });
      continue;
    }

    if (el.type === "amenity") {
      const amenityType = el.amenityType || "shop";
      const footprint = cleanRing(toWorld(orientedPoints(el)));
      const footprintBox = boundsOf(footprint);
      const footprintCenter = centroid(footprint);
      amenities.push({
        id: el.id,
        kind: "amenity",
        amenityType,
        label: el.label || amenityType,
        x: footprintCenter.x,
        z: footprintCenter.z,
        rotY: 0,
        sx: Math.max(footprintBox.width, 0.8),
        sy: AMENITY_HEIGHT_M,
        sz: Math.max(footprintBox.depth, 0.8),
        points: footprint.length >= 3 ? footprint : undefined,
        color: AMENITY_COLORS[amenityType] || COLORS.amenity,
      });
    }
  }

  return {
    metersPerPixel,
    spanM: Math.max(spanX, spanY) * metersPerPixel,
    siteWidthM: spanX * metersPerPixel,
    siteDepthM: spanY * metersPerPixel,
    ground,
    houses,
    towers,
    apartments,
    joints,
    trees,
    shrubs,
    amenities,
  };
};

const insideLawn = (x: number, z: number, poly: WorldPoint[], margin: number) => {
  if (!pointInPoly(x, z, poly)) return false;
  if (margin <= 0) return true;
  return (
    pointInPoly(x + margin, z, poly) &&
    pointInPoly(x - margin, z, poly) &&
    pointInPoly(x, z + margin, poly) &&
    pointInPoly(x, z - margin, poly)
  );
};

const scatterPlanting = (id: string, poly: WorldPoint[], trees: PlacedInstance[], shrubs: PlacedInstance[]) => {
  const box = boundsOf(poly);
  const placeTree = (x: number, z: number, key: string) => {
    if (trees.length >= MAX_TREES) return false;
    const h = hashString(key);
    const scale = 0.94 + (h % 28) / 100;
    trees.push({
      id: `${id}-tree-${trees.length}`,
      kind: "tree",
      label: "شجرة",
      x,
      z,
      rotY: ((h % 360) * Math.PI) / 180,
      sx: scale,
      sy: scale * (0.94 + ((h >> 6) % 12) / 100),
      sz: scale,
      color: [0x9aaf86, 0xa8b992, 0x8fa37c][h % 3],
    });
    return true;
  };
  let treesHere = 0;
  const treeStep = TREE_SPACING_M;
  for (let x = box.minX + treeStep * 0.5; x < box.maxX && treesHere < MAX_TREES_PER_GREEN; x += treeStep) {
    for (let z = box.minZ + treeStep * 0.5; z < box.maxZ && treesHere < MAX_TREES_PER_GREEN; z += treeStep) {
      if (trees.length >= MAX_TREES) break;
      const h = hashString(`${id}:tree:${Math.round(x)}:${Math.round(z)}`);
      const jx = x + ((h % 1000) / 1000 - 0.5) * treeStep * 0.55;
      const jz = z + (((h >> 10) % 1000) / 1000 - 0.5) * treeStep * 0.55;
      if (!insideLawn(jx, jz, poly, 2.4)) continue;
      if (placeTree(jx, jz, `${id}:tree:${jx}:${jz}`)) treesHere += 1;
    }
  }
  if (treesHere === 0 && trees.length < MAX_TREES) {
    const center = centroid(poly);
    if (pointInPoly(center.x, center.z, poly)) placeTree(center.x, center.z, `${id}:tree:center`);
  }

  let shrubsHere = 0;
  const shrubStep = SHRUB_SPACING_M;
  for (let x = box.minX + shrubStep * 0.35; x < box.maxX && shrubsHere < MAX_SHRUBS_PER_GREEN; x += shrubStep) {
    for (let z = box.minZ + shrubStep * 0.35; z < box.maxZ && shrubsHere < MAX_SHRUBS_PER_GREEN; z += shrubStep) {
      if (shrubs.length >= MAX_SHRUBS) return;
      const h = hashString(`${id}:shrub:${Math.round(x)}:${Math.round(z)}`);
      const jx = x + ((h % 1000) / 1000 - 0.5) * shrubStep * 0.7;
      const jz = z + (((h >> 10) % 1000) / 1000 - 0.5) * shrubStep * 0.7;
      if (!insideLawn(jx, jz, poly, 1.3)) continue;
      const scale = 0.72 + (h % 40) / 100;
      shrubs.push({
        id: `${id}-shrub-${shrubsHere}`,
        kind: "tree",
        label: "شجيرة",
        x: jx,
        z: jz,
        rotY: ((h % 360) * Math.PI) / 180,
        sx: scale,
        sy: scale * (0.75 + ((h >> 4) % 20) / 100),
        sz: scale,
        color: [0xa8b992, 0xb7c4a4, 0x9aaf86][h % 3],
      });
      shrubsHere += 1;
    }
  }
};
