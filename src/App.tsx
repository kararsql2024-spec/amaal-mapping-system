import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import React, { useState } from "react";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import NotFound from "./pages/NotFound";
import { Project } from "./types/project";

const queryClient = new QueryClient();

const App = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [housesData, setHousesData] = useState<Record<string, any>>({});

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