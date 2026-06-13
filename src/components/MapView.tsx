"use client";

import React, { useState } from 'react';
import { Project, MapElement } from '@/types/project';
import InteractiveMap from './InteractiveMap';
import UnitDetailsModal from './UnitDetailsModal';
import DetailedStatsTable from './DetailedStatsTable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Map as MapIcon, Table as TableIcon, Bell } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area";
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface MapViewProps {
  project: Project;
  housesData: Record<string, any>;
  onElementClick: (el: MapElement) => void;
  onSaveHouseData: (id: string, data: any) => void;
  permissions?: any;
}

const MapView = ({ project, housesData, onElementClick, onSaveHouseData, permissions }: MapViewProps) => {
  const [selectedHouseId, setSelectedHouseId] = useState<string | null>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications', project.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!project.id && permissions?.showNotifications
  });

  const handleHouseClick = (id: string) => {
    const el = project.elements.find(e => e.id === id);
    if (el?.type === 'tower') {
      onElementClick(el);
    } else if (el?.type === 'house') {
      setSelectedHouseId(id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="map" className="flex-1 flex flex-col">
        <div className="px-8 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <TabsList className="bg-slate-100 p-1 rounded-xl h-12">
            <TabsTrigger value="map" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <MapIcon className="w-4 h-4 ml-2" /> المخطط التفاعلي
            </TabsTrigger>
            {permissions?.showStatsTable && (
              <TabsTrigger value="table" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <TableIcon className="w-4 h-4 ml-2" /> الجدول المفصل
              </TabsTrigger>
            )}
          </TabsList>

          <div className="flex items-center gap-4">
            <h2 className="text-xl font-black text-slate-800">{project.name}</h2>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden flex">
          <div className="flex-1 relative">
            <TabsContent value="map" className="absolute inset-0 m-0 p-8">
              <InteractiveMap 
                elements={project.elements}
                onHouseClick={handleHouseClick}
                selectedHouseId={selectedHouseId}
                housesData={housesData}
                mapWidth={project.mapWidth}
                mapHeight={project.mapHeight}
                permissions={permissions}
              />
            </TabsContent>

            <TabsContent value="table" className="absolute inset-0 m-0 p-8 overflow-auto">
              <DetailedStatsTable 
                elements={project.elements}
                housesData={housesData}
                permissions={permissions}
              />
            </TabsContent>
          </div>

          {permissions?.showNotifications && (
            <div className="w-72 border-r border-slate-100 bg-white flex flex-col">
              <div className="p-4 border-b border-slate-100 flex items-center gap-2 font-black text-slate-800">
                <Bell size={18} className="text-rose-500" /> الإشعارات الأخيرة
              </div>
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-3">
                  {notifications.length > 0 ? notifications.map((n: any) => (
                    <div key={n.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-bold text-slate-600 leading-relaxed">
                      {n.message}
                      <div className="mt-1 text-[8px] text-slate-400">{new Date(n.created_at).toLocaleString('ar-EG')}</div>
                    </div>
                  )) : (
                    <div className="text-center py-10 text-slate-400 text-xs font-bold">لا توجد إشعارات</div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </Tabs>

      {selectedHouseId && (
        <UnitDetailsModal 
          isOpen={!!selectedHouseId}
          onClose={() => setSelectedHouseId(null)}
          onSave={(id, data) => {
            onSaveHouseData(id, data);
            setSelectedHouseId(null);
          }}
          unitId={selectedHouseId}
          unitLabel={project.elements.find(e => e.id === selectedHouseId)?.label}
          initialData={housesData[selectedHouseId]}
          permissions={permissions}
        />
      )}
    </div>
  );
};

export default MapView;