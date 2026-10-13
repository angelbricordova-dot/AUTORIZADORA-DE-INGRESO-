// Textos de los avisos al teléfono de Zuleika. Funciones puras: se prueban sin servidor.

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export interface Aviso {
  title: string;
  body: string;
  url: string;
  tag: string;
}

/** "2026-10-15" → "jue 15 oct" */
export function diaCorto(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${DIAS[dt.getUTCDay()]} ${d} ${MESES[m - 1]}`;
}

/** Fecha de hoy en Venezuela (YYYY-MM-DD), sin importar dónde corra el servidor. */
export function hoyEnCaracas(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Caracas', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const mayuscula = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const manana = (iso: string) => new Date(Date.parse(iso) + 86_400_000).toISOString().slice(0, 10);

export function avisoNuevaEstadia(s: { unit: string; check_in: string; check_out: string; people: number }, hoy: string): Aviso {
  const noches = Math.round((Date.parse(s.check_out) - Date.parse(s.check_in)) / 86_400_000);
  const cuando = s.check_in === hoy ? 'hoy' : s.check_in === manana(hoy) ? 'mañana' : diaCorto(s.check_in);
  const partes = [`Llega ${cuando}`, `${noches} ${noches === 1 ? 'noche' : 'noches'}`];
  if (s.people > 0) partes.push(`${s.people} ${s.people === 1 ? 'persona' : 'personas'}`);
  return {
    title: `Nuevo huésped en el N°${s.unit}`,
    body: `${partes.join(' · ')}. Toca para ver tus tareas.`,
    url: '/trabajo',
    tag: `estadia-${s.check_in}`,
  };
}

/** Recordatorio de la mañana; null si ese día no hay nada que hacer. */
export function avisoDelDia(d: { unit: string; arrivals: number; departures: number; arrivals_tomorrow: number }, hoy: string): Aviso | null {
  const grupo = (n: number) => `${n} ${n === 1 ? 'grupo' : 'grupos'}`;
  if (d.arrivals || d.departures) {
    const partes: string[] = [];
    if (d.departures) partes.push(`se ${d.departures === 1 ? 'va' : 'van'} ${grupo(d.departures)}`);
    if (d.arrivals) partes.push(`${d.arrivals === 1 ? 'llega' : 'llegan'} ${grupo(d.arrivals)}`);
    const tareas = [d.departures ? 'revisar y devolver la garantía, limpiar y lavar la lencería' : '', d.arrivals ? 'dejar todo limpio y entregar las llaves' : '']
      .filter(Boolean)
      .join('; ');
    return { title: `Hoy en el N°${d.unit}`, body: `${mayuscula(partes.join(' y '))}. Toca para ver: ${tareas}.`, url: '/trabajo', tag: `dia-${hoy}` };
  }
  if (d.arrivals_tomorrow) {
    return {
      title: `Mañana ${d.arrivals_tomorrow === 1 ? 'llega un grupo' : `llegan ${grupo(d.arrivals_tomorrow)}`} al N°${d.unit}`,
      body: 'Deja el apartamento limpio y listo hoy.',
      url: '/trabajo',
      tag: `dia-${hoy}`,
    };
  }
  return null;
}

export function avisoPrueba(): Aviso {
  return { title: 'Avisos activados', body: 'Así te llegará cuando venga un huésped nuevo y cada mañana con lo que toca ese día.', url: '/trabajo', tag: 'prueba' };
}
