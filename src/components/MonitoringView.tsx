import React, { useState, useMemo, useEffect, useRef } from 'react';
import { EngineeringProject, ChecklistKey, UserRole, SerahTerimaStandartPartItem } from '../types/engineering';
import { CHECKLIST_KEYS, MONTH_NAMES } from '../data/initialData';
import { StandartPartHandoverView } from './StandartPartHandoverView';
import { 
  FolderOpen, 
  RotateCw, 
  CheckCircle2, 
  AlertTriangle, 
  Clock3, 
  Plus, 
  Box, 
  FileDown, 
  FileSpreadsheet, 
  Search, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  CloudUpload, 
  ExternalLink, 
  PenSquare, 
  Trash2, 
  Filter,
  BarChart2,
  Calendar,
  ShieldAlert,
  FileText,
  Layers,
  LayoutGrid,
  Table2,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  QrCode,
  X,
  Bell,
  BellRing,
  BellOff
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, BarController, LineController } from 'chart.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { chartValueLabelsPlugin } from '../utils/chartPlugin';
import { AIInsightsSection } from './AIInsightsSection';
import { ThreeDChart } from './ThreeDChart';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, BarController, LineController, Title, Tooltip, Legend);

interface DeadlineAlertInfo {
  kind: 'overdue' | 'soon';
  diffDays: number;
  label: string;
  title: string;
}

const parseLocalMidnight = (dateStr?: string): Date | null => {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]) - 1;
    const day = Number(isoMatch[3]);
    const d = new Date(year, month, day);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
};

const getTargetDesignDeadlineInfo = (targetDateStr?: string, status?: string): DeadlineAlertInfo | null => {
  if (!targetDateStr || status === 'Selesai') return null;
  const target = parseLocalMidnight(targetDateStr);
  if (!target) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays);
    return {
      kind: 'overdue',
      diffDays,
      label: 'Overdue',
      title: `Target Design terlewat ${overdueDays} hari (${targetDateStr})`
    };
  }
  if (diffDays === 0) {
    return {
      kind: 'soon',
      diffDays,
      label: 'Target Hari Ini',
      title: `Target Design jatuh tempo hari ini (${targetDateStr})`
    };
  }
  if (diffDays === 1) {
    return {
      kind: 'soon',
      diffDays,
      label: 'Target Besok',
      title: `Target Design besok / H-1 (${targetDateStr})`
    };
  }
  if (diffDays <= 3) {
    return {
      kind: 'soon',
      diffDays,
      label: `H-${diffDays}`,
      title: `Target Design dalam ${diffDays} hari lagi (${targetDateStr})`
    };
  }
  return null;
};

interface MonitoringViewProps {
  projects: EngineeringProject[];
  userRole: UserRole;
  onAddClick: () => void;
  onEditClick: (project: EngineeringProject) => void;
  onDeleteClick: (spk: string) => void;
  onUploadClick: (spk: string) => void;
  onOpenCadViewer: (spk: string, projectName: string, customer: string) => void;
  onChecklistToggle: (spk: string, key: ChecklistKey, isChecked: boolean) => void;
  onChecklistDateChange: (spk: string, key: ChecklistKey, date: string) => void;
  onSyncCloud: () => void;
  standartPartList: SerahTerimaStandartPartItem[];
  onUpdateStandartPartList: (items: SerahTerimaStandartPartItem[] | ((prev: SerahTerimaStandartPartItem[]) => SerahTerimaStandartPartItem[])) => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  activeMonitoringTab?: 'drawingProjects' | 'standartPartHandover';
  onChangeMonitoringTab?: (tab: 'drawingProjects' | 'standartPartHandover') => void;
  onOpenCustomerBarcode?: (customerName: string) => void;
}

