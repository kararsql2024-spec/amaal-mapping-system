"use client";

import React, { useState, useMemo } from 'react';
import { Project, MapElement } from '@/types/project';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ArrowRight, BarChart3, TrendingUp, DollarSign, Coins, FileText, 
  Home, Building2, CheckCircle2, Clock, ShieldCheck, PieChart as PieIcon,
  TrendingDown, Percent, Calendar
} from 'lucide-react';
import { 
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { cn } from "@/lib/utils";

interface ReportsProps {
  projects: Project[];
  housesData: Record<string, any>;
}

const COLORS = ['#10b981', '#f43f5e', '#a855f7', '#fbbf24', '#3b82f6', '#64748b'];

const Reports = ({ projects, housesData }: ReportsProps) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || 'all');

  // تصفية المشاريع المتاحة
  const activeProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId);
  }, [projects, selectedProjectId]);

  // جلب كافة العناصر للمشروع المحدد أو لجميع المشاريع
  const elementsToAnalyze = useMemo(() => {
    if (selectedProjectId === 'all') {
      // دمج كافة العناصر من جميع المشاريع
      return projects.reduce((acc, p) => [...acc, ...(p.elements || [])], [] as MapElement[]);
    }
    return activeProject?.elements || [];
  }, [projects, activeProject, selectedProjectId]);

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

  // 1. حساب الإحصائيات العامة والمالية
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

    elementsToAnalyze.forEach(el => {
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
  }, [elementsToAnalyze, housesData]);

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

  // 3. بيانات أداء الزونات والبلوكات (Bar Chart)
  const zonePerformanceData = useMemo(() => {
    const zones: Record<string, { total: number, sold: number, investment: number }> = {};

    elementsToAnalyze.forEach(el => {
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

    return Object.entries(zones).map(([name, z]) => ({
      name: `زون ${name}`,
      'إجمالي الوحدات': z.total,
      'المباعة': z.sold,
      'الاستثمار': z.investment,
      'نسبة المبيعات %': z.total > 0 ? Math.round(((z.sold + z.investment) / z.total) * 100) : 0
    })).slice(0, 10); // عرض أول 10 زونات كحد أقصى
  }, [elementsToAnalyze, housesData]);

  // 4. بيانات منحنى المبيعات الزمني (Line Chart)
  const salesTrendData = useMemo(() => {
    const monthlySales: Record<string, { count: number, revenueIQD: number, revenueUSD: number }> = {};

    const processUnitDate = (unitKey: string) => {
      const data = housesData[unitKey];
      if (data && (data.status === 'sold' || data.status === 'investment') && data.saleDate) {
        const date = new Date(data.saleDate);
        if (!isNaN(date.getTime())) {
          const monthKey = date.toLocaleString('ar-EG', { month: 'long', year: 'numeric' });
          if (!monthlySales[monthKey]) {
            monthlySales[monthKey] = { count: 0, revenueIQD: 0, revenueUSD: 0 };
          }
          monthlySales[monthKey].count++;
          
          const priceValue = parsePrice(data.price);
          const cType = getCurrencyType(data.currency);
          if (cType === 'IQD') monthlySales[monthKey].revenueIQD += priceValue;
          else monthlySales[monthKey].revenueUSD += priceValue;
        }
      }
    };

    elementsToAnalyze.forEach(el => {
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

    return Object.entries(monthlySales).map(([month, data]) => ({
      name: month,
      'عدد الوحدات المباعة': data.count,
      'الإيرادات (مليون د.ع)': Math.round(data.revenueIQD / 1000000),
      'الإيرادات (ألف $)': Math.round(data.revenueUSD / 1000)
    })).reverse(); // ترتيب زمني تصاعدي
  }, [elementsToAnalyze, housesData]);

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

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
              <CardDescription className="text-xs font-bold">مقارنة الوحدات المباعة والاستثمارية مقابل الإجمالي لكل زون</CardDescription>
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
          
          {/* منحنى المبيعات الزمني */}
          <Card className="rounded-[2rem] border-slate-100 shadow-sm bg-white lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <TrendingUp className="text-indigo-600 w-5 h-5" />
                منحنى المبيعات الزمني والإيرادات
              </CardTitle>
              <CardDescription className="text-xs font-bold">تطور حجم المبيعات شهرياً</CardDescription>
            </CardHeader>
            <CardContent className="h-80">
              {salesTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={salesTrendData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11, fontWeight: 'bold' }} />
                    <Line type="monotone" dataKey="عدد الوحدات المباعة" stroke="#3b82f6" strokeWidth={3} activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey="الإيرادات (مليون د.ع)" stroke="#10b981" strokeWidth={2} />
                    <Line type="monotone" dataKey="الإيرادات (ألف $)" stroke="#fbbf24" strokeWidth={2} />
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
                    <span>{stats.receivedTabo} وحدة</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${stats.total > 0 ? (stats.receivedTabo / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-indigo-600">قيد الترويج:</span>
                    <span>{stats.promotedTabo} وحدة</span>
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
                    <span>{stats.receivedUnit} وحدة</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-sky-500 h-full" style={{ width: `${stats.total > 0 ? (stats.receivedUnit / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-rose-400">غير مستلم بعد:</span>
                    <span>{stats.notReceivedUnit} وحدة</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div className="bg-rose-400 h-full" style={{ width: `${stats.total > 0 ? (stats.notReceivedUnit / stats.total) * 100 : 0}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
};

export default Reports;