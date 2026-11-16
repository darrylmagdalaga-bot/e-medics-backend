import React, { useState } from 'react';
import { 
  Users, Plus, Search, Filter, Calendar, CheckCircle2, 
  XCircle, Pill, ArrowUpRight, X, UserCheck, RotateCcw, 
  AlertTriangle, Printer, FileText, ChevronRight, RefreshCw, Send
} from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { toast } from 'sonner';
import { BarangayDisbursement, BarangayStockLot } from '../types';
import { submitDisbursement, reverseDisbursement } from '../api';
import { BarangayVoucherModal } from './BarangayVoucherModal';

interface BarangayDisbursementsProps {
  userId: number | null;
  barangayName: string;
  disbursements: BarangayDisbursement[];
  inventory: BarangayStockLot[];
  onRefresh: () => void;
  isLoading: boolean;
}

const COMMON_DOSAGES = [
  'Take 1 tablet daily with meals',
  'Take 1 capsule 3x daily after meals',
  'Take 1 tablet every 8 hours as needed for fever/pain',
  'Take 1 tablet at bedtime',
  'Apply/take as directed by health worker'
];

const COMMON_PROGRAMS = [
  'Primary Care / Outpatient Care',
  'Hypertension & Diabetes Maintenance',
  'Maternal & Child Health Care',
  'Senior Citizen Wellness Program',
  'Emergency Community Relief'
];

export function BarangayDisbursements({
  userId,
  barangayName,
  disbursements,
  inventory,
  onRefresh,
  isLoading
}: BarangayDisbursementsProps) {
  const [search, setSearch] = useState('');
  const [medSearch, setMedSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Reversal Modal State
  const [isReverseModalOpen, setIsReverseModalOpen] = useState(false);
  const [selectedDisbursement, setSelectedDisbursement] = useState<BarangayDisbursement | null>(null);
  const [reversalReason, setReversalReason] = useState('');
  const [isReversing, setIsReversing] = useState(false);

  // Voucher Modal State
  const [voucherModalDisbursementId, setVoucherModalDisbursementId] = useState<number | null>(null);
  const [voucherModalInitialData, setVoucherModalInitialData] = useState<BarangayDisbursement | null>(null);

  // Form State
  const [recipientName, setRecipientName] = useState('');
  const [recipientContact, setRecipientContact] = useState('');
  const [purpose, setPurpose] = useState('Primary Care / Outpatient Care');
  const [disbItems, setDisbItems] = useState<{ medicineId: number; quantity: number; dosageInstructions: string }[]>([
    { medicineId: 0, quantity: 1, dosageInstructions: 'Take 1 tablet daily with meals' }
  ]);

  // Aggregate available non-expired stock per medicine
  const availableStockByMed = React.useMemo(() => {
    const map = new Map<number, { name: string; available: number; form: string; dosage: string }>();
    inventory.forEach(lot => {
      if (lot.Quantity > 0 && lot.ExpiryStatus !== 'Expired') {
        const prev = map.get(lot.MedicineID) || { 
          name: lot.ProductName, 
          available: 0,
          form: lot.Form || '',
          dosage: lot.Dosage || ''
        };
        prev.available += lot.Quantity;
        map.set(lot.MedicineID, prev);
      }
    });
    return map;
  }, [inventory]);

  const getFefoPreview = (medicineId: number, requestedQty: number) => {
    if (!medicineId || requestedQty <= 0) return [];
    const eligibleLots = inventory
      .filter((l) => l.MedicineID === medicineId && l.Quantity > 0 && l.ExpiryStatus !== 'Expired')
      .sort((a, b) => new Date(a.ExpiryDate).getTime() - new Date(b.ExpiryDate).getTime());
    let rem = requestedQty;
    const allocations: { lotNumber: string; expiryDate: string; takeQty: number }[] = [];
    for (const lot of eligibleLots) {
      if (rem <= 0) break;
      const take = Math.min(rem, lot.Quantity);
      allocations.push({ lotNumber: lot.LotNumber, expiryDate: lot.ExpiryDate, takeQty: take });
      rem -= take;
    }
    return allocations;
  };

  const handleOpenReverse = (d: BarangayDisbursement, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedDisbursement(d);
    setReversalReason('');
    setIsReverseModalOpen(true);
  };

  const handleOpenVoucher = (d: BarangayDisbursement, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setVoucherModalDisbursementId(d.DisbursementID);
    setVoucherModalInitialData(d);
  };

  const handleConfirmReversal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDisbursement) return;
    if (!reversalReason.trim()) {
      toast.error('Reversal reason is required.');
      return;
    }

    setIsReversing(true);
    try {
      await reverseDisbursement(selectedDisbursement.DisbursementID, userId, reversalReason.trim());
      toast.success('Disbursement reversed and stock restored to inventory.');
      setIsReverseModalOpen(false);
      setSelectedDisbursement(null);
      setReversalReason('');
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to reverse disbursement');
    } finally {
      setIsReversing(false);
    }
  };

  const handleAddItem = () => {
    setDisbItems(prev => [...prev, { medicineId: 0, quantity: 1, dosageInstructions: 'Take 1 tablet daily with meals' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (disbItems.length === 1) return;
    setDisbItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setDisbItems(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!recipientName.trim()) {
      toast.error('Resident / Recipient name is required.');
      return;
    }

    const validItems = disbItems.filter(i => i.medicineId > 0 && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Please select at least one medicine with valid quantity.');
      return;
    }

    // Client-side availability check
    for (const it of validItems) {
      const stock = availableStockByMed.get(it.medicineId);
      if (!stock || stock.available < it.quantity) {
        toast.error(`Insufficient stock for ${stock?.name || 'Selected medicine'}. Available: ${stock?.available || 0}, Requested: ${it.quantity}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await submitDisbursement(userId, {
        recipientName: recipientName.trim(),
        recipientBarangay: barangayName,
        recipientContact: recipientContact.trim(),
        purpose: purpose.trim(),
        items: validItems
      });

      toast.success(`Disbursement ${res.disbursementNumber} recorded with FEFO deduction!`);
      setIsModalOpen(false);
      
      // Auto-open voucher modal for preview and printing
      if (res.disbursementId) {
        setVoucherModalDisbursementId(res.disbursementId);
        setVoucherModalInitialData({
          DisbursementID: res.disbursementId,
          DisbursementNumber: res.disbursementNumber,
          BarangayName: barangayName,
          LocationID: 0,
          RecipientName: recipientName.trim(),
          DisbursementDate: new Date().toISOString(),
          Status: 'Completed',
          Remarks: purpose.trim(),
          ItemCount: validItems.length,
          TotalQuantity: validItems.reduce((s, i) => s + i.quantity, 0)
        });
      }

      setRecipientName('');
      setRecipientContact('');
      setDisbItems([{ medicineId: 0, quantity: 1, dosageInstructions: 'Take 1 tablet daily with meals' }]);
      onRefresh();
    } catch (err: any) {
      toast.error(err.message || 'Failed to disburse medicines');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredDisbursements = disbursements.filter(d => 
    d.DisbursementNumber.toLowerCase().includes(search.toLowerCase()) ||
    d.RecipientName.toLowerCase().includes(search.toLowerCase()) ||
    (d.Remarks || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Patient Medicine Releases
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Release medicines to Barangay residents with FEFO batch deduction, printable vouchers, and audit trails
          </p>
        </div>

        <Button
          onClick={() => setIsModalOpen(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-11 sm:h-9 rounded-xl px-4 shadow-sm shadow-purple-600/20 flex items-center justify-center gap-1.5 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Release Medicine</span>
        </Button>
      </div>

      {/* Search Input */}
      <Card className="rounded-2xl border-border/50 shadow-sm p-3.5 sm:p-4">
        <div className="relative w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Voucher #, Recipient Name, or Health Program..."
            className="pl-9 pr-9 text-xs rounded-xl h-10 border-border/60"
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </Card>

      {/* MOBILE VIEW (< 768px): Dedicated Disbursement Cards */}
      <div className="block md:hidden space-y-3">
        {filteredDisbursements.length === 0 ? (
          <Card className="rounded-2xl border-border/50 shadow-sm p-8 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
            <p className="font-bold text-sm text-foreground">No disbursements found</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap "Disburse to Resident" to dispense medicines to community members.
            </p>
          </Card>
        ) : (
          filteredDisbursements.map(d => {
            const isReversed = d.Status === 'Reversed';
            return (
              <Card 
                key={d.DisbursementID} 
                onClick={() => handleOpenVoucher(d)}
                className={`rounded-2xl border bg-card shadow-sm hover:shadow-md transition-shadow p-4 space-y-2.5 cursor-pointer active:bg-muted/30 ${
                  isReversed ? 'border-destructive/30 bg-destructive/5' : 'border-border/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-mono font-black text-sm text-foreground">{d.DisbursementNumber}</div>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    isReversed 
                      ? 'bg-destructive/15 text-destructive border border-destructive/30' 
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                  }`}>
                    {isReversed ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                    {d.Status || 'Completed'}
                  </span>
                </div>

                <div>
                  <div className="text-sm font-black text-foreground">{d.RecipientName}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    Barangay {d.BarangayName} • Disbursed by {d.DisbursedByName || 'BHW on duty'}
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs pt-2 border-t border-border/40 text-muted-foreground">
                  <div>
                    <strong className="text-primary font-bold">{d.ItemCount || 0}</strong> medicines ({d.TotalQuantity || 0} units)
                  </div>
                  <div className="text-[11px]">
                    {new Date(d.DisbursementDate).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions row */}
                <div className="pt-2 border-t border-border/40 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={(e) => handleOpenVoucher(d, e)}
                    className="text-xs h-8 px-2.5 rounded-lg flex items-center gap-1 text-foreground"
                  >
                    <Printer className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>View Voucher</span>
                  </Button>

                  {!isReversed && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => handleOpenReverse(d, e)}
                      className="text-xs h-8 px-2.5 rounded-lg text-destructive hover:bg-destructive/10 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reverse</span>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* TABLET & DESKTOP VIEW (>= 768px): Structured Table */}
      <Card className="hidden md:block rounded-2xl border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border/50 text-muted-foreground font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4">Voucher #</th>
                <th className="py-3.5 px-4">Recipient Resident</th>
                <th className="py-3.5 px-4">Barangay</th>
                <th className="py-3.5 px-4">Disbursed By</th>
                <th className="py-3.5 px-4 text-center">Items / Units</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Date Disbursed</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filteredDisbursements.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Users className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="font-semibold text-sm text-foreground">No disbursements recorded yet</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Click "Disburse to Resident" to dispense medicines to community members.</p>
                  </td>
                </tr>
              ) : (
                filteredDisbursements.map(d => (
                  <tr key={d.DisbursementID} className="hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono font-black text-foreground">
                      {d.DisbursementNumber}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground">
                      {d.RecipientName}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {d.BarangayName}
                    </td>
                    <td className="py-3 px-4 text-muted-foreground">
                      {d.DisbursedByName || 'BHW on Duty'}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-primary">
                      {d.ItemCount} items ({d.TotalQuantity} units)
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        d.Status === 'Reversed'
                          ? 'bg-destructive/10 text-destructive border border-destructive/20'
                          : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                      }`}>
                        {d.Status === 'Reversed' ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {d.Status || 'Completed'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-muted-foreground">
                      {new Date(d.DisbursementDate).toLocaleDateString()} {new Date(d.DisbursementDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenVoucher(d)}
                          className="h-8 px-2 text-xs font-semibold rounded-lg flex items-center gap-1"
                          title="View Official Voucher"
                        >
                          <Printer className="w-3.5 h-3.5" /> Voucher
                        </Button>

                        {d.Status !== 'Reversed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenReverse(d)}
                            className="h-8 px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-lg flex items-center gap-1"
                            title="Reverse Disbursement & Restore Stock"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Reverse
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* MOBILE-FIRST CREATE DISBURSEMENT MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto max-h-[95dvh]">
            
            {/* Sticky Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between shrink-0 bg-secondary/40">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-purple-600/20 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm sm:text-base font-black text-foreground truncate">Patient Medicine Release</h3>
                  <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5 truncate">Automated First-Expiry-First-Out (FEFO) batch deduction &amp; voucher</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-muted-foreground hover:bg-muted shrink-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              
              {/* Resident Info Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center shrink-0">1</span>
                  <span className="text-xs font-black uppercase tracking-wider text-foreground">Recipient Information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Resident Full Name *</label>
                    <Input
                      required
                      value={recipientName}
                      onChange={e => setRecipientName(e.target.value)}
                      placeholder="e.g. Maria Clara De Los Santos"
                      className="h-11 sm:h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-foreground mb-1.5">Contact Number (Optional)</label>
                    <Input
                      type="tel"
                      inputMode="tel"
                      value={recipientContact}
                      onChange={e => setRecipientContact(e.target.value)}
                      placeholder="e.g. 0917-123-4567"
                      className="h-11 sm:h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-foreground mb-1.5">Health Program / Purpose</label>
                  <select
                    value={purpose}
                    onChange={(e: any) => setPurpose(e.target.value)}
                    className="w-full h-11 sm:h-10 rounded-xl border border-border/70 bg-background px-3 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    {COMMON_PROGRAMS.map(prog => (
                      <option key={prog} value={prog}>{prog}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Medicines Section */}
              <div className="space-y-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center shrink-0">2</span>
                    <span className="text-xs font-black uppercase tracking-wider text-foreground">Medicines to Release</span>
                  </div>
                  <Button
                    type="button"
                    onClick={handleAddItem}
                    variant="outline"
                    size="sm"
                    className="text-xs font-bold h-9 px-3 rounded-xl border-primary/30 text-primary hover:bg-accent"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Medicine
                  </Button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={medSearch}
                    onChange={(e) => setMedSearch(e.target.value)}
                    placeholder="Filter in-stock medicines..."
                    className="pl-8 h-9 text-xs rounded-xl bg-secondary/40 border-border"
                  />
                </div>

                <div className="space-y-3">
                  {disbItems.map((item, idx) => {
                    const selectedInfo = availableStockByMed.get(item.medicineId);

                    return (
                      <div key={idx} className="p-3.5 rounded-xl border border-border/60 bg-muted/20 space-y-3">
                        <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
                          <div className="flex-1 w-full">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                              Select In-Stock Medicine
                            </label>
                            <select
                              required
                              value={item.medicineId}
                              onChange={e => handleItemChange(idx, 'medicineId', Number(e.target.value))}
                              className="w-full h-11 sm:h-10 rounded-xl border border-border/70 bg-background px-3 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value={0}>Select Available Medicine...</option>
                              {Array.from(availableStockByMed.entries())
                                .filter(([medId, info]) => medId === item.medicineId || !medSearch.trim() || info.name.toLowerCase().includes(medSearch.toLowerCase()))
                                .map(([medId, info]) => (
                                <option key={medId} value={medId}>
                                  {info.name} (Stock: {info.available} units)
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="w-full sm:w-32 flex items-center justify-between sm:justify-start gap-2">
                            <div className="flex-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">
                                Qty {selectedInfo ? `(Max ${selectedInfo.available})` : ''}
                              </label>
                              <div className="flex items-center gap-1.5">
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  max={selectedInfo?.available || 9999}
                                  required
                                  value={item.quantity}
                                  onChange={e => handleItemChange(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                                  className="h-11 sm:h-10 text-xs font-black text-center rounded-xl"
                                />
                                <span className="text-[10px] text-muted-foreground uppercase font-bold shrink-0">pcs</span>
                              </div>
                            </div>

                            {disbItems.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveItem(idx)}
                                className="p-2 text-muted-foreground hover:text-red-600 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center sm:min-h-0 sm:min-w-0 self-end mb-0.5"
                                aria-label="Remove medicine"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Live FEFO Allocation Preview */}
                        {item.medicineId > 0 && item.quantity > 0 && (
                          <div className="p-2.5 rounded-xl bg-secondary/60 border border-border text-[11px] space-y-1">
                            <span className="font-bold text-foreground uppercase tracking-wider text-[10px] block">
                              FEFO Batch Allocation Preview
                            </span>
                            {getFefoPreview(item.medicineId, item.quantity).length === 0 ? (
                              <span className="text-rose-600 dark:text-rose-400 font-semibold">
                                No non-expired stock lots available.
                              </span>
                            ) : (
                              <div className="flex flex-wrap gap-1.5">
                                {getFefoPreview(item.medicineId, item.quantity).map((alloc) => (
                                  <span
                                    key={alloc.lotNumber}
                                    className="px-2 py-0.5 rounded-lg bg-card border border-border text-foreground font-mono text-[10px]"
                                  >
                                    Lot {alloc.lotNumber} (Exp {new Date(alloc.expiryDate).toLocaleDateString()}):{' '}
                                    <strong className="text-primary">{alloc.takeQty}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Dosage Instructions Input with Quick Chips */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase block">
                            Dosage Instructions / Patient Regimen
                          </label>
                          <Input
                            value={item.dosageInstructions}
                            onChange={e => handleItemChange(idx, 'dosageInstructions', e.target.value)}
                            placeholder="e.g. Take 1 tablet daily with meals"
                            className="h-10 text-xs rounded-xl bg-background"
                          />
                          <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar">
                            {COMMON_DOSAGES.map(d => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => handleItemChange(idx, 'dosageInstructions', d)}
                                className="px-2 py-0.5 rounded text-[10px] font-medium bg-muted hover:bg-muted/80 text-muted-foreground whitespace-nowrap"
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guidance Box */}
              <div className="p-3 bg-accent/60 border border-primary/20 rounded-xl text-xs text-foreground flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] font-black flex items-center justify-center shrink-0 mt-0.5">3</span><div><strong className="block text-[11px] uppercase tracking-wider">FEFO Batch Safeguard</strong>The database engine automatically selects and deducts units from batches with the earliest expiration dates. An official electronic voucher will be generated immediately.</div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-border flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  className="text-xs h-11 sm:h-9 px-4 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-11 sm:h-9 px-5 rounded-xl shadow-sm shadow-purple-600/20 flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Recording Release...' : 'Confirm Medicine Release'}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* COMPENSATING REVERSAL MODAL */}
      {isReverseModalOpen && selectedDisbursement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col my-auto">
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-black text-foreground">Transaction Reversal</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">Authorized compensating transaction with automated stock return</p>
              </div>
              <button 
                onClick={() => setIsReverseModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReversal} className="p-4 sm:p-5 space-y-4">
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs space-y-1 text-destructive">
                <div className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  Audited Reversal Action
                </div>
                <p className="text-[11px] text-foreground">
                  Voucher <strong>{selectedDisbursement.DisbursementNumber}</strong> for <strong>{selectedDisbursement.RecipientName}</strong> will be marked <strong>Reversed</strong>.
                  All disbursed units will be automatically restored to <strong>{selectedDisbursement.BarangayName}</strong> inventory batches.
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground uppercase tracking-wider block mb-1">
                  Mandatory Reversal Reason <span className="text-destructive">*</span>
                </label>
                <Input
                  required
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="e.g. Patient changed prescription, unopened medicine returned"
                  className="h-11 sm:h-10 text-xs rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReverseModalOpen(false)}
                  disabled={isReversing}
                  className="text-xs h-10 px-4 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isReversing}
                  className="bg-destructive hover:bg-destructive/90 text-white font-bold text-xs h-10 px-4 rounded-xl shadow-sm"
                >
                  {isReversing ? 'Reversing...' : 'Confirm Reversal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE VOUCHER MODAL */}
      {voucherModalDisbursementId && (
        <BarangayVoucherModal
          disbursementId={voucherModalDisbursementId}
          userId={userId}
          initialData={voucherModalInitialData}
          onClose={() => {
            setVoucherModalDisbursementId(null);
            setVoucherModalInitialData(null);
          }}
        />
      )}
    </div>
  );
}