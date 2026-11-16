'use client';

import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { 
  Package, 
  HandHeart, 
  Users, 
  Pill, 
  Store, 
  FileText,
  Activity
} from 'lucide-react';

interface BlueGlassTechBackgroundProps {
  showCards?: boolean;
}

export function BlueGlassTechBackground({ showCards = true }: BlueGlassTechBackgroundProps) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div 
      className="absolute inset-0 overflow-hidden pointer-events-none select-none z-0 bg-[#050B14]"
      aria-hidden="true"
    >
      {/* 1. Base Layer: Midnight Navy Top to Deep Charcoal Lower Section */}
      <div 
        className="absolute inset-0"
        style={{
          background: showCards
            ? 'linear-gradient(180deg, #07172C 0%, #061324 110px, #050B14 210px, #050B14 100%)'
            : 'linear-gradient(180deg, #07172C 0%, #061324 35%, #050B14 65%, #050B14 100%)'
        }}
      />

      {/* 2. Top-Center & Top-Right Radiant Electric Blue Ambient Aura */}
      <motion.div
        animate={
          shouldReduceMotion
            ? {}
            : {
                opacity: [0.75, 0.98, 0.75],
                scale: [1, 1.04, 1],
              }
        }
        transition={{
          repeat: Infinity,
          duration: 7.5,
          ease: 'easeInOut',
        }}
        className="absolute -top-16 right-[2%] sm:right-[10%] w-[380px] sm:w-[500px] h-[340px] sm:h-[420px] rounded-full pointer-events-none blur-[75px]"
        style={{
          background: 'radial-gradient(circle, rgba(8, 127, 234, 0.42) 0%, rgba(53, 191, 255, 0.22) 35%, rgba(7, 23, 44, 0.75) 60%, transparent 80%)'
        }}
      />

      {/* Top-Left Ambient Blue Glow */}
      <div 
        className="absolute -top-12 -left-10 w-[260px] h-[260px] rounded-full pointer-events-none blur-[60px] opacity-40"
        style={{
          background: 'radial-gradient(circle, rgba(8, 127, 234, 0.3) 0%, rgba(6, 20, 38, 0.6) 55%, transparent 75%)'
        }}
      />

      {/* 3. UPPER SECTION: Abstract Floating Glassmorphism Panels Container */}
      {/* Aligned to the exact max-w-[340px] sm:max-w-[360px] grid of the content */}
      {showCards && (
        <div className="absolute top-0 left-0 right-0 max-w-[340px] sm:max-w-[360px] mx-auto px-4 pt-3.5 sm:pt-4 overflow-visible">
          {/* Top Two-Column Cluster with Subtle 3D Glass Perspective */}
          <div className="relative w-full flex justify-between gap-2.5 sm:gap-3">
            
            {/* ============================================================== */}
            {/* LEFT CLUSTER: Chart Bars Card + System Directory Card          */}
            {/* ============================================================== */}
            <motion.div
              animate={
                shouldReduceMotion
                  ? {}
                  : {
                      y: [0, -3.5, 0],
                    }
              }
              transition={{
                repeat: Infinity,
                duration: 8.5,
                ease: 'easeInOut',
              }}
              className="flex flex-col gap-2 w-[108px] sm:w-[114px] shrink-0"
            >
              {/* Card 1: Abstract Vertical Metric Bars with True Frosted Glass */}
              <div 
                className="w-full h-[80px] sm:h-[86px] rounded-2xl p-2.5 flex flex-col justify-end backdrop-blur-xl relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(8, 26, 48, 0.75) 0%, rgba(6, 18, 34, 0.65) 100%)',
                  border: '1px solid rgba(143, 200, 245, 0.28)',
                  boxShadow: '0 8px 30px rgba(0, 0, 0, 0.55), inset 0 1px 1px rgba(255, 255, 255, 0.16), inset 0 0 12px rgba(8, 127, 234, 0.18)',
                }}
              >
                {/* Inner gloss reflection */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#8FC8F5]/8 to-white/10 pointer-events-none" />
                
                {/* Top Card Icon Indicator */}
                <div className="absolute top-2 left-2.5 text-[#35BFFF]">
                  <Activity className="w-3.5 h-3.5 drop-shadow-[0_0_6px_rgba(53,191,255,0.6)]" />
                </div>

                {/* 3 Glowing Gradient Metric Bars */}
                <div className="flex items-end justify-center gap-1.5 sm:gap-2 relative z-10 pb-0.5">
                  <div 
                    className="w-2 sm:w-2.5 h-6 sm:h-7 rounded-full bg-gradient-to-t from-[#087FEA] to-[#8FC8F5] shadow-[0_0_8px_rgba(8,127,234,0.7)]" 
                  />
                  <div 
                    className="w-2 sm:w-2.5 h-11 sm:h-12 rounded-full bg-gradient-to-t from-[#087FEA] via-[#35BFFF] to-[#E1F5FE] shadow-[0_0_12px_rgba(53,191,255,0.85)]" 
                  />
                  <div 
                    className="w-2 sm:w-2.5 h-8 sm:h-9 rounded-full bg-gradient-to-t from-[#087FEA] to-[#8FC8F5] shadow-[0_0_8px_rgba(8,127,234,0.7)]" 
                  />
                </div>
              </div>

              {/* Card 2: Abstract Healthcare Directory / Modules List */}
              <div 
                className="w-full rounded-2xl p-2 sm:p-2.5 flex flex-col gap-1 backdrop-blur-xl relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(8, 26, 48, 0.75) 0%, rgba(6, 18, 34, 0.65) 100%)',
                  border: '1px solid rgba(143, 200, 245, 0.22)',
                  boxShadow: '0 8px 25px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.12)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#8FC8F5]/5 to-white/5 pointer-events-none" />
                
                <div className="flex items-center gap-1.5 text-[#B8DCFF]">
                  <Pill className="w-2.5 h-2.5 text-[#35BFFF] shrink-0 drop-shadow-[0_0_4px_rgba(53,191,255,0.5)]" />
                  <span className="text-[8.5px] font-semibold tracking-wider uppercase truncate">Warehouse</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#B8DCFF]">
                  <Store className="w-2.5 h-2.5 text-[#35BFFF] shrink-0 drop-shadow-[0_0_4px_rgba(53,191,255,0.5)]" />
                  <span className="text-[8.5px] font-semibold tracking-wider uppercase truncate">Pharmacy</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#B8DCFF]">
                  <Users className="w-2.5 h-2.5 text-[#35BFFF] shrink-0 drop-shadow-[0_0_4px_rgba(53,191,255,0.5)]" />
                  <span className="text-[8.5px] font-semibold tracking-wider uppercase truncate">BHWs</span>
                </div>
                <div className="flex items-center gap-1.5 text-[#B8DCFF]">
                  <FileText className="w-2.5 h-2.5 text-[#35BFFF] shrink-0 drop-shadow-[0_0_4px_rgba(53,191,255,0.5)]" />
                  <span className="text-[8.5px] font-semibold tracking-wider uppercase truncate">Reports</span>
                </div>
              </div>
            </motion.div>

            {/* ============================================================== */}
            {/* RIGHT CLUSTER: Stacked Technology Cards                       */}
            {/* ============================================================== */}
            <motion.div
              animate={
                shouldReduceMotion
                  ? {}
                  : {
                      y: [0, 3.5, 0],
                    }
              }
              transition={{
                repeat: Infinity,
                duration: 10,
                ease: 'easeInOut',
              }}
              className="flex-1 flex flex-col gap-2 relative"
            >
              {/* Card 1: Medicine Stocks Metric */}
              <div 
                className="w-full h-11 sm:h-12 rounded-2xl px-2.5 py-1.5 flex items-center justify-between backdrop-blur-xl relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(8, 26, 48, 0.75) 0%, rgba(6, 18, 34, 0.65) 100%)',
                  border: '1px solid rgba(143, 200, 245, 0.25)',
                  boxShadow: '0 6px 22px rgba(8, 127, 234, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.14)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#8FC8F5]/8 to-white/10 pointer-events-none" />
                
                <div className="flex items-center gap-2 relative z-10">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#087FEA]/20 border border-[#35BFFF]/35 flex items-center justify-center text-[#35BFFF] shrink-0 shadow-[0_0_8px_rgba(8,127,234,0.35)]">
                    <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#35BFFF]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] sm:text-[8.5px] text-[#A6D2F7] font-medium leading-none">Medicine Stocks</span>
                    <span className="text-[11px] sm:text-xs font-extrabold text-[#F5F8FC] leading-tight mt-0.5">12,480</span>
                  </div>
                </div>

                <div className="px-1.5 py-0.5 rounded-full bg-[#087FEA]/25 border border-[#35BFFF]/45 text-[#35BFFF] text-[8px] font-bold shrink-0 shadow-[0_0_6px_rgba(53,191,255,0.3)]">
                  ↑ +8%
                </div>
              </div>

              {/* Card 2: Medicine Released Metric */}
              <div 
                className="w-full h-11 sm:h-12 rounded-2xl px-2.5 py-1.5 flex items-center justify-between backdrop-blur-xl relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(8, 26, 48, 0.75) 0%, rgba(6, 18, 34, 0.65) 100%)',
                  border: '1px solid rgba(143, 200, 245, 0.25)',
                  boxShadow: '0 6px 22px rgba(8, 127, 234, 0.16), inset 0 1px 1px rgba(255, 255, 255, 0.14)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#8FC8F5]/8 to-white/10 pointer-events-none" />
                
                <div className="flex items-center gap-2 relative z-10">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#087FEA]/20 border border-[#35BFFF]/35 flex items-center justify-center text-[#35BFFF] shrink-0 shadow-[0_0_8px_rgba(8,127,234,0.35)]">
                    <HandHeart className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#35BFFF]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] sm:text-[8.5px] text-[#A6D2F7] font-medium leading-none">Medicine Released</span>
                    <span className="text-[11px] sm:text-xs font-extrabold text-[#F5F8FC] leading-tight mt-0.5">3,265</span>
                  </div>
                </div>

                <div className="px-1.5 py-0.5 rounded-full bg-[#087FEA]/25 border border-[#35BFFF]/45 text-[#35BFFF] text-[8px] font-bold shrink-0 shadow-[0_0_6px_rgba(53,191,255,0.3)]">
                  ↑ +12%
                </div>
              </div>

              {/* Card 3: Active Facilities Metric */}
              <div 
                className="w-full h-11 sm:h-12 rounded-2xl px-2.5 py-1.5 flex items-center justify-between backdrop-blur-xl relative overflow-hidden"
                style={{
                  background: 'linear-gradient(135deg, rgba(8, 26, 48, 0.75) 0%, rgba(6, 18, 34, 0.65) 100%)',
                  border: '1px solid rgba(143, 200, 245, 0.25)',
                  boxShadow: '0 6px 22px rgba(8, 127, 234, 0.16), inset 0 1px 1px rgba(255, 255, 255, 0.14)',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-[#8FC8F5]/8 to-white/10 pointer-events-none" />
                
                <div className="flex items-center gap-2 relative z-10">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-[#087FEA]/20 border border-[#35BFFF]/35 flex items-center justify-center text-[#35BFFF] shrink-0 shadow-[0_0_8px_rgba(8,127,234,0.35)]">
                    <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#35BFFF]" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[8px] sm:text-[8.5px] text-[#A6D2F7] font-medium leading-none">Active Facilities</span>
                    <span className="text-[11px] sm:text-xs font-extrabold text-[#F5F8FC] leading-tight mt-0.5">52</span>
                  </div>
                </div>

                <div className="px-1.5 py-0.5 rounded-full bg-[#087FEA]/25 border border-[#35BFFF]/45 text-[#35BFFF] text-[8px] font-bold shrink-0 shadow-[0_0_6px_rgba(53,191,255,0.3)]">
                  ↑ +4%
                </div>
              </div>
            </motion.div>
          </div>

          {/* FULL-WIDTH CONTINUOUS GLOWING SINE WAVE LINE (Underneath BOTH clusters) */}
          <div className="w-full h-10 relative overflow-visible pointer-events-none mt-1">
            <svg 
              viewBox="0 0 340 45" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-full overflow-visible"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="fullWaveGlow" x1="0" y1="20" x2="340" y2="20" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#087FEA" stopOpacity="0.2" />
                  <stop offset="25%" stopColor="#087FEA" stopOpacity="0.8" />
                  <stop offset="55%" stopColor="#35BFFF" stopOpacity="1" />
                  <stop offset="80%" stopColor="#8FC8F5" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#087FEA" stopOpacity="0.3" />
                </linearGradient>
                <linearGradient id="fullWaveFill" x1="0" y1="0" x2="0" y2="45" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#087FEA" stopOpacity="0.18" />
                  <stop offset="100%" stopColor="#050B14" stopOpacity="0" />
                </linearGradient>
                <filter id="fullWaveBlur" x="-10%" y="-30%" width="120%" height="160%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              
              {/* Area fill */}
              <path 
                d="M 0 36 Q 45 32, 95 24 T 185 16 T 265 26 T 340 12 L 340 45 L 0 45 Z" 
                fill="url(#fullWaveFill)" 
              />
              
              {/* Diffused outer glow */}
              <path 
                d="M 0 36 Q 45 32, 95 24 T 185 16 T 265 26 T 340 12" 
                stroke="#087FEA" 
                strokeWidth="4" 
                strokeLinecap="round" 
                opacity="0.45"
                filter="url(#fullWaveBlur)"
              />

              {/* Crisp illuminated crest */}
              <path 
                d="M 0 36 Q 45 32, 95 24 T 185 16 T 265 26 T 340 12" 
                stroke="url(#fullWaveGlow)" 
                strokeWidth="2.2" 
                strokeLinecap="round" 
              />
            </svg>
          </div>
        </div>
      )}

      {/* 4. MIDDLE TRANSITION: Smooth Atmospheric Gradient Fade */}
      {showCards && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(180deg, rgba(5,11,20,0) 0%, rgba(5,11,20,0) 110px, rgba(5,11,20,0.65) 165px, rgba(5,11,20,0.95) 205px, #050B14 225px, #050B14 100%)'
          }}
        />
      )}
    </div>
  );
}

export default BlueGlassTechBackground;
