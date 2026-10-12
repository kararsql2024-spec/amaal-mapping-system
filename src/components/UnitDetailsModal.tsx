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
import { User, Phone, Calendar, Banknote, Coins, FileText, Clock, ShieldCheck, Store, Ruler, AlertTriangle, FileSpreadsheet, Receipt, Bed } from 'lucide-react';
import { findTourForUnit } from '@/tour/match';
import { useTourTemplates } from '@/tour/storage';
import { cn } from '@/lib/utils';
import { canAccessPaymentForm, canAccessTour } from '@/lib/dept-permissions';
import { getStatusMeta } from '@/lib/unit-status';
import { Eyebrow } from '@/components/layout/AppShell';

interface Note {
  text: string;
  author: string;
  date: string;
}

/** Label + control pair; replaces the block that was repeated for every field. */
const Field = ({
  icon,
  label,
  children,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  tone?: 'default' | 'muted';
}) => (
  <div className="space-y-1.5">
    <Label className={cn("flex items-center gap-1.5", tone === 'muted' && "text-fg-faint")}>
      <span className="text-fg-faint">{icon}</span>
      {label}
    </Label>
    {children}
  </div>
);

const Notice = ({
  tone,
  title,
  body,
}: {
  tone: 'danger' | 'warning';
  title: string;
  body: string;
}) => (
  <div
    className={cn(
      "flex items-start gap-2.5 border px-3.5 py-3",
      tone === 'danger'
        ? "border-status-sold/30 bg-status-sold/[0.05]"
        : "border-status-reserved/35 bg-status-reserved/[0.05]",
    )}
  >
    <AlertTriangle
      size={14}
      className={cn(
        "mt-0.5 shrink-0",
        tone === 'danger' ? "text-status-sold" : "text-status-reserved",
      )}
    />
    <div className="space-y-1">
      <p className="text-[12px] font-medium text-fg">{title}</p>
      <p className="text-[12px] leading-relaxed text-fg-secondary">{body}</p>
    </div>
  </div>
);

const StatusOption = ({ status, label }: { status: string; label: string }) => (
  <span className="flex items-center gap-2">
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: getStatusMeta(status).fill }}
    />
    {label}
  </span>
);

interface UnitDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (key: string, data: any) => void;
  unitId: string | null;
  unitLabel?: string;
  initialData?: any;
  permissions: any;
  unitSize?: number; // حقل المساحة الممرر ديناميكياً من العمارة أو المنزل
  projectId?: string; // معرف المشروع الممرر ديناميكياً لتشغيل البروشور
}

