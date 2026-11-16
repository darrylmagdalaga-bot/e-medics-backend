import React, { useState, useEffect } from 'react';
import { 
  Stethoscope,
  Pill,
  Trash2, 
  Search, 
  Activity, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  User, 
  Calendar, 
  Scale, 
  Heart, 
  Thermometer, 
  Wind, 
  ShieldCheck,
  ChevronRight,
  X
} from 'lucide-react';
import { clinicalApi } from '../../api';
import { API_URL } from '../../../../app/api-config';
import { PatientRecord, VitalSigns } from '../../types';

interface NewEncounterViewProps {
  initialPatientId?: number | null;
  onEncounterCreated: (encounterId: number) => void;
  onCancel: () => void;
}

export function NewEncounterView({
  initialPatientId,
  onEncounterCreated,
  onCancel
}: NewEncounterViewProps) {
  // Patient Selection
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Encounter Fields
  const [attendingProviderName, setAttendingProviderName] = useState('Dr. Maria Clara Santos, MD');
  const [encounterType, setEncounterType] = useState('Consultation');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [assessment, setAssessment] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [icd10Code, setIcd10Code] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');

  // Vital Signs
  const [bpSystolic, setBpSystolic] = useState<string>('');
  const [bpDiastolic, setBpDiastolic] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [pulseRate, setPulseRate] = useState<string>('');
  const [respiratoryRate, setRespiratoryRate] = useState<string>('');
  const [oxygenSaturation, setOxygenSaturation] = useState<string>('');
  const [height, setHeight] = useState<string>('');
  const [weight, setWeight] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Prescriptions / Medication Orders state
  const [catalogMedicines, setCatalogMedicines] = useState<any[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [prescriptionItems, setPrescriptionItems] = useState<Array<{
    medicineId: number;
    medicineName: string;
    genericName?: string;
    quantityPrescribed: number;
    dosage?: string;
    frequency?: string;
    duration?: string;
    dosageInstructions?: string;
  }>>([]);
  const [selectedMedId, setSelectedMedId] = useState<string>('');
  const [prescQuantity, setPrescQuantity] = useState<number>(1);
  const [prescDosage, setPrescDosage] = useState<string>('');
  const [prescFrequency, setPrescFrequency] = useState<string>('3x daily');
  const [prescDuration, setPrescDuration] = useState<string>('7 days');
  const [prescInstructions, setPrescInstructions] = useState<string>('');

  // Load catalog medicines on mount
  useEffect(() => {
    async function loadCatalog() {
      try {
        setLoadingCatalog(true);
        const res = await fetch(`${API_URL}/api/medicines`);
        if (res.ok) {
          const data = await res.json();
          setCatalogMedicines(data);
        }
      } catch (err) {
        console.error('Failed to load medicines catalog:', err);
      } finally {
        setLoadingCatalog(false);
      }
    }
    loadCatalog();
  }, []);

  const handleAddPrescriptionItem = () => {
    if (!selectedMedId) return;
    const medId = parseInt(selectedMedId);
    const med = catalogMedicines.find(m => m.MedicineID === medId);
    if (!med) return;
    if (prescQuantity <= 0) {
      alert('Prescribed quantity must be greater than 0.');
      return;
    }
    // Check if already added
    if (prescriptionItems.some(i => i.medicineId === medId)) {
      alert('This medicine is already added to the prescription list. Adjust its quantity or remove it.');
      return;
    }

    setPrescriptionItems(prev => [
      ...prev,
      {
        medicineId: medId,
        medicineName: med.ProductName,
        genericName: med.GenericName,
        quantityPrescribed: prescQuantity,
        dosage: prescDosage || med.Dosage || '',
        frequency: prescFrequency,
        duration: prescDuration,
        dosageInstructions: prescInstructions || `Take ${prescDosage || med.Dosage || ''} ${prescFrequency} for ${prescDuration}`
      }
    ]);

    // Reset inputs
    setSelectedMedId('');
    setPrescQuantity(1);
    setPrescDosage('');
    setPrescInstructions('');
  };

  const handleRemovePrescriptionItem = (index: number) => {
    setPrescriptionItems(prev => prev.filter((_, i) => i !== index));
  };


  // Pre-load initial patient if provided
  useEffect(() => {
    if (initialPatientId) {
      clinicalApi.getPatientById(initialPatientId).then(p => {
        setSelectedPatient(p);
      }).catch(console.error);
    }
  }, [initialPatientId]);

  // Search patients debounced
  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatients([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        setSearchingPatients(true);
        const results = await clinicalApi.getPatients({ search: patientSearch });
        setPatients(results);
      } catch (err) {
        console.error('Failed to search patients:', err);
      } finally {
        setSearchingPatients(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [patientSearch]);

  // Live BMI calculation
  const calculatedBMI = React.useMemo(() => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (h > 0 && w > 0) {
      const hM = h / 100;
      const bmi = w / (hM * hM);
      let classification = 'Normal weight';
      if (bmi < 18.5) classification = 'Underweight';
      else if (bmi >= 25 && bmi < 30) classification = 'Overweight';
      else if (bmi >= 30) classification = 'Obese';
      return { bmi: bmi.toFixed(2), classification };
    }
    return null;
  }, [height, weight]);

  const handleSubmit = async (status: 'In Progress' | 'Finalized') => {
    if (!selectedPatient) {
      setFeedback({ type: 'error', message: 'Please select a registered patient for consultation.' });
      return;
    }
    if (!chiefComplaint.trim()) {
      setFeedback({ type: 'error', message: 'Chief Complaint is required.' });
      return;
    }
    if (!assessment.trim()) {
      setFeedback({ type: 'error', message: 'Clinical Assessment is required.' });
      return;
    }
    if (!diagnosis.trim()) {
      setFeedback({ type: 'error', message: 'Clinical Diagnosis is required.' });
      return;
    }
    if (!attendingProviderName.trim()) {
      setFeedback({ type: 'error', message: 'Attending Healthcare Provider name is required.' });
      return;
    }

    try {
      setSubmitting(true);
      setFeedback(null);

      const payload = {
        patientId: selectedPatient.PatientID,
        attendingProviderName,
        encounterType,
        chiefComplaint,
        historyOfPresentIllness,
        clinicalNotes,
        assessment,
        diagnosis,
        icd10Code,
        treatmentPlan,
        prescriptionItems: prescriptionItems.length > 0 ? prescriptionItems : undefined,
        status,
        vitalSigns: {
          bloodPressureSystolic: bpSystolic ? parseInt(bpSystolic) : null,
          bloodPressureDiastolic: bpDiastolic ? parseInt(bpDiastolic) : null,
          temperature: temperature ? parseFloat(temperature) : null,
          pulseRate: pulseRate ? parseInt(pulseRate) : null,
          respiratoryRate: respiratoryRate ? parseInt(respiratoryRate) : null,
          oxygenSaturation: oxygenSaturation ? parseFloat(oxygenSaturation) : null,
          height: height ? parseFloat(height) : null,
          weight: weight ? parseFloat(weight) : null
        }
      };

      const result = await clinicalApi.createEncounter(payload);
      onEncounterCreated(result.encounterId);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create encounter' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl flex items-center justify-between border shadow-xs ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs hover:opacity-75 cursor-pointer font-bold px-2 py-1">?</button>
        </div>
      )}

      {/* Grid: Left Column (Patient, Provider, Vitals) & Right Column (Clinical Documentation) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Patient Selector Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-cyan-600" />
              1. Patient Identification
            </h3>

            {selectedPatient ? (
              <div className="bg-cyan-50 dark:bg-cyan-950/40 border border-cyan-200 dark:border-cyan-800/60 rounded-xl p-4 relative">
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="absolute top-3 right-3 text-xs text-cyan-700 dark:text-cyan-300 font-semibold hover:underline cursor-pointer"
                >
                  Change
                </button>
                <div className="font-bold text-sm text-cyan-950 dark:text-cyan-100">
                  {selectedPatient.FullName}
                </div>
                <div className="text-xs text-cyan-800 dark:text-cyan-300 mt-1 space-y-0.5">
                  <div>Barangay: <strong>{selectedPatient.Barangay}</strong></div>
                  <div>Contact: {selectedPatient.ContactNumber || '?'}</div>
                  {selectedPatient.Age !== undefined && <div>Age: {selectedPatient.Age} yrs ({selectedPatient.Gender || '?'})</div>}
                  {selectedPatient.BloodType && <div>Blood Type: <span className="font-bold text-rose-600">{selectedPatient.BloodType}</span></div>}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search registered patient..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/20 text-slate-900 dark:text-white"
                  />
                  {searchingPatients && (
                    <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 animate-spin" />
                  )}
                </div>

                {patients.length > 0 && (
                  <div className="border border-slate-200 dark:border-slate-800 rounded-xl max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 shadow-sm bg-white dark:bg-slate-900 text-xs">
                    {patients.map(p => (
                      <div
                        key={p.PatientID}
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatients([]);
                          setPatientSearch('');
                        }}
                        className="p-2.5 hover:bg-cyan-50 dark:hover:bg-cyan-950/40 cursor-pointer transition-colors"
                      >
                        <div className="font-semibold text-slate-900 dark:text-white">{p.FullName}</div>
                        <div className="text-[11px] text-slate-500">{p.Barangay} ? {p.ContactNumber || 'No contact'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Provider & Encounter Type */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Stethoscope className="w-4 h-4 text-cyan-600" />
              2. Attending Provider & Type
            </h3>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase">Healthcare Provider *</label>
              <input
                type="text"
                required
                value={attendingProviderName}
                onChange={(e) => setAttendingProviderName(e.target.value)}
                className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase">Consultation Type</label>
              <select
                value={encounterType}
                onChange={(e) => setEncounterType(e.target.value)}
                className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
              >
                <option value="Consultation">General Consultation</option>
                <option value="Follow-up">Follow-up Visit</option>
                <option value="Routine Checkup">Routine Preventive Checkup</option>
                <option value="Emergency">Emergency Triage</option>
                <option value="Maternal & Child">Maternal & Child Health</option>
              </select>
            </div>
          </div>

          {/* Vital Signs Measurement Block */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-500" />
                3. Clinical Vital Signs
              </h3>
              <span className="text-[10px] text-slate-400 uppercase font-medium">Triage Data</span>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-500 text-[10px]">BP Systolic (mmHg)</label>
                <input
                  type="number"
                  placeholder="e.g. 120"
                  value={bpSystolic}
                  onChange={(e) => setBpSystolic(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 text-[10px]">BP Diastolic (mmHg)</label>
                <input
                  type="number"
                  placeholder="e.g. 80"
                  value={bpDiastolic}
                  onChange={(e) => setBpDiastolic(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 text-[10px]">Temperature (°C)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 37.0"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 text-[10px]">Pulse Rate (bpm)</label>
                <input
                  type="number"
                  placeholder="e.g. 75"
                  value={pulseRate}
                  onChange={(e) => setPulseRate(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 text-[10px]">Resp Rate (cpm)</label>
                <input
                  type="number"
                  placeholder="e.g. 16"
                  value={respiratoryRate}
                  onChange={(e) => setRespiratoryRate(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 text-[10px]">Oxygen Sat (% SpO2)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 98"
                  value={oxygenSaturation}
                  onChange={(e) => setOxygenSaturation(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 text-[10px]">Height (cm)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 170"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-500 text-[10px]">Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 65"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-center"
                />
              </div>
            </div>

            {/* Live BMI Banner */}
            {calculatedBMI && (
              <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                <span className="text-slate-500">Calculated BMI: <strong className="text-slate-900 dark:text-white font-mono">{calculatedBMI.bmi}</strong></span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300">
                  {calculatedBMI.classification}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (7 cols): Clinical Notes, Assessment, Diagnosis, Treatment Plan */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-cyan-600" />
              4. Clinical Documentation & Diagnosis
            </h3>

            <div>
              <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Chief Complaint *
              </label>
              <textarea
                rows={2}
                required
                placeholder="Primary reason patient sought medical care..."
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                History of Present Illness (HPI)
              </label>
              <textarea
                rows={2}
                placeholder="Chronological course of symptoms, onset, severity, triggers..."
                value={historyOfPresentIllness}
                onChange={(e) => setHistoryOfPresentIllness(e.target.value)}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Physical Examination & Clinical Notes
              </label>
              <textarea
                rows={3}
                placeholder="Objective findings, systemic examination observations..."
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Assessment *
                </label>
                <textarea
                  rows={2}
                  required
                  placeholder="Clinical synthesis, impression, differential..."
                  value={assessment}
                  onChange={(e) => setAssessment(e.target.value)}
                  className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                  Diagnosis * & ICD-10 Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="Primary clinical diagnosis..."
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                />
                <input
                  type="text"
                  placeholder="ICD-10 Code (e.g. J20.9, I10)..."
                  value={icd10Code}
                  onChange={(e) => setIcd10Code(e.target.value)}
                  className="w-full mt-2 p-1.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Treatment & Management Plan
              </label>
              <textarea
                rows={3}
                placeholder="Prescribed medicines, dietary advice, laboratory workups, follow-up instructions..."
                value={treatmentPlan}
                onChange={(e) => setTreatmentPlan(e.target.value)}
                className="w-full mt-1 p-2.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
              />
            </div>

            {/* Actions: Save Draft vs Finalize */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit('In Progress')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSubmit('Finalized')}
                  className="px-6 py-2.5 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>Finalize Consultation</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
