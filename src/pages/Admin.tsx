"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Project, MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, Layout, ArrowRight, Settings2, Map as MapIcon, Trash2, Edit2, 
  FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Save, LogOut, 
  Store, Lock, Clock, Eraser, Terminal, RefreshCcw, Database, Search, 
  User, Phone, HelpCircle, Coins, Download, Copy, FileCode, Banknote, 
  Tags, X, ShieldCheck, Eye, EyeOff, Home as HomeIcon, BarChart3, Bell,
  Palette, MessageSquare, MapPin, Info, Send, Check, Sparkles, AlertTriangle, Mail,
  FileText, Sparkle, Globe, Layers, Laptop, Bed, Maximize, FileImage, CreditCard, Calendar,
  Image as ImageIcon
} from 'lucide-react';
import MapEditor from '@/components/MapEditor';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';
import { clearMainMapCache, clearProjectCache } from '@/lib/map-cache';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { AppShell, Panel, EmptyState } from '@/components/layout/AppShell';
import { BrandMark } from '@/components/layout/Brand';
import { BrochureDocument, BrochurePreviewFrame } from '@/components/brochure/BrochureDocument';
import {
  BROCHURE_TEMPLATES,
  DEFAULT_BROCHURE_CONFIG,
  normalizeTemplateId,
  type BrochureConfig,
} from '@/lib/brochure-types';
import {
  fetchCenterBrochureProfiles,
  saveCenterBrochureProfile,
  getCenterBrochureProfile,
  type CenterBrochureProfiles,
} from '@/lib/center-brochure';
import PaymentAdminPanel from '@/components/payment/PaymentAdminPanel';
import type { ProjectConfigsMap } from '@/lib/project-config';
import {
  fetchCenterSubscriptions,
  saveCenterSubscription,
  deleteCenterSubscription,
  getCenterSubscription,
  getSubscriptionStatusLabel,
  addDaysToDateString,
  formatSubscriptionDate,
  type CenterSubscriptions,
} from '@/lib/center-subscription';

interface AdminProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setHousesData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  housesData: Record<string, any>;
}

/** الأقسام الرئيسية للوحة الإدارة — قسم واحد ظاهر في كل مرة. */
type AdminView = 'projects' | 'brochure' | 'backup' | 'departments' | 'sales' | 'payment';

const MappingInput = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-4">
    <Label className="text-[11px] font-normal text-fg-secondary">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-8 w-14 text-center font-mono text-[12px]" maxLength={2} />
  </div>
);

/** عنوان فرعي داخل الألواح. */
const SubHeading = ({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) => (
  <h3 className="flex items-center gap-2 text-[13px] font-medium text-fg">
    {icon ? <span className="text-fg-muted">{icon}</span> : null}
    {children}
  </h3>
);

/** حقل نموذج: تسمية فوق المُدخل. */
const AdminField = ({
  label,
  hint,
  children,
  className,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("space-y-1.5", className)}>
    <Label className="text-[11px] text-fg-muted">{label}</Label>
    {children}
    {hint ? <p className="text-[10px] leading-relaxed text-fg-faint">{hint}</p> : null}
  </div>
);

const normalizeArabicName = (name: string): string => {
  if (!name) return "";
  return name
    .trim()
    .replace(/[\u064B-\u065F]/g, "") // إزالة الحركات
    .replace(/[أإآ]/g, "ا")          // توحيد الألفات
    .replace(/ة/g, "ه")              // توحيد التاء المربوطة
    .replace(/[ىي]/g, "ي")           // توحيد الياء والألف المقصورة
    .replace(/\s+/g, "");            // إزالة المسافات
};

// PromiseLike لأن مُنشئ استعلامات Supabase thenable وليس Promise حقيقياً.
const safeDbCall = async <T,>(fn: () => PromiseLike<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 1) throw error;
    await new Promise(resolve => setTimeout(resolve, delay));
    return safeDbCall(fn, retries - 1, delay * 1.5);
  }
};

