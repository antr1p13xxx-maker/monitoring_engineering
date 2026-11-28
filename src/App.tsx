import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { AuthGateModal } from './components/AuthGateModal';
import { MonitoringView } from './components/MonitoringView';
import { KPIView } from './components/KPIView';
import { AppsScriptCodeView } from './components/AppsScriptCodeView';
import { DataModal } from './components/DataModal';
import { UploadModal } from './components/UploadModal';
import { CadViewerModal } from './components/CadViewerModal';
import { FirebaseConfigModal } from './components/FirebaseConfigModal';
import { VercelModal } from './components/VercelModal';
import { OfflineIndicator } from './components/OfflineIndicator';
import { MobileBottomNav } from './components/MobileBottomNav';
import { CustomerBarcodeView } from './components/CustomerBarcodeView';
import { ThemeSettingsModal } from './components/ThemeSettingsModal';
import { StaffPINAndAuditModal } from './components/StaffPINAndAuditModal';
import { TeamChatPanel } from './components/TeamChatPanel';
import {
  ThemeConfig,
  DEFAULT_THEME_CONFIG,
  loadSavedTheme,
  saveThemeConfig,
  applyThemeToDocument
} from './utils/themeSettings';
import {
  initOfflineSyncRuntime,
  cacheDataInIndexedDB,
  readCachedDataFromIndexedDB,
  getAllPendingMutations
} from './utils/offlineSyncQueue';
import { 
  subscribeToFirestoreProjects, 
  saveProjectToFirestore, 
  updateChecklistInFirestore, 
  deleteProjectFromFirestore, 
  seedFirestoreIfEmpty,
  subscribeToFirestoreKPIs,
  saveKPIMonthToFirestore,
  seedKPIsIfEmpty,
  subscribeToFirestoreReviewCost,
  saveReviewCostToFirestore,
  deleteReviewCostFromFirestore,
  seedReviewCostIfEmpty,
  subscribeToFirestoreReviewError,
  saveReviewErrorToFirestore,
  deleteReviewErrorFromFirestore,
  seedReviewErrorIfEmpty,
  subscribeToFirestoreStandartParts,
  saveStandartPartToFirestore,
  deleteStandartPartFromFirestore,
  seedStandartPartsIfEmpty,
  subscribeToFirestoreDesignFeedback,
  saveDesignFeedbackToFirestore,
  deleteDesignFeedbackFromFirestore,
  seedDesignFeedbackIfEmpty,
  subscribeToFirestoreApprovals,
  saveApprovalToFirestore,
  deleteApprovalFromFirestore,
  subscribeToFirestoreStaffAccounts,
  saveStaffAccountToFirestore,
  deleteStaffAccountFromFirestore,
  seedStaffAccountsIfEmpty,
  subscribeToFirestoreAuditLogs,
  saveAuditLogToFirestore,
  subscribeToFirestoreActiveSessions,
  upsertActiveSessionToFirestore,
  removeActiveSessionFromFirestore,
  subscribeToFirestoreTeamChat,
  sendTeamChatMessageToFirestore,
  deleteTeamChatMessageFromFirestore
} from './firebase/firestoreService';
import { isFirestoreQuotaExceeded } from './firebase/firebaseConfig';
import { 
  EngineeringProject, 
  KPIItem, 
  UserRole, 
  StaffAccount,
  ChecklistKey, 
  ReviewCostItem, 
  ReviewErrorItem, 
  DesignFeedbackItem, 
  AuditLog,
  SerahTerimaStandartPartItem,
  KPIApprovalRequest,
  ActiveSessionPresence,
  TeamChatMessage
} from './types/engineering';
import { 
  INITIAL_PROJECTS, 
  INITIAL_STAFF_ACCOUNTS,
  CHECKLIST_KEYS,
  getProjectRequiredChecklists,
  getBaseKPITemplate, 
  INITIAL_REVIEW_COST, 
  INITIAL_REVIEW_ERROR, 
  INITIAL_FEEDBACK, 
  INITIAL_STANDART_PART_HANDOVERS,
  MONTH_FULL_NAMES 
} from './data/initialData';
import { CheckCircle2, AlertCircle, Info, Sparkles, Flame, MessageCircle, X } from 'lucide-react';

