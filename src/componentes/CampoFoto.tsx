import React from 'react';
import { Alert, Text, View } from 'react-native';

import { Boton } from './Boton';
import { Foto } from './Foto';
import { useFoto } from '@/hooks/useFoto';

type Props = {
  usuarioId: string;
  ruta: string | null;
  onCambio: (ruta: string | null) => void;
  /** En el alta la foto es opcional y conviene decirlo. */
  descripcion?: string;
  /** En el alta va a false: el perfil aun no existe. */
  apuntarEnElPerfil?: boolean;
};

/** Elegir, cambiar y quitar la foto de perfil. */
export function CampoFoto({
  usuarioId,
  ruta,
  onCambio,
  descripcion,
  apuntarEnElPerfil = true,
}: Props) {
  const { subir, quitar, ocupado, error } = useFoto(usuarioId, apuntarEnElPerfil);

  const confirmarQuitar = () => {
    Alert.alert('Quitar la foto', 'Tu perfil volverá a mostrar solo la inicial.', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar',
        style: 'destructive',
        onPress: () => {
          void quitar(ruta).then((ok) => {
            if (ok) onCambio(null);
          });
        },
      },
    ]);
  };

  return (
    <View>
      <View className="items-center">
        <Foto ruta={ruta} nombre="?" lado={180} redondeo="pieza" />
      </View>

      {descripcion ? (
        <Text className="mt-4 text-center font-sans text-dato text-apagado">
          {descripcion}
        </Text>
      ) : null}

      {error ? (
        <Text className="mt-3 text-center font-sans text-dato text-arcilla">{error}</Text>
      ) : null}

      <View className="mt-5 gap-3">
        <Boton
          titulo={ruta ? 'Cambiar la foto' : 'Elegir una foto'}
          onPress={() => {
            void subir().then((nueva) => {
              if (nueva) onCambio(nueva);
            });
          }}
          variante="secundario"
          cargando={ocupado}
        />

        {ruta ? (
          <Boton titulo="Quitar la foto" onPress={confirmarQuitar} variante="fantasma" />
        ) : null}
      </View>
    </View>
  );
}
