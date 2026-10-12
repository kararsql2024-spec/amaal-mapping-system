import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
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
const SalesForm = lazy(() => import("./pages/SalesForm"));
const SalesPrint = lazy(() => import("./pages/SalesPrint"));
const SalesArchive = lazy(() => import("./pages/SalesArchive"));
const IncentiveApp = lazy(() => import("./incentives/IncentiveApp"));
const Explore = lazy(() => import("./pages/Explore"));
const TourEditor = lazy(() => import("./tour/TourEditor"));
const TourView = lazy(() => import("./tour/TourView"));
const NotFound = lazy(() => import("./pages/NotFound"));

const RouteFallback = () => (
  <div className="mx-auto max-w-[1440px] px-5 py-24 lg:px-8">
    <LoadingBlock label="جاري التحميل" />
  </div>
);

const SalesApp = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [housesData, setHousesData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjectsList = async () => {
      try {
        const { data: projectsData, error: projectsError } = await supabase
          .from("projects")
          .select("id, name, description, map_width, map_height, created_at")
          .order("created_at", { ascending: false });

        if (projectsError) throw projectsError;

        const formattedProjects = (projectsData || []).map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description || "",
          elements: [],
          mapWidth: p.map_width,
          mapHeight: p.map_height,
          createdAt: p.created_at,
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
      <Route path="/explore" element={<Explore projects={projects} />} />
      <Route path="/toureditor" element={<TourEditor />} />
      <Route path="/tour/:tourId" element={<TourView />} />
      <Route path="/brochure/:projectId/:unitId" element={<Brochure />} />
      <Route path="/sales/new/:projectId/:unitId" element={<SalesForm />} />
      <Route path="/sales/print/:id" element={<SalesPrint />} />
      <Route path="/sales/archive" element={<SalesArchive />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const AppGate = () => {
  const { pathname } = useLocation();
  if (pathname.startsWith("/incentives")) {
    return <IncentiveApp />;
  }
  return <SalesApp />;
};

const App = () => (
  <TooltipProvider>
    <Sonner />
    <BrowserRouter>
      <Suspense fallback={<RouteFallback />}>
        <AppGate />
      </Suspense>
    </BrowserRouter>
  </TooltipProvider>
);

export default App;
