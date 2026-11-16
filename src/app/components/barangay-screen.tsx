import React from 'react';
import { BarangayModule } from '../../features/barangay';

interface BarangayScreenProps {
  role?: string;
  userId?: number | null;
  onLogout?: () => void;
}

export function BarangayScreen({ role = 'barangay', userId, onLogout }: BarangayScreenProps) {
  return (
    <BarangayModule
      userId={userId}
      role={role}
      onLogout={onLogout}
    />
  );
}
