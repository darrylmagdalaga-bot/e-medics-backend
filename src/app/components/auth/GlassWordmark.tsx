'use client';

import React from 'react';
import './GlassWordmark.css';

export interface GlassWordmarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
  animated?: boolean;
  className?: string;
  subtitleClassName?: string;
}

export function GlassWordmark({
  size = 'md',
  showSubtitle = true,
  animated = true,
  className = '',
  subtitleClassName = '',
}: GlassWordmarkProps) {
  const sizeClasses = {
    sm: 'text-2xl',
    md: 'text-3xl sm:text-[38px]',
    lg: 'text-[45px] sm:text-[49px] md:text-[51px]',
    xl: 'text-5xl sm:text-6xl lg:text-7xl',
  };

  const subtitleSizes = {
    sm: 'text-[9px] tracking-[0.24em] mt-1.5',
    md: 'text-[10px] tracking-[0.28em] mt-2',
    lg: 'text-[11px] sm:text-xs tracking-[0.3em] mt-2.5',
    xl: 'text-xs sm:text-[13px] tracking-[0.32em] mt-3',
  };

  return (
    <div className={`glass-wordmark-root items-start ${className}`}>
      <div className={`glass-wordmark-wrap ${sizeClasses[size]}`}>
        {/* LAYER 1: BASE TYPOGRAPHY (Permanently visible, 100% solid, fully opaque) */}
        <div className="glass-wordmark-base">
          <span className="glass-wordmark-e">e</span>
          <span className="glass-wordmark-medics">MEDICS</span>
        </div>

        {/* LAYER 2: SEPARATE INDEPENDENT GLASS REFLECTION OVERLAY */}
        {animated && (
          <div className="glass-wordmark-reflection-overlay animating" aria-hidden="true">
            <span className="glass-wordmark-ghost-e">e</span>
            <span className="glass-wordmark-ghost-medics">MEDICS</span>
          </div>
        )}
      </div>

      {showSubtitle && (
        <span
          className={`${subtitleSizes[size]} font-semibold uppercase text-[#8DBDEB]/75 select-none font-sans ${subtitleClassName}`}
        >
          CITY HEALTH DEPARTMENT
        </span>
      )}
    </div>
  );
}
