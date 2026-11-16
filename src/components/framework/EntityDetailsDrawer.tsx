import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Info, Clock, User } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../status/StatusBadge';

export interface EntityDetailsDrawerProps<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  item: T | null;
  renderDetails?: (item: T) => React.ReactNode;
}

export function EntityDetailsDrawer<T>({
  isOpen,
  onClose,
  title,
  item,
  renderDetails
}: EntityDetailsDrawerProps<T>) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm"
            onClick={onClose}
          />
          
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full sm:max-w-lg md:max-w-xl h-full bg-card border-l border-border shadow-2xl flex flex-col z-50"
          >
            <div className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-border bg-muted/10 shrink-0">
              <h2 className="text-lg sm:text-xl font-bold text-foreground truncate pr-2">{title}</h2>
              <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full h-10 w-10 shrink-0">
                <X className="w-5 h-5 text-muted-foreground" />
              </Button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pb-20 sm:pb-6">
              {item ? (
                <div className="space-y-6">
                  {/* Custom Details */}
                  {renderDetails ? renderDetails(item) : (
                    <div className="p-4 bg-muted/20 border border-border rounded-xl text-center text-muted-foreground text-sm">
                      No detailed view provided for this entity.
                    </div>
                  )}

                  {/* Standard Audit Info Block */}
                  <div className="mt-8 pt-6 border-t border-border space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Info className="w-4 h-4 text-muted-foreground" /> Audit Information
                    </h3>
                    <div className="grid grid-cols-1 gap-3 p-4 bg-background rounded-xl border border-border shadow-sm">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2"><Clock className="w-3.5 h-3.5" /> Created Date</span>
                        <span className="font-medium text-foreground">
                          {/* Fallback to mock data if standard fields aren't there */}
                          {(item as any).createdAt ? new Date((item as any).createdAt).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-2"><User className="w-3.5 h-3.5" /> Created By</span>
                        <span className="font-medium text-foreground">
                          {(item as any).createdBy || 'System'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-border/50">
                        <span className="text-muted-foreground">Status</span>
                        <StatusBadge 
                          status={(item as any).status === 'Active' || (item as any).status === 'success' ? 'success' : 'neutral'} 
                          label={(item as any).status || 'Active'} 
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No item selected.
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
