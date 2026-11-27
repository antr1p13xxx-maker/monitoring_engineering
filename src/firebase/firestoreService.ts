import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch
} from 'firebase/firestore';
import {
  db,
  isFirestoreQuotaExceeded,
  isQuotaExceededError,
  reportFirestoreConnected,
  reportFirestoreError
} from './firebaseConfig';
import { EngineeringProject, KPIItem, SerahTerimaStandartPartItem, StandartPartAttachment, DesignFeedbackItem, ReviewCostItem, ReviewErrorItem, KPIApprovalRequest, StaffAccount, AuditLog, ActiveSessionPresence, TeamChatMessage } from '../types/engineering';
import {
  enqueueOfflineMutation,
  isNetworkOfflineError,
  OfflineMutationItem,
  OfflineMutationType,
  registerOfflineSyncExecutor
} from '../utils/offlineSyncQueue';

const PROJECTS_COLLECTION = 'engineering_projects';
const KPI_COLLECTION = 'kpi_records';
const REVIEW_COST_COLLECTION = 'review_cost_records';
const REVIEW_ERROR_COLLECTION = 'review_error_records';
const STANDART_PART_COLLECTION = 'standart_part_handovers';
const DESIGN_FEEDBACK_COLLECTION = 'design_feedback_records';
const KPI_APPROVAL_COLLECTION = 'kpi_approval_requests';
const STAFF_ACCOUNTS_COLLECTION = 'staff_accounts';
const AUDIT_LOGS_COLLECTION = 'activity_audit_logs';
const ACTIVE_SESSIONS_COLLECTION = 'active_sessions';
const TEAM_CHAT_COLLECTION = 'team_chat_messages';

async function executeOrQueueOffline(params: {
  type: OfflineMutationType;
  coalesceKey: string;
  label: string;
  payload: Record<string, any>;
  bypassQueue?: boolean;
  runDirect: () => Promise<void>;
}): Promise<void> {
  const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  if (!params.bypassQueue && (isOffline || isFirestoreQuotaExceeded())) {
    await enqueueOfflineMutation({
      type: params.type,
      coalesceKey: params.coalesceKey,
      label: params.label,
      payload: params.payload,
    });
    return;
  }

  try {
    await params.runDirect();
    reportFirestoreConnected();
  } catch (err) {
    reportFirestoreError(err);
    if (!params.bypassQueue && (isNetworkOfflineError(err) || isQuotaExceededError(err))) {
      await enqueueOfflineMutation({
        type: params.type,
        coalesceKey: params.coalesceKey,
        label: params.label,
        payload: params.payload,
      });
      return;
    }
    throw err;
  }
}

/**
 * Real-time listener untuk semua data proyek monitoring engineering.
 */
export function subscribeToFirestoreProjects(
  onUpdate: (projects: EngineeringProject[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, PROJECTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (!snapshot.metadata.fromCache) {
        reportFirestoreConnected();
      }
      const projects: EngineeringProject[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as EngineeringProject;
        projects.push(data);
      });
      // Urutkan berdasarkan No
      projects.sort((a, b) => (Number(a.No) || 0) - (Number(b.No) || 0));
      onUpdate(projects);
    },
    (error) => {
      reportFirestoreError(error);
      console.warn('Firestore projects listener notice:', error.message);
      if (onError) onError(error);
    }
  );
}

/**
 * Menyimpan atau memperbarui data proyek ke Firestore.
 */
