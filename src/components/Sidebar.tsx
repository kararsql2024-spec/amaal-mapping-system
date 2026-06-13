"use client";

import React, { useMemo } from 'react';
import { Project } from '@/types/project';
import { 
  Layout, 
  BarChart3, 
  Home, 
  Building2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  TrendingUp,
  FileText,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SidebarProps {
  projects: Project[];
  selectedProjectId?: string;
  onSelectProject: (id: string) => void;
  housesData: Record<string, any>;
  permissions?: any;
}

const Sidebar = ({ projects, selectedProjectId, onSelectProject, housesData, permissions }: SidebarProps) => {
  const perms = permissions || {
    showGeneralStats: true,
    showSideTotal: true,
    showSideSold: true,
    showSideInvestment: true,
    showSideAvailable: true,
    showSidePromoted: true,
    showSideNotPromoted: true,
    showSideReceivedTabo: true,
    showSideReceivedUnit: true,
    showSideNotReceivedUnit: true
  };

  const stats = useMemo(() => {
    const currentProject = projects.find(p => p.id === selectedProjectId);
    if (!currentProject) return null;

    const elements = currentProject.elements || [];
    const houseElements = elements.filter(el => el.type === 'house');
    const towerElements = elements.filter(el => el.type === 'tower');

    let totalUnits = 0;
    let sold = 0;
    let investment = 0;
    let available = 0;
    let promoted = 0;
    let notPromoted = 0;
    let receivedTabo = 0;
    let receivedUnit = 0;
    let notReceivedUnit = 0;

    // حساب إحصائيات المنازل
    houseElements.forEach(h => {
      const data = housesData[h.id] || { status: 'available' };
      if (data.status === 'frozen_hidden') return;
      
      if (data.status !== 'frozen_uncounted') totalUnits++;
      
      if (data.status === 'sold') sold++;
      else if (data.status === 'investment') investment++;
      else if (data.status === 'available') available++;

      const tabo = data.taboStatus?.trim();
      if (tabo === 'مروج') promoted++;
      else if (tabo === 'مستلم') receivedTabo++;
      else notPromoted++;

      if (data.handoverDate) receivedUnit++;
      else notReceivedUnit++;
    });

    // حساب إحصائيات الأبراج
    towerElements.forEach(t => {
      for (let f = 1; f <= (t.floors || 1); f++) {
        for (let a = 1; a <= (t.apartmentsPerFloor || 1); a++) {
          const key = `${t.id}_F${f}_A${a}`;
          const data = housesData[key] || { status: 'available' };
          if (data.status === 'frozen_hidden') continue;

          if (data.status !== 'frozen_uncounted') totalUnits++;

          if (data.status === 'sold') sold++;
          else if (data.status === 'investment') investment++;
          else if (data.status === 'available') available++;

          const tabo = data.taboStatus?.trim();
          if (tabo === 'مروج') promoted++;
          else if (tabo === 'مستلم') receivedTabo++;
          else notPromoted++;

          if (data.handoverDate) receivedUnit++;
          else notReceivedUnit++;
        }
      }
    });

    return { totalUnits, sold, investment, available, promoted, notPromoted, receivedTabo, receivedUnit, notReceivedUnit };
  }, [projects, selectedProjectId, housesData]);

  return (
    <aside className="w-80 bg-white border-l border-slate-100 flex flex-col shadow-xl z-20">
      <div className="p-6 bg-indigo-600 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <Layout size={24} />
          </div>
          <h1 className="text-xl font-black">نظام الإدارة</h1>
        </div>
        <p className="text-indigo-100 text-xs font-bold">إدارة الوحدات السكنية التفاعلي</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="space-y-2">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2">المشاريع المتاحة</h3>
            <div className="space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={cn(
                    "w-full p-3 rounded-xl text-right transition-all flex items-center gap-3 group",
                    selectedProjectId === project.id 
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-100" 
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                    selectedProjectId === project.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-200"
                  )}>
                    <Building2 size={16} />
                  </div>
                  <span className="font-bold text-sm">{project.name}</span>
                </button>
              ))}
            </div>
          </div>

          {perms.showGeneralStats && stats && (
            <>
              <Separator className="bg-slate-100" />
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2 flex items-center gap-2">
                  <BarChart3 size={12} /> إحصائيات المشروع
                </h3>
                
                <div className="grid grid-cols-1 gap-2">
                  {perms.showSideTotal && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-slate-200 rounded-lg flex items-center justify-center text-slate-600"><Home size={16} /></div>
                        <span className="text-xs font-bold text-slate-600">إجمالي الوحدات</span>
                      </div>
                      <span className="font-black text-slate-800">{stats.totalUnits}</span>
                    </div>
                  )}

                  {perms.showSideSold && (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-rose-500 rounded-lg flex items-center justify-center text-white"><CheckCircle2 size={16} /></div>
                        <span className="text-xs font-bold text-rose-700">المباعة</span>
                      </div>
                      <span className="font-black text-rose-700">{stats.sold}</span>
                    </div>
                  )}

                  {perms.showSideInvestment && (
                    <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white"><TrendingUp size={16} /></div>
                        <span className="text-xs font-bold text-purple-700">الاستثمار</span>
                      </div>
                      <span className="font-black text-purple-700">{stats.investment}</span>
                    </div>
                  )}

                  {perms.showSideAvailable && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center text-white"><Clock size={16} /></div>
                        <span className="text-xs font-bold text-emerald-700">المتاحة</span>
                      </div>
                      <span className="font-black text-emerald-700">{stats.available}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase px-2">موقف الطابو</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {perms.showSidePromoted && (
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><FileText size={10} /> مروج</span>
                        <span className="text-[10px] font-black text-indigo-600">{stats.promoted}</span>
                      </div>
                    )}
                    {perms.showSideReceivedTabo && (
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><ShieldCheck size={10} /> مستلم</span>
                        <span className="text-[10px] font-black text-emerald-600">{stats.receivedTabo}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase px-2">استلام الوحدات</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {perms.showSideReceivedUnit && (
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><Calendar size={10} /> مستلم الوحدة</span>
                        <span className="text-[10px] font-blacktext-sky-600">{stats.receivedUnit}</span>
                      </div>
                    )}
                    {perms.showSideNotReceivedUnit && (
                      <div className="flex items-center justify-between px-2">
                        <span className="text-[10px] font-bold text-slate-500 flex items-center gap-1"><AlertCircle size={10} /> غير مستلم</span>
                        <span className="text-[10px] font-black text-rose-400">{stats.notReceivedUnit}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    </aside>
  );
};

export default Sidebar;