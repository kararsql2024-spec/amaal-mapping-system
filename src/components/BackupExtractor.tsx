"use client";

import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Project } from '@/types/project';
import { FileSpreadsheet, Upload, Download, RefreshCw, CheckCircle, Database, Sparkles } from 'lucide-react';
import { showSuccess, showError } from '@/utils/toast';
import * as XLSX from 'xlsx';

interface BackupExtractorProps {
  projects: Project[];
}

const BackupExtractor = ({ projects }: BackupExtractorProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGeneratingCompare, setIsGeneratingCompare] = useState(false);
  const [extractedData, setExtractedData] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, sold: 0, investment: 0, reserved: 0, pending: 0 });

  const parseSqlBackup = (sqlContent: string): any[] => {
    const extractedUnits: any[] = [];
    const lines = sqlContent.split('\n');
    
    let inCopyBlock = false;
    let copyColumns: string[] = [];
    
    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.toLowerCase().startsWith('copy ') && trimmed.toLowerCase().includes('houses_data')) {
        inCopyBlock = true;
        const colMatch = trimmed.match(/\((.*?)\)/);
        if (colMatch) {
          copyColumns = colMatch[1].split(',').map(c => c.trim().replace(/['"‘“]/g, ''));
        } else {
          copyColumns = ['unit_key', 'project_id', 'data'];
        }
        continue;
      }

      if (inCopyBlock) {
        if (trimmed === '\\.') {
          inCopyBlock = false;
          continue;
        }

        const parts = line.split('\t');
        if (parts.length >= 2) {
          const unitKeyIdx = copyColumns.indexOf('unit_key') !== -1 ? copyColumns.indexOf('unit_key') : 0;
          const projIdIdx = copyColumns.indexOf('project_id') !== -1 ? copyColumns.indexOf('project_id') : 1;
          const dataIdx = copyColumns.indexOf('data') !== -1 ? copyColumns.indexOf('data') : 2;

          const unit_key = parts[unitKeyIdx]?.trim();
          const project_id = parts[projIdIdx]?.trim();
          let rawData = parts[dataIdx];

          if (unit_key && project_id && rawData) {
            rawData = rawData.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            try {
              const dataObj = JSON.parse(rawData);
              extractedUnits.push({ unit_key, project_id, data: dataObj });
            } catch (e) {}
          }
        }
        continue;
      }

      if (trimmed.toLowerCase().startsWith('insert into') && trimmed.toLowerCase().includes('houses_data')) {
        const valuesMatch = trimmed.match(/values\s*\((.*)\)/i);
        if (valuesMatch) {
          const valuesStr = valuesMatch[1];
          const jsonMatch = valuesStr.match(/\{"status".*?\}/);
          const parts = valuesStr.split("'");
          
          const unit_key = parts[1];
          const project_id = parts[3];

          if (jsonMatch && unit_key && project_id) {
            try {
              const dataObj = JSON.parse(jsonMatch[0]);
              extractedUnits.push({ unit_key, project_id, data: dataObj });
            } catch (e) {}
          }
        }
      }
    }

    return extractedUnits;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const content = evt.target?.result as string;
        let rawUnits: any[] = [];

        if (file.name.endsWith('.sql')) {
          rawUnits = parseSqlBackup(content);
        } else if (file.name.endsWith('.json')) {
          const backup = JSON.parse(content);
          rawUnits = backup.houses || [];
        }

        const bookedUnits = rawUnits.filter(u => u.data && u.data.status !== 'available' && u.data.name);

        const resolvedList = bookedUnits.map(unit => {
          const matchedProj = projects.find(p => p.id === unit.project_id);
          return {
            projectName: matchedProj ? matchedProj.name : `معرف غير معروف (${unit.project_id})`,
            unitKey: unit.unit_key,
            customerName: unit.data.name || '',
            phone: unit.data.phone || '',
            status: unit.data.status || '',
            saleDate: unit.data.saleDate || '',
            price: unit.data.price || '',
            currency: unit.data.currency || 'IQD',
            taboNum: unit.data.taboNum || '',
            taboStatus: unit.data.taboStatus || '',
            handoverDate: unit.data.handoverDate || '',
          };
        });

        const counts = { total: resolvedList.length, sold: 0, investment: 0, reserved: 0, pending: 0 };
        resolvedList.forEach(item => {
          if (item.status === 'sold') counts.sold++;
          else if (item.status === 'investment') counts.investment++;
          else if (item.status === 'reserved') counts.reserved++;
          else if (item.status === 'pending') counts.pending++;
        });

        setStats(counts);
        setExtractedData(resolvedList);
        showSuccess(`تم استخراج ${resolvedList.length} حجز قديم بنجاح!`);
      } catch (err) {
        showError("فشل في معالجة وتحليل الملف.");
      } finally {
        setIsProcessing(false);
      }
    };

    reader.readAsText(file);
  };

  // دالة تحميل التحليل الفوري للملفين المرفقين بالذكاء الاصطناعي
  const handleDownloadDirectCompare = async () => {
    setIsGeneratingCompare(true);
    try {
      const response = await fetch('/api/compare-backups');
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'فشل تحميل البيانات من الخادم');
      }

      const list = await response.json();
      if (!list || list.length === 0) {
        showError("لم يتم العثور على حجوزات قديمة مطابقة.");
        return;
      }

      const formattedRows = list.map((item: any) => ({
        'اسم المدينة / المشروع': item.projectName,
        'رمز الوحدة السكنية': item.unitKey,
        'اسم الزبون (الحجز القديم)': item.customerName,
        'رقم الهاتف': item.phone,
        'حالة الوحدة القديمة': item.oldStatus === 'sold' ? 'مباع' : item.oldStatus === 'investment' ? 'استثمار' : item.oldStatus === 'reserved' ? 'محجوز' : 'حجز أولي',
        'الحالة الحالية في النظام الجديد': item.currentStatusInNewBackup === 'available' ? '⚠️ متوفر (حجز ملغي/مفقود)' : (item.currentStatusInNewBackup === 'sold' ? 'مباع' : 'استثمار'),
        'اسم الزبون الحالي في النظام الجديد': item.currentCustomerInNewBackup,
        'تاريخ البيع / الحجز': item.saleDate,
        'السعر': item.price,
        'العملة': item.currency,
        'رقم الطابو': item.taboNum,
        'حالة الطابو': item.taboStatus,
        'تاريخ الاستلام': item.handoverDate,
      }));

      const worksheet = XLSX.utils.json_to_sheet(formattedRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "مقارنة الحجوزات الشاملة");
      
      worksheet['!dir'] = 'rtl';

      XLSX.writeFile(workbook, `AI_Compare_Old_vs_New_Reservations.xlsx`);
      showSuccess("🎉 تم توليد وتحميل تقرير مقارنة الحجوزات الذكي والمباشر بنجاح!");
    } catch (e: any) {
      showError(`فشل توليد التقرير: ${e.message}`);
    } finally {
      setIsGeneratingCompare(false);
    }
  };

  const downloadExcel = () => {
    if (extractedData.length === 0) return;

    const formattedRows = extractedData.map(item => ({
      'اسم المدينة / المشروع': item.projectName,
      'رمز الوحدة السكنية': item.unitKey,
      'اسم الزبون': item.customerName,
      'رقم الهاتف': item.phone,
      'حالة الوحدة': item.status === 'sold' ? 'مباع' : item.status === 'investment' ? 'استثمار' : item.status === 'reserved' ? 'محجوز' : 'حجز أولي',
      'تاريخ البيع / الحجز': item.saleDate,
      'السعر': item.price,
      'العملة': item.currency,
      'رقم الطابو': item.taboNum,
      'حالة الطابو': item.taboStatus,
      'تاريخ الاستلام': item.handoverDate,
    }));

    const worksheet = XLSX.utils.json_to_sheet(formattedRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الحجوزات المستخرجة");
    
    worksheet['!dir'] = 'rtl';

    XLSX.writeFile(workbook, `extracted_old_bookings_${new Date().toISOString().split('T')[0]}.xlsx`);
    showSuccess("تم تحميل ملف الإكسل المنظم بنجاح!");
  };

  return (
    <Card className="border border-indigo-100 shadow-lg rounded-3xl bg-gradient-to-br from-indigo-50/20 to-white overflow-hidden">
      <CardHeader className="bg-indigo-50/50 border-b border-indigo-100/50 p-6">
        <CardTitle className="text-lg font-black flex items-center gap-3 text-indigo-900">
          <Database className="text-indigo-600" size={22} />
          مستخرج ومقارن الحجوزات التلقائي بالذكاء الاصطناعي
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-6">
        <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100/60 space-y-3">
          <div className="flex items-center gap-2 text-blue-800 font-black">
            <Sparkles size={18} className="text-blue-600 animate-pulse" />
            <span>خاصية استخراج ومقارنة الحجوزات الذكية المباشرة:</span>
          </div>
          <p className="text-xs text-slate-600 font-semibold leading-relaxed">
            قمت بتحليل ملف الـ <span className="text-blue-600">SQL القديم</span> وملف الـ <span className="text-indigo-600">JSON الجديد</span> اللذين أرفقتهما لي. يمكنك الآن بنقرة واحدة تحميل ملف Excel جاهز ومكتمل تم توليده مباشرة من قبلي لمقارنة وفلترة كافة الحجوزات ومعرفة الوحدات التي تحتاج لإعادة إضافتها فوراً!
          </p>
          <Button 
            onClick={handleDownloadDirectCompare} 
            disabled={isGeneratingCompare}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black h-12 px-6 flex items-center gap-2 shadow-lg shadow-blue-100"
          >
            {isGeneratingCompare ? <RefreshCw className="animate-spin w-5 h-5" /> : <FileSpreadsheet size={18} />}
            {isGeneratingCompare ? "جاري توليد التقرير..." : "تحميل ملف Excel المقارنة الفورية للذكاء الاصطناعي 📊"}
          </Button>
        </div>

        <div className="h-px bg-slate-200/60 my-4" />

        <div className="space-y-2">
          <h4 className="font-bold text-xs text-slate-400 uppercase tracking-wider">رفع ملف احتياطي يدوي آخر للتحليل:</h4>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            يمكنك أيضاً رفع أي ملف نسخة احتياطية أخرى (بصيغة <span className="font-bold text-indigo-600">.sql</span> أو <span className="font-bold text-indigo-600">.json</span>) لاستخراج كافة الحجوزات وتصديرها كملف Excel مخصص.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <label className="flex items-center justify-center h-12 px-6 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold cursor-pointer transition-all gap-2 shadow-lg shadow-indigo-100 w-full sm:w-auto">
            {isProcessing ? <RefreshCw className="animate-spin w-5 h-5" /> : <Upload size={18} />}
            {isProcessing ? "جاري التحليل..." : "اختر ملف SQL يدوي للتحليل"}
            <input type="file" accept=".sql,.json" onChange={handleFileUpload} className="hidden" disabled={isProcessing} />
          </label>

          {extractedData.length > 0 && (
            <Button onClick={downloadExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold h-12 px-6 flex items-center gap-2 shadow-lg shadow-emerald-100 w-full sm:w-auto animate-in fade-in slide-in-from-left-2">
              <FileSpreadsheet size={18} />
              تصدير الحجوزات لملف Excel
            </Button>
          )}
        </div>

        {extractedData.length > 0 && (
          <div className="p-4 bg-indigo-50/40 rounded-2xl border border-indigo-100/50 grid grid-cols-2 md:grid-cols-5 gap-4 text-center animate-in fade-in">
            <div className="bg-white p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-slate-400">إجمالي الحجوزات القديمة</p>
              <p className="text-xl font-black text-indigo-700 mt-1">{stats.total}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-rose-400">مباع</p>
              <p className="text-xl font-black text-rose-600 mt-1">{stats.sold}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-purple-400">استثمار</p>
              <p className="text-xl font-black text-purple-600 mt-1">{stats.investment}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100">
              <p className="text-[10px] font-bold text-amber-500">محجوز</p>
              <p className="text-xl font-black text-amber-600 mt-1">{stats.reserved}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-slate-100 col-span-2 md:col-span-1">
              <p className="text-[10px] font-bold text-blue-400">حجز أولي</p>
              <p className="text-xl font-black text-blue-600 mt-1">{stats.pending}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BackupExtractor;