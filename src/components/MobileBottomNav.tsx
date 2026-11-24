import React from 'react';
import { Table2, PackageCheck, BarChart3, FileCode2, ShieldCheck } from 'lucide-react';
import { UserRole } from '../types/engineering';

interface MobileBottomNavProps {
  currentView: 'monitoring' | 'kpi' | 'appsScript';
  monitoringSubTab: 'drawingProjects' | 'standartPartHandover';
  userRole: UserRole;
  pendingApprovalCount?: number;
  onSelectMonitoring: () => void;
  onSelectStandartPart: () => void;
  onSelectKPI: () => void;
  onSelectAppsScript: () => void;
  onOpenRolePicker: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  currentView,
  monitoringSubTab,
  userRole,
  pendingApprovalCount = 0,
  onSelectMonitoring,
  onSelectStandartPart,
  onSelectKPI,
  onSelectAppsScript,
  onOpenRolePicker
}) => {
  const isDrawingActive = currentView === 'monitoring' && monitoringSubTab === 'drawingProjects';
  const isStandartPartActive = currentView === 'monitoring' && monitoringSubTab === 'standartPartHandover';
  const isKpiActive = currentView === 'kpi';
  const isGasActive = currentView === 'appsScript';

  const shortRole =
    userRole === 'Manager'
      ? 'Manager'
      : userRole === 'Supervisor'
      ? 'Spv'
      : userRole === 'Lead'
      ? 'Lead'
      : userRole === 'Drafter'
      ? 'Drafter'
      : 'Viewer';

  return (
    <nav
      aria-label="Navigasi Utama Mobile"
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0b1230]/95 backdrop-blur-xl border-t border-indigo-400/25 shadow-[0_-8px_24px_rgba(10,15,44,0.35)] pb-safe"
    >
      <div className="grid grid-cols-4 gap-1 px-1.5 pt-1.5">
        <button
          type="button"
          onClick={onSelectMonitoring}
          className={`min-h-[46px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
            isDrawingActive
              ? 'bg-gradient-to-b from-cyan-500/25 to-blue-600/30 text-cyan-300 border border-cyan-400/35 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <Table2 className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full px-1">Drawing</span>
        </button>

        <button
          type="button"
          onClick={onSelectStandartPart}
          className={`min-h-[46px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
            isStandartPartActive
              ? 'bg-gradient-to-b from-indigo-500/30 to-violet-600/30 text-indigo-200 border border-indigo-400/35 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <PackageCheck className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full px-1">Std Part</span>
        </button>

        <button
          type="button"
          onClick={onSelectKPI}
          className={`relative min-h-[46px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
            isKpiActive
              ? 'bg-gradient-to-b from-emerald-500/25 to-teal-600/30 text-emerald-300 border border-emerald-400/35 shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          <BarChart3 className="w-4 h-4 shrink-0" />
          <span className="truncate max-w-full px-1">KPI CDR</span>
          {pendingApprovalCount > 0 && (
            <span className="absolute top-1 right-2.5 px-1.5 min-w-[16px] h-4 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black flex items-center justify-center leading-none shadow">
              {pendingApprovalCount}
            </span>
          )}
        </button>

        {userRole === 'Manager' ? (
          <button
            type="button"
            onClick={onSelectAppsScript}
            className={`min-h-[46px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold transition-all active:scale-95 ${
              isGasActive
                ? 'bg-gradient-to-b from-fuchsia-500/25 to-violet-600/30 text-fuchsia-200 border border-fuchsia-400/35 shadow-sm'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileCode2 className="w-4 h-4 shrink-0" />
            <span className="truncate max-w-full px-1">Code.gs</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenRolePicker}
            className="min-h-[46px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-cyan-200 hover:text-white transition-all active:scale-95"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="truncate max-w-full px-1">{shortRole}</span>
          </button>
        )}
      </div>
    </nav>
  );
};
