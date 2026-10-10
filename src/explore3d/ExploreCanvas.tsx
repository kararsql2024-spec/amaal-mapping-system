import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AMENITY_HEIGHT_M, COLORS, FLOOR_HEIGHT_M, HOUSE_PARAPET_M, HOUSE_WALL_M, TOWER_ROOF_M } from "./constants";
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
  const width = role === "mark" ? 640 : 440;
  const height = 188;
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
  sprite.center.set(0.5, 0.08);
  sprite.renderOrder = role === "unit" ? 30 : 20;
  sprite.frustumCulled = false;
  const paint = (text: string) => {
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(36, 32, 28, 0.13)";
    roundRect(ctx, 34, 34, width - 68, 112, 30);
    ctx.fill();
    ctx.fillStyle = "rgba(255, 252, 247, 0.96)";
    roundRect(ctx, 26, 20, width - 68, 112, 30);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(36, 32, 28, 0.16)";
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width / 2 - 12, 132);
    ctx.lineTo(width / 2, 176);
    ctx.lineTo(width / 2 + 12, 132);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 252, 247, 0.96)";
    ctx.fill();
    ctx.fillStyle = "#241f1c";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = role === "mark" ? "600 62px Tahoma, sans-serif" : "700 76px Tahoma, sans-serif";
    const measured = Math.max(ctx.measureText(text).width, 1);
    const scale = Math.min((width - 110) / measured, 1);
    ctx.save();
    ctx.translate(width / 2 - 6, 76);
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
    const veil = (material: THREE.MeshLambertMaterial | THREE.MeshBasicMaterial, fadeAlpha = false) => {
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

    const addGround = (kind: GroundKind, color: number, y: number) => {
      const geometry = groundGeometry(
        world.ground.filter((poly) => poly.kind === kind),
        y,
      );
      if (!geometry) return;
      const material = new THREE.MeshBasicMaterial({ color });
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

    addGround("green", COLORS.green, 0.18);
    addGround("pitch", COLORS.pitch, 0.24);
    addGround("sidewalk", COLORS.sidewalk, 0.32);
    addGround("road", COLORS.road, 0.42);

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
    const unitAnchor = { x: 0, y: 14, z: 0, w: 4.6 * unitSign.aspect, h: 4.6 };

    if (world.trees.length > 0) {
      const trunk = new THREE.CylinderGeometry(0.18, 0.34, 3.4, 8);
      trunk.translate(0, 1.7, 0);
      const crown = treeCrown();
      remember(trunk);
      if (crown) remember(crown);
      const leaf = solid(0xffffff);
      addMesh(scene, trunk, solid(COLORS.treeTrunk), world.trees, () => 0.18, false, pickables, false);
      if (crown) addMesh(scene, crown, leaf, world.trees, () => 0.18, true, pickables, false);
    }

    if (world.shrubs.length > 0) {
      const bush = new THREE.SphereGeometry(0.85, 8, 6);
      bush.translate(0, 0.62, 0);
      remember(bush);
      addMesh(scene, bush, solid(0xffffff), world.shrubs, () => 0.18, true, pickables, false);
    }

    if (world.amenities.length > 0) {
      const bodies: { geometry: THREE.BufferGeometry; item: PlacedInstance }[] = [];
      const lips: { geometry: THREE.BufferGeometry; item: PlacedInstance }[] = [];
      world.amenities.forEach((item) => {
        const ring = footprintOf(item);
        const wall = insetPoly(ring, 0.4);
        const shell = insetPoly(ring, 0.1);
        const body = extrudeRing(wall, AMENITY_HEIGHT_M, 0.08);
        if (body) {
          paintGeometry(body, item.color, true);
          bodies.push({ geometry: body, item });
        }
        const lip = extrudeRing(shell, 0.5, 0.08 + AMENITY_HEIGHT_M, wall);
        if (lip) lips.push({ geometry: lip, item });
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
      veil(amenityMaterial);
      const amenityLip = solid(0xe4d8c6);
      amenityLip.side = THREE.DoubleSide;
      ownedMaterials.push(amenityMaterial);
      placeVolumes(bodies, amenityMaterial);
      placeVolumes(lips, amenityLip);
      world.amenities.forEach((item) => {
        const sprite = makeLabel(item.label);
        if (!sprite) return;
        sprite.position.set(item.x, item.sy + 2.2, item.z);
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
      const fit = THREE.MathUtils.clamp(dist / 120, 0.52, 1.35);
      sprite.visible = true;
      sprite.position.set(x, y, z);
      sprite.scale.set(w * fit, h * fit, 1);
      material.opacity = presence;
    };

    const unitFloatText = (item: PlacedInstance) => {
      if (item.kind === "house") return shortCode(item.label);
      if (item.kind === "apartment" && item.floor != null && item.apt != null) return `F${item.floor} · P${item.apt}`;
      return "";
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
        const hit = raycaster.intersectObjects(pickables, false)[0];
        const item = hit ? itemFromHit(hit) : null;
        const text = item ? unitFloatText(item) : "";
        if (item && text) {
          if (text !== unitText) {
            unitText = text;
            unitSign.paint(text);
          }
          let x = item.x;
          let z = item.z;
          let y = 17;
          if (item.kind === "apartment") {
            const dx = camera.position.x - item.x;
            const dz = camera.position.z - item.z;
            const len = Math.hypot(dx, dz) || 1;
            x += (dx / len) * 1.6;
            z += (dz / len) * 1.6;
            y = (item.y || 0) + Math.max(item.sy, 1.6) + 2.2;
          }
          placeFloat(unitSign.sprite, x, y, z, unitAnchor.w, unitAnchor.h, 1);
          renderer.domElement.style.cursor = "pointer";
        } else {
          unitSign.sprite.visible = false;
          unitText = "";
          renderer.domElement.style.cursor = "";
        }
      } else if (unitSign.sprite.visible) {
        unitSign.sprite.visible = false;
        unitText = "";
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
      const hit = raycaster.intersectObjects(pickables, false)[0];
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
