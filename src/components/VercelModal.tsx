import React, { useState } from 'react';
import { 
  Globe, 
  ExternalLink, 
  Copy, 
  Check, 
  CheckCircle2, 
  X, 
  Terminal, 
  FileCode, 
  Zap,
  Server,
  Github
} from 'lucide-react';

interface VercelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const VercelModal: React.FC<VercelModalProps> = ({ isOpen, onClose }) => {
  const [copiedConfig, setCopiedConfig] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);

  if (!isOpen) return null;

  const vercelJsonContent = `{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}`;

  const cliCommands = `npm i -g vercel\nvercel login\nvercel --prod`;

  const handleCopyConfig = () => {
    navigator.clipboard.writeText(vercelJsonContent);
    setCopiedConfig(true);
    setTimeout(() => setCopiedConfig(false), 2000);
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(cliCommands);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl text-white overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-black border border-slate-700 rounded-xl text-white shadow-lg flex items-center justify-center">
              {/* Vercel Triangle Logo */}
              <svg viewBox="0 0 76 65" className="w-5 h-5 fill-current">
                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
              </svg>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Deploy Online ke Vercel (vercel.app)
                </h2>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Vercel-Ready</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Konfigurasi <code className="text-emerald-400">vercel.json</code> & Serverless API siap digunakan.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-xs">
          {/* Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Framework</span>
              <p className="text-xs sm:text-sm font-bold text-white font-mono mt-1 flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Vite (React 19)</span>
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">SPA Auto-Routing</span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Serverless API</span>
              <p className="text-xs sm:text-sm font-bold text-emerald-400 font-mono mt-1 flex items-center space-x-1.5">
                <Server className="w-3.5 h-3.5 text-emerald-400" />
                <span>/api/ai-insights</span>
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Edge & Node Runtime</span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Database Cloud</span>
              <p className="text-xs sm:text-sm font-bold text-blue-400 font-mono mt-1 flex items-center space-x-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-400" />
                <span>Firestore Realtime</span>
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Langsung Terkoneksi</span>
            </div>
          </div>

          {/* Quick Steps Guide */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-slate-200 flex items-center space-x-2 text-xs">
              <Github className="w-4 h-4 text-white" />
              <span>Langkah Cepat Deploy ke Vercel via GitHub:</span>
            </h3>
            
            <ol className="space-y-2 text-[11px] text-slate-300">
              <li className="flex items-start space-x-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold shrink-0 text-[10px]">1</span>
                <div>
                  <strong className="text-white">Push kode ini ke GitHub Anda</strong> (misalnya ke repo pribadi atau publik).
                </div>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold shrink-0 text-[10px]">2</span>
                <div>
                  Buka <strong>Vercel Dashboard</strong>, klik <strong>"Add New Project"</strong>, lalu pilih repo GitHub Anda.
                </div>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold shrink-0 text-[10px]">3</span>
                <div>
                  Vercel akan otomatis mendeteksi preset <strong>Vite</strong> (<code className="text-amber-300">npm run build</code> & output <code className="text-amber-300">dist</code>). Klik <strong>Deploy</strong>!
                </div>
              </li>
              <li className="flex items-start space-x-2.5">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-800 text-amber-400 font-bold shrink-0 text-[10px]">4</span>
                <div>
                  Selesai! Aplikasi Anda langsung aktif online di domain: <span className="text-emerald-400 font-mono">https://nama-proyek-anda.vercel.app</span>
                </div>
              </li>
            </ol>
          </div>

          {/* Configuration File vercel.json */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                <FileCode className="w-3.5 h-3.5 text-blue-400" />
                <span>File vercel.json (Telah Dibuat di Root):</span>
              </span>
              <button
                type="button"
                onClick={handleCopyConfig}
                className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center space-x-1"
              >
                {copiedConfig ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedConfig ? 'Tersalin!' : 'Salin vercel.json'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 text-slate-300 rounded-xl border border-slate-800 font-mono text-[10px] overflow-x-auto max-h-32">
              {vercelJsonContent}
            </pre>
          </div>

          {/* Vercel CLI Option */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300 flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                <span>Alternatif Deploy via Vercel CLI:</span>
              </span>
              <button
                type="button"
                onClick={handleCopyCli}
                className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center space-x-1"
              >
                {copiedCli ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copiedCli ? 'Tersalin!' : 'Salin Perintah'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 text-emerald-300 rounded-xl border border-slate-800 font-mono text-[11px] overflow-x-auto">
              {cliCommands}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2 text-[11px] text-slate-400">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Dokumentasi lengkap di: <strong className="text-slate-300">VERCEL_DEPLOYMENT_GUIDE.md</strong></span>
          </div>

          <div className="flex items-center space-x-2">
            <a
              href="https://vercel.com/new"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-1.5 bg-white hover:bg-slate-200 text-slate-950 font-bold rounded-xl shadow-lg transition flex items-center space-x-1.5 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Dashboard Vercel</span>
            </a>
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl border border-slate-700 transition text-xs"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
