import React from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';

import { C } from '@/theme/tokens';

type Props = TextInputProps & {
  etiqueta: string;
  error?: string;
  contador?: { actual: number; maximo: number };
};

export function Campo({ etiqueta, error, contador, style, ...resto }: Props) {
  return (
    <View className="mb-5">
      <View className="mb-2 flex-row items-baseline justify-between">
        <Text className="font-mono text-etiqueta uppercase text-apagado">{etiqueta}</Text>
        {contador ? (
          <Text
            className={`font-mono text-etiqueta ${
              contador.actual > contador.maximo ? 'text-arcilla' : 'text-apagado'
            }`}
          >
            {contador.actual}/{contador.maximo}
          </Text>
        ) : null}
      </View>

      <TextInput
        placeholderTextColor={C.apagado}
        selectionColor={C.ambar}
        accessibilityLabel={etiqueta}
        className={`rounded-pieza border bg-superficie px-4 py-4 font-sans text-cuerpoL text-tinta ${
          error ? 'border-arcilla' : 'border-borde'
        }`}
        style={style}
        {...resto}
      />

      {error ? (
        <Text className="mt-2 font-sans text-dato text-arcilla">{error}</Text>
      ) : null}
    </View>
  );
}
