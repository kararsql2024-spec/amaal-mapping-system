import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { Suspense, lazy, useState, useEffect } from "react";
import Index from "./pages/Index";
import { Project } from "./types/project";
import { supabase } from "@/integrations/supabase/client";
import { LoadingBlock } from "@/components/layout/AppShell";

/**
 * الشاشات الثانوية محمّلة كسولاً: كل واحدة تجرّ مكتبة ثقيلة خاصة بها
 * (recharts للتقارير، محرر المخطط للإدارة)
 * ولا داعي لتحميلها مع الصفحة الرئيسية.
 */
const Admin = lazy(() => import("./pages/Admin"));
const Reports = lazy(() => import("./pages/Reports"));
const Brochure = lazy(() => import("./pages/Brochure"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="mx-auto max-w-[1440px] px-5 py-24 lg:px-8">
    <LoadingBlock label="جاري التحميل" />
  </div>
);

const App = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [housesData, setHousesData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // جلب قائمة المشاريع الأساسية فقط عند تحميل التطبيق
  useEffect(() => {
    const fetchProjectsList = async () => {
      try {
        // جلب المشاريع بدون حقل elements لتقليل الحجم
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('id, name, description, map_width, map_height, created_at')
          .order('created_at', { ascending: false });

        if (projectsError) throw projectsError;
        
        const formattedProjects = (projectsData || []).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          elements: [], // سنقوم بجلبها لاحقاً عند الحاجة
          mapWidth: p.map_width,
          mapHeight: p.map_height,
          createdAt: p.created_at
        }));

        setProjects(formattedProjects);
      } catch (error) {
        console.error("Error fetching projects list:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjectsList();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background text-[13px] text-fg-muted">
        جاري تحميل النظام
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Sonner />
      <BrowserRouter>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route
              path="/"
              element={
                <Index
                  projects={projects}
                  housesData={housesData}
                  setHousesData={setHousesData}
                />
              }
            />
            <Route
              path="/admin"
              element={
                <Admin
                  projects={projects}
                  setProjects={setProjects}
                  setHousesData={setHousesData}
                  housesData={housesData}
                />
              }
            />
            <Route
              path="/reports"
              element={<Reports projects={projects} housesData={housesData} />}
            />
            <Route path="/brochure/:projectId/:unitId" element={<Brochure />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </TooltipProvider>
  );
};

export default App;
