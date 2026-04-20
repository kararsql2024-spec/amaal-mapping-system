"use client";

import React, { useState, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Layout, ArrowRight, Settings2, Map as MapIcon, Trash2, Edit2, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Save, LogOut, Store, Lock, Clock } from 'lucide-react';
import MapEditor from '@/components/MapEditor';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

interface AdminProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}

const Admin = ({ projects, setProjects }: AdminProps) => {
  const [session, setSession] = useState<any>(null);
  const [editingMapProject, setEditingMapProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectInfo, setEditingProjectInfo] = useState<Project | null>(null);
  const [showSalesUpdate, setShowSalesUpdate] = useState(false);
  const [showMarketingCenters, setShowMarketingCenters] = useState(false);
  const [formData, setFormData] = useState({ name: '', width: 1000, height: 800 });
  
  const [marketingCenters, setMarketingCenters] = useState<any[]>([]);
  const [newCenter, setNewCenter] = useState({ name: '', password: '' });
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const [excelMapping, setExcelMapping] = useState({
    cityCol: 'A',
    unitCol: 'B',
    nameCol: 'C',
    phoneCol: 'D',
    dateCol: 'E'
  });
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

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
          if (mapping) setExcelMapping(mapping.value);
          
          const update = settingsData.find(s => s.key === 'last_excel_update');
          if (update) setLastUpdate(update.value);
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
            localization={{
              variables: {
                sign_in: {
                  email_label: 'البريد الإلكتروني',
                  password_label: 'كلمة المرور',
                  button_label: 'تسجيل الدخول',
                  loading_button_label: 'جاري تسجيل الدخول...',
                  email_input_placeholder: 'بريدك الإلكتروني',
                  password_input_placeholder: 'كلمة المرور الخاصة بك',
                },
              },
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
    if (!newCenter.name || !newCenter.password) return;
    try {
      const { data, error } = await supabase
        .from('marketing_centers')
        .insert([newCenter])
        .select();
      
      if (error) throw error;
      setMarketingCenters([data[0], ...marketingCenters]);
      setNewCenter({ name: '', password: '' });
      showSuccess("تم إضافة المركز التسويقي بنجاح");
    } catch (error) {
      showError("فشل في إضافة المركز");
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
      showSuccess("تم حذف المركز");
    } catch (error) {
      showError("فشل في حذف المركز");
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      const { error } = await supabase
        .from('settings')
        .upsert({ 
          key: 'excel_mapping', 
          value: excelMapping,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      showSuccess("تم حفظ إعدادات الأعمدة في قاعدة البيانات");
    } catch (error) {
      console.error("Error saving settings:", error);
      showError("فشل في حفظ الإعدادات");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const normalizeForMatch = (text: any) => {
    if (text === null || text === undefined) return "";
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\u064B-\u0652\u0640]/g, "") 
      .replace(/[أإآ]/g, "ا") 
      .replace(/[ة]/g, "ه") 
      .replace(/[ى]/g, "ي") 
      .replace(/[^a-z0-9\u0621-\u064A]/gi, "") 
      .replace(/\s+/g, "");
  };

  const colToIdx = (col: string) => {
    let res = 0;
    const cleanCol = col.trim().toUpperCase();
    for (let i = 0; i < cleanCol.length; i++) {
      res = res * 26 + (cleanCol.charCodeAt(i) - 64);
    }
    return res - 1;
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        const cityIdx = colToIdx(excelMapping.cityCol);
        const unitIdx = colToIdx(excelMapping.unitCol);
        const nameIdx = colToIdx(excelMapping.nameCol);
        const phoneIdx = colToIdx(excelMapping.phoneCol);
        const dateIdx = colToIdx(excelMapping.dateCol);

        let currentHousesData: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
          const { data: chunk, error: fetchError } = await supabase
            .from('houses_data')
            .select('*')
            .range(from, from + step - 1);

          if (fetchError) throw fetchError;
          if (!chunk || chunk.length === 0) {
            hasMore = false;
          } else {
            currentHousesData = [...currentHousesData, ...chunk];
            from += step;
            if (chunk.length < step) hasMore = false;
          }
        }

        const housesDataMap: Record<string, any> = {};
        currentHousesData?.forEach(u => {
          housesDataMap[u.unit_key] = u.data;
        });

        const labelToKeyMap = new Map<string, string>();
        const keyToLabelMap = new Map<string, string>();
        const projectMap = new Map<string, string>();

        projects.forEach(project => {
          const normProjectName = normalizeForMatch(project.name);
          projectMap.set(normProjectName, project.id);

          project.elements.forEach(el => {
            if (el.type === 'house') {
              const normLabel = normalizeForMatch(el.label);
              labelToKeyMap.set(`${project.id}_${normLabel}`, el.id);
              keyToLabelMap.set(el.id, el.label);
            } else if (el.type === 'tower') {
              let pCounter = 0;
              const floors = el.floors || 1;
              const aptsPerFloor = el.apartmentsPerFloor || 1;

              for (let f = 1; f <= floors; f++) {
                const floorCode = f === 1 ? "FG" : `F${f - 1}`;
                for (let a = 1; a <= aptsPerFloor; a++) {
                  const techKey = `${el.id}_F${f}_A${a}`;
                  const unitData = housesDataMap[techKey];
                  if (unitData?.status !== 'frozen_uncounted') pCounter++;
                  const aptCode = unitData?.status === 'frozen_uncounted' ? "مجمدة" : `P${pCounter}`;
                  const fullLabel = `${el.label}-${floorCode}-${aptCode}`;
                  const normLabel = normalizeForMatch(fullLabel);
                  labelToKeyMap.set(`${project.id}_${normLabel}`, techKey);
                  keyToLabelMap.set(techKey, fullLabel);
                }
              }
            }
          });
        });

        const updatesMap = new Map<string, any>();
        const projectsInExcel = new Set<string>();
        const notifications: any[] = [];
        const now = new Date().toLocaleString('ar-EG');

        data.forEach((row, index) => {
          if (index === 0) return;
          const normCity = normalizeForMatch(row[cityIdx]);
          const projectId = projectMap.get(normCity);
          
          if (projectId) {
            projectsInExcel.add(projectId);
            const normUnitLabel = normalizeForMatch(row[unitIdx]);
            const techKey = labelToKeyMap.get(`${projectId}_${normUnitLabel}`);

            if (techKey) {
              const oldData = housesDataMap[techKey] || { status: 'available' };
              const newName = String(row[nameIdx] || '');
              const saleDate = row[dateIdx] ? new Date((row[dateIdx] - (25567 + 1)) * 86400 * 1000).toISOString().split('T')[0] : '';
              const unitLabel = keyToLabelMap.get(techKey);

              if (oldData.status !== 'sold') {
                let msg = "";
                if (oldData.status === 'reserved') {
                  msg = `تم بيع الوحدة المحجوزة ${unitLabel} باسم ${oldData.name || 'غير معروف'} إلى ${newName} بتاريخ ${now}`;
                } else {
                  msg = `تم بيع الوحدة ${unitLabel} للسيد ${newName} بتاريخ ${now}`;
                }
                notifications.push({ project_id: projectId, message: msg });
              }

              updatesMap.set(techKey, {
                unit_key: techKey,
                project_id: projectId,
                data: { ...oldData, name: newName, phone: String(row[phoneIdx] || ''), saleDate, status: 'sold' }
              });
            }
          }
        });

        currentHousesData?.forEach(unit => {
          if (projectsInExcel.has(unit.project_id) && unit.data?.status === 'sold') {
            if (!updatesMap.has(unit.unit_key)) {
              const unitLabel = keyToLabelMap.get(unit.unit_key);
              notifications.push({ 
                project_id: unit.project_id, 
                message: `تم توفر الوحدة السكنية ${unitLabel} بتاريخ ${now}` 
              });

              updatesMap.set(unit.unit_key, {
                unit_key: unit.unit_key,
                project_id: unit.project_id,
                data: { ...unit.data, status: 'available', name: '', phone: '', saleDate: '' }
              });
            }
          }
        });

        const finalUpdates = Array.from(updatesMap.values());
        if (finalUpdates.length > 0) {
          const chunkSize = 500;
          for (let i = 0; i < finalUpdates.length; i += chunkSize) {
            await supabase.from('houses_data').upsert(finalUpdates.slice(i, i + chunkSize), { onConflict: 'unit_key' });
          }
          
          if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);
          }

          const updateTime = new Date().toISOString();
          await supabase.from('settings').upsert({ key: 'last_excel_update', value: updateTime });
          setLastUpdate(updateTime);
          
          showSuccess(`تم تحديث ${finalUpdates.length} وحدة وتوليد ${notifications.length} إشعار`);
        } else {
          showError("لم يتم العثور على مسميات متطابقة");
        }
      } catch (error) {
        console.error(error);
        showError("حدث خطأ أثناء المعالجة");
      } finally {
        setIsProcessing(false);
        if (e.target) e.target.value = '';
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

  const handleSaveMap = async (elements: MapElement[], newWidth: number, newHeight: number) => {
    if (editingMapProject) {
      try {
        await supabase.from('projects').update({ elements, map_width: Math.round(newWidth), map_height: Math.round(newHeight) }).eq('id', editingMapProject.id);
        setProjects(projects.map(p => p.id === editingMapProject.id ? { ...p, elements, mapWidth: Math.round(newWidth), mapHeight: Math.round(newHeight) } : p));
        setEditingMapProject(null);
        showSuccess('تم حفظ المخطط بنجاح');
      } catch (error) { showError("فشل في حفظ المخطط"); }
    }
  };

  const startEditingInfo = (project: Project) => {
    setEditingProjectInfo(project);
    setFormData({ name: project.name, width: project.mapWidth, height: project.mapHeight });
    setIsCreating(false);
    setShowSalesUpdate(false);
    setShowMarketingCenters(false);
  };

  if (editingMapProject) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setEditingMapProject(null)} className="rounded-xl"><ArrowRight className="ml-2" />العودة</Button>
            <h1 className="text-2xl font-black">تعديل مخطط: {editingMapProject.name}</h1>
          </div>
          <MapEditor initialElements={editingMapProject.elements} onSave={handleSaveMap} mapWidth={editingMapProject.mapWidth} mapHeight={editingMapProject.mapHeight} />
        </div>
      </div>
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
            <Button variant={showMarketingCenters ? "default" : "outline"} onClick={() => { setShowMarketingCenters(!showMarketingCenters); setShowSalesUpdate(false); setIsCreating(false); setEditingProjectInfo(null); }} className={cn("rounded-xl gap-2", showMarketingCenters && "bg-indigo-600 hover:bg-indigo-700")}><Store size={18} /> المراكز التسويقية</Button>
            <Button variant={showSalesUpdate ? "default" : "outline"} onClick={() => { setShowSalesUpdate(!showSalesUpdate); setShowMarketingCenters(false); setIsCreating(false); setEditingProjectInfo(null); }} className={cn("rounded-xl gap-2", showSalesUpdate && "bg-emerald-600 hover:bg-emerald-700")}><FileSpreadsheet size={18} /> تحديث المبيعات</Button>
            <Link to="/"><Button variant="outline" className="rounded-xl gap-2"><Layout size={18} />عرض الموقع</Button></Link>
            <Button variant="ghost" onClick={handleLogout} className="rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-2"><LogOut size={18} /> خروج</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {showMarketingCenters ? (
              <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-xl animate-in fade-in slide-in-from-top-4 space-y-8">
                <div className="flex items-center gap-3 border-b pb-4"><div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center"><Store className="text-indigo-600" /></div><h2 className="text-xl font-black text-slate-800">إدارة المراكز التسويقية</h2></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
                  <div className="space-y-2"><label className="text-sm font-bold text-slate-600">اسم المركز</label><Input placeholder="اسم المركز التسويقي..." value={newCenter.name} onChange={(e) => setNewCenter({...newCenter, name: e.target.value})} className="rounded-xl h-12" /></div>
                  <div className="space-y-2"><label className="text-sm font-bold text-slate-600">كلمة المرور</label><Input type="password" placeholder="كلمة مرور المركز..." value={newCenter.password} onChange={(e) => setNewCenter({...newCenter, password: e.target.value})} className="rounded-xl h-12" /></div>
                  <Button onClick={handleAddCenter} className="md:col-span-2 bg-indigo-600 hover:bg-indigo-700 rounded-xl h-12 font-bold gap-2"><Plus size={18} /> إضافة مركز جديد</Button>
                </div>
                <div className="space-y-3">
                  <h3 className="font-bold text-slate-700">قائمة المراكز الحالية</h3>
                  {marketingCenters.map(center => (
                    <div key={center.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                      <div className="flex items-center gap-3"><div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center"><Store className="text-slate-400" size={20} /></div><div><p className="font-bold text-slate-800">{center.name}</p><p className="text-xs text-slate-400 flex items-center gap-1"><Lock size={10} /> {center.password}</p></div></div>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteCenter(center.id)} className="text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={18} /></Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : showSalesUpdate ? (
              <div className="bg-white p-8 rounded-[2.5rem] border-2 border-emerald-100 shadow-xl animate-in fade-in slide-in-from-top-4 space-y-8">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><FileSpreadsheet className="text-emerald-600" /></div><h2 className="text-xl font-black text-slate-800">تحديث بيانات الوحدات عبر الإكسل</h2></div>
                  <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2"><Save size={18} /> {isSavingSettings ? "جاري الحفظ..." : "حفظ إعدادات الأعمدة"}</Button>
                </div>

                {lastUpdate && (
                  <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 p-3 rounded-xl border border-indigo-100">
                    <Clock size={16} /> آخر تحديث للبيانات: {new Date(lastUpdate).toLocaleString('ar-EG')}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-sm font-bold text-slate-600 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> عمود المدينة (A, B, ...)</label><Input placeholder="A" value={excelMapping.cityCol} onChange={(e) => setExcelMapping({...excelMapping, cityCol: e.target.value.toUpperCase()})} className="rounded-xl h-12 border-slate-200" /></div>
                  <div className="space-y-2"><label className="text-sm font-bold text-slate-600">عمود رقم الوحدة</label><Input placeholder="B" value={excelMapping.unitCol} onChange={(e) => setExcelMapping({...excelMapping, unitCol: e.target.value.toUpperCase()})} className="rounded-xl h-12 border-slate-200" /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عمود الاسم</label><Input placeholder="C" value={excelMapping.nameCol} onChange={(e) => setExcelMapping({...excelMapping, nameCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عمود الهاتف</label><Input placeholder="D" value={excelMapping.phoneCol} onChange={(e) => setExcelMapping({...excelMapping, phoneCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عمود التاريخ</label><Input placeholder="E" value={excelMapping.dateCol} onChange={(e) => setExcelMapping({...excelMapping, dateCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" /></div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 text-center space-y-4">
                  <div className="flex justify-center"><Upload className="text-slate-400 w-12 h-12" /></div>
                  <div><p className="font-bold text-slate-700">اختر ملف الإكسل للمزامنة</p><p className="text-xs text-slate-500 mt-1">سيتم تحديث الحالات والبيانات تلقائياً وتوليد الإشعارات</p></div>
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" id="excel-upload" disabled={isProcessing} />
                  <Button asChild disabled={isProcessing} className="bg-slate-900 hover:bg-slate-800 rounded-xl px-8 h-12 font-bold"><label htmlFor="excel-upload" className="cursor-pointer flex items-center gap-2">{isProcessing ? "جاري المعالجة..." : "رفع الملف وبدء التحديث"}</label></Button>
                </div>
              </div>
            ) : (
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
                      <div className="flex items-center gap-4"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100"><MapIcon className="text-slate-400" /></div><div><h3 className="font-bold text-lg">{project.name}</h3><p className="text-sm text-slate-500">{project.elements.length} عنصر | {project.mapWidth}x{project.mapHeight}</p></div></div>
                      <div className="flex gap-2"><Button variant="ghost" size="icon" onClick={() => startEditingInfo(project)} className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></Button><Button variant="ghost" size="icon" onClick={() => handleDeleteProject(project.id)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></Button><Button onClick={() => setEditingMapProject(project)} className="bg-slate-900 hover:bg-slate-800 rounded-xl gap-2"><Settings2 size={16} />تعديل المخطط</Button></div>
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