export interface PharmacyAlertMedicine {
  MedicineID: number;
  ProductName: string;
  GenericName?: string;
  Dosage?: string;
  Form?: string;
  TotalAvailableStock: number;
  BatchCount: number;
}

export interface PharmacyExpiryAlertItem {
  StockID: number;
  MedicineID: number;
  ProductName: string;
  GenericName?: string;
  LotNumber: string;
  ExpiryDate: string;
  Quantity: number;
  DaysToExpiry: number;
  AlertStatus: 'Expired' | 'Near Expiry';
}

export interface PharmacyRecentReceiptItem {
  TransactionID: number;
  ReferenceNumber: string;
  MedicineID: number;
  ProductName: string;
  GenericName?: string;
  BatchNumber: string;
  Quantity: number;
  ExpiryDate?: string;
  CreatedDate: string;
  CreatedByName?: string;
  Remarks?: string;
}

export interface PharmacyDashboardStats {
  totalMedicines: number;
  totalCatalogMedicines: number;
  totalBatches: number;
  activeAvailableBatches: number;
  totalAvailableStock: number;
  totalExpiredUnits: number;
  nearExpiryBatches: number;
  expiredBatches: number;
  lowStockCount: number;
  pendingStockRequests: number;
  approvedStockRequests: number;
  pendingDistributions: number;
  discrepancyCount: number;
  todayDispenseTransactions: number;
  todayDispensedUnits: number;
  dispensedTodayCount: number;
  dispensedTodayUnits: number;
  lowStockAlerts: PharmacyAlertMedicine[];
  expiryAlerts: PharmacyExpiryAlertItem[];
  recentReceipts: PharmacyRecentReceiptItem[];
  recentDispensing: {
    SaleID: number;
    DispenseNumber: string;
    SaleDate: string;
    Status: 'Completed' | 'Cancelled';
    PatientName: string;
    Barangay?: string;
    PharmacistName?: string;
    ItemCount: number;
    TotalUnits: number;
    TotalQuantity?: number;
  }[];
  topDispensedMedicines: {
    MedicineID: number;
    ProductName: string;
    GenericName: string;
    TotalDispensed: number;
  }[];
}

export interface PharmacyStockItem {
  StockID: number;
  MedicineID: number;
  ProductName: string;
  GenericName: string;
  BrandName?: string;
  Dosage?: string;
  Form?: string;
  UnitName?: string;
  Classification?: string;
  Quantity: number;
  InitialQuantity?: number;
  LotNumber: string;
  ExpiryDate: string;
  Price: number;
  DateReceived: string;
  WarehouseInventoryID?: number;
  DistributionItemID?: number;
  SourceDistributionNumber?: string;
  IsActive: boolean;
  DaysToExpiry: number;
  StockStatus: 'Good' | 'Low Stock' | 'Near Expiry' | 'Expired';
}

export interface IssuedDistribution {
  DistributionID: string;
  DistributionNumber: string;
  ReferenceStockRequestID?: number;
  StockRequestNumber?: string;
  SourceLocationID: number;
  DestinationLocationID: number;
  ReleasedDate: string;
  Status: string;
  Remarks?: string;
  ReleasedByName?: string;
  TotalLineItems: number;
  TotalQuantity: number;
}

export interface PharmacyStockRequest {
  StockRequestID: number;
  RequestNumber: string;
  RequestingLocationID: number;
  FacilityName: string;
  RequestingFacility?: string;
  RequestedByUserID: number;
  RequestedByName?: string;
  Priority: 'Routine' | 'Urgent' | 'Emergency';
  Purpose: string;
  Remarks?: string;
  RequiredDate?: string;
  ShortageNotes?: string;
  Status: string;
  CreatedDate: string;
  ApprovedDate?: string;
  RejectedDate?: string;
  ItemCount: number;
  TotalQuantityRequested: number;
  TotalQuantityApproved?: number;
  TotalQuantityReleased?: number;
  TotalQuantityUnfulfilled?: number;
  DistributionNumber?: string;
  DistributionStatus?: string;
  AdminRemarks?: string;
  RejectionReason?: string;
  DistributionID?: number;
}

export interface PharmacyStockRequestItem {
  StockRequestItemID: number;
  StockRequestID: number;
  MedicineID: number;
  QuantityRequested: number;
  QuantityApproved?: number;
  QuantityReleased?: number;
  RemainingQuantity?: number;
  PhysicalStock?: number;
  ReservedQuantity?: number;
  UnavailableQuantity?: number;
  AvailableStock?: number;
  ReleasableQuantity?: number;
  ShortageQuantity?: number;
  HasShortage?: boolean;
  StockCondition?: string;
  ProductName: string;
  GenericName?: string;
  Dosage?: string;
  Form?: string;
  UnitName?: string;
  QuantityUnfulfilled?: number;
  QuantityReceived?: number;
  QuantityDamaged?: number;
  Remarks?: string;
}

