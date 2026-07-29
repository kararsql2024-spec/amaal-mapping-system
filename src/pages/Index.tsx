"use client";

import React, { useState, useEffect } from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import UnitDetailsModal from '@/components/UnitDetailsModal';
import TowerDetailsModal from '@/components/TowerDetailsModal';
import DetailedStatsTable from '@/components/DetailedStatsTable';
import { showSuccess, showError } from '@/utils/toast';
import { 
  Map as MapIcon, ChevronDown, ChevronUp, Store, Lock, LogOut, Bell, 
  Clock, Info, FileCheck, FileX, CheckCircle, Home as HomeIcon, XCircle, 
  BarChart3, MapPin, Search, RefreshCcw, X, SlidersHorizontal, AlertTriangle, Ruler 
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

// دالة ذكية لإعادة المحاولة عند الفشل المؤقت لضمان موثوقية الاتصال وقوة جلب البيانات
const fetchWithRetry = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 1) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return fetchWithRetry(fn, retries - 1, delay * 1.5);
  }
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

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [marketingCenters, setMarketingCenters] = useState<any[]>([]);
  const [loginData, setLoginData] = useState({ centerId: '', password: '' });
  const [currentCenter, setCurrentCenter] = useState<any>(null);
  
  const [mainMapData, setMainMapData] = useState<any>(null);
  const [projectConfigs, setProjectConfigs] = useState<Record<string, { backgroundColor?: string, showGrid?: boolean, houseTypeAreas?: Record<string, number> }>>({});

  // متغيرات تصفية الخريطة التفاعلية والتوهج (Feature 6)
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
  const [pendingOpen, setPendingOpen] = useState<{ elementId: string; isTower: boolean } | null>(null);

  // متغيرات فلترة البحث والصفحات
  const [searchProjectFilter, setSearchProjectFilter] = useState<string>('all');
  const [searchLimit, setSearchLimit] = useState<number>(10);
  const [hasMoreResults, setHasMoreResults] = useState<boolean>(false);
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
    canAccessReports: true
  });

  // تعريف وتحضير المشاريع المسموحة والمشروع النشط أولاً لتجنب أي مشاكل قبل التهيئة الكاملة
  const filteredProjects = React.useMemo(() => {
    if (!currentCenter || !currentCenter.allowed_projects || currentCenter.allowed_projects.length === 0) return projects;
    return projects.filter(p => currentCenter.allowed_projects.includes(p.id));
  }, [projects, currentCenter]);

  const activeProject = React.useMemo(() => {
    return filteredProjects.find(p => p.id === selectedProjectId);
  }, [filteredProjects, selectedProjectId]);

  // استخراج معلمات التصفية الذكية بناءً على المخطط الحالي لتوليد فلاتر الخريطة تلقائياً (Feature 6)
  const { mapZones, mapClasses, mapSizes } = React.useMemo(() => {
    const zones = new Set<string>();
    const classes = new Set<string>();
    const sizes = new Set<number>();

    activeElements.forEach(el => {
      if (el.type === 'house') {
        const parts = el.label.split('-');
        if (parts[0]) zones.add(parts[0]);
        if (parts.length >= 3) {
          const typeMatch = parts[2].match(/[a-zA-Z]+/);
          if (typeMatch) classes.add(typeMatch[0]);
        }
      } else if (el.type === 'tower') {
        const floors = el.floors || 1;
        const aptsPerFloor = el.apartmentsPerFloor || 1;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            const key = `${el.id}_F${f}_A${a}`;
            const data = housesData[key];
            if (data?.status === 'frozen_hidden') continue;

            const size = f === 1 
              ? (el.groundFloorSizes?.[a - 1] || 0) 
              : (el.typicalFloorSizes?.[a - 1] || 0);
            if (size > 0) {
              sizes.add(size);
            }
          }
        }
      }
    });

    return {
      mapZones: Array.from(zones).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      mapClasses: Array.from(classes).sort(),
      mapSizes: Array.from(sizes).sort((a, b) => a - b)
    };
  }, [activeElements, housesData]);

  // حساب الحجوزات التي أوشكت مدتها على الانتهاء (24-48 ساعة قبل مرور 7 أيام) (Feature 8)
  const expiringSoonBookings = React.useMemo(() => {
    if (selectedProjectId === 'main_map' || !activeProject) return [];
    const soon: any[] = [];
    const now = new Date();

    const checkUnit = (key: string, label: string) => {
      const data = housesData[key];
      // الحجز الأولي (Pending) فقط يخضع للتصفية والانتهاء
      if (data?.status === 'pending' && data?.saleDate) {
        const bookingDate = new Date(data.saleDate);
        const diffTime = now.getTime() - bookingDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        // إذا مر أكثر من 5 أيام وأقل من 7 أيام، فإن الحجز ينتهي قريباً جداً (أقل من 48 ساعة)
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
            
            // حساب كود الطابق والشقة للحصول على الاسم الرمزي الحقيقي للشقة
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

  // دالة تمديد الحجز الأولي لمدة 7 أيام إضافية وتوثيق ذلك بالتاريخ والملاحظات (Feature 8)
  const handleExtendBooking = async (key: string, currentData: any) => {
    if (!selectedProjectId) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLabel = new Date().toLocaleDateString('ar-EG');
    const updatedNotes = [...(currentData.notes || [])];
    
    // توثيق عملية تمديد الحجز رسمياً في سجل الملاحظات الخاص بالوحدة
    updatedNotes.unshift({
      text: `قام القسم (${currentCenter?.name || 'مبيعات'}) بعمل تمديد يدوي للحجز الأولي لمدة 7 أيام إضافية تبدأ من تاريخ اليوم ${todayLabel}`,
      author: 'النظام تلقائياً',
      date: new Date().toISOString()
    });

    const updatedData = {
      ...currentData,
      saleDate: todayStr, // تصفير العداد لتبدأ 7 أيام جديدة بالكامل
      notes: updatedNotes
    };

    try {
      await supabase.from('houses_data').upsert({ 
        unit_key: key, 
        project_id: selectedProjectId, 
        data: updatedData 
      }, { onConflict: 'unit_key' });

      // تدوين إشعار تمديد رسمي في سجل الإشعارات
      await supabase.from('notifications').insert({
        project_id: selectedProjectId,
        message: `تم تمديد الحجز الأولي للوحدة ${key} بنجاح من قبل مركز ${currentCenter?.name || ''} لمدة 7 أيام إضافية.`
      });

      setHousesData(prev => ({ ...prev, [key]: updatedData }));
      
      // جلب الإشعارات والعمليات الحية
      const { data: newNotifs } = await supabase
        .from('notifications')
        .select('*')
        .eq('project_id', selectedProjectId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (newNotifs) setNotifications(newNotifs);

      showSuccess(`تم تمديد حجز الوحدة ${key} لمدة 7 أيام إضافية بنجاح!`);
    } catch (e) {
      console.error(e);
      showError("فشل تحديث وتمديد الحجز، يرجى المحاولة لاحقاً.");
    }
  };

  // ميزة التحديث اللحظي الفوري (Real-time Sync) للبيانات من خلال اشتراكات Supabase (Feature 1)
  useEffect(() => {
    if (!selectedProjectId || selectedProjectId === 'main_map') return;

    // الاشتراك في التغييرات اللحظية لجدول مبيعات الوحدات للمشروع الحالي
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
              [updatedUnit.unit_key]: updatedUnit.data
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProjectId, setHousesData]);

  // تعيين المخطط العام كخيار افتراضي أولي عند فتح الواجهة ليعطي تجربة تصفح للمدينة كاملة
  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedProjectId('main_map');
    }
  }, [selectedProjectId]);

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
          
          const { data: settings } = await supabase.from('settings').select('*');
          if (settings) {
            const permsSetting = settings.find(s => s.key === 'dept_permissions');
            if (permsSetting && permsSetting.value && center.type) {
              const deptPerms = permsSetting.value[center.type];
              if (deptPerms) setPermissions(deptPerms);
            }

            const mainMap = settings.find(s => s.key === 'main_map_config');
            if (mainMap) setMainMapData(mainMap.value);

            const configs = settings.find(s => s.key === 'project_configs');
            if (configs) setProjectConfigs(configs.value || {});

            const lastUpdateSetting = settings.find(s => s.key === 'last_excel_update');
            if (lastUpdateSetting) setLastUpdate(lastUpdateSetting.value);
          }
        }
      }
    };
    fetchCentersAndPermissions();
  }, []);

  // إعادة تعيين فلاتر الخريطة التفاعلية عند تغيير المشروع لتجنب تضارب التصفية
  useEffect(() => {
    setMapFilterZone('all');
    setMapFilterClass('all');
    setMapFilterSize('all');
    setMapFilterStatus('all');
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;

    if (selectedProjectId === 'main_map') {
      const fetchMainMap = async () => {
        setIsProjectLoading(true);
        try {
          const data = await fetchWithRetry(async () => {
            const { data, error } = await supabase.from('settings').select('*').eq('key', 'main_map_config').single();
            if (error) throw error;
            return data;
          });
          
          if (data && data.value) {
            setMainMapData(data.value);
            setActiveElements(data.value.elements || []);
          } else {
            setActiveElements([]);
          }
        } catch (e) {
          console.error("Error loading main map:", e);
          showError("تعذر تحميل المخطط العام حالياً، يرجى المحاولة مرة أخرى.");
        } finally {
          setIsProjectLoading(false);
        }
      };
      fetchMainMap();
      return;
    }

    const fetchProjectData = async () => {
      setIsProjectLoading(true);
      try {
        // 1. جلب تفاصيل مخطط المشروع مع إعادة محاولة تلقائية في حال الفشل
        const projectDetails = await fetchWithRetry(async () => {
          const { data, error } = await supabase
            .from('projects')
            .select('elements')
            .eq('id', selectedProjectId)
            .single();
          if (error) throw error;
          return data;
        });
        setActiveElements(projectDetails?.elements || []);

        // 2. جلب الإشعارات
        const notifs = await fetchWithRetry(async () => {
          const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .eq('project_id', selectedProjectId)
            .order('created_at', { ascending: false })
            .limit(50);
          if (error) throw error;
          return data;
        }).catch(() => []); // فشل الإشعارات البسيط لا يجب أن يعيق المخطط بالكامل
        if (notifs) setNotifications(notifs);

        // 3. جلب بيانات الوحدات والمبيعات مع إعادة محاولة لكل دفعة
        let allUnits: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
          const chunk = await fetchWithRetry(async () => {
            const { data, error } = await supabase
              .from('houses_data')
              .select('*')
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
        
        const formattedUnits: Record<string, any> = {};
        allUnits.forEach(u => {
          formattedUnits[u.unit_key] = u.data;
        });
        setHousesData(formattedUnits);
        
        checkExpiredBookings(allUnits, selectedProjectId);
        
      } catch (error) {
        console.error("Error loading project data after retries:", error);
        showError("فشل في تحميل بيانات المشروع بالكامل بعدة محاولات، يرجى المحاولة مجدداً.");
      } finally {
        setIsProjectLoading(false);
      }
    };
    fetchProjectData();
  }, [selectedProjectId, setHousesData]);

  // تأثير لفتح نافذة التفاصيل تلقائياً بعد اختيار نتيجة البحث وتحميل المخطط بنجاح
  useEffect(() => {
    if (!isProjectLoading && pendingOpen && activeElements.length > 0) {
      const { elementId, isTower } = pendingOpen;
      const exists = activeElements.some(el => el.id === elementId);
      if (exists) {
        setSelectedElementId(elementId);
        if (isTower) {
          setIsTowerModalOpen(true);
        } else {
          setIsUnitModalOpen(true);
        }
      } else {
        showError("تعذر عرض الوحدة على المخطط الحالي");
      }
      setPendingOpen(null);
    }
  }, [isProjectLoading, activeElements, pendingOpen]);

  // تطبيق ميزة تأخير الاستعلام (Debounce) بمقدار 300 ملي ثانية
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [searchQuery]);

  // تأثير البحث المحسن والديناميكي مع دعم الفلترة والصفحات وحل مشكلة الشقق
  useEffect(() => {
    const performSearch = async () => {
      if (!debouncedSearchQuery || debouncedSearchQuery.trim().length < 2) {
        setSearchResults([]);
        setHasMoreResults(false);
        return;
      }
      setIsSearching(true);
      try {
        const trimmedQuery = debouncedSearchQuery.trim();
        const aptPattern = /^([^-]+)-([^-]+)-([^-]+)$/;
        const match = trimmedQuery.match(aptPattern);

        if (match) {
          // هذا بحث عن شقة بنمط (العمارة-الطابق-الشقة)
          const towerLabel = match[1].trim().toUpperCase();
          const floorCode = match[2].trim().toUpperCase();
          const aptCode = match[3].trim().toUpperCase();

          // 1. جلب المشاريع مع عناصر المخطط للبحث عن العمارة المطابقة
          let projQuery = supabase.from('projects').select('id, name, elements');
          if (searchProjectFilter !== 'all') {
            projQuery = projQuery.eq('id', searchProjectFilter);
          }
          const { data: projectsWithElements } = await projQuery;

          const matchedResults: any[] = [];

          if (projectsWithElements) {
            for (const proj of projectsWithElements) {
              const elements = (proj.elements || []) as MapElement[];
              const matchingTowers = elements.filter(el => 
                el.type === 'tower' && 
                el.label.toUpperCase().replace(/\s+/g, '') === towerLabel.replace(/\s+/g, '')
              );

              for (const tower of matchingTowers) {
                // جلب كافة الوحدات التابعة لهذه العمارة لحساب التسلسل P بدقة
                const { data: towerUnits } = await supabase
                  .from('houses_data')
                  .select('unit_key, data')
                  .like('unit_key', `${tower.id}_%`);

                // تحديد رقم الطابق المستهدف هندسياً
                let targetFloor = -1;
                if (floorCode === 'FG') {
                  targetFloor = 1;
                } else if (floorCode.startsWith('F')) {
                  targetFloor = parseInt(floorCode.substring(1)) + 1;
                }

                if (targetFloor !== -1) {
                  let pCounter = 0;
                  let matchedUnitKey = null;
                  
                  for (let f = 1; f <= (tower.floors || 1); f++) {
                    for (let a = 1; a <= (tower.apartmentsPerFloor || 1); a++) {
                      const key = `${tower.id}_F${f}_A${a}`;
                      const uData = towerUnits?.find(u => u.unit_key === key)?.data || {};
                      const isFrozenSequence = uData?.status === 'frozen_uncounted' || uData?.status === 'frozen_hidden';
                      
                      if (!isFrozenSequence) {
                        pCounter++;
                      }
                      
                      const currentFloorCode = f === 1 ? "FG" : `F${f - 1}`;
                      const currentAptCode = isFrozenSequence ? "مجمدة" : `P${pCounter}`;
                      
                      if (f === targetFloor && currentAptCode.toUpperCase() === aptCode) {
                        matchedUnitKey = key;
                        break;
                      }
                    }
                    if (matchedUnitKey) break;
                  }

                  if (matchedUnitKey) {
                    const matchedUnit = towerUnits?.find(u => u.unit_key === matchedUnitKey);
                    matchedResults.push({
                      unit_key: matchedUnitKey,
                      project_id: proj.id,
                      data: matchedUnit?.data || { status: 'available' }
                    });
                  }
                }
              }
            }
          }

          // البحث أيضاً عن أي تطابق نصي مباشر مخزن قديماً كاحتياط
          let rawQuery = supabase
            .from('houses_data')
            .select('unit_key, project_id, data')
            .eq('unit_key', trimmedQuery);
          if (searchProjectFilter !== 'all') {
            rawQuery = rawQuery.eq('project_id', searchProjectFilter);
          }
          const { data: rawData } = await rawQuery;
          if (rawData) {
            rawData.forEach(item => {
              if (!matchedResults.some(r => r.unit_key === item.unit_key)) {
                matchedResults.push(item);
              }
            });
          }

          setSearchResults(matchedResults.slice(0, searchLimit));
          setHasMoreResults(matchedResults.length > searchLimit);
        } else {
          // البحث الاعتيادي عن اسم الزبون، رمز المنزل، أو رقم الهاتف مع توحيد الحروف العربية ذكياً
          let query = supabase
            .from('houses_data')
            .select('unit_key, project_id, data');
          
          if (searchProjectFilter !== 'all') {
            query = query.eq('project_id', searchProjectFilter);
          }
          
          // بناء شروط البحث مع دعم رقم الهاتف وتوحيد الحروف العربية
          const orConditions = [
            `unit_key.ilike.%${trimmedQuery}%`,
            `data->>name.ilike.%${trimmedQuery}%`,
            `data->>phone.ilike.%${trimmedQuery}%`
          ];

          // توحيد الحروف العربية (أ، إ، آ -> ا) و (ة -> ه) و (ى -> ي)
          const normalizedTerm = trimmedQuery
            .replace(/[أإآ]/g, 'ا')
            .replace(/ة/g, 'ه')
            .replace(/ى/g, 'ي');

          if (normalizedTerm !== trimmedQuery) {
            orConditions.push(`data->>name.ilike.%${normalizedTerm}%`);
          }

          // معالجة الحالة العكسية (إذا كتب المستخدم ا والاسم مخزن بـ أ)
          const alternativeTerm = trimmedQuery
            .replace(/ا/g, 'أ')
            .replace(/ه/g, 'ة')
            .replace(/ي/g, 'ى');

          if (alternativeTerm !== trimmedQuery) {
            orConditions.push(`data->>name.ilike.%${alternativeTerm}%`);
          }
          
          query = query.or(orConditions.join(','));
          
          const { data, error } = await query.limit(searchLimit + 1);
          if (error) throw error;
          
          if (data && data.length > searchLimit) {
            setSearchResults(data.slice(0, searchLimit));
            setHasMoreResults(true);
          } else {
            setSearchResults(data || []);
            setHasMoreResults(false);
          }
        }
      } catch (e) {
        console.error("Error in general search:", e);
      } finally {
        setIsSearching(false);
      }
    };

    performSearch();
  }, [debouncedSearchQuery, searchProjectFilter, searchLimit]);

  const handleSearchInputChange = (val: string) => {
    setSearchQuery(val);
    setSearchLimit(10); // إعادة تعيين الحد عند تغيير نص البحث
  };

  const handleShowMore = (e: React.MouseEvent) => {
    e.stopPropagation(); // منع إغلاق القائمة
    setSearchLimit(prev => prev + 10);
  };

  const parseSearchClick = (item: any) => {
    const unitKey = item.unit_key;
    const projectId = item.project_id;
    
    setSelectedProjectId(projectId);
    
    if (unitKey.includes('_F') && unitKey.includes('_A')) {
      const towerId = unitKey.split('_F')[0];
      setPendingOpen({ elementId: towerId, isTower: true });
      setPendingApartmentKey(unitKey); // حفظ مفتاح الشقة لفتحها تلقائياً داخل العمارة
    } else {
      setPendingOpen({ elementId: unitKey, isTower: false });
      setPendingApartmentKey(null);
    }
    setSearchQuery('');
    setSearchResults([]);
    showSuccess(`جاري الانتقال وعرض الوحدة ${unitKey}...`);
  };

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
      
      const { data: settings } = await supabase.from('settings').select('*');
      if (settings) {
        const permsSetting = settings.find(s => s.key === 'dept_permissions');
        if (permsSetting && permsSetting.value && center.type) {
          const deptPerms = permsSetting.value[center.type];
          if (deptPerms) setPermissions(deptPerms);
        }

        const mainMap = settings.find(s => s.key === 'main_map_config');
        if (mainMap) setMainMapData(mainMap.value);

        const configs = settings.find(s => s.key === 'project_configs');
        if (configs) setProjectConfigs(configs.value || {});

        const lastUpdateSetting = settings.find(s => s.key === 'last_excel_update');
        if (lastUpdateSetting) setLastUpdate(lastUpdateSetting.value);
      }
      
      showSuccess(`مرحباً بك في مركز ${center.name}`);
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
      showSearchBox: true,
      canAccessReports: true
    });
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

  // دالة ذكية لحساب مساحة المنزل بناءً على المساحة المخصصة يدوياً أو الصنف القياسي
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

  // جلب إعادات الخلفية والشبكة المخصصة بناءً على المشروع الحالي أو المخطط العام
  const currentBgColor = selectedProjectId === 'main_map' 
    ? (mainMapData?.backgroundColor || '#ffffff') 
    : (projectConfigs[selectedProjectId || '']?.backgroundColor || '#ffffff');

  const currentShowGrid = selectedProjectId === 'main_map'
    ? (mainMapData?.showGrid !== false)
    : (projectConfigs[selectedProjectId || '']?.showGrid !== false);

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-100 mx-auto mb-6"><Store className="text-white w-10 h-10" /></div>
            <h1 className="text-2xl font-black text-slate-800">دخول المراكز التسويقية</h1>
            <p className="text-slate-500 font-medium mt-2">يرجى اختيار المركز وإدخال كلمة المرور</p>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 mr-2">المركز التسويقي</label>
              <div className="relative">
                <Select onValueChange={(val) => setLoginData({...loginData, centerId: val})}>
                  <SelectTrigger className="rounded-2xl h-14 border-slate-200 font-bold"><SelectValue placeholder="اختر المركز التسويقي..." /></SelectTrigger>
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
            {/* زر وزر إظهار آخر مزامنة للبيانات المالية */}
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
                {/* إتاحة خيار تصفح المخطط العام للمدينة كخيار تفاعلي وأساسي */}
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

        {/* مربع البحث العام الذكي والمحسن في صف مستقل أسفل الهيدر ليعطي مساحة كافية ومريحة */}
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
                placeholder="ابحث عن اسم زبون، رقم هاتف، أو رقم وحدة..." 
                value={searchQuery}
                onChange={(e) => handleSearchInputChange(e.target.value)}
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
            
            {/* قائمة نتائج البحث السريعة والتفاعلية */}
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
                {hasMoreResults && (
                  <div className="p-2 bg-slate-50 text-center">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleShowMore} 
                      className="text-xs font-black text-blue-600 hover:bg-blue-100 w-full rounded-xl"
                    >
                      إظهار المزيد من النتائج...
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* شريط تصفية الخريطة التفاعلية والتوهج البصري (Feature 6) */}
        {selectedProjectId !== 'main_map' && activeProject && (
          <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-2 text-slate-700 font-black text-xs shrink-0">
              <SlidersHorizontal size={16} className="text-blue-600 animate-pulse" />
              <span>تصفية الخريطة وتوهج الوحدات:</span>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-400">الزون:</span>
              <Select value={mapFilterZone} onValueChange={setMapFilterZone}>
                <SelectTrigger className="w-[110px] rounded-xl h-10 border-slate-200 text-xs font-bold bg-slate-50/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold text-xs">الكل</SelectItem>
                  {mapZones.map(z => (
                    <SelectItem key={z} value={z} className="font-bold text-xs">زون {z}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-400">الصنف:</span>
              <Select value={mapFilterClass} onValueChange={setMapFilterClass}>
                <SelectTrigger className="w-[110px] rounded-xl h-10 border-slate-200 text-xs font-bold bg-slate-50/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold text-xs">الكل</SelectItem>
                  {mapClasses.map(c => (
                    <SelectItem key={c} value={c} className="font-bold text-xs">صنف {c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-400">المساحة:</span>
              <Select value={mapFilterSize} onValueChange={setMapFilterSize}>
                <SelectTrigger className="w-[120px] rounded-xl h-10 border-slate-200 text-xs font-bold bg-slate-50/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold text-xs">الكل</SelectItem>
                  {mapSizes.map(s => (
                    <SelectItem key={s} value={s.toString()} className="font-bold text-xs">{s} م²</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <span className="font-bold text-slate-400">الحالة:</span>
              <Select value={mapFilterStatus} onValueChange={setMapFilterStatus}>
                <SelectTrigger className="w-[120px] rounded-xl h-10 border-slate-200 text-xs font-bold bg-slate-50/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold text-xs">كل الحالات</SelectItem>
                  <SelectItem value="available" className="font-bold text-xs text-emerald-600">🟢 متوفر</SelectItem>
                  <SelectItem value="sold" className="font-bold text-xs text-rose-600">🔴 مباع</SelectItem>
                  <SelectItem value="investment" className="font-bold text-xs text-purple-600">🟣 استثمار</SelectItem>
                  <SelectItem value="reserved" className="font-bold text-xs text-amber-600">🟡 محجوز</SelectItem>
                  <SelectItem value="pending" className="font-bold text-xs text-blue-600">🔵 حجز أولي</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(mapFilterZone !== 'all' || mapFilterClass !== 'all' || mapFilterSize !== 'all' || mapFilterStatus !== 'all') && (
              <Button 
                variant="ghost" 
                onClick={() => { setMapFilterZone('all'); setMapFilterClass('all'); setMapFilterSize('all'); setMapFilterStatus('all'); }}
                className="text-xs font-black text-rose-500 hover:bg-rose-50 rounded-xl h-10 px-3 shrink-0"
              >
                إعادة ضبط
              </Button>
            )}
          </div>
        )}

        {/* شريط فرعي أسفل الهيدر يحتوي على زر التقارير والتحليلات بشكل مستقل وأنيق */}
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
                  houseTypeAreas={projectConfigs[selectedProjectId || '']?.houseTypeAreas || {}}
                />
                {permissions.showStatsTable && <DetailedStatsTable elements={activeElements} housesData={housesData} permissions={permissions} />}
              </>
            ) : (
              <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center"><MapIcon className="mx-auto mb-4 opacity-10" size={80} /><h2 className="text-xl font-bold text-slate-400">لا توجد مشاريع متاحة للعرض</h2></div>
            )}
          </div>

          {selectedProjectId !== 'main_map' && (permissions.showGeneralStats || permissions.showNotifications) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
              
              {/* التنبيهات الذكية وجدولة تمديد الحجوزات التي توشك صلاحيتها على الانتهاء (Feature 8) */}
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