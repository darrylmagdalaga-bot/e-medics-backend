import React, { useState } from 'react';
import {
  LayoutDashboard,
  Boxes,
  ClipboardList,
  Truck,
  HeartHandshake,
  BarChart3,
  User,
  Settings,
  MapPin,
  MoreHorizontal,
  Bell,
  Sun,
  Moon,
  Monitor,
  Calendar,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  PackageCheck,
  Clock,
  AlertTriangle,
  Cross,
  SlidersHorizontal,
} from 'lucide-react';
import { BhwThemePreference } from './BarangayProfileSettings';

export type BarangayNavTab =
  | 'overview'
  | 'inventory'
  | 'requests'
  | 'receive'
  | 'disburse'
  | 'reports'
  | 'profile'
  | 'settings';

interface BarangayLayoutProps {
  activeTab: BarangayNavTab;
  onTabChange: (tab: BarangayNavTab) => void;
  barangayName: string;
  stationLabel: string;
  userName: string;
  userRole?: string;
  pendingReceiptsCount: number;
  pendingRequestsCount: number;
  lowStockCount?: number;
  expiryWatchCount?: number;
  theme: BhwThemePreference;
  onThemeChange: (theme: BhwThemePreference) => void;
  onRefreshStats?: () => void;
  onLogout?: () => void;
  children: React.ReactNode;
}

interface NavItemConfig {
  id: BarangayNavTab;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: number;
  badgeTone?: 'purple' | 'amber';
  group: 'primary' | 'account';
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning, BHW!';
  if (hour < 18) return 'Good afternoon, BHW!';
  return 'Good evening, BHW!';
}

