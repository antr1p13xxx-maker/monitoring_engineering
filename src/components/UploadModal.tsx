import React, { useState } from 'react';
import { 
  CloudUpload, 
  X, 
  FileCheck, 
  FileText, 
  Box, 
  Link, 
  ExternalLink,
  Eye,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  spk: string | null;
  onUploadSuccess: (spk: string, fileUrl: string, fileName: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  spk,
  onUploadSuccess
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'link'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [customLink, setCustomLink] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setSelectedFile(file);
      if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  const isPdf = selectedFile?.name.toLowerCase().endsWith('.pdf') || selectedFile?.type === 'application/pdf';

  const handleUpload = () => {
    if (!spk) return;

    if (activeTab === 'link') {
      if (!customLink.trim()) return;
      onUploadSuccess(spk, customLink.trim(), 'Google Drive Link');
      onClose();
      return;
    }

    if (!selectedFile) return;

    setIsUploading(true);

    // If file is a PDF under 1.5MB, convert to data URL so it can be previewed/opened immediately
    if (isPdf && selectedFile.size <= 1.5 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onload = () => {
        setIsUploading(false);
        const dataUrl = reader.result as string;
        onUploadSuccess(spk, dataUrl, selectedFile.name);
        onClose();
      };
      reader.onerror = () => {
        setIsUploading(false);
        const fallbackUrl = `https://drive.google.com/file/d/pdf_${spk.toLowerCase()}_${Date.now()}/view`;
        onUploadSuccess(spk, fallbackUrl, selectedFile.name);
        onClose();
      };
      reader.readAsDataURL(selectedFile);
    } else {
      setTimeout(() => {
        setIsUploading(false);
        const prefix = isPdf ? 'pdf' : 'cad';
        const simulatedDriveUrl = `https://drive.google.com/file/d/${prefix}_${spk.toLowerCase()}_${Date.now()}/view`;
        onUploadSuccess(spk, simulatedDriveUrl, selectedFile.name);
        onClose();
      }, 500);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[140] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-indigo-200/70 max-h-[90dvh]">
        <div className="h-1 w-full bg-gradient-to-r from-cyan-400 via-indigo-500 to-emerald-400 shrink-0" />
        {/* Header */}
        <div className="bg-gradient-to-r from-[#0a0f2c] via-[#172554] to-[#1e1b4b] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="p-2 sm:p-2.5 bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 rounded-xl text-white shadow-lg shadow-cyan-500/25 shrink-0">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold text-white tracking-wide truncate">
                Upload File CAD / PDF Drawing
              </h3>
              <p className="text-xs text-cyan-200/80 mt-0.5 truncate">
                Target SPK: <span className="text-emerald-300 font-mono font-bold">{spk}</span>
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

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 sm:px-6 pt-3 gap-4 text-xs font-semibold overflow-x-auto no-scrollbar shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 min-h-[40px] whitespace-nowrap flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'upload'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <CloudUpload className="w-4 h-4" />
            <span>Upload File PDF / CAD</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('link')}
            className={`pb-2.5 min-h-[40px] whitespace-nowrap flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'link'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link className="w-4 h-4" />
            <span>Tempel Link Drive</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 pb-safe">
          {activeTab === 'upload' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between gap-2">
                  <span>Pilih Dokumen PDF atau CAD:</span>
                  <span className="text-[10px] text-slate-400 font-normal shrink-0">Maks. 50 MB</span>
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-4 sm:p-5 text-center bg-slate-50/70 transition">
                  <input
                    type="file"
                    id="file-upload-input"
                    accept=".pdf,.step,.stp,.iges,.igs,.sldprt,.sldasm,.dwg,.dxf,.zip,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload-input"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-2 py-1"
                  >
                    <div className="p-3 bg-white border border-slate-200 rounded-full shadow-sm">
                      <CloudUpload className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Ketuk untuk memilih file dari perangkat
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Mendukung <strong className="text-rose-600 font-bold">.PDF</strong>, .STEP, .STP, .DWG, .DXF, .IGES, .ZIP
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {selectedFile && (
                <div className={`p-3.5 rounded-xl border flex flex-wrap sm:flex-nowrap items-center justify-between gap-2 text-xs transition ${
                  isPdf 
                    ? 'bg-rose-50 border-rose-200 text-rose-900' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-lg shrink-0 ${isPdf ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {isPdf ? <FileText className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <p className="font-bold truncate">{selectedFile.name}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          isPdf ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                          {isPdf ? 'PDF' : 'CAD'}
                        </span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${isPdf ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Siap disimpan ke SPK
                      </p>
                    </div>
                  </div>

                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[38px] px-3 py-1.5 bg-white hover:bg-rose-100 border border-rose-300 text-rose-700 rounded-lg text-[11px] font-semibold flex items-center space-x-1 shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Lihat PDF</span>
                    </a>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-800">
                Tautan File Dokumen PDF atau Folder Google Drive:
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={customLink}
                  onChange={(e) => setCustomLink(e.target.value)}
                  placeholder="https://drive.google.com/file/d/... atau https://drive.google.com/drive/folders/..."
                  className="w-full text-base sm:text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-400"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Pastikan akses berbagi file di Google Drive diatur ke <em>"Siapa saja yang memiliki link"</em> agar tim engineering dapat membukanya.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={(activeTab === 'upload' && !selectedFile) || (activeTab === 'link' && !customLink.trim()) || isUploading}
              className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center justify-center space-x-1.5"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Menyimpan File...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  <span>{isPdf ? 'Simpan File PDF' : 'Simpan File / Link'}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
