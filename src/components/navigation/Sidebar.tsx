import React from 'react';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogOut, LucideIcon } from 'lucide-react';
import { Button } from '../../ui/button';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  brandName?: string;
  brandSubtitle?: string;
  brandIcon?: LucideIcon;
  navGroups: NavGroup[];
  activeView: string;
  onNavigate: (id: string) => void;
  userInitials?: string;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
}

export function Sidebar({
  isOpen,
  onClose,
  brandName = 'eMEDICS',
  brandSubtitle = 'Module',
  brandIcon: BrandIcon,
  navGroups,
  activeView,
  onNavigate,
  userInitials = 'US',
  userName = 'User',
  userEmail = 'user@emedics.local',
  onLogout,
}: SidebarProps) {
  return (
    <>
      {/* Mobile Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border transform transition-transform duration-300 lg:relative lg:translate-x-0 flex flex-col shadow-sm",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center justify-between p-6 h-20 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            {BrandIcon && (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <BrandIcon className="w-6 h-6" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground leading-none">{brandName}</h2>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{brandSubtitle}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="w-5 h-5 text-muted-foreground" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
          {navGroups.map((group, groupIdx) => (
            <div key={groupIdx}>
              <h3 className="px-4 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider mb-2">
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
                      onClick={() => { onNavigate(item.id); onClose(); }}
                      className={cn(
                        "w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all group relative overflow-hidden",
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
                      <item.icon className={cn("w-5 h-5 transition-colors relative z-10", isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                      <span className="relative z-10">{item.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border/50 shrink-0 bg-card/50 backdrop-blur-md">
          <div className="flex items-center gap-3 p-3 mb-2 rounded-xl border border-border/50 bg-background/50">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          </div>
          {onLogout && (
            <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-xl" onClick={onLogout}>
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </Button>
          )}
        </div>
      </aside>
    </>
  );
}
