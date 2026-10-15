import * as THREE from "three";
import { hashString, pointInPoly } from "./geometry";
import type { GroundPoly, PlacedInstance, WorldPoint } from "./types";

export type AmenityChannel = "solid" | "glass" | "water";

export interface AmenityModel {
  parts: Record<AmenityChannel, THREE.BufferGeometry[]>;
  top: number;
}

/** سطح القطعة. كل النماذج تبدأ من هنا. */
const G = 0.12;

const C = {
  wall: 0xf3efe7,
  wallWarm: 0xeee6d7,
  stone: 0xe0d6c4,
  stoneDark: 0xcbbfa9,
  trim: 0xfbfaf6,
  plinth: 0xc9c1b2,
  paving: 0xe6e0d3,
  pavingDark: 0xd3cbbb,
  gravel: 0xe4dccb,
  asphalt: 0x8f8e8a,
  line: 0xf6f4ee,
  glass: 0x8aa1ac,
  glassDark: 0x5f7581,
  metal: 0xb5b9bc,
  steel: 0x7b8085,
  dark: 0x4d4944,
  wood: 0x9c7b5c,
  sand: 0xe6d6b4,
  leaf: 0x93a97f,
  leafDark: 0x7f956c,
  hedge: 0x8ea47b,
  trunk: 0x8a7560,
  water: 0x8fc0c9,
  tile: 0xc9dfe2,
  gold: 0xc8a759,
  red: 0xb5574b,
  dome: 0x8fb0a7,
};

const SIGNS = [0xb5574b, 0x5f8a7a, 0xc0904a, 0x6d7f9c, 0x8d7398, 0x7d9a6a];
const CARS = [0xf1f1ef, 0xbabdc1, 0x5a5e63, 0x8a9aa8, 0xa8584f, 0xd8d2c4, 0x3f4549];
const UMBRELLAS = [0xf3efe7, 0x5f8a7a, 0xc0904a, 0xb5574b];
const FLOWERS = [0xd98a8a, 0xe8c46a, 0xf2efe6, 0xb88fc4, 0xe0a070];

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const random = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

type Vec3 = [number, number, number];
type P = WorldPoint;

/* ---------- هندسة المضلع ---------- */

const signedArea = (ring: P[]) => {
  let sum = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    sum += a.x * b.z - b.x * a.z;
  }
  return sum / 2;
};

const centerOf = (ring: P[]): P => {
  const area = signedArea(ring);
  if (Math.abs(area) < 1e-6) {
    let x = 0;
    let z = 0;
    ring.forEach((point) => {
      x += point.x;
      z += point.z;
    });
    return { x: x / (ring.length || 1), z: z / (ring.length || 1) };
  }
  let cx = 0;
  let cz = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const cross = a.x * b.z - b.x * a.z;
    cx += (a.x + b.x) * cross;
    cz += (a.z + b.z) * cross;
  }
  return { x: cx / (6 * area), z: cz / (6 * area) };
};

const distanceToSegment = (x: number, z: number, a: P, b: P) => {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const lengthSq = dx * dx + dz * dz || 1;
  const t = clamp(((x - a.x) * dx + (z - a.z) * dz) / lengthSq, 0, 1);
  return Math.hypot(x - (a.x + dx * t), z - (a.z + dz * t));
};

const distanceToLine = (x: number, z: number, line: P[]) => {
  let best = Infinity;
  for (let index = 1; index < line.length; index++) best = Math.min(best, distanceToSegment(x, z, line[index - 1], line[index]));
  return best;
};

const distanceToRing = (x: number, z: number, ring: P[]) => {
  let best = Infinity;
  for (let index = 0; index < ring.length; index++) best = Math.min(best, distanceToSegment(x, z, ring[index], ring[(index + 1) % ring.length]));
  return best;
};

const insideBy = (ring: P[], x: number, z: number, margin = 0) =>
  pointInPoly(x, z, ring) && (margin <= 0 || distanceToRing(x, z, ring) >= margin);

const scaleRing = (ring: P[], k: number, about = centerOf(ring)) =>
  ring.map((point) => ({ x: about.x + (point.x - about.x) * k, z: about.z + (point.z - about.z) * k }));

/** إزاحة حقيقية لكل ضلع (موجبة للخارج). الزوايا الحادة محدودة حتى لا تنفجر. */
const offsetRing = (ring: P[], d: number): P[] | null => {
  const n = ring.length;
  if (n < 3) return null;
  const sign = signedArea(ring) > 0 ? 1 : -1;
  const out: P[] = [];
  for (let index = 0; index < n; index++) {
    const prev = ring[(index - 1 + n) % n];
    const cur = ring[index];
    const next = ring[(index + 1) % n];
    const l1 = Math.hypot(cur.x - prev.x, cur.z - prev.z) || 1;
    const l2 = Math.hypot(next.x - cur.x, next.z - cur.z) || 1;
    const e1 = { x: (cur.x - prev.x) / l1, z: (cur.z - prev.z) / l1 };
    const e2 = { x: (next.x - cur.x) / l2, z: (next.z - cur.z) / l2 };
    const n1 = sign > 0 ? { x: e1.z, z: -e1.x } : { x: -e1.z, z: e1.x };
    const n2 = sign > 0 ? { x: e2.z, z: -e2.x } : { x: -e2.z, z: e2.x };
    let bx = n1.x + n2.x;
    let bz = n1.z + n2.z;
    const length = Math.hypot(bx, bz);
    if (length < 1e-6) {
      bx = n1.x;
      bz = n1.z;
    } else {
      bx /= length;
      bz /= length;
    }
    const cos = bx * n1.x + bz * n1.z;
    const scale = 1 / Math.max(cos, 0.45);
    out.push({ x: cur.x + bx * d * scale, z: cur.z + bz * d * scale });
  }
  const before = signedArea(ring);
  const after = signedArea(out);
  if (Math.sign(before) !== Math.sign(after) || Math.abs(after) < Math.abs(before) * 0.04) return null;
  return out;
};

/** مضلع داخلي بمسافة ثابتة، وإن لم يتسع يُصغَّر نحو المركز. */
const inset = (ring: P[], d: number) => offsetRing(ring, -d) || scaleRing(ring, 0.6);

const clipHalf = (ring: P[], axis: "x" | "z", value: number, keepLess: boolean): P[] => {
  const out: P[] = [];
  const inside = (point: P) => (keepLess ? point[axis] <= value : point[axis] >= value);
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const ia = inside(a);
    const ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) {
      const t = (value - a[axis]) / (b[axis] - a[axis] || 1e-9);
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return out;
};

const boundsLocal = (ring: P[]) => {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  ring.forEach((point) => {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  });
  return { minX, maxX, minZ, maxZ };
};

const inradius = (ring: P[]) => {
  const center = centerOf(ring);
  return pointInPoly(center.x, center.z, ring) ? distanceToRing(center.x, center.z, ring) : 1;
};

/** قرابة المضلع من مستطيل محيط به. 1 يعني مستطيلاً تاماً. */
const rectness = (ring: P[]) => {
  const box = boundsLocal(ring);
  const area = (box.maxX - box.minX) * (box.maxZ - box.minZ);
  return area > 0 ? Math.abs(signedArea(ring)) / area : 0;
};

/** نقاط على محيط المضلع كل step متر، مع الاتجاه الخارجي. */
const alongRing = (ring: P[], step: number, start = step / 2) => {
  const sign = signedArea(ring) > 0 ? 1 : -1;
  const spots: { x: number; z: number; nx: number; nz: number }[] = [];
  let next = start;
  let travelled = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.01) continue;
    const ex = (b.x - a.x) / length;
    const ez = (b.z - a.z) / length;
    const nx = sign > 0 ? ez : -ez;
    const nz = sign > 0 ? -ex : ex;
    while (next <= travelled + length) {
      const t = next - travelled;
      spots.push({ x: a.x + ex * t, z: a.z + ez * t, nx, nz });
      next += step;
    }
    travelled += length;
  }
  return spots;
};

/* ---------- عدّة البناء ---------- */

class Kit {
  parts: Record<AmenityChannel, THREE.BufferGeometry[]> = { solid: [], glass: [], water: [] };
  top = 0;

  constructor(private frame: THREE.Matrix4) {}

  add(source: THREE.BufferGeometry, color: number, channel: AmenityChannel = "solid") {
    const geometry = source.index ? source.toNonIndexed() : source;
    if (geometry !== source) source.dispose();
    if (geometry.attributes.uv) geometry.deleteAttribute("uv");
    if (!geometry.attributes.normal) geometry.computeVertexNormals();
    geometry.applyMatrix4(this.frame);
    const position = geometry.attributes.position;
    const normal = geometry.attributes.normal;
    const rgb = new THREE.Color(color);
    const values = new Float32Array(position.count * 3);
    for (let index = 0; index < position.count; index++) {
      const y = position.getY(index);
      this.top = Math.max(this.top, y);
      const side = Math.abs(normal.getY(index)) < 0.5;
      const shade = side && y < 1 ? 0.8 + 0.2 * Math.max(y, 0) : 1;
      values[index * 3] = rgb.r * shade;
      values[index * 3 + 1] = rgb.g * shade;
      values[index * 3 + 2] = rgb.b * shade;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
    this.parts[channel].push(geometry);
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, color: number, channel: AmenityChannel = "solid", yaw = 0) {
    const geometry = new THREE.BoxGeometry(Math.max(w, 0.02), Math.max(h, 0.02), Math.max(d, 0.02));
    if (yaw) geometry.rotateY(yaw);
    geometry.translate(x, y + h / 2, z);
    this.add(geometry, color, channel);
  }

  cyl(x: number, y: number, z: number, rTop: number, rBottom: number, h: number, color: number, seg = 12, channel: AmenityChannel = "solid", open = false) {
    const geometry = new THREE.CylinderGeometry(rTop, rBottom, Math.max(h, 0.02), seg, 1, open);
    geometry.translate(x, y + h / 2, z);
    this.add(geometry, color, channel);
  }

  sphere(x: number, y: number, z: number, r: number, color: number, seg = 10, squash = 1, channel: AmenityChannel = "solid") {
    const geometry = new THREE.SphereGeometry(r, seg, Math.max(4, Math.round(seg * 0.6)));
    geometry.scale(1, squash, 1);
    geometry.translate(x, y, z);
    this.add(geometry, color, channel);
  }

  lathe(profile: [number, number][], x: number, y: number, z: number, color: number, seg = 16, channel: AmenityChannel = "solid") {
    const geometry = new THREE.LatheGeometry(profile.map(([r, h]) => new THREE.Vector2(Math.max(r, 0.001), h)), seg);
    geometry.translate(x, y, z);
    this.add(geometry, color, channel);
  }

  ring(x: number, y: number, z: number, rIn: number, rOut: number, h: number, color: number, seg = 24, channel: AmenityChannel = "solid") {
    this.lathe([[rIn, 0], [rOut, 0], [rOut, h], [rIn, h], [rIn, 0]], x, y, z, color, seg, channel);
  }

  /** مقطع (u للأمام، v للأعلى) يُمدّ على طول المحور x المحلي، ثم يدور yaw. */
  prism(profile: [number, number][], length: number, x: number, y: number, z: number, color: number, yaw = 0, channel: AmenityChannel = "solid") {
    const shape = new THREE.Shape(profile.map(([u, v]) => new THREE.Vector2(-u, v)));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(length, 0.02), bevelEnabled: false, steps: 1, curveSegments: 6 });
    geometry.translate(0, 0, -length / 2);
    geometry.rotateY(Math.PI / 2 + yaw);
    geometry.translate(x, y, z);
    this.add(geometry, color, channel);
  }

  arch(x: number, y: number, z: number, r: number, t: number, color: number, yaw = 0, channel: AmenityChannel = "solid") {
    const shape = new THREE.Shape();
    shape.moveTo(r, 0);
    shape.absarc(0, 0, r, 0, Math.PI, false);
    shape.lineTo(r, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, steps: 1, curveSegments: 10 });
    geometry.translate(0, 0, -t / 2);
    if (yaw) geometry.rotateY(yaw);
    geometry.translate(x, y, z);
    this.add(geometry, color, channel);
  }

  rod(a: Vec3, b: Vec3, radius: number, color: number, channel: AmenityChannel = "solid", seg = 6) {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = dir.length();
    if (length < 0.01) return;
    const geometry = new THREE.CylinderGeometry(radius, radius, length, seg);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
    geometry.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    this.add(geometry, color, channel);
  }

  plank(a: Vec3, b: Vec3, width: number, thick: number, color: number, channel: AmenityChannel = "solid") {
    const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const length = dir.length();
    if (length < 0.01) return;
    dir.normalize();
    const geometry = new THREE.BoxGeometry(width, thick, length);
    const yaw = Math.hypot(dir.x, dir.z) > 1e-6 ? Math.atan2(dir.x, dir.z) : 0;
    geometry.rotateX(-Math.asin(clamp(dir.y, -1, 1)));
    geometry.rotateY(yaw);
    geometry.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
    this.add(geometry, color, channel);
  }

  /** بثق مضلع (بإحداثيات القطعة) مع ثقب اختياري. */
  slab(ring: P[], y: number, h: number, color: number, hole?: P[] | null, channel: AmenityChannel = "solid") {
    if (ring.length < 3) return;
    const shape = new THREE.Shape(ring.map((point) => new THREE.Vector2(point.x, -point.z)));
    if (hole && hole.length >= 3) shape.holes.push(new THREE.Path(hole.map((point) => new THREE.Vector2(point.x, -point.z))));
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: Math.max(h, 0.01), bevelEnabled: false, steps: 1, curveSegments: 1 });
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
    this.add(geometry, color, channel);
  }

  /** جدار على طول قطعة مستقيمة. */
  wallAlong(a: P, b: P, y: number, h: number, t: number, color: number) {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.05) return;
    this.box((a.x + b.x) / 2, y, (a.z + b.z) / 2, length, h, t, color, "solid", Math.atan2(-(b.z - a.z), b.x - a.x));
  }

  /** سقف جملوني متكيّف: سطوح مائلة من المحيط إلى مضلع داخلي، ثم غطاء. */
  hipRoof(ring: P[], y: number, rise: number, color: number, overhang = 0.4) {
    const outer = offsetRing(ring, overhang) || ring;
    const r = inradius(ring);
    const inner = offsetRing(outer, -(r + overhang) * 0.86) || scaleRing(outer, 0.08);
    const positions: number[] = [];
    const n = outer.length;
    const top = y + rise;
    for (let index = 0; index < n; index++) {
      const a = outer[index];
      const b = outer[(index + 1) % n];
      const c = inner[(index + 1) % n];
      const d = inner[index];
      positions.push(a.x, y, a.z, b.x, y, b.z, c.x, top, c.z);
      positions.push(a.x, y, a.z, c.x, top, c.z, d.x, top, d.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    this.add(geometry, color);
    this.slab(inner, top - 0.02, 0.04, color);
    this.slab(outer, y - 0.12, 0.12, C.trim, ring);
  }
}

/* ---------- واجهات ---------- */

type Face = { cx: number; cz: number; nx: number; nz: number; width: number; a: P; b: P };

const facesOfRing = (ring: P[], min = 1.2): Face[] => {
  const sign = signedArea(ring) > 0 ? 1 : -1;
  const faces: Face[] = [];
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < min) continue;
    const ex = (b.x - a.x) / length;
    const ez = (b.z - a.z) / length;
    faces.push({ cx: (a.x + b.x) / 2, cz: (a.z + b.z) / 2, nx: sign > 0 ? ez : -ez, nz: sign > 0 ? -ex : ex, width: length, a, b });
  }
  return faces;
};

