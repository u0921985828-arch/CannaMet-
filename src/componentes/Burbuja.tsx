import React from 'react';
import { Text, View } from 'react-native';

import { horaCorta } from '@/lib/formato';
import type { Mensaje } from '@/types/modelos';

type Props = {
  mensaje: Mensaje;
  propio: boolean;
};

export function Burbuja({ mensaje, propio }: Props) {
  return (
    <View className={`mb-2 px-gutter ${propio ? 'items-end' : 'items-start'}`}>
      <View
        className={`max-w-[82%] rounded-pieza px-4 py-3 ${
          propio
            ? 'border border-ambarProfundo bg-ambarSuave'
            : 'border border-borde bg-superficie'
        }`}
      >
        <Text className="font-sans text-cuerpo text-tinta">{mensaje.contenido}</Text>

        <View className="mt-1.5 flex-row items-center justify-end gap-1.5">
          <Text className="font-mono text-[10px] text-apagado">
            {horaCorta(mensaje.creado_en)}
          </Text>
          {propio ? (
            <Text
              className={`font-mono text-[10px] ${
                mensaje.leido ? 'text-ambar' : 'text-apagado'
              }`}
              accessibilityLabel={mensaje.leido ? 'Leído' : 'Enviado'}
            >
              {mensaje.leido ? 'leído' : 'enviado'}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function SeparadorDia({ texto }: { texto: string }) {
  return (
    <View className="my-4 flex-row items-center gap-3 px-gutter">
      <View className="h-px flex-1 bg-borde" />
      <Text className="font-mono text-etiqueta uppercase text-apagado">{texto}</Text>
      <View className="h-px flex-1 bg-borde" />
    </View>
  );
}
