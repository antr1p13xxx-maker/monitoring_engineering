import React from 'react';
import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 left-3 md:bottom-4 md:left-4 z-[240] flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/30 border border-amber-300/40">
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Mode Offline — Cache lokal aktif</span>
    </div>
  );
};
