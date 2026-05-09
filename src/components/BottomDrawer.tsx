"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface BottomDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function BottomDrawer({ isOpen, onClose, title, children }: BottomDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div 
        className={`fixed bottom-0 left-0 right-0 z-[101] bg-white rounded-t-[2.5rem] shadow-[0_-20px_60px_-15px_rgba(0,0,0,0.3)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] transform max-w-[500px] mx-auto ${
          isOpen ? "translate-y-0 opacity-100" : "translate-y-[110%] opacity-0"
        }`}
        style={{ 
          maxHeight: '92dvh', 
          overflowY: 'auto',
          visibility: isOpen ? 'visible' : 'hidden'
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-slate-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-4 border-b border-slate-50">
          <h3 className="text-xl font-black text-slate-800 tracking-tight">{title}</h3>
          <button 
            onClick={onClose}
            className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content — extra bottom padding for safe area */}
        <div className="p-8" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 1.5rem))' }}>
          {children}
        </div>
      </div>
    </>
  );
}
