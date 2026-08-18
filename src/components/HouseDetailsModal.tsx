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
import { Home, User, Phone, MapPin, Info } from "lucide-react";

interface HouseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => void;
  houseId: string | null;
  initialData?: any;
}

const HouseDetailsModal = ({ isOpen, onClose, onSave, houseId, initialData }: HouseDetailsModalProps) => {
  const [formData, setFormData] = React.useState({
    status: 'available',
    address: '',
    name: '',
    phone: '',
    details: '',
  });

  React.useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      setFormData({
        status: 'available',
        address: '',
        name: '',
        phone: '',
        details: '',
      });
    }
  }, [initialData, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  // Logic from your jQuery: Hide fields if status is 'available' (متوفر)
  const isAvailable = formData.status === 'available';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px] rounded-3xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-right flex items-center gap-2">
            <Home className="w-6 h-6 text-blue-600" />
            تفاصيل العقار #{houseId}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-right block font-semibold">حالة العقار</Label>
            <Select 
              value={formData.status} 
              onValueChange={(v) => setFormData({...formData, status: v})}
            >
              <SelectTrigger className="rounded-xl h-12 border-slate-200">
                <SelectValue placeholder="اختر حالة العقار" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">متوفر</SelectItem>
                <SelectItem value="pending">حجز أولي</SelectItem>
                <SelectItem value="reserved">محجوز</SelectItem>
                <SelectItem value="sold">مباع</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!isAvailable && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <Label className="text-right block font-semibold">عنوان العقار</Label>
                <div className="relative">
                  <MapPin className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                  <Input 
                    className="pr-10 rounded-xl h-12 border-slate-200"
                    placeholder="ادخل عنوان العقار ..."
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-right block font-semibold">الاسم</Label>
                <div className="relative">
                  <User className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                  <Input 
                    className="pr-10 rounded-xl h-12 border-slate-200"
                    placeholder="ادخل اسم الشخص ..."
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-right block font-semibold">رقم الهاتف</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                  <Input 
                    type="tel"
                    className="pr-10 rounded-xl h-12 border-slate-200"
                    placeholder="ادخل رقم الهاتف ..."
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-right block font-semibold">تفاصيل اضافية</Label>
                <div className="relative">
                  <Info className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                  <Input 
                    className="pr-10 rounded-xl h-12 border-slate-200"
                    placeholder="ادخل التفاصيل الاضافية ..."
                    value={formData.details}
                    onChange={(e) => setFormData({...formData, details: e.target.value})}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="sm:justify-start gap-2 pt-4">
            <Button type="submit" className="w-full rounded-xl h-12 bg-blue-600 hover:bg-blue-700 text-lg font-bold">
              حفظ
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default HouseDetailsModal;