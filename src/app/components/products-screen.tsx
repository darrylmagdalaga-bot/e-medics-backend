import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Trash2, Download, Pill, AlertCircle, ChevronDown,
  Package, Calendar, Truck, CheckCircle2,
  Printer, FileText, User, PlusCircle, MinusCircle, Info, X
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../api-config';

interface PharmacyStockItem {
  id: string;
  productName: string;
  genericName: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unit: string;
  dateReceived: string;
  supplier: string;
  status: 'In Stock' | 'Low Stock' | 'Critical' | 'Expired';
}

interface Medicine {
  MedicineID: number;
  ProductName: string;
  GenericName: string;
  BrandName: string;
  Dosage: string;
  Form: string;
  Description: string;
  UnitID: number;
  UnitName: string;
  CategoryID: number;
  CategoryName: string;
}

interface StockRequestItem {
  id: string;
  medicineId: string;
  quantity: number;
  unitId: string;
}

export function ProductsScreen({ role = 'pharmacy', userId }: { role?: string; userId?: number | null }) {
  const isPharmacyRole = role === 'pharmacy';
  const [pharmacyStocks, setPharmacyStocks] = useState<PharmacyStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Restock Request State
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [requestItems, setRequestItems] = useState<StockRequestItem[]>([
    { id: '1', medicineId: '', quantity: 0, unitId: '' }
  ]);
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastRequestId, setLastRequestId] = useState<number | null>(null);

  const fetchPharmacyStocks = async () => {
    try {
      const res = await fetch(`${API_URL}/api/pharmacy/inventory-full`, { 
        headers: { 'Bypass-Tunnel-Reminder': 'true' } 
      });
      const data = await res.json();
      
      const today = new Date();
      const enriched = data.map((item: any) => {
        const expDate = new Date(item.expiryDate);
        let status: 'In Stock' | 'Low Stock' | 'Critical' | 'Expired' = 'In Stock';
        
        if (expDate < today) status = 'Expired';
        else if (item.quantity <= 5) status = 'Critical';
        else if (item.quantity <= 20) status = 'Low Stock';
        
        return {
          ...item,
          expiryDate: new Date(item.expiryDate).toISOString().split('T')[0],
          status
        };
      });
      
      setPharmacyStocks(enriched);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load pharmacy stock inventory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPharmacyStocks();
  }, []);

  useEffect(() => {
    if (showRestockModal) {
      fetch(`${API_URL}/api/medicines`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } })
        .then(res => res.json())
        .then(setMedicines)
        .catch(e => console.error(e));
    }
  }, [showRestockModal]);

  const addRequestRow = () => {
    setRequestItems(prev => [...prev, { id: Math.random().toString(), medicineId: '', quantity: 0, unitId: '' }]);
  };

  const removeRequestRow = (id: string) => {
    setRequestItems(prev => prev.filter(i => i.id !== id));
  };

  const updateRequestItem = (id: string, field: string, value: any) => {
    setRequestItems(prev => prev.map(i => {
      if (i.id === id) {
        const newItem = { ...i, [field]: value };
        if (field === 'medicineId') {
          const med = medicines.find(m => m.MedicineID.toString() === value);
          if (med) newItem.unitId = med.UnitID.toString();
          else newItem.unitId = '';
        }
        return newItem;
      }
      return i;
    }));
  };

  const handleSaveRequest = async () => {
    if (!userId) { 
      toast.error('User ID not identified. Please re-login.'); 
      return; 
    }
    if (requestItems.some(i => !i.medicineId || i.quantity <= 0)) { 
      toast.error('Please specify valid medicines and quantities for all lines.'); 
      return; 
    }
    
    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/stock-request`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Bypass-Tunnel-Reminder': 'true' 
        },
        body: JSON.stringify({
          userId,
          remarks,
          items: requestItems.map(i => ({ 
            medicineId: parseInt(i.medicineId), 
            quantity: i.quantity, 
            unitId: parseInt(i.unitId) 
          }))
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Restock request submitted to Central Warehouse!');
        setLastRequestId(data.requestId);
      } else {
        toast.error(data.message || 'Failed to submit restock request.');
      }
    } catch (err) {
      toast.error('Connection error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = async (requestId?: number | null) => {
    let data;
    try {
      if (requestId) {
        const res = await fetch(`${API_URL}/api/stock-request/${requestId}`, { 
          headers: { 'Bypass-Tunnel-Reminder': 'true' } 
        });
        data = await res.json();
      } else {
        data = {
          RequestID: 0,
          RequestDate: new Date().toISOString(),
          RequesterName: 'Pharmacy Staff',
          Status: 'DRAFT',
          Remarks: remarks,
          details: requestItems.filter(i => i.medicineId && i.quantity > 0).map(item => {
            const med = medicines.find(m => m.MedicineID.toString() === item.medicineId);
            return {
              ProductName: med?.ProductName || 'Unknown Medicine',
              GenericName: med?.GenericName || '',
              CategoryName: med?.CategoryName || 'General',
              UnitName: med?.UnitName || 'Units',
              QuantityRequested: item.quantity
            };
          })
        };
        
        if (data.details.length === 0) {
          toast.error('Please add at least one item to print a draft.');
          return;
        }
      }
    } catch (err) {
      toast.error('Failed to load request data for printing.');
      return;
    }

    if (!data) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Requisition and Issue Slip - Catbalogan City Health</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 11pt; color: #111; }
            h2, h3 { text-align: center; margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #333; padding: 6px 10px; font-size: 10pt; }
            th { background: #f0f0f0; text-transform: uppercase; font-size: 9pt; }
            .header-info { margin-top: 15px; display: flex; justify-content: space-between; }
          </style>
        </head>
        <body>
          <h2>CITY HEALTH OFFICE - CATBALOGAN CITY</h2>
          <h3>REQUISITION AND ISSUE SLIP (STOCK REQUEST)</h3>
          <div class="header-info">
            <div><b>Request ID:</b> SR-${data.RequestID || 'DRAFT'}</div>
            <div><b>Date:</b> ${new Date(data.RequestDate).toLocaleDateString()}</div>
          </div>
          <div style="margin-top: 8px;"><b>Remarks/Purpose:</b> ${data.Remarks || 'Pharmacy Dispensary Restock'}</div>

          <table>
            <thead>
              <tr>
                <th>No.</th>
                <th>Item / Formulation</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Quantity Requested</th>
              </tr>
            </thead>
            <tbody>
              ${data.details.map((item: any, idx: number) => `
                <tr>
                  <td style="text-align: center;">${idx + 1}</td>
                  <td><b>${item.ProductName}</b> ${item.GenericName ? `(${item.GenericName})` : ''}</td>
                  <td>${item.CategoryName || 'General'}</td>
                  <td style="text-align: center;">${item.UnitName}</td>
                  <td style="text-align: center; font-weight: bold;">${item.QuantityRequested}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = () => { window.print(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return pharmacyStocks.filter(item =>
      !q ||
      item.productName.toLowerCase().includes(q) ||
      item.genericName.toLowerCase().includes(q) ||
      item.batchNumber.toLowerCase().includes(q)
    );
  }, [pharmacyStocks, searchQuery]);

  const lowStockCount = useMemo(() => 
    pharmacyStocks.filter(i => i.status === 'Low Stock' || i.status === 'Critical').length
  , [pharmacyStocks]);
  
  const expiredCount = useMemo(() => 
    pharmacyStocks.filter(i => i.status === 'Expired').length
  , [pharmacyStocks]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 bg-background min-h-full text-foreground select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Pill className="w-5 h-5" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
              Pharmacy Medicine Stock
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium">
            Active dispensary inventory batches allocated for patient fulfillment.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowRestockModal(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all"
          >
            <Truck className="w-4 h-4" />
            Request Restock
          </button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Active Batches</p>
            <p className="text-xl sm:text-2xl font-black text-foreground">{pharmacyStocks.length}</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Low / Critical Stock</p>
            <p className="text-xl sm:text-2xl font-black text-amber-500">{lowStockCount}</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-card border border-border shadow-sm flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Expired Batches</p>
            <p className="text-xl sm:text-2xl font-black text-destructive">{expiredCount}</p>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Search Bar */}
        <div className="p-4 sm:p-6 border-b border-border bg-muted/10">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by product name, generic formulation, or batch number..."
              className="w-full pl-11 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Product / Formulation</th>
                <th className="px-6 py-4">Batch / Lot No.</th>
                <th className="px-6 py-4">Expiration Date</th>
                <th className="px-6 py-4 text-center">Dispensary Stock</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                      <p className="text-xs font-bold uppercase tracking-wider">Loading Stock...</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground text-xs font-medium">
                    No matching medicine stock found.
                  </td>
                </tr>
              ) : (
                filtered.map(item => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                        {item.productName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {item.genericName || 'Standard Formulation'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-muted text-foreground border border-border/60">
                        {item.batchNumber}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-foreground">
                      {item.expiryDate}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="font-black text-foreground text-sm">{item.quantity}</span>{' '}
                      <span className="text-xs text-muted-foreground">{item.unit}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        item.status === 'In Stock' ? 'bg-emerald-500/10 text-emerald-500' :
                        item.status === 'Low Stock' ? 'bg-amber-500/10 text-amber-500' :
                        'bg-destructive/10 text-destructive'
                      }`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile / Tablet Cards View (< md) */}
        <div className="md:hidden divide-y divide-border">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs font-medium">
              No stock batches found.
            </div>
          ) : (
            filtered.map(item => (
              <div key={item.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground text-sm">{item.productName}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                    item.status === 'In Stock' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                  }`}>
                    {item.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Lot: <strong className="text-foreground">{item.batchNumber}</strong></span>
                  <span>Exp: {item.expiryDate}</span>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">{item.genericName || 'General'}</span>
                  <span className="font-black text-primary">{item.quantity} {item.unit}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* RESTOCK REQUEST MODAL                                            */}
      {/* ---------------------------------------------------------------- */}
      <AnimatePresence>
        {showRestockModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div 
              className="absolute inset-0" 
              onClick={() => { 
                setShowRestockModal(false); 
                setLastRequestId(null); 
                setRequestItems([{ id: '1', medicineId: '', quantity: 0, unitId: '' }]); 
              }} 
            />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card text-card-foreground w-full max-w-3xl rounded-3xl shadow-2xl border border-border flex flex-col max-h-[92vh] overflow-hidden relative z-10"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">Request Restock from Warehouse</h2>
                    <p className="text-xs text-muted-foreground">Pharmacy initiated multi-item warehouse replenishment request</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { 
                    setShowRestockModal(false); 
                    setLastRequestId(null); 
                    setRequestItems([{ id: '1', medicineId: '', quantity: 0, unitId: '' }]); 
                  }}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-foreground uppercase tracking-wider text-[11px]">Requested Line Items</span>
                  {!lastRequestId && (
                    <button
                      type="button"
                      onClick={addRequestRow}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 flex items-center gap-1.5 transition-colors"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      Add Item
                    </button>
                  )}
                </div>

                <div className="space-y-3">
                  {requestItems.map(item => (
                    <div 
                      key={item.id} 
                      className="p-4 rounded-2xl bg-muted/20 border border-border flex flex-col sm:flex-row items-stretch sm:items-center gap-3"
                    >
                      <div className="flex-1">
                        <select
                          disabled={!!lastRequestId}
                          value={item.medicineId}
                          onChange={e => updateRequestItem(item.id, 'medicineId', e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                        >
                          <option value="">Select medicine formulation...</option>
                          {medicines.map(m => (
                            <option key={m.MedicineID} value={m.MedicineID}>
                              {m.ProductName} ({m.GenericName || 'Standard'}) • {m.UnitName}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full sm:w-28">
                        <input
                          disabled={!!lastRequestId}
                          type="number"
                          min="1"
                          value={item.quantity || ''}
                          onChange={e => updateRequestItem(item.id, 'quantity', parseInt(e.target.value) || 0)}
                          placeholder="Quantity"
                          className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-xs font-bold text-foreground text-center focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>

                      {!lastRequestId && requestItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRequestRow(item.id)}
                          className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 self-end sm:self-auto"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">Requisition Remarks / Clinical Justification</label>
                  <textarea
                    disabled={!!lastRequestId}
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    placeholder="Specify urgency, seasonal surge, or outpatient department requirements..."
                    className="w-full p-3.5 rounded-xl bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 min-h-[90px] resize-none"
                  />
                </div>

                {lastRequestId && (
                  <div className="p-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                    <p className="font-bold text-sm text-foreground">Request #SR-{String(lastRequestId).padStart(5, '0')} Created</p>
                    <p className="text-xs text-muted-foreground">Queued in the Central Warehouse Outbound Stock Request system.</p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => handlePrint(lastRequestId)}
                  className="px-4 py-2.5 rounded-xl border border-border text-foreground font-bold hover:bg-muted text-xs uppercase flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Print RIS Form
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { 
                      setShowRestockModal(false); 
                      setLastRequestId(null); 
                      setRequestItems([{ id: '1', medicineId: '', quantity: 0, unitId: '' }]); 
                    }}
                    className="px-5 py-2.5 rounded-xl border border-border text-foreground font-bold hover:bg-muted text-xs uppercase"
                  >
                    {lastRequestId ? 'Close' : 'Cancel'}
                  </button>

                  {!lastRequestId && (
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={async () => {
                        await handleSaveRequest();
                        fetchPharmacyStocks();
                      }}
                      className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs uppercase hover:bg-primary/90 shadow-md shadow-primary/20 disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {isSubmitting ? 'Transmitting...' : <><FileText className="w-4 h-4" /> Submit Request</>}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
