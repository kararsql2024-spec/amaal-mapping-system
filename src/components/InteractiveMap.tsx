"use client";

import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { MapElement, Point } from '@/types/project';
import { ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

interface InteractiveMapProps {
  elements: MapElement[];
  onHouseClick: (houseId: string) => void;
  selectedHouseId?: string | null;
  housesData: Record<string, any>;
  mapWidth: number;
  mapHeight: number;
}

const InteractiveMap = ({ elements, onHouseClick, selectedHouseId, housesData, mapWidth, mapHeight }: InteractiveMapProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.5), 5));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  // وظيفة لضمان وجود نقاط للعنصر (تحويل البيانات القديمة إذا لزم الأمر)
  const getElementPoints = (el: MapElement): Point[] => {
    if (el.points && el.points.length > 0) return el.points;
    // إذا كان عنصراً قديماً، ننشئ نقاطه من x, y, width, height
    return [
      { x: el.x, y: el.y },
      { x: el.x + el.width, y: el.y },
      { x: el.x + el.width, y: el.y + el.height },
      { x: el.x, y: el.y + el.height },
    ];
  };

  const pointsToPath = (points: Point[]) => {
    if (!points || points.length === 0) return "";
    return `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ') + " Z";
  };

  const getElementStyles = (el: MapElement) => {
    const data = housesData[el.id];
    if (el.type === 'road') return { fill: 'fill-gray-300', stroke: 'none' };
    if (el.type === 'green') return { fill: 'fill-emerald-200', stroke: 'stroke-emerald-500' };
    if (el.type === 'tower') return { fill: 'fill-slate-800', stroke: 'stroke-slate-900' };
    if (data) {
      if (data.status === 'sold') return { fill: 'fill-rose-500', stroke: 'stroke-rose-600' };
      if (data.status === 'reserved') return { fill: 'fill-amber-400', stroke: 'stroke-amber-500' };
      if (data.status === 'pending') return { fill: 'fill-blue-500', stroke: 'stroke-blue-600' };
      return { fill: 'fill-emerald-500', stroke: 'stroke-emerald-600' };
    }
    return { fill: 'fill-white', stroke: 'stroke-slate-200' };
  };

  return (
    <div className="relative w-full aspect-[4/3] bg-slate-100 rounded-[2.5rem] border-4 border-white shadow-2xl overflow-hidden group cursor-grab active:cursor-grabbing">
      <div className="w-full h-full" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full touch-none select-none transition-transform duration-75 ease-out" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
          <defs>
            <pattern id="grid-view" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="0.5"/></pattern>
            <filter id="road-merge-view">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur" />
              <feColorMatrix in="blur" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7" result="merge" />
              <feComposite in="SourceGraphic" in2="merge" operator="atop" />
            </filter>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-view)" />
          
          <g filter="url(#road-merge-view)">
            {elements.filter(el => el.type === 'road').map(el => {
              const pts = getElementPoints(el);
              const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
              const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
              return (
                <path key={el.id} d={pointsToPath(pts)} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`} className="fill-gray-300" />
              );
            })}
          </g>

          {elements.filter(el => el.type !== 'road').map((el) => {
            const styles = getElementStyles(el);
            const isSelected = selectedHouseId === el.id;
            const isInteractive = el.type === 'house' || el.type === 'tower';
            const pts = getElementPoints(el);
            const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

            return (
              <g key={el.id} onClick={(e) => { e.stopPropagation(); if (isInteractive) onHouseClick(el.id); }} className={cn(isInteractive ? "cursor-pointer" : "pointer-events-none")} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                <path d={pointsToPath(pts)} className={cn("transition-all duration-300 stroke-2", styles.fill, styles.stroke, isSelected && "stroke-black stroke-[3px] filter brightness-90")} />
                {el.label && (
                  <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" className={cn("text-[12px] font-black pointer-events-none select-none", el.type === 'tower' || housesData[el.id] ? "fill-white" : "fill-slate-500")}>
                    {el.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      
      <div className="absolute top-6 left-6 flex flex-col gap-2">
        <button onClick={() => setScale(s => Math.min(s + 0.2, 5))} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors"><ZoomIn size={20} /></button>
        <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors"><ZoomOut size={20} /></button>
        <button onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors"><RotateCcw size={20} /></button>
      </div>
    </div>
  );
};

export default InteractiveMap;