import React, { useState, useEffect } from 'react';
import { EngineeringProject } from '../types/engineering';
import { PenSquare, Plus, X, Save, Building, Calendar, User, FileText, Hash } from 'lucide-react';

interface DataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<EngineeringProject>, isEdit: boolean) => void;
  initialData?: EngineeringProject | null;
}

export const DataModal: React.FC<DataModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData
}) => {
  const [formData, setFormData] = useState<Partial<EngineeringProject>>({
    Bulan: 'Oktober',
    SPK: '',
    'Nomor PO': '',
    Customer: '',
    Status: 'In Progress',
    'Delivery Time': '',
    'Nama Project': '',
    PIC: '',
    'Qty Drawing': 1,
    'Permintaan Drawing/Design': '',
    'Target Design': '',
    'Tanggal Penyelesaian': '',
    'Aktual Engineering': '',
    keterangan: ''
  });

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setFormData({
        Bulan: 'Oktober',
        SPK: `SPK-2026-${String(Math.floor(Math.random() * 900) + 100)}`,
        'Nomor PO': `PO/2026/${String(Math.floor(Math.random() * 900) + 100)}`,
        Customer: '',
        Status: 'In Progress',
        'Delivery Time': today,
        'Nama Project': '',
        PIC: '',
        'Qty Drawing': 1,
        'Permintaan Drawing/Design': today,
        'Target Design': today,
        'Tanggal Penyelesaian': '',
        'Aktual Engineering': '',
        'File CAD Drive': '',
        keterangan: ''
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData, !!initialData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'number' ? Number(value) : value
    }));
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-6 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92dvh] border border-indigo-200/70">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 shrink-0" />
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0a0f2c] via-[#172554] to-[#1e1b4b] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-cyan-500/25 shrink-0">
              {initialData ? <PenSquare className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold truncate">
                {initialData ? 'Edit Data Proyek Engineering' : 'Tambah Data Engineering Baru'}
              </h3>
              <p className="text-[11px] sm:text-xs text-cyan-200/80 truncate">
                Lengkapi rincian SPK, target desain, dan spesifikasi gambar manufaktur
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1 pb-safe">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Bulan *</label>
              <select
                name="Bulan"
                value={formData.Bulan || 'Oktober'}
                onChange={handleChange}
                required
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
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
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor SPK *</label>
              <input
                type="text"
                name="SPK"
                value={formData.SPK || ''}
                onChange={handleChange}
                required
                placeholder="Cth: SPK-2026-021"
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nomor PO *</label>
              <input
                type="text"
                name="Nomor PO"
                value={formData['Nomor PO'] || ''}
                onChange={handleChange}
                required
                placeholder="Cth: PO/2026/088"
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Customer / Klien *</label>
              <input
                type="text"
                name="Customer"
                value={formData.Customer || ''}
                onChange={handleChange}
                required
                placeholder="Cth: PT. Astra International Tbk"
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Status Proyek *</label>
              <select
                name="Status"
                value={formData.Status || 'In Progress'}
                onChange={handleChange}
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none font-semibold text-slate-700"
              >
                <option value="In Progress">In Progress</option>
                <option value="Selesai">Selesai (Done)</option>
                <option value="Revisi">Revisi</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Nama Project *</label>
              <input
                type="text"
                name="Nama Project"
                value={formData['Nama Project'] || ''}
                onChange={handleChange}
                required
                placeholder="Cth: Automated Welding Jig Machine Assembly"
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">PIC (Drafter/Engineer) *</label>
              <input
                type="text"
                name="PIC"
                value={formData.PIC || ''}
                onChange={handleChange}
                required
                placeholder="Nama Engineer PIC"
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Qty Drawing *</label>
              <input
                type="number"
                name="Qty Drawing"
                min={1}
                value={formData['Qty Drawing'] || 1}
                onChange={handleChange}
                required
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Delivery Time Proyek *</label>
              <input
                type="date"
                name="Delivery Time"
                value={formData['Delivery Time'] || ''}
                onChange={handleChange}
                required
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Permintaan Drawing/Design</label>
              <input
                type="date"
                name="Permintaan Drawing/Design"
                value={formData['Permintaan Drawing/Design'] || ''}
                onChange={handleChange}
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Target Design *</label>
              <input
                type="date"
                name="Target Design"
                value={formData['Target Design'] || ''}
                onChange={handleChange}
                required
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Penyelesaian</label>
              <input
                type="date"
                name="Tanggal Penyelesaian"
                value={formData['Tanggal Penyelesaian'] || ''}
                onChange={handleChange}
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Aktual Engineering Selesai</label>
              <input
                type="date"
                name="Aktual Engineering"
                value={formData['Aktual Engineering'] || ''}
                onChange={handleChange}
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Link File CAD / Drawing PDF (Google Drive / Cloud URL)
              </label>
              <input
                type="text"
                name="File CAD Drive"
                value={formData['File CAD Drive'] || ''}
                onChange={handleChange}
                placeholder="https://drive.google.com/file/d/... atau upload file PDF/CAD langsung di tabel monitoring"
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan / Catatan Tambahan</label>
              <textarea
                name="keterangan"
                rows={2}
                value={formData.keterangan || ''}
                onChange={handleChange}
                placeholder="Catatan standar toleransi, feedback revisi, atau instruksi perakitan..."
                className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/25 transition flex items-center justify-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Data</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
