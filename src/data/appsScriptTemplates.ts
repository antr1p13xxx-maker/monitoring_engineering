import codeGsRaw from '../../apps-script/Code.gs?raw';
import indexHtmlRaw from '../../apps-script/Index.html?raw';

export const CODE_GS_CONTENT = codeGsRaw;
export const INDEX_HTML_CONTENT = indexHtmlRaw;

export const DEPLOYMENT_STEPS = [
  {
    step: 1,
    title: 'Buat Google Spreadsheet Baru',
    description: 'Buka https://sheets.new di browser Anda untuk membuat Spreadsheet baru yang akan menjadi database proyek engineering.'
  },
  {
    step: 2,
    title: 'Buka Editor Apps Script',
    description: 'Pada menu spreadsheet, klik Ekstensi (Extensions) > Apps Script.'
  },
  {
    step: 3,
    title: 'Tempelkan Code.gs',
    description: 'Hapus kode bawaan di file Code.gs, lalu salin dan tempelkan seluruh kode dari tab "Code.gs". Simpan file (Ctrl+S).'
  },
  {
    step: 4,
    title: 'Buat File HTML "Index"',
    description: 'Klik ikon tambah (+) di panel kiri editor Apps Script > pilih HTML > beri nama "Index" (tanpa ekstensi .html). Tempelkan seluruh isi file Index.html ke dalamnya lalu Simpan file.'
  },
  {
    step: 5,
    title: 'Jalankan setupDatabase()',
    description: 'Pilih fungsi "setupDatabase" dari dropdown toolbar di atas editor, lalu klik Run / Jalankan untuk menyiapkan tabel dan sheet otomatis (setujui otorisasi izin saat diminta).'
  },
  {
    step: 6,
    title: 'Deploy Web App',
    description: 'Klik Deploy > New Deployment > Pilih Web app > Set "Execute as: Me" dan "Who has access: Anyone" > Klik Deploy dan salin Web App URL Anda!'
  }
];
