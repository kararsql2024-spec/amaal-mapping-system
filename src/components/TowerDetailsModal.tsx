"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, LayoutGrid, Snowflake } from "lucide-react";
import { cn } from "@/lib/utils";
import UnitDetailsModal from './UnitDetailsModal';

interface TowerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tower: any;
  housesData: Record<string, any>;
  onSaveApartment: (apartmentKey: string, data: any) => void;
  permissions?: any;
  initialSelectedApartmentKey?: string | null; // حقل جديد لتحديد الشقة المفتوحة تلقائياً عند البحث
}

const TowerDetailsModal = ({ 
  isOpen, 
  onClose, 
  tower, 
  housesData, 
  onSaveApartment, 
  permissions,
  initialSelectedApartmentKey 
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

  const getAptKey = (floor: number, aptNum: number) => `${tower.id}_F${floor}_A${aptNum}`;
  
  const getFloorCode = (floor: number) => floor === 1 ? "FG" : `F${floor - 1}`;

  const getAptFullLabel = (floor: number, aptNum: number) => {
    let pCounter = 0;
    const floorCode = getFloorCode(floor);

    for (let f = 1; f <= (tower.floors || 1); f++) {
      for (let a = 1; a <= (tower.apartmentsPerFloor || 1); a++) {
        const key = getAptKey(f, a);
        const data = housesData[key];
        const isFrozenSequence = data?.status === 'frozen_uncounted' || data?.status === 'frozen_hidden';
        
        if (!isFrozenSequence) {
          pCounter++;
        }

        if (f === floor && a === aptNum) {
          const aptCode = isFrozenSequence ? "مجمدة" : `P${pCounter}`;
          return `${tower.label}-${getFloorCode(f)}-${aptCode}`;
        }
      }
    }
    return "";
  };

  const getAptShortLabel = (fullLabel: string) => {
    if (!fullLabel) return "";
    const parts = fullLabel.split('-');
    return parts[parts.length - 1];
  };

  const getStatusColor = (status: string) => {
    if (status?.startsWith('frozen')) return 'bg-slate-200 text-slate-600 border-slate-300';
    switch (status) {
      case 'sold': return 'bg-rose-500 text-white border-rose-600';
      case 'pending': return 'bg-blue-500 text-white border-blue-600';
      case 'reserved': return 'bg-amber-400 text-white border-amber-500';
      case 'investment': return 'bg-purple-400 text-white border-purple-500';
      default: return 'bg-emerald-500 text-white border-emerald-600';
    }
  };

  const getFloorLabel = (floor: number) => floor === 1 ? "الطابق الأرضي" : `الطابق ${floor - 1}`;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-none" dir="rtl">
          <div className="flex h-[600px]">
            <div className="w-56 bg-slate-50 border-l border-slate-100 p-6 overflow-y-auto">
              <h3 className="font-black text-slate-400 text-xs uppercase mb-4 tracking-wider">قائمة الطوابق</h3>
              <div className="space-y-2">
                {[...floors].reverse().map((floor) => (
                  <button
                    key={floor}
                    onClick={() => setSelectedFloor(floor)}
                    className={cn(
                      "w-full p-4 rounded-2xl font-bold transition-all text-right flex items-center justify-between",
                      selectedFloor === floor 
                        ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200 scale-105" 
                        : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-100"
                    )}
                  >
                    <span className="text-sm">{getFloorLabel(floor)}</span>
                    {selectedFloor === floor && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 p-8 bg-white overflow-y-auto">
              <DialogHeader className="mb-8">
                <DialogTitle className="text-3xl font-black flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                    <Building2 className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-400 font-bold">برج: {tower.label}</p>
                    <p>{getFloorLabel(selectedFloor)}</p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-rows-2 grid-flow-col gap-4" dir="ltr">
                {reorderedApts.map((aptNum) => {
                  const key = getAptKey(selectedFloor, aptNum);
                  const fullLabel = getAptFullLabel(selectedFloor, aptNum);
                  const shortLabel = getAptShortLabel(fullLabel);
                  const data = housesData[key] || { status: 'available' };
                  const isFrozen = data.status?.startsWith('frozen');
                  
                  return (
                    <div 
                      key={key}
                      className={cn(
                        "p-6 rounded-[2rem] border-2 transition-all cursor-pointer group relative overflow-hidden text-left h-full",
                        getStatusColor(data.status)
                      )}
                      onClick={() => setSelectedAptKey(key)}
                    >
                      <div className="relative z-10">
                        <div className="flex justify-between items-start">
                          <p className="text-3xl font-black">{shortLabel}</p>
                          {isFrozen && <Snowflake size={18} className="opacity-50" />}
                        </div>
                        <p className="text-[10px] font-bold opacity-70 mt-1 uppercase">
                          {data.status === 'frozen_uncounted' ? 'مجمدة (خارج المجموع)' : 
                           data.status === 'frozen_counted' ? 'مجمدة (داخل المجموع)' : 
                           data.status === 'frozen_hidden' ? 'مجمدة (مخفي من العدد)' :
                           data.status === 'investment' ? 'استثمار' :
                           data.status}
                        </p>
                      </div>
                      <LayoutGrid className="absolute -bottom-4 -right-4 w-20 h-20 opacity-10 group-hover:scale-110 transition-transform" />
                    </div>
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
      />
    </>
  );
};

export default TowerDetailsModal;