"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Home, User, Phone, Info, Building2, Calendar, Banknote, Coins } from "lucide-react";

interface UnitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  unitId: string | null;
  unitLabel?: string;
  initialData?: any;
  isApartment?: boolean;
}

const UnitDetailsModal = ({ isOpen, onClose, onSave, unitId, unitLabel, initialData, isApartment }: UnitDetailsModalProps) => {
  const [formData, setFormData] = React.useState({
    status: 'available',
    name: '',
    phone: '',
    details: '',
    saleDate: '',
    price: '',
    currency: 'دينار',
  });

  React.useEffect(() => {
    if (initialData) {
      setFormData({
        status: initialData.status || 'available',
        name: initialData.name || '',
        phone: initialData.phone || '',
        details: initialData.details || '',
        saleDate: initialData.saleDate || '',
        price: initialData.price || '',
        currency: initialData.currency || 'دينار',
      });
    } else {
      setFormData({
        status: 'available',
        name: '',
        phone: '',
        details: '',
        saleDate: '',
        price: '',
        currency: 'دينار',
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const isAvailable = formData.status === 'available';
  const isFrozen = formData.status.startsWith('frozen');
  const showSaleFields = formData.status === 'sold' || formData.status === 'reserved' || formData.status === 'pending' || formData.status === 'investment';

  // تحويل مسمى العملة إلى رمز
  const getCurrencySymbol = (currency: string) => {
    if (currency === 'دولار') return '$';
    if (currency === 'دينار') return 'د.ع';
    return currency;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black text-right flex items-center gap-2">
            {isApartment ? <Building2 className="w-6 h-6 text-indigo-600" /> : <Home className="w-6 h-6 text-blue-600" />}
            {isApartment ? `تفاصيل الشقة ${unitLabel}` : `تفاصيل المنزل ${unitLabel}`}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-right block font-bold text-slate-600">حالة الوحدة</Label>
            <Select 
              value={formData.status} 
              onValueChange={(v) => setFormData({...formData, status: v})}
            >
              <SelectTrigger className="rounded-xl h-12 border-slate-200 font-bold">
                <SelectValue placeholder="اختر الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">متوفر</SelectItem>
                <SelectItem value="pending">حجز أولي</SelectItem>
                <SelectItem value="reserved">محجوز</SelectItem>
                <SelectItem value="sold">مباع</SelectItem>
                <SelectItem value="investment">استثمار</SelectItem>
                <SelectItem value="frozen_counted">تجميد (محسوب في المجموع)</SelectItem>
                <SelectItem value="frozen_uncounted">تجميد (غير محسوب في المجموع)</SelectItem>
                <SelectItem value="frozen_hidden">تجميد (مخفي من العدد والمجموع)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {showSaleFields && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <Label className="text-right block font-bold text-slate-600">الاسم الكامل</Label>
                <div className="relative">
                  <User className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                  <Input 
                    className="pr-10 rounded-xl h-12 border-slate-200"
                    placeholder="اسم العميل..."
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-right block font-bold text-slate-600">سعر الوحدة</Label>
                  <div className="relative">
                    <Banknote className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                    <div className="pr-10 rounded-xl h-12 border border-slate-200 bg-slate-50 flex items-center font-black text-slate-700">
                      {formData.price || '---'}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-right block font-bold text-slate-600">العملة</Label>
                  <div className="relative">
                    <Coins className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                    <div className="pr-10 rounded-xl h-12 border border-slate-200 bg-slate-50 flex items-center font-black text-slate-700">
                      {getCurrencySymbol(formData.currency)}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-right block font-bold text-slate-600">رقم الهاتف</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                  <Input 
                    type="tel"
                    className="pr-10 rounded-xl h-12 border-slate-200"
                    placeholder="05xxxxxxxx"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-right block font-bold text-slate-600">تاريخ {formData.status === 'sold' ? 'البيع' : 'الحجز'}</Label>
                <div className="relative">
                  <Calendar className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                  <Input 
                    type="date"
                    className="pr-10 rounded-xl h-12 border-slate-200"
                    value={formData.saleDate}
                    onChange={(e) => setFormData({...formData, saleDate: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}

          {(isFrozen || !isAvailable) && (
            <div className="space-y-2">
              <Label className="text-right block font-bold text-slate-600">ملاحظات / سبب التجميد</Label>
              <div className="relative">
                <Info className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                <Input 
                  className="pr-10 rounded-xl h-12 border-slate-200"
                  placeholder="أي تفاصيل أخرى..."
                  value={formData.details}
                  onChange={(e) => setFormData({...formData, details: e.target.value})}
                />
              </div>
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button type="submit" className="w-full rounded-xl h-12 bg-slate-900 hover:bg-slate-800 text-lg font-bold">
              حفظ البيانات
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UnitDetailsModal;