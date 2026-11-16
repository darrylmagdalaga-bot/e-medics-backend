import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  Edit, 
  Stethoscope, 
  UserCheck, 
  Calendar, 
  MapPin, 
  Phone, 
  Mail, 
  ShieldCheck, 
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  ChevronRight
} from 'lucide-react';
import { clinicalApi } from '../../api';
import { PatientRecord } from '../../types';

interface PatientRegistryProps {
  onSelectPatient: (patientId: number) => void;
  onStartConsultation: (patientId: number) => void;
}

const CATBALOGAN_BARANGAYS = [
  'Bagacay', 'Balogo', 'Bangon', 'Basiao', 'Batiawan', 'Biasong',
  'Buenavista', 'Buluan', 'Burgos', 'Cabilihan', 'Cagmanaba', 'Cag-olango',
  'Canlapwas', 'Canta-us', 'Cantariwis', 'Canticum', 'Casandig', 'Cave',
  'Concepcion', 'Deit-na-tawid', 'Deit-na-kubay', 'Dinabadiawan', 'Dinabawan',
  'Gandara', 'Guindaponan', 'Guinsorongan', 'Hilabago', 'Hinabay', 'Hinapolan',
  'Kalipayan', 'Lagundi', 'Laygayon', 'Looc', 'Mabini', 'Magdalena', 'Malabog',
  'Mambajao', 'Manguehay', 'Mercedes', 'Mombon', 'Munoz', 'New Mahayag',
  'Palanyogon', 'Panlayangan', 'Paraiso', 'Payao', 'Poblacion 1',
  'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'Poblacion 5',
  'Poblacion 6', 'Poblacion 7', 'Poblacion 8', 'Poblacion 9',
  'Poblacion 10', 'Poblacion 11', 'Poblacion 12', 'Poblacion 13',
  'Poblacion 14', 'Poblacion 15', 'Pagsanghan', 'San Andres',
  'San Antonio', 'San Isidro', 'San Jose', 'San Pablo', 'San Roque',
  'San Vicente', 'Silanga', 'Socorro', 'Tinaogan', 'Ubi', 'Zubang'
];

