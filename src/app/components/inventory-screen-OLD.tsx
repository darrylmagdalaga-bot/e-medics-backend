import { useState, useEffect } from 'react';
import {
  ArrowUpRight, ArrowDownLeft, History, Filter, Plus, Trash2,
  AlertCircle, CheckCircle2, Building2, Calendar, FileText,
  Package, Tag, Layers, ClipboardList, ShieldAlert, ShieldCheck,
  X, Database, PackagePlus, Hash, Truck, Search, Info
} from 'lucide-react';
import { toast } from 'sonner';

interface WarehouseProduct {
  id: string;
  name: string;
  description: string;
  measure: string;
  category: string;
  productType: string;
  stock: number;
}

interface StockEntry {
  id: string;
  productId: string;
  batchNumber: string;
  expiryDate: string;
  quantityAdded: number;
  supplier: string;
  dateReceived: string;
}

interface IssueItem {
  id: string;
  medicineId: string;
  quantity: number;
}

const MEASURE_OPTIONS = [
  'Tablet', 'Capsule', 'Bottle', 'Box', 'Ampule', 'Drops', 'Tube',
  'Vial', 'Nebule', 'Aerosol', 'Inhaler', 'Sachet', 'Syrup',
  'Liter', 'ml', 'mg', 'g', 'kg', 'Piece', 'Set',
];

const CATEGORY_OPTIONS = [
  'Medicine', 'Medical Supplies', 'Equipment', 'Consumables',
  'Biologics', 'Vaccines', 'Vitamins & Supplements', 'Others',
];

const PRODUCT_TYPE_OPTIONS = [
  'Generic', 'Branded', 'OTC (Over-the-Counter)', 'Prescription',
  'Consumable', 'Controlled Substance',
];

const INITIAL_WAREHOUSE_PRODUCTS: WarehouseProduct[] = [
  { id: 'W-001', name: 'Amoxicillin 500mg', description: 'Broad-spectrum antibiotic capsule', measure: 'Capsule', category: 'Medicine', productType: 'Generic', stock: 1200 },
  { id: 'W-002', name: 'Paracetamol 500mg', description: 'Analgesic and antipyretic tablet', measure: 'Tablet', category: 'Medicine', productType: 'Generic', stock: 5000 },
  { id: 'W-003', name: 'Vitamin C 1000mg', description: 'Ascorbic acid supplement', measure: 'Tablet', category: 'Vitamins & Supplements', productType: 'OTC (Over-the-Counter)', stock: 600 },
  { id: 'W-004', name: 'Insulin Glargine', description: 'Long-acting insulin for diabetes management', measure: 'Vial', category: 'Medicine', productType: 'Prescription', stock: 40 },
  { id: 'W-005', name: 'Salbutamol Inhaler', description: 'Bronchodilator for respiratory conditions', measure: 'Inhaler', category: 'Medicine', productType: 'Prescription', stock: 280 },
];

const MOCK_HISTORY = [
  { id: 'TX-9021', type: 'Issue', items: 'Amoxicillin 500mg (20 qty)', destination: 'Emergency Ward', date: '2026-04-25', status: 'Completed' },
  { id: 'TX-9020', type: 'Receipt', items: 'Paracetamol 500mg (50 qty)', destination: 'Supplier A', date: '2026-04-24', status: 'Completed' },
  { id: 'TX-9019', type: 'Issue', items: 'Vitamin C 1000mg (10 qty)', destination: 'Outpatient Dept', date: '2026-04-24', status: 'Completed' },
];

const BLANK_PRODUCT_FORM = { name: '', description: '', measure: '', category: '', productType: '' };
const BLANK_STOCK_FORM = {
  productId: '', batchNumber: '', expiryDate: '',
  quantityToAdd: '', supplier: '', dateReceived: new Date().toISOString().split('T')[0],
};

