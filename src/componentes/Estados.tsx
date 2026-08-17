import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Boton } from './Boton';
import { C } from '@/theme/tokens';

export function Cargando({ texto }: { texto?: string }) {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-base">
      <ActivityIndicator color={C.ambar} size="large" />
      {texto ? (
        <Text className="font-mono text-etiqueta uppercase text-apagado">{texto}</Text>
      ) : null}
    </View>
  );
}

type PropsVacio = {
  titulo: string;
  descripcion: string;
  accion?: { titulo: string; onPress: () => void };
};

export function Vacio({ titulo, descripcion, accion }: PropsVacio) {
  return (
    <View className="flex-1 items-center justify-center px-10">
      {/* Marca de agua: dos reglas finas, como el borde de una etiqueta de tarro */}
      <View className="mb-6 h-px w-16 bg-borde2" />
      <Text className="text-center font-display text-titulo text-tinta">{titulo}</Text>
      <Text className="mt-3 text-center font-sans text-cuerpo text-apagado">
        {descripcion}
      </Text>
      <View className="mt-6 h-px w-16 bg-borde2" />

      {accion ? (
        <View className="mt-8 w-full">
          <Boton titulo={accion.titulo} onPress={accion.onPress} variante="secundario" />
        </View>
      ) : null}
    </View>
  );
}

export function AvisoError({ mensaje }: { mensaje: string }) {
  return (
    <View className="mb-4 rounded-pieza border border-arcilla bg-superficie px-4 py-3">
      <Text className="font-mono text-etiqueta uppercase text-arcilla">Error</Text>
      <Text className="mt-1 font-sans text-dato text-tinta2">{mensaje}</Text>
    </View>
  );
}
