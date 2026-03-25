"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MapElement, ElementType } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, MousePointer2, Home, 
  Building2, TreeDeciduous, MoveRight, Coffee 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[]) => void;
}

const TOOLS: { type: ElementType; label: string; icon: any; color: string }[] = [
  { type: 'house', label: 'منزل', icon: Home, color: 'bg-blue-500' },
  { type: 'tower', label: 'برج', icon: Building2, color: 'bg-slate-700' },
  { type: 'road', label: 'طريق', icon: MoveRight, color: 'bg-gray-400' },
  { type: 'green', label: 'مساحة خضراء', icon: TreeDeciduous, color: 'bg-emerald-500' },
  { type: 'amenity', label: 'مرفق', icon: Coffee, color: 'bg-amber-500' },
];

const MapEditor = ({ initialElements, onSave }: MapEditorProps) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ElementType>('house');
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || isDragging) return;
    if (e.target !== svgRef.current) return;

    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

    const defaults = {
      house: { w: 40, h: 40 },
      tower: { w: 50, h: 70 },
      road: { w: 100, h: 20 },
      green: { w: 80, h: 60 },
      amenity: { w: 40, h: 40 },
    };

    const newElement: MapElement = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.round(svgP.x - defaults[activeTool].w / 2),
      y: Math.round(svgP.y - defaults[activeTool].h / 2),
      width: defaults[activeTool].w,
      height: defaults[activeTool].h,
      type: activeTool,
      label: activeTool === 'house' ? (elements.filter(el => el.type === 'house').length + 1).toString() : '',
      status: activeTool === 'road' || activeTool === 'green' ? 'public' : 'available'
    };

    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const handleMouseDown = (id: string) => {
    setSelectedId(id);
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !selectedId || !svgRef.current) return;

    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

    setElements(prev => prev.map(el => {
      if (el.id === selectedId) {
        return {
          ...el,
          x: Math.round(svgP.x - el.width / 2),
          y: Math.round(svgP.y - el.height / 2)
        };
      }
      return el;
    }));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const updateElement = (id: string, updates: Partial<MapElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const getElementColor = (type: ElementType) => {
    switch (type) {
      case 'house': return 'fill-white stroke-blue-400';
      case 'tower': return 'fill-slate-200 stroke-slate-600';
      case 'road': return 'fill-gray-300 stroke-gray-400';
      case 'green': return 'fill-emerald-100 stroke-emerald-500';
      case 'amenity': return 'fill-amber-50 stroke-amber-500';
      default: return 'fill-white stroke-slate-300';
    }
  };

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-200px)]" dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          {TOOLS.map((tool) => (
            <button
              key={tool.type}
              onClick={() => setActiveTool(tool.type)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                activeTool === tool.type 
                  ? `${tool.color} text-white shadow-lg scale-105` 
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              )}
            >
              <tool.icon size={18} />
              <span className="hidden md:inline">{tool.label}</span>
            </button>
          ))}
        </div>
        <Button onClick={() => onSave(elements)} className="bg-emerald-600 hover:bg-emerald-700 gap-2 rounded-xl px-6">
          <Save size={18} />
          حفظ المخطط النهائي
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="lg:col-span-3 relative bg-slate-200 rounded-[2.5rem] border-8 border-white shadow-inner overflow-hidden">
          <svg
            ref={svgRef}
            viewBox="0 0 1000 800"
            className="w-full h-full cursor-crosshair"
            onClick={handleCanvasClick}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <defs>
              <pattern id="grid-editor" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid-editor)" />
            
            {elements.map((el) => (
              <g 
                key={el.id} 
                onMouseDown={(e) => {
                  e.stopPropagation();
                  handleMouseDown(el.id);
                }}
                className="cursor-move group"
              >
                <rect
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  rx={el.type === 'road' ? 0 : 6}
                  className={cn(
                    "transition-all stroke-2",
                    getElementColor(el.type),
                    selectedId === el.id && "stroke-blue-600 stroke-[3px] filter drop-shadow-lg"
                  )}
                />
                {el.label && (
                  <text
                    x={el.x + el.width / 2}
                    y={el.y + el.height / 2}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className="text-[12px] font-black fill-slate-700 pointer-events-none select-none"
                  >
                    {el.label}
                  </text>
                )}
              </g>
            ))}
          </svg>
        </div>

        {/* Properties Sidebar */}
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-6 overflow-y-auto">
          <h3 className="font-black text-xl border-b pb-4 text-slate-800">خصائص العنصر</h3>
          {selectedId ? (
            <div className="space-y-5">
              {elements.find(el => el.id === selectedId) && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">تسمية الوحدة</label>
                    <input 
                      type="text"
                      className="w-full p-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                      value={elements.find(el => el.id === selectedId)?.label}
                      onChange={(e) => updateElement(selectedId, { label: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500">العرض</label>
                      <input 
                        type="number"
                        className="w-full p-3 rounded-xl border border-slate-200"
                        value={elements.find(el => el.id === selectedId)?.width}
                        onChange={(e) => updateElement(selectedId, { width: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500">الطول</label>
                      <input 
                        type="number"
                        className="w-full p-3 rounded-xl border border-slate-200"
                        value={elements.find(el => el.id === selectedId)?.height}
                        onChange={(e) => updateElement(selectedId, { height: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  </div>
                  <div className="pt-4">
                    <Button 
                      variant="destructive" 
                      className="w-full gap-2 rounded-xl h-12 font-bold"
                      onClick={() => {
                        setElements(elements.filter(el => el.id !== selectedId));
                        setSelectedId(null);
                      }}
                    >
                      <Trash2 size={18} />
                      حذف العنصر
                    </Button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <MousePointer2 size={32} className="opacity-20" />
              </div>
              <p className="font-bold">حدد عنصراً من الخريطة لتعديله</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapEditor;