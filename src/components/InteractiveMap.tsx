"use client";

import React from 'react';
import { MapElement, Point } from '@/types/project';
import { cn } from '@/lib/utils';

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
  
  const pointsToPath = (points: Point[], closed = true) => {
    if (!points || points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    return closed ? path + " Z" : path;
  };

  const getCenter = (points: Point[]) => {
    if (!points || points.length === 0) return { x: 0, y: 0 };
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    return { x, y };
  };

  const getElementColor = (el: MapElement) => {
    const mode = permissions?.colorMode || 'default';

    if (el.type === 'house' || el.type === 'tower') {
      const key = el.type === 'house' ? el.id : `${el.id}_F1_A1`;
      const data = housesData[key] || { status: 'available' };
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

    if (el.type === 'road') return 'fill-slate-600 stroke-slate-700';
    if (el.type === 'green') return 'fill-emerald-100 stroke-emerald-200';
    if (el.type === 'pitch') return 'fill-green-600 stroke-white';
    
    return 'fill-slate-100 stroke-slate-200';
  };

  const layerOrder: Record<string, number> = { 
    'reference_image': -2, 
    'green': -1, 
    'label_area': 0, 
    'road': 1, 
    'pitch': 2, 
    'amenity': 2, 
    'house': 3, 
    'tower': 3, 
    'text': 4 
  };
  
  const sortedElements = [...elements].sort((a, b) => (layerOrder[a.type] || 0) - (layerOrder[b.type] || 0));

  return (
    <div className="relative w-full h-full bg-slate-100 rounded-[2.5rem] border-4 border-white shadow-inner overflow-hidden">
      <div 
        className="relative mx-auto"
        style={{ width: mapWidth, height: mapHeight }}
      >
        <svg 
          viewBox={`0 0 ${mapWidth} ${mapHeight}`} 
          className="w-full h-full"
        >
          <defs>
            <pattern id="grid-main" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="0.5" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width={mapWidth} height={mapHeight} fill="url(#grid-main)" />

          {sortedElements.map((el) => {
            if (el.type === 'house' && housesData[el.id]?.status === 'frozen_hidden') return null;
            
            const pts = el.points || [];
            if (pts.length === 0) return null;
            
            const center = getCenter(pts);
            const isSelected = selectedHouseId === el.id;

            if (el.type === 'reference_image' && el.showInMain) {
              const minX = Math.min(...pts.map(p => p.x));
              const minY = Math.min(...pts.map(p => p.y));
              const maxX = Math.max(...pts.map(p => p.x));
              const maxY = Math.max(...pts.map(p => p.y));
              return (
                <image 
                  key={el.id}
                  href={el.color} 
                  x={minX} y={minY} 
                  width={maxX - minX} height={maxY - minY} 
                  opacity={el.opacity || 0.5}
                  style={{ transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: `${center.x}px ${center.y}px` }}
                />
              );
            }

            if (el.type === 'text') {
              return (
                <text
                  key={el.id}
                  x={center.x}
                  y={center.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={el.textColor || '#000000'}
                  style={{ 
                    fontSize: `${el.fontSize || 24}px`, 
                    fontFamily: el.fontFamily || 'Arial',
                    fontWeight: el.isBold ? 'bold' : 'normal',
                    transform: `rotate(${el.rotation || 0}deg)`,
                    transformOrigin: `${center.x}px ${center.y}px`
                  }}
                >
                  {el.label}
                </text>
              );
            }

            return (
              <g 
                key={el.id} 
                onClick={() => (el.type === 'house' || el.type === 'tower') && onHouseClick(el.id)}
                className={cn((el.type === 'house' || el.type === 'tower') ? "cursor-pointer" : "pointer-events-none")}
                style={{ transform: `rotate(${el.rotation || 0}deg)`, transformOrigin: `${center.x}px ${center.y}px` }}
              >
                <path
                  d={pointsToPath(pts, !el.isStroke)}
                  className={cn(
                    "transition-all duration-300",
                    getElementColor(el),
                    isSelected ? "stroke-white stroke-[4px] filter drop-shadow-lg" : "stroke-2"
                  )}
                  strokeWidth={el.isStroke ? el.strokeWidth : 2}
                  fillOpacity={el.type === 'label_area' ? el.opacity : 1}
                />
                {(el.type === 'house' || el.type === 'tower') && !el.hideIcon && (
                  <text
                    x={center.x}
                    y={center.y + 4}
                    textAnchor="middle"
                    className="fill-white font-black text-[10px] pointer-events-none select-none drop-shadow-md"
                  >
                    {el.label.split('-').pop()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};

export default InteractiveMap;