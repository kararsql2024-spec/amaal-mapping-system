"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { cn } from "@/lib/utils";
import { MapElement, Point } from '@/types/project';
import { 
  ZoomIn, ZoomOut, RotateCcw, Maximize, Minimize,
  Home, Building2, SlidersHorizontal, X
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InteractiveMapProps {
  elements: MapElement[];
  onHouseClick: (houseId: string) => void;
  selectedHouseId?: string | null;
  housesData: Record<string, any>;
  mapWidth: number;
  mapHeight: number;
  permissions?: any;
  backgroundColor?: string;
  showGrid?: boolean;
  filterZone?: string;
  filterClass?: string;
  filterSize?: string;
  filterStatus?: string;
  onFilterZoneChange?: (val: string) => void;
  onFilterClassChange?: (val: string) => void;
  onFilterSizeChange?: (val: string) => void;
  onFilterStatusChange?: (val: string) => void;
  houseTypeAreas?: Record<string, number>;
  showTooltips?: boolean;
}

// كاش الأيقونات والصور المرجعية والـ Patterns للـ Canvas
const iconImageCache = new Map<string, HTMLImageElement>();
const referenceImageCache = new Map<string, HTMLImageElement>();
const texturePatternCache = new Map<string, CanvasPattern>();

const getCachedReferenceImage = (url: string, onLoaded?: () => void): HTMLImageElement | null => {
  if (!url) return null;
  if (referenceImageCache.has(url)) {
    return referenceImageCache.get(url)!;
  }
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  img.onload = () => {
    if (onLoaded) onLoaded();
  };
  referenceImageCache.set(url, img);
  return img;
};

const getIconSvgUri = (type: string, color: string) => {
  let svgContent = '';
  if (type === 'house') {
    svgContent = `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>`;
  } else if (type === 'tower') {
    svgContent = `<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="9" y1="6" x2="9" y2="6.01"/><line x1="15" y1="6" x2="15" y2="6.01"/><line x1="9" y1="10" x2="9" y2="10.01"/><line x1="15" y1="10" x2="15" y2="10.01"/><line x1="9" y1="14" x2="9" y2="14.01"/><line x1="15" y1="14" x2="15" y2="14.01"/><line x1="9" y1="18" x2="9" y2="18.01"/><line x1="15" y1="18" x2="15" y2="18.01"/>`;
  } else if (type === 'shop') {
    svgContent = `<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M18 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M14 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M10 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/><path d="M6 7v3a2 2 0 0 1-2 2v0a2 2 0 0 1-2-2V7"/>`;
  } else if (type === 'school') {
    svgContent = `<path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>`;
  } else if (type === 'medical') {
    svgContent = `<path d="M4.8 2.3A.3.3 0 0 0 5 2h14a.3.3 0 0 0 .2.3V5h-15V2.3z"/><path d="M3 5v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5"/><path d="M12 9v6M9 12h6"/>`;
  } else if (type === 'mosque') {
    svgContent = `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>`;
  } else {
    svgContent = `<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>`;
  }

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${svgContent}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
};

const getCachedIconImage = (type: string, color: string): HTMLImageElement => {
  const key = `${type}_${color}`;
  if (iconImageCache.has(key)) {
    return iconImageCache.get(key)!;
  }
  const img = new Image();
  img.src = getIconSvgUri(type, color);
  iconImageCache.set(key, img);
  return img;
};

// إنشاء نسيج (Texture Pattern) للـ Canvas مخصص للشكل
const getCanvasTexturePattern = (
  ctx: CanvasRenderingContext2D,
  type: string = 'glass', 
  color: string = '#ffffff'
): CanvasPattern | null => {
  const cacheKey = `${type}_${color}`;
  if (texturePatternCache.has(cacheKey)) {
    return texturePatternCache.get(cacheKey)!;
  }

  const patternCanvas = document.createElement('canvas');
  patternCanvas.width = 16;
  patternCanvas.height = 16;
  const pCtx = patternCanvas.getContext('2d');
  if (!pCtx) return null;

  pCtx.strokeStyle = color;
  pCtx.fillStyle = color;
  pCtx.globalAlpha = 0.3;
  pCtx.lineWidth = 1;

  if (type === 'dots') {
    pCtx.beginPath();
    pCtx.arc(8, 8, 1.5, 0, Math.PI * 2);
    pCtx.fill();
  } else if (type === 'stripes') {
    pCtx.beginPath();
    pCtx.moveTo(0, 0); pCtx.lineTo(16, 16);
    pCtx.stroke();
  } else if (type === 'brick') {
    pCtx.strokeRect(0, 0, 16, 8);
    pCtx.strokeRect(8, 8, 16, 8);
  } else if (type === 'grid') {
    pCtx.strokeRect(0, 0, 16, 16);
  } else if (type === 'zigzag') {
    pCtx.beginPath();
    pCtx.moveTo(0, 8); pCtx.lineTo(4, 0); pCtx.lineTo(8, 8); pCtx.lineTo(12, 0); pCtx.lineTo(16, 8);
    pCtx.stroke();
  } else if (type === 'crosshatch') {
    pCtx.beginPath();
    pCtx.moveTo(0, 0); pCtx.lineTo(16, 16);
    pCtx.moveTo(16, 0); pCtx.lineTo(0, 16);
    pCtx.stroke();
  } else {
    // glass (default)
    pCtx.beginPath();
    pCtx.moveTo(0, 16); pCtx.lineTo(16, 0);
    pCtx.stroke();
  }

  const pattern = ctx.createPattern(patternCanvas, 'repeat');
  if (pattern) {
    texturePatternCache.set(cacheKey, pattern);
  }
  return pattern;
};

// دالة رسم النص الذكي داخل حدود الأشكال المبنية (منازل/عمارات/مرافق)
const drawBoundedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  startY: number,
  maxWidth: number,
  maxHeight: number,
  fontFamily: string = 'Arial',
  isBold: boolean = true,
  textColor: string = '#000000',
  baseFontSize: number = 12
) => {
  if (!text) return;

  const words = text.split(/([ -])/).filter(Boolean);
  let fontSize = Math.min(baseFontSize, Math.max(7, maxHeight * 0.35));
  
  ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;

  let lines: string[] = [];
  let currentLine = '';

  for (let i = 0; i < words.length; i++) {
    const testLine = currentLine + words[i];
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && i > 0 && currentLine.trim().length > 0) {
      lines.push(currentLine.trim());
      currentLine = (words[i] === ' ' || words[i] === '-') ? '' : words[i];
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine.trim()) {
    lines.push(currentLine.trim());
  }

  while (fontSize > 6) {
    ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
    const overflows = lines.some(l => ctx.measureText(l).width > maxWidth);
    if (!overflows && lines.length * fontSize * 1.15 <= maxHeight) {
      break;
    }
    fontSize -= 0.5;
  }

  ctx.font = `${isBold ? 'bold' : 'normal'} ${fontSize}px ${fontFamily}`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lineHeight = fontSize * 1.15;
  const totalHeight = lines.length * lineHeight;
  const topY = startY - (totalHeight / 2) + (lineHeight / 2);

  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, topY + (index * lineHeight));
  });
};

