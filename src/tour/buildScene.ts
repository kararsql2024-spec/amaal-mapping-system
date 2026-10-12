import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { buildPiece } from "./furniture";
import { FLOOR_STEP, WALL_HEIGHT, type TourOpening, type TourTemplate, type TourWall } from "./types";
import { WALL_THICKNESS } from "./walls";

export interface TourHotspot {
  id: string;
  mesh: THREE.Object3D;
}

const solid = (color: number) => new THREE.MeshLambertMaterial({ color });

const marbleFloor = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  const finish = () =>
    new THREE.MeshPhongMaterial({
      color: 0x000000,
      map: texture,
      emissive: 0xffffff,
      emissiveMap: texture,
      emissiveIntensity: 1,
      specular: 0xffffff,
      shininess: 86,
    });
  if (!ctx) return finish();
  ctx.fillStyle = "#f7f6f3";
  ctx.fillRect(0, 0, 512, 512);
  const veins: [string, number][] = [
    ["rgba(186,186,184,0.45)", 1.4],
    ["rgba(205,205,203,0.55)", 0.8],
    ["rgba(168,168,166,0.28)", 2.1],
  ];
  veins.forEach(([color, width], band) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    for (let line = 0; line < 5; line++) {
      const y = 40 + band * 28 + line * 96;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(90, y - 36, 180, y + 42, 270, y - 8);
      ctx.bezierCurveTo(360, y - 50, 430, y + 30, 512, y + 6);
      ctx.stroke();
    }
  });
  texture.needsUpdate = true;
  return finish();
};

const woodDoor = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  if (!ctx) return new THREE.MeshLambertMaterial({ color: 0xb08968, map: texture });
  ctx.fillStyle = "#c4a06a";
  ctx.fillRect(0, 0, 64, 128);
  for (let row = 0; row < 16; row++) {
    ctx.strokeStyle = row % 2 ? "rgba(92,58,28,0.22)" : "rgba(255,232,204,0.28)";
    ctx.beginPath();
    ctx.moveTo(0, row * 8);
    ctx.bezierCurveTo(20, row * 8 + 3, 44, row * 8 - 2, 64, row * 8 + 2);
    ctx.stroke();
  }
  texture.needsUpdate = true;
  return new THREE.MeshLambertMaterial({ map: texture });
};

const addBox = (
  parent: THREE.Object3D,
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  rotY = 0,
) => {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(w, 0.02), Math.max(h, 0.02), Math.max(d, 0.02)),
    material,
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotY;
  parent.add(mesh);
  return mesh;
};

const roomLabel = (text: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(255,252,247,0.94)";
  ctx.fillRect(16, 28, 480, 72);
  ctx.fillStyle = "#1c1917";
  ctx.font = "600 48px 'Segoe UI', Tahoma, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.slice(0, 18), 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
  sprite.scale.set(2.4, 0.6, 1);
  return sprite;
};

const segmentParts = (wall: TourWall) => {
  const parts: { ax: number; ay: number; bx: number; by: number; start: number; len: number; index: number }[] = [];
  let cursor = 0;
  for (let index = 1; index < wall.points.length; index++) {
    const start = wall.points[index - 1];
    const end = wall.points[index];
    const len = Math.hypot(end.x - start.x, end.y - start.y);
    if (len > 0.02) parts.push({ ax: start.x, ay: start.y, bx: end.x, by: end.y, start: cursor, len, index: index - 1 });
    cursor += len;
  }
  return parts;
};

const yawOf = (dx: number, dy: number) => Math.atan2(-dy, dx);

const placeRun = (
  parent: THREE.Object3D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  y: number,
  height: number,
  material: THREE.Material,
  lift = 0,
  edges?: THREE.Material,
) => {
  const len = Math.hypot(bx - ax, by - ay);
  if (len < 0.03) return;
  const mesh = addBox(parent, len, height, WALL_THICKNESS, material, (ax + bx) / 2, y + lift + height / 2, (ay + by) / 2, yawOf(bx - ax, by - ay));
  if (!edges) return;
  const source = new THREE.EdgesGeometry(mesh.geometry);
  const geometry = new LineSegmentsGeometry();
  geometry.fromEdgesGeometry(source);
  source.dispose();
  const lines = new LineSegments2(geometry, edges as LineMaterial);
  lines.renderOrder = 2;
  lines.raycast = () => undefined;
  mesh.add(lines);
};

