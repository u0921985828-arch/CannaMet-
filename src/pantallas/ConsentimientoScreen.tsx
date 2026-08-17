import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { AvisoError } from '@/componentes/Estados';
import { cerrarSesion, registrarAceptacion } from '@/lib/api';
import { mensajeDeError } from '@/lib/supabaseClient';
import { PRIVACIDAD, TERMINOS } from '@/legal/textos';

type Documento = 'terminos' | 'privacidad' | null;

function LectorLegal({ doc, onCerrar }: { doc: Documento; onCerrar: () => void }) {
  const texto = doc === 'terminos' ? TERMINOS : doc === 'privacidad' ? PRIVACIDAD : '';

  return (
    <Modal visible={doc !== null} animationType="slide" onRequestClose={onCerrar}>
      <SafeAreaView className="flex-1 bg-base" edges={['top', 'bottom']}>
        <ScrollView contentContainerClassName="px-gutter py-8">
          {/* Markdown plano: sin librería, el texto ya viene estructurado */}
          <Text className="font-sans text-cuerpo leading-6 text-tinta2">{texto}</Text>
          <View className="mt-8">
            <Boton titulo="Cerrar" onPress={onCerrar} variante="secundario" />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/**
 * Bloquea el acceso hasta que hay consentimiento de la versión vigente.
 * El consentimiento para el dato de consumo va aparte y desmarcado: el RGPD
 * exige que sea explícito y separado, no un paquete de todo o nada.
 */
export function ConsentimientoScreen({ onAceptado }: { onAceptado: () => void }) {
  const [aceptaBase, setAceptaBase] = useState(false);
  const [doc, setDoc] = useState<Documento>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const continuar = async () => {
    if (!aceptaBase) return;
    setEnviando(true);
    setError(null);
    try {
      await registrarAceptacion();
      onAceptado();
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="flex-grow px-gutter py-10">
        <View className="h-[3px] w-14 bg-ambar" />
        <Text className="mt-6 font-display text-titulo text-tinta">Antes de entrar</Text>
        <Text className="mt-3 font-sans text-cuerpo text-apagado">
          Una cosa rápida antes de empezar.
        </Text>

        {error ? (
          <View className="mt-6">
            <AvisoError mensaje={error} />
          </View>
        ) : null}

        <View className="mt-8 rounded-pieza border border-borde bg-superficie p-5">
          <View className="flex-row items-start justify-between">
            <View className="mr-4 flex-1">
              <Text className="font-sansMedia text-cuerpo text-tinta">
                Acepto las condiciones y la privacidad
              </Text>
              <Text className="mt-2 font-sans text-dato text-apagado">
                Tengo 18 años o más y entiendo que no se tolera el acoso, el contenido
                sexual no solicitado ni la venta de nada.
              </Text>
            </View>
            <Switch
              value={aceptaBase}
              onValueChange={setAceptaBase}
              disabled={enviando}
              accessibilityLabel="Aceptar condiciones y privacidad"
            />
          </View>

          <View className="mt-4 flex-row gap-5">
            <Pressable onPress={() => setDoc('terminos')} hitSlop={8}>
              <Text className="font-mono text-etiqueta uppercase text-ambar underline">
                Leer condiciones
              </Text>
            </Pressable>
            <Pressable onPress={() => setDoc('privacidad')} hitSlop={8}>
              <Text className="font-mono text-etiqueta uppercase text-ambar underline">
                Leer privacidad
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-8">
          <Boton
            titulo="Continuar"
            onPress={() => void continuar()}
            cargando={enviando}
            deshabilitado={!aceptaBase}
          />
        </View>

        <Pressable
          onPress={() => void cerrarSesion()}
          className="mt-6 self-center py-2"
          accessibilityRole="button"
        >
          <Text className="font-sans text-dato text-apagado">Salir</Text>
        </Pressable>
      </ScrollView>

      <LectorLegal doc={doc} onCerrar={() => setDoc(null)} />
    </SafeAreaView>
  );
}
