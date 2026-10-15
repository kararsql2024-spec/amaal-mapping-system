import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { amenityModel, laneDashes, parkModel, pitchModel, streetFurniture, type AmenityChannel } from "./amenityForms";
import { COLORS, FLOOR_HEIGHT_M, HOUSE_PARAPET_M, HOUSE_WALL_M, TOWER_ROOF_M } from "./constants";
import { centroid, insetPoly, yawOffset } from "./geometry";
import type { ExplorePick, ExploreWorld, GroundKind, GroundPoly, PlacedInstance, WorldPoint } from "./types";

const HOUSE_STORY_M = HOUSE_WALL_M / 2;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

const groundGeometry = (polys: GroundPoly[], y: number) => {
  const parts: THREE.BufferGeometry[] = [];
  for (const poly of polys) {
    if (poly.points.length < 3) continue;
    const shape = new THREE.Shape();
    shape.moveTo(poly.points[0].x, -poly.points[0].z);
    for (let i = 1; i < poly.points.length; i++) {
      shape.lineTo(poly.points[i].x, -poly.points[i].z);
    }
    (poly.holes || []).forEach((hole) => {
      if (hole.length < 3) return;
      const path = new THREE.Path();
      path.moveTo(hole[0].x, -hole[0].z);
      for (let i = 1; i < hole.length; i++) path.lineTo(hole[i].x, -hole[i].z);
      shape.holes.push(path);
    });
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(0, y, 0);
    parts.push(geometry);
  }
  if (parts.length === 0) return null;
  if (parts.length === 1) return parts[0];
  const merged = mergeGeometries(parts, false);
  parts.forEach((geometry) => geometry.dispose());
  return merged;
};

