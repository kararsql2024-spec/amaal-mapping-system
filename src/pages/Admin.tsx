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
  Palette, MessageSquare, MapPin, Info
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

  const [projectConfigs, setProjectConfigs] = useState<Record<string, { backgroundColor?: string, showGrid?: boolean }>>({});

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

          const configs = settingsData.find(s => s.key === 'project_configs');
          if (configs) setProjectConfigs(configs.value || {});
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

  const normalizeArabic = (text: string) => {
    if (!text) return "";
    return text
      .toString()
      .trim()
      .replace(/[أإآ]/g, "ا")
      .replace(/[ى]/g, "ي")
      .replace(/[ة]/g, "ه")
      .replace(/\s+/g, " ");
  };

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

        logs.push(`تم قراءة ${data.length} صف من الملف.`);
        setProcessLogs([...logs]);

        // جلب قائمة المشاريع بدون العناصر (لتجنب حجم البيانات الكبير)
        const { data: projectsList, error: pError } = await supabase.from('projects').select('id, name, elements');
        if (pError) throw pError;

        logs.push("جاري مطابقة الوحدات مع المخططات الهندسة...");
        setProcessLogs([...logs]);

        const updates: any[] = [];
        const notifications: any[] = [];

        const parseExcelDate = (val: any) => {
          if (!val) return '';
          if (typeof val === 'number') {
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
          }
          return val.toString().trim();
        };

        // معالجة البيانات صفاً بصف
        for (let i = 0; i < data.length; i++) {
          const row: any = data[i];
          if (i === 0) continue; // Skip header

          const cityName = row[excelMapping.cityCol]?.toString().trim();
          const unitLabel = row[excelMapping.unitCol]?.toString().trim();
          const customerName = row[excelMapping.nameCol]?.toString().trim();
          
          if (!cityName || !unitLabel) continue;

          const normCity = normalizeArabic(cityName);
          const project = projectsList?.find(p => normalizeArabic(p.name) === normCity);
          
          if (!project) {
            logs.push(`❌ السطر ${i + 1}: لم يتم العثور على مشروع باسم "${cityName}" في النظام.`);
            continue;
          }

          let realUnitKey = null;
          const elements = project.elements || [];
          const cleanExcelLabel = unitLabel.replace(/\s+/g, '').toUpperCase();

          // البحث في المنازل
          const house = elements.find(el => el.type === 'house' && el.label.replace(/\s+/g, '').toUpperCase() === cleanExcelLabel);

          if (house) {
            realUnitKey = house.id;
          } else {
            // البحث في الشقق
            for (const tower of elements.filter(el => el.type === 'tower')) {
              let pCounter = 0;
              for (let f = 1; f <= (tower.floors || 1); f++) {
                for (let a = 1; a <= (tower.apartmentsPerFloor || 1); a++) {
                  const key = `${tower.id}_F${f}_A${a}`;
                  pCounter++; // ملاحظة: هذا العداد يحتاج مطابقة منطق التجميد إذا أردت دقة 100%
                  const floorCode = f === 1 ? "FG" : `F${f - 1}`;
                  const fullLabel = `${tower.label}-${floorCode}-P${pCounter}`;
                  if (fullLabel.replace(/\s+/g, '').toUpperCase() === cleanExcelLabel) {
                    realUnitKey = key;
                    break;
                  }
                }
                if (realUnitKey) break;
              }
              if (realUnitKey) break;
            }
          }

          if (!realUnitKey) {
            logs.push(`⚠️ السطر ${i + 1}: لم يتم العثور على شكل هندسي للوحدة "${unitLabel}" في مخطط "${cityName}".`);
            realUnitKey = unitLabel; // استخدام الرقم كنص كحل أخير
          }

          let status = 'available';
          if (customerName && customerName.length > 1) {
            const isInvestment = investmentNames.some(name => 
              normalizeArabic(customerName).includes(normalizeArabic(name))
            );
            status = isInvestment ? 'investment' : 'sold';
          }

          const unitData = {
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
        }

        logs.push(`جاري رفع ${updates.length} تحديث إلى قاعدة البيانات...`);
        setProcessLogs([...logs]);

        // رفع البيانات بدفعات
        for (let j = 0; j < updates.length; j += 100) {
          const chunk = updates.slice(j, j + 100);
          const { error } = await supabase.from('houses_data').upsert(chunk, { onConflict: 'unit_key' });
          if (error) throw error;
        }

        const now = new Date().toISOString();
        await supabase.from('settings').upsert({ key: 'last_excel_update', value: now });
        setLastUpdate(now);
        logs.push("🎉 تم الانتهاء بنجاح!");
        setProcessLogs([...logs]);
        showSuccess("تم تحديث البيانات بنجاح");
      } catch (error: any) {
        logs.push(`❌ خطأ: ${error.message}`);
        setProcessLogs([...logs]);
        showError("حدث خطأ أثناء معالجة الملف");
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

  const handleSaveMap = async (elements: MapElement[], newWidth: number, newHeight: number, backgroundColor?: string, showGrid?: boolean) => {
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
      const { error } = await supabase.from('projects').update({ elements, map_width: Math.round(newWidth), map_height: Math.round(newHeight) }).eq('id', editingMapProject.id);
      if (error) throw error;

      const updatedConfigs = { ...projectConfigs, [editingMapProject.id]: { backgroundColor, showGrid } };
      await supabase.from('settings').upsert({ key: 'project_configs', value: updatedConfigs });
      setProjectConfigs(updatedConfigs);

      setProjects(projects.map(p => p.id === editingMapProject.id ? { ...p, elements, mapWidth: Math.round(newWidth), mapHeight: Math.round(newHeight) } : p));
      setEditingMapProject(null);
      showSuccess('تم حفظ المخطط بنجاح');
    } catch (error) { showError("فشل في حفظ المخطط"); } finally { setIsSavingMap(false); }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (editingMapProject || isEditingMainMap) {
    return (
      <MapEditor 
        initialElements={isEditingMainMap ? (mainMapData?.elements || []) : (editingMapProject?.elements || [])} 
        mapWidth={isEditingMainMap ? (mainMapData?.width || 1200) : (editingMapProject?.mapWidth || 1000)}
        mapHeight={isEditingMainMap ? (mainMapData?.height || 800) : (editingMapProject?.mapHeight || 800)}
        onSave={handleSaveMap} 
        onCancel={() => { setEditingMapProject(null); setIsEditingMainMap(false); }} 
        initialBackgroundColor={isEditingMainMap ? mainMapData?.backgroundColor : projectConfigs[editingMapProject?.id || '']?.backgroundColor}
        initialShowGrid={isEditingMainMap ? mainMapData?.showGrid : projectConfigs[editingMapProject?.id || '']?.showGrid}
      />
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100"><Settings2 className="text-white" /></div>
            <div><h1 className="text-2xl font-black text-slate-800">لوحة الإدارة</h1><p className="text-slate-500 font-medium">إدارة المشاريع والمخططات</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditingMainMap(true)} className="rounded-xl gap-2 border-blue-200 text-blue-600 hover:bg-blue-50"><MapIcon size={18} /> المخطط العام</Button>
            <Button variant={showSalesUpdate ? "default" : "outline"} onClick={() => setShowSalesUpdate(!showSalesUpdate)} className={cn("rounded-xl gap-2", showSalesUpdate && "bg-emerald-600")}><FileSpreadsheet size={18} /> تحديث المبيعات</Button>
            <Link to="/"><Button variant="outline" className="rounded-xl gap-2"><Layout size={18} />عرض الموقع</Button></Link>
            <Button variant="ghost" onClick={handleLogout} className="rounded-xl text-rose-500 hover:bg-rose-50 gap-2"><LogOut size={18} /> خروج</Button>
          </div>
        </header>

        {showSalesUpdate && (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 space-y-8 animate-in fade-in slide-in-from-top-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3"><div className="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-100"><FileSpreadsheet className="text-white" /></div><h2 className="text-2xl font-black text-slate-800">تحديث المبيعات من Excel</h2></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="p-10 border-4 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-4 group hover:border-emerald-200 relative overflow-hidden">
                  {isProcessing && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center flex-col gap-4"><RefreshCcw className="w-12 h-12 text-emerald-600 animate-spin" /><p className="font-black text-emerald-800">جاري المعالجة...</p></div>}
                  <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-xl"><Upload className="text-emerald-600 w-10 h-10" /></div>
                  <div><h3 className="text-xl font-black text-slate-800">اسحب ملف Excel هنا</h3></div>
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={isProcessing} />
                </div>
                <div className="bg-slate-900 rounded-3xl p-6 font-mono text-xs text-emerald-400 h-64 overflow-y-auto">
                  <div className="flex items-center gap-2 border-b border-slate-800 pb-2 mb-4 text-slate-500"><Terminal size={14} /> سجل العمليات</div>
                  {processLogs.map((log, i) => (<div key={i} className="flex gap-2"><span>[{new Date().toLocaleTimeString()}]</span><span>{log}</span></div>))}
                </div>
              </div>
              <div className="space-y-6">
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="font-black text-lg text-slate-800">إعدادات الأعمدة</h3>
                  <div className="space-y-3">
                    <MappingInput label="المدينة" value={excelMapping.cityCol} onChange={(v) => setExcelMapping({...excelMapping, cityCol: v})} />
                    <MappingInput label="رقم الوحدة" value={excelMapping.unitCol} onChange={(v) => setExcelMapping({...excelMapping, unitCol: v})} />
                    <MappingInput label="الاسم" value={excelMapping.nameCol} onChange={(v) => setExcelMapping({...excelMapping, nameCol: v})} />
                    <MappingInput label="الهاتف" value={excelMapping.phoneCol} onChange={(v) => setExcelMapping({...excelMapping, phoneCol: v})} />
                  </div>
                </div>
                <div className="p-6 bg-white rounded-3xl border border-slate-100 shadow-sm space-y-4">
                  <h3 className="font-black text-lg text-slate-800">قائمة المستثمرين</h3>
                  <div className="flex gap-2">
                    <Input value={newInvestmentName} onChange={(e) => setNewInvestmentName(e.target.value)} placeholder="اسم المستثمر..." className="rounded-xl h-10" />
                    <Button onClick={handleAddInvestmentName} className="bg-emerald-600 rounded-xl h-10">إضافة</Button>
                  </div>
                  <ScrollArea className="h-32 border rounded-xl p-2 bg-slate-50">
                    {investmentNames.map((name, idx) => (
                      <div key={idx} className="flex items-center justify-between bg-white p-2 mb-1 rounded-lg border text-xs font-bold">
                        <span>{name}</span>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteInvestmentName(idx)} className="h-6 w-6 text-rose-500"><X size={12} /></Button>
                      </div>
                    ))}
                  </ScrollArea>
                </div>
                <Button onClick={() => { localStorage.setItem('excel_mapping', JSON.stringify(excelMapping)); showSuccess("تم الحفظ"); }} className="w-full bg-slate-900 rounded-2xl h-14 font-black">حفظ الإعدادات</Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center justify-between"><h2 className="text-xl font-bold">المشاريع الحالية</h2><Button onClick={() => { setIsCreating(true); setEditingProjectInfo(null); }} className="bg-blue-600 rounded-xl gap-2"><Plus size={18} />مشروع جديد</Button></div>
          {projects.map(project => (
            <div key={project.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group">
              <div className="flex items-center gap-4"><div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center"><MapIcon className="text-slate-400" /></div><div><h3 className="font-bold text-lg">{project.name}</h3><p className="text-sm text-slate-500">{project.mapWidth}x{project.mapHeight}</p></div></div>
              <div className="flex gap-2">
                <Button variant="ghost" size="icon" onClick={() => { setEditingProjectInfo(project); setFormData({name: project.name, width: project.mapWidth, height: project.mapHeight}); }} className="text-blue-500"><Edit2 size={18} /></Button>
                <Button variant="ghost" size="icon" onClick={() => handleDeleteProject(project.id)} className="text-rose-500"><Trash2 size={18} /></Button>
                <Button onClick={() => { setEditingMapProject(project); }} className="bg-slate-900 rounded-xl gap-2"><Settings2 size={16} />تعديل المخطط</Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MappingInput = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-4">
    <Label className="text-xs font-bold text-slate-600">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="w-16 h-10 text-center font-black rounded-lg border-slate-200" maxLength={2} />
  </div>
);

export default Admin;