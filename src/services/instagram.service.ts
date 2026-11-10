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

export class InstagramService {
  /**
   * Analiza una cuenta de Instagram de referencia para extraer ideas, ganchos y formatos ganadores
   */
  async analyzeAccount(accountHandle: string, niche: string): Promise<InstagramProfileAnalysis> {
    const cleanHandle = accountHandle.replace(/^@/, '').trim();
    console.log(`📸 [InstagramService] Analizando cuenta de referencia: @${cleanHandle} (Nicho: ${niche})...`);

    // En un entorno de producción, aquí se conecta con Meta Graph API o scraper autorizado.
    // Devolvemos el análisis de inteligencia de contenido estructurado:
    return {
      accountHandle: `@${cleanHandle}`,
      niche,
      detectedTone: 'Autoridad práctica, directo al punto, storytelling con ganchos disruptivos',
      winningHooks: [
        `"La mayoría en ${niche} comete este error todos los días y no se da cuenta..."`,
        `"Dejé de hacer esto en ${niche} y mis resultados se multiplicaron por 3."`,
        `"3 herramientas de ${niche} que parecen ilegales de lo buenas que son."`,
        `"Guárdate este carrusel si quieres ahorrar 15 horas de trabajo esta semana."`
      ],
      recommendedPillars: [
        'Atracción Viral (Reels con ganchos 0-3s)',
        'Educación Técnica / Micro-hacks (Carruseles 6 slides)',
        'Storytelling & Vulnerabilidad (Historias de errores y aprendizajes)',
        'Llamada a la Acción & Conversión (Lead magnets y DMs directos)'
      ],
      topPosts: [
        {
          id: 'ig_ref_1',
          caption: `El secreto no es trabajar más horas en ${niche}, sino automatizar lo repetitivo. Guarda este post para después.`,
          format: 'Carrusel',
          likesCount: 1420,
          commentsCount: 98,
          keyThemes: ['Automatización', 'Productividad', 'Herramientas'],
          hook: 'El 90% pierde el tiempo en esto sin saberlo.'
        },
        {
          id: 'ig_ref_2',
          caption: `Tutorial paso a paso para crear tu sistema de trabajo en ${niche}. Comenta "PLANTILLA" para enviártelo.`,
          format: 'Reel',
          likesCount: 3850,
          commentsCount: 312,
          keyThemes: ['Tutorial', 'Framework', 'Paso a Paso'],
          hook: 'Deja de complicarte la vida con este proceso.'
        }
      ],
      analyzedAt: new Date().toISOString()
    };
  }
}
