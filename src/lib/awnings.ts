// Coloca cada reserva como un "toldo" sobre una rejilla de medios días:
// empieza en la tarde del día de llegada y termina en la mañana del día de salida.
import type { Reservation } from './types';
import { nightsBetween } from './dates';
import { isActive, overlaps } from './availability';

export interface AwningSegment {
  r: Reservation;
  /** columna inicial (0-based, en medios días) */
  start: number;
  /** columna final exclusiva */
  end: number;
  lane: number;
  cutStart: boolean;
  cutEnd: boolean;
  conflict: boolean;
}

export function layoutAwnings(all: Reservation[], rangeStart: string, days: number): { segments: AwningSegment[]; lanes: number } {
  const cols = days * 2;
  const active = all.filter(isActive);
  const raw = active
    .map((r) => {
      const s = nightsBetween(rangeStart, r.check_in) * 2 + 1;
      const e = nightsBetween(rangeStart, r.check_out) * 2 + 1;
      return { r, s, e };
    })
    .filter(({ s, e }) => e > 0 && s < cols)
    .sort((a, b) => a.s - b.s || b.e - a.e);

  const laneEnds: number[] = [];
  const segments: AwningSegment[] = raw.map(({ r, s, e }) => {
    const start = Math.max(0, s);
    const end = Math.min(cols, e);
    let lane = laneEnds.findIndex((le) => le <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else laneEnds[lane] = end;
    return {
      r,
      start,
      end,
      lane,
      cutStart: s < 0,
      cutEnd: e > cols,
      conflict: active.some((o) => o.id !== r.id && overlaps(r, o)),
    };
  });
  return { segments, lanes: Math.max(1, laneEnds.length) };
}
