import React, { useState, useEffect } from 'react';
import {
    LayoutDashboard,
    Boxes,
    Send,
    Truck,
    HeartHandshake,
    History,
    ArrowLeftRight,
    FileSpreadsheet,
    ClipboardList,
    Stethoscope,
    Settings,
    Pill,
    MoreHorizontal,
    X,
    ChevronRight,
    Menu,
    Sun,
    Moon,
    Monitor,
    Bell,
    LogOut,
    Calendar,
    AlertTriangle,
    PackageCheck,
    ShieldCheck,
    RefreshCw
} from 'lucide-react';
import { PharmacyDashboardStats } from '../../types';

export type PharmacyTab =
    | 'dashboard'
    | 'inventory'
    | 'requests'
    | 'receive'
    | 'dispense'
    | 'history'
    | 'movements'
    | 'reports'
    | 'prescriptions'
    | 'clinical'
    | 'settings';

interface PharmacyLayoutProps {
    activeTab: PharmacyTab;
    onTabChange: (tab: PharmacyTab) => void;
    pendingReceiptsCount?: number;
    pendingRequestsCount?: number;
    pendingRxCount?: number;
    dashboardStats?: PharmacyDashboardStats | null;
    onRefreshStats?: () => void;
    onLogout?: () => void;
    children: React.ReactNode;
}

interface NavItemConfig {
    id: PharmacyTab;
    label: string;
    shortLabel: string;
    description: string;
    icon: React.ElementType;
    badge?: number;
    badgeTone?: 'amber' | 'indigo' | 'emerald' | 'rose';
    group: 'primary' | 'secondary';
}

