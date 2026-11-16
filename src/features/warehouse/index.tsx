import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { WarehouseLayout } from './components/Layout/WarehouseLayout';
import { WarehouseDashboard } from './components/Dashboard/WarehouseDashboard';
import { MedicineRegistry } from './components/MasterData/MedicineRegistry';
import { DeliveryReceipts } from './components/Inbound/DeliveryReceipts';
import { StockDistribution } from './components/Distribution/StockDistribution';
import { MedicineCategories } from './components/MasterData/MedicineCategories';
import { MedicineUnits } from './components/MasterData/MedicineUnits';
import { Suppliers } from './components/MasterData/Suppliers';
import { InventoryInquiry } from './components/Inventory/InventoryInquiry';
import { StockRequests } from './components/Outbound/StockRequests';
import { WarehouseReconciliation } from './components/Reconciliation/WarehouseReconciliation';
import { WarehousePhysicalCount } from './components/PhysicalCount/WarehousePhysicalCount';
import { WarehouseTraceability } from './components/Traceability/WarehouseTraceability';
import { CentralizedReportsHub } from '../reports/CentralizedReportsHub';

export function WarehouseModule({ onLogout }: { onLogout: () => void }) {
  const [activeView, setActiveView] = useState('dashboard');

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':
        return <WarehouseDashboard onNavigate={setActiveView} />;
      case 'categories':
        return <MedicineCategories />;
      case 'units':
        return <MedicineUnits />;
      case 'suppliers':
        return <Suppliers />;
      case 'medicines':
        return <MedicineRegistry />;
      case 'receiving':
        return <DeliveryReceipts />;
      case 'stock-requests':
        return <StockRequests />;
      case 'distribution':
        return <StockDistribution />;
      case 'inventory':
        return <InventoryInquiry />;
      case 'physical-count':
        return <WarehousePhysicalCount />;
      case 'reconciliation':
        return <WarehouseReconciliation />;
      case 'traceability':
        return <WarehouseTraceability />;
      case 'reports':
        return <CentralizedReportsHub role="warehouse" />;
      case 'administration':
      default:
        return (
          <div className="flex flex-col items-center justify-center h-[60vh] bg-card rounded-2xl border border-border shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <Package className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Module Under Construction</h3>
            <p className="text-muted-foreground mt-2 max-w-sm text-center">
              The {activeView} module is currently being refactored. Please check back later.
            </p>
          </div>
        );
    }
  };

  return (
    <WarehouseLayout 
      activeView={activeView} 
      onNavigate={setActiveView} 
      onLogout={onLogout}
    >
      {renderView()}
    </WarehouseLayout>
  );
}
