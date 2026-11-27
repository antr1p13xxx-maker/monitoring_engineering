import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  EngineeringProject,
  SerahTerimaStandartPartItem,
  StandartPartAttachment,
  DesignFeedbackItem,
  ReviewCostItem,
  ReviewErrorItem,
  UserRole,
  ChecklistKey
} from '../types/engineering';
import { PartAttachmentPreviewModal } from './PartAttachmentPreviewModal';
import { formatFileSize } from '../utils/partAttachmentUtils';
import { CHECKLIST_KEYS, MONTH_FULL_NAMES, getProjectChecklistProgress } from '../data/initialData';
import { calculateProjectMilestoneOverdue } from '../utils/milestoneOverdue';
import {
  CustomerRecordSummary,
  aggregateCustomerRecords,
  buildCustomerBarcodeUrl,
  buildCustomerOfflinePayload,
  getSpkBarcodeId,
  buildSpkBarcodeUrl,
  buildSpkOfflinePayload,
  normalizeCustomerKey
} from '../utils/customerBarcode';
import {
  CustomerBarcodeGraphic,
  downloadCustomerStickerPng,
  downloadSpkStickerPng,
  generateBarcodeAssets
} from './CustomerBarcodeGraphic';
import {
  QrCode,
  Search,
  ScanLine,
  Printer,
  Download,
  Copy,
  Check,
  FolderOpen,
  PackageCheck,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  Box,
  PenSquare,
  ExternalLink,
  Camera,
  FileText,
  Layers,
  ArrowUp,
  ArrowDown,
  ListChecks,
  Clock,
  Filter,
  RotateCcw,
  Calendar
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

interface CustomerBarcodeViewProps {
  projects: EngineeringProject[];
  standartPartList: SerahTerimaStandartPartItem[];
  feedbackList: DesignFeedbackItem[];
  reviewCostList: ReviewCostItem[];
  reviewErrorList: ReviewErrorItem[];
  userRole: UserRole;
  initialLookupQuery?: string | null;
  onClearInitialLookup?: () => void;
  initialSpkLookup?: string | null;
  onClearInitialSpkLookup?: () => void;
  onChecklistToggle?: (spk: string, key: ChecklistKey, isChecked: boolean) => void;
  onChecklistDateChange?: (spk: string, key: ChecklistKey, date: string) => void;
  onEditProject: (project: EngineeringProject) => void;
  onOpenCadViewer: (spk: string, projectName: string, customer: string) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const CustomerBarcodeView: React.FC<CustomerBarcodeViewProps> = ({
  projects,
  standartPartList,
  feedbackList,
  reviewCostList,
  reviewErrorList,
  userRole,
  initialLookupQuery,
  onClearInitialLookup,
  initialSpkLookup,
  onClearInitialSpkLookup,
  onChecklistToggle,
  onChecklistDateChange,
  onEditProject,
  onOpenCadViewer,
  showToast
}) => {
  const [barcodeViewMode, setBarcodeViewMode] = useState<'customers' | 'spk'>('customers');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<string | null>(null);
  const [selectedSpkProjectSpk, setSelectedSpkProjectSpk] = useState<string | null>(null);
  const [spkStatusFilter, setSpkStatusFilter] = useState<'ALL' | 'In Progress' | 'Revisi' | 'Selesai'>('ALL');
  const [spkMonthFilter, setSpkMonthFilter] = useState<string>('ALL');
  const [spkYearFilter, setSpkYearFilter] = useState<string>('ALL');
  const [spkPicFilter, setSpkPicFilter] = useState<string>('ALL');
  const [spkCustomerFilter, setSpkCustomerFilter] = useState<string>('ALL');
  const [spkProgressFilter, setSpkProgressFilter] = useState<'ALL' | 'overdue' | 'due_soon' | 'incomplete' | 'complete_100'>('ALL');
  const [spkSortBy, setSpkSortBy] = useState<'spk' | 'progress' | 'target'>('spk');
  const [spkSortOrder, setSpkSortOrder] = useState<'asc' | 'desc'>('asc');
  const [showMobileSpkFilters, setShowMobileSpkFilters] = useState(false);
  const [dossierTab, setDossierTab] = useState<'projects' | 'standartPart' | 'kpiCostError' | 'label'>('projects');
  const [dossierSearch, setDossierSearch] = useState('');
  const [dossierSpkSort, setDossierSpkSort] = useState<'asc' | 'desc'>('asc');
  const [qrMode, setQrMode] = useState<'url' | 'offline'>('url');
  const [expandedProjectSpk, setExpandedProjectSpk] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [previewPartAttachment, setPreviewPartAttachment] = useState<StandartPartAttachment | null>(null);

  // Camera Scanner Modal state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [scannerSupported, setScannerSupported] = useState<boolean>(false);
  const [manualScanInput, setManualScanInput] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);

  const isReadOnly = userRole === 'Viewer';

  const customerRecords = useMemo(
    () =>
      aggregateCustomerRecords({
        projects,
        standartPartList,
        feedbackList,
        reviewCostList,
        reviewErrorList
      }),
    [projects, standartPartList, feedbackList, reviewCostList, reviewErrorList]
  );

  // Auto-open customer dossier when navigated via scanned QR URL or direct customer jump
  useEffect(() => {
    if (!initialLookupQuery || customerRecords.length === 0) return;
    const raw = initialLookupQuery.trim();
    const norm = normalizeCustomerKey(raw);

    const found = customerRecords.find(
      (c) =>
        c.barcodeId.toUpperCase() === norm ||
        c.key === norm ||
        c.customerName.toUpperCase().includes(norm)
    );
    if (found) {
      setBarcodeViewMode('customers');
      setSelectedCustomerKey(found.key);
      setDossierTab('projects');
      showToast(`Rekam jejak kastamer "${found.customerName}" (${found.barcodeId}) dibuka.`, 'success');
    } else {
      setSearchQuery(raw);
      showToast(`Barcode "${raw}" tidak ditemukan secara eksak, menampilkan hasil pencarian.`, 'info');
    }
    if (onClearInitialLookup) onClearInitialLookup();
  }, [initialLookupQuery, customerRecords, onClearInitialLookup, showToast]);

  // Auto-open specific SPK Progress & Checklist modal when navigated via ?spk_barcode=...
  useEffect(() => {
    if (!initialSpkLookup || projects.length === 0) return;
    const raw = initialSpkLookup.trim();
    const upper = raw.toUpperCase();

    const found =
      projects.find((p) => getSpkBarcodeId(p).toUpperCase() === upper) ||
      projects.find((p) => p.SPK.toUpperCase().includes(upper));

    setBarcodeViewMode('spk');
    if (found) {
      setSelectedSpkProjectSpk(found.SPK);
      showToast(`Progress SPK ${found.SPK} (${found['Nama Project']}) dibuka.`, 'success');
    } else {
      setSearchQuery(raw);
      showToast(`Barcode SPK "${raw}" tidak ditemukan secara eksak, menampilkan pencarian.`, 'info');
    }
    if (onClearInitialSpkLookup) onClearInitialSpkLookup();
  }, [initialSpkLookup, projects, onClearInitialSpkLookup, showToast]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customerRecords;
    return customerRecords.filter(
      (c) =>
        c.customerName.toLowerCase().includes(q) ||
        c.barcodeId.toLowerCase().includes(q) ||
        c.spks.some((s) => s.toLowerCase().includes(q)) ||
        c.poNumbers.some((po) => po.toLowerCase().includes(q)) ||
        c.projects.some((p) => p['Nama Project'].toLowerCase().includes(q))
    );
  }, [customerRecords, searchQuery]);

  const getSpkMonthsForFilter = (val: string): string[] | null => {
    if (!val || val === 'ALL') return null;
    if (val === 'Q1') return ['Januari', 'Februari', 'Maret'];
    if (val === 'Q2') return ['April', 'Mei', 'Juni'];
    if (val === 'Q3') return ['Juli', 'Agustus', 'September'];
    if (val === 'Q4') return ['Oktober', 'November', 'Desember'];
    return [val];
  };

  const spkFilterOptions = useMemo(() => {
    const yearSet = new Set<string>();
    const picSet = new Set<string>();
    const customerSet = new Set<string>();

    projects.forEach((p) => {
      const dateSources = [p['Delivery Time'], p['Target Design'], p['Permintaan Drawing/Design']];
      dateSources.forEach((ds) => {
        const m = /^(\d{4})/.exec(String(ds || '').trim());
        if (m) yearSet.add(m[1]);
      });
      const spkYear = /(20\d{2})/.exec(String(p.SPK || ''));
      if (spkYear) yearSet.add(spkYear[1]);

      const pic = String(p.PIC || '').trim();
      if (pic) picSet.add(pic);

      const cust = String(p.Customer || '').trim();
      if (cust) customerSet.add(cust);
    });

    return {
      years: Array.from(yearSet).sort(),
      pics: Array.from(picSet).sort((a, b) => a.localeCompare(b, 'id')),
      customers: Array.from(customerSet).sort((a, b) => a.localeCompare(b, 'id'))
    };
  }, [projects]);

  const activeSpkFilterCount = useMemo(() => {
    let count = 0;
    if (spkMonthFilter !== 'ALL') count++;
    if (spkYearFilter !== 'ALL') count++;
    if (spkPicFilter !== 'ALL') count++;
    if (spkCustomerFilter !== 'ALL') count++;
    if (spkProgressFilter !== 'ALL') count++;
    if (spkStatusFilter !== 'ALL') count++;
    return count;
  }, [spkMonthFilter, spkYearFilter, spkPicFilter, spkCustomerFilter, spkProgressFilter, spkStatusFilter]);

  const resetAllSpkFilters = () => {
    setSearchQuery('');
    setSpkStatusFilter('ALL');
    setSpkMonthFilter('ALL');
    setSpkYearFilter('ALL');
    setSpkPicFilter('ALL');
    setSpkCustomerFilter('ALL');
    setSpkProgressFilter('ALL');
    setSpkSortBy('spk');
    setSpkSortOrder('asc');
  };

  const filteredSpkProjects = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const allowedMonths = getSpkMonthsForFilter(spkMonthFilter);

    const list = projects.filter((p) => {
      if (spkStatusFilter !== 'ALL' && p.Status !== spkStatusFilter) return false;

      if (allowedMonths && !allowedMonths.includes(String(p.Bulan || '').trim())) {
        return false;
      }

      if (spkYearFilter !== 'ALL') {
        const dateStr = p['Delivery Time'] || p['Target Design'] || p['Permintaan Drawing/Design'] || '';
        const matchYear =
          (dateStr && String(dateStr).startsWith(spkYearFilter)) ||
          (p.SPK && p.SPK.includes(spkYearFilter));
        if (!matchYear) return false;
      }

      if (spkPicFilter !== 'ALL' && String(p.PIC || '').trim() !== spkPicFilter) {
        return false;
      }

      if (spkCustomerFilter !== 'ALL' && String(p.Customer || '').trim() !== spkCustomerFilter) {
        return false;
      }

      if (spkProgressFilter !== 'ALL') {
        if (spkProgressFilter === 'overdue') {
          if (!calculateProjectMilestoneOverdue(p['Target Design'], p.Status).isOverdue) return false;
        } else if (spkProgressFilter === 'due_soon') {
          if (!calculateProjectMilestoneOverdue(p['Target Design'], p.Status).isDueSoon) return false;
        } else if (spkProgressFilter === 'incomplete') {
          const prog = getProjectChecklistProgress(p);
          if (prog.totalRequired === 0 || prog.percent >= 100) return false;
        } else if (spkProgressFilter === 'complete_100') {
          const prog = getProjectChecklistProgress(p);
          if (prog.totalRequired === 0 || prog.percent < 100) return false;
        }
      }

      if (!q) return true;
      return (
        (p.SPK || '').toLowerCase().includes(q) ||
        (p['Nomor PO'] || '').toLowerCase().includes(q) ||
        (p['Nama Project'] || '').toLowerCase().includes(q) ||
        (p.Customer || '').toLowerCase().includes(q) ||
        (p.PIC || '').toLowerCase().includes(q) ||
        (p.Bulan || '').toLowerCase().includes(q) ||
        (p.Status || '').toLowerCase().includes(q)
      );
    });

    return list.slice().sort((a, b) => {
      let cmp = 0;
      if (spkSortBy === 'progress') {
        cmp = getProjectChecklistProgress(a).percent - getProjectChecklistProgress(b).percent;
      } else if (spkSortBy === 'target') {
        const ta = a['Target Design'] || '9999-99-99';
        const tb = b['Target Design'] || '9999-99-99';
        cmp = ta.localeCompare(tb);
      }
      if (cmp === 0) {
        cmp = (a.SPK || '').localeCompare(b.SPK || '', undefined, { numeric: true, sensitivity: 'base' });
      }
      return spkSortOrder === 'asc' ? cmp : -cmp;
    });
  }, [
    projects,
    searchQuery,
    spkStatusFilter,
    spkMonthFilter,
    spkYearFilter,
    spkPicFilter,
    spkCustomerFilter,
    spkProgressFilter,
    spkSortBy,
    spkSortOrder
  ]);

  const spkStats = useMemo(() => {
    const total = filteredSpkProjects.length;
    const allTotal = projects.length;
    const done = filteredSpkProjects.filter((p) => p.Status === 'Selesai').length;
    const active = filteredSpkProjects.filter((p) => p.Status === 'In Progress' || p.Status === 'Revisi').length;
    const overdue = filteredSpkProjects.filter(
      (p) => calculateProjectMilestoneOverdue(p['Target Design'], p.Status).isOverdue
    ).length;
    const avgPct =
      total > 0
        ? Math.round(filteredSpkProjects.reduce((sum, p) => sum + getProjectChecklistProgress(p).percent, 0) / total)
        : 0;
    return { total, allTotal, done, active, overdue, avgPct };
  }, [filteredSpkProjects, projects.length]);

  const selectedCustomer = useMemo(
    () => customerRecords.find((c) => c.key === selectedCustomerKey) || null,
    [customerRecords, selectedCustomerKey]
  );

  const selectedSpkProject = useMemo(
    () => (selectedSpkProjectSpk ? projects.find((p) => p.SPK === selectedSpkProjectSpk) || null : null),
    [projects, selectedSpkProjectSpk]
  );

  // Reset internal dossier search & SPK sort whenever switching or closing customer
  useEffect(() => {
    setDossierSearch('');
    setDossierSpkSort('asc');
    setExpandedProjectSpk(null);
  }, [selectedCustomerKey]);

  const filteredDossier = useMemo(() => {
    if (!selectedCustomer) {
      return {
        projects: [] as EngineeringProject[],
        standartParts: [] as SerahTerimaStandartPartItem[],
        feedbacks: [] as DesignFeedbackItem[],
        reviewCosts: [] as ReviewCostItem[],
        reviewErrors: [] as ReviewErrorItem[]
      };
    }

    const spkByProjectName = new Map<string, string>();
    selectedCustomer.projects.forEach((p) => {
      const pname = (p['Nama Project'] || '').trim().toLowerCase();
      if (pname && p.SPK && !spkByProjectName.has(pname)) {
        spkByProjectName.set(pname, p.SPK);
      }
    });

    const compareBySpk = (spkA?: string, spkB?: string) => {
      const a = (spkA || '').trim();
      const b = (spkB || '').trim();
      if (!a && !b) return 0;
      if (!a) return 1;
      if (!b) return -1;
      const cmp = a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
      return dossierSpkSort === 'asc' ? cmp : -cmp;
    };

    const q = dossierSearch.trim().toLowerCase();

    const projectsMatched = (
      !q
        ? selectedCustomer.projects
        : selectedCustomer.projects.filter((p) => {
            const hitMeta =
              (p.SPK || '').toLowerCase().includes(q) ||
              (p['Nomor PO'] || '').toLowerCase().includes(q) ||
              (p['Nama Project'] || '').toLowerCase().includes(q) ||
              (p.PIC || '').toLowerCase().includes(q) ||
              (p.Bulan || '').toLowerCase().includes(q) ||
              (p.Status || '').toLowerCase().includes(q) ||
              (p.keterangan || '').toLowerCase().includes(q) ||
              (p['Target Design'] || '').toLowerCase().includes(q);
            if (hitMeta) return true;
            const { requiredKeys } = getProjectChecklistProgress(p);
            return requiredKeys.some(
              (ck) => ck.toLowerCase().includes(q) && Boolean(p[ck] && String(p[ck]).trim() !== '')
            );
          })
    )
      .slice()
      .sort((a, b) => compareBySpk(a.SPK, b.SPK));

    const standartPartsMatched = (
      !q
        ? selectedCustomer.standartParts
        : selectedCustomer.standartParts.filter(
            (sp) =>
              (sp.projectName || '').toLowerCase().includes(q) ||
              (sp.month || '').toLowerCase().includes(q) ||
              (sp.division || '').toLowerCase().includes(q) ||
              (sp.signature || '').toLowerCase().includes(q) ||
              (sp.spk || '').toLowerCase().includes(q) ||
              (sp.notes || '').toLowerCase().includes(q) ||
              (sp.prepareStaff || []).some((s) => s.toLowerCase().includes(q)) ||
              (sp.partNames || []).some((pn) => pn.toLowerCase().includes(q)) ||
              (sp.partAttachments || []).some(
                (att) =>
                  att.fileName.toLowerCase().includes(q) ||
                  (att.partLabel || '').toLowerCase().includes(q)
              )
          )
    )
      .slice()
      .sort((a, b) =>
        compareBySpk(
          a.spk || spkByProjectName.get((a.projectName || '').trim().toLowerCase()),
          b.spk || spkByProjectName.get((b.projectName || '').trim().toLowerCase())
        )
      );

    const feedbacksMatched = (
      !q
        ? selectedCustomer.feedbacks
        : selectedCustomer.feedbacks.filter(
            (fb) =>
              (fb.projectName || '').toLowerCase().includes(q) ||
              (fb.month || '').toLowerCase().includes(q) ||
              (fb.fbProduksi || '').toLowerCase().includes(q) ||
              (fb.fbKastamer || '').toLowerCase().includes(q)
          )
    )
      .slice()
      .sort((a, b) =>
        compareBySpk(
          spkByProjectName.get((a.projectName || '').trim().toLowerCase()),
          spkByProjectName.get((b.projectName || '').trim().toLowerCase())
        )
      );

    const reviewCostsMatched = (
      !q
        ? selectedCustomer.reviewCosts
        : selectedCustomer.reviewCosts.filter(
            (rc) =>
              (rc.projectName || '').toLowerCase().includes(q) ||
              (rc.month || '').toLowerCase().includes(q) ||
              rc.pengeluaran.some((item) => item.desc.toLowerCase().includes(q))
          )
    )
      .slice()
      .sort((a, b) =>
        compareBySpk(
          spkByProjectName.get((a.projectName || '').trim().toLowerCase()),
          spkByProjectName.get((b.projectName || '').trim().toLowerCase())
        )
      );

    const reviewErrorsMatched = (
      !q
        ? selectedCustomer.reviewErrors
        : selectedCustomer.reviewErrors.filter(
            (re) =>
              (re.projectName || '').toLowerCase().includes(q) ||
              (re.month || '').toLowerCase().includes(q) ||
              re.errors.some(
                (err) =>
                  err.partName.toLowerCase().includes(q) ||
                  err.feedback.toLowerCase().includes(q)
              )
          )
    )
      .slice()
      .sort((a, b) =>
        compareBySpk(
          spkByProjectName.get((a.projectName || '').trim().toLowerCase()),
          spkByProjectName.get((b.projectName || '').trim().toLowerCase())
        )
      );

    return {
      projects: projectsMatched,
      standartParts: standartPartsMatched,
      feedbacks: feedbacksMatched,
      reviewCosts: reviewCostsMatched,
      reviewErrors: reviewErrorsMatched
    };
  }, [selectedCustomer, dossierSearch, dossierSpkSort]);

  // Global totals
  const globalStats = useMemo(() => {
    return {
      totalCustomers: customerRecords.length,
      totalProjects: customerRecords.reduce((s, c) => s + c.totalProjects, 0),
      totalHandovers: customerRecords.reduce((s, c) => s + c.totalStandartPartHandovers, 0),
      totalErrors: customerRecords.reduce((s, c) => s + c.totalErrorCases, 0)
    };
  }, [customerRecords]);

  type ScanResolution =
    | { type: 'spk'; project: EngineeringProject }
    | { type: 'customer'; customer: CustomerRecordSummary }
    | null;

  // Resolve scanned text (could be URL for SPK or Customer, offline payload, barcodeId, SPK, or customer name)
  const resolveScannedCode = (rawText: string): ScanResolution => {
    const trimmed = rawText.trim();
    if (!trimmed) return null;

    // 1. Check URL with ?spk_barcode=... / ?spk=... or ?customer_barcode=... / ?customer=...
    try {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        const parsed = new URL(trimmed);
        const spkParam = parsed.searchParams.get('spk_barcode') || parsed.searchParams.get('spk');
        if (spkParam) {
          const hitProj = projects.find(
            (p) => getSpkBarcodeId(p).toUpperCase() === spkParam.trim().toUpperCase()
          );
          if (hitProj) return { type: 'spk', project: hitProj };
        }
        const bc = parsed.searchParams.get('customer_barcode');
        const cn = parsed.searchParams.get('customer');
        if (bc) {
          const hit = customerRecords.find((c) => c.barcodeId.toUpperCase() === bc.trim().toUpperCase());
          if (hit) return { type: 'customer', customer: hit };
        }
        if (cn) {
          const hit = customerRecords.find((c) => c.key === normalizeCustomerKey(cn));
          if (hit) return { type: 'customer', customer: hit };
        }
      }
    } catch {
      // ignore invalid URL
    }

    // 2. Check structured offline SPK payload `SPK: ...`
    if (trimmed.includes('KMIL PROGRESS SPK')) {
      const spkMatch = trimmed.match(/SPK:\s*([^\r\n]+)/i);
      if (spkMatch) {
        const hitProj = projects.find(
          (p) => getSpkBarcodeId(p).toUpperCase() === spkMatch[1].trim().toUpperCase()
        );
        if (hitProj) return { type: 'spk', project: hitProj };
      }
    }

    // 3. Check structured offline customer payload line `KODE: KMI-...`
    const kodeMatch = trimmed.match(/KODE:\s*(KMI-[A-Z0-9-]+)/i);
    if (kodeMatch) {
      const hit = customerRecords.find((c) => c.barcodeId.toUpperCase() === kodeMatch[1].toUpperCase());
      if (hit) return { type: 'customer', customer: hit };
    }

    // 4. Direct match by SPK first (exact SPK barcode scan)
    const upper = trimmed.toUpperCase();
    const exactSpk = projects.find((p) => getSpkBarcodeId(p).toUpperCase() === upper);
    if (exactSpk) return { type: 'spk', project: exactSpk };

    // 5. Direct match by customer barcodeId or customerName
    const norm = normalizeCustomerKey(trimmed);
    const matchedCustomer =
      customerRecords.find(
        (c) =>
          c.barcodeId.toUpperCase() === norm ||
          c.key === norm ||
          c.customerName.toUpperCase().includes(norm)
      ) || null;
    if (matchedCustomer) return { type: 'customer', customer: matchedCustomer };

    return null;
  };

  const applyScannedResolution = (res: Exclude<ScanResolution, null>) => {
    if (res.type === 'spk') {
      setBarcodeViewMode('spk');
      setSelectedSpkProjectSpk(res.project.SPK);
      showToast(`Barcode SPK terdeteksi! Membuka progres ${res.project.SPK} (${res.project['Nama Project']}).`, 'success');
    } else {
      setBarcodeViewMode('customers');
      setSelectedCustomerKey(res.customer.key);
      setDossierTab('projects');
      showToast(`Barcode terdeteksi! Membuka data ${res.customer.customerName}.`, 'success');
    }
  };

  // Camera Scanner Lifecycle
  const stopCamera = () => {
    if (scanTimerRef.current !== null) {
      window.clearInterval(scanTimerRef.current);
      scanTimerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    if (!isScannerOpen) {
      stopCamera();
      return;
    }

    let cancelled = false;
    setScannerError(null);

    const hasBarcodeDetector = typeof (window as any).BarcodeDetector !== 'undefined';
    setScannerSupported(hasBarcodeDetector);

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setScannerError('Kamera tidak tersedia pada browser ini. Gunakan pencarian manual atau pilih kastamer di bawah.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }

        if (hasBarcodeDetector) {
          const DetectorClass = (window as any).BarcodeDetector;
          const detector = new DetectorClass({
            formats: ['qr_code', 'code_128', 'code_39', 'ean_13']
          });

          scanTimerRef.current = window.setInterval(async () => {
            if (!videoRef.current || videoRef.current.readyState < 2) return;
            try {
              const detected = await detector.detect(videoRef.current);
              if (detected && detected.length > 0) {
                const rawVal = detected[0].rawValue || '';
                const matched = resolveScannedCode(rawVal);
                if (matched) {
                  stopCamera();
                  setIsScannerOpen(false);
                  applyScannedResolution(matched);
                }
              }
            } catch {
              // ignore transient frame read errors
            }
          }, 400);
        }
      } catch (err: any) {
        if (!cancelled) {
          setScannerError(
            err?.name === 'NotAllowedError'
              ? 'Izin kamera ditolak. Berikan akses kamera atau gunakan input kode manual di bawah.'
              : 'Kamera tidak dapat diakses pada perangkat ini. Gunakan input kode manual di bawah.'
          );
        }
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isScannerOpen]);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      const matched = resolveScannedCode(searchQuery);
      if (matched) {
        applyScannedResolution(matched);
      } else {
        showToast(`Tidak ada kastamer atau SPK dengan kode/nama "${searchQuery}".`, 'info');
      }
    }
  };

  const handleCopyLink = async (rec: CustomerRecordSummary) => {
    const url = buildCustomerBarcodeUrl(rec.customerName, rec.barcodeId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(rec.key);
      showToast(`Link barcode ${rec.customerName} disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showToast('Gagal menyalin link. Gunakan tombol unduh stiker atau PDF.', 'error');
    }
  };

  const handleDownloadSticker = async (rec: CustomerRecordSummary) => {
    const qrValue =
      qrMode === 'url' ? buildCustomerBarcodeUrl(rec.customerName, rec.barcodeId) : buildCustomerOfflinePayload(rec);
    await downloadCustomerStickerPng({
      barcodeId: rec.barcodeId,
      customerName: rec.customerName,
      qrValue,
      subtitle: `${rec.totalProjects} SPK · ${rec.totalQtyDrawing} Drawing · ${rec.totalStandartPartHandovers} Std Part`
    });
    showToast(`Stiker barcode ${rec.barcodeId} berhasil diunduh.`, 'success');
  };

  const handleCopySpkLink = async (project: EngineeringProject) => {
    const spkId = getSpkBarcodeId(project);
    const url = buildSpkBarcodeUrl(spkId);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(`spk:${spkId}`);
      showToast(`Link progress SPK ${spkId} disalin ke clipboard!`, 'success');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      showToast('Gagal menyalin link SPK. Gunakan tombol unduh PNG atau PDF.', 'error');
    }
  };

  const handleDownloadSpkSticker = async (project: EngineeringProject) => {
    const spkId = getSpkBarcodeId(project);
    const { completedCount, totalRequired, percent } = getProjectChecklistProgress(project);
    const qrValue = qrMode === 'url' ? buildSpkBarcodeUrl(spkId) : buildSpkOfflinePayload(project);
    await downloadSpkStickerPng({
      spk: spkId,
      projectName: project['Nama Project'],
      customerName: project.Customer,
      pic: project.PIC || '-',
      status: project.Status,
      targetDesign: project['Target Design'] || '-',
      progressText: totalRequired > 0 ? `${completedCount}/${totalRequired} (${percent}%)` : 'Tanpa Checklist',
      qrValue
    });
    showToast(`Stiker barcode progress SPK ${spkId} berhasil diunduh.`, 'success');
  };

  // Export Single Customer Complete Dossier PDF
  const handleExportCustomerDossierPDF = async (rec: CustomerRecordSummary) => {
    try {
      const qrVal = buildCustomerBarcodeUrl(rec.customerName, rec.barcodeId);
      const { qrDataUrl, barcodeDataUrl } = await generateBarcodeAssets(rec.barcodeId, qrVal);

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();

      // Header Banner
      doc.setFillColor(15, 23, 42);
      doc.rect(12, 10, pageW - 24, 18, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(255, 255, 255);
      doc.text('DOSSIER & BARCODE RECORD KASTAMER - ENGINEERING', 16, 18);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(203, 213, 225);
      doc.text(`PT. Kurnia Mustika Indah Lestari · Dicetak: ${new Date().toLocaleDateString('id-ID')}`, 16, 24);

      // Barcode Box
      doc.setDrawColor(203, 213, 225);
      doc.setLineWidth(0.3);
      doc.roundedRect(12, 31, pageW - 24, 34, 2, 2, 'S');
      doc.addImage(qrDataUrl, 'PNG', 15, 33, 30, 30);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text(rec.customerName, 49, 40);

      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`KODE BARCODE: ${rec.barcodeId}`, 49, 46);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(
        `SPK: ${rec.totalProjects} (${rec.doneProjects} Selesai)  |  Qty Drawing: ${rec.totalQtyDrawing}  |  Checklist Avg: ${rec.avgChecklistPct}%`,
        49,
        52
      );
      doc.text(
        `Std Part BAST: ${rec.totalStandartPartHandovers} (${rec.totalStandartPartItems} part)  |  Cost: Rp ${rec.totalPengeluaran.toLocaleString('id-ID')} / Rp ${rec.totalAnggaran.toLocaleString('id-ID')}  |  Error: ${rec.totalErrorCases} kasus`,
        49,
        57
      );
      doc.addImage(barcodeDataUrl, 'PNG', 142, 34, 52, 16);

      let cursorY = 70;

      // Section 1: Projects
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`1. Daftar Proyek & Monitoring Drawing (${rec.projects.length})`, 12, cursorY);

      autoTable(doc, {
        startY: cursorY + 2,
        head: [['SPK', 'No PO', 'Project', 'PIC', 'Qty', 'Target', 'Selesai', 'Status', 'Checklist']],
        body:
          rec.projects.length > 0
            ? rec.projects.map((p) => {
                const { completedCount, totalRequired } = getProjectChecklistProgress(p);
                return [
                  p.SPK,
                  p['Nomor PO'] || '-',
                  p['Nama Project'],
                  p.PIC,
                  p['Qty Drawing'] || 0,
                  p['Target Design'] || '-',
                  p['Tanggal Penyelesaian'] || p['Aktual Engineering'] || '-',
                  p.Status,
                  `${completedCount}/${totalRequired}`
                ];
              })
            : [['-', '-', 'Belum ada data proyek', '-', '-', '-', '-', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        margin: { left: 12, right: 12 }
      });

      cursorY = ((doc as any).lastAutoTable?.finalY || cursorY + 20) + 7;

      // Section 2: Standart Part Handover
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`2. Serah Terima Standart Part (${rec.standartParts.length})`, 12, cursorY);

      autoTable(doc, {
        startY: cursorY + 2,
        head: [['Bulan', 'Project', 'Prepare Staff', 'Daftar Part', 'Tgl Distribusi', 'Divisi', 'Penerima']],
        body:
          rec.standartParts.length > 0
            ? rec.standartParts.map((sp) => [
                sp.month || '-',
                sp.projectName,
                sp.prepareStaff?.join(', ') || '-',
                sp.partNames?.join(', ') || '-',
                sp.distributionDate ? `${sp.distributionDate} ${sp.distributionTime || ''}` : '-',
                sp.division || '-',
                sp.signature || '-'
              ])
            : [['-', 'Belum ada catatan serah terima standart part', '-', '-', '-', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [30, 58, 138], textColor: [255, 255, 255] },
        margin: { left: 12, right: 12 }
      });

      cursorY = ((doc as any).lastAutoTable?.finalY || cursorY + 20) + 7;

      // Section 3: KPI Review Cost & Design Error & Feedback
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text(`3. Rekam Jejak KPI (Feedback, Cost & Error Drawing)`, 12, cursorY);

      const kpiSummaryRows: any[] = [];
      rec.feedbacks.forEach((f) => {
        kpiSummaryRows.push([
          'Design Quality',
          f.month,
          f.projectName,
          `Produksi: ${f.fbProduksi || '-'} | Kastamer: ${f.fbKastamer || '-'}`,
          f.isNoRevision ? 'Approve' : 'Revisi'
        ]);
      });
      rec.reviewCosts.forEach((c) => {
        const exp = c.pengeluaran.reduce((s, x) => s + x.amount, 0);
        const eff = c.anggaran > 0 ? `${((exp / c.anggaran) * 100).toFixed(1)}%` : '-';
        kpiSummaryRows.push([
          'Review Cost',
          c.month,
          c.projectName,
          `Anggaran: Rp ${c.anggaran.toLocaleString('id-ID')} | Realisasi: Rp ${exp.toLocaleString('id-ID')} (${c.pengeluaran.map((x) => x.desc).join(', ') || '-'})`,
          eff
        ]);
      });
      rec.reviewErrors.forEach((e) => {
        e.errors.forEach((err) => {
          kpiSummaryRows.push([
            'Error Rate',
            e.month,
            e.projectName,
            `Part: ${err.partName} — ${err.feedback}`,
            'Revisi'
          ]);
        });
      });

      autoTable(doc, {
        startY: cursorY + 2,
        head: [['Kategori', 'Bulan', 'Project', 'Rincian Catatan', 'Status / Nilai']],
        body:
          kpiSummaryRows.length > 0
            ? kpiSummaryRows
            : [['-', '-', 'Belum ada catatan Feedback, Cost, atau Error untuk kastamer ini', '-', '-']],
        theme: 'grid',
        styles: { fontSize: 7, cellPadding: 1.5 },
        headStyles: { fillColor: [4, 120, 87], textColor: [255, 255, 255] },
        margin: { left: 12, right: 12 }
      });

      doc.save(`Dossier_Barcode_${rec.barcodeId}_${rec.customerName.replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`);
      showToast(`PDF Dossier Lengkap "${rec.customerName}" berhasil dicetak.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mencetak PDF dossier kastamer.', 'error');
    }
  };

  // Export Multi-Label Sticker Sheet PDF for all filtered customers
  const handleExportAllBarcodesPDF = async () => {
    if (filteredRecords.length === 0) return;
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 12;
      const colGap = 6;
      const cardW = (pageW - margin * 2 - colGap) / 2;
      const cardH = 58;

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('DAFTAR LABEL BARCODE KASTAMER - ENGINEERING KMIL', margin, 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text(`Total ${filteredRecords.length} Kastamer · Scan QR atau Code-128 untuk akses seluruh record kastamer`, margin, 16.5);
      };

      drawHeader();

      for (let i = 0; i < filteredRecords.length; i++) {
        const idxOnPage = i % 8;
        if (i > 0 && idxOnPage === 0) {
          doc.addPage();
          drawHeader();
        }

        const rec = filteredRecords[i];
        const col = idxOnPage % 2;
        const row = Math.floor(idxOnPage / 2);
        const x = margin + col * (cardW + colGap);
        const y = 21 + row * (cardH + 5);

        const qrVal = buildCustomerBarcodeUrl(rec.customerName, rec.barcodeId);
        const { qrDataUrl, barcodeDataUrl } = await generateBarcodeAssets(rec.barcodeId, qrVal);

        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.35);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'S');

        doc.setFillColor(15, 23, 42);
        doc.rect(x, y, cardW, 7, 'F');
        doc.setFont('courier', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(rec.barcodeId, x + 3, y + 4.8);

        doc.addImage(qrDataUrl, 'PNG', x + 3, y + 10, 26, 26);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(15, 23, 42);
        const nameLines = doc.splitTextToSize(rec.customerName, cardW - 35);
        doc.text(nameLines.slice(0, 2), x + 32, y + 14.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        doc.text(`SPK: ${rec.totalProjects} (${rec.doneProjects} Done) · Draw: ${rec.totalQtyDrawing}`, x + 32, y + 25);
        doc.text(`Std Part: ${rec.totalStandartPartHandovers} BAST · Error: ${rec.totalErrorCases}`, x + 32, y + 29.5);

        doc.addImage(barcodeDataUrl, 'PNG', x + 3, y + 38, cardW - 6, 17);
      }

      doc.save(`Label_Barcode_Semua_Kastamer_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast(`Label Barcode PDF (${filteredRecords.length} kastamer) berhasil diunduh.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat PDF label barcode.', 'error');
    }
  };

  // Export Multi-Label Sticker Sheet PDF for all filtered SPK Progress Barcodes
  const handleExportAllSpkBarcodesPDF = async () => {
    if (filteredSpkProjects.length === 0) return;
    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 12;
      const colGap = 6;
      const cardW = (pageW - margin * 2 - colGap) / 2;
      const cardH = 58;

      const drawHeader = () => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(15, 23, 42);
        doc.text('DAFTAR LABEL BARCODE PROGRESS SPK - ENGINEERING KMIL', margin, 12);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        const activeFilterParts = [
          spkMonthFilter !== 'ALL' ? `Bulan: ${spkMonthFilter}` : null,
          spkYearFilter !== 'ALL' ? `Tahun: ${spkYearFilter}` : null,
          spkStatusFilter !== 'ALL' ? `Status: ${spkStatusFilter}` : null,
          spkPicFilter !== 'ALL' ? `PIC: ${spkPicFilter}` : null,
          spkCustomerFilter !== 'ALL' ? `Kastamer: ${spkCustomerFilter}` : null
        ].filter(Boolean);
        const filterSummary = activeFilterParts.length > 0 ? ` [${activeFilterParts.join(' · ')}]` : '';
        doc.text(
          `Total ${filteredSpkProjects.length} SPK${filterSummary} · Scan QR atau Code-128 untuk cek & update checklist SPK`,
          margin,
          16.5
        );
      };

      drawHeader();

      for (let i = 0; i < filteredSpkProjects.length; i++) {
        const idxOnPage = i % 8;
        if (i > 0 && idxOnPage === 0) {
          doc.addPage();
          drawHeader();
        }

        const p = filteredSpkProjects[i];
        const spkId = getSpkBarcodeId(p);
        const { completedCount, totalRequired, percent } = getProjectChecklistProgress(p);
        const col = idxOnPage % 2;
        const row = Math.floor(idxOnPage / 2);
        const x = margin + col * (cardW + colGap);
        const y = 21 + row * (cardH + 5);

        const qrVal = buildSpkBarcodeUrl(spkId);
        const { qrDataUrl, barcodeDataUrl } = await generateBarcodeAssets(spkId, qrVal);

        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.35);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'S');

        doc.setFillColor(15, 23, 42);
        doc.rect(x, y, cardW, 7, 'F');
        doc.setFont('courier', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(255, 255, 255);
        doc.text(`${spkId} · ${p.Status.toUpperCase()}`, x + 3, y + 4.8);

        doc.addImage(qrDataUrl, 'PNG', x + 3, y + 10, 26, 26);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        const nameLines = doc.splitTextToSize(p['Nama Project'] || spkId, cardW - 35);
        doc.text(nameLines.slice(0, 2), x + 32, y + 14.5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(71, 85, 105);
        const custShort = (p.Customer || '-').slice(0, 26);
        doc.text(`${custShort}`, x + 32, y + 24);
        doc.text(
          `PIC: ${p.PIC || '-'} · Checklist: ${completedCount}/${totalRequired} (${percent}%)`,
          x + 32,
          y + 28.5
        );
        doc.text(`Target: ${p['Target Design'] || '-'}`, x + 32, y + 33);

        doc.addImage(barcodeDataUrl, 'PNG', x + 3, y + 38, cardW - 6, 17);
      }

      doc.save(`Label_Barcode_SPK_Progress_${new Date().toISOString().split('T')[0]}.pdf`);
      showToast(`Label Barcode SPK PDF (${filteredSpkProjects.length} SPK) berhasil diunduh.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat PDF label barcode SPK.', 'error');
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header & Scanner Controls */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-base sm:text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <QrCode className="w-5 h-5 text-slate-800 shrink-0" />
              <span>
                {barcodeViewMode === 'spk'
                  ? 'Barcode Progress per SPK / Project'
                  : 'Barcode & Rekam Jejak Terpadu Kastamer'}
              </span>
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {barcodeViewMode === 'spk'
                ? 'Setiap SPK/Project memiliki QR Code & Barcode Code-128 tersendiri. Scan stiker di map drawing atau meja kerja untuk membuka progres & update checklist langsung.'
                : 'Setiap kastamer memiliki kode barcode unik (QR + Code-128) yang mencatat seluruh SPK, checklist drawing, serah terima standart part, feedback kualitas, biaya, dan histori error.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl theme-btn-primary text-xs font-semibold flex items-center justify-center gap-2 transition whitespace-nowrap"
            >
              <ScanLine className="w-4 h-4 shrink-0" />
              <span>Scan Barcode Kamera</span>
            </button>

            {barcodeViewMode === 'customers' ? (
              <button
                type="button"
                onClick={handleExportAllBarcodesPDF}
                disabled={filteredRecords.length === 0}
                className="min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition whitespace-nowrap disabled:opacity-50"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>Cetak Label Kastamer PDF</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleExportAllSpkBarcodesPDF}
                disabled={filteredSpkProjects.length === 0}
                className="min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold flex items-center justify-center gap-2 transition whitespace-nowrap disabled:opacity-50"
              >
                <Printer className="w-4 h-4 shrink-0" />
                <span>Cetak Label SPK PDF</span>
              </button>
            )}
          </div>
        </div>

        {/* Mode Switcher Tabs: Per Kastamer vs Per SPK / Progress */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
          <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setBarcodeViewMode('customers')}
              className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                barcodeViewMode === 'customers'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-3.5 h-3.5 shrink-0" />
              <span>Barcode per Kastamer ({customerRecords.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setBarcodeViewMode('spk')}
              className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition whitespace-nowrap ${
                barcodeViewMode === 'spk'
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5 shrink-0" />
              <span>
                Barcode per SPK / Progress (
                {barcodeViewMode === 'spk' && activeSpkFilterCount > 0
                  ? `${filteredSpkProjects.length}/${projects.length}`
                  : projects.length}
                )
              </span>
            </button>
          </div>

          {barcodeViewMode === 'spk' && (
            <div className="flex flex-wrap items-center gap-1.5">
              {(['ALL', 'In Progress', 'Revisi', 'Selesai'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setSpkStatusFilter(st)}
                  className={`min-h-[34px] px-3 py-1 rounded-lg text-[11px] font-semibold transition border ${
                    spkStatusFilter === st
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st === 'ALL' ? 'Semua Status' : st}
                </button>
              ))}
              <select
                value={spkSortBy}
                onChange={(e) => setSpkSortBy(e.target.value as 'spk' | 'progress' | 'target')}
                aria-label="Urutkan SPK berdasarkan"
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="spk">Urut: No. SPK</option>
                <option value="progress">Urut: Progress %</option>
                <option value="target">Urut: Target Design</option>
              </select>
              <button
                type="button"
                onClick={() => setSpkSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-1"
                title="Ubah arah urutan"
              >
                {spkSortOrder === 'asc' ? (
                  <ArrowUp className="w-3 h-3 text-blue-600" />
                ) : (
                  <ArrowDown className="w-3 h-3 text-blue-600" />
                )}
                <span>{spkSortOrder === 'asc' ? 'Naik' : 'Turun'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Search / Barcode Gun Input */}
        <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center pt-1">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder={
                barcodeViewMode === 'spk'
                  ? 'Scan barcode SPK atau cari nomor SPK, nama project, PIC, kastamer, PO...'
                  : 'Scan barcode gun atau cari nama kastamer, kode KMI-..., SPK, Nomor PO...'
              }
              className="w-full min-h-[44px] sm:min-h-[40px] pl-10 pr-10 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            {barcodeViewMode === 'spk' && (
              <button
                type="button"
                onClick={() => setShowMobileSpkFilters((v) => !v)}
                className={`sm:hidden min-h-[40px] px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition ${
                  showMobileSpkFilters || activeSpkFilterCount > 0
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span>Filter{activeSpkFilterCount > 0 ? ` (${activeSpkFilterCount})` : ''}</span>
              </button>
            )}

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => setQrMode('url')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  qrMode === 'url' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {barcodeViewMode === 'spk' ? 'QR Link Progress SPK' : 'QR Link Dossier'}
              </button>
              <button
                type="button"
                onClick={() => setQrMode('offline')}
                className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                  qrMode === 'offline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                QR Teks Ringkas
              </button>
            </div>
          </div>
        </div>

        {/* Filter Bulan, Tahun, PIC, Kastamer & Kondisi Progress khusus Barcode per SPK */}
        {barcodeViewMode === 'spk' && (
          <div className={`${showMobileSpkFilters ? 'block' : 'hidden sm:block'} pt-3 border-t border-slate-100 space-y-2.5`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>Filter SPK (Bulan, Tahun, PIC, Kastamer &amp; Progres)</span>
                {activeSpkFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold tabular-nums">
                    {activeSpkFilterCount} aktif
                  </span>
                )}
              </div>

              {(activeSpkFilterCount > 0 || searchQuery) && (
                <button
                  type="button"
                  onClick={resetAllSpkFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset Semua Filter</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Bulan / Kuartal
                </label>
                <select
                  value={spkMonthFilter}
                  onChange={(e) => setSpkMonthFilter(e.target.value)}
                  className="w-full min-h-[38px] text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="ALL">Semua Bulan</option>
                  <optgroup label="Kuartal">
                    <option value="Q1">Q1 (Jan - Mar)</option>
                    <option value="Q2">Q2 (Apr - Jun)</option>
                    <option value="Q3">Q3 (Jul - Sep)</option>
                    <option value="Q4">Q4 (Okt - Des)</option>
                  </optgroup>
                  <optgroup label="Bulan">
                    {Object.values(MONTH_FULL_NAMES).map((fullMonth) => (
                      <option key={fullMonth} value={fullMonth}>
                        {fullMonth}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Tahun
                </label>
                <select
                  value={spkYearFilter}
                  onChange={(e) => setSpkYearFilter(e.target.value)}
                  className="w-full min-h-[38px] text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="ALL">Semua Tahun</option>
                  {spkFilterOptions.years.map((yr) => (
                    <option key={yr} value={yr}>
                      Tahun {yr}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  PIC Engineering
                </label>
                <select
                  value={spkPicFilter}
                  onChange={(e) => setSpkPicFilter(e.target.value)}
                  className="w-full min-h-[38px] text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="ALL">Semua PIC ({spkFilterOptions.pics.length})</option>
                  {spkFilterOptions.pics.map((pic) => (
                    <option key={pic} value={pic}>
                      {pic}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Kastamer
                </label>
                <select
                  value={spkCustomerFilter}
                  onChange={(e) => setSpkCustomerFilter(e.target.value)}
                  className="w-full min-h-[38px] text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="ALL">Semua Kastamer ({spkFilterOptions.customers.length})</option>
                  {spkFilterOptions.customers.map((cust) => (
                    <option key={cust} value={cust}>
                      {cust}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Progres &amp; Target Design
                </label>
                <select
                  value={spkProgressFilter}
                  onChange={(e) =>
                    setSpkProgressFilter(
                      e.target.value as 'ALL' | 'overdue' | 'due_soon' | 'incomplete' | 'complete_100'
                    )
                  }
                  className="w-full min-h-[38px] text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium focus:ring-2 focus:ring-slate-900 focus:outline-none"
                >
                  <option value="ALL">Semua Kondisi</option>
                  <option value="overdue">Overdue (Lewat Target)</option>
                  <option value="due_soon">Mendekati Target (≤3 Hari)</option>
                  <option value="incomplete">Checklist Belum 100%</option>
                  <option value="complete_100">Checklist Sudah 100%</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4 Summary Metrics Strip */}
      {barcodeViewMode === 'customers' ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Kastamer Terdaftar</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{globalStats.totalCustomers}</p>
            </div>
            <QrCode className="w-6 h-6 text-slate-400 shrink-0" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Total Proyek & SPK</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{globalStats.totalProjects}</p>
            </div>
            <FolderOpen className="w-6 h-6 text-blue-600 shrink-0" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Serah Terima Std Part</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{globalStats.totalHandovers}</p>
            </div>
            <PackageCheck className="w-6 h-6 text-emerald-600 shrink-0" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Kasus Revisi & Error</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{globalStats.totalErrors}</p>
            </div>
            <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">
                {activeSpkFilterCount > 0 || searchQuery ? 'SPK Terfilter' : 'Total Barcode SPK'}
              </p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {spkStats.total}
                {(activeSpkFilterCount > 0 || searchQuery) && (
                  <span className="text-xs font-semibold text-slate-400 ml-1">/ {spkStats.allTotal}</span>
                )}
              </p>
            </div>
            <QrCode className="w-6 h-6 text-slate-400 shrink-0" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Rata-Rata Progress</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{spkStats.avgPct}%</p>
            </div>
            <ListChecks className="w-6 h-6 text-blue-600 shrink-0" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">SPK Selesai</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{spkStats.done}</p>
            </div>
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-slate-500">Aktif / Overdue</p>
              <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">
                {spkStats.active}
                {spkStats.overdue > 0 && (
                  <span className="text-xs font-bold text-rose-600 ml-1.5">({spkStats.overdue} telat)</span>
                )}
              </p>
            </div>
            <Clock className="w-6 h-6 text-amber-600 shrink-0" />
          </div>
        </div>
      )}

      {/* TAB A: CUSTOMER BARCODE GRID */}
      {barcodeViewMode === 'customers' && (
        filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
            <QrCode className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Tidak ada kastamer yang cocok dengan pencarian</p>
            <p className="text-xs text-slate-500">Coba bersihkan kata kunci atau tambahkan proyek baru untuk kastamer terkait.</p>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="mt-2 min-h-[40px] px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Reset Pencarian
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredRecords.map((rec) => {
              const qrValue =
                qrMode === 'url'
                  ? buildCustomerBarcodeUrl(rec.customerName, rec.barcodeId)
                  : buildCustomerOfflinePayload(rec);

              return (
                <div
                  key={rec.key}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-slate-300 transition flex flex-col justify-between p-4 space-y-4"
                >
                  <div className="space-y-3">
                    {/* Title + Clean Unboxed Metadata */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug">
                          {rec.customerName}
                        </h3>
                        <span className="font-mono text-[11px] font-bold text-slate-700 shrink-0 tabular-nums">
                          {rec.barcodeId}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1 tabular-nums">
                        <span>{rec.totalProjects} SPK</span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.totalQtyDrawing} Drawing</span>
                        <span aria-hidden="true">·</span>
                        <span>{rec.totalStandartPartHandovers} Std Part</span>
                      </div>
                    </div>

                    {/* Dual Real Barcode (QR + Code 128) */}
                    <CustomerBarcodeGraphic
                      barcodeId={rec.barcodeId}
                      qrValue={qrValue}
                      customerName={rec.customerName}
                      compact
                    />

                    {/* Tabular Metrics Strip */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-100 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Proyek Selesai</span>
                        <span className="font-semibold text-slate-900 font-mono tabular-nums">
                          {rec.doneProjects} / {rec.totalProjects} ({rec.avgChecklistPct}% checklist)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Quality & Error</span>
                        <span
                          className={`font-semibold font-mono tabular-nums ${
                            rec.totalErrorCases > 0 ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {rec.totalErrorCases} revisi ({rec.errorRatePct.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-slate-500 block text-[11px]">Realisasi Biaya Engineering</span>
                        <span className="font-semibold text-slate-900 font-mono tabular-nums">
                          Rp {rec.totalPengeluaran.toLocaleString('id-ID')} / Rp {rec.totalAnggaran.toLocaleString('id-ID')}
                          {rec.costEfficiencyPct !== null ? ` (${rec.costEfficiencyPct.toFixed(1)}%)` : ''}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerKey(rec.key);
                        setDossierTab('projects');
                      }}
                      className="col-span-2 min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <FileText className="w-3.5 h-3.5 shrink-0" />
                      <span>Buka Rekam</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadSticker(rec)}
                      title="Unduh Stiker PNG"
                      className="min-h-[42px] px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>PNG</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportCustomerDossierPDF(rec)}
                      title="Cetak Dossier PDF"
                      className="min-h-[42px] px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1 transition"
                    >
                      <Printer className="w-3.5 h-3.5 shrink-0" />
                      <span>PDF</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* TAB B: SPK / PROJECT PROGRESS BARCODE GRID */}
      {barcodeViewMode === 'spk' && (
        filteredSpkProjects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-10 text-center space-y-2">
            <ListChecks className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-semibold text-slate-700">Tidak ada SPK yang cocok dengan filter atau pencarian</p>
            <p className="text-xs text-slate-500">Ubah filter bulan, tahun, PIC, kastamer, status, atau kata kunci pencarian.</p>
            {(searchQuery || activeSpkFilterCount > 0) && (
              <button
                type="button"
                onClick={resetAllSpkFilters}
                className="mt-2 min-h-[40px] px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
              >
                Reset Filter SPK
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSpkProjects.map((p) => {
              const spkId = getSpkBarcodeId(p);
              const { completedCount, totalRequired, percent, isCustom } = getProjectChecklistProgress(p);
              const milestoneStatus = calculateProjectMilestoneOverdue(p['Target Design'], p.Status);
              const qrValue = qrMode === 'url' ? buildSpkBarcodeUrl(spkId) : buildSpkOfflinePayload(p);

              return (
                <div
                  key={`${p.SPK}-${p.No}`}
                  className={`bg-white rounded-2xl border shadow-sm hover:border-slate-300 transition flex flex-col justify-between p-4 space-y-3.5 ${
                    milestoneStatus.isOverdue
                      ? 'border-rose-300 border-l-4 border-l-rose-600'
                      : milestoneStatus.isDueSoon
                      ? 'border-amber-200 border-l-4 border-l-amber-500'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header: SPK + Status */}
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-mono text-slate-500">
                            <span className="font-bold text-slate-900">{spkId}</span>
                            <span aria-hidden="true">·</span>
                            <span>{p.Bulan}</span>
                          </div>
                          <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug mt-0.5 line-clamp-2">
                            {p['Nama Project']}
                          </h3>
                        </div>

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                              p.Status === 'Selesai'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : p.Status === 'Revisi'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {p.Status}
                          </span>
                          {milestoneStatus.isOverdue && (
                            <span
                              title={milestoneStatus.warningMessage}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-600 text-white text-[9px] font-bold"
                            >
                              <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                              <span>{milestoneStatus.shortLabel}</span>
                            </span>
                          )}
                          {milestoneStatus.isDueSoon && (
                            <span
                              title={milestoneStatus.warningMessage}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-bold"
                            >
                              <span>{milestoneStatus.shortLabel}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 mt-1">
                        <span className="font-semibold text-slate-700 truncate max-w-[180px]">{p.Customer}</span>
                        <span aria-hidden="true">·</span>
                        <span>PIC: {p.PIC || '-'}</span>
                      </div>
                    </div>

                    {/* Dual Barcode (QR + Code 128 for SPK) */}
                    <CustomerBarcodeGraphic
                      barcodeId={spkId}
                      qrValue={qrValue}
                      customerName={p['Nama Project']}
                      codePrefixLabel="SPK"
                      compact
                    />

                    {/* Checklist Progress Strip */}
                    <div className="space-y-1.5 pt-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                          <span>Progress Checklist</span>
                          {isCustom && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold">
                              Custom
                            </span>
                          )}
                        </span>
                        <span className="font-mono font-bold text-slate-900 tabular-nums">
                          {totalRequired > 0 ? `${completedCount}/${totalRequired} (${percent}%)` : 'Tanpa Checklist'}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            percent === 100
                              ? 'bg-emerald-600'
                              : percent >= 50
                              ? 'bg-blue-600'
                              : 'bg-slate-900'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className={milestoneStatus.isOverdue ? 'text-rose-700 font-bold' : 'text-slate-500'}>
                          Target: {p['Target Design'] || '-'}
                        </span>
                        <span className="text-slate-500">Qty: {p['Qty Drawing'] || 0} pcs</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Actions */}
                  <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setSelectedSpkProjectSpk(p.SPK)}
                      className="col-span-2 min-h-[42px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                    >
                      <ListChecks className="w-3.5 h-3.5 shrink-0" />
                      <span>Buka Progress</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadSpkSticker(p)}
                      title="Unduh Stiker PNG SPK"
                      className="min-h-[42px] px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>PNG</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopySpkLink(p)}
                      title="Salin Link Progress SPK"
                      className="min-h-[42px] px-2 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center justify-center gap-1 transition"
                    >
                      {copiedKey === `spk:${spkId}` ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0" />
                      )}
                      <span>Link</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* CUSTOMER COMPLETE RECORD DOSSIER MODAL / BOTTOM SHEET */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-5xl border border-slate-200 flex flex-col max-h-[94dvh] overflow-hidden pb-safe">
            {/* Dossier Top Header */}
            <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/70">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-mono">
                  <span>{selectedCustomer.barcodeId}</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedCustomer.totalProjects} SPK</span>
                  <span aria-hidden="true">·</span>
                  <span>{selectedCustomer.totalQtyDrawing} Qty Drawing</span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 truncate">
                  {selectedCustomer.customerName}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCustomerKey(null)}
                aria-label="Tutup dossier kastamer"
                className="min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 flex items-center justify-center shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sub-Navigation Tabs inside Dossier */}
            <div className="px-4 sm:px-6 py-2.5 border-b border-slate-200 flex overflow-x-auto no-scrollbar items-center gap-1.5 bg-white shrink-0">
              <button
                type="button"
                onClick={() => setDossierTab('projects')}
                className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  dossierTab === 'projects'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span>
                  Proyek & Drawing (
                  {dossierSearch.trim()
                    ? `${filteredDossier.projects.length}/${selectedCustomer.projects.length}`
                    : selectedCustomer.projects.length}
                  )
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDossierTab('standartPart')}
                className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  dossierTab === 'standartPart'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  Standart Part (
                  {dossierSearch.trim()
                    ? `${filteredDossier.standartParts.length}/${selectedCustomer.standartParts.length}`
                    : selectedCustomer.standartParts.length}
                  )
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDossierTab('kpiCostError')}
                className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  dossierTab === 'kpiCostError'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5" />
                <span>
                  KPI, Cost & Error (
                  {dossierSearch.trim()
                    ? `${filteredDossier.feedbacks.length + filteredDossier.reviewCosts.length + filteredDossier.reviewErrors.length}/${
                        selectedCustomer.feedbacks.length +
                        selectedCustomer.reviewCosts.length +
                        selectedCustomer.reviewErrors.length
                      }`
                    : selectedCustomer.feedbacks.length +
                      selectedCustomer.reviewCosts.length +
                      selectedCustomer.reviewErrors.length}
                  )
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDossierTab('label')}
                className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-[34px] px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  dossierTab === 'label'
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Kartu Barcode & Cetak</span>
              </button>
            </div>

            {/* Pinned Search & SPK Sort Bar Inside Opened Customer Record */}
            {dossierTab !== 'label' && (
              <div className="px-4 sm:px-6 py-2.5 border-b border-slate-200 bg-slate-50/90 flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={dossierSearch}
                    onChange={(e) => setDossierSearch(e.target.value)}
                    placeholder="Cari dalam rekaman: SPK, No PO, nama project, PIC, part, status, bulan, feedback, error..."
                    className="w-full min-h-[40px] sm:min-h-[36px] pl-9 pr-9 py-1.5 bg-white border border-slate-300 rounded-xl text-base sm:text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                  {dossierSearch && (
                    <button
                      type="button"
                      onClick={() => setDossierSearch('')}
                      aria-label="Hapus pencarian rekaman"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 min-w-[30px] min-h-[30px] rounded-lg text-slate-400 hover:text-slate-700 flex items-center justify-center"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setDossierSpkSort((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
                    title={
                      dossierSpkSort === 'asc'
                        ? 'Sedang urut SPK menaik (kecil ke besar). Klik untuk membalik.'
                        : 'Sedang urut SPK menurun (besar ke kecil). Klik untuk membalik.'
                    }
                    className="min-h-[40px] sm:min-h-[36px] px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800 flex items-center gap-1.5 transition"
                  >
                    {dossierSpkSort === 'asc' ? (
                      <ArrowUp className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    ) : (
                      <ArrowDown className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    )}
                    <span>{dossierSpkSort === 'asc' ? 'Urut SPK: A→Z' : 'Urut SPK: Z→A'}</span>
                  </button>

                  {dossierSearch.trim() && (
                    <div className="flex items-center gap-2 text-[11px] text-slate-600">
                      <span className="font-semibold">
                        Ditemukan:{' '}
                        <strong className="text-slate-900 tabular-nums">
                          {filteredDossier.projects.length +
                            filteredDossier.standartParts.length +
                            filteredDossier.feedbacks.length +
                            filteredDossier.reviewCosts.length +
                            filteredDossier.reviewErrors.length}
                        </strong>{' '}
                        item
                      </span>
                      <button
                        type="button"
                        onClick={() => setDossierSearch('')}
                        className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold transition"
                      >
                        Reset
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
              {/* Top Barcode Banner Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                <div className="lg:col-span-7">
                  <CustomerBarcodeGraphic
                    barcodeId={selectedCustomer.barcodeId}
                    qrValue={
                      qrMode === 'url'
                        ? buildCustomerBarcodeUrl(selectedCustomer.customerName, selectedCustomer.barcodeId)
                        : buildCustomerOfflinePayload(selectedCustomer)
                    }
                    customerName={selectedCustomer.customerName}
                  />
                </div>

                <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between gap-3">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Status Proyek</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
                        {selectedCustomer.doneProjects} Selesai · {selectedCustomer.inProgressProjects} Proses · {selectedCustomer.revisiProjects} Revisi
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">PIC Engineering</span>
                      <span className="font-semibold text-slate-900 truncate block">
                        {selectedCustomer.pics.join(', ') || '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Total Anggaran / Cost</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
                        Rp {selectedCustomer.totalPengeluaran.toLocaleString('id-ID')} / Rp {selectedCustomer.totalAnggaran.toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Design Quality & Error</span>
                      <span className="font-bold text-slate-900 font-mono tabular-nums">
                        {selectedCustomer.approvedFeedbackCount} Approve · {selectedCustomer.totalErrorCases} Error
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(selectedCustomer)}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1 transition"
                    >
                      {copiedKey === selectedCustomer.key ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      <span>Salin Link</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadSticker(selectedCustomer)}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1 transition"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Stiker PNG</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportCustomerDossierPDF(selectedCustomer)}
                      className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1 transition"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak PDF</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* TAB 1: PROJECTS & 14 CHECKLIST ITEMS */}
              {dossierTab === 'projects' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Daftar SPK, Drawing & Checklist Engineering ({filteredDossier.projects.length}
                    {dossierSearch.trim() ? ` dari ${selectedCustomer.projects.length}` : ''})
                  </h4>

                  {filteredDossier.projects.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 space-y-2">
                      <p>
                        {dossierSearch.trim()
                          ? `Tidak ada SPK atau proyek yang cocok dengan "${dossierSearch}".`
                          : 'Belum ada proyek monitoring drawing yang tercatat untuk kastamer ini.'}
                      </p>
                      {dossierSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => setDossierSearch('')}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                        >
                          Reset Pencarian
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredDossier.projects.map((p) => {
                        const {
                          requiredKeys,
                          completedCount,
                          totalRequired,
                          percent: pct,
                          isCustom
                        } = getProjectChecklistProgress(p);
                        const isExpanded = expandedProjectSpk === p.SPK;

                        return (
                          <div key={p.SPK} className="border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-3 bg-white">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                              <div>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-mono">
                                  <span className="font-bold text-slate-800">{p.SPK}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>PO: {p['Nomor PO'] || '-'}</span>
                                  <span aria-hidden="true">·</span>
                                  <span>{p.Bulan}</span>
                                </div>
                                <h5 className="text-sm font-bold text-slate-900 mt-0.5">{p['Nama Project']}</h5>
                              </div>

                              <span
                                className={`self-start px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 ${
                                  p.Status === 'Selesai'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : p.Status === 'Revisi'
                                    ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}
                              >
                                {p.Status}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              <div>
                                <span className="text-[11px] text-slate-500 block">PIC Engineer</span>
                                <span className="font-semibold text-slate-800">{p.PIC || '-'}</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-500 block">Qty Drawing</span>
                                <span className="font-semibold font-mono text-slate-800 tabular-nums">{p['Qty Drawing'] || 0} pcs</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-500 block">Target Design</span>
                                <span className="font-mono text-slate-800">{p['Target Design'] || '-'}</span>
                              </div>
                              <div>
                                <span className="text-[11px] text-slate-500 block">Aktual Selesai</span>
                                <span className="font-mono text-slate-800">
                                  {p['Tanggal Penyelesaian'] || p['Aktual Engineering'] || '-'}
                                </span>
                              </div>
                            </div>

                            {/* Checklist Progress Bar */}
                            <div className="space-y-1">
                              <div className="flex justify-between items-center text-[11px]">
                                <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                                  <span>
                                    {isCustom
                                      ? `Progres Checklist Wajib (${totalRequired} Item)`
                                      : 'Progres 14 Item Checklist Engineering'}
                                  </span>
                                  {isCustom && (
                                    <span className="px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] font-bold">
                                      Custom Manager
                                    </span>
                                  )}
                                </span>
                                <span className="font-mono font-bold text-slate-900 tabular-nums">
                                  {totalRequired > 0
                                    ? `${completedCount}/${totalRequired} (${pct}%)`
                                    : 'Tanpa Checklist'}
                                </span>
                              </div>
                              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-slate-900 rounded-full transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                              <button
                                type="button"
                                onClick={() => setExpandedProjectSpk(isExpanded ? null : p.SPK)}
                                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                <span>
                                  {isExpanded
                                    ? 'Tutup Checklist'
                                    : isCustom
                                    ? `Lihat Checklist (${totalRequired} Wajib)`
                                    : 'Lihat 14 Checklist'}
                                </span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setSelectedSpkProjectSpk(p.SPK)}
                                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>Barcode SPK</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => onOpenCadViewer(p.SPK, p['Nama Project'], p.Customer)}
                                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                              >
                                <Box className="w-3.5 h-3.5" />
                                <span>3D CAD Viewer</span>
                              </button>

                              {p['File CAD Drive'] && (
                                <a
                                  href={p['File CAD Drive']}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Drive CAD</span>
                                </a>
                              )}

                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => onEditProject(p)}
                                  className="min-h-[40px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition ml-auto"
                                >
                                  <PenSquare className="w-3.5 h-3.5" />
                                  <span>Edit Proyek</span>
                                </button>
                              )}
                            </div>

                            {/* Expanded Checklist Grid */}
                            {isExpanded && (
                              <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                {CHECKLIST_KEYS.map((key) => {
                                  const isRequired = requiredKeys.includes(key);
                                  const dateVal = p[key];
                                  const done = isRequired && Boolean(dateVal && String(dateVal).trim() !== '');
                                  return (
                                    <div
                                      key={key}
                                      className={`px-3 py-2 rounded-lg border text-xs flex items-center justify-between gap-2 ${
                                        !isRequired
                                          ? 'bg-slate-100/70 border-slate-200 text-slate-400'
                                          : done
                                          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                          : 'bg-slate-50 border-slate-200 text-slate-500'
                                      }`}
                                    >
                                      <span className={`font-medium truncate ${!isRequired ? 'line-through' : ''}`}>
                                        {key}
                                      </span>
                                      <span className="font-mono text-[11px] shrink-0">
                                        {!isRequired ? 'N/A' : done ? String(dateVal) : 'Belum'}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: STANDART PART HANDOVERS */}
              {dossierTab === 'standartPart' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                    Riwayat Serah Terima Standart Part ({filteredDossier.standartParts.length}
                    {dossierSearch.trim() ? ` dari ${selectedCustomer.standartParts.length}` : ''})
                  </h4>

                  {filteredDossier.standartParts.length === 0 ? (
                    <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500 space-y-2">
                      <p>
                        {dossierSearch.trim()
                          ? `Tidak ada serah terima standart part yang cocok dengan "${dossierSearch}".`
                          : 'Belum ada catatan serah terima standart part untuk kastamer ini.'}
                      </p>
                      {dossierSearch.trim() && (
                        <button
                          type="button"
                          onClick={() => setDossierSearch('')}
                          className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold"
                        >
                          Reset Pencarian
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredDossier.standartParts.map((sp) => (
                        <div key={sp.id} className="border border-slate-200 rounded-xl p-3.5 sm:p-4 space-y-2.5 bg-white">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span>Bulan {sp.month || '-'}</span>
                                <span aria-hidden="true">·</span>
                                <span>{sp.division || 'Divisi Workshop'}</span>
                              </div>
                              <h5 className="text-sm font-bold text-slate-900 mt-0.5">{sp.projectName}</h5>
                            </div>
                            <span className="font-mono text-xs font-semibold text-slate-700">
                              {sp.distributionDate ? `${sp.distributionDate} ${sp.distributionTime || ''}` : 'Belum dikirim'}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[11px] text-slate-500 block">Prepare Staff</span>
                              <span className="font-medium text-slate-800">{sp.prepareStaff?.join(', ') || '-'}</span>
                            </div>
                            <div>
                              <span className="text-[11px] text-slate-500 block">Penerima / TTD</span>
                              <span className="font-medium text-slate-800">{sp.signature || '-'}</span>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100">
                            <span className="text-[11px] text-slate-500 block mb-1">Daftar Part Diserahterimakan:</span>
                            {sp.partNames && sp.partNames.length > 0 ? (
                              <ul className="space-y-1 text-xs text-slate-800">
                                {sp.partNames.map((pn, idx) => (
                                  <li key={idx} className="flex items-center gap-2">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>{pn}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-xs italic text-slate-400">Belum ada rincian nama part</span>
                            )}

                            {sp.partAttachments && sp.partAttachments.length > 0 && (
                              <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                                <span className="text-[11px] text-slate-500 block">
                                  Lampiran Foto / PDF Part ({sp.partAttachments.length}):
                                </span>
                                <div className="flex flex-wrap gap-2">
                                  {sp.partAttachments.map((att) => (
                                    <button
                                      key={att.id}
                                      type="button"
                                      onClick={() => setPreviewPartAttachment(att)}
                                      className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left transition"
                                    >
                                      {att.fileType === 'image' ? (
                                        <img
                                          src={att.dataUrl}
                                          alt={att.fileName}
                                          className="w-7 h-7 rounded object-cover border border-slate-200 shrink-0"
                                        />
                                      ) : (
                                        <FileText className="w-4 h-4 text-rose-600 shrink-0" />
                                      )}
                                      <div className="min-w-0">
                                        <span className="block text-[11px] font-semibold text-slate-800 truncate max-w-[160px]">
                                          {att.fileName}
                                        </span>
                                        <span className="block text-[10px] text-slate-500">
                                          {att.fileType === 'pdf' ? 'PDF' : 'Foto'} · {formatFileSize(att.sizeBytes)}
                                          {att.partLabel ? ` · ${att.partLabel}` : ''}
                                        </span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: KPI FEEDBACK, COST EFFICIENCY & ERROR RATE */}
              {dossierTab === 'kpiCostError' && (
                <div className="space-y-5">
                  {/* Design Quality Feedback */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      1. Feedback Design Quality ({filteredDossier.feedbacks.length}
                      {dossierSearch.trim() ? ` dari ${selectedCustomer.feedbacks.length}` : ''})
                    </h4>
                    {filteredDossier.feedbacks.length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {dossierSearch.trim()
                          ? `Tidak ada catatan feedback yang cocok dengan "${dossierSearch}".`
                          : 'Belum ada catatan feedback desain untuk kastamer ini.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredDossier.feedbacks.map((fb, idx) => {
                          const isClean = fb.isNoRevision || (!fb.fbProduksi?.trim() && !fb.fbKastamer?.trim());
                          return (
                            <div key={idx} className="p-3 border border-slate-200 rounded-xl text-xs space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-bold text-slate-900">
                                  {fb.projectName} · <span className="font-normal text-slate-500">{fb.month}</span>
                                </span>
                                <span className={`font-bold ${isClean ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {isClean ? 'Approve' : 'Ada Feedback'}
                                </span>
                              </div>
                              <p className="text-slate-600">Produksi: {fb.fbProduksi || '-'}</p>
                              <p className="text-slate-600">Kastamer: {fb.fbKastamer || '-'}</p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Cost Efficiency */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      2. Anggaran & Pengeluaran Cost Engineering ({filteredDossier.reviewCosts.length}
                      {dossierSearch.trim() ? ` dari ${selectedCustomer.reviewCosts.length}` : ''})
                    </h4>
                    {filteredDossier.reviewCosts.length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {dossierSearch.trim()
                          ? `Tidak ada catatan anggaran/cost yang cocok dengan "${dossierSearch}".`
                          : 'Belum ada catatan anggaran atau pengeluaran biaya engineering untuk kastamer ini.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredDossier.reviewCosts.map((rc, idx) => {
                          const totalExp = rc.pengeluaran.reduce((s, x) => s + x.amount, 0);
                          const ratio = rc.anggaran > 0 ? ((totalExp / rc.anggaran) * 100).toFixed(1) : '-';
                          return (
                            <div key={idx} className="p-3 border border-slate-200 rounded-xl text-xs space-y-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="font-bold text-slate-900">
                                  {rc.projectName} · <span className="font-normal text-slate-500">{rc.month}</span>
                                </span>
                                <span className="font-mono font-bold text-slate-800 tabular-nums">
                                  Efisiensi: {ratio}{ratio !== '-' ? '%' : ''}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-slate-700 tabular-nums">
                                <span>Anggaran: Rp {rc.anggaran.toLocaleString('id-ID')}</span>
                                <span>Pengeluaran: Rp {totalExp.toLocaleString('id-ID')}</span>
                              </div>
                              {rc.pengeluaran.length > 0 && (
                                <ul className="pt-1.5 border-t border-slate-100 space-y-1">
                                  {rc.pengeluaran.map((item) => (
                                    <li key={item.id} className="flex justify-between text-slate-600">
                                      <span>{item.desc}</span>
                                      <span className="font-mono tabular-nums">Rp {item.amount.toLocaleString('id-ID')}</span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Design Error Rate */}
                  <div className="space-y-2.5">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      3. Rekam Jejak Error & Revisi Drawing ({filteredDossier.reviewErrors.reduce((s, r) => s + r.errors.length, 0)} Kasus
                      {dossierSearch.trim() ? ` dari ${selectedCustomer.totalErrorCases}` : ''})
                    </h4>
                    {filteredDossier.reviewErrors.length === 0 ? (
                      <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {dossierSearch.trim()
                          ? `Tidak ada catatan error drawing yang cocok dengan "${dossierSearch}".`
                          : 'Zero Error — Belum ada kasus error drawing tercatat untuk kastamer ini.'}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {filteredDossier.reviewErrors.map((re, idx) => (
                          <div key={idx} className="p-3 border border-slate-200 rounded-xl text-xs space-y-1.5">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-900">
                                {re.projectName} · <span className="font-normal text-slate-500">{re.month}</span>
                              </span>
                              <span className="font-mono font-bold text-rose-700 tabular-nums">
                                {re.errors.length} kasus
                              </span>
                            </div>
                            {re.errors.map((err, eIdx) => (
                              <div key={err.id || eIdx} className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="font-semibold text-slate-800">{eIdx + 1}. {err.partName}</span>
                                <p className="text-slate-600 mt-0.5">{err.feedback}</p>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 4: PRINTABLE LABEL & QR LINK PREVIEW */}
              {dossierTab === 'label' && (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Pratinjau Label Stiker Map Drawing & Box Pengiriman
                    </h4>
                    <p className="text-xs text-slate-500">
                      Tempelkan stiker barcode ini pada map gambar fisik, folder proyek, atau rak standart part milik{' '}
                      <strong className="text-slate-800">{selectedCustomer.customerName}</strong>.
                    </p>
                    <CustomerBarcodeGraphic
                      barcodeId={selectedCustomer.barcodeId}
                      qrValue={buildCustomerBarcodeUrl(selectedCustomer.customerName, selectedCustomer.barcodeId)}
                      customerName={selectedCustomer.customerName}
                    />
                    <div className="text-xs space-y-1 pt-2 border-t border-slate-200">
                      <span className="font-semibold text-slate-600 block">URL Deep-Link Barcode:</span>
                      <code className="block p-2 bg-white border border-slate-200 rounded-lg font-mono text-[11px] text-slate-700 break-all">
                        {buildCustomerBarcodeUrl(selectedCustomer.customerName, selectedCustomer.barcodeId)}
                      </code>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SPK PROGRESS & INTERACTIVE CHECKLIST BARCODE MODAL */}
      {selectedSpkProject && (() => {
        const spkId = getSpkBarcodeId(selectedSpkProject);
        const {
          requiredKeys,
          completedCount,
          totalRequired,
          percent,
          isCustom
        } = getProjectChecklistProgress(selectedSpkProject);
        const spkQrVal =
          qrMode === 'url' ? buildSpkBarcodeUrl(spkId) : buildSpkOfflinePayload(selectedSpkProject);
        const canEditChecklist = !isReadOnly && Boolean(onChecklistToggle);

        return (
          <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
            <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 flex flex-col max-h-[94dvh] overflow-hidden pb-safe">
              {/* Header */}
              <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-start justify-between gap-3 bg-slate-50/70">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500 font-mono">
                    <span className="font-bold text-slate-900">{spkId}</span>
                    <span aria-hidden="true">·</span>
                    <span>PO: {selectedSpkProject['Nomor PO'] || '-'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{selectedSpkProject.Bulan}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`px-2 py-0.5 rounded font-sans font-bold text-[10px] ${
                        selectedSpkProject.Status === 'Selesai'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : selectedSpkProject.Status === 'Revisi'
                          ? 'bg-rose-50 text-rose-700 border border-rose-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {selectedSpkProject.Status}
                    </span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 mt-0.5 truncate">
                    {selectedSpkProject['Nama Project']}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5 truncate">
                    Kastamer: <strong className="text-slate-900">{selectedSpkProject.Customer}</strong>
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSpkProjectSpk(null)}
                  aria-label="Tutup progress SPK"
                  className="min-w-[40px] min-h-[40px] rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 flex items-center justify-center shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* Barcode & Info Strip */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                  <div className="lg:col-span-7">
                    <CustomerBarcodeGraphic
                      barcodeId={spkId}
                      qrValue={spkQrVal}
                      customerName={selectedSpkProject['Nama Project']}
                      codePrefixLabel="SPK"
                    />
                  </div>

                  <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between gap-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[11px]">PIC Engineer</span>
                        <span className="font-bold text-slate-900">{selectedSpkProject.PIC || '-'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Qty Drawing</span>
                        <span className="font-bold font-mono text-slate-900 tabular-nums">
                          {selectedSpkProject['Qty Drawing'] || 0} pcs
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Target Design</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedSpkProject['Target Design'] || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Delivery Proyek</span>
                        <span className="font-mono font-semibold text-slate-900">
                          {selectedSpkProject['Delivery Time'] || '-'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleCopySpkLink(selectedSpkProject)}
                        className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-300 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1 transition"
                      >
                        {copiedKey === `spk:${spkId}` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>Salin Link</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDownloadSpkSticker(selectedSpkProject)}
                        className="min-h-[40px] px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center justify-center gap-1 transition"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Stiker PNG</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress Bar + Interactive Actions */}
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                          {isCustom
                            ? `Checklist Wajib Project (${totalRequired} Item)`
                            : '14 Item Checklist Progress Engineering'}
                        </h4>
                        {isCustom && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                            Custom Manager
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {canEditChecklist
                          ? 'Centang atau ubah tanggal checklist langsung dari hasil scan barcode ini (tersinkron real-time ke Firebase).'
                          : 'Mode Viewer (Read-Only): Login dengan PIN Staff/Manager untuk memperbarui progres checklist.'}
                      </p>
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <span className="text-lg font-bold font-mono text-slate-900 tabular-nums">
                        {totalRequired > 0 ? `${completedCount}/${totalRequired} (${percent}%)` : 'Tanpa Checklist'}
                      </span>
                    </div>
                  </div>

                  <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        percent === 100
                          ? 'bg-emerald-600'
                          : percent >= 50
                          ? 'bg-blue-600'
                          : 'bg-slate-900'
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Checklist Items */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    {CHECKLIST_KEYS.map((key) => {
                      const isRequired = requiredKeys.includes(key);
                      const dateVal = String(selectedSpkProject[key] || '').trim();
                      const isDone = isRequired && Boolean(dateVal);

                      if (!isRequired) {
                        return (
                          <div
                            key={key}
                            className="px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-2 text-xs text-slate-400"
                          >
                            <span className="font-medium line-through truncate">{key}</span>
                            <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200/70 text-slate-500 shrink-0">
                              N/A
                            </span>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={key}
                          className={`px-3 py-2.5 rounded-xl border flex items-center justify-between gap-2.5 text-xs transition ${
                            isDone
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <label
                            className={`flex items-center gap-2.5 min-w-0 flex-1 ${
                              canEditChecklist ? 'cursor-pointer' : 'cursor-default'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isDone}
                              disabled={!canEditChecklist}
                              onChange={(e) => {
                                if (onChecklistToggle) {
                                  onChecklistToggle(selectedSpkProject.SPK, key, e.target.checked);
                                }
                              }}
                              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 disabled:opacity-60 shrink-0"
                            />
                            <span className="font-semibold truncate">{key}</span>
                          </label>

                          {canEditChecklist && onChecklistDateChange ? (
                            <input
                              type="date"
                              value={dateVal}
                              onChange={(e) =>
                                onChecklistDateChange(selectedSpkProject.SPK, key, e.target.value)
                              }
                              className="px-2 py-1 rounded-lg border border-slate-300 bg-white font-mono text-[11px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 shrink-0"
                            />
                          ) : (
                            <span className="font-mono text-[11px] shrink-0">
                              {isDone ? dateVal : 'Belum'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Quick Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      onOpenCadViewer(
                        selectedSpkProject.SPK,
                        selectedSpkProject['Nama Project'],
                        selectedSpkProject.Customer
                      )
                    }
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Box className="w-3.5 h-3.5" />
                    <span>3D CAD Viewer</span>
                  </button>

                  {selectedSpkProject['File CAD Drive'] && (
                    <a
                      href={selectedSpkProject['File CAD Drive']}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Buka File Drive CAD</span>
                    </a>
                  )}

                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => {
                        onEditProject(selectedSpkProject);
                      }}
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5 transition ml-auto"
                    >
                      <PenSquare className="w-3.5 h-3.5" />
                      <span>Edit Data Proyek</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* LIVE CAMERA & MANUAL BARCODE SCANNER MODAL */}
      {isScannerOpen && (
        <div className="fixed inset-0 bg-slate-950/85 z-[170] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 p-4 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto pb-safe">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-slate-900" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">Scanner Barcode Kastamer & SPK</h3>
                  <p className="text-[11px] text-slate-500">Arahkan kamera ke QR Code atau Barcode Code-128</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(false)}
                className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative bg-slate-950 rounded-2xl overflow-hidden aspect-video flex items-center justify-center border border-slate-800">
              <video ref={videoRef} playsInline muted className="w-full h-full object-cover" />
              {!scannerError && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-48 h-32 border-2 border-emerald-400/80 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              )}
              {scannerError && (
                <div className="absolute inset-0 p-4 bg-slate-900/95 flex flex-col items-center justify-center text-center gap-2">
                  <Camera className="w-7 h-7 text-slate-400" />
                  <p className="text-xs text-slate-200">{scannerError}</p>
                </div>
              )}
            </div>

            {!scannerError && !scannerSupported && (
              <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
                Browser ini belum mendukung deteksi barcode kamera otomatis (`BarcodeDetector`). Gunakan input kode barcode di bawah atau kamera bawaan HP Anda untuk memindai QR Code.
              </p>
            )}

            {/* Manual Code Entry or USB Scanner Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const hit = resolveScannedCode(manualScanInput);
                if (hit) {
                  setIsScannerOpen(false);
                  setManualScanInput('');
                  applyScannedResolution(hit);
                } else {
                  showToast(`Kode SPK atau kastamer "${manualScanInput}" tidak ditemukan.`, 'error');
                }
              }}
              className="space-y-2.5 pt-2 border-t border-slate-100"
            >
              <label className="block text-xs font-semibold text-slate-700">
                Input Manual Nomor SPK / Kode KMI / Nama Kastamer:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualScanInput}
                  onChange={(e) => setManualScanInput(e.target.value)}
                  placeholder="Cth: SPK-2026-001 atau KMI-ASTRA-..."
                  className="flex-1 min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-base sm:text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shrink-0"
                >
                  Buka
                </button>
              </div>
            </form>

            {/* Quick Select Customer */}
            <div className="space-y-1.5">
              <span className="block text-[11px] font-semibold text-slate-500">Pilih Cepat Kastamer Terdaftar:</span>
              <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                {customerRecords.map((rec) => (
                  <button
                    key={rec.key}
                    type="button"
                    onClick={() => {
                      setIsScannerOpen(false);
                      setSelectedCustomerKey(rec.key);
                      setDossierTab('projects');
                    }}
                    className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="font-semibold text-slate-800 truncate">{rec.customerName}</span>
                    <span className="font-mono text-[11px] text-slate-500 shrink-0">{rec.barcodeId}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal for Standart Part Foto / PDF */}
      <PartAttachmentPreviewModal
        attachment={previewPartAttachment}
        onClose={() => setPreviewPartAttachment(null)}
      />
    </div>
  );
};
