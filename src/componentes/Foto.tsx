import React, { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';

import { urlDeFoto } from '@/lib/fotos';

type Props = {
  /** Ruta dentro del bucket, no una URL. */
  ruta: string | null;
  /** Para el sello con la inicial cuando no hay foto. */
  nombre: string;
  /** Lado en píxeles. `null` ocupa todo el ancho disponible. */
  lado?: number | null;
  redondeo?: 'tarjeta' | 'pieza';
};

/**
 * Pinta la foto de un perfil, o la inicial si no la hay.
 *
 * Recibe la ruta y firma por su cuenta: las URL de Storage caducan, así que
 * pasarlas de pantalla en pantalla acaba en imágenes rotas. El sello con la
 * inicial es el mismo recurso tipográfico que la app usaba antes de que
 * hubiera fotos, así que un perfil sin foto no se ve incompleto, se ve distinto.
 */
export function Foto({ ruta, nombre, lado = null, redondeo = 'tarjeta' }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    setFallo(false);
    setUrl(null);

    void urlDeFoto(ruta).then((u) => {
      if (vigente) setUrl(u);
    });

    return () => {
      vigente = false;
    };
  }, [ruta]);

  const forma = redondeo === 'pieza' ? 'rounded-pieza' : 'rounded-tarjeta';
  const medida =
    lado === null ? { flex: 1, width: '100%' as const } : { width: lado, height: lado };

  if (!ruta || fallo || !url) {
    return (
      <View
        className={`items-center justify-center border border-borde bg-elevado ${forma}`}
        style={medida}
      >
        <Text
          className="font-display text-titulo text-tinta2"
          style={lado !== null && lado < 60 ? { fontSize: lado * 0.4 } : undefined}
        >
          {nombre.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      accessibilityIgnoresInvertColors
      accessible
      accessibilityLabel={`Foto de ${nombre}`}
      onError={() => setFallo(true)}
      className={`border border-borde bg-elevado ${forma}`}
      style={medida}
      resizeMode="cover"
    />
  );
}
