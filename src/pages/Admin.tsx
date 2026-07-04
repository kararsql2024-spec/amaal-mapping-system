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
  Palette, MessageSquare, MapPin
} from 'lucide-react';
import MapEditor from '@/components/MapEditor';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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

const Admin = ({ projects, setProjects, setHousesData, housesData = {} }: AdminProps) => {
  const [session, setSession] = useState<any>(null);
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
  const [departmentTypes, setDepartmentTypes] = useState<string[]>([]);
  const [newDeptType, setNewDeptType] = useState('');
  const [deptPermissions, setDeptPermissions] = useState<Record<string, any>>({});
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [processLogs, setProcessLogs] = useState<string[]>([]);

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
  const [isResetting, setIsResetting] = useState(false);

  // Backup States
  const [isGeneratingBackup, setIsGeneratingBackup] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
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
          if (deptTypes) setDepartmentTypes(deptTypes.value || []);

          const permissions = settingsData.find(s => s.key === 'dept_permissions');
          if (permissions) setDeptPermissions(permissions.value || {});

          const mainMap = settingsData.find(s => s.key === 'main_map_config');
          if (mainMap) setMainMapData(mainMap.value);
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

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100 mx-auto mb-4">
              <Settings2 className="text-white w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-slate-800">تسجيل دخول الإدارة</h1>
            <p className="text-slate-500 font-medium mt-2">يرجى إدخال بيانات الاعتماد للوصول</p>
          </div>
          <Auth
            supabaseClient={supabase}
            providers={[]}
            view="sign_in"
            showLinks={false}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#4f46e5',
                    brandAccent: '#4338ca',
                  },
                },
              },
              className: {
                container: 'font-bold',
                button: 'rounded-xl h-12 font-bold',
                input: 'rounded-xl h-12 border-slate-200',
              }
            }}
            theme="light"
          />
        </div>
      </div>
    );
  }

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
    if (!newDeptType) return;
    const updated = [...departmentTypes, newDeptType];
    try {
      await supabase.from('settings').upsert({ key: 'department_types', value: updated });
      setDepartmentTypes(updated);
      setNewDeptType('');
      showSuccess("تم إضافة نوع القسم");
    } catch (error) {
      showError("فشل في الحفظ");
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
      canDeleteNotes: false
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

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    // ... (keep existing excel upload logic)
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

  const handleSaveMap = async (elements: MapElement[], newWidth: number, newHeight: number) => {
    if (isEditingMainMap) {
      setIsSavingMap(true);
      try {
        const config = { elements, width: newWidth, height: newHeight };
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

  const handleDownloadBackup = async () => {
    // ... (keep existing backup logic)
  };

  if (editingMapProject || isEditingMainMap) {
    return (
      <MapEditor 
        initialElements={isEditingMainMap ? (mainMapData?.elements || []) : (editingMapProject?.elements || [])} 
        mapWidth={isEditingMainMap ? (mainMapData?.width || 1200) : (editingMapProject?.mapWidth || 1000)}
        mapHeight={isEditingMainMap ? (mainMapData?.height || 800) : (editingMapProject?.mapHeight || 800)}
        onSave={handleSaveMap} 
        onCancel={() => { setEditingMapProject(null); setIsEditingMainMap(false); }} 
        isMainMapMode={isEditingMainMap}
        projects={projects}
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
            {/* ... (keep existing conditional sections) */}
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