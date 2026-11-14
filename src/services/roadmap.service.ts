import { supabase, isMock } from '../config/supabase.js';
import { YouTubeService, YouTubeVideoItem } from './youtube.service.js';
import { InstagramService } from './instagram.service.js';
import { GeminiService } from './gemini.service.js';

export interface RoadmapDayItem {
  id?: string;
  day_number: number;
  week_number: number;
  content_pillar: string;
  format: 'Reel' | 'Carrusel' | 'Story';
  title: string;
  hook: string;
  script: string;
  image_prompt: string;
  caption: string;
  hashtags?: string[];
  status: 'pendiente' | 'grabado' | 'editado' | 'publicado';
  niche: string;
  reference_video_id?: string;
}

// Memoria de respaldo
let localRoadmapDb: RoadmapDayItem[] = [];

export class RoadmapService {
  private youtubeService = new YouTubeService();
  private instagramService = new InstagramService();
  private geminiService = new GeminiService();

  async generate30DayRoadmap(niche: string = 'Inteligencia Artificial y Productividad'): Promise<RoadmapDayItem[]> {
    console.log(`🤖 [ContentAI] Iniciando análisis de tendencias frescas en YouTube para nicho: "${niche}"...`);

    // 1. Obtener tendencias frescas y métricas reales del nicho
    let videos: YouTubeVideoItem[] = [];
    try {
      videos = await this.youtubeService.searchFreshTrends(niche, 10, false);
    } catch {
      videos = [];
    }

    // 2. Generar roadmap usando Gemini (con reglas 2026 + multi-enfoque en tendencias fuertes) o respaldo inteligente
    const igAnalysis = await this.instagramService.analyzeAccount('@creatorshub', niche);
    const items = await this.geminiService.generateMonthlyRoadmapWithAI(niche, videos, igAnalysis);

    // Persistir en Supabase o memoria
    await this.saveRoadmap(items, niche);

    return items;
  }

  async getRoadmap(niche?: string): Promise<RoadmapDayItem[]> {
    if (!isMock && supabase) {
      try {
        let query = supabase.from('instagram_content_roadmap').select('*').order('day_number', { ascending: true });
        if (niche) query = query.eq('niche', niche);
        const { data, error } = await query;
        if (!error && data && data.length > 0) return data as RoadmapDayItem[];
      } catch (err: any) {
        console.warn('[RoadmapService] Error al consultar Supabase:', err.message);
      }
    }
    return niche ? localRoadmapDb.filter((r) => r.niche.toLowerCase() === niche.toLowerCase()) : localRoadmapDb;
  }

  async updateItemStatus(idOrDay: string | number, status: 'pendiente' | 'grabado' | 'editado' | 'publicado'): Promise<boolean> {
    const raw = String(idOrDay ?? '').trim();
    const isNumeric = /^\d+$/.test(raw);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

    if (!isMock && supabase && (isNumeric || isUuid)) {
      try {
        const filter = isNumeric ? { day_number: Number(raw) } : { id: raw };
        const { data, error } = await supabase
          .from('instagram_content_roadmap')
          .update({ status, updated_at: new Date().toISOString() })
          .match(filter)
          .select('id');
        if (!error && data && data.length > 0) return true;
      } catch (err: any) {
        console.warn('[RoadmapService] Error al actualizar estado en Supabase:', err.message);
      }
    }

    const idx = localRoadmapDb.findIndex(
      (i) => (i.id !== undefined && i.id === raw) || (isNumeric && i.day_number === Number(raw))
    );
    if (idx !== -1) {
      localRoadmapDb[idx].status = status;
      return true;
    }
    return false;
  }

  public async saveRoadmap(items: RoadmapDayItem[], niche: string) {
    if (!isMock && supabase) {
      try {
        // Limpiar roadmap anterior del mismo nicho si existe
        await supabase.from('instagram_content_roadmap').delete().eq('niche', niche);
        const { error } = await supabase.from('instagram_content_roadmap').insert(items);
        if (error) {
          console.warn('[RoadmapService] Advertencia al guardar en Supabase (usando memoria):', error.message);
          localRoadmapDb = items;
        } else {
          console.log(`✅ [RoadmapService] 30 días guardados exitosamente en Supabase (nicho: ${niche})`);
        }
      } catch (err: any) {
        console.warn('[RoadmapService] Excepción guardando en Supabase:', err.message);
        localRoadmapDb = items;
      }
    } else {
      localRoadmapDb = items;
    }
  }

}
