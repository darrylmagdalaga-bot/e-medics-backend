'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'motion/react';

interface ElectricBlueGlassTileProps {
  logoSrc: string;
  className?: string;
}

// 20 deterministic floating light particles concentrated in the aura around the tile
const PARTICLES = [
  { id: 1, top: '6%', left: '26%', size: 2.5, opacity: 0.8, delay: '0s', dur: '4.6s', tx: -4, ty: -5 },
  { id: 2, top: '12%', left: '76%', size: 2, opacity: 0.65, delay: '1.1s', dur: '5.2s', tx: 5, ty: -4 },
  { id: 3, top: '22%', left: '12%', size: 3, opacity: 0.85, delay: '0.4s', dur: '4.8s', tx: -5, ty: 4 },
  { id: 4, top: '26%', left: '88%', size: 2.5, opacity: 0.7, delay: '1.9s', dur: '5.8s', tx: 4, ty: -5 },
  { id: 5, top: '42%', left: '8%', size: 2, opacity: 0.55, delay: '1.6s', dur: '5s', tx: -3, ty: 5 },
  { id: 6, top: '50%', left: '92%', size: 3.5, opacity: 0.9, delay: '0.7s', dur: '4.3s', tx: 5, ty: 3 },
  { id: 7, top: '68%', left: '14%', size: 2.5, opacity: 0.7, delay: '2.3s', dur: '5.4s', tx: -4, ty: -4 },
  { id: 8, top: '74%', left: '84%', size: 2, opacity: 0.6, delay: '0.9s', dur: '4.7s', tx: 4, ty: 4 },
  { id: 9, top: '88%', left: '32%', size: 3, opacity: 0.8, delay: '2.8s', dur: '5.6s', tx: -3, ty: -5 },
  { id: 10, top: '85%', left: '68%', size: 2.2, opacity: 0.55, delay: '1.4s', dur: '4.5s', tx: 3, ty: -4 },
  { id: 11, top: '4%', left: '52%', size: 2.5, opacity: 0.75, delay: '0.2s', dur: '5.1s', tx: 3, ty: -4 },
  { id: 12, top: '16%', left: '38%', size: 1.8, opacity: 0.6, delay: '2s', dur: '4.9s', tx: -2, ty: -3 },
  { id: 13, top: '20%', left: '64%', size: 2, opacity: 0.65, delay: '1.3s', dur: '5.5s', tx: 4, ty: -3 },
  { id: 14, top: '60%', left: '6%', size: 1.8, opacity: 0.5, delay: '2.6s', dur: '6s', tx: -4, ty: 3 },
  { id: 15, top: '64%', left: '95%', size: 2.2, opacity: 0.7, delay: '0.5s', dur: '4.8s', tx: 3, ty: 4 },
  { id: 16, top: '92%', left: '50%', size: 2.5, opacity: 0.75, delay: '1.8s', dur: '5.3s', tx: 2, ty: -4 },
  { id: 17, top: '38%', left: '96%', size: 1.8, opacity: 0.55, delay: '2.4s', dur: '5.7s', tx: 4, ty: -2 },
  { id: 18, top: '10%', left: '16%', size: 3.2, opacity: 0.9, delay: '0.8s', dur: '4.4s', tx: -4, ty: -4 },
  { id: 19, top: '80%', left: '20%', size: 2, opacity: 0.55, delay: '1s', dur: '5.2s', tx: -3, ty: 3 },
  { id: 20, top: '32%', left: '4%', size: 2, opacity: 0.6, delay: '3s', dur: '6.2s', tx: -3, ty: -3 },
];

/**
 * ElectricBlueGlassTile — Photorealistic Liquid Glass Tile with React Bits 3D Interactive Tilt & Specular Caustics
 */
