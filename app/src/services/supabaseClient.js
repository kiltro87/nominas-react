import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * True when both required environment variables are present.
 * When false the app falls back to mock data and auth is disabled.
 */
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Singleton Supabase client. `null` when the env vars are missing (e.g. local
 * development without a `.env` file) so consumers must guard against it.
 */
export const supabase = hasSupabaseConfig
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
