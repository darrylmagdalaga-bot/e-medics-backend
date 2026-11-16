import { API_URL } from '../../app/api-config';
import { 
  ClinicalDashboardStats, 
  PatientRecord, 
  ClinicalEncounter, 
  PatientMedicalHistory,
  ClinicalPrescription
} from './types';

export const clinicalApi = {
  // Dashboard
  getDashboardStats: async (): Promise<ClinicalDashboardStats> => {
    const res = await fetch(`${API_URL}/api/clinical/dashboard`);
    if (!res.ok) throw new Error('Failed to load clinical dashboard stats');
    return res.json();
  },

  // Patients
  getPatients: async (filters: { search?: string; barangay?: string; gender?: string } = {}): Promise<PatientRecord[]> => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.barangay) params.append('barangay', filters.barangay);
    if (filters.gender) params.append('gender', filters.gender);
    const res = await fetch(`${API_URL}/api/clinical/patients?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load patient records');
    return res.json();
  },

  getPatientById: async (patientId: number): Promise<PatientRecord> => {
    const res = await fetch(`${API_URL}/api/clinical/patients/${patientId}`);
    if (!res.ok) throw new Error('Failed to load patient details');
    return res.json();
  },

  createPatient: async (data: Partial<PatientRecord>, userId: number = 1) => {
    const res = await fetch(`${API_URL}/api/clinical/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, userId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create patient record');
    return result;
  },

  updatePatient: async (patientId: number, data: Partial<PatientRecord>, userId: number = 1) => {
    const res = await fetch(`${API_URL}/api/clinical/patients/${patientId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, userId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update patient record');
    return result;
  },

  getPatientMedicalHistory: async (patientId: number): Promise<PatientMedicalHistory> => {
    const res = await fetch(`${API_URL}/api/clinical/patients/${patientId}/history`);
    if (!res.ok) throw new Error('Failed to load patient medical history');
    return res.json();
  },

  // Encounters
  getEncounters: async (filters: { search?: string; status?: string; encounterType?: string; startDate?: string; endDate?: string } = {}): Promise<ClinicalEncounter[]> => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.encounterType) params.append('encounterType', filters.encounterType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const res = await fetch(`${API_URL}/api/clinical/encounters?${params.toString()}`);
    if (!res.ok) throw new Error('Failed to load encounters');
    return res.json();
  },

  getEncounterById: async (encounterId: number | string): Promise<ClinicalEncounter> => {
    const res = await fetch(`${API_URL}/api/clinical/encounters/${encounterId}`);
    if (!res.ok) throw new Error('Failed to load encounter details');
    return res.json();
  },

  createEncounter: async (payload: any, userId: number = 1) => {
    const res = await fetch(`${API_URL}/api/clinical/encounters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, userId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create clinical encounter');
    return result;
  },

  updateEncounter: async (encounterId: number | string, payload: any, userId: number = 1) => {
    const res = await fetch(`${API_URL}/api/clinical/encounters/${encounterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, userId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to update clinical encounter');
    return result;
  },

  finalizeEncounter: async (encounterId: number | string, userId: number = 1) => {
    const res = await fetch(`${API_URL}/api/clinical/encounters/${encounterId}/finalize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to finalize clinical encounter');
    return result;
  },

  amendEncounter: async (encounterId: number | string, payload: { amendmentReason: string; clinicalNotes?: string; assessment?: string; diagnosis?: string; treatmentPlan?: string }, userId: number = 1) => {
    const res = await fetch(`${API_URL}/api/clinical/encounters/${encounterId}/amend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, userId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to amend clinical encounter');
    return result;
  },

  // Prescriptions
  getPrescriptionsByEncounter: async (encounterId: number | string): Promise<ClinicalPrescription[]> => {
    const res = await fetch(`${API_URL}/api/clinical/encounters/${encounterId}/prescriptions`);
    if (!res.ok) throw new Error('Failed to load prescriptions for encounter');
    return res.json();
  },

  getPrescriptionById: async (prescriptionId: number | string): Promise<ClinicalPrescription> => {
    const res = await fetch(`${API_URL}/api/clinical/prescriptions/${prescriptionId}`);
    if (!res.ok) throw new Error('Failed to load prescription');
    return res.json();
  },

  createPrescriptionForEncounter: async (encounterId: number | string, payload: any, userId: number = 1) => {
    const res = await fetch(`${API_URL}/api/clinical/encounters/${encounterId}/prescriptions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...payload, userId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to create prescription');
    return result;
  },

  cancelPrescription: async (prescriptionId: number | string, reason: string, userId: number = 1) => {
    const res = await fetch(`${API_URL}/api/clinical/prescriptions/${prescriptionId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, userId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to cancel prescription');
    return result;
  }
};