const Admin = ({ projects, setProjects, setHousesData, housesData = {} }: AdminProps) => {
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [editingMapProject, setEditingMapProject] = useState<Project | null>(null);
  const [isEditingMainMap, setIsEditingMainMap] = useState(false);
  const [mainMapData, setMainMapData] = useState<any>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectInfo, setEditingProjectInfo] = useState<Project | null>(null);
  // الأقسام الأربعة كانت أربعة مفاتيح منفصلة يُطفأ بعضها يدوياً عند تشغيل أحدها.
  const [activeView, setActiveView] = useState<AdminView>('projects');
  const showSalesUpdate = activeView === 'sales';
  const showPaymentAdmin = activeView === 'payment';
  const showMarketingCenters = activeView === 'departments';
  const showDatabaseInspector = activeView === 'backup';
  const showBrochureDesigner = activeView === 'brochure';
  const [formData, setFormData] = useState({ name: '', width: 1000, height: 800, projectLogo: '' });
  const [isSavingMap, setIsSavingMap] = useState(false);
  
  const [marketingCenters, setMarketingCenters] = useState<any[]>([]);
  const [centerBrochureProfiles, setCenterBrochureProfiles] = useState<CenterBrochureProfiles>({});
  const [centerSubscriptions, setCenterSubscriptions] = useState<CenterSubscriptions>({});
  const [previewBrochureCenterId, setPreviewBrochureCenterId] = useState<string>('');
  const [newCenter, setNewCenter] = useState({
    name: '',
    password: '',
    type: '',
    allowed_projects: [] as string[],
    phone: '',
    phone2: '',
    marketingLogo: '',
    subscription_start: '',
    subscription_end: '',
    subscription_status: 'active' as 'active' | 'expired' | 'suspended',
    subscription_notes: '',
  });
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null);
  
  // أنواع الأقسام وتعديلها
  const [departmentTypes, setDepartmentTypes] = useState<string[]>([]);
  const [newDeptType, setNewDeptType] = useState('');
  const [editingDeptTypeOldName, setEditingDeptTypeOldName] = useState<string | null>(null);
  const [editingDeptTypeName, setEditingDeptTypeName] = useState('');

  const [deptPermissions, setDeptPermissions] = useState<Record<string, any>>({});
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<string[]>([]);

  // خيار المزامنة الكاملة الذكية (السيناريو الثاني)
  const [isSmartFullSync, setIsSmartFullSync] = useState(true);

  const [excelMapping, setExcelMapping] = useState({
    cityCol: 'A',
    unitCol: 'I',
    nameCol: 'C',
    phoneCol: 'D',
    dateCol: 'E',
    priceCol: 'F',
    currencyCol: 'G',
    taboNumCol: 'J',
    taboStatusCol: 'K',
    handoverDateCol: 'L'
  });
  const [investmentNames, setInvestmentNames] = useState<string[]>([]);
  const [newInvestmentName, setNewInvestmentName] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [projectConfigs, setProjectConfigs] = useState<ProjectConfigsMap>({});

  // إعدادات مصمم البروشورات
  const [brochureConfigs, setBrochureConfigs] = useState<Record<string, BrochureConfig>>({});
  const [selectedBrochureProject, setSelectedBrochureProject] = useState<string>('');
  const [selectedProjectElements, setSelectedProjectElements] = useState<MapElement[]>([]);
  const [activeBrochureConfig, setActiveBrochureConfig] = useState<BrochureConfig>({
    ...DEFAULT_BROCHURE_CONFIG,
  });
  
  // المعاينة والتعديل التلقائي المكتشف
  const [selectedSpecKey, setSelectedSpecKey] = useState<string>('');
  const [newAdvantageText, setNewAdvantageText] = useState<string>('');
  const [activeDetailRooms, setActiveDetailRooms] = useState<string>('');
  const [activeDetailSizes, setActiveDetailSizes] = useState<string>('');
  const [activeDetailUnitImage, setActiveDetailUnitImage] = useState<string>('');
  const [activeDetailUnitImage2, setActiveDetailUnitImage2] = useState<string>('');
  const [activeDetailUnitDescription, setActiveDetailUnitDescription] = useState<string>('');
  const [activeDetailHousePlan, setActiveDetailHousePlan] = useState<string>('');
  
  // تفاصيل مالية وعقود تظهر على المخطط
  const [activeDetailTotalPrice, setActiveDetailTotalPrice] = useState<string>('');
  const [activeDetailContractAmount, setActiveDetailContractAmount] = useState<string>('');
  const [activeDetailPaymentDuration, setActiveDetailPaymentDuration] = useState<string>('');
  const [activeDetailFirstInstallment, setActiveDetailFirstInstallment] = useState<string>('');
  const [activeDetailPaymentPlanDetails, setActiveDetailPaymentPlanDetails] = useState<string>('');

  // Backup & Restore States
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);
  const [isRestoringBackup, setIsRestoringBackup] = useState(false);
  const [isSendingToTelegram, setIsSendingToTelegram] = useState(false);

  // Telegram Config
  const [telegramConfig, setTelegramConfig] = useState({
    botToken: '',
    chatId: ''
  });

  const [activePermsTab, setActivePermsTab] = useState<string>('');

  // قوالب جاهزة مسبقاً بالتصميم ومسارات الشكل المستوحاة من بروشور Dream House الفاخر
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    
    const fetchData = async () => {
      try {
        // جلب الإعدادات الخفيفة فقط واستثناء المخطط العام والبروشورات تماماً من الـ Initial Fetch لتجنب Failed to fetch
        const { data: settingsData } = await supabase
          .from('settings')
          .select('key, value')
          .not('key', 'in', '("main_map_config","brochure_configs")');

        if (settingsData) {
          const mapping = settingsData.find(s => s.key === 'excel_mapping');
          if (mapping) setExcelMapping(prev => ({ ...prev, ...mapping.value }));
          
          const update = settingsData.find(s => s.key === 'last_excel_update');
          if (update) setLastUpdate(update.value);

          const investments = settingsData.find(s => s.key === 'investment_names');
          if (investments) setInvestmentNames(investments.value || []);

          const deptTypes = settingsData.find(s => s.key === 'department_types');
          if (deptTypes) {
            setDepartmentTypes(deptTypes.value || []);
            if (deptTypes.value && deptTypes.value.length > 0) {
              setActivePermsTab(deptTypes.value[0]);
            }
          }

          const permissions = settingsData.find(s => s.key === 'dept_permissions');
          if (permissions) setDeptPermissions(permissions.value || {});

          const configs = settingsData.find(s => s.key === 'project_configs');
          if (configs) setProjectConfigs(configs.value || {});

          const teleConfig = settingsData.find(s => s.key === 'telegram_config');
          if (teleConfig) setTelegramConfig(prev => ({ ...prev, ...teleConfig.value }));

          // تحميل حالة خيار المزامنة الكاملة الذكية
          const smartSync = settingsData.find(s => s.key === 'smart_full_sync');
          if (smartSync) setIsSmartFullSync(smartSync.value !== false);
        }

        const { data: centersData } = await supabase
          .from('marketing_centers')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (centersData) {
          setMarketingCenters(centersData);
          if (!previewBrochureCenterId && centersData.length > 0) {
            setPreviewBrochureCenterId(centersData[0].id);
          }
        }

        const profiles = await fetchCenterBrochureProfiles(supabase);
        setCenterBrochureProfiles(profiles);

        const subscriptions = await fetchCenterSubscriptions(supabase);
        setCenterSubscriptions(subscriptions);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [session]);

  // جلب إعدادات البروشورات المخصصة ديناميكياً وفقط عند فتح شاشتها
  useEffect(() => {
    if (showBrochureDesigner) {
      const fetchBrochures = async () => {
        try {
          const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'brochure_configs')
            .maybeSingle();
          if (error) throw error;
          if (data && data.value) {
            setBrochureConfigs(data.value);
          }
        } catch (err) {
          console.error("Error fetching brochure configs:", err);
        }
      };
      fetchBrochures();
    }
  }, [showBrochureDesigner]);

  // جلب المخطط العام الهندسي فقط وفقط عند تفعيله للرسم والتعديل
  useEffect(() => {
    if (isEditingMainMap) {
      const fetchMainMap = async () => {
        try {
          const { data, error } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'main_map_config')
            .maybeSingle();
          if (error) throw error;
          if (data && data.value) {
            setMainMapData(data.value);
          }
        } catch (err) {
          console.error("Error fetching main map:", err);
        }
      };
      fetchMainMap();
    }
  }, [isEditingMainMap]);

  // جلب دقيق ومؤكد لعناصر ومخططات المشروع المحدد فور اختياره من خادم قاعدة البيانات
  useEffect(() => {
    if (!selectedBrochureProject) {
      setSelectedProjectElements([]);
      return;
    }
    const fetchElements = async () => {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('elements')
          .eq('id', selectedBrochureProject)
          .single();
        if (error) throw error;
        if (data && data.elements) {
          setSelectedProjectElements(data.elements as MapElement[]);
        } else {
          setSelectedProjectElements([]);
        }
      } catch (err) {
        console.error("Error loading project elements:", err);
        setSelectedProjectElements([]);
      }
    };
    fetchElements();
  }, [selectedBrochureProject]);

  const prevProjectRef = useRef<string>('');

  // إدارة مزامنة إعدادات البروشور للمشروع المحدد دون تصفير الصنف المختار عشوائياً
  useEffect(() => {
    if (selectedBrochureProject) {
      const isProjectChanged = prevProjectRef.current !== selectedBrochureProject;
      prevProjectRef.current = selectedBrochureProject;

      const cfg = brochureConfigs[selectedBrochureProject] || { ...DEFAULT_BROCHURE_CONFIG };
      
      setActiveBrochureConfig(cfg);
      
      if (isProjectChanged) {
        setSelectedSpecKey(''); // لا يتم تصفير الصنف المختار إلا إذا تغير المشروع السكني بالكامل
      }
    }
  }, [selectedBrochureProject, brochureConfigs]);

  // استخراج أنواع الوحدات (المنازل) والمساحات (الشقق) ديناميكياً وحياً ومباشرة من عناصر المشروع المحملة
  const { discoveredTypes, discoveredSizes } = useMemo(() => {
    const types = new Set<string>();
    const sizes = new Set<number>();

    if (selectedProjectElements && selectedProjectElements.length > 0) {
      selectedProjectElements.forEach(el => {
        if (el.type === 'house') {
          const parts = el.label.split('-');
          const lastPart = parts[parts.length - 1] || '';
          const match = lastPart.match(/^([a-zA-Z]+)/);
          const type = match ? match[1].toUpperCase() : lastPart.toUpperCase();
          if (type) types.add(type);
        } else if (el.type === 'tower') {
          const floors = el.floors || 1;
          const aptsPerFloor = el.apartmentsPerFloor || 1;
          for (let f = 1; f <= floors; f++) {
            for (let a = 1; a <= aptsPerFloor; a++) {
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
    }

    return {
      discoveredTypes: Array.from(types).sort(),
      discoveredSizes: Array.from(sizes).sort((a, b) => a - b)
    };
  }, [selectedProjectElements]);

  // تحميل مواصفات الصنف/المساحة المحدد فور اختياره
  useEffect(() => {
    if (selectedSpecKey) {
      const details = activeBrochureConfig.unitDetails?.[selectedSpecKey] || {};
      setActiveDetailRooms(details.rooms || '');
      setActiveDetailSizes(details.roomsSizes || '');
      setActiveDetailUnitImage(details.unitImage || '');
      setActiveDetailUnitImage2(details.unitImage2 || '');
      setActiveDetailUnitDescription(details.unitDescription || '');
      setActiveDetailHousePlan(details.housePlan || '');
      setActiveDetailTotalPrice(details.totalPrice || '');
      setActiveDetailContractAmount(details.contractAmount || '');
      setActiveDetailPaymentDuration(details.paymentDuration || '');
      setActiveDetailFirstInstallment(details.firstInstallment || '');
      setActiveDetailPaymentPlanDetails(details.paymentPlanDetails || '');
    } else {
      setActiveDetailRooms('');
      setActiveDetailSizes('');
      setActiveDetailUnitImage('');
      setActiveDetailUnitImage2('');
      setActiveDetailUnitDescription('');
      setActiveDetailHousePlan('');
      setActiveDetailTotalPrice('');
      setActiveDetailContractAmount('');
      setActiveDetailPaymentDuration('');
      setActiveDetailFirstInstallment('');
      setActiveDetailPaymentPlanDetails('');
    }
  }, [selectedSpecKey, activeBrochureConfig]);

  // تطبيق السمة الفنية المحددة تلقائياً عند تغيير اختيار القالب
  const handleApplyTemplate = (templateId: string) => {
    const matched = BROCHURE_TEMPLATES.find(t => t.id === templateId);
    if (matched) {
      setActiveBrochureConfig(prev => ({
        ...prev,
        selectedTemplate: templateId,
        primaryColor: matched.primary,
        secondaryColor: matched.secondary,
      }));
      showSuccess(`تم تطبيق قالب "${matched.name}"`);
    }
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail || !loginPassword) {
      showError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }
    setIsLoggingIn(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      showSuccess("تم تسجيل الدخول بنجاح");
    } catch (error: any) {
      showError(error.message || "فشل تسجيل الدخول");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleToggleSmartSync = async (checked: boolean) => {
    setIsSmartFullSync(checked);
    try {
      await supabase.from('settings').upsert({ key: 'smart_full_sync', value: checked });
      showSuccess(checked ? "تم تفعيل المزامنة الكاملة الذكية" : "تم إلغاء المزامنة الكاملة الذكية");
    } catch (e) {
      showError("فشل حفظ إعداد المزامنة");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const resetCenterForm = () => {
    setEditingCenterId(null);
    setNewCenter({
      name: '',
      password: '',
      type: '',
      allowed_projects: [],
      phone: '',
      phone2: '',
      marketingLogo: '',
      subscription_start: '',
      subscription_end: '',
      subscription_status: 'active',
      subscription_notes: '',
    });
  };

  const buildCenterSubscriptionPayload = () => ({
    subscription_start: newCenter.subscription_start,
    subscription_end: newCenter.subscription_end,
    subscription_status: newCenter.subscription_status,
    subscription_notes: newCenter.subscription_notes,
  });

  const handleRenewCenterSubscription = async (centerId: string, days: number) => {
    try {
      const current = getCenterSubscription(centerSubscriptions, centerId);
      const today = new Date();
      const nextEnd = addDaysToDateString(today, days);
      const updated = {
        ...current,
        subscription_start: current.subscription_start || addDaysToDateString(today, 0),
        subscription_end: nextEnd,
        subscription_status: 'active' as const,
      };

      await saveCenterSubscription(supabase, centerId, updated, centerSubscriptions);
      setCenterSubscriptions((prev) => ({ ...prev, [centerId]: updated }));

      if (editingCenterId === centerId) {
        setNewCenter((prev) => ({
          ...prev,
          subscription_start: updated.subscription_start || '',
          subscription_end: updated.subscription_end || '',
          subscription_status: 'active',
        }));
      }

      showSuccess(`تم تجديد الاشتراك حتى ${formatSubscriptionDate(nextEnd)}`);
    } catch (error) {
      console.error("Error renewing subscription:", error);
      showError("فشل تجديد الاشتراك");
    }
  };

  const handleAddCenter = async () => {
    if (!newCenter.name || !newCenter.password || !newCenter.type) {
      showError("يرجى إكمال كافة البيانات واختيار نوع القسم");
      return;
    }
    try {
      const payload = {
        name: newCenter.name,
        password: newCenter.password,
        type: newCenter.type,
        allowed_projects: newCenter.allowed_projects
      };

      if (editingCenterId) {
        const { data, error } = await supabase
          .from('marketing_centers')
          .update(payload)
          .eq('id', editingCenterId)
          .select();
        
        if (error) throw error;
        if (data && data.length > 0) {
          await saveCenterBrochureProfile(
            supabase,
            editingCenterId,
            {
              phone: newCenter.phone,
              phone2: newCenter.phone2,
              marketingLogo: newCenter.marketingLogo,
            },
            centerBrochureProfiles,
          );
          await saveCenterSubscription(
            supabase,
            editingCenterId,
            buildCenterSubscriptionPayload(),
            centerSubscriptions,
          );
          setCenterBrochureProfiles((prev) => ({
            ...prev,
            [editingCenterId]: {
              phone: newCenter.phone,
              phone2: newCenter.phone2,
              marketingLogo: newCenter.marketingLogo,
            },
          }));
          setCenterSubscriptions((prev) => ({
            ...prev,
            [editingCenterId]: buildCenterSubscriptionPayload(),
          }));
          setMarketingCenters(marketingCenters.map(c => c.id === editingCenterId ? data[0] : c));
          resetCenterForm();
          showSuccess("تم تحديث القسم بنجاح");
        }
      } else {
        const { data, error } = await supabase
          .from('marketing_centers')
          .insert([payload])
          .select();
        
        if (error) throw error;
        if (data && data.length > 0) {
          const newId = data[0].id;
          await saveCenterBrochureProfile(
            supabase,
            newId,
            {
              phone: newCenter.phone,
              phone2: newCenter.phone2,
              marketingLogo: newCenter.marketingLogo,
            },
            centerBrochureProfiles,
          );
          await saveCenterSubscription(
            supabase,
            newId,
            buildCenterSubscriptionPayload(),
            centerSubscriptions,
          );
          setCenterBrochureProfiles((prev) => ({
            ...prev,
            [newId]: {
              phone: newCenter.phone,
              phone2: newCenter.phone2,
              marketingLogo: newCenter.marketingLogo,
            },
          }));
          setCenterSubscriptions((prev) => ({
            ...prev,
            [newId]: buildCenterSubscriptionPayload(),
          }));
          setMarketingCenters([data[0], ...marketingCenters]);
          if (!previewBrochureCenterId) setPreviewBrochureCenterId(newId);
          showSuccess("تم إضافة القسم بنجاح");
        }
      }
      resetCenterForm();
    } catch (error) {
      console.error("Error in handleAddCenter:", error);
      showError(editingCenterId ? "فشل في تحديث القسم" : "فشل في إضافة القسم");
    }
  };

  const handleDeleteCenter = async (id: string) => {
    try {
      const { error } = await supabase
        .from('marketing_centers')
        .delete()
        .eq('id', id);
      
      if (error) throw error;

      const nextProfiles = { ...centerBrochureProfiles };
      delete nextProfiles[id];
      await supabase.from('settings').upsert({
        key: 'center_brochure_profiles',
        value: nextProfiles,
      });
      setCenterBrochureProfiles(nextProfiles);

      const nextSubscriptions = { ...centerSubscriptions };
      delete nextSubscriptions[id];
      await deleteCenterSubscription(supabase, id, centerSubscriptions);
      setCenterSubscriptions(nextSubscriptions);

      setMarketingCenters(marketingCenters.filter(c => c.id !== id));
      if (previewBrochureCenterId === id) {
        const remaining = marketingCenters.filter(c => c.id !== id);
        setPreviewBrochureCenterId(remaining[0]?.id || '');
      }
      showSuccess("تم حذف القسم");
    } catch (error) {
      showError("فشل في حذف القسم");
    }
  };

  const handleAddDeptType = async () => {
    if (!newDeptType.trim()) return;
    const trimmed = newDeptType.trim();
    if (departmentTypes.includes(trimmed)) {
      showError("نوع القسم هذا مضاف بالفعل");
      return;
    }
    const updated = [...departmentTypes, trimmed];
    try {
      await supabase.from('settings').upsert({ key: 'department_types', value: updated });
      setDepartmentTypes(updated);
      if (!activePermsTab) setActivePermsTab(trimmed);
      setNewDeptType('');
      showSuccess("تم إضافة نوع القسم");
    } catch (error) {
      showError("فشل في الحفظ");
    }
  };

  const handleStartEditDeptType = (type: string) => {
    setEditingDeptTypeOldName(type);
    setEditingDeptTypeName(type);
  };

  const handleSaveEditDeptType = async () => {
    if (!editingDeptTypeOldName || !editingDeptTypeName.trim()) return;
    const newName = editingDeptTypeName.trim();
    
    if (newName === editingDeptTypeOldName) {
      setEditingDeptTypeOldName(null);
      setEditingDeptTypeName('');
      return;
    }

    if (departmentTypes.includes(newName)) {
      showError("هذا الاسم مستخدم بالفعل لنوع آخر");
      return;
    }

    try {
      const updatedTypes = departmentTypes.map(t => t === editingDeptTypeOldName ? newName : t);
      
      const updatedPerms = { ...deptPermissions };
      if (updatedPerms[editingDeptTypeOldName]) {
        updatedPerms[newName] = updatedPerms[editingDeptTypeOldName];
        delete updatedPerms[editingDeptTypeOldName];
      }

      await supabase.from('settings').upsert({ key: 'department_types', value: updatedTypes });
      await supabase.from('settings').upsert({ key: 'dept_permissions', value: updatedPerms });

      // تحديث نوع الأقسام المسجلة في جدول أقسام التسويق
      await supabase
        .from('marketing_centers')
        .update({ type: newName })
        .eq('type', editingDeptTypeOldName);

      setDepartmentTypes(updatedTypes);
      setDeptPermissions(updatedPerms);
      setMarketingCenters(prev => prev.map(c => c.type === editingDeptTypeOldName ? { ...c, type: newName } : c));
      
      if (activePermsTab === editingDeptTypeOldName) {
        setActivePermsTab(newName);
      }

      setEditingDeptTypeOldName(null);
      setEditingDeptTypeName('');
      showSuccess("تم تحديث اسم نوع القسم بنجاح");
    } catch (error) {
      console.error(error);
      showError("فشل في تعديل اسم النوع");
    }
  };

  const handleDeleteDeptType = async (idx: number) => {
    const typeToDelete = departmentTypes[idx];
    const updated = departmentTypes.filter((_, i) => i !== idx);
    const updatedPerms = { ...deptPermissions };
    delete updatedPerms[typeToDelete];

    try {
      await supabase.from('settings').upsert({ key: 'department_types', value: updated });
      await supabase.from('settings').upsert({ key: 'dept_permissions', value: updatedPerms });
      setDepartmentTypes(updated);
      setDeptPermissions(updatedPerms);
      if (activePermsTab === typeToDelete && updated.length > 0) {
        setActivePermsTab(updated[0]);
      }
      showSuccess("تم حذف النوع وصلاحياته");
    } catch (error) {
      showError("فشل في التحديث");
    }
  };

  const togglePermission = async (type: string, permission: string) => {
    const current = deptPermissions[type] || {
      showPrice: true,
      showCustomerName: true,
      showCustomerPhone: true,
      showSaleDate: true,
      showTaboNum: true,
      showTaboStatus: true,
      showHandoverInfo: true,
      showStatsAvailable: true,
      showStatsSold: true,
      showStatsInvestment: true,
      showStatsReserved: true,
      showStatsPending: true,
      showStatsTotal: true,
      showStatsPromoted: true,
      showStatsNotPromoted: true,
      showStatsReceivedTabo: true,
      showStatsReceivedUnit: true,
      showStatsNotReceivedUnit: true,
      showStatsPriceIQD: true,
      showStatsPriceUSD: true,
      showGeneralStats: true,
      showStatsTable: true,
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
      canDeleteNotes: false,
      showSearchBox: true,
      showQuickPreview: true,
      canAccessReports: true,
      showDiagnosticTerminal: true,
      showBrochureButton: true,
      canAccessPaymentForm: true,
      canAccessPaymentArchive: true,
      showPaymentPlanButton: true,
    };
    
    const currentValue = current[permission];
    const newValue = typeof currentValue === 'boolean' ? !currentValue : true;

    const updated = {
      ...deptPermissions,
      [type]: {
        ...current,
        [permission]: newValue
      }
    };

    try {
      const { error } = await supabase.from('settings').upsert({ key: 'dept_permissions', value: updated });
      if (error) throw error;
      setDeptPermissions(updated);
      showSuccess("تم تحديث الصلاحية");
    } catch (error) {
      console.error("Error updating permission:", error);
      showError("فشل في تحديث الصلاحية");
    }
  };

  const toggleProjectVisibilityForCenter = (projectId: string) => {
    const current = newCenter.allowed_projects || [];
    const newAllowed = current.includes(projectId)
      ? current.filter(id => id !== projectId)
      : [...current, projectId];
    setNewCenter({ ...newCenter, allowed_projects: newAllowed });
  };

  const setColorMode = async (type: string, mode: string) => {
    const current = deptPermissions[type] || {};
    const updated = {
      ...deptPermissions,
      [type]: {
        ...current,
        colorMode: mode
      }
    };
    try {
      await supabase.from('settings').upsert({ key: 'dept_permissions', value: updated });
      setDeptPermissions(updated);
      showSuccess("تم تحديث نمط التلوين");
    } catch (error) {
      showError("فشل في التحديث");
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await supabase.from('settings').upsert({ key: 'excel_mapping', value: excelMapping });
      await supabase.from('settings').upsert({ key: 'investment_names', value: investmentNames });
      showSuccess("تم حفظ الإعدادات بنجاح");
    } catch (error) {
      showError("فشل في حفظ الإعدادات");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleAddInvestmentName = async () => {
    if (!newInvestmentName) return;
    const updatedList = [...investmentNames, newInvestmentName];
    setInvestmentNames(updatedList);
    setNewInvestmentName('');
    
    try {
      await supabase.from('settings').upsert({ key: 'investment_names', value: updatedList });
      showSuccess("تمت إضافة المستثمر وحفظه");
    } catch (error) {
      showError("فشل في الحفظ التلقائي");
    }
  };

  const handleDeleteInvestmentName = async (idx: number) => {
    const updatedList = investmentNames.filter((_, i) => i !== idx);
    setInvestmentNames(updatedList);
    
    try {
      await supabase.from('settings').upsert({ key: 'investment_names', value: updatedList });
      showSuccess("تم حذف المستثمر وتحديث القائمة");
    } catch (error) {
      showError("فشل في تحديث القائمة");
    }
  };

  // حفظ إعدادات البروشور الشاملة حياً ومباشرة
  const handleSaveBrochureConfig = async () => {
    if (!selectedBrochureProject) return;
    setIsSavingSettings(true);
    try {
      const updatedConfigs = {
        ...brochureConfigs,
        [selectedBrochureProject]: activeBrochureConfig
      };
      const { error } = await supabase.from('settings').upsert({ key: 'brochure_configs', value: updatedConfigs });
      if (error) throw error;
      setBrochureConfigs(updatedConfigs);
      showSuccess("تم حفظ وتعميم تصميم البروشور للمشروع بالكامل بنجاح!");
    } catch (e) {
      showError("فشل حفظ تصميم البروشور");
    } finally {
      setIsSavingSettings(false);
    }
  };

  // إضافة ميزة ترويجية للصنف المختار وحفظها تلقائياً بالخادم
  const handleAddAdvantage = async () => {
    if (!selectedBrochureProject || !selectedSpecKey) {
      showError("يرجى اختيار المشروع والصنف أو المساحة أولاً");
      return;
    }
    if (!newAdvantageText.trim()) {
      showError("يرجى إدخال محتوى الميزة");
      return;
    }
    const txt = newAdvantageText.trim();
    
    const currentAdvantages = { ...(activeBrochureConfig.advantages || {}) };
    const list = currentAdvantages[selectedSpecKey] || [];
    if (list.includes(txt)) {
      showError("هذه الميزة مضافة بالفعل لهذا الصنف");
      return;
    }
    currentAdvantages[selectedSpecKey] = [...list, txt];
    
    const updatedConfig = {
      ...activeBrochureConfig,
      advantages: currentAdvantages
    };
    
    setActiveBrochureConfig(updatedConfig);
    setNewAdvantageText('');

    const updatedConfigs = {
      ...brochureConfigs,
      [selectedBrochureProject]: updatedConfig
    };
    setBrochureConfigs(updatedConfigs);

    try {
      const { error } = await supabase.from('settings').upsert({ key: 'brochure_configs', value: updatedConfigs });
      if (error) throw error;
      showSuccess(`تم إضافة الميزة بنجاح وحفظها لصنف ${selectedSpecKey}`);
    } catch (e) {
      showError("فشل الحفظ المباشر لقاعدة البيانات");
    }
  };

  const handleDeleteAdvantage = async (key: string, idx: number) => {
    if (!selectedBrochureProject) return;
    const currentAdvantages = { ...(activeBrochureConfig.advantages || {}) };
    const list = currentAdvantages[key] || [];
    const updatedList = list.filter((_, i) => i !== idx);
    
    if (updatedList.length === 0) {
      delete currentAdvantages[key];
    } else {
      currentAdvantages[key] = updatedList;
    }

    const updatedConfig = {
      ...activeBrochureConfig,
      advantages: currentAdvantages
    };

    setActiveBrochureConfig(updatedConfig);

    const updatedConfigs = {
      ...brochureConfigs,
      [selectedBrochureProject]: updatedConfig
    };
    setBrochureConfigs(updatedConfigs);

    try {
      const { error } = await supabase.from('settings').upsert({ key: 'brochure_configs', value: updatedConfigs });
      if (error) throw error;
      showSuccess(`تم حذف الميزة وتحديث قاعدة البيانات بنجاح`);
    } catch (e) {
      showError("فشل في تحديث قاعدة البيانات");
    }
  };

  // حفظ تفاصيل غرف ومساحات ومعاملات مالية وصورة ووصف إضافي
  const handleSaveUnitDetail = async () => {
    if (!selectedBrochureProject || !selectedSpecKey) {
      showError("يرجى اختيار المشروع والصنف أو المساحة المكتشفة أولاً");
      return;
    }
    const currentDetails = { ...(activeBrochureConfig.unitDetails || {}) };
    
    currentDetails[selectedSpecKey] = {
      rooms: activeDetailRooms.trim(),
      roomsSizes: activeDetailSizes.trim(),
      unitImage: activeDetailUnitImage.trim(),
      unitImage2: activeDetailUnitImage2.trim(),
      unitDescription: activeDetailUnitDescription.trim(),
      housePlan: activeDetailHousePlan.trim(),
      totalPrice: activeDetailTotalPrice.trim(),
      contractAmount: activeDetailContractAmount.trim(),
      paymentDuration: activeDetailPaymentDuration.trim(),
      firstInstallment: activeDetailFirstInstallment.trim(),
      paymentPlanDetails: activeDetailPaymentPlanDetails.trim()
    };

    const updatedConfig = {
      ...activeBrochureConfig,
      unitDetails: currentDetails
    };

    setActiveBrochureConfig(updatedConfig);

    const updatedConfigs = {
      ...brochureConfigs,
      [selectedBrochureProject]: updatedConfig
    };
    setBrochureConfigs(updatedConfigs);

    try {
      const { error } = await supabase.from('settings').upsert({ key: 'brochure_configs', value: updatedConfigs });
      if (error) throw error;
      showSuccess(`🎉 تم حفظ وتزامن تفاصيل ومخطط صنف ${selectedSpecKey} بقاعدة البيانات بأمان!`);
    } catch (e) {
      console.error(e);
      showError("خطأ: فشل حفظ وتأكيد تفاصيل الوحدة بقاعدة البيانات");
    }
  };

  const handleDeleteUnitDetail = async (key: string) => {
    if (!selectedBrochureProject) return;
    const currentDetails = { ...(activeBrochureConfig.unitDetails || {}) };
    delete currentDetails[key];

    const updatedConfig = {
      ...activeBrochureConfig,
      unitDetails: currentDetails
    };

    setActiveBrochureConfig(updatedConfig);
    
    if (selectedSpecKey === key) {
      setActiveDetailRooms('');
      setActiveDetailSizes('');
      setActiveDetailUnitImage('');
      setActiveDetailUnitImage2('');
      setActiveDetailUnitDescription('');
      setActiveDetailHousePlan('');
      setActiveDetailTotalPrice('');
      setActiveDetailContractAmount('');
      setActiveDetailPaymentDuration('');
      setActiveDetailFirstInstallment('');
      setActiveDetailPaymentPlanDetails('');
    }

    const updatedConfigs = {
      ...brochureConfigs,
      [selectedBrochureProject]: updatedConfig
    };
    setBrochureConfigs(updatedConfigs);

    try {
      const { error } = await supabase.from('settings').upsert({ key: 'brochure_configs', value: updatedConfigs });
      if (error) throw error;
      showSuccess(`تم حذف تفاصيل الصنف ${key} ومزامنة الحذف بالخادم`);
    } catch (e) {
      showError("فشل مزامنة الحذف بالخادم");
    }
  };

  // معالجة رفع وتحديث المبيعات من ملف Excel مع خيار المزامنة الكاملة الذكية (السيناريو الثاني)
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const logs: string[] = ["بدء معالجة الملف..."];
    setProcessLogs([...logs]);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const XLSX = await import('xlsx');
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 'A' });

        logs.push(`تم قراءة ${data.length} صف من ملف الإكسل.`);
        setProcessLogs([...logs]);

        logs.push("جاري جلب قائمة المشاريع لإجراء المطابقة الذكية للأسماء...");
        setProcessLogs([...logs]);
        
        const { data: allDbProjects, error: dbProjectsErr } = await safeDbCall(() => 
          supabase.from('projects').select('id, name')
        );

        if (dbProjectsErr) throw dbProjectsErr;
        if (!allDbProjects || allDbProjects.length === 0) {
          throw new Error("لا توجد أي مشاريع في قاعدة البيانات لربطها بالإكسل.");
        }

        const normalizedDbProjects = allDbProjects.map(proj => ({
          ...proj,
          normalizedName: normalizeArabicName(proj.name)
        }));

        const matchedProjectsMap = new Map<string, any>();
        const skippedCities = new Set<string>();

        data.forEach((row: any, index) => {
          if (index === 0) return;
          const cityName = row[excelMapping.cityCol]?.toString().trim();
          if (!cityName) return;

          const normCity = normalizeArabicName(cityName);
          const match = normalizedDbProjects.find(p => p.normalizedName === normCity);
          
          if (match) {
            matchedProjectsMap.set(match.id, match);
          } else {
            skippedCities.add(cityName);
          }
        });

        if (skippedCities.size > 0) {
          logs.push(`⚠️ تحذير: لم يتم العثور على تطابق للمدن التالية في النظام: ${Array.from(skippedCities).join('، ')}`);
          setProcessLogs([...logs]);
        }

        const matchedProjects = Array.from(matchedProjectsMap.values());
        if (matchedProjects.length === 0) {
          throw new Error("لم تتطابق أي مدينة في ملف الإكسل مع المشاريع الحالية في النظام (تأكد من مطابقة الأسماء).");
        }

        logs.push(`تمت مطابقة ${matchedProjects.length} مشروع بنجاح: ${matchedProjects.map(p => p.name).join('، ')}`);
        setProcessLogs([...logs]);

        const projectsList: any[] = [];
        for (const proj of matchedProjects) {
          logs.push(`جاري تحميل عناصر المخطط للمشروع "${proj.name}"...`);
          setProcessLogs([...logs]);
          try {
            const fullProj = await safeDbCall(async () => {
              const url = `https://byvzmxrvetgcxstlsszd.supabase.co/rest/v1/projects?select=id,name,elements&id=eq.${proj.id}`;
              const supabaseKey = (supabase as any).supabaseKey;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 60000);
              
              const response = await fetch(url, {
                headers: {
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${supabaseKey}`
                },
                signal: controller.signal,
                cache: 'no-cache'
              });
              clearTimeout(timeoutId);
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              const resData = await response.json();
              if (!resData || resData.length === 0) throw new Error("Project not found");
              return resData[0];
            });
            
            if (fullProj) projectsList.push(fullProj);
          } catch (fetchErr: any) {
            logs.push(`⚠️ تنبيه: تعذر تحميل المخطط لـ "${proj.name}" بسبب حجم البيانات أو ضعف الشبكة، سيتم المتابعة باستخدام أسماء الوحدات مباشرة.`);
            setProcessLogs([...logs]);
            projectsList.push({ id: proj.id, name: proj.name, elements: [] });
          }
        }

        const matchedProjectIds = matchedProjects.map(p => p.id);
        logs.push("جاري تحميل مبيعات وحجوزات الوحدات الحالية بالتوازي...");
        setProcessLogs([...logs]);
        
        let existingHouses: any[] = [];
        try {
          let hFrom = 0;
          let hHasMore = true;
          while (hHasMore) {
            const hChunk = await safeDbCall(() =>
              supabase
                .from('houses_data')
                .select('unit_key, project_id, data')
                .in('project_id', matchedProjectIds)
                .range(hFrom, hFrom + 999)
            );
            
            const chunkData = (hChunk as any).data;
            if (!chunkData || chunkData.length === 0) {
              hHasMore = false;
            } else {
              existingHouses = [...existingHouses, ...chunkData];
              hFrom += 1000;
              if (chunkData.length < 1000) hHasMore = false;
            }
          }
          logs.push(`تم تحميل ${existingHouses.length} سجل حالي للوحدات بنجاح.`);
          setProcessLogs([...logs]);
        } catch (hFetchErr) {
          logs.push(`⚠️ تحذير: فشل الاتصال المؤقت بجلب البيانات الحالية. سيتم التحديث المباشر للوحدات المرفوعة.`);
          setProcessLogs([...logs]);
        }

        const updates: any[] = [];
        const parseExcelDate = (val: any) => {
          if (!val) return '';
          if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
          }
          return val.toString().trim();
        };

        const excelKeys = new Set<string>();

        data.forEach((row: any, index) => {
          if (index === 0) return;

          const cityName = row[excelMapping.cityCol]?.toString().trim();
          const unitLabel = row[excelMapping.unitCol]?.toString().trim();
          const customerName = row[excelMapping.nameCol]?.toString().trim();
          
          if (!cityName || !unitLabel) return;

          const normCity = normalizeArabicName(cityName);
          const project = projectsList.find(p => normalizeArabicName(p.name) === normCity);
          if (!project) return;

          let realUnitKey = null;
          const elements = project.elements || [];
          const cleanExcelLabel = unitLabel.replace(/\s+/g, '').toUpperCase();

          const house = elements.find(el => {
            if (el.type !== 'house') return false;
            const cleanElLabel = el.label.replace(/\s+/g, '').toUpperCase();
            return cleanElLabel === cleanExcelLabel;
          });

          if (house) {
            realUnitKey = house.id;
          } else {
            elements.filter(el => el.type === 'tower').forEach(tower => {
              if (realUnitKey) return;
              let pCounter = 0;
              for (let f = 1; f <= (tower.floors || 1); f++) {
                for (let a = 1; a <= (tower.apartmentsPerFloor || 1); a++) {
                  const key = `${tower.id}_F${f}_A${a}`;
                  const existingUnit = existingHouses?.find(h => h.unit_key === key);
                  const hData = existingUnit?.data;
                  
                  if (hData?.status !== 'frozen_uncounted' && hData?.status !== 'frozen_hidden') pCounter++;
                  const floorCode = f === 1 ? "FG" : `F${f - 1}`;
                  const aptCode = (hData?.status === 'frozen_uncounted' || hData?.status === 'frozen_hidden') ? "مجمدة" : `P${pCounter}`;
                  const fullLabel = `${tower.label}-${floorCode}-${aptCode}`;
                  const cleanFullLabel = fullLabel.replace(/\s+/g, '').toUpperCase();
                  if (cleanFullLabel === cleanExcelLabel) {
                    realUnitKey = key;
                    return;
                  }
                }
              }
            });
          }

          if (!realUnitKey) realUnitKey = unitLabel;

          excelKeys.add(realUnitKey);

          let status = 'available';
          if (customerName && customerName.length > 1) {
            const isInvestment = investmentNames.some(name => 
              customerName.toLowerCase().includes(name.toLowerCase().trim())
            );
            status = isInvestment ? 'investment' : 'sold';
          }

          const existingUnit = existingHouses?.find(h => h.unit_key === realUnitKey);
          const existingData = existingUnit?.data || {};

          const unitData = {
            ...existingData, 
            status: status, 
            name: customerName || '',
            phone: row[excelMapping.phoneCol]?.toString().trim() || '',
            saleDate: parseExcelDate(row[excelMapping.dateCol]),
            price: row[excelMapping.priceCol]?.toString().trim() || '',
            currency: row[excelMapping.currencyCol]?.toString().trim() || 'IQD',
            taboNum: row[excelMapping.taboNumCol]?.toString().trim() || '',
            taboStatus: row[excelMapping.taboStatusCol]?.toString().trim() || 'غير مروج',
            handoverDate: parseExcelDate(row[excelMapping.handoverDateCol]),
          };

          updates.push({ unit_key: realUnitKey, project_id: project.id, data: unitData });
        });

        if (isSmartFullSync && existingHouses && existingHouses.length > 0) {
          logs.push("⚙️ جاري تشغيل المزامنة الكاملة الذكية (السيناريو الثاني): فحص وتصفير الوحدات المباعة والمستثمرة الغائبة عن الإكسل...");
          setProcessLogs([...logs]);
          
          let resetCounter = 0;

          existingHouses.forEach(h => {
            const isMissingFromExcel = !excelKeys.has(h.unit_key);
            const isSoldOrInvestmentInDb = h.data?.status === 'sold' || h.data?.status === 'investment';
            const isReservedOrPendingInDb = h.data?.status === 'reserved' || h.data?.status === 'pending';

            if (isMissingFromExcel && isSoldOrInvestmentInDb && !isReservedOrPendingInDb) {
              const resetData = {
                ...h.data,
                status: 'available',
                name: '',
                phone: '',
                saleDate: '',
                price: '',
                taboNum: '',
                taboStatus: 'غير مروج',
                handoverDate: ''
              };
              updates.push({ unit_key: h.unit_key, project_id: h.project_id, data: resetData });
              resetCounter++;
            }
          });

          if (resetCounter > 0) {
            logs.push(`💡 تم تحديد ${resetCounter} وحدة مباعة/مستثمرة غابت عن الملف، وسيتم إرجاعها إلى "متوفر" مع الإبقاء على حجوزات الموظفين وسجلات الملاحظات.`);
            setProcessLogs([...logs]);
          } else {
            logs.push("✅ لم يتم الكشف عن أي وحدات مبيعات غائبة تحتاج إلى تصفير.");
            setProcessLogs([...logs]);
          }
        }

        const uniqueUpdatesMap = new Map<string, any>();
        updates.forEach(u => uniqueUpdatesMap.set(u.unit_key, u));

        const sortedFinalUpdates = Array.from(uniqueUpdatesMap.values());
        logs.push(`تجهيز السجلات النهائية للرفع. إجمالي السجلات للرفع: ${sortedFinalUpdates.length} سجل.`);
        setProcessLogs([...logs]);

        for (let i = 0; i < sortedFinalUpdates.length; i += 100) {
          const chunk = sortedFinalUpdates.slice(i, i + 100);
          
          await safeDbCall(async () => {
            const { error: upsertError } = await supabase.from('houses_data').upsert(chunk, { onConflict: 'unit_key' });
            if (upsertError) throw upsertError;
          });

          if (i % 300 === 0 || i + chunk.length === sortedFinalUpdates.length) {
            logs.push(`تم حفظ ${Math.min(i + chunk.length, sortedFinalUpdates.length)} من أصل ${sortedFinalUpdates.length} سجل بنجاح...`);
            setProcessLogs([...logs]);
          }
        }

        const now = new Date().toISOString();
        await supabase.from('settings').upsert({ key: 'last_excel_update', value: now });
        setLastUpdate(now);
        clearProjectCache();
        logs.push("🎉 تم تحديث ومطابقة وحفظ كامل البيانات بنجاح 100% وبدون أي نقص!");
        setProcessLogs([...logs]);
        showSuccess("تم تحديث كافة البيانات وحفظها بنجاح كامل وموثوق");
      } catch (error: any) {
        logs.push(`❌ خطأ أثناء المعالجة: ${error.message || error}`);
        setProcessLogs([...logs]);
        showError("حدث خطأ أثناء معالجة وحفظ الملف");
      } finally {
        setIsProcessing(false);
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleCreateProject = async () => {
    if (!formData.name) return;
    const newId = Math.random().toString(36).substr(2, 9);
    const newProject = { id: newId, name: formData.name, description: '', elements: [], map_width: Math.round(formData.width), map_height: Math.round(formData.height) };
    try {
      await supabase.from('projects').insert(newProject);
      const updatedConfigs = {
        ...projectConfigs,
        [newId]: {
          ...(projectConfigs[newId] || {}),
          projectLogo: formData.projectLogo.trim(),
        },
      };
      await supabase.from('settings').upsert({ key: 'project_configs', value: updatedConfigs });
      setProjectConfigs(updatedConfigs);
      setProjects([{ ...newProject, mapWidth: Math.round(formData.width), mapHeight: Math.round(formData.height), createdAt: new Date().toISOString(), elements: [] }, ...projects]);
      setFormData({ name: '', width: 1000, height: 800, projectLogo: '' });
      setIsCreating(false);
      showSuccess('تم إنشاء المشروع بنجاح');
    } catch (error) { showError("فشل في إنشاء المشروع"); }
  };

  const handleUpdateProjectInfo = async () => {
    if (!editingProjectInfo || !formData.name) return;
    try {
      await supabase.from('projects').update({ name: formData.name, map_width: Math.round(formData.width), map_height: Math.round(formData.height) }).eq('id', editingProjectInfo.id);
      const updatedConfigs = {
        ...projectConfigs,
        [editingProjectInfo.id]: {
          ...(projectConfigs[editingProjectInfo.id] || {}),
          projectLogo: formData.projectLogo.trim(),
        },
      };
      await supabase.from('settings').upsert({ key: 'project_configs', value: updatedConfigs });
      setProjectConfigs(updatedConfigs);
      setProjects(projects.map(p => p.id === editingProjectInfo.id ? { ...p, name: formData.name, mapWidth: Math.round(formData.width), mapHeight: Math.round(formData.height) } : p));
      setEditingProjectInfo(null);
      setFormData({ name: '', width: 1000, height: 800, projectLogo: '' });
      showSuccess('تم تحديث بيانات المشروع بنجاح');
    } catch (error) { showError("فشل في تحديث المشروع"); }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      await supabase.from('projects').delete().eq('id', id);
      setProjects(projects.filter(p => p.id !== id));
      showSuccess('تم حذف المشروع');
    } catch (error) { showError("فشل في حذف المشروع"); }
  };

  const handleSaveMap = async (elements: MapElement[], newWidth: number, newHeight: number, backgroundColor?: string, showGrid?: boolean, houseTypeAreas?: Record<string, number>) => {
    if (isEditingMainMap) {
      setIsSavingMap(true);
      try {
        const config = { elements, width: newWidth, height: newHeight, backgroundColor, showGrid };
        await supabase.from('settings').upsert([
          { key: 'main_map_config', value: config },
          { key: 'main_map_version', value: Date.now() },
        ]);
        setMainMapData(config);
        setIsEditingMainMap(false);
        clearMainMapCache();
        showSuccess('تم حفظ المخطط العام بنجاح');
      } catch (error) { showError("فشل في حفظ المخطط العام"); } finally { setIsSavingMap(false); }
      return;
    }

    if (!editingMapProject || isSavingMap) return;
    setIsSavingMap(true);
    try {
      const cleanedElements = elements.map(el => {
        const cleaned: any = { ...el };
        Object.keys(cleaned).forEach(key => {
          if (cleaned[key] === undefined || cleaned[key] === null) delete cleaned[key];
        });
        return cleaned;
      });
      const { error } = await supabase.from('projects').update({ elements: cleanedElements, map_width: Math.round(newWidth), map_height: Math.round(newHeight) }).eq('id', editingMapProject.id);
      if (error) throw error;

      const updatedConfigs = {
        ...projectConfigs,
        [editingMapProject.id]: { backgroundColor, showGrid, houseTypeAreas }
      };
      await supabase.from('settings').upsert({ key: 'project_configs', value: updatedConfigs });
      setProjectConfigs(updatedConfigs);

      setProjects(projects.map(p => p.id === editingMapProject.id ? { ...p, elements: cleanedElements, mapWidth: Math.round(newWidth), mapHeight: Math.round(newHeight) } : p));
      clearProjectCache(editingMapProject.id);
      setEditingMapProject(null);
      showSuccess('تم حفظ المخطط بنجاح');
    } catch (error) { showError("فشل في حفظ المخطط"); } finally { setIsSavingMap(false); }
  };

  const startEditingInfo = (project: Project) => {
    setEditingProjectInfo(project);
    setFormData({
      name: project.name,
      width: project.mapWidth,
      height: project.mapHeight,
      projectLogo: projectConfigs[project.id]?.projectLogo || '',
    });
    setIsCreating(false);
    setActiveView('projects');
  };

  const startEditingMap = async (project: Project) => {
    try {
      const { data, error } = await supabase.from('projects').select('elements').eq('id', project.id).single();
      if (error) throw error;
      setEditingMapProject({ ...project, elements: data.elements || [] });
    } catch (error) { showError("فشل في تحميل تفاصيل المخطط"); }
  };

  const handleSaveTelegramConfig = async () => {
    try {
      await supabase.from('settings').upsert({ key: 'telegram_config', value: telegramConfig });
      showSuccess("تم حفظ إعدادات تيليجرام بنجاح");
    } catch (e) {
      showError("فشل في حفظ الإعدادات");
    }
  };

  const fetchAllHousesForBackup = async () => {
    let allHouses: any[] = [];
    let from = 0;
    const step = 1000;
    let hasMore = true;

    while (hasMore) {
      const chunk = await safeDbCall(() =>
        supabase
          .from('houses_data')
          .select('*')
          .range(from, from + step - 1)
      );

      const chunkData = (chunk as any).data;
      if (!chunkData || chunkData.length === 0) {
        hasMore = false;
      } else {
        allHouses = [...allHouses, ...chunkData];
        from += step;
        if (chunkData.length < step) hasMore = false;
      }
    }
    return allHouses;
  };

  const handleDownloadBackup = async () => {
    setIsGeneratingBackup(true);
    try {
      const { data: projects } = await supabase.from('projects').select('*');
      const houses = await fetchAllHousesForBackup();
      const { data: settings } = await supabase.from('settings').select('*');
      const { data: centers } = await supabase.from('marketing_centers').select('*');
      
      const backup = { timestamp: new Date().toISOString(), projects, houses, settings, centers };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      showSuccess(`تم إنشاء النسخة الاحتياطية بنجاح (${houses.length} سجل)`);
    } catch (error) { showError("فشل في إنشاء النسخة الاحتياطية"); } finally { setIsGeneratingBackup(false); }
  };

  const handleSendBackupToTelegram = async () => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      showError("يرجى إدخال توكن البوت ومعرف القناة وحفظهما أولاً.");
      return;
    }

    setIsSendingToTelegram(true);
    try {
      const { data: projectsData } = await supabase.from('projects').select('*');
      const housesData = await fetchAllHousesForBackup();
      const { data: settingsData } = await supabase.from('settings').select('*');
      const { data: centersData = [] } = await supabase.from('marketing_centers').select('*');
      
      const backup = {
        timestamp: new Date().toISOString(),
        projects: projectsData,
        houses: housesData,
        settings: settingsData,
        centers: centersData
      };

      const backupString = JSON.stringify(backup, null, 2);
      const blob = new Blob([backupString], { type: 'application/json' });
      
      const filename = `backup_${new Date().toISOString().split('T')[0]}_manual.json`;
      const file = new File([blob], filename, { type: 'application/json' });

      const formData = new FormData();
      formData.append('chat_id', telegramConfig.chatId);
      formData.append('document', file);
      formData.append('caption', `📦 نسخة احتياطية يدوية جديدة لقاعدة البيانات (${housesData.length} وحدة سكنية).\nتاريخ الإصدار: ${new Date().toLocaleString('ar-EG')}`);

      const response = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendDocument`, {
        method: 'POST',
        body: formData
      });

      const resData = await response.json();
      if (response.ok && resData.ok) {
        showSuccess(`🎉 تم إرسال النسخة الاحتياطية بنجاح إلى تليجرام! (${housesData.length} سجل)`);
      } else {
        const detailedError = resData.description || `رمز الخطأ: ${resData.error_code || 'غير معروف'}`;
        throw new Error(detailedError);
      }
    } catch (error: any) {
      console.error(error);
      showError(`فشل في الإرسال لتيليجرام: ${error.message || error}`);
    } finally {
      setIsSendingToTelegram(false);
    }
  };

  const handleRestoreBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsRestoringBackup(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const content = evt.target?.result as string;
          const backup = JSON.parse(content);

          if (!backup.projects || !backup.houses || !backup.settings || !backup.centers) {
            throw new Error("ملف النسخة الاحتياطية غير صالح أو تالف.");
          }

          if (backup.projects && backup.projects.length > 0) {
            const formattedProjects = backup.projects.map((p: any) => ({
              id: p.id,
              name: p.name,
              description: p.description || '',
              elements: p.elements || [],
              map_width: p.map_width,
              map_height: p.map_height
            }));
            await supabase.from('projects').upsert(formattedProjects);
          }

          if (backup.houses && backup.houses.length > 0) {
            for (let i = 0; i < backup.houses.length; i += 100) {
              const chunk = backup.houses.slice(i, i + 100);
              await supabase.from('houses_data').upsert(chunk);
            }
          }

          if (backup.settings && backup.settings.length > 0) {
            await supabase.from('settings').upsert(backup.settings);
          }

          if (backup.centers && backup.centers.length > 0) {
            await supabase.from('marketing_centers').upsert(backup.centers);
          }

          showSuccess("تم استعادة النسخة الاحتياطية بالكامل بنجاح!");
          setTimeout(() => {
            window.location.reload();
          }, 1000);
        } catch (err: any) {
          showError("فشل في استعادة البيانات: " + err.message);
        } finally {
          setIsRestoringBackup(false);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      showError("فشل في قراءة ملف النسخة الاحتياطية");
      setIsRestoringBackup(false);
    }
  };

  const permissionsCategories = [
    {
      title: "الصلاحيات العامة وعرض الحقول في الوحدة",
      perms: [
        { key: 'canEditUnitData', label: 'تعديل بيانات الوحدات وحفظ التغييرات' },
        { key: 'showStatusField', label: 'رؤية وتغيير حالة الوحدة (مباع / متاح ...)' },
        { key: 'showPrice', label: 'رؤية السعر والعملة داخل الوحدة' },
        { key: 'showCustomerName', label: 'رؤية اسم الزبون' },
        { key: 'showCustomerPhone', label: 'رؤية رقم الهاتف' },
        { key: 'showSaleDate', label: 'رؤية تاريخ البيع / الحجز' },
        { key: 'showTaboNum', label: 'رؤية رقم الطابو' },
        { key: 'showTaboStatus', label: 'رؤية وتعديل حالة الطابو' },
        { key: 'showHandoverInfo', label: 'رؤية وتعديل تاريخ الاستلام' },
        { key: 'showNotifications', label: 'عرض شريط الإشعارات الجانبي بالكامل' },
        { key: 'showStatsTable', label: 'عرض جدول الإحصائيات المفصلة السفلي بالكامل' },
        { key: 'showGeneralStats', label: 'عرض كارت الإحصائيات العام الجانبي بالكامل' },
        { key: 'showSearchBox', label: 'رؤية واستخدم مربع البحث في الواجهة الرئيسية' },
        { key: 'showQuickPreview', label: 'رؤية وتفعيل كارت المعاينة السريعة للوحدات' },
        { key: 'canAccessReports', label: 'صلاحية الوصول إلى نافذة التقارير والتحليلات' },
        { key: 'showDiagnosticTerminal', label: 'رؤية لوحة تحليل الأداء الفورية (Realtime)' },
        { key: 'showBrochureButton', label: 'عرض زر بروشور الوحدة السكنية الفاخرة' },
        { key: 'canAccessPaymentForm', label: 'الوصول إلى استمارة تنظيم آلية الدفعات' },
        { key: 'canAccessPaymentArchive', label: 'الوصول إلى أرشيف استمارات الدفعات' },
      ]
    },
    {
      title: "صلاحيات أعمدة جدول الإحصائيات السفلي",
      perms: [
        { key: 'showStatsAvailable', label: 'إظهار عمود الوحدات المتاحة' },
        { key: 'showStatsSold', label: 'إظهار عمود الوحدات المباعة' },
        { key: 'showStatsInvestment', label: 'إظهار عمود الاستثمار' },
        { key: 'showStatsReserved', label: 'إظهار عمود المحجوز' },
        { key: 'showStatsPending', label: 'إظهار عمود الحجز الأولي' },
        { key: 'showStatsTotal', label: 'إظهار عمود المجموع' },
        { key: 'showStatsPromoted', label: 'إظهار عمود مروج' },
        { key: 'showStatsNotPromoted', label: 'إظهار عمود غير مروج' },
        { key: 'showStatsReceivedTabo', label: 'إظهار عمود مستلم الطابو' },
        { key: 'showStatsReceivedUnit', label: 'إظهار عمود مستلم الوحدة' },
        { key: 'showStatsNotReceivedUnit', label: 'إظهار عمود غير مستلم الوحدة' },
        { key: 'showStatsPriceIQD', label: 'إظهار عمود الإجمالي بالدينار العراقي' },
        { key: 'showStatsPriceUSD', label: 'إظهار عمود الإجمالي بالدولار الأمريكي' },
      ]
    },
    {
      title: "صلاحيات عناصر كارت الإحصائيات الجانبي",
      perms: [
        { key: 'showSideTotal', label: 'عرض إحصائية إجمالي الوحدات' },
        { key: 'showSideSold', label: 'عرض إحصائية الوحدات المباعة' },
        { key: 'showSideInvestment', label: 'عرض إحصائية الوحدات المستثمرة' },
        { key: 'showSideAvailable', label: 'عرض إحصائية الوحدات المتاحة' },
        { key: 'showSidePromoted', label: 'عرض إحصائية مروج' },
        { key: 'showSideNotPromoted', label: 'عرض إحصائية غير مروج' },
        { key: 'showSideReceivedTabo', label: 'عرض إحصائية مستلم الطابو' },
        { key: 'showSideReceivedUnit', label: 'عرض إحصائية مستلم الوحدة' },
        { key: 'showSideNotReceivedUnit', label: 'عرض إحصائية غير مستلم الوحدة' },
      ]
    },
    {
      title: "صلاحيات الملاحظات والسرية",
      perms: [
        { key: 'showOtherDeptsNotes', label: 'رؤية ملاحظات الأقسام الأخرى' },
        { key: 'canDeleteNotes', label: 'السماح بحذف الملاحظات المسجلة' },
      ]
    }
  ];

  // حساب المساحة الفعلية للصنف بناءً على ما تم تسجيله كصنف قياسي بالخلفية
  const resolvedSpecArea = useMemo(() => {
    if (!selectedSpecKey || !selectedBrochureProject) return '';
    const config = projectConfigs[selectedBrochureProject];
    if (config && config.houseTypeAreas) {
      const area = config.houseTypeAreas[selectedSpecKey.toUpperCase()];
      if (area) return `${area} م²`;
    }
    // في حال عدم العثور عليها أو كانت شقة معتمدة بالمخطط، نستخدم نفس قيمة المفتاح
    return `${selectedSpecKey} م²`;
  }, [selectedSpecKey, selectedBrochureProject, projectConfigs]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-[13px] text-fg-muted">
        جاري التحقق من الهوية
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-sm">
          <div className="mb-10 space-y-3">
            <BrandMark className="size-7" />
            <div className="space-y-1.5">
              <h1 className="text-[22px] font-normal leading-tight text-fg">لوحة تحكم الإدارة</h1>
              <p className="text-[12px] text-fg-muted">يرجى تسجيل الدخول للمتابعة</p>
            </div>
          </div>

          <form onSubmit={handleAdminLogin} className="space-y-5">
            <AdminField label="البريد الإلكتروني">
              <div className="relative">
                <Mail className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-fg-faint" />
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  className="ps-9"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                />
              </div>
            </AdminField>

            <AdminField label="كلمة المرور">
              <div className="relative">
                <Lock className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-fg-faint" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  className="ps-9"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                />
              </div>
            </AdminField>

            <Button type="submit" disabled={isLoggingIn} className="w-full">
              {isLoggingIn ? "جاري التحقق" : "تسجيل الدخول"}
            </Button>
          </form>

          <div className="mt-8 border-t border-line pt-5 text-center">
            <Link to="/" className="text-[12px] text-fg-muted transition-colors hover:text-fg">
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (editingMapProject || isEditingMainMap) {
    return (
      <MapEditor 
        initialElements={isEditingMainMap ? (mainMapData?.elements || []) : (editingMapProject?.elements || [])} 
        onSave={handleSaveMap} 
        mapWidth={isEditingMainMap ? (mainMapData?.width || 1200) : (editingMapProject?.mapWidth || 1000)} 
        mapHeight={isEditingMainMap ? (mainMapData?.height || 800) : (editingMapProject?.mapHeight || 800)} 
        isSaving={isSavingMap}
        projects={projects}
        onCancel={() => { setEditingMapProject(null); setIsEditingMainMap(false); }}
        initialBackgroundColor={isEditingMainMap ? (mainMapData?.backgroundColor || '#ffffff') : (projectConfigs[editingMapProject?.id || '']?.backgroundColor || '#ffffff')}
        initialShowGrid={isEditingMainMap ? (mainMapData?.showGrid !== false) : (projectConfigs[editingMapProject?.id || '']?.showGrid !== false)}
        initialHouseTypeAreas={isEditingMainMap ? {} : (projectConfigs[editingMapProject?.id || '']?.houseTypeAreas || {})}
      />
    );
  }

  const goToView = (view: AdminView) => {
    setActiveView((current) => (current === view ? 'projects' : view));
    setIsCreating(false);
    setEditingProjectInfo(null);
  };

  const adminViews: { id: AdminView; label: string; icon: React.ReactNode }[] = [
    { id: 'projects', label: 'المشاريع', icon: <MapIcon size={14} /> },
    { id: 'brochure', label: 'البروشورات', icon: <Palette size={14} /> },
    { id: 'backup', label: 'النسخ الاحتياطي', icon: <Database size={14} /> },
    { id: 'departments', label: 'الأقسام', icon: <Store size={14} /> },
    { id: 'sales', label: 'تحديث المبيعات', icon: <FileSpreadsheet size={14} /> },
    { id: 'payment', label: 'آلية الدفعات', icon: <CreditCard size={14} /> },
  ];

  return (
    <AppShell
      brandSubtitle="لوحة الإدارة"
      nav={
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto no-scrollbar">
          {adminViews.map((view) => (
            <button
              key={view.id}
              type="button"
              onClick={() => goToView(view.id)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-[12px] transition-colors",
                activeView === view.id
                  ? "text-fg"
                  : "text-fg-muted hover:text-fg",
              )}
            >
              <span className={activeView === view.id ? "text-fg" : "text-fg-faint"}>
                {view.icon}
              </span>
              {view.label}
              {activeView === view.id && (
                <span className="ms-1 size-1 rounded-full bg-fg" aria-hidden="true" />
              )}
            </button>
          ))}
        </nav>
      }
      actions={
        <>
          <Button variant="outline" size="sm" onClick={() => setIsEditingMainMap(true)} className="gap-1.5">
            <MapIcon size={13} /> المخطط العام
          </Button>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-fg-secondary">
              <Layout size={13} /> الموقع
            </Button>
          </Link>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1.5 text-fg-muted hover:text-status-sold">
            <LogOut size={13} /> خروج
          </Button>
        </>
      }
    >
      <div className="mt-8 space-y-6">
        <div>
          <div className="space-y-6">
            
            {showBrochureDesigner && (
              <Panel
                icon={<Palette size={14} />}
                title="مصمم البروشورات التسويقية"
                description="تخصيص الهوية البصرية والمزايا الترويجية ومواصفات الوحدات لكل مشروع"
                actions={
                  <Select value={selectedBrochureProject} onValueChange={setSelectedBrochureProject}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="اختر مشروع" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                }
                bodyClassName="p-5"
              >
                {selectedBrochureProject ? (
                  <div className="space-y-10">
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                      {/* عمود الخيارات والهوية واللوغوهات */}
                      <div className="max-h-[850px] space-y-5 overflow-y-auto border border-line p-5 lg:col-span-4">
                        <SubHeading icon={<Palette size={14} />}>الهوية والألوان</SubHeading>

                        <div className="space-y-4">
                          <p className="text-[11px] leading-relaxed text-fg-muted">
                            لوغو القسم وأرقام الهاتف تُدار من قسم{" "}
                            <button type="button" onClick={() => setActiveView('departments')} className="text-fg underline-offset-2 hover:underline">
                              الأقسام
                            </button>
                            {" "}لكل مركز على حدة.
                          </p>

                          <AdminField label="لوغو المشروع (رابط صورة)">
                            <Input value={activeBrochureConfig.projectLogo || ''} onChange={(e) => setActiveBrochureConfig({ ...activeBrochureConfig, projectLogo: e.target.value })} className="text-[12px]" placeholder="https://" />
                          </AdminField>

                          <AdminField label="قالب البروشور">
                            <div className="grid grid-cols-2 gap-2">
                              {BROCHURE_TEMPLATES.map((template) => {
                                const selected = normalizeTemplateId(activeBrochureConfig.selectedTemplate) === template.id;
                                return (
                                  <button
                                    key={template.id}
                                    type="button"
                                    onClick={() => handleApplyTemplate(template.id)}
                                    className={cn(
                                      "group relative overflow-hidden border p-3 text-start transition-all",
                                      selected
                                        ? "border-fg ring-1 ring-fg"
                                        : "border-line hover:border-line-strong",
                                    )}
                                  >
                                    <div
                                      className="mb-2 h-10 w-full rounded-sm"
                                      style={{ background: template.preview }}
                                    />
                                    <span className="block text-[12px] font-medium text-fg">{template.name}</span>
                                    <span className="mt-0.5 block text-[10px] leading-snug text-fg-faint">{template.description}</span>
                                    {selected && (
                                      <Check size={12} className="absolute left-2 top-2 text-fg" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          </AdminField>

                          <AdminField label="اللون الأساسي (العناوين وأزرار الدعوة)">
                            <div className="flex gap-2">
                              <Input type="color" value={activeBrochureConfig.primaryColor || '#16a34a'} onChange={(e) => setActiveBrochureConfig({ ...activeBrochureConfig, primaryColor: e.target.value })} className="w-11 cursor-pointer p-1" />
                              <Input value={activeBrochureConfig.primaryColor || '#16a34a'} onChange={(e) => setActiveBrochureConfig({ ...activeBrochureConfig, primaryColor: e.target.value })} className="flex-1 font-mono text-[12px]" />
                            </div>
                          </AdminField>

                          <AdminField label="اللون الثانوي (الخلفيات والبطانات)">
                            <div className="flex gap-2">
                              <Input type="color" value={activeBrochureConfig.secondaryColor || '#ffffff'} onChange={(e) => setActiveBrochureConfig({ ...activeBrochureConfig, secondaryColor: e.target.value })} className="w-11 cursor-pointer p-1" />
                              <Input value={activeBrochureConfig.secondaryColor || '#ffffff'} onChange={(e) => setActiveBrochureConfig({ ...activeBrochureConfig, secondaryColor: e.target.value })} className="flex-1 font-mono text-[12px]" />
                            </div>
                          </AdminField>

                          <AdminField label="عبارة تسويقية للترويسة">
                            <Input value={activeBrochureConfig.slogan || ''} onChange={(e) => setActiveBrochureConfig({ ...activeBrochureConfig, slogan: e.target.value })} className="text-[12px]" placeholder="حيث ترتقي الرفاهية المعمارية" />
                          </AdminField>

                          <Button onClick={handleSaveBrochureConfig} disabled={isSavingSettings} className="mt-2 w-full gap-2">
                            <Save size={14} /> حفظ وتعميم التصميم
                          </Button>
                        </div>
                      </div>

                      {/* عمود مواصفات المزايا وتفاصيل الغرف المكتشفة حياً */}
                      <div className="max-h-[850px] space-y-5 overflow-y-auto border border-line p-5 lg:col-span-8">
                        <SubHeading icon={<Sparkle size={14} />}>تفاصيل ومزايا الصنف المعتمد</SubHeading>
                        <p className="text-[11px] leading-relaxed text-fg-muted">
                          يتعرف المحرك تلقائياً على أصناف المنازل ومساحات الشقق المعتمدة داخل المخطط.
                          اختر الصنف المستهدف لتخصيص محتواه.
                        </p>

                        <AdminField label="الصنف / المساحة المكتشفة من المخطط">
                          <Select value={selectedSpecKey} onValueChange={setSelectedSpecKey}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختر الصنف أو المساحة" />
                            </SelectTrigger>
                            <SelectContent>
                              {discoveredTypes.map(type => (
                                <SelectItem key={type} value={type}>صنف منزل — {type}</SelectItem>
                              ))}
                              {discoveredSizes.map(size => (
                                <SelectItem key={size.toString()} value={size.toString()}>شقة — {size} م²</SelectItem>
                              ))}
                              {discoveredTypes.length === 0 && discoveredSizes.length === 0 && (
                                <SelectItem value="none" disabled>لم يتم الكشف عن أي وحدات سكنية بالمخطط</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </AdminField>

                        {selectedSpecKey ? (
                          <div className="space-y-6 border-t border-line pt-5">

                            {/* إضافة وتخصيص المزايا للصنف المختار */}
                            <div className="space-y-3">
                              <Label className="text-[11px] text-fg-muted">
                                المزايا التسويقية لصنف {selectedSpecKey}
                              </Label>
                              <div className="flex gap-2">
                                <Input
                                  value={newAdvantageText}
                                  onChange={(e) => setNewAdvantageText(e.target.value)}
                                  placeholder="مثال: حديقة أمامية واسعة"
                                  className="text-[12px]"
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddAdvantage(); }}
                                />
                                <Button variant="outline" onClick={handleAddAdvantage} className="shrink-0">
                                  إضافة
                                </Button>
                              </div>

                              <div className="max-h-40 divide-y divide-line overflow-y-auto border border-line">
                                {(activeBrochureConfig.advantages?.[selectedSpecKey] || []).map((txt, idx) => (
                                  <div key={idx} className="flex items-start justify-between gap-2 px-3 py-2 text-[12px] text-fg-secondary">
                                    <span className="leading-relaxed">{txt}</span>
                                    <button onClick={() => handleDeleteAdvantage(selectedSpecKey, idx)} className="shrink-0 p-0.5 text-fg-faint transition-colors hover:text-status-sold">
                                      <X size={12} />
                                    </button>
                                  </div>
                                ))}
                                {(!activeBrochureConfig.advantages?.[selectedSpecKey] || activeBrochureConfig.advantages[selectedSpecKey].length === 0) && (
                                  <p className="py-6 text-center text-[11px] text-fg-faint">لا توجد مزايا مضافة لهذا الصنف</p>
                                )}
                              </div>
                            </div>

                            {/* مواصفات الغرف والمساحات الخاصة بالإضافة لصور الوحدة والمخطط */}
                            <div className="space-y-4 border-t border-line pt-5">
                              <SubHeading icon={<Bed size={14} />}>مواصفات الغرف وصور الوحدة</SubHeading>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <AdminField label="عدد الغرف وتفاصيلها">
                                  <Input value={activeDetailRooms} onChange={(e) => setActiveDetailRooms(e.target.value)} placeholder="4 غرف نوم + 3 حمامات + صالة" className="text-[12px]" />
                                </AdminField>
                                <AdminField label="مساحات الغرف الفردية">
                                  <Input value={activeDetailSizes} onChange={(e) => setActiveDetailSizes(e.target.value)} placeholder="صالة 6×4، مطبخ 4×4" className="text-[12px]" />
                                </AdminField>

                                <AdminField label="صورة الواجهة الخارجية (الأولى)">
                                  <Input value={activeDetailUnitImage} onChange={(e) => setActiveDetailUnitImage(e.target.value)} placeholder="https://" className="text-[12px]" />
                                </AdminField>

                                <AdminField label="صورة الواجهة الخارجية (الثانية)">
                                  <Input value={activeDetailUnitImage2} onChange={(e) => setActiveDetailUnitImage2(e.target.value)} placeholder="https://" className="text-[12px]" />
                                </AdminField>

                                <AdminField label="وصف تسويقي للوحدة" className="md:col-span-2">
                                  <Textarea value={activeDetailUnitDescription} onChange={(e) => setActiveDetailUnitDescription(e.target.value)} placeholder="سرد ترويجي يظهر بالصفحة الأولى" className="min-h-[80px] text-[12px]" />
                                </AdminField>

                                <AdminField label="صورة مخطط الطابق الداخلي" className="md:col-span-2">
                                  <Input value={activeDetailHousePlan} onChange={(e) => setActiveDetailHousePlan(e.target.value)} placeholder="https://" className="text-[12px]" />
                                </AdminField>
                              </div>

                              <div className="border-t border-line pt-5">
                                <SubHeading icon={<Banknote size={14} />}>التفاصيل المالية وجدول التسديد</SubHeading>
                              </div>

                              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                <AdminField label="السعر الإجمالي">
                                  <Input value={activeDetailTotalPrice} onChange={(e) => setActiveDetailTotalPrice(e.target.value)} placeholder="150,000,000 د.ع" className="text-[12px]" />
                                </AdminField>
                                <AdminField label="مبلغ توقيع العقد">
                                  <Input value={activeDetailContractAmount} onChange={(e) => setActiveDetailContractAmount(e.target.value)} placeholder="25,000,000 د.ع" className="text-[12px]" />
                                </AdminField>

                                <AdminField label="مدة التسديد وجدولة الدفعات" className="md:col-span-2">
                                  <Input value={activeDetailPaymentDuration} onChange={(e) => setActiveDetailPaymentDuration(e.target.value)} placeholder="أقساط شهرية على 5 سنوات" className="text-[12px]" />
                                </AdminField>

                                <AdminField label="ملاحظات خطة التقسيط" className="md:col-span-2">
                                  <Input value={activeDetailPaymentPlanDetails} onChange={(e) => setActiveDetailPaymentPlanDetails(e.target.value)} placeholder="دفعة سنوية 10%، أو خصم عند الدفع كاش" className="text-[12px]" />
                                </AdminField>
                              </div>

                              <Button onClick={handleSaveUnitDetail} className="w-full">
                                حفظ تفاصيل الصنف {selectedSpecKey}
                              </Button>
                            </div>

                          </div>
                        ) : (
                          <div className="border border-dashed border-line px-6 py-12 text-center text-[11px] text-fg-faint">
                            حدد الصنف من القائمة أعلاه للبدء بتدوين المزايا والمواصفات.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* المعاينة الحية للبروشور بالكامل في الأسفل (A4 صفحتين متتاليتين) */}
                    <div className="space-y-5 border-t border-line pt-8">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <SubHeading icon={<Eye size={14} />}>معاينة البروشور — A4 عمودي</SubHeading>
                        {marketingCenters.length > 0 ? (
                          <Select value={previewBrochureCenterId} onValueChange={setPreviewBrochureCenterId}>
                            <SelectTrigger className="w-[220px]">
                              <SelectValue placeholder="قسم المعاينة" />
                            </SelectTrigger>
                            <SelectContent>
                              {marketingCenters.map((c) => (
                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-[11px] text-fg-faint">أضف قسماً لمعاينة اللوغو والهاتف</span>
                        )}
                      </div>

                      <BrochurePreviewFrame>
                        <BrochureDocument
                          config={activeBrochureConfig}
                          projectName={projects.find(p => p.id === selectedBrochureProject)?.name || 'المشروع'}
                          specKey={selectedSpecKey || 'G'}
                          specArea={resolvedSpecArea || '—'}
                          footerLeft={
                            previewBrochureCenterId
                              ? `${marketingCenters.find(c => c.id === previewBrochureCenterId)?.name || ''} · RealKarar`
                              : 'RealKarar'
                          }
                          centerProfile={getCenterBrochureProfile(centerBrochureProfiles, previewBrochureCenterId)}
                          centerName={marketingCenters.find(c => c.id === previewBrochureCenterId)?.name}
                        />
                      </BrochurePreviewFrame>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    title="لم يتم تحديد مشروع"
                    description="اختر المشروع السكني المستهدف من الأعلى لتخصيص البروشور الخاص به."
                  />
                )}
              </Panel>
            )}

            {showDatabaseInspector && (
              <Panel
                icon={<Database size={14} />}
                title="النسخ الاحتياطي وإدارة البيانات"
                description="تنزيل نسخة كاملة أو استعادتها، وربط النظام بقناة تيليجرام للأرشفة الدورية"
                actions={
                  <>
                    <label
                      className={cn(
                        "inline-flex h-8 cursor-pointer items-center gap-1.5 border border-line px-3 text-[12px] transition-colors hover:bg-surface-sunken",
                        isRestoringBackup && "pointer-events-none opacity-50",
                      )}
                    >
                      <Upload size={13} />
                      {isRestoringBackup ? "جاري الاستعادة" : "استعادة نسخة"}
                      <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" disabled={isRestoringBackup} />
                    </label>

                    <Button size="sm" onClick={handleDownloadBackup} disabled={isGeneratingBackup} className="gap-1.5">
                      <Download size={13} />
                      {isGeneratingBackup ? "جاري التحضير" : "تحميل نسخة"}
                    </Button>
                  </>
                }
                bodyClassName="grid grid-cols-1 gap-px bg-line p-0 lg:grid-cols-3"
              >
                <div className="space-y-5 bg-surface p-5 lg:col-span-1">
                  <SubHeading icon={<Send size={14} />}>إرسال للتيليجرام</SubHeading>
                  <p className="text-[11px] leading-relaxed text-fg-muted">
                    اربط النظام ببوت وقناة تيليجرام لإرسال النسخة الاحتياطية بضغطة واحدة.
                  </p>

                  <AdminField label="توكن البوت">
                    <Input
                      value={telegramConfig.botToken}
                      onChange={(e) => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })}
                      placeholder="123456:ABC-DEF"
                      className="font-mono text-[12px]"
                    />
                  </AdminField>

                  <AdminField label="معرف القناة أو الدردشة">
                    <Input
                      value={telegramConfig.chatId}
                      onChange={(e) => setTelegramConfig({ ...telegramConfig, chatId: e.target.value })}
                      placeholder="-100123456789"
                      className="font-mono text-[12px]"
                    />
                  </AdminField>

                  <div className="flex gap-2 pt-1">
                    <Button variant="outline" onClick={handleSaveTelegramConfig} className="flex-1">
                      حفظ الإعدادات
                    </Button>
                    <Button onClick={handleSendBackupToTelegram} disabled={isSendingToTelegram} className="gap-1.5">
                      <Send size={13} />
                      {isSendingToTelegram ? "جاري الإرسال" : "إرسال الآن"}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center bg-surface p-5 lg:col-span-2">
                  <div className="max-w-md space-y-3">
                    <SubHeading>نسخة احتياطية دورية</SubHeading>
                    <p className="text-[12px] leading-relaxed text-fg-muted">
                      احرص على استخدام الإرسال إلى تيليجرام أو التحميل المباشر لحفظ بيانات الحجوزات
                      وملاحظاتها وتحديثات الإكسل اليومية ضد أي فقدان طارئ.
                    </p>
                  </div>
                </div>
              </Panel>
            )}

            {showMarketingCenters && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-1">
                  <Panel
                    icon={<Store size={14} />}
                    title={editingCenterId ? 'تعديل قسم' : 'إضافة قسم جديد'}
                    bodyClassName="space-y-4 p-5"
                  >
                    <AdminField label="اسم القسم">
                      <Input value={newCenter.name} onChange={(e) => setNewCenter({...newCenter, name: e.target.value})} placeholder="مثال: قسم المبيعات" />
                    </AdminField>

                    <AdminField label="كلمة المرور">
                      <Input type="password" value={newCenter.password} onChange={(e) => setNewCenter({...newCenter, password: e.target.value})} placeholder="••••" />
                    </AdminField>

                    <AdminField label="نوع القسم (للصلاحيات)">
                      <Select value={newCenter.type} onValueChange={(val) => setNewCenter({...newCenter, type: val})}>
                        <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                        <SelectContent>
                          {departmentTypes.map(type => (<SelectItem key={type} value={type}>{type}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </AdminField>

                    <AdminField label="المشاريع المسموحة">
                      <ScrollArea className="h-32 border border-line">
                        <div className="divide-y divide-line">
                          {projects.map(p => (
                            <label key={p.id} htmlFor={`p-${p.id}`} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[12px] transition-colors hover:bg-surface-sunken">
                              <Checkbox id={`p-${p.id}`} checked={newCenter.allowed_projects?.includes(p.id)} onCheckedChange={() => toggleProjectVisibilityForCenter(p.id)} />
                              {p.name}
                            </label>
                          ))}
                        </div>
                      </ScrollArea>
                    </AdminField>

                    <div className="border-t border-line pt-4">
                      <SubHeading icon={<FileImage size={14} />}>بيانات البروشور للقسم</SubHeading>
                      <p className="mt-1 text-[10px] leading-relaxed text-fg-faint">
                        تظهر في البروشور عند دخول هذا القسم — لوغو وأرقام التواصل الخاصة به.
                      </p>
                    </div>

                    <AdminField label="لوغو القسم (رابط صورة)">
                      <Input
                        value={newCenter.marketingLogo}
                        onChange={(e) => setNewCenter({ ...newCenter, marketingLogo: e.target.value })}
                        placeholder="https://"
                        className="text-[12px]"
                      />
                    </AdminField>

                    <div className="grid grid-cols-2 gap-3">
                      <AdminField label="هاتف 1">
                        <div className="relative">
                          <Phone className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-fg-faint" />
                          <Input
                            value={newCenter.phone}
                            onChange={(e) => setNewCenter({ ...newCenter, phone: e.target.value })}
                            className="ps-9 font-mono text-[12px]"
                            placeholder="07XXXXXXXXX"
                          />
                        </div>
                      </AdminField>
                      <AdminField label="هاتف 2">
                        <div className="relative">
                          <Phone className="pointer-events-none absolute inset-y-0 start-3 my-auto size-3.5 text-fg-faint" />
                          <Input
                            value={newCenter.phone2}
                            onChange={(e) => setNewCenter({ ...newCenter, phone2: e.target.value })}
                            className="ps-9 font-mono text-[12px]"
                            placeholder="07XXXXXXXXX"
                          />
                        </div>
                      </AdminField>
                    </div>

                    <div className="border-t border-line pt-4">
                      <SubHeading icon={<Calendar size={14} />}>فترة الاشتراك</SubHeading>
                      <p className="mt-1 text-[10px] leading-relaxed text-fg-faint">
                        عند تحديد تاريخ الانتهاء، يُقفل القسم تلقائياً بعدها. اترك الحقول فارغة لعدم تطبيق حد زمني.
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <AdminField label="بداية الاشتراك">
                        <Input
                          type="date"
                          value={newCenter.subscription_start}
                          onChange={(e) => setNewCenter({ ...newCenter, subscription_start: e.target.value })}
                          className="text-[12px]"
                        />
                      </AdminField>
                      <AdminField label="نهاية الاشتراك">
                        <Input
                          type="date"
                          value={newCenter.subscription_end}
                          onChange={(e) => setNewCenter({ ...newCenter, subscription_end: e.target.value })}
                          className="text-[12px]"
                        />
                      </AdminField>
                    </div>

                    <AdminField label="حالة الاشتراك">
                      <Select
                        value={newCenter.subscription_status}
                        onValueChange={(val: 'active' | 'expired' | 'suspended') =>
                          setNewCenter({ ...newCenter, subscription_status: val })
                        }
                      >
                        <SelectTrigger className="text-[12px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">نشط</SelectItem>
                          <SelectItem value="suspended">معلّق</SelectItem>
                          <SelectItem value="expired">منتهي</SelectItem>
                        </SelectContent>
                      </Select>
                    </AdminField>

                    <AdminField label="ملاحظات الاشتراك (اختياري)">
                      <Textarea
                        value={newCenter.subscription_notes}
                        onChange={(e) => setNewCenter({ ...newCenter, subscription_notes: e.target.value })}
                        placeholder="مثال: تجديد 6 أشهر — دفع نقدي"
                        className="min-h-[72px] text-[12px]"
                      />
                    </AdminField>

                    {editingCenterId && (
                      <div className="space-y-2">
                        <Label className="text-[11px] text-fg-muted">تجديد سريع</Label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: '30 يوم', days: 30 },
                            { label: '3 أشهر', days: 90 },
                            { label: '6 أشهر', days: 180 },
                            { label: 'سنة', days: 365 },
                          ].map((option) => (
                            <Button
                              key={option.days}
                              type="button"
                              variant="outline"
                              size="sm"
                              className="text-[11px]"
                              onClick={() => handleRenewCenterSubscription(editingCenterId, option.days)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button onClick={handleAddCenter} className="flex-1">
                        {editingCenterId ? 'تحديث القسم' : 'إضافة القسم'}
                      </Button>
                      {editingCenterId && (
                        <Button variant="ghost" onClick={resetCenterForm}>
                          إلغاء
                        </Button>
                      )}
                    </div>
                  </Panel>

                  <Panel title="أنواع الأقسام" bodyClassName="space-y-4 p-5">
                    <div className="flex gap-2">
                      <Input
                        value={newDeptType}
                        onChange={(e) => setNewDeptType(e.target.value)}
                        placeholder="مثال: حسابات، مبيعات"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddDeptType(); }}
                      />
                      <Button variant="outline" onClick={handleAddDeptType} className="shrink-0">
                        إضافة
                      </Button>
                    </div>

                    <ScrollArea className="h-44 border border-line">
                      <div className="divide-y divide-line">
                        {departmentTypes.map((type, idx) => (
                          <div key={type} className="flex items-center justify-between gap-2 px-3 py-2 text-[12px]">
                            {editingDeptTypeOldName === type ? (
                              <div className="flex w-full items-center gap-1.5">
                                <Input
                                  value={editingDeptTypeName}
                                  onChange={(e) => setEditingDeptTypeName(e.target.value)}
                                  className="h-7 text-[12px]"
                                  autoFocus
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditDeptType(); }}
                                />
                                <Button size="icon" variant="ghost" className="size-7 shrink-0 text-status-available" onClick={handleSaveEditDeptType}>
                                  <Check size={13} />
                                </Button>
                                <Button size="icon" variant="ghost" className="size-7 shrink-0 text-fg-faint" onClick={() => setEditingDeptTypeOldName(null)}>
                                  <X size={13} />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <span className="truncate text-fg-secondary">{type}</span>
                                <div className="flex items-center gap-0.5">
                                  <Button variant="ghost" size="icon" onClick={() => handleStartEditDeptType(type)} className="size-7 text-fg-faint hover:text-fg">
                                    <Edit2 size={12} />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteDeptType(idx)} className="size-7 text-fg-faint hover:text-status-sold">
                                    <Trash2 size={12} />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                        {departmentTypes.length === 0 && (
                          <p className="py-8 text-center text-[11px] text-fg-faint">لا يوجد أنواع أقسام مضافة بعد</p>
                        )}
                      </div>
                    </ScrollArea>
                  </Panel>
                </div>

                <div className="space-y-6 lg:col-span-2">
                  <Panel title="الأقسام الحالية" bodyClassName="p-0">
                    {marketingCenters.length > 0 ? (
                      <div className="divide-y divide-line">
                        {marketingCenters.map(center => {
                          const profile = getCenterBrochureProfile(centerBrochureProfiles, center.id);
                          const subscription = getCenterSubscription(centerSubscriptions, center.id);
                          const subscriptionLabel = getSubscriptionStatusLabel(subscription);
                          const isSubscriptionWarning = subscriptionLabel.includes('ينتهي خلال');
                          const isSubscriptionExpired = subscriptionLabel === 'منتهي' || subscriptionLabel === 'معلّق';
                          return (
                          <div key={center.id} className="group flex items-center justify-between gap-4 px-5 py-3.5">
                            <div className="flex min-w-0 items-center gap-3">
                              {profile.marketingLogo ? (
                                <img src={profile.marketingLogo} alt="" className="h-8 w-8 shrink-0 rounded object-contain" />
                              ) : null}
                              <div className="min-w-0">
                                <span className="block truncate text-[13px] text-fg">{center.name}</span>
                                {(profile.phone || profile.phone2) && (
                                  <span className="block truncate font-mono text-[10px] text-fg-faint tabular-nums">
                                    {[profile.phone, profile.phone2].filter(Boolean).join(' · ')}
                                  </span>
                                )}
                                {subscription.subscription_end && (
                                  <span className="block truncate text-[10px] text-fg-faint">
                                    ينتهي: {formatSubscriptionDate(subscription.subscription_end)}
                                  </span>
                                )}
                              </div>
                              <span className="shrink-0 border border-line px-1.5 py-0.5 text-[10px] text-fg-muted">
                                {center.type}
                              </span>
                              <span className={cn(
                                "shrink-0 border px-1.5 py-0.5 text-[10px]",
                                isSubscriptionExpired
                                  ? "border-status-sold/30 bg-status-sold/10 text-status-sold"
                                  : isSubscriptionWarning
                                    ? "border-status-reserved/30 bg-status-reserved/10 text-status-reserved"
                                    : "border-line text-fg-muted",
                              )}>
                                {subscriptionLabel}
                              </span>
                            </div>
                            <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                              <Button variant="ghost" size="icon" onClick={() => {
                                const p = getCenterBrochureProfile(centerBrochureProfiles, center.id);
                                const s = getCenterSubscription(centerSubscriptions, center.id);
                                setEditingCenterId(center.id);
                                setNewCenter({
                                  name: center.name,
                                  password: center.password,
                                  type: center.type,
                                  allowed_projects: center.allowed_projects || [],
                                  phone: p.phone || '',
                                  phone2: p.phone2 || '',
                                  marketingLogo: p.marketingLogo || '',
                                  subscription_start: s.subscription_start || '',
                                  subscription_end: s.subscription_end || '',
                                  subscription_status: s.subscription_status || 'active',
                                  subscription_notes: s.subscription_notes || '',
                                });
                              }} className="size-8 text-fg-faint hover:text-fg">
                                <Edit2 size={13} />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteCenter(center.id)} className="size-8 text-fg-faint hover:text-status-sold">
                                <Trash2 size={13} />
                              </Button>
                            </div>
                          </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="px-5 py-12 text-center text-[12px] text-fg-faint">لا يوجد أقسام مسجلة حالياً</p>
                    )}
                  </Panel>

                  {departmentTypes.length > 0 && (
                    <Panel
                      icon={<ShieldCheck size={14} />}
                      title="الصلاحيات التفصيلية لكل قسم"
                      actions={
                        <div className="flex flex-wrap gap-1">
                          {departmentTypes.map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setActivePermsTab(type)}
                              className={cn(
                                "border px-2.5 py-1 text-[11px] transition-colors",
                                activePermsTab === type
                                  ? "border-fg bg-fg text-background"
                                  : "border-line text-fg-secondary hover:bg-surface-sunken",
                              )}
                            >
                              {type}
                            </button>
                          ))}
                        </div>
                      }
                      bodyClassName="p-0"
                    >
                      {activePermsTab && (
                        <div>
                          <div className="flex flex-col gap-3 border-b border-line bg-surface-sunken px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-0.5">
                              <h4 className="text-[12px] font-medium text-fg">تلوين المخطط الافتراضي</h4>
                              <p className="text-[11px] text-fg-muted">كيف تظهر ألوان الوحدات تلقائياً لهذا القسم عند تصفح الخريطة.</p>
                            </div>
                            <Select
                              value={deptPermissions[activePermsTab]?.colorMode || 'default'}
                              onValueChange={(val) => setColorMode(activePermsTab, val)}
                            >
                              <SelectTrigger className="w-[190px] bg-surface">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="default">حسب حالة البيع</SelectItem>
                                <SelectItem value="tabo">حسب حالة الطابو</SelectItem>
                                <SelectItem value="handover">حسب حالة الاستلام</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {permissionsCategories.map((category, catIdx) => (
                            <div key={catIdx}>
                              <div className="border-b border-line px-5 py-2.5">
                                <span className="eyebrow">{category.title}</span>
                              </div>
                              <div className="grid grid-cols-1 gap-px bg-line md:grid-cols-2">
                                {category.perms.map(perm => {
                                  const isPermEnabled = deptPermissions[activePermsTab]?.[perm.key] !== false;
                                  return (
                                    <div key={perm.key} className="flex items-center justify-between gap-4 bg-surface px-5 py-3">
                                      <Label htmlFor={`perm-${perm.key}-${activePermsTab}`} className="cursor-pointer text-[12px] font-normal leading-relaxed text-fg-secondary">
                                        {perm.label}
                                      </Label>
                                      <Switch
                                        id={`perm-${perm.key}-${activePermsTab}`}
                                        checked={isPermEnabled}
                                        onCheckedChange={() => togglePermission(activePermsTab, perm.key)}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Panel>
                  )}
                </div>
              </div>
            )}

            {showPaymentAdmin && (
              <PaymentAdminPanel projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
            )}

            {showSalesUpdate && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="space-y-6 lg:col-span-2">
                  <Panel
                    icon={<Sparkles size={14} />}
                    title="المزامنة الكاملة الذكية"
                    actions={<Switch checked={isSmartFullSync} onCheckedChange={handleToggleSmartSync} />}
                    bodyClassName="space-y-3 p-5"
                  >
                    <p className="text-[12px] leading-relaxed text-fg-secondary">
                      عند التفعيل: أي وحدة حالتها في قاعدة البيانات <span className="text-fg">مباع</span> أو{' '}
                      <span className="text-fg">استثمار</span> وتغيب عن شيت الإكسل المرفوع، يقوم النظام تلقائياً
                      بإلغاء بيعها وإرجاعها متاحة.
                    </p>
                    <p className="flex items-start gap-2 border border-status-reserved/30 bg-status-reserved/[0.06] px-3 py-2.5 text-[11px] leading-relaxed text-fg-secondary">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0 text-status-reserved" />
                      <span>
                        <span className="text-fg">حماية تلقائية:</span> الوحدات المحجوزة يدوياً داخل الموقع
                        (محجوز أو حجز أولي) مستثناة بالكامل ولن يلمسها التصفير المالي.
                      </span>
                    </p>
                  </Panel>

                  <div className="relative flex flex-col items-center justify-center gap-3 border border-dashed border-line bg-surface px-6 py-16 text-center transition-colors hover:border-line-strong">
                    {isProcessing && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-surface/90 backdrop-blur-sm">
                        <div className="flex gap-1.5" aria-hidden="true">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className="h-1 w-6 animate-pulse bg-line-strong" style={{ animationDelay: `${i * 160}ms` }} />
                          ))}
                        </div>
                        <p className="text-[13px] text-fg-secondary">جاري معالجة ومطابقة المبيعات</p>
                      </div>
                    )}
                    <Upload size={24} strokeWidth={1.25} className="text-fg-faint" />
                    <div className="space-y-1">
                      <h3 className="text-[15px] text-fg">اسحب ملف Excel هنا</h3>
                      <p className="text-[12px] text-fg-muted">أو اضغط لاختيار الملف من جهازك</p>
                    </div>
                    <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="absolute inset-0 cursor-pointer opacity-0" disabled={isProcessing} />
                  </div>

                  <div className="border border-line bg-fg">
                    <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5 text-[11px] text-background/60">
                      <Terminal size={13} /> سجل العمليات
                    </div>
                    <div className="h-64 space-y-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed text-background/85">
                      {processLogs.map((log, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="shrink-0 text-background/35">{String(i + 1).padStart(3, '0')}</span>
                          <span>{log}</span>
                        </div>
                      ))}
                      {processLogs.length === 0 && (
                        <p className="text-background/35">في انتظار رفع ملف…</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <Panel icon={<Settings2 size={14} />} title="ربط أعمدة الإكسل" bodyClassName="space-y-3 p-5">
                    <MappingInput label="عمود المدينة" value={excelMapping.cityCol} onChange={(v) => setExcelMapping({...excelMapping, cityCol: v})} />
                    <MappingInput label="عمود رقم الوحدة" value={excelMapping.unitCol} onChange={(v) => setExcelMapping({...excelMapping, unitCol: v})} />
                    <MappingInput label="عمود اسم الزبون" value={excelMapping.nameCol} onChange={(v) => setExcelMapping({...excelMapping, nameCol: v})} />
                    <MappingInput label="عمود رقم الهاتف" value={excelMapping.phoneCol} onChange={(v) => setExcelMapping({...excelMapping, phoneCol: v})} />
                    <MappingInput label="عمود تاريخ البيع" value={excelMapping.dateCol} onChange={(v) => setExcelMapping({...excelMapping, dateCol: v})} />
                    <MappingInput label="عمود السعر" value={excelMapping.priceCol} onChange={(v) => setExcelMapping({...excelMapping, priceCol: v})} />
                    <MappingInput label="عمود العملة" value={excelMapping.currencyCol} onChange={(v) => setExcelMapping({...excelMapping, currencyCol: v})} />
                    <MappingInput label="عمود رقم الطابو" value={excelMapping.taboNumCol} onChange={(v) => setExcelMapping({...excelMapping, taboNumCol: v})} />
                    <MappingInput label="عمود حالة الطابو" value={excelMapping.taboStatusCol} onChange={(v) => setExcelMapping({...excelMapping, taboStatusCol: v})} />
                    <MappingInput label="عمود تاريخ الاستلام" value={excelMapping.handoverDateCol} onChange={(v) => setExcelMapping({...excelMapping, handoverDateCol: v})} />
                  </Panel>

                  <Panel icon={<Tags size={14} />} title="قائمة المستثمرين" bodyClassName="space-y-4 p-5">
                    <div className="flex gap-2">
                      <Input
                        value={newInvestmentName}
                        onChange={(e) => setNewInvestmentName(e.target.value)}
                        placeholder="اسم المستثمر"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddInvestmentName(); }}
                      />
                      <Button variant="outline" onClick={handleAddInvestmentName} className="shrink-0">
                        إضافة
                      </Button>
                    </div>
                    <ScrollArea className="h-32 border border-line">
                      <div className="divide-y divide-line">
                        {investmentNames.map((name, idx) => (
                          <div key={idx} className="flex items-center justify-between px-3 py-2 text-[12px] text-fg-secondary">
                            <span className="truncate">{name}</span>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteInvestmentName(idx)} className="size-6 text-fg-faint hover:text-status-sold">
                              <X size={12} />
                            </Button>
                          </div>
                        ))}
                        {investmentNames.length === 0 && (
                          <p className="py-8 text-center text-[11px] text-fg-faint">لا يوجد مستثمرون مضافون</p>
                        )}
                      </div>
                    </ScrollArea>
                  </Panel>

                  <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full gap-2">
                    <Save size={14} />
                    {isSavingSettings ? 'جاري الحفظ' : 'حفظ كافة الإعدادات'}
                  </Button>
                </div>
              </div>
            )}

            {activeView === 'projects' && (
              <>
                {(isCreating || editingProjectInfo) && (
                  <Panel
                    title={editingProjectInfo ? 'تعديل بيانات المشروع' : 'إنشاء مشروع جديد'}
                    bodyClassName="space-y-4 p-5"
                  >
                    <AdminField label="اسم المشروع">
                      <Input placeholder="ادخل اسم المشروع" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                    </AdminField>
                    <div className="grid grid-cols-2 gap-4">
                      <AdminField label="عرض المخطط (px)">
                        <Input type="number" value={formData.width} onChange={(e) => setFormData({...formData, width: parseInt(e.target.value)})} className="font-mono" />
                      </AdminField>
                      <AdminField label="طول المخطط (px)">
                        <Input type="number" value={formData.height} onChange={(e) => setFormData({...formData, height: parseInt(e.target.value)})} className="font-mono" />
                      </AdminField>
                    </div>
                    <AdminField label="رابط لوغو المشروع / المدينة" hint="يُستخدم في استمارة تنظيم الدفعات والطباعة">
                      <Input
                        placeholder="https://..."
                        value={formData.projectLogo}
                        onChange={(e) => setFormData({ ...formData, projectLogo: e.target.value })}
                      />
                      {formData.projectLogo ? (
                        <img
                          src={formData.projectLogo}
                          alt=""
                          className="mt-2 h-14 w-14 rounded border border-line object-contain"
                        />
                      ) : null}
                    </AdminField>
                    <div className="flex gap-2 pt-1">
                      <Button onClick={editingProjectInfo ? handleUpdateProjectInfo : handleCreateProject}>
                        {editingProjectInfo ? 'تحديث البيانات' : 'إنشاء المشروع'}
                      </Button>
                      <Button variant="ghost" onClick={() => { setIsCreating(false); setEditingProjectInfo(null); }}>
                        إلغاء
                      </Button>
                    </div>
                  </Panel>
                )}

                <Panel
                  icon={<MapIcon size={14} />}
                  title="المشاريع الحالية"
                  description={`${projects.length} مخطط سكني`}
                  actions={
                    <Button size="sm" onClick={() => { setIsCreating(true); setEditingProjectInfo(null); setFormData({ name: '', width: 1000, height: 800, projectLogo: '' }); }} className="gap-1.5">
                      <Plus size={13} /> مشروع جديد
                    </Button>
                  }
                  bodyClassName="p-0"
                >
                  {projects.length > 0 ? (
                    <div className="divide-y divide-line">
                      {projects.map((project, i) => (
                        <div key={project.id} className="group flex items-center justify-between gap-4 px-5 py-4">
                          <div className="flex min-w-0 items-baseline gap-4">
                            <span className="eyebrow shrink-0">{String(i + 1).padStart(2, '0')}</span>
                            <div className="min-w-0">
                              <h3 className="truncate text-[14px] text-fg">{project.name}</h3>
                              <p className="mt-0.5 font-mono text-[11px] text-fg-faint">
                                {project.mapWidth} × {project.mapHeight}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => startEditingInfo(project)} className="size-8 text-fg-faint hover:text-fg">
                              <Edit2 size={14} />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="size-8 text-fg-faint hover:text-status-sold">
                                  <Trash2 size={14} />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>حذف المشروع؟</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    سيتم حذف مشروع "{project.name}" وكافة المخططات والبيانات المرتبطة به نهائياً.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleDeleteProject(project.id)}>
                                    نعم، احذف المشروع
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                            <Button variant="outline" size="sm" onClick={() => startEditingMap(project)} className="ms-1 gap-1.5">
                              <Settings2 size={13} /> تعديل المخطط
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      className="border-0"
                      icon={<MapIcon size={26} strokeWidth={1.25} />}
                      title="لا توجد مشاريع بعد"
                      description="ابدأ بإنشاء مخطط سكني جديد من الزر أعلاه."
                    />
                  )}
                </Panel>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};

export default Admin;