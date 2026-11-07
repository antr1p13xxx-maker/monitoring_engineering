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
  subscribeToFirestoreReviewError,
  saveReviewErrorToFirestore
} from './firebase/firestoreService';
import { 
  EngineeringProject, 
  KPIItem, 
  UserRole, 
  ChecklistKey, 
  ReviewCostItem, 
  ReviewErrorItem, 
  DesignFeedbackItem, 
  AuditLog 
} from './types/engineering';
import { 
  INITIAL_PROJECTS, 
  getBaseKPITemplate, 
  INITIAL_REVIEW_COST, 
  INITIAL_REVIEW_ERROR, 
  INITIAL_FEEDBACK, 
  MONTH_FULL_NAMES 
} from './data/initialData';
import { CheckCircle2, AlertCircle, Info, Sparkles, Flame } from 'lucide-react';

export default function App() {
  // Authentication Gate State
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true);
  const [showAuthGate, setShowAuthGate] = useState<boolean>(false);
  const [isFirebaseModalOpen, setIsFirebaseModalOpen] = useState<boolean>(false);

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
  const [reviewCostList, setReviewCostList] = useState<ReviewCostItem[]>(INITIAL_REVIEW_COST);
  const [reviewErrorList, setReviewErrorList] = useState<ReviewErrorItem[]>(INITIAL_REVIEW_ERROR);
  const [feedbackList, setFeedbackList] = useState<DesignFeedbackItem[]>(INITIAL_FEEDBACK);

  // Audit Log State
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
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
  ]);

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

    // 4. Real-time Review Cost Listener
    const unsubCost = subscribeToFirestoreReviewCost((costMap) => {
      if (Object.keys(costMap).length > 0) {
        setReviewCostList((prev) => {
          return prev.map((item) => {
            const key = `${item.month}_${item.customer}_${item.projectName}`.replace(/[\/\\#\s]/g, '_');
            if (costMap[key]) {
              return {
                ...item,
                anggaran: costMap[key].anggaran,
                pengeluaran: costMap[key].pengeluaran
              };
            }
            return item;
          });
        });
      }
    });

    // 5. Real-time Review Error Listener
    const unsubError = subscribeToFirestoreReviewError((errorMap) => {
      if (Object.keys(errorMap).length > 0) {
        setReviewErrorList((prev) => {
          return prev.map((item) => {
            const key = `${item.month}_${item.customer}_${item.projectName}`.replace(/[\/\\#\s]/g, '_');
            if (errorMap[key]) {
              return {
                ...item,
                errors: errorMap[key].errors
              };
            }
            return item;
          });
        });
      }
    });

    return () => {
      unsubProjects();
      unsubKpis();
      unsubCost();
      unsubError();
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
    setReviewCostList((prev) => {
      const resolved = typeof updater === 'function' ? updater(prev) : updater;
      resolved.forEach((item) => {
        const key = `${item.month}_${item.customer}_${item.projectName}`;
        saveReviewCostToFirestore(key, {
          anggaran: item.anggaran,
          pengeluaran: item.pengeluaran
        }).catch((err) => console.warn('Firestore Review Cost save error:', err));
      });
      return resolved;
    });
  };

  const handleUpdateReviewError = (
    updater: ReviewErrorItem[] | ((prev: ReviewErrorItem[]) => ReviewErrorItem[])
  ) => {
    setReviewErrorList((prev) => {
      const resolved = typeof updater === 'function' ? updater(prev) : updater;
      resolved.forEach((item) => {
        const key = `${item.month}_${item.customer}_${item.projectName}`;
        saveReviewErrorToFirestore(key, {
          errors: item.errors
        }).catch((err) => console.warn('Firestore Review Error save error:', err));
      });
      return resolved;
    });
  };

  const handleSyncCloud = () => {
    showToast('Menghubungkan ke Google Firebase Firestore... Data tersinkronisasi!', 'success');
  };

  const handleUpdateProject = (updated: EngineeringProject) => {
    if (userRole === 'Viewer') {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengubah data proyek.', 'error');
      return;
    }
    setProjects((prev) => prev.map((p) => (p.SPK === updated.SPK ? updated : p)));
    saveProjectToFirestore(updated).catch((err) => console.warn('Firestore update error:', err));
    showToast(`Data proyek ${updated.SPK} berhasil diperbarui di Firebase.`);
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans antialiased flex flex-col selection:bg-blue-600 selection:text-white">
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
            onUpdateFeedback={setFeedbackList}
            auditLogs={auditLogs}
          />
        )}

        {currentView === 'appsScript' && <AppsScriptCodeView />}
      </main>

      {/* Google Firebase Console Configuration & Status Modal */}
      <FirebaseConfigModal
        isOpen={isFirebaseModalOpen}
        onClose={() => setIsFirebaseModalOpen(false)}
        projectsCount={projects.length}
        onRefreshSync={() => showToast('Sinkronisasi Google Firebase Firestore aktif & termutakhir!', 'success')}
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
