export type ElementType = 'house' | 'tower' | 'road' | 'green' | 'amenity' | 'label_area' | 'pitch';

export interface Point {
  x: number;
  y: number;
}

export interface MapElement {
  id: string;
  type: ElementType;
  label: string;
  points: Point[];
  rotation: number;
  orientation?: 'horizontal' | 'vertical';
  color?: string; 
  textColor?: string; // الخاصية الجديدة
  opacity?: number; 
  floors?: number;
  apartmentsPerFloor?: number;
  x: number; 
  y: number;
  width: number;
  height: number;
  amenityType?: string;
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