import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Boton } from '@/componentes/Boton';
import { Campo } from '@/componentes/Campo';
import { aIso, CampoFechaNacimiento } from '@/componentes/CampoFechaNacimiento';
import { CampoFoto } from '@/componentes/CampoFoto';
import { AvisoError } from '@/componentes/Estados';
import { Opciones } from '@/componentes/Opciones';
import { SeccionBloqueados } from '@/componentes/SeccionBloqueados';
import { SeccionContacto, SeccionDatos } from '@/componentes/SeccionDatos';
import { useSesion } from '@/contexts/SesionContext';
import { usePerfil, validarPerfil, type ErroresPerfil } from '@/hooks/usePerfil';
import { useUbicacion } from '@/hooks/useUbicacion';
import { cerrarSesion } from '@/lib/api';
import { AMBIENTES, type AmbientePreferido } from '@/types/modelos';

const MAX_BIO = 500;

export function PerfilScreen() {
  const { perfil, sesion, fijarPerfil } = useSesion();
  const { guardar, guardando, error } = usePerfil();
  const ubicacion = useUbicacion();

  const [nombre, setNombre] = useState(perfil?.nombre ?? '');
  const partirFecha = (iso: string | null) => {
    if (!iso) return { dia: '', mes: '', anio: '' };
    const [a, m, d] = iso.split('-');
    return { dia: d ?? '', mes: m ?? '', anio: a ?? '' };
  };
  const [fecha, setFecha] = useState(partirFecha(perfil?.fecha_nacimiento ?? null));
  const [bio, setBio] = useState(perfil?.bio ?? '');
  const [ambiente, setAmbiente] = useState<AmbientePreferido>(
    perfil?.ambiente ?? 'prefiero_no_decir',
  );
  const [errores, setErrores] = useState<ErroresPerfil>({});
  const [guardado, setGuardado] = useState(false);

  const aplicar = async () => {
    const fechaIso = aIso(fecha.dia, fecha.mes, fecha.anio);
    const nuevos = validarPerfil(nombre, fechaIso, bio);
    setErrores(nuevos);
    setGuardado(false);
    if (Object.keys(nuevos).length > 0) return;

    const ok = await guardar({
      nombre: nombre.trim(),
      fechaNacimiento: fechaIso as string,
      bio: bio.trim() || null,
      ambiente,
      lat: ubicacion.coords?.lat ?? null,
      lng: ubicacion.coords?.lng ?? null,
    });
    setGuardado(ok);
  };

  const salir = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: () => void cerrarSesion() },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-base" edges={['top']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerClassName="px-gutter pb-12 pt-2"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="font-display text-titulo text-tinta">Tu perfil</Text>
          <Text className="mb-8 mt-1 font-mono text-etiqueta uppercase text-apagado">
            {sesion?.user.email ?? ''}
          </Text>

          {error ? <AvisoError mensaje={error} /> : null}

          {/* La foto se guarda sola al elegirla, no espera al boton de guardar:
              subir y apuntar la ruta ya es una operacion cerrada en si misma. */}
          {perfil ? (
            <View className="mb-8">
              <CampoFoto
                usuarioId={perfil.id}
                ruta={perfil.foto}
                onCambio={(ruta) => fijarPerfil({ ...perfil, foto: ruta })}
              />
            </View>
          ) : null}

          {guardado ? (
            <View className="mb-4 rounded-pieza border border-salvia bg-superficie px-4 py-3">
              <Text className="font-sans text-dato text-tinta2">Cambios guardados.</Text>
            </View>
          ) : null}

          <Campo
            etiqueta="Nombre"
            value={nombre}
            onChangeText={setNombre}
            maxLength={40}
            error={errores.nombre}
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
            placeholder="Opcional"
            multiline
            maxLength={MAX_BIO}
            error={errores.bio}
            contador={{ actual: bio.length, maximo: MAX_BIO }}
            editable={!guardando}
            style={{ minHeight: 110, textAlignVertical: 'top' }}
          />

          <View className="mb-6 rounded-pieza border border-borde bg-superficie p-5">
            <Text className="font-mono text-etiqueta uppercase text-apagado">
              Ubicación
            </Text>
            <Text className="mt-2 font-sans text-dato text-tinta2">
              {ubicacion.estado === 'concedida'
                ? 'Se guardará la posición actual al aplicar los cambios.'
                : 'Actualízala si te has mudado o si cambias de zona a menudo.'}
            </Text>
            <View className="mt-4">
              <Boton
                titulo="Actualizar ubicación"
                onPress={() => void ubicacion.solicitar()}
                variante="secundario"
                cargando={ubicacion.estado === 'pidiendo'}
              />
            </View>
          </View>

          <Boton
            titulo="Guardar cambios"
            onPress={() => void aplicar()}
            cargando={guardando}
          />

          <View className="mt-8">
            <SeccionBloqueados />
            <SeccionDatos />
            <SeccionContacto />
          </View>

          <View className="mt-4">
            <Boton titulo="Cerrar sesión" onPress={salir} variante="fantasma" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
