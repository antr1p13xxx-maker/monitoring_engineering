import React, { useState, useMemo, useEffect, useRef } from 'react';
import { KPIItem, EngineeringProject, ReviewCostItem, ReviewErrorItem, DesignFeedbackItem, AuditLog, UserRole, KPIApprovalRequest } from '../types/engineering';
import { MONTH_NAMES, MONTH_FULL_NAMES } from '../data/initialData';
import { 
  ArrowLeft, 
  BarChart3, 
  Table, 
  PenTool, 
  DollarSign, 
  AlertCircle, 
  BarChart, 
  History, 
  Mail, 
  FileDown, 
  CheckCircle2, 
  FileSpreadsheet, 
  FileText, 
  Plus, 
  Trash2, 
  Upload, 
  Info, 
  UserCheck, 
  Building2, 
  ShieldAlert,
  Sparkles,
  Save,
  TrendingUp,
  TrendingDown,
  Activity,
  Sliders,
  Box,
  Clock,
  Check,
  XCircle,
  ShieldCheck,
  LayoutGrid,
  Table2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, BarController, LineController } from 'chart.js';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  BarChart as RechartsBarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend as RechartsLegend,
  ReferenceLine,
  Cell
} from 'recharts';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { chartValueLabelsPlugin } from '../utils/chartPlugin';
import { AIInsightsSection } from './AIInsightsSection';
import { ThreeDChart } from './ThreeDChart';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, BarController, LineController, Title, Tooltip, Legend);

interface KPIViewProps {
  kpiList: KPIItem[];
  allYearsData: Record<string, KPIItem[]>;
  activeYear: string;
  onYearChange: (year: string) => void;
  onUpdateActual: (year: string, kpiId: number, month: string, val: number | null, keterangan: string) => void;
  onBackToMonitoring: () => void;
  userRole: UserRole;
  projects: EngineeringProject[];
  onUpdateProject?: (project: EngineeringProject) => void;
  reviewCostList: ReviewCostItem[];
  onUpdateReviewCost: (list: ReviewCostItem[]) => void;
  reviewErrorList: ReviewErrorItem[];
  onUpdateReviewError: (list: ReviewErrorItem[]) => void;
  feedbackList: DesignFeedbackItem[];
  onUpdateFeedback: (list: DesignFeedbackItem[]) => void;
  auditLogs: AuditLog[];
  approvalRequests?: KPIApprovalRequest[];
  onSubmitApprovalRequest?: (req: Omit<KPIApprovalRequest, 'id' | 'requestedBy' | 'requestedAt' | 'status'>) => void;
  onApproveRequest?: (requestId: string) => void;
  onRejectRequest?: (requestId: string, note?: string) => void;
  onClearReviewedApprovals?: () => void;
  onEditingActivityChange?: (target: string | null) => void;
}

