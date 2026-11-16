/**
 * eMEDICS — Official System Terminology Dictionary
 * Catbalogan City Health Office — Integrated Healthcare Supply Chain
 *
 * This module defines the canonical user-facing terminology across the
 * Central Warehouse, City Pharmacy, and Barangay Health Worker (BHW) portals.
 * Internal database tables, column names, and API routes remain unchanged
 * to preserve backward compatibility and audit integrity.
 */

export type EMedicsPortal = 'Warehouse' | 'Pharmacy' | 'BHW' | 'All Portals';

export interface TerminologyEntry {
  key: string;
  officialTerm: string;
  activity: string;
  description: string;
  applicablePortals: EMedicsPortal[];
  userFacingButtons: string[];
  statusLabels: string[];
  reportHeading: string;
  internalTechnicalRef: string;
  replacedLegacyTerms: string[];
}

export const EMEDICS_TERMINOLOGY_DICTIONARY: Record<string, TerminologyEntry> = {
  STOCK_REQUEST: {
    key: 'STOCK_REQUEST',
    officialTerm: 'Stock Request',
    activity: 'Requesting medicines from Warehouse',
    description:
      'Formal replenishment requisition submitted by City Pharmacy or a Barangay Health Station to the Central Warehouse.',
    applicablePortals: ['Warehouse', 'Pharmacy', 'BHW'],
    userFacingButtons: ['Request Stock', 'New Stock Request', 'Submit Stock Request'],
    statusLabels: ['Submitted', 'Under Review', 'Approved', 'Rejected', 'Partially Fulfilled', 'Fulfilled'],
    reportHeading: 'Facility Stock Requests',
    internalTechnicalRef: 'Warehouse_StockRequests / /api/*/stock-requests',
    replacedLegacyTerms: ['Station Stock Requisition', 'Requisition Request', 'Indent'],
  },
  REQUEST_REVIEW: {
    key: 'REQUEST_REVIEW',
    officialTerm: 'Request Review',
    activity: 'Reviewing requests in Warehouse',
    description:
      'Warehouse verification of requested medicine quantities against available FEFO batch stock and facility priority.',
    applicablePortals: ['Warehouse'],
    userFacingButtons: ['Review Request', 'Inspect Request Items'],
    statusLabels: ['Submitted', 'Under Review'],
    reportHeading: 'Stock Request Review Log',
    internalTechnicalRef: 'Warehouse_StockRequests.Status',
    replacedLegacyTerms: ['Manage Request', 'Inspect Requisition'],
  },
  APPROVE_REQUEST: {
    key: 'APPROVE_REQUEST',
    officialTerm: 'Approve Request',
    activity: 'Accepting a stock request',
    description:
      'Warehouse authorization of a facility Stock Request, clearing it for FEFO Stock Allocation and Stock Distribution.',
    applicablePortals: ['Warehouse'],
    userFacingButtons: ['Approve Request'],
    statusLabels: ['Approved'],
    reportHeading: 'Approved Stock Requests',
    internalTechnicalRef: 'PUT /api/warehouse/stock-requests/:id/status (Approved)',
    replacedLegacyTerms: ['Accept Request', 'Authorize Requisition'],
  },
  REJECT_REQUEST: {
    key: 'REJECT_REQUEST',
    officialTerm: 'Reject Request',
    activity: 'Declining a stock request',
    description:
      'Formal declination of a Stock Request by Warehouse personnel with a recorded reason.',
    applicablePortals: ['Warehouse'],
    userFacingButtons: ['Reject Request'],
    statusLabels: ['Rejected'],
    reportHeading: 'Rejected Stock Requests',
    internalTechnicalRef: 'PUT /api/warehouse/stock-requests/:id/status (Rejected)',
    replacedLegacyTerms: ['Decline Request', 'Deny Requisition'],
  },
  STOCK_ALLOCATION: {
    key: 'STOCK_ALLOCATION',
    officialTerm: 'Stock Allocation',
    activity: 'Preparing medicine batches for release',
    description:
      'Automated or verified selection of non-expired medicine batches following First-Expired, First-Out (FEFO) rules.',
    applicablePortals: ['Warehouse'],
    userFacingButtons: ['Allocate FEFO Batches', 'Preview Stock Allocation'],
    statusLabels: ['Draft', 'Allocated'],
    reportHeading: 'FEFO Batch Stock Allocation',
    internalTechnicalRef: 'Warehouse_DistributionItems / FEFO Allocation Engine',
    replacedLegacyTerms: ['Lot Picking', 'Batch Assignment'],
  },
  STOCK_DISTRIBUTION: {
    key: 'STOCK_DISTRIBUTION',
    officialTerm: 'Stock Distribution',
    activity: 'Sending medicines to Pharmacy or Barangay',
    description:
      'Outbound dispatch of allocated medicine batches from the Central Warehouse to City Pharmacy or a Barangay Health Station.',
    applicablePortals: ['Warehouse', 'Pharmacy', 'BHW'],
    userFacingButtons: ['Issue Stock Distribution', 'Confirm & Issue FEFO Batches', 'New Distribution'],
    statusLabels: ['Draft', 'Issued', 'Received', 'Received with Discrepancy'],
    reportHeading: 'Central Warehouse Stock Distributions',
    internalTechnicalRef: 'Warehouse_Distributions / /api/warehouse/distributions',
    replacedLegacyTerms: ['Stock Release', 'Dispatch Shipment', 'Outbound Transfer'],
  },
  CONFIRM_RECEIPT: {
    key: 'CONFIRM_RECEIPT',
    officialTerm: 'Confirm Receipt',
    activity: 'Confirming physical arrival of distributed stock',
    description:
      'Destination facility verification of physical quantities received against Warehouse Issued Qty, recording Accepted, Damaged, and Shortage quantities.',
    applicablePortals: ['Pharmacy', 'BHW'],
    userFacingButtons: ['Confirm Receipt', 'Inspect & Confirm Receipt', 'Accept All Issued Qty'],
    statusLabels: ['Awaiting Receipt', 'Received', 'Received with Discrepancy'],
    reportHeading: 'Confirmed Distribution Receipts',
    internalTechnicalRef: 'POST /api/pharmacy/distributions/:id/receive & POST /api/barangay/distributions/:id/receive',
    replacedLegacyTerms: ['Verify & Ingest', 'Inspect & Ingest Stock', 'Ingest Shipment'],
  },
  RECEIVING_DISCREPANCY: {
    key: 'RECEIVING_DISCREPANCY',
    officialTerm: 'Receiving Discrepancy',
    activity: 'Recording shortage or damage during receipt',
    description:
      'Structured variance record created when Accepted Qty is less than Issued Qty due to transit damage or physical shortage.',
    applicablePortals: ['Warehouse', 'Pharmacy', 'BHW'],
    userFacingButtons: ['Log Receiving Discrepancy', 'View Receiving Discrepancies'],
    statusLabels: ['Open Discrepancy', 'Under Investigation', 'Resolved'],
    reportHeading: 'Receiving Discrepancies & Transit Variances',
    internalTechnicalRef: 'Warehouse_DistributionItems (QuantityDamaged, QuantityShortage, DiscrepancyNotes)',
    replacedLegacyTerms: ['Transit Variance', 'Ingestion Shortage'],
  },
  INVENTORY_RECEIPT: {
    key: 'INVENTORY_RECEIPT',
    officialTerm: 'Inventory Receipt',
    activity: 'Adding received stock into destination inventory',
    description:
      'Ledger transaction that increments destination facility batch inventory strictly by the verified Accepted Qty upon Confirm Receipt.',
    applicablePortals: ['Warehouse', 'Pharmacy', 'BHW'],
    userFacingButtons: ['Record Inventory Receipt', 'Receive Delivery'],
    statusLabels: ['RECEIPT', 'Posted'],
    reportHeading: 'Facility Inventory Receipts',
    internalTechnicalRef: 'Pharmacy_Inventory / Barangay_Inventory / RECEIPT Ledger Entry',
    replacedLegacyTerms: ['Stock Ingestion', 'Batch Intake'],
  },
  MEDICINE_DISPENSING: {
    key: 'MEDICINE_DISPENSING',
    officialTerm: 'Medicine Dispensing',
    activity: 'Giving medicines to patients at Pharmacy',
    description:
      'Outpatient clinical dispensing of medicines to registered patients at the City Pharmacy with FEFO deduction and printable Dispensing Voucher.',
    applicablePortals: ['Pharmacy'],
    userFacingButtons: ['Dispense Medicine', 'Confirm & Dispense', 'Print Dispensing Voucher'],
    statusLabels: ['Completed', 'Dispensed', 'Reversed'],
    reportHeading: 'City Pharmacy Medicine Dispensing',
    internalTechnicalRef: 'Sales / SaleItems / /api/pharmacy/dispense',
    replacedLegacyTerms: ['Pharmacy Release', 'POS Sale', 'Checkout'],
  },
  PATIENT_MEDICINE_RELEASE: {
    key: 'PATIENT_MEDICINE_RELEASE',
    officialTerm: 'Patient Medicine Release',
    activity: 'Giving medicines to residents at Barangay Health Station',
    description:
      'Release of medicines to barangay residents at a Barangay Health Station with FEFO batch deduction and printable Medicine Release Voucher.',
    applicablePortals: ['BHW'],
    userFacingButtons: ['Release Medicine', 'Release to Resident', 'Confirm Medicine Release'],
    statusLabels: ['Completed', 'Reversed'],
    reportHeading: 'Barangay Patient Medicine Releases',
    internalTechnicalRef: 'Barangay_Disbursements / /api/barangay/disburse',
    replacedLegacyTerms: ['Patient Disbursement', 'Disburse Stock', 'Disburse to Resident'],
  },
  TRANSACTION_REVERSAL: {
    key: 'TRANSACTION_REVERSAL',
    officialTerm: 'Transaction Reversal',
    activity: 'Returning an issued transaction with reason',
    description:
      'Authorized compensating transaction that restores deducted batch quantities to inventory and records an immutable REVERSAL audit entry.',
    applicablePortals: ['Pharmacy', 'BHW'],
    userFacingButtons: ['Reverse Transaction', 'Confirm Transaction Reversal'],
    statusLabels: ['Reversed', 'REVERSAL'],
    reportHeading: 'Authorized Transaction Reversals',
    internalTechnicalRef: 'POST /api/pharmacy/dispensing/:id/reverse & POST /api/barangay/disbursements/:id/reverse',
    replacedLegacyTerms: ['Void Sale', 'Reverse Disbursement', 'Cancel Release'],
  },
  PHYSICAL_INVENTORY_COUNT: {
    key: 'PHYSICAL_INVENTORY_COUNT',
    officialTerm: 'Physical Inventory Count',
    activity: 'Counting actual stock in storage',
    description:
      'Scheduled or spot physical audit of batch-level quantities in storage compared against system book balances.',
    applicablePortals: ['Warehouse'],
    userFacingButtons: ['New Physical Count', 'Open Count Sheet', 'Complete Physical Count'],
    statusLabels: ['In Progress', 'Completed', 'Verified'],
    reportHeading: 'Physical Inventory Count Sessions',
    internalTechnicalRef: 'Warehouse_PhysicalCounts / /api/warehouse/physical-counts',
    replacedLegacyTerms: ['Stocktake', 'Cycle Count'],
  },
  STOCK_ADJUSTMENT: {
    key: 'STOCK_ADJUSTMENT',
    officialTerm: 'Stock Adjustment',
    activity: 'Correcting a verified variance',
    description:
      'Authorized adjustment of batch balance resulting from a verified Physical Inventory Count variance or expired quarantine.',
    applicablePortals: ['Warehouse'],
    userFacingButtons: ['Post Stock Adjustment', 'Review Stock Adjustments'],
    statusLabels: ['Posted', 'ADJUSTMENT'],
    reportHeading: 'Verified Stock Adjustments',
    internalTechnicalRef: 'Warehouse_StockAdjustments / Warehouse_InventoryTransactions',
    replacedLegacyTerms: ['Balance Correction', 'Manual Write-off'],
  },
  INVENTORY_MOVEMENT: {
    key: 'INVENTORY_MOVEMENT',
    officialTerm: 'Inventory Movement',
    activity: 'Tracking stock additions and deductions',
    description:
      'Immutable chronological audit trail of every stock addition (Inventory Receipt, Reversal) and deduction (Stock Distribution, Medicine Dispensing, Patient Medicine Release, Stock Adjustment).',
    applicablePortals: ['Warehouse', 'Pharmacy', 'BHW'],
    userFacingButtons: ['View Inventory Movements', 'Export Movement Ledger'],
    statusLabels: ['RECEIPT', 'ISSUE', 'DISPENSE', 'DISBURSEMENT', 'REVERSAL', 'ADJUSTMENT'],
    reportHeading: 'Consolidated Inventory Movements',
    internalTechnicalRef: 'Warehouse_InventoryTransactions / Pharmacy_StockMovements / Barangay_InventoryMovements',
    replacedLegacyTerms: ['Inventory Transactions', 'Movement Ledger', 'Stock Log'],
  },
  INVENTORY_RECONCILIATION: {
    key: 'INVENTORY_RECONCILIATION',
    officialTerm: 'Inventory Reconciliation',
    activity: 'Checking stock accuracy across records',
    description:
      'Cross-facility verification comparing Warehouse Issued Qty against Destination Accepted Qty, Damaged Qty, Shortage Qty, and book vs. ledger balances.',
    applicablePortals: ['Warehouse'],
    userFacingButtons: ['Open Reconciliation', 'Resolve Discrepancy'],
    statusLabels: ['Matched', 'Variance Detected', 'Reconciled'],
    reportHeading: 'Supply Chain Inventory Reconciliation',
    internalTechnicalRef: '/api/warehouse/reconciliation/*',
    replacedLegacyTerms: ['Stock Balancing', 'Audit Matching'],
  },
};

/**
 * Standardized Quantity Column Labels for Tables, Modals, and Reports
 */
export const STANDARD_QUANTITY_LABELS = {
  requested: 'Requested Qty',
  approved: 'Approved Qty',
  issued: 'Issued Qty',
  accepted: 'Accepted Qty',
  damaged: 'Damaged Qty',
  shortage: 'Shortage Qty',
  remaining: 'Remaining Qty',
} as const;

/**
 * Helper to format facility source type clearly in Warehouse views
 */
export function getFacilityTypeBadgeInfo(facilityName?: string, locationId?: number): {
  typeLabel: 'City Pharmacy' | 'Barangay Health Station';
  shortBadge: string;
  badgeClass: string;
} {
  const isPharmacy =
    locationId === 2 ||
    (facilityName || '').toLowerCase().includes('pharmacy');

  if (isPharmacy) {
    return {
      typeLabel: 'City Pharmacy',
      shortBadge: 'City Pharmacy',
      badgeClass:
        'bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30',
    };
  }

  return {
    typeLabel: 'Barangay Health Station',
    shortBadge: 'Barangay Health Station',
    badgeClass:
      'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30',
  };
}

