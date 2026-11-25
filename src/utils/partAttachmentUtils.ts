import { StandartPartAttachment } from '../types/engineering';

export const ACCEPTED_PART_FILE_TYPES = 'image/*,.pdf,application/pdf';
export const MAX_PDF_SIZE_BYTES = 700 * 1024; // 700 KB per PDF (fits safely inside Firestore 1MB limit after base64)
export const MAX_ROW_ATTACHMENTS_BYTES = 880 * 1024; // ~880 KB total attachment payload per row

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export function getAttachmentsPayloadBytes(attachments: StandartPartAttachment[] = []): number {
  return attachments.reduce((sum, att) => sum + (att.dataUrl?.length || 0), 0);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error(`Gagal membaca file "${file.name}".`));
    reader.readAsDataURL(file);
  });
}

function compressImageFile(file: File, maxDim = 1280, quality = 0.78): Promise<{ dataUrl: string; sizeBytes: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Canvas tidak tersedia untuk memproses gambar.'));
          return;
        }

        // Fill white background in case PNG/WEBP has transparency before converting to JPEG
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        // Second pass if still bulky (> 220 KB base64)
        if (dataUrl.length > 220 * 1024) {
          const scale2 = 0.75;
          canvas.width = Math.max(1, Math.round(width * scale2));
          canvas.height = Math.max(1, Math.round(height * scale2));
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          dataUrl = canvas.toDataURL('image/jpeg', 0.64);
        }

        URL.revokeObjectURL(objectUrl);
        const estimatedBytes = Math.round((dataUrl.length * 3) / 4);
        resolve({ dataUrl, sizeBytes: estimatedBytes });
      } catch (err) {
        URL.revokeObjectURL(objectUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Format gambar "${file.name}" tidak dapat diproses browser.`));
    };
    img.src = objectUrl;
  });
}

export async function processPartAttachmentFile(
  file: File,
  options?: {
    partIndex?: number;
    partLabel?: string;
    existingAttachments?: StandartPartAttachment[];
  }
): Promise<StandartPartAttachment> {
  const lowerName = file.name.toLowerCase();
  const isPdf = file.type === 'application/pdf' || lowerName.endsWith('.pdf');
  const isImage =
    file.type.startsWith('image/') ||
    /\.(jpg|jpeg|png|webp|gif|bmp|heic|heif)$/i.test(lowerName);

  if (!isPdf && !isImage) {
    throw new Error(`Format "${file.name}" tidak didukung. Pilih file Foto (JPG/PNG/WEBP) atau PDF.`);
  }

  let dataUrl = '';
  let sizeBytes = file.size;
  let mimeType = file.type || (isPdf ? 'application/pdf' : 'image/jpeg');

  if (isPdf) {
    if (file.size > MAX_PDF_SIZE_BYTES) {
      throw new Error(
        `Ukuran PDF "${file.name}" (${formatFileSize(file.size)}) melebihi batas 700 KB agar dapat tersimpan & tersinkronisasi Cloud.`
      );
    }
    dataUrl = await readFileAsDataUrl(file);
    mimeType = 'application/pdf';
  } else {
    const compressed = await compressImageFile(file);
    dataUrl = compressed.dataUrl;
    sizeBytes = compressed.sizeBytes;
    mimeType = 'image/jpeg';
  }

  const existingBytes = getAttachmentsPayloadBytes(options?.existingAttachments || []);
  if (existingBytes + dataUrl.length > MAX_ROW_ATTACHMENTS_BYTES) {
    throw new Error(
      `Total ukuran lampiran pada baris ini penuh (maks ~880 KB per baris). Hapus lampiran lama atau unggah PDF yang lebih kecil.`
    );
  }

  return {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    partIndex: options?.partIndex,
    partLabel: options?.partLabel?.trim() || undefined,
    fileName: file.name,
    fileType: isPdf ? 'pdf' : 'image',
    mimeType,
    sizeBytes,
    dataUrl,
    uploadedAt: new Date().toISOString(),
  };
}

export function dataUrlToBlobUrl(dataUrl: string): string | null {
  try {
    const parts = dataUrl.split(',');
    if (parts.length < 2) return null;
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
    const binary = atob(parts[1]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

export function downloadAttachment(att: StandartPartAttachment): void {
  const link = document.createElement('a');
  const blobUrl = dataUrlToBlobUrl(att.dataUrl);
  link.href = blobUrl || att.dataUrl;
  link.download = att.fileName || (att.fileType === 'pdf' ? 'part-document.pdf' : 'part-photo.jpg');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  if (blobUrl) {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
  }
}