export const BarangayLayout: React.FC<BarangayLayoutProps> = ({
  activeTab,
  onTabChange,
  barangayName,
  stationLabel,
  userName,
  userRole = 'Barangay Health Worker',
  pendingReceiptsCount,
  pendingRequestsCount,
  lowStockCount = 0,
  expiryWatchCount = 0,
  theme,
  onThemeChange,
  onRefreshStats,
  onLogout,
  children,
}) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const currentDateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const navItems: NavItemConfig[] = [
    {
      id: 'overview',
      label: 'Home Overview',
      shortLabel: 'Home',
      description: 'Station overview, pending requests & recent activity',
      icon: LayoutDashboard,
      group: 'primary',
    },
    {
      id: 'inventory',
      label: 'Inventory',
      shortLabel: 'Inventory',
      description: 'Batch-level stock lots, FEFO sequence & expiry monitoring',
      icon: Boxes,
      group: 'primary',
    },
    {
      id: 'requests',
      label: 'Stock Requests',
      shortLabel: 'Requests',
      description: 'Requisition replenishment stock from CHO Warehouse',
      icon: ClipboardList,
      badge: pendingRequestsCount,
      badgeTone: 'purple',
      group: 'primary',
    },
    {
      id: 'receive',
      label: 'Receipts',
      shortLabel: 'Receipts',
      description: 'Verify physical deliveries & confirm warehouse receipts',
      icon: Truck,
      badge: pendingReceiptsCount,
      badgeTone: 'amber',
      group: 'primary',
    },
    {
      id: 'disburse',
      label: 'Release Medicine',
      shortLabel: 'Release',
      description: 'FEFO patient medicine release & electronic vouchers',
      icon: HeartHandshake,
      group: 'primary',
    },
    {
      id: 'reports',
      label: 'Reports',
      shortLabel: 'Reports',
      description: 'Inventory movement ledger, discrepancy audit & exports',
      icon: BarChart3,
      group: 'primary',
    },
    {
      id: 'profile',
      label: 'Profile',
      shortLabel: 'Profile',
      description: 'Authenticated worker identity & station scope',
      icon: User,
      group: 'account',
    },
    {
      id: 'settings',
      label: 'Settings',
      shortLabel: 'Settings',
      description: 'Appearance theme (Light / Dark / System) & session controls',
      icon: Settings,
      group: 'account',
    },
  ];

  const primaryItems = navItems.filter((item) => item.group === 'primary');
  const accountItems = navItems.filter((item) => item.group === 'account');
  const mobileBottomItems = [
    navItems[0], // overview
    navItems[1], // inventory
    navItems[2], // requests
    navItems[4], // disburse
  ];
  const mobileMoreItems = [
    navItems[3], // receive
    navItems[5], // reports
    navItems[6], // profile
    navItems[7], // settings
  ];

  const activeItem = navItems.find((n) => n.id === activeTab) || navItems[0];
  const totalAlertsCount = pendingReceiptsCount + lowStockCount + expiryWatchCount;
  const isMoreTabActive = mobileMoreItems.some((m) => m.id === activeTab);

  const initials =
    (userName || 'BH')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'BH';

  const handleSelectTab = (tab: BarangayNavTab) => {
    onTabChange(tab);
    setDrawerOpen(false);
    setMobileMoreOpen(false);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
  };

  const renderDesktopSidebarButton = (item: NavItemConfig) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleSelectTab(item.id)}
        title={sidebarCollapsed ? item.label : undefined}
        className={`w-full flex items-center ${
          sidebarCollapsed ? 'justify-center px-2' : 'justify-between px-3.5'
        } py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 ${
          isActive
            ? 'bg-white/20 text-white shadow-sm backdrop-blur-xs dark:bg-[#34204F] dark:text-[#F5F3FF] dark:border dark:border-[#A78BFA]/30'
            : 'text-purple-100/80 hover:text-white hover:bg-white/10 dark:text-[#B6ADC9] dark:hover:text-[#F5F3FF] dark:hover:bg-[#2A2040]'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon className="w-4.5 h-4.5 shrink-0" />
          {!sidebarCollapsed && <span className="truncate">{item.shortLabel === 'Home' ? 'Home' : item.label}</span>}
        </div>
        {!sidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
          <span
            className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
              isActive
                ? 'bg-white text-[#4C1D95] dark:bg-[#A78BFA] dark:text-[#1E1145]'
                : item.badgeTone === 'amber'
                ? 'bg-amber-400 text-slate-950'
                : 'bg-white/20 text-white dark:bg-[#34204F] dark:text-[#C4B5FD]'
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const renderDrawerNavButton = (item: NavItemConfig) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleSelectTab(item.id)}
        className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          isActive
            ? 'bg-accent text-accent-foreground border border-primary/25'
            : 'text-muted-foreground hover:text-foreground hover:bg-secondary/70'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-primary' : ''}`} />
          <span className="truncate">{item.label}</span>
        </div>
        {item.badge !== undefined && item.badge > 0 && (
          <span
            className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
              item.badgeTone === 'amber'
                ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                : 'bg-primary text-primary-foreground'
            }`}
          >
            {item.badge}
          </span>
        )}
      </button>
    );
  };

  const notificationsPopover = notificationsOpen && (
    <>
      <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
      <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-popover border border-border shadow-2xl z-50 overflow-hidden text-popover-foreground">
        <div className="p-3.5 border-b border-border flex items-center justify-between bg-secondary/50">
          <div>
            <h3 className="text-xs font-black text-foreground uppercase tracking-wider">
              Station Alerts
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {stationLabel} • Live inventory &amp; deliveries
            </p>
          </div>
          {onRefreshStats && (
            <button
              type="button"
              onClick={onRefreshStats}
              className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Refresh Alerts"
              aria-label="Refresh Alerts"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="p-2.5 space-y-2 max-h-80 overflow-y-auto">
          {pendingReceiptsCount > 0 && (
            <button
              type="button"
              onClick={() => handleSelectTab('receive')}
              className="w-full p-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 flex items-start gap-2.5 text-left transition-colors"
            >
              <Truck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">
                  {pendingReceiptsCount} Incoming Shipment(s)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Verify and accept Warehouse deliveries into station stock
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            </button>
          )}

          {lowStockCount > 0 && (
            <button
              type="button"
              onClick={() => handleSelectTab('inventory')}
              className="w-full p-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 flex items-start gap-2.5 text-left transition-colors"
            >
              <AlertTriangle className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">
                  {lowStockCount} Low Stock Medicine(s)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Review inventory and submit stock replenishment requests
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            </button>
          )}

          {expiryWatchCount > 0 && (
            <button
              type="button"
              onClick={() => handleSelectTab('inventory')}
              className="w-full p-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 flex items-start gap-2.5 text-left transition-colors"
            >
              <Clock className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-foreground">
                  {expiryWatchCount} Near-Expiry / Expired Lot(s)
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Review FEFO batches requiring priority release or quarantine
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            </button>
          )}

          {totalAlertsCount === 0 && (
            <div className="py-8 text-center">
              <PackageCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-bold text-foreground">All Station Operations Normal</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                No pending receipts or stock alerts for Barangay {barangayName}.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="portal-bhw flex h-full w-full bg-background text-foreground overflow-hidden">
      {/* ========================================================= */}
      {/* DESKTOP PERSISTENT COLLAPSIBLE LEFT SIDEBAR (lg+)         */}
      {/* ========================================================= */}
      <aside
        className={`hidden lg:flex flex-col justify-between shrink-0 h-full z-20 transition-all duration-200 bg-gradient-to-b from-[#4C1D95] via-[#5B21B6] to-[#3B0764] dark:from-[#171225] dark:via-[#171225] dark:to-[#171225] dark:border-r dark:border-[#382C50] ${
          sidebarCollapsed ? 'w-[78px]' : 'w-64 xl:w-72'
        }`}
      >
        <div className="p-3.5 xl:p-4 overflow-y-auto flex-1 sidebar-nav-scroll space-y-5">
          {/* Brand Header + Collapse Toggle */}
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} gap-2 pt-1 px-1`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/15 dark:bg-[#34204F] border border-white/20 dark:border-[#A78BFA]/25 flex items-center justify-center shrink-0">
                <Cross className="w-4.5 h-4.5 text-white dark:text-[#C4B5FD]" />
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <h1 className="font-black text-base tracking-tight text-white dark:text-[#F5F3FF] leading-none">
                    eMEDICS
                  </h1>
                  <span className="text-[10px] font-bold text-purple-200/90 dark:text-[#B6ADC9] uppercase tracking-widest block mt-1 truncate">
                    BHW Portal
                  </span>
                </div>
              )}
            </div>

            {!sidebarCollapsed && (
              <button
                type="button"
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 dark:text-[#B6ADC9] dark:hover:bg-[#2A2040] transition-colors shrink-0"
                title="Collapse sidebar"
                aria-label="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
          </div>

          {sidebarCollapsed && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setSidebarCollapsed(false)}
                className="p-1.5 rounded-lg text-purple-200 hover:text-white hover:bg-white/10 dark:text-[#B6ADC9] dark:hover:bg-[#2A2040] transition-colors"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Primary Nav */}
          <nav className="space-y-1" aria-label="Primary BHW Navigation">
            {primaryItems.map(renderDesktopSidebarButton)}
          </nav>

          {/* Account Group */}
          <div className="pt-2 border-t border-white/15 dark:border-[#382C50]">
            {!sidebarCollapsed && (
              <div className="text-[10px] font-bold text-purple-200/75 dark:text-[#B6ADC9] uppercase tracking-widest px-3.5 mb-2">
                Account
              </div>
            )}
            <nav className="space-y-1" aria-label="Account BHW Navigation">
              {accountItems.map(renderDesktopSidebarButton)}
            </nav>
          </div>
        </div>

        {/* Sidebar Station Identity Footer */}
        <div className="p-3.5 border-t border-white/15 dark:border-[#382C50] space-y-2">
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => handleSelectTab('profile')}
              className="w-full p-2.5 rounded-xl bg-white/10 hover:bg-white/15 dark:bg-[#211A32] dark:hover:bg-[#2A2040] border border-white/15 dark:border-[#382C50] flex items-center gap-2.5 text-left transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-white/20 dark:bg-[#34204F] text-white dark:text-[#C4B5FD] font-black text-xs flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-white dark:text-[#F5F3FF] truncate">{stationLabel}</p>
                <p className="text-[10px] text-purple-200/80 dark:text-[#B6ADC9] truncate">
                  Brgy. {barangayName}
                </p>
              </div>
            </button>
          )}

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title={sidebarCollapsed ? 'Sign Out' : undefined}
              className={`w-full flex items-center ${
                sidebarCollapsed ? 'justify-center' : 'justify-center gap-2'
              } px-3 py-2 rounded-xl text-xs font-bold text-purple-100/85 hover:text-white hover:bg-rose-500/25 dark:text-[#B6ADC9] dark:hover:text-rose-300 dark:hover:bg-rose-500/15 transition-colors`}
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              {!sidebarCollapsed && <span>Sign Out</span>}
            </button>
          )}
        </div>
      </aside>

      {/* ========================================================= */}
      {/* TABLET & MOBILE SLIDE-OVER DRAWER (< lg)                  */}
      {/* ========================================================= */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setDrawerOpen(false)} />
          <aside className="relative w-72 max-w-[85vw] bg-card border-r border-border flex flex-col justify-between h-full z-10 shadow-2xl">
            <div className="p-4 overflow-y-auto flex-1 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                    <Cross className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-black text-sm text-foreground leading-none">eMEDICS BHW</h2>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate block mt-1">
                      {stationLabel}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"
                  aria-label="Close Navigation Drawer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">
                    Station Modules
                  </div>
                  <nav className="space-y-1">{primaryItems.map(renderDrawerNavButton)}</nav>
                </div>
                <div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-1.5">
                    Account
                  </div>
                  <nav className="space-y-1">{accountItems.map(renderDrawerNavButton)}</nav>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-border bg-secondary/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-muted-foreground">Theme</span>
                <div className="flex items-center bg-card p-0.5 rounded-xl border border-border">
                  {(['light', 'system', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onThemeChange(t)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold capitalize ${
                        theme === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {onLogout && (
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/15 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out ({userName})</span>
                </button>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ========================================================= */}
      {/* MAIN CONTENT SHELL                                        */}
      {/* ========================================================= */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* DEDICATED MOBILE APP HOME HEADER (< md on Overview tab) */}
        {activeTab === 'overview' && (
          <header className="md:hidden shrink-0 bg-gradient-to-br from-[#5B21B6] via-[#6D28D9] to-[#4C1D95] dark:from-[#211A32] dark:via-[#2A2040] dark:to-[#171225] dark:border-b dark:border-[#382C50] text-white px-4 pt-3 pb-4 rounded-b-3xl shadow-md z-30">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="p-2 -ml-1 rounded-xl hover:bg-white/10 transition-colors"
                aria-label="Open Navigation Menu"
              >
                <Menu className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
                  <Cross className="w-4 h-4 text-white" />
                </div>
                <div className="leading-tight">
                  <span className="font-black text-sm tracking-tight block">eMEDICS</span>
                  <span className="text-[10px] text-purple-200 font-semibold block">BHW Portal</span>
                </div>
              </div>

              <div className="relative flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen((p) => !p);
                    setUserMenuOpen(false);
                  }}
                  className="relative p-2 rounded-xl hover:bg-white/10 transition-colors"
                  aria-label="Station Alerts"
                >
                  <Bell className="w-5 h-5" />
                  {totalAlertsCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-[#5B21B6] dark:ring-[#211A32]" />
                  )}
                </button>
                {notificationsPopover}
              </div>
            </div>

            <div className="mt-3 space-y-2.5">
              <div>
                <p className="text-base font-black tracking-tight leading-snug">{getGreeting()}</p>
                <p className="text-xs text-purple-100/90 font-medium truncate">{stationLabel}</p>
              </div>

              <button
                type="button"
                onClick={() => handleSelectTab('profile')}
                className="w-full p-2.5 rounded-2xl bg-card/95 text-card-foreground border border-white/20 dark:border-border shadow-sm flex items-center justify-between gap-2.5 text-left"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-accent text-primary flex items-center justify-center shrink-0">
                    <MapPin className="w-4.5 h-4.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-foreground truncate">Barangay {barangayName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">Server-Isolated Station</p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </button>
            </div>
          </header>
        )}

        {/* UNIFIED HEADER BAR (md+ everywhere, AND < md on non-overview inner views) */}
        <header
          className={`h-14 md:h-16 bg-card/90 backdrop-blur-md border-b border-border items-center justify-between px-3 sm:px-6 shrink-0 z-30 ${
            activeTab === 'overview' ? 'hidden md:flex' : 'flex'
          }`}
        >
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-secondary hover:bg-accent text-foreground border border-border"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-foreground shrink-0">
                  BHW Portal
                </span>
                <span className="hidden xl:inline text-xs text-muted-foreground">/</span>
                <h2 className="text-sm sm:text-base font-black text-foreground tracking-tight truncate">
                  {activeItem.label}
                </h2>
              </div>
              <p className="hidden md:block text-[11px] text-muted-foreground truncate">
                {activeItem.description}
              </p>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary/70 border border-border text-xs font-semibold text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{currentDateStr}</span>
            </div>

            {/* Theme Quick Toggle */}
            <div
              className="hidden sm:flex items-center bg-secondary/80 p-0.5 rounded-xl border border-border"
              role="group"
              aria-label="Color Theme"
            >
              <button
                type="button"
                onClick={() => onThemeChange('light')}
                className={`p-1.5 rounded-lg transition-all ${
                  theme === 'light'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Light Mode"
                aria-label="Light Mode"
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('system')}
                className={`p-1.5 rounded-lg transition-all ${
                  theme === 'system'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="System Theme"
                aria-label="System Theme"
              >
                <Monitor className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onThemeChange('dark')}
                className={`p-1.5 rounded-lg transition-all ${
                  theme === 'dark'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Dark Mode"
                aria-label="Dark Mode"
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Notifications Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((prev) => !prev);
                  setUserMenuOpen(false);
                }}
                className="relative w-9 h-9 rounded-xl bg-secondary hover:bg-accent border border-border flex items-center justify-center text-foreground transition-colors"
                aria-label="Station Alerts"
              >
                <Bell className="w-4 h-4" />
                {totalAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-card">
                    {totalAlertsCount > 99 ? '99+' : totalAlertsCount}
                  </span>
                )}
              </button>
              {notificationsPopover}
            </div>

            {/* Profile Menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen((prev) => !prev);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-2 p-1 pr-2.5 rounded-xl bg-secondary hover:bg-accent border border-border transition-colors"
                aria-label="User Profile Menu"
              >
                <div className="w-7 h-7 rounded-lg bg-primary text-primary-foreground font-black text-xs flex items-center justify-center">
                  {initials}
                </div>
                <span className="hidden md:inline text-xs font-bold text-foreground max-w-[130px] truncate">
                  {userName}
                </span>
              </button>

              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-60 rounded-2xl bg-popover border border-border shadow-2xl z-50 p-2 text-popover-foreground">
                    <div className="px-3 py-2 border-b border-border mb-1">
                      <p className="text-xs font-bold text-foreground truncate">{userName}</p>
                      <p className="text-[11px] text-primary font-semibold truncate">
                        {stationLabel} • {userRole}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('profile')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                    >
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span>Profile &amp; Station Scope</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSelectTab('settings')}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left"
                    >
                      <Settings className="w-4 h-4 text-primary" />
                      <span>Appearance &amp; Settings</span>
                    </button>
                    {onRefreshStats && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onRefreshStats();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-foreground hover:bg-secondary transition-colors text-left"
                      >
                        <RefreshCw className="w-4 h-4 text-muted-foreground" />
                        <span>Sync Station Data</span>
                      </button>
                    )}
                    {onLogout && (
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors text-left mt-1"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* TABLET QUICK-SWITCH BAR (md to lg) */}
        <div className="hidden md:flex lg:hidden items-center justify-between gap-2 px-4 py-2 bg-card/80 border-b border-border overflow-x-auto no-scrollbar shrink-0">
          <div className="flex items-center gap-1.5">
            {primaryItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.shortLabel}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                        isActive ? 'bg-card text-foreground' : 'bg-amber-500 text-slate-950'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground bg-secondary border border-border whitespace-nowrap shrink-0"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
            <span>Account</span>
          </button>
        </div>

        {/* MAIN SCROLLABLE CONTENT */}
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 lg:p-7 pb-24 md:pb-8">
          <div className="max-w-[1440px] mx-auto">{children}</div>
        </main>
      </div>

      {/* ========================================================= */}
      {/* MOBILE SAFE-AREA BOTTOM NAVIGATION (< md)                 */}
      {/* Home | Inventory | Requests | Release | More              */}
      {/* ========================================================= */}
      <nav
        aria-label="Mobile BHW Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border px-1.5 pt-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] flex items-center justify-around shadow-2xl"
      >
        {mobileBottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectTab(item.id)}
              className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl min-w-[56px] transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`p-1 rounded-lg transition-colors ${isActive ? 'bg-accent' : ''}`}>
                <Icon className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold mt-0.5 truncate max-w-[60px]">
                {item.shortLabel}
              </span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-0.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-black flex items-center justify-center">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setMobileMoreOpen(true)}
          className={`relative flex flex-col items-center justify-center py-1 px-2 rounded-xl min-w-[56px] transition-colors ${
            isMoreTabActive || mobileMoreOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <div className={`p-1 rounded-lg transition-colors ${isMoreTabActive || mobileMoreOpen ? 'bg-accent' : ''}`}>
            <MoreHorizontal className="w-5 h-5" />
          </div>
          <span className="text-[10px] font-bold mt-0.5">More</span>
          {pendingReceiptsCount > 0 && (
            <span className="absolute top-0.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-black flex items-center justify-center">
              {pendingReceiptsCount}
            </span>
          )}
        </button>
      </nav>

      {/* MOBILE "MORE" SHEET (< md) */}
      {mobileMoreOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs" onClick={() => setMobileMoreOpen(false)} />
          <div className="relative bg-card border-t border-border rounded-t-3xl p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] z-10 shadow-2xl space-y-4">
            <div className="w-10 h-1 bg-border rounded-full mx-auto -mt-1 mb-1" />
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-foreground">More BHW Tools</h3>
                <p className="text-[11px] text-muted-foreground">{stationLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setMobileMoreOpen(false)}
                className="p-2 rounded-xl bg-secondary text-muted-foreground"
                aria-label="Close More Menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {mobileMoreItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectTab(item.id)}
                    className={`relative flex items-center gap-3 p-3.5 rounded-2xl border text-left transition-all ${
                      isActive
                        ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                        : 'bg-secondary/50 border-border text-foreground hover:bg-secondary'
                    }`}
                  >
                    <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-primary-foreground' : 'text-primary'}`} />
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">{item.shortLabel}</p>
                      <p className={`text-[10px] truncate ${isActive ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {item.id === 'receive' && pendingReceiptsCount > 0
                          ? `${pendingReceiptsCount} Pending`
                          : 'Open view'}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                  Appearance
                </span>
                <div className="flex items-center bg-secondary p-0.5 rounded-xl border border-border">
                  {(['light', 'system', 'dark'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => onThemeChange(t)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold capitalize ${
                        theme === t ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {onLogout && (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMoreOpen(false);
                    onLogout();
                  }}
                  className="w-full py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out ({userName})</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
