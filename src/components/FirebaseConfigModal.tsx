import React, { useState } from 'react';
import { 
  Flame, 
  Database, 
  ExternalLink, 
  Copy, 
  Check, 
  ShieldCheck, 
  X, 
  RefreshCw, 
  Server, 
  Layers,
  KeyRound,
  Eye,
  EyeOff,
  Edit3,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import { 
  firebaseConfig, 
  testFirestoreConnection, 
  saveCustomFirebaseConfig, 
  resetToDefaultFirebaseConfig 
} from '../firebase/firebaseConfig';

interface FirebaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectsCount: number;
  onRefreshSync?: () => void;
}

export const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({
  isOpen,
  onClose,
  projectsCount,
  onRefreshSync
}) => {
  const [copied, setCopied] = useState(false);
  const [rulesCopied, setRulesCopied] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'checking'>('idle');
  const [isEditing, setIsEditing] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    projectId: firebaseConfig.projectId || '',
    apiKey: firebaseConfig.apiKey || '',
    authDomain: firebaseConfig.authDomain || '',
    storageBucket: firebaseConfig.storageBucket || '',
    messagingSenderId: firebaseConfig.messagingSenderId || '',
    appId: firebaseConfig.appId || '',
    firestoreDatabaseId: firebaseConfig.firestoreDatabaseId || ''
  });

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(firebaseConfig, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCopyRules = () => {
    const rulesText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`;
    navigator.clipboard.writeText(rulesText);
    setRulesCopied(true);
    setTimeout(() => setRulesCopied(false), 2500);
  };

  const handleTestPing = async () => {
    setConnectionStatus('checking');
    try {
      const ok = await testFirestoreConnection();
      setConnectionStatus(ok ? 'success' : 'idle');
    } catch {
      setConnectionStatus('idle');
    }
    setTimeout(() => setConnectionStatus('idle'), 3000);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    if (onRefreshSync) onRefreshSync();
    handleTestPing();
    setTimeout(() => setRefreshing(false), 800);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    saveCustomFirebaseConfig({
      projectId: formData.projectId.trim(),
      apiKey: formData.apiKey.trim(),
      authDomain: formData.authDomain.trim(),
      storageBucket: formData.storageBucket.trim(),
      messagingSenderId: formData.messagingSenderId.trim(),
      appId: formData.appId.trim(),
      firestoreDatabaseId: formData.firestoreDatabaseId.trim()
    });
  };

  const handleReset = () => {
    if (window.confirm('Reset konfigurasi Firebase kembali ke pengaturan awal bawaan file config?')) {
      resetToDefaultFirebaseConfig();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 z-50 flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl w-full max-w-2xl text-white overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-600/20 via-orange-600/10 to-slate-900 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-orange-600 rounded-xl text-white shadow-lg shadow-orange-500/20">
              <Flame className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">
                  Konfigurasi Google Firebase Console
                </h2>
                <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>Cloud Active</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Proyek Firebase: <strong className="text-amber-300 font-mono">{firebaseConfig.projectId}</strong>
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

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 sm:space-y-5 text-xs">
          {/* Status Overview Card */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Firebase Project</span>
              <p className="text-xs sm:text-sm font-bold text-amber-400 font-mono mt-1 break-all">
                {firebaseConfig.projectId}
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Google Cloud Project</span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Database Firestore</span>
              <p className="text-xs sm:text-sm font-bold text-emerald-400 font-mono mt-1 truncate" title={firebaseConfig.firestoreDatabaseId || '(default)'}>
                {firebaseConfig.firestoreDatabaseId || '(default)'}
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Target Firestore DB</span>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Data Tersimpan</span>
              <p className="text-xs sm:text-sm font-bold text-blue-400 font-mono mt-1">
                {projectsCount} Proyek SPK
              </p>
              <span className="text-[10px] text-slate-500 mt-0.5 block">Real-time Cloud Sync</span>
            </div>
          </div>

          {/* Active Credentials Panel */}
          <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-slate-200 text-xs">Kredensial Firebase Aktif</h3>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center space-x-1 text-[11px]"
                >
                  <Edit3 className="w-3 h-3 text-amber-400" />
                  <span>{isEditing ? 'Tutup Edit' : 'Edit / Ubah Key'}</span>
                </button>
              </div>
            </div>

            {!isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono">
                  <span className="text-[9px] text-slate-400 block font-sans">API KEY:</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-amber-300 truncate">
                      {showApiKey 
                        ? firebaseConfig.apiKey 
                        : `${firebaseConfig.apiKey?.slice(0, 10)}••••••••••••••••••••${firebaseConfig.apiKey?.slice(-4)}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="text-slate-400 hover:text-white ml-1"
                      title={showApiKey ? 'Sembunyikan' : 'Tampilkan'}
                    >
                      {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono">
                  <span className="text-[9px] text-slate-400 block font-sans">AUTH DOMAIN:</span>
                  <p className="text-slate-200 truncate mt-0.5">{firebaseConfig.authDomain}</p>
                </div>

                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono">
                  <span className="text-[9px] text-slate-400 block font-sans">APP ID:</span>
                  <p className="text-slate-200 truncate mt-0.5">{firebaseConfig.appId}</p>
                </div>

                <div className="p-2 bg-slate-900 rounded-lg border border-slate-800 font-mono">
                  <span className="text-[9px] text-slate-400 block font-sans">STORAGE BUCKET:</span>
                  <p className="text-slate-200 truncate mt-0.5">{firebaseConfig.storageBucket || '-'}</p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveForm} className="space-y-3 pt-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">Project ID</label>
                    <input
                      type="text"
                      value={formData.projectId}
                      onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="contoh: mechmatrix-engineering"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">API Key</label>
                    <input
                      type="text"
                      value={formData.apiKey}
                      onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="AIzaSy..."
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">Auth Domain</label>
                    <input
                      type="text"
                      value={formData.authDomain}
                      onChange={(e) => setFormData({ ...formData, authDomain: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="project.firebaseapp.com"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">App ID</label>
                    <input
                      type="text"
                      value={formData.appId}
                      onChange={(e) => setFormData({ ...formData, appId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="1:123456789:web:abcdef"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">Storage Bucket</label>
                    <input
                      type="text"
                      value={formData.storageBucket}
                      onChange={(e) => setFormData({ ...formData, storageBucket: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="project.firebasestorage.app"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-semibold block mb-1">Firestore Database ID (opsional)</label>
                    <input
                      type="text"
                      value={formData.firestoreDatabaseId}
                      onChange={(e) => setFormData({ ...formData, firestoreDatabaseId: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:border-amber-500 focus:outline-none"
                      placeholder="kosongkan jika menggunakan (default)"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-2.5 py-1 text-slate-400 hover:text-rose-400 flex items-center space-x-1 text-[11px]"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset ke Bawaan File</span>
                  </button>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center space-x-1 shadow"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Simpan & Terapkan</span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

          {/* Firestore Collections Structure */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-amber-400" />
                <h3 className="font-bold text-slate-200">Struktur Dokumen & Koleksi Cloud Firestore</h3>
              </div>
              <span className="text-[10px] text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                4 Collections
              </span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 flex items-start space-x-2">
                <Layers className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-200 font-mono">engineering_projects</p>
                  <p className="text-[10px] text-slate-400">Data SPK, customer, tanggal, target delivery & 12 checklist</p>
                </div>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 flex items-start space-x-2">
                <Layers className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-200 font-mono">kpi_records</p>
                  <p className="text-[10px] text-slate-400">Capaian KPI bulanan Jan-Des per tahun (2026-2030)</p>
                </div>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 flex items-start space-x-2">
                <Layers className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-200 font-mono">review_cost_records</p>
                  <p className="text-[10px] text-slate-400">Anggaran, pengeluaran design, lembur & efisiensi biaya</p>
                </div>
              </div>
              <div className="p-2.5 bg-slate-900 rounded-lg border border-slate-800/80 flex items-start space-x-2">
                <Layers className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-slate-200 font-mono">review_error_records</p>
                  <p className="text-[10px] text-slate-400">Pencatatan drawing revisi, part error & error rate (%)</p>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Guide & Rules Tips */}
          <div className="p-3.5 bg-amber-950/20 rounded-xl border border-amber-800/30 text-xs space-y-2">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-amber-300">Tips Izin Akses Firestore di Firebase Console Anda:</p>
                <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                  Pastikan tab <strong>Firestore Database &gt; Rules</strong> di Firebase Console Anda mengizinkan read/write, atau salin template rules berikut:
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-[10px] text-slate-400 font-mono">allow read, write: if true;</span>
              <button
                type="button"
                onClick={handleCopyRules}
                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[10px] font-semibold flex items-center space-x-1 transition"
              >
                {rulesCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{rulesCopied ? 'Rules Tersalin!' : 'Salin Contoh Rules'}</span>
              </button>
            </div>
          </div>

          {/* Config JSON & Direct Access */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-300">Firebase SDK Config JSON:</span>
              <button
                type="button"
                onClick={handleCopy}
                className="text-[11px] px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center space-x-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Tersalin!' : 'Salin JSON'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-950 text-slate-300 rounded-xl border border-slate-800 font-mono text-[10px] overflow-x-auto max-h-32">
              {JSON.stringify(firebaseConfig, null, 2)}
            </pre>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition flex items-center space-x-1.5 disabled:opacity-50 text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
              <span>{refreshing ? 'Menyinkronkan...' : 'Tes Ping & Sinkron'}</span>
            </button>
            {connectionStatus === 'success' && (
              <span className="text-emerald-400 text-[11px] flex items-center space-x-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Terhubung!</span>
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <a
              href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 text-white font-bold rounded-xl shadow-lg shadow-orange-500/20 transition flex items-center space-x-1.5 text-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Firebase Console</span>
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
