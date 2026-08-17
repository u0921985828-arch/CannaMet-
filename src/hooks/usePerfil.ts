import { useCallback, useState } from 'react';

import { edadDe } from '@/componentes/CampoFechaNacimiento';

import { useSesion } from '@/contexts/SesionContext';
import { guardarPerfil, type DatosPerfil } from '@/lib/api';
import { mensajeDeError } from '@/lib/supabaseClient';

export type ErroresPerfil = Partial<Record<'nombre' | 'fecha' | 'bio', string>>;

/**
 * Mismas reglas que los CHECK de la tabla y que guardar_perfil().
 * Validar aquí evita un viaje; el corte real de 18 años está en el servidor.
 */
export function validarPerfil(
  nombre: string,
  fechaIso: string | null,
  bio: string,
): ErroresPerfil {
  const errores: ErroresPerfil = {};
  const n = nombre.trim();

  if (n.length < 2) errores.nombre = 'Escribe al menos 2 caracteres.';
  else if (n.length > 40) errores.nombre = 'Máximo 40 caracteres.';

  if (!fechaIso) {
    errores.fecha = 'Revisa la fecha: no existe.';
  } else {
    const edad = edadDe(fechaIso);
    if (edad < 18) errores.fecha = 'MATCH es solo para mayores de 18 años.';
    else if (edad > 120) errores.fecha = 'Revisa el año.';
  }

  if (bio.length > 500) errores.bio = 'Máximo 500 caracteres.';

  return errores;
}

export function usePerfil() {
  const { perfil, fijarPerfil } = useSesion();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = useCallback(
    async (datos: DatosPerfil): Promise<boolean> => {
      setGuardando(true);
      setError(null);
      try {
        const fila = await guardarPerfil(datos);
        // guardar_perfil no devuelve el estado de suspension: conservamos el
        // que ya teniamos en vez de inventarlo.
        fijarPerfil({
          id: fila.id,
          nombre: fila.nombre,
          edad: fila.edad,
          bio: fila.bio,
          ambiente: fila.ambiente,
          creado_en: perfil?.creado_en ?? fila.actualizado_en,
          actualizado_en: fila.actualizado_en,
          suspendido_hasta: perfil?.suspendido_hasta ?? null,
          suspension_motivo: perfil?.suspension_motivo ?? null,
          fecha_nacimiento: datos.fechaNacimiento,
        });
        return true;
      } catch (e) {
        setError(mensajeDeError(e));
        return false;
      } finally {
        setGuardando(false);
      }
    },
    [perfil, fijarPerfil],
  );

  return { guardar, guardando, error, limpiarError: () => setError(null) };
}
