import React, { useState, useMemo } from 'react';
import { 
  ClipboardCheck, Plus, Search, Filter, RotateCw, CheckCircle2, XCircle, 
  AlertTriangle, Eye, Clock, UserCheck, Lock
} from 'lucide-react';
import { Card } from '../../../../components/ui/card';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '../../../../lib/utils';
import { API_URL } from '../../../../app/api-config';

import { CountSessionHeader, CountItem } from './types';
import { CreateSessionModal } from './CreateSessionModal';
import { RejectCountModal } from './RejectCountModal';
import { CountSheetDrawer } from './CountSheetDrawer';

const API_BASE = `${API_URL}/api/warehouse/physical-counts`;

export function WarehousePhysicalCount() {
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeSessionId, setActiveSessionId] = useState<string | number | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);

  // Persona switcher for testing & separation of duties
  // UserID 3 = Inventory Officer (Initiator)
  // UserID 1 = Warehouse Supervisor / Chief Reviewer (Approver)
  const [currentUserId, setCurrentUserId] = useState<number>(3);

  // Fetch count sessions list
  const { data: sessions = [], isLoading: isLoadingSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['physical-count-sessions', selectedStatus, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedStatus !== 'All') params.append('status', selectedStatus);
      if (searchQuery) params.append('search', searchQuery);
      const res = await fetch(`${API_BASE}?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch physical count sessions');
      return res.json() as Promise<CountSessionHeader[]>;
    }
  });

  // Fetch details of active session
  const { 
    data: activeDetails, 
    isLoading: isLoadingDetails, 
    refetch: refetchDetails 
  } = useQuery({
    queryKey: ['physical-count-detail', activeSessionId],
    queryFn: async () => {
      if (!activeSessionId) return null;
      const res = await fetch(`${API_BASE}/${activeSessionId}`);
      if (!res.ok) throw new Error('Failed to fetch count session details');
      return res.json() as Promise<{
        header: CountSessionHeader;
        items: CountItem[];
        history: any[];
      }>;
    },
    enabled: !!activeSessionId
  });

  // Create count session mutation
  const createMutation = useMutation({
    mutationFn: async ({ locationId, remarks }: { locationId: number; remarks: string }) => {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locationId,
          remarks,
          userId: currentUserId
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create count session');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Count Session ${data.countNumber} initialized with ${data.itemsSnapshotted} baseline items.`);
      setIsCreateModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['physical-count-sessions'] });
      setActiveSessionId(data.countId);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error creating count session');
    }
  });

  // Save count items mutation
  const saveItemsMutation = useMutation({
    mutationFn: async (items: any[]) => {
      if (!activeSessionId) return;
      const res = await fetch(`${API_BASE}/${activeSessionId}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          userId: currentUserId
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to update count items');
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success('Count draft & physical quantities saved successfully.');
      queryClient.invalidateQueries({ queryKey: ['physical-count-sessions'] });
      refetchDetails();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error saving items');
    }
  });

  // Submit count mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) return;
      const res = await fetch(`${API_BASE}/${activeSessionId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to submit count');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Count submitted for review.');
      queryClient.invalidateQueries({ queryKey: ['physical-count-sessions'] });
      refetchDetails();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error submitting count');
    }
  });

  // Approve count mutation
  const approveMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) return;
      const res = await fetch(`${API_BASE}/${activeSessionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          approvalNotes: 'Audited and approved after verifying discrepancy justifications.'
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to approve count');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Count approved for posting.');
      queryClient.invalidateQueries({ queryKey: ['physical-count-sessions'] });
      refetchDetails();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error approving count');
    }
  });

  // Reject count mutation
  const rejectMutation = useMutation({
    mutationFn: async (reason: string) => {
      if (!activeSessionId) return;
      const res = await fetch(`${API_BASE}/${activeSessionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUserId,
          rejectionReason: reason
        })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to reject count');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.info(data.message || 'Count returned to In Progress for recount/correction.');
      setIsRejectModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['physical-count-sessions'] });
      refetchDetails();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error rejecting count');
    }
  });

  // Post adjustment mutation
  const postMutation = useMutation({
    mutationFn: async () => {
      if (!activeSessionId) return;
      const res = await fetch(`${API_BASE}/${activeSessionId}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId })
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to post adjustment');
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`Adjustment posted atomically! ${data.adjustmentsPosted} ledger transaction(s) recorded.`);
      queryClient.invalidateQueries({ queryKey: ['physical-count-sessions'] });
      refetchDetails();
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error posting adjustment');
    }
  });

  // Status badges helper
  const renderStatusBadge = (status: CountSessionHeader['Status']) => {
    switch (status) {
      case 'Draft':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700"><Clock className="w-3 h-3" /> Draft</span>;
      case 'In Progress':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200 dark:border-blue-800"><RotateCw className="w-3 h-3" /> In Progress</span>;
      case 'Submitted':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200 dark:border-amber-800"><AlertTriangle className="w-3 h-3" /> Submitted</span>;
      case 'Approved':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"><CheckCircle2 className="w-3 h-3" /> Approved</span>;
      case 'Rejected':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200 dark:border-rose-800"><XCircle className="w-3 h-3" /> Rejected</span>;
      case 'Posted':
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"><Lock className="w-3 h-3" /> Posted</span>;
      default:
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">{status}</span>;
    }
  };

  const metrics = useMemo(() => {
    return {
      total: sessions.length,
      inProgress: sessions.filter(s => s.Status === 'Draft' || s.Status === 'In Progress').length,
      submitted: sessions.filter(s => s.Status === 'Submitted').length,
      approved: sessions.filter(s => s.Status === 'Approved').length,
      posted: sessions.filter(s => s.Status === 'Posted').length
    };
  }, [sessions]);

  return (
    <div className="space-y-6">
      {/* Top Header & Simulation Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Physical Inventory Count & Stock Adjustment
              </h1>
              <p className="text-sm text-muted-foreground">
                Audit physical stocks against system baseline, document variances, and atomically post signed adjustments.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-card border border-border shadow-xs text-xs">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-primary" /> Active Role:
            </span>
            <select
              value={currentUserId}
              onChange={(e) => setCurrentUserId(Number(e.target.value))}
              className="bg-transparent font-semibold text-foreground focus:outline-hidden cursor-pointer"
            >
              <option value={3}>Inventory Officer (User #3 - Initiator)</option>
              <option value={1}>Warehouse Supervisor (User #1 - Reviewer)</option>
            </select>
          </div>

          <Button 
            onClick={() => setIsCreateModalOpen(true)}
            className="flex items-center gap-2 shadow-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Count Session
          </Button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="p-4 bg-card/60 backdrop-blur-xs border-border/60">
          <p className="text-xs font-medium text-muted-foreground">Total Sessions</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{metrics.total}</p>
        </Card>
        <Card className="p-4 bg-blue-500/5 border-blue-500/20">
          <p className="text-xs font-medium text-blue-600 dark:text-blue-400">In Progress / Draft</p>
          <p className="text-2xl font-bold mt-1 text-blue-600 dark:text-blue-400">{metrics.inProgress}</p>
        </Card>
        <Card className="p-4 bg-amber-500/5 border-amber-500/20">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Awaiting Review</p>
          <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{metrics.submitted}</p>
        </Card>
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">Ready to Post</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{metrics.approved}</p>
        </Card>
        <Card className="p-4 bg-indigo-500/5 border-indigo-500/20">
          <p className="text-xs font-medium text-indigo-600 dark:text-indigo-400">Posted & Adjusted</p>
          <p className="text-2xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">{metrics.posted}</p>
        </Card>
      </div>

      {/* Filters & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border/70 shadow-xs">
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reference # or remarks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1 shrink-0">
            <Filter className="w-3.5 h-3.5" /> Status:
          </span>
          {['All', 'Draft', 'In Progress', 'Submitted', 'Approved', 'Posted', 'Rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={cn(
                "px-2.5 py-1 text-xs rounded-lg font-medium transition-colors shrink-0",
                selectedStatus === status 
                  ? "bg-primary text-primary-foreground shadow-xs" 
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              )}
            >
              {status}
            </button>
          ))}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => refetchSessions()}
            className="h-8 px-2 text-muted-foreground hover:text-foreground shrink-0"
            title="Refresh session list"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Mobile Session Cards (< md) */}
      <div className="md:hidden space-y-3">
        {isLoadingSessions ? (
          <Card className="p-8 text-center text-muted-foreground">
            <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
            Loading physical count sessions...
          </Card>
        ) : sessions.length === 0 ? (
          <Card className="p-8 text-center text-muted-foreground text-sm">
            No physical count sessions found matching criteria.
          </Card>
        ) : (
          sessions.map((session) => (
            <div
              key={session.CountID}
              onClick={() => setActiveSessionId(session.CountID)}
              className={cn(
                "p-4 rounded-2xl border bg-card shadow-xs space-y-3 active:bg-muted/30 transition-colors cursor-pointer",
                activeSessionId === session.CountID ? "border-primary bg-primary/5" : "border-border/70"
              )}
            >
              <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-border/60">
                <div>
                  <div className="flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm font-mono font-bold text-foreground">{session.CountNumber}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {session.LocationName || `Location #${session.LocationID}`} • {new Date(session.CountDate).toLocaleDateString()}
                  </p>
                </div>
                {renderStatusBadge(session.Status)}
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs bg-muted/30 p-2.5 rounded-xl border border-border/40">
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Batches</span>
                  <span className="font-bold text-foreground">{session.TotalItemsCounted}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Discrepancies</span>
                  <span className={cn("font-bold", session.TotalDiscrepancies > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground")}>
                    {session.TotalDiscrepancies}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase text-muted-foreground font-semibold block">Net Variance</span>
                  <span className={cn(
                    "font-mono font-extrabold",
                    session.TotalVarianceQuantity > 0 ? "text-emerald-600" : session.TotalVarianceQuantity < 0 ? "text-rose-600" : "text-muted-foreground"
                  )}>
                    {session.TotalVarianceQuantity > 0 ? `+${session.TotalVarianceQuantity}` : session.TotalVarianceQuantity}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-muted-foreground truncate">
                  By: <strong className="text-foreground">{session.CreatorName || `User #${session.CreatedBy}`}</strong>
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSessionId(session.CountID);
                  }}
                  className="h-9 px-3 rounded-xl text-xs font-semibold text-primary border-primary/30"
                >
                  <Eye className="w-3.5 h-3.5 mr-1.5" /> Open Count Sheet
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Sessions Table (>= md) */}
      <Card className="hidden md:block overflow-hidden border-border/70">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-xs font-medium text-muted-foreground border-b border-border/60">
              <tr>
                <th className="px-4 py-3">Count Reference</th>
                <th className="px-4 py-3">Count Date</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Items</th>
                <th className="px-4 py-3 text-right">Discrepancies</th>
                <th className="px-4 py-3 text-right">Net Variance</th>
                <th className="px-4 py-3">Created By</th>
                <th className="px-4 py-3">Reviewer</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {isLoadingSessions ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <RotateCw className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
                    Loading physical count sessions...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    No physical count sessions found matching criteria.
                  </td>
                </tr>
              ) : (
                sessions.map((session) => (
                  <tr 
                    key={session.CountID} 
                    className={cn(
                      "hover:bg-muted/30 transition-colors cursor-pointer",
                      activeSessionId === session.CountID && "bg-primary/5"
                    )}
                    onClick={() => setActiveSessionId(session.CountID)}
                  >
                    <td className="px-4 py-3 font-semibold text-foreground flex items-center gap-1.5">
                      <ClipboardCheck className="w-4 h-4 text-primary shrink-0" />
                      <span>{session.CountNumber}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(session.CountDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-foreground font-medium">
                      {session.LocationName || `Location #${session.LocationID}`}
                    </td>
                    <td className="px-4 py-3">
                      {renderStatusBadge(session.Status)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {session.TotalItemsCounted}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.TotalDiscrepancies > 0 ? (
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {session.TotalDiscrepancies}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {session.TotalVarianceQuantity > 0 ? (
                        <span className="text-emerald-600">+{session.TotalVarianceQuantity}</span>
                      ) : session.TotalVarianceQuantity < 0 ? (
                        <span className="text-rose-600">{session.TotalVarianceQuantity}</span>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {session.CreatorName || `User #${session.CreatedBy}`}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {session.ReviewerName || (session.ReviewedBy ? `User #${session.ReviewedBy}` : '—')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSessionId(session.CountID);
                        }}
                        className="h-7 px-2 text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> View Sheet
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Count Sheet Drawer */}
      <CountSheetDrawer
        sessionDetails={activeDetails || null}
        isLoading={isLoadingDetails}
        isOpen={!!activeSessionId}
        onClose={() => setActiveSessionId(null)}
        currentUserId={currentUserId}
        onSaveItems={(items) => saveItemsMutation.mutate(items)}
        onSubmitCount={() => submitMutation.mutate()}
        onApproveCount={() => approveMutation.mutate()}
        onOpenRejectModal={() => setIsRejectModalOpen(true)}
        onPostAdjustment={() => postMutation.mutate()}
        isSaving={saveItemsMutation.isPending}
        isSubmitting={submitMutation.isPending}
        isApproving={approveMutation.isPending}
        isPosting={postMutation.isPending}
      />

      {/* Create Modal */}
      <CreateSessionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Reject Modal */}
      <RejectCountModal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        onConfirm={(reason) => rejectMutation.mutate(reason)}
        isLoading={rejectMutation.isPending}
      />
    </div>
  );
}
