import React, { useState } from 'react';
import {
  Download,
  Monitor,
  Smartphone,
  Share,
  PlusSquare,
  ExternalLink,
  Copy,
  Check,
  X,
  MoreVertical,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  compactMobile?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ compactMobile = false }) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, isInIframe, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Sembunyikan tombol jika aplikasi sudah berjalan dalam mode Standalone (terinstall)
  if (isInstalled) {
    return null;
  }

  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleClick = async () => {
    if (isInstallable) {
      await install();
      return;
    }
    setShowGuideModal(true);
  };

  const handleCopyUrl = async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        title={
          isInstallable
            ? 'Install aplikasi ke PC / HP Anda'
            : 'Panduan install aplikasi di PC & HP (Android / iOS)'
        }
        className={`${
          compactMobile ? 'px-2.5 py-2 min-h-[38px]' : 'px-3 py-1.5'
        } rounded-xl text-xs font-bold flex items-center space-x-1.5 transition-all bg-gradient-to-r from-cyan-500 via-teal-500 to-emerald-500 hover:from-cyan-400 hover:to-emerald-400 text-white shadow-md shadow-emerald-500/25 cursor-pointer whitespace-nowrap active:scale-95`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={compactMobile ? 'hidden sm:inline' : ''}>Install App</span>
        {compactMobile && <span className="sm:hidden text-[11px]">Install</span>}
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-indigo-200/80 text-slate-800 max-h-[90dvh] flex flex-col">
            <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-teal-500 to-emerald-500 shrink-0" />
            <div className="bg-gradient-to-r from-[#0a0f2c] via-[#172554] to-[#1e1b4b] px-4 sm:px-5 py-3.5 sm:py-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-500 text-white shadow-lg shadow-cyan-500/25">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold">
                    Install Aplikasi di PC & HP
                  </h3>
                  <p className="text-[11px] text-cyan-200/85">
                    Akses cepat dari Desktop, Android & iPhone seperti aplikasi native
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5 overflow-y-auto flex-1">
              {isInIframe && (
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-xs text-amber-950 space-y-2">
                  <p className="font-bold">
                    Aplikasi sedang dibuka di dalam frame preview.
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Untuk memunculkan tombol install otomatis di PC atau HP, buka aplikasi langsung di tab browser baru terlebih dahulu:
                  </p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <a
                      href={currentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-[11px] shadow-sm transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka di Tab Baru</span>
                    </a>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-900 font-bold text-[11px] transition"
                    >
                      {copiedUrl ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Link Tersalin</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Salin URL</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* PC / Desktop Guide */}
              <div className={`p-3.5 rounded-xl border ${!isIOS && !isAndroid ? 'bg-blue-50/70 border-blue-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
                    <Monitor className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    PC / Laptop (Windows, Mac, Linux — Chrome / Edge)
                  </h4>
                </div>
                <ol className="text-[11px] text-slate-700 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>Pastikan aplikasi dibuka langsung di tab <strong>Google Chrome</strong> atau <strong>Microsoft Edge</strong>.</li>
                  <li>Klik tombol <strong>Install App</strong> di header atas, atau klik ikon <strong>Install (⊕ / layar dengan panah)</strong> di sisi kanan address bar browser.</li>
                  <li>Klik <strong>Install</strong> — shortcut aplikasi akan muncul di Desktop / Start Menu / Dock.</li>
                </ol>
              </div>

              {/* Android Guide */}
              <div className={`p-3.5 rounded-xl border ${isAndroid ? 'bg-emerald-50/80 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    HP Android (Google Chrome)
                  </h4>
                </div>
                <ol className="text-[11px] text-slate-700 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>Buka link aplikasi di browser <strong>Chrome</strong> pada HP Android.</li>
                  <li>Ketuk tombol <strong>Install App</strong> di atas, atau ketuk menu titik tiga (<MoreVertical className="w-3 h-3 inline text-slate-600" />) di pojok kanan atas Chrome.</li>
                  <li>Pilih <strong>Tambahkan ke Layar Utama / Install app</strong>, lalu konfirmasi <strong>Install</strong>.</li>
                </ol>
              </div>

              {/* iOS Safari Guide */}
              <div className={`p-3.5 rounded-xl border ${isIOS ? 'bg-indigo-50/80 border-indigo-300' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center space-x-2 mb-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white">
                    <Smartphone className="w-4 h-4" />
                  </div>
                  <h4 className="text-xs font-extrabold text-slate-900">
                    iPhone / iPad (Safari)
                  </h4>
                </div>
                <ol className="text-[11px] text-slate-700 space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>Buka aplikasi menggunakan browser <strong>Safari</strong> di iPhone/iPad.</li>
                  <li>Ketuk tombol <strong>Bagikan / Share</strong> (<Share className="w-3 h-3 inline text-blue-600" />) di bilah bawah Safari.</li>
                  <li>Gulir ke bawah lalu ketuk <strong>Tambah ke Layar Utama / Add to Home Screen</strong> (<PlusSquare className="w-3 h-3 inline text-indigo-600" />), lalu ketuk <strong>Tambah</strong>.</li>
                </ol>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-slate-800 to-indigo-900 hover:from-slate-700 hover:to-indigo-800 text-white text-xs font-bold transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
