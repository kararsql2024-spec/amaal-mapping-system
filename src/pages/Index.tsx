"use client";

import React, { useState } from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import HouseDetailsModal from '@/components/HouseDetailsModal';
import { showSuccess } from '@/utils/toast';
import { Map as MapIcon, LayoutGrid, List, Settings, ChevronDown } from 'lucide-react';
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
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    projects.length > 0 ? projects[0].id : null
  );
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const activeProject = projects.find(p => p.id === selectedProjectId);

  const handleHouseClick = (id: string) => {
    setSelectedHouseId(id);
    setIsModalOpen(true);
  };

  const handleSaveDetails = (data: any) => {
    if (selectedHouseId) {
      setHousesData(prev => ({
        ...prev,
        [selectedHouseId]: data
      }));
      showSuccess(`تم حفظ البيانات بنجاح`);
      setIsModalOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
              <MapIcon className="text-white w-8 h-8" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">نظام إدارة العقارات</h1>
              <p className="text-slate-500 font-medium">خريطة تفاعلية للمخطط السكني</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {projects.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl gap-2 border-slate-200 min-w-[160px]">
                    {activeProject?.name || "اختر المشروع"}
                    <ChevronDown size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  {projects.map(p => (
                    <DropdownMenuItem 
                      key={p.id} 
                      onClick={() => setSelectedProjectId(p.id)}
                      className="text-right font-bold"
                    >
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Link to="/admin">
              <Button variant="outline" className="rounded-xl gap-2 border-slate-200">
                <Settings size={18} />
                لوحة الإدارة
              </Button>
            </Link>
          </div>
        </header>

        {/* Main Content */}
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Map Section */}
          <div className="lg:col-span-2 space-y-4">
            {activeProject ? (
              <div className="bg-white p-4 rounded-[2.5rem] shadow-xl border border-slate-100">
                <InteractiveMap 
                  elements={activeProject.elements}
                  onHouseClick={handleHouseClick} 
                  selectedHouseId={selectedHouseId}
                  housesData={housesData}
                />
              </div>
            ) : (
              <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center">
                <MapIcon className="mx-auto mb-4 opacity-10" size={80} />
                <h2 className="text-xl font-bold text-slate-400">يرجى إنشاء مشروع من لوحة الإدارة أولاً</h2>
                <Link to="/admin" className="mt-4 inline-block text-blue-600 font-bold hover:underline">
                  انتقل للوحة الإدارة
                </Link>
              </div>
            )}
          </div>

          {/* Stats/Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
              <h3 className="text-xl font-bold mb-6 text-slate-800">إحصائيات {activeProject?.name || "المشروع"}</h3>
              <div className="space-y-4">
                <StatItem 
                  label="إجمالي الوحدات" 
                  value={activeProject?.elements.length.toString() || "0"} 
                  color="bg-blue-500" 
                />
                <StatItem 
                  label="الوحدات المباعة" 
                  value={activeProject?.elements.filter(el => housesData[el.id]?.status === 'sold').length.toString() || "0"} 
                  color="bg-rose-500" 
                />
                <StatItem 
                  label="الوحدات المتاحة" 
                  value={activeProject?.elements.filter(el => !housesData[el.id] || housesData[el.id]?.status === 'available').length.toString() || "0"} 
                  color="bg-emerald-500" 
                />
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden group">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">تحتاج مساعدة؟</h3>
                <p className="text-blue-100 text-sm mb-6">انقر على أي وحدة سكنية في الخريطة لتعديل بياناتها أو تحديث حالتها.</p>
                <button className="bg-white text-blue-600 px-6 py-3 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors">
                  تواصل مع الدعم
                </button>
              </div>
              <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700" />
            </div>
          </div>
        </main>

        <HouseDetailsModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleSaveDetails}
          houseId={selectedHouseId}
          initialData={selectedHouseId ? housesData[selectedHouseId] : undefined}
        />
        
        <MadeWithDyad />
      </div>
    </div>
  );
};

const StatItem = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
    <div className="flex items-center gap-3">
      <div className={`w-2 h-8 rounded-full ${color}`} />
      <span className="font-bold text-slate-600">{label}</span>
    </div>
    <span className="text-2xl font-black text-slate-800">{value}</span>
  </div>
);

export default Index;