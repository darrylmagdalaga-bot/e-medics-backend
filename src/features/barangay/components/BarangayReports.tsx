import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  AlertTriangle,
  Download,
  Printer,
  Calendar,
  TrendingUp,
  TrendingDown,
  RotateCcw,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card } from '../../../components/ui/card';
import { MovementLedgerEntry } from '../types';
import { BarangayMovementLedger } from './BarangayMovementLedger';
import { BarangayDiscrepancies } from './BarangayDiscrepancies';
import { toast } from 'sonner';

interface BarangayReportsProps {
  userId: number | null;
  barangayName: string;
  movements: MovementLedgerEntry[];
  onRefresh: () => void;
  isLoading: boolean;
  initialSection?: 'ledger' | 'discrepancies';
}

function escapeCsv(value: unknown): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

export function BarangayReports({
  userId,
  barangayName,
  movements,
  onRefresh,
  isLoading,
  initialSection = 'ledger',
}: BarangayReportsProps) {
  const [section, setSection] = useState<'ledger' | 'discrepancies'>(initialSection);
  const [dateRange, setDateRange] = useState<'ALL' | 'TODAY' | '7D' | '30D'>('ALL');

  React.useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  const filteredByDate = useMemo(() => {
    if (dateRange === 'ALL') return movements;
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    return movements.filter((m) => {
      if (!m.CreatedDate) return false;
      const d = new Date(m.CreatedDate);
      if (dateRange === 'TODAY') {
        return d.toISOString().slice(0, 10) === todayStr;
      }
      const diffDays = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
      if (dateRange === '7D') return diffDays <= 7;
      if (dateRange === '30D') return diffDays <= 30;
      return true;
    });
  }, [movements, dateRange]);

  const summary = useMemo(() => {
    let inflow = 0;
    let outflow = 0;
    let reversals = 0;
    filteredByDate.forEach((m) => {
      if (m.TransactionType === 'REVERSAL') {
        reversals += Math.abs(m.Quantity);
      } else if (m.Quantity > 0) {
        inflow += m.Quantity;
      } else {
        outflow += Math.abs(m.Quantity);
      }
    });
    return { inflow, outflow, reversals, count: filteredByDate.length };
  }, [filteredByDate]);

  const handleExportCsv = () => {
    if (filteredByDate.length === 0) {
      toast.info('No ledger records available to export for this filter.');
      return;
    }
    const headers = [
      'TransactionID',
      'Date',
      'Type',
      'ReferenceNumber',
      'Medicine',
      'BatchNumber',
      'Quantity',
      'RecordedBy',
      'Remarks',
    ];
    const rows = filteredByDate.map((m) =>
      [
        m.TransactionID,
        new Date(m.CreatedDate).toISOString(),
        m.TransactionType,
        m.ReferenceNumber,
        m.ProductName,
        m.BatchNumber || '',
        m.Quantity,
        m.CreatedByName || '',
        m.Remarks || '',
      ]
        .map(escapeCsv)
        .join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bhw-${(barangayName || 'station').toLowerCase().replace(/\s+/g, '-')}-movements.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Movement report exported to CSV.');
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Reports Header & Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            Station Reports &amp; Audit Logs
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {barangayName} Health Station • Filter movement history, audit delivery discrepancies, and export reports
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {section === 'ledger' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              className="h-9 rounded-xl text-xs font-semibold border-border hover:border-primary/40"
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            className="h-9 rounded-xl text-xs font-semibold border-border hover:border-primary/40"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print View
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs + Date Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="inline-flex bg-secondary/70 p-1 rounded-xl border border-border w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSection('ledger')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              section === 'ledger'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Movement Ledger</span>
          </button>
          <button
            type="button"
            onClick={() => setSection('discrepancies')}
            className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all ${
              section === 'discrepancies'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Discrepancy Audit</span>
          </button>
        </div>

        {section === 'ledger' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0 mr-0.5 hidden sm:inline" />
            {[
              { id: 'ALL' as const, label: 'All Time' },
              { id: 'TODAY' as const, label: 'Today' },
              { id: '7D' as const, label: 'Last 7 Days' },
              { id: '30D' as const, label: 'Last 30 Days' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setDateRange(opt.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap border transition-colors ${
                  dateRange === opt.id
                    ? 'bg-accent text-accent-foreground border-primary/30'
                    : 'bg-card border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Compact Summary Strip on Ledger */}
      {section === 'ledger' && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="p-3.5 rounded-2xl border-border bg-card shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Entries</span>
              <ArrowLeftRight className="w-4 h-4 text-primary" />
            </div>
            <p className="text-xl font-black text-foreground mt-1.5">{summary.count}</p>
            <p className="text-[11px] text-muted-foreground">Recorded events</p>
          </Card>

          <Card className="p-3.5 rounded-2xl border-border bg-card shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Received</span>
              <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1.5">+{summary.inflow}</p>
            <p className="text-[11px] text-muted-foreground">Units ingested</p>
          </Card>

          <Card className="p-3.5 rounded-2xl border-border bg-card shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Total Released</span>
              <TrendingDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1.5">-{summary.outflow}</p>
            <p className="text-[11px] text-muted-foreground">Units disbursed</p>
          </Card>

          <Card className="p-3.5 rounded-2xl border-border bg-card shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Reversals</span>
              <RotateCcw className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-xl font-black text-foreground mt-1.5">{summary.reversals}</p>
            <p className="text-[11px] text-muted-foreground">Restored units</p>
          </Card>
        </div>
      )}

      {/* Active Report Content */}
      {section === 'ledger' ? (
        <BarangayMovementLedger
          movements={filteredByDate}
          onRefresh={onRefresh}
          isLoading={isLoading}
        />
      ) : (
        <BarangayDiscrepancies
          userId={userId}
          onRefresh={onRefresh}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
