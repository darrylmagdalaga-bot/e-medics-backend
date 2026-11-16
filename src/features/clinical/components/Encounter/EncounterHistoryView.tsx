import React, { useState, useEffect, useMemo } from 'react';
import { 
  Stethoscope, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  User, 
  RefreshCw, 
  ChevronRight, 
  FileText, 
  ShieldCheck, 
  AlertCircle,
  Clock,
  ArrowUpDown
} from 'lucide-react';
import { clinicalApi } from '../../api';
import { ClinicalEncounter } from '../../types';

interface EncounterHistoryViewProps {
  onSelectEncounter: (encounterId: number) => void;
  onStartConsultation: () => void;
  onSelectPatient: (patientId: number) => void;
}

export function EncounterHistoryView({
  onSelectEncounter,
  onStartConsultation,
  onSelectPatient
}: EncounterHistoryViewProps) {
  const [encounters, setEncounters] = useState<ClinicalEncounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [error, setError] = useState<string | null>(null);

  const fetchEncounters = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await clinicalApi.getEncounters({
        search: search.trim() || undefined,
        status: statusFilter !== 'ALL' ? statusFilter : undefined,
        encounterType: typeFilter !== 'ALL' ? typeFilter : undefined
      });
      setEncounters(data);
    } catch (err: any) {
      console.error('Failed to load consultation records:', err);
      setError(err.message || 'Failed to load consultation history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEncounters();
  }, [statusFilter, typeFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEncounters();
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Stethoscope className="w-5 h-5 text-cyan-600" />
            Clinical Consultations Master History
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Search and review all historical and active consultations, diagnostic evaluations, and vital signs across the City Health Office.
          </p>
        </div>

        <button
          onClick={onStartConsultation}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer w-fit"
        >
          <Plus className="w-4 h-4" /> Start New Consultation
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by patient name, encounter #, doctor, or diagnosis..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </form>

          {/* Status Filter */}
          <div className="sm:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="Finalized">Finalized</option>
              <option value="In Progress">In Progress (Draft)</option>
              <option value="Amended">Amended</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="sm:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            >
              <option value="ALL">All Types</option>
              <option value="Consultation">Consultation</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Emergency">Emergency</option>
              <option value="Routine Checkup">Routine Checkup</option>
            </select>
          </div>

          {/* Refresh Button */}
          <div className="sm:col-span-1 flex items-center justify-end">
            <button
              onClick={fetchEncounters}
              className="p-2 rounded-xl text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Encounters List / Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        {loading && encounters.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 space-y-3">
            <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading consultation records...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600 bg-red-50 dark:bg-red-950/40">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-red-500" />
            <p className="text-sm font-semibold">{error}</p>
          </div>
        ) : encounters.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-14 h-14 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-3 text-slate-400">
              <Stethoscope className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
              No Consultations Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-5">
              No medical consultations match your current filters. Try resetting the filters or start a new patient consultation.
            </p>
            <button
              onClick={onStartConsultation}
              className="px-4 py-2 rounded-xl bg-cyan-700 text-white font-semibold text-xs hover:bg-cyan-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Start New Consultation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Encounter #</th>
                  <th className="py-3.5 px-4 font-semibold">Date</th>
                  <th className="py-3.5 px-4 font-semibold">Patient Name</th>
                  <th className="py-3.5 px-4 font-semibold">Attending Provider</th>
                  <th className="py-3.5 px-4 font-semibold">Chief Complaint</th>
                  <th className="py-3.5 px-4 font-semibold">Diagnosis & ICD-10</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {encounters.map((enc) => {
                  const isFinalized = enc.Status === 'Finalized';
                  const isAmended = enc.Status === 'Amended';
                  return (
                    <tr
                      key={enc.EncounterID}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors group"
                    >
                      {/* Encounter # */}
                      <td className="py-3.5 px-4 font-mono font-bold text-cyan-800 dark:text-cyan-400">
                        {enc.EncounterNumber}
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {new Date(enc.EncounterDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>

                      {/* Patient Name */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => onSelectPatient(enc.PatientID)}
                          className="font-bold text-slate-900 dark:text-white hover:text-cyan-700 dark:hover:text-cyan-400 text-left block cursor-pointer"
                        >
                          {enc.PatientName}
                        </button>
                        <span className="text-[11px] text-slate-400 block">
                          Brgy. {enc.PatientBarangay || 'Catbalogan'}
                        </span>
                      </td>

                      {/* Attending Provider */}
                      <td className="py-3.5 px-4 font-medium text-slate-700 dark:text-slate-300">
                        {enc.AttendingProviderName}
                      </td>

                      {/* Chief Complaint */}
                      <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                        {enc.ChiefComplaint}
                      </td>

                      {/* Diagnosis */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 dark:text-white block">
                          {enc.Diagnosis}
                        </span>
                        {enc.ICD10Code && (
                          <span className="font-mono text-[10px] text-cyan-700 dark:text-cyan-400">
                            {enc.ICD10Code}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          isFinalized
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : isAmended
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300'
                        }`}>
                          {enc.Status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onSelectEncounter(enc.EncounterID)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-cyan-700 hover:text-white dark:hover:bg-cyan-600 text-slate-700 dark:text-slate-200 font-semibold transition-all cursor-pointer text-xs"
                        >
                          View Details <ChevronRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
