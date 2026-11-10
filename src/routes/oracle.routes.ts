import { Router, Request, Response } from 'express';
import { OracleOrchestratorService } from '../services/oracle-orchestrator.service.js';

const router = Router();
const oracleService = new OracleOrchestratorService();

// POST /api/cron/orchestrate (o /api/oracle/run-now)
router.post('/orchestrate', async (req: Request, res: Response) => {
  try {
    const niche = req.body?.niche || 'Inteligencia Artificial y Productividad';
    const instagramAccount = req.body?.instagramAccount || '@creatorshub';

    const report = await oracleService.runAutonomousCycle(niche, instagramAccount);

    return res.json({
      success: report.status === 'completado',
      report,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/oracle/run-now
router.post('/run-now', async (req: Request, res: Response) => {
  try {
    const { niche, instagramAccount } = req.body;
    const targetNiche = niche || 'Inteligencia Artificial y Productividad';
    const targetAccount = instagramAccount || '@creatorshub';

    const report = await oracleService.runAutonomousCycle(targetNiche, targetAccount);

    return res.json({
      success: report.status === 'completado',
      report,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/oracle/status
router.get('/status', (_req: Request, res: Response) => {
  const last = oracleService.getLastExecution();
  return res.json({
    success: true,
    lastExecution: last || 'Aún no se ha ejecutado ningún ciclo. Puedes dispararlo con POST /api/oracle/run-now',
  });
});

export default router;
