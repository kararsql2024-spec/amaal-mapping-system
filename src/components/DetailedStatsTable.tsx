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
}

const DetailedStatsTable = ({ elements, housesData }: DetailedStatsTableProps) => {
  const [selectedType, setSelectedType] = useState<string>("all");

  // استخراج كافة الأصناف المتاحة للفلترة
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

  // معالجة إحصائيات العمارات
  const towerStats = useMemo(() => {
    const stats: any[] = [];
    elements.filter(el => el.type === 'tower').forEach(tower => {
      const floorsData: any[] = [];
      const towerTotal = { available: 0, sold: 0, investment: 0, pending: 0, reserved: 0, total: 0 };
      
      for (let f = 1; f <= (tower.floors || 1); f++) {
        const floorStats = { 
          label: f === 1 ? "الأرضي" : `الطابق ${f - 1}`, 
          available: 0, 
          sold: 0, 
          investment: 0, 
          pending: 0,
          reserved: 0,
          total: 0 
        };
        
        for (let a = 1; a <= (tower.apartmentsPerFloor || 1); a++) {
          const key = `${tower.id}_F${f}_A${a}`;
          const data = housesData[key] || { status: 'available' };
          
          if (data.status === 'frozen_hidden') continue;

          if (data.status === 'sold') floorStats.sold++;
          else if (data.status === 'investment') floorStats.investment++;
          else if (data.status === 'pending') floorStats.pending++;
          else if (data.status === 'reserved') floorStats.reserved++;
          else if (data.status === 'available') floorStats.available++;
          
          if (data.status !== 'frozen_uncounted') floorStats.total++;
        }
        
        floorsData.push(floorStats);
        towerTotal.available += floorStats.available;
        towerTotal.sold += floorStats.sold;
        towerTotal.investment += floorStats.investment;
        towerTotal.pending += floorStats.pending;
        towerTotal.reserved += floorStats.reserved;
        towerTotal.total += floorStats.total;
      }
      stats.push({ name: tower.label, floors: floorsData, totals: towerTotal });
    });
    return stats;
  }, [elements, housesData]);

  // معالجة إحصائيات المنازل مع دعم الفلترة
  const houseStats = useMemo(() => {
    const stats: Record<string, { blocks: Record<string, Record<string, any>>, totals: any }> = {};
    
    elements.filter(el => el.type === 'house').forEach(house => {
      const parts = house.label.split('-');
      if (parts.length < 3) return;

      const zone = parts[0];
      const block = parts[1];
      const typeMatch = parts[2].match(/[a-zA-Z]+/);
      const type = typeMatch ? typeMatch[0] : 'غير محدد';

      // تطبيق الفلتر
      if (selectedType !== "all" && type !== selectedType) return;

      const data = housesData[house.id] || { status: 'available' };
      if (data.status === 'frozen_hidden') return;

      if (!stats[zone]) {
        stats[zone] = { 
          blocks: {}, 
          totals: { available: 0, sold: 0, investment: 0, pending: 0, reserved: 0, total: 0 } 
        };
      }
      
      if (!stats[zone].blocks[block]) stats[zone].blocks[block] = {};
      if (!stats[zone].blocks[block][type]) {
        stats[zone].blocks[block][type] = { available: 0, sold: 0, investment: 0, pending: 0, reserved: 0, total: 0 };
      }

      const s = stats[zone].blocks[block][type];
      const zt = stats[zone].totals;

      if (data.status === 'sold') { s.sold++; zt.sold++; }
      else if (data.status === 'investment') { s.investment++; zt.investment++; }
      else if (data.status === 'pending') { s.pending++; zt.pending++; }
      else if (data.status === 'reserved') { s.reserved++; zt.reserved++; }
      else if (data.status === 'available') { s.available++; zt.available++; }
      
      if (data.status !== 'frozen_uncounted') { s.total++; zt.total++; }
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
                <Filter size={18} />
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
                <div className="border rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-right font-black">البلوك</TableHead>
                        <TableHead className="text-right font-black">الصنف</TableHead>
                        <TableHead className="text-center font-black text-emerald-600">المتاح</TableHead>
                        <TableHead className="text-center font-black text-rose-600">المباع</TableHead>
                        <TableHead className="text-center font-black text-purple-600">الاستثمار</TableHead>
                        <TableHead className="text-center font-black text-amber-600">محجوز</TableHead>
                        <TableHead className="text-center font-black text-blue-600">حجز أولي</TableHead>
                        <TableHead className="text-center font-black bg-slate-100">المجموع</TableHead>
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
                            <TableCell className="text-center font-black">{s.available}</TableCell>
                            <TableCell className="text-center font-black">{s.sold}</TableCell>
                            <TableCell className="text-center font-black">{s.investment}</TableCell>
                            <TableCell className="text-center font-black">{s.reserved}</TableCell>
                            <TableCell className="text-center font-black">{s.pending}</TableCell>
                            <TableCell className="text-center font-black bg-black/5">{s.total}</TableCell>
                          </TableRow>
                        ))
                      ))}
                    </TableBody>
                    <TableFooter className="bg-slate-900 text-white">
                      <TableRow>
                        <TableCell colSpan={2} className="font-black text-right text-lg">المجموع الكلي للزون {zone}</TableCell>
                        <TableCell className="text-center font-black text-lg">{zoneData.totals.available}</TableCell>
                        <TableCell className="text-center font-black text-lg">{zoneData.totals.sold}</TableCell>
                        <TableCell className="text-center font-black text-lg">{zoneData.totals.investment}</TableCell>
                        <TableCell className="text-center font-black text-lg">{zoneData.totals.reserved}</TableCell>
                        <TableCell className="text-center font-black text-lg">{zoneData.totals.pending}</TableCell>
                        <TableCell className="text-center font-black text-lg bg-slate-800">{zoneData.totals.total}</TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </div>
            ))}
          </TabsContent>

          <TabsContent value="towers" className="space-y-12">
            {towerStats.map((tower) => (
              <div key={tower.name} className="space-y-4">
                <h3 className="text-lg font-black text-indigo-600 flex items-center gap-2 px-2">
                  <div className="w-2 h-6 bg-indigo-600 rounded-full" />
                  العمارة: {tower.name}
                </h3>
                <div className="border rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-right font-black">الطابق</TableHead>
                        <TableHead className="text-center font-black text-emerald-600">المتاح</TableHead>
                        <TableHead className="text-center font-black text-rose-600">المباع</TableHead>
                        <TableHead className="text-center font-black text-purple-600">الاستثمار</TableHead>
                        <TableHead className="text-center font-black text-amber-600">محجوز</TableHead>
                        <TableHead className="text-center font-black text-blue-600">حجز أولي</TableHead>
                        <TableHead className="text-center font-black bg-slate-100">المجموع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tower.floors.map((floor: any, fIdx: number) => (
                        <TableRow 
                          key={floor.label} 
                          className={cn(
                            "hover:opacity-80 transition-all",
                            fIdx % 2 === 0 ? "bg-orange-50/50" : "bg-sky-50/50"
                          )}
                        >
                          <TableCell className="font-bold border-l">{floor.label}</TableCell>
                          <TableCell className="text-center font-black">{floor.available}</TableCell>
                          <TableCell className="text-center font-black">{floor.sold}</TableCell>
                          <TableCell className="text-center font-black">{floor.investment}</TableCell>
                          <TableCell className="text-center font-black">{floor.reserved}</TableCell>
                          <TableCell className="text-center font-black">{floor.pending}</TableCell>
                          <TableCell className="text-center font-black bg-black/5">{floor.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter className="bg-indigo-900 text-white">
                      <TableRow>
                        <TableCell className="font-black text-right text-lg">المجموع الكلي للعمارة {tower.name}</TableCell>
                        <TableCell className="text-center font-black text-lg">{tower.totals.available}</TableCell>
                        <TableCell className="text-center font-black text-lg">{tower.totals.sold}</TableCell>
                        <TableCell className="text-center font-black text-lg">{tower.totals.investment}</TableCell>
                        <TableCell className="text-center font-black text-lg">{tower.totals.reserved}</TableCell>
                        <TableCell className="text-center font-black text-lg">{tower.totals.pending}</TableCell>
                        <TableCell className="text-center font-black text-lg bg-indigo-800">{tower.totals.total}</TableCell>
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