import React, { useMemo } from 'react';
import {
  Package,
  ArrowDownToLine,
  AlertTriangle,
  Users,
  FileText,
  CheckCircle2,
  ChevronRight,
  MapPin,
  Send,
  Pill,
  Clock,
  RotateCcw,
  Hospital,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import {
  BarangayStockLot,
  IncomingDistribution,
  BarangayDisbursement,
  BarangayScope,
  BarangayStockRequest,
  MovementLedgerEntry,
} from '../types';
import { CountUpNumber } from '../../../components/ui/react-bits';

interface BarangayDashboardProps {
  scope: BarangayScope | null;
  inventory: BarangayStockLot[];
  incoming: IncomingDistribution[];
  requests?: BarangayStockRequest[];
  disbursements: BarangayDisbursement[];
  movements?: MovementLedgerEntry[];
  onNavigateTab: (tab: string) => void;
  onInspectRequest?: (requestId: number) => void;
  onRefresh: () => void;
  isLoading: boolean;
}

function getLocalGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'GOOD MORNING, BHW!';
  if (hour < 18) return 'GOOD AFTERNOON, BHW!';
  return 'GOOD EVENING, BHW!';
}

function formatActivityDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const todayStr = new Date().toISOString().slice(0, 10);
  if (d.toISOString().slice(0, 10) === todayStr) {
    return 'Today, ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ', ' +
    d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getRequestStatusBadge(status: string) {
  switch (status) {
    case 'Completed':
    case 'Fulfilled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
          {status}
        </span>
      );
    case 'Approved':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/25">
          Approved
        </span>
      );
    case 'Partially Fulfilled':
    case 'Partially Approved':
    case 'Partially Received':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25">
          {status}
        </span>
      );
    case 'Under Review':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25">
          Under Review
        </span>
      );
    case 'Rejected':
    case 'Cancelled':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25">
          {status}
        </span>
      );
    case 'Draft':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-secondary text-muted-foreground border border-border">
          Draft
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-accent text-accent-foreground border border-primary/20">
          {status || 'Submitted'}
        </span>
      );
  }
}

