import React, { useState, useEffect } from 'react';
import { 
  Users, ShieldCheck, MapPin, KeyRound, UserPlus, RefreshCw, 
  Search, Filter, CheckCircle2, XCircle, AlertTriangle, History, 
  Building2, X, Lock, Eye, EyeOff
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { toast } from 'sonner';
import { API_URL } from '../../app/api-config';

interface Account {
  UserID: number;
  Username: string;
  FullName: string;
  Role: string;
  Barangay: string | null;
  LocationID: number | null;
  IsActive: boolean;
  DateCreated: string;
  LastLogin: string | null;
  LocationName: string | null;
  LocationType: string | null;
  Classification?: string | null;
  MustChangePassword?: boolean;
  AuditLogCount: number;
}

interface Station {
  LocationID: number;
  LocationName: string;
  LocationCode: string;
  LocationType: string;
}

interface AuditLog {
  AuditID: number;
  Action: string;
  OldLocationName: string | null;
  NewLocationName: string | null;
  OldStatus: boolean | null;
  NewStatus: boolean | null;
  Reason: string;
  Details: string | null;
  PerformedDate: string;
  PerformedByName: string;
}

interface AccountManagementProps {
  role?: string;
  userId?: number | null;
}

export function AccountManagement({ role = 'admin', userId = 1 }: AccountManagementProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isReassignOpen, setIsReassignOpen] = useState(false);
  const [isResetPwOpen, setIsResetPwOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [newUsername, setNewUsername] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState('Barangay Health Worker');
  const [newLocationId, setNewLocationId] = useState<number>(0);
  const [newPassword, setNewPassword] = useState('');

  const [reassignLocationId, setReassignLocationId] = useState<number>(0);
  const [reassignReason, setReassignReason] = useState('');

  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetReason, setResetReason] = useState('');

  const [statusReason, setStatusReason] = useState('');

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/accounts`, {
        headers: { 'x-user-id': String(userId || 1) }
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setAccounts(Array.isArray(data) ? data : (data.data || []));
    } catch (err: any) {
      toast.error('Failed to load accounts: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStations = async () => {
    try {
      const res = await fetch(`${API_URL}/api/barangay/locations`);
      if (res.ok) {
        const data = await res.json();
        setStations(data);
      }
    } catch (err) {
      console.error('Failed to fetch stations:', err);
    }
  };

  useEffect(() => {
    fetchAccounts();
    fetchStations();
  }, []);

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim() || !newFullName.trim() || !newPassword.trim()) {
      toast.error('All fields are required.');
      return;
    }
    if (newRole === 'Barangay Health Worker' && !newLocationId) {
      toast.error('Please assign a Barangay Health Station.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/accounts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId || 1)
        },
        body: JSON.stringify({
          username: newUsername.trim(),
          fullName: newFullName.trim(),
          role: newRole,
          password: newPassword,
          locationId: newLocationId || null
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create account');
      }

      toast.success('Account created successfully with audit trail.');
      setIsCreateOpen(false);
      setNewUsername('');
      setNewFullName('');
      setNewPassword('');
      setNewLocationId(0);
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReassign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !reassignLocationId) {
      toast.error('Please select a target health station.');
      return;
    }
    if (!reassignReason.trim()) {
      toast.error('Authorization reason is required for station transfer.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/accounts/${selectedAccount.UserID}/assignment`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId || 1)
        },
        body: JSON.stringify({
          newLocationId: reassignLocationId,
          reason: reassignReason.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reassign station');
      }

      toast.success('Station re-assigned and logged to immutable audit ledger.');
      setIsReassignOpen(false);
      setSelectedAccount(null);
      setReassignReason('');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || !resetNewPassword.trim()) {
      toast.error('New password is required.');
      return;
    }
    if (!resetReason.trim()) {
      toast.error('Administrative reason is required for password reset.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/accounts/${selectedAccount.UserID}/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId || 1)
        },
        body: JSON.stringify({
          newPassword: resetNewPassword.trim(),
          reason: resetReason.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reset password');
      }

      toast.success(`Password reset for ${selectedAccount.FullName}.`);
      setIsResetPwOpen(false);
      setSelectedAccount(null);
      setResetNewPassword('');
      setResetReason('');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    if (!statusReason.trim()) {
      toast.error('Administrative reason is required to alter account status.');
      return;
    }

    setIsSubmitting(true);
    const targetStatus = !selectedAccount.IsActive;
    try {
      const res = await fetch(`${API_URL}/api/admin/accounts/${selectedAccount.UserID}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': String(userId || 1)
        },
        body: JSON.stringify({
          isActive: targetStatus,
          reason: statusReason.trim()
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update account status');
      }

      toast.success(`Account ${targetStatus ? 'activated' : 'deactivated'} successfully.`);
      setIsStatusOpen(false);
      setSelectedAccount(null);
      setStatusReason('');
      fetchAccounts();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewAudit = async (acc: Account) => {
    setSelectedAccount(acc);
    try {
      const res = await fetch(`${API_URL}/api/admin/accounts/${acc.UserID}`);
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.auditLogs || []);
        setIsAuditOpen(true);
      }
    } catch (err: any) {
      toast.error('Failed to load audit trail: ' + err.message);
    }
  };

  const filteredAccounts = accounts.filter(acc => {
    const matchSearch = search === '' || 
      acc.FullName.toLowerCase().includes(search.toLowerCase()) ||
      acc.Username.toLowerCase().includes(search.toLowerCase()) ||
      (acc.Barangay && acc.Barangay.toLowerCase().includes(search.toLowerCase())) ||
      (acc.LocationName && acc.LocationName.toLowerCase().includes(search.toLowerCase()));

    const matchRole = roleFilter === 'ALL' || acc.Role === roleFilter;
    const matchStatus = statusFilter === 'ALL' || 
      (statusFilter === 'ACTIVE' && acc.IsActive) ||
      (statusFilter === 'INACTIVE' && !acc.IsActive);

    return matchSearch && matchRole && matchStatus;
  });

  const totalBhwAccounts = accounts.filter(a => a.Role === 'Barangay Health Worker').length;
  const activeBhwAccounts = accounts.filter(a => a.Role === 'Barangay Health Worker' && a.IsActive).length;
  const uniqueStationsCovered = new Set(accounts.filter(a => a.LocationID).map(a => a.LocationID)).size;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider bg-primary/10 text-primary rounded-lg border border-primary/20">
              Phase 13 Operational Readiness & Security Hardening
            </span>
            <span className="px-2.5 py-1 text-[11px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 rounded-lg border border-emerald-500/20">
              Station Isolation Enforced
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight mt-2">
            Barangay Station Account Management
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            Independent station accounts, authorized credential resets, station reassignments, and immutable audit logs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchAccounts}
            disabled={isLoading}
            className="rounded-xl border-border h-10 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground h-10 text-xs font-bold shadow-sm"
          >
            <UserPlus className="w-3.5 h-3.5 mr-1.5" />
            Create Station Account
          </Button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        <Card className="rounded-2xl border-border/50 shadow-sm p-4 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Accounts</p>
            <Users className="w-4 h-4 text-primary" />
          </div>
          <p className="text-2xl font-black text-foreground mt-2">{accounts.length}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Across all city medical facilities</p>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm p-4 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">BHW Station Accounts</p>
            <Building2 className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-black text-emerald-600 mt-2">{activeBhwAccounts} / {totalBhwAccounts}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Active operational BHW credentials</p>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm p-4 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Stations Assigned</p>
            <MapPin className="w-4 h-4 text-blue-600" />
          </div>
          <p className="text-2xl font-black text-blue-600 mt-2">{uniqueStationsCovered} Stations</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Independent inventory scopes</p>
        </Card>

        <Card className="rounded-2xl border-border/50 shadow-sm p-4 bg-card">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Security Rule</p>
            <ShieldCheck className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-base font-black text-amber-600 mt-2">Zero Client Trust</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">LocationID derived from server auth</p>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card className="rounded-2xl border-border/50 shadow-sm p-4">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative w-full md:flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by full name, username, barangay, or station name..."
              className="pl-9 text-xs rounded-xl h-10 border-border/60"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="h-10 rounded-xl border border-border/60 bg-background px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Roles</option>
              <option value="Barangay Health Worker">Barangay Health Worker</option>
              <option value="Warehouse Staff">Warehouse Staff</option>
              <option value="Pharmacy Staff">Pharmacy Staff</option>
              <option value="Administrator">Administrator</option>
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="h-10 rounded-xl border border-border/60 bg-background px-3 text-xs text-foreground focus:outline-none"
            >
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Deactivated Only</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Accounts Table */}
      <Card className="rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">User Details</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Assigned Health Station</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Audit Events</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="font-semibold text-sm text-foreground">No accounts found</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Try adjusting your search criteria or role filters.</p>
                  </td>
                </tr>
              ) : (
                filteredAccounts.map(acc => (
                  <tr key={acc.UserID} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-foreground">{acc.FullName}</div>
                      <div className="text-[11px] font-mono text-muted-foreground">@{acc.Username}</div>
                      {acc.MustChangePassword && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 mt-1 rounded text-[9px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          <AlertTriangle className="w-2.5 h-2.5" /> Requires Password Change
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        acc.Role === 'Barangay Health Worker' 
                          ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                          : acc.Role === 'Warehouse Staff'
                          ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                          : acc.Role === 'Pharmacy Staff'
                          ? 'bg-blue-500/10 text-blue-600 border border-blue-500/20'
                          : 'bg-purple-500/10 text-purple-600 border border-purple-500/20'
                      }`}>
                        {acc.Role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {acc.LocationName ? (
                        <div>
                          <div className="flex items-center gap-1.5 text-foreground font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>{acc.LocationName}</span>
                            <span className="text-[10px] text-muted-foreground">({acc.Barangay || 'BHS'})</span>
                          </div>
                          {acc.Classification && (
                            <div className="mt-0.5">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold ${acc.Classification.includes("Official") ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-slate-500/10 text-slate-700 dark:text-slate-400"}`}>
                                {acc.Classification}
                              </span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Central / Not Station Scoped</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        acc.IsActive 
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-destructive/10 text-destructive'
                      }`}>
                        {acc.IsActive ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {acc.IsActive ? 'Active' : 'Deactivated'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => handleViewAudit(acc)}
                        className="text-[11px] font-bold text-primary hover:underline"
                      >
                        {acc.AuditLogCount} logs
                      </button>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAccount(acc);
                            setReassignLocationId(acc.LocationID || 0);
                            setIsReassignOpen(true);
                          }}
                          className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                          title="Reassign Station"
                        >
                          <Building2 className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAccount(acc);
                            setIsResetPwOpen(true);
                          }}
                          className="h-8 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
                          title="Reset Password"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedAccount(acc);
                            setIsStatusOpen(true);
                          }}
                          className={`h-8 px-2 text-xs font-semibold ${acc.IsActive ? 'text-destructive hover:bg-destructive/10' : 'text-emerald-600 hover:bg-emerald-50'}`}
                          title={acc.IsActive ? 'Deactivate Account' : 'Activate Account'}
                        >
                          {acc.IsActive ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* CREATE ACCOUNT MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">Create User / BHW Account</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Provision an authorized operator with assigned station scope</p>
              </div>
              <button onClick={() => setIsCreateOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">Full Name</label>
                <Input
                  required
                  value={newFullName}
                  onChange={e => setNewFullName(e.target.value)}
                  placeholder="e.g. Maria Santos (BHW San Antonio)"
                  className="h-10 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">Username</label>
                  <Input
                    required
                    value={newUsername}
                    onChange={e => setNewUsername(e.target.value)}
                    placeholder="e.g. bhw_san_antonio"
                    className="h-10 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">Initial Password</label>
                  <Input
                    type="password"
                    required
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="h-10 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">Role</label>
                <select
                  value={newRole}
                  onChange={e => setNewRole(e.target.value)}
                  className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-xs text-foreground focus:outline-none"
                >
                  <option value="Barangay Health Worker">Barangay Health Worker</option>
                  <option value="Warehouse Staff">Warehouse Staff</option>
                  <option value="Pharmacy Staff">Pharmacy Staff</option>
                  <option value="Administrator">Administrator</option>
                </select>
              </div>

              {newRole === 'Barangay Health Worker' && (
                <div>
                  <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">
                    Assigned Barangay Health Station (LocationID)
                  </label>
                  <select
                    required
                    value={newLocationId}
                    onChange={e => setNewLocationId(Number(e.target.value))}
                    className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-xs text-foreground focus:outline-none"
                  >
                    <option value={0}>Select Barangay Health Station...</option>
                    {stations.map(st => (
                      <option key={st.LocationID} value={st.LocationID}>
                        {st.LocationName} ({st.LocationCode})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    * BHW user will only be permitted to view and disburse stock assigned to this station.
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">
                  {isSubmitting ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REASSIGN STATION MODAL */}
      {isReassignOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">Reassign Health Station</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Transfer account scope with mandatory authorization audit reason</p>
              </div>
              <button onClick={() => setIsReassignOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReassign} className="p-5 space-y-4">
              <div className="p-3 bg-muted/30 rounded-xl border border-border/60 text-xs space-y-1">
                <div><span className="text-muted-foreground">Officer:</span> <strong className="text-foreground">{selectedAccount.FullName}</strong></div>
                <div><span className="text-muted-foreground">Current Station:</span> <strong className="text-foreground">{selectedAccount.LocationName || 'None'}</strong></div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">New Health Station</label>
                <select
                  required
                  value={reassignLocationId}
                  onChange={e => setReassignLocationId(Number(e.target.value))}
                  className="w-full h-10 rounded-xl border border-border/60 bg-background px-3 text-xs text-foreground focus:outline-none"
                >
                  <option value={0}>Select Target Station...</option>
                  {stations.map(st => (
                    <option key={st.LocationID} value={st.LocationID}>
                      {st.LocationName} ({st.LocationCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">
                  Authorization Reason <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  value={reassignReason}
                  onChange={e => setReassignReason(e.target.value)}
                  placeholder="e.g. Official rotation per City Health Office Special Order No. 42"
                  className="h-10 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsReassignOpen(false)} disabled={isSubmitting} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">
                  {isSubmitting ? 'Reassigning...' : 'Confirm Reassignment'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RESET PASSWORD MODAL */}
      {isResetPwOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">Reset Account Password</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Issue new credentials with mandatory administrative justification</p>
              </div>
              <button onClick={() => setIsResetPwOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-4">
              <div className="p-3 bg-muted/30 rounded-xl border border-border/60 text-xs space-y-1">
                <div><span className="text-muted-foreground">Officer:</span> <strong className="text-foreground">{selectedAccount.FullName}</strong></div>
                <div><span className="text-muted-foreground">Username:</span> <strong className="font-mono text-foreground">{selectedAccount.Username}</strong></div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">New Password</label>
                <Input
                  type="password"
                  required
                  value={resetNewPassword}
                  onChange={e => setResetNewPassword(e.target.value)}
                  placeholder="Enter new temporary password"
                  className="h-10 text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">
                  Administrative Reason <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  value={resetReason}
                  onChange={e => setResetReason(e.target.value)}
                  placeholder="e.g. Officer requested credential reset following terminal maintenance"
                  className="h-10 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsResetPwOpen(false)} disabled={isSubmitting} className="text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs">
                  {isSubmitting ? 'Updating...' : 'Reset Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOGGLE STATUS MODAL */}
      {isStatusOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">
                  {selectedAccount.IsActive ? 'Deactivate Account' : 'Reactivate Account'}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Toggle operational login rights with mandatory justification</p>
              </div>
              <button onClick={() => setIsStatusOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleToggleStatus} className="p-5 space-y-4">
              <div className={`p-3.5 rounded-xl border text-xs ${
                selectedAccount.IsActive 
                  ? 'bg-destructive/10 border-destructive/20 text-destructive'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
              }`}>
                {selectedAccount.IsActive ? (
                  <><strong>Warning:</strong> Deactivating will immediately revoke login access for <strong>{selectedAccount.FullName}</strong>. Their station records remain securely preserved.</>
                ) : (
                  <>Reactivating will restore login access for <strong>{selectedAccount.FullName}</strong> to health station <strong>{selectedAccount.LocationName}</strong>.</>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">
                  Justification Reason <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  value={statusReason}
                  onChange={e => setStatusReason(e.target.value)}
                  placeholder="e.g. Temporary leave of absence / End of duty rotation"
                  className="h-10 text-xs"
                />
              </div>

              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsStatusOpen(false)} disabled={isSubmitting} className="text-xs">
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className={`font-bold text-xs ${selectedAccount.IsActive ? 'bg-destructive hover:bg-destructive/90 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}
                >
                  {isSubmitting ? 'Updating...' : selectedAccount.IsActive ? 'Deactivate Account' : 'Reactivate Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AUDIT LOG MODAL */}
      {isAuditOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-foreground">Immutable Audit Trail</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Chronological history of administrative actions for <strong>{selectedAccount.FullName}</strong> (@{selectedAccount.Username})
                </p>
              </div>
              <button onClick={() => setIsAuditOpen(false)} className="p-1 rounded-lg text-muted-foreground hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3">
              {auditLogs.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">
                  <History className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="font-semibold text-xs">No audit logs recorded for this account yet.</p>
                </div>
              ) : (
                auditLogs.map(log => (
                  <div key={log.AuditID} className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground uppercase tracking-wider">{log.Action}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {new Date(log.PerformedDate).toLocaleDateString()} {new Date(log.PerformedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-foreground">
                      <span className="text-muted-foreground font-semibold">Reason:</span> {log.Reason}
                    </p>

                    {log.Details && (
                      <p className="text-muted-foreground text-[11px]">
                        <span className="font-semibold">Details:</span> {log.Details}
                      </p>
                    )}

                    <div className="text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                      Authorized by: <strong className="text-foreground">{log.PerformedByName || 'System Administrator'}</strong>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-border flex justify-end">
              <Button variant="outline" onClick={() => setIsAuditOpen(false)} className="text-xs">
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
