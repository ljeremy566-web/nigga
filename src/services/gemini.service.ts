import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env.js';
import { YouTubeVideoItem } from './youtube.service.js';
import type { CapturedInstagramReelItem, InstagramProfileAnalysis } from './instagram.service.js';
import type { RoadmapDayItem } from './roadmap.service.js';
import type { IgRoadmapDayItem } from './ig-roadmap.service.js';

export interface ReelFrameAnalysis {
  visual_hook_text: string;
  visual_style: string;
  detected_angle: string;
}

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

  /**
   * Analiza el primer frame de un Reel capturado (Gemini Vision multimodal)
   * para extraer el texto en pantalla (gancho visual), estética y ángulo editorial.
   */
  async analyzeReelFirstFrame(input: {
    shortcode: string;
    caption?: string;
    authorHandle?: string;
    frameImageBase64?: string;
  }): Promise<ReelFrameAnalysis> {
    const captionFirstLine = (input.caption || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean) || '';

    const heuristicFallback = (): ReelFrameAnalysis => {
      const lower = (input.caption || '').toLowerCase();
      let detectedAngle = 'Tutorial Express / Micro-Hack';
      if (/error|mito|deja de|no hagas|mentira|nadie te dice/.test(lower)) {
        detectedAngle = 'Contrarian / Mito Roto';
      } else if (/historia|hoy me|aprend[ií]|caso|experiencia/.test(lower)) {
        detectedAngle = 'Storytelling / Caso Real';
      } else if (/lista|checklist|herramientas|top \d|pasos|gu[ií]a/.test(lower)) {
        detectedAngle = 'Comparativa / Checklist Guardable';
      } else if (/pol[eé]mica|opini[oó]n|cambio|nuevo|2026/.test(lower)) {
        detectedAngle = 'Debate / Tendencia en Caliente';
      }
      return {
        visual_hook_text: captionFirstLine
          ? captionFirstLine.slice(0, 95)
          : `Hook visual de ${input.authorHandle || 'Reel'} (${input.shortcode})`,
        visual_style: input.frameImageBase64
          ? 'Primer frame vertical 9:16 capturado — encuadre central con texto de alto contraste en tercio superior'
          : 'Formato vertical 9:16 dinámico (sin frame visual adjunto; inferido desde caption)',
        detected_angle: detectedAngle,
      };
    };

    if (!this.ai || !config.geminiApiKey || !input.frameImageBase64) {
      return heuristicFallback();
    }

    const rawData = input.frameImageBase64.trim();
    const match = rawData.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    const mimeType = match ? match[1] : 'image/jpeg';
    const base64Bytes = match ? match[2] : rawData;

    if (!base64Bytes || base64Bytes.length < 32) {
      return heuristicFallback();
    }

    const visionPrompt = `
Analiza este primer frame (0-3s) de un Instagram Reel de ${input.authorHandle || '@creador'} (shortcode: ${input.shortcode}).
Caption del Reel: "${(input.caption || '').slice(0, 400)}"

Extrae y devuelve EXCLUSIVAMENTE un objeto JSON válido con estas 3 claves exactas:
{
  "visual_hook_text": "Texto exacto visible en pantalla o promesa visual principal en <= 90 caracteres",
  "visual_style": "Descripción concisa del encuadre, iluminación, estética, B-roll o plano (ej. 'Talking head vertical con subtítulos amarillos y corte dinámico')",
  "detected_angle": "Uno de: Contrarian / Mito Roto | Tutorial Express / Micro-Hack | Storytelling / Caso Real | Comparativa / Checklist Guardable | Debate / Tendencia en Caliente"
}
`;

    const modelsToTry = ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
    for (const modelName of modelsToTry) {
      try {
        const response = await this.ai.models.generateContent({
          model: modelName,
          contents: [
            {
              role: 'user',
              parts: [
                { text: visionPrompt },
                { inlineData: { mimeType, data: base64Bytes } },
              ],
            },
          ],
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            httpOptions: { timeout: 25000 },
          },
        });
        const cleanJson = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);
        if (parsed && typeof parsed === 'object') {
          return {
            visual_hook_text: String(parsed.visual_hook_text || '').trim() || heuristicFallback().visual_hook_text,
            visual_style: String(parsed.visual_style || '').trim() || heuristicFallback().visual_style,
            detected_angle: String(parsed.detected_angle || '').trim() || heuristicFallback().detected_angle,
          };
        }
      } catch (err: any) {
        console.warn(`⚠️ [Gemini Vision] Modelo ${modelName} falló en Reel ${input.shortcode}: ${err.message}`);
      }
    }

    return heuristicFallback();
  }

  /**
   * Genera un Roadmap Independiente de 30 Días alimentado exclusivamente por Reels capturados de Instagram,
   * manteniendo exactamente el formato Content Studio.
   */
  async generateIgMonthlyRoadmapWithAI(
    niche: string,
    capturedReels: CapturedInstagramReelItem[],
    sourceQuery?: string
  ): Promise<IgRoadmapDayItem[]> {
    const sortedReels = [...capturedReels].sort((a, b) => {
      const scoreA = (a.view_count || 0) + (a.like_count || 0) * 15 + (a.comment_count || 0) * 35;
      const scoreB = (b.view_count || 0) + (b.like_count || 0) * 15 + (b.comment_count || 0) * 35;
      return scoreB - scoreA;
    });

    const topReels = sortedReels.slice(0, 12);

    if (!this.ai || !config.geminiApiKey || topReels.length === 0) {
      return this.generateAlgorithmicIgRoadmap(niche, sortedReels, sourceQuery);
    }

    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const reelsBlock = topReels
        .map(
          (r, idx) =>
            `${idx + 1}. shortcode="${r.shortcode}" | url="${r.reel_url}" | autor=${r.author_handle} | vistas=${r.view_count || 0} | likes=${r.like_count || 0} | comentarios=${r.comment_count || 0} | audio="${r.audio_name || 'Original'}" | hook_visual="${r.visual_hook_text || ''}" | estilo_visual="${r.visual_style || ''}" | angulo="${r.detected_angle || ''}" | caption="${(r.caption || '').slice(0, 220)}"`
        )
        .join('\n');

      const prompt = `
Eres un Director Creativo y Estratega de Retención para Instagram en ${todayIso}.
Crea un Roadmap Independiente de 30 Días para el nicho "${niche}"${sourceQuery ? ` (búsqueda/cuenta IG: "${sourceQuery}")` : ''}, basado EXCLUSIVAMENTE en los siguientes Reels reales capturados de Instagram:

REELS REALES CAPTURADOS DE INSTAGRAM:
${reelsBlock}

REGLAS ESTRICTAS:
1. Modela y mejora los ganchos ganadores, estética visual y formatos de estos Reels reales sin copiar palabra por palabra (adapta cada idea con enfoque original y mayor retención).
2. Explota los 3 Reels con mayor tracción en 3 a 5 piezas distintas a lo largo del mes (variando ángulo: Contrarian, Tutorial Express, Storytelling, Carrusel Guardable, Debate).
3. Formatos permitidos: "Reel", "Carrusel", "Story".
4. Reels: Gancho hablado de 8-15 palabras + [Texto pantalla: 5-8 palabras] y tiempos exactos [0:00-0:03], [0:03-0:10], [0:10-0:22], [0:22-0:28].
5. Carruseles: 5-8 slides ("1 idea por slide").
6. Stories: secuencia de 3 historias con sticker interactivo.
7. Cada día DEBE incluir "reference_reel_shortcode", "reference_reel_url" y "reference_reel_author" de alguno de los Reels reales de arriba.

Devuelve EXCLUSIVAMENTE un arreglo JSON válido de exactamente 30 objetos con esta estructura:
[
  {
    "day_number": 1,
    "week_number": 1,
    "content_pillar": "Atracción",
    "format": "Reel",
    "title": "Título específico inspirado en Reel capturado",
    "hook": "Gancho hablado 8-15 palabras + [Texto pantalla: 5-8 palabras]",
    "script": "Guion completo paso a paso",
    "image_prompt": "Detailed visual prompt in English tailored to this post's scene and 9:16 or 4:5 ratio",
    "caption": "Segundo gancho + valor + CTA guardar/DM",
    "hashtags": ["#tag1", "#tag2", "#tag3"],
    "status": "pendiente",
    "niche": "${niche}",
    "source_query": "${sourceQuery || niche}",
    "reference_reel_shortcode": "shortcode exacto del Reel de referencia",
    "reference_reel_url": "https://www.instagram.com/reel/.../",
    "reference_reel_author": "@autor"
  }
]
`;

      const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
      for (const modelName of modelsToTry) {
        try {
          const response = await this.ai.models.generateContent({
            model: modelName,
            contents: prompt,
            config: {
              responseMimeType: 'application/json',
              temperature: 0.85,
              httpOptions: { timeout: 55000 },
            },
          });
          const cleanJson = (response.text || '').replace(/```json/g, '').replace(/```/g, '').trim();
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            return this.normalizeIgRoadmapItems(parsed, niche, topReels, sourceQuery);
          }
        } catch (modelErr: any) {
          console.warn(`⚠️ [Gemini IG Roadmap] Modelo ${modelName} falló: ${modelErr.message}`);
        }
      }
    } catch (err: any) {
      console.warn(`[Gemini IG Roadmap Error]: ${err.message}`);
    }

    return this.generateAlgorithmicIgRoadmap(niche, sortedReels, sourceQuery);
  }

  private normalizeIgRoadmapItems(
    items: Partial<IgRoadmapDayItem>[],
    niche: string,
    reels: CapturedInstagramReelItem[],
    sourceQuery?: string
  ): IgRoadmapDayItem[] {
    const validFormats = new Set(['Reel', 'Carrusel', 'Story']);
    const reelByCode = new Map(reels.map((r) => [r.shortcode, r]));

    return items.slice(0, 30).map((item, idx) => {
      const dayNumber = idx + 1;
      const weekNumber = Math.min(Math.ceil(dayNumber / 7), 4);
      const format = validFormats.has(String(item.format)) ? (item.format as 'Reel' | 'Carrusel' | 'Story') : 'Reel';
      const fallbackReel = reels[idx % (reels.length || 1)];
      const matchedReel =
        (item.reference_reel_shortcode && reelByCode.get(item.reference_reel_shortcode)) || fallbackReel;

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
        source_query: item.source_query || sourceQuery || matchedReel?.source_query || niche,
        reference_reel_shortcode: matchedReel?.shortcode || item.reference_reel_shortcode || undefined,
        reference_reel_url: matchedReel?.reel_url || item.reference_reel_url || undefined,
        reference_reel_author: matchedReel?.author_handle || item.reference_reel_author || undefined,
      };
    });
  }

  public generateAlgorithmicIgRoadmap(
    niche: string,
    capturedReels: CapturedInstagramReelItem[],
    sourceQuery?: string
  ): IgRoadmapDayItem[] {
    const items: IgRoadmapDayItem[] = [];
    const formats: ('Reel' | 'Carrusel' | 'Story')[] = ['Reel', 'Reel', 'Carrusel', 'Reel', 'Story', 'Carrusel', 'Reel'];
    const pillars = ['Atracción', 'Educación', 'Autoridad', 'Comunidad', 'Conversión'];

    for (let day = 1; day <= 30; day++) {
      const week = Math.min(Math.ceil(day / 7), 4);
      const format = formats[(day - 1) % formats.length];
      const pillar = pillars[(day - 1) % pillars.length];
      const reelRef = capturedReels.length > 0 ? capturedReels[(day - 1) % capturedReels.length] : undefined;
      const angle = ANGLE_PLAYBOOK[(day - 1 + Math.floor((day - 1) / 5)) % ANGLE_PLAYBOOK.length];

      const topicBase = reelRef?.visual_hook_text
        ? reelRef.visual_hook_text.slice(0, 46)
        : reelRef?.caption
        ? reelRef.caption.split(/\r?\n/)[0].slice(0, 46)
        : niche;
      const authorLabel = reelRef?.author_handle || '@referencia_ig';

      const hook = this.createHook(day, niche, format, angle.name, topicBase);
      const script = this.createScript(niche, format, hook, angle.name, topicBase);
      const ratio = format === 'Carrusel' ? '4:5 portrait ratio' : '9:16 vertical ratio';
      const styleRef = reelRef?.visual_style
        ? `${reelRef.visual_style}, adapted cleanly`
        : angle.visualDirection;
      const prompt = `${styleRef}, concept inspired by ${authorLabel} Reel "${topicBase}" in "${niche}", day ${day} series variation, ultra-crisp 8k editorial detail, ${ratio}.`;
      const caption = `${this.createCaption(niche, format, angle.name, topicBase)}${
        reelRef?.audio_name ? `\n\n🎵 Audio sugerido: ${reelRef.audio_name}` : ''
      }`;

      const tags =
        reelRef?.hashtags && reelRef.hashtags.length > 0
          ? reelRef.hashtags.slice(0, 5)
          : [
              `#${niche.toLowerCase().replace(/[^a-z0-9]/g, '') || 'instagram'}`,
              '#reels2026',
              '#creadoresig',
              '#estrategiadecontenido',
            ];

      items.push({
        day_number: day,
        week_number: week,
        content_pillar: pillar,
        format,
        title: `Día ${day} [${angle.name}]: ${topicBase}`,
        hook,
        script,
        image_prompt: prompt,
        caption,
        hashtags: tags,
        status: 'pendiente',
        niche,
        source_query: sourceQuery || reelRef?.source_query || niche,
        reference_reel_shortcode: reelRef?.shortcode,
        reference_reel_url: reelRef?.reel_url,
        reference_reel_author: reelRef?.author_handle,
      });
    }

    return items;
  }
}