export function BarangayDashboard({
  scope,
  inventory,
  incoming,
  requests = [],
  disbursements,
  movements = [],
  onNavigateTab,
  onInspectRequest,
  isLoading,
}: BarangayDashboardProps) {
  // Calculate summary KPIs strictly from real station data
  const activeLots = useMemo(
    () => inventory.filter((i) => i.Quantity > 0 && i.ExpiryStatus !== 'Expired'),
    [inventory]
  );
  const totalStock = useMemo(
    () => activeLots.reduce((sum, item) => sum + item.Quantity, 0),
    [activeLots]
  );
  const distinctMeds = useMemo(
    () => new Set(activeLots.map((i) => i.MedicineID)).size,
    [activeLots]
  );

  const expiringLots = useMemo(
    () =>
      inventory.filter(
        (i) => i.Quantity > 0 && (i.ExpiryStatus === 'Critical' || i.ExpiryStatus === 'Warning')
      ),
    [inventory]
  );
  const expiredLots = useMemo(
    () => inventory.filter((i) => i.Quantity > 0 && i.ExpiryStatus === 'Expired'),
    [inventory]
  );

  const lowStockMeds = useMemo(() => {
    const medBalances = new Map<number, { name: string; qty: number; reorder: number }>();
    activeLots.forEach((lot) => {
      const reorder = (lot as any).ReorderLevel || 20;
      const prev = medBalances.get(lot.MedicineID) || {
        name: lot.ProductName,
        qty: 0,
        reorder,
      };
      prev.qty += lot.Quantity;
      medBalances.set(lot.MedicineID, prev);
    });
    return Array.from(medBalances.values()).filter((m) => m.qty <= m.reorder);
  }, [activeLots]);

  const totalAlertCount = lowStockMeds.length + expiringLots.length + expiredLots.length;

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayDisbursements = useMemo(
    () =>
      disbursements.filter(
        (d) =>
          d.Status === 'Completed' &&
          d.DisbursementDate &&
          String(d.DisbursementDate).slice(0, 10) === todayStr
      ),
    [disbursements, todayStr]
  );
  const todayReleasedQty = useMemo(
    () => todayDisbursements.reduce((sum, d) => sum + (d.TotalQuantity || 0), 0),
    [todayDisbursements]
  );

  // Pending / open stock requests (real backend rows sorted newest first)
  const pendingRequestsList = useMemo(() => {
    const openStatuses = new Set(['Draft', 'Submitted', 'Pending', 'Under Review', 'Approved', 'Partially Fulfilled', 'Partially Approved']);
    const open = requests.filter((r) => openStatuses.has(r.Status));
    const list = open.length > 0 ? open : requests;
    return [...list]
      .sort((a, b) => new Date(b.CreatedDate).getTime() - new Date(a.CreatedDate).getTime())
      .slice(0, 4);
  }, [requests]);

  // Unified chronological Recent Activity feed built from real station records
  const recentActivities = useMemo(() => {
    type ActivityItem = {
      id: string;
      type: 'release' | 'receipt' | 'request' | 'reversal' | 'incoming';
      title: string;
      subtitle: string;
      date: string;
      timestamp: number;
      targetTab: string;
    };

    const items: ActivityItem[] = [];

    movements.forEach((m) => {
      const ts = new Date(m.CreatedDate).getTime() || 0;
      if (m.TransactionType === 'RECEIPT') {
        items.push({
          id: `mov-${m.TransactionID}`,
          type: 'receipt',
          title: 'Receipt Confirmed',
          subtitle: `${Math.abs(m.Quantity)} units • ${m.ProductName} (${m.ReferenceNumber})`,
          date: m.CreatedDate,
          timestamp: ts,
          targetTab: 'reports',
        });
      } else if (m.TransactionType === 'DISBURSEMENT') {
        items.push({
          id: `mov-${m.TransactionID}`,
          type: 'release',
          title: 'Medicine Released',
          subtitle: `${Math.abs(m.Quantity)} units • ${m.ProductName} (${m.ReferenceNumber})`,
          date: m.CreatedDate,
          timestamp: ts,
          targetTab: 'disburse',
        });
      } else if (m.TransactionType === 'REVERSAL') {
        items.push({
          id: `mov-${m.TransactionID}`,
          type: 'reversal',
          title: 'Dispensing Reversed',
          subtitle: `+${Math.abs(m.Quantity)} units restored • ${m.ProductName} (${m.ReferenceNumber})`,
          date: m.CreatedDate,
          timestamp: ts,
          targetTab: 'reports',
        });
      }
    });

    incoming.forEach((dist) => {
      items.push({
        id: `inc-${dist.DistributionID}`,
        type: 'incoming',
        title: 'Distribution Awaiting Receipt',
        subtitle: `${dist.DistributionNumber} • ${dist.TotalQuantityIssued} units (${dist.ItemCount} items)`,
        date: dist.ReleasedDate,
        timestamp: new Date(dist.ReleasedDate).getTime() || 0,
        targetTab: 'receive',
      });
    });

    requests.slice(0, 6).forEach((req) => {
      items.push({
        id: `req-${req.StockRequestID}`,
        type: 'request',
        title: `Stock Request ${req.Status}`,
        subtitle: `${req.RequestNumber} (${req.ItemCount || 0} item${req.ItemCount === 1 ? '' : 's'})`,
        date: req.CreatedDate,
        timestamp: new Date(req.CreatedDate).getTime() || 0,
        targetTab: 'requests',
      });
    });

    return items.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
  }, [movements, incoming, requests]);

  if (isLoading && inventory.length === 0 && requests.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6 animate-pulse">
        <div className="h-32 rounded-2xl bg-card border border-border hidden md:block" />
        <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-14 md:h-11 rounded-xl bg-secondary border border-border" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-card border border-border" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <div className="h-72 rounded-2xl bg-card border border-border" />
          <div className="h-72 rounded-2xl bg-card border border-border" />
        </div>
      </div>
    );
  }

  const stationName = scope?.locationName || 'Barangay Health Station';
  const barangayLabel = scope?.barangay ? `Barangay ${scope.barangay}` : 'Assigned Station';

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ========================================================= */}
      {/* DESKTOP & TABLET WELCOME + STATION IDENTITY (md+)         */}
      {/* ========================================================= */}
      <Card className="hidden md:flex rounded-2xl border-border bg-card shadow-xs p-5 sm:p-6 items-center justify-between gap-4 overflow-hidden">
        <div className="flex items-start sm:items-center gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-secondary border border-border flex items-center justify-center text-primary shrink-0">
            <Hospital className="w-7 h-7" />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {getLocalGreeting()}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-foreground border border-primary/20">
                Server-Isolated Station
              </span>
            </div>
            <h1 className="text-xl lg:text-2xl font-black text-foreground tracking-tight truncate">
              {stationName}
            </h1>
            <p className="text-xs text-muted-foreground truncate">
              {barangayLabel} • Manage your station&apos;s medicine inventory, stock requests, receipts, and patient releases.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigateTab('profile')}
          className="hidden xl:flex items-center gap-2 px-3.5 py-2 rounded-xl bg-secondary/70 hover:bg-secondary border border-border text-xs font-semibold text-foreground transition-colors shrink-0"
        >
          <MapPin className="w-3.5 h-3.5 text-primary" />
          <span>{barangayLabel}</span>
          <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </Card>

      {/* ========================================================= */}
      {/* PRIMARY QUICK ACTIONS (Desktop Row / Mobile 3-Tile Grid)  */}
      {/* ========================================================= */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Button
          type="button"
          onClick={() => onNavigateTab('requests')}
          className="h-auto sm:h-11 py-3 sm:py-0 px-2.5 sm:px-5 rounded-2xl sm:rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[11px] sm:text-xs shadow-sm flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2"
        >
          <Send className="w-4 h-4 shrink-0" />
          <span className="text-center leading-tight">Request Stock</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => onNavigateTab('receive')}
          className="relative h-auto sm:h-11 py-3 sm:py-0 px-2.5 sm:px-5 rounded-2xl sm:rounded-xl bg-card hover:bg-secondary border-border text-foreground font-bold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2"
        >
          <ArrowDownToLine className="w-4 h-4 text-primary shrink-0" />
          <span className="text-center leading-tight">Confirm Receipt</span>
          {incoming.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[9px] font-black leading-none">
              {incoming.length}
            </span>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => onNavigateTab('disburse')}
          className="h-auto sm:h-11 py-3 sm:py-0 px-2.5 sm:px-5 rounded-2xl sm:rounded-xl bg-card hover:bg-secondary border-border text-foreground font-bold text-[11px] sm:text-xs flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-2"
        >
          <Pill className="w-4 h-4 text-primary shrink-0" />
          <span className="text-center leading-tight">Release Medicine</span>
        </Button>
      </div>

      {/* ========================================================= */}
      {/* STATION OVERVIEW — 4 EQUAL-HEIGHT METRIC CARDS            */}
      {/* ========================================================= */}
      <section aria-labelledby="station-overview-heading" className="space-y-3">
        <div className="flex items-center justify-between md:hidden">
          <h2 id="station-overview-heading" className="text-sm font-black text-foreground flex items-center gap-1.5">
            Station Overview
          </h2>
          <span className="text-[11px] text-muted-foreground font-medium">Live station figures</span>
        </div>

        <div className="grid grid-cols-1 min-[340px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. Available Medicines */}
          <Card
            onClick={() => onNavigateTab('inventory')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('inventory')}
            className="p-4 sm:p-5 rounded-2xl border-border bg-card hover:border-primary/40 shadow-xs transition-all cursor-pointer flex flex-col justify-between min-h-[124px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Available Medicines</span>
              <div className="w-8 h-8 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-foreground tabular-nums">
                <CountUpNumber value={totalStock} />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                {distinctMeds} medicine{distinctMeds === 1 ? '' : 's'} • {activeLots.length} lots
              </p>
            </div>
          </Card>

          {/* 2. Awaiting Receipt */}
          <Card
            onClick={() => onNavigateTab('receive')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('receive')}
            className={`p-4 sm:p-5 rounded-2xl border shadow-xs transition-all cursor-pointer flex flex-col justify-between min-h-[124px] ${
              incoming.length > 0
                ? 'border-blue-500/35 bg-blue-500/5 hover:border-blue-500/60'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Awaiting Receipt</span>
              <div className="w-8 h-8 rounded-xl bg-blue-500/12 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <ArrowDownToLine className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-foreground tabular-nums">
                <CountUpNumber value={incoming.length} />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                {incoming.length === 1 ? '1 shipment awaiting inspection' : `${incoming.length} shipments`}
              </p>
            </div>
          </Card>

          {/* 3. Stock & Expiry Alerts */}
          <Card
            onClick={() => onNavigateTab('inventory')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('inventory')}
            className={`p-4 sm:p-5 rounded-2xl border shadow-xs transition-all cursor-pointer flex flex-col justify-between min-h-[124px] ${
              expiredLots.length > 0
                ? 'border-rose-500/35 bg-rose-500/5 hover:border-rose-500/60'
                : totalAlertCount > 0
                ? 'border-amber-500/35 bg-amber-500/5 hover:border-amber-500/60'
                : 'border-border bg-card hover:border-primary/40'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Stock &amp; Expiry Alerts</span>
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  expiredLots.length > 0
                    ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                    : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                }`}
              >
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-foreground tabular-nums">
                <CountUpNumber value={totalAlertCount} />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                {lowStockMeds.length} low-stock • {expiringLots.length} near-expiry
              </p>
            </div>
          </Card>

          {/* 4. Released Today */}
          <Card
            onClick={() => onNavigateTab('disburse')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && onNavigateTab('disburse')}
            className="p-4 sm:p-5 rounded-2xl border-border bg-card hover:border-primary/40 shadow-xs transition-all cursor-pointer flex flex-col justify-between min-h-[124px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Released Today</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <div className="text-2xl font-black text-foreground tabular-nums">
                <CountUpNumber value={todayReleasedQty} />
              </div>
              <p className="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                {todayDisbursements.length} resident voucher{todayDisbursements.length === 1 ? '' : 's'}
              </p>
            </div>
          </Card>
        </div>
      </section>

      {/* ========================================================= */}
      {/* LOWER TWO-COLUMN GRID: PENDING REQUESTS + RECENT ACTIVITY */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Pending Stock Requests */}
        <Card className="rounded-2xl border-border bg-card shadow-xs flex flex-col overflow-hidden">
          <CardHeader className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border/70 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm sm:text-base font-black text-foreground flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
                <FileText className="w-3.5 h-3.5" />
              </span>
              Pending Stock Requests
            </CardTitle>
            <button
              type="button"
              onClick={() => onNavigateTab('requests')}
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            {pendingRequestsList.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400 opacity-80" />
                <p className="text-xs font-bold text-foreground">No Pending Stock Requests</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Submit a new request whenever station medicines fall below safe reorder thresholds.
                </p>
              </div>
            ) : (
              <>
                {/* Desktop & Tablet Compact Table */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-secondary/60 text-muted-foreground font-bold border-b border-border">
                      <tr>
                        <th className="py-2.5 px-4">Request No.</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3 text-center">Items</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {pendingRequestsList.map((req) => (
                        <tr
                          key={req.StockRequestID}
                          onClick={() =>
                            onInspectRequest ? onInspectRequest(req.StockRequestID) : onNavigateTab('requests')
                          }
                          className="hover:bg-secondary/50 transition-colors cursor-pointer"
                        >
                          <td className="py-3 px-4 font-mono font-bold text-primary whitespace-nowrap">
                            {req.RequestNumber}
                          </td>
                          <td className="py-3 px-3 text-muted-foreground whitespace-nowrap">
                            {new Date(req.CreatedDate).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-foreground">
                            {req.ItemCount || 0}
                          </td>
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            {getRequestStatusBadge(req.Status)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Stacked Request Cards */}
                <div className="sm:hidden divide-y divide-border/60">
                  {pendingRequestsList.map((req) => (
                    <button
                      key={req.StockRequestID}
                      type="button"
                      onClick={() =>
                        onInspectRequest ? onInspectRequest(req.StockRequestID) : onNavigateTab('requests')
                      }
                      className="w-full p-3.5 flex items-center justify-between gap-2 text-left hover:bg-secondary/50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-bold text-xs text-primary truncate">{req.RequestNumber}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(req.CreatedDate).toLocaleDateString()} • {req.ItemCount || 0} items
                        </p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        {getRequestStatusBadge(req.Status)}
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Recent Station Activity */}
        <Card className="rounded-2xl border-border bg-card shadow-xs flex flex-col overflow-hidden">
          <CardHeader className="px-4 sm:px-5 pt-4 sm:pt-5 pb-3 border-b border-border/70 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm sm:text-base font-black text-foreground flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
                <Clock className="w-3.5 h-3.5" />
              </span>
              Recent Activity
            </CardTitle>
            <button
              type="button"
              onClick={() => onNavigateTab('reports')}
              className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            {recentActivities.length === 0 ? (
              <div className="py-10 px-4 text-center space-y-2">
                <Clock className="w-8 h-8 mx-auto text-muted-foreground/50" />
                <p className="text-xs font-bold text-foreground">No Recent Station Activity</p>
                <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                  Submitted stock requests, confirmed receipts, and medicine releases will appear here in chronological order.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {recentActivities.map((act) => {
                  const iconConfig =
                    act.type === 'receipt'
                      ? { Icon: CheckCircle2, cls: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400' }
                      : act.type === 'release'
                      ? { Icon: Users, cls: 'bg-blue-500/12 text-blue-600 dark:text-blue-400' }
                      : act.type === 'reversal'
                      ? { Icon: RotateCcw, cls: 'bg-rose-500/12 text-rose-600 dark:text-rose-400' }
                      : act.type === 'incoming'
                      ? { Icon: ArrowDownToLine, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' }
                      : { Icon: Send, cls: 'bg-accent text-primary' };
                  const ActivityIcon = iconConfig.Icon;

                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => onNavigateTab(act.targetTab)}
                      className="w-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 text-left hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconConfig.cls}`}>
                          <ActivityIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-foreground truncate">{act.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{act.subtitle}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatActivityDate(act.date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
