import type { Enumeracion, RetornoRpc, Tablas } from './database';

export type AmbientePreferido = Enumeracion<'ambiente_preferido'>;
export type AccionSwipe = Enumeracion<'accion_swipe'>;

/**
 * Perfil propio.
 * - `coordenadas`: la app nunca lo necesita en cliente.
 * - `suspendido_por`: revelaría qué moderador sancionó a un usuario que puede
 *   estar enfadado con él. El GRANT de la tabla tampoco lo expone.
 */
export type PerfilPropio = Omit<Tablas<'perfiles'>, 'coordenadas' | 'suspendido_por'>;

export type Aceptacion = Tablas<'aceptaciones_legales'>;

/** Candidato del feed. Trae distancia, nunca el punto. */
export type Candidato = RetornoRpc<'descubrir_perfiles'>[number];

/** Fila de la lista de chats. */
export type ResumenMatch = RetornoRpc<'listar_matches'>[number];

export type Mensaje = Tablas<'mensajes'>;

export type ResultadoSwipe = {
  hayMatch: boolean;
  matchId: string | null;
};

/**
 * Etiquetas de UI para el enum. Cambiar aquí, no en las pantallas.
 * Describen contexto, no consumo: es lo que hace útil el emparejamiento sin
 * convertir el perfil en una declaración sobre sustancias.
 */
export const AMBIENTES: readonly {
  valor: AmbientePreferido;
  etiqueta: string;
}[] = [
  { valor: 'casa', etiqueta: 'Plan de casa' },
  { valor: 'monte', etiqueta: 'Monte y aire libre' },
  { valor: 'musica', etiqueta: 'Música y conciertos' },
  { valor: 'quedadas', etiqueta: 'Quedadas con gente' },
  { valor: 'crear', etiqueta: 'Cocinar y crear' },
  { valor: 'prefiero_no_decir', etiqueta: 'Sin especificar' },
];

export function etiquetaAmbiente(valor: AmbientePreferido): string {
  return AMBIENTES.find((a) => a.valor === valor)?.etiqueta ?? 'Sin especificar';
}

// ───────────────────────── Moderación ─────────────────────────

export type MotivoReporte = Enumeracion<'motivo_reporte'>;
export type Bloqueado = RetornoRpc<'listar_bloqueados'>[number];

/**
 * Orden deliberado: lo más grave primero.
 * "Menor de edad" encabeza la lista porque es lo único que exige
 * actuación inmediata y no debe quedar enterrado bajo "spam".
 */
export const MOTIVOS: readonly {
  valor: MotivoReporte;
  etiqueta: string;
  ayuda: string;
}[] = [
  {
    valor: 'menor_de_edad',
    etiqueta: 'Parece menor de edad',
    ayuda: 'La app es solo para mayores de 18 años.',
  },
  {
    valor: 'acoso_o_amenazas',
    etiqueta: 'Acoso o amenazas',
    ayuda: 'Insistencia tras una negativa, insultos, intimidación.',
  },
  {
    valor: 'contenido_sexual',
    etiqueta: 'Contenido sexual no solicitado',
    ayuda: 'Mensajes o descripciones explícitas sin consentimiento.',
  },
  {
    valor: 'perfil_falso',
    etiqueta: 'Perfil falso',
    ayuda: 'Suplantación o datos que no cuadran.',
  },
  {
    valor: 'spam_o_estafa',
    etiqueta: 'Spam o estafa',
    ayuda: 'Publicidad, venta, petición de dinero.',
  },
  {
    valor: 'otro',
    etiqueta: 'Otra cosa',
    ayuda: 'Cuéntanoslo en el detalle.',
  },
];

// ───────────────────── Panel de moderación ─────────────────────

export type EstadoReporte = Enumeracion<'estado_reporte'>;
export type OrigenReporte = Enumeracion<'origen_reporte'>;
export type CasoModeracion = RetornoRpc<'moderacion_cola'>[number];

export function etiquetaMotivo(valor: MotivoReporte): string {
  if (valor === 'bloqueos_repetidos') return 'Bloqueos repetidos';
  return MOTIVOS.find((m) => m.valor === valor)?.etiqueta ?? 'Sin especificar';
}

/** Duraciones ofrecidas al moderador. Escalonadas, no arbitrarias. */
export const SANCIONES: readonly {
  dias: number | null;
  etiqueta: string;
  estado: EstadoReporte;
}[] = [
  { dias: null, etiqueta: 'Sin sanción', estado: 'revisado' },
  { dias: 3, etiqueta: 'Suspender 3 días', estado: 'actuado' },
  { dias: 30, etiqueta: 'Suspender 30 días', estado: 'actuado' },
  { dias: 3650, etiqueta: 'Suspender indefinidamente', estado: 'actuado' },
];

// ───────────────────── Apelaciones y derechos ─────────────────────

export type EstadoApelacion = Enumeracion<'estado_apelacion'>;
export type Apelacion = Tablas<'apelaciones'>;
export type ApelacionEnCola = RetornoRpc<'moderacion_apelaciones'>[number];

// ───────────────────────── Avisos push ─────────────────────────

export type PlataformaDispositivo = Enumeracion<'plataforma_dispositivo'>;
export type TipoNotificacion = Enumeracion<'tipo_notificacion'>;

/** Carga útil que viaja en el push y que la app usa para abrir la pantalla. */
export type DatosAviso = {
  tipo?: TipoNotificacion;
  match_id?: string;
  otro_id?: string;
  nombre?: string;
};
