"use client";

import React, { useState, useRef } from 'react';
import { MapElement, ElementType, Point } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, Home, Building2, TreeDeciduous, 
  MoveRight, Coffee, Grid3X3, ArrowDown, ArrowLeft,
  ZoomIn, ZoomOut, RotateCcw, Type, Palette, Hand,
  Trophy, Store, School, HeartPulse, Baby, ShoppingBag, Dumbbell, ShoppingCart
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[]) => void;
  mapWidth: number;
  mapHeight: number;
}

const GRID_SIZE = 10;

const AMENITY_TYPES = [
  { id: 'shop', label: 'محل تجاري', icon: Store },
  { id: 'school', label: 'مدرسة', icon: School },
  { id: 'medical', label: 'مركز طبي', icon: HeartPulse },
  { id: 'nursery', label: 'حضانة', icon: Baby },
  { id: 'mall', label: 'مول', icon: ShoppingBag },
  { id: 'gym', label: 'جم', icon: Dumbbell },
  { id: 'supermarket', label: 'أسواق مركزية', icon: ShoppingCart },
];

const TOOLS: { type: ElementType; label: string; icon: any; color: string }[] = [
  { type: 'house', label: 'منزل', icon: Home, color: 'bg-blue-500' },
  { type: 'tower', label: 'برج', icon: Building2, color: 'bg-slate-700' },
  { type: 'road', label: 'طريق', icon: MoveRight, color: 'bg-gray-400' },
  { type: 'green', label: 'مساحة خضراء', icon: TreeDeciduous, color: 'bg-emerald-500' },
  { type: 'pitch', label: 'ملعب', icon: Trophy, color: 'bg-green-600' },
  { type: 'amenity', label: 'مرفق', icon: Coffee, color: 'bg-amber-500' },
  { type: 'label_area', label: 'منطقة تسمية', icon: Type, color: 'bg-purple-500' },
];

