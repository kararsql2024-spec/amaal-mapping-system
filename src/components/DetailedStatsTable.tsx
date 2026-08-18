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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Building2, Home, FileSpreadsheet } from "lucide-react";
import { formatNumber, getCurrencyType, parsePrice } from "@/lib/format";
import { Eyebrow } from "@/components/layout/AppShell";
import { STATUS_META } from "@/lib/unit-status";
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
interface StatColumn {
  key: string;
  label: string;
  /** Highlighted as the running total. */
  emphasis?: boolean;
  /** Rendered with thousands separators. */
  money?: boolean;
  /** Status swatch shown next to the header label. */
  tone?: string;
}

/**
 * Column set for both breakdown tables. Order and visibility rules are the
 * same as before; they now live in one place instead of four.
 */
const buildStatColumns = (perms: any): StatColumn[] =>
  [
    perms.showStatsAvailable && { key: 'available', label: 'المتاح', tone: STATUS_META.available.fill },
    perms.showStatsSold && { key: 'sold', label: 'المباع', tone: STATUS_META.sold.fill },
    perms.showStatsInvestment && { key: 'investment', label: 'الاستثمار', tone: STATUS_META.investment.fill },
    perms.showStatsReserved && { key: 'reserved', label: 'محجوز', tone: STATUS_META.reserved.fill },
    perms.showStatsPending && { key: 'pending', label: 'حجز أولي', tone: STATUS_META.pending.fill },
    perms.showStatsTotal && { key: 'total', label: 'المجموع', emphasis: true },
    perms.showStatsPromoted && { key: 'promoted', label: 'مروج' },
    perms.showStatsNotPromoted && { key: 'notPromoted', label: 'غير مروج' },
    perms.showStatsReceivedTabo && { key: 'receivedTabo', label: 'مستلم' },
    perms.showStatsReceivedUnit && { key: 'receivedUnit', label: 'مستلم الوحدة' },
    perms.showStatsNotReceivedUnit && { key: 'notReceivedUnit', label: 'غير مستلم الوحدة' },
    perms.showStatsPriceIQD && { key: 'priceIQD', label: 'إجمالي (د.ع)', money: true },
    perms.showStatsPriceUSD && { key: 'priceUSD', label: 'إجمالي ($)', money: true },
  ].filter(Boolean) as StatColumn[];

interface BreakdownRow {
  key: string;
  /** Group label, rendered only on the first row of each group. */
  primary: string;
  secondary: string;
  values: Record<string, number>;
}

const StatsBreakdownTable = ({
  columns,
  primaryHeader,
  secondaryHeader,
  rows,
  totals,
  totalsLabel,
}: {
  columns: StatColumn[];
  primaryHeader: string;
  secondaryHeader: string;
  rows: BreakdownRow[];
  totals: Record<string, number>;
  totalsLabel: string;
}) => (
  <div className="overflow-x-auto">
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="whitespace-nowrap">{primaryHeader}</TableHead>
          <TableHead className="whitespace-nowrap">{secondaryHeader}</TableHead>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn(
                "whitespace-nowrap text-center",
                col.emphasis && "bg-surface-sunken text-fg-secondary",
              )}
            >
              <span className="inline-flex items-center gap-1.5">
                {col.tone ? (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: col.tone }}
                  />
                ) : null}
                {col.label}
              </span>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="whitespace-nowrap font-medium text-fg">
              {row.primary}
            </TableCell>
            <TableCell className="whitespace-nowrap text-fg-secondary">
              {row.secondary}
            </TableCell>
            {columns.map((col) => (
              <TableCell
                key={col.key}
                className={cn(
                  "text-center tabular",
                  col.emphasis && "bg-surface-sunken font-medium",
                  col.money && "text-fg-secondary",
                )}
              >
                {col.money ? formatNumber(row.values[col.key]) : row.values[col.key]}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>

      <TableFooter className="border-t border-line bg-foreground text-background hover:bg-foreground">
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={2} className="whitespace-nowrap font-medium">
            {totalsLabel}
          </TableCell>
          {columns.map((col) => (
            <TableCell key={col.key} className="text-center tabular">
              {col.money ? formatNumber(totals[col.key]) : totals[col.key]}
            </TableCell>
          ))}
        </TableRow>
      </TableFooter>
    </Table>
  </div>
);

const SummaryPills = ({
  perms,
  totals,
}: {
  perms: any;
  totals: Record<string, number>;
}) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
    <span className="font-medium text-fg-secondary">
      الإجمالي <span className="tabular font-semibold text-fg">{totals.total}</span>
    </span>
    {perms.showStatsAvailable && (
      <span className="inline-flex items-center gap-1.5 font-medium text-fg-secondary">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META.available.fill }} />
        المتاح <span className="tabular font-semibold text-fg">{totals.available}</span>
      </span>
    )}
    {perms.showStatsSold && (
      <span className="inline-flex items-center gap-1.5 font-medium text-fg-secondary">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META.sold.fill }} />
        المباع <span className="tabular font-semibold text-fg">{totals.sold}</span>
      </span>
    )}
    {perms.showStatsInvestment && (
      <span className="inline-flex items-center gap-1.5 font-medium text-fg-secondary">
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_META.investment.fill }} />
        الاستثمار <span className="tabular font-semibold text-fg">{totals.investment}</span>
      </span>
    )}
  </div>
);

