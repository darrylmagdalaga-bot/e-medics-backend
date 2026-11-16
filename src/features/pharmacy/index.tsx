import React, { useState, useEffect, useCallback } from 'react';
import { PharmacyLayout, PharmacyTab } from './components/Layout/PharmacyLayout';
import { PharmacyDashboard } from './components/Dashboard/PharmacyDashboard';
import { PharmacyInventory } from './components/Inventory/PharmacyInventory';
import { ReceiveDistribution } from './components/Receiving/ReceiveDistribution';
import { PharmacyStockRequests } from './components/Requests/PharmacyStockRequests';
import { MedicineDispensing } from './components/Dispensing/MedicineDispensing';
import { DispensingHistory } from './components/History/DispensingHistory';
import { StockMovements } from './components/Movements/StockMovements';
import { PrescriptionsQueueView } from './components/Prescriptions/PrescriptionsQueueView';
import { CentralizedReportsHub } from '../reports/CentralizedReportsHub';
import { ClinicalScreen } from '../../app/components/clinical-screen';
import { SettingsScreen } from '../../app/components/settings-screen';
import { pharmacyApi } from './api';
import { PharmacyDashboardStats } from './types';

const VALID_PHARMACY_TABS: PharmacyTab[] = [
    'dashboard',
    'inventory',
    'requests',
    'receive',
    'dispense',
    'history',
    'movements',
    'reports',
    'prescriptions',
    'clinical',
    'settings'
];

interface PharmacyModuleProps {
    userId?: number;
    onLogout?: () => void;
    initialTab?: PharmacyTab;
}

export const PharmacyModule: React.FC<PharmacyModuleProps> = ({
    userId,
    onLogout,
    initialTab
}) => {
    const resolvedUserId = userId || Number(localStorage.getItem('pharma_userId') || localStorage.getItem('userId') || 1);

    const [activeTab, setActiveTab] = useState<PharmacyTab>(() => {
        if (initialTab && VALID_PHARMACY_TABS.includes(initialTab)) {
            return initialTab;
        }
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            const tabFromUrl = urlParams.get('pharmacyTab') as PharmacyTab | null;
            if (tabFromUrl && VALID_PHARMACY_TABS.includes(tabFromUrl)) {
                return tabFromUrl;
            }
            const saved = localStorage.getItem('pharma_activePharmacyTab') as PharmacyTab | null;
            if (saved && VALID_PHARMACY_TABS.includes(saved)) {
                return saved;
            }
        }
        return 'dashboard';
    });

    const [dashboardStats, setDashboardStats] = useState<PharmacyDashboardStats | null>(null);
    const [pendingReceiptsCount, setPendingReceiptsCount] = useState<number>(0);
    const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(0);
    const [pendingRxCount, setPendingRxCount] = useState<number>(0);

    useEffect(() => {
        if (initialTab && VALID_PHARMACY_TABS.includes(initialTab)) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const handleTabChange = useCallback((tab: PharmacyTab) => {
        setActiveTab(tab);
        if (typeof window !== 'undefined') {
            localStorage.setItem('pharma_activePharmacyTab', tab);
            const url = new URL(window.location.href);
            url.searchParams.set('pharmacyTab', tab);
            window.history.replaceState({}, '', url.toString());
        }
    }, []);

    const refreshCounts = useCallback(async () => {
        try {
            const [stats, pendingRxs] = await Promise.all([
                pharmacyApi.getDashboardStats(),
                pharmacyApi.getPrescriptionsQueue({ status: 'Pending' }).catch(() => [])
            ]);
            setDashboardStats(stats);
            setPendingReceiptsCount(stats.pendingDistributions || 0);
            setPendingRequestsCount(stats.pendingStockRequests || 0);
            setPendingRxCount(Array.isArray(pendingRxs) ? pendingRxs.length : 0);
        } catch {
            // Silently ignore badge polling failure; active view handles its own error state
        }
    }, []);

    useEffect(() => {
        refreshCounts();
    }, [activeTab, refreshCounts]);

    return (
        <PharmacyLayout
            activeTab={activeTab}
            onTabChange={handleTabChange}
            pendingReceiptsCount={pendingReceiptsCount}
            pendingRequestsCount={pendingRequestsCount}
            pendingRxCount={pendingRxCount}
            dashboardStats={dashboardStats}
            onRefreshStats={refreshCounts}
            onLogout={onLogout}
        >
            {activeTab === 'dashboard' && (
                <PharmacyDashboard
                    onNavigate={(tab) => handleTabChange(tab)}
                    onNavigateTab={(tab) => handleTabChange(tab as PharmacyTab)}
                    onStatsLoaded={(stats) => {
                        setDashboardStats(stats);
                        setPendingReceiptsCount(stats.pendingDistributions || 0);
                        setPendingRequestsCount(stats.pendingStockRequests || 0);
                    }}
                />
            )}
            {activeTab === 'inventory' && <PharmacyInventory onNavigate={handleTabChange} />}
            {activeTab === 'receive' && (
                <ReceiveDistribution
                    onDistributionReceived={refreshCounts}
                />
            )}
            {activeTab === 'requests' && (
                <PharmacyStockRequests
                    onNavigate={handleTabChange}
                    onRequestCreated={refreshCounts}
                />
            )}
            {activeTab === 'dispense' && (
                <MedicineDispensing userId={resolvedUserId} />
            )}
            {activeTab === 'prescriptions' && (
                <PrescriptionsQueueView
                    onNavigateTab={(tab) => {
                        refreshCounts();
                        handleTabChange(tab as PharmacyTab);
                    }}
                />
            )}
            {activeTab === 'history' && (
                <DispensingHistory userId={resolvedUserId} />
            )}
            {activeTab === 'movements' && <StockMovements />}
            {activeTab === 'reports' && (
                <CentralizedReportsHub role="pharmacy" userId={resolvedUserId} />
            )}
            {activeTab === 'clinical' && <ClinicalScreen role="pharmacy" />}
            {activeTab === 'settings' && <SettingsScreen role="pharmacy" />}
        </PharmacyLayout>
    );
};

export default PharmacyModule;
