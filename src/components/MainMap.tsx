"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Project } from '@/types/project';
import { cn } from "@/lib/utils";
import { MapPin, ZoomIn, ZoomOut, Maximize } from 'lucide-react';

interface MainMapProps {
  projects: Project[];
  onProjectSelect: (projectId: string) => void;
  mainMapConfig?: {
    elements: any[];
    width: number;
    height: number;
  };
}

const MainMap = ({ projects, onProjectSelect, mainMapConfig }: MainMapProps) => {
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const mapWidth = mainMapConfig?.width || 1200;
  const mapHeight = mainMapConfig?.height || 800;

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(prev => Math.min(Math.max(prev * delta, 0.5), 5));
    }
  };

  const resetView = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div className="relative w-full bg-slate-900 rounded-[2.5rem] overflow-hidden shadow-2xl border-8 border-white h-[700px] group">
      <div 
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div 
          className="transition-transform duration-75 ease-out origin-center"
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
            width: mapWidth,
            height: mapHeight
          }}
        >
          {/* خلفية المخطط العام */}
          <div className="absolute inset-0 bg-slate-800/50 rounded-3xl border-4 border-slate-700/30 flex items-center justify-center">
             <div className="text-slate-600 font-black text-6xl opacity-10 select-none">المخطط العام للمشاريع</div>
          </div>

          {/* عناصر المشاريع التفاعلية */}
          {mainMapConfig?.elements?.map((el: any) => {
            const project = projects.find(p => p.id === el.projectId);
            if (!project) return null;

            return (
              <div
                key={el.id}
                className="absolute cursor-pointer group/item"
                style={{
                  left: el.x,
                  top: el.y,
                  width: el.width || 150,
                  height: el.height || 100,
                }}
                onClick={() => onProjectSelect(project.id)}
              >
                <div className="w-full h-full bg-blue-600/20 border-2 border-blue-500/50 rounded-2xl backdrop-blur-sm group-hover/item:bg-blue-500/40 group-hover/item:border-blue-400 transition-all flex flex-col items-center justify-center p-4 text-center">
                  <MapPin className="text-blue-400 mb-2 group-hover/item:scale-125 transition-transform" size={24} />
                  <span className="text-white font-black text-sm drop-shadow-md">{project.name}</span>
                </div>
              </div>
            );
          })}

          {/* في حال عدم وجود عناصر مرسومة، نعرض المشاريع كأزرار افتراضية */}
          {(!mainMapConfig?.elements || mainMapConfig.elements.length === 0) && projects.map((p, idx) => (
            <div
              key={p.id}
              className="absolute cursor-pointer group/item"
              style={{
                left: 100 + (idx % 3) * 300,
                top: 100 + Math.floor(idx / 3) * 200,
                width: 250,
                height: 150,
              }}
              onClick={() => onProjectSelect(p.id)}
            >
              <div className="w-full h-full bg-white/10 border-2 border-white/20 rounded-[2rem] backdrop-blur-md group-hover/item:bg-blue-600 group-hover/item:border-blue-400 transition-all flex flex-col items-center justify-center p-6 text-center shadow-xl">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center mb-3 shadow-lg">
                  <MapPin className="text-white" size={24} />
                </div>
                <span className="text-white font-black text-lg">{p.name}</span>
                <span className="text-blue-300 text-xs font-bold mt-1">اضغط للدخول</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* أدوات التحكم */}
      <div className="absolute bottom-8 right-8 flex flex-col gap-2">
        <button onClick={() => setZoom(prev => Math.min(prev + 0.2, 5))} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-all"><ZoomIn size={20} /></button>
        <button onClick={() => setZoom(prev => Math.max(prev - 0.2, 0.5))} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-all"><ZoomOut size={20} /></button>
        <button onClick={resetView} className="w-12 h-12 bg-white rounded-2xl shadow-xl flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-all"><Maximize size={20} /></button>
      </div>

      <div className="absolute top-8 left-8 bg-black/40 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/10">
        <p className="text-white font-black flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          المخطط التفاعلي العام
        </p>
      </div>
    </div>
  );
};

export default MainMap;