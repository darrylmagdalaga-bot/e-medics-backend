import React from 'react';
import { PharmacyModule } from '../../features/pharmacy';
import { PharmacyTab } from '../../features/pharmacy/components/Layout/PharmacyLayout';

interface PharmacyScreenProps {
  userId?: number | null;
  onLogout?: () => void;
  initialTab?: PharmacyTab;
}

export function PharmacyScreen({ userId, onLogout, initialTab }: PharmacyScreenProps = {}) {
  return (
    <PharmacyModule
      userId={userId ?? undefined}
      onLogout={onLogout}
      initialTab={initialTab}
    />
  );
}
