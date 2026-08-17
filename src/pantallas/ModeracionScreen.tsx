import React, { useState } from 'react';
import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AvisoError, Cargando, Vacio } from '@/componentes/Estados';
import { useColaApelaciones, useColaModeracion } from '@/hooks/useModeracionPanel';
import { fechaRelativa } from '@/lib/formato';
import {
  etiquetaMotivo,
  SANCIONES,
  type ApelacionEnCola,
  type CasoModeracion,
} from '@/types/modelos';
import { C } from '@/theme/tokens';

/** Los casos que exigen actuación inmediata se marcan, no se ordenan y ya. */
function esUrgente(caso: CasoModeracion): boolean {
  return caso.motivo === 'menor_de_edad' || caso.motivo === 'acoso_o_amenazas';
}

function Caso({
  caso,
  ocupado,
  onResolver,
}: {
  caso: CasoModeracion;
  ocupado: boolean;
  onResolver: (dias: number | null, estado: 'revisado' | 'actuado') => void;
}) {
  const urgente = esUrgente(caso);

  const preguntar = () => {
    Alert.alert(caso.reportado_nombre ?? 'Perfil borrado', etiquetaMotivo(caso.motivo), [
      ...SANCIONES.map((s) => ({
        text: s.etiqueta,
        style: (s.dias ? 'destructive' : 'default') as 'destructive' | 'default',
        onPress: () => onResolver(s.dias, s.estado as 'revisado' | 'actuado'),
      })),
      { text: 'Cancelar', style: 'cancel' as const },
    ]);
  };

  return (
    <View
      className={`mx-gutter mb-3 rounded-pieza border bg-superficie ${
        urgente ? 'border-arcilla' : 'border-borde'
      }`}
    >
      <View className={`h-[3px] ${urgente ? 'bg-arcilla' : 'bg-borde2'}`} />

      <View className="p-5">
        <View className="flex-row items-baseline justify-between">
          <Text
            className={`font-mono text-etiqueta uppercase tracking-[2px] ${
              urgente ? 'text-arcilla' : 'text-apagado'
            }`}
          >
            {etiquetaMotivo(caso.motivo)}
          </Text>
          <Text className="font-mono text-[10px] uppercase text-apagado">
            {fechaRelativa(caso.creado_en)}
          </Text>
        </View>

        <Text className="mt-3 font-display text-cuerpoL text-tinta">
          {caso.reportado_nombre ?? 'Perfil borrado'}
          {!caso.reportado_existe ? (
            <Text className="font-sans text-dato text-apagado"> · cuenta eliminada</Text>
          ) : null}
        </Text>

        {caso.detalle ? (
          <Text className="mt-2 font-sans text-dato text-tinta2">{caso.detalle}</Text>
        ) : null}

        <View className="mt-4 flex-row gap-4">
          <Text className="font-mono text-[10px] uppercase text-apagado">
            {caso.veces_reportado} reportes
          </Text>
          <Text className="font-mono text-[10px] uppercase text-apagado">
            {caso.veces_bloqueado} bloqueos
          </Text>
          <Text className="font-mono text-[10px] uppercase text-apagado">
            {caso.origen === 'automatico' ? 'señal automática' : 'denuncia'}
          </Text>
        </View>

        <Pressable
          onPress={preguntar}
          disabled={ocupado}
          accessibilityRole="button"
          accessibilityLabel="Resolver caso"
          style={({ pressed }) => ({ opacity: ocupado ? 0.4 : pressed ? 0.7 : 1 })}
        >
          <View className="mt-5 h-12 items-center justify-center rounded-pieza border border-borde2">
            <Text className="font-sansFuerte text-dato text-tinta">Resolver</Text>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

function Apelacion({
  apelacion,
  onResolver,
}: {
  apelacion: ApelacionEnCola;
  onResolver: (aceptar: boolean) => void;
}) {
  const preguntar = () => {
    if (!apelacion.puedo_resolver) return;
    Alert.alert(apelacion.nombre, 'Resolver esta apelación', [
      { text: 'Aceptar y levantar', onPress: () => onResolver(true) },
      { text: 'Rechazar', style: 'destructive', onPress: () => onResolver(false) },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  };

  return (
    <View className="mx-gutter mb-3 rounded-pieza border border-borde bg-superficie">
      <View className="h-[3px] bg-ambarProfundo" />
      <View className="p-5">
        <Text className="font-mono text-etiqueta uppercase tracking-[2px] text-ambar">
          Apelación
        </Text>
        <Text className="mt-3 font-display text-cuerpoL text-tinta">
          {apelacion.nombre}
        </Text>

        {apelacion.suspension_motivo ? (
          <Text className="mt-2 font-sans text-dato text-apagado">
            Sancionado por: {apelacion.suspension_motivo}
          </Text>
        ) : null}

        <Text className="mt-3 font-displayItalic text-cuerpo text-tinta2">
          «{apelacion.texto}»
        </Text>

        {apelacion.puedo_resolver ? (
          <Pressable onPress={preguntar} accessibilityRole="button">
            <View className="mt-5 h-12 items-center justify-center rounded-pieza border border-borde2">
              <Text className="font-sansFuerte text-dato text-tinta">Resolver</Text>
            </View>
          </Pressable>
        ) : (
          <View className="mt-5 rounded-pieza border border-borde bg-base px-4 py-3">
            <Text className="font-sans text-dato text-apagado">
              Tú aplicaste esta sanción. Tiene que revisarla otro moderador.
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

type Vista = 'reportes' | 'apelaciones';

export function ModeracionScreen() {
  const { casos, cargando, refrescando, resolviendo, error, refrescar, resolver } =
    useColaModeracion();
  const apel = useColaApelaciones();
  const [vista, setVista] = useState<Vista>('reportes');

  if (cargando) return <Cargando texto="Cargando cola" />;

  const enApelaciones = vista === 'apelaciones';

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top']}>
      <View className="px-gutter pb-4 pt-2">
        <Text className="font-display text-titulo text-tinta">Moderación</Text>

        <View className="mt-4 flex-row gap-2">
          {(['reportes', 'apelaciones'] as const).map((v) => {
            const activa = vista === v;
            const total = v === 'reportes' ? casos.length : apel.apelaciones.length;
            return (
              <Pressable key={v} onPress={() => setVista(v)} accessibilityRole="tab">
                <View
                  className={`rounded-pastilla border px-4 py-2 ${
                    activa ? 'border-ambar bg-ambarSuave' : 'border-borde bg-superficie'
                  }`}
                >
                  <Text
                    className={`font-mono text-etiqueta uppercase ${
                      activa ? 'text-ambar' : 'text-apagado'
                    }`}
                  >
                    {v} · {total}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {error || apel.error ? (
        <View className="px-gutter">
          <AvisoError mensaje={error ?? apel.error ?? ''} />
        </View>
      ) : null}

      {enApelaciones ? (
        <FlatList
          data={apel.apelaciones}
          keyExtractor={(a) => a.id}
          contentContainerStyle={
            apel.apelaciones.length === 0 ? { flexGrow: 1 } : { paddingBottom: 24 }
          }
          ListEmptyComponent={
            <Vacio titulo="Sin apelaciones" descripcion="Nadie ha pedido revisión." />
          }
          renderItem={({ item }) => (
            <Apelacion
              apelacion={item}
              onResolver={(aceptar) => void apel.resolver(item.id, aceptar, null)}
            />
          )}
        />
      ) : (
        <FlatList
          data={casos}
          keyExtractor={(c) => c.id}
          contentContainerStyle={
            casos.length === 0 ? { flexGrow: 1 } : { paddingBottom: 24 }
          }
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
              titulo="Cola vacía"
              descripcion="No hay reportes pendientes de revisar."
            />
          }
          renderItem={({ item }) => (
            <Caso
              caso={item}
              ocupado={resolviendo === item.id}
              onResolver={(dias, estado) => void resolver(item.id, estado, dias, null)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}
