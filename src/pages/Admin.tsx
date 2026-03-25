"use client";

import React, { useState } from 'react';
import { Project, MapElement } from '@/types/project';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Layout, ArrowRight, Settings2, Map as MapIcon } from 'lucide-react';
import MapEditor from '@/components/MapEditor';
import { showSuccess } from '@/utils/toast';
import { Link } from 'react-router-dom';

const Admin = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleCreateProject = () => {
    if (!newProjectName) return;
    const newProject: Project = {
      id: Math.random().toString(36).substr(2, 9),
      name: newProjectName,
      description: '',
      elements: [],
      createdAt: new Date().toISOString()
    };
    setProjects([...projects, newProject]);
    setNewProjectName('');
    setIsCreating(false);
    showSuccess('تم إنشاء المشروع بنجاح');
  };

  const handleSaveMap = (elements: MapElement[]) => {
    if (editingProject) {
      setProjects(projects.map(p => p.id === editingProject.id ? { ...p, elements } : p));
      setEditingProject(null);
      showSuccess('تم حفظ المخطط بنجاح');
    }
  };

  if (editingProject) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-8" dir="rtl">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setEditingProject(null)} className="rounded-xl">
              <ArrowRight className="ml-2" />
              العودة للوحة التحكم
            </Button>
            <h1 className="text-2xl font-black">تعديل مخطط: {editingProject.name}</h1>
          </div>
          <MapEditor 
            initialElements={editingProject.elements} 
            onSave={handleSaveMap} 
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
            <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <Settings2 className="text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-800">لوحة الإدارة</h1>
              <p className="text-slate-500 font-medium">إدارة المشاريع والمخططات السكنية</p>
            </div>
          </div>
          <Link to="/">
            <Button variant="outline" className="rounded-xl gap-2">
              <Layout size={18} />
              عرض الموقع
            </Button>
          </Link>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">المشاريع الحالية</h2>
              <Button onClick={() => setIsCreating(true)} className="bg-blue-600 hover:bg-blue-700 rounded-xl gap-2">
                <Plus size={18} />
                مشروع جديد
              </Button>
            </div>

            {isCreating && (
              <div className="bg-white p-6 rounded-3xl border-2 border-blue-100 shadow-xl animate-in fade-in slide-in-from-top-4">
                <h3 className="font-bold mb-4">إنشاء مشروع جديد</h3>
                <div className="flex gap-3">
                  <Input 
                    placeholder="اسم المشروع..." 
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="rounded-xl"
                  />
                  <Button onClick={handleCreateProject} className="bg-blue-600 rounded-xl">إنشاء</Button>
                  <Button variant="ghost" onClick={() => setIsCreating(false)} className="rounded-xl">إلغاء</Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4">
              {projects.length === 0 ? (
                <div className="bg-white p-12 rounded-[2rem] border border-dashed border-slate-300 text-center text-slate-400">
                  <MapIcon className="mx-auto mb-4 opacity-20" size={64} />
                  <p className="text-lg">لا توجد مشاريع حالياً. ابدأ بإنشاء مشروعك الأول.</p>
                </div>
              ) : (
                projects.map(project => (
                  <div key={project.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between group hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                        <MapIcon className="text-slate-400" />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">{project.name}</h3>
                        <p className="text-sm text-slate-500">{project.elements.length} وحدة سكنية</p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => setEditingProject(project)}
                      className="bg-slate-900 hover:bg-slate-800 rounded-xl gap-2"
                    >
                      <Settings2 size={16} />
                      تعديل المخطط
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-8 rounded-[2rem] text-white shadow-xl">
              <h3 className="text-xl font-bold mb-4">نصيحة سريعة</h3>
              <p className="text-indigo-100 text-sm leading-relaxed">
                عند تعديل المخطط، يمكنك النقر في أي مكان على الشبكة لإضافة وحدة سكنية جديدة. يمكنك لاحقاً تغيير أبعادها وتسميتها من القائمة الجانبية.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Admin;