import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  X,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Send,
  Package,
  Truck,
  Building2,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { PharmacyStockRequest, PharmacyStockRequestItem, PharmacyRequestableMedicine } from '../../types';
import { PharmacyTab } from '../Layout/PharmacyLayout';
import { PharmacyMedicineSelector } from './PharmacyMedicineSelector';

interface PharmacyStockRequestsProps {
  onNavigate?: (tab: PharmacyTab) => void;
  onRequestCreated?: () => void;
}

export function PharmacyStockRequests({ onNavigate, onRequestCreated }: PharmacyStockRequestsProps = {}) {
  const [requests, setRequests] = useState<PharmacyStockRequest[]>([]);
  const [medicines, setMedicines] = useState<PharmacyRequestableMedicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [priority, setPriority] = useState<'Routine' | 'Urgent' | 'Emergency'>('Routine');
  const [purpose, setPurpose] = useState('City Pharmacy Monthly Replenishment');
  const [requiredDate, setRequiredDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [requestItems, setRequestItems] = useState<{ medicineId: number; quantity: number | string }[]>([
    { medicineId: 0, quantity: '' },
  ]);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, PharmacyStockRequestItem[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<number, boolean>>({});

  const loadData = async () => {
    try {
      setLoading(true);
      const [reqs, meds] = await Promise.all([
        pharmacyApi.getStockRequests('ALL'),
        pharmacyApi.getMedicinesForRequest().catch(() => pharmacyApi.getWarehouseMedicines().catch(() => [])),
      ]);
      setRequests(Array.isArray(reqs) ? reqs : []);
      setMedicines(Array.isArray(meds) ? meds : []);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load stock requests' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleToggleExpand = async (requestId: number) => {
    if (expandedId === requestId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(requestId);
    if (!expandedItems[requestId]) {
      setLoadingItems((prev) => ({ ...prev, [requestId]: true }));
      try {
        const details = await pharmacyApi.getStockRequestDetails(requestId);
        setExpandedItems((prev) => ({ ...prev, [requestId]: details.items || [] }));
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Failed to load request items' });
      } finally {
        setLoadingItems((prev) => ({ ...prev, [requestId]: false }));
      }
    }
  };

  const handleOpenModal = () => {
    setIsModalOpen(true);
    setFeedback(null);
    if (medicines.length === 0) {
      setLoadingMeds(true);
      pharmacyApi.getMedicinesForRequest()
        .then(meds => setMedicines(Array.isArray(meds) ? meds : []))
        .catch(() => {})
        .finally(() => setLoadingMeds(false));
    }
  };

  const handleAddItem = () => {
    setRequestItems((prev) => [...prev, { medicineId: 0, quantity: '' }]);
  };

  const handleRemoveItem = (idx: number) => {
    if (requestItems.length === 1) return;
    setRequestItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleItemChange = (idx: number, field: 'medicineId' | 'quantity', val: any) => {
    setRequestItems((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const totalRequestedUnits = useMemo(() => {
    return requestItems.reduce((acc, curr) => acc + (Number(curr.quantity) || 0), 0);
  }, [requestItems]);

  const selectedMedicinesCount = useMemo(() => {
    return requestItems.filter(i => i.medicineId > 0).length;
  }, [requestItems]);

  const selectedMedicineIds = useMemo(() => {
    return requestItems.map(i => i.medicineId).filter(id => id > 0);
  }, [requestItems]);

  const totalEstimatedShortage = useMemo(() => {
    return requestItems.reduce((acc, item) => {
      const qty = Number(item.quantity) || 0;
      if (!item.medicineId || qty <= 0) return acc;
      const med = medicines.find(m => Number(m.id || m.MedicineID) === Number(item.medicineId));
      const avail = Number(med?.warehouseStock ?? 0);
      return acc + Math.max(0, qty - avail);
    }, 0);
  }, [requestItems, medicines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purpose.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a purpose for the stock request.' });
      return;
    }

    const sanitizedItems = requestItems
      .filter((i) => i.medicineId > 0 && Number(i.quantity) > 0)
      .map((i) => ({
        medicineId: Number(i.medicineId),
        quantity: Math.floor(Number(i.quantity)),
      }));

    if (sanitizedItems.length === 0) {
      setFeedback({
        type: 'error',
        message: 'Please select at least one medicine and specify a valid quantity greater than zero.',
      });
      return;
    }

    // Check if any row is incomplete
    const hasIncompleteRow = requestItems.some(
      i => (i.medicineId === 0 && (Number(i.quantity) > 0)) || (i.medicineId > 0 && (!i.quantity || Number(i.quantity) <= 0))
    );
    if (hasIncompleteRow) {
      setFeedback({
        type: 'error',
        message: 'Please complete or remove any incomplete medicine line items before submitting.',
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const res = await pharmacyApi.createStockRequest({
        priority,
        purpose: purpose.trim(),
        requiredDate: requiredDate || undefined,
        remarks: remarks.trim() || undefined,
        items: sanitizedItems,
      });
      setFeedback({
        type: 'success',
        message: `Stock Request ${res.requestNumber} submitted (${res.status}) to Central Warehouse for administrative review.`,
      });
      setIsModalOpen(false);
      setPurpose('City Pharmacy Monthly Replenishment');
      setRequiredDate('');
      setRemarks('');
      setRequestItems([{ medicineId: 0, quantity: '' }]);
      await loadData();
      if (onRequestCreated) onRequestCreated();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to submit stock request' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const normStatus = (st?: string) => String(st || '').trim().toUpperCase().replace(/\s+/g, '_');

  const filteredRequests = requests.filter((r) => {
    const s = search.toLowerCase();
    const matchSearch =
      r.RequestNumber.toLowerCase().includes(s) ||
      (r.Purpose || '').toLowerCase().includes(s) ||
      (r.Remarks || '').toLowerCase().includes(s);
    let matchStatus = true;
    const ns = normStatus(r.Status);
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'SUBMITTED') {
        matchStatus = ['SUBMITTED', 'PENDING', 'UNDER_REVIEW'].includes(ns);
      } else if (statusFilter === 'APPROVED') {
        matchStatus = ['APPROVED', 'RESERVED', 'READY_FOR_FULFILLMENT'].includes(ns);
      } else if (statusFilter === 'STOCK_UNAVAILABLE') {
        matchStatus = ns === 'STOCK_UNAVAILABLE';
      } else if (statusFilter === 'PARTIALLY_FULFILLED') {
        matchStatus = ['PARTIALLY_FULFILLED', 'PARTIALLY_APPROVED', 'PARTIALLY_RECEIVED'].includes(ns);
      } else if (statusFilter === 'ISSUED') {
        matchStatus = ['ISSUED', 'READY_FOR_ISSUANCE', 'IN_TRANSIT'].includes(ns);
      } else if (statusFilter === 'FULFILLED') {
        matchStatus = ['FULFILLED', 'COMPLETED', 'RECEIVED'].includes(ns);
      } else {
        matchStatus = ns === normStatus(statusFilter);
      }
    }
    return matchSearch && matchStatus;
  });

  const getStatusBadge = (st: string) => {
    const ns = normStatus(st);
    switch (ns) {
      case 'FULFILLED':
      case 'COMPLETED':
      case 'RECEIVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
            {ns === 'FULFILLED' ? 'Fulfilled' : st}
          </span>
        );
      case 'APPROVED':
      case 'READY_FOR_FULFILLMENT':
      case 'RESERVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-500/15 text-teal-600 dark:text-teal-400 border border-teal-500/30">
            {ns === 'READY_FOR_FULFILLMENT' ? 'Ready for Fulfillment' : 'Approved'}
          </span>
        );
      case 'STOCK_UNAVAILABLE':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            Stock Unavailable (Approved)
          </span>
        );
      case 'PARTIALLY_APPROVED':
      case 'PARTIALLY_FULFILLED':
      case 'PARTIALLY_RECEIVED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
            {ns === 'PARTIALLY_RECEIVED' ? 'Partially Received' : 'Partially Fulfilled'}
          </span>
        );
      case 'READY_FOR_ISSUANCE':
      case 'ISSUED':
      case 'IN_TRANSIT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30">
            {st}
          </span>
        );
      case 'REJECTED':
      case 'CANCELLED':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
            {ns === 'REJECTED' ? 'Rejected' : 'Cancelled'}
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30">
            Under Review
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
            {ns === 'SUBMITTED' ? 'Submitted' : (st || 'Submitted')}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between border shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-bold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75 transition-opacity"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Controls Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3.5 sm:p-4 rounded-2xl border border-border shadow-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search request #, purpose..."
              className="w-full pl-9 pr-3 py-2 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted / Under Review</option>
            <option value="APPROVED">Approved</option>
            <option value="STOCK_UNAVAILABLE">Stock Unavailable</option>
            <option value="PARTIALLY_FULFILLED">Partially Fulfilled</option>
            <option value="ISSUED">Issued / In Transit</option>
            <option value="FULFILLED">Fulfilled / Completed</option>
            <option value="REJECTED">Rejected</option>
            <option value="CANCELLED">Cancelled</option>
          </select>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Reload Stock Requests"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-500' : ''}`} />
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenModal}
          className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Request</span>
        </button>
      </div>

      {/* Requests List */}
      <div className="space-y-3">
        {loading && requests.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground text-xs">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-500" />
            Loading pharmacy stock requests...
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-2xl bg-card text-muted-foreground text-xs space-y-3">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p className="font-bold text-foreground text-sm">No Stock Requests Found</p>
            <p className="max-w-md mx-auto text-muted-foreground text-xs">
              {search
                ? 'No requests match your current search criteria.'
                : 'You have not submitted any stock replenishment requests to Central Warehouse yet.'}
            </p>
            {!search && (
              <button
                type="button"
                onClick={handleOpenModal}
                className="mt-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs inline-flex items-center gap-1.5 shadow-sm shadow-emerald-600/20 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Request</span>
              </button>
            )}
          </div>
        ) : (
          filteredRequests.map((req) => {
            const isExpanded = expandedId === req.StockRequestID;
            const items = expandedItems[req.StockRequestID] || [];
            const isItemsLoading = loadingItems[req.StockRequestID];

            return (
              <div
                key={req.StockRequestID}
                className="border border-border rounded-2xl bg-card overflow-hidden shadow-xs transition-colors hover:border-emerald-500/40"
              >
                <div
                  onClick={() => handleToggleExpand(req.StockRequestID)}
                  className="p-4 sm:p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 font-bold">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs sm:text-sm text-foreground">
                          {req.RequestNumber}
                        </span>
                        {getStatusBadge(req.Status)}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          req.Priority === 'Emergency'
                            ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                            : req.Priority === 'Urgent'
                              ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                              : 'bg-muted text-muted-foreground'
                        }`}>
                          {req.Priority}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {req.Purpose || 'City Pharmacy Replenishment'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-muted-foreground border-t sm:border-t-0 pt-2 sm:pt-0">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground/70">
                        Date Requested
                      </span>
                      <span className="font-semibold text-foreground">
                        {new Date(req.CreatedDate).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="block text-[10px] uppercase font-bold text-muted-foreground/70">
                        Line Items
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {req.ItemCount || 0} items
                      </span>
                    </div>

                    <button
                      type="button"
                      className="p-1 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-border/60 bg-muted/20 p-4 space-y-3">
                    {/* Rejection Alert */}
                    {req.RejectionReason && (
                      <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-300 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Official Rejection Reason: </span>
                          <span>{req.RejectionReason}</span>
                        </div>
                      </div>
                    )}

                    {/* Request Metadata Badges (Required Date & Remarks) */}
                    {(req.RequiredDate || req.Remarks) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        {req.RequiredDate && (
                          <div className="p-2.5 rounded-xl bg-card border border-border">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground block">Required By</span>
                            <span className="font-semibold text-foreground">{new Date(req.RequiredDate).toLocaleDateString()}</span>
                          </div>
                        )}
                        {req.Remarks && (
                          <div className="p-2.5 rounded-xl bg-card border border-border">
                            <span className="text-[10px] font-bold uppercase text-muted-foreground block">Request Remarks</span>
                            <span className="text-foreground">{req.Remarks}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Admin Remarks Alert */}
                    {req.AdminRemarks && (
                      <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-300 text-xs flex items-start gap-2">
                        <Info className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Warehouse Admin Remarks: </span>
                          <span>{req.AdminRemarks}</span>
                        </div>
                      </div>
                    )}

                    {/* Stock Shortage Note Alert */}
                    {req.ShortageNotes && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Warehouse Stock Shortage Notice: </span>
                          <span>{req.ShortageNotes}</span>
                        </div>
                      </div>
                    )}

                    {/* Dispatched Delivery Action Bar */}
                    {(['ISSUED', 'READY_FOR_ISSUANCE', 'PARTIALLY_FULFILLED', 'PARTIALLY_RECEIVED'].includes(normStatus(req.Status)) || req.DistributionNumber) && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-xs">
                        <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 font-medium">
                          <Truck className="w-4 h-4 shrink-0 text-cyan-500" />
                          <span>
                            Stock dispatched by Warehouse. {req.DistributionNumber ? `Distribution #${req.DistributionNumber}` : ''}
                          </span>
                        </div>
                        {onNavigate && (
                          <button
                            type="button"
                            onClick={() => onNavigate('receiving')}
                            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Confirm Physical Receipt</span>
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="font-bold text-foreground">
                        Requested Medicines & Fulfillment Allocation
                      </span>
                      {req.DistributionNumber && onNavigate && (
                        <button
                          type="button"
                          onClick={() => onNavigate('receiving')}
                          className="text-[11px] font-bold text-emerald-500 hover:underline flex items-center gap-1"
                        >
                          <Truck className="w-3 h-3" />
                          <span>Distribution #{req.DistributionNumber}</span>
                        </button>
                      )}
                    </div>

                    {isItemsLoading ? (
                      <div className="py-4 text-center text-xs text-muted-foreground">
                        <RefreshCw className="w-4 h-4 animate-spin mx-auto mb-1 text-emerald-500" />
                        Loading requested items...
                      </div>
                    ) : items.length === 0 ? (
                      <div className="py-3 text-center text-xs text-muted-foreground">
                        No line item details found for this request.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-3 py-1.5 bg-muted/40 rounded-lg">
                          <div className="col-span-5 sm:col-span-4">Medicine</div>
                          <div className="col-span-2 text-right">Requested</div>
                          <div className="col-span-2 text-right">Approved</div>
                          <div className="col-span-3 sm:col-span-2 text-right">Released</div>
                          <div className="hidden sm:block sm:col-span-2 text-right">Remaining / WH</div>
                        </div>

                        {items.map((line, idx) => {
                          const rem = line.RemainingQuantity ?? Math.max(0, (line.QuantityApproved ?? line.QuantityRequested) - (line.QuantityReleased ?? 0));
                          const shortage = line.ShortageQuantity ?? 0;
                          return (
                            <div
                              key={idx}
                              className="grid grid-cols-12 gap-2 p-3 rounded-xl bg-card border border-border text-xs items-center"
                            >
                              <div className="col-span-5 sm:col-span-4">
                                <p className="font-bold text-foreground">{line.ProductName}</p>
                                {line.GenericName && line.GenericName !== line.ProductName && (
                                  <p className="text-[10px] text-muted-foreground">
                                    Generic: {line.GenericName}
                                  </p>
                                )}
                                {line.UnitName && (
                                  <span className="text-[10px] text-muted-foreground font-mono">{line.UnitName}</span>
                                )}
                              </div>
                              <div className="col-span-2 text-right font-mono font-bold text-foreground">
                                {line.QuantityRequested}
                              </div>
                              <div className="col-span-2 text-right font-mono">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {line.QuantityApproved ?? 'Pending'}
                                </span>
                              </div>
                              <div className="col-span-3 sm:col-span-2 text-right font-mono">
                                <span className="font-bold text-primary">
                                  {line.QuantityReleased ?? 0}
                                </span>
                              </div>
                              <div className="col-span-12 sm:col-span-2 text-right font-mono text-[11px]">
                                <span className={rem > 0 ? 'font-bold text-amber-600 dark:text-amber-400' : 'text-emerald-500 font-bold'}>
                                  Rem: {rem}
                                </span>
                                {typeof line.AvailableStock === 'number' && (
                                  <span className="block text-[10px] text-muted-foreground">
                                    WH Avail: {line.AvailableStock}{shortage > 0 ? ` (Short: ${shortage})` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Modern Redesigned New Stock Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmit}
            className="bg-card border border-border rounded-3xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200 my-auto"
          >
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-600/20 flex items-center justify-center font-bold shrink-0">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black text-foreground">
                    New Stock Request to Central Warehouse
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Select medicines and quantities to replenish City Pharmacy stock
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
              {/* SECTION 1 — REQUEST INFORMATION */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black flex items-center justify-center">
                    1
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Request Information
                  </h4>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 bg-muted/20 p-4 rounded-2xl border border-border/60">
                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">
                      Priority Level <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-xs sm:text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    >
                      <option value="Routine">Routine (Regular Monthly Stock)</option>
                      <option value="Urgent">Urgent (Low Critical Stock)</option>
                      <option value="Emergency">Emergency (Immediate Out of Stock)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">
                      Request Purpose <span className="text-destructive">*</span>
                    </label>
                    <input
                      type="text"
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g. City Pharmacy Monthly Replenishment"
                      className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">
                      Required Date <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="date"
                      value={requiredDate}
                      onChange={(e) => setRequiredDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-xs sm:text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-foreground block mb-1.5">
                      Request Remarks <span className="text-[10px] text-muted-foreground font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Clinical need, buffer stock note, etc."
                      className="w-full px-3.5 py-2.5 bg-background border border-input rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2 — MEDICINE LINE ITEMS */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black flex items-center justify-center">
                      2
                    </span>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Medicine Line Items ({requestItems.length})
                    </h4>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors inline-flex items-center gap-1.5 border border-emerald-500/25 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Medicine</span>
                  </button>
                </div>

                {loadingMeds ? (
                  <div className="p-8 text-center text-muted-foreground text-xs bg-muted/10 rounded-2xl border border-dashed border-border">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-emerald-500" />
                    Loading authoritative medicine catalog...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {requestItems.map((item, idx) => {
                      const selectedMed = medicines.find(
                        m => Number(m.id || m.MedicineID) === Number(item.medicineId)
                      );

                      return (
                        <div
                          key={idx}
                          className="p-3.5 sm:p-4 rounded-2xl bg-muted/30 border border-border space-y-3 relative transition-colors hover:border-emerald-500/40"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-mono font-bold text-muted-foreground">
                              Line #{idx + 1}
                            </span>
                            {requestItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-1 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                                title="Remove line item"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-stretch">
                            {/* Searchable Medicine Selector */}
                            <div className="sm:col-span-8 flex flex-col">
                              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1.5">
                                Medicine <span className="text-destructive">*</span>
                              </label>
                              <PharmacyMedicineSelector
                                value={item.medicineId}
                                onChange={(medId) => handleItemChange(idx, 'medicineId', medId)}
                                medicines={medicines}
                                disabledMedicineIds={selectedMedicineIds}
                                placeholder="Search or select a medicine..."
                                className="flex-1 flex flex-col [&>button]:flex-1"
                              />
                            </div>

                            {/* Quantity Input */}
                            <div className="sm:col-span-4 flex flex-col">
                              <label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground block mb-1.5">
                                Quantity <span className="text-destructive">*</span>
                              </label>
                              <div className="flex items-stretch flex-1 min-h-[46px] bg-background/95 border border-input rounded-xl overflow-hidden shadow-xs focus-within:ring-2 focus-within:ring-emerald-500/40 focus-within:border-emerald-500 transition-all">
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  step={1}
                                  value={item.quantity}
                                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                                  placeholder="Enter qty"
                                  className="w-full min-w-0 flex-1 bg-transparent px-3.5 py-2 text-xs sm:text-sm font-bold text-foreground text-right placeholder:text-muted-foreground/70 placeholder:font-medium focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                />
                                {selectedMed?.unitName && (
                                  <div
                                    className="shrink-0 flex items-center px-3 bg-muted/40 border-l border-border/60 select-none"
                                    title={selectedMed.unitName}
                                  >
                                    <span className="text-[11px] font-semibold text-muted-foreground max-w-[84px] truncate">
                                      {selectedMed.unitName}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Line Item Stock & Shortage Indicator Summary */}
                          {selectedMed && (() => {
                            const enteredQty = Number(item.quantity) || 0;
                            const whAvail = Number(selectedMed.warehouseStock || 0);
                            const lineShortage = enteredQty > 0 ? Math.max(0, enteredQty - whAvail) : (whAvail === 0 ? 0 : 0);
                            return (
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span>
                                    Pharmacy Usable:{' '}
                                    <strong className={selectedMed.pharmacyStock > 0 ? 'text-emerald-500 font-bold' : 'text-rose-500 font-bold'}>
                                      {selectedMed.pharmacyStock.toLocaleString()}
                                    </strong>
                                  </span>
                                  <span>•</span>
                                  <span>
                                    Warehouse Available Stock:{' '}
                                    <strong className={whAvail > 0 ? 'text-blue-500 font-bold' : 'text-amber-500 font-bold'}>
                                      {whAvail.toLocaleString()}
                                    </strong>
                                  </span>
                                  {enteredQty > 0 && (
                                    <>
                                      <span>•</span>
                                      <span>
                                        Estimated Shortage:{' '}
                                        <strong className={lineShortage > 0 ? 'text-amber-500 font-bold' : 'text-emerald-500 font-bold'}>
                                          {lineShortage.toLocaleString()}
                                        </strong>
                                      </span>
                                    </>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                  {whAvail === 0 && (
                                    <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                                      WH Out of Stock (Allowed to Request)
                                    </span>
                                  )}
                                  {selectedMed.pharmacyStock === 0 && (
                                    <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20">
                                      Pharmacy Empty
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* SECTION 3 — REQUEST SUMMARY */}
              <div className="p-4 rounded-2xl bg-muted/20 border border-border/60 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black flex items-center justify-center">
                    3
                  </span>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Request Summary
                  </h4>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-card border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Medicines Selected
                    </span>
                    <span className="text-base sm:text-lg font-black text-foreground">
                      {selectedMedicinesCount} of {requestItems.length}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Total Units Requested
                    </span>
                    <span className="text-base sm:text-lg font-black text-emerald-600 dark:text-emerald-400">
                      {totalRequestedUnits.toLocaleString()} units
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-card border border-border">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                      Estimated WH Shortage
                    </span>
                    <span className={`text-base sm:text-lg font-black ${totalEstimatedShortage > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {totalEstimatedShortage.toLocaleString()} units
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-card border border-border text-xs flex items-center justify-between">
                  <span className="text-muted-foreground font-semibold">Requesting Facility</span>
                  <span className="font-bold text-foreground">City Health Pharmacy (Destination)</span>
                </div>

                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[11px] text-muted-foreground mt-2">
                  <Info className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                  <span>
                    Requests can be submitted even when Central Warehouse stock is zero. Warehouse Administrators review and approve the request first; physical stock release happens separately only when eligible batches are available.
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-border bg-muted/30 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs sm:text-sm font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || selectedMedicinesCount === 0 || totalRequestedUnits === 0}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-black flex items-center gap-2 shadow-md shadow-emerald-600/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Submitting Request...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Submit Stock Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
