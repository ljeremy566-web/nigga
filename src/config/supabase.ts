import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from './env.js';

let supabase: SupabaseClient | null = null;
let isMock = false;

if (config.supabaseUrl && (config.supabaseServiceRoleKey || config.supabaseAnonKey)) {
  const key = config.supabaseServiceRoleKey || config.supabaseAnonKey;
  supabase = createClient(config.supabaseUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  console.log(`✅ [Supabase] Cliente conectado con éxito a: ${config.supabaseUrl}`);
} else {
  isMock = true;
  console.warn('ℹ️ [Supabase] Modo local/mock activado (configura SUPABASE_URL y SUPABASE_ANON_KEY en .env para persistencia en la nube).');
}

export { supabase, isMock };
