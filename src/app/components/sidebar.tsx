import { 
  LayoutDashboard, 
  Package, 
  FileText, 
  Settings, 
  LogOut,
  Activity,
  X,
  Stethoscope,
  Warehouse,
  ShieldAlert,
  Building2,
  Pill
} from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  userRole?: 'admin' | 'inventory' | 'pharmacy' | 'warehouse' | 'barangay';
}

const allMenuItems = [
  { id: 'dashboard', label: 'Executive Overview', icon: LayoutDashboard, roles: ['admin', 'inventory', 'warehouse'] },
  { id: 'warehouse', label: 'Central Warehouse', icon: Warehouse, roles: ['admin', 'inventory', 'warehouse'] },
  { id: 'pharmacy', label: 'City Pharmacy Portal', icon: Pill, roles: ['admin', 'pharmacy'] },
  { id: 'barangay', label: 'Barangay Health Portal', icon: Building2, roles: ['admin', 'barangay'] },
  { id: 'products', label: 'Medicines', icon: Package, roles: ['admin', 'inventory', 'warehouse'] },
  { id: 'clinical', label: 'Clinical & Patients', icon: Stethoscope, roles: ['admin'] },
  { id: 'reports', label: 'Reports & Analytics', icon: FileText, roles: ['admin', 'inventory', 'warehouse'] },
  { id: 'accounts', label: 'Account Management', icon: ShieldAlert, roles: ['admin'] },
  { id: 'settings', label: 'Settings', icon: Settings, roles: ['admin', 'inventory', 'warehouse'] },
];

export function Sidebar({ currentPage, onNavigate, onLogout, isOpen = false, onClose, userRole = 'admin' }: SidebarProps) {
  const menuItems = allMenuItems.filter(item => item.roles.includes(userRole));
  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden transition-opacity"
          onClick={onClose}
        />
      )}
      
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col h-screen transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6 border-b border-sidebar-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
              <Activity className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-sidebar-foreground tracking-tight">eMEDICS</h2>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Inventory & Supply</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="lg:hidden p-2 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto sidebar-nav-scroll">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/15'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sidebar-foreground/70 hover:bg-destructive/10 hover:text-destructive transition-all duration-200 font-medium text-sm"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="truncate">Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
