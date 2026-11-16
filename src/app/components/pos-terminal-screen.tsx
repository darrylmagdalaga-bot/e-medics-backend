import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, Trash2, Plus, Minus, X, User, ShoppingCart, 
  Pill, CheckCircle2, AlertTriangle, Package, Calendar, 
  Sparkles, ShieldCheck, Tag, ArrowRight, RefreshCw, ChevronRight,
  Info, Award, Receipt, Layers, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../api-config';

interface Medicine {
  MedicineID: number;
  ProductName: string;
  GenericName: string;
  BrandName?: string;
  Dosage?: string;
  Form?: string;
  Description?: string;
  UnitID: number;
  UnitName: string;
  CategoryID: number;
  CategoryName: string;
  Price: number;
  Stock?: number;
  TotalStock?: number;
}

interface Patient {
  PatientID: number;
  FullName: string;
  ContactNumber?: string;
}

interface CartItemAllocation {
  lotNumber: string;
  quantity: number;
  price: number;
  expiryDate?: string;
}

interface CartItem {
  id: number;
  name: string;
  genericName?: string;
  unitName: string;
  price: number;
  quantity: number;
  unitId: number;
  allocations: CartItemAllocation[];
}

interface LotData {
  LotNumber: string;
  ExpiryDate: string;
  Quantity: number;
  Price: number;
  UnitID: number;
  StockID: number;
}

