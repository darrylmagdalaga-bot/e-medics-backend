export interface VitalSigns {
  VitalSignsID?: number;
  EncounterID?: number;
  PatientID?: number;
  BloodPressureSystolic?: number | null;
  BloodPressureDiastolic?: number | null;
  Temperature?: number | null;
  PulseRate?: number | null;
  RespiratoryRate?: number | null;
  OxygenSaturation?: number | null;
  Height?: number | null;
  Weight?: number | null;
  BMI?: number | null;
  BMIClassification?: string | null;
  RecordedBy?: number | null;
  RecordedDate?: string;
}

export interface EncounterAmendment {
  AmendmentID: number;
  EncounterID: number;
  AmendmentReason: string;
  PreviousClinicalNotes?: string;
  PreviousAssessment: string;
  PreviousDiagnosis: string;
  PreviousTreatmentPlan?: string;
  AmendedBy: number;
  AmendedByName?: string;
  AmendedDate: string;
}

export interface ClinicalEncounter {
  EncounterID: number;
  EncounterNumber: string;
  PatientID: number;
  PatientName?: string;
  PatientAge?: number;
  PatientGender?: string;
  PatientBarangay?: string;
  PatientContact?: string;
  PatientPhilHealth?: string;
  PatientBloodType?: string;
  AttendingProviderID?: number;
  AttendingProviderName: string;
  EncounterDate: string;
  EncounterType: string;
  ChiefComplaint: string;
  HistoryOfPresentIllness?: string;
  ClinicalNotes?: string;
  Assessment: string;
  Diagnosis: string;
  ICD10Code?: string;
  TreatmentPlan?: string;
  Status: 'In Progress' | 'Finalized' | 'Amended' | 'Cancelled';
  FinalizedDate?: string;
  FinalizedByName?: string;
  CreatedByName?: string;
  CreatedDate: string;
  ModifiedDate?: string;
  vitalSigns?: VitalSigns | null;
  amendments?: EncounterAmendment[];
  prescriptions?: ClinicalPrescription[];
}

export interface PatientRecord {
  PatientID: number;
  FirstName: string;
  MiddleName?: string;
  Surname: string;
  FullName: string;
  BirthDate?: string;
  Age?: number;
  Gender?: string;
  CivilStatus?: string;
  Barangay: string;
  DetailedAddress?: string;
  ContactNumber?: string;
  Email?: string;
  PhilHealthNumber?: string;
  EmergencyContactName?: string;
  EmergencyContactNumber?: string;
  BloodType?: string;
  IsActive: boolean;
  DateRegistered: string;
  TotalEncounters?: number;
  LastEncounterDate?: string;
  TotalPrescriptionsDispensed?: number;
  LastDispenseDate?: string;
}

export interface ClinicalDashboardStats {
  totalPatients: number;
  encountersToday: number;
  finalizedToday: number;
  inProgressEncounters: number;
  totalLifetimeEncounters: number;
  recentEncounters: {
    EncounterID: number;
    EncounterNumber: string;
    EncounterDate: string;
    EncounterType: string;
    ChiefComplaint: string;
    Diagnosis: string;
    Status: 'In Progress' | 'Finalized' | 'Amended';
    AttendingProviderName: string;
    PatientID: number;
    PatientName: string;
    Barangay?: string;
  }[];
  topDiagnoses: {
    Diagnosis: string;
    OccurrenceCount: number;
  }[];
}

export interface PatientDispenseHistoryItem {
  saleId: number;
  dispenseNumber: string;
  saleDate: string;
  dispenseStatus: string;
  prescriptionNumber?: string;
  physicianName?: string;
  pharmacistName?: string;
  items: {
    detailId: number;
    productName: string;
    genericName: string;
    dosage?: string;
    form?: string;
    quantity: number;
    lotNumber: string;
    dosageInstructions?: string;
  }[];
}

export interface PatientMedicalHistory {
  patient: {
    PatientID: number;
    FullName: string;
    BirthDate?: string;
    Barangay?: string;
  };
  encounters: (ClinicalEncounter & VitalSigns)[];
  dispensingRecords: PatientDispenseHistoryItem[];
  prescriptions?: ClinicalPrescription[];
}

export interface PrescriptionItem {
  PrescriptionItemID: number;
  PrescriptionID: number;
  MedicineID: number;
  MedicineName: string;
  GenericName?: string;
  QuantityPrescribed: number;
  QuantityDispensed: number;
  remainingQuantity?: number;
  Dosage?: string;
  Frequency?: string;
  Duration?: string;
  DosageInstructions?: string;
  ItemStatus: 'Pending' | 'Partially Dispensed' | 'Fully Dispensed' | 'Cancelled';
  CreatedDate?: string;
  availableStock?: number;
  batches?: any[];
}

export interface ClinicalPrescription {
  PrescriptionID: number;
  PrescriptionNumber: string;
  EncounterID: number;
  PatientID: number;
  PrescribingProviderID?: number;
  PrescribingProviderName?: string;
  PrescriptionDate: string;
  ClinicalDiagnosis?: string;
  Notes?: string;
  Status: 'Pending' | 'Partially Dispensed' | 'Fully Dispensed' | 'Cancelled';
  CreatedBy?: number;
  CreatedDate: string;
  ModifiedDate?: string;
  items?: PrescriptionItem[];
}