const InteractiveMap = ({ 
  elements, 
  onHouseClick, 
  selectedHouseId, 
  housesData, 
  mapWidth, 
  mapHeight, 
  permissions,
  backgroundColor = '#f1f5f9',
  showGrid = true,
  filterZone,
  filterClass,
  filterSize,
  filterStatus,
  onFilterZoneChange,
  onFilterClassChange,
  onFilterSizeChange,
  onFilterStatusChange,
  houseTypeAreas = {},
  showTooltips = true
}: InteractiveMapProps) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState<number | null>(null);
  const [, setImagesLoadedCount] = useState(0);

  // حالة شريط التصفية المنسدل الجانبي
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);

  // حالات الفلترة الداخلية في حال عدم تمريرها من الخارج
  const [internalFilterZone, setInternalFilterZone] = useState('all');
  const [internalFilterClass, setInternalFilterClass] = useState('all');
  const [internalFilterSize, setInternalFilterSize] = useState('all');
  const [internalFilterStatus, setInternalFilterStatus] = useState('all');

  const currentFilterZone = filterZone !== undefined ? filterZone : internalFilterZone;
  const currentFilterClass = filterClass !== undefined ? filterClass : internalFilterClass;
  const currentFilterSize = filterSize !== undefined ? filterSize : internalFilterSize;
  const currentFilterStatus = filterStatus !== undefined ? filterStatus : internalFilterStatus;

  const handleZoneChange = (val: string) => {
    setInternalFilterZone(val);
    onFilterZoneChange?.(val);
  };
  const handleClassChange = (val: string) => {
    setInternalFilterClass(val);
    onFilterClassChange?.(val);
  };
  const handleSizeChange = (val: string) => {
    setInternalFilterSize(val);
    onFilterSizeChange?.(val);
  };
  const handleStatusChange = (val: string) => {
    setInternalFilterStatus(val);
    onFilterStatusChange?.(val);
  };

  const resetFilters = () => {
    handleZoneChange('all');
    handleClassChange('all');
    handleSizeChange('all');
    handleStatusChange('all');
  };

  const [hoveredElement, setHoveredElement] = useState<MapElement | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const dragStartCoords = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const autoFit = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const padding = 40;
    const availableW = rect.width - padding;
    const availableH = rect.height - padding;

    const scaleW = availableW / mapWidth;
    const scaleH = availableH / rect.height;
    const newScale = Math.min(scaleW, scaleH, 1.5);

    const newX = (rect.width - mapWidth * newScale) / 2;
    const newY = (rect.height - mapHeight * newScale) / 2;

    setScale(newScale);
    setPosition({ x: newX, y: newY });
  }, [mapWidth, mapHeight]);

  useEffect(() => {
    const timer = setTimeout(autoFit, 100);
    return () => clearTimeout(timer);
  }, [autoFit, isFullScreen]);

  // استخراج القوائم للفلترة
  const { mapZones, mapClasses, mapSizes } = useMemo(() => {
    const zones = new Set<string>();
    const classes = new Set<string>();
    const sizes = new Set<number>();

    elements.forEach(el => {
      if (el.type === 'house') {
        const parts = el.label.split('-');
        if (parts[0]) zones.add(parts[0]);
        if (parts.length >= 3) {
          const typeMatch = parts[2].match(/[a-zA-Z]+/);
          if (typeMatch) classes.add(typeMatch[0]);
        }
      } else if (el.type === 'tower') {
        const floors = el.floors || 1;
        const aptsPerFloor = el.apartmentsPerFloor || 1;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            const key = `${el.id}_F${f}_A${a}`;
            const data = housesData[key];
            if (data?.status === 'frozen_hidden') continue;

            const size = f === 1 
              ? (el.groundFloorSizes?.[a - 1] || 0) 
              : (el.typicalFloorSizes?.[a - 1] || 0);
            if (size > 0) {
              sizes.add(size);
            }
          }
        }
      }
    });

    return {
      mapZones: Array.from(zones).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      mapClasses: Array.from(classes).sort(),
      mapSizes: Array.from(sizes).sort((a, b) => a - b)
    };
  }, [elements, housesData]);

  const getElementPoints = (el: MapElement): Point[] => {
    if (el.points && el.points.length > 0) return el.points;
    return [
      { x: el.x, y: el.y },
      { x: el.x + el.width, y: el.y },
      { x: el.x + el.width, y: el.y + el.height },
      { x: el.x, y: el.y + el.height },
    ];
  };

  const getHouseArea = (el: MapElement) => {
    if (el.customArea !== undefined && el.customArea > 0) {
      return el.customArea;
    }
    const parts = el.label.split('-');
    const lastPart = parts[parts.length - 1] || '';
    const match = lastPart.match(/^([a-zA-Z]+)/);
    const type = match ? match[1].toUpperCase() : lastPart.toUpperCase();
    return houseTypeAreas[type] || 0;
  };

  const isAnyFilterActive = 
    (currentFilterZone && currentFilterZone !== 'all') || 
    (currentFilterClass && currentFilterClass !== 'all') || 
    (currentFilterSize && currentFilterSize !== 'all') || 
    (currentFilterStatus && currentFilterStatus !== 'all');

  const matchesFilter = useCallback((el: MapElement): boolean => {
    if (el.type !== 'house' && el.type !== 'tower') return false;

    if (currentFilterZone && currentFilterZone !== 'all') {
      if (el.type === 'house') {
        const parts = el.label.split('-');
        const zone = parts[0] || '';
        if (zone !== currentFilterZone) return false;
      } else {
        return false;
      }
    }

    if (currentFilterClass && currentFilterClass !== 'all') {
      if (el.type === 'house') {
        const parts = el.label.split('-');
        let uClass = '';
        if (parts.length >= 3) {
          const typeMatch = parts[2].match(/[a-zA-Z]+/);
          uClass = typeMatch ? typeMatch[0] : '';
        }
        if (uClass !== currentFilterClass) return false;
      } else {
        return false;
      }
    }

    if (currentFilterSize && currentFilterSize !== 'all') {
      const targetSize = parseFloat(currentFilterSize);
      if (el.type === 'house') {
        if (getHouseArea(el) !== targetSize) return false;
      } else if (el.type === 'tower') {
        const hasGroundMatch = el.groundFloorSizes?.some(s => s === targetSize);
        const hasTypicalMatch = el.typicalFloorSizes?.some(s => s === targetSize);
        if (!hasGroundMatch && !hasTypicalMatch) return false;
      } else {
        return false;
      }
    }

    if (currentFilterStatus && currentFilterStatus !== 'all') {
      if (el.type === 'house') {
        const data = housesData[el.id] || { status: 'available' };
        if (data.status !== currentFilterStatus) return false;
      } else if (el.type === 'tower') {
        const floors = el.floors || 0;
        const aptsPerFloor = el.apartmentsPerFloor || 0;
        let hasStatusMatch = false;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            const key = `${el.id}_F${f}_A${a}`;
            const data = housesData[key] || { status: 'available' };
            if (data.status === currentFilterStatus) {
              hasStatusMatch = true;
              break;
            }
          }
          if (hasStatusMatch) break;
        }
        if (!hasStatusMatch) return false;
      } else {
        return false;
      }
    }

    return true;
  }, [currentFilterZone, currentFilterClass, currentFilterSize, currentFilterStatus, housesData, houseTypeAreas]);

  const getElementStyles = useCallback((el: MapElement) => {
    if (el.type === 'label_area') return { fill: el.color || '#a855f7', stroke: el.hasBorder ? (el.borderColor || '#a855f7') : (el.color || '#a855f7'), opacity: el.opacity || 0.2, strokeWidth: el.hasBorder ? 3 : 2 };
    
    const data = housesData[el.id];
    if (el.type === 'road') return { fill: '#475569', stroke: el.hasBorder ? (el.borderColor || '#475569') : '#475569', opacity: 1, strokeWidth: el.hasBorder ? 12 : 10 };
    if (el.type === 'green') return { fill: '#22c55e', stroke: el.hasBorder ? (el.borderColor || '#22c55e') : '#22c55e', opacity: 1, strokeWidth: el.hasBorder ? 12 : 10 };
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
  }, [housesData, permissions]);

  // ترتيب العناصر
  const sortedElements = useMemo(() => {
    return [...elements]
      .filter(el => el.type !== 'reference_image' || el.showInMain)
      .sort((a, b) => {
        const layerOrder: Record<string, number> = { 'reference_image': -2, 'green': -1, 'label_area': 0, 'road': 1, 'pitch': 2, 'amenity': 2, 'house': 3, 'tower': 3, 'text': 4 };
        return (layerOrder[a.type] || 0) - (layerOrder[b.type] || 0);
      });
  }, [elements]);

  // دورة الرسم الفائقة على HTML5 Canvas بـ 60 FPS
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = containerRef.current.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    ctx.save();
    ctx.scale(dpr, dpr);

    // خلفية المخطط
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.save();
    ctx.translate(position.x, position.y);
    ctx.scale(scale, scale);

    // رسم الشبكة إذا كانت مفعلة
    if (showGrid) {
      ctx.beginPath();
      ctx.strokeStyle = '#cbd5e1';
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = 0.5;
      const gridSize = 50;
      for (let x = 0; x <= mapWidth; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, mapHeight);
      }
      for (let y = 0; y <= mapHeight; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(mapWidth, y);
      }
      ctx.stroke();
      ctx.globalAlpha = 1.0;
    }

    // رسم كل العناصر السكنية والرسومية
    sortedElements.forEach((el) => {
      const styles = getElementStyles(el);
      const isSelected = selectedHouseId === el.id;
      const pts = getElementPoints(el);
      const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
      const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
      
      const minX = Math.min(...pts.map(p => p.x));
      const maxX = Math.max(...pts.map(p => p.x));
      const minY = Math.min(...pts.map(p => p.y));
      const maxY = Math.max(...pts.map(p => p.y));
      const elWidth = maxX - minX;
      const elHeight = maxY - minY;
      const minDim = Math.min(elWidth, elHeight);

      let isFilteredIn = false;
      let isDimmed = false;

      if (isAnyFilterActive) {
        if (el.type === 'house' || el.type === 'tower') {
          if (matchesFilter(el)) {
            isFilteredIn = true;
          } else {
            isDimmed = true;
          }
        }
      }

      ctx.save();
      ctx.translate(centerX, centerY);
      if (el.rotation) {
        ctx.rotate((el.rotation * Math.PI) / 180);
      }
      ctx.translate(-centerX, -centerY);

      ctx.globalAlpha = el.opacity ?? styles.opacity ?? 1.0;

      // معالجة ورسم الصورة المرجعية بمطابقة تامة ونسب قياسية لحسابات SVG preserveAspectRatio
      if (el.type === 'reference_image') {
        if (el.color) {
          const refImg = getCachedReferenceImage(el.color, () => {
            setImagesLoadedCount(c => c + 1);
          });
          if (refImg && refImg.complete && refImg.naturalWidth > 0 && refImg.naturalHeight > 0) {
            const imgAspect = refImg.naturalWidth / refImg.naturalHeight;
            const boxAspect = elWidth / elHeight;
            let drawW = elWidth;
            let drawH = elHeight;
            let drawX = minX;
            let drawY = minY;

            if (imgAspect > boxAspect) {
              drawW = elWidth;
              drawH = elWidth / imgAspect;
              drawY = minY + (elHeight - drawH) / 2;
            } else {
              drawH = elHeight;
              drawW = elHeight * imgAspect;
              drawX = minX + (elWidth - drawW) / 2;
            }

            ctx.drawImage(refImg, drawX, drawY, drawW, drawH);
          }
        }
        ctx.restore();
        return;
      }

      // إنشاء مسار الشكل (Polygon)
      const path2d = new Path2D();
      path2d.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        path2d.lineTo(pts[i].x, pts[i].y);
      }
      path2d.closePath();

      if (el.type !== 'text') {
        // التعبئة الأساسية (Fill) - إذا كانت الوحدة خارج الفلتر تلوّن بالرمادي
        ctx.fillStyle = isDimmed ? '#cbd5e1' : styles.fill;
        ctx.fill(path2d);

        // رسم الـ Texture والمظاهر إذا كانت مفعلة للعنصر (فقط للوحدات المشمولة بالفلتر)
        if (el.hasTexture && !isDimmed) {
          ctx.save();
          ctx.clip(path2d);
          const texturePattern = getCanvasTexturePattern(ctx, el.textureType || 'glass', el.textureColor || '#ffffff');
          if (texturePattern) {
            ctx.fillStyle = texturePattern;
            ctx.fill(path2d);
          }
          ctx.restore();
        }

        // رسم الحدود (Stroke/Border)
        const strokeColor = isFilteredIn ? '#fbbf24' : (isDimmed ? '#94a3b8' : (isSelected ? '#000000' : (el.hasBorder && el.borderColor ? el.borderColor : styles.stroke)));
        const strokeWidth = isFilteredIn ? 3.5 : (isSelected ? 3.5 : (el.hasBorder ? 3 : styles.strokeWidth));

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke(path2d);

        // تأثير التوهج في الفلترة والإنارة
        if (isFilteredIn) {
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 12;
          ctx.stroke(path2d);
          ctx.shadowBlur = 0;
        }
      }

      // رسم خطوط الملعب
      if (el.type === 'pitch') {
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(midX, minY);
        ctx.lineTo(midX, maxY);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(midX, midY, Math.min(elWidth, elHeight) / 6, 0, Math.PI * 2);
        ctx.stroke();
      }

      // حساب أبعاد المكان المتاح للأيقونة والنص بفصل تام وبدون أي التصاق
      const showIcon = (el.type === 'house' || el.type === 'tower' || el.type === 'amenity') && !el.hideIcon;
      const dynamicIconSize = showIcon ? minDim * 0.42 : 0;
      const iconType = el.type === 'house' ? 'house' : el.type === 'tower' ? 'tower' : el.amenityType || 'amenity';
      const iconColor = isDimmed ? '#64748b' : (el.textColor || (el.type === 'tower' || (el.type === 'house' && housesData[el.id]) ? '#ffffff' : '#1e293b'));

      if (showIcon) {
        const img = getCachedIconImage(iconType, iconColor);
        if (img.complete) {
          const iconY = centerY - (dynamicIconSize * 0.45);
          ctx.drawImage(
            img,
            centerX - dynamicIconSize / 2,
            iconY - dynamicIconSize / 2,
            dynamicIconSize,
            dynamicIconSize
          );
        }
      }

      // رسم النص / الرقم التوضيحي
      if (el.type === 'text') {
        ctx.fillStyle = el.textColor || '#000000';
        ctx.font = `${el.isBold ? 'bold' : 'normal'} ${el.fontSize || 24}px ${el.fontFamily || 'Arial'}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(el.label || '', centerX, centerY);
      } else if (el.label) {
        const textLabel = el.label.split('-').pop() || '';
        const maxTextW = elWidth * 0.82;
        const maxTextH = showIcon ? (elHeight * 0.45) : (elHeight * 0.8);
        
        const textStartY = showIcon 
          ? centerY + (dynamicIconSize * 0.45) 
          : centerY;

        drawBoundedText(
          ctx,
          textLabel,
          centerX,
          textStartY,
          maxTextW,
          maxTextH,
          'Arial',
          true,
          iconColor,
          minDim * 0.28
        );
      }

      ctx.restore();
    });

    ctx.restore();
    ctx.restore();
  }, [
    position, scale, mapWidth, mapHeight, backgroundColor, showGrid, 
    sortedElements, selectedHouseId, housesData, isAnyFilterActive, 
    matchesFilter, getElementStyles
  ]);

  // فحص النقر المباشر والدقيق Hit Testing (تتجاهل الوحدات المظللة بالرمادي إذا كان هناك فلتر نشط)
  const getElementAtCoords = useCallback((screenX: number, screenY: number): MapElement | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = screenX - rect.left;
    const mouseY = screenY - rect.top;

    const worldX = (mouseX - position.x) / scale;
    const worldY = (mouseY - position.y) / scale;

    for (let i = sortedElements.length - 1; i >= 0; i--) {
      const el = sortedElements[i];
      if (el.type !== 'house' && el.type !== 'tower' && !el.linkProjectId) continue;

      // عند تفعيل فلتر معين، يتم منع النقر على الوحدات التي لا تطابق الفلتر (الرمادية)
      if (isAnyFilterActive && (el.type === 'house' || el.type === 'tower') && !matchesFilter(el)) {
        continue;
      }

      const pts = getElementPoints(el);
      const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
      const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;

      const rad = -((el.rotation || 0) * Math.PI) / 180;
      const dx = worldX - centerX;
      const dy = worldY - centerY;
      const unrotX = centerX + (dx * Math.cos(rad) - dy * Math.sin(rad));
      const unrotY = centerY + (dx * Math.sin(rad) + dy * Math.cos(rad));

      // فحص النقطة داخل الـ Polygon
      let inside = false;
      for (let j = 0, k = pts.length - 1; j < pts.length; k = j++) {
        const xi = pts[j].x, yi = pts[j].y;
        const xj = pts[k].x, yj = pts[k].y;
        const intersect = ((yi > unrotY) !== (yj > unrotY)) &&
            (unrotX < (xj - xi) * (unrotY - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }

      if (inside) return el;
    }
    return null;
  }, [sortedElements, position, scale, isAnyFilterActive, matchesFilter]);

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

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setHoveredElement(null);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    dragStartCoords.current = { x: e.clientX, y: e.clientY };
    hasDragged.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      const dx = e.clientX - dragStartCoords.current.x;
      const dy = e.clientY - dragStartCoords.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasDragged.current = true;
      }
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    } else if (showTooltips) {
      const targetEl = getElementAtCoords(e.clientX, e.clientY);
      setHoveredElement(targetEl);
      if (targetEl && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setTooltipPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        });
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (hasDragged.current) return;
    const targetEl = getElementAtCoords(e.clientX, e.clientY);
    if (targetEl) {
      onHouseClick(targetEl.id);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setHoveredElement(null);
      const touch = e.touches[0];
      setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
      dragStartCoords.current = { x: touch.clientX, y: touch.clientY };
      hasDragged.current = false;
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
      const dx = touch.clientX - dragStartCoords.current.x;
      const dy = touch.clientY - dragStartCoords.current.y;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasDragged.current = true;
      }
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

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!hasDragged.current && e.changedTouches.length === 1) {
      const touch = e.changedTouches[0];
      const targetEl = getElementAtCoords(touch.clientX, touch.clientY);
      if (targetEl) {
        onHouseClick(targetEl.id);
      }
    }
    setIsDragging(false);
    setLastTouchDistance(null);
  };

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative w-full border-4 border-white shadow-2xl overflow-hidden group cursor-grab active:cursor-grabbing transition-all duration-300 touch-none select-none",
        isFullScreen ? "fixed inset-0 z-[40] rounded-none border-0" : "aspect-[4/3] rounded-[2.5rem]"
      )}
      style={{ backgroundColor: backgroundColor }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onClick={handleClick}
      onMouseLeave={() => { setIsDragging(false); setHoveredElement(null); }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas 
        ref={canvasRef}
        className="w-full h-full block"
      />

      {/* شريط أدوات تصفية الخريطة وتوهج الوحدات المنسدل الجانبي على اليمين مع عزل الأحداث بالكامل عن الخريطة */}
      <div 
        className="absolute top-6 right-6 z-20"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {!isFilterPanelOpen ? (
          <button
            onClick={(e) => { e.stopPropagation(); setIsFilterPanelOpen(true); }}
            className="bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-xl border border-slate-100 flex items-center justify-center hover:bg-slate-50 transition-all font-black text-xs text-slate-700 relative"
            title="تصفية الخريطة وتوهج الوحدات"
          >
            <SlidersHorizontal size={20} className="text-blue-600" />
            {isAnyFilterActive && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-amber-500 animate-pulse border-2 border-white" />
            )}
          </button>
        ) : (
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-72 bg-white/95 backdrop-blur-md p-5 rounded-3xl shadow-2xl border border-slate-100 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200 text-right"
          >
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 font-black text-xs text-slate-800">
                <SlidersHorizontal size={16} className="text-blue-600" />
                <span>تصفية الخريطة وتوهج الوحدات</span>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsFilterPanelOpen(false); }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400">الزون:</span>
                <Select value={currentFilterZone} onValueChange={handleZoneChange}>
                  <SelectTrigger className="w-full rounded-xl h-10 border-slate-200 text-xs font-bold bg-slate-50/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="font-bold text-xs">الكل</SelectItem>
                    {mapZones.map(z => (
                      <SelectItem key={z} value={z} className="font-bold text-xs">زون {z}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400">الصنف:</span>
                <Select value={currentFilterClass} onValueChange={handleClassChange}>
                  <SelectTrigger className="w-full rounded-xl h-10 border-slate-200 text-xs font-bold bg-slate-50/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="font-bold text-xs">الكل</SelectItem>
                    {mapClasses.map(c => (
                      <SelectItem key={c} value={c} className="font-bold text-xs">صنف {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400">المساحة:</span>
                <Select value={currentFilterSize} onValueChange={handleSizeChange}>
                  <SelectTrigger className="w-full rounded-xl h-10 border-slate-200 text-xs font-bold bg-slate-50/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="font-bold text-xs">الكل</SelectItem>
                    {mapSizes.map(s => (
                      <SelectItem key={s} value={s.toString()} className="font-bold text-xs">{s} م²</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-slate-400">الحالة:</span>
                <Select value={currentFilterStatus} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-full rounded-xl h-10 border-slate-200 text-xs font-bold bg-slate-50/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="all" className="font-bold text-xs">كل الحالات</SelectItem>
                    <SelectItem value="available" className="font-bold text-xs text-emerald-600">🟢 متوفر</SelectItem>
                    <SelectItem value="sold" className="font-bold text-xs text-rose-600">🔴 مباع</SelectItem>
                    <SelectItem value="investment" className="font-bold text-xs text-purple-600">🟣 استثمار</SelectItem>
                    <SelectItem value="reserved" className="font-bold text-xs text-amber-600">🟡 محجوز</SelectItem>
                    <SelectItem value="pending" className="font-bold text-xs text-blue-600">🔵 حجز أولي</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isAnyFilterActive && (
                <button
                  onClick={resetFilters}
                  className="w-full mt-2 text-xs font-black text-rose-500 hover:bg-rose-50 rounded-xl h-9 transition-colors"
                >
                  إعادة ضبط الفلاتر
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* بطاقة المعاينة السريعة العائمة عند التمرير */}
      {showTooltips && hoveredElement && !isDragging && (
        (() => {
          const isHouse = hoveredElement.type === 'house';
          const isTower = hoveredElement.type === 'tower';
          const unitData = housesData[hoveredElement.id];

          const getStatusText = (status: string) => {
            switch (status) {
              case 'sold': return 'مباع';
              case 'investment': return 'استثمار';
              case 'reserved': return 'محجوز';
              case 'pending': return 'حجز أولي';
              default: return 'متوفر';
            }
          };

          const getStatusColor = (status: string) => {
            switch (status) {
              case 'sold': return 'text-rose-600 bg-rose-50 border-rose-100';
              case 'investment': return 'text-purple-600 bg-purple-50 border-purple-100';
              case 'reserved': return 'text-amber-600 bg-amber-50 border-amber-100';
              case 'pending': return 'text-blue-600 bg-blue-50 border-blue-100';
              default: return 'text-emerald-600 bg-emerald-50 border-emerald-100';
            }
          };

          const area = getHouseArea(hoveredElement);

          return (
            <div 
              className="absolute z-50 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-xl border border-slate-100 pointer-events-none w-64 text-right animate-in fade-in duration-200"
              style={{
                left: `${Math.min(tooltipPos.x + 15, (containerRef.current?.getBoundingClientRect().width || 600) - 270)}px`,
                top: `${Math.min(tooltipPos.y + 15, (containerRef.current?.getBoundingClientRect().height || 500) - 180)}px`
              }}
            >
              <div className="flex items-center gap-2 border-b pb-2 mb-3">
                <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                  {isTower ? <Building2 size={16} /> : <Home size={16} />}
                </div>
                <div>
                  <h4 className="font-black text-slate-800 text-xs">
                    {isTower ? `عمارة: ${hoveredElement.label}` : `منزل: ${hoveredElement.label}`}
                  </h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">معاينة سريعة</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 font-bold text-[10px]">حالة الوحدة:</span>
                  <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-full border", getStatusColor(unitData?.status || 'available'))}>
                    {getStatusText(unitData?.status || 'available')}
                  </span>
                </div>

                {area > 0 && (
                  <div className="flex justify-between items-center border-t pt-2.5">
                    <span className="text-slate-400 font-bold text-[10px]">المساحة:</span>
                    <span className="text-slate-700 font-black text-[11px]">{area} م²</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()
      )}

      <div className="absolute top-6 left-6 flex flex-col gap-2 z-10">
        <button onClick={(e) => {
          e.stopPropagation();
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
        
        <button onClick={(e) => {
          e.stopPropagation();
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
        
        <button onClick={(e) => { e.stopPropagation(); autoFit(); }} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50"><RotateCcw size={20} /></button>
        <button onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }} className="w-10 h-10 bg-white rounded-xl shadow-lg flex items-center justify-center hover:bg-slate-50">{isFullScreen ? <Minimize size={20} /> : <Maximize size={20} />}</button>
      </div>
    </div>
  );
};

export default InteractiveMap;