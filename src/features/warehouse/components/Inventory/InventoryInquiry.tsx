import React, { useState, useMemo } from 'react';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { Archive, AlertTriangle, AlertCircle, CheckCircle2, Info, LayoutDashboard, Eye, Filter, ArrowUpDown, Calendar, Package } from 'lucide-react';
import { EntityPage } from '../../../../components/framework/EntityPage';
import { EntityConfig } from '../../../../components/framework/types';
import { Column } from '../../../../components/tables/EnterpriseTable';
import { Section } from '../../../../components/layout/Section';
import { Button } from '../../../../components/ui/button';
import { API_URL } from '../../../../app/api-config';

const InventorySchema = z.object({
  id: z.string(),
  medicineName: z.string(),
  batchNumber: z.string(),
  expiryDate: z.string(),
  quantityAvailable: z.number(),
  unitCost: z.number(),
});

type InventoryData = z.infer<typeof InventorySchema>;

const ExpiryBadge = ({ status }: { status: string }) => {
  let color = 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300';
  if (status === 'Healthy') color = 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400';
  else if (status === 'Expired') color = 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400';
  else if (status?.includes('7 Days')) color = 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400';
  else if (status?.includes('30 Days') || status?.includes('90 Days') || status?.includes('Expiring')) color = 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400';
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${color}`}>
      {status || 'Healthy'}
    </span>
  );
};

const columns: Column<InventoryData>[] = [
  { id: 'medicineName', header: 'Medicine', accessorKey: 'medicineName', sortable: true },
  { id: 'categoryName', header: 'Category', accessorKey: 'categoryName', sortable: true },
  { id: 'batchNumber', header: 'Batch No.', accessorKey: 'batchNumber' },
  { 
    id: 'expiryDate', 
    header: 'Expiry Date (FEFO)', 
    accessorKey: 'expiryDate',
    cell: (item: any) => (
      <div className="flex flex-col gap-1">
        <span className="font-medium">{new Date(item.expiryDate).toLocaleDateString()}</span>
        <div><ExpiryBadge status={item.expiryStatus} /></div>
      </div>
    )
  },
  { 
    id: 'quantityAvailable', 
    header: 'Qty Available', 
    accessorKey: 'quantityAvailable',
    cell: (item: any) => (
      <span className={item.quantityAvailable <= 100 ? "text-destructive font-bold" : "font-semibold text-foreground"}>
        {Number(item.quantityAvailable || 0).toLocaleString()}
      </span>
    )
  },
  { 
    id: 'totalValue', 
    header: 'Total Value', 
    accessorKey: 'totalValue',
    cell: (item: any) => <span>₱{Number(item.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
  },
  { id: 'locationName', header: 'Location', accessorKey: 'locationName' },
];

function KPIDashboard() {
  const { data: kpis } = useQuery({
    queryKey: ['warehouse-inventory-kpis'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/inventory/kpis`).then(res => res.json())
  });

  if (!kpis) return null;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-5">
      <div className="p-3.5 sm:p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <Archive className="w-4 h-4 text-primary shrink-0"/> Total Medicines
        </p>
        <p className="text-xl sm:text-2xl font-bold mt-1.5">{kpis.totalMedicines || 0}</p>
      </div>
      <div className="p-3.5 sm:p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0"/> Total Value
        </p>
        <p className="text-xl sm:text-2xl font-bold mt-1.5 text-emerald-600 dark:text-emerald-400 truncate">
          ₱{Number(kpis.totalInventoryValue || kpis.totalStockValue || 0).toLocaleString()}
        </p>
      </div>
      <div className="p-3.5 sm:p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0"/> Low Stock Batches
        </p>
        <p className="text-xl sm:text-2xl font-bold mt-1.5 text-amber-600 dark:text-amber-400">
          {kpis.lowStockBatches ?? kpis.lowStockMedicinesCount ?? 0}
        </p>
      </div>
      <div className="p-3.5 sm:p-4 rounded-xl border bg-card text-card-foreground shadow-xs">
        <p className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-destructive shrink-0"/> Expiring / Expired
        </p>
        <p className="text-xl sm:text-2xl font-bold mt-1.5 text-destructive">
          {(kpis.expiringSoonBatches ?? kpis.expiringWithin90DaysCount ?? 0) + (kpis.expiredBatchesCount ?? 0)}
        </p>
      </div>
    </div>
  );
}

