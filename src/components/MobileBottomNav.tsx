import React from 'react';
import { Table2, PackageCheck, BarChart3, FileCode2, ShieldCheck, QrCode } from 'lucide-react';
import { UserRole } from '../types/engineering';

interface MobileBottomNavProps {
  currentView: 'monitoring' | 'barcodes' | 'kpi' | 'appsScript';
  monitoringSubTab: 'drawingProjects' | 'standartPartHandover';
  userRole: UserRole;
  activeStaffName?: string;
  pendingApprovalCount?: number;
  onSelectMonitoring: () => void;
  onSelectStandartPart: () => void;
  onSelectBarcodes: () => void;
  onSelectKPI: () => void;
  onSelectAppsScript: () => void;
  onOpenRolePicker: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  monitoringSubTab,
  userRole,
  activeStaffName,
  pendingApprovalCount = 0,
  onSelectMonitoring,
  onSelectStandartPart,
  onSelectBarcodes,
  onSelectKPI,
  onSelectAppsScript,
  onOpenRolePicker
}) => {
  const isDrawingActive = currentView === 'monitoring' && monitoringSubTab === 'drawingProjects';
  const isStandartPartActive = currentView === 'monitoring' && monitoringSubTab === 'standartPartHandover';
  const isBarcodeActive = currentView === 'barcodes';
  const isKpiActive = currentView === 'kpi';
  const isGasActive = currentView === 'appsScript';

  const shortRole = activeStaffName
    ? activeStaffName.split(' ')[0]
    : userRole === 'Manager'
    ? 'Manager'
    : userRole === 'Supervisor'
    ? 'Spv'
    : userRole === 'Lead'
    ? 'Lead'
    : userRole === 'Designer'
    ? 'Designer'
    : userRole === 'Drafter'
    ? 'Drafter'
    : 'Viewer';

  const triggerHapticFeedback = (durationMs = 12) => {
    try {
      if (
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      ) {
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(durationMs);
      }
    } catch {
      // Ignore vibration errors in unsupported or restricted browser contexts
    }
  };

  const handleNavClick = (callback: () => void, isAlreadyActive = false) => {
    triggerHapticFeedback(isAlreadyActive ? 8 : 14);
    callback();
  };

  return (
    <nav
      aria-label="Navigasi Utama Mobile"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 theme-header-bg backdrop-blur-xl border-t border-white/15 shadow-[0_-8px_24px_rgba(10,15,44,0.35)] pb-safe"
    >
      <div className="grid grid-cols-5 gap-1 px-1 pt-1.5">
        <button
          type="button"
          onClick={() => handleNavClick(onSelectMonitoring, isDrawingActive)}
          className={`min-h-[46px] rounded-xl border border-transparent flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
            isDrawingActive
              ? 'theme-mobile-nav-active shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Table2 className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full px-0.5">Drawing</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick(onSelectStandartPart, isStandartPartActive)}
          className={`min-h-[46px] rounded-xl border border-transparent flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
            isStandartPartActive
              ? 'theme-mobile-nav-active shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <PackageCheck className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full px-0.5">Std Part</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick(onSelectBarcodes, isBarcodeActive)}
          className={`min-h-[46px] rounded-xl border border-transparent flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
            isBarcodeActive
              ? 'theme-mobile-nav-active shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <QrCode className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full px-0.5">Barcode</span>
        </button>

        <button
          type="button"
          onClick={() => handleNavClick(onSelectKPI, isKpiActive)}
          className={`relative min-h-[46px] rounded-xl border border-transparent flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
            isKpiActive
              ? 'theme-mobile-nav-active shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full px-0.5">KPI CDR</span>
          {pendingApprovalCount > 0 && (
            <span className="absolute top-1 right-1.5 px-1.5 min-w-[16px] h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center leading-none shadow">
              {pendingApprovalCount}
            </span>
          )}
        </button>

        {userRole === 'Manager' ? (
          <button
            type="button"
            onClick={() => handleNavClick(onSelectAppsScript, isGasActive)}
            className={`min-h-[46px] rounded-xl border border-transparent flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              isGasActive
                ? 'theme-mobile-nav-active shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileCode2 className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full px-0.5">Code.gs</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => handleNavClick(onOpenRolePicker, false)}
            className="min-h-[46px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-slate-200 hover:text-white transition-all active:scale-95"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate max-w-full px-0.5">{shortRole}</span>
          </button>
        )}
      </div>
    </nav>
  );
};
