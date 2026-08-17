import React, { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react';
import { Dimensions, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { TarjetaPerfil } from './TarjetaPerfil';
import type { AccionSwipe, Candidato } from '@/types/modelos';

const { width: ANCHO } = Dimensions.get('window');
const UMBRAL = ANCHO * 0.28;
const SALIDA = ANCHO * 1.6;
const MAX_VISIBLES = 3;

export type PilaRef = {
  lanzar: (accion: AccionSwipe) => void;
};

type Props = {
  candidatos: Candidato[];
  onSwipe: (candidato: Candidato, accion: AccionSwipe) => void;
};

/** Sello girado que aparece al arrastrar: "SÍ" a la derecha, "NO" a la izquierda. */
function Sello({ texto, color }: { texto: string; color: 'ambar' | 'arcilla' }) {
  return (
    <View
      className={`rounded-tarjeta border-[3px] px-5 py-2 ${
        color === 'ambar' ? 'border-ambar' : 'border-arcilla'
      }`}
    >
      <Text
        className={`font-mono text-titulo tracking-[6px] ${
          color === 'ambar' ? 'text-ambar' : 'text-arcilla'
        }`}
      >
        {texto}
      </Text>
    </View>
  );
}

export const Pila = forwardRef<PilaRef, Props>(function Pila({ candidatos, onSwipe }, ref) {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  const visibles = candidatos.slice(0, MAX_VISIBLES);
  const superior = visibles[0];
  const idSuperior = superior?.id ?? null;

  // Cada vez que cambia la tarjeta de arriba, la posición vuelve al centro.
  useEffect(() => {
    x.value = 0;
    y.value = 0;
  }, [idSuperior, x, y]);

  const resolver = useCallback(
    (accion: AccionSwipe) => {
      if (superior) onSwipe(superior, accion);
    },
    [superior, onSwipe],
  );

  const lanzar = useCallback(
    (accion: AccionSwipe) => {
      if (!superior) return;
      const destino = accion === 'like' ? SALIDA : -SALIDA;
      x.value = withTiming(destino, { duration: 220 }, (terminado) => {
        if (terminado) runOnJS(resolver)(accion);
      });
    },
    [superior, resolver, x],
  );

  useImperativeHandle(ref, () => ({ lanzar }), [lanzar]);

  const pan = Gesture.Pan()
    .enabled(!!superior)
    .onChange((e) => {
      x.value += e.changeX;
      y.value += e.changeY;
    })
    .onEnd((e) => {
      const rebasa = Math.abs(x.value) > UMBRAL || Math.abs(e.velocityX) > 900;
      if (!rebasa) {
        x.value = withSpring(0, { damping: 18, stiffness: 180 });
        y.value = withSpring(0, { damping: 18, stiffness: 180 });
        return;
      }
      const accion: AccionSwipe = x.value > 0 ? 'like' : 'dislike';
      const destino = accion === 'like' ? SALIDA : -SALIDA;
      x.value = withTiming(destino, { duration: 200 }, (terminado) => {
        if (terminado) runOnJS(resolver)(accion);
      });
    });

  const estiloSuperior = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      {
        rotate: `${interpolate(x.value, [-ANCHO, 0, ANCHO], [-11, 0, 11], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const estiloSelloSi = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [20, UMBRAL], [0, 1], Extrapolation.CLAMP),
  }));

  const estiloSelloNo = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [-UMBRAL, -20], [1, 0], Extrapolation.CLAMP),
  }));

  return (
    <View className="flex-1">
      {/* De atrás hacia delante: la última del array se pinta primero */}
      {visibles
        .map((candidato, indice) => ({ candidato, indice }))
        .reverse()
        .map(({ candidato, indice }) => {
          const esSuperior = indice === 0;
          const desfase = indice * 10;
          const escala = 1 - indice * 0.04;

          if (!esSuperior) {
            return (
              <View
                key={candidato.id}
                className="absolute inset-0"
                pointerEvents="none"
                style={{
                  transform: [{ translateY: desfase }, { scale: escala }],
                  opacity: 0.55,
                }}
              >
                <TarjetaPerfil candidato={candidato} />
              </View>
            );
          }

          return (
            <GestureDetector key={candidato.id} gesture={pan}>
              <Animated.View
                className="absolute inset-0"
                style={[
                  estiloSuperior,
                  {
                    shadowColor: '#D99B3C',
                    shadowOpacity: 0.18,
                    shadowRadius: 24,
                    shadowOffset: { width: 0, height: 8 },
                    elevation: 8,
                  },
                ]}
              >
                <TarjetaPerfil candidato={candidato} />

                <Animated.View
                  className="absolute left-6 top-8"
                  style={estiloSelloSi}
                  pointerEvents="none"
                >
                  <View style={{ transform: [{ rotate: '-14deg' }] }}>
                    <Sello texto="SÍ" color="ambar" />
                  </View>
                </Animated.View>

                <Animated.View
                  className="absolute right-6 top-8"
                  style={estiloSelloNo}
                  pointerEvents="none"
                >
                  <View style={{ transform: [{ rotate: '14deg' }] }}>
                    <Sello texto="NO" color="arcilla" />
                  </View>
                </Animated.View>
              </Animated.View>
            </GestureDetector>
          );
        })}
    </View>
  );
});
