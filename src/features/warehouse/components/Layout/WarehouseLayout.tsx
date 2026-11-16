import React, { useState, useEffect } from 'react';
import { 
  Menu, X, Package, LayoutDashboard, Truck, LogOut, ArrowUpRight, 
  FileText, Search, Bell, Sun, Moon, Monitor, Settings, Database, 
  MapPin, Archive, Activity, ShieldCheck, ClipboardCheck, MoreHorizontal,
  ChevronRight, Layers, Tag, Building2, BarChart3
} from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { motion, AnimatePresence } from 'motion/react';
import { WarehouseNotificationBell } from './WarehouseNotificationBell';

interface WarehouseLayoutProps {
  children: React.ReactNode;
  onLogout: () => void;
  activeView: string;
  onNavigate: (view: string) => void;
}

export function WarehouseLayout({ children, onLogout, activeView, onNavigate }: WarehouseLayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Apply theme class
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  const navGroups = [
    {
      label: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      ]
    },
    {
      label: 'Inventory Management',
      items: [
        { id: 'inventory', label: 'Batch Inventory', icon: Archive },
        { id: 'medicines', label: 'Medicines', icon: Database },
        { id: 'categories', label: 'Medicine Categories', icon: Layers },
        { id: 'units', label: 'Medicine Units', icon: Tag },
        { id: 'suppliers', label: 'Suppliers', icon: Building2 },
      ]
    },
    {
      label: 'Operations',
      items: [
        { id: 'receiving', label: 'Inventory Receipt (Receiving)', icon: Truck },
        { id: 'stock-requests', label: 'Stock Requests', icon: FileText },
        { id: 'distribution', label: 'Stock Distribution', icon: ArrowUpRight },
        { id: 'physical-count', label: 'Physical Inventory Count', icon: ClipboardCheck },
        { id: 'reconciliation', label: 'Inventory Reconciliation', icon: ShieldCheck },
        { id: 'traceability', label: 'Inventory Movements', icon: Activity },
      ]
    },
    {
      label: 'Insights & Settings',
      items: [
        { id: 'reports', label: 'Warehouse Reports', icon: BarChart3 },
        { id: 'administration', label: 'Settings & Administration', icon: Settings },
      ]
    }
  ];

  // Primary Mobile Bottom Navigation (5 items: Home, Inventory, Requests, Distribution, More)
  const mobileBottomNav = [
    { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventory', icon: Archive },
    { id: 'stock-requests', label: 'Requests', icon: FileText },
    { id: 'distribution', label: 'Distribution', icon: ArrowUpRight },
  ];

  // Secondary items inside the "More" bottom sheet
  const moreOperationsItems = [
    { id: 'receiving', label: 'Receiving (Inventory Receipt)', desc: 'Record supplier deliveries & batch intake', icon: Truck },
    { id: 'physical-count', label: 'Physical Inventory & Stock Adjustments', desc: 'Physical Inventory Count sheets & verified Stock Adjustments', icon: ClipboardCheck },
    { id: 'traceability', label: 'Inventory Movements', desc: 'Immutable batch ledger & chain-of-custody audit', icon: Activity },
    { id: 'reconciliation', label: 'Inventory Reconciliation', desc: 'Investigate Receiving Discrepancies & balance variances', icon: ShieldCheck },
    { id: 'reports', label: 'Reports', desc: 'Stock, expiry, movement & distribution reports', icon: BarChart3 },
    { id: 'administration', label: 'Settings', desc: 'Warehouse configuration & administration', icon: Settings },
  ];

  const moreMasterDataItems = [
    { id: 'medicines', label: 'Medicines Catalog', icon: Database },
    { id: 'categories', label: 'Medicine Categories', icon: Layers },
    { id: 'units', label: 'Medicine Units', icon: Tag },
    { id: 'suppliers', label: 'Suppliers Directory', icon: Building2 },
  ];

  const isMoreViewActive = ![
    'dashboard',
    'inventory',
    'stock-requests',
    'distribution',
  ].includes(activeView);

  const viewTitles: Record<string, string> = {
    dashboard: 'Warehouse Dashboard',
    inventory: 'Batch Inventory',
    receiving: 'Inventory Receipt (Receiving)',
    'stock-requests': 'Stock Requests',
    distribution: 'Stock Distribution',
    'physical-count': 'Physical Inventory Count',
    reconciliation: 'Inventory Reconciliation',
    traceability: 'Inventory Movements',
    reports: 'Warehouse Reports',
    medicines: 'Medicines Catalog',
    categories: 'Medicine Categories',
    units: 'Medicine Units',
    suppliers: 'Suppliers',
    administration: 'Administration',
  };

  const handleNav = (id: string) => {
    onNavigate(id);
    setIsSidebarOpen(false);
    setIsMoreOpen(false);
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans text-foreground">
      {/* Mobile / Tablet Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Collapsible Drawer on Mobile/Tablet, Fixed on Desktop) */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border transform transition-transform duration-300 lg:relative lg:translate-x-0 flex flex-col shadow-sm",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-5 lg:p-6 h-16 lg:h-20 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-md shadow-primary/20 shrink-0">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-black text-base tracking-tight text-foreground leading-none">eMEDICS</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">Central Warehouse</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden h-10 w-10" onClick={() => setIsSidebarOpen(false)}>
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-5 px-4 space-y-6 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.25)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-700/60 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-primary/70">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              <h3 className="px-3.5 text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeView === item.id;
                  return (
                    <motion.button
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.98 }}
                      key={item.id}
                      onClick={() => handleNav(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all group relative overflow-hidden text-left",
                        isActive 
                          ? "text-primary-foreground shadow-md shadow-primary/20" 
                          : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      )}
                    >
                      {isActive && (
                        <motion.div 
                          layoutId="active-nav-bg"
                          className="absolute inset-0 bg-primary z-0"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.2 }}
                        />
                      )}
                      <item.icon className={cn("w-4 h-4 transition-colors relative z-10 shrink-0", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                      <span className="relative z-10 truncate">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50 shrink-0 bg-card/50 backdrop-blur-md">
          <div className="flex items-center gap-3 p-3 mb-2 rounded-xl border border-border/50 bg-background/50">
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center text-primary font-bold text-xs shrink-0">
              WA
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-foreground truncate">Warehouse Admin</p>
              <p className="text-[10px] text-muted-foreground truncate">admin@emedics.local</p>
            </div>
          </div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl h-9 text-xs font-bold px-3" onClick={onLogout}>
            <LogOut className="w-3.5 h-3.5 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-muted/10">
        {/* Compact Top Header */}
        <header className="h-14 sm:h-16 lg:h-18 bg-card/90 backdrop-blur-xl border-b border-border flex items-center justify-between px-3 sm:px-4 lg:px-8 shrink-0 z-30 sticky top-0 shadow-xs">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden shrink-0 h-10 w-10 rounded-xl" 
              onClick={() => setIsSidebarOpen(true)}
              aria-label="Open Navigation Drawer"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </Button>

            {/* Mobile & Tablet Active Title */}
            <div className="lg:hidden min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                  CHO Warehouse
                </span>
              </div>
              <h1 className="text-sm sm:text-base font-bold text-foreground truncate leading-tight">
                {viewTitles[activeView] || 'Central Warehouse'}
              </h1>
            </div>
            
            {/* Desktop Search Bar */}
            <div className="hidden lg:flex relative max-w-md w-full group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="Search inventory, receipts, or batches..." 
                className="pl-9 h-9 text-xs sm:text-sm bg-muted/50 border-transparent focus:border-primary/50 focus:bg-background rounded-full w-full transition-all duration-300 focus:shadow-md focus:shadow-primary/5"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Desktop Facility & FY Selectors */}
            <div className="hidden xl:flex items-center gap-2">
              <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-full px-3 py-1 text-xs hover:bg-muted transition-colors">
                <MapPin className="w-4 h-4 text-muted-foreground" />
                <select className="bg-transparent border-none outline-none text-foreground text-xs font-medium focus:ring-0 cursor-pointer appearance-none pr-4">
                  <option>Main Warehouse</option>
                  <option>Annex Storage</option>
                  <option>Cold Storage</option>
                </select>
              </div>
              <div className="flex items-center gap-2 bg-muted/50 border border-border/50 rounded-full px-3 py-1 text-xs hover:bg-muted transition-colors">
                <select className="bg-transparent border-none outline-none text-foreground text-xs font-medium focus:ring-0 cursor-pointer appearance-none pr-4">
                  <option>FY 2026</option>
                  <option>FY 2025</option>
                </select>
              </div>
            </div>

            <div className="w-px h-6 bg-border mx-1 hidden sm:block"></div>

            {/* Theme Toggle */}
            <div className="hidden sm:flex items-center bg-muted/50 rounded-full p-1 border border-border/50">
              <button onClick={() => setTheme('light')} className={cn("p-1.5 rounded-full transition-colors", theme === 'light' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')} title="Light Theme">
                <Sun className="w-4 h-4" />
              </button>
              <button onClick={() => setTheme('system')} className={cn("p-1.5 rounded-full transition-colors", theme === 'system' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')} title="System Theme">
                <Monitor className="w-4 h-4" />
              </button>
              <button onClick={() => setTheme('dark')} className={cn("p-1.5 rounded-full transition-colors", theme === 'dark' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground')} title="Dark Theme">
                <Moon className="w-4 h-4" />
              </button>
            </div>

            {/* Notifications */}
            <WarehouseNotificationBell onNavigate={handleNav} />

            {/* Profile Dropdown Trigger */}
            <div className="relative">
              <button 
                className="flex items-center justify-center h-10 w-10 rounded-full focus:outline-none" 
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                aria-label="User Profile Menu"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white font-bold text-xs sm:text-sm shadow-md hover:shadow-lg transition-all border-2 border-card">
                  WA
                </div>
              </button>
              <AnimatePresence>
                {isProfileOpen && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-60 bg-popover rounded-xl shadow-xl border border-border py-1.5 z-50 text-left"
                  >
                    <div className="px-4 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground">Warehouse Admin</p>
                      <p className="text-xs text-muted-foreground">Catbalogan CHO Central Warehouse</p>
                    </div>
                    <div className="p-1.5 space-y-0.5">
                      <button 
                        onClick={() => { setIsProfileOpen(false); handleNav('reports'); }} 
                        className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-muted text-foreground flex items-center gap-2.5 min-h-[40px]"
                      >
                        <BarChart3 className="w-4 h-4 text-muted-foreground" /> Warehouse Reports
                      </button>
                      <button 
                        onClick={() => { setIsProfileOpen(false); onLogout(); }} 
                        className="w-full text-left px-3 py-2.5 text-sm rounded-lg hover:bg-destructive/10 text-destructive flex items-center gap-2.5 min-h-[40px]"
                      >
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar">
          <div className="max-w-7xl mx-auto p-3 sm:p-5 lg:p-8 pb-24 lg:pb-8">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              {children}
            </motion.div>
          </div>
        </div>

        {/* Mobile Bottom Navigation Bar (< lg) */}
        <nav 
          aria-label="Mobile Bottom Navigation"
          className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-xl border-t border-border shadow-[0_-4px_20px_rgba(0,0,0,0.06)] pb-[env(safe-area-inset-bottom)]"
        >
          <div className="grid grid-cols-5 h-16 max-w-lg mx-auto px-1">
            {mobileBottomNav.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id && !isMoreOpen;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 min-h-[48px] rounded-xl transition-colors relative",
                    isActive
                      ? "text-primary font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {isActive && (
                    <span className="absolute top-1 w-6 h-1 rounded-full bg-primary" />
                  )}
                  <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-[10px] leading-none tracking-tight truncate max-w-[64px]">
                    {item.label}
                  </span>
                </button>
              );
            })}

            {/* More Tab */}
            <button
              type="button"
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 min-h-[48px] rounded-xl transition-colors relative",
                isMoreOpen || isMoreViewActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {(isMoreOpen || isMoreViewActive) && (
                <span className="absolute top-1 w-6 h-1 rounded-full bg-primary" />
              )}
              <MoreHorizontal className={cn("w-5 h-5", isMoreOpen || isMoreViewActive ? "text-primary" : "text-muted-foreground")} />
              <span className="text-[10px] leading-none tracking-tight">More</span>
            </button>
          </div>
        </nav>

        {/* Mobile "More" Bottom Sheet Drawer */}
        <AnimatePresence>
          {isMoreOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-xs"
                onClick={() => setIsMoreOpen(false)}
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                className="relative z-50 bg-card border-t border-border rounded-t-3xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom)]"
              >
                {/* Sheet Grab Handle & Header */}
                <div className="pt-3 pb-3 px-5 border-b border-border flex items-center justify-between shrink-0">
                  <div>
                    <div className="w-10 h-1.5 bg-muted-foreground/30 rounded-full mx-auto mb-2" />
                    <h3 className="text-base font-bold text-foreground">Warehouse Operations & Tools</h3>
                    <p className="text-xs text-muted-foreground">Central Warehouse • Catbalogan CHO</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setIsMoreOpen(false)} className="rounded-full h-10 w-10">
                    <X className="w-5 h-5 text-muted-foreground" />
                  </Button>
                </div>

                {/* Sheet Body */}
                <div className="p-4 overflow-y-auto custom-scrollbar space-y-5">
                  {/* Operations Section */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
                      Operations & Accountability
                    </h4>
                    <div className="space-y-2">
                      {moreOperationsItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeView === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleNav(item.id)}
                            className={cn(
                              "w-full flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all min-h-[56px]",
                              isActive
                                ? "bg-primary/10 border-primary/30 text-primary"
                                : "bg-background hover:bg-muted/60 border-border/60 text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-3.5 min-w-0 pr-2">
                              <div className={cn(
                                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                                isActive ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                              )}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">{item.label}</p>
                                <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Master Data Grid */}
                  <div>
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1 mb-2">
                      Master Data Registry
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5">
                      {moreMasterDataItems.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeView === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleNav(item.id)}
                            className={cn(
                              "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all min-h-[48px]",
                              isActive
                                ? "bg-primary/10 border-primary/30 text-primary font-semibold"
                                : "bg-background hover:bg-muted/60 border-border/60 text-foreground"
                            )}
                          >
                            <Icon className="w-4 h-4 shrink-0 text-primary" />
                            <span className="text-xs font-medium leading-tight">{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* User Profile & Theme / Sign Out */}
                  <div className="pt-2 border-t border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex items-center justify-between bg-muted/40 p-3 rounded-xl border border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/15 text-primary font-bold text-sm flex items-center justify-center">
                          WA
                        </div>
                        <div>
                          <p className="text-xs font-bold text-foreground">Warehouse Admin</p>
                          <p className="text-[11px] text-muted-foreground">admin@emedics.local</p>
                        </div>
                      </div>
                      <div className="flex items-center bg-background rounded-full p-1 border border-border">
                        <button onClick={() => setTheme('light')} className={cn("p-1.5 rounded-full", theme === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                          <Sun className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setTheme('dark')} className={cn("p-1.5 rounded-full", theme === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
                          <Moon className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <Button 
                      variant="destructive" 
                      onClick={onLogout} 
                      className="w-full sm:w-auto rounded-xl min-h-[48px] font-semibold"
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out of Warehouse Portal
                    </Button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
