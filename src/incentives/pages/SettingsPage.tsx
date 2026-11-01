import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { Panel, SectionHeading, SegmentedControl } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { showError, showSuccess } from "@/utils/toast";
import { useIncentiveCatalog } from "../catalog-context";
import { AddBar, Field, RuleTable, SimpleList } from "../components/forms";
import type { CenterRule, CenterSource, CityRule } from "../types";
import { computeRow } from "../engine";
import { formatAmount } from "../format";
import { createId } from "../id";
import { useIncentiveSettings } from "../settings-context";
import { exportSettingsJson, normalizeSettings } from "../storage";
import { fetchProjectUnits, type CatalogUnit } from "../system-data";
import type { ApartmentSource, MatchMode, SaleRow, UnitKind } from "../types";
import { DEFAULT_PRINT_STYLE, EMPTY_SETTINGS, PRINT_THEMES } from "../types";
import { parseUnitCode } from "../unit-code";

const MATCH_OPTIONS: Array<{ value: MatchMode; label: string }> = [
  { value: "equals", label: "يساوي تماماً" },
  { value: "contains", label: "يحتوي" },
];

const UnitSelect = ({
  projectId,
  value,
  onChange,
}: {
  projectId: string;
  value: string;
  onChange: (unit: CatalogUnit | null) => void;
}) => {
  const [units, setUnits] = useState<CatalogUnit[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!projectId) {
      setUnits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchProjectUnits(projectId)
      .then((next) => {
        if (!cancelled) setUnits(next);
      })
      .catch(() => {
        if (!cancelled) {
          setUnits([]);
          showError("تعذر جلب أرقام الوحدات لهذه المدينة");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const filtered = useMemo(() => {
    const needle = query.trim();
    const matched = needle
      ? units.filter((unit) => unit.label.includes(needle) || unit.key.includes(needle))
      : units;
    const sliced = matched.slice(0, 80);
    if (value && !sliced.some((unit) => unit.key === value)) {
      const selected = units.find((unit) => unit.key === value);
      if (selected) return [selected, ...sliced];
    }
    return sliced;
  }, [query, units, value]);

  if (!projectId) {
    return <p className="text-[12px] text-fg-muted">اختر المدينة أولاً</p>;
  }

  return (
    <div className="space-y-2">
      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={loading ? "جاري جلب الوحدات..." : "ابحث عن رقم الدار"}
        disabled={loading}
      />
      <Select
        value={value || undefined}
        onValueChange={(key) => {
          onChange(units.find((unit) => unit.key === key) || null);
        }}
        disabled={loading || units.length === 0}
      >
        <SelectTrigger>
          <SelectValue placeholder={loading ? "جاري التحميل" : "اختر رقم الدار"} />
        </SelectTrigger>
        <SelectContent>
          {filtered.map((unit) => (
            <SelectItem key={unit.key} value={unit.key}>
              {unit.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

const SettingsPage = () => {
  const { settings, setSettings, syncState } = useIncentiveSettings();
  const catalog = useIncentiveCatalog();
  const printStyle = settings.printStyle || DEFAULT_PRINT_STYLE;

  const [companyName, setCompanyName] = useState("");
  const [unitName, setUnitName] = useState("");
  const [unitKind, setUnitKind] = useState<UnitKind>("house");
  const [unitAmount, setUnitAmount] = useState("");

  const [cityProjectId, setCityProjectId] = useState("");
  const [cityCompanyId, setCityCompanyId] = useState("");

  const [editingCompanyId, setEditingCompanyId] = useState<string | null>(null);
  const [editingUnitTypeId, setEditingUnitTypeId] = useState<string | null>(null);
  const [editingCityRuleId, setEditingCityRuleId] = useState<string | null>(null);
  const [editingCenterRuleId, setEditingCenterRuleId] = useState<string | null>(null);
  const [editingHouseRuleId, setEditingHouseRuleId] = useState<string | null>(null);
  const [editingAptRuleId, setEditingAptRuleId] = useState<string | null>(null);
  const [centerGroupBy, setCenterGroupBy] = useState<"city" | "center">("city");

  const [centerSource, setCenterSource] = useState<CenterSource>("unitNumber");
  const [centerTargetId, setCenterTargetId] = useState("");
  const [centerProjectId, setCenterProjectId] = useState("");
  const [centerPrefix, setCenterPrefix] = useState("");
  const [centerUserName, setCenterUserName] = useState("");
  const [houseCode, setHouseCode] = useState("");
  const [houseTypeId, setHouseTypeId] = useState("");

  const [aptSource, setAptSource] = useState<ApartmentSource>("houseType");
  const [aptValue, setAptValue] = useState("");
  const [aptMode, setAptMode] = useState<MatchMode>("equals");
  const [aptTypeId, setAptTypeId] = useState("");

  const [testProjectId, setTestProjectId] = useState("");
  const [testUnit, setTestUnit] = useState<CatalogUnit | null>(null);
  const [testUserName, setTestUserName] = useState("");
  const [testContractPurpose, setTestContractPurpose] = useState("");

  const importRef = useRef<HTMLInputElement>(null);

  const companyNameById = useMemo(
    () => Object.fromEntries(settings.companies.map((item) => [item.id, item.name])),
    [settings.companies],
  );
  const centerNameById = useMemo(
    () => Object.fromEntries(catalog.centers.map((item) => [item.id, item.name])),
    [catalog.centers],
  );
  const projectNameById = useMemo(
    () => Object.fromEntries(catalog.projects.map((item) => [item.id, item.name])),
    [catalog.projects],
  );
  const unitTypeById = useMemo(
    () => Object.fromEntries(settings.unitTypes.map((item) => [item.id, item])),
    [settings.unitTypes],
  );

  const purposeOptions = useMemo(() => {
    const names = new Set(catalog.contractPurposes);
    settings.eligibility.values.forEach((value) => {
      const name = value.trim();
      if (name) names.add(name);
    });
    if (testContractPurpose.trim()) names.add(testContractPurpose.trim());
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ar"));
  }, [catalog.contractPurposes, settings.eligibility.values, testContractPurpose]);

  const togglePurpose = (value: string) => {
    setSettings((prev) => {
      const selected = new Set(prev.eligibility.values);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      return {
        ...prev,
        eligibility: {
          ...prev.eligibility,
          enabled: true,
          matchMode: "equals",
          values: Array.from(selected),
        },
      };
    });
  };
  const houseTypes = settings.unitTypes.filter((item) => item.kind === "house");
  const apartmentTypes = settings.unitTypes.filter((item) => item.kind === "apartment");

  const testCityName = projectNameById[testProjectId] || "";
  const testResult = useMemo(() => {
    const row: SaleRow = {
      rowNumber: 1,
      cells: {},
      projectId: testProjectId || undefined,
      city: testCityName,
      zone: "",
      unitNumber: testUnit?.label || "",
      userName: testUserName,
      contractPurpose: testContractPurpose,
      houseType: testUnit?.houseType || "",
      area: testUnit?.area || "",
      contractNumber: "",
      buyerName: "",
    };
    return computeRow(row, settings, {
      centers: catalog.centers,
    });
  }, [
    catalog.centers,
    settings,
    testCityName,
    testContractPurpose,
    testProjectId,
    testUnit,
    testUserName,
  ]);

  const parsedTest = parseUnitCode(testUnit?.label || "");

  const cityRuleGroups = useMemo(() => {
    const map = new Map<string, CityRule[]>();
    settings.cityRules.forEach((rule) => {
      const key = rule.companyId || "unknown";
      const list = map.get(key) || [];
      list.push(rule);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .map(([key, rules]) => ({
        key,
        title: companyNameById[key] || "شركة غير معروفة",
        rules,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "ar"));
  }, [companyNameById, settings.cityRules]);

  const prefixCenterRules = useMemo(
    () => settings.centerRules.filter((rule) => rule.source !== "userName"),
    [settings.centerRules],
  );
  const userNameCenterRules = useMemo(
    () => settings.centerRules.filter((rule) => rule.source === "userName"),
    [settings.centerRules],
  );

  const userNameOptions = useMemo(() => {
    const names = new Set(catalog.userNames);
    userNameCenterRules.forEach((rule) => {
      const name = rule.matchValue.trim();
      if (name) names.add(name);
    });
    if (centerUserName.trim()) names.add(centerUserName.trim());
    if (testUserName.trim()) names.add(testUserName.trim());
    return Array.from(names).sort((a, b) => a.localeCompare(b, "ar"));
  }, [catalog.userNames, centerUserName, testUserName, userNameCenterRules]);

  const centerRuleGroups = useMemo(() => {
    const map = new Map<string, CenterRule[]>();
    prefixCenterRules.forEach((rule) => {
      const key =
        centerGroupBy === "city"
          ? rule.projectId || rule.cityValue || "unknown"
          : rule.centerId || "unknown";
      const list = map.get(key) || [];
      list.push(rule);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .map(([key, rules]) => ({
        key,
        title:
          centerGroupBy === "city"
            ? projectNameById[key] || rules[0]?.cityValue || "مدينة غير معروفة"
            : centerNameById[key] || "مركز غير معروف",
        rules,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "ar"));
  }, [
    centerGroupBy,
    centerNameById,
    prefixCenterRules,
    projectNameById,
  ]);

  const userNameRuleGroups = useMemo(() => {
    const map = new Map<string, CenterRule[]>();
    userNameCenterRules.forEach((rule) => {
      const key = rule.centerId || "unknown";
      const list = map.get(key) || [];
      list.push(rule);
      map.set(key, list);
    });
    return Array.from(map.entries())
      .map(([key, rules]) => ({
        key,
        title: centerNameById[key] || "مركز غير معروف",
        rules,
      }))
      .sort((a, b) => a.title.localeCompare(b.title, "ar"));
  }, [centerNameById, userNameCenterRules]);

  const saveCompany = () => {
    const name = companyName.trim();
    if (!name) return;
    if (editingCompanyId) {
      setSettings((prev) => ({
        ...prev,
        companies: prev.companies.map((item) =>
          item.id === editingCompanyId ? { ...item, name } : item,
        ),
      }));
      setEditingCompanyId(null);
    } else {
      setSettings((prev) => ({
        ...prev,
        companies: [...prev.companies, { id: createId(), name }],
      }));
    }
    setCompanyName("");
  };

  const saveUnitType = () => {
    const name = unitName.trim();
    const amount = Number(String(unitAmount).replace(/,/g, ""));
    if (!name || !Number.isFinite(amount) || amount < 0) {
      showError("أدخل اسم النوع ومبلغ الحافز");
      return;
    }
    if (editingUnitTypeId) {
      setSettings((prev) => ({
        ...prev,
        unitTypes: prev.unitTypes.map((item) =>
          item.id === editingUnitTypeId ? { ...item, name, kind: unitKind, amount } : item,
        ),
      }));
      setEditingUnitTypeId(null);
    } else {
      setSettings((prev) => ({
        ...prev,
        unitTypes: [...prev.unitTypes, { id: createId(), name, kind: unitKind, amount }],
      }));
    }
    setUnitName("");
    setUnitAmount("");
  };

  const saveCityRule = () => {
    const project = catalog.projects.find((item) => item.id === cityProjectId);
    if (!project || !cityCompanyId) {
      showError("اختر المدينة والشركة");
      return;
    }
    const nextRule = {
      id: editingCityRuleId || createId(),
      projectId: project.id,
      cityValue: project.name,
      matchMode: "equals" as const,
      companyId: cityCompanyId,
    };
    setSettings((prev) => ({
      ...prev,
      cityRules: editingCityRuleId
        ? prev.cityRules.map((item) => (item.id === editingCityRuleId ? nextRule : item))
        : [...prev.cityRules, nextRule],
    }));
    setEditingCityRuleId(null);
  };

  const resetCenterForm = () => {
    setEditingCenterRuleId(null);
    setCenterPrefix("");
    setCenterUserName("");
  };

  const saveCenterRule = () => {
    if (!centerTargetId) {
      showError("اختر مركز التسويق");
      return;
    }

    if (centerSource === "userName") {
      const userName = centerUserName.trim();
      if (!userName) {
        showError("اختر اسم المستخدم");
        return;
      }
      const nextRule: CenterRule = {
        id: editingCenterRuleId || createId(),
        source: "userName",
        matchValue: userName,
        matchMode: "equals",
        centerId: centerTargetId,
      };
      setSettings((prev) => ({
        ...prev,
        centerRules: editingCenterRuleId
          ? prev.centerRules.map((item) => (item.id === editingCenterRuleId ? nextRule : item))
          : [...prev.centerRules, nextRule],
      }));
      resetCenterForm();
      return;
    }

    const project = catalog.projects.find((item) => item.id === centerProjectId);
    const prefix = centerPrefix.trim();
    if (!project || !prefix) {
      showError("اختر المركز والمدينة واكتب بادئة الرقم مثل Z1- أو A1-");
      return;
    }
    const nextRule: CenterRule = {
      id: editingCenterRuleId || createId(),
      source: "unitNumber",
      matchValue: prefix,
      matchMode: "startsWith",
      centerId: centerTargetId,
      projectId: project.id,
      cityValue: project.name,
      cityMatchMode: "equals",
    };
    setSettings((prev) => ({
      ...prev,
      centerRules: editingCenterRuleId
        ? prev.centerRules.map((item) => (item.id === editingCenterRuleId ? nextRule : item))
        : [...prev.centerRules, nextRule],
    }));
    resetCenterForm();
  };

  const saveHouseRule = () => {
    if (!houseCode.trim() || !houseTypeId) {
      showError("أدخل ترميز المنزل واختر نوع الوحدة");
      return;
    }
    const nextRule = {
      id: editingHouseRuleId || createId(),
      typeCode: houseCode.trim().toUpperCase(),
      unitTypeId: houseTypeId,
    };
    setSettings((prev) => ({
      ...prev,
      houseTypeRules: editingHouseRuleId
        ? prev.houseTypeRules.map((item) => (item.id === editingHouseRuleId ? nextRule : item))
        : [...prev.houseTypeRules, nextRule],
    }));
    setEditingHouseRuleId(null);
    setHouseCode("");
  };

  const saveApartmentRule = () => {
    if (!aptValue.trim() || !aptTypeId) {
      showError("أكمل قيمة المطابقة ونوع الشقة");
      return;
    }
    const nextRule = {
      id: editingAptRuleId || createId(),
      source: aptSource,
      matchValue: aptValue.trim(),
      matchMode: aptMode,
      unitTypeId: aptTypeId,
    };
    setSettings((prev) => ({
      ...prev,
      apartmentTypeRules: editingAptRuleId
        ? prev.apartmentTypeRules.map((item) => (item.id === editingAptRuleId ? nextRule : item))
        : [...prev.apartmentTypeRules, nextRule],
    }));
    setEditingAptRuleId(null);
    setAptValue("");
  };

  const exportJson = () => {
    const blob = new Blob([exportSettingsJson(settings)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "incentive-settings.json";
    anchor.click();
    URL.revokeObjectURL(url);
    showSuccess("تم تنزيل ملف الإعدادات");
  };

  const importJson = async (file: File) => {
    try {
      const text = await file.text();
      setSettings(normalizeSettings(JSON.parse(text)));
      showSuccess("تم استيراد الإعدادات");
    } catch {
      showError("ملف الإعدادات غير صالح");
    }
  };

  const resetAll = () => {
    if (!window.confirm("سيتم حذف كل الشركات والقواعد. هل أنت متأكد؟")) return;
    setSettings((prev) => ({
      ...EMPTY_SETTINGS,
      columns: { ...EMPTY_SETTINGS.columns },
      eligibility: { ...EMPTY_SETTINGS.eligibility, values: [] },
      monthSnapshots: prev.monthSnapshots,
    }));
    showSuccess("تم تفريغ الإعدادات");
  };

  return (
    <div className="space-y-8 pt-8">
      <SectionHeading
        eyebrow="لوحة التحكم"
        title="قواعد الحافز"
        description="المدن والمراكز تُجلب من النظام. إعدادات الحافز تُحفظ في السحابة حتى تظهر من أي متصفح بعد تسجيل الدخول."
        actions={
          <div className="flex flex-wrap gap-2">
            <input
              ref={importRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importJson(file);
                event.target.value = "";
              }}
            />
            <Button type="button" variant="outline" onClick={() => importRef.current?.click()}>
              <Upload className="h-4 w-4" />
              استيراد
            </Button>
            <Button type="button" variant="outline" onClick={exportJson}>
              <Download className="h-4 w-4" />
              تصدير
            </Button>
            <Button type="button" variant="ghost" onClick={resetAll}>
              تفريغ
            </Button>
          </div>
        }
      />

      {catalog.error ? (
        <p className="text-[13px] text-destructive">{catalog.error}</p>
      ) : null}
      {catalog.loading ? (
        <p className="text-[12px] text-fg-muted">جاري جلب المدن والمراكز وأسماء المستخدمين من قاعدة البيانات...</p>
      ) : (
        <p className="text-[12px] text-fg-muted">
          {catalog.projects.length} مدينة · {catalog.centers.length} مركز تسويق · {catalog.userNames.length} اسم مستخدم · {catalog.contractPurposes.length} غاية عقد
          {" · "}
          {syncState === "saving"
            ? "جاري حفظ الإعدادات في السحابة"
            : syncState === "error"
              ? "تعذر الحفظ السحابي — الإعدادات ما زالت على هذا الجهاز"
              : syncState === "loading"
                ? "جاري مزامنة الإعدادات"
                : "الإعدادات محفوظة في السحابة"}
        </p>
      )}

      <Tabs defaultValue="entities" className="space-y-5">
        <TabsList className="flex h-auto w-full flex-wrap justify-start">
          <TabsTrigger value="entities">الكيانات</TabsTrigger>
          <TabsTrigger value="rules">قواعد الربط</TabsTrigger>
          <TabsTrigger value="tester">تجربة قاعدة</TabsTrigger>
          <TabsTrigger value="print">ستايل التصدير</TabsTrigger>
        </TabsList>

        <TabsContent value="entities" className="space-y-5">
          <Panel
            title="الشركات"
            description="الشركات ليست جزءاً من نظام الوحدات، لذلك تُضاف هنا يدوياً ثم تُربط بالمدن."
          >
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <Input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="مثال: شركة أنوار الابتسامة"
                onKeyDown={(event) => event.key === "Enter" && saveCompany()}
              />
              <AddBar
                onAdd={saveCompany}
                disabled={!companyName.trim()}
                label={editingCompanyId ? "حفظ التعديل" : "إضافة"}
              />
              {editingCompanyId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingCompanyId(null);
                    setCompanyName("");
                  }}
                >
                  إلغاء
                </Button>
              ) : null}
            </div>
            <SimpleList
              items={settings.companies}
              empty="لا توجد شركات بعد"
              onEdit={(id) => {
                const item = settings.companies.find((company) => company.id === id);
                if (!item) return;
                setEditingCompanyId(id);
                setCompanyName(item.name);
              }}
              onDelete={(id) =>
                setSettings((prev) => ({
                  ...prev,
                  companies: prev.companies.filter((item) => item.id !== id),
                  cityRules: prev.cityRules.filter((rule) => rule.companyId !== id),
                }))
              }
            />
          </Panel>

          <Panel
            title="أنواع الوحدات ومبالغ الحافز"
            description="منزل طابق ونصف، شقة 105م، وغيرها — مع المبلغ لكل نوع."
          >
            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_140px_140px_auto]">
              <Input
                value={unitName}
                onChange={(event) => setUnitName(event.target.value)}
                placeholder="مثال: منزل طابق ونصف"
              />
              <Select value={unitKind} onValueChange={(value) => setUnitKind(value as UnitKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="house">منزل</SelectItem>
                  <SelectItem value="apartment">شقة</SelectItem>
                </SelectContent>
              </Select>
              <Input
                inputMode="numeric"
                value={unitAmount}
                onChange={(event) => setUnitAmount(event.target.value)}
                placeholder="300000"
              />
              <AddBar onAdd={saveUnitType} label={editingUnitTypeId ? "حفظ التعديل" : "إضافة"} />
              {editingUnitTypeId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingUnitTypeId(null);
                    setUnitName("");
                    setUnitAmount("");
                  }}
                >
                  إلغاء
                </Button>
              ) : null}
            </div>
            <SimpleList
              items={settings.unitTypes}
              empty="لا توجد أنواع وحدات بعد"
              renderMeta={(item) => {
                const unit = unitTypeById[item.id];
                if (!unit) return null;
                return `${unit.kind === "house" ? "منزل" : "شقة"} — ${formatAmount(unit.amount)} د.ع`;
              }}
              onEdit={(id) => {
                const item = settings.unitTypes.find((unit) => unit.id === id);
                if (!item) return;
                setEditingUnitTypeId(id);
                setUnitName(item.name);
                setUnitKind(item.kind);
                setUnitAmount(String(item.amount));
              }}
              onDelete={(id) =>
                setSettings((prev) => ({
                  ...prev,
                  unitTypes: prev.unitTypes.filter((item) => item.id !== id),
                  houseTypeRules: prev.houseTypeRules.filter((rule) => rule.unitTypeId !== id),
                  apartmentTypeRules: prev.apartmentTypeRules.filter(
                    (rule) => rule.unitTypeId !== id,
                  ),
                }))
              }
            />
          </Panel>

          <Panel
            title="غايات العقد"
            description="اختر الغايات التي تدخل في احتساب الحافز. إن لم تُختر أي غاية — أو أُوقف التفعيل — تُحتسب كل الغايات. تظهر القائمة من البيانات المرفوعة في تحديث المبيعات."
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-[13px] text-fg">تفعيل التصفية حسب الغاية</span>
              <Switch
                checked={settings.eligibility.enabled}
                onCheckedChange={(enabled) =>
                  setSettings((prev) => ({
                    ...prev,
                    eligibility: { ...prev.eligibility, enabled },
                  }))
                }
              />
            </div>
            {purposeOptions.length === 0 ? (
              <p className="text-[12px] text-fg-muted">
                لا توجد غايات بعد. ستظهر هنا بعد رفع ملف المبيعات مع عمود الغاية من العقد.
              </p>
            ) : (
              <ul className="divide-y divide-line border border-line">
                {purposeOptions.map((purpose) => {
                  const checked = settings.eligibility.values.includes(purpose);
                  return (
                    <li key={purpose} className="flex items-center gap-3 px-4 py-2.5">
                      <Checkbox
                        id={`purpose-${purpose}`}
                        checked={checked}
                        onCheckedChange={() => togglePurpose(purpose)}
                        disabled={!settings.eligibility.enabled}
                      />
                      <label
                        htmlFor={`purpose-${purpose}`}
                        className="cursor-pointer text-[13px] text-fg"
                      >
                        {purpose}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
            {settings.eligibility.enabled && settings.eligibility.values.length > 0 ? (
              <p className="mt-3 text-[12px] text-fg-muted">
                سيُحتسب الحافز فقط للوحدات ذات: {settings.eligibility.values.join("، ")}
              </p>
            ) : null}
          </Panel>
        </TabsContent>

        <TabsContent value="rules" className="space-y-5">
          <Panel
            title="المدينة → الشركة"
            description="كل شركة لها جدول مدنها، حتى لا تختلط المدن عند الإضافة."
          >
            <div className="mb-4 grid gap-2 md:grid-cols-[1fr_1fr_auto_auto]">
              <Select value={cityProjectId} onValueChange={setCityProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر المدينة" />
                </SelectTrigger>
                <SelectContent>
                  {catalog.projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={cityCompanyId} onValueChange={setCityCompanyId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الشركة" />
                </SelectTrigger>
                <SelectContent>
                  {settings.companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AddBar
                onAdd={saveCityRule}
                label={editingCityRuleId ? "حفظ التعديل" : "إضافة"}
              />
              {editingCityRuleId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingCityRuleId(null)}
                >
                  إلغاء
                </Button>
              ) : null}
            </div>
            {cityRuleGroups.length === 0 ? (
              <RuleTable headers={["المدينة"]} empty="لا توجد قواعد مدن" rows={[]} />
            ) : (
              <div className="space-y-4">
                {cityRuleGroups.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <h4 className="text-[13px] font-medium text-fg">{group.title}</h4>
                    <RuleTable
                      headers={["المدينة"]}
                      empty="لا مدن"
                      rows={group.rules.map((rule) => ({
                        id: rule.id,
                        cells: [
                          projectNameById[rule.projectId || ""] || rule.cityValue,
                        ],
                        onEdit: () => {
                          setEditingCityRuleId(rule.id);
                          setCityProjectId(rule.projectId || "");
                          setCityCompanyId(rule.companyId);
                        },
                        onDelete: () =>
                          setSettings((prev) => ({
                            ...prev,
                            cityRules: prev.cityRules.filter((item) => item.id !== rule.id),
                          })),
                      }))}
                    />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="بادئة الرقم → مركز التسويق"
            description="اختر الربط ببادئة الرقم مع المدينة، أو باسم المستخدم المخزّن من ملف المبيعات. الجداول مفصولة حتى لا تختلط القاعدتان."
            actions={
              <SegmentedControl
                value={centerGroupBy}
                onChange={setCenterGroupBy}
                options={[
                  { value: "city", label: "حسب المدينة" },
                  { value: "center", label: "حسب المركز" },
                ]}
              />
            }
          >
            <div className="mb-4">
              <SegmentedControl
                value={centerSource}
                onChange={setCenterSource}
                options={[
                  { value: "unitNumber", label: "بادئة الرقم" },
                  { value: "userName", label: "اسم المستخدم" },
                ]}
              />
            </div>
            {centerSource === "userName" ? (
              <div className="mb-4 grid gap-3 lg:grid-cols-2">
                <Field label="مركز التسويق">
                  <Select value={centerTargetId} onValueChange={setCenterTargetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المركز" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalog.centers.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="اسم المستخدم">
                  {userNameOptions.length === 0 ? (
                    <p className="text-[12px] text-fg-muted">
                      لا توجد أسماء مستخدمين بعد. ستظهر هنا بعد رفع ملف المبيعات مع عمود اسم المستخدم.
                    </p>
                  ) : (
                    <Select value={centerUserName || undefined} onValueChange={setCenterUserName}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر اسم المستخدم" />
                      </SelectTrigger>
                      <SelectContent>
                        {userNameOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </div>
            ) : (
              <div className="mb-4 grid gap-3 lg:grid-cols-3">
                <Field label="مركز التسويق">
                  <Select value={centerTargetId} onValueChange={setCenterTargetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المركز" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalog.centers.map((center) => (
                        <SelectItem key={center.id} value={center.id}>
                          {center.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="المدينة">
                  <Select value={centerProjectId} onValueChange={setCenterProjectId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      {catalog.projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="البادئة">
                  <Input
                    value={centerPrefix}
                    onChange={(event) => setCenterPrefix(event.target.value)}
                    placeholder="Z1- أو A1-"
                    onKeyDown={(event) => event.key === "Enter" && saveCenterRule()}
                  />
                </Field>
              </div>
            )}
            <div className="mb-4 flex gap-2">
              <AddBar
                onAdd={saveCenterRule}
                label={editingCenterRuleId ? "حفظ التعديل" : "إضافة"}
              />
              {editingCenterRuleId ? (
                <Button type="button" variant="outline" onClick={resetCenterForm}>
                  إلغاء
                </Button>
              ) : null}
            </div>
            {centerRuleGroups.length === 0 ? (
              <RuleTable headers={["يبدأ بـ"]} empty="لا توجد قواعد بادئة" rows={[]} />
            ) : (
              <div className="space-y-5">
                {centerRuleGroups.map((group) => (
                  <div key={group.key} className="space-y-2">
                    <h4 className="text-[13px] font-medium text-fg">{group.title}</h4>
                    <RuleTable
                      headers={
                        centerGroupBy === "city"
                          ? ["يبدأ بـ", "المركز"]
                          : ["المدينة", "يبدأ بـ"]
                      }
                      empty="لا قواعد"
                      rows={group.rules.map((rule) => ({
                        id: rule.id,
                        cells:
                          centerGroupBy === "city"
                            ? [
                                rule.matchValue,
                                centerNameById[rule.centerId] || "—",
                              ]
                            : [
                                projectNameById[rule.projectId || ""] ||
                                  rule.cityValue ||
                                  "—",
                                rule.matchValue,
                              ],
                        onEdit: () => {
                          setCenterSource("unitNumber");
                          setEditingCenterRuleId(rule.id);
                          setCenterTargetId(rule.centerId);
                          setCenterProjectId(rule.projectId || "");
                          setCenterPrefix(rule.matchValue);
                          setCenterUserName("");
                        },
                        onDelete: () =>
                          setSettings((prev) => ({
                            ...prev,
                            centerRules: prev.centerRules.filter(
                              (item) => item.id !== rule.id,
                            ),
                          })),
                      }))}
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-3 border-t border-line pt-5">
              <h4 className="text-[13px] font-medium text-fg">قواعد اسم المستخدم</h4>
              {userNameRuleGroups.length === 0 ? (
                <RuleTable
                  headers={["اسم المستخدم"]}
                  empty="لا توجد قواعد باسم المستخدم"
                  rows={[]}
                />
              ) : (
                <div className="space-y-5">
                  {userNameRuleGroups.map((group) => (
                    <div key={group.key} className="space-y-2">
                      <h4 className="text-[13px] font-medium text-fg">{group.title}</h4>
                      <RuleTable
                        headers={["اسم المستخدم"]}
                        empty="لا قواعد"
                        rows={group.rules.map((rule) => ({
                          id: rule.id,
                          cells: [rule.matchValue],
                          onEdit: () => {
                            setCenterSource("userName");
                            setEditingCenterRuleId(rule.id);
                            setCenterTargetId(rule.centerId);
                            setCenterUserName(rule.matchValue);
                            setCenterPrefix("");
                            setCenterProjectId("");
                          },
                          onDelete: () =>
                            setSettings((prev) => ({
                              ...prev,
                              centerRules: prev.centerRules.filter(
                                (item) => item.id !== rule.id,
                              ),
                            })),
                        }))}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Panel>

          <Panel
            title="ترميز المنازل"
            description="المنزل بالشكل Z1-B1-C1. الحرف الأخير هو النوع: C أو F — وهذا ليس شقة."
          >
            <div className="mb-4 grid gap-2 md:grid-cols-[160px_1fr_auto]">
              <Input
                value={houseCode}
                onChange={(event) => setHouseCode(event.target.value)}
                placeholder="C أو C+ أو F"
              />
              <Select value={houseTypeId} onValueChange={setHouseTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="نوع المنزل ومبلغه" />
                </SelectTrigger>
                <SelectContent>
                  {houseTypes.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} — {formatAmount(unit.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AddBar
                onAdd={saveHouseRule}
                label={editingHouseRuleId ? "حفظ التعديل" : "إضافة"}
              />
              {editingHouseRuleId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingHouseRuleId(null);
                    setHouseCode("");
                  }}
                >
                  إلغاء
                </Button>
              ) : null}
            </div>
            <RuleTable
              headers={["الترميز", "نوع الوحدة", "المبلغ"]}
              empty="لا توجد قواعد منازل"
              rows={settings.houseTypeRules.map((rule) => ({
                id: rule.id,
                cells: [
                  rule.typeCode,
                  unitTypeById[rule.unitTypeId]?.name || "—",
                  unitTypeById[rule.unitTypeId]
                    ? `${formatAmount(unitTypeById[rule.unitTypeId].amount)} د.ع`
                    : "—",
                ],
                onEdit: () => {
                  setEditingHouseRuleId(rule.id);
                  setHouseCode(rule.typeCode);
                  setHouseTypeId(rule.unitTypeId);
                },
                onDelete: () =>
                  setSettings((prev) => ({
                    ...prev,
                    houseTypeRules: prev.houseTypeRules.filter((item) => item.id !== rule.id),
                  })),
              }))}
            />
          </Panel>

          <Panel
            title="ترميز الشقق"
            description="الشقة بالشكل A1-F1-P1. اربط نوع البرج أو المساحة أو رقم الوحدة."
          >
            <div className="mb-4 grid gap-2 lg:grid-cols-[160px_1fr_160px_1fr_auto]">
              <Select
                value={aptSource}
                onValueChange={(value) => setAptSource(value as ApartmentSource)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="houseType">نوع / اسم البرج</SelectItem>
                  <SelectItem value="area">المساحة</SelectItem>
                  <SelectItem value="unitNumber">رقم الدار</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={aptValue}
                onChange={(event) => setAptValue(event.target.value)}
                placeholder="A105 أو 105"
              />
              <Select value={aptMode} onValueChange={(value) => setAptMode(value as MatchMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MATCH_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={aptTypeId} onValueChange={setAptTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="نوع الشقة ومبلغها" />
                </SelectTrigger>
                <SelectContent>
                  {apartmentTypes.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} — {formatAmount(unit.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AddBar
                onAdd={saveApartmentRule}
                label={editingAptRuleId ? "حفظ التعديل" : "إضافة"}
              />
              {editingAptRuleId ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingAptRuleId(null);
                    setAptValue("");
                  }}
                >
                  إلغاء
                </Button>
              ) : null}
            </div>
            <RuleTable
              headers={["المصدر", "القيمة", "المطابقة", "النوع"]}
              empty="لا توجد قواعد شقق"
              rows={settings.apartmentTypeRules.map((rule) => ({
                id: rule.id,
                cells: [
                  rule.source === "houseType"
                    ? "نوع / اسم البرج"
                    : rule.source === "area"
                      ? "المساحة"
                      : "رقم الدار",
                  rule.matchValue,
                  rule.matchMode === "equals" ? "يساوي" : "يحتوي",
                  unitTypeById[rule.unitTypeId]?.name || "—",
                ],
                onEdit: () => {
                  setEditingAptRuleId(rule.id);
                  setAptSource(rule.source);
                  setAptValue(rule.matchValue);
                  setAptMode(rule.matchMode === "startsWith" ? "contains" : rule.matchMode);
                  setAptTypeId(rule.unitTypeId);
                },
                onDelete: () =>
                  setSettings((prev) => ({
                    ...prev,
                    apartmentTypeRules: prev.apartmentTypeRules.filter(
                      (item) => item.id !== rule.id,
                    ),
                  })),
              }))}
            />
          </Panel>
        </TabsContent>

        <TabsContent value="tester">
          <Panel
            title="جرّب قاعدة"
            description="اختر مدينة ووحدة من النظام لترى الجملة الناتجة."
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="المدينة">
                <Select
                  value={testProjectId}
                  onValueChange={(value) => {
                    setTestProjectId(value);
                    setTestUnit(null);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المدينة" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="رقم الدار">
                <UnitSelect
                  projectId={testProjectId}
                  value={testUnit?.key || ""}
                  onChange={setTestUnit}
                />
              </Field>
              <Field label="اسم المستخدم">
                {userNameOptions.length === 0 ? (
                  <p className="text-[12px] text-fg-muted">لا توجد أسماء بعد</p>
                ) : (
                  <Select
                    value={testUserName || undefined}
                    onValueChange={setTestUserName}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختياري" />
                    </SelectTrigger>
                    <SelectContent>
                      {userNameOptions.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
              <Field label="الغاية من العقد">
                {purposeOptions.length === 0 ? (
                  <p className="text-[12px] text-fg-muted">لا توجد غايات بعد</p>
                ) : (
                  <Select
                    value={testContractPurpose || undefined}
                    onValueChange={setTestContractPurpose}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختياري" />
                    </SelectTrigger>
                    <SelectContent>
                      {purposeOptions.map((purpose) => (
                        <SelectItem key={purpose} value={purpose}>
                          {purpose}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </Field>
            </div>
            <div className="mt-5 space-y-3 border border-line bg-surface-sunken px-4 py-4">
              <p className="text-[11px] text-fg-muted">
                التصنيف:{" "}
                <span className="text-fg">
                  {parsedTest.kind === "house"
                    ? `منزل — النوع ${parsedTest.typeCode || "—"}`
                    : parsedTest.kind === "apartment"
                      ? `شقة — ${parsedTest.raw}`
                      : "غير معروف"}
                </span>
              </p>
              <p className="text-[15px] leading-relaxed text-fg">
                {testResult.included
                  ? testResult.sentence
                  : testResult.skipReason || testResult.sentence}
              </p>
              {testResult.conflictNote ? (
                <p className="text-[12px] text-amber-700 dark:text-amber-400">
                  تضارب: {testResult.conflictNote}
                </p>
              ) : null}
              {testResult.missing.length > 0 ? (
                <p className="text-[12px] text-fg-muted">
                  ينقص: {testResult.missing.join("، ")}
                </p>
              ) : null}
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="print">
          <Panel
            title="ستايل كشف الحافز"
            description="كل ثيم يغيّر تخطيط الصفحة. عند الطباعة تُخفى ترويسة المتصفح، ويملأ لون الثيم بقية الصفحة حتى لو كان المحتوى أقصر من A4."
          >
            <div className="mb-5 grid gap-3 sm:grid-cols-2">
              <Field label="عنوان الكشف">
                <Input
                  value={printStyle.documentTitle}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      printStyle: {
                        ...(prev.printStyle || DEFAULT_PRINT_STYLE),
                        documentTitle: event.target.value,
                      },
                    }))
                  }
                />
              </Field>
              <Field label="ملاحظة التذييل">
                <Input
                  value={printStyle.footerNote}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      printStyle: {
                        ...(prev.printStyle || DEFAULT_PRINT_STYLE),
                        footerNote: event.target.value,
                      },
                    }))
                  }
                />
              </Field>
            </div>
            <Field label="الثيم" className="mb-5">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                {PRINT_THEMES.map((theme) => {
                  const active = printStyle.theme === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          printStyle: {
                            ...(prev.printStyle || DEFAULT_PRINT_STYLE),
                            theme: theme.id,
                            accentColor: theme.accentColor,
                          },
                        }))
                      }
                      className={`border px-3 py-3 text-start text-[12px] transition-colors ${
                        active
                          ? "border-fg bg-surface-sunken text-fg"
                          : "border-line text-fg-secondary hover:border-line-strong"
                      }`}
                    >
                      <span
                        className="mb-2 block h-2 w-full"
                        style={{ background: theme.accentColor }}
                      />
                      <span className="block font-medium">{theme.label}</span>
                      <span className="mt-1 block text-[11px] text-fg-muted">{theme.hint}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="mb-5 flex flex-wrap items-center gap-6">
              <Field label="لون التمييز">
                <Input
                  type="color"
                  value={printStyle.accentColor}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      printStyle: {
                        ...(prev.printStyle || DEFAULT_PRINT_STYLE),
                        accentColor: event.target.value,
                      },
                    }))
                  }
                  className="h-9 w-16 cursor-pointer p-1"
                />
              </Field>
              <label className="flex items-center gap-2 text-[13px] text-fg">
                <Switch
                  checked={printStyle.showWatermark}
                  onCheckedChange={(showWatermark) =>
                    setSettings((prev) => ({
                      ...prev,
                      printStyle: {
                        ...(prev.printStyle || DEFAULT_PRINT_STYLE),
                        showWatermark,
                      },
                    }))
                  }
                />
                إظهار لوغو المركز كعلامة مائية
              </label>
            </div>
            <div
              className="border border-line px-5 py-6 text-center"
              style={{ borderColor: printStyle.accentColor }}
            >
              <p className="text-[11px] text-fg-muted">معاينة العنوان</p>
              <p
                className="mt-1 text-[20px] font-semibold"
                style={{ color: printStyle.accentColor }}
              >
                {printStyle.documentTitle}
              </p>
              <p className="mt-2 text-[12px] text-fg-muted">
                {printStyle.footerNote || "نظام الحوافز"}
              </p>
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
