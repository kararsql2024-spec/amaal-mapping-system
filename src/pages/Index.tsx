"use client";

import React, { useState } from 'react';
import { Project } from '@/types/project';
import InteractiveMap from '@/components/InteractiveMap';
import { Building2, Home, Map as MapIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IndexProps {
  projects: Project[];
  housesData: Record<string, any>;
  setHousesData: (data: any) => void;
}

const Index = ({ projects, housesData, setHousesData }: IndexProps) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id || null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const activeProject = projects.find(p => p.id === selectedProjectId);

  const handleElementClick = (id: string) => {
    setSelectedElementId(id);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-black text-slate-900">نظام إدارة الوحدات</h1>
            <p className="text-slate-500 font-bold mt-2">استعرض المخططات التفاعلية وحالة الوحدات</p>
          </div>
          <div className="flex gap-2 bg-white p-2 rounded-2xl shadow-sm border">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProjectId(p.id)}
                className={cn(
                  "px-6 py-3 rounded-xl font-bold transition-all",
                  selectedProjectId === p.id ? "bg-indigo-600 text-white shadow-lg" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {activeProject ? (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3">
              <InteractiveMap 
                elements={activeProject.elements} 
                onHouseClick={handleElementClick} 
                selectedHouseId={selectedElementId} 
                housesData={housesData} 
                mapWidth={activeProject.mapWidth} 
                mapHeight={activeProject.mapHeight}
                centerX={activeProject.centerX}
                centerY={activeProject.centerY}
              />
            </div>
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-xl font-black mb-4 flex items-center gap-2">
                  <Info className="text-indigo-600" /> تفاصيل الوحدة
                </h3>
                {selectedElementId ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-sm text-slate-400 font-bold">رقم الوحدة</p>
                      <p className="text-2xl font-black text-slate-900">{selectedElementId}</p>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl">
                      <p className="text-sm text-slate-400 font-bold">الحالة</p>
                      <p className="text-xl font-black text-indigo-600">
                        {housesData[selectedElementId]?.status || 'متوفر'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-400 font-bold text-center py-8">اختر وحدة من المخطط لعرض التفاصيل</p>
                )}
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
                <h3 className="text-xl font-black mb-4">دليل الألوان</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-emerald-500" />
                    <span className="font-bold text-slate-600">متوفر</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-rose-500" />
                    <span className="font-bold text-slate-600">مباع</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-amber-400" />
                    <span className="font-bold text-slate-600">محجوز</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-blue-500" />
                    <span className="font-bold text-slate-600">حجز أولي</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-40">
            <MapIcon className="w-20 h-20 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold text-2xl">يرجى اختيار مشروع لعرض المخطط</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Index;