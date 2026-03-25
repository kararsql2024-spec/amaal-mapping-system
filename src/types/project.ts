export interface MapElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  type: 'house' | 'facility';
  label: string;
  status: 'available' | 'sold' | 'pending';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  elements: MapElement[];
  createdAt: string;
}