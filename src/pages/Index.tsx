"use client";

import React, { useState, useEffect, useRef } from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import UnitDetailsModal from '@/components/UnitDetailsModal';
import TowerDetailsModal from '@/components/TowerDetailsModal';
import DetailedStatsTable from '@/components/DetailedStatsTable';
import DiagnosticTerminal from '@/components/DiagnosticTerminal';
import { showSuccess, showError } from '@/utils/toast';
import { 
  Map as MapIcon, ChevronDown, ChevronUp, Store, Lock, LogOut, Bell, 
  Clock, Info, FileCheck, FileX, CheckCircle, Home as HomeIcon, XCircle, 
  BarChart3, MapPin, Search, RefreshCcw, X, AlertTriangle, Ruler, Trash2
} from 'lucide-react';
import { MadeWithDyad } from "@/components/made-with-dyad";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Project, MapElement } from '@/types/project';
import { supabase } from "@/integrations/supabase/client";
import { Link } from 'react-router-dom';
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

const fetchWithRetry = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 1) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(fn, retries - 1, delay * 1.5);
  }
};

// جالب أصلي ومباشر خفيف لتجنب مشاكل مكتبة Supabase JS مع البيانات الضخمة
const fetchNativeSupabase = async (path: string) => {
  const supabaseUrl = "https://byvzmxrvetgcxstlsszd.supabase.co";
  const supabaseKey = (supabase as any).supabaseKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ5dnpteHJ2ZXRnY3hzdGxzc3pkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0MjU0OTUsImV4cCI6MjA5MDAwMTQ5NX0.Fv3e4bLYBPO94GmU_dT2TG5Ata41eaTgVOcI2iQFl3s";
  const url = `${supabaseUrl}/rest/v1/${path}`;
  
  const response = await fetch(url, {
    headers: {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Accept': 'application/json'
    }
  });
  if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
  return await response.json();
};

