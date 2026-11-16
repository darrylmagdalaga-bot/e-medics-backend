import React, { useState, useEffect } from 'react';
import { 
  ClipboardCheck, RotateCw, CheckCircle2, XCircle, AlertTriangle, 
  Layers, ShieldCheck, Check, Clock, Lock, ArrowUpRight, ArrowDownRight, 
  Minus, FileText, X
} from 'lucide-react';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../../lib/utils';
import { CountSessionHeader, CountItem, DISCREPANCY_REASONS } from './types';

interface CountSheetDrawerProps {
  sessionDetails: {
    header: CountSessionHeader;
    items: CountItem[];
    history: any[];
  } | null;
  isLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: number;
  onSaveItems: (items: any[]) => void;
  onSubmitCount: () => void;
  onApproveCount: () => void;
  onOpenRejectModal: () => void;
  onPostAdjustment: () => void;
  isSaving: boolean;
  isSubmitting: boolean;
  isApproving: boolean;
  isPosting: boolean;
}

export function CountSheetDrawer({
  sessionDetails,
  isLoading,
  isOpen,
  onClose,
  currentUserId,
  onSaveItems,
  onSubmitCount,
  onApproveCount,
  onOpenRejectModal,
  onPostAdjustment,
  isSaving,
  isSubmitting,
  isApproving,
  isPosting
}: CountSheetDrawerProps) {
  const [editingItems, setEditingItems] = useState<Record<string | number, {
    physical: number;
    reason: string;
    notes: string;
  }>>({});

  useEffect(() => {
    if (sessionDetails?.items) {
      const initial: Record<string | number, { physical: number; reason: string; notes: string }> = {};
      sessionDetails.items.forEach(it => {
        initial[it.CountItemID] = {
          physical: it.PhysicalQuantity,
          reason: it.DiscrepancyReason || '',
          notes: it.Notes || ''
        };
      });
      setEditingItems(initial);
    }
  }, [sessionDetails]);

  if (!isOpen) return null;

  const header: any = (sessionDetails as any)?.header || sessionDetails;
  const items = sessionDetails?.items || [];
  const isEditable = header && ['Draft', 'In Progress', 'Rejected'].includes(header.Status);

  const handleItemChange = (
    itemId: string | number, 
    field: 'physical' | 'reason' | 'notes', 
    val: any
  ) => {
    setEditingItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        [field]: field === 'physical' ? (val === '' ? 0 : parseInt(val) || 0) : val
      }
    }));
  };

  const handleSave = () => {
    if (!items.length) return;
    const payload = items.map(it => {
      const edit = editingItems[it.CountItemID] || {
        physical: it.PhysicalQuantity,
        reason: it.DiscrepancyReason,
        notes: it.Notes
      };
      return {
        countItemId: it.CountItemID,
        physicalQuantity: edit.physical,
        discrepancyReason: edit.reason,
        notes: edit.notes
      };
    });
    onSaveItems(payload);
  };

  const renderStatusBadge = (status: CountSessionHeader['Status']) => {
    switch (status) {
      case 'Draft':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"><Clock className="w-3 h-3" /> Draft</span>;
      case 'In Progress':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><RotateCw className="w-3 h-3" /> In Progress</span>;
      case 'Submitted':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><AlertTriangle className="w-3 h-3" /> Submitted</span>;
      case 'Approved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
      case 'Rejected':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800"><XCircle className="w-3 h-3" /> Rejected</span>;
      case 'Posted':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"><Lock className="w-3 h-3" /> Posted</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
        onClick={onClose}
      >
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="w-full max-w-5xl bg-card border-l border-border h-full flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Drawer Top Header */}
          <div className="p-5 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <ClipboardCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-foreground">
                    {header?.CountNumber || 'Count Session'}
                  </h2>
                  {header && renderStatusBadge(header.Status)}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Baseline Date: {header?.BaselineDate ? new Date(header.BaselineDate).toLocaleString() : '—'} • Location: {header?.LocationName || 'Warehouse'}
                </p>
              </div>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="rounded-full"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Drawer Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {isLoading ? (
              <div className="py-20 text-center text-muted-foreground">
                <RotateCw className="w-8 h-8 animate-spin mx-auto mb-3 text-primary" />
                Loading count session items and baseline...
              </div>
            ) : header ? (
              <>
                {/* Meta Banner */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/30 rounded-xl border border-border/60 text-xs">
                  <div>
                    <span className="text-muted-foreground block font-medium">Initiator:</span>
                    <span className="text-foreground font-semibold">
                      {header.CreatedByName || header.CreatorName || `User #${header.CreatedBy}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Reviewer:</span>
                    <span className="text-foreground font-semibold">
                      {header.ReviewedByName || header.ReviewerName || (header.ReviewedBy ? `User #${header.ReviewedBy}` : 'Pending Review')}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Items Counted:</span>
                    <span className="text-foreground font-semibold">
                      {header.TotalItemsCounted} items
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block font-medium">Discrepancy Count:</span>
                    <span className={cn("font-semibold", header.TotalDiscrepancies > 0 ? "text-amber-600" : "text-emerald-600")}>
                      {header.TotalDiscrepancies} variance(s)
                    </span>
                  </div>

                  {header.Remarks && (
                    <div className="col-span-full pt-2 border-t border-border/40">
                      <span className="text-muted-foreground font-medium">Remarks: </span>
                      <span className="text-foreground">{header.Remarks}</span>
                    </div>
                  )}

                  {(header.ReviewNotes || header.ApprovalNotes) && (
                    <div className="col-span-full pt-1 text-emerald-600 dark:text-emerald-400">
                      <span className="font-medium">Approval Notes: </span>
                      <span>{header.ReviewNotes || header.ApprovalNotes}</span>
                    </div>
                  )}
                </div>

                {/* Status Guidance Alerts */}
                {header.Status === 'Draft' && (
                  <div className="flex items-center gap-2 p-3 bg-slate-500/10 border border-slate-500/20 rounded-xl text-xs text-slate-700 dark:text-slate-300">
                    <Clock className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>This count session is in <strong>Draft</strong>. Enter counted physical quantities and document reasons for any discrepancies.</span>
                  </div>
                )}

                {header.Status === 'In Progress' && (
                  <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-700 dark:text-blue-300">
                    <RotateCw className="w-4 h-4 text-blue-500 shrink-0" />
                    <span>Physical count is <strong>In Progress</strong>. Update quantities, save progress, or submit for authorized review once completed.</span>
                  </div>
                )}

                {header.Status === 'Submitted' && (
                  <div className="flex items-center gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>Count session has been <strong>Submitted</strong> for review. Quantities are locked from further editing pending supervisor approval.</span>
                  </div>
                )}

                {header.Status === 'Approved' && (
                  <div className="flex items-center gap-2 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-700 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Count is <strong>Approved</strong>. Click "Post Adjustment to Ledger" to atomically adjust inventory and record signed ledger entries.</span>
                  </div>
                )}

                {header.Status === 'Posted' && (
                  <div className="flex items-center gap-2 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-700 dark:text-indigo-300">
                    <Lock className="w-4 h-4 text-indigo-500 shrink-0" />
                    <span>This physical count has been <strong>Posted</strong>. Inventory balances are synchronized and immutable ledger entries have been written.</span>
                  </div>
                )}

                {/* Count Items Table */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      Inventory Count Items ({items.length})
                    </h3>
                    {isEditable && (
                      <span className="text-xs text-muted-foreground">
                        * Discrepancy reason is mandatory for any item where Variance ≠ 0
                      </span>
                    )}
                  </div>

                  {/* Mobile Batch Count Cards (< md) */}
                  <div className="md:hidden space-y-3">
                    {items.map((item) => {
                      const edit = editingItems[item.CountItemID] || {
                        physical: item.PhysicalQuantity,
                        reason: item.DiscrepancyReason || '',
                        notes: item.Notes || ''
                      };
                      const liveVariance = edit.physical - item.SystemQuantity;
                      const hasVariance = liveVariance !== 0;

                      return (
                        <div
                          key={item.CountItemID}
                          className={cn(
                            "p-4 rounded-2xl border shadow-xs space-y-3",
                            hasVariance ? "border-amber-500/40 bg-amber-500/[0.04]" : "border-border/70 bg-background"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/60">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-foreground break-words">
                                {item.ProductName || item.MedicineName}
                              </p>
                              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                                <span className="font-mono font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
                                  Batch: {item.BatchNumber || item.LotNumber || 'N/A'}
                                </span>
                                <span>Exp: {item.ExpiryDate ? new Date(item.ExpiryDate).toLocaleDateString() : 'N/A'}</span>
                              </div>
                            </div>
                            <div className="shrink-0 text-right font-mono font-bold text-xs">
                              {liveVariance > 0 ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                  <ArrowUpRight className="w-3.5 h-3.5" /> +{liveVariance}
                                </span>
                              ) : liveVariance < 0 ? (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                                  <ArrowDownRight className="w-3.5 h-3.5" /> {liveVariance}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                  Matched (0)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 items-center">
                            <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                                System Baseline Qty
                              </span>
                              <span className="text-base font-mono font-bold text-foreground">
                                {item.SystemQuantity}
                              </span>
                            </div>

                            <div>
                              <label className="text-[10px] uppercase font-bold text-primary block mb-1">
                                Physical Count *
                              </label>
                              {isEditable ? (
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min="0"
                                  value={edit.physical}
                                  onChange={(e) => handleItemChange(item.CountItemID, 'physical', e.target.value)}
                                  className="h-10 text-right font-mono font-bold text-sm"
                                />
                              ) : (
                                <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-right font-mono font-bold text-base text-foreground">
                                  {item.PhysicalQuantity}
                                </div>
                              )}
                            </div>
                          </div>

                          {(hasVariance || !isEditable) && (
                            <div className="space-y-2 pt-1">
                              {isEditable ? (
                                <>
                                  <div>
                                    <label className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 block mb-1">
                                      Discrepancy Reason (Required for Variance ≠ 0) *
                                    </label>
                                    <select
                                      value={edit.reason}
                                      onChange={(e) => handleItemChange(item.CountItemID, 'reason', e.target.value)}
                                      className={cn(
                                        "w-full h-10 text-xs rounded-xl border bg-background px-3 focus:outline-hidden",
                                        !edit.reason ? "border-amber-500 text-amber-700 bg-amber-50/50" : "border-border text-foreground"
                                      )}
                                    >
                                      <option value="">Select Discrepancy Reason...</option>
                                      {DISCREPANCY_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <Input
                                    placeholder="Add variance explanation / audit note..."
                                    value={edit.notes}
                                    onChange={(e) => handleItemChange(item.CountItemID, 'notes', e.target.value)}
                                    className="h-10 text-xs rounded-xl"
                                  />
                                </>
                              ) : (
                                <div className="text-xs text-muted-foreground flex items-center justify-between pt-1 border-t border-border/40">
                                  <span>Reason: <strong className="text-foreground">{item.DiscrepancyReason || 'Matched'}</strong></span>
                                  {item.Notes && <span className="truncate max-w-[160px]">Note: {item.Notes}</span>}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Count Items Table (>= md) */}
                  <div className="hidden md:block border border-border/70 rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-muted/60 font-semibold text-muted-foreground border-b border-border/60">
                          <tr>
                            <th className="px-3 py-2.5">Medicine / Batch</th>
                            <th className="px-3 py-2.5 text-right">System Qty</th>
                            <th className="px-3 py-2.5 text-right w-28">Physical Count</th>
                            <th className="px-3 py-2.5 text-right">Variance</th>
                            <th className="px-3 py-2.5 w-44">Discrepancy Reason</th>
                            <th className="px-3 py-2.5">Notes</th>
                            {header.Status === 'Posted' && (
                              <th className="px-3 py-2.5 text-right">Ledger Ref</th>
                            )}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {items.map((item) => {
                            const edit = editingItems[item.CountItemID] || {
                              physical: item.PhysicalQuantity,
                              reason: item.DiscrepancyReason || '',
                              notes: item.Notes || ''
                            };
                            const liveVariance = edit.physical - item.SystemQuantity;
                            const hasVariance = liveVariance !== 0;

                            return (
                              <tr 
                                key={item.CountItemID}
                                className={cn(
                                  "hover:bg-muted/20 transition-colors",
                                  hasVariance && "bg-amber-500/[0.03]"
                                )}
                              >
                                <td className="px-3 py-2.5">
                                  <div className="font-semibold text-foreground">
                                    {item.ProductName || item.MedicineName}
                                  </div>
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                                    <span>Batch: {item.BatchNumber || item.LotNumber || 'N/A'}</span>
                                    <span>•</span>
                                    <span>Exp: {item.ExpiryDate ? new Date(item.ExpiryDate).toLocaleDateString() : 'N/A'}</span>
                                    {(item.InterveningMovementsCount || item.InterveningMovementsDetected) && (item.InterveningMovementsCount || item.InterveningMovementsDetected) > 0 ? (
                                      <span className="text-amber-600 font-medium">
                                        ({item.InterveningMovementsCount || item.InterveningMovementsDetected} movement(s) after baseline)
                                      </span>
                                    ) : null}
                                  </div>
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-medium text-foreground">
                                  {item.SystemQuantity}
                                </td>
                                <td className="px-3 py-2.5 text-right">
                                  {isEditable ? (
                                    <Input
                                      type="number"
                                      min="0"
                                      value={edit.physical}
                                      onChange={(e) => handleItemChange(item.CountItemID, 'physical', e.target.value)}
                                      className="h-8 text-right font-mono text-xs w-24 ml-auto"
                                    />
                                  ) : (
                                    <span className="font-mono font-bold text-foreground">
                                      {item.PhysicalQuantity}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-right font-mono font-semibold">
                                  {liveVariance > 0 ? (
                                    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                                      <ArrowUpRight className="w-3.5 h-3.5" /> +{liveVariance}
                                    </span>
                                  ) : liveVariance < 0 ? (
                                    <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
                                      <ArrowDownRight className="w-3.5 h-3.5" /> {liveVariance}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-0.5 text-muted-foreground">
                                      <Minus className="w-3 h-3" /> 0
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  {isEditable ? (
                                    hasVariance ? (
                                      <select
                                        value={edit.reason}
                                        onChange={(e) => handleItemChange(item.CountItemID, 'reason', e.target.value)}
                                        className={cn(
                                          "w-full h-8 text-xs rounded-md border bg-background px-2 focus:outline-hidden",
                                          !edit.reason ? "border-amber-500 text-amber-700 bg-amber-50/50" : "border-border text-foreground"
                                        )}
                                      >
                                        <option value="">Select Reason (Required)...</option>
                                        {DISCREPANCY_REASONS.map(r => (
                                          <option key={r} value={r}>{r}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-muted-foreground italic text-[11px]">No variance</span>
                                    )
                                  ) : (
                                    <span className={cn("font-medium", hasVariance ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground")}>
                                      {item.DiscrepancyReason || (hasVariance ? '—' : 'Matched')}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2.5">
                                  {isEditable ? (
                                    <Input
                                      placeholder="Notes..."
                                      value={edit.notes}
                                      onChange={(e) => handleItemChange(item.CountItemID, 'notes', e.target.value)}
                                      className="h-8 text-xs"
                                    />
                                  ) : (
                                    <span className="text-muted-foreground text-[11px] truncate block max-w-xs">
                                      {item.Notes || '—'}
                                    </span>
                                  )}
                                </td>
                                {header.Status === 'Posted' && (
                                  <td className="px-3 py-2.5 text-right font-mono text-[11px] text-indigo-600 dark:text-indigo-400">
                                    {item.AdjustmentTransactionID ? `TX #${item.AdjustmentTransactionID}` : '—'}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {/* Drawer Bottom Action Bar */}
          {header && (
            <div className="p-4 border-t border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 shrink-0">
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span>Operating as: <strong>{currentUserId === 3 ? 'Inventory Officer (#3)' : 'Warehouse Supervisor (#1)'}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                {isEditable && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleSave}
                      disabled={isSaving || isSubmitting}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1" />
                      Save Draft
                    </Button>

                    <Button
                      size="sm"
                      onClick={onSubmitCount}
                      disabled={isSubmitting}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Submit for Review
                    </Button>
                  </>
                )}

                {header.Status === 'Submitted' && (
                  <>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={onOpenRejectModal}
                      disabled={isApproving}
                    >
                      <XCircle className="w-3.5 h-3.5 mr-1" />
                      Reject Count
                    </Button>

                    <Button
                      size="sm"
                      onClick={onApproveCount}
                      disabled={isApproving}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                      Approve Count
                    </Button>
                  </>
                )}

                {header.Status === 'Approved' && (
                  <Button
                    size="sm"
                    onClick={onPostAdjustment}
                    disabled={isPosting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1" />
                    Post Adjustment to Ledger
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
