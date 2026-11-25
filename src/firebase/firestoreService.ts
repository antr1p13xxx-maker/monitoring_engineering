import { 
  collection, 
  doc, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  writeBatch
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { EngineeringProject, KPIItem, SerahTerimaStandartPartItem, StandartPartAttachment, DesignFeedbackItem, ReviewCostItem, ReviewErrorItem, KPIApprovalRequest } from '../types/engineering';

const PROJECTS_COLLECTION = 'engineering_projects';
const KPI_COLLECTION = 'kpi_records';
const REVIEW_COST_COLLECTION = 'review_cost_records';
const REVIEW_ERROR_COLLECTION = 'review_error_records';
const STANDART_PART_COLLECTION = 'standart_part_handovers';
const DESIGN_FEEDBACK_COLLECTION = 'design_feedback_records';
const KPI_APPROVAL_COLLECTION = 'kpi_approval_requests';

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
      console.warn('Firestore projects listener notice:', error.message);
      if (onError) onError(error);
    }
  );
}

/**
 * Menyimpan atau memperbarui data proyek ke Firestore.
 */
export async function saveProjectToFirestore(project: EngineeringProject): Promise<void> {
  const docId = (project.SPK || `PROJ_${Date.now()}`).replace(/\//g, '_');
  const docRef = doc(db, PROJECTS_COLLECTION, docId);
  await setDoc(docRef, {
    ...project,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Memperbarui status checklist suatu proyek secara langsung.
 */
export async function updateChecklistInFirestore(
  spk: string, 
  checklistKey: string, 
  value: string
): Promise<void> {
  const docId = spk.replace(/\//g, '_');
  const docRef = doc(db, PROJECTS_COLLECTION, docId);
  await setDoc(docRef, {
    [checklistKey]: value,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Menghapus proyek dari Firestore berdasarkan nomor SPK.
 */
export async function deleteProjectFromFirestore(spk: string): Promise<void> {
  const docId = spk.replace(/\//g, '_');
  const docRef = doc(db, PROJECTS_COLLECTION, docId);
  await deleteDoc(docRef);
}

/**
 * Seed initial data ke Firestore jika collection proyek masih kosong.
 */
export async function seedFirestoreIfEmpty(initialProjects: EngineeringProject[]): Promise<void> {
  try {
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
  } catch (err) {
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
  return onSnapshot(colRef, (snapshot) => {
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
  });
}

/**
 * Menyimpan nilai bulanan KPI ke Firestore.
 */
export async function saveKPIMonthToFirestore(
  year: string,
  kpiId: number,
  allMonths: Record<string, number | null>
): Promise<void> {
  const docId = `${year}_KPI_${kpiId}`;
  const docRef = doc(db, KPI_COLLECTION, docId);
  await setDoc(docRef, {
    year,
    kpiId,
    months: JSON.stringify(allMonths),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Seed KPI data awal jika kosong.
 */
export async function seedKPIsIfEmpty(year: string, kpiList: KPIItem[]): Promise<void> {
  try {
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
  } catch (err) {
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
        notes: data.notes || ''
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
  item: SerahTerimaStandartPartItem
): Promise<void> {
  const docId = (item.id || `stp_${Date.now()}`).replace(/[\/\\#\s]/g, '_');
  const docRef = doc(db, STANDART_PART_COLLECTION, docId);
  await setDoc(docRef, {
    ...item,
    prepareStaff: JSON.stringify(item.prepareStaff),
    partNames: JSON.stringify(item.partNames),
    partAttachments: JSON.stringify(item.partAttachments || []),
    updatedAt: new Date().toISOString()
  }, { merge: true });
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
  } catch (err) {
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
  req: KPIApprovalRequest
): Promise<void> {
  const docId = (req.id || `apr_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const docRef = doc(db, KPI_APPROVAL_COLLECTION, docId);
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
}

/**
 * Menghapus KPI Approval Request dari Firestore.
 */
export async function deleteApprovalFromFirestore(requestId: string): Promise<void> {
  const docId = requestId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
  const docRef = doc(db, KPI_APPROVAL_COLLECTION, docId);
  await deleteDoc(docRef);
}
