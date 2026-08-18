import React from 'react';
import { Pressable, Text, View } from 'react-native';

type Opcion<T extends string> = { valor: T; etiqueta: string };

type Props<T extends string> = {
  etiqueta: string;
  opciones: readonly Opcion<T>[];
  seleccion: T;
  onSeleccion: (valor: T) => void;
};

export function Opciones<T extends string>({
  etiqueta,
  opciones,
  seleccion,
  onSeleccion,
}: Props<T>) {
  return (
    <View className="mb-5">
      <Text className="mb-3 font-mono text-etiqueta uppercase text-apagado">
        {etiqueta}
      </Text>

      <View className="flex-row flex-wrap gap-2">
        {opciones.map((op) => {
          const activa = op.valor === seleccion;
          return (
            <Pressable
              key={op.valor}
              onPress={() => onSeleccion(op.valor)}
              accessibilityRole="radio"
              accessibilityState={{ selected: activa }}
              accessibilityLabel={op.etiqueta}
              // `flexShrink`: sin esto una etiqueta larga genera una pildora mas
              // ancha que la fila y el texto se corta por el borde derecho.
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flexShrink: 1 })}
            >
              <View
                className={`min-h-12 justify-center rounded-pastilla border px-4 py-3 ${
                  activa ? 'border-ambar bg-ambarSuave' : 'border-borde bg-superficie'
                }`}
              >
                <Text
                  className={`font-sansMedia text-cuerpo ${
                    activa ? 'text-ambar' : 'text-tinta2'
                  }`}
                >
                  {op.etiqueta}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
