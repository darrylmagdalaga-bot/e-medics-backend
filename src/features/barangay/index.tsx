import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
  fetchBarangayProfile,
  fetchBarangayLocations,
  fetchBarangayInventory,
  fetchIncomingDistributions,
  fetchStockRequests,
  fetchDisbursements,
  fetchMovementLedger,
  fetchMedicinesCatalog,
} from './api';
import {
  BarangayScope,
  BarangayLocation,
  BarangayStockLot,
  IncomingDistribution,
  BarangayStockRequest,
  BarangayDisbursement,
  MovementLedgerEntry,
} from './types';

import { BarangayLayout, BarangayNavTab } from './components/BarangayLayout';
import { BarangayDashboard } from './components/BarangayDashboard';
import { BarangayStockRequests } from './components/BarangayStockRequests';
import { BarangayReceiveStock } from './components/BarangayReceiveStock';
import { BarangayInventory } from './components/BarangayInventory';
import { BarangayDisbursements } from './components/BarangayDisbursements';
import { BarangayReports } from './components/BarangayReports';
import {
  BarangayProfileView,
  BarangaySettingsView,
  BhwThemePreference,
} from './components/BarangayProfileSettings';

interface BarangayModuleProps {
  userId?: number | null;
  role?: string;
  onLogout?: () => void;
}

