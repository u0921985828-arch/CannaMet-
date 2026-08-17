import * as Location from 'expo-location';
import { useCallback, useState } from 'react';

import { log } from '@/lib/log';

export type Coordenadas = { lat: number; lng: number };

export type EstadoUbicacion = 'inicial' | 'pidiendo' | 'concedida' | 'denegada' | 'error';

export function useUbicacion() {
  const [estado, setEstado] = useState<EstadoUbicacion>('inicial');
  const [coords, setCoords] = useState<Coordenadas | null>(null);

  const solicitar = useCallback(async (): Promise<Coordenadas | null> => {
    setEstado('pidiendo');
    try {
      const permiso = await Location.requestForegroundPermissionsAsync();
      log.info('ubicacion', 'permiso', { estado: permiso.status });

      if (permiso.status !== Location.PermissionStatus.GRANTED) {
        setEstado('denegada');
        return null;
      }

      const posicion = await Location.getCurrentPositionAsync({
        // Balanced basta: mostramos distancia redondeada, no navegación.
        accuracy: Location.Accuracy.Balanced,
      });

      const c: Coordenadas = {
        lat: posicion.coords.latitude,
        lng: posicion.coords.longitude,
      };

      // No registramos las coordenadas: acabarían en los logs de Metro.
      log.info('ubicacion', 'posición obtenida', {
        precisionM: Math.round(posicion.coords.accuracy ?? 0),
      });

      setCoords(c);
      setEstado('concedida');
      return c;
    } catch (error) {
      log.error('ubicacion', 'fallo al obtener posición', {
        error: error instanceof Error ? error.message : String(error),
      });
      setEstado('error');
      return null;
    }
  }, []);

  return { estado, coords, solicitar };
}