export function InventoryInquiry() {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [stockFilter, setStockFilter] = useState<string>('ALL');
  const [expiryFilter, setExpiryFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<string>('FEFO');

  const { data: categories = [] } = useQuery({
    queryKey: ['warehouse-categories'],
    queryFn: () => fetch(`${API_URL}/api/warehouse/categories`).then(res => res.json()).catch(() => [])
  });

  const filterBar = (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl border border-border/60 bg-card/60">
      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
          Category
        </label>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="w-full h-10 px-2.5 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="ALL">All Categories</option>
          {Array.isArray(categories) && categories.map((cat: any) => (
            <option key={cat.id || cat.categoryName} value={cat.categoryName}>
              {cat.categoryName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
          Stock Status
        </label>
        <select
          value={stockFilter}
          onChange={(e) => setStockFilter(e.target.value)}
          className="w-full h-10 px-2.5 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="ALL">All Stock Levels</option>
          <option value="NORMAL">Adequate (&gt;100)</option>
          <option value="LOW">Low Stock (1–100)</option>
          <option value="OUT">Out of Stock (0)</option>
        </select>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
          Expiry Status
        </label>
        <select
          value={expiryFilter}
          onChange={(e) => setExpiryFilter(e.target.value)}
          className="w-full h-10 px-2.5 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="ALL">All Batches</option>
          <option value="HEALTHY">Healthy</option>
          <option value="NEAR_EXPIRY">Near Expiry (&lt;30d)</option>
          <option value="EXPIRED">Expired</option>
        </select>
      </div>

      <div>
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">
          Sort Order
        </label>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="w-full h-10 px-2.5 rounded-lg border border-border bg-background text-xs sm:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="FEFO">FEFO (Earliest Expiry)</option>
          <option value="NAME_ASC">Medicine Name (A–Z)</option>
          <option value="QTY_DESC">Available Qty (High–Low)</option>
          <option value="QTY_ASC">Available Qty (Low–High)</option>
        </select>
      </div>
    </div>
  );

  const config: EntityConfig<InventoryData> = useMemo(() => ({
    title: 'Warehouse Batch Inventory',
    description: 'Real-time batch-level stock balances, FEFO expiry status, and transaction ledgers.',
    icon: Archive,
    columns,
    customToolbar: filterBar,

    filterData: (items: any[]) => {
      return items
        .filter((item) => {
          if (categoryFilter !== 'ALL' && item.categoryName !== categoryFilter) return false;
          const qty = Number(item.quantityAvailable || 0);
          if (stockFilter === 'NORMAL' && qty <= 100) return false;
          if (stockFilter === 'LOW' && (qty === 0 || qty > 100)) return false;
          if (stockFilter === 'OUT' && qty > 0) return false;

          const status = String(item.expiryStatus || 'Healthy');
          if (expiryFilter === 'HEALTHY' && status !== 'Healthy') return false;
          if (expiryFilter === 'NEAR_EXPIRY' && !status.includes('Days') && !status.includes('Soon')) return false;
          if (expiryFilter === 'EXPIRED' && status !== 'Expired') return false;

          return true;
        })
        .sort((a, b) => {
          if (sortBy === 'FEFO') {
            return new Date(a.expiryDate || '2099-12-31').getTime() - new Date(b.expiryDate || '2099-12-31').getTime();
          }
          if (sortBy === 'NAME_ASC') {
            return String(a.medicineName || '').localeCompare(String(b.medicineName || ''));
          }
          if (sortBy === 'QTY_DESC') {
            return Number(b.quantityAvailable || 0) - Number(a.quantityAvailable || 0);
          }
          if (sortBy === 'QTY_ASC') {
            return Number(a.quantityAvailable || 0) - Number(b.quantityAvailable || 0);
          }
          return 0;
        });
    },
    
    permissions: {
      canCreate: false,
      canEdit: false,
      canDelete: false,
      canExport: true,
      canViewDetails: true,
    },
    
    api: {
      fetch: () => fetch(`${API_URL}/api/warehouse/inventory`).then(res => res.json())
    },

    renderForm: () => <div/>,

    renderMobileCard: (item: any, actions) => {
      const qty = Number(item.quantityAvailable || 0);
      const isLow = qty <= 100;
      return (
        <div
          onClick={actions.onView}
          className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-3 active:bg-muted/30 transition-colors cursor-pointer"
        >
          <div className="flex items-start justify-between gap-2.5 pb-2.5 border-b border-border/60">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {item.categoryName || 'General'}
                </span>
                <span className="text-[11px] font-mono font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded">
                  Batch: {item.batchNumber !== 'N/A' ? item.batchNumber : 'STD'}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug break-words">
                {item.medicineName}
              </h3>
              {item.genericName && (
                <p className="text-xs text-muted-foreground truncate">{item.genericName}</p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <ExpiryBadge status={item.expiryStatus} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded-xl border border-border/40">
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Available</span>
              <span className={`text-sm font-extrabold ${isLow ? 'text-destructive' : 'text-foreground'}`}>
                {qty.toLocaleString()}
              </span>
              {isLow && <span className="text-[10px] text-destructive block font-medium">Low Stock</span>}
            </div>
            <div>
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Expiry Date</span>
              <span className="text-xs font-semibold text-foreground">
                {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : 'N/A'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Total Value</span>
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                ₱{Number(item.totalValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-muted-foreground">
              Location: <strong className="text-foreground">{item.locationName || 'Main Warehouse'}</strong>
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                actions.onView();
              }}
              className="h-9 px-3 rounded-xl text-xs font-semibold"
            >
              <Eye className="w-3.5 h-3.5 mr-1.5 text-primary" />
              Batch Ledger
            </Button>
          </div>
        </div>
      );
    },

    renderDetails: (entity: any) => {
      // Fetch Transactions for this inventory item
      const { data: transactions = [] } = useQuery({
        queryKey: ['warehouse-inventory-transactions', entity.id],
        queryFn: () => fetch(`${API_URL}/api/warehouse/inventory/${entity.id}/transactions`).then(res => res.json())
      });

      return (
        <div className="space-y-6 mt-2">
          <Section title="Medicine Information" description="Product identity & classification." headerAction={<Info className="w-5 h-5 text-muted-foreground" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-sm bg-muted/30 p-4 rounded-xl border border-border/60">
              <div className="sm:col-span-2">
                <p className="text-xs text-muted-foreground">Product Name</p>
                <p className="font-bold text-foreground text-base">{entity.medicineName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Generic Name</p>
                <p className="font-medium text-foreground">{entity.genericName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="font-medium text-foreground">{entity.categoryName || '-'}</p>
              </div>
            </div>
          </Section>

          <Section title="Batch & Stock Status" description="Current warehouse batch holding." headerAction={<Archive className="w-5 h-5 text-muted-foreground" />}>
            <div className="grid grid-cols-2 gap-3.5 text-sm bg-muted/30 p-4 rounded-xl border border-border/60">
              <div>
                <p className="text-xs text-muted-foreground">Batch Number</p>
                <p className="font-mono font-bold text-foreground">{entity.batchNumber !== 'N/A' ? entity.batchNumber : '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Expiry Date</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="font-semibold text-foreground">{new Date(entity.expiryDate).toLocaleDateString()}</span>
                  <ExpiryBadge status={entity.expiryStatus} />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Available Quantity</p>
                <p className="font-extrabold text-primary text-lg">{Number(entity.quantityAvailable || 0).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Unit Cost</p>
                <p className="font-medium text-foreground">₱{Number(entity.unitCost || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Supplier</p>
                <p className="font-medium text-foreground break-words">{entity.supplierName || '-'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Source DR Ref</p>
                <p className="font-mono font-medium text-foreground">{entity.drNumber || '-'}</p>
              </div>
            </div>
          </Section>

          <Section title="Batch Transaction Ledger" description="Immutable chronological history of stock movements." headerAction={<LayoutDashboard className="w-5 h-5 text-muted-foreground" />}>
            {/* Mobile Ledger Cards */}
            <div className="sm:hidden space-y-2.5">
              {transactions.map((tx: any) => (
                <div key={tx.id} className="p-3 rounded-xl border border-border bg-background space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center px-2 py-0.5 rounded font-semibold bg-primary/10 text-primary">
                      {tx.type}
                    </span>
                    <span className={`text-sm font-extrabold ${tx.quantity > 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="font-mono text-foreground font-medium">{tx.referenceDocument || '-'}</span>
                    <span>{new Date(tx.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              ))}
              {transactions.length === 0 && (
                <div className="p-6 text-center text-muted-foreground text-xs border border-dashed rounded-xl">
                  No transactions recorded for this batch.
                </div>
              )}
            </div>

            {/* Desktop/Tablet Ledger Table */}
            <div className="hidden sm:block border rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5">Date</th>
                    <th className="px-4 py-2.5">Type</th>
                    <th className="px-4 py-2.5">Reference</th>
                    <th className="px-4 py-2.5 text-right">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: any) => (
                    <tr key={tx.id} className="border-t border-border">
                      <td className="px-4 py-3 text-xs">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{tx.referenceDocument}</td>
                      <td className={`px-4 py-3 text-right font-bold ${tx.quantity > 0 ? 'text-emerald-600' : 'text-foreground'}`}>
                        {tx.quantity > 0 ? '+' : ''}{tx.quantity}
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr><td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">No transactions recorded.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Section>
        </div>
      );
    }
  }), [categoryFilter, stockFilter, expiryFilter, sortBy, categories]);

  return (
    <div className="space-y-2">
      <KPIDashboard />
      <EntityPage<InventoryData> config={config} />
    </div>
  );
}
