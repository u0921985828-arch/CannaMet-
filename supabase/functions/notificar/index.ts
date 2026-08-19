// Drena la cola `public.notificaciones` y la entrega a Expo Push.
//
// Corre en Deno, no en la app: es el unico sitio del proyecto con la clave
// service_role, y por eso lo primero que hace es comprobar quien llama.
//
// La invoca `public.notificaciones_despachar()` cada minuto vía pg_net. No hay
// estado aquí: si el proceso muere a mitad, las filas siguen sin cerrar y la
// siguiente pasada las vuelve a coger.
//
//   supabase functions deploy notificar

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const EXPO_URL = 'https://exp.host/--/api/v2/push/send';
const LOTE = 100; // Máximo que acepta Expo por petición.

type Pendiente = {
  id: string;
  usuario_id: string;
  tipo: string;
  titulo: string;
  cuerpo: string;
  datos: Record<string, unknown>;
  tokens: string[];
};

type RespuestaExpo = {
  data?: {
    status: 'ok' | 'error';
    id?: string;
    message?: string;
    details?: { error?: string };
  }[];
  errors?: { message: string }[];
};

function trozos<T>(lista: T[], tamano: number): T[][] {
  const salida: T[][] = [];
  for (let i = 0; i < lista.length; i += tamano) salida.push(lista.slice(i, i + tamano));
  return salida;
}

Deno.serve(async (peticion: Request) => {
  const clave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';

  if (!clave || !url) {
    return new Response('faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY', { status: 500 });
  }

  // Sin esto cualquiera con la URL de la función vaciaría la cola de avisos.
  if (peticion.headers.get('Authorization') !== `Bearer ${clave}`) {
    return new Response('no autorizado', { status: 401 });
  }

  const supabase = createClient(url, clave, { auth: { persistSession: false } });

  const { data: pendientes, error } = await supabase.rpc('notificaciones_reclamar', {
    p_limite: 500,
  });

  if (error) {
    console.error('[notificar] no se pudo reclamar', error.message);
    return new Response(error.message, { status: 500 });
  }

  const filas = (pendientes ?? []) as Pendiente[];
  if (filas.length === 0) {
    return Response.json({ reclamadas: 0, enviadas: 0 });
  }

  // Una fila puede tener varios aparatos: se manda un push a cada uno y se
  // recuerda a qué aviso pertenece cada posición de la respuesta.
  const mensajes: Record<string, unknown>[] = [];
  const duenoDe: string[] = [];
  const tokenDe: string[] = [];

  for (const fila of filas) {
    for (const token of fila.tokens) {
      mensajes.push({
        to: token,
        title: fila.titulo,
        body: fila.cuerpo,
        data: { ...fila.datos, tipo: fila.tipo },
        sound: 'default',
        channelId: 'avisos',
        priority: 'high',
      });
      duenoDe.push(fila.id);
      tokenDe.push(token);
    }
  }

  const okPorAviso = new Map<string, boolean>();
  const falloPorAviso = new Map<string, string>();
  const tokensMuertos: string[] = [];
  let posicion = 0;

  for (const lote of trozos(mensajes, LOTE)) {
    let respuesta: RespuestaExpo | null = null;

    try {
      const r = await fetch(EXPO_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(lote),
      });
      respuesta = (await r.json()) as RespuestaExpo;
    } catch (e) {
      // Expo caído o sin red: no se cierra nada y el siguiente minuto reintenta.
      const motivo = e instanceof Error ? e.message : String(e);
      for (let i = 0; i < lote.length; i++) {
        falloPorAviso.set(duenoDe[posicion + i], motivo);
      }
      posicion += lote.length;
      continue;
    }

    const resultados = respuesta?.data ?? [];

    for (let i = 0; i < lote.length; i++) {
      const aviso = duenoDe[posicion + i];
      const resultado = resultados[i];

      if (!resultado || resultado.status === 'error') {
        const motivo = resultado?.details?.error ?? resultado?.message ?? 'respuesta vacía';
        falloPorAviso.set(aviso, motivo);
        // La app se desinstaló: el token no volverá a servir.
        if (resultado?.details?.error === 'DeviceNotRegistered') {
          tokensMuertos.push(tokenDe[posicion + i]);
        }
        continue;
      }
      okPorAviso.set(aviso, true);
    }

    posicion += lote.length;
  }

  // Basta con que un aparato lo reciba para dar el aviso por entregado.
  const entregados = [...okPorAviso.keys()];
  const fallidos = [...falloPorAviso.keys()].filter((id) => !okPorAviso.has(id));

  // Si el cierre falla hay que enterarse: la fila se queda abierta y el aviso
  // se vuelve a enviar al minuto siguiente. Un 200 diciendo que todo fue bien
  // convierte un push duplicado en un misterio.
  let cerroTodo = true;
  const cerrar = async (ids: string[], error: string | null) => {
    if (ids.length === 0) return;
    const { error: fallo } = await supabase.rpc('notificaciones_marcar', {
      p_ids: ids,
      p_error: error,
    });
    if (fallo) {
      cerroTodo = false;
      console.error('[notificar] no se pudo cerrar', ids.length, fallo.message);
    }
  };

  await cerrar(entregados, null);

  // Los fallos se agrupan por motivo: en una caida de Expo, marcarlos de uno en
  // uno son hasta 500 viajes de red por invocacion, cada minuto.
  const porMotivo = new Map<string, string[]>();
  for (const id of fallidos) {
    const motivo = (falloPorAviso.get(id) ?? 'error').slice(0, 300);
    const lista = porMotivo.get(motivo) ?? [];
    lista.push(id);
    porMotivo.set(motivo, lista);
  }
  for (const [motivo, ids] of porMotivo) await cerrar(ids, motivo);

  if (tokensMuertos.length > 0) {
    const { error: fallo } = await supabase.rpc('dispositivos_baja', {
      p_tokens: [...new Set(tokensMuertos)],
    });
    if (fallo) {
      cerroTodo = false;
      console.error('[notificar] no se pudieron dar de baja los tokens', fallo.message);
    }
  }

  return Response.json(
    {
      reclamadas: filas.length,
      enviadas: entregados.length,
      fallidas: fallidos.length,
      tokens_dados_de_baja: tokensMuertos.length,
      cierre_completo: cerroTodo,
    },
    { status: cerroTodo ? 200 : 500 },
  );
});
