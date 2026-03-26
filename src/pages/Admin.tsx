"use client";

import React, { useState, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Layout, ArrowRight, Settings2, Map as MapIcon, Trash2, Edit2, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Save } from 'lucide-react';
import MapEditor from '@/components/MapEditor';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { cn } from '@/utils/toast';

interface AdminProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}

const Admin = ({ projects, setProjects }: AdminProps) => {
  const [editingMapProject, setEditingMapProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectInfo, setEditingProjectInfo] = useState<Project | null>(null);
  const [showSalesUpdate, setShowSalesUpdate] = useState(false);
  const [formData, setFormData] = useState({ name: '', width: 1000, height: 800 });
  
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
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'excel_mapping')
          .single();

        if (error && error.code !== 'PGRST116') throw error;
        if (data?.value) {
          setExcelMapping(data.value);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };

    fetchSettings();
  }, []);

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

  // وظيفة تطبيع نصوص متقدمة جداً للمطابقة
  const normalizeForMatch = (text: any) => {
    if (text === null || text === undefined) return "";
    return text
      .toString()
      .toLowerCase()
      .trim()
      .replace(/[\u064B-\u0652\u0640]/g, "") // إزالة التشكيل والمد (الكشيدة) تماماً
      .replace(/[أإآ]/g, "ا") // توحيد الألف
      .replace(/[ة]/g, "ه") // توحيد التاء المربوطة
      .replace(/[ى]/g, "ي") // توحيد الياء
      .replace(/[^a-z0-9\u0621-\u064A]/gi, "") // إزالة أي رموز أو مسافات أو فواصل (مقارنة خام)
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

        console.log("--- بدء معالجة ملف الإكسل ---");
        console.log("إجمالي الصفوف المقروءة:", data.length);

        const cityIdx = colToIdx(excelMapping.cityCol);
        const unitIdx = colToIdx(excelMapping.unitCol);
        const nameIdx = colToIdx(excelMapping.nameCol);
        const phoneIdx = colToIdx(excelMapping.phoneCol);
        const dateIdx = colToIdx(excelMapping.dateCol);

        // إنشاء خريطة للمشاريع
        const projectMap = new Map();
        projects.forEach(p => {
          const normalizedName = normalizeForMatch(p.name);
          projectMap.set(normalizedName, p.id);
          console.log(`مشروع مسجل: "${p.name}" -> مفتاح المطابقة: "${normalizedName}"`);
        });
        
        const { data: currentUnits, error: fetchError } = await supabase
          .from('houses_data')
          .select('*');

        if (fetchError) throw fetchError;

        const excelDataByProject = new Map<string, Map<string, any>>();
        const projectsFoundInExcel = new Set<string>();

        data.forEach((row, index) => {
          if (index === 0) return; // تخطي العنوان
          
          const rawCity = row[cityIdx];
          const normalizedCity = normalizeForMatch(rawCity);
          const projectId = projectMap.get(normalizedCity);
          
          if (projectId) {
            projectsFoundInExcel.add(projectId);
            const rawUnit = row[unitIdx];
            const normalizedUnit = normalizeForMatch(rawUnit);
            
            if (normalizedUnit) {
              if (!excelDataByProject.has(projectId)) {
                excelDataByProject.set(projectId, new Map());
              }
              
              excelDataByProject.get(projectId)?.set(normalizedUnit, {
                name: String(row[nameIdx] || ''),
                phone: String(row[phoneIdx] || ''),
                saleDate: row[dateIdx] ? new Date((row[dateIdx] - (25567 + 1)) * 86400 * 1000).toISOString().split('T')[0] : '',
                status: 'sold'
              });
            }
          } else if (rawCity) {
            // سجل للمساعدة في التشخيص إذا لم يجد المشروع
            // console.log(`لم يتم العثور على مطابقة لمدينة الإكسل: "${rawCity}" (مفتاح: "${normalizedCity}")`);
          }
        });

        console.log("المشاريع التي تم العثور عليها في الإكسل:", projectsFoundInExcel.size);

        const updates = [];
        let matchCount = 0;

        for (const unit of currentUnits) {
          if (projectsFoundInExcel.has(unit.project_id)) {
            const projectExcelData = excelDataByProject.get(unit.project_id);
            const normalizedUnitKey = normalizeForMatch(unit.unit_key);
            const unitExcelData = projectExcelData?.get(normalizedUnitKey);

            if (unitExcelData) {
              matchCount++;
              updates.push({
                unit_key: unit.unit_key,
                project_id: unit.project_id,
                data: { ...unit.data, ...unitExcelData }
              });
            } else if (unit.data?.status === 'sold') {
              // إذا كانت مباعة في النظام وغير موجودة في الإكسل لهذا المشروع، نعيدها متوفرة
              updates.push({
                unit_key: unit.unit_key,
                project_id: unit.project_id,
                data: { 
                  ...unit.data, 
                  status: 'available', 
                  name: '', 
                  phone: '', 
                  saleDate: '' 
                }
              });
            }
          }
        }

        console.log("عدد الوحدات المتطابقة التي سيتم تحديثها:", matchCount);

        if (updates.length > 0) {
          const { error: upsertError } = await supabase
            .from('houses_data')
            .upsert(updates, { onConflict: 'unit_key' });

          if (upsertError) throw upsertError;
          showSuccess(`تمت المزامنة: تحديث ${matchCount} وحدة بنجاح`);
        } else {
          showError("لم يتم العثور على وحدات متطابقة. تأكد من أن أرقام الوحدات في الإكسل تطابق الأسماء على الخريطة (مثلاً D1 أو T1-F1-P1)");
        }

      } catch (error) {
        console.error("Excel processing error:", error);
        showError("حدث خطأ أثناء معالجة الملف");
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
    const newProject = {
      id: newId,
      name: formData.name,
      description: '',
      elements: [],
      map_width: formData.width,
      map_height: formData.height,
    };

    try {
      const { error } = await supabase
        .from('projects')
        .insert(newProject);

      if (error) throw error;

      setProjects([{
        ...newProject,
        mapWidth: formData.width,
        mapHeight: formData.height,
        createdAt: new Date().toISOString(),
        elements: []
      }, ...projects]);
      
      setFormData({ name: '', width: 1000, height: 800 });
      setIsCreating(false);
      showSuccess('تم إنشاء المشروع بنجاح');
    } catch (error) {
      console.error("Error creating project:", error);
      showError("فشل في إنشاء المشروع");
    }
  };

  const handleUpdateProjectInfo = async () => {
    if (!editingProjectInfo || !formData.name) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          name: formData.name, 
          map_width: formData.width, 
          map_height: formData.height 
        })
        .eq('id', editingProjectInfo.id);

      if (error) throw error;

      setProjects(projects.map(p => p.id === editingProjectInfo.id ? { 
        ...p, 
        name: formData.name, 
        mapWidth: formData.width, 
        mapHeight: formData.height 
      } : p));
      
      setEditingProjectInfo(null);
      setFormData({ name: '', width: 1000, height: 800 });
      showSuccess('تم تحديث بيانات المشروع بنجاح');
    } catch (error) {
      console.error("Error updating project:", error);
      showError("فشل في تحديث المشروع");
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProjects(projects.filter(p => p.id !== id));
      showSuccess('تم حذف المشروع');
    } catch (error) {
      console.error("Error deleting project:", error);
      showError("فشل في حذف المشروع");
    }
  };

  const handleSaveMap = async (elements: MapElement[], newWidth: number, newHeight: number) => {
    if (editingMapProject) {
      try {
        const { error } = await supabase
          .from('projects')
          .update({ 
            elements,
            map_width: newWidth,
            map_height: newHeight
          })
          .eq('id', editingMapProject.id);

        if (error) throw error;

        setProjects(projects.map(p => p.id === editingMapProject.id ? { 
          ...p, 
          elements,
          mapWidth: newWidth,
          mapHeight: newHeight
        } : p));
        setEditingMapProject(null);
        showSuccess('تم حفظ المخطط بنجاح');
      } catch (error) {
        console.error("Error saving map:", error);
        showError("فشل في حفظ المخطط");
      }
    }
  };

  const startEditingInfo = (project: Project) => {
    setEditingProjectInfo(project);
    setFormData({ name: project.name, width: project.mapWidth, height: project.mapHeight });
    setIsCreating(false);
    setShowSalesUpdate(false);
  };

  if (editingMapProject) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setEditingMapProject(null)} className="rounded-xl"><ArrowRight className="ml-2" />العودة</Button>
            <h1 className="text-2xl font-black">تعديل مخطط: {editingMapProject.name}</h1>
          </div>
          <MapEditor 
            initialElements={editingMapProject.elements} 
            onSave={handleSaveMap} 
            mapWidth={editingMapProject.mapWidth}
            mapHeight={editingMapProject.mapHeight}
          />
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
            <Button 
              variant={showSalesUpdate ? "default" : "outline"} 
              onClick={() => { setShowSalesUpdate(!showSalesUpdate); setIsCreating(false); setEditingProjectInfo(null); }}
              className={cn("rounded-xl gap-2", showSalesUpdate && "bg-emerald-600 hover:bg-emerald-700")}
            >
              <FileSpreadsheet size={18} /> تحديث المبيعات
            </Button>
            <Link to="/"><Button variant="outline" className="rounded-xl gap-2"><Layout size={18} />عرض الموقع</Button></Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {showSalesUpdate ? (
              <div className="bg-white p-8 rounded-[2.5rem] border-2 border-emerald-100 shadow-xl animate-in fade-in slide-in-from-top-4 space-y-8">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><FileSpreadsheet className="text-emerald-600" /></div>
                    <h2 className="text-xl font-black text-slate-800">تحديث بيانات الوحدات عبر الإكسل</h2>
                  </div>
                  <Button 
                    onClick={handleSaveSettings} 
                    disabled={isSavingSettings}
                    className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2"
                  >
                    <Save size={18} /> {isSavingSettings ? "جاري الحفظ..." : "حفظ إعدادات الأعمدة"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> عمود المدينة (A, B, ...)</label>
                    <Input placeholder="A" value={excelMapping.cityCol} onChange={(e) => setExcelMapping({...excelMapping, cityCol: e.target.value.toUpperCase()})} className="rounded-xl h-12 border-slate-200" />
                    <p className="text-[10px] text-slate-400">سيتم مطابقة الاسم في هذا العمود مع أسماء المشاريع الحالية تلقائياً</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">عمود رقم الوحدة</label>
                    <Input placeholder="B" value={excelMapping.unitCol} onChange={(e) => setExcelMapping({...excelMapping, unitCol: e.target.value.toUpperCase()})} className="rounded-xl h-12 border-slate-200" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">عمود الاسم</label>
                    <Input placeholder="C" value={excelMapping.nameCol} onChange={(e) => setExcelMapping({...excelMapping, nameCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">عمود الهاتف</label>
                    <Input placeholder="D" value={excelMapping.phoneCol} onChange={(e) => setExcelMapping({...excelMapping, phoneCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">عمود التاريخ</label>
                    <Input placeholder="E" value={excelMapping.dateCol} onChange={(e) => setExcelMapping({...excelMapping, dateCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" />
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 text-center space-y-4">
                  <div className="flex justify-center"><Upload className="text-slate-400 w-12 h-12" /></div>
                  <div>
                    <p className="font-bold text-slate-700">اختر ملف الإكسل للمزامنة</p>
                    <p className="text-xs text-slate-500 mt-1">سيتم تحديث الحالات والبيانات تلقائياً بناءً على الأعمدة المحددة</p>
                  </div>
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" id="excel-upload" disabled={isProcessing} />
                  <Button asChild disabled={isProcessing} className="bg-slate-900 hover:bg-slate-800 rounded-xl px-8 h-12 font-bold">
                    <label htmlFor="excel-upload" className="cursor-pointer flex items-center gap-2">
                      {isProcessing ? "جاري المعالجة..." : "رفع الملف وبدء التحديث"}
                    </label>
                  </Button>
                </div>

                <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-100">
                  <AlertCircle className="text-amber-600 shrink-0" size={20} />
                  <div className="text-xs text-amber-800 leading-relaxed font-medium space-y-1">
                    <p>• يتم مطابقة <strong>اسم المشروع</strong> تلقائياً من العمود المحدد.</p>
                    <p>• أي وحدة موجودة في الملف يتم تحويلها إلى حالة <strong>مباع</strong> وتحديث بياناتها.</p>
                    <p>• إذا كانت الوحدة <strong>مباعة</strong> في النظام وغير موجودة في الملف (لنفس المشروع)، يتم إعادتها لحالة <strong>متوفر</strong>.</p>
                    <p>• الوحدات <strong>المحجوزة</strong> لا تتأثر إذا لم تكن موجودة في الملف.</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold">المشاريع الحالية</h2>
                  <Button onClick={() => { setIsCreating(true); setEditingProjectInfo(null); setFormData({ name: '', width: 1000, height: 800 }); }} className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2"><Plus size={18} />مشروع جديد</Button>
                </div>

                {(isCreating || editingProjectInfo) && (
                  <div className="bg-white p-8 rounded-[2.5rem] border-2 border-blue-100 shadow-xl animate-in fade-in slide-in-from-top-4 space-y-6">
                    <h3 className="font-black text-xl">{editingProjectInfo ? 'تعديل بيانات المشروع' : 'إنشاء مشروع جديد'}</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-500">اسم المشروع</label>
                        <Input placeholder="ادخل اسم المشروع..." value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="rounded-xl h-12" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-500">عرض المخطط (px)</label>
                          <Input type="number" value={formData.width} onChange={(e) => setFormData({...formData, width: parseInt(e.target.value)})} className="rounded-xl h-12" />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-bold text-slate-500">طول المخطط (px)</label>
                          <Input type="number" value={formData.height} onChange={(e) => setFormData({...formData, height: parseInt(e.target.value)})} className="rounded-xl h-12" />
                        </div>
                      </div>
                      <div className="flex gap-3 pt-4">
                        <Button onClick={editingProjectInfo ? handleUpdateProjectInfo : handleCreateProject} className="bg-blue-600 rounded-xl h-12 px-8 font-bold">
                          {editingProjectInfo ? 'تحديث البيانات' : 'إنشاء المشروع'}
                        </Button>
                        <Button variant="ghost" onClick={() => { setIsCreating(false); setEditingProjectInfo(null); }} className="rounded-xl h-12">إلغاء</Button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  {projects.map(project => (
                    <div key={project.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100"><MapIcon className="text-slate-400" /></div>
                        <div><h3 className="font-bold text-lg">{project.name}</h3><p className="text-sm text-slate-500">{project.elements.length} عنصر | {project.mapWidth}x{project.mapHeight}</p></div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => startEditingInfo(project)} className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteProject(project.id)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></Button>
                        <Button onClick={() => setEditingMapProject(project)} className="bg-slate-900 hover:bg-slate-800 rounded-xl gap-2"><Settings2 size={16} />تعديل المخطط</Button>
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