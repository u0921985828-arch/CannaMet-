import type {
  AccionSwipe,
  Apelacion,
  ApelacionEnCola,
  Bloqueado,
  Candidato,
  CasoModeracion,
  EstadoReporte,
  MotivoReporte,
  Mensaje,
  PerfilPropio,
  AmbientePreferido,
  ResultadoSwipe,
  ResumenMatch,
} from '@/types/modelos';
import { log, medir } from './log';
import { supabase } from './supabaseClient';

const AMBITO = 'api';

/** Lanza el error de Postgrest tal cual para que lo traduzca `mensajeDeError`. */
function comprobar(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// ────────────────────────────── AUTH ──────────────────────────────

export async function registrarse(email: string, password: string) {
  return medir(AMBITO, 'auth.signUp', async () => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    comprobar(error);
    return {
      sesion: data.session,
      // Sin sesión tras el registro = confirmación por email activada en el proyecto.
      requiereConfirmacion: data.session === null && data.user !== null,
    };
  });
}

export async function iniciarSesion(email: string, password: string) {
  return medir(AMBITO, 'auth.signInWithPassword', async () => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    comprobar(error);
    return data.session;
  });
}

export async function cerrarSesion(): Promise<void> {
  await medir(AMBITO, 'auth.signOut', async () => {
    const { error } = await supabase.auth.signOut();
    comprobar(error);
  });
}

// ───────────────────────────── PERFILES ─────────────────────────────

/** Devuelve null si el usuario todavía no ha pasado por el onboarding. */
export async function obtenerPerfilPropio(usuarioId: string): Promise<PerfilPropio | null> {
  return medir(
    AMBITO,
    'perfiles.select propio',
    async () => {
      const { data, error } = await supabase
        .from('perfiles')
        .select(
          'id, nombre, edad, bio, ambiente, creado_en, actualizado_en, suspendido_hasta, suspension_motivo, fecha_nacimiento',
        )
        .eq('id', usuarioId)
        .maybeSingle();
      comprobar(error);
      return data;
    },
    { usuarioId },
  );
}

export type DatosPerfil = {
  nombre: string;
  /** ISO 'YYYY-MM-DD'. La edad la deriva el servidor. */
  fechaNacimiento: string;
  bio?: string | null;
  ambiente: AmbientePreferido;
  lat?: number | null;
  lng?: number | null;
};

export async function guardarPerfil(datos: DatosPerfil) {
  return medir(
    AMBITO,
    'rpc.guardar_perfil',
    async () => {
      const { data, error } = await supabase.rpc('guardar_perfil', {
        p_nombre: datos.nombre,
        p_fecha_nacimiento: datos.fechaNacimiento,
        p_bio: datos.bio ?? null,
        p_ambiente: datos.ambiente,
        p_lat: datos.lat ?? null,
        p_lng: datos.lng ?? null,
      });
      comprobar(error);
      const fila = data?.[0];
      if (!fila) throw new Error('El servidor no devolvió el perfil guardado.');
      return fila;
    },
    { conUbicacion: datos.lat != null && datos.lng != null },
  );
}

// ─────────────────────────── DESCUBRIMIENTO ───────────────────────────

export async function descubrirPerfiles(
  radioKm: number,
  limite: number,
): Promise<Candidato[]> {
  return medir(
    AMBITO,
    'rpc.descubrir_perfiles',
    async () => {
      const { data, error } = await supabase.rpc('descubrir_perfiles', {
        p_radio_km: radioKm,
        p_limite: limite,
      });
      comprobar(error);
      log.info(AMBITO, 'candidatos recibidos', { total: data?.length ?? 0, radioKm });
      return data ?? [];
    },
    { radioKm, limite },
  );
}

export async function registrarSwipe(
  destinoId: string,
  accion: AccionSwipe,
): Promise<ResultadoSwipe> {
  return medir(
    AMBITO,
    'rpc.registrar_swipe',
    async () => {
      const { data, error } = await supabase.rpc('registrar_swipe', {
        p_destino_id: destinoId,
        p_accion: accion,
      });
      comprobar(error);
      const fila = data?.[0];
      const resultado: ResultadoSwipe = {
        hayMatch: fila?.hay_match ?? false,
        matchId: fila?.match_id ?? null,
      };
      if (resultado.hayMatch) log.info(AMBITO, '★ match', { matchId: resultado.matchId });
      return resultado;
    },
    { destinoId, accion },
  );
}

