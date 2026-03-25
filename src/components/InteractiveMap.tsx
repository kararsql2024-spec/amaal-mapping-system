"use client";

import React from 'react';
import { cn } from "@/lib/utils";
import { MapElement, ElementType } from '@/types/project';

interface InteractiveMapProps {
  elements: MapElement[];
  onHouseClick: (houseId: string) => void;
  selectedHouseId?: string | null;
  housesData: Record<string, any>;
}

const InteractiveMap = ({ elements, onHouseClick, selectedHouseId, housesData }: InteractiveMapProps) => {
  
  const getElementStyles = (el: MapElement) => {
    const data = housesData[el.id];
    const isSelected = selectedHouseId === el.id;

    if (el.type === 'road') return { fill: 'fill-gray-300', stroke: 'stroke-gray-400' };
    if (el.type === 'green') return { fill: 'fill-emerald-200', stroke: 'stroke-emerald-500' };
    
    if (data) {
      if (data.status === 'sold') return { fill: 'fill-rose-500', stroke: 'stroke-rose-600' };
      if (data.status === 'reserved') return { fill: 'fill-amber-400', stroke: 'stroke-amber-500' };
      if (data.status === 'pending') return { fill: 'fill-blue-500', stroke: 'stroke-blue-600' };
      return { fill: 'fill-emerald-500', stroke: 'stroke-emerald-600' };
    }

    if (el.type === 'tower') return { fill: 'fill-slate-100', stroke: 'stroke-slate-400' };
    return { fill: 'fill-white', stroke: 'stroke-slate-200' };
  };

  return (
    <div className="relative w-full aspect-[4/3] bg-slate-50 rounded-[2.5rem] border-4 border-white shadow-2xl overflow-hidden group">
      <svg 
        viewBox="0 0 1000 800" 
        className="w-full h-full touch-none select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <pattern id="grid-view" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-view)" />
        
        {elements.map((el) => {
          const styles = getElementStyles(el);
          const isSelected = selectedHouseId === el.id;
          const isInteractive = el.type === 'house' || el.type === 'tower' || el.type === 'amenity';

          return (
            <g 
              key={el.id} 
              onClick={() => isInteractive && onHouseClick(el.id)}
              className={cn(isInteractive ? "cursor-pointer" : "pointer-events-none")}
            >
              <rect
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                rx={el.type === 'road' ? 0 : 6}
                className={cn(
                  "transition-all duration-300 stroke-2",
                  styles.fill,
                  styles.stroke,
                  isSelected && "stroke-black stroke-[3px] filter brightness-90"
                )}
              />
              {el.label && (
                <text
                  x={el.x + el.width / 2}
                  y={el.y + el.height / 2}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={cn(
                    "text-[12px] font-black pointer-events-none select-none",
                    housesData[el.id] ? "fill-white" : "fill-slate-500"
                  )}
                >
                  {el.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="absolute bottom-6 right-6 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-slate-200 flex flex-col gap-3 text-xs font-black shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-md bg-emerald-500" />
          <span>متوفر</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-md bg-blue-500" />
          <span>حجز أولي</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-md bg-amber-400" />
          <span>محجوز</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-4 h-4 rounded-md bg-rose-500" />
          <span>مباع</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMap;