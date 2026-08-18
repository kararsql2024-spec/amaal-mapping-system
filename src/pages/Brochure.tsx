"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Printer, RefreshCcw, Home as HomeIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrochureDocument } from "@/components/brochure/BrochureDocument";
import type { BrochureConfig } from "@/lib/brochure-types";
import {
  fetchCenterBrochureProfiles,
  getCenterBrochureProfile,
  getActiveCenterName,
  resolveActiveCenterId,
  type CenterBrochureProfile,
} from "@/lib/center-brochure";
import "@/styles/brochure-print.css";

const Brochure = () => {
  const { projectId, unitId } = useParams();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [brochureConfig, setBrochureConfig] = useState<BrochureConfig | null>(null);
  const [projectConfig, setProjectConfig] = useState<any>(null);
  const [centerProfile, setCenterProfile] = useState<CenterBrochureProfile>({});
  const [centerName, setCenterName] = useState("");

  useEffect(() => {
    const fetchBrochureData = async () => {
      if (!projectId || !unitId) return;
      setLoading(true);
      try {
        const centerId = resolveActiveCenterId(searchParams);

        const { data: proj, error: projErr } = await supabase
          .from("projects")
          .select("*")
          .eq("id", projectId)
          .single();
        if (projErr) throw projErr;
        setProject(proj);

        const { data: settings } = await supabase.from("settings").select("*");
        if (settings) {
          const brochures = settings.find((s) => s.key === "brochure_configs");
          if (brochures?.value) {
            setBrochureConfig(brochures.value[projectId] || null);
          }
          const configs = settings.find((s) => s.key === "project_configs");
          if (configs?.value) {
            setProjectConfig(configs.value[projectId] || null);
          }
        }

        if (centerId) {
          const profiles = await fetchCenterBrochureProfiles(supabase);
          setCenterProfile(getCenterBrochureProfile(profiles, centerId));

          const { data: centerRow } = await supabase
            .from("marketing_centers")
            .select("name")
            .eq("id", centerId)
            .maybeSingle();

          setCenterName(centerRow?.name || getActiveCenterName() || "");
        } else {
          setCenterName(getActiveCenterName());
        }
      } catch (err) {
        console.error("Error loading brochure:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBrochureData();
  }, [projectId, unitId, searchParams]);

  const specDetails = useMemo(() => {
    if (!project?.elements || !unitId) return null;

    const elementId = unitId.includes("_") ? unitId.split("_")[0] : unitId;
    const el = project.elements.find((e: any) => e.id === elementId);
    if (!el) return null;

    let specKey = "";
    let unitLabel = el.label;

    if (el.type === "house") {
      const parts = el.label.split("-");
      const lastPart = parts[parts.length - 1] || "";
      const match = lastPart.match(/^([a-zA-Z]+)/);
      specKey = match ? match[1].toUpperCase() : lastPart.toUpperCase();
    } else if (el.type === "tower" && unitId.includes("_F")) {
      const floorPart = unitId.split("_F")[1]?.split("_A");
      const floorNum = parseInt(floorPart[0]);
      const aptNum = parseInt(floorPart[1]);
      const size =
        floorNum === 1
          ? el.groundFloorSizes?.[aptNum - 1] || 0
          : el.typicalFloorSizes?.[aptNum - 1] || 0;
      specKey = size.toString();
      unitLabel = `${el.label}-${floorNum === 1 ? "الأرضي" : `الطابق ${floorNum - 1}`}-شقة ${aptNum}`;
    }

    let area = "";
    if (el.type === "house") {
      if (el.customArea && el.customArea > 0) {
        area = `${el.customArea} m²`;
      } else if (projectConfig?.houseTypeAreas) {
        const stdArea = projectConfig.houseTypeAreas[specKey.toUpperCase()];
        if (stdArea) area = `${stdArea} m²`;
      }
    } else {
      area = `${specKey} m²`;
    }
    if (!area) area = specKey ? `${specKey} m²` : "—";

    return { specKey, unitLabel, area };
  }, [project, unitId, projectConfig]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background" dir="rtl">
        <div className="space-y-4 text-center">
          <RefreshCcw className="mx-auto h-8 w-8 animate-spin text-fg-muted" />
          <p className="text-[13px] text-fg-muted">جاري تحميل البروشور...</p>
        </div>
      </div>
    );
  }

  if (!project || !brochureConfig) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4" dir="rtl">
        <div className="w-full max-w-md space-y-5 border border-line bg-surface p-8 text-center">
          <p className="text-[15px] text-fg-secondary">
            لم يتم إعداد البروشور التسويقي لهذا المشروع بعد.
          </p>
          <Button variant="outline" onClick={() => window.close()}>
            إغلاق
          </Button>
        </div>
      </div>
    );
  }

  const specKey = specDetails?.specKey || "";
  const footerLeft = centerName ? `${centerName} · RealKarar` : "RealKarar";

  return (
    <div className="min-h-screen bg-[#1A1A1A] py-8 print:bg-white print:py-0" dir="rtl">
      <div className="brochure-no-print mx-auto mb-6 flex max-w-[210mm] items-center justify-between rounded-xl border border-[#333] bg-[#252525] p-4 text-white">
        <div className="flex items-center gap-3">
          <HomeIcon className="text-emerald-500" size={22} />
          <div>
            <h4 className="text-[13px] font-semibold">
              {specDetails?.unitLabel || unitId}
            </h4>
            <p className="text-[10px] text-[#999]">
              {centerName ? `قسم: ${centerName}` : "A4 عمودي"} — جاهز للطباعة
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => window.print()}
            className="h-10 gap-2 rounded-lg bg-emerald-600 px-4 text-xs font-semibold hover:bg-emerald-700"
          >
            <Printer size={15} /> طباعة / PDF
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.close()}
            className="h-10 text-[#CCC] hover:bg-[#333] hover:text-white"
          >
            إغلاق
          </Button>
        </div>
      </div>

      <BrochureDocument
        config={brochureConfig}
        projectName={project.name}
        specKey={specKey}
        specArea={specDetails?.area || "—"}
        unitLabel={specDetails?.unitLabel}
        footerLeft={footerLeft}
        centerProfile={centerProfile}
        centerName={centerName}
      />
    </div>
  );
};

export default Brochure;
