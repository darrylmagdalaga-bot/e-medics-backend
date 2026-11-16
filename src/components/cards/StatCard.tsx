import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { cn } from '../../../lib/utils';
import { LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'neutral';
  colorClass?: string;
  gradientClass?: string;
  iconColorClass?: string;
  delay?: number;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendDirection = 'neutral',
  colorClass = "text-primary",
  gradientClass = "from-primary/20 to-blue-500/10",
  iconColorClass = "text-primary",
  delay = 0
}: StatCardProps) {
  
  let trendColor = "text-muted-foreground";
  if (trendDirection === 'up') trendColor = "text-emerald-500";
  if (trendDirection === 'down') trendColor = "text-destructive";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
    >
      <Card className="rounded-[16px] border-border/50 bg-card/60 backdrop-blur-xl shadow-sm hover:shadow-lg transition-all overflow-hidden relative">
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
          <Icon className="w-24 h-24 transform translate-x-4 -translate-y-4" />
        </div>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <div className={cn("w-10 h-10 rounded-full flex items-center justify-center bg-gradient-to-br shadow-inner", gradientClass)}>
            <Icon className={cn("h-5 w-5", iconColorClass)} />
          </div>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="text-3xl font-extrabold tracking-tight text-foreground">{value}</div>
          {trend && (
            <div className="flex items-center mt-2 gap-2">
              <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full bg-background/50", trendColor, colorClass && trendDirection === 'neutral' ? colorClass : '')}>
                {trend}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
