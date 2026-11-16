import { Search, Bell, Menu } from 'lucide-react';
import { ThemeToggle } from '../../components/theme/ThemeToggle';

interface TopBarProps {
  onMenuClick?: () => void;
  title?: string;
}

export function TopBar({ onMenuClick, title }: TopBarProps) {
  return (
    <header className="h-16 lg:h-20 bg-card border-b border-border flex items-center justify-between px-4 lg:px-8 shrink-0 relative z-30 transition-colors">
      <div className="flex items-center gap-3 flex-1 lg:max-w-xl">
        {/* Mobile Menu Button */}
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        {title ? (
          <h2 className="text-lg font-bold text-foreground hidden sm:block tracking-tight">{title}</h2>
        ) : (
          <div className="hidden sm:flex flex-1 items-center gap-2 px-3 lg:px-4 py-2 lg:py-2 bg-muted/40 hover:bg-muted/60 rounded-xl lg:rounded-2xl border border-border/50 focus-within:border-primary/40 focus-within:bg-card focus-within:ring-2 focus-within:ring-primary/20 transition-all group">
            <Search className="w-4 h-4 lg:w-4 lg:h-4 text-muted-foreground group-focus-within:text-primary transition-colors shrink-0" />
            <input
              type="text"
              placeholder="Search e-MEDICS system..."
              className="bg-transparent border-none focus:outline-none text-sm w-full font-medium text-foreground placeholder:text-muted-foreground"
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 lg:gap-3 ml-auto">
        {/* Theme Mode Switcher */}
        <ThemeToggle />

        <button 
          className="p-2 lg:p-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-xl transition-all relative border border-transparent hover:border-border/50" 
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" />
          <span className="absolute top-2 right-2 lg:top-2.5 lg:right-2.5 w-2 h-2 bg-destructive rounded-full border border-card" />
        </button>
      </div>
    </header>
  );
}
