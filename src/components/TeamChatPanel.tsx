import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Send,
  Users,
  MessageCircle,
  Hash,
  Reply,
  Trash2,
  FolderKanban,
  Pencil,
  Check,
  AtSign,
  Lock,
  Sparkles,
  UserCheck
} from 'lucide-react';
import {
  ActiveSessionPresence,
  EngineeringProject,
  TeamChatMessage,
  UserRole
} from '../types/engineering';

interface TeamChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: TeamChatMessage[];
  onlineSessions: ActiveSessionPresence[];
  currentSessionId: string;
  currentIdentityKey: string;
  currentDisplayName: string;
  currentRole: UserRole;
  viewerNickname: string;
  onChangeViewerNickname: (name: string) => void;
  projects: EngineeringProject[];
  activeRoomId: string;
  onSelectRoom: (roomId: string) => void;
  onSendMessage: (payload: {
    roomId: string;
    text: string;
    recipientKey?: string;
    recipientName?: string;
    relatedSpk?: string;
    replyTo?: TeamChatMessage | null;
  }) => Promise<void>;
  onDeleteMessage: (messageId: string) => Promise<void>;
  onJumpToSpk?: (spk: string) => void;
  unreadByRoom: Record<string, number>;
}

export function getPresenceIdentityKey(session: Pick<ActiveSessionPresence, 'sessionId' | 'staffId'>): string {
  return session.staffId && session.staffId !== 'viewer'
    ? `stf_${session.staffId}`
    : `ses_${session.sessionId}`;
}

export function buildDirectRoomId(keyA: string, keyB: string): string {
  return `dm__${[keyA, keyB].sort().join('__')}`;
}

const ROLE_BADGE_STYLES: Record<UserRole, string> = {
  Manager: 'bg-purple-500/20 text-purple-200 border-purple-400/40',
  Supervisor: 'bg-cyan-500/20 text-cyan-200 border-cyan-400/40',
  Lead: 'bg-blue-500/20 text-blue-200 border-blue-400/40',
  Designer: 'bg-amber-500/20 text-amber-200 border-amber-400/40',
  Drafter: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40',
  Viewer: 'bg-slate-600/40 text-slate-300 border-slate-500/40'
};

const ROLE_LIGHT_BADGE: Record<UserRole, string> = {
  Manager: 'bg-purple-100 text-purple-800 border-purple-200',
  Supervisor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  Lead: 'bg-blue-100 text-blue-800 border-blue-200',
  Designer: 'bg-amber-100 text-amber-800 border-amber-200',
  Drafter: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  Viewer: 'bg-slate-200 text-slate-700 border-slate-300'
};

const VIEW_LABELS: Record<ActiveSessionPresence['currentView'], string> = {
  monitoring: 'Monitoring Drawing',
  standartPart: 'Serah Terima Std Part',
  barcodes: 'Barcode Kastamer',
  kpi: 'Dashboard KPI CDR',
  appsScript: 'GAS Code'
};

function formatMessageTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  if (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  ) {
    return 'Hari ini';
  }
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

