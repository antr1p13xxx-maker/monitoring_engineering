import React, { useState } from 'react';
import { MASTER_PIN } from '../data/initialData';
import { Lock, KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';

interface AuthGateModalProps {
  isOpen: boolean;
  onAuthenticated: () => void;
}

export const AuthGateModal: React.FC<AuthGateModalProps> = ({ isOpen, onAuthenticated }) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.trim() === MASTER_PIN) {
      onAuthenticated();
    } else {
      setError('PIN otentikasi salah! Silakan coba lagi.');
      setPin('');
    }
  };

  const handleQuickBypass = () => {
    setPin(MASTER_PIN);
    onAuthenticated();
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-md"
      style={{
        backgroundColor: '#070b19',
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.25), transparent 45%), radial-gradient(circle at 80% 25%, rgba(139, 92, 246, 0.25), transparent 45%), radial-gradient(circle at 50% 90%, rgba(16, 185, 129, 0.18), transparent 45%)',
      }}
    >
      <div className="bg-slate-900/90 border border-indigo-400/25 rounded-3xl shadow-2xl shadow-indigo-950/60 w-full max-w-md p-8 text-white space-y-6 animate-in fade-in zoom-in duration-200 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-400 via-indigo-500 to-emerald-400" />
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 bg-gradient-to-br from-cyan-500 via-blue-600 to-indigo-600 rounded-2xl text-white shadow-xl shadow-blue-500/30 mb-2">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-100 to-indigo-200 bg-clip-text text-transparent">
            Otentikasi Akses WebApp
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Sistem Monitoring Design & Drawing Engineering & KPI Cloud. Masukkan PIN master untuk membuka sistem.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-cyan-200 mb-1.5">
              Kode Akses / PIN WebApp
            </label>
            <div className="relative">
              <input
                type="password"
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                autoFocus
                required
                placeholder="Masukkan PIN rahasia..."
                className="w-full bg-slate-950/90 border border-indigo-500/40 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-cyan-400 focus:border-cyan-400 focus:outline-none transition-all placeholder-slate-500 font-mono tracking-widest text-center text-lg"
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-rose-400 flex items-center space-x-1">
                <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{error}</span>
              </p>
            )}
          </div>

          <button
            type="submit"
            className="w-full py-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:via-blue-500 hover:to-indigo-500 font-bold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2 cursor-pointer"
          >
            <KeyRound className="w-4 h-4" />
            <span>Buka Aplikasi Sistem</span>
          </button>

          <button
            type="button"
            onClick={handleQuickBypass}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500/15 to-teal-500/15 hover:from-emerald-500/25 hover:to-teal-500/25 border border-emerald-400/30 text-xs text-emerald-200 hover:text-white rounded-xl transition flex items-center justify-center space-x-1.5 cursor-pointer font-semibold"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Masuk Cepat (Authorized Session)</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-indigo-500/20">
          <p className="text-[11px] text-slate-400">
            Industrial Engineering Cloud System • Connected with Google Sheets
          </p>
        </div>
      </div>
    </div>
  );
};
