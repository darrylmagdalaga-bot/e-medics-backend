import React, { useState, useEffect } from 'react';
import { 
  Activity, Search, ShieldCheck, AlertTriangle, ArrowRight, 
  Truck, Building2, Package, Users, Calendar, Filter, 
  RotateCw, CheckCircle2, XCircle, ArrowUpRight, Check
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { toast } from 'sonner';
import { API_URL } from '../../../../app/api-config';

export function WarehouseTraceability() {
  const [activeTab, setActiveTab] = useState<'lot' | 'audit'>('lot');
  const [lotInput, setLotInput] = useState('');
  const [selectedLot, setSelectedLot] = useState<string>('');
  const [traceData, setTraceData] = useState<any | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Distributions Audit State
  const [distAuditList, setDistAuditList] = useState<any[]>([]);
  const [auditSearch, setAuditSearch] = useState('');
  const [discrepancyOnly, setDiscrepancyOnly] = useState(false);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

  // Available lots list for quick select
  const [availableLots, setAvailableLots] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/warehouse/inventory`)
      .then(res => res.json())
      .then(lots => setAvailableLots(lots.slice(0, 15)))
      .catch(console.error);

    loadDistributionAudit();
  }, []);

  const handleTraceLot = async (lotToQuery?: string) => {
    const lot = (lotToQuery || lotInput || selectedLot).trim();
    if (!lot) {
      toast.error('Please enter or select a Lot / Batch Number.');
      return;
    }

    setIsSearching(true);
    setSelectedLot(lot);
    setLotInput(lot);

    try {
      const res = await fetch(`${API_URL}/api/traceability/lot/${encodeURIComponent(lot)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Trace failed' }));
        throw new Error(err.error || 'Failed to trace lot number');
      }
      const data = await res.json();
      setTraceData(data);
      toast.success(`Lot ${lot} successfully traced across all facilities!`);
    } catch (err: any) {
      toast.error(err.message || 'Trace query failed');
      setTraceData(null);
    } finally {
      setIsSearching(false);
    }
  };

  const loadDistributionAudit = async () => {
    setIsLoadingAudit(true);
    try {
      const url = discrepancyOnly 
        ? `${API_URL}/api/traceability/distributions?hasDiscrepancy=true` 
        : `${API_URL}/api/traceability/distributions`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(await res.text());
      const list = await res.json();
      setDistAuditList(list);
    } catch (err: any) {
      console.error('Audit query error:', err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'audit') {
      loadDistributionAudit();
    }
  }, [discrepancyOnly, activeTab]);

  const filteredAudit = distAuditList.filter(d => 
    d.DistributionNumber.toLowerCase().includes(auditSearch.toLowerCase()) ||
    (d.DestinationLocationName || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
    (d.StockRequestNumber || '').toLowerCase().includes(auditSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black text-foreground tracking-tight">Supply Chain Traceability & Audit</h1>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary">
              Phase 11 Compliance
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            End-to-end accountability from Central Warehouse Inbound receipts down to Barangay patient disbursements
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/50 rounded-xl border border-border/50 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab('lot')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'lot' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Medicine Lot Explorer
          </button>
          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'audit' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Distributions Audit Log
          </button>
        </div>
      </div>

      {activeTab === 'lot' && (
        <div className="space-y-6">
          {/* Search Box */}
          <Card className="rounded-2xl border-border/50 shadow-sm p-5">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={lotInput}
                  onChange={e => setLotInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleTraceLot()}
                  placeholder="Enter Batch / Lot Number to trace (e.g. LOT-TEST-AUTO-01, 32324321)..."
                  className="pl-9 h-11 text-xs font-mono rounded-xl border-border/60"
                />
              </div>

              <Button
                onClick={() => handleTraceLot()}
                disabled={isSearching}
                className="w-full sm:w-auto h-11 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-sm"
              >
                <Activity className={`w-4 h-4 mr-1.5 ${isSearching ? 'animate-spin' : ''}`} />
                Trace Lifecycle
              </Button>
            </div>

            {/* Quick Suggestions */}
            {availableLots.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border/40 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground text-[11px] font-semibold mr-1">Active Batches:</span>
                {availableLots.slice(0, 6).map(lot => (
                  <button
                    key={lot.id}
                    onClick={() => {
                      setLotInput(lot.lotNumber);
                      handleTraceLot(lot.lotNumber);
                    }}
                    className="px-2 py-1 rounded-lg bg-muted/60 hover:bg-muted text-[11px] font-mono text-foreground font-medium transition-colors"
                  >
                    {lot.lotNumber} ({lot.medicineName})
                  </button>
                ))}
              </div>
            )}
          </Card>

          {/* Trace Results */}
          {traceData ? (
            <div className="space-y-6">
              {/* Reconciliation Balance Summary Card */}
              <Card className="rounded-2xl border-emerald-500/30 bg-emerald-500/5 shadow-sm p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-emerald-500/20">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      <h3 className="font-black text-base text-foreground">
                        Batch Balance Reconciliation: Lot {traceData.lotNumber}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Real-time ledger audit reconciling total ingested warehouse stock with downstream balances
                    </p>
                  </div>

                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white shadow-sm self-start md:self-auto">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    BALANCED & RECONCILED
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mt-4 text-center">
                  <div className="p-3 bg-card rounded-xl border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Total Ingested</span>
                    <span className="text-lg font-black text-foreground">
                      {traceData.reconciliationSummary.totalReceivedInWarehouse}
                    </span>
                  </div>

                  <div className="p-3 bg-card rounded-xl border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">In Central WH</span>
                    <span className="text-lg font-black text-blue-600">
                      {traceData.reconciliationSummary.currentInWarehouse}
                    </span>
                  </div>

                  <div className="p-3 bg-card rounded-xl border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">In Pharmacy</span>
                    <span className="text-lg font-black text-teal-600">
                      {traceData.reconciliationSummary.currentInPharmacy}
                    </span>
                  </div>

                  <div className="p-3 bg-card rounded-xl border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">In Barangays</span>
                    <span className="text-lg font-black text-emerald-600">
                      {traceData.reconciliationSummary.currentInBarangays}
                    </span>
                  </div>

                  <div className="p-3 bg-card rounded-xl border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Dispensed (Phar)</span>
                    <span className="text-lg font-black text-indigo-600">
                      {traceData.reconciliationSummary.totalDispensedInPharmacy}
                    </span>
                  </div>

                  <div className="p-3 bg-card rounded-xl border border-border/50">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase block">Disbursed (Bgy)</span>
                    <span className="text-lg font-black text-purple-600">
                      {traceData.reconciliationSummary.totalDisbursedInBarangays}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Lifecycle Flow Timeline */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
                  Complete Supply Chain Audit Trail
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Step 1: Inbound & Warehouse */}
                  <Card className="rounded-2xl border-border/50 shadow-sm p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
                      <Truck className="w-4 h-4 text-primary" />
                      1. Inbound & Intake
                    </div>
                    {traceData.warehouseLots.map((wLot: any) => (
                      <div key={wLot.InventoryID} className="p-3 bg-muted/30 rounded-xl space-y-1.5 text-xs">
                        <div className="font-bold text-foreground">{wLot.ProductName}</div>
                        <div className="text-muted-foreground">Supplier: <strong className="text-foreground">{wLot.SupplierName || 'Direct Donor'}</strong></div>
                        <div className="text-muted-foreground">DR Ref: <strong className="text-foreground">{wLot.DRNumber || 'Initial Load'}</strong></div>
                        <div className="text-muted-foreground">Exp Date: <strong className="text-foreground">{new Date(wLot.ExpiryDate).toLocaleDateString()}</strong></div>
                        <div className="text-muted-foreground">Ingested Qty: <strong className="text-emerald-600 font-bold">{wLot.QuantityReceived} units</strong></div>
                      </div>
                    ))}
                  </Card>

                  {/* Step 2: Distribution Releases */}
                  <Card className="rounded-2xl border-border/50 shadow-sm p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider">
                      <ArrowUpRight className="w-4 h-4 text-blue-600" />
                      2. Warehouse Releases ({traceData.distributions.length})
                    </div>
                    {traceData.distributions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No distributions issued for this lot yet.</p>
                    ) : (
                      traceData.distributions.map((d: any) => (
                        <div key={d.DistributionID} className="p-3 bg-muted/30 rounded-xl space-y-1.5 text-xs">
                          <div className="flex items-center justify-between font-bold text-foreground">
                            <span>{d.DistributionNumber}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-blue-500/15 text-blue-700">{d.DistributionStatus}</span>
                          </div>
                          <div className="text-muted-foreground">To: <strong className="text-foreground">{d.DestinationLocationName}</strong></div>
                          <div className="text-muted-foreground">Issued Qty: <strong className="text-foreground">{d.QuantityIssued}</strong></div>
                          <div className="text-muted-foreground">Confirmed Recv: <strong className="text-emerald-600 font-bold">{d.ReceivedQuantity || d.QuantityIssued}</strong></div>
                          {d.HasDiscrepancy && (
                            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-800 dark:text-amber-300 text-[11px]">
                              <strong>Discrepancy:</strong> {d.DiscrepancyRemarks || 'Variance noted'}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </Card>

                  {/* Step 3: Downstream Dispensing / Disbursements */}
                  <Card className="rounded-2xl border-border/50 shadow-sm p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider">
                      <Users className="w-4 h-4 text-emerald-600" />
                      3. Patient Dispensing ({traceData.pharmacyDispensing.length + traceData.barangayDisbursements.length})
                    </div>
                    {traceData.pharmacyDispensing.length === 0 && traceData.barangayDisbursements.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-4 text-center">No patient dispensing recorded from this lot.</p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {traceData.pharmacyDispensing.map((p: any) => (
                          <div key={p.SaleID} className="p-2.5 bg-muted/30 rounded-xl space-y-1 text-xs">
                            <div className="font-bold text-foreground">{p.DispenseNumber} (City Pharmacy)</div>
                            <div className="text-muted-foreground">Patient: {p.PatientName || 'Walk-in'} ({p.PatientBarangay || 'Catbalogan'})</div>
                            <div className="text-muted-foreground">Dispensed: <strong className="text-teal-600 font-bold">{p.QuantityDispensed} units</strong></div>
                          </div>
                        ))}

                        {traceData.barangayDisbursements.map((b: any) => (
                          <div key={b.DisbursementID} className="p-2.5 bg-muted/30 rounded-xl space-y-1 text-xs">
                            <div className="font-bold text-foreground">{b.DisbursementNumber} ({b.BarangayName})</div>
                            <div className="text-muted-foreground">Resident: {b.RecipientName}</div>
                            <div className="text-muted-foreground">Disbursed: <strong className="text-emerald-600 font-bold">{b.QuantityDisbursed} units</strong></div>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              </div>
            </div>
          ) : (
            <Card className="rounded-2xl border-border/50 shadow-sm p-12 text-center text-muted-foreground">
              <Activity className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
              <h3 className="font-bold text-base text-foreground">Select or Search a Batch to Trace</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                Enter an official medicine batch lot number above to inspect its entire journey through Catbalogan City's healthcare supply chain.
              </p>
            </Card>
          )}
        </div>
      )}

      {/* Distribution Audit Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <Card className="rounded-2xl border-border/50 shadow-sm p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={auditSearch}
                  onChange={e => setAuditSearch(e.target.value)}
                  placeholder="Search distributions by number or destination..."
                  className="pl-9 h-10 text-xs rounded-xl"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={() => setDiscrepancyOnly(!discrepancyOnly)}
                  variant={discrepancyOnly ? 'default' : 'outline'}
                  size="sm"
                  className={`text-xs font-semibold rounded-xl ${
                    discrepancyOnly ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  {discrepancyOnly ? 'Showing Discrepancies Only' : 'Filter Discrepancies'}
                </Button>

                <Button
                  onClick={loadDistributionAudit}
                  variant="outline"
                  size="sm"
                  disabled={isLoadingAudit}
                  className="text-xs font-semibold rounded-xl"
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isLoadingAudit ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </Card>

          {/* Mobile Distribution Audit Cards (< md) */}
          <div className="md:hidden space-y-3">
            {filteredAudit.length === 0 ? (
              <Card className="rounded-2xl border-border/50 shadow-sm p-8 text-center text-muted-foreground">
                <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                <p className="font-semibold text-sm text-foreground">No matching distributions found</p>
              </Card>
            ) : (
              filteredAudit.map(d => (
                <div key={d.DistributionID} className="p-4 rounded-2xl border border-border/70 bg-card shadow-xs space-y-3">
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/60">
                    <div>
                      <span className="font-mono font-bold text-xs text-primary block">{d.DistributionNumber}</span>
                      <h4 className="font-bold text-sm text-foreground mt-0.5">{d.DestinationLocationName}</h4>
                      <span className="text-[11px] text-muted-foreground">{d.DestinationType}</span>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                      d.Status === 'Received' ? 'bg-emerald-500/15 text-emerald-700' :
                      d.Status === 'Issued' ? 'bg-blue-500/15 text-blue-700' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {d.Status}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded-xl border border-border/40 text-center">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Issued Qty</span>
                      <span className="font-black text-foreground">{d.TotalQuantityIssued}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Received Qty</span>
                      <span className="font-black text-emerald-600">{d.TotalQuantityReceived}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Released</span>
                      <span className="font-semibold text-foreground">
                        {d.ReleasedDate ? new Date(d.ReleasedDate).toLocaleDateString() : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <span className="text-muted-foreground">Discrepancy Status:</span>
                    {d.HasDiscrepancy ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 inline-flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Discrepancy Logged
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-semibold text-xs">Verified Match</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop Distribution Audit Table (>= md) */}
          <Card className="hidden md:block rounded-2xl border-border/50 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-bold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Distribution #</th>
                    <th className="py-3.5 px-4">Destination</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 text-right">Issued Qty</th>
                    <th className="py-3.5 px-4 text-right">Received Qty</th>
                    <th className="py-3.5 px-4 text-center">Discrepancy</th>
                    <th className="py-3.5 px-4">Released Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {filteredAudit.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2 opacity-80" />
                        <p className="font-semibold text-sm text-foreground">No matching distributions found</p>
                      </td>
                    </tr>
                  ) : (
                    filteredAudit.map(d => (
                      <tr key={d.DistributionID} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-foreground">
                          {d.DistributionNumber}
                        </td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {d.DestinationLocationName}
                          <span className="block text-[10px] text-muted-foreground font-normal">{d.DestinationType}</span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            d.Status === 'Received' ? 'bg-emerald-500/15 text-emerald-700' :
                            d.Status === 'Issued' ? 'bg-blue-500/15 text-blue-700' :
                            'bg-muted text-muted-foreground'
                          }`}>
                            {d.Status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-black text-foreground">
                          {d.TotalQuantityIssued}
                        </td>
                        <td className="py-3 px-4 text-right font-black text-emerald-600">
                          {d.TotalQuantityReceived}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {d.HasDiscrepancy ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />
                              Discrepancy Logged
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[10px]">None</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">
                          {d.ReleasedDate ? new Date(d.ReleasedDate).toLocaleDateString() : '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