export function PatientRegistry({ onSelectPatient, onStartConsultation }: PatientRegistryProps) {
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [barangayFilter, setBarangayFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');

  // Add / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<PatientRecord | null>(null);
  const [formData, setFormData] = useState<Partial<PatientRecord>>({
    FirstName: '',
    MiddleName: '',
    Surname: '',
    BirthDate: '',
    Gender: 'Male',
    CivilStatus: 'Single',
    Barangay: 'Poblacion 1',
    DetailedAddress: '',
    ContactNumber: '',
    Email: '',
    PhilHealthNumber: '',
    EmergencyContactName: '',
    EmergencyContactNumber: '',
    BloodType: 'O+'
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await clinicalApi.getPatients({
        search,
        barangay: barangayFilter || undefined,
        gender: genderFilter || undefined
      });
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchPatients();
    }, 250);
    return () => clearTimeout(timeout);
  }, [search, barangayFilter, genderFilter]);

  const openAddModal = () => {
    setEditingPatient(null);
    setFormData({
      FirstName: '',
      MiddleName: '',
      Surname: '',
      BirthDate: '',
      Gender: 'Male',
      CivilStatus: 'Single',
      Barangay: 'Poblacion 1',
      DetailedAddress: '',
      ContactNumber: '',
      Email: '',
      PhilHealthNumber: '',
      EmergencyContactName: '',
      EmergencyContactNumber: '',
      BloodType: 'O+'
    });
    setFeedback(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: PatientRecord) => {
    setEditingPatient(p);
    setFormData({
      FirstName: p.FirstName,
      MiddleName: p.MiddleName || '',
      Surname: p.Surname,
      BirthDate: p.BirthDate ? p.BirthDate.slice(0, 10) : '',
      Gender: p.Gender || 'Male',
      CivilStatus: p.CivilStatus || 'Single',
      Barangay: p.Barangay || 'Poblacion 1',
      DetailedAddress: p.DetailedAddress || '',
      ContactNumber: p.ContactNumber || '',
      Email: p.Email || '',
      PhilHealthNumber: p.PhilHealthNumber || '',
      EmergencyContactName: p.EmergencyContactName || '',
      EmergencyContactNumber: p.EmergencyContactNumber || '',
      BloodType: p.BloodType || 'O+'
    });
    setFeedback(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.FirstName?.trim() || !formData.Surname?.trim() || !formData.Barangay?.trim()) {
      setFeedback({ type: 'error', message: 'First Name, Surname, and Barangay are required fields.' });
      return;
    }

    try {
      setSaving(true);
      setFeedback(null);

      const payload = {
        firstName: formData.FirstName,
        middleName: formData.MiddleName,
        surname: formData.Surname,
        birthDate: formData.BirthDate || undefined,
        gender: formData.Gender,
        civilStatus: formData.CivilStatus,
        barangay: formData.Barangay,
        detailedAddress: formData.DetailedAddress,
        contactNumber: formData.ContactNumber,
        email: formData.Email,
        philHealthNumber: formData.PhilHealthNumber,
        emergencyContactName: formData.EmergencyContactName,
        emergencyContactNumber: formData.EmergencyContactNumber,
        bloodType: formData.BloodType
      };

      if (editingPatient) {
        const res = await clinicalApi.updatePatient(editingPatient.PatientID, payload);
        setFeedback({ type: 'success', message: res.message });
      } else {
        const res = await clinicalApi.createPatient(payload);
        setFeedback({ type: 'success', message: res.message });
      }

      setIsModalOpen(false);
      await fetchPatients();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save patient record' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-2xl flex items-center justify-between border shadow-xs ${
          feedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
            : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
        }`}>
          <div className="flex items-center gap-2.5 text-sm font-medium">
            {feedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <AlertCircle className="w-5 h-5 text-rose-600" />}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-xs hover:opacity-75 cursor-pointer font-bold px-2 py-1">?</button>
        </div>
      )}

      {/* Header with Search and Action Button */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient by name, contact, or PhilHealth..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-cyan-500/20 text-slate-900 dark:text-white"
              />
            </div>

            <select
              value={barangayFilter}
              onChange={(e) => setBarangayFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="">All Barangays</option>
              {CATBALOGAN_BARANGAYS.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            <select
              value={genderFilter}
              onChange={(e) => setGenderFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="">All Genders</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          </div>

          <button
            onClick={openAddModal}
            className="px-4 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs whitespace-nowrap self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Register Patient</span>
          </button>
        </div>
      </div>

      {/* Patient List Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Patient ID</th>
                <th className="py-3 px-3">Patient Full Name</th>
                <th className="py-3 px-3">Demographics</th>
                <th className="py-3 px-3">Barangay & Address</th>
                <th className="py-3 px-3">Contact Details</th>
                <th className="py-3 px-3 text-center">Encounters</th>
                <th className="py-3 px-3 text-center">Rx Dispensed</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-5 h-5 text-cyan-600 animate-spin" />
                      <span>Loading registered patients...</span>
                    </div>
                  </td>
                </tr>
              ) : patients.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    No patient records found matching your search.
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p.PatientID} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-slate-500">
                      #{p.PatientID}
                    </td>

                    <td className="py-3 px-3">
                      <div 
                        onClick={() => onSelectPatient(p.PatientID)}
                        className="font-bold text-slate-900 dark:text-white hover:text-cyan-700 dark:hover:text-cyan-400 cursor-pointer text-sm"
                      >
                        {p.FullName}
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>Reg: {new Date(p.DateRegistered).toLocaleDateString()}</span>
                        {p.BloodType && <span className="font-semibold text-rose-600">? Type {p.BloodType}</span>}
                      </div>
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="text-slate-800 dark:text-slate-200 font-medium">
                        {p.Gender || '?'} {p.Age !== null && p.Age !== undefined ? `? ${p.Age} yrs` : ''}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {p.BirthDate ? new Date(p.BirthDate).toLocaleDateString() : 'No DOB'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{p.Barangay}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 max-w-xs truncate">
                        {p.DetailedAddress || 'No detailed address'}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {p.ContactNumber || '?'}
                      </div>
                      {p.PhilHealthNumber && (
                        <div className="text-[10px] text-cyan-700 dark:text-cyan-400 font-mono">
                          PH: {p.PhilHealthNumber}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {p.TotalEncounters || 0}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="font-bold text-teal-700 dark:text-teal-400 font-mono">
                        {p.TotalPrescriptionsDispensed || 0}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        onClick={() => onStartConsultation(p.PatientID)}
                        title="Start Clinical Consultation"
                        className="px-2.5 py-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:hover:bg-cyan-900/60 dark:text-cyan-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Stethoscope className="w-3.5 h-3.5" />
                        <span>Consult</span>
                      </button>

                      <button
                        onClick={() => onSelectPatient(p.PatientID)}
                        title="View Medical History & Profile"
                        className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Profile</span>
                      </button>

                      <button
                        onClick={() => openEditModal(p)}
                        title="Edit Demographics"
                        className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 rounded-lg cursor-pointer"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Patient Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl max-w-2xl w-full p-6 animate-in fade-in zoom-in-95 duration-150 space-y-4 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-cyan-600" />
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {editingPatient ? 'Edit Patient Information' : 'Register New Patient'}
                </h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maria"
                    value={formData.FirstName}
                    onChange={(e) => setFormData({ ...formData, FirstName: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Middle Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Clara"
                    value={formData.MiddleName}
                    onChange={(e) => setFormData({ ...formData, MiddleName: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Surname *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Santos"
                    value={formData.Surname}
                    onChange={(e) => setFormData({ ...formData, Surname: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Date of Birth</label>
                  <input
                    type="date"
                    value={formData.BirthDate}
                    onChange={(e) => setFormData({ ...formData, BirthDate: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Gender</label>
                  <select
                    value={formData.Gender}
                    onChange={(e) => setFormData({ ...formData, Gender: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Civil Status</label>
                  <select
                    value={formData.CivilStatus}
                    onChange={(e) => setFormData({ ...formData, CivilStatus: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="Single">Single</option>
                    <option value="Married">Married</option>
                    <option value="Widowed">Widowed</option>
                    <option value="Separated">Separated</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Blood Type</label>
                  <select
                    value={formData.BloodType}
                    onChange={(e) => setFormData({ ...formData, BloodType: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Barangay *</label>
                  <select
                    required
                    value={formData.Barangay}
                    onChange={(e) => setFormData({ ...formData, Barangay: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  >
                    {CATBALOGAN_BARANGAYS.map(b => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Detailed Address</label>
                  <input
                    type="text"
                    placeholder="House / Street / Zone"
                    value={formData.DetailedAddress}
                    onChange={(e) => setFormData({ ...formData, DetailedAddress: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Contact #</label>
                  <input
                    type="text"
                    placeholder="e.g. 09171234567"
                    value={formData.ContactNumber}
                    onChange={(e) => setFormData({ ...formData, ContactNumber: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Email</label>
                  <input
                    type="email"
                    placeholder="patient@example.com"
                    value={formData.Email}
                    onChange={(e) => setFormData({ ...formData, Email: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">PhilHealth #</label>
                  <input
                    type="text"
                    placeholder="e.g. 12-345678901-2"
                    value={formData.PhilHealthNumber}
                    onChange={(e) => setFormData({ ...formData, PhilHealthNumber: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Emergency Contact Person</label>
                  <input
                    type="text"
                    placeholder="Guardian or spouse name"
                    value={formData.EmergencyContactName}
                    onChange={(e) => setFormData({ ...formData, EmergencyContactName: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-600 dark:text-slate-400 uppercase text-[10px]">Emergency Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. 09189876543"
                    value={formData.EmergencyContactNumber}
                    onChange={(e) => setFormData({ ...formData, EmergencyContactNumber: e.target.value })}
                    className="w-full mt-1 p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-cyan-700 hover:bg-cyan-800 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{saving ? 'Saving...' : editingPatient ? 'Update Patient' : 'Register Patient'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
