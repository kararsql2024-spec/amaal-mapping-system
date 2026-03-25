export type ElementType = 'house' | 'tower' | 'road' | 'green' | 'amenity';

export interface MapElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: ElementType;
  label: string;
  rotation?: number; // زاوية الدوران بالدرجات
  floors?: number;
  apartmentsPerFloor?: number;
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