const Index = ({ projects, housesData, setHousesData }: IndexProps) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeElements, setActiveElements] = useState<MapElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);
  const [isTowerModalOpen, setIsTowerModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(true);
  const [isProjectLoading, setIsProjectLoading] = useState(false);

  // سجل التشخيصات فقط دون وجود لوب FPS ثقيل يعيد رندرة الصفحة الرئيسية
  const [diagLogs, setDiagLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'warn' | 'success' | 'danger' }>>([]);

  // حالات تسجيل الدخول والأقسام
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [marketingCenters, setMarketingCenters] = useState<any[]>([]);
  const [loginData, setLoginData] = useState({ centerId: '', password: '' });
  const [currentCenter, setCurrentCenter] = useState<any>(null);
  
  const [mainMapData, setMainMapData] = useState<any>(null);
  const [projectConfigs, setProjectConfigs] = useState<Record<string, { backgroundColor?: string, showGrid?: boolean, houseTypeAreas?: Record<string, number> }>>({});

  // متغيرات تصفية الخريطة التفاعلية والتوهج
  const [mapFilterZone, setMapFilterZone] = useState<string>('all');
  const [mapFilterClass, setMapFilterClass] = useState<string>('all');
  const [mapFilterSize, setMapFilterSize] = useState<string>('all');
  const [mapFilterStatus, setMapFilterStatus] = useState<string>('all');

  // متغيرات البحث والآخر تحديث المضافين بشكل مخصص
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState<{ projectId: string; elementId: string; isTower: boolean; apartmentKey?: string | null } | null>(null);

  const [searchProjectFilter, setSearchProjectFilter] = useState<string>('all');
  const [searchLimit, setSearchLimit] = useState<number>(10);
  const [pendingApartmentKey, setPendingApartmentKey] = useState<string | null>(null);

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
    showSearchBox: true,
    showQuickPreview: true,
    canAccessReports: true,
    showDiagnosticTerminal: true,
    showBrochureButton: true
  });

  const addDiagLog = (message: string, type: 'info' | 'warn' | 'success' | 'danger' = 'info') => {
    const time = new Date().toLocaleTimeString('ar-EG', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setDiagLogs(prev => [{ time, message, type }, ...prev.slice(0, 49)]);
  };

  const filteredProjects = React.useMemo(() => {
    if (!currentCenter || !currentCenter.allowed_projects || currentCenter.allowed_projects.length === 0) return projects;
    return projects.filter(p => currentCenter.allowed_projects.includes(p.id));
  }, [projects, currentCenter]);

  const activeProject = React.useMemo(() => {
    return filteredProjects.find(p => p.id === selectedProjectId);
  }, [filteredProjects, selectedProjectId]);

  const selectedElement = activeElements.find(el => el.id === selectedElementId);

  const expiringSoonBookings = React.useMemo(() => {
    if (selectedProjectId === 'main_map' || !activeProject) return [];
    const soon: any[] = [];
    const now = new Date();

    const checkUnit = (key: string, label: string) => {
      const data = housesData[key];
      if (data?.status === 'pending' && data?.saleDate) {
        const bookingDate = new Date(data.saleDate);
        const diffTime = now.getTime() - bookingDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        if (diffDays >= 5 && diffDays <= 7) {
          const daysLeft = (7 - diffDays).toFixed(1);
          soon.push({
            key,
            label,
            daysLeft,
            data
          });
        }
      }
    };

    activeElements.forEach(el => {
      if (el.type === 'house') {
        checkUnit(el.id, el.label);
      } else if (el.type === 'tower') {
        const floors = el.floors || 0;
        const aptsPerFloor = el.apartmentsPerFloor || 0;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            const key = `${el.id}_F${f}_A${a}`;
            
            let pCounter = 0;
            for (let f_idx = 1; f_idx <= floors; f_idx++) {
              for (let a_idx = 1; a_idx <= aptsPerFloor; a_idx++) {
                const innerKey = `${el.id}_F${f_idx}_A${a_idx}`;
                const innerData = housesData[innerKey];
                if (innerData?.status !== 'frozen_uncounted' && innerData?.status !== 'frozen_hidden') {
                  pCounter++;
                }
                if (f_idx === f && a_idx === a) {
                  const floorCode = f === 1 ? "FG" : `F${f - 1}`;
                  const aptCode = (innerData?.status === 'frozen_uncounted' || innerData?.status === 'frozen_hidden') ? "مجمدة" : `P${pCounter}`;
                  const label = `${el.label}-${floorCode}-${aptCode}`;
                  checkUnit(key, label);
                }
              }
            }
          }
        }
      }
    });

    return soon;
  }, [selectedProjectId, activeProject, activeElements, housesData]);

  const handleExtendBooking = async (key: string, currentData: any) => {
    if (!selectedProjectId) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLabel = new Date().toLocaleDateString('ar-EG');
    const updatedNotes = [...(currentData.notes || [])];
    
    updatedNotes.unshift({
      text: `قام القسم (${currentCenter?.name || 'مبيعات'}) بعمل تمديد يدوي للحجز الأولي لمدة 7 أيام إضافية تبدأ من تاريخ اليوم ${todayLabel}`,
      author: 'النظام تلقائياً',
      date: new Date().toISOString()
    });

    const updatedData = {
      ...currentData,
      saleDate: todayStr,
      notes: updatedNotes
    };

    try {
      await supabase.from('houses_data').upsert({ 
        unit_key: key, 
        project_id: selectedProjectId, 
        data: updatedData 
      }, { onConflict: 'unit_key' });

      await supabase.from('notifications').insert({
        project_id: selectedProjectId,
        message: `تم تمديد الحجز الأولي للوحدة ${key} بنجاح من قبل مركز ${currentCenter?.name || ''} لمدة 7 أيام إضافية.`
      });

      setHousesData(prev => ({ ...prev, [key]: updatedData }));
      showSuccess(`تم تمديد حجز الوحدة ${key} لمدة 7 أيام إضافية بنجاح!`);
    } catch (e) {
      console.error(e);
      showError("فشل تحديث وتمديد الحجز، يرجى المحاولة لاحقاً.");
    }
  };

  useEffect(() => {
    if (!selectedProjectId || selectedProjectId === 'main_map') return;

    const channel = supabase
      .channel(`realtime_sync_${selectedProjectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'houses_data',
          filter: `project_id=eq.${selectedProjectId}`
        },
        (payload) => {
          const updatedUnit = payload.new as any;
          if (updatedUnit && updatedUnit.unit_key) {
            setHousesData(prev => ({
              ...prev,
              [updatedUnit.unit_key]: {
                ...prev[updatedUnit.unit_key],
                ...updatedUnit.data
              }
            }));
            addDiagLog(`تحديث مجاميع Real-time للوحدة ${updatedUnit.unit_key}`, 'warn');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProjectId, setHousesData]);

  // التوجيه الافتراضي والذكي للمستخدمين فور الدخول لتجنب جلب المخطط العام بشكل مكرر
  useEffect(() => {
    if (isAuthChecking) return; // الحماية الذهبية: منع البدء بالتوجيه العشوائي قبل انتهاء فحص الهوية والتحقق من الجلسة
    
    if (!selectedProjectId) {
      if (isLoggedIn && currentCenter && currentCenter.allowed_projects && currentCenter.allowed_projects.length > 0) {
        setSelectedProjectId(currentCenter.allowed_projects[0]);
      } else {
        setSelectedProjectId('main_map');
      }
    }
  }, [selectedProjectId, isLoggedIn, currentCenter, isAuthChecking]);

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentCenter(null);
    setLoginData({ centerId: '', password: '' });
    localStorage.removeItem('marketing_center_session');
    localStorage.removeItem('marketing_center_password');
    localStorage.removeItem('marketing_center_name');
  };

  // المراقبة اللحظية (Realtime Logout) لتغيير كلمة المرور أو حذف الحساب من الإدارة
  useEffect(() => {
    if (!currentCenter?.id || !isLoggedIn) return;

    const savedCenterPass = localStorage.getItem('marketing_center_password');

    const channel = supabase
      .channel(`center_auth_check_${currentCenter.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'marketing_centers',
          filter: `id=eq.${currentCenter.id}`
        },
        (payload) => {
          const updatedCenter = payload.new as any;
          if (updatedCenter && updatedCenter.password !== savedCenterPass) {
            handleLogout();
            showError("تم تغيير كلمة المرور لهذا القسم من قِبل الإدارة. تم تسجيل الخروج تلقائياً.");
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'marketing_centers',
          filter: `id=eq.${currentCenter.id}`
        },
        () => {
          handleLogout();
          showError("تم حذف هذا القسم من قِبل الإدارة.");
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentCenter?.id, isLoggedIn]);

  useEffect(() => {
    const fetchCentersAndPermissions = async () => {
      setIsAuthChecking(true);
      const startTime = performance.now();
      try {
        const { data: centers } = await supabase.from('marketing_centers').select('*');
        if (centers) setMarketingCenters(centers);

        const savedCenterId = localStorage.getItem('marketing_center_session');
        const savedCenterPass = localStorage.getItem('marketing_center_password');

        if (savedCenterId && centers) {
          const center = centers.find(c => c.id === savedCenterId);
          
          // التحقق من صحة كلمة المرور المعتمدة للجلسة وبث الطلبات الخفيفة فقط
          if (center && center.password === savedCenterPass) {
            const { data: settings } = await supabase
              .from('settings')
              .select('key, value')
              .in('key', ['dept_permissions', 'project_configs', 'last_excel_update']);

            if (settings) {
              const permsSetting = settings.find(s => s.key === 'dept_permissions');
              if (permsSetting && permsSetting.value && center.type) {
                const deptPerms = permsSetting.value[center.type];
                if (deptPerms) setPermissions(deptPerms);
              }

              const configs = settings.find(s => s.key === 'project_configs');
              if (configs) setProjectConfigs(configs.value || {});

              const lastUpdateSetting = settings.find(s => s.key === 'last_excel_update');
              if (lastUpdateSetting) setLastUpdate(lastUpdateSetting.value);
            }

            setCurrentCenter(center);
            localStorage.setItem('marketing_center_name', center.name);
            setIsLoggedIn(true);
          } else {
            handleLogout();
            if (center && center.password !== savedCenterPass) {
              showError("تم تغيير كلمة المرور لهذا القسم من قِبل الإدارة. يرجى إعادة تسجيل الدخول.");
            }
          }
        }
        const endTime = performance.now();
        addDiagLog(`تمت تهيئة الجلسة والإعدادات بنجاح خلال ${(endTime - startTime).toFixed(1)} ملي ثانية`, 'success');
      } catch (err) {
        console.error("Error loading centers or permissions:", err);
      } finally {
        setIsAuthChecking(false);
      }
    };
    fetchCentersAndPermissions();
  }, []);

  useEffect(() => {
    setMapFilterZone('all');
    setMapFilterClass('all');
    setMapFilterSize('all');
    setMapFilterStatus('all');
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !isLoggedIn) return;

    if (selectedProjectId === 'main_map') {
      const fetchMainMap = async () => {
        // فحص الكاش المبني على الوقت (Time-Based Cache-First) لتجنب طلبات السيرفر
        const cachedMap = localStorage.getItem('cached_main_map_config');
        const cachedTimeStr = localStorage.getItem('cached_main_map_time');
        const cachedTime = cachedTimeStr ? parseInt(cachedTimeStr, 10) : 0;
        
        // المخطط يعتبر طازجاً وصالحاً لمدة 15 دقيقة كاملة دون الحاجة لأي تواصل بالشبكة
        const isCacheFresh = cachedMap && (Date.now() - cachedTime < 15 * 60 * 1000);

        if (cachedMap) {
          try {
            const parsed = JSON.parse(cachedMap);
            setMainMapData(parsed);
            setActiveElements(parsed.elements || []);
            addDiagLog("تحميل المخطط العام من الكاش المحلي فورياً (0ms)", "success");
          } catch (e) {
            console.error("Cache parsing error", e);
          }
        }

        // إذا كان الكاش حديثاً، ننهي الدالة فوراً ولا نشغل الشبكة بأي طلبات
        if (isCacheFresh) {
          addDiagLog("المخطط العام طازج محلياً، تم تخطي طلب الشبكة لضمان أداء مستقر وموفر للبيانات.", "success");
          return;
        }

        // إذا لم يتوفر كاش أبداً، نعرض شاشة التحميل التمهيدية
        if (!cachedMap) {
          setIsProjectLoading(true);
        }

        const startTime = performance.now();
        try {
          // استبدال Supabase wrapper بطلب متصفح أصلي (Native Fetch) خفيف ومباشر لتلافي أخطاء الشبكة تماماً
          const data = await fetchWithRetry(async () => {
            const res = await fetchNativeSupabase('settings?select=value&key=eq.main_map_config');
            if (!res || res.length === 0) throw new Error("No data found");
            return res[0];
          });
          
          if (data && data.value) {
            setMainMapData(data.value);
            setActiveElements(data.value.elements || []);
            // حفظ المخطط وتوقيت التحميل للتخزين المؤقت الذكي
            localStorage.setItem('cached_main_map_config', JSON.stringify(data.value));
            localStorage.setItem('cached_main_map_time', Date.now().toString());
            addDiagLog(`تم تحديث الكاش ومزامنة المخطط العام عبر Native Fetch: ${(performance.now() - startTime).toFixed(1)} ملي ثانية`, 'success');
          }
        } catch (e: any) {
          console.error("Background error loading main map:", e);
          if (cachedMap) {
            // في حال وجود كاش، نفشل بصمت تام دون توتر الموظف برسائل خطأ عشوائية
            addDiagLog("فشل تحديث المخطط العام من السيرفر (صامت)، تم الاعتماد على نسخة الكاش بأمان.", "warn");
          } else {
            addDiagLog(`تعذر تحميل المخطط العام: ${e.message || e}`, "danger");
            showError("تعذر تحميل المخطط العام حالياً، يرجى إعادة المحاولة.");
          }
        } finally {
          setIsProjectLoading(false);
        }
      };
      fetchMainMap();
      return;
    }

    const fetchProjectDataPhase1 = async () => {
      setIsProjectLoading(true);
      const startTime = performance.now();
      try {
        // استبدال Supabase wrapper بطلب متصفح أصلي (Native Fetch) خفيف ومباشر للمشاريع ذات العناصر الضخمة
        const projectDetails = await fetchWithRetry(async () => {
          const res = await fetchNativeSupabase(`projects?select=elements&id=eq.${selectedProjectId}`);
          if (!res || res.length === 0) throw new Error("No data found");
          return res[0];
        });
        setActiveElements(projectDetails?.elements || []);

        let allUnits: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        const dbFetchStart = performance.now();
        while (hasMore) {
          const chunk = await fetchWithRetry(async () => {
            const { data, error } = await supabase
              .from('houses_data')
              .select('unit_key, project_id, status:data->>status, taboStatus:data->>taboStatus, handoverDate:data->>handoverDate, price:data->>price, currency:data->>currency, saleDate:data->>saleDate')
              .eq('project_id', selectedProjectId)
              .range(from, from + step - 1);
            if (error) throw error;
            return data;
          });
          
          if (!chunk || chunk.length === 0) {
            hasMore = false;
          } else {
            allUnits = [...allUnits, ...chunk];
            from += step;
            if (chunk.length < step) hasMore = false;
          }
        }
        const dbFetchEnd = performance.now();
        
        const formattedUnits: Record<string, any> = {};
        allUnits.forEach((u: any) => {
          formattedUnits[u.unit_key] = {
            status: u.status || 'available',
            taboStatus: u.taboStatus || 'غير مروج',
            handoverDate: u.handoverDate || '',
            price: u.price || '',
            currency: u.currency || 'IQD',
            saleDate: u.saleDate || '',
            _isLightweight: true
          };
        });
        setHousesData(formattedUnits);
        
        checkExpiredBookings(allUnits, selectedProjectId);
        
        const totalTime = performance.now() - startTime;
        const dbTime = dbFetchEnd - dbFetchStart;
        addDiagLog(`استعادة المشروع (${activeProject?.name || selectedProjectId}): إجمالي ${totalTime.toFixed(1)} ملي ثانية (الشبكة: ${dbTime.toFixed(1)} ملي ثانية - الوحدات: ${allUnits.length})`, 'success');
        
      } catch (error) {
        console.error("Error loading project data after retries:", error);
        addDiagLog(`خطأ في جلب بيانات المشروع`, 'danger');
        showError("فشل في تحميل بيانات المشروع بالكامل بعدة محاولات, يرجى المحاولة مجدداً.");
      } finally {
        setIsProjectLoading(false);
      }
    };
    fetchProjectDataPhase1();
  }, [selectedProjectId, isLoggedIn, setHousesData]);

  // تأخير الاستعلام (Debounce) للبحث
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // تنفيذ البحث الفعلي في قاعدة البيانات بجدول houses_data
  useEffect(() => {
    if (!debouncedSearchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);
      try {
        const queryText = debouncedSearchQuery.trim().toLowerCase();
        let query = supabase
          .from('houses_data')
          .select('unit_key, project_id, data')
          .or(`unit_key.ilike.%${queryText}%,data->>name.ilike.%${queryText}%,data->>phone.ilike.%${queryText}%`)
          .limit(searchLimit);

        if (searchProjectFilter && searchProjectFilter !== 'all') {
          query = query.eq('project_id', searchProjectFilter);
        }

        const { data, error } = await query;
        if (error) throw error;
        setSearchResults(data || []);
      } catch (err) {
        console.error("Search error:", err);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery, searchProjectFilter, searchLimit]);

  // دالة مساعدة لمطابقة عنصر الخريطة بالرمز المطلوب
  const isElementMatch = (el: MapElement, targetId: string) => {
    if (!targetId || !el) return false;
    const cleanTarget = targetId.trim().toLowerCase();
    const cleanId = (el.id || '').trim().toLowerCase();
    const cleanLabel = (el.label || '').trim().toLowerCase();

    if (cleanId === cleanTarget || cleanLabel === cleanTarget) return true;

    // مطابقة بدون مسافات للرمز مثل Z1-B1-D1
    if (cleanLabel.replace(/\s+/g, '') === cleanTarget.replace(/\s+/g, '')) return true;

    return false;
  };

  // معالجة النقر على عنصر في نتائج البحث مع مطابقة ذكية وتفريغ العناصر القديمة لتفادي Race Condition
  const parseSearchClick = async (item: any) => {
    const unitKey = item.unit_key;
    const projectId = item.project_id;
    
    let isTower = false;
    let targetElementId = unitKey;
    let targetApartmentKey: string | null = null;

    if (unitKey.includes('_F') && unitKey.includes('_A')) {
      isTower = true;
      targetElementId = unitKey.split('_F')[0];
      targetApartmentKey = unitKey;
    }

    // إذا كنا بنفس المشروع بالفعل والعناصر محملة وثابتة
    if (selectedProjectId === projectId && !isProjectLoading && activeElements.length > 0) {
      const matchedEl = activeElements.find(el => isElementMatch(el, targetElementId));
      if (matchedEl) {
        if (isTower) setPendingApartmentKey(targetApartmentKey);
        handleElementClick(matchedEl.id);
        setSearchQuery('');
        setSearchResults([]);
        showSuccess(`تم الانتقال للوحدة ${unitKey}`);
        return;
      }
    }

    setActiveElements([]);
    if (isTower) {
      setPendingApartmentKey(targetApartmentKey);
    } else {
      setPendingApartmentKey(null);
    }

    setPendingOpen({ projectId, elementId: targetElementId, isTower, apartmentKey: targetApartmentKey });
    setSelectedProjectId(projectId);
    setSearchQuery('');
    setSearchResults([]);
    showSuccess(`جاري الانتقال لـ ${projects.find(p => p.id === projectId)?.name || 'المشروع'}...`);
  };

  const checkExpiredBookings = async (units: any[], projectId: string) => {
    const now = new Date();
    const expiredUnits: any[] = [];
    const expiredNotifications: any[] = [];

    units.forEach(unit => {
      const status = unit.status || unit.data?.status;
      const saleDate = unit.saleDate || unit.data?.saleDate;

      if (status === 'pending' && saleDate) {
        const bookingDate = new Date(saleDate);
        const diffTime = Math.abs(now.getTime() - bookingDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 7) {
          expiredUnits.push({
            unit_key: unit.unit_key,
            project_id: projectId,
            data: { ...(unit.data || {}), status: 'available', name: '', phone: '', saleDate: '', details: 'انتهى الحجز التلقائي' }
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
    }
  };

  const handleLogin = async () => {
    if (!loginData.centerId) {
      showError("يرجى اختيار القسم أولاً");
      return;
    }
    const center = marketingCenters.find(c => c.id === loginData.centerId);
    if (center && center.password === loginData.password) {
      setIsAuthChecking(true);
      try {
        const { data: settings } = await supabase
          .from('settings')
          .select('key, value')
          .in('key', ['dept_permissions', 'project_configs', 'last_excel_update']);

        if (settings) {
          const permsSetting = settings.find(s => s.key === 'dept_permissions');
          if (permsSetting && permsSetting.value && center.type) {
            const deptPerms = permsSetting.value[center.type];
            if (deptPerms) setPermissions(deptPerms);
          }

          const configs = settings.find(s => s.key === 'project_configs');
          if (configs) setProjectConfigs(configs.value || {});

          const lastUpdateSetting = settings.find(s => s.key === 'last_excel_update');
          if (lastUpdateSetting) setLastUpdate(lastUpdateSetting.value);
        }

        setCurrentCenter(center);
        localStorage.setItem('marketing_center_session', center.id);
        localStorage.setItem('marketing_center_password', center.password);
        localStorage.setItem('marketing_center_name', center.name);
        setIsLoggedIn(true);
        showSuccess(`مرحباً بك في مركز ${center.name}`);
      } catch (err) {
        console.error("Error confirming permissions on login:", err);
        showError("حدث خطأ أثناء تحميل صلاحيات القسم");
      } finally {
        setIsAuthChecking(false);
      }
    } else {
      showError("بيانات الدخول غير صحيحة");
    }
  };

  const handleElementClick = async (id: string) => {
    const element = activeElements.find(el => el.id === id);
    if (!element) return;

    if (element.linkProjectId) {
      const linkedP = projects.find(p => p.id === element.linkProjectId);
      if (linkedP) {
        setSelectedProjectId(element.linkProjectId);
        setSelectedElementId(null);
        showSuccess(`تم الانتقال التلقائي لمخطط: ${linkedP.name}`);
      } else {
        showError("المشروع المرتبط لم يعد متوفراً");
      }
      return;
    }

    if (selectedProjectId === 'main_map') {
      return;
    }

    setSelectedElementId(id);
    const startTime = performance.now();

    try {
      if (element.type === 'house') {
        const { data: fullUnit } = await supabase
          .from('houses_data')
          .select('unit_key, project_id, data')
          .eq('project_id', selectedProjectId)
          .eq('unit_key', id)
          .maybeSingle();

        if (fullUnit && fullUnit.data) {
          setHousesData(prev => ({
            ...prev,
            [id]: fullUnit.data
          }));
        }
        const endTime = performance.now();
        addDiagLog(`جلب التفاصيل الكاملة للمنزل ${id}: ${(endTime - startTime).toFixed(1)} ملي ثانية`, 'info');
        setIsUnitModalOpen(true);
      } else if (element.type === 'tower') {
        const { data: towerUnits } = await supabase
          .from('houses_data')
          .select('unit_key, project_id, data')
          .eq('project_id', selectedProjectId)
          .like('unit_key', `${id}_%`);

        if (towerUnits && towerUnits.length > 0) {
          setHousesData(prev => {
            const next = { ...prev };
            towerUnits.forEach(u => {
              if (u.data) next[u.unit_key] = u.data;
            });
            return next;
          });
        }
        const endTime = performance.now();
        addDiagLog(`جلب شقق العمارة ${id} (${towerUnits?.length || 0} شقة): ${(endTime - startTime).toFixed(1)} ملي ثانية`, 'info');
        setIsTowerModalOpen(true);
      }
    } catch (e) {
      console.error("Error fetching Phase 2 unit details:", e);
      if (element.type === 'tower') setIsTowerModalOpen(true);
      else setIsUnitModalOpen(true);
    }
  };

  useEffect(() => {
    if (!isProjectLoading && pendingOpen && pendingOpen.projectId === selectedProjectId && activeElements.length > 0) {
      const { elementId, isTower, apartmentKey } = pendingOpen;
      
      const matchedEl = activeElements.find(el => isElementMatch(el, elementId));

      if (matchedEl) {
        if (isTower && apartmentKey) {
          setPendingApartmentKey(apartmentKey);
        }
        handleElementClick(matchedEl.id);
      } else {
        showError("تعذر عرض الوحدة على المخطط المحدد");
      }
      setPendingOpen(null);
    }
  }, [isProjectLoading, activeElements, pendingOpen, selectedProjectId]);

  const handleSaveData = async (key: string, data: any) => {
    if (!selectedProjectId || selectedProjectId === 'main_map') return;
    try {
      await supabase.from('houses_data').upsert({ unit_key: key, project_id: selectedProjectId, data: data }, { onConflict: 'unit_key' });
      setHousesData(prev => ({ ...prev, [key]: data }));
      addDiagLog(`حفظ وتحديث الوحدة ${key} بنجاح`, 'success');
      showSuccess(`تم تحديث البيانات بنجاح`);
    } catch (error) { showError("فشل في حفظ البيانات"); }
  };

  const calculateStats = () => {
    if (selectedProjectId === 'main_map' || !activeProject || !activeElements) return { total: 0, sold: 0, investment: 0, promoted: 0, notPromoted: 0, receivedTabo: 0, receivedUnit: 0, notReceivedUnit: 0 };
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

  const getHouseArea = (el: MapElement) => {
    if (el.customArea !== undefined && el.customArea > 0) {
      return el.customArea;
    }
    const houseTypeAreas = projectConfigs[selectedProjectId || '']?.houseTypeAreas || {};
    const parts = el.label.split('-');
    const lastPart = parts[parts.length - 1] || '';
    const match = lastPart.match(/^([a-zA-Z]+)/);
    const type = match ? match[1].toUpperCase() : lastPart.toUpperCase();
    return houseTypeAreas[type] || 0;
  };

  const currentBgColor = selectedProjectId === 'main_map' 
    ? (mainMapData?.backgroundColor || '#ffffff') 
    : (projectConfigs[selectedProjectId || '']?.backgroundColor || '#ffffff');

  const currentShowGrid = selectedProjectId === 'main_map'
    ? (mainMapData?.showGrid !== false)
    : (projectConfigs[selectedProjectId || '']?.showGrid !== false);

  const handleClearCache = () => {
    localStorage.removeItem('cached_main_map_config');
    localStorage.removeItem('cached_main_map_time');
    addDiagLog("تم تفريغ كاش المخطط العام بنجاح! جاري إعادة التحميل...", "success");
    showSuccess("تم تفريغ الكاش بنجاح!");
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center font-bold" dir="rtl">
        <div className="text-center space-y-4">
          <RefreshCcw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
          <p className="text-slate-600 font-bold">جاري التحقق من الجلسة والصلاحيات...</p>
        </div>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4 relative" dir="rtl">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-100 mx-auto mb-6">
              <Store className="text-white w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">تسجيل دخول القسم</h1>
            <p className="text-slate-500 font-medium mt-2 text-xs">اختر القسم وأدخل كلمة المرور للدخول للنظام</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); handleLogin(); }} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 mr-2">اختر القسم / مركز التسويق</label>
              <Select value={loginData.centerId} onValueChange={(val) => setLoginData({ ...loginData, centerId: val })}>
                <SelectTrigger className="rounded-2xl h-14 border-slate-200 font-bold text-sm bg-slate-50/50">
                  <SelectValue placeholder="اختر القسم..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {marketingCenters.map(center => (
                    <SelectItem key={center.id} value={center.id} className="font-bold text-xs">
                      {center.name} ({center.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-600 mr-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-4 text-slate-400 w-5 h-5" />
                <Input 
                  type="password" 
                  placeholder="أدخل كلمة المرور..." 
                  className="pr-12 rounded-2xl h-14 border-slate-200 font-bold" 
                  value={loginData.password} 
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })} 
                />
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 rounded-2xl h-14 text-base font-black shadow-lg shadow-blue-100"
            >
              تسجيل الدخول
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f0f4f8] p-4 md:p-8 relative" dir="rtl">
      {/* لوحة الفحص والتشخيص المعزولة والجديدة كلياً لحماية الأداء ومنع الـ Re-renders */}
      {isLoggedIn && permissions.showDiagnosticTerminal !== false && (
        <DiagnosticTerminal 
          logs={diagLogs} 
          onClearLogs={() => setDiagLogs([])} 
        />
      )}
      
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4 shrink-0">
            <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200"><MapIcon className="text-white w-8 h-8" /></div>
            <div>
              <h1 className="text-xl font-black text-slate-800 leading-tight">نظام ادارة الوحدات السكنية</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-slate-500 text-xs font-bold">خريطة تفاعلية للمخطط السكني</p>
                {currentCenter && (
                  <>
                    <span className="text-slate-300">|</span>
                    <span className="text-blue-600 text-xs font-black bg-blue-50 px-2 py-0.5 rounded-full">
                      القسم الحالي: {currentCenter.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 shrink-0">
            {lastUpdate && (
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-emerald-50/50 px-3 py-2.5 rounded-xl border border-emerald-100/50 font-black">
                <RefreshCcw size={12} className="text-emerald-500 animate-spin-slow" />
                <span>آخر مزامنة:</span>
                <span className="text-slate-700 font-black">
                  {new Date(lastUpdate).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </span>
              </div>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl gap-2 border-slate-200 min-w-[180px] font-black h-12 text-slate-700 shadow-sm text-xs">
                  {selectedProjectId === 'main_map' ? "المخطط العام للمدينة" : (activeProject?.name || "اختر المخطط...")}
                  <ChevronDown size={14} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={() => setSelectedProjectId('main_map')} className="text-right font-black text-indigo-600 hover:bg-indigo-50 focus:bg-indigo-50">
                  🌐 المخطط العام للمدينة
                </DropdownMenuItem>
                <div className="h-px bg-slate-100 my-1" />
                {filteredProjects.map(p => (
                  <DropdownMenuItem key={p.id} onClick={() => setSelectedProjectId(p.id)} className="text-right font-bold">
                    {p.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" onClick={handleLogout} className="rounded-xl text-rose-500 hover:bg-rose-50 gap-2 h-12 font-bold text-xs"><LogOut size={16} /> خروج</Button>
          </div>
        </header>

        {permissions.showSearchBox !== false && (
          <div className="relative bg-white p-4 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row gap-3 items-center w-full animate-in fade-in duration-300">
            <div className="w-full sm:w-48 shrink-0">
              <Select value={searchProjectFilter} onValueChange={(val) => { setSearchProjectFilter(val); setSearchLimit(10); }}>
                <SelectTrigger className="rounded-2xl h-12 border-slate-200 font-black text-xs bg-slate-50/50 w-full">
                  <SelectValue placeholder="كل المشاريع" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold text-xs">🌐 كل المشاريع</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id} className="font-bold text-xs">{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 w-full">
              <Search className="absolute right-4 top-3.5 text-slate-400 w-5 h-5" />
              <Input 
                type="text" 
                placeholder="ابحث عن اسم زبون, رقم هاتف, أو رقم وحدة..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-12 pl-12 rounded-2xl h-12 border-slate-200 font-bold focus-visible:ring-blue-500 focus-visible:ring-2 w-full text-sm bg-slate-50/50" 
              />
              {isSearching && (
                <div className="absolute left-10 top-3.5">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
              {searchQuery && (
                <button 
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="absolute left-4 top-3.5 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            
            {searchResults.length > 0 && (
              <div className="absolute z-[999] right-4 left-4 top-16 mt-2 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                {searchResults.map((item) => {
                  const projName = projects.find(p => p.id === item.project_id)?.name || "المخطط العام";
                  const isInvestment = item.data?.status === 'investment';
                  const isSold = item.data?.status === 'sold';
                  const isReserved = item.data?.status === 'reserved';
                  const isPending = item.data?.status === 'pending';
                  
                  let statusBadge = "متاح";
                  let statusClass = "bg-emerald-50 text-emerald-700 border-emerald-100";
                  if (isSold) {
                    statusBadge = "مباع";
                    statusClass = "bg-rose-50 text-rose-700 border-rose-100";
                  } else if (isInvestment) {
                    statusBadge = "استثمار";
                    statusClass = "bg-purple-50 text-purple-700 border-purple-100";
                  } else if (isReserved) {
                    statusBadge = "محجوز";
                    statusClass = "bg-amber-50 text-amber-700 border-amber-100";
                  } else if (isPending) {
                    statusBadge = "حجز أولي";
                    statusClass = "bg-blue-50 text-blue-700 border-blue-100";
                  }

                  return (
                    <button 
                      key={item.unit_key}
                      onClick={() => parseSearchClick(item)}
                      className="w-full text-right p-4 hover:bg-slate-50 transition-colors flex flex-col gap-1"
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className="font-black text-slate-800 text-xs">
                          {item.data?.name ? item.data.name : `الوحدة ${item.unit_key}`}
                        </span>
                        <span className={cn("text-[9px] font-black px-2 py-0.5 rounded-full border", statusClass)}>
                          {statusBadge}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-500 font-semibold w-full mt-0.5">
                        <span>الرمز: <strong className="text-slate-700 font-black">{item.unit_key}</strong></span>
                        {item.data?.phone && <span className="text-slate-400">📞 {item.data.phone}</span>}
                        <span className="text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-lg text-[10px] font-black">📍 {projName}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {permissions.canAccessReports !== false && (
          <div className="flex flex-col sm:flex-row justify-between items-center bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm gap-4">
            <div className="flex items-center gap-3 text-slate-600 text-xs font-bold">
              <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
                <Info size={16} />
              </div>
              <span>يمكنك تصفح التحليلات والرسوم البيانية الشاملة لكافة المشاريع السكنية من هنا:</span>
            </div>
            <Link to="/reports">
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl gap-2 h-11 px-6 font-black text-xs shadow-md shadow-indigo-100">
                <BarChart3 size={16} />
                عرض لوحة التقارير والتحليلات المتقدمة
              </Button>
            </Link>
          </div>
        )}

        <main className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className={cn("space-y-8", (selectedProjectId !== 'main_map' && (permissions.showGeneralStats || permissions.showNotifications)) ? "lg:col-span-2" : "lg:col-span-3")}>
            {isProjectLoading ? (
              <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <h2 className="text-xl font-bold text-slate-600">جاري تحميل تفاصيل المخطط...</h2>
              </div>
            ) : selectedProjectId === 'main_map' ? (
              <InteractiveMap 
                elements={activeElements} 
                onHouseClick={handleElementClick} 
                housesData={housesData} 
                mapWidth={mainMapData?.width || 1200} 
                mapHeight={mainMapData?.height || 800} 
                backgroundColor={currentBgColor}
                showGrid={currentShowGrid}
                permissions={permissions}
                showTooltips={false}
              />
            ) : activeProject ? (
              <>
                <InteractiveMap 
                  elements={activeElements} 
                  onHouseClick={handleElementClick} 
                  selectedHouseId={selectedElementId} 
                  housesData={housesData} 
                  mapWidth={activeProject.mapWidth} 
                  mapHeight={activeProject.mapHeight} 
                  permissions={permissions} 
                  backgroundColor={currentBgColor}
                  showGrid={currentShowGrid}
                  filterZone={mapFilterZone}
                  filterClass={mapFilterClass}
                  filterSize={mapFilterSize}
                  filterStatus={mapFilterStatus}
                  onFilterZoneChange={setMapFilterZone}
                  onFilterClassChange={setMapFilterClass}
                  onFilterSizeChange={setMapFilterSize}
                  onFilterStatusChange={setMapFilterStatus}
                  houseTypeAreas={projectConfigs[selectedProjectId || '']?.houseTypeAreas || {}}
                  showTooltips={true}
                />
                {permissions.showStatsTable && <DetailedStatsTable elements={activeElements} housesData={housesData} permissions={permissions} />}
              </>
            ) : (
              <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center"><MapIcon className="mx-auto mb-4 opacity-10" size={80} /><h2 className="text-xl font-bold text-slate-400">لا توجد مشاريع متاحة للعرض</h2></div>
            )}
          </div>

          {selectedProjectId !== 'main_map' && (permissions.showGeneralStats || permissions.showNotifications) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
              
              {expiringSoonBookings.length > 0 && (
                <div className="bg-amber-50/60 border border-amber-200 p-6 rounded-[2rem] shadow-sm space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                  <div className="flex items-center gap-2 text-amber-800 font-black text-xs shrink-0">
                    <AlertTriangle className="text-amber-500 animate-bounce shrink-0" size={18} />
                    <span>حجوزات أولية توشك على الانتهاء:</span>
                  </div>
                  <div className="space-y-3 max-h-48 overflow-y-auto no-scrollbar">
                    {expiringSoonBookings.map((b) => (
                      <div key={b.key} className="bg-white p-3 rounded-xl border border-amber-100 flex items-center justify-between gap-3 text-xs shadow-sm">
                        <div className="text-right">
                          <p className="font-black text-slate-800 text-[11px]">{b.label}</p>
                          <p className="text-[9px] text-amber-600 font-bold mt-0.5">
                            متبقي: <strong className="font-black text-amber-700">{b.daysLeft} يوم</strong> (تاريخ: {b.data.saleDate})
                          </p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleExtendBooking(b.key, b.data)}
                          className="bg-amber-500 hover:bg-amber-600 text-white rounded-lg h-8 px-2.5 font-black text-[10px] shrink-0"
                        >
                          تمديد 7 أيام
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

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
          onSave={(key, data) => handleSaveData(key, data)} 
          unitId={selectedElementId} 
          unitLabel={activeElements.find(el => el.id === selectedElementId)?.label} 
          initialData={selectedElementId ? housesData[selectedElementId] : undefined}
          permissions={permissions}
          unitSize={selectedElement && selectedElement.type === 'house' ? getHouseArea(selectedElement) : undefined}
          projectId={selectedProjectId || undefined}
        />
        <TowerDetailsModal 
          isOpen={isTowerModalOpen} 
          onClose={() => {
            setIsTowerModalOpen(false);
            setPendingApartmentKey(null);
          }} 
          tower={activeElements.find(el => el.id === selectedElementId)} 
          housesData={housesData} 
          onSaveApartment={handleSaveData}
          permissions={permissions}
          initialSelectedApartmentKey={pendingApartmentKey}
        />

        {/* كود الفوتر المدمج والجديد لإضافة زر تفريغ الكاش المباشر للمطورين والمختبرين */}
        <div className="flex flex-col items-center justify-center gap-4 mt-8 pt-8 border-t border-slate-200">
          <Button 
            variant="outline" 
            onClick={handleClearCache}
            className="rounded-xl gap-2 border-rose-200 text-rose-600 hover:bg-rose-50 h-11 px-5 text-xs font-black shadow-sm transition-all transform active:scale-95"
          >
            <Trash2 size={14} />
            تفريغ كاش المخططات وإعادة التحميل التمهيدي الفوري
          </Button>
          <MadeWithDyad />
        </div>
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