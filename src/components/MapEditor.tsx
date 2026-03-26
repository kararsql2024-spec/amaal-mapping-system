"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MapElement, ElementType, Point } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, Home, Building2, Leaf, 
  Waypoints, MapPin, Grid3X3, ArrowDown, ArrowLeft,
  ZoomIn, ZoomOut, RotateCcw, Type, Palette, Hand,
  Trophy, Store, GraduationCap, Stethoscope, Baby, ShoppingBag, Dumbbell, ShoppingCart,
  Copy, ArrowRight, ChevronRight, ChevronDown, X, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  Settings2, MoonStar, Maximize2, Footprints, Car, EyeOff, Eye, Paintbrush, MousePointer2, Square,
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

const AMENITY_TYPES = [
  { id: 'shop', label: 'محل تجاري', icon: Store },
  { id: 'school', label: 'مدرسة', icon: GraduationCap },
  { id: 'medical', label: 'مركز طبي', icon: Stethoscope },
  { id: 'nursery', label: 'حضانة', icon: Baby },
  { id: 'mall', label: 'مول', icon: ShoppingBag },
  { id: 'gym', label: 'جم', icon: Dumbbell },
  { id: 'supermarket', label: 'أسواق مركزية', icon: ShoppingCart },
  { id: 'mosque', label: 'مسجد', icon: MoonStar },
];

