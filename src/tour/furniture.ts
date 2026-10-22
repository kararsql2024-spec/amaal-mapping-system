import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { PieceId } from "./types";

const material = (color: number, finish: "fabric" | "wood" | "metal" | "ceramic" | "matte" = "matte") => {
  const settings = {
    fabric: { roughness: 0.92, metalness: 0 },
    wood: { roughness: 0.62, metalness: 0 },
    metal: { roughness: 0.24, metalness: 0.82 },
    ceramic: { roughness: 0.18, metalness: 0 },
    matte: { roughness: 0.72, metalness: 0.02 },
  }[finish];
  return new THREE.MeshStandardMaterial({ color, ...settings });
};

const finishOf = (color: number): Parameters<typeof material>[1] => {
  if ([0x243038, 0x2a2622].includes(color)) return "metal";
  if ([0xf7f4ee, 0xf3f0e8, 0xd5ddd8].includes(color)) return "ceramic";
  if ([0xc4b59a, 0xb3a288, 0xf2d6cf].includes(color)) return "fabric";
  if ([0xc4b5a0, 0xd8c7b0, 0xe7d8c4, 0x8a7560].includes(color)) return "wood";
  return "matte";
};

const box = (
  parent: THREE.Group,
  w: number,
  h: number,
  d: number,
  color: number,
  x: number,
  y: number,
  z: number,
) => {
  const radius = Math.min(0.055, w * 0.12, h * 0.22, d * 0.12);
  const geometry = radius > 0.008
    ? new RoundedBoxGeometry(w, h, d, 3, radius)
    : new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geometry, material(color, finishOf(color)));
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const cylinder = (
  parent: THREE.Group,
  radius: number,
  height: number,
  color: number,
  x: number,
  y: number,
  z: number,
  rotation: "x" | "z" | null = null,
  finish: Parameters<typeof material>[1] = "metal",
) => {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 20), material(color, finish));
  if (rotation === "x") mesh.rotation.x = Math.PI / 2;
  if (rotation === "z") mesh.rotation.z = Math.PI / 2;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
};

const sphere = (parent: THREE.Group, radius: number, color: number, x: number, y: number, z: number, sy = 1) => {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 20, 14), material(color, "matte"));
  mesh.scale.y = sy;
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
};

const shadow = (parent: THREE.Group, w: number, d: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const paint = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  paint.addColorStop(0, "rgba(40,32,24,0.28)");
  paint.addColorStop(1, "rgba(40,32,24,0)");
  ctx.fillStyle = paint;
  ctx.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, d),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.025;
  parent.add(mesh);
};

const rugTexture = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "#c9b59a";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#8d7358";
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 108, 108);
  ctx.fillStyle = "#d8c6ae";
  ctx.fillRect(22, 22, 84, 84);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

