import React from 'react';
import { cn } from '../../../lib/utils';

interface AppShellProps {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ sidebar, header, children, className }: AppShellProps) {
  return (
    <div className={cn("flex h-screen bg-background overflow-hidden font-sans text-foreground", className)}>
      {sidebar}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-muted/10">
        {header}
        <div className="flex-1 overflow-x-hidden overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
