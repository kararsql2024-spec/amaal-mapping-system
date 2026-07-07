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

        const { data: projectsList } = await supabase.from('projects').select('id, name, elements');
        const { data: existingHouses } = await supabase.from('houses_data').select('unit_key, data');
        
        const updates: any[] = [];
        const notifications: any[] = [];

        // دالة لتحويل تاريخ إكسل (الرقم التسلسلي) إلى صيغة نصية مفهومة
        const parseExcelDate = (val: any) => {
          if (!val) return '';
          if (typeof val === 'number') {
            // تحويل الرقم التسلسلي لإكسل إلى تاريخ JS
            // إكسل يبدأ من 30 ديسمبر 1899
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
          }
          return val.toString().trim();
        };

        data.forEach((row: any, index) => {
          if (index === 0) return; // Skip header

          const cityName = row[excelMapping.cityCol]?.toString().trim();
          const unitLabel = row[excelMapping.unitCol]?.toString().trim();
          const customerName = row[excelMapping.nameCol]?.toString().trim();
          
          if (!cityName || !unitLabel) {
            if (index > 1) {
              logs.push(`⚠️ السطر ${index + 1}: تخطي السطر لعدم وجود اسم المدينة أو رقم الوحدة.`);
            }
            return;
          }

          const project = projectsList?.find(p => p.name === cityName);
          if (!project) {
            logs.push(`❌ السطر ${index + 1}: لم يتم العثور على مشروع باسم "${cityName}" في النظام.`);
            return;
          }

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
                  
                  // تصحيح: جلب حالة الشقة من قاعدة البيانات الفعلية بدلاً من المتغير الفارغ housesData
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

          if (!realUnitKey) {
            logs.push(`⚠️ السطر ${index + 1}: لم يتم العثور على شكل هندسي للوحدة "${unitLabel}" في مخطط "${cityName}". سيتم حفظها كبيانات نصية فقط.`);
            realUnitKey = unitLabel;
          }

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

          // تسجيل تفاصيل التغيير في السجل
          const oldName = existingData.name || 'فارغ';
          const newName = customerName || 'فارغ';
          const oldStatus = existingData.status || 'available';
          
          if (oldName !== newName || oldStatus !== status) {
            logs.push(`🔄 السطر ${index + 1} [${cityName} - ${unitLabel}]: تحديث المشتري من [${oldName}] إلى [${newName}] وتغيير الحالة من [${oldStatus}] إلى [${status}]`);
            
            if (status !== 'available') {
              notifications.push({
                project_id: project.id,
                message: `تحديث: الوحدة ${unitLabel} تغيرت من ${oldStatus} إلى ${status === 'sold' ? 'مباع' : 'استثمار'} للزبون ${customerName}`
              });
            }
          } else {
            logs.push(`ℹ️ السطر ${index + 1} [${cityName} - ${unitLabel}]: البيانات متطابقة بالفعل (المشتري: ${newName})`);
          }
        });

        logs.push(`جاري حفظ التحديثات في قاعدة البيانات...`);
        setProcessLogs([...logs]);

        for (let i = 0; i < updates.length; i += 100) {
          const chunk = updates.slice(i, i + 100);
          const { error: upsertError } = await supabase.from('houses_data').upsert(chunk, { onConflict: 'unit_key' });
          if (upsertError) {
            logs.push(`❌ فشل حفظ دفعة من التحديثات: ${upsertError.message}`);
            throw upsertError;
          }
        }

        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications.slice(0, 100));
        }

        const now = new Date().toISOString();
        await supabase.from('settings').upsert({ key: 'last_excel_update', value: now });
        setLastUpdate(now);
        logs.push("🎉 تم الانتهاء من تحديث كافة البيانات بنجاح!");
        setProcessLogs([...logs]);
        showSuccess("تم تحديث البيانات بنجاح");
      } catch (error: any) {
        console.error(error);
        logs.push(`❌ حدث خطأ أثناء المعالجة: ${error.message || error}`);
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
      const cleanedElements = elements.map(el => {
        const cleaned: any = { ...el };
        Object.keys(cleaned).forEach(key => {
          if (cleaned[key] === undefined || cleaned[key] === null) delete cleaned[key];
        });
        return cleaned;
      });
      const { error } = await supabase.from('projects').update({ elements: cleanedElements, map_width: Math.round(newWidth), map_height: Math.round(newHeight) }).eq('id', editingMapProject.id);
      if (error) throw error;

      // حفظ لون الخلفية والشبكة في إعدادات المشروع
      const updatedConfigs = {
        ...projectConfigs,
        [editingMapProject.id]: { backgroundColor, showGrid }
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

  const handleDownloadBackup = async () => {
    setIsGeneratingBackup(true);
    try {
      const { data: projects } = await supabase.from('projects').select('*');
      const { data: houses } = await supabase.from('houses_data').select('*');
      const { data: settings } = await supabase.from('settings').select('*');
      const { data: centers } = await supabase.from('marketing_centers').select('*');
      const backup = { timestamp: new Date().toISOString(), projects, houses, settings, centers };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      showSuccess("تم إنشاء النسخة الاحتياطية بنجاح");
    } catch (error) { showError("فشل في إنشاء النسخة الاحتياطية"); } finally { setIsGeneratingBackup(false); }
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100"><Database className="text-white" /></div>
                    <h2 className="text-2xl font-black text-slate-800">النسخ الاحتياطي وإدارة البيانات</h2>
                  </div>
                  <Button onClick={handleDownloadBackup} disabled={isGeneratingBackup} className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2 h-12 px-6 font-bold">
                    {isGeneratingBackup ? <RefreshCcw className="animate-spin" /> : <Download size={18} />}
                    إنشاء نسخة احتياطية كاملة
                  </Button>
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
                        <div className="space-y-2"><Label className="text-xs font-black text-slate-400 uppercase">اسم القسم</Label><Input value={newCenter.name} onChange={(e) => setNewCenter({...newCenter, name: e.target.value})} className="rounded-xl h-12 font-bold" placeholder="مثال: قسم المبيعات" /></div>
                        <div className="space-y-2"><Label className="text-xs font-black text-slate-400 uppercase">كلمة المرور</Label><Input type="password" value={newCenter.password} onChange={(e) => setNewCenter({...newCenter, password: e.target.value})} className="rounded-xl h-12 font-bold" placeholder="****" /></div>
                        <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-400 uppercase">نوع القسم (للصلاحيات)</Label>
                          <Select value={newCenter.type} onValueChange={(val) => setNewCenter({...newCenter, type: val})}>
                            <SelectTrigger className="rounded-xl h-12 font-bold"><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {departmentTypes.map(type => (<SelectItem key={type} value={type} className="font-bold">{type}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-400 uppercase">المشاريع المسموحة</Label>
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
                        </div>
                      </div>
                    </div>
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
                    <div className="p-10 border-4 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-4 group hover:border-emerald-200 transition-colors relative overflow-hidden">
                      {isProcessing && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center flex-col gap-4"><RefreshCcw className="w-12 h-12 text-emerald-600 animate-spin" /><p className="font-black text-emerald-800">جاري معالجة البيانات...</p></div>}
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
                <div className="flex items-center justify-between"><h2 className="text-xl font-bold">المشاريع الحالية</h2><Button onClick={() => { setIsCreating(true); setEditingProjectInfo(null<dyad-write path="src/pages/Admin.tsx" description="تحديث لوحة الإدارة لدعم حفظ لون الخلفية المخصص وإظهار/إخفاء الشبكة لكل مشروع بشكل كامل.">
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

        const { data: projectsList } = await supabase.from('projects').select('id, name, elements');
        const { data: existingHouses } = await supabase.from('houses_data').select('unit_key, data');
        
        const updates: any[] = [];
        const notifications: any[] = [];

        // دالة لتحويل تاريخ إكسل (الرقم التسلسلي) إلى صيغة نصية مفهومة
        const parseExcelDate = (val: any) => {
          if (!val) return '';
          if (typeof val === 'number') {
            // تحويل الرقم التسلسلي لإكسل إلى تاريخ JS
            // إكسل يبدأ من 30 ديسمبر 1899
            const date = new Date(Math.round((val - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
          }
          return val.toString().trim();
        };

        data.forEach((row: any, index) => {
          if (index === 0) return; // Skip header

          const cityName = row[excelMapping.cityCol]?.toString().trim();
          const unitLabel = row[excelMapping.unitCol]?.toString().trim();
          const customerName = row[excelMapping.nameCol]?.toString().trim();
          
          if (!cityName || !unitLabel) {
            if (index > 1) {
              logs.push(`⚠️ السطر ${index + 1}: تخطي السطر لعدم وجود اسم المدينة أو رقم الوحدة.`);
            }
            return;
          }

          const project = projectsList?.find(p => p.name === cityName);
          if (!project) {
            logs.push(`❌ السطر ${index + 1}: لم يتم العثور على مشروع باسم "${cityName}" في النظام.`);
            return;
          }

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
                  
                  // تصحيح: جلب حالة الشقة من قاعدة البيانات الفعلية بدلاً من المتغير الفارغ housesData
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

          if (!realUnitKey) {
            logs.push(`⚠️ السطر ${index + 1}: لم يتم العثور على شكل هندسي للوحدة "${unitLabel}" في مخطط "${cityName}". سيتم حفظها كبيانات نصية فقط.`);
            realUnitKey = unitLabel;
          }

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

          // تسجيل تفاصيل التغيير في السجل
          const oldName = existingData.name || 'فارغ';
          const newName = customerName || 'فارغ';
          const oldStatus = existingData.status || 'available';
          
          if (oldName !== newName || oldStatus !== status) {
            logs.push(`🔄 السطر ${index + 1} [${cityName} - ${unitLabel}]: تحديث المشتري من [${oldName}] إلى [${newName}] وتغيير الحالة من [${oldStatus}] إلى [${status}]`);
            
            if (status !== 'available') {
              notifications.push({
                project_id: project.id,
                message: `تحديث: الوحدة ${unitLabel} تغيرت من ${oldStatus} إلى ${status === 'sold' ? 'مباع' : 'استثمار'} للزبون ${customerName}`
              });
            }
          } else {
            logs.push(`ℹ️ السطر ${index + 1} [${cityName} - ${unitLabel}]: البيانات متطابقة بالفعل (المشتري: ${newName})`);
          }
        });

        logs.push(`جاري حفظ التحديثات في قاعدة البيانات...`);
        setProcessLogs([...logs]);

        for (let i = 0; i < updates.length; i += 100) {
          const chunk = updates.slice(i, i + 100);
          const { error: upsertError } = await supabase.from('houses_data').upsert(chunk, { onConflict: 'unit_key' });
          if (upsertError) {
            logs.push(`❌ فشل حفظ دفعة من التحديثات: ${upsertError.message}`);
            throw upsertError;
          }
        }

        if (notifications.length > 0) {
          await supabase.from('notifications').insert(notifications.slice(0, 100));
        }

        const now = new Date().toISOString();
        await supabase.from('settings').upsert({ key: 'last_excel_update', value: now });
        setLastUpdate(now);
        logs.push("🎉 تم الانتهاء من تحديث كافة البيانات بنجاح!");
        setProcessLogs([...logs]);
        showSuccess("تم تحديث البيانات بنجاح");
      } catch (error: any) {
        console.error(error);
        logs.push(`❌ حدث خطأ أثناء المعالجة: ${error.message || error}`);
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
      const cleanedElements = elements.map(el => {
        const cleaned: any = { ...el };
        Object.keys(cleaned).forEach(key => {
          if (cleaned[key] === undefined || cleaned[key] === null) delete cleaned[key];
        });
        return cleaned;
      });
      const { error } = await supabase.from('projects').update({ elements: cleanedElements, map_width: Math.round(newWidth), map_height: Math.round(newHeight) }).eq('id', editingMapProject.id);
      if (error) throw error;

      // حفظ لون الخلفية والشبكة في إعدادات المشروع
      const updatedConfigs = {
        ...projectConfigs,
        [editingMapProject.id]: { backgroundColor, showGrid }
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

  const handleDownloadBackup = async () => {
    setIsGeneratingBackup(true);
    try {
      const { data: projects } = await supabase.from('projects').select('*');
      const { data: houses } = await supabase.from('houses_data').select('*');
      const { data: settings } = await supabase.from('settings').select('*');
      const { data: centers } = await supabase.from('marketing_centers').select('*');
      const backup = { timestamp: new Date().toISOString(), projects, houses, settings, centers };
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      showSuccess("تم إنشاء النسخة الاحتياطية بنجاح");
    } catch (error) { showError("فشل في إنشاء النسخة الاحتياطية"); } finally { setIsGeneratingBackup(false); }
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
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-100"><Database className="text-white" /></div>
                    <h2 className="text-2xl font-black text-slate-800">النسخ الاحتياطي وإدارة البيانات</h2>
                  </div>
                  <Button onClick={handleDownloadBackup} disabled={isGeneratingBackup} className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2 h-12 px-6 font-bold">
                    {isGeneratingBackup ? <RefreshCcw className="animate-spin" /> : <Download size={18} />}
                    إنشاء نسخة احتياطية كاملة
                  </Button>
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
                        <div className="space-y-2"><Label className="text-xs font-black text-slate-400 uppercase">اسم القسم</Label><Input value={newCenter.name} onChange={(e) => setNewCenter({...newCenter, name: e.target.value})} className="rounded-xl h-12 font-bold" placeholder="مثال: قسم المبيعات" /></div>
                        <div className="space-y-2"><Label className="text-xs font-black text-slate-400 uppercase">كلمة المرور</Label><Input type="password" value={newCenter.password} onChange={(e) => setNewCenter({...newCenter, password: e.target.value})} className="rounded-xl h-12 font-bold" placeholder="****" /></div>
                        <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-400 uppercase">نوع القسم (للصلاحيات)</Label>
                          <Select value={newCenter.type} onValueChange={(val) => setNewCenter({...newCenter, type: val})}>
                            <SelectTrigger className="rounded-xl h-12 font-bold"><SelectValue placeholder="اختر النوع..." /></SelectTrigger>
                            <SelectContent className="rounded-xl">
                              {departmentTypes.map(type => (<SelectItem key={type} value={type} className="font-bold">{type}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs font-black text-slate-400 uppercase">المشاريع المسموحة</Label>
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
                        </div>
                      </div>
                    </div>
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
                    <div className="p-10 border-4 border-dashed border-slate-100 rounded-[2.5rem] bg-slate-50/50 flex flex-col items-center justify-center text-center space-y-4 group hover:border-emerald-200 transition-colors relative overflow-hidden">
                      {isProcessing && <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-10 flex items-center justify-center flex-col gap-4"><RefreshCcw className="w-12 h-12 text-emerald-600 animate-spin" /><p className="font-black text-emerald-800">جاري معالجة البيانات...</p></div>}
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

const MappingInput = ({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) => (
  <div className="flex items-center justify-between gap-4">
    <Label className="text-xs font-bold text-slate-600">{label}</Label>
    <Input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="w-16 h-10 text-center font-black rounded-lg border-slate-200" maxLength={2} />
  </div>
);

const PermissionToggle = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
  <div className="flex items-center justify-between p-3 bg-slate-50/50 rounded-xl border border-slate-100 hover:bg-white transition-colors">
    <span className="text-xs font-bold text-slate-700">{label}</span>
    <span className={cn("w-10 h-5 rounded-full transition-colors relative", checked ? "bg-indigo-600" : "bg-slate-200")}>
      <div className={cn("absolute top-1 w-3 h-3 bg-white rounded-full transition-all", checked ? "right-1" : "right-6")} />
    </span>
  </div>
);

export default Admin;