export async function saveProjectToFirestore(
  project: EngineeringProject,
  options?: { bypassQueue?: boolean }
): Promise<void> {
  const docId = (project.SPK || `PROJ_${Date.now()}`).replace(/\//g, '_');
  const docRef = doc(db, PROJECTS_COLLECTION, docId);
  await executeOrQueueOffline({
    type: 'project_save',
    coalesceKey: `project_save:${docId}`,
    label: `Simpan Proyek ${project.SPK} (${project['Nama Project']})`,
    payload: { project },
    bypassQueue: options?.bypassQueue,
    runDirect: async () => {
      await setDoc(docRef, {
        ...project,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    },
  });
}

/**
 * Memperbarui status checklist suatu proyek secara langsung.
 */
export async function updateChecklistInFirestore(
  spk: string, 
  checklistKey: string, 
  value: string,
  lastModifiedBy?: string,
  options?: { bypassQueue?: boolean }
): Promise<void> {
  const docId = spk.replace(/\//g, '_');
  const docRef = doc(db, PROJECTS_COLLECTION, docId);
  await executeOrQueueOffline({
    type: 'checklist_update',
    coalesceKey: `checklist:${docId}:${checklistKey}`,
    label: `Checklist "${checklistKey}" (${spk})`,
    payload: { spk, checklistKey, value, lastModifiedBy },
    bypassQueue: options?.bypassQueue,
    runDirect: async () => {
      await setDoc(docRef, {
        [checklistKey]: value,
        ...(lastModifiedBy ? { lastModifiedBy, lastModifiedAt: new Date().toISOString() } : {}),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    },
  });
}

/**
 * Menghapus proyek dari Firestore berdasarkan nomor SPK.
 */
export async function deleteProjectFromFirestore(
  spk: string,
  options?: { bypassQueue?: boolean }
): Promise<void> {
  const docId = spk.replace(/\//g, '_');
  const docRef = doc(db, PROJECTS_COLLECTION, docId);
  await executeOrQueueOffline({
    type: 'project_delete',
    coalesceKey: `project_delete:${docId}`,
    label: `Hapus Proyek ${spk}`,
    payload: { spk },
    bypassQueue: options?.bypassQueue,
    runDirect: async () => {
      await deleteDoc(docRef);
    },
  });
}

/**
 * Seed initial data ke Firestore jika collection proyek masih kosong.
 */
export async function seedFirestoreIfEmpty(initialProjects: EngineeringProject[]): Promise<void> {
  try {
    if (
      localStorage.getItem('eng_projects_seeded') === 'true' ||
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      isFirestoreQuotaExceeded()
    ) {
      return;
    }
    const colRef = collection(db, PROJECTS_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty && initialProjects.length > 0) {
      const batch = writeBatch(db);
      initialProjects.forEach((proj) => {
        const docId = (proj.SPK || `PROJ_${Date.now()}`).replace(/\//g, '_');
        const docRef = doc(db, PROJECTS_COLLECTION, docId);
        batch.set(docRef, {
          ...proj,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.info(`Seeded ${initialProjects.length} initial projects to Firebase Firestore.`);
    }
    localStorage.setItem('eng_projects_seeded', 'true');
  } catch (err) {
    reportFirestoreError(err);
    console.warn('Could not seed initial projects to Firestore:', err);
  }
}

/**
 * Real-time listener untuk data KPI per tahun tertentu.
 */
export function subscribeToFirestoreKPIs(
  year: string,
  onUpdate: (kpis: Record<number, Record<string, number | null>>) => void
) {
  const colRef = collection(db, KPI_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const kpiMap: Record<number, Record<string, number | null>> = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.year === year && data.kpiId !== undefined) {
          try {
            kpiMap[data.kpiId] = typeof data.months === 'string' ? JSON.parse(data.months) : (data.months || {});
          } catch {
            kpiMap[data.kpiId] = data.months || {};
          }
        }
      });
      onUpdate(kpiMap);
    },
    (error) => {
      reportFirestoreError(error);
      console.warn('Firestore KPI listener notice:', error.message);
    }
  );
}

/**
 * Menyimpan nilai bulanan KPI ke Firestore.
 */
export async function saveKPIMonthToFirestore(
  year: string,
  kpiId: number,
  allMonths: Record<string, number | null>,
  options?: { bypassQueue?: boolean }
): Promise<void> {
  const docId = `${year}_KPI_${kpiId}`;
  const docRef = doc(db, KPI_COLLECTION, docId);
  await executeOrQueueOffline({
    type: 'kpi_save',
    coalesceKey: `kpi:${docId}`,
    label: `Update KPI #${kpiId} (${year})`,
    payload: { year, kpiId, allMonths },
    bypassQueue: options?.bypassQueue,
    runDirect: async () => {
      await setDoc(docRef, {
        year,
        kpiId,
        months: JSON.stringify(allMonths),
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    },
  });
}

/**
 * Seed KPI data awal jika kosong.
 */
export async function seedKPIsIfEmpty(year: string, kpiList: KPIItem[]): Promise<void> {
  try {
    const seedKey = `eng_kpi_seeded_${year}`;
    if (
      localStorage.getItem(seedKey) === 'true' ||
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      isFirestoreQuotaExceeded()
    ) {
      return;
    }
    const colRef = collection(db, KPI_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty) {
      const batch = writeBatch(db);
      kpiList.forEach((kpi) => {
        const docId = `${year}_KPI_${kpi.id}`;
        const docRef = doc(db, KPI_COLLECTION, docId);
        batch.set(docRef, {
          year,
          kpiId: kpi.id,
          months: JSON.stringify(kpi.months),
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.info('Seeded default KPI list to Firestore.');
    }
    localStorage.setItem(seedKey, 'true');
  } catch (err) {
    reportFirestoreError(err);
    console.warn('Could not seed initial KPIs to Firestore:', err);
  }
}

/**
 * Helper aman membuat docId <= 128 karakter untuk key komposit (bulan, customer, project).
 */
function buildCompositeDocId(rawKey: string): string {
  const sanitized = rawKey.replace(/[\/\\#\s]/g, '_');
  if (sanitized.length > 0 && sanitized.length <= 120) {
    return sanitized;
  }
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = ((hash << 5) - hash + rawKey.charCodeAt(i)) | 0;
  }
  const suffix = Math.abs(hash).toString(36);
  return `${sanitized.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 100)}_${suffix}`;
}

/**
 * Real-time listener untuk Review Cost (seluruh project & bulan dinamis).
 */
export function subscribeToFirestoreReviewCost(
  onUpdate: (items: ReviewCostItem[]) => void
) {
  const colRef = collection(db, REVIEW_COST_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: ReviewCostItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let exp: Array<{ id: string; desc: string; amount: number }> = [];
        try {
          exp = typeof data.pengeluaran === 'string' ? JSON.parse(data.pengeluaran) : (data.pengeluaran || []);
        } catch {
          exp = data.pengeluaran || [];
        }

        let month = data.month ? String(data.month) : '';
        let customer = data.customer ? String(data.customer) : '';
        let projectName = data.projectName ? String(data.projectName) : '';

        // Fallback parsing bila dokumen lama hanya menyimpan field `key` ("month_customer_projectName")
        if ((!month || !customer || !projectName) && typeof data.key === 'string') {
          const parts = data.key.split('_');
          if (parts.length >= 3) {
            month = month || parts[0];
            customer = customer || parts[1];
            projectName = projectName || parts.slice(2).join('_');
          }
        }

        if (month && customer && projectName) {
          list.push({
            month,
            customer,
            projectName,
            anggaran: Number(data.anggaran || 0),
            pengeluaran: Array.isArray(exp) ? exp : [],
          });
        }
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore Review Cost listener notice:', err.message);
    }
  );
}

/**
 * Menyimpan Review Cost ke Firestore.
 */
export async function saveReviewCostToFirestore(
  item: ReviewCostItem
): Promise<void> {
  const key = `${item.month}_${item.customer}_${item.projectName}`;
  const docId = buildCompositeDocId(key);
  const docRef = doc(db, REVIEW_COST_COLLECTION, docId);
  await setDoc(docRef, {
    key,
    month: item.month,
    customer: item.customer,
    projectName: item.projectName,
    anggaran: Number(item.anggaran || 0),
    pengeluaran: JSON.stringify(item.pengeluaran || []),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Menghapus Review Cost dari Firestore.
 */
export async function deleteReviewCostFromFirestore(
  item: Pick<ReviewCostItem, 'month' | 'customer' | 'projectName'>
): Promise<void> {
  const key = `${item.month}_${item.customer}_${item.projectName}`;
  const docId = buildCompositeDocId(key);
  const docRef = doc(db, REVIEW_COST_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Seed initial Review Cost jika koleksi masih kosong dan belum pernah di-seed.
 */
export async function seedReviewCostIfEmpty(
  initialItems: ReviewCostItem[]
): Promise<void> {
  try {
    if (localStorage.getItem('eng_review_cost_seeded') === 'true') {
      return;
    }
    const colRef = collection(db, REVIEW_COST_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty && initialItems.length > 0) {
      const batch = writeBatch(db);
      initialItems.forEach((item) => {
        const key = `${item.month}_${item.customer}_${item.projectName}`;
        const docId = buildCompositeDocId(key);
        const docRef = doc(db, REVIEW_COST_COLLECTION, docId);
        batch.set(docRef, {
          key,
          month: item.month,
          customer: item.customer,
          projectName: item.projectName,
          anggaran: Number(item.anggaran || 0),
          pengeluaran: JSON.stringify(item.pengeluaran || []),
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.info(`Seeded ${initialItems.length} initial Review Cost records to Firestore.`);
    }
    localStorage.setItem('eng_review_cost_seeded', 'true');
  } catch (err) {
    console.warn('Could not seed initial Review Cost to Firestore:', err);
  }
}

/**
 * Real-time listener untuk Review Error (seluruh project & bulan dinamis).
 */
export function subscribeToFirestoreReviewError(
  onUpdate: (items: ReviewErrorItem[]) => void
) {
  const colRef = collection(db, REVIEW_ERROR_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: ReviewErrorItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let errs: Array<{ id: string; partName: string; feedback: string }> = [];
        try {
          errs = typeof data.errors === 'string' ? JSON.parse(data.errors) : (data.errors || []);
        } catch {
          errs = data.errors || [];
        }

        let month = data.month ? String(data.month) : '';
        let customer = data.customer ? String(data.customer) : '';
        let projectName = data.projectName ? String(data.projectName) : '';

        if ((!month || !customer || !projectName) && typeof data.key === 'string') {
          const parts = data.key.split('_');
          if (parts.length >= 3) {
            month = month || parts[0];
            customer = customer || parts[1];
            projectName = projectName || parts.slice(2).join('_');
          }
        }

        if (month && customer && projectName) {
          list.push({
            month,
            customer,
            projectName,
            errors: Array.isArray(errs) ? errs : [],
          });
        }
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore Review Error listener notice:', err.message);
    }
  );
}

/**
 * Menyimpan Review Error ke Firestore.
 */
export async function saveReviewErrorToFirestore(
  item: ReviewErrorItem
): Promise<void> {
  const key = `${item.month}_${item.customer}_${item.projectName}`;
  const docId = buildCompositeDocId(key);
  const docRef = doc(db, REVIEW_ERROR_COLLECTION, docId);
  await setDoc(docRef, {
    key,
    month: item.month,
    customer: item.customer,
    projectName: item.projectName,
    errors: JSON.stringify(item.errors || []),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Menghapus Review Error dari Firestore.
 */
export async function deleteReviewErrorFromFirestore(
  item: Pick<ReviewErrorItem, 'month' | 'customer' | 'projectName'>
): Promise<void> {
  const key = `${item.month}_${item.customer}_${item.projectName}`;
  const docId = buildCompositeDocId(key);
  const docRef = doc(db, REVIEW_ERROR_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Seed initial Review Error jika koleksi masih kosong dan belum pernah di-seed.
 */
export async function seedReviewErrorIfEmpty(
  initialItems: ReviewErrorItem[]
): Promise<void> {
  try {
    if (localStorage.getItem('eng_review_error_seeded') === 'true') {
      return;
    }
    const colRef = collection(db, REVIEW_ERROR_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty && initialItems.length > 0) {
      const batch = writeBatch(db);
      initialItems.forEach((item) => {
        const key = `${item.month}_${item.customer}_${item.projectName}`;
        const docId = buildCompositeDocId(key);
        const docRef = doc(db, REVIEW_ERROR_COLLECTION, docId);
        batch.set(docRef, {
          key,
          month: item.month,
          customer: item.customer,
          projectName: item.projectName,
          errors: JSON.stringify(item.errors || []),
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.info(`Seeded ${initialItems.length} initial Review Error records to Firestore.`);
    }
    localStorage.setItem('eng_review_error_seeded', 'true');
  } catch (err) {
    console.warn('Could not seed initial Review Error to Firestore:', err);
  }
}

/**
 * Real-time listener untuk Serah Terima Standart Part.
 */
export function subscribeToFirestoreStandartParts(
  onUpdate: (items: SerahTerimaStandartPartItem[]) => void
) {
  const colRef = collection(db, STANDART_PART_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const list: SerahTerimaStandartPartItem[] = [];
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let staff: string[] = [];
      let parts: string[] = [];
      let attachments: StandartPartAttachment[] = [];
      try {
        staff = typeof data.prepareStaff === 'string' ? JSON.parse(data.prepareStaff) : (data.prepareStaff || []);
      } catch {
        staff = data.prepareStaff || [];
      }
      try {
        parts = typeof data.partNames === 'string' ? JSON.parse(data.partNames) : (data.partNames || []);
      } catch {
        parts = data.partNames || [];
      }
      try {
        attachments =
          typeof data.partAttachments === 'string'
            ? JSON.parse(data.partAttachments)
            : (Array.isArray(data.partAttachments) ? data.partAttachments : []);
      } catch {
        attachments = [];
      }

      list.push({
        id: docSnap.id,
        no: Number(data.no) || 1,
        month: data.month || 'Oktober',
        prepareStaff: staff,
        projectName: data.projectName || '',
        partNames: parts,
        partAttachments: Array.isArray(attachments) ? attachments : [],
        customer: data.customer || '',
        distributionDate: data.distributionDate || '',
        distributionTime: data.distributionTime || '',
        division: data.division || 'Assembly',
        signature: data.signature || '',
        spk: data.spk || '',
        notes: data.notes || '',
        lastModifiedBy: data.lastModifiedBy || '',
        lastModifiedAt: data.lastModifiedAt || ''
      });
    });
    list.sort((a, b) => (a.no || 0) - (b.no || 0));
    onUpdate(list);
  }, (err) => {
    console.warn('Firestore Standart Part listener notice:', err.message);
  });
}

/**
 * Menyimpan data Serah Terima Standart Part ke Firestore.
 */
export async function saveStandartPartToFirestore(
  item: SerahTerimaStandartPartItem,
  options?: { bypassQueue?: boolean }
): Promise<void> {
  const docId = (item.id || `stp_${Date.now()}`).replace(/[\/\\#\s]/g, '_');
  const docRef = doc(db, STANDART_PART_COLLECTION, docId);
  await executeOrQueueOffline({
    type: 'standart_part_save',
    coalesceKey: `standart_part:${docId}`,
    label: `Standart Part (${item.projectName})`,
    payload: { item },
    bypassQueue: options?.bypassQueue,
    runDirect: async () => {
      await setDoc(docRef, {
        ...item,
        prepareStaff: JSON.stringify(item.prepareStaff),
        partNames: JSON.stringify(item.partNames),
        partAttachments: JSON.stringify(item.partAttachments || []),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    },
  });
}

/**
 * Menghapus data Serah Terima Standart Part dari Firestore.
 */
export async function deleteStandartPartFromFirestore(
  itemId: string
): Promise<void> {
  const docId = itemId.replace(/[\/\\#\s]/g, '_');
  const docRef = doc(db, STANDART_PART_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Seed initial data Serah Terima Standart Part jika koleksi masih kosong.
 */
export async function seedStandartPartsIfEmpty(
  initialItems: SerahTerimaStandartPartItem[]
): Promise<void> {
  try {
    if (
      localStorage.getItem('eng_standart_parts_seeded') === 'true' ||
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      isFirestoreQuotaExceeded()
    ) {
      return;
    }
    const colRef = collection(db, STANDART_PART_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty && initialItems.length > 0) {
      const batch = writeBatch(db);
      initialItems.forEach((item) => {
        const docId = (item.id || `stp_${Date.now()}`).replace(/[\/\\#\s]/g, '_');
        const docRef = doc(db, STANDART_PART_COLLECTION, docId);
        batch.set(docRef, {
          ...item,
          prepareStaff: JSON.stringify(item.prepareStaff),
          partNames: JSON.stringify(item.partNames),
          partAttachments: JSON.stringify(item.partAttachments || []),
          updatedAt: new Date().toISOString()
        });
      });
      await batch.commit();
      console.info(`Seeded ${initialItems.length} initial Standart Part handovers to Firestore.`);
    }
    localStorage.setItem('eng_standart_parts_seeded', 'true');
  } catch (err) {
    reportFirestoreError(err);
    console.warn('Could not seed initial Standart Parts to Firestore:', err);
  }
}

/**
 * Helper aman membuat docId <= 128 karakter untuk Design Feedback.
 */
export function buildDesignFeedbackDocId(month: string, customer: string, projectName: string): string {
  const rawKey = `${month}_${customer}_${projectName}`;
  const sanitized = rawKey.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_');
  if (sanitized.length > 0 && sanitized.length <= 120) {
    return sanitized;
  }
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = ((hash << 5) - hash + rawKey.charCodeAt(i)) | 0;
  }
  const suffix = Math.abs(hash).toString(36);
  return `${sanitized.slice(0, 100)}_${suffix}`;
}

/**
 * Real-time listener untuk Feedback Design Quality (Tim Produksi & Kastamer).
 */
export function subscribeToFirestoreDesignFeedback(
  onUpdate: (items: DesignFeedbackItem[]) => void
) {
  const colRef = collection(db, DESIGN_FEEDBACK_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: DesignFeedbackItem[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.month && data.customer && data.projectName) {
          const fbProduksi = String(data.fbProduksi || '');
          const fbKastamer = String(data.fbKastamer || '');
          list.push({
            month: String(data.month),
            customer: String(data.customer),
            projectName: String(data.projectName),
            fbProduksi,
            fbKastamer,
            isNoRevision:
              typeof data.isNoRevision === 'boolean'
                ? data.isNoRevision
                : !fbProduksi.trim() && !fbKastamer.trim(),
          });
        }
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore Design Feedback listener notice:', err.message);
    }
  );
}

/**
 * Menyimpan / memperbarui Feedback Design Quality ke Firestore.
 */
export async function saveDesignFeedbackToFirestore(
  item: DesignFeedbackItem
): Promise<void> {
  const docId = buildDesignFeedbackDocId(item.month, item.customer, item.projectName);
  const docRef = doc(db, DESIGN_FEEDBACK_COLLECTION, docId);
  await setDoc(
    docRef,
    {
      month: item.month,
      customer: item.customer,
      projectName: item.projectName,
      fbProduksi: item.fbProduksi || '',
      fbKastamer: item.fbKastamer || '',
      isNoRevision: Boolean(item.isNoRevision),
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Menghapus Feedback Design Quality dari Firestore.
 */
export async function deleteDesignFeedbackFromFirestore(
  item: Pick<DesignFeedbackItem, 'month' | 'customer' | 'projectName'>
): Promise<void> {
  const docId = buildDesignFeedbackDocId(item.month, item.customer, item.projectName);
  const docRef = doc(db, DESIGN_FEEDBACK_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Seed initial Design Feedback jika koleksi masih kosong dan belum pernah di-seed.
 */
export async function seedDesignFeedbackIfEmpty(
  initialItems: DesignFeedbackItem[]
): Promise<void> {
  try {
    if (localStorage.getItem('eng_design_feedback_seeded') === 'true') {
      return;
    }
    const colRef = collection(db, DESIGN_FEEDBACK_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty && initialItems.length > 0) {
      const batch = writeBatch(db);
      initialItems.forEach((item) => {
        const docId = buildDesignFeedbackDocId(item.month, item.customer, item.projectName);
        const docRef = doc(db, DESIGN_FEEDBACK_COLLECTION, docId);
        batch.set(docRef, {
          month: item.month,
          customer: item.customer,
          projectName: item.projectName,
          fbProduksi: item.fbProduksi || '',
          fbKastamer: item.fbKastamer || '',
          isNoRevision: Boolean(item.isNoRevision),
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      console.info(`Seeded ${initialItems.length} initial Design Feedback records to Firestore.`);
    }
    localStorage.setItem('eng_design_feedback_seeded', 'true');
  } catch (err) {
    console.warn('Could not seed initial Design Feedback to Firestore:', err);
  }
}

/**
 * Real-time listener untuk antrean Persetujuan Manager (KPI Approval Requests).
 */
export function subscribeToFirestoreApprovals(
  onUpdate: (items: KPIApprovalRequest[]) => void
) {
  const colRef = collection(db, KPI_APPROVAL_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: KPIApprovalRequest[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        let parsedPayload: KPIApprovalRequest['payload'] = {};
        try {
          parsedPayload =
            typeof data.payload === 'string'
              ? JSON.parse(data.payload)
              : (data.payload || {});
        } catch {
          parsedPayload = {};
        }

        if (data.category && data.status) {
          list.push({
            id: String(data.id || docSnap.id),
            category: data.category,
            categoryLabel: String(data.categoryLabel || ''),
            targetLabel: String(data.targetLabel || ''),
            summaryOld: String(data.summaryOld || '-'),
            summaryNew: String(data.summaryNew || '-'),
            requestedBy: String(data.requestedBy || 'Supervisor'),
            requestedAt: String(data.requestedAt || ''),
            status: data.status,
            reviewedBy: data.reviewedBy ? String(data.reviewedBy) : undefined,
            reviewedAt: data.reviewedAt ? String(data.reviewedAt) : undefined,
            reviewNote: data.reviewNote ? String(data.reviewNote) : undefined,
            payload: parsedPayload,
          });
        }
      });
      list.sort((a, b) => (b.requestedAt || '').localeCompare(a.requestedAt || ''));
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore KPI Approvals listener notice:', err.message);
    }
  );
}

/**
 * Menyimpan / memperbarui KPI Approval Request ke Firestore.
 */
export async function saveApprovalToFirestore(
  req: KPIApprovalRequest,
  options?: { bypassQueue?: boolean }
): Promise<void> {
  const docId = (req.id || `apr_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const docRef = doc(db, KPI_APPROVAL_COLLECTION, docId);
  await executeOrQueueOffline({
    type: 'approval_save',
    coalesceKey: `approval:${docId}`,
    label: `Pengajuan ACC (${req.targetLabel})`,
    payload: { req },
    bypassQueue: options?.bypassQueue,
    runDirect: async () => {
      await setDoc(
        docRef,
        {
          id: docId,
          category: req.category,
          categoryLabel: req.categoryLabel,
          targetLabel: req.targetLabel,
          summaryOld: req.summaryOld,
          summaryNew: req.summaryNew,
          requestedBy: req.requestedBy,
          requestedAt: req.requestedAt,
          status: req.status,
          reviewedBy: req.reviewedBy || '',
          reviewedAt: req.reviewedAt || '',
          reviewNote: req.reviewNote || '',
          payload: JSON.stringify(req.payload || {}),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    },
  });
}

/**
 * Menghapus KPI Approval Request dari Firestore.
 */
export async function deleteApprovalFromFirestore(requestId: string): Promise<void> {
  const docId = requestId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const docRef = doc(db, KPI_APPROVAL_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Real-time listener untuk daftar akun staff & PIN pribadi.
 */
export function subscribeToFirestoreStaffAccounts(
  onUpdate: (items: StaffAccount[]) => void
) {
  const colRef = collection(db, STAFF_ACCOUNTS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: StaffAccount[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.name && data.role && data.pin) {
          list.push({
            id: String(data.id || docSnap.id),
            name: String(data.name),
            role: data.role,
            pin: String(data.pin),
            isActive: data.isActive !== false,
            createdAt: String(data.createdAt || ''),
            updatedAt: String(data.updatedAt || ''),
          });
        }
      });
      list.sort((a, b) => {
        const order: Record<string, number> = { Manager: 1, Supervisor: 2, Lead: 3, Designer: 4, Drafter: 5 };
        const diff = (order[a.role] || 9) - (order[b.role] || 9);
        return diff !== 0 ? diff : a.name.localeCompare(b.name);
      });
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore Staff Accounts listener notice:', err.message);
    }
  );
}

/**
 * Menyimpan atau memperbarui akun staff (termasuk pembuatan ulang PIN oleh Manager).
 */
export async function saveStaffAccountToFirestore(staff: StaffAccount): Promise<void> {
  const docId = (staff.id || `stf_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const docRef = doc(db, STAFF_ACCOUNTS_COLLECTION, docId);
  await setDoc(
    docRef,
    {
      ...staff,
      id: docId,
      updatedAt: staff.updatedAt || new Date().toISOString(),
    },
    { merge: true }
  );
}

/**
 * Menghapus akun staff dari Firestore.
 */
export async function deleteStaffAccountFromFirestore(staffId: string): Promise<void> {
  const docId = staffId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const docRef = doc(db, STAFF_ACCOUNTS_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Seed initial staff accounts jika koleksi masih kosong.
 */
export async function seedStaffAccountsIfEmpty(initialStaff: StaffAccount[]): Promise<void> {
  try {
    if (localStorage.getItem('eng_staff_accounts_seeded') === 'true') {
      return;
    }
    const colRef = collection(db, STAFF_ACCOUNTS_COLLECTION);
    const snapshot = await getDocs(colRef);
    if (snapshot.empty && initialStaff.length > 0) {
      const batch = writeBatch(db);
      initialStaff.forEach((stf) => {
        const docId = stf.id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
        const docRef = doc(db, STAFF_ACCOUNTS_COLLECTION, docId);
        batch.set(docRef, stf);
      });
      await batch.commit();
      console.info(`Seeded ${initialStaff.length} initial Staff Accounts to Firestore.`);
    }
    localStorage.setItem('eng_staff_accounts_seeded', 'true');
  } catch (err) {
    console.warn('Could not seed initial Staff Accounts to Firestore:', err);
  }
}

/**
 * Real-time listener untuk Jejak Audit Global (Monitoring, Standart Part, KPI, Staff & PIN).
 */
export function subscribeToFirestoreAuditLogs(
  onUpdate: (items: AuditLog[]) => void
) {
  const colRef = collection(db, AUDIT_LOGS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: AuditLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.timestamp && data.activity) {
          list.push({
            id: String(data.id || docSnap.id),
            timestamp: String(data.timestamp),
            user: String(data.user || 'Staff'),
            staffId: data.staffId ? String(data.staffId) : undefined,
            staffName: data.staffName ? String(data.staffName) : undefined,
            staffRole: data.staffRole || undefined,
            module: data.module || undefined,
            actionType: data.actionType || undefined,
            target: data.target ? String(data.target) : undefined,
            activity: String(data.activity),
            year: String(data.year || '-'),
            month: String(data.month || '-'),
            oldValue: data.oldValue ? String(data.oldValue) : undefined,
            newValue: String(data.newValue || '-'),
          });
        }
      });
      list.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      onUpdate(list);
    },
    (err) => {
      console.warn('Firestore Audit Logs listener notice:', err.message);
    }
  );
}

/**
 * Menyimpan 1 catatan audit log baru ke Firestore.
 */
export async function saveAuditLogToFirestore(
  log: AuditLog,
  options?: { bypassQueue?: boolean }
): Promise<void> {
  const docId = (log.id || `log_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const docRef = doc(db, AUDIT_LOGS_COLLECTION, docId);
  await executeOrQueueOffline({
    type: 'audit_log_save',
    coalesceKey: `audit:${docId}`,
    label: `Audit Log (${log.target || log.module || 'Aktivitas'})`,
    payload: { log },
    bypassQueue: options?.bypassQueue,
    runDirect: async () => {
      await setDoc(docRef, {
        ...log,
        id: docId,
      });
    },
  });
}

/**
 * Real-time listener untuk daftar sesi user yang sedang online, login, dan mengedit data.
 */
export function subscribeToFirestoreActiveSessions(
  onUpdate: (sessions: ActiveSessionPresence[]) => void
) {
  const colRef = collection(db, ACTIVE_SESSIONS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: ActiveSessionPresence[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.lastHeartbeat && data.staffName) {
          list.push({
            sessionId: String(data.sessionId || docSnap.id),
            staffId: String(data.staffId || 'viewer'),
            staffName: String(data.staffName || 'Viewer'),
            role: data.role || 'Viewer',
            status: data.status === 'editing' ? 'editing' : 'online',
            currentView: data.currentView || 'monitoring',
            editingTarget: data.editingTarget ? String(data.editingTarget) : undefined,
            deviceLabel: String(data.deviceLabel || 'Desktop / PC'),
            loggedInAt: String(data.loggedInAt || data.lastHeartbeat),
            lastHeartbeat: String(data.lastHeartbeat),
          });
        }
      });

      list.sort((a, b) => {
        if (a.status !== b.status) return a.status === 'editing' ? -1 : 1;
        const aViewer = a.role === 'Viewer' ? 1 : 0;
        const bViewer = b.role === 'Viewer' ? 1 : 0;
        if (aViewer !== bViewer) return aViewer - bViewer;
        return (b.lastHeartbeat || '').localeCompare(a.lastHeartbeat || '');
      });
      onUpdate(list);
    },
    (err) => {
      reportFirestoreError(err);
      console.warn('Firestore Active Sessions listener notice:', err.message);
    }
  );
}

/**
 * Menyimpan atau memperbarui heartbeat kehadiran & aktivitas edit user ke Firestore.
 */
export async function upsertActiveSessionToFirestore(
  session: ActiveSessionPresence
): Promise<void> {
  if ((typeof navigator !== 'undefined' && !navigator.onLine) || isFirestoreQuotaExceeded()) {
    return;
  }
  const docId = (session.sessionId || `sess_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const docRef = doc(db, ACTIVE_SESSIONS_COLLECTION, docId);
  try {
    await setDoc(
      docRef,
      {
        sessionId: docId,
        staffId: session.staffId || 'viewer',
        staffName: session.staffName || 'Viewer (Read-Only)',
        role: session.role || 'Viewer',
        status: session.status,
        currentView: session.currentView,
        editingTarget: session.editingTarget || '',
        deviceLabel: session.deviceLabel || 'Desktop / PC',
        loggedInAt: session.loggedInAt,
        lastHeartbeat: session.lastHeartbeat,
      },
      { merge: true }
    );
  } catch (err) {
    reportFirestoreError(err);
    throw err;
  }
}

/**
 * Menghapus dokumen sesi saat user menutup tab / logout.
 */
export async function removeActiveSessionFromFirestore(sessionId: string): Promise<void> {
  const docId = sessionId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (!docId) return;
  const docRef = doc(db, ACTIVE_SESSIONS_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Real-time listener untuk pesan Chat Tim Engineering yang sedang online.
 */
export function subscribeToFirestoreTeamChat(
  onUpdate: (messages: TeamChatMessage[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, TEAM_CHAT_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const list: TeamChatMessage[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.text && data.createdAt && data.senderName) {
          list.push({
            id: String(data.id || docSnap.id),
            roomId: String(data.roomId || 'global'),
            senderSessionId: String(data.senderSessionId || ''),
            senderStaffId: String(data.senderStaffId || 'viewer'),
            senderName: String(data.senderName || 'User'),
            senderRole: data.senderRole || 'Viewer',
            recipientKey: data.recipientKey ? String(data.recipientKey) : undefined,
            recipientName: data.recipientName ? String(data.recipientName) : undefined,
            text: String(data.text),
            relatedSpk: data.relatedSpk ? String(data.relatedSpk) : undefined,
            replyToId: data.replyToId ? String(data.replyToId) : undefined,
            replyToSender: data.replyToSender ? String(data.replyToSender) : undefined,
            replyToPreview: data.replyToPreview ? String(data.replyToPreview) : undefined,
            createdAt: String(data.createdAt),
          });
        }
      });

      list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      onUpdate(list.slice(-300));
    },
    (error) => {
      console.warn('Firestore Team Chat listener notice:', error.message);
      if (onError) onError(error);
    }
  );
}

/**
 * Mengirim 1 pesan chat baru secara real-time ke Firestore.
 */
export async function sendTeamChatMessageToFirestore(
  message: TeamChatMessage,
  options?: { bypassQueue?: boolean }
): Promise<void> {
  const docId = (message.id || `msg_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const docRef = doc(db, TEAM_CHAT_COLLECTION, docId);
  const payload: Record<string, string> = {
    id: docId,
    roomId: String(message.roomId || 'global').slice(0, 160),
    senderSessionId: String(message.senderSessionId || 'unknown').slice(0, 120),
    senderStaffId: String(message.senderStaffId || 'viewer').slice(0, 120),
    senderName: String(message.senderName || 'Tamu (Viewer)').slice(0, 120),
    senderRole: String(message.senderRole || 'Viewer').slice(0, 40),
    text: String(message.text).slice(0, 2000),
    createdAt: String(message.createdAt || new Date().toISOString()).slice(0, 64),
  };

  if (message.recipientKey) {
    payload.recipientKey = String(message.recipientKey).slice(0, 120);
  }
  if (message.recipientName) {
    payload.recipientName = String(message.recipientName).slice(0, 120);
  }
  if (message.relatedSpk) {
    payload.relatedSpk = String(message.relatedSpk).slice(0, 120);
  }
  if (message.replyToId) {
    payload.replyToId = String(message.replyToId).slice(0, 120);
  }
  if (message.replyToSender) {
    payload.replyToSender = String(message.replyToSender).slice(0, 120);
  }
  if (message.replyToPreview) {
    payload.replyToPreview = String(message.replyToPreview).slice(0, 240);
  }

  await executeOrQueueOffline({
    type: 'chat_send',
    coalesceKey: `chat:${docId}`,
    label: `Pesan Chat (${message.senderName})`,
    payload: { message },
    bypassQueue: options?.bypassQueue,
    runDirect: async () => {
      await setDoc(docRef, payload);
    },
  });
}

/**
 * Menghapus 1 pesan chat dari Firestore.
 */
export async function deleteTeamChatMessageFromFirestore(messageId: string): Promise<void> {
  const docId = messageId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  if (!docId) return;
  const docRef = doc(db, TEAM_CHAT_COLLECTION, docId);
  await deleteDoc(docRef);
}

// Register background/online replay executor for IndexedDB offline queue
registerOfflineSyncExecutor(async (item: OfflineMutationItem) => {
  switch (item.type) {
    case 'checklist_update':
      await updateChecklistInFirestore(
        item.payload.spk,
        item.payload.checklistKey,
        item.payload.value,
        item.payload.lastModifiedBy,
        { bypassQueue: true }
      );
      break;
    case 'project_save':
      await saveProjectToFirestore(item.payload.project, { bypassQueue: true });
      break;
    case 'project_delete':
      await deleteProjectFromFirestore(item.payload.spk, { bypassQueue: true });
      break;
    case 'kpi_save':
      await saveKPIMonthToFirestore(
        item.payload.year,
        item.payload.kpiId,
        item.payload.allMonths,
        { bypassQueue: true }
      );
      break;
    case 'standart_part_save':
      await saveStandartPartToFirestore(item.payload.item, { bypassQueue: true });
      break;
    case 'approval_save':
      await saveApprovalToFirestore(item.payload.req, { bypassQueue: true });
      break;
    case 'audit_log_save':
      await saveAuditLogToFirestore(item.payload.log, { bypassQueue: true });
      break;
    case 'chat_send':
      await sendTeamChatMessageToFirestore(item.payload.message, { bypassQueue: true });
      break;
    default:
      break;
  }
});

export interface FirestoreCloudBackupPayload {
  backupVersion: 1;
  exportedAt: string;
  firebaseProjectId: string;
  projectsCount: number;
  kpiRecordsCount: number;
  projects: EngineeringProject[];
  kpiRecordsRaw: Array<{
    docId: string;
    year: string;
    kpiId: number;
    months: Record<string, number | null>;
  }>;
  kpiYears?: Record<string, KPIItem[]>;
}

/**
 * Mengambil snapshot terbaru projects & KPI langsung dari Firestore untuk Cloud Backup JSON.
 */
export async function exportFirestoreBackupPayload(params: {
  firebaseProjectId: string;
  fallbackProjects: EngineeringProject[];
  allYearsData: Record<string, KPIItem[]>;
}): Promise<FirestoreCloudBackupPayload> {
  let projects: EngineeringProject[] = [...params.fallbackProjects];
  const kpiRecordsRaw: FirestoreCloudBackupPayload['kpiRecordsRaw'] = [];

  try {
    const [projSnap, kpiSnap] = await Promise.all([
      getDocs(collection(db, PROJECTS_COLLECTION)),
      getDocs(collection(db, KPI_COLLECTION)),
    ]);

    if (!projSnap.empty) {
      const fetchedProjects: EngineeringProject[] = [];
      projSnap.forEach((docSnap) => {
        fetchedProjects.push(docSnap.data() as EngineeringProject);
      });
      fetchedProjects.sort((a, b) => (Number(a.No) || 0) - (Number(b.No) || 0));
      projects = fetchedProjects;
    }

    if (!kpiSnap.empty) {
      kpiSnap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.year && data.kpiId !== undefined) {
          let parsedMonths: Record<string, number | null> = {};
          try {
            parsedMonths =
              typeof data.months === 'string'
                ? JSON.parse(data.months)
                : (data.months || {});
          } catch {
            parsedMonths = {};
          }
          kpiRecordsRaw.push({
            docId: docSnap.id,
            year: String(data.year),
            kpiId: Number(data.kpiId),
            months: parsedMonths,
          });
        }
      });
    }
  } catch (err) {
    console.warn('Firestore backup read fallback to local state:', err);
  }

  // Fallback jika kpi_records Firestore kosong -> ambil dari state allYearsData
  if (kpiRecordsRaw.length === 0) {
    Object.entries(params.allYearsData || {}).forEach(([year, items]) => {
      (items || []).forEach((kpi) => {
        kpiRecordsRaw.push({
          docId: `${year}_KPI_${kpi.id}`,
          year,
          kpiId: kpi.id,
          months: kpi.months || {},
        });
      });
    });
  }

  kpiRecordsRaw.sort((a, b) =>
    a.year !== b.year ? a.year.localeCompare(b.year) : a.kpiId - b.kpiId
  );

  return {
    backupVersion: 1,
    exportedAt: new Date().toISOString(),
    firebaseProjectId: params.firebaseProjectId,
    projectsCount: projects.length,
    kpiRecordsCount: kpiRecordsRaw.length,
    projects,
    kpiRecordsRaw,
    kpiYears: params.allYearsData,
  };
}

/**
 * Validasi & bulk-upsert data backup JSON (projects & KPI records) ke Firestore menggunakan chunked writeBatch.
 */
export async function bulkRestoreBackupToFirestore(
  rawBackup: unknown
): Promise<{
  restoredProjects: number;
  restoredKpiRecords: number;
  projects: EngineeringProject[];
  kpiRecords: Array<{ year: string; kpiId: number; months: Record<string, number | null> }>;
}> {
  if (!rawBackup || typeof rawBackup !== 'object') {
    throw new Error('Format file JSON tidak valid.');
  }

  const parsed = rawBackup as Partial<FirestoreCloudBackupPayload>;
  const projects: EngineeringProject[] = Array.isArray(parsed.projects)
    ? parsed.projects.filter(
        (p): p is EngineeringProject => Boolean(p && typeof p === 'object' && p.SPK)
      )
    : [];

  const kpiMap = new Map<string, { year: string; kpiId: number; months: Record<string, number | null> }>();

  if (Array.isArray(parsed.kpiRecordsRaw)) {
    parsed.kpiRecordsRaw.forEach((rec) => {
      if (rec && rec.year && rec.kpiId !== undefined) {
        const key = `${rec.year}_KPI_${Number(rec.kpiId)}`;
        kpiMap.set(key, {
          year: String(rec.year),
          kpiId: Number(rec.kpiId),
          months: rec.months && typeof rec.months === 'object' ? rec.months : {},
        });
      }
    });
  }

  if (kpiMap.size === 0 && parsed.kpiYears && typeof parsed.kpiYears === 'object') {
    Object.entries(parsed.kpiYears).forEach(([year, items]) => {
      if (Array.isArray(items)) {
        items.forEach((item) => {
          if (item && item.id !== undefined) {
            const key = `${year}_KPI_${Number(item.id)}`;
            kpiMap.set(key, {
              year: String(year),
              kpiId: Number(item.id),
              months: item.months && typeof item.months === 'object' ? item.months : {},
            });
          }
        });
      }
    });
  }

  const kpiRecords = Array.from(kpiMap.values());

  if (projects.length === 0 && kpiRecords.length === 0) {
    throw new Error('File backup tidak memiliki data proyek atau KPI yang valid untuk di-restore.');
  }

  const nowIso = new Date().toISOString();
  const operations: Array<{
    ref: ReturnType<typeof doc>;
    data: Record<string, any>;
  }> = [];

  projects.forEach((proj) => {
    const docId = String(proj.SPK || `PROJ_${Date.now()}`)
      .replace(/\//g, '_')
      .slice(0, 120);
    operations.push({
      ref: doc(db, PROJECTS_COLLECTION, docId),
      data: {
        ...proj,
        updatedAt: nowIso,
      },
    });
  });

  kpiRecords.forEach((rec) => {
    const docId = `${rec.year}_KPI_${rec.kpiId}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
    operations.push({
      ref: doc(db, KPI_COLLECTION, docId),
      data: {
        year: rec.year,
        kpiId: rec.kpiId,
        months: JSON.stringify(rec.months || {}),
        updatedAt: nowIso,
      },
    });
  });

  const BATCH_LIMIT = 400;
  for (let i = 0; i < operations.length; i += BATCH_LIMIT) {
    const chunk = operations.slice(i, i + BATCH_LIMIT);
    const batch = writeBatch(db);
    chunk.forEach((op) => {
      batch.set(op.ref, op.data, { merge: true });
    });
    await batch.commit();
  }

  return {
    restoredProjects: projects.length,
    restoredKpiRecords: kpiRecords.length,
    projects,
    kpiRecords,
  };
}

