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
import { EngineeringProject, KPIItem, SerahTerimaStandartPartItem } from '../types/engineering';

const PROJECTS_COLLECTION = 'engineering_projects';
const KPI_COLLECTION = 'kpi_records';
const REVIEW_COST_COLLECTION = 'review_cost_records';
const REVIEW_ERROR_COLLECTION = 'review_error_records';
const STANDART_PART_COLLECTION = 'standart_part_handovers';

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
 * Real-time listener untuk Review Cost.
 */
export function subscribeToFirestoreReviewCost(
  onUpdate: (data: Record<string, { anggaran: number; pengeluaran: any[] }>) => void
) {
  const colRef = collection(db, REVIEW_COST_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const result: Record<string, { anggaran: number; pengeluaran: any[] }> = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const key = docSnap.id;
      let exp: any[] = [];
      try {
        exp = typeof data.pengeluaran === 'string' ? JSON.parse(data.pengeluaran) : (data.pengeluaran || []);
      } catch {
        exp = data.pengeluaran || [];
      }
      result[key] = {
        anggaran: Number(data.anggaran || 0),
        pengeluaran: exp,
      };
    });
    onUpdate(result);
  });
}

/**
 * Menyimpan Review Cost ke Firestore.
 */
export async function saveReviewCostToFirestore(
  key: string,
  data: { anggaran: number; pengeluaran: any[] }
): Promise<void> {
  const docId = key.replace(/[\/\\#\s]/g, '_');
  const docRef = doc(db, REVIEW_COST_COLLECTION, docId);
  await setDoc(docRef, {
    key,
    anggaran: data.anggaran,
    pengeluaran: JSON.stringify(data.pengeluaran),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
}

/**
 * Real-time listener untuk Review Error.
 */
export function subscribeToFirestoreReviewError(
  onUpdate: (data: Record<string, { errors: any[] }>) => void
) {
  const colRef = collection(db, REVIEW_ERROR_COLLECTION);
  return onSnapshot(colRef, (snapshot) => {
    const result: Record<string, { errors: any[] }> = {};
    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const key = docSnap.id;
      let errs: any[] = [];
      try {
        errs = typeof data.errors === 'string' ? JSON.parse(data.errors) : (data.errors || []);
      } catch {
        errs = data.errors || [];
      }
      result[key] = { errors: errs };
    });
    onUpdate(result);
  });
}

/**
 * Menyimpan Review Error ke Firestore.
 */
export async function saveReviewErrorToFirestore(
  key: string,
  data: { errors: any[] }
): Promise<void> {
  const docId = key.replace(/[\/\\#\s]/g, '_');
  const docRef = doc(db, REVIEW_ERROR_COLLECTION, docId);
  await setDoc(docRef, {
    key,
    errors: JSON.stringify(data.errors),
    updatedAt: new Date().toISOString(),
  }, { merge: true });
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

      list.push({
        id: docSnap.id,
        no: Number(data.no) || 1,
        month: data.month || 'Oktober',
        prepareStaff: staff,
        projectName: data.projectName || '',
        partNames: parts,
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
