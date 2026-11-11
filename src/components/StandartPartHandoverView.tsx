import React, { useState, useMemo } from 'react';
import { 
  SerahTerimaStandartPartItem, 
  EngineeringProject, 
  UserRole 
} from '../types/engineering';
import { MONTH_NAMES } from '../data/initialData';
import { 
  FileSpreadsheet, 
  FileDown, 
  Plus, 
  RotateCw, 
  Search, 
  Trash2, 
  PenSquare, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Layers, 
  UserPlus, 
  X, 
  Check, 
  Printer,
  Sparkles,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface StandartPartHandoverViewProps {
  handoverList: SerahTerimaStandartPartItem[];
  onUpdateHandoverList: (items: SerahTerimaStandartPartItem[] | ((prev: SerahTerimaStandartPartItem[]) => SerahTerimaStandartPartItem[])) => void;
  projects: EngineeringProject[];
  userRole: UserRole;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}

export const StandartPartHandoverView: React.FC<StandartPartHandoverViewProps> = ({
  handoverList,
  onUpdateHandoverList,
  projects,
  userRole,
  showToast
}) => {
  const [selectedMonth, setSelectedMonth] = useState<string>('Oktober');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<SerahTerimaStandartPartItem | null>(null);

  // Form State in Modal
  const [formData, setFormData] = useState<{
    id?: string;
    month: string;
    projectName: string;
    customer: string;
    prepareStaff: string[];
    partNames: string[];
    distributionDate: string;
    distributionTime: string;
    division: string;
    signature: string;
    notes: string;
  }>({
    month: 'Oktober',
    projectName: '',
    customer: '',
    prepareStaff: [''],
    partNames: [''],
    distributionDate: new Date().toISOString().split('T')[0],
    distributionTime: '09:00 WIB',
    division: 'Assembly',
    signature: '',
    notes: ''
  });

  // Quick Inline Add Staff / Part State
  const [quickStaffInput, setQuickStaffInput] = useState<{ rowId: string; name: string } | null>(null);
  const [quickPartInput, setQuickPartInput] = useState<{ rowId: string; name: string } | null>(null);

  const isReadOnly = userRole === 'Viewer';

  // Filtered List based on selectedMonth and searchQuery
  const filteredList = useMemo(() => {
    return handoverList.filter((item) => {
      const matchMonth = selectedMonth === 'ALL' || item.month.toLowerCase() === selectedMonth.toLowerCase();
      if (!matchMonth) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchProject = item.projectName?.toLowerCase().includes(q);
      const matchCust = item.customer?.toLowerCase().includes(q);
      const matchStaff = item.prepareStaff?.some((s) => s.toLowerCase().includes(q));
      const matchPart = item.partNames?.some((p) => p.toLowerCase().includes(q));
      const matchDivision = item.division?.toLowerCase().includes(q);
      return matchProject || matchCust || matchStaff || matchPart || matchDivision;
    });
  }, [handoverList, selectedMonth, searchQuery]);

  // Sync / Import all projects from Monitoring based on selectedMonth
  const handleAutoSyncFromMonitoring = () => {
    if (isReadOnly) {
      showToast('Akses Dibatasi: Role Viewer tidak dapat menyinkronkan data.', 'error');
      return;
    }

    const targetMonth = selectedMonth === 'ALL' ? 'Oktober' : selectedMonth;
    const monitoringProjectsInMonth = projects.filter(
      (p) => p.Bulan.toLowerCase() === targetMonth.toLowerCase()
    );

    if (monitoringProjectsInMonth.length === 0) {
      showToast(`Tidak ditemukan proyek monitoring pada bulan ${targetMonth}.`, 'info');
      return;
    }

    let addedCount = 0;
    onUpdateHandoverList((prev) => {
      const existingKeys = new Set(
        prev.map((item) => `${item.month.toLowerCase()}_${item.projectName.toLowerCase()}_${item.customer.toLowerCase()}`)
      );

      const newItems: SerahTerimaStandartPartItem[] = [];
      let currentMaxNo = prev.reduce((max, i) => Math.max(max, i.no || 0), 0);

      monitoringProjectsInMonth.forEach((p) => {
        const key = `${p.Bulan.toLowerCase()}_${p['Nama Project'].toLowerCase()}_${p.Customer.toLowerCase()}`;
        if (!existingKeys.has(key)) {
          currentMaxNo++;
          addedCount++;
          newItems.push({
            id: `stp-sync-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            no: currentMaxNo,
            month: p.Bulan,
            prepareStaff: p.PIC ? [p.PIC] : ['Staff Engineering'],
            projectName: p['Nama Project'],
            partNames: ['Standard Part ' + p['Nama Project']],
            customer: p.Customer,
            distributionDate: p['Target Design'] || new Date().toISOString().split('T')[0],
            distributionTime: '09:00 WIB',
            division: 'Assembly Jig',
            signature: p.PIC ? `${p.PIC} (Diserahkan)` : 'Pending',
            spk: p.SPK,
            notes: `Sinkron otomatis dari monitoring SPK: ${p.SPK}`
          });
          existingKeys.add(key);
        }
      });

      return [...prev, ...newItems];
    });

    if (addedCount > 0) {
      showToast(`Berhasil mengambil ${addedCount} data proyek monitoring pada bulan ${targetMonth}!`, 'success');
    } else {
      showToast(`Semua proyek monitoring bulan ${targetMonth} sudah ada dalam tabel.`, 'info');
    }
  };

  // Staff Tag Management (Add / Remove)
  const handleAddStaff = (itemId: string, staffName: string) => {
    if (!staffName.trim() || isReadOnly) return;
    onUpdateHandoverList((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          if (item.prepareStaff.includes(staffName.trim())) return item;
          return {
            ...item,
            prepareStaff: [...item.prepareStaff, staffName.trim()]
          };
        }
        return item;
      })
    );
    setQuickStaffInput(null);
    showToast(`Staff "${staffName.trim()}" ditambahkan.`);
  };

  const handleRemoveStaff = (itemId: string, staffName: string) => {
    if (isReadOnly) return;
    onUpdateHandoverList((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            prepareStaff: item.prepareStaff.filter((s) => s !== staffName)
          };
        }
        return item;
      })
    );
    showToast(`Staff "${staffName}" dihapus.`);
  };

  // Part Name Tag Management (Add / Remove)
  const handleAddPart = (itemId: string, partName: string) => {
    if (!partName.trim() || isReadOnly) return;
    onUpdateHandoverList((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            partNames: [...item.partNames, partName.trim()]
          };
        }
        return item;
      })
    );
    setQuickPartInput(null);
    showToast(`Part "${partName.trim()}" ditambahkan.`);
  };

  const handleRemovePart = (itemId: string, indexToRemove: number) => {
    if (isReadOnly) return;
    onUpdateHandoverList((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            partNames: item.partNames.filter((_, idx) => idx !== indexToRemove)
          };
        }
        return item;
      })
    );
    showToast(`Part berhasil dihapus.`);
  };

  // Inline Field Updates (Time, Date, Division, Signature)
  const handleInlineFieldChange = (itemId: string, field: 'distributionDate' | 'distributionTime' | 'division' | 'signature', value: string) => {
    if (isReadOnly) return;
    onUpdateHandoverList((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, [field]: value } : item))
    );
  };

  // Modal Open for Add / Edit
  const handleOpenAddModal = () => {
    if (isReadOnly) {
      showToast('Akses Dibatasi: Role Viewer tidak dapat menambah data.', 'error');
      return;
    }
    setEditingItem(null);
    setFormData({
      month: selectedMonth === 'ALL' ? 'Oktober' : selectedMonth,
      projectName: '',
      customer: '',
      prepareStaff: [''],
      partNames: [''],
      distributionDate: new Date().toISOString().split('T')[0],
      distributionTime: '09:00 WIB',
      division: 'Assembly Jig',
      signature: '',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: SerahTerimaStandartPartItem) => {
    if (isReadOnly) {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengedit data.', 'error');
      return;
    }
    setEditingItem(item);
    setFormData({
      id: item.id,
      month: item.month,
      projectName: item.projectName,
      customer: item.customer,
      prepareStaff: item.prepareStaff.length > 0 ? item.prepareStaff : [''],
      partNames: item.partNames.length > 0 ? item.partNames : [''],
      distributionDate: item.distributionDate,
      distributionTime: item.distributionTime,
      division: item.division,
      signature: item.signature,
      notes: item.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteItem = (id: string, name: string) => {
    if (isReadOnly) {
      showToast('Akses Dibatasi: Role Viewer tidak dapat menghapus data.', 'error');
      return;
    }
    if (window.confirm(`Hapus form serah terima standart part untuk proyek "${name}"?`)) {
      onUpdateHandoverList((prev) => prev.filter((i) => i.id !== id));
      showToast(`Data serah terima "${name}" telah dihapus.`);
    }
  };

  const handleSaveModal = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanStaff = formData.prepareStaff.map((s) => s.trim()).filter((s) => s.length > 0);
    const cleanParts = formData.partNames.map((p) => p.trim()).filter((p) => p.length > 0);

    if (editingItem) {
      onUpdateHandoverList((prev) =>
        prev.map((item) =>
          item.id === editingItem.id
            ? {
                ...item,
                month: formData.month,
                projectName: formData.projectName,
                customer: formData.customer,
                prepareStaff: cleanStaff.length > 0 ? cleanStaff : ['Staff'],
                partNames: cleanParts.length > 0 ? cleanParts : ['Part Standard'],
                distributionDate: formData.distributionDate,
                distributionTime: formData.distributionTime,
                division: formData.division,
                signature: formData.signature,
                notes: formData.notes
              }
            : item
        )
      );
      showToast(`Data serah terima "${formData.projectName}" berhasil diperbarui!`);
    } else {
      const newItem: SerahTerimaStandartPartItem = {
        id: `stp-${Date.now()}`,
        no: handoverList.length + 1,
        month: formData.month,
        projectName: formData.projectName,
        customer: formData.customer,
        prepareStaff: cleanStaff.length > 0 ? cleanStaff : ['Staff Engineering'],
        partNames: cleanParts.length > 0 ? cleanParts : ['Part Standard Baru'],
        distributionDate: formData.distributionDate,
        distributionTime: formData.distributionTime,
        division: formData.division,
        signature: formData.signature || 'Diserahkan',
        notes: formData.notes
      };
      onUpdateHandoverList((prev) => [...prev, newItem]);
      showToast(`Form serah terima baru untuk "${formData.projectName}" berhasil ditambahkan!`);
    }

    setIsModalOpen(false);
  };

  // Export Official KMIL PDF Form
  const handleExportOfficialPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Top Document Control Border
      doc.setDrawColor(40, 40, 40);
      doc.setLineWidth(0.4);

      // 1. Company Letterhead (Left Box)
      doc.rect(14, 10, 100, 24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(20, 20, 20);
      doc.text('PT. KURNIA MUSTIKA INDAH LESTARI', 16, 16);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('Precision Parts Specialist & Engineering Manufacturing', 16, 20);
      doc.setFontSize(6.5);
      doc.text('Jl. Cendrawasih Raya No. 10A RT.006, RW.007, Cengkareng, Jakarta Barat 11730', 16, 24);
      doc.text('Phone: (021) 5438 2995, 5439 4681 Fax: (021) 545 8040 e-mail: kmil@cbn.net.id', 16, 28);

      // 2. Title Box (Center Green)
      doc.setFillColor(209, 231, 221); // Light greenish
      doc.rect(114, 10, 100, 24, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(25, 60, 40);
      doc.text('Serah Terima Standart Part', 164, 23, { align: 'center' });

      // 3. Document Control Meta (Right Box)
      doc.rect(214, 10, 68, 24);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text('No. Dokumen', 216, 15);
      doc.text('Tgl. Berlaku', 216, 20);
      doc.text('No. Revisi', 216, 25);
      doc.text('Halaman', 216, 30);

      doc.setFont('helvetica', 'normal');
      doc.text(': KMIL/FM-ENG/01-004', 238, 15);
      doc.text(': Tuesday, 02 January 2024', 238, 20);
      doc.text(': 0', 238, 25);
      doc.text(': 1-1', 238, 30);

      // Table Data
      const tableRows = filteredList.map((item, idx) => [
        idx + 1,
        item.prepareStaff.join('\n'),
        item.projectName || '-',
        item.partNames.map((p, i) => `${i + 1}. ${p}`).join('\n'),
        item.customer || '-',
        item.distributionDate || '-',
        item.distributionTime || '-',
        item.division || '-',
        item.signature || '-'
      ]);

      autoTable(doc, {
        startY: 37,
        head: [
          [
            { content: 'No', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Prepare', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Project Name', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Part Name', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Customer', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Distribution', colSpan: 3, styles: { halign: 'center', valign: 'middle' } },
            { content: 'Signature', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }
          ],
          [
            { content: 'Date', styles: { halign: 'center', valign: 'middle' } },
            { content: 'Time', styles: { halign: 'center', valign: 'middle' } },
            { content: 'Division', styles: { halign: 'center', valign: 'middle' } }
          ]
        ],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [154, 52, 52], // Reddish brown matching image
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          lineColor: [60, 60, 60],
          lineWidth: 0.2
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [20, 20, 20],
          lineColor: [100, 100, 100],
          lineWidth: 0.2
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' },
          1: { cellWidth: 32 },
          2: { cellWidth: 46 },
          3: { cellWidth: 62 },
          4: { cellWidth: 42 },
          5: { cellWidth: 22, halign: 'center' },
          6: { cellWidth: 20, halign: 'center' },
          7: { cellWidth: 22, halign: 'center' },
          8: { cellWidth: 22, halign: 'center' }
        },
        margin: { left: 14, right: 14 }
      });

      doc.save(`Serah_Terima_Standart_Part_${selectedMonth}_2026.pdf`);
      showToast('Form Serah Terima Standart Part berhasil diekspor ke PDF!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal mencetak PDF resmi.', 'error');
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const exportData = filteredList.map((item, idx) => ({
      No: idx + 1,
      Bulan: item.month,
      Prepare_Staff: item.prepareStaff.join(', '),
      Project_Name: item.projectName,
      Part_Name: item.partNames.join('; '),
      Customer: item.customer,
      Distribution_Date: item.distributionDate,
      Distribution_Time: item.distributionTime,
      Distribution_Division: item.division,
      Signature: item.signature,
      Catatan: item.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Serah_Terima_Standart_Part');
    XLSX.writeFile(wb, `Serah_Terima_Standart_Part_${selectedMonth}.xlsx`);
    showToast('Data berhasil diekspor ke Excel!', 'success');
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Official Document Letterhead Banner (Exact Match to PDF) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 border-b border-slate-300">
          {/* Left Company Box */}
          <div className="md:col-span-5 p-4 border-b md:border-b-0 md:border-r border-slate-300 flex items-center space-x-3 bg-slate-50/50">
            <div className="w-12 h-12 rounded-full border border-red-500 flex items-center justify-center p-1 bg-white shrink-0 shadow-sm">
              {/* Kurnia Mustika Logo Icon */}
              <div className="w-9 h-9 rounded-full border-2 border-red-600 flex items-center justify-center font-bold text-red-600 text-xs">
                KMIL
              </div>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                PT. KURNIA MUSTIKA INDAH LESTARI
              </h2>
              <p className="text-[11px] font-semibold text-slate-700">
                Precision Parts Specialist & Engineering Manufacturing
              </p>
              <p className="text-[9.5px] text-slate-500 leading-tight mt-0.5">
                Jl. Cendrawasih Raya No. 10A RT.006, RW.007, Cengkareng, Jakarta Barat 11730
              </p>
              <p className="text-[9.5px] text-slate-500 leading-tight">
                Phone: (021) 5438 2995, 5439 4681 Fax: (021) 545 8040 e-mail: kmil@cbn.net.id
              </p>
            </div>
          </div>

          {/* Middle Document Title (Green Box) */}
          <div className="md:col-span-4 p-4 border-b md:border-b-0 md:border-r border-slate-300 bg-emerald-100/70 flex flex-col items-center justify-center text-center">
            <h1 className="text-base sm:text-lg font-black text-emerald-950 uppercase tracking-wide">
              Serah Terima Standart Part
            </h1>
            <span className="text-[10px] text-emerald-800 font-medium mt-0.5">
              Formulir Kontrol Distribusi Standard Part Engineering ke Produksi
            </span>
          </div>

          {/* Right Document Control Meta Box */}
          <div className="md:col-span-3 p-3 bg-slate-50/80 text-[11px] space-y-1 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-1 border-b border-slate-200 pb-1">
              <span className="font-bold text-slate-600">No. Dokumen:</span>
              <span className="font-mono font-bold text-slate-900">KMIL/FM-ENG/01-004</span>
            </div>
            <div className="grid grid-cols-2 gap-1 border-b border-slate-200 pb-1">
              <span className="font-bold text-slate-600">Tgl. Berlaku:</span>
              <span className="text-slate-800">Tuesday, 02 January 2024</span>
            </div>
            <div className="grid grid-cols-2 gap-1 border-b border-slate-200 pb-1">
              <span className="font-bold text-slate-600">No. Revisi:</span>
              <span className="font-mono text-slate-800">0</span>
            </div>
            <div className="grid grid-cols-2 gap-1">
              <span className="font-bold text-slate-600">Halaman:</span>
              <span className="font-mono text-slate-800">1-1</span>
            </div>
          </div>
        </div>

        {/* Action and Filter Control Bar */}
        <div className="p-4 bg-white flex flex-wrap items-center justify-between gap-3 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            {/* Month Filter */}
            <div className="flex items-center space-x-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <span className="text-[11px] font-bold text-slate-600 px-2">Bulan:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border border-slate-300 text-xs font-bold text-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ALL">Semua Bulan (Jan - Des)</option>
                {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari project, part, staff, customer..."
                className="text-xs bg-slate-50 border border-slate-300 rounded-xl pl-8 pr-3 py-1.5 w-64 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {!isReadOnly && (
              <>
                <button
                  onClick={handleAutoSyncFromMonitoring}
                  title="Ambil data Project Name & Customer dari dashboard monitoring berdasarkan bulan"
                  className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Ambil Data Otomatis dari Monitoring</span>
                </button>

                <button
                  onClick={handleOpenAddModal}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris</span>
                </button>
              </>
            )}

            <button
              onClick={handleExportOfficialPDF}
              className="px-3.5 py-1.5 bg-[#8B2635] hover:bg-[#721f2b] text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF Resmi</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Matching Uploaded Document */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-300 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              {/* Row 1 Header (Brown / Reddish matching document) */}
              <tr className="bg-[#9A3434] text-white text-[11px] font-bold border-b border-[#7e2929]">
                <th rowSpan={2} className="p-3 text-center border-r border-[#b34747] w-12">
                  No
                </th>
                <th rowSpan={2} className="p-3 border-r border-[#b34747] min-w-[170px]">
                  Prepare
                  <span className="block text-[9px] font-normal text-amber-200 mt-0.5">
                    (bisa tambah / hapus nama staff)
                  </span>
                </th>
                <th rowSpan={2} className="p-3 border-r border-[#b34747] min-w-[190px]">
                  Project Name
                  <span className="block text-[9px] font-normal text-amber-200 mt-0.5">
                    (isi otomatis dari monitoring)
                  </span>
                </th>
                <th rowSpan={2} className="p-3 border-r border-[#b34747] min-w-[220px]">
                  Part Name
                  <span className="block text-[9px] font-normal text-amber-200 mt-0.5">
                    (bisa isi beberapa nama part)
                  </span>
                </th>
                <th rowSpan={2} className="p-3 border-r border-[#b34747] min-w-[180px]">
                  Customer
                  <span className="block text-[9px] font-normal text-amber-200 mt-0.5">
                    (isi otomatis dari monitoring)
                  </span>
                </th>
                <th colSpan={3} className="p-2 text-center border-r border-[#b34747] bg-[#892d2d]">
                  Distribution
                </th>
                <th rowSpan={2} className="p-3 text-center border-r border-[#b34747] min-w-[130px]">
                  Signature
                </th>
                {!isReadOnly && (
                  <th rowSpan={2} className="p-3 text-center w-24">
                    Aksi
                  </th>
                )}
              </tr>

              {/* Row 2 Subheader under Distribution */}
              <tr className="bg-[#892d2d] text-white text-[10px] font-semibold border-b border-slate-300">
                <th className="p-2 text-center border-r border-[#a13b3b] min-w-[100px]">
                  Date
                </th>
                <th className="p-2 text-center border-r border-[#a13b3b] min-w-[90px]">
                  Time
                </th>
                <th className="p-2 text-center border-r border-[#a13b3b] min-w-[110px]">
                  Division
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 9 : 10} className="p-10 text-center text-slate-400 italic">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <Layers className="w-8 h-8 text-slate-300" />
                      <p>Belum ada data Serah Terima Standart Part pada bulan ini.</p>
                      {!isReadOnly && (
                        <button
                          onClick={handleAutoSyncFromMonitoring}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-semibold hover:bg-blue-100 transition"
                        >
                          Tarik data dari Dashboard Monitoring
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredList.map((item, idx) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition border-b border-slate-200">
                      {/* No */}
                      <td className="p-3 text-center font-bold text-slate-700 border-r border-slate-200">
                        {idx + 1}
                      </td>

                      {/* Prepare Staff (Multiple Staff with Add/Delete) */}
                      <td className="p-3 border-r border-slate-200">
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap gap-1.5">
                            {item.prepareStaff.map((staff) => (
                              <span
                                key={staff}
                                className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 text-[11px] font-medium"
                              >
                                <span>{staff}</span>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveStaff(item.id, staff)}
                                    title={`Hapus ${staff}`}
                                    className="hover:text-rose-600 transition"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>

                          {!isReadOnly && (
                            <div>
                              {quickStaffInput?.rowId === item.id ? (
                                <div className="flex items-center space-x-1 mt-1">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Nama staff..."
                                    value={quickStaffInput.name}
                                    onChange={(e) => setQuickStaffInput({ rowId: item.id, name: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddStaff(item.id, quickStaffInput.name);
                                      if (e.key === 'Escape') setQuickStaffInput(null);
                                    }}
                                    className="px-2 py-0.5 text-xs border border-blue-400 rounded focus:outline-none w-28 bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddStaff(item.id, quickStaffInput.name)}
                                    className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuickStaffInput(null)}
                                    className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setQuickStaffInput({ rowId: item.id, name: '' })}
                                  className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-0.5 pt-0.5"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Tambah Staff</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Project Name */}
                      <td className="p-3 font-semibold text-slate-800 border-r border-slate-200">
                        <div>
                          <span>{item.projectName}</span>
                          {item.spk && (
                            <span className="block text-[10px] font-mono text-blue-600 font-normal mt-0.5">
                              {item.spk}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Part Name (Multiple Parts with Add/Delete) */}
                      <td className="p-3 border-r border-slate-200">
                        <div className="space-y-1.5">
                          <ul className="space-y-1">
                            {item.partNames.map((part, pIdx) => (
                              <li
                                key={pIdx}
                                className="group flex items-center justify-between text-[11px] bg-slate-50 hover:bg-slate-100 p-1 rounded border border-slate-200 text-slate-800"
                              >
                                <span className="font-medium truncate pr-1">
                                  {pIdx + 1}. {part}
                                </span>
                                {!isReadOnly && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePart(item.id, pIdx)}
                                    title="Hapus part"
                                    className="opacity-70 group-hover:opacity-100 text-slate-400 hover:text-rose-600 shrink-0 ml-1"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>

                          {!isReadOnly && (
                            <div>
                              {quickPartInput?.rowId === item.id ? (
                                <div className="flex items-center space-x-1 mt-1">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Nama part standard..."
                                    value={quickPartInput.name}
                                    onChange={(e) => setQuickPartInput({ rowId: item.id, name: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleAddPart(item.id, quickPartInput.name);
                                      if (e.key === 'Escape') setQuickPartInput(null);
                                    }}
                                    className="px-2 py-0.5 text-xs border border-emerald-400 rounded focus:outline-none w-36 bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleAddPart(item.id, quickPartInput.name)}
                                    className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuickPartInput(null)}
                                    className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setQuickPartInput({ rowId: item.id, name: '' })}
                                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-0.5 pt-0.5"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>Tambah Part</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-3 text-slate-700 font-medium border-r border-slate-200">
                        {item.customer}
                      </td>

                      {/* Distribution Date */}
                      <td className="p-2 text-center border-r border-slate-200 font-mono text-[11px] text-slate-700">
                        {!isReadOnly ? (
                          <input
                            type="date"
                            value={item.distributionDate || ''}
                            onChange={(e) => handleInlineFieldChange(item.id, 'distributionDate', e.target.value)}
                            className="bg-transparent border-b border-dashed border-slate-300 hover:border-slate-500 text-center font-mono text-[11px] focus:outline-none w-full cursor-pointer"
                          />
                        ) : (
                          item.distributionDate || '-'
                        )}
                      </td>

                      {/* Distribution Time */}
                      <td className="p-2 text-center border-r border-slate-200 font-mono text-[11px] text-slate-700">
                        {!isReadOnly ? (
                          <input
                            type="text"
                            value={item.distributionTime || ''}
                            onChange={(e) => handleInlineFieldChange(item.id, 'distributionTime', e.target.value)}
                            placeholder="09:00 WIB"
                            className="bg-transparent border-b border-dashed border-slate-300 hover:border-slate-500 text-center font-mono text-[11px] focus:outline-none w-full"
                          />
                        ) : (
                          item.distributionTime || '-'
                        )}
                      </td>

                      {/* Distribution Division */}
                      <td className="p-2 text-center border-r border-slate-200 text-[11px]">
                        {!isReadOnly ? (
                          <select
                            value={item.division || 'Assembly'}
                            onChange={(e) => handleInlineFieldChange(item.id, 'division', e.target.value)}
                            className="bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 focus:outline-none w-full"
                          >
                            <option value="Assembly Jig">Assembly Jig</option>
                            <option value="Machining & Tooling">Machining & Tooling</option>
                            <option value="Purchasing">Purchasing</option>
                            <option value="QC & Testing">QC & Testing</option>
                            <option value="Workshop Produksi">Workshop Produksi</option>
                            <option value="Gudang Material">Gudang Material</option>
                          </select>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-medium text-slate-700">
                            {item.division}
                          </span>
                        )}
                      </td>

                      {/* Signature */}
                      <td className="p-2 text-center border-r border-slate-200 text-[11px]">
                        {!isReadOnly ? (
                          <input
                            type="text"
                            value={item.signature || ''}
                            onChange={(e) => handleInlineFieldChange(item.id, 'signature', e.target.value)}
                            placeholder="Nama penerima..."
                            className="bg-transparent border-b border-dashed border-slate-300 hover:border-slate-500 text-center text-[11px] focus:outline-none w-full font-semibold text-slate-800"
                          />
                        ) : (
                          <span className="font-semibold text-slate-800">
                            {item.signature || '-'}
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      {!isReadOnly && (
                        <td className="p-2 text-center">
                          <div className="flex items-center justify-center space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(item)}
                              title="Edit Form"
                              className="p-1 rounded text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                            >
                              <PenSquare className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id, item.projectName)}
                              title="Hapus Form"
                              className="p-1 rounded text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Serah Terima Standart Part */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-center justify-center p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-200 max-h-[92vh]">
            {/* Modal Header */}
            <div className="bg-[#8B2635] text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-xl text-white">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingItem ? 'Edit Form Serah Terima Standart Part' : 'Tambah Form Serah Terima Standart Part'}
                  </h3>
                  <p className="text-xs text-rose-100">
                    No. Dokumen: KMIL/FM-ENG/01-004
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-rose-100 hover:text-white p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Bulan</label>
                  <select
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                  >
                    {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Pilih dari Proyek Monitoring</label>
                  <select
                    onChange={(e) => {
                      const selectedProj = projects.find((p) => p['Nama Project'] === e.target.value);
                      if (selectedProj) {
                        setFormData((prev) => ({
                          ...prev,
                          projectName: selectedProj['Nama Project'],
                          customer: selectedProj.Customer,
                          month: selectedProj.Bulan || prev.month
                        }));
                      }
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-blue-700 font-semibold"
                  >
                    <option value="">-- Pilih Proyek Terdaftar --</option>
                    {projects.map((p) => (
                      <option key={p.SPK} value={p['Nama Project']}>
                        {p.SPK} - {p['Nama Project']} ({p.Customer})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Project Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.projectName}
                    onChange={(e) => setFormData({ ...formData, projectName: e.target.value })}
                    placeholder="Nama project..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Customer *</label>
                  <input
                    type="text"
                    required
                    value={formData.customer}
                    onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                    placeholder="Nama customer..."
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                  />
                </div>
              </div>

              {/* Prepare Staff List */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    Prepare Staff (Dapat diisi beberapa nama staff)
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, prepareStaff: [...formData.prepareStaff, ''] })}
                    className="text-[11px] text-blue-600 font-bold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Staff</span>
                  </button>
                </div>
                {formData.prepareStaff.map((staff, sIdx) => (
                  <div key={sIdx} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={staff}
                      onChange={(e) => {
                        const newStaff = [...formData.prepareStaff];
                        newStaff[sIdx] = e.target.value;
                        setFormData({ ...formData, prepareStaff: newStaff });
                      }}
                      placeholder={`Nama Staff ${sIdx + 1}...`}
                      className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-xs"
                    />
                    {formData.prepareStaff.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newStaff = formData.prepareStaff.filter((_, idx) => idx !== sIdx);
                          setFormData({ ...formData, prepareStaff: newStaff });
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Part Names List */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">
                    Part Name (Dapat diisi beberapa nama part)
                  </label>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, partNames: [...formData.partNames, ''] })}
                    className="text-[11px] text-emerald-600 font-bold flex items-center space-x-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Part</span>
                  </button>
                </div>
                {formData.partNames.map((part, pIdx) => (
                  <div key={pIdx} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={part}
                      onChange={(e) => {
                        const newParts = [...formData.partNames];
                        newParts[pIdx] = e.target.value;
                        setFormData({ ...formData, partNames: newParts });
                      }}
                      placeholder={`Nama Part ${pIdx + 1} (cth: Linear Bearing, Bolt M8, Cylinder)...`}
                      className="flex-1 bg-white border border-slate-300 rounded-lg p-1.5 text-xs"
                    />
                    {formData.partNames.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newParts = formData.partNames.filter((_, idx) => idx !== pIdx);
                          setFormData({ ...formData, partNames: newParts });
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Distribution Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Distribution Date</label>
                  <input
                    type="date"
                    value={formData.distributionDate}
                    onChange={(e) => setFormData({ ...formData, distributionDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Distribution Time</label>
                  <input
                    type="text"
                    value={formData.distributionTime}
                    onChange={(e) => setFormData({ ...formData, distributionTime: e.target.value })}
                    placeholder="09:30 WIB"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Division Penerima</label>
                  <select
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                  >
                    <option value="Assembly Jig">Assembly Jig</option>
                    <option value="Machining & Tooling">Machining & Tooling</option>
                    <option value="Purchasing">Purchasing</option>
                    <option value="QC & Testing">QC & Testing</option>
                    <option value="Workshop Produksi">Workshop Produksi</option>
                    <option value="Gudang Material">Gudang Material</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Signature / Nama PIC Penerima</label>
                <input
                  type="text"
                  value={formData.signature}
                  onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                  placeholder="Nama penerima / penyerah part..."
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-semibold"
                />
              </div>

              {/* Modal Footer */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#8B2635] hover:bg-[#701e2a] text-white rounded-xl text-xs font-bold shadow-md"
                >
                  {editingItem ? 'Simpan Perubahan' : 'Simpan Data'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