const plasterMaterial = () => {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 4);
  if (ctx) {
    const image = ctx.createImageData(size, size);
    for (let index = 0; index < image.data.length; index += 4) {
      const grain = (Math.random() - 0.5) * 5;
      image.data[index] = 232 + grain;
      image.data[index + 1] = 233 + grain;
      image.data[index + 2] = 234 + grain;
      image.data[index + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    texture.needsUpdate = true;
  }
  return new THREE.MeshLambertMaterial({
    map: texture,
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveMap: texture,
    emissiveIntensity: 0.72,
    side: THREE.DoubleSide,
  });
};

const wallEdges = (points: { x: number; y: number }[], half: number) => {
  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  const direction = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    const len = Math.hypot(to.x - from.x, to.y - from.y) || 1;
    return { x: (to.x - from.x) / len, y: (to.y - from.y) / len };
  };
  points.forEach((point, index) => {
    const prev = index > 0 ? direction(points[index - 1], point) : null;
    const next = index < points.length - 1 ? direction(point, points[index + 1]) : null;
    const n1 = prev ? { x: -prev.y, y: prev.x } : { x: -(next?.y || 0), y: next?.x || 1 };
    const n2 = next ? { x: -next.y, y: next.x } : n1;
    let mx = n1.x + n2.x;
    let my = n1.y + n2.y;
    const span = Math.hypot(mx, my);
    if (span < 0.001) {
      mx = n1.x;
      my = n1.y;
    } else {
      mx /= span;
      my /= span;
    }
    const denom = mx * n1.x + my * n1.y;
    const scale = Math.max(-half * 4, Math.min(half * 4, half / (Math.abs(denom) < 0.25 ? 0.25 : denom)));
    left.push({ x: point.x + mx * scale, y: point.y + my * scale });
    right.push({ x: point.x - mx * scale, y: point.y - my * scale });
  });
  return { left, right };
};

const addPrism = (
  parent: THREE.Object3D,
  aL: { x: number; y: number },
  aR: { x: number; y: number },
  bR: { x: number; y: number },
  bL: { x: number; y: number },
  y: number,
  height: number,
  material: THREE.Material,
  edges?: THREE.Material,
  capStart = true,
  capEnd = true,
) => {
  const y0 = y;
  const y1 = y + height;
  const data: number[] = [];
  const corner = (point: { x: number; y: number }, yy: number) => [point.x, yy, point.y] as const;
  const face = (a: readonly [number, number, number], b: readonly [number, number, number], c: readonly [number, number, number], d: readonly [number, number, number]) => {
    data.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  };
  const topL = corner(aL, y1);
  const topR = corner(aR, y1);
  const endR = corner(bR, y1);
  const endL = corner(bL, y1);
  face(topL, endL, endR, topR);
  face(corner(aL, y0), corner(bL, y0), endL, topL);
  face(topR, endR, corner(bR, y0), corner(aR, y0));
  if (capStart) face(corner(aR, y0), topR, topL, corner(aL, y0));
  if (capEnd) face(corner(bL, y0), endL, endR, corner(bR, y0));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  parent.add(mesh);
  if (!edges) return;
  const source = new THREE.EdgesGeometry(geometry, 25);
  const lines = new LineSegmentsGeometry();
  lines.fromEdgesGeometry(source);
  source.dispose();
  const outline = new LineSegments2(lines, edges as LineMaterial);
  outline.renderOrder = 2;
  outline.raycast = () => undefined;
  mesh.add(outline);
};

