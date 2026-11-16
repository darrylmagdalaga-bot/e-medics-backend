import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Layers,
  ShieldCheck,
  Package,
  RefreshCw,
  Ban,
  Truck,
  Info,
  History,
  Send,
  X,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../components/ui/button';
import { API_URL, getActiveUserId } from '../../../../app/api-config';
import { getFacilityTypeBadgeInfo } from '../../../../lib/terminology';

interface StockRequestReviewDetailProps {
  entity: any;
  onClose?: () => void;
  onRefresh?: () => void;
}

function getWarehouseUserId(): number {
  return Number(getActiveUserId());
}

function normalizeStatus(st?: string): string {
  return String(st || '').trim().toUpperCase().replace(/\s+/g, '_');
}

function formatStatusLabel(st?: string): string {
  const ns = normalizeStatus(st);
  switch (ns) {
    case 'SUBMITTED': return 'SUBMITTED';
    case 'UNDER_REVIEW': return 'UNDER REVIEW';
    case 'APPROVED': return 'APPROVED';
    case 'STOCK_UNAVAILABLE': return 'STOCK UNAVAILABLE';
    case 'READY_FOR_FULFILLMENT': return 'READY FOR FULFILLMENT';
    case 'PARTIALLY_FULFILLED': return 'PARTIALLY FULFILLED';
    case 'FULFILLED': return 'FULFILLED';
    case 'REJECTED': return 'REJECTED';
    case 'CANCELLED': return 'CANCELLED';
    default: return st || 'SUBMITTED';
  }
}