export function InventoryScreen({ action, clearAction, role = 'inventory' }: { action?: string | null, clearAction?: () => void, role?: string }) {
  const isInventoryRole = role === 'inventory' || role === 'warehouse' || role === 'Warehouse Staff';
  const [activeTab, setActiveTab] = useState<'inventory' | 'requests' | 'history'>('inventory');
  
  const [warehouseProducts, setWarehouseProducts] = useState<WarehouseProduct[]>(INITIAL_WAREHOUSE_PRODUCTS);
  const [stockEntries, setStockEntries] = useState<StockEntry[]>([]);
  const [stockRequests, setStockRequests] = useState<any[]>([]);
  
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  const [issueItems, setIssueItems] = useState<IssueItem[]>([{ id: '1', medicineId: '', quantity: 0 }]);
  const [destination, setDestination] = useState('');
  const [remarks, setRemarks] = useState('');
  const [reference, setReference] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);

  const [productForm, setProductForm] = useState(BLANK_PRODUCT_FORM);
  const [productErrors, setProductErrors] = useState<Record<string, string>>({});
  const [duplicateWarning, setDuplicateWarning] = useState('');

  const [stockForm, setStockForm] = useState(BLANK_STOCK_FORM);
  const [stockErrors, setStockErrors] = useState<Record<string, string>>({});
  const [stockSearch, setStockSearch] = useState('');
  const [showStockProductDropdown, setShowStockProductDropdown] = useState(false);

  const fetchStockRequests = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/stock-requests', { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
      const data = await res.json();
      if (Array.isArray(data)) setStockRequests(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStockRequests();
    const interval = setInterval(fetchStockRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (action === 'open-bulk-issue') {
      setShowBulkModal(true);
      clearAction?.();
    }
  }, [action, clearAction]);

  const handleUpdateStatus = async (requestId: number, newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      const res = await fetch(`http://localhost:5000/api/stock-request/${requestId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        toast.success(`Request #${requestId} is now ${newStatus}`);
        fetchStockRequests();
        if (selectedRequest?.RequestID === requestId) {
           const detailRes = await fetch(`http://localhost:5000/api/stock-request/${requestId}`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
           setSelectedRequest(await detailRes.json());
        }
      }
    } catch (err) {
      toast.error('Failed to update status.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const viewRequestDetails = async (request: any) => {
    try {
      const res = await fetch(`http://localhost:5000/api/stock-request/${request.RequestID}`, { headers: { 'Bypass-Tunnel-Reminder': 'true' } });
      const data = await res.json();
      setSelectedRequest(data);
    } catch (err) {
      toast.error('Failed to load request details.');
    }
  };

  const handleBulkIssue = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Successfully issued items');
    setShowBulkModal(false);
  };

  const handleAddNewProduct = () => {
    toast.success('New product added');
    setShowAddProductModal(false);
  };

  const handleAddStock = () => {
    toast.success('Stock updated');
    setShowAddStockModal(false);
  };

  return (
    <div className="p-8 space-y-8 bg-[#fdfdfd] min-h-full">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#1a1a5e] tracking-tight">Inventory Control</h1>
          <p className="text-sm text-gray-400 font-medium mt-1">Warehouse product registry & stock management</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowAddProductModal(true)} className="px-5 py-2.5 bg-white border border-gray-200 text-[#1a1a5e] rounded-xl text-sm font-bold shadow-sm hover:bg-gray-50 transition-all">Add New Item</button>
          <button onClick={() => setShowAddStockModal(true)} className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-sm font-bold shadow-md hover:bg-green-700 transition-all">Add Stock</button>
          <button onClick={() => setShowBulkModal(true)} className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-bold shadow-md hover:bg-primary/90 transition-all">Issue Stock</button>
        </div>
      </div>

      <div className="flex items-center gap-1 bg-gray-100/50 p-1.5 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveTab('inventory')} 
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'inventory' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
        >
          Warehouse Registry
        </button>
        <button 
          onClick={() => setActiveTab('requests')} 
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'requests' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
        >
          Restock Requests
          {stockRequests.filter(r => r.Status === 'Pending').length > 0 && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
        </button>
        <button 
          onClick={() => setActiveTab('history')} 
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-gray-400'}`}
        >
          Movement History
        </button>
      </div>

      {activeTab === 'inventory' && (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-50">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Measure</th>
                <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {warehouseProducts.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/40 transition-colors">
                  <td className="px-6 py-5 font-bold text-[#1a1a5e]">{p.name}</td>
                  <td className="px-6 py-5 text-xs text-gray-500 uppercase">{p.measure}</td>
                  <td className="px-6 py-5 font-black text-primary">{p.stock}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-50">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Request ID</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Requester</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stockRequests.length === 0 ? (
                <tr><td colSpan={4} className="px-8 py-20 text-center text-gray-400">No requests found.</td></tr>
              ) : stockRequests.map(r => (
                <tr key={r.RequestID} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-8 py-6 font-black text-[#1a1a5e]">#SR-{String(r.RequestID).padStart(5, '0')}</td>
                  <td className="px-8 py-6 text-sm font-bold text-gray-600">{r.RequesterName}</td>
                  <td className="px-8 py-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      r.Status === 'Pending' ? 'bg-amber-50 text-amber-600' : 
                      r.Status === 'Accepted' ? 'bg-blue-50 text-blue-600' :
                      'bg-green-50 text-green-600'
                    }`}>
                      {r.Status}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button onClick={() => viewRequestDetails(r)} className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-black shadow-sm hover:bg-gray-50 transition-all">Review</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-50">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Ref No</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Type</th>
                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {MOCK_HISTORY.map(tx => (
                <tr key={tx.id}>
                  <td className="px-8 py-6 font-black text-[#1a1a5e]">{tx.id}</td>
                  <td className="px-8 py-6 text-sm font-bold text-gray-600 uppercase">{tx.type}</td>
                  <td className="px-8 py-6 text-sm text-gray-400">{tx.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedRequest && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-[#1a1a5e]/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl rounded-[32px] shadow-2xl p-8 space-y-6 flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-start shrink-0">
              <h2 className="text-2xl font-black text-[#1a1a5e]">Request Details #SR-{String(selectedRequest.RequestID).padStart(5, '0')}</h2>
              <button onClick={() => setSelectedRequest(null)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Requester</p>
                    <p className="text-sm font-black text-[#1a1a5e]">{selectedRequest.RequesterName}</p>
                 </div>
                 <div className="p-4 bg-gray-50 rounded-2xl">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                    <p className="text-sm font-black text-primary uppercase">{selectedRequest.Status}</p>
                 </div>
              </div>
              <div className="border border-gray-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr><th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400">Medicine</th><th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400">Qty</th><th className="px-4 py-3 text-[10px] font-black uppercase text-gray-400">Unit</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {selectedRequest.details?.map((item: any, i: number) => (
                      <tr key={i}>
                        <td className="px-4 py-3 text-sm font-bold text-[#1a1a5e]">{item.ProductName}</td>
                        <td className="px-4 py-3 text-sm text-primary font-black">{item.QuantityRequested}</td>
                        <td className="px-4 py-3 text-xs text-gray-500">{item.UnitName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedRequest.Remarks && (
                <div className="p-4 bg-amber-50 rounded-2xl text-sm italic text-amber-900 border border-amber-100">
                  "{selectedRequest.Remarks}"
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 pt-6 border-t border-gray-50 shrink-0">
              <button onClick={() => setSelectedRequest(null)} className="px-8 py-4 bg-white border border-gray-200 rounded-2xl font-bold text-sm hover:bg-gray-50 transition-all active:scale-95 shadow-sm">Close</button>
              {selectedRequest.Status === 'Pending' && (
                <button 
                  onClick={() => handleUpdateStatus(selectedRequest.RequestID, 'Accepted')} 
                  disabled={isUpdatingStatus}
                  className="px-10 py-4 bg-primary text-white rounded-2xl font-black shadow-xl shadow-primary/20 hover:bg-primary/90 transition-all active:scale-95 flex items-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" /> Accept Request
                </button>
              )}
              {selectedRequest.Status === 'Accepted' && (
                <button 
                  onClick={() => handleUpdateStatus(selectedRequest.RequestID, 'Completed')} 
                  disabled={isUpdatingStatus}
                  className="px-10 py-4 bg-green-600 text-white rounded-2xl font-black shadow-xl shadow-green-600/20 hover:bg-green-700 transition-all active:scale-95 flex items-center gap-2"
                >
                  <PackagePlus className="w-5 h-5" /> Mark Completed
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-xl rounded-[32px] p-8 space-y-6 shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-black text-[#1a1a5e]">Bulk Issue Stock</h2>
              <button onClick={() => setShowBulkModal(false)}><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-400">Warehouse internal distribution module.</p>
            <div className="flex justify-end gap-3 mt-8">
               <button onClick={() => setShowBulkModal(false)} className="px-6 py-3 border border-gray-200 rounded-xl font-bold hover:bg-gray-50 transition-all">Cancel</button>
               <button onClick={() => { toast.success('Stock Issued'); setShowBulkModal(false); }} className="px-8 py-3 bg-primary text-white rounded-xl font-black shadow-lg">Confirm Issue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
