import React, { useState } from 'react';
import { CloudUpload, X, FileCheck, AlertCircle } from 'lucide-react';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = () => {
    if (!selectedFile || !spk) return;
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      const simulatedDriveUrl = `https://drive.google.com/file/d/cad_${spk.toLowerCase()}_${Date.now()}/view`;
      onUploadSuccess(spk, simulatedDriveUrl, selectedFile.name);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[140] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col border border-slate-200">
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-600 rounded-xl text-white">
              <CloudUpload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Upload File CAD ke Google Drive</h3>
              <p className="text-xs text-slate-400">Target SPK: <span className="text-emerald-400 font-mono font-bold">{spk}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Pilih File Model CAD / 3D Assembly (Maks. 50 MB)
            </label>
            <input
              type="file"
              accept=".step,.stp,.iges,.igs,.sldprt,.sldasm,.dwg,.pdf,.zip"
              onChange={handleFileChange}
              className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500 focus:outline-none file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Format yang didukung: <strong>.step, .stp, .iges, .sldprt, .dwg, .pdf, .zip</strong>
            </p>
          </div>

          {selectedFile && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3 text-emerald-800 text-xs">
              <FileCheck className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <div className="truncate">
                <p className="font-semibold truncate">{selectedFile.name}</p>
                <p className="text-[10px] text-emerald-600">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB • Siap disimpan ke Drive</p>
              </div>
            </div>
          )}

          <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
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
              disabled={!selectedFile || isUploading}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center space-x-1.5"
            >
              {isUploading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Mengunggah...</span>
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  <span>Simpan ke Drive</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
