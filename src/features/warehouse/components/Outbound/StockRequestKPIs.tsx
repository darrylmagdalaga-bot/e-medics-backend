import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileOutput,
  Clock,
  CheckCircle2,
  PackageCheck,
  Truck,
  Layers,
  XCircle
} from 'lucide-react';
import { API_URL, getActiveUserId } from '../../../../app/api-config';

interface StockRequestKPIsProps {
  onFilterStatus?: (status: string) => void;
  selectedStatus?: string;
}

export function StockRequestKPIs({ onFilterStatus, selectedStatus }: StockRequestKPIsProps = {}) {
  const { data: kpis, isLoading } = useQuery({
    queryKey: ['warehouse-stock-requests-kpis'],
    queryFn: async () => {
      const uid = getActiveUserId();
      const res = await fetch(`${API_URL}/api/warehouse/stock-requests/kpis`, { headers: { 'x-user-id': String(uid) } });
      if (!res.ok) throw new Error('Failed to fetch stock request KPIs');
      return res.json();
    },
    refetchInterval: 15000,
  });

  const cards = [
    {
      id: 'ALL',
      label: 'Total Requests',
      value: kpis?.totalRequests ?? 0,
      icon: FileOutput,
      tone: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
      activeRing: 'ring-2 ring-blue-500',
    },
    {
      id: 'Pending',
      label: 'Pending Review',
      value: kpis?.pendingReview ?? 0,
      icon: Clock,
      tone: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      activeRing: 'ring-2 ring-amber-500',
      highlight: (kpis?.pendingReview || 0) > 0,
    },
    {
      id: 'Partially Approved',
      label: 'Partially Fulfilled',
      value: kpis?.partiallyApproved ?? 0,
      icon: Layers,
      tone: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20',
      activeRing: 'ring-2 ring-indigo-500',
    },
    {
      id: 'Approved',
      label: 'Approved (Pending Release)',
      value: kpis?.approvedReserved ?? 0,
      icon: PackageCheck,
      tone: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
      activeRing: 'ring-2 ring-emerald-500',
    },
    {
      id: 'In Transit',
      label: 'In Transit / Issued',
      value: kpis?.inTransit ?? 0,
      icon: Truck,
      tone: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20',
      activeRing: 'ring-2 ring-cyan-500',
    },
    {
      id: 'Completed',
      label: 'Fulfilled / Received',
      value: kpis?.completed ?? 0,
      icon: CheckCircle2,
      tone: 'text-teal-500 bg-teal-500/10 border-teal-500/20',
      activeRing: 'ring-2 ring-teal-500',
    },
    {
      id: 'Rejected',
      label: 'Rejected',
      value: kpis?.rejected ?? 0,
      icon: XCircle,
      tone: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      activeRing: 'ring-2 ring-rose-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-4">
      {cards.map((c) => {
        const Icon = c.icon;
        const isSelected = selectedStatus === c.id;

        return (
          <div
            key={c.id}
            onClick={() => onFilterStatus && onFilterStatus(c.id)}
            className={`p-3.5 rounded-2xl bg-card border border-border shadow-xs flex flex-col justify-between transition-all select-none ${
              onFilterStatus ? 'cursor-pointer hover:border-primary/50 hover:shadow-sm active:scale-[0.99]' : ''
            } ${isSelected ? c.activeRing : ''}`}
          >
            <div className="flex items-center justify-between gap-1.5 mb-2">
              <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                {c.label}
              </span>
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 border ${c.tone}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>

            <div className="flex items-baseline gap-1.5">
              <span className="text-xl sm:text-2xl font-black text-foreground">
                {isLoading ? '...' : c.value.toLocaleString()}
              </span>
              {c.highlight && (
                <span className="inline-flex w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
