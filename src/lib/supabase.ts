import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  'https://tdonawilfovdxqxctjwg.supabase.co';

const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_JbXSgTmyq3oGTwp7utTyAw_Twjl1FUs';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('placeholder')
);

// Explicitly configure browser auth persistence with auto-refresh
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    })
  : null;

/**
 * Diagnostic logger to assist during teammate's backend integration
 */
export function logSupabaseStatus(): void {
  if (isSupabaseConfigured) {
    console.info('[Rento Supabase] Connected to live Supabase backend:', supabaseUrl);
  } else {
    console.info(
      '[Rento Data Mode] Running in local persistent storage mode. To connect the live database, provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.'
    );
  }
}
