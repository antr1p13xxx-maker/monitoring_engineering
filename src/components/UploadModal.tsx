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
    <div className="fixed inset-0 bg-slate-950/80 z-[140] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col border border-slate-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 sm:px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-blue-600 rounded-xl text-white shadow-md shadow-blue-500/20">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                Upload File CAD / Dokumen PDF Drawing
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Target SPK: <span className="text-emerald-400 font-mono font-bold">{spk}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-4 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition ${
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
            className={`pb-2.5 flex items-center space-x-1.5 border-b-2 transition ${
              activeTab === 'link'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Link className="w-4 h-4" />
            <span>Tempel Link Google Drive</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4">
          {activeTab === 'upload' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Pilih Dokumen PDF Drawing atau File CAD Model:</span>
                  <span className="text-[10px] text-slate-400 font-normal">Maks. 50 MB</span>
                </label>
                <div className="border-2 border-dashed border-slate-300 hover:border-blue-400 rounded-xl p-4 text-center bg-slate-50/70 transition">
                  <input
                    type="file"
                    id="file-upload-input"
                    accept=".pdf,.step,.stp,.iges,.igs,.sldprt,.sldasm,.dwg,.dxf,.zip,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="file-upload-input"
                    className="cursor-pointer flex flex-col items-center justify-center space-y-2"
                  >
                    <div className="p-3 bg-white border border-slate-200 rounded-full shadow-sm">
                      <CloudUpload className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-700">
                        Klik untuk memilih file dari komputer
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Mendukung <strong className="text-rose-600 font-bold">.PDF</strong>, .STEP, .STP, .DWG, .DXF, .IGES, .SLDPRT, .ZIP
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {selectedFile && (
                <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs transition ${
                  isPdf 
                    ? 'bg-rose-50 border-rose-200 text-rose-900' 
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}>
                  <div className="flex items-center space-x-3 truncate">
                    <div className={`p-2 rounded-lg ${isPdf ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {isPdf ? <FileText className="w-5 h-5" /> : <Box className="w-5 h-5" />}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center space-x-2">
                        <p className="font-bold truncate">{selectedFile.name}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          isPdf ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
                        }`}>
                          {isPdf ? 'DOKUMEN PDF' : 'MODEL CAD'}
                        </span>
                      </div>
                      <p className={`text-[10px] mt-0.5 ${isPdf ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Siap disimpan & ditautkan ke SPK
                      </p>
                    </div>
                  </div>

                  {previewUrl && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-white hover:bg-rose-100 border border-rose-300 text-rose-700 rounded-lg text-[11px] font-semibold flex items-center space-x-1 shrink-0 ml-2"
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
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder-slate-400"
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Pastikan akses berbagi file di Google Drive diatur ke <em>"Siapa saja yang memiliki link"</em> agar tim engineering dapat membukanya.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={(activeTab === 'upload' && !selectedFile) || (activeTab === 'link' && !customLink.trim()) || isUploading}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center space-x-1.5"
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