const UnitDetailsModal = ({ isOpen, onClose, onSave, unitId, unitLabel, initialData, permissions, unitSize, projectId }: UnitDetailsModalProps) => {
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

  // التحقق الدقيق مما إذا كانت الوحدة محجوزة حالياً ومن هو مالك الحجز
  const isCurrentlyBooked = initialData?.status === 'reserved' || initialData?.status === 'pending';
  
  // الحجز القديم غير المتبنى هو الحجز النشط الذي لا يحتوي على معرف مالك مسجل
  const isOldUnadoptedBooking = isCurrentlyBooked && !initialData?.bookedByCenterId;

  // المالك هو: إذا لم تكن محجوزة، أو إذا كان الحجز قديماً بلا مالك محدد (للتبني التلقائي)، أو إذا كان معرف المالك يطابق المستخدم الحالي
  const isBookingOwner = !isCurrentlyBooked || isOldUnadoptedBooking || (initialData?.bookedByCenterId === currentCenterId);

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

    // تحديد هوية مالك الحجز النهائي
    let finalBookedByCenterId = initialData?.bookedByCenterId || null;
    let finalBookedByCenterName = initialData?.bookedByCenterName || null;

    if (newStatus === 'available') {
      finalBookedByCenterId = null;
      finalBookedByCenterName = null;
    } else if (newStatus === 'reserved' || newStatus === 'pending') {
      // إذا كان الحجز جديداً (كان متوفراً سابقاً) أو كان قديماً غير متبنى
      if (oldStatus === 'available' || !oldStatus || isOldUnadoptedBooking) {
        finalBookedByCenterId = currentCenterId;
        finalBookedByCenterName = currentCenterName;
        
        // توثيق عملية التبني التلقائي في سجل الملاحظات
        if (isOldUnadoptedBooking) {
          newNotes.unshift({
            text: `تم تبني هذا الحجز القديم وتسجيله رسمياً باسم (${currentCenterName})`,
            author: 'النظام تلقائياً',
            date: new Date().toISOString()
          });
        }
      }
    }

    let finalData = {
      ...formData,
      notes: newNotes,
      bookedByCenterId: finalBookedByCenterId,
      bookedByCenterName: finalBookedByCenterName
    };

    // تصفير كافة البيانات الأخرى عند إلغاء الحجز وإرجاع الوحدة متوفرة
    if (newStatus === 'available') {
      finalData = {
        ...finalData,
        name: '',
        phone: '',
        saleDate: '',
        price: '',
        currency: 'IQD',
        taboNum: '',
        taboStatus: 'غير مروج',
        handoverDate: ''
      };
    }

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
  // لا يمكن التعديل إذا كانت الوحدة مباعة/استثمار، أو إذا لم يكن المستخدم الحالي هو منشئ الحجز
  const canEdit = permissions.canEditUnitData && !isSoldOrInvestment && isBookingOwner;

  // فتح صفحة بروشور مستقلة للوحدة السكنية
  const handleOpenBrochure = () => {
    if (projectId && unitId) {
      const qs = currentCenterId ? `?center=${encodeURIComponent(currentCenterId)}` : "";
      window.open(`/brochure/${projectId}/${unitId}${qs}`, "_blank");
    }
  };

  const handleOpenPaymentPlan = () => {
    if (projectId && unitId) {
      window.open(`/sales/new/${projectId}/${unitId}`, "_blank");
    }
  };

  const tours = useTourTemplates();
  const tour = isOpen ? findTourForUnit({ unitId, unitLabel, unitSize, projectId }, tours) : null;
  const handleOpenTour = () => {
    if (tour) window.open(`/tour/${tour.id}`, "_blank");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0" dir="rtl">
        <DialogHeader className="flex flex-row items-center justify-between gap-4 space-y-0 border-b border-line px-5 py-4 pe-12 text-start">
          <div className="min-w-0">
            <Eyebrow>الوحدة</Eyebrow>
            <DialogTitle className="mt-1.5 truncate text-lg font-normal">
              {unitLabel || unitId}
            </DialogTitle>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {tour && canAccessTour(permissions) && (
              <Button variant="outline" size="sm" onClick={handleOpenTour} className="gap-1.5">
                <Bed size={13} /> جولة داخل الوحدة
              </Button>
            )}
            {projectId && unitId && permissions?.showBrochureButton !== false && (
              <Button variant="outline" size="sm" onClick={handleOpenBrochure} className="gap-1.5">
                <FileSpreadsheet size={13} /> البروشور
              </Button>
            )}
            {projectId && unitId && canAccessPaymentForm(permissions) && (
              <Button variant="outline" size="sm" onClick={handleOpenPaymentPlan} className="gap-1.5">
                <Receipt size={13} /> تنظيم الدفعات
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-6 overflow-y-auto p-5">
          {!isBookingOwner && (
            <Notice
              tone="danger"
              title="تنبيه ملكية الحجز"
              body={`هذا الحجز مملوك لـ (${initialData?.bookedByCenterName || 'قسم آخر'})، ولا تملك صلاحية تعديله أو إلغائه وإرجاعه متوفراً.`}
            />
          )}

          {isOldUnadoptedBooking && (
            <Notice
              tone="warning"
              title="تنبيه حجز قديم"
              body={`هذا الحجز قديم وغير متبنى من أي قسم. يمكنك تعديله أو إلغاؤه بشكل طبيعي، وعند الحفظ سيتم تسجيله باسم قسمك (${currentCenterName}) تلقائياً.`}
            />
          )}

          <div className="grid grid-cols-1 gap-x-5 gap-y-4 md:grid-cols-2">
            {permissions.showStatusField && (
              <Field icon={<ShieldCheck size={13} />} label="حالة الوحدة">
                <Select 
                  disabled={!permissions.canEditUnitData || isSoldOrInvestment || !isBookingOwner}
                  value={formData.status} 
                  onValueChange={handleStatusChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isSoldOrInvestment ? (
                      <>
                        {formData.status === 'sold' && <SelectItem value="sold"><StatusOption status="sold" label="مباع" /></SelectItem>}
                        {formData.status === 'investment' && <SelectItem value="investment"><StatusOption status="investment" label="استثمار" /></SelectItem>}
                      </>
                    ) : (
                      <>
                        <SelectItem value="available"><StatusOption status="available" label="متوفر" /></SelectItem>
                        <SelectItem value="reserved"><StatusOption status="reserved" label="محجوز" /></SelectItem>
                        <SelectItem value="pending"><StatusOption status="pending" label="حجز أولي" /></SelectItem>
                        <SelectItem value="frozen_counted"><StatusOption status="frozen_counted" label="مجمدة (داخل المجموع)" /></SelectItem>
                        <SelectItem value="frozen_uncounted"><StatusOption status="frozen_uncounted" label="مجمدة (خارج المجموع)" /></SelectItem>
                        <SelectItem value="frozen_hidden"><StatusOption status="frozen_hidden" label="مجمدة (مخفية من العدد)" /></SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {permissions.showCustomerName && (
              <Field icon={<User size={13} />} label="اسم الزبون">
                <Input 
                  disabled={!canEdit}
                  value={formData.name} 
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="اسم الزبون الكامل"
                />
              </Field>
            )}

            {permissions.showCustomerPhone && (
              <Field icon={<Phone size={13} />} label="رقم الهاتف">
                <Input 
                  disabled={!canEdit}
                  value={formData.phone} 
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  placeholder="07XXXXXXXXX"
                  className="tabular"
                />
              </Field>
            )}

            {permissions.showSaleDate && (
              <Field icon={<Calendar size={13} />} label="تاريخ البيع / الحجز">
                <Input 
                  disabled={!canEdit}
                  type="date"
                  value={formData.saleDate} 
                  onChange={(e) => setFormData({...formData, saleDate: e.target.value})}
                />
              </Field>
            )}

            {formData.status === 'pending' && formData.saleDate && (
              <Field icon={<Calendar size={13} />} label="تاريخ الانتهاء (تلقائي بعد 7 أيام)">
                <Input 
                  readOnly
                  disabled
                  type="date"
                  value={getExpiryDate(formData.saleDate)} 
                  className="border-status-reserved/40 bg-status-reserved/[0.06]"
                />
              </Field>
            )}

            {permissions.showPrice && (
              <>
                <Field icon={<Banknote size={13} />} label="السعر">
                  <Input 
                    readOnly
                    disabled
                    value={formatPrice(formData.price)} 
                    className="bg-surface-sunken tabular"
                    placeholder="0"
                  />
                </Field>
                <Field icon={<Coins size={13} />} label="العملة">
                  <Select 
                    disabled={!canEdit}
                    value={formData.currency} 
                    onValueChange={(val) => setFormData({...formData, currency: val})}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="IQD">دينار عراقي</SelectItem>
                      <SelectItem value="USD">دولار أمريكي</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </>
            )}

            {permissions.showTaboNum && (
              <Field icon={<FileText size={13} />} label="رقم الطابو">
                <Input 
                  disabled={!canEdit}
                  value={formData.taboNum} 
                  onChange={(e) => setFormData({...formData, taboNum: e.target.value})}
                  className="tabular"
                />
              </Field>
            )}

            {permissions.showTaboStatus && (
              <Field icon={<ShieldCheck size={13} />} label="حالة الطابو">
                <Select 
                  disabled={!canEdit}
                  value={formData.taboStatus} 
                  onValueChange={(val) => setFormData({...formData, taboStatus: val})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="غير مروج">غير مروج</SelectItem>
                    <SelectItem value="مروج">مروج</SelectItem>
                    <SelectItem value="مستلم">مستلم</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}

            {permissions.showHandoverInfo && (
              <Field icon={<Calendar size={13} />} label="تاريخ الاستلام">
                <Input 
                  disabled={!canEdit}
                  type="date"
                  value={formData.handoverDate} 
                  onChange={(e) => setFormData({...formData, handoverDate: e.target.value})}
                />
              </Field>
            )}

            {unitSize !== undefined && unitSize > 0 && (
              <Field icon={<Ruler size={13} />} label="مساحة الوحدة">
                <Input 
                  readOnly
                  disabled
                  value={`${unitSize} م²`} 
                  className="bg-surface-sunken tabular"
                />
              </Field>
            )}
          </div>

          <div className="space-y-3 border-t border-line pt-5">
            <Eyebrow>سجل الملاحظات</Eyebrow>

            <div className="flex gap-2">
              <Textarea 
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="أضف ملاحظة جديدة"
                className="min-h-[68px] resize-none"
              />
              <Button onClick={handleAddNote} className="h-auto shrink-0 px-5">
                إضافة
              </Button>
            </div>

            <ScrollArea className="h-[190px] w-full border border-line bg-surface-sunken">
              {formData.notes.length > 0 ? (
                <div className="divide-y divide-line">
                  {formData.notes.map((note, idx) => (
                    <div key={idx} className="space-y-1.5 bg-surface px-3.5 py-3">
                      <div className="flex items-center justify-between gap-3 text-[11px] text-fg-faint">
                        <span className="flex items-center gap-1 text-fg-secondary"><Store size={10} /> {note.author}</span>
                        <span className="flex items-center gap-1"><Clock size={10} /> {new Date(note.date).toLocaleString('ar-EG')}</span>
                      </div>
                      <p className="text-[13px] leading-relaxed text-fg">{note.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex h-[190px] items-center justify-center text-[13px] text-fg-faint">
                  لا توجد ملاحظات مسجلة
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="flex-row-reverse gap-2 border-t border-line bg-surface-sunken px-5 py-3.5">
          {permissions.canEditUnitData && !isSoldOrInvestment && isBookingOwner && (
            <Button onClick={handleSave} className="px-6">
              حفظ التغييرات
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnitDetailsModal;