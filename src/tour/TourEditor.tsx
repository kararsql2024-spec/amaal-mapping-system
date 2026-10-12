import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { MapElement } from "@/types/project";
import { hitItem, itemFoot, OPENING_WIDTH, pieceOf, PLACE_SIZE } from "./catalog";
import { TourDenied, TourLoading, useCenterAllowed } from "./gate";
import { ensureTours, saveTours, shrinkPlanImage } from "./storage";
import { SHEET_H, SHEET_W, type ItemKind, type OpeningKind, type PieceId, type TourItem, type TourKind, type TourTemplate } from "./types";
import { projectIdsOf } from "./match";
import { discoverSpecs, type TourSpec } from "./specs";
import { closestOnPath, nearestVertex, pathLength, poseAt, snapPoint, snapWallPoint, WALL_THICKNESS, type Pt, type WallGuides } from "./walls";

type Tool = "select" | "wall" | "room" | "text" | OpeningKind | "hotspot" | "stairs" | "furniture";
type Selection =
  | { kind: "item"; id: string }
  | { kind: "wall"; id: string }
  | { kind: "point"; wallId: string; index: number }
  | { kind: "opening"; id: string }
  | null;

const newId = () => crypto.randomUUID();

const blankTour = (kind: TourKind): TourTemplate => ({
  id: newId(),
  name: kind === "house" ? "منزل جديد" : "شقة جديدة",
  kind,
  floors: kind === "house" ? 2 : 1,
  projectId: "",
  projectIds: [],
  unitKey: "",
  unitLabel: "",
  grid: true,
  plans: {},
  walls: [],
  openings: [],
  items: [],
  updatedAt: new Date().toISOString(),
});

const itemName = (item: TourItem) => {
  if (item.kind === "text") return item.label || "نص";
  if (item.kind === "furniture") return pieceOf(item.piece)?.label || "أثاث";
  if (item.label) return item.label;
  if (item.kind === "room") return "غرفة";
  if (item.kind === "balcony") return "بلكونة";
  if (item.kind === "stairs") return "سلم";
  return "نقطة";
};

const segmentLengths = (points: Pt[]) => {
  const marks: { x: number; y: number; text: string }[] = [];
  for (let index = 1; index < points.length; index++) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length < 0.2) continue;
    marks.push({ x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 - 0.18, text: length.toFixed(2) });
  }
  return marks;
};

const openingSide = (points: Pt[], along: number, raw: Pt) => {
  const pose = poseAt(points, along);
  const rad = (pose.angle * Math.PI) / 180;
  const nx = -Math.sin(rad);
  const ny = Math.cos(rad);
  return (raw.x - pose.x) * nx + (raw.y - pose.y) * ny >= 0 ? 1 : -1;
};

const cornerOf = (item: TourItem): Pt => {
  const foot = itemFoot(item);
  const rad = ((item.rot || 0) * Math.PI) / 180;
  return {
    x: item.x + (foot.w / 2) * Math.cos(rad) - (foot.h / 2) * Math.sin(rad),
    y: item.y + (foot.w / 2) * Math.sin(rad) + (foot.h / 2) * Math.cos(rad),
  };
};

const FURNITURE_GROUPS: { title: string; ids: PieceId[] }[] = [
  { title: "جلوس", ids: ["sofa", "armchair", "coffee", "dining", "rug"] },
  { title: "نوم", ids: ["doubleBed", "singleBed", "wardrobe", "nightstand", "dresser", "kidsBed", "toyBox", "kidsShelf"] },
  { title: "مطبخ وعمل", ids: ["kitchen", "bathroom", "desk", "officeChair", "bookshelf"] },
  { title: "إضاءة", ids: ["tv", "curtain", "plant", "lamp"] },
  { title: "خارج المنزل", ids: ["car", "garden"] },
];

const FULL_VIEW = { x: 0, y: 0, w: SHEET_W, h: SHEET_H };

const zoomView = (current: typeof FULL_VIEW, focalX: number, focalY: number, factor: number) => {
  const w = Math.min(SHEET_W, Math.max(2, current.w * factor));
  const h = w * (SHEET_H / SHEET_W);
  if (w >= SHEET_W - 0.05) return { ...FULL_VIEW };
  const kx = (focalX - current.x) / current.w;
  const ky = (focalY - current.y) / current.h;
  return {
    x: Math.min(SHEET_W - w * 0.2, Math.max(w * -0.2, focalX - kx * w)),
    y: Math.min(SHEET_H - h * 0.2, Math.max(h * -0.2, focalY - ky * h)),
    w,
    h,
  };
};

