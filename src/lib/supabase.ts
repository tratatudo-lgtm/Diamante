import { createClient } from '@supabase/supabase-js';

// Resolve URL and Anon Key from environment variables or localStorage
export const getSupabaseConfig = () => {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  const localUrl = typeof window !== 'undefined' ? localStorage.getItem('diamante_supabase_url') : null;
  const localKey = typeof window !== 'undefined' ? localStorage.getItem('diamante_supabase_key') : null;

  const url = (envUrl && envUrl !== 'https://your-project.supabase.co' ? envUrl : localUrl) || '';
  const key = (envKey && envKey !== 'your-anon-key' ? envKey : localKey) || '';

  return { url: url.trim(), key: key.trim() };
};

const initialConfig = getSupabaseConfig();

// Dummy fallback to prevent library crash if not yet connected, but flag it
const fallbackUrl = 'https://placeholder-instance.supabase.co';
const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export const isSupabaseConfigured = (): boolean => {
  const { url, key } = getSupabaseConfig();
  return Boolean(url && key && url.startsWith('http') && !url.includes('placeholder-instance'));
};

export let supabase = createClient(
  initialConfig.url || fallbackUrl,
  initialConfig.key || fallbackKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
);

export const updateSupabaseClient = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('diamante_supabase_url', url.trim());
    localStorage.setItem('diamante_supabase_key', key.trim());
  }
  supabase = createClient(url.trim(), key.trim(), {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabase;
};
