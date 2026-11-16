import React, { useState } from 'react';
import { 
  ShieldCheck, AlertTriangle, AlertOctagon, FileQuestion, Copy, Clock, 
  RotateCw, Search, Filter, CheckCircle2, XCircle, ArrowRight, Eye, 
  FileText, Calendar, Building, Layers, MessageSquare, Plus, Info, 
  History, ArrowUpRight, Truck, Check, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../../lib/utils';
import { API_URL } from '../../../../app/api-config';

const API_BASE = `${API_URL}/api/warehouse/reconciliation`;

interface ReconciliationSummary {
  batchesAudited: number;
  totalRecordedQuantity: number | string;
  totalExpectedQuantity: number | string;
  discrepanciesFound: number;
  negativeStockCases: number;
  missingLedgerEntries: number;
  duplicateMovements: number;
  unresolvedFindings: number;
  lastAuditTimestamp: string | null;
  lastRunNumber: string | null;
  lastRunStatus: string;
}

interface DiscrepancyItem {
  DiscrepancyID: string;
  RunID: string;
  InventoryID: string | null;
  MedicineID: number;
  LocationID: number;
  IssueType: string;
  Severity: 'Critical' | 'High' | 'Medium' | 'Low';
  RelatedDocumentType: string | null;
  RelatedDocumentID: string | null;
  RelatedDocumentNumber: string | null;
  RecordedQuantity: number;
  ExpectedQuantity: number;
  DifferenceQuantity: number;
  BatchNumber: string | null;
  LotNumber: string | null;
  ExpiryDate: string | null;
  InvestigationStatus: 'Open' | 'Under Review' | 'Resolved' | 'Accepted Exception';
  ResolutionJustification: string | null;
  DetectedDate: string;
  ProductName: string;
  GenericName: string;
  Dosage: string;
  Form: string;
  LocationName: string;
  ResolvedByUserName: string | null;
}

interface DiscrepancyDetail extends DiscrepancyItem {
  TrackBatchNumbers: boolean;
  TrackExpirationDates: boolean;
  FEFOEnabled: boolean;
  RunNumber: string;
  RunStartedAt: string;
  transactions: Array<{
    TransactionID: string;
    TransactionType: string;
    Quantity: number;
    UnitCost: number;
    TotalCost: number;
    ReferenceDocument: string;
    ReferenceID: string;
    Remarks: string;
    CreatedDate: string;
    CreatedByUserName: string;
  }>;
  notes: Array<{
    NoteID: string;
    UserID: number;
    AuthorName: string;
    AuthorRole: string;
    NoteText: string;
    CreatedAt: string;
  }>;
}

export function WarehouseReconciliation() {
  const queryClient = useQueryClient();
  const [selectedDiscrepancyId, setSelectedDiscrepancyId] = useState<string | null>(null);
  const [isConfirmRunOpen, setIsConfirmRunOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [issueTypeFilter, setIssueTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 15;

  // New note state
  const [newNoteText, setNewNoteText] = useState('');
  // Status resolution state
  const [newStatus, setNewStatus] = useState<string>('Under Review');
  const [justification, setJustification] = useState('');

  // 1. Fetch Summary KPIs
  const { data: summary, isLoading: isSummaryLoading, refetch: refetchSummary } = useQuery<ReconciliationSummary>({
    queryKey: ['warehouse-reconciliation-summary'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/summary`);
      if (!res.ok) throw new Error('Failed to load reconciliation summary');
      return res.json();
    }
  });

  // 2. Fetch Discrepancies Table
  const { data: discrepanciesData, isLoading: isDiscrepanciesLoading, refetch: refetchDiscrepancies } = useQuery<{
    items: DiscrepancyItem[];
    pagination: { total: number; page: number; pageSize: number; totalPages: number };
  }>({
    queryKey: ['warehouse-discrepancies', statusFilter, issueTypeFilter, searchQuery, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams({
        status: statusFilter,
        issueType: issueTypeFilter,
        search: searchQuery,
        page: String(currentPage),
        pageSize: String(pageSize)
      });
      const res = await fetch(`${API_BASE}/discrepancies?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load discrepancies');
      return res.json();
    }
  });

  // 3. Fetch Single Discrepancy Details
  const { data: activeDetail, isLoading: isDetailLoading, refetch: refetchDetail } = useQuery<DiscrepancyDetail>({
    queryKey: ['warehouse-discrepancy-detail', selectedDiscrepancyId],
    queryFn: async () => {
      if (!selectedDiscrepancyId) return null;
      const res = await fetch(`${API_BASE}/discrepancies/${selectedDiscrepancyId}`);
      if (!res.ok) throw new Error('Failed to load discrepancy details');
      return res.json();
    },
    enabled: !!selectedDiscrepancyId
  });

  // 4. Fetch Audit Runs History
  const { data: auditRuns = [] } = useQuery<any[]>({
    queryKey: ['warehouse-reconciliation-runs'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/runs`);
      if (!res.ok) throw new Error('Failed to load audit runs');
      return res.json();
    },
    enabled: isHistoryModalOpen
  });

  // 5. Trigger Reconciliation Run Mutation
  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_BASE}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1 })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Audit failed to run');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Audit ${data.runNumber} completed! Found ${data.totalDiscrepancies} issue(s) across ${data.totalBatchesAudited} batches.`);
      setIsConfirmRunOpen(false);
      queryClient.invalidateQueries({ queryKey: ['warehouse-reconciliation-summary'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['warehouse-reconciliation-runs'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Audit execution failed');
      setIsConfirmRunOpen(false);
    }
  });

  // 6. Add Note Mutation
  const addNoteMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDiscrepancyId || !newNoteText.trim()) return;
      const res = await fetch(`${API_BASE}/discrepancies/${selectedDiscrepancyId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 1, noteText: newNoteText })
      });
      if (!res.ok) throw new Error('Failed to save note');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Investigation note saved.');
      setNewNoteText('');
      refetchDetail();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Could not save note');
    }
  });

  // 7. Update Status Mutation
  const updateStatusMutation = useMutation({
    mutationFn: async () => {
      if (!selectedDiscrepancyId) return;
      const res = await fetch(`${API_BASE}/discrepancies/${selectedDiscrepancyId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: 1,
          status: newStatus,
          justification: justification
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update status');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success(`Discrepancy marked as "${newStatus}"`);
      setJustification('');
      refetchDetail();
      refetchDiscrepancies();
      refetchSummary();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Could not update status');
    }
  });

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"><AlertOctagon className="w-3.5 h-3.5" /> Critical</span>;
      case 'High':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"><AlertTriangle className="w-3.5 h-3.5" /> High</span>;
      case 'Medium':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20"><Info className="w-3.5 h-3.5" /> Medium</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/20">Low</span>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Resolved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25"><CheckCircle2 className="w-3.5 h-3.5" /> Resolved</span>;
      case 'Accepted Exception':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/25"><ShieldCheck className="w-3.5 h-3.5" /> Accepted Exception</span>;
      case 'Under Review':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/25"><RotateCw className="w-3.5 h-3.5 animate-spin" /> Under Review</span>;
      case 'Open':
      default:
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25"><Clock className="w-3.5 h-3.5" /> Open</span>;
    }
  };

  const formatIssueType = (type: string) => {
    switch (type) {
      case 'NEGATIVE_STOCK': return 'Negative Stock';
      case 'BALANCE_MISMATCH': return 'Balance Mismatch';
      case 'MISSING_RECEIVING_LEDGER': return 'Missing Receiving Ledger';
      case 'MISSING_DISTRIBUTION_LEDGER': return 'Missing Distribution Ledger';
      case 'UNRECORDED_DISTRIBUTION_DEDUCTION': return 'Unrecorded Outflow Deduction';
      case 'EXPIRED_ACTIVE_STOCK': return 'Expired Stock in Active State';
      case 'DUPLICATE_MOVEMENT': return 'Duplicate Transaction Movement';
      case 'ORPHANED_BATCH': return 'Orphaned Inventory Batch';
      default: return type.replace(/_/g, ' ');
    }
  };

  return (
    <div className="space-y-8 pb-12 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Integrity & Reconciliation</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <ShieldCheck className="w-4 h-4 text-primary" /> Phase 5 Authoritative Ledger
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-sm max-w-2xl">
            Autonomous stock movement validation, ledger parity auditing, and non-destructive discrepancy investigation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            onClick={() => setIsHistoryModalOpen(true)}
            className="rounded-xl border-border/80 shadow-sm hover:bg-muted gap-2 font-medium"
          >
            <History className="w-4 h-4 text-muted-foreground" />
            Audit History
          </Button>

          <Button 
            onClick={() => setIsConfirmRunOpen(true)}
            disabled={runAuditMutation.isPending}
            className="rounded-xl bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-700 text-white shadow-md shadow-primary/25 gap-2 font-semibold px-5"
          >
            <RotateCw className={cn("w-4 h-4", runAuditMutation.isPending && "animate-spin")} />
            {runAuditMutation.isPending ? 'Auditing Ledger...' : 'Run Reconciliation'}
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-6">
        {/* Batches Audited */}
        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-xl shadow-sm p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Batches Audited</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-foreground">
            {summary?.batchesAudited ?? '...'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            {summary?.lastRunNumber || 'Live inventory batches'}
          </div>
        </Card>

        {/* Total Discrepancies */}
        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-xl shadow-sm p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Discrepancies</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-rose-600 dark:text-rose-400">
            {summary?.discrepanciesFound ?? '...'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            Total active flags
          </div>
        </Card>

        {/* Negative Stock */}
        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-xl shadow-sm p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Negative Stock</span>
            <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center text-red-600 dark:text-red-400">
              <AlertOctagon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-foreground">
            {summary?.negativeStockCases ?? '0'}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-1 truncate">
            Zero-deficit enforcement
          </div>
        </Card>

        {/* Missing Ledger */}
        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-xl shadow-sm p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Missing Ledger</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <FileQuestion className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-foreground">
            {summary?.missingLedgerEntries ?? '0'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            Unrecorded transactions
          </div>
        </Card>

        {/* Duplicate Movements */}
        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-xl shadow-sm p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Duplicates</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Copy className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-foreground">
            {summary?.duplicateMovements ?? '0'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            Duplicate postings
          </div>
        </Card>

        {/* Unresolved Findings */}
        <Card className="rounded-2xl border-border/60 bg-card/60 backdrop-blur-xl shadow-sm p-4 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Unresolved</span>
            <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black mt-2 text-sky-600 dark:text-sky-400">
            {summary?.unresolvedFindings ?? '...'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1 truncate">
            Awaiting resolution
          </div>
        </Card>
      </div>

      {/* Main Card with Toolbar & Table */}
      <Card className="rounded-2xl border-border/60 bg-card shadow-sm overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border/60 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-col sm:flex-row flex-1 items-stretch sm:items-center gap-2.5 sm:gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input 
                placeholder="Search by Medicine, Lot, or Document #..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-9 rounded-xl border-border/80 bg-background/50 h-10"
              />
            </div>

            <div className="grid grid-cols-2 sm:flex items-center gap-2">
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                className="h-10 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border/80 bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">All Statuses</option>
                <option value="Open">Open</option>
                <option value="Under Review">Under Review</option>
                <option value="Resolved">Resolved</option>
                <option value="Accepted Exception">Accepted Exception</option>
              </select>

              {/* Issue Type Filter */}
              <select
                value={issueTypeFilter}
                onChange={(e) => { setIssueTypeFilter(e.target.value); setCurrentPage(1); }}
                className="h-10 px-3 py-1.5 text-xs font-semibold rounded-xl border border-border/80 bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="ALL">All Issue Types</option>
                <option value="NEGATIVE_STOCK">Negative Stock</option>
                <option value="BALANCE_MISMATCH">Balance Mismatch</option>
                <option value="UNRECORDED_DISTRIBUTION_DEDUCTION">Unrecorded Outflow Deduction</option>
                <option value="MISSING_RECEIVING_LEDGER">Missing Receiving Ledger</option>
                <option value="MISSING_DISTRIBUTION_LEDGER">Missing Distribution Ledger</option>
                <option value="EXPIRED_ACTIVE_STOCK">Expired Active Stock</option>
                <option value="DUPLICATE_MOVEMENT">Duplicate Movement</option>
                <option value="ORPHANED_BATCH">Orphaned Batch</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            {(statusFilter !== 'ALL' || issueTypeFilter !== 'ALL' || searchQuery) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => { setStatusFilter('ALL'); setIssueTypeFilter('ALL'); setSearchQuery(''); setCurrentPage(1); }}
                className="text-xs text-muted-foreground hover:text-foreground h-9"
              >
                Clear Filters
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              Showing {discrepanciesData?.pagination.total || 0} finding(s)
            </span>
          </div>
        </div>

        {/* Mobile Discrepancy Cards (< md) */}
        <div className="md:hidden p-3 space-y-3">
          {isDiscrepanciesLoading ? (
            <div className="py-10 text-center text-muted-foreground text-xs">
              <RotateCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
              Scanning stock ledger...
            </div>
          ) : discrepanciesData?.items.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <Check className="w-6 h-6" />
              </div>
              <div className="font-semibold text-foreground text-sm">Zero Discrepancies Found</div>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                All physical batches match authoritative inventory transactions.
              </p>
            </div>
          ) : (
            discrepanciesData?.items.map((item) => {
              const variance = item.DifferenceQuantity || (item.RecordedQuantity - item.ExpectedQuantity);
              const isNegativeVariance = variance < 0;
              const isPositiveVariance = variance > 0;

              return (
                <div
                  key={item.DiscrepancyID}
                  onClick={() => setSelectedDiscrepancyId(item.DiscrepancyID)}
                  className="p-4 rounded-2xl border border-border/70 bg-background shadow-xs space-y-3 active:bg-muted/30 cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2 pb-2 border-b border-border/60">
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5 mb-1">
                        {getSeverityBadge(item.Severity)}
                        <span className="text-xs font-bold text-foreground">
                          {formatIssueType(item.IssueType)}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-foreground">
                        {item.ProductName || 'Unknown Medicine'}
                      </h3>
                      <p className="text-xs text-muted-foreground font-mono">
                        Batch: {item.BatchNumber || item.LotNumber || 'NO BATCH ID'}
                      </p>
                    </div>
                    {getStatusBadge(item.InvestigationStatus)}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded-xl border border-border/40 text-center">
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Recorded</span>
                      <span className="font-mono font-bold text-foreground">{item.RecordedQuantity}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Expected</span>
                      <span className="font-mono font-semibold text-muted-foreground">{item.ExpectedQuantity}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Variance</span>
                      <span className={cn(
                        "font-mono font-extrabold",
                        isNegativeVariance && "text-rose-600 dark:text-rose-400",
                        isPositiveVariance && "text-amber-600 dark:text-amber-400",
                        !isNegativeVariance && !isPositiveVariance && "text-muted-foreground"
                      )}>
                        {variance > 0 ? `+${variance}` : variance}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-muted-foreground">
                      Doc: <strong className="text-foreground font-mono">{item.RelatedDocumentNumber || 'Batch Baseline'}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-9 px-3 rounded-xl text-xs font-semibold text-primary border-primary/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDiscrepancyId(item.DiscrepancyID);
                      }}
                    >
                      <Eye className="w-3.5 h-3.5 mr-1.5" /> Investigate
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop Table Content (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60">
              <tr>
                <th className="py-3 px-4">Severity & Issue</th>
                <th className="py-3 px-4">Medicine Item</th>
                <th className="py-3 px-4">Batch / Expiry</th>
                <th className="py-3 px-4">Source Doc</th>
                <th className="py-3 px-4 text-right">Recorded Qty</th>
                <th className="py-3 px-4 text-right">Expected Qty</th>
                <th className="py-3 px-4 text-right">Variance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isDiscrepanciesLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto text-primary mb-2" />
                    Scanning stock ledger...
                  </td>
                </tr>
              ) : discrepanciesData?.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                      <Check className="w-6 h-6" />
                    </div>
                    <div className="font-semibold text-foreground text-base">Zero Discrepancies Found</div>
                    <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                      All physical batches match authoritative inventory transactions and approved delivery/distribution movements.
                    </p>
                  </td>
                </tr>
              ) : (
                discrepanciesData?.items.map((item) => {
                  const variance = item.DifferenceQuantity || (item.RecordedQuantity - item.ExpectedQuantity);
                  const isNegativeVariance = variance < 0;
                  const isPositiveVariance = variance > 0;

                  return (
                    <tr 
                      key={item.DiscrepancyID}
                      onClick={() => setSelectedDiscrepancyId(item.DiscrepancyID)}
                      className="hover:bg-muted/40 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1 items-start">
                          {getSeverityBadge(item.Severity)}
                          <span className="text-xs font-semibold text-foreground">
                            {formatIssueType(item.IssueType)}
                          </span>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-[220px]">
                        <div className="font-semibold text-foreground truncate">
                          {item.ProductName || 'Unknown Medicine'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {item.GenericName || item.Dosage || 'N/A'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="text-xs font-mono font-medium text-foreground">
                          {item.BatchNumber || item.LotNumber || 'NO BATCH ID'}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Exp: {item.ExpiryDate ? new Date(item.ExpiryDate).toLocaleDateString() : 'None'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {item.RelatedDocumentNumber ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded bg-muted text-foreground border border-border">
                            {item.RelatedDocumentType === 'DR' ? <Truck className="w-3 h-3 text-blue-500" /> : <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                            {item.RelatedDocumentNumber}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">Batch Baseline</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-bold text-foreground">
                        {item.RecordedQuantity}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono text-muted-foreground">
                        {item.ExpectedQuantity}
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-extrabold">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs",
                          isNegativeVariance && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                          isPositiveVariance && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                          !isNegativeVariance && !isPositiveVariance && "text-muted-foreground"
                        )}>
                          {variance > 0 ? `+${variance}` : variance}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(item.InvestigationStatus)}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-8 px-2.5 rounded-lg text-primary hover:text-primary hover:bg-primary/10 gap-1 text-xs font-semibold"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedDiscrepancyId(item.DiscrepancyID);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Investigate
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {discrepanciesData && discrepanciesData.pagination.totalPages > 1 && (
          <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
            <div>
              Page {discrepanciesData.pagination.page} of {discrepanciesData.pagination.totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                className="h-8 px-2.5 rounded-lg"
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Prev
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                disabled={currentPage >= discrepanciesData.pagination.totalPages}
                onClick={() => setCurrentPage(p => p + 1)}
                className="h-8 px-2.5 rounded-lg"
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Slide-over Investigation Drawer */}
      <AnimatePresence>
        {selectedDiscrepancyId && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDiscrepancyId(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />

            <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="w-screen max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col h-full text-foreground"
              >
                {/* Drawer Header */}
                <div className="p-4 sm:p-6 border-b border-border/80 flex items-center justify-between shrink-0 bg-muted/30">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                        DISC-#{selectedDiscrepancyId}
                      </span>
                      {activeDetail && getSeverityBadge(activeDetail.Severity)}
                      {activeDetail && getStatusBadge(activeDetail.InvestigationStatus)}
                    </div>
                    <h2 className="text-xl font-bold mt-1 text-foreground">
                      {activeDetail ? formatIssueType(activeDetail.IssueType) : 'Loading Investigation...'}
                    </h2>
                  </div>

                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => setSelectedDiscrepancyId(null)}
                    className="rounded-full h-8 w-8 text-muted-foreground hover:text-foreground"
                  >
                    <XCircle className="w-5 h-5" />
                  </Button>
                </div>

                {/* Drawer Body Scroll */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {isDetailLoading || !activeDetail ? (
                    <div className="py-20 text-center text-muted-foreground">
                      <RotateCw className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
                      Loading discrepancy records & ledger movements...
                    </div>
                  ) : (
                    <>
                      {/* Mathematical Ledger Verification Card */}
                      <Card className="rounded-xl border-border bg-gradient-to-br from-card to-muted/40 p-4 shadow-sm">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Layers className="w-4 h-4 text-primary" /> Authoritative Formula & Variance
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-lg bg-background/80 border border-border/60">
                          <div>
                            <div className="text-xs text-muted-foreground">Recorded Stock</div>
                            <div className="text-xl font-black text-foreground mt-0.5 font-mono">
                              {activeDetail.RecordedQuantity}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Expected Balance</div>
                            <div className="text-xl font-black text-foreground mt-0.5 font-mono">
                              {activeDetail.ExpectedQuantity}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-muted-foreground">Discrepancy Variance</div>
                            <div className={cn(
                              "text-xl font-black mt-0.5 font-mono",
                              activeDetail.DifferenceQuantity < 0 ? "text-rose-600 dark:text-rose-400" : "text-amber-600 dark:text-amber-400"
                            )}>
                              {activeDetail.DifferenceQuantity > 0 ? `+${activeDetail.DifferenceQuantity}` : activeDetail.DifferenceQuantity}
                            </div>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 italic text-center">
                          Formula: Expected Stock = Physical Receipts - Authorized Outflows.
                        </p>
                      </Card>

                      {/* Medicine & Batch Metadata */}
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="rounded-xl border-border p-4 bg-card/60">
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Info className="w-3.5 h-3.5 text-primary" /> Medicine Information
                          </div>
                          <div className="font-semibold text-foreground text-sm">
                            {activeDetail.ProductName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {activeDetail.GenericName}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {activeDetail.Dosage} • {activeDetail.Form}
                          </div>
                          <div className="mt-2 pt-2 border-t border-border/50 flex flex-wrap gap-1.5 text-[11px]">
                            {activeDetail.TrackBatchNumbers && (
                              <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">Batch Tracked</span>
                            )}
                            {activeDetail.TrackExpirationDates && (
                              <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">Expiry Tracked</span>
                            )}
                            {activeDetail.FEFOEnabled && (
                              <span className="px-1.5 py-0.5 rounded bg-muted text-foreground">FEFO Active</span>
                            )}
                          </div>
                        </Card>

                        <Card className="rounded-xl border-border p-4 bg-card/60">
                          <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-primary" /> Batch & Location
                          </div>
                          <div className="text-xs text-muted-foreground">Batch Identifier:</div>
                          <div className="font-mono font-semibold text-sm text-foreground">
                            {activeDetail.BatchNumber || activeDetail.LotNumber || 'NO BATCH ID'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">Expiration Date:</div>
                          <div className="font-semibold text-xs text-foreground">
                            {activeDetail.ExpiryDate ? new Date(activeDetail.ExpiryDate).toLocaleDateString() : 'N/A'}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">Location:</div>
                          <div className="font-medium text-xs text-foreground">
                            {activeDetail.LocationName || 'Main Warehouse'}
                          </div>
                        </Card>
                      </div>

                      {/* Associated Inventory Transactions Ledger */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-primary" />
                            Inventory Ledger Transactions ({activeDetail.transactions?.length || 0})
                          </h4>
                          <span className="text-[11px] text-muted-foreground">Immutable historical record</span>
                        </div>

                        {activeDetail.transactions?.length === 0 ? (
                          <div className="p-4 rounded-xl border border-dashed border-border bg-muted/20 text-center text-xs text-muted-foreground">
                            <FileQuestion className="w-5 h-5 mx-auto mb-1 text-amber-500 opacity-60" />
                            No inventory ledger entries recorded for this batch in Warehouse_InventoryTransactions.
                          </div>
                        ) : (
                          <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-muted/60 font-semibold text-muted-foreground border-b border-border">
                                <tr>
                                  <th className="py-2 px-3">Date</th>
                                  <th className="py-2 px-3">Type</th>
                                  <th className="py-2 px-3">Ref</th>
                                  <th className="py-2 px-3 text-right">Qty</th>
                                  <th className="py-2 px-3">By</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/50">
                                {activeDetail.transactions.map((tx) => (
                                  <tr key={tx.TransactionID} className="hover:bg-muted/30">
                                    <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                                      {new Date(tx.CreatedDate).toLocaleDateString()}
                                    </td>
                                    <td className="py-2 px-3 font-semibold text-foreground">
                                      {tx.TransactionType}
                                    </td>
                                    <td className="py-2 px-3 font-mono text-muted-foreground">
                                      {tx.ReferenceDocument ? `${tx.ReferenceDocument}-${tx.ReferenceID}` : 'N/A'}
                                    </td>
                                    <td className={cn(
                                      "py-2 px-3 text-right font-mono font-bold",
                                      tx.Quantity < 0 ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                                    )}>
                                      {tx.Quantity > 0 ? `+${tx.Quantity}` : tx.Quantity}
                                    </td>
                                    <td className="py-2 px-3 text-muted-foreground truncate max-w-[90px]">
                                      {tx.CreatedByUserName || 'System'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {/* Status Update & Resolution Form */}
                      <Card className="rounded-xl border-border p-4 bg-muted/20">
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-primary" /> Update Investigation Status
                        </h4>

                        <div className="space-y-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {['Open', 'Under Review', 'Resolved', 'Accepted Exception'].map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setNewStatus(st)}
                                className={cn(
                                  "py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center",
                                  newStatus === st 
                                    ? "bg-primary text-white border-primary shadow-sm" 
                                    : "bg-background text-muted-foreground border-border hover:bg-muted"
                                )}
                              >
                                {st}
                              </button>
                            ))}
                          </div>

                          <div>
                            <label className="text-xs font-medium text-muted-foreground block mb-1">
                              Mandatory Justification / Resolution Explanation:
                            </label>
                            <Input
                              placeholder="Document root cause, physical verification findings, or supervisor sign-off..."
                              value={justification}
                              onChange={(e) => setJustification(e.target.value)}
                              className="rounded-lg text-xs h-9 bg-background"
                            />
                          </div>

                          <Button
                            size="sm"
                            disabled={updateStatusMutation.isPending || !justification.trim()}
                            onClick={() => updateStatusMutation.mutate()}
                            className="w-full rounded-lg font-semibold text-xs h-9"
                          >
                            {updateStatusMutation.isPending ? 'Updating Status...' : `Apply Status: ${newStatus}`}
                          </Button>
                        </div>
                      </Card>

                      {/* Investigation Notes Timeline */}
                      <div>
                        <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          Investigation Notes & Audit Trail ({activeDetail.notes?.length || 0})
                        </h4>

                        <div className="space-y-3">
                          {activeDetail.notes?.map((n) => (
                            <div key={n.NoteID} className="p-3 rounded-xl border border-border/80 bg-background/60 shadow-xs space-y-1">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span className="font-semibold text-foreground">{n.AuthorName || 'Auditor'} ({n.AuthorRole || 'Warehouse Staff'})</span>
                                <span>{new Date(n.CreatedAt).toLocaleString()}</span>
                              </div>
                              <p className="text-xs text-foreground/90 leading-relaxed">{n.NoteText}</p>
                            </div>
                          ))}

                          <div className="flex gap-2 pt-2">
                            <Input
                              placeholder="Add an investigation observation note..."
                              value={newNoteText}
                              onChange={(e) => setNewNoteText(e.target.value)}
                              className="rounded-xl text-xs h-9 bg-background flex-1"
                            />
                            <Button
                              size="sm"
                              disabled={addNoteMutation.isPending || !newNoteText.trim()}
                              onClick={() => addNoteMutation.mutate()}
                              className="rounded-xl text-xs h-9 px-4 gap-1 font-semibold"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add Note
                            </Button>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Modal for Running Reconciliation */}
      <AnimatePresence>
        {isConfirmRunOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmRunOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl text-foreground"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <RotateCw className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Initiate Warehouse Reconciliation?</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                This process performs an exhaustive, non-destructive mathematical audit across all warehouse inventory batches, delivery receipts, distributions, and transactional ledger entries.
              </p>
              <div className="mt-4 p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground space-y-1">
                <div>• Zero historical data will be deleted or modified.</div>
                <div>• Findings are logged to persistent audit history.</div>
                <div>• Active investigations and notes are preserved.</div>
              </div>
              <div className="mt-6 flex items-center justify-end gap-3">
                <Button 
                  variant="outline" 
                  onClick={() => setIsConfirmRunOpen(false)}
                  className="rounded-xl text-xs"
                >
                  Cancel
                </Button>
                <Button 
                  onClick={() => runAuditMutation.mutate()}
                  disabled={runAuditMutation.isPending}
                  className="rounded-xl bg-primary text-white text-xs font-semibold gap-2"
                >
                  {runAuditMutation.isPending ? <RotateCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {runAuditMutation.isPending ? 'Auditing...' : 'Confirm & Run Audit'}
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Audit History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-2xl bg-card border border-border rounded-2xl p-6 shadow-2xl text-foreground max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-4 border-b border-border">
                <div>
                  <h3 className="text-lg font-bold">Reconciliation Audit History</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Chronological record of past integrity audit executions</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsHistoryModalOpen(false)} className="rounded-full">
                  <XCircle className="w-5 h-5 text-muted-foreground" />
                </Button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-3">
                {auditRuns.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground">No historical runs recorded.</div>
                ) : (
                  auditRuns.map((run) => (
                    <div key={run.RunID} className="p-3.5 rounded-xl border border-border/80 bg-background/50 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-foreground">{run.RunNumber}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
                            run.Status === 'Completed' ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400"
                          )}>
                            {run.Status}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          Started: {new Date(run.StartedAt).toLocaleString()} • Triggered by: {run.TriggeredByUserName || 'System Auditor'}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-foreground">
                          {run.TotalDiscrepancies} issue(s) / {run.TotalBatchesAudited} batches
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Recorded: {run.TotalRecordedQuantity} | Expected: {run.TotalExpectedQuantity}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
