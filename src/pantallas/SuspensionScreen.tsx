import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { AvisoError } from '@/componentes/Estados';
import { useSesion } from '@/contexts/SesionContext';
import { apelar, cerrarSesion, miApelacion } from '@/lib/api';
import { mensajeDeError } from '@/lib/supabaseClient';
import type { Apelacion } from '@/types/modelos';

const MIN = 10;
const MAX = 1000;

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Pantalla completa, no un aviso al margen. Una persona suspendida que solo ve
 * un feed vacío asume que la app falla y se crea otra cuenta — justo lo que la
 * suspensión pretendía evitar. Decirlo claro es también una medida de seguridad.
 */
export function SuspensionScreen() {
  const { perfil, usuarioId, refrescarPerfil } = useSesion();
  const [texto, setTexto] = useState('');
  const [apelacion, setApelacion] = useState<Apelacion | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    if (!usuarioId) return;
    let vivo = true;
    void miApelacion(usuarioId)
      .then((a) => {
        if (vivo) setApelacion(a);
      })
      .catch(() => undefined)
      .finally(() => {
        if (vivo) setCargando(false);
      });
    return () => {
      vivo = false;
    };
  }, [usuarioId]);

  const hasta = perfil?.suspendido_hasta;
  const indefinida = hasta
    ? new Date(hasta).getFullYear() > new Date().getFullYear() + 5
    : false;
  const pendiente = apelacion?.estado === 'pendiente';

  const enviar = async () => {
    const limpio = texto.trim();
    if (limpio.length < MIN) {
      setError(`Escribe al menos ${MIN} caracteres para que se pueda revisar.`);
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await apelar(limpio);
      if (usuarioId) setApelacion(await miApelacion(usuarioId));
      setTexto('');
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="flex-grow px-gutter py-10"
        keyboardShouldPersistTaps="handled"
      >
        <View className="h-[3px] w-14 bg-arcilla" />
        <Text className="mt-6 font-display text-titulo text-tinta">Cuenta suspendida</Text>

        <Text className="mt-4 font-sans text-cuerpoL text-tinta2">
          {indefinida
            ? 'Tu cuenta está suspendida de forma indefinida.'
            : hasta
              ? `No podrás ver perfiles ni escribir hasta el ${fechaLarga(hasta)}.`
              : 'Tu cuenta está suspendida.'}
        </Text>

        {perfil?.suspension_motivo ? (
          <View className="mt-5 rounded-pieza border border-borde bg-superficie p-5">
            <Text className="font-mono text-etiqueta uppercase text-apagado">Motivo</Text>
            <Text className="mt-2 font-sans text-cuerpo text-tinta">
              {perfil.suspension_motivo}
            </Text>
          </View>
        ) : null}

        {error ? (
          <View className="mt-5">
            <AvisoError mensaje={error} />
          </View>
        ) : null}

        {cargando ? null : pendiente ? (
          <View className="mt-8 rounded-pieza border border-ambarProfundo bg-ambarSuave p-5">
            <Text className="font-mono text-etiqueta uppercase text-ambar">
              Apelación enviada
            </Text>
            <Text className="mt-2 font-sans text-cuerpo text-tinta2">
              La revisará un moderador distinto del que aplicó la sanción. Te lo encontrarás
              aquí cuando haya respuesta.
            </Text>
            <Text className="mt-3 font-displayItalic text-cuerpo text-tinta2">
              «{apelacion?.texto}»
            </Text>
          </View>
        ) : apelacion?.estado === 'rechazada' ? (
          <View className="mt-8 rounded-pieza border border-borde bg-superficie p-5">
            <Text className="font-mono text-etiqueta uppercase text-apagado">
              Apelación rechazada
            </Text>
            {apelacion.nota_moderacion ? (
              <Text className="mt-2 font-sans text-cuerpo text-tinta2">
                {apelacion.nota_moderacion}
              </Text>
            ) : null}
          </View>
        ) : (
          <View className="mt-8">
            <Text className="mb-4 font-sans text-cuerpo text-tinta">
              Si crees que es un error, cuéntalo. Lo revisa una persona distinta de la que
              aplicó la sanción.
            </Text>

            <Campo
              etiqueta="Tu explicación"
              value={texto}
              onChangeText={setTexto}
              placeholder="Qué crees que ha pasado."
              multiline
              maxLength={MAX}
              contador={{ actual: texto.length, maximo: MAX }}
              editable={!enviando}
              style={{ minHeight: 140, textAlignVertical: 'top' }}
            />

            <Boton
              titulo="Enviar apelación"
              onPress={() => void enviar()}
              cargando={enviando}
            />
          </View>
        )}

        <View className="mt-10 gap-3">
          <Boton
            titulo="Comprobar de nuevo"
            onPress={() => void refrescarPerfil()}
            variante="secundario"
          />
          <Boton
            titulo="Cerrar sesión"
            onPress={() => void cerrarSesion()}
            variante="fantasma"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
