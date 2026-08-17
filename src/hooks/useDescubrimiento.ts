import { useCallback, useEffect, useRef, useState } from 'react';

import { cuotaSwipesRestante, descubrirPerfiles, registrarSwipe } from '@/lib/api';
import { log } from '@/lib/log';
import { mensajeDeError } from '@/lib/supabaseClient';
import type { AccionSwipe, Candidato } from '@/types/modelos';

const RADIO_KM = 50;
const LOTE = 20;
/** Recargamos antes de vaciar la pila para que no se vea el hueco. */
const UMBRAL_RECARGA = 4;

export function useDescubrimiento() {
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nombreDelMatch, setNombreDelMatch] = useState<string | null>(null);
  const [cuota, setCuota] = useState<number | null>(null);

  const cargandoRef = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const cargar = useCallback(async (reiniciar: boolean) => {
    if (cargandoRef.current) return;
    cargandoRef.current = true;
    if (reiniciar) setCargando(true);

    try {
      const [nuevos, restantes] = await Promise.all([
        descubrirPerfiles(RADIO_KM, LOTE),
        cuotaSwipesRestante().catch(() => null),
      ]);
      if (!montado.current) return;
      setCuota(restantes);

      setCandidatos((previos) => {
        if (reiniciar) return nuevos;
        // El backend ya excluye lo swipeado, pero una recarga en vuelo
        // puede solaparse con la pila actual.
        const yaEnPila = new Set(previos.map((c) => c.id));
        return [...previos, ...nuevos.filter((c) => !yaEnPila.has(c.id))];
      });
      setError(null);
    } catch (e) {
      if (montado.current) setError(mensajeDeError(e));
    } finally {
      cargandoRef.current = false;
      if (montado.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void cargar(true);
  }, [cargar]);

  /** Saca a alguien de la pila sin registrar swipe: lo usa bloquear/reportar. */
  const descartar = useCallback((id: string) => {
    setCandidatos((previos) => previos.filter((c) => c.id !== id));
  }, []);

  const swipe = useCallback(async (candidato: Candidato, accion: AccionSwipe) => {
    // Optimista: la tarjeta ya salió de pantalla con la animación.
    setCandidatos((previos) => previos.filter((c) => c.id !== candidato.id));

    try {
      const resultado = await registrarSwipe(candidato.id, accion);
      if (!montado.current) return;
      setCuota((c) => (c === null || c > 1000 ? c : Math.max(0, c - 1)));
      if (resultado.hayMatch) setNombreDelMatch(candidato.nombre);
    } catch (e) {
      log.error('descubrimiento', 'swipe rechazado, devolvemos la tarjeta', {
        candidato: candidato.id,
      });
      if (montado.current) {
        setCandidatos((previos) => [candidato, ...previos]);
        setError(mensajeDeError(e));
      }
    }
  }, []);

  // Rellena la pila cuando queda poco, sin bloquear la UI.
  useEffect(() => {
    if (!cargando && candidatos.length > 0 && candidatos.length <= UMBRAL_RECARGA) {
      void cargar(false);
    }
  }, [candidatos.length, cargando, cargar]);

  return {
    candidatos,
    cargando,
    error,
    nombreDelMatch,
    cerrarAvisoMatch: () => setNombreDelMatch(null),
    recargar: () => cargar(true),
    swipe,
    descartar,
    cuota,
  };
}