/** الواجهة الأمامية: الأعرض بين المتجهة نحو الشارع (+z المحلي). */
const frontOf = (faces: Face[]) =>
  faces.reduce((best, face) => (face.nz * Math.min(face.width, 40) > best.nz * Math.min(best.width, 40) ? face : best), faces[0]);

const faceYaw = (face: { nx: number; nz: number }) => Math.atan2(face.nx, face.nz);

const onFace = (face: Face, along: number, out: number) => ({
  x: face.cx - face.nz * along + face.nx * out,
  z: face.cz + face.nx * along + face.nz * out,
});

type WindowStyle = {
  w: number;
  h: number;
  bay: number;
  frame?: number;
  glass?: number;
  sill?: boolean;
  arch?: boolean;
  shutters?: number;
  skip?: number;
};

const punched = (kit: Kit, face: Face, y0: number, floors: number, floorH: number, style: WindowStyle, fromFloor = 0) => {
  if (face.width < style.w + 1) return;
  const count = Math.max(1, Math.floor((face.width - 1.4) / style.bay));
  const yaw = faceYaw(face);
  const frame = style.frame ?? C.trim;
  const glass = style.glass ?? C.glass;
  for (let floor = fromFloor; floor < floors; floor++) {
    const wy = y0 + floor * floorH + Math.max((floorH - style.h) * 0.55, 0.3);
    for (let index = 0; index < count; index++) {
      const along = (index - (count - 1) / 2) * style.bay;
      if (style.skip && floor === 0 && Math.abs(along) < style.skip) continue;
      const base = onFace(face, along, 0.03);
      const pane = onFace(face, along, 0.07);
      kit.box(base.x, wy - 0.1, base.z, style.w + 0.24, style.h + 0.2, 0.1, frame, "solid", yaw);
      kit.box(pane.x, wy, pane.z, style.w, style.h, 0.06, glass, "glass", yaw);
      if (style.arch) {
        kit.arch(base.x, wy + style.h, base.z, style.w / 2 + 0.12, 0.1, frame, yaw);
        kit.arch(pane.x, wy + style.h, pane.z, style.w / 2, 0.06, glass, yaw, "glass");
      }
      if (style.sill) {
        const sill = onFace(face, along, 0.12);
        kit.box(sill.x, wy - 0.16, sill.z, style.w + 0.4, 0.08, 0.22, C.trim, "solid", yaw);
      }
      if (style.shutters != null) {
        const left = onFace(face, along - style.w / 2 - 0.22, 0.08);
        const right = onFace(face, along + style.w / 2 + 0.22, 0.08);
        kit.box(left.x, wy, left.z, 0.36, style.h, 0.06, style.shutters, "solid", yaw);
        kit.box(right.x, wy, right.z, 0.36, style.h, 0.06, style.shutters, "solid", yaw);
      }
    }
  }
};

const ribbon = (kit: Kit, face: Face, y0: number, floors: number, floorH: number, opts: { h: number; mullion?: number; glass?: number; skip?: number }) => {
  const yaw = faceYaw(face);
  const span = face.width - 1.6;
  if (span < 1) return;
  const glass = opts.glass ?? C.glass;
  const step = opts.mullion ?? 1.6;
  for (let floor = 0; floor < floors; floor++) {
    const wy = y0 + floor * floorH + (floorH - opts.h) * 0.5;
    const pieces = opts.skip && floor === 0 && span > opts.skip * 2 + 2
      ? [[-span / 2, -opts.skip], [opts.skip, span / 2]]
      : [[-span / 2, span / 2]];
    for (const [from, to] of pieces) {
      const width = to - from;
      if (width < 0.8) continue;
      const mid = onFace(face, (from + to) / 2, 0.05);
      kit.box(mid.x, wy, mid.z, width, opts.h, 0.08, glass, "glass", yaw);
      const sill = onFace(face, (from + to) / 2, 0.1);
      kit.box(sill.x, wy - 0.12, sill.z, width + 0.2, 0.12, 0.16, C.trim, "solid", yaw);
      kit.box(sill.x, wy + opts.h, sill.z, width + 0.2, 0.1, 0.16, C.trim, "solid", yaw);
      const count = Math.floor(width / step);
      for (let index = 1; index < count; index++) {
        const post = onFace(face, from + (index * width) / count, 0.1);
        kit.box(post.x, wy, post.z, 0.1, opts.h, 0.1, C.trim, "solid", yaw);
      }
    }
  }
};

const entrance = (kit: Kit, face: Face, along: number, width: number, height: number, canopy: number, accent = C.trim, y = G) => {
  const yaw = faceYaw(face);
  const door = onFace(face, along, 0.08);
  kit.box(door.x, y, door.z, width + 0.4, height + 0.3, 0.12, C.trim, "solid", yaw);
  const glass = onFace(face, along, 0.14);
  kit.box(glass.x, y, glass.z, width, height, 0.06, C.glassDark, "glass", yaw);
  const mullion = onFace(face, along, 0.18);
  kit.box(mullion.x, y, mullion.z, 0.08, height, 0.06, C.trim, "solid", yaw);
  if (canopy > 0) {
    const slab = onFace(face, along, canopy / 2);
    kit.box(slab.x, y + height + 0.5, slab.z, width + 2.4, 0.28, canopy, accent, "solid", yaw);
    [-1, 1].forEach((side) => {
      const post = onFace(face, along + side * (width / 2 + 0.9), canopy - 0.3);
      kit.cyl(post.x, y, post.z, 0.13, 0.13, height + 0.5, C.trim, 10);
    });
    kit.box(slab.x, G, slab.z, width + 2.6, 0.14, canopy + 0.4, C.pavingDark, "solid", yaw);
  }
};

type MassOpts = {
  floors: number;
  floorH: number;
  wall?: number;
  band?: number;
  cornice?: number;
  parapet?: number;
  roofUnits?: boolean;
  y?: number;
  /** حدود القطعة، حتى تُختار واجهة تطل على أرض داخلها. */
  lot?: P[];
};

type Mass = { ring: P[]; top: number; faces: Face[]; front: Face };

/** كتلة مبنى على شكل المضلع: قاعدة، أحزمة طوابق، كورنيش، ستارة سطح، ومكيفات. */
const mass = (kit: Kit, ring: P[], opts: MassOpts): Mass => {
  const y = opts.y ?? G;
  const wall = opts.wall ?? C.wall;
  const height = opts.floors * opts.floorH;
  const grow = (d: number) => offsetRing(ring, d) || ring;
  kit.slab(grow(0.18), y, 0.42, C.plinth);
  kit.slab(ring, y, height, wall);
  for (let floor = 1; floor < opts.floors; floor++) kit.slab(grow(0.07), y + floor * opts.floorH - 0.12, 0.24, opts.band ?? C.trim);
  const top = y + height;
  kit.slab(grow(0.17), top, 0.26, opts.cornice ?? C.trim);
  const ph = opts.parapet ?? 0.75;
  if (ph > 0) {
    kit.slab(grow(0.17), top + 0.26, ph, wall, offsetRing(ring, -0.11));
    kit.slab(grow(0.21), top + 0.26 + ph, 0.1, C.trim, offsetRing(ring, -0.15));
  }
  const center = centerOf(ring);
  if (opts.roofUnits !== false && inradius(ring) > 3.5) {
    [[-3, -1.5], [0, -1.5], [3, -1.5], [-3, 1.8]].forEach(([dx, dz], index) => {
      const ux = center.x + dx;
      const uz = center.z + dz;
      if (!insideBy(ring, ux, uz, 1.4)) return;
      if (index < 3) {
        kit.box(ux, top + 0.26, uz, 1.6, 1.0, 1.1, C.metal);
        kit.box(ux, top + 1.26, uz, 1.0, 0.06, 0.7, C.steel);
      } else {
        kit.box(ux, top + 0.26, uz, 2.6, 2.2, 2.4, wall);
        kit.box(ux, top + 2.46, uz, 2.9, 0.14, 2.7, C.trim);
      }
    });
  }
  const faces = facesOfRing(ring);
  const lot = opts.lot;
  const open = lot ? faces.filter((face) => [-0.3, 0, 0.3].every((k) => {
    const ahead = onFace(face, face.width * k, 3);
    return insideBy(lot, ahead.x, ahead.z, 0.3);
  })) : [];
  return { ring, top, faces, front: frontOf(open.length > 0 ? open : faces) };
};

/** يقص المضلع بمستطيل محلي ثم يبعده عن الحدود. */
const region = (ring: P[], cut: { minX?: number; maxX?: number; minZ?: number; maxZ?: number }, margin: number) => {
  let out = ring;
  if (cut.maxZ != null) out = clipHalf(out, "z", cut.maxZ, true);
  if (cut.minZ != null) out = clipHalf(out, "z", cut.minZ, false);
  if (cut.maxX != null) out = clipHalf(out, "x", cut.maxX, true);
  if (cut.minX != null) out = clipHalf(out, "x", cut.minX, false);
  if (out.length < 3) out = ring;
  return margin > 0 ? inset(out, margin) : out;
};

/* ---------- عناصر صغيرة ---------- */

const tree = (kit: Kit, x: number, z: number, size = 1, rand?: () => number) => {
  const s = size * (rand ? 0.85 + rand() * 0.3 : 1);
  kit.cyl(x, G, z, 0.14 * s, 0.22 * s, 2.3 * s, C.trunk, 7);
  const leaf = rand && rand() > 0.5 ? C.leafDark : C.leaf;
  kit.sphere(x, G + 3.1 * s, z, 1.55 * s, leaf, 9, 0.9);
  kit.sphere(x + 0.5 * s, G + 3.9 * s, z - 0.3 * s, 1.05 * s, leaf, 8, 0.9);
};

const palm = (kit: Kit, x: number, z: number, size = 1) => {
  kit.cyl(x, G, z, 0.16 * size, 0.24 * size, 6.2 * size, C.trunk, 7);
  for (let index = 0; index < 7; index++) {
    const angle = (index / 7) * Math.PI * 2;
    kit.plank(
      [x, G + 6.2 * size, z],
      [x + Math.sin(angle) * 2.4 * size, G + 5.1 * size, z + Math.cos(angle) * 2.4 * size],
      0.55 * size,
      0.06,
      C.leafDark,
    );
  }
};

const shrub = (kit: Kit, x: number, z: number, r = 0.7, y = G) => kit.sphere(x, y + r * 0.55, z, r, C.hedge, 8, 0.75);

const planter = (kit: Kit, x: number, z: number, w = 1.2) => {
  kit.box(x, G, z, w, 0.55, w, C.stoneDark);
  shrub(kit, x, z + 0.05, w * 0.45, G + 0.1);
  kit.box(x, G + 0.55, z, w + 0.08, 0.06, w + 0.08, C.trim);
};

const lamp = (kit: Kit, x: number, z: number, h = 5.5, yaw = 0, y = G) => {
  kit.cyl(x, y, z, 0.16, 0.2, 0.4, C.steel, 8);
  kit.cyl(x, y, z, 0.06, 0.08, h, C.steel, 6);
  const ax = x + Math.sin(yaw) * 0.7;
  const az = z + Math.cos(yaw) * 0.7;
  kit.rod([x, y + h - 0.1, z], [ax, y + h + 0.05, az], 0.04, C.steel);
  kit.box(ax, y + h - 0.12, az, 0.45, 0.16, 0.3, C.trim, "solid", yaw);
};

const lantern = (kit: Kit, x: number, z: number, h = 3.6, y = G) => {
  kit.cyl(x, y, z, 0.1, 0.14, 0.3, C.dark, 8);
  kit.cyl(x, y, z, 0.05, 0.06, h, C.dark, 6);
  kit.cyl(x, y + h, z, 0.2, 0.14, 0.4, C.trim, 8);
  kit.cyl(x, y + h + 0.4, z, 0.02, 0.24, 0.16, C.dark, 8);
};

const bench = (kit: Kit, x: number, z: number, yaw = 0, y = G) => {
  const off = (lx: number, lz: number) => ({ x: x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z: z - lx * Math.sin(yaw) + lz * Math.cos(yaw) });
  kit.box(x, y + 0.42, z, 1.8, 0.08, 0.5, C.wood, "solid", yaw);
  const back = off(0, -0.24);
  kit.box(back.x, y + 0.55, back.z, 1.8, 0.4, 0.07, C.wood, "solid", yaw);
  [-0.75, 0.75].forEach((lx) => {
    const leg = off(lx, 0);
    kit.box(leg.x, y, leg.z, 0.08, 0.42, 0.46, C.steel, "solid", yaw);
  });
};

const car = (kit: Kit, x: number, z: number, yaw: number, color: number) => {
  const off = (lx: number, lz: number) => ({ x: x + lx * Math.cos(yaw) + lz * Math.sin(yaw), z: z - lx * Math.sin(yaw) + lz * Math.cos(yaw) });
  kit.box(x, G + 0.3, z, 1.8, 0.62, 4.3, color, "solid", yaw);
  const cabin = off(0, -0.2);
  kit.box(cabin.x, G + 0.92, cabin.z, 1.58, 0.56, 2.2, C.glassDark, "glass", yaw);
  kit.box(cabin.x, G + 1.48, cabin.z, 1.5, 0.08, 1.9, color, "solid", yaw);
  [[-0.84, 1.35], [0.84, 1.35], [-0.84, -1.35], [0.84, -1.35]].forEach(([lx, lz]) => {
    const wheel = off(lx, lz);
    kit.box(wheel.x, G, wheel.z, 0.24, 0.6, 0.62, C.dark, "solid", yaw);
  });
  const lights = off(0, 2.16);
  kit.box(lights.x, G + 0.58, lights.z, 1.5, 0.12, 0.04, C.trim, "solid", yaw);
};

const flagpole = (kit: Kit, x: number, z: number, h = 9) => {
  kit.box(x, G, z, 1.1, 0.35, 1.1, C.stone);
  kit.cyl(x, G + 0.35, z, 0.05, 0.08, h, C.metal, 8);
  kit.sphere(x, G + 0.35 + h, z, 0.12, C.gold, 8);
  [C.red, C.trim, C.dark].forEach((color, index) => kit.box(x + 1.1, G + h - 0.3 - (index + 1) * 0.42, z, 2.1, 0.42, 0.04, color));
};

const barrier = (kit: Kit, x: number, z: number, length: number, dirX: number, dirZ: number) => {
  kit.box(x, G, z, 0.45, 1.1, 0.45, C.dark);
  const pieces = 6;
  const yaw = Math.atan2(-dirZ, dirX);
  for (let index = 0; index < pieces; index++) {
    const t = (index + 0.5) * (length / pieces);
    kit.box(x + dirX * t, G + 0.95, z + dirZ * t, length / pieces, 0.12, 0.12, index % 2 ? C.trim : C.red, "solid", yaw);
  }
};

type Ctx = {
  kit: Kit;
  /** حدود القطعة بإحداثياتها المحلية: x على العرض، و+z نحو الشارع. */
  ring: P[];
  faces: Face[];
  front: Face;
  center: P;
  r: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  L: number;
  D: number;
  rand: () => number;
  inside: (x: number, z: number, margin?: number) => boolean;
};

/** نقطة داخل القطعة قريبة من المطلوب، تقترب من المركز إن خرجت. */
const fit = (ctx: Ctx, x: number, z: number, margin: number): P | null => {
  for (let step = 0; step <= 10; step++) {
    const k = 1 - step / 10;
    const px = ctx.center.x + (x - ctx.center.x) * k;
    const pz = ctx.center.z + (z - ctx.center.z) * k;
    if (ctx.inside(px, pz, margin)) return { x: px, z: pz };
  }
  return null;
};

