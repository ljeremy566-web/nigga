import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { YouTubeVideoItem } from './youtube.service.js';
import { InstagramProfileAnalysis } from './instagram.service.js';
import type { RoadmapDayItem } from './roadmap.service.js';

const ANGLE_PLAYBOOK = [
  {
    name: 'Contrarian / Mito Roto',
    hookFormula: 'Contradicción directa que rompe la creencia común del nicho en 1 frase',
    visualDirection: 'Minimalist white editorial studio, bold clean typography overlay, subject leaning forward with expressive hand gesture, crisp daylight',
  },
  {
    name: 'Tutorial Express / Micro-Hack',
    hookFormula: 'Resultado primero + paso exacto accionable en menos de 30 segundos',
    visualDirection: 'Over-the-shoulder POV shot of clean modern desk, laptop screen in sharp focus, natural warm window light, shallow depth of field',
  },
  {
    name: 'Storytelling / Caso Real',
    hookFormula: 'Situación hiper-específica ("Esto me pasó hoy...") que dispara identificación inmediata',
    visualDirection: 'Candid handheld street-style or workspace portrait, authentic unpolished documentary aesthetic, soft natural contrast',
  },
  {
    name: 'Comparativa / Checklist Guardable',
    hookFormula: 'Promesa concreta de ahorro de tiempo/dinero + señal visual de deslizar',
    visualDirection: 'Clean minimalist flat-lay infographic composition on off-white paper texture, crisp monochrome icons and structured grid balance',
  },
  {
    name: 'Debate / Tendencia en Caliente',
    hookFormula: 'Pregunta polarizante o análisis rápido sobre el cambio reciente del sector',
    visualDirection: 'High-contrast split-frame editorial composition, studio key light, clean neutral slate background, sharp subject separation',
  },
];

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
   * Genera el Roadmap de 30 Días para Instagram aplicando reglas de retención 2026
   * y multiplicando enfoques/guiones/imágenes cuando detecta tendencias fuertes en YouTube.
   */
  async generateMonthlyRoadmapWithAI(
    niche: string,
    youtubeVideos: YouTubeVideoItem[],
    instagramData: InstagramProfileAnalysis
  ): Promise<RoadmapDayItem[]> {
    const sortedVideos = [...youtubeVideos].sort(
      (a, b) => (b.trendScore || b.viewCount || 0) - (a.trendScore || a.viewCount || 0)
    );
    const strongTrends = sortedVideos.filter((v) => v.isStrongTrend).slice(0, 3);
    const fallbackStrong = strongTrends.length > 0 ? strongTrends : sortedVideos.slice(0, 2);

    if (!this.ai || !config.geminiApiKey) {
      console.log('ℹ️ [Gemini AI] Usando generador estratégico inteligente (esperando GEMINI_API_KEY para modo LLM en vivo).');
      return this.generateAlgorithmicRoadmap(niche, sortedVideos, instagramData, fallbackStrong);
    }

    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      console.log(`🤖 [Gemini AI] Procesando ${sortedVideos.length} videos (${fallbackStrong.length} tendencias fuertes) y cuenta ${instagramData.accountHandle}...`);

      const strongTrendsBlock =
        fallbackStrong.length > 0
          ? fallbackStrong
              .map(
                (v, i) =>
                  `${i + 1}. [TENDENCIA FUERTE] videoId="${v.videoId}" | Título: "${v.title}" | Canal: ${v.channelTitle} | Publicado: ${v.publishedAt.slice(0, 10)} | Vistas: ${(v.viewCount || 0).toLocaleString('es-ES')} | Likes: ${(v.likeCount || 0).toLocaleString('es-ES')} | Velocidad: ${v.viewsPerHour || 0} vistas/h | Motivo: ${v.trendReason || 'Pico viral'}`
              )
              .join('\n')
          : 'No se detectaron métricas virales destacadas; variar ángulos sobre los videos recientes.';

      const videosContextBlock = sortedVideos
        .map(
          (v, i) =>
            `${i + 1}. [${v.isStrongTrend ? 'FUERTE' : 'RECIENTE'}] id="${v.videoId}" | "${v.title}" | Canal: ${v.channelTitle} | Fecha: ${v.publishedAt.slice(0, 10)} | Vistas: ${v.viewCount || 0} | Tags: ${(v.tags || []).slice(0, 5).join(', ') || 'N/A'} | Desc: ${v.description.slice(0, 140)}`
        )
        .join('\n');

      const prompt = `
Eres un Director Creativo y Estratega de Retención para Instagram en ${todayIso}.
Crea un Roadmap Completo de 30 Días para el nicho: "${niche}".
FECHA ACTUAL: ${todayIso}. Todo el contenido debe sentirse actual, específico y fresco (PROHIBIDO reciclar clichés genéricos o introducciones de relleno).

TENDENCIAS FUERTES DETECTADAS EN YOUTUBE (EXIGEN MULTI-ENFOQUE):
${strongTrendsBlock}

CATÁLOGO COMPLETO DE VIDEOS RECIENTES DE YOUTUBE:
${videosContextBlock}

REFERENCIA DE ESTILO INSTAGRAM (${instagramData.accountHandle} — nota: perfil simulado base):
- Tono: ${instagramData.detectedTone}
- Ganchos base: ${instagramData.winningHooks.join(' | ')}
- Pilares: ${instagramData.recommendedPillars.join(' | ')}

REGLAS ESTRICTAS DE PRODUCCIÓN DE GUIONES Y VISUALES (BASADAS EN RETENCIÓN 2026):
1. REGLA DE TENDENCIA FUERTE (OBLIGATORIA):
   - Si hay tendencias fuertes arriba, NO las desperdicies en 1 solo post.
   - Genera entre 3 y 5 piezas DISTINTAS para cada tendencia fuerte, repartidas a lo largo del mes, variando:
     a) El ENFOQUE (ej.: Contrarian/Mito Roto, Tutorial Express/Micro-Hack, Storytelling/Error Real, Carrusel Comparativo/Checklist, Debate/Opinión).
     b) El GUION completo (gancho, desarrollo y CTA totalmente diferentes).
     c) El PROMPT DE IMAGEN (cambia por completo el estilo visual, encuadre, iluminación y escena en cada pieza; PROHIBIDO repetir el mismo prompt o estética cyberpunk/neón en todos los días).
2. REGLAS PARA REELS:
   - Gancho hablado (0-3s): 1 sola frase de 8 a 15 palabras máximo. PROHIBIDO empezar con "Hola a todos", "Bienvenidos" o contexto lento. Ve directo al payoff, contradicción o situación hiper-específica ("esto me pasa a mí").
   - Texto en pantalla (0-2s): 5 a 8 palabras máximo en una línea limpia.
   - Guion con pacing dinámico: marca tiempos exactos ([0:00-0:03], [0:03-0:10], [0:10-0:22], [0:22-0:30]) e indica cambios visuales/zoom/B-roll cada ~3 segundos para mantener atención (duración ideal 15-45s, o 7-15s para micro-tips).
3. REGLAS PARA CARRUSELES:
   - Entre 5 y 8 slides con regla estricta de "1 idea por slide".
   - Slide 1: promesa hiper-específica + indicador visual (ej. "1/7 ->").
   - Slides 2-6: puente de valor secuencial con micro-hook al final de cada slide para empujar el deslizamiento.
   - Último slide: resumen guardable + CTA concreto.
4. REGLAS PARA STORIES:
   - Secuencia de 3 historias: detrás de cámaras/contexto + sticker interactivo (encuesta/slider/pregunta) + micro-prueba o CTA por DM.
5. REGLAS PARA CAPTIONS & PROMPTS VISUALES:
   - Primera línea del caption = segundo gancho (NO repite el texto del Reel/Slide 1; agrega el dato, lista o paso que faltó) + CTA orientado a Guardar o Enviar por DM.
   - image_prompt: en inglés, altamente específico a la escena del día (ratio 9:16 para Reel/Story, 4:5 o 1:1 para Carrusel), alternando estilos (fotografía editorial limpia, POV escritorio real, retrato documental, diagrama minimalista, macro de producto/pantalla, etc.).

ESTRUCTURA DEL MES (30 DÍAS):
- Semana 1 (Días 1-7): Atracción & Disrupción (explota ya la tendencia fuerte #1 con varios ángulos).
- Semana 2 (Días 8-14): Autoridad & Educación Profunda (carruseles técnicos + tutoriales express).
- Semana 3 (Días 15-21): Comunidad & Confianza (storytelling, errores reales, debates).
- Semana 4 (Días 22-30): Conversión & Venta (casos prácticos, checklists finales, CTAs directos).

FORMATOS PERMITIDOS: "Reel", "Carrusel", "Story".

INSTRUCCIÓN DE SALIDA:
Devuelve EXCLUSIVAMENTE un arreglo JSON válido (sin markdown ni texto fuera del JSON) con exactamente 30 objetos:
[
  {
    "day_number": 1,
    "week_number": 1,
    "content_pillar": "Atracción",
    "format": "Reel",
    "title": "Título único y específico (incluye el enfoque si viene de tendencia fuerte)",
    "hook": "Gancho hablado de 8-15 palabras + [Texto pantalla: 5-8 palabras]",
    "script": "Guion paso a paso con tiempos [0:00-0:03], acciones visuales cada 3s o estructura Slide 1..N",
    "image_prompt": "Detailed visual prompt in English tailored specifically to this post's scene and aspect ratio",
    "caption": "Segundo gancho + desarrollo breve + CTA para guardar/enviar por DM",
    "hashtags": ["#tag1", "#tag2", "#tag3"],
    "status": "pendiente",
    "niche": "${niche}",
    "reference_video_id": "videoId de YouTube relacionado o null"
  }
]
`;

      const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];

      for (const modelName of modelsToTry) {
        try {
          console.log(`🤖 [Gemini AI] Solicitando roadmap a modelo ${modelName}...`);
          const response = await this.ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.85,
              httpOptions: {
                timeout: 55000,
              },
            },
          });

          const text = response.text || '';
          const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed: RoadmapDayItem[] = JSON.parse(cleanJson);

          if (Array.isArray(parsed) && parsed.length > 0) {
            const normalized = this.normalizeRoadmapItems(parsed, niche, sortedVideos);
            console.log(`✅ [Gemini AI] (${modelName}) Se generaron con éxito ${normalized.length} días de contenido.`);
            return normalized;
          }
        } catch (modelErr: any) {
          console.warn(`⚠️ [Gemini AI] Modelo ${modelName} falló: ${modelErr.message}`);
        }
      }
    } catch (err: any) {
      console.warn(`[Gemini AI Error]: ${err.message}. Empleando generador estratégico de respaldo.`);
    }

    return this.generateAlgorithmicRoadmap(niche, sortedVideos, instagramData, fallbackStrong);
  }

  private normalizeRoadmapItems(
    items: RoadmapDayItem[],
    niche: string,
    videos: YouTubeVideoItem[]
  ): RoadmapDayItem[] {
    const validFormats = new Set(['Reel', 'Carrusel', 'Story']);
    return items.slice(0, 30).map((item, idx) => {
      const dayNumber = idx + 1;
      const weekNumber = Math.min(Math.ceil(dayNumber / 7), 4);
      const format = validFormats.has(item.format) ? item.format : 'Reel';
      const fallbackVideo = videos[idx % (videos.length || 1)];

      return {
        day_number: Number(item.day_number) || dayNumber,
        week_number: Number(item.week_number) || weekNumber,
        content_pillar: item.content_pillar || 'Atracción',
        format,
        title: item.title || `Día ${dayNumber}: ${niche}`,
        hook: item.hook || '',
        script: item.script || '',
        image_prompt: item.image_prompt || '',
        caption: item.caption || '',
        hashtags: Array.isArray(item.hashtags) ? item.hashtags : [],
        status: 'pendiente',
        niche,
        reference_video_id: item.reference_video_id || fallbackVideo?.videoId || undefined,
      };
    });
  }

  /**
   * Generador de respaldo multi-enfoque cuando Gemini no está disponible.
   * Explota las tendencias fuertes con múltiples ángulos, guiones y prompts visuales distintos.
   */
  public generateAlgorithmicRoadmap(
    niche: string,
    youtubeVideos: YouTubeVideoItem[],
    instagramData?: InstagramProfileAnalysis,
    strongTrendsInput?: YouTubeVideoItem[]
  ): RoadmapDayItem[] {
    const items: RoadmapDayItem[] = [];
    const formats: ('Reel' | 'Carrusel' | 'Story')[] = ['Reel', 'Reel', 'Carrusel', 'Reel', 'Story', 'Carrusel', 'Reel'];
    const pillars = ['Atracción', 'Educación', 'Autoridad', 'Comunidad', 'Conversión'];
    const strongTrends =
      strongTrendsInput && strongTrendsInput.length > 0
        ? strongTrendsInput
        : youtubeVideos.filter((v) => v.isStrongTrend);

    for (let day = 1; day <= 30; day++) {
      const week = Math.min(Math.ceil(day / 7), 4);
      const format = formats[(day - 1) % formats.length];
      const pillar = pillars[(day - 1) % pillars.length];

      // Si hay tendencias fuertes, distribuimos múltiples ángulos por cada tendencia fuerte
      const useStrong = strongTrends.length > 0 && day % 2 === 1;
      const ytRef = useStrong
        ? strongTrends[Math.floor((day - 1) / 2) % strongTrends.length]
        : youtubeVideos[(day - 1) % (youtubeVideos.length || 1)];

      const angleIdx = (day - 1 + Math.floor((day - 1) / 5)) % ANGLE_PLAYBOOK.length;
      const angle = ANGLE_PLAYBOOK[angleIdx];
      const topicShort = ytRef?.title ? ytRef.title.slice(0, 48) : niche;

      const hook = this.createHook(day, niche, format, angle.name, topicShort, instagramData);
      const script = this.createScript(niche, format, hook, angle.name, topicShort);
      const ratio = format === 'Carrusel' ? '4:5 portrait ratio' : '9:16 vertical ratio';
      const prompt = `${angle.visualDirection}, concept illustrating "${topicShort}" in the "${niche}" space, day ${day} series variation, ultra-crisp 8k editorial detail, ${ratio}.`;
      const caption = this.createCaption(niche, format, angle.name, topicShort);

      items.push({
        day_number: day,
        week_number: week,
        content_pillar: pillar,
        format,
        title: `Día ${day} [${angle.name}]: ${topicShort}`,
        hook,
        script,
        image_prompt: prompt,
        caption,
        hashtags: [
          `#${niche.toLowerCase().replace(/[^a-z0-9]/g, '') || 'contenido'}`,
          '#crecimientoorganico',
          '#reels2026',
          '#estrategiadecontenido',
          '#instagramtips',
        ],
        status: 'pendiente',
        niche,
        reference_video_id: ytRef?.videoId,
      });
    }

    return items;
  }

  private createHook(
    day: number,
    niche: string,
    format: string,
    angleName: string,
    topic: string,
    _ig?: InstagramProfileAnalysis
  ): string {
    if (format === 'Carrusel') {
      return `Desliza: ${angleName} aplicado a "${topic}" (1/7 →) [Pantalla: 7 pasos sin relleno]`;
    }
    if (format === 'Story') {
      return `Encuesta rápida sobre "${topic}": ¿lo estás aplicando así o todavía improvisas?`;
    }
    if (angleName.includes('Contrarian')) {
      return `Deja de hacer esto con "${topic}" si quieres resultados reales hoy. [Pantalla: El error invisible #${day}]`;
    }
    if (angleName.includes('Tutorial')) {
      return `Copia este flujo de 20 segundos sobre "${topic}" y ahorra horas esta semana. [Pantalla: Paso exacto aquí]`;
    }
    if (angleName.includes('Storytelling')) {
      return `Probé "${topic}" durante 7 días en ${niche} y esto nadie te lo cuenta. [Pantalla: Resultado real]`;
    }
    return `Lo que acaba de cambiar en "${topic}" y cómo aprovecharlo desde hoy. [Pantalla: Nuevo estándar ${niche}]`;
  }

  private createScript(
    niche: string,
    format: string,
    hook: string,
    angleName: string,
    topic: string
  ): string {
    if (format === 'Reel') {
      return `[0:00 - 0:03] GANCHO HABLADO + TEXTO PANTALLA: ${hook} (corte rápido / zoom ligero al segundo 1, sin saludo inicial)\n[0:03 - 0:10] PAYOFF INMEDIATO (${angleName}): Muestra el antes vs después real aplicado a "${topic}" con B-roll o captura en pantalla.\n[0:10 - 0:22] DESARROLLO EN 3 BEATS (cambio visual cada 3s): 1) Qué evitar ya. 2) La acción concreta de hoy. 3) Cómo medir impacto en ${niche}.\n[0:22 - 0:28] CTA PARA ENVÍOS / GUARDADOS: "Guárdalo para aplicarlo hoy o envíaselo a alguien que trabaje en ${niche}."`;
    }
    if (format === 'Carrusel') {
      return `SLIDE 1 (PORTADA): "${topic}" — Enfoque ${angleName} (1/7 →, titular grande y limpio)\nSLIDE 2 (CONTEXTO): Por qué la mayoría falla aquí en ${niche} (1 idea + micro-hook: "Mira el dato →")\nSLIDE 3 (PASO 1): Primer ajuste accionable hoy.\nSLIDE 4 (PASO 2): Comparativa Antes vs Nuevo Enfoque.\nSLIDE 5 (PRUEBA / EJEMPLO): Caso aplicado paso a paso en ${niche}.\nSLIDE 6 (CHECKLIST): Lista de 3 puntos rápidos para revisar.\nSLIDE 7 (CIERRE GUARDABLE): Guarda este carrusel y comenta "GUIA" para el desglose.`;
    }
    return `HISTORIA 1: Foto/clip rápido mostrando tu pantalla o proceso real sobre "${topic}" + sticker de encuesta (Sí / Aún no).\nHISTORIA 2: Video de 15s explicando el punto clave (${angleName}) con subtítulos grandes.\nHISTORIA 3: Caja de preguntas abierta sobre ${niche} para responder en el próximo Reel.`;
  }

  private createCaption(niche: string, format: string, angleName: string, topic: string): string {
    return `Lo que no cupo en el ${format.toLowerCase()} sobre "${topic}" (${angleName}):\n\nLa clave en ${niche} hoy no es publicar más por intuición, sino atacar cada tendencia fuerte desde ángulos distintos hasta encontrar el ganador.\n\n📌 Guárdalo para tener el guion a mano al grabar.\n📩 Envíalo por DM a un colega que necesite ver esto hoy.`;
  }
}
