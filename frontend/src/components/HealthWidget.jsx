import React from 'react';
import { 
  Activity, X, HardDrive, RefreshCw, AlertTriangle, 
  CheckCircle2, Thermometer, Clock, ShieldAlert, Cpu, Info
} from 'lucide-react';

function formatBytes(bytes) {
  if (!bytes) return '0 GB';
  const gb = bytes / (1024 ** 3);
  return `${gb.toFixed(1)} GB`;
}

export default function HealthWidget({ isOpen, onClose, systemStatus, onRefresh, refreshing }) {
  if (!isOpen) return null;

  const storage = systemStatus?.storage;
  const smart = systemStatus?.smart;

  const isHealthy = smart?.status === 'PASSED' || smart?.status === 'FALLBACK';
  const isWarning = smart?.status === 'WARNING';
  const isFailed = smart?.status === 'FAILED';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="glass-panel w-full max-w-2xl rounded-3xl p-6 shadow-2xl border border-slate-200 dark:border-slate-700/80 space-y-6 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isFailed
                ? 'bg-rose-500/20 border-rose-500/30 text-rose-500'
                : isWarning
                ? 'bg-amber-500/20 border-amber-500/30 text-amber-500'
                : 'bg-cyan-500/20 border-cyan-500/30 text-cyan-500'
            }`}>
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Storage & Hardware Diagnostics</span>
                {smart?.status && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase tracking-wider border ${
                    smart.status === 'PASSED'
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                      : smart.status === 'WARNING'
                      ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
                      : smart.status === 'FAILED'
                      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30'
                      : 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30'
                  }`}>
                    {smart.status}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                Physical Host Storage Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-cyan-500' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Warning Banner if Pre-Fail or Failed */}
        {(isWarning || isFailed) && (
          <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
            isFailed
              ? 'bg-rose-500/10 dark:bg-rose-950/30 border-rose-500/40 text-rose-800 dark:text-rose-200'
              : 'bg-amber-500/10 dark:bg-amber-950/30 border-amber-500/40 text-amber-800 dark:text-amber-200'
          }`}>
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <div className="font-bold">
                {isFailed ? 'HARDWARE ALERT: Physical disk reports failure!' : 'PRE-FAIL WARNING: SMART threshold exceeded!'}
              </div>
              <div>Backup all essential files immediately and inspect host hardware logs.</div>
            </div>
          </div>
        )}

        {/* Storage Capacity Gauge Card */}
        {storage && (
          <div className="glass-card rounded-2xl p-5 border border-slate-200 dark:border-slate-800/80 space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-200">
                <HardDrive className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Volume Capacity</span>
              </div>
              <span className="font-mono text-cyan-700 dark:text-cyan-300 font-bold">{storage.percent_used}% Used</span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-3 bg-slate-100 dark:bg-slate-950 rounded-full overflow-hidden p-0.5 border border-slate-200 dark:border-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  storage.percent_used > 90
                    ? 'bg-rose-500 shadow-lg shadow-rose-500/30'
                    : storage.percent_used > 75
                    ? 'bg-amber-500 shadow-lg shadow-amber-500/30'
                    : 'bg-gradient-to-r from-cyan-500 to-emerald-500 shadow-lg shadow-cyan-500/30'
                }`}
                style={{ width: `${storage.percent_used}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2 text-center">
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">Total Space</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-200 font-mono mt-0.5">
                  {formatBytes(storage.total_bytes)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">Used Space</div>
                <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400 font-mono mt-0.5">
                  {formatBytes(storage.used_bytes)}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 shadow-sm">
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono uppercase">Free Space</div>
                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                  {formatBytes(storage.free_bytes)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SMART Hardware Telemetry Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Temperature */}
          <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
              <Thermometer className="w-4 h-4 text-rose-500" />
              <span>Temperature</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
              {smart?.temperature_c ? `${smart.temperature_c}°C` : '--'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {smart?.temperature_c && smart.temperature_c < 50 ? 'Optimal' : 'Normal'}
            </div>
          </div>

          {/* Power on hours */}
          <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
              <Clock className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Power-On</span>
            </div>
            <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
              {smart?.power_on_hours ? `${smart.power_on_hours}h` : '--'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {smart?.power_on_hours ? `${Math.round(smart.power_on_hours / 24)} days` : '--'}
            </div>
          </div>

          {/* Reallocated Sectors */}
          <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
              <ShieldAlert className="w-4 h-4 text-amber-500" />
              <span>Bad Sectors</span>
            </div>
            <div className={`text-lg font-bold font-mono ${
              smart?.reallocated_sectors > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {smart?.reallocated_sectors ?? 0}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              {smart?.reallocated_sectors > 0 ? 'Reallocated' : 'Zero errors'}
            </div>
          </div>

          {/* Model */}
          <div className="glass-card rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs mb-1">
              <Cpu className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Disk Model</span>
            </div>
            <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate font-mono" title={smart?.device_model}>
              {smart?.device_model || 'Host Disk'}
            </div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 truncate">
              SN: {smart?.serial_number || 'N/A'}
            </div>
          </div>
        </div>

        {/* SMART Fallback Info or Attributes Table */}
        {smart?.is_fallback ? (
          <div className="p-4 rounded-2xl bg-cyan-500/10 dark:bg-cyan-950/20 border border-cyan-500/30 flex items-start gap-3">
            <Info className="w-5 h-5 text-cyan-600 dark:text-cyan-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <div className="font-semibold text-cyan-800 dark:text-cyan-300">Graceful Fallback Mode Active</div>
              <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                {smart.message || 'smartctl is not detected on the host OS. The platform is using real-time psutil disk telemetry.'}
              </div>
              <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                To enable low-level SMART hardware diagnostics on Windows: install <code className="bg-slate-200 dark:bg-slate-900 px-1 py-0.5 rounded text-cyan-700 dark:text-cyan-300 font-mono">smartmontools</code> via winget or official installer.
              </div>
            </div>
          </div>
        ) : smart?.attributes && smart.attributes.length > 0 ? (
          <div className="space-y-2">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
              SMART Telemetry Attributes
            </div>
            <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 max-h-48 overflow-y-auto shadow-sm">
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-slate-100 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400 text-[10px] uppercase border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-2.5">ID</th>
                    <th className="p-2.5">Attribute Name</th>
                    <th className="p-2.5">Raw Value</th>
                    <th className="p-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40">
                  {smart.attributes.map((attr, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="p-2.5 text-slate-500 dark:text-slate-400">{attr.id ?? '--'}</td>
                      <td className="p-2.5 text-slate-800 dark:text-slate-200 font-medium">{attr.name}</td>
                      <td className="p-2.5 text-cyan-700 dark:text-cyan-400">{attr.raw ?? attr.value}</td>
                      <td className="p-2.5 text-right">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                          attr.status === 'OK' ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        }`}>
                          {attr.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
