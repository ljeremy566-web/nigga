import { Router, Request, Response } from 'express';
import { InstagramService, CapturedInstagramReelInput } from '../services/instagram.service.js';
import { IgRoadmapService } from '../services/ig-roadmap.service.js';

const router = Router();
const instagramService = new InstagramService();
const igRoadmapService = new IgRoadmapService();

// GET /api/instagram/status
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const stats = await instagramService.getCaptureStats();
    return res.json({
      success: true,
      reelsCount: stats.count,
      lastCapturedAt: stats.lastCapturedAt,
      mode: stats.count > 0 ? 'captured_real' : 'ready_for_capture',
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/instagram/reels?query=...&author=...
router.get('/reels', async (req: Request, res: Response) => {
  try {
    const query = req.query.query as string | undefined;
    const author = req.query.author as string | undefined;
    const reels = await instagramService.getCapturedReels({ query, author });
    return res.json({
      success: true,
      count: reels.length,
      reels,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/instagram/reels/capture
router.post('/reels/capture', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    let reelsInput: CapturedInstagramReelInput[] = [];
    let sourceQuery = 'General';
    let capturedVia = 'antigravity_browser';

    if (Array.isArray(body)) {
      reelsInput = body;
    } else if (body && typeof body === 'object') {
      sourceQuery = body.sourceQuery || body.source_query || body.query || 'General';
      capturedVia = body.capturedVia || body.captured_via || 'antigravity_browser';
      if (Array.isArray(body.reels)) {
        reelsInput = body.reels;
      } else if (body.shortcode || body.reelUrl || body.reel_url || body.url || body.caption) {
        reelsInput = [body];
      }
    }

    if (reelsInput.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere al menos un Reel en el payload (array o { reels: [...] }).',
      });
    }

    const saved = await instagramService.captureReelsBatch(
      reelsInput.slice(0, 30),
      sourceQuery,
      capturedVia
    );

    return res.json({
      success: true,
      count: saved.length,
      sourceQuery,
      reels: saved,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/instagram/reels/:shortcode
router.delete('/reels/:shortcode', async (req: Request, res: Response) => {
  try {
    const deleted = await instagramService.deleteCapturedReel(req.params.shortcode);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Reel capturado no encontrado' });
    }
    return res.json({ success: true, message: 'Reel eliminado del catálogo' });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/instagram/roadmap?niche=...
router.get('/roadmap', async (req: Request, res: Response) => {
  try {
    const niche = req.query.niche as string | undefined;
    const items = await igRoadmapService.getIgRoadmap(niche);
    const stats = await instagramService.getCaptureStats();

    return res.json({
      success: true,
      count: items.length,
      niche: niche || 'Todos',
      capturedReelsCount: stats.count,
      roadmap: items,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/instagram/roadmap/generate
router.post('/roadmap/generate', async (req: Request, res: Response) => {
  try {
    const { niche, sourceQuery, shortcodes } = req.body || {};
    const targetNiche = String(niche || 'Inteligencia Artificial y Productividad').trim();
    const { items, reelsUsed } = await igRoadmapService.generate30DayIgRoadmap(targetNiche, {
      sourceQuery,
      shortcodes: Array.isArray(shortcodes) ? shortcodes : undefined,
    });

    return res.json({
      success: true,
      message:
        reelsUsed > 0
          ? `Roadmap IG de 30 días generado con ${reelsUsed} Reels capturados para "${targetNiche}"`
          : `Roadmap IG de 30 días generado para "${targetNiche}" (sin Reels capturados aún; usando estructura base IG)`,
      count: items.length,
      reelsUsed,
      roadmap: items,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/instagram/roadmap/:id/status
router.patch('/roadmap/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, niche } = req.body || {};
    const validStatuses = ['pendiente', 'grabado', 'editado', 'publicado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`,
      });
    }

    const updated = await igRoadmapService.updateIgItemStatus(id, status, niche);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'Elemento del Roadmap IG no encontrado' });
    }
    return res.json({ success: true, message: `Estado IG actualizado a "${status}"` });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
