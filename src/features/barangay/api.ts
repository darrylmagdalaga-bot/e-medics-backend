import { API_URL } from '../../app/api-config';
import { 
  BarangayScope, BarangayLocation, BarangayStockRequest, 
  IncomingDistribution, DistributionLineItem, BarangayStockLot, 
  BarangayDisbursement, MovementLedgerEntry 
} from './types';

const API_BASE = `${API_URL}/api/barangay`;

function getHeaders(userId?: number | string | null) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'true'
  };
  if (userId) {
    headers['x-user-id'] = String(userId);
  }
  return headers;
}

export async function fetchBarangayProfile(userId?: number | null): Promise<BarangayScope> {
  const res = await fetch(`${API_BASE}/me`, { headers: getHeaders(userId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchBarangayLocations(): Promise<BarangayLocation[]> {
  const res = await fetch(`${API_BASE}/locations`, { headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchStockRequests(userId?: number | null, status?: string): Promise<BarangayStockRequest[]> {
  const url = status ? `${API_BASE}/stock-requests?status=${encodeURIComponent(status)}` : `${API_BASE}/stock-requests`;
  const res = await fetch(url, { headers: getHeaders(userId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchStockRequestDetails(requestId: number, userId?: number | null) {
  const res = await fetch(`${API_BASE}/stock-requests/${requestId}`, { headers: getHeaders(userId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitStockRequest(userId: number | null, payload: any) {
  const res = await fetch(`${API_BASE}/stock-requests`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create request' }));
    throw new Error(err.error || 'Failed to submit stock request');
  }
  return res.json();
}

export async function fetchIncomingDistributions(userId?: number | null, filters: { hasDiscrepancy?: boolean; status?: string } = {}): Promise<IncomingDistribution[]> {
  const params = new URLSearchParams();
  if (filters.hasDiscrepancy) params.append('hasDiscrepancy', '1');
  if (filters.status) params.append('status', filters.status);
  const queryStr = params.toString();
  const url = queryStr ? `${API_BASE}/distributions/incoming?${queryStr}` : `${API_BASE}/distributions/incoming`;
  const res = await fetch(url, { headers: getHeaders(userId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDistributionForReceipt(distributionId: number, userId?: number | null): Promise<{ distribution: IncomingDistribution, items: DistributionLineItem[] }> {
  const res = await fetch(`${API_BASE}/distributions/${distributionId}`, { headers: getHeaders(userId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function confirmDistributionReceipt(distributionId: number, userId: number | null, payload: any) {
  const res = await fetch(`${API_BASE}/distributions/${distributionId}/receive`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to confirm receipt' }));
    throw new Error(err.error || 'Failed to confirm distribution receipt');
  }
  return res.json();
}

export async function fetchBarangayInventory(userId?: number | null, search?: string): Promise<BarangayStockLot[]> {
  const url = search ? `${API_BASE}/inventory?search=${encodeURIComponent(search)}` : `${API_BASE}/inventory`;
  const res = await fetch(url, { headers: getHeaders(userId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchMovementLedger(userId?: number | null, filters: { type?: string; search?: string } = {}): Promise<MovementLedgerEntry[]> {
  const params = new URLSearchParams();
  if (filters.type) params.append('type', filters.type);
  if (filters.search) params.append('search', filters.search);
  const res = await fetch(`${API_BASE}/movements?${params.toString()}`, { headers: getHeaders(userId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function submitDisbursement(userId: number | null, payload: any) {
  const res = await fetch(`${API_BASE}/disburse`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to disburse medicines' }));
    throw new Error(err.error || 'Failed to disburse medicines');
  }
  return res.json();
}

export async function fetchDisbursements(userId?: number | null, search?: string): Promise<BarangayDisbursement[]> {
  const url = search ? `${API_BASE}/disbursements?search=${encodeURIComponent(search)}` : `${API_BASE}/disbursements`;
  const res = await fetch(url, { headers: getHeaders(userId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchDisbursementDetails(disbursementId: number, userId?: number | null): Promise<{ disbursement: BarangayDisbursement; items: any[] }> {
  const res = await fetch(`${API_BASE}/disbursements/${disbursementId}`, { headers: getHeaders(userId) });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchMedicinesCatalog() {
  const res = await fetch(`${API_URL}/api/medicines`, { headers: getHeaders() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function reverseDisbursement(disbursementId: number, userId: number | null, reason: string) {
  const res = await fetch(`${API_BASE}/disbursements/${disbursementId}/reverse`, {
    method: 'POST',
    headers: getHeaders(userId),
    body: JSON.stringify({ reason })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to reverse disbursement' }));
    throw new Error(err.error || 'Failed to reverse disbursement');
  }
  return res.json();
}
