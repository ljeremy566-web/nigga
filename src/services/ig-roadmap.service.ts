import { supabase, isMock } from '../config/supabase.js';
import { InstagramService, CapturedInstagramReelItem } from './instagram.service.js';
import { GeminiService } from './gemini.service.js';

export interface IgRoadmapDayItem {
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
  source_query?: string;
  reference_reel_shortcode?: string;
  reference_reel_url?: string;
  reference_reel_author?: string;
}

// Memoria de respaldo independiente del roadmap de YouTube
let localIgRoadmapDb: IgRoadmapDayItem[] = [];

export class IgRoadmapService {
  private instagramService = new InstagramService();
  private geminiService = new GeminiService();

  async generate30DayIgRoadmap(
    niche = 'Cosmetología y Estética Facial',
    options: { sourceQuery?: string; shortcodes?: string[] } = {}
  ): Promise<{ items: IgRoadmapDayItem[]; reelsUsed: number }> {
    const cleanNiche = String(niche || 'Cosmetología y Estética Facial').trim();
    const cleanQuery = options.sourceQuery?.trim();

    let reels: CapturedInstagramReelItem[] = await this.instagramService.getCapturedReels(
      cleanQuery ? { query: cleanQuery } : undefined
    );

    if (options.shortcodes && options.shortcodes.length > 0) {
      const codeSet = new Set(options.shortcodes.map((s) => String(s).trim()).filter(Boolean));
      const filtered = reels.filter((r) => codeSet.has(r.shortcode));
      if (filtered.length > 0) reels = filtered;
    }

    // Si filtró por query y no hubo coincidencia exacta, usar todos los Reels capturados disponibles
    if (reels.length === 0 && cleanQuery) {
      reels = await this.instagramService.getCapturedReels();
    }

    const items = await this.geminiService.generateIgMonthlyRoadmapWithAI(cleanNiche, reels, cleanQuery);
    await this.saveIgRoadmap(items, cleanNiche);

    return { items, reelsUsed: reels.length };
  }

  async getIgRoadmap(niche?: string): Promise<IgRoadmapDayItem[]> {
    const cleanNiche = niche?.trim();
    if (!isMock && supabase) {
      try {
        let query = supabase
          .from('ig_content_roadmap')
          .select('*')
          .order('day_number', { ascending: true });
        if (cleanNiche) query = query.eq('niche', cleanNiche);
        const { data, error } = await query;
        if (!error && Array.isArray(data) && data.length > 0) {
          return data as IgRoadmapDayItem[];
        }
      } catch (err: any) {
        console.warn('[IgRoadmapService] Error consultando Supabase:', err.message);
      }
    }

    if (cleanNiche) {
      return localIgRoadmapDb.filter((r) => r.niche.toLowerCase() === cleanNiche.toLowerCase());
    }
    return localIgRoadmapDb;
  }

  async updateIgItemStatus(
    idOrDay: string | number,
    status: 'pendiente' | 'grabado' | 'editado' | 'publicado',
    niche?: string
  ): Promise<boolean> {
    const raw = String(idOrDay ?? '').trim();
    const isNumeric = /^\d+$/.test(raw);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw);

    if (!isMock && supabase && (isNumeric || isUuid)) {
      try {
        const filter: Record<string, any> = isNumeric ? { day_number: Number(raw) } : { id: raw };
        if (isNumeric && niche) filter.niche = niche;
        const { data, error } = await supabase
          .from('ig_content_roadmap')
          .update({ status, updated_at: new Date().toISOString() })
          .match(filter)
          .select('id');
        if (!error && data && data.length > 0) return true;
      } catch (err: any) {
        console.warn('[IgRoadmapService] Error actualizando estado en Supabase:', err.message);
      }
    }

    const idx = localIgRoadmapDb.findIndex((i) => {
      if (i.id !== undefined && i.id === raw) return true;
      if (isNumeric && i.day_number === Number(raw)) {
        return !niche || i.niche.toLowerCase() === niche.trim().toLowerCase();
      }
      return false;
    });
    if (idx !== -1) {
      localIgRoadmapDb[idx].status = status;
      return true;
    }
    return false;
  }

  async saveIgRoadmap(items: IgRoadmapDayItem[], niche: string): Promise<void> {
    if (!isMock && supabase) {
      try {
        await supabase.from('ig_content_roadmap').delete().eq('niche', niche);
        const { error } = await supabase.from('ig_content_roadmap').insert(items);
        if (!error) {
          console.log(`✅ [IgRoadmapService] ${items.length} días IG guardados en Supabase (nicho: ${niche}).`);
          return;
        }
        console.warn('[IgRoadmapService] Advertencia al guardar en Supabase (usando memoria):', error.message);
      } catch (err: any) {
        console.warn('[IgRoadmapService] Excepción guardando en Supabase:', err.message);
      }
    }

    const lower = niche.toLowerCase();
    localIgRoadmapDb = [
      ...localIgRoadmapDb.filter((r) => r.niche.toLowerCase() !== lower),
      ...items,
    ];
  }
}
