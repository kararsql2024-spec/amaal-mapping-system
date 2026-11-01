import React, { useEffect, useState } from "react";
import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/layout/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { fetchCenterBrochureProfiles } from "@/lib/center-brochure";
import { ArchivePrintDocument } from "../components/ArchivePrintDocument";
import { loadArchivePrintPayload, type ArchivePrintPayload } from "../print-payload";
import { PRINT_THEMES } from "../types";
import "../print.css";

const ArchivePrintPage = () => {
  const [payload, setPayload] = useState<ArchivePrintPayload | null>(null);
  const [logos, setLogos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!payload) return;
    const previous = document.title;
    const screenTitle = payload.style.documentTitle || "تقرير الحوافز";
    const pageBackground =
      PRINT_THEMES.find((item) => item.id === payload.style.theme)?.pageBackground || "#ffffff";
    document.title = screenTitle;
    document.documentElement.style.setProperty("--inc-page-bg", pageBackground);
    document.documentElement.style.background = pageBackground;
    document.body.style.background = pageBackground;
    const hideBrowserChrome = () => {
      document.title = " ";
    };
    const restoreTitle = () => {
      document.title = screenTitle;
    };
    window.addEventListener("beforeprint", hideBrowserChrome);
    window.addEventListener("afterprint", restoreTitle);
    return () => {
      document.title = previous;
      document.documentElement.style.removeProperty("--inc-page-bg");
      document.documentElement.style.background = "";
      document.body.style.background = "";
      window.removeEventListener("beforeprint", hideBrowserChrome);
      window.removeEventListener("afterprint", restoreTitle);
    };
  }, [payload]);

  useEffect(() => {
    const load = async () => {
      const next = loadArchivePrintPayload();
      setPayload(next);
      if (next) {
        try {
          const profiles = await fetchCenterBrochureProfiles(supabase);
          const map: Record<string, string> = {};
          Object.entries(profiles).forEach(([id, profile]) => {
            if (profile.marketingLogo) map[id] = profile.marketingLogo;
          });
          setLogos(map);
        } catch (error) {
          console.error(error);
        }
      }
      setLoading(false);
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-[1440px] px-5 py-24">
        <LoadingBlock label="جاري تجهيز تقرير الحوافز" />
      </div>
    );
  }

  if (!payload || payload.model.centers.length === 0) {
    return (
      <div className="py-20 text-center text-[14px] text-neutral-600">
        لا يوجد تقرير للتصدير. ارجع إلى أرشيف الحوافز ثم اضغط تصدير التقرير.
      </div>
    );
  }

  return (
    <>
      <div className="inc-no-print fixed left-0 right-0 top-0 z-50 flex items-center justify-center gap-2 border-b border-neutral-200 bg-white px-4 py-3 shadow-sm">
        <Button variant="outline" size="sm" onClick={() => window.close()} className="gap-1.5">
          <X size={14} /> إغلاق النافذة
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            document.title = " ";
            window.print();
          }}
        >
          <Printer size={14} /> طباعة التقرير
        </Button>
      </div>
      <div className="inc-no-print h-14" />
      <ArchivePrintDocument payload={payload} logos={logos} />
    </>
  );
};

export default ArchivePrintPage;
