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
import { Building2, Home, BarChart3, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    return Array.from(types).sort();
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

  return (
    <Card className="rounded-[2rem] border-slate-100 shadow-lg overflow-hidden bg-white">
      <CardHeader className="bg-slate-50/50 border-b border-slate-100">
        <CardTitle className="text-xl font-black flex items-center gap-2 text-slate-800">
          <BarChart3 className="text-blue-600" />
          الإحصائيات المفصلة
        </CardTitle>
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

          <TabsContent value="houses" className="space-y-12">
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 font-bold">
                <span>فلترة حسب الصنف:</span>
              </div>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[180px] rounded-xl bg-white font-bold">
                  <SelectValue placeholder="اختر الصنف" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold">كافة الأصناف</SelectItem>
                  {availableTypes.map(type => (
                    <SelectItem key={type} value={type} className="font-bold">صنف {type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {Object.entries(houseStats).map(([zone, zoneData]) => (
              <div key={zone} className="space-y-4">
                <h3 className="text-lg font-black text-blue-600 flex items-center gap-2 px-2">
                  <div className="w-2 h-6 bg-blue-600 rounded-full" />
                  الزون: {zone}
                </h3>
                <div className="border rounded-2xl overflow-x-auto shadow-sm">
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
                      {Object.entries(zoneData.blocks).map(([block, types], bIdx) => (
                        Object.entries(types).map(([type, s]: [string, any], tIdx) => (
                          <TableRow 
                            key={`${block}-${type}`} 
                            className={cn(
                              "hover:opacity-80 transition-all",
                              bIdx % 2 === 0 ? "bg-orange-50/50" : "bg-sky-50/50"
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
                        <TableCell colSpan={2} className="font-black text-right text-lg">المجموع الكلي للزون {zone}</TableCell>
                        {perms.showStatsAvailable && <TableCell className="text-center font-black text-lg">{zoneData.totals.available}</TableCell>}
                        {perms.showStatsSold && <TableCell className="text-center font-black text-lg">{zoneData.totals.sold}</TableCell>}
                        {perms.showStatsInvestment && <TableCell className="text-center font-black text-lg">{zoneData.totals.investment}</TableCell>}
                        {perms.showStatsReserved && <TableCell className="text-center font-black text-lg">{zoneData.totals.reserved}</TableCell>}
                        {perms.showStatsPending && <TableCell className="text-center font-black text-lg">{zoneData.totals.pending}</TableCell>}
                        {perms.showStatsTotal && <TableCell className="text-center font-black text-lg bg-slate-800">{zoneData.totals.total}</TableCell>}
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
              </div>
            ))}
          </TabsContent>

          <TabsContent value="towers" className="space-y-12">
            <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-600 font-bold">
                <span>فلترة حسب المساحة:</span>
              </div>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="w-[180px] rounded-xl bg-white font-bold">
                  <SelectValue placeholder="اختر المساحة" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="all" className="font-bold">كافة المساحات</SelectItem>
                  {availableSizes.map(size => (
                    <SelectItem key={size} value={size.toString()} className="font-bold">{size} م²</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {towerStats.map((tower) => (
              <div key={tower.name} className="space-y-4">
                <h3 className="text-lg font-black text-indigo-600 flex items-center gap-2 px-2">
                  <div className="w-2 h-6 bg-indigo-600 rounded-full" />
                  العمارة: {tower.name}
                </h3>
                <div className="border rounded-2xl overflow-x-auto shadow-sm">
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
                              fIdx % 2 === 0 ? "bg-orange-50/50" : "bg-sky-50/50"
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
                        <TableCell colSpan={2} className="font-black text-right text-lg">المجموع الكلي للعمارة {tower.name}</TableCell>
                        {perms.showStatsAvailable && <TableCell className="text-center font-black text-lg">{tower.totals.available}</TableCell>}
                        {perms.showStatsSold && <TableCell className="text-center font-black text-lg">{tower.totals.sold}</TableCell>}
                        {perms.showStatsInvestment && <TableCell className="text-center font-black text-lg">{tower.totals.investment}</TableCell>}
                        {perms.showStatsReserved && <TableCell className="text-center font-black text-lg">{tower.totals.reserved}</TableCell>}
                        {perms.showStatsPending && <TableCell className="text-center font-black text-lg">{tower.totals.pending}</TableCell>}
                        {perms.showStatsTotal && <TableCell className="text-center font-black text-lg bg-indigo-800">{tower.totals.total}</TableCell>}
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
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DetailedStatsTable;