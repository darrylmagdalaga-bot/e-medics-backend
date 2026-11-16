import React from 'react';
import { 
  Users, 
  Stethoscope, 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Building2, 
  ChevronRight, 
  ShieldCheck,
  UserCheck
} from 'lucide-react';

interface ClinicalLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  onSelectTab: (tab: string) => void;
  selectedPatientName?: string | null;
}

export function ClinicalLayout({
  children,
  activeTab,
  onSelectTab,
  selectedPatientName
}: ClinicalLayoutProps) {
  const tabs = [
    { id: 'dashboard', label: 'Clinical Dashboard', icon: LayoutDashboard },
    { id: 'registry', label: 'Patient Registry', icon: Users },
    { id: 'new-encounter', label: 'New Consultation', icon: PlusCircle },
    { id: 'encounters', label: 'Consultation History', icon: History },
  ];

  if (selectedPatientName) {
    tabs.push({ id: 'profile', label: `Profile: ${selectedPatientName}`, icon: UserCheck });
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground font-sans">
      {/* Top Header Banner */}
      <div className="bg-card border-b border-border/50 px-6 py-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/10 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-400 flex items-center justify-center font-bold shadow-xs">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> City Health Office</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="text-cyan-700 dark:text-cyan-400 font-semibold">Clinical Services</span>
              </div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                Patient Management & Clinical Consultation
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-cyan-100 text-cyan-800 dark:bg-cyan-900/60 dark:text-cyan-300">
                  <ShieldCheck className="w-3 h-3" /> Electronic Medical Record
                </span>
              </h1>
            </div>
          </div>
        </div>

        {/* Tab Navigation Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto mt-4 pt-1 border-t border-slate-100 dark:border-slate-800/60 no-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-cyan-700 text-white shadow-xs font-semibold dark:bg-cyan-600'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500 dark:text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 p-6 max-w-7xl w-full mx-auto">
        {children}
      </div>
    </div>
  );
}
