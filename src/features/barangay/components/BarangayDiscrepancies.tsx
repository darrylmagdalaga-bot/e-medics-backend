import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, Search, Filter, ShieldCheck, 
  ArrowDownToLine, Package, Calendar, RefreshCw, FileText
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { IncomingDistribution } from '../types';
import { fetchIncomingDistributions } from '../api';
import { toast } from 'sonner';

interface BarangayDiscrepanciesProps {
  userId: number | null;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function BarangayDiscrepancies({
  userId,
  onRefresh,
  isLoading: parentLoading
}: BarangayDiscrepanciesProps) {
  const [discrepancies, setDiscrepancies] = useState<IncomingDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadDiscrepancies = async () => {
    setIsLoading(true);
    try {
      const data = await fetchIncomingDistributions(userId, { hasDiscrepancy: true });
      setDiscrepancies(data);
    } catch (err: any) {
      toast.error('Failed to load discrepancy records: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDiscrepancies();
  }, [userId]);

  const filtered = discrepancies.filter(d => 
    d.DistributionNumber.toLowerCase().includes(search.toLowerCase()) ||
    (d.DiscrepancyRemarks || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.SourceLocationName || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Distribution Discrepancy Tracker
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit log of all inbound shipments with physical transit shortages, damaged units, or variances
          </p>
        </div>

        <Button
          onClick={loadDiscrepancies}
          variant="outline"
          size="sm"
          disabled={isLoading}
          className="text-xs font-semibold h-9 rounded-xl self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Audit
        </Button>
      </div>

      {/* Explanatory Banner */}
      <Card className="rounded-2xl border-amber-500/30 bg-amber-500/5 shadow-none p-4">
        <div className="flex gap-3">
          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Zero-Tolerance Discrepancy Traceability
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When physical medicine counts differ from warehouse issued quantities, records are preserved with immutable discrepancy flags. This guarantees that only physically counted units enter station stock while unreceived quantities remain flagged for City Health Office administrative investigation.
            </p>
          </div>
        </div>
      </Card>

      {/* Search Bar */}
      <Card className="rounded-2xl border-border/50 shadow-sm p-3 sm:p-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Distribution #, discrepancy notes, or warehouse..."
            className="pl-9 text-xs rounded-xl h-10 border-border/60"
          />
        </div>
      </Card>

      {/* Discrepancy List / Cards */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-muted-foreground">
          Loading discrepancy ledger...
        </div>
      ) : filtered.length === 0 ? (
        <Card className="rounded-2xl border-border/50 shadow-sm p-8 sm:p-12 text-center">
          <ShieldCheck className="w-10 sm:w-12 h-10 sm:h-12 mx-auto text-emerald-500 mb-2 opacity-90" />
          <h3 className="font-bold text-sm sm:text-base text-foreground">No Recorded Discrepancies</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
            {search ? 'No discrepancy records match your search filter.' : 'All received distributions at this health station perfectly matched physical counts.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(dist => (
            <Card key={dist.DistributionID} className="rounded-2xl border-amber-500/30 bg-card shadow-sm p-4 space-y-3 hover:shadow-md transition-shadow">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-black text-sm text-foreground">{dist.DistributionNumber}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Flagged Discrepancy
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Status: <strong className="text-foreground">{dist.Status}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Source</span>
                  <span className="font-semibold text-foreground">{dist.SourceLocationName || 'Central Warehouse'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Issued Date</span>
                  <span className="font-semibold text-foreground">{new Date(dist.ReleasedDate).toLocaleDateString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Line Items</span>
                  <span className="font-semibold text-foreground">{dist.ItemCount || 0} medicines</span>
                </div>
                <div>
                  <span className="text-[10px] text-muted-foreground uppercase font-bold block">Issued Units</span>
                  <span className="font-black text-primary">{dist.TotalQuantityIssued} units</span>
                </div>
              </div>

              {/* Recorded Discrepancy Reason Note */}
              <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/20 text-xs text-amber-900 dark:text-amber-300 space-y-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                  Documented Discrepancy Reason & Remarks:
                </div>
                <p className="font-medium leading-relaxed">
                  {dist.DiscrepancyRemarks || dist.Remarks || 'Physical count variance recorded upon field receipt inspection.'}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
