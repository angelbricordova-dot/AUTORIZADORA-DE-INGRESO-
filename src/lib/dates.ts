// Fechas como texto ISO "YYYY-MM-DD" en hora local: sin sorpresas de zona horaria.

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(now: Date = new Date()): string {
  return toISO(now);
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12);
}

export function isValidISO(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  return toISO(parseISO(iso)) === iso;
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

export function nightsBetween(checkIn: string, checkOut: string): number {
  const ms = parseISO(checkOut).getTime() - parseISO(checkIn).getTime();
  return Math.round(ms / 86_400_000);
}

/** 17/10/2026 */
export function formatDMY(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** 17-10-26, el formato que usa la planilla */
export function formatShort(iso: string): string {
  if (!iso) return '______';
  const [y, m, d] = iso.split('-');
  return `${d}-${m}-${y.slice(2)}`;
}

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function weekdayShort(iso: string): string {
  return DIAS[parseISO(iso).getDay()];
}

export function monthName(monthIndex: number): string {
  return MESES[monthIndex];
}

/** "sábado 17 de octubre" */
export function formatLong(iso: string): string {
  const d = parseISO(iso);
  return `${DIAS_LARGOS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
}

/** "17 oct" */
export function formatDayMonth(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MESES[d.getMonth()].slice(0, 3)}`;
}

export function compareISO(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
