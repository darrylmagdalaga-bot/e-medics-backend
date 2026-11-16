export interface CountSessionHeader {
  CountID: string | number;
  CountNumber: string;
  CountDate: string;
  LocationID: number;
  LocationName?: string;
  Status: 'Draft' | 'In Progress' | 'Submitted' | 'Approved' | 'Rejected' | 'Posted' | 'Cancelled';
  Remarks: string;
  BaselineDate: string;
  CreatedBy: number;
  CreatorName?: string;
  CreatedDate: string;
  SubmittedBy?: number;
  SubmitterName?: string;
  SubmittedDate?: string;
  ReviewedBy?: number;
  ReviewerName?: string;
  ReviewedDate?: string;
  ApprovalNotes?: string;
  PostedBy?: number;
  PosterName?: string;
  PostedDate?: string;
  TotalItemsCounted: number;
  TotalDiscrepancies: number;
  TotalSystemQuantity: number;
  TotalPhysicalQuantity: number;
  TotalVarianceQuantity: number;
}

export interface CountItem {
  CountItemID: string | number;
  CountID: string | number;
  InventoryID: string | number;
  MedicineID: number;
  MedicineName?: string;
  GenericName?: string;
  DosageForm?: string;
  Strength?: string;
  BatchNumber?: string;
  LotNumber?: string;
  ExpiryDate?: string;
  SystemQuantity: number;
  PhysicalQuantity: number;
  VarianceQuantity: number;
  UnitCostAtBaseline: number;
  VarianceValue: number;
  DiscrepancyReason: string;
  Notes: string;
  InterveningMovementsDetected?: number;
  IsAdjusted: boolean;
  AdjustmentTransactionID?: string | number;
}

export const DISCREPANCY_REASONS = [
  'Damaged Stock',
  'Expired Stock',
  'Pilferage / Missing',
  'Found Stock / Surplus',
  'Data Entry Error',
  'Mislabeled Batch',
  'Breakage in Handling',
  'Dispensing Shrinkage',
  'Other (Document in Notes)'
];
