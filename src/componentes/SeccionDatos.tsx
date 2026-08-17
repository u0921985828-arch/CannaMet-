import React, { useState } from 'react';
import { Alert, Linking, Pressable, Share, Text, View } from 'react-native';

import { Boton } from './Boton';
import { AvisoError } from './Estados';
import { borrarMiCuenta, exportarMisDatos } from '@/lib/api';
import { DATOS_RESPONSABLE } from '@/legal/textos';
import { mensajeDeError } from '@/lib/supabaseClient';

/**
 * Derechos RGPD, en la app y no en un formulario de contacto.
 * Art. 15 (acceso) y art. 17 (supresión).
 */
export function SeccionDatos() {
  const [ocupado, setOcupado] = useState<'export' | 'borrar' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportar = async () => {
    setOcupado('export');
    setError(null);
    try {
      const datos = await exportarMisDatos();
      await Share.share({
        title: 'Mis datos en MATCH',
        message: JSON.stringify(datos, null, 2),
      });
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setOcupado(null);
    }
  };

  // Doble confirmación: el borrado es inmediato y no hay papelera.
  const confirmarBorrado = () => {
    Alert.alert(
      'Borrar tu cuenta',
      'Se elimina tu perfil, tus conversaciones y tus matches. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () =>
            Alert.alert('¿Seguro?', 'Última oportunidad para echarte atrás.', [
              { text: 'No, cancelar', style: 'cancel' },
              {
                text: 'Borrar definitivamente',
                style: 'destructive',
                onPress: () => {
                  setOcupado('borrar');
                  void borrarMiCuenta()
                    .catch((e) => setError(mensajeDeError(e)))
                    .finally(() => setOcupado(null));
                },
              },
            ]),
        },
      ],
    );
  };

  return (
    <View className="mb-6 rounded-pieza border border-borde bg-superficie p-5">
      <Text className="font-mono text-etiqueta uppercase text-apagado">Tus datos</Text>

      {error ? (
        <View className="mt-3">
          <AvisoError mensaje={error} />
        </View>
      ) : null}

      <Text className="mt-2 font-sans text-dato text-tinta2">
        Puedes llevarte una copia de todo lo que guardamos, o borrar la cuenta entera.
      </Text>

      <View className="mt-4 gap-3">
        <Boton
          titulo="Descargar mis datos"
          onPress={() => void exportar()}
          variante="secundario"
          cargando={ocupado === 'export'}
        />
        <Boton
          titulo="Borrar mi cuenta"
          onPress={confirmarBorrado}
          variante="fantasma"
          cargando={ocupado === 'borrar'}
        />
      </View>

      <Text className="mt-4 font-sans text-dato text-apagado">
        Si alguien te ha denunciado, la denuncia se conserva sin tus datos personales.
        Borrarse no cancela una investigación abierta.
      </Text>
    </View>
  );
}

/**
 * Apple exige (guideline 1.2) que las apps con contenido de usuarios publiquen
 * un contacto para denuncias, además del mecanismo dentro de la app.
 */
export function SeccionContacto() {
  const escribir = () => {
    void Linking.openURL(`mailto:${DATOS_RESPONSABLE.emailAbusos}`).catch(() => undefined);
  };

  return (
    <View className="mb-6 rounded-pieza border border-borde bg-superficie p-5">
      <Text className="font-mono text-etiqueta uppercase text-apagado">
        Denuncias y contacto
      </Text>

      <Text className="mt-2 font-sans text-dato text-tinta2">
        Lo más rápido es denunciar desde el propio perfil o la conversación. Revisamos cada
        denuncia en un plazo máximo de 24 horas.
      </Text>

      <Pressable onPress={escribir} className="mt-4" accessibilityRole="link">
        <Text className="font-mono text-dato text-ambar underline">
          {DATOS_RESPONSABLE.emailAbusos}
        </Text>
      </Pressable>
    </View>
  );
}
