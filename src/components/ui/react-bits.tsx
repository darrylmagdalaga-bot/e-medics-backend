import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/utils';

/**
 * React Bits Inspired UI Components (https://reactbits.dev/)
 * Adapted for eMEDICS Mobile-First Healthcare Operations:
 * - Zero heavy WebGL in operational screens
 * - Respects prefers-reduced-motion
 * - Touch-friendly, high-contrast, GPU-accelerated transitions
 */

interface CountUpNumberProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  formatter?: (val: number) => string;
}

/**
 * Animated numeric counter inspired by React Bits <CountUp />
 */
export function CountUpNumber({
  value,
  duration = 650,
  prefix = '',
  suffix = '',
  className,
  formatter,
}: CountUpNumberProps) {
  const prefersReducedMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(value);
  const prevValueRef = useRef<number>(value);

  useEffect(() => {
    if (prefersReducedMotion || duration <= 0) {
      setDisplayValue(value);
      prevValueRef.current = value;
      return;
    }

    const startValue = prevValueRef.current;
    const endValue = Number.isFinite(value) ? value : 0;
    if (startValue === endValue) {
      setDisplayValue(endValue);
      return;
    }

    let animationFrame: number;
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startValue + (endValue - startValue) * eased);
      setDisplayValue(current);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setDisplayValue(endValue);
        prevValueRef.current = endValue;
      }
    };

    animationFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrame);
  }, [value, duration, prefersReducedMotion]);

  const formatted = formatter
    ? formatter(displayValue)
    : displayValue.toLocaleString();

  return (
    <span className={cn('tabular-nums tracking-tight', className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

interface SpotlightCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  spotlightColor?: string;
  interactive?: boolean;
}

/**
 * Interactive card with subtle radial spotlight highlight inspired by React Bits <SpotlightCard />
 */
export function SpotlightCard({
  children,
  className,
  spotlightColor = 'rgba(20, 184, 166, 0.12)',
  interactive = true,
  onClick,
  ...props
}: SpotlightCardProps) {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      onClick={onClick}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card text-card-foreground shadow-xs transition-all duration-200',
        interactive && onClick && 'cursor-pointer hover:shadow-md hover:border-border active:scale-[0.99]',
        className
      )}
      {...props}
    >
      <div
        className="pointer-events-none absolute -inset-px transition-opacity duration-300"
        style={{
          opacity,
          background: `radial-gradient(360px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 75%)`,
        }}
      />
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}

interface AnimatedEntryProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Smooth entrance container inspired by React Bits <AnimatedContent /> / <FadeContent />
 */
export function AnimatedEntry({ children, delay = 0, className }: AnimatedEntryProps) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.26, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface PulseStatusBadgeProps {
  label: string;
  tone?: 'emerald' | 'amber' | 'rose' | 'blue' | 'teal' | 'indigo' | 'slate' | 'purple' | 'violet';
  pulse?: boolean;
  className?: string;
}

/**
 * High-clarity operational status pill with optional live pulse dot
 */
export function PulseStatusBadge({
  label,
  tone = 'slate',
  pulse = false,
  className,
}: PulseStatusBadgeProps) {
  const toneClasses: Record<string, string> = {
    emerald: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/25',
    rose: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/25',
    blue: 'bg-blue-500/12 text-blue-700 dark:text-blue-300 border-blue-500/25',
    teal: 'bg-teal-500/12 text-teal-700 dark:text-teal-300 border-teal-500/25',
    indigo: 'bg-indigo-500/12 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
    slate: 'bg-slate-500/12 text-slate-700 dark:text-slate-300 border-slate-500/25',
    purple: 'bg-purple-500/12 text-purple-700 dark:text-purple-300 border-purple-500/25',
    violet: 'bg-violet-500/12 text-violet-700 dark:text-violet-300 border-violet-500/25',
  };

  const dotClasses: Record<string, string> = {
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
    blue: 'bg-blue-500',
    teal: 'bg-teal-500',
    indigo: 'bg-indigo-500',
    slate: 'bg-slate-500',
    purple: 'bg-purple-500',
    violet: 'bg-violet-500',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border tracking-tight',
        toneClasses[tone] || toneClasses.slate,
        className
      )}
    >
      {pulse && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              'animate-ping absolute inline-flex h-full w-full rounded-full opacity-75',
              dotClasses[tone]
            )}
          />
          <span
            className={cn('relative inline-flex rounded-full h-1.5 w-1.5', dotClasses[tone])}
          />
        </span>
      )}
      {label}
    </span>
  );
}