const MapEditor = ({ initialElements, onSave, mapWidth, mapHeight }: MapEditorProps) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ElementType | null>(null);
  const [dragMode, setDragMode] = useState<{ type: 'move' | 'vertex' | 'edge' | 'rotate' | 'pan', startPos?: Point } | null>(null);
  const [gridLock, setGridLock] = useState(true);
  
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

  const getMousePos = (e: React.MouseEvent | WheelEvent) => {
    if (!svgRef.current || !contentRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(contentRef.current.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.1), 10);
    setScale(newScale);
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    const isBackground = e.target === svgRef.current || (e.target as SVGElement).id === 'map-background';
    if (dragMode || !isBackground || !activeTool) return;
    
    const pos = getMousePos(e);
    const w = activeTool === 'road' ? 200 : 60;
    const h = activeTool === 'road' ? 40 : 60;
    
    const newElement: MapElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: activeTool,
      label: activeTool === 'house' ? `D1` : 
             activeTool === 'tower' ? `T1` : 
             activeTool === 'pitch' ? 'ملعب' :
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
      amenityType: activeTool === 'amenity' ? 'shop' : undefined,
    };

    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const isBackground = e.target === svgRef.current || (e.target as SVGElement).id === 'map-background';
    if (isBackground && !activeTool) {
      setDragMode({ type: 'pan', startPos: { x: e.clientX, y: e.clientY } });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragMode) return;

    if (dragMode.type === 'pan' && dragMode.startPos) {
      const dx = e.clientX - dragMode.startPos.x;
      const dy = e.clientY - dragMode.startPos.y;
      setViewPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragMode({ ...dragMode, startPos: { x: e.clientX, y: e.clientY } });
      return;
    }

    if (!selectedId) return;
    const pos = getMousePos(e);

    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;
      const pts = getElementPoints(el);
      const dragIdx = (dragMode as any).index;

      if (dragMode.type === 'vertex' && dragIdx !== undefined) {
        const newPoints = [...pts];
        newPoints[dragIdx] = { x: snap(pos.x), y: snap(pos.y) };
        return { ...el, points: newPoints };
      }

      if (dragMode.type === 'edge' && dragIdx !== undefined) {
        const idx1 = dragIdx;
        const idx2 = (dragIdx + 1) % pts.length;
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
      case 'road': return '#475569';
      case 'green': return '#22c55e';
      case 'pitch': return '#16a34a';
      case 'amenity': return '#f59e0b';
      default: return '#ffffff';
    }
  };

  const getElementStroke = (el: MapElement) => {
    if (el.type === 'label_area') return el.color || '#a855f7';
    switch (el.type) {
      case 'house': return '#3b82f6';
      case 'tower': return '#0f172a';
      case 'road': return '#1e293b';
      case 'green': return '#15803d';
      case 'pitch': return '#ffffff';
      case 'amenity': return '#d97706';
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
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
          <button 
            onClick={() => setActiveTool(null)} 
            className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap", !activeTool ? "bg-indigo-600 text-white shadow-lg scale-105" : "bg-slate-50 text-slate-600 hover:bg-slate-100")}
          >
            <Hand size={18} />
            <span className="hidden md:inline">تصفح</span>
          </button>
          <div className="w-px h-8 bg-slate-200 mx-1 shrink-0" />
          {TOOLS.map((tool) => (
            <button 
              key={tool.type} 
              onClick={() => setActiveTool(activeTool === tool.type ? null : tool.type)} 
              className={cn("flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap", activeTool === tool.type ? `${tool.color} text-white shadow-lg scale-105` : "bg-slate-50 text-slate-600 hover:bg-slate-100")}
            >
              <tool.icon size={18} />
              <span className="hidden md:inline">{tool.label}</span>
            </button>
          ))}
          <div className="w-px h-8 bg-slate-200 mx-2 shrink-0" />
          <Button variant={gridLock ? "default" : "outline"} size="icon" onClick={() => setGridLock(!gridLock)} className={cn("rounded-xl shrink-0", gridLock && "bg-indigo-600")}>
            <Grid3X3 size={18} />
          </Button>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(s + 0.2, 5))}><ZoomIn size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(s - 0.2, 0.1))}><ZoomOut size={18} /></Button>
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
            className={cn("w-full h-full", !activeTool ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair")}
            onClick={handleCanvasClick} 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove} 
            onMouseUp={() => setDragMode(null)}
            onWheel={handleWheel}
          >
            <g ref={contentRef} style={{ transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
              <defs>
                <pattern id="grid-editor" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="#cbd5e1" strokeWidth="0.5"/>
                </pattern>
              </defs>
              <rect id="map-background" width={mapWidth} height={mapHeight} fill="url(#grid-editor)" />
              
              {sortedElements.map((el) => {
                const pts = getElementPoints(el);
                const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
                const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
                const isSelected = selectedId === el.id;
                
                const minY = Math.min(...pts.map(p => p.y));
                const minX = Math.min(...pts.map(p => p.x));
                const maxX = Math.max(...pts.map(p => p.x));
                const maxY = Math.max(...pts.map(p => p.y));
                const topCenterX = (minX + maxX) / 2;
                const w = maxX - minX;
                const h = maxY - minY;

                return (
                  <g key={el.id} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                    <path
                      d={pointsToPath(pts)}
                      fill={getElementColor(el)}
                      stroke={getElementStroke(el)}
                      fillOpacity={el.type === 'label_area' ? el.opacity : 1}
                      strokeWidth={el.type === 'pitch' ? 2 : 1}
                      className={cn("transition-all stroke-2 cursor-move", isSelected && "stroke-blue-600 stroke-[3px] filter drop-shadow-lg")}
                      onMouseDown={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode({ type: 'move' }); }}
                    />
                    
                    {/* لمسات بصرية فنية */}
                    {el.type === 'road' && (
                      <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke="white" strokeWidth="2" strokeDasharray="10,10" pointerEvents="none" />
                    )}
                    
                    {el.type === 'pitch' && (
                      <g pointerEvents="none">
                        <circle cx={centerX} cy={centerY} r={h/6} fill="none" stroke="white" strokeWidth="1" />
                        <line x1={centerX} y1={minY} x2={centerX} y2={maxY} stroke="white" strokeWidth="1" />
                        <rect x={minX} y={centerY - h/4} width={w/6} height={h/2} fill="none" stroke="white" strokeWidth="1" />
                        <rect x={maxX - w/6} y={centerY - h/4} width={w/6} height={h/2} fill="none" stroke="white" strokeWidth="1" />
                      </g>
                    )}

                    {el.type === 'tower' && (
                      <g pointerEvents="none" opacity="0.3">
                        {Array.from({ length: 3 }).map((_, i) => (
                          <line key={i} x1={minX + 5} y1={minY + (h/4)*(i+1)} x2={maxX - 5} y2={minY + (h/4)*(i+1)} stroke="white" strokeWidth="1" />
                        ))}
                      </g>
                    )}

                    {el.type === 'house' && (
                      <path d={`M ${centerX - w/4} ${centerY} L ${centerX} ${centerY - h/4} L ${centerX + w/4} ${centerY} Z`} fill="none" stroke="#3b82f6" strokeWidth="1" pointerEvents="none" opacity="0.5" />
                    )}

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
                              onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'edge', index: i } as any); }}
                            />
                          );
                        })}
                        {pts.map((p, i) => (
                          <circle
                            key={`vertex-${i}`}
                            cx={p.x} cy={p.y} r={6}
                            className="fill-white stroke-blue-600 stroke-2 cursor-pointer hover:r-8 transition-all"
                            onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'vertex', index: i } as any); }}
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
            </g>
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

              {selectedElement.type === 'amenity' && (
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-500">نوع المرفق</label>
                  <Select 
                    value={selectedElement.amenityType} 
                    onValueChange={(val) => setElements(elements.map(el => el.id === selectedId ? {...el, amenityType: val, label: AMENITY_TYPES.find(t => t.id === val)?.label || ''} : el))}
                  >
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue placeholder="اختر نوع المرفق" />
                    </SelectTrigger>
                    <SelectContent>
                      {AMENITY_TYPES.map(type => (
                        <SelectItem key={type.id} value={type.id} className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <span>{type.label}</span>
                            <type.icon size={16} />
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedElement.type === 'label_area' && (
                <div className="space-y-4 p-4 bg-purple-50 rounded-2xl border border-purple-100">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-purple-700 flex items-center gap-2"><Palette size={16} /> لون التعبئة</label>
                    <input 
                      type="color" 
                      className="w-full h-10 rounded-lg cursor-pointer border-none" 
                      value={selectedElement.color || '#a855f7'} 
                      onChange={(e) => setElements(elements.map(el => el.id === selectedId ? {...el, color: e.target.value} : el))} 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-purple-700">الشفافية ({Math.round((selectedElement.opacity || 0.2) * 100)}%)</label>
                    <Slider 
                      value={[selectedElement.opacity || 0.2]} 
                      min={0} 
                      max={1} 
                      step={0.05} 
                      onValueChange={([val]) => setElements(elements.map(el => el.id === selectedId ? {...el, opacity: val} : el))} 
                    />
                  </div>
                </div>
              )}

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

  function handleDuplicate(direction: 'right' | 'down') {
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
  }
};

export default MapEditor;