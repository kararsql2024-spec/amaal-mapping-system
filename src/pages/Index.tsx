"use client";

import React from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import HouseDetailsModal from '@/components/HouseDetailsModal';
import { showSuccess } from '@/utils/toast';
import { Map as MapIcon, LayoutGrid, List, Settings } from 'lucide-react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Index = () => {
  const [selectedHouseId, setSelectedHouseId] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [housesData, setHousesData] = React.useState<Record<string, any>>({});

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
      showSuccess(`تم حفظ تفاصيل العقار #${selectedHouseId} بنجاح`);
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
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
              <button className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl shadow-sm text-blue-600 font-bold transition-all">
                <LayoutGrid className="w-4 h-4" />
                <span>عرض الخريطة</span>
              </button>
              <button className="flex items-center gap-2 px-4 py-2 text-slate-500 font-bold hover:bg-white/50 rounded-xl transition-all">
                <List className="w-4 h-4" />
                <span>قائمة العقارات</span>
              </button>
            </div>
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
            <div className="bg-white p-4 rounded-[2.5rem] shadow-xl border border-slate-100">
              <InteractiveMap 
                onHouseClick={handleHouseClick} 
                selectedHouseId={selectedHouseId}
                housesData={housesData}
              />
            </div>
          </div>

          {/* Stats/Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
              <h3 className="text-xl font-bold mb-6 text-slate-800">إحصائيات المخطط</h3>
              <div className="space-y-4">
                <StatItem label="إجمالي الوحدات" value="8" color="bg-blue-500" />
                <StatItem 
                  label="الوحدات المباعة" 
                  value={Object.values(housesData).filter(h => h.status === 'sold').length.toString()} 
                  color="bg-rose-500" 
                />
                <StatItem 
                  label="الوحدات المتاحة" 
                  value={(8 - Object.values(housesData).filter(h => h.status === 'sold').length).toString()} 
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