/** نسيج أرضي يتكرر بالأمتار، لأن إحداثيات الشكل هي إحداثيات المشهد. */
const surfaceTexture = (kind: "asphalt" | "pavers" | "grass" | "turf", meters: number) => {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const base = { asphalt: "#8f8e8a", pavers: "#ddd6c9", grass: "#c2cfae", turf: "#b4c5a3" }[kind];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  if (kind === "pavers") {
    const tiles = 4;
    const step = size / tiles;
    for (let row = 0; row < tiles; row++) {
      for (let col = 0; col < tiles; col++) {
        const shift = row % 2 ? step / 2 : 0;
        const tone = 214 + Math.floor(Math.random() * 14);
        ctx.fillStyle = `rgb(${tone + 7}, ${tone}, ${tone - 12})`;
        ctx.fillRect(col * step + shift + 2, row * step + 2, step - 4, step - 4);
        if (shift) ctx.fillRect(-step / 2 + 2, row * step + 2, step - 4, step - 4);
      }
    }
    ctx.fillStyle = "rgba(160, 150, 134, 0.55)";
    for (let row = 0; row <= tiles; row++) ctx.fillRect(0, row * step - 1, size, 2);
  }
  const specks = kind === "asphalt" ? 5200 : kind === "pavers" ? 1400 : 3600;
  for (let index = 0; index < specks; index++) {
    const light = Math.random() > 0.5;
    const alpha = kind === "asphalt" ? 0.1 + Math.random() * 0.16 : 0.06 + Math.random() * 0.1;
    if (kind === "grass" || kind === "turf") {
      ctx.fillStyle = light ? `rgba(226, 236, 206, ${alpha})` : `rgba(104, 128, 86, ${alpha})`;
      ctx.fillRect(Math.random() * size, Math.random() * size, 1.4, 2.6);
    } else {
      ctx.fillStyle = light ? `rgba(255, 255, 255, ${alpha})` : `rgba(40, 38, 34, ${alpha})`;
      const dot = 1 + Math.random() * 1.6;
      ctx.fillRect(Math.random() * size, Math.random() * size, dot, dot);
    }
  }
  if (kind === "asphalt") {
    for (let index = 0; index < 7; index++) {
      ctx.fillStyle = `rgba(${Math.random() > 0.5 ? "255,255,255" : "30,30,28"}, 0.035)`;
      ctx.beginPath();
      ctx.arc(Math.random() * size, Math.random() * size, 20 + Math.random() * 50, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1 / meters, 1 / meters);
  texture.anisotropy = 8;
  return texture;
};

const unitBox = () => {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  geometry.translate(0, 0.5, 0);
  return geometry;
};

/** أسفل الصندوق أغمق حتى تجلس الكتلة على الأرض. يُستخدم مع لون النسخة. */
const contactBox = () => {
  const geometry = unitBox();
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  for (let index = 0; index < position.count; index++) {
    const y = position.getY(index);
    const shade = y < 0.22 ? 0.72 + (y / 0.22) * 0.28 : 1;
    colors[index * 3] = shade;
    colors[index * 3 + 1] = shade;
    colors[index * 3 + 2] = shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
};

const treeCrown = () => {
  const puff = (radius: number, y: number, x = 0, z = 0) => {
    const sphere = new THREE.SphereGeometry(radius, 8, 6);
    sphere.translate(x, y, z);
    return sphere;
  };
  const parts = [
    puff(2.45, 5.7),
    puff(1.75, 7.65),
    puff(1.65, 5.25, 1.7, 0.25),
    puff(1.5, 5.35, -1.55, -0.3),
    puff(1.3, 6.25, 0.15, 1.45),
  ];
  const merged = mergeGeometries(parts, false);
  parts.forEach((part) => part.dispose());
  return merged;
};

const skyDome = (radius: number) => {
  const geometry = new THREE.SphereGeometry(radius, 28, 18);
  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const top = new THREE.Color(COLORS.sky);
  const horizon = new THREE.Color(COLORS.horizon);
  for (let index = 0; index < position.count; index++) {
    const height = position.getY(index) / radius;
    const blend = THREE.MathUtils.smoothstep(height, 0.0, 0.34);
    const color = horizon.clone().lerp(top, blend);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
};

type FaceRange = { start: number; end: number; item: PlacedInstance };

const flatRing = (points: WorldPoint[], ccw: boolean) => {
  const flat = points.map((point) => new THREE.Vector2(point.x, -point.z));
  let area = 0;
  for (let index = 0; index < flat.length; index++) {
    const next = flat[(index + 1) % flat.length];
    area += flat[index].x * next.y - next.x * flat[index].y;
  }
  if ((area > 0) !== ccw) flat.reverse();
  return flat;
};

const footprintOf = (house: PlacedInstance): WorldPoint[] => {
  if (house.points && house.points.length >= 3) return house.points;
  const hx = house.sx / 2;
  const hz = house.sz / 2;
  return [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ].map(([lx, lz]) => {
    const offset = yawOffset(lx, lz, house.rotY);
    return { x: house.x + offset.x, z: house.z + offset.z };
  });
};

const extrudeRing = (outer: WorldPoint[], height: number, y: number, hole?: WorldPoint[]) => {
  if (outer.length < 3) return null;
  const shape = new THREE.Shape(flatRing(outer, true));
  if (hole && hole.length >= 3) shape.holes.push(new THREE.Path(flatRing(hole, false)));
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(height, 0.05),
    bevelEnabled: false,
    steps: 1,
    curveSegments: 1,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
};

const paintGeometry = (geometry: THREE.BufferGeometry, color: number, contact = false) => {
  const position = geometry.attributes.position;
  const count = position.count;
  let minY = 0;
  let spanY = 1;
  if (contact) {
    minY = Infinity;
    let maxY = -Infinity;
    for (let index = 0; index < count; index++) {
      const y = position.getY(index);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    spanY = Math.max(maxY - minY, 0.001);
  }
  const values = new Float32Array(count * 3);
  const rgb = new THREE.Color(color);
  for (let index = 0; index < count; index++) {
    let shade = 1;
    if (contact) {
      const t = (position.getY(index) - minY) / spanY;
      shade = t < 0.4 ? 0.74 + (t / 0.4) * 0.26 : 1;
    }
    values[index * 3] = rgb.r * shade;
    values[index * 3 + 1] = rgb.g * shade;
    values[index * 3 + 2] = rgb.b * shade;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(values, 3));
};

const mergeVolumes = (
  parts: { geometry: THREE.BufferGeometry; item: PlacedInstance }[],
) => {
  const ranges: FaceRange[] = [];
  let face = 0;
  const geometries: THREE.BufferGeometry[] = [];
  for (const part of parts) {
    const index = part.geometry.index;
    const triangles = index ? index.count / 3 : part.geometry.attributes.position.count / 3;
    ranges.push({ start: face, end: face + triangles, item: part.item });
    face += triangles;
    geometries.push(part.geometry);
  }
  if (geometries.length === 0) return null;
  const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
  if (geometries.length > 1) geometries.forEach((geometry) => geometry.dispose());
  if (!merged) return null;
  merged.computeBoundingSphere();
  return { geometry: merged, ranges };
};

const placeInstances = (
  mesh: THREE.InstancedMesh,
  items: PlacedInstance[],
  yOf: (item: PlacedInstance) => number,
  tint: boolean,
) => {
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  items.forEach((item, index) => {
    dummy.position.set(item.x, yOf(item), item.z);
    dummy.rotation.set(0, item.rotY, 0);
    dummy.scale.set(item.sx, item.sy, item.sz);
    dummy.updateMatrix();
    mesh.setMatrixAt(index, dummy.matrix);
    if (tint) mesh.setColorAt(index, color.setHex(item.color));
  });
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.userData.picks = items;
  mesh.frustumCulled = false;
};

const toPick = (item: PlacedInstance): ExplorePick => ({
  id: item.id,
  kind: item.kind,
  amenityType: item.amenityType,
  label: item.label,
  status: item.status,
  floors: item.floors,
  apartmentsPerFloor: item.apartmentsPerFloor,
  floor: item.floor,
  apt: item.apt,
  unitKey: item.unitKey,
});

const labelParts = (label: string) => label.split("-").map((part) => part.trim()).filter(Boolean);

const shortCode = (label: string) => {
  const parts = labelParts(label);
  return (parts[parts.length - 1] || label.trim()).slice(0, 12);
};

const blockTitle = (label: string) => {
  const parts = labelParts(label);
  const houseParts = parts[0]?.toUpperCase() === "G" && /^Z/i.test(parts[1] || "") ? parts.slice(1) : parts;
  if (houseParts.length < 3) return "";
  if (!/^Z/i.test(houseParts[0]) || !/^B/i.test(houseParts[1])) return "";
  return `${houseParts[0].toUpperCase()} · ${houseParts[1].toUpperCase()}`;
};

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
};

const createSkySprite = (role: "mark" | "unit") => {
  const width = role === "mark" ? 640 : 920;
  const height = 248;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    depthTest: role !== "unit",
  });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.renderOrder = role === "unit" ? 30 : 20;
  sprite.frustumCulled = false;
  const paint = (text: string, accent = "") => {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const cardX = 28;
    const cardY = 18;
    const cardW = width - 56;
    const cardH = 132;
    ctx.fillStyle = "rgba(28, 24, 20, 0.16)";
    roundRect(ctx, cardX + 8, cardY + 10, cardW, cardH, 28);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 252, 247, 0.97)";
    roundRect(ctx, cardX, cardY, cardW, cardH, 28);
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "rgba(36, 32, 28, 0.2)";
    ctx.stroke();
    if (accent) {
      ctx.save();
      roundRect(ctx, cardX, cardY, cardW, cardH, 28);
      ctx.clip();
      ctx.fillStyle = accent;
      ctx.fillRect(cardX, cardY, 14, cardH);
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(width / 2 - 16, cardY + cardH - 1);
    ctx.lineTo(width / 2, height - 8);
    ctx.lineTo(width / 2 + 16, cardY + cardH - 1);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 252, 247, 0.97)";
    ctx.fill();
    ctx.fillStyle = "#1c1917";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "700 78px 'Segoe UI', Tahoma, sans-serif";
    const measured = Math.max(ctx.measureText(text).width, 1);
    const scale = Math.min((cardW - 72) / measured, 1);
    ctx.save();
    ctx.translate(width / 2, cardY + cardH / 2);
    ctx.scale(scale, 1);
    ctx.fillText(text, 0, 0);
    ctx.restore();
    texture.needsUpdate = true;
  };
  return { sprite, paint, aspect: width / height };
};

const makeLabel = (text: string) => {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(24, 24, 24, 0.78)";
  ctx.fillRect(16, 16, 480, 64);
  ctx.fillStyle = "#ffffff";
  ctx.font = '36px "IBM Plex Sans Arabic", Tahoma, sans-serif';
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text.slice(0, 26), 256, 48);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(26, 4.8, 1);
  return sprite;
};

