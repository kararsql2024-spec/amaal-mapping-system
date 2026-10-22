import * as THREE from "three";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { buildPiece } from "./furniture";
import { buildSwitchback, stairOutline } from "./stairs";
import { FLOOR_STEP, WALL_HEIGHT, type TourItem, type TourOpening, type TourTemplate, type TourWall } from "./types";
import { WALL_THICKNESS } from "./walls";

export interface TourHotspot {
  id: string;
  mesh: THREE.Object3D;
}

const solid = (color: number, roughness = 0.66, metalness = 0.02) =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness });

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
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: texture,
      roughness: 0.24,
      metalness: 0,
      clearcoat: 0.32,
      clearcoatRoughness: 0.18,
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
  if (!ctx) return new THREE.MeshStandardMaterial({ color: 0xb08968, map: texture, roughness: 0.54 });
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
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.52 });
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
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const stairWells = (items: TourItem[], level: number, box: { minX: number; maxX: number; minY: number; maxY: number }) =>
  items
    .filter((item) => item.kind === "stairs" && item.floor === level && (item.points?.length || 0) >= 4)
    .map((item) => stairOutline(item.points || []))
    .filter((ring): ring is { x: number; y: number }[] => {
      if (!ring || ring.length < 3) return false;
      const cx = ring.reduce((sum, point) => sum + point.x, 0) / ring.length;
      const cy = ring.reduce((sum, point) => sum + point.y, 0) / ring.length;
      return cx > box.minX && cx < box.maxX && cy > box.minY && cy < box.maxY;
    });

const plateMesh = (
  box: { minX: number; maxX: number; minY: number; maxY: number },
  holes: { x: number; y: number }[][],
  material: THREE.Material,
  y: number,
  thickness: number,
) => {
  const shape = new THREE.Shape();
  shape.moveTo(box.minX, box.minY);
  shape.lineTo(box.maxX, box.minY);
  shape.lineTo(box.maxX, box.maxY);
  shape.lineTo(box.minX, box.maxY);
  shape.closePath();
  holes.forEach((ring) => {
    if (ring.length < 3) return;
    const path = new THREE.Path();
    const wound = ring.slice().reverse();
    wound.forEach((point, index) => {
      if (index === 0) path.moveTo(point.x, point.y);
      else path.lineTo(point.x, point.y);
    });
    path.closePath();
    shape.holes.push(path);
  });
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
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
      const grain = ((((index / 4) * 73) % 29) / 29 - 0.5) * 5;
      image.data[index] = 232 + grain;
      image.data[index + 1] = 233 + grain;
      image.data[index + 2] = 234 + grain;
      image.data[index + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    texture.needsUpdate = true;
  }
  return new THREE.MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0,
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
  const metal = solid(0xaeb4b8, 0.24, 0.78);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xcfe0e6,
    transparent: true,
    opacity: 0.42,
    roughness: 0.08,
    metalness: 0,
    transmission: 0.22,
    thickness: 0.03,
    side: THREE.DoubleSide,
  });
  const placeDoor = (
    kind: TourOpening["kind"],
    a: { x: number; y: number },
    b: { x: number; y: number },
    yaw: number,
    width: number,
    side?: number,
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
    const header = kind === "outerDoor" ? 2.5 : 2.15;
    placeRun(parent, a.x, a.y, b.x, b.y, base + header, Math.max(WALL_HEIGHT - header, 0.08), plaster, 0, wallEdge);
    if (kind === "window") {
      placeRun(parent, a.x, a.y, b.x, b.y, base, 0.9, plaster, 0, wallEdge);
      addBox(parent, width * 0.9, 1.15, 0.03, glass, midX, base + 1.5, midY, yaw);
      addBox(parent, width, 0.04, 0.05, metal, midX, base + 0.92, midY, yaw);
      addBox(parent, width, 0.04, 0.05, metal, midX, base + 2.1, midY, yaw);
      const ux = Math.cos(yaw);
      const uz = -Math.sin(yaw);
      [-1, 1].forEach((side) => {
        addBox(parent, 0.045, 1.2, 0.055, metal, midX + ux * side * width * 0.48, base + 1.51, midY + uz * side * width * 0.48, yaw);
      });
      addBox(parent, 0.04, 1.14, 0.05, metal, midX, base + 1.5, midY, yaw);
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
    } else if (kind === "outerDoor") {
      const group = new THREE.Group();
      group.position.set(midX, base, midY);
      group.rotation.y = yaw;
      const out = (side ?? 1) >= 0 ? 1 : -1;
      const frameMat = solid(0xf4f1ea);
      const leafMat = solid(0x6e5344);
      const panelMat = solid(0x8d6b4c);
      const brass = solid(0xc4a66d, 0.2, 0.72);
      const leafW = Math.max((width - 0.14) / 2, 0.7);
      const leafH = 2.32;
      addBox(group, 0.09, leafH + 0.1, 0.14, frameMat, -width / 2, leafH / 2, 0);
      addBox(group, 0.09, leafH + 0.1, 0.14, frameMat, width / 2, leafH / 2, 0);
      addBox(group, width + 0.1, 0.12, 0.16, frameMat, 0, leafH + 0.02, 0);
      [-1, 1].forEach((sign) => {
        const hinge = new THREE.Group();
        hinge.position.set(sign * (width / 2 - 0.05), 0, 0);
        const leaf = new THREE.Group();
        leaf.rotation.y = -sign * 0.22 * out;
        const dir = -sign;
        addBox(leaf, leafW, leafH, 0.05, leafMat, dir * leafW / 2, leafH / 2, 0);
        addBox(leaf, leafW * 0.7, 0.72, 0.02, panelMat, dir * leafW * 0.5, 0.55, 0.032);
        addBox(leaf, leafW * 0.7, 0.58, 0.02, panelMat, dir * leafW * 0.5, 1.5, 0.032);
        const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.2, 12), brass);
        handle.rotation.z = Math.PI / 2;
        handle.position.set(dir * (leafW - 0.12), 1.12, 0.05);
        leaf.add(handle);
        hinge.add(leaf);
        group.add(hinge);
      });
      addBox(group, width, 0.08, 0.55, solid(0xe4e0d8), 0, 0.04, out * 0.34);
      parent.add(group);
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
      const trimA = pointAt(from);
      const trimB = pointAt(to);
      placeRun(parent, trimA.x, trimA.y, trimB.x, trimB.y, base + 0.012, 0.075, solid(0xd8d2c7, 0.54), WALL_THICKNESS / 2 + 0.012);
    };
    cuts.forEach((cut) => {
      const from = Math.max(cut.from, segment.start);
      const to = Math.min(cut.to, end);
      emitSolid(cursor, from);
      const a = pointAt(from);
      const b = pointAt(to);
      const yaw = yawOf(b.x - a.x, b.y - a.y);
    const width = Math.max(to - from, 0.2);
    placeDoor(cut.kind, a, b, yaw, width, cut.side);
      cursor = to;
    });
    emitSolid(cursor, end);
  });
};

const grassTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  if (!ctx) return texture;
  ctx.fillStyle = "#6d9a4e";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const tone = i % 3;
    ctx.fillStyle = tone === 0 ? "#4f7a38" : tone === 1 ? "#8fb56c" : "#5e8a42";
    ctx.fillRect((i * 53) % 256, (i * 97) % 256, 2, (i % 6) + 3);
  }
  for (let i = 0; i < 120; i++) {
    ctx.strokeStyle = i % 2 ? "rgba(63,104,46,0.55)" : "rgba(168,196,120,0.45)";
    ctx.beginPath();
    const x = (i * 41) % 256;
    const y = (i * 67) % 256;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 1, y - 7);
    ctx.stroke();
  }
  texture.needsUpdate = true;
  return texture;
};

const addGarden = (parent: THREE.Object3D, points: { x: number; y: number }[], base: number) => {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) shape.moveTo(point.x, point.y);
    else shape.lineTo(point.x, point.y);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: false });
  geometry.rotateX(Math.PI / 2);
  const position = geometry.attributes.position;
  const uv = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index++) {
    uv[index * 2] = position.getX(index) / 1.1;
    uv[index * 2 + 1] = position.getZ(index) / 1.1;
  }
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  const map = grassTexture();
  const lawn = new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ map, color: 0xffffff, roughness: 0.98, metalness: 0 }),
  );
  lawn.receiveShadow = true;
  lawn.position.y = base + 0.08;
  parent.add(lawn);
  const stone = solid(0xd9d3c8);
  const cap = solid(0xf3f0ea);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const dx = next.x - point.x;
    const dy = next.y - point.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.25) return;
    const yaw = Math.atan2(-dy, dx);
    const curb = new THREE.Mesh(new THREE.BoxGeometry(len, 0.16, 0.12), stone);
    curb.position.set((point.x + next.x) / 2, base + 0.1, (point.y + next.y) / 2);
    curb.rotation.y = yaw;
    const lip = new THREE.Mesh(new THREE.BoxGeometry(len, 0.04, 0.16), cap);
    lip.position.set((point.x + next.x) / 2, base + 0.2, (point.y + next.y) / 2);
    lip.rotation.y = yaw;
    parent.add(curb, lip);
  });
  const cx = points.reduce((sum, point) => sum + point.x, 0) / points.length;
  const cy = points.reduce((sum, point) => sum + point.y, 0) / points.length;
  let area = 0;
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    area += point.x * next.y - next.x * point.y;
  });
  area = Math.abs(area) / 2;
  const spots = Math.min(6, Math.max(2, Math.round(area / 7)));
  const leaf = solid(0x789765, 0.9);
  const leafDeep = solid(0x4f7048, 0.94);
  const trunk = solid(0x72533d, 0.88);
  const bloom = solid(0xd8b9a6, 0.78);
  for (let index = 0; index < spots; index++) {
    const anchor = points[index % points.length];
    const x = cx + (anchor.x - cx) * (0.35 + (index % 3) * 0.12);
    const z = cy + (anchor.y - cy) * (0.35 + (index % 3) * 0.12);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.42, 12), trunk);
    stem.position.set(x, base + 0.28, z);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.28 + (index % 3) * 0.05, 18, 14), index % 2 ? leaf : leafDeep);
    crown.position.set(x, base + 0.62, z);
    const side = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), leaf);
    side.position.set(x + 0.16, base + 0.5, z + 0.08);
    stem.castShadow = true;
    crown.castShadow = true;
    side.castShadow = true;
    parent.add(stem, crown, side);
    if (index % 2 === 0) {
      const flower = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), bloom);
      flower.position.set(x - 0.22, base + 0.1, z + 0.18);
      flower.castShadow = true;
      parent.add(flower);
    }
  }
  if (area > 16) {
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 1.15, 14), trunk);
    stem.position.set(cx, base + 0.7, cy);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 16), leafDeep);
    crown.position.set(cx, base + 1.45, cy);
    const crown2 = new THREE.Mesh(new THREE.SphereGeometry(0.38, 18, 14), leaf);
    crown2.position.set(cx + 0.22, base + 1.25, cy - 0.1);
    stem.castShadow = true;
    crown.castShadow = true;
    crown2.castShadow = true;
    parent.add(stem, crown, crown2);
  }
};