const byNaturalOrder = (a: string, b: string) =>
  a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

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
  const handleExportStatsToExcel = async () => {
    try {
      const XLSX = await import("xlsx");
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

  const statColumns = buildStatColumns(perms);

  const houseRows = (zoneData: any): BreakdownRow[] => {
    const rows: BreakdownRow[] = [];
    Object.entries(zoneData.blocks)
      .sort(([a], [b]) => byNaturalOrder(a, b))
      .forEach(([block, types]: [string, any]) => {
        Object.entries(types)
          .sort(([a], [b]) => byNaturalOrder(a, b))
          .forEach(([type, s]: [string, any], tIdx) => {
            rows.push({
              key: `${block}-${type}`,
              primary: tIdx === 0 ? block : '',
              secondary: type,
              values: s,
            });
          });
      });
    return rows;
  };

  const towerRows = (tower: any): BreakdownRow[] => {
    const rows: BreakdownRow[] = [];
    tower.floors.forEach((floor: any) => {
      Object.entries(floor.sizes).forEach(([size, s]: [string, any], sIdx: number) => {
        rows.push({
          key: `${floor.label}-${size}`,
          primary: sIdx === 0 ? floor.label : '',
          secondary: parseFloat(size) > 0 ? `${size} م²` : 'خدمية / غير محدد',
          values: s,
        });
      });
    });
    return rows;
  };

  return (
    <section className="border border-line bg-surface">
      <div className="flex flex-col gap-4 border-b border-line px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[13px] font-medium text-fg-secondary">التفاصيل</p>
          <h3 className="mt-1.5 text-lg font-normal text-fg">الإحصائيات المفصلة</h3>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportStatsToExcel} className="gap-2">
          <FileSpreadsheet size={14} />
          تصدير Excel
        </Button>
      </div>

      <div className="p-5">
        <Tabs defaultValue="houses" className="w-full" dir="rtl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList>
              <TabsTrigger value="houses">
                <Home className="h-3.5 w-3.5" /> المنازل
              </TabsTrigger>
              <TabsTrigger value="towers">
                <Building2 className="h-3.5 w-3.5" /> العمارات
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="houses" className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-[13px] font-medium text-fg-secondary">الصنف</span>
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="اختر الصنف" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كافة الأصناف</SelectItem>
                  {availableTypes.map(type => (
                    <SelectItem key={type} value={type}>صنف {type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Accordion type="multiple" className="border-t border-line">
              {sortedHouseStats.map(([zone, zoneData]) => (
                <AccordionItem key={zone} value={zone} className="border-b border-line">
                  <AccordionTrigger className="px-1 py-3.5 hover:no-underline hover:bg-surface-sunken">
                    <div className="flex w-full flex-wrap items-center justify-between gap-4 pe-3">
                      <span className="flex items-center gap-2.5 text-[13px] font-medium text-fg">
                        <span className="text-[12px] font-medium text-fg-muted">زون</span>
                        {zone}
                      </span>
                      <SummaryPills perms={perms} totals={zoneData.totals} />
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-t border-line p-0">
                    <StatsBreakdownTable
                      columns={statColumns}
                      primaryHeader="البلوك"
                      secondaryHeader="الصنف"
                      rows={houseRows(zoneData)}
                      totals={zoneData.totals}
                      totalsLabel={`المجموع الكلي للزون ${zone}`}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>

          <TabsContent value="towers" className="mt-5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="shrink-0 text-[13px] font-medium text-fg-secondary">المساحة</span>
              <Select value={selectedSize} onValueChange={setSelectedSize}>
                <SelectTrigger className="h-8 w-[180px] text-xs">
                  <SelectValue placeholder="اختر المساحة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كافة المساحات</SelectItem>
                  {availableSizes.map(size => (
                    <SelectItem key={size} value={size.toString()}>{size} م²</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Accordion type="multiple" className="border-t border-line">
              {sortedTowerStats.map((tower) => (
                <AccordionItem key={tower.name} value={tower.name} className="border-b border-line">
                  <AccordionTrigger className="px-1 py-3.5 hover:no-underline hover:bg-surface-sunken">
                    <div className="flex w-full flex-wrap items-center justify-between gap-4 pe-3">
                      <span className="flex items-center gap-2.5 text-[13px] font-medium text-fg">
                        <span className="text-[12px] font-medium text-fg-muted">عمارة</span>
                        {tower.name}
                      </span>
                      <SummaryPills perms={perms} totals={tower.totals} />
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="border-t border-line p-0">
                    <StatsBreakdownTable
                      columns={statColumns}
                      primaryHeader="الطابق"
                      secondaryHeader="المساحة"
                      rows={towerRows(tower)}
                      totals={tower.totals}
                      totalsLabel={`المجموع الكلي للعمارة ${tower.name}`}
                    />
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};

export default DetailedStatsTable;
