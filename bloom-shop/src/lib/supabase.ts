import { createClient } from '@supabase/supabase-js';

export const isDemoMode = String(import.meta.env.VITE_DEMO_MODE ?? '')
  .trim()
  .toLowerCase() === 'true';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://demo-bloom.supabase.co';
export const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  'demo-public-anon-key-for-local-ui-preview-only';

export const isSupabaseConfigured =
  !isDemoMode && Boolean(import.meta.env.VITE_SUPABASE_URL) && Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function withFallback<T>(
  query: PromiseLike<{ data: T | null; error: unknown }>,
  fallback: T,
): Promise<T> {
  if (!isSupabaseConfigured) {
    return fallback;
  }

  try {
    const result = await query;
    if (result.error || result.data === null) {
      return fallback;
    }
    return result.data;
  } catch {
    return fallback;
  }
}
