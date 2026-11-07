import { AppState } from 'react-native';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

// SecureStore warns above ~2KB per value and a Supabase session JSON can exceed that,
// so the session is split into chunks.
const CHUNK = 1800;
const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

const chunkedStorage = {
  async getItem(key: string): Promise<string | null> {
    const count = await SecureStore.getItemAsync(`${key}.n`, opts);
    if (!count) return null;
    const parts: string[] = [];
    for (let i = 0; i < Number(count); i++) {
      const p = await SecureStore.getItemAsync(`${key}.${i}`, opts);
      if (p == null) return null;
      parts.push(p);
    }
    return parts.join('');
  },
  async setItem(key: string, value: string): Promise<void> {
    await chunkedStorage.removeItem(key);
    const n = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < n; i++) {
      await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK), opts);
    }
    await SecureStore.setItemAsync(`${key}.n`, String(n), opts);
  },
  async removeItem(key: string): Promise<void> {
    const count = await SecureStore.getItemAsync(`${key}.n`, opts);
    for (let i = 0; i < Number(count ?? 0); i++) await SecureStore.deleteItemAsync(`${key}.${i}`, opts);
    await SecureStore.deleteItemAsync(`${key}.n`, opts);
  },
};

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabaseConfigured = Boolean(url && key);

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing', {
  auth: {
    storage: chunkedStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is in the foreground.
AppState.addEventListener('change', (s) => {
  if (s === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
