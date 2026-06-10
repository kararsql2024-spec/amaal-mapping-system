"use client";

import React, { useState, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Layout, ArrowRight, Settings2, Map as MapIcon, Trash2, Edit2, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Save, LogOut, Store, Lock, Clock, Eraser, Terminal, RefreshCcw, Database, Search, User, Phone, HelpCircle, Coins, Download, Copy, FileCode, Banknote, Tags, X, ShieldCheck } from 'lucide-react';
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
  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectInfo, setEditingProjectInfo] = useState<Project | null>(null);
  const [showSalesUpdate, setShowSalesUpdate] = useState(false);
  const [showMarketingCenters, setShowMarketingCenters] = useState(false);
  const [showDatabaseInspector, setShowDatabaseInspector] = useState(false);
  const [formData, setFormData] = useState({ name: '', width: 1000, height: 800 });
  const [isSavingMap, setIsSavingMap] = useState(false);
  
  const [marketingCenters, setMarketingCenters] = useState<any[]>([]);
  const [newCenter, setNewCenter] = useState({ name: '', password: '', type: '' });
  const [editingCenterId, setEditingCenterId] = useState<string | null>(null);
  const [departmentTypes, setDepartmentTypes] = useState<any[]>([]);
  const [newDeptType, setNewDeptType] = useState('');
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
          if (deptTypes) {
            // تحويل البيانات القديمة (نصوص) إلى الهيكل الجديد (كائنات) إذا لزم الأمر
            const formatted = (deptTypes.value || []).map((t: any) => 
              typeof t === 'string' ? { 
                name: t, 
                permissions: { showPrice: true, showName: true, showPhone: true, showTabo: true, showHandover: true } 
              } : t
            );
            setDepartmentTypes(formatted);
          }
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

  const handleClearNotifications = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) throw error;
      showSuccess("تم تصفير كافة الإشعارات بنجاح");
    } catch (error) {
      showError("فشل في تصفير الإشعارات");
    }
  };

  const handleResetAllData = async () => {
    setIsResetting(true);
    try {
      const { error } = await supabase
        .from('houses_data')
        .delete()
        .neq('unit_key', 'FORCE_DELETE_ALL');

      if (error) throw error;
      setHousesData({});
      addLog("تم تصفير كافة بيانات الوحدات بنجاح.");
      showSuccess("تم تصفير كافة البيانات بنجاح");
    } catch (error) {
      console.error("Error resetting data:", error);
      showError("فشل في تصفير البيانات");
    } finally {
      setIsResetting(false);
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
        type: newCenter.type
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
      setNewCenter({ name: '', password: '', type: '' });
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
    const newEntry = {
      name: newDeptType,
      permissions: {
        showPrice: true,
        showName: true,
        showPhone: true,
        showTabo: true,
        showHandover: true
      }
    };
    const updated = [...departmentTypes, newEntry];
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
    const updated = departmentTypes.filter((_, i) => i !== idx);
    try {
      await supabase.from('settings').upsert({ key: 'department_types', value: updated });
      setDepartmentTypes(updated);
      showSuccess("تم حذف النوع");
    } catch (error) {
      showError("فشل في التحديث");
    }
  };

  const updatePermission = async (idx: number, field: string, value: boolean) => {
    const updated = [...departmentTypes];
    updated[idx].permissions[field] = value;
    try {
      await supabase.from('settings').upsert({ key: 'department_types', value: updated });
      setDepartmentTypes(updated);
      showSuccess("تم تحديث الصلاحيات");
    } catch (error) {
      showError("فشل في تحديث الصلاحيات");
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

  const normalizeForMatch = (text: any) => {
    if (text === null || text === undefined) return "";
    return text
      .toString()
      .trim()
      .replace(/[\u064B-\u0652\u0640]/g, "") 
      .replace(/[أإآ]/g, "ا") 
      .replace(/[ة]/g, "ه") 
      .replace(/[ى]/g, "ي") 
      .replace(/\s+/g, ""); 
  };

  const colToIdx = (col: string) => {
    if (!col) return -1;
    let res = 0;
    const cleanCol = col.trim().toUpperCase();
    for (let i = 0; i < cleanCol.length; i++) {
      res = res * 26 + (cleanCol.charCodeAt(i) - 64);
    }
    return res - 1;
  };

  const addLog = (msg: string) => setProcessLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev]);

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setProcessLogs([]);
    addLog("بدء معالجة ملف الإكسل...");
    
    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        addLog(`تم قراءة ${data.length} صف من الإكسل.`);

        const cityIdx = colToIdx(excelMapping.cityCol);
        const unitIdx = colToIdx(excelMapping.unitCol);
        const nameIdx = colToIdx(excelMapping.nameCol);
        const phoneIdx = colToIdx(excelMapping.phoneCol);
        const dateIdx = colToIdx(excelMapping.dateCol);
        const priceIdx = colToIdx(excelMapping.priceCol);
        const currencyIdx = colToIdx(excelMapping.currencyCol);
        const taboNumIdx = colToIdx(excelMapping.taboNumCol);
        const taboStatusIdx = colToIdx(excelMapping.taboStatusCol);
        const handoverDateIdx = colToIdx(excelMapping.handoverDateCol);

        const normInvestmentNames = investmentNames.map(n => normalizeForMatch(n));

        // 1. استخراج أسماء المشاريع الفريدة من الإكسل
        const uniqueProjectNamesInExcel = new Set<string>();
        data.forEach((row, index) => {
          if (index === 0) return;
          if (row[cityIdx]) uniqueProjectNamesInExcel.add(normalizeForMatch(row[cityIdx]));
        });

        addLog(`تم العثور على ${uniqueProjectNamesInExcel.size} مشروع مختلف في ملف الإكسل.`);

        // 2. جلب قائمة المشاريع (الأسماء فقط) للمطابقة
        const { data: allProjectsList, error: pListError } = await supabase
          .from('projects')
          .select('id, name');
        
        if (pListError) throw pListError;

        const matchedProjectIds = allProjectsList
          ?.filter(p => uniqueProjectNamesInExcel.has(normalizeForMatch(p.name)))
          .map(p => p.id) || [];

        if (matchedProjectIds.length === 0) {
          addLog("خطأ: لم يتم العثور على أي مشاريع مطابقة في قاعدة البيانات.");
          setIsProcessing(false);
          return;
        }

        // 3. جلب تفاصيل المشاريع المطابقة
        let projectsWithElements: any[] = [];
        addLog(`جاري جلب تفاصيل المخططات لـ ${matchedProjectIds.length} مشروع...`);
        
        for (const pId of matchedProjectIds) {
          const { data: pData, error: pError } = await supabase
            .from('projects')
            .select('id, name, elements')
            .eq('id', pId)
            .single();
          
          if (pError) {
            addLog(`تنبيه: فشل جلب بيانات المشروع ${pId}. سيتم تخطيه.`);
            continue;
          }
          if (pData) projectsWithElements.push(pData);
        }

        // 4. جلب بيانات الوحدات للمشاريع المطابقة
        let currentHousesData: any[] = [];
        for (const pId of matchedProjectIds) {
          let hFrom = 0;
          let hHasMore = true;
          while (hHasMore) {
            const { data: hChunk, error: hError } = await supabase
              .from('houses_data')
              .select('*')
              .eq('project_id', pId)
              .range(hFrom, hFrom + 999);
            
            if (hError) throw hError;
            if (!hChunk || hChunk.length === 0) {
              hHasMore = false;
            } else {
              currentHousesData = [...currentHousesData, ...hChunk];
              hFrom += 1000;
              if (hChunk.length < 1000) hHasMore = false;
            }
          }
        }

        const housesDataMap: Record<string, any> = {};
        currentHousesData?.forEach(u => {
          housesDataMap[u.unit_key] = u.data;
        });

        const projectMap = new Map<string, string>();
        const projectLabelsMap = new Map<string, Map<string, string>>();
        
        projectsWithElements.forEach(project => {
          const normProjectName = normalizeForMatch(project.name);
          projectMap.set(normProjectName, project.id);
          const elements = project.elements || [];
          
          const labels = new Map<string, string>();
          elements.forEach(el => {
            if (el.type === 'house') {
              labels.set(el.id, el.label);
            } else if (el.type === 'tower') {
              let pCounter = 0;
              for (let f = 1; f <= (el.floors || 1); f++) {
                const floorCode = f === 1 ? "FG" : `F${f - 1}`;
                for (let a = 1; a <= (el.apartmentsPerFloor || 1); a++) {
                  const techKey = `${el.id}_F${f}_A${a}`;
                  const unitData = housesDataMap[techKey];
                  const isFrozenSequence = unitData?.status === 'frozen_uncounted' || unitData?.status === 'frozen_hidden';
                  if (!isFrozenSequence) pCounter++;
                  const aptCode = isFrozenSequence ? "مجمدة" : `P${pCounter}`;
                  labels.set(techKey, `${el.label}-${floorCode}-${aptCode}`);
                }
              }
            }
          });
          projectLabelsMap.set(project.id, labels);
        });

        const updatesMap = new Map<string, any>();
        const notifications: any[] = [];
        const matchedTechKeys = new Set<string>();
        const projectsInExcel = new Set<string>();

        let stats = { totalRows: data.length - 1, matched: 0, reset: 0 };

        data.forEach((row, index) => {
          if (index === 0) return;
          const rawCity = row[cityIdx];
          const rawUnit = row[unitIdx];
          if (!rawCity || !rawUnit) return;

          const normCity = normalizeForMatch(rawCity);
          const projectId = projectMap.get(normCity);
          if (!projectId) return;

          projectsInExcel.add(projectId);
          const normExcelUnit = normalizeForMatch(rawUnit);
          const labels = projectLabelsMap.get(projectId);
          
          let foundTechKey: string | null = null;
          let foundLabel: string | null = null;

          if (labels) {
            for (const [techKey, label] of labels.entries()) {
              if (normExcelUnit === normalizeForMatch(label)) {
                foundTechKey = techKey;
                foundLabel = label;
                break;
              }
            }
          }

          if (foundTechKey) {
            matchedTechKeys.add(foundTechKey);
            stats.matched++;
            const oldData = housesDataMap[foundTechKey] || { status: 'available' };
            const newName = String(row[nameIdx] || '');
            const isInvestment = normInvestmentNames.includes(normalizeForMatch(newName));
            
            let saleDate = '';
            if (row[dateIdx]) {
              if (typeof row[dateIdx] === 'number') {
                saleDate = new Date((row[dateIdx] - (25567 + 1)) * 86400 * 1000).toISOString().split('T')[0];
              } else {
                saleDate = String(row[dateIdx]);
              }
            }

            const price = row[priceIdx] ? String(row[priceIdx]) : '';
            const currency = row[currencyIdx] ? String(row[currencyIdx]) : '';
            const taboNum = taboNumIdx !== -1 && row[taboNumIdx] ? String(row[taboNumIdx]) : '';
            const taboStatus = taboStatusIdx !== -1 && row[taboStatusIdx] ? String(row[taboStatusIdx]) : '';
            
            let handoverDate = '';
            if (handoverDateIdx !== -1 && row[handoverDateIdx]) {
              if (typeof row[handoverDateIdx] === 'number') {
                handoverDate = new Date((row[handoverDateIdx] - (25567 + 1)) * 86400 * 1000).toISOString().split('T')[0];
              } else {
                handoverDate = String(row[handoverDateIdx]);
              }
            }

            const newStatus = isInvestment ? 'investment' : 'sold';
            if (oldData.status !== newStatus) {
              notifications.push({ 
                project_id: projectId, 
                message: isInvestment ? `تم تحويل الوحدة ${foundLabel} إلى استثمار باسم ${newName}` : `تم بيع الوحدة ${foundLabel} للسيد ${newName}` 
              });
            }

            updatesMap.set(foundTechKey, {
              unit_key: foundTechKey,
              project_id: projectId,
              data: { 
                ...oldData, 
                name: newName, 
                phone: String(row[phoneIdx] || ''), 
                saleDate, 
                status: newStatus,
                price,
                currency,
                taboNum,
                taboStatus,
                handoverDate
              }
            });
          }
        });

        for (const [techKey, oldData] of Object.entries(housesDataMap)) {
          if (!matchedTechKeys.has(techKey)) {
            const unitInfo = currentHousesData.find(u => u.unit_key === techKey);
            if (unitInfo && projectsInExcel.has(unitInfo.project_id)) {
              if (oldData.status === 'sold' || oldData.status === 'investment') {
                const label = projectLabelsMap.get(unitInfo.project_id)?.get(techKey) || techKey;
                stats.reset++;
                notifications.push({
                  project_id: unitInfo.project_id,
                  message: `الوحدة ${label} لم تعد موجودة في ملف المبيعات، تم إعادتها للحالة (متوفر).`
                });
                updatesMap.set(techKey, {
                  unit_key: techKey,
                  project_id: unitInfo.project_id,
                  data: { status: 'available', name: '', phone: '', saleDate: '', price: '', currency: '', taboNum: '', taboStatus: '', handoverDate: '', details: 'تم التصفير تلقائياً لعدم وجودها في ملف الإكسل' }
                });
              }
            }
          }
        }

        const finalUpdates = Array.from(updatesMap.values());
        if (finalUpdates.length > 0) {
          const chunkSize = 200;
          for (let i = 0; i < finalUpdates.length; i += chunkSize) {
            await supabase.from('houses_data').upsert(finalUpdates.slice(i, i + chunkSize), { onConflict: 'unit_key' });
          }
          if (notifications.length > 0) {
            for (let i = 0; i < notifications.length; i += chunkSize) {
              await supabase.from('notifications').insert(notifications.slice(i, i + chunkSize));
            }
          }
          setHousesData(prev => {
            const next = { ...prev };
            finalUpdates.forEach(u => { next[u.unit_key] = u.data; });
            return next;
          });
          await supabase.from('settings').upsert({ key: 'last_excel_update', value: new Date().toISOString() });
          setLastUpdate(new Date().toISOString());
          addLog(`اكتملت العملية: تم تحديث ${stats.matched} وحدة، وإعادة ${stats.reset} وحدة للحالة متاح.`);
          showSuccess(`تم تحديث ${stats.matched} وحدة وتصفير ${stats.reset} وحدة.`);
        } else {
          showError("لم يتم العثور على بيانات مطابقة");
        }
      } catch (error) {
        console.error(error);
        showError("حدث خطأ أثناء معالجة البيانات");
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

  // Combined Backup & Download Logic
  const handleDownloadBackup = async () => {
    setIsGeneratingBackup(true);
    try {
      const { data: projectsData } = await supabase.from('projects').select('*');
      const { data: housesData } = await supabase.from('houses_data').select('*');
      const { data: centersData } = await supabase.from('marketing_centers').select('*');
      const { data: settingsData } = await supabase.from('settings').select('*');
      const { data: notificationsData } = await supabase.from('notifications').select('*');

      let sql = `-- SQL Backup Generated on ${new Date().toLocaleString('ar-EG')}\n`;
      sql += `-- Database: Real Estate Management System\n\n`;

      // Schema
      sql += `-- 1. Table: projects\nCREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, name TEXT, description TEXT, elements JSONB, map_width INTEGER, map_height INTEGER, created_at TIMESTAMPTZ DEFAULT NOW());\n\n`;
      sql += `-- 2. Table: houses_data\nCREATE TABLE IF NOT EXISTS houses_data (unit_key TEXT PRIMARY KEY, project_id TEXT, data JSONB, created_at TIMESTAMPTZ DEFAULT NOW());\n\n`;
      sql += `-- 3. Table: marketing_centers\nCREATE TABLE IF NOT EXISTS marketing_centers (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT, password TEXT, type TEXT, created_at TIMESTAMPTZ DEFAULT NOW());\n\n`;
      sql += `-- 4. Table: settings\nCREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value JSONB);\n\n`;
      sql += `-- 5. Table: notifications\nCREATE TABLE IF NOT EXISTS notifications (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), project_id TEXT, message TEXT, created_at TIMESTAMPTZ DEFAULT NOW());\n\n`;

      const escape = (val: any) => {
        if (val === null || val === undefined) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return val;
      };

      if (projectsData) {
        sql += `-- Data for projects\n`;
        projectsData.forEach(p => {
          sql += `INSERT INTO projects (id, name, description, elements, map_width, map_height, created_at) VALUES (${escape(p.id)}, ${escape(p.name)}, ${escape(p.description)}, ${escape(p.elements)}, ${escape(p.map_width)}, ${escape(p.map_height)}, ${escape(p.created_at)}) ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, elements=EXCLUDED.elements, map_width=EXCLUDED.map_width, map_height=EXCLUDED.map_height;\n`;
        });
        sql += `\n`;
      }

      if (housesData) {
        sql += `-- Data for houses_data\n`;
        housesData.forEach(h => {
          sql += `INSERT INTO houses_data (unit_key, project_id, data) VALUES (${escape(h.unit_key)}, ${escape(h.project_id)}, ${escape(h.data)}) ON CONFLICT (unit_key) DO UPDATE SET data=EXCLUDED.data;\n`;
        });
        sql += `\n`;
      }

      if (centersData) {
        sql += `-- Data for marketing_centers\n`;
        centersData.forEach(c => {
          sql += `INSERT INTO marketing_centers (id, name, password, type, created_at) VALUES (${escape(c.id)}, ${escape(c.name)}, ${escape(c.password)}, ${escape(c.type)}, ${escape(c.created_at)}) ON CONFLICT (id) DO NOTHING;\n`;
        });
        sql += `\n`;
      }

      if (settingsData) {
        sql += `-- Data for settings\n`;
        settingsData.forEach(s => {
          sql += `INSERT INTO settings (key, value) VALUES (${escape(s.key)}, ${escape(s.value)}) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;\n`;
        });
        sql += `\n`;
      }

      if (notificationsData) {
        sql += `-- Data for notifications\n`;
        notificationsData.forEach(n => {
          sql += `INSERT INTO notifications (id, project_id, message, created_at) VALUES (${escape(n.id)}, ${escape(n.project_id)}, ${escape(n.message)}, ${escape(n.created_at)}) ON CONFLICT (id) DO NOTHING;\n`;
        });
      }

      // Trigger Download
      const blob = new Blob([sql], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `full_backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSuccess("تم توليد وتحميل النسخة الاحتياطية بنجاح");
    } catch (error) {
      console.error(error);
      showError("فشل في توليد النسخة الاحتياطية");
    } finally {
      setIsGeneratingBackup(false);
    }
  };

  if (editingMapProject) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setEditingMapProject(null)} className="rounded-xl" disabled={isSavingMap}><ArrowRight className="ml-2" />العودة</Button>
            <h1 className="text-2xl font-black">تعديل مخطط: {editingMapProject.name}</h1>
          </div>
          <MapEditor initialElements={editingMapProject.elements} onSave={handleSaveMap} mapWidth={editingMapProject.mapWidth} mapHeight={editingMapProject.mapHeight} isSaving={isSavingMap} />
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
            <Button variant={showDatabaseInspector ? "default" : "outline"} onClick={() => { setShowDatabaseInspector(!showDatabaseInspector); setShowMarketingCenters(false); setShowSalesUpdate(false); setIsCreating(false); setEditingProjectInfo(null); }} className={cn("rounded-xl gap-2", showDatabaseInspector && "bg-blue-600 hover:bg-blue-700")}><Database size={18} /> النسخ الاحتياطي</Button>
            <Button variant={showMarketingCenters ? "default" : "outline"} onClick={() => { setShowMarketingCenters(!showMarketingCenters); setShowDatabaseInspector(false); setShowSalesUpdate(false); setIsCreating(false); setEditingProjectInfo(null); }} className={cn("rounded-xl gap-2", showMarketingCenters && "bg-indigo-600 hover:bg-indigo-700")}><Store size={18} /> الأقسام</Button>
            <Button variant={showSalesUpdate ? "default" : "outline"} onClick={() => { setShowSalesUpdate(!showSalesUpdate); setShowDatabaseInspector(false); setShowMarketingCenters(false); setIsCreating(false); setEditingProjectInfo(null); }} className={cn("rounded-xl gap-2", showSalesUpdate && "bg-emerald-600 hover:bg-emerald-700")}><FileSpreadsheet size={18} /> تحديث المبيعات</Button>
            <Link to="/"><Button variant="outline" className="rounded-xl gap-2"><Layout size={18} />عرض الموقع</Button></Link>
            <Button variant="ghost" onClick={handleLogout} className="rounded-xl text-rose-500 hover:text-rose-600 hover:bg-rose-50 gap-2"><LogOut size={18} /> خروج</Button>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-3 space-y-6">
            {showDatabaseInspector ? (
              <div className="bg-white p-8 rounded-[2.5rem] border-2 border-blue-100 shadow-xl animate-in fade-in slide-in-from-top-4 space-y-8">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center"><Database className="text-blue-600" /></div><h2 className="text-xl font-black text-slate-800">النسخ الاحتياطي وقاعدة البيانات</h2></div>
                  <Button onClick={handleDownloadBackup} disabled={isGeneratingBackup} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-8 font-black gap-2 shadow-lg shadow-blue-100">
                    {isGeneratingBackup ? <RefreshCcw className="animate-spin" size={20} /> : <Download size={20} />}
                    تحميل نسخة احتياطية كاملة (SQL)
                  </Button>
                </div>

                <div className="space-y-6">
                  <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                    <h3 className="font-bold text-blue-800 mb-2 flex items-center gap-2"><AlertCircle size={18} /> تعليمات النقل والاستعادة</h3>
                    <p className="text-sm text-blue-700 leading-relaxed">
                      عند الانتقال إلى استضافة جديدة، قم بتحميل ملف SQL أعلاه. يحتوي الملف على كافة البيانات (المشاريع، المخططات، الوحدات، المراكز التسويقية). 
                      يمكنك تنفيذ محتوى هذا الملف في واجهة SQL الخاصة بقاعدة البيانات الجديدة لاستعادة كافة البيانات بضغطة واحدة.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <h4 className="font-bold text-slate-700 mb-2">لماذا التحميل كملف؟</h4>
                      <ul className="text-xs text-slate-500 space-y-2 list-disc list-inside">
                        <li>تجنب ثقل المتصفح عند التعامل مع آلاف الوحدات.</li>
                        <li>سهولة النقل عبر البريد أو وسائط التخزين.</li>
                        <li>ضمان عدم ضياع أي جزء من الكود أثناء النسخ اليدوي.</li>
                      </ul>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100">
                      <h4 className="font-bold text-slate-700 mb-2">محتويات النسخة</h4>
                      <ul className="text-xs text-slate-500 space-y-2 list-disc list-inside">
                        <li>هيكل الجداول (Schema).</li>
                        <li>بيانات المشاريع والمخططات الهندسية.</li>
                        <li>حالات الوحدات (مباع، متاح، استثمار).</li>
                        <li>بيانات المراكز التسويقية والإعدادات.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            ) : showMarketingCenters ? (
              <div className="bg-white p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-xl animate-in fade-in slide-in-from-top-4 space-y-8">
                <div className="flex items-center gap-3 border-b pb-4"><div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center"><Store className="text-indigo-600" /></div><h2 className="text-xl font-black text-slate-800">إدارة الأقسام</h2></div>
                
                {/* إدارة أنواع الأقسام */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 space-y-4">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><Tags size={18} /> إدارة أنواع الأقسام</h3>
                  <div className="flex gap-2">
                    <Input placeholder="أدخل نوع قسم جديد (مثلاً: مركز تسويقي)..." value={newDeptType} onChange={(e) => setNewDeptType(e.target.value)} className="rounded-xl h-12" />
                    <Button onClick={handleAddDeptType} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl h-12 px-6 font-bold">إضافة نوع</Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {departmentTypes.map((type, idx) => (
                      <div key={idx} className="bg-white border border-indigo-100 p-6 rounded-2xl space-y-4 shadow-sm">
                        <div className="flex items-center justify-between border-b pb-3">
                          <div className="flex items-center gap-2">
                            <ShieldCheck className="text-indigo-600" size={20} />
                            <span className="text-lg font-black text-slate-800">{type.name}</span>
                          </div>
                          <button onClick={() => handleDeleteDeptType(idx)} className="text-rose-500 hover:text-rose-700 transition-colors"><Trash2 size={18} /></button>
                        </div>
                        
                        <div className="grid grid-cols-1 gap-3">
                          <p className="text-xs font-black text-slate-400 mb-1">صلاحيات العرض لهذا القسم:</p>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox id={`price-${idx}`} checked={type.permissions?.showPrice} onCheckedChange={(val) => updatePermission(idx, 'showPrice', !!val)} />
                            <label htmlFor={`price-${idx}`} className="text-sm font-bold text-slate-600 cursor-pointer">عرض السعر</label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox id={`name-${idx}`} checked={type.permissions?.showName} onCheckedChange={(val) => updatePermission(idx, 'showName', !!val)} />
                            <label htmlFor={`name-${idx}`} className="text-sm font-bold text-slate-600 cursor-pointer">اسم الزبون</label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox id={`phone-${idx}`} checked={type.permissions?.showPhone} onCheckedChange={(val) => updatePermission(idx, 'showPhone', !!val)} />
                            <label htmlFor={`phone-${idx}`} className="text-sm font-bold text-slate-600 cursor-pointer">رقم الهاتف</label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox id={`tabo-${idx}`} checked={type.permissions?.showTabo} onCheckedChange={(val) => updatePermission(idx, 'showTabo', !!val)} />
                            <label htmlFor={`tabo-${idx}`} className="text-sm font-bold text-slate-600 cursor-pointer">بيانات الطابو (مروج/مستلم)</label>
                          </div>
                          <div className="flex items-center space-x-2 space-x-reverse">
                            <Checkbox id={`handover-${idx}`} checked={type.permissions?.showHandover} onCheckedChange={(val) => updatePermission(idx, 'showHandover', !!val)} />
                            <label htmlFor={`handover-${idx}`} className="text-sm font-bold text-slate-600 cursor-pointer">بيانات الاستلام</label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* إضافة/تعديل قسم جديد */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100 relative">
                  {editingCenterId && (
                    <div className="md:col-span-3 flex items-center justify-between bg-indigo-50 p-2 rounded-lg border border-indigo-100 mb-2">
                      <span className="text-xs font-bold text-indigo-600 flex items-center gap-2"><Edit2 size={14} /> أنت الآن في وضع تعديل بيانات القسم</span>
                      <Button variant="ghost" size="sm" onClick={() => { setEditingCenterId(null); setNewCenter({ name: '', password: '', type: '' }); }} className="h-7 text-xs text-rose-500 hover:bg-rose-50"><X size={14} /> إلغاء التعديل</Button>
                    </div>
                  )}
                  <div className="space-y-2"><label className="text-sm font-bold text-slate-600">اسم القسم</label><Input placeholder="اسم القسم..." value={newCenter.name} onChange={(e) => setNewCenter({...newCenter, name: e.target.value})} className="rounded-xl h-12" /></div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-600">نوع القسم</label>
                    <Select value={newCenter.type} onValueChange={(val) => setNewCenter({...newCenter, type: val})}>
                      <SelectTrigger className="rounded-xl h-12 bg-white">
                        <SelectValue placeholder="اختر النوع..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {departmentTypes.map((type, idx) => (
                          <SelectItem key={idx} value={type.name} className="font-bold">{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><label className="text-sm font-bold text-slate-600">كلمة المرور</label><Input type="password" placeholder="كلمة مرور القسم..." value={newCenter.password} onChange={(e) => setNewCenter({...newCenter, password: e.target.value})} className="rounded-xl h-12" /></div>
                  <Button onClick={handleAddCenter} className={cn("md:col-span-3 rounded-xl h-12 font-bold gap-2", editingCenterId ? "bg-blue-600 hover:bg-blue-700" : "bg-indigo-600 hover:bg-indigo-700")}>
                    {editingCenterId ? <Save size={18} /> : <Plus size={18} />}
                    {editingCenterId ? "تحديث بيانات القسم" : "إضافة قسم جديد"}
                  </Button>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-slate-700">قائمة الأقسام الحالية</h3>
                  {marketingCenters.map(center => (
                    <div key={center.id} className={cn("flex items-center justify-between p-4 bg-white border rounded-xl shadow-sm transition-all", editingCenterId === center.id ? "border-indigo-500 ring-2 ring-indigo-50" : "border-slate-100")}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center"><Store className="text-slate-400" size={20} /></div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-800">{center.name}</p>
                            <span className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-black border border-indigo-100">{center.type || 'غير محدد'}</span>
                          </div>
                          <p className="text-xs text-slate-400 flex items-center gap-1"><Lock size={10} /> {center.password}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => {
                          setEditingCenterId(center.id);
                          setNewCenter({ name: center.name, password: center.password, type: center.type });
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }} className="text-blue-500 hover:bg-blue-50 rounded-lg"><Edit2 size={18} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCenter(center.id)} className="text-rose-500 hover:bg-rose-50 rounded-lg"><Trash2 size={18} /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : showSalesUpdate ? (
              <div className="bg-white p-8 rounded-[2.5rem] border-2 border-emerald-100 shadow-xl animate-in fade-in slide-in-from-top-4 space-y-8">
                <div className="flex items-center justify-between border-b pb-4">
                  <div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><FileSpreadsheet className="text-emerald-600" /></div><h2 className="text-xl font-black text-slate-800">تحديث بيانات الوحدات عبر الإكسل</h2></div>
                  <div className="flex gap-2">
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="outline" className="rounded-xl gap-2 border-rose-200 text-rose-500 hover:bg-rose-50"><RefreshCcw size={18} /> تصفير كافة البيانات</Button></AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader><AlertDialogTitle className="text-right">هل أنت متأكد تماماً؟</AlertDialogTitle><AlertDialogDescription className="text-right">سيؤدي هذا الإجراء إلى حذف كافة بيانات المبيعات والأسماء والتواريخ من قاعدة البيانات لجميع المشاريع.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter className="flex-row-reverse gap-2"><AlertDialogAction onClick={handleResetAllData} className="bg-rose-600 hover:bg-rose-700 rounded-xl">نعم، قم بالتصفير</AlertDialogAction><AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button variant="outline" onClick={handleClearNotifications} className="rounded-xl gap-2 border-amber-200 text-amber-600 hover:bg-amber-50"><Eraser size={18} /> تصفير الإشعارات</Button>
                    <Button onClick={handleSaveSettings} disabled={isSavingSettings} className="bg-indigo-600 hover:bg-indigo-700 rounded-xl gap-2"><Save size={18} /> {isSavingSettings ? "جاري الحفظ..." : "حفظ الإعدادات"}</Button>
                  </div>
                </div>

                {lastUpdate && <div className="flex items-center gap-2 text-sm font-bold text-indigo-600 bg-indigo-50 p-3 rounded-xl border border-indigo-100"><Clock size={16} /> آخر تحديث للبيانات: {new Date(lastUpdate).toLocaleString('ar-EG')}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2"><label className="text-sm font-bold text-slate-600 flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-500" /> عمود المدينة (A, B, ...)</label><Input placeholder="A" value={excelMapping.cityCol} onChange={(e) => setExcelMapping({...excelMapping, cityCol: e.target.value.toUpperCase()})} className="rounded-xl h-12 border-slate-200" /></div>
                  <div className="space-y-2"><label className="text-sm font-bold text-slate-600">عمود رقم الوحدة</label><Input placeholder="I" value={excelMapping.unitCol} onChange={(e) => setExcelMapping({...excelMapping, unitCol: e.target.value.toUpperCase()})} className="rounded-xl h-12 border-slate-200" /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عمود الاسم</label><Input placeholder="C" value={excelMapping.nameCol} onChange={(e) => setExcelMapping({...excelMapping, nameCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عمود الهاتف</label><Input placeholder="D" value={excelMapping.phoneCol} onChange={(e) => setExcelMapping({...excelMapping, phoneCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عمود التاريخ</label><Input placeholder="E" value={excelMapping.dateCol} onChange={(e) => setExcelMapping({...excelMapping, dateCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عمود رقم الطابو</label><Input placeholder="J" value={excelMapping.taboNumCol} onChange={(e) => setExcelMapping({...excelMapping, taboNumCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عمود حالة الطابو</label><Input placeholder="K" value={excelMapping.taboStatusCol} onChange={(e) => setExcelMapping({...excelMapping, taboStatusCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-slate-500">عمود تاريخ الاستلام</label><Input placeholder="L" value={excelMapping.handoverDateCol} onChange={(e) => setExcelMapping({...excelMapping, handoverDateCol: e.target.value.toUpperCase()})} className="rounded-xl h-10" /></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <div className="space-y-2"><label className="text-xs font-bold text-emerald-700 flex items-center gap-2"><Banknote size={14} /> عمود سعر الوحدة</label><Input placeholder="F" value={excelMapping.priceCol} onChange={(e) => setExcelMapping({...excelMapping, priceCol: e.target.value.toUpperCase()})} className="rounded-xl h-10 border-emerald-200" /></div>
                  <div className="space-y-2"><label className="text-xs font-bold text-emerald-700 flex items-center gap-2"><Coins size={14} /> عمود نوع العملة</label><Input placeholder="G" value={excelMapping.currencyCol} onChange={(e) => setExcelMapping({...excelMapping, currencyCol: e.target.value.toUpperCase()})} className="rounded-xl h-10 border-emerald-200" /></div>
                </div>

                <div className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 text-center space-y-4">
                  <div className="flex justify-center"><Upload className="text-slate-400 w-12 h-12" /></div>
                  <div><p className="font-bold text-slate-700">اختر ملف الإكسل للمزامنة</p><p className="text-xs text-slate-500 mt-1">سيتم تحديث الحالات والبيانات تلقائياً وتوليد الإشعارات</p></div>
                  <input type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" id="excel-upload" disabled={isProcessing} />
                  <Button asChild disabled={isProcessing} className="bg-slate-900 hover:bg-slate-800 rounded-xl px-8 h-12 font-bold"><label htmlFor="excel-upload" className="cursor-pointer flex items-center gap-2">{isProcessing ? "جاري المعالجة..." : "رفع الملف وبدء التحديث"}</label></Button>
                </div>

                <div className="bg-purple-50 p-8 rounded-[2rem] border-2 border-purple-100 space-y-6">
                  <div className="flex items-center gap-3 border-b border-purple-100 pb-4"><div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center"><Coins className="text-purple-600" /></div><h2 className="text-xl font-black text-slate-800">قائمة الاستثمارات</h2></div>
                  <div className="flex gap-2"><Input placeholder="أدخل اسم المستثمر..." value={newInvestmentName} onChange={(e) => setNewInvestmentName(e.target.value)} className="rounded-xl h-12 border-purple-200" onKeyPress={(e) => e.key === 'Enter' && handleAddInvestmentName()} /><Button onClick={handleAddInvestmentName} className="bg-purple-600 hover:bg-purple-700 rounded-xl h-12 px-6 font-bold">إضافة وحفظ</Button></div>
                  <div className="flex flex-wrap gap-2">{investmentNames.map((name, idx) => (<div key={idx} className="bg-white border border-purple-200 px-4 py-2 rounded-xl flex items-center gap-2 shadow-sm"><span className="font-bold text-slate-700">{name}</span><button onClick={() => handleDeleteInvestmentName(idx)} className="text-rose-500 hover:text-rose-700"><Trash2 size={14} /></button></div>))}</div>
                </div>

                {processLogs.length > 0 && (
                  <div className="space-y-2 animate-in fade-in slide-in-from-bottom-4">
                    <div className="flex items-center gap-2 text-slate-800 font-black"><Terminal size={18} /> سجل العمليات</div>
                    <div className="bg-slate-900 rounded-2xl p-4 font-mono text-xs text-emerald-400 border border-slate-800 shadow-inner">
                      <ScrollArea className="h-48 w-full"><div className="space-y-1">{processLogs.map((log, i) => (<div key={i} className={cn(log.includes('خطأ') ? 'text-rose-400' : log.includes('تنبيه') ? 'text-amber-400' : '')}>{log}</div>))}</div></ScrollArea>
                    </div>
                  </div>
                )}
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