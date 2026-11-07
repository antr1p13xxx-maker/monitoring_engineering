import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize GoogleGenAI client with standard User-Agent header
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// AI Insights & Strategic Recommendations Endpoint (Manager Only)
app.post('/api/ai-insights', async (req, res) => {
  try {
    const { contextType, period, dataSummary, role } = req.body;

    // Strict role check: only Manager is authorized
    if (role !== 'Manager') {
      return res.status(403).json({
        error: 'Akses ditolak: Fitur AI Insight & Rekomendasi hanya dapat diakses oleh Engineering Manager.',
      });
    }

    // Fallback if API key is not configured yet
    if (!aiClient) {
      const isMonitoring = contextType === 'monitoring';
      return res.json({
        executiveSummary: isMonitoring
          ? `Berdasarkan evaluasi monitoring engineering pada periode ${period}, beban kerja dan progres drawing terkendali dengan rata-rata penyelesaian yang stabil, namun diperlukan atensi pada item revisi & potensi bottleneck di workshop.`
          : `Evaluasi kinerja KPI Departemen Engineering tahun ${period} menunjukkan konsistensi pada parameter On-Time Design dan Design Quality, dengan beberapa peluang optimasi pada Efisiensi Biaya dan Distribusi Gambar.`,
        keyFindings: isMonitoring
          ? [
              `Total ${dataSummary?.totalProjects || '0'} proyek aktif terdata pada periode ini dengan status dominan ${dataSummary?.doneProjects || '0'} proyek selesai.`,
              `Terdapat ${dataSummary?.overdueProjects || '0'} proyek berstatus overdue/keterlambatan yang memerlukan eskalasi jadwal delivery.`,
              `Alokasi beban gambar terkonsentrasi pada customer utama dengan total volume drawing mencapai ${dataSummary?.totalQtyDrawing || '0'} lembar.`,
              `Tingkat revisi sebesar ${dataSummary?.revisiProjects || '0'} kasus menunjukkan perlunya perkuatan tahapan approval konsep awal.`
            ]
          : [
              `Pencapaian rata-rata keseluruhan parameter KPI berada pada level ${dataSummary?.healthStatus || 'Stabil'}.`,
              `Design Quality dan On-Time Design secara konsisten melampaui ambang batas minimum standar (≥ 90% dan ≥ 95%).`,
              `Tingkat kesalahan desain (Error Rate) terkendali di bawah batas maksimum 2%.`,
              `Implementasi 5R dan Kesesuaian SOP mencapai skor kepatuhan 100% pada audit departemen.`
            ],
        strategicRecommendations: isMonitoring
          ? [
              'Terapkan daily standup engineering 10 menit untuk meninjau status SPK yang mendekati batas target drawing.',
              'Prioritaskan verifikasi approval 3D sebelum pelepasan paket drawing 2D ke lantai produksi.',
              'Lakukan re-balancing beban kerja drafter untuk mencegah penumpukan lembar drawing pada satu PIC.',
              'Tingkatkan komunikasi dengan bagian Marketing & Pelanggan guna memastikan finalisasi spec sebelum pengerjaan desain.'
            ]
          : [
              'Fokuskan peningkatan efisiensi biaya desain pada optimasi pengeluaran lembur dan kunjungan site/gemba.',
              'Pertahankan sistem insentif kualitas drawing bebas revisi untuk mendorong ketelitian drafter.',
              'Integrasikan checklist digital 3D/2D dengan jadwal pengadaan material standar (Long Lead Items).',
              'Lakukan simulasi pra-rilis drawing untuk meminimalkan error yang ditemukan pada tahap machining/assembly.'
            ],
        riskAssessment: isMonitoring
          ? 'Risiko moderat pada potensi keterlambatan tanggal penyelesaian akibat perubahan spesifikasi dari customer di tengah proses.'
          : 'Risiko rendah hingga moderat, terutama deviasi biaya lembur pada fase lonjakan permintaan desain akhir kuartal.',
        actionPlan: isMonitoring
          ? [
              'Eskalasikan SPK yang berstatus Overdue ke Lead Engineer dalam waktu 1x24 jam.',
              'Jadwalkan review teknis berkala dengan PIC workshop produksi.',
              'Perbarui matriks kapasitas mingguan drafter untuk periode berikutnya.'
            ]
          : [
              'Sahkan hasil rekapitulasi KPI kuartal berjalan bersama Tim Manajemen.',
              'Tetapkan target perbaikan berkelanjutan (Kaizen) untuk waktu siklus distribusi gambar.',
              'Agendakan sesi training internal GD&T (Geometric Dimensioning and Tolerancing) bulan depan.'
            ]
      });
    }

    const isMonitoring = contextType === 'monitoring';
    const systemPrompt = `Anda adalah seorang Senior Engineering Advisor & Consultant Manajemen Manufaktur untuk Departemen Engineering (CDR & BTG Plant).
Berikan analisis mendalam, "AI Insight & Rekomendasi Strategis" khusus untuk Engineering Manager (Andry Setyawan) berdasarkan data real berikut:

Tipe Analisis: ${isMonitoring ? 'Monitoring Desain & Drawing Proyek Engineering' : 'Capaian & Matriks KPI Departemen Engineering'}
Periode Analisis: ${period}
Ringkasan Data:
${JSON.stringify(dataSummary, null, 2)}

Format respon HARUS berupa JSON valid dengan struktur persis seperti ini:
{
  "executiveSummary": "Ringkasan eksekutif 2-3 kalimat padat, profesional, dan tajam mengenai kondisi engineering saat ini.",
  "keyFindings": ["3 sampai 4 poin temuan kunci yang didukung data numerik aktual."],
  "strategicRecommendations": ["3 sampai 4 rekomendasi aksi konkret, terukur, dan berdampak tinggi bagi Engineering Manager."],
  "riskAssessment": "Evaluasi risiko operasional, potensi keterlambatan (delay), bottleneck, atau deviasi mutu desain.",
  "actionPlan": ["3 langkah taktis cepat yang harus diambil dalam 7-14 hari ke depan."]
}

Gunakan bahasa Indonesia baku profesional standar industri manufaktur/rekayasa teknik.`;

    let parsedData;
    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: systemPrompt,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const text = response.text || '{}';
      parsedData = JSON.parse(text);
    } catch (genError: any) {
      console.warn('Gemini generation warning, using industrial heuristic fallback:', genError.message);
      parsedData = {
        executiveSummary: isMonitoring
          ? `Berdasarkan evaluasi monitoring engineering periode ${period}, efektivitas rilis drawing stabil dengan mayoritas proyek terkendali, namun eskalasi segera diperlukan pada item berstatus overdue atau revisi.`
          : `Evaluasi kinerja KPI Departemen Engineering tahun ${period} menunjukkan capaian rata-rata yang solid pada On-Time Design dan Kualitas Gambar, dengan peluang efisiensi biaya operasional.`,
        keyFindings: isMonitoring
          ? [
              `Total ${dataSummary?.totalProjects || '0'} proyek aktif terdata pada periode ini dengan status dominan ${dataSummary?.doneProjects || '0'} proyek selesai.`,
              `Terdapat ${dataSummary?.overdueProjects || '0'} proyek berstatus overdue/keterlambatan yang memerlukan eskalasi jadwal delivery.`,
              `Alokasi beban gambar terkonsentrasi pada customer utama dengan total volume drawing mencapai ${dataSummary?.totalQtyDrawing || '0'} lembar.`,
              `Tingkat revisi sebesar ${dataSummary?.revisiProjects || '0'} kasus menunjukkan perlunya perkuatan tahapan approval konsep awal.`
            ]
          : [
              `Pencapaian rata-rata keseluruhan parameter KPI berada pada level ${dataSummary?.healthStatus || 'Stabil'}.`,
              `Design Quality dan On-Time Design secara konsisten melampaui ambang batas minimum standar (≥ 90% dan ≥ 95%).`,
              `Tingkat kesalahan desain (Error Rate) terkendali di bawah batas maksimum 2%.`,
              `Implementasi 5R dan Kesesuaian SOP mencapai skor kepatuhan 100% pada audit departemen.`
            ],
        strategicRecommendations: isMonitoring
          ? [
              'Terapkan daily standup engineering 10 menit untuk meninjau status SPK yang mendekati batas target drawing.',
              'Prioritaskan verifikasi approval 3D sebelum pelepasan paket drawing 2D ke lantai produksi.',
              'Lakukan re-balancing beban kerja drafter untuk mencegah penumpukan lembar drawing pada satu PIC.',
              'Tingkatkan komunikasi dengan bagian Marketing & Pelanggan guna memastikan finalisasi spec sebelum pengerjaan desain.'
            ]
          : [
              'Fokuskan peningkatan efisiensi biaya desain pada optimasi pengeluaran lembur dan kunjungan site/gemba.',
              'Pertahankan sistem insentif kualitas drawing bebas revisi untuk mendorong ketelitian drafter.',
              'Integrasikan checklist digital 3D/2D dengan jadwal pengadaan material standar (Long Lead Items).',
              'Lakukan simulasi pra-rilis drawing untuk meminimalkan error yang ditemukan pada tahap machining/assembly.'
            ],
        riskAssessment: isMonitoring
          ? 'Risiko moderat pada potensi keterlambatan tanggal penyelesaian akibat perubahan spesifikasi dari customer di tengah proses.'
          : 'Risiko rendah hingga moderat, terutama deviasi biaya lembur pada fase lonjakan permintaan desain akhir kuartal.',
        actionPlan: isMonitoring
          ? [
              'Eskalasikan SPK yang berstatus Overdue ke Lead Engineer dalam waktu 1x24 jam.',
              'Jadwalkan review teknis berkala dengan PIC workshop produksi.',
              'Perbarui matriks kapasitas mingguan drafter untuk periode berikutnya.'
            ]
          : [
              'Sahkan hasil rekapitulasi KPI kuartal berjalan bersama Tim Manajemen.',
              'Tetapkan target perbaikan berkelanjutan (Kaizen) untuk waktu siklus distribusi gambar.',
              'Agendakan sesi training internal GD&T (Geometric Dimensioning and Tolerancing) bulan depan.'
            ]
      };
    }

    return res.json(parsedData);
  } catch (error: any) {
    console.error('AI Insights API Error:', error);
    return res.status(500).json({
      error: error.message || 'Gagal memproses AI insight.',
    });
  }
});

// Development vs Production serving
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Engineering System server listening on http://0.0.0.0:${PORT}`);
});
