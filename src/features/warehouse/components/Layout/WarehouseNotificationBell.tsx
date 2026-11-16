import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Bell, CheckCircle2, Clock, Truck, FileOutput, AlertTriangle, 
  X, Check, ExternalLink, RefreshCw, Layers, ShieldAlert, Sparkles 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../../lib/utils';
import { API_URL } from '../../../../app/api-config';

export interface WarehouseNotification {
  id: string;
  type: 'stock_request' | 'delivery_receipt' | 'expiry_alert';
  title: string;
  description: string;
  timestamp: string;
  actionView: string;
  badge: string;
  badgeColor: 'primary' | 'amber' | 'destructive' | 'blue';
}

interface WarehouseNotificationBellProps {
  onNavigate: (view: string) => void;
}

export function WarehouseNotificationBell({ onNavigate }: WarehouseNotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WarehouseNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'stock_request' | 'delivery_receipt' | 'expiry_alert'>('all');
  
  // Persist read notification IDs in localStorage
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('emedics_warehouse_read_notifications');
      return saved ? new Set(JSON.parse(saved)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setCanScrollUp(scrollTop > 6);
    setCanScrollDown(scrollTop + clientHeight < scrollHeight - 6);
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/warehouse/notifications`, {
        headers: { 'Bypass-Tunnel-Reminder': 'true' }
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.notifications)) {
        setNotifications(data.notifications);
      }
    } catch (err) {
      console.error('Failed to load warehouse notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Save read IDs
  const markAsRead = (id: string) => {
    setReadIds(prev => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem('emedics_warehouse_read_notifications', JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = new Set(notifications.map(n => n.id));
    setReadIds(allIds);
    try {
      localStorage.setItem('emedics_warehouse_read_notifications', JSON.stringify([...allIds]));
    } catch {}
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const unreadCount = useMemo(() => {
    return notifications.filter(n => !readIds.has(n.id)).length;
  }, [notifications, readIds]);

  const filteredNotifications = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter(n => n.type === activeTab);
  }, [notifications, activeTab]);

  // Recalculate scroll affordance cues
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(checkScroll, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, filteredNotifications, activeTab]);

  const handleNotificationClick = (item: WarehouseNotification) => {
    markAsRead(item.id);
    setIsOpen(false);
    if (item.actionView) {
      onNavigate(item.actionView);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'stock_request':
        return <FileOutput className="w-4 h-4 text-primary" />;
      case 'delivery_receipt':
        return <Truck className="w-4 h-4 text-blue-500" />;
      case 'expiry_alert':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  const formatTime = (ts: string) => {
    try {
      const date = new Date(ts);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative p-2.5 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-primary/20",
          isOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        aria-label="Warehouse Notifications"
        title="Warehouse Notifications"
      >
        <Bell className="w-5 h-5" />
        
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex items-center justify-center min-w-5 h-5 px-1 bg-destructive text-destructive-foreground font-black text-[10px] rounded-full border-2 border-card shadow-sm animate-in zoom-in">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="fixed sm:absolute right-3 sm:right-0 top-18 sm:top-full mt-2 w-[calc(100vw-24px)] sm:w-[420px] bg-card text-card-foreground rounded-3xl shadow-2xl border border-border overflow-hidden z-50 flex flex-col max-h-[85vh] sm:max-h-[560px]"
          >
            {/* Popover Header */}
            <div className="p-4 sm:p-5 border-b border-border bg-muted/20 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                  <Bell className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-destructive/10 text-destructive border border-destructive/20">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Warehouse operations & stock alerts</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={fetchNotifications}
                  disabled={loading}
                  title="Refresh notifications"
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin text-primary")} />
                </button>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] font-bold text-primary hover:underline px-2 py-1"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 p-1.5 border-b border-border bg-muted/10 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] transition-colors whitespace-nowrap",
                  activeTab === 'all' 
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold" 
                    : "text-muted-foreground font-medium hover:text-foreground hover:bg-muted"
                )}
              >
                All ({notifications.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('stock_request')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] transition-colors whitespace-nowrap flex items-center gap-1",
                  activeTab === 'stock_request' 
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold" 
                    : "text-muted-foreground font-medium hover:text-foreground hover:bg-muted"
                )}
              >
                <FileOutput className="w-2.5 h-2.5" />
                Requests
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('delivery_receipt')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] transition-colors whitespace-nowrap flex items-center gap-1",
                  activeTab === 'delivery_receipt' 
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold" 
                    : "text-muted-foreground font-medium hover:text-foreground hover:bg-muted"
                )}
              >
                <Truck className="w-2.5 h-2.5" />
                Inbound
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('expiry_alert')}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] transition-colors whitespace-nowrap flex items-center gap-1",
                  activeTab === 'expiry_alert' 
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold" 
                    : "text-muted-foreground font-medium hover:text-foreground hover:bg-muted"
                )}
              >
                <AlertTriangle className="w-2.5 h-2.5" />
                Expirations
              </button>
            </div>

            {/* Scrollable Notifications Area with Edge Fades & Modern Custom Scrollbar */}
            <div className="relative flex-1 overflow-hidden flex flex-col min-h-0">
              {/* Top scroll affordance fade */}
              <div 
                className={cn(
                  "absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-card via-card/70 to-transparent pointer-events-none z-10 transition-opacity duration-200",
                  canScrollUp ? "opacity-100" : "opacity-0"
                )} 
              />

              <div 
                ref={listRef}
                onScroll={checkScroll}
                className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-border/60 overscroll-contain pr-1 sm:pr-1.5"
                style={{ scrollbarGutter: 'stable' }}
              >
                {filteredNotifications.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground flex flex-col items-center justify-center gap-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500/70" />
                    <p className="text-xs font-bold text-foreground">All Caught Up!</p>
                    <p className="text-[11px] text-muted-foreground max-w-[200px]">
                      No pending notifications in this category.
                    </p>
                  </div>
                ) : (
                  filteredNotifications.map(item => {
                    const isRead = readIds.has(item.id);

                    return (
                      <div
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={cn(
                          "p-3.5 sm:p-4 flex items-start gap-3 transition-colors cursor-pointer group hover:bg-muted/40",
                          !isRead && "bg-primary/5"
                        )}
                      >
                        <div className="w-8 h-8 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                          {getIcon(item.type)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1 mb-0.5">
                            <p className={cn(
                              "text-xs text-foreground truncate",
                              !isRead ? "font-bold" : "font-medium"
                            )}>
                              {item.title}
                            </p>
                            <span className="text-[10px] text-muted-foreground shrink-0 font-medium">
                              {formatTime(item.timestamp)}
                            </span>
                          </div>

                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-snug">
                            {item.description}
                          </p>

                          <div className="flex items-center justify-between mt-2 pt-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                              item.badgeColor === 'destructive' && "bg-destructive/10 text-destructive border border-destructive/20",
                              item.badgeColor === 'amber' && "bg-amber-500/10 text-amber-500 border border-amber-500/20",
                              item.badgeColor === 'blue' && "bg-blue-500/10 text-blue-500 border border-blue-500/20",
                              item.badgeColor === 'primary' && "bg-primary/10 text-primary border border-primary/20"
                            )}>
                              {item.badge}
                            </span>

                            <span className="text-[10px] font-bold text-primary flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              View details
                              <ExternalLink className="w-2.5 h-2.5" />
                            </span>
                          </div>
                        </div>

                        {!isRead && (
                          <span className="w-2 h-2 rounded-full bg-primary shrink-0 self-center" />
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom scroll affordance fade */}
              <div 
                className={cn(
                  "absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-card via-card/70 to-transparent pointer-events-none z-10 transition-opacity duration-200",
                  canScrollDown ? "opacity-100" : "opacity-0"
                )} 
              />
            </div>

            {/* Popover Footer */}
            <div className="p-3 border-t border-border bg-muted/20 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">
                Click any notification to navigate to the corresponding Warehouse Operation.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
