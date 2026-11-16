import React from 'react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { Button } from '../ui/button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
}

export function Modal({ isOpen, onClose, title, description, children, footer, maxWidth = 'md' }: ModalProps) {
  const maxWidthClass = {
    sm: 'sm:max-w-sm',
    md: 'sm:max-w-md',
    lg: 'sm:max-w-lg',
    xl: 'sm:max-w-xl',
    '2xl': 'sm:max-w-2xl',
    '3xl': 'sm:max-w-3xl',
    '4xl': 'sm:max-w-4xl',
    '5xl': 'sm:max-w-5xl',
    full: 'sm:max-w-[96vw]',
  }[maxWidth] || 'sm:max-w-md';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "relative bg-card rounded-2xl shadow-2xl border border-border w-full flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden my-auto",
              maxWidthClass
            )}
          >
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-border bg-card sticky top-0 z-10">
              <div className="pr-4">
                <h2 className="text-lg sm:text-xl font-bold text-foreground leading-tight">{title}</h2>
                {description && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{description}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-8 w-8 shrink-0 hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </Button>
            </div>
            
            <div className="p-3.5 sm:p-6 overflow-y-auto flex-1 overscroll-contain">
              {children}
            </div>

            {footer && (
              <div className="px-4 py-3.5 sm:px-6 sm:py-4 border-t border-border bg-muted/30 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 sm:gap-3 rounded-b-2xl sticky bottom-0 z-10 backdrop-blur-md">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
