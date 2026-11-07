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

import { generateAIInsights } from './src/server/aiService';

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

    const result = await generateAIInsights({ contextType, period, dataSummary, role });
    return res.json(result);
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
