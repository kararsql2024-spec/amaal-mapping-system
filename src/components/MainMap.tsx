"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Project, MapElement, Point } from '@/types/project';
import { cn } from "@/lib/utils";
import { 
  ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize,
  MapPin, Home, Building2, Store, GraduationCap, Stethoscope, 
  Baby, ShoppingBag, Dumbbell, ShoppingCart, MoonStar, Trophy
} from "lucide-react";

interface MainMapProps {
  projects: Project[];
  onProjectSelect: (projectId: string) => void;
  mainMapConfig?: {
    elements: MapElement[];
    width: number;
    height: number;
  };
}

const MainMap = ({ projects, onProjectSelect, mainMapConfig }: MainMapProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const mapWidth = mainMapConfig?.width || 1200;
  const mapHeight = mainMapConfig?.height || 800;

  const autoFit = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 40;
    const availableW = rect.width - padding;
    const availableH = rect.height - padding;

    const scaleW = availableW / mapWidth;
    const scaleH = availableH / mapHeight;
    const newScale = Math.min(scaleW, scaleH, 1.5);

    const newX = (rect.width - mapWidth * newScale) / 2;
    const newY = (rect.height - mapHeight * newScale) / 2;

    setScale(newScale);
    setPosition({ x: newX, y: newY });
  };

  useEffect(() => {
    const timer = setTimeout(autoFit, 100);
    return () => clearTimeout(timer);
  }, [mapWidth, mapHeight, isFullScreen]);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mapX = (mouseX - position.x) / scale;
    const mapY = (mouseY - position.y) / scale;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.min(Math.max(scale * delta, 0.05), 40);
    if (newScale !== scale) {
      setPosition({ x: mouseX - mapX * newScale, y: mouseY - mapY * newScale });
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

  const sortedElements = [...(mainMapConfig?.elements || [])].sort((a, b) => {
    const layerOrder: Record<string, number> = { 'reference_image': -2, 'green': -1, 'label_area': 0, 'road': 1, 'pitch': 2, 'amenity': 2, 'house': 3, 'tower': 3, 'text': 4 };
    return (layerOrder[a.type] || 0) - (layerOrder[b.type] || 0);
  });

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full bg-slate-900 border-8 border-white shadow-2xl overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-300 touch-none",
        isFullScreen ? "fixed inset-0 z-[40] rounded-none border-0" : "h-[700px] rounded-[2.5rem]"
      )}
      onWheel={handleWheel}
      onMouseDown={(e) => { setIsDragging(true); setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); }}
      onMouseMove={(e) => { if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
    >
      <svg className="w-full h-full select-none overflow-visible">
        <g transform={`translate(${position.x}, ${position.y}) scale(${scale})`}>
          <defs>
            <pattern id="main-grid" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.1"/></pattern>
            <pattern id="main-green" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#22c55e" /><path d="M 2 8 L 5 2 L 8 8" fill="none" stroke="#15803d" strokeWidth="0.5" opacity="0.3" /></pattern>
            
            <pattern id="main-texture-glass" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M0 20 L20 0 M10 30 L30 10 M-10 10 L10 -10" stroke="currentColor" strokeWidth="1" opacity="0.2" /></pattern>
            <pattern id="main-texture-brick" width="30" height="15" patternUnits="userSpaceOnUse"><rect width="30" height="15" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" /><path d="M15 0 L15 15" stroke="currentColor" strokeWidth="0.5" opacity="0.2" /></pattern>
          </defs>
          <rect width={mapWidth} height={mapHeight} fill="url(#main-grid)" />
          
          {sortedElements.map((el) => {
            const pts = getElementPoints(el);
            const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
            const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
            const minY = Math.min(...pts.map(p => p.y));
            const minX = Math.min(...pts.map(p => p.x));
            const maxX = Math.max(...pts.map(p => p.x));
            const maxY = Math.max(...pts.map(p => p.y));
            const elWidth = maxX - minX;
            const elHeight = maxY - minY;
            const minDim = Math.min(elWidth, elHeight);

            if (el.type === 'reference_image') {
              return <image key={el.id} href={el.color} x={minX} y={minY} width={elWidth} height={elHeight} opacity={el.opacity} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`} />;
            }

            const isProjectLink = !!el.projectId;
            const IconComponent = el.type === 'house' ? Home : el.type === 'tower' ? Building2 : el.type === 'amenity' ? getAmenityIcon(el.amenityType) : (isProjectLink ? MapPin : null);
            const pathD = pointsToPath(pts, !el.isStroke);
            const dynamicIconSize = minDim * 0.6;
            const dynamicFontSize = minDim * 0.3;

            return (
              <g key={el.id} onClick={(e) => { e.stopPropagation(); if (isProjectLink) onProjectSelect(el.projectId!); }} className={cn(isProjectLink ? "cursor-pointer group/item" : "pointer-events-none")} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                <defs><clipPath id={`main-clip-${el.id}`}><path d={pathD} /></clipPath></defs>
                {el.type !== 'text' ? (
                  <>
                    <path d={pathD} fill={el.isStroke ? "none" : (el.color || '#3b82f6')} stroke={el.hasBorder ? (el.borderColor || '#1e40af') : (el.color || '#3b82f6')} fillOpacity={el.opacity || 1} strokeWidth={el.isStroke ? el.strokeWidth : (el.hasBorder ? 4 : 2)} className={cn("transition-all duration-300", isProjectLink && "group-hover/item:brightness-125 group-hover/item:filter group-hover/item:drop-shadow-xl")} />
                    {el.hasTexture && (
                      <g clipPath={`url(#main-clip-${el.id})`} style={{ color: el.textureColor || 'white' }}>
                        <rect x={minX - 500} y={minY - 500} width={elWidth + 1000} height={elHeight + 1000} fill={`url(#main-texture-${el.textureType || 'glass'})`} transform={`scale(${el.textureSize || 1})`} transform-origin={`${centerX} ${centerY}`} />
                      </g>
                    )}
                  </>
                ) : (
                  <text x={centerX} y={centerY} textAnchor="middle" dominantBaseline="middle" fill={el.textColor || '#ffffff'} style={{ fontSize: `${el.fontSize || 24}px`, fontFamily: el.fontFamily || 'Arial', fontWeight: el.isBold ? 'bold' : 'normal' }}>{el.label}</text>
                )}
                {IconComponent && !el.hideIcon && (
                  <foreignObject x={centerX - (dynamicIconSize / 2)} y={centerY - (dynamicIconSize * 0.85)} width={dynamicIconSize} height={dynamicIconSize} pointerEvents="none">
                    <div className="flex items-center justify-center w-full h-full">
                      <IconComponent size={dynamicIconSize * 0.9} color={el.textColor || '#ffffff'} strokeWidth={2.5} className={cn(isProjectLink && "group-hover/item:scale-125 transition-transform")} />
                    </div>
                  </foreignObject>
                )}
                {el.label && el.type !== 'text' && (
                  <text x={centerX} y={IconComponent && !el.hideIcon ? centerY + (dynamicIconSize * 0.45) : centerY} textAnchor="middle" dominantBaseline="middle" fill={el.textColor || '#ffffff'} style={{ fontSize: `${dynamicFontSize}px`, fontWeight: 'black' }} className="pointer-events-none select-none drop-shadow-md">{el.label}</text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      
      <div className="absolute top-8 left-8 bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
        <p className="text-white font-black flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />المخطط التفاعلي العام</p>
      </div>

      <div className="absolute bottom-8 right-8 flex flex-col gap-2">
        <button onClick={() => setScale(s => Math.min(s * 1.5, 40))} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-slate-50"><ZoomIn size={20} /></button>
        <button onClick={() => setScale(s => Math.max(s / 1.5, 0.05))} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-slate-50"><ZoomOut size={20} /></button>
        <button onClick={autoFit} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-slate-50"><RotateCcw size={20} /></button>
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center hover:bg-slate-50">{isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
      </div>
    </div>
  );
};

export default MainMap;