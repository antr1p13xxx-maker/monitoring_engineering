import React, { useMemo, useState, useEffect } from 'react';
import {
  ActiveSessionPresence,
  AuditLog,
  StaffAccount,
  UserRole
} from '../types/engineering';
import { generateRandomStaffPin } from '../data/initialData';
import {
  X,
  Users,
  KeyRound,
  History,
  Eye,
  EyeOff,
  RefreshCw,
  UserPlus,
  Copy,
  Check,
  Search,
  ShieldCheck,
  Trash2,
  Power,
  FileSpreadsheet,
  ArrowRight,
  Lock,
  Activity,
  Smartphone,
  Monitor,
  PenLine,
  Clock
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface StaffPINAndAuditModalProps {
  isOpen: boolean;
  initialTab?: 'staff' | 'audit' | 'online';
  onClose: () => void;
  userRole: UserRole;
  activeStaff: StaffAccount | null;
  staffAccounts: StaffAccount[];
  auditLogs: AuditLog[];
  onlineSessions?: ActiveSessionPresence[];
  currentSessionId?: string;
  onAddStaff: (name: string, role: Exclude<UserRole, 'Viewer'>, pin: string) => void;
  onResetStaffPin: (staffId: string, newPin: string) => void;
  onUpdateStaffRole?: (staffId: string, newRole: Exclude<UserRole, 'Viewer'>) => void;
  onToggleStaffActive: (staffId: string) => void;
  onDeleteStaff: (staffId: string) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

const ROLE_BADGE_STYLES: Record<string, string> = {
  Manager: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  Supervisor: 'bg-amber-100 text-amber-800 border-amber-200',
  Lead: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  Designer: 'bg-sky-100 text-sky-800 border-sky-200',
  Drafter: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Viewer: 'bg-slate-100 text-slate-700 border-slate-200'
};

const MODULE_BADGE_STYLES: Record<string, string> = {
  Monitoring: 'bg-blue-100 text-blue-800 border-blue-200',
  'Standart Part': 'bg-rose-100 text-rose-800 border-rose-200',
  KPI: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'Staff & PIN': 'bg-violet-100 text-violet-800 border-violet-200'
};

const VIEW_LABEL_MAP: Record<ActiveSessionPresence['currentView'], string> = {
  monitoring: 'Monitoring Drawing SPK',
  standartPart: 'Serah Terima Standart Part',
  barcodes: 'Barcode Kastamer',
  kpi: 'Dashboard KPI CDR',
  appsScript: 'Google Apps Script (GAS)'
};

export const StaffPINAndAuditModal: React.FC<StaffPINAndAuditModalProps> = ({
  isOpen,
  initialTab = 'staff',
  onClose,
  userRole,
  activeStaff,
  staffAccounts,
  auditLogs,
  onlineSessions = [],
  currentSessionId,
  onAddStaff,
  onResetStaffPin,
  onUpdateStaffRole,
  onToggleStaffActive,
  onDeleteStaff,
  showToast
}) => {
  const isManager = userRole === 'Manager';
  const [activeTab, setActiveTab] = useState<'staff' | 'audit' | 'online'>(
    isManager ? initialTab : 'audit'
  );
  const [onlineFilter, setOnlineFilter] = useState<'all' | 'editing' | 'loggedIn' | 'viewer'>('all');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Sync active tab when initialTab changes on open
  useEffect(() => {
    if (isOpen) {
      setActiveTab(isManager ? initialTab : 'audit');
      setNowMs(Date.now());
    }
  }, [isOpen, initialTab, isManager]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setNowMs(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [isOpen]);

  // PIN visibility & reset state
  const [revealedPinIds, setRevealedPinIds] = useState<Record<string, boolean>>({});
  const [showAllPins, setShowAllPins] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editingPinFor, setEditingPinFor] = useState<{ staffId: string; newPin: string } | null>(null);

  // New Staff form state
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<Exclude<UserRole, 'Viewer'>>('Drafter');
  const [newPin, setNewPin] = useState(() => generateRandomStaffPin(staffAccounts.map((s) => s.pin)));

  // Audit Log filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditModuleFilter, setAuditModuleFilter] = useState<string>('ALL');
  const [auditStaffFilter, setAuditStaffFilter] = useState<string>('ALL');

  const uniqueLogUsers = useMemo(() => {
    const names = new Set<string>();
    auditLogs.forEach((l) => {
      if (l.staffName) names.add(l.staffName);
      else if (l.user) names.add(l.user);
    });
    return Array.from(names).sort();
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditLogs.filter((log) => {
      const mod = log.module || 'KPI';
      if (auditModuleFilter !== 'ALL' && mod !== auditModuleFilter) return false;
      const actor = log.staffName || log.user || '';
      if (auditStaffFilter !== 'ALL' && actor !== auditStaffFilter) return false;
      if (!q) return true;
      return (
        (log.user || '').toLowerCase().includes(q) ||
        (log.staffName || '').toLowerCase().includes(q) ||
        (log.target || '').toLowerCase().includes(q) ||
        (log.activity || '').toLowerCase().includes(q) ||
        (log.oldValue || '').toLowerCase().includes(q) ||
        (log.newValue || '').toLowerCase().includes(q)
      );
    });
  }, [auditLogs, auditSearch, auditModuleFilter, auditStaffFilter]);

  const loggedInSessions = useMemo(
    () => onlineSessions.filter((s) => s.role !== 'Viewer'),
    [onlineSessions]
  );
  const editingSessions = useMemo(
    () => onlineSessions.filter((s) => s.status === 'editing'),
    [onlineSessions]
  );
  const viewerSessions = useMemo(
    () => onlineSessions.filter((s) => s.role === 'Viewer'),
    [onlineSessions]
  );

  const filteredSessions = useMemo(() => {
    if (onlineFilter === 'editing') return editingSessions;
    if (onlineFilter === 'loggedIn') return loggedInSessions;
    if (onlineFilter === 'viewer') return viewerSessions;
    return onlineSessions;
  }, [onlineSessions, editingSessions, loggedInSessions, viewerSessions, onlineFilter]);

  const formatLastSeen = (isoStr: string): string => {
    const ts = Date.parse(isoStr);
    if (Number.isNaN(ts)) return '-';
    const diffSec = Math.max(0, Math.floor((nowMs - ts) / 1000));
    if (diffSec < 10) return 'Baru saja';
    if (diffSec < 60) return `${diffSec} dtk lalu`;
    const mins = Math.floor(diffSec / 60);
    return `${mins} mnt lalu`;
  };

  const formatLoginClock = (isoStr: string): string => {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return '-';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  const toggleRevealPin = (id: string) => {
    setRevealedPinIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyPin = async (staff: StaffAccount) => {
    try {
      await navigator.clipboard.writeText(staff.pin);
      setCopiedId(staff.id);
      showToast(`PIN ${staff.name} (${staff.pin}) disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      showToast(`PIN ${staff.name}: ${staff.pin}`, 'info');
    }
  };

  const handleCreateStaffSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isManager) return;
    const cleanName = newName.trim();
    const cleanPin = newPin.trim();
    if (cleanName.length < 2) {
      showToast('Nama staff minimal 2 karakter.', 'error');
      return;
    }
    if (cleanPin.length < 4) {
      showToast('PIN staff minimal 4 karakter.', 'error');
      return;
    }
    if (staffAccounts.some((s) => s.pin.toLowerCase() === cleanPin.toLowerCase())) {
      showToast('PIN tersebut sudah dipakai staff lain. Gunakan PIN yang unik.', 'error');
      return;
    }
    onAddStaff(cleanName, newRole, cleanPin);
    setNewName('');
    setNewRole('Drafter');
    setNewPin(generateRandomStaffPin([...staffAccounts.map((s) => s.pin), cleanPin]));
  };

  const handleSaveResetPin = (staff: StaffAccount) => {
    if (!isManager || !editingPinFor) return;
    const cleanPin = editingPinFor.newPin.trim();
    if (cleanPin.length < 4) {
      showToast('PIN baru minimal 4 karakter.', 'error');
      return;
    }
    const duplicate = staffAccounts.some(
      (s) => s.id !== staff.id && s.pin.toLowerCase() === cleanPin.toLowerCase()
    );
    if (duplicate) {
      showToast('PIN tersebut sudah digunakan oleh staff lain. Pilih PIN unik.', 'error');
      return;
    }
    onResetStaffPin(staff.id, cleanPin);
    setEditingPinFor(null);
    setRevealedPinIds((prev) => ({ ...prev, [staff.id]: true }));
  };

  const handleExportAuditExcel = () => {
    const rows = filteredLogs.map((log, idx) => ({
      No: idx + 1,
      Waktu: log.timestamp,
      Pelaku_Staff: log.user,
      Modul: log.module || 'KPI',
      Target: log.target || '-',
      Aktivitas: log.activity,
      Nilai_Lama: log.oldValue || '-',
      Nilai_Baru: log.newValue || '-',
      Periode: `${log.month} ${log.year}`
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jejak_Audit_Staff');
    XLSX.writeFile(wb, `Jejak_Audit_Input_Engineering_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Log Jejak Audit berhasil diekspor ke Excel!', 'success');
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col border border-slate-200 max-h-[92dvh] pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="theme-header-bg text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-white/15 border border-white/20 shrink-0">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold tracking-tight truncate">
                Manajemen Staff, PIN Pribadi & Jejak Audit Input
              </h2>
              <p className="text-[11px] text-slate-300 truncate">
                Operator Aktif:{' '}
                <span className="text-emerald-300 font-bold">
                  {activeStaff ? `${activeStaff.name} (${activeStaff.role})` : userRole}
                </span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel"
            className="min-w-[40px] min-h-[40px] rounded-xl text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 sm:px-6 pt-3 flex items-center gap-2 overflow-x-auto no-scrollbar shrink-0">
          {isManager && (
            <button
              type="button"
              onClick={() => setActiveTab('online')}
              className={`pb-2.5 px-3 min-h-[40px] text-xs font-bold flex items-center space-x-1.5 border-b-2 transition whitespace-nowrap ${
                activeTab === 'online'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full animate-pulse ${
                  editingSessions.length > 0 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
              />
              <Activity className="w-4 h-4" />
              <span>User Online & Edit ({loggedInSessions.length})</span>
              {editingSessions.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-md bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-extrabold">
                  {editingSessions.length} Edit
                </span>
              )}
            </button>
          )}
          {isManager && (
            <button
              type="button"
              onClick={() => setActiveTab('staff')}
              className={`pb-2.5 px-3 min-h-[40px] text-xs font-bold flex items-center space-x-1.5 border-b-2 transition whitespace-nowrap ${
                activeTab === 'staff'
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <KeyRound className="w-4 h-4" />
              <span>Daftar Staff & Kelola PIN ({staffAccounts.length})</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`pb-2.5 px-3 min-h-[40px] text-xs font-bold flex items-center space-x-1.5 border-b-2 transition whitespace-nowrap ${
              activeTab === 'audit'
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Jejak Audit & Riwayat Input ({auditLogs.length})</span>
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 bg-slate-50/50">
          {activeTab === 'online' && isManager && (
            <div className="space-y-4">
              {/* Live Summary Strip */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-white rounded-2xl border border-emerald-200 p-3.5 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase">Staff Login Online</p>
                    <p className="text-2xl font-extrabold text-emerald-700 tabular-nums mt-0.5">
                      {loggedInSessions.length}
                    </p>
                    <p className="text-[10px] text-emerald-700 font-semibold">Terverifikasi PIN aktif</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-amber-200 p-3.5 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase">Sedang Edit Data</p>
                    <p className="text-2xl font-extrabold text-amber-600 tabular-nums mt-0.5">
                      {editingSessions.length}
                    </p>
                    <p className="text-[10px] text-amber-700 font-semibold">Form / modal terbuka</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700">
                    <PenLine className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 uppercase">Online (Mode Viewer)</p>
                    <p className="text-2xl font-extrabold text-slate-700 tabular-nums mt-0.5">
                      {viewerSessions.length}
                    </p>
                    <p className="text-[10px] text-slate-500 font-semibold">Hanya lihat (read-only)</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600">
                    <Eye className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: 'all', label: `Semua (${onlineSessions.length})` },
                    { id: 'editing', label: `Sedang Edit (${editingSessions.length})` },
                    { id: 'loggedIn', label: `Staff Login (${loggedInSessions.length})` },
                    { id: 'viewer', label: `Viewer (${viewerSessions.length})` }
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setOnlineFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                        onlineFilter === f.id
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 flex items-center gap-1.5 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Update real-time otomatis setiap aktivitas & heartbeat
                </span>
              </div>

              {/* Session Cards List */}
              {filteredSessions.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
                  <Activity className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    Tidak ada sesi aktif yang sesuai filter saat ini.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredSessions.map((sess) => {
                    const isSelf = currentSessionId && sess.sessionId === currentSessionId;
                    const isEditing = sess.status === 'editing';
                    const isMobile = sess.deviceLabel.toLowerCase().includes('hp') || sess.deviceLabel.toLowerCase().includes('mobile');

                    return (
                      <div
                        key={sess.sessionId}
                        className={`bg-white rounded-2xl border p-3.5 sm:p-4 shadow-xs transition ${
                          isEditing
                            ? 'border-amber-300 ring-1 ring-amber-200/70'
                            : sess.role !== 'Viewer'
                            ? 'border-emerald-200'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-extrabold text-sm flex items-center justify-center">
                                {sess.staffName.slice(0, 2).toUpperCase()}
                              </div>
                              <span
                                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                                  isEditing
                                    ? 'bg-amber-500 animate-pulse'
                                    : sess.role !== 'Viewer'
                                    ? 'bg-emerald-500 animate-pulse'
                                    : 'bg-slate-400'
                                }`}
                              />
                            </div>

                            <div className="min-w-0 space-y-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h4 className="text-sm font-extrabold text-slate-900 truncate">
                                  {sess.staffName}
                                </h4>
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    ROLE_BADGE_STYLES[sess.role] || ROLE_BADGE_STYLES.Viewer
                                  }`}
                                >
                                  {sess.role}
                                </span>
                                {isSelf && (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white">
                                    Perangkat Ini
                                  </span>
                                )}
                                {isEditing ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                                    <PenLine className="w-3 h-3" />
                                    <span>Sedang Edit</span>
                                  </span>
                                ) : sess.role !== 'Viewer' ? (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                    Online & Login
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                    Online (Viewer)
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-600">
                                <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
                                  {isMobile ? (
                                    <Smartphone className="w-3.5 h-3.5 text-cyan-600" />
                                  ) : (
                                    <Monitor className="w-3.5 h-3.5 text-indigo-600" />
                                  )}
                                  {sess.deviceLabel}
                                </span>
                                <span>
                                  Halaman:{' '}
                                  <strong className="text-slate-800">
                                    {VIEW_LABEL_MAP[sess.currentView] || sess.currentView}
                                  </strong>
                                </span>
                              </div>

                              {isEditing && sess.editingTarget && (
                                <div className="mt-1 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-900">
                                  <PenLine className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                  <span>Aktivitas: {sess.editingTarget}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-1 text-[11px] text-slate-500 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <Clock className="w-3 h-3" />
                              Aktif: {formatLastSeen(sess.lastHeartbeat)}
                            </span>
                            <span className="font-mono text-[10px] text-slate-500">
                              Login pkl {formatLoginClock(sess.loggedInAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'staff' && isManager && (
            <div className="space-y-5">
              {/* Top Stats & Global PIN Reveal Toggle */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-800 font-bold border border-indigo-200">
                    Total Akun: {staffAccounts.length}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 font-bold border border-emerald-200">
                    Aktif: {staffAccounts.filter((s) => s.isActive).length}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold border border-slate-200">
                    Nonaktif: {staffAccounts.filter((s) => !s.isActive).length}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAllPins((v) => !v)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center space-x-1.5 transition"
                >
                  {showAllPins ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  <span>{showAllPins ? 'Sembunyikan Semua PIN' : 'Tampilkan Semua PIN'}</span>
                </button>
              </div>

              {/* Add New Staff Account Form */}
              <form
                onSubmit={handleCreateStaffSubmit}
                className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-xs space-y-3"
              >
                <div className="flex items-center space-x-2 text-xs font-extrabold text-slate-800">
                  <UserPlus className="w-4 h-4 text-indigo-600" />
                  <span>Tambah Akun Staff Baru + Buat PIN Pribadi</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                  <div className="sm:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Nama Staff
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Cth: Andi Pratama"
                      className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Role Akses
                    </label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as Exclude<UserRole, 'Viewer'>)}
                      className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="Drafter">Drafter</option>
                      <option value="Designer">Designer</option>
                      <option value="Lead">Lead Engineer</option>
                      <option value="Supervisor">Supervisor</option>
                      <option value="Manager">Manager</option>
                    </select>
                  </div>
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      PIN Pribadi (min. 4 karakter)
                    </label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        required
                        minLength={4}
                        maxLength={16}
                        value={newPin}
                        onChange={(e) => setNewPin(e.target.value)}
                        className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs font-mono font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setNewPin(
                            generateRandomStaffPin(staffAccounts.map((s) => s.pin))
                          )
                        }
                        title="Acak PIN baru"
                        className="min-w-[40px] min-h-[40px] rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 flex items-center justify-center shrink-0"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <div className="sm:col-span-2 flex items-end">
                    <button
                      type="submit"
                      className="w-full min-h-[40px] px-3 py-2 rounded-xl theme-btn-primary text-xs font-bold flex items-center justify-center space-x-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>Tambah</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Staff List with Visible/Resettable PINs */}
              <div className="space-y-2.5">
                {staffAccounts.map((staff) => {
                  const isPinVisible = showAllPins || Boolean(revealedPinIds[staff.id]);
                  const isResetting = editingPinFor?.staffId === staff.id;
                  const isCurrentActor = activeStaff?.id === staff.id;
                  const matchingSessions = onlineSessions.filter((s) => s.staffId === staff.id);
                  const isStaffOnlineAnywhere = matchingSessions.length > 0;
                  const editingSession = matchingSessions.find((s) => s.status === 'editing');

                  return (
                    <div
                      key={staff.id}
                      className={`bg-white rounded-2xl border p-3.5 sm:p-4 shadow-xs transition ${
                        editingSession
                          ? 'border-amber-300 ring-1 ring-amber-200/60'
                          : isStaffOnlineAnywhere
                          ? 'border-emerald-200'
                          : staff.isActive
                          ? 'border-slate-200'
                          : 'border-slate-200 bg-slate-100/70 opacity-80'
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Left: Staff Name & Role */}
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white font-extrabold text-sm flex items-center justify-center">
                              {staff.name.slice(0, 2).toUpperCase()}
                            </div>
                            {isStaffOnlineAnywhere && (
                              <span
                                className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white animate-pulse ${
                                  editingSession ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                              />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h4 className="text-sm font-extrabold text-slate-900 truncate">
                                {staff.name}
                              </h4>
                              {onUpdateStaffRole && !isCurrentActor ? (
                                <select
                                  value={staff.role}
                                  onChange={(e) =>
                                    onUpdateStaffRole(
                                      staff.id,
                                      e.target.value as Exclude<UserRole, 'Viewer'>
                                    )
                                  }
                                  aria-label={`Ubah role akses ${staff.name}`}
                                  title="Ubah role akses staff"
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                                    ROLE_BADGE_STYLES[staff.role] || ROLE_BADGE_STYLES.Viewer
                                  }`}
                                >
                                  <option value="Drafter">Drafter</option>
                                  <option value="Designer">Designer</option>
                                  <option value="Lead">Lead</option>
                                  <option value="Supervisor">Supervisor</option>
                                  <option value="Manager">Manager</option>
                                </select>
                              ) : (
                                <span
                                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                    ROLE_BADGE_STYLES[staff.role] || ROLE_BADGE_STYLES.Viewer
                                  }`}
                                >
                                  {staff.role}
                                </span>
                              )}
                              {!staff.isActive && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                                  Nonaktif
                                </span>
                              )}
                              {isCurrentActor && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white">
                                  Perangkat Ini
                                </span>
                              )}
                              {isStaffOnlineAnywhere && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                  Online ({matchingSessions.map((m) => m.deviceLabel.split(' ')[0]).join(', ')})
                                </span>
                              )}
                              {editingSession && (
                                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1">
                                  <PenLine className="w-3 h-3" />
                                  {editingSession.editingTarget || 'Sedang Edit'}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              Diperbarui: {staff.updatedAt || staff.createdAt || '-'}
                            </p>
                          </div>
                        </div>

                        {/* Right: PIN Display & Manager Actions */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* PIN Viewer Box */}
                          <div className="flex items-center gap-1 bg-slate-100 border border-slate-300 rounded-xl px-2.5 py-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="text-[11px] font-semibold text-slate-500">PIN:</span>
                            <span className="font-mono text-xs font-extrabold text-slate-900 tracking-wider min-w-[68px] text-center">
                              {isPinVisible ? staff.pin : '••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => toggleRevealPin(staff.id)}
                              title={isPinVisible ? 'Sembunyikan PIN' : 'Lihat PIN'}
                              className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-indigo-700 transition"
                            >
                              {isPinVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyPin(staff)}
                              title="Salin PIN"
                              className="p-1 rounded-lg hover:bg-white text-slate-600 hover:text-emerald-700 transition"
                            >
                              {copiedId === staff.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>

                          {/* Reset / Regenerate PIN Button */}
                          <button
                            type="button"
                            onClick={() =>
                              setEditingPinFor(
                                isResetting
                                  ? null
                                  : {
                                      staffId: staff.id,
                                      newPin: generateRandomStaffPin(
                                        staffAccounts.map((s) => s.pin)
                                      )
                                    }
                              )
                            }
                            className="min-h-[36px] px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center space-x-1.5 transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Buat Ulang PIN</span>
                          </button>

                          {/* Activate / Deactivate Toggle */}
                          <button
                            type="button"
                            onClick={() => onToggleStaffActive(staff.id)}
                            title={staff.isActive ? 'Nonaktifkan sementara akun staff' : 'Aktifkan kembali akun staff'}
                            className={`min-h-[36px] px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center space-x-1 transition ${
                              staff.isActive
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
                            }`}
                          >
                            <Power className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">
                              {staff.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                            </span>
                          </button>

                          {/* Delete Staff */}
                          <button
                            type="button"
                            onClick={() => onDeleteStaff(staff.id)}
                            title="Hapus akun staff"
                            className="min-h-[36px] min-w-[36px] p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center justify-center transition"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Inline Regenerate PIN Bar */}
                      {isResetting && editingPinFor && (
                        <div className="mt-3 pt-3 border-t border-indigo-100 bg-indigo-50/50 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center gap-2.5">
                          <span className="text-xs font-bold text-indigo-900 shrink-0">
                            PIN Baru untuk {staff.name}:
                          </span>
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingPinFor.newPin}
                              onChange={(e) =>
                                setEditingPinFor({ staffId: staff.id, newPin: e.target.value })
                              }
                              minLength={4}
                              maxLength={16}
                              placeholder="Ketik PIN baru..."
                              className="flex-1 min-h-[38px] px-3 py-1.5 bg-white border border-indigo-300 rounded-xl text-base sm:text-xs font-mono font-bold text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setEditingPinFor({
                                  staffId: staff.id,
                                  newPin: generateRandomStaffPin(staffAccounts.map((s) => s.pin))
                                })
                              }
                              className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-slate-100 border border-indigo-200 text-indigo-700 rounded-xl text-xs font-bold flex items-center space-x-1 shrink-0"
                            >
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Acak</span>
                            </button>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleSaveResetPin(staff)}
                              className="min-h-[38px] px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold flex items-center space-x-1"
                            >
                              <Check className="w-4 h-4" />
                              <span>Simpan PIN Baru</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingPinFor(null)}
                              className="min-h-[38px] px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-semibold"
                            >
                              Batal
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'audit' && (
            <div className="space-y-4">
              {/* Filter Bar */}
              <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Cari nama staff, SPK, project, part name, nilai..."
                    className="w-full min-h-[40px] pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 sm:flex items-center gap-2">
                  <select
                    value={auditModuleFilter}
                    onChange={(e) => setAuditModuleFilter(e.target.value)}
                    className="min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs font-semibold text-slate-800"
                  >
                    <option value="ALL">Semua Modul</option>
                    <option value="Monitoring">Monitoring SPK</option>
                    <option value="Standart Part">Standart Part</option>
                    <option value="KPI">KPI Engineering</option>
                    <option value="Staff & PIN">Staff & PIN</option>
                  </select>

                  <select
                    value={auditStaffFilter}
                    onChange={(e) => setAuditStaffFilter(e.target.value)}
                    className="min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs font-semibold text-slate-800"
                  >
                    <option value="ALL">Semua Staff</option>
                    {uniqueLogUsers.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>

                  {isManager && (
                    <button
                      type="button"
                      onClick={handleExportAuditExcel}
                      className="col-span-2 sm:col-span-1 min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center space-x-1.5 shrink-0"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>Ekspor Excel</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Audit Entries List */}
              {filteredLogs.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
                  <Users className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">
                    Belum ada catatan audit yang cocok dengan filter.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredLogs.slice(0, 150).map((log) => {
                    const mod = log.module || 'KPI';
                    return (
                      <div
                        key={log.id}
                        className="bg-white rounded-2xl border border-slate-200 p-3.5 shadow-xs hover:border-indigo-200 transition space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-900 text-white text-[11px] font-bold">
                              {log.user}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                                MODULE_BADGE_STYLES[mod] || 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {mod}
                            </span>
                            {log.target && (
                              <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono text-[10px] font-semibold">
                                {log.target}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                            {log.timestamp}
                          </span>
                        </div>

                        <p className="text-xs font-bold text-slate-800">{log.activity}</p>

                        {(log.oldValue || log.newValue) && (
                          <div className="flex flex-wrap items-center gap-2 text-[11px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
                            {log.oldValue && (
                              <>
                                <span className="text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded font-medium break-all">
                                  Lama: {log.oldValue}
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              </>
                            )}
                            <span className="text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded font-bold break-all">
                              {log.oldValue ? `Baru: ${log.newValue}` : log.newValue}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
