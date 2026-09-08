import React from 'react';
import { 
  Folder, Image as ImageIcon, FileText, Film, Layers, 
  Users, Globe, ShieldAlert, HardDrive, Plus, UploadCloud, X 
} from 'lucide-react';

export default function Sidebar({ 
  currentSection, 
  onSelectSection, 
  user, 
  onOpenUpload, 
  onOpenNewFolder,
  systemStatus,
  isMobileOpen = false,
  onCloseMobile = () => {}
}) {
  const sections = [
    { id: 'all', label: 'All Files & Folders', icon: Folder, category: null },
    { id: 'image', label: 'Photos & Images', icon: ImageIcon, category: 'image' },
    { id: 'document', label: 'Documents', icon: FileText, category: 'document' },
    { id: 'video', label: 'Videos & Media', icon: Film, category: 'video' },
  ];

  const adminSections = [
    { id: 'admin-users', label: 'User Management', icon: Users },
    { id: 'admin-remote', label: 'Cloudflare Tunnel', icon: Globe },
    { id: 'admin-audit', label: 'Security Audit Logs', icon: ShieldAlert },
  ];

  const handleSelect = (id) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const handleUpload = () => {
    onOpenUpload();
    onCloseMobile();
  };

  const handleNewFolder = () => {
    onOpenNewFolder();
    onCloseMobile();
  };

  const renderContent = (isDrawer = false) => (
    <div className="flex-1 flex flex-col justify-between overflow-hidden">
      <div className="p-4 space-y-6 overflow-y-auto touch-scroll">
        {/* Quick action buttons */}
        <div className="space-y-2">
          <button
            onClick={handleUpload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-semibold text-xs tracking-wide uppercase hover:opacity-95 shadow-lg shadow-cyan-500/20 active:scale-[0.98] transition-all cursor-pointer"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Upload Files</span>
          </button>

          {user?.role === 'admin' && (
            <button
              onClick={handleNewFolder}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-medium transition-all cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Folder</span>
            </button>
          )}
        </div>

        {/* Categories Section */}
        <div>
          <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 mb-2 font-medium">
            Storage Views
          </div>
          <nav className="space-y-1">
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = currentSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => handleSelect(sec.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 border border-cyan-500/30 shadow-sm font-semibold'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-500 dark:text-cyan-400' : 'text-slate-400'}`} />
                  <span>{sec.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Admin Section */}
        {user?.role === 'admin' && (
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 px-3 mb-2 font-medium flex items-center justify-between">
              <span>Admin Console</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border border-cyan-500/20 font-bold">
                PRO
              </span>
            </div>
            <nav className="space-y-1">
              {adminSections.map((sec) => {
                const Icon = sec.icon;
                const isActive = currentSection === sec.id;
                return (
                  <button
                    key={sec.id}
                    onClick={() => handleSelect(sec.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
                      isActive
                        ? 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 shadow-sm font-semibold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100/80 dark:hover:bg-slate-800/40'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400'}`} />
                    <span>{sec.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Disk Status bottom footer */}
      <div className="p-4 border-t border-slate-200 dark:border-slate-800/60 bg-slate-50 dark:bg-slate-950/40">
        <div className="flex items-center gap-2.5 mb-2">
          <HardDrive className="w-4 h-4 text-cyan-500 dark:text-cyan-400" />
          <div className="text-xs font-medium text-slate-700 dark:text-slate-300">External Disk Storage</div>
        </div>
        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono flex justify-between">
          <span>Usage</span>
          <span className="text-slate-800 dark:text-slate-200 font-bold">
            {systemStatus?.storage ? `${systemStatus.storage.percent_used}%` : '--'}
          </span>
        </div>
        <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1.5">
          <div
            className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 rounded-full transition-all duration-500"
            style={{ width: `${systemStatus?.storage?.percent_used || 0}%` }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-64 border-r border-slate-200 dark:border-slate-800/80 glass-panel flex-col justify-between shrink-0 h-[calc(100vh-4rem)]">
        {renderContent(false)}
      </aside>

      {/* Mobile Slide-Over Drawer with Backdrop */}
      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex animate-fade-in">
          {/* Backdrop */}
          <div 
            onClick={onCloseMobile}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Slide-out Menu Panel */}
          <aside className="relative z-10 w-72 max-w-[85vw] h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col justify-between animate-slide-right">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-500" />
                <span className="font-bold text-sm text-slate-900 dark:text-white">Navigation</span>
              </div>
              <button 
                onClick={onCloseMobile}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                title="Close Menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderContent(true)}
          </aside>
        </div>
      )}
    </>
  );
}
