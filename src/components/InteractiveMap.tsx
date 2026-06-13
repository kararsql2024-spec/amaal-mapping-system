"use client";

import React from 'react';
import { MapElement } from '@/types/project';
import { cn } from '@/lib/utils';
import { Building2, Home, Snowflake } from 'lucide-react';

interface InteractiveMapProps {
  elements: MapElement[];
  onHouseClick: (id: string) => void;
  selectedHouseId: string | null;
  housesData: Record<string, any>;
  mapWidth?: number;
  mapHeight?: number;
  permissions?: any;
}

const InteractiveMap = ({ elements, onHouseClick, selectedHouseId, housesData, mapWidth = 1000, mapHeight = 800, permissions }: InteractiveMapProps) => {
  
  const getElementColor = (el: MapElement) => {
    const mode = permissions?.colorMode || 'default';

    if (el.type === 'house') {
      const data = housesData[el.id] || { status: 'available' };
      const status = data.status || 'available';
      if (status?.startsWith('frozen')) return 'fill-slate-200 stroke-slate-300';

      if (mode === 'tabo') {
        const tabo = data.taboStatus?.trim();
        if (tabo === 'مستلم') return 'fill-emerald-500 stroke-emerald-600';
        if (tabo === 'مروج') return 'fill-indigo-500 stroke-indigo-600';
        return 'fill-slate-400 stroke-slate-500';
      }

      if (mode === 'handover') {
        return data.handoverDate ? 'fill-sky-500 stroke-sky-600' : 'fill-rose-400 stroke-rose-500';
      }

      switch (status) {
        case 'sold': return 'fill-rose-500 stroke-rose-600';
        case 'pending': return 'fill-blue-500 stroke-blue-600';
        case 'reserved': return 'fill-amber-400 stroke-amber-500';
        case 'investment': return 'fill-purple-400 stroke-purple-500';
        default: return 'fill-emerald-500 stroke-emerald-600';
      }
    }

    if (el.type === 'tower') {
      // للأبراج، نأخذ حالة أول شقة كمؤشر للون البرج في الخريطة العامة
      const firstAptKey = `${el.id}_F1_A1`;
      const data = housesData[firstAptKey] || { status: 'available' };
      const status = data.status || 'available';
      if (status?.startsWith('frozen')) return 'fill-slate-200 stroke-slate-300';

      if (mode === 'tabo') {
        const tabo = data.taboStatus?.trim();
        if (tabo === 'مستلم') return 'fill-emerald-500 stroke-emerald-600';
        if (tabo === 'مروج') return 'fill-indigo-500 stroke-indigo-600';
        return 'fill-slate-400 stroke-slate-500';
      }

      if (mode === 'handover') {
        return data.handoverDate ? 'fill-sky-500 stroke-sky-600' : 'fill-rose-400 stroke-rose-500';
      }

      switch (status) {
        case 'sold': return 'fill-rose-500 stroke-rose-600';
        case 'pending': return 'fill-blue-500 stroke-blue-600';
        case 'reserved': return 'fill-amber-400 stroke-amber-500';
        case 'investment': return 'fill-purple-400 stroke-purple-500';
        default: return 'fill-emerald-500 stroke-emerald-600';
      }
    }

    return 'fill-slate-100 stroke-slate-200';
  };

  return (
    <div className="relative w-full h-full bg-slate-50 rounded-[2.5rem] border-4 border-white shadow-inner overflow-hidden">
      <div 
        className="relative mx-auto transition-transform duration-500 ease-out"
        style={{ 
          width: mapWidth, 
          height: mapHeight,
          transformOrigin: 'center center'
        }}
      >
        <svg 
          viewBox={`0 0 ${mapWidth} ${mapHeight}`} 
          className="w-full h-full drop-shadow-2xl"
        >
          {elements.map((el) => {
            if (housesData[el.id]?.status === 'frozen_hidden') return null;
            
            return (
              <g 
                key={el.id} 
                onClick={() => onHouseClick(el.id)}
                className="cursor-pointer group"
              >
                <path
                  d={el.path}
                  className={cn(
                    "transition-all duration-300 stroke-2",
                    getElementColor(el),
                    selectedHouseId === el.id ? "stroke-white stroke-[4px] filter drop-shadow-lg scale-[1.02]" : "hover:opacity-80"
                  )}
                />
                <text
                  x={el.labelX || 0}
                  y={el.labelY || 0}
                  textAnchor="middle"
                  className="fill-white font-black text-[10px] pointer-events-none select-none drop-shadow-md"
                >
                  {el.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default InteractiveMap;