export const PharmacyLayout: React.FC<PharmacyLayoutProps> = ({
    activeTab,
    onTabChange,
    pendingReceiptsCount = 0,
    pendingRequestsCount = 0,
    pendingRxCount = 0,
    dashboardStats,
    onRefreshStats,
    onLogout,
    children
}) => {
    const [moreSheetOpen, setMoreSheetOpen] = useState(false);
    const [tabletSidebarOpen, setTabletSidebarOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('pharma_theme');
            if (saved === 'light' || saved === 'dark' || saved === 'system') return saved;
        }
        return 'system';
    });

    useEffect(() => {
        if (typeof window === 'undefined') return;
        localStorage.setItem('pharma_theme', theme);
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        if (theme === 'system') {
            const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(sys);
        } else {
            root.classList.add(theme);
        }
    }, [theme]);

    const userName = typeof window !== 'undefined'
        ? (localStorage.getItem('pharma_userName') || 'City Pharmacist')
        : 'City Pharmacist';
    const userEmail = typeof window !== 'undefined'
        ? (localStorage.getItem('pharma_userEmail') || 'pharmacy@emedics.gov.ph')
        : 'pharmacy@emedics.gov.ph';

    const initials = userName
        .split(' ')
        .filter(Boolean)
        .map(part => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase() || 'CP';

    const currentDateFormatted = new Date().toLocaleDateString('en-PH', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });

    const navItems: NavItemConfig[] = [
        // PRIMARY NAVIGATION (1 - 6)
        {
            id: 'dashboard',
            label: 'Home',
            shortLabel: 'Home',
            description: 'Pharmacy operational overview, alerts & quick actions',
            icon: LayoutDashboard,
            group: 'primary'
        },
        {
            id: 'inventory',
            label: 'Inventory',
            shortLabel: 'Inventory',
            description: 'Batch-level stock, FEFO order & expiry status',
            icon: Boxes,
            group: 'primary'
        },
        {
            id: 'requests',
            label: 'Stock Requests',
            shortLabel: 'Requests',
            description: 'Requisition stock from CHO Central Warehouse',
            icon: Send,
            badge: pendingRequestsCount,
            badgeTone: 'indigo',
            group: 'primary'
        },
        {
            id: 'receive',
            label: 'Receive Stock',
            shortLabel: 'Receive',
            description: 'Verify & receive incoming Warehouse distributions',
            icon: Truck,
            badge: pendingReceiptsCount,
            badgeTone: 'amber',
            group: 'primary'
        },
        {
            id: 'dispense',
            label: 'Medicine Dispensing',
            shortLabel: 'Dispense',
            description: 'FEFO-allocated patient medicine dispensing',
            icon: HeartHandshake,
            group: 'primary'
        },
        {
            id: 'history',
            label: 'Dispensing History',
            shortLabel: 'History',
            description: 'Dispensing audit trail & controlled reversals',
            icon: History,
            group: 'primary'
        },
        // SECONDARY NAVIGATION / MORE (7 - 11)
        {
            id: 'movements',
            label: 'Inventory Movements',
            shortLabel: 'Movements',
            description: 'Immutable batch ledger of receipts, dispenses & reversals',
            icon: ArrowLeftRight,
            group: 'secondary'
        },
        {
            id: 'reports',
            label: 'Audit & Reports',
            shortLabel: 'Reports',
            description: 'Official CHO Pharmacy reports, exports & printables',
            icon: FileSpreadsheet,
            group: 'secondary'
        },
        {
            id: 'prescriptions',
            label: 'Prescriptions',
            shortLabel: 'Rx Queue',
            description: 'Incoming clinical e-prescriptions queue',
            icon: ClipboardList,
            badge: pendingRxCount,
            badgeTone: 'indigo',
            group: 'secondary'
        },
        {
            id: 'clinical',
            label: 'Clinical & Patients',
            shortLabel: 'Patients',
            description: 'Patient registry & clinical consultation records',
            icon: Stethoscope,
            group: 'secondary'
        },
        {
            id: 'settings',
            label: 'Pharmacy Settings',
            shortLabel: 'Settings',
            description: 'Pharmacy facility preferences & account security',
            icon: Settings,
            group: 'secondary'
        }
    ];

    const primaryItems = navItems.filter(i => i.group === 'primary');
    const secondaryItems = navItems.filter(i => i.group === 'secondary');
    const currentItem = navItems.find(i => i.id === activeTab) || navItems[0];

    // Mobile Bottom Navigation: Home | Inventory | Requests | Dispense | More
    // Receive Stock is accessible via Requests header bar and More sheet
    const mobileBottomTabs: { id: PharmacyTab | 'more'; label: string; icon: React.ElementType; badge?: number }[] = [
        { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
        { id: 'inventory', label: 'Inventory', icon: Boxes },
        {
            id: 'requests',
            label: 'Requests',
            icon: Send,
            badge: pendingRequestsCount + pendingReceiptsCount
        },
        { id: 'dispense', label: 'Dispense', icon: HeartHandshake },
        { id: 'more', label: 'More', icon: MoreHorizontal, badge: pendingReceiptsCount + pendingRxCount }
    ];

    const moreDrawerItems = navItems.filter(
        item => !['dashboard', 'inventory', 'requests', 'dispense'].includes(item.id)
    );
    const isMoreTabActive = moreDrawerItems.some(item => item.id === activeTab);
    const totalMoreBadges = pendingReceiptsCount + pendingRxCount;

    // Live notifications count
    const lowStockCount = dashboardStats?.lowStockCount || 0;
    const expiryCount = (dashboardStats?.expiredBatches || 0) + (dashboardStats?.nearExpiryBatches || 0);
    const totalAlertsCount = pendingReceiptsCount + lowStockCount + expiryCount + pendingRxCount;

    const handleSelectTab = (tab: PharmacyTab) => {
        onTabChange(tab);
        setMoreSheetOpen(false);
        setTabletSidebarOpen(false);
        setNotificationsOpen(false);
    };

    const renderNavButton = (item: NavItemConfig) => {
        const Icon = item.icon;
        const isActive = activeTab === item.id;
        return (
            <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left group ${
                    isActive
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
            >
                <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-muted-foreground group-hover:text-emerald-500'}`} />
                    <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                    <span
                        className={`px-2 py-0.5 text-[10px] font-black rounded-full shrink-0 ${
                            isActive
                                ? 'bg-white text-emerald-700'
                                : item.badgeTone === 'amber'
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30'
                                : 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30'
                        }`}
                    >
                        {item.badge}
                    </span>
                )}
            </button>
        );
    };

    return (
        <div className="flex h-full w-full bg-background text-foreground overflow-hidden select-none">
            {/* ========================================================= */}
            {/* DESKTOP LEFT SIDEBAR (lg+)                                */}
            {/* ========================================================= */}
            <aside className="hidden lg:flex w-72 bg-card border-r border-border flex-col justify-between shrink-0 h-full z-20">
                <div className="p-5 overflow-y-auto flex-1 sidebar-nav-scroll">
                    {/* Brand Header */}
                    <div className="flex items-center gap-3 mb-6 px-1">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-600/25 shrink-0">
                            <Pill className="w-5 h-5 text-white" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                                <h1 className="font-black text-base tracking-tight text-foreground leading-none">eMEDICS</h1>
                                <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                    CHO
                                </span>
                            </div>
                            <span className="text-[10px] font-bold text-muted-foreground tracking-widest uppercase block mt-1 truncate">
                                City Pharmacy Portal
                            </span>
                        </div>
                    </div>

                    {/* Primary Operations */}
                    <div className="space-y-5">
                        <div>
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 mb-2">
                                Primary Operations
                            </div>
                            <nav className="space-y-1" aria-label="Primary Pharmacy Navigation">
                                {primaryItems.map(renderNavButton)}
                            </nav>
                        </div>

                        {/* Secondary / More Modules */}
                        <div>
                            <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 mb-2">
                                More & Administration
                            </div>
                            <nav className="space-y-1" aria-label="Secondary Pharmacy Navigation">
                                {secondaryItems.map(renderNavButton)}
                            </nav>
                        </div>
                    </div>
                </div>

                {/* Sidebar Footer: Authenticated User & Sign Out */}
                <div className="p-4 border-t border-border bg-muted/20 space-y-2">
                    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border">
                        <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-xs shrink-0">
                            {initials}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-foreground truncate">{userName}</p>
                            <p className="text-[10px] text-muted-foreground truncate">City Health Office • Pharmacy</p>
                        </div>
                    </div>
                    {onLogout && (
                        <button
                            onClick={onLogout}
                            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Sign Out</span>
                        </button>
                    )}
                </div>
            </aside>

            {/* ========================================================= */}
            {/* TABLET COLLAPSIBLE SIDEBAR DRAWER (md to lg)              */}
            {/* ========================================================= */}
            {tabletSidebarOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm lg:hidden flex"
                    onClick={() => setTabletSidebarOpen(false)}
                >
                    <div
                        className="w-72 max-w-[85vw] bg-card border-r border-border h-full flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="p-5 overflow-y-auto flex-1 sidebar-nav-scroll">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-600/20">
                                        <Pill className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <h2 className="font-black text-sm text-foreground leading-none">Pharmacy Portal</h2>
                                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                                            CHO Pharmacy Division
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setTabletSidebarOpen(false)}
                                    className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                                    aria-label="Close Navigation Drawer"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-5">
                                <div>
                                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 mb-2">
                                        Primary Operations
                                    </div>
                                    <nav className="space-y-1">
                                        {primaryItems.map(renderNavButton)}
                                    </nav>
                                </div>
                                <div>
                                    <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest px-3 mb-2">
                                        More & Administration
                                    </div>
                                    <nav className="space-y-1">
                                        {secondaryItems.map(renderNavButton)}
                                    </nav>
                                </div>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border bg-muted/20">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-8 h-8 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-xs shrink-0">
                                        {initials}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-foreground truncate">{userName}</p>
                                        <p className="text-[10px] text-muted-foreground truncate">{userEmail}</p>
                                    </div>
                                </div>
                                {onLogout && (
                                    <button
                                        onClick={onLogout}
                                        className="p-2 rounded-lg text-rose-500 hover:bg-rose-500/10 transition-colors"
                                        title="Sign Out"
                                    >
                                        <LogOut className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================= */}
            {/* MAIN APPLICATION SHELL (HEADER + WORKSPACE + MOBILE NAV)  */}
            {/* ========================================================= */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-background">
                {/* Unified Responsive Header */}
                <header className="h-14 md:h-16 bg-card/90 backdrop-blur-md border-b border-border px-3 sm:px-5 lg:px-8 flex items-center justify-between gap-3 shrink-0 z-30">
                    {/* Left: Tablet Menu Trigger / Mobile Brand + Active View Context */}
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
                        {/* Tablet Drawer Button (visible on md..lg, and also handy on mobile) */}
                        <button
                            onClick={() => setTabletSidebarOpen(true)}
                            className="lg:hidden w-9 h-9 rounded-xl bg-muted/70 hover:bg-muted border border-border flex items-center justify-center text-foreground transition-colors shrink-0 cursor-pointer"
                            aria-label="Open Pharmacy Navigation"
                        >
                            <Menu className="w-4 h-4" />
                        </button>

                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    Pharmacy Management
                                </span>
                                <span className="hidden sm:inline-block text-[11px] font-semibold text-muted-foreground truncate">
                                    City Health Office • Pharmacy Division
                                </span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                                <h2 className="text-sm sm:text-base font-black text-foreground tracking-tight truncate">
                                    {currentItem.label}
                                </h2>
                                <span className="hidden xl:inline-block text-xs text-muted-foreground truncate">
                                    — {currentItem.description}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Date, Quick Action, Theme Toggle, Notifications, User Account */}
                    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
                        {/* Current Date Badge (Desktop/Tablet) */}
                        <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-muted/50 border border-border text-xs font-semibold text-muted-foreground">
                            <Calendar className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            <span>{currentDateFormatted}</span>
                        </div>

                        {/* Quick Dispense CTA if not currently on Dispense tab */}
                        {activeTab !== 'dispense' && (
                            <button
                                onClick={() => handleSelectTab('dispense')}
                                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                            >
                                <HeartHandshake className="w-3.5 h-3.5" />
                                <span>Dispense</span>
                            </button>
                        )}

                        {/* Theme Switcher */}
                        <div className="hidden sm:flex items-center bg-muted/60 p-0.5 rounded-xl border border-border">
                            <button
                                onClick={() => setTheme('light')}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                    theme === 'light'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Light Mode"
                                aria-label="Light Mode"
                            >
                                <Sun className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setTheme('system')}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                    theme === 'system'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="System Theme"
                                aria-label="System Theme"
                            >
                                <Monitor className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                                    theme === 'dark'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-muted-foreground hover:text-foreground'
                                }`}
                                title="Dark Mode"
                                aria-label="Dark Mode"
                            >
                                <Moon className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Notifications Dropdown */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setNotificationsOpen(prev => !prev);
                                    setUserMenuOpen(false);
                                }}
                                className="relative w-9 h-9 rounded-xl bg-muted/60 hover:bg-muted border border-border flex items-center justify-center text-foreground transition-colors cursor-pointer"
                                aria-label="Pharmacy Notifications"
                            >
                                <Bell className="w-4 h-4" />
                                {totalAlertsCount > 0 && (
                                    <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center border-2 border-card">
                                        {totalAlertsCount > 99 ? '99+' : totalAlertsCount}
                                    </span>
                                )}
                            </button>

                            {notificationsOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setNotificationsOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-card border border-border shadow-2xl z-50 overflow-hidden">
                                        <div className="p-3.5 border-b border-border flex items-center justify-between bg-muted/30">
                                            <div>
                                                <h3 className="text-xs font-black text-foreground uppercase tracking-wider">
                                                    Pharmacy Operational Alerts
                                                </h3>
                                                <p className="text-[11px] text-muted-foreground">
                                                    Live inventory, receiving & clinical queue status
                                                </p>
                                            </div>
                                            {onRefreshStats && (
                                                <button
                                                    onClick={onRefreshStats}
                                                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                                    title="Refresh Alerts"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="p-2.5 space-y-2 max-h-80 overflow-y-auto">
                                            {pendingReceiptsCount > 0 && (
                                                <button
                                                    onClick={() => handleSelectTab('receive')}
                                                    className="w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 flex items-start gap-3 text-left transition-colors cursor-pointer"
                                                >
                                                    <Truck className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-foreground">
                                                            {pendingReceiptsCount} Incoming Stock Distribution{pendingReceiptsCount > 1 ? 's' : ''}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                                            Dispatched from Central Warehouse awaiting Pharmacy receipt confirmation.
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                                                </button>
                                            )}

                                            {expiryCount > 0 && (
                                                <button
                                                    onClick={() => handleSelectTab('inventory')}
                                                    className="w-full p-3 rounded-xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 flex items-start gap-3 text-left transition-colors cursor-pointer"
                                                >
                                                    <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-foreground">
                                                            {dashboardStats?.expiredBatches || 0} Expired • {dashboardStats?.nearExpiryBatches || 0} Near-Expiry Batches
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                                            Review batch expiration dates and prioritize FEFO dispensing.
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                                                </button>
                                            )}

                                            {lowStockCount > 0 && (
                                                <button
                                                    onClick={() => handleSelectTab('requests')}
                                                    className="w-full p-3 rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/25 flex items-start gap-3 text-left transition-colors cursor-pointer"
                                                >
                                                    <Boxes className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-foreground">
                                                            {lowStockCount} Low-Stock Medicine Batch{lowStockCount > 1 ? 'es' : ''}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                                            Available quantity is at or below reorder threshold. Submit a stock request.
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                                                </button>
                                            )}

                                            {pendingRxCount > 0 && (
                                                <button
                                                    onClick={() => handleSelectTab('prescriptions')}
                                                    className="w-full p-3 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/15 border border-indigo-500/25 flex items-start gap-3 text-left transition-colors cursor-pointer"
                                                >
                                                    <ClipboardList className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-xs font-bold text-foreground">
                                                            {pendingRxCount} Pending e-Prescription{pendingRxCount > 1 ? 's' : ''}
                                                        </p>
                                                        <p className="text-[11px] text-muted-foreground mt-0.5">
                                                            Awaiting pharmacist review and medicine dispensing.
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                                                </button>
                                            )}

                                            {totalAlertsCount === 0 && (
                                                <div className="py-8 px-4 text-center">
                                                    <PackageCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                                                    <p className="text-xs font-bold text-foreground">All Pharmacy Systems Nominal</p>
                                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                                        No pending receipts, critical stock shortages, or unfulfilled prescriptions.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* User Account Menu */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setUserMenuOpen(prev => !prev);
                                    setNotificationsOpen(false);
                                }}
                                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted border border-border transition-colors cursor-pointer"
                                aria-label="Account Menu"
                            >
                                <div className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-xs">
                                    {initials}
                                </div>
                                <div className="hidden xl:block text-left">
                                    <p className="text-xs font-bold text-foreground leading-none truncate max-w-[120px]">{userName}</p>
                                    <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Pharmacist</p>
                                </div>
                            </button>

                            {userMenuOpen && (
                                <>
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setUserMenuOpen(false)}
                                    />
                                    <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-card border border-border shadow-2xl z-50 overflow-hidden p-2">
                                        <div className="p-3 border-b border-border mb-1.5">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 font-black text-xs shrink-0">
                                                    {initials}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-bold text-foreground truncate">{userName}</p>
                                                    <p className="text-[11px] text-muted-foreground truncate">{userEmail}</p>
                                                </div>
                                            </div>
                                            <div className="mt-2 flex items-center gap-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                                <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                                                <span>City Health Office • Pharmacy Role</span>
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => {
                                                setUserMenuOpen(false);
                                                handleSelectTab('settings');
                                            }}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-foreground hover:bg-muted transition-colors text-left cursor-pointer"
                                        >
                                            <Settings className="w-4 h-4 text-muted-foreground" />
                                            <span>Pharmacy Settings</span>
                                        </button>

                                        {onLogout && (
                                            <button
                                                onClick={() => {
                                                    setUserMenuOpen(false);
                                                    onLogout();
                                                }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-bold text-rose-500 hover:bg-rose-500/10 transition-colors text-left mt-1 cursor-pointer"
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

                {/* Tablet Compact Quick-Switch Bar (md to lg only) */}
                <div className="hidden md:flex lg:hidden items-center justify-between gap-2 px-4 py-2 bg-card/60 border-b border-border overflow-x-auto no-scrollbar shrink-0">
                    <div className="flex items-center gap-1.5">
                        {primaryItems.map(item => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => handleSelectTab(item.id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                        isActive
                                            ? 'bg-emerald-600 text-white shadow-sm'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
                                    }`}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    <span>{item.shortLabel}</span>
                                    {item.badge !== undefined && item.badge > 0 && (
                                        <span className={`px-1.5 py-0.2 text-[10px] font-black rounded-full ${
                                            isActive ? 'bg-white text-emerald-700' : 'bg-amber-500 text-slate-950'
                                        }`}>
                                            {item.badge}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={() => setTabletSidebarOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground bg-muted/50 border border-border whitespace-nowrap shrink-0 cursor-pointer"
                    >
                        <MoreHorizontal className="w-3.5 h-3.5" />
                        <span>More Modules</span>
                    </button>
                </div>

                {/* Mobile Receive-Stock Banner when on Stock Requests tab so Receive Stock is 1-tap accessible from Requests */}
                {activeTab === 'requests' && (
                    <div className="md:hidden px-3 pt-2.5 shrink-0">
                        <div className="p-2.5 rounded-xl bg-card border border-border flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                                <Truck className="w-4 h-4 text-amber-500 shrink-0" />
                                <span className="text-xs font-bold text-foreground truncate">
                                    Incoming Warehouse Shipments
                                </span>
                                {pendingReceiptsCount > 0 && (
                                    <span className="px-1.5 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-slate-950">
                                        {pendingReceiptsCount} Pending
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={() => handleSelectTab('receive')}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold shrink-0"
                            >
                                Receive Stock
                            </button>
                        </div>
                    </div>
                )}

                {/* Main Scrollable Content Area */}
                <main className="flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8 pb-24 md:pb-8">
                    <div className="max-w-[1600px] mx-auto">
                        {children}
                    </div>
                </main>
            </div>

            {/* ========================================================= */}
            {/* MOBILE BOTTOM NAVIGATION BAR (< md)                       */}
            {/* Home | Inventory | Requests | Dispense | More             */}
            {/* ========================================================= */}
            <nav
                aria-label="Mobile Pharmacy Navigation"
                className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border px-1.5 py-1 flex items-center justify-around shadow-2xl"
            >
                {mobileBottomTabs.map(tab => {
                    const Icon = tab.icon;
                    const isMore = tab.id === 'more';
                    const isActive = isMore ? (isMoreTabActive || moreSheetOpen) : (activeTab === tab.id && !moreSheetOpen);
                    return (
                        <button
                            key={tab.id}
                            onClick={() => {
                                if (isMore) setMoreSheetOpen(prev => !prev);
                                else handleSelectTab(tab.id as PharmacyTab);
                            }}
                            className={`relative flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl min-w-[60px] min-h-[46px] transition-all ${
                                isActive
                                    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 font-black'
                                    : 'text-muted-foreground hover:text-foreground font-semibold'
                            }`}
                        >
                            <Icon className="w-5 h-5 mb-0.5" />
                            <span className="text-[10px] tracking-tight leading-none">{tab.label}</span>
                            {tab.badge !== undefined && tab.badge > 0 && (
                                <span className={`absolute top-1 right-2.5 min-w-[16px] h-4 px-1 text-[9px] font-black rounded-full flex items-center justify-center ${
                                    isMore ? 'bg-indigo-500 text-white' : 'bg-amber-500 text-slate-950'
                                }`}>
                                    {tab.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </nav>

            {/* ========================================================= */}
            {/* MOBILE "MORE" BOTTOM SHEET DRAWER                         */}
            {/* ========================================================= */}
            {moreSheetOpen && (
                <div
                    className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end"
                    onClick={() => setMoreSheetOpen(false)}
                >
                    <div
                        className="bg-card border-t border-border rounded-t-3xl p-5 pb-24 space-y-3 shadow-2xl max-h-[82vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-border">
                            <div>
                                <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                                    More Pharmacy Modules
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    Receiving, inventory ledger, prescriptions, reports & settings
                                </p>
                            </div>
                            <button
                                onClick={() => setMoreSheetOpen(false)}
                                className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                                aria-label="Close More Menu"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="space-y-2">
                            {moreDrawerItems.map(item => {
                                const Icon = item.icon;
                                const isActive = activeTab === item.id;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => handleSelectTab(item.id)}
                                        className={`w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left ${
                                            isActive
                                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400'
                                                : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                                        }`}
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                isActive ? 'bg-emerald-600 text-white' : 'bg-card text-muted-foreground border border-border'
                                            }`}>
                                                <Icon className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-sm truncate">{item.label}</div>
                                                <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            {item.badge !== undefined && item.badge > 0 && (
                                                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 text-xs font-black rounded-full">
                                                    {item.badge}
                                                </span>
                                            )}
                                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Mobile Theme Selector & Sign Out */}
                        <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1 bg-muted p-1 rounded-xl border border-border">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                        theme === 'light' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'
                                    }`}
                                >
                                    <Sun className="w-3.5 h-3.5" />
                                    <span>Light</span>
                                </button>
                                <button
                                    onClick={() => setTheme('system')}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                        theme === 'system' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'
                                    }`}
                                >
                                    <Monitor className="w-3.5 h-3.5" />
                                    <span>Auto</span>
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 ${
                                        theme === 'dark' ? 'bg-emerald-600 text-white' : 'text-muted-foreground'
                                    }`}
                                >
                                    <Moon className="w-3.5 h-3.5" />
                                    <span>Dark</span>
                                </button>
                            </div>

                            {onLogout && (
                                <button
                                    onClick={() => {
                                        setMoreSheetOpen(false);
                                        onLogout();
                                    }}
                                    className="px-3.5 py-2 rounded-xl bg-rose-500/10 text-rose-500 border border-rose-500/20 text-xs font-bold flex items-center gap-1.5"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Sign Out</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
