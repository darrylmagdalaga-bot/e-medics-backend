import React from 'react';
import { WarehouseModule } from '../../features/warehouse';

export function WarehouseScreen({ onLogout }: { onLogout: () => void }) {
  return <WarehouseModule onLogout={onLogout} />;
}
