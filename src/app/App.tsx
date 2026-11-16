import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { LoginScreen } from './components/login-screen';
import { Sidebar } from './components/sidebar';
import { TopBar } from './components/topbar';
import { DashboardScreen } from './components/dashboard-screen';
import { ProductsScreen } from './components/products-screen';
import { InventoryScreen } from './components/inventory-screen';
import { WarehouseScreen } from './components/warehouse-screen';
import { PharmacyScreen } from './components/pharmacy-screen';
import { ClinicalScreen } from './components/clinical-screen';
import { AccountManagement } from '../features/admin/AccountManagement';
import { CentralizedReportsHub } from '../features/reports/CentralizedReportsHub';
import { SettingsScreen } from './components/settings-screen';
import { BarangayScreen } from './components/barangay-screen';
import { AlertCircle } from 'lucide-react';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [currentAction, setCurrentAction] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'inventory' | 'pharmacy' | 'warehouse' | 'barangay'>('admin');
  const [userId, setUserId] = useState<number | null>(null);
  const [accessDeniedMessage, setAccessDeniedMessage] = useState<{title: string, message: string} | null>(null);

  useEffect(() => {
    const savedId = sessionStorage.getItem('pharma_userId') || localStorage.getItem('pharma_userId');
    const savedRole = sessionStorage.getItem('pharma_role') || localStorage.getItem('pharma_role');
    if (savedId && savedRole) {
      sessionStorage.setItem('pharma_userId', savedId);
      sessionStorage.setItem('pharma_role', savedRole);
      setUserId(parseInt(savedId));
      setUserRole(savedRole as any);
      setIsLoggedIn(true);
      if (savedRole === 'pharmacy') setCurrentPage('pharmacy');
      else if (savedRole === 'warehouse') setCurrentPage('warehouse');
      else if (savedRole === 'inventory') setCurrentPage('inventory');
      else if (savedRole === 'barangay') setCurrentPage('barangay');
    }
  }, []);

  const handleLogin = (role: 'admin' | 'inventory' | 'pharmacy' | 'warehouse' | 'barangay', id: number) => {
    setUserRole(role);
    setUserId(id);
    if (id) {
      sessionStorage.setItem('pharma_userId', id.toString());
      localStorage.setItem('pharma_userId', id.toString());
    }
    sessionStorage.setItem('pharma_role', role);
    localStorage.setItem('pharma_role', role);
    setIsLoggedIn(true);
    if (role === 'warehouse') setCurrentPage('warehouse');
    else if (role === 'inventory') setCurrentPage('inventory');
    else if (role === 'pharmacy') setCurrentPage('pharmacy');
    else if (role === 'barangay') setCurrentPage('barangay');
    else setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserId(null);
    sessionStorage.removeItem('pharma_userId');
    sessionStorage.removeItem('pharma_role');
    localStorage.removeItem('pharma_userId');
    localStorage.removeItem('pharma_role');
    localStorage.removeItem('pharma_activePharmacyTab');
  };

  const handleNavigate = (page: string, action?: string) => {
    if (userRole === 'pharmacy' && (page === 'inventory' || page === 'warehouse')) {
      setAccessDeniedMessage({ title: 'Access Denied', message: 'Your account does not have permission to access this module.' });
      return;
    }
    if (userRole === 'warehouse' && (page === 'pos' || page === 'pharmacy')) {
      setAccessDeniedMessage({ title: 'Access Denied', message: 'Your account does not have permission to access the Pharmacy Module.' });
      return;
    }
    setCurrentPage(page);
    setCurrentAction(action || null);
    setIsMobileMenuOpen(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardScreen role={userRole} onNavigate={handleNavigate} />;
      case 'pharmacy':
        return <PharmacyScreen userId={userId} onLogout={handleLogout} />;
      // Legacy Pharmacy routes redirected into the unified Pharmacy Portal shell
      case 'pos':
        return <PharmacyScreen userId={userId} onLogout={handleLogout} initialTab="dispense" />;
      case 'orders':
        return <PharmacyScreen userId={userId} onLogout={handleLogout} initialTab="history" />;
      case 'inventory':
        return <InventoryScreen action={currentAction} clearAction={() => setCurrentAction(null)} role={userRole} />;
      case 'warehouse':
        return <WarehouseScreen onLogout={handleLogout} />;
      case 'products':
        return <ProductsScreen role={userRole} userId={userId} />;
      case 'customers':
        return <ClinicalScreen role={userRole} initialTab="registry" />;
      case 'clinical':
        return <ClinicalScreen role={userRole} initialTab="dashboard" />;
      case 'accounts':
        return <AccountManagement role={userRole} userId={userId} />;
      case 'reports':
        return <CentralizedReportsHub role={userRole} userId={userId} />;
      case 'settings':
        return <SettingsScreen role={userRole} />;
      case 'barangay':
        return <BarangayScreen role={userRole} userId={userId} onLogout={handleLogout} />;
      default:
        return <DashboardScreen role={userRole} onNavigate={handleNavigate} />;
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <LoginScreen onLogin={handleLogin} />
        <Toaster position="top-right" />
      </div>
    );
  }

  if (userRole === 'barangay') {
    return (
      <div className="h-[100dvh] overflow-hidden bg-background flex flex-col">
        <BarangayScreen role={userRole} userId={userId} onLogout={handleLogout} />
        <Toaster position="top-right" />
      </div>
    );
  }

  if (userRole === 'warehouse') {
    return (
      <div className="h-[100dvh] overflow-hidden bg-background flex flex-col">
        <WarehouseScreen onLogout={handleLogout} />
        <Toaster position="top-right" />
      </div>
    );
  }

  // Unified Pharmacy Portal Shell for Pharmacy Users (eliminates duplicate outer Sidebar/TopBar)
  if (userRole === 'pharmacy') {
    return (
      <div className="h-[100dvh] overflow-hidden bg-background flex flex-col">
        <PharmacyScreen userId={userId} onLogout={handleLogout} />
        <Toaster position="top-right" />
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden relative font-sans">
      <Sidebar 
        userRole={userRole} 
        currentPage={currentPage} 
        onNavigate={(page) => handleNavigate(page)} 
        onLogout={handleLogout} 
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 h-[100dvh] overflow-hidden relative">
        <TopBar onMenuClick={() => setIsMobileMenuOpen(true)} />
        <div className="flex-1 overflow-x-hidden overflow-y-auto bg-background">
          {renderPage()}
        </div>
      </div>
      
      <Toaster position="top-right" />
      
      {accessDeniedMessage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border flex flex-col text-center p-8">
            <div className="w-14 h-14 bg-destructive/10 text-destructive rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-sm border border-destructive/20">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{accessDeniedMessage.title}</h2>
            <p className="text-sm font-medium text-muted-foreground mb-6 max-w-[280px] mx-auto">{accessDeniedMessage.message}</p>
            <button 
              onClick={() => setAccessDeniedMessage(null)} 
              className="w-full py-3 bg-muted text-foreground font-bold rounded-xl hover:bg-muted/80 transition-colors"
            >
              Acknowledge
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