/** المسافة الحرة أمام واجهة حتى حد القطعة. */
const roomAhead = (ctx: Ctx, face: Face, start = 0.6) => {
  let distance = start;
  while (distance < 60) {
    const point = onFace(face, 0, distance + 0.5);
    if (!ctx.inside(point.x, point.z, 0.6)) break;
    distance += 0.5;
  }
  return distance;
};

/** سور على حدود القطعة الفعلية، مع فتحة مدخل في الواجهة الأمامية. */
const perimeter = (ctx: Ctx, opts: { h: number; gap: number; color?: number; rail?: boolean; posts?: number; inset?: number }) => {
  const { kit } = ctx;
  const ring = inset(ctx.ring, opts.inset ?? 0.3);
  const faces = facesOfRing(ring, 0.3);
  const front = frontOf(faces);
  const color = opts.color ?? C.stone;
  const piece = (a: P, b: P) => {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.3) return;
    kit.wallAlong(a, b, G, opts.h, 0.3, color);
    kit.wallAlong(a, b, G + opts.h, 0.1, 0.42, C.trim);
    if (opts.rail) {
      const step = opts.posts ?? 2.4;
      const count = Math.max(1, Math.round(length / step));
      for (let index = 0; index <= count; index++) {
        const k = index / count;
        kit.box(a.x + (b.x - a.x) * k, G + opts.h, a.z + (b.z - a.z) * k, 0.12, 1.1, 0.12, C.steel);
      }
      kit.rod([a.x, G + opts.h + 1.06, a.z], [b.x, G + opts.h + 1.06, b.z], 0.04, C.steel);
      kit.rod([a.x, G + opts.h + 0.55, a.z], [b.x, G + opts.h + 0.55, b.z], 0.03, C.steel);
    }
  };
  faces.forEach((face) => {
    if (face !== front || opts.gap <= 0) {
      piece(face.a, face.b);
      return;
    }
    const gap = Math.min(opts.gap, face.width * 0.6) / 2;
    const left = onFace(face, -gap, 0);
    const right = onFace(face, gap, 0);
    const dirA = Math.hypot(face.a.x - left.x, face.a.z - left.z) < Math.hypot(face.a.x - right.x, face.a.z - right.z);
    piece(face.a, dirA ? left : right);
    piece(dirA ? right : left, face.b);
    [left, right].forEach((post) => {
      kit.box(post.x, G, post.z, 0.7, opts.h + 0.9, 0.7, C.stoneDark, "solid", faceYaw(face));
      kit.box(post.x, G + opts.h + 0.9, post.z, 0.86, 0.14, 0.86, C.trim, "solid", faceYaw(face));
    });
  });
  return front;
};

/** صفوف مواقف داخل القطعة فقط. */
const stallRow = (ctx: Ctx, x0: number, x1: number, z: number, depth: number, facing: 1 | -1, fill = 0.65) => {
  const { kit, rand } = ctx;
  const width = 2.6;
  const count = Math.floor((x1 - x0) / width);
  const placed: number[] = [];
  if (count < 1) return placed;
  const start = (x0 + x1) / 2 - (count * width) / 2;
  for (let index = 0; index < count; index++) {
    const sx = start + (index + 0.5) * width;
    const ok = [[-1.3, -depth / 2], [1.3, -depth / 2], [-1.3, depth / 2], [1.3, depth / 2]].every(([dx, dz]) => ctx.inside(sx + dx, z + dz, 0.2));
    if (!ok) continue;
    placed.push(sx);
    kit.box(sx - 1.3, G + 0.01, z, 0.12, 0.02, depth, C.line);
    kit.box(sx + 1.3, G + 0.01, z, 0.12, 0.02, depth, C.line);
    if (rand() <= fill) car(kit, sx, z + facing * 0.25, facing > 0 ? 0 : Math.PI, CARS[Math.floor(rand() * CARS.length)]);
  }
  return placed;
};

/** مواقف تملأ شريطاً من القطعة بين z0 و z1. */
const parkingField = (ctx: Ctx, z0: number, z1: number, fill: number) => {
  const depth = 5.2;
  let z = z0;
  let facing: 1 | -1 = -1;
  while (z + depth <= z1) {
    stallRow(ctx, ctx.minX + 1, ctx.maxX - 1, z + depth / 2, depth, facing, fill);
    z += depth + (facing === -1 ? 0 : 6.5);
    facing = facing === -1 ? 1 : -1;
  }
};

const edgeTrees = (ctx: Ctx, step: number, size: number, avoid: P[][] = [], margin = 1.8) => {
  const ring = inset(ctx.ring, margin);
  alongRing(ring, step).forEach((spot) => {
    if (avoid.some((shape) => insideBy(shape, spot.x, spot.z) || distanceToRing(spot.x, spot.z, shape) < 2.2)) return;
    tree(ctx.kit, spot.x, spot.z, size, ctx.rand);
  });
};

/* ---------- المرافق ---------- */

const mosque = (ctx: Ctx) => {
  const { kit, ring, r, rand } = ctx;
  kit.slab(ring, 0, G, C.paving);
  const s = Math.min(ctx.L, ctx.D);
  perimeter(ctx, { h: 1.2, gap: clamp(ctx.front.width * 0.22, 4, 9), color: C.wallWarm });
  const hallRing = region(ring, { maxZ: ctx.minZ + ctx.D * 0.66 }, clamp(r * 0.12, 1.4, 4.5));
  const hallH = clamp(s * 0.16, 5.2, 8.5);
  const wall = 0xf2ebdd;
  const band = 0xd9c8a4;
  const hall = mass(kit, hallRing, { lot: ring, floors: 1, floorH: hallH, wall, band, cornice: C.trim, parapet: 0, roofUnits: false });
  kit.slab(offsetRing(hallRing, 0.08) || hallRing, G + hallH - 1.2, 0.36, band);
  hall.faces.forEach((face) => {
    punched(kit, face, G + 0.5, 1, hallH - 1.6, { w: 1.1, h: 2.3, bay: 3.2, arch: true, frame: band, skip: face === hall.front ? clamp(face.width * 0.2, 2.5, 6) : 0 });
  });
  alongRing(offsetRing(hallRing, 0.1) || hallRing, 1.25, 0.6).forEach((spot) => {
    kit.box(spot.x, G + hallH + 0.26, spot.z, 0.5, 0.62, 0.5, C.trim, "solid", faceYaw(spot));
  });
  const hc = centerOf(hallRing);
  const R = clamp(inradius(hallRing) * 0.62, 2.4, 11);
  const drumY = G + hallH + 0.26;
  kit.cyl(hc.x, drumY, hc.z, R * 0.95, R * 0.98, R * 0.42, wall, 28);
  kit.cyl(hc.x, drumY + R * 0.42, hc.z, R * 1.02, R * 1.02, 0.22, band, 28);
  for (let index = 0; index < 12; index++) {
    const angle = (index / 12) * Math.PI * 2;
    kit.box(hc.x + Math.sin(angle) * (R * 0.95 + 0.02), drumY + R * 0.1, hc.z + Math.cos(angle) * (R * 0.95 + 0.02), 0.42, R * 0.22, 0.08, C.glass, "glass", angle);
  }
  const dome: [number, number][] = [];
  for (let index = 0; index <= 14; index++) {
    const t = index / 14;
    const angle = (t * Math.PI) / 2;
    dome.push([R * Math.cos(angle) * (1 + 0.06 * Math.sin(angle * 2)), R * 1.08 * Math.sin(angle) + R * 0.16 * t * t * t]);
  }
  const domeY = drumY + R * 0.42 + 0.22;
  kit.lathe(dome, hc.x, domeY, hc.z, C.dome, 28);
  const tip = domeY + R * 1.24;
  kit.cyl(hc.x, tip - 0.1, hc.z, 0.05, 0.1, 1.4, C.gold, 8);
  kit.sphere(hc.x, tip + 0.5, hc.z, 0.22, C.gold, 8);
  const crescent = new THREE.TorusGeometry(0.42, 0.07, 6, 14, Math.PI * 1.35);
  crescent.rotateZ(Math.PI * 0.82);
  crescent.translate(hc.x, tip + 1.6, hc.z);
  kit.add(crescent, C.gold);
  if (hallRing.length <= 8) {
    hallRing.forEach((corner) => {
      const toward = Math.hypot(hc.x - corner.x, hc.z - corner.z) || 1;
      const cx = corner.x + ((hc.x - corner.x) / toward) * 1.6;
      const cz = corner.z + ((hc.z - corner.z) / toward) * 1.6;
      if (!insideBy(hallRing, cx, cz, 0.9) || Math.hypot(cx - hc.x, cz - hc.z) < R + 1.2) return;
      kit.cyl(cx, G + hallH + 0.26, cz, 0.85, 0.85, 0.7, wall, 14);
      kit.lathe([[0.95, 0], [0.9, 0.35], [0.65, 0.75], [0.3, 1.0], [0.01, 1.12]], cx, G + hallH + 0.96, cz, C.dome, 14);
    });
  }
  const pf = hall.front;
  const portalW = clamp(pf.width * 0.3, 4, 10);
  const portalH = hallH + clamp(s * 0.05, 1.6, 3.2);
  const yaw = faceYaw(pf);
  const portal = onFace(pf, 0, 0.7);
  kit.box(portal.x, G, portal.z, portalW, portalH, 1.6, wall, "solid", yaw);
  kit.box(portal.x, G + portalH, portal.z, portalW + 0.3, 0.26, 1.9, C.trim, "solid", yaw);
  const face = onFace(pf, 0, 1.52);
  kit.box(face.x, G + portalH - 1.0, face.z, portalW + 0.02, 0.3, 0.04, band, "solid", yaw);
  const archR = portalW * 0.32;
  const archBottom = G + portalH - 1.4 - archR;
  kit.box(face.x, G, face.z, archR * 2 + 0.4, archBottom - G, 0.06, band, "solid", yaw);
  kit.arch(face.x, archBottom, face.z, archR + 0.2, 0.06, band, yaw);
  const door = onFace(pf, 0, 1.56);
  kit.box(door.x, G, door.z, archR * 2, archBottom - G, 0.06, C.wood, "solid", yaw);
  kit.arch(door.x, archBottom, door.z, archR, 0.06, C.glassDark, yaw, "glass");
  for (let index = 0; index <= Math.floor(portalW / 1.2); index++) {
    const crenel = onFace(pf, -portalW / 2 + index * 1.2 + 0.25, 0.7);
    kit.box(crenel.x, G + portalH + 0.26, crenel.z, 0.5, 0.6, 0.5, C.trim, "solid", yaw);
  }
  const mh = clamp(s * 0.55, 16, 32);
  const minaret = (mx: number, mz: number) => {
    kit.box(mx, G, mz, 2.8, 3.2, 2.8, C.stoneDark, "solid", yaw);
    kit.box(mx, G + 3.2, mz, 3.0, 0.25, 3.0, C.trim, "solid", yaw);
    kit.cyl(mx, G + 3.45, mz, 0.95, 1.1, mh * 0.66 - 3.45, wall, 8);
    for (let y = G + 6; y < G + mh * 0.62; y += 3.4) kit.cyl(mx, y, mz, 1.08, 1.08, 0.16, band, 8);
    const balcony = G + mh * 0.66;
    kit.lathe([[0.95, 0], [1.75, 0.45], [1.75, 0.62], [0.95, 0.62]], mx, balcony - 0.62, mz, C.trim, 12);
    kit.ring(mx, balcony, mz, 1.6, 1.75, 0.75, C.trim, 12);
    kit.cyl(mx, balcony, mz, 0.72, 0.8, mh * 0.22, wall, 8);
    const upper = balcony + mh * 0.22;
    kit.ring(mx, upper, mz, 1.0, 1.12, 0.5, C.trim, 10);
    kit.cyl(mx, upper, mz, 0.72, 0.72, 0.3, C.trim, 10);
    kit.cyl(mx, upper + 0.3, mz, 0.62, 0.62, 1.5, C.glass, 8, "glass");
    kit.cyl(mx, upper + 1.8, mz, 0.01, 0.85, 2.6, C.dome, 10);
    kit.cyl(mx, upper + 4.2, mz, 0.03, 0.05, 1.1, C.gold, 6);
    kit.sphere(mx, upper + 5.3, mz, 0.16, C.gold, 8);
  };
  const spots = [onFace(pf, pf.width / 2 + 1.0, 1.6), onFace(pf, pf.width / 2 - 1.4, 1.4), onFace(pf, -pf.width / 2 - 1.0, 1.6)];
  const spot = spots.find((point) => ctx.inside(point.x, point.z, 1.6));
  if (spot) minaret(spot.x, spot.z);
  if (s > 46) {
    const twin = onFace(pf, -(pf.width / 2 + 1.0), 1.6);
    if (ctx.inside(twin.x, twin.z, 1.6)) minaret(twin.x, twin.z);
  }
  const yard = roomAhead(ctx, pf, 2.4);
  if (yard > 7) {
    const at = onFace(pf, 0, 2.4 + (yard - 2.4) / 2);
    const fr = clamp((yard - 2.4) * 0.22, 1.2, 3.5);
    kit.ring(at.x, G, at.z, fr - 0.3, fr, 0.55, C.stone, 18);
    kit.cyl(at.x, G, at.z, fr - 0.3, fr - 0.3, 0.42, C.water, 18, "water");
    kit.cyl(at.x, G, at.z, 0.25, 0.32, 1.1, C.stone, 10);
  }
  alongRing(inset(ring, 2.6), 7).forEach((p) => {
    if (insideBy(hallRing, p.x, p.z) || distanceToRing(p.x, p.z, hallRing) < 3) return;
    palm(kit, p.x, p.z, clamp(s / 40, 0.75, 1.1));
  });
  void rand;
};

