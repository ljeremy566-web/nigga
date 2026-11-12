-- =========================================================================
-- ESQUEMA COMPLETO DE BASE DE DATOS PARA SUPABASE
-- Proyecto: YouTube Data API v3 + Supabase + Generador de Roadmaps Instagram
-- =========================================================================

-- 1. Tabla de Historial de Búsquedas en YouTube
CREATE TABLE IF NOT EXISTS public.youtube_search_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query TEXT NOT NULL,
    results_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 2. Tabla de Videos Extraídos de YouTube
CREATE TABLE IF NOT EXISTS public.youtube_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    description TEXT,
    channel_title TEXT,
    channel_id TEXT,
    published_at TIMESTAMPTZ,
    thumbnail_url TEXT,
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,
    tags TEXT[],
    search_query TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'youtube_videos' AND column_name = 'id' AND data_type = 'text'
    ) THEN
        ALTER TABLE public.youtube_videos ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
    END IF;
END $$;
ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS video_id TEXT;
ALTER TABLE public.youtube_videos ADD COLUMN IF NOT EXISTS search_query TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_youtube_videos_video_id ON public.youtube_videos(video_id);

-- 3. Tabla de Roadmap de Contenido para Instagram (30 Días)
CREATE TABLE IF NOT EXISTS public.instagram_content_roadmap (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_number INTEGER NOT NULL,
    week_number INTEGER NOT NULL,
    content_pillar TEXT NOT NULL, -- 'Educativo', 'Autoridad', 'Comunidad', 'Venta', 'Entretenimiento'
    format TEXT NOT NULL,         -- 'Reel', 'Carrusel', 'Story'
    title TEXT NOT NULL,
    hook TEXT NOT NULL,           -- Gancho 0-3 segundos
    script TEXT NOT NULL,         -- Guion paso a paso
    image_prompt TEXT,            -- Prompt para Midjourney / DALL-E
    caption TEXT,                 -- Copy para Instagram
    hashtags TEXT[],
    status TEXT DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'grabado', 'editado', 'publicado')),
    niche TEXT DEFAULT 'General',
    reference_video_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Índices para optimizar consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_youtube_videos_query ON public.youtube_videos(search_query);
CREATE INDEX IF NOT EXISTS idx_youtube_videos_views ON public.youtube_videos(view_count DESC);
CREATE INDEX IF NOT EXISTS idx_roadmap_day ON public.instagram_content_roadmap(day_number);
CREATE INDEX IF NOT EXISTS idx_roadmap_niche ON public.instagram_content_roadmap(niche);
CREATE INDEX IF NOT EXISTS idx_roadmap_status ON public.instagram_content_roadmap(status);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.youtube_search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.youtube_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_content_roadmap ENABLE ROW LEVEL SECURITY;

-- Políticas de acceso permisivo para la API (Anon / Service Role)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'youtube_search_history' AND policyname = 'Permitir todo a anon y authenticated') THEN
        CREATE POLICY "Permitir todo a anon y authenticated" ON public.youtube_search_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'youtube_videos' AND policyname = 'Permitir todo a anon y authenticated') THEN
        CREATE POLICY "Permitir todo a anon y authenticated" ON public.youtube_videos FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'instagram_content_roadmap' AND policyname = 'Permitir todo a anon y authenticated') THEN
        CREATE POLICY "Permitir todo a anon y authenticated" ON public.instagram_content_roadmap FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;
