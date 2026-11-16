import React, { useState } from 'react';
import { 
  Clock, Search, Filter, ArrowDownToLine, Users, 
  ShieldCheck, AlertCircle, Calendar, RefreshCw, X, 
  RotateCcw, ArrowDownRight, ArrowUpRight
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { MovementLedgerEntry } from '../types';

interface BarangayMovementLedgerProps {
  movements: MovementLedgerEntry[];
  onRefresh: () => void;
  isLoading: boolean;
}

export function BarangayMovementLedger({
  movements,
  onRefresh,
  isLoading
}: BarangayMovementLedgerProps) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');

  const filteredMovements = movements.filter(m => {
    const s = search.toLowerCase();
    const matchSearch = m.ReferenceNumber.toLowerCase().includes(s) ||
                        m.ProductName.toLowerCase().includes(s) ||
                        (m.BatchNumber || '').toLowerCase().includes(s) ||
                        (m.Remarks || '').toLowerCase().includes(s);
    const matchType = typeFilter === 'ALL' || m.TransactionType === typeFilter;
    return matchSearch && matchType;
  });

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'RECEIPT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <ArrowDownToLine className="w-3 h-3" /> Inventory Receipt
          </span>
        );
      case 'DISBURSEMENT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            <Users className="w-3 h-3" /> Patient Medicine Release
          </span>
        );
      case 'REVERSAL':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-foreground border border-primary/25">
            <RotateCcw className="w-3 h-3" /> Transaction Reversal
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            {type}
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
            <Clock className="w-5 h-5 text-primary" />
            Station Inventory Movements
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable, tamper-evident audit trail of every Inventory Receipt, Patient Medicine Release, and Transaction Reversal
          </p>
        </div>

        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="text-xs font-semibold h-9 rounded-xl self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Ledger
        </Button>
      </div>

      {/* Search and Filters */}
      <Card className="rounded-2xl border-border/50 shadow-sm p-3.5 sm:p-4 space-y-3">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Reference #, Medicine, Batch #, or Remarks..."
            className="pl-9 pr-9 text-xs rounded-xl h-10 border-border/60"
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-1 border-t border-border/40">
          {['ALL', 'RECEIPT', 'DISBURSEMENT', 'REVERSAL'].map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[34px] ${
                typeFilter === t 
                  ? 'bg-primary text-primary-foreground shadow-xs' 
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {t === 'ALL' ? 'All Movements' : t}
            </button>
          ))}
          <span className="text-[11px] text-muted-foreground font-medium ml-auto pl-2 shrink-0">
            {filteredMovements.length} records
          </span>
        </div>
      </Card>

      {/* MOBILE VIEW (< 768px): Dedicated Transaction Cards */}
      <div className="block md:hidden space-y-3">
        {filteredMovements.length === 0 ? (
          <Card className="rounded-2xl border-border/50 shadow-sm p-8 text-center text-muted-foreground">
            <Clock className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-bold text-sm text-foreground">No ledger movements found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Movements are written automatically upon receiving distributions or disbursing to residents.
            </p>
          </Card>
        ) : (
          filteredMovements.map(m => {
            const isPositive = m.Quantity > 0;
            return (
              <Card 
                key={m.TransactionID} 
                className="rounded-2xl border-border/60 bg-card shadow-sm hover:shadow-md transition-shadow p-4 space-y-2.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-sm text-foreground">{m.ReferenceNumber}</span>
                  </div>
                  <div>
                    {getTypeBadge(m.TransactionType)}
                  </div>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-foreground">{m.ProductName}</h3>
                    {m.BatchNumber && (
                      <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                        Lot: <strong className="text-foreground">{m.BatchNumber}</strong>
                      </p>
                    )}
                  </div>

                  {/* Quantity Pill */}
                  <div className="text-right shrink-0">
                    <span className={`text-base font-black px-2.5 py-0.5 rounded-lg ${
                      isPositive ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300' : 'bg-blue-500/12 text-blue-700 dark:text-blue-300'
                    }`}>
                      {isPositive ? `+${m.Quantity}` : m.Quantity}
                    </span>
                    <span className="text-[10px] text-muted-foreground block mt-0.5 uppercase font-bold">units</span>
                  </div>
                </div>

                {m.Remarks && (
                  <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg leading-relaxed">
                    {m.Remarks}
                  </p>
                )}

                <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-border/40 text-muted-foreground">
                  <span>By: <strong className="text-foreground">{m.CreatedByName}</strong></span>
                  <span>{new Date(m.CreatedDate).toLocaleDateString()} {new Date(m.CreatedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* TABLET & DESKTOP VIEW (>= 768px): Structured Table */}
      <Card className="hidden md:block rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Event Type</th>
                <th className="py-3.5 px-4">Reference #</th>
                <th className="py-3.5 px-4">Medicine Item</th>
                <th className="py-3.5 px-4">Batch / Lot</th>
                <th className="py-3.5 px-4 text-right">Quantity</th>
                <th className="py-3.5 px-4">Responsible Actor</th>
                <th className="py-3.5 px-4">Remarks</th>
                <th className="py-3.5 px-4 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Clock className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="font-semibold text-sm text-foreground">No ledger movements found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Transactions are recorded automatically when shipments are received or medicines disbursed.</p>
                  </td>
                </tr>
              ) : (
                filteredMovements.map(m => {
                  const isPositive = m.Quantity > 0;
                  return (
                    <tr key={m.TransactionID} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4">
                        {getTypeBadge(m.TransactionType)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-foreground">
                        {m.ReferenceNumber}
                      </td>
                      <td className="py-3 px-4 font-bold text-foreground">
                        {m.ProductName}
                      </td>
                      <td className="py-3 px-4 font-mono text-muted-foreground">
                        {m.BatchNumber}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-black text-sm ${
                          isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'
                        }`}>
                          {isPositive ? `+${m.Quantity}` : m.Quantity}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {m.CreatedByName}
                      </td>
                      <td className="py-3 px-4 max-w-xs truncate text-muted-foreground" title={m.Remarks}>
                        {m.Remarks}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground whitespace-nowrap">
                        {new Date(m.CreatedDate).toLocaleDateString()} {new Date(m.CreatedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}