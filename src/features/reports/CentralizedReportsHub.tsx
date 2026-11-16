import React, { useState, useEffect, useRef } from 'react';
import {
  BarChart3, FileText, Download, Printer, RefreshCw, Search,
  Calendar, MapPin, AlertCircle, ArrowUpRight, CheckCircle2,
  XCircle, Filter, Truck, Pill, Building2, ShieldCheck, History,
  Layers, Package, AlertTriangle, UserCheck
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import { API_URL } from '../../app/api-config';

interface ReportsHubProps {
  role?: string;
  userId?: number | null;
}

type ReportType = 
  | 'warehouse-distributions'
  | 'pharmacy-releases'
  | 'barangay-receipts'
  | 'barangay-disbursements'
  | 'barangay-inventory'
  | 'unreceived-distributions'
  | 'distribution-discrepancies'
  | 'batch-traceability'
  | 'personnel-accountability'
  | 'citywide-movements'
  | 'stock-requests-traceability';

interface ReportMeta {
  id: ReportType;
  title: string;
  category: 'Warehouse' | 'Pharmacy' | 'Barangay' | 'Audit & Compliance';
  description: string;
  icon: any;
}

const REPORT_TABS: ReportMeta[] = [
  {
    id: 'warehouse-distributions',
    title: '1. Central Warehouse Stock Distributions',
    category: 'Warehouse',
    description: 'Outbound Stock Distributions from Central Warehouse to City Pharmacy and Barangay Health Stations.',
    icon: Truck
  },
  {
    id: 'pharmacy-releases',
    title: '2. City Pharmacy Medicine Dispensing',
    category: 'Pharmacy',
    description: 'Patient prescriptions and outpatient Medicine Dispensing vouchers at City Pharmacy.',
    icon: Pill
  },
  {
    id: 'barangay-receipts',
    title: '3. Barangay Inventory Receipts',
    category: 'Barangay',
    description: 'Confirmed Distribution Receipts and verified Inventory Receipts across all 57 Barangay Health Stations.',
    icon: CheckCircle2
  },
  {
    id: 'barangay-disbursements',
    title: '4. Barangay Patient Medicine Releases',
    category: 'Barangay',
    description: 'Patient Medicine Releases at barangay level, including authorized Transaction Reversals.',
    icon: Building2
  },
  {
    id: 'barangay-inventory',
    title: '5. Barangay Inventory Balances',
    category: 'Barangay',
    description: 'Live batch-level Remaining Qty balances, expiration risk alerts, and stock values per station.',
    icon: Layers
  },
  {
    id: 'stock-requests-traceability',
    title: '5. Stock Request Lifecycle Traceability',
    category: 'Audit & Compliance',
    description: 'Complete lifecycle audit from Pharmacy Stock Request, FEFO batch reservation, Warehouse Issuance, to Physical Receipt Confirmation.',
    icon: Layers
  },
  {
    id: 'unreceived-distributions',
    title: '6. Distributions Awaiting Receipt',
    category: 'Audit & Compliance',
    description: 'Stock Distributions issued by Warehouse that remain awaiting Confirm Receipt at destination.',
    icon: AlertTriangle
  },
  {
    id: 'distribution-discrepancies',
    title: '7. Receiving Discrepancies',
    category: 'Audit & Compliance',
    description: 'Physical count Shortage Qty, Damaged Qty, and variances between Issued Qty and Accepted Qty.',
    icon: XCircle
  },
  {
    id: 'batch-traceability',
    title: '8. End-to-End Batch Traceability',
    category: 'Audit & Compliance',
    description: 'Full audit genealogy from Warehouse Inventory Receipt down to individual patient voucher.',
    icon: Package
  },
  {
    id: 'personnel-accountability',
    title: '9. Personnel Accountability',
    category: 'Audit & Compliance',
    description: 'Supply chain actions attributable to specific authorized Warehouse, Pharmacy, and BHW personnel.',
    icon: UserCheck
  },
  {
    id: 'citywide-movements',
    title: '10. Consolidated Inventory Movements',
    category: 'Audit & Compliance',
    description: 'City-wide immutable Inventory Movement ledger unifying Warehouse, Pharmacy, and Barangay records.',
    icon: History
  }
];

export function CentralizedReportsHub({ role = 'admin', userId = 1 }: ReportsHubProps) {
  const [activeReport, setActiveReport] = useState<ReportType>('warehouse-distributions');
  const [reportData, setReportData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [locationId, setLocationId] = useState('');
  const [search, setSearch] = useState('');
  const [traceLotNumber, setTraceLotNumber] = useState('LOT-TEST-2026');
  const [statusFilter, setStatusFilter] = useState('');
  const [stations, setStations] = useState<any[]>([]);

  const printAreaRef = useRef<HTMLDivElement>(null);

  // Fetch stations for dropdown
  useEffect(() => {
    fetch(`${API_URL}/api/barangay/locations`)
      .then(res => res.json())
      .then(data => setStations(data))
      .catch(err => console.error('Failed to load stations:', err));
  }, []);

  const fetchReport = async () => {
    setIsLoading(true);
    try {
      let url = `${API_URL}/api/reports/${activeReport}`;
      const params = new URLSearchParams();

      if (activeReport === 'batch-traceability') {
        const lot = traceLotNumber.trim() || 'ALL';
        url = `${API_URL}/api/reports/batch-traceability/${encodeURIComponent(lot)}`;
      } else {
        if (startDate) params.append('startDate', startDate);
        if (endDate) params.append('endDate', endDate);
        if (locationId) params.append('locationId', locationId);
        if (search) params.append('search', search);
        if (statusFilter) params.append('status', statusFilter);
        if (params.toString()) url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to fetch report' }));
        throw new Error(err.error || 'Server error loading report');
      }

      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      toast.error('Report error: ' + err.message);
      setReportData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, [activeReport]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!reportData || !reportData.data || reportData.data.length === 0) {
      toast.error('No tabular data available to export.');
      return;
    }

    const rows = reportData.data;
    const headers = Object.keys(rows[0]);
    const csvContent = [
      headers.join(','),
      ...rows.map((row: any) => 
        headers.map(h => {
          const val = row[h] === null || row[h] === undefined ? '' : String(row[h]);
          return `"${val.replace(/"/g, '""')}"`;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `eMEDICS_${activeReport}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Report exported to CSV.');
  };

  const activeMeta = REPORT_TABS.find(t => t.id === activeReport) || REPORT_TABS[0];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider bg-primary/10 text-primary rounded-lg border border-primary/20">
              City Health Office Audit Suite
            </span>
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 rounded-lg border border-blue-500/20">
              10 Consolidated Reports
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-2">
            Centralized Medicine Release & Distribution Audit
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Real-time verification, cross-facility supply chain reconciliation, and verifiable batch custody records.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchReport}
            disabled={isLoading}
            className="rounded-xl border-border h-10 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            variant="outline"
            onClick={handleExportCSV}
            disabled={!reportData || !reportData.data}
            className="rounded-xl border-border h-10 text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export CSV
          </Button>

          <Button
            onClick={handlePrint}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground h-10 text-xs font-bold shadow-sm"
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print Report
          </Button>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {REPORT_TABS.map(tab => {
          const Icon = tab.icon;
          const isSelected = activeReport === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveReport(tab.id)}
              className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                isSelected
                  ? 'bg-primary/10 border-primary shadow-sm text-primary'
                  : 'bg-card border-border/60 hover:bg-muted/40 text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-2">
                <span className="text-[10px] font-black uppercase tracking-wider opacity-75">{tab.category}</span>
                <Icon className={`w-4 h-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
              </div>
              <p className="text-xs font-bold leading-tight line-clamp-2">{tab.title}</p>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <Card className="rounded-2xl border-border/50 shadow-sm p-4 bg-card">
        <div className="flex flex-col lg:flex-row items-center gap-3">
          {/* Search */}
          <div className="relative w-full lg:flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search reference #, lot #, medicine, or recipient..."
              className="pl-9 text-xs rounded-xl h-10 border-border/60"
            />
          </div>

          {/* Conditional Lot Number for Traceability */}
          {activeReport === 'batch-traceability' && (
            <div className="w-full lg:w-64">
              <Input
                value={traceLotNumber}
                onChange={e => setTraceLotNumber(e.target.value)}
                placeholder="Enter Lot # (e.g. LOT-2026-001)"
                className="text-xs rounded-xl h-10 border-border/60 font-mono font-bold"
              />
            </div>
          )}

          {/* Station dropdown */}
          {activeReport !== 'batch-traceability' && (
            <div className="w-full lg:w-56">
              <select
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-xs text-foreground focus:outline-none"
              >
                <option value="">All Health Stations</option>
                {stations.map(st => (
                  <option key={st.LocationID} value={st.LocationID}>
                    {st.LocationName}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Date Range */}
          {activeReport !== 'batch-traceability' && activeReport !== 'barangay-inventory' && (
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <Input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="text-xs rounded-xl h-10 border-border/60 w-36"
                title="Start Date"
              />
              <span className="text-xs text-muted-foreground font-bold">to</span>
              <Input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="text-xs rounded-xl h-10 border-border/60 w-36"
                title="End Date"
              />
            </div>
          )}

          <Button
            onClick={fetchReport}
            className="w-full lg:w-auto h-10 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-5 shrink-0"
          >
            Apply Filters
          </Button>
        </div>
      </Card>

      {/* Summary KPI Cards */}
      {reportData && reportData.summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {Object.entries(reportData.summary).map(([key, val]: [string, any]) => {
            const formattedKey = key.replace(/([A-Z])/g, ' $1').trim();
            const isNumeric = typeof val === 'number';
            return (
              <Card key={key} className="rounded-2xl border-border/50 shadow-sm p-4 bg-card">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{formattedKey}</p>
                <p className="text-2xl font-black text-foreground mt-2">
                  {isNumeric ? Number(val).toLocaleString() : String(val)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Database verified record</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Printable Report View */}
      <div ref={printAreaRef} className="space-y-4">
        {/* Printable Header */}
        <div className="hidden print:block text-center border-b pb-4 mb-4">
          <h2 className="text-xl font-bold uppercase tracking-tight">Republic of the Philippines</h2>
          <p className="text-xs">City Health Office â€¢ Catbalogan City, Samar</p>
          <h3 className="text-base font-black mt-2">{reportData?.reportTitle || activeMeta.title}</h3>
          <p className="text-[10px] text-muted-foreground">Generated on {new Date().toLocaleString()}</p>
        </div>

        {/* Traceability Specialized Display */}
        {activeReport === 'batch-traceability' && reportData ? (
          <div className="space-y-4">
            {/* Batch Status Card */}
            <Card className="rounded-2xl border-border/50 shadow-sm p-5 bg-card">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary rounded-md">
                    Target Batch Custody Audit
                  </span>
                  <h3 className="text-lg font-black text-foreground mt-1">Lot: {reportData.lotNumber}</h3>
                  <p className="text-xs text-muted-foreground">
                    Origin Medicine: <strong>{reportData.medicine?.ProductName || 'Multi-batch'}</strong>
                  </p>
                </div>

                  <div className="flex items-center gap-6 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Warehouse Inventory Receipt</span>
                    <span className="text-base font-black text-foreground">{reportData.summary?.totalReceivedInWarehouse || 0} units</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Remaining Qty</span>
                    <span className="text-base font-black text-emerald-600">
                      {(reportData.summary?.currentInWarehouse || 0) + (reportData.summary?.currentInPharmacy || 0) + (reportData.summary?.currentInBarangays || 0)} units
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Dispensed / Released Qty</span>
                    <span className="text-base font-black text-primary">
                      {(reportData.summary?.totalDispensedInPharmacy || 0) + (reportData.summary?.totalDisbursedInBarangays || 0)} units
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Traceability Steps Timeline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Central Warehouse Receipts */}
              <Card className="rounded-2xl border-border/50 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h4 className="text-xs font-black uppercase text-foreground">1. Warehouse Inventory Receipt</h4>
                  <Truck className="w-3.5 h-3.5 text-primary" />
                </div>
                {(!reportData.warehouseReceipts || reportData.warehouseReceipts.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">No warehouse intake records for this lot.</p>
                ) : (
                  reportData.warehouseReceipts.map((r: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs space-y-1 mb-2">
                      <div className="font-bold text-foreground">PO: {r.PurchaseOrderNumber || 'Direct Stocking'}</div>
                      <div className="text-[11px] text-muted-foreground">Supplier: {r.SupplierName || 'DOH RO8 Supply'}</div>
                      <div className="text-emerald-600 font-bold">Accepted Qty: {r.Quantity} units</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(r.ReceivedDate).toLocaleDateString()}</div>
                    </div>
                  ))
                )}
              </Card>

              {/* Warehouse Distributions */}
              <Card className="rounded-2xl border-border/50 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h4 className="text-xs font-black uppercase text-foreground">2. Stock Distributions</h4>
                  <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
                </div>
                {(!reportData.distributions || reportData.distributions.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">No outbound Stock Distributions recorded for this lot.</p>
                ) : (
                  reportData.distributions.map((d: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs space-y-1 mb-2">
                      <div className="font-bold text-foreground">{d.DistributionNumber} → {d.DestinationName}</div>
                      <div className="text-blue-600 font-bold">Issued Qty: {d.QuantityIssued} | Accepted Qty: {d.QuantityReceived}</div>
                      <div className="text-[10px] text-muted-foreground">Status: <strong className="uppercase">{d.Status}</strong></div>
                      <div className="text-[10px] text-muted-foreground">{new Date(d.ReleasedDate).toLocaleDateString()}</div>
                    </div>
                  ))
                )}
              </Card>

              {/* Barangay Patient Disbursements */}
              <Card className="rounded-2xl border-border/50 shadow-sm p-4">
                <div className="flex items-center justify-between mb-3 border-b pb-2">
                  <h4 className="text-xs font-black uppercase text-foreground">3. Patient Medicine Releases</h4>
                  <Building2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                {(!reportData.barangayDisbursements || reportData.barangayDisbursements.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic">No barangay Patient Medicine Releases yet.</p>
                ) : (
                  reportData.barangayDisbursements.map((b: any, idx: number) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-muted/20 border border-border/40 text-xs space-y-1 mb-2">
                      <div className="font-bold text-foreground">Voucher: {b.DisbursementNumber}</div>
                      <div className="text-foreground">Resident: <strong>{b.RecipientName}</strong> ({b.BarangayName})</div>
                      <div className="text-emerald-600 font-bold">Released Qty: {b.Quantity} units ({b.DosageInstructions || 'As directed'})</div>
                      <div className="text-[10px] text-muted-foreground">{new Date(b.DisbursementDate).toLocaleDateString()}</div>
                    </div>
                  ))
                )}
              </Card>
            </div>
          </div>
        ) : (
          /* General Tabular Report View */
          <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-bold uppercase tracking-wider">
                  <tr>
                    {reportData && reportData.data && reportData.data.length > 0 ? (
                      Object.keys(reportData.data[0]).map(col => {
                        const colLabelMap: Record<string, string> = {
                          QuantityRequested: 'Requested Qty',
                          RequestedQuantity: 'Requested Qty',
                          QuantityApproved: 'Approved Qty',
                          QuantityIssued: 'Issued Qty',
                          TotalQuantityIssued: 'Issued Qty',
                          QuantityReceived: 'Accepted Qty',
                          TotalQuantityReceived: 'Accepted Qty',
                          QuantityDamaged: 'Damaged Qty',
                          QuantityShortage: 'Shortage Qty',
                          QuantityOnHand: 'Remaining Qty',
                          QuantityAvailable: 'Remaining Qty',
                        };
                        const displayHeader = colLabelMap[col] || col.replace(/([A-Z])/g, ' $1').trim();
                        return (
                          <th key={col} className="py-3 px-3.5 whitespace-nowrap">
                            {displayHeader}
                          </th>
                        );
                      })
                    ) : (
                      <th className="py-3 px-3.5">Records</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {isLoading ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground">
                        <RefreshCw className="w-6 h-6 mx-auto animate-spin mb-2" />
                        <p className="font-semibold text-xs">Loading report records...</p>
                      </td>
                    </tr>
                  ) : !reportData || !reportData.data || reportData.data.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-muted-foreground">
                        <FileText className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                        <p className="font-semibold text-sm text-foreground">No records found for selected criteria</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Adjust your date range or station filter.</p>
                      </td>
                    </tr>
                  ) : (
                    reportData.data.map((row: any, rIdx: number) => (
                      <tr key={rIdx} className="hover:bg-muted/20 transition-colors">
                        {Object.entries(row).map(([col, val]: [string, any], cIdx: number) => {
                          const isDate = typeof val === 'string' && val.includes('T') && !isNaN(Date.parse(val));
                          const isNum = typeof val === 'number';
                          const isStatus = col.toLowerCase().includes('status');

                          return (
                            <td key={cIdx} className={`py-2.5 px-3.5 whitespace-nowrap ${isNum ? 'font-mono' : ''}`}>
                              {isStatus ? (
                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  val === 'Received' || val === 'Good' || val === 'Completed' || val === 'Active'
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                                    : val === 'Reversed' || val === 'Expired' || val === 'Cancelled'
                                    ? 'bg-destructive/10 text-destructive border border-destructive/20'
                                    : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                }`}>
                                  {String(val)}
                                </span>
                              ) : isDate ? (
                                <span className="text-muted-foreground">
                                  {new Date(val).toLocaleDateString()} {new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : val === null || val === undefined ? (
                                <span className="text-muted-foreground/50">-</span>
                              ) : (
                                <span className="text-foreground font-medium">{String(val)}</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
