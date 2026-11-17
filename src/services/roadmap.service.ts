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

const escapeLike = (val: string) => val.replace(/[\\%_]/g, '\\$&');

export class RoadmapService {
  private youtubeService = new YouTubeService();
  private instagramService = new InstagramService();
  private geminiService = new GeminiService();

  async generate30DayRoadmap(niche: string = 'General'): Promise<RoadmapDayItem[]> {
    const res = await this.generate30DayRoadmapWithMeta(niche);
    return res.items;
  }

  async generate30DayRoadmapWithMeta(
    niche: string = 'General'
  ): Promise<{ items: RoadmapDayItem[]; persistedToSupabase: boolean; supabaseError?: string }> {
    const cleanNiche = String(niche || 'General').trim() || 'General';
    console.log(`🤖 [ContentAI] Iniciando análisis de tendencias frescas en YouTube para nicho: "${cleanNiche}"...`);

    // 1. Obtener tendencias frescas y métricas reales del nicho
    let videos: YouTubeVideoItem[] = [];
    try {
      videos = await this.youtubeService.searchFreshTrends(cleanNiche, 10, false);
    } catch {
      videos = [];
    }

    // 2. Generar roadmap usando Gemini (con reglas 2026 + multi-enfoque en tendencias fuertes) o respaldo inteligente
    const igAnalysis = await this.instagramService.analyzeAccount('@creatorshub', cleanNiche);
    const items = await this.geminiService.generateMonthlyRoadmapWithAI(cleanNiche, videos, igAnalysis);

    // Persistir en Supabase o memoria
    const saveRes = await this.saveRoadmap(items, cleanNiche);

    return {
      items: saveRes.savedItems || items,
      persistedToSupabase: saveRes.persistedToSupabase,
      supabaseError: saveRes.supabaseError,
    };
  }

  private deduplicate30Days(rows: RoadmapDayItem[]): RoadmapDayItem[] {
    const byDay = new Map<number, RoadmapDayItem>();
    for (const row of rows) {
      const day = Number(row.day_number);
      if (!Number.isFinite(day) || day < 1 || day > 30) continue;
      if (!byDay.has(day)) {
        byDay.set(day, row);
      }
    }
    return Array.from(byDay.values()).sort((a, b) => a.day_number - b.day_number);
  }

  async getRoadmap(niche?: string): Promise<RoadmapDayItem[]> {
    const cleanNiche = niche?.trim();
    if (!isMock && supabase) {
      try {
        let targetNiche = cleanNiche;
        if (!targetNiche) {
          const { data: latestRow, error: latestError } = await supabase
            .from('instagram_content_roadmap')
            .select('niche, created_at')
            .order('created_at', { ascending: false })
            .limit(1);
          if (!latestError && latestRow && latestRow.length > 0 && latestRow[0].niche) {
            targetNiche = String(latestRow[0].niche).trim();
          } else if (latestError) {
            const { data: fallbackLatest } = await supabase
              .from('instagram_content_roadmap')
              .select('niche')
              .limit(1);
            if (fallbackLatest && fallbackLatest.length > 0 && fallbackLatest[0].niche) {
              targetNiche = String(fallbackLatest[0].niche).trim();
            }
          }
        }

        if (targetNiche) {
          const { data, error } = await supabase
            .from('instagram_content_roadmap')
            .select('*')
            .ilike('niche', escapeLike(targetNiche))
            .order('created_at', { ascending: false })
            .order('day_number', { ascending: true });
          if (!error && data && data.length > 0) {
            return this.deduplicate30Days(data as RoadmapDayItem[]);
          }
          if (error) {
            const { data: fallbackData, error: fallbackErr } = await supabase
              .from('instagram_content_roadmap')
              .select('*')
              .ilike('niche', escapeLike(targetNiche))
              .order('day_number', { ascending: true });
            if (!fallbackErr && fallbackData && fallbackData.length > 0) {
              return this.deduplicate30Days(fallbackData as RoadmapDayItem[]);
            }
          }
        }
      } catch (err: any) {
        console.warn('[RoadmapService] Error al consultar Supabase:', err.message);
      }
    }

    if (cleanNiche) {
      return this.deduplicate30Days(
        localRoadmapDb.filter((r) => r.niche.toLowerCase() === cleanNiche.toLowerCase())
      );
    }
    const latestLocalNiche = localRoadmapDb[0]?.niche;
    if (!latestLocalNiche) return [];
    return this.deduplicate30Days(
      localRoadmapDb.filter((r) => r.niche.toLowerCase() === latestLocalNiche.toLowerCase())
    );
  }

  async updateItemStatus(
    idOrDay: string | number,
    status: 'pendiente' | 'grabado' | 'editado' | 'publicado'
  ): Promise<boolean> {
    const res = await this.updateItemStatusWithMeta(idOrDay, status);
    return res.updated;
  }

