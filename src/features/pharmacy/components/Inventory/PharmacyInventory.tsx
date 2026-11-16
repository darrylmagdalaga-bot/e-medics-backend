import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  Search,
  AlertTriangle,
  Clock,
  CheckCircle2,
  RefreshCw,
  ShieldCheck,
  Calendar,
  Layers,
  X,
  ArrowUpDown,
  Send,
  ShieldAlert
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { PharmacyStockItem } from '../../types';
import { PharmacyTab } from '../Layout/PharmacyLayout';

type SortMode = 'fefo' | 'name-asc' | 'stock-desc';

interface PharmacyInventoryProps {
  onNavigate?: (tab: PharmacyTab) => void;
}

export function PharmacyInventory({ onNavigate }: PharmacyInventoryProps = {}) {
  const [items, setItems] = useState<PharmacyStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState<SortMode>('fefo');

  const fetchInventory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pharmacyApi.getInventory({
        search: search.trim() || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load pharmacy batch inventory.');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchInventory();
    }, 250);
    return () => clearTimeout(timeout);
  }, [fetchInventory]);

  const sortedItems = useMemo(() => {
    const copy = [...items];
    if (sortMode === 'fefo') {
      return copy.sort((a, b) => new Date(a.ExpiryDate).getTime() - new Date(b.ExpiryDate).getTime());
    } else if (sortMode === 'name-asc') {
      return copy.sort((a, b) => a.ProductName.localeCompare(b.ProductName));
    } else if (sortMode === 'stock-desc') {
      return copy.sort((a, b) => b.Quantity - a.Quantity);
    }
    return copy;
  }, [items, sortMode]);

  const getStatusBadge = (status: string, daysToExpiry: number) => {
    switch (status) {
      case 'Expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            <AlertTriangle className="w-3 h-3" /> Expired (Blocked)
          </span>
        );
      case 'Near Expiry':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            <Clock className="w-3 h-3" /> Near Expiry ({daysToExpiry}d)
          </span>
        );
      case 'Low Stock':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
            <AlertTriangle className="w-3 h-3" /> Low Stock
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3 h-3" /> Good
          </span>
        );
    }
  };

  const statusFilters = [
    { id: 'all', label: 'All Batches' },
    { id: 'available', label: 'Available' },
    { id: 'low-stock', label: 'Low Stock' },
    { id: 'near-expiry', label: 'Near Expiry' },
    { id: 'expired', label: 'Expired' },
  ];

  const sortOptions: { id: SortMode; label: string }[] = [
    { id: 'fefo', label: 'Earliest Expiry (FEFO)' },
    { id: 'name-asc', label: 'Name A–Z' },
    { id: 'stock-desc', label: 'Stock High–Low' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search medicine name, generic, batch #, or distribution reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2 bg-background border border-border rounded-xl text-xs focus:outline-none focus:border-emerald-500 text-foreground"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onNavigate && (
              <button
                onClick={() => onNavigate('requests')}
                className="px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5 text-emerald-500" />
                <span>Request Stock</span>
              </button>
            )}
            <button
              onClick={fetchInventory}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {statusFilters.map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  statusFilter === f.id
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="px-2.5 py-1.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none cursor-pointer"
            >
              {sortOptions.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-card border border-rose-500/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs text-rose-500 font-semibold">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={fetchInventory}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          <span>
            Sorted by <strong>First Expiry, First Out (FEFO)</strong> — expired batches are automatically excluded from available dispensing stock
          </span>
        </div>
        <div className="font-bold text-foreground">
          {sortedItems.length} batch{sortedItems.length !== 1 ? 'es' : ''}
        </div>
      </div>

      {/* MOBILE CARDS (< md) */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
              <span className="text-xs font-bold">Loading inventory...</span>
            </div>
          </div>
        ) : sortedItems.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-10 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-sm font-bold text-foreground">No Medicine Batches Found</p>
            <p className="text-xs text-muted-foreground mt-1">Receive distributions from the Central Warehouse or adjust filters.</p>
          </div>
        ) : (
          sortedItems.map((item) => (
            <div
              key={item.StockID}
              className={`bg-card border rounded-2xl p-4 shadow-sm space-y-3 ${
                item.StockStatus === 'Expired'
                  ? 'border-rose-500/40'
                  : item.StockStatus === 'Near Expiry'
                  ? 'border-amber-500/40'
                  : 'border-border'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-foreground text-sm truncate">
                    {item.ProductName}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1 flex-wrap">
                    <span>{item.GenericName}</span>
                    {item.Dosage && <span>· {item.Dosage}</span>}
                    {item.UnitName && <span>· {item.UnitName}</span>}
                  </div>
                </div>
                <div className="shrink-0">
                  {getStatusBadge(item.StockStatus, item.DaysToExpiry)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="bg-muted/40 rounded-xl p-2.5 text-center border border-border">
                  <div className="text-lg font-black text-foreground leading-tight">
                    {item.StockStatus === 'Expired' ? 0 : item.Quantity}
                  </div>
                  <div className="text-[10px] text-muted-foreground">available ({item.Quantity} on hand)</div>
                </div>
                <div className="bg-muted/40 rounded-xl p-2.5 text-center border border-border">
                  <div
                    className={`text-xs font-bold leading-tight ${
                      item.DaysToExpiry < 0
                        ? 'text-rose-500'
                        : item.DaysToExpiry <= 90
                        ? 'text-amber-500'
                        : 'text-foreground'
                    }`}
                  >
                    {item.DaysToExpiry < 0
                      ? `${Math.abs(item.DaysToExpiry)}d ago`
                      : `${item.DaysToExpiry}d`}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {item.DaysToExpiry < 0 ? 'expired' : 'to expire'}
                  </div>
                </div>
                <div className="bg-muted/40 rounded-xl p-2.5 text-center border border-border overflow-hidden">
                  <div className="text-xs font-bold text-foreground leading-tight truncate">
                    {new Date(item.ExpiryDate).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </div>
                  <div className="text-[10px] text-muted-foreground">expiry</div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-mono font-semibold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border text-xs">
                  {item.LotNumber}
                </span>
                {item.SourceDistributionNumber ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    <Layers className="w-3 h-3" /> {item.SourceDistributionNumber}
                  </span>
                ) : item.DistributionItemID ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Layers className="w-3 h-3" /> Dist #{item.DistributionItemID}
                  </span>
                ) : (
                  <span className="text-muted-foreground text-[11px]">Opening Stock</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* DESKTOP/TABLET TABLE (≥ md) */}
      <div className="hidden md:block bg-card border border-border rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 text-muted-foreground font-black uppercase tracking-wider text-[10px] border-b border-border">
              <tr>
                <th className="py-3.5 px-4">Medicine Name / Category / Unit</th>
                <th className="py-3.5 px-3">Batch / Lot #</th>
                <th className="py-3.5 px-3">Expiry Date</th>
                <th className="py-3.5 px-3 text-right">On Hand</th>
                <th className="py-3.5 px-3 text-right">Available</th>
                <th className="py-3.5 px-3">Date Received</th>
                <th className="py-3.5 px-3">Warehouse Source</th>
                <th className="py-3.5 px-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-emerald-500 animate-spin" />
                      <span>Loading pharmacy inventory...</span>
                    </div>
                  </td>
                </tr>
              ) : sortedItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No medicine batches found matching the selected filters.
                  </td>
                </tr>
              ) : (
                sortedItems.map((item) => (
                  <tr
                    key={item.StockID}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-foreground text-sm">
                        {item.ProductName}
                      </div>
                      <div className="text-muted-foreground text-[11px] flex items-center gap-1.5 mt-0.5">
                        <span>{item.GenericName}</span>
                        {item.Classification && <span>· {item.Classification}</span>}
                        {item.UnitName && <span>· {item.UnitName}</span>}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <span className="font-mono font-bold px-2 py-0.5 rounded-md bg-muted text-foreground border border-border">
                        {item.LotNumber}
                      </span>
                    </td>

                    <td className="py-3.5 px-3 whitespace-nowrap">
                      <div className="font-bold text-foreground flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                        {new Date(item.ExpiryDate).toLocaleDateString()}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {item.DaysToExpiry < 0 ? (
                          <span className="text-rose-500 font-bold">
                            Expired {Math.abs(item.DaysToExpiry)} days ago
                          </span>
                        ) : (
                          <span>{item.DaysToExpiry} days remaining</span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <div className="font-bold text-foreground">
                        {item.Quantity.toLocaleString()}
                      </div>
                      {item.InitialQuantity && (
                        <div className="text-[10px] text-muted-foreground">
                          Init: {item.InitialQuantity.toLocaleString()}
                        </div>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-right">
                      <div className={`text-sm font-black ${
                        item.StockStatus === 'Expired'
                          ? 'text-rose-500 line-through'
                          : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {item.StockStatus === 'Expired' ? 0 : item.Quantity.toLocaleString()}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-muted-foreground whitespace-nowrap">
                      {item.DateReceived ? new Date(item.DateReceived).toLocaleDateString() : '—'}
                    </td>

                    <td className="py-3.5 px-3">
                      {item.SourceDistributionNumber ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                          <Layers className="w-3 h-3" /> {item.SourceDistributionNumber}
                        </span>
                      ) : item.DistributionItemID ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                          <Layers className="w-3 h-3" /> Dist #{item.DistributionItemID}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Opening Stock</span>
                      )}
                    </td>

                    <td className="py-3.5 px-3 text-center whitespace-nowrap">
                      {getStatusBadge(item.StockStatus, item.DaysToExpiry)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
