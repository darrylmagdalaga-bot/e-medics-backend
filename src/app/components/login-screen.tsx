'use client';

import React, { useState } from 'react';
import { 
  Lock, 
  User, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  AlertCircle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../api-config';
import { GlassWordmark } from './auth/GlassWordmark';
import { ElectricBlueGlassTile } from './auth/ElectricBlueGlassTile';
import { BlueGlassTechBackground } from './auth/BlueGlassTechBackground';
import { EmedicsLoadingScreen } from './auth/EmedicsLoadingScreen';
import ribbonLogo from '../../assets/emedics_ribbon_logo.png';

interface LoginScreenProps {
  onLogin: (role: any, userId: number, extra?: any) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  // Screen Step: 'welcome' (Part 1 Welcome) or 'login' (Part 2 Premium Login Interface)
  const [step, setStep] = useState<'welcome' | 'login'>('welcome');
  
  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both your Username and Password.');
      return;
    }

    setError('');
    setIsAuthenticating(true);

    try {
      const startTime = Date.now();
      const response = await fetch(`${API_URL}/api/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Bypass-Tunnel-Reminder': 'true' 
        },
        body: JSON.stringify({ username: username.trim(), password })
      });

      const data = await response.json();
      
      // Allow branded loader to display smoothly
      const elapsedTime = Date.now() - startTime;
      const minDisplay = 700;
      if (elapsedTime < minDisplay) {
        await new Promise((r) => setTimeout(r, minDisplay - elapsedTime));
      }

      if (data.success) {
        if (data.barangay) localStorage.setItem('pharma_barangay', data.barangay);
        if (data.locationId) localStorage.setItem('pharma_locationId', String(data.locationId));
        if (data.fullName) localStorage.setItem('pharma_fullName', data.fullName);
        
        setTimeout(() => {
          onLogin(data.role, data.userId, data);
        }, 200);
      } else {
        setIsAuthenticating(false);
        setError(data.message || 'Invalid username or password.');
      }
    } catch (err) {
      setIsAuthenticating(false);
      setError('Connection error. Please check your backend connection.');
    }
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#050B14] text-[#F5F7FA] overflow-x-hidden relative font-sans selection:bg-[#82BDF2] selection:text-[#07111F] flex flex-col">
      
      {/* Premium Blue Glassmorphism Background (Cards shown on welcome, clean atmospheric glow on login) */}
      <BlueGlassTechBackground showCards={step === 'welcome'} />

      {/* Signature eMEDICS Loading Screen during authentication */}
      <EmedicsLoadingScreen active={isAuthenticating} message="Securing your workspace..." />

      <main className="w-full min-h-[100dvh] flex flex-col relative z-10">
        <AnimatePresence mode="wait">
          {step === 'welcome' ? (
            /* ============================================================== */
            /* SCREEN 1: PART 1 WELCOME SCREEN                                */
            /* ============================================================== */
            <motion.div
              key="welcome-step"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="w-full max-w-[340px] sm:max-w-[360px] mx-auto flex flex-col pt-[215px] sm:pt-[230px] pb-8 px-4 relative z-10"
            >
              {/* Content Section: Logo + Headline + Description (Cleanly positioned below tech background) */}
              <div className="flex flex-col items-start w-full">
                {/* Official Glossy Abstract Blue Ribbon Logo */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: 6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                  className="mb-4 sm:mb-5 flex items-center justify-start"
                >
                  <div className="relative">
                    <div className="absolute -inset-3 rounded-full bg-radial from-[#087FEA]/30 to-transparent blur-xl pointer-events-none" />
                    <img
                      src={ribbonLogo}
                      alt="eMEDICS Official Logo"
                      className="relative z-10 w-[72px] h-[72px] sm:w-[80px] sm:h-[80px] object-contain drop-shadow-[0_10px_25px_rgba(8,127,234,0.55)] select-none pointer-events-none"
                      draggable={false}
                    />
                  </div>
                </motion.div>

                {/* Main Headline */}
                <h1 className="text-[38px] sm:text-[44px] font-extrabold tracking-tight text-[#F5F7FA] leading-[1.08] mb-3.5 sm:mb-4 text-left">
                  Smarter<br />
                  Healthcare<br />
                  <span className="bg-gradient-to-r from-[#82BDF2] to-[#159BFA] bg-clip-text text-transparent">
                    Operations.
                  </span>
                </h1>

                {/* Description Text */}
                <p className="text-[#AAB6C5] text-[10.5px] sm:text-[11.5px] font-semibold uppercase tracking-[0.15em] leading-relaxed max-w-[310px] text-left">
                  A unified platform for clinical care, pharmacy, inventory, and health services.
                </p>
              </div>

              {/* Bottom Action Buttons */}
              <div className="space-y-2.5 w-full mt-6 sm:mt-7 md:mt-8 pt-1">
                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setStep('login')}
                  className="w-full h-[46px] sm:h-12 rounded-full bg-gradient-to-r from-[#F5F7FA] via-[#D0E7FC] to-[#82BDF2] hover:brightness-105 active:brightness-95 text-[#07111F] font-semibold text-sm sm:text-[14px] tracking-wide shadow-[0_4px_16px_rgba(21,155,250,0.22)] flex items-center justify-center transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82BDF2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050B14]"
                >
                  Get Started
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => setStep('login')}
                  className="w-full h-[46px] sm:h-12 rounded-full bg-transparent hover:bg-[#263F5C]/25 border border-[#263F5C] hover:border-[#82BDF2]/50 text-[#F5F7FA] font-medium text-sm sm:text-[14px] tracking-wide transition-all cursor-pointer flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82BDF2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050B14]"
                >
                  I Have an Account
                </motion.button>
              </div>
            </motion.div>
          ) : (
            /* ============================================================== */
            /* SCREEN 2: PART 2 PREMIUM LOGIN INTERFACE & GLASS TYPOGRAPHY    */
            /* ============================================================== */
            <motion.div
              key="login-step"
              initial={{ opacity: 0, scale: 0.98, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -12 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
              className="w-full max-w-[340px] sm:max-w-[360px] mx-auto min-h-[100dvh] flex flex-col pt-3 sm:pt-5 pb-6 sm:pb-8 px-4 relative z-10"
            >
              {/* TOP AREA: Pill Back Button Matching Reference */}
              <div className="flex items-center justify-start mb-1 sm:mb-2">
                <button
                  type="button"
                  onClick={() => {
                    setError('');
                    setStep('welcome');
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-[#07111F]/70 border border-[#263F5C] text-[#F5F7FA] hover:text-white hover:bg-[#263F5C]/40 hover:border-[#82BDF2]/50 transition-all inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82BDF2]"
                  aria-label="Back to Welcome Screen"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                  <span>Back</span>
                </button>
              </div>

              {/* CENTER CONTENT: Emblem + Glass Wordmark + Inputs */}
              <div className="flex flex-col items-center w-full mt-1 sm:mt-2">
                
                {/* 1. Official Emblem inside Illuminated Tilted Glass Tile with Electric Blue Glow & Particles */}
                <div className="flex items-center justify-center -mt-1 sm:mt-0 mb-4 sm:mb-5">
                  <ElectricBlueGlassTile logoSrc={ribbonLogo} />
                </div>

                {/* 2. Glass Typography eMEDICS Wordmark with Moving Reflection */}
                <div className="flex flex-col items-center mt-2 sm:mt-3 mb-6 sm:mb-7 w-fit mx-auto">
                  {/* 2. Glass Typography eMEDICS Wordmark (Enlarged to match subtitle width) */}
                  <div className="flex justify-center items-center mb-1.5 sm:mb-2">
                    <GlassWordmark
                      size="lg"
                      showSubtitle={false}
                      animated={true}
                      className="items-center text-center justify-center"
                    />
                  </div>

                  {/* 3. Supporting Description (Aligned to eMEDICS width) */}
                  <p className="text-[#AAB6C5] text-[11px] sm:text-[12.2px] md:text-[12.8px] font-normal tracking-[0.015em] sm:tracking-[0.022em] leading-normal text-center whitespace-nowrap">
                    Electronic Medical &amp; Integrated Care System
                  </p>
                </div>

                {/* Error Banner */}
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="w-full mb-4 p-3 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-rose-200 text-xs font-medium flex items-center gap-2.5"
                    role="alert"
                  >
                    <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}

                {/* 4. Login Form with Rounded Pill Input Fields */}
                <form onSubmit={handleSubmit} className="w-full space-y-3">
                  {/* Username Input Field */}
                  <div className="relative group w-full">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#AAB6C5] group-focus-within:text-[#82BDF2] transition-colors pointer-events-none">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Username"
                      required
                      autoComplete="username"
                      disabled={isAuthenticating}
                      className="w-full h-12 pl-11 pr-4 rounded-full bg-[#07111F]/70 border border-[#263F5C] text-[#F5F7FA] placeholder:text-[#AAB6C5]/50 text-sm font-medium focus:outline-none focus:border-[#82BDF2] focus:ring-1 focus:ring-[#82BDF2]/40 hover:border-[#263F5C]/80 transition-all shadow-inner"
                    />
                  </div>

                  {/* Password Input Field */}
                  <div className="relative group w-full">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#AAB6C5] group-focus-within:text-[#82BDF2] transition-colors pointer-events-none">
                      <Lock className="w-4 h-4" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      autoComplete="current-password"
                      disabled={isAuthenticating}
                      className="w-full h-12 pl-11 pr-11 rounded-full bg-[#07111F]/70 border border-[#263F5C] text-[#F5F7FA] placeholder:text-[#AAB6C5]/50 text-sm font-medium focus:outline-none focus:border-[#82BDF2] focus:ring-1 focus:ring-[#82BDF2]/40 hover:border-[#263F5C]/80 transition-all shadow-inner"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-[#AAB6C5] hover:text-[#F5F7FA] transition-colors cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Primary Login Button — Log In Securely */}
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isAuthenticating}
                    className="w-full h-12 mt-4 rounded-full bg-gradient-to-r from-[#F5F7FA] via-[#D0E7FC] to-[#82BDF2] hover:brightness-105 active:brightness-95 text-[#07111F] font-bold text-sm sm:text-base tracking-wide shadow-[0_6px_22px_rgba(21,155,250,0.32)] flex items-center justify-center transition-all cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#82BDF2] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050B14]"
                  >
                    {isAuthenticating ? 'Logging in...' : 'Log In Securely'}
                  </motion.button>
                </form>
              </div>

              {/* Bottom Spacer for balance */}
              <div className="pb-2" aria-hidden="true" />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default LoginScreen;
