import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { YouTubeVideoItem } from './youtube.service.js';
import { InstagramProfileAnalysis } from './instagram.service.js';
import { RoadmapDayItem } from './roadmap.service.js';

export class GeminiService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    if (config.geminiApiKey) {
      this.ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
      console.log('✅ [Gemini AI] Motor conectado y listo con API Key.');
    } else {
      console.warn('⚠️ [Gemini AI] GEMINI_API_KEY no detectada. El generador usará el motor de respaldo estructurado.');
    }
  }

  /**
   * Genera el Roadmap de 30 Días para Instagram a partir de YouTube + Instagram de Referencia
   */
  async generateMonthlyRoadmapWithAI(
    niche: string,
    youtubeVideos: YouTubeVideoItem[],
    instagramData: InstagramProfileAnalysis
  ): Promise<RoadmapDayItem[]> {
    if (!this.ai || !config.geminiApiKey) {
      console.log('ℹ️ [Gemini AI] Usando generador estratégico inteligente (esperando GEMINI_API_KEY para modo LLM en vivo).');
      return this.generateAlgorithmicRoadmap(niche, youtubeVideos, instagramData);
    }

    try {
      console.log(`🤖 [Gemini AI] Procesando tendencias de YouTube (${youtubeVideos.length} videos) y cuenta ${instagramData.accountHandle}...`);

      const prompt = `
Eres un Director de Estrategia de Contenido y Viralidad Senior para Instagram.
Tu objetivo es crear un Roadmap Completo de 30 Días para Instagram para el nicho: "${niche}".

DATOS DE ENTRADA DE TENDENCIAS EN YOUTUBE:
${youtubeVideos.map((v, i) => `${i + 1}. Título: "${v.title}" | Canal: ${v.channelTitle} | Desc: ${v.description.slice(0, 100)}`).join('\n')}

DATOS DE REFERENCIA DE INSTAGRAM (${instagramData.accountHandle}):
- Tono detectado: ${instagramData.detectedTone}
- Ganchos ganadores: ${instagramData.winningHooks.join(' | ')}
- Pilares recomendados: ${instagramData.recommendedPillars.join(' | ')}

ESTRUCTURA OBLIGATORIA DEL MES (30 DÍAS):
- Semana 1 (Días 1-7): Atracción & Viralidad (Reels con ganchos disruptivos de 0-3s, mitos y errores comunes).
- Semana 2 (Días 8-14): Autoridad & Educación Profunda (Carruseles técnicos de alto valor y micro-hacks).
- Semana 3 (Días 15-21): Comunidad & Confianza (Storytelling de errores reales, Q&A interactivo y debates).
- Semana 4 (Días 22-30): Conversión & Venta (Casos de éxito, roadmap definitivo y llamadas a la acción directas).

FORMATOS PERMITIDOS: "Reel", "Carrusel", "Story".

INSTRUCCIÓN DE SALIDA:
Devuelve EXCLUSIVAMENTE un arreglo JSON válido (sin formato markdown adicional, solo el JSON) con exactamente 30 objetos con la siguiente estructura:
[
  {
    "day_number": 1,
    "week_number": 1,
    "content_pillar": "Atracción",
    "format": "Reel",
    "title": "Título llamativo del contenido",
    "hook": "Gancho de los primeros 0 a 3 segundos",
    "script": "Guion estructurado paso a paso con tiempos o diapositivas",
    "image_prompt": "Prompt cinematográfico detallado para Midjourney / DALL-E (aspect ratio 9:16 o 1:1, iluminación, estilo)",
    "caption": "Copy completo para Instagram con llamada a la acción",
    "hashtags": ["#tag1", "#tag2", "#tag3"],
    "status": "pendiente",
    "niche": "${niche}"
  }
]
`;

      const modelsToTry = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

      for (const modelName of modelsToTry) {
        try {
          console.log(`🤖 [Gemini AI] Solicitando roadmap a modelo ${modelName}...`);
          const response = await this.ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.7,
              httpOptions: {
                timeout: 45000,
              },
            },
          });

          const text = response.text || '';
          const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed: RoadmapDayItem[] = JSON.parse(cleanJson);

          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(`✅ [Gemini AI] (${modelName}) Se generaron con éxito ${parsed.length} días de contenido para Instagram.`);
            return parsed;
          }
        } catch (modelErr: any) {
          console.warn(`⚠️ [Gemini AI] Modelo ${modelName} falló: ${modelErr.message}`);
        }
      }
    } catch (err: any) {
      console.warn(`[Gemini AI Error]: ${err.message}. Empleando generador estratégico de respaldo.`);
    }

    return this.generateAlgorithmicRoadmap(niche, youtubeVideos, instagramData);
  }

  /**
   * Generador de respaldo de alta fidelidad cuando no hay conexión a la API de Gemini
   */
  private generateAlgorithmicRoadmap(
    niche: string,
    youtubeVideos: YouTubeVideoItem[],
    instagramData: InstagramProfileAnalysis
  ): RoadmapDayItem[] {
    const items: RoadmapDayItem[] = [];
    const formats: ('Reel' | 'Carrusel' | 'Story')[] = ['Reel', 'Reel', 'Carrusel', 'Reel', 'Story', 'Carrusel', 'Reel'];
    const pillars = ['Atracción', 'Educación', 'Autoridad', 'Comunidad', 'Conversión'];

    for (let day = 1; day <= 30; day++) {
      const week = Math.min(Math.ceil(day / 7), 4);
      const format = formats[(day - 1) % formats.length];
      const pillar = pillars[(day - 1) % pillars.length];
      const ytRef = youtubeVideos[(day - 1) % (youtubeVideos.length || 1)];

      const hook = this.createHook(day, week, niche, format, ytRef?.title);
      const script = this.createScript(day, week, niche, format, hook);
      const prompt = `Cinematic editorial visual for Instagram Day ${day} focusing on "${niche}". Ultra-realistic, atmospheric dark slate background, cyberpunk emerald and purple accents, 8k resolution, minimalist typographic balance, ${format === 'Carrusel' ? '1:1 ratio' : '9:16 vertical ratio'}.`;
      const caption = `${hook} 🚀\n\nEn ${niche}, el secreto no es trabajar más duro, sino con un método claro y probado.\n\n📌 Guarda este contenido para cuando vayas a grabar tu próximo post.\n💬 ¿Cuál es tu formato favorito en Instagram actualmente? Te leo en comentarios.`;

      items.push({
        day_number: day,
        week_number: week,
        content_pillar: pillar,
        format,
        title: `Día ${day}: Estrategia Clave en ${niche} - ${ytRef ? ytRef.title.slice(0, 40) : 'Método Definitivo'}`,
        hook,
        script,
        image_prompt: prompt,
        caption,
        hashtags: [`#${niche.toLowerCase().replace(/[^a-z0-9]/g, '')}`, '#crecimientoorganico', '#reelsviral', '#estrategiadecontenido', '#tipsdeinstagram'],
        status: 'pendiente',
        niche,
        reference_video_id: ytRef?.videoId,
      });
    }

    return items;
  }

  private createHook(day: number, week: number, niche: string, format: string, refTitle?: string): string {
    if (format === 'Reel') {
      return `Si aplicas esta regla de 3 minutos todos los días en ${niche}, tus resultados van a dar un salto gigante (Día ${day}).`;
    }
    if (format === 'Carrusel') {
      return `Desliza si quieres dominar ${refTitle ? refTitle.slice(0, 35) : niche} sin perder semanas cometiendo los mismos errores.`;
    }
    return `¿Cuál es el mayor obstáculo que te frena en ${niche} hoy? Te respondo en las próximas historias.`;
  }

  private createScript(day: number, week: number, niche: string, format: string, hook: string): string {
    if (format === 'Reel') {
      return `[0:00 - 0:03] GANCHO EN PANTALLA: "${hook}"\n[0:03 - 0:12] EL PROBLEMA: El 90% intenta resolver esto improvisando y quema su presupuesto.\n[0:12 - 0:22] LA SOLUCIÓN: Paso 1: Identifica tu métrica clave. Paso 2: Aplica la automatización que te muestro. Paso 3: Revisa tus avances cada 7 días.\n[0:22 - 0:30] LLAMADA A LA ACCIÓN: Guarda este Reel y comenta "PLAN" para recibir la guía completa en tus DMs.`;
    }
    if (format === 'Carrusel') {
      return `SLIDE 1 (PORTADA): "${hook}" (Diseño limpio y tipografía bold)\nSLIDE 2: El error que debes evitar a toda costa.\nSLIDE 3: El nuevo enfoque que está funcionando este mes.\nSLIDE 4: Guía paso a paso con diagrama visual.\nSLIDE 5: Resumen en 1 imagen para guardar.\nSLIDE 6 (CIERRE): Guarda este carrusel y compártelo con tu equipo.`;
    }
    return `HISTORIA 1: Encuesta rápida sobre ${niche}.\nHISTORIA 2: Video selfie de 15 segundos revelando un tip rápido.\nHISTORIA 3: Sticker de preguntas abierto.`;
  }
}
