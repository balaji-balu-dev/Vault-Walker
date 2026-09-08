import React, { useState, useEffect } from 'react';
import { 
  Users, Globe, ShieldAlert, Key, Plus, Trash2, RotateCw, 
  Copy, Check, AlertTriangle, Wifi, ExternalLink, ShieldCheck, CheckCircle2,
  Loader2 
} from 'lucide-react';
import { api } from '../services/api';

export default function AdminPanel({
  activeTab = 'admin-users',
  systemStatus,
  onRemoteModeToggle
}) {
  // Users state
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newRole, setNewRole] = useState('user');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createdKeyData, setCreatedKeyData] = useState(null); // { username, raw_key }
  const [copiedKey, setCopiedKey] = useState(false);
  const [tunnelLoading, setTunnelLoading] = useState(false);

  // Audit logs state
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  // Network state
  const [networkInfo, setNetworkInfo] = useState(null);

  useEffect(() => {
    loadUsers();
    loadLogs();
    api.getNetworkDetails().then(setNetworkInfo).catch(() => {});
  }, []);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const list = await api.getUsers();
      setUsers(list);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadLogs = async () => {
    setLoadingLogs(true);
    try {
      const logs = await api.getAuditLogs(100);
      setAuditLogs(logs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) return;
    try {
      const res = await api.createUser(newUsername.trim(), newRole);
      setCreatedKeyData(res);
      setNewUsername('');
      setShowCreateModal(false);
      loadUsers();
      loadLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRevokeKey = async (userId, username) => {
    if (confirm(`Revoke current key and generate a new key for "${username}"? Active sessions will be invalidated immediately.`)) {
      try {
        const res = await api.revokeUserKey(userId);
        setCreatedKeyData(res);
        loadUsers();
        loadLogs();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (confirm(`Permanently delete user account "${username}"?`)) {
      try {
        await api.deleteUser(userId);
        loadUsers();
        loadLogs();
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const copyKeyToClipboard = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const isRemoteEnabled = systemStatus?.remote_mode_enabled;

  return (
    <div className="space-y-6">
      {/* Tab: User & Access Key Management */}
      {activeTab === 'admin-users' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/90 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm backdrop-blur-md">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Access Key & User Management</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Every user is granted a cryptographic key (no password-reset flow).
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/20 text-xs font-semibold tracking-wide uppercase transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Issue New Key / User</span>
            </button>
          </div>

          {/* Users Table */}
          <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono uppercase text-[11px]">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3 hidden sm:table-cell">Created At</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/50">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 font-semibold text-slate-900 dark:text-slate-200">
                      <div className="flex items-center gap-2">
                        <Key className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                        <span>{u.username}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded font-mono text-[10px] uppercase border ${
                        u.role === 'admin'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-bold'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="p-3 font-mono text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRevokeKey(u.id, u.username)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 border border-amber-500/30 text-[11px] transition-colors"
                          title="Revoke current key and generate a fresh key"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Revoke Key</span>
                        </button>
                        <button
                          onClick={() => handleDeleteUser(u.id, u.username)}
                          className="p-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-500/30 transition-colors"
                          title="Delete user"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab: Cloudflare Tunnel Remote Access */}
      {activeTab === 'admin-remote' && (
        <div className="space-y-5 max-w-4xl animate-fade-in">
          <div className="bg-white/90 dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-800/80 space-y-5 shadow-sm backdrop-blur-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Globe className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  <span>Cloudflare Tunnel — Emergency Remote Access</span>
                </h2>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed max-w-xl">
                  Establishes an outbound-only encrypted tunnel to Cloudflare's global edge network. 
                  Zero router port forwarding, no static IP or DDNS required, and no exposed local ports.
                </p>
              </div>

              {/* Tunnel Status Pill & Controls */}
              <div className="flex items-center gap-3">
                {systemStatus?.tunnel?.is_running ? (
                  <button
                    disabled={tunnelLoading}
                    onClick={async () => {
                      setTunnelLoading(true);
                      try {
                        await api.stopTunnel();
                        if (onRemoteModeToggle) onRemoteModeToggle();
                      } catch (err) {
                        alert(err.message || String(err));
                      } finally {
                        setTunnelLoading(false);
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30 text-xs font-semibold tracking-wide uppercase transition-all cursor-pointer disabled:opacity-50"
                  >
                    {tunnelLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Stopping...</span>
                      </>
                    ) : (
                      <span>Stop Tunnel</span>
                    )}
                  </button>
                ) : (
                  <button
                    disabled={tunnelLoading}
                    onClick={async () => {
                      setTunnelLoading(true);
                      try {
                        await api.startTunnel();
                        if (onRemoteModeToggle) onRemoteModeToggle();
                      } catch (err) {
                        alert(err.message || String(err));
                      } finally {
                        setTunnelLoading(false);
                      }
                    }}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 font-bold text-xs tracking-wide uppercase hover:opacity-95 shadow-lg shadow-cyan-500/20 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {tunnelLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Starting...</span>
                      </>
                    ) : (
                      <span>Start Quick Tunnel</span>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Live Tunnel Status Card */}
            {systemStatus?.tunnel?.is_running ? (
              <div className="p-5 rounded-2xl bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/30 dark:border-emerald-500/40 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <span>Tunnel Active (Public HTTPS Live)</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Uptime: {systemStatus.tunnel.uptime_seconds || 0}s
                  </span>
                </div>

                {systemStatus.tunnel.public_url ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-950/80 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="font-mono text-xs text-cyan-700 dark:text-cyan-300 font-semibold truncate select-all">
                      {systemStatus.tunnel.public_url}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(systemStatus.tunnel.public_url);
                          alert('Copied tunnel URL to clipboard!');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-cyan-500/10 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy URL</span>
                      </button>
                      <a
                        href={systemStatus.tunnel.public_url}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20 text-xs flex items-center gap-1.5 transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open Link</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-amber-600 dark:text-amber-300 flex items-center gap-2">
                    <span className="animate-spin w-3.5 h-3.5 border-2 border-amber-500 border-t-transparent rounded-full" />
                    <span>Allocating Cloudflare Edge hostname...</span>
                  </div>
                )}

                <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                  Anyone accessing this link must present a valid 256-bit cryptographic access key to browse or upload. All remote sessions are recorded in the Security Audit Logs.
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 flex items-center gap-3 text-slate-600 dark:text-slate-400 text-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                <div>
                  <span className="font-semibold text-slate-900 dark:text-slate-200">LAN-Only Mode Active: </span>
                  Cloudflare Tunnel is stopped. The application is completely unreachable from the public internet.
                </div>
              </div>
            )}
          </div>

          {/* Architecture Benefits */}
          <div className="bg-white/90 dark:bg-slate-900/60 rounded-3xl p-6 border border-slate-200 dark:border-slate-800/80 space-y-4 shadow-sm backdrop-blur-md">
            <h3 className="text-xs font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold">
              Why Cloudflare Tunnel?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1.5 shadow-sm">
                <div className="font-bold text-slate-900 dark:text-slate-200">Outbound Only</div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Zero inbound firewall or router ports are opened. Your router stays 100% closed.
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1.5 shadow-sm">
                <div className="font-bold text-slate-900 dark:text-slate-200">Free Automatic HTTPS</div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  Cloudflare terminates TLS at their global edge. No certificate management required.
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/60 space-y-1.5 shadow-sm">
                <div className="font-bold text-slate-900 dark:text-slate-200">No Lingering Endpoints</div>
                <div className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed">
                  When you stop the tunnel, the process terminates and the public URL is destroyed immediately.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Security Audit Logs */}
      {activeTab === 'admin-audit' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between bg-white/90 dark:bg-slate-900/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm backdrop-blur-md">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
                <span>Security & Remote Access Audit Trail</span>
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Every authentication attempt, file action, and emergency remote request is logged.
              </p>
            </div>
            <button
              onClick={loadLogs}
              disabled={loadingLogs}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shadow-sm"
              title="Refresh audit logs"
            >
              <RotateCw className={`w-4 h-4 ${loadingLogs ? 'animate-spin text-cyan-500' : ''}`} />
            </button>
          </div>

          <div className="glass-card rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800/80 shadow-sm max-h-[65vh] overflow-y-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-mono uppercase text-[11px] sticky top-0">
                <tr>
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">User</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Network Origin</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/40 font-mono">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 text-slate-900 dark:text-slate-200 font-semibold font-sans">
                      {log.username}
                    </td>
                    <td className="p-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-cyan-700 dark:text-cyan-300 font-semibold">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                        log.is_remote
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30 font-semibold'
                          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 font-semibold'
                      }`}>
                        {log.is_remote ? `REMOTE (${log.ip_address})` : `LAN (${log.ip_address})`}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600 dark:text-slate-400 text-[11px] truncate max-w-xs" title={log.details}>
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal: Create User / Issue Key */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <form onSubmit={handleCreateUser} className="glass-panel w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-700/80 space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-cyan-600 dark:text-cyan-400" />
              <span>Issue New User Access Key</span>
            </h3>

            <div>
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium block mb-1">Username</label>
              <input
                type="text"
                required
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="e.g. john_doe"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="text-xs text-slate-700 dark:text-slate-300 font-medium block mb-1">Role</label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
              >
                <option value="user">Regular User (Browse & Upload only)</option>
                <option value="admin">Administrator (Full Access & User Management)</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 cursor-pointer"
              >
                Generate Key
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Display Created Key (Displayed once!) */}
      {createdKeyData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-amber-500/40 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
                <Key className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cryptographic Access Key Generated</h3>
                <p className="text-xs text-amber-600 dark:text-amber-300/90 font-mono mt-0.5">
                  User: {createdKeyData.username} ({createdKeyData.role})
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 font-mono text-xs shadow-inner">
              <span className="text-cyan-700 dark:text-cyan-300 break-all select-all font-semibold">
                {createdKeyData.raw_key}
              </span>
              <button
                onClick={() => copyKeyToClipboard(createdKeyData.raw_key)}
                className="shrink-0 p-2 rounded-xl bg-cyan-500/15 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-500/25 transition-colors cursor-pointer"
                title="Copy to clipboard"
              >
                {copiedKey ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 dark:bg-amber-950/20 border border-amber-500/30 text-[11px] text-amber-800 dark:text-amber-200 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <strong>Save this key immediately!</strong> For security, this key will never be shown again and cannot be recovered. Only its salted hash is stored on disk.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setCreatedKeyData(null)}
                className="px-5 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-semibold text-slate-900 dark:text-white transition-colors cursor-pointer"
              >
                I Have Saved This Key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
