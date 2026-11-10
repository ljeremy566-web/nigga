import { Router, Request, Response } from 'express';
import { YouTubeService } from '../services/youtube.service.js';

const router = Router();
const youtubeService = new YouTubeService();

// GET /api/youtube/search?q=...&maxResults=5&saveToDb=true
router.get('/search', async (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string) || 'Programación y Tecnología';
    const maxResults = req.query.maxResults ? parseInt(req.query.maxResults as string, 10) : 5;
    const saveToDb = req.query.saveToDb !== 'false';

    const videos = await youtubeService.searchVideos(q, maxResults, saveToDb);

    return res.json({
      success: true,
      query: q,
      count: videos.length,
      savedToDb: saveToDb,
      videos,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/youtube/history
router.get('/history', async (_req: Request, res: Response) => {
  try {
    const history = await youtubeService.getSearchHistory();
    return res.json({ success: true, count: history.length, history });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