export const KPIView: React.FC<KPIViewProps> = ({
  kpiList,
  allYearsData,
  activeYear,
  onYearChange,
  onUpdateActual,
  onBackToMonitoring,
  userRole,
  projects,
  onUpdateProject,
  reviewCostList,
  onUpdateReviewCost,
  reviewErrorList,
  onUpdateReviewError,
  feedbackList,
  onUpdateFeedback,
  auditLogs,
  approvalRequests = [],
  onSubmitApprovalRequest,
  onApproveRequest,
  onRejectRequest,
  onClearReviewedApprovals,
  onEditingActivityChange
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trends' | 'matrix' | 'monitoring' | 'designInput' | 'reviewCost' | 'reviewError' | 'quarterly' | 'approvals' | 'audit'>('dashboard');
  const [selectedChartKpi, setSelectedChartKpi] = useState<string>('all');
  const [activeGlobalMonth, setActiveGlobalMonth] = useState<string>('Okt');
  const [searchKpi, setSearchKpi] = useState<string>('');
  const [trendKpiId, setTrendKpiId] = useState<number>(1);
  const [trendChartType, setTrendChartType] = useState<'area' | 'line' | 'variance'>('area');
  const [kpiPeriodFilter, setKpiPeriodFilter] = useState<string>('ALL'); // 'ALL' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'H1' | 'H2' | month

  // Helper for KPI period filter
  const getKpiMonthsForFilter = (filter: string): readonly string[] => {
    if (filter === 'Q1') return ['Jan', 'Feb', 'Mar'];
    if (filter === 'Q2') return ['Apr', 'Mei', 'Jun'];
    if (filter === 'Q3') return ['Jul', 'Aug', 'Sep'];
    if (filter === 'Q4') return ['Okt', 'Nop', 'Des'];
    if (filter === 'H1') return ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun'];
    if (filter === 'H2') return ['Jul', 'Aug', 'Sep', 'Okt', 'Nop', 'Des'];
    if (MONTH_NAMES.includes(filter as any)) return [filter];
    return MONTH_NAMES;
  };

  // Design Input subtab states
  const [designCategory, setDesignCategory] = useState<'designQuality' | 'onTimeDesign' | 'distribusiDrawing' | 'costEfficiency' | 'designErrorRate'>('designQuality');
  const [designMonth, setDesignMonth] = useState<string>('Oktober');

  // Review Cost & Review Error month filter
  const [costMonth, setCostMonth] = useState<string>('Oktober');
  const [errorMonth, setErrorMonth] = useState<string>('Oktober');

  // Edit Actual Value Modal state
  const [editModalItem, setEditModalItem] = useState<KPIItem | null>(null);
  const [editModalMonth, setEditModalMonth] = useState<string>('Okt');
  const [editModalValue, setEditModalValue] = useState<string>('');
  const [editModalKet, setEditModalKet] = useState<string>('');

  // Edit Feedback Modal state (Category 1: Design Quality)
  const [feedbackModalProject, setFeedbackModalProject] = useState<EngineeringProject | null>(null);
  const [modalFbProduksi, setModalFbProduksi] = useState<string>('');
  const [modalFbKastamer, setModalFbKastamer] = useState<string>('');

  // Edit Date Modal state (Category 2 & 3: On-Time Design & Distribusi Drawing)
  const [dateModalProject, setDateModalProject] = useState<EngineeringProject | null>(null);
  const [dateModalMode, setDateModalMode] = useState<'onTime' | 'distribusi'>('onTime');
  const [modalTargetDate, setModalTargetDate] = useState<string>('');
  const [modalFinishDate, setModalFinishDate] = useState<string>('');
  const [modal2DDate, setModal2DDate] = useState<string>('');

  // Edit Cost Modal state (Category 4 & Review Cost)
  const [costModalProject, setCostModalProject] = useState<EngineeringProject | null>(null);
  const [modalAnggaranInput, setModalAnggaranInput] = useState<string>('');
  const [modalExpenseDescInput, setModalExpenseDescInput] = useState<string>('');
  const [modalExpenseAmountInput, setModalExpenseAmountInput] = useState<string>('');

  // Edit Error Modal state (Category 5 & Review Error)
  const [errorModalProject, setErrorModalProject] = useState<EngineeringProject | null>(null);
  const [modalPartNameInput, setModalPartNameInput] = useState<string>('');
  const [modalFeedbackErrorInput, setModalFeedbackErrorInput] = useState<string>('');
  const [modalSubmitNotice, setModalSubmitNotice] = useState<string | null>(null);

  // Approval Review UI state (avoid window.prompt / window.confirm in sandboxed iframe)
  const [rejectingRequestId, setRejectingRequestId] = useState<string | null>(null);
  const [rejectReasonInput, setRejectReasonInput] = useState<string>('');
  const [confirmClearApprovals, setConfirmClearApprovals] = useState<boolean>(false);

  useEffect(() => {
    setModalSubmitNotice(null);
  }, [costModalProject, errorModalProject]);

  useEffect(() => {
    if (!onEditingActivityChange) return;
    if (editModalItem) {
      onEditingActivityChange(
        `Edit KPI: ${editModalItem.kpi} (${editModalMonth} ${activeYear})`
      );
    } else if (feedbackModalProject) {
      onEditingActivityChange(
        `Edit Feedback Design: ${feedbackModalProject.SPK} (${feedbackModalProject['Nama Project']})`
      );
    } else if (dateModalProject) {
      onEditingActivityChange(
        `Edit ${dateModalMode === 'distribusi' ? 'Tanggal Distribusi' : 'Tanggal On-Time'}: ${dateModalProject.SPK}`
      );
    } else if (costModalProject) {
      onEditingActivityChange(
        `Edit Review Cost: ${costModalProject.SPK} (${costModalProject['Nama Project']})`
      );
    } else if (errorModalProject) {
      onEditingActivityChange(
        `Edit Review Error: ${errorModalProject.SPK} (${errorModalProject['Nama Project']})`
      );
    } else {
      onEditingActivityChange(null);
    }
  }, [
    editModalItem,
    editModalMonth,
    activeYear,
    feedbackModalProject,
    dateModalProject,
    dateModalMode,
    costModalProject,
    errorModalProject,
    onEditingActivityChange
  ]);

  useEffect(() => {
    return () => {
      onEditingActivityChange?.(null);
    };
  }, [onEditingActivityChange]);

  // Email Modal state
  const [showEmailModal, setShowEmailModal] = useState<boolean>(false);
  const [emailTo, setEmailTo] = useState<string>('gm.plant@cdr.co.id, coo.cdr@cdr.co.id');
  const [emailSubject, setEmailSubject] = useState<string>('Laporan Rekapitulasi KPI Engineering Departemen CDR');
  const [emailBody, setEmailBody] = useState<string>('Berikut dilampirkan rekapitulasi pencapaian KPI Engineering Department Plant CDR & BTG.');

  // Export Modal state
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Chart refs
  const perfChartRef = useRef<HTMLCanvasElement>(null);
  const quarterlyChartRef = useRef<HTMLCanvasElement>(null);
  const chartInstanceRef = useRef<ChartJS | null>(null);
  const qChartInstanceRef = useRef<ChartJS | null>(null);

  const [kpiPerfDim, setKpiPerfDim] = useState<'2D' | '3D'>('2D');
  const [matrixMobileMode, setMatrixMobileMode] = useState<'cards' | 'table'>('cards');
  const [expandedMatrixKpi, setExpandedMatrixKpi] = useState<number | null>(1);
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);
  const [emailSentMessage, setEmailSentMessage] = useState<string | null>(null);

  const getProjectsForMonthYear = (monthFullName: string, year: string) => {
    return projects.filter((p) => {
      const pMonth = String(p.Bulan || '').trim();
      const matchMonth =
        pMonth.toLowerCase().includes(monthFullName.toLowerCase()) ||
        monthFullName.toLowerCase().includes(pMonth.toLowerCase());
      if (!matchMonth) return false;

      const dateStr = p['Delivery Time'] || p['Target Design'] || p['Permintaan Drawing/Design'] || '';
      const spk = p.SPK || '';
      const hasYearInDate = /^\d{4}/.test(dateStr);
      const hasYearInSpk = /20\d{2}/.test(spk);
      if (hasYearInDate) return dateStr.startsWith(year);
      if (hasYearInSpk) return spk.includes(year);
      return year === '2026';
    });
  };

  const calculateRecapCategoryPercentage = (
    category: 'designQuality' | 'onTimeDesign' | 'distribusiDrawing' | 'costEfficiency' | 'designErrorRate',
    monthFullName: string,
    monthProjects: EngineeringProject[]
  ): number | null => {
    if (monthProjects.length === 0) return null;
    const totalCount = monthProjects.length;

    if (category === 'designQuality') {
      let noFeedbackCount = 0;
      monthProjects.forEach((p) => {
        const fb = feedbackList.find(
          (f) => f.customer === p.Customer && f.projectName === p['Nama Project'] && f.month === monthFullName
        );
        const hasFeedback =
          fb && ((fb.fbProduksi && fb.fbProduksi.trim() !== '') || (fb.fbKastamer && fb.fbKastamer.trim() !== ''));
        if (!hasFeedback) {
          noFeedbackCount++;
        }
      });
      return Number(((noFeedbackCount / totalCount) * 100).toFixed(1));
    }

    if (category === 'onTimeDesign') {
      let onTimeCount = 0;
      monthProjects.forEach((p) => {
        const target = p['Target Design'];
        const actual = p['Tanggal Penyelesaian'] || p['Aktual Engineering'];
        if (target && actual) {
          if (new Date(actual) <= new Date(target)) onTimeCount++;
        } else if (p.Status === 'Selesai') {
          onTimeCount++;
        }
      });
      return Number(((onTimeCount / totalCount) * 100).toFixed(1));
    }

    if (category === 'distribusiDrawing') {
      let delayCount = 0;
      monthProjects.forEach((p) => {
        const target = p['Target Design'];
        const date2D = p['2D'];
        if (target && date2D) {
          if (new Date(date2D) > new Date(target)) delayCount++;
        } else if (target && !date2D) {
          if (new Date(target) < new Date()) delayCount++;
        }
      });
      return Number(((delayCount / totalCount) * 100).toFixed(1));
    }

    if (category === 'costEfficiency') {
      let totalBudget = 0;
      let totalExp = 0;
      monthProjects.forEach((p) => {
        const item = reviewCostList.find(
          (c) => c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === monthFullName
        );
        if (item) {
          totalBudget += item.anggaran;
          totalExp += item.pengeluaran.reduce((sum, e) => sum + e.amount, 0);
        }
      });
      return totalBudget > 0 ? Number(((totalExp / totalBudget) * 100).toFixed(1)) : null;
    }

    if (category === 'designErrorRate') {
      let totalQtyDrawing = 0;
      let totalErrors = 0;
      monthProjects.forEach((p) => {
        totalQtyDrawing += Number(p['Qty Drawing'] || 0);
        const item = reviewErrorList.find(
          (e) => e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === monthFullName
        );
        if (item) {
          totalErrors += item.errors.length;
        }
      });
      return totalQtyDrawing > 0 ? Number(((totalErrors / totalQtyDrawing) * 100).toFixed(1)) : null;
    }

    return null;
  };

  // Sinkronisasi otomatis Nilai Aktual (A) KPI 1-5 dari hasil perhitungan % pada Input Rekapitulasi
  const { syncedKpiList, autoSyncedCells } = useMemo(() => {
    const categoryByKpiId: Record<
      number,
      'designQuality' | 'onTimeDesign' | 'distribusiDrawing' | 'costEfficiency' | 'designErrorRate'
    > = {
      1: 'designQuality',
      2: 'onTimeDesign',
      3: 'distribusiDrawing',
      4: 'costEfficiency',
      5: 'designErrorRate'
    };

    const autoSet = new Set<string>();
    const list = kpiList.map((item) => {
      const category = categoryByKpiId[item.id];
      if (!category) return item;

      const updatedMonths: Record<string, number | null> = { ...item.months };
      MONTH_NAMES.forEach((mShort) => {
        const fullMonth = MONTH_FULL_NAMES[mShort];
        const mProjects = getProjectsForMonthYear(fullMonth, activeYear);
        const autoScore = calculateRecapCategoryPercentage(category, fullMonth, mProjects);
        if (autoScore !== null) {
          updatedMonths[mShort] = autoScore;
          autoSet.add(`${item.id}_${mShort}`);
        }
      });

      return {
        ...item,
        months: updatedMonths
      };
    });

    return { syncedKpiList: list, autoSyncedCells: autoSet };
  }, [kpiList, projects, activeYear, feedbackList, reviewCostList, reviewErrorList]);

  const kpiPerf3DData = useMemo(() => {
    const targetMonths = getKpiMonthsForFilter(kpiPeriodFilter);
    const targetVals: number[] = [];
    const actualVals: number[] = [];

    if (selectedChartKpi === 'all') {
      targetMonths.forEach((m) => {
        let sumTarget = 0;
        let countTarget = 0;
        let sumActual = 0;
        let countActual = 0;

        syncedKpiList.forEach((item) => {
          sumTarget += Number(item.targetVal);
          countTarget++;
          const val = item.months[m];
          if (val !== null && val !== undefined && !isNaN(val)) {
            sumActual += Number(val);
            countActual++;
          }
        });

        targetVals.push(countTarget > 0 ? Number((sumTarget / countTarget).toFixed(1)) : 0);
        actualVals.push(countActual > 0 ? Number((sumActual / countActual).toFixed(1)) : 0);
      });
    } else {
      const kpiObj = syncedKpiList.find((k) => String(k.id) === selectedChartKpi);
      if (kpiObj) {
        targetMonths.forEach((m) => {
          targetVals.push(kpiObj.targetVal);
          const val = kpiObj.months[m];
          actualVals.push(val !== null && val !== undefined && !isNaN(val) ? Number(val) : 0);
        });
      }
    }

    return {
      labels: targetMonths.map((m) => MONTH_FULL_NAMES[m] || m),
      series: [
        { name: 'Target KPI', data: targetVals, color: '#64748b' },
        { name: 'Aktual Tercapai', data: actualVals, color: '#10b981' }
      ]
    };
  }, [syncedKpiList, selectedChartKpi, kpiPeriodFilter]);

  const isManager = userRole === 'Manager';
  const isSupervisor = userRole === 'Supervisor';
  const canAccessFullKpiCdr = isManager || isSupervisor;
  const canDelete = isManager;
  const isReadOnly = userRole === 'Viewer';

  const pendingApprovals = useMemo(
    () => approvalRequests.filter((r) => r.status === 'pending'),
    [approvalRequests]
  );
  const reviewedApprovals = useMemo(
    () => approvalRequests.filter((r) => r.status !== 'pending'),
    [approvalRequests]
  );
  const pendingCount = pendingApprovals.length;

  // Evaluate single KPI status
  const evaluateKPI = (item: KPIItem, val: number | null | undefined) => {
    if (val === null || val === undefined || isNaN(val)) return { achieved: false, label: 'Belum Diisi', color: 'bg-slate-100 text-slate-600' };
    switch (item.ruleType) {
      case 'gte':
        return val >= item.targetVal ? { achieved: true, label: 'Tercapai', color: 'bg-emerald-100 text-emerald-800' } : { achieved: false, label: 'Perhatian', color: 'bg-amber-100 text-amber-800' };
      case 'lte':
        return val <= item.targetVal ? { achieved: true, label: 'Tercapai', color: 'bg-emerald-100 text-emerald-800' } : { achieved: false, label: 'Perhatian', color: 'bg-rose-100 text-rose-800' };
      case 'eq_100_percent':
        return val >= 100 ? { achieved: true, label: 'Tercapai', color: 'bg-emerald-100 text-emerald-800' } : { achieved: false, label: 'Perhatian', color: 'bg-amber-100 text-amber-800' };
      case 'eq_zero_accident':
        return val === 0 ? { achieved: true, label: 'Tercapai', color: 'bg-emerald-100 text-emerald-800' } : { achieved: false, label: 'Perhatian', color: 'bg-rose-100 text-rose-800' };
      default:
        return val >= item.targetVal ? { achieved: true, label: 'Tercapai', color: 'bg-emerald-100 text-emerald-800' } : { achieved: false, label: 'Perhatian', color: 'bg-amber-100 text-amber-800' };
    }
  };

  // KPI Dashboard Stats
  const kpiStats = useMemo(() => {
    let weightedScore = 0;
    let countWithData = 0;

    syncedKpiList.forEach((item) => {
      let sum = 0;
      let count = 0;
      MONTH_NAMES.forEach((m) => {
        const val = item.months[m];
        if (val !== null && val !== undefined && !isNaN(val)) {
          sum += Number(val);
          count++;
        }
      });
      if (count > 0) {
        const avg = sum / count;
        const ev = evaluateKPI(item, avg);
        weightedScore += (ev.achieved ? 1.0 : 0.65) * item.bobot * 100;
        countWithData++;
      }
    });

    const averageScore = countWithData > 0 ? Math.round(weightedScore) : 0;
    return {
      averageScore,
      health: averageScore >= 90 ? 'Optimal & Prima' : averageScore >= 75 ? 'Dalam Pemantauan' : 'Perlu Intervensi'
    };
  }, [syncedKpiList]);

  // Main Performance Chart setup (Synchronized with kpiPeriodFilter)
  useEffect(() => {
    if (activeTab !== 'dashboard' || !perfChartRef.current) return;

    const targetMonths = getKpiMonthsForFilter(kpiPeriodFilter);
    let targetVals: number[] = [];
    let actualVals: number[] = [];

    if (selectedChartKpi === 'all') {
      targetMonths.forEach((m) => {
        let sumTarget = 0;
        let countTarget = 0;
        let sumActual = 0;
        let countActual = 0;

        syncedKpiList.forEach((item) => {
          sumTarget += Number(item.targetVal);
          countTarget++;
          const val = item.months[m];
          if (val !== null && val !== undefined && !isNaN(val)) {
            sumActual += Number(val);
            countActual++;
          }
        });

        targetVals.push(countTarget > 0 ? Number((sumTarget / countTarget).toFixed(1)) : 0);
        actualVals.push(countActual > 0 ? Number((sumActual / countActual).toFixed(1)) : 0);
      });
    } else {
      const kpiObj = syncedKpiList.find((k) => String(k.id) === selectedChartKpi);
      if (kpiObj) {
        targetMonths.forEach((m) => {
          targetVals.push(kpiObj.targetVal);
          const val = kpiObj.months[m];
          actualVals.push(val !== null && val !== undefined && !isNaN(val) ? Number(val) : 0);
        });
      }
    }

    if (chartInstanceRef.current) chartInstanceRef.current.destroy();

    chartInstanceRef.current = new ChartJS(perfChartRef.current, {
      type: 'bar',
      data: {
        labels: targetMonths.map((m) => `${MONTH_FULL_NAMES[m] || m}`),
        datasets: [
          {
            type: 'bar',
            label: 'Target KPI',
            data: targetVals,
            backgroundColor: 'rgba(99, 102, 241, 0.25)',
            borderColor: 'rgba(99, 102, 241, 0.7)',
            borderWidth: 1,
            borderRadius: 8,
            order: 2
          },
          {
            type: 'bar',
            label: 'Aktual Tercapai (Bar)',
            data: actualVals,
            backgroundColor: 'rgba(16, 185, 129, 0.88)',
            borderRadius: 8,
            order: 2
          },
          {
            type: 'line',
            label: 'Tren Aktual (Line)',
            data: actualVals,
            borderColor: '#06b6d4',
            backgroundColor: '#06b6d4',
            borderWidth: 3,
            tension: 0.35,
            order: 1
          }
        ]
      },
      plugins: [chartValueLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 25, right: 16, left: 10, bottom: 5 } },
        scales: {
          y: { beginAtZero: true, grace: '20%' }
        }
      }
    });

    return () => {
      if (chartInstanceRef.current) chartInstanceRef.current.destroy();
    };
  }, [activeTab, selectedChartKpi, kpiPeriodFilter, syncedKpiList]);

  // Quarterly Chart setup
  useEffect(() => {
    if (activeTab !== 'quarterly' || !quarterlyChartRef.current) return;

    const calcQ = (months: readonly string[]) => {
      let sum = 0;
      let count = 0;
      months.forEach((m) => {
        syncedKpiList.forEach((item) => {
          const val = item.months[m];
          if (val !== null && val !== undefined && !isNaN(val)) {
            sum += Number(val);
            count++;
          }
        });
      });
      return count > 0 ? Math.round(sum / count) : 0;
    };

    const q1 = calcQ(['Jan', 'Feb', 'Mar']);
    const q2 = calcQ(['Apr', 'Mei', 'Jun']);
    const q3 = calcQ(['Jul', 'Aug', 'Sep']);
    const q4 = calcQ(['Okt', 'Nop', 'Des']);

    if (qChartInstanceRef.current) qChartInstanceRef.current.destroy();

    qChartInstanceRef.current = new ChartJS(quarterlyChartRef.current, {
      type: 'bar',
      data: {
        labels: ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Okt-Des)'],
        datasets: [{
          label: 'Pencapaian Kuartal',
          data: [q1, q2, q3, q4],
          backgroundColor: ['#06b6d4', '#10b981', '#f59e0b', '#8b5cf6'],
          borderRadius: 10,
          isPercentage: true
        } as any]
      },
      plugins: [chartValueLabelsPlugin],
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 25, right: 16, left: 10, bottom: 5 } },
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 115 } }
      }
    });

    return () => {
      if (qChartInstanceRef.current) qChartInstanceRef.current.destroy();
    };
  }, [activeTab, syncedKpiList]);

  // Filter projects relevant to active category & month for recap
  const recapProjects = useMemo(() => {
    return getProjectsForMonthYear(designMonth, activeYear);
  }, [projects, designMonth, activeYear]);

  // Filter projects for Review Cost
  const costProjects = useMemo(() => {
    return getProjectsForMonthYear(costMonth, activeYear);
  }, [projects, costMonth, activeYear]);

  // Filter projects for Review Error
  const errorProjects = useMemo(() => {
    return getProjectsForMonthYear(errorMonth, activeYear);
  }, [projects, errorMonth, activeYear]);

  // Active KPI item for Recharts Trends analysis
  const activeTrendKpi = useMemo(() => {
    return syncedKpiList.find((k) => k.id === trendKpiId) || syncedKpiList[0] || null;
  }, [syncedKpiList, trendKpiId]);

  // Monthly data points for Recharts visualization (adapted to kpiPeriodFilter)
  const trendData = useMemo(() => {
    if (!activeTrendKpi) return [];

    let prevVal: number | null = null;
    const activeMonths = getKpiMonthsForFilter(kpiPeriodFilter);
    return activeMonths.map((m) => {
      const val = activeTrendKpi.months[m];
      const numVal = (val !== null && val !== undefined && !isNaN(val)) ? Number(val) : null;
      const targetVal = Number(activeTrendKpi.targetVal);
      const variance = numVal !== null ? Number((numVal - targetVal).toFixed(2)) : null;
      const momChange = (numVal !== null && prevVal !== null) ? Number((numVal - prevVal).toFixed(2)) : null;
      if (numVal !== null) prevVal = numVal;

      const evalResult = evaluateKPI(activeTrendKpi, numVal);

      return {
        month: m,
        monthFull: MONTH_FULL_NAMES[m],
        actual: numVal,
        target: targetVal,
        variance,
        momChange,
        achieved: evalResult.achieved,
        unit: activeTrendKpi.unit
      };
    });
  }, [activeTrendKpi, kpiPeriodFilter]);

  // KPI Executive summary data for Manager AI Insights
  const kpiSummary = useMemo(() => {
    const activeMonths = getKpiMonthsForFilter(kpiPeriodFilter);
    const kpiStatusList = syncedKpiList.map((item) => {
      const values = activeMonths.map((m) => item.months[m]).filter((v) => v !== null && v !== undefined && !isNaN(v as any)) as number[];
      const avg = values.length > 0 ? Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)) : null;
      const evalRes = evaluateKPI(item, avg);
      return {
        no: item.no,
        kpi: item.objective,
        bobot: `${(item.bobot * 100).toFixed(0)}%`,
        target: item.target,
        actualAvg: avg !== null ? `${avg} ${item.unit}` : '-',
        status: evalRes.label,
        achieved: evalRes.achieved
      };
    });

    const achievedCount = kpiStatusList.filter((k) => k.achieved).length;

    return {
      activeYear,
      period: kpiPeriodFilter === 'ALL' ? 'Setahun Penuh (Jan - Des)' : kpiPeriodFilter,
      healthStatus: kpiStats.health,
      targetAchievedCount: `${achievedCount} dari ${syncedKpiList.length} parameter KPI`,
      totalWeightScore: `${kpiStats.averageScore}%`,
      kpiDetails: kpiStatusList
    };
  }, [syncedKpiList, kpiPeriodFilter, activeYear, kpiStats]);

  // Statistical summary of monthly fluctuations
  const trendStats = useMemo(() => {
    if (!activeTrendKpi || trendData.length === 0) {
      return { min: 0, max: 0, avg: 0, spread: 0, count: 0, latestMoM: 0, minMonth: '-', maxMonth: '-' };
    }

    const validPoints = trendData.filter((d) => d.actual !== null) as Array<{ month: string; actual: number }>;
    if (validPoints.length === 0) {
      return { min: 0, max: 0, avg: 0, spread: 0, count: 0, latestMoM: 0, minMonth: '-', maxMonth: '-' };
    }

    let min = validPoints[0].actual;
    let max = validPoints[0].actual;
    let minMonth = validPoints[0].month;
    let maxMonth = validPoints[0].month;
    let sum = 0;

    validPoints.forEach((p) => {
      sum += p.actual;
      if (p.actual < min) { min = p.actual; minMonth = p.month; }
      if (p.actual > max) { max = p.actual; maxMonth = p.month; }
    });

    const avg = Number((sum / validPoints.length).toFixed(1));
    const spread = Number((max - min).toFixed(1));
    
    let latestMoM: number | null = null;
    for (let i = trendData.length - 1; i >= 0; i--) {
      if (trendData[i].momChange !== null) {
        latestMoM = trendData[i].momChange;
        break;
      }
    }

    return {
      min,
      max,
      avg,
      spread,
      count: validPoints.length,
      latestMoM: latestMoM ?? 0,
      minMonth,
      maxMonth
    };
  }, [activeTrendKpi, trendData]);

  // Calculate live formula score for Design Recap categories
  const calculatedCategoryScore = useMemo(() => {
    const score = calculateRecapCategoryPercentage(designCategory, designMonth, recapProjects);
    return score !== null ? score : 0;
  }, [designCategory, designMonth, recapProjects, feedbackList, reviewCostList, reviewErrorList]);

  // Export Matrix to PDF (Sesuai Tampilan Matriks Resmi)
  const handleExportMatrixPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageWidth = 297;
      const pageHeight = 210;
      const marginX = 8;

      const formatPdfTarget = (txt: string, compact = false) => {
        const normalized = String(txt || '')
          .replace(/≥/g, '>=')
          .replace(/≤/g, '<=');
        if (compact) {
          return normalized.replace('0 Accident', '0\nAccident');
        }
        return normalized;
      };

      const fmtActualPdf = (val: number | null | undefined, unit: string) => {
        if (val === null || val === undefined) return '-';
        return unit === '%' ? `${val}%` : String(val);
      };

      // Top Header Banner
      doc.setFillColor(4, 120, 87);
      doc.rect(marginX, 7, pageWidth - marginX * 2, 1.5, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`KPI - ENGINEERING DEPARTMENT (Matriks Resmi ${activeYear})`, marginX, 13.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(
        `PT. Kurnia Mustika Indah Lestari • Plant CDR & BTG • Dicetak: ${new Date().toLocaleDateString('id-ID')}`,
        marginX,
        17.8
      );

      // Header Right Badge (Auto-Sync Info)
      doc.setFillColor(239, 246, 255);
      doc.setDrawColor(191, 219, 254);
      doc.setLineWidth(0.25);
      doc.roundedRect(pageWidth - marginX - 58, 9.8, 58, 6.2, 1.5, 1.5, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(29, 78, 216);
      doc.text('Auto-Sync % Input Rekapitulasi (KPI 1-5)', pageWidth - marginX - 29, 13.8, {
        align: 'center'
      });

      // Track which colSpan=5 row belongs to KPI 1-5 for drawing the "Auto % Input Rekapitulasi" badge
      const autoBadgeRows = new Set<number>();
      const bodyRows: any[] = [];

      syncedKpiList.forEach((item) => {
        const targetLabel = formatPdfTarget(item.target, false);
        const targetMonthLabel = formatPdfTarget(item.target, true);

        // Row 1: Target (T)
        bodyRows.push([
          {
            content: item.no,
            rowSpan: 2,
            styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', textColor: [30, 41, 59] }
          },
          {
            content: item.objective,
            styles: { halign: 'left', valign: 'middle', fontStyle: 'bold', textColor: [15, 23, 42] }
          },
          {
            content: item.kpi,
            styles: { halign: 'left', valign: 'middle', textColor: [71, 85, 105] }
          },
          {
            content: `${Math.round(item.bobot * 100)}%`,
            styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', textColor: [51, 65, 85] }
          },
          {
            content: item.id === 7 ? 'Angka' : item.unit,
            styles: { halign: 'center', valign: 'middle', textColor: [51, 65, 85] }
          },
          {
            content: targetLabel,
            styles: { halign: 'center', valign: 'middle', fontStyle: 'bold', textColor: [15, 23, 42] }
          },
          {
            content: 'T',
            styles: {
              halign: 'center',
              valign: 'middle',
              fontStyle: 'bold',
              fillColor: [236, 253, 245],
              textColor: [6, 95, 70]
            }
          },
          ...MONTH_NAMES.map(() => ({
            content: targetMonthLabel,
            styles: { halign: 'center', valign: 'middle', textColor: [51, 65, 85], fontSize: 5.7 }
          })),
          {
            content: item.keterangan || '-',
            rowSpan: 2,
            styles: { halign: 'left', valign: 'middle', textColor: [71, 85, 105], fontSize: 6 }
          }
        ]);

        // Row 2: Actual (A)
        const actualRowIndex = bodyRows.length;
        if (item.id >= 1 && item.id <= 5) {
          autoBadgeRows.add(actualRowIndex);
        }

        bodyRows.push([
          {
            content: 'Pencapaian Aktual Departemen',
            colSpan: 5,
            styles: {
              halign: 'left',
              valign: 'middle',
              fontStyle: 'italic',
              textColor: [148, 163, 184],
              fontSize: 5.8
            }
          },
          {
            content: 'A',
            styles: {
              halign: 'center',
              valign: 'middle',
              fontStyle: 'bold',
              fillColor: [239, 246, 255],
              textColor: [30, 64, 175]
            }
          },
          ...MONTH_NAMES.map((m) => {
            const val = item.months[m];
            const isAuto = autoSyncedCells.has(`${item.id}_${m}`);
            const evalRes = evaluateKPI(item, val);
            const hasVal = val !== null && val !== undefined;
            const displayVal = fmtActualPdf(val, item.unit);

            let textColor: [number, number, number] = [148, 163, 184];
            let fillColor: [number, number, number] = [255, 255, 255];
            let fontStyle: 'normal' | 'bold' = 'normal';

            if (hasVal) {
              fontStyle = 'bold';
              if (evalRes.achieved) {
                textColor = [4, 120, 87];
                fillColor = isAuto ? [236, 253, 245] : [255, 255, 255];
              } else {
                textColor = [220, 38, 38];
                fillColor = [255, 241, 242];
              }
            }

            return {
              content: displayVal,
              styles: {
                halign: 'center',
                valign: 'middle',
                fontStyle,
                textColor,
                fillColor,
                fontSize: 6.2
              }
            };
          })
        ]);
      });

      autoTable(doc, {
        startY: 20.5,
        head: [
          [
            { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Quality Objective', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'KPI', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'Bobot', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Unit', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Target', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'T/A', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: String(activeYear), colSpan: 12, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Keterangan', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
          ],
          MONTH_NAMES.map((m) => ({
            content: m,
            styles: { halign: 'center', valign: 'middle', fillColor: [6, 95, 70] }
          }))
        ],
        body: bodyRows,
        theme: 'grid',
        styles: {
          font: 'helvetica',
          lineColor: [203, 213, 225],
          lineWidth: 0.2,
          cellPadding: { top: 1.7, right: 1.4, bottom: 1.7, left: 1.4 },
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [4, 120, 87],
          textColor: [255, 255, 255],
          fontSize: 7,
          fontStyle: 'bold',
          lineColor: [6, 78, 59],
          lineWidth: 0.2,
          cellPadding: { top: 2.0, right: 1.2, bottom: 2.0, left: 1.2 }
        },
        bodyStyles: {
          fontSize: 6.4,
          minCellHeight: 7.2
        },
        columnStyles: {
          0: { cellWidth: 7 },
          1: { cellWidth: 34 },
          2: { cellWidth: 47 },
          3: { cellWidth: 10 },
          4: { cellWidth: 10 },
          5: { cellWidth: 18 },
          6: { cellWidth: 8 },
          7: { cellWidth: 10 },
          8: { cellWidth: 10 },
          9: { cellWidth: 10 },
          10: { cellWidth: 10 },
          11: { cellWidth: 10 },
          12: { cellWidth: 10 },
          13: { cellWidth: 10 },
          14: { cellWidth: 10 },
          15: { cellWidth: 10 },
          16: { cellWidth: 10 },
          17: { cellWidth: 10 },
          18: { cellWidth: 10 },
          19: { cellWidth: 27 }
        },
        margin: { left: marginX, right: marginX, bottom: 10 },
        didDrawCell: (data) => {
          if (
            data.section === 'body' &&
            data.column.index === 1 &&
            autoBadgeRows.has(data.row.index)
          ) {
            const badgeW = 31;
            const badgeH = 4.0;
            const badgeX = data.cell.x + data.cell.width - badgeW - 1.5;
            const badgeY = data.cell.y + (data.cell.height - badgeH) / 2;

            doc.setFillColor(239, 246, 255);
            doc.setDrawColor(191, 219, 254);
            doc.setLineWidth(0.2);
            doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 0.9, 0.9, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.1);
            doc.setTextColor(29, 78, 216);
            doc.text('Auto % Input Rekapitulasi', badgeX + badgeW / 2, badgeY + 2.75, {
              align: 'center'
            });
          }
        },
        didDrawPage: () => {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(6.5);
          doc.setTextColor(100, 116, 139);
          doc.text(
            `Dokumen Matriks Resmi KPI Engineering • PT. Kurnia Mustika Indah Lestari • Tahun ${activeYear}`,
            marginX,
            pageHeight - 4.5
          );
          doc.text(
            `Engineering Manager: Andry Setyawan`,
            pageWidth - marginX,
            pageHeight - 4.5,
            { align: 'right' }
          );
        }
      });

      doc.save(`Matriks_Resmi_KPI_Engineering_${activeYear}.pdf`);
      setShowExportModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  // Export Matrix to Excel
  const handleExportMatrixExcel = () => {
    const aoa: any[][] = [
      ['No', 'Quality Objective', 'KPI', 'Bobot', 'Unit', 'Target', 'T/A', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nop', 'Des', 'Keterangan']
    ];

    syncedKpiList.forEach((item) => {
      aoa.push([
        item.no,
        item.objective,
        item.kpi,
        `${item.bobot * 100}%`,
        item.unit,
        item.target,
        'T',
        item.target, item.target, item.target, item.target, item.target, item.target, item.target, item.target, item.target, item.target, item.target, item.target,
        item.keterangan || ''
      ]);
      aoa.push([
        '', '', '', '', '', '', 'A',
        item.months.Jan, item.months.Feb, item.months.Mar, item.months.Apr, item.months.Mei, item.months.Jun,
        item.months.Jul, item.months.Aug, item.months.Sep, item.months.Okt, item.months.Nop, item.months.Des,
        ''
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `KPI_${activeYear}`);
    XLSX.writeFile(wb, `KPI_Engineering_Matrix_${activeYear}.xlsx`);
    setShowExportModal(false);
  };

  // Export Design Recap PDF
  const handleExportDesignRecapPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(`LAPORAN REKAPITULASI KPI DESIGN - ${designCategory.toUpperCase()} (${designMonth} ${activeYear})`, 14, 12);

      let head: string[][] = [];
      let body: (string | number)[][] = [];

      if (designCategory === 'designQuality') {
        head = [['No', 'Customer', 'Nama Project', 'FeedBack dr Team Produksi', 'FeedBack dr Team Kastamer', 'Approve']];
        body = recapProjects.map((p, i) => {
          const fb = feedbackList.find((f) => f.customer === p.Customer && f.projectName === p['Nama Project'] && f.month === designMonth);
          const hasFb = fb && ((fb.fbProduksi && fb.fbProduksi.trim() !== '') || (fb.fbKastamer && fb.fbKastamer.trim() !== ''));
          return [
            i + 1,
            p.Customer,
            p['Nama Project'],
            fb?.fbProduksi || '-',
            fb?.fbKastamer || '-',
            !hasFb ? 'Approve ✓' : 'Revisi'
          ];
        });
      } else if (designCategory === 'onTimeDesign') {
        head = [['No', 'Customer', 'Nama Project', 'Target Drawing/Design', 'Tanggal Penyelesaian', 'On Time', 'Delay']];
        body = recapProjects.map((p, i) => {
          const target = p['Target Design'] || '-';
          const actual = p['Tanggal Penyelesaian'] || p['Aktual Engineering'] || '-';
          const isOnTime = (actual !== '-' && target !== '-' && new Date(actual) <= new Date(target)) || (actual === '-' && p.Status === 'Selesai');
          const isDelay = (actual !== '-' && target !== '-' && new Date(actual) > new Date(target)) || (actual === '-' && target !== '-' && new Date(target) < new Date());
          return [
            i + 1,
            p.Customer,
            p['Nama Project'],
            target,
            actual,
            isOnTime ? 'On Time' : '-',
            isDelay ? 'Delay' : '-'
          ];
        });
      } else if (designCategory === 'distribusiDrawing') {
        head = [['No', 'Customer', 'Nama Project', 'Target Drawing/Design', 'Tanggal Penyelesaian 2D', 'On Time', 'Delay']];
        body = recapProjects.map((p, i) => {
          const target = p['Target Design'] || '-';
          const date2D = p['2D'] || '-';
          const isOnTime = (date2D !== '-' && target !== '-' && new Date(date2D) <= new Date(target));
          const isDelay = (date2D !== '-' && target !== '-' && new Date(date2D) > new Date(target)) || (date2D === '-' && target !== '-' && new Date(target) < new Date());
          return [
            i + 1,
            p.Customer,
            p['Nama Project'],
            target,
            date2D,
            isOnTime ? 'On Time' : '-',
            isDelay ? 'Delay' : '-'
          ];
        });
      } else if (designCategory === 'costEfficiency') {
        head = [['No', 'Customer', 'Nama Project', 'Anggaran Design', 'Pengeluaran Design', 'Efisiensi (%)']];
        body = recapProjects.map((p, i) => {
          const item = reviewCostList.find((c) => c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === designMonth);
          const anggaran = item?.anggaran || 0;
          const totalExp = item ? item.pengeluaran.reduce((sum, e) => sum + e.amount, 0) : 0;
          const eff = anggaran > 0 ? `${((totalExp / anggaran) * 100).toFixed(1)}%` : '-';
          return [
            i + 1,
            p.Customer,
            p['Nama Project'],
            `Rp ${anggaran.toLocaleString('id-ID')}`,
            `Rp ${totalExp.toLocaleString('id-ID')}`,
            eff
          ];
        });
      } else if (designCategory === 'designErrorRate') {
        head = [['No', 'Customer', 'Nama Project', 'Total Drawing', 'Revisi Drawing/Design', 'Efisiensi (%)']];
        body = recapProjects.map((p, i) => {
          const item = reviewErrorList.find((e) => e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === designMonth);
          const totalDrawing = Number(p['Qty Drawing'] || 0);
          const errorCount = item ? item.errors.length : 0;
          const eff = totalDrawing > 0 ? `${((errorCount / totalDrawing) * 100).toFixed(1)}%` : '0.0%';
          return [
            i + 1,
            p.Customer,
            p['Nama Project'],
            totalDrawing,
            errorCount,
            eff
          ];
        });
      } else {
        head = [['No', 'Customer', 'Nama Project', 'Qty', 'Target Design', 'Selesai', 'Status']];
        body = recapProjects.map((p, i) => [
          i + 1,
          p.Customer,
          p['Nama Project'],
          p['Qty Drawing'],
          p['Target Design'] || '-',
          p['Tanggal Penyelesaian'] || p['Aktual Engineering'] || '-',
          p.Status
        ]);
      }

      autoTable(doc, {
        startY: 20,
        head: head,
        body: body,
        theme: 'grid',
        headStyles: { fillColor: [4, 120, 87], textColor: [255, 255, 255], fontSize: 8, fontStyle: 'bold' },
        bodyStyles: { fontSize: 8 },
        margin: { left: 14, right: 14 }
      });

      doc.save(`Rekap_${designCategory}_${designMonth}_${activeYear}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  // Custom tooltip for Recharts Trends chart
  const TrendCustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900/95 text-white p-3 rounded-xl shadow-xl border border-slate-700 text-xs backdrop-blur-md min-w-[200px]">
          <div className="font-bold text-slate-200 border-b border-slate-800 pb-1.5 mb-1.5 flex justify-between items-center gap-3">
            <span>{data.monthFull} ({activeYear})</span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                data.actual !== null
                  ? data.achieved
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-rose-500/20 text-rose-300'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {data.actual !== null ? (data.achieved ? '✓ Tercapai' : '⚠ Perhatian') : 'Belum Ada Data'}
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between items-center gap-4">
              <span className="text-slate-400">Aktual:</span>
              <span className="font-mono font-bold text-emerald-400 text-sm">
                {data.actual !== null ? `${data.actual} ${data.unit}` : '-'}
              </span>
            </div>
            <div className="flex justify-between items-center gap-4">
              <span className="text-slate-400">Target Acuan:</span>
              <span className="font-mono font-semibold text-amber-300">
                {data.target} {data.unit}
              </span>
            </div>
            {data.variance !== null && (
              <div className="flex justify-between items-center gap-4 pt-1 border-t border-slate-800">
                <span className="text-slate-400">Deviasi vs Target:</span>
                <span className={`font-mono font-bold ${data.variance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data.variance > 0 ? `+${data.variance}` : data.variance} {data.unit}
                </span>
              </div>
            )}
            {data.momChange !== null && (
              <div className="flex justify-between items-center gap-4">
                <span className="text-slate-400">Fluktuasi MoM:</span>
                <span className={`font-mono font-bold ${data.momChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {data.momChange > 0 ? `+${data.momChange}` : data.momChange} {data.unit}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }
    return null;
  };

  // Renders the Recharts Trends Section
  const renderTrendsSection = () => {
    if (!activeTrendKpi) return null;

    return (
      <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 sm:space-y-6">
        {/* Header Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-slate-800">
                Analisis Tren & Fluktuasi Bulanan KPI {activeYear} (Recharts)
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Visualisasi fluktuasi capaian aktual per bulan sepanjang tahun {activeYear} dengan kurva tren dan deviasi target
            </p>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Filter Periode */}
            <div className="flex items-center justify-between sm:justify-start space-x-1.5">
              <span className="text-xs font-semibold text-slate-500 shrink-0">Periode:</span>
              <select
                value={kpiPeriodFilter}
                onChange={(e) => setKpiPeriodFilter(e.target.value)}
                className="flex-1 sm:flex-none bg-slate-50 border border-slate-300 text-slate-800 text-base sm:text-xs font-semibold rounded-xl px-2.5 py-2 min-h-[40px] sm:min-h-0 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="ALL">Semua Bulan (Jan - Des)</option>
                <option value="Q1">Kuartal 1 (Jan - Mar)</option>
                <option value="Q2">Kuartal 2 (Apr - Jun)</option>
                <option value="Q3">Kuartal 3 (Jul - Sep)</option>
                <option value="Q4">Kuartal 4 (Okt - Des)</option>
                <option value="H1">Semester 1 (Jan - Jun)</option>
                <option value="H2">Semester 2 (Jul - Des)</option>
              </select>
            </div>

            {/* KPI Item Selector */}
            <div className="flex items-center justify-between sm:justify-start space-x-1.5">
              <span className="text-xs font-semibold text-slate-500 shrink-0">KPI:</span>
              <select
                value={trendKpiId}
                onChange={(e) => setTrendKpiId(Number(e.target.value))}
                className="flex-1 sm:flex-none max-w-full sm:max-w-xs bg-slate-50 border border-slate-300 text-slate-800 text-base sm:text-xs font-semibold rounded-xl px-3 py-2 min-h-[40px] sm:min-h-0 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {syncedKpiList.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.no}. {k.objective} (Target: {k.target})
                  </option>
                ))}
              </select>
            </div>

            {/* Chart Style Switcher */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTrendChartType('area')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  trendChartType === 'area'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Area Fluktuasi
              </button>
              <button
                type="button"
                onClick={() => setTrendChartType('line')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  trendChartType === 'line'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Garis Tren
              </button>
              <button
                type="button"
                onClick={() => setTrendChartType('variance')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
                  trendChartType === 'variance'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Deviasi Target
              </button>
            </div>
          </div>
        </div>

        {/* Active KPI Item Information Banner */}
        <div className="bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border border-emerald-200/80 rounded-xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 bg-emerald-600 text-white font-bold rounded text-xs font-mono">
                {activeTrendKpi.no}
              </span>
              <h4 className="font-bold text-slate-800 text-sm">{activeTrendKpi.objective}</h4>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              <span className="text-slate-400">Parameter: </span>
              {activeTrendKpi.kpi}
            </p>
            <p className="text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">Basis Ukur: </span>{activeTrendKpi.measurementBasis} • <span className="font-semibold text-slate-600">Aturan: </span>{activeTrendKpi.ruleDesc}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="bg-white/90 border border-emerald-200 px-3 py-1.5 rounded-lg text-center shadow-xs">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">Bobot</span>
              <span className="font-bold text-slate-800 text-xs font-mono">{activeTrendKpi.bobot * 100}%</span>
            </div>
            <div className="bg-white/90 border border-emerald-200 px-3 py-1.5 rounded-lg text-center shadow-xs">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">Target Resmi</span>
              <span className="font-bold text-amber-700 text-xs font-mono">{activeTrendKpi.target}</span>
            </div>
            <div className="bg-white/90 border border-emerald-200 px-3 py-1.5 rounded-lg text-center shadow-xs">
              <span className="block text-[10px] text-slate-400 font-semibold uppercase">Satuan</span>
              <span className="font-bold text-emerald-800 text-xs">{activeTrendKpi.unit}</span>
            </div>
          </div>
        </div>

        {/* 6 Key Statistics Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Target Acuan</span>
            <div className="text-base font-bold text-amber-700 mt-1 font-mono">
              {activeTrendKpi.target}
            </div>
            <span className="text-[10px] text-slate-500 font-medium">Nilai standar resmi</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rata-Rata Aktual</span>
            <div className="text-base font-bold text-emerald-700 mt-1 font-mono">
              {trendStats.avg} <span className="text-xs font-normal">{activeTrendKpi.unit}</span>
            </div>
            <span className="text-[10px] text-emerald-600 font-semibold">
              {evaluateKPI(activeTrendKpi, trendStats.avg).achieved ? '✓ Tercapai' : '⚠ Perhatian'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Puncak Tertinggi</span>
            <div className="text-base font-bold text-slate-800 mt-1 font-mono">
              {trendStats.max} <span className="text-xs font-normal">{activeTrendKpi.unit}</span>
            </div>
            <span className="text-[10px] text-slate-500">Bulan {trendStats.maxMonth}</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Titik Terendah</span>
            <div className="text-base font-bold text-slate-800 mt-1 font-mono">
              {trendStats.min} <span className="text-xs font-normal">{activeTrendKpi.unit}</span>
            </div>
            <span className="text-[10px] text-slate-500">Bulan {trendStats.minMonth}</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Rentang Fluktuasi</span>
            <div className="text-base font-bold text-indigo-700 mt-1 font-mono">
              ± {trendStats.spread} <span className="text-xs font-normal">{activeTrendKpi.unit}</span>
            </div>
            <span className="text-[10px] text-slate-500">Rentang Max - Min</span>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Fluktuasi Terkini</span>
            <div className="text-base font-bold flex items-center space-x-1 mt-1 font-mono text-slate-800">
              {trendStats.latestMoM >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-600 inline" />
              ) : (
                <TrendingDown className="w-4 h-4 text-rose-600 inline" />
              )}
              <span className={trendStats.latestMoM >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                {trendStats.latestMoM > 0 ? `+${trendStats.latestMoM}` : trendStats.latestMoM}
              </span>
            </div>
            <span className="text-[10px] text-slate-500">MoM vs bulan lalu</span>
          </div>
        </div>

        {/* Recharts Visualization Container */}
        <div className="p-3 sm:p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-3 px-1 sm:px-2">
            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Grafik Fluktuasi Bulanan: {activeTrendKpi.objective} ({activeYear})</span>
            </span>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-3 bg-emerald-500 rounded-full inline-block"></span>
                <span>Aktual Bulanan</span>
              </span>
              <span className="flex items-center space-x-1.5">
                <span className="w-3 h-0.5 bg-amber-500 border-t border-dashed border-amber-600 inline-block"></span>
                <span>Target ({activeTrendKpi.targetVal} {activeTrendKpi.unit})</span>
              </span>
            </div>
          </div>

          <div className="w-full h-60 sm:h-80">
            <ResponsiveContainer width="100%" height="100%">
              {trendChartType === 'area' ? (
                <AreaChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="trendActualGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <RechartsTooltip content={<TrendCustomTooltip />} />
                  <ReferenceLine
                    y={Number(activeTrendKpi.targetVal)}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `Target: ${activeTrendKpi.target}`,
                      position: 'insideTopRight',
                      fill: '#b45309',
                      fontSize: 11,
                      fontWeight: 'bold'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="actual"
                    name={`Aktual (${activeTrendKpi.unit})`}
                    stroke="#10b981"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#trendActualGradient)"
                    activeDot={{ r: 7, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              ) : trendChartType === 'line' ? (
                <LineChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <RechartsTooltip content={<TrendCustomTooltip />} />
                  <ReferenceLine
                    y={Number(activeTrendKpi.targetVal)}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                    label={{
                      value: `Target: ${activeTrendKpi.target}`,
                      position: 'insideTopRight',
                      fill: '#b45309',
                      fontSize: 11,
                      fontWeight: 'bold'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name={`Aktual (${activeTrendKpi.unit})`}
                    stroke="#059669"
                    strokeWidth={3}
                    dot={{ r: 5, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: '#10b981', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="target"
                    name={`Target (${activeTrendKpi.unit})`}
                    stroke="#f59e0b"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              ) : (
                <RechartsBarChart data={trendData} margin={{ top: 20, right: 30, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="month" stroke="#64748b" fontSize={12} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <YAxis stroke="#64748b" fontSize={11} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                  <RechartsTooltip content={<TrendCustomTooltip />} />
                  <ReferenceLine y={0} stroke="#64748b" strokeWidth={1.5} />
                  <RechartsBar dataKey="variance" name={`Deviasi vs Target (${activeTrendKpi.unit})`} radius={[4, 4, 0, 0]}>
                    {trendData.map((entry, index) => {
                      const isGood = activeTrendKpi.ruleType === 'lte' ? (entry.variance !== null && entry.variance <= 0) : (entry.variance !== null && entry.variance >= 0);
                      return <Cell key={`cell-${index}`} fill={isGood ? '#10b981' : '#f43f5e'} />;
                    })}
                  </RechartsBar>
                </RechartsBarChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Fluctuation Cards Strip */}
        <div>
          <h4 className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
            <span>Rincian Fluktuasi Bulanan ({activeYear})</span>
            <span className="text-[11px] text-slate-400 font-normal">Evaluasi capaian bulanan dan perubahan MoM</span>
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-12 gap-2">
            {trendData.map((d) => (
              <div
                key={d.month}
                className={`p-2.5 rounded-xl border text-center transition flex flex-col justify-between ${
                  d.actual === null
                    ? 'bg-slate-50 border-slate-200 opacity-60'
                    : d.achieved
                    ? 'bg-emerald-50/60 border-emerald-200'
                    : 'bg-rose-50/60 border-rose-200'
                }`}
              >
                <div>
                  <span className="text-[11px] font-bold text-slate-700 block">{d.month}</span>
                  <div className="font-mono font-bold text-xs mt-1 text-slate-900">
                    {d.actual !== null ? `${d.actual} ${activeTrendKpi.unit}` : '-'}
                  </div>
                </div>

                <div className="mt-2 pt-1 border-t border-slate-200/60 text-[10px]">
                  {d.actual !== null ? (
                    <>
                      <span
                        className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          d.achieved ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {d.achieved ? 'Tercapai' : 'Perhatian'}
                      </span>
                      {d.momChange !== null && (
                        <span className={`block font-mono text-[9px] mt-0.5 ${d.momChange >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {d.momChange > 0 ? `+${d.momChange}` : d.momChange}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-slate-400 italic text-[9px]">Kosong</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Top Bar Navigation */}
      <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="h-1 w-full theme-accent-line" />
        <div className="p-3 sm:p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center space-x-2.5 min-w-0">
              <button
                onClick={onBackToMonitoring}
                className="theme-header-bg text-white px-3 py-2 min-h-[40px] rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm shrink-0 hover:brightness-110"
              >
                <ArrowLeft className="w-4 h-4 text-white" />
                <span className="hidden sm:inline">Kembali ke Monitoring Drawing</span>
                <span className="sm:hidden">Kembali</span>
              </button>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight truncate">
                  KPI Engineering Department CDR
                </h2>
                <p className="text-[11px] text-slate-500 font-medium truncate">Plant CDR & BTG • Target vs Aktual Terukur</p>
              </div>
            </div>

            {/* Year selector */}
            <select
              value={activeYear}
              onChange={(e) => onYearChange(e.target.value)}
              className="theme-header-bg border border-white/20 text-white text-base sm:text-xs font-bold rounded-xl px-3 py-2 min-h-[40px] focus:ring-2 focus:ring-cyan-400 focus:outline-none shadow-sm shrink-0"
            >
              <option value="2026" className="bg-slate-900 text-white">Tahun 2026</option>
              <option value="2027" className="bg-slate-900 text-white">Tahun 2027</option>
              <option value="2028" className="bg-slate-900 text-white">Tahun 2028</option>
              <option value="2029" className="bg-slate-900 text-white">Tahun 2029</option>
              <option value="2030" className="bg-slate-900 text-white">Tahun 2030</option>
            </select>
          </div>

          {/* Action Controls & Horizontally Scrollable Subtabs on Mobile */}
          <div className="flex overflow-x-auto no-scrollbar lg:flex-wrap items-center gap-1.5 sm:gap-2 pb-1 pt-2 border-t border-slate-100">
            {/* Subtab Buttons */}
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'dashboard'
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/25'
                  : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('trends')}
              className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'trends'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-md shadow-cyan-500/25'
                  : 'bg-slate-100 text-slate-700 hover:bg-cyan-50 hover:text-cyan-700'
              }`}
            >
              <TrendingUp className={`w-3.5 h-3.5 ${activeTab === 'trends' ? 'text-white' : 'text-cyan-600'}`} />
              <span>Trends</span>
            </button>

            <button
              onClick={() => setActiveTab('matrix')}
              className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'matrix'
                  ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/25'
                  : 'bg-slate-100 text-slate-700 hover:bg-teal-50 hover:text-teal-700'
              }`}
            >
              <Table className={`w-3.5 h-3.5 ${activeTab === 'matrix' ? 'text-white' : 'text-teal-600'}`} />
              <span>Matriks Resmi</span>
            </button>

            <button
              onClick={() => setActiveTab('monitoring')}
              className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'monitoring'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                  : 'bg-slate-100 text-slate-700 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <PenTool className={`w-3.5 h-3.5 ${activeTab === 'monitoring' ? 'text-white' : 'text-blue-600'}`} />
              <span>Tabel & Input</span>
            </button>

            {canAccessFullKpiCdr && (
              <>
                <button
                  onClick={() => setActiveTab('designInput')}
                  className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                    activeTab === 'designInput'
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-500/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-violet-50 hover:text-violet-700'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${activeTab === 'designInput' ? 'text-amber-200' : 'text-violet-600'}`} />
                  <span>Input Rekapitulasi</span>
                </button>

                <button
                  onClick={() => setActiveTab('reviewCost')}
                  className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                    activeTab === 'reviewCost'
                      ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-white shadow-md shadow-amber-500/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-700'
                  }`}
                >
                  <DollarSign className={`w-3.5 h-3.5 ${activeTab === 'reviewCost' ? 'text-white' : 'text-amber-600'}`} />
                  <span>Review Cost</span>
                </button>

                <button
                  onClick={() => setActiveTab('reviewError')}
                  className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                    activeTab === 'reviewError'
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md shadow-rose-500/25'
                      : 'bg-slate-100 text-slate-700 hover:bg-rose-50 hover:text-rose-700'
                  }`}
                >
                  <AlertCircle className={`w-3.5 h-3.5 ${activeTab === 'reviewError' ? 'text-white' : 'text-rose-600'}`} />
                  <span>Review Error</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('quarterly')}
              className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'quarterly'
                  ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-md shadow-sky-500/25'
                  : 'bg-slate-100 text-slate-700 hover:bg-sky-50 hover:text-sky-700'
              }`}
            >
              <BarChart className={`w-3.5 h-3.5 ${activeTab === 'quarterly' ? 'text-white' : 'text-sky-600'}`} />
              <span>Q1-Q4</span>
            </button>

            <button
              onClick={() => setActiveTab('approvals')}
              className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'approvals'
                  ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 text-white shadow-md shadow-amber-500/25'
                  : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Persetujuan Manager</span>
              {pendingCount > 0 && (
                <span className={`px-1.5 py-0.5 rounded-lg text-[10px] font-bold tabular-nums ${
                  activeTab === 'approvals' ? 'bg-white text-amber-700' : 'bg-rose-600 text-white'
                }`}>
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 ${
                activeTab === 'audit'
                  ? 'bg-gradient-to-r from-slate-700 to-indigo-800 text-white shadow-md'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Audit</span>
            </button>

            <button
              onClick={() => setShowEmailModal(true)}
              className="whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3 py-2 text-xs font-bold rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white transition shadow-md shadow-cyan-500/20 flex items-center space-x-1.5"
            >
              <Mail className="w-3.5 h-3.5" />
              <span>Email</span>
            </button>

            <button
              onClick={() => setShowExportModal(true)}
              className="whitespace-nowrap shrink-0 min-h-[40px] sm:min-h-0 px-3.5 py-2 text-xs font-bold rounded-xl theme-btn-primary transition flex items-center space-x-1.5"
            >
              <FileDown className="w-3.5 h-3.5" />
              <span>Ekspor PDF/Excel</span>
            </button>
          </div>
        </div>
      </div>

      {emailSentMessage && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 text-xs text-emerald-900 shadow-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold">{emailSentMessage}</span>
          </div>
          <button
            onClick={() => setEmailSentMessage(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold px-2 py-1 rounded-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Role Supervisor & Pending Approval Status Banners */}
      {isSupervisor && (
        <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-300 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-sm">
          <div className="flex items-start sm:items-center space-x-2.5 text-xs text-amber-950">
            <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold">Akses Supervisor Engineering (Persetujuan Manager Aktif):</span>{' '}
              Anda dapat mengakses & menginput seluruh menu di Dashboard KPI CDR. Setiap pengajuan perubahan akan masuk ke antrean <strong>Persetujuan Manager</strong> sebelum diterapkan ke data resmi, dan tombol <strong>Hapus</strong> dinonaktifkan.
            </div>
          </div>
          {pendingCount > 0 && (
            <button
              onClick={() => setActiveTab('approvals')}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-[11px] font-bold whitespace-nowrap shadow-sm transition"
            >
              Lihat {pendingCount} Pengajuan Pending
            </button>
          )}
        </div>
      )}

      {isManager && pendingCount > 0 && activeTab !== 'approvals' && (
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-cyan-50 border border-blue-300 rounded-2xl px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 shadow-sm">
          <div className="flex items-center space-x-2.5 text-xs text-blue-950">
            <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <span>
              Terdapat <strong>{pendingCount} pengajuan input data</strong> dari Supervisor yang menunggu persetujuan Manager.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('approvals')}
            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-[11px] font-bold whitespace-nowrap shadow-sm transition"
          >
            Tinjau & Setujui Sekarang →
          </button>
        </div>
      )}

      {/* SUBTAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white/95 rounded-2xl shadow-sm border border-blue-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="h-1.5 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-600" />
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total KPI Departemen</p>
                  <h3 className="text-2xl font-extrabold text-slate-900 mt-1 tabular-nums">9 KPI Resmi</h3>
                  <p className="text-xs text-blue-600 font-semibold mt-1.5">Aktif Tahun {activeYear}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                  <Table className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white/95 rounded-2xl shadow-sm border border-violet-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Bobot Keseluruhan</p>
                  <h3 className="text-2xl font-extrabold text-indigo-700 mt-1 tabular-nums">100%</h3>
                  <p className="text-xs text-violet-600 font-semibold mt-1.5">Terdistribusi Sempurna</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
                  <ShieldAlert className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white/95 rounded-2xl shadow-sm border border-emerald-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400 via-teal-500 to-cyan-500" />
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Rata-Rata Pencapaian</p>
                  <h3 className="text-2xl font-extrabold text-emerald-600 mt-1 tabular-nums">{kpiStats.averageScore}%</h3>
                  <p className="text-xs text-emerald-700 font-semibold mt-1.5">Terbobot Berjalan</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
              </div>
            </div>

            <div className="bg-white/95 rounded-2xl shadow-sm border border-amber-100 overflow-hidden hover:shadow-md hover:-translate-y-0.5 transition-all">
              <div className="h-1.5 w-full bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500" />
              <div className="p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Status Kesehatan KPI</p>
                  <h3 className="text-xl font-extrabold text-amber-600 mt-1">{kpiStats.health}</h3>
                  <p className="text-xs text-orange-600 font-semibold mt-1.5">Target vs Aktual</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                  <Sparkles className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>

          {/* AI Insight & Rekomendasi Section for KPI (Manager Exclusive) */}
          <AIInsightsSection
            userRole={userRole}
            contextType="kpi"
            period={`${kpiPeriodFilter === 'ALL' ? 'Setahun Penuh (Jan - Des)' : kpiPeriodFilter} ${activeYear}`}
            dataSummary={kpiSummary}
          />

          {/* Performance Chart & Dept Info */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-6 gap-3">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-800 flex flex-wrap items-center gap-2">
                    <span>Perbandingan Target vs Aktual KPI {activeYear}</span>
                    <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {kpiPeriodFilter === 'ALL' ? 'Semua Bulan (Jan - Des)' : kpiPeriodFilter}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Grafik komparasi modern Target vs Aktual (Bar & Line Combo)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                  <div className="flex items-center space-x-1.5 flex-1 sm:flex-none">
                    <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Filter Periode:</span>
                    <select
                      value={kpiPeriodFilter}
                      onChange={(e) => setKpiPeriodFilter(e.target.value)}
                      className="w-full sm:w-auto bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-base sm:text-xs rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="ALL">Semua Bulan (Jan - Des)</option>
                      <optgroup label="Kuartal">
                        <option value="Q1">Kuartal 1 (Jan - Mar)</option>
                        <option value="Q2">Kuartal 2 (Apr - Jun)</option>
                        <option value="Q3">Kuartal 3 (Jul - Sep)</option>
                        <option value="Q4">Kuartal 4 (Okt - Des)</option>
                      </optgroup>
                      <optgroup label="Semester">
                        <option value="H1">Semester 1 (Jan - Jun)</option>
                        <option value="H2">Semester 2 (Jul - Des)</option>
                      </optgroup>
                      <optgroup label="Bulan">
                        {MONTH_NAMES.map((m) => (
                          <option key={m} value={m}>
                            {MONTH_FULL_NAMES[m]} ({m})
                          </option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="flex items-center space-x-1.5 flex-1 sm:flex-none">
                    <span className="text-xs font-semibold text-slate-500 hidden sm:inline">Pilih KPI:</span>
                    <select
                      value={selectedChartKpi}
                      onChange={(e) => setSelectedChartKpi(e.target.value)}
                      className="w-full sm:w-auto max-w-full sm:max-w-[180px] bg-slate-50 border border-slate-300 text-slate-700 text-base sm:text-xs rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="all">Rata-Rata Seluruh KPI</option>
                      {syncedKpiList.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.no}. {item.objective}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2D / 3D toggle */}
                  <div className="flex items-center space-x-0.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                    <button
                      type="button"
                      onClick={() => setKpiPerfDim('2D')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition ${
                        kpiPerfDim === '2D' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      2D
                    </button>
                    <button
                      type="button"
                      onClick={() => setKpiPerfDim('3D')}
                      className={`px-2.5 py-1 text-xs font-bold rounded-md transition flex items-center space-x-1 ${
                        kpiPerfDim === '3D' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <Box className="w-3 h-3" />
                      <span>3D</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className={kpiPerfDim === '2D' ? 'relative flex-grow w-full h-60 sm:h-80' : 'hidden'}>
                <canvas ref={perfChartRef} />
              </div>
              {kpiPerfDim === '3D' && (
                <div className="w-full animate-in fade-in duration-200">
                  <ThreeDChart
                    title={`Pencapaian KPI vs Target (3D WebGL Multi-Series) - ${selectedChartKpi === 'all' ? 'Rata-Rata Seluruh KPI' : syncedKpiList.find(k => String(k.id) === selectedChartKpi)?.objective || ''}`}
                    labels={kpiPerf3DData.labels}
                    series={kpiPerf3DData.series}
                    unit="%"
                    height={360}
                  />
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-800 mb-1">Informasi Departemen</h3>
                <p className="text-xs text-slate-500 mb-4">Engineering Department CDR</p>

                <div className="space-y-4 text-xs">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start space-x-3">
                    <div className="bg-blue-600 text-white p-2 rounded-lg">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-slate-400">Engineering Manager</p>
                      <p className="font-bold text-slate-800 text-sm">Andry Setyawan</p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start space-x-3">
                    <div className="bg-indigo-600 text-white p-2 rounded-lg">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-slate-400">Plant / Lokasi</p>
                      <p className="font-bold text-slate-800 text-sm">Plant CDR & BTG</p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start space-x-3">
                    <div className="bg-emerald-600 text-white p-2 rounded-lg">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-slate-400">Sistem Mutu & Audit</p>
                      <p className="font-bold text-slate-800 text-sm">ISO 9001:2015 & 5R Compliance</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-400">Zona Waktu</span>
                <span className="text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1 rounded-full">
                  WIB (UTC+7)
                </span>
              </div>
            </div>
          </div>

          {/* TRENDS & FLUCTUATION ANALYSIS SECTION (RECHARTS) IN DASHBOARD */}
          <div className="pt-2">
            {renderTrendsSection()}
          </div>
        </div>
      )}

      {/* SUBTAB: DEDICATED TRENDS VIEW */}
      {activeTab === 'trends' && (
        <div className="space-y-6">
          {renderTrendsSection()}
        </div>
      )}

      {/* SUBTAB 2: MATRIKS RESMI */}
      {activeTab === 'matrix' && (
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-slate-800">
                  KPI - ENGINEERING DEPARTMENT (Matriks Resmi {activeYear})
                </h3>
                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <CheckCircle2 className="w-3 h-3 text-blue-600" />
                  <span>Auto-Sync % Input Rekapitulasi (KPI 1–5)</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Rekapitulasi target dan pencapaian aktual bulanan resmi • KPI 1–5 terisi otomatis dari Input Rekapitulasi
              </p>
            </div>
            <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={handleExportMatrixPDF}
                className="px-3.5 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center justify-center space-x-1.5 transition"
              >
                <FileDown className="w-4 h-4 shrink-0" />
                <span>Cetak PDF Resmi</span>
              </button>
              <button
                onClick={handleExportMatrixExcel}
                className="px-3.5 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center justify-center space-x-1.5 transition"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>Excel Matriks</span>
              </button>
            </div>
          </div>

          {/* Mobile Mode Switcher for Matrix */}
          <div className="md:hidden flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-600">Bulan:</span>
              <select
                value={activeGlobalMonth}
                onChange={(e) => setActiveGlobalMonth(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-base sm:text-xs font-bold text-emerald-800"
              >
                {MONTH_NAMES.map((m) => (
                  <option key={m} value={m}>{MONTH_FULL_NAMES[m]}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center space-x-1 bg-slate-200/70 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setMatrixMobileMode('cards')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1 ${
                  matrixMobileMode === 'cards' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Kartu</span>
              </button>
              <button
                type="button"
                onClick={() => setMatrixMobileMode('table')}
                className={`px-2.5 py-1.5 rounded-md text-xs font-bold flex items-center space-x-1 ${
                  matrixMobileMode === 'table' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600'
                }`}
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>Matriks</span>
              </button>
            </div>
          </div>

          {/* Mobile Matrix Summary Cards */}
          {matrixMobileMode === 'cards' && (
            <div className="md:hidden space-y-2.5">
              {syncedKpiList.map((item) => {
                const currentVal = item.months[activeGlobalMonth];
                const evalRes = evaluateKPI(item, currentVal);
                const isExpanded = expandedMatrixKpi === item.id;
                const unitLabel = item.id === 7 ? 'Angka' : item.unit;
                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div
                      onClick={() => setExpandedMatrixKpi(isExpanded ? null : item.id)}
                      className="p-3 flex items-start justify-between gap-2 cursor-pointer active:bg-slate-50"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center flex-wrap gap-1.5">
                          <span className="px-2 py-0.5 rounded-md bg-emerald-700 text-white font-mono text-[10px] font-bold">
                            KPI #{item.no}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                            Bobot {item.bobot * 100}%
                          </span>
                          {item.id >= 1 && item.id <= 5 && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                              Auto-Sync
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-900">{item.objective}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-2">{item.kpi}</p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end space-y-1">
                        <span className="text-[10px] font-semibold text-slate-400">
                          {activeGlobalMonth} {activeYear}
                        </span>
                        <span className="text-sm font-black font-mono text-slate-900">
                          {currentVal !== null && currentVal !== undefined
                            ? item.unit === '%' ? `${currentVal}%` : currentVal
                            : '-'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${evalRes.color}`}>
                          {evalRes.label}
                        </span>
                      </div>
                    </div>

                    <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px]">
                      <span>
                        Target: <strong className="text-emerald-700">{item.target}</strong> ({unitLabel})
                      </span>
                      <button
                        type="button"
                        onClick={() => setExpandedMatrixKpi(isExpanded ? null : item.id)}
                        className="font-bold text-indigo-700 flex items-center space-x-1"
                      >
                        <span>{isExpanded ? 'Tutup 12 Bulan' : 'Lihat Jan–Des'}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="p-3 bg-slate-50/70 border-t border-slate-200 space-y-2.5">
                        <div className="grid grid-cols-3 gap-1.5">
                          {MONTH_NAMES.map((m) => {
                            const val = item.months[m];
                            const hasVal = val !== null && val !== undefined;
                            const mEval = evaluateKPI(item, val);
                            const disp = hasVal ? (item.unit === '%' ? `${val}%` : val) : '-';
                            return (
                              <div
                                key={m}
                                className={`p-2 rounded-lg border text-center ${
                                  !hasVal
                                    ? 'bg-white border-slate-200 text-slate-400'
                                    : mEval.achieved
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                    : 'bg-rose-50 border-rose-200 text-rose-700'
                                }`}
                              >
                                <span className="block text-[10px] font-bold text-slate-500">{m}</span>
                                <span className="block font-mono font-extrabold text-xs mt-0.5">{disp}</span>
                              </div>
                            );
                          })}
                        </div>
                        {item.keterangan && (
                          <p className="text-[11px] text-slate-600 bg-white p-2 rounded-lg border border-slate-200">
                            <strong className="text-slate-700">Keterangan:</strong> {item.keterangan}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className={`overflow-x-auto rounded-xl border border-slate-300 shadow-inner ${matrixMobileMode === 'table' ? 'block' : 'hidden md:block'}`}>
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-emerald-700 text-white text-center font-bold">
                  <th className="p-2 border border-emerald-800 w-10" rowSpan={2}>No</th>
                  <th className="p-2 border border-emerald-800 text-left min-w-[200px]" rowSpan={2}>Quality Objective</th>
                  <th className="p-2 border border-emerald-800 text-left min-w-[240px]" rowSpan={2}>KPI</th>
                  <th className="p-2 border border-emerald-800 w-16" rowSpan={2}>Bobot</th>
                  <th className="p-2 border border-emerald-800 w-16" rowSpan={2}>Unit</th>
                  <th className="p-2 border border-emerald-800 w-24" rowSpan={2}>Target</th>
                  <th className="p-2 border border-emerald-800 w-12" rowSpan={2}>T/A</th>
                  <th className="p-2 border border-emerald-800" colSpan={12}>{activeYear}</th>
                  <th className="p-2 border border-emerald-800 min-w-[160px]" rowSpan={2}>Keterangan</th>
                </tr>
                <tr className="bg-emerald-800 text-white text-center font-bold">
                  {MONTH_NAMES.map((m) => (
                    <th key={m} className="p-1 border border-emerald-900 w-12">{m}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300 text-slate-800 bg-white">
                {syncedKpiList.map((item) => (
                  <React.Fragment key={item.id}>
                    {/* Row 1: Target (T) */}
                    <tr className="border-b border-slate-300 text-center bg-white hover:bg-slate-50">
                      <td className="p-2 border border-slate-300 font-bold" rowSpan={2}>{item.no}</td>
                      <td className="p-2 border border-slate-300 font-bold text-left">{item.objective}</td>
                      <td className="p-2 border border-slate-300 text-left text-slate-600">{item.kpi}</td>
                      <td className="p-2 border border-slate-300 font-medium">{item.bobot * 100}%</td>
                      <td className="p-2 border border-slate-300">{item.id === 7 ? 'Angka' : item.unit}</td>
                      <td className="p-2 border border-slate-300 font-semibold">{item.target}</td>
                      <td className="p-2 border border-slate-300 font-bold bg-emerald-50 text-emerald-800">T</td>
                      {MONTH_NAMES.map((m) => (
                        <td key={m} className="p-1 border border-slate-300 font-medium text-slate-700">
                          {item.target}
                        </td>
                      ))}
                      <td className="p-2 border border-slate-300 text-left text-[10px] text-slate-600" rowSpan={2}>
                        {item.keterangan || '-'}
                      </td>
                    </tr>
                    {/* Row 2: Actual (A) */}
                    <tr className="border-b border-slate-300 text-center bg-white hover:bg-slate-50">
                      <td className="p-2 border border-slate-300 text-left" colSpan={5}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 italic">Pencapaian Aktual Departemen</span>
                          {item.id >= 1 && item.id <= 5 && (
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                              Auto % Input Rekapitulasi
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 border border-slate-300 font-bold bg-blue-50 text-blue-800">A</td>
                      {MONTH_NAMES.map((m) => {
                        const val = item.months[m];
                        const isAuto = autoSyncedCells.has(`${item.id}_${m}`);
                        const evalRes = evaluateKPI(item, val);
                        const hasVal = val !== null && val !== undefined;
                        const displayVal = hasVal ? (item.unit === '%' ? `${val}%` : val) : '-';
                        return (
                          <td
                            key={m}
                            title={
                              isAuto
                                ? `Terisi otomatis dari hasil % Input Rekapitulasi (${MONTH_FULL_NAMES[m]}): ${displayVal}`
                                : undefined
                            }
                            className={`p-1 border border-slate-300 font-bold ${
                              !hasVal
                                ? 'text-slate-400'
                                : evalRes.achieved
                                ? isAuto
                                  ? 'text-emerald-700 bg-emerald-50/50'
                                  : 'text-emerald-700'
                                : 'text-rose-600 bg-rose-50/50'
                            }`}
                          >
                            {displayVal}
                          </td>
                        );
                      })}
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 3: TABEL & INPUT */}
      {activeTab === 'monitoring' && (
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800">Tabel Monitoring KPI & Pengukuran Aktual</h3>
              <p className="text-xs text-slate-500">Kelola dan perbarui nilai aktual bulanan beserta keterangan</p>
            </div>
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 sm:gap-3 w-full md:w-auto">
              <div className="flex items-center justify-between sm:justify-start space-x-2">
                <span className="text-xs font-semibold text-slate-500 shrink-0">Bulan Aktif:</span>
                <select
                  value={activeGlobalMonth}
                  onChange={(e) => setActiveGlobalMonth(e.target.value)}
                  className="flex-1 sm:flex-none bg-slate-50 border border-slate-300 text-slate-700 text-base sm:text-xs rounded-xl px-3 py-2 min-h-[42px] sm:min-h-0 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold"
                >
                  {MONTH_NAMES.map((m) => (
                    <option key={m} value={m}>{MONTH_FULL_NAMES[m]}</option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                value={searchKpi}
                onChange={(e) => setSearchKpi(e.target.value)}
                placeholder="Cari KPI..."
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 text-base sm:text-xs rounded-xl min-h-[42px] sm:min-h-0 focus:ring-2 focus:ring-emerald-500 focus:outline-none w-full sm:w-48"
              />
            </div>
          </div>

          {/* Mobile KPI Cards (< md) */}
          <div className="md:hidden space-y-2.5">
            {syncedKpiList
              .filter((item) => !searchKpi || item.objective.toLowerCase().includes(searchKpi.toLowerCase()))
              .map((item) => {
                const val = item.months[activeGlobalMonth];
                const isAuto = autoSyncedCells.has(`${item.id}_${activeGlobalMonth}`);
                const status = evaluateKPI(item, val);
                const unitStr = item.id === 7 ? 'Angka' : item.unit;

                return (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center flex-wrap gap-1.5 mb-1">
                          <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono text-[10px] font-bold">
                            #{item.no}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold">
                            Bobot {item.bobot * 100}%
                          </span>
                          {isAuto && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                              Auto Rekapitulasi
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-extrabold text-slate-900">{item.objective}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5">{item.kpi}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 ${status.color}`}>
                        {status.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">Target ({unitStr})</span>
                        <span className="font-bold text-slate-800">{item.target}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 font-semibold block">
                          Aktual ({MONTH_FULL_NAMES[activeGlobalMonth]})
                        </span>
                        <span className="font-extrabold font-mono text-emerald-700">
                          {val !== null && val !== undefined ? `${val} ${unitStr}` : 'Belum diisi'}
                        </span>
                      </div>
                    </div>

                    {item.keterangan && (
                      <p className="text-[11px] text-slate-600 bg-white px-2.5 py-1.5 rounded-lg border border-slate-100">
                        <strong className="text-slate-700">Ket:</strong> {item.keterangan}
                      </p>
                    )}

                    {!isReadOnly ? (
                      <button
                        type="button"
                        onClick={() => {
                          setEditModalItem(item);
                          setEditModalMonth(activeGlobalMonth);
                          setEditModalValue(item.months[activeGlobalMonth] !== null ? String(item.months[activeGlobalMonth]) : '');
                          setEditModalKet(item.keterangan || '');
                        }}
                        className={`w-full min-h-[44px] text-white rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 ${
                          isSupervisor ? 'bg-amber-600 hover:bg-amber-500' : 'bg-slate-900 hover:bg-slate-800'
                        }`}
                      >
                        <PenTool className="w-3.5 h-3.5" />
                        <span>{isSupervisor ? 'Ajukan Edit Nilai' : 'Input Nilai Aktual'}</span>
                      </button>
                    ) : (
                      <div className="text-center text-[11px] text-slate-400 font-semibold py-1">
                        Mode Read-Only
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[11px] tracking-wider">
                  <th className="p-3 text-center w-12">No</th>
                  <th className="p-3 min-w-[240px]">Quality Objective & Dasar Pengukuran</th>
                  <th className="p-3 text-center w-16">Bobot</th>
                  <th className="p-3 text-center w-16">Unit</th>
                  <th className="p-3 text-center w-24">Target</th>
                  <th className="p-3 text-center w-32">Aktual ({MONTH_FULL_NAMES[activeGlobalMonth]})</th>
                  <th className="p-3 text-center w-24">Status</th>
                  <th className="p-3 min-w-[180px]">Keterangan</th>
                  <th className="p-3 text-center w-24">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {syncedKpiList
                  .filter((item) => !searchKpi || item.objective.toLowerCase().includes(searchKpi.toLowerCase()))
                  .map((item) => {
                    const val = item.months[activeGlobalMonth];
                    const isAuto = autoSyncedCells.has(`${item.id}_${activeGlobalMonth}`);
                    const status = evaluateKPI(item, val);
                    const unitStr = item.id === 7 ? 'Angka' : item.unit;

                    return (
                      <tr key={item.id} className="hover:bg-slate-50 transition border-b border-slate-100">
                        <td className="p-3 text-center font-semibold text-slate-500">{item.no}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-800">{item.objective}</p>
                          <p className="text-[11px] text-slate-500 line-clamp-1">{item.kpi}</p>
                        </td>
                        <td className="p-3 text-center font-medium">{item.bobot * 100}%</td>
                        <td className="p-3 text-center">{unitStr}</td>
                        <td className="p-3 text-center font-semibold">{item.target}</td>
                        <td className="p-3 text-center font-bold text-emerald-600">
                          {val !== null && val !== undefined ? (
                            <div className="flex flex-col items-center">
                              <span>{`${val} ${unitStr}`}</span>
                              {isAuto && (
                                <span className="text-[9px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 mt-0.5">
                                  Auto Rekapitulasi
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">Belum diisi</span>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${status.color}`}>
                            {status.label}
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-slate-600">{item.keterangan || '-'}</td>
                        <td className="p-3 text-center">
                          {!isReadOnly ? (
                            <button
                              onClick={() => {
                                setEditModalItem(item);
                                setEditModalMonth(activeGlobalMonth);
                                setEditModalValue(item.months[activeGlobalMonth] !== null ? String(item.months[activeGlobalMonth]) : '');
                                setEditModalKet(item.keterangan || '');
                              }}
                              className={`px-2.5 py-1.5 text-white rounded-lg text-[11px] font-semibold transition ${
                                isSupervisor ? 'bg-amber-600 hover:bg-amber-500' : 'bg-slate-900 hover:bg-slate-800'
                              }`}
                            >
                              {isSupervisor ? 'Ajukan Edit' : 'Input Nilai'}
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Read-Only</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 4: INPUT TABEL REKAPITULASI (MANAGER & SUPERVISOR) */}
      {activeTab === 'designInput' && canAccessFullKpiCdr && (
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 sm:space-y-6">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center space-x-2">
                <PenTool className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Input Tabel Rekapitulasi Kategori KPI Design</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelola parameter KPI Design lengkap dengan perhitungan formula otomatis sesuai standar CDR
              </p>
            </div>
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
              <select
                value={designCategory}
                onChange={(e) => setDesignCategory(e.target.value as any)}
                className="w-full sm:w-auto text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 min-h-[42px] sm:min-h-0 font-semibold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="designQuality">1. Design Quality (≥ 90%)</option>
                <option value="onTimeDesign">2. On-Time Design (≥ 95%)</option>
                <option value="distribusiDrawing">3. Distribusi Drawing (≤ 10%)</option>
                <option value="costEfficiency">4. Cost Efficiency (≤ 95%)</option>
                <option value="designErrorRate">5. Design Error Rate (≤ 2%)</option>
              </select>

              <div className="grid grid-cols-2 sm:flex items-center gap-2">
                <select
                  value={designMonth}
                  onChange={(e) => setDesignMonth(e.target.value)}
                  className="w-full sm:w-auto text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 min-h-[42px] sm:min-h-0 font-semibold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                >
                  {MONTH_NAMES.map((m) => (
                    <option key={m} value={MONTH_FULL_NAMES[m]}>{MONTH_FULL_NAMES[m]}</option>
                  ))}
                </select>

                <button
                  onClick={handleExportDesignRecapPDF}
                  className="w-full sm:w-auto min-h-[42px] sm:min-h-0 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow transition flex items-center justify-center space-x-1.5"
                >
                  <FileDown className="w-4 h-4 shrink-0" />
                  <span>Cetak PDF Rekap</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Recap Table Rendering based on selected Category */}
          <div className="rounded-xl border-2 border-black bg-white shadow-sm overflow-hidden">
            {/* KATEGORI 1: DESIGN QUALITY */}
            {designCategory === 'designQuality' && (
              <div>
                {/* Yellow Title Bar */}
                <div className="bg-[#ffff00] bg-yellow-300 text-black border-b border-black py-2 px-4 text-center font-bold text-sm tracking-wide">
                  Design Quality
                </div>

                {/* Mobile Cards: Design Quality */}
                <div className="md:hidden p-2.5 space-y-2.5 bg-slate-50">
                  {recapProjects.length === 0 ? (
                    <div className="p-4 text-center italic text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                      Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                    </div>
                  ) : (
                    recapProjects.map((p, i) => {
                      const fb = feedbackList.find((f) => f.customer === p.Customer && f.projectName === p['Nama Project'] && f.month === designMonth);
                      const hasFeedback = fb && ((fb.fbProduksi && fb.fbProduksi.trim() !== '') || (fb.fbKastamer && fb.fbKastamer.trim() !== ''));
                      return (
                        <div key={p.SPK || i} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-slate-400">#{i + 1} • {p.Customer}</span>
                              <h4 className="text-xs font-extrabold text-slate-900">{p['Nama Project']}</h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              !hasFeedback ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {!hasFeedback ? 'Approve ✓' : 'Revisi'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-1.5 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                            <div>
                              <span className="font-bold text-slate-500">Feedback Produksi: </span>
                              <span className="text-slate-800">{fb?.fbProduksi?.trim() || '-'}</span>
                            </div>
                            <div>
                              <span className="font-bold text-slate-500">Feedback Kastamer: </span>
                              <span className="text-slate-800">{fb?.fbKastamer?.trim() || '-'}</span>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  setFeedbackModalProject(p);
                                  setModalFbProduksi(fb?.fbProduksi || '');
                                  setModalFbKastamer(fb?.fbKastamer || '');
                                }}
                                className="flex-1 min-h-[42px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                              >
                                Edit Feedback
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => {
                                    const updated = feedbackList.filter(
                                      (f) => !(f.customer === p.Customer && f.projectName === p['Nama Project'] && f.month === designMonth)
                                    );
                                    onUpdateFeedback(updated);
                                  }}
                                  className="min-h-[42px] px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs bg-white">
                  <thead>
                    <tr className="bg-white text-black text-center font-bold">
                      <th className="p-2 border border-black w-12" rowSpan={2}>No</th>
                      <th className="p-2 border border-black min-w-[180px]" rowSpan={2}>Customer</th>
                      <th className="p-2 border border-black min-w-[220px]" rowSpan={2}>Nama Project</th>
                      <th className="p-2 border border-black" colSpan={3}>Review Design</th>
                      <th className="p-2 border border-black w-36" rowSpan={2}>Aksi</th>
                    </tr>
                    <tr className="bg-white text-black text-center font-bold">
                      <th className="p-2 border border-black min-w-[180px]">FeedBack dr Team Produksi</th>
                      <th className="p-2 border border-black min-w-[180px]">FeedBack dr Team Kastamer</th>
                      <th className="p-2 border border-black w-28">Approve</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-black">
                    {recapProjects.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-4 text-center italic text-slate-500 border border-black">
                          Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                        </td>
                      </tr>
                    ) : (
                      recapProjects.map((p, i) => {
                        const fb = feedbackList.find((f) => f.customer === p.Customer && f.projectName === p['Nama Project'] && f.month === designMonth);
                        const hasFeedback = fb && (
                          (fb.fbProduksi && fb.fbProduksi.trim() !== '') ||
                          (fb.fbKastamer && fb.fbKastamer.trim() !== '')
                        );
                        return (
                          <tr key={p.SPK} className="hover:bg-yellow-50/40">
                            <td className="p-2 border border-black text-center font-semibold">{i + 1}</td>
                            <td className="p-2 border border-black font-medium">{p.Customer}</td>
                            <td className="p-2 border border-black font-medium">{p['Nama Project']}</td>
                            <td className="p-2 border border-black text-slate-700">
                              {fb?.fbProduksi && fb.fbProduksi.trim() !== '' ? (
                                <span>{fb.fbProduksi}</span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">-</span>
                              )}
                            </td>
                            <td className="p-2 border border-black text-slate-700">
                              {fb?.fbKastamer && fb.fbKastamer.trim() !== '' ? (
                                <span>{fb.fbKastamer}</span>
                              ) : (
                                <span className="text-slate-400 italic text-[11px]">-</span>
                              )}
                            </td>
                            <td className="p-2 border border-black text-center">
                              {!hasFeedback ? (
                                <span className="text-emerald-600 font-bold">Approve ✓</span>
                              ) : (
                                <span className="text-amber-600 font-semibold">Revisi</span>
                              )}
                            </td>
                            <td className="p-2 border border-black text-center">
                              {isReadOnly ? (
                                <span className="text-[11px] text-slate-400 font-semibold">Read-Only</span>
                              ) : (
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    onClick={() => {
                                      setFeedbackModalProject(p);
                                      setModalFbProduksi(fb?.fbProduksi || '');
                                      setModalFbKastamer(fb?.fbKastamer || '');
                                    }}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition shadow-sm"
                                  >
                                    Edit
                                  </button>
                                  {canDelete && (
                                    <button
                                      onClick={() => {
                                        const updated = feedbackList.filter(
                                          (f) => !(f.customer === p.Customer && f.projectName === p['Nama Project'] && f.month === designMonth)
                                        );
                                        onUpdateFeedback(updated);
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold transition shadow-sm"
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>

                {/* Footer Formula Design Quality */}
                <div className="border-t-2 border-black bg-white p-3 space-y-3 text-xs text-black">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center space-x-2 font-serif text-[13px]">
                      <span className="font-bold">Formula</span>
                      <span className="font-bold">=</span>
                      <div className="inline-flex flex-col items-center text-center">
                        <span className="border-b border-black px-2 pb-0.5 font-medium">
                          Jumlah nama project yang tidak ada feedbacknya
                        </span>
                        <span className="pt-0.5 font-medium">
                          total Semua nama project
                        </span>
                      </div>
                      <span className="font-bold">x100</span>
                    </div>
                    <div className="font-bold text-sm bg-slate-50 px-3 py-1.5 rounded border border-black">
                      Target = ≥ 90%
                    </div>
                  </div>

                  <div className="p-2 bg-[#ffff00] bg-yellow-300 text-black font-bold text-center text-sm border border-black tracking-wide">
                    Design Quality = {calculatedCategoryScore}%
                  </div>
                </div>
              </div>
            )}

            {/* KATEGORI 2: ON-TIME DESIGN */}
            {designCategory === 'onTimeDesign' && (
              <div>
                {/* Green Title Bar */}
                <div className="bg-[#4ade80] bg-green-500 text-black border-b border-black py-2 px-4 text-center font-bold text-sm tracking-wide">
                  On-Time Design
                </div>

                {/* Mobile Cards: On-Time Design */}
                <div className="md:hidden p-2.5 space-y-2.5 bg-slate-50">
                  {recapProjects.length === 0 ? (
                    <div className="p-4 text-center italic text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                      Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                    </div>
                  ) : (
                    recapProjects.map((p, i) => {
                      const targetStr = p['Target Design'] || '';
                      const finishStr = p['Tanggal Penyelesaian'] || p['Aktual Engineering'] || '';
                      const isOnTime = Boolean(
                        (finishStr && targetStr && new Date(finishStr) <= new Date(targetStr)) ||
                        (!finishStr && targetStr && p.Status === 'Selesai')
                      );
                      const isDelay = Boolean(
                        (finishStr && targetStr && new Date(finishStr) > new Date(targetStr)) ||
                        (!finishStr && targetStr && p.Status !== 'Selesai' && new Date(targetStr) < new Date())
                      );
                      return (
                        <div key={p.SPK || i} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-slate-400">#{i + 1} • {p.Customer}</span>
                              <h4 className="text-xs font-extrabold text-slate-900">{p['Nama Project']}</h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              isOnTime ? 'bg-emerald-100 text-emerald-700' : isDelay ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {isOnTime ? '✓ On Time' : isDelay ? 'Delay' : 'Proses'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono">
                            <div>
                              <span className="block text-[10px] font-sans text-slate-500">Target Design</span>
                              <strong className="text-slate-800">{targetStr || '-'}</strong>
                            </div>
                            <div>
                              <span className="block text-[10px] font-sans text-slate-500">Tgl Penyelesaian</span>
                              <strong className="text-slate-800">{finishStr || '-'}</strong>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  setDateModalProject(p);
                                  setDateModalMode('onTime');
                                  setModalTargetDate(targetStr);
                                  setModalFinishDate(finishStr);
                                }}
                                className="flex-1 min-h-[42px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                              >
                                Edit Tanggal
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => {
                                    if (onUpdateProject) {
                                      onUpdateProject({ ...p, 'Tanggal Penyelesaian': '', 'Aktual Engineering': '' });
                                    }
                                  }}
                                  className="min-h-[42px] px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs bg-white">
                  <thead>
                    <tr className="bg-white text-black text-center font-bold">
                      <th className="p-2 border border-black w-12" rowSpan={2}>No</th>
                      <th className="p-2 border border-black min-w-[180px]" rowSpan={2}>Customer</th>
                      <th className="p-2 border border-black min-w-[220px]" rowSpan={2}>Nama Project</th>
                      <th className="p-2 border border-black" colSpan={4}>Review Design</th>
                      <th className="p-2 border border-black w-36" rowSpan={2}>Aksi</th>
                    </tr>
                    <tr className="bg-white text-black text-center font-bold">
                      <th className="p-2 border border-black min-w-[160px]">Target Drawing/Design</th>
                      <th className="p-2 border border-black min-w-[160px]">Tanggal Penyelesaian</th>
                      <th className="p-2 border border-black w-24 text-emerald-600">On Time</th>
                      <th className="p-2 border border-black w-24 text-rose-600">Delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-black">
                    {recapProjects.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center italic text-slate-500 border border-black">
                          Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                        </td>
                      </tr>
                    ) : (
                      recapProjects.map((p, i) => {
                        const targetStr = p['Target Design'] || '';
                        const finishStr = p['Tanggal Penyelesaian'] || p['Aktual Engineering'] || '';
                        const isOnTime = Boolean(
                          (finishStr && targetStr && new Date(finishStr) <= new Date(targetStr)) ||
                          (!finishStr && targetStr && p.Status === 'Selesai')
                        );
                        const isDelay = Boolean(
                          (finishStr && targetStr && new Date(finishStr) > new Date(targetStr)) ||
                          (!finishStr && targetStr && p.Status !== 'Selesai' && new Date(targetStr) < new Date())
                        );

                        return (
                          <tr key={p.SPK} className="hover:bg-green-50/40">
                            <td className="p-2 border border-black text-center font-semibold">{i + 1}</td>
                            <td className="p-2 border border-black font-medium">{p.Customer}</td>
                            <td className="p-2 border border-black font-medium">{p['Nama Project']}</td>
                            <td className="p-2 border border-black text-center font-mono">{targetStr || '-'}</td>
                            <td className="p-2 border border-black text-center font-mono">{finishStr || '-'}</td>
                            <td className="p-2 border border-black text-center">
                              {isOnTime ? (
                                <span className="text-emerald-600 font-bold">✓ On Time</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-2 border border-black text-center">
                              {isDelay ? (
                                <span className="text-rose-600 font-bold">Delay</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-2 border border-black text-center">
                              {isReadOnly ? (
                                <span className="text-[11px] text-slate-400 font-semibold">Read-Only</span>
                              ) : (
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    onClick={() => {
                                      setDateModalProject(p);
                                      setDateModalMode('onTime');
                                      setModalTargetDate(targetStr);
                                      setModalFinishDate(finishStr);
                                    }}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition shadow-sm"
                                  >
                                    Edit
                                  </button>
                                  {canDelete && (
                                    <button
                                      onClick={() => {
                                        if (onUpdateProject) {
                                          onUpdateProject({ ...p, 'Tanggal Penyelesaian': '', 'Aktual Engineering': '' });
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold transition shadow-sm"
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>

                {/* Footer Formula On-Time Design */}
                <div className="border-t-2 border-black bg-white p-3 space-y-3 text-xs text-black">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center space-x-2 font-serif text-[13px]">
                      <span className="font-bold">Formula</span>
                      <span className="font-bold">=</span>
                      <div className="inline-flex flex-col items-center text-center">
                        <span className="border-b border-black px-2 pb-0.5 font-medium">
                          Jumlah Design yang On Time
                        </span>
                        <span className="pt-0.5 font-medium">
                          total Permintaan Drawing/Design
                        </span>
                      </div>
                      <span className="font-bold">x100</span>
                    </div>
                    <div className="font-bold text-sm bg-slate-50 px-3 py-1.5 rounded border border-black">
                      Target = ≥ 95%
                    </div>
                  </div>

                  <div className="p-2 bg-[#4ade80] bg-green-500 text-black font-bold text-center text-sm border border-black tracking-wide">
                    On-Time Design = {calculatedCategoryScore}%
                  </div>
                </div>
              </div>
            )}

            {/* KATEGORI 3: DISTRIBUSI DRAWING */}
            {designCategory === 'distribusiDrawing' && (
              <div>
                {/* Grey Title Bar */}
                <div className="bg-[#94a3b8] bg-slate-400 text-black border-b border-black py-2 px-4 text-center font-bold text-sm tracking-wide">
                  Distribusi Drawing
                </div>

                {/* Mobile Cards: Distribusi Drawing */}
                <div className="md:hidden p-2.5 space-y-2.5 bg-slate-50">
                  {recapProjects.length === 0 ? (
                    <div className="p-4 text-center italic text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                      Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                    </div>
                  ) : (
                    recapProjects.map((p, i) => {
                      const targetStr = p['Target Design'] || '';
                      const date2DStr = p['2D'] || '';
                      const isOnTime = Boolean(date2DStr && targetStr && new Date(date2DStr) <= new Date(targetStr));
                      const isDelay = Boolean(
                        (date2DStr && targetStr && new Date(date2DStr) > new Date(targetStr)) ||
                        (!date2DStr && targetStr && new Date(targetStr) < new Date())
                      );
                      return (
                        <div key={p.SPK || i} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-slate-400">#{i + 1} • {p.Customer}</span>
                              <h4 className="text-xs font-extrabold text-slate-900">{p['Nama Project']}</h4>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                              isOnTime ? 'bg-emerald-100 text-emerald-700' : isDelay ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {isOnTime ? '✓ On Time' : isDelay ? 'Delay' : 'Proses'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200 font-mono">
                            <div>
                              <span className="block text-[10px] font-sans text-slate-500">Target Design</span>
                              <strong className="text-slate-800">{targetStr || '-'}</strong>
                            </div>
                            <div>
                              <span className="block text-[10px] font-sans text-slate-500">Tgl Selesai 2D</span>
                              <strong className="text-slate-800">{date2DStr || '-'}</strong>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  setDateModalProject(p);
                                  setDateModalMode('distribusi');
                                  setModalTargetDate(targetStr);
                                  setModal2DDate(date2DStr);
                                }}
                                className="flex-1 min-h-[42px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                              >
                                Edit Tanggal 2D
                              </button>
                              {canDelete && (
                                <button
                                  onClick={() => {
                                    if (onUpdateProject) {
                                      onUpdateProject({ ...p, '2D': '' });
                                    }
                                  }}
                                  className="min-h-[42px] px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                                >
                                  Hapus
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs bg-white">
                  <thead>
                    <tr className="bg-white text-black text-center font-bold">
                      <th className="p-2 border border-black w-12" rowSpan={2}>No</th>
                      <th className="p-2 border border-black min-w-[180px]" rowSpan={2}>Customer</th>
                      <th className="p-2 border border-black min-w-[220px]" rowSpan={2}>Nama Project</th>
                      <th className="p-2 border border-black" colSpan={4}>Review Design</th>
                      <th className="p-2 border border-black w-36" rowSpan={2}>Aksi</th>
                    </tr>
                    <tr className="bg-white text-black text-center font-bold">
                      <th className="p-2 border border-black min-w-[160px]">Target Drawing/Design</th>
                      <th className="p-2 border border-black min-w-[160px]">Tanggal Penyelesaian 2D</th>
                      <th className="p-2 border border-black w-24 text-emerald-600">On Time</th>
                      <th className="p-2 border border-black w-24 text-rose-600">Delay</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black text-black">
                    {recapProjects.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-4 text-center italic text-slate-500 border border-black">
                          Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                        </td>
                      </tr>
                    ) : (
                      recapProjects.map((p, i) => {
                        const targetStr = p['Target Design'] || '';
                        const date2DStr = p['2D'] || '';
                        const isOnTime = Boolean(date2DStr && targetStr && new Date(date2DStr) <= new Date(targetStr));
                        const isDelay = Boolean(
                          (date2DStr && targetStr && new Date(date2DStr) > new Date(targetStr)) ||
                          (!date2DStr && targetStr && new Date(targetStr) < new Date())
                        );

                        return (
                          <tr key={p.SPK} className="hover:bg-slate-100/50">
                            <td className="p-2 border border-black text-center font-semibold">{i + 1}</td>
                            <td className="p-2 border border-black font-medium">{p.Customer}</td>
                            <td className="p-2 border border-black font-medium">{p['Nama Project']}</td>
                            <td className="p-2 border border-black text-center font-mono">{targetStr || '-'}</td>
                            <td className="p-2 border border-black text-center font-mono">{date2DStr || '-'}</td>
                            <td className="p-2 border border-black text-center">
                              {isOnTime ? (
                                <span className="text-emerald-600 font-bold">✓ On Time</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-2 border border-black text-center">
                              {isDelay ? (
                                <span className="text-rose-600 font-bold">Delay</span>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-2 border border-black text-center">
                              {isReadOnly ? (
                                <span className="text-[11px] text-slate-400 font-semibold">Read-Only</span>
                              ) : (
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button
                                    onClick={() => {
                                      setDateModalProject(p);
                                      setDateModalMode('distribusi');
                                      setModalTargetDate(targetStr);
                                      setModal2DDate(date2DStr);
                                    }}
                                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold transition shadow-sm"
                                  >
                                    Edit
                                  </button>
                                  {canDelete && (
                                    <button
                                      onClick={() => {
                                        if (onUpdateProject) {
                                          onUpdateProject({ ...p, '2D': '' });
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold transition shadow-sm"
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
                </div>

                {/* Footer Formula Distribusi Drawing */}
                <div className="border-t-2 border-black bg-white p-3 space-y-3 text-xs text-black">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center space-x-2 font-serif text-[13px]">
                      <span className="font-bold">Formula</span>
                      <span className="font-bold">=</span>
                      <div className="inline-flex flex-col items-center text-center">
                        <span className="border-b border-black px-2 pb-0.5 font-medium">
                          Jumlah Drawing yang Delay
                        </span>
                        <span className="pt-0.5 font-medium">
                          total Permintaan Drawing/Design
                        </span>
                      </div>
                      <span className="font-bold">x100</span>
                    </div>
                    <div className="font-bold text-sm bg-slate-50 px-3 py-1.5 rounded border border-black">
                      Target = ≤ 10%
                    </div>
                  </div>

                  <div className="p-2 bg-[#94a3b8] bg-slate-400 text-black font-bold text-center text-sm border border-black tracking-wide">
                    Distribusi Drawing = {calculatedCategoryScore}%
                  </div>
                </div>
              </div>
            )}

            {/* KATEGORI 4: COST EFFICIENCY (≤ 95%) */}
            {designCategory === 'costEfficiency' && (
              <div className="border-2 border-black rounded-xl overflow-hidden bg-white shadow-sm">
                {/* Yellow Title Bar */}
                <div className="bg-[#facc15] bg-amber-400 text-black py-2.5 px-4 text-center font-bold text-sm tracking-wide border-b border-black">
                  Design Cost Efficiency (Efisiensi Biaya Design)
                </div>

                {/* Mobile Cards: Cost Efficiency */}
                <div className="md:hidden p-2.5 space-y-2.5 bg-slate-50">
                  {recapProjects.length === 0 ? (
                    <div className="p-4 text-center italic text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                      Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                    </div>
                  ) : (
                    recapProjects.map((p, i) => {
                      const item = reviewCostList.find((c) => c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === designMonth);
                      const anggaran = item?.anggaran || 0;
                      const totalExp = item ? item.pengeluaran.reduce((sum, e) => sum + e.amount, 0) : 0;
                      const effPercent = anggaran > 0 ? ((totalExp / anggaran) * 100).toFixed(1) : '-';
                      const delKey = `cost_recap_${p.SPK || i}`;
                      return (
                        <div key={p.SPK || i} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-slate-400">#{i + 1} • {p.Customer}</span>
                              <h4 className="text-xs font-extrabold text-slate-900">{p['Nama Project']}</h4>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono text-[11px] font-bold shrink-0">
                              {effPercent !== '-' ? `${effPercent}%` : '-'}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-amber-50/40 p-2 rounded-lg border border-amber-200/70 font-mono">
                            <div>
                              <span className="block text-[10px] font-sans text-slate-500">Anggaran</span>
                              <strong className="text-slate-900">{anggaran > 0 ? `Rp ${anggaran.toLocaleString('id-ID')}` : '-'}</strong>
                            </div>
                            <div>
                              <span className="block text-[10px] font-sans text-slate-500">Pengeluaran</span>
                              <strong className="text-slate-900">{totalExp > 0 ? `Rp ${totalExp.toLocaleString('id-ID')}` : '-'}</strong>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  setCostModalProject(p);
                                  setModalAnggaranInput(anggaran ? String(anggaran) : '10000000');
                                  setModalExpenseDescInput('');
                                  setModalExpenseAmountInput('');
                                }}
                                className="flex-1 min-h-[42px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                              >
                                Kelola Biaya & Anggaran
                              </button>
                              {canDelete && (
                                confirmDeleteKey === delKey ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        const updated = reviewCostList.filter((c) => !(c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === designMonth));
                                        onUpdateReviewCost(updated);
                                        setConfirmDeleteKey(null);
                                      }}
                                      className="min-h-[42px] px-3 bg-rose-600 text-white rounded-xl text-xs font-bold"
                                    >
                                      Ya
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteKey(null)}
                                      className="min-h-[42px] px-3 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteKey(delKey)}
                                    className="min-h-[42px] px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                                  >
                                    Hapus
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs bg-white">
                    <thead>
                      <tr className="bg-white text-black text-center font-bold">
                        <th className="p-2 border border-black w-12" rowSpan={2}>No</th>
                        <th className="p-2 border border-black min-w-[180px]" rowSpan={2}>Customer</th>
                        <th className="p-2 border border-black min-w-[220px]" rowSpan={2}>Nama Project</th>
                        <th className="p-2 border border-black" colSpan={2}>Efficiency Design</th>
                        <th className="p-2 border border-black w-32" rowSpan={2}>Efisiensi (%)</th>
                        <th className="p-2 border border-black w-36" rowSpan={2}>Aksi</th>
                      </tr>
                      <tr className="bg-white text-black text-center font-bold">
                        <th className="p-2 border border-black min-w-[160px]">Anggaran Design</th>
                        <th className="p-2 border border-black min-w-[180px]">Pengeluaran Design</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black text-black">
                      {recapProjects.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center italic text-slate-500 border border-black">
                            Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                          </td>
                        </tr>
                      ) : (
                        recapProjects.map((p, i) => {
                          const item = reviewCostList.find((c) => c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === designMonth);
                          const anggaran = item?.anggaran || 0;
                          const totalExp = item ? item.pengeluaran.reduce((sum, e) => sum + e.amount, 0) : 0;
                          const effPercent = anggaran > 0 ? ((totalExp / anggaran) * 100).toFixed(1) : '-';

                          return (
                            <tr key={p.SPK || i} className="hover:bg-amber-50/40">
                              <td className="p-2 text-center border border-black font-semibold">{i + 1}</td>
                              <td className="p-2 border border-black font-medium">{p.Customer}</td>
                              <td className="p-2 border border-black font-medium">{p['Nama Project']}</td>
                              <td className="p-2 border border-black text-right font-mono font-semibold">
                                {anggaran > 0 ? `Rp ${anggaran.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td className="p-2 border border-black text-right font-mono font-semibold">
                                {totalExp > 0 ? `Rp ${totalExp.toLocaleString('id-ID')}` : '-'}
                              </td>
                              <td className="p-2 border border-black text-center font-mono font-bold text-amber-700">
                                {effPercent !== '-' ? `${effPercent}%` : '-'}
                              </td>
                              <td className="p-2 border border-black text-center">
                                {isReadOnly ? (
                                  <span className="text-[11px] text-slate-400 font-semibold">Read-Only</span>
                                ) : (
                                  <div className="flex items-center justify-center space-x-1.5">
                                    <button
                                      onClick={() => {
                                        setCostModalProject(p);
                                        setModalAnggaranInput(anggaran ? String(anggaran) : '10000000');
                                        setModalExpenseDescInput('');
                                        setModalExpenseAmountInput('');
                                      }}
                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold shadow-sm transition"
                                    >
                                      Edit
                                    </button>
                                    {canDelete && (
                                      confirmDeleteKey === `cost_table_${p.SPK || i}` ? (
                                        <div className="flex items-center space-x-1">
                                          <button
                                            onClick={() => {
                                              const updated = reviewCostList.filter((c) => !(c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === designMonth));
                                              onUpdateReviewCost(updated);
                                              setConfirmDeleteKey(null);
                                            }}
                                            className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
                                          >
                                            Ya
                                          </button>
                                          <button
                                            onClick={() => setConfirmDeleteKey(null)}
                                            className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-semibold"
                                          >
                                            Batal
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setConfirmDeleteKey(`cost_table_${p.SPK || i}`)}
                                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold shadow-sm transition"
                                        >
                                          Hapus
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {/* Baris kosong pelengkap visual tabel */}
                      {Array.from({ length: Math.max(0, 19 - recapProjects.length) }).map((_, idx) => (
                        <tr key={`blank-cost-${idx}`} className="h-7 text-black">
                          <td className="p-2 text-center border border-black font-semibold text-slate-400">{recapProjects.length + idx + 1}</td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Formula Footer Cost Efficiency */}
                <div className="border-t-2 border-black bg-white p-3 space-y-3 text-xs text-black">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center space-x-2 font-serif text-[13px]">
                      <span className="font-bold">Formula</span>
                      <span className="font-bold">=</span>
                      <div className="inline-flex flex-col items-center text-center">
                        <span className="border-b border-black px-2 pb-0.5 font-medium">Total Realisasi Biaya Design</span>
                        <span className="pt-0.5 font-medium">total Anggaran Design</span>
                      </div>
                      <span className="font-bold">x100%</span>
                    </div>
                    <div className="font-bold text-sm bg-slate-50 px-3 py-1.5 rounded border border-black">
                      Target = ≤ 95%
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#facc15] bg-amber-400 text-black font-bold text-center text-sm border border-black tracking-wide">
                    Design Cost Efisiensi = {calculatedCategoryScore}%
                  </div>
                </div>
              </div>
            )}

            {/* KATEGORI 5: DESIGN ERROR RATE (≤ 2%) */}
            {designCategory === 'designErrorRate' && (
              <div className="border-2 border-black rounded-xl overflow-hidden bg-white shadow-sm">
                {/* Red Title Bar */}
                <div className="bg-[#dc2626] bg-red-600 text-white py-2.5 px-4 text-center font-bold text-sm tracking-wide border-b border-black">
                  Drawing/Design Error Rate (Tingkat Kesalahan Design)
                </div>

                {/* Mobile Cards: Design Error Rate */}
                <div className="md:hidden p-2.5 space-y-2.5 bg-slate-50">
                  {recapProjects.length === 0 ? (
                    <div className="p-4 text-center italic text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                      Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                    </div>
                  ) : (
                    recapProjects.map((p, i) => {
                      const item = reviewErrorList.find((e) => e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === designMonth);
                      const totalDrawing = Number(p['Qty Drawing'] || 0);
                      const errorCount = item ? item.errors.length : 0;
                      const errRate = totalDrawing > 0 ? ((errorCount / totalDrawing) * 100).toFixed(1) : '0.0';
                      const delKey = `err_recap_${p.SPK || i}`;
                      return (
                        <div key={p.SPK || i} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 shadow-xs">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-slate-400">#{i + 1} • {p.Customer}</span>
                              <h4 className="text-xs font-extrabold text-slate-900">{p['Nama Project']}</h4>
                            </div>
                            <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-mono text-[11px] font-bold shrink-0">
                              {errRate}%
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[11px] bg-rose-50/40 p-2 rounded-lg border border-rose-200/70 font-mono">
                            <div>
                              <span className="block text-[10px] font-sans text-slate-500">Total Drawing</span>
                              <strong className="text-slate-900">{totalDrawing}</strong>
                            </div>
                            <div>
                              <span className="block text-[10px] font-sans text-slate-500">Revisi / Error</span>
                              <strong className={errorCount > 0 ? 'text-rose-600' : 'text-slate-700'}>
                                {errorCount > 0 ? `${errorCount} revisi` : '0'}
                              </strong>
                            </div>
                          </div>
                          {!isReadOnly && (
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                onClick={() => {
                                  setErrorModalProject(p);
                                  setModalPartNameInput('');
                                  setModalFeedbackErrorInput('');
                                }}
                                className="flex-1 min-h-[42px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                              >
                                Kelola Error Drawing
                              </button>
                              {canDelete && (
                                confirmDeleteKey === delKey ? (
                                  <div className="flex items-center gap-1">
                                    <button
                                      onClick={() => {
                                        const updated = reviewErrorList.filter((e) => !(e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === designMonth));
                                        onUpdateReviewError(updated);
                                        setConfirmDeleteKey(null);
                                      }}
                                      className="min-h-[42px] px-3 bg-rose-600 text-white rounded-xl text-xs font-bold"
                                    >
                                      Ya
                                    </button>
                                    <button
                                      onClick={() => setConfirmDeleteKey(null)}
                                      className="min-h-[42px] px-3 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmDeleteKey(delKey)}
                                    className="min-h-[42px] px-4 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                                  >
                                    Hapus
                                  </button>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs bg-white">
                    <thead>
                      <tr className="bg-white text-black text-center font-bold">
                        <th className="p-2 border border-black w-12" rowSpan={2}>No</th>
                        <th className="p-2 border border-black min-w-[180px]" rowSpan={2}>Customer</th>
                        <th className="p-2 border border-black min-w-[220px]" rowSpan={2}>Nama Project</th>
                        <th className="p-2 border border-black" colSpan={2}>Review Design</th>
                        <th className="p-2 border border-black w-32" rowSpan={2}>Efisiensi (%)</th>
                        <th className="p-2 border border-black w-36" rowSpan={2}>Aksi</th>
                      </tr>
                      <tr className="bg-white text-black text-center font-bold">
                        <th className="p-2 border border-black min-w-[140px]">Total Drawing</th>
                        <th className="p-2 border border-black min-w-[180px]">Revisi Drawing/Design</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-black text-black">
                      {recapProjects.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-4 text-center italic text-slate-500 border border-black">
                            Tidak ada data proyek di dashboard monitoring pada bulan {designMonth}.
                          </td>
                        </tr>
                      ) : (
                        recapProjects.map((p, i) => {
                          const item = reviewErrorList.find((e) => e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === designMonth);
                          const totalDrawing = Number(p['Qty Drawing'] || 0);
                          const errorCount = item ? item.errors.length : 0;
                          const errRate = totalDrawing > 0 ? ((errorCount / totalDrawing) * 100).toFixed(1) : '0.0';

                          return (
                            <tr key={p.SPK || i} className="hover:bg-red-50/40">
                              <td className="p-2 text-center border border-black font-semibold">{i + 1}</td>
                              <td className="p-2 border border-black font-medium">{p.Customer}</td>
                              <td className="p-2 border border-black font-medium">{p['Nama Project']}</td>
                              <td className="p-2 border border-black text-center font-mono font-semibold">
                                {totalDrawing}
                              </td>
                              <td className="p-2 border border-black text-center font-mono font-semibold">
                                {errorCount > 0 ? (
                                  <span className="text-rose-600 font-bold">{errorCount} revisi</span>
                                ) : (
                                  <span className="text-slate-400">0</span>
                                )}
                              </td>
                              <td className="p-2 border border-black text-center font-mono font-bold text-rose-600">
                                {errRate}%
                              </td>
                              <td className="p-2 border border-black text-center">
                                {isReadOnly ? (
                                  <span className="text-[11px] text-slate-400 font-semibold">Read-Only</span>
                                ) : (
                                  <div className="flex items-center justify-center space-x-1.5">
                                    <button
                                      onClick={() => {
                                        setErrorModalProject(p);
                                        setModalPartNameInput('');
                                        setModalFeedbackErrorInput('');
                                      }}
                                      className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-semibold shadow-sm transition"
                                    >
                                      Edit
                                    </button>
                                    {canDelete && (
                                      confirmDeleteKey === `err_table_${p.SPK || i}` ? (
                                        <div className="flex items-center space-x-1">
                                          <button
                                            onClick={() => {
                                              const updated = reviewErrorList.filter((e) => !(e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === designMonth));
                                              onUpdateReviewError(updated);
                                              setConfirmDeleteKey(null);
                                            }}
                                            className="px-2 py-1 bg-rose-600 text-white rounded text-[10px] font-bold"
                                          >
                                            Ya
                                          </button>
                                          <button
                                            onClick={() => setConfirmDeleteKey(null)}
                                            className="px-2 py-1 bg-slate-200 text-slate-700 rounded text-[10px] font-semibold"
                                          >
                                            Batal
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setConfirmDeleteKey(`err_table_${p.SPK || i}`)}
                                          className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold shadow-sm transition"
                                        >
                                          Hapus
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                      {/* Baris kosong pelengkap visual tabel */}
                      {Array.from({ length: Math.max(0, 19 - recapProjects.length) }).map((_, idx) => (
                        <tr key={`blank-err-${idx}`} className="h-7 text-black">
                          <td className="p-2 text-center border border-black font-semibold text-slate-400">{recapProjects.length + idx + 1}</td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                          <td className="p-2 border border-black"></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Sub-bar keterangan dari format foto */}
                <div className="border-t-2 border-b-2 border-black bg-slate-50 py-1.5 px-3 text-center text-xs font-semibold text-slate-700 italic">
                  (Total semua Drawing Setiap Bulan/total drawing yang turun ke produksi)
                </div>

                {/* Formula Footer Design Error Rate */}
                <div className="bg-white p-3 space-y-3 text-xs text-black">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex items-center space-x-2 font-serif text-[13px]">
                      <span className="font-bold">Formula</span>
                      <span className="font-bold">=</span>
                      <div className="inline-flex flex-col items-center text-center">
                        <span className="border-b border-black px-2 pb-0.5 font-medium">Total kasus drawing error/revisi yang di temukan di produksi</span>
                        <span className="pt-0.5 font-medium">total Drawing yang turun ke produksi</span>
                      </div>
                      <span className="font-bold">x100%</span>
                    </div>
                    <div className="font-bold text-sm bg-slate-50 px-3 py-1.5 rounded border border-black">
                      Target = ≤ 2%
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#dc2626] bg-red-600 text-white font-bold text-center text-sm border border-black tracking-wide">
                    Design Error Rate = {calculatedCategoryScore}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 5: REVIEW COST (MANAGER & SUPERVISOR) */}
      {activeTab === 'reviewCost' && canAccessFullKpiCdr && (
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-amber-500 shrink-0" />
                <span>Dashboard Review Cost Engineering</span>
              </h3>
              <p className="text-xs text-slate-500">
                Kelola anggaran vs rincian pengeluaran per project (Sumber data Efisiensi Biaya Desain)
              </p>
            </div>
            <div className="flex items-center justify-between sm:justify-start space-x-2 w-full md:w-auto">
              <label className="text-xs font-semibold text-slate-600 shrink-0">Pilih Bulan:</label>
              <select
                value={costMonth}
                onChange={(e) => setCostMonth(e.target.value)}
                className="flex-1 sm:flex-none text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 min-h-[42px] sm:min-h-0 font-semibold text-amber-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
              >
                {MONTH_NAMES.map((m) => (
                  <option key={m} value={MONTH_FULL_NAMES[m]}>{MONTH_FULL_NAMES[m]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-2 border-black rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Title Bar matching Review_Cost_Engineering.png */}
            <div className="bg-[#facc15] bg-amber-400 text-black py-2.5 px-4 text-center font-bold text-sm tracking-wide border-b border-black">
              Dashboard Review Cost Engineering
            </div>

            {/* Mobile Cards for Review Cost */}
            <div className="md:hidden p-2.5 space-y-2.5 bg-slate-50">
              {costProjects.length === 0 ? (
                <div className="p-4 text-center italic text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                  Tidak ada data proyek di bulan {costMonth}.
                </div>
              ) : (
                costProjects.map((p, pIdx) => {
                  const entry = reviewCostList.find((c) => c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === costMonth);
                  const anggaran = entry?.anggaran || 0;
                  const pengeluaran = entry?.pengeluaran || [];
                  const totalExp = pengeluaran.reduce((s, x) => s + x.amount, 0);
                  return (
                    <div key={p.SPK || pIdx} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2.5 shadow-xs">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-400">#{pIdx + 1} • {p.Customer}</span>
                          <h4 className="text-xs font-extrabold text-slate-900">{p['Nama Project']}</h4>
                        </div>
                        <span className="px-2 py-0.5 rounded-lg bg-yellow-100 border border-yellow-300 font-mono text-[11px] font-bold text-slate-900 shrink-0">
                          Rp {totalExp.toLocaleString('id-ID')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs bg-amber-50/50 px-2.5 py-2 rounded-lg border border-amber-200/70">
                        <span className="text-slate-600 font-semibold">Anggaran Design</span>
                        <span className="font-mono font-bold text-slate-900">
                          Rp {anggaran > 0 ? anggaran.toLocaleString('id-ID') : '0'}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold uppercase text-slate-400 block">
                          Rincian Pengeluaran ({pengeluaran.length})
                        </span>
                        {pengeluaran.length === 0 ? (
                          <p className="text-[11px] text-slate-400 italic">Belum ada rincian pengeluaran</p>
                        ) : (
                          <div className="space-y-1">
                            {pengeluaran.map((exp) => (
                              <div key={exp.id} className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200">
                                <span className="font-medium text-slate-800 truncate pr-2">{exp.desc}</span>
                                <div className="flex items-center space-x-2 shrink-0">
                                  <span className="font-mono font-bold text-slate-900">Rp {exp.amount.toLocaleString('id-ID')}</span>
                                  {!isReadOnly && canDelete && (
                                    <button
                                      onClick={() => {
                                        const updated = reviewCostList.map((c) => {
                                          if (c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === costMonth) {
                                            return { ...c, pengeluaran: c.pengeluaran.filter((x) => x.id !== exp.id) };
                                          }
                                          return c;
                                        });
                                        onUpdateReviewCost(updated);
                                      }}
                                      className="text-rose-500 hover:text-rose-700 font-bold px-1"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {!isReadOnly && (
                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button
                            onClick={() => {
                              setCostModalProject(p);
                              setModalAnggaranInput(anggaran ? String(anggaran) : '10000000');
                              setModalExpenseDescInput('');
                              setModalExpenseAmountInput('');
                            }}
                            className="min-h-[42px] bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
                          >
                            + Tambah Biaya
                          </button>
                          <button
                            onClick={() => {
                              setModalSubmitNotice(null);
                              setCostModalProject(p);
                              setModalAnggaranInput(anggaran ? String(anggaran) : '10000000');
                              setModalExpenseDescInput('');
                              setModalExpenseAmountInput('');
                            }}
                            className="min-h-[42px] bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold"
                          >
                            Edit Anggaran
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs bg-white">
                <thead>
                  <tr className="bg-[#dcfce7] text-black text-center font-bold border-b border-black">
                    <th className="p-2 border border-black w-12">No</th>
                    <th className="p-2 border border-black min-w-[180px]">Customer</th>
                    <th className="p-2 border border-black min-w-[200px]">Nama Project</th>
                    <th className="p-2 border border-black min-w-[200px]">Anggaran Design</th>
                    <th className="p-2 border border-black min-w-[300px]">Pengeluaran Design</th>
                    <th className="p-2 border border-black min-w-[180px]">Total</th>
                    <th className="p-2 border border-black w-36">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black text-black">
                  {costProjects.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-4 text-center italic text-slate-500 border border-black">
                        Tidak ada data proyek di bulan {costMonth}.
                      </td>
                    </tr>
                  ) : (
                    costProjects.map((p, pIdx) => {
                      const entry = reviewCostList.find((c) => c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === costMonth);
                      const anggaran = entry?.anggaran || 0;
                      const pengeluaran = entry?.pengeluaran || [];
                      const totalExp = pengeluaran.reduce((s, x) => s + x.amount, 0);
                      const rowCount = Math.max(1, pengeluaran.length);

                      if (pengeluaran.length === 0) {
                        return (
                          <tr key={p.SPK || pIdx} className="hover:bg-amber-50/30">
                            <td className="p-2 text-center border border-black font-semibold">{pIdx + 1}</td>
                            <td className="p-2 border border-black font-medium">{p.Customer}</td>
                            <td className="p-2 border border-black font-medium">{p['Nama Project']}</td>
                            <td className="p-2 border border-black">
                              <div className="flex justify-between items-center font-mono font-semibold px-1">
                                <span>Rp</span>
                                <span>{anggaran > 0 ? anggaran.toLocaleString('id-ID') : '0,00'}</span>
                              </div>
                            </td>
                            <td className="p-2 border border-black text-slate-400 italic text-[11px]">
                              Belum ada rincian pengeluaran
                            </td>
                            <td className="p-2 border border-black">
                              <div className="border-2 border-black p-1 text-right font-mono font-bold bg-yellow-50/60">
                                <span>Rp {totalExp.toLocaleString('id-ID')},00</span>
                              </div>
                            </td>
                            <td className="p-2 border border-black text-center">
                              {isReadOnly ? (
                                <span className="text-[11px] text-slate-400 font-semibold">Read-Only</span>
                              ) : (
                                <div className="flex items-center justify-center space-x-1">
                                  <button
                                    onClick={() => {
                                      setCostModalProject(p);
                                      setModalAnggaranInput(anggaran ? String(anggaran) : '10000000');
                                      setModalExpenseDescInput('');
                                      setModalExpenseAmountInput('');
                                    }}
                                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold transition"
                                  >
                                    + Tambah Biaya
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      return pengeluaran.map((exp, expIdx) => {
                        const isFirst = expIdx === 0;
                        const isLast = expIdx === pengeluaran.length - 1;

                        return (
                          <tr key={exp.id || expIdx} className="hover:bg-amber-50/30">
                            {isFirst && (
                              <>
                                <td className="p-2 text-center border border-black font-semibold align-top" rowSpan={rowCount}>
                                  {pIdx + 1}
                                </td>
                                <td className="p-2 border border-black font-medium align-top" rowSpan={rowCount}>
                                  {p.Customer}
                                </td>
                                <td className="p-2 border border-black font-medium align-top" rowSpan={rowCount}>
                                  {p['Nama Project']}
                                </td>
                                <td className="p-2 border border-black align-top" rowSpan={rowCount}>
                                  <div className="flex justify-between items-center font-mono font-semibold px-1">
                                    <span>Rp</span>
                                    <span>{anggaran > 0 ? anggaran.toLocaleString('id-ID') : '0,00'}</span>
                                  </div>
                                </td>
                              </>
                            )}

                            {/* Pengeluaran Design: Keterangan | Nominal */}
                            <td className="p-2 border border-black">
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-medium text-slate-800">{exp.desc}</span>
                                <div className="flex items-center space-x-2 font-mono font-semibold text-slate-900">
                                  <span>Rp {exp.amount.toLocaleString('id-ID')},00</span>
                                  {!isReadOnly && canDelete && (
                                    <button
                                      onClick={() => {
                                        const updated = reviewCostList.map((c) => {
                                          if (c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === costMonth) {
                                            return { ...c, pengeluaran: c.pengeluaran.filter((x) => x.id !== exp.id) };
                                          }
                                          return c;
                                        });
                                        onUpdateReviewCost(updated);
                                      }}
                                      className="text-rose-500 hover:text-rose-700 ml-1"
                                      title="Hapus rincian ini"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Total with thick border box at last row */}
                            <td className="p-2 border border-black align-bottom">
                              {isLast ? (
                                <div className="border-2 border-black p-1 text-right font-mono font-bold bg-yellow-50/80">
                                  <span>Rp {totalExp.toLocaleString('id-ID')},00</span>
                                </div>
                              ) : null}
                            </td>

                            {isFirst && (
                              <td className="p-2 border border-black text-center align-middle" rowSpan={rowCount}>
                                {isReadOnly ? (
                                  <span className="text-[11px] text-slate-400 font-semibold">Read-Only</span>
                                ) : (
                                  <div className="flex flex-col items-center justify-center space-y-1">
                                    <button
                                      onClick={() => {
                                        setCostModalProject(p);
                                        setModalAnggaranInput(anggaran ? String(anggaran) : '10000000');
                                        setModalExpenseDescInput('');
                                        setModalExpenseAmountInput('');
                                      }}
                                      className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-semibold w-full transition"
                                    >
                                      + Tambah Biaya
                                    </button>
                                    <button
                                      onClick={() => {
                                        setModalSubmitNotice(null);
                                        setCostModalProject(p);
                                        setModalAnggaranInput(anggaran ? String(anggaran) : '10000000');
                                        setModalExpenseDescInput('');
                                        setModalExpenseAmountInput('');
                                      }}
                                      className="px-2 py-0.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-semibold w-full transition"
                                    >
                                      Edit Anggaran
                                    </button>
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      });
                    })
                  )}

                  {/* Blank rows filling up to 15 rows like photo */}
                  {Array.from({ length: Math.max(0, 15 - costProjects.length) }).map((_, idx) => (
                    <tr key={`blank-rcost-${idx}`} className="h-7 text-black">
                      <td className="p-2 text-center border border-black font-semibold text-slate-400">{costProjects.length + idx + 1}</td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 6: REVIEW ERROR (MANAGER & SUPERVISOR) */}
      {activeTab === 'reviewError' && canAccessFullKpiCdr && (
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 sm:gap-4 pb-3 sm:pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Dashboard Review Drawing & Design Error</span>
              </h3>
              <p className="text-xs text-slate-500">
                Pencatatan rincian kesalahan drawing yang ditemukan saat trial atau produksi manufaktur
              </p>
            </div>
            <div className="flex items-center justify-between sm:justify-start space-x-2 w-full md:w-auto">
              <label className="text-xs font-semibold text-slate-600 shrink-0">Pilih Bulan:</label>
              <select
                value={errorMonth}
                onChange={(e) => setErrorMonth(e.target.value)}
                className="flex-1 sm:flex-none text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 min-h-[42px] sm:min-h-0 font-semibold text-rose-700 focus:ring-2 focus:ring-rose-500 focus:outline-none"
              >
                {MONTH_NAMES.map((m) => (
                  <option key={m} value={MONTH_FULL_NAMES[m]}>{MONTH_FULL_NAMES[m]}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-2 border-black rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Title Bar matching Review_Drawing___Design_Error.png */}
            <div className="bg-[#dc2626] bg-red-600 text-white py-2.5 px-4 text-center font-bold text-sm tracking-wide border-b border-black">
              Review Drawing/Design Error
            </div>

            {/* Mobile Cards for Review Error */}
            <div className="md:hidden p-2.5 space-y-2.5 bg-slate-50">
              {errorProjects.length === 0 ? (
                <div className="p-4 text-center italic text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
                  Tidak ada data proyek di bulan {errorMonth}.
                </div>
              ) : (
                <>
                  {errorProjects.map((p, pIdx) => {
                    const entry = reviewErrorList.find((e) => e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === errorMonth);
                    const errors = entry?.errors || [];
                    const delKey = `rerr_mob_${p.SPK || pIdx}`;
                    return (
                      <div key={p.SPK || pIdx} className="bg-white rounded-xl border border-slate-200 p-3 space-y-2.5 shadow-xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <span className="text-[10px] font-bold text-slate-400">#{pIdx + 1} • {p.Customer}</span>
                            <h4 className="text-xs font-extrabold text-slate-900">{p['Nama Project']}</h4>
                          </div>
                          <div className="flex items-center space-x-1.5 shrink-0">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[10px] font-bold text-slate-700">
                              Qty: {p['Qty Drawing'] || 0}
                            </span>
                            <span className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold ${
                              errors.length > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                            }`}>
                              {errors.length} Err
                            </span>
                          </div>
                        </div>

                        {errors.length === 0 ? (
                          <p className="text-[11px] text-emerald-700 font-semibold italic bg-emerald-50/60 px-2.5 py-1.5 rounded-lg border border-emerald-200">
                            ✓ Zero Error (Tidak Ada Revisi)
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {errors.map((err, errIdx) => (
                              <div key={err.id || errIdx} className="p-2 bg-rose-50/40 rounded-lg border border-rose-200/80 flex items-start justify-between gap-2 text-[11px]">
                                <div>
                                  <span className="font-bold text-slate-800">{errIdx + 1}. {err.partName}</span>
                                  <p className="text-slate-600 mt-0.5">{err.feedback}</p>
                                </div>
                                {!isReadOnly && canDelete && (
                                  <button
                                    onClick={() => {
                                      const updated = reviewErrorList.map((e) => {
                                        if (e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === errorMonth) {
                                          return { ...e, errors: e.errors.filter((x) => x.id !== err.id) };
                                        }
                                        return e;
                                      });
                                      onUpdateReviewError(updated);
                                    }}
                                    className="text-rose-600 font-bold px-1.5 py-0.5"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {!isReadOnly && (
                          <div className="flex items-center gap-2 pt-1">
                            <button
                              onClick={() => {
                                setErrorModalProject(p);
                                setModalPartNameInput('');
                                setModalFeedbackErrorInput('');
                              }}
                              className="flex-1 min-h-[42px] bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
                            >
                              + Tambah Error
                            </button>
                            {canDelete && errors.length > 0 && (
                              confirmDeleteKey === delKey ? (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => {
                                      const updated = reviewErrorList.filter((e) => !(e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === errorMonth));
                                      onUpdateReviewError(updated);
                                      setConfirmDeleteKey(null);
                                    }}
                                    className="min-h-[42px] px-3 bg-rose-600 text-white rounded-xl text-xs font-bold"
                                  >
                                    Ya
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteKey(null)}
                                    className="min-h-[42px] px-3 bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                                  >
                                    Batal
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteKey(delKey)}
                                  className="min-h-[42px] px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold"
                                >
                                  Hapus Semua
                                </button>
                              )
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Mobile Summary Bar */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-red-600 text-white p-2.5 rounded-xl text-center">
                      <span className="block text-[10px] font-semibold opacity-90">Total Qty Drawing</span>
                      <span className="font-mono font-extrabold text-sm">
                        {errorProjects.reduce((s, p) => s + Number(p['Qty Drawing'] || 0), 0)}
                      </span>
                    </div>
                    <div className="bg-red-600 text-white p-2.5 rounded-xl text-center">
                      <span className="block text-[10px] font-semibold opacity-90">Total Revisi Bulan Ini</span>
                      <span className="font-mono font-extrabold text-sm">
                        {errorProjects.reduce((s, p) => {
                          const entry = reviewErrorList.find((e) => e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === errorMonth);
                          return s + (entry ? entry.errors.length : 0);
                        }, 0)}
                      </span>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs bg-white">
                <thead>
                  {/* Tier 1 Header */}
                  <tr className="bg-[#fed7aa] text-black text-center font-bold">
                    <th className="p-2 border border-black w-12" rowSpan={3}>No</th>
                    <th className="p-2 border border-black min-w-[170px]" rowSpan={3}>Customer</th>
                    <th className="p-2 border border-black min-w-[190px]" rowSpan={3}>Nama Project</th>
                    <th className="p-2 border border-black w-24" rowSpan={3}>Qty Drawing</th>
                    <th className="p-2 border border-black bg-[#bae6fd]" colSpan={4}>Review Design</th>
                    <th className="p-2 border border-black w-36" rowSpan={3}>Aksi</th>
                  </tr>
                  {/* Tier 2 Header */}
                  <tr className="bg-[#e0f2fe] text-black text-center font-bold">
                    <th className="p-2 border border-black" colSpan={4}>Revisi Drawing/Design</th>
                  </tr>
                  {/* Tier 3 Header */}
                  <tr className="bg-[#dcfce7] text-black text-center font-bold">
                    <th className="p-1.5 border border-black w-12">NO</th>
                    <th className="p-1.5 border border-black min-w-[150px]">Part Name</th>
                    <th className="p-1.5 border border-black min-w-[220px]">Feedback Drawing/Design</th>
                    <th className="p-1.5 border border-black min-w-[160px]">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black text-black">
                  {errorProjects.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-4 text-center italic text-slate-500 border border-black">
                        Tidak ada data proyek di bulan {errorMonth}.
                      </td>
                    </tr>
                  ) : (
                    errorProjects.map((p, pIdx) => {
                      const entry = reviewErrorList.find((e) => e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === errorMonth);
                      const errors = entry?.errors || [];
                      const rowCount = Math.max(1, errors.length);

                      if (errors.length === 0) {
                        return (
                          <tr key={p.SPK || pIdx} className="hover:bg-red-50/20">
                            <td className="p-2 text-center border border-black font-semibold">{pIdx + 1}</td>
                            <td className="p-2 border border-black font-medium">{p.Customer}</td>
                            <td className="p-2 border border-black font-medium">{p['Nama Project']}</td>
                            <td className="p-2 border border-black text-center font-bold font-mono">{p['Qty Drawing'] || 0}</td>
                            <td className="p-2 border border-black text-center text-slate-400">-</td>
                            <td className="p-2 border border-black text-slate-400 italic text-[11px]">-</td>
                            <td className="p-2 border border-black text-emerald-700 italic font-semibold text-[11px]">
                              Zero Error (Tidak Ada Revisi)
                            </td>
                            <td className="p-2 border border-black">
                              <div className="border-2 border-black p-1 text-center font-mono font-bold bg-[#fef08a] text-black text-[11px]">
                                0
                              </div>
                            </td>
                            <td className="p-2 border border-black text-center">
                              {isReadOnly ? (
                                <span className="text-[11px] text-slate-400 font-semibold">Read-Only</span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setErrorModalProject(p);
                                    setModalPartNameInput('');
                                    setModalFeedbackErrorInput('');
                                  }}
                                  className="px-2 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-semibold transition"
                                >
                                  + Tambah Error
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      }

                      return errors.map((err, errIdx) => {
                        const isFirst = errIdx === 0;
                        const isLast = errIdx === errors.length - 1;

                        return (
                          <tr key={err.id || errIdx} className="hover:bg-red-50/20">
                            {isFirst && (
                              <>
                                <td className="p-2 text-center border border-black font-semibold align-top" rowSpan={rowCount}>
                                  {pIdx + 1}
                                </td>
                                <td className="p-2 border border-black font-medium align-top" rowSpan={rowCount}>
                                  {p.Customer}
                                </td>
                                <td className="p-2 border border-black font-medium align-top" rowSpan={rowCount}>
                                  {p['Nama Project']}
                                </td>
                                <td className="p-2 border border-black text-center font-bold font-mono align-top" rowSpan={rowCount}>
                                  {p['Qty Drawing'] || 0}
                                </td>
                              </>
                            )}

                            {/* Sub-rows of error */}
                            <td className="p-2 border border-black text-center font-mono font-semibold">{errIdx + 1}</td>
                            <td className="p-2 border border-black font-medium text-slate-800">{err.partName}</td>
                            <td className="p-2 border border-black text-slate-700">
                              <div className="flex justify-between items-center">
                                <span>{err.feedback}</span>
                                {!isReadOnly && canDelete && (
                                  <button
                                    onClick={() => {
                                      const updated = reviewErrorList.map((e) => {
                                        if (e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === errorMonth) {
                                          return { ...e, errors: e.errors.filter((x) => x.id !== err.id) };
                                        }
                                        return e;
                                      });
                                      onUpdateReviewError(updated);
                                    }}
                                    className="text-rose-500 hover:text-rose-700 ml-2"
                                    title="Hapus error ini"
                                  >
                                    ×
                                  </button>
                                )}
                              </div>
                            </td>

                            {/* Total Box per customer */}
                            <td className="p-2 border border-black align-bottom">
                              {isLast ? (
                                <div className="border-2 border-black p-1 text-center font-mono font-bold bg-[#fef08a] text-black text-[11px] leading-tight">
                                  <span>{errors.length}</span>
                                  <span className="block text-[9px] font-normal text-slate-700">(total drawing yang direvisi per kastamer)</span>
                                </div>
                              ) : null}
                            </td>

                            {isFirst && (
                              <td className="p-2 border border-black text-center align-middle" rowSpan={rowCount}>
                                {isReadOnly ? (
                                  <span className="text-[11px] text-slate-400 font-semibold">Read-Only</span>
                                ) : (
                                  <div className="flex flex-col items-center justify-center space-y-1">
                                    <button
                                      onClick={() => {
                                        setErrorModalProject(p);
                                        setModalPartNameInput('');
                                        setModalFeedbackErrorInput('');
                                      }}
                                      className="px-2 py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded text-[10px] font-semibold w-full transition"
                                    >
                                      + Tambah Error
                                    </button>
                                    {canDelete && (
                                      confirmDeleteKey === `rerr_tbl_${p.SPK || pIdx}` ? (
                                        <div className="flex items-center justify-center space-x-1">
                                          <button
                                            onClick={() => {
                                              const updated = reviewErrorList.filter((e) => !(e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === errorMonth));
                                              onUpdateReviewError(updated);
                                              setConfirmDeleteKey(null);
                                            }}
                                            className="px-2 py-0.5 bg-rose-600 text-white rounded text-[10px] font-bold"
                                          >
                                            Ya
                                          </button>
                                          <button
                                            onClick={() => setConfirmDeleteKey(null)}
                                            className="px-2 py-0.5 bg-slate-200 text-slate-700 rounded text-[10px] font-semibold"
                                          >
                                            Batal
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          onClick={() => setConfirmDeleteKey(`rerr_tbl_${p.SPK || pIdx}`)}
                                          className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-semibold w-full transition"
                                        >
                                          Hapus Semua
                                        </button>
                                      )
                                    )}
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    })
                  )}

                  {/* Blank rows filling up to 15 rows like photo */}
                  {Array.from({ length: Math.max(0, 15 - errorProjects.length) }).map((_, idx) => (
                    <tr key={`blank-rerr-${idx}`} className="h-7 text-black">
                      <td className="p-2 text-center border border-black font-semibold text-slate-400">{errorProjects.length + idx + 1}</td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                      <td className="p-2 border border-black"></td>
                    </tr>
                  ))}

                  {/* Bottom Summary Row from Screenshot */}
                  <tr className="bg-slate-50 font-bold border-t-2 border-black">
                    <td colSpan={3} className="p-2 border border-black text-center uppercase tracking-wider text-xs">
                      Total
                    </td>
                    <td className="p-1 border border-black text-center">
                      <div className="bg-[#dc2626] bg-red-600 text-white font-bold py-1 px-2 font-mono text-center">
                        {errorProjects.reduce((s, p) => s + Number(p['Qty Drawing'] || 0), 0)}
                      </div>
                    </td>
                    <td colSpan={3} className="p-2 border border-black text-right text-xs">
                      Total Seluruh Drawing Revisi Bulan Ini:
                    </td>
                    <td className="p-1 border border-black text-center">
                      <div className="bg-[#dc2626] bg-red-600 text-white font-bold py-1 px-2 font-mono text-center">
                        {errorProjects.reduce((s, p) => {
                          const entry = reviewErrorList.find((e) => e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === errorMonth);
                          return s + (entry ? entry.errors.length : 0);
                        }, 0)}
                      </div>
                    </td>
                    <td className="p-2 border border-black"></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 7: ANALISIS Q1 - Q4 */}
      {activeTab === 'quarterly' && (
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 sm:space-y-6">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Analisis Kuartalan (Q1 – Q4) KPI {activeYear}</h3>
            <p className="text-xs text-slate-500">Evaluasi pencapaian performa departemen engineering per kuartal</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-slate-50 p-3.5 sm:p-5 rounded-2xl border border-slate-200 flex flex-col">
              <h4 className="text-xs font-bold text-slate-700 mb-3 sm:mb-4 flex items-center space-x-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <span>Grafik Komparasi Kuartalan Q1 - Q4</span>
              </h4>
              <div className="relative flex-grow w-full h-56 sm:h-72">
                <canvas ref={quarterlyChartRef} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-emerald-50/60 p-3.5 sm:p-5 rounded-2xl border border-emerald-200 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Kuartal 1 (Jan - Mar)</span>
                  <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 sm:mt-2">94%</h4>
                </div>
                <span className="text-[11px] sm:text-xs text-emerald-700 font-semibold bg-emerald-100 px-2.5 py-1 rounded-full w-max mt-3 sm:mt-4">
                  Selesai Evaluasi
                </span>
              </div>

              <div className="bg-blue-50/60 p-3.5 sm:p-5 rounded-2xl border border-blue-200 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-blue-800 uppercase tracking-wider">Kuartal 2 (Apr - Jun)</span>
                  <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 sm:mt-2">95%</h4>
                </div>
                <span className="text-[11px] sm:text-xs text-blue-700 font-semibold bg-blue-100 px-2.5 py-1 rounded-full w-max mt-3 sm:mt-4">
                  Selesai Evaluasi
                </span>
              </div>

              <div className="bg-amber-50/60 p-3.5 sm:p-5 rounded-2xl border border-amber-200 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-amber-800 uppercase tracking-wider">Kuartal 3 (Jul - Sep)</span>
                  <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 sm:mt-2">93%</h4>
                </div>
                <span className="text-[11px] sm:text-xs text-amber-700 font-semibold bg-amber-100 px-2.5 py-1 rounded-full w-max mt-3 sm:mt-4">
                  Selesai Evaluasi
                </span>
              </div>

              <div className="bg-purple-50/60 p-3.5 sm:p-5 rounded-2xl border border-purple-200 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-purple-800 uppercase tracking-wider">Kuartal 4 (Okt - Des)</span>
                  <h4 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1.5 sm:mt-2">96%</h4>
                </div>
                <span className="text-[11px] sm:text-xs text-purple-700 font-semibold bg-purple-100 px-2.5 py-1 rounded-full w-max mt-3 sm:mt-4">
                  Sedang Berjalan
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 8: PERSETUJUAN MANAGER (ANTREAN PENGAJUAN SUPERVISOR) */}
      {activeTab === 'approvals' && (
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4 sm:space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 sm:pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                <span>Antrean Persetujuan Manager (KPI Engineering CDR)</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Seluruh pengajuan input/perubahan data oleh Supervisor wajib disetujui oleh Manager sebelum masuk ke data resmi KPI.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              <span className="px-3 py-1.5 rounded-xl bg-amber-100 text-amber-800 text-xs font-bold">
                Menunggu: {pendingCount}
              </span>
              {isManager && reviewedApprovals.length > 0 && onClearReviewedApprovals && (
                confirmClearApprovals ? (
                  <div className="flex items-center space-x-1.5 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-xl">
                    <span className="text-[11px] font-semibold text-rose-800">Hapus riwayat?</span>
                    <button
                      onClick={() => {
                        onClearReviewedApprovals();
                        setConfirmClearApprovals(false);
                      }}
                      className="min-h-[36px] sm:min-h-0 px-2.5 py-1 sm:py-0.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold"
                    >
                      Ya
                    </button>
                    <button
                      onClick={() => setConfirmClearApprovals(false)}
                      className="min-h-[36px] sm:min-h-0 px-2.5 py-1 sm:py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-semibold"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmClearApprovals(true)}
                    className="min-h-[40px] sm:min-h-0 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                  >
                    Bersihkan Riwayat
                  </button>
                )
              )}
            </div>
          </div>

          {/* Pending Requests Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Menunggu Persetujuan Manager ({pendingCount})
            </h4>
            {pendingApprovals.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
                Tidak ada pengajuan perubahan yang sedang menunggu persetujuan.
              </div>
            ) : (
              <div className="space-y-3">
                {pendingApprovals.map((req) => (
                  <div
                    key={req.id}
                    className="p-3.5 sm:p-4 rounded-xl border border-amber-200 bg-amber-50/40 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold">
                          {req.categoryLabel}
                        </span>
                        <span className="text-xs font-bold text-slate-900">{req.targetLabel}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 text-[10px] font-semibold">
                          Menunggu Persetujuan
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                          <span className="text-[10px] font-semibold text-slate-400 block">Data Resmi Saat Ini:</span>
                          <span className="text-slate-700 font-medium">{req.summaryOld}</span>
                        </div>
                        <div className="p-2.5 bg-emerald-50/60 rounded-lg border border-emerald-200">
                          <span className="text-[10px] font-semibold text-emerald-700 block">Usulan Data Baru (Supervisor):</span>
                          <span className="text-emerald-950 font-bold">{req.summaryNew}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Diajukan oleh <strong className="text-slate-700">{req.requestedBy}</strong> • {req.requestedAt}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-shrink-0 w-full lg:w-auto">
                      {isManager ? (
                        rejectingRequestId === req.id ? (
                          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 bg-white border border-rose-300 p-2.5 rounded-xl shadow-sm w-full lg:w-auto">
                            <input
                              type="text"
                              value={rejectReasonInput}
                              onChange={(e) => setRejectReasonInput(e.target.value)}
                              placeholder="Alasan penolakan (opsional)..."
                              className="px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-base sm:text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-rose-500 w-full sm:w-48"
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  if (onRejectRequest) {
                                    onRejectRequest(req.id, rejectReasonInput.trim() || 'Perlu revisi data');
                                  }
                                  setRejectingRequestId(null);
                                  setRejectReasonInput('');
                                }}
                                className="flex-1 sm:flex-none min-h-[42px] sm:min-h-0 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold"
                              >
                                Konfirmasi Tolak
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingRequestId(null);
                                  setRejectReasonInput('');
                                }}
                                className="min-h-[42px] sm:min-h-0 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                              >
                                Batal
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => onApproveRequest && onApproveRequest(req.id)}
                              className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center space-x-1.5"
                            >
                              <Check className="w-4 h-4" />
                              <span>Setujui & Terapkan</span>
                            </button>
                            <button
                              onClick={() => {
                                setRejectingRequestId(req.id);
                                setRejectReasonInput('');
                              }}
                              className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center justify-center space-x-1.5"
                            >
                              <XCircle className="w-4 h-4" />
                              <span>Tolak</span>
                            </button>
                          </>
                        )
                      ) : (
                        <span className="px-3 py-2 bg-amber-100 text-amber-800 rounded-xl text-[11px] font-semibold border border-amber-300 text-center">
                          Menunggu Tinjauan Manager
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Reviewed History Section */}
          {reviewedApprovals.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Riwayat Persetujuan ({reviewedApprovals.length})
              </h4>

              {/* Mobile History Cards */}
              <div className="md:hidden space-y-2.5">
                {reviewedApprovals.map((req) => (
                  <div key={req.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">{req.categoryLabel}</span>
                        <span className="text-[11px] text-slate-500">{req.targetLabel}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                          req.status === 'approved'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {req.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 bg-white p-2 rounded-lg border border-slate-200">
                      {req.summaryNew}
                    </p>
                    <div className="flex flex-wrap justify-between gap-1 text-[11px] text-slate-500 pt-0.5">
                      <span>Pengaju: <strong className="text-slate-700">{req.requestedBy}</strong></span>
                      <span>{req.requestedAt}</span>
                    </div>
                    {req.reviewNote && (
                      <p className="text-[11px] text-slate-600 italic">
                        Catatan: {req.reviewNote} {req.reviewedAt ? `• ${req.reviewedAt}` : ''}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
                      <th className="p-2.5">Kategori & Target</th>
                      <th className="p-2.5">Perubahan Diajukan</th>
                      <th className="p-2.5">Pengaju</th>
                      <th className="p-2.5 text-center">Status</th>
                      <th className="p-2.5">Catatan Manager</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-700">
                    {reviewedApprovals.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50">
                        <td className="p-2.5">
                          <span className="font-bold text-slate-800 block">{req.categoryLabel}</span>
                          <span className="text-[11px] text-slate-500">{req.targetLabel}</span>
                        </td>
                        <td className="p-2.5 font-medium">{req.summaryNew}</td>
                        <td className="p-2.5 text-[11px]">
                          <span className="block font-semibold">{req.requestedBy}</span>
                          <span className="text-slate-400">{req.requestedAt}</span>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              req.status === 'approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {req.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                          </span>
                        </td>
                        <td className="p-2.5 text-[11px] text-slate-600">
                          {req.reviewNote || '-'}
                          {req.reviewedAt && <span className="block text-[10px] text-slate-400">{req.reviewedAt}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 9: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white p-3.5 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">Audit Trail & Log Perubahan KPI</h3>
            <p className="text-xs text-slate-500">
              Riwayat pencatatan aktivitas pembaruan nilai aktual dan otentikasi role
            </p>
          </div>

          {/* Mobile Audit Cards */}
          <div className="md:hidden space-y-2.5">
            {auditLogs.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-dashed border-slate-300 rounded-xl text-xs italic text-slate-400">
                Belum ada catatan audit log baru.
              </div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-800">{log.user}</span>
                    <span className="font-mono text-[10px] text-slate-500">{log.timestamp}</span>
                  </div>
                  <p className="text-xs text-slate-700">{log.activity}</p>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/70 text-[11px]">
                    <span className="font-semibold text-emerald-700">{log.month} {log.year}</span>
                    <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Nilai: {log.newValue}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[11px] tracking-wider">
                  <th className="p-3 w-40">Waktu (WIB)</th>
                  <th className="p-3 w-36">Pengguna & Role</th>
                  <th className="p-3">Aktivitas / Detail Perubahan</th>
                  <th className="p-3 w-24 text-center">Tahun</th>
                  <th className="p-3 w-28 text-center">Bulan</th>
                  <th className="p-3 w-32 text-center">Nilai Baru</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center italic text-slate-400">
                      Belum ada catatan audit log baru.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono text-[11px] text-slate-500">{log.timestamp}</td>
                      <td className="p-3 font-semibold text-slate-800">{log.user}</td>
                      <td className="p-3">{log.activity}</td>
                      <td className="p-3 text-center font-mono">{log.year}</td>
                      <td className="p-3 text-center font-semibold text-emerald-700">{log.month}</td>
                      <td className="p-3 text-center font-bold text-slate-900">{log.newValue}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: INPUT NILAI AKTUAL KPI */}
      {editModalItem && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-4 sm:p-6 border border-slate-200 space-y-4 max-h-[92dvh] overflow-y-auto pb-safe">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800">
                  Perbarui Nilai KPI: {editModalItem.objective}
                </h3>
                <p className="text-xs text-slate-500">
                  Tahun {activeYear} • Target: <strong className="text-emerald-700">{editModalItem.target}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditModalItem(null)}
                className="text-slate-400 hover:text-slate-600 min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1 text-xs">
              <p className="font-bold text-slate-700 flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 text-blue-600" />
                <span>Dasar Pengukuran:</span>
              </p>
              <p className="text-slate-600 whitespace-pre-line text-[11px]">
                {editModalItem.measurementBasis}
              </p>
              <p className="text-emerald-800 font-semibold pt-1 border-t border-slate-200 text-[11px]">
                {editModalItem.ruleDesc}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = editModalValue !== '' ? parseFloat(editModalValue) : null;
                if (isSupervisor && onSubmitApprovalRequest) {
                  const prevVal = editModalItem.months[editModalMonth];
                  onSubmitApprovalRequest({
                    category: 'kpi_actual',
                    categoryLabel: 'Input Nilai Aktual KPI',
                    targetLabel: `${editModalItem.objective} • ${MONTH_FULL_NAMES[editModalMonth] || editModalMonth} ${activeYear}`,
                    summaryOld: prevVal !== null && prevVal !== undefined ? `${prevVal} ${editModalItem.unit}` : 'Kosong',
                    summaryNew: val !== null ? `${val} ${editModalItem.unit}${editModalKet ? ` (${editModalKet})` : ''}` : 'Kosong',
                    payload: {
                      year: activeYear,
                      kpiId: editModalItem.id,
                      month: editModalMonth,
                      actualValue: val,
                      keterangan: editModalKet
                    }
                  });
                  setEditModalItem(null);
                  return;
                }
                onUpdateActual(activeYear, editModalItem.id, editModalMonth, val, editModalKet);
                setEditModalItem(null);
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Pilih Bulan</label>
                <select
                  value={editModalMonth}
                  onChange={(e) => {
                    const m = e.target.value;
                    setEditModalMonth(m);
                    setEditModalValue(editModalItem.months[m] !== null ? String(editModalItem.months[m]) : '');
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold"
                >
                  {MONTH_NAMES.map((m) => (
                    <option key={m} value={m}>{MONTH_FULL_NAMES[m]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nilai Aktual ({editModalItem.id === 7 ? 'Angka' : editModalItem.unit})
                </label>
                <input
                  type="number"
                  step="any"
                  value={editModalValue}
                  onChange={(e) => setEditModalValue(e.target.value)}
                  required
                  placeholder="Masukkan angka capaian aktual..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan / Catatan Manajerial</label>
                <input
                  type="text"
                  value={editModalKet}
                  onChange={(e) => setEditModalKet(e.target.value)}
                  placeholder="Cth: Peningkatan efisiensi berkat standardisasi CAD..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalItem(null)}
                  className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-1.5 ${
                    isSupervisor ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  <span>{isSupervisor ? 'Ajukan Persetujuan Manager' : 'Simpan Perubahan'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL REPORT */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 border border-slate-200 space-y-4 max-h-[92dvh] overflow-y-auto pb-safe">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center space-x-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <span>Kirim Laporan via Email (Gmail)</span>
              </h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="text-slate-400 hover:text-slate-600 min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Penerima (To)</label>
                <input
                  type="text"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subjek</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Isi Pesan</label>
                <textarea
                  rows={3}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowEmailModal(false)}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  setEmailSentMessage('Laporan KPI telah disiapkan untuk dikirim melalui Google Mail / MailApp API.');
                  setShowEmailModal(false);
                }}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center justify-center space-x-1.5"
              >
                <Mail className="w-4 h-4" />
                <span>Kirim Laporan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EXPORT MATRIKS */}
      {showExportModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-sm p-4 sm:p-6 border border-slate-200 space-y-4 max-h-[92dvh] overflow-y-auto pb-safe">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-sm sm:text-base font-bold text-slate-800">Ekspor Laporan Resmi KPI</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-slate-400 hover:text-slate-600 min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2">
              <button
                onClick={handleExportMatrixExcel}
                className="flex flex-col items-center justify-center min-h-[110px] p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg mb-2 shadow">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <span className="font-bold text-emerald-900 text-xs">Format Excel</span>
                <span className="text-[10px] text-emerald-700">.xlsx Spreadsheet</span>
              </button>

              <button
                onClick={handleExportMatrixPDF}
                className="flex flex-col items-center justify-center min-h-[110px] p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center text-lg mb-2 shadow">
                  <FileDown className="w-5 h-5" />
                </div>
                <span className="font-bold text-rose-900 text-xs">Format PDF</span>
                <span className="text-[10px] text-rose-700">Matriks Resmi A4</span>
              </button>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowExportModal(false)}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT FEEDBACK DESIGN QUALITY (CATEGORY 1) */}
      {feedbackModalProject && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-4 sm:p-6 border border-slate-200 space-y-4 max-h-[92dvh] overflow-y-auto pb-safe">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Edit Feedback Design Quality
                </h3>
                <p className="text-xs text-slate-500">
                  {feedbackModalProject.Customer} • {feedbackModalProject['Nama Project']} ({designMonth})
                </p>
              </div>
              <button
                onClick={() => setFeedbackModalProject(null)}
                className="text-slate-400 hover:text-slate-600 min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  FeedBack dr Team Produksi
                </label>
                <textarea
                  rows={2}
                  value={modalFbProduksi}
                  onChange={(e) => setModalFbProduksi(e.target.value)}
                  placeholder="Ketik feedback dari tim produksi jika ada revisi..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  FeedBack dr Team Kastamer
                </label>
                <textarea
                  rows={2}
                  value={modalFbKastamer}
                  onChange={(e) => setModalFbKastamer(e.target.value)}
                  placeholder="Ketik feedback dari tim kastamer jika ada revisi..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200 text-[11px] text-amber-900">
                💡 <strong>Catatan Formula:</strong> Jika kedua kolom feedback dikosongkan, proyek ini secara otomatis berstatus <strong>Approve ✓</strong> dan dihitung memenuhi target Design Quality (≥ 90%).
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setFeedbackModalProject(null)}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const fbProd = modalFbProduksi.trim();
                  const fbKast = modalFbKastamer.trim();
                  const isClean = !fbProd && !fbKast;
                  const newFeedbackItem: DesignFeedbackItem = {
                    month: designMonth,
                    customer: feedbackModalProject.Customer,
                    projectName: feedbackModalProject['Nama Project'],
                    fbProduksi: fbProd,
                    fbKastamer: fbKast,
                    isNoRevision: isClean
                  };

                  if (isSupervisor && onSubmitApprovalRequest) {
                    const existingFb = feedbackList.find(
                      (f) =>
                        f.customer === feedbackModalProject.Customer &&
                        f.projectName === feedbackModalProject['Nama Project'] &&
                        f.month === designMonth
                    );
                    onSubmitApprovalRequest({
                      category: 'design_quality_feedback',
                      categoryLabel: '1. Design Quality Feedback',
                      targetLabel: `${designMonth} • ${feedbackModalProject.Customer} - ${feedbackModalProject['Nama Project']}`,
                      summaryOld: existingFb
                        ? `Produksi: "${existingFb.fbProduksi || '-'}" | Kastamer: "${existingFb.fbKastamer || '-'}"`
                        : 'Belum ada feedback (Approve)',
                      summaryNew: `Produksi: "${fbProd || '-'}" | Kastamer: "${fbKast || '-'}"`,
                      payload: {
                        year: activeYear,
                        month: designMonth,
                        feedbackItem: newFeedbackItem
                      }
                    });
                    setFeedbackModalProject(null);
                    return;
                  }

                  const updated = [...feedbackList];
                  const idx = updated.findIndex(
                    (f) =>
                      f.customer === feedbackModalProject.Customer &&
                      f.projectName === feedbackModalProject['Nama Project'] &&
                      f.month === designMonth
                  );
                  if (idx !== -1) {
                    updated[idx] = {
                      ...updated[idx],
                      fbProduksi: fbProd,
                      fbKastamer: fbKast,
                      isNoRevision: isClean
                    };
                  } else {
                    updated.push(newFeedbackItem);
                  }
                  onUpdateFeedback(updated);
                  setFeedbackModalProject(null);
                }}
                className={`w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2 font-bold rounded-xl text-xs shadow-md ${
                  isSupervisor
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-yellow-500 hover:bg-yellow-400 text-slate-900'
                }`}
              >
                {isSupervisor ? 'Ajukan Feedback ke Manager' : 'Simpan Feedback'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DATES FOR ON-TIME DESIGN & DISTRIBUSI DRAWING (CATEGORY 2 & 3) */}
      {dateModalProject && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-md p-4 sm:p-6 border border-slate-200 space-y-4 max-h-[92dvh] overflow-y-auto pb-safe">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {dateModalMode === 'onTime' ? 'Edit On-Time Design' : 'Edit Distribusi Drawing'}
                </h3>
                <p className="text-xs text-slate-500">
                  {dateModalProject.Customer} • {dateModalProject['Nama Project']}
                </p>
              </div>
              <button
                onClick={() => setDateModalProject(null)}
                className="text-slate-400 hover:text-slate-600 min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Target Drawing/Design
                </label>
                <input
                  type="date"
                  value={modalTargetDate}
                  onChange={(e) => setModalTargetDate(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              {dateModalMode === 'onTime' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Penyelesaian
                  </label>
                  <input
                    type="date"
                    value={modalFinishDate}
                    onChange={(e) => setModalFinishDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              )}

              {dateModalMode === 'distribusi' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Tanggal Penyelesaian 2D (Kolom 2D)
                  </label>
                  <input
                    type="date"
                    value={modal2DDate}
                    onChange={(e) => setModal2DDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-base sm:text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDateModalProject(null)}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  if (isSupervisor && onSubmitApprovalRequest) {
                    if (dateModalMode === 'onTime') {
                      onSubmitApprovalRequest({
                        category: 'on_time_design',
                        categoryLabel: '2. On-Time Design',
                        targetLabel: `${designMonth} • ${dateModalProject.Customer} - ${dateModalProject['Nama Project']}`,
                        summaryOld: `Target: ${dateModalProject['Target Design'] || '-'} | Selesai: ${dateModalProject['Tanggal Penyelesaian'] || dateModalProject['Aktual Engineering'] || '-'}`,
                        summaryNew: `Target: ${modalTargetDate || '-'} | Selesai: ${modalFinishDate || '-'}`,
                        payload: {
                          year: activeYear,
                          month: designMonth,
                          projectSpk: dateModalProject.SPK,
                          projectPatch: {
                            'Target Design': modalTargetDate,
                            'Tanggal Penyelesaian': modalFinishDate,
                            'Aktual Engineering': modalFinishDate
                          }
                        }
                      });
                    } else {
                      onSubmitApprovalRequest({
                        category: 'distribusi_drawing',
                        categoryLabel: '3. Distribusi Drawing',
                        targetLabel: `${designMonth} • ${dateModalProject.Customer} - ${dateModalProject['Nama Project']}`,
                        summaryOld: `Target: ${dateModalProject['Target Design'] || '-'} | 2D: ${dateModalProject['2D'] || '-'}`,
                        summaryNew: `Target: ${modalTargetDate || '-'} | 2D: ${modal2DDate || '-'}`,
                        payload: {
                          year: activeYear,
                          month: designMonth,
                          projectSpk: dateModalProject.SPK,
                          projectPatch: {
                            'Target Design': modalTargetDate,
                            '2D': modal2DDate
                          }
                        }
                      });
                    }
                    setDateModalProject(null);
                    return;
                  }

                  if (onUpdateProject) {
                    if (dateModalMode === 'onTime') {
                      onUpdateProject({
                        ...dateModalProject,
                        'Target Design': modalTargetDate,
                        'Tanggal Penyelesaian': modalFinishDate,
                        'Aktual Engineering': modalFinishDate
                      });
                    } else {
                      onUpdateProject({
                        ...dateModalProject,
                        'Target Design': modalTargetDate,
                        '2D': modal2DDate
                      });
                    }
                  }
                  setDateModalProject(null);
                }}
                className={`w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2 text-white font-semibold rounded-xl text-xs shadow-md ${
                  isSupervisor ? 'bg-amber-600 hover:bg-amber-500' : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                {isSupervisor ? 'Ajukan Perubahan ke Manager' : 'Simpan Perubahan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT COST & TAMBAH PENGELUARAN */}
      {costModalProject && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-4 sm:p-6 border border-slate-200 space-y-4 max-h-[92dvh] overflow-y-auto pb-safe">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  <span>Kelola Cost Engineering</span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {costModalProject.Customer} • {costModalProject['Nama Project']} ({activeTab === 'reviewCost' ? costMonth : designMonth})
                </p>
              </div>
              <button
                onClick={() => setCostModalProject(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Input Anggaran */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <label className="block font-bold text-slate-800 mb-1">
                  Anggaran Design (Rp):
                </label>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-slate-600">Rp</span>
                  <input
                    type="number"
                    value={modalAnggaranInput}
                    onChange={(e) => setModalAnggaranInput(e.target.value)}
                    placeholder="Contoh: 10000000"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-base sm:text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Form Tambah Rincian Biaya */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                <h4 className="font-bold text-slate-700">+ Tambah Rincian Pengeluaran</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Keterangan Biaya:</label>
                    <input
                      type="text"
                      value={modalExpenseDescInput}
                      onChange={(e) => setModalExpenseDescInput(e.target.value)}
                      placeholder="Cth: kesite, lembur 2hari"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-base sm:text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Nominal (Rp):</label>
                    <input
                      type="number"
                      value={modalExpenseAmountInput}
                      onChange={(e) => setModalExpenseAmountInput(e.target.value)}
                      placeholder="Cth: 500000"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-base sm:text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!modalExpenseDescInput.trim() || !modalExpenseAmountInput) return;
                    const m = activeTab === 'reviewCost' ? costMonth : designMonth;
                    const anggaranVal = modalAnggaranInput !== '' ? Number(modalAnggaranInput) || 0 : undefined;
                    const newExpense = {
                      id: `exp-${Date.now()}`,
                      desc: modalExpenseDescInput.trim(),
                      amount: Number(modalExpenseAmountInput) || 0
                    };

                    if (isSupervisor && onSubmitApprovalRequest) {
                      const existing = reviewCostList.find((c) => c.customer === costModalProject.Customer && c.projectName === costModalProject['Nama Project'] && c.month === m);
                      onSubmitApprovalRequest({
                        category: 'cost_efficiency',
                        categoryLabel: '4. Cost Efficiency / Review Cost',
                        targetLabel: `${m} • ${costModalProject.Customer} - ${costModalProject['Nama Project']}`,
                        summaryOld: `Anggaran: Rp ${(existing?.anggaran || 0).toLocaleString('id-ID')} (${existing?.pengeluaran.length || 0} item)`,
                        summaryNew: `+Pengeluaran "${newExpense.desc}" Rp ${newExpense.amount.toLocaleString('id-ID')}${anggaranVal !== undefined ? ` | Anggaran: Rp ${anggaranVal.toLocaleString('id-ID')}` : ''}`,
                        payload: {
                          year: activeYear,
                          month: m,
                          costTarget: { month: m, customer: costModalProject.Customer, projectName: costModalProject['Nama Project'] },
                          updatedAnggaran: anggaranVal,
                          addedExpense: newExpense
                        }
                      });
                      setModalExpenseDescInput('');
                      setModalExpenseAmountInput('');
                      setModalSubmitNotice(`Pengajuan rincian pengeluaran "${newExpense.desc}" telah dikirim ke antrean Persetujuan Manager.`);
                      return;
                    }

                    const updated = [...reviewCostList];
                    const idx = updated.findIndex((c) => c.customer === costModalProject.Customer && c.projectName === costModalProject['Nama Project'] && c.month === m);
                    if (idx !== -1) {
                      updated[idx] = {
                        ...updated[idx],
                        anggaran: anggaranVal !== undefined ? anggaranVal : updated[idx].anggaran,
                        pengeluaran: [...updated[idx].pengeluaran, newExpense]
                      };
                    } else {
                      updated.push({
                        month: m,
                        customer: costModalProject.Customer,
                        projectName: costModalProject['Nama Project'],
                        anggaran: anggaranVal ?? 0,
                        pengeluaran: [newExpense]
                      });
                    }
                    onUpdateReviewCost(updated);
                    setModalExpenseDescInput('');
                    setModalExpenseAmountInput('');
                  }}
                  className="w-full sm:w-auto min-h-[42px] sm:min-h-0 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  {isSupervisor ? '+ Ajukan Rincian Pengeluaran' : '+ Tambah Rincian Pengeluaran'}
                </button>
              </div>

              {/* Daftar Pengeluaran Saat Ini */}
              <div>
                <h4 className="font-bold text-slate-700 mb-1">Rincian Pengeluaran Tercatat:</h4>
                {(() => {
                  const m = activeTab === 'reviewCost' ? costMonth : designMonth;
                  const item = reviewCostList.find((c) => c.customer === costModalProject.Customer && c.projectName === costModalProject['Nama Project'] && c.month === m);
                  const expList = item?.pengeluaran || [];

                  if (expList.length === 0) {
                    return <p className="text-slate-400 italic text-[11px]">Belum ada rincian pengeluaran untuk proyek ini.</p>;
                  }

                  return (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {expList.map((x) => (
                        <div key={x.id} className="flex justify-between items-center p-2 bg-white border border-slate-200 rounded-lg text-xs">
                          <span className="font-medium text-slate-800">{x.desc}</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-semibold text-slate-900">Rp {x.amount.toLocaleString('id-ID')}</span>
                            {canDelete && (
                              <button
                                onClick={() => {
                                  const updated = reviewCostList.map((c) => {
                                    if (c.customer === costModalProject.Customer && c.projectName === costModalProject['Nama Project'] && c.month === m) {
                                      return { ...c, pengeluaran: c.pengeluaran.filter((p) => p.id !== x.id) };
                                    }
                                    return c;
                                  });
                                  onUpdateReviewCost(updated);
                                }}
                                className="text-rose-500 hover:text-rose-700 font-bold min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-rose-50"
                                title="Hapus rincian"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {modalSubmitNotice && costModalProject && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-semibold">
                {modalSubmitNotice}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setCostModalProject(null);
                  setModalSubmitNotice(null);
                }}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const m = activeTab === 'reviewCost' ? costMonth : designMonth;
                  const anggaranVal = Number(modalAnggaranInput) || 0;
                  const hasPendingExpense = modalExpenseDescInput.trim() !== '' && modalExpenseAmountInput !== '';
                  const pendingExp = hasPendingExpense
                    ? {
                        id: `exp-${Date.now()}`,
                        desc: modalExpenseDescInput.trim(),
                        amount: Number(modalExpenseAmountInput) || 0
                      }
                    : undefined;

                  if (isSupervisor && onSubmitApprovalRequest) {
                    const existing = reviewCostList.find((c) => c.customer === costModalProject.Customer && c.projectName === costModalProject['Nama Project'] && c.month === m);
                    onSubmitApprovalRequest({
                      category: 'cost_efficiency',
                      categoryLabel: '4. Cost Efficiency / Review Cost',
                      targetLabel: `${m} • ${costModalProject.Customer} - ${costModalProject['Nama Project']}`,
                      summaryOld: `Anggaran: Rp ${(existing?.anggaran || 0).toLocaleString('id-ID')}`,
                      summaryNew: `Anggaran: Rp ${anggaranVal.toLocaleString('id-ID')}${pendingExp ? ` + "${pendingExp.desc}" (Rp ${pendingExp.amount.toLocaleString('id-ID')})` : ''}`,
                      payload: {
                        year: activeYear,
                        month: m,
                        costTarget: { month: m, customer: costModalProject.Customer, projectName: costModalProject['Nama Project'] },
                        updatedAnggaran: anggaranVal,
                        addedExpense: pendingExp
                      }
                    });
                    setModalExpenseDescInput('');
                    setModalExpenseAmountInput('');
                    setCostModalProject(null);
                    return;
                  }

                  const updated = [...reviewCostList];
                  const idx = updated.findIndex((c) => c.customer === costModalProject.Customer && c.projectName === costModalProject['Nama Project'] && c.month === m);
                  if (idx !== -1) {
                    updated[idx] = {
                      ...updated[idx],
                      anggaran: anggaranVal,
                      pengeluaran: pendingExp ? [...updated[idx].pengeluaran, pendingExp] : updated[idx].pengeluaran
                    };
                  } else {
                    updated.push({
                      month: m,
                      customer: costModalProject.Customer,
                      projectName: costModalProject['Nama Project'],
                      anggaran: anggaranVal,
                      pengeluaran: pendingExp ? [pendingExp] : []
                    });
                  }
                  onUpdateReviewCost(updated);
                  setModalExpenseDescInput('');
                  setModalExpenseAmountInput('');
                  setCostModalProject(null);
                }}
                className={`w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2 font-bold rounded-xl text-xs shadow-md ${
                  isSupervisor
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                }`}
              >
                {isSupervisor ? 'Ajukan Anggaran ke Manager' : 'Simpan Anggaran'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ERROR & TAMBAH KASUS ERROR */}
      {errorModalProject && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg p-4 sm:p-6 border border-slate-200 space-y-4 max-h-[92dvh] overflow-y-auto pb-safe">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <span>Kelola Drawing & Design Error</span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {errorModalProject.Customer} • {errorModalProject['Nama Project']} ({activeTab === 'reviewError' ? errorMonth : designMonth})
                </p>
              </div>
              <button
                onClick={() => setErrorModalProject(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold min-w-[40px] min-h-[40px] rounded-xl hover:bg-slate-100 flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            {/* Form Tambah Kasus Error */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-2.5">
                <h4 className="font-bold text-rose-900">+ Catat Kasus Drawing Error Baru</h4>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Nama Part / Komponen:</label>
                  <input
                    type="text"
                    value={modalPartNameInput}
                    onChange={(e) => setModalPartNameInput(e.target.value)}
                    placeholder="Contoh: shaft well, bracket L, flange A"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-base sm:text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Feedback Drawing / Revisi:</label>
                  <textarea
                    rows={2}
                    value={modalFeedbackErrorInput}
                    onChange={(e) => setModalFeedbackErrorInput(e.target.value)}
                    placeholder="Contoh: Dimention salah, posisi lubang baut geser 2mm"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-base sm:text-xs text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!modalPartNameInput.trim() || !modalFeedbackErrorInput.trim()) return;
                    const m = activeTab === 'reviewError' ? errorMonth : designMonth;
                    const newErr = {
                      id: `err-${Date.now()}`,
                      partName: modalPartNameInput.trim(),
                      feedback: modalFeedbackErrorInput.trim()
                    };

                    if (isSupervisor && onSubmitApprovalRequest) {
                      const existing = reviewErrorList.find((e) => e.customer === errorModalProject.Customer && e.projectName === errorModalProject['Nama Project'] && e.month === m);
                      onSubmitApprovalRequest({
                        category: 'design_error_rate',
                        categoryLabel: '5. Design Error Rate / Review Error',
                        targetLabel: `${m} • ${errorModalProject.Customer} - ${errorModalProject['Nama Project']}`,
                        summaryOld: `${existing?.errors.length || 0} kasus error tercatat`,
                        summaryNew: `+Error Part "${newErr.partName}": ${newErr.feedback}`,
                        payload: {
                          year: activeYear,
                          month: m,
                          errorTarget: { month: m, customer: errorModalProject.Customer, projectName: errorModalProject['Nama Project'] },
                          addedError: newErr
                        }
                      });
                      setModalPartNameInput('');
                      setModalFeedbackErrorInput('');
                      setModalSubmitNotice(`Pengajuan kasus error "${newErr.partName}" telah dikirim ke antrean Persetujuan Manager.`);
                      return;
                    }

                    const updated = [...reviewErrorList];
                    const idx = updated.findIndex((e) => e.customer === errorModalProject.Customer && e.projectName === errorModalProject['Nama Project'] && e.month === m);
                    if (idx !== -1) {
                      updated[idx] = {
                        ...updated[idx],
                        errors: [...updated[idx].errors, newErr]
                      };
                    } else {
                      updated.push({
                        month: m,
                        customer: errorModalProject.Customer,
                        projectName: errorModalProject['Nama Project'],
                        errors: [newErr]
                      });
                    }
                    onUpdateReviewError(updated);
                    setModalPartNameInput('');
                    setModalFeedbackErrorInput('');
                  }}
                  className="w-full sm:w-auto min-h-[42px] sm:min-h-0 px-3 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                >
                  {isSupervisor ? '+ Ajukan Kasus Error ke Manager' : '+ Tambah Kasus Error'}
                </button>
              </div>

              {/* Daftar Error Tercatat */}
              <div>
                <h4 className="font-bold text-slate-700 mb-1">Daftar Error Drawing Tercatat:</h4>
                {(() => {
                  const m = activeTab === 'reviewError' ? errorMonth : designMonth;
                  const item = reviewErrorList.find((e) => e.customer === errorModalProject.Customer && e.projectName === errorModalProject['Nama Project'] && e.month === m);
                  const errList = item?.errors || [];

                  if (errList.length === 0) {
                    return <p className="text-emerald-600 italic text-[11px]">✓ Tidak ada kasus error (Zero Error).</p>;
                  }

                  return (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {errList.map((err, idx) => (
                        <div key={err.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex justify-between items-start text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{idx + 1}. {err.partName}</span>
                            <p className="text-slate-600 mt-0.5">{err.feedback}</p>
                          </div>
                          {canDelete && (
                            <button
                              onClick={() => {
                                const updated = reviewErrorList.map((e) => {
                                  if (e.customer === errorModalProject.Customer && e.projectName === errorModalProject['Nama Project'] && e.month === m) {
                                    return { ...e, errors: e.errors.filter((x) => x.id !== err.id) };
                                  }
                                  return e;
                                });
                                onUpdateReviewError(updated);
                              }}
                              className="text-rose-500 hover:text-rose-700 font-bold ml-2 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg hover:bg-rose-50"
                              title="Hapus error"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {modalSubmitNotice && errorModalProject && (
              <div className="p-2.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-900 font-semibold">
                {modalSubmitNotice}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => {
                  setErrorModalProject(null);
                  setModalSubmitNotice(null);
                }}
                className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs shadow-md"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
