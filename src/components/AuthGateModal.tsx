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
    <div className="fixed inset-0 bg-slate-950/95 z-[200] flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 text-white space-y-6 animate-in fade-in zoom-in duration-200">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 bg-blue-600 rounded-2xl text-white shadow-xl shadow-blue-600/30 mb-2">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold tracking-tight">Otentikasi Akses WebApp</h2>
          <p className="text-xs text-slate-400">
            Sistem Monitoring Design & Drawing Engineering & KPI Cloud. Masukkan PIN master untuk membuka sistem.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
              <span>Kode Akses / PIN WebApp</span>
              <span className="text-[10px] text-blue-400 font-normal">Default PIN: {MASTER_PIN}</span>
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all placeholder-slate-600 font-mono tracking-widest text-center text-lg"
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
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-semibold text-sm rounded-xl shadow-lg shadow-blue-600/30 transition-all flex items-center justify-center space-x-2"
          >
            <KeyRound className="w-4 h-4" />
            <span>Buka Aplikasi Sistem</span>
          </button>

          <button
            type="button"
            onClick={handleQuickBypass}
            className="w-full py-2 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white rounded-xl transition flex items-center justify-center space-x-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Masuk Cepat dengan Master PIN (ENG2026)</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-slate-800">
          <p className="text-[11px] text-slate-500">
            Industrial Engineering Cloud System • Connected with Google Sheets
          </p>
        </div>
      </div>
    </div>
  );
};
