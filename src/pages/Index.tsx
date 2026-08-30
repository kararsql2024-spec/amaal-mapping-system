"use client";

import React, { useState, useEffect, useRef } from 'react';
import InteractiveMap from '@/components/InteractiveMap';
import UnitDetailsModal from '@/components/UnitDetailsModal';
import TowerDetailsModal from '@/components/TowerDetailsModal';
import DetailedStatsTable from '@/components/DetailedStatsTable';
import DiagnosticTerminal from '@/components/DiagnosticTerminal';
import { showSuccess, showError } from '@/utils/toast';
import {
  Map as MapIcon, ChevronDown, ChevronUp, LogOut, Bell,
  Clock, Info, Search, RefreshCcw, X, AlertTriangle, Trash2, Archive
} from 'lucide-react';
import { AppShell, Eyebrow, StatGrid, QuickStatGrid, EmptyState, LoadingBlock } from '@/components/layout/AppShell';
import { BrandMark, BrandWordmark } from '@/components/layout/Brand';
import { StatusBadge } from '@/components/StatusBadge';
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
import { canAccessPaymentArchive } from "@/lib/dept-permissions";
import { getHouseArea as getHouseAreaFor } from "@/lib/units";
import {
  fetchWithRetry,
  fetchNativeSupabase,
  fetchMainMapVersion,
  fetchProjectUnitsParallel,
  formatLightweightUnits,
} from "@/lib/supabase-rest";
import {
  readMainMapCache,
  writeMainMapCache,
  clearMainMapCache,
  clearProjectCache,
  readProjectCache,
  writeProjectCache,
  fingerprintMainMap,
  isProjectCacheFresh,
} from "@/lib/map-cache";
import {
  fetchCenterSubscriptions,
  getCenterSubscription,
  evaluateCenterSubscription,
  formatSubscriptionDate,
  type CenterSubscriptions,
  type CenterSubscription,
} from "@/lib/center-subscription";
import {
  SubscriptionBlockedScreen,
  type SubscriptionBlockReason,
} from "@/components/SubscriptionBlockedScreen";
import {
  centerSessionToRecord,
  clearCenterSession,
  getStoredCenterSessionToken,
  persistCenterSession,
  revokeCenterSession,
  validateCenterSession,
  verifyCenterLogin,
  formatCenterLoginError,
} from "@/lib/center-auth";

interface IndexProps {
  projects: Project[];
  housesData: Record<string, any>;
  setHousesData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
}