export const MonitoringView: React.FC<MonitoringViewProps> = ({
  projects,
  userRole,
  onAddClick,
  onEditClick,
  onDeleteClick,
  onUploadClick,
  onOpenCadViewer,
  onChecklistToggle,
  onChecklistDateChange,
  onSyncCloud,
  standartPartList,
  onUpdateStandartPartList,
  showToast,
  activeMonitoringTab: controlledSubTab,
  onChangeMonitoringTab,
  onOpenCustomerBarcode
}) => {
  // Sub-tab state: Monitoring Drawing SPK vs Serah Terima Standart Part
  const [internalMonitoringTab, setInternalMonitoringTab] = useState<'drawingProjects' | 'standartPartHandover'>('drawingProjects');
  const activeMonitoringTab = controlledSubTab ?? internalMonitoringTab;
  const setActiveMonitoringTab = (tab: 'drawingProjects' | 'standartPartHandover') => {
    setInternalMonitoringTab(tab);
    if (onChangeMonitoringTab) onChangeMonitoringTab(tab);
  };

  // Mobile display & filter states
  const [mobileDisplayMode, setMobileDisplayMode] = useState<'cards' | 'table'>('cards');
  const [expandedChecklistSpk, setExpandedChecklistSpk] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState<boolean>(false);

  // Filters state
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('2026');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDueSoonOnly, setFilterDueSoonOnly] = useState<boolean>(false);
  const [sortSpkAsc, setSortSpkAsc] = useState<boolean>(true);
  const [deadlineNotifEnabled, setDeadlineNotifEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('eng_deadline_notif_enabled') === 'true';
    } catch {
      return false;
    }
  });
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 10;

  // Chart Canvas Refs
  const chart1Ref = useRef<HTMLCanvasElement>(null);
  const chart2Ref = useRef<HTMLCanvasElement>(null);
  const chart3Ref = useRef<HTMLCanvasElement>(null);
  const chartInstancesRef = useRef<{ [key: string]: ChartJS | null }>({ c1: null, c2: null, c3: null });

  // 2D and 3D Chart View Modes
  const [globalChartDim, setGlobalChartDim] = useState<'2D' | '3D'>('2D');
  const [chart1Dim, setChart1Dim] = useState<'2D' | '3D'>('2D');
  const [chart2Dim, setChart2Dim] = useState<'2D' | '3D'>('2D');
  const [chart3Dim, setChart3Dim] = useState<'2D' | '3D'>('2D');

  const isReadOnly = userRole === 'Viewer';

  // Helper for Quarter / Month expansion
  const getMonthsForFilter = (val: string): string[] | null => {
    if (!val || val === 'ALL') return null;
    if (val === 'Q1') return ['Januari', 'Februari', 'Maret'];
    if (val === 'Q2') return ['April', 'Mei', 'Juni'];
    if (val === 'Q3') return ['Juli', 'Agustus', 'September'];
    if (val === 'Q4') return ['Oktober', 'November', 'Desember'];
    return [val];
  };

  // Filtered dataset for statistics & table
  const filteredProjects = useMemo(() => {
    const allowedMonths = getMonthsForFilter(filterMonth);
    return projects.filter((item) => {
      // Month
      if (allowedMonths && !allowedMonths.includes(String(item.Bulan || '').trim())) {
        return false;
      }
      // Year
      if (filterYear) {
        const dateStr = item['Delivery Time'] || item['Target Design'] || item['Permintaan Drawing/Design'] || '';
        const matchYear = (dateStr && dateStr.startsWith(filterYear)) || (item.SPK && item.SPK.includes(filterYear));
        if (!matchYear) return false;
      }
      // Status
      if (filterStatus && item.Status !== filterStatus) {
        return false;
      }
      // Unified search: SPK, Customer, Nama Project, Nomor PO, PIC, Keterangan
      const q = searchQuery.trim().toLowerCase();
      if (q) {
        const searchable = [
          item.SPK,
          item.Customer,
          item['Nama Project'],
          item['Nomor PO'],
          item.PIC,
          item.keterangan
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        const tokens = q.split(/\s+/).filter(Boolean);
        if (!tokens.every((token) => searchable.includes(token))) {
          return false;
        }
      }
      // Filter khusus deadline <= 3 hari
      if (filterDueSoonOnly) {
        const deadlineInfo = getTargetDesignDeadlineInfo(item['Target Design'], item.Status);
        if (deadlineInfo?.kind !== 'soon') {
          return false;
        }
      }
      return true;
    }).sort((a, b) => {
      const cmp = a.SPK.localeCompare(b.SPK, undefined, { numeric: true });
      return sortSpkAsc ? cmp : -cmp;
    });
  }, [projects, filterMonth, filterYear, filterStatus, searchQuery, filterDueSoonOnly, sortSpkAsc]);

  // Projects with Target Design within 3 days (0..3 days from today) and not Selesai
  const dueSoonProjects = useMemo(() => {
    return projects
      .map((project) => ({
        project,
        deadline: getTargetDesignDeadlineInfo(project['Target Design'], project.Status)
      }))
      .filter(
        (entry): entry is { project: EngineeringProject; deadline: DeadlineAlertInfo & { kind: 'soon' } } =>
          entry.deadline?.kind === 'soon'
      )
      .sort((a, b) => a.deadline.diffDays - b.deadline.diffDays);
  }, [projects]);

  const sendLocalDeadlineNotification = (
    items: Array<{ project: EngineeringProject; deadline: DeadlineAlertInfo & { kind: 'soon' } }>,
    force = false
  ) => {
    if (items.length === 0) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sig = `${todayKey}|${items.map((i) => `${i.project.SPK}:${i.deadline.diffDays}`).join(',')}`;

    try {
      if (!force && localStorage.getItem('eng_deadline_notif_last_sig') === sig) {
        return;
      }
      const preview = items
        .slice(0, 3)
        .map((i) => `${i.project.SPK} (${i.deadline.label})`)
        .join(', ');
      const extra = items.length > 3 ? ` +${items.length - 3} proyek lain` : '';
      new Notification(`Pengingat Target Design (${items.length} Proyek)`, {
        body: `Mendekati batas Target Design (≤3 hari): ${preview}${extra}`,
        tag: 'engineering-target-design-reminder'
      });
      localStorage.setItem('eng_deadline_notif_last_sig', sig);
    } catch {
      // Ignore Notification construction errors in restricted contexts
    }
  };

  useEffect(() => {
    if (!deadlineNotifEnabled || dueSoonProjects.length === 0) return;
    sendLocalDeadlineNotification(dueSoonProjects, false);
  }, [deadlineNotifEnabled, dueSoonProjects]);

  const handleToggleDeadlineNotif = async () => {
    setNotifFeedback(null);
    if (deadlineNotifEnabled) {
      setDeadlineNotifEnabled(false);
      try {
        localStorage.setItem('eng_deadline_notif_enabled', 'false');
      } catch {
        // Ignore storage error
      }
      setNotifFeedback('Notifikasi browser dimatikan. Badge pengingat tetap tampil di daftar proyek.');
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotifFeedback('Browser tidak mendukung Notification API. Gunakan badge pengingat di daftar proyek.');
      return;
    }

    try {
      if (Notification.permission === 'granted') {
        setDeadlineNotifEnabled(true);
        localStorage.setItem('eng_deadline_notif_enabled', 'true');
        if (dueSoonProjects.length > 0) {
          sendLocalDeadlineNotification(dueSoonProjects, true);
          setNotifFeedback(`Notifikasi lokal aktif (${dueSoonProjects.length} proyek Target Design ≤3 hari).`);
        } else {
          setNotifFeedback('Notifikasi lokal aktif. Anda akan diingatkan saat ada Target Design ≤3 hari.');
        }
        return;
      }

      if (Notification.permission === 'denied') {
        setNotifFeedback('Izin notifikasi diblokir oleh browser. Aktifkan izin situs atau pantau badge H-3 di tabel/kartu.');
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setDeadlineNotifEnabled(true);
        localStorage.setItem('eng_deadline_notif_enabled', 'true');
        if (dueSoonProjects.length > 0) {
          sendLocalDeadlineNotification(dueSoonProjects, true);
          setNotifFeedback(`Notifikasi lokal aktif (${dueSoonProjects.length} proyek Target Design ≤3 hari).`);
        } else {
          setNotifFeedback('Notifikasi lokal aktif untuk Target Design ≤3 hari.');
        }
      } else {
        setNotifFeedback('Izin notifikasi browser tidak diaktifkan. Badge H-3 tetap tampil di daftar proyek.');
      }
    } catch {
      setNotifFeedback('Notifikasi browser dibatasi pada tampilan iframe ini; gunakan badge H-3 di daftar proyek.');
    }
  };

  // Summary Metrics
  const stats = useMemo(() => {
    const total = filteredProjects.length;
    const onProgress = filteredProjects.filter((d) => d.Status === 'In Progress').length;
    const done = filteredProjects.filter((d) => d.Status === 'Selesai').length;
    const revisi = filteredProjects.filter((d) => d.Status === 'Revisi').length;
    const overdue = filteredProjects.filter((d) => getTargetDesignDeadlineInfo(d['Target Design'], d.Status)?.kind === 'overdue').length;

    return { total, onProgress, done, overdue, revisi };
  }, [filteredProjects]);

  // Executive summary data for Manager AI Insights
  const monitoringSummary = useMemo(() => {
    const totalQty = filteredProjects.reduce((sum, p) => sum + Number(p['Qty Drawing'] || 0), 0);
    const topCustomers = Object.entries(
      filteredProjects.reduce((acc, p) => {
        const c = p.Customer || 'Unknown';
        acc[c] = (acc[c] || 0) + Number(p['Qty Drawing'] || 0);
        return acc;
      }, {} as Record<string, number>)
    ).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      period: `${filterMonth === 'ALL' ? 'Semua Bulan (Januari - Desember)' : filterMonth} ${filterYear ? `Tahun ${filterYear}` : ''}`,
      totalProjects: stats.total,
      onProgress: stats.onProgress,
      doneProjects: stats.done,
      overdueProjects: stats.overdue,
      revisiProjects: stats.revisi,
      totalQtyDrawing: totalQty,
      topCustomersByDrawing: topCustomers.map(([cust, qty]) => `${cust}: ${qty} lembar dwg`),
      recentProjects: filteredProjects.slice(0, 6).map((p) => ({
        spk: p.SPK,
        customer: p.Customer,
        project: p['Nama Project'],
        status: p.Status,
        targetDesign: p['Target Design'],
        qty: p['Qty Drawing']
      }))
    };
  }, [filteredProjects, stats, filterMonth, filterYear]);

  // Pagination slice
  const totalPages = Math.ceil(filteredProjects.length / rowsPerPage) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredProjects.slice(start, start + rowsPerPage);
  }, [filteredProjects, currentPage]);

  // 3D Chart Data structures
  const chart1Data3D = useMemo(() => {
    const customerQtyMap: Record<string, number> = {};
    filteredProjects.forEach((d) => {
      const cust = d.Customer || 'Unknown';
      customerQtyMap[cust] = (customerQtyMap[cust] || 0) + Number(d['Qty Drawing'] || 0);
    });
    return {
      labels: Object.keys(customerQtyMap),
      series: [
        {
          name: 'Total Qty Drawing',
          color: '#2563eb',
          data: Object.values(customerQtyMap)
        }
      ]
    };
  }, [filteredProjects]);

  const chart2Data3D = useMemo(() => {
    const customerSpkMap: Record<string, number> = {};
    filteredProjects.forEach((d) => {
      const cust = d.Customer || 'Unknown';
      customerSpkMap[cust] = (customerSpkMap[cust] || 0) + 1;
    });
    return {
      labels: Object.keys(customerSpkMap),
      series: [
        {
          name: 'Jumlah SPK Project',
          color: '#059669',
          data: Object.values(customerSpkMap)
        }
      ]
    };
  }, [filteredProjects]);

  const chart3Data3D = useMemo(() => {
    const allMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const activeMonths = getMonthsForFilter(filterMonth) || allMonths;
    const monthAgg: Record<string, { customers: Set<string>; permintaan: number; qty: number }> = {};
    allMonths.forEach((m) => {
      monthAgg[m] = { customers: new Set(), permintaan: 0, qty: 0 };
    });

    filteredProjects.forEach((d) => {
      const m = String(d.Bulan || '').trim();
      if (monthAgg[m]) {
        if (d.Customer) monthAgg[m].customers.add(d.Customer);
        monthAgg[m].permintaan += 1;
        monthAgg[m].qty += Number(d['Qty Drawing'] || 0);
      }
    });

    return {
      labels: activeMonths,
      series: [
        {
          name: 'Customer Aktif',
          color: '#3b82f6',
          data: activeMonths.map((m) => monthAgg[m].customers.size)
        },
        {
          name: 'Permintaan SPK',
          color: '#10b981',
          data: activeMonths.map((m) => monthAgg[m].permintaan)
        },
        {
          name: 'Total Qty Drawing',
          color: '#8b5cf6',
          data: activeMonths.map((m) => monthAgg[m].qty)
        }
      ]
    };
  }, [filteredProjects, filterMonth]);

  // Synchronize Charts
  useEffect(() => {
    // 1. Customer vs Qty Drawing
    const customerQtyMap: Record<string, number> = {};
    filteredProjects.forEach((d) => {
      const cust = d.Customer || 'Unknown';
      customerQtyMap[cust] = (customerQtyMap[cust] || 0) + Number(d['Qty Drawing'] || 0);
    });
    const c1Labels = Object.keys(customerQtyMap);
    const c1Values = Object.values(customerQtyMap);

    // 2. Customer vs SPK Count
    const customerSpkMap: Record<string, number> = {};
    filteredProjects.forEach((d) => {
      const cust = d.Customer || 'Unknown';
      customerSpkMap[cust] = (customerSpkMap[cust] || 0) + 1;
    });
    const c2Labels = Object.keys(customerSpkMap);
    const c2Values = Object.values(customerSpkMap);

    // 3. Monthly recap
    const allMonths = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const activeMonths = getMonthsForFilter(filterMonth) || allMonths;
    const monthAgg: Record<string, { customers: Set<string>; permintaan: number; qty: number }> = {};
    allMonths.forEach((m) => {
      monthAgg[m] = { customers: new Set(), permintaan: 0, qty: 0 };
    });

    filteredProjects.forEach((d) => {
      const m = String(d.Bulan || '').trim();
      if (monthAgg[m]) {
        if (d.Customer) monthAgg[m].customers.add(d.Customer);
        monthAgg[m].permintaan += 1;
        monthAgg[m].qty += Number(d['Qty Drawing'] || 0);
      }
    });

    const c3Labels = activeMonths;
    const c3Cust = activeMonths.map((m) => monthAgg[m].customers.size);
    const c3Permintaan = activeMonths.map((m) => monthAgg[m].permintaan);
    const c3Qty = activeMonths.map((m) => monthAgg[m].qty);

    // Destroy old charts
    if (chartInstancesRef.current.c1) chartInstancesRef.current.c1.destroy();
    if (chartInstancesRef.current.c2) chartInstancesRef.current.c2.destroy();
    if (chartInstancesRef.current.c3) chartInstancesRef.current.c3.destroy();

    const paletteC1 = ['#2563eb', '#06b6d4', '#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6'];
    const paletteC2 = ['#10b981', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#14b8a6', '#6366f1'];

    // Chart 1
    if (chart1Ref.current) {
      const c1Colors = (c1Labels.length ? c1Labels : ['None']).map((_, idx) => paletteC1[idx % paletteC1.length]);
      chartInstancesRef.current.c1 = new ChartJS(chart1Ref.current, {
        type: 'bar',
        data: {
          labels: c1Labels.length ? c1Labels : ['Tidak ada data pada periode ini'],
          datasets: [{
            label: 'Qty Drawing',
            data: c1Values.length ? c1Values : [0],
            backgroundColor: c1Colors,
            borderColor: c1Colors,
            borderWidth: 1,
            borderRadius: 8
          }]
        },
        plugins: [chartValueLabelsPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 24, right: 16, left: 8, bottom: 6 } },
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grace: '15%', ticks: { precision: 0 } } }
        }
      });
    }

    // Chart 2
    if (chart2Ref.current) {
      const c2Colors = (c2Labels.length ? c2Labels : ['None']).map((_, idx) => paletteC2[idx % paletteC2.length]);
      chartInstancesRef.current.c2 = new ChartJS(chart2Ref.current, {
        type: 'bar',
        data: {
          labels: c2Labels.length ? c2Labels : ['Tidak ada data pada periode ini'],
          datasets: [{
            label: 'Jumlah SPK Marketing',
            data: c2Values.length ? c2Values : [0],
            backgroundColor: c2Colors,
            borderColor: c2Colors,
            borderWidth: 1,
            borderRadius: 8
          }]
        },
        plugins: [chartValueLabelsPlugin],
        options: {
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { top: 24, right: 16, left: 8, bottom: 6 } },
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, grace: '15%', ticks: { precision: 0 } } }
        }
      });
    }

    // Chart 3
    if (chart3Ref.current) {
      chartInstancesRef.current.c3 = new ChartJS(chart3Ref.current, {
        type: 'bar',
        data: {
          labels: c3Labels,
          datasets: [
            { label: 'Customer Unik', data: c3Cust, backgroundColor: 'rgba(139, 92, 246, 0.9)', borderRadius: 5 },
            { label: 'Permintaan Proyek', data: c3Permintaan, backgroundColor: 'rgba(16, 185, 129, 0.9)', borderRadius: 5 },
            { label: 'Total Qty Drawing', data: c3Qty, backgroundColor: 'rgba(6, 182, 212, 0.9)', borderRadius: 5 }
          ]
        },
        plugins: [chartValueLabelsPlugin],
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 35, top: 12, bottom: 6 } },
          scales: {
            x: { beginAtZero: true, grace: '15%', ticks: { precision: 0 } },
            y: { grid: { display: false } }
          }
        }
      });
    }

    return () => {
      if (chartInstancesRef.current.c1) chartInstancesRef.current.c1.destroy();
      if (chartInstancesRef.current.c2) chartInstancesRef.current.c2.destroy();
      if (chartInstancesRef.current.c3) chartInstancesRef.current.c3.destroy();
    };
  }, [filteredProjects, filterMonth, filterYear]);

  // Export to PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`LAPORAN MONITORING DESIGN & DRAWING ENGINEERING - ${filterMonth} (${filterYear})`, 14, 12);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')} | Role: ${userRole}`, 14, 18);

      const tableRows = filteredProjects.map((item, idx) => [
        idx + 1,
        item.Bulan || '',
        item.SPK || '',
        item.Customer || '',
        item['Nama Project'] || '',
        item.Status || '',
        item.PIC || '',
        item['Qty Drawing'] || 0,
        item['Target Design'] || '',
        item['Tanggal Penyelesaian'] || item['Aktual Engineering'] || '',
        item.keterangan || ''
      ]);

      autoTable(doc, {
        startY: 22,
        head: [['No', 'Bulan', 'SPK', 'Customer', 'Nama Project', 'Status', 'PIC', 'Qty', 'Target Design', 'Tgl Selesai', 'Keterangan']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7.5 },
        margin: { left: 14, right: 14 }
      });

      doc.save(`Laporan_Monitoring_Engineering_${filterYear}_${filterMonth}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(filteredProjects);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Database_Engineering');
    XLSX.writeFile(wb, `Monitoring_Engineering_${filterYear}_${filterMonth}.xlsx`);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Sub-Navigation Tabs: Monitoring Drawing vs Serah Terima Standart Part */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 bg-white/95 backdrop-blur-md p-1.5 sm:p-2 rounded-2xl shadow-sm border border-indigo-100">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setActiveMonitoringTab('drawingProjects')}
            className={`min-h-[42px] px-2.5 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start space-x-1.5 sm:space-x-2 transition-all duration-200 ${
              activeMonitoringTab === 'drawingProjects'
                ? 'theme-tab-active'
                : 'text-slate-600 hover:text-slate-900 hover:bg-indigo-50/70'
            }`}
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">Monitoring SPK</span>
            <span className={`text-[10px] px-1.5 sm:px-2 py-0.5 rounded-lg font-mono tabular-nums shrink-0 ${
              activeMonitoringTab === 'drawingProjects' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-700 font-semibold'
            }`}>
              {projects.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMonitoringTab('standartPartHandover')}
            className={`min-h-[42px] px-2.5 sm:px-4 py-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center sm:justify-start space-x-1.5 sm:space-x-2 transition-all duration-200 ${
              activeMonitoringTab === 'standartPartHandover'
                ? 'bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 text-white shadow-lg shadow-rose-500/25'
                : 'text-slate-600 hover:text-slate-900 hover:bg-rose-50/70'
            }`}
          >
            <Layers className={`w-4 h-4 shrink-0 ${activeMonitoringTab === 'standartPartHandover' ? 'text-white' : 'text-rose-600'}`} />
            <span className="truncate">Standart Part</span>
            <span className={`hidden sm:inline text-[10px] px-2 py-0.5 rounded-lg font-mono ${
              activeMonitoringTab === 'standartPartHandover' ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-700 font-semibold'
            }`}>
              KMIL/FM-ENG/01-004
            </span>
          </button>
        </div>

        <div className="hidden md:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-50 via-cyan-50 to-emerald-50 border border-indigo-100">
          <span className="font-bold bg-gradient-to-r from-indigo-700 via-blue-700 to-emerald-700 bg-clip-text text-transparent">
            Departemen Engineering Plant CDR & BTG
          </span>
        </div>
      </div>

      {/* Render Active View */}
      {activeMonitoringTab === 'standartPartHandover' ? (
        <StandartPartHandoverView
          handoverList={standartPartList}
          onUpdateHandoverList={onUpdateStandartPartList}
          projects={projects}
          userRole={userRole}
          showToast={showToast}
        />
      ) : (
        <>
          {/* 5 Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white/95 rounded-2xl shadow-sm border border-blue-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600" />
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Project</p>
              <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">{stats.total}</h3>
              <p className="text-[11px] text-blue-600 font-semibold mt-1">Tahun {filterYear || 'Semua'}</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-xl shadow-md shadow-blue-500/20">
              <FolderOpen className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl shadow-sm border border-amber-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">On Progress</p>
              <h3 className="text-2xl font-extrabold text-amber-600 mt-1 tabular-nums">{stats.onProgress}</h3>
              <p className="text-[11px] text-amber-700 font-semibold mt-1">Aktif Desain</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-amber-400 to-orange-500 text-white rounded-xl shadow-md shadow-amber-500/20">
              <RotateCw className="w-5 h-5 animate-spin-slow" />
            </div>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl shadow-sm border border-emerald-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Selesai (Done)</p>
              <h3 className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">{stats.done}</h3>
              <p className="text-[11px] text-emerald-700 font-semibold mt-1">Tuntas Rilis</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 text-white rounded-xl shadow-md shadow-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl shadow-sm border border-rose-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-pink-500 to-fuchsia-600" />
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Overdue</p>
              <h3 className="text-2xl font-extrabold text-rose-600 mt-1 tabular-nums">{stats.overdue}</h3>
              <p className="text-[11px] text-rose-700 font-semibold mt-1">Lewat Target</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-rose-500 to-pink-600 text-white rounded-xl shadow-md shadow-rose-500/20">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-white/95 rounded-2xl shadow-sm border border-violet-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all col-span-2 sm:col-span-1">
          <div className="h-1.5 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-600" />
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Revisi / Menunggu</p>
              <h3 className="text-2xl font-extrabold text-violet-600 mt-1 tabular-nums">{stats.revisi}</h3>
              <p className="text-[11px] text-violet-700 font-semibold mt-1">Feedback Loop</p>
            </div>
            <div className="p-3 bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-xl shadow-md shadow-violet-500/20">
              <Clock3 className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* AI Insight & Rekomendasi Section (Manager Exclusive) */}
      <AIInsightsSection
        userRole={userRole}
        contextType="monitoring"
        period={`${filterMonth === 'ALL' ? 'Semua Bulan (Januari - Desember)' : filterMonth} ${filterYear ? `Tahun ${filterYear}` : ''}`}
        dataSummary={monitoringSummary}
      />

      {/* Analytics & Performance Charts Accordion/Section */}
      <div className="bg-white/95 rounded-2xl shadow-sm border border-indigo-100 p-3.5 sm:p-5 space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div className="flex items-center space-x-2.5 sm:space-x-3">
            <div className="p-2 sm:p-2.5 rounded-xl bg-gradient-to-br from-blue-500 via-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/20 shrink-0">
              <BarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                Analitik & Performa Drawing Engineering
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500">
                Visualisasi real-time permintaan gambar, beban kerja per customer & kuartal
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* 2D / 3D Global Mode Switcher */}
            <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setGlobalChartDim('2D');
                  setChart1Dim('2D');
                  setChart2Dim('2D');
                  setChart3Dim('2D');
                }}
                className={`min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  globalChartDim === '2D'
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>2D Standar</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setGlobalChartDim('3D');
                  setChart1Dim('3D');
                  setChart2Dim('3D');
                  setChart3Dim('3D');
                }}
                className={`min-h-[34px] px-2.5 sm:px-3 py-1 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  globalChartDim === '3D'
                    ? 'theme-tab-active'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D WebGL</span>
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
              <select
                value={filterMonth}
                onChange={(e) => {
                  setFilterMonth(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 sm:px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-700 w-full sm:w-auto"
              >
                <option value="ALL">Semua Bulan</option>
                <optgroup label="Kuartal">
                  <option value="Q1">Q1 (Jan - Mar)</option>
                  <option value="Q2">Q2 (Apr - Jun)</option>
                  <option value="Q3">Q3 (Jul - Sep)</option>
                  <option value="Q4">Q4 (Okt - Des)</option>
                </optgroup>
                <optgroup label="Bulan">
                  <option value="Januari">Januari</option>
                  <option value="Februari">Februari</option>
                  <option value="Maret">Maret</option>
                  <option value="April">April</option>
                  <option value="Mei">Mei</option>
                  <option value="Juni">Juni</option>
                  <option value="Juli">Juli</option>
                  <option value="Agustus">Agustus</option>
                  <option value="September">September</option>
                  <option value="Oktober">Oktober</option>
                  <option value="November">November</option>
                  <option value="Desember">Desember</option>
                </optgroup>
              </select>

              <select
                value={filterYear}
                onChange={(e) => {
                  setFilterYear(e.target.value);
                  setCurrentPage(1);
                }}
                className="text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl px-2.5 sm:px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-blue-600 w-full sm:w-auto"
              >
                <option value="">Semua Tahun</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
                <option value="2028">2028</option>
                <option value="2029">2029</option>
                <option value="2030">2030</option>
              </select>
            </div>
          </div>
        </div>

        {/* 3 Modern Charts Stacked Vertically */}
        <div className="flex flex-col space-y-4 sm:space-y-6">
          {/* Chart 1: Customer vs Qty Drawing */}
          <div className="bg-slate-50/80 p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm transition-all duration-200">
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 shrink-0"></span>
                  <span>1. Grafik Customer vs Qty Drawing</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Total akumulasi lembar drawing per customer • <span className="font-semibold text-blue-600">{filterMonth === 'ALL' ? 'Semua Bulan' : filterMonth} {filterYear ? `(${filterYear})` : ''}</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="hidden sm:inline-block text-[10px] bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full border border-blue-200">
                  {filterMonth === 'ALL' ? 'Semua Periode' : filterMonth} {filterYear ? `(${filterYear})` : ''}
                </span>

                {/* Per-chart 2D / 3D pill toggle */}
                <div className="flex items-center space-x-0.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setChart1Dim('2D')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${
                      chart1Dim === '2D' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setChart1Dim('3D')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition flex items-center space-x-1 ${
                      chart1Dim === '3D' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Box className="w-2.5 h-2.5" />
                    <span>3D</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={chart1Dim === '2D' ? 'h-56 sm:h-72 w-full' : 'hidden'}>
              <canvas ref={chart1Ref} />
            </div>
            {chart1Dim === '3D' && (
              <div className="w-full animate-in fade-in duration-200">
                <ThreeDChart
                  title="Grafik Customer vs Qty Drawing (3D WebGL)"
                  labels={chart1Data3D.labels}
                  series={chart1Data3D.series}
                  unit="lembar"
                  height={360}
                />
              </div>
            )}
          </div>

          {/* Chart 2: Permintaan Drawing (Customer vs SPK) */}
          <div className="bg-slate-50/80 p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm transition-all duration-200">
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 shrink-0"></span>
                  <span>2. Grafik Permintaan Drawing (Customer vs SPK)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Jumlah nomor SPK aktif per customer • <span className="font-semibold text-emerald-600">{filterMonth === 'ALL' ? 'Semua Bulan' : filterMonth} {filterYear ? `(${filterYear})` : ''}</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="hidden sm:inline-block text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                  {filterMonth === 'ALL' ? 'Semua Periode' : filterMonth} {filterYear ? `(${filterYear})` : ''}
                </span>

                {/* Per-chart 2D / 3D pill toggle */}
                <div className="flex items-center space-x-0.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setChart2Dim('2D')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${
                      chart2Dim === '2D' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setChart2Dim('3D')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition flex items-center space-x-1 ${
                      chart2Dim === '3D' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Box className="w-2.5 h-2.5" />
                    <span>3D</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={chart2Dim === '2D' ? 'h-56 sm:h-72 w-full' : 'hidden'}>
              <canvas ref={chart2Ref} />
            </div>
            {chart2Dim === '3D' && (
              <div className="w-full animate-in fade-in duration-200">
                <ThreeDChart
                  title="Grafik Permintaan Drawing (Customer vs SPK) (3D WebGL)"
                  labels={chart2Data3D.labels}
                  series={chart2Data3D.series}
                  unit="SPK"
                  height={360}
                />
              </div>
            )}
          </div>

          {/* Chart 3: Rekap Engineering Bulanan & Kuartal */}
          <div className="bg-slate-50/80 p-3.5 sm:p-5 rounded-xl border border-slate-200 shadow-sm transition-all duration-200">
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0"></span>
                  <span>3. Grafik Rekap Engineering Bulanan & Kuartal</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Tren kuantitas drawing & project per bulan • <span className="font-semibold text-purple-600">{filterMonth === 'ALL' ? 'Jan - Des' : filterMonth} {filterYear ? `(${filterYear})` : ''}</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="hidden sm:inline-block text-[10px] bg-purple-100 text-purple-700 font-semibold px-2.5 py-1 rounded-full border border-purple-200">
                  {filterMonth === 'ALL' ? 'Jan - Des' : filterMonth} {filterYear ? `(${filterYear})` : ''}
                </span>

                {/* Per-chart 2D / 3D pill toggle */}
                <div className="flex items-center space-x-0.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setChart3Dim('2D')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition ${
                      chart3Dim === '2D' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setChart3Dim('3D')}
                    className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition flex items-center space-x-1 ${
                      chart3Dim === '3D' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Box className="w-2.5 h-2.5" />
                    <span>3D</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={chart3Dim === '2D' ? 'h-60 sm:h-80 w-full' : 'hidden'}>
              <canvas ref={chart3Ref} />
            </div>
            {chart3Dim === '3D' && (
              <div className="w-full animate-in fade-in duration-200">
                <ThreeDChart
                  title="Grafik Rekap Engineering Bulanan & Kuartal (3D WebGL Multi-Series)"
                  labels={chart3Data3D.labels}
                  series={chart3Data3D.series}
                  unit=""
                  height={380}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Viewer Read-Only Notice Banner */}
      {isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-amber-900 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-100 text-amber-700 rounded-xl shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold">Akses Role: Viewer (Mode Hanya Melihat)</p>
              <p className="text-[11px] text-amber-700">
                Anda memiliki akses penuh untuk melihat tabel monitoring, 3 grafik vertikal, 3D CAD viewer, serta ekspor PDF dan Excel. Hak akses menambah, mengedit, checklist, atau menghapus data terkunci. Untuk mengedit, pilih Nama Akun Staff Anda dan masukkan PIN pribadi pada menu header.
              </p>
            </div>
          </div>
          <span className="shrink-0 px-3 py-1 text-[11px] font-bold bg-amber-200/80 text-amber-900 rounded-xl border border-amber-300">
            Read-Only Aktif
          </span>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="bg-white/95 rounded-2xl shadow-sm border border-indigo-100 p-3 sm:p-4 space-y-3">
        {/* Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full sm:w-auto">
            {!isReadOnly && (
              <button
                onClick={onAddClick}
                className="min-h-[42px] theme-btn-primary font-bold text-xs px-3 sm:px-4 py-2 rounded-xl transition flex items-center justify-center space-x-1.5"
              >
                <Plus className="w-4 h-4 shrink-0" />
                <span className="truncate">Tambah Data</span>
              </button>
            )}

            <button
              onClick={onSyncCloud}
              className="min-h-[42px] bg-gradient-to-r from-slate-800 to-indigo-900 hover:from-slate-700 hover:to-indigo-800 text-white font-bold text-xs px-3 sm:px-4 py-2 rounded-xl shadow-md transition flex items-center justify-center space-x-1.5"
            >
              <RotateCw className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">Sinkron Cloud</span>
            </button>

            <button
              onClick={() => onOpenCadViewer('SPK-DEMO', 'Default Machine Assembly', 'Engineering General')}
              className="min-h-[42px] bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 hover:from-indigo-500 hover:via-violet-500 hover:to-purple-500 text-white font-bold text-xs px-3 sm:px-4 py-2 rounded-xl shadow-md shadow-violet-500/20 transition flex items-center justify-center space-x-1.5"
            >
              <Box className="w-4 h-4 shrink-0" />
              <span className="truncate">3D CAD Viewer</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="min-h-[42px] bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-400 hover:to-pink-500 text-white font-bold text-xs px-3 sm:px-4 py-2 rounded-xl shadow-md shadow-rose-500/20 transition flex items-center justify-center space-x-1.5"
            >
              <FileDown className="w-4 h-4 shrink-0" />
              <span className="truncate">Cetak PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="min-h-[42px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-xs px-3 sm:px-4 py-2 rounded-xl shadow-md shadow-emerald-500/20 transition flex items-center justify-center space-x-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <span className="truncate">Ekspor Excel</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMonitoringTab('standartPartHandover')}
              className="min-h-[42px] bg-gradient-to-r from-[#8B2635] via-rose-700 to-pink-600 hover:from-[#721f2b] hover:to-pink-500 text-white font-bold text-xs px-3 sm:px-3.5 py-2 rounded-xl shadow-md shadow-rose-900/20 transition flex items-center justify-center space-x-1.5"
              title="Buka Form Serah Terima Standart Part (KMIL/FM-ENG/01-004)"
            >
              <Layers className="w-4 h-4 text-amber-200 shrink-0" />
              <span className="truncate">Standart Part</span>
            </button>

            <button
              type="button"
              onClick={handleToggleDeadlineNotif}
              className={`min-h-[42px] font-bold text-xs px-3 py-2 rounded-xl border transition flex items-center justify-center space-x-1.5 ${
                deadlineNotifEnabled
                  ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                  : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
              title="Aktifkan/matikan notifikasi browser lokal untuk Target Design ≤ 3 hari"
            >
              {deadlineNotifEnabled ? (
                <BellRing className="w-4 h-4 text-amber-600 shrink-0" />
              ) : (
                <Bell className="w-4 h-4 text-slate-500 shrink-0" />
              )}
              <span className="truncate">{deadlineNotifEnabled ? 'Notif H-3 Aktif' : 'Notif H-3'}</span>
              {dueSoonProjects.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-extrabold tabular-nums">
                  {dueSoonProjects.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Quick Search & Filter/Mode Toggle */}
        <div className="flex sm:hidden items-center gap-2 pt-2 border-t border-slate-100">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari SPK, Customer, atau Nama Project..."
              className="text-base bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-9 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                aria-label="Hapus pencarian"
                className="absolute right-2.5 top-2.5 p-0.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowMobileFilters((v) => !v)}
            className={`min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 shrink-0 transition ${
              showMobileFilters || filterStatus || filterMonth !== 'ALL' || (filterYear && filterYear !== '2026')
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-slate-50 border-slate-300 text-slate-700'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filter</span>
          </button>
        </div>

        {/* Search & Filter Inputs (Always visible sm+, toggleable on mobile) */}
        <div className={`${showMobileFilters ? 'grid' : 'hidden sm:grid'} grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3 border-t border-slate-100`}>
          <div className="hidden sm:block sm:col-span-3">
            <label className="block text-[10px] font-bold text-slate-500 mb-1">
              Pencarian (SPK, Customer, Nama Project)
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cari No. SPK, nama customer, nama project, No. PO, atau PIC..."
                className="text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-8 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setCurrentPage(1);
                  }}
                  aria-label="Hapus pencarian"
                  className="absolute right-2 top-1.5 p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Tahun Proyek</label>
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setCurrentPage(1);
              }}
              className="text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-blue-600"
            >
              <option value="">Semua Tahun (2026-2030)</option>
              <option value="2026">Tahun 2026</option>
              <option value="2027">Tahun 2027</option>
              <option value="2028">Tahun 2028</option>
              <option value="2029">Tahun 2029</option>
              <option value="2030">Tahun 2030</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Status Desain</label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="">Semua Status</option>
              <option value="Selesai">Selesai</option>
              <option value="In Progress">In Progress</option>
              <option value="Revisi">Revisi</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Filter Bulan / Kuartal</label>
            <select
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setCurrentPage(1);
              }}
              className="text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              <option value="ALL">Semua Bulan</option>
              <optgroup label="Kuartal">
                <option value="Q1">Q1 (Jan - Mar)</option>
                <option value="Q2">Q2 (Apr - Jun)</option>
                <option value="Q3">Q3 (Jul - Sep)</option>
                <option value="Q4">Q4 (Okt - Des)</option>
              </optgroup>
              <optgroup label="Bulan">
                <option value="Januari">Januari</option>
                <option value="Februari">Februari</option>
                <option value="Maret">Maret</option>
                <option value="April">April</option>
                <option value="Mei">Mei</option>
                <option value="Juni">Juni</option>
                <option value="Juli">Juli</option>
                <option value="Agustus">Agustus</option>
                <option value="September">September</option>
                <option value="Oktober">Oktober</option>
                <option value="November">November</option>
                <option value="Desember">Desember</option>
              </optgroup>
            </select>
          </div>
        </div>

        {/* Subtle Target Design <= 3 Days Reminder Bar */}
        {(dueSoonProjects.length > 0 || notifFeedback) && (
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            {dueSoonProjects.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-amber-900 bg-amber-50/80 border border-amber-200/80 rounded-xl px-3 py-2 flex-1 min-w-[240px]">
                <Clock3 className="w-4 h-4 text-amber-600 shrink-0" />
                <span className="font-semibold">
                  <strong className="tabular-nums">{dueSoonProjects.length}</strong> proyek mendekati <strong>Target Design</strong> (≤3 hari):
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {dueSoonProjects.slice(0, 3).map(({ project, deadline }) => (
                    <button
                      key={project.SPK}
                      type="button"
                      onClick={() => {
                        setSearchQuery(project.SPK);
                        setFilterDueSoonOnly(false);
                        setCurrentPage(1);
                      }}
                      title={`${project['Nama Project']} • ${deadline.title}`}
                      className="px-2 py-0.5 rounded-md bg-white/90 hover:bg-white border border-amber-300/80 text-[11px] font-mono font-bold text-amber-900 transition"
                    >
                      {project.SPK} <span className="text-amber-700 font-sans">({deadline.label})</span>
                    </button>
                  ))}
                  {dueSoonProjects.length > 3 && (
                    <span className="text-[11px] font-semibold text-amber-700">
                      +{dueSoonProjects.length - 3} lainnya
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterDueSoonOnly((v) => !v);
                    setCurrentPage(1);
                  }}
                  className={`ml-auto px-2.5 py-1 rounded-lg text-[11px] font-bold border transition shrink-0 ${
                    filterDueSoonOnly
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white text-amber-800 border-amber-300 hover:bg-amber-100'
                  }`}
                >
                  {filterDueSoonOnly ? 'Tampilkan Semua' : 'Filter ≤3 Hari'}
                </button>
              </div>
            ) : (
              <div />
            )}

            {notifFeedback && (
              <div className="flex items-center gap-2 text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5">
                <BellOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{notifFeedback}</span>
                <button
                  type="button"
                  onClick={() => setNotifFeedback(null)}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="Tutup pesan notifikasi"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile View Switcher (Kartu Mobile vs Tabel Lengkap) */}
      <div className="flex md:hidden items-center justify-between gap-2 bg-white/95 rounded-2xl px-3.5 py-2.5 border border-indigo-100 shadow-xs">
        <div className="text-xs font-bold text-slate-700">
          Daftar Proyek <span className="text-blue-600 tabular-nums">({filteredProjects.length})</span>
        </div>
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMobileDisplayMode('cards')}
            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
              mobileDisplayMode === 'cards' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kartu</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileDisplayMode('table')}
            className={`min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition ${
              mobileDisplayMode === 'table' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>Tabel</span>
          </button>
        </div>
      </div>

      {/* Mobile Cards List (< md when mobileDisplayMode === 'cards') */}
      {mobileDisplayMode === 'cards' && (
        <div className="md:hidden space-y-3">
          {paginatedData.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-slate-400 italic border border-slate-200 text-xs">
              Tidak ada proyek yang sesuai dengan kriteria filter.
            </div>
          ) : (
            paginatedData.map((item, idx) => {
              const globalIdx = (currentPage - 1) * rowsPerPage + idx + 1;
              const deadlineInfo = getTargetDesignDeadlineInfo(item['Target Design'], item.Status);
              const isOverdue = deadlineInfo?.kind === 'overdue';
              const isDueSoon = deadlineInfo?.kind === 'soon';
              const actualFinishDate = item['Tanggal Penyelesaian'] || item['Aktual Engineering'];
              const isLate = Boolean(actualFinishDate && item['Target Design'] && new Date(actualFinishDate) > new Date(item['Target Design']));
              const completedChecklists = CHECKLIST_KEYS.filter((ck) => Boolean(item[ck])).length;
              const checklistPercent = Math.round((completedChecklists / CHECKLIST_KEYS.length) * 100);
              const isChecklistOpen = expandedChecklistSpk === item.SPK;
              const driveUrl = item['File CAD Drive'];
              const isPdfDoc =
                typeof driveUrl === 'string' &&
                (driveUrl.toLowerCase().includes('.pdf') ||
                  driveUrl.startsWith('data:application/pdf') ||
                  driveUrl.includes('/pdf_'));

              return (
                <div
                  key={item.SPK}
                  className={`rounded-2xl shadow-sm border overflow-hidden transition-all ${
                    isOverdue || isLate
                      ? 'bg-rose-50/60 border-rose-200'
                      : isDueSoon
                      ? 'bg-amber-50/35 border-amber-200'
                      : 'bg-white border-indigo-100'
                  }`}
                >
                  <div className="p-3.5 space-y-3">
                    {/* Card Header Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-bold tabular-nums">
                          #{globalIdx}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-mono text-[11px] font-bold">
                          {item.SPK}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-semibold">
                          {item.Bulan}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1 shrink-0">
                        {(isOverdue || isLate) && (
                          <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-bold">
                            {isOverdue ? 'Overdue' : 'Late'}
                          </span>
                        )}
                        {isDueSoon && deadlineInfo && (
                          <span
                            title={deadlineInfo.title}
                            className={`px-2 py-0.5 rounded-full border text-[10px] font-bold inline-flex items-center gap-1 ${
                              deadlineInfo.diffDays === 0
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            <Clock3 className="w-2.5 h-2.5 shrink-0" />
                            <span>{deadlineInfo.label}</span>
                          </span>
                        )}
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            item.Status === 'Selesai'
                              ? 'bg-emerald-100 text-emerald-800'
                              : item.Status === 'In Progress'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {item.Status}
                        </span>
                      </div>
                    </div>

                    {/* Project Title & Client */}
                    <div>
                      <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                        {item['Nama Project']}
                      </h4>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-slate-600">
                        <span className="font-semibold text-slate-700 inline-flex items-center gap-1">
                          <span>{item.Customer}</span>
                          {onOpenCustomerBarcode && item.Customer && (
                            <button
                              type="button"
                              onClick={() => onOpenCustomerBarcode(item.Customer)}
                              title={`Buka Barcode & Rekam Jejak ${item.Customer}`}
                              className="p-1 rounded-md text-indigo-600 hover:bg-indigo-50 inline-flex items-center"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </span>
                        <span>• PIC: <strong className="text-slate-800">{item.PIC}</strong></span>
                        <span>• Qty: <strong className="text-blue-700 tabular-nums">{item['Qty Drawing']}</strong></span>
                      </div>
                      {item['Nomor PO'] && (
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">PO: {item['Nomor PO']}</p>
                      )}
                      {item.lastModifiedBy && (
                        <p className="text-[10px] text-indigo-700 font-semibold mt-1">
                          Diubah oleh: {item.lastModifiedBy}
                          {item.lastModifiedAt ? ` • ${item.lastModifiedAt}` : ''}
                        </p>
                      )}
                    </div>

                    {/* Key Dates Strip */}
                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px]">
                      <div>
                        <span className="text-[10px] text-slate-500 block">Target Design</span>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-mono font-bold text-slate-800 tabular-nums">
                            {item['Target Design'] || '-'}
                          </span>
                          {isDueSoon && deadlineInfo && (
                            <span
                              title={deadlineInfo.title}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${
                                deadlineInfo.diffDays === 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              {deadlineInfo.label}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Delivery Time</span>
                        <span className="font-mono font-bold text-slate-800 tabular-nums">
                          {item['Delivery Time'] || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Aktual Eng.</span>
                        <span className="font-mono font-semibold text-indigo-700 tabular-nums">
                          {item['Aktual Engineering'] || '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-500 block">Penyelesaian</span>
                        <span className="font-mono font-semibold text-slate-700 tabular-nums">
                          {item['Tanggal Penyelesaian'] || '-'}
                        </span>
                      </div>
                    </div>

                    {item.keterangan && (
                      <p className="text-[11px] text-slate-600 bg-amber-50/70 border border-amber-100 rounded-xl px-3 py-2">
                        {item.keterangan}
                      </p>
                    )}

                    {/* Expandable 14 Checklist Accordion */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedChecklistSpk(isChecklistOpen ? null : item.SPK)}
                        className="w-full min-h-[44px] px-3 py-2 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2 text-xs font-bold text-slate-800 transition"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckSquare className="w-4 h-4 text-blue-600 shrink-0" />
                          <span>Checklist Progress ({completedChecklists}/{CHECKLIST_KEYS.length})</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] font-mono text-blue-700 tabular-nums">{checklistPercent}%</span>
                          {isChecklistOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                        </div>
                      </button>
                      <div className="h-1 w-full bg-slate-200">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                          style={{ width: `${checklistPercent}%` }}
                        />
                      </div>

                      {isChecklistOpen && (
                        <div className="p-2.5 bg-white divide-y divide-slate-100 space-y-1">
                          {CHECKLIST_KEYS.map((ck) => {
                            const val = item[ck] || '';
                            const isChecked = val !== '';
                            return (
                              <div key={ck} className="pt-2 first:pt-0 flex items-center justify-between gap-2 min-h-[44px]">
                                <label className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer py-1">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={isReadOnly}
                                    onChange={(e) => onChecklistToggle(item.SPK, ck, e.target.checked)}
                                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 shrink-0"
                                  />
                                  <span className={`text-xs truncate ${isChecked ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                                    {ck}
                                  </span>
                                </label>
                                <input
                                  type="date"
                                  value={val}
                                  disabled={isReadOnly}
                                  onChange={(e) => onChecklistDateChange(item.SPK, ck, e.target.value)}
                                  className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 w-32 text-center font-mono disabled:opacity-60"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Touch Action Dock */}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenCadViewer(item.SPK, item['Nama Project'], item.Customer)}
                        className="flex-1 min-h-[42px] px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <Box className="w-4 h-4" />
                        <span>3D CAD</span>
                      </button>

                      {driveUrl && (
                        <a
                          href={driveUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`flex-1 min-h-[42px] px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 ${
                            isPdfDoc
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {isPdfDoc ? <FileText className="w-4 h-4" /> : <ExternalLink className="w-4 h-4" />}
                          <span>{isPdfDoc ? 'PDF' : 'Drive'}</span>
                        </a>
                      )}

                      {!isReadOnly && (
                        <>
                          <button
                            type="button"
                            onClick={() => onUploadClick(item.SPK)}
                            className="min-h-[42px] px-3 py-2 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold flex items-center justify-center gap-1"
                            title="Upload File"
                          >
                            <CloudUpload className="w-4 h-4" />
                            <span>Upload</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => onEditClick(item)}
                            className="min-h-[42px] px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs"
                            title="Edit Data"
                          >
                            <PenSquare className="w-4 h-4" />
                            <span>Edit</span>
                          </button>

                          {userRole === 'Manager' && (
                            <button
                              type="button"
                              onClick={() => onDeleteClick(item.SPK)}
                              className="min-h-[42px] min-w-[42px] p-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white flex items-center justify-center shadow-xs"
                              title="Hapus Data"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}

          {/* Mobile Pagination */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs space-y-2.5">
            <div className="text-xs text-slate-500 text-center">
              Menampilkan <strong className="text-slate-800">{filteredProjects.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}</strong> - <strong className="text-slate-800">{Math.min(currentPage * rowsPerPage, filteredProjects.length)}</strong> dari <strong className="text-slate-800">{filteredProjects.length}</strong> proyek
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 disabled:opacity-40 transition"
              >
                Sebelumnya
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages || filteredProjects.length === 0}
                className="min-h-[44px] px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold hover:bg-slate-100 disabled:opacity-40 transition"
              >
                Berikutnya ({currentPage}/{totalPages})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Table with Frozen Sticky Columns (desktop always, mobile only when toggled to 'table') */}
      <div className={`${mobileDisplayMode === 'table' ? 'flex' : 'hidden md:flex'} bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex-col`}>
        <div className="overflow-x-auto max-h-[640px] relative scrollbar-thin">
          <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
            <thead>
              <tr className="sticky-header">
                <th className="p-3 border-b border-slate-700 sticky-col-1 text-center font-bold">No</th>
                <th className="p-3 border-b border-slate-700 sticky-col-2 text-center font-bold">Bulan</th>
                <th className="p-3 border-b border-slate-700 sticky-col-3 font-bold">
                  <div 
                    onClick={() => setSortSpkAsc(!sortSpkAsc)}
                    className="flex items-center justify-between cursor-pointer select-none group"
                    title="Klik untuk urutkan SPK Asc/Desc"
                  >
                    <span>SPK</span>
                    {sortSpkAsc ? <ArrowUp className="w-3.5 h-3.5 text-blue-400" /> : <ArrowDown className="w-3.5 h-3.5 text-blue-400" />}
                  </div>
                </th>
                <th className="p-3 border-b border-slate-700 sticky-col-4 font-bold">Nomor PO</th>
                <th className="p-3 border-b border-slate-700 sticky-col-5 font-bold">Customer</th>
                <th className="p-3 border-b border-slate-700 sticky-col-6 text-center font-bold">Status</th>
                <th className="p-3 border-b border-slate-700 sticky-col-7 text-center font-bold">Delivery Time</th>
                <th className="p-3 border-b border-slate-700 sticky-col-8 font-bold">Nama Project</th>
                <th className="p-3 border-b border-slate-700 sticky-col-9 font-bold">PIC</th>

                {/* Middle scrollable columns */}
                <th className="p-3 border-b border-slate-700 text-right">Qty Drawing</th>
                <th className="p-3 border-b border-slate-700 text-center">Permintaan Drawing/Design</th>
                <th className="p-3 border-b border-slate-700 text-center">Target Design</th>
                <th className="p-3 border-b border-slate-700 text-center">Tanggal Penyelesaian</th>
                <th className="p-3 border-b border-slate-700 text-center">Aktual Engineering</th>
                <th className="p-3 border-b border-slate-700 text-center">File CAD / PDF</th>

                {/* 14 Checklist Columns */}
                {CHECKLIST_KEYS.map((ck) => (
                  <th key={ck} className="p-3 border-b border-slate-700 text-center">
                    {ck}
                  </th>
                ))}

                <th className="p-3 border-b border-slate-700">Keterangan</th>
                <th className="p-3 border-b border-slate-700 sticky-col-action text-center font-bold">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={30} className="p-8 text-center text-slate-400 italic">
                    Tidak ada proyek yang sesuai dengan kriteria filter.
                  </td>
                </tr>
              ) : (
                paginatedData.map((item, idx) => {
                  const globalIdx = (currentPage - 1) * rowsPerPage + idx + 1;
                  const deadlineInfo = getTargetDesignDeadlineInfo(item['Target Design'], item.Status);
                  const isOverdue = deadlineInfo?.kind === 'overdue';
                  const isDueSoon = deadlineInfo?.kind === 'soon';
                  const actualFinishDate = item['Tanggal Penyelesaian'] || item['Aktual Engineering'];
                  const isLate = Boolean(actualFinishDate && item['Target Design'] && new Date(actualFinishDate) > new Date(item['Target Design']));
                  const rowBg =
                    isOverdue || isLate
                      ? 'bg-rose-50/70 hover:bg-rose-100/60'
                      : isDueSoon
                      ? 'bg-amber-50/45 hover:bg-amber-50/80'
                      : 'hover:bg-slate-50';

                  return (
                    <tr key={item.SPK} className={`${rowBg} transition-colors border-b border-slate-200`}>
                      <td className="p-3 sticky-col-1 text-center font-medium text-slate-600">{globalIdx}</td>
                      <td className="p-3 sticky-col-2 text-center font-semibold text-indigo-700">{item.Bulan}</td>
                      <td className="p-3 sticky-col-3 font-bold text-blue-600 font-mono">{item.SPK}</td>
                      <td className="p-3 sticky-col-4 font-mono text-slate-700 truncate" title={item['Nomor PO']}>{item['Nomor PO']}</td>
                      <td className="p-3 sticky-col-5 font-medium text-slate-800" title={item.Customer}>
                        <div className="flex items-center justify-between gap-1.5 max-w-[170px]">
                          <span className="truncate">{item.Customer}</span>
                          {onOpenCustomerBarcode && item.Customer && (
                            <button
                              type="button"
                              onClick={() => onOpenCustomerBarcode(item.Customer)}
                              title={`Buka Barcode & Rekam Jejak ${item.Customer}`}
                              className="p-1 rounded hover:bg-indigo-100 text-indigo-600 shrink-0 transition"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 sticky-col-6 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                          item.Status === 'Selesai'
                            ? 'bg-emerald-100 text-emerald-800'
                            : item.Status === 'In Progress'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {item.Status}
                        </span>
                      </td>
                      <td className="p-3 sticky-col-7 text-center font-mono text-slate-600">{item['Delivery Time']}</td>
                      <td className="p-3 sticky-col-8 font-semibold text-slate-800 max-w-[220px] truncate" title={item['Nama Project']}>
                        {item['Nama Project']}
                      </td>
                      <td className="p-3 sticky-col-9 text-slate-700 font-medium truncate" title={item.PIC}>
                        {item.PIC}
                      </td>
                      <td className="p-3 text-right font-bold text-slate-800">{item['Qty Drawing']}</td>
                      <td className="p-3 text-center font-mono text-slate-600">{item['Permintaan Drawing/Design'] || '-'}</td>
                      <td className="p-3 text-center font-mono font-medium text-slate-700">
                        <div className="inline-flex items-center justify-center gap-1.5">
                          <span>{item['Target Design'] || '-'}</span>
                          {isDueSoon && deadlineInfo && (
                            <span
                              title={deadlineInfo.title}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border font-sans text-[10px] font-bold ${
                                deadlineInfo.diffDays === 0
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-amber-50 text-amber-800 border-amber-200'
                              }`}
                            >
                              <Clock3 className="w-2.5 h-2.5 shrink-0" />
                              <span>{deadlineInfo.label}</span>
                            </span>
                          )}
                          {isOverdue && deadlineInfo && (
                            <span
                              title={deadlineInfo.title}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-sans text-[10px] font-bold"
                            >
                              Overdue
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center font-mono text-slate-600">{item['Tanggal Penyelesaian'] || '-'}</td>
                      <td className="p-3 text-center font-mono text-slate-600">{item['Aktual Engineering'] || '-'}</td>

                      {/* CAD & PDF Viewer Links */}
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          {!isReadOnly && (
                            <button
                              onClick={() => onUploadClick(item.SPK)}
                              className="p-1 rounded bg-sky-50 text-sky-600 hover:bg-sky-100 border border-sky-200 transition"
                              title="Upload File CAD atau Dokumen PDF Drawing"
                            >
                              <CloudUpload className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {item['File CAD Drive'] && (() => {
                            const driveUrl = item['File CAD Drive'];
                            const isPdfDoc = typeof driveUrl === 'string' && (
                              driveUrl.toLowerCase().includes('.pdf') || 
                              driveUrl.startsWith('data:application/pdf') || 
                              driveUrl.includes('/pdf_')
                            );
                            return (
                              <a
                                href={driveUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`px-1.5 py-1 rounded border transition flex items-center space-x-1 ${
                                  isPdfDoc
                                    ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border-rose-200 shadow-sm'
                                    : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border-emerald-200'
                                }`}
                                title={isPdfDoc ? `Buka File Drawing PDF (${item.SPK})` : `Buka File di Drive (${item.SPK})`}
                              >
                                {isPdfDoc ? (
                                  <>
                                    <FileText className="w-3.5 h-3.5 text-rose-600" />
                                    <span className="text-[10px] font-bold">PDF</span>
                                  </>
                                ) : (
                                  <ExternalLink className="w-3.5 h-3.5" />
                                )}
                              </a>
                            );
                          })()}
                          <button
                            onClick={() => onOpenCadViewer(item.SPK, item['Nama Project'], item.Customer)}
                            className="p-1 rounded bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition"
                            title="Buka 3D CAD .STEP Viewer"
                          >
                            <Box className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* 14 Checklist item columns */}
                      {CHECKLIST_KEYS.map((ck) => {
                        const val = item[ck] || '';
                        const isChecked = val !== '';
                        return (
                          <td key={ck} className="p-3 text-center">
                            <div className="inline-flex items-center space-x-1.5">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                disabled={isReadOnly}
                                onChange={(e) => onChecklistToggle(item.SPK, ck, e.target.checked)}
                                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                              />
                              <input
                                type="date"
                                value={val}
                                disabled={isReadOnly}
                                onChange={(e) => onChecklistDateChange(item.SPK, ck, e.target.value)}
                                className="text-[10px] bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-blue-500 focus:outline-none w-28 text-center disabled:opacity-60"
                              />
                            </div>
                          </td>
                        );
                      })}

                      <td className="p-3 max-w-xs truncate text-slate-600" title={item.keterangan}>
                        <div className="truncate">{item.keterangan || '-'}</div>
                        {item.lastModifiedBy && (
                          <div
                            className="text-[10px] text-indigo-600 font-semibold truncate mt-0.5"
                            title={`Terakhir diubah oleh ${item.lastModifiedBy} (${item.lastModifiedAt || ''})`}
                          >
                            Diubah: {item.lastModifiedBy}
                          </div>
                        )}
                      </td>

                      {/* Action column */}
                      <td className="p-3 sticky-col-action text-center space-x-1.5">
                        {!isReadOnly ? (
                          <>
                            <button
                              onClick={() => onEditClick(item)}
                              className="p-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg shadow text-xs transition"
                              title="Edit Data"
                            >
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                            {userRole === 'Manager' && (
                              <button
                                onClick={() => onDeleteClick(item.SPK)}
                                className="p-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg shadow text-xs transition"
                                title="Hapus Data (Manager Only)"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">Read-Only</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500">
            Menampilkan <strong className="text-slate-800">{filteredProjects.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}</strong> - <strong className="text-slate-800">{Math.min(currentPage * rowsPerPage, filteredProjects.length)}</strong> dari <strong className="text-slate-800">{filteredProjects.length}</strong> data proyek
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-40 transition"
            >
              Sebelumnya
            </button>
            <span className="text-xs font-semibold px-2 text-slate-700">
              Halaman {currentPage} dari {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || filteredProjects.length === 0}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100 disabled:opacity-40 transition"
            >
              Berikutnya
            </button>
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
};
