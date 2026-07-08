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
  SlidersHorizontal, Maximize, Minimize, Image as ImageIcon, Lock, Unlock, Upload, Bold, RotateCw, Layers, Loader2, RefreshCcw,
  Frame
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { showSuccess, showError } from '@/utils/toast';

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[], width: number, height: number, backgroundColor?: string, showGrid?: boolean) => void;
  onCancel: () => void;
  mapWidth: number;
  mapHeight: number;
  isSaving?: boolean;
  initialBackgroundColor?: string;
  initialShowGrid?: boolean;
}

const GRID_SIZE = 10;

const MapEditor = ({ initialElements = [], onSave, onCancel, mapWidth, mapHeight, isSaving = false, initialBackgroundColor = '#ffffff', initialShowGrid = true }: MapEditorProps) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements || []);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ElementType | 'map_boundary' | null>(null);
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [dragMode, setDragMode] = useState<{ type: 'move' | 'vertex' | 'edge' | 'rotate' | 'pan' | 'brush' | 'boundary', startPos?: Point, index?: number } | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [gridLock, setGridLock] = useState(true);
  const [dims, setDims] = useState({ w: Math.round(mapWidth || 1000), h: Math.round(mapHeight || 800) });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [scale, setScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  const [mapBgColor, setMapBgColor] = useState(initialBackgroundColor);
  const [mapShowGrid, setMapShowGrid] = useState(initialShowGrid);
  
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
    else { pt.x = (e as React.MouseEvent).clientX; pt.y = (e as React.MouseEvent).clientY; }
    const svgP = pt.matrixTransform(contentRef.current.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (!activeTool) {
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
    }
  };

  const handleMouseUp = () => {
    setDragMode(null);
  };

  const updateSelectedElement = (updates: Partial<MapElement>) => {
    if (!selectedId) return;
    setElements(prev => (prev || []).map(el => el.id === selectedId ? { ...el, ...updates } : el));
  };

  const sortedElements = [...(elements || [])].sort((a, b) => {
    const layerOrder: Record<string, number> = { 'reference_image': -2, 'green': -1, 'label_area': 0, 'road': 1, 'pitch': 2, 'amenity': 2, 'house': 3, 'tower': 3, 'text': 4 };
    return (layerOrder[a.type] || 0) - (layerOrder[b.type] || 0);
  });

  return (
    <div className={cn("flex flex-col gap-4", isFullScreen ? "fixed inset-0 z-50 bg-slate-50 p-6" : "h-[calc(100vh-120px)]")} dir="rtl">
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => setScale(s => Math.min(s + 0.2, 5))}><ZoomIn size={18} /></Button>
          <Button variant="outline" onClick={() => setScale(s => Math.max(s - 0.2, 0.1))}><ZoomOut size={18} /></Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={onCancel} className="rounded-xl">رجوع</Button>
          <Button onClick={() => onSave(elements, dims.w, dims.h, mapBgColor, mapShowGrid)} className="bg-emerald-600 rounded-xl" disabled={isSaving}>حفظ المخطط</Button>
        </div>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        <div className="w-20 bg-white p-2 rounded-2xl border shadow-xl flex flex-col gap-2">
          <Button variant="ghost" className="w-full aspect-square" onClick={() => setActiveTool(null)}><MousePointer2 /></Button>
          <Button variant="ghost" className="w-full aspect-square" onClick={() => setActiveTool('house')}><Home /></Button>
          <Button variant="ghost" className="w-full aspect-square" onClick={() => setActiveTool('tower')}><Building2 /></Button>
        </div>

        <div className="flex-1 bg-slate-200 rounded-3xl border-8 border-white overflow-hidden relative">
          <svg ref={svgRef} className="w-full h-full cursor-crosshair" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
            <g ref={contentRef} style={{ transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
              <rect width={dims.w} height={dims.h} fill={mapBgColor} />
              {mapShowGrid && <rect width={dims.w} height={dims.h} fill="url(#grid-editor)" pointerEvents="none" />}
              {sortedElements.map(el => (
                <g key={el.id} onClick={() => setSelectedId(el.id)}>
                   <path d={`M ${el.x} ${el.y} L ${el.x+100} ${el.y} L ${el.x+100} ${el.y+100} Z`} fill={el.color || '#fff'} stroke="#3b82f6" />
                </g>
              ))}
            </g>
          </svg>
        </div>

        <div className="w-80 space-y-4">
          <div className="bg-white p-6 rounded-2xl border shadow-xl">
            <h3 className="font-black mb-4">إعدادات المخطط</h3>
            <div className="space-y-4">
              <Label>لون الخلفية</Label>
              <Input type="color" value={mapBgColor} onChange={(e) => setMapBgColor(e.target.value)} />
              <div className="flex items-center justify-between">
                 <Label>إظهار الشبكة</Label>
                 <Switch checked={mapShowGrid} onCheckedChange={setMapShowGrid} />
              </div>
            </div>
          </div>
          {selectedId && (
             <div className="bg-white p-6 rounded-2xl border shadow-xl">
                <h3 className="font-black">خصائص العنصر</h3>
                <Input value={elements.find(e => e.id === selectedId)?.label} onChange={(e) => updateSelectedElement({label: e.target.value})} className="mt-4" />
                <Button variant="destructive" className="w-full mt-4" onClick={() => {setElements(elements.filter(e => e.id !== selectedId)); setSelectedId(null);}}>حذف</Button>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapEditor;