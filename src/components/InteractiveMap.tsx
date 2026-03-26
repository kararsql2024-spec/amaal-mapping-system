"use client";

import React, { useState } from 'react';
import { cn } from "@/lib/utils";
import { MapElement, Point } from '@/types/project';
import { ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize } from "lucide-react";

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
  const [isFullScreen, setIsFullScreen] = useState(false);

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

  const getElementPoints = (el: MapElement): Point[] => {
    if (el.points && el.points.length > 0) return el.points;
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
    if (el.type === 'label_area') return { fill: el.color || '#a855f7', stroke: el.color || '#a855f7', opacity: el.opacity || 0.2 };
    
    const data = housesData[el.id];
    if (el.type === 'road') return { fill: '#475569', stroke: '#1e293b', opacity: 1 };
    if (el.type === 'green') return { fill: '#22c55e', stroke: '#15803d', opacity: 1 };
    if (el.type === 'pitch') return { fill: '#16a34a', stroke: '#ffffff', opacity: 1 };
    if (el.type === 'tower') return { fill: '#1e293b', stroke: '#0f172a', opacity: 1 };
    if (el.type === 'amenity') return { fill: '#f59e0b', stroke: '#d97706', opacity: 1 };
    
    if (el.type === 'house') {
      if (data?.status?.startsWith('frozen')) return { fill: '#e2e8f0', stroke: '#94a3b8', opacity: 1 };
      if (!data || data.status === 'available') return { fill: '#10b981', stroke: '#059669', opacity: 1 };
      if (data.status === 'sold') return { fill: '#f43f5e', stroke: '#e11d48', opacity: 1 };
      if (data.status === 'reserved') return { fill: '#fbbf24', stroke: '#f59e0b', opacity: 1 };
      if (data.status === 'pending') return { fill: '#3b82f6', stroke: '#2563eb', opacity: 1 };
    }
    
    return { fill: '#ffffff', stroke: '#cbd5e1', opacity: 1 };
  };

  const getTextColorClass = (el: MapElement) => {
    const data = housesData[el.id];
    if (el.type === 'house') {
      if (!data || data.status === 'available' || data.status === 'sold' || data.status === 'pending' || data.status === 'reserved') return "fill-white";
      return "fill-slate-700";
    }
    switch (el.type) {
      case 'tower': return "fill-white";
      case 'road': return "fill-white";
      case 'pitch': return "fill-white";
      case 'green': return "fill-emerald-900";
      case 'amenity': return "fill-amber-900";
      default: return "fill-slate-800";
    }
  };

  const sortedElements = [...elements].sort((a, b) => {
    if (a.type === 'label_area' && b.type !== 'label_area') return -1;
    if (a.type !== 'label_area' && b.type === 'label_area') return 1;
    return 0;
  });

  return (
    <div className={cn(
      "relative w-full bg-slate-100 border-4 border-white shadow-2xl overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-300",
      isFullScreen ? "fixed inset-0 z-[40] rounded-none border-0" : "aspect-[4/3] rounded-[2.5rem]"
    )}>
      <div className="w-full h-full" onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
        <svg viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full touch-none select-none transition-transform duration-75 ease-out" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
          <defs>
            <pattern id="grid-view" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="0.5"/></pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-view)" />
          
          {sortedElements.map((el) => {
            const styles = getElementStyles(el);
            const isSelected = selectedHouseId === el.id;
            const isInteractive = el.type === 'house' || el.type === 'tower';
            const pts = getElementPoints(el);
            const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
            
            const minY = Math.min(...pts.map(p => p.y));
            const minX = Math.min(...pts.map(p => p.x));
            const maxX = Math.max(...pts.map(p => p.x));
            const maxY = Math.max(...pts.map(p => p.y));
            const topCenterX = (minX + maxX) / 2;
            const w = maxX - minX;
            const h = maxY - minY;

            return (
              <g key={el.id} onClick={(e) => { e.stopPropagation(); if (isInteractive) onHouseClick(el.id); }} className={cn(isInteractive ? "cursor-pointer" : "pointer-events-none")} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                <path 
                  d={pointsToPath(pts)} 
                  fill={styles.fill}
                  stroke={styles.stroke}
                  fillOpacity={styles.opacity}
                  strokeWidth={el.type === 'pitch' ? 2 : (el.type === 'road' ? 0 : 2)}
                  className={cn("transition-all duration-300", isSelected && "stroke-black stroke-[3px] filter brightness-90")} 
                />

                {el.type === 'road' && (
                  el.orientation === 'vertical' ? 
                  <line x1={centerX} y1={minY} x2={centerX} y2={maxY} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" /> :
                  <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" />
                )}
                
                {el.type === 'pitch' && (
                  <g opacity="0.8">
                    <circle cx={centerX} cy={centerY} r={Math.min(w, h)/6} fill="none" stroke="white" strokeWidth="1" />
                    {el.orientation === 'vertical' ? (
                      <>
                        <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke="white" strokeWidth="1" />
                        <rect x={centerX - w/4} y={minY} width={w/2} height={h/6} fill="none" stroke="white" strokeWidth="1" />
                        <rect x={centerX - w/4} y={maxY - h/6} width={w/2} height={h/6} fill="none" stroke="white" strokeWidth="1" />
                      </>
                    ) : (
                      <>
                        <line x1={centerX} y1={minY} x2={centerX} y2={maxY} stroke="white" strokeWidth="1" />
                        <rect x={minX} y={centerY - h/4} width={w/6} height={h/2} fill="none" stroke="white" strokeWidth="1" />
                        <rect x={maxX - w/6} y={centerY - h/4} width={w/6} height={h/2} fill="none" stroke="white" strokeWidth="1" />
                      </>
                    )}
                  </g>
                )}

                {el.type === 'tower' && (
                  <g opacity="0.3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <line key={i} x1={minX + 5} y1={minY + (h/4)*(i+1)} x2={maxX - 5} y2={minY + (h/4)*(i+1)} stroke="white" strokeWidth="1" />
                    ))}
                  </g>
                )}

                {el.type === 'house' && (
                  <path 
                    d={el.orientation === 'vertical' ? 
                      `M ${centerX} ${centerY - h/4} L ${centerX + w/4} ${centerY} L ${centerX} ${centerY + h/4} L ${centerX - w/4} ${centerY} Z` :
                      `M ${centerX - w/4} ${centerY} L ${centerX} ${centerY - h/4} L ${centerX + w/4} ${centerY} L ${centerX} ${centerY + h/4} Z`
                    } 
                    fill="none" stroke="white" strokeWidth="1" opacity="0.3" 
                  />
                )}

                {el.label && (
                  <text 
                    x={el.type === 'label_area' ? topCenterX : centerX} 
                    y={el.type === 'label_area' ? minY - 10 : centerY} 
                    textAnchor="middle" 
                    dominantBaseline={el.type === 'label_area' ? "auto" : "middle"}
                    className={cn("font-black pointer-events-none select-none text-[12px]", getTextColorClass(el))}
                  >
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
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50 transition-colors">
          {isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}
        </button>
      </div>
    </div>
  );
};

export default InteractiveMap;