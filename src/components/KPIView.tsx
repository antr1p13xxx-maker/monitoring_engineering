import React, { useState, useMemo, useEffect, useRef } from 'react';
import { KPIItem, EngineeringProject, ReviewCostItem, ReviewErrorItem, DesignFeedbackItem, AuditLog, UserRole } from '../types/engineering';
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
  Box
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
  auditLogs
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trends' | 'matrix' | 'monitoring' | 'designInput' | 'reviewCost' | 'reviewError' | 'quarterly' | 'audit'>('dashboard');
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

        kpiList.forEach((item) => {
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
      const kpiObj = kpiList.find((k) => String(k.id) === selectedChartKpi);
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
  }, [kpiList, selectedChartKpi, kpiPeriodFilter]);

  const isManager = userRole === 'Manager';
  const isReadOnly = userRole === 'Viewer';

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

    kpiList.forEach((item) => {
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
  }, [kpiList]);

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

        kpiList.forEach((item) => {
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
      const kpiObj = kpiList.find((k) => String(k.id) === selectedChartKpi);
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
            backgroundColor: 'rgba(100, 116, 139, 0.65)',
            borderRadius: 6,
            order: 2
          },
          {
            type: 'bar',
            label: 'Aktual Tercapai (Bar)',
            data: actualVals,
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderRadius: 6,
            order: 2
          },
          {
            type: 'line',
            label: 'Tren Aktual (Line)',
            data: actualVals,
            borderColor: '#2563eb',
            backgroundColor: '#2563eb',
            borderWidth: 2.5,
            tension: 0.3,
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
  }, [activeTab, selectedChartKpi, kpiPeriodFilter, kpiList]);

  // Quarterly Chart setup
  useEffect(() => {
    if (activeTab !== 'quarterly' || !quarterlyChartRef.current) return;

    const calcQ = (months: readonly string[]) => {
      let sum = 0;
      let count = 0;
      months.forEach((m) => {
        kpiList.forEach((item) => {
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
          backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'],
          borderRadius: 8,
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
  }, [activeTab, kpiList]);

  // Filter projects relevant to active category & month for recap
  const recapProjects = useMemo(() => {
    return projects.filter((p) => {
      const pMonth = String(p.Bulan || '').trim();
      return pMonth.toLowerCase().includes(designMonth.toLowerCase()) || designMonth.toLowerCase().includes(pMonth.toLowerCase());
    });
  }, [projects, designMonth]);

  // Filter projects for Review Cost
  const costProjects = useMemo(() => {
    return projects.filter((p) => {
      const pMonth = String(p.Bulan || '').trim();
      return pMonth.toLowerCase().includes(costMonth.toLowerCase()) || costMonth.toLowerCase().includes(pMonth.toLowerCase());
    });
  }, [projects, costMonth]);

  // Filter projects for Review Error
  const errorProjects = useMemo(() => {
    return projects.filter((p) => {
      const pMonth = String(p.Bulan || '').trim();
      return pMonth.toLowerCase().includes(errorMonth.toLowerCase()) || errorMonth.toLowerCase().includes(pMonth.toLowerCase());
    });
  }, [projects, errorMonth]);

  // Active KPI item for Recharts Trends analysis
  const activeTrendKpi = useMemo(() => {
    return kpiList.find((k) => k.id === trendKpiId) || kpiList[0] || null;
  }, [kpiList, trendKpiId]);

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
    const kpiStatusList = kpiList.map((item) => {
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
      targetAchievedCount: `${achievedCount} dari ${kpiList.length} parameter KPI`,
      totalWeightScore: `${kpiStats.averageScore}%`,
      kpiDetails: kpiStatusList
    };
  }, [kpiList, kpiPeriodFilter, activeYear, kpiStats]);

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
    const totalCount = Math.max(1, recapProjects.length);

    if (designCategory === 'designQuality') {
      let noFeedbackCount = 0;
      recapProjects.forEach((p) => {
        const fb = feedbackList.find((f) => f.customer === p.Customer && f.projectName === p['Nama Project'] && f.month === designMonth);
        const hasFeedback = fb && (
          (fb.fbProduksi && fb.fbProduksi.trim() !== '') ||
          (fb.fbKastamer && fb.fbKastamer.trim() !== '')
        );
        if (!hasFeedback) {
          noFeedbackCount++;
        }
      });
      return Number(((noFeedbackCount / totalCount) * 100).toFixed(1));
    }

    if (designCategory === 'onTimeDesign') {
      let onTimeCount = 0;
      recapProjects.forEach((p) => {
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

    if (designCategory === 'distribusiDrawing') {
      let delayCount = 0;
      recapProjects.forEach((p) => {
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

    if (designCategory === 'costEfficiency') {
      let totalBudget = 0;
      let totalExp = 0;
      recapProjects.forEach((p) => {
        const item = reviewCostList.find((c) => c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === designMonth);
        if (item) {
          totalBudget += item.anggaran;
          totalExp += item.pengeluaran.reduce((sum, e) => sum + e.amount, 0);
        }
      });
      return totalBudget > 0 ? Number(((totalExp / totalBudget) * 100).toFixed(1)) : 85.0;
    }

    if (designCategory === 'designErrorRate') {
      let totalQtyDrawing = 0;
      let totalErrors = 0;
      recapProjects.forEach((p) => {
        totalQtyDrawing += Number(p['Qty Drawing'] || 0);
        const item = reviewErrorList.find((e) => e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === designMonth);
        if (item) {
          totalErrors += item.errors.length;
        }
      });
      return totalQtyDrawing > 0 ? Number(((totalErrors / totalQtyDrawing) * 100).toFixed(1)) : 0.8;
    }

    return 100;
  }, [designCategory, designMonth, recapProjects, feedbackList, reviewCostList, reviewErrorList]);

  // Export Matrix to PDF
  const handleExportMatrixPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`MATRIKS RESMI KPI - ENGINEERING DEPARTMENT (${activeYear})`, 14, 12);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')} | Engineering Department Plant CDR & BTG`, 14, 18);

      const tableRows: any[] = [];
      kpiList.forEach((kpi) => {
        // Row 1: Target
        tableRows.push([
          kpi.no,
          kpi.objective,
          kpi.kpi,
          `${kpi.bobot * 100}%`,
          kpi.unit,
          kpi.target,
          'T',
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.target,
          kpi.keterangan || '-'
        ]);
        // Row 2: Actual
        tableRows.push([
          '',
          '',
          '',
          '',
          '',
          '',
          'A',
          kpi.months.Jan ?? '-',
          kpi.months.Feb ?? '-',
          kpi.months.Mar ?? '-',
          kpi.months.Apr ?? '-',
          kpi.months.Mei ?? '-',
          kpi.months.Jun ?? '-',
          kpi.months.Jul ?? '-',
          kpi.months.Aug ?? '-',
          kpi.months.Sep ?? '-',
          kpi.months.Okt ?? '-',
          kpi.months.Nop ?? '-',
          kpi.months.Des ?? '-',
          ''
        ]);
      });

      autoTable(doc, {
        startY: 22,
        head: [['No', 'Quality Objective', 'KPI', 'Bobot', 'Unit', 'Target', 'T/A', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nop', 'Des', 'Keterangan']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [4, 120, 87], textColor: [255, 255, 255], fontSize: 7.5, fontStyle: 'bold' },
        bodyStyles: { fontSize: 7 },
        margin: { left: 10, right: 10 }
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

    kpiList.forEach((item) => {
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
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
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

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Filter Periode */}
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-slate-500">Periode:</span>
              <select
                value={kpiPeriodFilter}
                onChange={(e) => setKpiPeriodFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl px-2.5 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-semibold text-slate-500">Pilih KPI:</span>
              <select
                value={trendKpiId}
                onChange={(e) => setTrendKpiId(Number(e.target.value))}
                className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {kpiList.map((k) => (
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
        <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200">
          <div className="flex justify-between items-center mb-3 px-2">
            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
              <span>Grafik Fluktuasi Bulanan: {activeTrendKpi.objective} ({activeYear})</span>
            </span>
            <div className="flex items-center space-x-4 text-[11px] font-semibold text-slate-600">
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

          <div className="w-full h-80">
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
    <div className="space-y-6">
      {/* Top Bar Navigation */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToMonitoring}
            className="bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-white px-3.5 py-2 rounded-xl text-xs font-semibold transition flex items-center space-x-2 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Monitoring Drawing</span>
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900 leading-tight">KPI Engineering Department CDR</h2>
            <p className="text-[11px] text-slate-500">Plant CDR & BTG • Target vs Aktual Terukur</p>
          </div>
        </div>

        {/* Action Controls & Subtabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Year selector */}
          <select
            value={activeYear}
            onChange={(e) => onYearChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-emerald-400 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="2026">Tahun 2026</option>
            <option value="2027">Tahun 2027</option>
            <option value="2028">Tahun 2028</option>
            <option value="2029">Tahun 2029</option>
            <option value="2030">Tahun 2030</option>
          </select>

          {/* Subtab Buttons */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('trends')}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === 'trends' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span>Trends</span>
          </button>

          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === 'matrix' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>Matriks Resmi</span>
          </button>

          <button
            onClick={() => setActiveTab('monitoring')}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === 'monitoring' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <PenTool className="w-3.5 h-3.5" />
            <span>Tabel & Input</span>
          </button>

          {isManager && (
            <>
              <button
                onClick={() => setActiveTab('designInput')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 ${
                  activeTab === 'designInput' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>Input Rekapitulasi</span>
              </button>

              <button
                onClick={() => setActiveTab('reviewCost')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 ${
                  activeTab === 'reviewCost' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                <span>Review Cost</span>
              </button>

              <button
                onClick={() => setActiveTab('reviewError')}
                className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 ${
                  activeTab === 'reviewError' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-500" />
                <span>Review Error</span>
              </button>
            </>
          )}

          <button
            onClick={() => setActiveTab('quarterly')}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === 'quarterly' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <BarChart className="w-3.5 h-3.5" />
            <span>Q1-Q4</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-3 py-2 text-xs font-semibold rounded-xl transition flex items-center space-x-1.5 ${
              activeTab === 'audit' ? 'bg-emerald-600 text-white shadow-md' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit</span>
          </button>

          <button
            onClick={() => setShowEmailModal(true)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition shadow flex items-center space-x-1.5"
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Email</span>
          </button>

          <button
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition shadow flex items-center space-x-1.5"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Ekspor PDF/Excel</span>
          </button>
        </div>
      </div>

      {/* SUBTAB 1: DASHBOARD */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {/* Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total KPI Departemen</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">9 KPI Resmi</h3>
                <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-2">
                  Aktif Tahun {activeYear}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shadow-inner">
                <Table className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Bobot Keseluruhan</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">100%</h3>
                <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-full inline-block mt-2">
                  Terdistribusi Sempurna
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shadow-inner">
                <ShieldAlert className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rata-Rata Pencapaian</p>
                <h3 className="text-2xl font-bold text-slate-800 mt-1">{kpiStats.averageScore}%</h3>
                <span className="text-xs text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-2">
                  Terbobot Berjalan
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shadow-inner">
                <CheckCircle2 className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status Kesehatan KPI</p>
                <h3 className="text-xl font-bold text-emerald-600 mt-1">{kpiStats.health}</h3>
                <span className="text-xs text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-full inline-block mt-2">
                  Target vs Aktual
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl shadow-inner">
                <Sparkles className="w-6 h-6" />
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2 flex flex-col">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                    <span>Perbandingan Target vs Aktual KPI {activeYear}</span>
                    <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      {kpiPeriodFilter === 'ALL' ? 'Semua Bulan (Jan - Des)' : kpiPeriodFilter}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Grafik komparasi modern Target vs Aktual (Bar & Line Combo dengan label nilai)
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-semibold text-slate-500">Filter Periode:</span>
                    <select
                      value={kpiPeriodFilter}
                      onChange={(e) => setKpiPeriodFilter(e.target.value)}
                      className="bg-slate-50 border border-slate-300 text-slate-800 font-semibold text-xs rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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

                  <div className="flex items-center space-x-1.5">
                    <span className="text-xs font-semibold text-slate-500">Pilih KPI:</span>
                    <select
                      value={selectedChartKpi}
                      onChange={(e) => setSelectedChartKpi(e.target.value)}
                      className="bg-slate-50 border border-slate-300 text-slate-700 text-xs rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    >
                      <option value="all">Rata-Rata Seluruh KPI</option>
                      {kpiList.map((item) => (
                        <option key={item.id} value={String(item.id)}>
                          {item.no}. {item.objective}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2D / 3D pill toggle */}
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

              <div className={kpiPerfDim === '2D' ? 'relative flex-grow w-full h-80' : 'hidden'}>
                <canvas ref={perfChartRef} />
              </div>
              {kpiPerfDim === '3D' && (
                <div className="w-full animate-in fade-in duration-200">
                  <ThreeDChart
                    title={`Pencapaian KPI vs Target (3D WebGL Multi-Series) - ${selectedChartKpi === 'all' ? 'Rata-Rata Seluruh KPI' : kpiList.find(k => String(k.id) === selectedChartKpi)?.objective || ''}`}
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">
                KPI - ENGINEERING DEPARTMENT (Matriks Resmi {activeYear})
              </h3>
              <p className="text-xs text-slate-500">
                Tampilan rekapitulasi target dan pencapaian aktual bulanan lengkap sesuai dokumen resmi industri
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleExportMatrixPDF}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-rose-600 hover:bg-rose-500 text-white shadow-sm flex items-center space-x-1.5 transition"
              >
                <FileDown className="w-4 h-4" />
                <span>Cetak PDF Matriks Resmi</span>
              </button>
              <button
                onClick={handleExportMatrixExcel}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm flex items-center space-x-1.5 transition"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Excel Matriks</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-300 shadow-inner">
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
                {kpiList.map((item) => (
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
                        <span className="text-[10px] text-slate-400 italic">Pencapaian Aktual Departemen</span>
                      </td>
                      <td className="p-2 border border-slate-300 font-bold bg-blue-50 text-blue-800">A</td>
                      {MONTH_NAMES.map((m) => {
                        const val = item.months[m];
                        return (
                          <td key={m} className="p-1 border border-slate-300 font-bold text-emerald-700">
                            {val !== null && val !== undefined ? val : '-'}
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-800">Tabel Monitoring KPI & Pengukuran Aktual</h3>
              <p className="text-xs text-slate-500">Kelola dan perbarui nilai aktual bulanan beserta keterangan</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center space-x-2">
                <span className="text-xs font-semibold text-slate-500">Bulan Aktif:</span>
                <select
                  value={activeGlobalMonth}
                  onChange={(e) => setActiveGlobalMonth(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-700 text-xs rounded-xl px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold"
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
                className="px-3.5 py-2 bg-slate-50 border border-slate-300 text-xs rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none w-48"
              />
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
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
                {kpiList
                  .filter((item) => !searchKpi || item.objective.toLowerCase().includes(searchKpi.toLowerCase()))
                  .map((item) => {
                    const val = item.months[activeGlobalMonth];
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
                          {val !== null && val !== undefined ? `${val} ${unitStr}` : <span className="text-slate-400 italic">Belum diisi</span>}
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
                              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-semibold transition"
                            >
                              Input Nilai
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

      {/* SUBTAB 4: INPUT TABEL REKAPITULASI (MANAGER ONLY) */}
      {activeTab === 'designInput' && isManager && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <PenTool className="w-5 h-5 text-emerald-600" />
                <span>Input Tabel Rekapitulasi Kategori KPI Design</span>
              </h3>
              <p className="text-xs text-slate-500">
                Kelola parameter KPI Design lengkap dengan perhitungan formula otomatis sesuai standar CDR
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={designCategory}
                onChange={(e) => setDesignCategory(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="designQuality">1. Design Quality (≥ 90%)</option>
                <option value="onTimeDesign">2. On-Time Design (≥ 95%)</option>
                <option value="distribusiDrawing">3. Distribusi Drawing (≤ 10%)</option>
                <option value="costEfficiency">4. Cost Efficiency (≤ 95%)</option>
                <option value="designErrorRate">5. Design Error Rate (≤ 2%)</option>
              </select>

              <select
                value={designMonth}
                onChange={(e) => setDesignMonth(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-emerald-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              >
                {MONTH_NAMES.map((m) => (
                  <option key={m} value={MONTH_FULL_NAMES[m]}>{MONTH_FULL_NAMES[m]}</option>
                ))}
              </select>

              <button
                onClick={handleExportDesignRecapPDF}
                className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-3.5 py-2 rounded-xl shadow transition flex items-center space-x-1.5"
              >
                <FileDown className="w-4 h-4" />
                <span>Cetak PDF Rekap</span>
              </button>
            </div>
          </div>

          {/* Interactive Recap Table Rendering based on selected Category */}
          <div className="overflow-x-auto rounded-xl border-2 border-black bg-white shadow-sm">
            {/* KATEGORI 1: DESIGN QUALITY */}
            {designCategory === 'designQuality' && (
              <div>
                {/* Yellow Title Bar */}
                <div className="bg-[#ffff00] bg-yellow-300 text-black border-b border-black py-2 px-4 text-center font-bold text-sm tracking-wide">
                  Design Quality
                </div>

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
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

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
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

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
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>

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

                <div className="overflow-x-auto">
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
                                    <button
                                      onClick={() => {
                                        if (confirm(`Hapus data anggaran/pengeluaran untuk ${p.Customer} - ${p['Nama Project']}?`)) {
                                          const updated = reviewCostList.filter((c) => !(c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === designMonth));
                                          onUpdateReviewCost(updated);
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold shadow-sm transition"
                                    >
                                      Hapus
                                    </button>
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

                <div className="overflow-x-auto">
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
                                    <button
                                      onClick={() => {
                                        if (confirm(`Hapus data error/revisi untuk ${p.Customer} - ${p['Nama Project']}?`)) {
                                          const updated = reviewErrorList.filter((e) => !(e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === designMonth));
                                          onUpdateReviewError(updated);
                                        }
                                      }}
                                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-[11px] font-semibold shadow-sm transition"
                                    >
                                      Hapus
                                    </button>
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
                    Design Cost Efisiensi = {calculatedCategoryScore}%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 5: REVIEW COST (MANAGER ONLY) */}
      {activeTab === 'reviewCost' && isManager && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-amber-500" />
                <span>Dashboard Review Cost Engineering</span>
              </h3>
              <p className="text-xs text-slate-500">
                Kelola anggaran vs rincian pengeluaran per project (Sumber data Efisiensi Biaya Desain)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-600">Pilih Bulan:</label>
              <select
                value={costMonth}
                onChange={(e) => setCostMonth(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-amber-800 focus:ring-2 focus:ring-amber-500 focus:outline-none"
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

            <div className="overflow-x-auto">
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
                                  {!isReadOnly && (
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
                                        const newAnggaran = prompt('Ubah Anggaran Design (angka saja):', String(anggaran));
                                        if (newAnggaran !== null) {
                                          const num = Number(newAnggaran) || 0;
                                          const updated = [...reviewCostList];
                                          let found = updated.find((c) => c.customer === p.Customer && c.projectName === p['Nama Project'] && c.month === costMonth);
                                          if (found) {
                                            found.anggaran = num;
                                          } else {
                                            updated.push({ month: costMonth, customer: p.Customer, projectName: p['Nama Project'], anggaran: num, pengeluaran: [] });
                                          }
                                          onUpdateReviewCost(updated);
                                        }
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

      {/* SUBTAB 6: REVIEW ERROR (MANAGER ONLY) */}
      {activeTab === 'reviewError' && isManager && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-rose-600" />
                <span>Dashboard Review Drawing & Design Error</span>
              </h3>
              <p className="text-xs text-slate-500">
                Pencatatan rincian kesalahan drawing yang ditemukan saat trial atau produksi manufaktur
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <label className="text-xs font-semibold text-slate-600">Pilih Bulan:</label>
              <select
                value={errorMonth}
                onChange={(e) => setErrorMonth(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-semibold text-rose-700 focus:ring-2 focus:ring-rose-500 focus:outline-none"
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

            <div className="overflow-x-auto">
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
                                {!isReadOnly && (
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
                                    <button
                                      onClick={() => {
                                        if (confirm(`Hapus semua kasus drawing error untuk ${p.Customer} - ${p['Nama Project']}?`)) {
                                          const updated = reviewErrorList.filter((e) => !(e.customer === p.Customer && e.projectName === p['Nama Project'] && e.month === errorMonth));
                                          onUpdateReviewError(updated);
                                        }
                                      }}
                                      className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[10px] font-semibold w-full transition"
                                    >
                                      Hapus Semua
                                    </button>
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
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-800">Analisis Kuartalan (Q1 – Q4) KPI {activeYear}</h3>
            <p className="text-xs text-slate-500">Evaluasi pencapaian performa departemen engineering per kuartal</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 flex flex-col">
              <h4 className="text-xs font-bold text-slate-700 mb-4 flex items-center space-x-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <span>Grafik Komparasi Kuartalan Q1 - Q4</span>
              </h4>
              <div className="relative flex-grow w-full h-72">
                <canvas ref={quarterlyChartRef} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-50/60 p-5 rounded-2xl border border-emerald-200 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Kuartal 1 (Jan - Mar)</span>
                  <h4 className="text-3xl font-extrabold text-slate-900 mt-2">94%</h4>
                </div>
                <span className="text-xs text-emerald-700 font-semibold bg-emerald-100 px-2.5 py-1 rounded-full w-max mt-4">
                  Selesai Evaluasi
                </span>
              </div>

              <div className="bg-blue-50/60 p-5 rounded-2xl border border-blue-200 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider">Kuartal 2 (Apr - Jun)</span>
                  <h4 className="text-3xl font-extrabold text-slate-900 mt-2">95%</h4>
                </div>
                <span className="text-xs text-blue-700 font-semibold bg-blue-100 px-2.5 py-1 rounded-full w-max mt-4">
                  Selesai Evaluasi
                </span>
              </div>

              <div className="bg-amber-50/60 p-5 rounded-2xl border border-amber-200 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Kuartal 3 (Jul - Sep)</span>
                  <h4 className="text-3xl font-extrabold text-slate-900 mt-2">93%</h4>
                </div>
                <span className="text-xs text-amber-700 font-semibold bg-amber-100 px-2.5 py-1 rounded-full w-max mt-4">
                  Selesai Evaluasi
                </span>
              </div>

              <div className="bg-purple-50/60 p-5 rounded-2xl border border-purple-200 flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">Kuartal 4 (Okt - Des)</span>
                  <h4 className="text-3xl font-extrabold text-slate-900 mt-2">96%</h4>
                </div>
                <span className="text-xs text-purple-700 font-semibold bg-purple-100 px-2.5 py-1 rounded-full w-max mt-4">
                  Sedang Berjalan
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUBTAB 8: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-800">Audit Trail & Log Perubahan KPI</h3>
            <p className="text-xs text-slate-500">
              Riwayat pencatatan aktivitas pembaruan nilai aktual dan otentikasi role
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200">
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
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">
                  Perbarui Nilai KPI: {editModalItem.objective}
                </h3>
                <p className="text-xs text-slate-500">
                  Tahun {activeYear} • Target: <strong className="text-emerald-700">{editModalItem.target}</strong>
                </p>
              </div>
              <button
                onClick={() => setEditModalItem(null)}
                className="text-slate-400 hover:text-slate-600"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-semibold"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan / Catatan Manajerial</label>
                <input
                  type="text"
                  value={editModalKet}
                  onChange={(e) => setEditModalKet(e.target.value)}
                  placeholder="Cth: Peningkatan efisiensi berkat standardisasi CAD..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditModalItem(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center space-x-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>Simpan Perubahan</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EMAIL REPORT */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                <Mail className="w-5 h-5 text-blue-600" />
                <span>Kirim Laporan via Email (Gmail)</span>
              </h3>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Penerima (To)</label>
                <input
                  type="text"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subjek</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Isi Pesan</label>
                <textarea
                  rows={3}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowEmailModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  alert('Laporan KPI telah disiapkan untuk dikirim melalui Google Mail / MailApp API.');
                  setShowEmailModal(false);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-md flex items-center space-x-1.5"
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
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-800">Ekspor Laporan Resmi KPI</h3>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 py-2">
              <button
                onClick={handleExportMatrixExcel}
                className="flex flex-col items-center justify-center p-4 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl transition group"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-lg mb-2 shadow">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <span className="font-bold text-emerald-900 text-xs">Format Excel</span>
                <span className="text-[10px] text-emerald-700">.xlsx Spreadsheet</span>
              </button>

              <button
                onClick={handleExportMatrixPDF}
                className="flex flex-col items-center justify-center p-4 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-2xl transition group"
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
                className="px-4 py-1.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT FEEDBACK DESIGN QUALITY (CATEGORY 1) */}
      {feedbackModalProject && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Feedback Design Quality
                </h3>
                <p className="text-xs text-slate-500">
                  {feedbackModalProject.Customer} • {feedbackModalProject['Nama Project']} ({designMonth})
                </p>
              </div>
              <button
                onClick={() => setFeedbackModalProject(null)}
                className="text-slate-400 hover:text-slate-600"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-yellow-500 focus:outline-none"
                />
              </div>

              <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-200 text-[11px] text-amber-900">
                💡 <strong>Catatan Formula:</strong> Jika kedua kolom feedback dikosongkan, proyek ini secara otomatis berstatus <strong>Approve ✓</strong> dan dihitung memenuhi target Design Quality (≥ 90%).
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setFeedbackModalProject(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  const updated = [...feedbackList];
                  const idx = updated.findIndex(
                    (f) =>
                      f.customer === feedbackModalProject.Customer &&
                      f.projectName === feedbackModalProject['Nama Project'] &&
                      f.month === designMonth
                  );
                  const isClean = !modalFbProduksi.trim() && !modalFbKastamer.trim();
                  if (idx !== -1) {
                    updated[idx].fbProduksi = modalFbProduksi.trim();
                    updated[idx].fbKastamer = modalFbKastamer.trim();
                    updated[idx].isNoRevision = isClean;
                  } else {
                    updated.push({
                      month: designMonth,
                      customer: feedbackModalProject.Customer,
                      projectName: feedbackModalProject['Nama Project'],
                      fbProduksi: modalFbProduksi.trim(),
                      fbKastamer: modalFbKastamer.trim(),
                      isNoRevision: isClean
                    });
                  }
                  onUpdateFeedback(updated);
                  setFeedbackModalProject(null);
                }}
                className="px-5 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-900 font-bold rounded-xl text-xs shadow-md"
              >
                Simpan Feedback
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DATES FOR ON-TIME DESIGN & DISTRIBUSI DRAWING (CATEGORY 2 & 3) */}
      {dateModalProject && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-slate-200 space-y-4">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {dateModalMode === 'onTime' ? 'Edit On-Time Design' : 'Edit Distribusi Drawing'}
                </h3>
                <p className="text-xs text-slate-500">
                  {dateModalProject.Customer} • {dateModalProject['Nama Project']}
                </p>
              </div>
              <button
                onClick={() => setDateModalProject(null)}
                className="text-slate-400 hover:text-slate-600"
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
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDateModalProject(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Batal
              </button>
              <button
                onClick={() => {
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
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-md"
              >
                Simpan Perubahan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT COST & TAMBAH PENGELUARAN */}
      {costModalProject && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <DollarSign className="w-5 h-5 text-amber-500" />
                  <span>Kelola Cost Engineering</span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {costModalProject.Customer} • {costModalProject['Nama Project']} ({activeTab === 'reviewCost' ? costMonth : designMonth})
                </p>
              </div>
              <button
                onClick={() => setCostModalProject(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
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
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Form Tambah Rincian Biaya */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <h4 className="font-bold text-slate-700">+ Tambah Rincian Pengeluaran</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Keterangan Biaya:</label>
                    <input
                      type="text"
                      value={modalExpenseDescInput}
                      onChange={(e) => setModalExpenseDescInput(e.target.value)}
                      placeholder="Cth: kesite, lembur 2hari"
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Nominal (Rp):</label>
                    <input
                      type="number"
                      value={modalExpenseAmountInput}
                      onChange={(e) => setModalExpenseAmountInput(e.target.value)}
                      placeholder="Cth: 500000"
                      className="w-full bg-white border border-slate-300 rounded-lg p-1.5 text-xs font-mono text-slate-900"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!modalExpenseDescInput.trim() || !modalExpenseAmountInput) return;
                    const m = activeTab === 'reviewCost' ? costMonth : designMonth;
                    const updated = [...reviewCostList];
                    let found = updated.find((c) => c.customer === costModalProject.Customer && c.projectName === costModalProject['Nama Project'] && c.month === m);
                    if (!found) {
                      found = {
                        month: m,
                        customer: costModalProject.Customer,
                        projectName: costModalProject['Nama Project'],
                        anggaran: Number(modalAnggaranInput) || 0,
                        pengeluaran: []
                      };
                      updated.push(found);
                    }
                    found.pengeluaran.push({
                      id: `exp-${Date.now()}`,
                      desc: modalExpenseDescInput.trim(),
                      amount: Number(modalExpenseAmountInput) || 0
                    });
                    onUpdateReviewCost(updated);
                    setModalExpenseDescInput('');
                    setModalExpenseAmountInput('');
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  + Tambah Rincian Pengeluaran
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
                    <div className="space-y-1 max-h-40 overflow-y-auto">
                      {expList.map((x) => (
                        <div key={x.id} className="flex justify-between items-center p-1.5 bg-white border border-slate-200 rounded text-xs">
                          <span className="font-medium text-slate-800">{x.desc}</span>
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-semibold text-slate-900">Rp {x.amount.toLocaleString('id-ID')}</span>
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
                              className="text-rose-500 hover:text-rose-700 font-bold"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setCostModalProject(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Tutup
              </button>
              <button
                onClick={() => {
                  const m = activeTab === 'reviewCost' ? costMonth : designMonth;
                  const updated = [...reviewCostList];
                  let found = updated.find((c) => c.customer === costModalProject.Customer && c.projectName === costModalProject['Nama Project'] && c.month === m);
                  const anggaranVal = Number(modalAnggaranInput) || 0;
                  if (found) {
                    found.anggaran = anggaranVal;
                  } else {
                    updated.push({
                      month: m,
                      customer: costModalProject.Customer,
                      projectName: costModalProject['Nama Project'],
                      anggaran: anggaranVal,
                      pengeluaran: []
                    });
                  }
                  onUpdateReviewCost(updated);
                  setCostModalProject(null);
                }}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-xl text-xs shadow-md"
              >
                Simpan Anggaran
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: EDIT ERROR & TAMBAH KASUS ERROR */}
      {errorModalProject && (
        <div className="fixed inset-0 bg-slate-950/80 z-[160] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800 flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                  <span>Kelola Drawing & Design Error</span>
                </h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  {errorModalProject.Customer} • {errorModalProject['Nama Project']} ({activeTab === 'reviewError' ? errorMonth : designMonth})
                </p>
              </div>
              <button
                onClick={() => setErrorModalProject(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {/* Form Tambah Kasus Error */}
            <div className="space-y-3 text-xs">
              <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 space-y-2">
                <h4 className="font-bold text-rose-900">+ Catat Kasus Drawing Error Baru</h4>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Nama Part / Komponen:</label>
                  <input
                    type="text"
                    value={modalPartNameInput}
                    onChange={(e) => setModalPartNameInput(e.target.value)}
                    placeholder="Contoh: shaft well, bracket L, flange A"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-0.5">Feedback Drawing / Revisi:</label>
                  <textarea
                    rows={2}
                    value={modalFeedbackErrorInput}
                    onChange={(e) => setModalFeedbackErrorInput(e.target.value)}
                    placeholder="Contoh: Dimention salah, posisi lubang baut geser 2mm"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!modalPartNameInput.trim() || !modalFeedbackErrorInput.trim()) return;
                    const m = activeTab === 'reviewError' ? errorMonth : designMonth;
                    const updated = [...reviewErrorList];
                    let found = updated.find((e) => e.customer === errorModalProject.Customer && e.projectName === errorModalProject['Nama Project'] && e.month === m);
                    if (!found) {
                      found = {
                        month: m,
                        customer: errorModalProject.Customer,
                        projectName: errorModalProject['Nama Project'],
                        errors: []
                      };
                      updated.push(found);
                    }
                    found.errors.push({
                      id: `err-${Date.now()}`,
                      partName: modalPartNameInput.trim(),
                      feedback: modalFeedbackErrorInput.trim()
                    });
                    onUpdateReviewError(updated);
                    setModalPartNameInput('');
                    setModalFeedbackErrorInput('');
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold shadow-sm transition"
                >
                  + Tambah Kasus Error
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
                        <div key={err.id} className="p-2 bg-slate-50 border border-slate-200 rounded flex justify-between items-start text-xs">
                          <div>
                            <span className="font-bold text-slate-800">{idx + 1}. {err.partName}</span>
                            <p className="text-slate-600 mt-0.5">{err.feedback}</p>
                          </div>
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
                            className="text-rose-500 hover:text-rose-700 font-bold ml-2"
                            title="Hapus error"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setErrorModalProject(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl text-xs shadow-md"
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
