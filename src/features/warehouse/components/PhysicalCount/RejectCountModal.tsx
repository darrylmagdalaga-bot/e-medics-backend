import React, { useState } from 'react';
import { AlertOctagon, X } from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { motion, AnimatePresence } from 'motion/react';

interface RejectCountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}

export function RejectCountModal({
  isOpen,
  onClose,
  onConfirm,
  isLoading
}: RejectCountModalProps) {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    onConfirm(reason.trim());
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
          className="bg-card border border-border rounded-2xl w-full max-w-md p-6 space-y-4 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between pb-3 border-b border-border text-rose-600">
            <div className="flex items-center gap-2">
              <AlertOctagon className="w-5 h-5" />
              <h3 className="text-lg font-bold text-foreground">Reject Count Session</h3>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose}
              className="rounded-full text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">
              Document the audit finding or recount instructions. The session will revert to <strong>In Progress</strong> for the counting team to correct.
            </p>

            <textarea
              rows={3}
              placeholder="e.g. Recount required on Paracetamol batch 2026-B1; discrepancy reason requires verification with pharmacy dispatch..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full text-xs rounded-md border border-border bg-background p-2.5 focus:outline-hidden"
              required
            />

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
                variant="destructive"
                disabled={isLoading || !reason.trim()}
              >
                {isLoading ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
