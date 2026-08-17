import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@/types/database';
import { log } from './log';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const claveAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !claveAnon) {
  throw new Error(
    '[supabase] Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
      'Copia .env.example a .env y reinicia con `npx expo start -c`.',
  );
}

export const supabase = createClient<Database>(url, claveAnon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // En RN no hay URL de callback: si esto queda en true, getSession() cuelga.
    detectSessionInUrl: false,
  },
  realtime: {
    params: { eventsPerSecond: 10 },
  },
});

// El refresco de token solo tiene sentido con la app en primer plano.
AppState.addEventListener('change', (estado) => {
  if (estado === 'active') {
    void supabase.auth.startAutoRefresh();
  } else {
    void supabase.auth.stopAutoRefresh();
  }
});

log.info('supabase', 'cliente listo', {
  proyecto: url.replace(/^https:\/\/([^.]+).*/, '$1'),
});

/** Traduce errores de Postgres/Auth a algo que se pueda enseñar en pantalla. */
export function mensajeDeError(error: unknown): string {
  if (!error) return 'Algo ha fallado. Inténtalo otra vez.';
  const msg = error instanceof Error ? error.message : String(error);

  if (/Invalid login credentials/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/User already registered/i.test(msg))
    return 'Ese email ya tiene cuenta. Inicia sesión.';
  if (/Password should be at least/i.test(msg))
    return 'La contraseña necesita 6 caracteres como mínimo.';
  if (/Email not confirmed/i.test(msg)) return 'Confirma el email antes de entrar.';
  if (/Unable to validate email/i.test(msg)) return 'Ese email no tiene un formato válido.';
  if (/rate limit|too many/i.test(msg)) return 'Demasiados intentos. Espera un minuto.';
  if (/no autenticado/i.test(msg)) return 'Tu sesión ha caducado. Vuelve a entrar.';
  if (/perfil no creado/i.test(msg)) return 'Completa tu perfil antes de continuar.';
  if (/Network request failed|fetch/i.test(msg)) return 'Sin conexión con el servidor.';

  return msg;
}
