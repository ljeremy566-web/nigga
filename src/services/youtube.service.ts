import { google } from 'googleapis';
import { config } from '../config/env.js';
import { supabase, isMock } from '../config/supabase.js';

export interface YouTubeVideoItem {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  channelId?: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  tags?: string[];
  viewsPerHour?: number;
  trendScore?: number;
  isStrongTrend?: boolean;
  trendReason?: string;
}

export interface YouTubeSearchOptions {
  freshDays?: number;
  order?: 'relevance' | 'viewCount' | 'date' | 'rating';
}

// Memoria local de fallback y rotador de ángulos de búsqueda para evitar resultados repetitivos
const localVideosDb: any[] = [];
const localHistoryDb: any[] = [];
let trendRotationCounter = 0;

const TREND_QUERY_ANGLES = [
  '',
  'tendencias novedades',
  'herramientas trucos',
  'errores comunes guia',
  'estrategia paso a paso',
  'noticias analisis',
];

export class YouTubeService {
  private youtube = google.youtube({
    version: 'v3',
    auth: config.youtubeApiKey || undefined,
  });

  /**
   * Búsqueda en YouTube enriquecida con filtro de frescura (publishedAfter) y métricas reales (videos.list).
   */
  async searchVideos(
    query: string,
    maxResults = 5,
    saveToDb = true,
    options: YouTubeSearchOptions = {}
  ): Promise<YouTubeVideoItem[]> {
    let videos: YouTubeVideoItem[] = [];
    const safeMax = Math.min(Math.max(Number(maxResults) || 5, 1), 25);

    if (config.youtubeApiKey) {
      try {
        const freshDays = options.freshDays ?? 30;
        const publishedAfter =
          freshDays > 0
            ? new Date(Date.now() - freshDays * 24 * 60 * 60 * 1000).toISOString()
            : undefined;

        const searchParams: any = {
          part: ['snippet'],
          q: query,
          maxResults: safeMax,
          type: ['video'],
          order: options.order || 'relevance',
        };
        if (publishedAfter) {
          searchParams.publishedAfter = publishedAfter;
        }

        let response = await this.youtube.search.list(searchParams);
        let items = response.data.items || [];

        // Si el rango reciente devolvió muy pocos resultados, ampliamos automáticamente a 90 días
        if (items.length < Math.min(3, safeMax) && freshDays > 0 && freshDays < 90) {
          const widerDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
          response = await this.youtube.search.list({
            ...searchParams,
            publishedAfter: widerDate,
          });
          items = response.data.items || [];
        }

        const baseVideos: YouTubeVideoItem[] = items
          .filter((item) => item.id?.videoId)
          .map((item) => ({
            videoId: item.id?.videoId || '',
            title: item.snippet?.title || '',
            description: item.snippet?.description || '',
            channelTitle: item.snippet?.channelTitle || '',
            channelId: item.snippet?.channelId || '',
            publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
            thumbnailUrl:
              item.snippet?.thumbnails?.high?.url ||
              item.snippet?.thumbnails?.default?.url ||
              '',
          }));

        videos = await this.enrichWithVideoStatistics(baseVideos);
        videos = this.scoreAndMarkStrongTrends(videos);
      } catch (err: any) {
        console.warn(`[YouTube API Error]: ${err.message}. Usando generador inteligente simulado.`);
        videos = this.scoreAndMarkStrongTrends(this.getMockVideos(query, safeMax));
      }
    } else {
      videos = this.scoreAndMarkStrongTrends(this.getMockVideos(query, safeMax));
    }

    if (saveToDb && videos.length > 0) {
      await this.saveVideos(videos, query);
    }

    return videos;
  }