const school = (ctx: Ctx) => {
  const { kit, ring, r, rand } = ctx;
  kit.slab(ring, 0, G, C.paving);
  const gateFace = perimeter(ctx, { h: 0.6, gap: clamp(ctx.front.width * 0.16, 4, 8), color: 0xe7ddcb, rail: true });
  const floors = Math.abs(signedArea(ring)) > 2600 ? 3 : 2;
  const floorH = 3.6;
  const accent = 0xc4906c;
  const barRing = region(ring, { maxZ: ctx.minZ + clamp(ctx.D * 0.38, 9, 18) }, clamp(r * 0.08, 1.4, 3.5));
  const bar = mass(kit, barRing, { lot: ring, floors, floorH, wall: 0xf2ebdf, band: accent });
  bar.faces.forEach((face) => {
    if (Math.abs(face.nz) > 0.6) ribbon(kit, face, G, floors, floorH, { h: 1.7, skip: face === bar.front ? 3.6 : 0 });
    else punched(kit, face, G, floors, floorH, { w: 1.3, h: 1.6, bay: 3.2 });
  });
  const f = bar.front;
  const yaw = faceYaw(f);
  if (f.width > 14) {
    [-1, 1].forEach((side) => {
      const tower = onFace(f, side * (f.width / 2 - 2.4), 0.6);
      kit.box(tower.x, G, tower.z, 3.6, floors * floorH + 1.6, 1.4, accent, "solid", yaw);
      const strip = onFace(f, side * (f.width / 2 - 2.4), 1.32);
      kit.box(strip.x, G + 1.2, strip.z, 1.0, floors * floorH - 1.2, 0.06, C.glass, "glass", yaw);
    });
  }
  entrance(kit, f, 0, 3.2, 2.8, 3.4, accent);
  const sign = onFace(f, 0, 0.12);
  kit.box(sign.x, G + floorH + 0.4, sign.z, 5.6, 0.9, 0.12, accent, "solid", yaw);
  const yard = roomAhead(ctx, f, 2);
  if (yard > 13) {
    const cw = clamp(f.width * 0.42, 12, 28);
    const cd = clamp((yard - 2) * 0.6, 8, 15);
    const cz = (yard - 2) / 2 + 2;
    const shift = clamp(f.width * 0.16, 0, f.width / 2 - cw / 2 - 1);
    const corners = [[-cw / 2, -cd / 2], [cw / 2, -cd / 2], [cw / 2, cd / 2], [-cw / 2, cd / 2]].map(([u, v]) => onFace(f, shift + u, cz + v));
    if (corners.every((point) => ctx.inside(point.x, point.z, 0.8))) {
      const at = onFace(f, shift, cz);
      kit.box(at.x, G, at.z, cw, 0.05, cd, 0xc79576, "solid", yaw);
      [[0, cd / 2 - 0.4, cw - 0.8, 0.1], [0, -cd / 2 + 0.4, cw - 0.8, 0.1], [cw / 2 - 0.4, 0, 0.1, cd - 0.8], [-cw / 2 + 0.4, 0, 0.1, cd - 0.8], [0, 0, 0.1, cd - 0.8]].forEach(([u, v, w, d]) => {
        const p = onFace(f, shift + u, cz + v);
        kit.box(p.x, G + 0.05, p.z, w, 0.02, d, C.line, "solid", yaw);
      });
      kit.ring(at.x, G + 0.05, at.z, 1.7, 1.82, 0.02, C.line, 24);
      [-1, 1].forEach((side) => {
        const post = onFace(f, shift + side * (cw / 2 - 0.6), cz);
        kit.cyl(post.x, G, post.z, 0.08, 0.08, 3.4, C.steel, 6);
        const board = onFace(f, shift + side * (cw / 2 - 0.9), cz);
        kit.box(board.x, G + 3.0, board.z, 0.08, 1.0, 1.7, C.trim, "solid", yaw);
        const hoop = onFace(f, shift + side * (cw / 2 - 1.25), cz);
        kit.ring(hoop.x, G + 2.95, hoop.z, 0.2, 0.25, 0.04, C.red, 10);
      });
    }
  }
  const flag = onFace(gateFace, -clamp(gateFace.width * 0.2, 4, 10), -3.2);
  if (ctx.inside(flag.x, flag.z, 1.4)) flagpole(kit, flag.x, flag.z, 9);
  edgeTrees(ctx, 8, 0.85, [barRing]);
  void rand;
};

const medical = (ctx: Ctx) => {
  const { kit, ring, r } = ctx;
  kit.slab(ring, 0, G, C.paving);
  const floors = Math.abs(signedArea(ring)) > 1800 ? 3 : 2;
  const floorH = 3.8;
  const body = region(ring, { maxZ: ctx.minZ + ctx.D * 0.6 }, clamp(r * 0.08, 1, 3.5));
  const m = mass(kit, body, { lot: ring, floors, floorH, wall: 0xf7f6f2, band: 0xdde4e6, roofUnits: false });
  m.faces.forEach((face) => {
    if (Math.abs(face.nz) > 0.6) ribbon(kit, face, G, floors, floorH, { h: 1.9, glass: 0x86a6b3, skip: face === m.front ? 4.2 : 0 });
    else punched(kit, face, G, floors, floorH, { w: 1.4, h: 1.8, bay: 3 });
  });
  entrance(kit, m.front, 0, 4.2, 3.0, 5, 0xe9eef0);
  const cross = (x: number, y: number, z: number, size: number, yaw: number, out: number) => {
    const n = { x: Math.sin(yaw), z: Math.cos(yaw) };
    kit.box(x, y, z, size + 0.5, size + 0.5, 0.2, C.trim, "solid", yaw);
    kit.box(x + n.x * out, y + 0.25, z + n.z * out, size * 0.32, size, 0.05, 0xc8574f, "solid", yaw);
    kit.box(x + n.x * out, y + 0.25 + size * 0.34, z + n.z * out, size, size * 0.32, 0.05, 0xc8574f, "solid", yaw);
  };
  const f = m.front;
  if (f.width > 8) {
    const plate = onFace(f, f.width / 2 - 2.6, 0.1);
    cross(plate.x, G + floorH * floors - 2.4, plate.z, 1.8, faceYaw(f), 0.12);
  }
  const mc = centerOf(body);
  kit.box(mc.x, m.top + 0.26, mc.z, 3.4, 2.2, 0.3, C.trim, "solid", faceYaw(f));
  cross(mc.x, m.top + 0.5, mc.z, 1.6, faceYaw(f), 0.17);
  if (inradius(body) > 7) {
    const pad = { x: mc.x - f.nz * -3, z: mc.z };
    if (insideBy(body, pad.x, pad.z, 4.4)) {
      kit.cyl(pad.x, m.top + 0.26, pad.z, 4.2, 4.2, 0.08, 0x9aa0a3, 24);
      kit.ring(pad.x, m.top + 0.34, pad.z, 3.6, 3.9, 0.02, C.line, 24);
      kit.box(pad.x - 0.9, m.top + 0.34, pad.z, 0.4, 0.02, 2.6, C.line);
      kit.box(pad.x + 0.9, m.top + 0.34, pad.z, 0.4, 0.02, 2.6, C.line);
      kit.box(pad.x, m.top + 0.34, pad.z, 1.8, 0.02, 0.4, C.line);
    }
  }
  const yard = roomAhead(ctx, f, 1);
  if (yard > 8) {
    const amb = onFace(f, Math.min(6.5, f.width * 0.3), 4.5);
    if (ctx.inside(amb.x, amb.z, 2.4)) {
      const yaw = faceYaw(f) + Math.PI / 2;
      car(kit, amb.x, amb.z, yaw, 0xf5f4f0);
      kit.box(amb.x, G + 0.95, amb.z, 0.04, 0.2, 4.0, 0xc8574f, "solid", yaw);
      kit.box(amb.x, G + 1.56, amb.z, 0.5, 0.16, 0.3, 0x6d8fbf, "solid", yaw);
    }
    parkingField(ctx, ctx.maxZ - Math.min(yard - 6, 11), ctx.maxZ - 0.6, 0.7);
  }
  edgeTrees(ctx, 9, 0.75, [body], 1.2);
};

const shop = (ctx: Ctx) => {
  const { kit, ring, rand } = ctx;
  kit.slab(ring, 0, G, C.paving);
  const walk = clamp(ctx.D * 0.28, 1.6, 5);
  const body = region(ring, { maxZ: ctx.maxZ - walk }, 0.4);
  const depth = boundsLocal(body).maxZ - boundsLocal(body).minZ;
  const floors = depth > 8 ? 2 : 1;
  const groundH = 4.2;
  const upperH = 3.3;
  const m = mass(kit, body, { lot: ring, floors: 1, floorH: groundH, wall: 0xf0e9dc, parapet: floors > 1 ? 0 : 0.7 });
  let top = m.top;
  if (floors > 1) {
    const upper = offsetRing(body, -0.1) || body;
    const u = mass(kit, upper, { floors: 1, floorH: upperH, wall: 0xf4efe6, y: top + 0.26 });
    top = u.top;
    u.faces.forEach((face) => {
      if (face.nz > 0.3) punched(kit, face, top - upperH, 1, upperH, { w: 1.2, h: 1.5, bay: 3, shutters: 0xd8cfbf, sill: true });
      else punched(kit, face, top - upperH, 1, upperH, { w: 1.0, h: 1.2, bay: 4 });
    });
  }
  m.faces.forEach((face) => {
    if (face.nz <= 0.3) {
      punched(kit, face, G, 1, groundH, { w: 1.0, h: 1.2, bay: 4 });
      return;
    }
    const yaw = faceYaw(face);
    const n = Math.max(1, Math.round(face.width / 6));
    const uw = face.width / n;
    for (let index = 0; index < n; index++) {
      const along = -face.width / 2 + uw * (index + 0.5);
      const sign = SIGNS[(index + Math.floor(rand() * 3)) % SIGNS.length];
      const glass = onFace(face, along, 0.06);
      kit.box(glass.x, G + 0.3, glass.z, uw - 1.0, 2.9, 0.06, C.glass, "glass", yaw);
      const door = onFace(face, along + uw * 0.22, 0.1);
      kit.box(door.x, G + 0.3, door.z, Math.min(1.1, uw * 0.3), 2.5, 0.05, C.glassDark, "glass", yaw);
      kit.box(glass.x, G + 3.2, glass.z, uw - 0.9, 0.12, 0.12, C.trim, "solid", yaw);
      const plate = onFace(face, along, 0.14);
      kit.box(plate.x, G + 3.3, plate.z, uw - 0.9, 0.78, 0.18, sign, "solid", yaw);
      const letters = onFace(face, along, 0.24);
      kit.box(letters.x, G + 3.52, letters.z, (uw - 0.9) * 0.55, 0.3, 0.03, C.trim, "solid", yaw);
      const awning = onFace(face, along, 0.1);
      kit.prism([[0, 0.1], [0, 0], [1.6, -0.75], [1.6, -0.62]], uw - 1.1, awning.x, G + 3.15, awning.z, index % 2 ? sign : C.trim, yaw);
    }
    for (let index = 0; index <= n; index++) {
      const pier = onFace(face, -face.width / 2 + uw * index, 0.1);
      kit.box(pier.x, G, pier.z, 0.46, groundH, 0.3, C.trim, "solid", yaw);
    }
    alongRing([face.a, face.b], 9, 4).forEach((spot) => {
      const p = { x: spot.x + face.nx * walk * 0.6, z: spot.z + face.nz * walk * 0.6 };
      if (ctx.inside(p.x, p.z, 0.8)) planter(kit, p.x, p.z, 1.0);
    });
  });
};

const supermarket = (ctx: Ctx) => {
  const { kit, ring, r } = ctx;
  kit.slab(ring, 0, G, C.asphalt);
  const body = region(ring, { maxZ: ctx.minZ + ctx.D * 0.58 }, clamp(r * 0.05, 1, 3));
  const h = clamp(inradius(body) * 0.4, 5.5, 8);
  const green = 0x6f9a6b;
  kit.slab(offsetRing(body, 0.6) || body, G, 0.2, C.paving);
  const m = mass(kit, body, { lot: ring, floors: 1, floorH: h, wall: 0xeeeae2, y: G + 0.2, parapet: 0.6 });
  const f = m.front;
  const yaw = faceYaw(f);
  const glassW = f.width * 0.62;
  const glass = onFace(f, 0, 0.06);
  kit.box(glass.x, G + 0.2, glass.z, glassW, h * 0.55, 0.06, C.glass, "glass", yaw);
  const posts = Math.max(1, Math.floor(glassW / 2));
  for (let index = 0; index <= posts; index++) {
    const post = onFace(f, -glassW / 2 + (index * glassW) / posts, 0.1);
    kit.box(post.x, G + 0.2, post.z, 0.12, h * 0.55, 0.12, C.trim, "solid", yaw);
  }
  const canopy = onFace(f, 0, 1.4);
  kit.box(canopy.x, G + 0.2 + h * 0.55, canopy.z, glassW + 1.2, 0.3, 2.8, C.trim, "solid", yaw);
  const band = onFace(f, 0, 0.2);
  kit.box(band.x, G + 0.2 + h - 0.2, band.z, f.width * 0.5, 1.6, 0.3, green, "solid", yaw);
  const letters = Math.min(9, Math.floor((f.width * 0.5) / 1.6));
  for (let index = 0; index < letters; index++) {
    const letter = onFace(f, -((letters - 1) * 1.4) / 2 + index * 1.4, 0.38);
    kit.box(letter.x, G + 0.2 + h, letter.z, 0.9, 1.1, 0.06, C.trim, "solid", yaw);
  }
  m.faces.forEach((face) => {
    if (face !== f) punched(kit, face, G + 0.2, 1, h, { w: 2.2, h: 0.8, bay: 6 });
  });
  const corral = onFace(f, glassW / 2 + 2.6, 2.2);
  if (ctx.inside(corral.x, corral.z, 1.2)) {
    kit.box(corral.x, G, corral.z, 3, 0.04, 1.6, C.pavingDark, "solid", yaw);
    for (let index = 0; index < 4; index++) {
      const cart = onFace(f, glassW / 2 + 1.7 + index * 0.6, 2.2);
      kit.box(cart.x, G, cart.z, 0.5, 0.9, 1.0, C.metal, "solid", yaw);
    }
  }
  const yard = roomAhead(ctx, f, 5);
  if (yard > 10) parkingField(ctx, ctx.maxZ - (yard - 5), ctx.maxZ - 0.8, 0.55);
  alongRing([f.a, f.b], 14, 2).forEach((spot) => {
    const p = { x: spot.x + f.nx * 4.4, z: spot.z + f.nz * 4.4 };
    if (ctx.inside(p.x, p.z, 0.6)) lamp(kit, p.x, p.z, 6, yaw + Math.PI);
  });
};

const mall = (ctx: Ctx) => {
  const { kit, ring, r } = ctx;
  kit.slab(ring, 0, G, C.asphalt);
  const body = region(ring, { maxZ: ctx.minZ + ctx.D * 0.62 }, clamp(r * 0.05, 1, 3));
  const floors = 2;
  const floorH = 5;
  const m = mass(kit, body, { lot: ring, floors, floorH, wall: 0xe3e0da, band: 0xd2cdc4 });
  const f = m.front;
  const yaw = faceYaw(f);
  const atriumW = clamp(f.width * 0.32, 6, 30);
  m.faces.forEach((face) => {
    if (face === f) return;
    if (face.width > 10) ribbon(kit, face, G, floors, floorH, { h: 2.2 });
  });
  const fins = Math.floor(f.width / 2.4);
  for (let index = 0; index <= fins; index++) {
    const along = -f.width / 2 + (index * f.width) / fins;
    if (Math.abs(along) < atriumW / 2 + 0.6) continue;
    const fin = onFace(f, along, 0.2);
    kit.box(fin.x, G + 0.4, fin.z, 0.3, floors * floorH - 0.4, 0.4, 0xf3f1ec, "solid", yaw);
  }
  const atriumH = floors * floorH + 3;
  const atrium = onFace(f, 0, -1.5);
  kit.box(atrium.x, G, atrium.z, atriumW, atriumH, 4, C.glass, "glass", yaw);
  for (let index = 0; index <= Math.floor(atriumW / 2); index++) {
    const post = onFace(f, -atriumW / 2 + index * 2, 0.52);
    kit.box(post.x, G, post.z, 0.12, atriumH, 0.12, C.trim, "solid", yaw);
  }
  for (let y = G + 2.5; y < G + atriumH; y += 2.5) {
    const beam = onFace(f, 0, 0.52);
    kit.box(beam.x, y, beam.z, atriumW, 0.1, 0.12, C.trim, "solid", yaw);
  }
  kit.box(atrium.x, G + atriumH, atrium.z, atriumW + 0.6, 0.4, 4.6, C.trim, "solid", yaw);
  const canopy = onFace(f, 0, 2.4);
  kit.box(canopy.x, G + 4.6, canopy.z, atriumW + 4, 0.35, 5, 0xf3f1ec, "solid", yaw);
  [-1, 1].forEach((side) => {
    const post = onFace(f, side * (atriumW / 2 + 1.4), 4.4);
    kit.cyl(post.x, G, post.z, 0.2, 0.2, 4.6, C.trim, 10);
    const sign = onFace(f, side * (atriumW / 2 + f.width * 0.12), 0.45);
    if (Math.abs(side * (atriumW / 2 + f.width * 0.12)) < f.width / 2 - 2) kit.box(sign.x, m.top - 2.6, sign.z, f.width * 0.12, 1.6, 0.16, SIGNS[side > 0 ? 3 : 1], "solid", yaw);
  });
  const yard = roomAhead(ctx, f, 8);
  if (yard > 13) parkingField(ctx, ctx.maxZ - (yard - 8), ctx.maxZ - 0.8, 0.6);
  alongRing([f.a, f.b], 10, 3).forEach((spot) => {
    const p = { x: spot.x + f.nx * 6, z: spot.z + f.nz * 6 };
    if (ctx.inside(p.x, p.z, 1.2)) palm(kit, p.x, p.z, 0.9);
  });
};

