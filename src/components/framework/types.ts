import { LucideIcon } from 'lucide-react';
import { Column } from '../tables/EnterpriseTable';
import React from 'react';

export interface EntityPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canExport?: boolean;
  canViewDetails?: boolean;
}

export interface EntityApi<T> {
  fetch: () => Promise<T[]>;
  create?: (data: Partial<T>) => Promise<T>;
  update?: (id: string, data: Partial<T>) => Promise<T>;
  delete?: (id: string) => Promise<void>;
}

export interface EntityConfig<T> {
  // Original properties (backward compatible if possible)
  title?: string;
  description?: string;
  
  // Hallucinated properties (now supported)
  entityName?: string;
  entityNamePlural?: string;
  apiEndpoint?: string;
  schema?: any; // Zod schema
  formMaxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | 'full';
  
  icon?: LucideIcon;
  permissions: EntityPermissions;
  columns: Column<T>[];
  defaultSort?: { key: keyof T | string; direction: 'asc' | 'desc' };
  
  // Supports both patterns
  renderForm?: (methodsOrInitialData?: any, onSave?: (data: Partial<T>) => Promise<void>) => React.ReactNode;
  
  detailsMode?: 'drawer' | 'custom-modal';
  renderDetails?: (item: T, helpers?: { onClose: () => void }) => React.ReactNode;
  renderMobileCard?: (item: T, actions: { onView: () => void; onEdit: () => void; onDelete: () => void }) => React.ReactNode;
  customToolbar?: React.ReactNode;
  filterData?: (data: T[]) => T[];
  api?: EntityApi<T>;
}