export interface ReceiveDistributionLineConfirmation {
  distributionItemId: string | number;
  receivedQuantity: number;
  damagedQuantity?: number;
  shortageQuantity?: number;
  discrepancyReason?: string;
}

export interface DistributionDetailItem {
  DistributionItemID: string;
  DistributionID: string;
  InventoryID: string;
  Quantity: number;
  UnitCostAtTimeOfRelease: number;
  MedicineID: number;
  LotNumber: string;
  ExpiryDate: string;
  LocationID?: number;
  ProductName: string;
  GenericName: string;
  Dosage?: string;
  Form?: string;
}

export interface Patient {
  PatientID: number;
  FirstName: string;
  MiddleName?: string;
  Surname: string;
  FullName: string;
  BirthDate?: string;
  Barangay?: string;
  DetailedAddress?: string;
  ContactNumber?: string;
  Email?: string;
  DateRegistered?: string;
}

export interface DispensingRecord {
  SaleID: number;
  DispenseNumber: string;
  SaleDate: string;
  Status: 'Completed' | 'Cancelled';
  PrescriptionNumber?: string;
  PhysicianName?: string;
  Remarks?: string;
  CancelledDate?: string;
  CancellationReason?: string;
  PatientID: number;
  PatientName: string;
  Barangay?: string;
  ContactNumber?: string;
  PharmacistName?: string;
  CancelledByName?: string;
  TotalLineItems: number;
  TotalUnits: number;
}

export interface DispensingVoucherItem {
  DetailID: number;
  SaleID: number;
  MedicineID: number;
  StockID?: number;
  LotNumber: string;
  ExpiryDate: string;
  Quantity: number;
  Price: number;
  DosageInstructions?: string;
  ProductName: string;
  GenericName: string;
  BrandName?: string;
  Dosage?: string;
  Form?: string;
}

export interface StockMovementItem {
  TransactionID: number;
  MovementID?: number;
  StockID: number;
  MedicineID: number;
  TransactionType: 'RECEIPT' | 'DISPENSE' | 'REVERSAL' | 'ADJUSTMENT';
  MovementLabel?: string;
  ReferenceNumber: string;
  ReferenceID?: number;
  Quantity: number;
  QuantityChange?: number;
  BatchNumber: string;
  LotNumber?: string;
  ExpiryDate: string;
  SourceFacility?: string;
  DestinationFacility?: string;
  Remarks: string;
  CreatedBy: number;
  CreatedDate: string;
  CreatedAt?: string;
  ProductName: string;
  GenericName: string;
  Dosage?: string;
  Form?: string;
  CreatedByName?: string;
}

export type PharmacyStockMovement = StockMovementItem;

export interface PrescriptionQueueItem {
  PrescriptionID: number;
  PrescriptionNumber: string;
  PrescriptionDate: string;
  Status: 'Pending' | 'Partially Dispensed' | 'Fully Dispensed' | 'Cancelled';
  ClinicalDiagnosis?: string;
  Notes?: string;
  PrescribingProviderName?: string;
  PatientID: number;
  PatientName: string;
  Barangay?: string;
  ContactNumber?: string;
  Age?: number;
  Gender?: string;
  EncounterID: number;
  EncounterNumber?: string;
  TotalItems: number;
  TotalPrescribedUnits: number;
  TotalDispensedUnits: number;
}

export interface PrescriptionFulfillmentBatch {
  StockID: number;
  LotNumber: string;
  ExpiryDate: string;
  Quantity: number;
  DaysToExpiry: number;
}

export interface PrescriptionFulfillmentItem {
  PrescriptionItemID: number;
  MedicineID: number;
  MedicineName: string;
  GenericName?: string;
  Dosage?: string;
  Frequency?: string;
  Duration?: string;
  DosageInstructions?: string;
  QuantityPrescribed: number;
  QuantityDispensed: number;
  remainingQuantity: number;
  ItemStatus: 'Pending' | 'Partially Dispensed' | 'Fully Dispensed' | 'Cancelled';
  availableStock: number;
  batches: PrescriptionFulfillmentBatch[];
}

export interface PrescriptionFulfillmentDetails {
  prescription: PrescriptionQueueItem;
  items: PrescriptionFulfillmentItem[];
}

export interface PharmacyRequestableMedicine {
  id: number;
  MedicineID: number;
  medicineCode?: string | null;
  MedicineCode?: string | null;
  productName: string;
  ProductName: string;
  genericName?: string | null;
  GenericName?: string | null;
  brandName?: string | null;
  BrandName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  unitName?: string | null;
  UnitName?: string | null;
  categoryName?: string | null;
  CategoryName?: string | null;
  status: string;
  pharmacyStock: number;
  warehouseStock: number;
}
