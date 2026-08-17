import React from 'react';
import { Alert, Pressable, Text, View } from 'react-native';

import { AvisoError } from './Estados';
import { useBloqueados, useModeracion } from '@/hooks/useModeracion';

/**
 * Un bloqueo que no se puede deshacer es una trampa, no una protección:
 * la gente lo evita por miedo a equivocarse. Por eso vive aquí, a la vista.
 */
export function SeccionBloqueados() {
  const { bloqueados, cargando, error, recargar } = useBloqueados();
  const { desbloquear, ocupado } = useModeracion();

  const confirmar = (id: string, nombre: string) => {
    Alert.alert(`Desbloquear a ${nombre}`, 'Volveréis a poder veros y escribiros.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Desbloquear',
        onPress: () => {
          void desbloquear(id).then((ok) => {
            if (ok) void recargar();
          });
        },
      },
    ]);
  };

  if (cargando) return null;

  return (
    <View className="mb-6 rounded-pieza border border-borde bg-superficie p-5">
      <Text className="font-mono text-etiqueta uppercase text-apagado">
        Personas bloqueadas
      </Text>

      {error ? (
        <View className="mt-3">
          <AvisoError mensaje={error} />
        </View>
      ) : null}

      {bloqueados.length === 0 ? (
        <Text className="mt-2 font-sans text-dato text-apagado">
          No has bloqueado a nadie.
        </Text>
      ) : (
        <View className="mt-3">
          {bloqueados.map((b, i) => (
            <View key={b.id}>
              {i > 0 ? <View className="h-px bg-borde" /> : null}
              <View className="flex-row items-center justify-between py-3">
                <Text className="flex-1 font-sansMedia text-cuerpo text-tinta">
                  {b.nombre}
                </Text>
                <Pressable
                  onPress={() => confirmar(b.id, b.nombre)}
                  disabled={ocupado}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Desbloquear a ${b.nombre}`}
                  style={({ pressed }) => ({ opacity: ocupado ? 0.4 : pressed ? 0.6 : 1 })}
                >
                  <Text className="font-mono text-etiqueta uppercase text-ambar">
                    Desbloquear
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
