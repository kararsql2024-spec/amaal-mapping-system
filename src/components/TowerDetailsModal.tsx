"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Snowflake, Ruler } from "lucide-react";
import { cn } from "@/lib/utils";
import UnitDetailsModal from './UnitDetailsModal';
import { Eyebrow } from "@/components/layout/AppShell";
import { getStatusMeta, getApartmentCardTheme } from "@/lib/unit-status";
import {
  getApartmentKey,
  getApartmentLabel,
  getApartmentShortLabel,
  getApartmentSize,
  getFloorLabel,
} from "@/lib/units";

interface TowerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tower: any;
  housesData: Record<string, any>;
  onSaveApartment: (apartmentKey: string, data: any) => void;
  permissions?: any;
  initialSelectedApartmentKey?: string | null; // حقل جديد لتحديد الشقة المفتوحة تلقائياً عند البحث
  projectId?: string; // معرف المشروع الممرر ديناميكياً لتشغيل البروشور
}

const TowerDetailsModal = ({ 
  isOpen, 
  onClose, 
  tower, 
  housesData, 
  onSaveApartment, 
  permissions,
  initialSelectedApartmentKey,
  projectId
}: TowerDetailsModalProps) => {
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [selectedAptKey, setSelectedAptKey] = useState<string | null>(null);

  // تأثير ذكي لتحديد الطابق والشقة المبحوث عنها تلقائياً عند فتح المودال
  useEffect(() => {
    if (initialSelectedApartmentKey && isOpen && tower) {
      const parts = initialSelectedApartmentKey.split('_F');
      if (parts.length > 1) {
        const floorPart = parts[1].split('_A');
        const floorNum = parseInt(floorPart[0]);
        if (!isNaN(floorNum)) {
          setSelectedFloor(floorNum);
          setSelectedAptKey(initialSelectedApartmentKey);
        }
      }
    } else {
      setSelectedAptKey(null);
    }
  }, [initialSelectedApartmentKey, isOpen, tower]);

  if (!tower) return null;

  const floors = Array.from({ length: tower.floors || 1 }, (_, i) => i + 1);
  const aptsPerFloor = tower.apartmentsPerFloor || 1;
  const apts = Array.from({ length: aptsPerFloor }, (_, i) => i + 1);

  const reorderedApts = [];
  for (let i = 0; i < apts.length; i += 2) {
    if (i + 1 < apts.length) {
      reorderedApts.push(apts[i + 1]);
    }
    reorderedApts.push(apts[i]);
  }

  const getAptKey = (floor: number, aptNum: number) => getApartmentKey(tower.id, floor, aptNum);

  const getAptFullLabel = (floor: number, aptNum: number) =>
    getApartmentLabel(tower, floor, aptNum, housesData);

  const getAptSize = (floor: number, aptNum: number) =>
    getApartmentSize(tower, floor, aptNum);

  const FROZEN_LABELS: Record<string, string> = {
    frozen_uncounted: 'مجمدة (خارج المجموع)',
    frozen_counted: 'مجمدة (داخل المجموع)',
    frozen_hidden: 'مجمدة (مخفي من العدد)',
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl gap-0 overflow-hidden p-0" dir="rtl">
          <div className="flex h-[600px]">
            <aside className="w-52 shrink-0 overflow-y-auto border-e border-line bg-surface-sunken">
              <div className="sticky top-0 border-b border-line bg-surface-sunken px-4 py-3">
                <Eyebrow>الطوابق</Eyebrow>
              </div>
              <div className="divide-y divide-line">
                {[...floors].reverse().map((floor) => (
                  <button
                    key={floor}
                    onClick={() => setSelectedFloor(floor)}
                    className={cn(
                      "flex w-full items-center justify-between px-4 py-3 text-start text-[13px] transition-colors",
                      selectedFloor === floor
                        ? "bg-foreground text-background"
                        : "text-fg-secondary hover:bg-surface hover:text-fg",
                    )}
                  >
                    <span>{getFloorLabel(floor)}</span>
                    {selectedFloor === floor && (
                      <span className="h-1 w-1 rounded-full bg-background" />
                    )}
                  </button>
                ))}
              </div>
            </aside>

            <div className="flex-1 overflow-y-auto bg-surface p-6">
              <DialogHeader className="mb-6 space-y-0 border-b border-line pb-4 text-start">
                <Eyebrow>عمارة {tower.label}</Eyebrow>
                <DialogTitle className="mt-1.5 text-xl font-normal">
                  {getFloorLabel(selectedFloor)}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-flow-col grid-rows-2 gap-px bg-line" dir="ltr">
                {reorderedApts.map((aptNum) => {
                  const key = getAptKey(selectedFloor, aptNum);
                  const fullLabel = getAptFullLabel(selectedFloor, aptNum);
                  const shortLabel = getApartmentShortLabel(fullLabel);
                  const data = housesData[key] || { status: 'available' };
                  const isFrozen = data.status?.startsWith('frozen');
                  const size = getAptSize(selectedFloor, aptNum);
                  const meta = getStatusMeta(data.status);
                  const theme = getApartmentCardTheme(data.status);
                  const statusLabel = FROZEN_LABELS[data.status] ?? meta.label;

                  // الشقق المخفية من العدد تُعرض كمساحة خدمية مع إبقاء إمكانية التعديل
                  if (data.status === 'frozen_hidden') {
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedAptKey(key)}
                        className="relative flex h-full min-h-[130px] flex-col items-center justify-center gap-1.5 overflow-hidden border border-dashed bg-background transition-all hover:brightness-[0.98]"
                        style={{
                          borderColor: theme.border,
                          background: theme.background,
                        }}
                      >
                        <span
                          className="pointer-events-none absolute -end-8 -top-8 h-24 w-24 rounded-full blur-2xl"
                          style={{ backgroundColor: theme.glow }}
                          aria-hidden="true"
                        />
                        <Snowflake size={18} strokeWidth={1.5} className="relative text-fg-muted" />
                        <span className="relative text-[12px] text-fg-secondary">مساحة خدمية</span>
                        <span className="relative text-[10px] text-fg-faint">اضغط للتعديل</span>
                      </button>
                    );
                  }

                  return (
                    <button
                      key={key}
                      onClick={() => setSelectedAptKey(key)}
                      className="group relative flex h-full min-h-[130px] flex-col justify-between overflow-hidden border p-4 text-left transition-all hover:-translate-y-px hover:shadow-md"
                      style={{
                        background: theme.background,
                        borderColor: theme.border,
                        boxShadow: `inset 0 1px 0 ${theme.glow}`,
                      }}
                    >
                      <span
                        className="pointer-events-none absolute -end-10 -top-10 h-28 w-28 rounded-full blur-2xl transition-opacity group-hover:opacity-100 opacity-80"
                        style={{ backgroundColor: theme.glow }}
                        aria-hidden="true"
                      />
                      <span
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px]"
                        style={{ background: theme.bar }}
                        aria-hidden="true"
                      />

                      <div className="relative flex w-full items-start justify-between gap-2">
                        <span className="text-[26px] font-light leading-none tracking-display tabular text-fg">
                          {shortLabel}
                        </span>
                        {isFrozen && <Snowflake size={14} className="mt-1 text-fg-muted" />}
                      </div>

                      <div className="relative space-y-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-sm px-2 py-1 text-[11px] font-medium"
                          style={{
                            backgroundColor: theme.badgeBg,
                            color: theme.badgeText,
                          }}
                        >
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full ring-2 ring-white/60"
                            style={{ backgroundColor: meta.fill }}
                          />
                          {statusLabel}
                        </span>

                        {size > 0 && (
                          <span className="flex w-fit items-center gap-1 border border-line/80 bg-background/70 px-1.5 py-0.5 text-[11px] tabular text-fg-muted backdrop-blur-[1px]">
                            <Ruler size={10} />
                            {size} م²
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <UnitDetailsModal 
        isOpen={!!selectedAptKey}
        onClose={() => setSelectedAptKey(null)}
        onSave={(key, data) => {
          onSaveApartment(key, data);
          setSelectedAptKey(null);
        }}
        unitId={selectedAptKey}
        unitLabel={selectedAptKey ? getAptFullLabel(parseInt(selectedAptKey.split('_F')[1].split('_')[0]), parseInt(selectedAptKey.split('_A')[1])) : ''}
        initialData={selectedAptKey ? housesData[selectedAptKey] : undefined}
        permissions={permissions}
        unitSize={selectedAptKey ? getAptSize(parseInt(selectedAptKey.split('_F')[1].split('_')[0]), parseInt(selectedAptKey.split('_A')[1])) : undefined}
        projectId={projectId}
      />
    </>
  );
};

export default TowerDetailsModal;