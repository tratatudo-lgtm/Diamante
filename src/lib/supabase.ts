import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const getSupabaseConfig = () => {
  const url = (import.meta.env.VITE_SUPABASE_URL || '').trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();
  return { url, key };
};

export const isSupabaseConfigured = (): boolean => {
  const { url, key } = getSupabaseConfig();
  if (!url || !key || key === 'your-anon-key') return false;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

let activeClient: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  const { url, key } = getSupabaseConfig();
  activeClient = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  });
}

const unavailableMessage =
  'Supabase não está configurada. Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY antes de utilizar esta operação.';

function guardedProxy<T extends object>(getTarget: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const target = getTarget();
      const value = Reflect.get(target, property, target);
      if (typeof value === 'function') return value.bind(target);
      if (value !== null && typeof value === 'object') {
        return guardedProxy(() => value as object) as typeof value;
      }
      return value;
    },
  });
}

export const supabase = guardedProxy<SupabaseClient>(() => {
  if (!activeClient) throw new Error(unavailableMessage);
  return activeClient;
});
