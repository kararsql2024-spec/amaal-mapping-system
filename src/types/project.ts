export type ElementType = 'house' | 'tower' | 'road' | 'green' | 'amenity';

export interface MapElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: ElementType;
  label: string;
  status: 'available' | 'sold' | 'pending' | 'public';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  elements: MapElement[];
  createdAt: string;
}