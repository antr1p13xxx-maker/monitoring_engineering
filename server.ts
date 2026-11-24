import express from 'express';
import dotenv from 'dotenv';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateAIInsights } from './src/server/aiService.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = http.createServer(app);
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json({ limit: '10mb' }));

// AI Insights & Strategic Recommendations Endpoint (Manager, or Supervisor on KPI CDR)
app.post('/api/ai-insights', async (req, res) => {
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
    return res.json(result);
  } catch (error: any) {
    console.error('AI Insights API Error:', error);
    return res.status(500).json({
      error: error?.message || 'Gagal memproses AI insight.',
    });
  }
});

// Development vs Production serving
if (process.env.NODE_ENV !== 'production') {
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: {
      middlewareMode: true,
      ws: { server: httpServer },
      ...(process.env.DISABLE_HMR === 'true' ? { hmr: false } : {}),
    },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.resolve(__dirname, 'dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
  });
}

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Engineering System server listening on http://0.0.0.0:${PORT}`);
});
