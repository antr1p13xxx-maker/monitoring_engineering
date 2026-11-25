import React, { useEffect, useState } from 'react';
import { StandartPartAttachment } from '../types/engineering';
import {
  dataUrlToBlobUrl,
  downloadAttachment,
  formatFileSize
} from '../utils/partAttachmentUtils';
import {
  X,
  Download,
  FileText,
  Image as ImageIcon,
  Trash2,
  Tag
} from 'lucide-react';

interface PartAttachmentPreviewModalProps {
  attachment: StandartPartAttachment | null;
  onClose: () => void;
  onDelete?: () => void;
}

export const PartAttachmentPreviewModal: React.FC<PartAttachmentPreviewModalProps> = ({
  attachment,
  onClose,
  onDelete
}) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment || attachment.fileType !== 'pdf') {
      setPdfBlobUrl(null);
      return;
    }
    const url = dataUrlToBlobUrl(attachment.dataUrl);
    setPdfBlobUrl(url);
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment]);

  if (!attachment) return null;

  const isPdf = attachment.fileType === 'pdf';

  return (
    <div
      className="fixed inset-0 bg-slate-950/85 z-[190] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col border border-slate-200 max-h-[92dvh] pb-safe"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="theme-header-bg text-white px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className={`p-2 rounded-xl shrink-0 ${
                isPdf ? 'bg-rose-500/25 text-rose-200' : 'bg-emerald-500/25 text-emerald-200'
              }`}
            >
              {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                {attachment.fileName}
              </h3>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-300 mt-0.5">
                <span className="uppercase font-bold">
                  {isPdf ? 'Dokumen PDF' : 'Foto Standart Part'}
                </span>
                <span>•</span>
                <span className="tabular-nums">{formatFileSize(attachment.sizeBytes)}</span>
                {attachment.partLabel && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-emerald-300 font-semibold">
                      <Tag className="w-3 h-3" />
                      {attachment.partLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau"
            className="min-w-[40px] min-h-[40px] rounded-xl text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview Canvas */}
        <div className="p-3 sm:p-5 bg-slate-100 overflow-y-auto flex-1 flex flex-col items-center justify-center">
          {isPdf ? (
            <div className="w-full space-y-2.5">
              {pdfBlobUrl ? (
                <iframe
                  src={pdfBlobUrl}
                  title={attachment.fileName}
                  className="w-full h-[58dvh] sm:h-[65dvh] rounded-xl border border-slate-300 bg-white shadow-inner"
                />
              ) : (
                <div className="bg-white rounded-xl border border-slate-200 p-8 text-center space-y-2">
                  <FileText className="w-10 h-10 text-rose-500 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">
                    Pratinjau PDF tidak didukung langsung di browser ini.
                  </p>
                </div>
              )}
              <p className="text-[11px] text-slate-500 text-center">
                Jika PDF tidak tampil di browser HP, ketuk tombol <strong>Unduh File</strong> di bawah untuk membukanya.
              </p>
            </div>
          ) : (
            <div className="w-full flex items-center justify-center bg-slate-900/5 rounded-xl p-2 border border-slate-200">
              <img
                src={attachment.dataUrl}
                alt={attachment.fileName}
                className="max-h-[64dvh] w-auto max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-5 py-3 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="min-h-[42px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold flex items-center space-x-1.5 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Hapus Lampiran</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => downloadAttachment(attachment)}
              className="min-h-[42px] sm:min-h-[38px] px-4 py-2 rounded-xl theme-btn-primary text-xs font-bold flex items-center space-x-1.5 transition"
            >
              <Download className="w-4 h-4" />
              <span>Unduh File</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] sm:min-h-[38px] px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
            >
              Tutup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
