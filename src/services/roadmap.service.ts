import { supabase, isMock } from '../config/supabase.js';
import { YouTubeService, YouTubeVideoItem } from './youtube.service.js';

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

  async generate30DayRoadmap(niche: string = 'Inteligencia Artificial y Productividad'): Promise<RoadmapDayItem[]> {
    console.log(`🤖 [ContentAI] Iniciando análisis de YouTube para nicho: "${niche}"...`);

    // 1. Obtener videos de referencia del nicho
    let videos: YouTubeVideoItem[] = [];
    try {
      videos = await this.youtubeService.searchVideos(niche, 6, false);
    } catch {
      videos = [];
    }

    const items: RoadmapDayItem[] = [];
    const pillars = ['Atracción', 'Educativo', 'Autoridad', 'Comunidad', 'Venta'];
    const formats: ('Reel' | 'Carrusel' | 'Story')[] = ['Reel', 'Reel', 'Carrusel', 'Reel', 'Story', 'Carrusel', 'Reel'];

    const weekThemes = [
      { week: 1, theme: 'Atracción & Disrupción', desc: 'Ganchos virales, desmontar mitos y retención máxima en los primeros 3 segundos.' },
      { week: 2, theme: 'Autoridad & Educación Profunda', desc: 'Carruseles paso a paso, micro-hacks técnicos y metodologías comprobadas.' },
      { week: 3, theme: 'Comunidad & Confianza', desc: 'Historias de errores reales, preguntas frecuentes y dinámicas de debate.' },
      { week: 4, theme: 'Conversión & Oferta Irresistible', desc: 'Llamadas a la acción directas, casos de estudio y soluciones definitivas.' },
    ];

    for (let day = 1; day <= 30; day++) {
      const week = Math.min(Math.ceil(day / 7), 4);
      const weekInfo = weekThemes[week - 1];
      const format = formats[(day - 1) % formats.length];
      const pillar = pillars[(day - 1) % pillars.length];
      const refVideo = videos[(day - 1) % (videos.length || 1)];

      const title = `Día ${day}: ${this.generateDynamicTitle(day, week, niche, refVideo?.title)}`;
      const hook = this.generateDynamicHook(day, week, niche, format);
      const script = this.generateDynamicScript(day, week, niche, format, hook);
      const prompt = this.generateImagePrompt(day, niche, format);
      const caption = this.generateCaption(day, niche, format, hook);

      items.push({
        day_number: day,
        week_number: week,
        content_pillar: pillar,
        format,
        title,
        hook,
        script,
        image_prompt: prompt,
        caption,
        hashtags: this.generateHashtags(niche),
        status: 'pendiente',
        niche,
        reference_video_id: refVideo?.videoId || undefined,
      });
    }

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
    if (!isMock && supabase) {
      try {
        const filter = typeof idOrDay === 'number' ? { day_number: idOrDay } : { id: idOrDay };
        const { error } = await supabase.from('instagram_content_roadmap').update({ status, updated_at: new Date().toISOString() }).match(filter);
        if (!error) return true;
      } catch (err: any) {
        console.warn('[RoadmapService] Error al actualizar estado en Supabase:', err.message);
      }
    }

    const idx = localRoadmapDb.findIndex((i) => i.id === idOrDay || i.day_number === Number(idOrDay));
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

  private generateDynamicTitle(day: number, week: number, niche: string, refTitle?: string): string {
    const base = refTitle ? refTitle.slice(0, 45) : `${niche}`;
    if (week === 1) return `La verdad incómoda sobre ${base} que casi nadie te cuenta`;
    if (week === 2) return `Tutorial Paso a Paso: Implementando la mejor técnica en ${niche}`;
    if (week === 3) return `Cometí este gran fallo en ${niche} y esto fue lo que aprendí`;
    return `Tu Plan Maestro definitivo para dominar ${niche} este mes`;
  }

  private generateDynamicHook(day: number, week: number, niche: string, format: string): string {
    if (format === 'Reel') {
      return `Si aplicas esta regla de 3 minutos todos los días en ${niche}, tus resultados se van a multiplicar (Día ${day}).`;
    }
    if (format === 'Carrusel') {
      return `Desliza si quieres ahorrar más de 10 horas semanales en ${niche}. Te dejo la plantilla exacta.`;
    }
    return `¿Cuál ha sido tu mayor obstáculo con ${niche} esta semana? Deja tu respuesta en la cajita.`;
  }

  private generateDynamicScript(day: number, week: number, niche: string, format: string, hook: string): string {
    if (format === 'Reel') {
      return `[0:00 - 0:03] GANCHO VISUAL & AUDIO: "${hook}" (mostrar texto dinámico en pantalla)\n[0:03 - 0:12] EL PROBLEMA: El 95% comete el error de improvisar sin una estructura clara en ${niche}.\n[0:12 - 0:22] LA SOLUCIÓN: Aplica este método de 3 pasos: 1. Audita lo que no funciona. 2. Simplifica tu proceso. 3. Mide cada 48 horas.\n[0:22 - 0:30] LLAMADA A LA ACCIÓN: Guarda este Reel para cuando vayas a ejecutar y comenta "PLAN" para enviarte la guía completa.`;
    }
    if (format === 'Carrusel') {
      return `SLIDE 1 (PORTADA): "${hook}" (Diseño minimalista con tipografía bold)\nSLIDE 2: El error común: Gastar energía en tareas sin retorno en ${niche}.\nSLIDE 3: El cambio de mentalidad: Automatizar y sistematizar el 80% de la rutina.\nSLIDE 4: El paso a paso práctico con ejemplos reales aplicados.\nSLIDE 5: Resumen en 1 imagen para guardar.\nSLIDE 6 (CIERRE): ¿Listo para implementarlo hoy? Comenta o guarda este carrusel.`;
    }
    return `HISTORIA 1: Foto detrás de cámaras trabajando en ${niche} con sticker de encuesta.\nHISTORIA 2: Micro-consejo del día en video selfie de 15 segundos.\nHISTORIA 3: Sticker de preguntas abierto para responder dudas de la audiencia.`;
  }

  private generateImagePrompt(day: number, niche: string, format: string): string {
    const ratio = format === 'Story' || format === 'Reel' ? '9:16 vertical ratio' : '1:1 square ratio';
    return `High contrast cinematic editorial visual for Instagram Day ${day} focusing on "${niche}". Cyberpunk neon purple and emerald accents, dark moody slate background, sleek futuristic tech aesthetic, volumetric soft lighting, 8k resolution, minimalist typographic balance, ${ratio} --ar 9:16 --v 6.0`;
  }

  private generateCaption(day: number, niche: string, format: string, hook: string): string {
    return `${hook} 🚀\n\nEn ${niche}, la consistencia inteligente le gana a la intensidad sin dirección. Aquí tienes la estrategia desglosada para aplicar hoy mismo.\n\n📌 Guarda este post para no perderlo cuando estés planificando tu semana.\n💬 ¿Cuál es tu mayor desafío actualmente? Te leo en los comentarios.`;
  }

  private generateHashtags(niche: string): string[] {
    const cleanNiche = niche.toLowerCase().replace(/[^a-z0-9]/g, '');
    return [`#${cleanNiche}`, '#crecimientoorganico', '#estrategiadecontenido', '#productividad', '#reelsviral', '#instagramtips'];
  }
}
