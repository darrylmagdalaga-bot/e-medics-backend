import React from 'react';
import { cn } from '../../../lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface TrendIndicatorProps {
  value: number;
  format?: 'percentage' | 'number' | 'currency';
  prefix?: string;
  suffix?: string;
  className?: string;
}

export function TrendIndicator({ value, format = 'percentage', prefix = '', suffix = '', className }: TrendIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  
  let formattedValue = Math.abs(value).toString();
  if (format === 'percentage') {
    suffix = suffix || '%';
  }

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;
  
  return (
    <span className={cn(
      "inline-flex items-center gap-1 font-medium",
      isPositive ? "text-emerald-500" : isNegative ? "text-destructive" : "text-muted-foreground",
      className
    )}>
      <Icon className="w-4 h-4" />
      <span>{prefix}{formattedValue}{suffix}</span>
    </span>
  );
}
