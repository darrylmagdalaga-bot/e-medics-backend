import React, { useState, useEffect, useMemo } from 'react';
import { API_URL } from '../api-config';
import {
  History, Filter, Plus, AlertCircle, CheckCircle2,
  Calendar, FileText, Package, Layers, ShieldCheck,
  X, Database, PackagePlus, Search, RefreshCw, ArrowUpRight,
  Truck, Archive, AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';

interface WarehouseInventoryItem {
  id: string;
  medicineId: string;
  medicineName: string;
  genericName?: string;
  categoryName?: string;
  locationName?: string;
  batchNumber?: string | null;
  lotNumber?: string | null;
  expiryDate?: string;
  quantityAvailable: number;
  unitCost?: number;
  totalValue?: number;
  expiryStatus?: string;
}

interface WarehouseDistributionItem {
  DistributionID: string | number;
  DistributionNumber: string;
  DestinationFacility?: string;
  DistributionDate: string;
  Status: string;
  Remarks?: string;
  ItemCount?: number;
}

interface StockRequest {
  RequestID: number;
  RequesterName?: string;
  Status: string;
  Remarks?: string;
  CreatedDate?: string;
  details?: Array<{
    ProductName: string;
    QuantityRequested: number;
    UnitName: string;
  }>;
}

export function InventoryScreen({ action, clearAction, role = 'inventory' }: { action?: string | null, clearAction?: () => void, role?: string }) {
  const isInventoryRole = role === 'inventory' || role === 'warehouse' || role === 'Warehouse Staff' || role === 'admin';
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'history'>('inventory');

  const [inventory, setInventory] = useState<WarehouseInventoryItem[]>([]);
  const [distributions, setDistributions] = useState<WarehouseDistributionItem[]>([]);
  const [stockRequests, setStockRequests] = useState<StockRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [invRes, distRes, reqRes] = await Promise.all([
        fetch(`${API_URL}/api/warehouse/inventory`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } }).catch(() => null),
        fetch(`${API_URL}/api/warehouse/distributions`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } }).catch(() => null),
        fetch(`${API_URL}/api/stock-requests`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } }).catch(() => null),
      ]);

      if (invRes && invRes.ok) {
        const invData = await invRes.json();
        if (Array.isArray(invData)) setInventory(invData);
      }
      if (distRes && distRes.ok) {
        const distData = await distRes.json();
        if (Array.isArray(distData)) setDistributions(distData);
      }
      if (reqRes && reqRes.ok) {
        const reqData = await reqRes.json();
        if (Array.isArray(reqData)) setStockRequests(reqData);
      }
    } catch (err) {
      console.error('Failed to load inventory data:', err);
      toast.error('Failed to load live inventory data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (action === 'open-bulk-issue') {
      setShowBulkModal(true);
      clearAction?.();
    }
  }, [action, clearAction]);

  // Handle stock request status change
  const handleUpdateStatus = async (requestId: number, newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`${API_URL}/api/stock-request/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Request #${requestId} is now ${newStatus}`);
        fetchData();
        setSelectedRequest(null);
      } else {
        toast.error(data.message || 'Failed to update status');
      }
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const viewRequestDetails = async (request: any) => {
    try {
      const res = await fetch(`${API_URL}/api/stock-request/${request.RequestID}`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
      const data = await res.json();
      setSelectedRequest(data);
    } catch (err) {
      toast.error('Failed to load request details');
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach(i => {
      if (i.categoryName) set.add(i.categoryName);
    });
    return ['All', ...Array.from(set)];
  }, [inventory]);

  // Filtered inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (item.medicineName && item.medicineName.toLowerCase().includes(q)) ||
        (item.genericName && item.genericName.toLowerCase().includes(q)) ||
        (item.lotNumber && item.lotNumber.toLowerCase().includes(q)) ||
        (item.batchNumber && item.batchNumber.toLowerCase().includes(q));
      const matchCat = selectedCategory === 'All' || item.categoryName === selectedCategory;
      return matchSearch && matchCat;
    });
  }, [inventory, searchQuery, selectedCategory]);

  // KPI Calculations
  const totalLots = inventory.length;
  const totalStockUnits = inventory.reduce((acc, i) => acc + (Number(i.quantityAvailable) || 0), 0);
  const expiredOrNear = inventory.filter(i => i.expiryStatus === 'Expired' || i.expiryStatus?.includes('Days')).length;
  const pendingRequests = stockRequests.filter(r => r.Status === 'Pending').length;

  const getExpiryBadge = (status?: string) => {
    if (!status || status === 'Healthy') {
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">Healthy</span>;
    }
    if (status === 'Expired') {
      return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-600 border border-rose-500/20">Expired</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">{status}</span>;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6 min-h-full font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-primary uppercase tracking-wider mb-1">
            <Database className="w-4 h-4" /> Warehouse Operations
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Inventory Control & Stock Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Live Azure SQL warehouse registry, stock requests, and distribution history.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchData}
            disabled={loading}
            className="px-3.5 py-2 bg-card border border-border/50 rounded-xl text-xs font-bold text-foreground hover:bg-muted/40 transition-all shadow-xs flex items-center gap-2"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-[16px] border border-border/50 bg-card/60 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Active Lots</span>
            <div className="p-2 bg-primary/10 rounded-xl text-primary"><Layers className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground">{totalLots}</p>
          <p className="text-xs text-muted-foreground mt-1">Tracked in warehouse</p>
        </div>

        <div className="p-5 rounded-[16px] border border-border/50 bg-card/60 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Total Stock Units</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-600"><Package className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground">{totalStockUnits.toLocaleString()}</p>
          <p className="text-xs text-emerald-600 font-medium mt-1">Physical balance</p>
        </div>

        <div className="p-5 rounded-[16px] border border-border/50 bg-card/60 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Expiry Alerts</span>
            <div className="p-2 bg-amber-500/10 rounded-xl text-amber-600"><AlertTriangle className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground">{expiredOrNear}</p>
          <p className="text-xs text-amber-600 font-medium mt-1">Expired or near expiry</p>
        </div>

        <div className="p-5 rounded-[16px] border border-border/50 bg-card/60 backdrop-blur-xl shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Pending Requests</span>
            <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600"><FileText className="w-4 h-4" /></div>
          </div>
          <p className="text-2xl font-extrabold text-foreground">{pendingRequests}</p>
          <p className="text-xs text-blue-600 font-medium mt-1">From clinics & pharmacy</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border/50 pb-2">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'inventory'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          Warehouse Lots ({filteredInventory.length})
        </button>
        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'requests'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          Stock Requests ({stockRequests.length})
          {pendingRequests > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
              {pendingRequests}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'history'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/40'
          }`}
        >
          Distribution History ({distributions.length})
        </button>
      </div>

      {/* TAB 1: LIVE INVENTORY */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by medicine name, generic name, lot number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-card border border-border/50 rounded-xl text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3.5 py-2.5 bg-card border border-border/50 rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {categories.map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Categories' : c}</option>
              ))}
            </select>
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 border-b border-border/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-3.5">Medicine Name</th>
                    <th className="px-6 py-3.5">Category</th>
                    <th className="px-6 py-3.5">Lot / Batch</th>
                    <th className="px-6 py-3.5 text-center">Expiry Date</th>
                    <th className="px-6 py-3.5 text-center">Status</th>
                    <th className="px-6 py-3.5 text-right">Qty Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredInventory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-xs font-medium">
                        No warehouse inventory matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredInventory.map(item => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-foreground">{item.medicineName}</p>
                          {item.genericName && (
                            <p className="text-xs text-muted-foreground">{item.genericName}</p>
                          )}
                        </td>
                        <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                          {item.categoryName || 'General'}
                        </td>
                        <td className="px-6 py-4 text-xs font-mono font-medium text-foreground">
                          {item.lotNumber || item.batchNumber || '—'}
                        </td>
                        <td className="px-6 py-4 text-center text-xs font-medium text-muted-foreground">
                          {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {getExpiryBadge(item.expiryStatus)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className={`text-sm font-extrabold ${
                            item.quantityAvailable <= 50 ? 'text-destructive' : 'text-primary'
                          }`}>
                            {item.quantityAvailable.toLocaleString()}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: RESTOCK REQUESTS */}
      {activeTab === 'requests' && (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Request ID</th>
                  <th className="px-6 py-3.5">Requester</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {stockRequests.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-xs font-medium">
                      No stock requests found.
                    </td>
                  </tr>
                ) : (
                  stockRequests.map(r => (
                    <tr key={r.RequestID} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-foreground">
                        #SR-{String(r.RequestID).padStart(5, '0')}
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-foreground">
                        {r.RequesterName || 'Department Requester'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          r.Status === 'Pending' ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20' :
                          r.Status === 'Accepted' ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20' :
                          'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                        }`}>
                          {r.Status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => viewRequestDetails(r)}
                          className="px-3.5 py-1.5 bg-card border border-border/50 rounded-xl text-xs font-bold hover:bg-muted/40 transition-all shadow-xs"
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DISTRIBUTION HISTORY */}
      {activeTab === 'history' && (
        <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 border-b border-border/50 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Distribution Ref</th>
                  <th className="px-6 py-3.5">Destination Facility</th>
                  <th className="px-6 py-3.5">Date</th>
                  <th className="px-6 py-3.5 text-center">Items</th>
                  <th className="px-6 py-3.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {distributions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-xs font-medium">
                      No distribution records logged.
                    </td>
                  </tr>
                ) : (
                  distributions.map(d => (
                    <tr key={d.DistributionID} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-foreground">
                        {d.DistributionNumber || `DST-${d.DistributionID}`}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-foreground">
                        {d.DestinationFacility || 'Health Center / Pharmacy'}
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-muted-foreground">
                        {d.DistributionDate ? new Date(d.DistributionDate).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-bold text-foreground">
                        {d.ItemCount || 1}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          {d.Status || 'Released'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REQUEST DETAILS MODAL */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card border border-border/50 w-full max-w-2xl rounded-2xl shadow-2xl p-6 space-y-5 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-extrabold text-foreground tracking-tight">
                  Request Details #SR-{String(selectedRequest.RequestID).padStart(5, '0')}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">Review restock request from clinic</p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-2 hover:bg-muted/50 rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 bg-muted/30 rounded-xl border border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Requester</p>
                  <p className="text-sm font-bold text-foreground">{selectedRequest.RequesterName || 'N/A'}</p>
                </div>
                <div className="p-3.5 bg-muted/30 rounded-xl border border-border/40">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Current Status</p>
                  <p className="text-sm font-extrabold text-primary uppercase">{selectedRequest.Status}</p>
                </div>
              </div>

              <div className="border border-border/50 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 border-b border-border/50 font-bold text-muted-foreground uppercase">
                    <tr>
                      <th className="px-4 py-2.5">Medicine</th>
                      <th className="px-4 py-2.5 text-center">Quantity</th>
                      <th className="px-4 py-2.5 text-right">Unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {selectedRequest.details?.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-3 font-bold text-foreground">{item.ProductName}</td>
                        <td className="px-4 py-3 text-center font-extrabold text-primary">{item.QuantityRequested}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{item.UnitName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedRequest.Remarks && (
                <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600">
                  <strong>Remarks:</strong> {selectedRequest.Remarks}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-border/50 shrink-0">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 bg-card border border-border/50 rounded-xl text-xs font-bold text-foreground hover:bg-muted/40 transition-all"
              >
                Close
              </button>
              {selectedRequest.Status === 'Pending' && (
                <button
                  onClick={() => handleUpdateStatus(selectedRequest.RequestID, 'Accepted')}
                  disabled={isUpdatingStatus}
                  className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-all shadow-xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" /> Accept Request
                </button>
              )}
              {selectedRequest.Status === 'Accepted' && (
                <button
                  onClick={() => handleUpdateStatus(selectedRequest.RequestID, 'Completed')}
                  disabled={isUpdatingStatus}
                  className="px-5 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-all shadow-xs flex items-center gap-1.5"
                >
                  <PackagePlus className="w-4 h-4" /> Mark Completed
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default InventoryScreen;
