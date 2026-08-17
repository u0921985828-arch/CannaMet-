import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { aIso, CampoFechaNacimiento } from '@/componentes/CampoFechaNacimiento';
import { AvisoError } from '@/componentes/Estados';
import { Opciones } from '@/componentes/Opciones';
import { usePerfil, validarPerfil, type ErroresPerfil } from '@/hooks/usePerfil';
import { useUbicacion } from '@/hooks/useUbicacion';
import { cerrarSesion } from '@/lib/api';
import { AMBIENTES, type AmbientePreferido } from '@/types/modelos';

const MAX_BIO = 500;

export function OnboardingScreen() {
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState({ dia: '', mes: '', anio: '' });
  const [bio, setBio] = useState('');
  const [ambiente, setAmbiente] = useState<AmbientePreferido>('prefiero_no_decir');
  const [errores, setErrores] = useState<ErroresPerfil>({});

  const { guardar, guardando, error } = usePerfil();
  const ubicacion = useUbicacion();

  const pedirUbicacion = async () => {
    await ubicacion.solicitar();
  };

  const continuar = async () => {
    const fechaIso = aIso(fecha.dia, fecha.mes, fecha.anio);
    const nuevos = validarPerfil(nombre, fechaIso, bio);
    setErrores(nuevos);
    if (Object.keys(nuevos).length > 0) return;

    await guardar({
      nombre: nombre.trim(),
      fechaNacimiento: fechaIso as string,
      bio: bio.trim() || null,
      ambiente,
      lat: ubicacion.coords?.lat ?? null,
      lng: ubicacion.coords?.lng ?? null,
    });
    // Al fijar el perfil, RootNavigator conmuta solo a las pestañas.
  };

  const textoUbicacion = (): string => {
    switch (ubicacion.estado) {
      case 'concedida':
        return 'Ubicación guardada';
      case 'denegada':
        return 'Permiso denegado';
      case 'error':
        return 'No se pudo obtener';
      case 'pidiendo':
        return 'Localizando…';
      default:
        return 'Sin ubicación';
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="px-gutter pb-12 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8">
            <View className="h-[3px] w-14 bg-ambar" />
            <Text className="mt-6 font-display text-titulo text-tinta">Tu perfil</Text>
            <Text className="mt-2 font-sans text-cuerpo text-apagado">
              Cuatro datos y ya estás dentro. Puedes cambiarlos cuando quieras.
            </Text>
          </View>

          {error ? <AvisoError mensaje={error} /> : null}

          <Campo
            etiqueta="Nombre"
            value={nombre}
            onChangeText={setNombre}
            placeholder="Cómo quieres que te llamen"
            error={errores.nombre}
            maxLength={40}
            editable={!guardando}
          />

          <CampoFechaNacimiento
            dia={fecha.dia}
            mes={fecha.mes}
            anio={fecha.anio}
            onCambio={(parte, valor) => setFecha((f) => ({ ...f, [parte]: valor }))}
            error={errores.fecha}
            editable={!guardando}
          />

          <Opciones
            etiqueta="Cómo te gusta quedar"
            opciones={AMBIENTES}
            seleccion={ambiente}
            onSeleccion={setAmbiente}
          />

          <Campo
            etiqueta="Sobre ti"
            value={bio}
            onChangeText={setBio}
            placeholder="Opcional. Qué te interesa, qué buscas."
            multiline
            numberOfLines={4}
            maxLength={MAX_BIO}
            error={errores.bio}
            contador={{ actual: bio.length, maximo: MAX_BIO }}
            editable={!guardando}
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />

          {/* Ubicación: bloque aparte porque es lo único que sale del dispositivo */}
          <View className="mb-6 rounded-pieza border border-borde bg-superficie p-5">
            <Text className="font-mono text-etiqueta uppercase text-apagado">
              Ubicación
            </Text>
            <Text className="mt-2 font-sans text-cuerpo text-tinta2">
              Sirve para ordenar los perfiles por cercanía. Otras personas solo ven la
              distancia en kilómetros, nunca el punto.
            </Text>

            <View className="mt-4 flex-row items-center gap-3">
              <View
                className={`h-2 w-2 rounded-pastilla ${
                  ubicacion.estado === 'concedida' ? 'bg-salvia' : 'bg-borde2'
                }`}
              />
              <Text className="flex-1 font-monoMedia text-dato text-tinta">
                {textoUbicacion()}
              </Text>
            </View>

            <View className="mt-4">
              <Boton
                titulo={
                  ubicacion.estado === 'concedida'
                    ? 'Actualizar ubicación'
                    : 'Usar mi ubicación'
                }
                onPress={() => void pedirUbicacion()}
                variante="secundario"
                cargando={ubicacion.estado === 'pidiendo'}
              />
            </View>

            {ubicacion.estado === 'denegada' ? (
              <Text className="mt-3 font-sans text-dato text-apagado">
                Sin ubicación puedes entrar, pero no verás perfiles hasta que la actives
                desde los ajustes del móvil.
              </Text>
            ) : null}
          </View>

          <Boton
            titulo="Entrar en MATCH"
            onPress={() => void continuar()}
            cargando={guardando}
          />

          <Pressable
            onPress={() => void cerrarSesion()}
            className="mt-6 self-center py-2"
            accessibilityRole="button"
          >
            <Text className="font-sans text-dato text-apagado">Cerrar sesión</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
