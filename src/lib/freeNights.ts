import type { Reservation } from './types';
import { addDays, nightsBetween } from './dates';
import { isActive } from './availability';

/** Rangos de noches libres [desde, hasta) dentro de [from, to). Considera solo reservas confirmadas. */
export function freeRanges(all: Reservation[], from: string, to: string): { start: string; end: string }[] {
  const busy = all.filter((r) => isActive(r) && r.status === 'confirmada');
  const out: { start: string; end: string }[] = [];
  let cur: string | null = null;
  const n = nightsBetween(from, to);
  for (let i = 0; i <= n; i++) {
    const d = addDays(from, i);
    const free = i < n && !busy.some((r) => r.check_in <= d && r.check_out > d);
    if (free && cur === null) cur = d;
    if (!free && cur !== null) {
      out.push({ start: cur, end: d });
      cur = null;
    }
  }
  return out;
}
