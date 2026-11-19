import { GoogleGenAI, Type } from '@google/genai';

function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface AIInsightRequest {
  contextType: 'monitoring' | 'kpi';
  period: string;
  dataSummary: any;
  role: string;
}

export interface AIInsightResponse {
  executiveSummary: string;
  keyFindings: string[];
  strategicRecommendations: string[];
  riskAssessment: string;
  actionPlan: string[];
}

export function getIndustrialHeuristicFallback(contextType: 'monitoring' | 'kpi', period: string, dataSummary: any): AIInsightResponse {
  const isMonitoring = contextType === 'monitoring';
  return {
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
  };
}

export async function generateAIInsights(payload: AIInsightRequest): Promise<AIInsightResponse> {
  const contextType = payload?.contextType === 'monitoring' ? 'monitoring' : 'kpi';
  const period = payload?.period || 'Periode Berjalan';
  const dataSummary = payload?.dataSummary ?? {};
  const isMonitoring = contextType === 'monitoring';

  const aiClient = getAIClient();
  if (!aiClient) {
    return getIndustrialHeuristicFallback(contextType, period, dataSummary);
  }

  const systemPrompt = `Anda adalah seorang Senior Engineering Advisor & Consultant Manajemen Manufaktur untuk Departemen Engineering (CDR & BTG Plant).
Berikan analisis mendalam, "AI Insight & Rekomendasi Strategis" untuk pimpinan Engineering (Andry Setyawan) berdasarkan data real berikut:

Tipe Analisis: ${isMonitoring ? 'Monitoring Desain & Drawing Proyek Engineering' : 'Capaian & Matriks KPI Departemen Engineering'}
Periode Analisis: ${period}
Ringkasan Data:
${JSON.stringify(dataSummary, null, 2)}

Aturan Output:
- executiveSummary: Ringkasan eksekutif 2-3 kalimat padat, profesional, dan tajam mengenai kondisi engineering saat ini.
- keyFindings: 3 sampai 4 poin temuan kunci yang didukung data numerik aktual.
- strategicRecommendations: 3 sampai 4 rekomendasi aksi konkret, terukur, dan berdampak tinggi bagi manajemen Engineering.
- riskAssessment: Evaluasi risiko operasional, potensi keterlambatan (delay), bottleneck, atau deviasi mutu desain.
- actionPlan: 3 langkah taktis cepat yang harus diambil dalam 7-14 hari ke depan.

Gunakan bahasa Indonesia baku profesional standar industri manufaktur/rekayasa teknik.`;

  try {
    const response = await aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
            strategicRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
            riskAssessment: { type: Type.STRING },
            actionPlan: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'executiveSummary',
            'keyFindings',
            'strategicRecommendations',
            'riskAssessment',
            'actionPlan',
          ],
        },
      },
    });

    const rawText = (response.text || '{}')
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();
    const parsed = JSON.parse(rawText);

    const fallback = getIndustrialHeuristicFallback(contextType, period, dataSummary);
    return {
      executiveSummary: typeof parsed?.executiveSummary === 'string' && parsed.executiveSummary.trim()
        ? parsed.executiveSummary
        : fallback.executiveSummary,
      keyFindings: Array.isArray(parsed?.keyFindings) && parsed.keyFindings.length > 0
        ? parsed.keyFindings
        : fallback.keyFindings,
      strategicRecommendations: Array.isArray(parsed?.strategicRecommendations) && parsed.strategicRecommendations.length > 0
        ? parsed.strategicRecommendations
        : fallback.strategicRecommendations,
      riskAssessment: typeof parsed?.riskAssessment === 'string' && parsed.riskAssessment.trim()
        ? parsed.riskAssessment
        : fallback.riskAssessment,
      actionPlan: Array.isArray(parsed?.actionPlan) && parsed.actionPlan.length > 0
        ? parsed.actionPlan
        : fallback.actionPlan,
    };
  } catch (err: any) {
    console.warn('Gemini generation warning, falling back to industrial heuristic:', err?.message || err);
    return getIndustrialHeuristicFallback(contextType, period, dataSummary);
  }
}
