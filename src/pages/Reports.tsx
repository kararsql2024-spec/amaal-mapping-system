"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight, TrendingUp, Building2, ShieldCheck, PieChart as PieIcon,
  Filter, Tags, AlertTriangle, RefreshCcw
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from '@/utils/toast';
import { AppShell, Panel, StatGrid, StatCell, EmptyState, LoadingBlock, SegmentedControl } from '@/components/layout/AppShell';
import {
  chartAxis, chartGrid, chartMargin, formatAxisValue,
  ChartTooltip, ChartLegend, ChartEmpty, Meter,
} from '@/components/charts/chart-kit';
import { formatNumber, parsePrice, getCurrencyType } from '@/lib/format';
import { STATUS_META, PRIMARY_STATUSES } from '@/lib/unit-status';
import { palette } from '@/lib/theme';

interface ReportsProps {
  projects: Project[];
  /** تمرّرها App لكن الصفحة تجلب بياناتها بنفسها. */
  housesData?: Record<string, any>;
}

const Reports = ({ projects }: ReportsProps) => {
  const navigate = useNavigate();
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [housesData, setHousesData] = useState<Record<string, any>>({});
  const [fetchedElements, setFetchedElements] = useState<MapElement[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [hasAccess, setHasAccess] = useState<boolean>(true);
  const [checkingAccess, setCheckingAccess] = useState<boolean>(true);
  const [retryTrigger, setRetryTrigger] = useState<number>(0);

  // حالات الفلترة المخصصة
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');

  // حالة التبديل بين المنازل والعمارات في مخطط أداء المبيعات
  const [salesViewMode, setSalesViewMode] = useState<'houses' | 'towers'>('houses');

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
            .select('id, name, elements');
          if (projErr) throw projErr;
          if (projData) {
            projData.forEach(p => {
              if (p.elements && Array.isArray(p.elements)) {
                // نقوم بحقن اسم المشروع ومعرفه داخل العناصر لتسهيل التحليل المدمج لاحقاً
                const elementsWithProjectInfo = (p.elements as MapElement[]).map(el => ({
                  ...el,
                  _projectName: p.name,
                  _projectId: p.id
                }));
                elementsList = [...elementsList, ...elementsWithProjectInfo];
              }
            });
          }
        } else {
          const { data: projData, error: projErr } = await supabase
            .from('projects')
            .select('id, name, elements')
            .eq('id', selectedProjectId)
            .single();
          if (projErr) throw projErr;
          if (projData && projData.elements && Array.isArray(projData.elements)) {
            const elementsWithProjectInfo = (projData.elements as MapElement[]).map(el => ({
              ...el,
              _projectName: projData.name,
              _projectId: projData.id
            }));
            elementsList = elementsWithProjectInfo;
          }
        }
        setFetchedElements(elementsList);

        // 2. جلب حقول محددة من جدول المبيعات وتجنب جلب كائن الـ data بالكامل لاستبعاد الملاحظات المتراكمة تماماً
        let allUnits: any[] = [];
        let from = 0;
        const step = 1000;
        let hasMore = true;

        while (hasMore) {
          let query = supabase
            .from('houses_data')
            .select('unit_key, project_id, status:data->>status, taboStatus:data->>taboStatus, handoverDate:data->>handoverDate, price:data->>price, currency:data->>currency, saleDate:data->>saleDate')
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
        allUnits.forEach((u: any) => {
          formatted[u.unit_key] = {
            status: u.status || 'available',
            taboStatus: u.taboStatus || 'غير مروج',
            handoverDate: u.handoverDate || '',
            price: u.price || '',
            currency: u.currency || 'IQD',
            saleDate: u.saleDate || ''
          };
        });
        setHousesData(formatted);
        showSuccess("تم تحديث بيانات التقارير بنجاح وبأعلى أداء");
      } catch (err) {
        console.error("Error fetching reports data:", err);
        showError("فشل الاتصال بقاعدة البيانات. يرجى التحقق من اتصال الإنترنت وإعادة المحاولة.");
      } finally {
        setLoading(false);
      }
    };

    fetchReportsData();
  }, [selectedProjectId, hasAccess, retryTrigger]);

  // استخراج الزونات والأصناف والمساحات المتوفرة ديناميكياً من العناصر المجلوبة للفلترة
  const { availableZones, availableClasses, availableSizes } = useMemo(() => {
    const zones = new Set<string>();
    const classes = new Set<string>();
    const sizes = new Set<number>();

    fetchedElements.forEach(el => {
      if (el.type === 'house') {
        const parts = el.label.split('-');
        if (parts[0]) zones.add(parts[0]);
        if (parts.length >= 3) {
          const typeMatch = parts[2].match(/[a-zA-Z]+/);
          if (typeMatch) classes.add(typeMatch[0]);
        }
      } else if (el.type === 'tower') {
        const floors = el.floors || 1;
        const aptsPerFloor = el.apartmentsPerFloor || 1;
        for (let f = 1; f <= floors; f++) {
          for (let a = 1; a <= aptsPerFloor; a++) {
            const key = `${el.id}_F${f}_A${a}`;
            const data = housesData[key];
            if (data?.status === 'frozen_hidden') continue;

            const size = f === 1 
              ? (el.groundFloorSizes?.[a - 1] || 0) 
              : (el.typicalFloorSizes?.[a - 1] || 0);
            if (size > 0) {
              sizes.add(size);
            }
          }
        }
      }
    });

    return {
      availableZones: Array.from(zones).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      availableClasses: Array.from(classes).sort(),
      availableSizes: Array.from(sizes).sort((a, b) => a - b)
    };
  }, [fetchedElements, housesData]);

  // إعادة تعيين الفلاتر الفرعية عند تغيير المشروع المستهدف
  useEffect(() => {
    setSelectedZone('all');
    setSelectedClass('all');
    setSelectedSize('all');
    setSalesViewMode('houses');
  }, [selectedProjectId]);

  // تصفية العناصر بناءً على الفلاتر المحددة
  const filteredElementsForGlobal = useMemo(() => {
    return fetchedElements.filter(el => {
      if (el.type === 'house') {
        // فلترة الصنف للمنازل
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

        // فلترة الزون للمنازل
        if (selectedZone !== 'all') {
          const parts = el.label.split('-');
          const zone = parts[0] || '';
          if (zone !== selectedZone) return false;
        }

        // المنازل لا تتأثر بفلتر مساحة الشقة
        if (selectedSize !== 'all') return false;
      }

      if (el.type === 'tower') {
        // العمارات لا تتأثر بفلاتر الزون أو الصنف الخاصة بالمنازل
        if (selectedZone !== 'all' || selectedClass !== 'all') return false;
      }

      return true;
    });
  }, [fetchedElements, selectedZone, selectedClass, selectedSize]);

  // 1. حساب الإحصائيات العامة والمالية المدمجة (منازل وشقق معاً) بناءً على الفلترة
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

    const processUnit = (unitKey: string, sizeOfApt?: number) => {
      // إذا كان هناك فلتر مساحة محدد، والشقة لا تطابق هذه المساحة، نتجاهلها
      if (selectedSize !== 'all' && sizeOfApt !== undefined && sizeOfApt !== parseFloat(selectedSize)) {
        return;
      }

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
            const key = `${el.id}_F${f}_A${a}`;
            const size = f === 1 
              ? (el.groundFloorSizes?.[a - 1] || 0) 
              : (el.typicalFloorSizes?.[a - 1] || 0);
            processUnit(key, size);
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
  }, [filteredElementsForGlobal, housesData, selectedSize]);

  // 2. بيانات مخطط توزيع الحالات (Pie Chart)
  const statusDistributionData = useMemo(() => {
    return PRIMARY_STATUSES.map(key => ({
      name: STATUS_META[key].label,
      value: stats[key],
      color: STATUS_META[key].chart,
    })).filter(item => item.value > 0);
  }, [stats]);

  // 3. بيانات أداء المبيعات (Bar Chart) - ذكي وتفاعلي حسب المشروع المختار
  const salesPerformanceData = useMemo(() => {
    if (selectedProjectId === 'all') {
      // السيناريو الأول: كافة المشاريع المدمجة -> العرض يكون حسب المشاريع
      const projectStats: Record<string, { name: string, total: number, sold: number, investment: number }> = {};

      fetchedElements.forEach(el => {
        const projId = el._projectId || 'unknown';
        const projName = el._projectName || 'مشروع غير معروف';

        if (!projectStats[projId]) {
          projectStats[projId] = { name: projName, total: 0, sold: 0, investment: 0 };
        }

        const processUnit = (unitKey: string) => {
          const data = housesData[unitKey] || { status: 'available' };
          if (data.status === 'frozen_hidden') return;

          projectStats[projId].total++;
          if (data.status === 'sold') projectStats[projId].sold++;
          if (data.status === 'investment') projectStats[projId].investment++;
        };

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

      return Object.values(projectStats).map(p => ({
        name: p.name,
        'إجمالي الوحدات': p.total,
        'المباعة': p.sold,
        'الاستثمار': p.investment,
        'نسبة المبيعات %': p.total > 0 ? Math.round(((p.sold + p.investment) / p.total) * 100) : 0
      }));
    } else {
      // السيناريو الثاني: مشروع محدد -> العرض يكون حسب اختيار المستخدم (منازل أو عمارات)
      if (salesViewMode === 'houses') {
        // عرض المنازل حسب الزونات
        const zones: Record<string, { total: number, sold: number, investment: number }> = {};

        fetchedElements.forEach(el => {
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

        const sortedZones = Object.entries(zones).sort((a, b) => {
          return a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' });
        });

        return sortedZones.map(([name, z]) => ({
          name: `زون ${name}`,
          'إجمالي الوحدات': z.total,
          'المباعة': z.sold,
          'الاستثمار': z.investment,
          'نسبة المبيعات %': z.total > 0 ? Math.round(((z.sold + z.investment) / z.total) * 100) : 0
        }));
      } else {
        // عرض العمارات (كل عمارة على حدة)
        const towersDataList: any[] = [];

        fetchedElements.forEach(el => {
          if (el.type === 'tower') {
            let total = 0;
            let sold = 0;
            let investment = 0;

            const floors = el.floors || 0;
            const aptsPerFloor = el.apartmentsPerFloor || 0;
            for (let f = 1; f <= floors; f++) {
              for (let a = 1; a <= aptsPerFloor; a++) {
                const key = `${el.id}_F${f}_A${a}`;
                const data = housesData[key] || { status: 'available' };
                if (data.status === 'frozen_hidden') continue;

                total++;
                if (data.status === 'sold') sold++;
                if (data.status === 'investment') investment++;
              }
            }

            towersDataList.push({
              name: el.label,
              'إجمالي الوحدات': total,
              'المباعة': sold,
              'الاستثمار': investment,
              'نسبة المبيعات %': total > 0 ? Math.round(((sold + investment) / total) * 100) : 0
            });
          }
        });

        return towersDataList.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
      }
    }
  }, [selectedProjectId, fetchedElements, housesData, salesViewMode]);

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

  // 5. تقرير متوسط أسعار الأصناف للمنازل (الأسلوب المنفصل)
  const averagePriceDataHouses = useMemo(() => {
    const classPrices: Record<string, { sumIQD: number, countIQD: number, sumUSD: number, countUSD: number }> = {};

    fetchedElements.filter(el => el.type === 'house').forEach(el => {
      const parts = el.label.split('-');
      let uClass = "غير محدد";
      if (parts.length >= 3) {
        const typeMatch = parts[2].match(/[a-zA-Z]+/);
        uClass = typeMatch ? typeMatch[0] : 'غير محدد';
      }

      // آلية العرض الذكية لكافة المشاريع المدمجة: إلحاق اسم المشروع بالصنف
      const displayName = selectedProjectId === 'all' 
        ? `${el._projectName} - صنف ${uClass}` 
        : `صنف ${uClass}`;

      const data = housesData[el.id];
      if (data && (data.status === 'sold' || data.status === 'investment')) {
        const priceValue = parsePrice(data.price);
        if (priceValue > 0) {
          const cType = getCurrencyType(data.currency);
          if (!classPrices[displayName]) {
            classPrices[displayName] = { sumIQD: 0, countIQD: 0, sumUSD: 0, countUSD: 0 };
          }
          if (cType === 'IQD') {
            classPrices[displayName].sumIQD += priceValue;
            classPrices[displayName].countIQD++;
          } else {
            classPrices[displayName].sumUSD += priceValue;
            classPrices[displayName].countUSD++;
          }
        }
      }
    });

    return Object.entries(classPrices).map(([name, data]) => ({
      name: name,
      'متوسط السعر (د.ع)': data.countIQD > 0 ? Math.round(data.sumIQD / data.countIQD) : 0,
      'متوسط السعر ($)': data.countUSD > 0 ? Math.round(data.sumUSD / data.countUSD) : 0,
    })).filter(item => item['متوسط السعر (د.ع)'] > 0 || item['متوسط السعر ($)'] > 0);
  }, [fetchedElements, housesData, selectedProjectId]);

  // 6. تقرير متوسط أسعار الشقق حسب المساحة (الأسلوب المنفصل الجديد)
  const averagePriceDataApartments = useMemo(() => {
    const sizePrices: Record<string, { sumIQD: number, countIQD: number, sumUSD: number, countUSD: number }> = {};

    fetchedElements.filter(el => el.type === 'tower').forEach(el => {
      const floors = el.floors || 1;
      const aptsPerFloor = el.apartmentsPerFloor || 1;

      for (let f = 1; f <= floors; f++) {
        for (let a = 1; a <= aptsPerFloor; a++) {
          const key = `${el.id}_F${f}_A${a}`;
          const data = housesData[key];
          if (data && (data.status === 'sold' || data.status === 'investment')) {
            const size = f === 1 
              ? (el.groundFloorSizes?.[a - 1] || 0) 
              : (el.typicalFloorSizes?.[a - 1] || 0);
            
            if (size > 0) {
              // آلية العرض الذكية لكافة المشاريع المدمجة: إلحاق اسم المشروع بالمساحة
              const displayName = selectedProjectId === 'all'
                ? `${el._projectName} - مساحة ${size} م²`
                : `مساحة ${size} م²`;

              const priceValue = parsePrice(data.price);
              if (priceValue > 0) {
                const cType = getCurrencyType(data.currency);
                if (!sizePrices[displayName]) {
                  sizePrices[displayName] = { sumIQD: 0, countIQD: 0, sumUSD: 0, countUSD: 0 };
                }
                if (cType === 'IQD') {
                  sizePrices[displayName].sumIQD += priceValue;
                  sizePrices[displayName].countIQD++;
                } else {
                  sizePrices[displayName].sumUSD += priceValue;
                  sizePrices[displayName].countUSD++;
                }
              }
            }
          }
        }
      }
    });

    return Object.entries(sizePrices).map(([name, data]) => ({
      name: name,
      'متوسط السعر (د.ع)': data.countIQD > 0 ? Math.round(data.sumIQD / data.countIQD) : 0,
      'متوسط السعر ($)': data.countUSD > 0 ? Math.round(data.sumUSD / data.countUSD) : 0,
    })).filter(item => item['متوسط السعر (د.ع)'] > 0 || item['متوسط السعر ($)'] > 0);
  }, [fetchedElements, housesData, selectedProjectId]);

  const salesRatio = stats.total > 0
    ? Math.round(((stats.sold + stats.investment) / stats.total) * 100)
    : 0;

  const statCells: StatCell[] = [
    {
      label: 'إجمالي المبيعات المحققة (د.ع)',
      value: formatNumber(stats.revenueIQD),
      hint: `محجوز متوقع ${formatNumber(stats.expectedRevenueIQD)} د.ع`,
    },
    {
      label: 'إجمالي المبيعات المحققة ($)',
      value: `$${formatNumber(stats.revenueUSD)}`,
      hint: `محجوز متوقع $${formatNumber(stats.expectedRevenueUSD)}`,
    },
    {
      label: 'نسبة المبيعات العامة',
      value: `${salesRatio}%`,
      hint: `مباع ${stats.sold} · استثمار ${stats.investment}`,
    },
    {
      label: 'الوحدات المتاحة للبيع',
      value: formatNumber(stats.available),
      hint: `من أصل ${formatNumber(stats.total)} وحدة`,
    },
  ];

  const hasSubFilters =
    selectedZone !== 'all' || selectedClass !== 'all' || selectedSize !== 'all';

  const priceChartProps = {
    grid: chartGrid,
    axis: chartAxis,
  };

  const renderPriceChart = (data: typeof averagePriceDataHouses) => (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={chartMargin} barCategoryGap="28%">
        <CartesianGrid {...priceChartProps.grid} />
        <XAxis dataKey="name" {...priceChartProps.axis} interval={0} height={48} angle={-18} textAnchor="end" />
        <YAxis tickFormatter={formatAxisValue} width={64} {...priceChartProps.axis} />
        <Tooltip
          cursor={{ fill: palette.surfaceSunken }}
          content={
            <ChartTooltip
              format={(value, name) =>
                name.includes('$') ? `$${formatNumber(value)}` : `${formatNumber(value)} د.ع`
              }
            />
          }
        />
        <Bar dataKey="متوسط السعر (د.ع)" fill={STATUS_META.available.chart} maxBarSize={26} />
        <Bar dataKey="متوسط السعر ($)" fill={STATUS_META.pending.chart} maxBarSize={26} />
      </BarChart>
    </ResponsiveContainer>
  );

  const priceLegend = (
    <ChartLegend
      items={[
        { name: 'متوسط السعر (د.ع)', color: STATUS_META.available.chart },
        { name: 'متوسط السعر ($)', color: STATUS_META.pending.chart },
      ]}
    />
  );

  if (checkingAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-[13px] text-fg-muted">
        جاري التحقق من صلاحيات الوصول
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-5">
        <div className="w-full max-w-md space-y-6 border border-line bg-surface p-8 text-center">
          <AlertTriangle size={26} strokeWidth={1.25} className="mx-auto text-status-sold" />
          <div className="space-y-2">
            <h2 className="text-lg font-normal text-fg">لا تملك صلاحية الوصول</h2>
            <p className="text-[12px] leading-relaxed text-fg-muted">
              تم تقييد وصول هذا القسم إلى لوحة التقارير والتحليلات المالية من قبل الإدارة.
              يرجى مراجعة المسؤول للحصول على الصلاحية.
            </p>
          </div>
          <Button onClick={() => navigate('/')} className="w-full">
            العودة للرئيسية
          </Button>
        </div>
      </div>
    );
  }

  return (
    <AppShell
      brandSubtitle="التقارير والتحليلات"
      nav={
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-1.5 text-fg-secondary">
            <ArrowRight size={14} />
            الرئيسية
          </Button>
        </Link>
      }
      actions={
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="h-8 w-[200px] text-[12px]">
            <SelectValue placeholder="اختر المشروع" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كافة المشاريع المدمجة</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      {/* Filter bar */}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-y border-line py-3">
        <div className="flex items-center gap-2 text-fg-muted">
          <Filter size={13} />
          <span className="eyebrow">تصفية</span>
        </div>

        <label className="flex items-center gap-2">
          <span className="text-[11px] text-fg-muted">الزون</span>
          <Select value={selectedZone} onValueChange={setSelectedZone}>
            <SelectTrigger className="h-8 w-[130px] text-[12px]">
              <SelectValue placeholder="كل الزونات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الزونات</SelectItem>
              {availableZones.map(z => (
                <SelectItem key={z} value={z}>زون {z}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-[11px] text-fg-muted">صنف المنزل</span>
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="h-8 w-[130px] text-[12px]">
              <SelectValue placeholder="كل الأصناف" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الأصناف</SelectItem>
              {availableClasses.map(c => (
                <SelectItem key={c} value={c}>صنف {c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-[11px] text-fg-muted">مساحة الشقة</span>
          <Select value={selectedSize} onValueChange={setSelectedSize}>
            <SelectTrigger className="h-8 w-[130px] text-[12px]">
              <SelectValue placeholder="كل المساحات" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل المساحات</SelectItem>
              {availableSizes.map(s => (
                <SelectItem key={s} value={s.toString()}>{s} م²</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>

        {hasSubFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setSelectedZone('all'); setSelectedClass('all'); setSelectedSize('all'); }}
            className="ms-auto text-status-sold hover:text-status-sold"
          >
            إعادة تعيين
          </Button>
        )}
      </div>

      {loading ? (
        <div className="mt-10">
          <LoadingBlock label="جاري تحميل وتحليل البيانات المالية" />
        </div>
      ) : fetchedElements.length === 0 ? (
        <div className="mt-10">
          <EmptyState
            icon={<AlertTriangle size={26} strokeWidth={1.25} />}
            title="لم يتم تحميل أي بيانات"
            description="تعذّر الاتصال بقاعدة البيانات أو لا توجد مخططات محمّلة لهذا المشروع."
            action={
              <Button variant="outline" onClick={() => setRetryTrigger(prev => prev + 1)} className="gap-2">
                <RefreshCcw size={14} /> إعادة المحاولة
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-10">
            <StatGrid items={statCells} columns={4} />
          </div>

          {/* Distribution + performance */}
          <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              icon={<PieIcon size={14} />}
              title="توزيع حالات الوحدات"
              description="نسبة كل حالة من إجمالي الوحدات المحتسبة"
              className="lg:col-span-1"
              bodyClassName="flex flex-col gap-4 p-5"
            >
              <div className="h-52">
                {statusDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusDistributionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={82}
                        paddingAngle={1}
                        dataKey="value"
                        stroke={palette.surface}
                        strokeWidth={1}
                      >
                        {statusDistributionData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip format={(v) => `${formatNumber(v)} وحدة`} />} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty>لا توجد وحدات لعرضها</ChartEmpty>
                )}
              </div>
              <div className="divide-y divide-line border-t border-line">
                {statusDistributionData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 py-2 text-[11px]">
                    <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="text-fg-secondary">{entry.name}</span>
                    <span className="ms-auto font-mono tabular-nums text-fg">
                      {formatNumber(entry.value)}
                    </span>
                    <span className="w-10 text-end font-mono tabular-nums text-fg-faint">
                      {stats.total > 0 ? `${Math.round((entry.value / stats.total) * 100)}%` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              icon={<Building2 size={14} />}
              title={
                selectedProjectId === 'all'
                  ? 'أداء المبيعات حسب المشاريع'
                  : salesViewMode === 'houses'
                    ? 'أداء مبيعات المنازل حسب الزونات'
                    : 'أداء مبيعات العمارات'
              }
              description={
                selectedProjectId === 'all'
                  ? 'مقارنة الوحدات المباعة والاستثمارية مقابل الإجمالي لكل مشروع'
                  : salesViewMode === 'houses'
                    ? 'مقارنة الوحدات المباعة والاستثمارية مقابل الإجمالي لكل زون'
                    : 'مقارنة الوحدات المباعة والاستثمارية لكل عمارة على حدة'
              }
              actions={
                selectedProjectId !== 'all' ? (
                  <SegmentedControl
                    value={salesViewMode}
                    onChange={(value) => setSalesViewMode(value)}
                    options={[
                      { value: 'houses', label: 'المنازل' },
                      { value: 'towers', label: 'العمارات' },
                    ]}
                  />
                ) : undefined
              }
              className="lg:col-span-2"
              bodyClassName="flex flex-col gap-4 p-5"
            >
              <div className="h-64">
                {salesPerformanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesPerformanceData} margin={chartMargin} barCategoryGap="30%">
                      <CartesianGrid {...chartGrid} />
                      <XAxis dataKey="name" {...chartAxis} interval={0} />
                      <YAxis tickFormatter={formatAxisValue} width={48} {...chartAxis} />
                      <Tooltip cursor={{ fill: palette.surfaceSunken }} content={<ChartTooltip />} />
                      <Bar dataKey="إجمالي الوحدات" fill={palette.line} maxBarSize={22} />
                      <Bar dataKey="المباعة" fill={STATUS_META.sold.chart} maxBarSize={22} />
                      <Bar dataKey="الاستثمار" fill={STATUS_META.investment.chart} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty>لا توجد بيانات كافية للعرض</ChartEmpty>
                )}
              </div>
              <ChartLegend
                className="border-t border-line pt-4"
                items={[
                  { name: 'إجمالي الوحدات', color: palette.line },
                  { name: 'المباعة', color: STATUS_META.sold.chart },
                  { name: 'الاستثمار', color: STATUS_META.investment.chart },
                ]}
              />
            </Panel>
          </div>

          {/* Trend + legal */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Panel
              icon={<TrendingUp size={14} />}
              title="منحنى المبيعات عبر الزمن"
              description="تطور حجم المبيعات والإيرادات الفعلية مرتبة من الأقدم للأحدث"
              className="lg:col-span-2"
              bodyClassName="flex flex-col gap-4 p-5"
            >
              <div className="h-64">
                {salesTrendData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={salesTrendData} margin={chartMargin}>
                      <CartesianGrid {...chartGrid} />
                      <XAxis dataKey="name" {...chartAxis} />
                      <YAxis tickFormatter={formatAxisValue} width={64} {...chartAxis} />
                      <Tooltip
                        cursor={{ stroke: palette.lineStrong, strokeWidth: 1 }}
                        content={
                          <ChartTooltip
                            format={(value, name) => {
                              if (name.includes('د.ع')) return `${formatNumber(value)} د.ع`;
                              if (name.includes('$')) return `$${formatNumber(value)}`;
                              return formatNumber(value);
                            }}
                          />
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="عدد الوحدات المباعة"
                        stroke={palette.fg}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="الإيرادات (د.ع)"
                        stroke={STATUS_META.available.chart}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="الإيرادات ($)"
                        stroke={STATUS_META.pending.chart}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 3, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <ChartEmpty>
                    لا توجد بيانات مبيعات زمنية كافية — تأكد من إدخال تواريخ البيع للوحدات
                  </ChartEmpty>
                )}
              </div>
              <ChartLegend
                className="border-t border-line pt-4"
                items={[
                  { name: 'عدد الوحدات المباعة', color: palette.fg },
                  { name: 'الإيرادات (د.ع)', color: STATUS_META.available.chart },
                  { name: 'الإيرادات ($)', color: STATUS_META.pending.chart },
                ]}
              />
            </Panel>

            <Panel
              icon={<ShieldCheck size={14} />}
              title="الموقف القانوني والاستلام"
              description="متابعة معاملات الطابو وتسليم المفاتيح"
              className="lg:col-span-1"
              bodyClassName="space-y-7 p-5"
            >
              <div className="space-y-4">
                <div className="eyebrow">موقف معاملات الطابو</div>
                <Meter label="مستلم الطابو" value={stats.receivedTabo} total={stats.total} color={STATUS_META.available.chart} />
                <Meter label="قيد الترويج" value={stats.promotedTabo} total={stats.total} color={STATUS_META.reserved.chart} />
                <Meter label="غير مروج" value={stats.notPromotedTabo} total={stats.total} color={palette.lineStrong} />
              </div>

              <div className="space-y-4 border-t border-line pt-6">
                <div className="eyebrow">موقف تسليم الوحدات</div>
                <Meter label="تم تسليم المفتاح" value={stats.receivedUnit} total={stats.total} color={STATUS_META.pending.chart} />
                <Meter label="غير مستلم بعد" value={stats.notReceivedUnit} total={stats.total} color={STATUS_META.sold.chart} />
              </div>
            </Panel>
          </div>

          {/* Average prices */}
          <Panel
            className="mt-6"
            icon={<Tags size={14} />}
            title="تحليل متوسط أسعار الوحدات السكنية"
            description="متوسط القيمة الفعلية للوحدات المباعة والمستثمرة بالدينار والدولار"
            actions={
              <div className="flex items-center gap-5 border border-line px-4 py-2">
                <div className="text-end">
                  <div className="eyebrow">إجمالي د.ع</div>
                  <div className="mt-0.5 font-mono text-[13px] tabular-nums text-fg">
                    {formatNumber(stats.revenueIQD)}
                  </div>
                </div>
                <span className="h-7 w-px bg-line" />
                <div className="text-end">
                  <div className="eyebrow">إجمالي $</div>
                  <div className="mt-0.5 font-mono text-[13px] tabular-nums text-fg">
                    {formatNumber(stats.revenueUSD)}
                  </div>
                </div>
              </div>
            }
            bodyClassName="p-5"
          >
            <Tabs defaultValue="houses_prices" className="w-full">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <TabsList>
                  <TabsTrigger value="houses_prices">أصناف المنازل</TabsTrigger>
                  <TabsTrigger value="apartments_prices">مساحات الشقق</TabsTrigger>
                </TabsList>
                {priceLegend}
              </div>

              <TabsContent value="houses_prices" className="mt-5 h-80">
                {averagePriceDataHouses.length > 0
                  ? renderPriceChart(averagePriceDataHouses)
                  : <ChartEmpty>لا توجد مبيعات منازل مسجلة بأسعار صالحة</ChartEmpty>}
              </TabsContent>

              <TabsContent value="apartments_prices" className="mt-5 h-80">
                {averagePriceDataApartments.length > 0
                  ? renderPriceChart(averagePriceDataApartments)
                  : <ChartEmpty>لا توجد مبيعات شقق مسجلة بأسعار صالحة</ChartEmpty>}
              </TabsContent>
            </Tabs>
          </Panel>
        </>
      )}
    </AppShell>
  );
};

export default Reports;