// ----------------------------------------------------------------------
// 1. ADAPTIVE PHARMACY LOT SELECTION MODAL (FEFO Logic)
// ----------------------------------------------------------------------
function PharmacyLotSelectionModal({ 
  medicine, 
  onClose, 
  onAdd 
}: { 
  medicine: Medicine; 
  onClose: () => void; 
  onAdd: (allocs: CartItemAllocation[], qty: number) => void;
}) {
  const [lots, setLots] = useState<LotData[]>([]);
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [reqQty, setReqQty] = useState('1');

  // Helper: Auto-allocate lots using FEFO (earliest expiry first)
  const autoAllocate = (dataLots: LotData[], target: number) => {
    let remaining = target;
    const nextAlloc: Record<string, string> = {};
    for (const lot of dataLots) {
      if (remaining <= 0) {
        nextAlloc[lot.LotNumber] = '0';
        continue;
      }
      const take = Math.min(remaining, lot.Quantity);
      nextAlloc[lot.LotNumber] = take.toString();
      remaining -= take;
    }
    setAllocations(nextAlloc);
  };

  useEffect(() => {
    let isMounted = true;
    fetch(`${API_URL}/api/pharmacy/medicine/${medicine.MedicineID}/lots`, {
      headers: { 'Bypass-Tunnel-Reminder': 'true' }
    })
      .then(res => res.json())
      .then((data: LotData[]) => {
        if (!isMounted) return;
        // Sort FEFO by ExpiryDate ascending
        const sorted = [...data].sort((a, b) => new Date(a.ExpiryDate).getTime() - new Date(b.ExpiryDate).getTime());
        setLots(sorted);
        setLoading(false);
        autoAllocate(sorted, 1);
      })
      .catch(err => {
        console.error('Error fetching medicine lots:', err);
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [medicine.MedicineID]);

  const totalAvailable = useMemo(() => lots.reduce((sum, lot) => sum + lot.Quantity, 0), [lots]);
  const targetQty = parseInt(reqQty) || 0;
  const totalAllocated = useMemo(() => 
    Object.values(allocations).reduce((sum, val) => sum + (parseInt(val) || 0), 0)
  , [allocations]);

  const isComplete = totalAllocated === targetQty && targetQty > 0;

  const handleQtyChange = (val: string) => {
    const num = Math.max(0, parseInt(val) || 0);
    setReqQty(val);
    autoAllocate(lots, num);
  };

  const handleUpdateAlloc = (lotNo: string, val: string, maxQty: number) => {
    const numVal = parseInt(val) || 0;
    if (numVal < 0) return;
    if (numVal > maxQty) {
      toast.error(`Cannot allocate more than available stock in Lot ${lotNo} (${maxQty} available)`);
      return;
    }
    setAllocations(prev => ({ ...prev, [lotNo]: val }));
  };

  const totalCost = useMemo(() => {
    return Object.entries(allocations).reduce((sum, [lotNo, qtyStr]) => {
      const lot = lots.find(l => l.LotNumber === lotNo);
      const qty = parseInt(qtyStr) || 0;
      return sum + (qty * (lot?.Price || medicine.Price || 0));
    }, 0);
  }, [allocations, lots, medicine.Price]);

  const handleConfirm = () => {
    if (!isComplete) {
      toast.error(`Allocated quantity (${totalAllocated}) must match requested quantity (${targetQty})`);
      return;
    }
    const formattedAllocations: CartItemAllocation[] = Object.entries(allocations)
      .filter(([_, qtyStr]) => parseInt(qtyStr) > 0)
      .map(([lotNo, qtyStr]) => {
        const lot = lots.find(l => l.LotNumber === lotNo);
        return {
          lotNumber: lotNo,
          quantity: parseInt(qtyStr),
          price: lot?.Price || medicine.Price || 0,
          expiryDate: lot?.ExpiryDate
        };
      });

    onAdd(formattedAllocations, targetQty);
  };

  const getDaysToExpiry = (dateStr: string) => {
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="bg-card text-card-foreground rounded-3xl shadow-2xl relative z-10 border border-border overflow-hidden animate-in zoom-in-95 duration-200 w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground tracking-tight">{medicine.ProductName}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  FEFO Allocation
                </span>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                {medicine.GenericName || 'General Formulation'} {medicine.Dosage ? `• ${medicine.Dosage}` : ''} • Available: <strong className="text-foreground">{totalAvailable} {medicine.UnitName || 'Units'}</strong>
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Requested Quantity Control Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-muted/30 border border-border/60">
            <div className="space-y-0.5">
              <label className="text-xs font-bold text-foreground block">
                Prescription Dispense Quantity ({medicine.UnitName || 'Units'})
              </label>
              <p className="text-[11px] text-muted-foreground">Batches are prioritized automatically by earliest expiration date.</p>
            </div>
            
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center rounded-xl bg-card border border-border shadow-inner p-1">
                <button
                  type="button"
                  onClick={() => handleQtyChange(Math.max(1, targetQty - 1).toString())}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input
                  type="number"
                  min="1"
                  max={totalAvailable}
                  value={reqQty}
                  onChange={e => handleQtyChange(e.target.value)}
                  className="w-16 text-center font-bold text-foreground bg-transparent focus:outline-none text-base"
                />
                <button
                  type="button"
                  onClick={() => handleQtyChange(Math.min(totalAvailable, targetQty + 1).toString())}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Qty Presets */}
              <div className="hidden sm:flex gap-1.5">
                {[5, 10, 20].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleQtyChange(n.toString())}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground border border-border/50 transition-colors"
                  >
                    {n}
                  </button>
                ))}
                {totalAvailable > 0 && (
                  <button
                    type="button"
                    onClick={() => handleQtyChange(totalAvailable.toString())}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-colors"
                  >
                    Max
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Insufficient Stock Warning */}
          {totalAvailable < targetQty && !loading && (
            <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-2xl flex items-center gap-3 text-destructive">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <div className="text-xs">
                <p className="font-bold">Insufficient Pharmacy Stock</p>
                <p className="text-destructive/80">Requested {targetQty} units, but only {totalAvailable} units are available in active dispensary batches.</p>
              </div>
            </div>
          )}

          {/* Batches Table (Desktop) / Cards (Mobile) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Available Batches & Lots ({lots.length})
              </h3>
              <span className={`text-xs font-bold flex items-center gap-1.5 ${isComplete ? 'text-emerald-500' : 'text-amber-500'}`}>
                {isComplete ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Allocation Complete ({totalAllocated}/{targetQty})
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-4 h-4" />
                    Allocated {totalAllocated} of {targetQty}
                  </>
                )}
              </span>
            </div>

            {loading ? (
              <div className="py-16 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
                <RefreshCw className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs font-medium">Loading FEFO batches from database...</p>
              </div>
            ) : lots.length === 0 ? (
              <div className="py-12 text-center rounded-2xl border border-dashed border-border bg-muted/20 p-6">
                <Package className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                <p className="text-sm font-bold text-foreground">No Active Stock Batches Found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Please submit an inbound Stock Request to the Central Warehouse to replenish this item.
                </p>
              </div>
            ) : (
              <div className="border border-border rounded-2xl overflow-hidden bg-card">
                {/* Desktop view */}
                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted/40 border-b border-border text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                      <tr>
                        <th className="px-5 py-3">Lot / Batch No.</th>
                        <th className="px-5 py-3">Expiration Date</th>
                        <th className="px-5 py-3 text-center">In Stock</th>
                        <th className="px-5 py-3 text-right">Unit Price</th>
                        <th className="px-5 py-3 text-center w-36">Allocated Qty</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {lots.map((lot, idx) => {
                        const daysLeft = getDaysToExpiry(lot.ExpiryDate);
                        const isAllocated = (parseInt(allocations[lot.LotNumber] || '0') > 0);
                        const isNearExpiry = daysLeft <= 90;
                        const isExpired = daysLeft <= 0;

                        return (
                          <tr 
                            key={lot.LotNumber} 
                            className={`transition-colors ${isAllocated ? 'bg-primary/5' : 'hover:bg-muted/30'}`}
                          >
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-foreground">{lot.LotNumber}</span>
                                {idx === 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-primary/10 text-primary border border-primary/20">
                                    Next FEFO
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-foreground">
                                  {new Date(lot.ExpiryDate).toLocaleDateString()}
                                </span>
                                {isExpired ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20">
                                    Expired
                                  </span>
                                ) : isNearExpiry ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                    {daysLeft}d left
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">({daysLeft}d)</span>
                                )}
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-center font-bold text-foreground">
                              {lot.Quantity}
                            </td>
                            <td className="px-5 py-3.5 text-right font-extrabold text-foreground">
                              ₱{(lot.Price || medicine.Price || 0).toFixed(2)}
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center justify-center gap-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  max={lot.Quantity}
                                  value={allocations[lot.LotNumber] || '0'}
                                  onChange={e => handleUpdateAlloc(lot.LotNumber, e.target.value, lot.Quantity)}
                                  className="w-20 text-center font-bold text-foreground bg-muted/40 border border-border rounded-xl py-1.5 px-2 focus:ring-2 focus:ring-primary/20 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  title="Allocate maximum available"
                                  onClick={() => handleUpdateAlloc(lot.LotNumber, Math.min(lot.Quantity, targetQty).toString(), lot.Quantity)}
                                  className="p-1.5 rounded-lg text-[10px] font-bold text-muted-foreground hover:text-primary hover:bg-muted transition-colors border border-border/50"
                                >
                                  Max
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile view (Stacked Cards) */}
                <div className="sm:hidden divide-y divide-border">
                  {lots.map((lot, idx) => {
                    const daysLeft = getDaysToExpiry(lot.ExpiryDate);
                    const isAllocated = (parseInt(allocations[lot.LotNumber] || '0') > 0);
                    const isNearExpiry = daysLeft <= 90;
                    const isExpired = daysLeft <= 0;

                    return (
                      <div 
                        key={lot.LotNumber} 
                        className={`p-4 space-y-3 ${isAllocated ? 'bg-primary/5' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-foreground text-sm">Lot #{lot.LotNumber}</span>
                            {idx === 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-primary/10 text-primary">
                                FEFO
                              </span>
                            )}
                          </div>
                          <span className="text-xs font-extrabold text-primary">
                            ₱{(lot.Price || medicine.Price || 0).toFixed(2)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Exp: {new Date(lot.ExpiryDate).toLocaleDateString()}</span>
                            {isNearExpiry && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500">
                                {daysLeft}d left
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-foreground">Available: {lot.Quantity}</span>
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs font-bold text-foreground">Allocate Qty:</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              max={lot.Quantity}
                              value={allocations[lot.LotNumber] || '0'}
                              onChange={e => handleUpdateAlloc(lot.LotNumber, e.target.value, lot.Quantity)}
                              className="w-20 text-center font-bold text-foreground bg-muted/40 border border-border rounded-xl py-1 px-2 text-sm focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleUpdateAlloc(lot.LotNumber, Math.min(lot.Quantity, targetQty).toString(), lot.Quantity)}
                              className="px-2 py-1 rounded-lg text-xs font-bold bg-muted text-muted-foreground hover:text-foreground"
                            >
                              Max
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Requested</p>
              <p className="text-lg font-black text-foreground">{targetQty}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Allocated</p>
              <p className={`text-lg font-black ${isComplete ? 'text-emerald-500' : 'text-amber-500'}`}>
                {totalAllocated}
              </p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Est. Total</p>
              <p className="text-lg font-black text-primary">₱{totalCost.toFixed(2)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-border text-foreground font-semibold hover:bg-muted transition-colors text-xs uppercase tracking-wider"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!isComplete || loading}
              onClick={handleConfirm}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 disabled:grayscale text-xs uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Add to Queue
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 2. MAIN POS TERMINAL SCREEN
// ----------------------------------------------------------------------
export function POSTerminalScreen({ userId }: { userId?: number | null }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Items');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'low_stock'>('all');
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [categories, setCategories] = useState<string[]>(['All Items']);
  const [patients, setPatients] = useState<Patient[]>([]);
  
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [isSeniorDiscount, setIsSeniorDiscount] = useState(false);
  const [seniorId, setSeniorId] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<Medicine | null>(null);
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  // Fetch medicines, categories, patients, and pharmacy inventory
  const fetchData = async () => {
    try {
      const [medRes, catRes, patRes, stockRes] = await Promise.all([
        fetch(`${API_URL}/api/medicines`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } }),
        fetch(`${API_URL}/api/medicine-categories`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } }),
        fetch(`${API_URL}/api/patients`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } }),
        fetch(`${API_URL}/api/pharmacy/inventory-full`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } })
      ]);

      const meds: any[] = await medRes.json();
      const cats: any[] = await catRes.json();
      const pats: any[] = await patRes.json();
      const stocks: any[] = await stockRes.json();

      // Aggregate pharmacy stocks by MedicineID / ProductName
      const stockMap: Record<number, number> = {};
      stocks.forEach((s: any) => {
        let mid = s.medicineId;
        if (!mid) {
          const match = meds.find((m: any) => 
            m.ProductName.toLowerCase().trim() === (s.productName || '').toLowerCase().trim()
          );
          mid = match?.MedicineID;
        }
        if (mid) {
          stockMap[mid] = (stockMap[mid] || 0) + (s.quantity || 0);
        }
      });

      const enrichedMeds: Medicine[] = meds.map((m: any) => {
        // Prefer live pharmacy stock count, fallback to m.TotalStock if available
        const currentStock = stockMap[m.MedicineID] !== undefined 
          ? stockMap[m.MedicineID] 
          : (m.TotalStock || 0);

        return {
          ...m,
          Stock: currentStock,
          Price: m.Price || 0
        };
      });

      setMedicines(enrichedMeds);
      setCategories(['All Items', ...cats.map((c: any) => c.CategoryName)]);
      setPatients(pats);
    } catch (err) {
      console.error('Failed to fetch POS terminal data:', err);
      toast.error('Unable to synchronize live pharmacy stock.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter products by category, search query, and stock status
  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return medicines.filter(p => {
      // Category filter
      if (selectedCategory !== 'All Items' && p.CategoryName !== selectedCategory) {
        return false;
      }
      // Stock filter
      if (stockFilter === 'in_stock' && (p.Stock || 0) <= 0) return false;
      if (stockFilter === 'low_stock' && ((p.Stock || 0) <= 0 || (p.Stock || 0) > 20)) return false;

      // Search query
      if (!q) return true;
      return (
        p.ProductName.toLowerCase().includes(q) ||
        (p.GenericName && p.GenericName.toLowerCase().includes(q)) ||
        (p.BrandName && p.BrandName.toLowerCase().includes(q)) ||
        (p.Dosage && p.Dosage.toLowerCase().includes(q))
      );
    });
  }, [medicines, selectedCategory, stockFilter, searchQuery]);

  const handleProductClick = (product: Medicine) => {
    if ((product.Stock || 0) <= 0) {
      toast.error(`"${product.ProductName}" is currently out of stock in the dispensary.`);
      return;
    }
    setSelectedMedicine(product);
  };

  const confirmAddToCart = (allocs: CartItemAllocation[], totalQty: number) => {
    if (!selectedMedicine) return;

    // Calculate effective average price from allocated batches
    const totalAllocCost = allocs.reduce((sum, a) => sum + (a.price * a.quantity), 0);
    const effectivePrice = totalQty > 0 ? (totalAllocCost / totalQty) : selectedMedicine.Price;

    setCart(prev => {
      const existing = prev.find(item => item.id === selectedMedicine.MedicineID);
      if (existing) {
        return prev.map(item =>
          item.id === selectedMedicine.MedicineID
            ? { ...item, price: effectivePrice, quantity: totalQty, allocations: allocs }
            : item
        );
      }
      return [
        ...prev,
        {
          id: selectedMedicine.MedicineID,
          name: selectedMedicine.ProductName,
          genericName: selectedMedicine.GenericName,
          unitName: selectedMedicine.UnitName || 'Unit',
          price: effectivePrice,
          quantity: totalQty,
          unitId: selectedMedicine.UnitID,
          allocations: allocs
        }
      ];
    });

    toast.success(`Added ${totalQty} ${selectedMedicine.UnitName || 'units'} of ${selectedMedicine.ProductName}`);
    setSelectedMedicine(null);
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Cart calculations
  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + (item.price * item.quantity), 0), [cart]);
  const discountAmount = useMemo(() => isSeniorDiscount ? subtotal * 0.20 : 0, [isSeniorDiscount, subtotal]);
  const grandTotal = useMemo(() => Math.max(0, subtotal - discountAmount), [subtotal, discountAmount]);
  const totalItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);

  // Finalize Dispensing Transaction
  const handleFinalize = async () => {
    if (!userId) {
      toast.error('Session user not identified. Please re-login.');
      return;
    }
    if (cart.length === 0) {
      toast.error('Dispensing queue is empty.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        userId,
        patientId: selectedPatientId ? parseInt(selectedPatientId) : null,
        discountApplied: isSeniorDiscount ? 0.20 : 0,
        seniorPwdId: isSeniorDiscount ? seniorId : null,
        items: cart.map(item => ({
          medicineId: item.id,
          quantity: item.quantity,
          price: item.price,
          unitId: item.unitId,
          allocations: item.allocations
        }))
      };

      const res = await fetch(`${API_URL}/api/pharmacy/sales`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Bypass-Tunnel-Reminder': 'true'
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Medications dispensed and inventory deducted successfully!');
        setCart([]);
        setSelectedPatientId('');
        setIsSeniorDiscount(false);
        setSeniorId('');
        setShowSuccess(true);
        setIsMobileCartOpen(false);
        fetchData(); // Refresh inventory stock immediately
        setTimeout(() => setShowSuccess(false), 3500);
      } else {
        toast.error(data.message || 'Dispensing transaction failed.');
      }
    } catch (err) {
      console.error('Error submitting sales transaction:', err);
      toast.error('Connection error. Could not record transaction.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Connecting to Pharmacy Dispensing System...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row h-full bg-background text-foreground overflow-hidden select-none">
      {/* ---------------------------------------------------------------- */}
      {/* LEFT PANE: PRODUCT CATALOG & FEFO INVENTORY                      */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden border-r border-border">
        {/* Terminal Header & Controls */}
        <div className="p-4 sm:p-6 border-b border-border bg-card/40 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Dispensing Terminal
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Dispense medications from Catbalogan City Health Department dispensary
              </p>
            </div>

            {/* Quick stock view pill tabs */}
            <div className="flex items-center bg-muted/50 p-1 rounded-xl border border-border/50 text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setStockFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${stockFilter === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('in_stock')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${stockFilter === 'in_stock' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                In Stock
              </button>
              <button
                type="button"
                onClick={() => setStockFilter('low_stock')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${stockFilter === 'low_stock' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Low Stock
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by brand name, generic formulation, or dosage (e.g. Paracetamol, 500mg)..."
              className="w-full h-11 pl-11 pr-10 bg-card border border-border/70 rounded-2xl text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Categories Pill Slider */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(cat => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`whitespace-nowrap px-3.5 py-1.5 rounded-xl text-xs font-bold tracking-tight transition-all ${
                    isSelected
                      ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20'
                      : 'bg-card border border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Product Grid Catalog */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-border bg-muted/10">
              <Package className="w-10 h-10 text-muted-foreground opacity-40 mb-3" />
              <p className="text-base font-bold text-foreground">No Medicines Matching Criteria</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Try searching with another keyword or change your active category filter.
              </p>
              {(searchQuery || selectedCategory !== 'All Items' || stockFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setSelectedCategory('All Items');
                    setStockFilter('all');
                  }}
                  className="mt-4 px-4 py-2 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredProducts.map(p => {
                const stock = p.Stock || 0;
                const isOutOfStock = stock <= 0;
                const isLowStock = stock > 0 && stock <= 20;

                return (
                  <motion.div
                    key={p.MedicineID}
                    whileHover={{ y: -2 }}
                    transition={{ duration: 0.15 }}
                    onClick={() => handleProductClick(p)}
                    className={`group bg-card rounded-2xl p-4 border transition-all flex flex-col justify-between relative overflow-hidden ${
                      isOutOfStock
                        ? 'border-border/60 opacity-60 cursor-not-allowed'
                        : 'border-border/80 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 cursor-pointer'
                    }`}
                  >
                    {/* Top row: Category tag & Stock Badge */}
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                          {p.CategoryName || 'General'}
                        </span>
                        
                        {isOutOfStock ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-destructive/10 text-destructive border border-destructive/20 shrink-0">
                            Out of Stock
                          </span>
                        ) : isLowStock ? (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0">
                            Low: {stock}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                            {stock} {p.UnitName || 'Units'}
                          </span>
                        )}
                      </div>

                      {/* Icon & Title */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <Pill className="w-5 h-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                            {p.ProductName}
                          </h3>
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {p.GenericName || p.Description || 'Clinical Standard'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Bottom row: Price and Quick Add */}
                    <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-muted-foreground uppercase block">Price</span>
                        <span className="text-sm font-black text-foreground">
                          ₱{(p.Price || 0).toFixed(2)}
                        </span>
                      </div>

                      <button
                        type="button"
                        disabled={isOutOfStock}
                        aria-label={`Dispense ${p.ProductName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleProductClick(p);
                        }}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                          isOutOfStock
                            ? 'bg-muted text-muted-foreground cursor-not-allowed'
                            : 'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground shadow-sm'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Dispense
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* RIGHT PANE: DISPENSING QUEUE & CHECKOUT PANEL                     */}
      {/* ---------------------------------------------------------------- */}
      <div className={`
        fixed inset-y-0 right-0 z-40 w-full sm:w-[420px] lg:static lg:w-[400px] xl:w-[440px]
        bg-card border-l border-border flex flex-col shadow-2xl lg:shadow-none
        transition-transform duration-300 lg:translate-x-0
        ${isMobileCartOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
      `}>
        {/* Panel Header */}
        <div className="p-5 border-b border-border bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Dispensing Queue</h2>
              <p className="text-[11px] text-muted-foreground font-medium">
                {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'} in current prescription
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {cart.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="px-2.5 py-1 text-[11px] font-bold text-destructive hover:bg-destructive/10 rounded-lg transition-colors uppercase tracking-wider"
              >
                Clear
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMobileCartOpen(false)}
              className="lg:hidden p-2 text-muted-foreground hover:text-foreground rounded-lg"
              aria-label="Close cart drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Patient Selection & Senior / PWD Toggle */}
        <div className="p-4 sm:p-5 border-b border-border bg-card space-y-3.5">
          {/* Patient Selector */}
          <div>
            <label className="text-xs font-bold text-foreground block mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-primary" />
              Patient Record
            </label>
            <div className="relative">
              <select
                value={selectedPatientId}
                onChange={e => setSelectedPatientId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-muted/40 border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer appearance-none"
              >
                <option value="">Walk-in Patient (General Public)</option>
                {patients.map(p => (
                  <option key={p.PatientID} value={p.PatientID}>
                    {p.FullName} {p.ContactNumber ? `• ${p.ContactNumber}` : ''}
                  </option>
                ))}
              </select>
              <ChevronRight className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
            </div>
          </div>

          {/* Senior Citizen / PWD 20% Discount Toggle */}
          <div className="p-3 rounded-xl bg-muted/30 border border-border/60 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-foreground">Senior / PWD 20% Discount</span>
              </div>
              <input
                type="checkbox"
                id="senior-toggle"
                checked={isSeniorDiscount}
                onChange={e => setIsSeniorDiscount(e.target.checked)}
                className="w-4 h-4 rounded text-primary focus:ring-primary/20 cursor-pointer accent-primary"
              />
            </div>
            {isSeniorDiscount && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="pt-1.5"
              >
                <input
                  type="text"
                  value={seniorId}
                  onChange={e => setSeniorId(e.target.value)}
                  placeholder="OSCA / PWD ID Number (optional)"
                  className="w-full px-3 py-1.5 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </motion.div>
            )}
          </div>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {showSuccess ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border-2 border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-black text-foreground">Dispensed Successfully!</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                Transaction recorded and inventory batch deductions finalized in Azure SQL.
              </p>
            </div>
          ) : cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-6 opacity-60">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-3">
                <Pill className="w-7 h-7" />
              </div>
              <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                Dispensing Queue Empty
              </p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                Click "Dispense" on any available medication to allocate stock batches.
              </p>
            </div>
          ) : (
            cart.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-2xl bg-muted/20 border border-border/70 flex flex-col gap-2.5 transition-colors hover:border-border"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs font-bold text-foreground leading-snug truncate">
                      {item.name}
                    </h4>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {item.genericName || 'Prescription Drug'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFromCart(item.id)}
                    className="p-1 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    aria-label={`Remove ${item.name} from cart`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Batch Lot pills */}
                <div className="flex flex-wrap gap-1.5">
                  {item.allocations.map(alloc => (
                    <span
                      key={alloc.lotNumber}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                    >
                      <Tag className="w-2.5 h-2.5" />
                      Lot {alloc.lotNumber}: {alloc.quantity} {item.unitName}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-border/40 text-xs">
                  <span className="text-muted-foreground font-medium">
                    {item.quantity} {item.unitName} × ₱{item.price.toFixed(2)}
                  </span>
                  <span className="font-extrabold text-foreground">
                    ₱{(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Checkout Summary Footer */}
        <div className="p-5 border-t border-border bg-card space-y-4">
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-semibold text-foreground">₱{subtotal.toFixed(2)}</span>
            </div>
            {isSeniorDiscount && (
              <div className="flex items-center justify-between text-emerald-500 font-semibold">
                <span>Senior / PWD Discount (20%)</span>
                <span>-₱{discountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-border/60">
              <span className="text-sm font-bold text-foreground">Grand Total</span>
              <span className="text-2xl font-black text-primary">₱{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          <button
            type="button"
            disabled={cart.length === 0 || isSubmitting}
            onClick={handleFinalize}
            className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-bold text-sm uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-2 active:scale-[0.99]"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing Dispensing...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Finalize Dispensing
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modal for lot selection - Rendered at root level */}
      {selectedMedicine && (
        <PharmacyLotSelectionModal
          medicine={selectedMedicine}
          onClose={() => setSelectedMedicine(null)}
          onAdd={confirmAddToCart}
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/* FLOATING CART BAR FOR TABLET & MOBILE (< lg)                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="lg:hidden fixed bottom-4 inset-x-4 z-30">
        <button
          type="button"
          onClick={() => setIsMobileCartOpen(true)}
          className="w-full p-4 rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/40 flex items-center justify-between font-bold text-sm"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <span>
              {totalItemCount} {totalItemCount === 1 ? 'Item' : 'Items'} in Queue
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black">₱{grandTotal.toFixed(2)}</span>
            <ChevronRight className="w-5 h-5" />
          </div>
        </button>
      </div>

      {/* Backdrop for Mobile Drawer */}
      <AnimatePresence>
        {isMobileCartOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileCartOpen(false)}
            className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>
    </div>
  );
}