export function StockRequestReviewDetail({ entity, onClose, onRefresh }: StockRequestReviewDetailProps) {
  const queryClient = useQueryClient();
  const requestId = entity?.StockRequestID || entity?.id;

  const [adminRemarks, setAdminRemarks] = useState('');
  const [isRejectMode, setIsRejectMode] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [shortageNotes, setShortageNotes] = useState('');
  const [releaseRemarks, setReleaseRemarks] = useState('');
  const [releaseInputs, setReleaseInputs] = useState<Record<number, number>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFefoMap, setShowFefoMap] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const { data: review, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['warehouse-stock-request-review', requestId],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/warehouse/stock-requests/${requestId}/review`, {
        headers: { 'x-user-id': String(getWarehouseUserId()) },
      });
      if (!res.ok) throw new Error('Failed to load stock request review details');
      return res.json();
    },
    enabled: Boolean(requestId),
  });

  useEffect(() => {
    if (review?.items) {
      const initial: Record<number, number> = {};
      review.items.forEach((item: any) => {
        initial[item.StockRequestItemID] = Number(item.ReleasableQuantity ?? 0);
      });
      setReleaseInputs(initial);
    }
    if (review?.ShortageNotes && !shortageNotes) {
      setShortageNotes(review.ShortageNotes);
    }
  }, [review]);

  const facilityBadge = useMemo(() => {
    return getFacilityTypeBadgeInfo(
      review?.RequestingFacility || entity?.RequestingFacility,
      review?.RequestingLocationID || entity?.RequestingLocationID
    );
  }, [review, entity]);

  const refreshAll = async () => {
    queryClient.invalidateQueries({ queryKey: ['warehouse-stock-requests'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-stock-requests-kpis'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-approved-requests'] });
    queryClient.invalidateQueries({ queryKey: ['warehouse-distributions'] });
    await refetch();
    if (onRefresh) onRefresh();
  };

  const handleMarkUnderReview = async () => {
    if (!requestId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/stock-requests/${requestId}/under-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(getWarehouseUserId()) },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to mark under review');
      toast.success(`Request ${data.requestNumber} marked UNDER REVIEW`);
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 1: Administrative Approval ONLY (works even at 0 Warehouse inventory)
  const handleApproveRequest = async () => {
    if (!requestId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/stock-requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(getWarehouseUserId()) },
        body: JSON.stringify({
          decision: 'FULL',
          adminRemarks: adminRemarks.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      toast.success(
        `Request ${data.requestNumber} APPROVED (${data.totalApprovedUnits} units authorized). Inventory unchanged until Stock Release.`
      );
      setAdminRemarks('');
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || 'Approval failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 1: Rejection with mandatory reason
  const handleRejectRequest = async () => {
    if (!requestId) return;
    if (!rejectionReason.trim()) {
      toast.error('Please enter a mandatory rejection reason.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/stock-requests/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(getWarehouseUserId()) },
        body: JSON.stringify({ rejectionReason: rejectionReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rejection failed');
      toast.success(`Request ${data.requestNumber} rejected.`);
      setIsRejectMode(false);
      setRejectionReason('');
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || 'Rejection failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 1/2: Cancel prior to any release
  const handleCancelRequest = async () => {
    if (!requestId) return;
    const reason = window.prompt('Enter cancellation reason (optional):') ?? '';
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/stock-requests/${requestId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(getWarehouseUserId()) },
        body: JSON.stringify({ cancellationReason: reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Cancellation failed');
      toast.success(`Request ${data.requestNumber} cancelled.`);
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || 'Cancellation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 2: Scenario A Shortage / STOCK_UNAVAILABLE Note
  const handleRecordShortage = async () => {
    if (!requestId) return;
    if (!shortageNotes.trim()) {
      toast.error('Please enter a shortage or replenishment note.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/stock-requests/${requestId}/shortage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(getWarehouseUserId()) },
        body: JSON.stringify({
          shortageNotes: shortageNotes.trim(),
          markUnavailable: Boolean(review?.summary?.allOutOfStock),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record shortage note');
      toast.success(`Shortage tracking updated (Status: ${formatStatusLabel(data.status)}).`);
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || 'Failed to record shortage note');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stage 2: Controlled Stock Release (Scenario B / Scenario C)
  const handleControlledRelease = async () => {
    if (!requestId || !review?.items) return;

    const releasePayloadItems = review.items
      .filter((it: any) => (it.RemainingQuantity ?? 0) > 0)
      .map((it: any) => ({
        stockRequestItemId: it.StockRequestItemID,
        medicineId: it.MedicineID,
        releaseQuantity: Math.max(0, Math.floor(Number(releaseInputs[it.StockRequestItemID] ?? 0))),
      }))
      .filter((it: any) => it.releaseQuantity > 0);

    if (releasePayloadItems.length === 0) {
      toast.error('Enter at least one positive release quantity (> 0) for an item with available stock.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/stock-requests/${requestId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': String(getWarehouseUserId()) },
        body: JSON.stringify({
          remarks: releaseRemarks.trim() || undefined,
          items: releasePayloadItems,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Stock release failed');

      toast.success(
        `Issued Distribution ${data.distributionNumber} (${data.totalReleasedNow} units). Remaining unfulfilled: ${data.totalRemainingOverall}.`
      );
      setReleaseRemarks('');
      await refreshAll();
    } catch (err: any) {
      toast.error(err.message || 'Controlled stock release failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-foreground">Stock Request Details</h3>
              <p className="text-xs text-muted-foreground">Loading live Warehouse availability...</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="p-12 text-center text-muted-foreground space-y-3">
          <RefreshCw className="w-7 h-7 animate-spin mx-auto text-primary" />
          <p className="text-sm font-semibold">Checking Central Warehouse inventory &amp; FEFO eligibility...</p>
        </div>
      </div>
    );
  }

  if (isError || !review) {
    return (
      <div className="flex flex-col">
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <h3 className="text-base sm:text-lg font-bold text-foreground">Stock Request Details</h3>
          {onClose && (
            <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="p-8 sm:p-10 text-center space-y-3">
          <AlertTriangle className="w-9 h-9 mx-auto text-destructive" />
          <h4 className="font-bold text-sm text-foreground">Failed to Load Stock Request Details</h4>
          <p className="text-xs text-muted-foreground">Could not calculate live stock availability. Please retry.</p>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const ns = normalizeStatus(review.Status);
  const s = review.summary || {};
  const isApprovedStage = [
    'APPROVED',
    'PARTIALLY_APPROVED',
    'STOCK_UNAVAILABLE',
    'READY_FOR_FULFILLMENT',
    'PARTIALLY_FULFILLED',
    'PARTIALLY_RECEIVED',
    'READY_FOR_ISSUANCE',
  ].includes(ns);
  const isFulfilled = ['FULFILLED', 'COMPLETED', 'RECEIVED'].includes(ns);
  const isRejectedOrCancelled = ['REJECTED', 'CANCELLED'].includes(ns);

  const requesterDisplay = review.RequestedByName || review.RequesterName || 'Pharmacy Staff';
  const rawFacility = String(review.RequestingFacility || '').trim();
  const facilityDisplay =
    !rawFacility || rawFacility.toLowerCase() === requesterDisplay.trim().toLowerCase()
      ? facilityBadge.typeLabel
      : rawFacility;

  const hasAnyFefo = (review.items || []).some(
    (it: any) => Array.isArray(it.FEFOProposals) && it.FEFOProposals.length > 0
  );

  const totalProposedInput = (review.items || []).reduce((sum: number, it: any) => {
    if ((it.RemainingQuantity ?? 0) <= 0) return sum;
    return sum + Math.max(0, Math.floor(Number(releaseInputs[it.StockRequestItemID] ?? 0)));
  }, 0);

  const statusPillClass = isFulfilled
    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
    : ns === 'STOCK_UNAVAILABLE'
      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
      : ns === 'PARTIALLY_FULFILLED'
        ? 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30'
        : isApprovedStage
          ? 'bg-primary/15 text-primary border-primary/30'
          : isRejectedOrCancelled
            ? 'bg-destructive/15 text-destructive border-destructive/30'
            : 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30';

  const priorityPillClass =
    review.Priority === 'Emergency'
      ? 'bg-destructive/15 text-destructive border-destructive/20'
      : review.Priority === 'Urgent'
        ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20'
        : 'bg-muted text-muted-foreground border-border';

  return (
    <div className="flex flex-col max-h-[94vh] sm:max-h-[90vh] overflow-hidden">
      {/* Sticky Modal Header (Pharmacy structure, Warehouse theme) */}
      <div className="p-4 sm:px-6 sm:py-5 border-b border-border flex items-start sm:items-center justify-between gap-3 bg-muted/20 shrink-0">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/20 shrink-0 mt-0.5 sm:mt-0">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <h3 className="text-base sm:text-lg font-black font-mono text-foreground tracking-tight truncate">
                {review.RequestNumber}
              </h3>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusPillClass}`}>
                {formatStatusLabel(review.Status)}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${priorityPillClass}`}>
                {review.Priority}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {facilityDisplay} • By <span className="font-semibold text-foreground">{requesterDisplay}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh live stock availability"
            className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-primary' : ''}`} />
          </button>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-full transition-colors text-muted-foreground hover:text-foreground"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="p-4 sm:p-6 overflow-y-auto custom-scrollbar space-y-5 flex-1">
        {/* Section 1: Request Information (Compact 4-field strip + contextual alerts) */}
        <div className="space-y-2.5">
          <div className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px]">
              1
            </span>
            Request Information
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-muted/20 p-3.5 sm:p-4 rounded-2xl border border-border text-xs">
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Requesting Facility</span>
              <span className="font-semibold text-foreground block truncate mt-0.5">{facilityDisplay}</span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Date Requested</span>
              <span className="font-semibold text-foreground block mt-0.5">
                {review.RequestDate ? new Date(review.RequestDate).toLocaleDateString() : '—'}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Required By</span>
              <span className="font-semibold text-foreground block mt-0.5">
                {review.RequiredDate ? new Date(review.RequiredDate).toLocaleDateString() : 'Standard'}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Purpose</span>
              <span className="font-semibold text-foreground block truncate mt-0.5" title={review.Purpose || ''}>
                {review.Purpose || '—'}
              </span>
            </div>
          </div>

          {/* Contextual Alert Callouts (rendered only when present) */}
          {review.Remarks && (
            <div className="p-2.5 rounded-xl bg-muted/30 border border-border/70 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Requester Note:</span> {review.Remarks}
            </div>
          )}

          {review.ApprovedByName && !isRejectedOrCancelled && (
            <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                Approved by <strong>{review.ApprovedByName}</strong>
                {review.AdminRemarks ? ` — "${review.AdminRemarks}"` : ''}
              </span>
            </div>
          )}

          {review.RejectionReason && (
            <div className="p-2.5 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
              <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Rejected{review.RejectedByName ? ` by ${review.RejectedByName}` : ''}:</strong>{' '}
                {review.RejectionReason}
              </span>
            </div>
          )}

          {review.ShortageNotes && (
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Shortage Note:</strong> {review.ShortageNotes}
              </span>
            </div>
          )}
        </div>

        {/* Section 2: Medicine Line Items (Desktop Table + Mobile Cards) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px]">
                2
              </span>
              Medicine Line Items ({review.items?.length || 0})
            </div>

            {hasAnyFefo && (
              <button
                type="button"
                onClick={() => setShowFefoMap((v) => !v)}
                className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Layers className="w-3.5 h-3.5" />
                {showFefoMap ? 'Hide FEFO Batches' : 'View FEFO Batches'}
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-border overflow-hidden bg-muted/10">
            {/* Desktop Header */}
            <div className="hidden sm:grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/40 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <div className="col-span-5">Medicine</div>
              <div className="col-span-1 text-center">Req</div>
              <div className="col-span-1 text-center">Appr</div>
              <div className="col-span-1 text-center">Rel</div>
              <div className="col-span-2 text-center">WH Stock</div>
              <div className="col-span-2 text-right">
                {isApprovedStage && !isFulfilled ? 'Release Qty' : 'Status'}
              </div>
            </div>

            <div className="divide-y divide-border/60">
              {(review.items || []).map((item: any) => {
                const maxAllowed = Math.min(item.RemainingQuantity ?? 0, item.ReleasableQuantity ?? 0);
                const currentInput = releaseInputs[item.StockRequestItemID] ?? 0;
                const avail = Number(item.AvailableStock ?? 0);
                const shortage = Number(item.ShortageQuantity ?? 0);
                const rem = Number(item.RemainingQuantity ?? 0);
                const extraHold = Number(item.ReservedStock ?? 0) + Number(item.UnavailableQuantity ?? 0);

                const stockBadge =
                  avail === 0
                    ? { label: '0 (Out)', cls: 'bg-destructive/15 text-destructive border-destructive/20' }
                    : shortage > 0
                      ? { label: `${avail} (-${shortage})`, cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/20' }
                      : { label: `${avail} Ready`, cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };

                const handleQtyChange = (valStr: string) => {
                  const val = Math.max(0, Math.min(maxAllowed, Math.floor(Number(valStr) || 0)));
                  setReleaseInputs((prev) => ({ ...prev, [item.StockRequestItemID]: val }));
                };

                return (
                  <div key={item.StockRequestItemID} className="p-3.5 sm:px-4 sm:py-3 hover:bg-muted/20 transition-colors">
                    {/* Mobile Card Layout */}
                    <div className="sm:hidden space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-foreground flex items-center gap-1.5">
                            <Package className="w-3.5 h-3.5 text-primary shrink-0" />
                            <span className="truncate">{item.ProductName}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {[item.Dosage, item.Form, item.UnitName].filter(Boolean).join(' • ')}
                          </p>
                        </div>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${stockBadge.cls}`}>
                          WH: {stockBadge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center bg-muted/30 rounded-xl p-2 text-xs">
                        <div>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground block">Requested</span>
                          <span className="font-mono font-bold text-foreground">{item.QuantityRequested}</span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground block">Approved</span>
                          <span className="font-mono font-bold text-foreground">
                            {item.QuantityApproved > 0 ? item.QuantityApproved : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] uppercase font-bold text-muted-foreground block">Released</span>
                          <span className="font-mono font-bold text-primary">{item.QuantityReleased ?? 0}</span>
                        </div>
                      </div>

                      {isApprovedStage && !isFulfilled && rem > 0 && (
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <label className="text-xs font-semibold text-foreground">
                            Release Now <span className="text-[11px] text-muted-foreground font-normal">(Max {maxAllowed})</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={maxAllowed}
                            disabled={maxAllowed === 0 || isSubmitting}
                            value={currentInput}
                            onChange={(e) => handleQtyChange(e.target.value)}
                            className="w-24 px-2.5 py-1.5 text-right font-mono font-bold text-sm rounded-xl border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                          />
                        </div>
                      )}
                    </div>

                    {/* Desktop 12-Col Row Layout */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 items-center text-xs">
                      <div className="col-span-5 min-w-0">
                        <div className="font-bold text-foreground truncate">{item.ProductName}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {[item.Dosage, item.Form, item.UnitName].filter(Boolean).join(' • ')}
                        </div>
                      </div>
                      <div className="col-span-1 text-center font-mono font-bold text-foreground">
                        {item.QuantityRequested}
                      </div>
                      <div className="col-span-1 text-center font-mono font-bold text-foreground">
                        {item.QuantityApproved > 0 ? item.QuantityApproved : '—'}
                      </div>
                      <div className="col-span-1 text-center font-mono font-bold text-primary">
                        {item.QuantityReleased ?? 0}
                      </div>
                      <div className="col-span-2 text-center">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${stockBadge.cls}`}>
                          {stockBadge.label}
                        </span>
                        {extraHold > 0 && (
                          <div className="text-[9px] text-muted-foreground mt-0.5">
                            {item.ReservedStock > 0 ? `Res: ${item.ReservedStock}` : ''}
                            {item.ReservedStock > 0 && item.UnavailableQuantity > 0 ? ' • ' : ''}
                            {item.UnavailableQuantity > 0 ? `Exp/Dmg: ${item.UnavailableQuantity}` : ''}
                          </div>
                        )}
                      </div>
                      <div className="col-span-2 flex justify-end items-center">
                        {isApprovedStage && !isFulfilled && rem > 0 ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              max={maxAllowed}
                              disabled={maxAllowed === 0 || isSubmitting}
                              value={currentInput}
                              onChange={(e) => handleQtyChange(e.target.value)}
                              aria-label={`Release quantity for ${item.ProductName}`}
                              className="w-16 px-2 py-1 text-right font-mono font-bold text-xs rounded-lg border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50"
                            />
                            <span className="text-[10px] text-muted-foreground font-mono">/{rem}</span>
                          </div>
                        ) : rem === 0 && (item.QuantityReleased ?? 0) > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" /> Complete
                          </span>
                        ) : shortage > 0 ? (
                          <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                            Short -{shortage}
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {isRejectedOrCancelled ? 'Closed' : 'Ready'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Optional FEFO Batch Preview (collapsed by default) */}
                    {showFefoMap && item.FEFOProposals && item.FEFOProposals.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-border/50 flex flex-wrap gap-1.5">
                        {item.FEFOProposals.map((b: any) => (
                          <span
                            key={b.WarehouseInventoryID}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-[10px] text-foreground"
                          >
                            <Layers className="w-3 h-3 text-primary" />
                            <span className="font-mono font-bold">{b.BatchNumber}</span>
                            <span className="text-muted-foreground">
                              Exp {b.ExpiryDate ? new Date(b.ExpiryDate).toLocaleDateString() : 'N/A'}
                            </span>
                            <span className="font-bold text-primary">→ {b.AllocatedQuantity}u</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Section 3: Summary & Decision Controls (3-tile Pharmacy summary rhythm) */}
        <div className="space-y-3">
          <div className="text-[11px] font-bold text-primary uppercase tracking-wider flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-[10px]">
              3
            </span>
            Summary &amp; Decision
          </div>

          <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3 sm:p-4 rounded-2xl bg-muted/20 border border-border">
              <div className="text-[10px] font-bold text-muted-foreground uppercase">
                {isApprovedStage ? 'Remaining' : 'Requested'}
              </div>
              <div className="text-base sm:text-lg font-black text-foreground mt-0.5">
                {(isApprovedStage ? s.totalRemaining : s.totalRequested) ?? 0}{' '}
                <span className="text-xs font-medium text-muted-foreground">units</span>
              </div>
              {isApprovedStage && (s.totalReleased ?? 0) > 0 && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Released: {s.totalReleased} / {s.totalApproved}
                </div>
              )}
            </div>

            <div className="p-3 sm:p-4 rounded-2xl bg-primary/5 border border-primary/20">
              <div className="text-[10px] font-bold text-primary uppercase">WH Available</div>
              <div
                className={`text-base sm:text-lg font-black mt-0.5 ${
                  (s.totalAvailable ?? 0) === 0
                    ? 'text-destructive'
                    : (s.totalShortage ?? 0) > 0
                      ? 'text-amber-600 dark:text-amber-400'
                      : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {s.totalAvailable ?? 0} <span className="text-xs font-medium opacity-75">units</span>
              </div>
              {((s.totalReservedStock ?? 0) > 0 || (s.totalUnavailableStock ?? 0) > 0) && (
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {s.totalReservedStock > 0 ? `Res: ${s.totalReservedStock}` : ''}
                  {s.totalReservedStock > 0 && s.totalUnavailableStock > 0 ? ' • ' : ''}
                  {s.totalUnavailableStock > 0 ? `Unavail: ${s.totalUnavailableStock}` : ''}
                </div>
              )}
            </div>

            <div
              className={`p-3 sm:p-4 rounded-2xl border ${
                (s.totalShortage ?? 0) > 0
                  ? 'bg-amber-500/5 border-amber-500/20'
                  : 'bg-muted/20 border-border'
              }`}
            >
              <div className="text-[10px] font-bold text-muted-foreground uppercase">
                {(s.totalShortage ?? 0) > 0 ? 'Shortage' : 'Releasable'}
              </div>
              <div
                className={`text-base sm:text-lg font-black mt-0.5 ${
                  (s.totalShortage ?? 0) > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-foreground'
                }`}
              >
                {(s.totalShortage ?? 0) > 0 ? `-${s.totalShortage}` : s.totalReleasable ?? 0}
              </div>
            </div>
          </div>

          {/* Stage 1 Decision Note / Input */}
          {s.canApprove && !isRejectedOrCancelled && (
            <div className="space-y-2.5">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-2">
                <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span>
                  {s.allOutOfStock
                    ? 'Warehouse currently has 0 usable stock. Approving authorizes and queues this request without deducting inventory; physical release waits for restocking.'
                    : 'Approving authorizes requested quantities without deducting stock. Physical stock release happens separately in Stage 2.'}
                </span>
              </div>

              {!isRejectMode ? (
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Admin Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={adminRemarks}
                    onChange={(e) => setAdminRemarks(e.target.value)}
                    placeholder="e.g. Approved for Pharmacy monthly replenishment"
                    className="w-full px-3.5 py-2.5 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2">
                  <label className="text-xs font-bold text-destructive block">
                    Rejection Reason *
                  </label>
                  <input
                    type="text"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter mandatory reason for rejecting this request..."
                    autoFocus
                    className="w-full px-3.5 py-2 text-xs bg-background border border-destructive/40 rounded-xl focus:outline-none focus:ring-2 focus:ring-destructive/40"
                  />
                </div>
              )}
            </div>
          )}

          {/* Stage 2 Release / Shortage Input */}
          {isApprovedStage && !isFulfilled && !isRejectedOrCancelled && (
            <div className="space-y-2.5">
              {s.allOutOfStock ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
                  <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      <strong>Awaiting Replenishment:</strong> 0 eligible Warehouse units available. Stock release is
                      blocked until a Delivery Receipt is received.
                    </span>
                  </div>
                  <input
                    type="text"
                    value={shortageNotes}
                    onChange={(e) => setShortageNotes(e.target.value)}
                    placeholder="Record shortage or supplier restock ETA note..."
                    className="w-full px-3.5 py-2 text-xs bg-background border border-amber-500/30 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-bold text-foreground block mb-1">
                    Dispatch / Release Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={releaseRemarks}
                    onChange={(e) => setReleaseRemarks(e.target.value)}
                    placeholder="e.g. Dispatched via FEFO batch allocation"
                    className="w-full px-3.5 py-2.5 text-xs bg-background border border-input rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Linked Distributions (only shown after issuance exists) */}
        {review.distributions && review.distributions.length > 0 && (
          <div className="rounded-2xl border border-border bg-muted/10 overflow-hidden">
            <div className="px-4 py-2.5 bg-muted/30 border-b border-border flex items-center gap-2">
              <Truck className="w-4 h-4 text-primary" />
              <span className="text-xs font-bold text-foreground">
                Issued Distributions ({review.distributions.length})
              </span>
            </div>
            <div className="divide-y divide-border/60">
              {review.distributions.map((d: any) => (
                <div key={d.DistributionID} className="px-4 py-2.5 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{d.DistributionNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          d.Status === 'Received'
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-primary/15 text-primary'
                        }`}
                      >
                        {d.Status}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {d.TotalQuantity} units
                      {d.ReceivedDate ? ` • Received ${d.TotalReceivedQuantity}u` : ' • Awaiting Pharmacy receipt'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Collapsible Audit Trail */}
        {review.auditLogs && review.auditLogs.length > 0 && (
          <div className="rounded-2xl border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAuditLog((v) => !v)}
              className="w-full px-4 py-2.5 bg-muted/20 hover:bg-muted/30 transition-colors flex items-center justify-between text-xs font-bold text-foreground"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-primary" />
                Activity &amp; Audit History ({review.auditLogs.length})
              </span>
              {showAuditLog ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>

            {showAuditLog && (
              <div className="divide-y divide-border/60 max-h-52 overflow-y-auto bg-card">
                {review.auditLogs.map((log: any) => (
                  <div key={log.AuditID} className="px-4 py-2.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div>
                      <span className="font-mono font-bold text-foreground">{log.Action}</span>
                      {log.NewStatus && (
                        <span className="text-[10px] text-muted-foreground ml-1.5">
                          ({log.PreviousStatus ? `${log.PreviousStatus} → ${log.NewStatus}` : log.NewStatus})
                        </span>
                      )}
                      {log.Notes && <p className="text-[11px] text-muted-foreground mt-0.5">{log.Notes}</p>}
                    </div>
                    <div className="text-left sm:text-right text-[10px] text-muted-foreground shrink-0">
                      <span className="font-semibold text-foreground">{log.ActorName || `User #${log.ActorUserID}`}</span>
                      {' • '}
                      {new Date(log.CreatedDate).toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Sticky Footer Action Bar */}
      <div className="p-4 sm:px-6 sm:py-4 border-t border-border bg-muted/30 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2.5 shrink-0">
        {s.canApprove && !isRejectedOrCancelled ? (
          isRejectMode ? (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRejectMode(false);
                  setRejectionReason('');
                }}
                disabled={isSubmitting}
                className="w-full sm:w-auto"
              >
                Back
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={handleRejectRequest}
                disabled={isSubmitting || !rejectionReason.trim()}
                className="w-full sm:w-auto font-bold"
              >
                <XCircle className="w-4 h-4 mr-1.5" />
                {isSubmitting ? 'Rejecting...' : 'Confirm Rejection'}
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {s.canReject && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsRejectMode(true)}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none text-destructive border-destructive/30 hover:bg-destructive/10"
                  >
                    <XCircle className="w-4 h-4 mr-1.5" />
                    Reject
                  </Button>
                )}
                {ns === 'SUBMITTED' && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleMarkUnderReview}
                    disabled={isSubmitting}
                    className="flex-1 sm:flex-none"
                  >
                    <Clock className="w-4 h-4 mr-1.5" />
                    Reviewing
                  </Button>
                )}
                {s.canCancel && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={handleCancelRequest}
                    disabled={isSubmitting}
                    className="text-muted-foreground hover:text-destructive px-2.5"
                  >
                    <Ban className="w-4 h-4 mr-1" />
                    <span>Cancel</span>
                  </Button>
                )}
              </div>

              <Button
                type="button"
                onClick={handleApproveRequest}
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
              >
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                {isSubmitting ? 'Approving...' : 'Approve Request'}
              </Button>
            </>
          )
        ) : isApprovedStage && !isFulfilled && !isRejectedOrCancelled ? (
          <>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              {onClose && (
                <Button type="button" variant="outline" onClick={onClose} className="flex-1 sm:flex-none">
                  Close
                </Button>
              )}
              {s.allOutOfStock && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleRecordShortage}
                  disabled={isSubmitting || !shortageNotes.trim()}
                  className="flex-1 sm:flex-none border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                >
                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                  Save Shortage Note
                </Button>
              )}
              {s.canCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleCancelRequest}
                  disabled={isSubmitting}
                  className="text-muted-foreground hover:text-destructive px-2.5"
                >
                  <Ban className="w-4 h-4 sm:mr-1" />
                  <span className="hidden sm:inline">Cancel</span>
                </Button>
              )}
            </div>

            {!s.allOutOfStock && (
              <Button
                type="button"
                onClick={handleControlledRelease}
                disabled={isSubmitting || totalProposedInput <= 0}
                className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
              >
                <Send className="w-4 h-4 mr-1.5" />
                {s.totalShortage > 0 || totalProposedInput < (s.totalRemaining ?? 0)
                  ? `Issue Partial Release (${totalProposedInput} u)`
                  : `Release Stock (${totalProposedInput} u)`}
              </Button>
            )}
          </>
        ) : (
          <div className="w-full flex justify-end">
            {onClose && (
              <Button type="button" variant="outline" onClick={onClose} className="w-full sm:w-auto">
                Close
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
