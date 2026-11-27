import React, { useState, useEffect } from 'react';
import { ChecklistKey, EngineeringProject, UserRole } from '../types/engineering';
import { CHECKLIST_KEYS, CHECKLIST_PRESETS, getProjectRequiredChecklists } from '../data/initialData';
import { PenSquare, Plus, X, Save, ListChecks, Check, Lock } from 'lucide-react';

interface DataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<EngineeringProject>, isEdit: boolean) => void;
  initialData?: EngineeringProject | null;
  userRole?: UserRole;
}

export const DataModal: React.FC<DataModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
  userRole = 'Viewer'
}) => {
  const isManager = userRole === 'Manager';
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
    keterangan: '',
    requiredChecklists: [...CHECKLIST_KEYS]
  });

  useEffect(() => {
    if (initialData) {
      setFormData({
        ...initialData,
        requiredChecklists: getProjectRequiredChecklists(initialData)
      });
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
        'File CAD Drive': '',
        keterangan: '',
        requiredChecklists: [...CHECKLIST_KEYS]
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const activeRequiredChecklists: ChecklistKey[] = Array.isArray(formData.requiredChecklists)
    ? formData.requiredChecklists
    : [...CHECKLIST_KEYS];

  const toggleRequiredChecklist = (key: ChecklistKey) => {
    if (!isManager) return;
    setFormData((prev) => {
      const current = Array.isArray(prev.requiredChecklists)
        ? prev.requiredChecklists
        : [...CHECKLIST_KEYS];
      const exists = current.includes(key);
      const next = exists
        ? current.filter((k) => k !== key)
        : CHECKLIST_KEYS.filter((k) => k === key || current.includes(k));
      return {
        ...prev,
        requiredChecklists: next
      };
    });
  };

  const applyChecklistPreset = (keys: ChecklistKey[]) => {
    if (!isManager) return;
    setFormData((prev) => ({
      ...prev,
      requiredChecklists: [...keys]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(
      {
        ...formData,
        requiredChecklists: activeRequiredChecklists
      },
      !!initialData
    );
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

            <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-3.5 sm:gap-4">
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

            <div className="md:col-span-3 rounded-2xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-indigo-600 shrink-0" />
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-900">
                      Item Checklist Wajib untuk Project Ini
                    </h4>
                    <p className="text-[11px] text-slate-600">
                      {isManager
                        ? 'Tentukan tahapan checklist yang wajib dikerjakan. Item yang tidak dipilih otomatis ditandai N/A.'
                        : 'Daftar tahapan checklist yang ditetapkan oleh Manager untuk project ini.'}
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-lg bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-extrabold tabular-nums">
                  {activeRequiredChecklists.length} / {CHECKLIST_KEYS.length} Item Aktif
                </span>
              </div>

              {isManager ? (
                <>
                  {/* Quick Presets */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {CHECKLIST_PRESETS.map((preset) => {
                      const isSame =
                        preset.keys.length === activeRequiredChecklists.length &&
                        preset.keys.every((k) => activeRequiredChecklists.includes(k));
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => applyChecklistPreset(preset.keys)}
                          title={preset.description}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                            isSame
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-50 hover:border-indigo-300'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => applyChecklistPreset([])}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition ${
                        activeRequiredChecklists.length === 0
                          ? 'bg-slate-800 text-white border-slate-800'
                          : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      Tanpa Checklist
                    </button>
                  </div>

                  {/* 14 Toggle Items */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {CHECKLIST_KEYS.map((ck) => {
                      const active = activeRequiredChecklists.includes(ck);
                      return (
                        <button
                          key={ck}
                          type="button"
                          onClick={() => toggleRequiredChecklist(ck)}
                          className={`px-2.5 py-2 rounded-xl border text-left text-[11px] font-bold flex items-center justify-between gap-1.5 transition ${
                            active
                              ? 'bg-white border-emerald-400 text-slate-900 shadow-xs ring-1 ring-emerald-200'
                              : 'bg-slate-100/80 border-slate-200 text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          <span className="truncate">{ck}</span>
                          {active ? (
                            <span className="w-4 h-4 rounded bg-emerald-500 text-white flex items-center justify-center shrink-0">
                              <Check className="w-3 h-3" />
                            </span>
                          ) : (
                            <span className="px-1 py-0.2 rounded bg-slate-200 text-slate-500 text-[9px] font-extrabold shrink-0">
                              N/A
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {CHECKLIST_KEYS.map((ck) => {
                      const active = activeRequiredChecklists.includes(ck);
                      return (
                        <span
                          key={ck}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border ${
                            active
                              ? 'bg-white border-emerald-300 text-emerald-800'
                              : 'bg-slate-100 border-slate-200 text-slate-400 line-through'
                          }`}
                        >
                          {ck} {!active && '(N/A)'}
                        </span>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1 font-medium">
                    <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                    <span>Hanya Manager yang dapat mengubah pengaturan item checklist wajib.</span>
                  </p>
                </div>
              )}
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
