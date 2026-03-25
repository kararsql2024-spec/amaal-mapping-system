"use client";

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2, LayoutGrid, CheckCircle2, Clock, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

interface TowerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tower: any;
  housesData: Record<string, any>;
  onSaveApartment: (apartmentKey: string, data: any) => void;
}

const TowerDetailsModal = ({ isOpen, onClose, tower, housesData, onSaveApartment }: TowerDetailsModalProps) => {
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [editingApt, setEditingApt] = useState<string | null>(null);

  if (!tower) return null;

  const floors = Array.from({ length: tower.floors || 1 }, (_, i) => i + 1);
  const apts = Array.from({ length: tower.apartmentsPerFloor || 1 }, (_, i) => i + 1);

  const getAptKey = (floor: number, aptNum: number) => `${tower.id}_F${floor}_A${aptNum}`;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sold': return 'bg-rose-500 text-white border-rose-600';
      case 'pending': return 'bg-blue-500 text-white border-blue-600';
      case 'reserved': return 'bg-amber-400 text-white border-amber-500';
      default: return 'bg-emerald-500 text-white border-emerald-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'sold': return 'مباع';
      case 'pending': return 'حجز أولي';
      case 'reserved': return 'محجوز';
      default: return 'متوفر';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden border-none" dir="rtl">
        <div className="flex h-[600px]">
          {/* Sidebar: Floors */}
          <div className="w-48 bg-slate-50 border-l border-slate-100 p-6 overflow-y-auto">
            <h3 className="font-black text-slate-400 text-xs uppercase mb-4 tracking-wider">الطوابق</h3>
            <div className="space-y-2">
              {floors.reverse().map((floor) => (
                <button
                  key={floor}
                  onClick={() => setSelectedFloor(floor)}
                  className={cn(
                    "w-full p-4 rounded-2xl font-bold transition-all text-right flex items-center justify-between",
                    selectedFloor === floor 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200 scale-105" 
                      : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-100"
                  )}
                >
                  <span>الطابق {floor}</span>
                  {selectedFloor === floor && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </button>
              ))}
            </div>
          </div>

          {/* Main: Apartments Grid */}
          <div className="flex-1 p-8 bg-white overflow-y-auto">
            <DialogHeader className="mb-8">
              <DialogTitle className="text-3xl font-black flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center">
                  <Building2 className="text-white" />
                </div>
                <div>
                  <p className="text-sm text-slate-400 font-bold">تفاصيل البرج: {tower.label}</p>
                  <p>الطابق {selectedFloor}</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-4">
              {apts.map((aptNum) => {
                const key = getAptKey(selectedFloor, aptNum);
                const data = housesData[key] || { status: 'available' };
                
                return (
                  <div 
                    key={key}
                    className={cn(
                      "p-6 rounded-[2rem] border-2 transition-all cursor-pointer group relative overflow-hidden",
                      getStatusColor(data.status)
                    )}
                    onClick={() => {
                      const nextStatus = data.status === 'available' ? 'pending' : 
                                       data.status === 'pending' ? 'reserved' :
                                       data.status === 'reserved' ? 'sold' : 'available';
                      onSaveApartment(key, { ...data, status: nextStatus });
                    }}
                  >
                    <div className="relative z-10">
                      <p className="text-xs font-bold opacity-80 mb-1">شقة رقم</p>
                      <p className="text-3xl font-black">{aptNum}</p>
                      <div className="mt-4 flex items-center gap-2 text-xs font-bold bg-black/10 w-fit px-3 py-1 rounded-full">
                        {getStatusLabel(data.status)}
                      </div>
                    </div>
                    <LayoutGrid className="absolute -bottom-4 -left-4 w-20 h-20 opacity-10 group-hover:scale-110 transition-transform" />
                  </div>
                );
              })}
            </div>
            
            <div className="mt-12 p-6 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200 text-center">
              <p className="text-slate-500 font-bold text-sm">انقر على الشقة لتغيير حالتها (متوفر -> حجز -> محجوز -> مباع)</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TowerDetailsModal;