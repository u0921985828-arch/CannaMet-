import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';

import { useSesion } from '@/contexts/SesionContext';
import { activarAvisos } from '@/lib/notificaciones';
import { log } from '@/lib/log';
import { refNavegacion } from '@/navegacion/ref';
import type { DatosAviso } from '@/types/modelos';

/** Abre la conversación del aviso, si el aviso trae una. */
function abrirDesdeAviso(datos: DatosAviso): void {
  if (!datos.match_id || !datos.otro_id) return;
  if (!refNavegacion.isReady()) return;

  refNavegacion.navigate('Chat', {
    matchId: datos.match_id,
    otroId: datos.otro_id,
    nombre: datos.nombre ?? 'Chat',
  });
}

/**
 * Activa los avisos push una vez por cuenta y escucha los toques.
 *
 * El permiso se pide con el perfil ya creado, no al abrir la app: preguntarlo
 * antes de que nadie sepa qué es esto se traduce en un "no" casi seguro, y en
 * iOS ese "no" solo se puede deshacer desde los Ajustes del sistema.
 */
export function useAvisos(): void {
  const { usuarioId, perfil } = useSesion();
  const activadoPara = useRef<string | null>(null);

  useEffect(() => {
    if (!usuarioId || !perfil) return;
    if (activadoPara.current === usuarioId) return;
    activadoPara.current = usuarioId;
    void activarAvisos();
  }, [usuarioId, perfil]);

  useEffect(() => {
    // La app estaba cerrada y se ha abierto tocando el aviso.
    void Notifications.getLastNotificationResponseAsync().then((respuesta) => {
      if (!respuesta) return;
      abrirDesdeAviso((respuesta.notification.request.content.data ?? {}) as DatosAviso);
    });

    const sub = Notifications.addNotificationResponseReceivedListener((respuesta) => {
      log.info('avisos', 'aviso tocado');
      abrirDesdeAviso((respuesta.notification.request.content.data ?? {}) as DatosAviso);
    });

    return () => sub.remove();
  }, []);
}
