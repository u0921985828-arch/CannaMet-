import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvisoMatch } from '@/componentes/AvisoMatch';
import { AvisoCuota } from '@/componentes/AvisosCuenta';
import { ModalReporte } from '@/componentes/ModalReporte';
import { AvisoError, Cargando, Vacio } from '@/componentes/Estados';
import { Pila, type PilaRef } from '@/componentes/Pila';
import { useDescubrimiento } from '@/hooks/useDescubrimiento';
import type { ParamsRaiz } from '@/navegacion/tipos';
import type { AccionSwipe } from '@/types/modelos';

type Navegacion = NativeStackNavigationProp<ParamsRaiz>;

function BotonAccion({
  texto,
  accion,
  onPress,
}: {
  texto: string;
  accion: AccionSwipe;
  onPress: () => void;
}) {
  const esLike = accion === 'like';
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={esLike ? 'Me interesa' : 'Pasar'}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1, flex: 1 })}
    >
      <View
        className={`min-h-16 items-center justify-center rounded-pieza border px-3 py-4 ${
          esLike ? 'border-ambar bg-ambarSuave' : 'border-borde2 bg-superficie'
        }`}
      >
        <Text
          className={`font-mono text-cuerpo tracking-[4px] ${
            esLike ? 'text-ambar' : 'text-tinta2'
          }`}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {texto}
        </Text>
      </View>
    </Pressable>
  );
}

export function DescubrirScreen() {
  const navegacion = useNavigation<Navegacion>();
  const pila = useRef<PilaRef>(null);
  const {
    candidatos,
    cargando,
    error,
    nombreDelMatch,
    cerrarAvisoMatch,
    recargar,
    swipe,
    descartar,
    cuota,
  } = useDescubrimiento();
  const [reportando, setReportando] = useState(false);

  const visible = candidatos[0] ?? null;

  if (cargando) return <Cargando texto="Buscando gente cerca" />;

  const hayCandidatos = candidatos.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top']}>
      <View className="flex-row items-baseline justify-between px-gutter pb-4 pt-2">
        <Text className="font-display text-titulo text-tinta">Cerca de ti</Text>
        <Text className="font-mono text-etiqueta uppercase text-apagado">
          {hayCandidatos ? `${candidatos.length} en cola` : '—'}
        </Text>
      </View>

      <AvisoCuota restantes={cuota} />

      {error ? (
        <View className="px-gutter">
          <AvisoError mensaje={error} />
        </View>
      ) : null}

      {hayCandidatos ? (
        <>
          <View className="flex-1 px-gutter pb-4">
            <Pila ref={pila} candidatos={candidatos} onSwipe={swipe} />
          </View>

          <View className="flex-row gap-3 px-gutter pb-6">
            <BotonAccion
              texto="NO"
              accion="dislike"
              onPress={() => pila.current?.lanzar('dislike')}
            />
            <BotonAccion
              texto="SÍ"
              accion="like"
              onPress={() => pila.current?.lanzar('like')}
            />
          </View>

          <View className="flex-row items-center justify-center gap-4 pb-4">
            <Text className="font-mono text-[10px] uppercase text-apagado">
              Arrastra la tarjeta
            </Text>
            <Text className="font-mono text-[10px] text-borde2">·</Text>
            <Pressable
              onPress={() => setReportando(true)}
              accessibilityRole="button"
              accessibilityLabel={`Reportar a ${visible?.nombre ?? ''}`}
              hitSlop={10}
            >
              <Text className="font-mono text-[10px] uppercase text-apagado underline">
                Reportar
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Vacio
          titulo="No queda nadie por ver"
          descripcion="Has pasado por todos los perfiles en 50 km. Vuelve más tarde: entra gente nueva cada día."
          accion={{ titulo: 'Buscar otra vez', onPress: recargar }}
        />
      )}

      {visible ? (
        <ModalReporte
          visible={reportando}
          usuarioId={visible.id}
          nombre={visible.nombre}
          onCerrar={() => setReportando(false)}
          onBloqueado={() => {
            setReportando(false);
            descartar(visible.id);
          }}
        />
      ) : null}

      <AvisoMatch
        nombre={nombreDelMatch}
        onSeguir={cerrarAvisoMatch}
        onAbrirChats={() => {
          cerrarAvisoMatch();
          navegacion.navigate('Tabs', { screen: 'Chats' });
        }}
      />
    </SafeAreaView>
  );
}
