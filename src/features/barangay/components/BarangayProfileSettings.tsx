import React from 'react';
import {
  ShieldCheck,
  MapPin,
  User,
  KeyRound,
  RefreshCw,
  LogOut,
  Sun,
  Moon,
  Monitor,
  Check,
  Palette,
  Building2,
} from 'lucide-react';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { BarangayScope } from '../types';

export type BhwThemePreference = 'light' | 'dark' | 'system';

interface BarangayProfileViewProps {
  scope: BarangayScope | null;
  role: string;
  onRefresh: () => void;
  onNavigateSettings: () => void;
  isLoading: boolean;
}

export function BarangayProfileView({
  scope,
  role,
  onRefresh,
  onNavigateSettings,
  isLoading,
}: BarangayProfileViewProps) {
  const initials =
    (scope?.fullName || 'BH')
      .split(' ')
      .filter(Boolean)
      .map((p) => p[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'BH';

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Health Worker Profile &amp; Station Identity
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Server-verified credentials and assigned Barangay Health Station isolation boundary
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onNavigateSettings}
            className="h-9 rounded-xl text-xs font-semibold"
          >
            <Palette className="w-3.5 h-3.5 mr-1.5" />
            Theme &amp; Settings
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-9 rounded-xl text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Sync Station
          </Button>
        </div>
      </div>

      {/* Identity Hero Card */}
      <Card className="p-5 sm:p-6 rounded-2xl border-border bg-card shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 text-primary font-black text-xl flex items-center justify-center shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base sm:text-lg font-black text-foreground truncate">
                {scope?.fullName || 'Barangay Health Worker'}
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-foreground border border-primary/20">
                {role === 'barangay' ? 'BHW Account' : role}
              </span>
            </div>
            <p className="text-xs text-muted-foreground font-mono">
              Username: <strong className="text-foreground">{scope?.username || '—'}</strong> • User ID:{' '}
              <strong className="text-foreground">{scope?.userId ?? '—'}</strong>
            </p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Assigned Station Details */}
        <Card className="p-5 rounded-2xl border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-foreground">Assigned Health Station</h4>
              <p className="text-[11px] text-muted-foreground">Authoritative Location Binding</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="p-3 rounded-xl bg-secondary/70 border border-border">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Station Facility</span>
              <span className="text-sm font-black text-foreground mt-0.5 block">
                {scope?.locationName || 'Pending Station Resolution'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-secondary/70 border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Barangay</span>
                <span className="font-bold text-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
                  {scope?.barangay || '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-secondary/70 border border-border">
                <span className="text-[10px] uppercase font-bold text-muted-foreground block">Location ID</span>
                <span className="font-mono font-bold text-foreground mt-0.5 block">
                  #{scope?.locationId ?? '—'}
                </span>
              </div>
            </div>
          </div>
        </Card>

        {/* Station Data Isolation & Security */}
        <Card className="p-5 rounded-2xl border-border bg-card shadow-sm space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/12 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-foreground">Access Scope &amp; Security</h4>
              <p className="text-[11px] text-muted-foreground">Server-Derived RBAC Protection</p>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1.5">
            <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5" />
              Station Isolation Active
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Every inventory query, stock requisition, distribution receipt, and patient medicine release is bound server-side to{' '}
              <strong className="text-foreground">{scope?.locationName || 'your assigned station'}</strong>. Cross-station data access is strictly prohibited.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

interface BarangaySettingsViewProps {
  theme: BhwThemePreference;
  onThemeChange: (theme: BhwThemePreference) => void;
  scope: BarangayScope | null;
  onRefresh: () => void;
  onLogout?: () => void;
  isLoading: boolean;
}

export function BarangaySettingsView({
  theme,
  onThemeChange,
  scope,
  onRefresh,
  onLogout,
  isLoading,
}: BarangaySettingsViewProps) {
  const themeOptions: {
    id: BhwThemePreference;
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    previewBg: string;
    previewCard: string;
    previewAccent: string;
  }[] = [
    {
      id: 'light',
      label: 'Light Mode',
      description: 'Soft lavender paper canvas (#FAF8FF) with crisp royal purple accents',
      icon: Sun,
      previewBg: '#FAF8FF',
      previewCard: '#FFFFFF',
      previewAccent: '#6D28D9',
    },
    {
      id: 'dark',
      label: 'Dark Mode',
      description: 'Deep plum night surface (#0F0B1A / #211A32) with soft violet highlights',
      icon: Moon,
      previewBg: '#0F0B1A',
      previewCard: '#211A32',
      previewAccent: '#A78BFA',
    },
    {
      id: 'system',
      label: 'System Default',
      description: 'Automatically matches your device or operating system appearance',
      icon: Monitor,
      previewBg: 'linear-gradient(135deg, #FAF8FF 50%, #0F0B1A 50%)',
      previewCard: '#6D28D9',
      previewAccent: '#A78BFA',
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg sm:text-xl font-black text-foreground tracking-tight flex items-center gap-2">
          <Palette className="w-5 h-5 text-primary" />
          Portal Appearance &amp; Preferences
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Customize Light Mode, Dark Mode, or System theme for {scope?.locationName || 'your BHW workstation'}
        </p>
      </div>

      {/* Theme Selection Grid */}
      <Card className="p-5 sm:p-6 rounded-2xl border-border bg-card shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-black text-foreground">Color Theme Preference</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Changes apply immediately across navigation, dashboards, forms, modals, and persist across page refreshes.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {themeOptions.map((opt) => {
            const Icon = opt.icon;
            const isSelected = theme === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onThemeChange(opt.id)}
                className={`p-4 rounded-2xl border text-left transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-accent/60 ring-2 ring-primary/30 shadow-sm'
                    : 'border-border bg-secondary/40 hover:bg-secondary/80'
                }`}
              >
                <div className="space-y-3 w-full">
                  {/* Live mini theme swatch */}
                  <div
                    className="h-14 rounded-xl border border-border/80 p-2.5 flex items-center justify-between overflow-hidden"
                    style={{ background: opt.previewBg }}
                  >
                    <div
                      className="w-16 h-6 rounded-md shadow-xs"
                      style={{ background: opt.previewCard }}
                    />
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ background: opt.previewAccent }}
                    />
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 text-xs font-black text-foreground">
                      <Icon className="w-4 h-4 text-primary" />
                      {opt.label}
                    </span>
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                        <Check className="w-3 h-3" />
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{opt.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Station Session Actions */}
      <Card className="p-5 sm:p-6 rounded-2xl border-border bg-card shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-0.5">
          <h3 className="text-sm font-black text-foreground">Station Data &amp; Session</h3>
          <p className="text-xs text-muted-foreground">
            Refresh live inventory &amp; distribution data or safely sign out of this station terminal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onRefresh}
            disabled={isLoading}
            className="h-10 px-4 rounded-xl text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Station Data
          </Button>
          {onLogout && (
            <Button
              type="button"
              variant="outline"
              onClick={onLogout}
              className="h-10 px-4 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10"
            >
              <LogOut className="w-3.5 h-3.5 mr-1.5" />
              Sign Out
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
