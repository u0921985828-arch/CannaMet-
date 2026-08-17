import React from 'react';
import { Text, View } from 'react-native';

/** Cuota visible solo mientras exista: en cuanto no aplica, desaparece. */
export function AvisoCuota({ restantes }: { restantes: number | null }) {
  if (restantes === null || restantes > 1000) return null;

  return (
    <View className="mx-gutter mb-3 rounded-pieza border border-borde bg-superficie px-4 py-3">
      <Text className="font-sans text-dato text-tinta2">
        {restantes > 0
          ? `Te quedan ${restantes} perfiles hoy. El límite se levanta cuando la cuenta cumple 24 horas.`
          : 'Has llegado al límite de hoy. Vuelve mañana o espera a que la cuenta cumpla 24 horas.'}
      </Text>
    </View>
  );
}
