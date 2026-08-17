type Detalle = Record<string, unknown>;

/**
 * Log estructurado con formato fijo `[ambito] evento { ... }`.
 * Todas las llamadas a Supabase pasan por aquí para poder filtrar
 * en la consola de Metro con un solo grep.
 */
function emitir(
  nivel: 'log' | 'warn' | 'error',
  ambito: string,
  evento: string,
  detalle?: Detalle,
): void {
  if (!__DEV__ && nivel === 'log') return;
  const sello = new Date().toISOString().slice(11, 23);
  // Único punto del proyecto donde se llama a console: aquí sí es su sitio.
  // eslint-disable-next-line no-console
  console[nivel](`${sello} [${ambito}] ${evento}`, detalle ?? '');
}

export const log = {
  info: (ambito: string, evento: string, detalle?: Detalle) =>
    emitir('log', ambito, evento, detalle),
  aviso: (ambito: string, evento: string, detalle?: Detalle) =>
    emitir('warn', ambito, evento, detalle),
  error: (ambito: string, evento: string, detalle?: Detalle) =>
    emitir('error', ambito, evento, detalle),
};

/** Envuelve una promesa y registra duración y resultado. */
export async function medir<T>(
  ambito: string,
  evento: string,
  fn: () => Promise<T>,
  contexto?: Detalle,
): Promise<T> {
  const t0 = Date.now();
  log.info(ambito, `${evento} →`, contexto);
  try {
    const resultado = await fn();
    log.info(ambito, `${evento} ✓`, { ms: Date.now() - t0 });
    return resultado;
  } catch (error) {
    log.error(ambito, `${evento} ✗`, {
      ms: Date.now() - t0,
      error: error instanceof Error ? error.message : String(error),
      ...contexto,
    });
    throw error;
  }
}
