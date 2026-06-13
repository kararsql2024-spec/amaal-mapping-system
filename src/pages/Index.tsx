"use client";

import React, { useState, useEffect } from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import UnitDetailsModal from '@/components/UnitDetailsModal';
import TowerDetailsModal from '@/components/TowerDetailsModal';
import DetailedStatsTable from '@/components/DetailedStatsTable';
import { showSuccess, showError } from '@/utils/toast';
import { Map as MapIcon, ChevronDown, ChevronUp, Store, Lock, LogOut, Bell, Clock, Info, FileCheck, FileX, CheckCircle, Home as HomeIcon, XCircle, BarChart3 } from 'lucide-react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Project, MapElement } from '@/types/project';
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface IndexProps {
  projects: Project[];
  housesData: Record<string, any>;
  setHousesData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const Index = ({ projects, housesData, setHousesData }: IndexProps) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeElements, setActiveElements] = useState<MapElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isTowerModalOpen, setIsTowerModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(true);
  const [isProjectLoading, setIsProjectLoading] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [marketingCenters, setMarketingCenters] = useState<any[]>([]);
  const [loginData, setLoginData] = useState({ centerId: '', password: '' });
  const [currentCenter, setCurrentCenter] = useState<any>(null);
  const [permissions, setPermissions] = useState<any>({
    showPrice: true,
    showCustomerName: true,
    showCustomerPhone: true,
    showTaboInfo: true,
    showHandoverInfo: true,
    showStatsTable: true,
    showGeneralStats: true,
    showSideTotal: true,
    showSideSold: true,
    showSideInvestment: true,
    showSideAvailable: true,
    showSidePromoted: true,
    showSideNotPromoted: true,
    showSideReceivedTabo: true,
    showSideReceivedUnit: true,
    showSideNotReceivedUnit: true,
    showNotifications: true,
    colorMode: 'default',
    showStatusField: true,
    canEditUnitData: false,
    showOtherDeptsNotes: true,
    canDeleteNotes: false
  });

  // فلترة المشاريع بناءً على إعدادات القسم المباشرة
  const filteredProjects = React.useMemo(() => {
    if (!currentCenter || !currentCenter.allowed_projects || currentCenter.allowed_projects.length === 0) return projects;
    return projects.filter(p => currentCenter.allowed_projects.includes(p.id));
  }, [projects, currentCenter]);

  useEffect(() => {
    if (filteredProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(filteredProjects[0].id);
    } else if (filteredProjects.length > 0 && selectedProjectId && !filteredProjects.find(p => p.id === selectedProjectId)) {
      setSelectedProjectId(filteredProjects[0].id);
    }
  }, [filteredProjects, selectedProjectId]);

  useEffect(() => {
    const fetchCentersAndPermissions = async () => {
      const { data: centers } = await supabase.from('marketing_centers').select('*');
      if (centers) setMarketingCenters(centers);

      const savedCenterId = localStorage.getItem('marketing_center_session');
      if (savedCenterId && centers) {
        const center = centers.find(c => c.id === savedCenterId);
        if (center) {
          setCurrentCenter(center);
          setIsLoggedIn(true);
          localStorage.setItem('marketing_center_name', center.name);
          
          const { data: settings } = await supabase.from('settings').select('*').eq('key', 'dept_permissions').single();
          if (settings && settings.value && center.type) {
            const deptPerms = settings.value[center.type];
            if (deptPerms) setPermissions(deptPerms);
          }
        }
      }
    };
    fetchCentersAndPermissions();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      const fetchProjectData = async () => {
        setIsProjectLoading(true);
        try {
          const { data: projectDetails, error: projectError } = await supabase
            .from('projects')
            .select('elements')
            .eq('id', selectedProjectId)
            .single();
          
          if (projectError) throw projectError;
          setActiveElements(projectDetails?.elements || []);

          const { data: notifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('project_id', selectedProjectId)
            .order('created_at', { ascending: false })
            .limit(50);
          if (notifs) setNotifications(notifs);

          let allUnits: any[] = [];
          let from = 0;
          const step = 1000;
          let hasMore = true;

          while (hasMore) {
            const { data: chunk, error: unitsError } = await supabase
              .from('houses_data')
              .select('*')
              .eq('project_id', selectedProjectId)
              .range(from, from + step - 1);
            
            if (unitsError) throw unitsError;
            
            if (!chunk || chunk.length === 0) {
              hasMore = false;
            } else {
              allUnits = [...allUnits, ...chunk];
              from += step;
              if (chunk.length < step) hasMore = false;
            }
          }
          
          const formattedUnits: Record<string, any> = {};
          allUnits.forEach(u => {
            formattedUnits[u.unit_key] = u.data;
          });
          setHousesData(formattedUnits);
          
          checkExpiredBookings(allUnits, selectedProjectId);
          
        } catch (error) {
          console.error("Error loading project data:", error);
          showError("فشل في تحميل بيانات المشروع");
        } finally {
          setIsProjectLoading(false);
        }
      };
      fetchProjectData();
    }
  }, [selectedProjectId, setHousesData]);

  const checkExpiredBookings = async (units: any[], projectId: string) => {
    const now = new Date();
    const expiredUnits: any[] = [];
    const expiredNotifications: any[] = [];

    units.forEach(unit => {
      if (unit.data?.status === 'pending' && unit.data?.saleDate) {
        const bookingDate = new Date(unit.data.saleDate);
        const diffTime = Math.abs(now.getTime() - bookingDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 7) {
          expiredUnits.push({
            unit_key: unit.unit_key,
            project_id: projectId,
            data: { ...unit.data, status: 'available', name: '', phone: '', saleDate: '', details: 'انتهى الحجز التلقائي' }
          });
          
          expiredNotifications.push({
            project_id: projectId,
            message: `انتهى الحجز الأولي للوحدة ${unit.unit_key} لعدم تحويلها لمباع خلال 7 أيام.`
          });
        }
      }
    });

    if (expiredUnits.length > 0) {
      await supabase.from('houses_data').upsert(expiredUnits, { onConflict: 'unit_key' });
      await supabase.from('notifications').insert(expiredNotifications);
      
      setHousesData(prev => {
        const next = { ...prev };
        expiredUnits.forEach(u => { next[u.unit_key] = u.data; });
        return next;
      });
      
      const { data: newNotifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (newNotifs) setNotifications(newNotifs);
    }
  };

  const handleLogin = async () => {
    const center = marketingCenters.find(c => c.id === loginData.centerId);
    if (center && center.password === loginData.password) {
      setIsLoggedIn(true);
      setCurrentCenter(center);
      localStorage.setItem('marketing_center_session', center.id);
      localStorage.setItem('marketing_center_name', center.name);
      
      const { data: settings } = await supabase.from('settings').select('*').eq('key', 'dept_permissions').single();
      if (settings && settings.value && center.type) {
        const deptPerms = settings.value[center.type];
        if (deptPerms) setPermissions(deptPerms);
      }
      
      showSuccess(`مرحباً بك في قسم ${center.name}`);
    } else {
      showError("بيانات الدخول غير صحيحة");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentCenter(null);
    localStorage.removeItem('marketing_center_session');
    localStorage.removeItem('marketing_center_name');
    setPermissions({
      showPrice: true,
      showCustomerName: true,
      showCustomerPhone: true,
      showTaboInfo: true,
      showHandoverInfo: true,
      showStatsTable: true,
      showGeneralStats: true,
      showSideTotal: true,
      showSideSold: true,
      showSideInvestment: true,
      showSideAvailable: true,
      showSidePromoted: true,
      showSideNotPromoted: true,
      showSideReceivedTabo: true,
      showSideReceivedUnit: true,
      showSideNotReceivedUnit: true,
      showNotifications: true,
      colorMode: 'default',
      showStatusField: true,
      canEditUnitData: false,
      showOtherDeptsNotes: true,
      canDeleteNotes: false
    });
  };

  const activeProject = filteredProjects.find(p => p.id === selectedProjectId);
  const selectedElement = activeElements.find(el => el.id === selectedElementId);

  const handleElementClick = (id: string) => {
    setSelectedElementId(id);
    const element = activeElements.find(el => el.id === id);
    if (element?.type === 'tower') setIsTowerModalOpen(true);
    else setIsUnitModalOpen(true);
  };

  const handleSaveData = async (key: string, data: any) => {
    if (!selectedProjectId) return;
    try {
      await supabase.from('houses_data').upsert({ unit_key: key, project_id: selectedProjectId, data: data }, { onConflict: 'unit_key' });
      setHousesData(prev => ({ ...prev, [key]: data }));
      showSuccess(`تم تحديث البيانات بنجاح`);
    } catch (error) { showError("فشل في حفظ البيانات"); }
  };

  const calculateStats = () => {
    if (!activeProject || !activeElements) return { total: 0, sold: 0, investment: 0, promoted: 0, notPromoted: 0, receivedTabo: 0, receivedUnit: 0, notReceivedUnit: 0 };
    let total = 0; let sold = 0; let investment = 0;
    let promoted = 0; let notPromoted = 0; let receivedTabo = 0;
    let receivedUnit = 0; let notReceivedUnit = 0;

    const processUnit = (data: any) => {
      if (data?.status === 'frozen_hidden') return;
      
      if (data?.status !== 'frozen_uncounted') total++;
      if (data?.status === 'sold') sold++;
      if (data?.status === 'investment') investment++;

      const tabo = data?.taboStatus?.trim();
      if (tabo === 'مروج') promoted++;
      else if (tabo === 'مستلم') receivedTabo++;
      else notPromoted++;

      if (data?.handoverDate) receivedUnit++;
      else notReceivedUnit++;
    };

    activeElements.forEach(el => {
      if (el.type === 'house') {
        processUnit(housesData[el.id]);
      } else if (el.type === 'tower') {
        const floors = el.floors || 0;
        const aptsPerFloor = el.apartmentsPerFloor || 0;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            processUnit(housesData[`${el.id}_F${f}_A${a}`]);
          }
        }
      }
    });
    return { total, sold, investment, promoted, notPromoted, receivedTabo, receivedUnit, notReceivedUnit };
  };

  const stats = calculateStats();

  const getNotificationColor = (message: string) => {
    if (message.includes('مباع') || message.includes('بيع')) return 'bg-rose-50 border-rose-100 text-rose-700';
    if (message.includes('استثمار')) return 'bg-purple-50 border-purple-100 text-purple-700';
    if (message.includes('متوفر') || message.includes('انتهى الحجز')) return 'bg-blue-50 border-blue-100 text-blue-700';
    return 'bg-slate-50 border-slate-100 text-slate-700';
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-100 mx-auto mb-6"><Store className="text-white w-10 h-10" /></div>
            <h1 className="text-2xl font-black text-slate-800">دخول الأقسام</h1>
            <p className="text-slate-500 font-medium mt-2">يرجى اختيار القسم وإدخال كلمة المرور</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 mr-2">القسم</label>
              <div className="relative">
                <Select onValueChange={(val) => setLoginData({...loginData, centerId: val})}>
                  <SelectTrigger className="rounded-2xl h-14 border-slate-200 font-bold"><SelectValue placeholder="اختر القسم..." /></SelectTrigger>
                  <SelectContent className="rounded-xl">{marketingCenters.map(center => (<SelectItem key={center.id} value={center.id} className="text-right font-bold">{center.name}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 mr-2">كلمة المرور</label>
              <div className="relative"><Lock className="absolute right-4 top-4 text-slate-400 w-5 h-5" /><Input type="password" placeholder="أدخل كلمة المرور..." className="pr-12 rounded-2xl h-14 border-slate-200 font-bold" value={loginData.password} onChange={(e) => setLoginData({...loginData, password: e.target.value})} /></div>
            </div>
            <Button onClick={handleLogin} className="w-full bg-blue-600 hover:bg-blue-700 rounded-2xl h-14 text-lg font-black shadow-lg shadow-blue-100">دخول للنظام</Button>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-50"><MadeWithDyad /></div>
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
            <div><h1 className="text-2xl font-black text-slate-800">نظام ادارة الوحدات السكنية التفاعلي</h1><p className="text-slate-500 font-medium">خريطة تفاعلية للمخطط السكني</p></div>
          </div>
          <div className="flex items-center gap-4">
            {filteredProjects.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="rounded-xl gap-2 border-slate-200 min-w-[160px]">
                    {activeProject?.name || "اختر المشروع"}
                    <ChevronDown size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  {filteredProjects.map(p => (
                    <DropdownMenuItem key={p.id} onClick={() => setSelectedProjectId(p.id)} className="text-right font-bold">
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="ghost" onClick={handleLogout} className="rounded-xl text-rose-500 hover:bg-rose-50 gap-2"><LogOut size={18} /> خروج</Button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={cn("space-y-8", (permissions.showGeneralStats || permissions.showNotifications) ? "lg:col-span-2" : "lg:col-span-3")}>
            {isProjectLoading ? (
              <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <h2 className="text-xl font-bold text-slate-600">جاري تحميل بيانات المشروع...</h2>
              </div>
            ) : activeProject ? (
              <>
                <InteractiveMap elements={activeElements} onHouseClick={handleElementClick} selectedHouseId={selectedElementId} housesData={housesData} mapWidth={activeProject.mapWidth} mapHeight={activeProject.mapHeight} permissions={permissions} />
                {permissions.showStatsTable && <DetailedStatsTable elements={activeElements} housesData={housesData} permissions={permissions} />}
              </>
            ) : (
              <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center"><MapIcon className="mx-auto mb-4 opacity-10" size={80} /><h2 className="text-xl font-bold text-slate-400">لا توجد مشاريع متاحة للعرض</h2></div>
            )}
          </div>

          {(permissions.showGeneralStats || permissions.showNotifications) && (
            <div className="space-y-6">
              {permissions.showGeneralStats && (
                <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
                  <h3 className="text-xl font-bold mb-6 text-slate-800">إحصائيات {activeProject?.name}</h3>
                  <div className="space-y-4">
                    {permissions.showSideTotal && <StatItem label="إجمالي الوحدات" value={stats.total.toString()} color="bg-blue-500" />}
                    {permissions.showSideSold && <StatItem label="الوحدات المباعة" value={stats.sold.toString()} color="bg-rose-500" />}
                    {permissions.showSideInvestment && <StatItem label="وحدات الاستثمار" value={stats.investment.toString()} color="bg-purple-500" />}
                    {permissions.showSideAvailable && <StatItem label="الوحدات المتاحة" value={(stats.total - stats.sold - stats.investment).toString()} color="bg-emerald-500" />}
                    
                    {(permissions.showSidePromoted || permissions.showSideNotPromoted || permissions.showSideReceivedTabo) && <div className="h-px bg-slate-100 my-4" />}
                    
                    {permissions.showSidePromoted && <StatItem label="مروج" value={stats.promoted.toString()} color="bg-indigo-500" icon={<FileCheck size={16} />} />}
                    {permissions.showSideNotPromoted && <StatItem label="غير مروج" value={stats.notPromoted.toString()} color="bg-slate-400" icon={<FileX size={16} />} />}
                    {permissions.showSideReceivedTabo && <StatItem label="مستلم الطابو" value={stats.receivedTabo.toString()} color="bg-amber-500" icon={<CheckCircle size={16} />} />}
                    
                    {(permissions.showSideReceivedUnit || permissions.showSideNotReceivedUnit) && <div className="h-px bg-slate-100 my-4" />}
                    
                    {permissions.showSideReceivedUnit && <StatItem label="مستلم الوحدة" value={stats.receivedUnit.toString()} color="bg-sky-500" icon={<HomeIcon size={16} />} />}
                    {permissions.showSideNotReceivedUnit && <StatItem label="غير مستلم الوحدة" value={stats.notReceivedUnit.toString()} color="bg-rose-300" icon={<XCircle size={16} />} />}
                  </div>
                </div>
              )}

              {permissions.showNotifications && (
                <div className={cn(
                  "bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 flex flex-col transition-all duration-500 ease-in-out overflow-hidden",
                  isNotificationsOpen ? "h-[500px]" : "h-[88px]"
                )}>
                  <div 
                    className="flex items-center justify-between mb-6 cursor-pointer select-none shrink-0"
                    onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  >
                    <div className="flex items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                        <Bell className="text-blue-600" size={20} /> الإشعارات
                      </h3>
                      <span className="bg-blue-50 text-blue-600 text-xs font-black px-3 py-1 rounded-full">{notifications.length}</span>
                    </div>
                    <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                      {isNotificationsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                  
                  <div className={cn(
                    "flex-1 min-h-0 transition-opacity duration-300",
                    isNotificationsOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}>
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-4 pr-4">
                        {notifications.length > 0 ? notifications.map((notif) => (
                          <div key={notif.id} className={cn("p-4 rounded-2xl border space-y-2 animate-in fade-in slide-in-from-right-2", getNotificationColor(notif.message))}>
                            <p className="text-sm font-bold leading-relaxed">{notif.message}</p>
                            <div className="flex items-center gap-2 text-[10px] font-black opacity-60 uppercase">
                              <Clock size={12} /> {new Date(notif.created_at).toLocaleString('ar-EG')}
                            </div>
                          </div>
                        )) : (
                          <div className="flex flex-col items-center justify-center h-40 text-slate-400 space-y-2">
                            <Info size={40} className="opacity-20" />
                            <p className="font-bold">لا توجد إشعارات حالياً</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        <UnitDetailsModal 
          isOpen={isUnitModalOpen} 
          onClose={() => setIsUnitModalOpen(false)} 
          onSave={handleSaveData} 
          unitId={selectedElementId} 
          unitLabel={activeElements.find(el => el.id === selectedElementId)?.label} 
          initialData={selectedElementId ? housesData[selectedElementId] : undefined}
          permissions={permissions}
        />
        <TowerDetailsModal 
          isOpen={isTowerModalOpen} 
          onClose={() => setIsTowerModalOpen(false)} 
          tower={activeElements.find(el => el.id === selectedElementId)} 
          housesData={housesData} 
          onSaveApartment={handleSaveData}
          permissions={permissions}
        />
        <MadeWithDyad />
      </div>
    </div>
  );
};

const StatItem = ({ label, value, color, icon }: { label: string, value: string, color: string, icon?: React.ReactNode }) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
    <div className="flex items-center gap-3">
      <div className={`w-2 h-8 rounded-full ${color}`} />
      <div className="flex flex-col">
        <span className="font-bold text-slate-600 text-xs flex items-center gap-1">
          {icon} {label}
        </span>
      </div>
    </div>
    <span className="text-xl font-black text-slate-800">{value}</span>
  </div>
);

export default Index;