import React from 'react';
import { EnterpriseTable, Column } from '../tables/EnterpriseTable';
import { Button } from '../ui/button';
import { MoreHorizontal, Edit, Trash2, Eye } from 'lucide-react';
import { EntityPermissions } from './types';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu'; // Simulating standard radix dropdown

export interface EntityTableProps<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  permissions: EntityPermissions;
  onEditClick: (item: T) => void;
  onDeleteClick: (item: T) => void;
  onViewClick: (item: T) => void;
  renderMobileCard?: (item: T, actions: { onView: () => void; onEdit: () => void; onDelete: () => void }) => React.ReactNode;
}

export function EntityTable<T>({
  data,
  columns,
  isLoading,
  permissions,
  onEditClick,
  onDeleteClick,
  onViewClick,
  renderMobileCard
}: EntityTableProps<T>) {

  // We append an "Actions" column if the user has any permissions (including view details)
  const canView = permissions.canViewDetails !== false;
  const hasActions = canView || permissions.canEdit || permissions.canDelete;

  const tableColumns = [...columns];

  if (hasActions) {
    tableColumns.push({
      header: 'Actions',
      accessorKey: '_actions',
      cell: (row: T) => (
        <div className="flex items-center justify-end gap-1.5">
          {canView && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onViewClick(row)} 
              className="h-9 w-9 text-muted-foreground hover:text-foreground"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </Button>
          )}
          {permissions.canEdit && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onEditClick(row)} 
              className="h-9 w-9 text-muted-foreground hover:text-primary"
              title="Edit"
            >
              <Edit className="w-4 h-4" />
            </Button>
          )}
          {permissions.canDelete && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => onDeleteClick(row)} 
              className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      )
    });
  }

  return (
    <EnterpriseTable 
      data={data}
      columns={tableColumns}
      isLoading={isLoading}
      hideSearch={true}
      onRowClick={canView ? onViewClick : undefined}
      renderMobileCard={
        renderMobileCard
          ? (row: T) => renderMobileCard(row, {
              onView: () => onViewClick(row),
              onEdit: () => onEditClick(row),
              onDelete: () => onDeleteClick(row),
            })
          : undefined
      }
    />
  );
}
