import { supabase, isMock } from '../config/supabase.js';
import { GeminiService } from './gemini.service.js';

export interface InstagramPostInsight {
  id: string;
  caption: string;
  format: 'Reel' | 'Carrusel' | 'Image';
  likesCount?: number;
  commentsCount?: number;
  keyThemes: string[];
  hook: string;
}

export interface InstagramProfileAnalysis {
  accountHandle: string;
  niche: string;
  topPosts: InstagramPostInsight[];
  detectedTone: string;
  winningHooks: string[];
  recommendedPillars: string[];
  analyzedAt: string;
}

export interface CapturedInstagramReelInput {
  shortcode?: string;
  reelUrl?: string;
  reel_url?: string;
  url?: string;
  authorHandle?: string;
  author_handle?: string;
  author?: string;
  sourceQuery?: string;
  source_query?: string;
  caption?: string;
  hashtags?: string[] | string;
  audioName?: string;
  audio_name?: string;
  audio?: string;
  viewCount?: number | string;
  view_count?: number | string;
  views?: number | string;
  likeCount?: number | string;
  like_count?: number | string;
  likes?: number | string;
  commentCount?: number | string;
  comment_count?: number | string;
  comments?: number | string;
  frameImageBase64?: string;
  thumbnailDataUrl?: string;
  thumbnail_data_url?: string;
  postedAt?: string;
  posted_at?: string;
}

export interface CapturedInstagramReelItem {
  id?: string;
  shortcode: string;
  reel_url: string;
  author_handle: string;
  source_query: string;
  caption: string;
  hashtags: string[];
  audio_name: string;
  view_count: number;
  like_count: number;
  comment_count: number;
  thumbnail_data_url?: string;
  visual_hook_text: string;
  visual_style: string;
  detected_angle: string;
  captured_via: string;
  posted_at?: string;
  created_at?: string;
}

const localIgReelsDb: CapturedInstagramReelItem[] = [];

function parseAbbreviatedCount(raw: number | string | undefined): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(0, Math.round(raw));
  }
  const str = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');
  if (!str) return 0;

  const suffixMatch = str.match(/^([0-9]+(?:[.,][0-9]+)?)([KMB])?$/);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1].replace(',', '.'));
    const mult =
      suffixMatch[2] === 'M'
        ? 1_000_000
        : suffixMatch[2] === 'B'
        ? 1_000_000_000
        : suffixMatch[2] === 'K'
        ? 1_000
        : 1;
    return Number.isFinite(num) ? Math.round(num * mult) : 0;
  }

  const digits = str.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) || 0 : 0;
}

function extractShortcode(input: CapturedInstagramReelInput, idx: number): string {
  const direct = String(input.shortcode || '').trim();
  if (direct && /^[A-Za-z0-9_-]{4,40}$/.test(direct)) return direct;

  const urlStr = String(input.reelUrl || input.reel_url || input.url || '').trim();
  const match = urlStr.match(/\/(?:reel|reels|p)\/([A-Za-z0-9_-]+)/i);
  if (match && match[1]) return match[1];

  return `ig_reel_${Date.now()}_${idx + 1}`;
}

function normalizeHandle(raw: string | undefined): string {
  const clean = String(raw || '')
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/\/.*$/, '')
    .replace(/^@/, '');
  return clean ? `@${clean}` : '@instagram_creator';
}