export const buildTourScene = (tour: TourTemplate, floor: number | "all") => {
  const root = new THREE.Group();
  const hotspots: TourHotspot[] = [];
  const show = (level: number) => floor === "all" || floor === level;
  const floorMaterial = marbleFloor();
  const plaster = plasterMaterial();
  const wallEdge = new LineMaterial({
    color: 0x77736d,
    linewidth: 1.15,
    transparent: true,
    opacity: 0.48,
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
    (tour.items || []).filter((item) => item.kind === "stairs" && item.floor === level - 1 && (item.points?.length || 0) >= 4).forEach((item) => {
      stairOutline(item.points || [])?.forEach((point) => {
        xs.push(point.x);
        ys.push(point.y);
      });
    });
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
    const openingsBelow = stairWells(tour.items || [], level - 1, box);
    const slab = plateMesh(box, openingsBelow, slabMaterial, (level - 1) * FLOOR_STEP, 0.08);
    root.add(slab);
    const openingsHere = stairWells(tour.items || [], level, box);
    const ceiling = plateMesh(
      box,
      openingsHere,
      new THREE.MeshStandardMaterial({ color: 0xf0efeb, roughness: 0.9, side: THREE.DoubleSide }),
      (level - 1) * FLOOR_STEP + (level < tour.floors ? WALL_HEIGHT - 0.09 : WALL_HEIGHT + 0.025),
      0.05,
    );
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
    const stairShown = item.kind === "stairs" && (show(item.floor) || show(item.floor + 1));
    if (!stairShown && !show(item.floor)) return;
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
      const glass = new THREE.MeshPhysicalMaterial({
        color: 0xcfe0e6,
        transparent: true,
        opacity: 0.42,
        roughness: 0.08,
        transmission: 0.2,
        thickness: 0.025,
      });
      addBox(group, item.w, WALL_HEIGHT / 2, 0.03, glass, 0, WALL_HEIGHT / 4, 0);
      addBox(group, item.w, 0.04, 0.045, solid(0xb7bcc2), 0, WALL_HEIGHT / 2, 0);
      group.position.set(item.x, base, item.y);
      group.rotation.y = -((item.rot || 0) * Math.PI) / 180;
      group.scale.setScalar(scale);
      root.add(group);
      return;
    }
    if (item.kind === "stairs" && item.points && item.points.length >= 4) {
      buildSwitchback(root, item.points, base);
      return;
    }
    if (item.kind === "garden" && item.points && item.points.length >= 3) {
      addGarden(root, item.points, base);
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
