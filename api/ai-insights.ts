import { generateAIInsights } from '../src/server/aiService.ts';

// Vercel Serverless Function Handler for /api/ai-insights
export default async function handler(req: any, res: any) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Use POST.' });
  }

  try {
    const rawBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { contextType, period, dataSummary, role } = rawBody;

    const isAuthorized = role === 'Manager' || (role === 'Supervisor' && contextType === 'kpi');
    if (!isAuthorized) {
      return res.status(403).json({
        error: 'Akses ditolak: Fitur AI Insight & Rekomendasi hanya dapat diakses oleh Engineering Manager atau Supervisor (KPI CDR).',
      });
    }

    const result = await generateAIInsights({ contextType, period, dataSummary, role });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('Vercel API Error:', error);
    return res.status(500).json({
      error: error?.message || 'Gagal memproses AI insight.',
    });
  }
}
