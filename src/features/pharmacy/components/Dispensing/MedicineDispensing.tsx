import React, { useState, useEffect, useMemo } from 'react';
import {
  Pill,
  Search,
  User,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Printer,
  FileText,
  ShieldCheck,
  Calendar,
  AlertTriangle,
  X,
  ChevronDown,
  Package,
  Layers,
  ArrowRight,
  UserCheck,
  Check
} from 'lucide-react';
import { pharmacyApi } from '../../api';
import { Patient, PharmacyStockItem } from '../../types';

interface BatchAllocation {
  stockId: number;
  lotNumber: string;
  expiryDate: string;
  availableInBatch: number;
  allocatedQuantity: number;
  daysToExpiry?: number;
}

interface CartItem {
  medicineId: number;
  productName: string;
  genericName: string;
  quantity: number;
  availableStock: number;
  dosageInstructions: string;
  allocations?: BatchAllocation[];
  shortageQuantity?: number;
  canFulfill?: boolean;
}

interface MedicineDispensingProps {
  userId?: number;
}

export function MedicineDispensing({ userId: propUserId }: MedicineDispensingProps = {}) {
  // Resolved authenticated user identity
  const currentUserId = useMemo(() => {
    if (propUserId) return propUserId;
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pharma_userId') || localStorage.getItem('userId');
      if (stored) return Number(stored);
    }
    return 1;
  }, [propUserId]);

  const currentUserName = useMemo(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('pharma_userName') || localStorage.getItem('userName') || 'City Pharmacist';
    }
    return 'City Pharmacist';
  }, []);

  // Patient state
  const [patientSearch, setPatientSearch] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchingPatients, setSearchingPatients] = useState(false);

  // Prescription Metadata state
  const [prescriptionNumber, setPrescriptionNumber] = useState('');
  const [physicianName, setPhysicianName] = useState('');
  const [remarks, setRemarks] = useState('');

  // Medicines inventory state
  const [availableMedicines, setAvailableMedicines] = useState<PharmacyStockItem[]>([]);
  const [loadingMeds, setLoadingMeds] = useState(false);
  const [selectedMedicineId, setSelectedMedicineId] = useState<string>('');
  const [inputQuantity, setInputQuantity] = useState<number>(1);
  const [inputDosage, setInputDosage] = useState<string>('');

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [allocatingFefo, setAllocatingFefo] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Pre-dispensing confirmation dialog state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Completed Voucher Modal state
  const [completedVoucher, setCompletedVoucher] = useState<{
    dispenseNumber: string;
    saleId: number;
    patientName: string;
    patientBarangay?: string;
    prescriptionNumber?: string;
    physicianName?: string;
    pharmacistName: string;
    dispensedDate: string;
    items: any[];
  } | null>(null);

  // Mobile step state
  const [mobileStep, setMobileStep] = useState<'patient' | 'medicine' | 'review'>('patient');

  // Load available non-expired medicines
  const loadAvailableMedicines = async () => {
    try {
      setLoadingMeds(true);
      const data = await pharmacyApi.getInventory({ status: 'available' });
      // Deduplicate by MedicineID and sum quantity for selection dropdown
      const grouped: { [id: number]: PharmacyStockItem & { totalQty: number } } = {};
      data.forEach((item) => {
        if (!grouped[item.MedicineID]) {
          grouped[item.MedicineID] = { ...item, totalQty: item.Quantity };
        } else {
          grouped[item.MedicineID].totalQty += item.Quantity;
        }
      });
      setAvailableMedicines(Object.values(grouped));
    } catch (err) {
      console.error('Failed to load medicines:', err);
    } finally {
      setLoadingMeds(false);
    }
  };

  useEffect(() => {
    loadAvailableMedicines();
  }, []);

  // Search patients debounced
  useEffect(() => {
    if (!patientSearch.trim()) {
      setPatients([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        setSearchingPatients(true);
        const results = await pharmacyApi.searchPatients(patientSearch);
        setPatients(results);
      } catch (err) {
        console.error('Failed to search patients:', err);
      } finally {
        setSearchingPatients(false);
      }
    }, 250);
    return () => clearTimeout(timeout);
  }, [patientSearch]);

  // Recalculate FEFO allocations whenever cart items or quantities change
  const recalculateFefoAllocations = async (currentCart: CartItem[]) => {
    if (currentCart.length === 0) return;
    try {
      setAllocatingFefo(true);
      const itemsPayload = currentCart.map((c) => ({
        medicineId: c.medicineId,
        quantity: c.quantity,
      }));
      const preview = await pharmacyApi.previewAllocation(itemsPayload);

      setCart((prev) =>
        prev.map((item) => {
          const match = preview.find((p: any) => p.medicineId === item.medicineId);
          if (match) {
            return {
              ...item,
              allocations: match.allocations || [],
              shortageQuantity: match.shortageQuantity || 0,
              canFulfill: match.canFulfill !== false,
            };
          }
          return item;
        })
      );
    } catch (err) {
      console.error('Failed to preview FEFO allocation:', err);
    } finally {
      setAllocatingFefo(false);
    }
  };

  const handleAddToCart = async () => {
    if (!selectedMedicineId) return;
    const medId = Number(selectedMedicineId);
    const med = availableMedicines.find((m) => m.MedicineID === medId);
    if (!med) return;

    if (inputQuantity <= 0) {
      setFeedback({ type: 'error', message: 'Requested quantity must be greater than zero.' });
      return;
    }

    const available = (med as any).totalQty || 0;
    const existing = cart.find((c) => c.medicineId === medId);
    const totalRequested = (existing ? existing.quantity : 0) + inputQuantity;

    if (totalRequested > available) {
      setFeedback({
        type: 'error',
        message: `Insufficient non-expired stock for ${med.ProductName}. Total available in pharmacy is ${available}, but ${totalRequested} units were requested.`,
      });
      return;
    }

    let updatedCart: CartItem[];
    if (existing) {
      updatedCart = cart.map((c) =>
        c.medicineId === medId
          ? {
              ...c,
              quantity: totalRequested,
              dosageInstructions: inputDosage || c.dosageInstructions,
            }
          : c
      );
    } else {
      updatedCart = [
        ...cart,
        {
          medicineId: medId,
          productName: med.ProductName,
          genericName: med.GenericName || '',
          quantity: inputQuantity,
          availableStock: available,
          dosageInstructions: inputDosage,
        },
      ];
    }

    setCart(updatedCart);
    setSelectedMedicineId('');
    setInputQuantity(1);
    setInputDosage('');
    setFeedback(null);

    // Compute FEFO allocation for updated cart
    await recalculateFefoAllocations(updatedCart);
  };

  const handleRemoveFromCart = (medicineId: number) => {
    const updated = cart.filter((c) => c.medicineId !== medicineId);
    setCart(updated);
    if (updated.length > 0) {
      recalculateFefoAllocations(updated);
    }
  };

  const handleQtyChange = (medicineId: number, delta: number) => {
    const updated = cart.map((c) => {
      if (c.medicineId !== medicineId) return c;
      const newQty = Math.max(1, Math.min(c.availableStock, c.quantity + delta));
      return { ...c, quantity: newQty };
    });
    setCart(updated);
    recalculateFefoAllocations(updated);
  };

  const totalCartUnits = useMemo(() => {
    return cart.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  }, [cart]);

  const hasShortageInCart = useMemo(() => {
    return cart.some((item) => (item.shortageQuantity || 0) > 0 || item.canFulfill === false);
  }, [cart]);

  // Open confirmation modal
  const handleOpenConfirmModal = () => {
    if (!selectedPatient) {
      setFeedback({ type: 'error', message: 'Please select a registered patient before confirming.' });
      return;
    }
    if (cart.length === 0) {
      setFeedback({ type: 'error', message: 'Please add at least one medicine item to the dispensing cart.' });
      return;
    }
    if (hasShortageInCart) {
      setFeedback({
        type: 'error',
        message: 'Cannot proceed: One or more medicines in your cart exceed available non-expired pharmacy stock.',
      });
      return;
    }
    setFeedback(null);
    setIsConfirmModalOpen(true);
  };

  // Finalize Dispense Execution (Atomic submission)
  const handleFinalizeDispense = async () => {
    if (!selectedPatient || cart.length === 0) return;

    try {
      setSubmitting(true);
      setFeedback(null);

      const payload = {
        patientId: selectedPatient.PatientID,
        prescriptionNumber: prescriptionNumber.trim() || undefined,
        physicianName: physicianName.trim() || undefined,
        remarks: remarks.trim() || undefined,
        userId: currentUserId,
        items: cart.map((c) => ({
          medicineId: c.medicineId,
          quantity: c.quantity,
          dosageInstructions: c.dosageInstructions || undefined,
        })),
      };

      const result = await pharmacyApi.dispense(payload);

      setCompletedVoucher({
        dispenseNumber: result.dispenseNumber,
        saleId: result.saleId,
        patientName: selectedPatient.FullName,
        patientBarangay: selectedPatient.Barangay,
        prescriptionNumber: prescriptionNumber.trim(),
        physicianName: physicianName.trim(),
        pharmacistName: result.dispensedBy?.fullName || currentUserName,
        dispensedDate: new Date().toLocaleString(),
        items: result.dispensedItems || [],
      });

      // Reset form
      setIsConfirmModalOpen(false);
      setCart([]);
      setSelectedPatient(null);
      setPatientSearch('');
      setPrescriptionNumber('');
      setPhysicianName('');
      setRemarks('');
      setMobileStep('patient');
      await loadAvailableMedicines();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to complete medicine dispensing' });
      setIsConfirmModalOpen(false);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // ── MOBILE STEP WIZARD BAR ──────────────────────────────────────────────────
  const MobileStepBar = () => (
    <div className="flex items-center gap-0 mb-4">
      {(['patient', 'medicine', 'review'] as const).map((step, idx) => {
        const labels = { patient: '1. Patient', medicine: '2. Medicine', review: '3. Confirm' };
        const isActive = mobileStep === step;
        const isDone =
          (step === 'patient' && (mobileStep === 'medicine' || mobileStep === 'review')) ||
          (step === 'medicine' && mobileStep === 'review');
        return (
          <React.Fragment key={step}>
            <div
              className={`flex-1 py-2 text-center text-xs font-semibold rounded-xl transition-colors ${
                isActive
                  ? 'bg-teal-600 text-white shadow-xs'
                  : isDone
                  ? 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {labels[step]}
            </div>
            {idx < 2 && <div className="w-2 h-0.5 bg-border shrink-0" />}
          </React.Fragment>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Feedback Alert Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between border shadow-xs ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="p-1 hover:opacity-75 cursor-pointer font-bold shrink-0 text-muted-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Authenticated Pharmacist Status Strip */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-card/60 border border-border rounded-xl text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <UserCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span>Dispensing Officer: <strong className="text-foreground">{currentUserName}</strong></span>
          <span className="text-[10px] font-mono text-muted-foreground/70">(ID: #{currentUserId})</span>
        </div>
        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold text-[11px]">
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Authenticated Session</span>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          MOBILE WIZARD (< md)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="md:hidden space-y-4">
        <MobileStepBar />

        {/* ── Step 1: Patient ── */}
        {mobileStep === 'patient' && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <User className="w-4 h-4 text-teal-600" />
              Patient Identification
            </h3>

            {selectedPatient ? (
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 relative space-y-1">
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="absolute top-3 right-3 text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                >
                  Change
                </button>
                <div className="font-bold text-sm text-foreground">
                  {selectedPatient.FullName}
                </div>
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <div>Patient ID: <span className="font-mono font-bold text-foreground">#{selectedPatient.PatientID}</span></div>
                  <div>Barangay: <strong className="text-foreground">{selectedPatient.Barangay || 'Not specified'}</strong></div>
                  <div>Contact: {selectedPatient.ContactNumber || '—'}</div>
                  {selectedPatient.BirthDate && (
                    <div>DOB: {new Date(selectedPatient.BirthDate).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search patient by name or phone..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-3 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground"
                  />
                  {searchingPatients && (
                    <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
                  )}
                </div>

                {patients.length > 0 && (
                  <div className="border border-border rounded-xl max-h-64 overflow-y-auto divide-y divide-border/60 shadow-sm bg-card">
                    {patients.map((p) => (
                      <button
                        key={p.PatientID}
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatients([]);
                          setPatientSearch('');
                        }}
                        className="w-full text-left p-3.5 hover:bg-muted/40 cursor-pointer transition-colors min-h-[52px]"
                      >
                        <div className="font-semibold text-foreground text-sm">
                          {p.FullName}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          ID: #{p.PatientID} · {p.Barangay || 'No barangay'} · {p.ContactNumber || 'No contact'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Prescription Details */}
            <div className="space-y-3 pt-2 border-t border-border">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Prescription Details (Optional)
              </h4>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Prescription / Rx #</label>
                <input
                  type="text"
                  placeholder="e.g. RX-2026-0042"
                  value={prescriptionNumber}
                  onChange={(e) => setPrescriptionNumber(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-foreground"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Attending Physician</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Maria Clara Santos, MD"
                  value={physicianName}
                  onChange={(e) => setPhysicianName(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-foreground"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Remarks</label>
                <input
                  type="text"
                  placeholder="Special dispensing notes or instructions..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-foreground"
                />
              </div>
            </div>

            <button
              onClick={() => {
                if (!selectedPatient) {
                  setFeedback({ type: 'error', message: 'Please select a registered patient first.' });
                  return;
                }
                setFeedback(null);
                setMobileStep('medicine');
              }}
              className="w-full py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-colors cursor-pointer shadow-xs min-h-[48px]"
            >
              Next: Select Medicine →
            </button>
          </div>
        )}

        {/* ── Step 2: Medicine ── */}
        {mobileStep === 'medicine' && (
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Pill className="w-4 h-4 text-teal-600" />
                Select Medicine &amp; Quantity
              </h3>

              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Medicine</label>
                {loadingMeds ? (
                  <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground py-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                    Loading available non-expired medicines...
                  </div>
                ) : (
                  <select
                    value={selectedMedicineId}
                    onChange={(e) => setSelectedMedicineId(e.target.value)}
                    className="w-full mt-1 px-3 py-3 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-foreground"
                  >
                    <option value="">— Choose available medicine —</option>
                    {availableMedicines.map((m) => (
                      <option key={m.MedicineID} value={m.MedicineID}>
                        {m.ProductName} (Available: {(m as any).totalQty})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={inputQuantity}
                    onChange={(e) => setInputQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full mt-1 px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Dosage / Instructions</label>
                  <input
                    type="text"
                    placeholder="e.g. 1 tab 3x daily"
                    value={inputDosage}
                    onChange={(e) => setInputDosage(e.target.value)}
                    className="w-full mt-1 px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={!selectedMedicineId}
                className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>Add to Dispensing Cart</span>
              </button>
            </div>

            {/* Cart Preview in Step 2 */}
            {cart.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-foreground">Cart Items ({cart.length})</span>
                  <span className="text-teal-600 dark:text-teal-400">{totalCartUnits} Total Units</span>
                </div>

                <div className="space-y-2">
                  {cart.map((item) => (
                    <div key={item.medicineId} className="p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-foreground block">{item.productName}</span>
                          <span className="text-[10px] text-muted-foreground">{item.genericName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-teal-600 dark:text-teal-400 text-sm">{item.quantity} units</span>
                          <button
                            onClick={() => handleRemoveFromCart(item.medicineId)}
                            className="p-1 rounded text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Real Allocated FEFO Batches */}
                      {item.allocations && item.allocations.length > 0 && (
                        <div className="pt-1 border-t border-border/50 text-[11px] space-y-1">
                          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
                            FEFO Allocation:
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.allocations.map((alloc, aIdx) => (
                              <span
                                key={aIdx}
                                className="px-2 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 font-mono text-[10px]"
                              >
                                Lot {alloc.lotNumber}: <strong>{alloc.allocatedQuantity} units</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-2.5 pt-2">
                  <button
                    onClick={() => setMobileStep('patient')}
                    className="flex-1 py-3 border border-border text-foreground rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
                  >
                    ← Patient
                  </button>
                  <button
                    onClick={() => setMobileStep('review')}
                    className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                  >
                    Review &amp; Confirm →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Review & Finalize ── */}
        {mobileStep === 'review' && (
          <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              Finalize Dispensing
            </h3>

            {/* Patient Recap */}
            {selectedPatient && (
              <div className="bg-muted/30 border border-border rounded-xl p-3 text-xs space-y-0.5">
                <div className="font-bold text-foreground">{selectedPatient.FullName}</div>
                <div className="text-muted-foreground">ID: #{selectedPatient.PatientID} · {selectedPatient.Barangay || 'No barangay'}</div>
                {prescriptionNumber && <div className="text-muted-foreground">Rx: {prescriptionNumber}</div>}
              </div>
            )}

            {/* Cart Items Recap */}
            <div className="space-y-2">
              {cart.map((item) => (
                <div key={item.medicineId} className="p-3 rounded-xl bg-muted/20 border border-border text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-foreground">{item.productName}</span>
                    <span className="text-teal-600 dark:text-teal-400 font-mono">{item.quantity} units</span>
                  </div>

                  {item.allocations && item.allocations.length > 0 && (
                    <div className="flex flex-wrap gap-1 text-[10px] font-mono">
                      {item.allocations.map((a, idx) => (
                        <span key={idx} className="px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-300 border border-teal-500/20">
                          Lot {a.lotNumber} ({a.allocatedQuantity} units)
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => setMobileStep('medicine')}
                className="flex-1 py-3 border border-border text-foreground rounded-xl text-xs font-semibold cursor-pointer min-h-[44px]"
              >
                ← Back
              </button>
              <button
                onClick={handleOpenConfirmModal}
                disabled={submitting || cart.length === 0 || hasShortageInCart}
                className="flex-1 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold cursor-pointer min-h-[44px] disabled:opacity-50"
              >
                Confirm &amp; Dispense
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          DESKTOP/TABLET LAYOUT (≥ md)
      ═══════════════════════════════════════════════════════════════════ */}
      <div className="hidden md:grid md:grid-cols-12 gap-6">
        {/* Left Column: Patient & Medicine Selection (5 cols) */}
        <div className="md:col-span-5 space-y-5">
          {/* 1. Patient Selector Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-teal-600" />
              1. Patient Identification
            </h3>

            {selectedPatient ? (
              <div className="bg-teal-500/10 border border-teal-500/30 rounded-xl p-4 relative space-y-1">
                <button
                  onClick={() => setSelectedPatient(null)}
                  className="absolute top-3 right-3 text-xs text-teal-600 dark:text-teal-400 font-bold hover:underline cursor-pointer"
                >
                  Change
                </button>
                <div className="font-bold text-sm text-foreground">
                  {selectedPatient.FullName}
                </div>
                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                  <div>Patient ID: <span className="font-mono font-bold text-foreground">#{selectedPatient.PatientID}</span></div>
                  <div>Barangay: <strong className="text-foreground">{selectedPatient.Barangay || 'Not specified'}</strong></div>
                  <div>Contact: {selectedPatient.ContactNumber || '—'}</div>
                  {selectedPatient.BirthDate && (
                    <div>DOB: {new Date(selectedPatient.BirthDate).toLocaleDateString()}</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search patient by name or contact number..."
                    value={patientSearch}
                    onChange={(e) => setPatientSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-foreground"
                  />
                  {searchingPatients && (
                    <RefreshCw className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin" />
                  )}
                </div>

                {patients.length > 0 && (
                  <div className="border border-border rounded-xl max-h-60 overflow-y-auto divide-y divide-border/60 shadow-sm bg-card">
                    {patients.map((p) => (
                      <button
                        key={p.PatientID}
                        onClick={() => {
                          setSelectedPatient(p);
                          setPatients([]);
                          setPatientSearch('');
                        }}
                        className="w-full text-left p-3 hover:bg-muted/40 cursor-pointer transition-colors"
                      >
                        <div className="font-semibold text-foreground text-xs sm:text-sm">
                          {p.FullName}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          ID: #{p.PatientID} · {p.Barangay || 'No barangay'} · {p.ContactNumber || 'No contact'}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Optional Prescription Metadata */}
            <div className="space-y-3 mt-4 pt-4 border-t border-border">
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Prescription Details (Optional)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Prescription / Rx #</label>
                  <input
                    type="text"
                    placeholder="e.g. RX-2026-0042"
                    value={prescriptionNumber}
                    onChange={(e) => setPrescriptionNumber(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground uppercase">Attending Physician</label>
                  <input
                    type="text"
                    placeholder="e.g. Dr. Maria Clara Santos, MD"
                    value={physicianName}
                    onChange={(e) => setPhysicianName(e.target.value)}
                    className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-foreground"
                  />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Remarks / Instructions</label>
                <input
                  type="text"
                  placeholder="Special instructions or consultation remarks..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-foreground"
                />
              </div>
            </div>
          </div>

          {/* 2. Medicine Selector Card */}
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Pill className="w-4 h-4 text-teal-600" />
              2. Medicine Selection
            </h3>

            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase">Available Medicine *</label>
              {loadingMeds ? (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-teal-600" />
                  Loading non-expired catalog stock...
                </div>
              ) : (
                <select
                  value={selectedMedicineId}
                  onChange={(e) => setSelectedMedicineId(e.target.value)}
                  className="w-full mt-1 px-3 py-2.5 bg-muted/40 border border-border rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-foreground"
                >
                  <option value="">— Select medicine from pharmacy stock —</option>
                  {availableMedicines.map((m) => (
                    <option key={m.MedicineID} value={m.MedicineID}>
                      {m.ProductName} (Available Stock: {(m as any).totalQty})
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={inputQuantity}
                  onChange={(e) => setInputQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase">Dosage / Patient Directions</label>
                <input
                  type="text"
                  placeholder="e.g. 1 tab after meals 3x daily"
                  value={inputDosage}
                  onChange={(e) => setInputDosage(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-muted/40 border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={!selectedMedicineId}
              className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add to Dispensing Cart</span>
            </button>
          </div>
        </div>

        {/* Right Column: Dispensing Cart & Real-Time FEFO Allocations (7 cols) */}
        <div className="md:col-span-7">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Package className="w-4 h-4 text-teal-600" />
                  <span>3. Dispensing Cart ({cart.length} item{cart.length === 1 ? '' : 's'})</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automated First-Expiry-First-Out (FEFO) batch allocation preview.
                </p>
              </div>

              <div className="flex items-baseline gap-2">
                <span className="text-xs font-semibold text-muted-foreground">Total Units:</span>
                <span className="text-base font-black text-teal-600 dark:text-teal-400 font-mono">
                  {totalCartUnits}
                </span>
              </div>
            </div>

            {cart.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl space-y-2">
                <Pill className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <p className="font-semibold text-foreground text-sm">Dispensing Cart is Empty</p>
                <p className="text-xs max-w-sm mx-auto">
                  Select an available medicine and specify the requested quantity to view FEFO batch allocations.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {cart.map((item) => {
                  const isDeficit = (item.shortageQuantity || 0) > 0 || item.canFulfill === false;

                  return (
                    <div
                      key={item.medicineId}
                      className={`p-4 rounded-xl border bg-card/60 space-y-2.5 transition-colors ${
                        isDeficit
                          ? 'border-destructive/40 bg-destructive/5'
                          : 'border-border hover:border-teal-500/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-bold text-sm text-foreground">{item.productName}</div>
                          {item.genericName && (
                            <div className="text-[11px] text-muted-foreground">{item.genericName}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 bg-muted/60 px-2 py-1 rounded-lg border border-border">
                            <button
                              onClick={() => handleQtyChange(item.medicineId, -1)}
                              className="p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs text-foreground px-1.5">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleQtyChange(item.medicineId, 1)}
                              className="p-0.5 rounded text-muted-foreground hover:text-foreground cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => handleRemoveFromCart(item.medicineId)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {item.dosageInstructions && (
                        <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/50">
                          <span className="font-semibold text-foreground">Dosage: </span>
                          {item.dosageInstructions}
                        </div>
                      )}

                      {/* FEFO Target Allocation Preview (Non-Duplicated, Accurate Units) */}
                      <div className="pt-2 border-t border-border/60">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground mb-1.5">
                          <span className="flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5 text-teal-600" />
                            <span>Proposed FEFO Batch Allocation:</span>
                          </span>
                          <span>Available in Pharmacy: <strong>{item.availableStock}</strong></span>
                        </div>

                        {allocatingFefo ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
                            <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-600" />
                            <span>Recalculating batch allocations...</span>
                          </div>
                        ) : item.allocations && item.allocations.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {item.allocations.map((batch, bIdx) => (
                              <div
                                key={bIdx}
                                className="px-2.5 py-1 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-800 dark:text-teal-300 font-mono text-xs flex items-center gap-1.5"
                              >
                                <span className="font-bold">Lot: {batch.lotNumber}</span>
                                <span className="text-muted-foreground text-[10px]">
                                  (Exp: {new Date(batch.expiryDate).toLocaleDateString()})
                                </span>
                                <span className="text-teal-600 dark:text-teal-400 font-bold">
                                  → {batch.allocatedQuantity} units
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground italic">
                            No batches allocated.
                          </div>
                        )}

                        {isDeficit && (
                          <div className="mt-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs font-semibold flex items-center gap-1.5">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>Insufficient stock: Requested quantity exceeds available batches by {item.shortageQuantity} units.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Final Confirmation Strip */}
                <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-600" />
                    <span>Deduction is atomic, validated server-side, &amp; logged in audit ledger</span>
                  </div>

                  <button
                    onClick={handleOpenConfirmModal}
                    disabled={submitting || !selectedPatient || cart.length === 0 || hasShortageInCart}
                    className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span>Finalize &amp; Dispense ({totalCartUnits} Units)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CONFIRMATION SUMMARY MODAL (Pre-Dispensing Review)
      ═══════════════════════════════════════════════════════════════════ */}
      {isConfirmModalOpen && selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0 bg-muted/20">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center font-bold">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    Confirm Medicine Dispensing
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Verify patient details and FEFO batch deductions before posting.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmModalOpen(false)}
                className="w-8 h-8 rounded-full bg-muted text-muted-foreground flex items-center justify-center cursor-pointer hover:bg-muted/80"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Patient & Dispenser Recap */}
              <div className="p-3.5 rounded-xl bg-muted/30 border border-border grid grid-cols-2 gap-2.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Patient</span>
                  <span className="font-bold text-sm text-foreground block">{selectedPatient.FullName}</span>
                  <span className="text-muted-foreground">ID: #{selectedPatient.PatientID} · {selectedPatient.Barangay || 'No barangay'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-muted-foreground block">Dispensing Officer</span>
                  <span className="font-bold text-foreground block">{currentUserName}</span>
                  <span className="text-muted-foreground">Session User ID: #{currentUserId}</span>
                </div>
                {prescriptionNumber && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Prescription / Rx</span>
                    <span className="font-semibold text-foreground">{prescriptionNumber}</span>
                  </div>
                )}
                {physicianName && (
                  <div>
                    <span className="text-[10px] uppercase font-bold text-muted-foreground block">Physician</span>
                    <span className="font-semibold text-foreground">{physicianName}</span>
                  </div>
                )}
              </div>

              {/* Items & FEFO Batches Summary Table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase font-bold tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">Medicine</th>
                      <th className="py-2.5 px-3 text-right">Requested</th>
                      <th className="py-2.5 px-3">FEFO Batches</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {cart.map((item) => (
                      <tr key={item.medicineId} className="hover:bg-muted/20">
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-foreground block">{item.productName}</span>
                          {item.genericName && (
                            <span className="text-[10px] text-muted-foreground block">{item.genericName}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {item.quantity}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="space-y-1">
                            {item.allocations?.map((alloc, idx) => (
                              <div key={idx} className="font-mono text-[11px] text-teal-600 dark:text-teal-400">
                                Lot {alloc.lotNumber} → <strong>{alloc.allocatedQuantity} units</strong>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Summary */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-xs">
                <span className="font-bold text-foreground">Total Dispensing Quantity:</span>
                <span className="text-base font-black text-teal-600 dark:text-teal-400 font-mono">
                  {totalCartUnits} units
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-4 border-t border-border flex items-center justify-end gap-3 shrink-0 bg-muted/10">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                disabled={submitting}
                className="px-4 py-2.5 border border-border text-foreground hover:bg-muted rounded-xl text-xs font-semibold cursor-pointer min-h-[40px] disabled:opacity-50"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={handleFinalizeDispense}
                disabled={submitting}
                className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs min-h-[40px] disabled:opacity-50"
              >
                {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{submitting ? 'Deducting Stock & Recording...' : 'Confirm & Release Medicines'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          COMPLETED DISPENSING VOUCHER MODAL (Printable Record)
      ═══════════════════════════════════════════════════════════════════ */}
      {completedVoucher && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl shadow-2xl w-full sm:max-w-xl flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
            {/* Mobile Drag Handle */}
            <div className="flex justify-center pt-3 pb-1 sm:hidden">
              <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[85dvh] voucher-printable">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0" />
                  <div>
                    <div className="text-[10px] font-bold text-teal-600 uppercase tracking-wider">
                      Catbalogan City Health Office · City Pharmacy
                    </div>
                    <h3 className="text-base font-bold text-foreground">
                      Medicine Dispensing Voucher
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setCompletedVoucher(null)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer w-8 h-8 flex items-center justify-center rounded-full hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Voucher Metadata */}
              <div className="bg-muted/30 p-4 rounded-2xl border border-border text-xs space-y-1.5 font-mono">
                <div className="text-sm font-bold text-teal-600 dark:text-teal-400">
                  {completedVoucher.dispenseNumber}
                </div>
                <div className="text-foreground">
                  Patient: <strong>{completedVoucher.patientName}</strong> {completedVoucher.patientBarangay ? `(${completedVoucher.patientBarangay})` : ''}
                </div>
                <div className="text-muted-foreground">Dispensed Date: {completedVoucher.dispensedDate}</div>
                <div className="text-muted-foreground">Dispensed By: <strong>{completedVoucher.pharmacistName}</strong></div>
                {completedVoucher.prescriptionNumber && (
                  <div className="text-muted-foreground">Prescription: {completedVoucher.prescriptionNumber}</div>
                )}
                {completedVoucher.physicianName && (
                  <div className="text-muted-foreground">Doctor: {completedVoucher.physicianName}</div>
                )}
              </div>

              {/* Batch Allocation Lines Table */}
              <div className="border border-border rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-muted/50 font-semibold border-b border-border">
                    <tr>
                      <th className="p-2.5">Medicine</th>
                      <th className="p-2.5">Batch / Lot</th>
                      <th className="p-2.5">Expiry</th>
                      <th className="p-2.5 text-right">Units</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {completedVoucher.items.map((it, idx) => (
                      <tr key={idx} className="hover:bg-muted/20">
                        <td className="p-2.5 font-medium text-foreground">
                          {it.productName || 'Medicine'}
                        </td>
                        <td className="p-2.5 font-mono text-foreground">{it.lotNumber}</td>
                        <td className="p-2.5 text-muted-foreground">{new Date(it.expiryDate).toLocaleDateString()}</td>
                        <td className="p-2.5 text-right font-bold text-teal-600 dark:text-teal-400 font-mono">
                          {it.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Voucher Action Buttons */}
              <div
                className="flex items-center justify-end gap-3 pt-2"
                style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
              >
                <button
                  onClick={handlePrint}
                  className="px-4 py-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer min-h-[44px]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Voucher</span>
                </button>
                <button
                  onClick={() => setCompletedVoucher(null)}
                  className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold cursor-pointer shadow-xs min-h-[44px]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
