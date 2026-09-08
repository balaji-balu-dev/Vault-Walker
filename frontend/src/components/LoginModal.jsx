import React, { useState, useEffect, useRef } from 'react';
import { 
  Key, ShieldCheck, AlertCircle, Copy, Check, ArrowRight, 
  Loader2, Sun, Moon, Eye, EyeOff, Sparkles, Lock
} from 'lucide-react';
import { api } from '../services/api';
import Logo from './Logo';
import APP_CONFIG from '../config/constants';

export default function LoginModal({ onLoginSuccess }) {
  const [key, setKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isShaking, setIsShaking] = useState(false);
  const [initialized, setInitialized] = useState(true);
  const [setupUsername, setSetupUsername] = useState('admin');
  const [generatedKey, setGeneratedKey] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [rawMouse, setRawMouse] = useState({ x: -1000, y: -1000 });
  const [titleSpotlight, setTitleSpotlight] = useState({ x: 140, y: 30, active: false });
  const [theme, setTheme] = useState(() => localStorage.getItem('vault_theme') || 'dark');
  const titleRef = useRef(null);

  useEffect(() => {
    api.getSetupStatus()
      .then(res => setInitialized(res.initialized))
      .catch(() => setInitialized(true));

    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('vault_theme', next);
  };

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const x = (clientX / window.innerWidth - 0.5) * 24;
    const y = (clientY / window.innerHeight - 0.5) * 24;
    setMousePos({ x, y });
    setRawMouse({ x: clientX, y: clientY });

    if (titleRef.current) {
      const rect = titleRef.current.getBoundingClientRect();
      setTitleSpotlight({
        x: clientX - rect.left,
        y: clientY - rect.top,
        active: true
      });
    }
  };

  const triggerErrorShake = (msg) => {
    setError(msg);
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 550);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!key.trim()) return;
    setLoading(true);
    setError('');

    try {
      const res = await api.login(key.trim());
      onLoginSuccess(res);
    } catch (err) {
      triggerErrorShake(err.message || 'Invalid cryptographic key. Access denied.');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupAdmin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await api.setupFirstAdmin(setupUsername);
      setGeneratedKey(res.raw_key);
      setKey(res.raw_key);
      setInitialized(true);
    } catch (err) {
      triggerErrorShake(err.message || 'Failed to initialize root admin.');
    } finally {
      setLoading(false);
    }
  };

  const copyKey = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden select-none bg-slate-50 dark:bg-[#05070d] text-slate-900 dark:text-slate-100 transition-colors duration-500"
    >
      {/* 1. Ambient Dynamic Aurora / Mesh Glow Background */}
      <div 
        className="absolute inset-0 pointer-events-none overflow-hidden transition-transform duration-700 ease-out"
        style={{
          transform: `translate(${mousePos.x * 0.4}px, ${mousePos.y * 0.4}px)`
        }}
      >
        {/* Soft floating luminous radial blooms */}
        <div className="absolute -top-32 -left-32 w-[550px] h-[550px] bg-cyan-500/15 dark:bg-cyan-500/20 rounded-full blur-[120px] animate-float-slow" />
        <div className="absolute -bottom-32 -right-32 w-[550px] h-[550px] bg-blue-600/15 dark:bg-blue-600/20 rounded-full blur-[120px] animate-float-slow delay-200" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-emerald-500/10 dark:bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

        {/* Ambient Subtle Grid Mesh */}
        <div 
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
            backgroundSize: '32px 32px'
          }}
        />
      </div>

      {/* 2. Full Background Title with Flashlight Beam (Spanning from page left to right leaving margin) */}
      <div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none transition-transform duration-1000 ease-out overflow-hidden z-0 select-none px-4"
        style={{
          transform: `translate(${-mousePos.x * 1.1}px, ${-mousePos.y * 1.1}px)`
        }}
      >
        {/* Subtle Ambient Base Title - spans from page left to right leaving comfortable side margins */}
        <svg 
          viewBox="0 0 1400 180" 
          className="w-[94vw] max-w-[1920px] h-auto select-none pointer-events-none fill-slate-400/[0.05] dark:fill-slate-300/[0.08]"
        >
          <text
            x="50%"
            y="54%"
            textAnchor="middle"
            dominantBaseline="middle"
            textLength="1320"
            lengthAdjust="spacing"
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontWeight="900"
            fontSize="130"
            className="uppercase select-none"
          >
            {APP_CONFIG.name.toUpperCase()}
          </text>
        </svg>

        {/* Dynamic Flashlight Beam sweeping across the full background title */}
        <div 
          className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-150"
          style={{
            maskImage: `radial-gradient(circle 340px at ${rawMouse.x}px ${rawMouse.y}px, black 30%, transparent 75%)`,
            WebkitMaskImage: `radial-gradient(circle 340px at ${rawMouse.x}px ${rawMouse.y}px, black 30%, transparent 75%)`,
          }}
        >
          <svg 
            viewBox="0 0 1400 180" 
            className="w-[94vw] max-w-[1920px] h-auto select-none pointer-events-none"
          >
            <defs>
              <linearGradient id="bgTitleBeamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.8" />
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <text
              x="50%"
              y="54%"
              textAnchor="middle"
              dominantBaseline="middle"
              textLength="1320"
              lengthAdjust="spacing"
              fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontWeight="900"
              fontSize="130"
              fill="url(#bgTitleBeamGradient)"
              className="uppercase select-none"
            >
              {APP_CONFIG.name.toUpperCase()}
            </text>
          </svg>
        </div>
      </div>

      {/* Top Controls: Theme Switcher */}
      <div className="absolute top-6 right-6 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-3 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/90 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-cyan-500 shadow-lg backdrop-blur-xl hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4 text-amber-400 animate-fade-in" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700 animate-fade-in" />
          )}
        </button>
      </div>

      {/* Center Presentation: Staggered Entrance Column */}
      <div className="relative z-10 w-full max-w-md flex flex-col items-center">

        {/* Stagger Step 1: Official Logo Emblem (delay-100) */}
        <div className="animate-slide-up delay-100 mb-3 group">
          <div className="relative p-1 rounded-3xl bg-gradient-to-b from-cyan-500/40 via-blue-500/20 to-transparent shadow-2xl shadow-cyan-500/20 group-hover:scale-105 transition-transform duration-300">
            <Logo variant="icon" size="2xl" glow={true} className="rounded-2xl" />
          </div>
        </div>

        {/* Stagger Step 2: Interactive Flashlight Title & Tagline (delay-200) */}
        <div className="text-center space-y-2 mb-6 animate-slide-up delay-200">
          <div 
            ref={titleRef}
            className="relative inline-block px-6 py-2 select-none cursor-default group"
          >
            {/* Flashlight Radial Beam Aura following cursor */}
            <div 
              className="absolute pointer-events-none rounded-full blur-2xl bg-cyan-400/25 dark:bg-cyan-400/35 transition-opacity duration-200"
              style={{
                width: '180px',
                height: '90px',
                left: `${titleSpotlight.x - 90}px`,
                top: `${titleSpotlight.y - 45}px`,
                opacity: titleSpotlight.active ? 1 : 0
              }}
            />

            {/* Base Title (Always clearly visible in dark & light mode) */}
            <h1 className="text-3xl sm:text-4xl font-black tracking-wider uppercase font-sans">
              <span className="text-slate-800 dark:text-white transition-colors">
                VAULT
              </span>{' '}
              <span className="bg-gradient-to-r from-cyan-500 to-blue-500 bg-clip-text text-transparent">
                WALKER
              </span>
            </h1>

            {/* Flashlight Beam Highlight Overlay (Brightens to intense reflective chrome & cyan glow under cursor) */}
            <h1 
              aria-hidden="true"
              className="absolute inset-0 px-6 py-2 text-3xl sm:text-4xl font-black tracking-wider uppercase font-sans pointer-events-none transition-opacity duration-150"
              style={{
                background: 'linear-gradient(135deg, #ffffff 10%, #67e8f9 50%, #38bdf8 90%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                maskImage: `radial-gradient(circle 120px at ${titleSpotlight.x}px ${titleSpotlight.y}px, black 35%, transparent 80%)`,
                WebkitMaskImage: `radial-gradient(circle 120px at ${titleSpotlight.x}px ${titleSpotlight.y}px, black 35%, transparent 80%)`,
                filter: 'drop-shadow(0 0 16px rgba(6, 182, 212, 0.9))',
                opacity: titleSpotlight.active ? 1 : 0
              }}
            >
              VAULT WALKER
            </h1>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tracking-wide">
            {APP_CONFIG.tagline}
          </p>
        </div>

        {/* Stagger Step 3: Elevated Frosted Glass Card (delay-300) */}
        <div className={`w-full rounded-3xl p-7 sm:p-8 bg-white/85 dark:bg-slate-900/85 backdrop-blur-2xl border border-slate-200/90 dark:border-slate-800/90 shadow-2xl shadow-slate-900/5 dark:shadow-black/70 space-y-6 animate-scale-in delay-300 ${isShaking ? 'animate-shake' : ''}`}>

          {/* First-Run Setup Form (if database is empty) */}
          {!initialized && !generatedKey && (
            <form onSubmit={handleSetupAdmin} className="space-y-4 bg-slate-50/80 dark:bg-slate-950/70 p-5 rounded-2xl border border-cyan-500/30 animate-fade-in">
              <div className="text-xs text-cyan-600 dark:text-cyan-400 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-cyan-500" />
                <span>First-Run Administrator Setup</span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                Initialize Vault Walker by creating your root administrator account. A 256-bit cryptographic access key will be generated:
              </p>

              <div>
                <label className="text-[11px] text-slate-700 dark:text-slate-300 font-medium block mb-1.5">
                  Admin Username
                </label>
                <input
                  type="text"
                  required
                  value={setupUsername}
                  onChange={(e) => setSetupUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-mono glow-focus-ring focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 active:scale-[0.98] cursor-pointer transition-all disabled:opacity-50"
              >
                {loading ? 'Initializing Administrator...' : 'Generate Root Access Key'}
              </button>
            </form>
          )}

          {/* Root Key Generated One-Time Banner */}
          {generatedKey && (
            <div className="space-y-3 bg-amber-500/10 p-5 rounded-2xl border border-amber-500/40 animate-fade-in">
              <div className="text-xs font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span>Save Your Root Key!</span>
              </div>
              <p className="text-[11px] text-amber-900/80 dark:text-amber-200/80 leading-relaxed">
                This root access key will never be shown again. Copy and store it in a secure password manager:
              </p>
              <div className="flex items-center gap-2 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs text-cyan-700 dark:text-cyan-300 break-all select-all">
                <span className="flex-1 font-semibold">{generatedKey}</span>
                <button
                  type="button"
                  onClick={copyKey}
                  className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 hover:bg-cyan-500/30 transition-colors"
                  title="Copy Key"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleLogin}
                className="w-full py-2.5 rounded-xl bg-cyan-500 text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-95 shadow-md shadow-cyan-500/20 active:scale-[0.98] cursor-pointer transition-all"
              >
                Log In With This Key
              </button>
            </div>
          )}

          {/* Standard Key-Based Login Form */}
          {(initialized || generatedKey) && (
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-cyan-500" />
                    <span>Cryptographic Access Key</span>
                  </span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">256-bit Token</span>
                </label>

                {/* Input Container with Glow & Micro-interactions */}
                <div className="relative glow-focus-ring rounded-2xl bg-slate-50 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800/90 transition-all">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <Key className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoFocus
                    placeholder="Paste your access key (e.g. key_...)"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="w-full pl-10 pr-11 py-3 rounded-2xl bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 font-mono focus:outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 cursor-pointer"
                    title={showPassword ? "Hide key" : "Show key"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Animated Error Alert */}
              {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2.5 animate-slide-up">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {/* Submit Button with Hover, Press & Loading States */}
              <button
                type="submit"
                disabled={loading || !key.trim()}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-500 to-emerald-500 text-slate-950 text-xs font-bold uppercase tracking-wider hover:opacity-95 shadow-xl shadow-cyan-500/25 hover:shadow-cyan-500/40 active:scale-[0.98] disabled:opacity-50 transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                    <span>Authenticating Key...</span>
                  </>
                ) : (
                  <>
                    <span>Unlock Storage Vault</span>
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </>
                )}
              </button>

              {/* Developer Credits */}
              <div className="text-center pt-4 border-t border-slate-200/80 dark:border-slate-800/80 space-y-1">
                <div className="text-[11px] font-mono uppercase tracking-wider text-cyan-600 dark:text-cyan-400 font-bold mb-1">
                  Developers
                </div>
                {APP_CONFIG.developers.map((dev, i) => (
                  <div key={i} className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300">
                    {dev}
                  </div>
                ))}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