  /**
   * Rastreo fresco y diversificado de tendencias para el Oráculo / Roadmap.
   * Combina los videos recientes más vistos (últimos 14 días) con un ángulo rotativo del nicho
   * para evitar devolver siempre exactamente los mismos resultados.
   */
  async searchFreshTrends(
    niche: string,
    maxResults = 10,
    saveToDb = true
  ): Promise<YouTubeVideoItem[]> {
    const cleanNiche = (niche || 'General').trim();
    const angleIndex = trendRotationCounter % TREND_QUERY_ANGLES.length;
    trendRotationCounter += 1;

    const currentYear = new Date().getUTCFullYear();
    const angleSuffix = TREND_QUERY_ANGLES[angleIndex];
    const rotatedQuery = angleSuffix
      ? `${cleanNiche} ${angleSuffix} ${currentYear}`
      : `${cleanNiche} ${currentYear}`;

    const half = Math.max(4, Math.ceil(maxResults / 2));

    const [topRecentByViews, freshRotated] = await Promise.all([
      this.searchVideos(cleanNiche, half, false, { freshDays: 14, order: 'viewCount' }),
      this.searchVideos(rotatedQuery, half, false, { freshDays: 21, order: 'relevance' }),
    ]);

    // Deduplicar por videoId preservando el orden por fuerza de tendencia
    const byId = new Map<string, YouTubeVideoItem>();
    for (const v of [...topRecentByViews, ...freshRotated]) {
      if (!v.videoId) continue;
      if (!byId.has(v.videoId)) {
        byId.set(v.videoId, v);
      }
    }

    let merged = Array.from(byId.values());
    merged = this.scoreAndMarkStrongTrends(merged)
      .sort((a, b) => (b.trendScore || 0) - (a.trendScore || 0))
      .slice(0, maxResults);

    if (saveToDb && merged.length > 0) {
      await this.saveVideos(merged, cleanNiche);
    }

    return merged;
  }

  /**
   * Segunda llamada a youtube.videos.list para obtener vistas, likes, comentarios y tags reales.
   */
  private async enrichWithVideoStatistics(
    videos: YouTubeVideoItem[]
  ): Promise<YouTubeVideoItem[]> {
    if (!config.youtubeApiKey || videos.length === 0) return videos;

    try {
      const ids = videos.map((v) => v.videoId).filter(Boolean);
      if (ids.length === 0) return videos;

      const statsResp = await this.youtube.videos.list({
        part: ['statistics', 'snippet'],
        id: ids,
      });

      const statsMap = new Map<string, any>();
      for (const item of statsResp.data.items || []) {
        if (item.id) statsMap.set(item.id, item);
      }

      return videos.map((v) => {
        const detail = statsMap.get(v.videoId);
        if (!detail) return v;

        const viewCount = Number(detail.statistics?.viewCount || 0);
        const likeCount = Number(detail.statistics?.likeCount || 0);
        const commentCount = Number(detail.statistics?.commentCount || 0);
        const tags = Array.isArray(detail.snippet?.tags) ? detail.snippet.tags.slice(0, 12) : [];

        return {
          ...v,
          description: detail.snippet?.description || v.description,
          channelId: detail.snippet?.channelId || v.channelId,
          viewCount,
          likeCount,
          commentCount,
          tags,
        };
      });
    } catch (err: any) {
      console.warn(`[YouTube Statistics Warning]: ${err.message}`);
      return videos;
    }
  }

  /**
   * Calcula velocidad de crecimiento (vistas/hora), engagement y marca tendencias fuertes.
   */
  private scoreAndMarkStrongTrends(videos: YouTubeVideoItem[]): YouTubeVideoItem[] {
    if (videos.length === 0) return videos;

    const now = Date.now();
    const scored = videos.map((v) => {
      const publishedMs = new Date(v.publishedAt).getTime();
      const hoursSincePublish = Number.isNaN(publishedMs)
        ? 168
        : Math.max(1, (now - publishedMs) / (1000 * 60 * 60));

      const views = Number(v.viewCount || 0);
      const likes = Number(v.likeCount || 0);
      const comments = Number(v.commentCount || 0);

      const viewsPerHour = Math.round((views / hoursSincePublish) * 10) / 10;
      const engagementBonus = likes * 12 + comments * 30;
      const trendScore = Math.round(viewsPerHour * 10 + views * 0.05 + engagementBonus * 0.02);

      return {
        ...v,
        viewsPerHour,
        trendScore,
      };
    });

    const sortedScores = scored.map((v) => v.trendScore || 0).sort((a, b) => a - b);
    const medianScore = sortedScores[Math.floor(sortedScores.length / 2)] || 0;
    const sortedViews = scored.map((v) => v.viewCount || 0).sort((a, b) => a - b);
    const medianViews = sortedViews[Math.floor(sortedViews.length / 2)] || 0;

    return scored.map((v, idx) => {
      const views = v.viewCount || 0;
      const score = v.trendScore || 0;
      const isOutlierByScore = medianScore > 0 && score >= medianScore * 1.45;
      const isOutlierByViews = medianViews > 0 && views >= medianViews * 1.6;
      const isHighAbsolute = views >= 50000 || (v.viewsPerHour || 0) >= 350;
      const isStrongTrend = isOutlierByScore || isOutlierByViews || isHighAbsolute || (idx === 0 && scored.length > 1 && score > 0);

      let trendReason = 'Tendencia estándar reciente';
      if (isStrongTrend) {
        if (isHighAbsolute) {
          trendReason = `Alta tracción (${views.toLocaleString('es-ES')} vistas · ${v.viewsPerHour} vistas/h)`;
        } else {
          trendReason = `Pico sobre la mediana del nicho (${v.viewsPerHour} vistas/h)`;
        }
      }

      return {
        ...v,
        isStrongTrend,
        trendReason,
      };
    });
  }

