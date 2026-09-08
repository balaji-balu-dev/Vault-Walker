import React, { useState } from 'react';
import { 
  HardDrive, Usb, RotateCw, ArrowRight, ShieldAlert, 
  Mail, Database, CheckCircle2, AlertCircle 
} from 'lucide-react';

export default function DiskPicker({
  disks = [],
  selectedDisk,
  onSelectDisk,
  onRefreshDisks,
  refreshing = false
}) {
  const [hoveredDisk, setHoveredDisk] = useState(null);

  const formatGb = (bytes) => (bytes / 1024 ** 3).toFixed(1);

  // If no disks are attached
  if (!disks || disks.length === 0) {
    return (
      <div className="py-20 px-4 max-w-2xl mx-auto text-center animate-slide-up">
        <div className="glass-panel rounded-3xl p-10 border border-dashed border-rose-500/40 space-y-6 shadow-2xl">
          <div className="w-20 h-20 rounded-3xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-center text-rose-400 mx-auto shadow-lg shadow-rose-500/10">
            <Usb className="w-10 h-10 animate-bounce" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-extrabold text-slate-900 dark:text-white font-sans tracking-tight">
              No disks connected at the moment.
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-md mx-auto">
              Vault Walker is strictly restricted to physically attached external storage volumes. The host machine's internal system operating system drive is locked out.
            </p>
          </div>

          {/* Contact Admin Line per requirement */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 flex items-center justify-center gap-2">
            <Mail className="w-4 h-4 text-cyan-500 shrink-0" />
            <span>To request access, contact the admin:</span>
            <a
              href="mailto:balajinallapati@outlook.com"
              className="text-cyan-500 dark:text-cyan-400 font-semibold hover:underline font-mono"
            >
              balajinallapati@outlook.com
            </a>
          </div>

          <div className="pt-2">
            <button
              onClick={onRefreshDisks}
              disabled={refreshing}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Detecting Disks...' : 'Scan For Connected Disks'}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto py-4 animate-fade-in">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 glass-card p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <HardDrive className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Select an External Storage Disk
            </h2>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-500 dark:text-cyan-400 border border-cyan-500/20 text-xs font-mono font-bold">
              {disks.length} {disks.length === 1 ? 'Volume' : 'Volumes'} Detected
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Choose which external drive to browse, stream, and manage. Only physically connected external disks are eligible.
          </p>
        </div>

        <button
          onClick={onRefreshDisks}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors cursor-pointer disabled:opacity-50"
          title="Rescan host hardware for newly attached drives"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Rescanning...' : 'Refresh Disks'}</span>
        </button>
      </div>

      {/* Disks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {disks.map((disk) => {
          const isSelected = selectedDisk && (selectedDisk.drive_letter.toLowerCase() === disk.drive_letter.toLowerCase());
          const usedGb = formatGb(disk.used_bytes);
          const totalGb = formatGb(disk.size_bytes);
          const freeGb = formatGb(disk.free_bytes);
          const percent = Math.round(disk.percent_used || 0);

          return (
            <div
              key={disk.drive_letter}
              onMouseEnter={() => setHoveredDisk(disk.drive_letter)}
              onMouseLeave={() => setHoveredDisk(null)}
              className={`glass-panel rounded-3xl p-6 border transition-all duration-300 flex flex-col justify-between space-y-5 ${
                isSelected 
                  ? 'border-cyan-500 shadow-xl shadow-cyan-500/10 ring-1 ring-cyan-500/50' 
                  : 'border-slate-200 dark:border-slate-800 hover:border-cyan-500/50 hover:shadow-lg'
              }`}
            >
              {/* Card Top */}
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-500 dark:text-cyan-400">
                      <HardDrive className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-slate-900 dark:text-white">
                          {disk.label || 'External Volume'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-[11px] font-bold border border-slate-200 dark:border-slate-700">
                          {disk.drive_letter}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        {disk.bus_type} • {disk.filesystem}
                      </span>
                    </div>
                  </div>

                  {isSelected && (
                    <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Active</span>
                    </span>
                  )}
                </div>

                {/* Usage meter */}
                <div className="space-y-1.5 pt-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-500 dark:text-slate-400">
                      Used: <strong className="text-slate-800 dark:text-slate-200">{usedGb} GB</strong>
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Free: {freeGb} GB
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        percent > 90 ? 'bg-rose-500' : percent > 75 ? 'bg-amber-500' : 'bg-gradient-to-r from-cyan-500 to-emerald-500'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                    <span>{percent}% allocated</span>
                    <span>Total: {totalGb} GB</span>
                  </div>
                </div>
              </div>

              {/* Action */}
              <button
                onClick={() => onSelectDisk(disk)}
                className={`w-full py-2.5 px-4 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 hover:opacity-95'
                    : 'bg-slate-100 dark:bg-slate-800/90 text-slate-800 dark:text-slate-200 hover:bg-cyan-500 hover:text-slate-950'
                }`}
              >
                <span>{isSelected ? 'Continue Browsing Disk' : 'Explore Disk Contents'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
