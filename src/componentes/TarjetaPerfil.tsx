import React from 'react';
import { Text, View } from 'react-native';

import { distanciaLegible } from '@/lib/formato';
import { etiquetaAmbiente, type Candidato } from '@/types/modelos';

/** La cabecera dice algo útil de un vistazo, no un número de orden vacío. */
function banda(km: number): string {
  if (km < 2) return 'aquí al lado';
  if (km < 10) return 'en tu zona';
  return 'más lejos';
}

function Fila({ clave, valor }: { clave: string; valor: string }) {
  return (
    <View className="flex-row items-baseline py-2">
      <Text className="w-28 font-mono text-etiqueta uppercase text-apagado">{clave}</Text>
      <Text className="flex-1 font-monoMedia text-cuerpo text-tinta">{valor}</Text>
    </View>
  );
}

export function TarjetaPerfil({ candidato }: { candidato: Candidato }) {
  return (
    <View className="flex-1 overflow-hidden rounded-tarjeta border border-borde2 bg-superficie">
      {/* Doble regla superior: el marco de una etiqueta impresa */}
      <View className="h-[3px] bg-ambarProfundo" />
      <View className="h-px bg-borde2" />

      <View className="flex-1 px-6 pb-6 pt-7">
        <Text className="font-mono text-etiqueta uppercase text-ambar">
          {banda(candidato.distancia_km)}
        </Text>

        <Text
          className="mt-3 font-display text-display text-tinta"
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {candidato.nombre}
        </Text>

        <View className="mt-6 h-px bg-borde" />
        <Fila clave="Edad" valor={`${candidato.edad}`} />
        <View className="h-px bg-borde" />
        <Fila clave="Distancia" valor={distanciaLegible(candidato.distancia_km)} />
        <View className="h-px bg-borde" />
        <Fila clave="Ambiente" valor={etiquetaAmbiente(candidato.ambiente)} />
        <View className="h-px bg-borde" />

        <View className="mt-6 flex-1">
          {candidato.bio ? (
            <Text className="font-displayItalic text-cuerpoL leading-7 text-tinta2">
              {candidato.bio}
            </Text>
          ) : (
            <Text className="font-sans text-cuerpo text-apagado">
              Todavía no ha escrito nada sobre sí.
            </Text>
          )}
        </View>
      </View>

      <View className="h-px bg-borde2" />
      <View className="h-[3px] bg-ambarProfundo" />
    </View>
  );
}
