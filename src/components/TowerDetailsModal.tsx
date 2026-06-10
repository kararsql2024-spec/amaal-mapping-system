"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Building2, ChevronRight, Home, Info, User, Phone, Calendar, Banknote, Coins } from "lucide-react";
import { MapElement } from '@/types/project';
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import UnitDetailsModal from './UnitDetailsModal';

interface TowerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tower: MapElement | undefined;
  housesData: Record<string, any>;
  onSaveApartment: (key: string, data: any) => void;
  permissions?: any;
}

const TowerDetailsModal = ({ isOpen, onClose, tower, housesData, onSaveApartment, permissions }: TowerDetailsModalProps) => {
  const [selectedApartmentKey, setSelectedApartmentKey] = useState<string | null>(null);
  const [isUnitModalOpen, setIsUnitModalOpen] = useState(false);

  if (!tower) return null;

  const floors = tower.floors || 1;
  const apartmentsPerFloor = tower.apartmentsPerFloor || 1;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sold': return 'bg-rose-500';
      case 'investment': return 'bg-purple-500';
      case 'reserved': return 'bg-amber-500';
      case 'pending': return 'bg-blue-500';
      case 'frozen_counted':
      case 'frozen_uncounted':
      case 'frozen_hidden': return 'bg-slate-400';
      default: return 'bg-emerald-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sold': return 'مباع';
      case 'investment': return 'استثمار';
      case 'reserved': return 'محجوز';
      case 'pending': return 'حجز أولي';
      case 'frozen_counted':
      case 'frozen_uncounted':
      case 'frozen_hidden': return 'مجمدة';
      default: return 'متوفر';
    }
  };

  const handleApartmentClick = (floor: number, apt: number) => {
    const key = `${tower.id}_F${floor}_A${apt}`;
    setSelectedApartmentKey(key);
    setIsUnitModalOpen(true);
  };

  const getApartmentLabel = (floor: number, apt: number) => {
    const floorCode = floor === 1 ? "FG" : `F${floor - 1}`;
    
    // حساب رقم الشقة التسلسلي (P1, P2...) مع استثناء المجمدة
    let pCounter = 0;
    for (let f = 1; f <= floors; f++) {
      for (let a = 1; a <= apartmentsPerFloor; a++) {
        const techKey = `${tower.id}_F${f}_A${a}`;
        const unitData = housesData[techKey];
        const isFrozenSequence = unitData?.status === 'frozen_uncounted' || unitData?.status === 'frozen_hidden';
        
        if (!isFrozenSequence) pCounter++;
        
        if (f === floor && a === apt) {
          const aptCode = isFrozenSequence ? "مجمدة" : `P${pCounter}`;
          return `${tower.label}-${floorCode}-${aptCode}`;
        }
      }
    }
    return `${tower.label}-F${floor}-A${apt}`;
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[800px] rounded-[2.5rem] p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
          <div className="bg-slate-900 p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
              <Building2 size={300} className="absolute -bottom-20 -left-20 rotate-12" />
            </div>
            <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                  <Building2 size={32} className="text-blue-400" />
                </div>
                <div>
                  <h2 className="text-3xl font-black">{tower.label}</h2>
                  <p className="text-blue-300 font-bold mt-1 flex items-center gap-2">
                    <Info size={16} /> {floors} طوابق • {apartmentsPerFloor} شقق لكل طابق
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-50">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-8">
                {Array.from({ length: floors }).map((_, fIdx) => {
                  const floorNum = floors - fIdx;
                  return (
                    <div key={floorNum} className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-slate-200" />
                        <span className="bg-white px-4 py-1.5 rounded-full border border-slate-200 text-sm font-black text-slate-500 shadow-sm">
                          {floorNum === 1 ? "الطابق الأرضي" : `الطابق ${floorNum - 1}`}
                        </span>
                        <div className="h-px flex-1 bg-slate-200" />
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Array.from({ length: apartmentsPerFloor }).map((_, aIdx) => {
                          const aptNum = aIdx + 1;
                          const key = `${tower.id}_F${floorNum}_A${aptNum}`;
                          const data = housesData[key] || { status: 'available' };
                          const label = getApartmentLabel(floorNum, aptNum);
                          
                          if (data.status === 'frozen_hidden') return null;

                          return (
                            <button
                              key={key}
                              onClick={() => handleApartmentClick(floorNum, aptNum)}
                              className="group relative bg-white p-4 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-blue-400 transition-all text-right overflow-hidden"
                            >
                              <div className={cn("absolute top-0 right-0 w-1.5 h-full", getStatusColor(data.status))} />
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">شقة {aptNum}</span>
                                <span className="font-black text-slate-800 text-sm truncate">{label}</span>
                                <div className="flex items-center justify-between mt-2">
                                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full text-white", getStatusColor(data.status))}>
                                    {getStatusLabel(data.status)}
                                  </span>
                                  <ChevronRight size={14} className="text-slate-300 group-hover:text-blue-500 group-hover:translate-x-[-2px] transition-all" />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      <UnitDetailsModal
        isOpen={isUnitModalOpen}
        onClose={() => setIsUnitModalOpen(false)}
        onSave={(data) => {
          if (selectedApartmentKey) {
            onSaveApartment(selectedApartmentKey, data);
            setIsUnitModalOpen(false);
          }
        }}
        unitId={selectedApartmentKey}
        unitLabel={selectedApartmentKey ? getApartmentLabel(
          parseInt(selectedApartmentKey.split('_F')[1].split('_A')[0]),
          parseInt(selectedApartmentKey.split('_A')[1])
        ) : ''}
        initialData={selectedApartmentKey ? housesData[selectedApartmentKey] : undefined}
        isApartment={true}
        permissions={permissions}
      />
    </>
  );
};

export default TowerDetailsModal;