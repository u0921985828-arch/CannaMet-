import * as ImagePicker from 'expo-image-picker';

import { log, medir } from './log';
import { supabase } from './supabaseClient';

const AMBITO = 'fotos';
const BUCKET = 'fotos';

/** Una hora. Las URL firmadas caducan: por eso se guarda la ruta, no la URL. */
const VIGENCIA_FIRMA = 3600;

/**
 * Caché en memoria de URL firmadas. Sin ella, cada repintado de la pila de
 * descubrimiento pediría una firma nueva por tarjeta.
 */
const firmas = new Map<string, { url: string; caduca: number }>();

export type FotoElegida = {
  uri: string;
  /** Lo que espera Storage en `contentType`. */
  tipo: string;
  extension: string;
};

/**
 * Abre la galería y devuelve la foto recortada en cuadrado.
 *
 * El recorte es 1:1 a propósito: la tarjeta y el avatar de la lista son
 * cuadrados, y dejar que cada quien suba lo que quiera obliga a recortar en
 * pantalla, que siempre corta cabezas.
 */
export async function elegirFoto(): Promise<FotoElegida | null> {
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) {
    log.info(AMBITO, 'permiso de galería denegado');
    return null;
  }

  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  const activo = r.assets?.[0];
  if (r.canceled || !activo) return null;

  const tipo = activo.mimeType ?? 'image/jpeg';
  const extension = tipo === 'image/png' ? 'png' : tipo === 'image/webp' ? 'webp' : 'jpg';
  return { uri: activo.uri, tipo, extension };
}

/**
 * Sube el fichero y devuelve su ruta. No toca el perfil.
 *
 * Subir y apuntar van separados porque en el alta el perfil todavía no existe:
 * la política de Storage solo mira que la carpeta sea la tuya, así que la foto
 * puede viajar antes que la fila.
 */
export async function subirFoto(usuarioId: string, foto: FotoElegida): Promise<string> {
  return medir(AMBITO, 'storage.upload', async () => {
    // El nombre cambia en cada subida: con nombre fijo, la caché del móvil
    // seguiría enseñando la foto anterior después de cambiarla.
    const ruta = `${usuarioId}/${Date.now()}.${foto.extension}`;

    const respuesta = await fetch(foto.uri);
    const binario = await respuesta.arrayBuffer();

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(ruta, binario, { contentType: foto.tipo, upsert: false });
    if (error) throw new Error(error.message);

    return ruta;
  });
}

/**
 * Apunta la ruta en el perfil. Se llama DESPUÉS de subir: al revés, un fallo de
 * subida dejaría el perfil señalando a una foto que no existe.
 */
export async function fijarFoto(ruta: string | null): Promise<void> {
  await medir(AMBITO, 'rpc.fijar_mi_foto', async () => {
    const { error } = await supabase.rpc('fijar_mi_foto', { p_ruta: ruta });
    if (error) {
      // El perfil manda: si no se pudo apuntar, el fichero sobra.
      if (ruta) await supabase.storage.from(BUCKET).remove([ruta]);
      throw new Error(error.message);
    }
  });
}

/** Suelta la referencia y borra el fichero. En ese orden, por lo mismo. */
export async function quitarFoto(rutaActual: string | null): Promise<void> {
  await medir(AMBITO, 'rpc.fijar_mi_foto(null)', async () => {
    const { error } = await supabase.rpc('fijar_mi_foto', { p_ruta: null });
    if (error) throw new Error(error.message);

    if (rutaActual) {
      firmas.delete(rutaActual);
      await supabase.storage.from(BUCKET).remove([rutaActual]);
    }
  });
}

/** Borra un fichero suelto. Para deshacer una subida que no llegó a cuajar. */
export async function descartarFichero(ruta: string | null): Promise<void> {
  if (!ruta) return;
  firmas.delete(ruta);
  await supabase.storage.from(BUCKET).remove([ruta]);
}

/**
 * Convierte una ruta en una URL que se puede pintar. Devuelve null en vez de
 * lanzar: una foto que no carga no puede tumbar una lista de matches.
 */
export async function urlDeFoto(ruta: string | null): Promise<string | null> {
  if (!ruta) return null;

  const guardada = firmas.get(ruta);
  if (guardada && guardada.caduca > Date.now()) return guardada.url;

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(ruta, VIGENCIA_FIRMA);

  if (error || !data) {
    log.aviso(AMBITO, 'no se pudo firmar', { ruta, error: error?.message });
    return null;
  }

  // Se descuenta un minuto para no servir una firma que caduca por el camino.
  firmas.set(ruta, {
    url: data.signedUrl,
    caduca: Date.now() + (VIGENCIA_FIRMA - 60) * 1000,
  });
  return data.signedUrl;
}

/** Al cerrar sesión: las firmas de la cuenta anterior no valen para la nueva. */
export function olvidarFirmas(): void {
  firmas.clear();
}
