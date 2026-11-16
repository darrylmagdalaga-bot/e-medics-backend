import React, { useState } from 'react';
import { ClipboardCheck, X, Clock } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { motion, AnimatePresence } from 'motion/react';

interface CreateSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { locationId: number; remarks: string }) => void;
  isLoading: boolean;
}

export function CreateSessionModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading
}: CreateSessionModalProps) {
  const [remarks, setRemarks] = useState('');
  const [locationId, setLocationId] = useState<number>(1);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      locationId,
      remarks: remarks.trim() || 'Physical Inventory Count Audit'
    });
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card border border-border rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-bold text-foreground">Create Physical Inventory Count</h3>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Warehouse / Storage Location
              </label>
              <select
                value={locationId}
                onChange={(e) => setLocationId(Number(e.target.value))}
                className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm focus:outline-hidden"
              >
                <option value={1}>Location #1 - Main Central Warehouse</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">
                Count Purpose / Remarks
              </label>
              <Input
                placeholder="e.g. Monthly Physical Count Audit - Q4 2026"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div className="p-3 bg-muted/40 rounded-xl text-xs space-y-1 text-muted-foreground border border-border/50">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary" /> Baseline Snapshot Mechanism:
              </p>
              <p>
                All active inventory batches at the selected location will be snapshotted at baseline timestamp.
                The session will start in <strong>Draft</strong> status.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
              <Button 
                type="button"
                variant="outline" 
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
              >
                {isLoading ? 'Initializing...' : 'Initialize Count Session'}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
