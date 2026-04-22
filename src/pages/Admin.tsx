"use client";

import React, { useState, useEffect } from 'react';
import { Project, MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Plus, Layout, ArrowRight, Settings2, Map as MapIcon, 
  Trash2, Edit2, Save, LogOut, Database, Search, 
  FileSpreadsheet, Upload, CheckCircle2, AlertCircle 
} from 'lucide-react';
import MapEditor from '@/components/MapEditor';
import { showSuccess, showError } from '@/utils/toast';
import { Link } from 'react-router-dom';
import { supabase } from "@/integrations/supabase/client";
import { cn } from '@/lib/utils';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';

const Admin = ({ projects, setProjects, setHousesData, housesData = {} }: any) => {
  const [session, setSession] = useState<any>(null);
  const [editingMapProject, setEditingMapProject] = useState<Project | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setIsLoading(true);
    try {
      const id = Math.random().toString(36).substr(2, 9);
      const newProject = {
        id,
        name: newProjectName,
        description: '',
        elements: [],
        map_width: 1200,
        map_height: 800,
        center_x: 600,
        center_y: 400
      };

      const { error } = await supabase.from('projects').insert([newProject]);
      if (error) throw error;

      setProjects([{ ...newProject, mapWidth: 1200, mapHeight: 800, centerX: 600, centerY: 400, createdAt: new Date().toISOString() }, ...projects]);
      setNewProjectName('');
      showSuccess('تم إنشاء المشروع بنجاح');
    } catch (error) {
      showError('فشل في إنشاء المشروع');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا المشروع؟')) return;

    try {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
      setProjects(projects.filter((p: any) => p.id !== id));
      showSuccess('تم حذف المشروع');
    } catch (error) {
      showError('فشل في حذف المشروع');
    }
  };

  const handleSaveMap = async (elements: MapElement[], newWidth: number, newHeight: number, centerX: number, centerY: number) => {
    if (!editingMapProject) return;

    try {
      const { error } = await supabase.from('projects').update({ 
        elements, 
        map_width: Math.round(newWidth), 
        map_height: Math.round(newHeight),
        center_x: Math.round(centerX),
        center_y: Math.round(centerY)
      }).eq('id', editingMapProject.id);
      
      if (error) throw error;

      setProjects(projects.map((p: any) => p.id === editingMapProject.id ? { 
        ...p, 
        elements, 
        mapWidth: Math.round(newWidth), 
        mapHeight: Math.round(newHeight),
        centerX: Math.round(centerX),
        centerY: Math.round(centerY)
      } : p));
      
      setEditingMapProject(null);
      showSuccess('تم حفظ المخطط ونقطة المنتصف بنجاح');
    } catch (error) {
      showError("فشل في حفظ المخطط");
    }
  };

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <div className="w-full max-w-md bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
              <Lock className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-slate-900">لوحة التحكم</h1>
            <p className="text-slate-500 font-bold mt-2">يرجى تسجيل الدخول للمتابعة</p>
          </div>
          <Auth
            supabaseClient={supabase}
            appearance={{ theme: ThemeSupa }}
            theme="light"
            providers={[]}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50" dir="rtl">
      {editingMapProject ? (
        <div className="h-screen flex flex-col">
          <div className="bg-white border-b p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => setEditingMapProject(null)} className="rounded-xl">
                <ArrowRight className="ml-2" /> عودة
              </Button>
              <h2 className="text-xl font-black">تعديل مخطط: {editingMapProject.name}</h2>
            </div>
          </div>
          <div className="flex-1 p-4">
            <MapEditor 
              initialElements={editingMapProject.elements} 
              onSave={handleSaveMap} 
              mapWidth={editingMapProject.mapWidth} 
              mapHeight={editingMapProject.mapHeight}
              initialCenterX={editingMapProject.centerX}
              initialCenterY={editingMapProject.centerY}
            />
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto p-8">
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl font-black text-slate-900">إدارة المشاريع</h1>
              <p className="text-slate-500 font-bold mt-2">تحكم في المخططات والوحدات السكنية</p>
            </div>
            <div className="flex gap-3">
              <Link to="/">
                <Button variant="outline" className="rounded-2xl h-12 px-6 font-bold border-2">
                  <Layout className="ml-2 w-5 h-5" /> عرض الموقع
                </Button>
              </Link>
              <Button variant="destructive" onClick={() => supabase.auth.signOut()} className="rounded-2xl h-12 px-6 font-bold">
                <LogOut className="ml-2 w-5 h-5" /> خروج
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 sticky top-8">
                <h3 className="text-xl font-black mb-6 flex items-center gap-2">
                  <Plus className="text-indigo-600" /> إضافة مشروع جديد
                </h3>
                <form onSubmit={handleCreateProject} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-500 mr-2">اسم المشروع</label>
                    <Input 
                      placeholder="مثال: مجمع الأمل السكني" 
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      className="rounded-2xl h-14 border-2 focus:border-indigo-600 transition-all text-lg font-bold"
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="w-full rounded-2xl h-14 bg-indigo-600 hover:bg-indigo-700 text-lg font-black shadow-lg shadow-indigo-100"
                  >
                    {isLoading ? 'جاري الإنشاء...' : 'إنشاء المشروع'}
                  </Button>
                </form>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {projects.map((project: any) => (
                <div key={project.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all">
                  <div className="flex items-center gap-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                      <MapIcon className="text-slate-400 group-hover:text-indigo-600 w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="text-xl font-black text-slate-900">{project.name}</h4>
                      <p className="text-slate-400 font-bold text-sm mt-1">
                        {project.elements?.length || 0} عنصر • {project.mapWidth}x{project.mapHeight} بكسل
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => setEditingMapProject(project)}
                      className="rounded-2xl h-12 bg-slate-900 hover:bg-slate-800 font-bold"
                    >
                      <Edit2 className="ml-2 w-4 h-4" /> تعديل المخطط
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleDeleteProject(project.id)}
                      className="rounded-2xl h-12 border-2 text-rose-600 border-rose-100 hover:bg-rose-50 hover:border-rose-200 font-bold"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              ))}

              {projects.length === 0 && (
                <div className="text-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                  <Database className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold text-xl">لا توجد مشاريع حالياً</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;