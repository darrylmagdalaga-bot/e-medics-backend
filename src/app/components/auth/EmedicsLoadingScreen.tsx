'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GlassWordmark } from './GlassWordmark';
import { MedicalGlowSymbol } from './MedicalGlowSymbol';

interface EmedicsLoadingScreenProps {
  active: boolean;
  message?: string;
}

export function EmedicsLoadingScreen({
  active,
  message = 'Securing your session...',
}: EmedicsLoadingScreenProps) {
  if (!active) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#05090F] text-[#F4F7FC] px-6 select-none"
        role="status"
        aria-live="polite"
      >
        {/* Ambient background glow */}
        <div className="absolute w-80 h-80 rounded-full bg-[#8FC7F5]/15 blur-3xl pointer-events-none animate-pulse" />

        <div className="relative z-10 flex flex-col items-center text-center max-w-sm">
          {/* Illuminated Official eMEDICS Logo Emblem */}
          <motion.div
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.92, 1, 0.92],
            }}
            transition={{
              repeat: Infinity,
              duration: 2,
              ease: 'easeInOut',
            }}
            className="mb-8"
          >
            <MedicalGlowSymbol size="lg" />
          </motion.div>

          {/* Glass Typography eMEDICS Wordmark with Moving Reflection */}
          <GlassWordmark size="md" showSubtitle={true} className="items-center text-center mb-6" />

          {/* Status Message */}
          <p className="text-sm font-medium text-[#8FC7F5]/90 tracking-wide mb-6">
            {message}
          </p>

          {/* Minimal Precision Progress Bar */}
          <div className="w-44 h-1 bg-[#0A1420] rounded-full overflow-hidden border border-[#8FC7F5]/20">
            <motion.div
              animate={{
                x: ['-100%', '100%'],
              }}
              transition={{
                repeat: Infinity,
                duration: 1.2,
                ease: 'easeInOut',
              }}
              className="h-full w-20 bg-gradient-to-r from-transparent via-[#8FC7F5] to-transparent rounded-full shadow-[0_0_10px_#8FC7F5]"
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default EmedicsLoadingScreen;
