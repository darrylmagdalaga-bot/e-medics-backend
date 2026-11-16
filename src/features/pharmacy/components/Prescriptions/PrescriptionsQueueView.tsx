import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  Search,
  CheckCircle2,
  Clock,
  Pill,
  RefreshCw,
  Layers,
  Eye,
  X,
  User,
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { PrescriptionQueueItem } from '../../types';
import { FulfillPrescriptionModal } from './FulfillPrescriptionModal';

interface PrescriptionsQueueViewProps {
  onNavigateTab?: (tab: string) => void;
}

export function PrescriptionsQueueView({ onNavigateTab }: PrescriptionsQueueViewProps) {
  const [prescriptions, setPrescriptions] = useState<PrescriptionQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'All' | 'Pending' | 'Partially Dispensed' | 'Fully Dispensed' | 'Cancelled'
  >('Pending');
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchPrescriptions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await pharmacyApi.getPrescriptionsQueue({
        status: statusFilter === 'All' ? undefined : statusFilter,
        search: search.trim() || undefined,
      });
      setPrescriptions(data);
    } catch (err: any) {
      console.error('Failed to load prescriptions queue:', err);
      setError(err.message || 'Failed to load prescriptions queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrescriptions();
  }, [statusFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchPrescriptions();
    }, 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const pendingCount = prescriptions.filter((p) => p.Status === 'Pending').length;
  const partialCount = prescriptions.filter((p) => p.Status === 'Partially Dispensed').length;
  const fullCount = prescriptions.filter((p) => p.Status === 'Fully Dispensed').length;

  const handleOpenFulfillment = (prescriptionId: number) => {
    setSelectedPrescriptionId(prescriptionId);
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* Top KPI Cards (2-col on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Pending
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {pendingCount}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Awaiting dispensing</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Partial
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {partialCount}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Remaining units</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Fulfilled
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {fullCount}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">100% dispensed</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">
              Total in View
            </span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 flex items-center justify-center shrink-0">
              <ClipboardList className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
            {prescriptions.length}
          </div>
          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-0.5">Filter: {statusFilter}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Patient, Rx #, Diagnosis..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
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

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {(['Pending', 'Partially Dispensed', 'Fully Dispensed', 'Cancelled', 'All'] as const).map(
            (status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 ${
                  statusFilter === status
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
                }`}
              >
                {status}
              </button>
            )
          )}
        </div>
      </div>

      {/* Prescriptions Queue Content */}
      {loading ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-16 text-center space-y-3 shadow-xs">
          <RefreshCw className="w-8 h-8 text-teal-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-500">Loading prescription fulfillment queue...</p>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center text-rose-600 text-sm shadow-xs">
          {error}
        </div>
      ) : prescriptions.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-16 text-center space-y-3 shadow-xs px-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mx-auto">
            <ClipboardList className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-slate-900 dark:text-white">No Prescriptions Found</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are currently no prescriptions matching the selected filter ({statusFilter}).
          </p>
        </div>
      ) : (
        <>
          {/* Mobile Cards (< md) */}
          <div className="md:hidden space-y-3">
            {prescriptions.map((rx) => {
              const isPending = rx.Status === 'Pending';
              const isPartial = rx.Status === 'Partially Dispensed';
              const isFull = rx.Status === 'Fully Dispensed';
              const isCancelled = rx.Status === 'Cancelled';

              const statusBadge = isFull
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                : isPartial
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300'
                : isCancelled
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300'
                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300';

              return (
                <div
                  key={rx.PrescriptionID}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-sm text-teal-700 dark:text-teal-400">
                      {rx.PrescriptionNumber}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${statusBadge}`}>
                      {rx.Status}
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        {rx.PatientName}
                      </div>
                      <div className="text-xs text-slate-500">
                        {rx.Age ? `${rx.Age} yrs · ` : ''}
                        {rx.Gender || ''} {rx.Barangay ? `· Brgy. ${rx.Barangay}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl p-2.5">
                    <div>
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Prescriber</div>
                      <div className="font-medium text-slate-800 dark:text-slate-200 truncate">
                        Dr. {rx.PrescribingProviderName || 'Physician'}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {rx.ClinicalDiagnosis || 'Consultation'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-slate-400 uppercase">Fulfillment</div>
                      <div className="font-bold text-slate-900 dark:text-white">
                        {rx.TotalDispensedUnits} / {rx.TotalPrescribedUnits} units
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {rx.TotalItems} item{rx.TotalItems === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-400">
                      {new Date(rx.PrescriptionDate).toLocaleDateString()}
                    </span>
                    {isPending || isPartial ? (
                      <button
                        type="button"
                        onClick={() => handleOpenFulfillment(rx.PrescriptionID)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors min-h-[44px]"
                      >
                        <Pill className="w-3.5 h-3.5" />
                        <span>Dispense Now</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenFulfillment(rx.PrescriptionID)}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer min-h-[44px]"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>View Details</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop/Tablet Table (>= md) */}
          <div className="hidden md:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/60 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="p-3.5">Rx Number &amp; Date</th>
                    <th className="p-3.5">Patient Details</th>
                    <th className="p-3.5">Clinical Consultation</th>
                    <th className="p-3.5 text-center">Items &amp; Units</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                  {prescriptions.map((rx) => {
                    const isPending = rx.Status === 'Pending';
                    const isPartial = rx.Status === 'Partially Dispensed';
                    const isFull = rx.Status === 'Fully Dispensed';
                    const isCancelled = rx.Status === 'Cancelled';

                    const statusBadge = isFull
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                      : isPartial
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300'
                      : isCancelled
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300';

                    return (
                      <tr
                        key={rx.PrescriptionID}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="p-3.5">
                          <div className="font-mono font-bold text-teal-700 dark:text-teal-400">
                            {rx.PrescriptionNumber}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {new Date(rx.PrescriptionDate).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="font-bold text-slate-900 dark:text-white text-sm">
                            {rx.PatientName}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {rx.Age ? `${rx.Age} yrs • ` : ''}
                            {rx.Gender || ''} {rx.Barangay ? `• Brgy. ${rx.Barangay}` : ''}
                          </div>
                          {rx.ContactNumber && (
                            <div className="text-[10px] text-slate-400">Tel: {rx.ContactNumber}</div>
                          )}
                        </td>

                        <td className="p-3.5">
                          <div className="font-semibold text-slate-800 dark:text-slate-200">
                            {rx.ClinicalDiagnosis || 'Consultation Order'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            Dr. {rx.PrescribingProviderName || 'Physician'}
                          </div>
                          {rx.EncounterNumber && (
                            <div className="text-[10px] text-slate-400 font-mono">
                              Enc #{rx.EncounterNumber}
                            </div>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          <div className="font-bold text-slate-900 dark:text-white">
                            {rx.TotalItems} {rx.TotalItems === 1 ? 'Medication' : 'Medications'}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {rx.TotalDispensedUnits} / {rx.TotalPrescribedUnits} units dispensed
                          </div>
                        </td>

                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge}`}
                          >
                            {rx.Status}
                          </span>
                        </td>

                        <td className="p-3.5 text-center">
                          {isPending || isPartial ? (
                            <button
                              type="button"
                              onClick={() => handleOpenFulfillment(rx.PrescriptionID)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs shadow-xs cursor-pointer transition-colors"
                            >
                              <Pill className="w-3.5 h-3.5" />
                              <span>Dispense</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenFulfillment(rx.PrescriptionID)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-semibold cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Details</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Fulfillment Modal */}
      <FulfillPrescriptionModal
        prescriptionId={selectedPrescriptionId}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPrescriptionId(null);
        }}
        onDispensedSuccess={() => {
          fetchPrescriptions();
        }}
      />
    </div>
  );
}
