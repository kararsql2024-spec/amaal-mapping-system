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

  // التمركز بناءً على نقطة المنتصف المحفوظة يدوياً
  useEffect(() => {
    if (!containerRef.current) return;

    const timer = setTimeout(() => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // استخدام الإحداثيات المحفوظة أو التمركز التلقائي كخيار احتياطي
      const targetX = centerX !== undefined ? centerX : mapWidth / 2;
      const targetY = centerY !== undefined ? centerY : mapHeight / 2;
      
      // حساب المقياس ليناسب المخطط كاملاً داخل الحاوية بنسبة 90%
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

  // ... rest of component ...
  return (
    // ... SVG and UI ...
  );
};

export default InteractiveMap;