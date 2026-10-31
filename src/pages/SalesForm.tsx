"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Archive, Lock, Plus, Trash2 } from "lucide-react";
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
import { showError, showSuccess } from "@/utils/toast";
import {
  calculatePaymentTotal,
  createInstallmentId,
  formatDateOnly,
  generateInstallments,
  recalculateUnlockedInstallments,
  validatePaymentTotals,
} from "@/lib/payment-installments";
import {
  fetchPaymentDefaults,
  fetchPaymentUnitSettings,
  getPaymentProjectUnitSettings,
} from "@/lib/payment-settings";
import {
  resolveApartmentPaymentAreas,
  resolveHousePaymentFields,
  resolveHouseTypeSelection,
} from "@/lib/payment-unit-resolver";
import { resolvePaymentUnitFromMap } from "@/lib/unit-label-parser";
import { resolvePaymentUnitArea } from "@/lib/units";
import {
  canAccessPaymentArchive,
  canAccessPaymentForm,
  fetchSessionDeptPermissions,
} from "@/lib/dept-permissions";
import type { PaymentHouseTypeConfig, PaymentInstallment, PaymentUnitType } from "@/lib/payment-types";
import { cn } from "@/lib/utils";

const SalesForm = () => {
  const navigate = useNavigate();
  const { projectId, unitId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [centerId, setCenterId] = useState<string | null>(null);
  const [centerName, setCenterName] = useState("");
  const [canOpenArchive, setCanOpenArchive] = useState(false);
  const [houseTypes, setHouseTypes] = useState<PaymentHouseTypeConfig[]>([]);
  const [mapAreaValue, setMapAreaValue] = useState(0);
  const [unitType, setUnitType] = useState<PaymentUnitType>("house");
  const [installmentsCount, setInstallmentsCount] = useState(6);
  const [signingAmount, setSigningAmount] = useState("");
  const [housingConditionAmount, setHousingConditionAmount] = useState("");
  const [showCommissionNote, setShowCommissionNote] = useState(true);
  const [installments, setInstallments] = useState<PaymentInstallment[]>([]);
  const [formData, setFormData] = useState({
    clientName: "",
    clientPhone1: "",
    clientPhone2: "",
    currentAddress: "",
    education: "",
    totalPrice: "",
    deliveryPeriod: "",
    totalArea: "",
    netArea: "",
    discoveryMethod: "",
    discoveryRelation: "",
    discoveryPhone: "",
    zone: "",
    block: "",
    houseType: "",
    houseNum: "",
    building: "",
    floor: "",
    apartment: "",
    notes: "",
  });

  const totalValidation = useMemo(
    () => validatePaymentTotals(formData.totalPrice, signingAmount, installments),
    [formData.totalPrice, signingAmount, installments],
  );

  useEffect(() => {
    const bootstrap = async () => {
      const { center, permissions } = await fetchSessionDeptPermissions(supabase);
      if (!center) {
        showError("يجب تسجيل الدخول كقسم تسويقي أولاً");
        navigate("/");
        return;
      }
      if (!canAccessPaymentForm(permissions)) {
        showError("ليس لديك صلاحية الوصول إلى استمارة تنظيم آلية الدفعات");
        navigate("/");
        return;
      }

      setCenterId(center.id);
      setCenterName(localStorage.getItem("marketing_center_name") || center.name || "");
      setCanOpenArchive(canAccessPaymentArchive(permissions));

      if (!projectId || !unitId) {
        showError("رابط الوحدة غير صالح");
        navigate("/");
        return;
      }

      try {
        const [{ data: project }, { data: unit }, { data: housesRows }, defaults, unitSettingsMap, { data: settingsRows }] =
          await Promise.all([
            supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
            supabase
              .from("houses_data")
              .select("unit_key, data")
              .eq("project_id", projectId)
              .eq("unit_key", unitId)
              .maybeSingle(),
            supabase
              .from("houses_data")
              .select("unit_key, data")
              .eq("project_id", projectId),
            fetchPaymentDefaults(supabase),
            fetchPaymentUnitSettings(supabase),
            supabase.from("settings").select("key, value").eq("key", "project_configs").maybeSingle(),
          ]);

        if (!project) {
          showError("المشروع غير موجود");
          navigate("/");
          return;
        }

        setProjectName(project.name);
        setInstallmentsCount(defaults.installment_count);
        setShowCommissionNote(defaults.show_commission_note);
        const projectUnitSettings = getPaymentProjectUnitSettings(unitSettingsMap, projectId);
        setHouseTypes(projectUnitSettings.house_types);

        const { data: projectFull } = await supabase
          .from("projects")
          .select("elements")
          .eq("id", projectId)
          .maybeSingle();

        const elements = projectFull?.elements || [];
        const housesData = Object.fromEntries(
          (housesRows || []).map((row) => [row.unit_key, row.data]),
        );
        const resolved = resolvePaymentUnitFromMap(unitId, elements, housesData);
        setUnitLabel(resolved.displayLabel);

        const houseTypeAreas =
          settingsRows?.value?.[projectId]?.houseTypeAreas || {};
        const mapArea = resolvePaymentUnitArea(unitId, elements, houseTypeAreas);
        setMapAreaValue(mapArea);

        let totalArea = "";
        let netArea = "";
        let houseType = resolved.houseType || "";

        if (resolved.unitType === "house") {
          const houseFields = resolveHousePaymentFields(
            resolved.displayLabel,
            mapArea,
            projectUnitSettings.house_types,
            resolved.houseType,
          );
          houseType = houseFields.houseType;
          totalArea = houseFields.totalArea;
        } else {
          const apartmentFields = resolveApartmentPaymentAreas(
            mapArea,
            projectUnitSettings.apartment_areas,
          );
          totalArea = apartmentFields.totalArea;
          netArea = apartmentFields.netArea;
        }

        setUnitType(resolved.unitType);
        setFormData((prev) => ({
          ...prev,
          clientName: unit?.data?.name || "",
          clientPhone1: unit?.data?.phone || "",
          totalPrice: unit?.data?.price ? String(unit.data.price) : "",
          totalArea,
          netArea,
          zone: resolved.zone || "",
          block: resolved.block || "",
          houseType,
          houseNum: resolved.houseNum || "",
          building: resolved.building || "",
          floor: resolved.floor || "",
          apartment: resolved.apartment || "",
        }));
      } catch (error) {
        console.error(error);
        showError("تعذر تحميل بيانات الوحدة");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [projectId, unitId, navigate]);

  const handlePhoneChange = (field: "clientPhone1" | "clientPhone2", value: string) => {
    if (value.length <= 11 && /^[0-9]*$/.test(value)) {
      setFormData({ ...formData, [field]: value });
    }
  };

  const runRecalculate = (nextInstallments: PaymentInstallment[]) =>
    recalculateUnlockedInstallments(nextInstallments, formData.totalPrice, signingAmount);

  const handleGenerateInstallments = () => {
    const price = Number(formData.totalPrice) || 0;
    const signing = Number(signingAmount) || 0;
    if (price <= 0) return showError("يرجى إدخال السعر الإجمالي أولاً");
    if (signing > price) return showError("مبلغ التوقيع يتجاوز السعر الإجمالي");

    setInstallments(generateInstallments(price, signing, installmentsCount));
    showSuccess("تم توليد الدفعات");
  };

  const validateForm = (): string | null => {
    if (!formData.clientName) return "يرجى إدخال اسم العميل";
    if (!formData.clientPhone1) return "يرجى إدخال رقم الهاتف الأول";
    if (!formData.currentAddress) return "يرجى إدخال عنوان السكن الحالي";
    if (unitType === "house") {
      if (!formData.zone || !formData.block || !formData.houseType || !formData.houseNum) {
        return "يرجى إكمال بيانات المنزل (Z, B, T, NO)";
      }
    } else {
      if (!formData.building || !formData.floor || !formData.apartment) {
        return "يرجى إكمال بيانات الشقة (A, F, P)";
      }
      if (!formData.netArea) return "يرجى إدخال المساحة الصافية";
    }
    if (!formData.totalArea) return "يرجى إدخال المساحة الكلية";
    if (!formData.deliveryPeriod) return "يرجى إدخال مدة التسليم";
    if (!formData.totalPrice) return "يرجى إدخال السعر الإجمالي";
    if (!signingAmount) return "يرجى إدخال مبلغ دفعة التوقيع";
    if (installments.length === 0) return "يرجى توليد خطة الدفعات";
    if (!totalValidation.ok) return totalValidation.message || "مجموع الدفعات لا يطابق سعر البيع";
    return null;
  };

  const handleSave = async () => {
    const errorMsg = validateForm();
    if (errorMsg) return showError(errorMsg);
    if (!centerId || !projectId || !unitId) return;

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("payment_bookings")
        .insert([
          {
            project_id: projectId,
            unit_key: unitId,
            marketing_center_id: centerId,
            created_by_center_name: centerName,
            client_name: formData.clientName,
            phone1: formData.clientPhone1,
            phone2: formData.clientPhone2,
            address: formData.currentAddress,
            education: formData.education,
            unit_type: unitType,
            zone: formData.zone,
            block: formData.block,
            house_type: formData.houseType,
            house_num: formData.houseNum,
            building: formData.building,
            floor: formData.floor,
            apartment: formData.apartment,
            total_area: formData.totalArea,
            net_area: formData.netArea,
            delivery_period: formData.deliveryPeriod,
            total_price: Number(formData.totalPrice),
            discovery_method: formData.discoveryMethod,
            discovery_relation: formData.discoveryRelation,
            discovery_phone: formData.discoveryPhone,
            signing_amount: Number(signingAmount),
            housing_condition_amount: housingConditionAmount
              ? Number(housingConditionAmount)
              : null,
            show_commission_note: showCommissionNote,
            installments,
            notes: formData.notes,
          },
        ])
        .select("id")
        .single();

      if (error) throw error;

      showSuccess("تم حفظ الاستمارة بنجاح");
      window.open(`/sales/print/${data.id}`, "_blank");
      navigate("/sales/archive");
    } catch (error: any) {
      console.error(error);
      showError(error?.message?.includes("payment_bookings")
        ? "جدول payment_bookings غير موجود. نفّذ database_payment.sql في Supabase."
        : `فشل الحفظ: ${error.message || "خطأ غير معروف"}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-24 lg:px-8">
        <LoadingBlock label="جاري تحميل استمارة الدفعات" />
      </div>
    );
  }

  return (
    <AppShell
      brandSubtitle="تنظيم آلية الدفعات"
      nav={
        <>
          <Link to="/map">
            <Button variant="ghost" size="sm">الخريطة</Button>
          </Link>
          {canOpenArchive && (
            <Link to="/sales/archive">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <Archive size={14} /> الأرشيف
              </Button>
            </Link>
          )}
        </>
      }
    >
      <div className="py-8">
        <Eyebrow>استمارة جديدة</Eyebrow>
        <h1 className="mt-3 text-[32px] font-light tracking-display text-fg">
          تنظيم آلية الدفعات
        </h1>
        <p className="mt-2 text-[13px] text-fg-secondary">
          {projectName} — {unitLabel} {centerName ? `· ${centerName}` : ""}
        </p>

        <div className="mt-8 space-y-6">
          <section className="border border-line p-5">
            <h2 className="text-[13px] font-medium text-fg">معلومات الزبون</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>اسم العميل الكامل *</Label>
                <Input value={formData.clientName} onChange={(e) => setFormData({ ...formData, clientName: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف 1 *</Label>
                <Input value={formData.clientPhone1} onChange={(e) => handlePhoneChange("clientPhone1", e.target.value)} maxLength={11} />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف 2</Label>
                <Input value={formData.clientPhone2} onChange={(e) => handlePhoneChange("clientPhone2", e.target.value)} maxLength={11} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>عنوان السكن الحالي *</Label>
                <Input value={formData.currentAddress} onChange={(e) => setFormData({ ...formData, currentAddress: e.target.value })} />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>التحصيل الدراسي</Label>
                <Input value={formData.education} onChange={(e) => setFormData({ ...formData, education: e.target.value })} />
              </div>
            </div>
          </section>

          <section className="border border-line p-5">
            <h2 className="text-[13px] font-medium text-fg">آلية المعرفة بالمشروع (اختياري)</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label>آلية المعرفة</Label>
                <Input
                  value={formData.discoveryMethod}
                  onChange={(e) => setFormData({ ...formData, discoveryMethod: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>صلة القرابة</Label>
                <Input
                  value={formData.discoveryRelation}
                  onChange={(e) => setFormData({ ...formData, discoveryRelation: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الهاتف</Label>
                <Input
                  value={formData.discoveryPhone}
                  onChange={(e) => setFormData({ ...formData, discoveryPhone: e.target.value })}
                  maxLength={11}
                />
              </div>
            </div>
          </section>

          <section className="border border-line p-5">
            <h2 className="text-[13px] font-medium text-fg">تفاصيل الوحدة</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>نوع الوحدة</Label>
                <Input value={unitType === "house" ? "منزل" : "شقة"} disabled />
              </div>
              {unitType === "house" ? (
                <>
                  <div className="space-y-1.5"><Label>زون (Z)</Label><Input value={formData.zone} onChange={(e) => setFormData({ ...formData, zone: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>بلوك (B)</Label><Input value={formData.block} onChange={(e) => setFormData({ ...formData, block: e.target.value })} /></div>
                  <div className="space-y-1.5">
                    <Label>نوع المنزل (T)</Label>
                    {houseTypes.length > 0 ? (
                      <Select
                        value={formData.houseType}
                        onValueChange={(val) => {
                          const resolved = resolveHouseTypeSelection(val, mapAreaValue, houseTypes);
                          setFormData({
                            ...formData,
                            houseType: resolved.houseType,
                            totalArea: resolved.totalArea,
                          });
                        }}
                      >
                        <SelectTrigger><SelectValue placeholder="اختر النوع" /></SelectTrigger>
                        <SelectContent>
                          {houseTypes.map((item) => (
                            <SelectItem key={item.type} value={item.type}>
                              {item.type}
                              {item.area ? ` (${item.area} م²)` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input value={formData.houseType} onChange={(e) => setFormData({ ...formData, houseType: e.target.value })} />
                    )}
                  </div>
                  <div className="space-y-1.5"><Label>رقم المنزل (NO)</Label><Input value={formData.houseNum} onChange={(e) => setFormData({ ...formData, houseNum: e.target.value })} /></div>
                </>
              ) : (
                <>
                  <div className="space-y-1.5"><Label>عمارة (A)</Label><Input value={formData.building} onChange={(e) => setFormData({ ...formData, building: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>طابق (F)</Label><Input value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: e.target.value })} /></div>
                  <div className="space-y-1.5"><Label>شقة (P)</Label><Input value={formData.apartment} onChange={(e) => setFormData({ ...formData, apartment: e.target.value })} /></div>
                </>
              )}
              <div className="space-y-1.5">
                <Label>المساحة الكلية *</Label>
                <Input
                  value={formData.totalArea}
                  onChange={(e) => setFormData({ ...formData, totalArea: e.target.value })}
                  placeholder="تُستورد تلقائياً من الخريطة"
                />
              </div>
              <div className="space-y-1.5"><Label>المساحة الصافية {unitType === "apartment" ? "*" : ""}</Label><Input value={formData.netArea} onChange={(e) => setFormData({ ...formData, netArea: e.target.value })} disabled={unitType === "house"} /></div>
              <div className="space-y-1.5"><Label>مدة التسليم (شهر) *</Label><Input value={formData.deliveryPeriod} onChange={(e) => setFormData({ ...formData, deliveryPeriod: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>السعر الإجمالي (د.ع) *</Label><Input value={formData.totalPrice} onChange={(e) => setFormData({ ...formData, totalPrice: e.target.value })} /></div>
            </div>
          </section>

          <section className="border border-line p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-[13px] font-medium text-fg">خطة الدفعات</h2>
              <div className={cn(
                "rounded-sm border px-3 py-2 text-[12px] tabular-nums",
                totalValidation.ok
                  ? "border-status-available/40 bg-status-available/10 text-status-available"
                  : "border-status-sold/40 bg-status-sold/10 text-status-sold",
              )}>
                المجموع: {calculatePaymentTotal(signingAmount, installments).toLocaleString("en-US")} / {Number(formData.totalPrice || 0).toLocaleString("en-US")} د.ع
              </div>
            </div>

            {!totalValidation.ok && installments.length > 0 && (
              <p className="mt-3 text-[12px] text-status-sold">{totalValidation.message}</p>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-4">
              <div className="space-y-1.5"><Label>دفعة التوقيع *</Label><Input value={signingAmount} onChange={(e) => setSigningAmount(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>شرط السكن</Label><Input value={housingConditionAmount} onChange={(e) => setHousingConditionAmount(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>عدد الدفعات</Label><Input type="number" value={installmentsCount} onChange={(e) => setInstallmentsCount(Number(e.target.value))} /></div>
              <div className="flex items-end gap-2">
                <Button type="button" onClick={handleGenerateInstallments} className="flex-1">توليد</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setInstallments([
                      ...installments,
                      {
                        id: createInstallmentId(),
                        date: formatDateOnly(new Date()),
                        amount: "0",
                        label: "دفعة إضافية",
                        isLocked: false,
                      },
                    ])
                  }
                >
                  <Plus size={14} />
                </Button>
              </div>
            </div>

            {installments.length > 0 && (
              <div className="mt-4 space-y-2">
                {installments.map((inst) => (
                  <div key={inst.id} className="grid gap-2 border border-line p-3 md:grid-cols-[auto_1fr_1fr_1fr_auto] md:items-center">
                    <label className="flex items-center gap-2 text-[11px] text-fg-secondary">
                      <Checkbox
                        checked={inst.isLocked}
                        onCheckedChange={(checked) => {
                          const updated = installments.map((item) =>
                            item.id === inst.id ? { ...item, isLocked: !!checked } : item,
                          );
                          setInstallments(runRecalculate(updated));
                        }}
                      />
                      <Lock size={12} /> تثبيت
                    </label>
                    <Input type="date" value={inst.date} onChange={(e) => setInstallments(installments.map((item) => item.id === inst.id ? { ...item, date: e.target.value } : item))} />
                    <Input value={inst.label} onChange={(e) => setInstallments(installments.map((item) => item.id === inst.id ? { ...item, label: e.target.value } : item))} />
                    <Input
                      value={inst.amount}
                      onChange={(e) => {
                        const updated = installments.map((item) =>
                          item.id === inst.id ? { ...item, amount: e.target.value } : item,
                        );
                        setInstallments(inst.isLocked ? runRecalculate(updated) : updated);
                      }}
                    />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setInstallments(installments.filter((item) => item.id !== inst.id))}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="border border-line p-5">
            <label className="flex items-center gap-2 text-[12px]">
              <Checkbox checked={showCommissionNote} onCheckedChange={(checked) => setShowCommissionNote(!!checked)} />
              إظهار ملاحظة عمولة الوسيط عند الطباعة
            </label>
            <div className="mt-4 space-y-1.5">
              <Label>ملاحظات</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} className="min-h-[100px]" />
            </div>
          </section>

          <Button type="button" size="lg" disabled={saving || !totalValidation.ok} onClick={handleSave}>
            {saving ? "جاري الحفظ..." : "حفظ ومعاينة الطباعة"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
};

export default SalesForm;