// ───────────────────────────── MATCHES ─────────────────────────────

export async function listarMatches(): Promise<ResumenMatch[]> {
  return medir(AMBITO, 'rpc.listar_matches', async () => {
    const { data, error } = await supabase.rpc('listar_matches', {});
    comprobar(error);
    return data ?? [];
  });
}

// ───────────────────────────── MENSAJES ─────────────────────────────

export async function listarMensajes(matchId: string): Promise<Mensaje[]> {
  return medir(
    AMBITO,
    'mensajes.select',
    async () => {
      const { data, error } = await supabase
        .from('mensajes')
        .select('*')
        .eq('match_id', matchId)
        .order('creado_en', { ascending: true })
        .limit(200);
      comprobar(error);
      return data ?? [];
    },
    { matchId },
  );
}

export async function enviarMensaje(
  matchId: string,
  remitenteId: string,
  contenido: string,
): Promise<Mensaje> {
  return medir(
    AMBITO,
    'mensajes.insert',
    async () => {
      const { data, error } = await supabase
        .from('mensajes')
        .insert({ match_id: matchId, remitente_id: remitenteId, contenido })
        .select()
        .single();
      comprobar(error);
      if (!data) throw new Error('El servidor no devolvió el mensaje insertado.');
      return data;
    },
    { matchId, longitud: contenido.length },
  );
}

/**
 * Marca como leídos los mensajes que ha enviado el otro.
 * La RLS impide tocar los propios, así que el `neq` es defensa en profundidad.
 */
export async function marcarLeidos(matchId: string, usuarioId: string): Promise<void> {
  await medir(
    AMBITO,
    'mensajes.update leido',
    async () => {
      const { error } = await supabase
        .from('mensajes')
        .update({ leido: true })
        .eq('match_id', matchId)
        .neq('remitente_id', usuarioId)
        .eq('leido', false);
      comprobar(error);
    },
    { matchId },
  );
}

// ──────────────────────────── MODERACIÓN ────────────────────────────

export async function bloquearUsuario(otroId: string): Promise<void> {
  await medir(
    AMBITO,
    'rpc.bloquear_usuario',
    async () => {
      const { error } = await supabase.rpc('bloquear_usuario', { p_otro_id: otroId });
      comprobar(error);
    },
    { otroId },
  );
}

export async function desbloquearUsuario(otroId: string): Promise<void> {
  await medir(
    AMBITO,
    'rpc.desbloquear_usuario',
    async () => {
      const { error } = await supabase.rpc('desbloquear_usuario', { p_otro_id: otroId });
      comprobar(error);
    },
    { otroId },
  );
}

export async function listarBloqueados(): Promise<Bloqueado[]> {
  return medir(AMBITO, 'rpc.listar_bloqueados', async () => {
    const { data, error } = await supabase.rpc('listar_bloqueados', {});
    comprobar(error);
    return data ?? [];
  });
}

export async function reportarUsuario(
  otroId: string,
  motivo: MotivoReporte,
  detalle: string | null,
  bloquear: boolean,
): Promise<void> {
  await medir(
    AMBITO,
    'rpc.reportar_usuario',
    async () => {
      const { error } = await supabase.rpc('reportar_usuario', {
        p_otro_id: otroId,
        p_motivo: motivo,
        p_detalle: detalle,
        p_bloquear: bloquear,
      });
      comprobar(error);
    },
    { otroId, motivo, bloquear },
  );
}

// ─────────────────────── PANEL DE MODERACIÓN ───────────────────────

export async function soyModerador(): Promise<boolean> {
  return medir(AMBITO, 'rpc.soy_moderador', async () => {
    const { data, error } = await supabase.rpc('soy_moderador', {});
    comprobar(error);
    return data ?? false;
  });
}

