D3) عند تكرار المنازل.">
"use client";

import React, { useState, useRef } from 'react';
import { MapElement, ElementType, Point } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, Home, Building2, TreeDeciduous, 
  MoveRight, Coffee, Grid3X3, ArrowDown, ArrowLeft,
  ZoomIn, ZoomOut, RotateCcw, Type
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
  { type: 'label_area', label: 'منطقة تسمية', icon: Type, color: 'bg-purple-500' },
];

const MapEditor = ({ initialElements, onSave, mapWidth, mapHeight }: MapEditorProps) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ElementType>('house');
  const [dragMode, setDragMode] = useState<{ type: 'move' | 'vertex' | 'edge' | 'rotate' | 'pan', index?: number } | null>(null);
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
      label: activeTool === 'house' ? `D1` : 
             activeTool === 'tower' ? `T1` : 
             activeTool === 'label_area' ? 'منطقة جديدة' : '',
      points: [
        { x: snap(pos.x - w/2), y: snap(pos.y - h/2) },
        { x: snap(pos.x + w/2), y: snap(pos.y - h/2) },
        { x: snap(pos.x + w/2), y: snap(pos.y + h/2) },
        { x: snap(pos.x - w/2), y: snap(pos.y + h/2) },
      ],
      rotation: 0,
      color: activeTool === 'label_area' ? '#a855f7' : undefined,
      opacity: activeTool === 'label_area' ? 0.2 : 1,
      x: pos.x, y: pos.y, width: w, height: h,
      floors: activeTool === 'tower' ? 5 : undefined,
      apartmentsPerFloor: activeTool === 'tower' ? 4 : undefined,
    };

    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const handleDuplicate = (direction: 'right' | 'down') => {
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;

    const pts = getElementPoints(el);
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    const w = maxX - minX;
    const h = maxY - minY;

    const offset = direction === 'right' ? { x: w + 10, y: 0 } : { x: 0, y: h + 10 };

    // منطق التسمية الفردية: D1 -> D3 -> D5
    let newLabel = el.label;
    const match = el.label.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1]);
      const prefix = el.label.substring(0, match.index);
      newLabel = `${prefix}${num + 2}`;
    }

    const newElement: MapElement = {
      ...el,
      id: Math.random().toString(36).substr(2, 9),
      points: pts.map(p => ({ x: p.x + offset.x, y: p.y + offset.y })),
      label: newLabel
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

      if (dragMode.type === 'edge' && dragMode.index !== undefined) {
        const idx1 = dragMode.index;
        const idx2 = (dragMode.index + 1) % pts.length;
        const midX = (pts[idx1].x + pts[idx2].x) / 2;
        const midY = (pts[idx1].y + pts[idx2].y) / 2;
        const dx = snap(pos.x) - midX;
        const dy = snap(pos.y) - midY;
        const newPoints = [...pts];
        newPoints[idx1] = { x: pts[idx1].x + dx, y: pts[idx1].y + dy };
        newPoints[idx2] = { x: pts[idx2].x + dx, y: pts[idx2].y + dy };
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

  const handleSizeChange = (id: string, dimension: 'width' | 'height', newVal: number) => {
    setElements(prev => prev.map(el => {
      if (el.id !== id) return el;
      const pts = getElementPoints(el);
      const minX = Math.min(...pts.map(p => p.x));
      const maxX = Math.max(...pts.map(p => p.x));
      const minY = Math.min(...pts.map(p => p.y));
      const maxY = Math.max(...pts.map(p => p.y));
      const currentW = maxX - minX;
      const currentH = maxY - minY;

      if (dimension === 'width') {
        const ratio = newVal / (currentW || 1);
        return { ...el, points: pts.map(p => ({ x: minX + (p.x - minX) * ratio, y: p.y })) };
      } else {
        const ratio = newVal / (currentH || 1);
        return { ...el, points: pts.map(p => ({ x: p.x, y: minY + (p.y - minY) * ratio })) };
      }
    }));
  };

  const pointsToPath = (points: Point[]) => {
    if (!points || points.length === 0) return "";
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + " Z";
  };

  const getElementColor = (el: MapElement) => {
    if (el.type === 'label_area') return el.color || '#a855f7';
    switch (el.type) {
      case 'house': return '#ffffff';
      case 'tower': return '#1e293b';
      case 'road': return '#d1d5db';
      case 'green': return '#d1fae5';
      case 'amenity': return '#fffbeb';
      default: return '#ffffff';
    }
  };

  const getElementStroke = (el: MapElement) => {
    if (el.type === 'label_area') return el.color || '#a855f7';
    switch (el.type) {
      case 'house': return '#60a5fa';
      case 'tower': return '#0f172a';
      case 'road': return '#9ca3af';
      case 'green': return '#10b981';
      case 'amenity': return '#f59e0b';
      default: return '#cbd5e1';
    }
  };

  const selectedElement = elements.find(el => el.id === selectedId);
  const selectedPts = selectedElement ? getElementPoints(selectedElement) : [];
  const boundingBox = selectedPts.length > 0 ? {
    w: Math.round(Math.max(...selectedPts.map(p => p.x)) - Math.min(...selectedPts.map(p => p.x))),
    h: Math.round(Math.max(...selectedPts.map(p => p.y)) - Math.min(...selectedPts.map(p => p.y))),
    minY: Math.min(...selectedPts.map(p => p.y)),
    minX: Math.min(...selectedPts.map(p => p.x)),
    maxX: Math.max(...selectedPts.map(p => p.x))
  } : { w: 0, h: 0, minY: 0, minX: 0, maxX: 0 };

  const sortedElements = [...elements].sort((a, b) => {
    if (a.type === 'label_area' && b.type !== 'label_area') return -1;
    if (a.type !== 'label_area' && b.type === 'label_area') return 1;
    return 0;
  });

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
            
            {sortedElements.map((el) => {
              const pts = getElementPoints(el);
              const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
              const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
              const isSelected = selectedId === el.id;
              
              const minY = Math.min(...pts.map(p => p.y));
              const minX = Math.min(...pts.map(p => p.x));
              const maxX = Math.max(...pts.map(p => p.x));
              const topCenterX = (minX + maxX) / 2;

              return (
                <g key={el.id} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                  <path
                    d={pointsToPath(pts)}
                    fill={getElementColor(el)}
                    stroke={getElementStroke(el)}
                    fillOpacity={el.type === 'label_area' ? el.opacity : 1}
                    className={cn("transition-all stroke-2 cursor-move", isSelected && "stroke-blue-600 stroke-[3px] filter drop-shadow-lg")}
                    onMouseDown={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode({ type: 'move' }); }}
                  />
                  
                  {el.label && (
                    <text 
                      x={el.type === 'label_area' ? topCenterX : centerX} 
                      y={el.type === 'label_area' ? minY - 10 : centerY} 
                      textAnchor="middle" 
                      dominantBaseline={el.type === 'label_area' ? "auto" : "middle"}
                      className={cn(
                        "font-black pointer-events-none select-none", 
                        el.type === 'tower' ? "fill-white text-[12px]" : 
                        el.type === 'label_area' ? "fill-slate-800 text-[14px]" : "fill-slate-700 text-[12px]"
                      )}
                    >
                      {el.label}
                    </text>
                  )}

                  {isSelected && (
                    <>
                      {pts.map((p, i) => {
                        const nextP = pts[(i + 1) % pts.length];
                        return (
                          <line
                            key={`edge-${i}`}
                            x1={p.x} y1={p.y} x2={nextP.x} y2={nextP.y}
                            className="stroke-blue-400/50 stroke-[8px] cursor-move hover:stroke-blue-500/80 transition-all"
                            onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'edge', index: i }); }}
                          />
                        );
                      })}
                      {pts.map((p, i) => (
                        <circle
                          key={`vertex-${i}`}
                          cx={p.x} cy={p.y} r={6}
                          className="fill-white stroke-blue-600 stroke-2 cursor-pointer hover:r-8 transition-all"
                          onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'vertex', index: i }); }}
                        />
                      ))}
                      <line x1={centerX} y1={pts[0].y} x2={centerX} y2={pts[0].y - 30} className="stroke-blue-600 stroke-2" />
                      <circle
                        cx={centerX} cy={pts[0].y - 30} r={8}
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
          {selectedId && selectedElement ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500">تسمية الوحدة</label>
                <input type="text" className="w-full p-3 rounded-xl border border-slate-200" value={selectedElement.label} onChange={(e) => setElements(elements.map(el => el.id === selectedId ? {...el, label: e.target.value} : el))} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500">العرض (px)</label>
                  <input type="number" className="w-full p-3 rounded-xl border border-slate-200" value={boundingBox.w} onChange={(e) => handleSizeChange(selectedId, 'width', parseInt(e.target.value) || 1)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500">الطول (px)</label>
                  <input type="number" className="w-full p-3 rounded-xl border border-slate-200" value={boundingBox.h} onChange={(e) => handleSizeChange(selectedId, 'height', parseInt(e.target.value) || 1)} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-500">تكرار العنصر</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="rounded-xl gap-2" onClick={() => handleDuplicate('right')}><ArrowLeft size={16} /> لليسار</Button>
                  <Button variant="outline" className="rounded-xl gap-2" onClick={() => handleDuplicate('down')}><ArrowDown size={16} /> للأسفل</Button>
                </div>
              </div>
              
              {selectedElement.type === 'tower' && (
                <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عدد الطوابق</label><input type="number" className="w-full p-2 rounded-lg border border-slate-200" value={selectedElement.floors} onChange={(e) => setElements(elements.map(el => el.id === selectedId ? {...el, floors: parseInt(e.target.value)} : el))} /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">شقق/طابق</label><input type="number" className="w-full p-2 rounded-lg border border-slate-200" value={selectedElement.apartmentsPerFloor} onChange={(e) => setElements(elements.map(el => el.id === selectedId ? {...el, apartmentsPerFloor: parseInt(e.target.value)} : el))} /></div>
                </div>
              )}

              <Button variant="destructive" className="w-full gap-2 rounded-xl h-12 font-bold" onClick={() => { setElements(elements.filter(el => el.id !== selectedId)); setSelectedId(null); }}><Trash2 size={18} /> حذف العنصر</Button>
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