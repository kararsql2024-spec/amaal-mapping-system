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

const queryClient = new QueryClient();

const App = () => {
  // Load initial state from localStorage
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem('real-estate-projects');
    return saved ? JSON.parse(saved) : [];
  });

  const [housesData, setHousesData] = useState<Record<string, any>>(() => {
    const saved = localStorage.getItem('real-estate-houses');
    return saved ? JSON.parse(saved) : {};
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    localStorage.setItem('real-estate-projects', JSON.stringify(projects));
  }, [projects]);

  useEffect(() => {
    localStorage.setItem('real-estate-houses', JSON.stringify(housesData));
  }, [housesData]);

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