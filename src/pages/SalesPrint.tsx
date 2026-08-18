"use client";

import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Printer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PaymentPrintDocument } from "@/components/payment/PaymentPrintDocument";
import { LoadingBlock } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  fetchCenterBrochureProfiles,
  getCenterBrochureProfile,
} from "@/lib/center-brochure";
import {
  canAccessPaymentPrint,
  fetchSessionDeptPermissions,
} from "@/lib/dept-permissions";
import {
  fetchPaymentPrintSettings,
  getPaymentPrintSettings,
} from "@/lib/payment-settings";
import { resolveProjectPaymentLogo, type ProjectConfigsMap } from "@/lib/project-config";
import type { PaymentBookingRecord } from "@/lib/payment-types";
import "@/styles/payment-print.css";

const SalesPrint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<PaymentBookingRecord | null>(null);
  const [projectName, setProjectName] = useState("");
  const [centerName, setCenterName] = useState("");
  const [centerLogoUrl, setCenterLogoUrl] = useState("");
  const [projectLogoUrl, setProjectLogoUrl] = useState("");
  const [printSettings, setPrintSettings] = useState({});

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      try {
        const { center, permissions } = await fetchSessionDeptPermissions(supabase);
        if (!center) {
          navigate("/");
          return;
        }
        if (!canAccessPaymentPrint(permissions)) {
          navigate("/");
          return;
        }

        const { data, error } = await supabase
          .from("payment_bookings")
          .select("*")
          .eq("id", id)
          .maybeSingle();

        if (error) throw error;
        if (!data) return;

        setBooking(data as PaymentBookingRecord);
        setCenterName(data.created_by_center_name || "");

        const [{ data: project }, { data: projectConfigsRow }, printSettingsMap, centerProfiles] =
          await Promise.all([
            supabase.from("projects").select("name").eq("id", data.project_id).maybeSingle(),
            supabase.from("settings").select("value").eq("key", "project_configs").maybeSingle(),
            fetchPaymentPrintSettings(supabase),
            fetchCenterBrochureProfiles(supabase),
          ]);

        setProjectName(project?.name || "");
        const projectConfigs = (projectConfigsRow?.value || {}) as ProjectConfigsMap;
        const projectPrintSettings = getPaymentPrintSettings(printSettingsMap, data.project_id);
        setPrintSettings(projectPrintSettings);
        setProjectLogoUrl(
          resolveProjectPaymentLogo(data.project_id, projectPrintSettings, projectConfigs),
        );

        const centerProfile = getCenterBrochureProfile(centerProfiles, data.marketing_center_id);
        setCenterLogoUrl(centerProfile.marketingLogo || "");

        if (!data.created_by_center_name) {
          const { data: centerRow } = await supabase
            .from("marketing_centers")
            .select("name")
            .eq("id", data.marketing_center_id)
            .maybeSingle();
          if (centerRow?.name) setCenterName(centerRow.name);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id, navigate]);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-24">
        <LoadingBlock label="جاري تحميل الاستمارة" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="py-20 text-center text-[14px] text-neutral-600">الاستمارة غير موجودة</div>
    );
  }

  return (
    <>
      <div className="payment-no-print fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 border-b border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <Button variant="outline" size="sm" onClick={() => window.close()} className="gap-1.5">
          <X size={14} /> إغلاق النافذة
        </Button>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer size={14} /> طباعة الاستمارة
        </Button>
      </div>

      <div className="payment-no-print h-14" />

      <PaymentPrintDocument
        booking={booking}
        projectName={projectName}
        centerName={centerName}
        centerLogoUrl={centerLogoUrl}
        projectLogoUrl={projectLogoUrl}
        printSettings={printSettings}
      />
    </>
  );
};

export default SalesPrint;
