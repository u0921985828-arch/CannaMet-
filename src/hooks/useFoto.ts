import { useCallback, useState } from 'react';

import { elegirFoto, fijarFoto, quitarFoto, subirFoto } from '@/lib/fotos';
import { mensajeDeError } from '@/lib/supabaseClient';

/**
 * Elegir, subir y quitar la foto de perfil.
 *
 * Devuelve la ruta nueva en vez de escribirla en el contexto: quien llama
 * decide cuándo darla por buena, que en el alta es al terminar y en el perfil
 * es en el momento.
 */
export function useFoto(usuarioId: string, apuntarEnElPerfil = true) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subir = useCallback(async (): Promise<string | null> => {
    setError(null);
    const elegida = await elegirFoto();
    // Cancelar no es un error: no hay nada que decirle a nadie.
    if (!elegida) return null;

    setOcupado(true);
    try {
      const ruta = await subirFoto(usuarioId, elegida);
      // En el alta el perfil todavia no existe: se apunta al terminar.
      if (apuntarEnElPerfil) await fijarFoto(ruta);
      return ruta;
    } catch (e) {
      setError(mensajeDeError(e));
      return null;
    } finally {
      setOcupado(false);
    }
  }, [usuarioId, apuntarEnElPerfil]);

  const quitar = useCallback(async (rutaActual: string | null): Promise<boolean> => {
    setOcupado(true);
    setError(null);
    try {
      await quitarFoto(rutaActual);
      return true;
    } catch (e) {
      setError(mensajeDeError(e));
      return false;
    } finally {
      setOcupado(false);
    }
  }, []);

  return { subir, quitar, ocupado, error };
}
