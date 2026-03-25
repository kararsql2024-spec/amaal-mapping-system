"use client";

import React, { useState } from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import UnitDetailsModal from '@/components/UnitDetailsModal';
import TowerDetailsModal from '@/components/TowerDetailsModal';
import { showSuccess } from '@/utils/toast';
import { Map as MapIcon, Settings, ChevronDown } from 'lucide-react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Project } from '@/types/project';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface IndexProps {
  projects: Project[];
  housesData: Record<string, any>;
  setHousesData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const Index = ({ projects, housesData, setHousesData }: IndexProps) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects.length > 0 ? projects[0].id : null);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isTowerModalOpen, setIsTowerModalOpen] = useState(false);

  const activeProject = projects.find(p => p.id === selectedProjectId);
  const selectedElement = activeProject?.elements.find(el => el.id === selectedElementId);

  const handleElementClick = (id: string) => {
    setSelectedElementId(id);
    const element = activeProject?.elements.find(el => el.id === id);
    if (element?.type === 'tower') setIsTowerModalOpen(true);
    else setIsUnitModalOpen(true);
  };

  const handleSaveData = (key: string, data: any) => {
    setHousesData(prev => ({ ...prev, [key]: data }));
    showSuccess(`تم تحديث البيانات بنجاح`);
  };

  // حساب الإحصائيات مع مراعاة التجميد
  const calculateStats = () => {
    if (!activeProject) return { total: 0, sold: 0 };
    
    let total = 0;
    let sold = 0;

    activeProject.elements.forEach(el => {
      if (el.type === 'house') {
        const data = housesData[el.id];
        if (data?.status !== 'frozen_uncounted') total++;
        if (data?.status === 'sold') sold++;
      } else if (el.type === 'tower') {
        const floors = el.floors || 0;
        const aptsPerFloor = el.apartmentsPerFloor || 0;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            const key = `${el.id}_F${f}_A${a}`;
            const data = housesData[key];
            if (data?.status !== 'frozen_uncounted') total++;
            if (data?.status === 'sold') sold++;
          }
        }
      }
    });

    return { total, sold };
  };

  const stats = calculateStats();

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200"><MapIcon className="text-white w-8 h-8" /></div>
            <div><h1 className="text-2xl font-black text-slate-800">نظام إدارة العقارات</h1><p className="text-slate-500 font-medium">خريطة تفاعلية للمخطط السكني</p></div>
          </div>
          <div className="flex items-center gap-4">
            {projects.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl gap-2 border-slate-200 min-w-[160px]">{activeProject?.name || "اختر المشروع"}<ChevronDown size={16} /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  {projects.map(p => (<DropdownMenuItem key={p.id} onClick={() => setSelectedProjectId(p.id)} className="text-right font-bold">{p.name}</DropdownMenuItem>))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Link to="/admin"><Button variant="outline" className="rounded-xl gap-2 border-slate-200"><Settings size={18} />لوحة الإدارة</Button></Link>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            {activeProject ? (
              <InteractiveMap 
                elements={activeProject.elements}
                onHouseClick={handleElementClick} 
                selectedHouseId={selectedElementId}
                housesData={housesData}
                mapWidth={activeProject.mapWidth}
                mapHeight={activeProject.mapHeight}
              />
            ) : (
              <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center"><MapIcon className="mx-auto mb-4 opacity-10" size={80} /><h2 className="text-xl font-bold text-slate-400">يرجى إنشاء مشروع أولاً</h2></div>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
              <h3 className="text-xl font-bold mb-6 text-slate-800">إحصائيات {activeProject?.name}</h3>
              <div className="space-y-4">
                <StatItem label="إجمالي الوحدات" value={stats.total.toString()} color="bg-blue-500" />
                <StatItem label="الوحدات المباعة" value={stats.sold.toString()} color="bg-rose-500" />
                <StatItem label="الوحدات المتاحة" value={(stats.total - stats.sold).toString()} color="bg-emerald-500" />
              </div>
            </div>
          </div>
        </main>

        <UnitDetailsModal 
          isOpen={isUnitModalOpen}
          onClose={() => setIsUnitModalOpen(false)}
          onSave={(data) => handleSaveData(selectedElementId!, data)}
          unitId={selectedElementId}
          unitLabel={selectedElement?.label}
          initialData={selectedElementId ? housesData[selectedElementId] : undefined}
        />

        <TowerDetailsModal 
          isOpen={isTowerModalOpen}
          onClose={() => setIsTowerModalOpen(false)}
          tower={selectedElement}
          housesData={housesData}
          onSaveApartment={handleSaveData}
        />
        
        <MadeWithDyad />
      </div>
    </div>
  );
};

const StatItem = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
    <div className="flex items-center gap-3"><div className={`w-2 h-8 rounded-full ${color}`} /><span className="font-bold text-slate-600">{label}</span></div>
    <span className="text-2xl font-black text-slate-800">{value}</span>
  </div>
);

export default Index;