export const TeamChatPanel: React.FC<TeamChatPanelProps> = ({
  isOpen,
  onClose,
  messages,
  onlineSessions,
  currentSessionId,
  currentIdentityKey,
  currentDisplayName,
  currentRole,
  viewerNickname,
  onChangeViewerNickname,
  projects,
  activeRoomId,
  onSelectRoom,
  onSendMessage,
  onDeleteMessage,
  onJumpToSpk,
  unreadByRoom
}) => {
  const [draftText, setDraftText] = useState('');
  const [selectedSpk, setSelectedSpk] = useState('');
  const [showSpkPicker, setShowSpkPicker] = useState(false);
  const [replyTarget, setReplyTarget] = useState<TeamChatMessage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [isEditingViewerName, setIsEditingViewerName] = useState(false);
  const [tempViewerName, setTempViewerName] = useState(viewerNickname);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setTempViewerName(viewerNickname);
  }, [viewerNickname]);

  // Deduplicate other online peers by identity key (merge multi-tab same staff)
  const onlinePeers = useMemo(() => {
    const map = new Map<
      string,
      {
        identityKey: string;
        session: ActiveSessionPresence;
        isSelf: boolean;
        tabCount: number;
      }
    >();

    onlineSessions.forEach((sess) => {
      const idKey = getPresenceIdentityKey(sess);
      const isSelf = idKey === currentIdentityKey || sess.sessionId === currentSessionId;
      const existing = map.get(idKey);
      if (!existing) {
        map.set(idKey, { identityKey: idKey, session: sess, isSelf, tabCount: 1 });
      } else {
        existing.tabCount += 1;
        if (sess.status === 'editing' && existing.session.status !== 'editing') {
          existing.session = sess;
        }
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.isSelf !== b.isSelf) return a.isSelf ? 1 : -1;
      if (a.session.status !== b.session.status) return a.session.status === 'editing' ? -1 : 1;
      const aViewer = a.session.role === 'Viewer' ? 1 : 0;
      const bViewer = b.session.role === 'Viewer' ? 1 : 0;
      if (aViewer !== bViewer) return aViewer - bViewer;
      return a.session.staffName.localeCompare(b.session.staffName);
    });
  }, [onlineSessions, currentIdentityKey, currentSessionId]);

  const otherOnlinePeers = useMemo(() => onlinePeers.filter((p) => !p.isSelf), [onlinePeers]);

  // Identify selected DM partner metadata if activeRoomId is a DM room
  const activeDmInfo = useMemo(() => {
    if (activeRoomId === 'global') return null;
    const matchedPeer = otherOnlinePeers.find(
      (p) => buildDirectRoomId(currentIdentityKey, p.identityKey) === activeRoomId
    );
    if (matchedPeer) {
      return {
        identityKey: matchedPeer.identityKey,
        name: matchedPeer.session.staffName,
        role: matchedPeer.session.role,
        isOnline: true,
        status: matchedPeer.session.status,
        currentView: matchedPeer.session.currentView,
        editingTarget: matchedPeer.session.editingTarget
      };
    }

    // Fallback from existing chat messages if peer went offline
    const sampleMsg = messages.find((m) => m.roomId === activeRoomId);
    if (sampleMsg) {
      const senderKey =
        sampleMsg.senderStaffId !== 'viewer'
          ? `stf_${sampleMsg.senderStaffId}`
          : `ses_${sampleMsg.senderSessionId}`;
      const isMeSender = senderKey === currentIdentityKey;
      return {
        identityKey: isMeSender ? sampleMsg.recipientKey || '' : senderKey,
        name: isMeSender ? sampleMsg.recipientName || 'Rekan Tim' : sampleMsg.senderName,
        role: isMeSender ? ('Viewer' as UserRole) : sampleMsg.senderRole,
        isOnline: false,
        status: 'online' as const,
        currentView: 'monitoring' as const,
        editingTarget: undefined
      };
    }

    return null;
  }, [activeRoomId, otherOnlinePeers, currentIdentityKey, messages]);

  const roomMessages = useMemo(
    () => messages.filter((m) => m.roomId === activeRoomId),
    [messages, activeRoomId]
  );

  // Scroll to bottom when panel opens, room changes, or messages arrive
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 60);
    return () => clearTimeout(timer);
  }, [isOpen, activeRoomId, roomMessages.length]);

  if (!isOpen) return null;

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanText = draftText.trim();
    if (!cleanText || isSending) return;

    setIsSending(true);
    try {
      await onSendMessage({
        roomId: activeRoomId,
        text: cleanText,
        recipientKey: activeDmInfo?.identityKey,
        recipientName: activeDmInfo?.name,
        relatedSpk: selectedSpk || undefined,
        replyTo: replyTarget
      });
      setDraftText('');
      setReplyTarget(null);
      setSelectedSpk('');
      setShowSpkPicker(false);
    } finally {
      setIsSending(false);
    }
  };

  const handleInsertMention = (name: string) => {
    const prefix = draftText && !draftText.endsWith(' ') ? `${draftText} ` : draftText;
    setDraftText(`${prefix}@${name} `);
    textareaRef.current?.focus();
  };

  const handleSaveViewerNickname = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = tempViewerName.trim();
    onChangeViewerNickname(cleaned);
    setIsEditingViewerName(false);
  };

  const editingOnlineCount = onlinePeers.filter((p) => p.session.status === 'editing').length;

  return (
    <div
      className="fixed inset-0 z-[165] flex justify-end bg-slate-950/60 backdrop-blur-[2px] animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Chat Real-Time Tim Online"
        className="w-full sm:max-w-md md:max-w-lg h-full bg-slate-50 shadow-2xl border-l border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Dark Header */}
        <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-4 py-3.5 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold tracking-tight truncate">
                    Chat Tim Online
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {onlinePeers.length} Online
                  </span>
                  {editingOnlineCount > 0 && (
                    <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-200 text-[10px] font-bold">
                      {editingOnlineCount} Edit
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-indigo-200/80 truncate">
                  Terhubung sebagai{' '}
                  <span className="font-bold text-cyan-300">{currentDisplayName}</span> ({currentRole})
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Tutup Chat"
              className="min-w-[38px] min-h-[38px] rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition active:scale-95 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Optional Viewer Display Name Setter */}
          {currentRole === 'Viewer' && (
            <div className="mt-2.5 pt-2.5 border-t border-white/10">
              {isEditingViewerName ? (
                <form onSubmit={handleSaveViewerNickname} className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={tempViewerName}
                    onChange={(e) => setTempViewerName(e.target.value)}
                    placeholder="Ketik nama Anda (mis. Budi - Produksi)..."
                    maxLength={40}
                    autoFocus
                    className="flex-1 bg-slate-950/80 border border-cyan-400/50 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                  />
                  <button
                    type="submit"
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingViewerName(false);
                      setTempViewerName(viewerNickname);
                    }}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                  >
                    Batal
                  </button>
                </form>
              ) : (
                <div className="flex items-center justify-between gap-2 text-[11px] bg-slate-950/45 border border-white/10 rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-300 truncate">
                    Nama tampilan chat Anda:{' '}
                    <strong className="text-white">{currentDisplayName}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsEditingViewerName(true)}
                    className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 font-bold shrink-0"
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Ganti Nama</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Room & Online Teammates Switcher */}
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200/75 flex items-center gap-1">
                <Users className="w-3 h-3" />
                Pilih Ruang / Chat Langsung User Online
              </span>
              {otherOnlinePeers.length > 0 && (
                <span className="text-[10px] text-emerald-300/90 font-semibold">
                  Klik nama untuk DM
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {/* Global Team Room */}
              <button
                type="button"
                onClick={() => onSelectRoom('global')}
                className={`relative shrink-0 px-3 py-2 rounded-xl border text-left transition flex items-center gap-2 ${
                  activeRoomId === 'global'
                    ? 'bg-white text-slate-900 border-white shadow-md'
                    : 'bg-slate-900/70 text-slate-200 border-white/15 hover:bg-white/10'
                }`}
              >
                <Hash
                  className={`w-3.5 h-3.5 shrink-0 ${
                    activeRoomId === 'global' ? 'text-indigo-600' : 'text-cyan-300'
                  }`}
                />
                <div className="leading-tight">
                  <p className="text-xs font-extrabold whitespace-nowrap">Semua Online</p>
                  <p
                    className={`text-[9px] font-semibold whitespace-nowrap ${
                      activeRoomId === 'global' ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Grup Tim Engineering
                  </p>
                </div>
                {(unreadByRoom['global'] || 0) > 0 && activeRoomId !== 'global' && (
                  <span className="px-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow">
                    {unreadByRoom['global']}
                  </span>
                )}
              </button>

              {/* Individual Online Teammates */}
              {otherOnlinePeers.map((peer) => {
                const dmRoomId = buildDirectRoomId(currentIdentityKey, peer.identityKey);
                const isSelected = activeRoomId === dmRoomId;
                const unreadCount = unreadByRoom[dmRoomId] || 0;
                const isEditing = peer.session.status === 'editing';

                return (
                  <button
                    key={peer.identityKey}
                    type="button"
                    onClick={() => onSelectRoom(dmRoomId)}
                    title={`${peer.session.staffName} (${peer.session.role}) • ${
                      isEditing
                        ? `Sedang edit: ${peer.session.editingTarget || 'Data'}`
                        : `Di halaman ${VIEW_LABELS[peer.session.currentView]}`
                    }`}
                    className={`relative shrink-0 px-2.5 py-2 rounded-xl border text-left transition flex items-center gap-2 max-w-[185px] ${
                      isSelected
                        ? 'bg-cyan-50 border-cyan-300 text-slate-900 shadow-md'
                        : 'bg-slate-900/70 border-white/15 text-slate-100 hover:bg-white/10'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div
                        className={`w-7 h-7 rounded-lg text-[10px] font-extrabold flex items-center justify-center border ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : ROLE_BADGE_STYLES[peer.session.role]
                        }`}
                      >
                        {peer.session.staffName.slice(0, 2).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                          isSelected ? 'border-cyan-50' : 'border-slate-900'
                        } ${isEditing ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'}`}
                      />
                    </div>
                    <div className="min-w-0 leading-tight">
                      <p className="text-[11px] font-bold truncate">{peer.session.staffName}</p>
                      <p
                        className={`text-[9px] font-semibold truncate ${
                          isSelected
                            ? isEditing
                              ? 'text-amber-700'
                              : 'text-slate-600'
                            : isEditing
                            ? 'text-amber-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {isEditing ? 'Sedang Edit' : peer.session.role}
                      </p>
                    </div>
                    {unreadCount > 0 && !isSelected && (
                      <span className="px-1.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-black flex items-center justify-center shadow">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}

              {otherOnlinePeers.length === 0 && (
                <div className="px-3 py-2 rounded-xl bg-slate-900/40 border border-white/10 text-[11px] text-slate-400 whitespace-nowrap">
                  Belum ada user lain yang online saat ini
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Active Room Context Banner */}
        <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          {activeRoomId === 'global' ? (
            <div className="flex items-center gap-2 min-w-0">
              <Hash className="w-4 h-4 text-indigo-600 shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-extrabold text-slate-800 truncate">
                  Obrolan Grup — Semua User Online
                </p>
                <p className="text-[10px] text-slate-500 truncate">
                  Pesan langsung terkirim real-time ke seluruh tim yang sedang aktif
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 min-w-0">
              <Lock className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-xs font-extrabold text-slate-800 truncate">
                    Chat Pribadi dengan {activeDmInfo?.name || 'Rekan Tim'}
                  </p>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                      activeDmInfo?.isOnline
                        ? activeDmInfo.status === 'editing'
                          ? 'bg-amber-50 text-amber-700 border-amber-200'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}
                  >
                    {activeDmInfo?.isOnline
                      ? activeDmInfo.status === 'editing'
                        ? 'Sedang Edit'
                        : 'Online'
                      : 'Offline'}
                  </span>
                </div>
                {activeDmInfo?.isOnline && activeDmInfo.editingTarget && (
                  <p className="text-[10px] text-amber-700 font-medium truncate">
                    Aktivitas: {activeDmInfo.editingTarget}
                  </p>
                )}
              </div>
            </div>
          )}

          {otherOnlinePeers.length > 0 && activeRoomId === 'global' && (
            <div className="hidden sm:flex items-center gap-1 shrink-0">
              {otherOnlinePeers.slice(0, 3).map((peer) => (
                <button
                  key={peer.identityKey}
                  type="button"
                  onClick={() => handleInsertMention(peer.session.staffName)}
                  title={`Mention @${peer.session.staffName}`}
                  className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 text-[10px] font-bold flex items-center gap-0.5 transition"
                >
                  <AtSign className="w-2.5 h-2.5" />
                  <span className="max-w-[60px] truncate">{peer.session.staffName.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Message List */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3 space-y-3 bg-slate-100/75">
          {roomMessages.length === 0 ? (
            <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center px-6 py-8">
              <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center mb-3 shadow-sm">
                <Sparkles className="w-6 h-6" />
              </div>
              <p className="text-sm font-extrabold text-slate-700">
                {activeRoomId === 'global'
                  ? 'Belum ada pesan di Obrolan Tim'
                  : `Mulai obrolan dengan ${activeDmInfo?.name || 'rekan online'}`}
              </p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">
                Kirim pesan koordinasi drawing, cek revisi, atau tautkan nomor SPK agar rekan yang sedang online langsung melihatnya secara real-time.
              </p>
            </div>
          ) : (
            roomMessages.map((msg, idx) => {
              const senderKey =
                msg.senderStaffId !== 'viewer'
                  ? `stf_${msg.senderStaffId}`
                  : `ses_${msg.senderSessionId}`;
              const isMine =
                senderKey === currentIdentityKey || msg.senderSessionId === currentSessionId;
              const prevMsg = idx > 0 ? roomMessages[idx - 1] : null;
              const dayLabel = formatMessageDay(msg.createdAt);
              const prevDayLabel = prevMsg ? formatMessageDay(prevMsg.createdAt) : '';
              const showDayDivider = dayLabel && dayLabel !== prevDayLabel;
              const canDelete = isMine || currentRole === 'Manager';

              const linkedProj = msg.relatedSpk
                ? projects.find((p) => p.SPK === msg.relatedSpk)
                : undefined;

              return (
                <React.Fragment key={msg.id}>
                  {showDayDivider && (
                    <div className="flex items-center justify-center my-2">
                      <span className="px-3 py-0.5 rounded-full bg-slate-200/90 text-slate-600 text-[10px] font-bold">
                        {dayLabel}
                      </span>
                    </div>
                  )}

                  <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                    {/* Sender label */}
                    <div
                      className={`flex items-center gap-1.5 mb-1 px-1 ${
                        isMine ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      <span className="text-[11px] font-extrabold text-slate-700">
                        {isMine ? `${msg.senderName} (Anda)` : msg.senderName}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${
                          ROLE_LIGHT_BADGE[msg.senderRole] || ROLE_LIGHT_BADGE.Viewer
                        }`}
                      >
                        {msg.senderRole}
                      </span>
                      <span className="text-[10px] text-slate-400 tabular-nums">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    </div>

                    {/* Message Bubble */}
                    <div className={`group flex items-end gap-1.5 max-w-[88%] ${isMine ? 'flex-row-reverse' : 'flex-row'}`}>
                      <div
                        className={`rounded-2xl px-3.5 py-2.5 shadow-sm border text-xs leading-relaxed break-words ${
                          isMine
                            ? 'bg-gradient-to-br from-indigo-600 to-blue-700 text-white border-indigo-500 rounded-tr-sm'
                            : 'bg-white text-slate-800 border-slate-200 rounded-tl-sm'
                        }`}
                      >
                        {msg.replyToSender && (
                          <div
                            className={`mb-2 px-2.5 py-1.5 rounded-xl border-l-2 text-[11px] ${
                              isMine
                                ? 'bg-slate-950/25 border-cyan-300 text-indigo-100'
                                : 'bg-slate-100 border-indigo-500 text-slate-600'
                            }`}
                          >
                            <p className="font-bold text-[10px] truncate">{msg.replyToSender}</p>
                            <p className="truncate opacity-85">{msg.replyToPreview}</p>
                          </div>
                        )}

                        {msg.relatedSpk && (
                          <button
                            type="button"
                            onClick={() => onJumpToSpk && onJumpToSpk(msg.relatedSpk!)}
                            className={`mb-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition ${
                              isMine
                                ? 'bg-white/15 hover:bg-white/25 text-cyan-100 border-white/25'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                            }`}
                          >
                            <FolderKanban className="w-3 h-3 shrink-0" />
                            <span>
                              {msg.relatedSpk}
                              {linkedProj ? ` • ${linkedProj['Nama Project']}` : ''}
                            </span>
                          </button>
                        )}

                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex flex-col gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyTarget(msg);
                            textareaRef.current?.focus();
                          }}
                          title="Balas pesan ini"
                          className="p-1.5 rounded-lg bg-white hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 border border-slate-200 shadow-xs"
                        >
                          <Reply className="w-3 h-3" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => onDeleteMessage(msg.id)}
                            title="Hapus pesan"
                            className="p-1.5 rounded-lg bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 shadow-xs"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Composer Area */}
        <div className="bg-white border-t border-slate-200 px-3.5 py-3 space-y-2 shrink-0 pb-safe">
          {/* Reply Quote Preview */}
          {replyTarget && (
            <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold text-indigo-700">
                  Membalas {replyTarget.senderName}:
                </p>
                <p className="text-[11px] text-slate-600 truncate">{replyTarget.text}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTarget(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-indigo-100 shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Optional SPK Link Picker */}
          {showSpkPicker && (
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2">
              <FolderKanban className="w-4 h-4 text-indigo-600 shrink-0" />
              <select
                value={selectedSpk}
                onChange={(e) => setSelectedSpk(e.target.value)}
                className="flex-1 bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
              >
                <option value="">-- Tanpa tautan SPK proyek --</option>
                {projects.map((p) => (
                  <option key={p.SPK} value={p.SPK}>
                    {p.SPK} — {p['Nama Project']} ({p.Customer})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setSelectedSpk('');
                  setShowSpkPicker(false);
                }}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {selectedSpk && !showSpkPicker && (
            <div className="flex items-center justify-between gap-2 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-bold">
              <span className="truncate flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                Tautan Proyek: {selectedSpk}
              </span>
              <button
                type="button"
                onClick={() => setSelectedSpk('')}
                className="text-emerald-700 hover:text-emerald-950"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={handleSend} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowSpkPicker((v) => !v)}
              title="Tautkan SPK Proyek ke pesan"
              className={`min-w-[40px] min-h-[42px] rounded-xl border flex items-center justify-center transition shrink-0 ${
                showSpkPicker || selectedSpk
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              maxLength={1500}
              placeholder={
                activeRoomId === 'global'
                  ? 'Ketik pesan ke semua user online... (Enter kirim)'
                  : `Pesan ke ${activeDmInfo?.name || 'rekan tim'}...`
              }
              className="flex-1 min-h-[42px] max-h-28 resize-none bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm sm:text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
            />

            <button
              type="submit"
              disabled={!draftText.trim() || isSending}
              aria-label="Kirim Pesan"
              className="min-w-[44px] min-h-[42px] px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 disabled:opacity-45 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-indigo-600/20 transition active:scale-95 shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Kirim</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
