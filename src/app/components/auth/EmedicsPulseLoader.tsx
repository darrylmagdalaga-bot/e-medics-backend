'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Activity, ShieldCheck, CheckCircle2 } from 'lucide-react';

export interface EmedicsPulseLoaderProps {
  active: boolean;
  message?: string;
  stage?: 'connecting' | 'verifying' | 'preparing' | 'complete';
  fullscreen?: boolean;
}

export function EmedicsPulseLoader({
  active,
  message,
  stage = 'connecting',
  fullscreen = true,
}: EmedicsPulseLoaderProps) {
  const [currentStageIndex, setCurrentStageIndex] = useState(0);

  const defaultMessages = [
    { title: 'Connecting Healthcare Services', subtitle: 'Catbalogan City Health Network' },
    { title: 'Verifying Authorization', subtitle: 'Validating institutional credentials' },
    { title: 'Preparing Your Workspace', subtitle: 'Loading role-based clinical modules' },
    { title: 'Session Ready', subtitle: 'Redirecting to your dashboard' }
  ];

  useEffect(() => {
    if (!active) {
      setCurrentStageIndex(0);
      return;
    }

    const interval = setInterval(() => {
      setCurrentStageIndex((prev) => (prev < defaultMessages.length - 2 ? prev + 1 : prev));
    }, 900);

    return () => clearInterval(interval);
  }, [active]);

  const activeMsg = message ? { title: message, subtitle: 'City Health Office System' } : defaultMessages[currentStageIndex];

  if (!active) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
        className={
          fullscreen
            ? 'fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-xl text-white select-none px-4'
            : 'relative py-12 flex flex-col items-center justify-center text-white select-none'
        }
        role="status"
        aria-live="polite"
      >
        {/* Ambient Glow */}
        <div className="absolute w-72 h-72 sm:w-96 sm:h-96 rounded-full bg-gradient-to-tr from-blue-600/20 via-cyan-500/20 to-purple-600/20 blur-3xl pointer-events-none -z-10 animate-pulse" />

        <div className="relative flex flex-col items-center max-w-sm w-full mx-auto text-center">
          {/* Animated Medical Cross with Light Trace & ECG Heartbeat */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-6 flex items-center justify-center">
            {/* Outer Rotating Subtle Orbital Ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 8, ease: 'linear' }}
              className="absolute inset-0 rounded-full border border-dashed border-cyan-500/30"
            />

            {/* Glowing Pulse Ring */}
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.7, 0.3] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              className="absolute inset-2 rounded-3xl bg-blue-500/10 border border-blue-400/30 blur-sm"
            />

            {/* Central Medical Cross Shield */}
            <motion.div
              animate={{ scale: [1, 1.04, 1] }}
              transition={{ repeat: Infinity, duration: 1.6, ease: 'easeInOut' }}
              className="relative w-20 h-20 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-blue-400/40 shadow-[0_0_30px_rgba(36,91,255,0.35)] flex items-center justify-center overflow-hidden"
            >
              {/* Dynamic light trace background sweep */}
              <motion.div
                animate={{ x: ['-100%', '200%'] }}
                transition={{ repeat: Infinity, duration: 2.2, ease: 'easeInOut' }}
                className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent skew-x-12 pointer-events-none"
              />

              {/* Medical Cross SVG */}
              <svg
                viewBox="0 0 48 48"
                className="w-12 h-12 text-cyan-400 drop-shadow-[0_0_12px_rgba(54,221,245,0.7)]"
                fill="none"
              >
                {/* Horizontal Bar */}
                <rect x="8" y="18" width="32" height="12" rx="3" fill="currentColor" fillOpacity="0.85" />
                {/* Vertical Bar */}
                <rect x="18" y="8" width="12" height="32" rx="3" fill="currentColor" fillOpacity="0.85" />
                {/* ECG Heartbeat Line running through center */}
                <path
                  d="M10 24h7l2.5-5 3.5 10 3-7 2 2h10"
                  stroke="#ffffff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          </div>

          {/* eMEDICS Wordmark */}
          <div className="flex items-center gap-1.5 justify-center mb-1">
            <span className="text-2xl sm:text-3xl font-black tracking-tight text-blue-400">e</span>
            <span className="text-2xl sm:text-3xl font-black tracking-wider text-white">MEDICS</span>
          </div>

          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400 mb-6">
            City Health Department • Catbalogan
          </p>

          {/* Dynamic Stage Message */}
          <div className="min-h-[52px] flex flex-col items-center justify-center">
            <motion.div
              key={activeMsg.title}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <h3 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight">
                {activeMsg.title}
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {activeMsg.subtitle}
              </p>
            </motion.div>
          </div>

          {/* Precision Flow Progress Bar */}
          <div className="w-48 sm:w-56 h-1.5 bg-slate-800/80 rounded-full mt-5 overflow-hidden border border-slate-700/50">
            <motion.div
              animate={{
                x: ['-100%', '100%']
              }}
              transition={{
                repeat: Infinity,
                duration: 1.4,
                ease: 'easeInOut'
              }}
              className="h-full w-24 bg-gradient-to-r from-blue-500 via-cyan-400 to-violet-500 rounded-full shadow-[0_0_10px_rgba(54,221,245,0.6)]"
            />
          </div>

          {/* Security Assurance Tag */}
          <div className="mt-6 flex items-center gap-1.5 text-[10px] font-semibold text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Encrypted Institutional Healthcare Channel</span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
