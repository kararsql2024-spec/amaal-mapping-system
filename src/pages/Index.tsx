"use client";

import React, { useState, useEffect } from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import UnitDetailsModal from '@/components/UnitDetailsModal';
import TowerDetailsModal from '@/components/TowerDetailsModal';
import { showSuccess, showError } from '@/utils/toast';
import { Map as MapIcon, ChevronDown, Store, Lock, LogOut } from 'lucide-react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Project } from '@/types/project';
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  // حالة تسجيل دخول المركز التسويقي
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [marketingCenters, setMarketingCenters] = useState<any[]>([]);
  const [loginData, setLoginData] = useState({ centerId: '', password: '' });

  useEffect(() => {
    const fetchCenters = async () => {
      const { data } = await supabase.from('marketing_centers').select('*');
      if (data) setMarketingCenters(data);
    };
    fetchCenters();

    // التحقق من وجود جلسة سابقة في التخزين المحلي
    const savedCenter = localStorage.getItem('marketing_center_session');
    if (savedCenter) setIsLoggedIn(true);
  }, []);

  const handleLogin = () => {
    const center = marketingCenters.find(c => c.id === loginData.centerId);
    if (center && center.password === loginData.password) {
      setIsLoggedIn(true);
      localStorage.setItem('marketing_center_session', center.id);
      showSuccess(`مرحباً بك في مركز ${center.name}`);
    } else {
      showError("بيانات الدخول غير صحيحة");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem('marketing_center_session');
  };

  const activeProject = projects.find(p => p.id === selectedProjectId);
  const selectedElement = activeProject?.elements.find(el => el.id === selectedElementId);

  const handleElementClick = (id: string) => {
    setSelectedElementId(id);
    const element = activeProject?.elements.find(el => el.id === id);
    if (element?.type === 'tower') setIsTowerModalOpen(true);
    else setIsUnitModalOpen(true);
  };

  const handleSaveData = async (key: string, data: any) => {
    if (!selectedProjectId) return;

    try {
      const { error } = await supabase
        .from('houses_data')
        .upsert({ 
          unit_key: key, 
          project_id: selectedProjectId, 
          data: data 
        }, { onConflict: 'unit_key' });

      if (error) throw error;

      setHousesData(prev => ({ ...prev, [key]: data }));
      showSuccess(`تم تحديث البيانات بنجاح`);
    } catch (error) {
      console.error("Error saving unit data:", error);
      showError("فشل في حفظ البيانات");
    }
  };

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

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-100 mx-auto mb-6">
              <Store className="text-white w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">دخول المراكز التسويقية</h1>
            <p className="text-slate-500 font-medium mt-2">يرجى اختيار المركز وإدخال كلمة المرور</p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 mr-2">المركز التسويقي</label>
              <Select onValueChange={(val) => setLoginData({...loginData, centerId: val})}>
                <SelectTrigger className="rounded-2xl h-14 border-slate-200 font-bold">
                  <SelectValue placeholder="اختر المركز التسويقي..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {marketingCenters.map(center => (
                    <SelectItem key={center.id} value={center.id} className="text-right font-bold">{center.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 mr-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-4 text-slate-400 w-5 h-5" />
                <Input 
                  type="password" 
                  placeholder="أدخل كلمة المرور..." 
                  className="pr-12 rounded-2xl h-14 border-slate-200 font-bold"
                  value={loginData.password}
                  onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                />
              </div>
            </div>

            <Button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 rounded-2xl h-14 text-lg font-black shadow-lg shadow-blue-100">
              دخول للنظام
            </Button>
          </div>
          
          <div className="mt-8 pt-6 border-t border-slate-50">
            <MadeWithDyad />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200"><MapIcon className="text-white w-8 h-8" /></div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">نظام ادارة الوحدات السكنية التفاعلي</h1>
              <p className="text-slate-500 font-medium">خريطة تفاعلية للمخطط السكني</p>
            </div>
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
            <Button variant="ghost" onClick={handleLogout} className="rounded-xl text-rose-500 hover:bg-rose-50 gap-2">
              <LogOut size={18} /> خروج
            </Button>
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