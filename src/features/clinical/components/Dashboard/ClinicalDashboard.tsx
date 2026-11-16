import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Stethoscope, 
  CheckCircle2, 
  Clock, 
  Activity, 
  ArrowUpRight, 
  PlusCircle, 
  RefreshCw,
  TrendingUp,
  FileText,
  AlertCircle
} from 'lucide-react';
import { clinicalApi } from '../../api';
import { ClinicalDashboardStats } from '../../types';

interface ClinicalDashboardProps {
  onNavigateTab: (tab: string, patientId?: number) => void;
  onSelectEncounter: (encounterId: number) => void;
}

export function ClinicalDashboard({ onNavigateTab, onSelectEncounter }: ClinicalDashboardProps) {
  const [stats, setStats] = useState<ClinicalDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const data = await clinicalApi.getDashboardStats();
      setStats(data);
    } catch (err) {
      console.error('Failed to load clinical stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="w-8 h-8 text-cyan-600 animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Loading clinical intelligence dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Registered Patients */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Registered Patients</span>
            <div className="w-8 h-8 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.totalPatients.toLocaleString() || 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Active City Health Office registry
            </p>
          </div>
        </div>

        {/* Encounters Today */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Consultations Today</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.encountersToday || 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {stats?.finalizedToday || 0} finalized today
            </p>
          </div>
        </div>

        {/* Open Consultations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">In Progress</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.inProgressEncounters || 0}
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Active patient encounters
            </p>
          </div>
        </div>

        {/* Lifetime Consultations */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Lifetime Encounters</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900 dark:text-white">
              {stats?.totalLifetimeEncounters.toLocaleString() || 0}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Documented clinical records
            </p>
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          onClick={() => onNavigateTab('new-encounter')}
          className="p-4 bg-cyan-700 hover:bg-cyan-800 text-white rounded-2xl flex items-center justify-between shadow-xs transition-colors cursor-pointer group text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-bold">
              <PlusCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-sm">New Consultation</div>
              <div className="text-xs text-white/80">Document diagnosis & vital signs</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-white/70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>

        <button
          onClick={() => onNavigateTab('registry')}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl flex items-center justify-between shadow-xs transition-colors cursor-pointer group text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-400 flex items-center justify-center font-bold">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-slate-900 dark:text-white">Patient Registry</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">Search demographics & register</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>

        <button
          onClick={() => onNavigateTab('encounters')}
          className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-2xl flex items-center justify-between shadow-xs transition-colors cursor-pointer group text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="font-semibold text-sm text-slate-900 dark:text-white">Encounter Records</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">View notes & amendments</div>
            </div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-slate-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </button>
      </div>

      {/* Grid: Recent Encounters (Left) & Top Diagnoses (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recent Encounters (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Recent Clinical Consultations</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Latest patient examinations and diagnoses</p>
            </div>
            <button
              onClick={() => onNavigateTab('encounters')}
              className="text-xs font-semibold text-cyan-700 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats?.recentEncounters && stats.recentEncounters.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400 font-semibold border-y border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Encounter #</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Patient</th>
                    <th className="py-2.5 px-3">Chief Complaint</th>
                    <th className="py-2.5 px-3">Diagnosis</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {stats.recentEncounters.map((enc) => (
                    <tr
                      key={enc.EncounterID}
                      onClick={() => onSelectEncounter(enc.EncounterID)}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors cursor-pointer"
                    >
                      <td className="py-2.5 px-3 font-mono font-semibold text-cyan-700 dark:text-cyan-400">
                        {enc.EncounterNumber}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                        {new Date(enc.EncounterDate).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 dark:text-white">
                        {enc.PatientName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {enc.ChiefComplaint}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                        {enc.Diagnosis}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          enc.Status === 'Finalized'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : enc.Status === 'Amended'
                            ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                        }`}>
                          {enc.Status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-8 text-center text-slate-500 text-xs">
              No clinical consultations recorded yet.
            </div>
          )}
        </div>

        {/* Top Common Diagnoses (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Common Diagnoses</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Clinical trends (Last 60 Days)</p>
              </div>
              <TrendingUp className="w-4 h-4 text-cyan-600" />
            </div>

            {stats?.topDiagnoses && stats.topDiagnoses.length > 0 ? (
              <div className="space-y-3">
                {stats.topDiagnoses.map((d, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">{d.Diagnosis}</span>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300 font-bold font-mono">
                      {d.OccurrenceCount}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center text-slate-400 text-xs">
                No diagnostic trend data available yet.
              </div>
            )}
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500">
            Diagnoses mapped to ICD-10 clinical guidelines.
          </div>
        </div>
      </div>
    </div>
  );
}
