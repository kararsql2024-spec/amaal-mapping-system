import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import type { MapElement } from "@/types/project";
import { hitItem, itemFoot, OPENING_WIDTH, PIECES, pieceOf, PLACE_SIZE } from "./catalog";
import { TourDenied, TourLoading, useCenterAllowed } from "./gate";
import { ensureTours, saveTours, shrinkPlanImage } from "./storage";
import { SHEET_H, SHEET_W, type ItemKind, type OpeningKind, type PieceId, type TourItem, type TourKind, type TourTemplate } from "./types";
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
  const [notice, setNotice] = useState("");
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [specs, setSpecs] = useState<{ houses: TourSpec[]; apartments: TourSpec[] }>({ houses: [], apartments: [] });
  const [unitsReady, setUnitsReady] = useState(false);
  const [unitQuery, setUnitQuery] = useState("");
  const [ghost, setGhost] = useState<Pt | null>(null);
  const [dirty, setDirty] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const toursRef = useRef(tours);
  const editedRef = useRef(false);
  const past = useRef<string[]>([]);
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

  useEffect(() => {
    if (!tour?.projectId) {
      setSpecs({ houses: [], apartments: [] });
      setUnitsReady(false);
      return;
    }
    let cancel = false;
    setUnitsReady(false);
    supabase
      .from("projects")
      .select("elements")
      .eq("id", tour.projectId)
      .single()
      .then(({ data }) => {
        if (cancel) return;
        setSpecs(discoverSpecs((data?.elements || []) as MapElement[]));
        setUnitsReady(true);
      });
    return () => {
      cancel = true;
    };
  }, [tour?.projectId, tour?.kind]);

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
    const raw = toMeter(event);
    if (!raw || !tour) return;
    if (tool === "wall") {
      const prev = draft.length ? draft[draft.length - 1] : null;
      const point = snapWallPoint(raw, prev, wallGuides(tour.walls, floor, draft.slice(0, -1)), { free: wallFree || !prev, grid: tour.grid });
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
    const raw = toMeter(event);
    if (tool === "wall" && raw && tour) {
      const prev = draft.length ? draft[draft.length - 1] : null;
      setGhost(snapWallPoint(raw, prev, wallGuides(tour.walls, floor, draft.slice(0, -1)), { free: wallFree || !prev, grid: tour.grid }));
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
        const snapped = snapWallPoint(raw, previous, guides, { free: false, grid: current.grid, lock: drag.lockPrev });
        x = snapped.x;
        y = snapped.y;
      } else {
        const snapped = snapWallPoint(raw, null, guides, { free: true, grid: current.grid });
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
    dragRef.current = null;
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
              <Link to={`/tour/${tour.id}`} className="border border-black/15 px-2 py-1 text-[12px]">معاينة الجولة</Link>
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
        <main className="flex min-w-0 flex-col">
          {tour ? (
            <>
              <div className="flex flex-wrap items-center gap-1 border-b border-black/10 bg-white/70 p-2">
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
                  <button key={id} type="button" onClick={() => setTool(id)} className={`border px-2 py-1 text-[12px] ${tool === id ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/15 bg-white"}`}>{label}</button>
                ))}
                <button type="button" onClick={() => setWallFree(false)} className={`border px-2 py-1 text-[12px] ${!wallFree ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/15 bg-white"}`}>زوايا قائمة</button>
                <button type="button" onClick={() => setWallFree(true)} className={`border px-2 py-1 text-[12px] ${wallFree ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/15 bg-white"}`}>جدار حر</button>
                <button type="button" onClick={() => update({ grid: !tour.grid })} className={`border px-2 py-1 text-[12px] ${tour.grid ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/15 bg-white"}`}>
                  {tour.grid ? "الشبكة مقفلة" : "الشبكة حرة"}
                </button>
                <button type="button" onClick={undo} className="border border-black/15 bg-white px-2 py-1 text-[12px]">تراجع</button>
                <button type="button" onClick={generateWall} className="border border-[#1c1917] bg-[#1c1917] px-2 py-1 text-[12px] text-white">توليد جدار ({draft.length})</button>
                {draft.length > 0 && <button type="button" onClick={() => setDraft((points) => points.slice(0, -1))} className="border border-black/15 bg-white px-2 py-1 text-[12px]">تراجع نقطة</button>}
                {draft.length > 0 && <button type="button" onClick={() => setDraft([])} className="border border-black/15 bg-white px-2 py-1 text-[12px]">مسح المسار</button>}
              </div>
              <div className="flex flex-wrap gap-1 border-b border-black/10 px-2 py-2">
                {PIECES.filter((entry) => !entry.house || tour.kind === "house").map((entry) => (
                  <button key={entry.id} type="button" onClick={() => { setTool("furniture"); setPiece(entry.id); }} className={`border px-2 py-1 text-[12px] ${tool === "furniture" && piece === entry.id ? "border-[#1c1917] bg-[#1c1917] text-white" : "border-black/15 bg-white"}`}>{entry.label}</button>
                ))}
              </div>
              <div className="min-h-0 flex-1 p-3">
                <svg ref={svgRef} viewBox={`0 0 ${SHEET_W} ${SHEET_H}`} className="h-full w-full bg-[#fbfaf7]" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
                  {tour.grid && Array.from({ length: SHEET_W * 2 + 1 }, (_, index) => (
                    <line key={`v${index}`} x1={index / 2} y1={0} x2={index / 2} y2={SHEET_H} stroke="#ece7df" strokeWidth={index % 2 ? 0.015 : 0.03} />
                  ))}
                  {tour.grid && Array.from({ length: SHEET_H * 2 + 1 }, (_, index) => (
                    <line key={`h${index}`} x1={0} y1={index / 2} x2={SHEET_W} y2={index / 2} stroke="#ece7df" strokeWidth={index % 2 ? 0.015 : 0.03} />
                  ))}
                  {plan && <image href={plan} x={0} y={0} width={SHEET_W} height={SHEET_H} opacity={0.42} />}
                  {visibleWalls.map((wall) => (
                    <g key={wall.id}>
                      <polyline points={wall.points.map((point) => `${point.x},${point.y}`).join(" ")} fill="none" stroke={selection && ((selection.kind === "wall" && selection.id === wall.id) || (selection.kind === "point" && selection.wallId === wall.id)) ? "#2a2a28" : "#c8c8c6"} strokeWidth={WALL_THICKNESS} strokeLinejoin="miter" strokeLinecap="square" />
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
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-[14px] text-[#6b645c]">اختر قالباً أو أنشئ واحداً.</div>
          )}
        </main>
        {tour && (
          <aside className="overflow-auto border-s border-black/10 bg-white/80 p-4 text-[12px]">
            <label className="mb-3 block">الاسم<Input value={tour.name} onChange={(event) => update({ name: event.target.value })} className="mt-1" /></label>
            <label className="mb-2 block">المشروع
              <select className="mt-1 w-full border border-black/15 bg-white px-2 py-1.5" value={tour.projectId} onChange={(event) => { setUnitQuery(""); update({ projectId: event.target.value, unitKey: "", unitLabel: "" }); }}>
                <option value="">اختر مشروعاً</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label className="mb-2 block">{tour.kind === "house" ? "نوع المنزل" : "مساحة الشقة"}
              <Input value={unitQuery} onChange={(event) => setUnitQuery(event.target.value)} placeholder={tour.kind === "house" ? "C أو C+" : "192"} className="mt-1" />
            </label>
            <div className="mb-3 max-h-40 overflow-auto border border-black/10">
              {specList.map((spec) => (
                <button key={spec.key} type="button" onClick={() => update({ unitKey: spec.key, unitLabel: spec.label, name: tour.name === "شقة جديدة" || tour.name === "منزل جديد" ? spec.label : tour.name })} className={`block w-full px-2 py-1.5 text-start ${tour.unitKey === spec.key ? "bg-[#1c1917] text-white" : "hover:bg-black/5"}`}>
                  {spec.label}
                </button>
              ))}
              {tour.projectId && !unitsReady && <p className="p-2 text-[#6b645c]">جارٍ قراءة الأصناف…</p>}
              {tour.projectId && unitsReady && specList.length === 0 && <p className="p-2 text-[#6b645c]">لا يوجد هذا الصنف في المشروع.</p>}
            </div>
            <p className="mb-3 text-[11px] leading-5 text-[#6b645c]">نفس أصناف البروشور داخل هذا المشروع. كل منازل Type C تستخدم هذا القالب، وشقة 192 في مدينة أخرى تبقى قالباً مستقلاً.</p>
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
            <p className="mb-3 text-[11px] leading-5 text-[#6b645c]">زوايا قائمة تُبقي الضلع أفقياً أو عمودياً. جدار حر يسمح بالانعطاف. النقطة تلتصق بأقرب ركن أو حافة أو امتداد قائم، والطول مكتوب بالمتر.</p>
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
                <p className="mb-2">اسحب الزاوية ويبقى الضلع أفقياً أو عمودياً. الطول ظاهر على الخط.</p>
                <Button type="button" size="sm" variant="outline" onClick={() => {
                  const wallId = selection.kind === "wall" ? selection.id : selection.wallId;
                  remember();
                  update({ walls: tour.walls.filter((wall) => wall.id !== wallId), openings: tour.openings.filter((opening) => opening.wallId !== wallId) });
                  setSelection(null);
                }}>حذف الجدار</Button>
              </div>
            )}
            {notice && <p className="mt-3 text-[#9a3b32]">{notice}</p>}
            <Button type="button" size="sm" variant="outline" className="mt-4" onClick={() => { stage(tours.filter((entry) => entry.id !== tour.id)); setActiveId(null); }}>حذف القالب</Button>
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
