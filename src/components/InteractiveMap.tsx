"use client";

import React, { useState, useRef } from 'react';
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
}

const InteractiveMap = ({ elements, onHouseClick, selectedHouseId, housesData, mapWidth, mapHeight }: InteractiveMapProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.min(Math.max(prev * (e.deltaY > 0 ? 0.9 : 1.1), 0.5), 5));
  };

  const getElementPoints = (el: MapElement): Point[] => {
    if (el.points && el.points.length > 0) return el.points;
    return [{ x: el.x, y: el.y }, { x: el.x + el.width, y: el.y }, { x: el.x + el.width, y: el.y + el.height }, { x: el.x, y: el.y + el.height }];
  };

  const pointsToPath = (points: Point[], closed = true) => {
    if (!points || points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    return closed ? path + " Z" : path;
  };

  const renderPitch = (pts: Point[]) => {
    const minX = Math.min(...pts.map(p => p.x)), maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y)), maxY = Math.max(...pts.map(p => p.y));
    const midX = (minX + maxX) / 2, midY = (minY + maxY) / 2;
    return (
      <g>
        <rect x={minX} y={minY} width={maxX - minX} height={maxY - minY} fill="#16a34a" stroke="white" strokeWidth="2" />
        <line x1={midX} y1={minY} x2={midX} y2={maxY} stroke="white" strokeWidth="2" />
        <circle cx={midX} cy={midY} r={(maxY - minY) / 6} fill="none" stroke="white" strokeWidth="2" />
        <rect x={minX} y={midY - (maxY - minY) / 4} width={(maxX - minX) / 6} height={(maxY - minY) / 2} fill="none" stroke="white" strokeWidth="2" />
        <rect x={maxX - (maxX - minX) / 6} y={midY - (maxY - minY) / 4} width={(maxX - minX) / 6} height={(maxY - minY) / 2} fill="none" stroke="white" strokeWidth="2" />
      </g>
    );
  };

  const getElementStyles = (el: MapElement) => {
    const data = housesData[el.id];
    if (el.type === 'house') {
      if (data?.status?.startsWith('frozen')) return { fill: '#e2e8f0', stroke: '#94a3b8' };
      if (!data || data.status === 'available') return { fill: '#10b981', stroke: '#059669' };
      if (data.status === 'sold') return { fill: '#f43f5e', stroke: '#e11d48' };
      if (data.status === 'reserved') return { fill: '#fbbf24', stroke: '#f59e0b' };
      if (data.status === 'pending') return { fill: '#3b82f6', stroke: '#2563eb' };
    }
    return { fill: el.color || '#ffffff', stroke: '#cbd5e1' };
  };

  return (
    <div className={cn("relative w-full bg-slate-100 border-4 border-white shadow-2xl overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-300 touch-none", isFullScreen ? "fixed inset-0 z-[40] rounded-none border-0" : "aspect-[4/3] rounded-[2.5rem]")}>
      <div className="w-full h-full" onWheel={handleWheel} onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); }} onMouseMove={(e) => { if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }} onMouseUp={() => setIsDragging(false)} onMouseLeave={() => setIsDragging(false)}>
        <svg ref={svgRef} viewBox={`0 0 ${mapWidth} ${mapHeight}`} className="w-full h-full select-none" style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${scale})` }}>
          <defs>
            <pattern id="grid-view" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="0.5"/></pattern>
            <pattern id="green-pattern" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#22c55e" /><path d="M 2 8 L 5 2 L 8 8" fill="none" stroke="#15803d" strokeWidth="0.5" opacity="0.3" /></pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid-view)" />
          
          {elements.map((el) => {
            const pts = getElementPoints(el);
            const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
            const isInteractive = el.type === 'house' || el.type === 'tower';
            const styles = getElementStyles(el);

            return (
              <g key={el.id} onClick={(e) => { e.stopPropagation(); if (isInteractive) onHouseClick(el.id); }} className={cn(isInteractive ? "cursor-pointer" : "pointer-events-none")} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                {el.type === 'pitch' ? renderPitch(pts) : el.type === 'circle' ? (
                  <ellipse cx={centerX} cy={centerY} rx={Math.abs(pts[1].x - pts[0].x)/2} ry={Math.abs(pts[2].y - pts[1].y)/2} fill={el.color || '#6366f1'} stroke="#4338ca" strokeWidth="2" />
                ) : (
                  <path d={pointsToPath(pts, !el.isStroke)} fill={el.isStroke ? "none" : (el.type === 'road' ? '#475569' : (el.type === 'green' ? 'url(#green-pattern)' : (el.type === 'text' ? 'none' : styles.fill)))} stroke={el.isStroke ? (el.color || '#475569') : (selectedHouseId === el.id ? '#000' : (el.type === 'road' ? '#475569' : (el.type === 'green' ? '#22c55e' : (el.type === 'text' ? 'none' : styles.stroke))))} strokeWidth={el.isStroke ? el.strokeWidth : (el.type === 'road' ? 10 : 2)} strokeLinejoin="round" strokeLinecap="round" />
                )}

                {el.type === 'road' && !el.isStroke && (
                  el.orientation === 'vertical' ? 
                  <line x1={centerX} y1={Math.min(...pts.map(p=>p.y))} x2={centerX} y2={Math.max(...pts.map(p=>p.y))} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" /> :
                  <line x1={Math.min(...pts.map(p=>p.x))} y1={centerY} x2={Math.max(...pts.map(p=>p.x))} y2={centerY} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" />
                )}

                {el.type === 'text' ? (
                  <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" fill={el.textColor} fontSize={el.fontSize} fontWeight="black">{el.label}</text>
                ) : el.label && (
                  <text x={centerX} y={centerY + 15} textAnchor="middle" dominantBaseline="middle" fill={el.textColor || (el.type === 'tower' || (el.type === 'house' && housesData[el.id]) ? '#ffffff' : '#1e293b')} fontSize={10} fontWeight="black">{el.label.split('-').pop()}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      
      <div className="absolute top-6 left-6 flex flex-col gap-2">
        <button onClick={() => setScale(s => Math.min(s + 0.2, 5))} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><ZoomIn size={20} /></button>
        <button onClick={() => setScale(s => Math.max(s - 0.2, 0.5))} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><ZoomOut size={20} /></button>
        <button onClick={() => { setScale(1); setPosition({ x: 0, y: 0 }); }} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><RotateCcw size={20} /></button>
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50">{isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
      </div>
    </div>
  );
};

export default InteractiveMap;