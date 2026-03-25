"use client";

import React, { useState, useRef } from 'react';
import { MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, Save, MousePointer2, Square } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[]) => void;
}

const MapEditor = ({ initialElements, onSave }: MapEditorProps) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    
    // Only add if clicking the background, not an existing element
    if (e.target !== svgRef.current) return;

    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svgRef.current.getScreenCTM()?.inverse());

    const newElement: MapElement = {
      id: Math.random().toString(36).substr(2, 9),
      x: Math.round(svgP.x - 25),
      y: Math.round(svgP.y - 20),
      width: 50,
      height: 40,
      type: 'house',
      label: (elements.length + 1).toString(),
      status: 'available'
    };

    setElements([...elements, newElement]);
    setSelectedId(newElement.id);
  };

  const deleteElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    setSelectedId(null);
  };

  const updateElement = (id: string, updates: Partial<MapElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  return (
    <div className="flex flex-col gap-4 h-full" dir="rtl">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold">
            <MousePointer2 size={16} />
            <span>انقر على الخريطة لإضافة وحدة</span>
          </div>
        </div>
        <Button onClick={() => onSave(elements)} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
          <Save size={18} />
          حفظ المخطط
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 min-h-[500px]">
        <div className="lg:col-span-3 relative bg-slate-100 rounded-[2rem] border-4 border-white shadow-inner overflow-hidden">
          <svg
            ref={svgRef}
            viewBox="0 0 800 600"
            className="w-full h-full cursor-crosshair"
            onClick={handleCanvasClick}
          >
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#e2e8f0" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            
            {elements.map((el) => (
              <g 
                key={el.id} 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(el.id);
                }}
                className="cursor-move"
              >
                <rect
                  x={el.x}
                  y={el.y}
                  width={el.width}
                  height={el.height}
                  rx="4"
                  className={cn(
                    "fill-white stroke-2 transition-all",
                    selectedId === el.id ? "stroke-blue-500 fill-blue-50" : "stroke-slate-300"
                  )}
                />
                <text
                  x={el.x + el.width / 2}
                  y={el.y + el.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-[10px] font-bold fill-slate-600 pointer-events-none"
                >
                  {el.label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
          <h3 className="font-bold text-lg border-b pb-4">خصائص العنصر</h3>
          {selectedId ? (
            <div className="space-y-4">
              {elements.find(el => el.id === selectedId) && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">رقم/اسم الوحدة</label>
                    <input 
                      type="text"
                      className="w-full p-2 rounded-lg border border-slate-200"
                      value={elements.find(el => el.id === selectedId)?.label}
                      onChange={(e) => updateElement(selectedId, { label: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">العرض</label>
                      <input 
                        type="number"
                        className="w-full p-2 rounded-lg border border-slate-200"
                        value={elements.find(el => el.id === selectedId)?.width}
                        onChange={(e) => updateElement(selectedId, { width: parseInt(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">الطول</label>
                      <input 
                        type="number"
                        className="w-full p-2 rounded-lg border border-slate-200"
                        value={elements.find(el => el.id === selectedId)?.height}
                        onChange={(e) => updateElement(selectedId, { height: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                  <Button 
                    variant="destructive" 
                    className="w-full gap-2"
                    onClick={() => deleteElement(selectedId)}
                  >
                    <Trash2 size={16} />
                    حذف العنصر
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400">
              <Square className="mx-auto mb-2 opacity-20" size={48} />
              <p>حدد عنصراً لتعديله</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapEditor;