import React from 'react';
import { ClinicalModule } from '../../features/clinical';

export function ClinicalScreen({ role = 'admin', initialTab = 'dashboard' }: { role?: string; initialTab?: string }) {
  return (
    <div className="min-h-full">
      <ClinicalModule initialTab={initialTab} />
    </div>
  );
}

export default ClinicalScreen;
