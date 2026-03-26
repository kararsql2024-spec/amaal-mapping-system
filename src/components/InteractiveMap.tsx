"use client";

import React, { useState, useRef } from 'react';
import { cn } from "@/lib/utils";
import { MapElement, Point, ElementType } from '@/types/project';
import { 
  ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize,
  Home, Building2, Store, GraduationCap, Stethoscope, 
  Baby, ShoppingBag, Dumbbell, ShoppingCart, MoonStar, Trophy, Leaf
} from "lucide-react";

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
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);

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

  const getDistance = (t1: React.Touch, t2: React.Touch) => {
    return Math.sqrt(Math.pow(t2.clientX - t1.clientX, 2) + Math.pow(t2.clientY - t1.clientY, 2));
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
      setLastTouchDistance(null);
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = getDistance(e.touches[0], e.touches[1]);
      setLastTouchDistance(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPosition({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
    } else if (e.touches.length === 2 && lastTouchDistance !== null) {
      const dist = getDistance(e.touches[0], e.touches[1]);
      const ratio = dist / lastTouchDistance;
      setScale(prev => Math.min(Math.max(prev * ratio, 0.5), 5));
      setLastTouchDistance(dist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDistance(null);
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
    if (el.type === 'amenity') return { fill: el.color || '#f59e0b', stroke: el.color || '#d97706', opacity: 1 };
    
    if (el.type === 'house') {
      if (data?.status?.startsWith('frozen')) return { fill: '#e2e8f0', stroke: '#94a3b8', opacity: 1 };
      if (!data || data.status === 'available') return { fill: '#10b981', stroke: '#059669', opacity: 1 };
      if (data.status === 'sold') return { fill: '#f43f5e', stroke: '#e11d48', opacity: 1 };
      if (data.status === 'reserved') return { fill: '#fbbf24', stroke: '#f59e0b', opacity: 1 };
      if (data.status === 'pending') return { fill: '#3b82f6', stroke: '#2563eb', opacity: 1 };
    }
    
    return { fill: '#ffffff', stroke: '#cbd5e1', opacity: 1 };
  };

  const getShortLabel = (label: string, type: ElementType) => {
    if (!label) return "";
    if (type === 'house' || type === 'tower') {
      const parts = label.split('-');
      return parts[parts.length - 1];
    }
    return label;
  };

  const getAmenityIcon = (type: string | undefined) => {
    switch (type) {
      case 'shop': return Store;
      case 'school': return GraduationCap;
      case 'medical': return Stethoscope;
      case 'nursery': return Baby;
      case 'mall': return ShoppingBag;
      case 'gym': return Dumbbell;
      case 'supermarket': return ShoppingCart;
      case 'mosque': return MoonStar;
      default: return MapPin;
    }
  };

  const sortedElements = [...elements].sort((a, b) => {
    if (a.type === 'label_area' && b.type !== 'label_area') return -1;
    if (a.type !== 'label_area' && b.type === 'label_area') return 1;
    return 0;
  });

  return (
    <div className={cn(
      "relative w-full bg-slate-100 border-4 border-white shadow-2xl overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-300 touch-none",
      isFullScreen ? "fixed inset-0 z-[40] rounded-none border-0" : "aspect-[4/3] rounded-[2.5rem]"
    )}>
      <div 
        className="w-full h-full" 
        onWheel={handleWheel} 
        onMouseDown={handleMouseDown} 
        onMouseMove={handleMouseMove} 
        onMouseUp={() => setIsDragging(false)} 
        onMouseLeave={() => setIsDragging(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <svg 
          ref={svgRef}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`} 
          className="w-full h-full touch-none select-none transition-transform duration-75 ease-out" 
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}
        >
          <defs>
            <pattern id="grid-view" width="50" height="50" patternUnits="userSpaceOnUse">
              <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="0.5"/>
            </pattern>
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

            const IconComponent = el.type === 'house' ? Home : 
                            el.type === 'tower' ? Building2 : 
                            el.type === 'amenity' ? getAmenityIcon(el.amenityType) :
                            el.type === 'green' ? Leaf :
                            el.type === 'pitch' ? Trophy : null;

            return (
              <g 
                key={el.id} 
                onClick={(e) => { e.stopPropagation(); if (isInteractive) onHouseClick(el.id); }} 
                className={cn(isInteractive ? "cursor-pointer" : "pointer-events-none")} 
                transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}
              >
                {el.type === 'label_area' ? (
                  <rect
                    x={minX} y={minY} width={w} height={h}
                    rx="20" ry="20"
                    fill={styles.fill}
                    stroke={styles.stroke}
                    fillOpacity={styles.opacity}
                    strokeWidth="2"
                    className={cn("transition-all duration-300", isSelected && "stroke-black stroke-[3px] filter brightness-90")} 
                  />
                ) : (
                  <path 
                    d={pointsToPath(pts)} 
                    fill={styles.fill}
                    stroke={styles.stroke}
                    fillOpacity={styles.opacity}
                    strokeWidth={el.type === 'pitch' ? 2 : (el.type === 'road' ? 0 : 2)}
                    className={cn("transition-all duration-300", isSelected && "stroke-black stroke-[3px] filter brightness-90")} 
                  />
                )}

                {IconComponent && (
                  <foreignObject 
                    x={centerX - 12} 
                    y={centerY - 18} 
                    width="24" 
                    height="24" 
                    pointerEvents="none"
                  >
                    <div className="flex items-center justify-center w-full h-full">
                      <IconComponent 
                        size={20} 
                        color={el.textColor || (el.type === 'tower' || (el.type === 'house' && housesData[el.id]) ? '#ffffff' : '#1e293b')} 
                        strokeWidth={2.5}
                      />
                    </div>
                  </foreignObject>
                )}

                {el.type === 'road' && (
                  el.orientation === 'vertical' ? 
                  <line x1={centerX} y1={minY} x2={centerX} y2={maxY} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" /> :
                  <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" />
                )}
                
                {el.type === 'pitch' && (
                  <g opacity="0.4" pointerEvents="none">
                    <circle cx={centerX} cy={centerY} r={Math.min(w, h)/6} fill="none" stroke="white" strokeWidth="1" />
                    {el.orientation === 'vertical' ? (
                      <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke="white" strokeWidth="1" />
                    ) : (
                      <line x1={centerX} y1={minY} x2={centerX} y2={maxY} stroke="white" strokeWidth="1" />
                    )}
                  </g>
                )}

                {el.label && (
                  <text 
                    x={el.type === 'label_area' ? topCenterX : centerX} 
                    y={el.type === 'label_area' ? minY - 10 : centerY + 15} 
                    textAnchor="middle" 
                    dominantBaseline="middle"
                    fill={el.textColor || (el.type === 'tower' || (el.type === 'house' && housesData[el.id]) ? '#ffffff' : '#1e293b')}
                    className="font-black pointer-events-none select-none text-[10px]"
                  >
                    {getShortLabel(el.label, el.type)}
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