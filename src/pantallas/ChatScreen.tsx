import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Burbuja, SeparadorDia } from '@/componentes/Burbuja';
import { AvisoError, Cargando, Vacio } from '@/componentes/Estados';
import { ModalReporte } from '@/componentes/ModalReporte';
import { useUsuarioId } from '@/contexts/SesionContext';
import { useChat } from '@/hooks/useChat';
import { useModeracion } from '@/hooks/useModeracion';
import { diaLegible } from '@/lib/formato';
import type { ParamsRaiz } from '@/navegacion/tipos';
import type { Mensaje } from '@/types/modelos';
import { C } from '@/theme/tokens';

type Props = NativeStackScreenProps<ParamsRaiz, 'Chat'>;

type Elemento =
  | { tipo: 'separador'; clave: string; texto: string }
  | { tipo: 'mensaje'; clave: string; mensaje: Mensaje };

/** Intercala separadores de día entre los mensajes. */
function componer(mensajes: Mensaje[]): Elemento[] {
  const salida: Elemento[] = [];
  let ultimoDia = '';

  for (const m of mensajes) {
    const dia = diaLegible(m.creado_en);
    if (dia !== ultimoDia) {
      salida.push({ tipo: 'separador', clave: `sep-${dia}-${m.id}`, texto: dia });
      ultimoDia = dia;
    }
    salida.push({ tipo: 'mensaje', clave: m.id, mensaje: m });
  }
  return salida;
}

export function ChatScreen({ route, navigation }: Props) {
  const { matchId, nombre, otroId } = route.params;
  const usuarioId = useUsuarioId();
  const { mensajes, cargando, enviando, conectado, error, enviar, MAX_CARACTERES } =
    useChat(matchId, usuarioId);

  const [texto, setTexto] = useState('');
  const [reportando, setReportando] = useState(false);
  const lista = useRef<FlatList<Elemento>>(null);
  const elementos = useMemo(() => componer(mensajes), [mensajes]);
  const { bloquear } = useModeracion();

  const confirmarBloqueo = useCallback(() => {
    Alert.alert(
      `Bloquear a ${nombre}`,
      'Dejaréis de veros y no podrá escribirte. Puedes deshacerlo desde tu perfil.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Bloquear',
          style: 'destructive',
          onPress: () => {
            void bloquear(otroId).then((ok) => {
              if (ok) navigation.goBack();
            });
          },
        },
      ],
    );
  }, [nombre, otroId, bloquear, navigation]);

  const abrirOpciones = useCallback(() => {
    Alert.alert(nombre, undefined, [
      { text: 'Reportar', onPress: () => setReportando(true) },
      { text: 'Bloquear', style: 'destructive', onPress: confirmarBloqueo },
      { text: 'Cancelar', style: 'cancel' },
    ]);
  }, [nombre, confirmarBloqueo]);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Pressable
          onPress={abrirOpciones}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Opciones de la conversación"
        >
          <Text className="font-mono text-cuerpoL text-apagado">···</Text>
        </Pressable>
      ),
    });
  }, [navigation, abrirOpciones]);

  const puedeEnviar = texto.trim().length > 0 && !enviando;

  const mandar = async () => {
    if (!puedeEnviar) return;
    const copia = texto;
    setTexto('');
    const ok = await enviar(copia);
    if (!ok) setTexto(copia); // devolvemos el texto si falló
  };

  if (cargando) return <Cargando texto="Abriendo conversación" />;

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 96 : 0}
      >
        {!conectado ? (
          <View className="bg-elevado px-gutter py-2">
            <Text className="font-mono text-[10px] uppercase text-apagado">
              Reconectando…
            </Text>
          </View>
        ) : null}

        {error ? (
          <View className="px-gutter pt-3">
            <AvisoError mensaje={error} />
          </View>
        ) : null}

        <FlatList
          ref={lista}
          data={elementos}
          keyExtractor={(e) => e.clave}
          contentContainerStyle={
            elementos.length === 0 ? { flexGrow: 1 } : { paddingVertical: 16 }
          }
          onContentSizeChange={() => lista.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            <Vacio
              titulo={`Escribe a ${nombre}`}
              descripcion="Nadie ha dicho nada todavía. Empieza tú."
            />
          }
          renderItem={({ item }) =>
            item.tipo === 'separador' ? (
              <SeparadorDia texto={item.texto} />
            ) : (
              <Burbuja
                mensaje={item.mensaje}
                propio={item.mensaje.remitente_id === usuarioId}
              />
            )
          }
        />

        <View className="flex-row items-end gap-3 border-t border-borde bg-superficie px-gutter py-3">
          <TextInput
            value={texto}
            onChangeText={setTexto}
            placeholder="Escribe un mensaje"
            placeholderTextColor={C.apagado}
            selectionColor={C.ambar}
            multiline
            maxLength={MAX_CARACTERES}
            accessibilityLabel="Mensaje"
            className="max-h-32 flex-1 rounded-pieza border border-borde bg-base px-4 py-3 font-sans text-cuerpo text-tinta"
          />

          <Pressable
            onPress={() => void mandar()}
            disabled={!puedeEnviar}
            accessibilityRole="button"
            accessibilityLabel="Enviar mensaje"
            accessibilityState={{ disabled: !puedeEnviar }}
            style={({ pressed }) => ({ opacity: !puedeEnviar ? 0.35 : pressed ? 0.7 : 1 })}
          >
            <View className="h-12 items-center justify-center rounded-pieza bg-ambar px-5">
              <Text className="font-sansFuerte text-base text-dato">Enviar</Text>
            </View>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <ModalReporte
        visible={reportando}
        usuarioId={otroId}
        nombre={nombre}
        onCerrar={() => setReportando(false)}
        onBloqueado={() => {
          setReportando(false);
          navigation.goBack();
        }}
      />
    </SafeAreaView>
  );
}
