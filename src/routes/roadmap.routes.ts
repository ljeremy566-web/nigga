import { Router, Request, Response } from 'express';
import { RoadmapService } from '../services/roadmap.service.js';

const router = Router();
const roadmapService = new RoadmapService();

// GET /api/roadmap?niche=...
router.get('/', async (req: Request, res: Response) => {
  try {
    const niche = req.query.niche as string | undefined;
    let items = await roadmapService.getRoadmap(niche);

    // Si aún no hay items, autogenerar el predeterminado
    if (items.length === 0) {
      items = await roadmapService.generate30DayRoadmap(niche || 'General');
    }

    return res.json({
      success: true,
      count: items.length,
      niche: niche || 'Todos',
      roadmap: items,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/roadmap/generate { niche: "..." }
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { niche } = req.body || {};
    const targetNiche = niche || 'General';
    const result = await roadmapService.generate30DayRoadmapWithMeta(targetNiche);

    return res.json({
      success: true,
      message: `Roadmap de 30 días generado exitosamente para "${targetNiche}"`,
      count: result.items.length,
      persistedToSupabase: result.persistedToSupabase,
      supabaseError: result.supabaseError,
      roadmap: result.items,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /api/roadmap/:id/status { status: "grabado", niche?: "...", dayNumber?: 1 }
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, niche, dayNumber } = req.body || {};

    const validStatuses = ['pendiente', 'grabado', 'editado', 'publicado'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Estado inválido. Debe ser uno de: ${validStatuses.join(', ')}`,
      });
    }

    const result = await roadmapService.updateItemStatusWithMeta(id, status, { niche, dayNumber });
    if (result.supabaseError) {
      return res.status(500).json({
        success: false,
        persistedToSupabase: false,
        supabaseError: result.supabaseError,
        error: `Supabase bloqueó la actualización: ${result.supabaseError}`,
      });
    }
    if (!result.updated) {
      return res.status(404).json({ success: false, error: 'Elemento no encontrado' });
    }

    return res.json({
      success: true,
      persistedToSupabase: result.persistedToSupabase,
      message: `Estado actualizado a "${status}"`,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
