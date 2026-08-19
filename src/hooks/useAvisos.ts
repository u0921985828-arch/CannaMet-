import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useRef } from 'react';

import { useSesion } from '@/contexts/SesionContext';
import { log } from '@/lib/log';
import { activarAvisos } from '@/lib/notificaciones';
import { refNavegacion } from '@/navegacion/ref';
import type { DatosAviso } from '@/types/modelos';

type Avisos = {
  /** Se pasa al `onReady` del NavigationContainer. */
  alEstarListoElNavegador: () => void;
};

/**
 * Activa los avisos push una vez por cuenta y escucha los toques.
 *
 * El permiso se pide con el perfil ya creado, no al abrir la app: preguntarlo
 * antes de que nadie sepa qué es esto se traduce en un "no" casi seguro, y en
 * iOS ese "no" solo se puede deshacer desde los Ajustes del sistema.
 */
export function useAvisos(): Avisos {
  const { usuarioId, perfil } = useSesion();
  const activadoPara = useRef<string | null>(null);

  /**
   * Aviso tocado con la app cerrada: cuando se lee, el navegador todavía no
   * existe —RootNavigator sigue pintando <Cargando>—, así que se guarda aquí
   * hasta que esté montado. Sin esto, abrir la app desde un push llevaba a la
   * pantalla de siempre y el aviso se perdía sin rastro.
   */
  const pendiente = useRef<DatosAviso | null>(null);

  const abrirDesdeAviso = useCallback((datos: DatosAviso) => {
    if (!datos.match_id || !datos.otro_id) return;

    if (!refNavegacion.isReady()) {
      pendiente.current = datos;
      return;
    }

    refNavegacion.navigate('Chat', {
      matchId: datos.match_id,
      otroId: datos.otro_id,
      nombre: datos.nombre ?? 'Chat',
    });
  }, []);

  const alEstarListoElNavegador = useCallback(() => {
    const guardado = pendiente.current;
    pendiente.current = null;
    if (guardado) abrirDesdeAviso(guardado);
  }, [abrirDesdeAviso]);

  useEffect(() => {
    // Al cerrar sesión el navegador NO se desmonta: sigue vivo pintando la
    // pantalla de acceso. Sin este reinicio, volver a entrar con la misma
    // cuenta no registraba el aparato —que `desactivarAvisos` acababa de dar
    // de baja— y esa cuenta se quedaba sin un solo aviso hasta reiniciar.
    if (!usuarioId) {
      activadoPara.current = null;
      return;
    }
    if (!perfil) return;
    if (activadoPara.current === usuarioId) return;

    let cancelado = false;
    void activarAvisos().then((token) => {
      // Solo se da por hecho si de verdad hubo token: si fallo la red, el
      // siguiente refresco del perfil lo vuelve a intentar.
      if (!cancelado && token) activadoPara.current = usuarioId;
    });

    return () => {
      cancelado = true;
    };
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
  }, [abrirDesdeAviso]);

  return { alEstarListoElNavegador };
}
