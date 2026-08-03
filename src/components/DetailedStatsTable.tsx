"use client";

import React, { useMemo, useState } from 'react';
import { MapElement } from '@/types/project';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Building2, Home, BarChart3, Filter, FileSpreadsheet, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { showSuccess } from "@/utils/toast";
import * as XLSX from 'xlsx';

interface DetailedStatsTableProps {
  elements: MapElement[];
  housesData: Record<string, any>;
  permissions?: any;
}

const DetailedStatsTable = ({ elements, housesData, permissions }: DetailedStatsTableProps) => {
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedSize, setSelectedSize] = useState<string>("all");

  // الصلاحيات الافتراضية
  const perms = permissions || {
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
    showStatsPriceUSD: true
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US').format(Math.round(num));
  };

  const getCurrencyType = (curr: any) => {
    if (!curr) return 'IQD';
    const c = curr.toString().trim().toLowerCase();
    if (c.includes('دينار') || c.includes('iqd') || c.includes('د.ع') || c.includes('عراقي')) return 'IQD';
    if (c.includes('دولار') || c.includes('usd') || c.includes('$')) return 'USD';
    return 'IQD'; 
  };

  const parsePrice = (price: any) => {
    if (price === null || price === undefined) return 0;
    const cleaned = price.toString().replace(/,/g, '').replace(/[^\d.]/g, '');
    const val = parseFloat(cleaned);
    return isNaN(val) ? 0 : val;
  };

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    elements.filter(el => el.type === 'house').forEach(house => {
      const parts = house.label.split('-');
      if (parts.length >= 3) {
        const typeMatch = parts[2].match(/[a-zA-Z]+/);
        if (typeMatch) types.add(typeMatch[0]);
      }
    });
    return Array.from(types).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }, [elements]);

  const availableSizes = useMemo(() => {
    const sizes = new Set<number>();
    elements.filter(el => el.type === 'tower').forEach(tower => {
      for (let f = 1; f <= (tower.floors || 1); f++) {
        for (let a = 1; a <= (tower.apartmentsPerFloor || 1); a++) {
          const key = `${tower.id}_F${f}_A${a}`;
          const data = housesData[key];
          if (data?.status === 'frozen_hidden') continue;
          
          const size = f === 1 
            ? (tower.groundFloorSizes?.[a - 1] || 0) 
            : (tower.typicalFloorSizes?.[a - 1] || 0);
          if (size > 0) {
            sizes.add(size);
          }
        }
      }
    });
    return Array.from(sizes).sort((a, b) => a - b);
  }, [elements, housesData]);

  const towerStats = useMemo(() => {
    const stats: any[] = [];
    elements.filter(el => el.type === 'tower').forEach(tower => {
      const floorsData: any[] = [];
      const towerTotal = { 
        available: 0, sold: 0, investment: 0, pending: 0, reserved: 0, total: 0, priceIQD: 0, priceUSD: 0,
        promoted: 0, notPromoted: 0, receivedTabo: 0, receivedUnit: 0, notReceivedUnit: 0
      };
      
      for (let f = 1; f <= (tower.floors || 1); f++) {
        const floorLabel = f === 1 ? "الأرضي" : `الطابق ${f - 1}`;
        const sizesGroup: Record<number, any> = {};
        
        for (let a = 1; a <= (tower.apartmentsPerFloor || 1); a++) {
          const key = `${tower.id}_F${f}_A${a}`;
          const data = housesData[key] || { status: 'available' };
          
          if (data.status === 'frozen_hidden') continue;

          const size = f === 1 
            ? (tower.groundFloorSizes?.[a - 1] || 0) 
            : (tower.typicalFloorSizes?.[a - 1] || 0);

          // فلترة حسب المساحة المحددة
          if (selectedSize !== "all" && size !== parseFloat(selectedSize)) continue;

          if (!sizesGroup[size]) {
            sizesGroup[size] = {
              available: 0, sold: 0, investment: 0, pending: 0, reserved: 0, total: 0, priceIQD: 0, priceUSD: 0,
              promoted: 0, notPromoted: 0, receivedTabo: 0, receivedUnit: 0, notReceivedUnit: 0
            };
          }

          const s = sizesGroup[size];

          if (data.status === 'sold') s.sold++;
          else if (data.status === 'investment') s.investment++;
          else if (data.status === 'pending') s.pending++;
          else if (data.status === 'reserved') s.reserved++;
          else if (data.status === 'available') s.available++;
          
          if (data.status !== 'frozen_uncounted') s.total++;

          // منطق الطابو
          const tabo = data.taboStatus?.trim();
          if (tabo === 'مروج') s.promoted++;
          else if (tabo === 'مستلم') s.receivedTabo++;
          else s.notPromoted++;

          // منطق استلام الوحدة
          if (data.handoverDate) s.receivedUnit++;
          else s.notReceivedUnit++;

          const priceValue = parsePrice(data.price);
          if (priceValue > 0) {
            const cType = getCurrencyType(data.currency);
            if (cType === 'IQD') s.priceIQD += priceValue;
            else if (cType === 'USD') s.priceUSD += priceValue;
          }
        }
        
        if (Object.keys(sizesGroup).length > 0) {
          floorsData.push({
            label: floorLabel,
            sizes: sizesGroup
          });

          Object.values(sizesGroup).forEach((s: any) => {
            towerTotal.available += s.available;
            towerTotal.sold += s.sold;
            towerTotal.investment += s.investment;
            towerTotal.pending += s.pending;
            towerTotal.reserved += s.reserved;
            towerTotal.total += s.total;
            towerTotal.priceIQD += s.priceIQD;
            towerTotal.priceUSD += s.priceUSD;
            towerTotal.promoted += s.promoted;
            towerTotal.notPromoted += s.notPromoted;
            towerTotal.receivedTabo += s.receivedTabo;
            towerTotal.receivedUnit += s.receivedUnit;
            towerTotal.notReceivedUnit += s.notReceivedUnit;
          });
        }
      }
      stats.push({ name: tower.label, floors: floorsData, totals: towerTotal });
    });
    return stats;
  }, [elements, housesData, selectedSize]);

  // ترتيب العمارات طبيعياً وأبجدياً (مثال: T1, T2, T3 ...)
  const sortedTowerStats = useMemo(() => {
    return [...towerStats].sort((a, b) => 
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [towerStats]);

  const houseStats = useMemo(() => {
    const stats: Record<string, { blocks: Record<string, Record<string, any>>, totals: any }> = {};
    
    elements.filter(el => el.type === 'house').forEach(house => {
      const parts = house.label.split('-');
      let zone = "عام";
      let block = "عام";
      let type = "غير محدد";

      if (parts.length >= 3) {
        zone = parts[0];
        block = parts[1];
        const typeMatch = parts[2].match(/[a-zA-Z]+/);
        type = typeMatch ? typeMatch[0] : 'غير محدد';
      }

      if (selectedType !== "all" && type !== selectedType) return;

      const data = housesData[house.id] || { status: 'available' };
      if (data.status === 'frozen_hidden') return;

      if (!stats[zone]) {
        stats[zone] = { 
          blocks: {}, 
          totals: { 
            available: 0, sold: 0, investment: 0, pending: 0, reserved: 0, total: 0, priceIQD: 0, priceUSD: 0,
            promoted: 0, notPromoted: 0, receivedTabo: 0, receivedUnit: 0, notReceivedUnit: 0
          } 
        };
      }
      
      if (!stats[zone].blocks[block]) stats[zone].blocks[block] = {};
      if (!stats[zone].blocks[block][type]) {
        stats[zone].blocks[block][type] = { 
          available: 0, sold: 0, investment: 0, pending: 0, reserved: 0, total: 0, priceIQD: 0, priceUSD: 0,
          promoted: 0, notPromoted: 0, receivedTabo: 0, receivedUnit: 0, notReceivedUnit: 0
        };
      }

      const s = stats[zone].blocks[block][type];
      const zt = stats[zone].totals;

      if (data.status === 'sold') { s.sold++; zt.sold++; }
      else if (data.status === 'investment') { s.investment++; zt.investment++; }
      else if (data.status === 'pending') { s.pending++; zt.pending++; }
      else if (data.status === 'reserved') { s.reserved++; zt.reserved++; }
      else if (data.status === 'available') { s.available++; zt.available++; }
      
      if (data.status !== 'frozen_uncounted') { s.total++; zt.total++; }

      // منطق الطابو
      const tabo = data.taboStatus?.trim();
      if (tabo === 'مروج') { s.promoted++; zt.promoted++; }
      else if (tabo === 'مستلم') { s.receivedTabo++; zt.receivedTabo++; }
      else { s.notPromoted++; zt.notPromoted++; }

      // منطق استلام الوحدة
      if (data.handoverDate) { s.receivedUnit++; zt.receivedUnit++; }
      else { s.notReceivedUnit++; zt.notReceivedUnit++; }

      const priceValue = parsePrice(data.price);
      if (priceValue > 0) {
        const cType = getCurrencyType(data.currency);
        if (cType === 'IQD') {
          s.priceIQD += priceValue;
          zt.priceIQD += priceValue;
        } else if (cType === 'USD') {
          s.priceUSD += priceValue;
          zt.priceUSD += priceValue;
        }
      }
    });

    return stats;
  }, [elements, housesData, selectedType]);

  // ترتيب الزونات طبيعياً وأبجدياً (مثال: Z1, Z2, Z3 ... Z10)
  const sortedHouseStats = useMemo(() => {
    return Object.entries(houseStats).sort(([zoneA], [zoneB]) => 
      zoneA.localeCompare(zoneB, undefined, { numeric: true, sensitivity: 'base' })
    );
  }, [houseStats]);

  // تصدير الإحصائيات لملف Excel
  const handleExportStatsToExcel = () => {
    try {
      const rows: any[] = [];

      rows.push(["تقرير إحصائيات المنازل"]);
      rows.push([
        "الزون", "البلوك", "الصنف", "المتاح", "المباع", "الاستثمار", "المحجوز", 
        "الحجز الأولي", "المجموع الكلي", "مروج", "غير مروج", "مستلم الطابو", "مستلم الوحدة", "غير مستلم الوحدة", "إجمالي المبيعات (د.ع)", "إجمالي المبيعات ($)"
      ]);

      sortedHouseStats.forEach(([zone, zoneData]) => {
        const sortedBlocks = Object.entries(zoneData.blocks).sort(([blockA], [blockB]) => 
          blockA.localeCompare(blockB, undefined, { numeric: true, sensitivity: 'base' })
        );
        sortedBlocks.forEach(([block, types]) => {
          const sortedTypes = Object.entries(types).sort(([typeA], [typeB]) => 
            typeA.localeCompare(typeB, undefined, { numeric: true, sensitivity: 'base' })
          );
          sortedTypes.forEach(([type, s]: [string, any]) => {
            rows.push([
              zone, block, type, s.available, s.sold, s.investment, s.reserved, 
              s.pending, s.total, s.promoted, s.notPromoted, s.receivedTabo, s.receivedUnit, s.notReceivedUnit, s.priceIQD, s.priceUSD
            ]);
          });
        });
        rows.push([
          `مجموع زون ${zone}`, "", "", zoneData.totals.available, zoneData.totals.sold, zoneData.totals.investment, 
          zoneData.totals.reserved, zoneData.totals.pending, zoneData.totals.total, zoneData.totals.promoted, 
          zoneData.totals.notPromoted, zoneData.totals.receivedTabo, zoneData.totals.receivedUnit, zoneData.totals.notReceivedUnit, 
          zoneData.totals.priceIQD, zoneData.totals.priceUSD
        ]);
        rows.push([]);
      });

      rows.push([]);
      rows.push(["تقرير إحصائيات العمارات"]);
      rows.push([
        "اسم العمارة", "الطابق", "المساحة (م²)", "المتاح", "المباع", "الاستثمار", "المحجوز", 
        "الحجز الأولي", "المجموع الكلي", "مروج", "غير مروج", "مستلم الطابو", "مستلم الوحدة", "غير مستلم الوحدة", "إجمالي المبيعات (د.ع)", "إجمالي المبيعات ($)"
      ]);

      sortedTowerStats.forEach((tower) => {
        tower.floors.forEach((floor: any) => {
          Object.entries(floor.sizes).forEach(([size, s]: [string, any]) => {
            rows.push([
              tower.name, floor.label, parseFloat(size) > 0 ? `${size} م²` : "خدمية", 
              s.available, s.sold, s.investment, s.reserved, s.pending, s.total, s.promoted, 
              s.notPromoted, s.receivedTabo, s.receivedUnit, s.notReceivedUnit, s.priceIQD, s.priceUSD
            ]);
          });
        });
        rows.push([
          `مجموع عمارة ${tower.name}`, "", "", tower.totals.available, tower.totals.sold, tower.totals.investment, 
          tower.totals.reserved, tower.totals.pending, tower.totals.total, tower.totals.promoted, 
          tower.totals.notPromoted, tower.totals.receivedTabo, tower.totals.receivedUnit, tower.totals.notReceivedUnit, 
          tower.totals.priceIQD, tower.totals.priceUSD
        ]);
        rows.push([]);
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(rows);

      ws['!dir'] = "rtl";

      XLSX.utils.book_append_sheet(wb, ws, "الإحصائيات المفصلة");
      XLSX.writeFile(wb, `تقرير_الاحصائيات_${new Date().toISOString().split('T')[0]}.xlsx`);

      showSuccess("تم تصدير الإحصائيات لملف Excel بنجاح!");
    } catch (e) {
      console.error(e);
      showSuccess("فشل تصدير الإحصائيات لملف Excel");
    }
  };

  return (
    <Card className="rounded-[2rem] border-slate-100 shadow-lg overflow-hidden bg-white">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-800">
          <BarChart3 className="text-blue-600" />
          الإحصائيات المفصلة
        </CardTitle>

        <Button 
          onClick={handleExportStatsToExcel}
          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-11 px-5 font-black text-xs gap-2 shadow-sm"
        >
          <FileSpreadsheet size={16} />
          تصدير التقرير لملف Excel
        </Button>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs defaultValue="houses" className="w-full" dir="rtl">
          <TabsList className="grid w-full grid-cols-2 mb-8 bg-slate-100 p-1 rounded-2xl h-14">
            <TabsTrigger value="houses" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Home className="w-4 h-4 ml-2" /> إحصائيات المنازل
            </TabsTrigger>
            <TabsTrigger value="towers" className="rounded-xl font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Building2 className="w-4 h-4 ml-2" /> إحصائيات العمارات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="houses" className="space-y-6">
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                <Filter size={16} className="text-blue-600" />
                <span>فلترة حسب الصنف:</span>
              </div>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[180px] rounded-xl bg-white font-bold h-10 text-xs border-slate-200">
                  <SelectValue placeholder="اختر الصنف" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold text-xs">كافة الأصناف</SelectItem>
                  {availableTypes.map(type => (
                    <SelectItem key={type} value={type} className="font-bold text-xs">صنف {type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* بطاقات الزونات المنسدلة المقفلة افتراضياً لسرعة الأداء */}
            <Accordion type="multiple" className="space-y-4">
              {sortedHouseStats.map(([zone, zoneData]) => (
                <AccordionItem 
                  key={zone} 
                  value={zone} 
                  className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm transition-all duration-200"
                >
                  <AccordionTrigger className="px-6 py-4 hover:no-underline bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
                    <div className="flex flex-wrap items-center justify-between w-full ml-4 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-7 bg-blue-600 rounded-full" />
                        <span className="text-base font-black text-slate-800">
                          الزون: <strong className="text-blue-600">{zone}</strong>
                        </span>
                      </div>

                      {/* ملخص سريع للزون يُقرأ مباشرة دون الحاجة لفتح الجدول */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border">
                          الإجمالي: <strong className="font-black">{zoneData.totals.total}</strong>
                        </span>
                        {perms.showStatsAvailable && (
                          <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                            المتاح: <strong className="font-black">{zoneData.totals.available}</strong>
                          </span>
                        )}
                        {perms.showStatsSold && (
                          <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full border border-rose-100">
                            المباع: <strong className="font-black">{zoneData.totals.sold}</strong>
                          </span>
                        )}
                        {perms.showStatsInvestment && (
                          <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-100">
                            الاستثمار: <strong className="font-black">{zoneData.totals.investment}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="p-0 border-t border-slate-100">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-right font-black whitespace-nowrap">البلوك</TableHead>
                            <TableHead className="text-right font-black whitespace-nowrap">الصنف</TableHead>
                            {perms.showStatsAvailable && <TableHead className="text-center font-black text-emerald-600 whitespace-nowrap">المتاح</TableHead>}
                            {perms.showStatsSold && <TableHead className="text-center font-black text-rose-600 whitespace-nowrap">المباع</TableHead>}
                            {perms.showStatsInvestment && <TableHead className="text-center font-black text-purple-600 whitespace-nowrap">الاستثمار</TableHead>}
                            {perms.showStatsReserved && <TableHead className="text-center font-black text-amber-600 whitespace-nowrap">محجوز</TableHead>}
                            {perms.showStatsPending && <TableHead className="text-center font-black text-blue-600 whitespace-nowrap">حجز أولي</TableHead>}
                            {perms.showStatsTotal && <TableHead className="text-center font-black bg-slate-100 whitespace-nowrap">المجموع</TableHead>}
                            {perms.showStatsPromoted && <TableHead className="text-center font-black text-indigo-600 whitespace-nowrap">مروج</TableHead>}
                            {perms.showStatsNotPromoted && <TableHead className="text-center font-black text-slate-500 whitespace-nowrap">غير مروج</TableHead>}
                            {perms.showStatsReceivedTabo && <TableHead className="text-center font-black text-amber-700 whitespace-nowrap">مستلم</TableHead>}
                            {perms.showStatsReceivedUnit && <TableHead className="text-center font-black text-sky-600 whitespace-nowrap">مستلم الوحدة</TableHead>}
                            {perms.showStatsNotReceivedUnit && <TableHead className="text-center font-black text-rose-400 whitespace-nowrap">غير مستلم الوحدة</TableHead>}
                            {perms.showStatsPriceIQD && <TableHead className="text-center font-black bg-emerald-50 text-emerald-700 whitespace-nowrap">إجمالي (د.ع)</TableHead>}
                            {perms.showStatsPriceUSD && <TableHead className="text-center font-black bg-blue-50 text-blue-700 whitespace-nowrap">إجمالي ($)</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.entries(zoneData.blocks)
                            .sort(([blockA], [blockB]) => blockA.localeCompare(blockB, undefined, { numeric: true, sensitivity: 'base' }))
                            .map(([block, types], bIdx) => (
                              Object.entries(types)
                                .sort(([typeA], [typeB]) => typeA.localeCompare(typeB, undefined, { numeric: true, sensitivity: 'base' }))
                                .map(([type, s]: [string, any], tIdx) => (
                                  <TableRow 
                                    key={`${block}-${type}`} 
                                    className={cn(
                                      "hover:opacity-80 transition-all",
                                      bIdx % 2 === 0 ? "bg-orange-50/30" : "bg-sky-50/30"
                                    )}
                                  >
                                    <TableCell className={cn("font-bold border-l", tIdx === 0 && "bg-black/5")}>
                                      {tIdx === 0 ? block : ""}
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-600">{type}</TableCell>
                                    {perms.showStatsAvailable && <TableCell className="text-center font-black">{s.available}</TableCell>}
                                    {perms.showStatsSold && <TableCell className="text-center font-black">{s.sold}</TableCell>}
                                    {perms.showStatsInvestment && <TableCell className="text-center font-black">{s.investment}</TableCell>}
                                    {perms.showStatsReserved && <TableCell className="text-center font-black">{s.reserved}</TableCell>}
                                    {perms.showStatsPending && <TableCell className="text-center font-black">{s.pending}</TableCell>}
                                    {perms.showStatsTotal && <TableCell className="text-center font-black bg-black/5">{s.total}</TableCell>}
                                    {perms.showStatsPromoted && <TableCell className="text-center font-black text-indigo-600">{s.promoted}</TableCell>}
                                    {perms.showStatsNotPromoted && <TableCell className="text-center font-black text-slate-500">{s.notPromoted}</TableCell>}
                                    {perms.showStatsReceivedTabo && <TableCell className="text-center font-black text-amber-700">{s.receivedTabo}</TableCell>}
                                    {perms.showStatsReceivedUnit && <TableCell className="text-center font-black text-sky-600">{s.receivedUnit}</TableCell>}
                                    {perms.showStatsNotReceivedUnit && <TableCell className="text-center font-black text-rose-400">{s.notReceivedUnit}</TableCell>}
                                    {perms.showStatsPriceIQD && (
                                      <TableCell className="text-center font-black text-emerald-700 bg-emerald-50/30">
                                        {formatNumber(s.priceIQD)}
                                      </TableCell>
                                    )}
                                    {perms.showStatsPriceUSD && (
                                      <TableCell className="text-center font-black text-blue-700 bg-blue-50/30">
                                        {formatNumber(s.priceUSD)}
                                      </TableCell>
                                    )}
                                  </TableRow>
                                ))
                            ))}
                        </TableBody>
                        <TableFooter className="bg-slate-900 text-white">
                          <TableRow>
                            <TableCell colSpan={2} className="font-black text-right text-sm">المجموع الكلي للزون {zone}</TableCell>
                            {perms.showStatsAvailable && <TableCell className="text-center font-black text-sm">{zoneData.totals.available}</TableCell>}
                            {perms.showStatsSold && <TableCell className="text-center font-black text-sm">{zoneData.totals.sold}</TableCell>}
                            {perms.showStatsInvestment && <TableCell className="text-center font-black text-sm">{zoneData.totals.investment}</TableCell>}
                            {perms.showStatsReserved && <TableCell className="text-center font-black text-sm">{zoneData.totals.reserved}</TableCell>}
                            {perms.showStatsPending && <TableCell className="text-center font-black text-sm">{zoneData.totals.pending}</TableCell>}
                            {perms.showStatsTotal && <TableCell className="text-center font-black text-sm bg-slate-800">{zoneData.totals.total}</TableCell>}
                            {perms.showStatsPromoted && <TableCell className="text-center font-black text-indigo-400">{zoneData.totals.promoted}</TableCell>}
                            {perms.showStatsNotPromoted && <TableCell className="text-center font-black text-slate-400">{zoneData.totals.notPromoted}</TableCell>}
                            {perms.showStatsReceivedTabo && <TableCell className="text-center font-black text-amber-400">{zoneData.totals.receivedTabo}</TableCell>}
                            {perms.showStatsReceivedUnit && <TableCell className="text-center font-black text-sky-400">{zoneData.totals.receivedUnit}</TableCell>}
                            {perms.showStatsNotReceivedUnit && <TableCell className="text-center font-black text-rose-300">{zoneData.totals.notReceivedUnit}</TableCell>}
                            {perms.showStatsPriceIQD && (
                              <TableCell className="text-center font-black text-emerald-400 bg-emerald-950/50">
                                {formatNumber(zoneData.totals.priceIQD)}
                              </TableCell>
                            )}
                            {perms.showStatsPriceUSD && (
                              <TableCell className="text-center font-black text-blue-400 bg-blue-950/50">
                                {formatNumber(zoneData.totals.priceUSD)}
                              </TableCell>
                            )}
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="towers" className="space-y-6">
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 font-bold text-xs">
                <Filter size={16} className="text-indigo-600" />
                <span>فلترة حسب المساحة:</span>
              </div>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="w-[180px] rounded-xl bg-white font-bold h-10 text-xs border-slate-200">
                  <SelectValue placeholder="اختر المساحة" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold text-xs">كافة المساحات</SelectItem>
                  {availableSizes.map(size => (
                    <SelectItem key={size} value={size.toString()} className="font-bold text-xs">{size} م²</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* بطاقات العمارات المنسدلة المقفلة افتراضياً لسرعة الأداء */}
            <Accordion type="multiple" className="space-y-4">
              {sortedTowerStats.map((tower) => (
                <AccordionItem 
                  key={tower.name} 
                  value={tower.name} 
                  className="border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm transition-all duration-200"
                >
                  <AccordionTrigger className="px-6 py-4 hover:no-underline bg-slate-50/60 hover:bg-slate-100/60 transition-colors">
                    <div className="flex flex-wrap items-center justify-between w-full ml-4 gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-7 bg-indigo-600 rounded-full" />
                        <span className="text-base font-black text-slate-800">
                          العمارة: <strong className="text-indigo-600">{tower.name}</strong>
                        </span>
                      </div>

                      {/* ملخص سريع للعمارة يُقرأ مباشرة دون الحاجة لفتح الجدول */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full border">
                          الإجمالي: <strong className="font-black">{tower.totals.total}</strong>
                        </span>
                        {perms.showStatsAvailable && (
                          <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-full border border-emerald-100">
                            المتاح: <strong className="font-black">{tower.totals.available}</strong>
                          </span>
                        )}
                        {perms.showStatsSold && (
                          <span className="bg-rose-50 text-rose-700 px-3 py-1 rounded-full border border-rose-100">
                            المباع: <strong className="font-black">{tower.totals.sold}</strong>
                          </span>
                        )}
                        {perms.showStatsInvestment && (
                          <span className="bg-purple-50 text-purple-700 px-3 py-1 rounded-full border border-purple-100">
                            الاستثمار: <strong className="font-black">{tower.totals.investment}</strong>
                          </span>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>

                  <AccordionContent className="p-0 border-t border-slate-100">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="bg-slate-50">
                          <TableRow>
                            <TableHead className="text-right font-black whitespace-nowrap">الطابق</TableHead>
                            <TableHead className="text-right font-black whitespace-nowrap">المساحة (م²)</TableHead>
                            {perms.showStatsAvailable && <TableHead className="text-center font-black text-emerald-600 whitespace-nowrap">المتاح</TableHead>}
                            {perms.showStatsSold && <TableHead className="text-center font-black text-rose-600 whitespace-nowrap">المباع</TableHead>}
                            {perms.showStatsInvestment && <TableHead className="text-center font-black text-purple-600 whitespace-nowrap">الاستثمار</TableHead>}
                            {perms.showStatsReserved && <TableHead className="text-center font-black text-amber-600 whitespace-nowrap">محجوز</TableHead>}
                            {perms.showStatsPending && <TableHead className="text-center font-black text-blue-600 whitespace-nowrap">حجز أولي</TableHead>}
                            {perms.showStatsTotal && <TableHead className="text-center font-black bg-slate-100 whitespace-nowrap">المجموع</TableHead>}
                            {perms.showStatsPromoted && <TableHead className="text-center font-black text-indigo-600 whitespace-nowrap">مروج</TableHead>}
                            {perms.showStatsNotPromoted && <TableHead className="text-center font-black text-slate-500 whitespace-nowrap">غير مروج</TableHead>}
                            {perms.showStatsReceivedTabo && <TableHead className="text-center font-black text-amber-700 whitespace-nowrap">مستلم</TableHead>}
                            {perms.showStatsReceivedUnit && <TableHead className="text-center font-black text-sky-600 whitespace-nowrap">مستلم الوحدة</TableHead>}
                            {perms.showStatsNotReceivedUnit && <TableHead className="text-center font-black text-rose-400 whitespace-nowrap">غير مستلم الوحدة</TableHead>}
                            {perms.showStatsPriceIQD && <TableHead className="text-center font-black bg-emerald-50 text-emerald-700 whitespace-nowrap">إجمالي (د.ع)</TableHead>}
                            {perms.showStatsPriceUSD && <TableHead className="text-center font-black bg-blue-50 text-blue-700 whitespace-nowrap">إجمالي ($)</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tower.floors.map((floor: any, fIdx: number) => (
                            Object.entries(floor.sizes).map(([size, s]: [string, any], sIdx: number) => (
                              <TableRow 
                                key={`${floor.label}-${size}`} 
                                className={cn(
                                  "hover:opacity-80 transition-all",
                                  fIdx % 2 === 0 ? "bg-orange-50/30" : "bg-sky-50/30"
                                )}
                              >
                                <TableCell className={cn("font-bold border-l", sIdx === 0 && "bg-black/5")}>
                                  {sIdx === 0 ? floor.label : ""}
                                </TableCell>
                                <TableCell className="font-bold text-slate-600">
                                  {parseFloat(size) > 0 ? `${size} م²` : "خدمية / غير محدد"}
                                </TableCell>
                                {perms.showStatsAvailable && <TableCell className="text-center font-black">{s.available}</TableCell>}
                                {perms.showStatsSold && <TableCell className="text-center font-black">{s.sold}</TableCell>}
                                {perms.showStatsInvestment && <TableCell className="text-center font-black">{s.investment}</TableCell>}
                                {perms.showStatsReserved && <TableCell className="text-center font-black">{s.reserved}</TableCell>}
                                {perms.showStatsPending && <TableCell className="text-center font-black">{s.pending}</TableCell>}
                                {perms.showStatsTotal && <TableCell className="text-center font-black bg-black/5">{s.total}</TableCell>}
                                {perms.showStatsPromoted && <TableCell className="text-center font-black text-indigo-600">{s.promoted}</TableCell>}
                                {perms.showStatsNotPromoted && <TableCell className="text-center font-black text-slate-500">{s.notPromoted}</TableCell>}
                                {perms.showStatsReceivedTabo && <TableCell className="text-center font-black text-amber-700">{s.receivedTabo}</TableCell>}
                                {perms.showStatsReceivedUnit && <TableCell className="text-center font-black text-sky-600">{s.receivedUnit}</TableCell>}
                                {perms.showStatsNotReceivedUnit && <TableCell className="text-center font-black text-rose-400">{s.notReceivedUnit}</TableCell>}
                                {perms.showStatsPriceIQD && (
                                  <TableCell className="text-center font-black text-emerald-700 bg-emerald-50/30">
                                    {formatNumber(s.priceIQD)}
                                  </TableCell>
                                )}
                                {perms.showStatsPriceUSD && (
                                  <TableCell className="text-center font-black text-blue-700 bg-blue-50/30">
                                    {formatNumber(s.priceUSD)}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                          ))}
                        </TableBody>
                        <TableFooter className="bg-indigo-900 text-white">
                          <TableRow>
                            <TableCell colSpan={2} className="font-black text-right text-sm">المجموع الكلي للعمارة {tower.name}</TableCell>
                            {perms.showStatsAvailable && <TableCell className="text-center font-black text-sm">{tower.totals.available}</TableCell>}
                            {perms.showStatsSold && <TableCell className="text-center font-black text-sm">{tower.totals.sold}</TableCell>}
                            {perms.showStatsInvestment && <TableCell className="text-center font-black text-sm">{tower.totals.investment}</TableCell>}
                            {perms.showStatsReserved && <TableCell className="text-center font-black text-sm">{tower.totals.reserved}</TableCell>}
                            {perms.showStatsPending && <TableCell className="text-center font-black text-sm">{tower.totals.pending}</TableCell>}
                            {perms.showStatsTotal && <TableCell className="text-center font-black text-sm bg-indigo-800">{tower.totals.total}</TableCell>}
                            {perms.showStatsPromoted && <TableCell className="text-center font-black text-indigo-400">{tower.totals.promoted}</TableCell>}
                            {perms.showStatsNotPromoted && <TableCell className="text-center font-black text-slate-400">{tower.totals.notPromoted}</TableCell>}
                            {perms.showStatsReceivedTabo && <TableCell className="text-center font-black text-amber-400">{tower.totals.receivedTabo}</TableCell>}
                            {perms.showStatsReceivedUnit && <TableCell className="text-center font-black text-sky-400">{tower.totals.receivedUnit}</TableCell>}
                            {perms.showStatsNotReceivedUnit && <TableCell className="text-center font-black text-rose-300">{tower.totals.notReceivedUnit}</TableCell>}
                            {perms.showStatsPriceIQD && (
                              <TableCell className="text-center font-black text-emerald-400 bg-emerald-950/50">
                                {formatNumber(tower.totals.priceIQD)}
                              </TableCell>
                            )}
                            {perms.showStatsPriceUSD && (
                              <TableCell className="text-center font-black text-blue-400 bg-blue-950/50">
                                {formatNumber(tower.totals.priceUSD)}
                              </TableCell>
                            )}
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DetailedStatsTable;