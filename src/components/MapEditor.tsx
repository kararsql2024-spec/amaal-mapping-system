"use client";

import React, { useState, useRef, useEffect } from 'react';
import { MapElement, ElementType, Point, Project } from '@/types/project';
import { Button } from '@/components/ui/button';
import { 
  Trash2, Save, Home, Building2, Leaf, 
  Waypoints, MapPin, Grid3X3, ArrowDown, ArrowLeft, ArrowUp, ArrowRight,
  ZoomIn, ZoomOut, RotateCcw, Type, Palette, Hand,
  Trophy, Store, GraduationCap, Stethoscope, Baby, ShoppingBag, Dumbbell, ShoppingCart,
  Copy, ChevronRight, ChevronDown, X, AlignHorizontalJustifyCenter, AlignVerticalJustifyCenter,
  Settings2, MoonStar, Maximize2, Footprints, Car, EyeOff, Eye, Paintbrush, MousePointer2,
  SlidersHorizontal, Maximize, Minimize, Image as ImageIcon, Lock, Unlock, Upload, Bold, RotateCw, Layers, Loader2, RefreshCcw,
  Frame, Ruler, Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { showSuccess, showError } from '@/utils/toast';
import { palette, mapPalette, canvasFont } from '@/lib/theme';
import { STATUS_META } from '@/lib/unit-status';
import {
  getReferenceImageSrc,
  uploadMapImageFile,
  type MapImageScope,
} from '@/lib/map-image-storage';

interface MapEditorProps {
  initialElements: MapElement[];
  onSave: (elements: MapElement[], width: number, height: number, backgroundColor?: string, showGrid?: boolean, houseTypeAreas?: Record<string, number>) => void;
  mapWidth: number;
  mapHeight: number;
  isSaving?: boolean;
  projects?: Project[];
  onCancel?: () => void;
  initialBackgroundColor?: string;
  initialShowGrid?: boolean;
  initialHouseTypeAreas?: Record<string, number>;
  /** سياق رفع الصور إلى Storage */
  storageScope?: MapImageScope;
  storageScopeId?: string;
}

const GRID_SIZE = 10;

const FONT_FAMILIES = [
  { id: canvasFont, label: 'خط النظام (IBM Plex Arabic)' },
  { id: '"IBM Plex Mono", ui-monospace, monospace', label: 'خط أحادي المسافة' },
  { id: 'Arial', label: 'Arial' },
  { id: 'Tahoma', label: 'Tahoma' },
  { id: 'Georgia', label: 'Georgia' },
  { id: 'Times New Roman', label: 'Times New Roman' },
];

const TEXTURE_TYPES = [
  { id: 'glass', label: 'زجاج حديث' },
  { id: 'brick', label: 'طوب كلاسيكي' },
  { id: 'dots', label: 'خرسانة منقطة' },
  { id: 'stripes', label: 'خطوط تصميم' },
  { id: 'grid', label: 'شبكة مربعات' },
  { id: 'zigzag', label: 'متعرج' },
  { id: 'crosshatch', label: 'تظليل متقاطع' },
];

const AMENITY_TYPES = [
  { id: 'shop', label: 'محل تجاري', icon: Store },
  { id: 'school', label: 'مدرسة', icon: GraduationCap },
  { id: 'medical', label: 'مركز طبي', icon: Stethoscope },
  { id: 'nursery', label: 'حضانة', icon: Baby },
  { id: 'mall', label: 'مول', icon: ShoppingBag },
  { id: 'gym', label: 'جم', icon: Dumbbell },
  { id: 'supermarket', label: 'أسواق مركزية', icon: ShoppingCart },
  { id: 'mosque', label: 'مسجد', icon: MoonStar },
];

const TOOLS: { type: ElementType | 'map_boundary'; label: string; icon: any; swatch: string }[] = [
  { type: 'house', label: 'منزل', icon: Home, swatch: STATUS_META.available.fill },
  { type: 'tower', label: 'برج', icon: Building2, swatch: palette.accent },
  { type: 'road', label: 'طريق', icon: Waypoints, swatch: mapPalette.roadStroke },
  { type: 'green', label: 'مساحة خضراء', icon: Leaf, swatch: mapPalette.green },
  { type: 'pitch', label: 'ملعب', icon: Trophy, swatch: mapPalette.pitch },
  { type: 'amenity', label: 'مرفق', icon: MapPin, swatch: mapPalette.amenity },
  { type: 'text', label: 'نص', icon: Type, swatch: palette.fgSecondary },
  { type: 'label_area', label: 'منطقة تسمية', icon: Type, swatch: mapPalette.labelAreaStroke },
  { type: 'map_boundary', label: 'حدود الخريطة', icon: Frame, swatch: mapPalette.highlight },
];

const MapEditor = ({ 
  initialElements, 
  onSave, 
  mapWidth, 
  mapHeight, 
  isSaving = false, 
  projects = [], 
  onCancel,
  initialBackgroundColor = '#ffffff',
  initialShowGrid = true,
  initialHouseTypeAreas = {},
  storageScope,
  storageScopeId,
}: MapEditorProps) => {
  const [elements, setElements] = useState<MapElement[]>(initialElements);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [activeTool, setActiveTool] = useState<ElementType | 'map_boundary' | null>(null);
  const [isBrushMode, setIsBrushMode] = useState(false);
  const [brushSize, setBrushSize] = useState(40);
  const [dragMode, setDragMode] = useState<{ type: 'move' | 'vertex' | 'edge' | 'rotate' | 'pan' | 'brush' | 'boundary', startPos?: Point, index?: number } | null>(null);
  const [tempPoints, setTempPoints] = useState<Point[]>([]);
  const [gridLock, setGridLock] = useState(true);
  const [dims, setDims] = useState({ w: Math.round(mapWidth), h: Math.round(mapHeight) });
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const [backgroundColor, setBackgroundColor] = useState<string>(initialBackgroundColor);
  const [showGrid, setShowGrid] = useState<boolean>(initialShowGrid);
  const [houseTypeAreas, setHouseTypeAreas] = useState<Record<string, number>>(initialHouseTypeAreas);
  
  // حالات إضافة صنف قياسي جديد للمنازل
  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeArea, setNewTypeArea] = useState('');

  const [scale, setScale] = useState(1);
  const [viewPos, setViewPos] = useState({ x: 0, y: 0 });
  
  const svgRef = useRef<SVGSVGElement>(null);
  const contentRef = useRef<SVGGElement>(null);

  const snap = (val: number) => gridLock ? Math.round(val / GRID_SIZE) * GRID_SIZE : Math.round(val);

  const getElementPoints = (el: MapElement): Point[] => {
    if (el.points && el.points.length > 0) return el.points;
    return [
      { x: el.x, y: el.y },
      { x: el.x + el.width, y: el.y },
      { x: el.x + el.width, y: el.y + el.height },
      { x: el.x, y: el.y + el.height },
    ];
  };

  const checkAndExpandMap = (pts: Point[]) => {
    const maxX = Math.max(...pts.map(p => p.x));
    const maxY = Math.max(...pts.map(p => p.y));
    if (maxX > dims.w - 50) setDims(prev => ({ ...prev, w: Math.round(maxX + 200) }));
    if (maxY > dims.h - 50) setDims(prev => ({ ...prev, h: Math.round(maxY + 200) }));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedId || document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      
      const step = gridLock ? GRID_SIZE : 1;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setElements(prev => prev.filter(el => el.id !== selectedId));
        setSelectedId(null);
        return;
      }

      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;

      e.preventDefault();
      setElements(prev => {
        const el = prev.find(item => item.id === selectedId);
        if (!el || el.locked) return prev;

        const angleRad = (el.rotation || 0) * (Math.PI / 180);
        let dx = 0; let dy = 0;
        
        if (e.key === 'ArrowUp') {
          dx = step * Math.sin(angleRad);
          dy = -step * Math.cos(angleRad);
        } else if (e.key === 'ArrowDown') {
          dx = -step * Math.sin(angleRad);
          dy = step * Math.cos(angleRad);
        } else if (e.key === 'ArrowLeft') {
          dx = -step * Math.cos(angleRad);
          dy = -step * Math.sin(angleRad);
        } else if (e.key === 'ArrowRight') {
          dx = step * Math.cos(angleRad);
          dy = step * Math.sin(angleRad);
        }

        const pts = getElementPoints(el);
        const newPoints = pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
        checkAndExpandMap(newPoints);
        
        return prev.map(item => 
          item.id === selectedId 
            ? { ...item, points: newPoints, x: newPoints[0].x, y: newPoints[0].y } 
            : item
        );
      });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, gridLock, dims]);

  const getMousePos = (e: React.MouseEvent | WheelEvent | React.TouchEvent) => {
    if (!svgRef.current || !contentRef.current) return { x: 0, y: 0 };
    const pt = svgRef.current.createSVGPoint();
    if ('touches' in e) { pt.x = e.touches[0].clientX; pt.y = e.touches[0].clientY; }
    else { pt.x = e.clientX; pt.y = e.clientY; }
    const svgP = pt.matrixTransform(contentRef.current.getScreenCTM()?.inverse());
    return { x: svgP.x, y: svgP.y };
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.min(Math.max(prev * delta, 0.1), 10));
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (dragMode || !activeTool || isBrushMode || activeTool === 'map_boundary') return;
    const pos = getMousePos(e);
    const w = activeTool === 'road' ? 200 : 80;
    const h = activeTool === 'road' ? 40 : 80;
    const newPoints = [
      { x: snap(pos.x - w/2), y: snap(pos.y - h/2) },
      { x: snap(pos.x + w/2), y: snap(pos.y - h/2) },
      { x: snap(pos.x + w/2), y: snap(pos.y + h/2) },
      { x: snap(pos.x - w/2), y: snap(pos.y + h/2) },
    ];
    createElement(activeTool as ElementType, newPoints);
  };

  const createElement = (type: ElementType, pts: Point[], isStroke = false, customLabel?: string) => {
    checkAndExpandMap(pts);
    const newElement: MapElement = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      label: customLabel || (type === 'house' ? `D1` : type === 'tower' ? `T1` : type === 'text' ? 'نص جديد' : ''),
      points: pts,
      rotation: 0,
      orientation: 'horizontal',
      color: type === 'label_area' ? mapPalette.labelArea : (type === 'amenity' ? mapPalette.amenity : (type === 'tower' ? palette.accent : undefined)),
      textColor: type === 'text' ? palette.fg : (type === 'tower' ? palette.accentFg : palette.fg),
      fontSize: type === 'text' ? 24 : (type === 'house' || type === 'tower' ? 10 : undefined),
      fontFamily: type === 'text' ? canvasFont : undefined,
      opacity: type === 'label_area' ? 0.2 : 1,
      hideIcon: false,
      x: pts[0].x, y: pts[0].y, width: 0, height: 0,
      floors: type === 'tower' ? 5 : undefined,
      apartmentsPerFloor: type === 'tower' ? 4 : undefined,
      groundFloorSizes: type === 'tower' ? Array(4).fill(0) : undefined,
      typicalFloorSizes: type === 'tower' ? Array(4).fill(0) : undefined,
      amenityType: type === 'amenity' ? 'shop' : undefined,
      strokeWidth: isStroke ? brushSize : undefined,
      isStroke: isStroke,
      locked: false,
      showInMain: false,
      isBold: type === 'text',
      hasBorder: type === 'tower',
      borderColor: type === 'tower' ? palette.fg : undefined,
      hasTexture: false,
      textureType: 'glass',
      textureColor: 'white',
      textureSize: 1
    };
    setElements(prev => [...prev, newElement]);
    setSelectedId(newElement.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getMousePos(e);
    if (activeTool === 'map_boundary') {
      setDragMode({ type: 'boundary', startPos: pos });
      setTempPoints([pos, pos, pos, pos]);
      return;
    }
    if (isBrushMode && activeTool) {
      setDragMode({ type: 'brush' });
      setTempPoints([pos]);
      return;
    }
    if (!activeTool) {
      setDragMode({ type: 'pan', startPos: { x: e.clientX, y: e.clientY } });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragMode) return;
    const pos = getMousePos(e);
    
    if (dragMode.type === 'boundary' && dragMode.startPos) {
      const start = dragMode.startPos;
      const current = pos;
      setTempPoints([
        { x: start.x, y: start.y },
        { x: current.x, y: start.y },
        { x: current.x, y: current.y },
        { x: start.x, y: current.y }
      ]);
      return;
    }

    if (dragMode.type === 'brush') {
      const lastPt = tempPoints[tempPoints.length - 1];
      const dist = Math.sqrt(Math.pow(pos.x - lastPt.x, 2) + Math.pow(pos.y - lastPt.y, 2));
      if (dist > 30) setTempPoints(prev => [...prev, pos]);
      return;
    }
    if (dragMode.type === 'pan' && dragMode.startPos) {
      const dx = e.clientX - dragMode.startPos.x;
      const dy = e.clientY - dragMode.startPos.y;
      setViewPos(prev => ({ x: prev.x + dx, y: prev.y + dy }));
      setDragMode({ ...dragMode, startPos: { x: e.clientX, y: e.clientY } });
      return;
    }
    if (!selectedId) return;
    setElements(prev => prev.map(el => {
      if (el.id !== selectedId) return el;
      if (el.locked) return el;
      const pts = getElementPoints(el);
      const dragIdx = dragMode.index;
      let newPoints = [...pts];
      
      if (dragMode.type === 'vertex' && dragIdx !== undefined) {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        
        const angleRad = -(el.rotation || 0) * (Math.PI / 180);
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const dx = pos.x - centerX;
        const dy = pos.y - centerY;
        
        const localX = centerX + (dx * cos - dy * sin);
        const localY = centerY + (dx * sin + dy * cos);
        
        newPoints[dragIdx] = { x: snap(localX), y: snap(localY) };
      } else if (dragMode.type === 'edge' && dragIdx !== undefined) {
        const idx1 = dragIdx;
        const idx2 = (dragIdx + 1) % pts.length;
        const midX = (pts[idx1].x + pts[idx2].x) / 2;
        const midY = (pts[idx1].y + pts[idx2].y) / 2;
        const dx = snap(pos.x) - midX;
        const dy = snap(pos.y) - midY;
        newPoints[idx1] = { x: pts[idx1].x + dx, y: pts[idx1].y + dy };
        newPoints[idx2] = { x: pts[idx2].x + dx, y: pts[idx2].y + dy };
      } else if (dragMode.type === 'move') {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const dx = snap(pos.x) - centerX;
        const dy = snap(pos.y) - centerY;
        newPoints = pts.map(p => ({ x: p.x + dx, y: p.y + dy }));
      } else if (dragMode.type === 'rotate') {
        const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
        const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
        const angle = Math.atan2(pos.y - centerY, pos.x - centerX) * (180 / Math.PI);
        return { ...el, rotation: angle + 90 };
      }
      checkAndExpandMap(newPoints);
      return { ...el, points: newPoints, x: newPoints[0].x, y: newPoints[0].y };
    }));
  };

  const handleMouseUp = () => {
    if (dragMode?.type === 'boundary' && tempPoints.length === 4) {
      const minX = Math.min(...tempPoints.map(p => p.x));
      const minY = Math.min(...tempPoints.map(p => p.y));
      const maxX = Math.max(...tempPoints.map(p => p.x));
      const maxY = Math.max(...tempPoints.map(p => p.y));
      
      const newW = Math.round(maxX - minX);
      const newH = Math.round(maxY - minY);
      
      if (newW > 50 && newH > 50) {
        setDims({ w: newW, h: newH });
        setElements(prev => prev.map(el => ({
          ...el,
          points: getElementPoints(el).map(p => ({ x: p.x - minX, y: p.y - minY })),
          x: el.x - minX,
          y: el.y - minY
        })));
        
        setViewPos({ x: 0, y: 0 });
        setScale(1);
        
        showSuccess(`تم تحديث حدود الخريطة إلى ${newW}x${newH} ونقل العناصر بنجاح`);
        setActiveTool(null);
      }
    } else if (dragMode?.type === 'brush' && activeTool && tempPoints.length > 1) {
      createElement(activeTool as ElementType, tempPoints, true);
    }
    setDragMode(null);
    setTempPoints([]);
  };

  const handleDuplicate = (direction: 'right' | 'left' | 'up' | 'down') => {
    const el = elements.find(e => e.id === selectedId);
    if (!el) return;
    const pts = getElementPoints(el);
    
    const minX = Math.min(...pts.map(p => p.x));
    const maxX = Math.max(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxY = Math.max(...pts.map(p => p.y));
    const width = maxX - minX;
    const height = maxY - minY;

    const angleRad = (el.rotation || 0) * (Math.PI / 180);
    
    let offset = { x: 0, y: 0 };
    
    if (direction === 'right') {
      offset = { 
        x: width * Math.cos(angleRad), 
        y: width * Math.sin(angleRad) 
      };
    } else if (direction === 'left') {
      offset = { 
        x: -width * Math.cos(angleRad), 
        y: -width * Math.sin(angleRad) 
      };
    } else if (direction === 'down') {
      offset = { 
        x: -height * Math.sin(angleRad), 
        y: height * Math.cos(angleRad) 
      };
    } else if (direction === 'up') {
      offset = { 
        x: height * Math.sin(angleRad), 
        y: -height * Math.cos(angleRad) 
      };
    }

    const newPoints = pts.map(p => ({ x: p.x + offset.x, y: p.y + offset.y }));
    
    let newLabel = el.label;
    if (el.type === 'house' || el.type === 'tower') {
      const parts = el.label.split('-');
      const lastPart = parts[parts.length - 1];
      const match = lastPart.match(/([a-zA-Z]+)(\d+)/);
      if (match) {
        const prefix = match[1];
        const num = parseInt(match[2]);
        parts[parts.length - 1] = `${prefix}${num + 2}`;
        newLabel = parts.join('-');
      }
    }
    
    const newId = Math.random().toString(36).substr(2, 9);
    const newElement: MapElement = {
      ...el,
      id: newId,
      points: newPoints,
      label: newLabel,
      x: newPoints[0].x,
      y: newPoints[0].y,
      locked: false
    };
    
    setElements(prev => [...prev, newElement]);
    setSelectedId(newId);
  };

  const pointsToPath = (points: Point[], closed = true) => {
    if (!points || points.length === 0) return "";
    let path = `M ${points[0].x} ${points[0].y} ` + points.slice(1).map(p => `L ${p.x} ${p.y}`).join(' ');
    return closed ? path + " Z" : path;
  };

  /**
   * ألوان المعاينة داخل المحرر مطابقة لما ترسمه الخريطة التفاعلية،
   * حتى لا يختلف شكل العنصر بين التحرير والعرض. لون العنصر المخزّن له الأولوية دائماً.
   */
  const getElementColor = (el: MapElement) => {
    if (el.type === 'label_area' || el.type === 'amenity' || el.type === 'tower' || el.type === 'house') {
      if (el.color) return el.color;
      if (el.type === 'amenity') return mapPalette.amenity;
      if (el.type === 'tower') return palette.accent;
      if (el.type === 'house') return STATUS_META.available.fill;
      return mapPalette.labelArea;
    }
    switch (el.type) {
      case 'road': return mapPalette.road;
      case 'green': return 'url(#green-pattern)';
      case 'pitch': return mapPalette.pitch;
      case 'text': return 'none';
      default: return palette.surface;
    }
  };

  const getElementStroke = (el: MapElement) => {
    if (el.hasBorder) return el.borderColor || palette.fg;
    if (el.type === 'label_area' || el.type === 'amenity') {
      return el.color || (el.type === 'amenity' ? mapPalette.amenityStroke : mapPalette.labelAreaStroke);
    }
    switch (el.type) {
      case 'house': return STATUS_META.available.stroke;
      case 'tower': return palette.fg;
      case 'road': return mapPalette.roadStroke;
      case 'green': return mapPalette.greenStroke;
      case 'pitch': return mapPalette.pitchStroke;
      case 'text': return isSelected(el.id) ? mapPalette.selection : 'none';
      default: return palette.lineStrong;
    }
  };

  const isSelected = (id: string) => selectedId === id;
  const selectedElement = elements.find(el => el.id === selectedId);
  const layerOrder: Record<string, number> = { 'reference_image': -2, 'green': -1, 'label_area': 0, 'road': 1, 'pitch': 2, 'amenity': 2, 'house': 3, 'tower': 3, 'text': 4 };
  const sortedElements = [...elements].sort((a, b) => (layerOrder[a.type] || 0) - (layerOrder[b.type] || 0));

  const updateSelectedElement = (updates: Partial<MapElement>) => {
    if (!selectedId) return;
    setElements(prev => prev.map(el => el.id === selectedId ? { ...el, ...updates } : el));
  };

  const handleSizeChange = (dim: 'w' | 'h', value: number) => {
    if (!selectedElement) return;
    const pts = getElementPoints(selectedElement);
    
    const minX = Math.min(...pts.map(p => p.x));
    const minY = Math.min(...pts.map(p => p.y));
    const maxX = Math.max(...pts.map(p => p.x));
    const maxY = Math.max(...pts.map(p => p.y));
    
    const currentW = maxX - minX;
    const currentH = maxY - minY;
    
    const scaleX = dim === 'w' ? value / currentW : 1;
    const scaleY = dim === 'h' ? value / currentH : 1;
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    const newPoints = pts.map(p => ({ 
      x: centerX + (p.x - centerX) * scaleX, 
      y: centerY + (p.y - centerY) * scaleY 
    }));
    
    updateSelectedElement({ 
      points: newPoints, 
      width: dim === 'w' ? value : selectedElement.width, 
      height: dim === 'h' ? value : selectedElement.height 
    });
  };

  const handleAddReferenceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const newElementId = 'ref-image-' + Math.random().toString(36).substr(2, 9);
    const newPoints = [
      { x: 0, y: 0 },
      { x: 800, y: 0 },
      { x: 800, y: 600 },
      { x: 0, y: 600 },
    ];

    const baseElement: MapElement = {
      id: newElementId,
      type: 'reference_image',
      label: 'صورة مرجعية',
      points: newPoints,
      rotation: 0,
      x: 0, y: 0, width: 800, height: 600,
      opacity: 0.5,
      locked: false,
      showInMain: false,
      isBold: false
    };

    if (storageScope && storageScopeId) {
      setIsUploadingImage(true);
      try {
        const imageUrl = await uploadMapImageFile(file, storageScope, storageScopeId, newElementId);
        const newElement = { ...baseElement, imageUrl };
        setElements(prev => [newElement, ...prev]);
        setSelectedId(newElement.id);
        showSuccess('تم رفع الصورة بنجاح');
      } catch (err) {
        console.error('Reference image upload failed:', err);
        showError('فشل رفع الصورة. تأكد من إعداد bucket map-images في Supabase.');
      } finally {
        setIsUploadingImage(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const url = evt.target?.result as string;
      const newElement: MapElement = { ...baseElement, color: url };
      setElements(prev => [newElement, ...prev]);
      setSelectedId(newElement.id);
    };
    reader.readAsDataURL(file);
  };

  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedElement) return;
    e.target.value = '';

    if (storageScope && storageScopeId) {
      setIsUploadingImage(true);
      try {
        const imageUrl = await uploadMapImageFile(file, storageScope, storageScopeId, selectedElement.id);
        updateSelectedElement({ imageUrl, color: undefined });
        showSuccess('تم استبدال الصورة بنجاح');
      } catch (err) {
        console.error('Reference image replace failed:', err);
        showError('فشل استبدال الصورة');
      } finally {
        setIsUploadingImage(false);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const url = evt.target?.result as string;
      updateSelectedElement({ color: url });
      showSuccess('تم استبدال الصورة بنجاح');
    };
    reader.readAsDataURL(file);
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

  // دوال مساعدة لتحديث مصفوفات المساحات عند تغيير عدد الشقق
  const handleApartmentsCountChange = (count: number) => {
    if (!selectedElement) return;
    const currentGround = selectedElement.groundFloorSizes || [];
    const currentTypical = selectedElement.typicalFloorSizes || [];
    
    const newGround = Array(count).fill(0).map((_, i) => currentGround[i] || 0);
    const newTypical = Array(count).fill(0).map((_, i) => currentTypical[i] || 0);
    
    updateSelectedElement({
      apartmentsPerFloor: count,
      groundFloorSizes: newGround,
      typicalFloorSizes: newTypical
    });
  };

  const handleGroundSizeChange = (index: number, val: number) => {
    if (!selectedElement) return;
    const current = [...(selectedElement.groundFloorSizes || Array(selectedElement.apartmentsPerFloor || 1).fill(0))];
    current[index] = val;
    updateSelectedElement({ groundFloorSizes: current });
  };

  const handleTypicalSizeChange = (index: number, val: number) => {
    if (!selectedElement) return;
    const current = [...(selectedElement.typicalFloorSizes || Array(selectedElement.apartmentsPerFloor || 1).fill(0))];
    current[index] = val;
    updateSelectedElement({ typicalFloorSizes: current });
  };

  // دالة لاستخراج صنف المنزل من الترميز (مثال: Z1-B2-D5 -> D)
  const getHouseType = (label: string): string => {
    if (!label) return '';
    const parts = label.split('-');
    const lastPart = parts[parts.length - 1] || '';
    const match = lastPart.match(/^([a-zA-Z]+)/);
    return match ? match[1].toUpperCase() : lastPart.toUpperCase();
  };

  // إضافة صنف قياسي جديد للمنازل
  const handleAddHouseTypeArea = () => {
    if (!newTypeName || !newTypeArea) {
      showError("يرجى إدخال اسم الصنف والمساحة");
      return;
    }
    const typeUpper = newTypeName.trim().toUpperCase();
    const areaNum = parseFloat(newTypeArea);
    if (isNaN(areaNum) || areaNum <= 0) {
      showError("يرجى إدخال مساحة صالحة");
      return;
    }
    setHouseTypeAreas(prev => ({
      ...prev,
      [typeUpper]: areaNum
    }));
    setNewTypeName('');
    setNewTypeArea('');
    showSuccess(`تمت إضافة الصنف القياسي ${typeUpper} بمساحة ${areaNum} م²`);
  };

  // حذف صنف قياسي للمنازل
  const handleDeleteHouseTypeArea = (type: string) => {
    const updated = { ...houseTypeAreas };
    delete updated[type];
    setHouseTypeAreas(updated);
    showSuccess(`تم حذف الصنف القياسي ${type}`);
  };

  return (
    <div className="flex h-screen flex-col gap-3 bg-background p-4">
      <div className="flex items-center justify-between gap-4 border border-line bg-surface px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex border border-line">
            <Button variant="ghost" size="icon" className="size-8 rounded-none" onClick={() => setScale(s => Math.min(s + 0.2, 5))}><ZoomIn size={15} /></Button>
            <Button variant="ghost" size="icon" className="size-8 rounded-none border-s border-line" onClick={() => setScale(s => Math.max(s - 0.2, 0.1))}><ZoomOut size={15} /></Button>
            <Button variant="ghost" size="icon" className="size-8 rounded-none border-s border-line" onClick={() => { setScale(1); setViewPos({x:0, y:0}); }}><RotateCcw size={15} /></Button>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-fg-faint">{Math.round(scale * 100)}%</span>
          <Button variant={gridLock ? "default" : "outline"} size="icon" className="size-8" onClick={() => setGridLock(!gridLock)}><Grid3X3 size={15} /></Button>
          <Button variant="outline" size="icon" className="size-8" onClick={() => setIsFullScreen(!isFullScreen)}>
            {isFullScreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </Button>
          <span className="ms-2 font-mono text-[11px] tabular-nums text-fg-faint">
            {dims.w} × {dims.h}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel}>
              إلغاء
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => onSave(elements, dims.w, dims.h, backgroundColor, showGrid, houseTypeAreas)}
            className="gap-1.5"
            disabled={isSaving}
          >
            {isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save size={13} />}
            {isSaving ? "جاري الحفظ" : "حفظ المخطط"}
          </Button>
        </div>
      </div>

      <div className="flex flex-1 gap-3 overflow-hidden">
        <div className="flex w-16 flex-col overflow-y-auto border border-line bg-surface no-scrollbar">
          <button onClick={() => { setActiveTool(null); setIsBrushMode(false); }} className={cn("flex aspect-square w-full flex-col items-center justify-center gap-1 border-b border-line transition-colors", !activeTool && !isBrushMode ? "bg-fg text-background" : "text-fg-muted hover:bg-surface-sunken hover:text-fg")}>
            <MousePointer2 size={16} />
            <span className="text-[9px]">تصفح</span>
          </button>
          {TOOLS.map((tool) => (
            <button key={tool.type} onClick={() => { setActiveTool(tool.type); setIsBrushMode(false); }} className={cn("relative flex aspect-square w-full flex-col items-center justify-center gap-1 border-b border-line transition-colors", activeTool === tool.type && !isBrushMode ? "bg-fg text-background" : "text-fg-muted hover:bg-surface-sunken hover:text-fg")}>
              <span className="absolute inset-x-0 top-0 h-[2px]" style={{ backgroundColor: tool.swatch }} />
              <tool.icon size={16} />
              <span className="text-[9px] leading-tight">{tool.label}</span>
            </button>
          ))}
          <button onClick={() => setIsBrushMode(!isBrushMode)} className={cn("flex aspect-square w-full flex-col items-center justify-center gap-1 border-b border-line transition-colors", isBrushMode ? "bg-fg text-background" : "text-fg-muted hover:bg-surface-sunken hover:text-fg")}>
            <Paintbrush size={16} />
            <span className="text-[9px]">فرشاة</span>
          </button>
          <label className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 text-fg-muted transition-colors hover:bg-surface-sunken hover:text-fg">
            <ImageIcon size={16} />
            <span className="text-[9px]">صورة</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleAddReferenceImage} />
          </label>
        </div>

        <div className="relative flex-1 touch-none overflow-hidden border border-line" style={{ backgroundColor: backgroundColor }}>
          <svg ref={svgRef} className={cn("w-full h-full", (isBrushMode || activeTool === 'map_boundary') ? "cursor-crosshair" : !activeTool ? "cursor-grab active:cursor-grabbing" : "cursor-crosshair")} onClick={handleCanvasClick} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel} style={{ backgroundColor: backgroundColor }}>
            <g ref={contentRef} style={{ transform: `translate(${viewPos.x}px, ${viewPos.y}px) scale(${scale})`, transformOrigin: '0 0' }}>
              <defs>
                <pattern id="grid-editor" width={GRID_SIZE * 5} height={GRID_SIZE * 5} patternUnits="userSpaceOnUse"><path d={`M ${GRID_SIZE * 5} 0 L 0 0 0 ${GRID_SIZE * 5}`} fill="none" stroke={mapPalette.gridStrong} strokeWidth="1" opacity="0.6"/></pattern>
                <pattern id="green-pattern" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill={mapPalette.green} /><path d="M 2 8 L 5 2 L 8 8" fill="none" stroke={mapPalette.greenStroke} strokeWidth="0.5" opacity="0.5" /></pattern>
                
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
              <rect id="map-background" width={dims.w} height={dims.h} fill={showGrid ? "url(#grid-editor)" : "transparent"} />
              
              {sortedElements.map((el) => {
                const pts = getElementPoints(el);
                const centerX = pts.reduce((sum, p) => sum + p.x, 0) / pts.length;
                const centerY = pts.reduce((sum, p) => sum + p.y, 0) / pts.length;
                const isSelectedEl = isSelected(el.id);
                const minY = Math.min(...pts.map(p => p.y));
                const minX = Math.min(...pts.map(p => p.x));
                const maxX = Math.max(...pts.map(p => p.x));
                const maxY = Math.max(...pts.map(p => p.y));
                const IconComponent = el.type === 'house' ? Home : el.type === 'tower' ? Building2 : null;

                if (el.type === 'reference_image') {
                  const refSrc = getReferenceImageSrc(el);
                  return (
                    <g key={el.id} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                      {refSrc && (
                      <image 
                        href={refSrc} 
                        x={minX} y={minY} 
                        width={maxX - minX} height={maxY - minY} 
                        opacity={el.opacity}
                        className={cn("transition-all", !el.locked && "cursor-move", isSelectedEl && "outline outline-2 outline-fg")}
                        onMouseDown={(e) => { 
                          setSelectedId(el.id); 
                          if (el.locked) return;
                          e.stopPropagation(); 
                          setDragMode({ type: 'move' }); 
                        }}
                      />
                      )}
                      {isSelectedEl && !el.locked && (
                        <>
                          {pts.map((p, i) => <circle key={`vertex-${i}`} cx={p.x} cy={p.y} r={6} className="cursor-pointer fill-surface stroke-fg stroke-2" onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'vertex', index: i }); }} />)}
                        </>
                      )}
                    </g>
                  );
                }

                const pathD = pointsToPath(pts, !el.isStroke);

                return (
                  <g key={el.id} transform={`rotate(${el.rotation || 0} ${centerX} ${centerY})`}>
                    <defs>
                      <clipPath id={`clip-editor-${el.id}`}>
                        <path d={pathD} />
                      </clipPath>
                    </defs>
                    
                    {el.type !== 'text' ? (
                      <>
                        <path 
                          d={pathD} 
                          fill={el.isStroke ? "none" : getElementColor(el)} 
                          stroke={el.isStroke ? getElementColor(el) : getElementStroke(el)} 
                          fillOpacity={el.type === 'label_area' ? el.opacity : 1} 
                          strokeWidth={el.isStroke ? el.strokeWidth : (['road', 'green'].includes(el.type) ? 10 : (isSelectedEl ? 3 : (el.hasBorder ? 4 : 2)))} 
                          strokeLinejoin="round"
                          strokeLinecap="round"
                          className={cn("transition-all cursor-move", isSelectedEl && "stroke-fg")} 
                          onMouseDown={(e) => { 
                            setSelectedId(el.id); 
                            if (!el.locked) {
                              e.stopPropagation(); 
                              setDragMode({ type: 'move' }); 
                            }
                          }} 
                        />
                        {el.hasTexture && (
                          <g clipPath={`url(#clip-editor-${el.id})`} style={{ color: el.textureColor || 'white' }}>
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
                        fill={el.textColor || palette.fg}
                        style={{
                          fontSize: `${el.fontSize || 24}px`,
                          fontFamily: el.fontFamily || canvasFont,
                          fontWeight: el.isBold ? 'bold' : 'normal',
                          cursor: 'move',
                          userSelect: 'none'
                        }}
                        onMouseDown={(e) => { 
                          setSelectedId(el.id); 
                          if (!el.locked) {
                            e.stopPropagation(); 
                            setDragMode({ type: 'move' }); 
                          }
                        }}
                      >
                        {el.label}
                      </text>
                    )}
                    
                    {el.type === 'pitch' && renderPitchLines(pts)}
                    {IconComponent && !el.hideIcon && <foreignObject x={centerX - 12} y={centerY - 18} width="24" height="24" pointerEvents="none"><div className="flex items-center justify-center w-full h-full"><IconComponent size={20} color={el.textColor || (el.type === 'tower' ? palette.accentFg : palette.fg)} strokeWidth={2.5}/></div></foreignObject>}
                    
                    {el.type === 'road' && !el.isStroke && (
                      el.orientation === 'vertical' ? 
                      <line x1={centerX} y1={minY} x2={centerX} y2={maxY} stroke={palette.surface} strokeWidth="2" strokeDasharray="10,10" opacity="0.6" /> :
                      <line x1={minX} y1={centerY} x2={maxX} y2={centerY} stroke={palette.surface} strokeWidth="2" strokeDasharray="10,10" opacity="0.6" />
                    )}

                    {el.label && el.type !== 'text' && <text x={el.type === 'label_area' ? (minX+maxX)/2 : centerX} y={el.type === 'label_area' ? minY - 10 : centerY + 15} textAnchor="middle" dominantBaseline="middle" fill={el.textColor || palette.fg} style={{ fontSize: `${el.fontSize || 10}px`, fontFamily: canvasFont, fontWeight: 600 }} className="pointer-events-none select-none">{el.label.split('-').pop()}</text>}
                    
                    {isSelectedEl && (
                      <>
                        {pts.map((p, i) => {
                          const nextP = pts[(i + 1) % pts.length];
                          const midX = (p.x + nextP.x) / 2;
                          const midY = (p.y + nextP.y) / 2;
                          return (
                            <g key={`midpoint-${i}`} className="cursor-pointer">
                              <circle 
                                cx={midX} 
                                cy={midY} 
                                r={5} 
                                className="fill-status-available stroke-surface stroke-2 transition-transform hover:scale-125" 
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  const newPoints = [...pts];
                                  newPoints.splice(i + 1, 0, { x: snap(midX), y: snap(midY) });
                                  updateSelectedElement({ points: newPoints });
                                  showSuccess("تم إضافة زاوية جديدة للشكل بنجاح");
                                }}
                              />
                            </g>
                          );
                        })}

                        {pts.map((p, i) => <circle key={`vertex-${i}`} cx={p.x} cy={p.y} r={6} className="cursor-pointer fill-surface stroke-fg stroke-2 transition-colors hover:fill-surface-sunken" onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'vertex', index: i }); }} onDoubleClick={(e) => { e.stopPropagation(); if (pts.length > 3) { const newPoints = pts.filter((_, idx) => idx !== i); updateSelectedElement({ points: newPoints }); showSuccess("تم حذف الزاوية المحددة"); } else { showError("لا يمكن حذف الزاوية، يجب بقاء 3 زوايا على الأقل للشكل"); } }} />)}
                        
                        <circle cx={centerX} cy={pts[0].y - 30} r={8} className="cursor-pointer fill-fg" onMouseDown={(e) => { e.stopPropagation(); setDragMode({ type: 'rotate' }); }} />
                      </>
                    )}
                  </g>
                );
              })}

              {tempPoints.length > 1 && (isBrushMode || activeTool === 'map_boundary') && (
                <path
                  d={pointsToPath(tempPoints, activeTool === 'map_boundary')}
                  fill={activeTool === 'map_boundary' ? "rgba(185, 86, 70, 0.08)" : "none"}
                  stroke={activeTool === 'map_boundary' ? mapPalette.highlight : (activeTool ? getElementColor({ type: activeTool } as any) : palette.fg)}
                  strokeWidth={activeTool === 'map_boundary' ? 2 : brushSize}
                  strokeDasharray={activeTool === 'map_boundary' ? "5,5" : "none"}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity="0.8"
                  pointerEvents="none"
                />
              )}
            </g>
          </svg>
        </div>

        <div className="w-80 flex flex-col gap-4 overflow-y-auto no-scrollbar h-full pb-10">
          {isBrushMode && (
            <div className="space-y-5 border border-line bg-surface p-5">
              <div className="flex items-center gap-2"><SlidersHorizontal size={14} className="text-fg-muted" /><h3 className="text-[13px] font-medium text-fg">إعدادات الفرشاة</h3></div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between items-center"><Label className="text-[11px] text-fg-muted">حجم الفرشاة</Label><span className="font-mono text-[11px] tabular-nums text-fg">{brushSize}px</span></div>
                  <Slider value={[brushSize]} min={10} max={200} step={5} onValueChange={(val) => setBrushSize(val[0])} className="py-4" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[11px] text-fg-muted">نوع العنصر</Label>
                  <Select value={activeTool || ''} onValueChange={(val) => setActiveTool(val as ElementType)}>
                    <SelectTrigger className=""><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                    <SelectContent>
                      {TOOLS.filter(t => ['road', 'green'].includes(t.type)).map(t => (
                        <SelectItem key={t.type} value={t.type}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {!selectedElement && (
            <div className="space-y-4">
              <div className="space-y-5 border border-line bg-surface p-5">
                <div className="flex items-center gap-2"><Settings2 size={14} className="text-fg-muted" /><h3 className="text-[13px] font-medium text-fg">خصائص المخطط</h3></div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-[11px] text-fg-muted">لون خلفية المخطط</Label>
                    <div className="flex gap-2">
                      <Input type="color" value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="w-11 cursor-pointer p-1" />
                      <Input value={backgroundColor} onChange={(e) => setBackgroundColor(e.target.value)} className="flex-1 font-mono text-[12px]" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between border border-line bg-surface-sunken p-4">
                    <div className="flex items-center gap-2">
                      <Grid3X3 size={14} className="text-fg-muted" />
                      <Label className="text-[12px] font-normal text-fg">إظهار شبكة المربعات</Label>
                    </div>
                    <Switch checked={showGrid} onCheckedChange={setShowGrid} />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-[11px] text-fg-muted">العرض الكلي</Label>
                      <Input type="number" value={dims.w} onChange={(e) => setDims(prev => ({ ...prev, w: parseInt(e.target.value) }))} className="" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-[11px] text-fg-muted">الارتفاع الكلي</Label>
                      <Input type="number" value={dims.h} onChange={(e) => setDims(prev => ({ ...prev, h: parseInt(e.target.value) }))} className="" />
                    </div>
                  </div>
                </div>
              </div>

              {/* واجهة إدخال مساحات أصناف المنازل القياسية */}
              <div className="space-y-5 border border-line bg-surface p-5">
                <div className="flex items-center gap-2">
                  <Ruler size={14} className="text-fg-muted" />
                  <h3 className="text-[13px] font-medium text-fg">مساحات أصناف المنازل</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-fg-muted">الصنف (مثال: D)</Label>
                      <Input 
                        value={newTypeName} 
                        onChange={(e) => setNewTypeName(e.target.value)} 
                        placeholder="D" 
                        className="text-center font-mono"
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-fg-muted">المساحة (م²)</Label>
                      <Input 
                        type="number"
                        step="any"
                        value={newTypeArea} 
                        onChange={(e) => setNewTypeArea(e.target.value)} 
                        placeholder="240" 
                        className="text-center font-mono"
                      />
                    </div>
                    <Button onClick={handleAddHouseTypeArea} className="self-end">
                      <Plus size={16} />
                    </Button>
                  </div>

                  <ScrollArea className="h-40 border border-line">
                    <div className="space-y-1">
                      {Object.entries(houseTypeAreas).map(([type, area]) => (
                        <div key={type} className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]">
                          <span className="text-fg-secondary">صنف <strong className="font-medium text-fg">{type}</strong></span>
                          <span className="font-mono text-[11px] tabular-nums text-fg">{area} م²</span>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteHouseTypeArea(type)} className="size-6 text-fg-faint hover:text-status-sold">
                            <X size={12} />
                          </Button>
                        </div>
                      ))}
                      {Object.keys(houseTypeAreas).length === 0 && (
                        <p className="py-10 text-center text-[11px] text-fg-faint">لا توجد أصناف قياسية مضافة</p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            </div>
          )}

          {selectedElement && (
            <div className="flex flex-col overflow-hidden border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <div className="flex items-center gap-2"><Settings2 size={14} className="text-fg-muted" /><h3 className="text-[13px] font-medium text-fg">خصائص العنصر</h3></div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedId(null)} className="text-fg-faint hover:text-fg"><X size={18} /></Button>
              </div>
              <div className="flex-1 space-y-6 overflow-y-auto p-5 no-scrollbar">
                <div className="space-y-4">
                  {projects && projects.length > 0 && (
                    <div className="space-y-2 border border-line bg-surface-sunken p-4">
                      <Label className="text-[11px] text-fg-muted">ربط كزر انتقال بمشروع</Label>
                      <Select 
                        value={selectedElement.linkProjectId || 'none'} 
                        onValueChange={(val) => updateSelectedElement({ linkProjectId: val === 'none' ? undefined : val })}
                      >
                        <SelectTrigger className="">
                          <SelectValue placeholder="اختر المشروع للربط..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-fg-muted">بدون ربط (عنصر عادي)</SelectItem>
                          {projects.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="mt-1 text-[10px] leading-relaxed text-fg-faint">عند تفعيل هذا الخيار، سيتحول العنصر بالموقع لزر ينقل الزائر للمشروع فوراً.</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between border border-line bg-surface-sunken p-4">
                    <div className="flex items-center gap-2">
                      {selectedElement.locked ? <Lock size={14} className="text-status-sold" /> : <Unlock size={14} className="text-status-available" />}
                      <Label className="text-[12px] font-normal text-fg">قفل العنصر</Label>
                    </div>
                    <Switch checked={selectedElement.locked} onCheckedChange={(val) => updateSelectedElement({ locked: val })} />
                  </div>

                  <div className="space-y-2"><Label className="text-[11px] text-fg-muted">{selectedElement.type === 'text' ? 'محتوى النص' : 'تسمية العنصر'}</Label><Input value={selectedElement.label} onChange={(e) => updateSelectedElement({ label: e.target.value })} className="" /></div>
                  
                  {/* واجهة إدخال المساحة المخصصة للمنزل يدوياً */}
                  {selectedElement.type === 'house' && (
                    <div className="space-y-2 border border-line bg-surface-sunken p-4">
                      <Label className="flex items-center gap-1.5 text-[11px] text-fg-muted">
                        <Ruler size={14} /> المساحة المخصصة يدوياً (م²)
                      </Label>
                      <Input 
                        type="number" 
                        step="any"
                        value={selectedElement.customArea || ''} 
                        onChange={(e) => updateSelectedElement({ customArea: parseFloat(e.target.value) || undefined })} 
                        placeholder="مثال: 263.5"
                        className="" 
                      />
                      {(() => {
                        const type = getHouseType(selectedElement.label);
                        const stdArea = houseTypeAreas[type];
                        return stdArea ? (
                          <p className="mt-1 text-[10px] text-fg-secondary">
                            المساحة القياسية الحالية لهذا الصنف ({type}): {stdArea} م²
                          </p>
                        ) : (
                          <p className="mt-1 text-[10px] text-fg-faint">
                            لا توجد مساحة قياسية محددة للصنف ({type || 'غير محدد'})
                          </p>
                        );
                      })()}
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label className="text-[11px] text-fg-muted">زاوية الدوران (درجة)</Label>
                    <div className="relative">
                      <RotateCw className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-fg-faint" />
                      <Input 
                        type="number" 
                        value={Math.round(selectedElement.rotation || 0)} 
                        onChange={(e) => updateSelectedElement({ rotation: parseInt(e.target.value) })} 
                        className="ps-9" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-[11px] text-fg-muted">حجم الخط</Label>
                    <Input type="number" value={selectedElement.fontSize || (selectedElement.type === 'text' ? 24 : 10)} onChange={(e) => updateSelectedElement({ fontSize: parseInt(e.target.value) })} className="" />
                  </div>

                  <div className="flex items-center justify-between border border-line bg-surface-sunken p-4">
                    <div className="flex items-center gap-2">
                      {selectedElement.hideIcon ? <EyeOff size={14} className="text-fg-faint" /> : <Eye size={14} className="text-fg-muted" />}
                      <Label className="text-[12px] font-normal text-fg">إخفاء اللوغو/الأيقونة</Label>
                    </div>
                    <Switch checked={selectedElement.hideIcon} onCheckedChange={(val) => updateSelectedElement({ hideIcon: val })} />
                  </div>

                  {(selectedElement.type === 'tower' || selectedElement.type === 'house' || selectedElement.type === 'label_area' || selectedElement.type === 'amenity') && (
                    <div className="space-y-4 border border-line bg-surface-sunken p-4">
                      <div className="flex items-center gap-2 mb-2"><Palette size={14} className="text-fg-muted" /><Label className="text-[12px] font-normal text-fg">الألوان والمظهر</Label></div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-fg-muted">لون العنصر</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={selectedElement.color || '#1e293b'} onChange={(e) => updateSelectedElement({ color: e.target.value })} className="w-11 cursor-pointer p-1" />
                          <Input value={selectedElement.color || '#1e293b'} onChange={(e) => updateSelectedElement({ color: e.target.value })} className="flex-1 font-mono text-[12px]" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-fg-muted">لون النص / الأيقونة</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={selectedElement.textColor || '#ffffff'} onChange={(e) => updateSelectedElement({ textColor: e.target.value })} className="w-11 cursor-pointer p-1" />
                          <Input value={selectedElement.textColor || '#ffffff'} onChange={(e) => updateSelectedElement({ textColor: e.target.value })} className="flex-1 font-mono text-[12px]" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-4 border border-line bg-surface-sunken p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Layers size={14} className="text-fg-muted" /><Label className="text-[12px] font-normal text-fg">الحدود والـ Texture</Label></div>
                    </div>
                    
                    <div className="space-y-4 pt-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[12px] text-fg-secondary">تفعيل الحدود</Label>
                        <Switch checked={selectedElement.hasBorder} onCheckedChange={(val) => updateSelectedElement({ hasBorder: val })} />
                      </div>
                      {selectedElement.hasBorder && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                          <Label className="text-[11px] text-fg-muted">لون الحدود</Label>
                          <div className="flex gap-2">
                            <Input type="color" value={selectedElement.borderColor || '#000000'} onChange={(e) => updateSelectedElement({ borderColor: e.target.value })} className="w-10 cursor-pointer p-1" />
                            <Input value={selectedElement.borderColor || '#000000'} onChange={(e) => updateSelectedElement({ borderColor: e.target.value })} className="flex-1 font-mono text-[12px]" />
                          </div>
                        </div>
                      )}

                      <div className="my-2 h-px bg-line" />

                      <div className="flex items-center justify-between">
                        <Label className="text-[12px] text-fg-secondary">تفعيل الـ Texture</Label>
                        <Switch checked={selectedElement.hasTexture} onCheckedChange={(val) => updateSelectedElement({ hasTexture: val })} />
                      </div>
                      {selectedElement.hasTexture && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
                          <div className="space-y-2">
                            <Label className="text-[11px] text-fg-muted">نوع المظهر</Label>
                            <Select value={selectedElement.textureType || 'glass'} onValueChange={(val) => updateSelectedElement({ textureType: val })}>
                              <SelectTrigger className="h-8 text-[12px]"><SelectValue placeholder="اختر المظهر" /></SelectTrigger>
                              <SelectContent>
                                {TEXTURE_TYPES.map(t => (<SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[11px] text-fg-muted">لون المظهر</Label>
                            <div className="flex gap-2">
                              <Input type="color" value={selectedElement.textureColor || '#ffffff'} onChange={(e) => updateSelectedElement({ textureColor: e.target.value })} className="w-10 cursor-pointer p-1" />
                              <Input value={selectedElement.textureColor || '#ffffff'} onChange={(e) => updateSelectedElement({ textureColor: e.target.value })} className="flex-1 font-mono text-[12px]" />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center"><Label className="text-[11px] text-fg-muted">حجم المظهر</Label><span className="font-mono text-[11px] tabular-nums text-fg">{selectedElement.textureSize || 1}x</span></div>
                            <Slider value={[selectedElement.textureSize || 1]} min={0.1} max={5} step={0.1} onValueChange={(val) => updateSelectedElement({ textureSize: val[0] })} className="py-2" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {selectedElement.type === 'text' && (
                    <>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-fg-muted">نوع الخط</Label>
                        <Select value={selectedElement.fontFamily || 'Arial'} onValueChange={(val) => updateSelectedElement({ fontFamily: val })}>
                          <SelectTrigger className=""><SelectValue placeholder="اختر الخط" /></SelectTrigger>
                          <SelectContent>
                            {FONT_FAMILIES.map(f => (<SelectItem key={f.id} value={f.id}>{f.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between border border-line bg-surface-sunken p-4">
                        <div className="flex items-center gap-2"><Bold size={14} className="text-fg-muted" /><Label className="text-[12px] font-normal text-fg">خط عريض</Label></div>
                        <Switch checked={selectedElement.isBold} onCheckedChange={(val) => updateSelectedElement({ isBold: val })} />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-fg-muted">لون النص</Label>
                        <div className="flex gap-2">
                          <Input type="color" value={selectedElement.textColor || '#000000'} onChange={(e) => updateSelectedElement({ textColor: e.target.value })} className="w-11 cursor-pointer p-1" />
                          <Input value={selectedElement.textColor || '#000000'} onChange={(e) => updateSelectedElement({ textColor: e.target.value })} className="flex-1 font-mono text-[12px]" />
                        </div>
                      </div>
                    </>
                  )}

                  {selectedElement.type === 'label_area' && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center"><Label className="text-[11px] text-fg-muted">الشفافية</Label><span className="font-mono text-[11px] tabular-nums text-fg">{Math.round((selectedElement.opacity || 0.2) * 100)}%</span></div>
                      <Slider value={[(selectedElement.opacity || 0.2) * 100]} min={0} max={100} step={1} onValueChange={(val) => updateSelectedElement({ opacity: val[0] / 100 })} className="py-4" />
                    </div>
                  )}

                  {selectedElement.type === 'reference_image' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] text-fg-muted">استبدال الصورة</Label>
                        <label className={cn(
                          "flex h-10 w-full cursor-pointer appearance-none items-center justify-center border border-dashed border-line px-4 transition-colors hover:border-line-strong focus:outline-none",
                          isUploadingImage && "pointer-events-none opacity-50",
                        )}>
                          <span className="flex items-center space-x-2 rtl:space-x-reverse">
                            {isUploadingImage ? <Loader2 size={14} className="animate-spin text-fg-muted" /> : <RefreshCcw size={14} className="text-fg-muted" />}
                            <span className="text-[12px] text-fg-secondary">{isUploadingImage ? 'جاري رفع الصورة...' : 'اختر صورة جديدة'}</span>
                          </span>
                          <input type="file" accept="image/*" className="hidden" onChange={handleReplaceImage} disabled={isUploadingImage} />
                        </label>
                      </div>
                      <div className="flex items-center justify-between border border-line bg-surface-sunken p-4">
                        <div className="flex items-center gap-2"><ImageIcon size={14} className="text-fg-muted" /><Label className="text-[12px] font-normal text-fg">إظهار في الواجهة الرئيسية</Label></div>
                        <Switch checked={selectedElement.showInMain} onCheckedChange={(val) => updateSelectedElement({ showInMain: val })} />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center"><Label className="text-[11px] text-fg-muted">الشفافية</Label><span className="font-mono text-[11px] tabular-nums text-fg">{Math.round((selectedElement.opacity || 0.5) * 100)}%</span></div>
                        <Slider value={[(selectedElement.opacity || 0.5) * 100]} min={0} max={100} step={1} onValueChange={(val) => updateSelectedElement({ opacity: val[0] / 100 })} className="py-4" />
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'road' && (
                    <div className="space-y-2">
                      <Label className="text-[11px] text-fg-muted">اتجاه خطوط السير</Label>
                      <Select value={selectedElement.orientation || 'horizontal'} onValueChange={(val) => updateSelectedElement({ orientation: val as 'horizontal' | 'vertical' })}>
                        <SelectTrigger className=""><SelectValue placeholder="اختر الاتجاه" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="horizontal">أفقي</SelectItem>
                          <SelectItem value="vertical">عمودي</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedElement.type === 'tower' && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><Label className="text-[11px] text-fg-muted">عدد الطوابق</Label><Input type="number" value={selectedElement.floors} onChange={(e) => updateSelectedElement({ floors: parseInt(e.target.value) })} className="" /></div>
                        <div className="space-y-2"><Label className="text-[11px] text-fg-muted">شقق/طابق</Label><Input type="number" value={selectedElement.apartmentsPerFloor} onChange={(e) => handleApartmentsCountChange(parseInt(e.target.value))} className="" /></div>
                      </div>

                      {/* واجهة إدخال مساحات الشقق للطابق الأرضي والمتكرر */}
                      <div className="space-y-4 border border-line bg-surface-sunken p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Ruler size={14} className="text-fg-muted" />
                          <Label className="text-[12px] font-medium">مساحات شقق الطابق الأرضي (م²)</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {Array.from({ length: selectedElement.apartmentsPerFloor || 1 }).map((_, idx) => (
                            <div key={`ground-size-${idx}`} className="flex items-center gap-2 border border-line bg-surface px-2 py-1.5">
                              <span className="text-[11px] text-fg-muted">شقة {idx + 1}</span>
                              <Input 
                                type="number" 
                                step="any"
                                value={(selectedElement.groundFloorSizes || [])[idx] || 0} 
                                onChange={(e) => handleGroundSizeChange(idx, parseFloat(e.target.value) || 0)}
                                className="h-7 border-none p-1 text-center font-mono text-[12px] focus-visible:ring-0"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4 border border-line bg-surface-sunken p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Ruler size={14} className="text-fg-muted" />
                          <Label className="text-[12px] font-medium">مساحات شقق الطابق المتكرر (م²)</Label>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {Array.from({ length: selectedElement.apartmentsPerFloor || 1 }).map((_, idx) => (
                            <div key={`typical-size-${idx}`} className="flex items-center gap-2 border border-line bg-surface px-2 py-1.5">
                              <span className="text-[11px] text-fg-muted">شقة {idx + 1}</span>
                              <Input 
                                type="number" 
                                step="any"
                                value={(selectedElement.typicalFloorSizes || [])[idx] || 0} 
                                onChange={(e) => handleTypicalSizeChange(idx, parseFloat(e.target.value) || 0)}
                                className="h-7 border-none p-1 text-center font-mono text-[12px] focus-visible:ring-0"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {!selectedElement.isStroke && selectedElement.type !== 'text' && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-[11px] text-fg-muted">العرض (px)</Label>
                        <Input type="number" value={Math.round(Math.max(...getElementPoints(selectedElement).map(p => p.x)) - Math.min(...getElementPoints(selectedElement).map(p => p.x)))} onChange={(e) => handleSizeChange('w', parseInt(e.target.value))} className="" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[11px] text-fg-muted">الطول (px)</Label>
                        <Input type="number" value={Math.round(Math.max(...getElementPoints(selectedElement).map(p => p.y)) - Math.min(...getElementPoints(selectedElement).map(p => p.y)))} onChange={(e) => handleSizeChange('h', parseInt(e.target.value))} className="" />
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => handleDuplicate('right')} className="gap-1.5"><ArrowLeft size={16} /> تكرار يسار</Button>
                    <Button variant="outline" onClick={() => handleDuplicate('left')} className="gap-1.5"><ArrowRight size={16} /> تكرار يمين</Button>
                    <Button variant="outline" onClick={() => handleDuplicate('up')} className="gap-1.5"><ArrowUp size={16} /> تكرار أعلى</Button>
                    <Button variant="outline" onClick={() => handleDuplicate('down')} className="gap-1.5"><ArrowDown size={16} /> تكرار أسفل</Button>
                  </div>
                </div>
                <div className="border-t border-line pt-6"><Button variant="destructive" className="w-full gap-1.5" onClick={() => { setElements(prev => prev.filter(el => el.id !== selectedId)); setSelectedId(null); }}><Trash2 size={18} /> حذف العنصر</Button></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MapEditor;