export const buildPiece = (piece: PieceId) => {
  const group = new THREE.Group();
  if (piece === "sofa") {
    shadow(group, 2.3, 1.1);
    box(group, 2.1, 0.36, 0.82, 0xc4b59a, 0, 0.28, 0.04);
    box(group, 2.1, 0.48, 0.16, 0xb3a288, 0, 0.62, -0.36);
    box(group, 0.14, 0.42, 0.82, 0xb3a288, -0.98, 0.42, 0.04);
    box(group, 0.14, 0.42, 0.82, 0xb3a288, 0.98, 0.42, 0.04);
    [-0.5, 0, 0.5].forEach((x) => box(group, 0.58, 0.1, 0.58, 0xd0c2a9, x, 0.49, 0.09));
    [-0.58, 0.58].forEach((x) => box(group, 0.12, 0.12, 0.12, 0x5e4b3e, x, 0.08, -0.27));
  } else if (piece === "armchair") {
    shadow(group, 1, 1);
    box(group, 0.72, 0.34, 0.72, 0xc4b59a, 0, 0.26, 0.04);
    box(group, 0.72, 0.42, 0.12, 0xb3a288, 0, 0.52, -0.3);
    box(group, 0.1, 0.36, 0.72, 0xb3a288, -0.31, 0.36, 0.04);
    box(group, 0.1, 0.36, 0.72, 0xb3a288, 0.31, 0.36, 0.04);
  } else if (piece === "coffee") {
    shadow(group, 1.2, 0.75);
    box(group, 1.0, 0.06, 0.52, 0xd8c7b0, 0, 0.38, 0);
    box(group, 0.06, 0.34, 0.06, 0xc4b5a0, -0.42, 0.18, -0.2);
    box(group, 0.06, 0.34, 0.06, 0xc4b5a0, 0.42, 0.18, -0.2);
    box(group, 0.06, 0.34, 0.06, 0xc4b5a0, -0.42, 0.18, 0.2);
    box(group, 0.06, 0.34, 0.06, 0xc4b5a0, 0.42, 0.18, 0.2);
    cylinder(group, 0.11, 0.035, 0xc4b5a0, 0.2, 0.43, 0.02, null, "ceramic");
  } else if (piece === "doubleBed" || piece === "singleBed" || piece === "kidsBed") {
    const width = piece === "doubleBed" ? 1.6 : piece === "kidsBed" ? 0.8 : 0.95;
    const length = piece === "kidsBed" ? 1.5 : 2;
    const linen = piece === "kidsBed" ? 0xf2d6cf : 0xf7f4ee;
    shadow(group, width + 0.4, length + 0.3);
    box(group, width, 0.22, length, 0xc4b5a0, 0, 0.2, 0);
    box(group, width - 0.08, 0.16, length - 0.16, linen, 0, 0.38, 0.04);
    box(group, width - 0.16, 0.1, 0.28, 0xe7e2d6, 0, 0.5, -length * 0.36);
    box(group, width, 0.5, 0.08, 0xd5cdc0, 0, 0.52, -length * 0.48);
    box(group, width - 0.18, 0.045, length * 0.52, piece === "kidsBed" ? 0xe8b9ad : 0xcab7a0, 0, 0.49, length * 0.18);
  } else if (piece === "wardrobe" || piece === "kidsShelf") {
    const width = piece === "kidsShelf" ? 0.85 : 1.7;
    const height = piece === "kidsShelf" ? 1.15 : 2.05;
    const depth = piece === "kidsShelf" ? 0.32 : 0.52;
    shadow(group, width + 0.2, depth + 0.3);
    box(group, width, height, depth, piece === "kidsShelf" ? 0xf0e2d4 : 0xe7e1d4, 0, height / 2, 0);
    if (piece === "kidsShelf") {
      box(group, width - 0.08, 0.04, depth + 0.02, 0xd8c7b0, 0, 0.4, 0);
      box(group, width - 0.08, 0.04, depth + 0.02, 0xd8c7b0, 0, 0.78, 0);
      [-0.25, 0, 0.25].forEach((x, index) => box(group, 0.12, 0.24 + index * 0.03, 0.22, 0xb99b7c + index * 0x080402, x, 0.16, 0.03));
    } else {
      box(group, 0.025, height * 0.9, depth + 0.012, 0xc4b5a0, 0, height / 2, 0.01);
      [-0.08, 0.08].forEach((x) => cylinder(group, 0.015, 0.15, 0xa58964, x, height * 0.52, depth / 2 + 0.018, null, "metal"));
    }
  } else if (piece === "dining") {
    shadow(group, 2, 1.6);
    box(group, 1.5, 0.06, 0.85, 0xd8c7b0, 0, 0.74, 0);
    box(group, 0.08, 0.7, 0.08, 0xc4b5a0, -0.6, 0.36, -0.32);
    box(group, 0.08, 0.7, 0.08, 0xc4b5a0, 0.6, 0.36, -0.32);
    box(group, 0.08, 0.7, 0.08, 0xc4b5a0, -0.6, 0.36, 0.32);
    box(group, 0.08, 0.7, 0.08, 0xc4b5a0, 0.6, 0.36, 0.32);
    [-0.45, 0.45].forEach((x) => {
      box(group, 0.34, 0.42, 0.34, 0xc4b59a, x, 0.42, 0.62);
      box(group, 0.34, 0.42, 0.34, 0xc4b59a, x, 0.42, -0.62);
    });
    cylinder(group, 0.16, 0.025, 0xd9d0c5, 0, 0.79, 0, null, "ceramic");
  } else if (piece === "kitchen") {
    shadow(group, 2.7, 0.9);
    box(group, 2.5, 0.88, 0.6, 0xf3f0e8, 0, 0.46, 0);
    box(group, 2.5, 0.04, 0.62, 0xd5ddd8, 0, 0.92, 0);
    box(group, 2.4, 0.55, 0.32, 0xe7e2d6, 0, 1.85, -0.12);
    [-0.82, -0.27, 0.27, 0.82].forEach((x) => {
      box(group, 0.018, 0.72, 0.012, 0xc8c0b5, x, 0.48, 0.306);
      cylinder(group, 0.012, 0.16, 0x8c918f, x + 0.17, 0.55, 0.32, "z");
    });
    [-0.65, -0.25].forEach((x) => cylinder(group, 0.105, 0.018, 0x292b2c, x, 0.955, 0.08, null, "metal"));
    const tap = cylinder(group, 0.018, 0.3, 0x8c918f, 0.62, 1.08, -0.04, null, "metal");
    tap.rotation.z = -0.45;
  } else if (piece === "bathroom") {
    shadow(group, 1.8, 1.4);
    box(group, 0.7, 0.42, 0.48, 0xf7f4ee, -0.4, 0.4, -0.3);
    box(group, 0.55, 0.15, 0.7, 0xf7f4ee, 0.45, 0.2, 0.2);
    box(group, 0.08, 1.1, 0.7, 0xe7e2d6, 0.78, 0.7, 0.2);
    cylinder(group, 0.17, 0.04, 0xc7d4d7, -0.4, 0.62, -0.3, null, "ceramic");
    cylinder(group, 0.018, 0.32, 0x9aa2a2, -0.4, 0.82, -0.38, null, "metal");
  } else if (piece === "rug") {
    const texture = rugTexture();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(2.1, 0.02, 1.4),
      texture ? new THREE.MeshLambertMaterial({ map: texture }) : material(0xc9b59a),
    );
    mesh.position.y = 0.02;
    group.add(mesh);
  } else if (piece === "tv") {
    shadow(group, 1.7, 0.55);
    box(group, 1.4, 0.32, 0.35, 0xe7e1d4, 0, 0.2, 0);
    box(group, 1.25, 0.72, 0.05, 0x243038, 0, 0.85, -0.02);
    box(group, 0.08, 0.16, 0.08, 0xc4b5a0, 0, 0.42, 0);
    box(group, 1.12, 0.59, 0.008, 0x11181c, 0, 0.85, -0.051);
  } else if (piece === "toyBox") {
    shadow(group, 0.85, 0.55);
    box(group, 0.64, 0.32, 0.4, 0xe7c1a8, 0, 0.18, 0);
    box(group, 0.66, 0.05, 0.42, 0xd8b090, 0, 0.36, 0);
  } else if (piece === "car") {
    shadow(group, 4.4, 2);
    box(group, 3.75, 0.5, 1.58, 0x637668, 0, 0.56, 0);
    box(group, 2.0, 0.52, 1.4, 0x4e6257, -0.12, 1.0, 0);
    box(group, 0.72, 0.39, 1.31, 0x9eb6bd, 0.18, 1.03, 0);
    [-1.2, 1.2].forEach((x) => {
      [-0.72, 0.72].forEach((z) => {
        cylinder(group, 0.27, 0.18, 0x202326, x, 0.3, z, "x", "matte");
        cylinder(group, 0.12, 0.19, 0xa7aaab, x, 0.3, z, "x", "metal");
      });
    });
    [-0.52, 0.52].forEach((z) => box(group, 0.38, 0.16, 0.03, 0xffe6b2, 1.89, 0.64, z));
  } else if (piece === "garden") {
    const lawn = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.06, 3), material(0xc9d4bc));
    lawn.position.y = 0.04;
    group.add(lawn);
    box(group, 0.18, 0.7, 0.18, 0x8a7560, -1.2, 0.4, 0.4);
    box(group, 0.9, 0.7, 0.9, 0x9aaf86, -1.2, 1.05, 0.4);
    box(group, 0.7, 0.45, 0.7, 0xa8b992, 1.1, 0.3, -0.6);
    box(group, 0.55, 0.35, 0.55, 0xb7c6a8, 0.4, 0.22, 0.8);
  } else if (piece === "desk") {
    shadow(group, 1.6, 0.85);
    box(group, 1.35, 0.05, 0.6, 0xe7d8c4, 0, 0.74, 0);
    box(group, 0.05, 0.7, 0.5, 0xd8c7b0, -0.6, 0.36, 0);
    box(group, 0.05, 0.7, 0.5, 0xd8c7b0, 0.6, 0.36, 0);
  } else if (piece === "officeChair") {
    shadow(group, 0.7, 0.7);
    box(group, 0.46, 0.08, 0.46, 0xc4b59a, 0, 0.46, 0);
    box(group, 0.46, 0.42, 0.06, 0xb3a288, 0, 0.7, -0.2);
    box(group, 0.06, 0.42, 0.06, 0xc4b5a0, 0, 0.22, 0);
    cylinder(group, 0.035, 0.28, 0x4f5354, 0, 0.22, 0, null, "metal");
    for (let spoke = 0; spoke < 5; spoke++) {
      const angle = spoke * Math.PI * 0.4;
      const leg = box(group, 0.28, 0.025, 0.035, 0x4f5354, Math.cos(angle) * 0.12, 0.08, Math.sin(angle) * 0.12);
      leg.rotation.y = -angle;
    }
  } else if (piece === "nightstand") {
    shadow(group, 0.65, 0.55);
    box(group, 0.46, 0.48, 0.38, 0xe7e1d4, 0, 0.26, 0);
    box(group, 0.38, 0.018, 0.012, 0xc8c0b5, 0, 0.28, 0.196);
    cylinder(group, 0.012, 0.1, 0xa58964, 0, 0.38, 0.21, "z");
  } else if (piece === "bookshelf") {
    shadow(group, 1.05, 0.45);
    box(group, 0.86, 1.7, 0.28, 0xe7e1d4, 0, 0.88, 0);
    box(group, 0.78, 0.03, 0.26, 0xd8c7b0, 0, 0.55, 0.02);
    box(group, 0.78, 0.03, 0.26, 0xd8c7b0, 0, 1.05, 0.02);
    [0.2, 0.72, 1.25].forEach((y, row) => {
      [-0.25, -0.08, 0.12, 0.29].forEach((x, index) => box(group, 0.11, 0.25 + ((row + index) % 3) * 0.05, 0.18, [0x9b6d55, 0x6f7c70, 0xb09a78, 0x6f7783][index], x, y + 0.13, -0.15));
    });
  } else if (piece === "dresser") {
    shadow(group, 1.4, 0.65);
    box(group, 1.15, 0.72, 0.44, 0xf3f0e8, 0, 0.38, 0);
    box(group, 0.7, 0.55, 0.03, 0xd5ddd8, 0, 1.15, -0.2);
    [0.22, 0.43, 0.64].forEach((y) => {
      box(group, 1.0, 0.012, 0.012, 0xc8c0b5, 0, y, 0.226);
      cylinder(group, 0.012, 0.12, 0xa58964, 0, y + 0.06, 0.24, "z");
    });
  } else if (piece === "curtain") {
    for (let fold = 0; fold < 9; fold++) cylinder(group, 0.09, 2.15, fold % 2 ? 0xe9e4db : 0xf7f4ee, -0.68 + fold * 0.17, 1.2, 0, null, "fabric");
    box(group, 1.55, 0.05, 0.08, 0xc4b5a0, 0, 2.28, 0);
  } else if (piece === "plant") {
    shadow(group, 0.55, 0.55);
    box(group, 0.28, 0.24, 0.28, 0xc4b5a0, 0, 0.14, 0);
    cylinder(group, 0.035, 0.55, 0x6b7553, 0, 0.48, 0, null, "wood");
    [[-0.13, 0.48, 0.03], [0.13, 0.55, 0.04], [-0.08, 0.72, -0.02], [0.12, 0.78, 0.02]].forEach(([x, y, z], index) => sphere(group, 0.19, index % 2 ? 0x789263 : 0x91a878, x, y, z, 1.55));
  } else if (piece === "lamp") {
    box(group, 0.08, 1.15, 0.08, 0xc4b5a0, 0, 0.6, 0);
    box(group, 0.28, 0.16, 0.28, 0xf7f4ee, 0, 1.22, 0);
    cylinder(group, 0.23, 0.035, 0x5d5145, 0, 0.03, 0, null, "metal");
  } else if (piece === "catLadder") {
    box(group, 0.04, 2.25, 0.04, 0xc4b5a0, -0.22, 1.12, 0);
    box(group, 0.04, 2.25, 0.04, 0xc4b5a0, 0.22, 1.12, 0);
    for (let rung = 0; rung < 8; rung++) {
      box(group, 0.44, 0.03, 0.03, 0xd8c7b0, 0, 0.28 + rung * 0.26, 0);
    }
  }
  return group;
};
