import React, { useEffect, useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  ChevronDown,
  ChevronRight,
  X,
  Trash2,
  Send,
} from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';
import { BarangayStockRequest, StockRequestLineDetail } from '../types';
import { submitStockRequest, fetchStockRequestDetails } from '../api';

interface BarangayStockRequestsProps {
  userId: number | null;
  requests: BarangayStockRequest[];
  medicines: any[];
  initialSelectedRequestId?: number | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export function BarangayStockRequests({
  userId,
  requests,
  medicines,
  initialSelectedRequestId = null,
  onRefresh,
}: BarangayStockRequestsProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Request Form State
  const [priority, setPriority] = useState<'Routine' | 'Urgent' | 'Emergency'>('Routine');
  const [purpose, setPurpose] = useState('');
  const [medSearch, setMedSearch] = useState('');
  const [requestItems, setRequestItems] = useState<{ medicineId: number; quantity: number; notes: string }[]>([
    { medicineId: 0, quantity: 10, notes: '' },
  ]);

  // Expanded items state
  const [expandedRequestId, setExpandedRequestId] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Record<number, StockRequestLineDetail[]>>({});
  const [loadingItems, setLoadingItems] = useState<Record<number, boolean>>({});

  const loadLineItems = async (requestId: number) => {
    setExpandedRequestId(requestId);
    if (!expandedItems[requestId]) {
      setLoadingItems((prev) => ({ ...prev, [requestId]: true }));
      try {
        const details = await fetchStockRequestDetails(requestId, userId);
        setExpandedItems((prev) => ({ ...prev, [requestId]: details.items || [] }));
      } catch (err: any) {
        toast.error('Failed to load line items: ' + err.message);
      } finally {
        setLoadingItems((prev) => ({ ...prev, [requestId]: false }));
      }
    }
  };

  useEffect(() => {
    if (initialSelectedRequestId) {
      loadLineItems(initialSelectedRequestId);
    }
  }, [initialSelectedRequestId]);

  const handleToggleExpand = async (requestId: number) => {
    if (expandedRequestId === requestId) {
      setExpandedRequestId(null);
      return;
    }
    await loadLineItems(requestId);
  };

  const handleAddItem = () => {
    setRequestItems((prev) => [...prev, { medicineId: 0, quantity: 10, notes: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (requestItems.length === 1) return;
    setRequestItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setRequestItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!purpose.trim()) {
      toast.error('Please specify the purpose for this stock request.');
      return;
    }

    const validItems = requestItems.filter((i) => i.medicineId > 0 && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one medicine with a valid quantity.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await submitStockRequest(userId, {
        priority,
        purpose: purpose.trim(),
        items: validItems,
      });
      toast.success(`Stock request ${res.requestNumber} submitted to Central Warehouse!`);
      setIsModalOpen(false);
      setPurpose('');
      setMedSearch('');
      setRequestItems([{ medicineId: 0, quantity: 10, notes: '' }]);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit stock request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    const s = search.toLowerCase();
    const matchSearch =
      r.RequestNumber.toLowerCase().includes(s) || (r.Purpose || '').toLowerCase().includes(s);
    const matchStatus =
      statusFilter === 'ALL' ||
      r.Status === statusFilter ||
      (statusFilter === 'Submitted' && (r.Status as string) === 'Pending') ||
      (statusFilter === 'Completed' && (r.Status as string) === 'Fulfilled');
    return matchSearch && matchStatus;
  });

  const filteredCatalog = medicines.filter((m: any) => {
    if (!medSearch.trim()) return true;
    const q = medSearch.toLowerCase();
    return (
      (m.ProductName || '').toLowerCase().includes(q) ||
      (m.GenericName || '').toLowerCase().includes(q)
    );
  });

  const summaryValidCount = requestItems.filter((i) => i.medicineId > 0 && i.quantity > 0).length;
  const summaryTotalQty = requestItems.reduce(
    (s, i) => s + (i.medicineId > 0 && i.quantity > 0 ? i.quantity : 0),
    0
  );

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'Emergency':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            Emergency
          </span>
        );
      case 'Urgent':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            Urgent
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            Routine
          </span>
        );
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'Completed':
      case 'Fulfilled':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            {st === 'Fulfilled' ? 'Fulfilled' : 'Completed'}
          </span>
        );
      case 'Approved':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            Approved
          </span>
        );
      case 'Partially Fulfilled':
      case 'Partially Approved':
      case 'Partially Received':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30">
            {st}
          </span>
        );
      case 'Under Review':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            Under Review
          </span>
        );
      case 'Rejected':
      case 'Cancelled':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/30">
            {st}
          </span>
        );
      case 'Draft':
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-secondary text-muted-foreground border border-border">
            Draft
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-foreground border border-primary/25">
            {st === 'Pending' ? 'Submitted' : st}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Station Stock Requests
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submit replenishment requests to Central Warehouse and track approval &amp; dispatch status
          </p>
        </div>

        <Button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 rounded-xl px-4 shadow-xs flex items-center justify-center gap-1.5 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Stock Request</span>
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <Card className="rounded-2xl border-border bg-card shadow-xs p-3.5 sm:p-4 space-y-3">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Request Number or Purpose..."
            className="pl-9 pr-9 text-xs rounded-xl h-10 border-border"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar pt-2 border-t border-border/60">
          {['ALL', 'Submitted', 'Approved', 'Partially Fulfilled', 'Completed', 'Rejected'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors min-h-[34px] ${
                statusFilter === st
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-secondary/70 text-muted-foreground hover:bg-secondary hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </Card>

      {/* MOBILE VIEW (< 768px): Tap-to-Expand Cards */}
      <div className="block md:hidden space-y-3">
        {filteredRequests.length === 0 ? (
          <Card className="rounded-2xl border-border bg-card shadow-xs p-8 text-center text-muted-foreground">
            <FileText className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-bold text-sm text-foreground">No stock requests found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap &ldquo;New Stock Request&rdquo; to requisition medicines from Central Warehouse.
            </p>
          </Card>
        ) : (
          filteredRequests.map((req) => {
            const isExpanded = expandedRequestId === req.StockRequestID;
            return (
              <Card
                key={req.StockRequestID}
                className="rounded-2xl border-border bg-card shadow-xs overflow-hidden"
              >
                <div
                  onClick={() => handleToggleExpand(req.StockRequestID)}
                  className="p-4 space-y-2.5 cursor-pointer hover:bg-secondary/40 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-black text-sm text-primary">{req.RequestNumber}</span>
                    <div className="flex items-center gap-1.5">
                      {getPriorityBadge(req.Priority)}
                      {getStatusBadge(req.Status)}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 font-medium">{req.Purpose}</p>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-border/60 text-muted-foreground">
                    <span>
                      <strong className="text-foreground">{req.ItemCount || 0}</strong> medicines (
                      {req.TotalQuantityRequested || 0} units)
                    </span>
                    <div className="flex items-center gap-1 text-[11px]">
                      <span>{new Date(req.CreatedDate).toLocaleDateString()}</span>
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-foreground" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-3 bg-secondary/40 border-t border-border space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Requested Line Items
                    </div>
                    {loadingItems[req.StockRequestID] ? (
                      <div className="py-2 text-xs text-muted-foreground text-center">Loading items...</div>
                    ) : (
                      <div className="space-y-2">
                        {(expandedItems[req.StockRequestID] || []).map((line) => (
                          <div
                            key={line.StockRequestItemID}
                            className="p-2.5 rounded-xl bg-card border border-border text-xs space-y-1"
                          >
                            <div className="font-bold text-foreground">{line.ProductName}</div>
                            {line.GenericName && (
                              <div className="text-[10px] text-muted-foreground">{line.GenericName}</div>
                            )}
                            <div className="flex justify-between items-center text-[11px] pt-1 border-t border-border/50">
                              <span className="text-muted-foreground">
                                Req:{' '}
                                <strong className="text-foreground">
                                  {line.QuantityRequested} {line.UnitName || 'units'}
                                </strong>
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400">
                                Appr: <strong>{line.QuantityApproved || 0}</strong>
                              </span>
                              <span className="text-primary font-bold">
                                Rel: <strong>{line.QuantityReleased || 0}</strong>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* DESKTOP & TABLET VIEW (>= 768px): Expandable Table */}
      <Card className="hidden md:block rounded-2xl border-border bg-card shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/70 border-b border-border text-muted-foreground font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 w-10"></th>
                <th className="py-3.5 px-4">Request #</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Purpose</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Items / Qty</th>
                <th className="py-3.5 px-4">Requested Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="font-semibold text-sm text-foreground">No stock requests found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Click &ldquo;New Stock Request&rdquo; to requisition medicines from Central Warehouse.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredRequests.map((req) => {
                  const isExpanded = expandedRequestId === req.StockRequestID;
                  return (
                    <React.Fragment key={req.StockRequestID}>
                      <tr
                        onClick={() => handleToggleExpand(req.StockRequestID)}
                        className="hover:bg-secondary/50 cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4 text-center">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-primary" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono font-black text-primary">
                          {req.RequestNumber}
                        </td>
                        <td className="py-3 px-4">{getPriorityBadge(req.Priority)}</td>
                        <td className="py-3 px-4 max-w-xs truncate text-muted-foreground font-medium">
                          {req.Purpose}
                        </td>
                        <td className="py-3 px-4">{getStatusBadge(req.Status)}</td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {req.ItemCount || 0} items ({req.TotalQuantityRequested || 0} units)
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {new Date(req.CreatedDate).toLocaleDateString()}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-secondary/35">
                          <td colSpan={7} className="p-4 pl-14">
                            {loadingItems[req.StockRequestID] ? (
                              <div className="py-3 text-xs text-muted-foreground">Loading requisition items...</div>
                            ) : (
                              <div className="space-y-2">
                                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                                  Requested Line Items ({expandedItems[req.StockRequestID]?.length || 0})
                                </div>
                                <div className="rounded-xl border border-border bg-card overflow-hidden">
                                  <table className="w-full text-xs text-left">
                                    <thead className="bg-secondary/70 border-b border-border text-muted-foreground font-semibold">
                                      <tr>
                                        <th className="p-2.5 pl-4">Medicine</th>
                                        <th className="p-2.5">Form / Dosage</th>
                                        <th className="p-2.5 text-right">Requested</th>
                                        <th className="p-2.5 text-right">Approved</th>
                                        <th className="p-2.5 text-right pr-4">Released</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border/50">
                                      {(expandedItems[req.StockRequestID] || []).map((line) => (
                                        <tr key={line.StockRequestItemID}>
                                          <td className="p-2.5 pl-4 font-bold text-foreground">
                                            {line.ProductName}
                                            <span className="block text-[10px] font-normal text-muted-foreground">
                                              {line.GenericName}
                                            </span>
                                          </td>
                                          <td className="p-2.5 text-muted-foreground">
                                            {line.Form || '-'} {line.Dosage || ''}
                                          </td>
                                          <td className="p-2.5 text-right font-semibold text-foreground">
                                            {line.QuantityRequested} {line.UnitName || 'units'}
                                          </td>
                                          <td className="p-2.5 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                                            {line.QuantityApproved || 0}
                                          </td>
                                          <td className="p-2.5 text-right pr-4 text-primary font-bold">
                                            {line.QuantityReleased || 0}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CREATE STOCK REQUEST MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94dvh]">
            {/* Sticky Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0 bg-secondary/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-foreground truncate">
                    New Warehouse Stock Request
                  </h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                    Submit structured requisition with FEFO batch allocation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:bg-secondary shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
              {/* Step 1 */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center shrink-0">
                    1
                  </span>
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">
                    Priority &amp; Purpose
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Priority Level</label>
                    <select
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="w-full h-11 sm:h-10 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="Routine">Routine Restock</option>
                      <option value="Urgent">Urgent Requisition</option>
                      <option value="Emergency">Emergency Outbreak / Need</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">
                      Purpose / Program <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      required
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g. Monthly restock, Maternal health drive"
                      className="h-11 sm:h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Step 2: Requested Line Items */}
              <div className="space-y-3 pt-3 border-t border-border">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center shrink-0">
                      2
                    </span>
                    <label className="text-xs font-black text-foreground uppercase tracking-wider">
                      Medicine Selection
                    </label>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold h-8 px-3 rounded-xl border-primary/30 text-primary hover:bg-accent"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Medicine
                  </Button>
                </div>

                {/* Quick catalog filter for large medicine lists */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                    placeholder="Filter medicine catalog options..."
                    className="pl-8 h-9 text-xs rounded-xl bg-secondary/40 border-border"
                  />
                </div>

                <div className="space-y-2.5">
                  {requestItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-3 sm:p-3.5 rounded-xl border border-border bg-secondary/40 space-y-2"
                    >
                      <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
                        <div className="flex-1 w-full">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block sm:hidden">
                            Medicine #{idx + 1}
                          </label>
                          <select
                            required
                            value={item.medicineId}
                            onChange={(e) => handleItemChange(idx, 'medicineId', Number(e.target.value))}
                            className="w-full h-11 sm:h-9 rounded-xl border border-border bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value={0}>Select Medicine from Catalog...</option>
                            {medicines
                              .filter(
                                (m: any) =>
                                  m.MedicineID === item.medicineId ||
                                  filteredCatalog.some((fm: any) => fm.MedicineID === m.MedicineID)
                              )
                              .map((m: any) => (
                                <option key={m.MedicineID} value={m.MedicineID}>
                                  {m.ProductName} {m.GenericName ? `(${m.GenericName})` : ''} -{' '}
                                  {m.Form || ''} {m.Dosage || ''}
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="w-full sm:w-36 flex items-center justify-between sm:justify-start gap-2">
                          <div className="flex items-center gap-1.5 flex-1">
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              required
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))
                              }
                              placeholder="Qty"
                              className="h-11 sm:h-9 text-xs font-bold rounded-xl text-center"
                            />
                            <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">
                              units
                            </span>
                          </div>

                          {requestItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-2 text-muted-foreground hover:text-rose-600 rounded-xl min-h-[40px] min-w-[40px] flex items-center justify-center sm:min-h-0 sm:min-w-0"
                              aria-label="Remove item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 3: Summary & Protocol */}
              <div className="p-3.5 bg-accent/60 border border-primary/20 rounded-xl text-xs text-foreground flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">
                  3
                </span>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <strong className="text-[11px] uppercase tracking-wider">Request Summary</strong>
                    <span className="font-mono font-bold text-primary">
                      {summaryValidCount} medicine{summaryValidCount === 1 ? '' : 's'} • {summaryTotalQty} units
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Submitted requests enter CHO Warehouse review and are fulfilled using strict First-Expiry-First-Out (FEFO) batch allocation.
                  </p>
                </div>
              </div>

              {/* Sticky Action Buttons */}
              <div className="pt-3 border-t border-border flex justify-end gap-2 sticky bottom-0 bg-card pb-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="text-xs h-10 px-4 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 px-5 rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit Stock Request'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
