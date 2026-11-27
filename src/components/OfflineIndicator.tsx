import React, { useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, Database, ChevronUp, ChevronDown, Clock } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { useOfflineSyncStatus } from '../utils/offlineSyncQueue';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { pendingItems, pendingCount, isSyncing, lastSyncedCount, lastSyncError, syncNow } =
    useOfflineSyncStatus();
  const [showDetails, setShowDetails] = useState(false);

  const shouldShow =
    !isOnline || isSyncing || pendingCount > 0 || lastSyncedCount > 0;

  if (!shouldShow) return null;

  const isJustSynced = isOnline && !isSyncing && pendingCount === 0 && lastSyncedCount > 0;
  const isBackOnlineWithQueue = isOnline && (isSyncing || pendingCount > 0);

  return (
    <div className="fixed bottom-20 left-3 md:bottom-4 md:left-4 z-[240] flex flex-col items-start gap-2 max-w-[calc(100vw-24px)] sm:max-w-sm">
      {/* Expandable Pending Queue List */}
      {showDetails && pendingCount > 0 && (
        <div className="w-72 sm:w-80 rounded-2xl bg-slate-950/95 text-white border border-slate-700/80 shadow-2xl p-3 space-y-2 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="text-[11px] font-extrabold text-cyan-200">
                Antrean Offline IndexedDB ({pendingCount})
              </span>
            </div>
            {isOnline && (
              <button
                type="button"
                onClick={() => syncNow()}
                disabled={isSyncing}
                className="px-2 py-0.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[10px] font-bold text-white flex items-center gap-1"
              >
                <RefreshCw className={`w-2.5 h-2.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Push Sekarang</span>
              </button>
            )}
          </div>

          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-0.5">
            {pendingItems.map((item) => (
              <div
                key={item.id}
                className="px-2.5 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="truncate font-semibold text-slate-200">{item.label}</span>
                <span className="inline-flex items-center gap-1 text-[9px] text-amber-300 font-mono shrink-0">
                  <Clock className="w-2.5 h-2.5" />
                  Menunggu
                </span>
              </div>
            ))}
          </div>

          {lastSyncError && (
            <p className="text-[10px] text-rose-300 bg-rose-950/50 border border-rose-500/30 rounded-lg px-2 py-1">
              {lastSyncError}
            </p>
          )}

          <p className="text-[10px] text-slate-400 leading-snug">
            Perubahan tersimpan aman di IndexedDB & Service Worker dan akan otomatis dikirim ke Firestore saat internet tersambung.
          </p>
        </div>
      )}

      {/* Main Status Pill */}
      {!isOnline ? (
        <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/30 border border-amber-300/40">
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Mode Offline — Cache IndexedDB</span>
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="ml-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950/35 hover:bg-slate-950/50 text-[10px] font-extrabold border border-white/25 transition"
            >
              <span>{pendingCount} Antrean</span>
              {showDetails ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronUp className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      ) : isBackOnlineWithQueue ? (
        <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 border border-cyan-300/40">
          <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>
            {isSyncing
              ? `Menyinkronkan ${pendingCount} data ke Firestore...`
              : `${pendingCount} data offline siap dikirim`}
          </span>
          {!isSyncing && (
            <button
              type="button"
              onClick={() => syncNow()}
              className="px-2 py-0.5 rounded-lg bg-white text-indigo-700 hover:bg-indigo-50 text-[10px] font-extrabold shadow-xs transition"
            >
              Sync
            </button>
          )}
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              aria-label="Lihat antrean sinkronisasi"
              className="p-0.5 rounded hover:bg-white/15"
            >
              {showDetails ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      ) : isJustSynced ? (
        <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 border border-emerald-300/40 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          <span>{lastSyncedCount} perubahan offline tersinkronisasi ke Firestore!</span>
        </div>
      ) : null}
    </div>
  );
};
