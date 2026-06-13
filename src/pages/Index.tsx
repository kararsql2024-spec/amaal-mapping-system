"use client";

import React, { useState, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import Sidebar from '@/components/Sidebar';
import MapView from '@/components/MapView';
import TowerDetailsModal from '@/components/TowerDetailsModal';
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [housesData, setHousesData] = useState<Record<string, any>>({});
  const [selectedTower, setSelectedTower] = useState<MapElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [marketingCenter, setMarketingCenter] = useState<any>(null);

  useEffect(() => {
    const centerData = localStorage.getItem('marketing_center');
    if (centerData) {
      setMarketingCenter(JSON.parse(centerData));
    }

    const fetchProjects = async () => {
      try {
        const { data: projectsData, error: projectsError } = await supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (projectsError) throw projectsError;

        const formattedProjects: Project[] = (projectsData || []).map(p => ({
          id: p.id,
          name: p.name,
          description: p.description || '',
          elements: (p.elements as any[]) || [],
          mapWidth: p.map_width || 1000,
          mapHeight: p.map_height || 800,
          createdAt: p.created_at
        }));

        setProjects(formattedProjects);
        if (formattedProjects.length > 0) {
          setSelectedProject(formattedProjects[0]);
        }
      } catch (error) {
        console.error("Error fetching projects:", error);
        showError("فشل في تحميل المشاريع");
      } finally {
        setIsLoading(false);
      }
    };

    fetchProjects();
  }, []);

  useEffect(() => {
    if (!selectedProject) return;

    const fetchHousesData = async () => {
      try {
        const { data, error } = await supabase
          .from('houses_data')
          .select('*')
          .eq('project_id', selectedProject.id);

        if (error) throw error;

        const dataMap: Record<string, any> = {};
        data?.forEach(item => {
          dataMap[item.unit_key] = item.data;
        });
        setHousesData(dataMap);
      } catch (error) {
        console.error("Error fetching houses data:", error);
      }
    };

    fetchHousesData();

    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'houses_data',
          filter: `project_id=eq.${selectedProject.id}`
        },
        (payload) => {
          const updatedItem = payload.new as any;
          if (updatedItem) {
            setHousesData(prev => ({
              ...prev,
              [updatedItem.unit_key]: updatedItem.data
            }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedProject]);

  const handleSaveHouseData = async (elementId: string, data: any) => {
    if (!selectedProject) return;

    try {
      const { error } = await supabase
        .from('houses_data')
        .upsert({
          unit_key: elementId,
          project_id: selectedProject.id,
          data: data
        }, { onConflict: 'unit_key' });

      if (error) throw error;

      setHousesData(prev => ({
        ...prev,
        [elementId]: data
      }));
      
      showSuccess("تم حفظ البيانات بنجاح");
    } catch (error) {
      console.error("Error saving house data:", error);
      showError("فشل في حفظ البيانات");
    }
  };

  const handleSaveApartment = async (apartmentKey: string, data: any) => {
    if (!selectedProject) return;
    
    try {
      // التأكد من إرسال البيانات بشكل صحيح لقاعدة البيانات
      const { error } = await supabase
        .from('houses_data')
        .upsert({
          unit_key: apartmentKey,
          project_id: selectedProject.id,
          data: data
        }, { onConflict: 'unit_key' });

      if (error) throw error;

      // تحديث الحالة المحلية فوراً لضمان تغير اللون في الواجهة
      setHousesData(prev => ({
        ...prev,
        [apartmentKey]: data
      }));
      
      showSuccess("تم حفظ بيانات الشقة بنجاح");
    } catch (error) {
      console.error("Error saving apartment data:", error);
      showError("فشل في حفظ بيانات الشقة");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
          <p className="text-slate-600 font-bold">جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  const allowedProjects = marketingCenter?.allowed_projects || [];
  const filteredProjects = projects.filter(p => 
    allowedProjects.length === 0 || allowedProjects.includes(p.id)
  );

  const currentProject = filteredProjects.find(p => p.id === selectedProject?.id) || filteredProjects[0];

  return (
    <div className="flex h-screen bg-[#f8fafc] overflow-hidden" dir="rtl">
      <Sidebar 
        projects={filteredProjects}
        selectedProjectId={currentProject?.id}
        onSelectProject={(id) => {
          const p = projects.find(proj => proj.id === id);
          if (p) setSelectedProject(p);
        }}
        housesData={housesData}
        permissions={marketingCenter?.permissions}
      />
      
      <main className="flex-1 relative overflow-hidden">
        {currentProject ? (
          <MapView 
            project={currentProject}
            housesData={housesData}
            onElementClick={(el) => {
              if (el.type === 'tower') {
                setSelectedTower(el);
              }
            }}
            onSaveHouseData={handleSaveHouseData}
            permissions={marketingCenter?.permissions}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 font-bold">
            لا توجد مشاريع متاحة للعرض
          </div>
        )}
      </main>

      {selectedTower && (
        <TowerDetailsModal 
          isOpen={!!selectedTower}
          onClose={() => setSelectedTower(null)}
          tower={selectedTower}
          housesData={housesData}
          onSaveApartment={handleSaveApartment}
          permissions={marketingCenter?.permissions}
        />
      )}
    </div>
  );
};

export default Index;