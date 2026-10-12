import * as THREE from "three";
import type { PieceId } from "./types";

const material = (color: number) => new THREE.MeshLambertMaterial({ color });

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
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z);
  parent.add(mesh);
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
  } else if (piece === "doubleBed" || piece === "singleBed" || piece === "kidsBed") {
    const width = piece === "doubleBed" ? 1.6 : piece === "kidsBed" ? 0.8 : 0.95;
    const length = piece === "kidsBed" ? 1.5 : 2;
    const linen = piece === "kidsBed" ? 0xf2d6cf : 0xf7f4ee;
    shadow(group, width + 0.4, length + 0.3);
    box(group, width, 0.22, length, 0xc4b5a0, 0, 0.2, 0);
    box(group, width - 0.08, 0.16, length - 0.16, linen, 0, 0.38, 0.04);
    box(group, width - 0.16, 0.1, 0.28, 0xe7e2d6, 0, 0.5, -length * 0.36);
    box(group, width, 0.5, 0.08, 0xd5cdc0, 0, 0.52, -length * 0.48);
  } else if (piece === "wardrobe" || piece === "kidsShelf") {
    const width = piece === "kidsShelf" ? 0.85 : 1.7;
    const height = piece === "kidsShelf" ? 1.15 : 2.05;
    const depth = piece === "kidsShelf" ? 0.32 : 0.52;
    shadow(group, width + 0.2, depth + 0.3);
    box(group, width, height, depth, piece === "kidsShelf" ? 0xf0e2d4 : 0xe7e1d4, 0, height / 2, 0);
    if (piece === "kidsShelf") {
      box(group, width - 0.08, 0.04, depth + 0.02, 0xd8c7b0, 0, 0.4, 0);
      box(group, width - 0.08, 0.04, depth + 0.02, 0xd8c7b0, 0, 0.78, 0);
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
  } else if (piece === "kitchen") {
    shadow(group, 2.7, 0.9);
    box(group, 2.5, 0.88, 0.6, 0xf3f0e8, 0, 0.46, 0);
    box(group, 2.5, 0.04, 0.62, 0xd5ddd8, 0, 0.92, 0);
    box(group, 2.4, 0.55, 0.32, 0xe7e2d6, 0, 1.85, -0.12);
  } else if (piece === "bathroom") {
    shadow(group, 1.8, 1.4);
    box(group, 0.7, 0.42, 0.48, 0xf7f4ee, -0.4, 0.4, -0.3);
    box(group, 0.55, 0.15, 0.7, 0xf7f4ee, 0.45, 0.2, 0.2);
    box(group, 0.08, 1.1, 0.7, 0xe7e2d6, 0.78, 0.7, 0.2);
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
  } else if (piece === "toyBox") {
    shadow(group, 0.85, 0.55);
    box(group, 0.64, 0.32, 0.4, 0xe7c1a8, 0, 0.18, 0);
    box(group, 0.66, 0.05, 0.42, 0xd8b090, 0, 0.36, 0);
  } else if (piece === "car") {
    shadow(group, 4.4, 2);
    box(group, 3.6, 0.55, 1.55, 0x8d9a86, 0, 0.55, 0);
    box(group, 1.8, 0.5, 1.4, 0xd5ddd8, -0.15, 1.0, 0);
    [-1.2, 1.2].forEach((x) => {
      [-0.7, 0.7].forEach((z) => box(group, 0.45, 0.45, 0.2, 0x2a2622, x, 0.28, z));
    });
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
  } else if (piece === "nightstand") {
    shadow(group, 0.65, 0.55);
    box(group, 0.46, 0.48, 0.38, 0xe7e1d4, 0, 0.26, 0);
  } else if (piece === "bookshelf") {
    shadow(group, 1.05, 0.45);
    box(group, 0.86, 1.7, 0.28, 0xe7e1d4, 0, 0.88, 0);
    box(group, 0.78, 0.03, 0.26, 0xd8c7b0, 0, 0.55, 0.02);
    box(group, 0.78, 0.03, 0.26, 0xd8c7b0, 0, 1.05, 0.02);
  } else if (piece === "dresser") {
    shadow(group, 1.4, 0.65);
    box(group, 1.15, 0.72, 0.44, 0xf3f0e8, 0, 0.38, 0);
    box(group, 0.7, 0.55, 0.03, 0xd5ddd8, 0, 1.15, -0.2);
  } else if (piece === "curtain") {
    box(group, 1.5, 2.15, 0.06, 0xf7f4ee, 0, 1.2, 0);
    box(group, 1.55, 0.05, 0.08, 0xc4b5a0, 0, 2.28, 0);
  } else if (piece === "plant") {
    shadow(group, 0.55, 0.55);
    box(group, 0.28, 0.24, 0.28, 0xc4b5a0, 0, 0.14, 0);
    box(group, 0.42, 0.36, 0.42, 0x9aaf86, 0, 0.48, 0);
    box(group, 0.28, 0.22, 0.28, 0xb7c6a8, 0.12, 0.72, 0.08);
  } else if (piece === "lamp") {
    box(group, 0.08, 1.15, 0.08, 0xc4b5a0, 0, 0.6, 0);
    box(group, 0.28, 0.16, 0.28, 0xf7f4ee, 0, 1.22, 0);
  }
  return group;
};
