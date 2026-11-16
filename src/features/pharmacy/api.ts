import { API_URL } from '../../app/api-config';
import { 
  PharmacyDashboardStats, 
  PharmacyStockItem, 
  IssuedDistribution, 
  DistributionDetailItem, 
  Patient, 
  DispensingRecord, 
  DispensingVoucherItem, 
  StockMovementItem,
  PrescriptionQueueItem,
  PrescriptionFulfillmentDetails,
  PharmacyStockRequest,
  PharmacyStockRequestItem,
  ReceiveDistributionLineConfirmation
} from './types';

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const userId = typeof window !== 'undefined' 
    ? (localStorage.getItem('pharma_userId') || localStorage.getItem('userId') || '1') 
    : '1';
  return {
    'x-user-id': userId,
    ...extraHeaders
  };
}

export interface StockMovementFilters {
  medicineId?: number;
  transactionType?: string;
  search?: string;
  batch?: string;
  reference?: string;
  startDate?: string;
  endDate?: string;
}

async function fetchStockMovementsInternal(filters: StockMovementFilters = {}): Promise<StockMovementItem[]> {
  const params = new URLSearchParams();
  if (filters.medicineId) params.append('medicineId', String(filters.medicineId));
  if (filters.transactionType && filters.transactionType !== 'all') params.append('transactionType', filters.transactionType);
  if (filters.search) params.append('search', filters.search);
  if (filters.batch) params.append('batch', filters.batch);
  if (filters.reference) params.append('reference', filters.reference);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  const qs = params.toString();
  const res = await fetch(`${API_URL}/api/pharmacy/movements${qs ? `?${qs}` : ''}`, {
    headers: getAuthHeaders()
  });
  if (!res.ok) {
    let errMsg = 'Failed to load pharmacy inventory movements';
    try {
      const errData = await res.json();
      if (errData?.error) errMsg = errData.error;
    } catch {
      // ignore json parse error
    }
    throw new Error(errMsg);
  }
  return res.json();
}

