import React, { useState, useEffect, useMemo } from 'react';
import {
  Search, Plus, Edit, Mail, Phone, User, Activity, Clipboard,
  ShieldCheck, X, CheckCircle2, MapPin, Calendar, Hash,
  ChevronRight, Users
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { API_URL } from '../api-config';

interface PatientRecord {
  id: string;
  patientId: string;
  firstName: string;
  middleName: string;
  surname: string;
  birthDate: string;
  brgy: string;
  detailedAddress: string;
  contactNo: string;
  email: string;
  status: 'Active' | 'Regular' | 'New';
  visits: number;
  lastVisit: string;
}

const CATBALOGAN_BRGYS = [
  'Bagacay', 'Balogo', 'Bangon', 'Basiao', 'Batiawan', 'Biasong',
  'Buenavista', 'Buluan', 'Burgos', 'Cabilihan', 'Cagmanaba', 'Cag-olango',
  'Canlapwas', 'Canta-us', 'Cantariwis', 'Canticum', 'Casandig', 'Cave',
  'Concepcion', 'Deit-na-tawid', 'Deit-na-kubay', 'Dinabadiawan', 'Dinabawan',
  'Gandara', 'Guindaponan', 'Guinsorongan', 'Hilabago', 'Hinabay', 'Hinapolan',
  'Kalipayan', 'Lagundi', 'Laygayon', 'Looc', 'Mabini', 'Magdalena', 'Malabog',
  'Mambajao', 'Manguehay', 'Mercedes', 'Mombon', 'Munoz', 'New Mahayag',
  'Palanyogon', 'Panlayangan', 'Paraiso', 'Payao', 'Poblacion 1 (Barangay 1)',
  'Poblacion 2 (Barangay 2)', 'Poblacion 3 (Barangay 3)', 'Poblacion 4 (Barangay 4)',
  'Poblacion 5 (Barangay 5)', 'Poblacion 6 (Barangay 6)', 'Poblacion 7 (Barangay 7)',
  'Poblacion 8 (Barangay 8)', 'Poblacion 9 (Barangay 9)', 'Poblacion 10 (Barangay 10)',
  'Rawis', 'Rizal', 'Sacol', 'San Andres', 'San Isidro', 'San Roque', 'San Vicente',
  'Santa Cruz', 'Santa Lucia', 'Santo Niño', 'Sinugbuhanon', 'Solano', 'Tinaplacan',
  'Tinawagan', 'Tulay', 'Uban', 'Urdaneta', 'Villahermosa',
];

const BLANK_FORM = {
  firstName: '', middleName: '', surname: '',
  birthDate: '', brgy: '', detailedAddress: '',
  contactNo: '', email: '',
};

export function CustomersScreen({ role = 'pharmacy' }: { role?: string }) {
  const isPharmacyRole = role === 'pharmacy';
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [form, setForm] = useState(BLANK_FORM);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchPatients = async () => {
    try {
      const res = await fetch(`${API_URL}/api/patients`, { 
        headers: { 'Bypass-Tunnel-Reminder': 'true' } 
      });
      const data = await res.json();
      
      const mapped = data.map((p: any) => ({
        id: p.PatientID.toString(),
        patientId: `PX-${p.PatientID.toString().padStart(4, '0')}`,
        firstName: p.FirstName || '',
        middleName: p.MiddleName || '',
        surname: p.Surname || '',
        birthDate: p.BirthDate ? new Date(p.BirthDate).toISOString().split('T')[0] : '',
        brgy: p.Barangay || 'N/A',
        detailedAddress: p.DetailedAddress || '',
        contactNo: p.ContactNumber || '',
        email: p.Email || '',
        visits: p.Visits || 0,
        lastVisit: p.LastVisit ? new Date(p.LastVisit).toLocaleDateString() : 'Never',
        status: (p.Visits || 0) > 10 ? 'Regular' : (p.Visits || 0) > 0 ? 'Active' : 'New'
      }));
      
      setPatients(mapped);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load patient records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return patients.filter(p => {
      const fullName = `${p.firstName} ${p.middleName} ${p.surname}`.toLowerCase();
      const matchSearch = !q || 
        fullName.includes(q) ||
        p.patientId.toLowerCase().includes(q) ||
        p.contactNo.includes(q);
      const matchStatus = statusFilter === 'All Status' || p.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [patients, searchQuery, statusFilter]);

  const setField = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const resetModal = () => {
    setForm(BLANK_FORM);
    setErrors({});
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.firstName.trim()) e.firstName = 'First name is required.';
    if (!form.surname.trim()) e.surname = 'Surname is required.';
    if (!form.brgy) e.brgy = 'Barangay is required.';
    if (!form.contactNo.trim()) {
      e.contactNo = 'Contact number is required.';
    } else if (!/^\d{7,15}$/.test(form.contactNo.trim())) {
      e.contactNo = 'Contact number must be numeric (7–15 digits).';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleRegisterPatient = async () => {
    if (!isPharmacyRole) {
      toast.error('Access Denied — This module is for Pharmacy use only.');
      return;
    }
    if (!validate()) {
      toast.error('Please complete all required fields.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/patients`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Bypass-Tunnel-Reminder': 'true' 
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Patient registered successfully.');
        setShowRegisterModal(false);
        resetModal();
        fetchPatients();
      } else {
        toast.error(data.message || 'Failed to register patient.');
      }
    } catch (err) {
      toast.error('Connection error.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background text-foreground gap-4">
        <div className="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          Loading Patient Registry...
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 sm:space-y-8 bg-background min-h-full text-foreground select-none">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
            Patient Registry
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground font-medium mt-1">
            Registered patients for clinical dispensary operations and health programs.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowRegisterModal(true)}
          className="px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Register Patient
        </button>
      </div>

      {/* Info Badge */}
      <div className="bg-primary/5 border border-primary/10 p-4 rounded-2xl flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-xs font-bold text-primary uppercase tracking-wider">Confidential Clinical Records</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Patient health data and address records are managed within the City Health Pharmacy dispensary.
          </p>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Patients', value: patients.length, icon: Users, color: 'text-primary' },
          { label: 'Active Patients', value: patients.filter(p => p.status === 'Active').length, icon: Activity, color: 'text-emerald-500' },
          { label: 'New Registrations', value: patients.filter(p => p.status === 'New').length, icon: Plus, color: 'text-blue-500' },
          { label: 'Regular Visits', value: patients.filter(p => p.status === 'Regular').length, icon: Clipboard, color: 'text-amber-500' },
        ].map((stat, i) => (
          <div key={i} className="bg-card p-4 sm:p-5 rounded-2xl border border-border shadow-sm flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center shrink-0">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className="text-xl sm:text-2xl font-black text-foreground">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main Table Container */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Search & Filters */}
        <div className="p-4 sm:p-6 border-b border-border bg-muted/10 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by patient name, PX ID, or contact number..."
              className="w-full pl-11 pr-4 py-2.5 bg-card border border-border rounded-xl text-xs sm:text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-card border border-border rounded-xl text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="All Status">All Status</option>
            <option value="Active">Active</option>
            <option value="Regular">Regular</option>
            <option value="New">New</option>
          </select>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/30 border-b border-border text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-6 py-4">Patient Profile</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4">Barangay</th>
                <th className="px-6 py-4">Patient ID</th>
                <th className="px-6 py-4 text-center">Visits</th>
                <th className="px-6 py-4">Last Visit</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-muted-foreground text-xs font-medium">
                    No matching patient records found.
                  </td>
                </tr>
              ) : (
                filtered.map(patient => (
                  <tr key={patient.id} className="hover:bg-muted/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase border border-primary/20">
                          {patient.firstName[0] || 'P'}{patient.surname[0] || 'X'}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                            {patient.surname}, {patient.firstName} {patient.middleName}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {patient.birthDate ? `Born: ${patient.birthDate}` : 'DOB Unspecified'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-medium text-foreground">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone className="w-3.5 h-3.5 text-primary/70" />
                        <span>{patient.contactNo || 'No phone'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs font-semibold text-foreground">
                      {patient.brgy}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs font-bold text-primary">
                      {patient.patientId}
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-foreground">
                      {patient.visits}
                    </td>
                    <td className="px-6 py-4 text-xs text-muted-foreground">
                      {patient.lastVisit}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        patient.status === 'Active' ? 'bg-primary/10 text-primary' :
                        patient.status === 'New' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-emerald-500/10 text-emerald-500'
                      }`}>
                        {patient.status}
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
              No patients found.
            </div>
          ) : (
            filtered.map(patient => (
              <div key={patient.id} className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs uppercase">
                      {patient.firstName[0]}{patient.surname[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {patient.surname}, {patient.firstName}
                      </p>
                      <p className="text-[10px] font-mono text-primary">{patient.patientId}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold uppercase bg-primary/10 text-primary">
                    {patient.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary/70" />
                    <span>Brgy. {patient.brgy}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-primary/70" />
                    <span>{patient.contactNo}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* PATIENT REGISTRATION MODAL                                       */}
      {/* ---------------------------------------------------------------- */}
      <AnimatePresence>
        {showRegisterModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="absolute inset-0" onClick={() => { setShowRegisterModal(false); resetModal(); }} />
            
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card text-card-foreground w-full max-w-2xl rounded-3xl shadow-2xl border border-border flex flex-col max-h-[92vh] overflow-hidden relative z-10"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-border bg-muted/20 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <User className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-foreground tracking-tight">Patient Registration</h2>
                    <p className="text-xs text-muted-foreground">Catbalogan City Health Department Dispensary</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setShowRegisterModal(false); resetModal(); }}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-foreground">First Name *</label>
                    <input
                      type="text"
                      value={form.firstName}
                      onChange={e => setField('firstName', e.target.value)}
                      placeholder="e.g. Maria"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-card border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${errors.firstName ? 'border-destructive' : 'border-border'}`}
                    />
                    {errors.firstName && <p className="text-[11px] text-destructive font-semibold">{errors.firstName}</p>}
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground">Middle Name</label>
                    <input
                      type="text"
                      value={form.middleName}
                      onChange={e => setField('middleName', e.target.value)}
                      placeholder="e.g. Santos"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground">Surname *</label>
                    <input
                      type="text"
                      value={form.surname}
                      onChange={e => setField('surname', e.target.value)}
                      placeholder="e.g. Dela Cruz"
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-card border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${errors.surname ? 'border-destructive' : 'border-border'}`}
                    />
                    {errors.surname && <p className="text-[11px] text-destructive font-semibold">{errors.surname}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-primary" /> Birth Date
                    </label>
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={e => setField('birthDate', e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-primary" /> Contact Number *
                    </label>
                    <input
                      type="tel"
                      value={form.contactNo}
                      onChange={e => setField('contactNo', e.target.value.replace(/\D/g, ''))}
                      placeholder="e.g. 09171234567"
                      maxLength={15}
                      className={`w-full px-3.5 py-2.5 rounded-xl bg-card border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 ${errors.contactNo ? 'border-destructive' : 'border-border'}`}
                    />
                    {errors.contactNo && <p className="text-[11px] text-destructive font-semibold">{errors.contactNo}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-primary" /> Barangay *
                  </label>
                  <select
                    value={form.brgy}
                    onChange={e => setField('brgy', e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-xl bg-card border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer ${errors.brgy ? 'border-destructive' : 'border-border'}`}
                  >
                    <option value="">Select barangay…</option>
                    {CATBALOGAN_BRGYS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                  {errors.brgy && <p className="text-[11px] text-destructive font-semibold">{errors.brgy}</p>}
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-primary" /> Detailed Street Address
                  </label>
                  <input
                    type="text"
                    value={form.detailedAddress}
                    onChange={e => setField('detailedAddress', e.target.value)}
                    placeholder="e.g. Zone 4, Maharlika Highway"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-primary" /> Email Address
                  </label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setField('email', e.target.value)}
                    placeholder="e.g. patient@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-card border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-5 border-t border-border bg-muted/20 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setShowRegisterModal(false); resetModal(); }}
                  className="px-5 py-2.5 rounded-xl border border-border text-foreground font-bold hover:bg-muted transition-colors text-xs uppercase"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleRegisterPatient}
                  className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs uppercase hover:bg-primary/90 transition-all shadow-md shadow-primary/20 disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    'Saving...'
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Save Patient
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}