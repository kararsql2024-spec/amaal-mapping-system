import * as THREE from "three";
import { FLOOR_STEP, WALL_HEIGHT } from "./types";

export type StairPoint = { x: number; y: number };

const wood = (color: number, roughness = 0.56, metalness = 0) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

const cross = (o: StairPoint, a: StairPoint, b: StairPoint) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

export const convexHull = (points: StairPoint[]) => {
  const sorted = points.slice().sort((p, q) => p.x - q.x || p.y - q.y);
  const build = (source: StairPoint[]) => {
    const ring: StairPoint[] = [];
    source.forEach((point) => {
      while (ring.length >= 2 && cross(ring[ring.length - 2], ring[ring.length - 1], point) <= 0) ring.pop();
      ring.push(point);
    });
    return ring;
  };
  const lower = build(sorted);
  const upper = build(sorted.slice().reverse());
  lower.pop();
  upper.pop();
  return lower.concat(upper);
};

const unit = (from: StairPoint, to: StairPoint) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len, len };
};

const toward = (normal: StairPoint, from: StairPoint, aim: StairPoint) => {
  const vx = aim.x - from.x;
  const vy = aim.y - from.y;
  return vx * normal.x + vy * normal.y >= 0 ? normal : { x: -normal.x, y: -normal.y };
};

const edge = (origin: StairPoint, normal: StairPoint, half: number) => [
  { x: origin.x + normal.x * half, y: origin.y + normal.y * half },
  { x: origin.x - normal.x * half, y: origin.y - normal.y * half },
];

export const stairLayout = (points: StairPoint[]) => {
  if (points.length < 4) return null;
  const [a, b, c, d] = points;
  const run1 = unit(a, b);
  const run2 = unit(c, d);
  if (run1.len < 0.45 || run2.len < 0.45) return null;
  const inward1 = toward({ x: -run1.y, y: run1.x }, b, c);
  const inward2 = toward({ x: -run2.y, y: run2.x }, c, b);
  const gap = Math.min(
    Math.abs((c.x - a.x) * inward1.x + (c.y - a.y) * inward1.y),
    Math.abs((d.x - a.x) * inward1.x + (d.y - a.y) * inward1.y),
  );
  const inside = (gap - 0.05) / 2;
  const fits = inside >= 0.16;
  const width = fits ? Math.min(1.15, inside) : Math.min(1.05, Math.max(0.32, gap));
  const n1 = fits ? inward1 : { x: -inward1.x, y: -inward1.y };
  const n2 = fits ? inward2 : { x: -inward2.x, y: -inward2.y };
  const shift = width / 2 + (fits ? 0 : 0.03);
  const moved = (point: StairPoint, normal: StairPoint) => ({ x: point.x + normal.x * shift, y: point.y + normal.y * shift });
  const a2 = moved(a, n1);
  const b2 = moved(b, n1);
  const c2 = moved(c, n2);
  const d2 = moved(d, n2);
  const end1 = edge(b2, n1, width / 2);
  const start2 = edge(c2, n2, width / 2);
  const straight = Math.hypot(end1[0].x - start2[0].x, end1[0].y - start2[0].y) + Math.hypot(end1[1].x - start2[1].x, end1[1].y - start2[1].y);
  const crossed = Math.hypot(end1[0].x - start2[1].x, end1[0].y - start2[1].y) + Math.hypot(end1[1].x - start2[0].x, end1[1].y - start2[0].y);
  const landing = straight <= crossed ? [end1[0], end1[1], start2[1], start2[0]] : [end1[0], end1[1], start2[0], start2[1]];
  const footprint = [...edge(a2, n1, width / 2), ...end1, ...edge(c2, n2, width / 2), ...edge(d2, n2, width / 2), a, b, c, d];
  return { a: a2, b: b2, c: c2, d: d2, run1, run2, n1, n2, width, landing, outline: convexHull(footprint) };
};

export const stairOutline = (points: StairPoint[]) => stairLayout(points)?.outline ?? null;

const orient = (mesh: THREE.Object3D, ux: number, uy: number) => {
  mesh.rotation.y = Math.atan2(ux, uy);
};

const bar = (parent: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material, segments = 14) => {
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  if (length < 0.04) return;
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, segments), material);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.position.copy(from).add(to).multiplyScalar(0.5);
  mesh.castShadow = true;
  parent.add(mesh);
};