  async updateItemStatusWithMeta(
    idOrDay: string | number,
    status: 'pendiente' | 'grabado' | 'editado' | 'publicado',
    options: { niche?: string; dayNumber?: number } = {}
  ): Promise<{ updated: boolean; persistedToSupabase: boolean; supabaseError?: string }> {
    const raw = String(idOrDay ?? '').trim();
    const isNumeric = /^\d+$/.test(raw);
    const cleanNiche = options.niche?.trim();

    if (!isMock && supabase && raw.length > 0) {
      try {
        const filter: Record<string, any> = isNumeric
          ? { day_number: Number(raw), ...(cleanNiche ? { niche: cleanNiche } : {}) }
          : { id: raw };

        let { data, error } = await supabase
          .from('instagram_content_roadmap')
          .update({ status, updated_at: new Date().toISOString() })
          .match(filter)
          .select('id');

        if (error && /updated_at/i.test(error.message)) {
          const retry = await supabase
            .from('instagram_content_roadmap')
            .update({ status })
            .match(filter)
            .select('id');
          data = retry.data;
          error = retry.error;
        }

        if (!error && (!data || data.length === 0) && !isNumeric && options.dayNumber && cleanNiche) {
          const fallbackMatch = await supabase
            .from('instagram_content_roadmap')
            .update({ status })
            .match({ day_number: Number(options.dayNumber), niche: cleanNiche })
            .select('id');
          data = fallbackMatch.data;
          error = fallbackMatch.error;
        }

        if (!error && data && data.length > 0) {
          const idx = localRoadmapDb.findIndex(
            (i) => (i.id !== undefined && i.id === raw) || (isNumeric && i.day_number === Number(raw))
          );
          if (idx !== -1) localRoadmapDb[idx].status = status;
          return { updated: true, persistedToSupabase: true };
        }

        if (error) {
          console.warn('[RoadmapService] Error al actualizar estado en Supabase:', error.message);
          return { updated: false, persistedToSupabase: false, supabaseError: error.message };
        }
      } catch (err: any) {
        console.warn('[RoadmapService] Excepción al actualizar estado en Supabase:', err.message);
        return { updated: false, persistedToSupabase: false, supabaseError: err.message };
      }
    }

    const idx = localRoadmapDb.findIndex((i) => {
      if (i.id !== undefined && i.id === raw) return true;
      const targetDay = isNumeric ? Number(raw) : Number(options.dayNumber);
      if (Number.isFinite(targetDay) && i.day_number === targetDay) {
        return !cleanNiche || i.niche.toLowerCase() === cleanNiche.toLowerCase();
      }
      return false;
    });
    if (idx !== -1) {
      localRoadmapDb[idx].status = status;
      return { updated: true, persistedToSupabase: false };
    }
    return { updated: false, persistedToSupabase: false };
  }

  public async saveRoadmap(
    items: RoadmapDayItem[],
    niche: string
  ): Promise<{ persistedToSupabase: boolean; supabaseError?: string; savedItems?: RoadmapDayItem[] }> {
    const cleanNiche = String(niche || 'General').trim() || 'General';
    const normalizedItems: RoadmapDayItem[] = items.map((item, idx) => ({
      day_number: Number(item.day_number) || idx + 1,
      week_number: Number(item.week_number) || Math.min(Math.ceil((idx + 1) / 7), 4),
      content_pillar: item.content_pillar || 'Atracción',
      format: item.format || 'Reel',
      title: item.title || `Día ${idx + 1}`,
      hook: item.hook || '',
      script: item.script || '',
      image_prompt: item.image_prompt || '',
      caption: item.caption || '',
      hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
      status: item.status || 'pendiente',
      niche: cleanNiche,
      ...(item.reference_video_id ? { reference_video_id: item.reference_video_id } : {}),
    }));

    const lower = cleanNiche.toLowerCase();
    localRoadmapDb = [
      ...normalizedItems,
      ...localRoadmapDb.filter((r) => r.niche.toLowerCase() !== lower),
    ];

    if (!isMock && supabase) {
      try {
        const { error: deleteError } = await supabase
          .from('instagram_content_roadmap')
          .delete()
          .ilike('niche', escapeLike(cleanNiche));

        if (deleteError) {
          console.warn('[RoadmapService] Error al limpiar nicho previo en Supabase:', deleteError.message);
          return { persistedToSupabase: false, supabaseError: deleteError.message };
        }

        const { data, error } = await supabase
          .from('instagram_content_roadmap')
          .insert(normalizedItems)
          .select('*');

        if (!error) {
          const savedRows = Array.isArray(data) && data.length > 0 ? (data as RoadmapDayItem[]) : normalizedItems;
          localRoadmapDb = [
            ...savedRows,
            ...localRoadmapDb.filter((r) => r.niche.toLowerCase() !== lower),
          ];
          console.log(`✅ [RoadmapService] ${savedRows.length} días guardados exitosamente en Supabase (nicho: ${cleanNiche})`);
          return { persistedToSupabase: true, savedItems: savedRows };
        }

        console.warn('[RoadmapService] Advertencia al guardar en Supabase (usando memoria):', error.message);
        return { persistedToSupabase: false, supabaseError: error.message };
      } catch (err: any) {
        console.warn('[RoadmapService] Excepción guardando en Supabase:', err.message);
        return { persistedToSupabase: false, supabaseError: err.message };
      }
    }

    return { persistedToSupabase: false };
  }

}
