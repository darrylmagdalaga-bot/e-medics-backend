import React, { useState, useEffect } from 'react';
import { 
  User, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  Heart, 
  AlertCircle, 
  Stethoscope, 
  Pill, 
  Clock, 
  ChevronRight, 
  ArrowLeft, 
  RefreshCw, 
  FileText, 
  Activity, 
  Plus, 
  UserCheck, 
  Edit, 
  BadgeAlert,
  Hash,
  CheckCircle2
} from 'lucide-react';
import { clinicalApi } from '../../api';
import { PatientRecord, PatientMedicalHistory, ClinicalEncounter } from '../../types';

interface PatientProfileViewProps {
  patientId: number;
  onBack: () => void;
  onStartConsultation: (patientId: number) => void;
  onSelectEncounter: (encounterId: number) => void;
}

export function PatientProfileView({
  patientId,
  onBack,
  onStartConsultation,
  onSelectEncounter
}: PatientProfileViewProps) {
  const [patient, setPatient] = useState<PatientRecord | null>(null);
  const [history, setHistory] = useState<PatientMedicalHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeHistoryTab, setActiveHistoryTab] = useState<'consultations' | 'prescriptions' | 'pharmacy'>('consultations');
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [patientData, historyData] = await Promise.all([
        clinicalApi.getPatientById(patientId),
        clinicalApi.getPatientMedicalHistory(patientId)
      ]);
      setPatient(patientData);
      setHistory(historyData);
    } catch (err: any) {
      console.error('Failed to load patient profile data:', err);
      setError(err.message || 'Failed to load patient profile and history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-4">
        <RefreshCw className="w-9 h-9 text-cyan-600 animate-spin" />
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Loading patient electronic medical record...
        </p>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl p-8 text-center max-w-lg mx-auto my-12">
        <AlertCircle className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-3" />
        <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Patient Profile Error</h3>
        <p className="text-sm text-red-700 dark:text-red-300 mb-6">{error || 'Patient record could not be found.'}</p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Return to Patient Registry
        </button>
      </div>
    );
  }

  const encounters = history?.encounters || [];
  const pharmacyRecords = history?.dispensingRecords || [];
  const prescriptions = history?.prescriptions || [];

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:text-cyan-700 dark:hover:text-cyan-400 transition-colors cursor-pointer w-fit"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Registry
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onStartConsultation(patient.PatientID)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-700 hover:bg-cyan-800 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer"
          >
            <Stethoscope className="w-4 h-4" /> Start New Consultation
          </button>
        </div>
      </div>

      {/* Patient Demographic Profile Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6 pb-6 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-700/10 text-cyan-800 dark:bg-cyan-500/20 dark:text-cyan-300 flex items-center justify-center font-bold text-2xl shrink-0 border border-cyan-700/20">
              {patient.FirstName?.[0]}{patient.Surname?.[0]}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  {patient.FullName}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-300">
                  ID: #{patient.PatientID}
                </span>
                {patient.PhilHealthNumber && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40">
                    <ShieldCheck className="w-3 h-3" /> PhilHealth: {patient.PhilHealthNumber}
                  </span>
                )}
                {patient.BloodType && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                    Blood: {patient.BloodType}
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{patient.Gender || 'Unspecified'}</span>
                <span>?</span>
                <span>{patient.Age !== undefined ? `${patient.Age} years old` : 'Age N/A'}</span>
                <span>?</span>
                <span>Born {patient.BirthDate ? new Date(patient.BirthDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Unknown'}</span>
                <span>?</span>
                <span>Civil Status: {patient.CivilStatus || 'Single'}</span>
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-4 border-t lg:border-t-0 pt-4 lg:pt-0 border-slate-100 dark:border-slate-800">
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Consultations</span>
              <span className="text-xl font-black text-cyan-700 dark:text-cyan-400">{encounters.length}</span>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block">Dispenses</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">{pharmacyRecords.length}</span>
            </div>
          </div>
        </div>

        {/* Detailed Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6 text-sm">
          {/* Contact Details */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact Details</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium">{patient.ContactNumber || 'No phone recorded'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span className="font-medium">{patient.Email || 'No email recorded'}</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-700 dark:text-slate-200">
                <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
                <span>Registered: {new Date(patient.DateRegistered).toLocaleDateString()}</span>
              </div>
            </div>
          </div>

          {/* Location & Address */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address Information</h4>
            <div className="space-y-2">
              <div className="flex items-start gap-2.5 text-slate-700 dark:text-slate-200">
                <MapPin className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold block">Barangay {patient.Barangay}</span>
                  <span className="text-slate-500 dark:text-slate-400 text-xs">
                    {patient.DetailedAddress || 'City of Catbalogan, Samar'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Emergency Contact</h4>
            <div className="space-y-2">
              {patient.EmergencyContactName ? (
                <>
                  <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
                    <UserCheck className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>{patient.EmergencyContactName}</span>
                  </div>
                  {patient.EmergencyContactNumber && (
                    <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 text-xs">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{patient.EmergencyContactNumber}</span>
                    </div>
                  )}
                </>
              ) : (
                <span className="text-slate-400 text-xs italic">No emergency contact designated</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Unified Medical History Header & Sub-Tabs */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-800/30">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-600" />
              Unified Patient Medical & Dispensing Record
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Complete longitudinal health record uniting clinical consultations and pharmacy medicine releases.
            </p>
          </div>

          {/* Sub-tab pills */}
          <div className="inline-flex rounded-xl bg-slate-200/80 dark:bg-slate-800 p-1 text-xs font-semibold">
            <button
              onClick={() => setActiveHistoryTab('consultations')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeHistoryTab === 'consultations'
                  ? 'bg-white dark:bg-slate-700 text-cyan-800 dark:text-cyan-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Stethoscope className="w-3.5 h-3.5" />
              <span>Consultations ({encounters.length})</span>
            </button>

            <button
              onClick={() => setActiveHistoryTab('prescriptions')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeHistoryTab === 'prescriptions'
                  ? 'bg-white dark:bg-slate-700 text-indigo-800 dark:text-indigo-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Prescriptions & Orders ({prescriptions.length})</span>
            </button>

            <button
              onClick={() => setActiveHistoryTab('pharmacy')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeHistoryTab === 'pharmacy'
                  ? 'bg-white dark:bg-slate-700 text-emerald-800 dark:text-emerald-300 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Pill className="w-3.5 h-3.5" />
              <span>Pharmacy Releases ({pharmacyRecords.length})</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Clinical Consultations History */}
        {activeHistoryTab === 'consultations' && (
          <div className="p-6">
            {encounters.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-14 h-14 rounded-full bg-cyan-100 dark:bg-cyan-950/60 text-cyan-700 dark:text-cyan-400 flex items-center justify-center mx-auto mb-3">
                  <Stethoscope className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  No Clinical Consultations on Record
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5">
                  This patient does not have any recorded medical consultations yet. Open a consultation session to record clinical findings.
                </p>
                <button
                  onClick={() => onStartConsultation(patient.PatientID)}
                  className="px-4 py-2 rounded-xl bg-cyan-700 text-white font-semibold text-sm hover:bg-cyan-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Start First Consultation
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {encounters.map((enc) => {
                  const isFinalized = enc.Status === 'Finalized';
                  const isAmended = enc.Status === 'Amended';
                  return (
                    <div
                      key={enc.EncounterID}
                      className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 hover:border-cyan-300 dark:hover:border-cyan-700 transition-all bg-white dark:bg-slate-900/60 shadow-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {enc.EncounterNumber}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {new Date(enc.EncounterDate).toLocaleDateString(undefined, {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                            isFinalized
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : isAmended
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-300'
                          }`}>
                            {enc.Status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Attending: <span className="font-semibold text-slate-700 dark:text-slate-200">{enc.AttendingProviderName}</span>
                        </div>
                      </div>

                      {/* Clinical Content */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Chief Complaint</span>
                          <p className="text-slate-800 dark:text-slate-200 font-medium">
                            {enc.ChiefComplaint}
                          </p>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">Clinical Diagnosis</span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-900 dark:text-white font-bold">
                              {enc.Diagnosis}
                            </span>
                            {enc.ICD10Code && (
                              <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 border border-cyan-200/50">
                                {enc.ICD10Code}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Vital Signs Summary Ribbon */}
                      {(enc.BloodPressureSystolic || enc.Temperature || enc.BMI) && (
                        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300 mb-4 border border-slate-100 dark:border-slate-800">
                          <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px]">Vitals:</span>
                          {enc.BloodPressureSystolic && (
                            <span>BP: <strong className="text-slate-900 dark:text-white">{enc.BloodPressureSystolic}/{enc.BloodPressureDiastolic} mmHg</strong></span>
                          )}
                          {enc.Temperature && (
                            <span>Temp: <strong className="text-slate-900 dark:text-white">{enc.Temperature}°C</strong></span>
                          )}
                          {enc.PulseRate && (
                            <span>HR: <strong className="text-slate-900 dark:text-white">{enc.PulseRate} bpm</strong></span>
                          )}
                          {enc.OxygenSaturation && (
                            <span>SpO₂: <strong className="text-slate-900 dark:text-white">{enc.OxygenSaturation}%</strong></span>
                          )}
                          {enc.BMI && (
                            <span className="inline-flex items-center gap-1.5">
                              BMI: <strong className="text-slate-900 dark:text-white">{enc.BMI}</strong>
                              {enc.BMIClassification && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                                  {enc.BMIClassification}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800/60">
                        <button
                          onClick={() => onSelectEncounter(enc.EncounterID)}
                          className="inline-flex items-center gap-1.5 text-xs font-bold text-cyan-700 dark:text-cyan-400 hover:text-cyan-800 dark:hover:text-cyan-300 cursor-pointer"
                        >
                          View Consultation Record <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}


        {/* Tab 2: Prescriptions & Medication Orders History (Phase 9) */}
        {activeHistoryTab === 'prescriptions' && (
          <div className="p-6">
            {prescriptions.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-14 h-14 rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <FileText className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  No Prescriptions on Record
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-5">
                  No electronic prescriptions or medication recommendations have been issued for this patient yet.
                </p>
                <button
                  onClick={() => onStartConsultation(patient.PatientID)}
                  className="px-4 py-2 rounded-xl bg-cyan-700 text-white font-semibold text-sm hover:bg-cyan-800 transition-colors inline-flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Start Consultation & Prescribe
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {prescriptions.map((rx) => {
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
                      className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-white dark:bg-slate-900/60 shadow-xs hover:border-indigo-300 dark:hover:border-indigo-700 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-900">
                            {rx.PrescriptionNumber}
                          </span>
                          <span className="text-sm font-semibold text-slate-900 dark:text-white">
                            {new Date(rx.PrescriptionDate).toLocaleDateString(undefined, {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </span>
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor}`}>
                            {rx.Status}
                          </span>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-4">
                          <span>
                            Prescribing Provider: <strong className="text-slate-700 dark:text-slate-200">{rx.PrescribingProviderName || 'Attending Physician'}</strong>
                          </span>
                          {rx.EncounterID && (
                            <button
                              onClick={() => onSelectEncounter(rx.EncounterID)}
                              className="text-cyan-700 dark:text-cyan-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <span>View Encounter</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {rx.ClinicalDiagnosis && (
                        <div className="mb-3 text-xs">
                          <span className="text-slate-400 uppercase font-bold text-[10px] tracking-wider block mb-0.5">Clinical Diagnosis:</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{rx.ClinicalDiagnosis}</span>
                        </div>
                      )}

                      {/* Items table */}
                      <div className="overflow-hidden border border-slate-100 dark:border-slate-800 rounded-lg">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/50 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100 dark:border-slate-800">
                            <tr>
                              <th className="p-2.5">Prescribed Medicine</th>
                              <th className="p-2.5 text-center">Prescribed</th>
                              <th className="p-2.5 text-center">Dispensed</th>
                              <th className="p-2.5 text-center">Remaining</th>
                              <th className="p-2.5">Instructions & Regimen</th>
                              <th className="p-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            {rx.items && rx.items.map((item) => {
                              const remaining = item.remainingQuantity !== undefined 
                                ? item.remainingQuantity 
                                : Math.max(0, item.QuantityPrescribed - item.QuantityDispensed);

                              return (
                                <tr key={item.PrescriptionItemID} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                                  <td className="p-2.5">
                                    <div className="font-bold text-slate-900 dark:text-white">
                                      {item.MedicineName}
                                    </div>
                                    {item.GenericName && (
                                      <div className="text-[10px] text-slate-400 italic">
                                        {item.GenericName}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-slate-800 dark:text-slate-200">
                                    {item.QuantityPrescribed}
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                    {item.QuantityDispensed}
                                  </td>
                                  <td className="p-2.5 text-center font-bold text-amber-600 dark:text-amber-400">
                                    {remaining}
                                  </td>
                                  <td className="p-2.5 text-[11px]">
                                    <div>{item.DosageInstructions || '-'}</div>
                                    {(item.Frequency || item.Duration) && (
                                      <div className="text-[10px] text-slate-400">
                                        {item.Frequency} {item.Duration ? `• ${item.Duration}` : ''}
                                      </div>
                                    )}
                                  </td>
                                  <td className="p-2.5 text-center">
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
        )}

        {/* Tab 3: Pharmacy Dispensing History */}
        {activeHistoryTab === 'pharmacy' && (
          <div className="p-6">
            {pharmacyRecords.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                  <Pill className="w-7 h-7" />
                </div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  No Pharmacy Dispensing Records
                </h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  No medications have been dispensed for this patient from the City Health Office Pharmacy yet.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {pharmacyRecords.map((dispense) => (
                  <div
                    key={dispense.saleId}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl p-5 bg-white dark:bg-slate-900/60 shadow-xs"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900">
                          {dispense.dispenseNumber}
                        </span>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">
                          {new Date(dispense.saleDate).toLocaleDateString(undefined, {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          {dispense.dispenseStatus || 'Dispensed'}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3">
                        {dispense.physicianName && (
                          <span>Prescriber: <strong className="text-slate-700 dark:text-slate-200">{dispense.physicianName}</strong></span>
                        )}
                        {dispense.prescriptionNumber && (
                          <span>Rx: <strong className="font-mono text-slate-700 dark:text-slate-200">{dispense.prescriptionNumber}</strong></span>
                        )}
                      </div>
                    </div>

                    {/* Dispensed Items Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase tracking-wider">
                            <th className="pb-2 font-semibold">Medicine Description</th>
                            <th className="pb-2 font-semibold">Generic Name</th>
                            <th className="pb-2 font-semibold">Lot / Batch</th>
                            <th className="pb-2 font-semibold text-right">Quantity</th>
                            <th className="pb-2 font-semibold pl-4">Dosage / Instructions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                          {dispense.items.map((item) => (
                            <tr key={item.detailId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                              <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                                {item.productName}
                              </td>
                              <td className="py-2.5 text-slate-500 dark:text-slate-400">
                                {item.genericName || '?'}
                              </td>
                              <td className="py-2.5 font-mono text-slate-600 dark:text-slate-300">
                                {item.lotNumber || 'N/A'}
                              </td>
                              <td className="py-2.5 text-right font-black text-emerald-600 dark:text-emerald-400">
                                {item.quantity}
                              </td>
                              <td className="py-2.5 pl-4 text-slate-600 dark:text-slate-300 italic">
                                {item.dosageInstructions || 'As directed by physician'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
