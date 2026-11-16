import React, { useEffect, useState, useCallback } from 'react';
import {
    ArrowLeftRight,
    Search,
    RefreshCw,
    ArrowUpRight,
    ArrowDownLeft,
    ShieldAlert,
    Calendar,
    Filter,
    X
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { StockMovementItem } from '../../types';

export const StockMovements: React.FC = () => {
    const [movements, setMovements] = useState<StockMovementItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [batch, setBatch] = useState('');
    const [transactionType, setTransactionType] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const loadMovements = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await pharmacyApi.getStockMovements({
                search: search.trim() || undefined,
                batch: batch.trim() || undefined,
                transactionType: transactionType || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined
            });
            setMovements(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setError(err?.message || 'Unable to load pharmacy inventory movements.');
        } finally {
            setLoading(false);
        }
    }, [search, batch, transactionType, startDate, endDate]);

    useEffect(() => {
        loadMovements();
    }, [transactionType, startDate, endDate, loadMovements]);

    const handleResetFilters = () => {
        setSearch('');
        setBatch('');
        setTransactionType('');
        setStartDate('');
        setEndDate('');
    };

    const hasActiveFilters = Boolean(search || batch || transactionType || startDate || endDate);

    return (
        <div className="space-y-5">
            {/* Filter & Search Toolbar */}
            <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border space-y-3 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-emerald-500" />
                        <h3 className="text-xs font-black uppercase tracking-wider text-foreground">
                            Inventory Movement Ledger Filters
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <button
                                onClick={handleResetFilters}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-bold transition-colors cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                                <span>Reset</span>
                            </button>
                        )}
                        <button
                            onClick={loadMovements}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                            <span>Refresh Ledger</span>
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    {/* Medicine / Reference Search */}
                    <div className="relative lg:col-span-2">
                        <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadMovements()}
                            placeholder="Search medicine, reference #, or remarks..."
                            className="w-full pl-9 pr-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500"
                        />
                    </div>

                    {/* Batch Filter */}
                    <div>
                        <input
                            type="text"
                            value={batch}
                            onChange={e => setBatch(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && loadMovements()}
                            placeholder="Filter by Batch / Lot #..."
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-emerald-500 font-mono"
                        />
                    </div>

                    {/* Movement Type Filter */}
                    <div>
                        <select
                            value={transactionType}
                            onChange={e => setTransactionType(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:border-emerald-500"
                        >
                            <option value="">All Movement Types</option>
                            <option value="RECEIPT">Inventory Receipt (Warehouse → Pharmacy)</option>
                            <option value="DISPENSE">Medicine Dispensing (Patient)</option>
                            <option value="REVERSAL">Transaction Reversal / Return</option>
                            <option value="ADJUSTMENT">Stock Adjustment</option>
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="relative">
                            <Calendar className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                title="Start Date"
                                className="w-full pl-7 pr-2 py-2 bg-background border border-border rounded-xl text-[11px] text-foreground focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div className="relative">
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                title="End Date"
                                className="w-full px-2 py-2 bg-background border border-border rounded-xl text-[11px] text-foreground focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Error State with Retry */}
            {error && (
                <div className="p-5 rounded-2xl bg-card border border-rose-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-500 shrink-0">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <h4 className="text-xs font-black text-foreground">Failed to Load Inventory Movements</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                        </div>
                    </div>
                    <button
                        onClick={loadMovements}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 cursor-pointer"
                    >
                        Retry Request
                    </button>
                </div>
            )}

            {/* Ledger Content */}
            <div className="rounded-2xl bg-card border border-border overflow-hidden shadow-sm">
                {loading ? (
                    <div className="p-12 text-center text-muted-foreground">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
                        <p className="text-xs font-semibold">Loading immutable pharmacy stock ledger...</p>
                    </div>
                ) : movements.length === 0 ? (
                    <div className="p-12 text-center">
                        <ArrowLeftRight className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-40" />
                        <p className="text-sm font-bold text-foreground">No Inventory Movements Found</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            {hasActiveFilters
                                ? 'No ledger transactions matched your current filter criteria.'
                                : 'Stock receipts, patient medicine dispensing, and reversals will be logged here automatically.'}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Mobile & Tablet Portrait Card List (< lg) */}
                        <div className="lg:hidden divide-y divide-border">
                            {movements.map(m => {
                                const qtyVal = m.QuantityChange ?? m.Quantity;
                                const isPositive = qtyVal > 0;
                                return (
                                    <div key={m.MovementID || m.TransactionID} className="p-4 space-y-2.5 hover:bg-muted/30 transition-colors">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="font-bold text-foreground text-sm truncate">{m.ProductName}</div>
                                                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                                                    Ref: {m.ReferenceNumber} • Batch: {m.BatchNumber || m.LotNumber || 'N/A'}
                                                </div>
                                            </div>
                                            <span
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${
                                                    isPositive
                                                        ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                                        : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                                                }`}
                                            >
                                                {isPositive ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
                                                {qtyVal > 0 ? `+${qtyVal.toLocaleString()}` : qtyVal.toLocaleString()}
                                            </span>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                                            <span className="px-2 py-0.5 rounded bg-muted font-bold text-foreground">
                                                {m.MovementLabel || m.TransactionType}
                                            </span>
                                            <span>
                                                {m.SourceFacility || m.SourceType || 'System'} → {m.DestinationFacility || m.DestinationType || 'Pharmacy'}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-border/60">
                                            <span>By: {m.CreatedByName || 'System'}</span>
                                            <span>{new Date(m.CreatedDate || m.CreatedAt).toLocaleString()}</span>
                                        </div>

                                        {m.Remarks && (
                                            <p className="text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg border border-border">
                                                {m.Remarks}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Desktop Table (lg+) */}
                        <div className="hidden lg:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-muted/40 border-b border-border text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                        <th className="p-3.5">Date & Time</th>
                                        <th className="p-3.5">Reference #</th>
                                        <th className="p-3.5">Movement Type</th>
                                        <th className="p-3.5">Medicine</th>
                                        <th className="p-3.5">Batch / Expiry</th>
                                        <th className="p-3.5">Source → Destination</th>
                                        <th className="p-3.5 text-right">Qty Change</th>
                                        <th className="p-3.5">Processed By</th>
                                        <th className="p-3.5">Remarks</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border text-xs">
                                    {movements.map(m => {
                                        const qtyVal = m.QuantityChange ?? m.Quantity;
                                        const isPositive = qtyVal > 0;
                                        return (
                                            <tr key={m.MovementID || m.TransactionID} className="hover:bg-muted/30 transition-colors">
                                                <td className="p-3.5 text-muted-foreground whitespace-nowrap">
                                                    {new Date(m.CreatedDate || m.CreatedAt).toLocaleString()}
                                                </td>
                                                <td className="p-3.5 font-mono font-bold text-foreground whitespace-nowrap">
                                                    {m.ReferenceNumber}
                                                </td>
                                                <td className="p-3.5">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase border ${
                                                            isPositive
                                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                                                                : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
                                                        }`}
                                                    >
                                                        {isPositive ? <ArrowDownLeft className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                                        {m.MovementLabel || m.TransactionType}
                                                    </span>
                                                </td>
                                                <td className="p-3.5">
                                                    <div className="font-bold text-foreground">{m.ProductName}</div>
                                                    <div className="text-[10px] text-muted-foreground font-mono">{m.ProductCode}</div>
                                                </td>
                                                <td className="p-3.5 font-mono">
                                                    <div className="font-bold text-foreground">{m.BatchNumber || m.LotNumber || 'N/A'}</div>
                                                    {m.ExpirationDate && (
                                                        <div className="text-[10px] text-muted-foreground">
                                                            Exp: {new Date(m.ExpirationDate).toLocaleDateString()}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="p-3.5 text-muted-foreground">
                                                    <span className="font-semibold text-foreground">{m.SourceFacility || m.SourceType || 'System'}</span>
                                                    {' → '}
                                                    <span className="font-semibold text-foreground">{m.DestinationFacility || m.DestinationType || 'Pharmacy'}</span>
                                                </td>
                                                <td
                                                    className={`p-3.5 text-right font-black text-sm whitespace-nowrap ${
                                                        isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-indigo-600 dark:text-indigo-400'
                                                    }`}
                                                >
                                                    {qtyVal > 0 ? `+${qtyVal.toLocaleString()}` : qtyVal.toLocaleString()}
                                                </td>
                                                <td className="p-3.5 text-muted-foreground whitespace-nowrap">
                                                    {m.CreatedByName || 'System'}
                                                </td>
                                                <td className="p-3.5 text-muted-foreground max-w-xs truncate" title={m.Remarks || ''}>
                                                    {m.Remarks || '—'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};