export function BarangayModule({ userId, role = 'barangay', onLogout }: BarangayModuleProps) {
  const [activeTab, setActiveTab] = useState<BarangayNavTab>('overview');
  const [focusedRequestId, setFocusedRequestId] = useState<number | null>(null);
  const [reportsSection, setReportsSection] = useState<'ledger' | 'discrepancies'>('ledger');

  const [scope, setScope] = useState<BarangayScope | null>(null);
  const [locations, setLocations] = useState<BarangayLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<number | null>(null);

  // Centralized Theme Preference (Light / Dark / System) synced across refreshes
  const [theme, setTheme] = useState<BhwThemePreference>(() => {
    if (typeof window !== 'undefined') {
      const saved =
        (localStorage.getItem('emedics-theme') as BhwThemePreference | null) ||
        (localStorage.getItem('bhw_theme') as BhwThemePreference | null);
      if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
    }
    return 'system';
  });

  useEffect(() => {
    const applyTheme = (pref: BhwThemePreference) => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      const isDark =
        pref === 'dark' ||
        (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.classList.add(isDark ? 'dark' : 'light');
    };

    applyTheme(theme);
    localStorage.setItem('emedics-theme', theme);
    localStorage.setItem('bhw_theme', theme);

    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  // Core Station Data State
  const [inventory, setInventory] = useState<BarangayStockLot[]>([]);
  const [incoming, setIncoming] = useState<IncomingDistribution[]>([]);
  const [requests, setRequests] = useState<BarangayStockRequest[]>([]);
  const [disbursements, setDisbursements] = useState<BarangayDisbursement[]>([]);
  const [movements, setMovements] = useState<MovementLedgerEntry[]>([]);
  const [medicines, setMedicines] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfileAndLocations = async () => {
    try {
      const profile = await fetchBarangayProfile(userId);
      setScope(profile);
      setSelectedLocationId(profile.locationId);

      if (profile.isElevated) {
        const locs = await fetchBarangayLocations();
        setLocations(locs);
      }
    } catch (err: any) {
      console.error('Failed to load barangay scope:', err);
      toast.error('Could not resolve Barangay assignment: ' + err.message);
    }
  };

  const loadStationData = async () => {
    setIsLoading(true);
    try {
      const [inv, inc, reqs, disb, mov, meds] = await Promise.all([
        fetchBarangayInventory(userId).catch(() => []),
        fetchIncomingDistributions(userId).catch(() => []),
        fetchStockRequests(userId).catch(() => []),
        fetchDisbursements(userId).catch(() => []),
        fetchMovementLedger(userId).catch(() => []),
        fetchMedicinesCatalog().catch(() => []),
      ]);

      setInventory(inv);
      setIncoming(inc);
      setRequests(reqs);
      setDisbursements(disb);
      setMovements(mov);
      setMedicines(meds);
    } catch (err: any) {
      console.error('Failed to load station data:', err);
      toast.error('Error refreshing station data: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProfileAndLocations();
  }, [userId]);

  useEffect(() => {
    if (scope) {
      loadStationData();
    }
  }, [scope]);

  const pendingRequestsCount = useMemo(
    () => requests.filter((r) => r.Status === 'Submitted' || (r.Status as string) === 'Pending').length,
    [requests]
  );

  const { lowStockCount, expiryWatchCount } = useMemo(() => {
    const activeLots = inventory.filter((l) => l.Quantity > 0 && l.ExpiryStatus !== 'Expired');
    const medTotals = new Map<number, number>();
    activeLots.forEach((l) => {
      medTotals.set(l.MedicineID, (medTotals.get(l.MedicineID) || 0) + l.Quantity);
    });
    const lowStock = Array.from(medTotals.values()).filter((qty) => qty <= 20).length;
    const expiryWatch = inventory.filter(
      (l) =>
        l.Quantity > 0 &&
        (l.ExpiryStatus === 'Expired' ||
          l.ExpiryStatus === 'Critical' ||
          l.ExpiryStatus === 'Warning')
    ).length;
    return { lowStockCount: lowStock, expiryWatchCount: expiryWatch };
  }, [inventory]);

  const handleNavigateTab = (tab: string) => {
    if (tab === 'ledger') {
      setReportsSection('ledger');
      setActiveTab('reports');
      return;
    }
    if (tab === 'discrepancies') {
      setReportsSection('discrepancies');
      setActiveTab('reports');
      return;
    }
    setActiveTab(tab as BarangayNavTab);
  };

  const handleInspectRequest = (requestId: number) => {
    setFocusedRequestId(requestId);
    setActiveTab('requests');
  };

  const stationBarangay = scope?.barangay || 'Station';
  const stationLabel = scope?.locationName || (scope?.barangay ? `Barangay ${scope.barangay}` : 'Barangay Health Station');

  return (
    <div className="portal-bhw h-screen w-full overflow-hidden bg-background text-foreground">
      <BarangayLayout
        activeTab={activeTab}
        onTabChange={(t) => {
          if (t === 'requests') setFocusedRequestId(null);
          setActiveTab(t);
        }}
        barangayName={stationBarangay}
        stationLabel={stationLabel}
        userName={scope?.fullName || 'Barangay Health Worker'}
        userRole={role === 'barangay' ? 'Barangay Health Worker' : role}
        pendingReceiptsCount={incoming.length}
        pendingRequestsCount={pendingRequestsCount}
        lowStockCount={lowStockCount}
        expiryWatchCount={expiryWatchCount}
        theme={theme}
        onThemeChange={setTheme}
        onRefreshStats={loadStationData}
        onLogout={onLogout}
      >
        {scope?.isElevated && locations.length > 0 && selectedLocationId && (
          <div className="mb-4 px-3.5 py-2.5 rounded-2xl bg-accent/60 border border-primary/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold text-accent-foreground">
              Elevated Overview Scope • Viewing Station ID: <strong className="font-mono">{selectedLocationId}</strong>
            </span>
            <span className="text-[11px] text-muted-foreground font-medium">
              {locations.length} barangay stations registered
            </span>
          </div>
        )}

        {activeTab === 'overview' && (
          <BarangayDashboard
            scope={scope}
            inventory={inventory}
            incoming={incoming}
            requests={requests}
            disbursements={disbursements}
            movements={movements}
            onNavigateTab={handleNavigateTab}
            onInspectRequest={handleInspectRequest}
            onRefresh={loadStationData}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'inventory' && (
          <BarangayInventory
            inventory={inventory}
            onRefresh={loadStationData}
            isLoading={isLoading}
            onNavigateRequestRestock={() => setActiveTab('requests')}
          />
        )}

        {activeTab === 'receive' && (
          <BarangayReceiveStock
            userId={userId || null}
            incoming={incoming}
            onRefresh={loadStationData}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'disburse' && (
          <BarangayDisbursements
            userId={userId || null}
            barangayName={scope?.barangay || 'Assigned Barangay'}
            disbursements={disbursements}
            inventory={inventory}
            onRefresh={loadStationData}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'requests' && (
          <BarangayStockRequests
            userId={userId || null}
            requests={requests}
            medicines={medicines}
            initialSelectedRequestId={focusedRequestId}
            onRefresh={loadStationData}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'reports' && (
          <BarangayReports
            userId={userId || null}
            barangayName={stationBarangay}
            movements={movements}
            onRefresh={loadStationData}
            isLoading={isLoading}
            initialSection={reportsSection}
          />
        )}

        {activeTab === 'profile' && (
          <BarangayProfileView
            scope={scope}
            role={role}
            onRefresh={loadStationData}
            onNavigateSettings={() => setActiveTab('settings')}
            isLoading={isLoading}
          />
        )}

        {activeTab === 'settings' && (
          <BarangaySettingsView
            theme={theme}
            onThemeChange={setTheme}
            scope={scope}
            onRefresh={loadStationData}
            onLogout={onLogout}
            isLoading={isLoading}
          />
        )}
      </BarangayLayout>
    </div>
  );
}