  async saveVideos(videos: YouTubeVideoItem[], query: string) {
    if (!isMock && supabase) {
      try {
        // Registrar historial
        await supabase.from('youtube_search_history').insert({
          query,
          results_count: videos.length,
        });

        // Asegurar canales en youtube_channels si existe FK youtube_videos_channel_id_fkey
        const uniqueChannels = Array.from(
          new Map(
            videos
              .filter((v) => v.channelId)
              .map((v) => [v.channelId!, { id: v.channelId!, title: v.channelTitle || 'YouTube Channel' }])
          ).values()
        );
        let includeChannelId = uniqueChannels.length > 0;
        if (includeChannelId) {
          const { error: chErr } = await supabase
            .from('youtube_channels')
            .upsert(uniqueChannels, { onConflict: 'id' });
          if (chErr) {
            includeChannelId = false;
          }
        }

        // Registrar o actualizar videos con sus métricas reales
        const rows = videos.map((v) => ({
          video_id: v.videoId,
          title: v.title,
          description: v.description,
          channel_title: v.channelTitle,
          ...(includeChannelId ? { channel_id: v.channelId || null } : {}),
          published_at: v.publishedAt,
          thumbnail_url: v.thumbnailUrl,
          view_count: v.viewCount || 0,
          like_count: v.likeCount || 0,
          comment_count: v.commentCount || 0,
          tags: v.tags && v.tags.length > 0 ? v.tags : null,
          search_query: query,
        }));

        const { error } = await supabase
          .from('youtube_videos')
          .upsert(rows, { onConflict: 'video_id' });
        if (error) {
          console.warn('[YouTubeService] Error al guardar en Supabase (usando memoria):', error.message);
          localVideosDb.push(...videos);
        }
      } catch (err: any) {
        console.warn('[YouTubeService] Excepción con Supabase:', err.message);
        localVideosDb.push(...videos);
      }
    } else {
      localVideosDb.push(...videos);
      localHistoryDb.push({ query, results_count: videos.length, created_at: new Date().toISOString() });
    }
  }

  async getStoredVideos(): Promise<any[]> {
    if (!isMock && supabase) {
      const { data, error } = await supabase
        .from('youtube_videos')
        .select('*')
        .order('view_count', { ascending: false })
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return localVideosDb;
  }

  async getSearchHistory(): Promise<any[]> {
    if (!isMock && supabase) {
      const { data, error } = await supabase
        .from('youtube_search_history')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return localHistoryDb;
  }

  private getMockVideos(query: string, maxResults: number): YouTubeVideoItem[] {
    const now = Date.now();
    const list: YouTubeVideoItem[] = [
      {
        videoId: 'demo_yt_01',
        title: `Cómo dominar ${query} en 2026: Guía Definitiva y Estrategias`,
        description: `Los mejores consejos y técnicas prácticas para dominar ${query} sin perder tiempo.`,
        channelTitle: 'Tech & Growth Academy',
        publishedAt: new Date(now - 36 * 3600 * 1000).toISOString(),
        thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
        viewCount: 84500,
        likeCount: 4120,
        commentCount: 310,
      },
      {
        videoId: 'demo_yt_02',
        title: `El error más común al empezar con ${query} (y cómo evitarlo)`,
        description: `Explicación clara de los tropiezos que frenan al 90% de personas en ${query}.`,
        channelTitle: 'Creadores Pro',
        publishedAt: new Date(now - 72 * 3600 * 1000).toISOString(),
        thumbnailUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=60',
        viewCount: 23400,
        likeCount: 980,
        commentCount: 74,
      },
      {
        videoId: 'demo_yt_03',
        title: `5 herramientas secretas para automatizar tu flujo en ${query}`,
        description: `Revisión detallada de software, extensiones y flujos inteligentes.`,
        channelTitle: 'Automatización Inteligente',
        publishedAt: new Date(now - 110 * 3600 * 1000).toISOString(),
        thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=60',
        viewCount: 15200,
        likeCount: 640,
        commentCount: 49,
      },
    ];
    return list.slice(0, maxResults);
  }
}
