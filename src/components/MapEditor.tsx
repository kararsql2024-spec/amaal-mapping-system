"use client";

import React, { useState, useRef } from 'react';
import { MapElement, ElementType, Point } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, Home, Building2, TreeDeciduous, 
  MoveRight, Coffee, Grid3X3, RotateCw,
  ZoomIn, ZoomOut, RotateCcw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[]) => void;
  mapWidth: number;
  mapHeight: number;
}

const GRID_SIZE = 10;

const TOOLS: { type: ElementType; label: string; icon: any; color: string }[] = [
  { type: 'house', label: 'منزل', icon: Home, color: 'bg-blue-500' },
  { type: 'tower', label: 'برج', icon: Building2, color: 'bg-slate-700' },
  { type: 'road', label: 'طريق', icon: MoveRight, color: 'bg-gray-400' },
  { type: 'green', label: 'مساحة خضراء', icon: TreeDeciduous, color: 'bg-emerald-500' },
  { type: 'amenity', label: 'مرفق', icon: Coffee, color: 'bg-amber-500' },
];

const MapEditor = ({ initialElements, onSave, mapWidth, mapHeight }: MapEditorProps) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ElementType>('house');
  const [dragMode, setDragMode] = useState<{ type: 'move' | 'vertex' | 'rotate' | 'pan', index?: number } | null>(null);
  const [gridLock, setGridLock] = useState(true);
  
  const [scale, setScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  
  const svgRef = useRef<SVGSVGElement>(null);

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

  const getMousePos = (e: React.MouseEvent) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (dragMode || e.target !== svgRef.current) return;
    
    const pos = getMousePos(e);
    const w = 60, h = 60;
    
    const newElement: MapElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: activeTool,
      label: activeTool === 'house' ? `H${elements.filter(el => el.type === 'house').length + 1}` : 
             activeTool === 'tower' ? `T${elements.filter(el => el.type === 'tower').length + 1}` : '',
      points: [
        { x: snap(pos.x - w/2), y: snap(pos.y - h/2) },
        { x: snap(pos.x + w/2), y: snap(pos.y - h/2) },
        { x: snap(pos.x + w/2), y: snap(pos.y + h/2) },
        { x: snap(pos.x - w/2), y: snap(pos.y + h/2) },
      ],
      rotation: 0,
      x: pos.x, y: pos.y, width: w, height: h,
      floors: activeTool === 'tower' ? 5 : undefined,
      apartmentsPerFloor: activeTool === 'tower' ? 4 : undefined,
    };

    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragMode || !svgRef.current || !selectedId) return;
    const pos = getMousePos(e);

    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;
      const pts = getElementPoints(el);

      if (dragMode.type === 'vertex' && dragMode.index !== undefined) {
        const newPoints = [...pts];
        newPoints[dragMode.index] = { x: snap(pos.x), y: snap(pos.y) };
        return { ...el, points: newPoints };
      }

      if (dragMode.type === 'move') {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const dx = snap(pos.x) - centerX;
        const dy = snap(pos.y) - centerY;
        return { ...el, points: pts.map(p => ({ x: p.x + dx, y: p.y + dy })) };
      }

      if (dragMode.type === 'rotate') {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI);
        return { ...el, rotation: angle + 90, points: pts };
      }

      return el;
    }));
  };

  const pointsToPath = (points: Point[]) => {
    if (!points || points.length === 0) return "";
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + " Z";
  };

  const getElementColor = (type: ElementType) => {
    switch (type) {
      case 'house': return 'fill-white stroke-blue-400';
      case 'tower': return 'fill-slate-800 stroke-slate-900';
      case 'road': return 'fill-gray-300 stroke-gray-400';
      case 'green': return 'fill-emerald-100 stroke-emerald-500';
      case 'amenity': return 'fill-amber-50 stroke-amber-500';
      default: return 'fill-white stroke-slate-300';
    }
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-200px)]" dir="rtl">
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          {TOOLS.map((tool) => (
            <button key={tool.type} onClick={() => setActiveTool(tool.type)} className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all", activeTool === tool.type ? `${tool.color} text-white shadow-lg scale-105` : "bg-slate-50 text-slate-600 hover:bg-slate-100")}>
              <tool.icon size={18} />
              <span className="hidden md:inline">{tool.label}</span>
            </button>
          ))}
          <div className="w-px h-8 bg-slate-200 mx-2" />
          <Button variant={gridLock ? "default" : "outline"} size="icon" onClick={() => setGridLock(!gridLock)} className={cn("rounded-xl", gridLock && "bg-indigo-600")}>
            <Grid3X3 size={18} />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(s + 0.2, 5))}><ZoomIn size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(s - 0.2, 0.5))}><ZoomOut size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setScale(1); setViewPos({x:0, y:0}); }}><RotateCcw size={18} /></Button>
          </div>
          <Button onClick={() => onSave(elements)} className="bg-emerald-600 hover:bg-emerald-700 gap-2 rounded-xl px-6">
            <Save size={18} /> حفظ المخطط
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
        <div className="lg:col-span-3 relative bg-slate-200 rounded-[2.5rem] border-8 border-white shadow-inner overflow-hidden">
          <svg 
            ref={svgRef} 
            viewBox={`0 0 ${mapWidth} ${mapHeight}`} 
            className="w-full h-full cursor-crosshair" 
            onClick={handleCanvasClick} 
            onMouseMove={handleMouseMove} 
            onMouseUp={() => setDragMode(null)}
            style={{ transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`, transformOrigin: '0 0' }}
          >
            <defs>
              <pattern id="grid-editor" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="#cbd5e1" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-editor)" />
            
            {elements.map((el) => {
              const pts = getElementPoints(el);
              const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
              const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
              const isSelected = selectedId === el.id;

              return (
                <g key={el.id} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                  <path
                    d={pointsToPath(pts)}
                    className={cn("transition-all stroke-2 cursor-move", getElementColor(el.type), isSelected && "stroke-blue-600 stroke-[3px] filter drop-shadow-lg")}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode({ type: 'move' }); }}
                  />
                  
                  {el.label && (
                    <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" className={cn("text-[12px] font-black pointer-events-none select-none", el.type === 'tower' ? "fill-white" : "fill-slate-700")}>
                      {el.label}
                    </text>
                  )}

                  {isSelected && (
                    <>
                      {pts.map((p, i) => (
                        <circle
                          key={i}
                          cx={p.x}
                          cy={p.y}
                          r={6}
                          className="fill-white stroke-blue-600 stroke-2 cursor-pointer hover:r-8 transition-all"
                          onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'vertex', index: i }); }}
                        />
                      ))}
                      <line x1={centerX} y1={pts[0].y} x2={centerX} y2={pts[0].y - 30} className="stroke-blue-600 stroke-2" />
                      <circle
                        cx={centerX}
                        cy={pts[0].y - 30}
                        r={8}
                        className="fill-blue-600 cursor-pointer"
                        onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'rotate' }); }}
                      />
                    </>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 overflow-y-auto">
          <h3 className="font-black text-xl border-b pb-4 text-slate-800">خصائص العنصر</h3>
          {selectedId ? (
            <div className="space-y-5">
              {elements.find(el => el.id === selectedId) && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">تسمية الوحدة</label>
                    <input type="text" className="w-full p-3 rounded-xl border border-slate-200" value={elements.find(el => el.id === selectedId)?.label} onChange={(e) => setElements(elements.map(el => el.id === selectedId ? {...el, label: e.target.value} : el))} />
                  </div>
                  
                  {elements.find(el => el.id === selectedId)?.type === 'tower' && (
                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عدد الطوابق</label><input type="number" className="w-full p-2 rounded-lg border border-slate-200" value={elements.find(el => el.id === selectedId)?.floors} onChange={(e) => setElements(elements.map(el => el.id === selectedId ? {...el, floors: parseInt(e.target.value)} : el))} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold text-slate-500">شقق/طابق</label><input type="number" className="w-full p-2 rounded-lg border border-slate-200" value={elements.find(el => el.id === selectedId)?.apartmentsPerFloor} onChange={(e) => setElements(elements.map(el => el.id === selectedId ? {...el, apartmentsPerFloor: parseInt(e.target.value)} : el))} /></div>
                    </div>
                  )}

                  <Button variant="destructive" className="w-full gap-2 rounded-xl h-12 font-bold" onClick={() => { setElements(elements.filter(el => el.id !== selectedId)); setSelectedId(null); }}><Trash2 size={18} /> حذف العنصر</Button>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400"><p className="font-bold">حدد عنصراً من الخريطة لتعديله</p></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapEditor;