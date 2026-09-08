import React, { useState } from 'react';
import logoIcon from '../assets/logo-icon.jpg';
import logoBanner from '../assets/logo-banner.png';
import APP_CONFIG from '../config/constants';

/**
 * Standardized Brand Logo Component
 * 
 * Supports:
 * - variant="icon": 3D VW monogram emblem with cloud & keyhole
 * - variant="banner": Horizontal metallic "VAULT WALKER" logotype
 * - variant="full": Icon emblem + styled title text
 * - variant="watermark": Oversized ambient background treatment
 */
export default function Logo({
  variant = 'icon',
  size = 'md',
  className = '',
  glow = true,
  alt = APP_CONFIG.name,
  showTagline = false
}) {
  const [iconError, setIconError] = useState(false);
  const [bannerError, setBannerError] = useState(false);

  // Icon size mappings
  const sizeClasses = {
    xs: 'w-5 h-5',
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-24 h-24',
    '3xl': 'w-32 h-32',
    hero: 'w-40 h-40'
  };

  const iconDim = sizeClasses[size] || sizeClasses.md;

  if (variant === 'banner') {
    if (bannerError) {
      return (
        <span className={`font-extrabold tracking-wider bg-gradient-to-r from-slate-200 via-cyan-300 to-blue-500 bg-clip-text text-transparent font-sans ${className}`}>
          {APP_CONFIG.name.toUpperCase()}
        </span>
      );
    }
    return (
      <img
        src={logoBanner}
        alt={alt}
        onError={() => setBannerError(true)}
        className={`h-auto object-contain select-none pointer-events-none drop-shadow-md ${className}`}
      />
    );
  }

  if (variant === 'watermark') {
    return (
      <div className={`relative select-none pointer-events-none ${className}`}>
        <img
          src={logoIcon}
          alt=""
          aria-hidden="true"
          className="w-full h-full object-contain filter contrast-125 brightness-110 drop-shadow-[0_0_60px_rgba(6,182,212,0.25)]"
        />
      </div>
    );
  }

  const iconElement = (
    <div className={`relative rounded-2xl overflow-hidden shrink-0 transition-transform duration-300 ${iconDim} ${glow ? 'shadow-lg shadow-cyan-500/20' : ''}`}>
      {!iconError ? (
        <img
          src={logoIcon}
          alt={alt}
          onError={() => setIconError(true)}
          className="w-full h-full object-cover rounded-2xl select-none"
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-xs">
          VW
        </div>
      )}
      {/* Subtle glass reflection highlight */}
      <div className="absolute inset-0 ring-1 ring-white/20 rounded-2xl pointer-events-none" />
    </div>
  );

  if (variant === 'icon') {
    return (
      <div className={`inline-flex items-center ${className}`}>
        {iconElement}
      </div>
    );
  }

  // variant === 'full'
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {iconElement}
      <div className="flex flex-col text-left">
        <span className="font-extrabold tracking-tight text-slate-900 dark:text-white leading-none font-sans text-base">
          {APP_CONFIG.name}
        </span>
        {showTagline && (
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide mt-0.5">
            {APP_CONFIG.tagline}
          </span>
        )}
      </div>
    </div>
  );
}
