import React from 'react';
import { Modal } from '../feedback/Modal';
import { Button } from '../ui/button';
import { AlertTriangle } from 'lucide-react';

export interface EntityFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSave?: () => void;
  isSaving?: boolean;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
}

export function EntityFormDialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  onSave,
  isSaving,
  maxWidth
}: EntityFormDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      maxWidth={maxWidth}
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" form="entity-form" disabled={isSaving} className="w-full sm:w-auto">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <div className="py-1 space-y-4">
        {children}
      </div>
    </Modal>
  );
}

export interface EntityDeleteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  itemName?: string;
  onConfirm: () => void;
  isDeleting?: boolean;
}

export function EntityDeleteDialog({
  isOpen,
  onClose,
  title,
  itemName,
  onConfirm,
  isDeleting
}: EntityDeleteDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isDeleting}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting} className="bg-destructive hover:bg-destructive/90 text-destructive-foreground">
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center justify-center text-center py-4">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <p className="text-foreground font-medium">Are you sure you want to delete this?</p>
        <p className="text-muted-foreground text-sm mt-2">
          {itemName ? (
            <>You are about to delete <strong>{itemName}</strong>. This action cannot be undone.</>
          ) : (
            "This action cannot be undone and will permanently delete this record."
          )}
        </p>
      </div>
    </Modal>
  );
}
