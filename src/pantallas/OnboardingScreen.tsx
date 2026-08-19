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
import { CampoFoto } from '@/componentes/CampoFoto';
import { AvisoError } from '@/componentes/Estados';
import { Opciones } from '@/componentes/Opciones';
import { Paso } from '@/componentes/Paso';
import { useSesion } from '@/contexts/SesionContext';
import { usePerfil, validarPerfil, type ErroresPerfil } from '@/hooks/usePerfil';
import { useUbicacion } from '@/hooks/useUbicacion';
import { cerrarSesion } from '@/lib/api';
import { descartarFichero, fijarFoto } from '@/lib/fotos';
import { AMBIENTES, type AmbientePreferido } from '@/types/modelos';

const MAX_BIO = 500;

/**
 * Un dato por pantalla. El formulario entero de golpe pedía nombre, fecha,
 * ambiente, biografía y ubicación en la misma vista: se lee como un trámite y
 * la mitad de la gente lo abandona en la primera pantalla.
 */
const PASOS = ['nombre', 'foto', 'fecha', 'ambiente', 'bio', 'ubicacion'] as const;
type ClavePaso = (typeof PASOS)[number];

/** Qué campo valida cada paso. La ubicación y el ambiente no pueden fallar. */
const CAMPO_DEL_PASO: Partial<Record<ClavePaso, keyof ErroresPerfil>> = {
  nombre: 'nombre',
  fecha: 'fecha',
  bio: 'bio',
};

