import React from 'react';
import { cn } from '../../../lib/utils';
import { motion } from 'motion/react';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
  animate?: boolean;
}

export function PageContainer({ children, className, animate = true }: PageContainerProps) {
  const content = (
    <div className={cn("max-w-7xl mx-auto p-4 lg:p-8 w-full", className)}>
      {children}
    </div>
  );

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full"
      >
        {content}
      </motion.div>
    );
  }

  return content;
}
