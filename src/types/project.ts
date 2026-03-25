export type ElementType = 'house' | 'tower' | 'road' | 'green' | 'amenity';

export interface Apartment {
  id: string;
  number: string;
  floor: number;
  status: 'available' | 'sold' | 'pending' | 'reserved';
  details?: any;
}

export interface MapElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: ElementType;
  label: string;
  // بيانات خاصة بالبرج
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