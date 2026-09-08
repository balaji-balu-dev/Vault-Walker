import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api, getStoredToken } from './services/api';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Breadcrumbs from './components/Breadcrumbs';
import FileGrid from './components/FileGrid';
import UploadModal from './components/UploadModal';
import Lightbox from './components/Lightbox';
import HealthWidget from './components/HealthWidget';
import AdminPanel from './components/AdminPanel';
import LoginModal from './components/LoginModal';
import DiskPicker from './components/DiskPicker';
import MobileBottomNav from './components/MobileBottomNav';
import { useMobile } from './hooks/useMobile';
import APP_CONFIG from './config/constants';

export default function App() {
  // Theme state: persist to localStorage & reflect on documentElement
  const [theme, setTheme] = useState(() => localStorage.getItem('vault_theme') || 'dark');

  // Auth state
  const [user, setUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);

  // Multi-Disk state
  const [selectedDisk, setSelectedDisk] = useState(null);
  const [showDiskPicker, setShowDiskPicker] = useState(false);
  const [refreshingDisks, setRefreshingDisks] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isMobile } = useMobile();

  // Explorer state
  const [currentSection, setCurrentSection] = useState('all'); // 'all' | 'image' | 'document' | 'video' | 'admin-*'
  const [currentPath, setCurrentPath] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState([{ name: 'Root', path: '' }]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('asc');
  const [viewMode, setViewMode] = useState('grid');
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [healthOpen, setHealthOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState(null);
  const [refreshingHealth, setRefreshingHealth] = useState(false);

  // System & Health telemetry
  const [systemStatus, setSystemStatus] = useState(null);

  // Sync theme class and page title
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('vault_theme', theme);
    document.title = `${APP_CONFIG.name} - ${APP_CONFIG.tagline}`;
  }, [theme]);

  const itemsCountRef = useRef(0);
  itemsCountRef.current = items.length;

  const handleToggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  // Check auth session
  const checkAuth = useCallback(async () => {
    if (!getStoredToken()) {
      setUser(null);
      setAuthChecking(false);
      return;
    }
    try {
      const me = await api.getMe();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  // Fetch telemetry (per selected disk if available)
  const fetchStatus = useCallback(async () => {
    if (!getStoredToken()) return;
    try {
      const status = await api.getSystemStatus(selectedDisk?.drive_letter);
      setSystemStatus(status);

      // If user hasn't selected a disk yet, or if selected disk was unplugged
      if (status.external_disks && status.external_disks.length > 0) {
        if (!selectedDisk) {
          // Keep disk picker open so user can select their starting disk
          setShowDiskPicker(true);
        } else {
          // Verify selected disk still exists in connected disks
          const stillConnected = status.external_disks.find(
            d => d.drive_letter.toLowerCase() === selectedDisk.drive_letter.toLowerCase()
          );
          if (!stillConnected) {
            setSelectedDisk(null);
            setShowDiskPicker(true);
          } else {
            // Stable updater: do NOT change reference if disk letter and size remain identical
            setSelectedDisk(prev => {
              if (!prev) return stillConnected;
              if (
                prev.drive_letter.toLowerCase() === stillConnected.drive_letter.toLowerCase() &&
                prev.free_bytes === stillConnected.free_bytes &&
                prev.size_bytes === stillConnected.size_bytes
              ) {
                return prev;
              }
              return stillConnected;
            });
          }
        }
      } else {
        setSelectedDisk(null);
        setShowDiskPicker(true);
      }
    } catch (e) {
      console.error("Telemetry error:", e);
    }
  }, [selectedDisk?.drive_letter]);

  // Refresh connected disks hardware scan
  const handleRefreshDisks = async () => {
    setRefreshingDisks(true);
    try {
      const res = await api.refreshExternalDisks();
      if (res && res.external_disks) {
        setSystemStatus(prev => ({
          ...(prev || {}),
          external_disks: res.external_disks,
          has_external_disk: res.has_external_disk,
          active_external_disk: res.active_external_disk
        }));
      }
      await fetchStatus();
    } catch (err) {
      alert(err.message || 'Error refreshing disks');
    } finally {
      setRefreshingDisks(false);
    }
  };

  // Fetch files list with pagination support
  const fetchFiles = useCallback(async (isLoadMore = false) => {
    if (!user) return;
    if (currentSection.startsWith('admin-')) return;
    if (!selectedDisk) return;

    setLoading(true);
    try {
      const categoryFilter = currentSection === 'all' ? null : currentSection;
      const currentOffset = isLoadMore ? itemsCountRef.current : 0;
      const limit = 60;

      const res = await api.listFiles({
        path: currentPath,
        category: categoryFilter,
        search: searchQuery,
        sortBy,
        sortOrder,
        limit,
        offset: currentOffset,
        disk: selectedDisk.drive_letter
      });

      if (isLoadMore) {
        setItems(prev => [...prev, ...(res.items || [])]);
      } else {
        setItems(res.items || []);
        setBreadcrumbs(res.breadcrumbs || [{ name: 'Root', path: '' }]);
      }
      setTotalCount(res.total_count || 0);
      setHasMore(res.has_more || false);
    } catch (err) {
      console.error("Fetch files error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, currentSection, currentPath, searchQuery, sortBy, sortOrder, selectedDisk?.drive_letter]);

  // Lifecycle
  useEffect(() => {
    checkAuth();
    const handleUnauthorized = () => setUser(null);
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [checkAuth]);

  useEffect(() => {
    if (user) {
      fetchStatus();
      // Faster polling (4s) when waiting for a disk to be connected, 15s when active
      const pollFreq = (!selectedDisk || !systemStatus?.external_disks?.length) ? 4000 : 15000;
      const interval = setInterval(fetchStatus, pollFreq);
      return () => clearInterval(interval);
    }
  }, [user, fetchStatus, selectedDisk?.drive_letter, systemStatus?.external_disks?.length]);

  useEffect(() => {
    if (user && selectedDisk) {
      fetchFiles(false);
    }
  }, [user, selectedDisk?.drive_letter, currentSection, currentPath, searchQuery, sortBy, sortOrder]);

  // Operations
  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    setSelectedDisk(null);
    setCurrentSection('all');
    setCurrentPath('');
  };

  const handleNavigate = (path) => {
    setCurrentPath(path);
    setSearchQuery('');
  };

  const handleSelectSection = (secId) => {
    if (secId === currentSection) {
      if (selectedDisk && showDiskPicker && !secId.startsWith('admin-')) {
        setShowDiskPicker(false);
      }
      return;
    }
    setCurrentSection(secId);
    setSearchQuery('');
    if (!secId.startsWith('admin-')) {
      setCurrentPath('');
      setItems([]);
      setLoading(true);
      if (selectedDisk) {
        setShowDiskPicker(false);
      }
    }
  };

  const handleSelectExternalDisk = (disk) => {
    setSelectedDisk(disk);
    setShowDiskPicker(false);
    setCurrentPath('');
    setSearchQuery('');
    if (disk?.drive_letter) {
      api.selectExternalDisk(disk.drive_letter).catch(err => {
        console.warn('Backend disk select sync notice:', err);
      });
    }
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await api.mkdir(currentPath, newFolderName.trim(), selectedDisk?.drive_letter);
      setNewFolderName('');
      setNewFolderOpen(false);
      fetchFiles(false);
    } catch (err) {
      alert(err.message || String(err));
    }
  };

  const handleRenameItem = async (oldPath, newName) => {
    try {
      await api.rename(oldPath, newName, selectedDisk?.drive_letter);
      fetchFiles(false);
    } catch (err) {
      alert(err.message || String(err));
    }
  };

  const handleDeleteItems = async (paths) => {
    try {
      await api.deleteItems(paths, selectedDisk?.drive_letter);
      fetchFiles(false);
      fetchStatus();
    } catch (err) {
      alert(err.message || String(err));
    }
  };

  const handleRemoteModeToggle = async (enabled) => {
    try {
      if (typeof enabled === 'boolean') {
        await api.toggleRemoteMode(enabled);
      }
      await fetchStatus();
    } catch (err) {
      alert(err.message || String(err));
    }
  };

  const handleRefreshHealth = async () => {
    setRefreshingHealth(true);
    await fetchStatus();
    setRefreshingHealth(false);
  };

  if (authChecking) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginModal onLoginSuccess={(loginData) => {
      setUser({
        username: loginData.username,
        role: loginData.role,
        expires_at: loginData.expires_at
      });
      fetchStatus();
    }} />;
  }

  const isAdminView = currentSection.startsWith('admin-');
  const externalDisks = systemStatus?.external_disks || [];
  const hasExternalDisks = externalDisks.length > 0;
  const isDiskPickerActive = (!selectedDisk || showDiskPicker || !hasExternalDisks) && !isAdminView;

  return (
    <div className="min-h-screen bg-background text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-300">
      {/* Top Navigation */}
      <Navbar
        user={user}
        systemStatus={systemStatus}
        selectedDisk={selectedDisk}
        onOpenHealth={() => setHealthOpen(true)}
        onOpenAdmin={() => setCurrentSection('admin-remote')}
        onLogout={handleLogout}
        onChangeDisk={() => setShowDiskPicker(true)}
        onSelectDisk={(letter) => {
          const matched = externalDisks.find(d => d.drive_letter.toLowerCase() === letter.toLowerCase());
          if (matched) handleSelectExternalDisk(matched);
        }}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onToggleMobileMenu={() => setMobileMenuOpen(prev => !prev)}
        isMobileMenuOpen={mobileMenuOpen}
      />

      {/* Main Layout Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar / Mobile Drawer - Hidden when on Disk Picker screen */}
        {!isDiskPickerActive && (
          <Sidebar
            currentSection={currentSection}
            onSelectSection={handleSelectSection}
            user={user}
            onOpenUpload={() => setUploadOpen(true)}
            onOpenNewFolder={() => setNewFolderOpen(true)}
            systemStatus={systemStatus}
            isMobileOpen={mobileMenuOpen}
            onCloseMobile={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Content Explorer Area */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 pb-24 md:pb-6 touch-scroll">
          <div 
            key={isAdminView ? currentSection : isDiskPickerActive ? 'disk-picker' : currentSection} 
            className="transition-opacity duration-200 ease-out animate-fade-in space-y-4"
          >
            {/* If Disk Picker is active (entry point) or no disks attached */}
            {isDiskPickerActive ? (
              <DiskPicker
                disks={externalDisks}
                selectedDisk={selectedDisk}
                onSelectDisk={handleSelectExternalDisk}
                onRefreshDisks={handleRefreshDisks}
                refreshing={refreshingDisks}
              />
            ) : isAdminView ? (
              <AdminPanel
                activeTab={currentSection}
                systemStatus={systemStatus}
                onRemoteModeToggle={fetchStatus}
              />
            ) : (
              <div className="space-y-4">
                {/* Path Breadcrumbs */}
                {currentSection === 'all' && (
                  <div className="flex items-center justify-between">
                    <Breadcrumbs
                      breadcrumbs={breadcrumbs}
                      onNavigate={handleNavigate}
                    />
                    {selectedDisk && (
                      <button
                        onClick={() => setShowDiskPicker(true)}
                        className="text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1.5"
                      >
                        <span>Drive: {selectedDisk.label} ({selectedDisk.drive_letter})</span>
                        <span className="text-[10px] uppercase text-slate-400">• Switch</span>
                      </button>
                    )}
                  </div>
                )}

                {/* File Explorer Grid & Table with Skeletons & Pagination */}
                <FileGrid
                  items={items}
                  loading={loading}
                  user={user}
                  viewMode={viewMode}
                  onToggleView={setViewMode}
                  onNavigateFolder={handleNavigate}
                  onPreviewItem={setPreviewItem}
                  onDeleteItems={handleDeleteItems}
                  onRenameItem={handleRenameItem}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSortChange={(sb, so) => {
                    setSortBy(sb);
                    setSortOrder(so);
                  }}
                  currentDisk={selectedDisk?.drive_letter}
                  hasMore={hasMore}
                  onLoadMore={() => fetchFiles(true)}
                  totalCount={totalCount}
                />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Persistent Footer with Platform Leadership */}
      <footer className="h-10 border-t border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 px-6 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono shrink-0 py-2 sm:py-0 gap-1 sm:gap-0 z-10">
        <div className="flex items-center gap-2">
          <span className="text-slate-800 dark:text-slate-300 font-semibold">{APP_CONFIG.name}</span>
          <span className="text-slate-400 dark:text-slate-600">•</span>
          <span className="text-slate-500 dark:text-slate-400">{APP_CONFIG.tagline}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-cyan-600 dark:text-cyan-400 font-bold uppercase text-[10px] tracking-wider">Developers:</span>
          {APP_CONFIG.developers.map((dev, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-slate-400 dark:text-slate-600">•</span>}
              <span className="text-slate-800 dark:text-slate-300 font-medium">
                {dev}
              </span>
            </React.Fragment>
          ))}
        </div>
      </footer>

      {/* Upload Modal */}
      <UploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        currentPath={currentPath}
        disk={selectedDisk?.drive_letter}
        onUploadComplete={() => {
          fetchFiles(false);
          fetchStatus();
        }}
      />

      {/* Create Folder Modal */}
      {newFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <form
            onSubmit={handleCreateFolder}
            className="glass-panel w-full max-w-sm rounded-3xl p-6 border border-slate-200 dark:border-slate-700/80 space-y-4"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Create New Folder</h3>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Folder Name</label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Backups 2026"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setNewFolderOpen(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-95"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Health & SMART Diagnostics Drawer */}
      <HealthWidget
        isOpen={healthOpen}
        onClose={() => setHealthOpen(false)}
        systemStatus={systemStatus}
        onRefresh={handleRefreshHealth}
        refreshing={refreshingHealth}
      />

      {/* Media Lightbox & Previewer */}
      <Lightbox
        item={previewItem}
        currentDisk={selectedDisk?.drive_letter}
        onClose={() => setPreviewItem(null)}
      />

      {/* Mobile Bottom Navigation Bar */}
      {user && !isDiskPickerActive && (
        <MobileBottomNav
          currentSection={currentSection}
          onSelectSection={(sec) => {
            handleSelectSection(sec);
            setMobileMenuOpen(false);
          }}
          onOpenUpload={() => setUploadOpen(true)}
          onToggleMenu={() => setMobileMenuOpen(prev => !prev)}
          isMenuOpen={mobileMenuOpen}
        />
      )}
    </div>
  );
}
