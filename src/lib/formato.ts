export function distanciaLegible(km: number): string {
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))} m`;
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`;
  return `${Math.round(km)} km`;
}

export function horaCorta(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function fechaRelativa(iso: string | null): string {
  if (!iso) return '';
  const ahora = Date.now();
  const entonces = new Date(iso).getTime();
  const minutos = Math.floor((ahora - entonces) / 60000);

  if (minutos < 1) return 'ahora';
  if (minutos < 60) return `${minutos} min`;

  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas} h`;

  const dias = Math.floor(horas / 24);
  if (dias === 1) return 'ayer';
  if (dias < 7) return `${dias} d`;

  return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/** Agrupa por día para las separaciones del chat. */
export function diaLegible(iso: string): string {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(hoy.getTime() - 86400000);
  const mismoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (mismoDia(d, hoy)) return 'Hoy';
  if (mismoDia(d, ayer)) return 'Ayer';
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' });
}