const newel = (parent: THREE.Object3D, x: number, y: number, z: number, material: THREE.Material, roomTop: number) => {
  const postHeight = Math.min(1.02, Math.max(0, roomTop - y - 0.04));
  if (postHeight < 0.16) return;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, postHeight, 16), material);
  post.position.set(x, y + postHeight / 2, z);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), material);
  cap.position.set(x, y + postHeight, z);
  post.castShadow = true;
  cap.castShadow = true;
  parent.add(post, cap);
};

const addFlight = (
  parent: THREE.Object3D,
  from: StairPoint,
  to: StairPoint,
  y0: number,
  y1: number,
  base: number,
  width: number,
  tread: THREE.Material,
  riserMat: THREE.Material,
  rail: THREE.Material,
) => {
  const run = unit(from, to);
  const steps = Math.max(4, Math.round((y1 - y0) / 0.17));
  const rise = (y1 - y0) / steps;
  const going = run.len / steps;
  const nx = -run.y;
  const ny = run.x;
  const roomTop = base + WALL_HEIGHT;
  const treadW = Math.max(0.04, width - 0.02);
  for (let step = 0; step < steps; step++) {
    const along = (step + 0.5) * going - 0.008;
    const cx = from.x + run.x * along;
    const cz = from.y + run.y * along;
    const top = base + y0 + (step + 1) * rise;
    const board = new THREE.Mesh(new THREE.BoxGeometry(treadW, 0.04, Math.max(0.03, going - 0.008)), tread);
    board.position.set(cx, top - 0.02, cz);
    board.castShadow = true;
    board.receiveShadow = true;
    orient(board, run.x, run.y);
    const face = new THREE.Mesh(new THREE.BoxGeometry(Math.max(0.06, treadW - 0.03), Math.max(rise - 0.04, 0.03), 0.018), riserMat);
    face.position.set(from.x + run.x * (step * going + 0.008), top - rise / 2, from.y + run.y * (step * going + 0.008));
    orient(face, run.x, run.y);
    face.castShadow = true;
    face.receiveShadow = true;
    parent.add(board, face);
    if (step % 2 === 0 && width > 0.28 && top + 0.2 < roomTop) {
      const balusterHeight = Math.max(0.16, Math.min(0.86, roomTop - top - 0.02));
      [-1, 1].forEach((side) => {
        const px = cx + nx * side * (width / 2 - 0.04);
        const pz = cz + ny * side * (width / 2 - 0.04);
        const baluster = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, balusterHeight, 12), rail);
        baluster.position.set(px, top + balusterHeight / 2, pz);
        parent.add(baluster);
      });
    }
  }
  if (width > 0.28) {
    [-1, 1].forEach((side) => {
      const ox = nx * side * (width / 2 - 0.03);
      const oz = ny * side * (width / 2 - 0.03);
      bar(
        parent,
        new THREE.Vector3(from.x + ox, Math.min(base + y0 + 0.9, roomTop), from.y + oz),
        new THREE.Vector3(to.x + ox, Math.min(base + y1 + 0.9, roomTop), to.y + oz),
        0.026,
        rail,
        16,
      );
    });
  }
  newel(parent, from.x, base + y0, from.y, rail, roomTop);
  newel(parent, to.x, base + y1, to.y, rail, roomTop);
};

export const buildSwitchback = (parent: THREE.Object3D, points: StairPoint[], base: number) => {
  const layout = stairLayout(points);
  if (!layout) return;
  const tread = wood(0xb78a5e, 0.42);
  const riserMat = wood(0xeee8df, 0.72);
  const rail = wood(0x3f332b, 0.24, 0.68);
  const landingMat = wood(0xc79b6d, 0.46);
  landingMat.side = THREE.DoubleSide;
  const mid = FLOOR_STEP / 2;
  addFlight(parent, layout.a, layout.b, 0, mid, base, layout.width, tread, riserMat, rail);
  addFlight(parent, layout.c, layout.d, mid, WALL_HEIGHT, base, layout.width, tread, riserMat, rail);
  const shape = new THREE.Shape();
  layout.landing.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  const slab = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false }), landingMat);
  slab.rotation.x = Math.PI / 2;
  slab.position.y = base + mid;
  parent.add(slab);
  for (let index = 0; index < layout.landing.length; index++) {
    const from = layout.landing[index];
    const to = layout.landing[(index + 1) % layout.landing.length];
    bar(
      parent,
      new THREE.Vector3(from.x, base + mid + 0.92, from.y),
      new THREE.Vector3(to.x, base + mid + 0.92, to.y),
      0.026,
      rail,
      14,
    );
  }
};
