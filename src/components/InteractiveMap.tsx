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
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { canvasFont, mapPalette, palette } from "@/lib/theme";
import { getReferenceImageSrc } from "@/lib/map-image-storage";
import { PRIMARY_STATUSES, STATUS_META } from "@/lib/unit-status";
import { StatusBadge } from "@/components/StatusBadge";

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

/** Preload site-plan images before drawing sellable units on top */
const preloadReferenceImage = (url: string): Promise<void> =>
  new Promise((resolve, reject) => {
    let img = referenceImageCache.get(url);
    if (img?.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    if (!img) {
      img = new Image();
      img.crossOrigin = 'anonymous';
      referenceImageCache.set(url, img);
    }
    const onLoad = () => {
      img!.onload = null;
      img!.onerror = null;
      resolve();
    };
    const onError = () => {
      img!.onload = null;
      img!.onerror = null;
      reject(new Error('reference image load failed'));
    };
    img.onload = onLoad;
    img.onerror = onError;
    if (img.src !== url) img.src = url;
  });

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
  fontFamily: string = canvasFont,
  isBold: boolean = true,
  textColor: string = '#000000',
  baseFontSize: number = 12
) => {
  if (!text) return;

  const weight = isBold ? '600' : '400';
  const words = text.split(/([ -])/).filter(Boolean);
  let fontSize = Math.min(baseFontSize, Math.max(7, maxHeight * 0.35));
  
  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;

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
    ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
    const overflows = lines.some(l => ctx.measureText(l).width > maxWidth);
    if (!overflows && lines.length * fontSize * 1.15 <= maxHeight) {
      break;
    }
    fontSize -= 0.5;
  }

  ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
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
  backgroundColor = palette.surfaceSunken,
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
  const [areReferenceImagesReady, setAreReferenceImagesReady] = useState(true);

  // حالة التحكم في المعاينة السريعة (تكون مفعّلة افتراضياً)
  const [isQuickPreviewEnabled, setIsQuickPreviewEnabled] = useState(true);

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

  const canShowQuickPreview = permissions?.showQuickPreview !== false;

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
    if (el.type === 'label_area') return { fill: el.color || mapPalette.labelArea, stroke: el.hasBorder ? (el.borderColor || mapPalette.labelAreaStroke) : (el.color || mapPalette.labelArea), opacity: el.opacity || 0.2, strokeWidth: el.hasBorder ? 3 : 2 };
    
    const data = housesData[el.id];
    if (el.type === 'road') return { fill: mapPalette.road, stroke: el.hasBorder ? (el.borderColor || mapPalette.roadStroke) : mapPalette.road, opacity: 1, strokeWidth: el.hasBorder ? 12 : 10 };
    if (el.type === 'green') return { fill: mapPalette.green, stroke: el.hasBorder ? (el.borderColor || mapPalette.greenStroke) : mapPalette.green, opacity: 1, strokeWidth: el.hasBorder ? 12 : 10 };
    if (el.type === 'pitch') return { fill: mapPalette.pitch, stroke: el.hasBorder ? (el.borderColor || mapPalette.pitchStroke) : mapPalette.pitchStroke, opacity: 1, strokeWidth: 2 };
    if (el.type === 'tower') return { fill: el.color || palette.accent, stroke: el.hasBorder ? (el.borderColor || palette.fg) : palette.fg, opacity: 1, strokeWidth: el.hasBorder ? 4 : 2 };
    if (el.type === 'amenity') return { fill: el.color || mapPalette.amenity, stroke: el.hasBorder ? (el.borderColor || mapPalette.amenityStroke) : (el.color || mapPalette.amenityStroke), opacity: 1, strokeWidth: 2 };
    if (el.type === 'text') return { fill: 'none', stroke: 'none', opacity: 1, strokeWidth: 0 };
    
    if (el.type === 'house') {
      const baseStroke = el.hasBorder ? (el.borderColor || palette.lineStrong) : palette.lineStrong;
      const colorMode = permissions?.colorMode || 'default';

      if (colorMode === 'tabo') {
        const tabo = data?.taboStatus?.trim();
        if (tabo === 'مستلم') return { fill: STATUS_META.available.fill, stroke: STATUS_META.available.stroke, opacity: 1, strokeWidth: 2 }; 
        if (tabo === 'مروج') return { fill: STATUS_META.reserved.fill, stroke: STATUS_META.reserved.stroke, opacity: 1, strokeWidth: 2 }; 
        return { fill: STATUS_META.sold.fill, stroke: STATUS_META.sold.stroke, opacity: 1, strokeWidth: 2 }; 
      }

      if (colorMode === 'handover') {
        if (data?.handoverDate) return { fill: STATUS_META.available.fill, stroke: STATUS_META.available.stroke, opacity: 1, strokeWidth: 2 }; 
        return { fill: STATUS_META.sold.fill, stroke: STATUS_META.sold.stroke, opacity: 1, strokeWidth: 2 }; 
      }

      if (data?.status?.startsWith('frozen')) return { fill: STATUS_META.frozen_counted.fill, stroke: baseStroke, opacity: 1, strokeWidth: 2 };
      if (data?.status === 'investment') return { fill: STATUS_META.investment.fill, stroke: el.hasBorder ? (el.borderColor || STATUS_META.investment.stroke) : STATUS_META.investment.stroke, opacity: 1, strokeWidth: 2 };
      if (!data || data.status === 'available') return { fill: el.color || STATUS_META.available.fill, stroke: el.hasBorder ? (el.borderColor || STATUS_META.available.stroke) : STATUS_META.available.stroke, opacity: 1, strokeWidth: 2 };
      if (data.status === 'sold') return { fill: STATUS_META.sold.fill, stroke: el.hasBorder ? (el.borderColor || STATUS_META.sold.stroke) : STATUS_META.sold.stroke, opacity: 1, strokeWidth: 2 };
      if (data.status === 'reserved') return { fill: STATUS_META.reserved.fill, stroke: el.hasBorder ? (el.borderColor || STATUS_META.reserved.stroke) : STATUS_META.reserved.stroke, opacity: 1, strokeWidth: 2 };
      if (data.status === 'pending') return { fill: STATUS_META.pending.fill, stroke: el.hasBorder ? (el.borderColor || STATUS_META.pending.stroke) : STATUS_META.pending.stroke, opacity: 1, strokeWidth: 2 };
    }
    
    return { fill: el.color || palette.surface, stroke: el.hasBorder ? (el.borderColor || palette.lineStrong) : palette.lineStrong, opacity: 1, strokeWidth: 2 };
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

  const referenceImageUrls = useMemo(() => {
    return sortedElements
      .filter((el) => el.type === 'reference_image')
      .map((el) => getReferenceImageSrc(el))
      .filter((url): url is string => !!url);
  }, [sortedElements]);

  useEffect(() => {
    if (referenceImageUrls.length === 0) {
      setAreReferenceImagesReady(true);
      return;
    }

    let cancelled = false;
    setAreReferenceImagesReady(false);

    Promise.all(referenceImageUrls.map((url) => preloadReferenceImage(url)))
      .then(() => {
        if (!cancelled) setAreReferenceImagesReady(true);
      })
      .catch(() => {
        // عند فشل التحميل نعرض العناصر anyway حتى لا يعلق المستخدم
        if (!cancelled) setAreReferenceImagesReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [referenceImageUrls.join('|')]);

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
      ctx.strokeStyle = mapPalette.gridStrong;
      ctx.globalAlpha = 0.55;
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

    // رسم كل العناصر بعد جاهزية صورة Site plan
    if (areReferenceImagesReady) {
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
        const refSrc = getReferenceImageSrc(el);
        if (refSrc) {
          const refImg = getCachedReferenceImage(refSrc);
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
        ctx.fillStyle = isDimmed ? mapPalette.gridStrong : styles.fill;
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
        const strokeColor = isFilteredIn ? mapPalette.highlight : (isDimmed ? palette.lineStrong : (isSelected ? mapPalette.selection : (el.hasBorder && el.borderColor ? el.borderColor : styles.stroke)));
        const strokeWidth = isFilteredIn ? 3.5 : (isSelected ? 3.5 : (el.hasBorder ? 3 : styles.strokeWidth));

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = strokeWidth;
        ctx.stroke(path2d);

        // تأثير التوهج في الفلترة والإنارة
        if (isFilteredIn) {
          ctx.shadowColor = mapPalette.highlight;
          ctx.shadowBlur = 12;
          ctx.stroke(path2d);
          ctx.shadowBlur = 0;
        }
      }

      // رسم خطوط الملعب
      if (el.type === 'pitch') {
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        ctx.strokeStyle = palette.surface;
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
      const iconColor = isDimmed ? palette.fgMuted : (el.textColor || (el.type === 'tower' || (el.type === 'house' && housesData[el.id]) ? palette.surface : palette.fg));

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
          canvasFont,
          true,
          iconColor,
          minDim * 0.28
        );
      }

      ctx.restore();
    });
    }

    ctx.restore();
    ctx.restore();
  }, [
    position, scale, mapWidth, mapHeight, backgroundColor, showGrid, 
    sortedElements, selectedHouseId, housesData, isAnyFilterActive, 
    matchesFilter, getElementStyles, areReferenceImagesReady
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
    } else if (showTooltips && canShowQuickPreview && isQuickPreviewEnabled) {
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
        "relative w-full overflow-hidden group cursor-grab active:cursor-grabbing touch-none select-none border border-line",
        isFullScreen ? "fixed inset-0 z-[40] rounded-none border-0" : "aspect-[4/3] rounded-md"
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

      {!areReferenceImagesReady && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-background/85 backdrop-blur-[2px]"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-fg" />
          <p className="text-[12px] text-fg-muted">جاري تحميل صورة المخطط...</p>
        </div>
      )}

      {/* شريط أدوات تصفية الخريطة وتوهج الوحدات المنسدل الجانبي على اليمين ومربع اختيار المعاينة السريعة أسفله */}
      <div 
        className="absolute top-4 right-4 z-20 flex flex-col items-end gap-2"
        onMouseDown={(e) => e.stopPropagation()}
        onMouseUp={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        {permissions?.showSearchBox !== false && (
          !isFilterPanelOpen ? (
            <button
              onClick={(e) => { e.stopPropagation(); setIsFilterPanelOpen(true); }}
              className="relative flex h-9 w-9 items-center justify-center rounded-md border border-line bg-card/90 text-fg-secondary backdrop-blur-sm transition-colors hover:bg-surface-sunken hover:text-fg"
              title="تصفية الخريطة وتوهج الوحدات"
            >
              <SlidersHorizontal size={16} />
              {isAnyFilterActive && (
                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-status-reserved ring-2 ring-card" />
              )}
            </button>
          ) : (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="w-64 space-y-4 rounded-md border border-line bg-card/95 p-4 text-right shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2 text-[13px] font-medium text-fg">
                  <SlidersHorizontal size={14} className="text-fg-muted" />
                  <span>تصفية الخريطة</span>
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsFilterPanelOpen(false); }}
                  className="rounded-sm p-1 text-fg-faint transition-colors hover:bg-surface-sunken hover:text-fg"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <span className="eyebrow">الزون</span>
                  <Select value={currentFilterZone} onValueChange={handleZoneChange}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {mapZones.map(z => (
                        <SelectItem key={z} value={z}>زون {z}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <span className="eyebrow">الصنف</span>
                  <Select value={currentFilterClass} onValueChange={handleClassChange}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {mapClasses.map(c => (
                        <SelectItem key={c} value={c}>صنف {c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <span className="eyebrow">المساحة</span>
                  <Select value={currentFilterSize} onValueChange={handleSizeChange}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">الكل</SelectItem>
                      {mapSizes.map(s => (
                        <SelectItem key={s} value={s.toString()}>{s} م²</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <span className="eyebrow">الحالة</span>
                  <Select value={currentFilterStatus} onValueChange={handleStatusChange}>
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الحالات</SelectItem>
                      {PRIMARY_STATUSES.map(key => (
                        <SelectItem key={key} value={key}>
                          <span className="flex items-center gap-2">
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: STATUS_META[key].fill }}
                            />
                            {STATUS_META[key].label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {isAnyFilterActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetFilters}
                    className="mt-1 w-full"
                  >
                    إعادة ضبط الفلاتر
                  </Button>
                )}
              </div>
            </div>
          )
        )}

        {/* مربع اختيار المعاينة السريعة يظهر فقط في حال السماح به من الصلاحيات */}
        {canShowQuickPreview && (
          <div className="flex select-none items-center gap-2 rounded-md border border-line bg-card/90 px-3 py-2 backdrop-blur-sm">
            <Checkbox 
              id="quick-preview-toggle" 
              checked={isQuickPreviewEnabled} 
              onCheckedChange={(val) => {
                const enabled = !!val;
                setIsQuickPreviewEnabled(enabled);
                if (!enabled) setHoveredElement(null);
              }}
              className="h-3.5 w-3.5 rounded-sm border-line-strong"
            />
            <label htmlFor="quick-preview-toggle" className="cursor-pointer text-[12px] text-fg-secondary">
              المعاينة السريعة
            </label>
          </div>
        )}
      </div>

      {/* بطاقة المعاينة السريعة العائمة عند التمرير */}
      {showTooltips && canShowQuickPreview && isQuickPreviewEnabled && hoveredElement && !isDragging && (
        (() => {
          const isHouse = hoveredElement.type === 'house';
          const isTower = hoveredElement.type === 'tower';
          const unitData = housesData[hoveredElement.id];

          const area = getHouseArea(hoveredElement);

          return (
            <div 
              className="pointer-events-none absolute z-50 w-60 rounded-md border border-line bg-card/95 text-right shadow-2xl backdrop-blur-md animate-in fade-in duration-150"
              style={{
                left: `${Math.min(tooltipPos.x + 15, (containerRef.current?.getBoundingClientRect().width || 600) - 270)}px`,
                top: `${Math.min(tooltipPos.y + 15, (containerRef.current?.getBoundingClientRect().height || 500) - 180)}px`
              }}
            >
              <div className="flex items-center gap-2 border-b border-line px-3.5 py-2.5">
                <span className="text-fg-muted">
                  {isTower ? <Building2 size={14} /> : <Home size={14} />}
                </span>
                <span className="truncate text-[13px] font-medium text-fg">
                  {hoveredElement.label}
                </span>
                <span className="eyebrow ms-auto">{isTower ? 'عمارة' : 'منزل'}</span>
              </div>

              <div className="divide-y divide-line">
                <div className="flex items-center justify-between px-3.5 py-2.5">
                  <span className="text-[11px] text-fg-muted">الحالة</span>
                  <StatusBadge status={unitData?.status || 'available'} />
                </div>

                {area > 0 && (
                  <div className="flex items-center justify-between px-3.5 py-2.5">
                    <span className="text-[11px] text-fg-muted">المساحة</span>
                    <span className="text-[13px] tabular text-fg">{area} م²</span>
                  </div>
                )}
              </div>
            </div>
          );
        })()
      )}

      {/* Status legend */}
      {permissions?.colorMode !== 'tabo' && permissions?.colorMode !== 'handover' && (
        <div className="pointer-events-none absolute bottom-4 left-4 z-10 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-line bg-card/85 px-3 py-2 backdrop-blur-sm">
          {PRIMARY_STATUSES.map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-[11px] text-fg-secondary">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: STATUS_META[key].fill }}
              />
              {STATUS_META[key].label}
            </span>
          ))}
        </div>
      )}

      <div className="absolute top-4 left-4 z-10 flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-card/90 backdrop-blur-sm">
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
        }} className="flex h-9 w-9 items-center justify-center text-fg-secondary transition-colors hover:bg-surface-sunken hover:text-fg" title="تكبير"><ZoomIn size={16} /></button>
        
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
        }} className="flex h-9 w-9 items-center justify-center text-fg-secondary transition-colors hover:bg-surface-sunken hover:text-fg" title="تصغير"><ZoomOut size={16} /></button>
        
        <button onClick={(e) => { e.stopPropagation(); autoFit(); }} className="flex h-9 w-9 items-center justify-center text-fg-secondary transition-colors hover:bg-surface-sunken hover:text-fg" title="ملاءمة العرض"><RotateCcw size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); setIsFullScreen(!isFullScreen); }} className="flex h-9 w-9 items-center justify-center text-fg-secondary transition-colors hover:bg-surface-sunken hover:text-fg" title={isFullScreen ? 'إنهاء ملء الشاشة' : 'ملء الشاشة'}>{isFullScreen ? <Minimize size={16} /> : <Maximize size={16} />}</button>
      </div>
    </div>
  );
};

export default InteractiveMap;