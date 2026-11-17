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

const escapeLike = (val: string) => val.replace(/[\\%_]/g, '\\$&');

export class IgRoadmapService {
  private instagramService = new InstagramService();
  private geminiService = new GeminiService();

  async generate30DayIgRoadmap(
    niche = 'Cosmetología y Estética Facial',
    options: { sourceQuery?: string; shortcodes?: string[] } = {}
  ): Promise<{ items: IgRoadmapDayItem[]; reelsUsed: number; persistedToSupabase: boolean; supabaseError?: string }> {
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
    const saveRes = await this.saveIgRoadmap(items, cleanNiche);

    return {
      items: saveRes.savedItems || items,
      reelsUsed: reels.length,
      persistedToSupabase: saveRes.persistedToSupabase,
      supabaseError: saveRes.supabaseError,
    };
  }

  private deduplicate30Days(rows: IgRoadmapDayItem[]): IgRoadmapDayItem[] {
    const byDay = new Map<number, IgRoadmapDayItem>();
    for (const row of rows) {
      const day = Number(row.day_number);
      if (!Number.isFinite(day) || day < 1 || day > 30) continue;
      if (!byDay.has(day)) {
        byDay.set(day, row);
      }
    }
    return Array.from(byDay.values()).sort((a, b) => a.day_number - b.day_number);
  }

  async getIgRoadmap(niche?: string): Promise<IgRoadmapDayItem[]> {
    const cleanNiche = niche?.trim();
    if (!isMock && supabase) {
      try {
        let targetNiche = cleanNiche;
        if (!targetNiche) {
          const { data: latestRow, error: latestError } = await supabase
            .from('ig_content_roadmap')
            .select('niche, created_at')
            .order('created_at', { ascending: false })
            .limit(1);
          if (!latestError && latestRow && latestRow.length > 0 && latestRow[0].niche) {
            targetNiche = String(latestRow[0].niche).trim();
          } else if (latestError) {
            const { data: fallbackLatest } = await supabase
              .from('ig_content_roadmap')
              .select('niche')
              .limit(1);
            if (fallbackLatest && fallbackLatest.length > 0 && fallbackLatest[0].niche) {
              targetNiche = String(fallbackLatest[0].niche).trim();
            }
          }
        }

        if (targetNiche) {
          const { data, error } = await supabase
            .from('ig_content_roadmap')
            .select('*')
            .ilike('niche', escapeLike(targetNiche))
            .order('created_at', { ascending: false })
            .order('day_number', { ascending: true });
          if (!error && Array.isArray(data) && data.length > 0) {
            return this.deduplicate30Days(data as IgRoadmapDayItem[]);
          }
          if (error) {
            const { data: fallbackData, error: fallbackErr } = await supabase
              .from('ig_content_roadmap')
              .select('*')
              .ilike('niche', escapeLike(targetNiche))
              .order('day_number', { ascending: true });
            if (!fallbackErr && Array.isArray(fallbackData) && fallbackData.length > 0) {
              return this.deduplicate30Days(fallbackData as IgRoadmapDayItem[]);
            }
          }
        }
      } catch (err: any) {
        console.warn('[IgRoadmapService] Error consultando Supabase:', err.message);
      }
    }

    if (cleanNiche) {
      return this.deduplicate30Days(
        localIgRoadmapDb.filter((r) => r.niche.toLowerCase() === cleanNiche.toLowerCase())
      );
    }
    const latestLocalNiche = localIgRoadmapDb[0]?.niche;
    if (!latestLocalNiche) return [];
    return this.deduplicate30Days(
      localIgRoadmapDb.filter((r) => r.niche.toLowerCase() === latestLocalNiche.toLowerCase())
    );
  }

  async updateIgItemStatus(
    idOrDay: string | number,
    status: 'pendiente' | 'grabado' | 'editado' | 'publicado',
    niche?: string
  ): Promise<boolean> {
    const res = await this.updateIgItemStatusWithMeta(idOrDay, status, { niche });
    return res.updated;
  }

