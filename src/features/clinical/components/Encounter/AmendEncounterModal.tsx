import React, { useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  FileEdit, 
  ShieldAlert, 
  CheckCircle2, 
  RefreshCw,
  Info
} from 'lucide-react';
import { clinicalApi } from '../../api';
import { ClinicalEncounter } from '../../types';

interface AmendEncounterModalProps {
  encounter: ClinicalEncounter;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AmendEncounterModal({
  encounter,
  isOpen,
  onClose,
  onSuccess
}: AmendEncounterModalProps) {
  const [amendmentReason, setAmendmentReason] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState(encounter.ClinicalNotes || '');
  const [assessment, setAssessment] = useState(encounter.Assessment || '');
  const [diagnosis, setDiagnosis] = useState(encounter.Diagnosis || '');
  const [icd10Code, setIcd10Code] = useState(encounter.ICD10Code || '');
  const [treatmentPlan, setTreatmentPlan] = useState(encounter.TreatmentPlan || '');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amendmentReason.trim() || amendmentReason.trim().length < 5) {
      setError('Please provide a specific clinical reason for this amendment (at least 5 characters).');
      return;
    }
    if (!assessment.trim() || !diagnosis.trim()) {
      setError('Clinical Assessment and Diagnosis cannot be empty.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await clinicalApi.amendEncounter(encounter.EncounterID, {
        amendmentReason: amendmentReason.trim(),
        clinicalNotes: clinicalNotes.trim(),
        assessment: assessment.trim(),
        diagnosis: diagnosis.trim(),
        treatmentPlan: treatmentPlan.trim()
      });
      onSuccess();
    } catch (err: any) {
      console.error('Failed to amend encounter:', err);
      setError(err.message || 'Failed to submit clinical record amendment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-amber-500/10 dark:bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Amend Finalized Consultation
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300">
                  {encounter.EncounterNumber}
                </span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Patient: <strong className="text-slate-700 dark:text-slate-200">{encounter.PatientName}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Clinical Immutability Compliance Warning */}
          <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl p-4 flex items-start gap-3 text-xs text-amber-900 dark:text-amber-200">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              <strong className="block text-amber-950 dark:text-amber-100 font-bold mb-0.5">
                Clinical Audit Compliance Requirement
              </strong>
              Finalized medical records are legally binding. Direct modifications are disallowed. Submitting an amendment permanently archives the previous assessment & treatment plan in the audit trail alongside your documented rationale.
            </div>
          </div>

          {error && (
            <div className="bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 rounded-xl p-3 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Mandatory Reason for Amendment */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center justify-between">
              <span>Reason for Clinical Amendment <span className="text-red-500">*</span></span>
              <span className="text-[10px] text-slate-400 font-normal">Required for clinical audit log</span>
            </label>
            <textarea
              required
              rows={2}
              value={amendmentReason}
              onChange={(e) => setAmendmentReason(e.target.value)}
              placeholder="e.g., Diagnostic refinement following confirmatory laboratory findings; revised treatment instructions..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-amber-500"
            />
          </div>

          {/* Diagnosis & ICD-10 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Amended Diagnosis <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={diagnosis}
                onChange={(e) => setDiagnosis(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                ICD-10 Code
              </label>
              <input
                type="text"
                value={icd10Code}
                onChange={(e) => setIcd10Code(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          {/* Assessment */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Amended Clinical Assessment <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={3}
              value={assessment}
              onChange={(e) => setAssessment(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Treatment Plan */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Amended Treatment Plan & Prescriptions
            </label>
            <textarea
              rows={3}
              value={treatmentPlan}
              onChange={(e) => setTreatmentPlan(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Clinical Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
              Additional Clinical Notes
            </label>
            <textarea
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-sm shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Recording Amendment...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> Save Clinical Amendment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