const cutWall = (
  parent: THREE.Object3D,
  wall: TourWall,
  openings: TourOpening[],
  base: number,
  plaster: THREE.Material,
  wallEdge: THREE.Material,
) => {
  const outline = wallEdges(wall.points, WALL_THICKNESS / 2);
  const wood = woodDoor();
  const metal = solid(0xb7bcc2);
  const glass = new THREE.MeshLambertMaterial({ color: 0xd5dee6, transparent: true, opacity: 0.42 });
  const placeDoor = (
    kind: TourOpening["kind"],
    a: { x: number; y: number },
    b: { x: number; y: number },
    yaw: number,
    width: number,
  ) => {
    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    if (kind === "balcony") {
      const rail = WALL_HEIGHT / 2;
      const panel = new THREE.Group();
      panel.position.set(midX, base, midY);
      panel.rotation.y = yaw;
      addBox(panel, width, rail, 0.03, glass, 0, rail / 2, 0);
      addBox(panel, width, 0.04, 0.045, metal, 0, rail, 0);
      addBox(panel, 0.04, rail, 0.045, metal, -width / 2, rail / 2, 0);
      addBox(panel, 0.04, rail, 0.045, metal, width / 2, rail / 2, 0);
      parent.add(panel);
      return;
    }
    placeRun(parent, a.x, a.y, b.x, b.y, base + 2.15, WALL_HEIGHT - 2.15, plaster, 0, wallEdge);
    if (kind === "window") {
      placeRun(parent, a.x, a.y, b.x, b.y, base, 0.9, plaster, 0, wallEdge);
      addBox(parent, width * 0.9, 1.15, 0.03, glass, midX, base + 1.5, midY, yaw);
      addBox(parent, width, 0.04, 0.05, metal, midX, base + 0.92, midY, yaw);
      addBox(parent, width, 0.04, 0.05, metal, midX, base + 2.1, midY, yaw);
      return;
    }
    if (kind === "slideDoor") {
      const frame = new THREE.Group();
      frame.position.set(midX, base, midY);
      frame.rotation.y = yaw;
      addBox(frame, width, 0.06, 0.07, wood, 0, 2.12, 0);
      addBox(frame, width * 0.5, 2.02, 0.035, glass, -width * 0.24, 1.04, 0.012);
      addBox(frame, width * 0.5, 2.02, 0.035, glass, width * 0.24, 1.04, -0.012);
      addBox(frame, 0.045, 2.05, 0.06, wood, 0, 1.04, 0);
      parent.add(frame);
    } else {
      const hinge = new THREE.Group();
      hinge.position.set(a.x, base, a.y);
      hinge.rotation.y = yaw;
      const leaf = new THREE.Group();
      leaf.rotation.y = kind === "mainDoor" ? -0.42 : -0.7;
      const leafW = Math.max(width - 0.06, 0.35);
      addBox(leaf, leafW, 2.05, 0.045, wood, leafW / 2, 1.04, 0);
      if (kind === "mainDoor") addBox(leaf, leafW * 0.46, 0.62, 0.02, glass, leafW * 0.5, 1.45, 0.03);
      addBox(leaf, 0.03, 0.12, 0.04, metal, leafW - 0.12, 1.0, 0.04);
      hinge.add(leaf);
      parent.add(hinge);
    }
  };
  segmentParts(wall).forEach((segment) => {
    const end = segment.start + segment.len;
    const cuts = openings
      .map((opening) => ({ ...opening, from: opening.at - opening.width / 2, to: opening.at + opening.width / 2 }))
      .filter((opening) => opening.to > segment.start + 0.02 && opening.from < end - 0.02)
      .sort((a, b) => a.from - b.from);
    const pointAt = (along: number) => {
      const t = (along - segment.start) / segment.len;
      return { x: segment.ax + (segment.bx - segment.ax) * t, y: segment.ay + (segment.by - segment.ay) * t };
    };
    let cursor = segment.start;
    const mix = (from: { x: number; y: number }, to: { x: number; y: number }, t: number) => ({
      x: from.x + (to.x - from.x) * t,
      y: from.y + (to.y - from.y) * t,
    });
    const emitSolid = (from: number, to: number) => {
      if (to - from < 0.05) return;
      const t0 = (from - segment.start) / segment.len;
      const t1 = (to - segment.start) / segment.len;
      const capStart = !(Math.abs(from - segment.start) < 0.02 && segment.index > 0);
      const capEnd = !(Math.abs(to - end) < 0.02 && segment.index < wall.points.length - 2);
      addPrism(
        parent,
        mix(outline.left[segment.index], outline.left[segment.index + 1], t0),
        mix(outline.right[segment.index], outline.right[segment.index + 1], t0),
        mix(outline.right[segment.index], outline.right[segment.index + 1], t1),
        mix(outline.left[segment.index], outline.left[segment.index + 1], t1),
        base,
        WALL_HEIGHT,
        plaster,
        wallEdge,
        capStart,
        capEnd,
      );
    };
    cuts.forEach((cut) => {
      const from = Math.max(cut.from, segment.start);
      const to = Math.min(cut.to, end);
      emitSolid(cursor, from);
      const a = pointAt(from);
      const b = pointAt(to);
      const yaw = yawOf(b.x - a.x, b.y - a.y);
      const width = Math.max(to - from, 0.2);
      placeDoor(cut.kind, a, b, yaw, width);
      cursor = to;
    });
    emitSolid(cursor, end);
  });
};