const Editor = () => {
  const [tours, setTours] = useState<TourTemplate[]>([]);
  const [booting, setBooting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cloudPending, setCloudPending] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [floor, setFloor] = useState(1);
  const [tool, setTool] = useState<Tool>("select");
  const [piece, setPiece] = useState<PieceId>("sofa");
  const [selection, setSelection] = useState<Selection>(null);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [wallFree, setWallFree] = useState(false);
  const [snapVertex, setSnapVertex] = useState(true);
  const [view, setView] = useState({ x: 0, y: 0, w: SHEET_W, h: SHEET_H });
  const [notice, setNotice] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [specs, setSpecs] = useState<{ houses: TourSpec[]; apartments: TourSpec[] }>({ houses: [], apartments: [] });
  const [unitsReady, setUnitsReady] = useState(false);
  const [unitQuery, setUnitQuery] = useState("");
  const [ghost, setGhost] = useState<Pt | null>(null);
  const [dirty, setDirty] = useState(false);
  const [bindOpen, setBindOpen] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);
  const toursRef = useRef(tours);
  const editedRef = useRef(false);
  const past = useRef<string[]>([]);
  const spaceRef = useRef(false);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const dragRef = useRef<
    | { type: "point"; wallId: string; index: number; lockPrev: "x" | "y" | null; lockNext: "x" | "y" | null }
    | { type: "item"; id: string; dx: number; dy: number }
    | { type: "opening"; id: string }
    | { type: "scale"; id: string }
    | null
  >(null);
  toursRef.current = tours;
  const tour = tours.find((entry) => entry.id === activeId) || null;

  useEffect(() => {
    supabase.from("projects").select("id,name").order("name").then(({ data }) => {
      setProjects((data || []) as { id: string; name: string }[]);
    });
  }, []);

  const linkedKey = tour ? projectIdsOf(tour).join(",") : "";

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if (event.code !== "Space") return;
      event.preventDefault();
      spaceRef.current = true;
    };
    const up = (event: KeyboardEvent) => {
      if (event.code === "Space") spaceRef.current = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    const current = toursRef.current.find((entry) => entry.id === activeId);
    setBindOpen(!(current && projectIdsOf(current).length > 0 && current.unitKey));
  }, [activeId]);

  useEffect(() => {
    setView({ x: 0, y: 0, w: SHEET_W, h: SHEET_H });
  }, [activeId]);

  useEffect(() => {
    const ids = linkedKey ? linkedKey.split(",") : [];
    if (!ids.length) {
      setSpecs({ houses: [], apartments: [] });
      setUnitsReady(false);
      return;
    }
    let cancel = false;
    setUnitsReady(false);
    supabase
      .from("projects")
      .select("elements")
      .in("id", ids)
      .then(({ data }) => {
        if (cancel) return;
        const houses = new Map<string, TourSpec>();
        const apartments = new Map<string, TourSpec>();
        (data || []).forEach((row) => {
          const found = discoverSpecs((row.elements || []) as MapElement[]);
          found.houses.forEach((spec) => houses.set(spec.key, spec));
          found.apartments.forEach((spec) => apartments.set(spec.key, spec));
        });
        setSpecs({
          houses: Array.from(houses.values()).sort((a, b) => a.key.localeCompare(b.key)),
          apartments: Array.from(apartments.values()).sort((a, b) => Number(a.key) - Number(b.key)),
        });
        setUnitsReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [linkedKey]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const point = svg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      const matrix = svg.getScreenCTM();
      if (!matrix) return;
      const local = point.matrixTransform(matrix.inverse());
      setView((current) => zoomView(current, local.x, local.y, event.deltaY > 0 ? 1.12 : 0.88));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [activeId]);

  const stage = (next: TourTemplate[]) => {
    editedRef.current = true;
    toursRef.current = next;
    setTours(next);
    setDirty(true);
  };

  useEffect(() => {
    let cancel = false;
    ensureTours().then((result) => {
      if (cancel) return;
      if (!editedRef.current) {
        toursRef.current = result.tours;
        setTours(result.tours);
      }
      if (result.pendingUpload) {
        setCloudPending(true);
        setNotice("هذه الجولات محفوظة في هذا المتصفح. اضغط حفظ لرفعها إلى قاعدة البيانات.");
      }
      setBooting(false);
    });
    return () => {
      cancel = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    const result = await saveTours(toursRef.current);
    setSaving(false);
    if (!result.ok) {
      setNotice("تعذّر الحفظ. صورة المخطط كبيرة، أو لا توجد صلاحية للكتابة.");
      return;
    }
    setDirty(false);
    if (result.where === "database") {
      setCloudPending(false);
      setNotice("تم الحفظ في قاعدة البيانات.");
      return;
    }
    setCloudPending(true);
    setNotice("حُفظت في هذا المتصفح. لتنفيذ الحفظ على قاعدة البيانات، نفّذ ملف database_tour_templates.sql مرة واحدة في Supabase ثم اضغط حفظ.");
  };

  const update = (partial: Partial<TourTemplate>, _store = true) => {
    if (!activeId) return;
    stage(
      toursRef.current.map((entry) =>
        entry.id === activeId ? { ...entry, ...partial, updatedAt: new Date().toISOString() } : entry,
      ),
    );
  };

  useEffect(() => {
    if (!dirty) return;
    const onLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [dirty]);

  const remember = () => {
    const current = toursRef.current.find((entry) => entry.id === activeId);
    if (!current) return;
    past.current.push(JSON.stringify({ walls: current.walls, openings: current.openings, items: current.items }));
    if (past.current.length > 30) past.current.shift();
  };

  const undo = () => {
    const snap = past.current.pop();
    if (!snap) return;
    update(JSON.parse(snap) as Pick<TourTemplate, "walls" | "openings" | "items">);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        undo();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && selection) {
        event.preventDefault();
        const current = toursRef.current.find((entry) => entry.id === activeId);
        if (!current) return;
        remember();
        if (selection.kind === "item") update({ items: current.items.filter((item) => item.id !== selection.id) });
        if (selection.kind === "wall" || selection.kind === "point") {
          const wallId = selection.kind === "wall" ? selection.id : selection.wallId;
          update({
            walls: current.walls.filter((wall) => wall.id !== wallId),
            openings: current.openings.filter((opening) => opening.wallId !== wallId),
          });
        }
        if (selection.kind === "opening") update({ openings: current.openings.filter((opening) => opening.id !== selection.id) });
        setSelection(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeId, selection]);

  const toMeter = (event: React.PointerEvent): Pt | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM();
    if (!matrix) return null;
    const local = point.matrixTransform(matrix.inverse());
    return { x: local.x, y: local.y };
  };

  const wallGuides = (rawWalls: { id: string; floor: number; points: Pt[] }[], level: number, extra: Pt[] = [], skip?: { wallId: string; index: number }): WallGuides => {
    const vertices = extra.slice();
    const segments: WallGuides["segments"] = [];
    rawWalls.filter((wall) => wall.floor === level).forEach((wall) => {
      wall.points.forEach((point, index) => {
        if (skip && skip.wallId === wall.id && skip.index === index) return;
        vertices.push(point);
      });
      for (let index = 1; index < wall.points.length; index++) {
        if (skip && skip.wallId === wall.id && (skip.index === index || skip.index === index - 1)) continue;
        segments.push({ a: wall.points[index - 1], b: wall.points[index] });
      }
    });
    return { vertices, segments };
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (event.button === 1 || (event.button === 0 && spaceRef.current)) {
      panRef.current = { x: event.clientX, y: event.clientY };
      event.preventDefault();
      return;
    }
    const raw = toMeter(event);
    if (!raw || !tour) return;
    if (tool === "wall") {
      const prev = draft.length ? draft[draft.length - 1] : null;
      const point = snapWallPoint(raw, prev, wallGuides(tour.walls, floor, draft.slice(0, -1)), { free: wallFree || !prev, grid: tour.grid, vertex: snapVertex });
      if (prev && Math.hypot(point.x - prev.x, point.y - prev.y) < 0.12) return;
      setDraft((points) => [...points, point]);
      setGhost(null);
      return;
    }
    if (tool === "door" || tool === "mainDoor" || tool === "slideDoor" || tool === "window" || tool === "balcony") {
      let host: { id: string; along: number; side: number } | null = null;
      let gap = 0.45;
      tour.walls.filter((wall) => wall.floor === floor && wall.points.length > 1).forEach((wall) => {
        const onPath = closestOnPath(wall.points, raw);
        if (onPath.gap < gap) {
          gap = onPath.gap;
          host = { id: wall.id, along: onPath.along, side: openingSide(wall.points, onPath.along, raw) };
        }
      });
      if (!host) {
        setNotice("قرّب العنصر من جدار موجود.");
        return;
      }
      remember();
      const opening = {
        id: newId(),
        kind: tool,
        floor,
        wallId: host.id,
        at: host.along,
        width: OPENING_WIDTH[tool],
        side: tool === "balcony" ? host.side : undefined,
      };
      update({ openings: [...tour.openings, opening] });
      setSelection({ kind: "opening", id: opening.id });
      setNotice("");
      return;
    }
    if (tool !== "select") {
      const spec = tool === "furniture" ? pieceOf(piece) : PLACE_SIZE[tool as ItemKind];
      if (!spec) return;
      remember();
      let x = snapPoint(raw, tour.grid).x;
      let y = snapPoint(raw, tour.grid).y;
      let rot = 0;
      const sticks = tool === "furniture" && !["rug", "car", "garden", "coffee", "toyBox", "plant", "lamp"].includes(piece);
      const label = tool === "hotspot" || tool === "room" ? "غرفة" : tool === "text" ? "نص" : undefined;
      if (sticks) {
        let best: { x: number; y: number; gap: number } | null = null;
        tour.walls.filter((wall) => wall.floor === floor && wall.points.length > 1).forEach((wall) => {
          const onPath = closestOnPath(wall.points, raw);
          if (onPath.gap < 0.85 && (!best || onPath.gap < best.gap)) best = onPath;
        });
        if (best) {
          const dx = raw.x - best.x;
          const dy = raw.y - best.y;
          const span = Math.hypot(dx, dy) || 1;
          const nx = dx / span;
          const ny = dy / span;
          x = best.x + nx * (WALL_THICKNESS / 2 + spec.h / 2);
          y = best.y + ny * (WALL_THICKNESS / 2 + spec.h / 2);
          rot = (Math.atan2(-nx, ny) * 180) / Math.PI;
          if (rot < 0) rot += 360;
        }
      }
      const item: TourItem = {
        id: newId(),
        kind: tool === "furniture" ? "furniture" : (tool as ItemKind),
        floor,
        x,
        y,
        w: spec.w,
        h: spec.h,
        rot,
        scale: 1,
        piece: tool === "furniture" ? piece : undefined,
        label,
      };
      update({ items: [...tour.items, item] });
      setSelection({ kind: "item", id: item.id });
      setTool("select");
      return;
    }

    const selectedItem = selection?.kind === "item" ? tour.items.find((item) => item.id === selection.id) : null;
    if (selectedItem) {
      const corner = cornerOf(selectedItem);
      if (Math.hypot(corner.x - raw.x, corner.y - raw.y) < 0.28) {
        remember();
        dragRef.current = { type: "scale", id: selectedItem.id };
        return;
      }
    }
    for (const wall of tour.walls.filter((entry) => entry.floor === floor)) {
      const index = nearestVertex(wall.points, raw, 0.22);
      if (index >= 0) {
        remember();
        setSelection({ kind: "point", wallId: wall.id, index });
        const previous = wall.points[index - 1];
        const following = wall.points[index + 1];
        const here = wall.points[index];
        const axisOf = (from: Pt) => {
          if (wallFree) return null;
          if (Math.abs(from.y - here.y) <= 0.05) return "y" as const;
          if (Math.abs(from.x - here.x) <= 0.05) return "x" as const;
          return null;
        };
        dragRef.current = {
          type: "point",
          wallId: wall.id,
          index,
          lockPrev: previous ? axisOf(previous) : null,
          lockNext: following ? axisOf(following) : null,
        };
        return;
      }
    }
    for (const opening of tour.openings.filter((entry) => entry.floor === floor)) {
      const wall = tour.walls.find((entry) => entry.id === opening.wallId);
      if (!wall) continue;
      const spot = closestOnPath(wall.points, raw);
      if (Math.abs(spot.along - opening.at) <= opening.width / 2 + 0.15 && spot.gap < 0.35) {
        remember();
        setSelection({ kind: "opening", id: opening.id });
        dragRef.current = { type: "opening", id: opening.id };
        return;
      }
    }
    const items = tour.items.filter((item) => item.floor === floor);
    for (let index = items.length - 1; index >= 0; index--) {
      if (!hitItem(items[index], raw.x, raw.y)) continue;
      remember();
      setSelection({ kind: "item", id: items[index].id });
      dragRef.current = { type: "item", id: items[index].id, dx: items[index].x - raw.x, dy: items[index].y - raw.y };
      return;
    }
    for (const wall of tour.walls.filter((entry) => entry.floor === floor && entry.points.length > 1)) {
      if (closestOnPath(wall.points, raw).gap < 0.2) {
        setSelection({ kind: "wall", id: wall.id });
        return;
      }
    }
    setSelection(null);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (panRef.current && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const dx = event.clientX - panRef.current.x;
      const dy = event.clientY - panRef.current.y;
      panRef.current = { x: event.clientX, y: event.clientY };
      if (rect.width > 2 && rect.height > 2) {
        setView((current) => ({
          ...current,
          x: current.x - (dx * current.w) / rect.width,
          y: current.y - (dy * current.h) / rect.height,
        }));
      }
      return;
    }
    const raw = toMeter(event);
    if (tool === "wall" && raw && tour) {
      const prev = draft.length ? draft[draft.length - 1] : null;
      setGhost(snapWallPoint(raw, prev, wallGuides(tour.walls, floor, draft.slice(0, -1)), { free: wallFree || !prev, grid: tour.grid, vertex: snapVertex }));
    } else if (ghost) setGhost(null);
    const drag = dragRef.current;
    const current = toursRef.current.find((entry) => entry.id === activeId);
    if (!raw || !drag || !current) return;
    if (drag.type === "point") {
      const wall = current.walls.find((entry) => entry.id === drag.wallId);
      if (!wall) return;
      const previous = drag.index > 0 ? wall.points[drag.index - 1] : null;
      const guides = wallGuides(current.walls, wall.floor, [], { wallId: wall.id, index: drag.index });
      let x = raw.x;
      let y = raw.y;
      if (!wallFree && previous && drag.lockPrev) {
        const snapped = snapWallPoint(raw, previous, guides, { free: false, grid: current.grid, vertex: snapVertex, lock: drag.lockPrev });
        x = snapped.x;
        y = snapped.y;
      } else {
        const snapped = snapWallPoint(raw, null, guides, { free: true, grid: current.grid, vertex: snapVertex });
        x = snapped.x;
        y = snapped.y;
      }
      update({
        walls: current.walls.map((entry) =>
          entry.id === wall.id
            ? {
                ...entry,
                points: entry.points.map((vertex, index) => {
                  if (index === drag.index) return { x, y };
                  if (index === drag.index + 1 && drag.lockNext === "y") return { x: vertex.x, y };
                  if (index === drag.index + 1 && drag.lockNext === "x") return { x, y: vertex.y };
                  return vertex;
                }),
              }
            : entry,
        ),
      }, false);
    } else if (drag.type === "item") {
      const point = snapPoint({ x: raw.x + drag.dx, y: raw.y + drag.dy }, current.grid);
      update({
        items: current.items.map((item) => (item.id === drag.id ? { ...item, x: point.x, y: point.y } : item)),
      }, false);
    } else if (drag.type === "opening") {
      const opening = current.openings.find((entry) => entry.id === drag.id);
      const wall = opening ? current.walls.find((entry) => entry.id === opening.wallId) : null;
      if (!opening || !wall) return;
      const spot = closestOnPath(wall.points, raw);
      const along = spot.along;
      const limit = pathLength(wall.points);
      const side = opening.kind === "balcony" ? openingSide(wall.points, along, raw) : opening.side;
      update({
        openings: current.openings.map((entry) =>
          entry.id === opening.id
            ? { ...entry, at: Math.max(entry.width / 2, Math.min(limit - entry.width / 2, along)), side }
            : entry,
        ),
      }, false);
    } else if (drag.type === "scale") {
      const item = current.items.find((entry) => entry.id === drag.id);
      if (!item) return;
      const base = Math.hypot(item.w / 2, item.h / 2) || 1;
      const scale = Math.max(0.4, Math.min(2.6, Math.hypot(raw.x - item.x, raw.y - item.y) / base));
      update({ items: current.items.map((entry) => (entry.id === item.id ? { ...entry, scale } : entry)) }, false);
    }
  };

  const onPointerUp = () => {
    panRef.current = null;
    dragRef.current = null;
  };

  const duplicateTour = () => {
    if (!tour) return;
    const wallIds = new Map(tour.walls.map((wall) => [wall.id, newId()]));
    const copy: TourTemplate = {
      ...tour,
      id: newId(),
      name: `نسخة · ${tour.name}`,
      walls: tour.walls.map((wall) => ({ ...wall, id: wallIds.get(wall.id) || newId(), points: wall.points.map((point) => ({ ...point })) })),
      openings: tour.openings.map((opening) => ({ ...opening, id: newId(), wallId: wallIds.get(opening.wallId) || opening.wallId })),
      items: tour.items.map((item) => ({ ...item, id: newId() })),
      plans: { ...tour.plans },
      projectIds: [...projectIdsOf(tour)],
      updatedAt: new Date().toISOString(),
    };
    stage([copy, ...toursRef.current]);
    setActiveId(copy.id);
    setFloor(1);
    setSelection(null);
    setDraft([]);
  };

  const setSegmentLength = (wallId: string, index: number, length: number) => {
    const current = toursRef.current.find((entry) => entry.id === activeId);
    const wall = current?.walls.find((entry) => entry.id === wallId);
    if (!current || !wall || index < 1 || length < 0.2) return;
    const start = wall.points[index - 1];
    const end = wall.points[index];
    const span = Math.hypot(end.x - start.x, end.y - start.y);
    if (span < 0.02) return;
    const next = { x: start.x + ((end.x - start.x) / span) * length, y: start.y + ((end.y - start.y) / span) * length };
    const dx = next.x - end.x;
    const dy = next.y - end.y;
    remember();
    update({
      walls: current.walls.map((entry) => (entry.id === wallId ? {
        ...entry,
        points: entry.points.map((point, pointIndex) => (pointIndex >= index ? { x: point.x + dx, y: point.y + dy } : point)),
      } : entry)),
    });
  };

  const generateWall = () => {
    if (!tour || draft.length < 2) {
      setNotice("ارسم نقطتين على الأقل ثم اضغط توليد جدار.");
      return;
    }
    remember();
    update({ walls: [...tour.walls, { id: newId(), floor, points: draft }] });
    setDraft([]);
    setTool("select");
    setNotice("");
  };

  const selectedItem = selection?.kind === "item" ? tour?.items.find((item) => item.id === selection.id) : null;
  const selectedOpening = selection?.kind === "opening" ? tour?.openings.find((opening) => opening.id === selection.id) : null;
  const visibleWalls = tour?.walls.filter((wall) => wall.floor === floor) || [];
  const visibleItems = tour?.items.filter((item) => item.floor === floor) || [];
  const plan = tour?.plans[String(floor)] || "";
  const specList = (tour?.kind === "house" ? specs.houses : specs.apartments).filter((spec) =>
    spec.label.toLowerCase().includes(unitQuery.trim().toLowerCase()),
  );

  return (
    <div className="flex h-screen flex-col bg-[#f6f4ef] text-[#1c1917]" dir="rtl">
      <header className="flex items-center gap-3 border-b border-black/10 bg-white/85 px-4 py-2">
        <Link to="/admin" className="text-[13px] text-[#6b645c]">لوحة التحكم</Link>
        <p className="text-[14px]">محرر الجولات</p>
        <div className="ms-auto flex items-center gap-2">
          {dirty && <span className="text-[12px] text-[#9a3b32]">تغييرات غير محفوظة</span>}
          <Button type="button" size="sm" onClick={save} disabled={saving || (!dirty && !cloudPending)}>{saving ? "جارٍ الحفظ" : "حفظ"}</Button>
          {tour && (
            dirty ? (
              <button type="button" onClick={() => setNotice("احفظ الجولة قبل المعاينة.")} className="border border-black/15 px-2 py-1 text-[12px]">معاينة الجولة</button>
            ) : (
              <Link to={`/tour/${tour.id}?from=editor`} className="border border-black/15 px-2 py-1 text-[12px]">معاينة الجولة</Link>
            )
          )}
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr_300px]">
        <aside className="overflow-auto border-e border-black/10 bg-white/70 p-3">
          <div className="mb-3 flex flex-col gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => { const created = blankTour("apartment"); stage([created, ...tours]); setActiveId(created.id); setFloor(1); }}>شقة جديدة</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => { const created = blankTour("house"); stage([created, ...tours]); setActiveId(created.id); setFloor(1); }}>منزل جديد</Button>
          </div>
          {booting && <p className="px-1 text-[12px] text-[#6b645c]">جاري تحميل الجولات</p>}
          {tours.map((entry) => (
            <button key={entry.id} type="button" onClick={() => { setActiveId(entry.id); setFloor(1); setSelection(null); setDraft([]); }} className={`mb-1 block w-full px-2 py-2 text-start text-[13px] ${entry.id === activeId ? "bg-[#1c1917] text-white" : "hover:bg-black/5"}`}>
              <span className="block">{entry.name}</span>
              <span className="text-[11px] opacity-70">{entry.unitLabel || "بلا صنف"}</span>
            </button>
          ))}
        </aside>
        <main className="flex min-h-0 min-w-0">
          {tour ? (
            <>
              <aside className="flex w-[148px] shrink-0 flex-col gap-1 overflow-auto border-e border-black/10 bg-white/85 p-2">
                <p className="px-1 pb-1 text-[11px] text-[#6b645c]">أدوات الرسم</p>
                {([
                  ["select", "تحديد"],
                  ["wall", "مسار جدار"],
                  ["room", "غرفة"],
                  ["mainDoor", "باب رئيسي"],
                  ["door", "باب"],
                  ["slideDoor", "باب سلايد"],
                  ["window", "شباك"],
                  ["balcony", "بلكونة"],
                  ["hotspot", "نقطة جولة"],
                  ["text", "نص"],
                  ["stairs", "سلم"],
                ] as [Tool, string][]).filter(([id]) => id !== "stairs" || tour.floors > 1).map(([id, label]) => (
                  <button key={id} type="button" onClick={() => setTool(id)} className={`border px-2 py-1.5 text-start text-[12px] ${tool === id ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/10 bg-white"}`}>{label}</button>
                ))}
                <p className="px-1 pb-1 pt-3 text-[11px] text-[#6b645c]">المسار</p>
                <button type="button" onClick={generateWall} className="border border-[#1c1917] bg-[#1c1917] px-2 py-1.5 text-start text-[12px] text-white">توليد جدار ({draft.length})</button>
                {draft.length > 0 && <button type="button" onClick={() => setDraft((points) => points.slice(0, -1))} className="border border-black/10 bg-white px-2 py-1.5 text-start text-[12px]">تراجع نقطة</button>}
                {draft.length > 0 && <button type="button" onClick={() => setDraft([])} className="border border-black/10 bg-white px-2 py-1.5 text-start text-[12px]">مسح المسار</button>}
                <p className="px-1 pb-1 pt-3 text-[11px] text-[#6b645c]">العرض</p>
                <div className="grid grid-cols-3 gap-1">
                  <button type="button" onClick={() => setView((current) => zoomView(current, current.x + current.w / 2, current.y + current.h / 2, 0.8))} className="border border-black/10 bg-white px-1 py-1.5 text-[11px]">تقريب</button>
                  <button type="button" onClick={() => setView((current) => zoomView(current, current.x + current.w / 2, current.y + current.h / 2, 1.25))} className="border border-black/10 bg-white px-1 py-1.5 text-[11px]">تبعيد</button>
                  <button type="button" onClick={() => setView({ ...FULL_VIEW })} className="border border-black/10 bg-white px-1 py-1.5 text-[11px]">الإطار</button>
                </div>
                <button type="button" onClick={undo} className="border border-black/10 bg-white px-2 py-1.5 text-start text-[12px]">تراجع</button>
              </aside>
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 p-3">
                <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`} className="h-full w-full bg-[#fbfaf7]" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onAuxClick={(event) => event.preventDefault()}>
                  {tour.grid && Array.from({ length: SHEET_W * 2 + 1 }, (_, index) => (
                    <line key={`v${index}`} x1={index / 2} y1={0} x2={index / 2} y2={SHEET_H} stroke="#ece7df" strokeWidth={index % 2 ? 0.015 : 0.03} />
                  ))}
                  {tour.grid && Array.from({ length: SHEET_H * 2 + 1 }, (_, index) => (
                    <line key={`h${index}`} x1={0} y1={index / 2} x2={SHEET_W} y2={index / 2} stroke="#ece7df" strokeWidth={index % 2 ? 0.015 : 0.03} />
                  ))}
                  {plan && <image href={plan} x={0} y={0} width={SHEET_W} height={SHEET_H} />}
                  {visibleWalls.map((wall) => (
                    <g key={wall.id}>
                      <polyline points={wall.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={selection && ((selection.kind === "wall" && selection.id === wall.id) || (selection.kind === "point" && selection.wallId === wall.id)) ? "#1c1917" : "#4a5158"} strokeWidth={WALL_THICKNESS} strokeLinejoin="miter" strokeLinecap="square" />
                      {segmentLengths(wall.points).map((mark) => (
                        <text key={`${wall.id}-${mark.x}-${mark.y}`} x={mark.x} y={mark.y} textAnchor="middle" fontSize={0.28} fill="#6b645c">{mark.text}</text>
                      ))}
                    </g>
                  ))}
                  {draft.length > 0 && (
                    <g>
                      <polyline points={[...draft, ...(ghost ? [ghost] : [])].map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke="#1c1917" strokeWidth={WALL_THICKNESS} strokeDasharray="0.18 0.12" strokeLinejoin="miter" strokeLinecap="square" />
                      {segmentLengths(ghost ? [...draft, ghost] : draft).map((mark, index) => (
                        <text key={`draft-${index}`} x={mark.x} y={mark.y} textAnchor="middle" fontSize={0.28} fill="#1c1917">{mark.text}</text>
                      ))}
                    </g>
                  )}
                  {visibleItems.map((item) => {
                    const foot = itemFoot(item);
                    return (
                      <g key={item.id} transform={`translate(${item.x} ${item.y}) rotate(${item.rot || 0})`}>
                        <rect x={-foot.w / 2} y={-foot.h / 2} width={foot.w} height={foot.h} fill={item.kind === "text" ? "transparent" : item.kind === "furniture" ? "#d0d0ce" : "rgba(220,220,218,0.75)"} stroke={selection?.kind === "item" && selection.id === item.id ? "#1c1917" : "rgba(28,25,23,0.28)"} strokeWidth={0.04} />
                        <text textAnchor="middle" dominantBaseline="middle" fontSize={item.kind === "text" ? 0.36 : 0.28} fill="#1c1917">{itemName(item)}</text>
                      </g>
                    );
                  })}
                  {tour.openings.filter((opening) => opening.floor === floor).map((opening) => {
                    const wall = tour.walls.find((entry) => entry.id === opening.wallId);
                    if (!wall) return null;
                    const pose = poseAt(wall.points, opening.at);
                    const fill = opening.kind === "balcony" ? "#b7c6d0" : opening.kind === "window" ? "#c5ced4" : opening.kind === "slideDoor" ? "#d5e0e6" : "#c4a06a";
                    return (
                      <g key={opening.id} transform={`translate(${pose.x} ${pose.y}) rotate(${pose.angle})`}>
                        <rect x={-opening.width / 2} y={-0.09} width={opening.width} height={0.18} fill={fill} stroke={selection?.kind === "opening" && selection.id === opening.id ? "#1c1917" : "transparent"} strokeWidth={0.04} />
                        {(opening.kind === "door" || opening.kind === "mainDoor") && (
                          <>
                            <path d={`M ${opening.width / 2} 0 A ${opening.width} ${opening.width} 0 0 0 ${-opening.width / 2} ${-opening.width}`} fill="none" stroke="#1c1917" strokeWidth={0.025} />
                            <line x1={-opening.width / 2} y1={0} x2={-opening.width / 2} y2={-opening.width} stroke="#1c1917" strokeWidth={0.025} />
                          </>
                        )}
                      </g>
                    );
                  })}
                  {(selection?.kind === "wall" || selection?.kind === "point" ? visibleWalls.filter((wall) => wall.id === (selection.kind === "wall" ? selection.id : selection.wallId)) : []).flatMap((wall) => wall.points.map((point, index) => (
                    <circle key={`${wall.id}-${index}`} cx={point.x} cy={point.y} r={0.12} fill={selection.kind === "point" && selection.index === index ? "#1c1917" : "#fff"} stroke="#1c1917" strokeWidth={0.03} />
                  )))}
                  {draft.map((point, index) => <circle key={`d${index}`} cx={point.x} cy={point.y} r={0.1} fill="#1c1917" />)}
                  {tool === "wall" && ghost && <circle cx={ghost.x} cy={ghost.y} r={0.12} fill="#fff" stroke="#1c1917" strokeWidth={0.03} />}
                  {selectedItem && <circle cx={cornerOf(selectedItem).x} cy={cornerOf(selectedItem).y} r={0.12} fill="#fff" stroke="#1c1917" strokeWidth={0.04} />}
                </svg>
              </div>
              <div className="flex flex-wrap items-center gap-1 border-t border-black/10 bg-white/85 px-2 py-1.5">
                <button type="button" onClick={() => setWallFree(false)} className={`border px-2 py-1 text-[12px] ${!wallFree ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/10 bg-white"}`}>زوايا قائمة</button>
                <button type="button" onClick={() => setWallFree(true)} className={`border px-2 py-1 text-[12px] ${wallFree ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/10 bg-white"}`}>جدار حر</button>
                <button type="button" onClick={() => update({ grid: !tour.grid })} className={`border px-2 py-1 text-[12px] ${tour.grid ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/10 bg-white"}`}>
                  {tour.grid ? "الشبكة مقفلة" : "الشبكة حرة"}
                </button>
                <button type="button" onClick={() => setSnapVertex((value) => !value)} className={`border px-2 py-1 text-[12px] ${snapVertex ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/10 bg-white"}`}>
                  {snapVertex ? "التصاق بالركن" : "الركن حر"}
                </button>
                <span className="ms-auto text-[11px] text-[#6b645c]">اسحب بالزر الأوسط، أو اضغط مسافة ثم اسحب</span>
              </div>
              </div>
              <aside className="flex w-[168px] shrink-0 flex-col gap-1 overflow-auto border-s border-black/10 bg-white/85 p-2">
                {FURNITURE_GROUPS.map((group) => {
                  const pieces = group.ids.map((id) => pieceOf(id)).filter((entry): entry is NonNullable<ReturnType<typeof pieceOf>> => Boolean(entry) && (!entry?.house || tour.kind === "house"));
                  if (!pieces.length) return null;
                  return (
                    <div key={group.title}>
                      <p className="px-1 pb-1 pt-2 text-[11px] text-[#6b645c]">{group.title}</p>
                      <div className="grid grid-cols-2 gap-1">
                        {pieces.map((entry) => (
                          <button key={entry.id} type="button" onClick={() => { setTool("furniture"); setPiece(entry.id); }} className={`border px-1 py-1 text-[11px] ${tool === "furniture" && piece === entry.id ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/10 bg-white"}`}>{entry.label}</button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </aside>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[14px] text-[#6b645c]">اختر قالباً أو أنشئ واحداً.</div>
          )}
        </main>
        {tour && (
          <aside className="overflow-auto border-s border-black/10 bg-white/80 p-4 text-[12px]">
            <label className="mb-3 block">الاسم<Input value={tour.name} onChange={(event) => update({ name: event.target.value })} className="mt-1" /></label>
            {bindOpen ? (
            <div className="mb-2">
              <p className="mb-1">المشاريع المرتبطة</p>
              <div className="max-h-36 overflow-auto border border-black/10">
                {projects.map((project) => {
                  const linked = projectIdsOf(tour).includes(project.id);
                  return (
                    <label key={project.id} className="flex items-center gap-2 px-2 py-1.5">
                      <input
                        type="checkbox"
                        checked={linked}
                        onChange={() => {
                          const next = linked ? projectIdsOf(tour).filter((id) => id !== project.id) : [...projectIdsOf(tour), project.id];
                          setUnitQuery("");
                          update({ projectIds: next, projectId: next[0] || "" });
                        }}
                      />
                      <span>{project.name}</span>
                    </label>
                  );
                })}
              </div>
            <label className="mb-2 block">{tour.kind === "house" ? "نوع المنزل" : "مساحة الشقة"}
              <Input value={unitQuery} onChange={(event) => setUnitQuery(event.target.value)} placeholder={tour.kind === "house" ? "C أو C+" : "192"} className="mt-1" />
            </label>
            <div className="mb-3 max-h-40 overflow-auto border border-black/10">
              {specList.map((spec) => (
                <button key={spec.key} type="button" onClick={() => update({ unitKey: spec.key, unitLabel: spec.label, name: tour.name === "شقة جديدة" || tour.name === "منزل جديد" ? spec.label : tour.name })} className={`block w-full px-2 py-1.5 text-start ${tour.unitKey === spec.key ? "bg-[#1c1917] text-white" : "hover:bg-black/5"}`}>
                  {spec.label}
                </button>
              ))}
              {linkedKey && !unitsReady && <p className="p-2 text-[#6b645c]">جارٍ قراءة الأصناف…</p>}
              {linkedKey && unitsReady && specList.length === 0 && <p className="p-2 text-[#6b645c]">لا يوجد هذا الصنف في المشاريع المحددة.</p>}
              {!linkedKey && <p className="p-2 text-[#6b645c]">حدد مشروعاً أو أكثر.</p>}
            </div>
            <p className="mb-3 text-[11px] leading-5 text-[#6b645c]">قالب واحد يكفي لأكثر من مشروع إذا كانت المساحة أو النوع نفسه. مثال: شقة 190 في جوهرة البصرة وعين البصرة.</p>
            {projectIdsOf(tour).length > 0 && tour.unitKey && (
              <button type="button" onClick={() => setBindOpen(false)} className="mb-3 border border-black/15 px-2 py-1">إخفاء الربط</button>
            )}
            </div>
            ) : (
              <button type="button" onClick={() => setBindOpen(true)} className="mb-3 block w-full border border-black/10 px-2 py-2 text-start">
                <span className="block">{projects.filter((project) => projectIdsOf(tour).includes(project.id)).map((project) => project.name).join(" · ") || "المشاريع"}</span>
                <span className="text-[11px] text-[#6b645c]">{tour.unitLabel || "بلا صنف"} · تعديل الربط</span>
              </button>
            )}
            {tour.kind === "house" && (
              <label className="mb-3 block">عدد الطوابق
                <Input type="number" min={2} max={4} value={tour.floors} onChange={(event) => update({ floors: Math.min(4, Math.max(2, Number(event.target.value) || 2)) })} className="mt-1" />
              </label>
            )}
            <div className="mb-3 flex flex-wrap gap-1">
              {Array.from({ length: tour.floors }, (_, index) => index + 1).map((level) => (
                <button key={level} type="button" onClick={() => { setFloor(level); setSelection(null); setDraft([]); }} className={`border px-2 py-1 ${floor === level ? "border-[#1c1917]" : "border-black/15"}`}>طابق {level}</button>
              ))}
            </div>
            <label className="mb-3 block">صورة مخطط هذا الطابق
              <input type="file" accept="image/*" className="mt-1 block w-full" onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                try { update({ plans: { ...tour.plans, [String(floor)]: await shrinkPlanImage(file) } }); }
                catch { setNotice("تعذّر قراءة الصورة."); }
              }} />
            </label>
            <p className="mb-3 text-[11px] leading-5 text-[#6b645c]">عجلة الفأرة تقرّب. الزر الأوسط أو مسافة مع السحب يحرّك اللوحة. طول الضلع يُكتب بالمتر من خصائص الجدار.</p>
            {selectedItem && (
              <div className="space-y-2 border border-black/10 p-3">
                <p>{itemName(selectedItem)}</p>
                {selectedItem.kind === "hotspot" && (
                  <>
                    <label className="block">اسم النقطة
                      <Input value={selectedItem.label || ""} onChange={(event) => update({ items: tour.items.map((item) => item.id === selectedItem.id ? { ...item, label: event.target.value } : item) })} className="mt-1" />
                    </label>
                    <label className="block">النص
                      <textarea value={selectedItem.note || ""} rows={3} onChange={(event) => update({ items: tour.items.map((item) => item.id === selectedItem.id ? { ...item, note: event.target.value } : item) })} className="mt-1 w-full border border-black/15 bg-white px-2 py-1.5" />
                    </label>
                  </>
                )}
                {(selectedItem.kind === "room" || selectedItem.kind === "text") && (
                  <Input value={selectedItem.label || ""} onChange={(event) => update({ items: tour.items.map((item) => item.id === selectedItem.id ? { ...item, label: event.target.value } : item) })} />
                )}
                <label className="block">الزاوية بالدرجات
                  <Input type="number" step={1} value={Number.isFinite(selectedItem.rot) ? selectedItem.rot : 0} onChange={(event) => update({ items: tour.items.map((item) => item.id === selectedItem.id ? { ...item, rot: Number(event.target.value) || 0 } : item) })} className="mt-1" />
                </label>
                <label className="block">الحجم
                  <input type="range" min={0.4} max={2.6} step={0.05} value={selectedItem.scale || 1} onChange={(event) => update({ items: tour.items.map((item) => item.id === selectedItem.id ? { ...item, scale: Number(event.target.value) } : item) })} className="mt-1 w-full" />
                </label>
                <Button type="button" size="sm" variant="outline" onClick={() => { remember(); update({ items: tour.items.filter((item) => item.id !== selectedItem.id) }); setSelection(null); }}>حذف</Button>
              </div>
            )}
            {selectedOpening && (
              <div className="space-y-2 border border-black/10 p-3">
                <p>{selectedOpening.kind === "window" ? "شباك" : selectedOpening.kind === "slideDoor" ? "باب سلايد" : selectedOpening.kind === "mainDoor" ? "باب رئيسي" : selectedOpening.kind === "balcony" ? "بلكونة" : "باب"} على الجدار</p>
                <label className="block">العرض بالمتر
                  <Input type="number" min={0.4} max={6} step={0.05} value={selectedOpening.width} onChange={(event) => update({ openings: tour.openings.map((opening) => opening.id === selectedOpening.id ? { ...opening, width: Math.max(0.4, Number(event.target.value) || opening.width) } : opening) })} className="mt-1" />
                </label>
                <Button type="button" size="sm" variant="outline" onClick={() => { remember(); update({ openings: tour.openings.filter((opening) => opening.id !== selectedOpening.id) }); setSelection(null); }}>حذف</Button>
              </div>
            )}
            {(selection?.kind === "wall" || selection?.kind === "point") && (
              <div className="mt-3 border border-black/10 p-3">
                <p className="mb-2">طول كل ضلع بالمتر. تغييره يحرّك بقية الجدار معه.</p>
                {tour.walls.find((wall) => wall.id === (selection.kind === "wall" ? selection.id : selection.wallId))?.points.slice(1).map((point, index) => {
                  const wall = tour.walls.find((entry) => entry.id === (selection.kind === "wall" ? selection.id : selection.wallId));
                  const start = wall?.points[index];
                  if (!wall || !start) return null;
                  const length = Math.hypot(point.x - start.x, point.y - start.y);
                  return (
                    <label key={`${wall.id}-${index}-${length.toFixed(2)}`} className="mb-2 block">ضلع {index + 1}
                      <Input type="number" min={0.2} step={0.05} defaultValue={length.toFixed(2)} onBlur={(event) => { const next = Number(event.target.value); if (Number.isFinite(next) && Math.abs(next - length) >= 0.01) setSegmentLength(wall.id, index + 1, next); }} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} className="mt-1" />
                    </label>
                  );
                })}
                <Button type="button" size="sm" variant="outline" onClick={() => {
                  const wallId = selection.kind === "wall" ? selection.id : selection.wallId;
                  remember();
                  update({ walls: tour.walls.filter((wall) => wall.id !== wallId), openings: tour.openings.filter((opening) => opening.wallId !== wallId) });
                  setSelection(null);
                }}>حذف الجدار</Button>
              </div>
            )}
            {notice && <p className="mt-3 text-[#9a3b32]">{notice}</p>}
            <div className="mt-4 flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={duplicateTour}>نسخ القالب</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => { stage(tours.filter((entry) => entry.id !== tour.id)); setActiveId(null); }}>حذف القالب</Button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};

const TourEditor = () => {
  const allowed = useCenterAllowed();
  if (allowed === null) return <TourLoading />;
  if (!allowed) return <TourDenied />;
  return <Editor />;
};

export default TourEditor;
