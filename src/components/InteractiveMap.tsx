"use client";

import React from 'react';
import { cn } from "@/lib/utils";

interface House {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  status: 'available' | 'sold' | 'pending';
}

interface InteractiveMapProps {
  onHouseClick: (houseId: string) => void;
  selectedHouseId?: string | null;
  housesData: Record<string, any>;
}

const MOCK_HOUSES: House[] = [
  { id: '1', x: 50, y: 50, width: 80, height: 60, status: 'available' },
  { id: '2', x: 150, y: 50, width: 80, height: 60, status: 'sold' },
  { id: '3', x: 250, y: 50, width: 80, height: 60, status: 'pending' },
  { id: '4', x: 50, y: 130, width: 80, height: 60, status: 'available' },
  { id: '5', x: 150, y: 130, width: 80, height: 60, status: 'available' },
  { id: '6', x: 250, y: 130, width: 80, height: 60, status: 'sold' },
  { id: '7', x: 50, y: 210, width: 180, height: 80, status: 'available' },
  { id: '8', x: 250, y: 210, width: 80, height: 80, status: 'pending' },
];

const InteractiveMap = ({ onHouseClick, selectedHouseId, housesData }: InteractiveMapProps) => {
  return (
    <div className="relative w-full aspect-[4/3] bg-slate-50 rounded-3xl border-4 border-white shadow-2xl overflow-hidden group">
      <svg 
        viewBox="0 0 400 350" 
        className="w-full h-full touch-none select-none"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background Grid/Roads */}
        <rect x="0" y="0" width="400" height="350" fill="#f8fafc" />
        <path d="M0 115 L400 115 M0 200 L400 200 M140 0 L140 350 M240 0 L240 350" 
              stroke="#e2e8f0" strokeWidth="15" fill="none" />
        
        {/* Houses */}
        {MOCK_HOUSES.map((house) => {
          const isSelected = selectedHouseId === house.id;
          const hasData = !!housesData[house.id];
          
          let fillColor = "fill-white";
          let strokeColor = "stroke-slate-200";
          
          if (hasData) {
            const status = housesData[house.id].status;
            if (status === 'sold') fillColor = "fill-rose-100", strokeColor = "stroke-rose-400";
            else if (status === 'pending') fillColor = "fill-amber-100", strokeColor = "stroke-amber-400";
            else fillColor = "fill-emerald-100", strokeColor = "stroke-emerald-400";
          }

          return (
            <g 
              key={house.id} 
              onClick={() => onHouseClick(house.id)}
              className="cursor-pointer transition-all duration-300 hover:filter hover:drop-shadow-md"
            >
              <rect
                x={house.x}
                y={house.y}
                width={house.width}
                height={house.height}
                rx="8"
                className={cn(
                  "transition-all duration-300 stroke-2",
                  fillColor,
                  strokeColor,
                  isSelected && "stroke-blue-500 stroke-[3px] fill-blue-50"
                )}
              />
              <text
                x={house.x + house.width / 2}
                y={house.y + house.height / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                className={cn(
                  "text-[10px] font-bold pointer-events-none select-none",
                  isSelected ? "fill-blue-600" : "fill-slate-400"
                )}
              >
                {house.id}#
              </text>
            </g>
          );
        })}
      </svg>
      
      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-slate-200 flex flex-col gap-2 text-xs font-medium">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span>متاح</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-rose-400" />
          <span>تم البيع</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-400" />
          <span>قيد الانتظار</span>
        </div>
      </div>
    </div>
  );
};

export default InteractiveMap;