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

interface HeaderProps {
  currentView: 'monitoring' | 'kpi' | 'appsScript';
  onViewChange: (view: 'monitoring' | 'kpi' | 'appsScript') => void;
  userRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  logoUrl: string | null;
  onLogoChange: (url: string) => void;
  onOpenFirebaseModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onViewChange,
  userRole,
  onRoleChange,
  logoUrl,
  onLogoChange,
  onOpenFirebaseModal
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
    <header className="bg-slate-900 text-white shadow-md sticky top-0 z-50 border-b border-slate-800">
      <div className="max-w-[99%] mx-auto px-4 py-2.5 flex flex-wrap justify-between items-center gap-3">
        {/* Brand & Logo */}
        <div className="flex items-center space-x-3">
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-500 p-2.5 rounded-xl text-white shadow-lg cursor-pointer relative group transition-transform active:scale-95 flex items-center justify-center"
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
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white leading-tight">
                Monitoring Design & Drawing Engineering
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Live Cloud</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Industrial Engineering Cloud System • Google Firebase Firestore & Sheets Integrated
            </p>
          </div>
        </div>

        {/* View Switchers & Role Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Buttons */}
          <div className="flex items-center bg-slate-800/80 p-1 rounded-xl border border-slate-700/60 shadow-inner">
            <button
              onClick={() => onViewChange('monitoring')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                currentView === 'monitoring'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <Table2 className="w-3.5 h-3.5" />
              <span>Monitoring Drawing</span>
            </button>
            <button
              onClick={() => onViewChange('kpi')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                currentView === 'kpi'
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Dashboard KPI CDR</span>
              {userRole === 'Viewer' && (
                <span className="text-[9px] bg-slate-700/70 text-slate-300 px-1.5 py-0.2 rounded font-normal">View-Only</span>
              )}
            </button>
            <button
              onClick={() => onViewChange('appsScript')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                currentView === 'appsScript'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
              }`}
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Code.gs & Index.html</span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold bg-amber-400 text-slate-950 rounded">
                GAS
              </span>
            </button>
          </div>

          {/* Firebase Console Status & Config Button */}
          {onOpenFirebaseModal && (
            <button
              onClick={onOpenFirebaseModal}
              title="Buka Konfigurasi & Status Google Firebase Console"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 text-amber-300 border border-amber-500/30 shadow-sm"
            >
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Firebase Console</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </button>
          )}

          {/* Clock */}
          <div className="hidden xl:flex items-center space-x-1.5 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/70 text-xs text-slate-300">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span className="font-mono text-[11px]">{timeString || 'Memuat waktu...'}</span>
          </div>

          {/* Role Switcher */}
          <div className="flex items-center space-x-2 bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/70">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[11px] text-slate-400">Role:</span>
            <select
              value={userRole}
              onChange={(e) => handleRoleSelectChange(e.target.value as UserRole)}
              className="bg-transparent text-xs text-blue-400 font-bold focus:outline-none cursor-pointer"
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
                <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                  <span>PIN default {pendingRole}: <strong className="text-blue-400">{ROLE_PINS[pendingRole]}</strong></span>
                  <span>Master: <strong className="text-amber-400">{MASTER_PIN}</strong></span>
                </div>
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
