"use client";

import React, { useState, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Plus, Layout, ArrowRight, Settings2, Map as MapIcon, Trash2, Edit2, 
  FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Save, LogOut, 
  Store, Lock, Clock, Eraser, Terminal, RefreshCcw, Database, Search, 
  User, Phone, HelpCircle, Coins, Download, Copy, FileCode, Banknote, 
  Tags, X, ShieldCheck, Eye, EyeOff, Home as HomeIcon, BarChart3, Bell,
  Palette, MessageSquare, MapPin, Info, Send, Check, Sparkles, AlertTriangle, Mail
} from 'lucide-react';
import MapEditor from '@/components/MapEditor';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
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

interface AdminProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  setHousesData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  housesData: Record<string, any>;
}

const MappingInput = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-4">
    <Label className="text-xs font-bold text-slate-600">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="w-16 h-10 text-center font-black rounded-lg border-slate-200" maxLength={2} />
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

const safeDbCall = async <T,>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
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
  const [showSalesUpdate, setShowSalesUpdate] = useState(false);
  const [showMarketingCenters, setShowMarketingCenters] = useState(false);
  const [showDatabaseInspector, setShowDatabaseInspector] = useState(false);
  const [formData, setFormData] = useState({ name: '', width: 1000, height: 800 });
  const [isSavingMap, setIsSavingMap] = useState(false);
  
  const [marketingCenters, setMarketingCenters] = useState<any[]>([]);
  const [newCenter, setNewCenter] = useState({ name: '', password: '', type: '', allowed_projects: [] as string[] });
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

  const [projectConfigs, setProjectConfigs] = useState<Record<string, { backgroundColor?: string, showGrid?: boolean, houseTypeAreas?: Record<string, number> }>>({});

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
        const { data: settingsData } = await supabase
          .from('settings')
          .select('*');

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

          const mainMap = settingsData.find(s => s.key === 'main_map_config');
          if (mainMap) setMainMapData(mainMap.value);

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
        
        if (centersData) setMarketingCenters(centersData);
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    fetchData();
  }, [session]);

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
          setMarketingCenters(marketingCenters.map(c => c.id === editingCenterId ? data[0] : c));
          setEditingCenterId(null);
          showSuccess("تم تحديث القسم بنجاح");
        }
      } else {
        const { data, error } = await supabase
          .from('marketing_centers')
          .insert([payload])
          .select();
        
        if (error) throw error;
        if (data && data.length > 0) {
          setMarketingCenters([data[0], ...marketingCenters]);
          showSuccess("تم إضافة القسم بنجاح");
        }
      }
      setNewCenter({ name: '', password: '', type: '', allowed_projects: [] });
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
      setMarketingCenters(marketingCenters.filter(c => c.id !== id));
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
      canAccessReports: true,
      showDiagnosticTerminal: true
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
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 'A' });

        logs.push(`تم قراءة ${data.length} صف من ملف الإكسل.`);
        setProcessLogs([...logs]);

        // 1. جلب كافة المشاريع المتوفرة وتوحيد أسمائها للمطابقة
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

        // مطابقة ذكية لكل صف
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

        // جلب تفاصيل المخططات للمشاريع المطابقة
        const projectsList: any[] = [];
        for (const proj of matchedProjects) {
          logs.push(`جاري تحميل عناصر المخطط للمشروع "${proj.name}"...`);
          setProcessLogs([...logs]);
          try {
            // استخدام الفيتش المباشر والمحسن مع مهلة زمنية طويلة لتفادي مشاكل الشبكة والبيانات الضخمة
            const fullProj = await safeDbCall(async () => {
              const url = `https://byvzmxrvetgcxstlsszd.supabase.co/rest/v1/projects?select=id,name,elements&id=eq.${proj.id}`;
              const supabaseKey = (supabase as any).supabaseKey;
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 60000); // مهلة 60 ثانية كاملة
              
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

        // تجميع مفاتيح الوحدات المحدثة من الإكسل
        const excelKeys = new Set<string>();

        // معالجة صفوف الإكسل
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

        // 5. تطبيق خيار المزامنة الكاملة الذكية (السيناريو الثاني)
        if (isSmartFullSync && existingHouses && existingHouses.length > 0) {
          logs.push("⚙️ جاري تشغيل المزامنة الكاملة الذكية (السيناريو الثاني): فحص وتصفير الوحدات المباعة والمستثمرة الغائبة عن الإكسل...");
          setProcessLogs([...logs]);
          
          let resetCounter = 0;

          existingHouses.forEach(h => {
            const isMissingFromExcel = !excelKeys.has(h.unit_key);
            const isSoldOrInvestmentInDb = h.data?.status === 'sold' || h.data?.status === 'investment';
            
            // السيناريو الثاني: لا نلمس الوحدات التي حالتها 'pending' (حجز أولي) أو 'reserved' (محجوز)
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
                // نُبقي على حقل h.data.notes لحفظ تاريخ الملاحظات للأمان
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

        // رفع البيانات على دفعات آمنة مع آلية إعادة المحاولة تلقائياً
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
      setProjects([{ ...newProject, mapWidth: Math.round(formData.width), mapHeight: Math.round(formData.height), createdAt: new Date().toISOString(), elements: [] }, ...projects]);
      setFormData({ name: '', width: 1000, height: 800 });
      setIsCreating(false);
      showSuccess('تم إنشاء المشروع بنجاح');
    } catch (error) { showError("فشل في إنشاء المشروع"); }
  };

  const handleUpdateProjectInfo = async () => {
    if (!editingProjectInfo || !formData.name) return;
    try {
      await supabase.from('projects').update({ name: formData.name, map_width: Math.round(formData.width), map_height: Math.round(formData.height) }).eq('id', editingProjectInfo.id);
      setProjects(projects.map(p => p.id === editingProjectInfo.id ? { ...p, name: formData.name, mapWidth: Math.round(formData.width), mapHeight: Math.round(formData.height) } : p));
      setEditingProjectInfo(null);
      setFormData({ name: '', width: 1000, height: 800 });
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
        await supabase.from('settings').upsert({ key: 'main_map_config', value: config });
        setMainMapData(config);
        setIsEditingMainMap(false);
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
      setEditingMapProject(null);
      showSuccess('تم حفظ المخطط بنجاح');
    } catch (error) { showError("فشل في حفظ المخطط"); } finally { setIsSavingMap(false); }
  };

  const startEditingInfo = (project: Project) => {
    setEditingProjectInfo(project);
    setFormData({ name: project.name, width: project.mapWidth, height: project.mapHeight });
    setIsCreating(false);
    setShowSalesUpdate(false);
    setShowMarketingCenters(false);
    setShowDatabaseInspector(false);
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

  // دالة مساعدة سريعة لجلب جميع سجلات جدول الوحدات السكنية عبر التجليد التكراري المضمون بدون حدود
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
      const { data: centersData } = await supabase.from('marketing_centers').select('*');
      
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
        { key: 'showSearchBox', label: 'رؤية واستخدام مربع البحث في الواجهة الرئيسية' },
        { key: 'canAccessReports', label: 'صلاحية الوصول إلى نافذة التقارير والتحليلات' },
        { key: 'showDiagnosticTerminal', label: 'رؤية لوحة تحليل الأداء الفورية (Realtime)' },
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-bold" dir="rtl">
        <div className="text-center space-y-4">
          <RefreshCcw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
          <p className="text-slate-600">جاري التحقق من الهوية...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f0f4f8] flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-xl shadow-indigo-100 mx-auto mb-6">
              <Settings2 className="text-white w-10 h-10" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">لوحة تحكم الإدارة</h1>
            <p className="text-slate-500 font-medium mt-2">يرجى تسجيل الدخول للمتابعة</p>
          </div>
          <form onSubmit={handleAdminLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 mr-2">البريد الإلكتروني</label>
              <div className="relative">
                <Mail className="absolute right-4 top-4 text-slate-400 w-5 h-5" />
                <Input 
                  type="email" 
                  placeholder="admin@example.com" 
                  className="pr-12 rounded-2xl h-14 border-slate-200 font-bold" 
                  value={loginEmail} 
                  onChange={(e) => setLoginEmail(e.target.value)} 
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-slate-600 mr-2">كلمة المرور</label>
              <div className="relative">
                <Lock className="absolute right-4 top-4 text-slate-400 w-5 h-5" />
                <Input 
                  type="password" 
                  placeholder="أدخل كلمة المرور..." 
                  className="pr-12 rounded-2xl h-14 border-slate-200 font-bold" 
                  value={loginPassword} 
                  onChange={(e) => setLoginPassword(e.target.value)} 
                />
              </div>
            </div>
            <Button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-2xl h-14 text-lg font-black shadow-lg shadow-indigo-100"
            >
              {isLoggingIn ? <RefreshCcw className="animate-spin w-5 h-5" /> : "تسجيل الدخول"}
            </Button>
          </form>
          <div className="mt-6 text-center">
            <Link to="/" className="text-sm font-bold text-indigo-600 hover:underline">العودة للرئيسية</Link>
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

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100"><Settings2 className="text-white" /></div>
            <div><h1 className="text-2xl font-black text-slate-800">لوحة الإدارة</h1><p className="text-slate-500 font-medium">إدارة المشاريع والمخططات</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditingMainMap(true)} className="rounded-xl gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"><MapIcon size={18} /> تعديل المخطط العام</Button>
            <Button variant={showDatabaseInspector ? "default" : "outline"} onClick={() => { setShowDatabaseInspector(!showDatabaseInspector); setShowMarketingCenters(false); setShowSalesUpdate(false); setIsCreating(false); setEditingProjectInfo(null); }} className={cn("rounded-xl gap-2", showDatabaseInspector && "bg-blue-600 hover:bg-blue-700")}><Database size={18} /> النسخ الاحتياطي</Button>
            <Button variant={showMarketingCenters ? "default" : "outline"} onClick={() => { setShowMarketingCenters(!showMarketingCenters); setShowDatabaseInspector(false); setShowSalesUpdate(false); setIsCreating(false); setEditingProjectInfo(null); }} className={cn("rounded-xl gap-2", showMarketingCenters && "bg-indigo-600 hover:bg-indigo-700")}><Store size={18} /> الأقسام</Button>
            <Button variant={showSalesUpdate ? "default" : "outline"} onClick={() => { setShowSalesUpdate(!showSalesUpdate); setShowDatabaseInspector(false); setShowMarketingCenters(false); setIsCreating(false); setEditingProjectInfo(null); }} className={cn("rounded-xl gap-2", showSalesUpdate && "bg-emerald-600 hover:bg-emerald-700")}><FileSpreadsheet size={18} /> تحديث المبيعات</Button>
            <Link to="/"><Button variant="outline" className="rounded-xl gap-2"><Layout size={18} />عرض الموقع</Button></Link>
            <Button variant="ghost" onClick={handleLogout} className="rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-2"><LogOut size={18} /> خروج</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-3 space-y-6">
            {showDatabaseInspector && (
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center justify-between border-b pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100"><Database className="text-white" /></div>
                    <h2 className="text-2xl font-black text-slate-800">النسخ الاحتياطي وإدارة البيانات</h2>
                  </div>
                  
                  <div className="flex gap-4">
                    <label className="flex items-center justify-center h-12 px-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-all gap-2 shadow-lg shadow-emerald-100">
                      {isRestoringBackup ? <RefreshCcw className="animate-spin" /> : <Upload size={18} />}
                      {isRestoringBackup ? "جاري استعادة البيانات..." : "استعادة نسخة احتياطية"}
                      <input type="file" accept=".json" onChange={handleRestoreBackup} className="hidden" disabled={isRestoringBackup} />
                    </label>

                    <Button onClick={handleDownloadBackup} disabled={isGeneratingBackup} className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2 h-12 px-6 font-bold shadow-lg shadow-blue-100">
                      {isGeneratingBackup ? <RefreshCcw className="animate-spin" /> : <Download size={18} />}
                      تحميل نسخة احتياطية للجهاز
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                    <h3 className="font-black text-lg flex items-center gap-2 text-slate-800">
                      <Send size={18} className="text-blue-600" /> إرسال للتيليجرام
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed font-semibold">
                      يمكنك ربط النظام ببوت وقناة تليجرام وإرسال النسخة الاحتياطية بضغطة زر مباشرة من هنا.
                    </p>
                    
                    <div className="space-y-4 pt-2">
                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">توكن البوت (Bot Token)</Label>
                        <Input 
                          value={telegramConfig.botToken} 
                          onChange={(e) => setTelegramConfig({ ...telegramConfig, botToken: e.target.value })} 
                          placeholder="مثال: 123456:ABC-DEF..." 
                          className="rounded-xl h-11 font-bold text-xs" 
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">معرف القناة أو الدردشة (Chat ID)</Label>
                        <Input 
                          value={telegramConfig.chatId} 
                          onChange={(e) => setTelegramConfig({ ...telegramConfig, chatId: e.target.value })} 
                          placeholder="مثال: -100123456789" 
                          className="rounded-xl h-11 font-bold text-xs" 
                        />
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button onClick={handleSaveTelegramConfig} className="flex-1 bg-slate-900 hover:bg-black rounded-xl h-11 font-bold text-sm">
                          حفظ الإعدادات
                        </Button>
                        <Button 
                          onClick={handleSendBackupToTelegram} 
                          disabled={isSendingToTelegram} 
                          className="bg-blue-600 hover:bg-blue-700 rounded-xl h-11 px-4 flex items-center gap-2 font-bold shadow-lg shadow-blue-100"
                        >
                          {isSendingToTelegram ? <RefreshCcw className="animate-spin w-4 h-4" /> : <Send size={16} />}
                          إرسال الآن
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="lg:col-span-2 bg-slate-50 rounded-3xl p-6 border border-slate-100 flex flex-col justify-center text-center space-y-4">
                    <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-md mx-auto">
                      <Database className="text-blue-600 w-8 h-8" />
                    </div>
                    <div className="max-w-md mx-auto space-y-2">
                      <h4 className="font-black text-slate-800">هل ترغب في حفظ نسخة احتياطية دورية؟</h4>
                      <p className="text-xs text-slate-500 leading-relaxed font-medium">
                        احرص دوماً على استخدام زر الإرسال إلى تيليجرام أو زر التحميل لحفظ بيانات الحجوزات وملاحظاتها وتحديثات الإكسل اليومية ضد أي فقدان طارئ.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showMarketingCenters && (
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100"><Store className="text-white" /></div>
                    <h2 className="text-2xl font-black text-slate-800">إدارة الأقسام والصلاحيات</h2>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-6">
                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                      <h3 className="font-black text-lg text-slate-700">{editingCenterId ? 'تعديل قسم' : 'إضافة قسم جديد'}</h3>
                      <div className="space-y-4">
                        <div className="space-y-2"><Label className="text-xs font-black text-slate-400 uppercase tracking-wider">اسم القسم</Label><Input value={newCenter.name} onChange={(e) => setNewCenter({...newCenter, name: e.target.value})} className="rounded-xl h-12 font-bold" placeholder="مثال: قسم المبيعات" /></div>
                        <div className="space-y-2"><Label className="text-xs font-black text-slate-400 uppercase tracking-wider">كلمة المرور</Label><Input type="password" value={newCenter.password} onChange={(e) => setNewCenter({...newCenter, password: e.target.value})} className="rounded-xl h-12 font-bold" placeholder="****" /></div>
                        <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">نوع القسم (للصلاحيات)</Label>
                          <Select value={newCenter.type} onValueChange={(val) => setNewCenter({...newCenter, type: val})}>
                            <SelectTrigger className="rounded-xl h-12 font-bold"><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {departmentTypes.map(type => (<SelectItem key={type} value={type} className="font-bold">{type}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-400 uppercase tracking-wider">المشاريع المسموحة</Label>
                          <ScrollArea className="h-32 border rounded-xl p-3 bg-white">
                            <div className="space-y-2">
                              {projects.map(p => (
                                <div key={p.id} className="flex items-center gap-2">
                                  <Checkbox id={`p-${p.id}`} checked={newCenter.allowed_projects?.includes(p.id)} onCheckedChange={() => toggleProjectVisibilityForCenter(p.id)} />
                                  <label htmlFor={`p-${p.id}`} className="text-sm font-bold cursor-pointer">{p.name}</label>
                                </div>
                              ))}
                            </div>
                          </ScrollArea>
                        </div>
                        <Button onClick={handleAddCenter} className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl h-12 font-black shadow-lg shadow-indigo-100">
                          {editingCenterId ? 'تحديث القسم' : 'إضافة القسم'}
                        </Button>
                        {editingCenterId && <Button variant="ghost" onClick={() => { setEditingCenterId(null); setNewCenter({ name: '', password: '', type: '', allowed_projects: [] }); }} className="w-full rounded-xl">إلغاء التعديل</Button>}
                      </div>
                    </div>

                    <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100 space-y-4">
                      <h3 className="font-black text-lg text-slate-700">إدارة أنواع الأقسام</h3>
                      <div className="flex gap-2">
                        <Input 
                          value={newDeptType} 
                          onChange={(e) => setNewDeptType(e.target.value)} 
                          placeholder="مثال: حسابات، مبيعات..." 
                          className="rounded-xl h-11 font-bold"
                          onKeyDown={(e) => { if (e.key === 'Enter') handleAddDeptType(); }}
                        />
                        <Button onClick={handleAddDeptType} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-11 px-4 font-bold shrink-0">
                          إضافة
                        </Button>
                      </div>
                      <ScrollArea className="h-44 border rounded-xl p-2 bg-white">
                        <div className="space-y-1.5">
                          {departmentTypes.map((type, idx) => (
                            <div key={type} className="flex items-center justify-between bg-slate-50 p-2 rounded-xl border border-slate-100 text-xs font-bold transition-all hover:bg-slate-100/70">
                              {editingDeptTypeOldName === type ? (
                                <div className="flex items-center gap-1.5 w-full">
                                  <Input 
                                    value={editingDeptTypeName} 
                                    onChange={(e) => setEditingDeptTypeName(e.target.value)}
                                    className="h-8 text-xs font-bold rounded-lg border-indigo-200"
                                    autoFocus
                                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEditDeptType(); }}
                                  />
                                  <Button size="icon" className="h-8 w-8 bg-emerald-600 hover:bg-emerald-700 shrink-0 rounded-lg text-white" onClick={handleSaveEditDeptType}>
                                    <Check size={14} />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-600 shrink-0 rounded-lg" onClick={() => setEditingDeptTypeOldName(null)}>
                                    <X size={14} />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="truncate max-w-[140px]">{type}</span>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => handleStartEditDeptType(type)} className="h-7 w-7 text-blue-500 hover:bg-blue-50 hover:text-blue-600 rounded-lg">
                                      <Edit2 size={13} />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteDeptType(idx)} className="h-7 w-7 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg">
                                      <Trash2 size={13} />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                          {departmentTypes.length === 0 && (
                            <p className="text-center text-slate-400 py-6 text-xs font-semibold">لا يوجد أنواع أقسام مضافة بعد</p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>

                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-50 rounded-3xl border border-slate-100 overflow-hidden">
                      <div className="p-6 border-b border-slate-200 bg-white"><h3 className="font-black text-lg text-slate-700">الأقسام الحالية</h3></div>
                      <div className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {marketingCenters.map(center => (
                            <div key={center.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-3 group">
                              <div className="flex justify-between items-start">
                                <div><h4 className="font-black text-slate-800">{center.name}</h4><span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{center.type}</span></div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button variant="ghost" size="icon" onClick={() => { setEditingCenterId(center.id); setNewCenter({ name: center.name, password: center.password, type: center.type, allowed_projects: center.allowed_projects || [] }); }} className="text-blue-500 h-8 w-8"><Edit2 size={14} /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleDeleteCenter(center.id)} className="text-rose-500 h-8 w-8"><Trash2 size={14} /></Button>
                                </div>
                              </div>
                            </div>
                          ))}
                          {marketingCenters.length === 0 && (
                            <div className="col-span-2 text-center py-8 text-slate-400 font-bold">لا يوجد أقسام مسجلة حالياً</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {departmentTypes.length > 0 && (
                      <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="text-indigo-600" />
                            <h3 className="font-black text-lg text-slate-800">الصلاحيات التفصيلية لكل قسم</h3>
                          </div>
                          <div className="flex gap-2">
                            {departmentTypes.map(type => (
                              <Button 
                                key={type} 
                                variant={activePermsTab === type ? "default" : "outline"} 
                                onClick={() => setActivePermsTab(type)}
                                className={cn("rounded-xl font-bold h-10", activePermsTab === type && "bg-indigo-600")}
                              >
                                {type}
                              </Button>
                            ))}
                          </div>
                        </div>

                        {activePermsTab && (
                          <div className="p-6 space-y-8">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100 gap-4">
                              <div>
                                <h4 className="font-black text-indigo-900 text-sm">تلوين المخطط الافتراضي</h4>
                                <p className="text-[11px] text-indigo-500 font-semibold mt-0.5">اختر كيف تظهر ألوان الوحدات سكنية تلقائياً لهذا القسم عند تصفح الخريطة.</p>
                              </div>
                              <Select 
                                value={deptPermissions[activePermsTab]?.colorMode || 'default'} 
                                onValueChange={(val) => setColorMode(activePermsTab, val)}
                              >
                                <SelectTrigger className="w-[180px] rounded-xl bg-white font-bold text-indigo-950 border-indigo-200">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  <SelectItem value="default" className="font-bold">حسب حالة البيع (مباع/متاح)</SelectItem>
                                  <SelectItem value="tabo" className="font-bold">حسب حالة الطابو</SelectItem>
                                  <SelectItem value="handover" className="font-bold">حسب حالة الاستلام</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-8">
                              {permissionsCategories.map((category, catIdx) => (
                                <div key={catIdx} className="space-y-4 border-t pt-6 first:border-t-0 first:pt-0">
                                  <h4 className="font-black text-slate-800 text-sm flex items-center gap-2">
                                    <div className="w-1.5 h-4 bg-indigo-600 rounded-full" />
                                    {category.title}
                                  </h4>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {category.perms.map(perm => {
                                      const isPermEnabled = deptPermissions[activePermsTab]?.[perm.key] !== false;
                                      return (
                                        <div key={perm.key} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-slate-100/50 transition-colors">
                                          <Label htmlFor={`perm-${perm.key}-${activePermsTab}`} className="font-bold text-slate-700 cursor-pointer text-xs leading-relaxed">
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
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {showSalesUpdate && (
              <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8 animate-in fade-in slide-in-from-top-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100"><FileSpreadsheet className="text-white" /></div>
                    <h2 className="text-2xl font-black text-slate-800">تحديث المبيعات من ملف Excel</h2>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-2 space-y-6">
                    {/* مفتاح تفعيل المزامنة الكاملة الذكية (السيناريو الثاني) مع شرح تفصيلي وواضح للتحكم بها من الإدارة */}
                    <div className="p-6 bg-blue-50/50 border border-blue-100 rounded-3xl flex items-start gap-4 shadow-sm animate-in fade-in">
                      <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 shadow-lg shadow-blue-100 mt-1">
                        <Sparkles className="text-white w-5 h-5" />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="font-black text-blue-900 text-base">المزامنة الكاملة الذكية (السيناريو الثاني)</h4>
                          <Switch checked={isSmartFullSync} onCheckedChange={handleToggleSmartSync} />
                        </div>
                        <p className="text-xs text-blue-700 leading-relaxed font-semibold">
                          عند التفعيل: أي وحدة حالتها في قاعدة البيانات **(مباع)** أو **(استثمار)** وتغيب عن شيت الإكسل المرفوع، سيقوم النظام تلقائياً **بإلغاء بيعها وإرجاعها خضراء متوفرة**.
                        </p>
                        <p className="text-[11px] text-indigo-600 font-bold flex items-center gap-1.5 bg-white/60 p-2 rounded-xl mt-2 border border-indigo-100">
                          <AlertTriangle size={12} />
                          <strong>حماية تلقائية:</strong> الوحدات المحجوزة يدوياً داخل الموقع (محجوز أو حجز أولي) يتم استثناؤها وحمايتها بالكامل ولن يلمسها التصفير المالي أبداً.
                        </p>
                      </div>
                    </div>

                    <div className="p-10 border-4 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-4 group hover:border-emerald-200 transition-colors relative overflow-hidden">
                      {isProcessing && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center flex-col gap-4"><RefreshCcw className="w-12 h-12 text-emerald-600 animate-spin" /><p className="font-black text-emerald-800">جاري معالجة ومطابقة المبيعات بالكامل...</p></div>}
                      <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform"><Upload className="text-emerald-600 w-10 h-10" /></div>
                      <div><h3 className="text-xl font-black text-slate-800">اسحب ملف Excel هنا</h3><p className="text-slate-500 font-medium mt-1">أو اضغط لاختيار الملف من جهازك</p></div>
                      <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isProcessing} />
                    </div>
                    
                    <div className="bg-slate-900 rounded-3xl p-6 font-mono text-xs text-emerald-400 space-y-2 h-64 overflow-y-auto shadow-2xl border border-slate-800">
                      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-4 text-slate-500"><Terminal size={14} /> سجل العمليات</div>
                      {processLogs.map((log, i) => (<div key={i} className="flex gap-2"><span>[{new Date().toLocaleTimeString()}]</span><span>{log}</span></div>))}
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-6">
                      <h3 className="font-black text-lg flex items-center gap-2 text-slate-800"><Settings2 size={20} className="text-emerald-600" /> إعدادات المخطط</h3>
                      <div className="space-y-4">
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
                      </div>
                    </div>

                    <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                      <h3 className="font-black text-lg flex items-center gap-2 text-slate-800">
                        <Tags size={20} className="text-emerald-600" /> قائمة المستثمرين
                      </h3>
                      <div className="flex gap-2">
                        <Input 
                          value={newInvestmentName} 
                          onChange={(e) => setNewInvestmentName(e.target.value)} 
                          placeholder="اسم المستثمر..." 
                          className="rounded-xl h-10"
                        />
                        <Button onClick={handleAddInvestmentName} className="bg-emerald-600 hover:bg-emerald-700 rounded-xl h-10 px-4">
                          إضافة
                        </Button>
                      </div>
                      <ScrollArea className="h-32 border rounded-xl p-2 bg-slate-50">
                        <div className="space-y-1">
                          {investmentNames.map((name, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-white p-2 rounded-lg border text-xs font-bold">
                              <span>{name}</span>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteInvestmentName(idx)} className="h-6 w-6 text-rose-500 hover:bg-rose-50">
                                <X size={12} />
                              </Button>
                            </div>
                          ))}
                          {investmentNames.length === 0 && (
                            <p className="text-center text-slate-400 py-4 text-xs">لا يوجد مستثمرون مضافون</p>
                          )}
                        </div>
                      </ScrollArea>
                    </div>

                    <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="w-full bg-slate-900 hover:bg-black rounded-2xl h-14 font-black gap-2 shadow-xl">
                      {isSavingSettings ? <RefreshCcw className="animate-spin" /> : <Save size={20} />}
                      حفظ كافة الإعدادات
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {!showDatabaseInspector && !showMarketingCenters && !showSalesUpdate && (
              <>
                <div className="flex items-center justify-between"><h2 className="text-xl font-bold">المشاريع الحالية</h2><Button onClick={() => { setIsCreating(true); setEditingProjectInfo(null); setFormData({ name: '', width: 1000, height: 800 }); }} className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2"><Plus size={18} />مشروع جديد</Button></div>
                {(isCreating || editingProjectInfo) && (
                  <div className="bg-white p-8 rounded-[2.5rem] border-2 border-blue-100 shadow-xl animate-in fade-in slide-in-from-top-4 space-y-6">
                    <h3 className="font-black text-xl">{editingProjectInfo ? 'تعديل بيانات المشروع' : 'إنشاء مشروع جديد'}</h3>
                    <div className="space-y-4">
                      <div className="space-y-2"><label className="text-sm font-bold text-slate-500">اسم المشروع</label><Input placeholder="ادخل اسم المشروع..." value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="rounded-xl h-12" /></div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2"><label className="text-sm font-bold text-slate-500">عرض المخطط (px)</label><Input type="number" value={formData.width} onChange={(e) => setFormData({...formData, width: parseInt(e.target.value)})} className="rounded-xl h-12" /></div>
                        <div className="space-y-2"><label className="text-sm font-bold text-slate-500">طول المخطط (px)</label><Input type="number" value={formData.height} onChange={(e) => setFormData({...formData, height: parseInt(e.target.value)})} className="rounded-xl h-12" /></div>
                      </div>
                      <div className="flex gap-3 pt-4"><Button onClick={editingProjectInfo ? handleUpdateProjectInfo : handleCreateProject} className="bg-blue-600 rounded-xl h-12 px-8 font-bold">{editingProjectInfo ? 'تحديث البيانات' : 'إنشاء المشروع'}</Button><Button variant="ghost" onClick={() => { setIsCreating(false); setEditingProjectInfo(null); }} className="rounded-xl h-12">إلغاء</Button></div>
                    </div>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4">
                  {projects.map(project => (
                    <div key={project.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100"><MapIcon className="text-slate-400" /></div><div><h3 className="font-bold text-lg">{project.name}</h3><p className="text-sm text-slate-500">{project.mapWidth}x{project.mapHeight}</p></div></div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEditingInfo(project)} className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></Button></AlertDialogTrigger>
                          <AlertDialogContent dir="rtl">
                            <AlertDialogHeader><AlertDialogTitle className="text-right">هل أنت متأكد من حذف المشروع؟</AlertDialogTitle><AlertDialogDescription className="text-right">سيتم حذف مشروع "{project.name}" وكافة المخططات والبيانات المرتبطة به نهائياً.</AlertDialogDescription></AlertDialogHeader>
                            <AlertDialogFooter className="flex-row-reverse gap-2"><AlertDialogAction onClick={() => handleDeleteProject(project.id)} className="bg-rose-600 hover:bg-rose-700 rounded-xl">نعم، احذف المشروع</AlertDialogAction><AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <Button onClick={() => startEditingMap(project)} className="bg-slate-900 hover:bg-slate-800 rounded-xl gap-2"><Settings2 size={16} />تعديل المخطط</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;