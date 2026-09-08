import React from 'react';
import { 
  HardDrive, Globe, Wifi, Activity, LogOut, User, 
  Usb, AlertCircle, ChevronDown, Sun, Moon, ArrowLeftRight,
  ArrowUpDown, Layers, Menu 
} from 'lucide-react';
import Logo from './Logo';
import APP_CONFIG from '../config/constants';

export default function Navbar({ 
  user, 
  systemStatus, 
  onOpenHealth, 
  onOpenAdmin, 
  onLogout,
  onSelectDisk,
  onChangeDisk,
  selectedDisk,
  theme,
  onToggleTheme,
  onToggleMobileMenu = () => {},
  isMobileMenuOpen = false
}) {
  const storage = systemStatus?.storage;
  const isRemote = systemStatus?.remote_mode_enabled;
  const activeDisk = selectedDisk || systemStatus?.active_external_disk;
  const externalDisks = systemStatus?.external_disks || [];
  const hasDisk = systemStatus?.has_external_disk;

  const usedGb = storage ? (storage.used_bytes / 1024 ** 3).toFixed(1) : '0';
  const totalGb = storage ? (storage.total_bytes / 1024 ** 3).toFixed(1) : '0';
  const percentUsed = storage ? Math.round(storage.percent_used) : 0;
  const activeTransfers = systemStatus?.active_transfers || 0;
  const activeSessions = systemStatus?.active_sessions_count || 1;

  return (
    <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 glass-panel sticky top-0 z-30 flex items-center justify-between px-3 sm:px-6 transition-colors duration-300">
      {/* Brand & Mobile Menu Toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Mobile Hamburger Drawer Button */}
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-cyan-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title="Open Menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <button 
          type="button"
          onClick={onChangeDisk}
          className="focus:outline-none focus:ring-2 focus:ring-cyan-500/50 rounded-2xl hover:scale-105 active:scale-95 transition-transform cursor-pointer shrink-0"
          title="Switch connected external disk"
        >
          <Logo variant="icon" size="sm" glow={true} />
        </button>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm sm:text-base tracking-tight text-slate-900 dark:text-white font-sans truncate max-w-[120px] sm:max-w-none">
              {APP_CONFIG.name}
            </span>
            <span className="hidden sm:flex text-[10px] uppercase font-mono tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 items-center gap-1">
              <Usb className="w-3 h-3" />
              <span>External Only</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono hidden sm:block">
            {systemStatus?.host_ip ? `${systemStatus.host_ip}:8000` : 'LAN Local'}
          </p>
        </div>
      </div>

      {/* Center status: External Disk & Storage & Concurrency */}
      <div className="hidden md:flex items-center gap-3">
        {/* Disk Picker / Active Disk Pill */}
        {hasDisk && activeDisk ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 shadow-sm">
            <Usb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div className="text-left leading-none">
              <div className="text-[10px] uppercase text-slate-500 dark:text-slate-400 font-mono flex items-center gap-1">
                <span>Disk</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">{activeDisk.drive_letter}</span>
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[130px]" title={activeDisk.label || activeDisk.friendly_name}>
                {activeDisk.label || activeDisk.friendly_name}
              </div>
            </div>

            {/* Switch Disk Button */}
            <button
              onClick={onChangeDisk}
              className="ml-1 p-1 rounded-lg text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Change External Disk"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div 
            onClick={onChangeDisk}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-300 text-xs animate-pulse cursor-pointer shadow-sm"
          >
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>No Disks Attached (Click to Scan)</span>
          </div>
        )}

        {/* Storage capacity pill */}
        {hasDisk && (
          <button
            onClick={onOpenHealth}
            className="flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 hover:border-cyan-500/40 shadow-sm transition-colors group cursor-pointer"
            title="Click to view disk health and SMART telemetry"
          >
            <div className="text-left">
              <div className="text-[11px] text-slate-600 dark:text-slate-400 font-medium flex items-center gap-1.5">
                <span>Usage</span>
                <span className="text-slate-900 dark:text-slate-200 font-mono font-semibold">{usedGb} / {totalGb} GB</span>
              </div>
              <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden mt-1">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    percentUsed > 90 ? 'bg-rose-500' : percentUsed > 75 ? 'bg-amber-500' : 'bg-cyan-500'
                  }`}
                  style={{ width: `${percentUsed}%` }}
                />
              </div>
            </div>
            <Activity className="w-4 h-4 text-slate-400 group-hover:text-cyan-500 transition-colors" />
          </button>
        )}

        {/* Live Admin Concurrency Pill */}
        {user?.role === 'admin' && (
          <div 
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 text-[11px] font-mono text-slate-600 dark:text-slate-400 shadow-sm"
            title={`${activeSessions} active session(s), ${activeTransfers} active streaming transfer(s)`}
          >
            <div className="flex items-center gap-1">
              <span className={`w-2 h-2 rounded-full ${activeTransfers > 0 ? 'bg-cyan-500 animate-ping' : 'bg-emerald-500'}`} />
              <span>{activeSessions} {activeSessions === 1 ? 'user' : 'users'}</span>
            </div>
            {activeTransfers > 0 && (
              <span className="text-cyan-600 dark:text-cyan-500 font-semibold">
                • {activeTransfers} transfer{activeTransfers > 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}

        {/* Cloudflare Tunnel Status Pill */}
        <div
          onClick={user?.role === 'admin' ? onOpenAdmin : undefined}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium border transition-colors shadow-sm ${
            user?.role === 'admin' ? 'cursor-pointer hover:opacity-90' : ''
          } ${
            systemStatus?.tunnel?.is_running
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300 font-semibold'
              : 'bg-white/85 dark:bg-slate-900/80 border-slate-200/90 dark:border-slate-800 text-slate-500 dark:text-slate-400'
          }`}
          title={systemStatus?.tunnel?.is_running ? `Cloudflare Tunnel Active: ${systemStatus.tunnel.public_url || ''}` : 'Tunnel Inactive (LAN Only)'}
        >
          {systemStatus?.tunnel?.is_running ? (
            <>
              <Globe className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400 animate-pulse" />
              <span>Tunnel Live</span>
            </>
          ) : (
            <>
              <Wifi className="w-3.5 h-3.5 text-slate-400" />
              <span>LAN Only</span>
            </>
          )}
        </div>
      </div>

      {/* Center status for mobile */}
      <div className="md:hidden flex items-center">
        {hasDisk && activeDisk && (
          <button
            onClick={onChangeDisk}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-xs shadow-sm hover:border-cyan-500/40 transition-colors"
            title={`Active disk: ${activeDisk.label || activeDisk.friendly_name} (${activeDisk.drive_letter}) - Tap to switch`}
          >
            <Usb className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-bold font-mono text-emerald-600 dark:text-emerald-400">{activeDisk.drive_letter}</span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[60px] hidden xs:inline">
              {activeDisk.label || activeDisk.friendly_name}
            </span>
          </button>
        )}
      </div>

      {/* User profile, theme toggle & actions */}
      <div className="flex items-center gap-1.5 sm:gap-3">
        {/* Diagnostics button for mobile */}
        {hasDisk && (
          <button
            onClick={onOpenHealth}
            className="p-2 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-500 md:hidden transition-colors"
            title="Disk Diagnostics"
          >
            <Activity className="w-4 h-4 text-cyan-500" />
          </button>
        )}

        {/* Theme Switcher Button */}
        <button
          onClick={onToggleTheme}
          className="p-2 rounded-xl bg-white/85 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 transition-all cursor-pointer shadow-sm"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
        </button>

        {/* User Card */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-xl bg-white/85 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 shadow-sm">
          <div className="w-6 h-6 rounded-md bg-gradient-to-br from-cyan-500/20 to-emerald-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0">
            <User className="w-3.5 h-3.5" />
          </div>
          <div className="text-left leading-none hidden sm:block">
            <div className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[100px]">{user?.username}</div>
            <div className="text-[10px] uppercase font-mono tracking-wider text-slate-500 dark:text-slate-400">
              {user?.role}
            </div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={onLogout}
          className="p-2 rounded-xl bg-white/85 dark:bg-slate-900/60 border border-slate-200/90 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-rose-500 hover:border-rose-500/30 transition-colors cursor-pointer shadow-sm"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