const gym = (ctx: Ctx) => {
  const { kit, ring, r } = ctx;
  kit.slab(ring, 0, G, C.paving);
  const body = region(ring, { maxZ: ctx.minZ + ctx.D * 0.66 }, clamp(r * 0.06, 1, 3));
  const h = 6.4;
  const orange = 0xd59055;
  const m = mass(kit, body, { lot: ring, floors: 1, floorH: h, wall: 0xe9e8e4, parapet: rectness(body) > 0.94 ? 0 : 0.6, roofUnits: false });
  const f = m.front;
  const yaw = faceYaw(f);
  const glass = onFace(f, 0, 0.05);
  kit.box(glass.x, G + 0.4, glass.z, f.width - 2, h - 1.6, 0.06, C.glass, "glass", yaw);
  const posts = Math.max(1, Math.floor((f.width - 2) / 1.8));
  for (let index = 0; index <= posts; index++) {
    const post = onFace(f, -(f.width - 2) / 2 + (index * (f.width - 2)) / posts, 0.1);
    kit.box(post.x, G + 0.4, post.z, 0.12, h - 1.6, 0.12, C.steel, "solid", yaw);
  }
  const stripe = onFace(f, 0, 0.1);
  kit.box(stripe.x, G + h - 1.2, stripe.z, f.width + 0.1, 0.5, 0.2, orange, "solid", yaw);
  const box = boundsLocal(body);
  if (rectness(body) > 0.94) {
    const bd = box.maxZ - box.minZ;
    const bw = box.maxX - box.minX;
    const rise = clamp(bd * 0.18, 1.6, 5);
    const arc: [number, number][] = [];
    for (let index = 0; index <= 12; index++) {
      const u = -bd / 2 - 0.3 + (index / 12) * (bd + 0.6);
      arc.push([u, rise * Math.sqrt(Math.max(0, 1 - ((2 * u) / (bd + 0.6)) ** 2))]);
    }
    const cx = (box.minX + box.maxX) / 2;
    const cz = (box.minZ + box.maxZ) / 2;
    kit.prism(arc, bw + 0.4, cx, G + h, cz, 0xbfc4c6);
    for (let index = 0; index < Math.floor(bw / 3); index++) {
      kit.prism(arc.map(([u, v]) => [u, v + 0.05]), 0.12, box.minX + 1.5 + index * 3, G + h, cz, C.steel);
    }
  } else {
    for (let z = box.minZ + 2; z < box.maxZ - 1; z += 4) {
      const strip = clipHalf(clipHalf(inset(body, 1.2), "z", z + 1.2, true), "z", z, false);
      if (strip.length >= 3) kit.slab(strip, G + h + 0.26, 0.5, C.glass, null, "glass");
    }
  }
  const sign = onFace(f, -f.width * 0.28, 0.2);
  kit.box(sign.x, G + h - 2.6, sign.z, f.width * 0.3, 1.0, 0.16, C.dark, "solid", yaw);
  const signFace = onFace(f, -f.width * 0.28, 0.3);
  kit.box(signFace.x, G + h - 2.4, signFace.z, f.width * 0.24, 0.6, 0.03, orange, "solid", yaw);
  entrance(kit, f, f.width * 0.25, 2.4, 2.6, 2.4, C.dark);
  m.faces.forEach((face) => {
    if (face !== f) punched(kit, face, G + 0.4, 1, h - 0.4, { w: 2.2, h: 1.0, bay: 3.4 });
  });
  edgeTrees(ctx, 9, 0.8, [body], 1.4);
};

const nursery = (ctx: Ctx) => {
  const { kit, ring, r } = ctx;
  kit.slab(ring, 0, G, 0xd9e0c9);
  perimeter(ctx, { h: 0.4, gap: 3.5, color: 0xf1ece3, rail: true, posts: 0.9 });
  const body = region(ring, { maxZ: ctx.minZ + ctx.D * 0.55 }, clamp(r * 0.1, 1.2, 3));
  const h = 3.6;
  const roofs = [0xe1a493, 0x9fc0d4, 0xe2c886, 0xa9c79c];
  const m = mass(kit, body, { lot: ring, floors: 1, floorH: h, wall: 0xf6f1e8, parapet: 0, cornice: C.trim, roofUnits: false });
  kit.hipRoof(body, m.top + 0.26, clamp(inradius(body) * 0.55, 1.2, 3.6), roofs[0], 0.6);
  m.faces.forEach((face, index) => {
    punched(kit, face, G + 0.35, 1, h - 0.35, { w: 1.4, h: 1.4, bay: 2.8, frame: roofs[(index + 1) % roofs.length], sill: true, skip: face === m.front ? 1.4 : 0 });
  });
  entrance(kit, m.front, 0, 1.6, 2.3, 2, roofs[1]);
  const yard = roomAhead(ctx, m.front, 1);
  if (yard > 6) {
    const at = (u: number) => fit(ctx, onFace(m.front, u, yard / 2).x, onFace(m.front, u, yard / 2).z, 2.2);
    const box = at(ctx.L * 0.2);
    if (box) {
      kit.box(box.x, G, box.z, 3.4, 0.25, 3.4, C.wood);
      kit.box(box.x, G + 0.25, box.z, 3.0, 0.08, 3.0, C.sand);
    }
    const slide = at(-ctx.L * 0.18);
    if (slide) {
      kit.box(slide.x, G, slide.z, 1.4, 1.2, 1.4, roofs[1]);
      kit.plank([slide.x + 0.7, G + 1.2, slide.z], [slide.x + 3.0, G + 0.15, slide.z], 0.7, 0.06, roofs[0]);
    }
    const saw = at(0);
    if (saw) {
      kit.box(saw.x, G, saw.z, 0.2, 0.45, 0.2, C.steel);
      kit.plank([saw.x - 1.6, G + 0.25, saw.z], [saw.x + 1.6, G + 0.65, saw.z], 0.3, 0.06, roofs[2]);
    }
  }
  edgeTrees(ctx, 7, 0.7, [body], 1.4);
};

const garage = (ctx: Ctx) => {
  const { kit, ring } = ctx;
  kit.slab(ring, 0, G, C.asphalt);
  const rowDepth = 5.6;
  const roofY = G + 2.7;
  let z = ctx.minZ + 1;
  let facing: 1 | -1 = 1;
  while (z + rowDepth < ctx.maxZ - 0.5) {
    const cz = z + rowDepth / 2;
    const xs = stallRow(ctx, ctx.minX + 0.8, ctx.maxX - 0.8, cz, rowDepth - 0.6, facing === 1 ? -1 : 1, 0.72);
    const runs: number[][] = [];
    xs.forEach((x) => {
      const run = runs[runs.length - 1];
      if (run && x - run[run.length - 1] < 2.7) run.push(x);
      else runs.push([x]);
    });
    const backZ = cz - facing * (rowDepth / 2 - 0.4);
    runs.forEach((run) => {
      const x0 = run[0] - 1.3;
      const x1 = run[run.length - 1] + 1.3;
      const width = x1 - x0;
      const mid = (x0 + x1) / 2;
      for (let x = x0; x <= x1 + 0.01; x += 5.2) kit.box(x, G, backZ, 0.22, roofY - G, 0.22, C.steel);
      const roof: [number, number][] = [[-rowDepth / 2 - 0.3, 0.45], [rowDepth / 2 + 0.3, 0], [rowDepth / 2 + 0.3, 0.14], [-rowDepth / 2 - 0.3, 0.59]];
      kit.prism(roof.map(([u, v]) => [u * facing, v]), width + 0.4, mid, roofY, cz, 0xc4c8cb);
      run.forEach((x) => {
        const panel: [number, number][] = [[-rowDepth / 2 - 0.1, 0.62], [rowDepth / 2 + 0.1, 0.17], [rowDepth / 2 + 0.1, 0.2], [-rowDepth / 2 - 0.1, 0.65]];
        kit.prism(panel.map(([u, v]) => [u * facing, v]), 2.4, x, roofY, cz, 0x4f5f6d, 0, "glass");
      });
      kit.box(mid, roofY - 0.3, backZ, width, 0.3, 0.2, C.steel);
    });
    z += rowDepth + (facing === 1 ? 6.5 : 0.6);
    facing = facing === 1 ? -1 : 1;
  }
  const booth = fit(ctx, ctx.front.cx + ctx.front.width * 0.35, ctx.front.cz - 2.2, 1.6);
  if (booth) {
    const yaw = faceYaw(ctx.front);
    kit.box(booth.x, G, booth.z, 2.2, 2.6, 2.0, C.wall, "solid", yaw);
    const pane = { x: booth.x + ctx.front.nx * 1.02, z: booth.z + ctx.front.nz * 1.02 };
    kit.box(pane.x, G + 1.0, pane.z, 1.6, 1.2, 0.05, C.glass, "glass", yaw);
    kit.box(booth.x, G + 2.6, booth.z, 2.8, 0.2, 2.6, C.trim, "solid", yaw);
    const arm = { x: -ctx.front.nz, z: ctx.front.nx };
    barrier(kit, booth.x - arm.x * 1.8 + ctx.front.nx * 0.4, booth.z - arm.z * 1.8 + ctx.front.nz * 0.4, 3.6, -arm.x, -arm.z);
  }
};

const fountain = (ctx: Ctx) => {
  const { kit, ring, r, rand } = ctx;
  kit.slab(ring, 0, G, C.paving);
  const c = ctx.center;
  const round = ring.length === 4 && rectness(ring) > 0.92;
  const R = clamp(r * 0.62, 2.4, 14);
  const k = R / Math.max(r, 0.01);
  const basinOuter = round ? null : scaleRing(ring, k, c);
  const basinInner = basinOuter ? offsetRing(basinOuter, -0.45) || scaleRing(basinOuter, 0.9, c) : null;
  [1.35, 1.2].forEach((grow, index) => {
    if (round) kit.ring(c.x, G, c.z, R * grow + 1 - 0.5, R * grow + 1, 0.02, index ? C.pavingDark : 0xd9cfbd, 40);
    else {
      const outer = scaleRing(ring, Math.min(k * grow + 0.12, 0.96), c);
      kit.slab(outer, G, 0.02, index ? C.pavingDark : 0xd9cfbd, offsetRing(outer, -0.5));
    }
  });
  if (round || !basinOuter || !basinInner) {
    kit.ring(c.x, G, c.z, R - 0.45, R, 0.7, C.stone, 40);
    kit.ring(c.x, G + 0.7, c.z, R - 0.55, R + 0.1, 0.12, C.trim, 40);
    kit.cyl(c.x, G, c.z, R - 0.45, R - 0.45, 0.52, C.water, 40, "water");
  } else {
    kit.slab(basinOuter, G, 0.7, C.stone, basinInner);
    kit.slab(offsetRing(basinOuter, 0.1) || basinOuter, G + 0.7, 0.12, C.trim, offsetRing(basinInner, -0.1));
    kit.slab(basinInner, G, 0.52, C.water, null, "water");
  }
  const rim = basinInner || scaleRing(ring, (R - 0.45) / Math.max(r, 0.01), c);
  const r1 = clamp(R * 0.42, 1.2, 4.2);
  const bowl = (y: number, radius: number) => {
    kit.lathe([[0.25, 0], [radius * 0.4, 0.18], [radius, 0.5], [radius, 0.66], [radius * 0.9, 0.66], [0.3, 0.3]], c.x, y, c.z, C.stone, 24);
    kit.cyl(c.x, y + 0.42, c.z, radius * 0.9, radius * 0.9, 0.2, C.water, 24, "water");
    kit.cyl(c.x, y - 1.0, c.z, radius * 0.96, radius * 1.02, 1.0, 0xbcdde3, 24, "water", true);
  };
  kit.lathe([[0.7, 0], [0.55, 0.2], [0.35, 0.5], [0.35, 1.5], [0.5, 1.75]], c.x, G + 0.5, c.z, C.stone, 16);
  bowl(G + 2.2, r1);
  kit.cyl(c.x, G + 2.6, c.z, 0.18, 0.24, 1.3, C.stone, 12);
  bowl(G + 3.8, r1 * 0.5);
  const jet = clamp(R * 0.4, 1.2, 3.4);
  kit.cyl(c.x, G + 4.2, c.z, 0.06, 0.12, jet, 0xd3e8ec, 8, "water");
  kit.sphere(c.x, G + 4.2 + jet, c.z, 0.28, 0xd3e8ec, 8, 1, "water");
  const jets = round
    ? Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        return { x: c.x + Math.sin(angle) * (R - 0.7), z: c.z + Math.cos(angle) * (R - 0.7) };
      })
    : alongRing(rim, Math.max(1.6, (Math.abs(signedArea(rim)) ** 0.5) / 3)).map((spot) => ({ x: spot.x - spot.nx * 0.3, z: spot.z - spot.nz * 0.3 }));
  jets.slice(0, 18).forEach((spot) => {
    const mx = c.x + (spot.x - c.x) * 0.62;
    const mz = c.z + (spot.z - c.z) * 0.62;
    const end = Math.hypot(spot.x - c.x, spot.z - c.z) || 1;
    const ex = c.x + ((spot.x - c.x) / end) * r1 * 1.3;
    const ez = c.z + ((spot.z - c.z) / end) * r1 * 1.3;
    kit.rod([spot.x, G + 0.55, spot.z], [mx, G + 1.6, mz], 0.05, 0xd3e8ec, "water");
    kit.rod([mx, G + 1.6, mz], [ex, G + 0.55, ez], 0.05, 0xd3e8ec, "water");
  });
  const benchRing = round ? null : scaleRing(ring, Math.min(k + 2.8 / Math.max(r, 0.01), 0.9), c);
  if (benchRing) {
    facesOfRing(benchRing, 2.4).forEach((face) => {
      if (ctx.inside(face.cx, face.cz, 1)) bench(kit, face.cx, face.cz, faceYaw(face) + Math.PI);
    });
  } else {
    const count = Math.max(4, Math.min(10, Math.round((R + 3) / 1.6)));
    for (let index = 0; index < count; index++) {
      const angle = (index / count) * Math.PI * 2 + Math.PI / count;
      const x = c.x + Math.sin(angle) * (R + 2.8);
      const z = c.z + Math.cos(angle) * (R + 2.8);
      if (ctx.inside(x, z, 1)) bench(kit, x, z, angle + Math.PI);
    }
  }
  const corners = inset(ring, 1.6);
  corners.forEach((corner) => {
    if (Math.hypot(corner.x - c.x, corner.z - c.z) < R + 3) return;
    if (!ctx.inside(corner.x, corner.z, 0.9)) return;
    planter(kit, corner.x, corner.z, 1.4);
    const lx = corner.x + (c.x - corner.x) * 0.18;
    const lz = corner.z + (c.z - corner.z) * 0.18;
    if (ctx.inside(lx, lz, 0.6)) lamp(kit, lx, lz, 4.2, Math.atan2(c.x - lx, c.z - lz));
  });
  if (r > 13) {
    alongRing(scaleRing(ring, Math.min(k + 5.5 / r, 0.86), c), 7).forEach((spot) => {
      if (ctx.inside(spot.x, spot.z, 1.5)) tree(kit, spot.x, spot.z, 0.8, rand);
    });
  }
};

