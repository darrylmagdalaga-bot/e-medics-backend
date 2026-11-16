import React, { useState } from 'react';
import { Menu, Search, Bell, Settings, LogOut } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { cn } from '../../../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { ThemeToggle } from '../theme/ThemeToggle'; // We'll create this next

export interface TopNavigationProps {
  onMenuClick: () => void;
  showSearch?: boolean;
  onSearch?: (query: string) => void;
  userInitials?: string;
  userName?: string;
  userEmail?: string;
  onLogout?: () => void;
  extraActions?: React.ReactNode;
}

export function TopNavigation({
  onMenuClick,
  showSearch = true,
  onSearch,
  userInitials = 'US',
  userName = 'User',
  userEmail = 'user@emedics.local',
  onLogout,
  extraActions,
}: TopNavigationProps) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <header className="h-20 bg-card/80 backdrop-blur-xl border-b border-border flex items-center justify-between px-4 lg:px-8 shrink-0 z-30 sticky top-0 shadow-sm transition-colors">
      <div className="flex items-center gap-4 flex-1">
        <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={onMenuClick}>
          <Menu className="w-6 h-6 text-foreground" />
        </Button>
        
        {/* Search Bar */}
        {showSearch && (
          <div className="hidden md:flex relative max-w-md w-full group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
            <Input 
              onChange={(e) => onSearch?.(e.target.value)}
              placeholder="Search... (Cmd+K)" 
              className="pl-10 bg-muted/50 border-transparent focus:border-primary/50 focus:bg-background rounded-full w-full transition-all duration-300 focus:shadow-md focus:shadow-primary/5"
            />
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-3 shrink-0">
        {extraActions && (
          <div className="hidden lg:flex items-center gap-2">
            {extraActions}
          </div>
        )}

        {extraActions && <div className="w-px h-6 bg-border mx-2 hidden sm:block"></div>}

        {/* Theme Toggle Component */}
        <ThemeToggle />

        {/* Notifications */}
        <button className="relative p-2 rounded-full hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50">
          <Bell className="w-5 h-5 text-muted-foreground" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
        </button>

        {/* Profile Dropdown Trigger */}
        <div className="relative ml-2">
          <button 
            className="flex focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-full" 
            onClick={() => setIsProfileOpen(!isProfileOpen)}
          >
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-blue-400 flex items-center justify-center text-white font-bold text-sm shadow-md hover:shadow-lg transition-all border-2 border-card">
              {userInitials}
            </div>
          </button>
          
          <AnimatePresence>
            {isProfileOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsProfileOpen(false)}></div>
                <motion.div 
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 mt-2 w-56 bg-popover rounded-xl shadow-lg border border-border py-1 z-50 text-left"
                >
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-medium text-foreground">{userName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                  <div className="p-1">
                    <button className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-muted text-foreground flex items-center gap-2 transition-colors">
                      <Settings className="w-4 h-4" /> Settings
                    </button>
                    {onLogout && (
                      <button onClick={onLogout} className="w-full text-left px-3 py-2 text-sm rounded-md hover:bg-destructive/10 text-destructive flex items-center gap-2 transition-colors">
                        <LogOut className="w-4 h-4" /> Sign Out
                      </button>
                    )}
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
