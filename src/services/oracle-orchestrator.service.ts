import cron from 'node-cron';
import { YouTubeService, YouTubeVideoItem } from './youtube.service.js';
import { InstagramService, InstagramProfileAnalysis } from './instagram.service.js';
import { GeminiService } from './gemini.service.js';
import { RoadmapService, RoadmapDayItem } from './roadmap.service.js';
import { supabase, isMock } from '../config/supabase.js';

export interface OracleExecutionReport {
  id: string;
  triggeredAt: string;
  niche: string;
  instagramAccount: string;
  youtubeVideosFound: number;
  roadmapDaysGenerated: number;
  status: 'completado' | 'error' | 'en_proceso';
  details?: string;
}

let lastExecution: OracleExecutionReport | null = null;

export class OracleOrchestratorService {
  private youtubeService = new YouTubeService();
  private instagramService = new InstagramService();
  private geminiService = new GeminiService();
  private roadmapService = new RoadmapService();

  constructor() {
    this.initCronSchedule();
  }

  /**
   * Programa la ejecución autónoma mensual (Día 1 de cada mes a las 00:00 UTC)
   */
  private initCronSchedule() {
    // Cron: 0 0 1 * * (El 1 de cada mes a las 00:00)
    cron.schedule('0 0 1 * *', async () => {
      console.log('⏰ [Oracle Cron] Disparo automático mensual iniciado...');
      await this.runAutonomousCycle('Inteligencia Artificial y Productividad', '@creatorshub');
    });
    console.log('📅 [Oracle Cron] Tarea mensual programada (Día 1 de cada mes).');
  }

  /**
   * Ejecuta el ciclo completo de investigación y generación de contenidos
   */
  async runAutonomousCycle(
    niche = 'Inteligencia Artificial y Productividad',
    instagramAccount = '@creatorshub'
  ): Promise<OracleExecutionReport> {
    const execId = `oracle_${Date.now()}`;
    console.log(`\n======================================================`);
    console.log(`🔮 [Oracle Autonomous Engine] Iniciando ciclo para: "${niche}" y cuenta "${instagramAccount}"...`);
    console.log(`======================================================`);

    const report: OracleExecutionReport = {
      id: execId,
      triggeredAt: new Date().toISOString(),
      niche,
      instagramAccount,
      youtubeVideosFound: 0,
      roadmapDaysGenerated: 0,
      status: 'en_proceso',
    };

    try {
      // 1. Paso YouTube: Buscar tendencias y videos virales
      console.log(`📡 [Paso 1/4] Buscando tendencias y videos virales en YouTube...`);
      const ytVideos: YouTubeVideoItem[] = await this.youtubeService.searchVideos(niche, 6, true);
      report.youtubeVideosFound = ytVideos.length;

      // 2. Paso Instagram: Extraer ideas, ganchos y formatos de la cuenta de referencia
      console.log(`📸 [Paso 2/4] Analizando perfil de Instagram de referencia: ${instagramAccount}...`);
      const igAnalysis: InstagramProfileAnalysis = await this.instagramService.analyzeAccount(instagramAccount, niche);

      // 3. Paso IA: Generar el Roadmap de 30 Días con Gemini
      console.log(`🤖 [Paso 3/4] Enviando inteligencia de mercado a Gemini AI...`);
      const roadmapItems: RoadmapDayItem[] = await this.geminiService.generateMonthlyRoadmapWithAI(niche, ytVideos, igAnalysis);
      report.roadmapDaysGenerated = roadmapItems.length;

      // 4. Paso Supabase / Memoria: Guardar los 30 días en la base de datos
      console.log(`🗄️  [Paso 4/4] Sincronizando con base de datos Supabase...`);
      await this.roadmapService.saveRoadmap(roadmapItems, niche);

      report.status = 'completado';
      report.details = `Se generaron exitosamente 30 contenidos para "${niche}" analizando ${ytVideos.length} videos de YouTube y el perfil ${instagramAccount}.`;
      console.log(`🎯 [Oracle Autonomous Engine] ¡Ciclo completado con éxito!`);
    } catch (err: any) {
      report.status = 'error';
      report.details = err.message;
      console.error(`❌ [Oracle Autonomous Engine Error]:`, err);
    }

    lastExecution = report;
    return report;
  }

  getLastExecution(): OracleExecutionReport | null {
    return lastExecution;
  }
}
