"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MapElement, ElementType, Point } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, Home, Building2, Leaf, 
  Waypoints, MapPin, Grid3X3,
  ZoomIn, ZoomOut, RotateCcw, Type, Settings2,
  Trophy, Store, GraduationCap, Stethoscope, Baby, ShoppingBag, Dumbbell, ShoppingCart,
  Copy, X, MoonStar, Maximize2, Minimize2, EyeOff, Eye, Paintbrush, MousePointer2,
  SlidersHorizontal
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[], width: number, height: number) => void;
  mapWidth: number;
  mapHeight: number;
}

const GRID_SIZE = 10;

const TOOLS: { type: ElementType; label: string; icon: any; color: string }[] = [
  { type: 'house', label: 'منزل', icon: Home, color: 'bg-blue-500' },
  { type: 'tower', label: 'برج', icon: Building2, color: 'bg-slate-700' },
  { type: 'road', label: 'طريق', icon: Waypoints, color: 'bg-gray-400' },
  { type: 'green', label: 'مساحة خضراء', icon: Leaf, color: 'bg-emerald-500' },
  { type: 'pitch', label: 'ملعب', icon: Trophy, color: 'bg-green-600' },
  { type: 'amenity', label: 'مرفق', icon: MapPin, color: 'bg-amber-500' },
  { type: 'text', label: 'نص', icon: Type, color: 'bg-rose-500' },
  { type: 'label_area', label: 'منطقة تسمية', icon: Type, color: 'bg-purple-500' },
];

