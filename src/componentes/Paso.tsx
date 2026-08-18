import React from 'react';
import { Text, View } from 'react-native';

type Props = {
  /** Empieza en 0. */
  indice: number;
  total: number;
  titulo: string;
  descripcion?: string;
  children: React.ReactNode;
};

/**
 * Cabecera de un paso del alta: cuántos quedan, qué se pide y por qué.
 *
 * El progreso son segmentos y no una barra continua: con cinco pasos, saber
 * que quedan dos concretos tranquiliza más que un 60 % abstracto.
 */
export function Paso({ indice, total, titulo, descripcion, children }: Props) {
  return (
    <View className="flex-1">
      <View className="mb-8">
        <View className="flex-row gap-1.5" accessibilityRole="progressbar">
          {Array.from({ length: total }, (_, i) => (
            <View
              key={i}
              className={`h-[3px] flex-1 ${i <= indice ? 'bg-ambar' : 'bg-borde'}`}
            />
          ))}
        </View>

        <Text className="mt-5 font-mono text-etiqueta uppercase text-apagado">
          Paso {indice + 1} de {total}
        </Text>

        <Text className="mt-3 font-display text-titulo text-tinta">{titulo}</Text>

        {descripcion ? (
          <Text className="mt-3 font-sans text-cuerpo text-tinta2">{descripcion}</Text>
        ) : null}
      </View>

      {children}
    </View>
  );
}
