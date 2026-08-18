import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { C } from '@/theme/tokens';

type Variante = 'primario' | 'secundario' | 'fantasma';

type Props = {
  titulo: string;
  onPress: () => void;
  variante?: Variante;
  cargando?: boolean;
  deshabilitado?: boolean;
  ancho?: boolean;
};

const ESTILOS: Record<Variante, { caja: string; texto: string }> = {
  primario: { caja: 'bg-ambar border-ambar', texto: 'text-base' },
  secundario: { caja: 'bg-transparent border-borde2', texto: 'text-tinta' },
  fantasma: { caja: 'bg-transparent border-transparent', texto: 'text-apagado' },
};

export function Boton({
  titulo,
  onPress,
  variante = 'primario',
  cargando = false,
  deshabilitado = false,
  ancho = true,
}: Props) {
  const inactivo = deshabilitado || cargando;
  const estilo = ESTILOS[variante];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactivo}
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: inactivo, busy: cargando }}
      style={({ pressed }) => ({ opacity: inactivo ? 0.45 : pressed ? 0.75 : 1 })}
    >
      {/* `min-h-14` y no `h-14`: con altura fija, un titulo de dos lineas se
          recortaba por abajo en vez de hacer crecer el boton. */}
      <View
        className={`min-h-14 flex-row items-center justify-center rounded-pieza border px-5 py-3 ${estilo.caja} ${ancho ? 'w-full' : ''}`}
      >
        {cargando ? (
          <ActivityIndicator color={variante === 'primario' ? C.base : C.ambar} />
        ) : (
          <Text
            className={`shrink text-center font-sansFuerte text-cuerpo ${estilo.texto}`}
            numberOfLines={2}
          >
            {titulo}
          </Text>
        )}
      </View>
    </Pressable>
  );
}
