"use client";

import React, { useState, useEffect } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { User, Phone, Calendar, Banknote, Coins, FileText, MessageSquare, Clock, ShieldCheck, Home as HomeIcon, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Note {
  text: string;
  author: string;
  date: string;
}

interface UnitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, data: any) => void;
  unitId: string | null;
  unitLabel?: string;
  initialData?: any;
  permissions: any;
}

const UnitDetailsModal = ({ isOpen, onClose, onSave, unitId, unitLabel, initialData, permissions }: UnitDetailsModalProps) => {
  const [formData, setFormData] = useState({
    status: 'available',
    name: '',
    phone: '',
    saleDate: '',
    price: '',
    currency: 'IQD',
    taboNum: '',
    taboStatus: 'غير مروج',
    handoverDate: '',
    notes: [] as Note[]
  });
  const [newNote, setNewNote] = useState('');

  useEffect(() => {
    if (initialData) {
      setFormData({
        status: initialData.status || 'available',
        name: initialData.name || '',
        phone: initialData.phone || '',
        saleDate: initialData.saleDate || '',
        price: initialData.price || '',
        currency: initialData.currency || 'IQD',
        taboNum: initialData.taboNum || '',
        taboStatus: initialData.taboStatus || 'غير مروج',
        handoverDate: initialData.handoverDate || '',
        notes: Array.isArray(initialData.notes) ? initialData.notes : (initialData.details ? [{ text: initialData.details, author: 'نظام قديم', date: new Date().toISOString() }] : [])
      });
    } else {
      setFormData({
        status: 'available',
        name: '',
        phone: '',
        saleDate: '',
        price: '',
        currency: 'IQD',
        taboNum: '',
        taboStatus: 'غير مروج',
        handoverDate: '',
        notes: []
      });
    }
  }, [initialData, isOpen]);

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const centerName = localStorage.getItem('marketing_center_name') || 'قسم غير معروف';
    const note: Note = {
      text: newNote.trim(),
      author: centerName,
      date: new Date().toISOString()
    };
    const updatedNotes = [note, ...formData.notes];
    setFormData({ ...formData, notes: updatedNotes });
    setNewNote('');
    
    // حفظ الملاحظة فوراً عند الإضافة
    if (unitId) {
      onSave(unitId, { ...formData, notes: updatedNotes });
    }
  };

  const handleSave = () => {
    if (unitId) {
      onSave(unitId, formData);
      onClose();
    }
  };

  const formatPrice = (val: string) => {
    if (!val) return '';
    const clean = val.toString().replace(/,/g, '');
    const num = Number(clean);
    return isNaN(num) ? val : num.toLocaleString('en-US');
  };

  const canEdit = permissions.canEditUnitData;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-[2rem] p-0 overflow-hidden border-none shadow-2xl" dir="rtl">
        <DialogHeader className="bg-blue-600 p-6 text-white">
          <DialogTitle className="text-2xl font-black flex items-center gap-3">
            <HomeIcon size={24} />
            تفاصيل الوحدة: {unitLabel || unitId}
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {permissions.showStatusField && (
              <div className="space-y-2">
                <Label className="font-bold text-slate-600 flex items-center gap-2"><ShieldCheck size={16} /> حالة الوحدة</Label>
                <Select 
                  disabled={!canEdit}
                  value={formData.status} 
                  onValueChange={(val) => setFormData({...formData, status: val})}
                >
                  <SelectTrigger className="rounded-xl h-12 border-slate-200 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="available" className="font-bold text-emerald-600">متوفر</SelectItem>
                    <SelectItem value="sold" className="font-bold text-rose-600">مباع</SelectItem>
                    <SelectItem value="investment" className="font-bold text-purple-600">استثمار</SelectItem>
                    <SelectItem value="reserved" className="font-bold text-amber-600">محجوز</SelectItem>
                    <SelectItem value="pending" className="font-bold text-blue-600">حجز أولي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {permissions.showCustomerName && (
              <div className="space-y-2">
                <Label className="font-bold text-slate-600 flex items-center gap-2"><User size={16} /> اسم الزبون</Label>
                <Input 
                  disabled={!canEdit}
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="rounded-xl h-12 border-slate-200 font-bold"
                  placeholder="اسم الزبون الكامل..."
                />
              </div>
            )}

            {permissions.showCustomerPhone && (
              <div className="space-y-2">
                <Label className="font-bold text-slate-600 flex items-center gap-2"><Phone size={16} /> رقم الهاتف</Label>
                <Input 
                  disabled={!canEdit}
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  className="rounded-xl h-12 border-slate-200 font-bold"
                  placeholder="07XXXXXXXXX"
                />
              </div>
            )}

            {permissions.showSaleDate && (
              <div className="space-y-2">
                <Label className="font-bold text-slate-600 flex items-center gap-2"><Calendar size={16} /> تاريخ البيع / الحجز</Label>
                <Input 
                  disabled={!canEdit}
                  type="date"
                  value={formData.saleDate} 
                  onChange={(e) => setFormData({...formData, saleDate: e.target.value})}
                  className="rounded-xl h-12 border-slate-200 font-bold"
                />
              </div>
            )}

            {permissions.showPrice && (
              <>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-600 flex items-center gap-2"><Banknote size={16} /> السعر</Label>
                  <Input 
                    readOnly
                    disabled
                    value={formatPrice(formData.price)} 
                    className="rounded-xl h-12 border-slate-200 font-bold bg-slate-50 cursor-not-allowed opacity-80"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-slate-600 flex items-center gap-2"><Coins size={16} /> العملة</Label>
                  <Select 
                    disabled={!canEdit}
                    value={formData.currency} 
                    onValueChange={(val) => setFormData({...formData, currency: val})}
                  >
                    <SelectTrigger className="rounded-xl h-12 border-slate-200 font-bold">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="IQD" className="font-bold">دينار عراقي</SelectItem>
                      <SelectItem value="USD" className="font-bold">دولار أمريكي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {permissions.showTaboNum && (
              <div className="space-y-2">
                <Label className="font-bold text-slate-600 flex items-center gap-2"><FileText size={16} /> رقم الطابو</Label>
                <Input 
                  disabled={!canEdit}
                  value={formData.taboNum} 
                  onChange={(e) => setFormData({...formData, taboNum: e.target.value})}
                  className="rounded-xl h-12 border-slate-200 font-bold"
                />
              </div>
            )}

            {permissions.showTaboStatus && (
              <div className="space-y-2">
                <Label className="font-bold text-slate-600 flex items-center gap-2"><ShieldCheck size={16} /> حالة الطابو</Label>
                <Select 
                  disabled={!canEdit}
                  value={formData.taboStatus} 
                  onValueChange={(val) => setFormData({...formData, taboStatus: val})}
                >
                  <SelectTrigger className="rounded-xl h-12 border-slate-200 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="غير مروج" className="font-bold">غير مروج</SelectItem>
                    <SelectItem value="مروج" className="font-bold text-indigo-600">مروج</SelectItem>
                    <SelectItem value="مستلم" className="font-bold text-emerald-600">مستلم</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {permissions.showHandoverInfo && (
              <div className="space-y-2">
                <Label className="font-bold text-slate-600 flex items-center gap-2"><Calendar size={16} /> تاريخ الاستلام</Label>
                <Input 
                  disabled={!canEdit}
                  type="date"
                  value={formData.handoverDate} 
                  onChange={(e) => setFormData({...formData, handoverDate: e.target.value})}
                  className="rounded-xl h-12 border-slate-200 font-bold"
                />
              </div>
            )}
          </div>

          <div className="space-y-4 pt-4 border-t border-slate-100">
            <Label className="font-black text-slate-800 text-lg flex items-center gap-2"><MessageSquare size={20} className="text-blue-600" /> سجل الملاحظات</Label>
            
            <div className="flex gap-2">
              <Textarea 
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="أضف ملاحظة جديدة هنا..."
                className="rounded-xl border-slate-200 font-bold min-h-[80px] resize-none"
              />
              <Button 
                onClick={handleAddNote}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl h-auto px-6 font-black"
              >
                إضافة
              </Button>
            </div>

            <ScrollArea className="h-[200px] w-full rounded-xl border border-slate-100 bg-slate-50/50 p-4">
              <div className="space-y-4">
                {formData.notes.length > 0 ? formData.notes.map((note, idx) => (
                  <div key={idx} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-black text-slate-400">
                      <span className="flex items-center gap-1 text-blue-600"><Store size={10} /> {note.author}</span>
                      <span className="flex items-center gap-1"><Clock size={10} /> {new Date(note.date).toLocaleString('ar-EG')}</span>
                    </div>
                    <p className="text-sm font-bold text-slate-700 leading-relaxed">{note.text}</p>
                  </div>
                )) : (
                  <div className="text-center py-10 text-slate-400 font-bold">لا توجد ملاحظات مسجلة</div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="p-6 bg-slate-50 border-t border-slate-100 flex-row-reverse gap-3">
          {canEdit && (
            <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 rounded-xl h-12 px-8 font-black shadow-lg shadow-blue-100">
              حفظ التغييرات
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} className="rounded-xl h-12 px-6 font-bold">
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnitDetailsModal;