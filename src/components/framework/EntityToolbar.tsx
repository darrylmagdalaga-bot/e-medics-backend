import React from 'react';
import { Search, Plus, Download } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export interface EntityToolbarProps {
  title: string;
  description?: string;
  canCreate?: boolean;
  canExport?: boolean;
  onSearch: (query: string) => void;
  onCreateClick: () => void;
  onExportClick?: () => void;
  searchPlaceholder?: string;
}

export function EntityToolbar({
  title,
  description,
  canCreate = true,
  canExport = false,
  onSearch,
  onCreateClick,
  onExportClick,
  searchPlaceholder = "Search..."
}: EntityToolbarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-5">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{description}</p>}
      </div>

      <div className="flex flex-wrap sm:flex-nowrap items-center justify-end gap-2 sm:gap-2.5 w-full sm:w-auto">
        <div className="relative flex-1 min-w-[160px] sm:w-64 sm:flex-initial">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder={searchPlaceholder} 
            onChange={(e) => onSearch(e.target.value)}
            className="pl-9 h-10 bg-background shadow-sm rounded-full text-sm"
          />
        </div>
        
        {(canExport || canCreate) && (
          <div className="flex items-center gap-2 shrink-0">
            {canExport && (
              <Button
                variant="outline"
                className="h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap shrink-0"
                onClick={onExportClick}
              >
                <Download className="w-4 h-4 mr-1.5" />
                Export
              </Button>
            )}
            {canCreate && (
              <Button
                className="h-10 px-4 rounded-full text-sm font-medium whitespace-nowrap shrink-0"
                onClick={onCreateClick}
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Create New
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