/** يقيس امتداد المضلع على خط مستقيم z ثابت أو x ثابت. */
const spanAt = (ring: P[], axis: "x" | "z", value: number): [number, number] | null => {
  const other = axis === "z" ? "x" : "z";
  const hits: number[] = [];
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    if ((a[axis] - value) * (b[axis] - value) > 0 || a[axis] === b[axis]) continue;
    const t = (value - a[axis]) / (b[axis] - a[axis]);
    hits.push(a[other] + (b[other] - a[other]) * t);
  }
  if (hits.length < 2) return null;
  return [Math.min(...hits), Math.max(...hits)];
};

const gate = (ctx: Ctx) => {
  const { kit, ring } = ctx;
  kit.slab(ring, 0, G, C.paving);
  const across = spanAt(ring, "z", ctx.center.z) || [ctx.minX, ctx.maxX];
  const through = spanAt(ring, "x", ctx.center.x) || [ctx.minZ, ctx.maxZ];
  const cz = ctx.center.z;
  const cx = (across[0] + across[1]) / 2;
  const spanL = across[1] - across[0];
  const depth = through[1] - through[0];
  const roadW = clamp(spanL * 0.36, 6, 16);
  kit.box(cx, G, (through[0] + through[1]) / 2, roadW, 0.03, depth, C.asphalt);
  for (let z = through[0] + 1; z < through[1] - 1; z += 3) kit.box(cx, G + 0.03, z, 0.14, 0.02, 1.5, C.line);
  const pw = clamp(spanL * 0.09, 2.4, 5);
  const pd = clamp(depth * 0.6, 2.4, 6.5);
  const ph = clamp(spanL * 0.28, 7.5, 14);
  const stone = 0xe4d9c3;
  const accent = 0x56626b;
  [-1, 1].forEach((side) => {
    const px = cx + side * (roadW / 2 + pw / 2 + 0.4);
    kit.box(px, G, cz, pw + 0.8, 0.9, pd + 0.8, C.stoneDark);
    kit.box(px, G + 0.9, cz, pw, ph - 0.9, pd, stone);
    kit.box(px, G + 1.6, cz + pd / 2 + 0.02, pw * 0.42, ph - 3.6, 0.06, 0xcdbfa5);
    kit.box(px, G + 1.6, cz - pd / 2 - 0.02, pw * 0.42, ph - 3.6, 0.06, 0xcdbfa5);
    kit.box(px, G + ph, cz, pw + 0.5, 0.35, pd + 0.5, C.trim);
    kit.box(px, G + ph + 0.35, cz, pw + 0.1, 0.6, pd + 0.1, stone);
    kit.box(px, G + ph + 0.95, cz, pw + 0.4, 0.22, pd + 0.4, C.trim);
    kit.lathe([[0.55, 0], [0.5, 0.35], [0.3, 0.8], [0.01, 1.1]], px, G + ph + 1.17, cz, C.gold, 12);
    kit.box(px, G + ph * 0.55, cz + pd / 2 + 0.1, 0.5, 0.7, 0.3, C.trim);
    if (ctx.inside(px, cz + pd / 2 + 1.6, 0.7)) planter(kit, px, cz + pd / 2 + 1.6, 1.2);
    const wallStart = Math.abs(px - cx) + pw / 2 + 0.4;
    const wallEnd = side > 0 ? across[1] - cx - 0.4 : cx - across[0] - 0.4;
    if (wallEnd - wallStart > 1) {
      const wx = cx + side * (wallStart + wallEnd) / 2;
      kit.box(wx, G, cz, wallEnd - wallStart, 2.4, 0.5, stone);
      kit.box(wx, G + 2.4, cz, wallEnd - wallStart + 0.1, 0.18, 0.7, C.trim);
      for (let x = wallStart + 2.6; x < wallEnd - 0.5; x += 3.2) {
        kit.box(cx + side * x, G, cz, 0.7, 2.9, 0.7, C.stoneDark);
        kit.box(cx + side * x, G + 2.9, cz, 0.86, 0.14, 0.86, C.trim);
        kit.sphere(cx + side * x, G + 3.3, cz, 0.26, C.trim, 8);
      }
    }
  });
  const span = roadW + pw * 2 + 0.8;
  const beamY = G + ph - 2.2;
  kit.box(cx, beamY, cz, span, 2.2, pd * 0.7, stone);
  kit.box(cx, beamY - 0.2, cz, roadW + 0.2, 0.2, pd * 0.72, C.trim);
  kit.box(cx, beamY + 0.25, cz + pd * 0.35 + 0.06, roadW * 0.8, 1.6, 0.12, accent);
  kit.box(cx, beamY + 0.4, cz + pd * 0.35 + 0.13, roadW * 0.7, 1.3, 0.03, C.gold);
  kit.box(cx, beamY + 0.55, cz + pd * 0.35 + 0.16, roadW * 0.6, 1.0, 0.03, accent);
  kit.box(cx, beamY + 0.25, cz - pd * 0.35 - 0.06, roadW * 0.8, 1.6, 0.12, accent);
  kit.arch(cx, G + ph - 2.4 - roadW * 0.3, cz + pd * 0.35 + 0.02, roadW / 2, 0.08, C.trim);
  [-1, 1].forEach((dir) => {
    const bz = cz + dir * (pd / 2 + 1.4);
    if (bz < through[0] + 0.4 || bz > through[1] - 0.4) return;
    barrier(kit, cx + dir * (roadW / 2 - 0.4), bz, roadW / 2 - 0.6, -dir, 0);
  });
  const booth = { x: cx + roadW / 2 + pw + 2.8, z: cz - pd / 2 - 2.2 };
  if (ctx.inside(booth.x, booth.z, 1.4)) {
    kit.box(booth.x, G, booth.z, 2.4, 2.6, 2.2, C.wall);
    kit.box(booth.x, G + 1.0, booth.z + 1.12, 1.8, 1.2, 0.05, C.glass, "glass");
    kit.box(booth.x, G + 2.6, booth.z, 3.0, 0.2, 2.8, accent);
  }
};

const parking = (ctx: Ctx) => {
  const { kit, ring, rand } = ctx;
  kit.slab(ring, 0, G, C.asphalt);
  const curb = inset(ring, 0.15);
  facesOfRing(curb, 0.3).forEach((face) => kit.wallAlong(face.a, face.b, G, 0.16, 0.3, C.pavingDark));
  const depth = 5.2;
  const module = depth * 2 + 6.5;
  let z = ctx.minZ + 1;
  while (z + depth <= ctx.maxZ - 0.8) {
    stallRow(ctx, ctx.minX + 1.2, ctx.maxX - 1.2, z + depth / 2, depth, -1, 0.68);
    if (z + module <= ctx.maxZ - 0.8) {
      stallRow(ctx, ctx.minX + 1.2, ctx.maxX - 1.2, z + depth + 6.5 + depth / 2, depth, 1, 0.68);
      const aisle = z + depth + 3.25;
      for (let x = ctx.minX + 3; x < ctx.maxX - 2; x += 6.4) {
        if (ctx.inside(x, aisle, 0.6)) kit.box(x, G + 0.01, aisle, 0.8, 0.02, 0.14, C.line);
      }
      for (let x = ctx.minX + 6; x < ctx.maxX - 4; x += 16) {
        if (ctx.inside(x, aisle, 1)) lamp(kit, x, aisle, 7, 0);
      }
    }
    z += module;
    if (z + 1.6 < ctx.maxZ - 0.8) {
      const island = clipHalf(clipHalf(inset(ring, 1.6), "z", z + 1.3, true), "z", z + 0.3, false);
      if (island.length >= 3) {
        kit.slab(island, G, 0.18, 0x9fb58c);
        for (let x = ctx.minX + 4; x < ctx.maxX - 3; x += 9) {
          if (ctx.inside(x, z + 0.8, 1.2)) tree(kit, x, z + 0.8, 0.75, rand);
        }
      }
      z += 1.6;
    }
  }
  const sign = fit(ctx, ctx.front.cx - ctx.front.nz * (ctx.front.width / 2 - 1.6), ctx.front.cz + ctx.front.nx * (ctx.front.width / 2 - 1.6) - 1.4, 0.8);
  if (sign) {
    const yaw = faceYaw(ctx.front);
    kit.box(sign.x, G, sign.z, 0.12, 2.6, 0.12, C.steel);
    kit.box(sign.x, G + 2.0, sign.z, 1.2, 1.2, 0.1, 0x4f6d93, "solid", yaw);
    kit.box(sign.x + ctx.front.nx * 0.07, G + 2.25, sign.z + ctx.front.nz * 0.07, 0.5, 0.7, 0.02, C.trim, "solid", yaw);
  }
};

const pool = (ctx: Ctx) => {
  const { kit, ring, r, rand } = ctx;
  kit.slab(ring, 0, G, C.paving);
  const deckY = G + 0.3;
  const margin = clamp(r * 0.38, 1.6, 6);
  const basin = offsetRing(ring, -margin) || scaleRing(ring, 0.55);
  kit.slab(ring, G, 0.3, 0xeee7da, basin);
  kit.slab(basin, G, 0.04, C.tile);
  kit.slab(basin, deckY - 0.24, 0.06, C.water, null, "water");
  kit.slab(offsetRing(basin, 0.45) || basin, deckY, 0.06, C.trim, basin);
  const box = boundsLocal(basin);
  if (rectness(basin) > 0.9 && basin.length === 4) {
    const pw = box.maxX - box.minX;
    const pd = box.maxZ - box.minZ;
    const lanes = Math.max(2, Math.min(8, Math.floor(pd / 2.5)));
    for (let index = 1; index < lanes; index++) {
      const lz = box.minZ + (index * pd) / lanes;
      const pieces = Math.floor(pw / 0.6);
      for (let piece = 0; piece < pieces; piece++) {
        const px = box.minX + (piece + 0.5) * (pw / pieces);
        if (!insideBy(basin, px, lz, 0.2)) continue;
        kit.box(px, deckY - 0.18, lz, pw / pieces - 0.04, 0.08, 0.1, piece % 4 < 2 ? C.trim : 0x4f78a8);
      }
    }
  }
  const bf = frontOf(facesOfRing(basin));
  [-1, 1].forEach((side) => {
    if (bf.width < 4) return;
    [-0.3, 0.3].forEach((dx) => {
      const inner = onFace(bf, side * (bf.width / 2 - 1.2) + dx, -0.12);
      const outer = onFace(bf, side * (bf.width / 2 - 1.2) + dx, 0.4);
      kit.rod([inner.x, deckY - 0.2, inner.z], [inner.x, deckY + 0.9, inner.z], 0.035, C.metal);
      kit.rod([inner.x, deckY + 0.9, inner.z], [outer.x, deckY + 0.9, outer.z], 0.035, C.metal);
      kit.rod([outer.x, deckY + 0.9, outer.z], [outer.x, deckY, outer.z], 0.035, C.metal);
    });
  });
  if (margin >= 2.6) {
    const middle = offsetRing(ring, -margin / 2) || scaleRing(ring, 0.8);
    alongRing(middle, 2.4).forEach((spot, index) => {
      if (!ctx.inside(spot.x, spot.z, 1) || insideBy(basin, spot.x, spot.z, -0.5) || distanceToRing(spot.x, spot.z, basin) < 1.1) return;
      const yaw = Math.atan2(-spot.nx, -spot.nz);
      const back = { x: spot.x + spot.nx * 0.7, z: spot.z + spot.nz * 0.7 };
      kit.box(spot.x, deckY, spot.z, 0.7, 0.3, 1.6, C.wood, "solid", yaw);
      kit.plank([spot.x + spot.nx * 0.3, deckY + 0.3, spot.z + spot.nz * 0.3], [back.x + spot.nx * 0.3, deckY + 0.85, back.z + spot.nz * 0.3], 0.7, 0.06, C.trim);
      if (index % 3 === 1) {
        const pole = { x: spot.x - spot.nz * 1.2, z: spot.z + spot.nx * 1.2 };
        kit.cyl(pole.x, deckY, pole.z, 0.04, 0.04, 2.4, C.steel, 6);
        kit.cyl(pole.x, deckY + 2.0, pole.z, 0.05, 1.5, 0.45, UMBRELLAS[Math.floor(rand() * UMBRELLAS.length)], 10);
      }
    });
  }
  inset(ring, 0.6).forEach((corner) => {
    if (ring.length <= 8 && ctx.inside(corner.x, corner.z, 0.4) && distanceToRing(corner.x, corner.z, basin) > 1.5) palm(kit, corner.x, corner.z, 0.8);
  });
  alongRing(inset(ring, 0.45), 1.4).forEach((spot) => shrub(kit, spot.x, spot.z, 0.5, deckY));
};