const addMesh = (
  scene: THREE.Scene,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  items: PlacedInstance[],
  yOf: (item: PlacedInstance) => number,
  tint: boolean,
  pickables: THREE.Object3D[],
  pickable: boolean,
) => {
  if (items.length === 0) return;
  const mesh = new THREE.InstancedMesh(geometry, material, items.length);
  placeInstances(mesh, items, yOf, tint);
  scene.add(mesh);
  if (pickable) pickables.push(mesh);
};

/**
 * عارض الاستكشاف. نموذج واحد لكل نوع، والنسخ تُرسم بأمر واحد على الكرت.
 * الكاميرا تبقى فوق الأرض، بحركة أبطأ من المدار الافتراضي.
 */
export const ExploreCanvas = ({
  world,
  onPick,
}: {
  world: ExploreWorld;
  onPick: (pick: ExplorePick | null) => void;
}) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const viewRef = useRef<{
    px: number;
    py: number;
    pz: number;
    tx: number;
    ty: number;
    tz: number;
    span: number;
  } | null>(null);
  onPickRef.current = onPick;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const horizon = new THREE.Color(COLORS.horizon);
    scene.background = horizon;

    const camera = new THREE.PerspectiveCamera(
      46,
      Math.max(host.clientWidth, 1) / Math.max(host.clientHeight, 1),
      0.4,
      world.spanM * 8,
    );
    const span = world.spanM;
    const saved = viewRef.current;
    const savedFits = saved != null && Math.abs(saved.span - span) / span < 0.2;
    if (savedFits && saved) {
      camera.position.set(saved.px, saved.py, saved.pz);
    } else {
      camera.position.set(span * 0.48, span * 0.32, span * 0.62);
    }

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(savedFits && saved ? saved.tx : 0, 0, savedFits && saved ? saved.tz : 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.09;
    controls.rotateSpeed = 0.22;
    controls.zoomSpeed = 1.15;
    controls.panSpeed = 1.2;
    controls.screenSpacePanning = false;
    controls.minPolarAngle = 0.22;
    controls.maxPolarAngle = 1.18;
    controls.minDistance = 8;
    controls.maxDistance = span * 2.8;
    controls.update();

    scene.add(new THREE.AmbientLight(0xfffaf4, 0.78));
    scene.add(new THREE.HemisphereLight(0xf7f4ee, 0xe8e2d6, 0.5));
    const sun = new THREE.DirectionalLight(0xfffaf2, 0.38);
    sun.position.set(span * 0.62, span * 0.74, span * 0.28);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xf7f4ee, 0.28);
    fill.position.set(-span * 0.35, span * 0.5, span * 0.55);
    scene.add(fill);

    const halfSiteW = Math.max(world.siteWidthM, 24) / 2;
    const halfSiteD = Math.max(world.siteDepthM, 24) / 2;
    const fogPad = 14;
    const fogSpan = 46;
    const edgeUniforms = {
      uEdge: {
        value: new THREE.Vector4(
          halfSiteW + fogPad,
          halfSiteW + fogPad + fogSpan,
          halfSiteD + fogPad,
          halfSiteD + fogPad + fogSpan,
        ),
      },
      uEdgeColor: { value: horizon.clone() },
    };
    const veil = (material: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial | THREE.MeshPhongMaterial, fadeAlpha = false) => {
      material.customProgramCacheKey = () => (fadeAlpha ? "site-edge-rect-alpha" : "site-edge-rect");
      if (fadeAlpha) material.transparent = true;
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uEdge = edgeUniforms.uEdge;
        shader.uniforms.uEdgeColor = edgeUniforms.uEdgeColor;
        shader.vertexShader = shader.vertexShader
          .replace("#include <common>", "#include <common>\nvarying vec3 vEdgeWorld;")
          .replace(
            "#include <project_vertex>",
            `#include <project_vertex>
vec4 edgeWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
edgeWorld = instanceMatrix * edgeWorld;
#endif
vEdgeWorld = (modelMatrix * edgeWorld).xyz;`,
          );
        shader.fragmentShader = shader.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying vec3 vEdgeWorld;\nuniform vec4 uEdge;\nuniform vec3 uEdgeColor;",
          )
          .replace(
            "#include <opaque_fragment>",
            `float edgeFog = smoothstep(0.0, 1.0, max(
  (abs(vEdgeWorld.x) - uEdge.x) / max(uEdge.y - uEdge.x, 1.0),
  (abs(vEdgeWorld.z) - uEdge.z) / max(uEdge.w - uEdge.z, 1.0)
));
${
  fadeAlpha
    ? `#include <opaque_fragment>
gl_FragColor.a *= 1.0 - edgeFog;`
    : `outgoingLight = mix(outgoingLight, uEdgeColor, edgeFog);
#include <opaque_fragment>`
}`,
          );
      };
    };

    const ownedGeometries: THREE.BufferGeometry[] = [];
    const ownedMaterials: THREE.Material[] = [];
    const pickables: THREE.Object3D[] = [];

    const remember = (geometry: THREE.BufferGeometry, material?: THREE.Material) => {
      ownedGeometries.push(geometry);
      if (material) ownedMaterials.push(material);
    };

    const solid = (color: number) => {
      const material = new THREE.MeshLambertMaterial({ color });
      veil(material);
      ownedMaterials.push(material);
      return material;
    };

    const skyGeometry = skyDome(span * 4.2);
    const skyMaterial = new THREE.MeshBasicMaterial({
      vertexColors: true,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    const sky = new THREE.Mesh(skyGeometry, skyMaterial);
    sky.frustumCulled = false;
    scene.add(sky);
    remember(skyGeometry, skyMaterial);

    const addGround = (kind: GroundKind, color: number, y: number, map?: THREE.Texture | null) => {
      const geometry = groundGeometry(
        world.ground.filter((poly) => poly.kind === kind),
        y,
      );
      if (!geometry) {
        map?.dispose();
        return;
      }
      const material = new THREE.MeshBasicMaterial(map ? { color: 0xffffff, map } : { color });
      veil(material);
      ownedMaterials.push(material);
      material.polygonOffset = true;
      material.polygonOffsetFactor = -2;
      material.polygonOffsetUnits = -2;
      remember(geometry);
      scene.add(new THREE.Mesh(geometry, material));
    };

    const margin = 18;
    const siteW = Math.max((halfSiteW + fogPad + fogSpan + 8) * 2, 48);
    const siteD = Math.max((halfSiteD + fogPad + fogSpan + 8) * 2, 48);
    const baseGeometry = new THREE.PlaneGeometry(siteW, siteD);
    const baseMaterial = new THREE.MeshBasicMaterial({ color: COLORS.ground });
    veil(baseMaterial, true);
    baseMaterial.polygonOffset = true;
    baseMaterial.polygonOffsetFactor = 4;
    baseMaterial.polygonOffsetUnits = 4;
    ownedMaterials.push(baseMaterial);
    const base = new THREE.Mesh(baseGeometry, baseMaterial);
    base.rotation.x = -Math.PI / 2;
    remember(baseGeometry);
    scene.add(base);

    const sunGlow = new THREE.Mesh(
      new THREE.CircleGeometry(span * 0.11, 32),
      new THREE.MeshBasicMaterial({
        color: 0xfff6df,
        transparent: true,
        opacity: 0.55,
        fog: false,
        depthWrite: false,
      }),
    );
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(span * 0.042, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff8e8, fog: false, depthWrite: false }),
    );
    const sunSpot = new THREE.Vector3(-0.22, 0.62, -0.72).normalize().multiplyScalar(span * 3.15);
    sunGlow.position.copy(sunSpot);
    sunDisc.position.copy(sunSpot);
    sunGlow.lookAt(0, 0, 0);
    sunDisc.lookAt(0, 0, 0);
    sunGlow.renderOrder = 1;
    sunDisc.renderOrder = 2;
    scene.add(sunGlow);
    scene.add(sunDisc);
    remember(sunGlow.geometry, sunGlow.material);
    remember(sunDisc.geometry, sunDisc.material);

    addGround("green", COLORS.green, 0.18, surfaceTexture("grass", 14));
    addGround("pitch", COLORS.pitch, 0.24, surfaceTexture("turf", 10));
    addGround("sidewalk", COLORS.sidewalk, 0.32, surfaceTexture("pavers", 2.4));
    addGround("road", COLORS.road, 0.42, surfaceTexture("asphalt", 9));

    const dashGeometry = laneDashes(world.ground, 0.44);
    if (dashGeometry) {
      remember(dashGeometry);
      const dashMaterial = new THREE.MeshBasicMaterial({ color: 0xf4f2ec, side: THREE.DoubleSide });
      veil(dashMaterial);
      dashMaterial.polygonOffset = true;
      dashMaterial.polygonOffsetFactor = -4;
      dashMaterial.polygonOffsetUnits = -4;
      ownedMaterials.push(dashMaterial);
      scene.add(new THREE.Mesh(dashGeometry, dashMaterial));
    }

    const detailMaterial = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    veil(detailMaterial);
    ownedMaterials.push(detailMaterial);
    const addDetail = (parts: THREE.BufferGeometry[]) => {
      if (parts.length === 0) return;
      const merged = mergeGeometries(parts, false);
      parts.forEach((geometry) => geometry.dispose());
      if (!merged) return;
      remember(merged);
      scene.add(new THREE.Mesh(merged, detailMaterial));
    };
    addDetail(streetFurniture(world.ground, 0.32));
    addDetail(world.ground.filter((poly) => poly.kind === "pitch").flatMap((poly) => pitchModel(poly.points, 0.24)));
    const parks = new Map<string, (x: number, z: number) => boolean>();
    addDetail(world.ground.filter((poly) => poly.kind === "green").flatMap((poly) => {
      const park = parkModel(poly.id, poly.points, 0.18);
      parks.set(poly.id, park.keepOut);
      return park.parts;
    }));
    const onPath = (item: PlacedInstance) => {
      const owner = item.id.replace(/-(tree|shrub)-\d+$/, "");
      const keepOut = parks.get(owner);
      return keepOut ? keepOut(item.x, item.z) : false;
    };
    const trees = world.trees.filter((item) => !onPath(item));
    const shrubs = world.shrubs.filter((item) => !onPath(item));

    const box = unitBox();
    const shaded = contactBox();
    remember(box);
    remember(shaded);
    const shadedMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    veil(shadedMaterial);
    ownedMaterials.push(shadedMaterial);

    if (world.houses.length > 0) {
      const stone: { geometry: THREE.BufferGeometry; item: PlacedInstance }[] = [];
      const decks: { geometry: THREE.BufferGeometry; item: PlacedInstance }[] = [];
      const seams: { geometry: THREE.BufferGeometry; item: PlacedInstance }[] = [];
      const crowns: { geometry: THREE.BufferGeometry; item: PlacedInstance }[] = [];
      const pads: THREE.BufferGeometry[] = [];
      const doors: PlacedInstance[] = [];
      const windows: PlacedInstance[] = [];
      const pushPart = (
        bucket: { geometry: THREE.BufferGeometry; item: PlacedInstance }[],
        geometry: THREE.BufferGeometry | null,
        house: PlacedInstance,
        tint?: number,
        contact = false,
      ) => {
        if (!geometry) return;
        if (tint != null) paintGeometry(geometry, tint, contact);
        bucket.push({ geometry, item: house });
      };

      world.houses.forEach((house) => {
        const ring = footprintOf(house);
        const wall = insetPoly(ring, 0.42);
        const band = insetPoly(ring, 0.22);
        const shell = insetPoly(ring, 0.08);
        const pad = extrudeRing(shell, 0.12, 0);
        if (pad) pads.push(pad);
        pushPart(stone, extrudeRing(wall, HOUSE_STORY_M - 0.06, 0.12), house);
        pushPart(stone, extrudeRing(wall, HOUSE_STORY_M - 0.06, 0.12 + HOUSE_STORY_M), house);
        const roofY = 0.12 + HOUSE_WALL_M + HOUSE_PARAPET_M - 0.16;
        pushPart(decks, extrudeRing(insetPoly(wall, 0.18), 0.14, roofY), house, house.color);
        pushPart(seams, extrudeRing(band, 0.2, 0.12 + HOUSE_STORY_M - 0.1), house);
        pushPart(
          crowns,
          extrudeRing(shell, HOUSE_PARAPET_M, 0.12 + HOUSE_WALL_M, wall),
          house,
        );

        let best = 0;
        let bestLen = -1;
        for (let index = 0; index < wall.length; index++) {
          const start = wall[index];
          const end = wall[(index + 1) % wall.length];
          const len = Math.hypot(end.x - start.x, end.z - start.z);
          if (len > bestLen) {
            best = index;
            bestLen = len;
          }
        }
        const start = wall[best];
        const end = wall[(best + 1) % wall.length];
        const mid = centroid(wall);
        let nx = end.z - start.z;
        let nz = start.x - end.x;
        const nlen = Math.hypot(nx, nz) || 1;
        nx /= nlen;
        nz /= nlen;
        const edgeMidX = (start.x + end.x) / 2;
        const edgeMidZ = (start.z + end.z) / 2;
        if ((edgeMidX - mid.x) * nx + (edgeMidZ - mid.z) * nz < 0) {
          nx = -nx;
          nz = -nz;
        }
        const rotY = Math.atan2(nx, nz);
        const at = (t: number) => ({
          x: start.x + (end.x - start.x) * t + nx * 0.08,
          z: start.z + (end.z - start.z) * t + nz * 0.08,
        });
        const doorAt = at(0.5);
        doors.push({
          ...house,
          x: doorAt.x,
          z: doorAt.z,
          rotY,
          y: 0.12,
          sx: Math.min(1.15, Math.max(0.7, bestLen * 0.12)),
          sy: 2.35,
          sz: 0.12,
          color: 0xc8c0b4,
        });
        const spots = bestLen > 7 ? [0.24, 0.76] : [0.5];
        [1.2, 1.2 + HOUSE_STORY_M].forEach((winY) => {
          spots.forEach((t) => {
            if (winY < 2 && Math.abs(t - 0.5) < 0.08) return;
            const winAt = at(t);
            windows.push({
              ...house,
              x: winAt.x,
              z: winAt.z,
              rotY,
              y: winY,
              sx: Math.min(1.15, Math.max(0.55, bestLen * 0.1)),
              sy: 1.05,
              sz: 0.1,
              color: 0xd5ddd8,
            });
          });
        });
      });

      const addVolumes = (
        parts: { geometry: THREE.BufferGeometry; item: PlacedInstance }[],
        material: THREE.Material,
      ) => {
        const merged = mergeVolumes(parts);
        if (!merged) return;
        remember(merged.geometry);
        const mesh = new THREE.Mesh(merged.geometry, material);
        mesh.userData.ranges = merged.ranges;
        scene.add(mesh);
        pickables.push(mesh);
      };
      if (pads.length > 0) {
        const padGeometry = pads.length === 1 ? pads[0] : mergeGeometries(pads, false);
        if (pads.length > 1) pads.forEach((geometry) => geometry.dispose());
        if (padGeometry) {
          remember(padGeometry);
          scene.add(new THREE.Mesh(padGeometry, solid(0xe7e2d6)));
        }
      }
      const deckMaterial = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });
      veil(deckMaterial);
      ownedMaterials.push(deckMaterial);
      const stoneMaterial = solid(COLORS.houseBody);
      const seamMaterial = solid(0xe6e1d6);
      const crownMaterial = solid(0xe6e1d6);
      stoneMaterial.side = THREE.DoubleSide;
      seamMaterial.side = THREE.DoubleSide;
      crownMaterial.side = THREE.DoubleSide;
      addVolumes(stone, stoneMaterial);
      addVolumes(decks, deckMaterial);
      addVolumes(seams, seamMaterial);
      addVolumes(crowns, crownMaterial);
      addMesh(scene, box, solid(0xffffff), doors, (item) => item.y || 0, true, pickables, false);
      addMesh(scene, box, solid(0xffffff), windows, (item) => item.y || 0, true, pickables, false);
    }

    const roofs: PlacedInstance[] = [];
    const lips: PlacedInstance[] = [];
    if (world.towers.length > 0) {
      const plinths = world.towers.map((tower) => ({
        ...tower,
        sx: tower.sx * 1.02,
        sy: 0.16,
        sz: tower.sz * 1.02,
      }));
      world.towers.forEach((tower) => {
        roofs.push({
          ...tower,
          y: (tower.floors || 1) * FLOOR_HEIGHT_M,
          sy: TOWER_ROOF_M,
          sx: tower.sx * 1.05,
          sz: tower.sz * 1.05,
          color: COLORS.towerRoof,
        });
      });
      roofs.forEach((roof) => {
        const lip = Math.min(0.85, Math.max(0.4, Math.min(roof.sx, roof.sz) * 0.035));
        const y = (roof.y || 0) + roof.sy;
        const hx = roof.sx / 2;
        const hz = roof.sz / 2;
        for (const localZ of [-hz + lip / 2, hz - lip / 2]) {
          const shift = yawOffset(0, localZ, roof.rotY);
          lips.push({
            ...roof,
            x: roof.x + shift.x,
            z: roof.z + shift.z,
            y,
            sx: roof.sx,
            sy: 0.2,
            sz: lip,
            color: 0xe4dfd4,
          });
        }
        for (const localX of [-hx + lip / 2, hx - lip / 2]) {
          const shift = yawOffset(localX, 0, roof.rotY);
          lips.push({
            ...roof,
            x: roof.x + shift.x,
            z: roof.z + shift.z,
            y,
            sx: lip,
            sy: 0.2,
            sz: Math.max(roof.sz - lip * 2, lip),
            color: 0xe4dfd4,
          });
        }
      });
      addMesh(scene, box, solid(0xe4dfd4), plinths, () => 0, false, pickables, false);
    }

    if (world.apartments.length > 0) {
      addMesh(
        scene,
        shaded,
        shadedMaterial,
        world.apartments,
        (item) => item.y || 0,
        true,
        pickables,
        true,
      );
    }

    if (world.joints.length > 0) {
      addMesh(
        scene,
        box,
        solid(COLORS.towerJoint),
        world.joints,
        (item) => item.y || 0,
        false,
        pickables,
        false,
      );
    }

    addMesh(scene, box, solid(COLORS.towerRoof), roofs, (item) => item.y || 0, false, pickables, true);
    addMesh(scene, box, solid(0xe4dfd4), lips, (item) => item.y || 0, false, pickables, true);

    type SkyAnchor = { sprite: THREE.Sprite; x: number; y: number; z: number; w: number; h: number };
    const skyAnchors: SkyAnchor[] = [];
    const placeSkyMark = (text: string, x: number, y: number, z: number, height: number) => {
      const mark = createSkySprite("mark");
      mark.paint(text);
      mark.sprite.position.set(x, y, z);
      mark.sprite.visible = false;
      scene.add(mark.sprite);
      ownedMaterials.push(mark.sprite.material);
      skyAnchors.push({ sprite: mark.sprite, x, y, z, w: height * mark.aspect, h: height });
    };
    const blockGroups = new Map<string, { x: number; z: number; n: number }>();
    world.houses.forEach((house) => {
      const title = blockTitle(house.label);
      if (!title) return;
      const group = blockGroups.get(title) || { x: 0, z: 0, n: 0 };
      group.x += house.x;
      group.z += house.z;
      group.n += 1;
      blockGroups.set(title, group);
    });
    blockGroups.forEach((group, title) => {
      if (group.n < 1) return;
      placeSkyMark(title, group.x / group.n, 24, group.z / group.n, 7.2);
    });
    world.towers.forEach((tower) => {
      const code = shortCode(tower.label);
      if (!code) return;
      placeSkyMark(code, tower.x, tower.sy + 10, tower.z, 6.4);
    });
    const unitSign = createSkySprite("unit");
    unitSign.sprite.visible = false;
    scene.add(unitSign.sprite);
    ownedMaterials.push(unitSign.sprite.material);
    let unitText = "";
    let unitAccent = "";
    const unitAnchor = { x: 0, y: 14, z: 0, w: 5.2 * unitSign.aspect, h: 5.2 };

    const hoverFillMaterial = new THREE.MeshBasicMaterial({
      color: 0xfffaf4,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const hoverEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0x2c2824,
      transparent: true,
      opacity: 0.85,
    });
    ownedMaterials.push(hoverFillMaterial, hoverEdgeMaterial);
    const hoverEdges = new THREE.EdgesGeometry(box);
    remember(hoverEdges);
    const hoverAnchor = new THREE.Group();
    hoverAnchor.add(new THREE.Mesh(box, hoverFillMaterial));
    hoverAnchor.add(new THREE.LineSegments(hoverEdges, hoverEdgeMaterial));
    hoverAnchor.visible = false;
    hoverAnchor.renderOrder = 6;
    scene.add(hoverAnchor);
    const houseFillMaterial = new THREE.MeshBasicMaterial({
      color: 0xfffaf4,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.DoubleSide,
    });
    const houseEdgeMaterial = new THREE.LineBasicMaterial({
      color: 0x2c2824,
      transparent: true,
      opacity: 0.8,
    });
    ownedMaterials.push(houseFillMaterial, houseEdgeMaterial);
    let houseHoverId = "";
    let houseLines: THREE.LineSegments | null = null;
    let houseRoof: THREE.Mesh | null = null;
    const clearHouseHover = () => {
      if (houseLines) {
        scene.remove(houseLines);
        houseLines.geometry.dispose();
        houseLines = null;
      }
      if (houseRoof) {
        scene.remove(houseRoof);
        houseRoof.geometry.dispose();
        houseRoof = null;
      }
      houseHoverId = "";
    };
    const showHouseHover = (item: PlacedInstance) => {
      if (houseHoverId === item.id && houseLines) return;
      clearHouseHover();
      const ring = footprintOf(item);
      if (ring.length < 3) return;
      houseHoverId = item.id;
      const y0 = 0.2;
      const y1 = 0.12 + HOUSE_WALL_M + HOUSE_PARAPET_M + 0.12;
      const positions: number[] = [];
      for (let index = 0; index < ring.length; index++) {
        const start = ring[index];
        const end = ring[(index + 1) % ring.length];
        positions.push(start.x, y0, start.z, end.x, y0, end.z);
        positions.push(start.x, y1, start.z, end.x, y1, end.z);
        positions.push(start.x, y0, start.z, start.x, y1, start.z);
      }
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      houseLines = new THREE.LineSegments(lineGeometry, houseEdgeMaterial);
      houseLines.frustumCulled = false;
      scene.add(houseLines);
      const shape = new THREE.Shape();
      shape.moveTo(ring[0].x, -ring[0].z);
      for (let index = 1; index < ring.length; index++) shape.lineTo(ring[index].x, -ring[index].z);
      const roofGeometry = new THREE.ShapeGeometry(shape);
      roofGeometry.rotateX(-Math.PI / 2);
      roofGeometry.translate(0, y1, 0);
      houseRoof = new THREE.Mesh(roofGeometry, houseFillMaterial);
      houseRoof.frustumCulled = false;
      scene.add(houseRoof);
    };
    const showHover = (item: PlacedInstance | null) => {
      if (!item) {
        hoverAnchor.visible = false;
        clearHouseHover();
        return;
      }
      if (item.kind === "apartment") {
        clearHouseHover();
        hoverAnchor.visible = true;
        hoverAnchor.position.set(item.x, item.y || 0, item.z);
        hoverAnchor.rotation.set(0, item.rotY, 0);
        hoverAnchor.scale.set(item.sx * 1.04, item.sy * 1.03, item.sz * 1.04);
        return;
      }
      hoverAnchor.visible = false;
      if (item.kind === "house") showHouseHover(item);
    };

    if (trees.length > 0) {
      const trunk = new THREE.CylinderGeometry(0.18, 0.34, 3.4, 8);
      trunk.translate(0, 1.7, 0);
      const crown = treeCrown();
      remember(trunk);
      if (crown) remember(crown);
      const leaf = solid(0xffffff);
      addMesh(scene, trunk, solid(COLORS.treeTrunk), trees, () => 0.18, false, pickables, false);
      if (crown) addMesh(scene, crown, leaf, trees, () => 0.18, true, pickables, false);
    }

    if (shrubs.length > 0) {
      const bush = new THREE.SphereGeometry(0.85, 8, 6);
      bush.translate(0, 0.62, 0);
      remember(bush);
      addMesh(scene, bush, solid(0xffffff), shrubs, () => 0.18, true, pickables, false);
    }

    if (world.amenities.length > 0) {
      const roads = world.ground.filter((poly) => poly.kind === "road");
      const buckets: Record<AmenityChannel, { geometry: THREE.BufferGeometry; item: PlacedInstance }[]> = {
        solid: [],
        glass: [],
        water: [],
      };
      const tops = new Map<string, number>();
      world.amenities.forEach((item) => {
        const model = amenityModel(item, footprintOf(item), roads);
        (Object.keys(model.parts) as AmenityChannel[]).forEach((channel) => {
          model.parts[channel].forEach((geometry) => buckets[channel].push({ geometry, item }));
        });
        tops.set(item.id, model.top);
      });
      const placeVolumes = (
        parts: { geometry: THREE.BufferGeometry; item: PlacedInstance }[],
        material: THREE.Material,
      ) => {
        const merged = mergeVolumes(parts);
        if (!merged) return;
        remember(merged.geometry);
        const mesh = new THREE.Mesh(merged.geometry, material);
        mesh.userData.ranges = merged.ranges;
        scene.add(mesh);
        pickables.push(mesh);
      };
      const amenityMaterial = new THREE.MeshLambertMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
      });
      const glassMaterial = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        shininess: 70,
        specular: 0x5d6871,
      });
      const waterMaterial = new THREE.MeshPhongMaterial({
        vertexColors: true,
        side: THREE.DoubleSide,
        shininess: 110,
        specular: 0x8fa4ad,
        emissive: 0x16262b,
      });
      [amenityMaterial, glassMaterial, waterMaterial].forEach((material) => {
        veil(material);
        ownedMaterials.push(material);
      });
      placeVolumes(buckets.solid, amenityMaterial);
      placeVolumes(buckets.glass, glassMaterial);
      placeVolumes(buckets.water, waterMaterial);
      world.amenities.forEach((item) => {
        const sprite = makeLabel(item.label);
        if (!sprite) return;
        sprite.position.set(item.x, (tops.get(item.id) ?? item.sy) + 2.6, item.z);
        scene.add(sprite);
        ownedMaterials.push(sprite.material);
      });
    }

    let frame = 0;
    let flight: {
      start: number;
      duration: number;
      fromPos: THREE.Vector3;
      toPos: THREE.Vector3;
      fromTarget: THREE.Vector3;
      toTarget: THREE.Vector3;
    } | null = null;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downX = 0;
    let downY = 0;
    let pointerInside = false;

    const itemFromHit = (hit: THREE.Intersection): PlacedInstance | null => {
      const instanceId = hit.instanceId;
      const picks = hit.object.userData?.picks as PlacedInstance[] | undefined;
      if (instanceId != null && picks?.[instanceId]) return picks[instanceId];
      const ranges = hit.object.userData?.ranges as FaceRange[] | undefined;
      if (!ranges || hit.faceIndex == null) return null;
      let lo = 0;
      let hi = ranges.length - 1;
      while (lo <= hi) {
        const midIndex = (lo + hi) >> 1;
        const range = ranges[midIndex];
        if (hit.faceIndex < range.start) hi = midIndex - 1;
        else if (hit.faceIndex >= range.end) lo = midIndex + 1;
        else return range.item;
      }
      return null;
    };

    const faceNormal = new THREE.Vector3();
    const instanceMatrix = new THREE.Matrix4();
    const wallFacing = (hit: THREE.Intersection) => {
      if (!hit.face) return false;
      faceNormal.copy(hit.face.normal);
      const mesh = hit.object as THREE.InstancedMesh;
      if (hit.instanceId != null && typeof mesh.getMatrixAt === "function") {
        mesh.getMatrixAt(hit.instanceId, instanceMatrix);
        faceNormal.transformDirection(instanceMatrix);
      } else {
        faceNormal.transformDirection(hit.object.matrixWorld);
      }
      if (Math.hypot(faceNormal.x, faceNormal.z) < 0.55) return false;
      return faceNormal.dot(raycaster.ray.direction) < -0.2;
    };
    const chooseHit = (hits: THREE.Intersection[]) => {
      let firstApartment: THREE.Intersection | null = null;
      let facing: THREE.Intersection | null = null;
      for (const hit of hits) {
        const item = itemFromHit(hit);
        if (!item) continue;
        if (item.kind === "house") return firstApartment ? facing || firstApartment : hit;
        if (item.kind !== "apartment") continue;
        if (!firstApartment) firstApartment = hit;
        if (!facing && hit.distance <= firstApartment.distance + 6 && wallFacing(hit)) facing = hit;
        if (firstApartment && hit.distance > firstApartment.distance + 6) break;
      }
      return facing || firstApartment;
    };

    const skyPresence = (x: number, z: number) => {
      const flat = Math.hypot(camera.position.x - x, camera.position.z - z);
      const byDistance = 1 - THREE.MathUtils.smoothstep(flat, 280, 640);
      const byHeight = 1 - THREE.MathUtils.smoothstep(camera.position.y, 210, 500);
      return byDistance * byHeight;
    };

    const placeFloat = (
      sprite: THREE.Sprite,
      x: number,
      y: number,
      z: number,
      w: number,
      h: number,
      presence: number,
    ) => {
      const material = sprite.material as THREE.SpriteMaterial;
      if (presence <= 0.04) {
        sprite.visible = false;
        material.opacity = 0;
        return;
      }
      const dist = Math.hypot(camera.position.x - x, camera.position.y - y, camera.position.z - z);
      const fit = THREE.MathUtils.clamp(dist / 120, 0.82, 1.35);
      sprite.visible = true;
      sprite.position.set(x, y, z);
      sprite.scale.set(w * fit, h * fit, 1);
      material.opacity = presence;
    };

    const cssHex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;
    const unitFloatText = (item: PlacedInstance) => {
      if (item.kind === "house") return shortCode(item.label);
      if (item.kind !== "apartment") return "";
      if (item.code) return item.code.split("-").filter(Boolean).join(" · ");
      if (item.floor == null || item.apt == null) return "";
      const floorCode = item.floor === 1 ? "FG" : `F${item.floor - 1}`;
      return `${shortCode(item.label)} · ${floorCode} · P${item.apt}`;
    };

    const tick = () => {
      if (flight) {
        const k = easeInOut(Math.min(1, (performance.now() - flight.start) / flight.duration));
        camera.position.lerpVectors(flight.fromPos, flight.toPos, k);
        controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
        if (k >= 1) flight = null;
      }
      controls.target.y = 0;
      controls.update();
      skyAnchors.forEach((anchor) => {
        placeFloat(anchor.sprite, anchor.x, anchor.y, anchor.z, anchor.w, anchor.h, skyPresence(anchor.x, anchor.z));
      });
      if (pointerInside) {
        raycaster.setFromCamera(pointer, camera);
        const hit = chooseHit(raycaster.intersectObjects(pickables, false));
        const item = hit ? itemFromHit(hit) : null;
        const text = item ? unitFloatText(item) : "";
        if (item && text) {
          const accent = item.kind === "apartment" ? cssHex(item.color) : "";
          if (text !== unitText || accent !== unitAccent) {
            unitText = text;
            unitAccent = accent;
            unitSign.paint(text, accent);
          }
          let x = item.x;
          let z = item.z;
          const y = item.kind === "apartment"
            ? (item.y || 0) + item.sy + 0.45
            : 0.12 + HOUSE_WALL_M + HOUSE_PARAPET_M + 0.35;
          if (item.kind === "apartment") {
            const dx = camera.position.x - item.x;
            const dz = camera.position.z - item.z;
            const len = Math.hypot(dx, dz) || 1;
            const reach = Math.max(Math.min(item.sx, item.sz) * 0.42, 0.4);
            x += (dx / len) * reach;
            z += (dz / len) * reach;
          }
          placeFloat(unitSign.sprite, x, y, z, unitAnchor.w, unitAnchor.h, 1);
          showHover(item);
          renderer.domElement.style.cursor = "pointer";
        } else {
          unitSign.sprite.visible = false;
          unitText = "";
          unitAccent = "";
          showHover(null);
          renderer.domElement.style.cursor = "";
        }
      } else if (unitSign.sprite.visible || hoverAnchor.visible || houseLines) {
        unitSign.sprite.visible = false;
        unitText = "";
        unitAccent = "";
        showHover(null);
        renderer.domElement.style.cursor = "";
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(tick);
    };

    const onPointerDown = (event: PointerEvent) => {
      flight = null;
      downX = event.clientX;
      downY = event.clientY;
    };
    const onPointerUp = (event: PointerEvent) => {
      if (event.detail > 1) return;
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = chooseHit(raycaster.intersectObjects(pickables, false));
      const item = hit ? itemFromHit(hit) : null;
      if (item) onPickRef.current(toPick(item));
    };
    const onPointerMove = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      pointerInside = true;
    };
    const onPointerLeave = () => {
      pointerInside = false;
    };

    const onDoubleClick = (event: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(scene.children, true)
        .find((item) => item.object !== sky && item.object.type !== "Sprite");
      const point = new THREE.Vector3();
      if (hit) point.copy(hit.point);
      else if (!raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point)) return;
      const limitW = world.siteWidthM * 0.5 + margin;
      const limitD = world.siteDepthM * 0.5 + margin;
      point.x = THREE.MathUtils.clamp(point.x, -limitW, limitW);
      point.z = THREE.MathUtils.clamp(point.z, -limitD, limitD);
      const offset = camera.position.clone().sub(controls.target);
      if (offset.lengthSq() < 1) offset.set(span * 0.22, span * 0.16, span * 0.28);
      offset.setLength(Math.min(offset.length(), Math.max(46, span * 0.2)));
      const toTarget = new THREE.Vector3(point.x, 0, point.z);
      const toPos = toTarget.clone().add(offset);
      toPos.y = Math.max(toPos.y, 18);
      flight = {
        start: performance.now(),
        duration: 780,
        fromPos: camera.position.clone(),
        toPos,
        fromTarget: controls.target.clone(),
        toTarget,
      };
    };
    const onWheel = () => {
      flight = null;
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    renderer.domElement.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("pointerleave", onPointerLeave);
    renderer.domElement.addEventListener("dblclick", onDoubleClick);
    renderer.domElement.addEventListener("wheel", onWheel);
    tick();

    const resize = () => {
      const width = host.clientWidth;
      const height = host.clientHeight;
      if (width < 1 || height < 1) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      cancelAnimationFrame(frame);
      clearHouseHover();
      viewRef.current = {
        px: camera.position.x,
        py: camera.position.y,
        pz: camera.position.z,
        tx: controls.target.x,
        ty: 0,
        tz: controls.target.z,
        span,
      };
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("dblclick", onDoubleClick);
      renderer.domElement.removeEventListener("wheel", onWheel);
      ownedGeometries.forEach((geometry) => geometry.dispose());
      ownedMaterials.forEach((material) => {
        const textured = material as THREE.Material & { map?: THREE.Texture | null };
        textured.map?.dispose();
        material.dispose();
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
    };
  }, [world]);

  return <div ref={hostRef} className="h-full w-full" />;
};
