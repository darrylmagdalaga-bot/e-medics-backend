export interface BarangayScope {
  userId: number;
  username: string;
  fullName: string;
  role: string;
  barangay: string;
  locationId: number;
  locationName: string;
  isElevated: boolean;
}

export interface BarangayLocation {
  LocationID: number;
  LocationName: string;
  LocationType: string;
}

export interface StockRequestItem {
  medicineId: number;
  quantity: number;
  notes?: string;
}

export interface BarangayStockRequest {
  StockRequestID: number;
  RequestNumber: string;
  RequestingLocationID: number;
  FacilityName?: string;
  RequestedByUserID: number;
  RequestedByName?: string;
  ApprovedByName?: string;
  Priority: 'Routine' | 'Urgent' | 'Emergency';
  Purpose: string;
  Status: 'Draft' | 'Submitted' | 'Approved' | 'Partially Fulfilled' | 'Completed' | 'Rejected' | 'Cancelled';
  CreatedDate: string;
  ApprovedDate?: string;
  ItemCount?: number;
  TotalQuantityRequested?: number;
}

export interface StockRequestLineDetail {
  StockRequestItemID: number;
  MedicineID: number;
  ProductName: string;
  GenericName: string;
  Dosage: string;
  Form: string;
  UnitName: string;
  QuantityRequested: number;
  QuantityApproved: number;
  QuantityReleased: number;
}

export interface IncomingDistribution {
  DistributionID: number;
  DistributionNumber: string;
  ReferenceStockRequestID?: number;
  StockRequestNumber?: string;
  SourceLocationID: number;
  SourceLocationName?: string;
  DestinationLocationID: number;
  DestinationLocationName?: string;
  Status: 'Draft' | 'Issued' | 'Received' | 'Cancelled';
  ReleasedDate: string;
  ReleasedByName?: string;
  ItemCount: number;
  TotalQuantityIssued: number;
  HasDiscrepancy: boolean;
  DiscrepancyRemarks?: string;
}

export interface DistributionLineItem {
  DistributionItemID: number;
  DistributionID: number;
  InventoryID: number;
  QuantityIssued: number;
  ReceivedQuantity?: number;
  UnitCostAtTimeOfRelease: number;
  MedicineID: number;
  ProductName: string;
  GenericName: string;
  Dosage: string;
  Form: string;
  LotNumber: string;
  ExpiryDate: string;
}

export interface BarangayStockLot {
  StockID: number;
  BarangayName: string;
  LocationID: number;
  MedicineID: number;
  ProductName: string;
  GenericName: string;
  Dosage: string;
  Form: string;
  UnitName?: string;
  CategoryName?: string;
  LotNumber: string;
  ExpiryDate: string;
  Quantity: number;
  InitialQuantity: number;
  UnitCost: number;
  DateReceived: string;
  DaysUntilExpiry: number;
  ExpiryStatus: 'Expired' | 'Critical' | 'Warning' | 'Good';
}

export interface BarangayDisbursement {
  DisbursementID: number;
  DisbursementNumber: string;
  BarangayName: string;
  LocationID: number;
  PatientID?: number;
  RecipientName: string;
  DisbursedByName?: string;
  DisbursementDate: string;
  Status: string;
  Remarks?: string;
  ReversalReason?: string;
  ReversedByName?: string;
  ReversedDate?: string;
  ItemCount: number;
  TotalQuantity: number;
}

export interface DisbursementItemDetail {
  DisbursementItemID: number;
  DisbursementID: number;
  StockID: number;
  MedicineID: number;
  Quantity: number;
  LotNumber: string;
  DosageInstructions?: string;
  ProductName: string;
  GenericName?: string;
  Dosage?: string;
  Form?: string;
  UnitName?: string;
  ExpiryDate?: string;
}

export interface MovementLedgerEntry {
  TransactionID: number;
  BarangayName: string;
  LocationID: number;
  StockID: number;
  MedicineID: number;
  ProductName: string;
  GenericName: string;
  TransactionType: 'RECEIPT' | 'DISBURSEMENT' | 'REVERSAL' | 'ADJUSTMENT_ADD' | 'ADJUSTMENT_DEDUCT';
  ReferenceNumber: string;
  ReferenceID?: number;
  Quantity: number;
  BatchNumber: string;
  ExpiryDate: string;
  Remarks: string;
  CreatedByName: string;
  CreatedDate: string;
}
