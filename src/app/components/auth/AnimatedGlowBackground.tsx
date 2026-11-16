'use client';

import React, { useEffect, useState } from 'react';
import { ColorBends } from './ColorBends';

// EXACT eMEDICS OFFICIAL PALETTE (8 Slots)
// Deep Charcoal: #05090F, Dark Navy: #0A1420, Muted Ice Blue: #8FC7F5, Soft Ice Blue: #B9DEFF, Soft White: #F4F7FC
const EMEDICS_COLOR_BENDS_PALETTE = [
  '#05090F', // Main base charcoal
  '#0A1420', // Dark navy atmospheric shading
  '#8FC7F5', // Primary muted ice-blue light bend
  '#0A1420', // Secondary navy depth
  '#B9DEFF', // Reflection highlight
  '#05090F', // Deep negative space
  '#8FC7F5', // Flowing light crest
  '#F4F7FC', // Subtle soft white accent
];

export function AnimatedGlowBackground() {
  const [viewportWidth, setViewportWidth] = useState<number>(1440);

  useEffect(() => {
    const updateSize = () => {
      if (typeof window !== 'undefined') {
        setViewportWidth(window.innerWidth);
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize, { passive: true });
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const isMobile = viewportWidth < 768;
  const isTablet = viewportWidth >= 768 && viewportWidth < 1024;

  // Responsive parameters strictly matching Section 2, 5 & 6
  const config = isMobile
    ? {
        rotation: 45,
        speed: 0.07, // Very slow, calm
        scale: 1.1, // Controlled bend scale
        frequency: 0.85,
        warpStrength: 0.75, // Softer curves for small screens
        mouseInfluence: 0, // Disabled on mobile touch
        parallax: 0,
        noise: 0.02,
        iterations: 1, // High efficiency for mobile GPU
        intensity: 0.95, // Soft illumination, zero distraction
        bandWidth: 6.5,
      }
    : isTablet
    ? {
        rotation: 55,
        speed: 0.08,
        scale: 1.2,
        frequency: 0.8,
        warpStrength: 0.85,
        mouseInfluence: 0.2,
        parallax: 0.2,
        noise: 0.03,
        iterations: 2,
        intensity: 1.05,
        bandWidth: 7.0,
      }
    : {
        // Desktop
        rotation: 60,
        speed: 0.09, // Slow, elegant flowing motion
        scale: 1.25, // Large flowing curved light bends
        frequency: 0.8,
        warpStrength: 0.9, // Smooth curved glass transitions
        mouseInfluence: 0.35, // Subtle, restrained pointer responsiveness
        parallax: 0.3, // Soft depth
        noise: 0.04, // Ultra-fine organic grain
        iterations: 2, // Layered depth
        intensity: 1.15, // Cinematic soft glow
        bandWidth: 7.5, // Broad illuminated bands
      };

  return (
    <div
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#05090F]"
      aria-hidden="true"
    >
      {/* 1. Underlying Deep Charcoal Base Canvas */}
      <div className="absolute inset-0 bg-[#05090F]" />

      {/* 2. Deep Navy Radial Ambience Behind Negative Space */}
      <div
        className="absolute -top-[15%] right-[2%] w-[65vw] h-[65vw] max-w-[850px] max-h-[850px] rounded-full blur-[60px] pointer-events-none opacity-40"
        style={{
          background:
            'radial-gradient(circle, rgba(143, 199, 245, 0.08) 0%, rgba(10, 20, 32, 0.5) 50%, rgba(5, 9, 15, 0) 75%)',
        }}
      />
      <div
        className="absolute -bottom-[20%] left-[2%] w-[60vw] h-[60vw] max-w-[780px] max-h-[780px] rounded-full blur-[60px] pointer-events-none opacity-30"
        style={{
          background:
            'radial-gradient(circle, rgba(185, 222, 255, 0.06) 0%, rgba(10, 20, 32, 0.4) 50%, rgba(5, 9, 15, 0) 75%)',
        }}
      />

      {/* 3. Official React Bits Color Bends WebGL Engine */}
      <div className="absolute inset-0 w-full h-full">
        <ColorBends
          rotation={config.rotation}
          speed={config.speed}
          colors={EMEDICS_COLOR_BENDS_PALETTE}
          transparent={true}
          autoRotate={0}
          scale={config.scale}
          frequency={config.frequency}
          warpStrength={config.warpStrength}
          mouseInfluence={config.mouseInfluence}
          parallax={config.parallax}
          noise={config.noise}
          iterations={config.iterations}
          intensity={config.intensity}
          bandWidth={config.bandWidth}
          className="w-full h-full"
        />
      </div>

      {/* 4. Contrast Protection Vignette (Keeps login card & typography 100% readable) */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-t from-[#05090F]/80 via-transparent to-[#05090F]/40 lg:bg-gradient-to-r lg:from-transparent lg:via-[#05090F]/20 lg:to-[#05090F]/70" />
    </div>
  );
}

export default AnimatedGlowBackground;
