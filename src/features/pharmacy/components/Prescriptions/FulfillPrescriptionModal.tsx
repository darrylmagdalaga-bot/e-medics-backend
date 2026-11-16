import React, { useState, useEffect } from 'react';
import { 
  X, 
  Pill, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  User, 
  Stethoscope, 
  Calendar, 
  Layers, 
  FileText,
  Printer
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { PrescriptionFulfillmentDetails, PrescriptionFulfillmentItem } from '../../types';

interface FulfillPrescriptionModalProps {
  prescriptionId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onDispensedSuccess: () => void;
}

export function FulfillPrescriptionModal({
  prescriptionId,
  isOpen,
  onClose,
  onDispensedSuccess
}: FulfillPrescriptionModalProps) {
  const [details, setDetails] = useState<PrescriptionFulfillmentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Quantities to dispense mapped by PrescriptionItemID
  const [quantities, setQuantities] = useState<{ [itemId: number]: number }>({});
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dispenseResult, setDispenseResult] = useState<any | null>(null);

  const fetchFulfillmentDetails = async () => {
    if (!prescriptionId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await pharmacyApi.getPrescriptionFulfillmentDetails(prescriptionId);
      setDetails(data);

      // Initialize default quantities to Math.min(remainingQuantity, availableStock)
      const initialQty: { [itemId: number]: number } = {};
      (data.items || []).forEach(item => {
        const defaultQty = Math.max(0, Math.min(item.remainingQuantity, item.availableStock));
        initialQty[item.PrescriptionItemID] = defaultQty;
      });
      setQuantities(initialQty);
    } catch (err: any) {
      console.error('Failed to load fulfillment details:', err);
      setError(err.message || 'Failed to load fulfillment details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && prescriptionId) {
      setDispenseResult(null);
      setRemarks('');
      fetchFulfillmentDetails();
    } else {
      setDetails(null);
      setQuantities({});
      setDispenseResult(null);
    }
  }, [isOpen, prescriptionId]);

  if (!isOpen) return null;

  const handleQuantityChange = (itemId: number, value: number, maxAllowed: number) => {
    const sanitized = isNaN(value) ? 0 : Math.max(0, Math.min(value, maxAllowed));
    setQuantities(prev => ({
      ...prev,
      [itemId]: sanitized
    }));
  };

  const totalUnitsToDispense = Object.values(quantities).reduce((sum, q) => sum + (q || 0), 0);

  // Predict resulting status
  const willBeFullyDispensed = details?.items?.length
    ? details.items.every(item => {
        const qtyNow = quantities[item.PrescriptionItemID] || 0;
        return (item.remainingQuantity - qtyNow) <= 0;
      })
    : false;

  const handleDispense = async () => {
    if (!prescriptionId || !details) return;
    if (totalUnitsToDispense <= 0) {
      alert('Please enter at least one unit to dispense.');
      return;
    }

    // Build items payload
    const itemsToDispense = details.items
      .map(item => ({
        prescriptionItemId: item.PrescriptionItemID,
        quantity: quantities[item.PrescriptionItemID] || 0
      }))
      .filter(i => i.quantity > 0);

    if (itemsToDispense.length === 0) {
      alert('No items selected for dispensing.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const result = await pharmacyApi.dispensePrescription(prescriptionId, {
        items: itemsToDispense,
        remarks: remarks.trim() || undefined
      });

      setDispenseResult(result);
      onDispensedSuccess();
    } catch (err: any) {
      console.error('Failed to dispense prescription:', err);
      setError(err.message || 'Failed to dispense prescription');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-t-3xl sm:rounded-2xl w-full max-w-4xl max-h-[92dvh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
        {/* Mobile Handle */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>
        {/* Header */}
        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-teal-50/60 dark:bg-teal-950/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Pill className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Prescription Fulfillment & Dispensing
                </h3>
                {details?.prescription?.PrescriptionNumber && (
                  <span className="font-mono text-xs font-bold px-2.5 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300">
                    {details.prescription.PrescriptionNumber}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                FEFO-compliant pharmacy stock allocation and physical inventory deduction.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {loading ? (
            <div className="py-16 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
              <p className="text-sm font-medium text-slate-500">Checking pharmacy stock and FEFO batches...</p>
            </div>
          ) : error && !dispenseResult ? (
            <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
              <div className="text-sm">{error}</div>
            </div>
          ) : dispenseResult ? (
            /* Dispensing Complete Success Dialog */
            <div className="text-center py-8 space-y-4 voucher-printable">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center mx-auto shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                Catbalogan City Health Office · Official Pharmacy Dispensing Voucher
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Prescription Dispensed Successfully!
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                Stock has been deducted from eligible FEFO batches, transaction ledger recorded, and prescription status updated to{' '}
                <strong className="text-teal-700 dark:text-teal-300 font-semibold">{dispenseResult.prescriptionStatus}</strong>.
              </p>

              <div className="max-w-md mx-auto p-4 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-left text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Dispense Voucher #:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{dispenseResult.dispenseNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Prescription Status:</span>
                  <span className="font-semibold px-2 py-0.5 rounded text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {dispenseResult.prescriptionStatus}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Line Items Fulfilled:</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{dispenseResult.items?.length || 0} items</span>
                </div>
              </div>

              <div className="flex justify-center gap-3 pt-3">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Printer className="w-4 h-4" /> Print Voucher
                </button>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  Done & Close
                </button>
              </div>
            </div>
          ) : details && (
            <>
              {/* Patient & Consultation Summary Card */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">
                    Patient Information
                  </span>
                  <div className="font-bold text-slate-900 dark:text-white text-sm">
                    {details.prescription.PatientName}
                  </div>
                  <div className="text-slate-500 mt-0.5">
                    {details.prescription.Age ? `${details.prescription.Age} yrs • ` : ''}
                    {details.prescription.Gender || ''} {details.prescription.Barangay ? `• Brgy. ${details.prescription.Barangay}` : ''}
                  </div>
                  {details.prescription.ContactNumber && (
                    <div className="text-slate-500 text-[11px]">Tel: {details.prescription.ContactNumber}</div>
                  )}
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">
                    Clinical Encounter & Prescriber
                  </span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {details.prescription.PrescribingProviderName || 'Attending Physician'}
                  </div>
                  <div className="text-slate-500 font-mono text-[11px] mt-0.5">
                    Consultation #{details.prescription.EncounterNumber || details.prescription.EncounterID}
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Prescribed: {new Date(details.prescription.PrescriptionDate).toLocaleDateString()}
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block mb-1">
                    Clinical Diagnosis & Status
                  </span>
                  <div className="font-semibold text-slate-800 dark:text-slate-200">
                    {details.prescription.ClinicalDiagnosis || 'Clinical Consultation'}
                  </div>
                  <div className="mt-1">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      details.prescription.Status === 'Fully Dispensed'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : details.prescription.Status === 'Partially Dispensed'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}>
                      Current: {details.prescription.Status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Prescribed Items Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center gap-2">
                    <Layers className="w-4 h-4 text-teal-600" />
                    Medication Items & FEFO Stock Allocation
                  </h4>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    FEFO allocates earliest-expiring batches first
                  </span>
                </div>

                <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-800 text-[10px] uppercase">
                      <tr>
                        <th className="p-3">Medicine & Instructions</th>
                        <th className="p-3 text-center">Prescribed</th>
                        <th className="p-3 text-center">Dispensed</th>
                        <th className="p-3 text-center">Remaining</th>
                        <th className="p-3 text-center">Available Stock</th>
                        <th className="p-3 text-center w-36">Dispense Now</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-800 dark:text-slate-200">
                      {details.items.map((item) => {
                        const maxDispense = Math.max(0, Math.min(item.remainingQuantity, item.availableStock));
                        const currentQty = quantities[item.PrescriptionItemID] || 0;
                        const isStockOut = item.availableStock === 0;
                        const isPartialStock = item.availableStock > 0 && item.availableStock < item.remainingQuantity;

                        return (
                          <React.Fragment key={item.PrescriptionItemID}>
                            <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                              <td className="p-3">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {item.MedicineName}
                                </div>
                                {item.GenericName && (
                                  <div className="text-[10px] text-slate-400 italic">
                                    {item.GenericName}
                                  </div>
                                )}
                                <div className="text-[11px] text-teal-700 dark:text-teal-400 mt-1">
                                  {item.DosageInstructions || `${item.Dosage || ''} ${item.Frequency || ''}`}
                                </div>
                              </td>

                              <td className="p-3 text-center font-bold text-slate-700 dark:text-slate-300">
                                {item.QuantityPrescribed}
                              </td>

                              <td className="p-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                {item.QuantityDispensed}
                              </td>

                              <td className="p-3 text-center font-bold text-amber-600 dark:text-amber-400">
                                {item.remainingQuantity}
                              </td>

                              <td className="p-3 text-center">
                                <div className={`font-bold ${
                                  isStockOut ? 'text-rose-600' : isPartialStock ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {item.availableStock} units
                                </div>
                                <div className="text-[10px] mt-0.5">
                                  {isStockOut ? (
                                    <span className="px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-semibold">
                                      Out of Stock / Expired
                                    </span>
                                  ) : isPartialStock ? (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-semibold">
                                      Partial Stock
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">
                                      In Stock
                                    </span>
                                  )}
                                </div>
                              </td>

                              <td className="p-3 text-center">
                                {item.remainingQuantity === 0 ? (
                                  <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    Fulfilled
                                  </span>
                                ) : isStockOut ? (
                                  <span className="text-[11px] font-semibold text-rose-500">
                                    Cannot Dispense
                                  </span>
                                ) : (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      max={maxDispense}
                                      value={currentQty}
                                      onChange={(e) => handleQuantityChange(
                                        item.PrescriptionItemID,
                                        parseInt(e.target.value) || 0,
                                        maxDispense
                                      )}
                                      className="w-16 p-1.5 text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleQuantityChange(item.PrescriptionItemID, maxDispense, maxDispense)}
                                      className="px-1.5 py-1 text-[10px] font-bold rounded bg-teal-100 hover:bg-teal-200 text-teal-800 dark:bg-teal-900/60 dark:text-teal-300 cursor-pointer"
                                      title="Dispense Max Available"
                                    >
                                      Max
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>

                            {/* FEFO Batches Breakdown preview */}
                            {item.batches && item.batches.length > 0 && currentQty > 0 && (
                              <tr className="bg-teal-50/30 dark:bg-teal-950/20 text-[11px]">
                                <td colSpan={6} className="px-4 py-2 border-t border-slate-100 dark:border-slate-800/60 text-slate-500 dark:text-slate-400">
                                  <span className="font-semibold text-teal-800 dark:text-teal-300">FEFO Allocation Order: </span>
                                  {item.batches.map((b, idx) => (
                                    <span key={b.StockID} className="inline-block mr-3">
                                      Lot <strong>{b.LotNumber}</strong> (Exp: {new Date(b.ExpiryDate).toLocaleDateString()}, Avail: {b.Quantity})
                                      {idx < item.batches.length - 1 ? ' → ' : ''}
                                    </span>
                                  ))}
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Dispensing Remarks & Outcome Preview */}
              <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-1">
                    Pharmacist Dispensing Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dispensed with patient counseling; advised to complete 7-day course"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700 text-xs">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span className="text-slate-600 dark:text-slate-300">
                      Total Units to Dispense Now: <strong className="text-teal-700 dark:text-teal-400 text-sm">{totalUnitsToDispense} units</strong>
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-slate-500">Resulting Prescription Status: </span>
                    <strong className={`font-semibold ${willBeFullyDispensed ? 'text-emerald-600' : 'text-blue-600'}`}>
                      {totalUnitsToDispense === 0 ? details.prescription.Status : willBeFullyDispensed ? 'Fully Dispensed' : 'Partially Dispensed'}
                    </strong>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer Actions */}
        {!dispenseResult && details && (
          <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={submitting || totalUnitsToDispense <= 0}
              onClick={handleDispense}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs transition-colors"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Deducting Stock & Dispensing...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Confirm Dispense ({totalUnitsToDispense} units)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