const TOOLS: { type: ElementType; label: string; icon: any; color: string }[] = [
  { type: 'house', label: 'منزل', icon: Home, color: 'bg-blue-500' },
  { type: 'tower', label: 'برج', icon: Building2, color: 'bg-slate-700' },
  { type: 'road', label: 'طريق', icon: Waypoints, color: 'bg-gray-400' },
  { type: 'green', label: 'مساحة خضراء', icon: Leaf, color: 'bg-emerald-500' },
  { type: 'sidewalk', label: 'رصيف', icon: Footprints, color: 'bg-slate-300' },
  { type: 'parking', label: 'كراج', icon: Car, color: 'bg-slate-600' },
  { type: 'pitch', label: 'ملعب', icon: Trophy, color: 'bg-green-600' },
  { type: 'amenity', label: 'مرفق', icon: MapPin, color: 'bg-amber-500' },
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
  
  const [scale, setScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);

  const snap = (val: number) => gridLock ? Math.round(val / GRID_SIZE) * GRID_SIZE : Math.round(val);

  const getShortLabel = (label: string, type: ElementType) => {
    if (!label) return "";
    if (type === 'house' || type === 'tower') {
      const parts = label.split('-');
      return parts[parts.length - 1];
    }
    return label;
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

  const checkAndExpandMap = (pts: Point[]) => {
    const maxX = Math.max(...pts.map(p => p.x));
    const maxY = Math.max(...pts.map(p => p.y));
    if (maxX > dims.w - 50) setDims(prev => ({ ...prev, w: maxX + 200 }));
    if (maxY > dims.h - 50) setDims(prev => ({ ...prev, h: maxY + 200 }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setElements(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null);
        return;
      }
      const step = gridLock ? GRID_SIZE : 1;
      let dx = 0; dy = 0;
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
        checkAndExpandMap(newPoints);
        return { ...el, points: newPoints };
      }));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, gridLock, dims]);

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

  const handleCanvasClick = (e: React.MouseEvent) => {
    const isBackground = e.target === svgRef.current || (e.target as SVGElement).id === 'map-background';
    if (dragMode || !isBackground || !activeTool || isBrushMode) return;
    const pos = getMousePos(e);
    const w = activeTool === 'road' ? 200 : 80;
    const h = activeTool === 'road' ? 40 : 80;
    const newPoints = [
      { x: snap(pos.x - w/2), y: snap(pos.y - h/2) },
      { x: snap(pos.x + w/2), y: snap(pos.y - h/2) },
      { x: snap(pos.x + w/2), y: snap(pos.y + h/2) },
      { x: snap(pos.x - w/2), y: snap(pos.y + h/2) },
    ];
    createElement(activeTool, newPoints);
  };

  const createElement = (type: ElementType, pts: Point[], isStroke = false, customLabel?: string) => {
    checkAndExpandMap(pts);
    const newElement: MapElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: customLabel || (type === 'house' ? `D1` : type === 'tower' ? `T1` : ''),
      points: pts,
      rotation: 0,
      orientation: 'horizontal',
      color: type === 'label_area' ? '#a855f7' : (type === 'amenity' ? '#f59e0b' : undefined),
      textColor: '#1e293b',
      opacity: type === 'label_area' ? 0.2 : 1,
      hideIcon: false,
      x: pts[0].x, y: pts[0].y, width: 0, height: 0,
      floors: type === 'tower' ? 5 : undefined,
      apartmentsPerFloor: type === 'tower' ? 4 : undefined,
      amenityType: type === 'amenity' ? 'shop' : undefined,
      strokeWidth: isStroke ? brushSize : undefined,
      isStroke: isStroke
    };
    setElements(prev => [...prev, newElement]);
    setSelectedId(newElement.id);
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
      const dist = Math.sqrt(Math.pow(pos.x - lastPt.x, 2) + Math.pow(pos.y - lastPt.y, 2));
      if (dist > 30) setTempPoints(prev => [...prev, pos]);
      return;
    }
    if (dragMode.type === 'pan' && dragMode.startPos) {
      const dx = e.clientX - dragMode.startPos.x;
      const dy = e.clientY - dragMode.startPos.y;
      setViewPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragMode({ ...dragMode, startPos: { x: e.clientX, y: e.clientY } });
      return;
    }
    if (!selectedId) return;
    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;
      const pts = getElementPoints(el);
      const dragIdx = dragMode.index;
      let newPoints = [...pts];
      if (dragMode.type === 'vertex' && dragIdx !== undefined) {
        newPoints[dragIdx] = { x: snap(pos.x), y: snap(pos.y) };
      } else if (dragMode.type === 'edge' && dragIdx !== undefined) {
        const idx1 = dragIdx;
        const idx2 = (dragIdx + 1) % pts.length;
        const midX = (pts[idx1].x + pts[idx2].x) / 2;
        const midY = (pts[idx1].y + pts[idx2].y) / 2;
        const dx = snap(pos.x) - midX;
        const dy = snap(pos.y) - midY;
        newPoints[idx1] = { x: pts[idx1].x + dx, y: pts[idx1].y + dy };
        newPoints[idx2] = { x: pts[idx2].x + dx, y: pts[idx2].y + dy };
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
      checkAndExpandMap(newPoints);
      return { ...el, points: newPoints };
    }));
  };

  const handleMouseUp = () => {
    if (dragMode?.type === 'brush' && activeTool && tempPoints.length > 1) {
      createElement(activeTool, tempPoints, true);
    }
    setDragMode(null);
    setTempPoints([]);
  };

  const handleDuplicate = (direction: 'right' | 'down') => {
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    const pts = getElementPoints(el);
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    const offset = direction === 'right' ? { x: (maxX - minX) + 10, y: 0 } : { x: 0, y: (maxY - minY) + 10 };
    const newPoints = pts.map(p => ({ x: p.x + offset.x, y: p.y + offset.y }));
    
    // منطق التكرار المتسلسل (+2)
    let newLabel = el.label;
    if (el.type === 'house' || el.type === 'tower') {
      const parts = el.label.split('-');
      const lastPart = parts[parts.length - 1];
      const match = lastPart.match(/([a-zA-Z]+)(\d+)/);
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2]);
        parts[parts.length - 1] = `${prefix}${num + 2}`;
        newLabel = parts.join('-');
      }
    }
    
    createElement(el.type, newPoints, el.isStroke, newLabel);
  };

  const pointsToPath = (points: Point[], closed = true) => {
    if (!points || points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    return closed ? path + " Z" : path;
  };

  const getElementColor = (el: MapElement) => {
    if (el.type === 'label_area' || el.type === 'amenity') return el.color || (el.type === 'amenity' ? '#f59e0b' : '#a855f7');
    switch (el.type) {
      case 'house': return '#ffffff';
      case 'tower': return '#1e293b';
      case 'road': return '#475569';
      case 'green': return 'url(#green-pattern)';
      case 'sidewalk': return 'url(#sidewalk-pattern)';
      case 'parking': return 'url(#parking-pattern)';
      case 'pitch': return '#16a34a';
      default: return '#ffffff';
    }
  };

  const getElementStroke = (el: MapElement) => {
    if (el.type === 'label_area' || el.type === 'amenity') return el.color || (el.type === 'amenity' ? '#d97706' : '#a855f7');
    switch (el.type) {
      case 'house': return '#3b82f6';
      case 'tower': return '#0f172a';
      case 'road': return '#475569';
      case 'green': return '#22c55e';
      case 'sidewalk': return '#cbd5e1';
      case 'parking': return '#334155';
      case 'pitch': return '#ffffff';
      default: return '#cbd5e1';
    }
  };

  const selectedElement = elements.find(el => el.id === selectedId);
  const layerOrder: Record<string, number> = { 'label_area': 0, 'road': 1, 'green': 1, 'sidewalk': 1, 'parking': 1, 'pitch': 2, 'amenity': 2, 'house': 3, 'tower': 3 };
  const sortedElements = [...elements].sort((a, b) => (layerOrder[a.type] || 0) - (layerOrder[b.type] || 0));

  const updateSelectedElement = (updates: Partial<MapElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, ...updates } : el));
  };

  const handleSizeChange = (dim: 'w' | 'h', value: number) => {
    if (!selectedElement) return;
    const pts = getElementPoints(selectedElement);
    const minX = Math.min(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxX = Math.max(...pts.map(p => p.x));
    const maxY = Math.max(...pts.map(p => p.y));
    const scaleX = dim === 'w' ? value / (maxX - minX) : 1;
    const scaleY = dim === 'h' ? value / (maxY - minY) : 1;
    const newPoints = pts.map(p => ({ x: minX + (p.x - minX) * scaleX, y: minY + (p.y - minY) * scaleY }));
    updateSelectedElement({ points: newPoints });
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-120px)]" dir="rtl">
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(s + 0.2, 5))}><ZoomIn size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(s - 0.2, 0.1))}><ZoomOut size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={() => { setScale(1); setViewPos({x:0, y:0}); }}><RotateCcw size={18} /></Button>
          </div>
          <Button variant={gridLock ? "default" : "outline"} size="icon" onClick={() => setGridLock(!gridLock)} className={cn("rounded-xl", gridLock && "bg-indigo-600")}><Grid3X3 size={18} /></Button>
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
          <svg ref={svgRef} className={cn("w-full h-full", isBrushMode ? "cursor-crosshair" : !activeTool ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair")} onClick={handleCanvasClick} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel}>
            <g ref={contentRef} style={{ transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
              <defs>
                <pattern id="grid-editor" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse"><path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5"/></pattern>
                <pattern id="green-pattern" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#22c55e" /><path d="M 2 8 L 5 2 L 8 8" fill="none" stroke="#15803d" strokeWidth="0.5" opacity="0.3" /></pattern>
                <pattern id="sidewalk-pattern" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#cbd5e1" /><path d="M 8 0 L 8 8 M 0 8 L 8 8" fill="none" stroke="#94a3b8" strokeWidth="0.5" /></pattern>
                <pattern id="parking-pattern" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#334155" /><path d="M 2 0 L 2 20 M 18 0 L 18 20" fill="none" stroke="white" strokeWidth="1" opacity="0.3" /></pattern>
              </defs>
              <rect id="map-background" width={dims.w} height={dims.h} fill="url(#grid-editor)" />
              
              {sortedElements.map((el) => {
                const pts = getElementPoints(el);
                const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
                const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
                const isSelected = selectedId === el.id;
                const minY = Math.min(...pts.map(p => p.y));
                const minX = Math.min(...pts.map(p => p.x));
                const maxX = Math.max(...pts.map(p => p.x));
                const maxY = Math.max(...pts.map(p => p.y));
                const IconComponent = el.type === 'house' ? Home : el.type === 'tower' ? Building2 : null;

                return (
                  <g key={el.id} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                    <path 
                      d={pointsToPath(pts, !el.isStroke)} 
                      fill={el.isStroke ? "none" : getElementColor(el)} 
                      stroke={el.isStroke ? getElementColor(el) : getElementStroke(el)} 
                      fillOpacity={el.type === 'label_area' ? el.opacity : 1} 
                      strokeWidth={el.isStroke ? el.strokeWidth : (['road', 'green', 'sidewalk', 'parking'].includes(el.type) ? 10 : (isSelected ? 3 : 2))} 
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      className={cn("transition-all cursor-move", isSelected && "stroke-blue-600 filter drop-shadow-lg")} 
                      onMouseDown={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode({ type: 'move' }); }} 
                    />
                    {IconComponent && !el.hideIcon && <foreignObject x={centerX - 12} y={centerY - 18} width="24" height="24" pointerEvents="none"><div className="flex items-center justify-center w-full h-full"><IconComponent size={20} color={el.textColor || (el.type === 'tower' ? '#ffffff' : '#1e293b')} strokeWidth={2.5}/></div></foreignObject>}
                    {el.label && <text x={el.type === 'label_area' ? (minX+maxX)/2 : centerX} y={el.type === 'label_area' ? minY - 10 : centerY + 15} textAnchor="middle" dominantBaseline="middle" fill={el.textColor || '#1e293b'} className="font-black pointer-events-none select-none text-[10px]">{getShortLabel(el.label, el.type)}</text>}
                    {isSelected && (
                      <>
                        {pts.map((p, i) => <circle key={`vertex-${i}`} cx={p.x} cy={p.y} r={6} className="fill-white stroke-blue-600 stroke-2 cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'vertex', index: i }); }} />)}
                        <circle cx={centerX} cy={pts[0].y - 30} r={8} className="fill-blue-600 cursor-pointer" onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'rotate' }); }} />
                      </>
                    )}
                  </g>
                );
              })}

              {tempPoints.length > 1 && isBrushMode && (
                <path
                  d={pointsToPath(tempPoints, false)}
                  fill="none"
                  stroke={activeTool ? getElementColor({ type: activeTool } as any) : "#3b82f6"}
                  strokeWidth={brushSize}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity="0.5"
                  pointerEvents="none"
                />
              )}
            </g>
          </svg>
        </div>

        <div className="w-80 flex flex-col gap-4">
          {isBrushMode && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl p-6 space-y-6">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center shadow-lg shadow-slate-100"><SlidersHorizontal className="text-white w-5 h-5" /></div><h3 className="font-black text-slate-800">إعدادات الفرشاة</h3></div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><Label className="text-xs font-black text-slate-400 uppercase tracking-wider">حجم الفرشاة</Label><span className="text-xs font-bold text-indigo-600">{brushSize}px</span></div>
                  <Slider value={[brushSize]} min={10} max={200} step={5} onValueChange={(val) => setBrushSize(val[0])} className="py-4" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">نوع العنصر</Label>
                  <Select value={activeTool || ''} onValueChange={(val) => setActiveTool(val as ElementType)}>
                    <SelectTrigger className="rounded-xl h-12 border-slate-200 font-bold"><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {TOOLS.filter(t => ['road', 'green', 'sidewalk', 'parking'].includes(t.type)).map(t => (
                        <SelectItem key={t.type} value={t.type} className="font-bold">{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {selectedElement && (
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl flex flex-col overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100"><Settings2 className="text-white w-5 h-5" /></div><h3 className="font-black text-slate-800">خصائص العنصر</h3></div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} className="rounded-full hover:bg-rose-50 hover:text-rose-500"><X size={18} /></Button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
                <div className="space-y-4">
                  <div className="space-y-2"><Label className="text-xs font-black text-slate-400 uppercase tracking-wider">تسمية العنصر</Label><Input value={selectedElement.label} onChange={(e) => updateSelectedElement({ label: e.target.value })} className="rounded-xl h-12 border-slate-200 font-bold" /></div>
                  
                  {selectedElement.type === 'tower' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs font-black text-slate-400 uppercase tracking-wider">عدد الطوابق</Label><Input type="number" value={selectedElement.floors} onChange={(e) => updateSelectedElement({ floors: parseInt(e.target.value) })} className="rounded-xl h-12 border-slate-200 font-bold" /></div>
                      <div className="space-y-2"><Label className="text-xs font-black text-slate-400 uppercase tracking-wider">شقق/طابق</Label><Input type="number" value={selectedElement.apartmentsPerFloor} onChange={(e) => updateSelectedElement({ apartmentsPerFloor: parseInt(e.target.value) })} className="rounded-xl h-12 border-slate-200 font-bold" /></div>
                    </div>
                  )}

                  {selectedElement.type === 'amenity' && (
                    <div className="space-y-2">
                      <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">نوع المرفق</Label>
                      <Select value={selectedElement.amenityType} onValueChange={(val) => updateSelectedElement({ amenityType: val })}>
                        <SelectTrigger className="rounded-xl h-12 border-slate-200 font-bold"><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {AMENITY_TYPES.map(t => (<SelectItem key={t.id} value={t.id} className="font-bold">{t.label}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {!selectedElement.isStroke && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">العرض (px)</Label>
                        <Input type="number" value={Math.round(Math.max(...getElementPoints(selectedElement).map(p => p.x)) - Math.min(...getElementPoints(selectedElement).map(p => p.x)))} onChange={(e) => handleSizeChange('w', parseInt(e.target.value))} className="rounded-xl h-12 border-slate-200 font-bold" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">الطول (px)</Label>
                        <Input type="number" value={Math.round(Math.max(...getElementPoints(selectedElement).map(p => p.y)) - Math.min(...getElementPoints(selectedElement).map(p => p.y)))} onChange={(e) => handleSizeChange('h', parseInt(e.target.value))} className="rounded-xl h-12 border-slate-200 font-bold" />
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100"><div className="flex items-center gap-2">{selectedElement.hideIcon ? <EyeOff size={16} className="text-slate-400" /> : <Eye size={16} className="text-indigo-600" />}<Label className="font-bold text-sm text-slate-700">إخفاء الأيقونة</Label></div><Switch checked={selectedElement.hideIcon} onCheckedChange={(val) => updateSelectedElement({ hideIcon: val })} /></div>
                  <div className="grid grid-cols-2 gap-2"><Button variant="outline" onClick={() => handleDuplicate('right')} className="rounded-xl h-12 gap-2 font-bold border-slate-200"><Copy size={16} /> تكرار يسار</Button><Button variant="outline" onClick={() => handleDuplicate('down')} className="rounded-xl h-12 gap-2 font-bold border-slate-200"><Copy size={16} /> تكرار أسفل</Button></div>
                </div>
                <div className="pt-6 border-t border-slate-100"><Button variant="destructive" className="w-full rounded-xl h-12 gap-2 font-black shadow-lg shadow-rose-100" onClick={() => { setElements(prev => prev.filter(el => el.id !== selectedId)); setSelectedId(null); }}><Trash2 size={18} /> حذف العنصر</Button></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapEditor;