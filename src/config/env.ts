import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local', override: true });

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  youtubeApiKey: process.env.YOUTUBE_API_KEY || '',
  supabaseUrl: process.env.SUPABASE_URL || 'https://fappvfiamxqrydamrwrz.supabase.co',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};

if (!config.youtubeApiKey) {
  console.warn('⚠️ [Config] YOUTUBE_API_KEY no definida. Algunas funciones de YouTube usarán datos mock si la key no está presente.');
}

if (!config.supabaseAnonKey && !config.supabaseServiceRoleKey) {
  console.warn('⚠️ [Config] SUPABASE_ANON_KEY pendiente de configurar en .env o .env.local.');
}