export async function cargarColaModeracion(limite = 50): Promise<CasoModeracion[]> {
  return medir(AMBITO, 'rpc.moderacion_cola', async () => {
    const { data, error } = await supabase.rpc('moderacion_cola', { p_limite: limite });
    comprobar(error);
    return data ?? [];
  });
}

export async function resolverCaso(
  reporteId: string,
  estado: EstadoReporte,
  suspenderDias: number | null,
  nota: string | null,
): Promise<void> {
  await medir(
    AMBITO,
    'rpc.moderacion_resolver',
    async () => {
      const { error } = await supabase.rpc('moderacion_resolver', {
        p_reporte_id: reporteId,
        p_estado: estado,
        p_suspender_dias: suspenderDias,
        p_nota: nota,
      });
      comprobar(error);
    },
    { reporteId, estado, suspenderDias },
  );
}

export async function cuotaSwipesRestante(): Promise<number> {
  return medir(AMBITO, 'rpc.cuota_swipes_restante', async () => {
    const { data, error } = await supabase.rpc('cuota_swipes_restante', {});
    comprobar(error);
    return data ?? 0;
  });
}

// ───────────────────────── APELACIONES ─────────────────────────

export async function apelar(texto: string): Promise<void> {
  await medir(AMBITO, 'rpc.apelar', async () => {
    const { error } = await supabase.rpc('apelar', { p_texto: texto });
    comprobar(error);
  });
}

/** La apelación más reciente del usuario, para saber qué enseñarle. */
export async function miApelacion(usuarioId: string): Promise<Apelacion | null> {
  return medir(AMBITO, 'apelaciones.select propia', async () => {
    const { data, error } = await supabase
      .from('apelaciones')
      .select('*')
      .eq('usuario_id', usuarioId)
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle();
    comprobar(error);
    return data;
  });
}

export async function cargarColaApelaciones(): Promise<ApelacionEnCola[]> {
  return medir(AMBITO, 'rpc.moderacion_apelaciones', async () => {
    const { data, error } = await supabase.rpc('moderacion_apelaciones', { p_limite: 50 });
    comprobar(error);
    return data ?? [];
  });
}

export async function resolverApelacion(
  apelacionId: string,
  aceptar: boolean,
  nota: string | null,
): Promise<void> {
  await medir(
    AMBITO,
    'rpc.moderacion_resolver_apelacion',
    async () => {
      const { error } = await supabase.rpc('moderacion_resolver_apelacion', {
        p_apelacion_id: apelacionId,
        p_aceptar: aceptar,
        p_nota: nota,
      });
      comprobar(error);
    },
    { apelacionId, aceptar },
  );
}

// ───────────────────── DERECHOS DEL USUARIO (RGPD) ─────────────────────

/** Art. 15: acceso. Devuelve todo lo que la app guarda de esta persona. */
export async function exportarMisDatos(): Promise<unknown> {
  return medir(AMBITO, 'rpc.exportar_mis_datos', async () => {
    const { data, error } = await supabase.rpc('exportar_mis_datos', {});
    comprobar(error);
    return data;
  });
}

/** Art. 17: supresión. Irreversible. La sesión se cierra sola al perder el usuario. */
export async function borrarMiCuenta(): Promise<void> {
  await medir(AMBITO, 'rpc.borrar_mi_cuenta', async () => {
    const { error } = await supabase.rpc('borrar_mi_cuenta', {});
    comprobar(error);
  });
  await supabase.auth.signOut();
}

// ───────────────────── CONSENTIMIENTO LEGAL ─────────────────────

export async function consentimientoAlDia(): Promise<boolean> {
  return medir(AMBITO, 'rpc.consentimiento_al_dia', async () => {
    const { data, error } = await supabase.rpc('consentimiento_al_dia', {});
    comprobar(error);
    return data ?? false;
  });
}

/** Deja constancia de la versión aceptada: el RGPD exige poder demostrarlo. */
export async function registrarAceptacion(): Promise<void> {
  await medir(AMBITO, 'rpc.registrar_aceptacion', async () => {
    const { error } = await supabase.rpc('registrar_aceptacion', {});
    comprobar(error);
  });
}