const playground = (ctx: Ctx) => {
  const { kit, ring, rand } = ctx;
  kit.slab(ring, 0, G, 0xcfdcbc);
  const surface = inset(ring, 0.6);
  kit.slab(surface, G, 0.08, 0xd9a58c);
  kit.slab(inset(ring, 0.3), G, 0.3, C.wood, surface);
  const patches = [0xa9c49a, 0x9fbfcf, 0xe0c58b];
  patches.forEach((color) => {
    const rad = clamp(ctx.r * 0.25, 1, 3);
    const spot = fit(ctx, ctx.center.x + (rand() - 0.5) * ctx.L * 0.6, ctx.center.z + (rand() - 0.5) * ctx.D * 0.6, rad + 0.8);
    if (spot) kit.cyl(spot.x, G + 0.08, spot.z, rad, rad, 0.02, color, 20);
  });
  const blue = 0x6d8fbf;
  const red = 0xc8665a;
  const yellow = 0xe2bc5e;
  const qx = ctx.L / 4;
  const qz = ctx.D / 4;
  const c = ctx.center;
  const swing = fit(ctx, c.x - qx, c.z - qz, 2.4);
  if (swing) {
    const sw = clamp(ctx.L * 0.3, 3.2, 6);
    [-1, 1].forEach((side) => {
      const ex = swing.x + side * sw / 2;
      kit.rod([ex, G, swing.z - 1.0], [ex, G + 2.5, swing.z], 0.07, blue);
      kit.rod([ex, G, swing.z + 1.0], [ex, G + 2.5, swing.z], 0.07, blue);
    });
    kit.rod([swing.x - sw / 2, G + 2.5, swing.z], [swing.x + sw / 2, G + 2.5, swing.z], 0.08, blue);
    const seats = Math.max(1, Math.floor(sw / 1.4));
    for (let index = 0; index < seats; index++) {
      const x = swing.x - sw / 2 + (index + 0.5) * (sw / seats);
      kit.rod([x - 0.22, G + 2.45, swing.z], [x - 0.22, G + 0.6, swing.z], 0.015, C.steel);
      kit.rod([x + 0.22, G + 2.45, swing.z], [x + 0.22, G + 0.6, swing.z], 0.015, C.steel);
      kit.box(x, G + 0.55, swing.z, 0.55, 0.06, 0.25, red);
    }
  }
  const tower = fit(ctx, c.x + qx, c.z - qz, 3.2);
  if (tower) {
    const { x: tx, z: tz } = tower;
    const deck = G + 1.6;
    [[-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]].forEach(([dx, dz]) => kit.box(tx + dx, G, tz + dz, 0.14, 3.2, 0.14, C.wood));
    kit.box(tx, deck, tz, 1.9, 0.1, 1.9, C.wood);
    kit.box(tx, deck + 0.1, tz - 0.9, 1.8, 0.6, 0.05, yellow);
    kit.box(tx - 0.9, deck + 0.1, tz, 0.05, 0.6, 1.8, yellow);
    kit.prism([[-1.3, 0], [1.3, 0], [0, 0.9]], 2.1, tx, G + 3.2, tz, red);
    kit.plank([tx + 0.95, deck + 0.05, tz], [tx + 3.3, G + 0.25, tz], 0.7, 0.05, yellow);
    kit.plank([tx + 0.95, deck + 0.3, tz + 0.36], [tx + 3.3, G + 0.5, tz + 0.36], 0.06, 0.18, yellow);
    kit.plank([tx + 0.95, deck + 0.3, tz - 0.36], [tx + 3.3, G + 0.5, tz - 0.36], 0.06, 0.18, yellow);
    [-0.3, 0.3].forEach((dx) => kit.rod([tx + dx, G, tz + 2.2], [tx + dx, deck + 0.05, tz + 0.95], 0.05, blue));
    for (let step = 1; step < 5; step++) {
      const t = step / 5;
      kit.rod([tx - 0.3, G + (deck - G) * t, tz + 2.2 - 1.25 * t], [tx + 0.3, G + (deck - G) * t, tz + 2.2 - 1.25 * t], 0.03, C.steel);
    }
  }
  const round = fit(ctx, c.x - qx, c.z + qz, 1.8);
  if (round) {
    kit.cyl(round.x, G + 0.08, round.z, 1.4, 1.4, 0.14, red, 18);
    kit.cyl(round.x, G + 0.22, round.z, 0.06, 0.06, 0.9, C.steel, 6);
    for (let index = 0; index < 4; index++) {
      const angle = (index / 4) * Math.PI * 2;
      kit.rod([round.x, G + 1.0, round.z], [round.x + Math.sin(angle) * 1.2, G + 0.6, round.z + Math.cos(angle) * 1.2], 0.03, C.steel);
    }
  }
  const saw = fit(ctx, c.x + qx, c.z + qz, 2.2);
  if (saw) {
    kit.box(saw.x, G, saw.z, 0.3, 0.5, 0.3, C.steel);
    kit.plank([saw.x - 1.8, G + 0.3, saw.z], [saw.x + 1.8, G + 0.8, saw.z], 0.32, 0.07, blue);
  }
  if (ctx.inside(c.x, c.z, 2.2) && ctx.r > 5) {
    kit.box(c.x, G, c.z, 2.6, 0.32, 2.6, C.wood);
    kit.box(c.x, G + 0.32, c.z, 2.3, 0.06, 2.3, C.sand);
  }
  facesOfRing(inset(ring, 1.1), 3).forEach((face, index) => {
    if (index % 2) return;
    bench(kit, face.cx, face.cz, faceYaw(face) + Math.PI);
  });
  inset(ring, 0.9).forEach((corner, index) => {
    if (ring.length > 8 || !ctx.inside(corner.x, corner.z, 0.4)) return;
    if (index % 2) tree(kit, corner.x, corner.z, 0.8, rand);
    else lamp(kit, corner.x, corner.z, 4.4, Math.atan2(c.x - corner.x, c.z - corner.z));
  });
};

const security = (ctx: Ctx) => {
  const { kit, ring, r } = ctx;
  kit.slab(ring, 0, G, C.paving);
  const c = ctx.center;
  const f = ctx.front;
  const yaw = faceYaw(f);
  const bw = clamp(r * 1.0, 3, 7);
  const bd = clamp(r * 0.75, 2.6, 5);
  const navy = 0x4f6372;
  const off = (u: number, v: number) => ({ x: c.x - f.nz * u + f.nx * v, z: c.z + f.nx * u + f.nz * v });
  kit.box(c.x, G, c.z, bw + 0.6, 0.35, bd + 0.6, C.stoneDark, "solid", yaw);
  kit.box(c.x, G + 0.35, c.z, bw, 0.9, bd, C.wall, "solid", yaw);
  kit.box(c.x, G + 1.25, c.z, bw - 0.1, 1.7, bd - 0.1, C.glass, "glass", yaw);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const p = off(sx * (bw / 2 - 0.1), sz * (bd / 2 - 0.1));
    kit.box(p.x, G + 0.35, p.z, 0.24, 2.7, 0.24, C.trim, "solid", yaw);
  });
  kit.box(c.x, G + 2.95, c.z, bw + 0.2, 0.25, bd + 0.2, C.wall, "solid", yaw);
  const roof = off(0, 0.3);
  kit.box(roof.x, G + 3.2, roof.z, bw + 2.2, 0.3, bd + 2.4, C.trim, "solid", yaw);
  const fascia = off(0, bd / 2 + 1.5);
  kit.box(fascia.x, G + 3.2, fascia.z, bw + 2.2, 0.42, 0.08, navy, "solid", yaw);
  const letters = off(0, bd / 2 + 1.55);
  kit.box(letters.x, G + 3.28, letters.z, bw * 0.6, 0.26, 0.03, C.trim, "solid", yaw);
  const door = off(0, bd / 2 + 0.05);
  kit.box(door.x, G + 0.35, door.z, 0.9, 2.2, 0.06, C.glassDark, "glass", yaw);
  const cam = off(bw / 2 - 0.4, -bd / 2 + 0.5);
  kit.cyl(cam.x, G + 3.5, cam.z, 0.05, 0.05, 1.6, C.steel, 6);
  kit.box(cam.x, G + 4.6, cam.z, 0.25, 0.3, 0.35, C.dark, "solid", yaw);
  const pivot = off(bw / 2 + 0.8, bd / 2 + 0.8);
  if (ctx.inside(pivot.x, pivot.z, 0.3)) {
    let length = 6;
    while (length > 1.5 && !ctx.inside(pivot.x - f.nz * length, pivot.z + f.nx * length, 0.2)) length -= 0.5;
    barrier(kit, pivot.x, pivot.z, length, -f.nz, f.nx);
  }
  alongRing([f.a, f.b], 1.4).forEach((spot) => {
    const p = { x: spot.x - f.nx * 0.8, z: spot.z - f.nz * 0.8 };
    if (ctx.inside(p.x, p.z, 0.3) && Math.hypot(p.x - c.x, p.z - c.z) > bw * 0.7 + 1.5) kit.cyl(p.x, G, p.z, 0.12, 0.14, 0.9, C.steel, 8);
  });
  const pot = off(-bw / 2 - 1.2, 0);
  if (ctx.inside(pot.x, pot.z, 0.7)) planter(kit, pot.x, pot.z, 1.0);
  const light = off(-bw / 2 - 1.2, -1.6);
  if (ctx.inside(light.x, light.z, 0.3)) lamp(kit, light.x, light.z, 4.4, yaw);
};

const BUILDERS: Record<string, (ctx: Ctx) => void> = {
  mosque,
  school,
  medical,
  shop,
  supermarket,
  mall,
  gym,
  nursery,
  garage,
  fountain,
  gate,
  parking,
  pool,
  playground,
  security,
};

/* ---------- إطار القطعة ---------- */

type Frame = { matrix: THREE.Matrix4; local: P[] };

const insideRoad = (x: number, z: number, roads: GroundPoly[]) =>
  roads.some((road) => pointInPoly(x, z, road.points) && !(road.holes || []).some((hole) => pointInPoly(x, z, hole)));

/** محور القطعة على أطول ضلع، والواجهة نحو أقرب شارع. */
const frameOf = (ring: P[], roads: GroundPoly[], longFront: boolean): Frame => {
  let ux = 1;
  let uz = 0;
  let best = 0;
  for (let index = 0; index < ring.length; index++) {
    const a = ring[index];
    const b = ring[(index + 1) % ring.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length > best) {
      best = length;
      ux = (b.x - a.x) / length;
      uz = (b.z - a.z) / length;
    }
  }
  const vx = -uz;
  const vz = ux;
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  for (const point of ring) {
    const a = point.x * ux + point.z * uz;
    const b = point.x * vx + point.z * vz;
    minA = Math.min(minA, a);
    maxA = Math.max(maxA, a);
    minB = Math.min(minB, b);
    maxB = Math.max(maxB, b);
  }
  const center = centerOf(ring);
  const cx = center.x;
  const cz = center.z;
  const extentU = maxA - minA;
  const extentV = maxB - minB;
  const options = [
    { fx: vx, fz: vz, reach: extentV / 2, lateral: extentU / 2 },
    { fx: -vx, fz: -vz, reach: extentV / 2, lateral: extentU / 2 },
    ...(longFront ? [] : [
      { fx: ux, fz: uz, reach: extentU / 2, lateral: extentV / 2 },
      { fx: -ux, fz: -uz, reach: extentU / 2, lateral: extentV / 2 },
    ]),
  ];
  let chosen = options[0];
  let bestScore = -Infinity;
  options.forEach((option, order) => {
    let score = 0;
    for (const distance of [2.5, 6, 11, 18, 28]) {
      for (const lateral of [-0.35, 0, 0.35]) {
        const px = cx + option.fx * (option.reach + distance) + option.fz * lateral * 2 * option.lateral;
        const pz = cz + option.fz * (option.reach + distance) - option.fx * lateral * 2 * option.lateral;
        if (insideRoad(px, pz, roads)) score += 1 / (1 + distance * 0.12);
      }
    }
    score += (-(cx * option.fx + cz * option.fz) > 0 ? 0.05 : 0) - order * 0.001;
    if (order < 2) score += 0.02;
    if (score > bestScore) {
      bestScore = score;
      chosen = option;
    }
  });
  const zAxis = { x: chosen.fx, z: chosen.fz };
  const xAxis = { x: chosen.fz, z: -chosen.fx };
  const matrix = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(xAxis.x, 0, xAxis.z),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(zAxis.x, 0, zAxis.z),
  );
  matrix.setPosition(cx, 0, cz);
  const local = ring.map((point) => {
    const dx = point.x - cx;
    const dz = point.z - cz;
    return { x: dx * xAxis.x + dz * xAxis.z, z: dx * zAxis.x + dz * zAxis.z };
  });
  return { matrix, local };
};

const contextOf = (kit: Kit, local: P[], seed: number): Ctx => {
  const box = boundsLocal(local);
  const faces = facesOfRing(local, 0.5);
  return {
    kit,
    ring: local,
    faces,
    front: frontOf(faces),
    center: centerOf(local),
    r: inradius(local),
    ...box,
    L: box.maxX - box.minX,
    D: box.maxZ - box.minZ,
    rand: random(seed),
    inside: (x, z, margin = 0) => insideBy(local, x, z, margin),
  };
};

export const amenityModel = (item: PlacedInstance, ring: P[], roads: GroundPoly[]): AmenityModel => {
  const type = item.amenityType || "shop";
  const builder = BUILDERS[type] || medical;
  const frame = frameOf(ring, roads, type === "gate");
  const kit = new Kit(frame.matrix);
  if (frame.local.length >= 3 && Math.abs(signedArea(frame.local)) > 1) {
    builder(contextOf(kit, frame.local, hashString(item.id)));
  }
  return { parts: kit.parts, top: kit.top };
};

/* ---------- الشارع ---------- */

/** خط متقطع في منتصف الشارع، يتوقف عند التقاطعات. */
export const laneDashes = (ground: GroundPoly[], y: number) => {
  const positions: number[] = [];
  const quad = (ax: number, az: number, bx: number, bz: number, half: number) => {
    const length = Math.hypot(bx - ax, bz - az) || 1;
    const nx = (-(bz - az) / length) * half;
    const nz = ((bx - ax) / length) * half;
    positions.push(ax + nx, y, az + nz, bx + nx, y, bz + nz, bx - nx, y, bz - nz);
    positions.push(ax + nx, y, az + nz, bx - nx, y, bz - nz, ax - nx, y, az - nz);
  };
  for (const road of ground) {
    if (road.kind !== "road" || !road.lanes || !road.widthM || road.widthM < 4.5) continue;
    const width = road.widthM;
    const dash = 3;
    const period = dash + 3.6;
    road.lanes.forEach((lane, laneIndex) => {
      const others = road.lanes!.filter((_, index) => index !== laneIndex);
      let travelled = 0;
      for (let index = 1; index < lane.length; index++) {
        const a = lane[index - 1];
        const b = lane[index];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length < 0.01) continue;
        const segStart = travelled;
        const segEnd = travelled + length;
        travelled = segEnd;
        for (let k = Math.floor(segStart / period); k * period < segEnd; k++) {
          const d0 = Math.max(k * period, segStart);
          const d1 = Math.min(k * period + dash, segEnd);
          if (d1 - d0 < 0.05) continue;
          const t0 = (d0 - segStart) / length;
          const t1 = (d1 - segStart) / length;
          const ax = a.x + (b.x - a.x) * t0;
          const az = a.z + (b.z - a.z) * t0;
          const bx = a.x + (b.x - a.x) * t1;
          const bz = a.z + (b.z - a.z) * t1;
          const mx = (ax + bx) / 2;
          const mz = (az + bz) / 2;
          if (!others.some((other) => distanceToLine(mx, mz, other) < width * 0.7)) quad(ax, az, bx, bz, 0.08);
        }
      }
    });
  }
  if (positions.length === 0) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return geometry;
};

/** حافة الرصيف وأعمدة الإنارة على الرصيف بمحاذاة الشارع. */
export const streetFurniture = (ground: GroundPoly[], curbY: number) => {
  const kit = new Kit(new THREE.Matrix4());
  const sidewalks = ground.filter((poly) => poly.kind === "sidewalk");
  sidewalks.forEach((walk) => {
    [walk.points, ...(walk.holes || [])].forEach((ringPoints) => {
      for (let index = 0; index < ringPoints.length; index++) {
        const a = ringPoints[index];
        const b = ringPoints[(index + 1) % ringPoints.length];
        if (Math.hypot(b.x - a.x, b.z - a.z) < 0.2) continue;
        kit.wallAlong(a, b, curbY, 0.14, 0.26, 0xcac3b6);
      }
    });
  });
  if (sidewalks.length === 0) return kit.parts.solid;
  const onWalk = (x: number, z: number) => sidewalks.some((walk) => pointInPoly(x, z, walk.points) && !(walk.holes || []).some((hole) => pointInPoly(x, z, hole)));
  let lamps = 0;
  for (const road of ground) {
    if (road.kind !== "road" || !road.lanes || !road.widthM) continue;
    const reach = road.widthM / 2 + 1.1;
    for (const lane of road.lanes) {
      let travelled = 0;
      let next = 14;
      let side = 1;
      for (let index = 1; index < lane.length && lamps < 360; index++) {
        const a = lane[index - 1];
        const b = lane[index];
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length < 0.01) continue;
        const nx = -(b.z - a.z) / length;
        const nz = (b.x - a.x) / length;
        while (next <= travelled + length && lamps < 360) {
          const t = (next - travelled) / length;
          const px = a.x + (b.x - a.x) * t + nx * reach * side;
          const pz = a.z + (b.z - a.z) * t + nz * reach * side;
          if (onWalk(px, pz)) {
            kit.cyl(px, curbY, pz, 0.14, 0.18, 0.5, C.steel, 8);
            kit.cyl(px, curbY, pz, 0.06, 0.08, 7, C.steel, 6);
            const ax = px - nx * side * 1.5;
            const az = pz - nz * side * 1.5;
            kit.rod([px, curbY + 6.9, pz], [ax, curbY + 7.15, az], 0.05, C.steel);
            kit.box(ax, curbY + 6.95, az, 0.7, 0.18, 0.36, C.trim, "solid", Math.atan2(-nz, nx));
            lamps += 1;
          }
          side = -side;
          next += 32;
        }
        travelled += length;
      }
    }
  }
  return kit.parts.solid;
};

/* ---------- ملعب كرة ---------- */

/** ملعب كرة: عشب مخطط، خطوط بيضاء، مرميان، سياج على الحدود الفعلية، وأعمدة إنارة. */
export const pitchModel = (ring: P[], baseY: number) => {
  const frame = frameOf(ring, [], true);
  const kit = new Kit(frame.matrix);
  const local = frame.local;
  if (local.length < 3) return kit.parts.solid;
  const y = baseY + 0.01;
  const box = boundsLocal(local);
  const c = centerOf(local);
  let halfL = (box.maxX - box.minX) / 2 - 1.5;
  let halfD = (box.maxZ - box.minZ) / 2 - 1.5;
  const fits = () => [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]].every(([sx, sz]) => insideBy(local, c.x + sx * halfL, c.z + sz * halfD, 0.3));
  for (let step = 0; step < 40 && !fits(); step++) {
    halfL *= 0.96;
    halfD *= 0.96;
  }
  const fieldL = halfL * 2;
  const fieldD = halfD * 2;
  const hx = local.length >= 3 ? inset(local, 0.4) : local;
  facesOfRing(hx, 0.3).forEach((face) => {
    const count = Math.max(1, Math.round(face.width / 3));
    for (let index = 0; index <= count; index++) {
      const t = index / count;
      kit.box(face.a.x + (face.b.x - face.a.x) * t, y, face.a.z + (face.b.z - face.a.z) * t, 0.08, 1.4, 0.08, C.steel);
    }
    kit.rod([face.a.x, y + 1.35, face.a.z], [face.b.x, y + 1.35, face.b.z], 0.03, C.steel);
    kit.rod([face.a.x, y + 0.7, face.a.z], [face.b.x, y + 0.7, face.b.z], 0.02, C.steel);
  });
  if (fieldL >= 6 && fieldD >= 4 && fits()) {
    const stripes = Math.max(6, Math.round(fieldL / 6));
    for (let index = 0; index < stripes; index += 2) {
      kit.box(c.x - fieldL / 2 + (index + 0.5) * (fieldL / stripes), y, c.z, fieldL / stripes, 0.01, fieldD, 0xa6b996);
    }
    const ly = y + 0.012;
    const line = (x: number, z: number, w: number, d: number) => kit.box(c.x + x, ly, c.z + z, w, 0.01, d, C.line);
    const lw = 0.14;
    line(0, fieldD / 2, fieldL, lw);
    line(0, -fieldD / 2, fieldL, lw);
    line(fieldL / 2, 0, lw, fieldD);
    line(-fieldL / 2, 0, lw, fieldD);
    line(0, 0, lw, fieldD);
    const k = Math.min(fieldL / 105, fieldD / 68);
    const circle = clamp(9.15 * k, 1.2, 9.15);
    kit.ring(c.x, ly, c.z, circle - lw, circle, 0.01, C.line, 36);
    kit.cyl(c.x, ly, c.z, 0.22, 0.22, 0.012, C.line, 10);
    const boxD = clamp(40.3 * k, 3, fieldD * 0.62);
    const boxL = clamp(16.5 * k, 1.6, fieldL * 0.2);
    const smallD = boxD * 0.45;
    const smallL = boxL * 0.33;
    const goalW = clamp(7.32 * k, 2.2, 7.32);
    const goalH = clamp(2.44 * Math.max(k, 0.6), 1.6, 2.44);
    [-1, 1].forEach((side) => {
      const ex = side * fieldL / 2;
      line(ex - side * boxL, 0, lw, boxD);
      line(ex - side * boxL / 2, boxD / 2, boxL, lw);
      line(ex - side * boxL / 2, -boxD / 2, boxL, lw);
      line(ex - side * smallL, 0, lw, smallD);
      line(ex - side * smallL / 2, smallD / 2, smallL, lw);
      line(ex - side * smallL / 2, -smallD / 2, smallL, lw);
      kit.cyl(c.x + ex - side * boxL * 0.66, ly, c.z, 0.18, 0.18, 0.012, C.line, 8);
      const gx = c.x + ex + side * 0.05;
      const back = c.x + ex + side * 1.4;
      const z0 = c.z - goalW / 2;
      const z1 = c.z + goalW / 2;
      kit.rod([gx, y, z0], [gx, y + goalH, z0], 0.07, C.trim);
      kit.rod([gx, y, z1], [gx, y + goalH, z1], 0.07, C.trim);
      kit.rod([gx, y + goalH, z0], [gx, y + goalH, z1], 0.07, C.trim);
      kit.rod([gx, y + goalH, z0], [back, y, z0], 0.03, C.metal);
      kit.rod([gx, y + goalH, z1], [back, y, z1], 0.03, C.metal);
      kit.rod([back, y, z0], [back, y, z1], 0.03, C.metal);
      for (let index = 1; index < 6; index++) {
        const t = index / 6;
        kit.rod([gx, y + goalH, z0 + goalW * t], [back, y, z0 + goalW * t], 0.012, C.trim);
      }
    });
  }
  if (box.maxX - box.minX > 30 && local.length <= 8) {
    local.forEach((corner) => {
      const toward = Math.hypot(c.x - corner.x, c.z - corner.z) || 1;
      const px = corner.x + ((corner.x - c.x) / toward) * 0.6;
      const pz = corner.z + ((corner.z - c.z) / toward) * 0.6;
      kit.cyl(px, y, pz, 0.12, 0.2, 13, C.steel, 8);
      kit.plank([px, y + 13, pz], [px + ((c.x - px) / toward) * 0.8, y + 13.6, pz + ((c.z - pz) / toward) * 0.8], 2.4, 0.5, C.trim);
    });
  }
  return kit.parts.solid;
};

/* ---------- الحديقة ---------- */

export interface ParkModel {
  parts: THREE.BufferGeometry[];
  /** هل النقطة (بإحداثيات المشهد) على ممر أو ساحة، فلا تُزرع فيها شجرة. */
  keepOut: (x: number, z: number) => boolean;
}

/**
 * حديقة على شكل المضلع: حافة حجرية، سياج شجيرات، ممر دائري يتبع الحدود،
 * ممرات إلى ساحة وسطى فيها مظلة أو حوض زهور، مقاعد، فوانيس، وأحواض زهور.
 * الشرائط الضيقة تأخذ ممراً طولياً واحداً.
 */
export const parkModel = (id: string, ring: P[], baseY: number): ParkModel => {
  const frame = frameOf(ring, [], true);
  const kit = new Kit(frame.matrix);
  const local = frame.local;
  const none: ParkModel = { parts: kit.parts.solid, keepOut: () => false };
  if (local.length < 3 || Math.abs(signedArea(local)) < 12) return none;
  const ctx = contextOf(kit, local, hashString(id));
  const { r, center: c, rand } = ctx;
  const y = baseY;
  const kerbIn = offsetRing(local, -0.35);
  kit.slab(local, y, 0.16, 0xd8d0c0, kerbIn);
  const hedgeIn = r > 4 ? offsetRing(local, -1.0) : null;
  if (kerbIn && hedgeIn) kit.slab(kerbIn, y, 0.62, C.hedge, hedgeIn);

  const inverse = new THREE.Matrix4().copy(frame.matrix).invert();
  const toLocal = (x: number, z: number) => {
    const point = new THREE.Vector3(x, 0, z).applyMatrix4(inverse);
    return { x: point.x, z: point.z };
  };
  const zones: ((x: number, z: number) => boolean)[] = [(x, z) => !insideBy(local, x, z, 1.6)];
  const pathColor = C.gravel;
  const flowerBed = (x: number, z: number, radius: number) => {
    kit.cyl(x, y, z, radius + 0.15, radius + 0.15, 0.28, C.stoneDark, 18);
    kit.cyl(x, y, z, radius, radius, 0.3, 0x9a8466, 18);
    const count = Math.max(5, Math.round(radius * radius * 5));
    for (let index = 0; index < count; index++) {
      const angle = rand() * Math.PI * 2;
      const dist = Math.sqrt(rand()) * (radius - 0.2);
      kit.sphere(x + Math.sin(angle) * dist, y + 0.42, z + Math.cos(angle) * dist, 0.22, FLOWERS[Math.floor(rand() * FLOWERS.length)], 6, 0.8);
    }
    shrub(kit, x, z, Math.min(0.7, radius * 0.4), y + 0.25);
    zones.push((px, pz) => Math.hypot(px - x, pz - z) < radius + 0.8);
  };

  if (r >= 8) {
    const a = clamp(r * 0.24, 2.6, 7);
    const outer = offsetRing(local, -a);
    const inner = outer ? offsetRing(local, -(a + 1.9)) : null;
    if (outer && inner) {
      kit.slab(outer, y, 0.06, pathColor, inner);
      zones.push((x, z) => insideBy(outer, x, z, -0.6) && !insideBy(inner, x, z, 0.6));
      alongRing(inner, 15, 6).forEach((spot, index) => {
        const p = { x: spot.x - spot.nx * 0.7, z: spot.z - spot.nz * 0.7 };
        if (index % 2) lantern(kit, spot.x + spot.nx * 0.95, spot.z + spot.nz * 0.95, 3.4, y);
        else bench(kit, p.x, p.z, Math.atan2(-spot.nx, -spot.nz) + Math.PI, y);
      });
    }
    const plazaR = clamp(r * 0.26, 2.6, 9);
    kit.cyl(c.x, y, c.z, plazaR, plazaR, 0.07, pathColor, 32);
    kit.ring(c.x, y, c.z, plazaR, plazaR + 0.3, 0.14, C.stoneDark, 32);
    zones.push((x, z) => Math.hypot(x - c.x, z - c.z) < plazaR + 1.2);
    const spokes = facesOfRing(local, 6).sort((p, q) => q.width - p.width).slice(0, 4);
    spokes.forEach((face) => {
      const start = { x: face.cx - face.nx * 0.6, z: face.cz - face.nz * 0.6 };
      const dx = c.x - start.x;
      const dz = c.z - start.z;
      const length = Math.hypot(dx, dz) - plazaR + 0.3;
      if (length < 1) return;
      const ux = dx / Math.hypot(dx, dz);
      const uz = dz / Math.hypot(dx, dz);
      const end = { x: start.x + ux * length, z: start.z + uz * length };
      kit.box((start.x + end.x) / 2, y, (start.z + end.z) / 2, 1.6, 0.065, length, pathColor, "solid", Math.atan2(ux, uz));
      zones.push((x, z) => distanceToSegment(x, z, start, end) < 1.6);
      if (length > 6) {
        const mid = { x: start.x + ux * length * 0.5, z: start.z + uz * length * 0.5 };
        lantern(kit, mid.x - uz * 1.3, mid.z + ux * 1.3, 3.2, y);
      }
    });
    if (r > 15) {
      const gr = clamp(plazaR * 0.55, 2.2, 4.2);
      kit.cyl(c.x, y + 0.07, c.z, gr + 0.3, gr + 0.4, 0.35, C.stone, 8);
      for (let index = 0; index < 8; index++) {
        const angle = (index / 8) * Math.PI * 2 + Math.PI / 8;
        kit.cyl(c.x + Math.sin(angle) * gr, y + 0.42, c.z + Math.cos(angle) * gr, 0.12, 0.12, 2.7, C.trim, 8);
      }
      kit.cyl(c.x, y + 3.1, c.z, gr + 0.5, gr + 0.5, 0.22, C.trim, 8);
      kit.cyl(c.x, y + 3.32, c.z, 0.2, gr + 0.7, 1.5, 0x9c8d7a, 8);
      kit.sphere(c.x, y + 4.9, c.z, 0.22, C.trim, 8);
      for (let index = 0; index < 4; index++) {
        const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
        const fx = c.x + Math.sin(angle) * (plazaR + 2.6);
        const fz = c.z + Math.cos(angle) * (plazaR + 2.6);
        if (ctx.inside(fx, fz, 3)) flowerBed(fx, fz, 1.3);
      }
    } else {
      flowerBed(c.x, c.z, clamp(plazaR * 0.55, 1.2, 3));
      for (let index = 0; index < 4; index++) {
        const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
        const bx = c.x + Math.sin(angle) * (plazaR - 0.6);
        const bz = c.z + Math.cos(angle) * (plazaR - 0.6);
        bench(kit, bx, bz, angle + Math.PI, y + 0.07);
      }
    }
  } else {
    const spine = clamp(Math.min(r * 0.7, 2), 1.2, 2);
    const segments: { a: P; b: P }[] = [];
    let start: P | null = null;
    let last: P | null = null;
    for (let x = ctx.minX + 0.5; x <= ctx.maxX - 0.5; x += 1) {
      const span = spanAt(local, "x", x);
      const z = span ? (span[0] + span[1]) / 2 : c.z;
      const ok = span != null && insideBy(local, x, z, spine / 2 + 0.6);
      const point = { x, z };
      if (ok) {
        if (!start) start = point;
        last = point;
      } else if (start && last) {
        segments.push({ a: start, b: last });
        start = null;
        last = null;
      }
      if (ok && last && start && segments.length < 200 && Math.abs(point.z - start.z) > 2.5) {
        segments.push({ a: start, b: point });
        start = point;
      }
    }
    if (start && last) segments.push({ a: start, b: last });
    let walked = 0;
    segments.forEach(({ a, b }) => {
      const length = Math.hypot(b.x - a.x, b.z - a.z);
      if (length < 0.6) return;
      const ux = (b.x - a.x) / length;
      const uz = (b.z - a.z) / length;
      kit.box((a.x + b.x) / 2, y, (a.z + b.z) / 2, spine, 0.065, length + 0.6, pathColor, "solid", Math.atan2(ux, uz));
      zones.push((x, z) => distanceToSegment(x, z, a, b) < spine / 2 + 1.1);
      for (let d = 7 - (walked % 14); d < length; d += 14) {
        const px = a.x + ux * d;
        const pz = a.z + uz * d;
        const side = Math.round((walked + d) / 14) % 2 ? 1 : -1;
        const sx = px - uz * side * (spine / 2 + 0.7);
        const sz = pz + ux * side * (spine / 2 + 0.7);
        if (ctx.inside(sx, sz, 0.6)) bench(kit, sx, sz, Math.atan2(-uz * side, ux * side) + Math.PI, y);
        const lx = px + uz * side * (spine / 2 + 0.5);
        const lz = pz - ux * side * (spine / 2 + 0.5);
        if (ctx.inside(lx, lz, 0.4)) lantern(kit, lx, lz, 3.2, y);
        const fx = px + ux * 7 - uz * side * (spine / 2 + 1.6);
        const fz = pz + uz * 7 + ux * side * (spine / 2 + 1.6);
        if (ctx.inside(fx, fz, 1.4) && r > 3) flowerBed(fx, fz, 0.9);
      }
      walked += length;
    });
  }

  return {
    parts: kit.parts.solid,
    keepOut: (x, z) => {
      const point = toLocal(x, z);
      return zones.some((zone) => zone(point.x, point.z));
    },
  };
};
