// Ocupación, choques de fechas y pendientes.
import type { Reservation } from './types';
import { addDays, compareISO, nightsBetween } from './dates';

export function isActive(r: Pick<Reservation, 'status'>): boolean {
  return r.status !== 'cancelada';
}

/** Rango semiabierto [check_in, check_out): salir y entrar el mismo día no choca. */
export function overlaps(a: Pick<Reservation, 'check_in' | 'check_out'>, b: Pick<Reservation, 'check_in' | 'check_out'>): boolean {
  return a.check_in < b.check_out && b.check_in < a.check_out;
}

const sameProperty = (a: { property_id?: string }, b: { property_id?: string }) => !a.property_id || !b.property_id || a.property_id === b.property_id;

/** Reservas activas del mismo apartamento que se pisan con `r`. */
export function conflictsFor<T extends Reservation>(r: Pick<Reservation, 'id' | 'check_in' | 'check_out' | 'status'> & { property_id?: string }, all: T[]): T[] {
  if (!isActive(r)) return [];
  return all.filter((o) => o.id !== r.id && isActive(o) && sameProperty(r, o) && overlaps(r, o));
}

/** Pares de reservas activas que se pisan. */
export function allConflicts(all: Reservation[]): [Reservation, Reservation][] {
  const act = all.filter(isActive).sort((a, b) => compareISO(a.check_in, b.check_in));
  const pairs: [Reservation, Reservation][] = [];
  for (let i = 0; i < act.length; i++)
    for (let j = i + 1; j < act.length && act[j].check_in < act[i].check_out; j++) if (sameProperty(act[i], act[j])) pairs.push([act[i], act[j]]);
  return pairs;
}

/** Noches de `r` que caen dentro de [from, to). */
export function nightsWithin(r: Pick<Reservation, 'check_in' | 'check_out'>, from: string, to: string): number {
  const start = r.check_in > from ? r.check_in : from;
  const end = r.check_out < to ? r.check_out : to;
  return start < end ? nightsBetween(start, end) : 0;
}

export interface MonthStats {
  nights: number;
  occupied: number;
  occupancy: number;
  revenue: number;
  collected: number;
  stays: number;
}

/** Estadísticas del mes que empieza en `monthStart` (YYYY-MM-01). Ingresos prorrateados por noche. */
export function monthStats(all: Reservation[], monthStart: string): MonthStats {
  const [y, m] = monthStart.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  const nights = nightsBetween(monthStart, next);
  let occupied = 0;
  let revenue = 0;
  let collected = 0;
  let stays = 0;
  for (const r of all) {
    if (r.status !== 'confirmada') continue;
    const n = nightsWithin(r, monthStart, next);
    if (!n) continue;
    stays++;
    occupied += n;
    const total = nightsBetween(r.check_in, r.check_out) || 1;
    revenue += (r.total_usd * n) / total;
    collected += (Math.min(r.paid_usd, r.total_usd) * n) / total;
  }
  return { nights, occupied: Math.min(occupied, nights), occupancy: nights ? Math.min(occupied, nights) / nights : 0, revenue, collected, stays };
}

export function balance(r: Pick<Reservation, 'total_usd' | 'paid_usd'>): number {
  return Math.max(0, Math.round((r.total_usd - r.paid_usd) * 100) / 100);
}

export type PendingKind = 'conflicto' | 'autorizacion' | 'saldo';

export interface PendingItem {
  kind: PendingKind;
  reservation: Reservation;
  other?: Reservation;
  /** urgente = entra en 2 días o menos */
  urgent: boolean;
}

/** Lo que Oniris tiene que atender: choques, autorizaciones sin enviar, saldos por cobrar. */
export function pendingItems(all: Reservation[], today: string, horizonDays = 30): PendingItem[] {
  const horizon = addDays(today, horizonDays);
  const soon = addDays(today, 2);
  const items: PendingItem[] = [];
  for (const [a, b] of allConflicts(all)) {
    if (a.check_out <= today && b.check_out <= today) continue;
    items.push({ kind: 'conflicto', reservation: a, other: b, urgent: true });
  }
  const upcoming = all
    .filter((r) => r.status === 'confirmada' && r.check_out > today && r.check_in <= horizon)
    .sort((a, b) => compareISO(a.check_in, b.check_in));
  for (const r of upcoming) {
    if (r.auth_status !== 'enviada') items.push({ kind: 'autorizacion', reservation: r, urgent: r.check_in <= soon });
  }
  for (const r of upcoming) {
    if (balance(r) > 0) items.push({ kind: 'saldo', reservation: r, urgent: r.check_in <= soon });
  }
  return items;
}

/** Reservas que entran o salen hoy, y la que está en curso. */
export function todayMovements(all: Reservation[], today: string) {
  const act = all.filter((r) => r.status === 'confirmada');
  return {
    arrivals: act.filter((r) => r.check_in === today),
    departures: act.filter((r) => r.check_out === today),
    inHouse: act.find((r) => r.check_in <= today && r.check_out > today) ?? null,
    next: act.filter((r) => r.check_in > today).sort((a, b) => compareISO(a.check_in, b.check_in))[0] ?? null,
  };
}
