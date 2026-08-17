import type { Session } from '@supabase/supabase-js';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { consentimientoAlDia, obtenerPerfilPropio } from '@/lib/api';
import { log } from '@/lib/log';
import { supabase } from '@/lib/supabaseClient';
import type { PerfilPropio } from '@/types/modelos';

type EstadoSesion = {
  cargando: boolean;
  sesion: Session | null;
  usuarioId: string | null;
  perfil: PerfilPropio | null;
  /** Hay sesión pero aún no existe fila en `perfiles`: toca onboarding. */
  necesitaOnboarding: boolean;
  /** No ha aceptado la versión vigente de términos y privacidad. */
  necesitaConsentimiento: boolean;
  marcarConsentimiento: () => void;
  refrescarPerfil: () => Promise<void>;
  fijarPerfil: (perfil: PerfilPropio) => void;
};

const Contexto = createContext<EstadoSesion | null>(null);

export function ProveedorSesion({ children }: { children: React.ReactNode }) {
  const [cargando, setCargando] = useState(true);
  const [sesion, setSesion] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<PerfilPropio | null>(null);
  const [consentido, setConsentido] = useState(false);
  const montado = useRef(true);

  const usuarioId = sesion?.user.id ?? null;

  const cargarPerfil = useCallback(async (id: string | null) => {
    if (!id) {
      setPerfil(null);
      setConsentido(false);
      return;
    }
    try {
      const [p, ok] = await Promise.all([
        obtenerPerfilPropio(id),
        consentimientoAlDia().catch(() => false),
      ]);
      if (montado.current) {
        setPerfil(p);
        setConsentido(ok);
      }
    } catch (error) {
      log.error('sesion', 'no se pudo cargar el perfil', {
        error: error instanceof Error ? error.message : String(error),
      });
      if (montado.current) setPerfil(null);
    }
  }, []);

  useEffect(() => {
    montado.current = true;

    void (async () => {
      const { data, error } = await supabase.auth.getSession();
      if (error) log.error('sesion', 'getSession falló', { error: error.message });

      const s = data.session ?? null;
      log.info('sesion', 'arranque', { haySesion: !!s });

      if (montado.current) setSesion(s);
      await cargarPerfil(s?.user.id ?? null);
      if (montado.current) setCargando(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      log.info('sesion', `auth: ${evento}`, { haySesion: !!s });
      setSesion(s);

      if (evento === 'SIGNED_OUT') {
        setPerfil(null);
        setConsentido(false);
        return;
      }
      if (evento === 'SIGNED_IN' || evento === 'USER_UPDATED') {
        void cargarPerfil(s?.user.id ?? null);
      }
    });

    return () => {
      montado.current = false;
      sub.subscription.unsubscribe();
    };
  }, [cargarPerfil]);

  const valor = useMemo<EstadoSesion>(
    () => ({
      cargando,
      sesion,
      usuarioId,
      perfil,
      necesitaOnboarding: !!sesion && !perfil,
      necesitaConsentimiento: !!sesion && !consentido,
      marcarConsentimiento: () => setConsentido(true),
      refrescarPerfil: () => cargarPerfil(usuarioId),
      fijarPerfil: setPerfil,
    }),
    [cargando, sesion, usuarioId, perfil, consentido, cargarPerfil],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useSesion(): EstadoSesion {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error('useSesion debe usarse dentro de <ProveedorSesion>');
  return ctx;
}

/** Para pantallas que solo se montan con sesión activa. */
export function useUsuarioId(): string {
  const { usuarioId } = useSesion();
  if (!usuarioId) throw new Error('Pantalla protegida montada sin sesión');
  return usuarioId;
}
