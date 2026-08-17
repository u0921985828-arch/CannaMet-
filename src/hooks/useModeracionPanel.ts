import { useCallback, useEffect, useRef, useState } from 'react';

import {
  cargarColaApelaciones,
  cargarColaModeracion,
  resolverApelacion,
  resolverCaso,
  soyModerador,
} from '@/lib/api';
import { mensajeDeError } from '@/lib/supabaseClient';
import type { ApelacionEnCola, CasoModeracion, EstadoReporte } from '@/types/modelos';

/** Determina si el usuario ve la pestaña de moderación. */
export function useEsModerador() {
  const [esModerador, setEsModerador] = useState(false);
  const [comprobado, setComprobado] = useState(false);

  useEffect(() => {
    let vivo = true;
    void soyModerador()
      .then((r) => {
        if (vivo) setEsModerador(r);
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setComprobado(true);
      });
    return () => {
      vivo = false;
    };
  }, []);

  return { esModerador, comprobado };
}

export function useColaModeracion() {
  const [casos, setCasos] = useState<CasoModeracion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [resolviendo, setResolviendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const montado = useRef(true);

  const cargar = useCallback(async (esRefresco = false) => {
    if (esRefresco) setRefrescando(true);
    try {
      const filas = await cargarColaModeracion();
      if (!montado.current) return;
      setCasos(filas);
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
    return () => {
      montado.current = false;
    };
  }, [cargar]);

  const resolver = useCallback(
    async (
      reporteId: string,
      estado: EstadoReporte,
      dias: number | null,
      nota: string | null,
    ): Promise<boolean> => {
      setResolviendo(reporteId);
      try {
        await resolverCaso(reporteId, estado, dias, nota);
        if (montado.current) setCasos((prev) => prev.filter((c) => c.id !== reporteId));
        return true;
      } catch (e) {
        if (montado.current) setError(mensajeDeError(e));
        return false;
      } finally {
        if (montado.current) setResolviendo(null);
      }
    },
    [],
  );

  return {
    casos,
    cargando,
    refrescando,
    resolviendo,
    error,
    refrescar: () => cargar(true),
    resolver,
  };
}

export function useColaApelaciones() {
  const [apelaciones, setApelaciones] = useState<ApelacionEnCola[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const montado = useRef(true);

  const cargar = useCallback(async () => {
    try {
      const filas = await cargarColaApelaciones();
      if (!montado.current) return;
      setApelaciones(filas);
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

  const resolver = useCallback(
    async (id: string, aceptar: boolean, nota: string | null): Promise<boolean> => {
      try {
        await resolverApelacion(id, aceptar, nota);
        if (montado.current) setApelaciones((prev) => prev.filter((a) => a.id !== id));
        return true;
      } catch (e) {
        if (montado.current) setError(mensajeDeError(e));
        return false;
      }
    },
    [],
  );

  return { apelaciones, cargando, error, recargar: cargar, resolver };
}
