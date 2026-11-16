import React, { useState, useEffect } from 'react';
import {
  Inbox,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Clock,
  ShieldCheck,
  AlertTriangle,
  X,
  FileText,
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { IssuedDistribution, DistributionDetailItem } from '../../types';
import { PharmacyStockRequests } from '../Requests/PharmacyStockRequests';

interface ReceiveDistributionProps {
  onDistributionReceived?: () => void;
}

export function ReceiveDistribution({ onDistributionReceived }: ReceiveDistributionProps) {
  const [subView, setSubView] = useState<'incoming' | 'requests'>('incoming');
  const [distributions, setDistributions] = useState<IssuedDistribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDist, setSelectedDist] = useState<IssuedDistribution | null>(null);
  const [detailItems, setDetailItems] = useState<DistributionDetailItem[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [receiving, setReceiving] = useState(false);
  const [remarksInput, setRemarksInput] = useState('Received and verified by Pharmacy Staff');
  const [confirmItems, setConfirmItems] = useState<
    Record<string, { acceptedQty: number; damagedQty: number; reason: string }>
  >({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchIssuedDistributions = async () => {
    try {
      setLoading(true);
      const data = await pharmacyApi.getIssuedDistributions();
      setDistributions(data);
    } catch (err: any) {
      console.error('Failed to load issued distributions:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch issued distributions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIssuedDistributions();
  }, []);

  const openInspection = async (dist: IssuedDistribution) => {
    setSelectedDist(dist);
    setRemarksInput('Received and verified by Pharmacy Staff');
    setFeedback(null);
    try {
      setLoadingDetails(true);
      const data = await pharmacyApi.getDistributionDetails(dist.DistributionID);
      setDetailItems(data.items);
      const initMap: Record<string, { acceptedQty: number; damagedQty: number; reason: string }> = {};
      data.items.forEach((it) => {
        initMap[String(it.DistributionItemID)] = {
          acceptedQty: Number(it.Quantity),
          damagedQty: 0,
          reason: '',
        };
      });
      setConfirmItems(initMap);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch distribution items' });
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleQtyChange = (itemId: string, issuedQty: number, field: 'acceptedQty' | 'damagedQty', val: number) => {
    setConfirmItems((prev) => {
      const current = prev[itemId] || { acceptedQty: issuedQty, damagedQty: 0, reason: '' };
      let acceptedQty = current.acceptedQty;
      let damagedQty = current.damagedQty;
      if (field === 'acceptedQty') {
        acceptedQty = Math.max(0, Math.min(issuedQty, val));
        if (acceptedQty + damagedQty > issuedQty) {
          damagedQty = Math.max(0, issuedQty - acceptedQty);
        }
      } else {
        damagedQty = Math.max(0, Math.min(issuedQty - acceptedQty, val));
      }
      return {
        ...prev,
        [itemId]: {
          ...current,
          acceptedQty,
          damagedQty,
          reason:
            acceptedQty < issuedQty && !current.reason
              ? damagedQty > 0
                ? 'Damaged in transit'
                : 'Shortage upon physical count'
              : current.reason,
        },
      };
    });
  };

  const handleReasonChange = (itemId: string, reason: string) => {
    setConfirmItems((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] || { acceptedQty: 0, damagedQty: 0, reason: '' }),
        reason,
      },
    }));
  };

  const handleConfirmReceive = async () => {
    if (!selectedDist || receiving) return;

    // Validate discrepancy reasons when accepted < issued
    for (const item of detailItems) {
      const conf = confirmItems[String(item.DistributionItemID)];
      if (conf && conf.acceptedQty < Number(item.Quantity) && !conf.reason.trim()) {
        setFeedback({
          type: 'error',
          message: `Please specify a discrepancy reason for ${item.ProductName} (Lot ${item.LotNumber}).`,
        });
        return;
      }
    }

    try {
      setReceiving(true);
      setFeedback(null);
      const formattedItems = detailItems.map((it) => {
        const conf = confirmItems[String(it.DistributionItemID)] || {
          acceptedQty: Number(it.Quantity),
          damagedQty: 0,
          reason: '',
        };
        const shortageQty = Math.max(0, Number(it.Quantity) - conf.acceptedQty - conf.damagedQty);
        return {
          distributionItemId: it.DistributionItemID,
          receivedQuantity: conf.acceptedQty,
          damagedQuantity: conf.damagedQty,
          shortageQuantity: shortageQty,
          discrepancyReason: conf.reason,
        };
      });

      const res = await pharmacyApi.receiveDistribution(
        selectedDist.DistributionID,
        {
          remarks: remarksInput.trim() || 'Received and verified by Pharmacy Staff',
          items: formattedItems,
        },
        1
      );
      setFeedback({
        type: 'success',
        message: `Successfully received distribution ${selectedDist.DistributionNumber}! ${
          res.totalAcceptedUnits ?? res.itemsReceived
        } accepted unit(s) across ${res.itemsReceived} batch(es) ingested into pharmacy inventory.${
          res.hasDiscrepancy ? ' Discrepancy recorded in audit ledger.' : ''
        }`,
      });
      setSelectedDist(null);
      await fetchIssuedDistributions();
      if (onDistributionReceived) onDistributionReceived();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to receive distribution' });
    } finally {
      setReceiving(false);
    }
  };

  const totalIssued = detailItems.reduce((s, i) => s + Number(i.Quantity), 0);
  const totalAccepted = detailItems.reduce((s, i) => {
    const conf = confirmItems[String(i.DistributionItemID)];
    return s + (conf ? conf.acceptedQty : Number(i.Quantity));
  }, 0);
  const totalDamaged = detailItems.reduce((s, i) => {
    const conf = confirmItems[String(i.DistributionItemID)];
    return s + (conf ? conf.damagedQty : 0);
  }, 0);
  const totalShortage = Math.max(0, totalIssued - totalAccepted - totalDamaged);

  return (
    <div className="space-y-4">
      {/* Sub-Navigation Toggle: Incoming Transfers vs Stock Requests to Warehouse */}
      <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1.5 rounded-2xl w-fit shadow-xs">
        <button
          onClick={() => setSubView('incoming')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer min-h-[40px] ${
            subView === 'incoming'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Inbox className="w-4 h-4" />
          <span>Receive Distributions ({distributions.length})</span>
        </button>
        <button
          onClick={() => setSubView('requests')}
          className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer min-h-[40px] ${
            subView === 'requests'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Stock Requests to Warehouse</span>
        </button>
      </div>

      {subView === 'requests' ? (
        <PharmacyStockRequests />
      ) : (
        <>
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-4 rounded-2xl flex items-center justify-between border shadow-xs ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                  : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
              }`}
            >
              <div className="flex items-center gap-2.5 text-sm font-medium">
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
              <button
                onClick={() => setFeedback(null)}
                className="text-xs hover:opacity-75 cursor-pointer font-bold px-2 py-1 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Header Info */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Inbox className="w-5 h-5 text-teal-600 shrink-0" />
                <span>Warehouse Stock Transfers Awaiting Receipt</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Verify physical counts, record any shortages or damaged units, and ingest accepted quantities into City Pharmacy inventory.
              </p>
            </div>
            <button
              onClick={fetchIssuedDistributions}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer self-start sm:self-auto min-h-[40px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Issued Distributions List */}
          {loading ? (
            <div className="py-12 text-center text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs">
              <div className="flex items-center justify-center gap-2">
                <RefreshCw className="w-5 h-5 text-teal-600 animate-spin" />
                <span className="text-sm font-medium">Checking pending distributions...</span>
              </div>
            </div>
          ) : distributions.length === 0 ? (
            <div className="py-12 text-center text-slate-500 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs px-4">
              <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">All Caught Up!</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                There are no pending warehouse stock transfers waiting to be received right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {distributions.map((dist) => (
                <div
                  key={dist.DistributionID}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between hover:border-teal-500/40 transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-sm text-teal-700 dark:text-teal-400">
                        {dist.DistributionNumber}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                        <Clock className="w-3 h-3" /> Issued
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-4 text-xs">
                      <div className="text-slate-500">Released Date:</div>
                      <div className="font-medium text-slate-900 dark:text-white text-right">
                        {new Date(dist.ReleasedDate).toLocaleString()}
                      </div>

                      <div className="text-slate-500">Released By:</div>
                      <div className="font-medium text-slate-900 dark:text-white text-right">
                        {dist.ReleasedByName || 'Warehouse Officer'}
                      </div>

                      <div className="text-slate-500">Items / Total Units:</div>
                      <div className="font-bold text-slate-900 dark:text-white text-right">
                        {dist.TotalLineItems} line(s) · {dist.TotalQuantity} units
                      </div>
                    </div>

                    {dist.Remarks && (
                      <div className="mt-3 text-xs bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800 text-slate-600 dark:text-slate-300 italic">
                        "{dist.Remarks}"
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">Traceable Batch Ingestion</span>
                    <button
                      onClick={() => openInspection(dist)}
                      className="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs min-h-[44px]"
                    >
                      <span>Inspect &amp; Receive</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Inspection & Confirmation Modal */}
          {selectedDist && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl max-w-3xl w-full max-h-[92dvh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
                {/* Mobile Drag Handle */}
                <div className="flex justify-center pt-3 pb-1 sm:hidden">
                  <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                </div>

                {/* Modal Header */}
                <div className="px-5 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
                  <div>
                    <div className="text-[10px] sm:text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wider">
                      Warehouse Stock Transfer Receipt &amp; Physical Verification
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white font-mono">
                      {selectedDist.DistributionNumber}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedDist(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
                  {/* Summary Metrics */}
                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-3.5 border border-slate-100 dark:border-slate-800 text-xs grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Issued Units</span>
                      <span className="font-bold text-slate-900 dark:text-white text-sm">{totalIssued}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Accepted Units</span>
                      <span className="font-bold text-teal-600 text-sm">{totalAccepted}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Damaged</span>
                      <span className="font-bold text-rose-600 text-sm">{totalDamaged}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase">Shortage</span>
                      <span className="font-bold text-amber-600 text-sm">{totalShortage}</span>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
                      Line Items &amp; Physical Count Verification ({detailItems.length})
                    </h4>
                    {loadingDetails ? (
                      <div className="py-8 text-center text-slate-500 flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 text-teal-600 animate-spin" />
                        <span className="text-xs">Loading batch information...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {detailItems.map((item) => {
                          const issued = Number(item.Quantity);
                          const conf = confirmItems[String(item.DistributionItemID)] || {
                            acceptedQty: issued,
                            damagedQty: 0,
                            reason: '',
                          };
                          const shortage = Math.max(0, issued - conf.acceptedQty - conf.damagedQty);
                          const hasVariance = conf.acceptedQty < issued || conf.damagedQty > 0;

                          return (
                            <div
                              key={item.DistributionItemID}
                              className={`p-3.5 rounded-2xl border transition-colors space-y-2.5 ${
                                hasVariance
                                  ? 'border-amber-400 bg-amber-50/40 dark:bg-amber-950/20'
                                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                <div>
                                  <div className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                                    {item.ProductName}
                                  </div>
                                  <div className="text-[11px] text-slate-500">{item.GenericName}</div>
                                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[11px]">
                                    <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
                                      Lot: {item.LotNumber}
                                    </span>
                                    <span className="text-slate-500">
                                      Exp: {new Date(item.ExpiryDate).toLocaleDateString()}
                                    </span>
                                    <span className="font-bold text-slate-700 dark:text-slate-200">
                                      Issued: {issued}
                                    </span>
                                  </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2 sm:w-64 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200/60 dark:border-slate-800">
                                  <div>
                                    <label className="text-[10px] font-bold uppercase text-teal-600 block">
                                      Accepted
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={issued}
                                      value={conf.acceptedQty}
                                      onChange={(e) =>
                                        handleQtyChange(
                                          String(item.DistributionItemID),
                                          issued,
                                          'acceptedQty',
                                          parseInt(e.target.value, 10) || 0
                                        )
                                      }
                                      className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold uppercase text-rose-600 block">
                                      Damaged
                                    </label>
                                    <input
                                      type="number"
                                      min={0}
                                      max={issued - conf.acceptedQty}
                                      value={conf.damagedQty}
                                      onChange={(e) =>
                                        handleQtyChange(
                                          String(item.DistributionItemID),
                                          issued,
                                          'damagedQty',
                                          parseInt(e.target.value, 10) || 0
                                        )
                                      }
                                      className="w-full mt-0.5 px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-bold uppercase text-amber-600 block">
                                      Shortage
                                    </label>
                                    <div className="w-full mt-0.5 px-2 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-center text-amber-700 dark:text-amber-300">
                                      {shortage}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {hasVariance && (
                                <div className="pt-2 border-t border-amber-300/50 flex flex-col sm:flex-row sm:items-center gap-2">
                                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1 shrink-0">
                                    <AlertTriangle className="w-3.5 h-3.5" /> Discrepancy Reason:
                                  </span>
                                  <input
                                    type="text"
                                    value={conf.reason}
                                    onChange={(e) =>
                                      handleReasonChange(String(item.DistributionItemID), e.target.value)
                                    }
                                    placeholder="Explain shortage or damaged units..."
                                    className="flex-1 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-amber-400 rounded-xl text-xs"
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-500 uppercase">
                      Receiving Verification Notes
                    </label>
                    <input
                      type="text"
                      value={remarksInput}
                      onChange={(e) => setRemarksInput(e.target.value)}
                      placeholder="Verification remarks..."
                      className="w-full mt-1 px-3 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>

                  <div className="bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/60 rounded-xl p-3 text-xs text-teal-800 dark:text-teal-300 flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      Only <strong>Accepted Quantities ({totalAccepted} units)</strong> will be added to active{' '}
                      <strong>Pharmacy Stocks</strong> and logged in the inventory ledger. Any damaged or missing units are recorded in the discrepancy audit report.
                    </span>
                  </div>
                </div>

                {/* Modal Footer */}
                <div
                  className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-800/30 shrink-0"
                  style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
                >
                  <button
                    onClick={() => setSelectedDist(null)}
                    disabled={receiving}
                    className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer min-h-[44px]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmReceive}
                    disabled={receiving || loadingDetails}
                    className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50 min-h-[44px]"
                  >
                    {receiving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{receiving ? 'Receiving...' : 'Confirm Physical Receipt'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
