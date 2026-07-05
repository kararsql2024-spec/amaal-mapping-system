"use client";

import React, { useState, useEffect } from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import UnitDetailsModal from '@/components/UnitDetailsModal';
import TowerDetailsModal from '@/components/TowerDetailsModal';
import DetailedStatsTable from '@/components/DetailedStatsTable';
import { showSuccess, showError } from '@/utils/toast';
import { Map as MapIcon, ChevronDown, ChevronUp, Store, Lock, LogOut, Bell, Clock, Info, FileCheck, FileX, CheckCircle, Home as HomeIcon, XCircle, BarChart3, LayoutGrid } from 'lucide-react';
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
  const [showMainMap, setShowMainMap] = useState(true);
  const [mainMapConfig, setMainMapConfig] = useState<any>(null);
  const [activeElements, setActiveElements] = useState<MapElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isTowerModalOpen, setIsTowerModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(true);
  const [isProjectLoading, setIsProjectLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

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

  const filteredProjects = React.useMemo(() => {
    if (!currentCenter || !currentCenter.allowed_projects || currentCenter.allowed_projects.length === 0) return projects;
    return projects.filter(p => currentCenter.allowed_projects.includes(p.id));
  }, [projects, currentCenter]);

  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: centers } = await supabase.from('marketing_centers').select('*');
      if (centers) setMarketingCenters(centers);

      const { data: mainMap } = await supabase.from('settings').select('value').eq('key', 'main_map_config').single();
      if (mainMap?.value) setMainMapConfig(mainMap.value);

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
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      const fetchProjectData = async () => {
        setIsProjectLoading(true);
        setShowMainMap(false);
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

          const { data: lastUpdateSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'last_excel_update')
            .single();

          if (lastUpdateSetting?.value) {
            setLastUpdated(new Date(lastUpdateSetting.value));
          } else {
            setLastUpdated(null);
          }
          
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
  };

  const handleElementClick = (id: string) => {
    if (showMainMap) {
      const element = mainMapConfig.elements.find((el: any) => el.id === id);
      if (element && element.label) {
        const project = projects.find(p => p.name === element.label);
        if (project) {
          setSelectedProjectId(project.id);
          setShowMainMap(false);
        }
      }
      return;
    }

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
    if (showMainMap || !selectedProjectId || !activeElements) return { total: 0, sold: 0, investment: 0, promoted: 0, notPromoted: 0, receivedTabo: 0, receivedUnit: 0, notReceivedUnit: 0 };
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
      if (el.type === 'house') processUnit(housesData[el.id]);
      else if (el.type === 'tower') {
        for (let f = 1; f <= (el.floors || 0); f++) {
          for (let a = 1; a <= (el.apartmentsPerFloor || 0); a++) {
            processUnit(housesData[`${el.id}_F${f}_A${a}`]);
          }
        }
      }
    });
    return { total, sold, investment, promoted, notPromoted, receivedTabo, receivedUnit, notReceivedUnit };
  };

  const stats = calculateStats();

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
              <Select onValueChange={(val) => setLoginData({...loginData, centerId: val})}>
                <SelectTrigger className="rounded-2xl h-14 border-slate-200 font-bold"><SelectValue placeholder="اختر القسم..." /></SelectTrigger>
                <SelectContent className="rounded-xl">{marketingCenters.map(center => (<SelectItem key={center.id} value={center.id} className="text-right font-bold">{center.name}</SelectItem>))}</SelectContent>
              </Select>
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
            <div>
              <h1 className="text-2xl font-black text-slate-800">نظام ادارة الوحدات السكنية التفاعلي</h1>
              <div className="flex items-center gap-3 mt-1">
                <p className="text-slate-500 font-medium">خريطة تفاعلية للمخطط السكني</p>
                <span className="w-1 h-1 bg-slate-300 rounded-full" />
                <div className="flex items-center gap-1 text-blue-600 font-bold text-xs bg-blue-50 px-2 py-0.5 rounded-full"><Store size={12} />{currentCenter?.name}</div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button variant={showMainMap ? "default" : "outline"} onClick={() => { setShowMainMap(true); setSelectedProjectId(null); }} className={cn("rounded-xl gap-2", showMainMap && "bg-blue-600")}>
              <LayoutGrid size={18} /> المخطط العام
            </Button>
            {filteredProjects.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant={!showMainMap ? "default" : "outline"} className={cn("rounded-xl gap-2 border-slate-200 min-w-[160px]", !showMainMap && "bg-blue-600 text-white")}>
                    {showMainMap ? "اختر المشروع" : (filteredProjects.find(p => p.id === selectedProjectId)?.name || "اختر المشروع")}
                    <ChevronDown size={16} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="rounded-xl">
                  {filteredProjects.map(p => (
                    <DropdownMenuItem key={p.id} onClick={() => setSelectedProjectId(p.id)} className="text-right font-bold">{p.name}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button variant="ghost" onClick={handleLogout} className="rounded-xl text-rose-500 hover:bg-rose-50 gap-2"><LogOut size={18} /> خروج</Button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={cn("space-y-8", (permissions.showGeneralStats || permissions.showNotifications) && !showMainMap ? "lg:col-span-2" : "lg:col-span-3")}>
            {isProjectLoading ? (
              <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center flex flex-col items-center justify-center gap-4"><div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div><h2 className="text-xl font-bold text-slate-600">جاري تحميل بيانات المشروع...</h2></div>
            ) : showMainMap ? (
              mainMapConfig ? (
                <InteractiveMap elements={mainMapConfig.elements} onHouseClick={handleElementClick} housesData={{}} mapWidth={mainMapConfig.width} mapHeight={mainMapConfig.height} permissions={{...permissions, colorMode: 'default'}} />
              ) : (
                <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center"><MapIcon className="mx-auto mb-4 opacity-10" size={80} /><h2 className="text-xl font-bold text-slate-400">لم يتم إعداد المخطط العام بعد</h2></div>
              )
            ) : (
              <>
                <InteractiveMap elements={activeElements} onHouseClick={handleElementClick} selectedHouseId={selectedElementId} housesData={housesData} mapWidth={activeProject?.mapWidth || 1000} mapHeight={activeProject?.mapHeight || 800} permissions={permissions} />
                {permissions.showStatsTable && <DetailedStatsTable elements={activeElements} housesData={housesData} permissions={permissions} />}
              </>
            )}
          </div>

          {!showMainMap && (permissions.showGeneralStats || permissions.showNotifications) && (
            <div className="space-y-6">
              {permissions.showGeneralStats && (
                <div className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100">
                  <h3 className="text-xl font-bold mb-6 text-slate-800">إحصائيات {activeProject?.name}</h3>
                  <div className="space-y-4">
                    {permissions.showSideTotal && <StatItem label="إجمالي الوحدات" value={stats.total.toString()} color="bg-blue-500" />}
                    {permissions.showSideSold && <StatItem label="الوحدات المباعة" value={stats.sold.toString()} color="bg-rose-500" />}
                    {permissions.showSideInvestment && <StatItem label="وحدات الاستثمار" value={stats.investment.toString()} color="bg-purple-500" />}
                    {permissions.showSideAvailable && <StatItem label="الوحدات المتاحة" value={(stats.total - stats.sold - stats.investment).toString()} color="bg-emerald-500" />}
                  </div>
                </div>
              )}
              {permissions.showNotifications && (
                <div className={cn("bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 flex flex-col transition-all duration-500 overflow-hidden", isNotificationsOpen ? "h-[500px]" : "h-[88px]")}>
                  <div className="flex items-center justify-between mb-6 cursor-pointer shrink-0" onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}>
                    <div className="flex items-center gap-3"><h3 className="text-xl font-bold text-slate-800 flex items-center gap-2"><Bell className="text-blue-600" size={20} /> الإشعارات</h3><span className="bg-blue-50 text-blue-600 text-xs font-black px-3 py-1 rounded-full">{notifications.length}</span></div>
                    <div className="w-8 h-8 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">{isNotificationsOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</div>
                  </div>
                  <div className={cn("flex-1 min-h-0 transition-opacity duration-300", isNotificationsOpen ? "opacity-100" : "opacity-0 pointer-events-none")}>
                    <ScrollArea className="h-full w-full">
                      <div className="space-y-4 pr-4">
                        {notifications.map((notif) => (
                          <div key={notif.id} className="p-4 rounded-2xl border bg-slate-50 border-slate-100 text-slate-700 space-y-2">
                            <p className="text-sm font-bold leading-relaxed">{notif.message}</p>
                            <div className="flex items-center gap-2 text-[10px] font-black opacity-60"><Clock size={12} /> {new Date(notif.created_at).toLocaleString('ar-EG')}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        <UnitDetailsModal isOpen={isUnitModalOpen} onClose={() => setIsUnitModalOpen(false)} onSave={handleSaveData} unitId={selectedElementId} unitLabel={activeElements.find(el => el.id === selectedElementId)?.label} initialData={selectedElementId ? housesData[selectedElementId] : undefined} permissions={permissions} />
        <TowerDetailsModal isOpen={isTowerModalOpen} onClose={() => setIsTowerModalOpen(false)} tower={activeElements.find(el => el.id === selectedElementId)} housesData={housesData} onSaveApartment={handleSaveData} permissions={permissions} />
        <MadeWithDyad />
      </div>
    </div>
  );
};

const StatItem = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
    <div className="flex items-center gap-3"><div className={`w-2 h-8 rounded-full ${color}`} /><span className="font-bold text-slate-600 text-xs">{label}</span></div>
    <span className="text-xl font-black text-slate-800">{value}</span>
  </div>
);

export default Index;