"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MapElement, ElementType, Point } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, Home, Building2, Leaf, 
  Waypoints, MapPin, Grid3X3, ArrowDown, ArrowLeft, ArrowUp, ArrowRight,
  ZoomIn, ZoomOut, RotateCcw, Type, Palette, Hand,
  Trophy, Store, GraduationCap, Stethoscope, Baby, ShoppingBag, Dumbbell, ShoppingCart,
  Copy, ChevronRight, ChevronDown, X, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  Settings2, MoonStar, Maximize2, Footprints, Car, EyeOff, Eye, Paintbrush, MousePointer2,
  SlidersHorizontal, Maximize, Minimize, Image as ImageIcon, Lock, Unlock, Upload, Bold, RotateCw, Layers, Target
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[], width: number, height: number, centerX: number, centerY: number) => void;
  mapWidth: number;
  mapHeight: number;
  initialCenterX?: number;
  initialCenterY?: number;
}

const GRID_SIZE = 10;

const MapEditor = ({ initialElements, onSave, mapWidth, mapHeight, initialCenterX, initialCenterY }: MapEditorProps) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ElementType | null>(null);
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [dragMode, setDragMode] = useState<{ type: 'move' | 'vertex' | 'edge' | 'rotate' | 'pan' | 'brush' | 'center', startPos?: Point, index?: number } | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [gridLock, setGridLock] = useState(true);
  const [dims, setDims] = useState({ w: Math.round(mapWidth), h: Math.round(mapHeight) });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [centerPoint, setCenterPoint] = useState({ x: initialCenterX || mapWidth / 2, y: initialCenterY || mapHeight / 2 });
  const [showCenterTool, setShowCenterTool] = useState(false);
  
  const [scale, setScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);

  const snap = (val: number) => gridLock ? Math.round(val / GRID_SIZE) * GRID_SIZE : Math.round(val);

  const getElementPoints = (el: MapElement): Point[] => {
    if (el.points && el.points.length > 0) return el.points;
    return [
      { x: el.x, y: el.y },
      { x: el.x + el.width, y: el.y },
      { x: el.x + el.width, y: el.y + el.height },
      { x: el.x, y: el.y + el.height },
    ];
  };

  const getMousePos = (e: React.MouseEvent | WheelEvent | React.TouchEvent) => {
    if (!svgRef.current || !contentRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    if ('touches' in e) { pt.x = e.touches[0].clientX; pt.y = e.touches[0].clientY; }
    else { pt.x = e.clientX; pt.y = e.clientY; }
    const svgP = pt.matrixTransform(contentRef.current.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.1), 10));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (showCenterTool) {
      const dist = Math.sqrt(Math.pow(pos.x - centerPoint.x, 2) + Math.pow(pos.y - centerPoint.y, 2));
      if (dist < 30 / scale) {
        setDragMode({ type: 'center' });
        return;
      }
    }
    if (isBrushMode && activeTool) {
      setDragMode({ type: 'brush' });
      setTempPoints([pos]);
      return;
    }
    if (!activeTool) {
      setDragMode({ type: 'pan', startPos: { x: e.clientX, y: e.clientY } });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragMode) return;
    const pos = getMousePos(e);
    
    if (dragMode.type === 'center') {
      setCenterPoint({ x: snap(pos.x), y: snap(pos.y) });
      return;
    }

    if (dragMode.type === 'brush') {
      const lastPt = tempPoints[tempPoints.length - 1];
      const dist = Math.sqrt(Math.pow(pos.x - lastPt.x, 2) + Math.pow(pos.y - lastPt.y, 2));
      if (dist > 30) setTempPoints(prev => [...prev, pos]);
      return;
    }
    if (dragMode.type === 'pan' && dragMode.startPos) {
      const dx = e.clientX - dragMode.startPos.x;
      const dy = e.clientY - dragStart.y;
      setViewPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragMode({ ...dragMode, startPos: { x: e.clientX, y: e.clientY } });
      return;
    }
    if (!selectedId) return;
    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;
      if (el.locked) return el;
      const pts = getElementPoints(el);
      const dragIdx = dragMode.index;
      let newPoints = [...pts];
      if (dragMode.type === 'vertex' && dragIdx !== undefined) {
        newPoints[dragIdx] = { x: snap(pos.x), y: snap(pos.y) };
      } else if (dragMode.type === 'move') {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const dx = snap(pos.x) - centerX;
        const dy = snap(pos.y) - centerY;
        newPoints = pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
      } else if (dragMode.type === 'rotate') {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI);
        return { ...el, rotation: angle + 90 };
      }
      return { ...el, points: newPoints, x: newPoints[0].x, y: newPoints[0].y };
    }));
  };

  const handleMouseUp = () => {
    setDragMode(null);
    setTempPoints([]);
  };

  const pointsToPath = (points: Point[], closed = true) => {
    if (!points || points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    return closed ? path + " Z" : path;
  };

  const isSelected = (id: string) => selectedId === id;
  const sortedElements = [...elements].sort((a, b) => {
    const layerOrder: Record<string, number> = { 'reference_image': -2, 'green': -1, 'label_area': 0, 'road': 1, 'pitch': 2, 'amenity': 2, 'house': 3, 'tower': 3, 'text': 4 };
    return (layerOrder[a.type] || 0) - (layerOrder[b.type] || 0);
  });

  return (
    <div className={cn("flex flex-col gap-4 transition-all duration-300", isFullScreen ? "fixed inset-0 z-50 bg-slate-50 p-6" : "h-[calc(100vh-120px)]")} dir="rtl">
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(s + 0.2, 5))}><ZoomIn size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(s - 0.2, 0.1))}><ZoomOut size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setScale(1); setViewPos({x:0, y:0}); }}><RotateCcw size={18} /></Button>
          </div>
          <Button variant={gridLock ? "default" : "outline"} size="icon" onClick={() => setGridLock(!gridLock)} className={cn("rounded-xl", gridLock && "bg-indigo-600")}><Grid3X3 size={18} /></Button>
          <Button variant={showCenterTool ? "default" : "outline"} size="icon" onClick={() => setShowCenterTool(!showCenterTool)} className={cn("rounded-xl", showCenterTool && "bg-rose-600")} title="تحديد نقطة المنتصف"><Target size={18} /></Button>
          <Button variant="outline" size="icon" onClick={() => setIsFullScreen(!isFullScreen)} className="rounded-xl">
            {isFullScreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </Button>
        </div>
        <Button onClick={() => onSave(elements, dims.w, dims.h, centerPoint.x, centerPoint.y)} className="bg-emerald-600 hover:bg-emerald-700 gap-2 rounded-xl px-6"><Save size={18} /> حفظ المخطط</Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-20 flex flex-col gap-2 bg-white p-2 rounded-[2rem] border border-slate-200 shadow-xl overflow-y-auto no-scrollbar">
          <button onClick={() => { setActiveTool(null); setIsBrushMode(false); }} className={cn("w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all", !activeTool && !isBrushMode ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}>
            <MousePointer2 size={20} />
            <span className="text-[10px] font-bold">تصفح</span>
          </button>
          {/* ... rest of tools ... */}
        </div>

        <div className="flex-1 relative bg-slate-200 rounded-[2.5rem] border-8 border-white shadow-inner overflow-hidden touch-none">
          <svg ref={svgRef} className={cn("w-full h-full", isBrushMode || showCenterTool ? "cursor-crosshair" : !activeTool ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair")} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel}>
            <g ref={contentRef} style={{ transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
              <defs>
                <pattern id="grid-editor" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse"><path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5"/></pattern>
              </defs>
              <rect width={dims.w} height={dims.h} fill="url(#grid-editor)" />
              
              {sortedElements.map((el) => {
                const pts = getElementPoints(el);
                const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
                const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
                const isSelectedEl = isSelected(el.id);
                const pathD = pointsToPath(pts, !el.isStroke);

                return (
                  <g key={el.id} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                    <path d={pathD} fill={el.isStroke ? "none" : (el.color || '#ffffff')} stroke={el.isStroke ? (el.color || '#000000') : '#000000'} strokeWidth={el.isStroke ? el.strokeWidth : 2} onMouseDown={(e) => { setSelectedId(el.id); if (!el.locked) { e.stopPropagation(); setDragMode({ type: 'move' }); } }} />
                  </g>
                );
              })}

              {showCenterTool && (
                <g transform={`translate(${centerPoint.x}, ${centerPoint.y})`} className="cursor-move">
                  <circle r={20} fill="rgba(225, 29, 72, 0.2)" stroke="#e11d48" strokeWidth="2" strokeDasharray="4,2" />
                  <line x1="-25" y1="0" x2="25" y2="0" stroke="#e11d48" strokeWidth="2" />
                  <line x1="0" y1="-25" x2="0" y2="25" stroke="#e11d48" strokeWidth="2" />
                  <circle r={4} fill="#e11d48" />
                  <text y={35} textAnchor="middle" className="text-[12px] font-black fill-rose-600 select-none">نقطة المنتصف</text>
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
};

export default MapEditor;