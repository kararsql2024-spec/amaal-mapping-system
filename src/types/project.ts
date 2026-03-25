export type ElementType = 'house' | 'tower' | 'road' | 'green' | 'amenity';

export interface Point {
  x: number;
  y: number;
}

export interface MapElement {
  id: string;
  type: ElementType;
  label: string;
  points: Point[]; // مصفوفة نقاط تشكل المضلع
  rotation: number;
  // بيانات إضافية للأبراج
  floors?: number;
  apartmentsPerFloor?: number;
  // للحفاظ على التوافق مع الكود القديم مؤقتاً أو للعمليات الحسابية
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