export default function App() {
  // Authentication Gate State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [showAuthGate, setShowAuthGate] = useState<boolean>(false);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState<boolean>(false);
  const [isVercelModalOpen, setIsVercelModalOpen] = useState<boolean>(false);
  const [isThemeModalOpen, setIsThemeModalOpen] = useState<boolean>(false);
  const [themeConfig, setThemeConfig] = useState<ThemeConfig>(() => loadSavedTheme());

  // App Navigation & Role State (Default role is Viewer: Read-only)
  const [currentView, setCurrentView] = useState<'monitoring' | 'barcodes' | 'kpi' | 'appsScript'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (
        params.get('customer_barcode') ||
        params.get('customer') ||
        params.get('spk_barcode') ||
        params.get('spk')
      ) {
        return 'barcodes';
      }
    }
    return 'monitoring';
  });
  const [barcodeLookupQuery, setBarcodeLookupQuery] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('customer_barcode') || params.get('customer') || null;
    }
    return null;
  });
  const [spkLookupQuery, setSpkLookupQuery] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('spk_barcode') || params.get('spk') || null;
    }
    return null;
  });
  const [monitoringSubTab, setMonitoringSubTab] = useState<'drawingProjects' | 'standartPartHandover'>('drawingProjects');
  const [mobileRolePickerOpen, setMobileRolePickerOpen] = useState<boolean>(false);
  const [staffAccounts, setStaffAccounts] = useState<StaffAccount[]>(() => {
    try {
      const saved = localStorage.getItem('eng_staff_accounts');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading staff accounts from localStorage:', e);
    }
    return INITIAL_STAFF_ACCOUNTS;
  });
  const [activeStaff, setActiveStaff] = useState<StaffAccount | null>(null);
  const userRole: UserRole = activeStaff ? activeStaff.role : 'Viewer';
  const [staffPinModalState, setStaffPinModalState] = useState<{ isOpen: boolean; tab: 'staff' | 'audit' | 'online' }>({
    isOpen: false,
    tab: 'staff'
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Real-Time Online & Editing Presence State
  const [sessionId] = useState<string>(() => {
    try {
      const existing = sessionStorage.getItem('eng_presence_session_id');
      if (existing) return existing;
      const generated = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem('eng_presence_session_id', generated);
      return generated;
    } catch {
      return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
  });
  const [deviceLabel] = useState<string>(() => {
    if (typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      return 'HP / Mobile';
    }
    return 'Desktop / PC';
  });
  const [sessionLoggedInAt, setSessionLoggedInAt] = useState<string>(() => new Date().toISOString());
  const [childEditingTarget, setChildEditingTarget] = useState<string | null>(null);
  const [rawOnlineSessions, setRawOnlineSessions] = useState<ActiveSessionPresence[]>([]);
  const [presenceNowMs, setPresenceNowMs] = useState<number>(() => Date.now());

  // Real-Time Team Chat State
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [activeChatRoomId, setActiveChatRoomId] = useState<string>('global');
  const [chatMessages, setChatMessages] = useState<TeamChatMessage[]>([]);
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const [latestUnreadChat, setLatestUnreadChat] = useState<TeamChatMessage | null>(null);
  const [isChatBannerDismissed, setIsChatBannerDismissed] = useState<boolean>(false);
  const [viewerNickname, setViewerNickname] = useState<string>(() => {
    try {
      return sessionStorage.getItem('eng_viewer_chat_name') || '';
    } catch {
      return '';
    }
  });

  // Database State (Projects)
  const [projects, setProjects] = useState<EngineeringProject[]>(() => {
    const saved = localStorage.getItem('eng_projects');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_PROJECTS;
  });

  // KPI Multi-year State
  const [activeYear, setActiveYear] = useState<string>('2026');
  const [allYearsData, setAllYearsData] = useState<Record<string, KPIItem[]>>(() => {
    return {
      '2026': getBaseKPITemplate(),
      '2027': getBaseKPITemplate(),
      '2028': getBaseKPITemplate(),
      '2029': getBaseKPITemplate(),
      '2030': getBaseKPITemplate()
    };
  });

  // Review Cost & Error State
  const [reviewCostList, setReviewCostList] = useState<ReviewCostItem[]>(() => {
    try {
      const saved = localStorage.getItem('eng_review_cost');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading review cost from localStorage:', e);
    }
    return INITIAL_REVIEW_COST;
  });
  const [reviewErrorList, setReviewErrorList] = useState<ReviewErrorItem[]>(() => {
    try {
      const saved = localStorage.getItem('eng_review_error');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading review error from localStorage:', e);
    }
    return INITIAL_REVIEW_ERROR;
  });
  const [feedbackList, setFeedbackList] = useState<DesignFeedbackItem[]>(() => {
    try {
      const saved = localStorage.getItem('eng_design_feedback');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error loading feedback from localStorage:', e);
    }
    return INITIAL_FEEDBACK;
  });

  // Serah Terima Standart Part State
  const [standartPartList, setStandartPartList] = useState<SerahTerimaStandartPartItem[]>(() => {
    const saved = localStorage.getItem('standart_part_handovers');
    if (saved) {
      try {
        const parsed: SerahTerimaStandartPartItem[] = JSON.parse(saved);
        // Clear default dummy part names and placeholder dates if present from initial setup
        return parsed.map((item) => {
          const updated = { ...item };
          if (
            updated.partNames?.some((p) =>
              p.includes('Linear Bearing') ||
              p.includes('Pneumatic Cylinder') ||
              p.includes('Proximity Sensor') ||
              p.startsWith('Standard Part ')
            )
          ) {
            updated.partNames = [];
          }
          if (
            updated.distributionDate === '2026-10-18' ||
            updated.distributionDate === '2026-10-22' ||
            updated.distributionDate === '2026-10-26' ||
            updated.distributionDate === '2026-11-05'
          ) {
            updated.distributionDate = '';
          }
          if (updated.signature) {
            updated.signature = updated.signature.replace(/\(Diserahkan\)/gi, '(Diterima)');
            if (updated.signature.includes('(Lead Eng)') || updated.signature.includes('(Drafter)') || updated.signature.includes('(Manager)')) {
              updated.signature = updated.signature.replace(/\((Lead Eng|Drafter|Manager)\)/gi, '(Diterima)');
            }
          }
          return updated;
        });
      } catch (e) {
        console.error(e);
      }
    }
    return INITIAL_STANDART_PART_HANDOVERS;
  });

  // Audit Log State (persisted to localStorage)
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    try {
      const saved = localStorage.getItem('eng_kpi_audit_logs');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return [
      {
        id: 'log-1',
        timestamp: '2026-10-15 08:30:12',
        user: 'Andry Setyawan (Manager)',
        activity: 'Verifikasi & Pengesahan target KPI kuartal 4',
        year: '2026',
        month: 'Okt',
        newValue: 'Target Disahkan'
      },
      {
        id: 'log-2',
        timestamp: '2026-10-18 14:15:40',
        user: 'Fadil (Lead Engineer)',
        activity: 'Update capaian aktual On-Time Design',
        year: '2026',
        month: 'Okt',
        newValue: '97%'
      }
    ];
  });

  // KPI Approval Requests State (Supervisor submissions waiting for Manager approval)
  const [approvalRequests, setApprovalRequests] = useState<KPIApprovalRequest[]>(() => {
    try {
      const saved = localStorage.getItem('eng_kpi_approvals');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error loading approval requests from localStorage:', e);
    }
    return [];
  });

  // Modals state
  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<EngineeringProject | null>(null);

  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [uploadSpk, setUploadSpk] = useState<string | null>(null);

  const [isCadModalOpen, setIsCadModalOpen] = useState(false);
  const [cadModalData, setCadModalData] = useState<{ spk: string | null; projectName: string; customer: string }>({
    spk: null,
    projectName: 'Mechanical Assembly Jig Fixture',
    customer: 'PT. Astra International'
  });

  // Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3200);
  };

  // Apply & persist custom primary theme colors across reloads
  useEffect(() => {
    applyThemeToDocument(themeConfig);
    saveThemeConfig(themeConfig);
  }, [themeConfig]);

  // Refs for clean diffing outside React state setters
  const standartPartListRef = useRef<SerahTerimaStandartPartItem[]>(standartPartList);
  standartPartListRef.current = standartPartList;
  const projectsRef = useRef<EngineeringProject[]>(projects);
  projectsRef.current = projects;

  const currentIdentityKey = activeStaff ? `stf_${activeStaff.id}` : `ses_${sessionId}`;
  const currentChatDisplayName = activeStaff
    ? activeStaff.name
    : viewerNickname.trim() || 'Tamu (Viewer)';

  const isChatOpenRef = useRef<boolean>(isChatOpen);
  isChatOpenRef.current = isChatOpen;
  const activeChatRoomIdRef = useRef<string>(activeChatRoomId);
  activeChatRoomIdRef.current = activeChatRoomId;
  const currentIdentityKeyRef = useRef<string>(currentIdentityKey);
  currentIdentityKeyRef.current = currentIdentityKey;
  const currentSessionIdRef = useRef<string>(sessionId);
  currentSessionIdRef.current = sessionId;
  const seenChatIdsRef = useRef<Set<string>>(new Set());
  const chatInitializedRef = useRef<boolean>(false);

  // Initialize Service Worker & IndexedDB Offline Sync Queue Runtime
  useEffect(() => {
    const cleanup = initOfflineSyncRuntime();
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      readCachedDataFromIndexedDB<EngineeringProject[]>('eng_projects').then((cached) => {
        if (Array.isArray(cached) && cached.length > 0) {
          setProjects(cached);
        }
      });
    }
    return cleanup;
  }, []);

  // Real-time Firestore listener for Staff Accounts, Audit Logs, Presence & Team Chat
  useEffect(() => {
    let isMounted = true;
    let unsubStaff: (() => void) | undefined;

    seedStaffAccountsIfEmpty(INITIAL_STAFF_ACCOUNTS).finally(() => {
      if (!isMounted) return;
      unsubStaff = subscribeToFirestoreStaffAccounts((items) => {
        if (items.length > 0) {
          setStaffAccounts(items);
        }
      });
    });

    const unsubAuditLogs = subscribeToFirestoreAuditLogs((items) => {
      if (items.length > 0) {
        setAuditLogs(items);
      }
    });

    const unsubActiveSessions = subscribeToFirestoreActiveSessions((sessions) => {
      setRawOnlineSessions(sessions);
    });

    const unsubTeamChat = subscribeToFirestoreTeamChat((msgs) => {
      setChatMessages(msgs);

      if (!chatInitializedRef.current) {
        msgs.forEach((m) => seenChatIdsRef.current.add(m.id));
        chatInitializedRef.current = true;
        return;
      }

      const myIdKey = currentIdentityKeyRef.current;
      const mySessionId = currentSessionIdRef.current;
      const newlyUnreadRooms: Record<string, number> = {};
      let latestIncoming: TeamChatMessage | null = null;

      msgs.forEach((m) => {
        if (seenChatIdsRef.current.has(m.id)) return;
        seenChatIdsRef.current.add(m.id);

        const senderKey =
          m.senderStaffId !== 'viewer' ? `stf_${m.senderStaffId}` : `ses_${m.senderSessionId}`;
        const isFromMe = senderKey === myIdKey || m.senderSessionId === mySessionId;
        if (isFromMe) return;

        const isRelevantToMe =
          m.roomId === 'global' ||
          m.roomId.includes(`__${myIdKey}`) ||
          m.recipientKey === myIdKey;
        if (!isRelevantToMe) return;

        const isViewingThisRoom =
          isChatOpenRef.current && activeChatRoomIdRef.current === m.roomId;
        if (!isViewingThisRoom) {
          newlyUnreadRooms[m.roomId] = (newlyUnreadRooms[m.roomId] || 0) + 1;
          latestIncoming = m;
        }
      });

      if (Object.keys(newlyUnreadRooms).length > 0) {
        setUnreadByRoom((prev) => {
          const next = { ...prev };
          Object.entries(newlyUnreadRooms).forEach(([rId, cnt]) => {
            next[rId] = (next[rId] || 0) + cnt;
          });
          return next;
        });

        if (latestIncoming && !isChatOpenRef.current) {
          const incomingMsg: TeamChatMessage = latestIncoming;
          setLatestUnreadChat(incomingMsg);
          setIsChatBannerDismissed(false);
        }
      }
    });

    const tickTimer = setInterval(() => {
      setPresenceNowMs(Date.now());
    }, 10000);

    return () => {
      isMounted = false;
      if (unsubStaff) unsubStaff();
      unsubAuditLogs();
      unsubActiveSessions();
      unsubTeamChat();
      clearInterval(tickTimer);
    };
  }, []);

  // Reset child editing target whenever switching top-level views
  useEffect(() => {
    setChildEditingTarget(null);
  }, [currentView]);

  // Clear unread counter for active chat room whenever panel opens or room changes
  useEffect(() => {
    if (!isChatOpen) return;
    setUnreadByRoom((prev) => {
      if (!prev[activeChatRoomId]) return prev;
      const next = { ...prev };
      delete next[activeChatRoomId];
      return next;
    });
  }, [isChatOpen, activeChatRoomId]);

  const totalUnreadChatCount = Object.values(unreadByRoom).reduce((acc, n) => acc + n, 0);

  // Clear latest unread chat preview when all unread messages are cleared
  useEffect(() => {
    if (totalUnreadChatCount === 0) {
      setLatestUnreadChat(null);
      setIsChatBannerDismissed(false);
    }
  }, [totalUnreadChatCount]);

  // Blink browser tab title while unread incoming chat messages exist
  useEffect(() => {
    const defaultTitle = 'Monitoring Design & Drawing Engineering & KPI';
    if (typeof document === 'undefined') return;
    if (totalUnreadChatCount <= 0) {
      document.title = defaultTitle;
      return;
    }

    let toggle = false;
    document.title = `(${totalUnreadChatCount}) Chat Masuk! • EngMonitor`;
    const timer = setInterval(() => {
      toggle = !toggle;
      document.title = toggle
        ? defaultTitle
        : `🔔 (${totalUnreadChatCount}) Pesan Baru! • Chat Tim`;
    }, 950);

    return () => {
      clearInterval(timer);
      document.title = defaultTitle;
    };
  }, [totalUnreadChatCount]);

  const visibleChatMessages = chatMessages.filter(
    (m) =>
      m.roomId === 'global' ||
      m.roomId.includes(`__${currentIdentityKey}`) ||
      m.recipientKey === currentIdentityKey ||
      m.senderSessionId === sessionId ||
      (activeStaff && m.senderStaffId === activeStaff.id)
  );

  const handleChangeViewerNickname = (name: string) => {
    const cleaned = name.trim().slice(0, 40);
    setViewerNickname(cleaned);
    try {
      if (cleaned) {
        sessionStorage.setItem('eng_viewer_chat_name', cleaned);
      } else {
        sessionStorage.removeItem('eng_viewer_chat_name');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendChatMessage = async (payload: {
    roomId: string;
    text: string;
    recipientKey?: string;
    recipientName?: string;
    relatedSpk?: string;
    replyTo?: TeamChatMessage | null;
  }) => {
    const newMsg: TeamChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      roomId: payload.roomId,
      senderSessionId: sessionId,
      senderStaffId: activeStaff?.id || 'viewer',
      senderName: currentChatDisplayName,
      senderRole: userRole,
      ...(payload.recipientKey ? { recipientKey: payload.recipientKey } : {}),
      ...(payload.recipientName ? { recipientName: payload.recipientName } : {}),
      text: payload.text,
      ...(payload.relatedSpk ? { relatedSpk: payload.relatedSpk } : {}),
      ...(payload.replyTo
        ? {
            replyToId: payload.replyTo.id,
            replyToSender: payload.replyTo.senderName,
            replyToPreview: payload.replyTo.text.slice(0, 180)
          }
        : {}),
      createdAt: new Date().toISOString()
    };

    seenChatIdsRef.current.add(newMsg.id);
    setChatMessages((prev) => [...prev, newMsg].slice(-300));
    try {
      await sendTeamChatMessageToFirestore(newMsg);
    } catch (err) {
      console.warn('Firestore chat send error:', err);
      showToast('Gagal mengirim pesan chat ke server. Periksa koneksi Anda.', 'error');
    }
  };

  const handleDeleteChatMessage = async (messageId: string) => {
    setChatMessages((prev) => prev.filter((m) => m.id !== messageId));
    try {
      await deleteTeamChatMessageFromFirestore(messageId);
    } catch (err) {
      console.warn('Firestore chat delete error:', err);
      showToast('Gagal menghapus pesan chat.', 'error');
    }
  };

  const effectivePresenceView: ActiveSessionPresence['currentView'] =
    currentView === 'monitoring' && monitoringSubTab === 'standartPartHandover'
      ? 'standartPart'
      : currentView;

  const activeEditingTarget: string | null = isDataModalOpen
    ? editingProject
      ? `Edit Proyek ${editingProject.SPK} (${editingProject['Nama Project']})`
      : 'Tambah Proyek Monitoring Baru'
    : isUploadModalOpen
    ? `Upload CAD/PDF (${uploadSpk || 'Proyek'})`
    : childEditingTarget;

  const activeOnlineSessions = rawOnlineSessions.filter((s) => {
    const hb = Date.parse(s.lastHeartbeat);
    return !Number.isNaN(hb) && presenceNowMs - hb <= 150_000;
  });

  const lastPresenceSigRef = useRef<string>('');
  const lastPresenceAtRef = useRef<number>(0);

  // Real-time Heartbeat Publisher & Unload Cleanup (throttled to conserve Firestore quota)
  useEffect(() => {
    const publishPresence = (force = false) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      if (isFirestoreQuotaExceeded()) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;

      const staffId = activeStaff?.id || 'viewer';
      const staffName = activeStaff ? activeStaff.name : viewerNickname.trim() || 'Tamu (Viewer)';
      const role = activeStaff ? activeStaff.role : 'Viewer';
      const status: ActiveSessionPresence['status'] = activeEditingTarget ? 'editing' : 'online';
      const sig = `${staffId}|${staffName}|${role}|${status}|${effectivePresenceView}|${activeEditingTarget || ''}`;
      const now = Date.now();

      if (!force && sig === lastPresenceSigRef.current && now - lastPresenceAtRef.current < 45_000) {
        return;
      }

      lastPresenceSigRef.current = sig;
      lastPresenceAtRef.current = now;

      const payload: ActiveSessionPresence = {
        sessionId,
        staffId,
        staffName,
        role,
        status,
        currentView: effectivePresenceView,
        editingTarget: activeEditingTarget || undefined,
        deviceLabel,
        loggedInAt: sessionLoggedInAt,
        lastHeartbeat: new Date().toISOString()
      };
      upsertActiveSessionToFirestore(payload).catch((err) =>
        console.warn('Firestore presence upsert notice:', err)
      );
    };

    publishPresence(false);
    const hbInterval = setInterval(() => publishPresence(true), 60_000);
    const handleVisibilityOrFocus = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        publishPresence(false);
      }
    };
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    return () => {
      clearInterval(hbInterval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, [
    sessionId,
    activeStaff,
    viewerNickname,
    activeEditingTarget,
    effectivePresenceView,
    deviceLabel,
    sessionLoggedInAt
  ]);

  useEffect(() => {
    const handleLeave = () => {
      removeActiveSessionFromFirestore(sessionId).catch(() => {});
    };
    window.addEventListener('pagehide', handleLeave);
    window.addEventListener('beforeunload', handleLeave);
    return () => {
      window.removeEventListener('pagehide', handleLeave);
      window.removeEventListener('beforeunload', handleLeave);
    };
  }, [sessionId]);

  // Persist Staff Accounts & guard active logged-in staff session
  useEffect(() => {
    try {
      localStorage.setItem('eng_staff_accounts', JSON.stringify(staffAccounts));
    } catch (e) {
      console.error(e);
    }
    if (activeStaff) {
      const matched = staffAccounts.find((s) => s.id === activeStaff.id);
      if (!matched || !matched.isActive) {
        setActiveStaff(null);
        showToast('Akun staff Anda telah dinonaktifkan atau dihapus oleh Manager. Sesi kembali ke Viewer.', 'error');
      } else if (
        matched.pin !== activeStaff.pin ||
        matched.role !== activeStaff.role ||
        matched.name !== activeStaff.name
      ) {
        setActiveStaff(matched);
      }
    }
  }, [staffAccounts]);

  // Real-time Google Firebase Firestore Integration
  useEffect(() => {
    // 1. Seed database jika Firestore masih kosong pada instalasi awal
    seedFirestoreIfEmpty(INITIAL_PROJECTS);
    seedKPIsIfEmpty(activeYear, getBaseKPITemplate());

    // 2. Real-time Project Listener dari Firestore (overlay pending offline IndexedDB mutations agar tidak tertimpa)
    const unsubProjects = subscribeToFirestoreProjects(async (firestoreProjects) => {
      if (firestoreProjects && firestoreProjects.length > 0) {
        const pending = await getAllPendingMutations();
        if (pending.length === 0) {
          setProjects(firestoreProjects);
          return;
        }
        const merged = [...firestoreProjects];
        pending.forEach((mut) => {
          if (mut.type === 'project_save' && mut.payload?.project) {
            const p = mut.payload.project as EngineeringProject;
            const idx = merged.findIndex((x) => x.SPK === p.SPK);
            if (idx >= 0) merged[idx] = p;
            else merged.unshift(p);
          } else if (mut.type === 'checklist_update' && mut.payload?.spk) {
            const { spk, checklistKey, value, lastModifiedBy } = mut.payload;
            const idx = merged.findIndex((x) => x.SPK === spk);
            if (idx >= 0) {
              merged[idx] = {
                ...merged[idx],
                [checklistKey]: value,
                ...(lastModifiedBy ? { lastModifiedBy } : {}),
              };
            }
          } else if (mut.type === 'project_delete' && mut.payload?.spk) {
            const idx = merged.findIndex((x) => x.SPK === mut.payload.spk);
            if (idx >= 0) merged.splice(idx, 1);
          }
        });
        setProjects(merged);
      }
    });

    // 3. Real-time KPI Listener dari Firestore
    const unsubKpis = subscribeToFirestoreKPIs(activeYear, (kpiMap) => {
      if (Object.keys(kpiMap).length > 0) {
        setAllYearsData((prev) => {
          const currentList = prev[activeYear] || getBaseKPITemplate();
          const updatedList = currentList.map((item) => {
            if (kpiMap[item.id]) {
              return {
                ...item,
                months: { ...item.months, ...kpiMap[item.id] }
              };
            }
            return item;
          });
          return { ...prev, [activeYear]: updatedList };
        });
      }
    });

    // 4. Real-time Review Cost Listener (seluruh project & bulan dinamis)
    let isCostMounted = true;
    let unsubCost: (() => void) | undefined;
    seedReviewCostIfEmpty(INITIAL_REVIEW_COST).finally(() => {
      if (!isCostMounted) return;
      unsubCost = subscribeToFirestoreReviewCost((items) => {
        if (items.length > 0) {
          setReviewCostList(items);
        } else if (localStorage.getItem('eng_review_cost_seeded') === 'true') {
          setReviewCostList([]);
        }
      });
    });

    // 5. Real-time Review Error Listener (seluruh project & bulan dinamis)
    let isErrorMounted = true;
    let unsubError: (() => void) | undefined;
    seedReviewErrorIfEmpty(INITIAL_REVIEW_ERROR).finally(() => {
      if (!isErrorMounted) return;
      unsubError = subscribeToFirestoreReviewError((items) => {
        if (items.length > 0) {
          setReviewErrorList(items);
        } else if (localStorage.getItem('eng_review_error_seeded') === 'true') {
          setReviewErrorList([]);
        }
      });
    });

    // 6. Real-time Serah Terima Standart Part Listener
    seedStandartPartsIfEmpty(INITIAL_STANDART_PART_HANDOVERS);
    const unsubStandartParts = subscribeToFirestoreStandartParts((items) => {
      if (items && items.length > 0) {
        setStandartPartList(items);
      }
    });

    // 7. Real-time Design Quality Feedback Listener
    let isFeedbackMounted = true;
    let unsubFeedback: (() => void) | undefined;
    seedDesignFeedbackIfEmpty(INITIAL_FEEDBACK).finally(() => {
      if (!isFeedbackMounted) return;
      unsubFeedback = subscribeToFirestoreDesignFeedback((items) => {
        if (items.length > 0) {
          setFeedbackList(items);
        } else if (localStorage.getItem('eng_design_feedback_seeded') === 'true') {
          setFeedbackList([]);
        }
      });
    });

    // 8. Real-time KPI Supervisor Approval Requests Listener
    const unsubApprovals = subscribeToFirestoreApprovals((items) => {
      if (items.length > 0 || localStorage.getItem('eng_kpi_approvals_synced') === 'true') {
        setApprovalRequests(items);
        try {
          localStorage.setItem('eng_kpi_approvals_synced', 'true');
        } catch (e) {
          console.error(e);
        }
      }
    });

    return () => {
      isCostMounted = false;
      isErrorMounted = false;
      isFeedbackMounted = false;
      unsubProjects();
      unsubKpis();
      if (unsubCost) unsubCost();
      if (unsubError) unsubError();
      unsubStandartParts();
      if (unsubFeedback) unsubFeedback();
      unsubApprovals();
    };
  }, [activeYear]);

  // Persist projects to localStorage and IndexedDB as durable offline cache
  useEffect(() => {
    try {
      localStorage.setItem('eng_projects', JSON.stringify(projects));
    } catch (e) {
      console.error(e);
    }
    cacheDataInIndexedDB('eng_projects', projects);
  }, [projects]);

  // Persist Serah Terima Standart Part to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('standart_part_handovers', JSON.stringify(standartPartList));
    } catch (e) {
      console.error(e);
    }
  }, [standartPartList]);

  // Persist Design Quality Feedback to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('eng_design_feedback', JSON.stringify(feedbackList));
    } catch (e) {
      console.error(e);
    }
  }, [feedbackList]);

  // Persist Review Cost & Review Error to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('eng_review_cost', JSON.stringify(reviewCostList));
    } catch (e) {
      console.error(e);
    }
  }, [reviewCostList]);

  useEffect(() => {
    try {
      localStorage.setItem('eng_review_error', JSON.stringify(reviewErrorList));
    } catch (e) {
      console.error(e);
    }
  }, [reviewErrorList]);

  useEffect(() => {
    try {
      localStorage.setItem('eng_kpi_approvals', JSON.stringify(approvalRequests));
    } catch (e) {
      console.error(e);
    }
  }, [approvalRequests]);

  useEffect(() => {
    try {
      localStorage.setItem('eng_kpi_audit_logs', JSON.stringify(auditLogs));
    } catch (e) {
      console.error(e);
    }
  }, [auditLogs]);

  // Ensure appsScript view is strictly accessible only by Manager
  useEffect(() => {
    if (userRole !== 'Manager' && currentView === 'appsScript') {
      setCurrentView('monitoring');
    }
  }, [userRole, currentView]);

  // Formatting timestamp & active staff actor helpers
  const formatNowTimestamp = (): string => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  };

  const getActorLabel = (): string =>
    activeStaff ? `${activeStaff.name} (${activeStaff.role})` : 'Viewer (Read-Only)';

  const appendAuditLog = (entry: {
    module: NonNullable<AuditLog['module']>;
    actionType: NonNullable<AuditLog['actionType']>;
    target?: string;
    activity: string;
    oldValue?: string;
    newValue: string;
    year?: string;
    month?: string;
    actorOverride?: string;
  }) => {
    const nowStr = formatNowTimestamp();
    const d = new Date();
    const monthKeys = Object.keys(MONTH_FULL_NAMES);
    const currentMonthName = MONTH_FULL_NAMES[monthKeys[d.getMonth()]] || '-';
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: nowStr,
      user: entry.actorOverride || getActorLabel(),
      staffId: activeStaff?.id,
      staffName: activeStaff?.name,
      staffRole: activeStaff?.role || 'Viewer',
      module: entry.module,
      actionType: entry.actionType,
      target: entry.target,
      activity: entry.activity,
      year: entry.year || String(d.getFullYear()),
      month: entry.month || currentMonthName,
      oldValue: entry.oldValue,
      newValue: entry.newValue
    };

    setAuditLogs((prev) => [newLog, ...prev].slice(0, 500));
    saveAuditLogToFirestore(newLog).catch((err) =>
      console.warn('Firestore audit log save error:', err)
    );
  };

  // Staff Login / Logout & Manager PIN Administration Handlers
  const handleStaffLogin = (staff: StaffAccount) => {
    setActiveStaff(staff);
    setSessionLoggedInAt(new Date().toISOString());
    showToast(`Login berhasil sebagai ${staff.name} (${staff.role}). Setiap perubahan tercatat atas nama Anda.`, 'success');
  };

  const handleLogoutToViewer = () => {
    setActiveStaff(null);
    setSessionLoggedInAt(new Date().toISOString());
    showToast('Akses dikunci ke mode Viewer (Read-Only).', 'info');
  };

  const handleAddStaffAccount = (name: string, role: Exclude<UserRole, 'Viewer'>, pin: string) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang dapat menambahkan akun staff baru.', 'error');
      return;
    }
    const cleanName = name.trim();
    const cleanPin = pin.trim();
    if (cleanName.length < 2 || cleanPin.length < 4) {
      showToast('Nama staff minimal 2 karakter dan PIN minimal 4 karakter.', 'error');
      return;
    }
    if (staffAccounts.some((s) => s.pin.toLowerCase() === cleanPin.toLowerCase())) {
      showToast('PIN sudah digunakan oleh staff lain. Pilih PIN unik.', 'error');
      return;
    }
    const nowStr = formatNowTimestamp();
    const newStaff: StaffAccount = {
      id: `stf_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      role,
      pin: cleanPin,
      isActive: true,
      createdAt: nowStr,
      updatedAt: nowStr
    };
    setStaffAccounts((prev) => [...prev, newStaff]);
    saveStaffAccountToFirestore(newStaff).catch((err) =>
      console.warn('Firestore add staff error:', err)
    );
    appendAuditLog({
      module: 'Staff & PIN',
      actionType: 'pin',
      target: `${cleanName} (${role})`,
      activity: `Menambahkan akun staff baru "${cleanName}" (${role})`,
      newValue: 'Akun aktif & PIN pribadi dibuat'
    });
    showToast(`Akun staff ${cleanName} (${role}) berhasil dibuat dengan PIN ${cleanPin}!`, 'success');
  };

  const handleResetStaffPin = (staffId: string, newPin: string) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang dapat membuat ulang PIN staff.', 'error');
      return;
    }
    const target = staffAccounts.find((s) => s.id === staffId);
    if (!target) return;
    const cleanPin = newPin.trim();
    if (cleanPin.length < 4) {
      showToast('PIN baru minimal 4 karakter.', 'error');
      return;
    }
    if (staffAccounts.some((s) => s.id !== staffId && s.pin.toLowerCase() === cleanPin.toLowerCase())) {
      showToast('PIN baru bentrok dengan PIN staff lain.', 'error');
      return;
    }
    const nowStr = formatNowTimestamp();
    const updated: StaffAccount = {
      ...target,
      pin: cleanPin,
      updatedAt: nowStr
    };
    setStaffAccounts((prev) => prev.map((s) => (s.id === staffId ? updated : s)));
    saveStaffAccountToFirestore(updated).catch((err) =>
      console.warn('Firestore reset PIN error:', err)
    );
    appendAuditLog({
      module: 'Staff & PIN',
      actionType: 'pin',
      target: `${target.name} (${target.role})`,
      activity: `Manager membuat ulang PIN pribadi untuk ${target.name}`,
      oldValue: 'PIN sebelumnya',
      newValue: 'PIN baru ditetapkan oleh Manager'
    });
    showToast(`PIN baru untuk ${target.name} berhasil disimpan (${cleanPin}).`, 'success');
  };

  const handleUpdateStaffRole = (staffId: string, newRole: Exclude<UserRole, 'Viewer'>) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang dapat mengubah role akses staff.', 'error');
      return;
    }
    const target = staffAccounts.find((s) => s.id === staffId);
    if (!target || target.role === newRole) return;
    if (target.id === activeStaff?.id) {
      showToast('Tidak dapat mengubah role akun yang sedang digunakan login.', 'error');
      return;
    }
    const activeManagers = staffAccounts.filter((s) => s.role === 'Manager' && s.isActive);
    if (target.role === 'Manager' && target.isActive && newRole !== 'Manager' && activeManagers.length <= 1) {
      showToast('Minimal harus ada 1 akun Manager yang aktif.', 'error');
      return;
    }
    const nowStr = formatNowTimestamp();
    const updated: StaffAccount = {
      ...target,
      role: newRole,
      updatedAt: nowStr
    };
    setStaffAccounts((prev) => prev.map((s) => (s.id === staffId ? updated : s)));
    saveStaffAccountToFirestore(updated).catch((err) =>
      console.warn('Firestore update staff role error:', err)
    );
    appendAuditLog({
      module: 'Staff & PIN',
      actionType: 'update',
      target: `${target.name} (${newRole})`,
      activity: `Manager mengubah role akses ${target.name}`,
      oldValue: target.role,
      newValue: newRole
    });
    showToast(`Role ${target.name} berhasil diubah menjadi ${newRole}.`, 'success');
  };

  const handleToggleStaffActive = (staffId: string) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang dapat mengubah status akun staff.', 'error');
      return;
    }
    const target = staffAccounts.find((s) => s.id === staffId);
    if (!target) return;
    if (target.id === activeStaff?.id) {
      showToast('Tidak dapat menonaktifkan akun Manager yang sedang digunakan.', 'error');
      return;
    }
    const activeManagers = staffAccounts.filter((s) => s.role === 'Manager' && s.isActive);
    if (target.role === 'Manager' && target.isActive && activeManagers.length <= 1) {
      showToast('Minimal harus ada 1 akun Manager yang aktif.', 'error');
      return;
    }
    const nowStr = formatNowTimestamp();
    const nextActive = !target.isActive;
    const updated: StaffAccount = {
      ...target,
      isActive: nextActive,
      updatedAt: nowStr
    };
    setStaffAccounts((prev) => prev.map((s) => (s.id === staffId ? updated : s)));
    saveStaffAccountToFirestore(updated).catch((err) =>
      console.warn('Firestore toggle staff error:', err)
    );
    appendAuditLog({
      module: 'Staff & PIN',
      actionType: 'update',
      target: `${target.name} (${target.role})`,
      activity: `${nextActive ? 'Mengaktifkan' : 'Menonaktifkan'} akun staff ${target.name}`,
      oldValue: target.isActive ? 'Aktif' : 'Nonaktif',
      newValue: nextActive ? 'Aktif' : 'Nonaktif'
    });
    showToast(`Akun ${target.name} sekarang ${nextActive ? 'Aktif' : 'Nonaktif'}.`, 'info');
  };

  const handleDeleteStaffAccount = (staffId: string) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang dapat menghapus akun staff.', 'error');
      return;
    }
    const target = staffAccounts.find((s) => s.id === staffId);
    if (!target) return;
    if (target.id === activeStaff?.id) {
      showToast('Tidak dapat menghapus akun yang sedang login.', 'error');
      return;
    }
    const activeManagers = staffAccounts.filter((s) => s.role === 'Manager' && s.isActive);
    if (target.role === 'Manager' && target.isActive && activeManagers.length <= 1) {
      showToast('Minimal harus ada 1 akun Manager yang aktif.', 'error');
      return;
    }
    if (!window.confirm(`Hapus permanen akun staff "${target.name}" (${target.role})?`)) return;
    setStaffAccounts((prev) => prev.filter((s) => s.id !== staffId));
    deleteStaffAccountFromFirestore(staffId).catch((err) =>
      console.warn('Firestore delete staff error:', err)
    );
    appendAuditLog({
      module: 'Staff & PIN',
      actionType: 'delete',
      target: `${target.name} (${target.role})`,
      activity: `Menghapus akun staff "${target.name}"`,
      oldValue: `${target.name} (${target.role})`,
      newValue: 'Dihapus'
    });
    showToast(`Akun staff ${target.name} telah dihapus.`, 'info');
  };

  // Project CRUD operations (Synchronized with Google Firebase Firestore)
  const handleSaveProject = (formData: Partial<EngineeringProject>, isEdit: boolean) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer hanya bisa melihat dan tidak bisa mengedit data.', 'error');
      return;
    }
    const actor = getActorLabel();
    const nowStr = formatNowTimestamp();

    const normalizedInputSpk = String(formData.SPK || '').trim();

    if (isEdit && editingProject) {
      const nextSpk = normalizedInputSpk || editingProject.SPK;
      const nextRequiredChecklists =
        userRole === 'Manager' && Array.isArray(formData.requiredChecklists)
          ? getProjectRequiredChecklists({ requiredChecklists: formData.requiredChecklists })
          : editingProject.requiredChecklists;

      const updatedProject: EngineeringProject = {
        ...editingProject,
        ...formData,
        SPK: nextSpk,
        ...(nextRequiredChecklists !== undefined ? { requiredChecklists: nextRequiredChecklists } : {}),
        lastModifiedBy: actor,
        lastModifiedAt: nowStr
      };
      setProjects((prev) =>
        prev.map((p) => (p.SPK === editingProject.SPK ? updatedProject : p))
      );
      if (nextSpk !== editingProject.SPK) {
        deleteProjectFromFirestore(editingProject.SPK).catch(() => {});
      }
      saveProjectToFirestore(updatedProject).catch((err) => console.warn('Firestore save error:', err));

      // Detect modified fields for Audit Log
      const trackedFields: Array<keyof EngineeringProject> = [
        'Bulan', 'Nomor PO', 'Customer', 'Status', 'Delivery Time', 'Nama Project',
        'PIC', 'Qty Drawing', 'Permintaan Drawing/Design', 'Target Design',
        'Tanggal Penyelesaian', 'Aktual Engineering', 'keterangan'
      ];
      const oldChanges: string[] = [];
      const newChanges: string[] = [];
      trackedFields.forEach((field) => {
        const prevVal = String(editingProject[field] ?? '');
        const nextVal = String(updatedProject[field] ?? '');
        if (prevVal !== nextVal) {
          oldChanges.push(`${String(field)}: ${prevVal || '-'}`);
          newChanges.push(`${String(field)}: ${nextVal || '-'}`);
        }
      });

      const prevReqList = getProjectRequiredChecklists(editingProject);
      const nextReqList = getProjectRequiredChecklists(updatedProject);
      if (prevReqList.join(', ') !== nextReqList.join(', ')) {
        oldChanges.push(`Checklist Wajib: ${prevReqList.length} item`);
        newChanges.push(`Checklist Wajib: ${nextReqList.length} item`);
      }

      appendAuditLog({
        module: 'Monitoring',
        actionType: 'update',
        target: updatedProject.SPK,
        activity: `Edit proyek ${updatedProject.SPK} (${updatedProject['Nama Project']})`,
        oldValue: oldChanges.length > 0 ? oldChanges.join(' | ') : undefined,
        newValue: newChanges.length > 0 ? newChanges.join(' | ') : 'Data disimpan ulang',
        month: updatedProject.Bulan
      });

      // If Supervisor modified requiredChecklists inside DataModal, submit Manager approval request
      if (userRole === 'Supervisor' && Array.isArray(formData.requiredChecklists)) {
        const proposedList = getProjectRequiredChecklists({ requiredChecklists: formData.requiredChecklists });
        if (proposedList.join(', ') !== prevReqList.join(', ')) {
          handleSubmitApprovalRequest({
            category: 'checklist_scope',
            categoryLabel: 'Pengaturan Checklist Wajib SPK',
            targetLabel: `${updatedProject.SPK} (${updatedProject['Nama Project']})`,
            summaryOld: `${prevReqList.length}/14 item (${prevReqList.join(', ') || 'Tanpa Checklist'})`,
            summaryNew: `${proposedList.length}/14 item (${proposedList.join(', ') || 'Tanpa Checklist'})`,
            payload: {
              projectSpk: updatedProject.SPK,
              month: updatedProject.Bulan,
              requiredChecklists: proposedList
            }
          });
        } else {
          showToast(`Data SPK ${updatedProject.SPK} berhasil diperbarui di Firebase.`);
        }
      } else {
        showToast(`Data SPK ${updatedProject.SPK} berhasil diperbarui di Firebase.`);
      }
    } else {
      const targetSpk =
        normalizedInputSpk || `SPK-${new Date().getFullYear()}-${String(projects.length + 1).padStart(3, '0')}`;
      const existingBySpk = projectsRef.current.find(
        (p) => String(p.SPK || '').trim().toLowerCase() === targetSpk.toLowerCase()
      );

      if (existingBySpk) {
        const mergedRequiredChecklists =
          userRole === 'Manager' && Array.isArray(formData.requiredChecklists)
            ? getProjectRequiredChecklists({ requiredChecklists: formData.requiredChecklists })
            : existingBySpk.requiredChecklists;

        const mergedProject: EngineeringProject = {
          ...existingBySpk,
          ...formData,
          SPK: existingBySpk.SPK,
          ...(mergedRequiredChecklists !== undefined ? { requiredChecklists: mergedRequiredChecklists } : {}),
          lastModifiedBy: actor,
          lastModifiedAt: nowStr
        };

        setProjects((prev) =>
          prev.map((p) => (p.SPK === existingBySpk.SPK ? mergedProject : p))
        );
        saveProjectToFirestore(mergedProject).catch((err) => console.warn('Firestore save error:', err));
        appendAuditLog({
          module: 'Monitoring',
          actionType: 'update',
          target: mergedProject.SPK,
          activity: `Perbarui SPK lama ${mergedProject.SPK} (${mergedProject['Nama Project']})`,
          newValue: `${mergedProject.Customer} • PIC: ${mergedProject.PIC} • Qty: ${mergedProject['Qty Drawing']}`,
          month: mergedProject.Bulan
        });
        showToast(`SPK lama ${mergedProject.SPK} berhasil diperbarui tanpa duplikasi (checklist tetap terjaga).`);
        setIsDataModalOpen(false);
        setEditingProject(null);
        return;
      }

      const initialRequired =
        userRole === 'Manager' && Array.isArray(formData.requiredChecklists)
          ? getProjectRequiredChecklists({ requiredChecklists: formData.requiredChecklists })
          : [...CHECKLIST_KEYS];

      const newProject: EngineeringProject = {
        No: projects.length + 1,
        Bulan: formData.Bulan || 'Oktober',
        SPK: targetSpk,
        'Nomor PO': formData['Nomor PO'] || `PO/${new Date().getFullYear()}/${String(projects.length + 1).padStart(3, '0')}`,
        Customer: formData.Customer || 'Klien Baru',
        Status: (formData.Status as any) || 'In Progress',
        'Delivery Time': formData['Delivery Time'] || new Date().toISOString().split('T')[0],
        'Nama Project': formData['Nama Project'] || 'Project Baru',
        PIC: formData.PIC || 'Engineer',
        'Qty Drawing': formData['Qty Drawing'] || 1,
        'Permintaan Drawing/Design': formData['Permintaan Drawing/Design'] || new Date().toISOString().split('T')[0],
        'Target Design': formData['Target Design'] || new Date().toISOString().split('T')[0],
        'Tanggal Penyelesaian': formData['Tanggal Penyelesaian'] || '',
        'Aktual Engineering': formData['Aktual Engineering'] || '',
        'File CAD Drive': formData['File CAD Drive'] || '',
        'Konsep 3D/2D': '',
        APPROVAL: '',
        '3D': '',
        '2D': '',
        'LIST STANDARD PART': '',
        'list material': '',
        IRD: '',
        Squence: '',
        animation: '',
        dokumentasi: '',
        'layout pengiriman': '',
        'drawing box pengiriman': '',
        simulation: '',
        penawaran: '',
        keterangan: formData.keterangan || '',
        requiredChecklists: initialRequired,
        lastModifiedBy: actor,
        lastModifiedAt: nowStr
      };

      setProjects((prev) => [newProject, ...prev]);
      saveProjectToFirestore(newProject).catch((err) => console.warn('Firestore add error:', err));
      appendAuditLog({
        module: 'Monitoring',
        actionType: 'create',
        target: newProject.SPK,
        activity: `Tambah proyek baru ${newProject.SPK} (${newProject['Nama Project']})`,
        newValue: `${newProject.Customer} • PIC: ${newProject.PIC} • Qty: ${newProject['Qty Drawing']} • Checklist: ${initialRequired.length}/14`,
        month: newProject.Bulan
      });

      if (userRole === 'Supervisor' && Array.isArray(formData.requiredChecklists)) {
        const proposedList = getProjectRequiredChecklists({ requiredChecklists: formData.requiredChecklists });
        if (proposedList.length !== CHECKLIST_KEYS.length) {
          handleSubmitApprovalRequest({
            category: 'checklist_scope',
            categoryLabel: 'Pengaturan Checklist Wajib SPK',
            targetLabel: `${newProject.SPK} (${newProject['Nama Project']})`,
            summaryOld: `14/14 item (Semua Checklist Default)`,
            summaryNew: `${proposedList.length}/14 item (${proposedList.join(', ') || 'Tanpa Checklist'})`,
            payload: {
              projectSpk: newProject.SPK,
              month: newProject.Bulan,
              requiredChecklists: proposedList
            }
          });
        } else {
          showToast(`Data proyek SPK ${newProject.SPK} tersimpan ke Google Firebase Firestore!`);
        }
      } else {
        showToast(`Data proyek SPK ${newProject.SPK} tersimpan ke Google Firebase Firestore!`);
      }
    }

    setIsDataModalOpen(false);
    setEditingProject(null);
  };

  const handleDeleteProject = (spk: string) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang berhak menghapus data!', 'error');
      return;
    }
    const targetProject = projectsRef.current.find((p) => p.SPK === spk);
    if (window.confirm(`Hapus permanen proyek ${spk}?`)) {
      setProjects((prev) => prev.filter((p) => p.SPK !== spk));
      deleteProjectFromFirestore(spk).catch((err) => console.warn('Firestore delete error:', err));
      appendAuditLog({
        module: 'Monitoring',
        actionType: 'delete',
        target: spk,
        activity: `Hapus permanen proyek ${spk}`,
        oldValue: targetProject
          ? `${targetProject['Nama Project']} (${targetProject.Customer})`
          : spk,
        newValue: 'Dihapus',
        month: targetProject?.Bulan
      });
      showToast(`Proyek ${spk} telah dihapus dari Firebase.`, 'info');
    }
  };

  const handleUpdateRequiredChecklists = (spk: string, requiredKeys: ChecklistKey[]) => {
    const targetProject = projectsRef.current.find((p) => p.SPK === spk);
    if (!targetProject) return;

    const cleanKeys = getProjectRequiredChecklists({ requiredChecklists: requiredKeys });
    const oldKeys = getProjectRequiredChecklists(targetProject);

    if (userRole === 'Supervisor') {
      if (cleanKeys.join(', ') === oldKeys.join(', ')) {
        showToast('Tidak ada perubahan item checklist yang diajukan.', 'info');
        return;
      }
      handleSubmitApprovalRequest({
        category: 'checklist_scope',
        categoryLabel: 'Pengaturan Checklist Wajib SPK',
        targetLabel: `${spk} (${targetProject['Nama Project']})`,
        summaryOld: `${oldKeys.length}/14 item (${oldKeys.join(', ') || 'Tanpa Checklist'})`,
        summaryNew: `${cleanKeys.length}/14 item (${cleanKeys.join(', ') || 'Tanpa Checklist'})`,
        payload: {
          projectSpk: spk,
          month: targetProject.Bulan,
          requiredChecklists: cleanKeys
        }
      });
      return;
    }

    if (userRole !== 'Manager') {
      showToast('Hanya Manager atau Supervisor (dengan persetujuan Manager) yang dapat mengatur checklist wajib!', 'error');
      return;
    }

    const actor = getActorLabel();
    const nowStr = formatNowTimestamp();

    const updatedProject: EngineeringProject = {
      ...targetProject,
      requiredChecklists: cleanKeys,
      lastModifiedBy: actor,
      lastModifiedAt: nowStr
    };

    setProjects((prev) => prev.map((p) => (p.SPK === spk ? updatedProject : p)));
    saveProjectToFirestore(updatedProject).catch((err) =>
      console.warn('Firestore checklist scope save error:', err)
    );

    appendAuditLog({
      module: 'Monitoring',
      actionType: 'checklist',
      target: spk,
      activity: `Atur checklist wajib proyek ${spk} (${targetProject['Nama Project']})`,
      oldValue: `${oldKeys.length}/14 item wajib`,
      newValue: `${cleanKeys.length}/14 item wajib (${cleanKeys.join(', ') || 'Tanpa checklist'})`,
      month: targetProject.Bulan
    });

    showToast(`Checklist wajib ${spk} diperbarui: ${cleanKeys.length} dari ${CHECKLIST_KEYS.length} item aktif.`);
  };

  const handleChecklistToggle = (spk: string, key: ChecklistKey, isChecked: boolean) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengubah status checklist.', 'error');
      return;
    }
    const targetProject = projectsRef.current.find((p) => p.SPK === spk);
    if (targetProject && !getProjectRequiredChecklists(targetProject).includes(key)) {
      showToast(`Item "${key}" ditandai N/A (tidak diwajibkan oleh Manager untuk ${spk}).`, 'error');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const val = isChecked ? today : '';
    const actor = getActorLabel();
    const nowStr = formatNowTimestamp();
    const oldVal = targetProject ? targetProject[key] || '' : '';

    setProjects((prev) =>
      prev.map((p) => {
        if (p.SPK === spk) {
          return {
            ...p,
            [key]: val,
            lastModifiedBy: actor,
            lastModifiedAt: nowStr
          };
        }
        return p;
      })
    );
    updateChecklistInFirestore(spk, key, val, actor).catch((err) => console.warn('Firestore checklist error:', err));
    appendAuditLog({
      module: 'Monitoring',
      actionType: 'checklist',
      target: spk,
      activity: `Ubah checklist "${key}" pada ${spk}`,
      oldValue: oldVal || 'Belum dicentang',
      newValue: val || 'Dibatalkan',
      month: targetProject?.Bulan
    });
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      showToast(`Mode Offline: Checklist "${key}" (${spk}) masuk antrean IndexedDB & akan otomatis dikirim saat online.`, 'info');
    } else {
      showToast(`Checklist "${key}" pada ${spk} tersimpan ke Firebase.`);
    }
  };

  const handleChecklistDateChange = (spk: string, key: ChecklistKey, date: string) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengubah tanggal checklist.', 'error');
      return;
    }
    const targetProject = projectsRef.current.find((p) => p.SPK === spk);
    if (targetProject && !getProjectRequiredChecklists(targetProject).includes(key)) {
      showToast(`Item "${key}" ditandai N/A (tidak diwajibkan oleh Manager untuk ${spk}).`, 'error');
      return;
    }
    const actor = getActorLabel();
    const nowStr = formatNowTimestamp();
    const oldVal = targetProject ? targetProject[key] || '' : '';

    setProjects((prev) =>
      prev.map((p) => {
        if (p.SPK === spk) {
          return {
            ...p,
            [key]: date,
            lastModifiedBy: actor,
            lastModifiedAt: nowStr
          };
        }
        return p;
      })
    );
    updateChecklistInFirestore(spk, key, date, actor).catch((err) => console.warn('Firestore date error:', err));
    appendAuditLog({
      module: 'Monitoring',
      actionType: 'checklist',
      target: spk,
      activity: `Ubah tanggal checklist "${key}" pada ${spk}`,
      oldValue: oldVal || 'Kosong',
      newValue: date || 'Dikosongkan',
      month: targetProject?.Bulan
    });
  };

  const handleUploadSuccess = (spk: string, fileUrl: string, fileName: string) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengunggah file.', 'error');
      return;
    }
    const actor = getActorLabel();
    const nowStr = formatNowTimestamp();
    const targetProject = projectsRef.current.find((p) => p.SPK === spk);

    setProjects((prev) =>
      prev.map((p) => {
        if (p.SPK === spk) {
          return {
            ...p,
            'File CAD Drive': fileUrl,
            lastModifiedBy: actor,
            lastModifiedAt: nowStr
          };
        }
        return p;
      })
    );
    updateChecklistInFirestore(spk, 'File CAD Drive', fileUrl, actor).catch((err) => console.warn('Firestore CAD error:', err));
    appendAuditLog({
      module: 'Monitoring',
      actionType: 'upload',
      target: spk,
      activity: `Upload file CAD/PDF "${fileName}" pada ${spk}`,
      oldValue: targetProject?.['File CAD Drive'] ? 'File sebelumnya' : 'Belum ada file',
      newValue: fileName,
      month: targetProject?.Bulan
    });
    showToast(`File CAD "${fileName}" tersimpan ke Drive & Firebase untuk ${spk}!`);
  };

  const handleUpdateActual = (
    year: string,
    kpiId: number,
    month: string,
    val: number | null,
    keterangan: string
  ) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengubah nilai capaian KPI.', 'error');
      return;
    }
    if (userRole === 'Supervisor') {
      showToast('Perubahan KPI oleh Supervisor harus melalui Persetujuan Manager.', 'error');
      return;
    }
    const prevKpiItem = (allYearsData[year] || []).find((item) => item.id === kpiId);
    const oldVal = prevKpiItem?.months?.[month];

    setAllYearsData((prev) => {
      const yearList = prev[year] || getBaseKPITemplate();
      const updatedList = yearList.map((item) => {
        if (item.id === kpiId) {
          const updatedMonths = {
            ...item.months,
            [month]: val
          };
          saveKPIMonthToFirestore(year, kpiId, updatedMonths).catch((err) =>
            console.warn('Firestore KPI save error:', err)
          );
          return {
            ...item,
            months: updatedMonths,
            keterangan: keterangan || item.keterangan
          };
        }
        return item;
      });
      return {
        ...prev,
        [year]: updatedList
      };
    });

    appendAuditLog({
      module: 'KPI',
      actionType: 'update',
      target: `KPI #${kpiId}`,
      activity: `Perbarui nilai KPI ID #${kpiId} (${month} ${year})`,
      year,
      month,
      oldValue: oldVal !== null && oldVal !== undefined ? String(oldVal) : 'Kosong',
      newValue: val !== null ? `${val}` : 'Dihapus'
    });

    showToast(`Nilai KPI ${month} ${year} berhasil disimpan ke Firebase Firestore!`);
  };

  const handleUpdateReviewCost = (
    updater: ReviewCostItem[] | ((prev: ReviewCostItem[]) => ReviewCostItem[])
  ) => {
    if (userRole === 'Viewer' || userRole === 'Supervisor') {
      showToast(
        userRole === 'Supervisor'
          ? 'Perubahan Review Cost oleh Supervisor harus melalui Persetujuan Manager.'
          : 'Akses Dibatasi: Role Viewer tidak dapat mengubah data Review Cost.',
        'error'
      );
      return;
    }
    const prevSnapshot = reviewCostList;
    const resolved = typeof updater === 'function' ? updater(prevSnapshot) : updater;
    setReviewCostList(resolved);

    try {
      localStorage.setItem('eng_review_cost', JSON.stringify(resolved));
      localStorage.setItem('eng_review_cost_seeded', 'true');
    } catch (e) {
      console.error(e);
    }

    resolved.forEach((item) => {
      saveReviewCostToFirestore(item).catch((err) =>
        console.warn('Firestore Review Cost save error:', err)
      );
    });

    prevSnapshot.forEach((oldItem) => {
      const stillExists = resolved.some(
        (newItem) =>
          newItem.month === oldItem.month &&
          newItem.customer === oldItem.customer &&
          newItem.projectName === oldItem.projectName
      );
      if (!stillExists) {
        deleteReviewCostFromFirestore(oldItem).catch((err) =>
          console.warn('Firestore Review Cost delete error:', err)
        );
      }
    });

    appendAuditLog({
      module: 'KPI',
      actionType: 'update',
      target: 'Review Cost Efficiency',
      activity: 'Perbarui data Anggaran & Pengeluaran Design',
      oldValue: `${prevSnapshot.length} record proyek`,
      newValue: `${resolved.length} record proyek`
    });

    showToast('Data Anggaran & Pengeluaran Design berhasil disimpan ke Cloud & Local Storage!', 'success');
  };

  const handleUpdateReviewError = (
    updater: ReviewErrorItem[] | ((prev: ReviewErrorItem[]) => ReviewErrorItem[])
  ) => {
    if (userRole === 'Viewer' || userRole === 'Supervisor') {
      showToast(
        userRole === 'Supervisor'
          ? 'Perubahan Review Error oleh Supervisor harus melalui Persetujuan Manager.'
          : 'Akses Dibatasi: Role Viewer tidak dapat mengubah data Review Error.',
        'error'
      );
      return;
    }
    const prevSnapshot = reviewErrorList;
    const resolved = typeof updater === 'function' ? updater(prevSnapshot) : updater;
    setReviewErrorList(resolved);

    try {
      localStorage.setItem('eng_review_error', JSON.stringify(resolved));
      localStorage.setItem('eng_review_error_seeded', 'true');
    } catch (e) {
      console.error(e);
    }

    resolved.forEach((item) => {
      saveReviewErrorToFirestore(item).catch((err) =>
        console.warn('Firestore Review Error save error:', err)
      );
    });

    prevSnapshot.forEach((oldItem) => {
      const stillExists = resolved.some(
        (newItem) =>
          newItem.month === oldItem.month &&
          newItem.customer === oldItem.customer &&
          newItem.projectName === oldItem.projectName
      );
      if (!stillExists) {
        deleteReviewErrorFromFirestore(oldItem).catch((err) =>
          console.warn('Firestore Review Error delete error:', err)
        );
      }
    });

    appendAuditLog({
      module: 'KPI',
      actionType: 'update',
      target: 'Design Error Rate',
      activity: 'Perbarui data Review Error Design',
      oldValue: `${prevSnapshot.length} record proyek`,
      newValue: `${resolved.length} record proyek`
    });

    showToast('Data Design Error Rate berhasil disimpan ke Cloud & Local Storage!', 'success');
  };

  const handleUpdateStandartPartList = (
    updater: SerahTerimaStandartPartItem[] | ((prev: SerahTerimaStandartPartItem[]) => SerahTerimaStandartPartItem[])
  ) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengubah Serah Terima Standart Part.', 'error');
      return;
    }
    const prev = standartPartListRef.current;
    const resolved = typeof updater === 'function' ? updater(prev) : updater;
    const actor = getActorLabel();
    const nowStr = formatNowTimestamp();

    const prevMap = new Map<string, SerahTerimaStandartPartItem>();
    prev.forEach((p) => prevMap.set(p.id, p));

    const resolvedIds = new Set(resolved.map((i) => i.id));
    const stampedResolved = resolved.map((item) => {
      const oldItem = prevMap.get(item.id);
      if (!oldItem) {
        const stampedNew: SerahTerimaStandartPartItem = {
          ...item,
          lastModifiedBy: actor,
          lastModifiedAt: nowStr
        };
        saveStandartPartToFirestore(stampedNew).catch((err) =>
          console.warn('Firestore Standart Part create error:', err)
        );
        appendAuditLog({
          module: 'Standart Part',
          actionType: 'create',
          target: stampedNew.projectName || stampedNew.id,
          activity: `Tambah data Serah Terima Standart Part "${stampedNew.projectName}"`,
          newValue: `${stampedNew.customer || '-'} • ${stampedNew.partNames?.length || 0} part`,
          month: stampedNew.month
        });
        return stampedNew;
      }

      const oldAttIds = (oldItem.partAttachments || []).map((a) => a.id).join(',');
      const newAttIds = (item.partAttachments || []).map((a) => a.id).join(',');
      const hasChanged =
        oldItem.projectName !== item.projectName ||
        oldItem.customer !== item.customer ||
        oldItem.month !== item.month ||
        oldItem.distributionDate !== item.distributionDate ||
        oldItem.distributionTime !== item.distributionTime ||
        oldItem.division !== item.division ||
        oldItem.signature !== item.signature ||
        (oldItem.notes || '') !== (item.notes || '') ||
        JSON.stringify(oldItem.prepareStaff || []) !== JSON.stringify(item.prepareStaff || []) ||
        JSON.stringify(oldItem.partNames || []) !== JSON.stringify(item.partNames || []) ||
        oldAttIds !== newAttIds;

      if (hasChanged) {
        const stampedUpdated: SerahTerimaStandartPartItem = {
          ...item,
          lastModifiedBy: actor,
          lastModifiedAt: nowStr
        };
        saveStandartPartToFirestore(stampedUpdated).catch((err) =>
          console.warn('Firestore Standart Part update error:', err)
        );

        const oldDiffs: string[] = [];
        const newDiffs: string[] = [];
        if (JSON.stringify(oldItem.partNames || []) !== JSON.stringify(item.partNames || [])) {
          oldDiffs.push(`Parts(${oldItem.partNames?.length || 0}): ${(oldItem.partNames || []).join('; ') || '-'}`);
          newDiffs.push(`Parts(${item.partNames?.length || 0}): ${(item.partNames || []).join('; ') || '-'}`);
        }
        if (oldAttIds !== newAttIds) {
          oldDiffs.push(`Lampiran: ${oldItem.partAttachments?.length || 0} file`);
          newDiffs.push(`Lampiran: ${item.partAttachments?.length || 0} file`);
        }
        if (JSON.stringify(oldItem.prepareStaff || []) !== JSON.stringify(item.prepareStaff || [])) {
          oldDiffs.push(`Prepare: ${(oldItem.prepareStaff || []).join(', ') || '-'}`);
          newDiffs.push(`Prepare: ${(item.prepareStaff || []).join(', ') || '-'}`);
        }
        if (oldItem.distributionDate !== item.distributionDate) {
          oldDiffs.push(`Tgl: ${oldItem.distributionDate || '-'}`);
          newDiffs.push(`Tgl: ${item.distributionDate || '-'}`);
        }
        if (oldItem.distributionTime !== item.distributionTime) {
          oldDiffs.push(`Jam: ${oldItem.distributionTime || '-'}`);
          newDiffs.push(`Jam: ${item.distributionTime || '-'}`);
        }
        if (oldItem.division !== item.division) {
          oldDiffs.push(`Divisi: ${oldItem.division || '-'}`);
          newDiffs.push(`Divisi: ${item.division || '-'}`);
        }
        if (oldItem.signature !== item.signature) {
          oldDiffs.push(`Penerima: ${oldItem.signature || '-'}`);
          newDiffs.push(`Penerima: ${item.signature || '-'}`);
        }
        if (oldItem.projectName !== item.projectName || oldItem.customer !== item.customer) {
          oldDiffs.push(`${oldItem.projectName} (${oldItem.customer})`);
          newDiffs.push(`${item.projectName} (${item.customer})`);
        }

        appendAuditLog({
          module: 'Standart Part',
          actionType: oldAttIds !== newAttIds && oldDiffs.length === 1 ? 'upload' : 'update',
          target: stampedUpdated.projectName || stampedUpdated.id,
          activity: `Update Standart Part "${stampedUpdated.projectName}"`,
          oldValue: oldDiffs.join(' | ') || undefined,
          newValue: newDiffs.join(' | ') || 'Diperbarui',
          month: stampedUpdated.month
        });
        return stampedUpdated;
      }

      return item;
    });

    // Delete items removed from list
    prev.forEach((oldItem) => {
      if (!resolvedIds.has(oldItem.id)) {
        deleteStandartPartFromFirestore(oldItem.id).catch((err) =>
          console.warn('Firestore Standart Part delete error:', err)
        );
        appendAuditLog({
          module: 'Standart Part',
          actionType: 'delete',
          target: oldItem.projectName || oldItem.id,
          activity: `Hapus form Standart Part "${oldItem.projectName}"`,
          oldValue: `${oldItem.projectName} (${oldItem.customer})`,
          newValue: 'Dihapus',
          month: oldItem.month
        });
      }
    });

    standartPartListRef.current = stampedResolved;
    setStandartPartList(stampedResolved);
  };

  const handleUpdateFeedback = (
    updater: DesignFeedbackItem[] | ((prev: DesignFeedbackItem[]) => DesignFeedbackItem[])
  ) => {
    if (userRole === 'Viewer' || userRole === 'Supervisor') {
      showToast(
        userRole === 'Supervisor'
          ? 'Perubahan Design Quality oleh Supervisor harus melalui Persetujuan Manager.'
          : 'Akses Dibatasi: Role Viewer tidak dapat mengubah data feedback.',
        'error'
      );
      return;
    }
    const prevSnapshot = feedbackList;
    const resolved = typeof updater === 'function' ? updater(prevSnapshot) : updater;
    setFeedbackList(resolved);

    try {
      localStorage.setItem('eng_design_feedback', JSON.stringify(resolved));
      localStorage.setItem('eng_design_feedback_seeded', 'true');
    } catch (e) {
      console.error(e);
    }

    resolved.forEach((item) => {
      saveDesignFeedbackToFirestore(item).catch((err) =>
        console.warn('Firestore Design Feedback save error:', err)
      );
    });

    // Hapus record di Firestore jika item dihapus dari daftar
    prevSnapshot.forEach((oldItem) => {
      const stillExists = resolved.some(
        (newItem) =>
          newItem.month === oldItem.month &&
          newItem.customer === oldItem.customer &&
          newItem.projectName === oldItem.projectName
      );
      if (!stillExists) {
        deleteDesignFeedbackFromFirestore(oldItem).catch((err) =>
          console.warn('Firestore Design Feedback delete error:', err)
        );
      }
    });

    appendAuditLog({
      module: 'KPI',
      actionType: 'update',
      target: 'Design Quality Feedback',
      activity: 'Perbarui data Feedback Design Quality',
      oldValue: `${prevSnapshot.length} record feedback`,
      newValue: `${resolved.length} record feedback`
    });

    showToast('Feedback Design Quality berhasil disimpan ke Cloud & Local Storage!', 'success');
  };

  const handleSyncCloud = () => {
    showToast('Menghubungkan ke Google Firebase Firestore... Data tersinkronisasi!', 'success');
  };

  const handleUpdateProject = (updated: EngineeringProject) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengubah data proyek.', 'error');
      return;
    }
    if (userRole === 'Supervisor') {
      showToast('Perubahan KPI proyek oleh Supervisor harus melalui Persetujuan Manager.', 'error');
      return;
    }
    const actor = getActorLabel();
    const nowStr = formatNowTimestamp();
    const stampedUpdated: EngineeringProject = {
      ...updated,
      lastModifiedBy: actor,
      lastModifiedAt: nowStr
    };
    setProjects((prev) => prev.map((p) => (p.SPK === updated.SPK ? stampedUpdated : p)));
    saveProjectToFirestore(stampedUpdated).catch((err) => console.warn('Firestore update error:', err));
    appendAuditLog({
      module: 'Monitoring',
      actionType: 'update',
      target: updated.SPK,
      activity: `Update data KPI proyek ${updated.SPK} (${updated['Nama Project']})`,
      newValue: `${updated.Status} • Aktual: ${updated['Aktual Engineering'] || '-'}`,
      month: updated.Bulan
    });
    showToast(`Data proyek ${updated.SPK} berhasil diperbarui di Firebase.`);
  };

  // Submit Supervisor Input Request (Menunggu Persetujuan Manager)
  const handleSubmitApprovalRequest = (
    input: Omit<KPIApprovalRequest, 'id' | 'requestedBy' | 'requestedAt' | 'status'>
  ) => {
    const nowStr = formatNowTimestamp();
    const actor = getActorLabel();
    const newReq: KPIApprovalRequest = {
      ...input,
      id: `apr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      requestedBy: actor,
      requestedAt: nowStr,
      status: 'pending'
    };

    const nextList = [newReq, ...approvalRequests];
    setApprovalRequests(nextList);
    try {
      localStorage.setItem('eng_kpi_approvals', JSON.stringify(nextList));
      localStorage.setItem('eng_kpi_approvals_synced', 'true');
    } catch (e) {
      console.error(e);
    }
    saveApprovalToFirestore(newReq).catch((err) =>
      console.warn('Firestore approval submit error:', err)
    );

    appendAuditLog({
      module: input.category === 'checklist_scope' ? 'Monitoring' : 'KPI',
      actionType: 'approval',
      target: input.targetLabel,
      activity: `[Pengajuan] ${input.categoryLabel}: ${input.targetLabel}`,
      year: input.payload.year || activeYear,
      month: input.payload.month || '-',
      oldValue: input.summaryOld,
      newValue: `${input.summaryNew} (Pending)`
    });

    showToast('Pengajuan berhasil dikirim! Menunggu persetujuan Manager.', 'info');
  };

  // Manager Approves Supervisor Request -> applies live change + saves to Firestore
  const handleApproveRequest = (requestId: string) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang dapat menyetujui pengajuan perubahan!', 'error');
      return;
    }
    const req = approvalRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    const nowStr = formatNowTimestamp();
    const actor = getActorLabel();
    const { category, payload } = req;

    if (category === 'checklist_scope' && payload.projectSpk && Array.isArray(payload.requiredChecklists)) {
      const targetProj = projectsRef.current.find((p) => p.SPK === payload.projectSpk);
      if (targetProj) {
        const cleanKeys = getProjectRequiredChecklists({ requiredChecklists: payload.requiredChecklists });
        const updatedProj: EngineeringProject = {
          ...targetProj,
          requiredChecklists: cleanKeys,
          lastModifiedBy: `${req.requestedBy} (ACC: ${actor})`,
          lastModifiedAt: nowStr
        };
        setProjects((prev) => prev.map((p) => (p.SPK === targetProj.SPK ? updatedProj : p)));
        saveProjectToFirestore(updatedProj).catch((err) =>
          console.warn('Firestore approved checklist scope save error:', err)
        );
      }
    } else if (category === 'kpi_actual' && payload.year && payload.kpiId !== undefined && payload.month) {
      handleUpdateActual(
        payload.year,
        payload.kpiId,
        payload.month,
        payload.actualValue ?? null,
        payload.keterangan || ''
      );
    } else if (category === 'design_quality_feedback' && payload.feedbackItem) {
      const fb = payload.feedbackItem;
      const updated = [...feedbackList];
      const idx = updated.findIndex(
        (f) => f.customer === fb.customer && f.projectName === fb.projectName && f.month === fb.month
      );
      if (idx !== -1) {
        updated[idx] = fb;
      } else {
        updated.push(fb);
      }
      handleUpdateFeedback(updated);
    } else if ((category === 'on_time_design' || category === 'distribusi_drawing') && payload.projectSpk && payload.projectPatch) {
      const targetProj = projects.find((p) => p.SPK === payload.projectSpk);
      if (targetProj) {
        handleUpdateProject({ ...targetProj, ...payload.projectPatch });
      }
    } else if (category === 'cost_efficiency' && payload.costTarget) {
      const { month, customer, projectName } = payload.costTarget;
      const updated = [...reviewCostList];
      const idx = updated.findIndex(
        (c) => c.month === month && c.customer === customer && c.projectName === projectName
      );
      if (idx !== -1) {
        const current = updated[idx];
        const nextAnggaran = payload.updatedAnggaran !== undefined ? payload.updatedAnggaran : current.anggaran;
        const alreadyHasExp = payload.addedExpense
          ? current.pengeluaran.some((x) => x.id === payload.addedExpense!.id)
          : true;
        const nextPengeluaran =
          payload.addedExpense && !alreadyHasExp
            ? [...current.pengeluaran, payload.addedExpense]
            : current.pengeluaran;
        updated[idx] = {
          ...current,
          anggaran: nextAnggaran,
          pengeluaran: nextPengeluaran
        };
      } else {
        updated.push({
          month,
          customer,
          projectName,
          anggaran: payload.updatedAnggaran ?? 0,
          pengeluaran: payload.addedExpense ? [payload.addedExpense] : []
        });
      }
      handleUpdateReviewCost(updated);
    } else if (category === 'design_error_rate' && payload.errorTarget && payload.addedError) {
      const { month, customer, projectName } = payload.errorTarget;
      const updated = [...reviewErrorList];
      const idx = updated.findIndex(
        (e) => e.month === month && e.customer === customer && e.projectName === projectName
      );
      if (idx !== -1) {
        const current = updated[idx];
        const alreadyHas = current.errors.some((x) => x.id === payload.addedError!.id);
        updated[idx] = {
          ...current,
          errors: alreadyHas ? current.errors : [...current.errors, payload.addedError]
        };
      } else {
        updated.push({
          month,
          customer,
          projectName,
          errors: [payload.addedError]
        });
      }
      handleUpdateReviewError(updated);
    }

    const updatedReq: KPIApprovalRequest = {
      ...req,
      status: 'approved',
      reviewedBy: actor,
      reviewedAt: nowStr,
      reviewNote: `Disetujui & diterapkan oleh ${actor}`
    };
    const nextApprovals = approvalRequests.map((r) => (r.id === requestId ? updatedReq : r));
    setApprovalRequests(nextApprovals);
    saveApprovalToFirestore(updatedReq).catch((err) =>
      console.warn('Firestore approval update error:', err)
    );

    appendAuditLog({
      module: category === 'checklist_scope' ? 'Monitoring' : 'KPI',
      actionType: 'approval',
      target: req.targetLabel,
      activity: `[Disetujui] ${req.categoryLabel}: ${req.targetLabel}`,
      year: payload.year || activeYear,
      month: payload.month || '-',
      oldValue: req.summaryOld,
      newValue: req.summaryNew
    });

    showToast(`Pengajuan "${req.targetLabel}" telah disetujui & diterapkan!`, 'success');
  };

  // Manager Rejects Supervisor Request
  const handleRejectRequest = (requestId: string, note?: string) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang dapat menolak pengajuan perubahan!', 'error');
      return;
    }
    const req = approvalRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    const nowStr = formatNowTimestamp();
    const actor = getActorLabel();
    const updatedReq: KPIApprovalRequest = {
      ...req,
      status: 'rejected',
      reviewedBy: actor,
      reviewedAt: nowStr,
      reviewNote: note?.trim() || `Ditolak oleh ${actor}`
    };
    const nextApprovals = approvalRequests.map((r) => (r.id === requestId ? updatedReq : r));
    setApprovalRequests(nextApprovals);
    saveApprovalToFirestore(updatedReq).catch((err) =>
      console.warn('Firestore rejection update error:', err)
    );

    appendAuditLog({
      module: req.category === 'checklist_scope' ? 'Monitoring' : 'KPI',
      actionType: 'approval',
      target: req.targetLabel,
      activity: `[Ditolak] ${req.categoryLabel}: ${req.targetLabel}`,
      year: req.payload.year || activeYear,
      month: req.payload.month || '-',
      oldValue: req.summaryNew,
      newValue: `Ditolak (${updatedReq.reviewNote})`
    });

    showToast(`Pengajuan "${req.targetLabel}" ditolak.`, 'info');
  };

  // Manager Clears Reviewed Approval History
  const handleClearReviewedApprovals = () => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang dapat menghapus riwayat persetujuan!', 'error');
      return;
    }
    const toRemove = approvalRequests.filter((r) => r.status !== 'pending');
    const remaining = approvalRequests.filter((r) => r.status === 'pending');
    setApprovalRequests(remaining);
    toRemove.forEach((r) => {
      deleteApprovalFromFirestore(r.id).catch((err) =>
        console.warn('Firestore approval delete error:', err)
      );
    });
    showToast('Riwayat pengajuan yang telah diproses berhasil dibersihkan.', 'info');
  };

  return (
    <div className="min-h-screen app-colorful-canvas text-slate-800 font-sans antialiased flex flex-col selection:bg-indigo-600 selection:text-white">
      {/* Auth Gate Modal */}
      <AuthGateModal
        isOpen={showAuthGate}
        onAuthenticated={() => {
          setIsAuthenticated(true);
          setShowAuthGate(false);
          showToast('Otentikasi berhasil! Selamat datang di sistem Engineering.');
        }}
      />

      {/* Header */}
      <Header
        currentView={currentView}
        onViewChange={setCurrentView}
        userRole={userRole}
        activeStaff={activeStaff}
        staffAccounts={staffAccounts}
        onStaffLogin={handleStaffLogin}
        onLogoutToViewer={handleLogoutToViewer}
        logoUrl={logoUrl}
        onLogoChange={setLogoUrl}
        onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
        onOpenVercelModal={() => setIsVercelModalOpen(true)}
        onOpenThemeModal={() => setIsThemeModalOpen(true)}
        onOpenStaffPinModal={(tab) => setStaffPinModalState({ isOpen: true, tab })}
        onOpenChat={() => setIsChatOpen(true)}
        unreadChatCount={totalUnreadChatCount}
        onlineSessions={activeOnlineSessions}
        externalRolePickerOpen={mobileRolePickerOpen}
        onCloseExternalRolePicker={() => setMobileRolePickerOpen(false)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[99%] w-full mx-auto p-2.5 sm:p-5 pb-24 md:pb-5">
        {currentView === 'monitoring' && (
          <MonitoringView
            projects={projects}
            userRole={userRole}
            activeMonitoringTab={monitoringSubTab}
            onChangeMonitoringTab={setMonitoringSubTab}
            onAddClick={() => {
              setEditingProject(null);
              setIsDataModalOpen(true);
            }}
            onEditClick={(p) => {
              setEditingProject(p);
              setIsDataModalOpen(true);
            }}
            onDeleteClick={handleDeleteProject}
            onUploadClick={(spk) => {
              setUploadSpk(spk);
              setIsUploadModalOpen(true);
            }}
            onOpenCadViewer={(spk, projectName, customer) => {
              setCadModalData({ spk, projectName, customer });
              setIsCadModalOpen(true);
            }}
            onChecklistToggle={handleChecklistToggle}
            onChecklistDateChange={handleChecklistDateChange}
            onSyncCloud={handleSyncCloud}
            standartPartList={standartPartList}
            onUpdateStandartPartList={handleUpdateStandartPartList}
            showToast={showToast}
            onOpenCustomerBarcode={(custName) => {
              setBarcodeLookupQuery(custName);
              setCurrentView('barcodes');
            }}
            onEditingActivityChange={setChildEditingTarget}
            onUpdateRequiredChecklists={handleUpdateRequiredChecklists}
            approvalRequests={approvalRequests}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
          />
        )}

        {currentView === 'barcodes' && (
          <CustomerBarcodeView
            projects={projects}
            standartPartList={standartPartList}
            feedbackList={feedbackList}
            reviewCostList={reviewCostList}
            reviewErrorList={reviewErrorList}
            userRole={userRole}
            initialLookupQuery={barcodeLookupQuery}
            onClearInitialLookup={() => setBarcodeLookupQuery(null)}
            initialSpkLookup={spkLookupQuery}
            onClearInitialSpkLookup={() => setSpkLookupQuery(null)}
            onChecklistToggle={handleChecklistToggle}
            onChecklistDateChange={handleChecklistDateChange}
            onEditProject={(p) => {
              setEditingProject(p);
              setIsDataModalOpen(true);
            }}
            onOpenCadViewer={(spk, projectName, customer) => {
              setCadModalData({ spk, projectName, customer });
              setIsCadModalOpen(true);
            }}
            showToast={showToast}
          />
        )}

        {currentView === 'kpi' && (
          <KPIView
            kpiList={allYearsData[activeYear] || getBaseKPITemplate()}
            allYearsData={allYearsData}
            activeYear={activeYear}
            onYearChange={setActiveYear}
            onUpdateActual={handleUpdateActual}
            onBackToMonitoring={() => setCurrentView('monitoring')}
            userRole={userRole}
            projects={projects}
            onUpdateProject={handleUpdateProject}
            reviewCostList={reviewCostList}
            onUpdateReviewCost={handleUpdateReviewCost}
            reviewErrorList={reviewErrorList}
            onUpdateReviewError={handleUpdateReviewError}
            feedbackList={feedbackList}
            onUpdateFeedback={handleUpdateFeedback}
            auditLogs={auditLogs}
            approvalRequests={approvalRequests}
            onSubmitApprovalRequest={handleSubmitApprovalRequest}
            onApproveRequest={handleApproveRequest}
            onRejectRequest={handleRejectRequest}
            onClearReviewedApprovals={handleClearReviewedApprovals}
            onEditingActivityChange={setChildEditingTarget}
          />
        )}

        {currentView === 'appsScript' && userRole === 'Manager' && <AppsScriptCodeView />}
      </main>

      {/* Google Firebase Console Configuration & Status Modal */}
      <FirebaseConfigModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        projectsCount={projects.length}
        projects={projects}
        allYearsData={allYearsData}
        showToast={showToast}
        onRestoreComplete={(res) => {
          if (res.projects.length > 0) {
            setProjects((prev) => {
              const map = new Map<string, EngineeringProject>();
              prev.forEach((p) => map.set(p.SPK, p));
              res.projects.forEach((p) => map.set(p.SPK, p));
              return Array.from(map.values()).sort((a, b) => (Number(a.No) || 0) - (Number(b.No) || 0));
            });
          }
          if (res.kpiRecords.length > 0) {
            setAllYearsData((prev) => {
              const next = { ...prev };
              res.kpiRecords.forEach((rec) => {
                const yearList = next[rec.year] || getBaseKPITemplate();
                next[rec.year] = yearList.map((item) =>
                  item.id === rec.kpiId
                    ? { ...item, months: { ...item.months, ...rec.months } }
                    : item
                );
              });
              return next;
            });
          }
          appendAuditLog({
            module: 'Monitoring',
            actionType: 'update',
            target: 'Cloud Backup & Restore',
            activity: `Restore Cloud Backup JSON ke Firestore`,
            newValue: `${res.restoredProjects} proyek SPK & ${res.restoredKpiRecords} record KPI di-upsert`
          });
        }}
        onRefreshSync={() => showToast('Sinkronisasi Google Firebase Firestore aktif & termutakhir!', 'success')}
      />

      {/* Vercel Deployment & Online Guide Modal */}
      <VercelModal
        isOpen={isVercelModalOpen}
        onClose={() => setIsVercelModalOpen(false)}
      />

      {/* Custom Primary Theme Color Settings Modal */}
      <ThemeSettingsModal
        isOpen={isThemeModalOpen}
        onClose={() => {
          setIsThemeModalOpen(false);
          showToast('Tema warna utama aplikasi berhasil disimpan!', 'success');
        }}
        theme={themeConfig}
        onChangeTheme={setThemeConfig}
        onResetTheme={() => {
          setThemeConfig(DEFAULT_THEME_CONFIG);
          showToast('Tema warna dikembalikan ke pengaturan default.', 'info');
        }}
      />

      {/* Project Data Modal (Add / Edit) */}
      <DataModal
        isOpen={isDataModalOpen}
        onClose={() => {
          setIsDataModalOpen(false);
          setEditingProject(null);
        }}
        onSave={handleSaveProject}
        initialData={editingProject}
        existingProjects={projects}
        onSwitchToEdit={(proj) => setEditingProject(proj)}
        userRole={userRole}
      />

      {/* CAD File Upload Modal */}
      <UploadModal
        isOpen={isUploadModalOpen}
        onClose={() => {
          setIsUploadModalOpen(false);
          setUploadSpk(null);
        }}
        spk={uploadSpk}
        onUploadSuccess={handleUploadSuccess}
      />

      {/* 3D CAD .STEP Viewer Modal */}
      <CadViewerModal
        isOpen={isCadModalOpen}
        onClose={() => setIsCadModalOpen(false)}
        spk={cadModalData.spk}
        projectName={cadModalData.projectName}
        customerName={cadModalData.customer}
      />

      {/* Blinking Incoming Chat Floating Alert Banner */}
      {!isChatOpen && totalUnreadChatCount > 0 && latestUnreadChat && !isChatBannerDismissed && (
        <div className="fixed bottom-20 left-3 right-3 sm:left-auto sm:right-5 md:bottom-5 z-[160] sm:w-[340px] animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              setActiveChatRoomId(latestUnreadChat.roomId || 'global');
              setIsChatOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActiveChatRoomId(latestUnreadChat.roomId || 'global');
                setIsChatOpen(true);
              }
            }}
            className="w-full cursor-pointer rounded-2xl bg-slate-950/95 text-white border-2 animate-chat-card-blink p-3 flex items-start gap-3 backdrop-blur-md transition hover:scale-[1.01]"
          >
            <div className="relative w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center shrink-0 shadow-lg">
              <MessageCircle className="w-5 h-5 text-white" />
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-300 opacity-95" />
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-yellow-300 border-2 border-slate-950" />
              </span>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                  Chat Masuk ({totalUnreadChatCount})
                </span>
                <span className="text-[10px] font-bold text-cyan-300 shrink-0">
                  {latestUnreadChat.roomId === 'global' ? 'Grup Online' : 'Pesan Pribadi'}
                </span>
              </div>
              <p className="text-xs font-extrabold text-white truncate mt-0.5">
                {latestUnreadChat.senderName}{' '}
                <span className="text-[10px] font-semibold text-slate-400">
                  ({latestUnreadChat.senderRole})
                </span>
              </p>
              <p className="text-[11px] text-slate-200 line-clamp-2 mt-0.5 leading-snug">
                {latestUnreadChat.text}
              </p>
              <p className="text-[10px] font-bold text-emerald-300 mt-1">
                Klik di sini untuk buka & balas →
              </p>
            </div>

            <button
              type="button"
              aria-label="Tutup notifikasi chat"
              onClick={(e) => {
                e.stopPropagation();
                setIsChatBannerDismissed(true);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      {toast && (
        <div
          className={`fixed left-3 right-3 sm:left-auto sm:right-5 z-[250] flex flex-col gap-2 pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200 ${
            !isChatOpen && totalUnreadChatCount > 0 && latestUnreadChat && !isChatBannerDismissed
              ? 'bottom-44 md:bottom-32'
              : 'bottom-20 md:bottom-5'
          }`}
        >
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl text-white text-xs font-semibold flex items-center space-x-2.5 border pointer-events-auto ${
              toast.type === 'error'
                ? 'bg-rose-900/95 border-rose-700'
                : toast.type === 'info'
                ? 'bg-slate-900/95 border-slate-700 text-slate-200'
                : 'bg-slate-950/95 border-emerald-500/40 text-white shadow-emerald-500/10'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            ) : toast.type === 'info' ? (
              <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
      {/* Staff Accounts, PIN Management (Manager) & Global Audit Log Modal */}
      <StaffPINAndAuditModal
        isOpen={staffPinModalState.isOpen}
        initialTab={staffPinModalState.tab}
        onClose={() => setStaffPinModalState((prev) => ({ ...prev, isOpen: false }))}
        userRole={userRole}
        activeStaff={activeStaff}
        staffAccounts={staffAccounts}
        auditLogs={auditLogs}
        onlineSessions={activeOnlineSessions}
        currentSessionId={sessionId}
        onAddStaff={handleAddStaffAccount}
        onResetStaffPin={handleResetStaffPin}
        onUpdateStaffRole={handleUpdateStaffRole}
        onToggleStaffActive={handleToggleStaffActive}
        onDeleteStaff={handleDeleteStaffAccount}
        showToast={showToast}
      />

      {/* Real-Time Online Team Chat Drawer */}
      <TeamChatPanel
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        messages={visibleChatMessages}
        onlineSessions={activeOnlineSessions}
        currentSessionId={sessionId}
        currentIdentityKey={currentIdentityKey}
        currentDisplayName={currentChatDisplayName}
        currentRole={userRole}
        viewerNickname={viewerNickname}
        onChangeViewerNickname={handleChangeViewerNickname}
        projects={projects}
        activeRoomId={activeChatRoomId}
        onSelectRoom={setActiveChatRoomId}
        onSendMessage={handleSendChatMessage}
        onDeleteMessage={handleDeleteChatMessage}
        onJumpToSpk={(spk) => {
          setSpkLookupQuery(spk);
          setCurrentView('barcodes');
          setIsChatOpen(false);
        }}
        unreadByRoom={unreadByRoom}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        currentView={currentView}
        monitoringSubTab={monitoringSubTab}
        userRole={userRole}
        activeStaffName={activeStaff?.name}
        pendingApprovalCount={approvalRequests.filter((r) => r.status === 'pending').length}
        onSelectMonitoring={() => {
          setCurrentView('monitoring');
          setMonitoringSubTab('drawingProjects');
        }}
        onSelectStandartPart={() => {
          setCurrentView('monitoring');
          setMonitoringSubTab('standartPartHandover');
        }}
        onSelectBarcodes={() => setCurrentView('barcodes')}
        onSelectKPI={() => setCurrentView('kpi')}
        onSelectAppsScript={() => setCurrentView('appsScript')}
        onOpenRolePicker={() => setMobileRolePickerOpen(true)}
      />
      {/* Offline Mode Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
}