const Index = ({ projects, setHousesData }: IndexProps) => {
  const fetchGenerationRef = useRef(0);
  const [unitsByProject, setUnitsByProject] = useState<Record<string, Record<string, any>>>({});
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
  const [centerSubscriptions, setCenterSubscriptions] = useState<CenterSubscriptions>({});
  const [subscriptionWarning, setSubscriptionWarning] = useState<{ daysRemaining: number; endDate: string } | null>(null);
  const [subscriptionBlock, setSubscriptionBlock] = useState<{
    reason: SubscriptionBlockReason;
    centerName?: string;
    endDate?: string;
    notes?: string;
  } | null>(null);
  
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
    showBrochureButton: true,
    canAccessPaymentForm: true,
    showPaymentPlanButton: true,
    canAccessPaymentArchive: true,
  });

  const activeUnitsData = React.useMemo(() => {
    if (!selectedProjectId || selectedProjectId === "main_map") return {};
    return unitsByProject[selectedProjectId] ?? {};
  }, [selectedProjectId, unitsByProject]);

  const patchProjectUnits = (
    projectId: string,
    updater: (prev: Record<string, any>) => Record<string, any>,
  ) => {
    setUnitsByProject((prev) => {
      const nextUnits = updater(prev[projectId] ?? {});
      const next = { ...prev, [projectId]: nextUnits };
      if (selectedProjectId === projectId) {
        setHousesData(nextUnits);
      }
      return next;
    });
  };

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
      const data = activeUnitsData[key];
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
                const innerData = activeUnitsData[innerKey];
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
  }, [selectedProjectId, activeProject, activeElements, activeUnitsData]);

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

      patchProjectUnits(selectedProjectId, (prev) => ({ ...prev, [key]: updatedData }));
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
          if (updatedUnit?.unit_key && selectedProjectId) {
            patchProjectUnits(selectedProjectId, (prev) => ({
              ...prev,
              [updatedUnit.unit_key]: {
                ...prev[updatedUnit.unit_key],
                ...updatedUnit.data,
              },
            }));
            addDiagLog(`تحديث Real-time للوحدة ${updatedUnit.unit_key}`, 'warn');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProjectId, setHousesData]);

  // التوجيه الافتراضي: المخطط العام للمدينة لجميع المستخدمين
  useEffect(() => {
    if (isAuthChecking) return;
    if (!selectedProjectId) {
      setSelectedProjectId('main_map');
    }
  }, [selectedProjectId, isAuthChecking]);

  const handleLogout = () => {
    void revokeCenterSession(supabase);
    setIsLoggedIn(false);
    setCurrentCenter(null);
    setSubscriptionWarning(null);
    setSubscriptionBlock(null);
    setLoginData({ centerId: '', password: '' });
    clearCenterSession();
  };

  const blockSubscriptionAccess = (
    reason: SubscriptionBlockReason,
    center?: { id?: string; name?: string } | null,
    subscription?: CenterSubscription,
  ) => {
    const resolvedSubscription =
      subscription ?? getCenterSubscription(centerSubscriptions, center?.id);

    setIsLoggedIn(false);
    setCurrentCenter(null);
    setSubscriptionWarning(null);
    setLoginData({ centerId: center?.id || '', password: '' });
    clearCenterSession();
    setSubscriptionBlock({
      reason,
      centerName: center?.name,
      endDate: resolvedSubscription.subscription_end,
      notes: resolvedSubscription.subscription_notes,
    });
  };

  const applySubscriptionAccess = (centerId: string, subscriptions: CenterSubscriptions) => {
    const subscription = getCenterSubscription(subscriptions, centerId);
    const access = evaluateCenterSubscription(subscription);
    if (!access.allowed) {
      setSubscriptionWarning(null);
      return { ok: false as const, reason: access.reason };
    }
    setSubscriptionWarning(access.warning ?? null);
    return { ok: true as const };
  };

  // المراقبة اللحظية — إنهاء الجلسة عند تغيير بيانات القسم أو حذفه
  useEffect(() => {
    if (!currentCenter?.id || !isLoggedIn) return;

    const invalidateSessionIfNeeded = async (message: string) => {
      const { session } = await validateCenterSession(supabase);
      if (!session) {
        clearCenterSession();
        setIsLoggedIn(false);
        setCurrentCenter(null);
        setSubscriptionWarning(null);
        setLoginData({ centerId: '', password: '' });
        showError(message);
      }
    };

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
        () => {
          void invalidateSessionIfNeeded(
            "تم تحديث بيانات هذا القسم من قِبل الإدارة. يرجى إعادة تسجيل الدخول.",
          );
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
        const { data: centers } = await supabase
          .from('marketing_centers')
          .select('id, name, type');
        if (centers) setMarketingCenters(centers);

        const subscriptions = await fetchCenterSubscriptions(supabase);
        setCenterSubscriptions(subscriptions);

        const savedToken = getStoredCenterSessionToken();
        if (savedToken) {
          const { session } = await validateCenterSession(supabase, savedToken);

          if (session) {
            const centerRecord = centerSessionToRecord(session);
            const subscriptionAccess = applySubscriptionAccess(session.id, subscriptions);
            if (!subscriptionAccess.ok) {
              blockSubscriptionAccess(
                subscriptionAccess.reason!,
                centerRecord,
                getCenterSubscription(subscriptions, session.id),
              );
              return;
            }

            const { data: settings } = await supabase
              .from('settings')
              .select('key, value')
              .in('key', ['dept_permissions', 'project_configs', 'last_excel_update']);

            if (settings) {
              const permsSetting = settings.find(s => s.key === 'dept_permissions');
              if (permsSetting && permsSetting.value && session.type) {
                const deptPerms = permsSetting.value[session.type];
                if (deptPerms) setPermissions(deptPerms);
              }

              const configs = settings.find(s => s.key === 'project_configs');
              if (configs) setProjectConfigs(configs.value || {});

              const lastUpdateSetting = settings.find(s => s.key === 'last_excel_update');
              if (lastUpdateSetting) setLastUpdate(lastUpdateSetting.value);
            }

            persistCenterSession(session);
            setCurrentCenter(centerRecord);
            setIsLoggedIn(true);
          } else {
            clearCenterSession();
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
    if (!isLoggedIn || !currentCenter?.id) return;

    const refreshSubscriptionAccess = async () => {
      try {
        const subscriptions = await fetchCenterSubscriptions(supabase);
        setCenterSubscriptions(subscriptions);
        const access = applySubscriptionAccess(currentCenter.id, subscriptions);
        if (!access.ok) {
          blockSubscriptionAccess(
            access.reason!,
            currentCenter,
            getCenterSubscription(subscriptions, currentCenter.id),
          );
        }
      } catch (error) {
        console.error("Error refreshing subscription access:", error);
      }
    };

    const intervalId = window.setInterval(refreshSubscriptionAccess, 5 * 60 * 1000);
    return () => window.clearInterval(intervalId);
  }, [isLoggedIn, currentCenter?.id]);

  useEffect(() => {
    setMapFilterZone('all');
    setMapFilterClass('all');
    setMapFilterSize('all');
    setMapFilterStatus('all');
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || !isLoggedIn) return;

    const generation = ++fetchGenerationRef.current;
    const isStale = () => generation !== fetchGenerationRef.current;

    if (selectedProjectId === 'main_map') {
      setHousesData({});
      setSelectedElementId(null);

      const loadMainMap = async () => {
        const cached = readMainMapCache();

        if (cached.config) {
          setMainMapData(cached.config);
          setActiveElements((cached.config.elements as MapElement[]) || []);
          addDiagLog('عرض المخطط العام من الكاش المحلي', 'success');
        } else {
          setActiveElements([]);
          setIsProjectLoading(true);
        }

        try {
          const serverVersion = await fetchWithRetry(() => fetchMainMapVersion());

          if (isStale()) return;

          if (
            cached.config &&
            serverVersion &&
            cached.version === serverVersion &&
            cached.isFresh
          ) {
            addDiagLog('المخطط العام محدّث — لا حاجة لإعادة التحميل', 'success');
            return;
          }

          const rows = await fetchWithRetry(async () => {
            const res = await fetchNativeSupabase(
              'settings?select=key,value&key=in.(main_map_config,main_map_version)',
            );
            if (!res?.length) throw new Error('No settings found');
            return res;
          });

          if (isStale()) return;

          const configRow = rows.find((r: { key: string }) => r.key === 'main_map_config');
          const versionRow = rows.find((r: { key: string }) => r.key === 'main_map_version');
          if (!configRow?.value) throw new Error('No main_map_config found');

          const config = configRow.value;
          const resolvedVersion =
            versionRow?.value != null
              ? String(versionRow.value)
              : serverVersion ?? fingerprintMainMap(config);

          if (
            cached.config &&
            cached.version === resolvedVersion &&
            cached.isFresh
          ) {
            addDiagLog('المخطط العام محدّث — لا حاجة لإعادة التحميل', 'success');
            return;
          }

          setMainMapData(config);
          setActiveElements(config.elements || []);
          writeMainMapCache(config, resolvedVersion);
          addDiagLog('تم مزامنة المخطط العام من السيرفر', 'success');
        } catch (e: unknown) {
          if (isStale()) return;
          const message = e instanceof Error ? e.message : String(e);
          console.error('Main map load error:', e);
          if (cached.config) {
            addDiagLog('فشل تحديث المخطط العام — الاعتماد على الكاش', 'warn');
          } else {
            setActiveElements([]);
            addDiagLog(`تعذر تحميل المخطط العام: ${message}`, 'danger');
            showError('تعذر تحميل المخطط العام حالياً، يرجى إعادة المحاولة.');
          }
        } finally {
          if (!isStale()) setIsProjectLoading(false);
        }
      };

      loadMainMap();
      return;
    }

    const projectId = selectedProjectId;
    const projectAllowed = filteredProjects.some((p) => p.id === projectId);

    if (!projectAllowed) {
      setActiveElements([]);
      setHousesData({});
      setIsProjectLoading(false);
      return;
    }

    setSelectedElementId(null);
    const sessionCached = readProjectCache(projectId);
    const memoryCached = unitsByProject[projectId];

    if (sessionCached) {
      setActiveElements(sessionCached.elements as MapElement[]);
      setUnitsByProject((prev) => ({ ...prev, [projectId]: sessionCached.units as Record<string, any> }));
      setHousesData(sessionCached.units as Record<string, any>);
    } else if (memoryCached) {
      setHousesData(memoryCached);
    } else {
      setActiveElements([]);
      setHousesData({});
    }

    const loadProject = async () => {
      const hadInstantCache = !!(sessionCached || memoryCached);
      if (!hadInstantCache) setIsProjectLoading(true);

      if (sessionCached && isProjectCacheFresh(sessionCached)) {
        addDiagLog(
          `المشروع (${activeProject?.name || projectId}) من الكاش — بدون إعادة جلب`,
          'success',
        );
        return;
      }

      const startTime = performance.now();
      try {
        const projectDetails = await fetchWithRetry(async () => {
          const res = await fetchNativeSupabase(
            `projects?select=elements&id=eq.${projectId}`,
          );
          if (!res?.length) throw new Error('Project not found');
          return res[0];
        });

        if (isStale()) return;

        const elements = (projectDetails?.elements || []) as MapElement[];
        setActiveElements(elements);

        const allUnits = await fetchProjectUnitsParallel(projectId);
        if (isStale()) return;

        const formattedUnits = formatLightweightUnits(allUnits);
        setUnitsByProject((prev) => ({ ...prev, [projectId]: formattedUnits }));
        setHousesData(formattedUnits);
        writeProjectCache(projectId, elements, formattedUnits);

        setTimeout(() => {
          if (!isStale()) checkExpiredBookings(allUnits, projectId);
        }, 0);

        const totalTime = performance.now() - startTime;
        addDiagLog(
          `استعادة المشروع (${activeProject?.name || projectId}): ${totalTime.toFixed(0)}ms — ${allUnits.length} وحدة`,
          'success',
        );
      } catch (error) {
        if (isStale()) return;
        console.error('Error loading project data:', error);
        if (!hadInstantCache) {
          setActiveElements([]);
          setHousesData({});
        }
        addDiagLog('خطأ في جلب بيانات المشروع', 'danger');
        showError('فشل في تحميل بيانات المشروع. يرجى المحاولة مجدداً.');
      } finally {
        if (!isStale()) setIsProjectLoading(false);
      }
    };

    loadProject();
  }, [selectedProjectId, isLoggedIn, setHousesData, filteredProjects]);

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

    if (!filteredProjects.some((p) => p.id === projectId) && currentCenter?.allowed_projects?.length) {
      showError('لا تملك صلاحية الوصول إلى مشروع هذه الوحدة');
      return;
    }

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
      
      patchProjectUnits(projectId, (prev) => {
        const next = { ...prev };
        expiredUnits.forEach((u) => { next[u.unit_key] = u.data; });
        return next;
      });
    }
  };

  const handleLogin = async () => {
    if (!loginData.centerId) {
      showError("يرجى اختيار القسم أولاً");
      return;
    }
    if (!loginData.password.trim()) {
      showError("يرجى إدخال كلمة المرور");
      return;
    }

    setIsAuthChecking(true);
    try {
      const { session, error, retryAfterSeconds } = await verifyCenterLogin(
        supabase,
        loginData.centerId,
        loginData.password,
      );

      if (!session) {
        showError(formatCenterLoginError(error, retryAfterSeconds));
        return;
      }

      const centerRecord = centerSessionToRecord(session);
      const subscriptions = await fetchCenterSubscriptions(supabase);
      setCenterSubscriptions(subscriptions);
      const subscriptionAccess = applySubscriptionAccess(session.id, subscriptions);
      if (!subscriptionAccess.ok) {
        blockSubscriptionAccess(
          subscriptionAccess.reason!,
          centerRecord,
          getCenterSubscription(subscriptions, session.id),
        );
        return;
      }

      const { data: settings } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['dept_permissions', 'project_configs', 'last_excel_update']);

      if (settings) {
        const permsSetting = settings.find(s => s.key === 'dept_permissions');
        if (permsSetting && permsSetting.value && session.type) {
          const deptPerms = permsSetting.value[session.type];
          if (deptPerms) setPermissions(deptPerms);
        }

        const configs = settings.find(s => s.key === 'project_configs');
        if (configs) setProjectConfigs(configs.value || {});

        const lastUpdateSetting = settings.find(s => s.key === 'last_excel_update');
        if (lastUpdateSetting) setLastUpdate(lastUpdateSetting.value);
      }

      persistCenterSession(session);
      setCurrentCenter(centerRecord);
      setIsLoggedIn(true);
      setLoginData((prev) => ({ ...prev, password: '' }));
      showSuccess(`مرحباً بك في مركز ${session.name}`);
    } catch (err) {
      console.error("Error confirming permissions on login:", err);
      showError("حدث خطأ أثناء تحميل صلاحيات القسم");
    } finally {
      setIsAuthChecking(false);
    }
  };

  const handleElementClick = async (id: string) => {
    const element = activeElements.find(el => el.id === id);
    if (!element) return;

    if (element.linkProjectId) {
      const linkedP = filteredProjects.find(p => p.id === element.linkProjectId)
        ?? projects.find(p => p.id === element.linkProjectId);
      if (linkedP && filteredProjects.some(p => p.id === element.linkProjectId)) {
        setSelectedProjectId(element.linkProjectId);
        setSelectedElementId(null);
        showSuccess(`تم الانتقال التلقائي لمخطط: ${linkedP.name}`);
      } else if (linkedP) {
        showError("لا تملك صلاحية الوصول إلى هذا المشروع");
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
        const fullUnit = await fetchWithRetry(async () => {
          const { data, error } = await supabase
            .from('houses_data')
            .select('unit_key, project_id, data')
            .eq('project_id', selectedProjectId)
            .eq('unit_key', id)
            .maybeSingle();
          if (error) throw error;
          return data;
        });

        if (fullUnit?.data && selectedProjectId) {
          patchProjectUnits(selectedProjectId, (prev) => ({
            ...prev,
            [id]: fullUnit.data,
          }));
        }
        const endTime = performance.now();
        addDiagLog(`جلب التفاصيل الكاملة للمنزل ${id}: ${(endTime - startTime).toFixed(1)} ملي ثانية`, 'info');
        setIsUnitModalOpen(true);
      } else if (element.type === 'tower') {
        const towerUnits = await fetchWithRetry(async () => {
          const { data, error } = await supabase
            .from('houses_data')
            .select('unit_key, project_id, data')
            .eq('project_id', selectedProjectId)
            .like('unit_key', `${id}_%`);
          if (error) throw error;
          return data;
        });

        if (towerUnits?.length && selectedProjectId) {
          patchProjectUnits(selectedProjectId, (prev) => {
            const next = { ...prev };
            towerUnits.forEach((u) => {
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
      patchProjectUnits(selectedProjectId, (prev) => ({ ...prev, [key]: data }));
      addDiagLog(`حفظ وتحديث الوحدة ${key} بنجاح`, 'success');
      showSuccess(`تم تحديث البيانات بنجاح`);
    } catch (error) { showError("فشل في حفظ البيانات"); }
  };

  const calculateStats = () => {
    if (selectedProjectId === 'main_map' || !activeProject || !activeElements) {
      return { total: 0, sold: 0, investment: 0, available: 0, promoted: 0, notPromoted: 0, receivedTabo: 0, receivedUnit: 0, notReceivedUnit: 0 };
    }
    let total = 0; let sold = 0; let investment = 0; let available = 0;
    let promoted = 0; let notPromoted = 0; let receivedTabo = 0;
    let receivedUnit = 0; let notReceivedUnit = 0;

    const processUnit = (data: any) => {
      const status = data?.status ?? 'available';
      if (status === 'frozen_hidden') return;
      
      if (status !== 'frozen_uncounted') total++;
      if (status === 'sold') sold++;
      else if (status === 'investment') investment++;
      else if (status === 'available') available++;

      const tabo = data?.taboStatus?.trim();
      if (tabo === 'مروج') promoted++;
      else if (tabo === 'مستلم') receivedTabo++;
      else notPromoted++;

      if (data?.handoverDate) receivedUnit++;
      else notReceivedUnit++;
    };

    activeElements.forEach(el => {
      if (el.type === 'house') {
        processUnit(activeUnitsData[el.id]);
      } else if (el.type === 'tower') {
        const floors = el.floors || 0;
        const aptsPerFloor = el.apartmentsPerFloor || 0;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            processUnit(activeUnitsData[`${el.id}_F${f}_A${a}`]);
          }
        }
      }
    });
    return { total, sold, investment, available, promoted, notPromoted, receivedTabo, receivedUnit, notReceivedUnit };
  };

  const stats = calculateStats();

  const getNotificationColor = (message: string) => {
    if (message.includes('مباع') || message.includes('بيع')) return 'border-status-sold/30 bg-status-sold/[0.06]';
    if (message.includes('استثمار')) return 'border-status-investment/30 bg-status-investment/[0.06]';
    if (message.includes('متوفر') || message.includes('انتهى الحجز')) return 'border-status-pending/30 bg-status-pending/[0.06]';
    return 'border-line bg-surface-sunken';
  };

  const getHouseArea = (el: MapElement) =>
    getHouseAreaFor(el, projectConfigs[selectedProjectId || '']?.houseTypeAreas || {});

  const currentBgColor = selectedProjectId === 'main_map' 
    ? (mainMapData?.backgroundColor || '#ffffff') 
    : (projectConfigs[selectedProjectId || '']?.backgroundColor || '#ffffff');

  const currentShowGrid = selectedProjectId === 'main_map'
    ? (mainMapData?.showGrid !== false)
    : (projectConfigs[selectedProjectId || '']?.showGrid !== false);

  const handleClearCache = () => {
    clearMainMapCache();
    clearProjectCache();
    addDiagLog("تم تفريغ كاش المخططات بنجاح! جاري إعادة التحميل...", "success");
    showSuccess("تم تفريغ الكاش بنجاح!");
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  if (isAuthChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-1.5" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1 w-6 animate-pulse bg-line-strong"
                style={{ animationDelay: `${i * 160}ms` }}
              />
            ))}
          </div>
          <p className="text-[13px] text-fg-muted">جاري التحقق من الجلسة والصلاحيات</p>
        </div>
      </div>
    );
  }

  if (subscriptionBlock) {
    return (
      <SubscriptionBlockedScreen
        reason={subscriptionBlock.reason}
        centerName={subscriptionBlock.centerName}
        endDate={subscriptionBlock.endDate}
        notes={subscriptionBlock.notes}
        onBackToLogin={() => setSubscriptionBlock(null)}
      />
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="border-b border-line">
          <div className="mx-auto flex h-14 max-w-[1440px] items-center px-5 lg:px-8">
            <div className="flex items-center gap-2.5">
              <BrandMark />
              <BrandWordmark />
            </div>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center px-5 py-16">
          <div className="w-full max-w-[380px]">
            <Eyebrow>الدخول</Eyebrow>
            <h1 className="mt-3 text-[34px] font-light leading-[1.1] tracking-display text-fg">
              إدارة الوحدات
              <br />
              السكنية
            </h1>
            <p className="mt-3 text-[13px] leading-relaxed text-fg-muted">
              اختر القسم وأدخل كلمة المرور للوصول إلى المخططات وبيانات المبيعات.
            </p>

            <form
              onSubmit={(e) => { e.preventDefault(); handleLogin(); }}
              className="mt-10 space-y-5 border-t border-line pt-8"
            >
              <div className="space-y-2">
                <label className="block text-xs font-medium text-fg-secondary">
                  القسم / مركز التسويق
                </label>
                <Select value={loginData.centerId} onValueChange={(val) => setLoginData({ ...loginData, centerId: val })}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketingCenters.map(center => (
                      <SelectItem key={center.id} value={center.id}>
                        <span className="flex items-center gap-2">
                          {center.name}
                          <span className="text-[11px] text-fg-faint">{center.type}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium text-fg-secondary">
                  كلمة المرور
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="h-10"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                />
              </div>

              <Button type="submit" size="lg" className="w-full">
                تسجيل الدخول
              </Button>
            </form>
          </div>
        </div>

        <footer className="border-t border-line">
          <div className="mx-auto flex h-12 max-w-[1440px] items-center justify-between px-5 lg:px-8">
            <span className="eyebrow">Amaal</span>
            <span className="text-[11px] text-fg-faint">برمجة وتطوير: كرار عبدالكريم</span>
          </div>
        </footer>
      </div>
    );
  }

  const primaryStatCells = [
    permissions.showSideTotal && { label: 'إجمالي الوحدات', value: stats.total, statusKey: 'total' as const },
    permissions.showSideSold && { label: 'المباعة', value: stats.sold, statusKey: 'sold' as const },
    permissions.showSideInvestment && { label: 'الاستثمار', value: stats.investment, statusKey: 'investment' as const },
    permissions.showSideAvailable && { label: 'المتاحة', value: stats.available, statusKey: 'available' as const },
  ].filter(Boolean) as { label: string; value: number; statusKey: 'total' | 'sold' | 'investment' | 'available' }[];

  const legalStatCells = [
    permissions.showSidePromoted && { label: 'مروج', value: stats.promoted },
    permissions.showSideNotPromoted && { label: 'غير مروج', value: stats.notPromoted },
    permissions.showSideReceivedTabo && { label: 'مستلم الطابو', value: stats.receivedTabo },
    permissions.showSideReceivedUnit && { label: 'مستلم الوحدة', value: stats.receivedUnit },
    permissions.showSideNotReceivedUnit && { label: 'غير مستلم الوحدة', value: stats.notReceivedUnit },
  ].filter(Boolean) as { label: string; value: number }[];

  const isMainMap = selectedProjectId === 'main_map';
  const showStatsBand = !isMainMap && permissions.showGeneralStats;

  return (
    <AppShell
      brandSubtitle={currentCenter ? currentCenter.name : undefined}
      nav={
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-fg">
                {isMainMap ? 'المخطط العام للمدينة' : (activeProject?.name || 'اختر المخطط')}
                <ChevronDown size={13} className="text-fg-faint" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-[220px]">
              <DropdownMenuItem onClick={() => setSelectedProjectId('main_map')}>
                المخطط العام للمدينة
              </DropdownMenuItem>
              <div className="my-1 h-px bg-line" />
              {filteredProjects.map(p => (
                <DropdownMenuItem key={p.id} onClick={() => setSelectedProjectId(p.id)}>
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {permissions.canAccessReports !== false && (
            <Link to="/reports">
              <Button variant="ghost" size="sm" className="px-2">التقارير</Button>
            </Link>
          )}

          {canAccessPaymentArchive(permissions) && (
            <Link to="/sales/archive">
              <Button variant="ghost" size="sm" className="gap-1.5 px-2">
                <Archive size={14} />
                أرشيف الدفعات
              </Button>
            </Link>
          )}
        </>
      }
      actions={
        <>
          {lastUpdate && (
            <span className="hidden items-center gap-1.5 text-[11px] text-fg-faint md:flex">
              <RefreshCcw size={11} className="animate-spin-slow" />
              آخر مزامنة
              <span className="text-fg-secondary tabular">
                {new Date(lastUpdate).toLocaleString('ar-EG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </span>
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 px-2">
            <LogOut size={14} /> خروج
          </Button>
        </>
      }
    >
      {isLoggedIn && permissions.showDiagnosticTerminal !== false && (
        <DiagnosticTerminal
          logs={diagLogs}
          onClearLogs={() => setDiagLogs([])}
        />
      )}

      {subscriptionWarning && (
        <div className="mb-6 flex items-start gap-3 border border-status-reserved/30 bg-status-reserved/10 px-4 py-3.5">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-reserved" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-fg">تنبيه: اشتراك القسم على وشك الانتهاء</p>
            <p className="mt-1 text-[12px] leading-relaxed text-fg-secondary">
              متبقي{" "}
              <span className="font-medium tabular-nums text-fg">
                {subscriptionWarning.daysRemaining}
              </span>{" "}
              {subscriptionWarning.daysRemaining === 1 ? "يوم" : "أيام"}{" "}
              على انتهاء الاشتراك
              {subscriptionWarning.endDate ? (
                <>
                  {" "}
                  (<span className="text-fg">{formatSubscriptionDate(subscriptionWarning.endDate)}</span>)
                </>
              ) : null}
              . للتجديد، تواصل مع مشرف النظام.
            </p>
          </div>
        </div>
      )}

      {/* Page title */}
      <div className="flex flex-col gap-5 py-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <Eyebrow>{isMainMap ? "نظرة عامة" : "المخطط السكني"}</Eyebrow>
          <h1 className="mt-3 text-[32px] font-light leading-[1.08] tracking-display text-fg lg:text-[40px]">
            {isMainMap ? 'المخطط العام للمدينة' : (activeProject?.name || 'لا يوجد مخطط محدد')}
          </h1>
        </div>
        {currentCenter && (
          <div className="flex items-center gap-2.5 text-[13px]">
            <span className="font-medium text-fg-secondary">القسم</span>
            <span className="border border-line px-2.5 py-1 font-medium text-fg">
              {currentCenter.name}
            </span>
          </div>
        )}
      </div>

      {/* Search */}
      {permissions.showSearchBox !== false && (
        <div className="relative z-30 border-y border-line">
          <div className="flex flex-col gap-px bg-line sm:flex-row">
            <div className="w-full bg-background sm:w-56">
              <Select value={searchProjectFilter} onValueChange={(val) => { setSearchProjectFilter(val); setSearchLimit(10); }}>
                <SelectTrigger className="h-12 rounded-none border-0 px-4 text-[13px] hover:bg-surface-sunken focus:border-0">
                  <SelectValue placeholder="كل المشاريع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المشاريع</SelectItem>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="relative flex-1 bg-background">
              <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-faint" />
              <Input
                type="text"
                placeholder="ابحث باسم الزبون، رقم الهاتف، أو رمز الوحدة"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-12 rounded-none border-0 bg-transparent ps-11 pe-11 text-[13px] focus-visible:border-0"
              />
              {isSearching && (
                <span className="absolute end-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border border-line-strong border-t-fg" />
              )}
              {!isSearching && searchQuery && (
                <button
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="absolute end-4 top-1/2 -translate-y-1/2 text-fg-faint transition-colors hover:text-fg"
                  aria-label="مسح البحث"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {searchResults.length > 0 && (
            <div className="absolute inset-x-0 top-full z-[999] max-h-80 overflow-y-auto border-x border-b border-line bg-card shadow-2xl">
              {searchResults.map((item) => {
                const projName = projects.find(p => p.id === item.project_id)?.name || 'المخطط العام';
                return (
                  <button
                    key={item.unit_key}
                    onClick={() => parseSearchClick(item)}
                    className="flex w-full flex-col gap-1.5 border-b border-line px-4 py-3 text-start transition-colors last:border-b-0 hover:bg-surface-sunken"
                  >
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="truncate text-[13px] font-medium text-fg">
                        {item.data?.name ? item.data.name : `الوحدة ${item.unit_key}`}
                      </span>
                      <StatusBadge status={item.data?.status} />
                    </div>
                    <div className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fg-muted">
                      <span className="font-mono text-fg-secondary">{item.unit_key}</span>
                      {item.data?.phone && <span className="tabular">{item.data.phone}</span>}
                      <span className="ms-auto text-fg-faint">{projName}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Expiring bookings */}
      {!isMainMap && expiringSoonBookings.length > 0 && (
        <section className="mt-10 border border-status-reserved/35 bg-status-reserved/[0.05]">
          <div className="flex items-center gap-2 border-b border-status-reserved/25 px-4 py-3">
            <AlertTriangle size={14} className="shrink-0 text-status-reserved" />
            <span className="text-[13px] font-medium text-fg">حجوزات أولية توشك على الانتهاء</span>
            <span className="eyebrow ms-auto">{expiringSoonBookings.length}</span>
          </div>
          <div className="max-h-56 divide-y divide-status-reserved/20 overflow-y-auto no-scrollbar">
            {expiringSoonBookings.map((b) => (
              <div key={b.key} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] text-fg">{b.label}</p>
                  <p className="mt-0.5 text-[11px] text-fg-muted">
                    متبقي <span className="tabular text-status-reserved">{b.daysLeft}</span> يوم — تاريخ الحجز {b.data.saleDate}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => handleExtendBooking(b.key, b.data)} className="shrink-0">
                  تمديد 7 أيام
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Statistics */}
      {showStatsBand && primaryStatCells.length > 0 && (
        <div className="mt-10">
          <QuickStatGrid items={primaryStatCells} columns={4} />
        </div>
      )}
      {showStatsBand && legalStatCells.length > 0 && (
        <div className={cn(primaryStatCells.length > 0 ? "-mt-px" : "mt-10")}>
          <StatGrid items={legalStatCells} columns={5} numbered={false} />
        </div>
      )}

      {/* Map */}
      <section className="mt-10">
        {isProjectLoading ? (
          <LoadingBlock label="جاري تحميل تفاصيل المخطط" />
        ) : isMainMap ? (
          <InteractiveMap
            elements={activeElements}
            onHouseClick={handleElementClick}
            housesData={activeUnitsData}
            mapWidth={mainMapData?.width || 1200}
            mapHeight={mainMapData?.height || 800}
            backgroundColor={currentBgColor}
            showGrid={currentShowGrid}
            permissions={permissions}
            showTooltips={false}
          />
        ) : activeProject ? (
          <div className="space-y-10">
            <InteractiveMap
              elements={activeElements}
              onHouseClick={handleElementClick}
              selectedHouseId={selectedElementId}
              housesData={activeUnitsData}
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
            {permissions.showStatsTable && (
              <DetailedStatsTable elements={activeElements} housesData={activeUnitsData} permissions={permissions} />
            )}
          </div>
        ) : (
          <EmptyState
            icon={<MapIcon size={28} strokeWidth={1.25} />}
            title="لا توجد مشاريع متاحة للعرض"
            description="لم يتم إسناد أي مخطط سكني إلى هذا القسم بعد."
          />
        )}
      </section>

      {/* Notifications */}
      {!isMainMap && permissions.showNotifications && (
        <section className="mt-10 border border-line bg-surface">
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3.5 text-start transition-colors hover:bg-surface-sunken"
            onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
          >
            <Bell size={14} className="text-fg-muted" />
            <span className="text-[13px] font-medium text-fg">الإشعارات</span>
            <span className="border border-line px-1.5 py-0.5 text-[11px] tabular text-fg-muted">
              {notifications.length}
            </span>
            <span className="ms-auto text-fg-faint">
              {isNotificationsOpen ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
            </span>
          </button>

          {isNotificationsOpen && (
            <div className="h-[380px] border-t border-line">
              <ScrollArea className="h-full w-full">
                {notifications.length > 0 ? (
                  <div className="space-y-2 p-4">
                    {notifications.map((notif) => (
                      <div key={notif.id} className={cn("border px-3.5 py-3", getNotificationColor(notif.message))}>
                        <p className="text-[13px] leading-relaxed text-fg">{notif.message}</p>
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-fg-faint">
                          <Clock size={11} /> {new Date(notif.created_at).toLocaleString('ar-EG')}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-[380px] flex-col items-center justify-center gap-2 text-fg-faint">
                    <Info size={22} strokeWidth={1.25} />
                    <p className="text-[13px]">لا توجد إشعارات حالياً</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          )}
        </section>
      )}

      <UnitDetailsModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onSave={(key, data) => handleSaveData(key, data)}
        unitId={selectedElementId}
        unitLabel={activeElements.find(el => el.id === selectedElementId)?.label}
        initialData={selectedElementId ? activeUnitsData[selectedElementId] : undefined}
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
        housesData={activeUnitsData}
        onSaveApartment={handleSaveData}
        permissions={permissions}
        initialSelectedApartmentKey={pendingApartmentKey}
        projectId={selectedProjectId && selectedProjectId !== "main_map" ? selectedProjectId : undefined}
      />

      <footer className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-line pt-6 sm:flex-row">
        <span className="text-[11px] text-fg-faint">برمجة وتطوير: كرار عبدالكريم</span>
        <Button variant="ghost" size="sm" onClick={handleClearCache} className="gap-1.5 text-fg-muted">
          <Trash2 size={13} />
          تفريغ كاش المخططات وإعادة التحميل
        </Button>
      </footer>
    </AppShell>
  );
};

export default Index;
