import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, Filter, Eye, Download, Calendar, Pill, User, 
  CreditCard, X, CheckCircle2, FileText, ArrowUpDown, 
  Receipt, Printer, ChevronRight, Clock, ShieldCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../api-config';

interface Order {
  id: string;
  rawId: number;
  date: string;
  time: string;
  patient: string;
  items: number;
  total: number;
  status: string;
  payment: string;
}

export function OrdersScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('All Status');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/api/pharmacy/sales-history`, { 
      headers: { 'Bypass-Tunnel-Reminder': 'true' } 
    })
      .then(res => res.json())
      .then(data => {
        const formatted = data.map((item: any) => {
          const dateObj = new Date(item.SaleDate);
          return {
            id: `#RX-${item.SaleID}`,
            rawId: item.SaleID,
            date: dateObj.toLocaleDateString(),
            time: dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            patient: item.PatientName || 'Walk-in Patient',
            items: item.TotalItems || 1,
            total: item.TotalValue || 0,
            status: 'Completed',
            payment: 'Cash / Free Health Program'
          };
        });
        setOrders(formatted);
      })
      .catch(err => {
        console.error('Failed to fetch sales history:', err);
        toast.error('Could not load dispensing sales history.');
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return orders.filter(order => {
      const matchStatus = selectedStatus === 'All Status' || order.status === selectedStatus;
      const matchSearch = !q || 
        order.id.toLowerCase().includes(q) ||
        order.patient.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [orders, selectedStatus, searchQuery]);

  // Summary Metrics
  const totalSalesValue = useMemo(() => orders.reduce((sum, o) => sum + o.total, 0), [orders]);
  const totalDispensedItems = useMemo(() => orders.reduce((sum, o) => sum + o.items, 0), [orders]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 bg-background min-h-full text-foreground select-none">
      {/* Header & KPI Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Sales & Dispensing History
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
            Complete audit trail of pharmacy dispensations and patient transaction receipts.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button 
            type="button"
            onClick={handlePrint}
            className="px-4 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-all shadow-sm flex items-center gap-2"
          >
            <Printer className="w-4 h-4 text-muted-foreground" />
            Print Report
          </button>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 sm:p-5 rounded-[16px] bg-card border border-border/50 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Transactions</p>
            <p className="text-xl sm:text-2xl font-black text-foreground">{orders.length}</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-[16px] bg-card border border-border/50 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <Pill className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Units Dispensed</p>
            <p className="text-xl sm:text-2xl font-black text-foreground">{totalDispensedItems}</p>
          </div>
        </div>

        <div className="p-4 sm:p-5 rounded-[16px] bg-card border border-border/50 shadow-xs flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <CreditCard className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Total Value Dispensed</p>
            <p className="text-xl sm:text-2xl font-black text-primary">₱{totalSalesValue.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Main Content Card */}
      <div className="bg-card rounded-[16px] border border-border/50 shadow-xs overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="p-4 sm:p-6 border-b border-border bg-muted/10">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by Rx ID, Patient Name..."
                className="w-full pl-11 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="px-4 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                <option value="All Status">All Status</option>
                <option value="Completed">Completed</option>
                <option value="Pending">Pending</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Date & Time</th>
                <th className="px-6 py-4">Patient Name</th>
                <th className="px-6 py-4 text-center">Units</th>
                <th className="px-6 py-4 text-right">Total Value</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-muted-foreground">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                      <p className="text-xs font-bold uppercase tracking-wider">Loading Sales History...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-xs font-medium">
                    No matching sales transactions found.
                  </td>
                </tr>
              ) : (
                filteredOrders.map(order => (
                  <tr 
                    key={order.id} 
                    className="hover:bg-muted/30 transition-colors group cursor-pointer"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <td className="px-6 py-4 font-mono font-bold text-primary">
                      {order.id}
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-foreground">
                      {order.date} <span className="text-muted-foreground ml-1">{order.time}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-foreground">
                      {order.patient}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">
                      {order.items}
                    </td>
                    <td className="px-6 py-4 text-right font-black text-foreground">
                      ₱{order.total.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        <CheckCircle2 className="w-3 h-3" />
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOrder(order);
                        }}
                        className="p-2 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        title="View Receipt Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile / Tablet Cards View (< md) */}
        <div className="md:hidden divide-y divide-border">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-xs font-medium">
              Loading transactions...
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-xs font-medium">
              No transactions found.
            </div>
          ) : (
            filteredOrders.map(order => (
              <div
                key={order.id}
                onClick={() => setSelectedOrder(order)}
                className="p-4 space-y-2 hover:bg-muted/20 active:bg-muted/30 transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary text-sm">{order.id}</span>
                  <span className="text-xs font-black text-foreground">₱{order.total.toFixed(2)}</span>
                </div>

                <div className="flex items-center justify-between text-xs text-foreground">
                  <span className="font-bold">{order.patient}</span>
                  <span className="text-muted-foreground">{order.items} Units</span>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
                  <span>{order.date} • {order.time}</span>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-emerald-500/10 text-emerald-500">
                    {order.status}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* TRANSACTION RECEIPT DETAIL MODAL                                  */}
      {/* ---------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedOrder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => setSelectedOrder(null)} />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card text-card-foreground rounded-3xl shadow-2xl relative z-10 border border-border overflow-hidden w-full max-w-lg flex flex-col"
            >
              {/* Receipt Header */}
              <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">Dispensing Receipt</h3>
                    <p className="text-xs font-mono text-muted-foreground">{selectedOrder.id}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Receipt Body */}
              <div className="p-6 space-y-5 text-xs">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/60 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Facility:</span>
                    <span className="font-bold text-foreground">Catbalogan City Health Department</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Patient:</span>
                    <span className="font-bold text-foreground">{selectedOrder.patient}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date & Time:</span>
                    <span className="font-bold text-foreground">{selectedOrder.date} at {selectedOrder.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Payment Program:</span>
                    <span className="font-bold text-foreground">{selectedOrder.payment}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fulfillment Status:</span>
                    <span className="font-bold text-emerald-500 uppercase">{selectedOrder.status}</span>
                  </div>
                </div>

                <div className="border-t border-b border-dashed border-border py-4 space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Total Medications Dispensed:</span>
                    <span className="font-bold text-foreground">{selectedOrder.items} Units</span>
                  </div>
                  <div className="flex justify-between text-base font-black pt-1">
                    <span className="text-foreground">Total Transaction Value:</span>
                    <span className="text-primary">₱{selectedOrder.total.toFixed(2)}</span>
                  </div>
                </div>

                <p className="text-[11px] text-muted-foreground text-center italic">
                  Certified government prescription dispensation. Deducted via Azure SQL FEFO inventory batch logs.
                </p>
              </div>

              {/* Receipt Footer */}
              <div className="p-5 border-t border-border bg-muted/20 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 py-2.5 rounded-xl border border-border text-foreground font-bold hover:bg-muted transition-colors text-xs uppercase"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all text-xs uppercase flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print Receipt
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