export const pharmacyApi = {
  // Dashboard
  getDashboardStats: async (): Promise<PharmacyDashboardStats> => {
    const res = await fetch(`${API_URL}/api/pharmacy/dashboard`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load pharmacy dashboard stats');
    return res.json();
  },

  // Inventory
  getInventory: async (filters: { search?: string; status?: string; medicineId?: number } = {}): Promise<PharmacyStockItem[]> => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.medicineId) params.append('medicineId', String(filters.medicineId));
    const res = await fetch(`${API_URL}/api/pharmacy/inventory?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load pharmacy inventory');
    return res.json();
  },

  // Issued Distributions
  getIssuedDistributions: async (): Promise<IssuedDistribution[]> => {
    const res = await fetch(`${API_URL}/api/pharmacy/distributions/issued`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load issued distributions');
    return res.json();
  },

  // Distribution Details
  getDistributionDetails: async (distributionId: string): Promise<{ distribution: IssuedDistribution; items: DistributionDetailItem[] }> => {
    const res = await fetch(`${API_URL}/api/pharmacy/distributions/${distributionId}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load distribution details');
    return res.json();
  },

  // Receive Distribution (supports per-item physical count verification, shortages, and damages)
  receiveDistribution: async (
    distributionId: string,
    remarksOrPayload?: string | { remarks?: string; items?: ReceiveDistributionLineConfirmation[]; discrepancyRemarks?: string },
    userId?: number
  ): Promise<{
    success: boolean;
    itemsReceived: number;
    hasDiscrepancy?: boolean;
    discrepancyRemarks?: string;
    totalIssuedUnits?: number;
    totalAcceptedUnits?: number;
  }> => {
    const resolvedUserId = userId || Number(localStorage.getItem('pharma_userId') || 1);
    const body = typeof remarksOrPayload === 'object' && remarksOrPayload !== null
      ? { userId: resolvedUserId, ...remarksOrPayload }
      : { userId: resolvedUserId, remarks: remarksOrPayload };
    const res = await fetch(`${API_URL}/api/pharmacy/distributions/${distributionId}/receive`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to receive warehouse distribution');
    return data;
  },

  // Pharmacy Stock Requests to Central Warehouse
  getStockRequests: async (status: string = 'ALL'): Promise<PharmacyStockRequest[]> => {
    const params = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
    const res = await fetch(`${API_URL}/api/pharmacy/stock-requests${params}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load pharmacy stock requests');
    return res.json();
  },

  getStockRequestDetails: async (requestId: number): Promise<{ request: PharmacyStockRequest; items: PharmacyStockRequestItem[] }> => {
    const res = await fetch(`${API_URL}/api/pharmacy/stock-requests/${requestId}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load stock request details');
    return res.json();
  },

  createStockRequest: async (payload: {
    priority: 'Routine' | 'Urgent' | 'Emergency';
    purpose: string;
    requiredDate?: string;
    remarks?: string;
    userId?: number;
    items: { medicineId: number; quantity: number }[];
  }): Promise<{ success: boolean; stockRequestId: number; requestNumber: string; status: string }> => {
    const resolvedUserId = payload.userId || Number(localStorage.getItem('pharma_userId') || localStorage.getItem('userId') || 1);
    const res = await fetch(`${API_URL}/api/pharmacy/stock-requests`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...payload, userId: resolvedUserId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to submit stock request to Central Warehouse');
    return data;
  },

  getMedicinesForRequest: async (search: string = ''): Promise<PharmacyRequestableMedicine[]> => {
    const params = search ? `?search=${encodeURIComponent(search)}` : '';
    const res = await fetch(`${API_URL}/api/pharmacy/medicines-for-request${params}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load requestable medicines catalog');
    return res.json();
  },

  getWarehouseMedicines: async (): Promise<PharmacyRequestableMedicine[]> => {
    const res = await fetch(`${API_URL}/api/pharmacy/medicines-for-request`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) {
      // Fallback to warehouse medicines endpoint if needed
      const fallback = await fetch(`${API_URL}/api/warehouse/medicines`, { headers: getAuthHeaders() });
      if (!fallback.ok) throw new Error('Failed to load medicines catalog');
      return fallback.json();
    }
    return res.json();
  },

  // Patient Search
  searchPatients: async (query: string = ''): Promise<Patient[]> => {
    const res = await fetch(`${API_URL}/api/pharmacy/patients/search?q=${encodeURIComponent(query)}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to search patients');
    return res.json();
  },

  // Eligible Batches (FEFO)
  getEligibleBatches: async (medicineId: number) => {
    const res = await fetch(`${API_URL}/api/pharmacy/medicines/${medicineId}/eligible-batches`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load eligible batches');
    return res.json();
  },

  // Preview FEFO Batch Allocation for Dispensing Cart
  previewAllocation: async (items: { medicineId: number; quantity: number }[]): Promise<any[]> => {
    const res = await fetch(`${API_URL}/api/pharmacy/preview-allocation`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ items })
    });
    if (!res.ok) throw new Error('Failed to preview FEFO allocation');
    return res.json();
  },

  // Dispense Medicines
  dispense: async (payload: {
    patientId: number;
    prescriptionNumber?: string;
    physicianName?: string;
    remarks?: string;
    userId?: number;
    items: { medicineId: number; quantity: number; dosageInstructions?: string }[];
  }) => {
    const resolvedUserId = payload.userId || Number(localStorage.getItem('pharma_userId') || 1);
    const res = await fetch(`${API_URL}/api/pharmacy/dispense`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...payload, userId: resolvedUserId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to dispense medicine');
    return data;
  },

  // Dispensing History
  getDispensingHistory: async (filters: { search?: string; status?: string; startDate?: string; endDate?: string } = {}): Promise<DispensingRecord[]> => {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const res = await fetch(`${API_URL}/api/pharmacy/dispensing/history?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load dispensing history');
    return res.json();
  },

  // Dispensing Voucher
  getDispensingDetails: async (saleId: number): Promise<{ dispensing: DispensingRecord; items: DispensingVoucherItem[] }> => {
    const res = await fetch(`${API_URL}/api/pharmacy/dispensing/${saleId}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load dispensing details');
    return res.json();
  },

  // Reverse Dispensing
  reverseDispensing: async (saleId: number, reason: string, userId?: number): Promise<{ success: boolean; message: string }> => {
    const resolvedUserId = userId || Number(localStorage.getItem('pharma_userId') || 1);
    const res = await fetch(`${API_URL}/api/pharmacy/dispensing/${saleId}/reverse`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ reason, userId: resolvedUserId })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to reverse dispensing record');
    return data;
  },

  // Stock Movement History — both getStockMovements and getMovements supported
  getStockMovements: async (filters: StockMovementFilters = {}): Promise<StockMovementItem[]> => {
    return fetchStockMovementsInternal(filters);
  },

  getMovements: async (filters: StockMovementFilters = {}): Promise<StockMovementItem[]> => {
    return fetchStockMovementsInternal(filters);
  },

  // Prescriptions Queue & Fulfillment
  getPrescriptionsQueue: async (filters: { status?: string; search?: string; startDate?: string; endDate?: string } = {}): Promise<PrescriptionQueueItem[]> => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    const res = await fetch(`${API_URL}/api/pharmacy/prescriptions?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load prescriptions queue');
    return res.json();
  },

  getPrescriptionFulfillmentDetails: async (prescriptionId: number | string): Promise<PrescriptionFulfillmentDetails> => {
    const res = await fetch(`${API_URL}/api/pharmacy/prescriptions/${prescriptionId}/fulfillment`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error('Failed to load prescription fulfillment details');
    return res.json();
  },

  dispensePrescription: async (prescriptionId: number | string, payload: {
    items: { prescriptionItemId: number; quantity: number }[];
    remarks?: string;
    userId?: number;
  }) => {
    const resolvedUserId = payload.userId || Number(localStorage.getItem('pharma_userId') || 1);
    const res = await fetch(`${API_URL}/api/pharmacy/prescriptions/${prescriptionId}/dispense`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ ...payload, userId: resolvedUserId })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'Failed to dispense prescription');
    return result;
  }
};
