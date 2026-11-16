'use client';

import React from 'react';
import { motion } from 'motion/react';
import emedicsLogo from '../../../assets/emedics_logo_white.png';

interface MedicalGlowSymbolProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MedicalGlowSymbol({ size = 'md', className = '' }: MedicalGlowSymbolProps) {
  const containerSizes = {
    sm: 'w-16 h-16 rounded-2xl',
    md: 'w-20 h-20 sm:w-24 sm:h-24 rounded-3xl',
    lg: 'w-28 h-28 sm:w-32 sm:h-32 rounded-[2rem]',
  };

  const logoSizes = {
    sm: 'w-10 h-10',
    md: 'w-13 h-13 sm:w-16 sm:h-16',
    lg: 'w-18 h-18 sm:w-22 sm:h-22',
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Soft ambient backlight halo */}
      <div className="absolute inset-0 bg-[#8FC7F5]/25 rounded-3xl blur-2xl transform scale-125 pointer-events-none" />

      {/* 3D Illuminated Glass Card */}
      <motion.div
        whileHover={{ scale: 1.04 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        className={`${containerSizes[size]} relative bg-gradient-to-b from-[#101D2B]/90 to-[#0A1420]/90 border border-[#8FC7F5]/35 shadow-[0_12px_40px_rgba(0,0,0,0.6),0_0_30px_rgba(143,199,245,0.25)] flex items-center justify-center backdrop-blur-xl overflow-hidden`}
      >
        {/* Subtle diagonal glossy light reflection */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#8FC7F5]/10 to-white/10 pointer-events-none" />

        {/* Inner highlight rim */}
        <div className="absolute inset-[1px] rounded-[calc(1.5rem-1px)] border border-white/10 pointer-events-none" />

        {/* Official eMEDICS 3D White Logo Emblem */}
        <img
          src={emedicsLogo}
          alt="eMEDICS Official Logo"
          className={`${logoSizes[size]} object-contain drop-shadow-[0_4px_16px_rgba(143,199,245,0.45)] select-none pointer-events-none transform transition-transform duration-300`}
          draggable={false}
        />
      </motion.div>
    </div>
  );
}

export default MedicalGlowSymbol;
