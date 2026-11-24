import React, { useState, useEffect, useRef } from 'react';
import { UserRole } from '../types/engineering';
import { MASTER_PIN, ROLE_PINS } from '../data/initialData';
import { 
  Compass, 
  BarChart3, 
  Table2, 
  FileCode2, 
  Clock, 
  ShieldCheck, 
  KeyRound, 
  Camera, 
  CheckCircle2, 
  AlertCircle,
  Flame
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  currentView: 'monitoring' | 'kpi' | 'appsScript';
  onViewChange: (view: 'monitoring' | 'kpi' | 'appsScript') => void;
  userRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  logoUrl: string | null;
  onLogoChange: (url: string) => void;
  onOpenFirebaseModal?: () => void;
  onOpenVercelModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  userRole,
  onRoleChange,
  logoUrl,
  onLogoChange,
  onOpenFirebaseModal,
  onOpenVercelModal
}) => {
  const [timeString, setTimeString] = useState<string>('');
  const [showRoleModal, setShowRoleModal] = useState<boolean>(false);
  const [pendingRole, setPendingRole] = useState<UserRole>('Viewer');
  const [enteredPin, setEnteredPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <header className="bg-gradient-to-r from-[#0a0f2c] via-[#16204a] to-[#1a1446] text-white shadow-lg shadow-indigo-950/20 sticky top-0 z-50 border-b border-indigo-400/20">
      <div className="h-0.5 w-full bg-gradient-to-r from-cyan-400 via-indigo-500 via-fuchsia-500 to-emerald-400" />
      <div className="max-w-[99%] mx-auto px-4 py-2.5 flex flex-wrap justify-between items-center gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 p-2.5 rounded-xl text-white shadow-lg shadow-cyan-500/20 cursor-pointer relative group transition-transform active:scale-95 flex items-center justify-center shrink-0"
            title="Klik untuk upload logo kustom dashboard"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="App Logo" className="w-7 h-7 object-cover rounded-lg" />
            ) : (
              <Compass className="w-6 h-6" />
            )}
            <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
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
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-indigo-200 bg-clip-text text-transparent leading-tight">
                Monitoring Design & Drawing Engineering
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 items-center">
                Live Cloud
              </span>
            </div>
            <p className="text-[11px] text-indigo-200/75">
              Industrial Engineering Cloud System • Google Firebase Firestore & Sheets Integrated
            </p>
          </div>
        </div>

        {/* View Switchers & Role Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Buttons */}
          <div className="flex items-center bg-slate-950/50 p-1 rounded-xl border border-indigo-400/20 shadow-inner backdrop-blur-sm">
            <button
              onClick={() => onViewChange('monitoring')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'monitoring'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-blue-500/30'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Monitoring Drawing</span>
            </button>
            <button
              onClick={() => onViewChange('kpi')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                currentView === 'kpi'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30'
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
                    ? 'bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white shadow-md shadow-violet-500/30'
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

      {/* Role Verification PIN Modal */}
      {showRoleModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-white space-y-4">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <p className="mt-1.5 text-[11px] text-slate-400">
                  Masukkan PIN otentikasi resmi untuk mengaktifkan akses role {pendingRole}.
                </p>
              </div>

              {pinError && (
                <div className="p-2 bg-rose-500/20 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{pinError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRoleModal(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-xl transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-xl shadow transition"
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
