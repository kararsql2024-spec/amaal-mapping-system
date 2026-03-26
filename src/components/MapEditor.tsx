"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MapElement, ElementType, Point } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, Home, Building2, TreeDeciduous, 
  MoveRight, Coffee, Grid3X3, ArrowDown, ArrowLeft,
  ZoomIn, ZoomOut, RotateCcw, Type, Palette, Hand,
  Trophy, Store, School, HeartPulse, Baby, ShoppingBag, Dumbbell, ShoppingCart,
  Copy, ArrowRight, ChevronRight, ChevronDown, X, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  Settings2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[], width: number, height: number) => void;
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
  const [dragMode, setDragMode] = useState<{ type: 'move' | 'vertex' | 'edge' | 'rotate' | 'pan', startPos?: Point, index?: number } | null>(null);
  const [gridLock, setGridLock] = useState(true);
  const [dims, setDims] = useState({ w: mapWidth, h: mapHeight });
  
  const [scale, setScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  
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
      let dx = 0;
      let dy = 0;

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
    
    if ('touches' in e) {
      pt.x = e.touches[0].clientX;
      pt.y = e.touches[0].clientY;
    } else {
      pt.x = e.clientX;
      pt.y = e.clientY;
    }
    
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
    const w = activeTool === 'road' ? 200 : 80;
    const h = activeTool === 'road' ? 40 : 80;
    
    const newPoints = [
      { x: snap(pos.x - w/2), y: snap(pos.y - h/2) },
      { x: snap(pos.x + w/2), y: snap(pos.y - h/2) },
      { x: snap(pos.x + w/2), y: snap(pos.y + h/2) },
      { x: snap(pos.x - w/2), y: snap(pos.y + h/2) },
    ];

    checkAndExpandMap(newPoints);

    const newElement: MapElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: activeTool,
      label: activeTool === 'house' ? `D1` : 
             activeTool === 'tower' ? `T1` : 
             activeTool === 'pitch' ? 'ملعب' :
             activeTool === 'label_area' ? 'منطقة جديدة' : '',
      points: newPoints,
      rotation: 0,
      orientation: 'horizontal',
      color: activeTool === 'label_area' ? '#a855f7' : (activeTool === 'amenity' ? '#f59e0b' : undefined),
      textColor: '#1e293b',
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

  const getDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const isBackground = e.target === svgRef.current || (e.target as SVGElement).id === 'map-background';
    if (isBackground && !activeTool) {
      if (e.touches.length === 1) {
        const touch = e.touches[0];
        setDragMode({ type: 'pan', startPos: { x: touch.clientX, y: touch.clientY } });
        setLastTouchDistance(null);
      } else if (e.touches.length === 2) {
        setDragMode(null);
        const dist = getDistance(e.touches[0], e.touches[1]);
        setLastTouchDistance(dist);
      }
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
      }

      if (dragMode.type !== 'rotate') {
        checkAndExpandMap(newPoints);
        return { ...el, points: newPoints };
      }

      if (dragMode.type === 'rotate') {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI);
        return { ...el, rotation: angle + 90 };
      }

      return el;
    }));
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && dragMode?.type === 'pan' && dragMode.startPos) {
      const touch = e.touches[0];
      const dx = touch.clientX - dragMode.startPos.x;
      const dy = touch.clientY - dragMode.startPos.y;
      setViewPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragMode({ ...dragMode, startPos: { x: touch.clientX, y: touch.clientY } });
    } else if (e.touches.length === 2 && lastTouchDistance !== null) {
      const dist = getDistance(e.touches[0], e.touches[1]);
      const ratio = dist / lastTouchDistance;
      setScale(prev => Math.min(Math.max(prev * ratio, 0.1), 10));
      setLastTouchDistance(dist);
    } else if (e.touches.length === 1 && selectedId && dragMode) {
      const pos = getMousePos(e);
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
        }

        if (dragMode.type !== 'rotate') {
          checkAndExpandMap(newPoints);
          return { ...el, points: newPoints };
        }

        if (dragMode.type === 'rotate') {
          const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
          const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
          const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI);
          return { ...el, rotation: angle + 90 };
        }

        return el;
      }));
    }
  };

  const handleTouchEnd = () => {
    setDragMode(null);
    setLastTouchDistance(null);
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

    const parts = el.label.split('-');
    const lastPart = parts[parts.length - 1];
    let newLastPart = lastPart;
    
    const match = lastPart.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1]);
      const prefix = lastPart.substring(0, match.index);
      newLastPart = `${prefix}${num + 1}`;
    }
    
    parts[parts.length - 1] = newLastPart;
    const newLabel = parts.join('-');

    const newPoints = pts.map(p => ({ x: p.x + offset.x, y: p.y + offset.y }));
    checkAndExpandMap(newPoints);

    const newElement: MapElement = {
      ...el,
      id: Math.random().toString(36).substr(2, 9),
      points: newPoints,
      label: newLabel
    };

    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const pointsToPath = (points: Point[]) => {
    if (!points || points.length === 0) return "";
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + " Z";
  };

  const getElementColor = (el: MapElement) => {
    if (el.type === 'label_area' || el.type === 'amenity') return el.color || (el.type === 'amenity' ? '#f59e0b' : '#a855f7');
    switch (el.type) {
      case 'house': return '#ffffff';
      case 'tower': return '#1e293b';
      case 'road': return '#475569';
      case 'green': return '#22c55e';
      case 'pitch': return '#16a34a';
      default: return '#ffffff';
    }
  };

  const getElementStroke = (el: MapElement) => {
    if (el.type === 'label_area' || el.type === 'amenity') return el.color || (el.type === 'amenity' ? '#d97706' : '#a855f7');
    switch (el.type) {
      case 'house': return '#3b82f6';
      case 'tower': return '#0f172a';
      case 'road': return '#1e293b';
      case 'green': return '#15803d';
      case 'pitch': return '#ffffff';
      default: return '#cbd5e1';
    }
  };

  const getShortLabel = (label: string, type: ElementType) => {
    if (!label) return "";
    if (type === 'house' || type === 'tower') {
      const parts = label.split('-');
      return parts[parts.length - 1];
    }
    return label;
  };

  const renderAmenityIcon = (type: string | undefined, color: string) => {
    switch (type) {
      case 'shop': return <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" fill="none" stroke={color} strokeWidth="2" />;
      case 'school': return <path d="M22 10v6M2 10l10-5 10 5-10 5z" fill="none" stroke={color} strokeWidth="2" />;
      case 'medical': return <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" fill="none" stroke={color} strokeWidth="2" />;
      case 'nursery': return <path d="M10 7h4M12 5v4M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" fill="none" stroke={color} strokeWidth="2" />;
      case 'mall': return <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z M3 6h18 M16 10a4 4 0 0 1-8 0" fill="none" stroke={color} strokeWidth="2" />;
      case 'gym': return <path d="M18 8h2a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M4 8H2a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2M6 5v14M18 5v14M6 12h12" fill="none" stroke={color} strokeWidth="2" />;
      case 'supermarket': return <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" fill="none" stroke={color} strokeWidth="2" />;
      default: return <circle cx="12" cy="12" r="10" fill="none" stroke={color} strokeWidth="2" />;
    }
  };

  const selectedElement = elements.find(el => el.id === selectedId);
  const selectedPts = selectedElement ? getElementPoints(selectedElement) : [];
  
  const sortedElements = [...elements].sort((a, b) => {
    if (a.type === 'label_area' && b.type !== 'label_area') return -1;
    if (a.type !== 'label_area' && b.type === 'label_area') return 1;
    return 0;
  });

  const updateSelectedElement = (updates: Partial<MapElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, ...updates } : el));
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-120px)]" dir="rtl">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
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
          <Button onClick={() => onSave(elements, dims.w, dims.h)} className="bg-emerald-600 hover:bg-emerald-700 gap-2 rounded-xl px-6">
            <Save size={18} /> حفظ المخطط
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Main Canvas Area */}
        <div className="flex-1 relative bg-slate-200 rounded-[2.5rem] border-8 border-white shadow-inner overflow-hidden touch-none">
          <svg 
            ref={svgRef} 
            className={cn("w-full h-full", !activeTool ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair")}
            onClick={handleCanvasClick} 
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove} 
            onMouseUp={() => setDragMode(null)}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
          >
            <g ref={contentRef} style={{ transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
              <defs>
                <pattern id="grid-editor" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse">
                  <path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke="#94a3b8" strokeWidth="1" opacity="0.5"/>
                </pattern>
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
                const topCenterX = (minX + maxX) / 2;
                const w = maxX - minX;
                const h = maxY - minY;

                return (
                  <g key={el.id} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                    {el.type === 'label_area' ? (
                      <rect
                        x={minX} y={minY} width={w} height={h}
                        rx="20" ry="20"
                        fill={getElementColor(el)}
                        stroke={getElementStroke(el)}
                        fillOpacity={el.opacity}
                        strokeWidth="2"
                        className={cn("transition-all cursor-move", isSelected && "stroke-blue-600 stroke-[3px] filter drop-shadow-lg")}
                        onMouseDown={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode({ type: 'move' }); }}
                        onTouchStart={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode({ type: 'move' }); }}
                      />
                    ) : (
                      <path
                        d={pointsToPath(pts)}
                        fill={getElementColor(el)}
                        stroke={getElementStroke(el)}
                        fillOpacity={1}
                        strokeWidth={el.type === 'pitch' ? 2 : 1}
                        className={cn("transition-all stroke-2 cursor-move", isSelected && "stroke-blue-600 stroke-[3px] filter drop-shadow-lg")}
                        onMouseDown={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode({ type: 'move' }); }}
                        onTouchStart={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode({ type: 'move' }); }}
                      />
                    )}
                    
                    {el.type === 'house' && (
                      <g transform={`translate(${centerX}, ${centerY + 10})`} pointerEvents="none">
                        <path d="M -15 5 L -15 -5 L 0 -18 L 15 -5 L 15 5 Z" fill="none" stroke="#3b82f6" strokeWidth="2" />
                        <rect x="-5" y="-2" width="10" height="7" fill="none" stroke="#3b82f6" strokeWidth="1" />
                      </g>
                    )}

                    {el.type === 'tower' && (
                      <g transform={`translate(${centerX}, ${centerY + 10})`} pointerEvents="none">
                        <rect x="-10" y="-20" width="20" height="35" fill="none" stroke="white" strokeWidth="2" />
                        <line x1="-6" y1="-14" x2="6" y2="-14" stroke="white" strokeWidth="1" opacity="0.5" />
                        <line x1="-6" y1="-6" x2="6" y2="-6" stroke="white" strokeWidth="1" opacity="0.5" />
                        <line x1="-6" y1="2" x2="6" y2="2" stroke="white" strokeWidth="1" opacity="0.5" />
                        <line x1="-6" y1="10" x2="6" y2="10" stroke="white" strokeWidth="1" opacity="0.5" />
                      </g>
                    )}

                    {el.type === 'amenity' && (
                      <g transform={`translate(${centerX - 12}, ${centerY - 2})`} pointerEvents="none">
                        {renderAmenityIcon(el.amenityType, el.textColor || '#1e293b')}
                      </g>
                    )}

                    {el.type === 'road' && (
                      el.orientation === 'vertical' ? 
                      <line x1={centerX} y1={minY} x2={centerX} y2={maxY} stroke="white" strokeWidth="2" strokeDasharray="10,10" pointerEvents="none" opacity="0.5" /> :
                      <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke="white" strokeWidth="2" strokeDasharray="10,10" pointerEvents="none" opacity="0.5" />
                    )}
                    
                    {el.type === 'pitch' && (
                      <g pointerEvents="none" opacity="0.8">
                        <circle cx={centerX} cy={centerY} r={Math.min(w, h)/6} fill="none" stroke="white" strokeWidth="1" />
                        {el.orientation === 'vertical' ? (
                          <>
                            <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke="white" strokeWidth="1" />
                            <rect x={centerX - w/4} y={minY} width={w/2} height={h/6} fill="none" stroke="white" strokeWidth="1" />
                            <rect x={centerX - w/4} y={maxY - h/6} width={w/2} height={h/6} fill="none" stroke="white" strokeWidth="1" />
                          </>
                        ) : (
                          <>
                            <line x1={centerX} y1={minY} x2={centerX} y2={maxY} stroke="white" strokeWidth="1" />
                            <rect x={minX} y={centerY - h/4} width={w/6} height={h/2} fill="none" stroke="white" strokeWidth="1" />
                            <rect x={maxX - w/6} y={centerY - h/4} width={w/6} height={h/2} fill="none" stroke="white" strokeWidth="1" />
                          </>
                        )}
                      </g>
                    )}

                    {el.label && (
                      <text 
                        x={el.type === 'label_area' ? topCenterX : centerX} 
                        y={el.type === 'label_area' ? minY - 10 : minY + 20} 
                        textAnchor="middle" 
                        dominantBaseline="auto"
                        fill={el.textColor || '#1e293b'}
                        className="font-black pointer-events-none select-none text-[12px]"
                      >
                        {getShortLabel(el.label, el.type)}
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
                              onTouchStart={(e) => { e.stopPropagation(); setDragMode({ type: 'edge', index: i }); }}
                            />
                          );
                        })}
                        {pts.map((p, i) => (
                          <circle
                            key={`vertex-${i}`}
                            cx={p.x} cy={p.y} r={6}
                            className="fill-white stroke-blue-600 stroke-2 cursor-pointer hover:r-8 transition-all"
                            onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'vertex', index: i }); }}
                            onTouchStart={(e) => { e.stopPropagation(); setDragMode({ type: 'vertex', index: i }); }}
                          />
                        ))}
                        <line x1={centerX} y1={pts[0].y} x2={centerX} y2={pts[0].y - 30} className="stroke-blue-600 stroke-2" />
                        <circle
                          cx={centerX} cy={pts[0].y - 30} r={8}
                          className="fill-blue-600 cursor-pointer"
                          onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'rotate' }); }}
                          onTouchStart={(e) => { e.stopPropagation(); setDragMode({ type: 'rotate' }); }}
                        />
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Properties Sidebar */}
        {selectedElement && (
          <div className="w-80 bg-white rounded-[2rem] border border-slate-200 shadow-xl flex flex-col overflow-hidden animate-in slide-in-from-left-4 duration-300">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <Settings2 className="text-white w-5 h-5" />
                </div>
                <h3 className="font-black text-slate-800">خصائص العنصر</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} className="rounded-full hover:bg-rose-50 hover:text-rose-500">
                <X size={18} />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">تسمية العنصر</Label>
                  <Input 
                    value={selectedElement.label} 
                    onChange={(e) => updateSelectedElement({ label: e.target.value })}
                    className="rounded-xl h-12 border-slate-200 font-bold"
                    placeholder="مثال: D1, T1..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => handleDuplicate('right')}
                    className="rounded-xl h-12 gap-2 font-bold border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                  >
                    <Copy size={16} /> تكرار يسار
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleDuplicate('down')}
                    className="rounded-xl h-12 gap-2 font-bold border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200"
                  >
                    <Copy size={16} /> تكرار أسفل
                  </Button>
                </div>
              </div>

              {/* Tower Specific */}
              {selectedElement.type === 'tower' && (
                <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <div className="flex items-center gap-2 mb-2">
                    <Building2 size={16} className="text-indigo-600" />
                    <span className="font-black text-sm text-slate-700">إعدادات البرج</span>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500">عدد الطوابق</Label>
                    <Input 
                      type="number" 
                      value={selectedElement.floors} 
                      onChange={(e) => updateSelectedElement({ floors: parseInt(e.target.value) })}
                      className="rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-slate-500">شقق في كل طابق</Label>
                    <Input 
                      type="number" 
                      value={selectedElement.apartmentsPerFloor} 
                      onChange={(e) => updateSelectedElement({ apartmentsPerFloor: parseInt(e.target.value) })}
                      className="rounded-xl h-10"
                    />
                  </div>
                </div>
              )}

              {/* Amenity Specific */}
              {selectedElement.type === 'amenity' && (
                <div className="space-y-4">
                  <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">نوع المرفق</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {AMENITY_TYPES.map(type => (
                      <button
                        key={type.id}
                        onClick={() => updateSelectedElement({ amenityType: type.id })}
                        className={cn(
                          "w-full aspect-square rounded-xl flex items-center justify-center transition-all border-2",
                          selectedElement.amenityType === type.id 
                            ? "bg-amber-500 border-amber-600 text-white shadow-lg scale-110" 
                            : "bg-white border-slate-100 text-slate-400 hover:border-amber-200 hover:text-amber-500"
                        )}
                        title={type.label}
                      >
                        <type.icon size={20} />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Orientation for Road/Pitch */}
              {(selectedElement.type === 'road' || selectedElement.type === 'pitch') && (
                <div className="space-y-4">
                  <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">الاتجاه</Label>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <Button 
                      variant={selectedElement.orientation === 'horizontal' ? 'default' : 'ghost'}
                      className="flex-1 rounded-lg gap-2 font-bold"
                      onClick={() => updateSelectedElement({ orientation: 'horizontal' })}
                    >
                      <AlignHorizontalJustifyCenter size={16} /> أفقي
                    </Button>
                    <Button 
                      variant={selectedElement.orientation === 'vertical' ? 'default' : 'ghost'}
                      className="flex-1 rounded-lg gap-2 font-bold"
                      onClick={() => updateSelectedElement({ orientation: 'vertical' })}
                    >
                      <AlignVerticalJustifyCenter size={16} /> عمودي
                    </Button>
                  </div>
                </div>
              )}

              {/* Styling */}
              <div className="space-y-6">
                <div className="space-y-3">
                  <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">الألوان</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500">لون العنصر</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="color" 
                          value={selectedElement.color || '#ffffff'} 
                          onChange={(e) => updateSelectedElement({ color: e.target.value })}
                          className="w-10 h-10 p-1 rounded-lg cursor-pointer border-slate-200"
                        />
                        <span className="text-xs font-mono text-slate-400">{selectedElement.color || '#FFF'}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[10px] font-bold text-slate-500">لون النص</Label>
                      <div className="flex items-center gap-2">
                        <Input 
                          type="color" 
                          value={selectedElement.textColor || '#1e293b'} 
                          onChange={(e) => updateSelectedElement({ textColor: e.target.value })}
                          className="w-10 h-10 p-1 rounded-lg cursor-pointer border-slate-200"
                        />
                        <span className="text-xs font-mono text-slate-400">{selectedElement.textColor || '#1E2'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {selectedElement.type === 'label_area' && (
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">الشفافية</Label>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                        {Math.round((selectedElement.opacity || 0.2) * 100)}%
                      </span>
                    </div>
                    <Slider 
                      value={[(selectedElement.opacity || 0.2) * 100]} 
                      onValueChange={(v) => updateSelectedElement({ opacity: v[0] / 100 })}
                      max={100}
                      step={5}
                      className="py-4"
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="pt-6 border-t border-slate-100">
                <Button 
                  variant="destructive" 
                  className="w-full rounded-xl h-12 gap-2 font-black shadow-lg shadow-rose-100"
                  onClick={() => {
                    setElements(prev => prev.filter(el => el.id !== selectedId));
                    setSelectedId(null);
                  }}
                >
                  <Trash2 size={18} /> حذف العنصر
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MapEditor;