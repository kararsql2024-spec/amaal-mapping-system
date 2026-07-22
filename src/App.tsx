import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { useState, useEffect } from "react";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import { Project } from "./types/project";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

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
    return <div className="min-h-screen flex items-center justify-center font-bold">جاري تحميل النظام...</div>;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
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
              element={
                <Reports 
                  projects={projects} 
                  housesData={housesData} 
                />
              } 
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;