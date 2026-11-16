import React, { useEffect, useState, useCallback } from 'react';
import {
  Warehouse,
  Pill,
  Building2,
  Stethoscope,
  FileText,
  RefreshCw,
  Boxes,
  AlertTriangle,
  Truck,
  HeartHandshake,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';
import { API_URL as API_BASE } from '../api-config';
import { PharmacyScreen } from './pharmacy-screen';
import { pharmacyApi } from '../../features/pharmacy/api';
import { PharmacyDashboardStats } from '../../features/pharmacy/types';

interface DashboardProps {
  role?: 'admin' | 'inventory' | 'pharmacy' | 'warehouse' | 'barangay';
  onNavigate?: (page: string, action?: string) => void;
}

export function DashboardScreen({ role = 'admin', onNavigate }: DashboardProps) {
  // If ever invoked with role === 'pharmacy', render the single unified Pharmacy Portal
  if (role === 'pharmacy') {
    return <PharmacyScreen />;
  }

  return <ExecutiveOverview onNavigate={onNavigate} />;
}

function ExecutiveOverview({ onNavigate }: { onNavigate?: (page: string, action?: string) => void }) {
  const [pharmacyStats, setPharmacyStats] = useState<PharmacyDashboardStats | null>(null);
  const [warehouseSummary, setWarehouseSummary] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadExecutiveMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const userId = localStorage.getItem('pharma_userId') || '1';
      const [pharmData, whRes] = await Promise.all([
        pharmacyApi.getDashboardStats(),
        fetch(`${API_BASE}/api/warehouse/dashboard-stats`, {
          headers: { 'x-user-id': userId }
        }).then(async r => (r.ok ? r.json() : null)).catch(() => null)
      ]);
      setPharmacyStats(pharmData);
      setWarehouseSummary(whRes);
    } catch (err: any) {
      setError(err?.message || 'Unable to load eMEDICS Executive Overview metrics.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExecutiveMetrics();
  }, [loadExecutiveMetrics]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card border border-border rounded-2xl p-5 shadow-sm">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
            eMEDICS System Administration
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-1">
            CHO Executive Supply Chain Overview
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Real-time database metrics across Central Warehouse, City Pharmacy, and Barangay Health Stations
          </p>
        </div>
        <button
          onClick={loadExecutiveMetrics}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-bold transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-primary' : ''}`} />
          <span>Refresh System Metrics</span>
        </button>
      </div>

      {error && (
        <div className="p-5 rounded-2xl bg-card border border-rose-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-500 shrink-0" />
            <div>
              <h3 className="text-xs font-black text-foreground">Executive Metrics Unavailable</h3>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
          </div>
          <button
            onClick={loadExecutiveMetrics}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Portal Launch Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => onNavigate && onNavigate('warehouse')}
          className="group p-5 rounded-2xl bg-card hover:bg-muted/40 border border-border text-left transition-all shadow-sm flex flex-col justify-between cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center text-blue-500 mb-3">
              <Warehouse className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-foreground">Central Warehouse Portal</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Supplier receipts, master batch inventory, and facility stock distributions
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-blue-500">
            <span>Open Central Warehouse</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <button
          onClick={() => onNavigate && onNavigate('pharmacy')}
          className="group p-5 rounded-2xl bg-card hover:bg-muted/40 border border-border text-left transition-all shadow-sm flex flex-col justify-between cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-500 mb-3">
              <Pill className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-foreground">City Pharmacy Portal</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Unified Pharmacy management: FEFO inventory, stock requests, receiving & dispensing
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400">
            <span>Open City Pharmacy Portal</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <button
          onClick={() => onNavigate && onNavigate('barangay')}
          className="group p-5 rounded-2xl bg-card hover:bg-muted/40 border border-border text-left transition-all shadow-sm flex flex-col justify-between cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/25 flex items-center justify-center text-indigo-500 mb-3">
              <Building2 className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-foreground">Barangay Health Stations</h3>
            <p className="text-xs text-muted-foreground mt-1">
              BHS facility stock requisitions, shipment receipts, and community dispensing
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-indigo-500">
            <span>Open BHS Portal</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </button>

        <button
          onClick={() => onNavigate && onNavigate('reports')}
          className="group p-5 rounded-2xl bg-card hover:bg-muted/40 border border-border text-left transition-all shadow-sm flex flex-col justify-between cursor-pointer"
        >
          <div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-500 mb-3">
              <FileText className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-black text-foreground">Audit & Reports Hub</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Official CHO inventory ledgers, distribution logs, and dispensing summaries
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-xs font-bold text-amber-500">
            <span>Open Reports Hub</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </div>

      {/* Live Database Metrics Summary */}
      {pharmacyStats && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-black text-foreground">
                Live City Pharmacy & Warehouse Snapshot
              </h2>
              <p className="text-xs text-muted-foreground">
                Real-time operational figures from the eMEDICS SQL database
              </p>
            </div>
            <button
              onClick={() => onNavigate && onNavigate('pharmacy')}
              className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>Manage in City Pharmacy Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                <span>Pharmacy Available Stock</span>
                <Boxes className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-foreground mt-1">
                {pharmacyStats.totalAvailableStock.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Across {pharmacyStats.activeAvailableBatches} non-expired batches
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                <span>Pending Stock Receipts</span>
                <Truck className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-foreground mt-1">
                {pharmacyStats.pendingDistributions.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {pharmacyStats.pendingStockRequests} active stock request(s)
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                <span>Low / Expiring Alerts</span>
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-foreground mt-1">
                {(pharmacyStats.lowStockCount + pharmacyStats.nearExpiryBatches + pharmacyStats.expiredBatches).toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {pharmacyStats.lowStockCount} low stock • {pharmacyStats.nearExpiryBatches} near expiry
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-bold">
                <span>Today's Pharmacy Dispenses</span>
                <HeartHandshake className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-foreground mt-1">
                {pharmacyStats.todayDispenseTransactions.toLocaleString()}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {pharmacyStats.todayDispensedUnits.toLocaleString()} medicine units issued today
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
