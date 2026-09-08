import React from 'react';
import { Folder, Image as ImageIcon, Film, UploadCloud, Menu } from 'lucide-react';

export default function MobileBottomNav({
  currentSection,
  onSelectSection,
  onOpenUpload,
  onToggleMenu,
  isMenuOpen
}) {
  const navItems = [
    { id: 'all', label: 'Files', icon: Folder },
    { id: 'image', label: 'Photos', icon: ImageIcon },
    { id: 'upload', label: 'Upload', icon: UploadCloud, isFab: true },
    { id: 'video', label: 'Media', icon: Film },
    { id: 'menu', label: 'Menu', icon: Menu, isMenu: true },
  ];

  return (
    <nav 
      aria-label="Mobile Navigation" 
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/90 safe-area-bottom px-2 py-1 shadow-2xl transition-colors"
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;

          // Special Central Floating Upload Button
          if (item.isFab) {
            return (
              <button
                key={item.id}
                onClick={onOpenUpload}
                type="button"
                className="relative -top-4 p-3 rounded-2xl bg-gradient-to-tr from-cyan-500 to-emerald-400 text-slate-950 shadow-lg shadow-cyan-500/40 active:scale-90 hover:scale-105 transition-transform flex flex-col items-center justify-center cursor-pointer ring-4 ring-white dark:ring-slate-950"
                title="Upload Files"
              >
                <UploadCloud className="w-5 h-5 stroke-[2.5]" />
                <span className="sr-only">Upload Files</span>
              </button>
            );
          }

          // Menu toggle item
          if (item.isMenu) {
            const active = isMenuOpen;
            return (
              <button
                key={item.id}
                onClick={onToggleMenu}
                type="button"
                className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer min-w-[56px] ${
                  active 
                    ? 'text-cyan-600 dark:text-cyan-400 font-semibold scale-105' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                <div className={`p-1 rounded-lg transition-colors ${active ? 'bg-cyan-500/15' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-medium">Menu</span>
              </button>
            );
          }

          const isActive = currentSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectSection(item.id)}
              type="button"
              className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all cursor-pointer min-w-[56px] ${
                isActive 
                  ? 'text-cyan-600 dark:text-cyan-400 font-semibold scale-105' 
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-cyan-500/15' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