export const buildTourScene = (tour: TourTemplate, floor: number | "all") => {
  const root = new THREE.Group();
  const hotspots: TourHotspot[] = [];
  const show = (level: number) => floor === "all" || floor === level;
  const floorMaterial = marbleFloor();
  const plaster = plasterMaterial();
  const wallEdge = new LineMaterial({
    color: 0x2a2e32,
    linewidth: 2.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  wallEdge.resolution.set(window.innerWidth, window.innerHeight);
  root.userData.wallEdge = wallEdge;
  let focusMinX = Infinity;
  let focusMaxX = -Infinity;
  let focusMinY = Infinity;
  let focusMaxY = -Infinity;

  const footprint = (level: number) => {
    const xs: number[] = [];
    const ys: number[] = [];
    (tour.walls || []).filter((wall) => wall.floor === level && wall.points.length > 1).forEach((wall) => wall.points.forEach((point) => {
      xs.push(point.x);
      ys.push(point.y);
    }));
    if (!xs.length) {
      (tour.items || []).filter((item) => item.floor === level).forEach((item) => {
        xs.push(item.x);
        ys.push(item.y);
      });
    }
    if (!xs.length) return null;
    const pad = 0.7;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cz: (minY + maxY) / 2 };
  };

  for (let level = 1; level <= tour.floors; level++) {
    if (!show(level)) continue;
    const occupied =
      (tour.walls || []).some((wall) => wall.floor === level && wall.points.length > 1) ||
      (tour.items || []).some((item) => item.floor === level) ||
      (tour.openings || []).some((opening) => opening.floor === level);
    if (floor === "all" && level > 1 && !occupied) continue;
    const box = footprint(level);
    if (!box) continue;
    focusMinX = Math.min(focusMinX, box.minX);
    focusMaxX = Math.max(focusMaxX, box.maxX);
    focusMinY = Math.min(focusMinY, box.minY);
    focusMaxY = Math.max(focusMaxY, box.maxY);
    const slabMaterial = floor === "all" && level > 1 ? floorMaterial.clone() : floorMaterial;
    if (slabMaterial !== floorMaterial) {
      slabMaterial.transparent = true;
      slabMaterial.opacity = 0.22;
      slabMaterial.depthWrite = false;
    }
    const slab = new THREE.Mesh(new THREE.BoxGeometry(Math.max(box.maxX - box.minX, 1), 0.08, Math.max(box.maxY - box.minY, 1)), slabMaterial);
    slab.position.set(box.cx, (level - 1) * FLOOR_STEP - 0.04, box.cz);
    root.add(slab);
    const ceiling = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(box.maxX - box.minX, 1), 0.05, Math.max(box.maxY - box.minY, 1)),
      new THREE.MeshBasicMaterial({ color: 0xe4e6e8 }),
    );
    ceiling.position.set(box.cx, (level - 1) * FLOOR_STEP + WALL_HEIGHT, box.cz);
    ceiling.visible = false;
    ceiling.userData.ceiling = true;
    ceiling.userData.ceilingFloor = level;
    root.add(ceiling);
  }
  if (Number.isFinite(focusMinX)) {
    root.userData.focus = { x: (focusMinX + focusMaxX) / 2, z: (focusMinY + focusMaxY) / 2 };
  }

  (tour.walls || []).forEach((wall) => {
    if (!show(wall.floor) || wall.points.length < 2) return;
    const openings = (tour.openings || []).filter((opening) => opening.wallId === wall.id && opening.floor === wall.floor);
    cutWall(root, wall, openings, (wall.floor - 1) * FLOOR_STEP, plaster, wallEdge);
  });

  (tour.items || []).forEach((item) => {
    if (!show(item.floor)) return;
    const base = (item.floor - 1) * FLOOR_STEP;
    const scale = item.scale || 1;
    if (item.kind === "text") {
      const group = new THREE.Group();
      const canvas = document.createElement("canvas");
      canvas.width = 512;
      canvas.height = 128;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#1c1917";
        ctx.font = "600 64px 'Segoe UI', Tahoma, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((item.label || "نص").slice(0, 24), 256, 64);
      }
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(Math.max(item.w * scale, 0.4), Math.max(item.h * scale, 0.2)),
        new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
      );
      mesh.rotation.x = -Math.PI / 2;
      group.add(mesh);
      group.position.set(item.x, base + 0.05, item.y);
      group.rotation.y = -((item.rot || 0) * Math.PI) / 180;
      root.add(group);
      return;
    }
    if (item.kind === "room") {
      addBox(root, item.w * scale, 0.025, item.h * scale, solid(0xe4e4e2), item.x, base + 0.03, item.y, -((item.rot || 0) * Math.PI) / 180);
      const label = roomLabel(item.label || "غرفة");
      if (label) {
        label.position.set(item.x, base + 0.25, item.y);
        root.add(label);
      }
      return;
    }
    if (item.kind === "balcony") {
      const group = new THREE.Group();
      const glass = new THREE.MeshLambertMaterial({ color: 0xd5dee6, transparent: true, opacity: 0.42 });
      addBox(group, item.w, WALL_HEIGHT / 2, 0.03, glass, 0, WALL_HEIGHT / 4, 0);
      addBox(group, item.w, 0.04, 0.045, solid(0xb7bcc2), 0, WALL_HEIGHT / 2, 0);
      group.position.set(item.x, base, item.y);
      group.rotation.y = -((item.rot || 0) * Math.PI) / 180;
      group.scale.setScalar(scale);
      root.add(group);
      return;
    }
    if (item.kind === "stairs") {
      const group = new THREE.Group();
      for (let step = 0; step < 10; step++) {
        addBox(group, 1.05, 0.16, 0.28, solid(step % 2 ? 0xf2f2f0 : 0xd8d8d6), 0, 0.12 + step * 0.18, -1.2 + step * 0.28);
      }
      group.position.set(item.x, base, item.y);
      group.rotation.y = -((item.rot || 0) * Math.PI) / 180;
      group.scale.setScalar(scale);
      root.add(group);
      return;
    }
    if (item.kind === "furniture" && item.piece) {
      const group = buildPiece(item.piece);
      group.position.set(item.x, base, item.y);
      group.rotation.y = -((item.rot || 0) * Math.PI) / 180;
      group.scale.setScalar(scale);
      root.add(group);
      return;
    }
    if (item.kind === "hotspot") {
      const marker = new THREE.Group();
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 8, 20), new THREE.MeshBasicMaterial({ color: 0x3a3a38 }));
      ring.rotation.x = Math.PI / 2;
      const pick = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 20),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      pick.rotation.x = -Math.PI / 2;
      pick.position.y = 0.02;
      marker.add(ring, pick);
      marker.position.set(item.x, base + 0.08, item.y);
      marker.userData.hotspotId = item.id;
      ring.userData.hotspotId = item.id;
      pick.userData.hotspotId = item.id;
      const label = roomLabel(item.label || "نقطة");
      if (label) {
        label.position.set(0, 1.07, 0);
        label.userData.hotspotId = item.id;
        marker.add(label);
      }
      root.add(marker);
      hotspots.push({ id: item.id, mesh: marker });
    }
  });

  return { root, hotspots };
};
