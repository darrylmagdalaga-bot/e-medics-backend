import React from 'react';
import { Card, CardContent } from '../../ui/card';
import { cn } from '../../../lib/utils';
import { motion } from 'motion/react';

export interface KpiCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  delay?: number;
  className?: string;
}

export function KpiCard({
  label,
  value,
  subtitle,
  trend,
  trendDirection = 'neutral',
  delay = 0,
  className
}: KpiCardProps) {
  
  let trendColor = "text-muted-foreground";
  if (trendDirection === 'up') trendColor = "text-emerald-500";
  if (trendDirection === 'down') trendColor = "text-destructive";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className={cn("rounded-[16px] border-border/50 bg-background/50 backdrop-blur-md shadow-sm", className)}>
        <CardContent className="p-4 sm:p-6 flex flex-col justify-between h-full">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <div className="flex items-baseline gap-2 mt-1">
              <h3 className="text-2xl font-bold tracking-tight text-foreground">{value}</h3>
              {trend && (
                <span className={cn("text-xs font-semibold", trendColor)}>
                  {trend}
                </span>
              )}
            </div>
          </div>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-4">{subtitle}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
