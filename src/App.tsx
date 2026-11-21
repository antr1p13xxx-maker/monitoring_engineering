import React, { useState, useEffect } from 'react';
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
  seedStandartPartsIfEmpty,
  subscribeToFirestoreDesignFeedback,
  saveDesignFeedbackToFirestore,
  deleteDesignFeedbackFromFirestore,
  seedDesignFeedbackIfEmpty,
  subscribeToFirestoreApprovals,
  saveApprovalToFirestore,
  deleteApprovalFromFirestore
} from './firebase/firestoreService';
import { 
  EngineeringProject, 
  KPIItem, 
  UserRole, 
  ChecklistKey, 
  ReviewCostItem, 
  ReviewErrorItem, 
  DesignFeedbackItem, 
  AuditLog,
  SerahTerimaStandartPartItem,
  KPIApprovalRequest
} from './types/engineering';
import { 
  INITIAL_PROJECTS, 
  getBaseKPITemplate, 
  INITIAL_REVIEW_COST, 
  INITIAL_REVIEW_ERROR, 
  INITIAL_FEEDBACK, 
  INITIAL_STANDART_PART_HANDOVERS,
  MONTH_FULL_NAMES 
} from './data/initialData';
import { CheckCircle2, AlertCircle, Info, Sparkles, Flame } from 'lucide-react';

