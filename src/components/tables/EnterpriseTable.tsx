import React, { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, Filter } from 'lucide-react';

export interface Column<T> {
  id?: string;
  header: string;
  accessorKey: keyof T | string;
  cell?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

export interface EnterpriseTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  isLoading?: boolean;
  emptyMessage?: string;
  itemsPerPage?: number;
  renderMobileCard?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  hideSearch?: boolean;
}

export function EnterpriseTable<T>({ 
  data, 
  columns, 
  searchPlaceholder = "Search...", 
  onSearch,
  isLoading,
  emptyMessage = "No results found.",
  itemsPerPage = 10,
  renderMobileCard,
  onRowClick,
  hideSearch = false
}: EnterpriseTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
    if (onSearch) onSearch(e.target.value);
  };

  // Apply local search if onSearch is not provided
  const searchedData = !onSearch && searchTerm.trim()
    ? data.filter(row => JSON.stringify(row).toLowerCase().includes(searchTerm.toLowerCase()))
    : data;

  const totalPages = Math.max(1, Math.ceil(searchedData.length / itemsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const currentData = searchedData.slice((safePage - 1) * itemsPerPage, safePage * itemsPerPage);

  // Separate data columns from the _actions column for default mobile card rendering
  const dataColumns = columns.filter(col => col.accessorKey !== '_actions');
  const actionsColumn = columns.find(col => col.accessorKey === '_actions');

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      {!hideSearch && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder={searchPlaceholder} 
              value={searchTerm}
              onChange={handleSearch}
              className="pl-9 bg-background shadow-sm min-h-[42px]"
            />
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <Filter className="w-4 h-4" /> Filter
            </Button>
          </div>
        </div>
      )}

      {/* Mobile Cards View (< md) */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="p-4 rounded-xl border border-border/60 bg-card shadow-sm space-y-3 animate-pulse">
              <div className="h-5 bg-muted rounded w-2/3" />
              <div className="h-4 bg-muted rounded w-1/2" />
              <div className="grid grid-cols-2 gap-2 pt-2">
                <div className="h-8 bg-muted rounded" />
                <div className="h-8 bg-muted rounded" />
              </div>
            </div>
          ))
        ) : currentData.length === 0 ? (
          <div className="p-8 rounded-xl border border-border/50 bg-card text-center text-muted-foreground text-sm">
            {emptyMessage}
          </div>
        ) : (
          currentData.map((row, rowIdx) => (
            <div key={rowIdx}>
              {renderMobileCard ? (
                renderMobileCard(row)
              ) : (
                <div 
                  onClick={() => onRowClick && onRowClick(row)}
                  className={`p-4 rounded-xl border border-border/60 bg-card shadow-sm space-y-3 transition-colors ${onRowClick ? 'active:bg-muted/30 cursor-pointer' : ''}`}
                >
                  {/* Primary Header from First 2 Columns */}
                  <div className="flex items-start justify-between gap-3 pb-2.5 border-b border-border/50">
                    <div className="min-w-0 flex-1">
                      {dataColumns[0] && (
                        <div className="text-sm font-semibold text-foreground break-words">
                          {dataColumns[0].cell ? dataColumns[0].cell(row) : (row[dataColumns[0].accessorKey as keyof T] as React.ReactNode)}
                        </div>
                      )}
                    </div>
                    {dataColumns[1] && (
                      <div className="shrink-0 text-right">
                        {dataColumns[1].cell ? dataColumns[1].cell(row) : (row[dataColumns[1].accessorKey as keyof T] as React.ReactNode)}
                      </div>
                    )}
                  </div>

                  {/* Remaining Fields Grid */}
                  {dataColumns.length > 2 && (
                    <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-xs">
                      {dataColumns.slice(2).map((col, colIdx) => (
                        <div key={colIdx} className="min-w-0">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block mb-0.5">
                            {col.header}
                          </span>
                          <div className="text-foreground font-medium break-words">
                            {col.cell ? col.cell(row) : (row[col.accessorKey as keyof T] as React.ReactNode)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Actions Bar */}
                  {actionsColumn && actionsColumn.cell && (
                    <div 
                      className="pt-2.5 border-t border-border/50 flex items-center justify-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {actionsColumn.cell(row)}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Table Area (>= md) */}
      <div className="hidden md:block rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                {columns.map((col, idx) => (
                  <TableHead key={idx} className="font-semibold text-foreground whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {col.header}
                      {col.sortable && <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground cursor-pointer hover:text-foreground" />}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <TableRow key={idx}>
                    {columns.map((_, colIdx) => (
                      <TableCell key={colIdx}>
                        <div className="h-5 bg-muted animate-pulse rounded"></div>
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : currentData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                currentData.map((row, rowIdx) => (
                  <TableRow 
                    key={rowIdx} 
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`hover:bg-muted/20 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                  >
                    {columns.map((col, colIdx) => (
                      <TableCell 
                        key={colIdx} 
                        className="py-3"
                        onClick={col.accessorKey === '_actions' ? (e) => e.stopPropagation() : undefined}
                      >
                        {col.cell ? col.cell(row) : (row[col.accessorKey as keyof T] as React.ReactNode)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination */}
      {!isLoading && searchedData.length > 0 && (
        <div className="flex flex-col xs:flex-row items-center justify-between gap-3 text-xs sm:text-sm text-muted-foreground pt-1">
          <div>
            Showing {((safePage - 1) * itemsPerPage) + 1} to {Math.min(safePage * itemsPerPage, searchedData.length)} of {searchedData.length} results
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="icon" 
              className="w-9 h-9 rounded-full"
              disabled={safePage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="px-2 font-medium text-foreground">{safePage} / {totalPages}</span>
            <Button 
              variant="outline" 
              size="icon" 
              className="w-9 h-9 rounded-full"
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
