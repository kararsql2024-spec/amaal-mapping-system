"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Home,
  Lock,
  Plus,
  Printer,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, Eyebrow, LoadingBlock } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { showError, showSuccess } from "@/utils/toast";
import {
  addMonths,
  calculatePaymentTotal,
  createInstallmentId,
  formatDateOnly,
  formatPaymentDisplayDate,
  recalculateUnlockedInstallments,
  validatePaymentTotals,
} from "@/lib/payment-installments";
import { verifyCenterPassword } from "@/lib/center-auth";
import { formatPaymentUnitNumber } from "@/lib/unit-label-parser";
import { fetchPaymentUnitSettings, getPaymentProjectUnitSettings } from "@/lib/payment-settings";
import { resolveHouseTypeSelection } from "@/lib/payment-unit-resolver";
import { canAccessPaymentArchive, fetchSessionDeptPermissions } from "@/lib/dept-permissions";
import type { PaymentBookingRecord, PaymentHouseTypeConfig, PaymentInstallment } from "@/lib/payment-types";
import { cn } from "@/lib/utils";

const ITEMS_PER_PAGE = 10;

const SalesArchive = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [bookings, setBookings] = useState<PaymentBookingRecord[]>([]);
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [centerId, setCenterId] = useState<string | null>(null);
  const [centerName, setCenterName] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [statsFilterMode, setStatsFilterMode] = useState<"today" | "all" | "custom">("today");
  const [statsStartDate, setStatsStartDate] = useState("");
  const [statsEndDate, setStatsEndDate] = useState("");
  const [filters, setFilters] = useState({
    projectId: "all",
    clientName: "",
    phone: "",
    unitNum: "",
    address: "",
    education: "",
    discovery: "",
    startDate: "",
    endDate: "",
  });
  const [editingBooking, setEditingBooking] = useState<
    (PaymentBookingRecord & { installments_count?: number }) | null
  >(null);
  const [changeReason, setChangeReason] = useState("");
  const [centerPassword, setCenterPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [editHouseTypes, setEditHouseTypes] = useState<PaymentHouseTypeConfig[]>([]);

  const editValidation = useMemo(() => {
    if (!editingBooking) return { ok: true };
    return validatePaymentTotals(
      editingBooking.total_price,
      editingBooking.signing_amount,
      editingBooking.installments || [],
    );
  }, [editingBooking]);

  useEffect(() => {
    const init = async () => {
      try {
        const { center, permissions } = await fetchSessionDeptPermissions(supabase);
        if (!center) {
          showError("يجب تسجيل الدخول كقسم تسويقي أولاً");
          navigate("/");
          return;
        }
        if (!canAccessPaymentArchive(permissions)) {
          showError("ليس لديك صلاحية الوصول إلى أرشيف استمارات الدفعات");
          navigate("/");
          return;
        }

        setCenterId(center.id);
        setCenterName(localStorage.getItem("marketing_center_name") || center.name || "");
        await bootstrap(center.id);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  useEffect(() => {
    const loadHouseTypes = async () => {
      if (!editingBooking?.project_id) {
        setEditHouseTypes([]);
        return;
      }
      const map = await fetchPaymentUnitSettings(supabase);
      setEditHouseTypes(getPaymentProjectUnitSettings(map, editingBooking.project_id).house_types);
    };
    loadHouseTypes();
  }, [editingBooking?.project_id]);

  const bootstrap = async (savedCenterId: string) => {
    try {
      const { data: projectsData } = await supabase.from("projects").select("id, name");
      setProjects(projectsData || []);
      await searchBookings(savedCenterId);
    } catch (error) {
      console.error(error);
    }
  };

  const searchBookings = async (activeCenterId = centerId) => {
    if (!activeCenterId) return;
    setSearching(true);
    try {
      let query = supabase.from("payment_bookings").select("*").eq("marketing_center_id", activeCenterId);

      if (filters.projectId !== "all") query = query.eq("project_id", filters.projectId);
      if (filters.clientName) query = query.ilike("client_name", `%${filters.clientName}%`);
      if (filters.phone) query = query.or(`phone1.ilike.%${filters.phone}%,phone2.ilike.%${filters.phone}%`);
      if (filters.address) query = query.ilike("address", `%${filters.address}%`);
      if (filters.education) query = query.ilike("education", `%${filters.education}%`);
      if (filters.discovery) query = query.ilike("discovery_method", `%${filters.discovery}%`);
      if (filters.startDate) query = query.gte("created_at", filters.startDate);
      if (filters.endDate) query = query.lte("created_at", `${filters.endDate}T23:59:59`);

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;

      let filtered = (data || []) as PaymentBookingRecord[];
      if (filters.unitNum) {
        filtered = filtered.filter((b) =>
          formatPaymentUnitNumber(b).toLowerCase().includes(filters.unitNum.toLowerCase()),
        );
      }

      setBookings(filtered);
      setCurrentPage(1);
    } catch (error: any) {
      console.error(error);
      showError(error.message || "تعذر تحميل الأرشيف");
    } finally {
      setSearching(false);
    }
  };

  const recalculateForEdit = (installments: PaymentInstallment[]) => {
    if (!editingBooking) return installments;
    return recalculateUnlockedInstallments(
      installments,
      editingBooking.total_price,
      editingBooking.signing_amount,
    );
  };

  const generateInstallmentsForEdit = () => {
    if (!editingBooking) return;
    const price = Number(editingBooking.total_price) || 0;
    const signing = Number(editingBooking.signing_amount) || 0;
    const count = Number(editingBooking.installments_count) || 6;
    if (price <= 0) return showError("يرجى إدخال السعر الإجمالي أولاً");

    const totalToDistribute = price - signing;
    const baseMillion = Math.floor(totalToDistribute / count / 1_000_000) * 1_000_000;
    const diff = totalToDistribute - baseMillion * count;
    const today = new Date();
    const next: PaymentInstallment[] = [];

    for (let i = 0; i < count; i++) {
      let amount = baseMillion;
      if (count >= 2) {
        if (i === count - 2 && diff > 0 && diff % 2_000_000 === 0) amount += diff / 2;
        else if (i === count - 1 && diff > 0) {
          amount += diff % 2_000_000 === 0 ? diff / 2 : diff;
        }
      } else if (i === count - 1) {
        amount += diff;
      }

      next.push({
        id: createInstallmentId(),
        date: formatDateOnly(addMonths(today, (i + 1) * 6)),
        amount: Math.floor(amount).toString(),
        label: `الدفعة ${i + 1}`,
        isLocked: false,
      });
    }

    setEditingBooking({ ...editingBooking, installments: next });
    showSuccess("تم توليد الدفعات");
  };

  const handleUpdate = async () => {
    if (!editingBooking || !centerId) return;
    if (!changeReason.trim()) return showError("يرجى ذكر سبب التعديل");
    if (!centerPassword.trim()) return showError("يرجى إدخال كلمة مرور القسم");
    if (!editValidation.ok) {
      return showError(editValidation.message || "مجموع الدفعات لا يطابق سعر البيع");
    }

    const passwordOk = await verifyCenterPassword(supabase, centerId, centerPassword);
    if (!passwordOk) return showError("كلمة مرور القسم غير صحيحة");

    setSaving(true);
    try {
      const { data: original, error: fetchError } = await supabase
        .from("payment_bookings")
        .select("*")
        .eq("id", editingBooking.id)
        .single();
      if (fetchError) throw fetchError;

      const changes: string[] = [];
      const fields = [
        { key: "client_name", label: "اسم العميل" },
        { key: "phone1", label: "الهاتف 1" },
        { key: "total_price", label: "السعر الإجمالي" },
        { key: "signing_amount", label: "مبلغ التوقيع" },
        { key: "housing_condition_amount", label: "شرط السكن" },
      ] as const;

      fields.forEach((field) => {
        if (String(original[field.key] ?? "") !== String(editingBooking[field.key] ?? "")) {
          changes.push(`${field.label}: [${original[field.key]}] -> [${editingBooking[field.key]}]`);
        }
      });

      const { error } = await supabase
        .from("payment_bookings")
        .update({
          client_name: editingBooking.client_name,
          phone1: editingBooking.phone1,
          phone2: editingBooking.phone2,
          address: editingBooking.address,
          education: editingBooking.education,
          unit_type: editingBooking.unit_type,
          zone: editingBooking.zone,
          block: editingBooking.block,
          house_type: editingBooking.house_type,
          house_num: editingBooking.house_num,
          building: editingBooking.building,
          floor: editingBooking.floor,
          apartment: editingBooking.apartment,
          total_area: editingBooking.total_area,
          net_area: editingBooking.net_area,
          delivery_period: editingBooking.delivery_period,
          total_price: Number(editingBooking.total_price),
          signing_amount: Number(editingBooking.signing_amount),
          housing_condition_amount: editingBooking.housing_condition_amount
            ? Number(editingBooking.housing_condition_amount)
            : null,
          discovery_method: editingBooking.discovery_method,
          discovery_relation: editingBooking.discovery_relation,
          discovery_phone: editingBooking.discovery_phone,
          show_commission_note: editingBooking.show_commission_note,
          installments: editingBooking.installments,
          notes: editingBooking.notes,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingBooking.id)
        .eq("marketing_center_id", centerId);

      if (error) throw error;

      await supabase.from("payment_audit_logs").insert([
        {
          booking_id: editingBooking.id,
          marketing_center_id: centerId,
          change_reason: `${changeReason} | التغييرات: ${changes.join(" | ")}`,
          changed_by: centerName || "قسم",
        },
      ]);

      showSuccess("تم تحديث البيانات بنجاح");
      setEditingBooking(null);
      setChangeReason("");
      setCenterPassword("");
      await searchBookings();
    } catch (error: any) {
      showError(error.message || "فشل حفظ التعديل");
    } finally {
      setSaving(false);
    }
  };

  const statsBookings = useMemo(() => {
    const todayStr = formatDateOnly(new Date());
    return bookings.filter((b) => {
      const bookingDate = formatDateOnly(new Date(b.created_at));
      if (statsFilterMode === "today") return bookingDate === todayStr;
      if (statsFilterMode === "custom") {
        let match = true;
        if (statsStartDate) match = match && bookingDate >= statsStartDate;
        if (statsEndDate) match = match && bookingDate <= statsEndDate;
        return match;
      }
      return true;
    });
  }, [bookings, statsFilterMode, statsStartDate, statsEndDate]);

  const totalPages = Math.ceil(bookings.length / ITEMS_PER_PAGE);
  const currentBookings = bookings.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  const projectName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-24 lg:px-8">
        <LoadingBlock label="جاري تحميل الأرشيف" />
      </div>
    );
  }

  return (
    <AppShell
      brandSubtitle="أرشيف الدفعات"
      nav={
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-1.5">
            <ArrowRight size={14} /> الخريطة
          </Button>
        </Link>
      }
    >
      <div className="py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>الأرشيف</Eyebrow>
            <h1 className="mt-3 text-[32px] font-light tracking-display text-fg">أرشيف الاستمارات</h1>
            <p className="mt-2 text-[13px] text-fg-secondary">
              {centerName ? `المركز: ${centerName}` : ""} · إجمالي النتائج: {bookings.length}
            </p>
          </div>
        </div>

        <section className="mt-8 space-y-4 border border-line p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-fg-secondary">تصفية الإحصائيات:</span>
            {(["today", "all", "custom"] as const).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={statsFilterMode === mode ? "default" : "outline"}
                onClick={() => setStatsFilterMode(mode)}
              >
                {mode === "today" ? "اليوم" : mode === "all" ? "كافة البيانات" : "فترة مخصصة"}
              </Button>
            ))}
          </div>

          {statsFilterMode === "custom" && (
            <div className="flex flex-wrap gap-3">
              <Input type="date" value={statsStartDate} onChange={(e) => setStatsStartDate(e.target.value)} />
              <Input type="date" value={statsEndDate} onChange={(e) => setStatsEndDate(e.target.value)} />
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-4">
            <div className="border border-line p-4">
              <p className="flex items-center gap-1.5 text-[11px] text-fg-secondary">
                <TrendingUp size={12} /> إجمالي قيمة المبيعات
              </p>
              <p className="mt-2 text-[18px] tabular-nums">
                {statsBookings.reduce((s, b) => s + (Number(b.total_price) || 0), 0).toLocaleString("en-US")} د.ع
              </p>
            </div>
            <div className="border border-line p-4">
              <p className="flex items-center gap-1.5 text-[11px] text-fg-secondary">
                <DollarSign size={12} /> إجمالي مبالغ التوقيع
              </p>
              <p className="mt-2 text-[18px] tabular-nums">
                {statsBookings.reduce((s, b) => s + (Number(b.signing_amount) || 0), 0).toLocaleString("en-US")} د.ع
              </p>
            </div>
            <div className="border border-line p-4">
              <p className="flex items-center gap-1.5 text-[11px] text-fg-secondary">
                <Building2 size={12} /> عدد الشقق
              </p>
              <p className="mt-2 text-[18px]">{statsBookings.filter((b) => b.unit_type === "apartment").length}</p>
            </div>
            <div className="border border-line p-4">
              <p className="flex items-center gap-1.5 text-[11px] text-fg-secondary">
                <Home size={12} /> عدد المنازل
              </p>
              <p className="mt-2 text-[18px]">{statsBookings.filter((b) => b.unit_type === "house").length}</p>
            </div>
          </div>
        </section>

        <section className="mt-6 border border-line p-5">
          <h2 className="text-[13px] font-medium text-fg">فلاتر البحث المتقدم</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Select value={filters.projectId} onValueChange={(v) => setFilters({ ...filters, projectId: v })}>
              <SelectTrigger><SelectValue placeholder="المشروع" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="اسم العميل" value={filters.clientName} onChange={(e) => setFilters({ ...filters, clientName: e.target.value })} />
            <Input placeholder="رقم الهاتف" value={filters.phone} onChange={(e) => setFilters({ ...filters, phone: e.target.value })} />
            <Input placeholder="رقم الوحدة" value={filters.unitNum} onChange={(e) => setFilters({ ...filters, unitNum: e.target.value })} />
            <Input placeholder="العنوان" value={filters.address} onChange={(e) => setFilters({ ...filters, address: e.target.value })} />
            <Input placeholder="التحصيل الدراسي" value={filters.education} onChange={(e) => setFilters({ ...filters, education: e.target.value })} />
            <Input placeholder="آلية المعرفة" value={filters.discovery} onChange={(e) => setFilters({ ...filters, discovery: e.target.value })} />
            <Input type="date" value={filters.startDate} onChange={(e) => setFilters({ ...filters, startDate: e.target.value })} />
            <Input type="date" value={filters.endDate} onChange={(e) => setFilters({ ...filters, endDate: e.target.value })} />
          </div>
          <Button className="mt-4 gap-1.5" onClick={() => searchBookings()} disabled={searching}>
            <Search size={14} /> {searching ? "جاري البحث..." : "تطبيق البحث"}
          </Button>
        </section>

        <div className="mt-6 space-y-3">
          {bookings.length === 0 && !searching && (
            <p className="border border-line p-8 text-center text-[13px] text-fg-secondary">
              لا توجد نتائج تطابق معايير البحث
            </p>
          )}

          {currentBookings.map((b) => (
            <div key={b.id} className="grid gap-4 border border-line p-4 lg:grid-cols-[1fr_1fr_auto]">
              <div>
                <p className="text-[11px] text-fg-faint">العميل</p>
                <p className="font-medium">{b.client_name}</p>
                <p className="text-[12px] text-fg-secondary">{b.phone1}</p>
                <p className="text-[12px] text-fg-secondary">{b.address}</p>
              </div>
              <div>
                <p className="text-[11px] text-fg-faint">المشروع والوحدة</p>
                <p>{projectName(b.project_id)}</p>
                <p className="text-[12px] text-fg-secondary">{formatPaymentUnitNumber(b)}</p>
                <p className="text-[12px] text-fg-secondary">
                  {formatPaymentDisplayDate(b.created_at, true)}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2">
                <Button size="sm" variant="outline" className="gap-1" onClick={() => window.open(`/sales/print/${b.id}`, "_blank")}>
                  <Printer size={13} /> عرض
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() =>
                    setEditingBooking({
                      ...b,
                      installments_count: b.installments?.length || 6,
                    })
                  }
                >
                  تعديل
                </Button>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-3">
            <Button size="sm" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)}>
              <ChevronRight size={14} /> السابق
            </Button>
            <span className="text-[12px] text-fg-secondary">صفحة {currentPage} من {totalPages}</span>
            <Button size="sm" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)}>
              التالي <ChevronLeft size={14} />
            </Button>
          </div>
        )}
      </div>

      <Dialog open={!!editingBooking} onOpenChange={() => setEditingBooking(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الاستمارة</DialogTitle>
          </DialogHeader>

          {editingBooking && (
            <div className="space-y-6">
              <section className="space-y-3 border border-line p-4">
                <h3 className="text-[13px] font-medium">معلومات الزبون</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>اسم العميل *</Label>
                    <Input value={editingBooking.client_name} onChange={(e) => setEditingBooking({ ...editingBooking, client_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الهاتف 1 *</Label>
                    <Input value={editingBooking.phone1} onChange={(e) => setEditingBooking({ ...editingBooking, phone1: e.target.value })} maxLength={11} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>الهاتف 2</Label>
                    <Input value={editingBooking.phone2 || ""} onChange={(e) => setEditingBooking({ ...editingBooking, phone2: e.target.value })} maxLength={11} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>عنوان السكن الحالي *</Label>
                    <Input value={editingBooking.address || ""} onChange={(e) => setEditingBooking({ ...editingBooking, address: e.target.value })} />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label>التحصيل الدراسي</Label>
                    <Input value={editingBooking.education || ""} onChange={(e) => setEditingBooking({ ...editingBooking, education: e.target.value })} />
                  </div>
                </div>
              </section>

              <section className="space-y-3 border border-line p-4">
                <h3 className="text-[13px] font-medium">آلية المعرفة بالمشروع (اختياري)</h3>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>آلية المعرفة</Label>
                    <Input value={editingBooking.discovery_method || ""} onChange={(e) => setEditingBooking({ ...editingBooking, discovery_method: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>صلة القرابة</Label>
                    <Input value={editingBooking.discovery_relation || ""} onChange={(e) => setEditingBooking({ ...editingBooking, discovery_relation: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>رقم الهاتف</Label>
                    <Input value={editingBooking.discovery_phone || ""} onChange={(e) => setEditingBooking({ ...editingBooking, discovery_phone: e.target.value })} maxLength={11} />
                  </div>
                </div>
              </section>

              <section className="space-y-3 border border-line p-4">
                <h3 className="text-[13px] font-medium">تفاصيل الوحدة</h3>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>نوع الوحدة</Label>
                    <Select
                      value={editingBooking.unit_type}
                      onValueChange={(val: "house" | "apartment") =>
                        setEditingBooking({ ...editingBooking, unit_type: val })
                      }
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="house">منزل</SelectItem>
                        <SelectItem value="apartment">شقة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>مدة التسليم (شهر) *</Label>
                    <Input value={editingBooking.delivery_period || ""} onChange={(e) => setEditingBooking({ ...editingBooking, delivery_period: e.target.value })} />
                  </div>
                </div>

                {editingBooking.unit_type === "house" ? (
                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="space-y-1.5">
                      <Label>زون (Z)</Label>
                      <Input value={editingBooking.zone || ""} onChange={(e) => setEditingBooking({ ...editingBooking, zone: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>بلوك (B)</Label>
                      <Input value={editingBooking.block || ""} onChange={(e) => setEditingBooking({ ...editingBooking, block: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>نوع المنزل (T)</Label>
                      {editHouseTypes.length > 0 ? (
                        <Select
                          value={editingBooking.house_type || ""}
                          onValueChange={(val) => {
                            const mapArea = Number(editingBooking.total_area) || 0;
                            const resolved = resolveHouseTypeSelection(val, mapArea, editHouseTypes);
                            setEditingBooking({
                              ...editingBooking,
                              house_type: resolved.houseType,
                              total_area: resolved.totalArea,
                            });
                          }}
                        >
                          <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                          <SelectContent>
                            {editHouseTypes.map((item) => (
                              <SelectItem key={item.type} value={item.type}>
                                {item.type}
                                {item.area ? ` (${item.area} م²)` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input value={editingBooking.house_type || ""} onChange={(e) => setEditingBooking({ ...editingBooking, house_type: e.target.value })} />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <Label>رقم المنزل (NO)</Label>
                      <Input value={editingBooking.house_num || ""} onChange={(e) => setEditingBooking({ ...editingBooking, house_num: e.target.value })} />
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label>عمارة (A)</Label>
                      <Input value={editingBooking.building || ""} onChange={(e) => setEditingBooking({ ...editingBooking, building: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>طابق (F)</Label>
                      <Input value={editingBooking.floor || ""} onChange={(e) => setEditingBooking({ ...editingBooking, floor: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>شقة (P)</Label>
                      <Input value={editingBooking.apartment || ""} onChange={(e) => setEditingBooking({ ...editingBooking, apartment: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>المساحة الكلية *</Label>
                    <Input value={editingBooking.total_area || ""} onChange={(e) => setEditingBooking({ ...editingBooking, total_area: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>المساحة الصافية {editingBooking.unit_type === "apartment" ? "*" : ""}</Label>
                    <Input
                      value={editingBooking.net_area || ""}
                      onChange={(e) => setEditingBooking({ ...editingBooking, net_area: e.target.value })}
                      disabled={editingBooking.unit_type === "house"}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>السعر الإجمالي (د.ع) *</Label>
                    <Input value={editingBooking.total_price} onChange={(e) => setEditingBooking({ ...editingBooking, total_price: Number(e.target.value) } as any)} />
                  </div>
                </div>
              </section>

              <section className="space-y-3 border border-line p-4">
                <h3 className="text-[13px] font-medium">خطة الدفعات</h3>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-1.5">
                    <Label>دفعة التوقيع *</Label>
                    <Input value={editingBooking.signing_amount} onChange={(e) => setEditingBooking({ ...editingBooking, signing_amount: Number(e.target.value) } as any)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>شرط السكن</Label>
                    <Input
                      value={editingBooking.housing_condition_amount || ""}
                      onChange={(e) =>
                        setEditingBooking({
                          ...editingBooking,
                          housing_condition_amount: e.target.value ? Number(e.target.value) : undefined,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>عدد الدفعات</Label>
                    <Input type="number" value={editingBooking.installments_count || 6} onChange={(e) => setEditingBooking({ ...editingBooking, installments_count: Number(e.target.value) })} />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button type="button" className="flex-1" onClick={generateInstallmentsForEdit}>توليد</Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        setEditingBooking({
                          ...editingBooking,
                          installments: [
                            ...(editingBooking.installments || []),
                            {
                              id: createInstallmentId(),
                              date: formatDateOnly(new Date()),
                              amount: "0",
                              label: "دفعة إضافية",
                              isLocked: false,
                            },
                          ],
                        })
                      }
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  {(editingBooking.installments || []).map((inst) => (
                    <div key={inst.id} className="grid gap-2 border border-line p-2 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-center">
                      <label className="flex items-center gap-2 text-[11px]">
                        <Checkbox
                          checked={inst.isLocked}
                          onCheckedChange={(checked) => {
                            const updated = (editingBooking.installments || []).map((item) =>
                              item.id === inst.id ? { ...item, isLocked: !!checked } : item,
                            );
                            setEditingBooking({ ...editingBooking, installments: recalculateForEdit(updated) });
                          }}
                        />
                        <Lock size={12} /> تثبيت
                      </label>
                      <Input type="date" value={inst.date} onChange={(e) => setEditingBooking({ ...editingBooking, installments: editingBooking.installments.map((i) => i.id === inst.id ? { ...i, date: e.target.value } : i) })} />
                      <Input value={inst.label} onChange={(e) => setEditingBooking({ ...editingBooking, installments: editingBooking.installments.map((i) => i.id === inst.id ? { ...i, label: e.target.value } : i) })} />
                      <Input
                        value={inst.amount}
                        onChange={(e) => {
                          const updated = editingBooking.installments.map((i) =>
                            i.id === inst.id ? { ...i, amount: e.target.value } : i,
                          );
                          setEditingBooking({
                            ...editingBooking,
                            installments: inst.isLocked ? recalculateForEdit(updated) : updated,
                          });
                        }}
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setEditingBooking({ ...editingBooking, installments: editingBooking.installments.filter((i) => i.id !== inst.id) })}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className={cn(
                  "rounded-sm border px-3 py-2 text-[12px] tabular-nums",
                  editValidation.ok
                    ? "border-status-available/40 bg-status-available/10 text-status-available"
                    : "border-status-sold/40 bg-status-sold/10 text-status-sold",
                )}>
                  المجموع: {calculatePaymentTotal(editingBooking.signing_amount, editingBooking.installments || []).toLocaleString("en-US")} / {Number(editingBooking.total_price).toLocaleString("en-US")} د.ع
                </div>
              </section>

              <section className="space-y-3 border border-line p-4">
                <label className="flex items-center gap-2 text-[12px]">
                  <Checkbox
                    checked={editingBooking.show_commission_note}
                    onCheckedChange={(checked) =>
                      setEditingBooking({ ...editingBooking, show_commission_note: !!checked })
                    }
                  />
                  إظهار ملاحظة عمولة الوسيط عند الطباعة
                </label>
                <div className="space-y-1.5">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={editingBooking.notes || ""}
                    onChange={(e) => setEditingBooking({ ...editingBooking, notes: e.target.value })}
                    className="min-h-[80px]"
                  />
                </div>
              </section>

              <section className="space-y-3">
                <Textarea placeholder="سبب التعديل *" value={changeReason} onChange={(e) => setChangeReason(e.target.value)} />
                <Input type="password" placeholder="كلمة مرور القسم *" value={centerPassword} onChange={(e) => setCenterPassword(e.target.value)} />
              </section>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBooking(null)}>إلغاء</Button>
            <Button disabled={saving || !editValidation.ok} onClick={handleUpdate}>
              {saving ? "جاري الحفظ..." : "حفظ التعديلات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
};

export default SalesArchive;
