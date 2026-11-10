import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config/env.js';
import { isMock } from './config/supabase.js';
import youtubeRoutes from './routes/youtube.routes.js';
import roadmapRoutes from './routes/roadmap.routes.js';
import oracleRoutes from './routes/oracle.routes.js';
import { YouTubeService } from './services/youtube.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const youtubeService = new YouTubeService();

// Middlewares
app.use(cors());
app.use(express.json());

// Archivos estáticos si existieran
app.use(express.static(path.join(__dirname, '../public')));

// Ruta de Salud
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Documentación de Bienvenida y Rutas
app.get('/', (_req: Request, res: Response) => {
  res.json({
    name: 'YouTube Data API v3 & Supabase Integration Backend',
    version: '1.0.0',
    description: 'Generador de Roadmaps de 30 Días para Instagram a partir de tendencias de YouTube',
    supabase_status: isMock ? 'fallback_in_memory' : 'connected_cloud',
    youtube_status: config.youtubeApiKey ? 'configured' : 'mock_ready',
    endpoints: {
      health: 'GET /health',
      youtubeSearch: 'GET /api/youtube/search?q=:niche&maxResults=5&saveToDb=true',
      youtubeHistory: 'GET /api/youtube/history',
      allVideos: 'GET /api/videos',
      roadmapGet: 'GET /api/roadmap?niche=:niche',
      roadmapGenerate: 'POST /api/roadmap/generate { niche: string }',
      roadmapStatusUpdate: 'PATCH /api/roadmap/:id/status { status: string }',
    },
  });
});

// Endpoint directo para listar videos
app.get('/api/videos', async (_req: Request, res: Response) => {
  try {
    const videos = await youtubeService.getStoredVideos();
    res.json({ success: true, count: videos.length, videos });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Rutas de Módulos
app.use('/api/youtube', youtubeRoutes);
app.use('/api/roadmap', roadmapRoutes);
app.use('/api/oracle', oracleRoutes);
app.use('/api/cron', oracleRoutes);

// Iniciar Servidor
const server = app.listen(config.port, () => {
  console.log(`
======================================================
🚀 Servidor iniciado exitosamente en http://localhost:${config.port}
📡 YouTube API: ${config.youtubeApiKey ? 'Configurada ✅' : 'Modo Mock / Fallback ℹ️'}
🗄️  Supabase: ${isMock ? 'Modo Fallback en memoria (configura SUPABASE_URL en .env) ℹ️' : 'Conectado ✅'}
📖 Documentación y Endpoints: http://localhost:${config.port}/
======================================================
  `);
});

export default app;
