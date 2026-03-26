"use client";

import React, { useState } from 'react';
import { Project, MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Layout, ArrowRight, Settings2, Map as MapIcon, Trash2, Edit2 } from 'lucide-react';
import MapEditor from '@/components/MapEditor';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";

interface AdminProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
}

const Admin = ({ projects, setProjects }: AdminProps) => {
  const [editingMapProject, setEditingMapProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [editingProjectInfo, setEditingProjectInfo] = useState<Project | null>(null);
  const [formData, setFormData] = useState({ name: '', width: 1000, height: 800 });

  const handleCreateProject = async () => {
    if (!formData.name) return;
    
    const newId = Math.random().toString(36).substr(2, 9);
    const newProject = {
      id: newId,
      name: formData.name,
      description: '',
      elements: [],
      map_width: formData.width,
      map_height: formData.height,
    };

    try {
      const { error } = await supabase
        .from('projects')
        .insert(newProject);

      if (error) throw error;

      setProjects([{
        ...newProject,
        mapWidth: formData.width,
        mapHeight: formData.height,
        createdAt: new Date().toISOString(),
        elements: []
      }, ...projects]);
      
      setFormData({ name: '', width: 1000, height: 800 });
      setIsCreating(false);
      showSuccess('تم إنشاء المشروع بنجاح');
    } catch (error) {
      console.error("Error creating project:", error);
      showError("فشل في إنشاء المشروع");
    }
  };

  const handleUpdateProjectInfo = async () => {
    if (!editingProjectInfo || !formData.name) return;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ 
          name: formData.name, 
          map_width: formData.width, 
          map_height: formData.height 
        })
        .eq('id', editingProjectInfo.id);

      if (error) throw error;

      setProjects(projects.map(p => p.id === editingProjectInfo.id ? { 
        ...p, 
        name: formData.name, 
        mapWidth: formData.width, 
        mapHeight: formData.height 
      } : p));
      
      setEditingProjectInfo(null);
      setFormData({ name: '', width: 1000, height: 800 });
      showSuccess('تم تحديث بيانات المشروع بنجاح');
    } catch (error) {
      console.error("Error updating project:", error);
      showError("فشل في تحديث المشروع");
    }
  };

  const handleDeleteProject = async (id: string) => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProjects(projects.filter(p => p.id !== id));
      showSuccess('تم حذف المشروع');
    } catch (error) {
      console.error("Error deleting project:", error);
      showError("فشل في حذف المشروع");
    }
  };

  const handleSaveMap = async (elements: MapElement[]) => {
    if (editingMapProject) {
      try {
        const { error } = await supabase
          .from('projects')
          .update({ elements })
          .eq('id', editingMapProject.id);

        if (error) throw error;

        setProjects(projects.map(p => p.id === editingMapProject.id ? { ...p, elements } : p));
        setEditingMapProject(null);
        showSuccess('تم حفظ المخطط بنجاح');
      } catch (error) {
        console.error("Error saving map:", error);
        showError("فشل في حفظ المخطط");
      }
    }
  };

  const startEditingInfo = (project: Project) => {
    setEditingProjectInfo(project);
    setFormData({ name: project.name, width: project.mapWidth, height: project.mapHeight });
    setIsCreating(false);
  };

  if (editingMapProject) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setEditingMapProject(null)} className="rounded-xl"><ArrowRight className="ml-2" />العودة</Button>
            <h1 className="text-2xl font-black">تعديل مخطط: {editingMapProject.name} ({editingMapProject.mapWidth}x{editingMapProject.mapHeight})</h1>
          </div>
          <MapEditor 
            initialElements={editingMapProject.elements} 
            onSave={handleSaveMap} 
            mapWidth={editingMapProject.mapWidth}
            mapHeight={editingMapProject.mapHeight}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-8" dir="rtl">
      <div className="max-w-6xl mx-auto space-y-8">
        <header className="flex items-center justify-between bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100"><Settings2 className="text-white" /></div>
            <div><h1 className="text-2xl font-black text-slate-800">لوحة الإدارة</h1><p className="text-slate-500 font-medium">إدارة المشاريع والمخططات</p></div>
          </div>
          <Link to="/"><Button variant="outline" className="rounded-xl gap-2"><Layout size={18} />عرض الموقع</Button></Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">المشاريع الحالية</h2>
              <Button onClick={() => { setIsCreating(true); setEditingProjectInfo(null); setFormData({ name: '', width: 1000, height: 800 }); }} className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2"><Plus size={18} />مشروع جديد</Button>
            </div>

            {(isCreating || editingProjectInfo) && (
              <div className="bg-white p-8 rounded-[2.5rem] border-2 border-blue-100 shadow-xl animate-in fade-in slide-in-from-top-4 space-y-6">
                <h3 className="font-black text-xl">{editingProjectInfo ? 'تعديل بيانات المشروع' : 'إنشاء مشروع جديد'}</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500">اسم المشروع</label>
                    <Input placeholder="ادخل اسم المشروع..." value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} className="rounded-xl h-12" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500">عرض المخطط (px)</label>
                      <Input type="number" value={formData.width} onChange={(e) => setFormData({...formData, width: parseInt(e.target.value)})} className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold text-slate-500">طول المخطط (px)</label>
                      <Input type="number" value={formData.height} onChange={(e) => setFormData({...formData, height: parseInt(e.target.value)})} className="rounded-xl h-12" />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <Button onClick={editingProjectInfo ? handleUpdateProjectInfo : handleCreateProject} className="bg-blue-600 rounded-xl h-12 px-8 font-bold">
                      {editingProjectInfo ? 'تحديث البيانات' : 'إنشاء المشروع'}
                    </Button>
                    <Button variant="ghost" onClick={() => { setIsCreating(false); setEditingProjectInfo(null); }} className="rounded-xl h-12">إلغاء</Button>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {projects.map(project => (
                <div key={project.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100"><MapIcon className="text-slate-400" /></div>
                    <div><h3 className="font-bold text-lg">{project.name}</h3><p className="text-sm text-slate-500">{project.elements.length} عنصر | {project.mapWidth}x{project.mapHeight}</p></div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => startEditingInfo(project)} className="text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl"><Edit2 size={18} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteProject(project.id)} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl"><Trash2 size={18} /></Button>
                    <Button onClick={() => setEditingMapProject(project)} className="bg-slate-900 hover:bg-slate-800 rounded-xl gap-2"><Settings2 size={16} />تعديل المخطط</Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;