import React, { useMemo, useState } from 'react';
import {
  Package,
  Search,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Calendar,
  X,
  RefreshCw,
  Boxes,
  Send,
  Info,
} from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { BarangayStockLot } from '../types';

interface BarangayInventoryProps {
  inventory: BarangayStockLot[];
  onRefresh: () => void;
  isLoading: boolean;
  onNavigateRequestRestock?: () => void;
}

export function BarangayInventory({
  inventory,
  onRefresh,
  isLoading,
  onNavigateRequestRestock,
}: BarangayInventoryProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'expiry' | 'name' | 'stockDesc' | 'stockAsc'>('expiry');
  const [selectedLot, setSelectedLot] = useState<BarangayStockLot | null>(null);

  const filteredLots = useMemo(
    () =>
      inventory.filter((lot) => {
        const s = search.toLowerCase();
        const matchSearch =
          lot.ProductName.toLowerCase().includes(s) ||
          (lot.GenericName || '').toLowerCase().includes(s) ||
          lot.LotNumber.toLowerCase().includes(s);
        const matchStatus = statusFilter === 'ALL' || lot.ExpiryStatus === statusFilter;
        return matchSearch && matchStatus;
      }),
    [inventory, search, statusFilter]
  );

  const sortedLots = useMemo(
    () =>
      [...filteredLots].sort((a, b) => {
        if (sortBy === 'expiry') {
          return new Date(a.ExpiryDate).getTime() - new Date(b.ExpiryDate).getTime();
        }
        if (sortBy === 'name') {
          return a.ProductName.localeCompare(b.ProductName);
        }
        if (sortBy === 'stockDesc') {
          return b.Quantity - a.Quantity;
        }
        if (sortBy === 'stockAsc') {
          return a.Quantity - b.Quantity;
        }
        return 0;
      }),
    [filteredLots, sortBy]
  );

  const totalFilteredUnits = sortedLots.reduce((sum, item) => sum + item.Quantity, 0);

  const overviewStats = useMemo(() => {
    const active = inventory.filter((l) => l.Quantity > 0 && l.ExpiryStatus !== 'Expired');
    const totalUnits = active.reduce((s, l) => s + l.Quantity, 0);
    const watchCount = inventory.filter(
      (l) => l.Quantity > 0 && (l.ExpiryStatus === 'Expired' || l.ExpiryStatus === 'Critical' || l.ExpiryStatus === 'Warning')
    ).length;
    const lowLots = active.filter((l) => l.Quantity <= ((l as any).ReorderLevel || 20)).length;
    return { totalUnits, activeCount: active.length, watchCount, lowLots };
  }, [inventory]);

  const getStatusBadge = (status: string, days: number) => {
    switch (status) {
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            <AlertOctagon className="w-3 h-3" /> Expired ({days}d)
          </span>
        );
      case 'Critical':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <AlertTriangle className="w-3 h-3" /> Critical ({days}d)
          </span>
        );
      case 'Warning':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-yellow-500/15 text-yellow-800 dark:text-yellow-300 border border-yellow-500/30">
            <Clock className="w-3 h-3" /> Near Expiry ({days}d)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Good ({days}d)
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-primary" />
            Station Medicine Depository
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Active batch-level stock held at this station in FEFO expiration sequence
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {onNavigateRequestRestock && (
            <Button
              type="button"
              onClick={onNavigateRequestRestock}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold h-9 rounded-xl shadow-xs"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Request Restock
            </Button>
          )}
          <Button
            type="button"
            onClick={onRefresh}
            variant="outline"
            size="sm"
            disabled={isLoading}
            className="text-xs font-semibold h-9 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Stock
          </Button>
        </div>
      </div>

      {/* Compact Inventory Overview Strip */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4">
        <Card className="p-3 sm:p-4 rounded-2xl border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Total Stock</span>
            <Boxes className="w-4 h-4 text-primary hidden sm:block" />
          </div>
          <p className="text-lg sm:text-xl font-black text-foreground mt-1 tabular-nums">{overviewStats.totalUnits}</p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">{overviewStats.activeCount} usable lots</p>
        </Card>

        <Card className="p-3 sm:p-4 rounded-2xl border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Low-Stock Lots</span>
            <AlertTriangle className="w-4 h-4 text-amber-500 hidden sm:block" />
          </div>
          <p className="text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400 mt-1 tabular-nums">{overviewStats.lowLots}</p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">At or below reorder level</p>
        </Card>

        <Card className="p-3 sm:p-4 rounded-2xl border-border bg-card shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-muted-foreground">Expiry Watch</span>
            <Clock className="w-4 h-4 text-rose-500 hidden sm:block" />
          </div>
          <p className="text-lg sm:text-xl font-black text-rose-600 dark:text-rose-400 mt-1 tabular-nums">{overviewStats.watchCount}</p>
          <p className="text-[10px] sm:text-[11px] text-muted-foreground truncate">Warning, critical or expired</p>
        </Card>
      </div>

      {/* Search, Sort, and Status Filter Controls */}
      <Card className="rounded-2xl border-border bg-card shadow-xs p-3.5 sm:p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-2.5 sm:gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Medicine, Generic Name, or Lot #..."
              className="pl-9 pr-9 text-xs rounded-xl h-10 border-border"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="w-full md:w-auto flex items-center gap-2">
            <span className="text-[11px] font-bold text-muted-foreground whitespace-nowrap hidden sm:inline">Sort:</span>
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="w-full md:w-48 h-10 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              aria-label="Sort inventory"
            >
              <option value="expiry">FEFO (Earliest Expiry)</option>
              <option value="name">Medicine Name (A-Z)</option>
              <option value="stockDesc">Stock: High to Low</option>
              <option value="stockAsc">Stock: Low to High</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/60">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar flex-1">
            {['ALL', 'Good', 'Warning', 'Critical', 'Expired'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[34px] ${
                  statusFilter === st
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <span className="text-[11px] text-muted-foreground font-medium shrink-0 pl-2">
            {sortedLots.length} lots ({totalFilteredUnits} units)
          </span>
        </div>
      </Card>

      {/* MOBILE VIEW (< 768px): Compact Medicine Cards */}
      <div className="block md:hidden space-y-3">
        {sortedLots.length === 0 ? (
          <Card className="rounded-2xl border-border bg-card shadow-xs p-8 text-center text-muted-foreground">
            <Package className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-bold text-sm text-foreground">No medicine stock found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {search || statusFilter !== 'ALL'
                ? 'No lots match your current filters.'
                : 'Stock will appear once inbound warehouse shipments are received.'}
            </p>
          </Card>
        ) : (
          sortedLots.map((lot) => (
            <Card
              key={lot.StockID}
              onClick={() => setSelectedLot(lot)}
              className="rounded-2xl border-border bg-card shadow-xs hover:border-primary/40 transition-all p-4 space-y-3 cursor-pointer"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5 flex-1 min-w-0">
                  <h3 className="font-black text-sm text-foreground leading-snug break-words">
                    {lot.ProductName}
                  </h3>
                  {lot.GenericName && (
                    <p className="text-xs text-muted-foreground font-medium truncate">
                      {lot.GenericName}
                    </p>
                  )}
                  {(lot.Form || lot.Dosage) && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-secondary text-muted-foreground">
                      {lot.Form || '-'} {lot.Dosage || ''}
                    </span>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <div className="px-2.5 py-1 rounded-xl bg-accent border border-primary/20 text-accent-foreground text-right">
                    <span className="text-base font-black leading-none block tabular-nums">{lot.Quantity}</span>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground">
                      {lot.UnitName || 'units'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <span className="text-[10px] uppercase font-bold">Lot:</span>
                    <span className="font-mono font-bold text-foreground">{lot.LotNumber}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[11px]">Exp: {new Date(lot.ExpiryDate).toLocaleDateString()}</span>
                  </div>
                </div>

                <div>{getStatusBadge(lot.ExpiryStatus, lot.DaysUntilExpiry)}</div>
              </div>
            </Card>
          ))
        )}
      </div>

      {/* DESKTOP & TABLET VIEW (>= 768px): Structured Table */}
      <Card className="hidden md:block rounded-2xl border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/70 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Medicine Item</th>
                <th className="py-3.5 px-4">Form / Dosage</th>
                <th className="py-3.5 px-4">Lot / Batch #</th>
                <th className="py-3.5 px-4">Expiry Date</th>
                <th className="py-3.5 px-4 text-center">Expiry Status</th>
                <th className="py-3.5 px-4 text-right">Available Qty</th>
                <th className="py-3.5 px-4">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sortedLots.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <Package className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="font-semibold text-sm text-foreground">No medicine lots found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {search || statusFilter !== 'ALL'
                        ? 'No lots match your current filters.'
                        : 'Stock will appear once inbound warehouse releases are confirmed.'}
                    </p>
                  </td>
                </tr>
              ) : (
                sortedLots.map((lot) => (
                  <tr
                    key={lot.StockID}
                    onClick={() => setSelectedLot(lot)}
                    className="hover:bg-secondary/50 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-black text-foreground">
                      {lot.ProductName}
                      <span className="block text-[10px] font-normal text-muted-foreground">
                        {lot.GenericName}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {lot.Form || '-'} {lot.Dosage || ''}
                    </td>
                    <td className="py-3 px-4 font-mono font-bold text-foreground">
                      {lot.LotNumber}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(lot.ExpiryDate).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {getStatusBadge(lot.ExpiryStatus, lot.DaysUntilExpiry)}
                    </td>
                    <td className="py-3 px-4 text-right font-black text-primary text-sm tabular-nums">
                      {lot.Quantity}{' '}
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {lot.UnitName || 'units'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {lot.DateReceived ? new Date(lot.DateReceived).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* LOT / BATCH DETAILS MODAL */}
      {selectedLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-secondary/40">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0">
                  <Info className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-foreground truncate">{selectedLot.ProductName}</h3>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {selectedLot.GenericName || 'Batch Inspection Details'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLot(null)}
                className="p-1.5 rounded-xl text-muted-foreground hover:bg-secondary"
                aria-label="Close Batch Details"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl bg-secondary/60 border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Available Quantity</span>
                  <span className="text-base font-black text-primary mt-0.5 block">
                    {selectedLot.Quantity} {selectedLot.UnitName || 'units'}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-secondary/60 border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Batch Status</span>
                  <div className="mt-1">{getStatusBadge(selectedLot.ExpiryStatus, selectedLot.DaysUntilExpiry)}</div>
                </div>
                <div className="p-3 rounded-xl bg-secondary/60 border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Lot Number</span>
                  <span className="font-mono font-bold text-foreground mt-0.5 block">{selectedLot.LotNumber}</span>
                </div>
                <div className="p-3 rounded-xl bg-secondary/60 border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Expiry Date</span>
                  <span className="font-bold text-foreground mt-0.5 block">
                    {new Date(selectedLot.ExpiryDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-secondary/60 border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Form &amp; Dosage</span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {selectedLot.Form || '-'} {selectedLot.Dosage || ''}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-secondary/60 border border-border">
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Date Received</span>
                  <span className="font-semibold text-foreground mt-0.5 block">
                    {selectedLot.DateReceived ? new Date(selectedLot.DateReceived).toLocaleDateString() : '-'}
                  </span>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => setSelectedLot(null)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 px-4 rounded-xl"
                >
                  Done
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
