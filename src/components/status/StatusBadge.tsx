import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';
import { CheckCircle2, AlertCircle, Clock, XCircle, AlertTriangle, Info } from 'lucide-react';

export type StatusType = 'success' | 'warning' | 'error' | 'info' | 'pending' | 'neutral';

export interface StatusBadgeProps {
  status: StatusType;
  label: string;
  showIcon?: boolean;
  className?: string;
  animate?: boolean;
}

export function StatusBadge({ status, label, showIcon = true, className, animate = false }: StatusBadgeProps) {
  const config = {
    success: {
      bg: 'bg-emerald-500/15',
      text: 'text-emerald-700 dark:text-emerald-400',
      border: 'border-emerald-500/30',
      icon: CheckCircle2,
    },
    warning: {
      bg: 'bg-amber-500/15',
      text: 'text-amber-700 dark:text-amber-400',
      border: 'border-amber-500/30',
      icon: AlertTriangle,
    },
    error: {
      bg: 'bg-destructive/15',
      text: 'text-destructive',
      border: 'border-destructive/30',
      icon: XCircle,
    },
    info: {
      bg: 'bg-blue-500/15',
      text: 'text-blue-700 dark:text-blue-400',
      border: 'border-blue-500/30',
      icon: Info,
    },
    pending: {
      bg: 'bg-purple-500/15',
      text: 'text-purple-700 dark:text-purple-400',
      border: 'border-purple-500/30',
      icon: Clock,
    },
    neutral: {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      border: 'border-border/50',
      icon: AlertCircle, // Or just a dot
    }
  };

  const { bg, text, border, icon: Icon } = config[status];

  const content = (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border", bg, text, border, className)}>
      {showIcon && <Icon className="w-3.5 h-3.5" />}
      {label}
    </span>
  );

  if (animate) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.2 }}>
        {content}
      </motion.div>
    );
  }

  return content;
}
