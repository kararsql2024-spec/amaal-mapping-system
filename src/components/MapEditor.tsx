"use client";

import React, { useState, useRef } from 'react';
import { MapElement, ElementType } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, Home, Building2, TreeDeciduous, 
  MoveRight, Coffee, Grid3X3, ArrowRight, ArrowDown,
  RotateCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[]) => void;
  mapWidth: number;
  mapHeight: number;
}

const GRID_SIZE = 20;

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
  const [dragMode, setDragMode] = useState<'move' | 'resize' | null>(null);
  const [gridLock, setGridLock] = useState(true);
  const svgRef = useRef<SVGSVGElement>(null);

  const snap = (val: number) => gridLock ? Math.round(val / GRID_SIZE) * GRID_SIZE : Math.round(val);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || dragMode) return;
    if (e.target !== svgRef.current) return;

    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

    const defaults = {
      house: { w: 40, h: 40 },
      tower: { w: 60, h: 80 },
      road: { w: 100, h: 20 },
      green: { w: 80, h: 60 },
      amenity: { w: 40, h: 40 },
    };

    const newElement: MapElement = {
      id: Math.random().toString(36).substr(2, 9),
      x: snap(svgP.x - defaults[activeTool].w / 2),
      y: snap(svgP.y - defaults[activeTool].h / 2),
      width: defaults[activeTool].w,
      height: defaults[activeTool].h,
      type: activeTool,
      label: activeTool === 'house' ? `H${elements.filter(el => el.type === 'house').length + 1}` : 
             activeTool === 'tower' ? `T${elements.filter(el => el.type === 'tower').length + 1}` : '',
      rotation: 0,
      floors: activeTool === 'tower' ? 5 : undefined,
      apartmentsPerFloor: activeTool === 'tower' ? 4 : undefined,
    };

    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragMode || !selectedId || !svgRef.current) return;

    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

    setElements(prev => prev.map(el => {
      if (el.id === selectedId) {
        if (dragMode === 'move') {
          return { ...el, x: snap(svgP.x - el.width / 2), y: snap(svgP.y - el.height / 2) };
        } else if (dragMode === 'resize') {
          return { ...el, width: Math.max(20, snap(svgP.x - el.x)), height: Math.max(20, snap(svgP.y - el.y)) };
        }
      }
      return el;
    }));
  };

  const handleDuplicate = (direction: 'right' | 'down') => {
    const selected = elements.find(el => el.id === selectedId);
    if (!selected) return;
    const newElement: MapElement = {
      ...selected,
      id: Math.random().toString(36).substr(2, 9),
      x: direction === 'right' ? selected.x + selected.width : selected.x,
      y: direction === 'down' ? selected.y + selected.height : selected.y,
      label: selected.type === 'house' ? `H${elements.filter(el => el.type === 'house').length + 1}` : 
             selected.type === 'tower' ? `T${elements.filter(el => el.type === 'tower').length + 1}` : selected.label,
    };
    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const updateElement = (id: string, updates: Partial<MapElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const getElementColor = (type: ElementType) => {
    switch (type) {
      case 'house': return 'fill-white stroke-blue-400';
      case 'tower': return 'fill-slate-800 stroke-slate-900';
      case 'road': return 'fill-gray-300 stroke-none'; // الطرق بدون حدود لتسهيل الدمج
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
        <Button onClick={() => onSave(elements)} className="bg-emerald-600 hover:bg-emerald-700 gap-2 rounded-xl px-6">
          <Save size={18} />
          حفظ المخطط النهائي
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
        <div className="lg:col-span-3 relative bg-slate-200 rounded-[2.5rem] border-8 border-white shadow-inner overflow-hidden">
          <svg ref={svgRef} viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full cursor-crosshair" onClick={handleCanvasClick} onMouseMove={handleMouseMove} onMouseUp={() => setDragMode(null)} onMouseLeave={() => setDragMode(null)}>
            <defs>
              <pattern id="grid-editor" width={GRID_SIZE} height={GRID_SIZE} patternUnits="userSpaceOnUse">
                <path d={`M ${GRID_SIZE} 0 L 0 0 0 ${GRID_SIZE}`} fill="none" stroke="#cbd5e1" strokeWidth="0.5"/>
              </pattern>
              {/* فلتر لدمج الطرق بصرياً */}
              <filter id="road-merge">
                <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
                <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="merge" />
                <feComposite in="SourceGraphic" in2="merge" operator="atop" />
              </filter>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-editor)" />
            
            {/* طبقة الطرق المدمجة */}
            <g filter="url(#road-merge)">
              {elements.filter(el => el.type === 'road').map(el => (
                <rect key={el.id} x={el.x} y={el.y} width={el.width} height={el.height} transform={`rotate(${el.rotation || 0} ${el.x + el.width/2} ${el.y + el.height/2})`} className="fill-gray-300" />
              ))}
            </g>

            {/* باقي العناصر */}
            {elements.filter(el => el.type !== 'road').map((el) => (
              <g key={el.id} onMouseDown={(e) => { e.stopPropagation(); setSelectedId(el.id); setDragMode('move'); }} className="cursor-move group">
                <rect
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  rx={6}
                  transform={`rotate(${el.rotation || 0} ${el.x + el.width/2} ${el.y + el.height/2})`}
                  className={cn("transition-all stroke-2", getElementColor(el.type), selectedId === el.id && "stroke-blue-600 stroke-[3px] filter drop-shadow-lg")}
                />
                {el.label && (
                  <text x={el.x + el.width / 2} y={el.y + el.height / 2} textAnchor="middle" dominantBaseline="middle" transform={`rotate(${el.rotation || 0} ${el.x + el.width/2} ${el.y + el.height/2})`} className={cn("text-[12px] font-black pointer-events-none select-none", el.type === 'tower' ? "fill-white" : "fill-slate-700")}>
                    {el.label}
                  </text>
                )}
                {/* مقبض تغيير الحجم */}
                {selectedId === el.id && (
                  <rect x={el.x + el.width - 8} y={el.y + el.height - 8} width={16} height={16} className="fill-blue-600 cursor-nwse-resize" onMouseDown={(e) => { e.stopPropagation(); setDragMode('resize'); }} />
                )}
              </g>
            ))}
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
                    <input type="text" className="w-full p-3 rounded-xl border border-slate-200" value={elements.find(el => el.id === selectedId)?.label} onChange={(e) => updateElement(selectedId, { label: e.target.value })} />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">التدوير والتكرار</label>
                    <div className="grid grid-cols-3 gap-2">
                      <Button variant="outline" onClick={() => updateElement(selectedId, { rotation: ((elements.find(el => el.id === selectedId)?.rotation || 0) + 90) % 360 })} className="rounded-xl gap-2"><RotateCw size={16} /> تدوير</Button>
                      <Button variant="outline" onClick={() => handleDuplicate('right')} className="rounded-xl gap-2"><ArrowRight size={16} /> يمين</Button>
                      <Button variant="outline" onClick={() => handleDuplicate('down')} className="rounded-xl gap-2"><ArrowDown size={16} /> أسفل</Button>
                    </div>
                  </div>
                  
                  {elements.find(el => el.id === selectedId)?.type === 'tower' && (
                    <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عدد الطوابق</label><input type="number" className="w-full p-2 rounded-lg border border-slate-200" value={elements.find(el => el.id === selectedId)?.floors} onChange={(e) => updateElement(selectedId, { floors: parseInt(e.target.value) || 1 })} /></div>
                      <div className="space-y-2"><label className="text-xs font-bold text-slate-500">شقق/طابق</label><input type="number" className="w-full p-2 rounded-lg border border-slate-200" value={elements.find(el => el.id === selectedId)?.apartmentsPerFloor} onChange={(e) => updateElement(selectedId, { apartmentsPerFloor: parseInt(e.target.value) || 1 })} /></div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2"><label className="text-sm font-bold text-slate-500">العرض</label><input type="number" className="w-full p-3 rounded-xl border border-slate-200" value={elements.find(el => el.id === selectedId)?.width} onChange={(e) => updateElement(selectedId, { width: parseInt(e.target.value) || 0 })} /></div>
                    <div className="space-y-2"><label className="text-sm font-bold text-slate-500">الطول</label><input type="number" className="w-full p-3 rounded-xl border border-slate-200" value={elements.find(el => el.id === selectedId)?.height} onChange={(e) => updateElement(selectedId, { height: parseInt(e.target.value) || 0 })} /></div>
                  </div>
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