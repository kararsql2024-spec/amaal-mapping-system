"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { 
  Printer, ArrowRight, Bed, Banknote, Calendar, Maximize, Sparkle, 
  Phone, FileImage, CreditCard, Sparkles, ShieldCheck, Mail, Ruler, Home as HomeIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BrochureConfig {
  primaryColor?: string;
  secondaryColor?: string;
  slogan?: string;
  phone?: string;
  phone2?: string;
  marketingLogo?: string;
  projectLogo?: string;
  selectedTemplate?: string;
  advantages?: Record<string, string[]>;
  unitDetails?: Record<string, { 
    rooms?: string; 
    roomsSizes?: string; 
    unitImage?: string; 
    unitImage2?: string;
    unitDescription?: string;
    housePlan?: string;
    totalPrice?: string;
    contractAmount?: string;
    paymentDuration?: string;
    firstInstallment?: string;
    paymentPlanDetails?: string;
  }>;
}

const Brochure = () => {
  const { projectId, unitId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [unitData, setUnitData] = useState<any>(null);
  const [brochureConfig, setBrochureConfig] = useState<BrochureConfig | null>(null);
  const [projectConfig, setProjectConfig] = useState<any>(null);

  useEffect(() => {
    const fetchBrochureData = async () => {
      if (!projectId || !unitId) return;
      setLoading(true);
      try {
        // 1. جلب بيانات المشروع
        const { data: proj, error: projErr } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();
        if (projErr) throw projErr;
        setProject(proj);

        // 2. جلب بيانات الوحدة المحددة
        const { data: unit, error: unitErr } = await supabase
          .from('houses_data')
          .select('*')
          .eq('project_id', projectId)
          .eq('unit_key', unitId)
          .maybeSingle();
        setUnitData(unit?.data || null);

        // 3. جلب الإعدادات العامة (البروشورات وخصائص المشاريع)
        const { data: settings } = await supabase.from('settings').select('*');
        if (settings) {
          const brochures = settings.find(s => s.key === 'brochure_configs');
          if (brochures && brochures.value) {
            setBrochureConfig(brochures.value[projectId] || null);
          }
          const configs = settings.find(s => s.key === 'project_configs');
          if (configs && configs.value) {
            setProjectConfig(configs.value[projectId] || null);
          }
        }
      } catch (err) {
        console.error("Error loading brochure:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBrochureData();
  }, [projectId, unitId]);

  // استخراج الصنف ومطابقته ديناميكياً مع منطق العمارة والمنزل
  const specDetails = useMemo(() => {
    if (!project || !project.elements || !unitId) return null;
    
    // البحث عن العنصر في المخطط (سواء كان معرف المنزل مباشرة، أو معرف العمارة الأساسي)
    const elementId = unitId.includes('_') ? unitId.split('_')[0] : unitId;
    const el = project.elements.find((e: any) => e.id === elementId);
    if (!el) return null;

    let specKey = '';
    let isTower = el.type === 'tower';
    let unitLabel = el.label;

    if (el.type === 'house') {
      const parts = el.label.split('-');
      const lastPart = parts[parts.length - 1] || '';
      const match = lastPart.match(/^([a-zA-Z]+)/);
      specKey = match ? match[1].toUpperCase() : lastPart.toUpperCase();
    } else if (el.type === 'tower' && unitId.includes('_F')) {
      const aptParts = unitId.split('_F');
      const floorPart = aptParts[1]?.split('_A');
      const floorNum = parseInt(floorPart[0]);
      const aptNum = parseInt(floorPart[1]);
      
      const size = floorNum === 1 
        ? (el.groundFloorSizes?.[aptNum - 1] || 0) 
        : (el.typicalFloorSizes?.[aptNum - 1] || 0);
      specKey = size.toString();
      unitLabel = `${el.label}-${floorNum === 1 ? 'الأرضي' : `الطابق ${floorNum - 1}`}-شقة ${aptNum}`;
    }

    // حساب المساحة الكلية بدقة
    let area = '';
    if (el.type === 'house') {
      if (el.customArea && el.customArea > 0) {
        area = `${el.customArea} م²`;
      } else if (projectConfig?.houseTypeAreas) {
        const stdArea = projectConfig.houseTypeAreas[specKey.toUpperCase()];
        if (stdArea) area = `${stdArea} م²`;
      }
    } else {
      area = `${specKey} م²`;
    }

    if (!area) area = specKey ? `${specKey} م²` : 'غير محددة';

    return {
      specKey,
      isTower,
      unitLabel,
      area,
      el
    };
  }, [project, unitId, projectConfig]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center font-bold text-white" dir="rtl">
        <div className="text-center space-y-4">
          <RefreshCcw className="w-10 h-10 text-emerald-500 animate-spin mx-auto" />
          <p className="text-slate-400">جاري معالجة وتوليد البروشور الفاخر للطباعة...</p>
        </div>
      </div>
    );
  }

  if (!project || !brochureConfig) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 text-center" dir="rtl">
        <div className="max-w-md w-full bg-white p-8 rounded-[2.5rem] space-y-6">
          <p className="font-black text-slate-800 text-lg">⚠️ عذراً، لم يتم إعداد أو تصميم البروشور التسويقي لهذا المشروع بعد.</p>
          <Button onClick={() => window.close()} className="bg-slate-900 hover:bg-black rounded-xl">إغلاق النافذة</Button>
        </div>
      </div>
    );
  }

  const activeTemplate = brochureConfig.selectedTemplate || 'classic_gold';
  const primaryColor = brochureConfig.primaryColor || '#16a34a';
  const secondaryColor = brochureConfig.secondaryColor || '#ffffff';
  const specKey = specDetails?.specKey || '';
  const specDetailsConfig = brochureConfig.unitDetails?.[specKey] || {};

  return (
    <div className="min-h-screen bg-slate-900 py-10 print:py-0 print:bg-white" dir="rtl">
      
      {/* شريط أدوات الطباعة العلوي العائم (يختفي تماماً عند الطباعة) */}
      <div className="max-w-[210mm] mx-auto mb-6 bg-slate-800/90 backdrop-blur-md p-4 rounded-2xl flex justify-between items-center text-white print:hidden shadow-xl border border-slate-700">
        <div className="flex items-center gap-3">
          <HomeIcon className="text-emerald-500" size={24} />
          <div>
            <h4 className="font-black text-sm">بروشور الوحدة: {specDetails?.unitLabel || unitId}</h4>
            <p className="text-[10px] font-bold text-slate-400">جاهز للتصدير كملف PDF قياسي A4</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-2 rounded-xl h-11 px-5">
            <Printer size={16} /> طباعة البروشور / حفظ كـ PDF
          </Button>
          <Button variant="ghost" onClick={() => window.close()} className="text-slate-300 hover:text-white hover:bg-slate-700 rounded-xl h-11">
            إغلاق
          </Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-10 print:gap-0">
        
        {/* الصفحة الأولى: الصفحة التسويقية الرئيسية للعلامة التجارية */}
        <div 
          className="bg-white text-right relative shadow-2xl flex flex-col justify-between p-16 overflow-hidden shrink-0 print:shadow-none print:border-0"
          style={{ 
            width: '210mm', 
            height: '297mm', 
            fontFamily: 'Cairo, sans-serif' 
          }}
        >
          {/* الهيكل التخطيطي الحقيقي (Layout) المختار من لوحة التحكم */}
          {activeTemplate === 'modern_dark' ? (
            <div className="absolute inset-0 bg-slate-50 -z-20">
              <div className="absolute top-0 right-0 w-1/3 h-full -z-10" style={{ backgroundColor: primaryColor }} />
              <div className="absolute bottom-10 left-12 w-32 h-1 bg-slate-900/10" />
            </div>
          ) : activeTemplate === 'prestige_blue' ? (
            <div className="absolute inset-0 bg-white -z-20">
              <div className="absolute top-0 left-0 right-0 h-[320px] -z-10" style={{ backgroundColor: secondaryColor }} />
              <div className="absolute top-[320px] left-0 right-0 h-2" style={{ backgroundColor: primaryColor }} />
            </div>
          ) : activeTemplate === 'emerald_garden' ? (
            <div className="absolute inset-0 bg-stone-50 p-6 -z-20">
              <div className="w-full h-full border -z-10" style={{ borderColor: `${primaryColor}20` }} />
            </div>
          ) : (
            <div className="absolute inset-0 bg-white -z-20">
              <div className="absolute top-0 left-0 right-0 h-44 bg-slate-100/50 -z-10 transform -skew-y-3 origin-top-left" />
              <div className="absolute top-0 right-0 w-full h-8" style={{ backgroundColor: primaryColor }} />
            </div>
          )}

          {/* الهيدر والعلامات التجارية بدون إطارات عميقة */}
          <div className="flex justify-between items-center z-10">
            {brochureConfig.marketingLogo ? (
              <img src={brochureConfig.marketingLogo} alt="المركز التسويقي" className="h-16 object-contain" />
            ) : (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black">M</div>
                <span className="font-black text-xs text-slate-800">المركز التسويقي المعتمد</span>
              </div>
            )}

            {brochureConfig.projectLogo ? (
              <img src={brochureConfig.projectLogo} alt="المشروع" className="h-16 object-contain" />
            ) : (
              <div className="flex items-center gap-2 border-r pr-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-white" style={{ backgroundColor: primaryColor }}>H</div>
                <span className="font-black text-xs text-slate-800">{project.name}</span>
              </div>
            )}
          </div>

          {/* منتصف الصفحة الأولى: شعار وصورة ترويجية فخمة ومساحة وصف وصور إضافية */}
          <div className="my-auto space-y-8 relative z-10">
            <div className="space-y-4">
              <div className="inline-block px-4 py-1.5 rounded-full text-xs font-black tracking-widest text-white" style={{ backgroundColor: primaryColor }}>
                بروشور مبيعات رسمي
              </div>
              <h1 className="text-5xl font-black text-slate-900 leading-tight">
                اكتشف وحدتك السكنية <br />
                <span style={{ color: primaryColor }}>
                  {project.name}
                </span>
              </h1>
              
              <p className="max-w-2xl text-base font-bold text-slate-500 leading-relaxed border-r-4 pr-4 border-slate-300">
                {brochureConfig.slogan || 'حيث تلتقي الرفاهية المعمارية وتكتمل تفاصيل الهدوء والاستثمار المضمون.'}
              </p>
            </div>

            {/* الوصف التسويقي الإضافي المكتوب */}
            {specDetailsConfig?.unitDescription && (
              <p className="text-sm font-semibold text-slate-600 leading-relaxed bg-slate-50/80 p-5 rounded-xl border border-slate-100 max-w-3xl">
                {specDetailsConfig.unitDescription}
              </p>
            )}

            {/* صور الواجهة الخارجية الفلات والعصرية بدون تظليل أو إطارات Legos عميقة */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
              <div className={cn(
                "relative overflow-hidden rounded-2xl bg-slate-100", 
                specDetailsConfig?.unitImage2 ? "md:col-span-8 h-[280px]" : "md:col-span-12 h-[340px]"
              )}>
                {specDetailsConfig?.unitImage ? (
                  <img src={specDetailsConfig.unitImage} alt="الواجهة الخارجية" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                    <FileImage size={40} className="text-slate-300" />
                    <span className="text-xs font-bold">صورة الواجهة الخارجية للمشروع السكني</span>
                  </div>
                )}
              </div>

              {specDetailsConfig?.unitImage2 && (
                <div className="md:col-span-4 h-[280px] relative overflow-hidden rounded-2xl bg-slate-100">
                  <img src={specDetailsConfig.unitImage2} alt="الواجهة الخارجية الثانية" className="w-full h-full object-cover" />
                </div>
              )}
            </div>

            {/* شريط معلومات المساحة الكلية والفئة بتصميم فلات حديث مدمج */}
            <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center shadow-lg">
              <div>
                <h4 className="text-lg font-black" style={{ color: primaryColor }}>فئة الوحدة السكنية: {specKey || 'غير محدد'}</h4>
              </div>
              <div className="text-left">
                <span className="text-xs font-bold text-slate-400">المساحة الكلية للوحدة</span>
                <h4 className="text-xl font-black text-white">
                  {specDetails?.area || '---'}
                </h4>
              </div>
            </div>
          </div>

          {/* الفوتر */}
          <div className="border-t pt-8 flex items-center justify-between text-xs font-bold text-slate-400 z-10 relative">
            <div>نظام إدارة الوحدات السكنية التفاعلي</div>
            <div className="flex items-center gap-1.5 bg-slate-50 px-4 py-2 rounded-xl">
              <span className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: primaryColor }} />
              <span className="text-slate-800 font-black">تاريخ الإصدار: {new Date().toLocaleDateString('ar-EG')}</span>
            </div>
          </div>
        </div>

        {/* الصفحة الثانية: تفاصيل الصنف الفنية ومخطط الطابق الداخلي (House Plan) والمعلومات المالية الشاملة */}
        <div 
          className="bg-white text-right relative shadow-2xl flex flex-col justify-between p-16 overflow-hidden shrink-0 print:shadow-none print:border-0"
          style={{ 
            width: '210mm', 
            height: '297mm', 
            fontFamily: 'Cairo, sans-serif' 
          }}
        >
          {/* شريط علوي بلون الهوية */}
          <div className="absolute top-0 right-0 w-full h-4" style={{ backgroundColor: primaryColor }} />

          {/* الهيدر */}
          <div className="flex justify-between items-center border-b pb-6 z-10">
            <div>
              <h2 className="text-2xl font-black" style={{ color: primaryColor }}>
                التفاصيل المالية وجدول الدفعات
              </h2>
              <p className="text-xs font-bold text-slate-400 mt-1">المخطط الهندسي لصنف: {specKey || 'G'}</p>
            </div>
            <span className="text-xs font-black text-slate-500 bg-slate-100 px-4 py-1.5 rounded-full">رمز الوحدة: {specKey || 'G'}</span>
          </div>

          {/* منتصف الصفحة الثانية: تفاصيل مالية + جدول الدفعات ومخطط الطابق */}
          <div className="my-auto grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch z-10">
            
            {/* الجانب الأيمن: جدول المواصفات وتوزيع الغرف بالكامل + المزايا */}
            <div className="space-y-6 flex flex-col justify-between">
              <div className="space-y-3">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Bed size={18} style={{ color: primaryColor }} />
                  توزيع الغرف والمرافق الداخلية
                </h3>
                
                <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                  <div className="p-3.5 flex items-center justify-between border-b bg-slate-900 text-white font-black text-xs">
                    <span>المرفق السكني</span>
                    <span>التفاصيل والمساحات</span>
                  </div>
                  <div className="p-3 flex items-center justify-between border-b text-xs font-bold">
                    <span className="text-slate-600">توزيع الغرف والمرافق:</span>
                    <span className="text-slate-900 font-black">
                      {specDetailsConfig?.rooms || 'مثال: 4 غرف نوم + 3 حمامات + صالة'}
                    </span>
                  </div>
                  <div className="p-3 flex items-center justify-between bg-slate-50/50 text-xs font-bold">
                    <span className="text-slate-600">مساحات الغرف الفردية:</span>
                    <span className="text-slate-900 font-black">
                      {specDetailsConfig?.roomsSizes || 'صالة 6x4، نوم 5x4، مطبخ 4x4'}
                    </span>
                  </div>
                </div>
              </div>

              {/* المزايا الخاصة - تظهر فقط في حال كان هناك ميزة مكتوبة */}
              {brochureConfig.advantages?.[specKey] && brochureConfig.advantages[specKey].length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                    <Sparkle size={18} style={{ color: primaryColor }} />
                    المزايا الخاصة
                  </h3>
                  <div className="grid grid-cols-1 gap-2 bg-slate-50 p-4 rounded-2xl border">
                    {brochureConfig.advantages[specKey].map((adv, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs font-bold text-slate-700 leading-relaxed">
                        <div className="w-2 h-2 rounded-full shrink-0 mt-1.5" style={{ backgroundColor: primaryColor }} />
                        <span>{adv}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* جدول الدفعات والأسعار والمبالغ */}
              <div className="space-y-3">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <CreditCard size={18} style={{ color: primaryColor }} />
                  خطة وجدول الدفعات المالية المرنة
                </h3>
                
                <div className="rounded-2xl border border-slate-100 overflow-hidden shadow-md">
                  <div className="p-3 flex items-center justify-between border-b bg-emerald-50/80 text-emerald-950 font-black text-xs">
                    <span>الدفعة المستحقة</span>
                    <span>القيمة والمبلغ المالي</span>
                  </div>
                  <div className="p-3 flex items-center justify-between border-b text-xs font-bold">
                    <span className="text-slate-600">سعر الوحدة الإجمالي:</span>
                    <span className="font-black text-slate-900" style={{ color: primaryColor }}>
                      {specDetailsConfig?.totalPrice || 'لم يحدد السعر الإجمالي بعد'}
                    </span>
                  </div>
                  <div className="p-3 flex items-center justify-between border-b text-xs font-bold bg-slate-50/50">
                    <span className="text-slate-600">مبلغ توقيع العقد:</span>
                    <span className="font-black text-slate-900">
                      {specDetailsConfig?.contractAmount || 'لم يحدد بعد'}
                    </span>
                  </div>
                  <div className="p-3 flex items-center justify-between text-xs font-bold">
                    <span className="text-slate-600">مدة وتسهيلات التسديد:</span>
                    <span className="font-black text-slate-800 text-right">
                      {specDetailsConfig?.paymentDuration || 'لم تحدد خطة السداد بعد'}
                    </span>
                  </div>
                </div>

                {specDetailsConfig?.paymentPlanDetails && (
                  <p className="text-[10px] font-bold text-slate-500 leading-relaxed bg-amber-50/50 p-2.5 rounded-xl border border-amber-100">
                    ⚠️ <strong>ملاحظات:</strong> {specDetailsConfig.paymentPlanDetails}
                  </p>
                )}
              </div>
            </div>

            {/* الجانب الأيسر: مخطط الطابق الداخلي (House Plan) المرفق */}
            <div className="space-y-4 flex flex-col justify-between">
              <div className="space-y-2">
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <Maximize size={18} style={{ color: primaryColor }} />
                  مخطط الطابق الهندسي (House Plan)
                </h3>
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 flex items-center justify-center overflow-hidden" style={{ height: '360px' }}>
                  {specDetailsConfig?.housePlan ? (
                    <img src={specDetailsConfig.housePlan} alt="House Plan" className="w-full h-full object-contain rounded-xl" />
                  ) : (
                    <div className="text-center text-slate-400 p-4 space-y-2">
                      <Maximize size={32} className="text-slate-300 mx-auto" />
                      <p className="text-[11px] font-bold">يرجى إضافة صورة مخطط الطابق الداخلي للصنف لعرض المخطط الهندسي</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-slate-900 rounded-2xl text-white space-y-3">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Calendar className="text-amber-500" size={16} />
                  <h4 className="font-black text-xs">تواصل مع قسم المبيعات للحجز والاستفسار</h4>
                </div>
                <p className="text-[10px] font-bold text-slate-400 leading-relaxed">
                  احجز موعدك اليوم لمعاينة الوحدة السكنية والحصول على كامل التسهيلات التمويلية.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  {brochureConfig.phone && <span className="text-xs font-black bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">📞 {brochureConfig.phone}</span>}
                  {brochureConfig.phone2 && <span className="text-xs font-black bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">📞 {brochureConfig.phone2}</span>}
                </div>
              </div>
            </div>

          </div>

          {/* الفوتر ووسائل المبيعات */}
          <div className="border-t pt-8 flex items-center justify-between text-xs font-bold text-slate-400 z-10 relative">
            <div>نظام إدارة الوحدات السكنية التفاعلي</div>
            <div>الصفحة 2</div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Brochure;