// Generado desde el proyecto Supabase "match".
// Regenerar con: npm run tipos
export type Json =
  string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.15';
  };
  public: {
    Tables: {
      bloqueos: {
        Row: {
          bloqueado_id: string;
          bloqueador_id: string;
          creado_en: string;
          id: string;
        };
        Insert: {
          bloqueado_id: string;
          bloqueador_id: string;
          creado_en?: string;
          id?: string;
        };
        Update: {
          bloqueado_id?: string;
          bloqueador_id?: string;
          creado_en?: string;
          id?: string;
        };
        Relationships: [];
      };
      aceptaciones_legales: {
        Row: {
          acepta_datos_salud: boolean;
          aceptado_en: string;
          id: string;
          usuario_id: string;
          version_privacidad: string;
          version_terminos: string;
        };
        Insert: {
          acepta_datos_salud?: boolean;
          aceptado_en?: string;
          id?: string;
          usuario_id: string;
          version_privacidad: string;
          version_terminos: string;
        };
        Update: {
          acepta_datos_salud?: boolean;
          aceptado_en?: string;
          id?: string;
          usuario_id?: string;
          version_privacidad?: string;
          version_terminos?: string;
        };
        Relationships: [];
      };
      apelaciones: {
        Row: {
          creado_en: string;
          estado: Database['public']['Enums']['estado_apelacion'];
          id: string;
          nota_moderacion: string | null;
          resuelta_en: string | null;
          resuelta_por: string | null;
          texto: string;
          usuario_id: string;
        };
        Insert: {
          creado_en?: string;
          estado?: Database['public']['Enums']['estado_apelacion'];
          id?: string;
          nota_moderacion?: string | null;
          resuelta_en?: string | null;
          resuelta_por?: string | null;
          texto: string;
          usuario_id: string;
        };
        Update: {
          creado_en?: string;
          estado?: Database['public']['Enums']['estado_apelacion'];
          id?: string;
          nota_moderacion?: string | null;
          resuelta_en?: string | null;
          resuelta_por?: string | null;
          texto?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      moderadores: {
        Row: { creado_en: string; nota: string | null; usuario_id: string };
        Insert: { creado_en?: string; nota?: string | null; usuario_id: string };
        Update: { creado_en?: string; nota?: string | null; usuario_id?: string };
        Relationships: [];
      };
      reportes: {
        Row: {
          creado_en: string;
          detalle: string | null;
          estado: Database['public']['Enums']['estado_reporte'];
          id: string;
          motivo: Database['public']['Enums']['motivo_reporte'];
          reportado_id: string | null;
          reportado_nombre: string | null;
          reportante_id: string | null;
          origen: Database['public']['Enums']['origen_reporte'];
          resuelto_por: string | null;
          resuelto_en: string | null;
          nota_moderacion: string | null;
        };
        Insert: {
          creado_en?: string;
          detalle?: string | null;
          estado?: Database['public']['Enums']['estado_reporte'];
          id?: string;
          motivo: Database['public']['Enums']['motivo_reporte'];
          reportado_id?: string | null;
          reportado_nombre?: string | null;
          reportante_id: string;
        };
        Update: {
          creado_en?: string;
          detalle?: string | null;
          estado?: Database['public']['Enums']['estado_reporte'];
          id?: string;
          motivo?: Database['public']['Enums']['motivo_reporte'];
          reportado_id?: string | null;
          reportado_nombre?: string | null;
          reportante_id?: string;
        };
        Relationships: [];
      };
      matches: {
        Row: {
          creado_en: string;
          id: string;
          usuario_1_id: string;
          usuario_2_id: string;
        };
        Insert: {
          creado_en?: string;
          id?: string;
          usuario_1_id: string;
          usuario_2_id: string;
        };
        Update: {
          creado_en?: string;
          id?: string;
          usuario_1_id?: string;
          usuario_2_id?: string;
        };
        Relationships: [];
      };
      mensajes: {
        Row: {
          contenido: string;
          creado_en: string;
          id: string;
          leido: boolean;
          match_id: string;
          remitente_id: string;
        };
        Insert: {
          contenido: string;
          creado_en?: string;
          id?: string;
          leido?: boolean;
          match_id: string;
          remitente_id: string;
        };
        Update: {
          contenido?: string;
          creado_en?: string;
          id?: string;
          leido?: boolean;
          match_id?: string;
          remitente_id?: string;
        };
        Relationships: [];
      };
      perfiles: {
        Row: {
          actualizado_en: string;
          bio: string | null;
          coordenadas: unknown;
          creado_en: string;
          edad: number;
          id: string;
          nombre: string;
          ambiente: Database['public']['Enums']['ambiente_preferido'];
          suspendido_hasta: string | null;
          suspension_motivo: string | null;
          suspendido_por: string | null;
          fecha_nacimiento: string | null;
        };
        Insert: {
          actualizado_en?: string;
          bio?: string | null;
          coordenadas?: unknown;
          creado_en?: string;
          edad: number;
          id: string;
          nombre: string;
          ambiente?: Database['public']['Enums']['ambiente_preferido'];
        };
        Update: {
          actualizado_en?: string;
          bio?: string | null;
          coordenadas?: unknown;
          creado_en?: string;
          edad?: number;
          id?: string;
          nombre?: string;
          ambiente?: Database['public']['Enums']['ambiente_preferido'];
        };
        Relationships: [];
      };
      swipes: {
        Row: {
          accion: Database['public']['Enums']['accion_swipe'];
          creado_en: string;
          id: string;
          usuario_destino_id: string;
          usuario_origen_id: string;
        };
        Insert: {
          accion: Database['public']['Enums']['accion_swipe'];
          creado_en?: string;
          id?: string;
          usuario_destino_id: string;
          usuario_origen_id: string;
        };
        Update: {
          accion?: Database['public']['Enums']['accion_swipe'];
          creado_en?: string;
          id?: string;
          usuario_destino_id?: string;
          usuario_origen_id?: string;
        };
        Relationships: [];
      };
      dispositivos: {
        Row: {
          creado_en: string;
          plataforma: Database['public']['Enums']['plataforma_dispositivo'];
          token: string;
          usuario_id: string;
          visto_en: string;
        };
        Insert: {
          creado_en?: string;
          plataforma: Database['public']['Enums']['plataforma_dispositivo'];
          token: string;
          usuario_id: string;
          visto_en?: string;
        };
        Update: {
          creado_en?: string;
          plataforma?: Database['public']['Enums']['plataforma_dispositivo'];
          token?: string;
          usuario_id?: string;
          visto_en?: string;
        };
        Relationships: [];
      };
      notificaciones: {
        Row: {
          cerrado_en: string | null;
          creado_en: string;
          cuerpo: string;
          datos: Json;
          error: string | null;
          id: string;
          intentos: number;
          tipo: Database['public']['Enums']['tipo_notificacion'];
          titulo: string;
          usuario_id: string;
        };
        Insert: {
          cerrado_en?: string | null;
          creado_en?: string;
          cuerpo: string;
          datos?: Json;
          error?: string | null;
          id?: string;
          intentos?: number;
          tipo: Database['public']['Enums']['tipo_notificacion'];
          titulo: string;
          usuario_id: string;
        };
        Update: {
          cerrado_en?: string | null;
          creado_en?: string;
          cuerpo?: string;
          datos?: Json;
          error?: string | null;
          id?: string;
          intentos?: number;
          tipo?: Database['public']['Enums']['tipo_notificacion'];
          titulo?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      consentimiento_al_dia: { Args: Record<string, never>; Returns: boolean };
      registrar_aceptacion: { Args: Record<string, never>; Returns: undefined };
      versiones_legales: {
        Args: Record<string, never>;
        Returns: { version_privacidad: string; version_terminos: string }[];
      };
      apelar: { Args: { p_texto: string }; Returns: string };
      borrar_mi_cuenta: { Args: Record<string, never>; Returns: undefined };
      exportar_mis_datos: { Args: Record<string, never>; Returns: Json };
      moderacion_apelaciones: {
        Args: { p_limite?: number };
        Returns: {
          creado_en: string;
          id: string;
          nombre: string;
          puedo_resolver: boolean;
          suspendido_hasta: string | null;
          suspension_motivo: string | null;
          texto: string;
          usuario_id: string;
        }[];
      };
      moderacion_resolver_apelacion: {
        Args: { p_apelacion_id: string; p_aceptar: boolean; p_nota?: string | null };
        Returns: undefined;
      };
      cuota_swipes_restante: { Args: Record<string, never>; Returns: number };
      estoy_suspendido: { Args: Record<string, never>; Returns: boolean };
      soy_moderador: { Args: Record<string, never>; Returns: boolean };
      puede_escribir_en_match: { Args: { p_match_id: string }; Returns: boolean };
      moderacion_cola: {
        Args: { p_limite?: number };
        Returns: {
          creado_en: string;
          detalle: string | null;
          id: string;
          motivo: Database['public']['Enums']['motivo_reporte'];
          origen: Database['public']['Enums']['origen_reporte'];
          reportado_existe: boolean;
          reportado_id: string | null;
          reportado_nombre: string | null;
          reportado_suspendido_hasta: string | null;
          veces_bloqueado: number;
          veces_reportado: number;
        }[];
      };
      moderacion_resolver: {
        Args: {
          p_estado: Database['public']['Enums']['estado_reporte'];
          p_nota?: string | null;
          p_reporte_id: string;
          p_suspender_dias?: number | null;
        };
        Returns: undefined;
      };
      moderacion_levantar_suspension: {
        Args: { p_usuario_id: string };
        Returns: undefined;
      };
      bloquear_usuario: { Args: { p_otro_id: string }; Returns: undefined };
      desbloquear_usuario: { Args: { p_otro_id: string }; Returns: undefined };
      hay_bloqueo: { Args: { p_otro_id: string }; Returns: boolean };
      listar_bloqueados: {
        Args: Record<string, never>;
        Returns: { creado_en: string; id: string; nombre: string }[];
      };
      reportar_usuario: {
        Args: {
          p_bloquear?: boolean;
          p_detalle?: string | null;
          p_motivo: Database['public']['Enums']['motivo_reporte'];
          p_otro_id: string;
        };
        Returns: string;
      };
      descubrir_perfiles: {
        Args: { p_limite?: number; p_radio_km?: number };
        Returns: {
          bio: string | null;
          distancia_km: number;
          edad: number;
          id: string;
          nombre: string;
          ambiente: Database['public']['Enums']['ambiente_preferido'];
        }[];
      };
      es_miembro_de_match: { Args: { p_match_id: string }; Returns: boolean };
      guardar_perfil: {
        Args: {
          p_bio?: string | null;
          p_fecha_nacimiento: string;
          p_lat?: number | null;
          p_lng?: number | null;
          p_nombre: string;
          p_ambiente?: Database['public']['Enums']['ambiente_preferido'];
        };
        Returns: {
          actualizado_en: string;
          bio: string | null;
          edad: number;
          id: string;
          nombre: string;
          ambiente: Database['public']['Enums']['ambiente_preferido'];
          tiene_ubicacion: boolean;
        }[];
      };
      listar_matches: {
        Args: Record<string, never>;
        Returns: {
          creado_en: string;
          match_id: string;
          no_leidos: number;
          otro_edad: number;
          otro_id: string;
          otro_nombre: string;
          otro_ambiente: Database['public']['Enums']['ambiente_preferido'];
          ultimo_mensaje: string | null;
          ultimo_mensaje_en: string | null;
        }[];
      };
      registrar_swipe: {
        Args: {
          p_accion: Database['public']['Enums']['accion_swipe'];
          p_destino_id: string;
        };
        Returns: {
          hay_match: boolean;
          match_id: string | null;
        }[];
      };
      registrar_dispositivo: {
        Args: {
          p_plataforma: Database['public']['Enums']['plataforma_dispositivo'];
          p_token: string;
        };
        Returns: undefined;
      };
      olvidar_dispositivo: { Args: { p_token: string }; Returns: undefined };
    };
    Enums: {
      accion_swipe: 'like' | 'dislike';
      estado_reporte: 'pendiente' | 'revisado' | 'actuado' | 'descartado';
      origen_reporte: 'usuario' | 'automatico';
      estado_apelacion: 'pendiente' | 'aceptada' | 'rechazada';
      motivo_reporte:
        | 'menor_de_edad'
        | 'acoso_o_amenazas'
        | 'contenido_sexual'
        | 'perfil_falso'
        | 'spam_o_estafa'
        | 'bloqueos_repetidos'
        | 'otro';
      ambiente_preferido:
        'casa' | 'monte' | 'musica' | 'quedadas' | 'crear' | 'prefiero_no_decir';
      plataforma_dispositivo: 'ios' | 'android' | 'web';
      tipo_notificacion: 'mensaje' | 'match' | 'suspension' | 'apelacion';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type EsquemaPublico = Database['public'];

export type Tablas<T extends keyof EsquemaPublico['Tables']> =
  EsquemaPublico['Tables'][T]['Row'];

export type TablasInsert<T extends keyof EsquemaPublico['Tables']> =
  EsquemaPublico['Tables'][T]['Insert'];

export type Enumeracion<T extends keyof EsquemaPublico['Enums']> =
  EsquemaPublico['Enums'][T];

export type RetornoRpc<T extends keyof EsquemaPublico['Functions']> =
  EsquemaPublico['Functions'][T]['Returns'];
