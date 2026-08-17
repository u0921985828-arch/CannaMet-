import { useCallback, useEffect, useRef, useState } from 'react';

import { listarMatches } from '@/lib/api';
import { log } from '@/lib/log';
import { mensajeDeError, supabase } from '@/lib/supabaseClient';
import type { ResumenMatch } from '@/types/modelos';

export function useMatches() {
  const [matches, setMatches] = useState<ResumenMatch[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const montado = useRef(true);

  const cargar = useCallback(async (esRefresco = false) => {
    if (esRefresco) setRefrescando(true);
    try {
      const filas = await listarMatches();
      if (!montado.current) return;
      setMatches(filas);
      setError(null);
    } catch (e) {
      if (montado.current) setError(mensajeDeError(e));
    } finally {
      if (montado.current) {
        setCargando(false);
        setRefrescando(false);
      }
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    void cargar();

    // La RLS filtra la entrega: solo llegan eventos de filas que puedes leer.
    const canal = supabase
      .channel('lista-matches')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'matches' },
        () => {
          log.info('realtime', 'match nuevo → recargando lista');
          void cargar();
        },
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mensajes' }, () => {
        // Cambia el último mensaje o el contador de no leídos.
        void cargar();
      })
      .subscribe((estado) => log.info('realtime', `lista-matches: ${estado}`));

    return () => {
      montado.current = false;
      void supabase.removeChannel(canal);
    };
  }, [cargar]);

  return {
    matches,
    cargando,
    refrescando,
    error,
    refrescar: () => cargar(true),
  };
}
