import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { useState, useEffect } from "react";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { Project } from "./types/project";
import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

const App = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [housesData, setHousesData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);

  // جلب البيانات عند تحميل التطبيق
  useEffect(() => {
    const fetchData = async () => {
      try {
        // جلب المشاريع
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (projectsError) throw projectsError;
        
        // تحويل البيانات لتناسب النوع Project
        const formattedProjects = (projectsData || []).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          elements: p.elements || [],
          mapWidth: p.map_width,
          mapHeight: p.map_height,
          createdAt: p.created_at
        }));

        setProjects(formattedProjects);

        // جلب بيانات الوحدات
        const { data: unitsData, error: unitsError } = await supabase
          .from('houses_data')
          .select('*');

        if (unitsError) throw unitsError;

        const formattedUnits: Record<string, any> = {};
        (unitsData || []).forEach(u => {
          formattedUnits[u.unit_key] = u.data;
        });

        setHousesData(formattedUnits);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center font-bold">جاري تحميل البيانات...</div>;
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