export function ElectricBlueGlassTile({ logoSrc, className = '' }: ElectricBlueGlassTileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [isHovered, setIsHovered] = useState(false);

  // 1. React Bits Interactive 3D Spring Physics
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 26, stiffness: 220, mass: 0.75 };
  const mouseXSpring = useSpring(mouseX, springConfig);
  const mouseYSpring = useSpring(mouseY, springConfig);

  // Dynamic 3D tilt angles mapped from cursor position
  const dynamicRotateX = useTransform(mouseYSpring, [-0.5, 0.5], ['10deg', '-10deg']);
  const dynamicRotateY = useTransform(mouseXSpring, [-0.5, 0.5], ['-12deg', '12deg']);

  // Handle pointer tracking for React Bits Spotlight & Tilt
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || shouldReduceMotion) return;
    const rect = containerRef.current.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;

    mouseX.set(xPct);
    mouseY.set(yPct);

    // Update dynamic spotlight coordinate variables
    if (cardRef.current) {
      const cardRect = cardRef.current.getBoundingClientRect();
      const localX = e.clientX - cardRect.left;
      const localY = e.clientY - cardRect.top;
      cardRef.current.style.setProperty('--spotlight-x', `${localX}px`);
      cardRef.current.style.setProperty('--spotlight-y', `${localY}px`);
    }
  };

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    mouseX.set(0);
    mouseY.set(0);
  };

  return (
    <div 
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`group relative flex items-center justify-center select-none cursor-pointer ${className}`}
      style={{
        width: '260px',
        height: '240px',
        perspective: '1200px',
      }}
      aria-label="eMEDICS Official Emblem Glass Tile"
    >
      {/* Component-scoped CSS Keyframe Animations */}
      <style>{`
        @keyframes tileAmbientFloat {
          0%, 100% {
            transform: translateY(0px) rotate(-11deg);
          }
          50% {
            transform: translateY(-5px) rotate(-10deg);
          }
        }

        @keyframes atmosphericGlowBreathe {
          0%, 100% {
            opacity: 0.68;
            transform: scale(0.97);
          }
          50% {
            opacity: 0.98;
            transform: scale(1.05);
          }
        }

        @keyframes particlePulseDrift {
          0%, 100% {
            transform: translate3d(0, 0, 0);
            opacity: var(--p-base-op);
          }
          50% {
            transform: translate3d(var(--p-dx), var(--p-dy), 0);
            opacity: calc(var(--p-base-op) * 1.35);
          }
        }

        @keyframes neonRimShimmer {
          0%, 100% {
            opacity: 0.9;
            filter: drop-shadow(0 0 8px rgba(53, 191, 255, 0.9));
          }
          50% {
            opacity: 1;
            filter: drop-shadow(0 0 18px rgba(53, 191, 255, 1)) brightness(1.3);
          }
        }

        .emedics-ambient-float {
          animation: tileAmbientFloat 5.2s ease-in-out infinite;
          will-change: transform;
        }

        .emedics-glow-breathe {
          animation: atmosphericGlowBreathe 4.5s ease-in-out infinite;
          will-change: opacity, transform;
        }

        .emedics-particle-motion {
          animation: particlePulseDrift var(--p-dur) ease-in-out infinite var(--p-delay);
          will-change: transform, opacity;
        }

        .emedics-rim-shimmer {
          animation: neonRimShimmer 3.2s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .emedics-ambient-float,
          .emedics-glow-breathe,
          .emedics-particle-motion,
          .emedics-rim-shimmer {
            animation: none !important;
            transform: rotate(-11deg) !important;
          }
        }
      `}</style>

      {/* 1. SOFT DIFFUSED ATMOSPHERIC GLOW BEHIND TILE */}
      <div 
        className="emedics-glow-breathe absolute w-[240px] h-[240px] sm:w-[260px] sm:h-[260px] rounded-full pointer-events-none blur-[50px]"
        style={{
          background: 'radial-gradient(circle, rgba(8, 123, 255, 0.58) 0%, rgba(53, 191, 255, 0.32) 40%, rgba(6, 19, 35, 0.15) 65%, transparent 75%)'
        }}
      />

      {/* 2. FLOATING BLUE PARTICLES CONCENTRATED AROUND TILE */}
      <div className="absolute inset-0 pointer-events-none overflow-visible">
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="emedics-particle-motion absolute rounded-full"
            style={{
              top: p.top,
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: p.size > 2.5 ? '#E1F5FE' : '#35BFFF',
              boxShadow: `0 0 6px rgba(53, 191, 255, 0.9), 0 0 10px rgba(8, 123, 255, 0.7)`,
              ['--p-base-op' as any]: p.opacity,
              ['--p-delay' as any]: p.delay,
              ['--p-dur' as any]: p.dur,
              ['--p-dx' as any]: `${p.tx}px`,
              ['--p-dy' as any]: `${p.ty}px`,
            }}
          />
        ))}
      </div>

      {/* 3. AUTHENTIC LIQUID GLASS TILE (Translucent Frosted Slab with Refraction Bevels) */}
      <motion.div
        ref={cardRef}
        style={{
          rotateX: shouldReduceMotion ? 0 : dynamicRotateX,
          rotateY: shouldReduceMotion ? 0 : dynamicRotateY,
          transformStyle: 'preserve-3d',
          /* TRUE TRANSLUCENT GLASS BACKGROUND */
          background: 'linear-gradient(135deg, rgba(16, 42, 75, 0.35) 0%, rgba(6, 20, 38, 0.48) 50%, rgba(12, 38, 72, 0.42) 100%)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          border: '1.25px solid rgba(53, 191, 255, 0.65)',
          boxShadow: `
            inset 0 1.5px 2px 0 rgba(255, 255, 255, 0.7),
            inset 1px 0 2px 0 rgba(255, 255, 255, 0.35),
            inset -1px 0 2px 0 rgba(8, 123, 255, 0.4),
            inset 0 -2px 8px 0 rgba(0, 0, 0, 0.6),
            inset 0 0 26px 0 rgba(53, 191, 255, 0.28),
            0 0 26px rgba(53, 191, 255, 0.55),
            0 0 60px rgba(8, 123, 255, 0.38),
            0 20px 42px rgba(0, 0, 0, 0.7)
          `,
        }}
        whileHover={shouldReduceMotion ? {} : { scale: 1.05 }}
        transition={{ duration: 0.18 }}
        className="emedics-ambient-float relative z-10 w-[138px] h-[138px] sm:w-[150px] sm:h-[150px] rounded-[32px] sm:rounded-[36px] flex items-center justify-center p-3.5"
      >
        {/* REACT BITS DYNAMIC SPOTLIGHT GLARE (Light catches and tracks pointer across the glass) */}
        <div 
          className="pointer-events-none absolute inset-0 rounded-[30px] sm:rounded-[34px] transition-opacity duration-300"
          style={{
            background: isHovered
              ? 'radial-gradient(160px circle at var(--spotlight-x, 50%) var(--spotlight-y, 50%), rgba(255, 255, 255, 0.32), rgba(53, 191, 255, 0.18) 45%, transparent 75%)'
              : 'radial-gradient(180px circle at 45% 25%, rgba(255, 255, 255, 0.2), rgba(53, 191, 255, 0.12) 40%, transparent 70%)',
            opacity: isHovered ? 1 : 0.8,
            mixBlendMode: 'screen',
          }}
        />

        {/* PRISMATIC DIAGONAL GLASS SHEEN (Authentic diagonal glass reflection) */}
        <div 
          className="absolute inset-0 rounded-[30px] sm:rounded-[34px] pointer-events-none"
          style={{
            background: 'linear-gradient(125deg, rgba(255, 255, 255, 0.35) 0%, rgba(255, 255, 255, 0.12) 22%, transparent 45%, rgba(53, 191, 255, 0.06) 72%, rgba(255, 255, 255, 0.18) 100%)',
            mixBlendMode: 'screen',
          }}
        />

        {/* CRYSTALLINE TOP SPECULAR BEVEL (Glass edge catching light) */}
        <div 
          className="absolute top-0 left-[14%] right-[14%] h-[1.5px] rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.9) 50%, transparent 100%)',
            boxShadow: '0 0 6px rgba(255, 255, 255, 0.85)',
          }}
        />

        {/* NEON RIM GLINT: Intense Glowing Accent at Bottom Curve */}
        <div 
          className="emedics-rim-shimmer absolute -bottom-[1px] left-[18%] right-[18%] h-[3px] rounded-full pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, #35BFFF 25%, #FFFFFF 50%, #35BFFF 75%, transparent 100%)',
            boxShadow: '0 0 14px #35BFFF, 0 0 24px #087BFF, 0 0 6px #FFFFFF'
          }}
        />

        {/* 4. CONCENTRATED ELECTRIC-BLUE BLOOM DIRECTLY BEHIND LOGO (Refracting through the glass slab) */}
        <div 
          className="absolute w-20 h-20 sm:w-22 sm:h-22 rounded-full pointer-events-none blur-lg"
          style={{
            background: 'radial-gradient(circle, rgba(53, 191, 255, 0.9) 0%, rgba(8, 123, 255, 0.72) 50%, transparent 75%)',
            transform: 'translateZ(18px)',
          }}
        />

        {/* 5. OFFICIAL eMEDICS EMBLEM SUSPENDED IN GLASS (Holographic 3D Parallax Pop) */}
        <motion.img
          src={logoSrc}
          alt="eMEDICS Official Emblem"
          className="relative z-10 w-[84px] h-[84px] sm:w-[94px] sm:h-[94px] object-contain select-none pointer-events-none"
          style={{
            transform: 'translateZ(36px)',
            filter: 'drop-shadow(0 0 18px rgba(53, 191, 255, 0.85)) drop-shadow(0 4px 26px rgba(8, 123, 255, 0.92))'
          }}
          draggable={false}
        />
      </motion.div>
    </div>
  );
}

export default ElectricBlueGlassTile;
