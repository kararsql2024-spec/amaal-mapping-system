"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatPaymentDisplayDate } from "@/lib/payment-installments";
import { Archive, History, Palette, Settings2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/layout/AppShell";
import { PaymentPrintDocument } from "@/components/payment/PaymentPrintDocument";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showError, showSuccess } from "@/utils/toast";
import { getPaymentStyleGroups } from "@/lib/payment-print-styles";
import { formatPaymentUnitNumber } from "@/lib/unit-label-parser";
import {
  fetchPaymentDefaults,
  fetchPaymentUnitSettings,
  fetchPaymentPrintSettings,
  getPaymentPrintSettings,
  getPaymentProjectUnitSettings,
  savePaymentDefaults,
  savePaymentHouseTypes,
  savePaymentPrintSettings,
} from "@/lib/payment-settings";
import {
  DEFAULT_PAYMENT_DEFAULTS,
  type PaymentBookingRecord,
  type PaymentDefaults,
  type PaymentPrintSettings,
  type PaymentProjectUnitSettings,
  type PaymentProjectUnitSettingsMap,
} from "@/lib/payment-types";
import { resolveProjectPaymentLogo, type ProjectConfigsMap } from "@/lib/project-config";
import {
  formatAreaInput,
  isValidAreaInput,
  parseAreaInput,
} from "@/lib/payment-unit-resolver";
import "@/styles/payment-print.css";

interface PaymentAdminPanelProps {
  projects: { id: string; name: string }[];
}

const SAMPLE_BOOKING: PaymentBookingRecord = {
  id: "preview",
  project_id: "preview",
  unit_key: "preview",
  marketing_center_id: "preview",
  created_by_center_name: "مركز المعاينة",
  client_name: "محمد علي حسن",
  phone1: "07701234567",
  phone2: "07801234567",
  address: "بغداد - الكرادة",
  education: "بكلوريوس",
  unit_type: "house",
  zone: "1",
  block: "2",
  house_type: "D",
  house_num: "15",
  total_area: "200",
  delivery_period: "24",
  total_price: 150000000,
  discovery_method: "وسيط",
  discovery_relation: "صديق",
  discovery_phone: "07701111111",
  signing_amount: 30000000,
  housing_condition_amount: 10000000,
  show_commission_note: true,
  installments: [
    { id: "1", date: "2026-12-01", amount: "20000000", label: "الدفعة 1", isLocked: false },
    { id: "2", date: "2027-06-01", amount: "20000000", label: "الدفعة 2", isLocked: false },
    { id: "3", date: "2027-12-01", amount: "20000000", label: "الدفعة 3", isLocked: false },
    { id: "4", date: "2028-06-01", amount: "20000000", label: "الدفعة 4", isLocked: false },
    { id: "5", date: "2028-12-01", amount: "20000000", label: "الدفعة 5", isLocked: false },
    { id: "6", date: "2029-06-01", amount: "20000000", label: "الدفعة 6", isLocked: false },
  ],
  notes: "",
  created_at: new Date().toISOString(),
};

const PaymentAdminPanel = ({ projects }: PaymentAdminPanelProps) => {
  const [selectedProjectId, setSelectedProjectId] = useState(projects[0]?.id || "");
  const [printSettingsMap, setPrintSettingsMap] = useState<Record<string, PaymentPrintSettings>>({});
  const [projectConfigs, setProjectConfigs] = useState<ProjectConfigsMap>({});
  const [unitSettingsMap, setUnitSettingsMap] = useState<PaymentProjectUnitSettingsMap>({});
  const [defaults, setDefaults] = useState<PaymentDefaults>(DEFAULT_PAYMENT_DEFAULTS);
  const [draftPrint, setDraftPrint] = useState<PaymentPrintSettings>({});
  const [newHouseType, setNewHouseType] = useState("");
  const [newHouseTypeArea, setNewHouseTypeArea] = useState("");
  const [newApartmentTotal, setNewApartmentTotal] = useState("");
  const [newApartmentNet, setNewApartmentNet] = useState("");
  const [houseAreaDrafts, setHouseAreaDrafts] = useState<Record<string, string>>({});
  const [bookings, setBookings] = useState<PaymentBookingRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [archiveSearch, setArchiveSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const unitSettingsMapRef = useRef(unitSettingsMap);

  useEffect(() => {
    unitSettingsMapRef.current = unitSettingsMap;
  }, [unitSettingsMap]);

  useEffect(() => {
    const load = async () => {
      try {
        const [printSettings, unitSettings, paymentDefaults, { data: configsRow }] = await Promise.all([
          fetchPaymentPrintSettings(supabase),
          fetchPaymentUnitSettings(supabase),
          fetchPaymentDefaults(supabase),
          supabase.from("settings").select("value").eq("key", "project_configs").maybeSingle(),
        ]);
        setPrintSettingsMap(printSettings);
        setUnitSettingsMap(unitSettings);
        setDefaults(paymentDefaults);
        setProjectConfigs((configsRow?.value || {}) as ProjectConfigsMap);
        await fetchArchive();
        await fetchLogs();
      } catch (error) {
        console.error(error);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    setDraftPrint(getPaymentPrintSettings(printSettingsMap, selectedProjectId));
  }, [selectedProjectId, printSettingsMap]);

  const fetchArchive = async () => {
    const { data } = await supabase
      .from("payment_bookings")
      .select("*")
      .order("created_at", { ascending: false });
    setBookings((data || []) as PaymentBookingRecord[]);
  };

  const fetchLogs = async () => {
    const { data } = await supabase
      .from("payment_audit_logs")
      .select("*")
      .order("created_at", { ascending: false });
    setAuditLogs(data || []);
  };

  const getProjectName = (id: string) => projects.find((p) => p.id === id)?.name || id;

  const previewProjectLogo = resolveProjectPaymentLogo(
    selectedProjectId,
    draftPrint,
    projectConfigs,
  );

  const filteredBookings = useMemo(
    () =>
      bookings.filter(
        (b) =>
          b.client_name?.toLowerCase().includes(archiveSearch.toLowerCase()) ||
          formatPaymentUnitNumber(b).toLowerCase().includes(archiveSearch.toLowerCase()),
      ),
    [bookings, archiveSearch],
  );

  const saveProjectStyle = async () => {
    if (!selectedProjectId) return;
    setSaving(true);
    try {
      const updated = { ...printSettingsMap, [selectedProjectId]: draftPrint };
      await savePaymentPrintSettings(supabase, updated);
      setPrintSettingsMap(updated);
      showSuccess("تم حفظ ستايل الطباعة للمشروع");
    } catch (error: any) {
      showError(error.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const saveDefaultsConfig = async () => {
    setSaving(true);
    try {
      await savePaymentDefaults(supabase, defaults);
      showSuccess("تم حفظ الإعدادات الافتراضية");
    } catch (error: any) {
      showError(error.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const selectedUnitSettings = useMemo(
    () => getPaymentProjectUnitSettings(unitSettingsMap, selectedProjectId),
    [unitSettingsMap, selectedProjectId],
  );

  const houseTypesDraftKey = useMemo(
    () =>
      selectedUnitSettings.house_types
        .map((item) => `${item.type}:${item.area ?? ""}`)
        .join("|"),
    [selectedUnitSettings.house_types],
  );

  useEffect(() => {
    const drafts: Record<string, string> = {};
    selectedUnitSettings.house_types.forEach((item) => {
      drafts[item.type] = formatAreaInput(item.area);
    });
    setHouseAreaDrafts(drafts);
  }, [selectedProjectId, houseTypesDraftKey, selectedUnitSettings.house_types]);

  const buildProjectUnitSettings = (
    patch: Partial<PaymentProjectUnitSettings>,
  ): PaymentProjectUnitSettingsMap | null => {
    if (!selectedProjectId) return null;
    const current = getPaymentProjectUnitSettings(unitSettingsMap, selectedProjectId);
    return {
      ...unitSettingsMap,
      [selectedProjectId]: { ...current, ...patch },
    };
  };

  const persistUnitSettingsMap = async (
    nextMap: PaymentProjectUnitSettingsMap,
    successMessage: string,
  ) => {
    setSaving(true);
    try {
      await savePaymentHouseTypes(supabase, nextMap);
      setUnitSettingsMap(nextMap);
      showSuccess(successMessage);
    } catch (error: any) {
      console.error("Failed to save payment unit settings:", error);
      showError(error.message || "فشل حفظ إعدادات الوحدات");
      throw error;
    } finally {
      setSaving(false);
    }
  };

  const saveUnitSettings = async () => {
    if (!selectedProjectId) return;
    await persistUnitSettingsMap(unitSettingsMapRef.current, "تم حفظ إعدادات الوحدات");
  };

  const addHouseType = async () => {
    if (!selectedProjectId || !newHouseType.trim()) return;
    const areaValue = parseAreaInput(newHouseTypeArea);
    const current = selectedUnitSettings.house_types;
    if (current.some((item) => item.type.toUpperCase() === newHouseType.trim().toUpperCase())) {
      showError("هذا النوع موجود مسبقاً");
      return;
    }

    const nextMap = buildProjectUnitSettings({
      house_types: [
        ...current,
        {
          type: newHouseType.trim().toUpperCase(),
          area: areaValue,
        },
      ],
    });
    if (!nextMap) return;

    await persistUnitSettingsMap(nextMap, "تمت إضافة نوع المنزل وحفظه");
    setNewHouseType("");
    setNewHouseTypeArea("");
  };

  const removeHouseType = async (type: string) => {
    const nextMap = buildProjectUnitSettings({
      house_types: selectedUnitSettings.house_types.filter((item) => item.type !== type),
    });
    if (!nextMap) return;
    await persistUnitSettingsMap(nextMap, "تم حذف نوع المنزل");
  };

  const addApartmentArea = async () => {
    const total = parseAreaInput(newApartmentTotal);
    const net = parseAreaInput(newApartmentNet);
    if (total == null || net == null) {
      showError("يرجى إدخال المساحة الكلية والصافية بشكل صحيح");
      return;
    }
    if (
      selectedUnitSettings.apartment_areas.some(
        (item) => Math.abs(item.total_area - total) < 0.01,
      )
    ) {
      showError("هذه المساحة الكلية موجودة مسبقاً");
      return;
    }

    const nextMap = buildProjectUnitSettings({
      apartment_areas: [
        ...selectedUnitSettings.apartment_areas,
        { total_area: total, net_area: net },
      ],
    });
    if (!nextMap) return;

    await persistUnitSettingsMap(nextMap, "تمت إضافة مساحة الشقة وحفظها");
    setNewApartmentTotal("");
    setNewApartmentNet("");
  };

  const removeApartmentArea = async (totalArea: number) => {
    const nextMap = buildProjectUnitSettings({
      apartment_areas: selectedUnitSettings.apartment_areas.filter(
        (item) => item.total_area !== totalArea,
      ),
    });
    if (!nextMap) return;
    await persistUnitSettingsMap(nextMap, "تم حذف مساحة الشقة");
  };

  const deleteBooking = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الاستمارة نهائياً؟")) return;
    await supabase.from("payment_bookings").delete().eq("id", id);
    await fetchArchive();
    showSuccess("تم الحذف");
  };

  return (
    <Panel
      icon={<Palette size={14} />}
      title="آلية تنظيم الدفعات"
      description="إعدادات الطباعة، أنواع المنازل، الأرشيف الكامل، وسجل التعديلات"
      actions={
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="اختر مشروع" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Tabs defaultValue="styles" dir="rtl">
        <TabsList className="mb-6">
          <TabsTrigger value="styles" className="gap-1.5"><Palette size={13} /> ستايل الطباعة</TabsTrigger>
          <TabsTrigger value="units" className="gap-1.5"><Settings2 size={13} /> أنواع المنازل</TabsTrigger>
          <TabsTrigger value="defaults" className="gap-1.5"><Settings2 size={13} /> افتراضيات</TabsTrigger>
          <TabsTrigger value="archive" className="gap-1.5"><Archive size={13} /> الأرشيف</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5"><History size={13} /> السجل</TabsTrigger>
        </TabsList>

        <TabsContent value="styles" className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-4 border border-line p-4">
              <h3 className="text-[13px] font-medium">إعدادات المشروع / المدينة</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>لون الإطار</Label>
                  <Input type="color" value={draftPrint.frame_color || "#1e40af"} onChange={(e) => setDraftPrint({ ...draftPrint, frame_color: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>النصوص الثابتة</Label>
                  <Input type="color" value={draftPrint.static_text_color || "#000000"} onChange={(e) => setDraftPrint({ ...draftPrint, static_text_color: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>النصوص المتغيرة</Label>
                  <Input type="color" value={draftPrint.dynamic_text_color || "#991b1b"} onChange={(e) => setDraftPrint({ ...draftPrint, dynamic_text_color: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>نمط الاستمارة</Label>
                  <Select value={draftPrint.border_style || "solid"} onValueChange={(v) => setDraftPrint({ ...draftPrint, border_style: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {getPaymentStyleGroups().map(({ group, items }) => (
                        <SelectGroup key={group}>
                          <SelectLabel>{group}</SelectLabel>
                          {items.map((style) => (
                            <SelectItem key={style.id} value={style.id}>{style.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>شفافية لوغو الخلفية ({Math.round((draftPrint.watermark_opacity ?? 0.1) * 100)}%)</Label>
                <Slider
                  value={[(draftPrint.watermark_opacity ?? 0.1) * 100]}
                  max={100}
                  step={1}
                  onValueChange={(val) => setDraftPrint({ ...draftPrint, watermark_opacity: val[0] / 100 })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>رابط شعار المشروع / المدينة</Label>
                <Input
                  value={draftPrint.logo_url || ""}
                  onChange={(e) => setDraftPrint({ ...draftPrint, logo_url: e.target.value })}
                  placeholder="https://..."
                />
                <p className="text-[11px] text-fg-faint">
                  يمكن أيضاً ضبط اللوغو من المشاريع → تعديل → رابط لوغو المشروع. إعدادات الدفعات هنا تتجاوزه.
                </p>
              </div>
              <Button onClick={saveProjectStyle} disabled={saving}>حفظ ستايل الطباعة</Button>
            </div>

            <div className="overflow-auto border border-line bg-white p-2 max-h-[calc(100vh-180px)]">
              <p className="mb-2 px-2 text-[11px] text-fg-faint">معاينة حية — بحجم A4 الفعلي</p>
              <div className="payment-print-preview-shell mx-auto min-w-[210mm]">
                <PaymentPrintDocument
                  booking={SAMPLE_BOOKING}
                  projectName={getProjectName(selectedProjectId)}
                  centerName="مركز المعاينة"
                  centerLogoUrl="/favicon.ico"
                  projectLogoUrl={previewProjectLogo}
                  printSettings={draftPrint}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="units" className="space-y-8">
          <section className="space-y-4 border border-line p-4">
            <div>
              <h3 className="text-[13px] font-medium">أنواع المنازل</h3>
              <p className="mt-1 text-[11px] text-fg-faint">
                أضف النوع (مثل C أو C+) مع مساحة ثابتة إن وُجدت. اترك المساحة فارغة لاستخدام مساحة
                الخريطة — مفيد لـ C+.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_160px_auto]">
              <Input
                value={newHouseType}
                onChange={(e) => setNewHouseType(e.target.value)}
                placeholder="نوع المنزل (C, C+, D...)"
              />
              <Input
                value={newHouseTypeArea}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!isValidAreaInput(value)) return;
                  setNewHouseTypeArea(value);
                }}
                placeholder="مساحة ثابتة (اختياري)"
                inputMode="decimal"
              />
              <Button onClick={addHouseType}>إضافة</Button>
            </div>
            <div className="space-y-2">
              {selectedUnitSettings.house_types.length === 0 ? (
                <p className="text-[12px] text-fg-faint">لا توجد أنواع منازل لهذا المشروع.</p>
              ) : (
                selectedUnitSettings.house_types.map((item) => (
                  <div
                    key={item.type}
                    className="grid items-center gap-2 border border-line px-3 py-2 md:grid-cols-[120px_1fr_auto]"
                  >
                    <span className="text-[13px] font-medium">{item.type}</span>
                    <Input
                      value={houseAreaDrafts[item.type] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!isValidAreaInput(value)) return;
                        setHouseAreaDrafts((prev) => ({ ...prev, [item.type]: value }));
                      }}
                      onBlur={async () => {
                        const parsed = parseAreaInput(houseAreaDrafts[item.type] ?? "");
                        const nextMap = buildProjectUnitSettings({
                          house_types: selectedUnitSettings.house_types.map((row) =>
                            row.type === item.type ? { ...row, area: parsed } : row,
                          ),
                        });
                        if (!nextMap) return;
                        try {
                          await persistUnitSettingsMap(nextMap, "تم تحديث مساحة نوع المنزل");
                        } catch {
                          // toast already shown
                        }
                      }}
                      placeholder="مساحة ثابتة — فارغ = من الخريطة"
                      inputMode="decimal"
                    />
                    <button
                      type="button"
                      onClick={() => removeHouseType(item.type)}
                      className="text-status-sold"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="space-y-4 border border-line p-4">
            <div>
              <h3 className="text-[13px] font-medium">مساحات الشقق</h3>
              <p className="mt-1 text-[11px] text-fg-faint">
                عرّف مساحة كلية وصافية لكل نوع شقة. عند تنظيم آلية لشقة بنفس المساحة الكلية من
                الخريطة، تُملأ تلقائياً.
              </p>
            </div>
            <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
              <Input
                value={newApartmentTotal}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!isValidAreaInput(value)) return;
                  setNewApartmentTotal(value);
                }}
                placeholder="المساحة الكلية (م²)"
                inputMode="decimal"
              />
              <Input
                value={newApartmentNet}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!isValidAreaInput(value)) return;
                  setNewApartmentNet(value);
                }}
                placeholder="المساحة الصافية (م²)"
                inputMode="decimal"
              />
              <Button onClick={addApartmentArea}>إضافة</Button>
            </div>
            <div className="space-y-2">
              {selectedUnitSettings.apartment_areas.length === 0 ? (
                <p className="text-[12px] text-fg-faint">لا توجد مساحات شقق لهذا المشروع.</p>
              ) : (
                selectedUnitSettings.apartment_areas.map((item) => (
                  <div
                    key={item.total_area}
                    className="flex items-center justify-between border border-line px-3 py-2 text-[12px]"
                  >
                    <span>
                      {item.total_area} م² كلية / {item.net_area} م² صافية
                    </span>
                    <button
                      type="button"
                      onClick={() => removeApartmentArea(item.total_area)}
                      className="text-status-sold"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <p className="text-[11px] text-fg-faint">
            يُحفظ تلقائياً في Supabase عند الإضافة أو الحذف. زر الحفظ أدناه لإعادة المزامنة يدوياً إن
            لزم.
          </p>
          <Button onClick={saveUnitSettings} disabled={saving || !selectedProjectId}>
            {saving ? "جاري الحفظ..." : "حفظ إعدادات الوحدات"}
          </Button>
        </TabsContent>

        <TabsContent value="defaults" className="max-w-md space-y-4">
          <div className="space-y-1.5">
            <Label>عدد الدفعات الافتراضي</Label>
            <Input type="number" value={defaults.installment_count} onChange={(e) => setDefaults({ ...defaults, installment_count: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>الفترة بين الدفعات (أشهر)</Label>
            <Input type="number" value={defaults.installment_interval_months} onChange={(e) => setDefaults({ ...defaults, installment_interval_months: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-[12px]">
            <input
              type="checkbox"
              checked={defaults.show_commission_note}
              onChange={(e) => setDefaults({ ...defaults, show_commission_note: e.target.checked })}
            />
            إظهار ملاحظة عمولة الوسيط افتراضياً
          </label>
          <Button onClick={saveDefaultsConfig} disabled={saving}>حفظ الافتراضيات</Button>
        </TabsContent>

        <TabsContent value="archive">
          <Input
            className="mb-4 max-w-md"
            placeholder="بحث بالعميل أو رقم الوحدة..."
            value={archiveSearch}
            onChange={(e) => setArchiveSearch(e.target.value)}
          />
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[760px] text-[12px]">
              <thead className="border-b border-line bg-surface-elevated/40">
                <tr>
                  <th className="px-3 py-2 text-start">العميل</th>
                  <th className="px-3 py-2 text-start">المشروع</th>
                  <th className="px-3 py-2 text-start">الوحدة</th>
                  <th className="px-3 py-2 text-start">التاريخ</th>
                  <th className="px-3 py-2 text-start">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map((b) => (
                  <tr key={b.id} className="border-b border-line/70">
                    <td className="px-3 py-2">{b.client_name}</td>
                    <td className="px-3 py-2">{getProjectName(b.project_id)}</td>
                    <td className="px-3 py-2">{formatPaymentUnitNumber(b)}</td>
                    <td className="px-3 py-2">{formatPaymentDisplayDate(b.created_at, true)}</td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => window.open(`/sales/print/${b.id}`, "_blank")}>طباعة</Button>
                        <Button size="sm" variant="ghost" onClick={() => deleteBooking(b.id)}><Trash2 size={13} /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="logs" className="space-y-3">
          {auditLogs.length === 0 && (
            <p className="text-[13px] text-fg-secondary">لا توجد تعديلات مسجلة بعد.</p>
          )}
          {auditLogs.map((log) => (
            <div key={log.id} className="border border-line p-4 text-[12px]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">تعديل استمارة</p>
                <p className="text-fg-faint">{formatPaymentDisplayDate(log.created_at, true)}</p>
              </div>
              <p className="mt-2 text-fg-secondary">بواسطة: {log.changed_by}</p>
              <p className="mt-1">{log.change_reason}</p>
            </div>
          ))}
        </TabsContent>
      </Tabs>
    </Panel>
  );
};

export default PaymentAdminPanel;
