"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Cpu, HardDrive, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiagnosticLog {
  time: string;
  message: string;
  type: 'info' | 'warn' | 'success' | 'danger';
}

interface DiagnosticTerminalProps {
  logs: DiagnosticLog[];
  onClearLogs: () => void;
}

const DiagnosticTerminal = ({ logs, onClearLogs }: DiagnosticTerminalProps) => {
  const [showTerminal, setShowTerminal] = useState(true);
  const [fps, setFps] = useState(60);
  const [memoryUsage, setMemoryUsage] = useState<string>('N/A');
  
  const frameCount = useRef(0);
  const lastFpsCheck = useRef(performance.now());

  // قياس الإطارات والذاكرة بشكل معزول تماماً داخل المكون لمنع إعادة رندرة الصفحة بأكملها
  useEffect(() => {
    let animId: number;
    const updateMetrics = () => {
      frameCount.current += 1;
      const now = performance.now();
      const delta = now - lastFpsCheck.current;

      if (delta >= 1000) {
        const calculatedFps = Math.round((frameCount.current * 1000) / delta);
        setFps(calculatedFps);
        frameCount.current = 0;
        lastFpsCheck.current = now;

        if ((performance as any).memory) {
          const usedMB = Math.round((performance as any).memory.usedJSHeapSize / 1048576);
          setMemoryUsage(`${usedMB} MB`);
        }
      }
      animId = requestAnimationFrame(updateMetrics);
    };

    animId = requestAnimationFrame(updateMetrics);
    return () => cancelAnimationFrame(animId);
  }, []);

  return (
    <div className="fixed bottom-4 left-4 z-[99999] max-w-sm w-full font-mono text-xs shadow-2xl rounded-2xl overflow-hidden border-2 border-emerald-500/50 bg-slate-950/95 text-slate-200 backdrop-blur-md animate-in fade-in slide-in-from-bottom-5">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Terminal size={16} className="text-emerald-400 animate-pulse" />
          <span className="font-bold text-slate-200 text-xs">لوحة تحليل الأداء الفورية (Realtime)</span>
        </div>
        <button 
          onClick={() => setShowTerminal(!showTerminal)}
          className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors bg-slate-800"
        >
          {showTerminal ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>

      {showTerminal && (
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-[11px] font-bold">
            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <Cpu size={14} className="text-amber-400" /> FPS:
              </span>
              <span className={cn("font-black text-xs", fps < 30 ? "text-rose-400" : "text-emerald-400")}>
                {fps} FPS
              </span>
            </div>
            <div className="bg-slate-900 p-2 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-400">
                <HardDrive size={14} className="text-blue-400" /> RAM:
              </span>
              <span className="font-black text-xs text-blue-400">{memoryUsage}</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold border-b border-slate-800 pb-1">
              <span>سجل الاستجابة بالملي ثانية (ms):</span>
              <button onClick={onClearLogs} className="hover:text-rose-400 underline text-[9px]">تفريغ</button>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 text-[10px] pr-1 no-scrollbar">
              {logs.length > 0 ? (
                logs.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 border-b border-slate-900/50 pb-1">
                    <span className="text-slate-500 shrink-0">[{log.time}]</span>
                    <span className={cn(
                      "break-all font-semibold",
                      log.type === 'success' ? "text-emerald-400" :
                      log.type === 'warn' ? "text-amber-400" :
                      log.type === 'danger' ? "text-rose-400" : "text-slate-300"
                    )}>
                      {log.message}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-slate-600 text-center py-2 text-[10px]">في انتظار تنفيذ أي عملية...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticTerminal;