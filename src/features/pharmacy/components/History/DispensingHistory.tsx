import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  FileText,
  RotateCcw,
  Printer,
  X,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Eye,
  AlertTriangle,
  User,
  Calendar,
  Package,
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { DispensingRecord, DispensingVoucherItem } from '../../types';

interface DispensingHistoryProps {
  userId?: number;
}

export function DispensingHistory({ userId }: DispensingHistoryProps = {}) {
  const resolvedUserId = userId || Number(localStorage.getItem('pharma_userId') || localStorage.getItem('userId') || 1);
  const [history, setHistory] = useState<DispensingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Voucher details state
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [voucherData, setVoucherData] = useState<{ dispensing: DispensingRecord; items: DispensingVoucherItem[] } | null>(null);
  const [loadingVoucher, setLoadingVoucher] = useState(false);

  // Reversal state
  const [reversalTarget, setReversalTarget] = useState<DispensingRecord | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [reversing, setReversing] = useState(false);

  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await pharmacyApi.getDispensingHistory({
        search,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      setHistory(data);
    } catch (err: any) {
      console.error('Failed to load dispensing history:', err);
      setFeedback({ type: 'error', message: err.message || 'Failed to fetch dispensing history' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchHistory();
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, statusFilter]);

  const viewVoucher = async (saleId: number) => {
    setSelectedSaleId(saleId);
    try {
      setLoadingVoucher(true);
      const data = await pharmacyApi.getDispensingDetails(saleId);
      setVoucherData(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to load voucher' });
      setSelectedSaleId(null);
    } finally {
      setLoadingVoucher(false);
    }
  };

  const handleConfirmReversal = async () => {
    if (!reversalTarget) return;
    if (!reversalReason.trim()) {
      setFeedback({ type: 'error', message: 'A documented reason is required to cancel a dispensing record.' });
      return;
    }

    try {
      setReversing(true);
      const res = await pharmacyApi.reverseDispensing(reversalTarget.SaleID, reversalReason, resolvedUserId);
      setFeedback({ type: 'success', message: res.message });
      setReversalTarget(null);
      setReversalReason('');
      await fetchHistory();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to reverse transaction' });
    } finally {
      setReversing(false);
    }
  };

  return (
    <div className="space-y-4">
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
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-600" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs hover:opacity-75 cursor-pointer font-bold px-2 py-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search reference #, patient, Rx #, doctor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-900 dark:text-white"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status filter chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {['all', 'Completed', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {st === 'all' ? 'All Records' : st}
            </button>
          ))}
        </div>
      </div>

      {/* ── MOBILE: Transaction Cards (< md) ── */}
      <div className="md:hidden space-y-3">
        {loading ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center shadow-xs">
            <div className="flex items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="w-5 h-5 text-teal-600 animate-spin" />
              <span className="text-sm">Loading dispensing records...</span>
            </div>
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-10 text-center shadow-xs">
            <History className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
            <p className="text-sm text-slate-500">No dispensing records found.</p>
          </div>
        ) : (
          history.map((record) => (
            <div
              key={record.SaleID}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3"
            >
              {/* Reference + status */}
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold text-teal-700 dark:text-teal-400">
                  {record.DispenseNumber}
                </span>
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    record.Status === 'Completed'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                  }`}
                >
                  {record.Status}
                </span>
              </div>

              {/* Patient + date */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                    {record.PatientName}
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 flex-wrap">
                    <span>{record.Barangay || '—'}</span>
                    <span>·</span>
                    <span>{new Date(record.SaleDate).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>

              {/* Prescription + units row */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5">
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">Prescription</div>
                  <div className="font-medium text-slate-900 dark:text-white mt-0.5">
                    {record.PrescriptionNumber || '—'}
                  </div>
                  <div className="text-slate-500 text-[10px] mt-0.5">{record.PhysicianName || '—'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5">
                  <div className="text-slate-500 text-[10px] uppercase font-semibold">Units Dispensed</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white leading-tight">
                    {record.TotalUnits}
                  </div>
                  <div className="text-slate-500 text-[10px]">{record.TotalLineItems} item{record.TotalLineItems === 1 ? '' : 's'}</div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  onClick={() => viewVoucher(record.SaleID)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors min-h-[44px]"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>View Voucher</span>
                </button>
                {record.Status === 'Completed' && (
                  <button
                    onClick={() => setReversalTarget(record)}
                    className="flex-1 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors min-h-[44px]"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reverse</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── DESKTOP/TABLET: Table (≥ md) ── */}
      <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Reference #</th>
                <th className="py-3 px-3">Date &amp; Time</th>
                <th className="py-3 px-3">Patient</th>
                <th className="py-3 px-3">Prescription / Doctor</th>
                <th className="py-3 px-3 text-center">Items</th>
                <th className="py-3 px-3 text-right">Total Units</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-teal-600 animate-spin" />
                      <span>Loading dispensing records...</span>
                    </div>
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No dispensing records found.
                  </td>
                </tr>
              ) : (
                history.map((record) => (
                  <tr
                    key={record.SaleID}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-teal-700 dark:text-teal-400">
                      {record.DispenseNumber}
                    </td>
                    <td className="py-3 px-3 text-slate-500 whitespace-nowrap">
                      {new Date(record.SaleDate).toLocaleString()}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">{record.PatientName}</div>
                      <div className="text-[11px] text-slate-500">{record.Barangay || '—'}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-slate-700 dark:text-slate-300 font-medium">
                        {record.PrescriptionNumber || '—'}
                      </div>
                      <div className="text-[11px] text-slate-500">{record.PhysicianName || '—'}</div>
                    </td>
                    <td className="py-3 px-3 text-center font-medium">{record.TotalLineItems}</td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                      {record.TotalUnits}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          record.Status === 'Completed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300'
                        }`}
                      >
                        {record.Status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => viewVoucher(record.SaleID)}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Voucher</span>
                      </button>
                      {record.Status === 'Completed' && (
                        <button
                          onClick={() => setReversalTarget(record)}
                          className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:hover:bg-rose-900/50 dark:text-rose-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reverse</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Voucher Detail Modal ── */}
      {selectedSaleId && voucherData && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-xl sm:max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div>
                <span className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                  Dispensing Record
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white font-mono">
                  {voucherData.dispensing.DispenseNumber}
                </h3>
              </div>
              <button
                onClick={() => { setSelectedSaleId(null); setVoucherData(null); }}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 voucher-printable">
              <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                Catbalogan City Health Office · Official Pharmacy Dispensing Voucher
              </div>
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3.5 text-xs grid grid-cols-2 gap-2">
                <div><span className="text-slate-500">Patient:</span> <span className="font-bold">{voucherData.dispensing.PatientName}</span></div>
                <div><span className="text-slate-500">Date:</span> <span>{new Date(voucherData.dispensing.SaleDate).toLocaleString()}</span></div>
                <div><span className="text-slate-500">Prescription:</span> <span>{voucherData.dispensing.PrescriptionNumber || '—'}</span></div>
                <div><span className="text-slate-500">Doctor:</span> <span>{voucherData.dispensing.PhysicianName || '—'}</span></div>
                <div><span className="text-slate-500">Pharmacist:</span> <span>{voucherData.dispensing.PharmacistName || 'Staff'}</span></div>
                <div>
                  <span className="text-slate-500">Status:</span>{' '}
                  <span className={`font-bold ${voucherData.dispensing.Status === 'Completed' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {voucherData.dispensing.Status}
                  </span>
                </div>
                {voucherData.dispensing.CancellationReason && (
                  <div className="col-span-2 text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-2 rounded-lg">
                    Cancellation Reason: {voucherData.dispensing.CancellationReason}
                  </div>
                )}
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="p-2.5">Medicine</th>
                      <th className="p-2.5">Batch / Lot</th>
                      <th className="p-2.5">Expiry</th>
                      <th className="p-2.5 text-right">Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {voucherData.items.map((it) => (
                      <tr key={it.DetailID}>
                        <td className="p-2.5 font-medium">
                          {it.ProductName}
                          {it.DosageInstructions && (
                            <div className="text-[10px] text-slate-400 italic">{it.DosageInstructions}</div>
                          )}
                        </td>
                        <td className="p-2.5 font-mono">{it.LotNumber}</td>
                        <td className="p-2.5">{new Date(it.ExpiryDate).toLocaleDateString()}</td>
                        <td className="p-2.5 text-right font-bold text-teal-600">{it.Quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 shrink-0 bg-slate-50/50 dark:bg-slate-800/20"
              style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}>
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[44px]"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Record</span>
              </button>
              <button
                onClick={() => { setSelectedSaleId(null); setVoucherData(null); }}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Authorized Reversal Modal ── */}
      {reversalTarget && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-md p-5 space-y-4 animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Handle (mobile) */}
            <div className="flex justify-center sm:hidden mb-1">
              <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
            </div>

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Reverse Dispensing
                </h3>
              </div>
              <button
                onClick={() => setReversalTarget(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300">
              You are reversing{' '}
              <strong>{reversalTarget.DispenseNumber}</strong> for{' '}
              <strong>{reversalTarget.PatientName}</strong> ({reversalTarget.TotalUnits} total units).
            </div>

            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-xs text-amber-800 dark:text-amber-200">
              Audit Safeguard: Historical record is preserved. Dispensed quantities will be restored back to pharmacy batch inventory with positive <strong>REVERSAL</strong> ledger entries.
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-500 uppercase">
                Reason for Cancellation / Reversal *
              </label>
              <textarea
                rows={3}
                placeholder="Document the exact clinical or operational reason..."
                value={reversalReason}
                onChange={(e) => setReversalReason(e.target.value)}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>

            <div
              className="flex items-center justify-end gap-3 pt-2"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              <button
                onClick={() => setReversalTarget(null)}
                disabled={reversing}
                className="px-4 py-2.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReversal}
                disabled={reversing || !reversalReason.trim()}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 min-h-[44px]"
              >
                {reversing && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{reversing ? 'Reversing...' : 'Confirm Reversal'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
