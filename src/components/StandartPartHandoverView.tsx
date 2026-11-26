import React, { useState, useMemo, useRef } from 'react';
import { 
  SerahTerimaStandartPartItem, 
  StandartPartAttachment,
  EngineeringProject, 
  UserRole 
} from '../types/engineering';
import { MONTH_NAMES } from '../data/initialData';
import {
  ACCEPTED_PART_FILE_TYPES,
  processPartAttachmentFile,
  formatFileSize
} from '../utils/partAttachmentUtils';
import { PartAttachmentPreviewModal } from './PartAttachmentPreviewModal';
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
  AlertCircle,
  FileText,
  LayoutGrid,
  Table2,
  Upload,
  Camera,
  Eye,
  Paperclip
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
  const [mobileDisplayMode, setMobileDisplayMode] = useState<'cards' | 'table'>('cards');

  // Form State in Modal
  const [formData, setFormData] = useState<{
    id?: string;
    month: string;
    projectName: string;
    customer: string;
    prepareStaff: string[];
    partNames: Array<{ name: string; qty: string }>;
    partAttachments: StandartPartAttachment[];
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
    partNames: [],
    partAttachments: [],
    distributionDate: '',
    distributionTime: '09:00 WIB',
    division: 'Assembly',
    signature: '',
    notes: ''
  });

  // Quick Inline Add Staff / Part / Receiver State
  const [quickStaffInput, setQuickStaffInput] = useState<{ rowId: string; name: string } | null>(null);
  const [quickPartInput, setQuickPartInput] = useState<{ rowId: string; name: string; qty: string } | null>(null);
  const [editingPartQty, setEditingPartQty] = useState<{ rowId: string; partIdx: number; qty: string } | null>(null);
  const [quickReceiverInput, setQuickReceiverInput] = useState<{ rowId: string; name: string } | null>(null);

  // Part Attachment Upload & Preview State
  const partFileInputRef = useRef<HTMLInputElement | null>(null);
  const uploadTargetRef = useRef<{
    mode: 'row' | 'modal';
    rowId?: string;
    partIndex?: number;
    partLabel?: string;
  } | null>(null);
  const [uploadingRowId, setUploadingRowId] = useState<string | null>(null);
  const [previewAttachmentState, setPreviewAttachmentState] = useState<{
    attachment: StandartPartAttachment;
    sourceMode: 'row' | 'modal';
    rowId?: string;
  } | null>(null);

  const isReadOnly = userRole === 'Viewer';

  // Helper parse & format Part Name + Qty (contoh: "Bolt M8 (Qty: 4)")
  const parsePartWithQty = (raw: string): { name: string; qty: string } => {
    const match = raw.match(/^(.*?)\s*\(Qty:\s*([^)]+)\)\s*$/i);
    if (match) {
      return { name: match[1].trim(), qty: match[2].trim() };
    }
    return { name: raw.trim(), qty: '1' };
  };

  const formatPartWithQty = (name: string, qty: string | number): string => {
    const cleanName = name.trim();
    const cleanQty = String(qty ?? '').trim() || '1';
    if (!cleanName) return '';
    return `${cleanName} (Qty: ${cleanQty})`;
  };

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
      const matchAttachment = item.partAttachments?.some(
        (att) => att.fileName.toLowerCase().includes(q) || att.partLabel?.toLowerCase().includes(q)
      );
      const matchDivision = item.division?.toLowerCase().includes(q);
      return matchProject || matchCust || matchStaff || matchPart || matchAttachment || matchDivision;
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
            partNames: [],
            customer: p.Customer,
            distributionDate: '',
            distributionTime: '09:00 WIB',
            division: 'Assembly Jig',
            signature: p.PIC ? `${p.PIC} (Diterima)` : 'Diterima',
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

  // Part Name Tag Management (Add / Update Qty / Remove)
  const handleAddPart = (itemId: string, partName: string, partQty: string = '1') => {
    if (!partName.trim() || isReadOnly) return;
    const cleanQty = partQty.trim() || '1';
    const formattedPart = formatPartWithQty(partName, cleanQty);
    onUpdateHandoverList((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return {
            ...item,
            partNames: [...item.partNames, formattedPart]
          };
        }
        return item;
      })
    );
    setQuickPartInput(null);
    showToast(`Part "${partName.trim()}" (Qty: ${cleanQty}) ditambahkan.`);
  };

  const handleUpdatePartQty = (itemId: string, partIdx: number, newQty: string) => {
    if (isReadOnly) return;
    const cleanQty = newQty.trim() || '1';
    onUpdateHandoverList((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const updatedParts = item.partNames.map((p, idx) => {
            if (idx !== partIdx) return p;
            const parsed = parsePartWithQty(p);
            return formatPartWithQty(parsed.name, cleanQty);
          });
          return {
            ...item,
            partNames: updatedParts
          };
        }
        return item;
      })
    );
    setEditingPartQty(null);
    showToast(`Qty part diperbarui menjadi ${cleanQty}.`);
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

  // Part Photo / PDF Attachment Management
  const triggerPartFileUpload = (target: {
    mode: 'row' | 'modal';
    rowId?: string;
    partIndex?: number;
    partLabel?: string;
  }) => {
    if (isReadOnly) {
      showToast('Akses Dibatasi: Role Viewer tidak dapat mengunggah lampiran.', 'error');
      return;
    }
    uploadTargetRef.current = target;
    if (partFileInputRef.current) {
      partFileInputRef.current.value = '';
      partFileInputRef.current.click();
    }
  };

  const handlePartFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    const target = uploadTargetRef.current;
    if (!files.length || !target) return;

    const targetKey = target.mode === 'modal' ? 'MODAL' : target.rowId || '';
    setUploadingRowId(targetKey);

    try {
      const existingList: StandartPartAttachment[] =
        target.mode === 'modal'
          ? formData.partAttachments
          : handoverList.find((i) => i.id === target.rowId)?.partAttachments || [];

      const accumulated = [...existingList];
      const newlyAdded: StandartPartAttachment[] = [];

      for (const file of files) {
        try {
          const processed = await processPartAttachmentFile(file, {
            partIndex: target.partIndex,
            partLabel: target.partLabel,
            existingAttachments: accumulated
          });
          accumulated.push(processed);
          newlyAdded.push(processed);
        } catch (fileErr: any) {
          showToast(fileErr?.message || `Gagal memproses file "${file.name}".`, 'error');
        }
      }

      if (newlyAdded.length > 0) {
        if (target.mode === 'modal') {
          setFormData((prev) => ({
            ...prev,
            partAttachments: [...prev.partAttachments, ...newlyAdded]
          }));
        } else if (target.rowId) {
          onUpdateHandoverList((prev) =>
            prev.map((item) =>
              item.id === target.rowId
                ? {
                    ...item,
                    partAttachments: [...(item.partAttachments || []), ...newlyAdded]
                  }
                : item
            )
          );
        }
        showToast(
          `${newlyAdded.length} lampiran Foto/PDF berhasil diunggah ke kolom Part Name.`,
          'success'
        );
      }
    } finally {
      setUploadingRowId(null);
      if (partFileInputRef.current) {
        partFileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveRowAttachment = (rowId: string, attachmentId: string) => {
    if (isReadOnly) return;
    onUpdateHandoverList((prev) =>
      prev.map((item) =>
        item.id === rowId
          ? {
              ...item,
              partAttachments: (item.partAttachments || []).filter((att) => att.id !== attachmentId)
            }
          : item
      )
    );
    if (previewAttachmentState?.attachment.id === attachmentId) {
      setPreviewAttachmentState(null);
    }
    showToast('Lampiran part berhasil dihapus.');
  };

  const handleRemoveModalAttachment = (attachmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      partAttachments: prev.partAttachments.filter((att) => att.id !== attachmentId)
    }));
    if (previewAttachmentState?.attachment.id === attachmentId) {
      setPreviewAttachmentState(null);
    }
  };

  // Recipient / Signature Management (Diterima)
  const handleSetReceiver = (itemId: string, receiverName: string) => {
    if (!receiverName.trim() || isReadOnly) return;
    const cleanName = receiverName.trim();
    const formatted = cleanName.includes('(Diterima)')
      ? cleanName
      : `${cleanName} (Diterima)`;

    onUpdateHandoverList((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, signature: formatted } : item))
    );
    setQuickReceiverInput(null);
    showToast(`Penerima "${formatted}" berhasil disimpan!`);
  };

  const handleAppendReceiver = (itemId: string, receiverName: string) => {
    if (!receiverName.trim() || isReadOnly) return;
    const cleanName = receiverName.trim();
    const formatted = cleanName.includes('(Diterima)')
      ? cleanName
      : `${cleanName} (Diterima)`;

    onUpdateHandoverList((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const current = item.signature ? item.signature.trim() : '';
          const newSig = current ? `${current}, ${formatted}` : formatted;
          return { ...item, signature: newSig };
        }
        return item;
      })
    );
    setQuickReceiverInput(null);
    showToast(`Penerima "${formatted}" berhasil ditambahkan!`);
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
      partNames: [],
      partAttachments: [],
      distributionDate: '',
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
      prepareStaff: item.prepareStaff && item.prepareStaff.length > 0 ? item.prepareStaff : [''],
      partNames:
        item.partNames && item.partNames.length > 0
          ? item.partNames.map((p) => parsePartWithQty(p))
          : [],
      partAttachments: item.partAttachments ? [...item.partAttachments] : [],
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
    const cleanParts = formData.partNames
      .filter((p) => p.name.trim().length > 0)
      .map((p) => formatPartWithQty(p.name, p.qty));

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
                partNames: cleanParts,
                partAttachments: formData.partAttachments,
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
        partNames: cleanParts,
        partAttachments: formData.partAttachments,
        distributionDate: formData.distributionDate,
        distributionTime: formData.distributionTime,
        division: formData.division,
        signature: formData.signature || 'Diterima',
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
      const tableRows = filteredList.map((item, idx) => {
        const partLines = item.partNames.map((p, i) => `${i + 1}. ${p}`);
        if (item.partAttachments && item.partAttachments.length > 0) {
          partLines.push(
            `[Lampiran: ${item.partAttachments.map((a) => a.fileName).join(', ')}]`
          );
        }
        return [
          idx + 1,
          item.prepareStaff.join('\n'),
          item.projectName || '-',
          partLines.length > 0 ? partLines.join('\n') : '-',
          item.customer || '-',
          item.distributionDate || '-',
          item.distributionTime || '-',
          item.division || '-',
          item.signature || '-'
        ];
      });

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
      Lampiran_Foto_PDF: (item.partAttachments || []).map((a) => a.fileName).join('; '),
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

  // Helper untuk format tanggal Indonesia yang rapi (misal: "18 Oktober 2026")
  const formatIndonesianDate = (dateStr?: string): string => {
    if (!dateStr || !dateStr.trim()) return '- (Belum Ditentukan)';
    if (dateStr.includes('-')) {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const y = parts[0];
        const mIdx = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const indonesianMonths = [
          'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
          'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
        ];
        if (mIdx >= 0 && mIdx < 12 && !isNaN(d)) {
          return `${d} ${indonesianMonths[mIdx]} ${y}`;
        }
      }
    }
    return dateStr;
  };

  // Cetak Dokumen Resmi BAP (Berita Acara Penyerahan) Standart Part per Baris Data
  const handlePrintSingleBAP = (item: SerahTerimaStandartPartItem) => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = 210;
      const pageHeight = 297;
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;

      // 1. Company Letterhead (PT. KMIL)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(154, 52, 52); // Maroon KMIL
      doc.text('PT. KURNIA MUSTIKA INDAH LESTARI', margin, 18);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(50, 50, 50);
      doc.text('Precision Parts Specialist & Engineering Manufacturing', margin, 22.5);

      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.text('Jl. Cendrawasih Raya No. 10A RT.006, RW.007, Cengkareng, Jakarta Barat 11730', margin, 26.5);
      doc.text('Phone: (021) 5438 2995, 5439 4681 | Fax: (021) 545 8040 | Email: kmil@cbn.net.id', margin, 30);

      // Top Right Document Control Box
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.2);
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(pageWidth - margin - 64, 12, 64, 21, 1.5, 1.5, 'FD');

      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('No. Dokumen', pageWidth - margin - 62, 16.5);
      doc.text('Tgl. Berlaku', pageWidth - margin - 62, 21);
      doc.text('No. Revisi', pageWidth - margin - 62, 25.5);
      doc.text('Halaman', pageWidth - margin - 62, 30);

      doc.setFont('helvetica', 'normal');
      doc.text(': KMIL/BAP-ENG/01-004', pageWidth - margin - 42, 16.5);
      doc.text(': 02 Januari 2024', pageWidth - margin - 42, 21);
      doc.text(': 00', pageWidth - margin - 42, 25.5);
      doc.text(': 1 dari 1', pageWidth - margin - 42, 30);

      // Decorative divider bar
      doc.setDrawColor(154, 52, 52);
      doc.setLineWidth(0.8);
      doc.line(margin, 35, pageWidth - margin, 35);

      doc.setDrawColor(210, 210, 210);
      doc.setLineWidth(0.2);
      doc.line(margin, 36.5, pageWidth - margin, 36.5);

      // 2. Title Section
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13.5);
      doc.setTextColor(20, 20, 20);
      doc.text('BERITA ACARA PENYERAHAN (BAP)', pageWidth / 2, 45, { align: 'center' });

      doc.setFontSize(10.5);
      doc.setTextColor(154, 52, 52);
      doc.text('STANDART PART ENGINEERING', pageWidth / 2, 50.5, { align: 'center' });

      // Generate Clean BAP Number
      const year = '2026';
      const cleanBAPNo = `BAP/ENG/${year}/${item.month.substring(0, 3).toUpperCase()}/${String(item.no || 1).padStart(3, '0')}`;

      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(70, 70, 70);
      doc.text(`Nomor Dokumen: ${cleanBAPNo}`, pageWidth / 2, 55.5, { align: 'center' });

      // 3. Preamble Paragraph
      doc.setFontSize(8.5);
      doc.setTextColor(30, 30, 30);
      const preambleText = 'Pada hari ini, bertempat di Departemen Engineering PT. Kurnia Mustika Indah Lestari, telah diserahkan sejumlah Standart Part untuk kebutuhan perakitan dan proses produksi dengan rincian data sebagai berikut:';
      const splitPreamble = doc.splitTextToSize(preambleText, contentWidth);
      doc.text(splitPreamble, margin, 63);

      // 4. Detail Metadata Table
      const formattedDate = formatIndonesianDate(item.distributionDate);
      const recipientName = item.signature && item.signature.trim() ? item.signature.trim() : '- (Belum Diisi)';
      const prepareNames = item.prepareStaff && item.prepareStaff.length > 0
        ? item.prepareStaff.filter(Boolean).join(', ')
        : '-';

      autoTable(doc, {
        startY: 70,
        margin: { left: margin, right: margin },
        theme: 'plain',
        body: [
          [
            { content: 'Project Name', styles: { fontStyle: 'bold', cellWidth: 32 } },
            { content: `: ${item.projectName || '-'}`, styles: { fontStyle: 'bold', cellWidth: 59 } },
            { content: 'Tanggal Penyerahan', styles: { fontStyle: 'bold', cellWidth: 36 } },
            { content: `: ${formattedDate}`, styles: { fontStyle: 'bold', textColor: [154, 52, 52], cellWidth: 55 } }
          ],
          [
            { content: 'Customer', styles: { fontStyle: 'bold' } },
            { content: `: ${item.customer || '-'}` },
            { content: 'Waktu Distribusi', styles: { fontStyle: 'bold' } },
            { content: `: ${item.distributionTime || '-'}` }
          ],
          [
            { content: 'Diserahkan Oleh', styles: { fontStyle: 'bold' } },
            { content: `: ${prepareNames}` },
            { content: 'Divisi Penerima', styles: { fontStyle: 'bold' } },
            { content: `: ${item.division || 'Assembly'}` }
          ],
          [
            { content: 'Diterima Oleh', styles: { fontStyle: 'bold' } },
            { content: `: ${recipientName}`, styles: { fontStyle: 'bold', textColor: [16, 120, 60] } },
            { content: 'Bulan / Periode', styles: { fontStyle: 'bold' } },
            { content: `: ${item.month} 2026` }
          ]
        ],
        styles: {
          fontSize: 8.5,
          textColor: [30, 30, 30],
          cellPadding: 1.6
        }
      });

      const metaEndY = (doc as any).lastAutoTable?.finalY || 92;

      // 5. Parts List Section Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(20, 20, 20);
      doc.text('A. DAFTAR STANDART PART YANG DISERAHKAN', margin, metaEndY + 7);

      const activeParts = item.partNames && item.partNames.filter(p => p && p.trim()).length > 0
        ? item.partNames.filter(p => p && p.trim())
        : [];

      const partsRows = activeParts.length > 0
        ? activeParts.map((rawPart, pIdx) => {
            const { name, qty } = parsePartWithQty(rawPart);
            const qtyDisplay = qty ? `${qty} Pcs` : '1 Set / Sesuai BOM';
            return [
              pIdx + 1,
              name,
              qtyDisplay,
              item.division || 'Assembly',
              'Lengkap & Sesuai Spesifikasi'
            ];
          })
        : [[1, 'Semua Standart Part Sesuai Drawing Project', '1 Lot', item.division || 'Assembly', 'Lengkap & Sesuai Spesifikasi']];

      autoTable(doc, {
        startY: metaEndY + 10,
        margin: { left: margin, right: margin },
        head: [
          [
            { content: 'No', styles: { halign: 'center', cellWidth: 10 } },
            { content: 'Nama Part / Standart Part', styles: { cellWidth: 78 } },
            { content: 'Qty / Satuan', styles: { halign: 'center', cellWidth: 32 } },
            { content: 'Divisi Tujuan', styles: { halign: 'center', cellWidth: 30 } },
            { content: 'Kondisi & Status', styles: { halign: 'center', cellWidth: 32 } }
          ]
        ],
        body: partsRows,
        theme: 'grid',
        headStyles: {
          fillColor: [154, 52, 52],
          textColor: [255, 255, 255],
          fontSize: 8.5,
          fontStyle: 'bold',
          lineColor: [80, 80, 80],
          lineWidth: 0.2
        },
        bodyStyles: {
          fontSize: 8,
          textColor: [30, 30, 30],
          lineColor: [180, 180, 180],
          lineWidth: 0.15,
          cellPadding: 2.2
        },
        columnStyles: {
          0: { halign: 'center' },
          1: { fontStyle: 'bold' },
          2: { halign: 'center' },
          3: { halign: 'center' },
          4: { halign: 'center', textColor: [16, 120, 60] }
        }
      });

      const partsEndY = (doc as any).lastAutoTable?.finalY || 140;

      // 6. Notes & Terms Box
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(220, 226, 232);
      doc.roundedRect(margin, partsEndY + 5, contentWidth, 20, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(154, 52, 52);
      doc.text('CATATAN & KETENTUAN SERAH TERIMA:', margin + 3, partsEndY + 9.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(60, 60, 60);
      doc.text('1. Standart part telah diverifikasi fisik dan ukurannya sesuai dengan dokumen drawing CAD engineering.', margin + 3, partsEndY + 14);
      doc.text('2. Divisi penerima bertanggung jawab penuh atas penyimpanan dan perakitan part setelah berita acara ini diserahterimakan.', margin + 3, partsEndY + 18);
      doc.text('3. Apabila ditemukan ketidaksesuaian atau cacat komponen, segera laporkan ke Departemen Engineering maksimal 1x24 jam kerja.', margin + 3, partsEndY + 22);

      // 7. Signature Block (3 Columns)
      const signStartY = partsEndY + 32;
      const colWidth = contentWidth / 3;

      // Diserahkan Oleh
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text('Diserahkan Oleh,', margin + colWidth * 0.5, signStartY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text('Staff Engineering / Drafter', margin + colWidth * 0.5, signStartY + 4.5, { align: 'center' });

      // Mengetahui
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text('Mengetahui,', margin + colWidth * 1.5, signStartY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text('Engineering Manager', margin + colWidth * 1.5, signStartY + 4.5, { align: 'center' });

      // Diterima Oleh
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(40, 40, 40);
      doc.text('Diterima Oleh,', margin + colWidth * 2.5, signStartY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text(`Penerima (${item.division || 'Assembly'})`, margin + colWidth * 2.5, signStartY + 4.5, { align: 'center' });

      const lineY = signStartY + 27;

      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.3);
      doc.line(margin + 5, lineY, margin + colWidth - 5, lineY);
      doc.line(margin + colWidth + 5, lineY, margin + colWidth * 2 - 5, lineY);
      doc.line(margin + colWidth * 2 + 5, lineY, margin + contentWidth - 5, lineY);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(20, 20, 20);

      const primaryStaff = item.prepareStaff && item.prepareStaff[0] ? item.prepareStaff[0] : 'Tim Engineering';
      doc.text(`( ${primaryStaff} )`, margin + colWidth * 0.5, lineY + 4.5, { align: 'center' });
      doc.text('( Andry Setyawan )', margin + colWidth * 1.5, lineY + 4.5, { align: 'center' });

      const cleanReceiver = item.signature ? item.signature.replace(/\(Diterima\)/gi, '').trim() : '';
      doc.text(`( ${cleanReceiver || '................................'} )`, margin + colWidth * 2.5, lineY + 4.5, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(110, 110, 110);
      const signDate = formattedDate !== '- (Belum Ditentukan)' ? formattedDate : '................';
      doc.text(`Tgl: ${signDate}`, margin + colWidth * 0.5, lineY + 8.5, { align: 'center' });
      doc.text(`Tgl: ${signDate}`, margin + colWidth * 1.5, lineY + 8.5, { align: 'center' });
      doc.text(`Tgl: ${signDate}`, margin + colWidth * 2.5, lineY + 8.5, { align: 'center' });

      // 8. Footer & Verification
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      const now = new Date();
      const printDateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} WIB`;

      doc.setFontSize(6.5);
      doc.setTextColor(130, 130, 130);
      doc.text(`Dokumen Sah Serah Terima Standart Part • PT. KMIL • Dicetak pada: ${printDateStr}`, margin, pageHeight - 8);
      doc.text('Dokumen BAP Elektronik Resmi', pageWidth - margin, pageHeight - 8, { align: 'right' });

      const safeProject = (item.projectName || 'Project').replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeReceiver = (cleanReceiver || 'Penerima').replace(/[^a-zA-Z0-9_-]/g, '_');
      doc.save(`BAP_Standart_Part_${safeProject}_${safeReceiver}.pdf`);

      showToast(`Berita Acara Penyerahan (BAP) project "${item.projectName}" berhasil di-generate!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal men-generate file PDF BAP.', 'error');
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Hidden Global File Input for Foto / PDF Part Attachments */}
      <input
        ref={partFileInputRef}
        type="file"
        accept={ACCEPTED_PART_FILE_TYPES}
        multiple
        onChange={handlePartFilesSelected}
        className="hidden"
      />

      {/* Official Document Letterhead Banner (Modernized KMIL) */}
      <div className="bg-white/95 rounded-2xl shadow-sm border border-rose-200/80 overflow-hidden">
        <div className="h-1.5 w-full bg-gradient-to-r from-rose-500 via-amber-500 to-emerald-500" />
        <div className="grid grid-cols-1 md:grid-cols-12 border-b border-slate-200">
          {/* Left Company Box */}
          <div className="md:col-span-5 p-4 border-b md:border-b-0 md:border-r border-slate-200 flex items-center space-x-3 bg-gradient-to-br from-rose-50/50 via-white to-amber-50/30">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-500 via-pink-600 to-amber-500 p-0.5 shrink-0 shadow-md shadow-rose-500/20">
              <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center font-black text-rose-600 text-xs tracking-tight">
                KMIL
              </div>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-slate-900 tracking-tight">
                PT. KURNIA MUSTIKA INDAH LESTARI
              </h2>
              <p className="text-[11px] font-semibold text-rose-700">
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

          {/* Middle Document Title (Vibrant Emerald-Cyan Box) */}
          <div className="md:col-span-4 p-4 border-b md:border-b-0 md:border-r border-slate-200 bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-cyan-500/15 flex flex-col items-center justify-center text-center">
            <h1 className="text-base sm:text-lg font-black bg-gradient-to-r from-emerald-800 via-teal-700 to-cyan-800 bg-clip-text text-transparent uppercase tracking-wide">
              Serah Terima Standart Part
            </h1>
            <span className="text-[10px] text-emerald-800 font-semibold mt-0.5">
              Formulir Kontrol Distribusi Standard Part Engineering ke Produksi
            </span>
          </div>

          {/* Right Document Control Meta Box */}
          <div className="md:col-span-3 p-3 bg-gradient-to-br from-slate-50 to-indigo-50/40 text-[11px] space-y-1 flex flex-col justify-center">
            <div className="grid grid-cols-2 gap-1 border-b border-slate-200 pb-1">
              <span className="font-bold text-slate-600">No. Dokumen:</span>
              <span className="font-mono font-bold text-indigo-700">KMIL/FM-ENG/01-004</span>
            </div>
            <div className="grid grid-cols-2 gap-1 border-b border-slate-200 pb-1">
              <span className="font-bold text-slate-600">Tgl. Berlaku:</span>
              <span className="text-slate-800 font-medium">Tuesday, 02 January 2024</span>
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
        <div className="p-3 sm:p-4 bg-white flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-t border-slate-100">
          <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2 w-full lg:w-auto">
            {/* Month Filter */}
            <div className="flex items-center justify-between sm:justify-start space-x-1.5 bg-indigo-50/70 p-1.5 rounded-xl border border-indigo-200/70 w-full sm:w-auto">
              <span className="text-[11px] font-bold text-indigo-800 px-2 shrink-0">Bulan:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="flex-1 sm:flex-none bg-white border border-indigo-200 text-base sm:text-xs font-bold text-slate-800 rounded-lg px-2.5 py-2 sm:py-1.5 min-h-[40px] sm:min-h-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">Semua Bulan (Jan - Des)</option>
                {['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'].map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-indigo-400 absolute left-3 sm:left-2.5 top-3 sm:top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari project, part, staff, customer..."
                className="text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl pl-9 sm:pl-8 pr-3 py-2 sm:py-1.5 w-full min-h-[42px] sm:min-h-0 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto">
            {!isReadOnly && (
              <>
                <button
                  onClick={handleAutoSyncFromMonitoring}
                  title="Ambil data Project Name & Customer dari dashboard monitoring berdasarkan bulan"
                  className="col-span-2 sm:col-span-1 px-3.5 py-2.5 sm:py-1.5 min-h-[42px] sm:min-h-0 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition flex items-center justify-center space-x-1.5"
                >
                  <RotateCw className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>Ambil Data Otomatis dari Monitoring</span>
                </button>

                <button
                  onClick={handleOpenAddModal}
                  className="px-3.5 py-2.5 sm:py-1.5 min-h-[42px] sm:min-h-0 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center justify-center space-x-1.5"
                >
                  <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>Tambah Baris</span>
                </button>
              </>
            )}

            <button
              onClick={handleExportOfficialPDF}
              className="px-3.5 py-2.5 sm:py-1.5 min-h-[42px] sm:min-h-0 bg-gradient-to-r from-rose-600 via-pink-600 to-amber-500 hover:from-rose-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 transition flex items-center justify-center space-x-1.5"
            >
              <Printer className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>Cetak / PDF Resmi</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="px-3.5 py-2.5 sm:py-1.5 min-h-[42px] sm:min-h-0 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-500/20 transition flex items-center justify-center space-x-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              <span>Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile View Mode Switcher */}
      <div className="md:hidden flex items-center justify-between bg-white/95 px-3 py-2 rounded-2xl border border-rose-200/80 shadow-xs">
        <div className="text-xs font-bold text-slate-700">
          Daftar Serah Terima <span className="text-rose-700 font-extrabold">({filteredList.length})</span>
        </div>
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setMobileDisplayMode('cards')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition min-h-[36px] ${
              mobileDisplayMode === 'cards'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>Kartu</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileDisplayMode('table')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition min-h-[36px] ${
              mobileDisplayMode === 'table'
                ? 'bg-white text-rose-700 shadow-xs'
                : 'text-slate-600'
            }`}
          >
            <Table2 className="w-3.5 h-3.5" />
            <span>Tabel</span>
          </button>
        </div>
      </div>

      {/* Mobile Card List (< md, when mobileDisplayMode === 'cards') */}
      {mobileDisplayMode === 'cards' && (
        <div className="md:hidden space-y-3">
          {filteredList.length === 0 ? (
            <div className="bg-white/95 rounded-2xl p-8 text-center border border-rose-200/80 shadow-sm space-y-3">
              <Layers className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">
                Belum ada data Serah Terima Standart Part pada bulan ini.
              </p>
              {!isReadOnly && (
                <button
                  type="button"
                  onClick={handleAutoSyncFromMonitoring}
                  className="px-4 py-2.5 min-h-[44px] bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-500 transition inline-flex items-center space-x-2"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Tarik Data dari Monitoring</span>
                </button>
              )}
            </div>
          ) : (
            filteredList.map((item, idx) => (
              <div
                key={item.id}
                className="bg-white/95 rounded-2xl shadow-sm border border-rose-200/80 overflow-hidden"
              >
                <div className="h-1 w-full bg-gradient-to-r from-[#9A3434] via-rose-500 to-amber-500" />
                <div className="p-3.5 space-y-3">
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center flex-wrap gap-1.5 mb-1">
                        <span className="px-2 py-0.5 rounded-md bg-rose-900 text-white font-mono text-[10px] font-bold">
                          #{idx + 1}
                        </span>
                        {item.spk && (
                          <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-mono text-[10px] font-bold">
                            {item.spk}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {item.month}
                        </span>
                      </div>
                      <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                        {item.projectName}
                      </h4>
                      <p className="text-xs text-slate-600 font-semibold mt-0.5 flex items-center space-x-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{item.customer}</span>
                      </p>
                      {item.lastModifiedBy && (
                        <p className="text-[10px] text-indigo-700 font-semibold mt-1">
                          Diubah oleh: {item.lastModifiedBy}
                          {item.lastModifiedAt ? ` • ${item.lastModifiedAt}` : ''}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Prepare Staff */}
                  <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-blue-900 uppercase tracking-wide">
                        Prepare Staff
                      </span>
                      {!isReadOnly && quickStaffInput?.rowId !== item.id && (
                        <button
                          type="button"
                          onClick={() => setQuickStaffInput({ rowId: item.id, name: '' })}
                          className="text-xs text-blue-700 font-bold flex items-center space-x-1 px-2 py-1 rounded-lg bg-white border border-blue-200 min-h-[32px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Staff</span>
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {item.prepareStaff.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">Belum ada staff</span>
                      ) : (
                        item.prepareStaff.map((staff) => (
                          <span
                            key={staff}
                            className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-800 text-xs font-semibold"
                          >
                            <span>{staff}</span>
                            {!isReadOnly && (
                              <button
                                type="button"
                                onClick={() => handleRemoveStaff(item.id, staff)}
                                className="text-slate-400 hover:text-rose-600 p-0.5"
                                title={`Hapus ${staff}`}
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </span>
                        ))
                      )}
                    </div>
                    {!isReadOnly && quickStaffInput?.rowId === item.id && (
                      <div className="flex items-center space-x-1.5 pt-1">
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
                          className="flex-1 px-3 py-2 text-base border border-blue-400 rounded-xl focus:outline-none bg-white min-h-[42px]"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddStaff(item.id, quickStaffInput.name)}
                          className="p-2.5 min-w-[42px] min-h-[42px] bg-blue-600 text-white rounded-xl flex items-center justify-center"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickStaffInput(null)}
                          className="p-2.5 min-w-[42px] min-h-[42px] bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Part Name & Qty + Foto/PDF Lampiran */}
                  <div className="bg-emerald-50/40 border border-emerald-200/70 rounded-xl p-2.5 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wide">
                        Part Name & Qty ({item.partNames?.length || 0})
                      </span>
                      {!isReadOnly && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={uploadingRowId === item.id}
                            onClick={() => triggerPartFileUpload({ mode: 'row', rowId: item.id })}
                            className="text-xs text-blue-700 font-bold flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 min-h-[34px] disabled:opacity-60"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            <span>{uploadingRowId === item.id ? 'Memproses...' : 'Foto / PDF'}</span>
                          </button>
                          {quickPartInput?.rowId !== item.id && (
                            <button
                              type="button"
                              onClick={() => setQuickPartInput({ rowId: item.id, name: '', qty: '1' })}
                              className="text-xs text-emerald-700 font-bold flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-emerald-200 min-h-[34px]"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Tambah Part</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {item.partNames && item.partNames.length > 0 ? (
                      <ul className="space-y-1.5">
                        {item.partNames.map((part, pIdx) => {
                          const parsed = parsePartWithQty(part);
                          const isEditingThisQty =
                            editingPartQty?.rowId === item.id && editingPartQty?.partIdx === pIdx;
                          return (
                            <li
                              key={pIdx}
                              className="flex items-center justify-between gap-2 text-xs bg-white p-2 rounded-xl border border-emerald-100 text-slate-800"
                            >
                              <span className="font-semibold flex-1 min-w-0 break-words">
                                {pIdx + 1}. {parsed.name}
                              </span>
                              <div className="flex items-center space-x-1 shrink-0">
                                {isEditingThisQty && !isReadOnly ? (
                                  <div className="flex items-center space-x-1">
                                    <input
                                      type="number"
                                      min={1}
                                      autoFocus
                                      value={editingPartQty.qty}
                                      onChange={(e) =>
                                        setEditingPartQty({
                                          rowId: item.id,
                                          partIdx: pIdx,
                                          qty: e.target.value
                                        })
                                      }
                                      className="w-16 px-2 py-1 text-base font-bold text-center border border-emerald-400 rounded-lg bg-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleUpdatePartQty(item.id, pIdx, editingPartQty.qty)
                                      }
                                      className="p-2 bg-emerald-600 text-white rounded-lg min-w-[36px] min-h-[36px] flex items-center justify-center"
                                    >
                                      <Check className="w-4 h-4" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isReadOnly}
                                    onClick={() =>
                                      !isReadOnly &&
                                      setEditingPartQty({
                                        rowId: item.id,
                                        partIdx: pIdx,
                                        qty: parsed.qty
                                      })
                                    }
                                    className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs min-h-[32px]"
                                  >
                                    Qty: {parsed.qty}
                                  </button>
                                )}
                                {!isReadOnly && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        triggerPartFileUpload({
                                          mode: 'row',
                                          rowId: item.id,
                                          partIndex: pIdx,
                                          partLabel: parsed.name
                                        })
                                      }
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg min-w-[32px] min-h-[32px] flex items-center justify-center"
                                      title={`Upload Foto/PDF untuk ${parsed.name}`}
                                    >
                                      <Paperclip className="w-4 h-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemovePart(item.id, pIdx)}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 min-w-[32px] min-h-[32px] flex items-center justify-center"
                                      title="Hapus part"
                                    >
                                      <X className="w-4 h-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      (!item.partAttachments || item.partAttachments.length === 0) && (
                        <p className="text-xs text-slate-400 italic">
                          Belum ada item part atau lampiran Foto/PDF tercatat.
                        </p>
                      )
                    )}

                    {/* Uploaded Photos & PDFs Strip (Mobile) */}
                    {item.partAttachments && item.partAttachments.length > 0 && (
                      <div className="space-y-1.5 pt-1 border-t border-emerald-200/70">
                        <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                          Lampiran Foto / PDF ({item.partAttachments.length})
                        </p>
                        <div className="grid grid-cols-1 gap-1.5">
                          {item.partAttachments.map((att) => (
                            <div
                              key={att.id}
                              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setPreviewAttachmentState({
                                    attachment: att,
                                    sourceMode: 'row',
                                    rowId: item.id
                                  })
                                }
                                className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                              >
                                {att.fileType === 'image' ? (
                                  <img
                                    src={att.dataUrl}
                                    alt={att.fileName}
                                    className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                                    <FileText className="w-5 h-5" />
                                  </div>
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-bold text-slate-800 truncate">
                                    {att.fileName}
                                  </p>
                                  <p className="text-[10px] text-slate-500 truncate">
                                    {att.fileType === 'pdf' ? 'PDF' : 'Foto'} • {formatFileSize(att.sizeBytes)}
                                    {att.partLabel ? ` • ${att.partLabel}` : ''}
                                  </p>
                                </div>
                              </button>
                              {!isReadOnly && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRowAttachment(item.id, att.id)}
                                  className="p-2 text-slate-400 hover:text-rose-600 min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
                                  title="Hapus lampiran"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {!isReadOnly && quickPartInput?.rowId === item.id && (
                      <div className="space-y-2 pt-1 bg-white p-2.5 rounded-xl border border-emerald-200">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Nama part (cth: Bolt M8)..."
                          value={quickPartInput.name}
                          onChange={(e) =>
                            setQuickPartInput({ ...quickPartInput, name: e.target.value })
                          }
                          className="w-full px-3 py-2 text-base border border-emerald-300 rounded-xl focus:outline-none bg-slate-50 min-h-[42px]"
                        />
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center border border-emerald-300 rounded-xl bg-white overflow-hidden flex-1">
                            <span className="px-2.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 border-r border-emerald-200">
                              Qty
                            </span>
                            <input
                              type="number"
                              min={1}
                              value={quickPartInput.qty}
                              onChange={(e) =>
                                setQuickPartInput({ ...quickPartInput, qty: e.target.value })
                              }
                              className="w-full px-2 py-2 text-base text-center font-bold focus:outline-none min-h-[42px]"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              handleAddPart(item.id, quickPartInput.name, quickPartInput.qty)
                            }
                            className="px-4 py-2 min-h-[42px] bg-emerald-600 text-white rounded-xl font-bold text-xs flex items-center space-x-1"
                          >
                            <Check className="w-4 h-4" />
                            <span>Simpan</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setQuickPartInput(null)}
                            className="p-2.5 min-w-[42px] min-h-[42px] bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Distribution Info Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={item.distributionDate || ''}
                        onChange={(e) => handleInlineFieldChange(item.id, 'distributionDate', e.target.value)}
                        disabled={isReadOnly}
                        className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-base sm:text-xs font-mono text-slate-800"
                      />
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Time
                      </label>
                      {!isReadOnly ? (
                        <input
                          type="text"
                          value={item.distributionTime || ''}
                          onChange={(e) => handleInlineFieldChange(item.id, 'distributionTime', e.target.value)}
                          placeholder="09:00 WIB"
                          className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-base sm:text-xs font-mono text-slate-800"
                        />
                      ) : (
                        <p className="font-mono font-semibold text-slate-800 py-1.5">{item.distributionTime || '-'}</p>
                      )}
                    </div>
                    <div className="col-span-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                      <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                        Division Penerima
                      </label>
                      {!isReadOnly ? (
                        <select
                          value={item.division || 'Assembly Jig'}
                          onChange={(e) => handleInlineFieldChange(item.id, 'division', e.target.value)}
                          className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-base sm:text-xs font-semibold text-slate-800"
                        >
                          <option value="Assembly Jig">Assembly Jig</option>
                          <option value="Machining & Tooling">Machining & Tooling</option>
                          <option value="Purchasing">Purchasing</option>
                          <option value="QC & Testing">QC & Testing</option>
                          <option value="Workshop Produksi">Workshop Produksi</option>
                          <option value="Gudang Material">Gudang Material</option>
                        </select>
                      ) : (
                        <span className="font-semibold text-slate-800">{item.division}</span>
                      )}
                    </div>
                  </div>

                  {/* Signature / Penerima */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">
                        Signature / Penerima
                      </span>
                      {!isReadOnly && quickReceiverInput?.rowId !== item.id && (
                        <button
                          type="button"
                          onClick={() => setQuickReceiverInput({ rowId: item.id, name: '' })}
                          className="text-xs text-blue-600 font-bold flex items-center space-x-1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Penerima</span>
                        </button>
                      )}
                    </div>
                    {item.signature ? (
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          disabled={isReadOnly}
                          value={item.signature}
                          onChange={(e) => handleInlineFieldChange(item.id, 'signature', e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-base sm:text-xs font-semibold text-slate-800"
                        />
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => handleInlineFieldChange(item.id, 'signature', '')}
                            className="p-2 text-slate-400 hover:text-rose-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Belum ada tanda tangan penerima</p>
                    )}

                    {!isReadOnly && quickReceiverInput?.rowId === item.id && (
                      <div className="flex items-center space-x-1.5">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Nama penerima..."
                          value={quickReceiverInput.name}
                          onChange={(e) => setQuickReceiverInput({ rowId: item.id, name: e.target.value })}
                          className="flex-1 px-3 py-2 text-base border border-blue-400 rounded-xl bg-white min-h-[42px]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            item.signature
                              ? handleAppendReceiver(item.id, quickReceiverInput.name)
                              : handleSetReceiver(item.id, quickReceiverInput.name)
                          }
                          className="p-2.5 min-w-[42px] min-h-[42px] bg-blue-600 text-white rounded-xl flex items-center justify-center"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setQuickReceiverInput(null)}
                          className="p-2.5 min-w-[42px] min-h-[42px] bg-slate-200 text-slate-700 rounded-xl flex items-center justify-center"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Card Footer Action Dock */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handlePrintSingleBAP(item)}
                      className="flex-1 min-h-[44px] px-3 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs font-bold shadow-sm flex items-center justify-center space-x-1.5"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Cetak BAP</span>
                    </button>
                    {!isReadOnly && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold flex items-center justify-center space-x-1"
                        >
                          <PenSquare className="w-4 h-4" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.projectName)}
                          className="min-h-[44px] min-w-[44px] px-3 py-2 rounded-xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center"
                          title="Hapus"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Main Table Matching Uploaded Document */}
      <div className={`bg-white/95 rounded-2xl shadow-sm border border-rose-200/80 overflow-hidden ${mobileDisplayMode === 'table' ? 'block' : 'hidden md:block'}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              {/* Row 1 Header (Vibrant Crimson-Rose-Indigo gradient) */}
              <tr className="bg-gradient-to-r from-[#9A3434] via-[#8B2635] to-[#6b2152] text-white text-[11px] font-bold border-b border-rose-900/40">
                <th rowSpan={2} className="p-3 text-center border-r border-white/15 w-12">
                  No
                </th>
                <th rowSpan={2} className="p-3 border-r border-white/15 min-w-[170px]">
                  Prepare
                </th>
                <th rowSpan={2} className="p-3 border-r border-white/15 min-w-[190px]">
                  Project Name
                </th>
                <th rowSpan={2} className="p-3 border-r border-white/15 min-w-[220px]">
                  Part Name
                </th>
                <th rowSpan={2} className="p-3 border-r border-white/15 min-w-[180px]">
                  Customer
                </th>
                <th colSpan={3} className="p-2 text-center border-r border-white/15 bg-black/15">
                  Distribution
                </th>
                <th rowSpan={2} className="p-3 text-center border-r border-white/15 min-w-[130px]">
                  Signature
                </th>
                <th rowSpan={2} className="p-3 text-center min-w-[140px]">
                  Cetak BAP / Aksi
                </th>
              </tr>

              {/* Row 2 Subheader under Distribution */}
              <tr className="bg-[#7b2235] text-white text-[10px] font-semibold border-b border-slate-300">
                <th className="p-2 text-center border-r border-white/15 min-w-[100px]">
                  Date
                </th>
                <th className="p-2 text-center border-r border-white/15 min-w-[90px]">
                  Time
                </th>
                <th className="p-2 text-center border-r border-white/15 min-w-[110px]">
                  Division
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredList.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-400 italic">
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
                          {item.lastModifiedBy && (
                            <span
                              className="block text-[10px] text-indigo-600 font-semibold mt-0.5"
                              title={`Terakhir diubah oleh ${item.lastModifiedBy} (${item.lastModifiedAt || ''})`}
                            >
                              Diubah: {item.lastModifiedBy}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Part Name (Multiple Parts with Qty, Foto/PDF Upload, Add/Delete) */}
                      <td className="p-3 border-r border-slate-200 min-w-[290px] align-top">
                        <div className="space-y-2">
                          {item.partNames && item.partNames.length > 0 && (
                            <ul className="space-y-1">
                              {item.partNames.map((part, pIdx) => {
                                const parsed = parsePartWithQty(part);
                                const isEditingThisQty =
                                  editingPartQty?.rowId === item.id && editingPartQty?.partIdx === pIdx;

                                return (
                                  <li
                                    key={pIdx}
                                    className="group flex items-center justify-between gap-1.5 text-[11px] bg-slate-50 hover:bg-slate-100 p-1.5 rounded border border-slate-200 text-slate-800"
                                  >
                                    <span className="font-medium truncate flex-1">
                                      {pIdx + 1}. {parsed.name}
                                    </span>

                                    <div className="flex items-center space-x-1 shrink-0">
                                      {isEditingThisQty && !isReadOnly ? (
                                        <div className="flex items-center space-x-1">
                                          <input
                                            type="number"
                                            min={1}
                                            autoFocus
                                            value={editingPartQty.qty}
                                            onChange={(e) =>
                                              setEditingPartQty({
                                                rowId: item.id,
                                                partIdx: pIdx,
                                                qty: e.target.value
                                              })
                                            }
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter')
                                                handleUpdatePartQty(item.id, pIdx, editingPartQty.qty);
                                              if (e.key === 'Escape') setEditingPartQty(null);
                                            }}
                                            className="w-12 px-1 py-0.5 text-[10px] font-bold text-center border border-emerald-400 rounded bg-white focus:outline-none"
                                          />
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleUpdatePartQty(item.id, pIdx, editingPartQty.qty)
                                            }
                                            className="p-0.5 bg-emerald-600 text-white rounded hover:bg-emerald-500"
                                            title="Simpan Qty"
                                          >
                                            <Check className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          disabled={isReadOnly}
                                          onClick={() =>
                                            !isReadOnly &&
                                            setEditingPartQty({
                                              rowId: item.id,
                                              partIdx: pIdx,
                                              qty: parsed.qty
                                            })
                                          }
                                          title={isReadOnly ? undefined : 'Klik untuk ubah Qty'}
                                          className={`px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[10px] whitespace-nowrap ${
                                            !isReadOnly ? 'hover:bg-emerald-100 cursor-pointer' : 'cursor-default'
                                          }`}
                                        >
                                          Qty: {parsed.qty}
                                        </button>
                                      )}

                                      {!isReadOnly && (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              triggerPartFileUpload({
                                                mode: 'row',
                                                rowId: item.id,
                                                partIndex: pIdx,
                                                partLabel: parsed.name
                                              })
                                            }
                                            title={`Upload Foto / PDF untuk ${parsed.name}`}
                                            className="p-0.5 rounded text-blue-600 hover:bg-blue-50 opacity-80 group-hover:opacity-100 shrink-0"
                                          >
                                            <Paperclip className="w-3 h-3" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemovePart(item.id, pIdx)}
                                            title="Hapus part"
                                            className="opacity-70 group-hover:opacity-100 text-slate-400 hover:text-rose-600 shrink-0"
                                          >
                                            <X className="w-3 h-3" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          )}

                          {/* Foto & PDF Attachment Strip inside Part Name Cell */}
                          {item.partAttachments && item.partAttachments.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 pt-0.5">
                              {item.partAttachments.map((att) => (
                                <div
                                  key={att.id}
                                  className={`group/att inline-flex items-center gap-1.5 rounded-lg border px-1.5 py-1 max-w-[230px] transition ${
                                    att.fileType === 'pdf'
                                      ? 'bg-rose-50/80 border-rose-200 text-rose-800 hover:bg-rose-100/70'
                                      : 'bg-blue-50/70 border-blue-200 text-slate-800 hover:bg-blue-100/60'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setPreviewAttachmentState({
                                        attachment: att,
                                        sourceMode: 'row',
                                        rowId: item.id
                                      })
                                    }
                                    title={`Klik untuk pratinjau ${att.fileName}${att.partLabel ? ` (${att.partLabel})` : ''}`}
                                    className="flex items-center gap-1.5 min-w-0 text-left"
                                  >
                                    {att.fileType === 'image' ? (
                                      <div className="relative w-7 h-7 rounded overflow-hidden border border-slate-200 shrink-0 bg-white">
                                        <img
                                          src={att.dataUrl}
                                          alt={att.fileName}
                                          className="w-full h-full object-cover"
                                        />
                                        <span className="absolute inset-0 bg-slate-900/35 opacity-0 group-hover/att:opacity-100 flex items-center justify-center transition">
                                          <Eye className="w-3 h-3 text-white" />
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="w-7 h-7 rounded bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                        <FileText className="w-3.5 h-3.5" />
                                      </div>
                                    )}
                                    <div className="min-w-0">
                                      <p className="text-[10px] font-bold truncate max-w-[130px] leading-tight">
                                        {att.fileName}
                                      </p>
                                      <p className="text-[9px] text-slate-500 truncate leading-tight">
                                        {att.partLabel ? `${att.partLabel} • ` : ''}
                                        {formatFileSize(att.sizeBytes)}
                                      </p>
                                    </div>
                                  </button>

                                  {!isReadOnly && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveRowAttachment(item.id, att.id)}
                                      title="Hapus lampiran"
                                      className="p-0.5 text-slate-400 hover:text-rose-600 shrink-0"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {!isReadOnly ? (
                            <div className="space-y-1">
                              {quickPartInput?.rowId === item.id ? (
                                <div className="flex items-center space-x-1 mt-1">
                                  <input
                                    type="text"
                                    autoFocus
                                    placeholder="Nama part..."
                                    value={quickPartInput.name}
                                    onChange={(e) =>
                                      setQuickPartInput({ ...quickPartInput, name: e.target.value })
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter')
                                        handleAddPart(item.id, quickPartInput.name, quickPartInput.qty);
                                      if (e.key === 'Escape') setQuickPartInput(null);
                                    }}
                                    className="px-2 py-0.5 text-xs border border-emerald-400 rounded focus:outline-none flex-1 min-w-[110px] bg-white"
                                  />
                                  <div className="flex items-center border border-emerald-400 rounded bg-white overflow-hidden shrink-0">
                                    <span className="px-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border-r border-emerald-200 py-0.5">
                                      Qty
                                    </span>
                                    <input
                                      type="number"
                                      min={1}
                                      placeholder="1"
                                      value={quickPartInput.qty}
                                      onChange={(e) =>
                                        setQuickPartInput({ ...quickPartInput, qty: e.target.value })
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter')
                                          handleAddPart(item.id, quickPartInput.name, quickPartInput.qty);
                                        if (e.key === 'Escape') setQuickPartInput(null);
                                      }}
                                      className="w-12 px-1 py-0.5 text-xs text-center font-semibold focus:outline-none bg-white"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAddPart(item.id, quickPartInput.name, quickPartInput.qty)
                                    }
                                    className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 shrink-0"
                                    title="Simpan Part & Qty"
                                  >
                                    <Check className="w-3 h-3" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setQuickPartInput(null)}
                                    className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300 shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQuickPartInput({ rowId: item.id, name: '', qty: '1' })
                                    }
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-semibold flex items-center space-x-1 transition hover:underline"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Tambah Part</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={uploadingRowId === item.id}
                                    onClick={() => triggerPartFileUpload({ mode: 'row', rowId: item.id })}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center space-x-1 transition hover:underline disabled:opacity-60"
                                    title="Upload Foto atau Dokumen PDF Part Name"
                                  >
                                    <Upload className="w-3.5 h-3.5" />
                                    <span>
                                      {uploadingRowId === item.id ? 'Mengunggah...' : 'Upload Foto / PDF'}
                                    </span>
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            (!item.partNames || item.partNames.length === 0) &&
                            (!item.partAttachments || item.partAttachments.length === 0) && (
                              <span className="text-slate-400 italic text-[11px]">-</span>
                            )
                          )}
                        </div>
                      </td>

                      {/* Customer */}
                      <td className="p-3 text-slate-700 font-medium border-r border-slate-200">
                        {item.customer}
                      </td>

                      {/* Distribution Date (Pemilih Tanggal) */}
                      <td className="p-2 text-center border-r border-slate-200 font-mono text-[11px] text-slate-700 min-w-[125px]">
                        <div className="flex items-center justify-center space-x-1">
                          <input
                            type="date"
                            value={item.distributionDate || ''}
                            onChange={(e) => handleInlineFieldChange(item.id, 'distributionDate', e.target.value)}
                            disabled={isReadOnly}
                            className="bg-transparent border-b border-dashed border-slate-300 hover:border-slate-500 text-center font-mono text-[11px] focus:outline-none w-full cursor-pointer disabled:cursor-not-allowed"
                          />
                          {!isReadOnly && item.distributionDate && (
                            <button
                              type="button"
                              onClick={() => handleInlineFieldChange(item.id, 'distributionDate', '')}
                              title="Hapus / Kosongkan Tanggal"
                              className="text-slate-400 hover:text-rose-500 text-xs px-0.5"
                            >
                              ×
                            </button>
                          )}
                        </div>
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

                      {/* Signature / Penerima (Diterima) */}
                      <td className="p-2 text-center border-r border-slate-200 text-[11px] min-w-[160px]">
                        <div className="space-y-1">
                          {item.signature ? (
                            <div className="flex flex-col items-center justify-center space-y-1">
                              {!isReadOnly ? (
                                <div className="flex items-center justify-center space-x-1 w-full">
                                  <input
                                    type="text"
                                    value={item.signature}
                                    onChange={(e) => handleInlineFieldChange(item.id, 'signature', e.target.value)}
                                    onBlur={(e) => {
                                      const val = e.target.value.trim();
                                      if (val && !val.includes('(Diterima)') && !val.includes('(')) {
                                        handleInlineFieldChange(item.id, 'signature', `${val} (Diterima)`);
                                      }
                                    }}
                                    placeholder="Nama penerima..."
                                    className="bg-transparent border-b border-dashed border-slate-300 hover:border-slate-500 text-center text-[11px] focus:outline-none w-full font-semibold text-slate-800"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleInlineFieldChange(item.id, 'signature', '')}
                                    title="Hapus penerima"
                                    className="text-slate-400 hover:text-rose-500 text-xs px-0.5 shrink-0"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              ) : (
                                <span className="font-semibold text-slate-800">
                                  {item.signature}
                                </span>
                              )}

                              {!isReadOnly && (
                                <div>
                                  {quickReceiverInput?.rowId === item.id ? (
                                    <div className="flex items-center space-x-1 justify-center mt-0.5">
                                      <input
                                        type="text"
                                        autoFocus
                                        placeholder="Nama penerima..."
                                        value={quickReceiverInput.name}
                                        onChange={(e) => setQuickReceiverInput({ rowId: item.id, name: e.target.value })}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleAppendReceiver(item.id, quickReceiverInput.name);
                                          if (e.key === 'Escape') setQuickReceiverInput(null);
                                        }}
                                        className="px-1.5 py-0.5 text-xs border border-blue-400 rounded focus:outline-none w-28 bg-white text-center"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAppendReceiver(item.id, quickReceiverInput.name)}
                                        className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500"
                                        title="Simpan"
                                      >
                                        <Check className="w-3 h-3" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setQuickReceiverInput(null)}
                                        className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setQuickReceiverInput({ rowId: item.id, name: '' })}
                                      className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold flex items-center justify-center space-x-0.5 transition hover:underline"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Tambah Penerima</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              {!isReadOnly ? (
                                quickReceiverInput?.rowId === item.id ? (
                                  <div className="flex items-center space-x-1 justify-center">
                                    <input
                                      type="text"
                                      autoFocus
                                      placeholder="Nama penerima..."
                                      value={quickReceiverInput.name}
                                      onChange={(e) => setQuickReceiverInput({ rowId: item.id, name: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSetReceiver(item.id, quickReceiverInput.name);
                                        if (e.key === 'Escape') setQuickReceiverInput(null);
                                      }}
                                      className="px-1.5 py-0.5 text-xs border border-blue-400 rounded focus:outline-none w-28 bg-white text-center"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => handleSetReceiver(item.id, quickReceiverInput.name)}
                                      className="p-1 bg-blue-600 text-white rounded hover:bg-blue-500"
                                      title="Simpan"
                                    >
                                      <Check className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setQuickReceiverInput(null)}
                                      className="p-1 bg-slate-200 text-slate-600 rounded hover:bg-slate-300"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setQuickReceiverInput({ rowId: item.id, name: '' })}
                                    className="text-xs text-blue-600 hover:text-blue-700 font-semibold flex items-center justify-center space-x-1 mx-auto transition hover:underline"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>Tambah Penerima</span>
                                  </button>
                                )
                              ) : (
                                <span className="font-semibold text-slate-400 italic">-</span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action Buttons: Cetak BAP & Edit/Delete */}
                      <td className="p-2 text-center">
                        <div className="flex items-center justify-center space-x-1.5 flex-wrap gap-1">
                          <button
                            type="button"
                            onClick={() => handlePrintSingleBAP(item)}
                            title={`Cetak Berita Acara Penyerahan (BAP) PDF untuk project ${item.projectName || ''}`}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white text-[11px] font-bold shadow-sm shadow-emerald-500/20 transition"
                          >
                            <FileText className="w-3.5 h-3.5 text-white" />
                            <span>Cetak BAP</span>
                          </button>

                          {!isReadOnly && (
                            <div className="flex items-center space-x-0.5">
                              <button
                                type="button"
                                onClick={() => handleOpenEditModal(item)}
                                title="Edit Form"
                                className="p-1 rounded-md text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                              >
                                <PenSquare className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id, item.projectName)}
                                title="Hapus Form"
                                className="p-1 rounded-md text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
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
        <div className="fixed inset-0 bg-slate-950/80 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-5 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col border border-slate-200 max-h-[92dvh] sm:max-h-[92vh] pb-safe">
            {/* Modal Header */}
            <div className="bg-[#8B2635] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-white/20 rounded-xl text-white">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold">
                    {editingItem ? 'Edit Form Serah Terima Standart Part' : 'Tambah Form Serah Terima Standart Part'}
                  </h3>
                  <p className="text-[11px] sm:text-xs text-rose-100">
                    No. Dokumen: KMIL/FM-ENG/01-004
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-rose-100 hover:text-white p-2 rounded-xl hover:bg-white/10 min-w-[40px] min-h-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveModal} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Bulan</label>
                  <select
                    value={formData.month}
                    onChange={(e) => setFormData({ ...formData, month: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 sm:p-2 text-base sm:text-xs font-semibold"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 sm:p-2 text-base sm:text-xs text-blue-700 font-semibold"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 sm:p-2 text-base sm:text-xs font-semibold"
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
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 sm:p-2 text-base sm:text-xs font-semibold"
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
                      className="flex-1 bg-white border border-slate-300 rounded-xl p-2 sm:p-1.5 text-base sm:text-xs"
                    />
                    {formData.prepareStaff.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newStaff = formData.prepareStaff.filter((_, idx) => idx !== sIdx);
                          setFormData({ ...formData, prepareStaff: newStaff });
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Part Names List & Foto/PDF Lampiran */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="font-bold text-slate-800">
                    Part Name, Qty & Lampiran Foto / PDF
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={uploadingRowId === 'MODAL'}
                      onClick={() => triggerPartFileUpload({ mode: 'modal' })}
                      className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs sm:text-[11px] font-bold flex items-center space-x-1 disabled:opacity-60"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingRowId === 'MODAL' ? 'Memproses...' : 'Upload Foto / PDF'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setFormData({
                          ...formData,
                          partNames: [...formData.partNames, { name: '', qty: '1' }]
                        })
                      }
                      className="text-xs sm:text-[11px] text-emerald-600 font-bold flex items-center space-x-1"
                    >
                      <Plus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      <span>Tambah Part</span>
                    </button>
                  </div>
                </div>
                {formData.partNames.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic py-1">
                    Kolom part name kosong. Klik "+ Tambah Part" untuk teks/Qty atau "Upload Foto / PDF" untuk melampirkan gambar/dokumen part.
                  </p>
                ) : (
                  formData.partNames.map((part, pIdx) => (
                    <div key={pIdx} className="flex flex-wrap sm:flex-nowrap items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-400 w-5 text-center shrink-0">
                        {pIdx + 1}.
                      </span>
                      <input
                        type="text"
                        value={part.name}
                        onChange={(e) => {
                          const newParts = [...formData.partNames];
                          newParts[pIdx] = { ...newParts[pIdx], name: e.target.value };
                          setFormData({ ...formData, partNames: newParts });
                        }}
                        placeholder={`Nama Part ${pIdx + 1}...`}
                        className="flex-1 min-w-[140px] bg-white border border-slate-300 rounded-xl p-2 sm:p-1.5 text-base sm:text-xs"
                      />
                      <div className="flex items-center border border-slate-300 rounded-xl bg-white overflow-hidden shrink-0">
                        <span className="px-2 py-2 sm:py-1.5 text-[10px] font-bold text-slate-600 bg-slate-100 border-r border-slate-300">
                          Qty
                        </span>
                        <input
                          type="number"
                          min={1}
                          value={part.qty}
                          onChange={(e) => {
                            const newParts = [...formData.partNames];
                            newParts[pIdx] = { ...newParts[pIdx], qty: e.target.value };
                            setFormData({ ...formData, partNames: newParts });
                          }}
                          placeholder="1"
                          className="w-16 p-2 sm:p-1.5 text-base sm:text-xs text-center font-semibold focus:outline-none bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          triggerPartFileUpload({
                            mode: 'modal',
                            partIndex: pIdx,
                            partLabel: part.name || `Part ${pIdx + 1}`
                          })
                        }
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg shrink-0"
                        title="Upload Foto / PDF untuk part ini"
                      >
                        <Paperclip className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const newParts = formData.partNames.filter((_, idx) => idx !== pIdx);
                          setFormData({ ...formData, partNames: newParts });
                        }}
                        className="p-2 text-slate-400 hover:text-rose-600 shrink-0"
                        title="Hapus Part"
                      >
                        <Trash2 className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                      </button>
                    </div>
                  ))
                )}

                {/* Modal Attachment Previews */}
                {formData.partAttachments.length > 0 && (
                  <div className="pt-2 border-t border-slate-200 space-y-1.5">
                    <p className="text-[11px] font-bold text-slate-600">
                      File Lampiran Part Name ({formData.partAttachments.length}) — Foto otomatis dikompres, PDF maks. 700 KB
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {formData.partAttachments.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewAttachmentState({
                                attachment: att,
                                sourceMode: 'modal'
                              })
                            }
                            className="flex items-center gap-2 flex-1 min-w-0 text-left"
                          >
                            {att.fileType === 'image' ? (
                              <img
                                src={att.dataUrl}
                                alt={att.fileName}
                                className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                                <FileText className="w-5 h-5" />
                              </div>
                            )}
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{att.fileName}</p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {att.fileType === 'pdf' ? 'PDF' : 'Foto'} • {formatFileSize(att.sizeBytes)}
                                {att.partLabel ? ` • ${att.partLabel}` : ''}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveModalAttachment(att.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 shrink-0"
                            title="Hapus lampiran"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Distribution Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-bold mb-1">Distribution Date</label>
                  <input
                    type="date"
                    value={formData.distributionDate}
                    onChange={(e) => setFormData({ ...formData, distributionDate: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 sm:p-2 text-base sm:text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Distribution Time</label>
                  <input
                    type="text"
                    value={formData.distributionTime}
                    onChange={(e) => setFormData({ ...formData, distributionTime: e.target.value })}
                    placeholder="09:30 WIB"
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 sm:p-2 text-base sm:text-xs"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-bold mb-1">Division Penerima</label>
                  <select
                    value={formData.division}
                    onChange={(e) => setFormData({ ...formData, division: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 sm:p-2 text-base sm:text-xs font-semibold"
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
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-slate-700 font-bold">Signature / Nama PIC Penerima (Diterima)</label>
                  <span className="text-[10px] text-slate-500">Format: [Nama] (Diterima)</span>
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="text"
                    value={formData.signature}
                    onChange={(e) => setFormData({ ...formData, signature: e.target.value })}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && !val.includes('(Diterima)') && !val.includes('(')) {
                        setFormData((prev) => ({ ...prev, signature: `${val} (Diterima)` }));
                      }
                    }}
                    placeholder="Nama penerima standard part (cth: Fadil, Budi)..."
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl p-2.5 sm:p-2 text-base sm:text-xs font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!formData.signature) return;
                      const val = formData.signature.trim();
                      const formatted = val.includes('(Diterima)') ? val : `${val} (Diterima)`;
                      setFormData({ ...formData, signature: formatted });
                    }}
                    className="px-3 py-2.5 sm:py-2 min-h-[42px] sm:min-h-0 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold hover:bg-blue-100 shrink-0 border border-blue-200"
                  >
                    + Format (Diterima)
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-400">Pilih cepat penerima:</span>
                  {['Fadil', 'Hendra', 'Rian', 'Andry', 'Budi'].map((staff) => (
                    <button
                      key={staff}
                      type="button"
                      onClick={() => {
                        const formatted = `${staff} (Diterima)`;
                        setFormData((prev) => ({
                          ...prev,
                          signature: prev.signature ? `${prev.signature}, ${formatted}` : formatted
                        }));
                      }}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 border border-slate-200 rounded-lg text-xs sm:text-[10px] text-slate-600 font-medium transition"
                    >
                      + {staff}
                    </button>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-200">
                {editingItem ? (
                  <button
                    type="button"
                    onClick={() => handlePrintSingleBAP(editingItem)}
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-3.5 py-2.5 sm:py-2 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-300 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs"
                    title="Cetak Berita Acara Penyerahan (BAP)"
                  >
                    <FileText className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                    <span>Cetak BAP</span>
                  </button>
                ) : <div className="hidden sm:block" />}

                <div className="flex flex-col-reverse sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-4 py-2.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="w-full sm:w-auto min-h-[44px] sm:min-h-0 px-5 py-2.5 sm:py-2 bg-[#8B2635] hover:bg-[#701e2a] text-white rounded-xl text-xs font-bold shadow-md transition"
                  >
                    {editingItem ? 'Simpan Perubahan' : 'Simpan Data'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Part Attachment Preview Modal (Photo & PDF) */}
      <PartAttachmentPreviewModal
        attachment={previewAttachmentState?.attachment || null}
        onClose={() => setPreviewAttachmentState(null)}
        onDelete={
          !isReadOnly && previewAttachmentState
            ? () => {
                if (previewAttachmentState.sourceMode === 'modal') {
                  handleRemoveModalAttachment(previewAttachmentState.attachment.id);
                } else if (previewAttachmentState.rowId) {
                  handleRemoveRowAttachment(
                    previewAttachmentState.rowId,
                    previewAttachmentState.attachment.id
                  );
                }
              }
            : undefined
        }
      />
    </div>
  );
};