  async updateIgItemStatusWithMeta(
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
          .from('ig_content_roadmap')
          .update({ status, updated_at: new Date().toISOString() })
          .match(filter)
          .select('id');

        if (error && /updated_at/i.test(error.message)) {
          const retry = await supabase
            .from('ig_content_roadmap')
            .update({ status })
            .match(filter)
            .select('id');
          data = retry.data;
          error = retry.error;
        }

        if (!error && (!data || data.length === 0) && !isNumeric && options.dayNumber && cleanNiche) {
          const fallbackMatch = await supabase
            .from('ig_content_roadmap')
            .update({ status })
            .match({ day_number: Number(options.dayNumber), niche: cleanNiche })
            .select('id');
          data = fallbackMatch.data;
          error = fallbackMatch.error;
        }

        if (!error && data && data.length > 0) {
          const idx = localIgRoadmapDb.findIndex(
            (i) => (i.id !== undefined && i.id === raw) || (isNumeric && i.day_number === Number(raw))
          );
          if (idx !== -1) localIgRoadmapDb[idx].status = status;
          return { updated: true, persistedToSupabase: true };
        }

        if (error) {
          console.warn('[IgRoadmapService] Error actualizando estado en Supabase:', error.message);
          return { updated: false, persistedToSupabase: false, supabaseError: error.message };
        }
      } catch (err: any) {
        console.warn('[IgRoadmapService] Excepción actualizando estado en Supabase:', err.message);
        return { updated: false, persistedToSupabase: false, supabaseError: err.message };
      }
    }

    const idx = localIgRoadmapDb.findIndex((i) => {
      if (i.id !== undefined && i.id === raw) return true;
      const targetDay = isNumeric ? Number(raw) : Number(options.dayNumber);
      if (Number.isFinite(targetDay) && i.day_number === targetDay) {
        return !cleanNiche || i.niche.toLowerCase() === cleanNiche.toLowerCase();
      }
      return false;
    });
    if (idx !== -1) {
      localIgRoadmapDb[idx].status = status;
      return { updated: true, persistedToSupabase: false };
    }
    return { updated: false, persistedToSupabase: false };
  }

  async saveIgRoadmap(
    items: IgRoadmapDayItem[],
    niche: string
  ): Promise<{ persistedToSupabase: boolean; supabaseError?: string; savedItems?: IgRoadmapDayItem[] }> {
    const cleanNiche = String(niche || 'Cosmetología y Estética Facial').trim();
    const normalizedItems: IgRoadmapDayItem[] = items.map((item, idx) => ({
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
      ...(item.source_query ? { source_query: item.source_query } : {}),
      ...(item.reference_reel_shortcode ? { reference_reel_shortcode: item.reference_reel_shortcode } : {}),
      ...(item.reference_reel_url ? { reference_reel_url: item.reference_reel_url } : {}),
      ...(item.reference_reel_author ? { reference_reel_author: item.reference_reel_author } : {}),
    }));

    const lower = cleanNiche.toLowerCase();
    localIgRoadmapDb = [
      ...normalizedItems,
      ...localIgRoadmapDb.filter((r) => r.niche.toLowerCase() !== lower),
    ];

    if (!isMock && supabase) {
      try {
        const { error: deleteError } = await supabase
          .from('ig_content_roadmap')
          .delete()
          .ilike('niche', escapeLike(cleanNiche));

        if (deleteError) {
          console.warn('[IgRoadmapService] Error al limpiar nicho IG previo en Supabase:', deleteError.message);
          return { persistedToSupabase: false, supabaseError: deleteError.message };
        }

        const { data, error } = await supabase
          .from('ig_content_roadmap')
          .insert(normalizedItems)
          .select('*');

        if (!error) {
          const savedRows = Array.isArray(data) && data.length > 0 ? (data as IgRoadmapDayItem[]) : normalizedItems;
          localIgRoadmapDb = [
            ...savedRows,
            ...localIgRoadmapDb.filter((r) => r.niche.toLowerCase() !== lower),
          ];
          console.log(`✅ [IgRoadmapService] ${savedRows.length} días IG guardados en Supabase (nicho: ${cleanNiche}).`);
          return { persistedToSupabase: true, savedItems: savedRows };
        }

        console.warn('[IgRoadmapService] Advertencia al guardar en Supabase (usando memoria):', error.message);
        return { persistedToSupabase: false, supabaseError: error.message };
      } catch (err: any) {
        console.warn('[IgRoadmapService] Excepción guardando en Supabase:', err.message);
        return { persistedToSupabase: false, supabaseError: err.message };
      }
    }

    return { persistedToSupabase: false };
  }
}
