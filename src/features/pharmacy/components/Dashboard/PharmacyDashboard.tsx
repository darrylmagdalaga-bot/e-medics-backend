import React, { useEffect, useState, useCallback } from 'react';
import {
    Boxes,
    AlertTriangle,
    Clock,
    Truck,
    HeartHandshake,
    RefreshCw,
    ArrowRight,
    ShieldAlert,
    Send,
    History,
    Pill,
    CheckCircle2,
    ArrowUpRight,
    ArrowDownLeft,
    ClipboardList,
    Activity,
    PackageCheck
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { PharmacyDashboardStats, StockMovementItem } from '../../types';
import { PharmacyTab } from '../Layout/PharmacyLayout';

interface PharmacyDashboardProps {
    onNavigate?: (tab: PharmacyTab) => void;
    onNavigateTab?: (tab: string) => void;
    onStatsLoaded?: (stats: PharmacyDashboardStats) => void;
}

export const PharmacyDashboard: React.FC<PharmacyDashboardProps> = ({
    onNavigate,
    onNavigateTab,
    onStatsLoaded
}) => {
    const navigateTo = useCallback((tab: PharmacyTab) => {
        if (onNavigate) onNavigate(tab);
        else if (onNavigateTab) onNavigateTab(tab);
    }, [onNavigate, onNavigateTab]);

    const [stats, setStats] = useState<PharmacyDashboardStats | null>(null);
    const [recentMovements, setRecentMovements] = useState<StockMovementItem[]>([]);
    const [pendingRxCount, setPendingRxCount] = useState<number>(0);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [activityTab, setActivityTab] = useState<'dispensing' | 'receipts' | 'movements'>('dispensing');

    const loadDashboardData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [statsData, movementsData, pendingRxs] = await Promise.all([
                pharmacyApi.getDashboardStats(),
                pharmacyApi.getStockMovements().catch(() => [] as StockMovementItem[]),
                pharmacyApi.getPrescriptionsQueue({ status: 'Pending' }).catch(() => [])
            ]);
            setStats(statsData);
            setRecentMovements(Array.isArray(movementsData) ? movementsData.slice(0, 6) : []);
            setPendingRxCount(Array.isArray(pendingRxs) ? pendingRxs.length : 0);
            if (onStatsLoaded) {
                onStatsLoaded(statsData);
            }
        } catch (err: any) {
            setError(err?.message || 'Unable to load Pharmacy dashboard metrics from server.');
        } finally {
            setLoading(false);
        }
    }, [onStatsLoaded]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    if (loading && !stats) {
        return (
            <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading Pharmacy Dashboard">
                <div className="h-24 rounded-2xl bg-card border border-border p-5 flex items-center justify-between">
                    <div className="space-y-2.5">
                        <div className="h-5 w-56 bg-muted rounded-lg" />
                        <div className="h-3.5 w-80 bg-muted/70 rounded-lg" />
                    </div>
                    <div className="h-10 w-36 bg-muted rounded-xl" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    {Array.from({ length: 7 }).map((_, idx) => (
                        <div key={idx} className="h-28 rounded-2xl bg-card border border-border p-4 space-y-3">
                            <div className="h-4 w-20 bg-muted rounded" />
                            <div className="h-7 w-16 bg-muted rounded" />
                            <div className="h-3 w-24 bg-muted/60 rounded" />
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="h-80 rounded-2xl bg-card border border-border" />
                    <div className="h-80 rounded-2xl bg-card border border-border" />
                </div>
            </div>
        );
    }

    if (error && !stats) {
        return (
            <div className="p-6 sm:p-8 rounded-2xl bg-card border border-rose-500/30 text-center max-w-xl mx-auto my-8 shadow-lg">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center mx-auto mb-3 text-rose-500">
                    <ShieldAlert className="w-6 h-6" />
                </div>
                <h3 className="text-base font-black text-foreground">Unable to Load Pharmacy Dashboard</h3>
                <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{error}</p>
                <p className="text-[11px] text-muted-foreground mt-1">
                    Metrics are hidden to prevent displaying inaccurate zero values while the connection is unavailable.
                </p>
                <button
                    onClick={loadDashboardData}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry Loading Dashboard</span>
                </button>
            </div>
        );
    }

    if (!stats) return null;

    const summaryCards = [
        {
            id: 'total-medicines',
            label: 'Total Medicines',
            value: (stats.totalMedicines || 0).toLocaleString(),
            subtext: `${(stats.totalCatalogMedicines || 0).toLocaleString()} in active catalog`,
            icon: Pill,
            tone: 'emerald',
            onClick: () => navigateTo('inventory')
        },
        {
            id: 'available-stock',
            label: 'Available Stock',
            value: (stats.totalAvailableStock || 0).toLocaleString(),
            subtext: `Across ${stats.activeAvailableBatches || 0} non-expired batches`,
            icon: Boxes,
            tone: 'teal',
            onClick: () => navigateTo('inventory')
        },
        {
            id: 'low-stock',
            label: 'Low Stock Medicines',
            value: (stats.lowStockCount || 0).toLocaleString(),
            subtext: stats.lowStockCount > 0 ? 'At or below reorder level' : 'All batches adequately stocked',
            icon: AlertTriangle,
            tone: stats.lowStockCount > 0 ? 'amber' : 'slate',
            onClick: () => navigateTo('inventory')
        },
        {
            id: 'expiring-batches',
            label: 'Expiring Batches',
            value: (stats.nearExpiryBatches || 0).toLocaleString(),
            subtext: stats.expiredBatches > 0
                ? `${stats.expiredBatches} expired (${stats.totalExpiredUnits} units blocked)`
                : 'Within 90-day FEFO window',
            icon: Clock,
            tone: stats.expiredBatches > 0 ? 'rose' : stats.nearExpiryBatches > 0 ? 'amber' : 'slate',
            onClick: () => navigateTo('inventory')
        },
        {
            id: 'pending-requests',
            label: 'Pending Stock Requests',
            value: (stats.pendingStockRequests || 0).toLocaleString(),
            subtext: stats.approvedStockRequests > 0
                ? `${stats.approvedStockRequests} Approved Requests`
                : 'Submitted to Central Warehouse',
            icon: Send,
            tone: stats.pendingStockRequests > 0 ? 'indigo' : 'slate',
            onClick: () => navigateTo('requests')
        },
        {
            id: 'pending-receipts',
            label: 'Pending Stock Receipts',
            value: (stats.pendingDistributions || 0).toLocaleString(),
            subtext: 'Distributions Awaiting Receipt',
            icon: Truck,
            tone: stats.pendingDistributions > 0 ? 'amber' : 'slate',
            onClick: () => navigateTo('receive')
        },
        {
            id: 'today-dispensing',
            label: "Today's Dispensing",
            value: (stats.todayDispenseTransactions || 0).toLocaleString(),
            subtext: `${(stats.todayDispensedUnits || 0).toLocaleString()} units dispensed today`,
            icon: HeartHandshake,
            tone: 'emerald',
            onClick: () => navigateTo('history')
        }
    ];

    const quickActions = [
        {
            id: 'qa-dispense',
            label: 'Dispense Medicine',
            desc: 'FEFO patient dispensing',
            icon: HeartHandshake,
            primary: true,
            badge: pendingRxCount > 0 ? `${pendingRxCount} Rx` : undefined,
            onClick: () => navigateTo('dispense')
        },
        {
            id: 'qa-receive',
            label: 'Receive Stock',
            desc: 'Confirm warehouse deliveries',
            icon: Truck,
            badge: stats.pendingDistributions > 0 ? `${stats.pendingDistributions} Pending` : undefined,
            onClick: () => navigateTo('receive')
        },
        {
            id: 'qa-request',
            label: 'Request Stock',
            desc: 'Requisition from Warehouse',
            icon: Send,
            onClick: () => navigateTo('requests')
        },
        {
            id: 'qa-inventory',
            label: 'View Inventory',
            desc: 'Inspect batches & expiry',
            icon: Boxes,
            onClick: () => navigateTo('inventory')
        },
        {
            id: 'qa-history',
            label: 'View Dispensing History',
            desc: 'Audit trail & reversals',
            icon: History,
            onClick: () => navigateTo('history')
        }
    ];

    const lowStockAlerts = stats.lowStockAlerts || [];
    const expiryAlerts = stats.expiryAlerts || [];
    const recentReceipts = stats.recentReceipts || [];
    const recentDispensing = stats.recentDispensing || [];
    const topMeds = stats.topDispensedMedicines || [];

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs text-rose-600 dark:text-rose-300 font-semibold">
                        <ShieldAlert className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                    <button
                        onClick={loadDashboardData}
                        className="px-3 py-1.5 rounded-lg bg-rose-500 text-white text-xs font-bold shrink-0 cursor-pointer"
                    >
                        Retry
                    </button>
                </div>
            )}

            {/* QUICK ACTIONS BAR (Part 3.3) */}
            <section aria-label="Quick Pharmacy Actions" className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3.5">
                    <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">
                            Quick Pharmacy Actions
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Direct access to patient medicine dispensing, stock replenishment, and batch verification
                        </p>
                    </div>
                    <button
                        onClick={loadDashboardData}
                        disabled={loading}
                        className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border text-xs font-bold transition-colors cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-500' : 'text-muted-foreground'}`} />
                        <span>Refresh Live Data</span>
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                    {quickActions.map(action => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={action.id}
                                onClick={action.onClick}
                                className={`group relative flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                                    action.primary
                                        ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-600/20'
                                        : 'bg-muted/30 hover:bg-muted/70 border-border text-foreground'
                                }`}
                            >
                                <div
                                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                                        action.primary
                                            ? 'bg-white/15 text-white'
                                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-1">
                                        <span className="text-xs font-black tracking-tight truncate">
                                            {action.label}
                                        </span>
                                        {action.badge && (
                                            <span
                                                className={`px-1.5 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                                                    action.primary
                                                        ? 'bg-white text-emerald-700'
                                                        : 'bg-amber-500 text-slate-950'
                                                }`}
                                            >
                                                {action.badge}
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-[11px] truncate mt-0.5 ${action.primary ? 'text-emerald-100' : 'text-muted-foreground'}`}>
                                        {action.desc}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* 7 DATABASE-BACKED SUMMARY CARDS (Part 3.2) */}
            <section aria-label="Pharmacy Summary Metrics">
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-3">
                    {summaryCards.map(card => {
                        const Icon = card.icon;
                        const toneClasses: Record<string, string> = {
                            emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25',
                            teal: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/25',
                            amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
                            rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30',
                            indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30',
                            slate: 'bg-muted text-muted-foreground border-border'
                        };

                        return (
                            <button
                                key={card.id}
                                onClick={card.onClick}
                                className="group bg-card hover:bg-muted/40 border border-border rounded-2xl p-4 text-left transition-all flex flex-col justify-between shadow-sm hover:shadow-md cursor-pointer"
                            >
                                <div className="flex items-center justify-between gap-2 mb-2.5">
                                    <span className="text-[11px] font-bold text-muted-foreground leading-tight line-clamp-1">
                                        {card.label}
                                    </span>
                                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${toneClasses[card.tone]}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                </div>
                                <div>
                                    <div className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                                        {card.value}
                                    </div>
                                    <p className="text-[10px] font-semibold text-muted-foreground mt-1 line-clamp-1">
                                        {card.subtext}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* OPERATIONAL SECTIONS A & B */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* SECTION A: INVENTORY ALERTS */}
                <section className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-foreground">
                                        Inventory Alerts & FEFO Priority
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Expired stock (blocked), near-expiry batches, and low-stock medicines
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => navigateTo('inventory')}
                                className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 shrink-0 cursor-pointer"
                            >
                                <span>Full Inventory</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-3 gap-2.5 mb-4">
                            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20">
                                <div className="text-[10px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                                    Expired (Blocked)
                                </div>
                                <div className="text-lg font-black text-foreground mt-0.5">
                                    {stats.expiredBatches} <span className="text-xs font-semibold text-muted-foreground">batches</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    {stats.totalExpiredUnits.toLocaleString()} units excluded
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                                <div className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                                    Expiring ≤ 90d
                                </div>
                                <div className="text-lg font-black text-foreground mt-0.5">
                                    {stats.nearExpiryBatches} <span className="text-xs font-semibold text-muted-foreground">batches</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    Prioritized first by FEFO
                                </div>
                            </div>

                            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                <div className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                    Low Stock
                                </div>
                                <div className="text-lg font-black text-foreground mt-0.5">
                                    {stats.lowStockCount} <span className="text-xs font-semibold text-muted-foreground">medicines</span>
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                    Below reorder threshold
                                </div>
                            </div>
                        </div>

                        {expiryAlerts.length === 0 && lowStockAlerts.length === 0 ? (
                            <div className="py-8 px-4 rounded-xl bg-muted/30 border border-border text-center">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                                <p className="text-xs font-bold text-foreground">No Critical Inventory Alerts</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    All active Pharmacy medicine batches are within safe stock and expiration thresholds.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                {expiryAlerts.map(alert => (
                                    <div
                                        key={`exp-${alert.StockID}`}
                                        className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className={`px-2 py-0.5 text-[10px] font-black rounded-md uppercase ${
                                                        alert.AlertStatus === 'Expired'
                                                            ? 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30'
                                                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                                    }`}
                                                >
                                                    {alert.AlertStatus === 'Expired' ? 'Expired' : `Expires in ${alert.DaysToExpiry}d`}
                                                </span>
                                                <span className="text-xs font-bold text-foreground truncate">
                                                    {alert.ProductName}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                                                <span className="font-mono">Batch: {alert.LotNumber}</span>
                                                <span>•</span>
                                                <span>Exp: {new Date(alert.ExpiryDate).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs font-black text-foreground">
                                                {alert.Quantity.toLocaleString()} units
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {alert.AlertStatus === 'Expired' ? 'Blocked from FEFO' : 'Dispense first'}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {lowStockAlerts.map(alert => (
                                    <div
                                        key={`low-${alert.MedicineID}`}
                                        className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="px-2 py-0.5 text-[10px] font-black rounded-md uppercase bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                                    Low Stock
                                                </span>
                                                <span className="text-xs font-bold text-foreground truncate">
                                                    {alert.ProductName}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-1">
                                                {alert.GenericName} • {alert.BatchCount} active batch(es)
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs font-black text-amber-600 dark:text-amber-400">
                                                {alert.TotalAvailableStock.toLocaleString()} left
                                            </div>
                                            <button
                                                onClick={() => navigateTo('requests')}
                                                className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                            >
                                                Request Stock →
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* SECTION B: WAREHOUSE INTEGRATION */}
                <section className="bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500">
                                    <Truck className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-foreground">
                                        Central Warehouse Integration
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Stock requisitions, Approved Requests & Distributions Awaiting Receipt
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigateTo('requests')}
                                    className="px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Request Stock
                                </button>
                                <button
                                    onClick={() => navigateTo('receive')}
                                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors cursor-pointer"
                                >
                                    Receive Stock
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4">
                            <button
                                onClick={() => navigateTo('requests')}
                                className="p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border text-left transition-colors cursor-pointer"
                            >
                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Pending Stock Requests</div>
                                <div className="text-lg font-black text-foreground mt-0.5">{stats.pendingStockRequests}</div>
                                <div className="text-[10px] text-muted-foreground">Awaiting review</div>
                            </button>

                            <button
                                onClick={() => navigateTo('requests')}
                                className="p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border text-left transition-colors cursor-pointer"
                            >
                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Approved Requests</div>
                                <div className="text-lg font-black text-indigo-600 dark:text-indigo-400 mt-0.5">{stats.approvedStockRequests}</div>
                                <div className="text-[10px] text-muted-foreground">For distribution</div>
                            </button>

                            <button
                                onClick={() => navigateTo('receive')}
                                className="p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 text-left transition-colors cursor-pointer"
                            >
                                <div className="text-[10px] font-black text-amber-600 dark:text-amber-400 uppercase">Distributions Awaiting Receipt</div>
                                <div className="text-lg font-black text-foreground mt-0.5">{stats.pendingDistributions}</div>
                                <div className="text-[10px] text-muted-foreground">Awaiting confirm</div>
                            </button>

                            <button
                                onClick={() => navigateTo('receive')}
                                className="p-3 rounded-xl bg-muted/40 hover:bg-muted/70 border border-border text-left transition-colors cursor-pointer"
                            >
                                <div className="text-[10px] font-bold text-muted-foreground uppercase">Discrepancies</div>
                                <div className="text-lg font-black text-rose-500 mt-0.5">{stats.discrepancyCount}</div>
                                <div className="text-[10px] text-muted-foreground">Logged variances</div>
                            </button>
                        </div>

                        <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                            Recent Warehouse Stock Receipts
                        </div>
                        {recentReceipts.length === 0 ? (
                            <div className="py-7 px-4 rounded-xl bg-muted/30 border border-border text-center">
                                <PackageCheck className="w-7 h-7 text-muted-foreground mx-auto mb-1.5 opacity-60" />
                                <p className="text-xs font-bold text-foreground">No Warehouse Receipts Recorded Yet</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Submit a Stock Request to replenish medicine batches from the Central Warehouse.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                                {recentReceipts.map(rcpt => (
                                    <div
                                        key={rcpt.TransactionID}
                                        className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3"
                                    >
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-xs font-black text-foreground">
                                                    {rcpt.ReferenceNumber}
                                                </span>
                                                <span className="text-xs font-bold text-foreground truncate">
                                                    {rcpt.ProductName}
                                                </span>
                                            </div>
                                            <div className="text-[11px] text-muted-foreground mt-1">
                                                Batch {rcpt.BatchNumber} • Received {new Date(rcpt.CreatedDate).toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                +{rcpt.Quantity.toLocaleString()} units
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {rcpt.CreatedByName || 'Pharmacy'}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>
            </div>

            {/* OPERATIONAL SECTIONS C & D */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* SECTION C: RECENT ACTIVITY (Dispensing, Receipts, Recent Inventory Movements) */}
                <section className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500">
                                    <Activity className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-foreground">
                                        Recent Pharmacy Activity & Recent Inventory Movements
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Live feed of Recent Medicine Dispensing, stock receipts, and batch ledger movements
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border self-start sm:self-auto">
                                <button
                                    onClick={() => setActivityTab('dispensing')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        activityTab === 'dispensing'
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Dispensing ({recentDispensing.length})
                                </button>
                                <button
                                    onClick={() => setActivityTab('receipts')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        activityTab === 'receipts'
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Receipts ({recentReceipts.length})
                                </button>
                                <button
                                    onClick={() => setActivityTab('movements')}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        activityTab === 'movements'
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground'
                                    }`}
                                >
                                    Movements ({recentMovements.length})
                                </button>
                            </div>
                        </div>

                        {activityTab === 'dispensing' && (
                            <div className="space-y-2">
                                {recentDispensing.length === 0 ? (
                                    <div className="py-10 px-4 rounded-xl bg-muted/30 border border-border text-center">
                                        <HeartHandshake className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                                        <p className="text-xs font-bold text-foreground">No Medicine Dispensing Transactions Yet</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Dispensed patient medicines will appear here with FEFO batch traceability.
                                        </p>
                                    </div>
                                ) : (
                                    recentDispensing.map(rec => (
                                        <div
                                            key={rec.SaleID}
                                            className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                        {rec.DispenseNumber}
                                                    </span>
                                                    <span className="text-xs font-bold text-foreground truncate">
                                                        {rec.PatientName}
                                                    </span>
                                                    <span className="px-2 py-0.5 text-[10px] font-bold rounded bg-muted text-muted-foreground border border-border">
                                                        {rec.Status}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground mt-1">
                                                    {rec.Barangay ? `Brgy. ${rec.Barangay} • ` : ''}
                                                    {new Date(rec.SaleDate).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-xs font-black text-foreground">
                                                    {(rec.TotalUnits ?? rec.TotalQuantity ?? 0).toLocaleString()} units
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {rec.ItemCount} medicine(s)
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activityTab === 'receipts' && (
                            <div className="space-y-2">
                                {recentReceipts.length === 0 ? (
                                    <div className="py-10 px-4 rounded-xl bg-muted/30 border border-border text-center">
                                        <Truck className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                                        <p className="text-xs font-bold text-foreground">No Stock Receipts Recorded Yet</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Confirmed deliveries from the Central Warehouse will appear here.
                                        </p>
                                    </div>
                                ) : (
                                    recentReceipts.map(rcpt => (
                                        <div
                                            key={rcpt.TransactionID}
                                            className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs font-black text-foreground">
                                                        {rcpt.ReferenceNumber}
                                                    </span>
                                                    <span className="text-xs font-bold text-foreground truncate">
                                                        {rcpt.ProductName}
                                                    </span>
                                                </div>
                                                <div className="text-[11px] text-muted-foreground mt-1">
                                                    Batch {rcpt.BatchNumber} • {new Date(rcpt.CreatedDate).toLocaleString()}
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                    +{rcpt.Quantity.toLocaleString()} units
                                                </div>
                                                <div className="text-[10px] text-muted-foreground">
                                                    {rcpt.CreatedByName || 'Pharmacy'}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {activityTab === 'movements' && (
                            <div className="space-y-2">
                                {recentMovements.length === 0 ? (
                                    <div className="py-10 px-4 rounded-xl bg-muted/30 border border-border text-center">
                                        <History className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-60" />
                                        <p className="text-xs font-bold text-foreground">No Inventory Movements Recorded Yet</p>
                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                            Stock receipts, patient dispensing, and reversals are logged here automatically.
                                        </p>
                                    </div>
                                ) : (
                                    recentMovements.map(mov => {
                                        const qtyVal = mov.QuantityChange ?? mov.Quantity;
                                        const isPositive = qtyVal > 0;
                                        return (
                                            <div
                                                key={mov.MovementID || mov.TransactionID}
                                                className="p-3 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-3"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <div
                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                                            isPositive
                                                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                                                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400'
                                                        }`}
                                                    >
                                                        {isPositive ? (
                                                            <ArrowDownLeft className="w-4 h-4" />
                                                        ) : (
                                                            <ArrowUpRight className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-bold text-foreground truncate">
                                                            {mov.ProductName}
                                                        </div>
                                                        <div className="text-[11px] text-muted-foreground truncate">
                                                            {mov.MovementLabel || mov.TransactionType} • Batch {mov.BatchNumber || mov.LotNumber || 'N/A'} • Ref {mov.ReferenceNumber}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div
                                                        className={`text-xs font-black ${
                                                            isPositive
                                                                ? 'text-emerald-600 dark:text-emerald-400'
                                                                : 'text-indigo-600 dark:text-indigo-400'
                                                        }`}
                                                    >
                                                        {qtyVal > 0 ? `+${qtyVal.toLocaleString()}` : qtyVal.toLocaleString()}
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground">
                                                        {new Date(mov.CreatedAt || mov.CreatedDate).toLocaleDateString()}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    <div className="pt-3 mt-4 border-t border-border flex items-center justify-between text-xs">
                        <button
                            onClick={() => navigateTo('history')}
                            className="font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            View Full Dispensing History →
                        </button>
                        <button
                            onClick={() => navigateTo('movements')}
                            className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                            Open Inventory Movements Ledger →
                        </button>
                    </div>
                </section>

                {/* SECTION D: DISPENSING OVERVIEW */}
                <section className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-4">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/25 flex items-center justify-center text-teal-500">
                                    <HeartHandshake className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-foreground">
                                        Dispensing Overview
                                    </h3>
                                    <p className="text-xs text-muted-foreground">
                                        Daily volume & clinical Rx queue
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2.5 mb-4">
                            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                                <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                    Today's Dispenses
                                </div>
                                <div className="text-2xl font-black text-foreground mt-1">
                                    {stats.todayDispenseTransactions}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    {stats.todayDispensedUnits.toLocaleString()} total units issued
                                </div>
                            </div>

                            <button
                                onClick={() => navigateTo('prescriptions')}
                                className="p-3.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/20 text-left transition-colors cursor-pointer"
                            >
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                        Clinical Rx Queue
                                    </span>
                                    <ClipboardList className="w-3.5 h-3.5 text-indigo-500" />
                                </div>
                                <div className="text-2xl font-black text-foreground mt-1">
                                    {pendingRxCount}
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5">
                                    Pending e-prescriptions →
                                </div>
                            </button>
                        </div>

                        <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                            Top Dispensed Medicines (30 Days)
                        </div>
                        {topMeds.length === 0 ? (
                            <div className="py-7 px-4 rounded-xl bg-muted/30 border border-border text-center">
                                <Pill className="w-7 h-7 text-muted-foreground mx-auto mb-1.5 opacity-60" />
                                <p className="text-xs font-bold text-foreground">No Dispensing Volume Yet</p>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Top dispensed medicines will be ranked here automatically as prescriptions are fulfilled.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {topMeds.map((med, idx) => (
                                    <div
                                        key={med.MedicineID}
                                        className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between gap-2"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <span className="w-6 h-6 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-black text-xs flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </span>
                                            <div className="min-w-0">
                                                <div className="text-xs font-bold text-foreground truncate">
                                                    {med.ProductName}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground truncate">
                                                    {med.GenericName}
                                                </div>
                                            </div>
                                        </div>
                                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                                            {med.TotalDispensed.toLocaleString()} units
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => navigateTo('dispense')}
                        className="mt-4 w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                    >
                        <HeartHandshake className="w-4 h-4" />
                        <span>Open Medicine Dispensing</span>
                    </button>
                </section>
            </div>
        </div>
    );
};