export default function App() {
  // Authentication Gate State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [showAuthGate, setShowAuthGate] = useState<boolean>(false);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState<boolean>(false);
  const [isVercelModalOpen, setIsVercelModalOpen] = useState<boolean>(false);

  // App Navigation & Role State (Default role is Viewer: Read-only)
  const [currentView, setCurrentView] = useState<'monitoring' | 'kpi' | 'appsScript'>('monitoring');
  const [userRole, setUserRole] = useState<UserRole>('Viewer');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

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

  // Real-time Google Firebase Firestore Integration
  useEffect(() => {
    // 1. Seed database jika Firestore masih kosong pada instalasi awal
    seedFirestoreIfEmpty(INITIAL_PROJECTS);
    seedKPIsIfEmpty(activeYear, getBaseKPITemplate());

    // 2. Real-time Project Listener dari Firestore
    const unsubProjects = subscribeToFirestoreProjects((firestoreProjects) => {
      if (firestoreProjects && firestoreProjects.length > 0) {
        setProjects(firestoreProjects);
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

  // Persist projects to localStorage as offline backup cache
  useEffect(() => {
    try {
      localStorage.setItem('eng_projects', JSON.stringify(projects));
    } catch (e) {
      console.error(e);
    }
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

  // Project CRUD operations (Synchronized with Google Firebase Firestore)
  const handleSaveProject = (formData: Partial<EngineeringProject>, isEdit: boolean) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer hanya bisa melihat dan tidak bisa mengedit data.', 'error');
      return;
    }
    if (isEdit && editingProject) {
      const updatedProject = { ...editingProject, ...formData } as EngineeringProject;
      setProjects((prev) =>
        prev.map((p) => (p.SPK === editingProject.SPK ? updatedProject : p))
      );
      saveProjectToFirestore(updatedProject).catch((err) => console.warn('Firestore save error:', err));
      showToast(`Data SPK ${formData.SPK || editingProject.SPK} berhasil diperbarui di Firebase.`);
    } else {
      const newProject: EngineeringProject = {
        No: projects.length + 1,
        Bulan: formData.Bulan || 'Oktober',
        SPK: formData.SPK || `SPK-2026-${String(projects.length + 1).padStart(3, '0')}`,
        'Nomor PO': formData['Nomor PO'] || `PO/2026/${String(projects.length + 1).padStart(3, '0')}`,
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
        keterangan: formData.keterangan || ''
      };

      setProjects((prev) => [newProject, ...prev]);
      saveProjectToFirestore(newProject).catch((err) => console.warn('Firestore add error:', err));
      showToast(`Data proyek SPK ${newProject.SPK} tersimpan ke Google Firebase Firestore!`);
    }

    setIsDataModalOpen(false);
    setEditingProject(null);
  };

  const handleDeleteProject = (spk: string) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang berhak menghapus data!', 'error');
      return;
    }
    if (window.confirm(`Hapus permanen proyek ${spk}?`)) {
      setProjects((prev) => prev.filter((p) => p.SPK !== spk));
      deleteProjectFromFirestore(spk).catch((err) => console.warn('Firestore delete error:', err));
      showToast(`Proyek ${spk} telah dihapus dari Firebase.`, 'info');
    }
  };

  const handleChecklistToggle = (spk: string, key: ChecklistKey, isChecked: boolean) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengubah status checklist.', 'error');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const val = isChecked ? today : '';
    setProjects((prev) =>
      prev.map((p) => {
        if (p.SPK === spk) {
          return {
            ...p,
            [key]: val
          };
        }
        return p;
      })
    );
    updateChecklistInFirestore(spk, key, val).catch((err) => console.warn('Firestore checklist error:', err));
    showToast(`Checklist "${key}" pada ${spk} tersimpan ke Firebase.`);
  };

  const handleChecklistDateChange = (spk: string, key: ChecklistKey, date: string) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengubah tanggal checklist.', 'error');
      return;
    }
    setProjects((prev) =>
      prev.map((p) => {
        if (p.SPK === spk) {
          return {
            ...p,
            [key]: date
          };
        }
        return p;
      })
    );
    updateChecklistInFirestore(spk, key, date).catch((err) => console.warn('Firestore date error:', err));
  };

  const handleUploadSuccess = (spk: string, fileUrl: string, fileName: string) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengunggah file.', 'error');
      return;
    }
    setProjects((prev) =>
      prev.map((p) => {
        if (p.SPK === spk) {
          return {
            ...p,
            'File CAD Drive': fileUrl
          };
        }
        return p;
      })
    );
    updateChecklistInFirestore(spk, 'File CAD Drive', fileUrl).catch((err) => console.warn('Firestore CAD error:', err));
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

    // Record in audit log
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    setAuditLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: nowStr,
        user: `${userRole} (Session)`,
        activity: `Perbarui nilai KPI ID #${kpiId}`,
        year,
        month,
        newValue: val !== null ? `${val}` : 'Dihapus'
      },
      ...prev
    ]);

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

    showToast('Data Design Error Rate berhasil disimpan ke Cloud & Local Storage!', 'success');
  };

  const handleUpdateStandartPartList = (
    updater: SerahTerimaStandartPartItem[] | ((prev: SerahTerimaStandartPartItem[]) => SerahTerimaStandartPartItem[])
  ) => {
    setStandartPartList((prev) => {
      const resolved = typeof updater === 'function' ? updater(prev) : updater;
      resolved.forEach((item) => {
        saveStandartPartToFirestore(item).catch((err) => console.warn('Firestore Standart Part save error:', err));
      });
      return resolved;
    });
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
    setProjects((prev) => prev.map((p) => (p.SPK === updated.SPK ? updated : p)));
    saveProjectToFirestore(updated).catch((err) => console.warn('Firestore update error:', err));
    showToast(`Data proyek ${updated.SPK} berhasil diperbarui di Firebase.`);
  };

  // Submit Supervisor Input Request (Menunggu Persetujuan Manager)
  const handleSubmitApprovalRequest = (
    input: Omit<KPIApprovalRequest, 'id' | 'requestedBy' | 'requestedAt' | 'status'>
  ) => {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newReq: KPIApprovalRequest = {
      ...input,
      id: `apr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      requestedBy: `${userRole} Engineering`,
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

    setAuditLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: nowStr,
        user: `${userRole} (Menunggu Persetujuan Manager)`,
        activity: `[Pengajuan] ${input.categoryLabel}: ${input.targetLabel}`,
        year: input.payload.year || activeYear,
        month: input.payload.month || '-',
        newValue: `${input.summaryNew} (Pending)`
      },
      ...prev
    ]);

    showToast('Pengajuan input data berhasil dikirim! Menunggu persetujuan Manager.', 'info');
  };

  // Manager Approves Supervisor Request -> applies live change + saves to Firestore
  const handleApproveRequest = (requestId: string) => {
    if (userRole !== 'Manager') {
      showToast('Hanya Manager yang dapat menyetujui pengajuan perubahan!', 'error');
      return;
    }
    const req = approvalRequests.find((r) => r.id === requestId);
    if (!req || req.status !== 'pending') return;

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const { category, payload } = req;

    if (category === 'kpi_actual' && payload.year && payload.kpiId !== undefined && payload.month) {
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
      reviewedBy: 'Manager Engineering',
      reviewedAt: nowStr,
      reviewNote: 'Disetujui & diterapkan oleh Manager'
    };
    const nextApprovals = approvalRequests.map((r) => (r.id === requestId ? updatedReq : r));
    setApprovalRequests(nextApprovals);
    saveApprovalToFirestore(updatedReq).catch((err) =>
      console.warn('Firestore approval update error:', err)
    );

    setAuditLogs((prev) => [
      {
        id: `log-${Date.now() + 1}`,
        timestamp: nowStr,
        user: 'Manager Engineering (Persetujuan)',
        activity: `[Disetujui] ${req.categoryLabel}: ${req.targetLabel}`,
        year: payload.year || activeYear,
        month: payload.month || '-',
        newValue: req.summaryNew
      },
      ...prev
    ]);

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

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const updatedReq: KPIApprovalRequest = {
      ...req,
      status: 'rejected',
      reviewedBy: 'Manager Engineering',
      reviewedAt: nowStr,
      reviewNote: note?.trim() || 'Ditolak oleh Manager'
    };
    const nextApprovals = approvalRequests.map((r) => (r.id === requestId ? updatedReq : r));
    setApprovalRequests(nextApprovals);
    saveApprovalToFirestore(updatedReq).catch((err) =>
      console.warn('Firestore rejection update error:', err)
    );

    setAuditLogs((prev) => [
      {
        id: `log-${Date.now()}`,
        timestamp: nowStr,
        user: 'Manager Engineering (Penolakan)',
        activity: `[Ditolak] ${req.categoryLabel}: ${req.targetLabel}`,
        year: req.payload.year || activeYear,
        month: req.payload.month || '-',
        newValue: `Ditolak (${updatedReq.reviewNote})`
      },
      ...prev
    ]);

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
        onRoleChange={setUserRole}
        logoUrl={logoUrl}
        onLogoChange={setLogoUrl}
        onOpenFirebaseModal={() => setIsFirebaseModalOpen(true)}
        onOpenVercelModal={() => setIsVercelModalOpen(true)}
      />

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-[99%] w-full mx-auto p-3 sm:p-5">
        {currentView === 'monitoring' && (
          <MonitoringView
            projects={projects}
            userRole={userRole}
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
          />
        )}

        {currentView === 'appsScript' && userRole === 'Manager' && <AppsScriptCodeView />}
      </main>

      {/* Google Firebase Console Configuration & Status Modal */}
      <FirebaseConfigModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        projectsCount={projects.length}
        onRefreshSync={() => showToast('Sinkronisasi Google Firebase Firestore aktif & termutakhir!', 'success')}
      />

      {/* Vercel Deployment & Online Guide Modal */}
      <VercelModal
        isOpen={isVercelModalOpen}
        onClose={() => setIsVercelModalOpen(false)}
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

      {/* Toast Notification Container */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-[250] flex flex-col gap-2 pointer-events-none animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div
            className={`px-4 py-3 rounded-xl shadow-2xl text-white text-xs font-semibold flex items-center space-x-2.5 border pointer-events-auto ${
              toast.type === 'error'
                ? 'bg-rose-900/90 border-rose-700'
                : toast.type === 'info'
                ? 'bg-slate-900/90 border-slate-700 text-slate-200'
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
    </div>
  );
}
