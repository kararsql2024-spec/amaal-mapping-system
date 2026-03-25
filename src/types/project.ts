export type ElementType = 'house' | 'tower' | 'road' | 'green' | 'amenity' | 'label_area';

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
  color?: string; // للتحكم في لون مناطق التسمية
  opacity?: number; // للتحكم في شفافية مناطق التسمية
  floors?: number;
  apartmentsPerFloor?: number;
  x: number; 
  y: number;
  width: number;
  height: number;
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