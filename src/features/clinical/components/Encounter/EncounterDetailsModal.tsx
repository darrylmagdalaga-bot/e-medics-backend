import React, { useState, useEffect } from 'react';
import { 
  X,
  Pill,
  XCircle, 
  Stethoscope, 
  Calendar, 
  User, 
  MapPin, 
  Activity, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Edit3, 
  ShieldCheck, 
  Clock, 
  RefreshCw,
  Scale,
  Thermometer,
  Heart,
  Wind,
  BadgeAlert,
  History
} from 'lucide-react';
import { clinicalApi } from '../../api';
import { ClinicalEncounter } from '../../types';

interface EncounterDetailsModalProps {
  encounterId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onEncounterFinalized?: () => void;
  onOpenAmendModal?: (encounter: ClinicalEncounter) => void;
}

export function EncounterDetailsModal({
  encounterId,
  isOpen,
  onClose,
  onEncounterFinalized,
  onOpenAmendModal
}: EncounterDetailsModalProps) {
  const [encounter, setEncounter] = useState<ClinicalEncounter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizeSuccess, setFinalizeSuccess] = useState(false);

  const [cancellingPrescriptionId, setCancellingPrescriptionId] = useState<number | null>(null);

  const handleCancelPrescription = async (prescriptionId: number) => {
    const reason = window.prompt('Please enter the clinical reason for cancelling this prescription:');
    if (!reason || !reason.trim()) return;

    try {
      setCancellingPrescriptionId(prescriptionId);
      await clinicalApi.cancelPrescription(prescriptionId, reason.trim());
      await fetchEncounter();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel prescription.');
    } finally {
      setCancellingPrescriptionId(null);
    }
  };


  const fetchEncounter = async () => {
    if (!encounterId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await clinicalApi.getEncounterById(encounterId);
      setEncounter(data);
    } catch (err: any) {
      console.error('Failed to load encounter details:', err);
      setError(err.message || 'Failed to load encounter details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && encounterId) {
      fetchEncounter();
    } else {
      setEncounter(null);
      setFinalizeSuccess(false);
    }
  }, [isOpen, encounterId]);

  if (!isOpen) return null;

  const handleFinalize = async () => {
    if (!encounterId) return;
    const confirm = window.confirm(
      'Are you sure you want to finalize this clinical consultation? Once finalized, direct modifications are prohibited and all subsequent revisions require a formal clinical amendment reason.'
    );
    if (!confirm) return;

    try {
      setIsFinalizing(true);
      await clinicalApi.finalizeEncounter(encounterId);
      setFinalizeSuccess(true);
      await fetchEncounter();
      onEncounterFinalized?.();
    } catch (err: any) {
      console.error('Failed to finalize encounter:', err);
      alert(err.message || 'Failed to finalize encounter.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const vitals = encounter?.vitalSigns;
  const isFinalized = encounter?.Status === 'Finalized';
  const isAmended = encounter?.Status === 'Amended';
  const isInProgress = encounter?.Status === 'In Progress';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-700/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400 flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                  {encounter?.EncounterNumber || 'Loading...'}
                </span>
                {encounter && (
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    isFinalized
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : isAmended
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300'
                  }`}>
                    {encounter.Status}
                  </span>
                )}
                <span className="text-xs text-slate-400 font-medium">
                  {encounter?.EncounterType || 'Consultation'}
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Clinical Consultation Record
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Print Consultation Document"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading && !encounter ? (
            <div className="flex flex-col items-center justify-center p-16 space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin" />
              <p className="text-sm text-slate-500">Loading consultation record...</p>
            </div>
          ) : error || !encounter ? (
            <div className="p-8 text-center text-red-600 bg-red-50 dark:bg-red-950/40 rounded-xl">
              <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-500" />
              <p className="text-sm font-semibold">{error || 'Consultation record not found'}</p>
            </div>
          ) : (
            <>
              {/* Patient Banner */}
              <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-700/10 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300 flex items-center justify-center font-bold text-lg">
                    {encounter.PatientName?.[0] || 'P'}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {encounter.PatientName}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-3">
                      <span>{encounter.PatientGender || 'Unspecified'}</span>
                      <span>?</span>
                      <span>{encounter.PatientAge !== undefined ? `${encounter.PatientAge} yrs` : 'Age N/A'}</span>
                      <span>?</span>
                      <span>Barangay {encounter.PatientBarangay || 'Catbalogan'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-300 border-t md:border-t-0 pt-3 md:pt-0 border-slate-200 dark:border-slate-700">
                  {encounter.PatientPhilHealth && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">PhilHealth</span>
                      <span className="font-mono font-semibold">{encounter.PatientPhilHealth}</span>
                    </div>
                  )}
                  {encounter.PatientBloodType && (
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Blood Type</span>
                      <span className="font-semibold text-rose-600 dark:text-rose-400">{encounter.PatientBloodType}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Encounter Date</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {new Date(encounter.EncounterDate).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Provider Info */}
              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 px-1">
                <div>
                  Attending Healthcare Provider: <strong className="text-slate-900 dark:text-white font-semibold">{encounter.AttendingProviderName}</strong>
                </div>
                <div>
                  Status: <strong className="text-slate-900 dark:text-white">{encounter.Status}</strong>
                </div>
              </div>

              {/* Vital Signs Block */}
              {vitals && (
                <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Activity className="w-4 h-4 text-cyan-600" />
                      Recorded Vital Signs
                    </h4>
                    {vitals.RecordedDate && (
                      <span className="text-[11px] text-slate-400">
                        Taken {new Date(vitals.RecordedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Blood Pressure</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {vitals.BloodPressureSystolic ? `${vitals.BloodPressureSystolic}/${vitals.BloodPressureDiastolic} mmHg` : '—'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Temperature</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {vitals.Temperature ? `${vitals.Temperature} °C` : '?'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Pulse Rate</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {vitals.PulseRate ? `${vitals.PulseRate} bpm` : '?'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Respiratory Rate</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {vitals.RespiratoryRate ? `${vitals.RespiratoryRate} cpm` : '?'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Oxygen Sat (SpO₂)</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white">
                        {vitals.OxygenSaturation ? `${vitals.OxygenSaturation}%` : '?'}
                      </span>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-2.5 border border-slate-100 dark:border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">BMI & Category</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {vitals.BMI || '?'}
                        </span>
                        {vitals.BMIClassification && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200">
                            {vitals.BMIClassification}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Clinical Assessment Grid */}
              <div className="space-y-4 text-sm">
                {/* Chief Complaint & HPI */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Chief Complaint
                    </span>
                    <p className="text-slate-800 dark:text-slate-200 font-medium">
                      {encounter.ChiefComplaint}
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      History of Present Illness (HPI)
                    </span>
                    <p className="text-slate-800 dark:text-slate-200">
                      {encounter.HistoryOfPresentIllness || 'None recorded'}
                    </p>
                  </div>
                </div>

                {/* Diagnosis & ICD-10 */}
                <div className="bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-900/60 p-4 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-cyan-900 dark:text-cyan-300 uppercase tracking-wider">
                      Clinical Diagnosis & Assessment
                    </span>
                    {encounter.ICD10Code && (
                      <span className="px-2.5 py-0.5 rounded-md font-mono text-xs font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-200">
                        ICD-10: {encounter.ICD10Code}
                      </span>
                    )}
                  </div>
                  <h4 className="text-base font-bold text-slate-900 dark:text-white mb-2">
                    {encounter.Diagnosis}
                  </h4>
                  <p className="text-xs text-slate-700 dark:text-slate-300">
                    {encounter.Assessment}
                  </p>
                </div>

                {/* Treatment Plan */}
                <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Treatment Plan & Prescriptions
                  </span>
                  <p className="text-slate-800 dark:text-slate-200 whitespace-pre-line text-xs">
                    {encounter.TreatmentPlan || 'No prescription or treatment plan documented.'}
                  </p>
                </div>

                {encounter.ClinicalNotes && (
                  <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Clinical Notes & Recommendations
                    </span>
                    <p className="text-slate-700 dark:text-slate-300 text-xs">
                      {encounter.ClinicalNotes}
                    </p>
                  </div>
                )}
              </div>


              {/* Linked Electronic Prescriptions (Phase 9) */}
              <div className="border border-cyan-200 dark:border-cyan-800 rounded-xl p-5 bg-cyan-50/20 dark:bg-cyan-950/20 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                    <Pill className="w-4 h-4 text-cyan-600" />
                    Electronic Prescriptions & Fulfillment Status ({encounter.prescriptions?.length || 0})
                  </h4>
                  {encounter.prescriptions && encounter.prescriptions.length > 0 && (
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Integrated with City Health Office Pharmacy
                    </span>
                  )}
                </div>

                {(!encounter.prescriptions || encounter.prescriptions.length === 0) ? (
                  <div className="bg-white dark:bg-slate-900/60 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-center text-xs text-slate-500">
                    No electronic prescriptions were recorded for this consultation.
                  </div>
                ) : (
                  <div className="space-y-4">
                    {encounter.prescriptions.map((rx) => {
                      const isPending = rx.Status === 'Pending';
                      const isPartial = rx.Status === 'Partially Dispensed';
                      const isFull = rx.Status === 'Fully Dispensed';
                      const isCancelled = rx.Status === 'Cancelled';

                      const statusColor = isFull
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300'
                        : isPartial
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300'
                        : isCancelled
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300';

                      return (
                        <div
                          key={rx.PrescriptionID}
                          className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs"
                        >
                          <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-cyan-700 dark:text-cyan-400">
                                {rx.PrescriptionNumber}
                              </span>
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {new Date(rx.PrescriptionDate).toLocaleDateString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric'
                                })}
                              </span>
                              <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                                {rx.Status}
                              </span>
                            </div>

                            <div className="flex items-center gap-3">
                              {isPending && (
                                <button
                                  type="button"
                                  disabled={cancellingPrescriptionId === rx.PrescriptionID}
                                  onClick={() => handleCancelPrescription(rx.PrescriptionID)}
                                  className="text-xs text-rose-600 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300 font-semibold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                >
                                  <XCircle className="w-3.5 h-3.5" />
                                  <span>Cancel Prescription</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Line items table */}
                          <div className="p-3">
                            <table className="w-full text-left text-xs">
                              <thead className="text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                  <th className="pb-2">Medicine / Generic</th>
                                  <th className="pb-2 text-center">Prescribed</th>
                                  <th className="pb-2 text-center">Dispensed</th>
                                  <th className="pb-2 text-center">Remaining</th>
                                  <th className="pb-2">Instructions</th>
                                  <th className="pb-2 text-center">Item Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
                                {rx.items && rx.items.map((item) => {
                                  const rem = item.remainingQuantity !== undefined 
                                    ? item.remainingQuantity 
                                    : Math.max(0, item.QuantityPrescribed - item.QuantityDispensed);

                                  return (
                                    <tr key={item.PrescriptionItemID}>
                                      <td className="py-2">
                                        <div className="font-bold text-slate-900 dark:text-white">
                                          {item.MedicineName}
                                        </div>
                                        {item.GenericName && (
                                          <div className="text-[10px] text-slate-400 italic">
                                            {item.GenericName}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-2 text-center font-bold text-slate-800 dark:text-slate-200">
                                        {item.QuantityPrescribed}
                                      </td>
                                      <td className="py-2 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                        {item.QuantityDispensed}
                                      </td>
                                      <td className="py-2 text-center font-bold text-amber-600 dark:text-amber-400">
                                        {rem}
                                      </td>
                                      <td className="py-2 text-[11px]">
                                        <div>{item.DosageInstructions || '-'}</div>
                                        {(item.Frequency || item.Duration) && (
                                          <div className="text-[10px] text-slate-400">
                                            {item.Frequency} {item.Duration ? `• ${item.Duration}` : ''}
                                          </div>
                                        )}
                                      </td>
                                      <td className="py-2 text-center">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                                          item.ItemStatus === 'Fully Dispensed'
                                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                            : item.ItemStatus === 'Partially Dispensed'
                                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                            : item.ItemStatus === 'Cancelled'
                                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                        }`}>
                                          {item.ItemStatus}
                                        </span>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Amendment History Audit Trail (if any) */}
              {encounter.amendments && encounter.amendments.length > 0 && (
                <div className="border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 bg-amber-50/40 dark:bg-amber-950/20 space-y-3">
                  <h4 className="text-xs font-bold text-amber-900 dark:text-amber-200 uppercase tracking-wider flex items-center gap-2">
                    <History className="w-4 h-4 text-amber-600" />
                    Clinical Record Amendment Audit Trail ({encounter.amendments.length})
                  </h4>
                  <div className="space-y-3">
                    {encounter.amendments.map((amendment) => (
                      <div
                        key={amendment.AmendmentID}
                        className="bg-white dark:bg-slate-900 p-3.5 rounded-lg border border-amber-200 dark:border-amber-800 text-xs space-y-2"
                      >
                        <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                          <span>
                            Amended by: <strong className="text-slate-800 dark:text-slate-200">{amendment.AmendedByName || 'Attending Physician'}</strong>
                          </span>
                          <span>{new Date(amendment.AmendedDate).toLocaleString()}</span>
                        </div>
                        <div>
                          <strong className="text-amber-900 dark:text-amber-200">Clinical Reason: </strong>
                          <span className="text-slate-800 dark:text-slate-300 italic">{amendment.AmendmentReason}</span>
                        </div>
                        {amendment.PreviousDiagnosis && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            <strong>Previous Diagnosis: </strong>{amendment.PreviousDiagnosis}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/40">
          <div>
            {isFinalized && (
              <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" /> Finalized & Verified Medical Record
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>

            {isInProgress && (
              <button
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                {isFinalizing ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" /> Finalizing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" /> Finalize Consultation
                  </>
                )}
              </button>
            )}

            {(isFinalized || isAmended) && onOpenAmendModal && encounter && (
              <button
                onClick={() => {
                  onClose();
                  onOpenAmendModal(encounter);
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer"
              >
                <Edit3 className="w-4 h-4" /> Amend Clinical Record
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
