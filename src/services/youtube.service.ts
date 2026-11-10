import { google } from 'googleapis';
import { config } from '../config/env.js';
import { supabase, isMock } from '../config/supabase.js';

export interface YouTubeVideoItem {
  videoId: string;
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  viewCount?: number;
  likeCount?: number;
}

// Memoria local de fallback
const localVideosDb: any[] = [];
const localHistoryDb: any[] = [];

export class YouTubeService {
  private youtube = google.youtube({
    version: 'v3',
    auth: config.youtubeApiKey || undefined,
  });

  async searchVideos(query: string, maxResults = 5, saveToDb = true): Promise<YouTubeVideoItem[]> {
    let videos: YouTubeVideoItem[] = [];

    if (config.youtubeApiKey) {
      try {
        const response = await this.youtube.search.list({
          part: ['snippet'],
          q: query,
          maxResults,
          type: ['video'],
        });

        const items = response.data.items || [];
        videos = items.map((item) => ({
          videoId: item.id?.videoId || '',
          title: item.snippet?.title || '',
          description: item.snippet?.description || '',
          channelTitle: item.snippet?.channelTitle || '',
          publishedAt: item.snippet?.publishedAt || new Date().toISOString(),
          thumbnailUrl: item.snippet?.thumbnails?.high?.url || item.snippet?.thumbnails?.default?.url || '',
        }));
      } catch (err: any) {
        console.warn(`[YouTube API Error]: ${err.message}. Usando generador inteligente simulado.`);
        videos = this.getMockVideos(query, maxResults);
      }
    } else {
      videos = this.getMockVideos(query, maxResults);
    }

    if (saveToDb && videos.length > 0) {
      await this.saveVideos(videos, query);
    }

    return videos;
  }

  async saveVideos(videos: YouTubeVideoItem[], query: string) {
    if (!isMock && supabase) {
      try {
        // Registrar historial
        await supabase.from('youtube_search_history').insert({
          query,
          results_count: videos.length,
        });

        // Registrar o actualizar videos
        const rows = videos.map((v) => ({
          video_id: v.videoId,
          title: v.title,
          description: v.description,
          channel_title: v.channelTitle,
          published_at: v.publishedAt,
          thumbnail_url: v.thumbnailUrl,
          search_query: query,
        }));

        const { error } = await supabase.from('youtube_videos').upsert(rows, { onConflict: 'video_id' });
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
      const { data, error } = await supabase.from('youtube_videos').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return localVideosDb;
  }

  async getSearchHistory(): Promise<any[]> {
    if (!isMock && supabase) {
      const { data, error } = await supabase.from('youtube_search_history').select('*').order('created_at', { ascending: false });
      if (!error && data) return data;
    }
    return localHistoryDb;
  }

  private getMockVideos(query: string, maxResults: number): YouTubeVideoItem[] {
    const list: YouTubeVideoItem[] = [
      {
        videoId: 'demo_yt_01',
        title: `Cómo dominar ${query} en 2026: Guía Definitiva y Estrategias`,
        description: `Los mejores consejos y técnicas prácticas para dominar ${query} sin perder tiempo.`,
        channelTitle: 'Tech & Growth Academy',
        publishedAt: new Date().toISOString(),
        thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60',
      },
      {
        videoId: 'demo_yt_02',
        title: `El error más común al empezar con ${query} (y cómo evitarlo)`,
        description: `Explicación clara de los tropiezos que frenan al 90% de personas en ${query}.`,
        channelTitle: 'Creadores Pro',
        publishedAt: new Date().toISOString(),
        thumbnailUrl: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=60',
      },
      {
        videoId: 'demo_yt_03',
        title: `5 herramientas secretas para automatizar tu flujo en ${query}`,
        description: `Revisión detallada de software, extensiones y flujos inteligentes.`,
        channelTitle: 'Automatización Inteligente',
        publishedAt: new Date().toISOString(),
        thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=60',
      },
    ];
    return list.slice(0, maxResults);
  }
}
