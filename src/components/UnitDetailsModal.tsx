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
import { User, Phone, Calendar, Banknote, Coins, FileText, MessageSquare, Clock, ShieldCheck, Home as HomeIcon, Store, Ruler, AlertTriangle } from 'lucide-react';
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
  unitSize?: number; // حقل المساحة الممرر ديناميكياً من العمارة أو المنزل
}

const UnitDetailsModal = ({ isOpen, onClose, onSave, unitId, unitLabel, initialData, permissions, unitSize }: UnitDetailsModalProps) => {
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

  const currentCenterId = localStorage.getItem('marketing_center_session') || '';
  const currentCenterName = localStorage.getItem('marketing_center_name') || 'قسم غير معروف';

  // التحقق مما إذا كان المستخدم الحالي هو من أنشأ الحجز
  const isBookingOwner = !initialData?.bookedByCenterId || initialData.bookedByCenterId === currentCenterId;

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
    const note: Note = {
      text: newNote.trim(),
      author: currentCenterName,
      date: new Date().toISOString()
    };
    const updatedNotes = [note, ...formData.notes];
    setFormData({ ...formData, notes: updatedNotes });
    setNewNote('');
    
    if (unitId) {
      onSave(unitId, { ...formData, notes: updatedNotes });
    }
  };

  // معالجة تغيير الحالة مع التحديد التلقائي لتاريخ اليوم عند الحجز
  const handleStatusChange = (val: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const updates: any = { status: val };
    
    if (val === 'reserved' || val === 'pending') {
      if (!formData.saleDate) {
        updates.saleDate = todayStr;
      }
    }
    
    setFormData(prev => ({ ...prev, ...updates }));
  };

  // حساب تاريخ انتهاء الحجز الأولي (تلقائياً بعد 7 أيام)
  const getExpiryDate = (saleDateStr: string) => {
    if (!saleDateStr) return '';
    const date = new Date(saleDateStr);
    if (isNaN(date.getTime())) return '';
    date.setDate(date.getDate() + 7);
    return date.toISOString().split('T')[0];
  };

  const handleSave = () => {
    if (!unitId) return;

    const todayStr = new Date().toLocaleDateString('ar-EG');
    const newNotes = [...formData.notes];
    
    const oldStatus = initialData?.status || 'available';
    const newStatus = formData.status;
    const oldName = initialData?.name || '';
    const newName = formData.name;
    
    // 1. توثيق حجز جديد تلقائياً
    if ((oldStatus === 'available' || !oldStatus) && (newStatus === 'reserved' || newStatus === 'pending')) {
      newNotes.unshift({
        text: `قام ${currentCenterName} بعمل حجز باسم (${newName || 'غير محدد'}) بتاريخ ${todayStr}`,
        author: 'النظام تلقائياً',
        date: new Date().toISOString()
      });
    }
    // 2. توثيق إلغاء الحجز تلقائياً
    else if ((oldStatus === 'reserved' || oldStatus === 'pending') && newStatus === 'available') {
      newNotes.unshift({
        text: `قام ${currentCenterName} بإلغاء الحجز وإرجاع الوحدة متوفرة`,
        author: 'النظام تلقائياً',
        date: new Date().toISOString()
      });
    }
    // 3. توثيق تعديل اسم صاحب الحجز تلقائياً
    else if ((newStatus === 'reserved' || newStatus === 'pending') && oldName !== newName && oldStatus === newStatus) {
      newNotes.unshift({
        text: `قام ${currentCenterName} بتعديل اسم صاحب الحجز من (${oldName || 'فارغ'}) إلى (${newName || 'فارغ'})`,
        author: 'النظام تلقائياً',
        date: new Date().toISOString()
      });
    }

    const finalData = {
      ...formData,
      notes: newNotes,
      // حفظ هوية منشئ الحجز عند الحجز لأول مرة
      ...(((oldStatus === 'available' || !oldStatus) && (newStatus === 'reserved' || newStatus === 'pending')) ? {
        bookedByCenterId: currentCenterId,
        bookedByCenterName: currentCenterName
      } : {}),
      // مسح هوية منشئ الحجز عند الإلغاء
      ...(newStatus === 'available' ? {
        bookedByCenterId: null,
        bookedByCenterName: null
      } : {})
    };

    onSave(unitId, finalData);
    onClose();
  };

  const formatPrice = (val: string) => {
    if (!val) return '';
    const clean = val.toString().replace(/,/g, '');
    const num = Number(clean);
    return isNaN(num) ? val : num.toLocaleString('en-US');
  };

  const isSoldOrInvestment = formData.status === 'sold' || formData.status === 'investment';
  const canEdit = permissions.canEditUnitData && !isSoldOrInvestment;

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
          {/* تنبيه ملكية الحجز في حال كان مملوكاً لقسم آخر */}
          {initialData?.bookedByCenterName && initialData.bookedByCenterId !== currentCenterId && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-800 text-xs font-bold animate-in fade-in">
              <AlertTriangle className="text-rose-500 shrink-0 mt-0.5" size={16} />
              <div>
                <p>تنبيه ملكية الحجز:</p>
                <p className="font-black mt-1">هذا الحجز مملوك لـ ({initialData.bookedByCenterName})، ولا تملك صلاحية إلغائه أو إرجاعه متوفراً.</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {permissions.showStatusField && (
              <div className="space-y-2">
                <Label className="font-bold text-slate-600 flex items-center gap-2"><ShieldCheck size={16} /> حالة الوحدة</Label>
                <Select 
                  disabled={!permissions.canEditUnitData || isSoldOrInvestment}
                  value={formData.status} 
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger className="rounded-xl h-12 border-slate-200 font-bold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    {isSoldOrInvestment ? (
                      <>
                        {formData.status === 'sold' && <SelectItem value="sold" className="font-bold text-rose-600">مباع</SelectItem>}
                        {formData.status === 'investment' && <SelectItem value="investment" className="font-bold text-purple-600">استثمار</SelectItem>}
                      </>
                    ) : (
                      <>
                        {/* تعطيل خيار متاح إذا لم يكن المستخدم هو مالك الحجز */}
                        <SelectItem value="available" disabled={!isBookingOwner} className="font-bold text-emerald-600">
                          متوفر {!isBookingOwner && "(مغلق - لست منشئ الحجز)"}
                        </SelectItem>
                        <SelectItem value="reserved" className="font-bold text-amber-600">محجوز</SelectItem>
                        <SelectItem value="pending" className="font-bold text-blue-600">حجز أولي</SelectItem>
                        <SelectItem value="frozen_counted" className="font-bold text-slate-500">مجمدة (داخل المجموع)</SelectItem>
                        <SelectItem value="frozen_uncounted" className="font-bold text-slate-500">مجمدة (خارج المجموع)</SelectItem>
                        <SelectItem value="frozen_hidden" className="font-bold text-slate-500">مجمدة (مخفية من العدد)</SelectItem>
                      </>
                    )}
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

            {/* حقل تاريخ الانتهاء للحجز الأولي */}
            {formData.status === 'pending' && formData.saleDate && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <Label className="font-bold text-rose-600 flex items-center gap-2">
                  <Calendar size={16} /> تاريخ الانتهاء (تلقائي بعد 7 أيام)
                </Label>
                <Input 
                  readOnly
                  disabled
                  type="date"
                  value={getExpiryDate(formData.saleDate)} 
                  className="rounded-xl h-12 border-rose-200 font-bold bg-rose-50/30 text-rose-900 cursor-not-allowed opacity-90"
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

            {/* عرض مساحة الوحدة السكنية كحقل قراءة فقط أنيق ومميز */}
            {unitSize !== undefined && unitSize > 0 && (
              <div className="space-y-2">
                <Label className="font-bold text-slate-600 flex items-center gap-2">
                  <Ruler size={16} className="text-blue-600" /> مساحة الوحدة السكنية
                </Label>
                <Input 
                  readOnly
                  disabled
                  value={`${unitSize} م²`} 
                  className="rounded-xl h-12 border-slate-200 font-black bg-blue-50/30 text-blue-900 cursor-not-allowed opacity-90"
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
          {permissions.canEditUnitData && !isSoldOrInvestment && (
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