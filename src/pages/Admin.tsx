"use client";

import React, { useState, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Layout, ArrowRight, Settings2, Map as MapIcon, Trash2, Edit2, FileSpreadsheet, Upload, CheckCircle2, AlertCircle, Save, LogOut, Store, Lock, Clock, Eraser, Terminal, RefreshCcw, Database, Search, User, Phone, HelpCircle, Coins } from 'lucide-react';
import MapEditor from '@/components/MapEditor';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { ScrollArea } from "@/components/ui/scroll-area";

const Admin = ({ projects, setProjects, setHousesData, housesData = {} }: any) => {
  const [session, setSession] = useState<any>(null);
  const [editingMapProject, setEditingMapProject] = useState<Project | null>(null);
  // ... rest of state ...

  const handleSaveMap = async (elements: MapElement[], newWidth: number, newHeight: number, centerX: number, centerY: number) => {
    if (editingMapProject) {
      try {
        await supabase.from('projects').update({ 
          elements, 
          map_width: Math.round(newWidth), 
          map_height: Math.round(newHeight),
          center_x: Math.round(centerX),
          center_y: Math.round(centerY)
        }).eq('id', editingMapProject.id);
        
        setProjects(projects.map(p => p.id === editingMapProject.id ? { 
          ...p, 
          elements, 
          mapWidth: Math.round(newWidth), 
          mapHeight: Math.round(newHeight),
          centerX: Math.round(centerX),
          centerY: Math.round(centerY)
        } : p));
        
        setEditingMapProject(null);
        showSuccess('تم حفظ المخطط ونقطة المنتصف بنجاح');
      } catch (error) { showError("فشل في حفظ المخطط"); }
    }
  };

  // ... rest of component ...
  return (
    // ... JSX ...
    editingMapProject ? (
      <MapEditor 
        initialElements={editingMapProject.elements} 
        onSave={handleSaveMap} 
        mapWidth={editingMapProject.mapWidth} 
        mapHeight={editingMapProject.mapHeight}
        initialCenterX={editingMapProject.centerX}
        initialCenterY={editingMapProject.centerY}
      />
    ) : (
      // ... Admin UI ...
    )
  );
};

export default Admin;