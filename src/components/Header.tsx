import React, { useState, useEffect, useRef } from 'react';
import { ActiveSessionPresence, StaffAccount, UserRole } from '../types/engineering';
import { MASTER_PIN } from '../data/initialData';
import { 
  BarChart3, 
  Table2, 
  FileCode2, 
  Clock, 
  ShieldCheck, 
  KeyRound, 
  Camera, 
  AlertCircle,
  Flame,
  MoreVertical,
  X,
  Check,
  QrCode,
  Palette,
  Users,
  History,
  Eye,
  EyeOff,
  LogOut,
  ChevronDown,
  Activity
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { MonitoringLogo } from './MonitoringLogo';

interface HeaderProps {
  currentView: 'monitoring' | 'barcodes' | 'kpi' | 'appsScript';
  onViewChange: (view: 'monitoring' | 'barcodes' | 'kpi' | 'appsScript') => void;
  userRole: UserRole;
  activeStaff: StaffAccount | null;
  staffAccounts: StaffAccount[];
  onStaffLogin: (staff: StaffAccount) => void;
  onLogoutToViewer: () => void;
  logoUrl: string | null;
  onLogoChange: (url: string) => void;
  onOpenFirebaseModal?: () => void;
  onOpenVercelModal?: () => void;
  onOpenThemeModal?: () => void;
  onOpenStaffPinModal?: (tab: 'staff' | 'audit' | 'online') => void;
  onlineSessions?: ActiveSessionPresence[];
  externalRolePickerOpen?: boolean;
  onCloseExternalRolePicker?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  userRole,
  activeStaff,
  staffAccounts,
  onStaffLogin,
  onLogoutToViewer,
  logoUrl,
  onLogoChange,
  onOpenFirebaseModal,
  onOpenVercelModal,
  onOpenThemeModal,
  onOpenStaffPinModal,
  onlineSessions = [],
  externalRolePickerOpen = false,
  onCloseExternalRolePicker
}) => {
  const loggedInOnlineCount = onlineSessions.filter((s) => s.role !== 'Viewer').length;
  const editingOnlineCount = onlineSessions.filter((s) => s.status === 'editing').length;
  const [timeString, setTimeString] = useState<string>('');
  const [showAccountModal, setShowAccountModal] = useState<boolean>(false);
  const [showMobileTools, setShowMobileTools] = useState<boolean>(false);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [showTypedPin, setShowTypedPin] = useState<boolean>(false);
  const [pinError, setPinError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeStaffOptions = React.useMemo(
    () => staffAccounts.filter((s) => s.isActive),
    [staffAccounts]
  );

  const openAccountModal = () => {
    setEnteredPin('');
    setPinError('');
    setShowTypedPin(false);
    setSelectedStaffId((prev) => {
      if (prev && activeStaffOptions.some((s) => s.id === prev)) return prev;
      return activeStaff?.id || activeStaffOptions[0]?.id || '';
    });
    setShowAccountModal(true);
  };

  useEffect(() => {
    if (externalRolePickerOpen) {
      openAccountModal();
    }
  }, [externalRolePickerOpen]);

  const closeAccountModal = () => {
    setShowAccountModal(false);
    if (onCloseExternalRolePicker) onCloseExternalRolePicker();
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
      const str = `${days[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} • ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')} WIB`;
      setTimeString(str);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const selectedStaffObj = activeStaffOptions.find((s) => s.id === selectedStaffId) || null;

  const handleVerifyStaffPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffObj) {
      setPinError('Pilih nama staff terlebih dahulu.');
      return;
    }
    const cleanPin = enteredPin.trim();
    const isMatch =
      cleanPin === selectedStaffObj.pin ||
      (selectedStaffObj.role === 'Manager' && cleanPin === MASTER_PIN);

    if (isMatch) {
      onStaffLogin(selectedStaffObj);
      setEnteredPin('');
      setPinError('');
      closeAccountModal();
    } else {
      setPinError(`PIN salah untuk akun ${selectedStaffObj.name}. Hubungi Manager jika lupa PIN.`);
    }
  };

  const handleSwitchToViewer = () => {
    onLogoutToViewer();
    setEnteredPin('');
    setPinError('');
    closeAccountModal();
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onLogoChange(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const shortActorLabel = activeStaff
    ? activeStaff.name
    : userRole === 'Viewer'
    ? 'Viewer'
    : userRole;

  return (
    <header className="theme-header-bg text-white shadow-lg shadow-slate-950/20 sticky top-0 z-50 border-b border-white/15">
      <div className="h-0.5 w-full theme-accent-line" />
      <div className="max-w-[99%] mx-auto px-3 sm:px-4 py-1.5 sm:py-2.5 flex justify-between items-center gap-2 sm:gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className={`${
              logoUrl
                ? 'bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 p-1'
                : 'bg-white/95 hover:bg-white p-0.5 sm:p-1 border border-emerald-200/70'
            } rounded-xl shadow-lg shadow-emerald-500/20 cursor-pointer relative group transition-transform active:scale-95 flex items-center justify-center shrink-0`}
            title="Klik untuk upload logo kustom dashboard"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="App Logo" className="w-8 h-8 object-cover rounded-lg" />
            ) : (
              <MonitoringLogo className="w-8 h-8 sm:w-9 sm:h-9" />
            )}
            <div className="absolute inset-0 bg-black/45 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
              <Camera className="w-3.5 h-3.5 text-white" />
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleLogoUpload}
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <h1 className="text-sm sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-indigo-200 bg-clip-text text-transparent leading-tight truncate">
                <span className="sm:hidden">Monitoring Engineering</span>
                <span className="hidden sm:inline">Monitoring Design & Drawing Engineering</span>
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 items-center shrink-0">
                Live Cloud
              </span>
            </div>
            <p className="hidden md:block text-[11px] text-indigo-200/75 truncate">
              Industrial Engineering Cloud System • Google Firebase Firestore & Sheets Integrated
            </p>
          </div>
        </div>

        {/* Mobile Compact Right Controls (< md) */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          <PWAInstallButton compactMobile />

          {onOpenThemeModal && (
            <button
              type="button"
              onClick={onOpenThemeModal}
              aria-label="Pengaturan Tema Warna"
              title="Pengaturan Tema Warna"
              className="min-w-[38px] min-h-[38px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center justify-center active:scale-95 transition"
            >
              <Palette className="w-4 h-4" />
            </button>
          )}

          {userRole === 'Manager' && onOpenStaffPinModal && (
            <button
              type="button"
              onClick={() => onOpenStaffPinModal('online')}
              aria-label="Lihat Staff Online & Sedang Edit"
              title={`Staff Login Online: ${loggedInOnlineCount}${editingOnlineCount > 0 ? ` (${editingOnlineCount} Sedang Edit)` : ''}`}
              className="min-h-[38px] px-2 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
            >
              <span className={`w-2 h-2 rounded-full ${editingOnlineCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'} animate-pulse shrink-0`} />
              <span className="tabular-nums">{loggedInOnlineCount}</span>
            </button>
          )}

          <button
            type="button"
            onClick={openAccountModal}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-white/25 text-white text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="max-w-[82px] truncate">{shortActorLabel}</span>
          </button>

          {userRole !== 'Viewer' &&
            (onOpenStaffPinModal || onOpenFirebaseModal || onOpenVercelModal) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMobileTools((v) => !v)}
                aria-label="Menu Staff, Audit & Cloud"
                className="min-w-[38px] min-h-[38px] rounded-xl bg-slate-900/90 border border-indigo-400/30 text-slate-200 flex items-center justify-center active:scale-95 transition"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {showMobileTools && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowMobileTools(false)}
                  />
                  <div className="absolute right-0 top-11 z-50 w-60 bg-slate-900 border border-indigo-400/30 rounded-2xl shadow-2xl p-1.5 space-y-1">
                    {userRole === 'Manager' && onOpenStaffPinModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileTools(false);
                          onOpenStaffPinModal('online');
                        }}
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-xs font-bold text-cyan-200 hover:bg-white/10 flex items-center justify-between gap-2"
                      >
                        <span className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-emerald-400" />
                          <span>Staff Online ({loggedInOnlineCount})</span>
                        </span>
                        {editingOnlineCount > 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[10px]">
                            {editingOnlineCount} Edit
                          </span>
                        )}
                      </button>
                    )}
                    {userRole === 'Manager' && onOpenStaffPinModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileTools(false);
                          onOpenStaffPinModal('staff');
                        }}
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-xs font-bold text-emerald-200 hover:bg-white/10 flex items-center gap-2"
                      >
                        <Users className="w-4 h-4 text-emerald-400" />
                        <span>Kelola Staff & PIN</span>
                      </button>
                    )}
                    {onOpenStaffPinModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileTools(false);
                          onOpenStaffPinModal('audit');
                        }}
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-xs font-bold text-indigo-200 hover:bg-white/10 flex items-center gap-2"
                      >
                        <History className="w-4 h-4 text-indigo-400" />
                        <span>Jejak Audit Input</span>
                      </button>
                    )}
                    {userRole === 'Manager' && onOpenFirebaseModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileTools(false);
                          onOpenFirebaseModal();
                        }}
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-xs font-bold text-amber-200 hover:bg-white/10 flex items-center gap-2"
                      >
                        <Flame className="w-4 h-4 text-amber-400" />
                        <span>Firebase Console</span>
                      </button>
                    )}
                    {userRole === 'Manager' && onOpenVercelModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setShowMobileTools(false);
                          onOpenVercelModal();
                        }}
                        className="w-full min-h-[42px] px-3 py-2 rounded-xl text-left text-xs font-bold text-cyan-200 hover:bg-white/10 flex items-center gap-2"
                      >
                        <svg viewBox="0 0 76 65" className="w-3.5 h-3.5 fill-current text-cyan-300">
                          <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
                        </svg>
                        <span>Deploy Vercel</span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Desktop View Switchers & Role Controls (md+) */}
        <div className="hidden md:flex flex-wrap items-center gap-2">
          {/* View Buttons */}
          <div className="flex items-center bg-slate-950/50 p-1 rounded-xl border border-white/15 shadow-inner backdrop-blur-sm">
            <button
              onClick={() => onViewChange('monitoring')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'monitoring'
                  ? 'theme-tab-active'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Monitoring Drawing</span>
            </button>
            <button
              onClick={() => onViewChange('barcodes')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'barcodes'
                  ? 'theme-tab-active'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>Barcode Kastamer</span>
            </button>
            <button
              onClick={() => onViewChange('kpi')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'kpi'
                  ? 'theme-tab-active'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Dashboard KPI CDR</span>
              {userRole === 'Viewer' && (
                <span className="text-[9px] bg-white/15 text-slate-200 px-1.5 py-0.2 rounded font-medium">View-Only</span>
              )}
            </button>
            {userRole === 'Manager' && (
              <button
                onClick={() => onViewChange('appsScript')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  currentView === 'appsScript'
                    ? 'theme-tab-active'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
              >
                <FileCode2 className="w-3.5 h-3.5" />
                <span>Code.gs & Index.html</span>
                <span className="px-1.5 py-0.2 text-[9px] font-extrabold bg-amber-400 text-slate-950 rounded">
                  GAS
                </span>
              </button>
            )}
          </div>

          {/* Theme Color Customization Button */}
          {onOpenThemeModal && (
            <button
              type="button"
              onClick={onOpenThemeModal}
              title="Ubah Warna Tema Utama Aplikasi"
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Tema</span>
            </button>
          )}

          {/* Manager Staff Online & Editing Monitor Button */}
          {userRole === 'Manager' && onOpenStaffPinModal && (
            <button
              type="button"
              onClick={() => onOpenStaffPinModal('online')}
              title={`Pantau staff yang sedang online (${loggedInOnlineCount} login, ${onlineSessions.length} total sesi${editingOnlineCount > 0 ? `, ${editingOnlineCount} sedang edit` : ''})`}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all border shadow-sm cursor-pointer whitespace-nowrap ${
                editingOnlineCount > 0
                  ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 border-amber-400/45'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-100 border-emerald-400/40'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  editingOnlineCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'
                }`}
              />
              <Activity className="w-3.5 h-3.5 text-emerald-300" />
              <span>Online ({loggedInOnlineCount})</span>
              {editingOnlineCount > 0 && (
                <span className="px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 text-[10px] font-extrabold">
                  {editingOnlineCount} Edit
                </span>
              )}
            </button>
          )}

          {/* Manager Staff & PIN Button */}
          {userRole === 'Manager' && onOpenStaffPinModal && (
            <button
              type="button"
              onClick={() => onOpenStaffPinModal('staff')}
              title="Lihat PIN Staff, Buat Ulang PIN & Kelola Akun Staff"
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-400/35 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5 text-emerald-300" />
              <span>Staff & PIN</span>
            </button>
          )}

          {/* Audit Log Button (Visible for active logged-in staff & Manager) */}
          {userRole !== 'Viewer' && onOpenStaffPinModal && (
            <button
              type="button"
              onClick={() => onOpenStaffPinModal('audit')}
              title="Lihat Riwayat & Jejak Audit Input Staff"
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <History className="w-3.5 h-3.5 text-cyan-300" />
              <span>Audit Log</span>
            </button>
          )}

          {/* PWA Install App Button (PC & Mobile) */}
          <PWAInstallButton />

          {/* Firebase Console Status & Config Button (Manager Only) */}
          {userRole === 'Manager' && onOpenFirebaseModal && (
            <button
              onClick={onOpenFirebaseModal}
              title="Buka Konfigurasi & Status Google Firebase Console"
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all bg-gradient-to-r from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-200 border border-amber-400/35 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Firebase</span>
            </button>
          )}

          {/* Vercel Deploy & Online Button (Manager Only) */}
          {userRole === 'Manager' && onOpenVercelModal && (
            <button
              onClick={onOpenVercelModal}
              title="Konfigurasi & Panduan Deploy ke Vercel (vercel.app)"
              className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all bg-gradient-to-r from-slate-800/90 to-indigo-950/90 hover:from-slate-700 hover:to-indigo-900 text-white border border-indigo-400/30 shadow-sm cursor-pointer whitespace-nowrap"
            >
              <svg viewBox="0 0 76 65" className="w-3 h-3 fill-current text-cyan-300">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
              <span>Vercel</span>
              <span className="text-[9px] bg-indigo-500/40 text-cyan-200 px-1.5 rounded font-mono">App</span>
            </button>
          )}

          {/* Clock */}
          <div className="hidden xl:flex items-center space-x-1.5 bg-slate-950/50 px-3 py-1.5 rounded-xl border border-indigo-400/20 text-xs text-cyan-100">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-[11px] tabular-nums">{timeString || 'Memuat waktu...'}</span>
          </div>

          {/* Active Staff & Role Switcher Button */}
          <button
            type="button"
            onClick={openAccountModal}
            title="Pilih Akun Staff & Masukkan PIN Pribadi"
            className="flex items-center space-x-2 bg-gradient-to-r from-indigo-950/85 to-slate-900/95 hover:from-indigo-900 hover:to-slate-800 px-3 py-1.5 rounded-xl border border-cyan-400/35 shadow-sm cursor-pointer transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <div className="text-left leading-tight">
              <span className="text-[10px] text-indigo-200 block">
                {activeStaff ? 'Operator Aktif:' : 'Mode Akses:'}
              </span>
              <span className="text-xs text-cyan-300 font-bold">
                {activeStaff ? `${activeStaff.name} (${activeStaff.role})` : 'Viewer (Read-Only)'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
          </button>
        </div>
      </div>

      {/* Unified Staff Account & PIN Login Modal (Desktop & Mobile) */}
      {showAccountModal && (
        <div
          className="fixed inset-0 bg-slate-950/80 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={closeAccountModal}
        >
          <div
            className="bg-slate-900 border-t sm:border border-indigo-400/30 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md text-white overflow-hidden flex flex-col max-h-[90dvh] pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 bg-blue-600 rounded-xl text-white">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Login Staff & Verifikasi PIN</h3>
                  <p className="text-[11px] text-slate-400">
                    Setiap perubahan data dicatat atas nama staff yang login
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeAccountModal}
                className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
              {/* Quick Mode Viewer Switch */}
              <button
                type="button"
                onClick={handleSwitchToViewer}
                className={`w-full min-h-[46px] px-4 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition ${
                  userRole === 'Viewer'
                    ? 'bg-emerald-500/20 border-emerald-400/50 text-white'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <LogOut className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-xs font-bold">Mode Viewer (Hanya Lihat / Keluar Edit)</p>
                    <p className="text-[10px] text-slate-400">
                      Kunci form agar aman dari sentuhan atau salah input tidak sengaja
                    </p>
                  </div>
                </div>
                {userRole === 'Viewer' && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              </button>

              {/* Staff Account Selection & Personal PIN Form */}
              <form onSubmit={handleVerifyStaffPin} className="space-y-3 pt-1 border-t border-slate-800">
                <div>
                  <label className="block text-xs font-bold text-slate-200 mb-1.5">
                    1. Pilih Nama Akun Staff
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                    {activeStaffOptions.map((stf) => {
                      const isPicked = selectedStaffId === stf.id;
                      return (
                        <button
                          key={stf.id}
                          type="button"
                          onClick={() => {
                            setSelectedStaffId(stf.id);
                            setPinError('');
                          }}
                          className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition ${
                            isPicked
                              ? 'bg-indigo-600/30 border-cyan-400/70 text-white'
                              : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                              {stf.name.slice(0, 2).toUpperCase()}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-bold truncate">{stf.name}</p>
                              <p className="text-[10px] text-cyan-300 font-semibold">{stf.role}</p>
                            </div>
                          </div>
                          {isPicked && <Check className="w-4 h-4 text-cyan-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedStaffObj && (
                  <div>
                    <label className="block text-xs font-bold text-slate-200 mb-1.5">
                      2. Masukkan PIN Pribadi{' '}
                      <span className="text-cyan-300">
                        {selectedStaffObj.name} ({selectedStaffObj.role})
                      </span>
                    </label>
                    <div className="relative">
                      <input
                        type={showTypedPin ? 'text' : 'password'}
                        value={enteredPin}
                        onChange={(e) => {
                          setEnteredPin(e.target.value);
                          setPinError('');
                        }}
                        autoFocus
                        required
                        placeholder="Masukkan PIN pribadi..."
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3.5 pr-11 py-3 text-base sm:text-xs font-mono text-white focus:ring-2 focus:ring-cyan-400 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowTypedPin((v) => !v)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-white"
                        aria-label={showTypedPin ? 'Sembunyikan PIN' : 'Lihat PIN'}
                      >
                        {showTypedPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                )}

                {pinError && (
                  <div className="p-2.5 bg-rose-500/20 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center space-x-1.5">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{pinError}</span>
                  </div>
                )}

                <div className="flex justify-end space-x-2 pt-2">
                  <button
                    type="button"
                    onClick={closeAccountModal}
                    className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={!selectedStaffObj}
                    className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition"
                  >
                    Masuk & Aktifkan Akun
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
