import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvisoError, Cargando, Vacio } from '@/componentes/Estados';
import { useMatches } from '@/hooks/useMatches';
import { fechaRelativa } from '@/lib/formato';
import type { ParamsRaiz } from '@/navegacion/tipos';
import { etiquetaAmbiente, type ResumenMatch } from '@/types/modelos';
import { C } from '@/theme/tokens';

type Navegacion = NativeStackNavigationProp<ParamsRaiz>;

function Fila({ match, onPress }: { match: ResumenMatch; onPress: () => void }) {
  const sinAbrir = match.no_leidos > 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Chat con ${match.otro_nombre}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <View className="flex-row items-center gap-4 px-gutter py-5">
        {/* Inicial como sello: no hay fotos en el modelo de datos */}
        <View
          className={`h-14 w-14 items-center justify-center rounded-tarjeta border ${
            sinAbrir ? 'border-ambar bg-ambarSuave' : 'border-borde bg-superficie'
          }`}
        >
          <Text
            className={`font-display text-titulo ${sinAbrir ? 'text-ambar' : 'text-tinta2'}`}
          >
            {match.otro_nombre.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View className="flex-1">
          <View className="flex-row items-baseline justify-between">
            <Text className="font-display text-cuerpoL text-tinta" numberOfLines={1}>
              {match.otro_nombre}
            </Text>
            <Text className="ml-3 font-mono text-[10px] uppercase text-apagado">
              {fechaRelativa(match.ultimo_mensaje_en ?? match.creado_en)}
            </Text>
          </View>

          <Text
            className={`mt-1 font-sans text-dato ${sinAbrir ? 'text-tinta' : 'text-apagado'}`}
            numberOfLines={1}
          >
            {match.ultimo_mensaje ??
              `${match.otro_edad} · ${etiquetaAmbiente(match.otro_ambiente)}`}
          </Text>
        </View>

        {sinAbrir ? (
          <View className="h-6 min-w-6 items-center justify-center rounded-pastilla bg-ambar px-2">
            <Text className="font-monoMedia text-[11px] text-base">{match.no_leidos}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function MatchesScreen() {
  const navegacion = useNavigation<Navegacion>();
  const { matches, cargando, refrescando, error, refrescar } = useMatches();

  if (cargando) return <Cargando texto="Cargando chats" />;

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top']}>
      <View className="px-gutter pb-2 pt-2">
        <Text className="font-display text-titulo text-tinta">Chats</Text>
      </View>

      {error ? (
        <View className="px-gutter">
          <AvisoError mensaje={error} />
        </View>
      ) : null}

      <FlatList
        data={matches}
        keyExtractor={(m) => m.match_id}
        ItemSeparatorComponent={() => <View className="ml-[84px] h-px bg-borde" />}
        contentContainerStyle={matches.length === 0 ? { flexGrow: 1 } : undefined}
        refreshControl={
          <RefreshControl
            refreshing={refrescando}
            onRefresh={refrescar}
            tintColor={C.ambar}
            colors={[C.ambar]}
          />
        }
        ListEmptyComponent={
          <Vacio
            titulo="Todavía nada"
            descripcion="Cuando dos personas se dan el sí, la conversación aparece aquí."
          />
        }
        renderItem={({ item }) => (
          <Fila
            match={item}
            onPress={() =>
              navegacion.navigate('Chat', {
                matchId: item.match_id,
                nombre: item.otro_nombre,
                otroId: item.otro_id,
              })
            }
          />
        )}
      />
    </SafeAreaView>
  );
}