const MapEditor = ({ initialElements, onSave, mapWidth, mapHeight }: MapEditorProps) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ElementType | null>(null);
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [dragMode, setDragMode] = useState<{ type: 'move' | 'vertex' | 'edge' | 'rotate' | 'pan' | 'brush', startPos?: Point, index?: number } | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [gridLock, setGridLock] = useState(true);
  const [dims, setDims] = useState({ w: mapWidth, h: mapHeight });
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const [scale, setScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);

  const snap = (val: number) => gridLock ? Math.round(val / GRID_SIZE) * GRID_SIZE : Math.round(val);

  // تحريك العناصر بالأسهم
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setElements(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null);
        return;
      }

      const step = gridLock ? GRID_SIZE : 1;
      let dx = 0, dy = 0;
      if (e.key === 'ArrowUp') dy = -step;
      else if (e.key === 'ArrowDown') dy = step;
      else if (e.key === 'ArrowLeft') dx = -step;
      else if (e.key === 'ArrowRight') dx = step;
      else return;

      e.preventDefault();
      setElements(prev => prev.map(el => {
        if (el.id !== selectedId) return el;
        const pts = getElementPoints(el);
        const newPoints = pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
        return { ...el, points: newPoints };
      }));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, gridLock]);

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

  const getElementPoints = (el: MapElement): Point[] => {
    if (el.points && el.points.length > 0) return el.points;
    return [
      { x: el.x, y: el.y },
      { x: el.x + el.width, y: el.y },
      { x: el.x + el.width, y: el.y + el.height },
      { x: el.x, y: el.y + el.height },
    ];
  };

  const createElement = (type: ElementType, pts: Point[], isStroke = false) => {
    const newElement: MapElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: type === 'text' ? 'نص جديد' : (type === 'house' ? 'D1' : type === 'tower' ? 'T1' : ''),
      points: pts,
      rotation: 0,
      orientation: 'horizontal',
      color: type === 'label_area' ? '#a855f7' : (type === 'amenity' ? '#f59e0b' : (type === 'text' ? '#e11d48' : undefined)),
      textColor: type === 'text' ? '#e11d48' : '#1e293b',
      fontSize: type === 'text' ? 24 : 10,
      opacity: type === 'label_area' ? 0.2 : 1,
      hideIcon: type === 'text',
      x: pts[0].x, y: pts[0].y, width: 0, height: 0,
      isStroke: isStroke,
      strokeWidth: isStroke ? brushSize : undefined,
      floors: type === 'tower' ? 5 : undefined,
      apartmentsPerFloor: type === 'tower' ? 4 : undefined,
      amenityType: type === 'amenity' ? 'shop' : undefined
    };
    setElements(prev => [...prev, newElement]);
    setSelectedId(newElement.id);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const isBackground = e.target === svgRef.current || (e.target as SVGElement).id === 'map-background';
    if (dragMode || !isBackground || !activeTool || isBrushMode) return;
    const pos = getMousePos(e);
    const w = activeTool === 'road' ? 200 : (activeTool === 'text' ? 100 : 80);
    const h = activeTool === 'road' ? 40 : (activeTool === 'text' ? 40 : 80);
    const newPoints = [
      { x: snap(pos.x - w/2), y: snap(pos.y - h/2) },
      { x: snap(pos.x + w/2), y: snap(pos.y - h/2) },
      { x: snap(pos.x + w/2), y: snap(pos.y + h/2) },
      { x: snap(pos.x - w/2), y: snap(pos.y + h/2) },
    ];
    createElement(activeTool, newPoints);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const isBackground = e.target === svgRef.current || (e.target as SVGElement).id === 'map-background';
    const pos = getMousePos(e);
    if (isBrushMode && activeTool && isBackground) {
      setDragMode({ type: 'brush' });
      setTempPoints([pos]);
      return;
    }
    if (isBackground && !activeTool) {
      setDragMode({ type: 'pan', startPos: { x: e.clientX, y: e.clientY } });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragMode) return;
    const pos = getMousePos(e);
    if (dragMode.type === 'brush') {
      const lastPt = tempPoints[tempPoints.length - 1];
      if (Math.sqrt(Math.pow(pos.x - lastPt.x, 2) + Math.pow(pos.y - lastPt.y, 2)) > 20) {
        setTempPoints(prev => [...prev, pos]);
      }
      return;
    }
    if (dragMode.type === 'pan' && dragMode.startPos) {
      setViewPos(prev => ({ x: prev.x + (e.clientX - dragMode.startPos!.x), y: prev.y + (e.clientY - dragMode.startPos!.y) }));
      setDragMode({ ...dragMode, startPos: { x: e.clientX, y: e.clientY } });
      return;
    }
    if (!selectedId) return;
    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;
      const pts = getElementPoints(el);
      let newPoints = [...pts];
      if (dragMode.type === 'vertex' && dragMode.index !== undefined) {
        newPoints[dragMode.index] = { x: snap(pos.x), y: snap(pos.y) };
      } else if (dragMode.type === 'move') {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const dx = snap(pos.x) - centerX, dy = snap(pos.y) - centerY;
        newPoints = pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
      } else if (dragMode.type === 'rotate') {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI);
        return { ...el, rotation: angle + 90 };
      }
      return { ...el, points: newPoints };
    }));
  };

  const handleMouseUp = () => {
    if (dragMode?.type === 'brush' && activeTool && tempPoints.length > 1) createElement(activeTool, tempPoints, true);
    setDragMode(null);
    setTempPoints([]);
  };

  const pointsToPath = (points: Point[], closed = true) => {
    if (!points || points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    return closed ? path + " Z" : path;
  };

  const renderPitchLines = (pts: Point[]) => {
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    return (
      <g pointerEvents="none">
        <line x1={midX} y1={minY} x2={midX} y2={maxY} stroke="white" strokeWidth="2" />
        <circle cx={midX} cy={midY} r={Math.min(maxX - minX, maxY - minY) / 6} fill="none" stroke="white" strokeWidth="2" />
        <rect x={minX} y={midY - (maxY - minY)/4} width={(maxX - minX)/6} height={(maxY - minY)/2} fill="none" stroke="white" strokeWidth="2" />
        <rect x={maxX - (maxX - minX)/6} y={midY - (maxY - minY)/4} width={(maxX - minX)/6} height={(maxY - minY)/2} fill="none" stroke="white" strokeWidth="2" />
      </g>
    );
  };

  const selectedElement = elements.find(el => el.id === selectedId);

  return (
    <div className={cn("flex flex-col gap-4 transition-all", isFullScreen ? "fixed inset-0 z-50 bg-slate-100 p-6" : "h-[calc(100vh-120px)]")} dir="rtl">
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(s + 0.2, 5))}><ZoomIn size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(s - 0.2, 0.1))}><ZoomOut size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setScale(1); setViewPos({x:0, y:0}); }}><RotateCcw size={18} /></Button>
          </div>
          <Button variant={gridLock ? "default" : "outline"} size="icon" onClick={() => setGridLock(!gridLock)} className={cn("rounded-xl", gridLock && "bg-indigo-600")}><Grid3X3 size={18} /></Button>
          <Button variant="outline" size="icon" onClick={() => setIsFullScreen(!isFullScreen)} className="rounded-xl">
            {isFullScreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </Button>
        </div>
        <Button onClick={() => onSave(elements, dims.w, dims.h)} className="bg-emerald-600 hover:bg-emerald-700 gap-2 rounded-xl px-6"><Save size={18} /> حفظ المخطط</Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-20 flex flex-col gap-2 bg-white p-2 rounded-[2rem] border border-slate-200 shadow-xl overflow-y-auto no-scrollbar">
          <button onClick={() => { setActiveTool(null); setIsBrushMode(false); }} className={cn("w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all", !activeTool && !isBrushMode ? "bg-indigo-600 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}>
            <MousePointer2 size={20} />
            <span className="text-[10px] font-bold">تصفح</span>
          </button>
          <div className="h-px bg-slate-100 mx-2" />
          {TOOLS.map((tool) => (
            <button key={tool.type} onClick={() => { setActiveTool(tool.type); setIsBrushMode(false); }} className={cn("w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all", activeTool === tool.type && !isBrushMode ? `${tool.color} text-white shadow-lg` : "bg-slate-50 text-slate-400 hover:bg-slate-100")}>
              <tool.icon size={20} />
              <span className="text-[10px] font-bold">{tool.label}</span>
            </button>
          ))}
          <div className="h-px bg-slate-100 mx-2" />
          <button onClick={() => setIsBrushMode(!isBrushMode)} className={cn("w-full aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all", isBrushMode ? "bg-slate-900 text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100")}>
            <Paintbrush size={20} />
            <span className="text-[10px] font-bold">فرشاة</span>
          </button>
        </div>

        <div className="flex-1 relative bg-slate-200 rounded-[2.5rem] border-8 border-white shadow-inner overflow-hidden touch-none">
          <svg ref={svgRef} className="w-full h-full" onClick={handleCanvasClick} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel}>
            <g ref={contentRef} style={{ transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
              <defs>
                <pattern id="grid-editor" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse"><path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5"/></pattern>
                <pattern id="green-pattern" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#22c55e" /><path d="M 2 8 L 5 2 L 8 8" fill="none" stroke="#15803d" strokeWidth="0.5" opacity="0.3" /></pattern>
              </defs>
              <rect id="map-background" width={dims.w} height={dims.h} fill="url(#grid-editor)" />
              
              {elements.map((el) => {
                const pts = getElementPoints(el);
                const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
                const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
                const isSelected = selectedId === el.id;

                return (
                  <g key={el.id} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                    <path 
                      d={pointsToPath(pts, !el.isStroke)} 
                      fill={el.isStroke ? "none" : (el.type === 'road' ? '#475569' : (el.type === 'green' ? 'url(#green-pattern)' : (el.type === 'text' ? 'none' : (el.color || '#ffffff'))))} 
                      stroke={el.isStroke ? (el.color || '#475569') : (isSelected ? '#2563eb' : (el.type === 'road' ? '#475569' : (el.type === 'green' ? '#22c55e' : (el.type === 'text' ? 'none' : '#cbd5e1'))))} 
                      fillOpacity={el.type === 'label_area' ? el.opacity : 1} 
                      strokeWidth={el.isStroke ? el.strokeWidth : (el.type === 'road' ? 10 : (isSelected ? 3 : 2))} 
                      strokeLinejoin="round" strokeLinecap="round" className="cursor-move"
                      onMouseDown={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode({ type: 'move' }); }} 
                    />
                    {el.type === 'pitch' && renderPitchLines(pts)}
                    
                    {el.type === 'road' && !el.isStroke && (
                      el.orientation === 'vertical' ? 
                      <line x1={centerX} y1={Math.min(...pts.map(p=>p.y))} x2={centerX} y2={Math.max(...pts.map(p=>p.y))} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" /> :
                      <line x1={Math.min(...pts.map(p=>p.x))} y1={centerY} x2={Math.max(...pts.map(p=>p.x))} y2={centerY} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" />
                    )}

                    {el.type === 'text' ? (
                      <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" fill={el.textColor} fontSize={el.fontSize} fontWeight="black" className="pointer-events-none select-none">{el.label}</text>
                    ) : el.label && (
                      <text x={centerX} y={centerY + 15} textAnchor="middle" dominantBaseline="middle" fill={el.textColor || '#1e293b'} fontSize={10} fontWeight="black" className="pointer-events-none select-none">{el.label}</text>
                    )}

                    {isSelected && (
                      <>
                        {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={6} className="fill-white stroke-blue-600 stroke-2 cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'vertex', index: i }); }} />)}
                        <circle cx={centerX} cy={Math.min(...pts.map(p=>p.y)) - 30} r={8} className="fill-blue-600 cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'rotate' }); }} />
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="w-80 flex flex-col gap-4">
          {isBrushMode && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-6 space-y-4">
              <div className="flex items-center gap-3"><SlidersHorizontal className="text-slate-800" /><h3 className="font-black">إعدادات الفرشاة</h3></div>
              <Slider value={[brushSize]} min={10} max={200} step={5} onValueChange={(val) => setBrushSize(val[0])} />
            </div>
          )}

          {selectedElement && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl flex flex-col overflow-hidden">
              <div className="p-6 border-b flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3"><Settings2 className="text-indigo-600" /><h3 className="font-black">خصائص العنصر</h3></div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} className="rounded-full"><X size={18} /></Button>
              </div>
              <div className="p-6 space-y-6 overflow-y-auto no-scrollbar">
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-400">التسمية / النص</Label>
                  <Input value={selectedElement.label} onChange={(e) => setElements(prev => prev.map(el => el.id === selectedId ? { ...el, label: e.target.value } : el))} className="rounded-xl font-bold" />
                </div>

                {selectedElement.type === 'text' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-400">حجم الخط</Label>
                      <Slider value={[selectedElement.fontSize || 24]} min={10} max={100} step={2} onValueChange={(val) => setElements(prev => prev.map(el => el.id === selectedId ? { ...el, fontSize: val[0] } : el))} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-400">لون النص</Label>
                      <Input type="color" value={selectedElement.textColor} onChange={(e) => setElements(prev => prev.map(el => el.id === selectedId ? { ...el, textColor: e.target.value } : el))} className="h-12 rounded-xl" />
                    </div>
                  </div>
                )}

                {selectedElement.type === 'road' && (
                  <div className="space-y-2">
                    <Label className="text-xs font-black text-slate-400">اتجاه خطوط السير</Label>
                    <Select value={selectedElement.orientation} onValueChange={(val) => setElements(prev => prev.map(el => el.id === selectedId ? { ...el, orientation: val as any } : el))}>
                      <SelectTrigger className="rounded-xl font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="horizontal">أفقي</SelectItem>
                        <SelectItem value="vertical">عمودي</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => {
                    const pts = getElementPoints(selectedElement);
                    const dx = Math.max(...pts.map(p=>p.x)) - Math.min(...pts.map(p=>p.x));
                    createElement(selectedElement.type, pts.map(p => ({ x: p.x + dx, y: p.y })));
                  }} className="rounded-xl gap-2 font-bold"><Copy size={16} /> تكرار</Button>
                  <Button variant="destructive" onClick={() => { setElements(prev => prev.filter(el => el.id !== selectedId)); setSelectedId(null); }} className="rounded-xl gap-2 font-black"><Trash2 size={16} /> حذف</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapEditor;