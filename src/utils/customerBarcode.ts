import {
  EngineeringProject,
  SerahTerimaStandartPartItem,
  DesignFeedbackItem,
  ReviewCostItem,
  ReviewErrorItem
} from '../types/engineering';
import { CHECKLIST_KEYS } from '../data/initialData';

export interface CustomerRecordSummary {
  key: string;
  customerName: string;
  barcodeId: string;
  projects: EngineeringProject[];
  standartParts: SerahTerimaStandartPartItem[];
  feedbacks: DesignFeedbackItem[];
  reviewCosts: ReviewCostItem[];
  reviewErrors: ReviewErrorItem[];
  totalProjects: number;
  doneProjects: number;
  inProgressProjects: number;
  revisiProjects: number;
  totalQtyDrawing: number;
  avgChecklistPct: number;
  totalStandartPartHandovers: number;
  totalStandartPartItems: number;
  totalAnggaran: number;
  totalPengeluaran: number;
  costEfficiencyPct: number | null;
  totalErrorCases: number;
  errorRatePct: number;
  approvedFeedbackCount: number;
  revisedFeedbackCount: number;
  spks: string[];
  poNumbers: string[];
  pics: string[];
}

export function normalizeCustomerKey(name: string | undefined | null): string {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

function fnv1aHashHex(str: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 4);
}

/**
 * Generates a unique, deterministic Code-128 compatible Customer Barcode ID.
 * Example: KMI-ASTRA-7F2A
 */
export function generateCustomerBarcodeId(customerName: string): string {
  const normalized = normalizeCustomerKey(customerName);
  if (!normalized) return 'KMI-CST-0000';

  const stripped = normalized
    .replace(/\b(PT|CV|UD|TBK|INC|LTD|CO|CORP)\b\.?/g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '');

  const prefix = (stripped || normalized.replace(/[^A-Z0-9]/g, '') || 'CST').slice(0, 5).padEnd(3, 'X');
  const hash = fnv1aHashHex(normalized);
  return `KMI-${prefix}-${hash}`;
}

export function buildCustomerBarcodeUrl(customerName: string, barcodeId: string): string {
  if (typeof window === 'undefined') {
    return `?customer_barcode=${encodeURIComponent(barcodeId)}&customer=${encodeURIComponent(customerName)}`;
  }
  const url = new URL(window.location.origin + window.location.pathname);
  url.searchParams.set('customer_barcode', barcodeId);
  url.searchParams.set('customer', customerName);
  return url.toString();
}

export function buildCustomerOfflinePayload(rec: CustomerRecordSummary): string {
  const costRatio = rec.costEfficiencyPct !== null ? `${rec.costEfficiencyPct.toFixed(1)}%` : '-';
  const lines = [
    `KMIL ENGINEERING DOSSIER`,
    `KODE: ${rec.barcodeId}`,
    `KASTAMER: ${rec.customerName}`,
    `SPK (${rec.totalProjects}): ${rec.spks.slice(0, 6).join(', ') || '-'}${rec.spks.length > 6 ? ' +' : ''}`,
    `DRAWING: ${rec.totalQtyDrawing} pcs | DONE: ${rec.doneProjects}/${rec.totalProjects} | CHECKLIST: ${rec.avgChecklistPct}%`,
    `STD PART: ${rec.totalStandartPartHandovers} BAST (${rec.totalStandartPartItems} item)`,
    `COST: Rp ${rec.totalPengeluaran.toLocaleString('id-ID')} / Rp ${rec.totalAnggaran.toLocaleString('id-ID')} (${costRatio})`,
    `ERROR: ${rec.totalErrorCases} kasus (${rec.errorRatePct.toFixed(1)}%)`
  ];
  return lines.join('\n');
}

export function aggregateCustomerRecords(params: {
  projects: EngineeringProject[];
  standartPartList: SerahTerimaStandartPartItem[];
  feedbackList: DesignFeedbackItem[];
  reviewCostList: ReviewCostItem[];
  reviewErrorList: ReviewErrorItem[];
}): CustomerRecordSummary[] {
  const { projects, standartPartList, feedbackList, reviewCostList, reviewErrorList } = params;

  const map = new Map<
    string,
    {
      displayNames: Map<string, number>;
      projects: EngineeringProject[];
      standartParts: SerahTerimaStandartPartItem[];
      feedbacks: DesignFeedbackItem[];
      reviewCosts: ReviewCostItem[];
      reviewErrors: ReviewErrorItem[];
    }
  >();

  const ensureBucket = (rawName: string | undefined | null) => {
    const cleaned = String(rawName || '').trim().replace(/\s+/g, ' ');
    if (!cleaned) return null;
    const key = normalizeCustomerKey(cleaned);
    let bucket = map.get(key);
    if (!bucket) {
      bucket = {
        displayNames: new Map(),
        projects: [],
        standartParts: [],
        feedbacks: [],
        reviewCosts: [],
        reviewErrors: []
      };
      map.set(key, bucket);
    }
    bucket.displayNames.set(cleaned, (bucket.displayNames.get(cleaned) || 0) + 1);
    return bucket;
  };

  projects.forEach((p) => {
    const b = ensureBucket(p.Customer);
    if (b) b.projects.push(p);
  });

  standartPartList.forEach((s) => {
    const b = ensureBucket(s.customer);
    if (b) b.standartParts.push(s);
  });

  feedbackList.forEach((f) => {
    const b = ensureBucket(f.customer);
    if (b) b.feedbacks.push(f);
  });

  reviewCostList.forEach((c) => {
    const b = ensureBucket(c.customer);
    if (b) b.reviewCosts.push(c);
  });

  reviewErrorList.forEach((e) => {
    const b = ensureBucket(e.customer);
    if (b) b.reviewErrors.push(e);
  });

  const results: CustomerRecordSummary[] = [];

  map.forEach((bucket, key) => {
    // Pick the most frequent display name variant (preferring project Customer spelling)
    let bestName = key;
    let bestCount = -1;
    bucket.displayNames.forEach((count, name) => {
      if (count > bestCount) {
        bestCount = count;
        bestName = name;
      }
    });

    const totalProjects = bucket.projects.length;
    const doneProjects = bucket.projects.filter((p) => p.Status === 'Selesai').length;
    const inProgressProjects = bucket.projects.filter((p) => p.Status === 'In Progress').length;
    const revisiProjects = bucket.projects.filter((p) => p.Status === 'Revisi').length;
    const totalQtyDrawing = bucket.projects.reduce((sum, p) => sum + (Number(p['Qty Drawing']) || 0), 0);

    let checklistSumPct = 0;
    bucket.projects.forEach((p) => {
      const checkedCount = CHECKLIST_KEYS.filter((k) => Boolean(p[k] && String(p[k]).trim() !== '')).length;
      checklistSumPct += (checkedCount / CHECKLIST_KEYS.length) * 100;
    });
    const avgChecklistPct = totalProjects > 0 ? Math.round(checklistSumPct / totalProjects) : 0;

    const totalStandartPartHandovers = bucket.standartParts.length;
    const totalStandartPartItems = bucket.standartParts.reduce(
      (sum, item) => sum + (item.partNames?.length || 0),
      0
    );

    const totalAnggaran = bucket.reviewCosts.reduce((sum, item) => sum + (Number(item.anggaran) || 0), 0);
    const totalPengeluaran = bucket.reviewCosts.reduce(
      (sum, item) => sum + item.pengeluaran.reduce((s, x) => s + (Number(x.amount) || 0), 0),
      0
    );
    const costEfficiencyPct = totalAnggaran > 0 ? (totalPengeluaran / totalAnggaran) * 100 : null;

    const totalErrorCases = bucket.reviewErrors.reduce((sum, item) => sum + item.errors.length, 0);
    const errorRatePct = totalQtyDrawing > 0 ? (totalErrorCases / totalQtyDrawing) * 100 : 0;

    const approvedFeedbackCount = bucket.feedbacks.filter(
      (f) => f.isNoRevision || (!f.fbProduksi?.trim() && !f.fbKastamer?.trim())
    ).length;
    const revisedFeedbackCount = bucket.feedbacks.length - approvedFeedbackCount;

    const spks = Array.from(new Set(bucket.projects.map((p) => p.SPK).filter(Boolean)));
    const poNumbers = Array.from(new Set(bucket.projects.map((p) => p['Nomor PO']).filter(Boolean)));
    const pics = Array.from(new Set(bucket.projects.map((p) => p.PIC).filter(Boolean)));

    results.push({
      key,
      customerName: bestName,
      barcodeId: generateCustomerBarcodeId(bestName),
      projects: bucket.projects,
      standartParts: bucket.standartParts,
      feedbacks: bucket.feedbacks,
      reviewCosts: bucket.reviewCosts,
      reviewErrors: bucket.reviewErrors,
      totalProjects,
      doneProjects,
      inProgressProjects,
      revisiProjects,
      totalQtyDrawing,
      avgChecklistPct,
      totalStandartPartHandovers,
      totalStandartPartItems,
      totalAnggaran,
      totalPengeluaran,
      costEfficiencyPct,
      totalErrorCases,
      errorRatePct,
      approvedFeedbackCount,
      revisedFeedbackCount,
      spks,
      poNumbers,
      pics
    });
  });

  // Sort by most projects then alphabetically
  return results.sort((a, b) => {
    if (b.totalProjects !== a.totalProjects) return b.totalProjects - a.totalProjects;
    return a.customerName.localeCompare(b.customerName, 'id');
  });
}