function extractHashtags(rawTags: string[] | string | undefined, caption: string): string[] {
  const set = new Set<string>();
  if (Array.isArray(rawTags)) {
    rawTags.forEach((t) => {
      const clean = String(t).trim();
      if (clean) set.add(clean.startsWith('#') ? clean : `#${clean}`);
    });
  } else if (typeof rawTags === 'string') {
    rawTags
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .forEach((t) => set.add(t.startsWith('#') ? t : `#${t}`));
  }
  const matches = caption.match(/#[\p{L}\p{N}_]+/gu) || [];
  matches.forEach((m) => set.add(m));
  return Array.from(set).slice(0, 15);
}

export class InstagramService {
  private geminiService = new GeminiService();

  /**
   * Analiza una cuenta de Instagram de referencia para el flujo del Oráculo base.
   * Si hay Reels reales capturados para esa cuenta, los prioriza; sino devuelve plantilla base.
   */
  async analyzeAccount(accountHandle: string, niche: string): Promise<InstagramProfileAnalysis> {
    const cleanHandle = accountHandle.replace(/^@/, '').trim();
    console.log(`📸 [InstagramService] Analizando cuenta de referencia: @${cleanHandle} (Nicho: ${niche})...`);

    const realReels = await this.getCapturedReels({ author: `@${cleanHandle}` });
    if (realReels.length > 0) {
      return {
        accountHandle: `@${cleanHandle}`,
        niche,
        detectedTone: realReels[0].visual_style || 'Estilo basado en Reels reales capturados',
        winningHooks: realReels.slice(0, 4).map((r) => r.visual_hook_text || r.caption.slice(0, 80)),
        recommendedPillars: Array.from(new Set(realReels.map((r) => r.detected_angle).filter(Boolean))).slice(0, 4),
        topPosts: realReels.slice(0, 4).map((r) => ({
          id: r.shortcode,
          caption: r.caption,
          format: 'Reel',
          likesCount: r.like_count,
          commentsCount: r.comment_count,
          keyThemes: r.hashtags.slice(0, 3),
          hook: r.visual_hook_text,
        })),
        analyzedAt: new Date().toISOString(),
      };
    }

    return {
      accountHandle: `@${cleanHandle}`,
      niche,
      detectedTone: 'Autoridad práctica, directo al punto, storytelling con ganchos disruptivos',
      winningHooks: [
        `"La mayoría en ${niche} comete este error todos los días y no se da cuenta..."`,
        `"Dejé de hacer esto en ${niche} y mis resultados se multiplicaron por 3."`,
        `"3 herramientas de ${niche} que parecen ilegales de lo buenas que son."`,
        `"Guárdate este carrusel si quieres ahorrar 15 horas de trabajo esta semana."`,
      ],
      recommendedPillars: [
        'Atracción Viral (Reels con ganchos 0-3s)',
        'Educación Técnica / Micro-hacks (Carruseles 6 slides)',
        'Storytelling & Vulnerabilidad (Historias de errores y aprendizajes)',
        'Llamada a la Acción & Conversión (Lead magnets y DMs directos)',
      ],
      topPosts: [
        {
          id: 'ig_ref_1',
          caption: `El secreto no es trabajar más horas en ${niche}, sino automatizar lo repetitivo. Guarda este post para después.`,
          format: 'Carrusel',
          likesCount: 1420,
          commentsCount: 98,
          keyThemes: ['Automatización', 'Productividad', 'Herramientas'],
          hook: 'El 90% pierde el tiempo en esto sin saberlo.',
        },
        {
          id: 'ig_ref_2',
          caption: `Tutorial paso a paso para crear tu sistema de trabajo en ${niche}. Comenta "PLANTILLA" para enviártelo.`,
          format: 'Reel',
          likesCount: 3850,
          commentsCount: 312,
          keyThemes: ['Tutorial', 'Framework', 'Paso a Paso'],
          hook: 'Deja de complicarte la vida con este proceso.',
        },
      ],
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Normaliza, analiza el primer frame con Gemini Vision y persiste un lote de Reels capturados.
   */
  async captureReelsBatch(
    inputs: CapturedInstagramReelInput[],
    sourceQuery = 'General',
    capturedVia = 'antigravity_browser'
  ): Promise<CapturedInstagramReelItem[]> {
    const cleanQuery = String(sourceQuery || 'General').trim() || 'General';
    const cleanVia = String(capturedVia || 'antigravity_browser').trim() || 'antigravity_browser';
    const processed: CapturedInstagramReelItem[] = [];

    for (let i = 0; i < inputs.length; i++) {
      const raw = inputs[i];
      if (!raw || typeof raw !== 'object') continue;

      const shortcode = extractShortcode(raw, i);
      const rawUrl = String(raw.reelUrl || raw.reel_url || raw.url || '').trim();
      const reelUrl =
        rawUrl && /^https?:\/\//i.test(rawUrl)
          ? rawUrl
          : `https://www.instagram.com/reel/${encodeURIComponent(shortcode)}/`;
      const authorHandle = normalizeHandle(raw.authorHandle || raw.author_handle || raw.author);
      const caption = String(raw.caption || '').trim();
      const hashtags = extractHashtags(raw.hashtags, caption);
      const audioName = String(raw.audioName || raw.audio_name || raw.audio || 'Audio original').trim();
      const viewCount = parseAbbreviatedCount(raw.viewCount ?? raw.view_count ?? raw.views);
      const likeCount = parseAbbreviatedCount(raw.likeCount ?? raw.like_count ?? raw.likes);
      const commentCount = parseAbbreviatedCount(raw.commentCount ?? raw.comment_count ?? raw.comments);
      const frameImage = String(
        raw.frameImageBase64 || raw.thumbnailDataUrl || raw.thumbnail_data_url || ''
      ).trim();

      const vision = await this.geminiService.analyzeReelFirstFrame({
        shortcode,
        caption,
        authorHandle,
        frameImageBase64: frameImage || undefined,
      });

      const item: CapturedInstagramReelItem = {
        shortcode,
        reel_url: reelUrl,
        author_handle: authorHandle,
        source_query: String(raw.sourceQuery || raw.source_query || cleanQuery).trim() || cleanQuery,
        caption,
        hashtags,
        audio_name: audioName,
        view_count: viewCount,
        like_count: likeCount,
        comment_count: commentCount,
        thumbnail_data_url: frameImage ? frameImage.slice(0, 450_000) : undefined,
        visual_hook_text: vision.visual_hook_text,
        visual_style: vision.visual_style,
        detected_angle: vision.detected_angle,
        captured_via: cleanVia,
        posted_at: raw.postedAt || raw.posted_at || new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      processed.push(item);
    }

    if (processed.length === 0) return [];

    if (!isMock && supabase) {
      try {
        const { data, error } = await supabase
          .from('ig_captured_reels')
          .upsert(processed, { onConflict: 'shortcode' })
          .select('*');
        if (!error && data && data.length > 0) {
          console.log(`✅ [InstagramService] ${data.length} Reels guardados en Supabase.`);
          return data as CapturedInstagramReelItem[];
        }
        if (error) {
          console.warn('[InstagramService] Error guardando Reels en Supabase (usando memoria):', error.message);
        }
      } catch (err: any) {
        console.warn('[InstagramService] Excepción guardando Reels en Supabase:', err.message);
      }
    }

    for (const item of processed) {
      const existingIdx = localIgReelsDb.findIndex((r) => r.shortcode === item.shortcode);
      if (existingIdx !== -1) {
        localIgReelsDb[existingIdx] = { ...localIgReelsDb[existingIdx], ...item };
      } else {
        localIgReelsDb.unshift(item);
      }
    }

    return processed;
  }

  async getCapturedReels(filters?: { query?: string; author?: string }): Promise<CapturedInstagramReelItem[]> {
    const queryFilter = filters?.query?.trim().toLowerCase();
    const authorFilter = filters?.author?.trim().toLowerCase();

    if (!isMock && supabase) {
      try {
        let req = supabase
          .from('ig_captured_reels')
          .select('*')
          .order('view_count', { ascending: false })
          .order('created_at', { ascending: false });

        if (queryFilter) {
          req = req.ilike('source_query', `%${queryFilter}%`);
        }
        if (authorFilter) {
          const clean = authorFilter.startsWith('@') ? authorFilter : `@${authorFilter}`;
          req = req.ilike('author_handle', `%${clean}%`);
        }

        const { data, error } = await req;
        if (!error && Array.isArray(data)) {
          return data as CapturedInstagramReelItem[];
        }
      } catch (err: any) {
        console.warn('[InstagramService] Error consultando Reels en Supabase:', err.message);
      }
    }

    return localIgReelsDb.filter((r) => {
      if (queryFilter && !r.source_query.toLowerCase().includes(queryFilter) && !r.caption.toLowerCase().includes(queryFilter)) {
        return false;
      }
      if (authorFilter) {
        const normalized = authorFilter.startsWith('@') ? authorFilter : `@${authorFilter}`;
        if (!r.author_handle.toLowerCase().includes(normalized)) return false;
      }
      return true;
    });
  }

  async deleteCapturedReel(shortcode: string): Promise<boolean> {
    const clean = String(shortcode || '').trim();
    if (!clean) return false;

    if (!isMock && supabase) {
      try {
        const { data, error } = await supabase
          .from('ig_captured_reels')
          .delete()
          .eq('shortcode', clean)
          .select('shortcode');
        if (!error && data && data.length > 0) return true;
      } catch (err: any) {
        console.warn('[InstagramService] Error eliminando Reel en Supabase:', err.message);
      }
    }

    const idx = localIgReelsDb.findIndex((r) => r.shortcode === clean);
    if (idx !== -1) {
      localIgReelsDb.splice(idx, 1);
      return true;
    }
    return false;
  }

  async getCaptureStats(): Promise<{ count: number; lastCapturedAt: string | null }> {
    const reels = await this.getCapturedReels();
    const latest = reels
      .map((r) => r.created_at || r.posted_at || '')
      .filter(Boolean)
      .sort()
      .pop();
    return {
      count: reels.length,
      lastCapturedAt: latest || null,
    };
  }
}

