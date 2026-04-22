"use client";

import React, { useState, useRef, useEffect } from 'react';
import { cn } from "@/lib/utils";
import { MapElement, Point, ElementType } from '@/types/project';
import { 
  ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize,
  Home, Building2, Store, GraduationCap, Stethoscope, 
  Baby, ShoppingBag, Dumbbell, ShoppingCart, MoonStar, Trophy, MapPin
} from "lucide-react";

interface InteractiveMapProps {
  elements: MapElement[];
  onHouseClick: (houseId: string) => void;
  selectedHouseId?: string | null;
  housesData: Record<string, any>;
  mapWidth: number;
  mapHeight: number;
  centerX?: number;
  centerY?: number;
}

const InteractiveMap = ({ elements, onHouseClick, selectedHouseId, housesData, mapWidth, mapHeight, centerX, centerY }: InteractiveMapProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const targetX = centerX !== undefined ? centerX : mapWidth / 2;
      const targetY = centerY !== undefined ? centerY : mapHeight / 2;
      
      const scaleW = (rect.width * 0.9) / mapWidth;
      const scaleH = (rect.height * 0.9) / mapHeight;
      const newScale = Math.min(scaleW, scaleH, 2);

      const newX = (rect.width / 2) - (targetX * newScale);
      const newY = (rect.height / 2) - (targetY * newScale);

      setScale(newScale);
      setPosition({ x: newX, y: newY });
    }, 150);

    return () => clearTimeout(timer);
  }, [centerX, centerY, mapWidth, mapHeight]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const mapX = (mouseX - position.x) / scale;
    const mapY = (mouseY - position.y) / scale;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.01), 50);

    if (newScale !== scale) {
      const newX = mouseX - mapX * newScale;
      const newY = mouseY - mapY * newScale;
      setPosition({ x: newX, y: newY });
      setScale(newScale);
    }
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

  const pointsToPath = (points: Point[], closed = true) => {
    if (!points || points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    return closed ? path + " Z" : path;
  };

  const getElementStyles = (el: MapElement) => {
    const data = housesData[el.id];
    if (el.type === 'road') return { fill: '#475569', stroke: '#475569', opacity: 1, strokeWidth: 10 };
    if (el.type === 'green') return { fill: '#22c55e', stroke: '#15803d', opacity: 1, strokeWidth: 2 };
    if (el.type === 'tower') return { fill: el.color || '#1e293b', stroke: '#0f172a', opacity: 1, strokeWidth: 2 };
    
    if (el.type === 'house') {
      if (data?.status === 'sold') return { fill: '#f43f5e', stroke: '#e11d48', opacity: 1, strokeWidth: 2 };
      if (data?.status === 'reserved') return { fill: '#fbbf24', stroke: '#f59e0b', opacity: 1, strokeWidth: 2 };
      if (data?.status === 'pending') return { fill: '#3b82f6', stroke: '#2563eb', opacity: 1, strokeWidth: 2 };
      return { fill: el.color || '#10b981', stroke: '#059669', opacity: 1, strokeWidth: 2 };
    }
    
    return { fill: el.color || '#ffffff', stroke: '#cbd5e1', opacity: 1, strokeWidth: 2 };
  };

  const sortedElements = [...elements]
    .filter(el => el.type !== 'reference_image' || el.showInMain)
    .sort((a, b) => {
      const layerOrder: Record<string, number> = { 'reference_image': -2, 'green': -1, 'road': 1, 'house': 3, 'tower': 3, 'text': 4 };
      return (layerOrder[a.type] || 0) - (layerOrder[b.type] || 0);
    });

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full bg-slate-100 border-4 border-white shadow-2xl overflow-hidden group cursor-grab active:cursor-grabbing touch-none",
        isFullScreen ? "fixed inset-0 z-[40] rounded-none border-0" : "aspect-[4/3] rounded-[2.5rem]"
      )}
      onWheel={handleWheel}
      onMouseDown={(e) => { 
        setIsDragging(true); 
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); 
      }}
      onMouseMove={(e) => { 
        if (isDragging) {
          setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        }
      }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      <div 
        className="w-full h-full origin-top-left"
        style={{ 
          transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
          willChange: 'transform'
        }}
      >
        <svg 
          width={mapWidth}
          height={mapHeight}
          viewBox={`0 0 ${mapWidth} ${mapHeight}`} 
          className="select-none overflow-visible"
        >
          {sortedElements.map((el) => {
            const styles = getElementStyles(el);
            const pts = getElementPoints(el);
            const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
            const pathD = pointsToPath(pts, !el.isStroke);

            if (el.type === 'reference_image') {
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
                  opacity={el.opacity}
                  transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}
                />
              );
            }

            return (
              <g key={el.id} onClick={(e) => { e.stopPropagation(); onHouseClick(el.id); }} className="cursor-pointer" transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                <path d={pathD} fill={styles.fill} stroke={styles.stroke} fillOpacity={styles.opacity} strokeWidth={styles.strokeWidth} />
                {el.label && el.type !== 'text' && (
                  <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" fill="white" className="text-[10px] font-bold pointer-events-none">
                    {el.label.split('-').pop()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      
      <div className="absolute top-6 left-6 flex flex-col gap-2">
        <button onClick={() => setScale(s => Math.min(s * 1.2, 10))} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><ZoomIn size={20} /></button>
        <button onClick={() => setScale(s => Math.max(s / 1.2, 0.1))} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><ZoomOut size={20} /></button>
        <button onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><RotateCcw size={20} /></button>
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50">{isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
      </div>
    </div>
  );
};

export default InteractiveMap;