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
  permissions?: any;
  backgroundColor?: string; // خلفية انسيابية ممررة ديناميكياً
  showGrid?: boolean;       // شبكة مربعات قابلة للتحكم
}

const InteractiveMap = ({ 
  elements, 
  onHouseClick, 
  selectedHouseId, 
  housesData, 
  mapWidth, 
  mapHeight, 
  permissions,
  backgroundColor = '#f1f5f9',
  showGrid = true
}: InteractiveMapProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

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
      const newX = mouseX - mapX * newScale;
      const newY = mouseY - mapY * newScale;
      setPosition({ x: newX, y: newY });
      setScale(newScale);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDistance(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const touch = e.touches[0];
      setPosition({ x: touch.clientX - dragStart.x, y: touch.clientY - dragStart.y });
    } else if (e.touches.length === 2 && lastTouchDistance !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      
      const delta = dist / lastTouchDistance;
      const newScale = Math.min(Math.max(scale * delta, 0.05), 40);
      
      if (newScale !== scale && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        
        const mouseX = centerX - rect.left;
        const mouseY = centerY - rect.top;
        const mapX = (mouseX - position.x) / scale;
        const mapY = (mouseY - position.y) / scale;
        
        setPosition({ x: mouseX - mapX * newScale, y: mouseY - mapY * newScale });
        setScale(newScale);
      }
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

  const pointsToPath = (points: Point[], closed = true) => {
    if (!points || points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    return closed ? path + " Z" : path;
  };

  const getElementStyles = (el: MapElement) => {
    if (el.type === 'label_area') return { fill: el.color || '#a855f7', stroke: el.hasBorder ? (el.borderColor || '#a855f7') : (el.color || '#a855f7'), opacity: el.opacity || 0.2, strokeWidth: el.hasBorder ? 3 : 2 };
    
    const data = housesData[el.id];
    if (el.type === 'road') return { fill: '#475569', stroke: el.hasBorder ? (el.borderColor || '#475569') : '#475569', opacity: 1, strokeWidth: el.hasBorder ? 12 : 10 };
    if (el.type === 'green') return { fill: 'url(#green-pattern)', stroke: el.hasBorder ? (el.borderColor || '#22c55e') : '#22c55e', opacity: 1, strokeWidth: el.hasBorder ? 12 : 10 };
    if (el.type === 'pitch') return { fill: '#16a34a', stroke: el.hasBorder ? (el.borderColor || '#ffffff') : '#ffffff', opacity: 1, strokeWidth: 2 };
    if (el.type === 'tower') return { fill: el.color || '#1e293b', stroke: el.hasBorder ? (el.borderColor || '#0f172a') : '#0f172a', opacity: 1, strokeWidth: el.hasBorder ? 4 : 2 };
    if (el.type === 'amenity') return { fill: el.color || '#f59e0b', stroke: el.hasBorder ? (el.borderColor || '#d97706') : (el.color || '#f59e0b'), opacity: 1, strokeWidth: 2 };
    if (el.type === 'text') return { fill: 'none', stroke: 'none', opacity: 1, strokeWidth: 0 };
    
    if (el.type === 'house') {
      const baseStroke = el.hasBorder ? (el.borderColor || '#94a3b8') : '#94a3b8';
      const colorMode = permissions?.colorMode || 'default';

      if (colorMode === 'tabo') {
        const tabo = data?.taboStatus?.trim();
        if (tabo === 'مستلم') return { fill: '#10b981', stroke: '#059669', opacity: 1, strokeWidth: 2 }; 
        if (tabo === 'مروج') return { fill: '#fbbf24', stroke: '#f59e0b', opacity: 1, strokeWidth: 2 }; 
        return { fill: '#f43f5e', stroke: '#e11d48', opacity: 1, strokeWidth: 2 }; 
      }

      if (colorMode === 'handover') {
        if (data?.handoverDate) return { fill: '#10b981', stroke: '#059669', opacity: 1, strokeWidth: 2 }; 
        return { fill: '#f43f5e', stroke: '#e11d48', opacity: 1, strokeWidth: 2 }; 
      }

      if (data?.status?.startsWith('frozen')) return { fill: '#e2e8f0', stroke: baseStroke, opacity: 1, strokeWidth: 2 };
      if (data?.status === 'investment') return { fill: '#d8b4fe', stroke: el.hasBorder ? (el.borderColor || '#a855f7') : '#a855f7', opacity: 1, strokeWidth: 2 };
      if (!data || data.status === 'available') return { fill: el.color || '#10b981', stroke: el.hasBorder ? (el.borderColor || '#059669') : '#059669', opacity: 1, strokeWidth: 2 };
      if (data.status === 'sold') return { fill: '#f43f5e', stroke: el.hasBorder ? (el.borderColor || '#e11d48') : '#e11d48', opacity: 1, strokeWidth: 2 };
      if (data.status === 'reserved') return { fill: '#fbbf24', stroke: el.hasBorder ? (el.borderColor || '#f59e0b') : '#f59e0b', opacity: 1, strokeWidth: 2 };
      if (data.status === 'pending') return { fill: '#3b82f6', stroke: el.hasBorder ? (el.borderColor || '#2563eb') : '#2563eb', opacity: 1, strokeWidth: 2 };
    }
    
    return { fill: el.color || '#ffffff', stroke: el.hasBorder ? (el.borderColor || '#cbd5e1') : '#cbd5e1', opacity: 1, strokeWidth: 2 };
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

  const renderPitchLines = (pts: Point[]) => {
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;
    const width = maxX - minX;
    const height = maxY - minY;

    return (
      <g pointerEvents="none">
        <line x1={midX} y1={minY} x2={midX} y2={maxY} stroke="white" strokeWidth="2" />
        <circle cx={midX} cy={midY} r={Math.min(width, height) / 6} fill="none" stroke="white" strokeWidth="2" />
        <rect x={minX} y={midY - height/4} width={width/6} height={height/2} fill="none" stroke="white" strokeWidth="2" />
        <rect x={maxX - width/6} y={midY - height/4} width={width/6} height={height/2} fill="none" stroke="white" strokeWidth="2" />
      </g>
    );
  };

  const sortedElements = [...elements]
    .filter(el => el.type !== 'reference_image' || el.showInMain)
    .sort((a, b) => {
      const layerOrder: Record<string, number> = { 'reference_image': -2, 'green': -1, 'label_area': 0, 'road': 1, 'pitch': 2, 'amenity': 2, 'house': 3, 'tower': 3, 'text': 4 };
      return (layerOrder[a.type] || 0) - (layerOrder[b.type] || 0);
    });

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full border-4 border-white shadow-2xl overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-300 touch-none",
        isFullScreen ? "fixed inset-0 z-[40] rounded-none border-0" : "aspect-[4/3] rounded-[2.5rem]"
      )}
      /* تلوين الحاوية الخارجية بنفس لون الخلفية تماماً لمنع الحواف الرمادية عند التكبير والتحريك */
      style={{ backgroundColor: backgroundColor }}
      onWheel={handleWheel}
      onMouseDown={(e) => { 
        setIsDragging(true); 
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y }); 
      }}
      onMouseMove={(e) => { 
        if (isDragging) setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y }); 
      }}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <svg 
        className="w-full h-full select-none overflow-visible"
        shapeRendering="geometricPrecision"
        style={{ backgroundColor: backgroundColor }}
      >
        <g transform={`translate(${position.x}, ${position.y}) scale(${scale})`}>
          <defs>
            <pattern id="grid-view" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="0.5" opacity="0.4"/></pattern>
            <pattern id="green-pattern" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#22c55e" /><path d="M 2 8 L 5 2 L 8 8" fill="none" stroke="#15803d" strokeWidth="0.5" opacity="0.3" /></pattern>
            
            <pattern id="texture-glass" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M0 20 L20 0 M10 30 L30 10 M-10 10 L10 -10" stroke="currentColor" strokeWidth="1" opacity="0.2" />
            </pattern>
            <pattern id="texture-brick" width="30" height="15" patternUnits="userSpaceOnUse">
              <rect width="30" height="15" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
              <path d="M15 0 L15 15" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
            </pattern>
            <pattern id="texture-dots" width="10" height="10" patternUnits="userSpaceOnUse">
              <circle cx="5" cy="5" r="1" fill="currentColor" opacity="0.2" />
            </pattern>
            <pattern id="texture-stripes" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M0 0 L10 10" stroke="currentColor" strokeWidth="1" opacity="0.2" />
            </pattern>
            <pattern id="texture-grid" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
            </pattern>
            <pattern id="texture-zigzag" width="20" height="10" patternUnits="userSpaceOnUse">
              <path d="M 0 10 L 5 0 L 10 10 L 15 0 L 20 10" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.2" />
            </pattern>
            <pattern id="texture-crosshatch" width="10" height="10" patternUnits="userSpaceOnUse">
              <path d="M 0 0 L 10 10 M 10 0 L 0 10" fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
            </pattern>
          </defs>
          
          {showGrid && (
            <rect width={mapWidth} height={mapHeight} fill="url(#grid-view)" />
          )}
          
          {sortedElements.map((el) => {
            const styles = getElementStyles(el);
            const isSelected = selectedHouseId === el.id;
            const isInteractive = el.type === 'house' || el.type === 'tower' || !!el.linkProjectId;
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
              return (
                <image 
                  key={el.id}
                  href={el.color} 
                  x={minX} y={minY} 
                  width={elWidth} height={elHeight} 
                  opacity={el.opacity}
                  transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}
                />
              );
            }

            const IconComponent = el.type === 'house' ? Home : 
                            el.type === 'tower' ? Building2 : 
                            el.type === 'amenity' ? getAmenityIcon(el.amenityType) : null;

            const pathD = pointsToPath(pts, !el.isStroke);
            
            const dynamicIconSize = minDim * 0.6; 
            const dynamicFontSize = minDim * 0.3;

            return (
              <g key={el.id} onClick={(e) => { e.stopPropagation(); if (isInteractive) onHouseClick(el.id); }} className={cn(isInteractive ? "cursor-pointer" : "pointer-events-none")} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                <defs>
                  <clipPath id={`clip-${el.id}`}>
                    <path d={pathD} />
                  </clipPath>
                </defs>
                
                {el.type !== 'text' ? (
                  <>
                    <path d={pathD} fill={el.isStroke ? "none" : styles.fill} stroke={el.isStroke ? styles.fill : styles.stroke} fillOpacity={styles.opacity} strokeWidth={el.isStroke ? el.strokeWidth : styles.strokeWidth} strokeLinejoin="round" strokeLinecap="round" className={cn("transition-all duration-300", isSelected && "stroke-black stroke-[3px] filter brightness-90", !!el.linkProjectId && "hover:filter hover:brightness-110 active:scale-95 transition-transform duration-100")} />
                    {el.hasTexture && (
                      <g clipPath={`url(#clip-${el.id})`} style={{ color: el.textureColor || 'white' }}>
                        <rect 
                          x={minX - 500} y={minY - 500} 
                          width={(maxX - minX) + 1000} height={(maxY - minY) + 1000} 
                          fill={`url(#texture-${el.textureType || 'glass'})`} 
                          pointerEvents="none" 
                          transform={`scale(${el.textureSize || 1})`}
                          transform-origin={`${centerX} ${centerY}`}
                        />
                      </g>
                    )}
                  </>
                ) : (
                  <text
                    x={centerX}
                    y={centerY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={el.textColor || '#000000'}
                    style={{
                      fontSize: `${el.fontSize || 24}px`,
                      fontFamily: el.fontFamily || 'Arial',
                      fontWeight: el.isBold ? 'bold' : 'normal'
                    }}
                  >
                    {el.label}
                  </text>
                )}
                
                {el.type === 'pitch' && renderPitchLines(pts)}
                
                {IconComponent && !el.hideIcon && (
                  <foreignObject 
                    x={centerX - (dynamicIconSize / 2)} 
                    y={centerY - (dynamicIconSize * 0.85)} 
                    width={dynamicIconSize} 
                    height={dynamicIconSize} 
                    pointerEvents="none"
                  >
                    <div className="flex items-center justify-center w-full h-full">
                      <IconComponent 
                        size={dynamicIconSize * 0.9} 
                        color={el.textColor || (el.type === 'tower' || (el.type === 'house' && housesData[el.id]) ? '#ffffff' : '#1e293b')} 
                        strokeWidth={2.5}
                      />
                    </div>
                  </foreignObject>
                )}
                
                {el.type === 'road' && !el.isStroke && (
                  el.orientation === 'vertical' ? 
                  <line x1={centerX} y1={minY} x2={centerX} y2={maxY} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" /> :
                  <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke="white" strokeWidth="2" strokeDasharray="10,10" opacity="0.5" />
                )}

                {el.label && el.type !== 'text' && (
                  <text 
                    x={centerX} 
                    y={IconComponent && !el.hideIcon ? centerY + (dynamicIconSize * 0.45) : centerY} 
                    textAnchor="middle" 
                    dominantBaseline="middle" 
                    fill={el.textColor || (el.type === 'tower' || (el.type === 'house' && housesData[el.id]) ? '#ffffff' : '#1e293b')} 
                    style={{ 
                      fontSize: `${dynamicFontSize}px`, 
                      fontWeight: 'black' 
                    }} 
                    className="pointer-events-none select-none"
                  >
                    {el.label.split('-').pop()}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>
      
      <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
        <button onClick={() => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const mapX = (cx - position.x) / scale;
          const mapY = (cy - position.y) / scale;
          const newScale = Math.min(scale * 1.5, 40);
          setPosition({ x: cx - mapX * newScale, y: cy - mapY * newScale });
          setScale(newScale);
        }} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><ZoomIn size={20} /></button>
        
        <button onClick={() => {
          if (!containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const cx = rect.width / 2;
          const cy = rect.height / 2;
          const mapX = (cx - position.x) / scale;
          const mapY = (cy - position.y) / scale;
          const newScale = Math.max(scale / 1.5, 0.05);
          setPosition({ x: cx - mapX * newScale, y: cy - mapY * newScale });
          setScale(newScale);
        }} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><ZoomOut size={20} /></button>
        
        <button onClick={autoFit} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><RotateCcw size={20} /></button>
        <button onClick={() => setIsFullScreen(!isFullScreen)} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50">{isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
      </div>
    </div>
  );
};

export default InteractiveMap;