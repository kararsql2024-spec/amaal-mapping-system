"use client";

import React from 'react';
import { cn } from "@/lib/utils";
import { MapElement } from '@/types/project';

interface InteractiveMapProps {
  elements: MapElement[];
  onHouseClick: (houseId: string) => void;
  selectedHouseId?: string | null;
  housesData: Record<string, any>;
}

const InteractiveMap = ({ elements, onHouseClick, selectedHouseId, housesData }: InteractiveMapProps) => {
  return (
    <div className="relative w-full aspect-[4/3] bg-slate-50 rounded-3xl border-4 border-white shadow-2xl overflow-hidden group">
      <svg 
        viewBox="0 0 800 600" 
        className="w-full h-full touch-none select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background Grid */}
        <defs>
          <pattern id="grid-bg" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#f1f5f9" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid-bg)" />
        
        {/* Elements drawn in Admin */}
        {elements.map((el) => {
          const isSelected = selectedHouseId === el.id;
          const data = housesData[el.id];
          
          let fillColor = "fill-white";
          let strokeColor = "stroke-slate-200";
          
          if (data) {
            if (data.status === 'sold') fillColor = "fill-rose-500", strokeColor = "stroke-rose-600";
            else if (data.status === 'reserved') fillColor = "fill-amber-400", strokeColor = "stroke-amber-500";
            else if (data.status === 'pending') fillColor = "fill-blue-500", strokeColor = "stroke-blue-600";
            else fillColor = "fill-emerald-500", strokeColor = "stroke-emerald-600";
          }

          return (
            <g 
              key={el.id} 
              onClick={() => onHouseClick(el.id)}
              className="cursor-pointer transition-all duration-300 hover:filter hover:brightness-95"
            >
              <rect
                x={el.x}
                y={el.y}
                width={el.width}
                height={el.height}
                rx="4"
                className={cn(
                  "transition-all duration-300 stroke-2",
                  fillColor,
                  strokeColor,
                  isSelected && "stroke-black stroke-[3px]"
                )}
              />
              <text
                x={el.x + el.width / 2}
                y={el.y + el.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn(
                  "text-[10px] font-bold pointer-events-none select-none",
                  data ? "fill-white" : "fill-slate-400"
                )}
              >
                {el.label}
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm p-3 rounded-xl border border-slate-200 flex flex-col gap-2 text-xs font-bold shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500" />
          <span>متوفر</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>حجز أولي</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span>محجوز</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-500" />
          <span>مباع</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMap;