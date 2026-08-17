import { useCallback, useEffect, useRef, useState } from 'react';

import {
  bloquearUsuario,
  desbloquearUsuario,
  listarBloqueados,
  reportarUsuario,
} from '@/lib/api';
import { mensajeDeError } from '@/lib/supabaseClient';
import type { Bloqueado, MotivoReporte } from '@/types/modelos';

/** Acciones puntuales sobre una persona concreta. */
export function useModeracion() {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ejecutar = useCallback(async (fn: () => Promise<void>): Promise<boolean> => {
    setOcupado(true);
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(mensajeDeError(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }, []);

  return {
    ocupado,
    error,
    limpiarError: () => setError(null),
    bloquear: (id: string) => ejecutar(() => bloquearUsuario(id)),
    desbloquear: (id: string) => ejecutar(() => desbloquearUsuario(id)),
    reportar: (
      id: string,
      motivo: MotivoReporte,
      detalle: string | null,
      bloquear: boolean,
    ) => ejecutar(() => reportarUsuario(id, motivo, detalle, bloquear)),
  };
}

/** Lista de personas bloqueadas, para la pantalla de perfil. */
export function useBloqueados() {
  const [bloqueados, setBloqueados] = useState<Bloqueado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const montado = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const filas = await listarBloqueados();
      if (!montado.current) return;
      setBloqueados(filas);
      setError(null);
    } catch (e) {
      if (montado.current) setError(mensajeDeError(e));
    } finally {
      if (montado.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    montado.current = true;
    void cargar();
    return () => {
      montado.current = false;
    };
  }, [cargar]);

  return { bloqueados, cargando, error, recargar: cargar };
}
