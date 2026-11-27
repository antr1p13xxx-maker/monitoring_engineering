import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

interface CustomerBarcodeGraphicProps {
  barcodeId: string;
  qrValue: string;
  customerName: string;
  compact?: boolean;
  codePrefixLabel?: string;
}

export async function generateBarcodeAssets(
  barcodeId: string,
  qrValue: string
): Promise<{ qrDataUrl: string; barcodeDataUrl: string }> {
  const qrDataUrl = await QRCode.toDataURL(qrValue, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: 'M',
    color: {
      dark: '#0f172a',
      light: '#ffffff'
    }
  });

  const canvas = document.createElement('canvas');
  JsBarcode(canvas, barcodeId, {
    format: 'CODE128',
    width: 2.2,
    height: 54,
    displayValue: true,
    fontSize: 13,
    font: 'monospace',
    textMargin: 4,
    margin: 8,
    background: '#ffffff',
    lineColor: '#0f172a'
  });

  return {
    qrDataUrl,
    barcodeDataUrl: canvas.toDataURL('image/png')
  };
}

export async function downloadCustomerStickerPng(params: {
  barcodeId: string;
  customerName: string;
  qrValue: string;
  subtitle: string;
}) {
  const { barcodeId, customerName, qrValue, subtitle } = params;
  const { qrDataUrl, barcodeDataUrl } = await generateBarcodeAssets(barcodeId, qrValue);

  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const [qrImg, barImg] = await Promise.all([loadImg(qrDataUrl), loadImg(barcodeDataUrl)]);

  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Clean industrial white label background with dark slate frame
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  // Header strip
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(12, 12, canvas.width - 24, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PT. KURNIA MUSTIKA INDAH LESTARI · ENGINEERING DOSSIER', 28, 44);

  // Left: QR Code
  ctx.drawImage(qrImg, 28, 82, 210, 210);

  // Right: Customer info + Code-128 Barcode
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`KODE BARCODE: ${barcodeId}`, 260, 108);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px sans-serif';
  const maxWidth = 465;
  let displayTitle = customerName;
  while (ctx.measureText(displayTitle).width > maxWidth && displayTitle.length > 5) {
    displayTitle = displayTitle.slice(0, -4) + '...';
  }
  ctx.fillText(displayTitle, 260, 144);

  ctx.fillStyle = '#334155';
  ctx.font = '15px sans-serif';
  ctx.fillText(subtitle, 260, 174);

  // Code-128 Linear Barcode
  const barAspect = barImg.width / Math.max(1, barImg.height);
  const drawW = Math.min(460, 88 * barAspect);
  const drawH = drawW / barAspect;
  ctx.drawImage(barImg, 260, 200, drawW, drawH);

  // Footer note
  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  ctx.fillText('Scan QR / Barcode untuk membuka rekam jejak proyek, std part, & KPI kastamer', 28, 326);

  const link = document.createElement('a');
  link.download = `Barcode_${barcodeId}_${customerName.replace(/[^a-zA-Z0-9]+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export async function downloadSpkStickerPng(params: {
  spk: string;
  projectName: string;
  customerName: string;
  pic: string;
  status: string;
  targetDesign: string;
  progressText: string;
  qrValue: string;
}) {
  const { spk, projectName, customerName, pic, status, targetDesign, progressText, qrValue } = params;
  const { qrDataUrl, barcodeDataUrl } = await generateBarcodeAssets(spk, qrValue);

  const loadImg = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });

  const [qrImg, barImg] = await Promise.all([loadImg(qrDataUrl), loadImg(barcodeDataUrl)]);

  const canvas = document.createElement('canvas');
  canvas.width = 760;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  // Header strip
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(12, 12, canvas.width - 24, 52);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('PT. KURNIA MUSTIKA INDAH LESTARI · PROGRESS SPK', 28, 44);

  // Left: QR Code
  ctx.drawImage(qrImg, 28, 82, 210, 210);

  // Right: SPK & Project Info + Code-128
  ctx.fillStyle = '#475569';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(`SPK: ${spk}  ·  STATUS: ${status.toUpperCase()}`, 260, 102);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px sans-serif';
  const maxWidth = 465;
  let displayTitle = projectName || spk;
  while (ctx.measureText(displayTitle).width > maxWidth && displayTitle.length > 5) {
    displayTitle = displayTitle.slice(0, -4) + '...';
  }
  ctx.fillText(displayTitle, 260, 136);

  ctx.fillStyle = '#334155';
  ctx.font = '14px sans-serif';
  let sub1 = `${customerName || '-'} · PIC: ${pic || '-'}`;
  while (ctx.measureText(sub1).width > maxWidth && sub1.length > 5) {
    sub1 = sub1.slice(0, -4) + '...';
  }
  ctx.fillText(sub1, 260, 162);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`Progress: ${progressText}  ·  Target: ${targetDesign || '-'}`, 260, 185);

  // Code-128 Linear Barcode
  const barAspect = barImg.width / Math.max(1, barImg.height);
  const drawW = Math.min(460, 84 * barAspect);
  const drawH = drawW / barAspect;
  ctx.drawImage(barImg, 260, 202, drawW, drawH);

  // Footer note
  ctx.fillStyle = '#64748b';
  ctx.font = '12px sans-serif';
  ctx.fillText('Scan QR / Barcode untuk membuka & update progres checklist SPK ini secara langsung', 28, 326);

  const link = document.createElement('a');
  link.download = `Barcode_SPK_${spk.replace(/[^a-zA-Z0-9]+/g, '_')}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export const CustomerBarcodeGraphic: React.FC<CustomerBarcodeGraphicProps> = ({
  barcodeId,
  qrValue,
  customerName,
  compact = false,
  codePrefixLabel = 'CODE-128'
}) => {
  const [qrUrl, setQrUrl] = useState<string>('');
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(qrValue, {
      width: compact ? 180 : 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    })
      .then((url) => {
        if (active) setQrUrl(url);
      })
      .catch((err) => console.error('QR generation error:', err));

    return () => {
      active = false;
    };
  }, [qrValue, compact]);

  useEffect(() => {
    if (!svgRef.current) return;
    try {
      JsBarcode(svgRef.current, barcodeId, {
        format: 'CODE128',
        width: compact ? 1.35 : 1.7,
        height: compact ? 36 : 48,
        displayValue: true,
        fontSize: compact ? 11 : 13,
        font: 'monospace',
        textMargin: 3,
        margin: 4,
        background: '#ffffff',
        lineColor: '#0f172a'
      });
    } catch (err) {
      console.error('Code128 generation error:', err);
    }
  }, [barcodeId, compact]);

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl ${
        compact ? 'p-2.5 flex items-center gap-3' : 'p-3.5 sm:p-4 flex flex-col sm:flex-row items-center gap-4'
      }`}
    >
      <div className="shrink-0 bg-white border border-slate-200 rounded-lg p-1 flex items-center justify-center">
        {qrUrl ? (
          <img
            src={qrUrl}
            alt={`QR Code ${customerName} (${barcodeId})`}
            className={compact ? 'w-16 h-16 sm:w-20 sm:h-20 object-contain' : 'w-28 h-28 sm:w-32 sm:h-32 object-contain'}
          />
        ) : (
          <div className={compact ? 'w-16 h-16 bg-slate-100 animate-pulse rounded' : 'w-28 h-28 bg-slate-100 animate-pulse rounded'} />
        )}
      </div>

      <div className="min-w-0 flex-1 flex flex-col items-center sm:items-start justify-center overflow-hidden">
        <span className="text-[10px] font-mono font-bold tracking-wider text-slate-500 uppercase truncate max-w-full">
          {codePrefixLabel} · {barcodeId}
        </span>
        <div className="w-full flex justify-center sm:justify-start overflow-hidden mt-1">
          <svg
            ref={svgRef}
            aria-label={`Barcode ${barcodeId}`}
            className="max-w-full h-auto"
          />
        </div>
      </div>
    </div>
  );
};
