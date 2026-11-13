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
  Layers
} from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, PointElement, LineElement, BarController, LineController } from 'chart.js';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { chartValueLabelsPlugin } from '../utils/chartPlugin';
import { AIInsightsSection } from './AIInsightsSection';
import { ThreeDChart } from './ThreeDChart';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, BarController, LineController, Title, Tooltip, Legend);

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
  showToast
}) => {
  // Sub-tab state: Monitoring Drawing SPK vs Serah Terima Standart Part
  const [activeMonitoringTab, setActiveMonitoringTab] = useState<'drawingProjects' | 'standartPartHandover'>('drawingProjects');

  // Filters state
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('2026');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterSpk, setFilterSpk] = useState<string>('');
  const [filterCustomer, setFilterCustomer] = useState<string>('');
  const [filterProject, setFilterProject] = useState<string>('');
  const [sortSpkAsc, setSortSpkAsc] = useState<boolean>(true);

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
      // SPK
      if (filterSpk && !item.SPK.toLowerCase().includes(filterSpk.toLowerCase())) {
        return false;
      }
      // Customer
      if (filterCustomer && !item.Customer.toLowerCase().includes(filterCustomer.toLowerCase())) {
        return false;
      }
      // Project Name
      if (filterProject && !item['Nama Project'].toLowerCase().includes(filterProject.toLowerCase())) {
        return false;
      }
      return true;
    }).sort((a, b) => {
      const cmp = a.SPK.localeCompare(b.SPK, undefined, { numeric: true });
      return sortSpkAsc ? cmp : -cmp;
    });
  }, [projects, filterMonth, filterYear, filterStatus, filterSpk, filterCustomer, filterProject, sortSpkAsc]);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = filteredProjects.length;
    const onProgress = filteredProjects.filter((d) => d.Status === 'In Progress').length;
    const done = filteredProjects.filter((d) => d.Status === 'Selesai').length;
    const revisi = filteredProjects.filter((d) => d.Status === 'Revisi').length;
    const overdue = filteredProjects.filter((d) => {
      if (!d['Target Design'] || d.Status === 'Selesai') return false;
      return new Date(d['Target Design']) < new Date();
    }).length;

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

    // Chart 1
    if (chart1Ref.current) {
      chartInstancesRef.current.c1 = new ChartJS(chart1Ref.current, {
        type: 'bar',
        data: {
          labels: c1Labels.length ? c1Labels : ['Tidak ada data pada periode ini'],
          datasets: [{
            label: 'Qty Drawing',
            data: c1Values.length ? c1Values : [0],
            backgroundColor: 'rgba(59, 130, 246, 0.85)',
            borderColor: '#2563eb',
            borderWidth: 1,
            borderRadius: 6
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
      chartInstancesRef.current.c2 = new ChartJS(chart2Ref.current, {
        type: 'bar',
        data: {
          labels: c2Labels.length ? c2Labels : ['Tidak ada data pada periode ini'],
          datasets: [{
            label: 'Jumlah SPK Marketing',
            data: c2Values.length ? c2Values : [0],
            backgroundColor: 'rgba(16, 185, 129, 0.85)',
            borderColor: '#059669',
            borderWidth: 1,
            borderRadius: 6
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
            { label: 'Customer Unik', data: c3Cust, backgroundColor: 'rgba(139, 92, 246, 0.85)', borderRadius: 4 },
            { label: 'Permintaan Proyek', data: c3Permintaan, backgroundColor: 'rgba(16, 185, 129, 0.85)', borderRadius: 4 },
            { label: 'Total Qty Drawing', data: c3Qty, backgroundColor: 'rgba(59, 130, 246, 0.85)', borderRadius: 4 }
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
        item['Aktual Engineering'] || '',
        item.keterangan || ''
      ]);

      autoTable(doc, {
        startY: 22,
        head: [['No', 'Bulan', 'SPK', 'Customer', 'Nama Project', 'Status', 'PIC', 'Qty', 'Target Design', 'Aktual Eng', 'Keterangan']],
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
    <div className="space-y-6">
      {/* Sub-Navigation Tabs: Monitoring Drawing vs Serah Terima Standart Part */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveMonitoringTab('drawingProjects')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
              activeMonitoringTab === 'drawingProjects'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <FolderOpen className="w-4 h-4" />
            <span>Monitoring Drawing & SPK</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              activeMonitoringTab === 'drawingProjects' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {projects.length} Proyek
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMonitoringTab('standartPartHandover')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition ${
              activeMonitoringTab === 'standartPartHandover'
                ? 'bg-[#8B2635] text-white shadow-md shadow-rose-900/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className={`w-4 h-4 ${activeMonitoringTab === 'standartPartHandover' ? 'text-rose-200' : 'text-[#8B2635]'}`} />
            <span>Serah Terima Standart Part</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
              activeMonitoringTab === 'standartPartHandover' ? 'bg-[#701e2a] text-white' : 'bg-rose-100 text-[#8B2635] font-semibold'
            }`}>
              KMIL/FM-ENG/01-004
            </span>
          </button>
        </div>

        <div className="hidden md:flex items-center space-x-2 text-xs text-slate-500 px-3">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span className="font-medium text-slate-600">Departemen Engineering Plant CDR & BTG</span>
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
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Project</p>
            <h3 className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</h3>
            <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block mt-1 font-medium">
              Tahun {filterYear}
            </span>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shadow-inner">
            <FolderOpen className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">On Progress</p>
            <h3 className="text-2xl font-bold text-amber-600 mt-1">{stats.onProgress}</h3>
            <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full inline-block mt-1 font-medium">
              Aktif Desain
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl shadow-inner">
            <RotateCw className="w-5 h-5 animate-spin-slow" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Selesai (Done)</p>
            <h3 className="text-2xl font-bold text-emerald-600 mt-1">{stats.done}</h3>
            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full inline-block mt-1 font-medium">
              Tuntas Rilis
            </span>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shadow-inner">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue</p>
            <h3 className="text-2xl font-bold text-rose-600 mt-1">{stats.overdue}</h3>
            <span className="text-[10px] text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full inline-block mt-1 font-medium">
              Lewat Target
            </span>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl shadow-inner">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Revisi / Menunggu</p>
            <h3 className="text-2xl font-bold text-purple-600 mt-1">{stats.revisi}</h3>
            <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full inline-block mt-1 font-medium">
              Feedback Loop
            </span>
          </div>
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl shadow-inner">
            <Clock3 className="w-5 h-5" />
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-100 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-800 flex items-center space-x-2">
              <BarChart2 className="w-5 h-5 text-blue-600" />
              <span>Analitik & Performa Drawing Engineering</span>
            </h2>
            <p className="text-xs text-slate-500">
              Visualisasi real-time permintaan gambar, beban kerja per customer, dan komparasi kuartal sesuai filter periode aktif
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  globalChartDim === '2D'
                    ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
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
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                  globalChartDim === '3D'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Box className="w-3.5 h-3.5" />
                <span>3D WebGL</span>
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            <span className="text-xs font-semibold text-slate-600">Filter Periode:</span>
            {/* Filter Bulan / Kuartal */}
            <select
              value={filterMonth}
              onChange={(e) => {
                setFilterMonth(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-700"
            >
              <option value="ALL">Semua Bulan / Kuartal</option>
              <optgroup label="Kuartal">
                <option value="Q1">Kuartal 1 (Jan - Mar)</option>
                <option value="Q2">Kuartal 2 (Apr - Jun)</option>
                <option value="Q3">Kuartal 3 (Jul - Sep)</option>
                <option value="Q4">Kuartal 4 (Okt - Des)</option>
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

            {/* Filter Tahun */}
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-1.5 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-blue-600"
            >
              <option value="">Semua Tahun (2026-2030)</option>
              <option value="2026">Tahun 2026</option>
              <option value="2027">Tahun 2027</option>
              <option value="2028">Tahun 2028</option>
              <option value="2029">Tahun 2029</option>
              <option value="2030">Tahun 2030</option>
            </select>
          </div>
        </div>

        {/* 3 Modern Charts Stacked Vertically */}
        <div className="flex flex-col space-y-6">
          {/* Chart 1: Customer vs Qty Drawing */}
          <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200 shadow-sm transition-all duration-200">
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                  <span>1. Grafik Customer vs Qty Drawing</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Total akumulasi lembar drawing per customer • Periode: <span className="font-semibold text-blue-600">{filterMonth === 'ALL' ? 'Semua Bulan' : filterMonth} {filterYear ? `(${filterYear})` : ''}</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full border border-blue-200">
                  {filterMonth === 'ALL' ? 'Semua Periode' : filterMonth} {filterYear ? `(${filterYear})` : ''}
                </span>

                {/* Per-chart 2D / 3D pill toggle */}
                <div className="flex items-center space-x-0.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setChart1Dim('2D')}
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition ${
                      chart1Dim === '2D' ? 'bg-white text-blue-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setChart1Dim('3D')}
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition flex items-center space-x-1 ${
                      chart1Dim === '3D' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Box className="w-2.5 h-2.5" />
                    <span>3D</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={chart1Dim === '2D' ? 'h-72 w-full' : 'hidden'}>
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
          <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200 shadow-sm transition-all duration-200">
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
                  <span>2. Grafik Permintaan Drawing (Customer vs SPK)</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Jumlah nomor SPK project aktif per customer • Periode: <span className="font-semibold text-emerald-600">{filterMonth === 'ALL' ? 'Semua Bulan' : filterMonth} {filterYear ? `(${filterYear})` : ''}</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] bg-emerald-100 text-emerald-700 font-semibold px-2.5 py-1 rounded-full border border-emerald-200">
                  {filterMonth === 'ALL' ? 'Semua Periode' : filterMonth} {filterYear ? `(${filterYear})` : ''}
                </span>

                {/* Per-chart 2D / 3D pill toggle */}
                <div className="flex items-center space-x-0.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setChart2Dim('2D')}
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition ${
                      chart2Dim === '2D' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setChart2Dim('3D')}
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition flex items-center space-x-1 ${
                      chart2Dim === '3D' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Box className="w-2.5 h-2.5" />
                    <span>3D</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={chart2Dim === '2D' ? 'h-72 w-full' : 'hidden'}>
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
          <div className="bg-slate-50/80 p-5 rounded-xl border border-slate-200 shadow-sm transition-all duration-200">
            <div className="flex flex-wrap justify-between items-center mb-3 gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  <span>3. Grafik Rekap Engineering Bulanan & Kuartal</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  Perbandingan tren kuantitas drawing dan project per bulan • Menampilkan: <span className="font-semibold text-purple-600">{filterMonth === 'ALL' ? 'Semua Bulan (Januari - Desember)' : filterMonth} {filterYear ? `(${filterYear})` : ''}</span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] bg-purple-100 text-purple-700 font-semibold px-2.5 py-1 rounded-full border border-purple-200">
                  {filterMonth === 'ALL' ? 'Jan - Des' : filterMonth} {filterYear ? `(${filterYear})` : ''}
                </span>

                {/* Per-chart 2D / 3D pill toggle */}
                <div className="flex items-center space-x-0.5 bg-slate-200/80 p-0.5 rounded-lg border border-slate-300">
                  <button
                    type="button"
                    onClick={() => setChart3Dim('2D')}
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition ${
                      chart3Dim === '2D' ? 'bg-white text-purple-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    2D
                  </button>
                  <button
                    type="button"
                    onClick={() => setChart3Dim('3D')}
                    className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md transition flex items-center space-x-1 ${
                      chart3Dim === '3D' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Box className="w-2.5 h-2.5" />
                    <span>3D</span>
                  </button>
                </div>
              </div>
            </div>

            <div className={chart3Dim === '2D' ? 'h-80 w-full' : 'hidden'}>
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
                Anda memiliki akses penuh untuk melihat tabel monitoring, 3 grafik vertikal, 3D CAD viewer, serta ekspor PDF dan Excel. Hak akses menambah, mengedit, checklist, atau menghapus data terkunci. Untuk mengedit, ganti role ke Manager/Supervisor/Drafter dan masukkan PIN pada menu header.
              </p>
            </div>
          </div>
          <span className="shrink-0 px-3 py-1 text-[11px] font-bold bg-amber-200/80 text-amber-900 rounded-xl border border-amber-300">
            Read-Only Aktif
          </span>
        </div>
      )}

      {/* Toolbar & Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 space-y-3">
        {/* Buttons Row */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {!isReadOnly && (
              <button
                onClick={onAddClick}
                className="bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Data Baru</span>
              </button>
            )}

            <button
              onClick={onSyncCloud}
              className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-1.5"
            >
              <RotateCw className="w-4 h-4 text-emerald-400" />
              <span>Sinkronisasi Cloud</span>
            </button>

            <button
              onClick={() => onOpenCadViewer('SPK-DEMO', 'Default Machine Assembly', 'Engineering General')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-1.5"
            >
              <Box className="w-4 h-4" />
              <span>3D CAD / .STEP Viewer</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-1.5"
            >
              <FileDown className="w-4 h-4" />
              <span>Cetak Laporan PDF</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Ekspor Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMonitoringTab('standartPartHandover')}
              className="bg-[#8B2635] hover:bg-[#721f2b] text-white font-semibold text-xs px-3.5 py-2.5 rounded-xl shadow transition flex items-center space-x-1.5"
              title="Buka Form Serah Terima Standart Part (KMIL/FM-ENG/01-004)"
            >
              <Layers className="w-4 h-4 text-rose-300" />
              <span>Serah Terima Standart Part</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 pt-3 border-t border-slate-100">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Cari SPK</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={filterSpk}
                onChange={(e) => {
                  setFilterSpk(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Cth: SPK-2026..."
                className="text-xs bg-slate-50 border border-slate-300 rounded-lg pl-8 pr-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Cari Customer</label>
            <input
              type="text"
              value={filterCustomer}
              onChange={(e) => {
                setFilterCustomer(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Nama customer..."
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Cari Nama Project</label>
            <input
              type="text"
              value={filterProject}
              onChange={(e) => {
                setFilterProject(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Nama project..."
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 mb-1">Tahun Proyek</label>
            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-blue-600"
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
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:outline-none"
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
      </div>

      {/* Main Table with Frozen Sticky Columns */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
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
                  const isOverdue = item['Target Design'] && item.Status !== 'Selesai' && new Date(item['Target Design']) < new Date();
                  const isLate = item['Aktual Engineering'] && item['Target Design'] && new Date(item['Aktual Engineering']) > new Date(item['Target Design']);
                  const rowBg = isOverdue || isLate ? 'bg-rose-50/70 hover:bg-rose-100/60' : 'hover:bg-slate-50';

                  return (
                    <tr key={item.SPK} className={`${rowBg} transition-colors border-b border-slate-200`}>
                      <td className="p-3 sticky-col-1 text-center font-medium text-slate-600">{globalIdx}</td>
                      <td className="p-3 sticky-col-2 text-center font-semibold text-indigo-700">{item.Bulan}</td>
                      <td className="p-3 sticky-col-3 font-bold text-blue-600 font-mono">{item.SPK}</td>
                      <td className="p-3 sticky-col-4 font-mono text-slate-700 truncate" title={item['Nomor PO']}>{item['Nomor PO']}</td>
                      <td className="p-3 sticky-col-5 font-medium text-slate-800 truncate" title={item.Customer}>{item.Customer}</td>
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
                      <td className="p-3 text-center font-mono font-medium text-slate-700">{item['Target Design'] || '-'}</td>
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
                        {item.keterangan || '-'}
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
