export type ElementType = 'house' | 'tower' | 'road' | 'green' | 'amenity' | 'label_area' | 'pitch' | 'text' | 'reference_image';

export interface Point {
  y: number;
  x: number;
}

export interface MapElement {
  id: string;
  type: ElementType;
  label: string;
  points: Point[];
  rotation: number;
  orientation?: 'horizontal' | 'vertical';
  color?: string; 
  textColor?: string;
  opacity?: number; 
  hideIcon?: boolean;
  floors?: number;
  apartmentsPerFloor?: number;
  groundFloorSizes?: number[]; // مساحات شقق الطابق الأرضي
  typicalFloorSizes?: number[]; // مساحات شقق الطابق المتكرر
  x: number; 
  y: number;
  width: number;
  height: number;
  amenityType?: string;
  strokeWidth?: number;
  isStroke?: boolean;
  fontSize?: number;
  fontFamily?: string;
  locked?: boolean;
  showInMain?: boolean;
  isBold?: boolean;
  hasBorder?: boolean;
  borderColor?: string;
  hasTexture?: boolean;
  textureType?: string;
  textureColor?: string;
  textureSize?: number;
  linkProjectId?: string; // معرف المشروع السكني المرتبط بهذا العنصر كزر انتقال
}

export interface Project {
  id: string;
  name: string;
  description: string;
  elements: MapElement[];
  mapWidth: number;
  mapHeight: number;
  createdAt: string;
}