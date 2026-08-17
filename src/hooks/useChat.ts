import { useCallback, useEffect, useRef, useState } from 'react';

import { enviarMensaje, listarMensajes, marcarLeidos } from '@/lib/api';
import { log } from '@/lib/log';
import { mensajeDeError, supabase } from '@/lib/supabaseClient';
import type { Mensaje } from '@/types/modelos';

const MAX_CARACTERES = 2000;

export function useChat(matchId: string, usuarioId: string) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conectado, setConectado] = useState(false);
  const montado = useRef(true);

  /** Evita duplicados cuando el eco de Realtime llega tras el insert local. */
  const fusionar = useCallback((entrantes: Mensaje[]) => {
    setMensajes((previos) => {
      const porId = new Map(previos.map((m) => [m.id, m]));
      for (const m of entrantes) porId.set(m.id, m);
      return [...porId.values()].sort((a, b) =>
        a.creado_en < b.creado_en ? -1 : a.creado_en > b.creado_en ? 1 : 0,
      );
    });
  }, []);

  useEffect(() => {
    montado.current = true;

    void (async () => {
      try {
        const historial = await listarMensajes(matchId);
        if (!montado.current) return;
        fusionar(historial);
        setError(null);
        await marcarLeidos(matchId, usuarioId);
      } catch (e) {
        if (montado.current) setError(mensajeDeError(e));
      } finally {
        if (montado.current) setCargando(false);
      }
    })();

    const canal = supabase
      .channel(`chat:${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => {
          const nuevo = payload.new as Mensaje;
          log.info('realtime', 'mensaje entrante', {
            id: nuevo.id,
            propio: nuevo.remitente_id === usuarioId,
          });
          fusionar([nuevo]);
          if (nuevo.remitente_id !== usuarioId) {
            void marcarLeidos(matchId, usuarioId).catch(() => undefined);
          }
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'mensajes',
          filter: `match_id=eq.${matchId}`,
        },
        (payload) => fusionar([payload.new as Mensaje]),
      )
      .subscribe((estado) => {
        log.info('realtime', `chat:${matchId} → ${estado}`);
        if (montado.current) setConectado(estado === 'SUBSCRIBED');
      });

    return () => {
      montado.current = false;
      void supabase.removeChannel(canal);
    };
  }, [matchId, usuarioId, fusionar]);

  const enviar = useCallback(
    async (texto: string): Promise<boolean> => {
      const contenido = texto.trim().slice(0, MAX_CARACTERES);
      if (!contenido || enviando) return false;

      setEnviando(true);
      try {
        const creado = await enviarMensaje(matchId, usuarioId, contenido);
        fusionar([creado]);
        setError(null);
        return true;
      } catch (e) {
        setError(mensajeDeError(e));
        return false;
      } finally {
        if (montado.current) setEnviando(false);
      }
    },
    [matchId, usuarioId, enviando, fusionar],
  );

  return { mensajes, cargando, enviando, conectado, error, enviar, MAX_CARACTERES };
}
