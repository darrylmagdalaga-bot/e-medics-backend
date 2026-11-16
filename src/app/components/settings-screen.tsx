import { useState, useEffect } from "react";
import { UserCog, Shield, Users as UsersIcon, Edit2, Check, X, Eye, EyeOff, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface SettingsScreenProps {
  role?: string;
}

interface UserData {
  UserID: number;
  Username: string;
  FullName: string;
  Role: string;
  IsActive: boolean;
}

import { API_URL } from '../api-config';
const ROLES = ["Admin", "Warehouse Staff", "Pharmacy Staff", "Inventory Staff", "Clinical Staff"];

export function SettingsScreen({ role = "pharmacy" }: SettingsScreenProps) {
  const [activeTab, setActiveTab] = useState<"account" | "users" | "add">("account");
  const [usersList, setUsersList] = useState<UserData[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Edit Modal State
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUserForm, setEditUserForm] = useState({ username: "", fullName: "", password: "" });
  const [isSavingUserEdit, setIsSavingUserEdit] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Add User State
  const [newUser, setNewUser] = useState({ username: "", password: "", fullName: "", role: "Pharmacy Staff", isActive: true });
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);

  const headers = { "Content-Type": "application/json", "Bypass-Tunnel-Reminder": "true" };

  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch(`${API_URL}/api/users`, { headers });
      const data = await res.json();
      if (Array.isArray(data)) setUsersList(data);
      else toast.error("Failed to load users.");
    } catch {
      toast.error("Connection error. Backend may be offline.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (activeTab === "users" && role === "admin") fetchUsers();
  }, [activeTab]);

  const handleUpdateUser = async (userId: number) => {
    if (!editUserForm.username.trim() || !editUserForm.password.trim()) {
      toast.error("Username and password are required.");
      return;
    }
    setIsSavingUserEdit(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${userId}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          username: editUserForm.username,
          fullName: editUserForm.fullName,
          password: editUserForm.password
        })
      });
      const data = await res.json();
      if (data.success) {
        toast.success("User updated successfully");
        setEditingUserId(null);
        fetchUsers();
      } else {
        toast.error(data.message || "Update failed.");
      }
    } catch {
      toast.error("Connection error.");
    } finally {
      setIsSavingUserEdit(false);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username.trim() || !newUser.password.trim()) {
      toast.error("Username and password are required.");
      return;
    }
    setIsSavingUser(true);
    try {
      const res = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers,
        body: JSON.stringify(newUser)
      });
      const data = await res.json();
      if (data.success) {
        toast.success("User successfully created!");
        setNewUser({ username: "", password: "", fullName: "", role: "Pharmacy Staff", isActive: true });
        if (activeTab === "users") fetchUsers();
      } else {
        toast.error(data.message || "Failed to create user.");
      }
    } catch {
      toast.error("Connection error.");
    } finally {
      setIsSavingUser(false);
    }
  };

  const roleBadge = (r: string) => {
    const colors: Record<string, string> = {
      "Admin": "bg-indigo-50 text-indigo-600",
      "Warehouse Staff": "bg-amber-50 text-amber-600",
      "Pharmacy Staff": "bg-primary/10 text-primary"
    };
    return colors[r] || "bg-gray-100 text-gray-500";
  };

  const tabs = [
    { id: "account" as const, label: "Account", icon: UserCog },
    ...(role === "admin" ? [
      { id: "users" as const, label: "Manage Users", icon: UsersIcon },
      { id: "add" as const, label: "Add User", icon: Plus }
    ] : [])
  ];

  return (
    <div className="p-6 md:p-8 space-y-8 bg-[#fdfdfd] min-h-full relative">
      <div>
        <h1 className="text-3xl font-black text-[#1a1a5e] tracking-tight">Settings</h1>
        <p className="text-sm text-gray-400 font-medium mt-1">
          System configuration · Logged in as{" "}
          <span className="font-bold text-primary">{role === "admin" ? "System Administrator" : role === "pharmacy" ? "Pharmacy Staff" : "Warehouse Staff"}</span>
        </p>
      </div>

      <div className="flex gap-2 bg-gray-50 p-1.5 rounded-2xl w-fit border border-gray-100">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === tab.id ? "bg-white text-primary shadow-sm border border-gray-100" : "text-gray-400 hover:text-gray-600"}`}>
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "account" && (
        <div className="bg-white rounded-[32px] border border-gray-100 p-8 shadow-sm max-w-xl">
          <h2 className="text-xl font-black text-[#1a1a5e] mb-6">Account Information</h2>
          <div className="space-y-4">
            {[{ label: "Full Name", value: "CHD Admin" }, { label: "Username", value: "admin" }, { label: "Role", value: "System Administrator" }].map(f => (
              <div key={f.label} className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{f.label}</label>
                <div className="px-4 py-3.5 bg-gray-50 rounded-2xl text-sm font-bold text-[#1a1a5e]">{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "users" && role === "admin" && (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm overflow-hidden relative">
          <div className="p-6 border-b border-gray-50 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-black text-[#1a1a5e]">All Users</h2>
              <p className="text-xs font-bold text-gray-400 mt-0.5">Click the edit icon to modify user details</p>
            </div>
            <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 hover:bg-primary/5 text-primary font-bold rounded-xl transition-all text-sm">
              <RefreshCw className="w-4 h-4" /> Refresh
            </button>
          </div>

          {isLoadingUsers ? (
            <div className="p-20 text-center flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Loading from Azure SQL...</p>
            </div>
          ) : usersList.length === 0 ? (
            <div className="p-20 text-center text-gray-400 font-bold text-sm">No users found. Click Refresh to try again.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50/80">
                  <tr>
                    {["ID", "Username", "Full Name", "Role", "Status", "Actions"].map(h => (
                      <th key={h} className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {usersList.map(user => (
                    <tr key={user.UserID} className="hover:bg-gray-50/40 transition-colors">
                      <td className="px-6 py-5 text-xs font-black text-gray-400">#{user.UserID}</td>
                      <td className="px-6 py-5 text-sm font-bold text-[#1a1a5e]">{user.Username}</td>
                      <td className="px-6 py-5 text-sm text-gray-500 font-medium">{user.FullName || "—"}</td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${roleBadge(user.Role)}`}>{user.Role}</span>
                      </td>
                      <td className="px-6 py-5">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black ${user.IsActive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
                          {user.IsActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-5">
                        <button onClick={() => { 
                            setEditingUserId(user.UserID); 
                            setEditUserForm({ username: user.Username, fullName: user.FullName || "", password: "" }); 
                            setShowEditPassword(false);
                          }}
                          className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "add" && role === "admin" && (
        <div className="bg-white rounded-[32px] border border-gray-100 shadow-sm p-8 max-w-2xl">
          <div className="mb-8">
            <h2 className="text-xl font-black text-[#1a1a5e]">Add New User</h2>
            <p className="text-xs font-bold text-gray-400 mt-0.5">Fill in the details to register a new system user</p>
          </div>
          <form onSubmit={handleAddUser} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Username *</label>
                <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })}
                  placeholder="e.g. jsmith" required
                  className="w-full px-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-bold text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Name</label>
                <input type="text" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })}
                  placeholder="e.g. John Smith"
                  className="w-full px-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-bold text-sm" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Password *</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })}
                  placeholder="Set a secure password" required
                  className="w-full px-4 pr-12 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-bold text-sm" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Role *</label>
              <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
                className="w-full px-4 py-3.5 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-bold text-sm appearance-none">
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-2xl">
              <input type="checkbox" id="isActive" checked={newUser.isActive} onChange={e => setNewUser({ ...newUser, isActive: e.target.checked })}
                className="w-4 h-4 accent-primary" />
              <label htmlFor="isActive" className="text-sm font-bold text-[#1a1a5e]">Active Account</label>
              <span className="text-xs text-gray-400 font-medium">(User can log in immediately)</span>
            </div>

            <div className="pt-4 flex gap-3">
              <button type="submit" disabled={isSavingUser}
                className="px-8 py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 flex items-center gap-2">
                {isSavingUser ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : <><Plus className="w-4 h-4" /> Save User Account</>}
              </button>
              <button type="button" onClick={() => setNewUser({ username: "", password: "", fullName: "", role: "Pharmacy Staff", isActive: true })}
                className="px-8 py-4 bg-gray-50 text-gray-500 font-black rounded-2xl hover:bg-gray-100 transition-all">
                Clear
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUserId && (
        <div className="fixed inset-0 bg-[#1a1a5e]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[32px] p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-50">
              <div>
                <h3 className="text-xl font-black text-[#1a1a5e]">Edit User Details</h3>
                <p className="text-xs font-bold text-gray-400 mt-1">Modify account access</p>
              </div>
              <button onClick={() => setEditingUserId(null)} className="p-2 bg-gray-50 hover:bg-gray-100 text-gray-400 rounded-xl transition-all"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Username *</label>
                <input type="text" value={editUserForm.username} onChange={e => setEditUserForm({...editUserForm, username: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-bold text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Full Name</label>
                <input type="text" value={editUserForm.fullName} onChange={e => setEditUserForm({...editUserForm, fullName: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-bold text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">New Password *</label>
                <div className="relative">
                  <input type={showEditPassword ? "text" : "password"} value={editUserForm.password} onChange={e => setEditUserForm({...editUserForm, password: e.target.value})} placeholder="Enter secure password" required className="w-full px-4 pr-12 py-3 bg-gray-50 border border-transparent rounded-2xl focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary/20 transition-all font-bold text-sm" />
                  <button type="button" onClick={() => setShowEditPassword(!showEditPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors">
                    {showEditPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="p-4 bg-amber-50 rounded-2xl mt-6 border border-amber-100/50">
                <div className="flex gap-3 items-start">
                  <Shield className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-amber-700">Role modification protected</p>
                    <p className="text-[10px] font-medium text-amber-600/80 mt-1 leading-relaxed">For strict access control and auditing, a user's role cannot be modified. Ensure the new password meets security requirements.</p>
                  </div>
                </div>
              </div>

              <div className="pt-6 flex gap-3">
                <button onClick={() => handleUpdateUser(editingUserId)} disabled={isSavingUserEdit} className="flex-1 py-3.5 bg-primary text-white font-black rounded-xl shadow-lg shadow-primary/20 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {isSavingUserEdit ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving...</> : <><Check className="w-4 h-4" /> Save Update</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