export function OnboardingScreen() {
  const { usuarioId } = useSesion();
  const [indice, setIndice] = useState(0);
  const [nombre, setNombre] = useState('');
  const [fecha, setFecha] = useState({ dia: '', mes: '', anio: '' });
  const [bio, setBio] = useState('');
  const [ambiente, setAmbiente] = useState<AmbientePreferido>('prefiero_no_decir');
  const [foto, setFoto] = useState<string | null>(null);
  const [errores, setErrores] = useState<ErroresPerfil>({});

  const { guardar, guardando, error } = usePerfil();
  const ubicacion = useUbicacion();

  const paso = PASOS[indice] as ClavePaso;
  const ultimo = indice === PASOS.length - 1;

  const guardarPerfilCompleto = async () => {
    const fechaIso = aIso(fecha.dia, fecha.mes, fecha.anio);
    const todos = validarPerfil(nombre, fechaIso, bio);

    // Si algo se coló, vuelve al paso que lo pide en vez de fallar sin más.
    const primerFallo = PASOS.find((p) => {
      const campo = CAMPO_DEL_PASO[p];
      return campo && todos[campo];
    });

    if (primerFallo) {
      setErrores(todos);
      setIndice(PASOS.indexOf(primerFallo));
      return;
    }

    const ok = await guardar({
      nombre: nombre.trim(),
      fechaNacimiento: fechaIso as string,
      bio: bio.trim() || null,
      ambiente,
      lat: ubicacion.coords?.lat ?? null,
      lng: ubicacion.coords?.lng ?? null,
    });

    // La foto se apunta ahora, no al subirla: hasta este momento no habia fila
    // de perfil que apuntar. Si el alta no cuaja, el fichero sobra.
    if (ok && foto) await fijarFoto(foto);
    else if (!ok && foto) await descartarFichero(foto);
    // Al fijar el perfil, RootNavigator conmuta solo a las pestañas.
  };

  const avanzar = () => {
    const campo = CAMPO_DEL_PASO[paso];

    if (campo) {
      // `validarPerfil` valida el perfil entero; en cada paso solo importa su
      // campo, porque los demás todavía están a medio rellenar.
      const fallo = validarPerfil(nombre, aIso(fecha.dia, fecha.mes, fecha.anio), bio)[
        campo
      ];
      if (fallo) {
        setErrores({ [campo]: fallo });
        return;
      }
    }

    setErrores({});
    if (ultimo) void guardarPerfilCompleto();
    else setIndice((i) => i + 1);
  };

  const retroceder = () => {
    setErrores({});
    setIndice((i) => Math.max(0, i - 1));
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
          contentContainerClassName="grow px-gutter pb-8 pt-6"
          keyboardShouldPersistTaps="handled"
        >
          {error ? <AvisoError mensaje={error} /> : null}

          {paso === 'nombre' ? (
            <Paso
              indice={indice}
              total={PASOS.length}
              titulo="¿Cómo te llamas?"
              descripcion="El nombre con el que te verá el resto. No tiene que ser el del DNI."
            >
              <Campo
                etiqueta="Nombre"
                value={nombre}
                onChangeText={setNombre}
                placeholder="Cómo quieres que te llamen"
                error={errores.nombre}
                maxLength={40}
                editable={!guardando}
                autoFocus
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={avanzar}
              />
            </Paso>
          ) : null}

          {paso === 'foto' && usuarioId ? (
            <Paso
              indice={indice}
              total={PASOS.length}
              titulo="Ponle cara"
              descripcion="Opcional, y puedes cambiarla luego. Sin foto tu perfil enseña la inicial de tu nombre."
            >
              <CampoFoto
                usuarioId={usuarioId}
                ruta={foto}
                onCambio={setFoto}
                apuntarEnElPerfil={false}
              />
            </Paso>
          ) : null}

          {paso === 'fecha' ? (
            <Paso
              indice={indice}
              total={PASOS.length}
              titulo="¿Cuándo naciste?"
              descripcion="CannaMet es solo para mayores de 18 años. La fecha se comprueba en el servidor, no solo aquí."
            >
              <CampoFechaNacimiento
                dia={fecha.dia}
                mes={fecha.mes}
                anio={fecha.anio}
                onCambio={(parte, valor) => setFecha((f) => ({ ...f, [parte]: valor }))}
                error={errores.fecha}
                editable={!guardando}
              />
            </Paso>
          ) : null}

          {paso === 'ambiente' ? (
            <Paso
              indice={indice}
              total={PASOS.length}
              titulo="¿Cómo te gusta quedar?"
              descripcion="Sirve para que te encuentre gente con planes parecidos. Puedes dejarlo sin especificar."
            >
              <Opciones
                etiqueta="Elige uno"
                opciones={AMBIENTES}
                seleccion={ambiente}
                onSeleccion={setAmbiente}
              />
            </Paso>
          ) : null}

          {paso === 'bio' ? (
            <Paso
              indice={indice}
              total={PASOS.length}
              titulo="Cuéntate en dos líneas"
              descripcion="Opcional, pero los perfiles con algo escrito reciben bastantes más respuestas."
            >
              <Campo
                etiqueta="Sobre ti"
                value={bio}
                onChangeText={setBio}
                placeholder="Qué te interesa, qué buscas."
                multiline
                numberOfLines={5}
                maxLength={MAX_BIO}
                error={errores.bio}
                contador={{ actual: bio.length, maximo: MAX_BIO }}
                editable={!guardando}
                style={{ minHeight: 140, textAlignVertical: 'top' }}
              />
            </Paso>
          ) : null}

          {paso === 'ubicacion' ? (
            <Paso
              indice={indice}
              total={PASOS.length}
              titulo="¿Dónde te movemos?"
              descripcion="Sirve para ordenar los perfiles por cercanía. Otras personas solo ven la distancia en kilómetros, nunca el punto."
            >
              <View className="rounded-pieza border border-borde bg-superficie p-5">
                <View className="flex-row items-center gap-3">
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
                    onPress={() => void ubicacion.solicitar()}
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
            </Paso>
          ) : null}

          {/* El pie se queda abajo aunque el paso sea corto: `grow` en el
              contenedor del scroll y este separador elástico. */}
          <View className="grow" />

          <View className="mt-8 gap-3">
            <Boton
              titulo={ultimo ? 'Entrar en CannaMet' : 'Continuar'}
              onPress={avanzar}
              cargando={guardando}
            />

            {indice > 0 ? (
              <Boton titulo="Atrás" onPress={retroceder} variante="fantasma" />
            ) : (
              <Pressable
                onPress={() => void cerrarSesion()}
                className="self-center py-3"
                accessibilityRole="button"
              >
                <Text className="font-sans text-dato text-apagado">Cerrar sesión</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
