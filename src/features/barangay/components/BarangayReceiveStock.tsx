import React, { useState } from 'react';
import { 
  ArrowDownToLine, Package, ShieldCheck, AlertTriangle, 
  CheckCircle2, XCircle, Search, Calendar, Check, X, Info,
  AlertOctagon, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';
import { IncomingDistribution, DistributionLineItem } from '../types';
import { fetchDistributionForReceipt, confirmDistributionReceipt } from '../api';

interface BarangayReceiveStockProps {
  userId: number | null;
  incoming: IncomingDistribution[];
  onRefresh: () => void;
  isLoading: boolean;
}

const DISCREPANCY_REASONS = [
  'Damaged / Broken in transit',
  'Shortage / Missing from container',
  'Seal broken / Packaging compromised',
  'Mislabeled / Incorrect lot delivered',
  'Expired or near-expiry upon receipt',
  'Other variance (specify in remarks)'
];

export function BarangayReceiveStock({
  userId,
  incoming,
  onRefresh,
  isLoading
}: BarangayReceiveStockProps) {
  const [selectedDistId, setSelectedDistId] = useState<number | null>(null);
  const [distData, setDistData] = useState<{ distribution: IncomingDistribution; items: DistributionLineItem[] } | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  
  // Confirmation Line Items State
  const [confirmItems, setConfirmItems] = useState<Record<number, { receivedQty: number; discrepancyReason: string; customNote: string }>>({});
  const [generalRemarks, setGeneralRemarks] = useState('');
  const [isReceiving, setIsReceiving] = useState(false);
  const [showConfirmSummary, setShowConfirmSummary] = useState(false);

  const handleOpenReceiptModal = async (distId: number) => {
    setSelectedDistId(distId);
    setIsLoadingDetails(true);
    setDistData(null);
    setGeneralRemarks('');
    setShowConfirmSummary(false);

    try {
      const data = await fetchDistributionForReceipt(distId, userId);
      setDistData(data);
      
      // Initialize confirmation state with issued quantities
      const initialMap: Record<number, { receivedQty: number; discrepancyReason: string; customNote: string }> = {};
      data.items.forEach(it => {
        initialMap[it.DistributionItemID] = {
          receivedQty: it.QuantityIssued,
          discrepancyReason: '',
          customNote: ''
        };
      });
      setConfirmItems(initialMap);
    } catch (err: any) {
      toast.error('Failed to load distribution items: ' + err.message);
      setSelectedDistId(null);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleQtyChange = (itemId: number, issuedQty: number, val: number) => {
    const receivedQty = Math.max(0, Math.min(issuedQty, val));
    setConfirmItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        receivedQty,
        discrepancyReason: receivedQty < issuedQty && !prev[itemId]?.discrepancyReason 
          ? DISCREPANCY_REASONS[0] 
          : prev[itemId]?.discrepancyReason
      }
    }));
  };

  const handleReasonChange = (itemId: number, reason: string) => {
    setConfirmItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        discrepancyReason: reason
      }
    }));
  };

  const handleCustomNoteChange = (itemId: number, note: string) => {
    setConfirmItems(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        customNote: note
      }
    }));
  };

  const handleAcceptAllIssued = () => {
    if (!distData) return;
    const allFull: Record<number, { receivedQty: number; discrepancyReason: string; customNote: string }> = {};
    distData.items.forEach(it => {
      allFull[it.DistributionItemID] = {
        receivedQty: it.QuantityIssued,
        discrepancyReason: '',
        customNote: ''
      };
    });
    setConfirmItems(allFull);
    toast.info('All items set to 100% issued quantity.');
  };

  // Calculations
  const totalIssued = distData ? distData.items.reduce((s, i) => s + i.QuantityIssued, 0) : 0;
  const totalAccepted = distData ? distData.items.reduce((s, i) => {
    const conf = confirmItems[i.DistributionItemID];
    return s + (conf !== undefined ? conf.receivedQty : i.QuantityIssued);
  }, 0) : 0;
  const totalVariance = totalIssued - totalAccepted;
  const hasDiscrepancy = totalVariance > 0;

  const validateAndOpenSummary = () => {
    if (!distData) return;

    // Check discrepancy reasons
    for (const it of distData.items) {
      const conf = confirmItems[it.DistributionItemID];
      if (conf && conf.receivedQty < it.QuantityIssued) {
        if (!conf.discrepancyReason.trim() && !conf.customNote.trim()) {
          toast.error(`Please select or provide a discrepancy reason for ${it.ProductName} (Batch ${it.LotNumber}).`);
          return;
        }
      }
    }

    setShowConfirmSummary(true);
  };

  const handleFinalConfirmReceipt = async () => {
    if (!selectedDistId || !distData) return;

    const formattedItems = distData.items.map(it => {
      const conf = confirmItems[it.DistributionItemID] || { receivedQty: it.QuantityIssued, discrepancyReason: '', customNote: '' };
      const reasonCombined = [conf.discrepancyReason, conf.customNote].filter(Boolean).join(' - ');
      return {
        distributionItemId: it.DistributionItemID,
        receivedQuantity: conf.receivedQty,
        discrepancyReason: conf.receivedQty < it.QuantityIssued ? (reasonCombined || 'Discrepancy flagged upon physical count') : ''
      };
    });

    setIsReceiving(true);
    try {
      const res = await confirmDistributionReceipt(selectedDistId, userId, {
        remarks: generalRemarks.trim(),
        items: formattedItems
      });

      if (res.hasDiscrepancy) {
        toast.warning(`Distribution ${res.distributionNumber} received with flagged discrepancies.`);
      } else {
        toast.success(`Distribution ${res.distributionNumber} received and ingested into station inventory!`);
      }

      setSelectedDistId(null);
      setDistData(null);
      setShowConfirmSummary(false);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to confirm receipt');
    } finally {
      setIsReceiving(false);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-primary" />
            Receive Stock &amp; Confirm Receipt
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Inspect physical Stock Distributions from Central Warehouse, Confirm Receipt, and record any Receiving Discrepancy
          </p>
        </div>

        <Button
          onClick={onRefresh}
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="text-xs font-semibold h-9 rounded-xl self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Check Shipments
        </Button>
      </div>

      {/* Pending Inbound Distributions Grid */}
      {incoming.length === 0 ? (
        <Card className="rounded-2xl border-border/50 shadow-sm p-8 sm:p-12 text-center">
          <CheckCircle2 className="w-10 sm:w-12 h-10 sm:h-12 mx-auto text-emerald-500 mb-2.5 opacity-90" />
          <h3 className="font-bold text-sm sm:text-base text-foreground">No Pending Inbound Shipments</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            All warehouse releases allocated for this Barangay station have been verified and ingested into local inventory.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
          {incoming.map(dist => (
            <Card key={dist.DistributionID} className="rounded-2xl border-border/60 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between p-4 space-y-3">
              <div className="space-y-2 border-b border-border/40 pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono font-black text-sm text-foreground">{dist.DistributionNumber}</div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                    Awaiting Inspection
                  </span>
                </div>
                {dist.StockRequestNumber && (
                  <div className="text-[11px] text-muted-foreground">
                    Ref SR: <strong className="text-foreground">{dist.StockRequestNumber}</strong>
                  </div>
                )}
              </div>

              <div className="space-y-1.5 text-xs flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Source Warehouse</span>
                  <span className="font-semibold text-foreground">{dist.SourceLocationName || 'Central Warehouse'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Released Date</span>
                  <span className="font-semibold text-foreground">{new Date(dist.ReleasedDate).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Medicines</span>
                  <span className="font-bold text-foreground">{dist.ItemCount} items</span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-border/30">
                  <span className="text-muted-foreground font-medium">Total Units Issued</span>
                  <span className="font-black text-primary text-sm">{dist.TotalQuantityIssued} units</span>
                </div>
              </div>

              <Button
                onClick={() => handleOpenReceiptModal(dist.DistributionID)}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-11 rounded-xl shadow-sm shadow-purple-600/20 flex items-center justify-center gap-1.5"
              >
                <ArrowDownToLine className="w-4 h-4" />
                <span>Inspect &amp; Confirm Receipt</span>
              </Button>
            </Card>
          ))}
        </div>
      )}

      {/* MOBILE-FIRST FULL-SCREEN INSPECTION MODAL */}
      {selectedDistId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm overflow-hidden">
          <div className="w-full sm:max-w-3xl h-full sm:h-auto sm:max-h-[92dvh] bg-card border border-border sm:rounded-2xl shadow-2xl flex flex-col">
            
            {/* Header */}
            <div className="p-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
              <div className="min-w-0 pr-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-foreground truncate">
                    {distData?.distribution.DistributionNumber || 'Loading...'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent text-accent-foreground border border-primary/25">
                    Field Receiving
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  Count physical package units & verify batch lot numbers
                </p>
              </div>

              <button 
                onClick={() => setSelectedDistId(null)}
                className="p-2 rounded-xl text-muted-foreground hover:bg-muted shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Helper Banner */}
            <div className="p-3 bg-accent/60 border-b border-border px-4 text-xs text-foreground flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="w-4 h-4 shrink-0 text-primary" />
                <span className="truncate text-[11px] sm:text-xs">
                  Count each lot. If damaged or short, enter count & reason.
                </span>
              </div>
              <Button
                type="button"
                onClick={handleAcceptAllIssued}
                variant="outline"
                size="sm"
                className="text-[11px] font-bold h-7 px-2.5 rounded-lg border-purple-500/35 text-purple-700 hover:bg-purple-500/15 dark:text-purple-300 shrink-0"
              >
                Match All Issued
              </Button>
            </div>

            {/* Scrollable Inspection Items List */}
            <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3">
              {isLoadingDetails ? (
                <div className="py-16 text-center text-xs text-muted-foreground">
                  Loading distribution item batches...
                </div>
              ) : distData ? (
                <>
                  <div className="space-y-3">
                    {distData.items.map(item => {
                      const conf = confirmItems[item.DistributionItemID] || { receivedQty: item.QuantityIssued, discrepancyReason: '', customNote: '' };
                      const isDiscrepant = conf.receivedQty < item.QuantityIssued;
                      const variance = item.QuantityIssued - conf.receivedQty;

                      return (
                        <div 
                          key={item.DistributionItemID}
                          className={`p-3.5 rounded-xl border transition-colors space-y-2.5 ${
                            isDiscrepant 
                              ? 'border-amber-500/60 bg-amber-500/5' 
                              : 'border-border/70 bg-card'
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <h4 className="font-bold text-xs sm:text-sm text-foreground">
                                {item.ProductName}
                              </h4>
                              {item.GenericName && (
                                <p className="text-[11px] text-muted-foreground">{item.GenericName}</p>
                              )}
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground pt-0.5">
                                <span>Lot: <strong className="font-mono text-foreground">{item.LotNumber}</strong></span>
                                <span>Exp: <strong className="text-foreground">{new Date(item.ExpiryDate).toLocaleDateString()}</strong></span>
                              </div>
                            </div>

                            {/* Quantity Controls */}
                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-0 border-border/40">
                              <div className="text-left sm:text-right">
                                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Issued</span>
                                <span className="text-xs sm:text-sm font-bold text-foreground">{item.QuantityIssued} units</span>
                              </div>

                              <div className="w-40">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-[10px] uppercase font-bold text-primary">Accepted Qty</span>
                                  {conf.receivedQty !== item.QuantityIssued && (
                                    <button
                                      type="button"
                                      onClick={() => handleQtyChange(item.DistributionItemID, item.QuantityIssued, item.QuantityIssued)}
                                      className="text-[10px] text-primary hover:underline font-semibold"
                                    >
                                      Reset
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleQtyChange(item.DistributionItemID, item.QuantityIssued, Math.max(0, conf.receivedQty - 1))}
                                    className="w-9 h-9 rounded-xl border border-border bg-secondary hover:bg-accent flex items-center justify-center text-foreground shrink-0"
                                    aria-label="Decrease accepted quantity"
                                  >
                                    <Minus className="w-3.5 h-3.5" />
                                  </button>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={item.QuantityIssued}
                                    value={conf.receivedQty}
                                    onChange={e => handleQtyChange(item.DistributionItemID, item.QuantityIssued, parseInt(e.target.value) || 0)}
                                    className={`h-9 text-xs font-black text-center rounded-xl px-1 ${
                                      isDiscrepant ? 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300' : ''
                                    }`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleQtyChange(item.DistributionItemID, item.QuantityIssued, Math.min(item.QuantityIssued, conf.receivedQty + 1))}
                                    className="w-9 h-9 rounded-xl border border-border bg-secondary hover:bg-accent flex items-center justify-center text-foreground shrink-0"
                                    aria-label="Increase accepted quantity"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Discrepancy Capture Section */}
                          {isDiscrepant && (
                            <div className="pt-2.5 border-t border-amber-500/20 space-y-2 text-xs">
                              <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-400 font-bold">
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                <span>Variance: -{variance} units unreceived. Discrepancy reason required:</span>
                              </div>

                              <select
                                value={conf.discrepancyReason}
                                onChange={e => handleReasonChange(item.DistributionItemID, e.target.value)}
                                className="w-full h-10 rounded-xl border border-amber-500/50 bg-background px-3 text-xs font-semibold text-foreground focus:outline-none"
                              >
                                {DISCREPANCY_REASONS.map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>

                              <Input
                                value={conf.customNote}
                                onChange={e => handleCustomNoteChange(item.DistributionItemID, e.target.value)}
                                placeholder="Additional details (e.g. 1 vial broken on bottom corner of box)"
                                className="h-9 text-xs border-amber-500/30 rounded-xl bg-background"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* General Station Remarks */}
                  <div className="pt-2">
                    <label className="block text-xs font-bold text-foreground mb-1">
                      Inspection Notes / General Remarks (Optional)
                    </label>
                    <Input
                      value={generalRemarks}
                      onChange={e => setGeneralRemarks(e.target.value)}
                      placeholder="e.g. Packages received in good order by BHW on field duty"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </>
              ) : null}
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="p-3.5 sm:p-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3 shrink-0">
              <div className="text-xs">
                <span className="text-muted-foreground block text-[10px] uppercase font-bold">Physical Total</span>
                <span className="font-black text-sm text-foreground">
                  {totalAccepted} / {totalIssued} units
                </span>
                {hasDiscrepancy && (
                  <span className="text-[10px] text-amber-600 font-bold ml-1.5">
                    (-{totalVariance} variance)
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedDistId(null)}
                  disabled={isReceiving}
                  className="text-xs h-10 px-3.5 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={validateAndOpenSummary}
                  disabled={isReceiving || isLoadingDetails}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 px-4 rounded-xl shadow-sm shadow-purple-600/20 flex items-center gap-1.5"
                >
                  <ArrowDownToLine className="w-3.5 h-3.5" />
                  <span>Review & Ingest</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRMATION SUMMARY MODAL BEFORE DATABASE COMMIT */}
      {showConfirmSummary && distData && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 text-primary flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-black text-foreground">Confirm Shipment Ingestion</h3>
                <p className="text-[11px] text-muted-foreground">{distData.distribution.DistributionNumber}</p>
              </div>
            </div>

            <div className="p-3.5 bg-muted/40 rounded-xl text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Issued:</span>
                <strong className="text-foreground">{totalIssued} units</strong>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Accepted into Stock:</span>
                <strong className="text-emerald-600 text-sm">{totalAccepted} units</strong>
              </div>
              {hasDiscrepancy ? (
                <div className="flex justify-between items-center text-amber-700 dark:text-amber-400 font-bold pt-1 border-t border-border/40">
                  <span>Documented Discrepancy:</span>
                  <span>-{totalVariance} units</span>
                </div>
              ) : (
                <div className="text-emerald-600 text-[11px] font-semibold pt-1 border-t border-border/40">
                  ✓ 100% full shipment verified without discrepancy.
                </div>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Upon confirmation, {totalAccepted} units will be immediately added to this station's inventory with immutable RECEIPT ledger records.
            </p>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConfirmSummary(false)}
                disabled={isReceiving}
                className="text-xs h-10 rounded-xl px-3"
              >
                Back
              </Button>
              <Button
                onClick={handleFinalConfirmReceipt}
                disabled={isReceiving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-10 rounded-xl px-4 shadow-sm shadow-purple-600/20 flex items-center gap-1.5"
              >
                {isReceiving ? 'Ingesting Stock...' : 'Confirm & Commit Receipt'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}