import React, { useState, useEffect } from 'react';
import { 
  Printer, X, CheckCircle2, XCircle, Building2, 
  Calendar, User, Pill, ShieldCheck, FileText, Download
} from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { BarangayDisbursement, DisbursementItemDetail } from '../types';
import { fetchDisbursementDetails } from '../api';
import { toast } from 'sonner';

interface BarangayVoucherModalProps {
  disbursementId: number;
  userId: number | null;
  onClose: () => void;
  initialData?: BarangayDisbursement | null;
}

export function BarangayVoucherModal({
  disbursementId,
  userId,
  onClose,
  initialData
}: BarangayVoucherModalProps) {
  const [data, setData] = useState<{ disbursement: BarangayDisbursement; items: DisbursementItemDetail[] } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      setIsLoading(true);
      try {
        const res = await fetchDisbursementDetails(disbursementId, userId);
        if (isMounted) setData(res);
      } catch (err: any) {
        if (isMounted) {
          toast.error('Failed to load voucher details: ' + err.message);
          // If we have initialData, create fallback
          if (initialData) {
            setData({
              disbursement: initialData,
              items: []
            });
          }
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    load();
    return () => { isMounted = false; };
  }, [disbursementId, userId]);

  const handlePrint = () => {
    window.print();
  };

  const disb = data?.disbursement || initialData;
  const items = data?.items || [];
  const isReversed = disb?.Status === 'Reversed';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95dvh] print:max-h-none print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none">
        
        {/* Modal Toolbar (Hidden during print) */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-accent text-primary flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-foreground">Disbursement Voucher</h3>
              <p className="text-[11px] text-muted-foreground">{disb?.DisbursementNumber || 'Loading...'}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              size="sm"
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-bold text-xs h-9 px-3 rounded-xl shadow-sm flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Voucher</span>
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Printable Voucher Sheet */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 print:p-4 bg-white text-slate-900 print:text-black">
          {isLoading ? (
            <div className="py-16 text-center text-xs text-muted-foreground print:hidden">
              Loading official voucher details...
            </div>
          ) : disb ? (
            <div className="voucher-printable space-y-6 max-w-xl mx-auto">
              
              {/* Official Header */}
              <div className="text-center pb-4 border-b-2 border-slate-900 space-y-1">
                <div className="text-[10px] sm:text-xs font-semibold tracking-wider uppercase text-slate-600">
                  Republic of the Philippines • Province of Samar
                </div>
                <h1 className="text-base sm:text-lg font-black tracking-tight text-slate-950 uppercase">
                  City Health Office • Catbalogan City
                </h1>
                <div className="inline-block px-3 py-1 rounded bg-purple-50 border border-purple-300 text-purple-800 text-[11px] sm:text-xs font-black uppercase tracking-wider mt-1">
                  Barangay Medicine Disbursement Voucher
                </div>
              </div>

              {/* Status Banner (if reversed) */}
              {isReversed && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-300 text-red-900 text-xs font-bold text-center">
                  ⚠️ THIS VOUCHER WAS REVERSED ON {disb.ReversedDate ? new Date(disb.ReversedDate).toLocaleDateString() : ''}.
                  {disb.ReversalReason && <div className="font-normal text-[11px] mt-0.5">Reason: {disb.ReversalReason}</div>}
                </div>
              )}

              {/* Voucher Meta Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Voucher Reference</span>
                  <span className="font-mono font-black text-slate-900 text-sm">{disb.DisbursementNumber}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Date & Time</span>
                  <span className="font-semibold text-slate-900">
                    {new Date(disb.DisbursementDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}{' '}
                    {new Date(disb.DisbursementDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Health Station</span>
                  <span className="font-bold text-slate-900">BHS {disb.BarangayName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">Disbursed By (BHW)</span>
                  <span className="font-semibold text-slate-900">{disb.DisbursedByName || 'Barangay Health Worker'}</span>
                </div>
              </div>

              {/* Recipient Details Card */}
              <div className="p-3.5 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Resident / Recipient Information</div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                  <div>
                    <span className="text-[10px] text-slate-500">Name: </span>
                    <strong className="text-sm font-black text-slate-950">{disb.RecipientName}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500">Barangay: </span>
                    <strong className="text-slate-900">{disb.BarangayName}</strong>
                  </div>
                </div>
                {disb.Remarks && (
                  <div className="text-[11px] text-slate-600 pt-1 border-t border-slate-100">
                    <span className="font-semibold">Program / Purpose: </span>{disb.Remarks}
                  </div>
                )}
              </div>

              {/* Itemized Medicine Table */}
              <div className="space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Disbursed Medicines</span>
                  <span className="text-[11px] font-normal text-slate-500">FEFO Allocated</span>
                </div>

                <div className="border border-slate-300 rounded-lg overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 border-b border-slate-300 font-bold text-slate-700">
                      <tr>
                        <th className="py-2 px-3">Item Description</th>
                        <th className="py-2 px-3 text-center">Batch / Lot</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                        <th className="py-2 px-3">Dosage Regimen</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-4 text-center text-slate-500">
                            {disb.TotalQuantity ? `${disb.TotalQuantity} units disbursed (see summary)` : 'No line items recorded'}
                          </td>
                        </tr>
                      ) : (
                        items.map((it, idx) => (
                          <tr key={it.DisbursementItemID || idx}>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{it.ProductName}</div>
                              {it.GenericName && <div className="text-[10px] text-slate-500 font-normal">{it.GenericName}</div>}
                              {(it.Form || it.Dosage) && (
                                <div className="text-[10px] text-slate-600">{it.Form || ''} {it.Dosage || ''}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">
                              {it.LotNumber || '-'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-black text-slate-950">
                              {it.Quantity} {it.UnitName || 'pcs'}
                            </td>
                            <td className="py-2.5 px-3 text-[11px] text-slate-700 italic">
                              {it.DosageInstructions || 'As directed by healthcare officer'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-300 font-bold">
                      <tr>
                        <td colSpan={2} className="py-2 px-3 text-right text-slate-700 uppercase text-[10px]">Total Units Disbursed:</td>
                        <td className="py-2 px-3 text-right font-black text-slate-950 text-sm">
                          {items.reduce((s, i) => s + i.Quantity, 0) || disb.TotalQuantity || 0}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              {/* Signatures & Certification Block */}
              <div className="pt-6 grid grid-cols-2 gap-8 text-xs">
                <div className="space-y-8 text-center">
                  <div className="border-b border-slate-400 pb-1 font-bold text-slate-900">
                    {disb.DisbursedByName || 'Barangay Health Worker'}
                  </div>
                  <div className="text-[10px] uppercase text-slate-500 font-bold -mt-7">
                    Issuing Health Worker (Signature over Printed Name)
                  </div>
                </div>

                <div className="space-y-8 text-center">
                  <div className="border-b border-slate-400 pb-1 font-bold text-slate-900">
                    {disb.RecipientName}
                  </div>
                  <div className="text-[10px] uppercase text-slate-500 font-bold -mt-7">
                    Resident / Recipient (Signature over Printed Name)
                  </div>
                </div>
              </div>

              {/* Official Seal Footnote */}
              <div className="pt-4 text-center text-[10px] text-slate-400 border-t border-slate-200">
                Official electronic voucher generated by eMEDICS • Catbalogan City Health Office. Tamper-evident ledger record.
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer (Hidden during print) */}
        <div className="p-3 sm:p-4 border-t border-border bg-muted/20 flex justify-end gap-2 print:hidden shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="text-xs h-9 px-4 rounded-xl"
          >
            Close
          </Button>
          <Button
            onClick={handlePrint}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs font-bold text-xs h-9 px-4 rounded-xl shadow-sm flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Official Voucher</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
