"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowRight, BarChart3, TrendingUp, DollarSign, Coins, FileText, 
  Home, Building2, CheckCircle2, Clock, ShieldCheck, PieChart as PieIcon,
  Percent, Loader2, Filter, Tags, AlertTriangle
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { supabase } from "@/integrations/supabase/client";

interface ReportsProps {
  projects: Project[];
}

const Reports = ({ projects }: ReportsProps) => {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [housesData, setHousesData] = useState<Record<string, any>>({});
  const [fetchedElements, setFetchedElements] = useState<MapElement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasAccess, setHasAccess] = useState<boolean>(true);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(true);

  // حالات الفلترة المخصصة
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');

  // التحقق من صلاحية الوصول للقسم الحالي
  useEffect(() => {
    const checkAccessPermission = async () => {
      setCheckingAccess(true);
      try {
        const savedCenterId = localStorage.getItem('marketing_center_session');
        if (!savedCenterId) {
          setHasAccess(false);
          setCheckingAccess(false);
          return;
        }

        const { data: centers } = await supabase.from('marketing_centers').select('*');
        const center = centers?.find(c => c.id === savedCenterId);
        
        if (!center) {
          setHasAccess(false);
          setCheckingAccess(false);
          return;
        }

        const { data: settings } = await supabase.from('settings').select('*');
        const permsSetting = settings?.find(s => s.key === 'dept_permissions');
        
        if (permsSetting && permsSetting.value && center.type) {
          const deptPerms = permsSetting.value[center.type];
          if (deptPerms && deptPerms.canAccessReports === false) {
            setHasAccess(false);
          } else {
            setHasAccess(true);
          }
        } else {
          setHasAccess(true);
        }
      } catch (e) {
        console.error("Error checking reports access:", e);
        setHasAccess(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccessPermission();
  }, []);

  // جلب البيانات حياً ومباشرة من قاعدة البيانات لضمان عمل التقارير بشكل مستقل وموثوق دائماً
  useEffect(() => {
    if (!hasAccess) return;

    const fetchReportsData = async () => {
      setLoading(true);
      try {
        // 1. جلب عناصر المخطط (elements) كاملة من جدول المشاريع
        let elementsList: MapElement[] = [];
        if (selectedProjectId === 'all') {
          const { data: projData, error: projErr } = await supabase
            .from('projects')
            .select('elements');
          if (projErr) throw projErr;
          if (projData) {
            projData.forEach(p => {
              if (p.elements && Array.isArray(p.elements)) {
                elementsList = [...elementsList, ...(p.elements as MapElement[])];
              }
            });
          }
        } else {
          const { data: projData, error: projErr } = await supabase
            .from('projects')
            .select('elements')
            .eq('id', selectedProjectId)
            .single();
          if (projErr) throw projErr;
          if (projData && projData.elements && Array.isArray(projData.elements)) {
            elementsList = projData.elements as MapElement[];
          }
        }
        setFetchedElements(elementsList);

        // 2. جلب بيانات المبيعات (houses_data)
        let allUnits: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from('houses_data')
            .select('unit_key, project_id, data')
            .range(from, from + step - 1);
          
          if (selectedProjectId !== 'all') {
            query = query.eq('project_id', selectedProjectId);
          }

          const { data, error } = await query;
          if (error) throw error;

          if (!data || data.length === 0) {
            hasMore = false;
          } else {
            allUnits = [...allUnits, ...data];
            from += step;
            if (data.length < step) hasMore = false;
          }
        }

        const formatted: Record<string, any> = {};
        allUnits.forEach(u => {
          formatted[u.unit_key] = u.data;
        });
        setHousesData(formatted);
      } catch (err) {
        console.error("Error fetching reports data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchReportsData();
  }, [selectedProjectId, hasAccess]);

  // استخراج الزونات والأصناف المتوفرة ديناميكياً من العناصر المجلوبة للفلترة
  const { availableZones, availableClasses } = useMemo(() => {
    const zones = new Set<string>();
    const classes = new Set<string>();
    fetchedElements.forEach(el => {
      if (el.type === 'house') {
        const parts = el.label.split('-');
        if (parts[0]) zones.add(parts[0]);
        if (parts.length >= 3) {
          const typeMatch = parts[2].match(/[a-zA-Z]+/);
          if (typeMatch) classes.add(typeMatch[0]);
        }
      }
    });
    return {
      availableZones: Array.from(zones).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      availableClasses: Array.from(classes).sort()
    };
  }, [fetchedElements]);

  // إعادة تعيين الفلاتر الفرعية عند تغيير المشروع المستهدف
  useEffect(() => {
    setSelectedZone('all');
    setSelectedClass('all');
  }, [selectedProjectId]);

  // دالة مساعدة لتحليل الأسعار
  const parsePrice = (price: any) => {
    if (price === null || price === undefined) return 0;
    const cleaned = price.toString().replace(/,/g, '').replace(/[^\d.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  };

  const getCurrencyType = (curr: any) => {
    if (!curr) return 'IQD';
    const c = curr.toString().trim().toLowerCase();
    if (c.includes('دينار') || c.includes('iqd') || c.includes('د.ع') || c.includes('عراقي')) return 'IQD';
    if (c.includes('دولار') || c.includes('usd') || c.includes('$')) return 'USD';
    return 'IQD'; 
  };

  // تصفية العناصر بناءً على الفلاتر المحددة
  const { filteredElementsForGlobal, filteredElementsForZonePerf } = useMemo(() => {
    const globalList = fetchedElements.filter(el => {
      if (el.type !== 'house' && el.type !== 'tower') return true;
      
      // فلترة الصنف
      if (selectedClass !== 'all') {
        const parts = el.label.split('-');
        if (parts.length >= 3) {
          const typeMatch = parts[2].match(/[a-zA-Z]+/);
          const uClass = typeMatch ? typeMatch[0] : '';
          if (uClass !== selectedClass) return false;
        } else {
          return false;
        }
      }

      // فلترة الزون
      if (selectedZone !== 'all') {
        const parts = el.label.split('-');
        const zone = parts[0] || '';
        if (zone !== selectedZone) return false;
      }

      return true;
    });

    // تقرير أداء الزونات يستثني فلتر الزون ويطبق فقط فلتر الصنف
    const zonePerfList = fetchedElements.filter(el => {
      if (el.type !== 'house') return true;
      if (selectedClass !== 'all') {
        const parts = el.label.split('-');
        if (parts.length >= 3) {
          const typeMatch = parts[2].match(/[a-zA-Z]+/);
          const uClass = typeMatch ? typeMatch[0] : '';
          if (uClass !== selectedClass) return false;
        } else {
          return false;
        }
      }
      return true;
    });

    return {
      filteredElementsForGlobal: globalList,
      filteredElementsForZonePerf: zonePerfList
    };
  }, [fetchedElements, selectedZone, selectedClass]);

  // 1. حساب الإحصائيات العامة والمالية بناءً على الفلترة
  const stats = useMemo(() => {
    let total = 0;
    let sold = 0;
    let investment = 0;
    let available = 0;
    let reserved = 0;
    let pending = 0;
    let frozen = 0;

    let revenueIQD = 0;
    let revenueUSD = 0;
    let expectedRevenueIQD = 0;
    let expectedRevenueUSD = 0;

    let promotedTabo = 0;
    let receivedTabo = 0;
    let notPromotedTabo = 0;

    let receivedUnit = 0;
    let notReceivedUnit = 0;

    const processUnit = (unitKey: string) => {
      const data = housesData[unitKey] || { status: 'available' };
      
      if (data.status === 'frozen_hidden') return;

      if (data.status === 'frozen_uncounted' || data.status === 'frozen_counted') {
        frozen++;
        if (data.status === 'frozen_uncounted') return;
      }

      total++;

      if (data.status === 'sold') sold++;
      else if (data.status === 'investment') investment++;
      else if (data.status === 'reserved') reserved++;
      else if (data.status === 'pending') pending++;
      else available++;

      // تحليل الطابو
      const tabo = data.taboStatus?.trim();
      if (tabo === 'مروج') promotedTabo++;
      else if (tabo === 'مستلم') receivedTabo++;
      else notPromotedTabo++;

      // تحليل استلام الوحدة
      if (data.handoverDate) receivedUnit++;
      else notReceivedUnit++;

      // تحليل الإيرادات والأسعار
      const priceValue = parsePrice(data.price);
      if (priceValue > 0) {
        const cType = getCurrencyType(data.currency);
        if (data.status === 'sold' || data.status === 'investment') {
          if (cType === 'IQD') revenueIQD += priceValue;
          else revenueUSD += priceValue;
        } else if (data.status === 'reserved' || data.status === 'pending') {
          if (cType === 'IQD') expectedRevenueIQD += priceValue;
          else expectedRevenueUSD += priceValue;
        }
      }
    };

    filteredElementsForGlobal.forEach(el => {
      if (el.type === 'house') {
        processUnit(el.id);
      } else if (el.type === 'tower') {
        const floors = el.floors || 0;
        const aptsPerFloor = el.apartmentsPerFloor || 0;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            processUnit(`${el.id}_F${f}_A${a}`);
          }
        }
      }
    });

    return {
      total, sold, investment, available, reserved, pending, frozen,
      revenueIQD, revenueUSD, expectedRevenueIQD, expectedRevenueUSD,
      promotedTabo, receivedTabo, notPromotedTabo,
      receivedUnit, notReceivedUnit
    };
  }, [filteredElementsForGlobal, housesData]);

  // 2. بيانات مخطط توزيع الحالات (Pie Chart)
  const statusDistributionData = useMemo(() => {
    return [
      { name: 'متوفر', value: stats.available, color: '#10b981' },
      { name: 'مباع', value: stats.sold, color: '#f43f5e' },
      { name: 'استثمار', value: stats.investment, color: '#a855f7' },
      { name: 'محجوز', value: stats.reserved, color: '#fbbf24' },
      { name: 'حجز أولي', value: stats.pending, color: '#3b82f6' },
    ].filter(item => item.value > 0);
  }, [stats]);

  // 3. بيانات أداء الزونات والبلوكات مرتبة أبجدياً ورقمياً (Bar Chart) - تستثني فلتر الزون
  const zonePerformanceData = useMemo(() => {
    const zones: Record<string, { total: number, sold: number, investment: number }> = {};

    filteredElementsForZonePerf.forEach(el => {
      if (el.type === 'house') {
        const parts = el.label.split('-');
        const zone = parts[0] || "عام";
        const data = housesData[el.id] || { status: 'available' };

        if (data.status === 'frozen_hidden') return;

        if (!zones[zone]) {
          zones[zone] = { total: 0, sold: 0, investment: 0 };
        }

        zones[zone].total++;
        if (data.status === 'sold') zones[zone].sold++;
        if (data.status === 'investment') zones[zone].investment++;
      }
    });

    // ترتيب الزونات ترتيباً طبيعياً (أبجدياً ورقمياً)
    const sortedZones = Object.entries(zones).sort((a, b) => {
      return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' });
    });

    return sortedZones.map(([name, z]) => ({
      name: `زون ${name}`,
      'إجمالي الوحدات': z.total,
      'المباعة': z.sold,
      'الاستثمار': z.investment,
      'نسبة المبيعات %': z.total > 0 ? Math.round(((z.sold + z.investment) / z.total) * 100) : 0
    })).slice(0, 15); // عرض أول 15 زون مرتبة
  }, [filteredElementsForZonePerf, housesData]);

  // 4. بيانات منحنى المبيعات الزمني مرتبة كرونولوجياً من الأقدم للأحدث (Line Chart)
  const salesTrendData = useMemo(() => {
    const monthlySales: Record<string, { count: number, revenueIQD: number, revenueUSD: number, dateObj: Date }> = {};

    const processUnitDate = (unitKey: string) => {
      const data = housesData[unitKey];
      if (data && (data.status === 'sold' || data.status === 'investment') && data.saleDate) {
        const date = new Date(data.saleDate);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = date.getMonth();
          const sortKey = `${year}-${String(month + 1).padStart(2, '0')}`;
          
          if (!monthlySales[sortKey]) {
            monthlySales[sortKey] = { 
              count: 0, 
              revenueIQD: 0, 
              revenueUSD: 0,
              dateObj: new Date(year, month, 1)
            };
          }
          monthlySales[sortKey].count++;
          
          const priceValue = parsePrice(data.price);
          const cType = getCurrencyType(data.currency);
          if (cType === 'IQD') monthlySales[sortKey].revenueIQD += priceValue;
          else monthlySales[sortKey].revenueUSD += priceValue;
        }
      }
    };

    filteredElementsForGlobal.forEach(el => {
      if (el.type === 'house') {
        processUnitDate(el.id);
      } else if (el.type === 'tower') {
        const floors = el.floors || 0;
        const aptsPerFloor = el.apartmentsPerFloor || 0;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            processUnitDate(`${el.id}_F${f}_A${a}`);
          }
        }
      }
    });

    // ترتيب الأشهر تصاعدياً من الأقدم إلى الأحدث
    const sortedMonths = Object.entries(monthlySales).sort((a, b) => {
      return a[0].localeCompare(b[0]);
    });

    return sortedMonths.map(([key, data]) => {
      const monthName = data.dateObj.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });
      return {
        name: monthName,
        'عدد الوحدات المباعة': data.count,
        'الإيرادات (د.ع)': data.revenueIQD,
        'الإيرادات ($)': data.revenueUSD
      };
    });
  }, [filteredElementsForGlobal, housesData]);

  // 5. تقرير متوسط أسعار الأصناف الجديد (Average Unit Price Analysis)
  const averagePriceData = useMemo(() => {
    const classPrices: Record<string, { sumIQD: number, countIQD: number, sumUSD: number, countUSD: number }> = {};

    filteredElementsForGlobal.forEach(el => {
      if (el.type === 'house') {
        const parts = el.label.split('-');
        let uClass = "غير محدد";
        if (parts.length >= 3) {
          const typeMatch = parts[2].match(/[a-zA-Z]+/);
          uClass = typeMatch ? typeMatch[0] : 'غير محدد';
        }

        const data = housesData[el.id];
        if (data && (data.status === 'sold' || data.status === 'investment')) {
          const priceValue = parsePrice(data.price);
          if (priceValue > 0) {
            const cType = getCurrencyType(data.currency);
            if (!classPrices[uClass]) {
              classPrices[uClass] = { sumIQD: 0, countIQD: 0, sumUSD: 0, countUSD: 0 };
            }
            if (cType === 'IQD') {
              classPrices[uClass].sumIQD += priceValue;
              classPrices[uClass].countIQD++;
            } else {
              classPrices[uClass].sumUSD += priceValue;
              classPrices[uClass].countUSD++;
            }
          }
        }
      }
    });

    return Object.entries(classPrices).map(([className, data]) => ({
      name: `صنف ${className}`,
      'متوسط السعر (د.ع)': data.countIQD > 0 ? Math.round(data.sumIQD / data.countIQD) : 0,
      'متوسط السعر ($)': data.countUSD > 0 ? Math.round(data.sumUSD / data.countUSD) : 0,
    })).filter(item => item['متوسط السعر (د.ع)'] > 0 || item['متوسط السعر ($)'] > 0);
  }, [filteredElementsForGlobal, housesData]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  // دالة لتنسيق الأرقام الكبيرة على المحور Y بشكل مبسط ومقروء
  const formatYAxis = (value: number) => {
    if (value >= 1e9) return (value / 1e9).toFixed(1) + ' مليار';
    if (value >= 1e6) return (value / 1e6).toFixed(1) + ' مليون';
    return formatNumber(value);
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center font-bold">
        جاري التحقق من صلاحيات الوصول...
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4" dir="rtl">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 text-center space-y-6">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center text-rose-500 mx-auto">
            <AlertTriangle size={32} />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-800">عذراً، لا تملك صلاحية الوصول</h2>
            <p className="text-slate-500 text-xs font-bold leading-relaxed">
              تم تقييد وصول هذا القسم إلى لوحة التقارير والتحليلات المالية من قبل الإدارة. يرجى مراجعة المسؤول للحصول على الصلاحية.
            </p>
          </div>
          <Button onClick={() => navigate('/')} className="w-full bg-indigo-600 hover:bg-indigo-700 rounded-xl h-12 font-bold">
            العودة للرئيسية
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-6 md:p-8" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* الهيدر */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon" className="rounded-xl hover:bg-slate-100">
                <ArrowRight className="w-6 h-6 text-slate-600" />
              </Button>
            </Link>
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <BarChart3 className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">لوحة التقارير والتحليلات المتقدمة</h1>
              <p className="text-slate-500 text-xs font-bold mt-0.5">تحليلات مالية وإحصائية شاملة للمشاريع السكنية</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider">المشروع المستهدف:</span>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-[220px] rounded-xl h-12 font-black border-slate-200 bg-slate-50/50">
                <SelectValue placeholder="اختر المشروع..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-black">🌐 كافة المشاريع المدمجة</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id} className="font-bold">{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </header>

        {/* شريط الفلاتر الفرعية المخصصة */}
        <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-slate-600 font-black text-xs">
            <Filter size={16} className="text-indigo-600" />
            <span>تخصيص وتصفية التقارير:</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400">الزون:</span>
            <Select value={selectedZone} onValueChange={setSelectedZone}>
              <SelectTrigger className="w-[140px] rounded-xl h-10 font-bold border-slate-200 text-xs">
                <SelectValue placeholder="كل الزونات" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-bold text-xs">كل الزونات</SelectItem>
                {availableZones.map(z => (
                  <SelectItem key={z} value={z} className="font-bold text-xs">زون {z}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400">صنف الوحدة:</span>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-[140px] rounded-xl h-10 font-bold border-slate-200 text-xs">
                <SelectValue placeholder="كل الأصناف" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-bold text-xs">كل الأصناف</SelectItem>
                {availableClasses.map(c => (
                  <SelectItem key={c} value={c} className="font-bold text-xs">صنف {c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {(selectedZone !== 'all' || selectedClass !== 'all') && (
            <Button 
              variant="ghost" 
              onClick={() => { setSelectedZone('all'); setSelectedClass('all'); }}
              className="text-xs font-black text-rose-500 hover:bg-rose-50 rounded-xl h-10 px-4"
            >
              إعادة تعيين الفلاتر
            </Button>
          )}
        </div>

        {loading ? (
          <div className="bg-white p-20 rounded-[2.5rem] shadow-xl border border-slate-100 text-center flex flex-col items-center justify-center gap-4">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <h2 className="text-xl font-bold text-slate-600">جاري تحميل وتحليل البيانات المالية...</h2>
          </div>
        ) : (
          <>
            {/* كروت الإحصائيات السريعة */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="rounded-[2rem] border-slate-100 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">إجمالي المبيعات (د.ع)</p>
                    <h3 className="text-2xl font-black text-emerald-600">{formatNumber(stats.revenueIQD)}</h3>
                    <p className="text-[10px] text-slate-400 font-bold">المحجوز المتوقع: {formatNumber(stats.expectedRevenueIQD)} د.ع</p>
                  </div>
                  <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                    <Coins className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border-slate-100 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">إجمالي المبيعات ($)</p>
                    <h3 className="text-2xl font-black text-blue-600">${formatNumber(stats.revenueUSD)}</h3>
                    <p className="text-[10px] text-slate-400 font-bold">المحجوز المتوقع: ${formatNumber(stats.expectedRevenueUSD)}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                    <DollarSign className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border-slate-100 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">نسبة المبيعات العامة</p>
                    <h3 className="text-2xl font-black text-indigo-600">
                      {stats.total > 0 ? Math.round(((stats.sold + stats.investment) / stats.total) * 100) : 0}%
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold">المباع: {stats.sold} | الاستثمار: {stats.investment}</p>
                  </div>
                  <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
                    <Percent className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>

              <Card className="rounded-[2rem] border-slate-100 shadow-sm overflow-hidden bg-white">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-wider">الوحدات المتاحة للبيع</p>
                    <h3 className="text-2xl font-black text-slate-700">{stats.available}</h3>
                    <p className="text-[10px] text-slate-400 font-bold">من أصل {stats.total} وحدة سكنية</p>
                  </div>
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-600">
                    <Home className="w-6 h-6" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* الرسوم البيانية الرئيسية */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* مخطط توزيع الحالات */}
              <Card className="rounded-[2rem] border-slate-100 shadow-sm bg-white lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <PieIcon className="text-indigo-600 w-5 h-5" />
                    توزيع حالات الوحدات
                  </CardTitle>
                  <CardDescription className="text-xs font-bold">النسبة المئوية لكل حالة من إجمالي المخطط</CardDescription>
                </CardHeader>
                <CardContent className="h-80 flex flex-col justify-between">
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusDistributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {statusDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value} وحدة`, 'العدد']} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-4 border-t border-slate-50 text-xs font-bold">
                    {statusDistributionData.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-slate-600">{entry.name}:</span>
                        <span className="text-slate-800 font-black">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* مخطط أداء الزونات */}
              <Card className="rounded-[2rem] border-slate-100 shadow-sm bg-white lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Building2 className="text-indigo-600 w-5 h-5" />
                    أداء المبيعات حسب الزونات
                  </CardTitle>
                  <CardDescription className="text-xs font-bold">مقارنة الوحدات المباعة والاستثمارية مقابل الإجمالي لكل زون مرتبة أبجدياً</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {zonePerformanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={zonePerformanceData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                        <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                        <Bar dataKey="المباعة" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="الاستثمار" fill="#a855f7" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="إجمالي الوحدات" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 font-bold">
                      لا توجد بيانات زونات كافية للعرض
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* منحنى المبيعات الزمني والتحليل القانوني */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* منحنى المبيعات عبر الزمن */}
              <Card className="rounded-[2rem] border-slate-100 shadow-sm bg-white lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <TrendingUp className="text-indigo-600 w-5 h-5" />
                    منحنى المبيعات عبر الزمن
                  </CardTitle>
                  <CardDescription className="text-xs font-bold">تطور حجم المبيعات والإيرادات الفعلية مرتبة من الأقدم للأحدث</CardDescription>
                </CardHeader>
                <CardContent className="h-80">
                  {salesTrendData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={salesTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                        <Tooltip 
                          formatter={(value, name) => {
                            if (name.toString().includes('د.ع')) return [`${formatNumber(Number(value))} د.ع`, 'الإيرادات'];
                            if (name.toString().includes('$')) return [`$${formatNumber(Number(value))}`, 'الإيرادات'];
                            return [value, name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                        <Line type="monotone" dataKey="عدد الوحدات المباعة" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
                        <Line type="monotone" dataKey="الإيرادات (د.ع)" stroke="#10b981" strokeWidth={2} />
                        <Line type="monotone" dataKey="الإيرادات ($)" stroke="#fbbf24" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 font-bold">
                      لا توجد بيانات مبيعات زمنية كافية للعرض (تأكد من إدخال تواريخ البيع للوحدات)
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* التحليل القانوني واستلام الوحدات */}
              <Card className="rounded-[2rem] border-slate-100 shadow-sm bg-white lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <ShieldCheck className="text-indigo-600 w-5 h-5" />
                    الموقف القانوني والاستلام
                  </CardTitle>
                  <CardDescription className="text-xs font-bold">متابعة معاملات الطابو وتسليم المفاتيح</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">موقف معاملات الطابو</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-emerald-600">مستلم الطابو:</span>
                        <span>{stats.receivedTabo} unit</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-emerald-500 h-full" style={{ width: `${stats.total > 0 ? (stats.receivedTabo / stats.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-indigo-600">قيد الترويج:</span>
                        <span>{stats.promotedTabo} unit</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full" style={{ width: `${stats.total > 0 ? (stats.promotedTabo / stats.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="h-px bg-slate-100" />

                  <div className="space-y-3">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">موقف تسليم الوحدات</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-sky-600">تم تسليم المفتاح:</span>
                        <span>{stats.receivedUnit} unit</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-sky-500 h-full" style={{ width: `${stats.total > 0 ? (stats.receivedUnit / stats.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-rose-400">غير مستلم بعد:</span>
                        <span>{stats.notReceivedUnit} unit</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div className="bg-rose-400 h-full" style={{ width: `${stats.total > 0 ? (stats.notReceivedUnit / stats.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* تقرير متوسط أسعار الأصناف الجديد */}
            <div className="grid grid-cols-1 gap-8">
              <Card className="rounded-[2rem] border-slate-100 shadow-sm bg-white">
                <CardHeader>
                  <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                    <Tags className="text-indigo-600 w-5 h-5" />
                    تحليل متوسط أسعار الوحدات حسب الأصناف
                  </CardTitle>
                  <CardDescription className="text-xs font-bold">
                    مقارنة متوسط القيمة المالية الفعلية للوحدات المباعة والمستثمرة لكل صنف (D, C, B, A...) بالدينار والدولار
                  </CardDescription>
                </CardHeader>
                <CardContent className="h-96">
                  {averagePriceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={averagePriceData} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 'bold' }} />
                        <YAxis tickFormatter={formatYAxis} tick={{ fontSize: 11, fontWeight: 'bold' }} />
                        <Tooltip 
                          formatter={(value, name) => {
                            if (name.toString().includes('د.ع')) return [`${formatNumber(Number(value))} د.ع`, 'متوسط السعر'];
                            if (name.toString().includes('$')) return [`$${formatNumber(Number(value))}`, 'متوسط السعر'];
                            return [value, name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, fontWeight: 'bold' }} />
                        <Bar dataKey="متوسط السعر (د.ع)" fill="#10b981" radius={[6, 6, 0, 0]} />
                        <Bar dataKey="متوسط السعر ($)" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-slate-400 font-bold">
                      لا توجد مبيعات مسجلة بأسعار صالحة للأصناف المحددة حالياً
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

      </div>
    </div>
  );
};

export default Reports;