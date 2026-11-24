import React, { useState, useEffect, useRef } from 'react';
import { UserRole } from '../types/engineering';
import { MASTER_PIN, ROLE_PINS } from '../data/initialData';
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
  Palette
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';
import { MonitoringLogo } from './MonitoringLogo';

interface HeaderProps {
  currentView: 'monitoring' | 'barcodes' | 'kpi' | 'appsScript';
  onViewChange: (view: 'monitoring' | 'barcodes' | 'kpi' | 'appsScript') => void;
  userRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  logoUrl: string | null;
  onLogoChange: (url: string) => void;
  onOpenFirebaseModal?: () => void;
  onOpenVercelModal?: () => void;
  onOpenThemeModal?: () => void;
  externalRolePickerOpen?: boolean;
  onCloseExternalRolePicker?: () => void;
}

const ROLE_OPTIONS: { value: UserRole; label: string; desc: string }[] = [
  { value: 'Manager', label: 'Manager Engineering', desc: 'Akses penuh, persetujuan KPI & hapus data' },
  { value: 'Supervisor', label: 'Supervisor Engineering', desc: 'Monitoring & pengajuan edit KPI (butuh approval)' },
  { value: 'Lead', label: 'Lead Engineer', desc: 'Edit data proyek & checklist monitoring' },
  { value: 'Drafter', label: 'Drafter / Designer', desc: 'Update proyek, upload CAD/PDF & checklist' },
  { value: 'Viewer', label: 'Viewer (Read-Only)', desc: 'Hanya melihat dashboard tanpa mengubah data' }
];

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  userRole,
  onRoleChange,
  logoUrl,
  onLogoChange,
  onOpenFirebaseModal,
  onOpenVercelModal,
  onOpenThemeModal,
  externalRolePickerOpen = false,
  onCloseExternalRolePicker
}) => {
  const [timeString, setTimeString] = useState<string>('');
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [showMobileRoleSheet, setShowMobileRoleSheet] = useState<boolean>(false);
  const [showMobileTools, setShowMobileTools] = useState<boolean>(false);
  const [pendingRole, setPendingRole] = useState<UserRole>('Viewer');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (externalRolePickerOpen) {
      setShowMobileRoleSheet(true);
    }
  }, [externalRolePickerOpen]);

  const closeMobileRoleSheet = () => {
    setShowMobileRoleSheet(false);
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

  const handleRoleSelectChange = (newRole: UserRole) => {
    closeMobileRoleSheet();
    if (newRole === userRole) return;
    if (newRole === 'Viewer') {
      onRoleChange('Viewer');
      return;
    }
    setPendingRole(newRole);
    setEnteredPin('');
    setPinError('');
    setShowRoleModal(true);
  };

  const handleVerifyRolePin = (e: React.FormEvent) => {
    e.preventDefault();
    const expectedPin = ROLE_PINS[pendingRole] || MASTER_PIN;
    if (enteredPin === expectedPin || enteredPin === MASTER_PIN) {
      onRoleChange(pendingRole);
      setShowRoleModal(false);
      setPinError('');
    } else {
      setPinError(`PIN salah! Masukkan PIN otentikasi role ${pendingRole}.`);
    }
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

  const shortRoleLabel =
    userRole === 'Manager'
      ? 'Manager'
      : userRole === 'Supervisor'
      ? 'Supervisor'
      : userRole === 'Lead'
      ? 'Lead'
      : userRole === 'Drafter'
      ? 'Drafter'
      : 'Viewer';

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

          <button
            type="button"
            onClick={() => setShowMobileRoleSheet(true)}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-slate-950/70 border border-white/25 text-white text-[11px] font-bold flex items-center gap-1.5 active:scale-95 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="max-w-[70px] truncate">{shortRoleLabel}</span>
          </button>

          {userRole === 'Manager' && (onOpenFirebaseModal || onOpenVercelModal) && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMobileTools((v) => !v)}
                aria-label="Menu Cloud & Deploy"
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
                  <div className="absolute right-0 top-11 z-50 w-52 bg-slate-900 border border-indigo-400/30 rounded-2xl shadow-2xl p-1.5 space-y-1">
                    {onOpenFirebaseModal && (
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
                    {onOpenVercelModal && (
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

          {/* Role Switcher */}
          <div className="flex items-center space-x-2 bg-gradient-to-r from-indigo-950/80 to-slate-900/90 px-3 py-1.5 rounded-xl border border-cyan-400/30 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-indigo-200">Role:</span>
            <select
              value={userRole}
              onChange={(e) => handleRoleSelectChange(e.target.value as UserRole)}
              className="bg-transparent text-xs text-cyan-300 font-bold focus:outline-none cursor-pointer"
            >
              <option value="Manager" className="bg-slate-900 text-white">Manager Engineering</option>
              <option value="Supervisor" className="bg-slate-900 text-white">Supervisor Engineering</option>
              <option value="Lead" className="bg-slate-900 text-white">Lead Engineer</option>
              <option value="Drafter" className="bg-slate-900 text-white">Drafter / Designer</option>
              <option value="Viewer" className="bg-slate-900 text-white">Viewer (Read-Only)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Mobile Role Picker Bottom Sheet */}
      {showMobileRoleSheet && (
        <div className="fixed inset-0 bg-slate-950/80 z-[130] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border-t sm:border border-indigo-400/30 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md text-white overflow-hidden pb-safe">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-emerald-500/20 border border-emerald-400/30 rounded-xl">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold">Pilih Role Pengguna</h3>
                  <p className="text-[11px] text-slate-400">Tentukan hak akses di aplikasi</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeMobileRoleSheet}
                className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-3 space-y-2 max-h-[70dvh] overflow-y-auto">
              {ROLE_OPTIONS.map((opt) => {
                const active = userRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleRoleSelectChange(opt.value)}
                    className={`w-full min-h-[54px] px-4 py-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition active:scale-[0.99] ${
                      active
                        ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/25 border-cyan-400/50 text-white'
                        : 'bg-slate-950/60 border-slate-800 text-slate-200 hover:bg-slate-800/80'
                    }`}
                  >
                    <div>
                      <p className="text-xs font-extrabold">{opt.label}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                    {active && <Check className="w-5 h-5 text-cyan-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Role Verification PIN Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-sm p-5 sm:p-6 text-white space-y-4 pb-safe">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-blue-600 rounded-xl text-white">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Verifikasi Akses Role</h3>
                <p className="text-xs text-slate-400">Beralih ke: <span className="text-blue-400 font-semibold">{pendingRole}</span></p>
              </div>
            </div>

            <form onSubmit={handleVerifyRolePin} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Masukkan PIN Akses {pendingRole}
                </label>
                <input
                  type="password"
                  value={enteredPin}
                  onChange={(e) => {
                    setEnteredPin(e.target.value);
                    setPinError('');
                  }}
                  autoFocus
                  required
                  placeholder={`PIN rahasia...`}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-3 text-base sm:text-xs text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Masukkan PIN otentikasi resmi untuk mengaktifkan akses role {pendingRole}.
                </p>
              </div>

              {pinError && (
                <div className="p-2.5 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="min-h-[44px] px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow transition"
                >
                  Verifikasi Role
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>
  );
};
