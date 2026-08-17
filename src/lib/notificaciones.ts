import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { log, medir } from './log';
import { supabase } from './supabaseClient';
import type { PlataformaDispositivo } from '@/types/modelos';

const AMBITO = 'avisos';

/**
 * Las dos RPC de aparatos viven aqui y no en `api.ts` a proposito: `api.ts`
 * llama a `desactivarAvisos()` al cerrar sesion, y tenerlas alli haria que los
 * dos modulos se importaran en circulo.
 */
async function rpcRegistrar(token: string, plat: PlataformaDispositivo): Promise<void> {
  await medir(AMBITO, 'rpc.registrar_dispositivo', async () => {
    const { error } = await supabase.rpc('registrar_dispositivo', {
      p_token: token,
      p_plataforma: plat,
    });
    if (error) throw new Error(error.message);
  });
}

async function rpcOlvidar(token: string): Promise<void> {
  await medir(AMBITO, 'rpc.olvidar_dispositivo', async () => {
    const { error } = await supabase.rpc('olvidar_dispositivo', { p_token: token });
    if (error) throw new Error(error.message);
  });
}

/**
 * Token del aparato en esta ejecución. Se guarda para poder darlo de baja al
 * cerrar sesión: si no, el móvil seguiría recibiendo los avisos de una cuenta
 * de la que ya se ha salido.
 */
let tokenActual: string | null = null;

/** Con la app abierta el aviso se enseña igual: si no, parece que no llegan. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function plataforma(): PlataformaDispositivo {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

/** Android exige un canal declarado o el push llega mudo y sin prioridad. */
async function prepararCanal(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('avisos', {
    name: 'Avisos',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: '#D99B3C',
  });
}

/**
 * Pide permiso, obtiene el token de Expo y lo registra en el servidor.
 * Devuelve null y sigue sin romper nada si no hay permiso, si es un emulador o
 * si falta el `projectId` de EAS: los avisos son un extra, no un requisito.
 */
export async function activarAvisos(): Promise<string | null> {
  if (!Device.isDevice) {
    log.info(AMBITO, 'emulador: sin push');
    return null;
  }

  try {
    await prepararCanal();

    const { status: actual } = await Notifications.getPermissionsAsync();
    let concedido = actual === 'granted';

    if (!concedido) {
      const { status } = await Notifications.requestPermissionsAsync();
      concedido = status === 'granted';
    }

    if (!concedido) {
      log.info(AMBITO, 'permiso denegado');
      return null;
    }

    // Sin projectId, getExpoPushTokenAsync lanza. Pasa en `expo start` sobre un
    // proyecto que todavía no se ha vinculado a EAS.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;

    if (!projectId) {
      log.aviso(AMBITO, 'falta extra.eas.projectId en app.json: no se piden tokens');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await rpcRegistrar(token, plataforma());
    tokenActual = token;
    log.info(AMBITO, 'aparato registrado');
    return token;
  } catch (error) {
    log.error(AMBITO, 'no se pudieron activar', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/** Se llama antes de cerrar sesión, mientras el token de acceso sigue valiendo. */
export async function desactivarAvisos(): Promise<void> {
  if (!tokenActual) return;
  try {
    await rpcOlvidar(tokenActual);
    log.info(AMBITO, 'aparato dado de baja');
  } catch (error) {
    log.aviso(AMBITO, 'no se pudo dar de baja', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    tokenActual = null;
  }
}
