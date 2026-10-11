import { describe, expect, it } from 'vitest';
import type { Reservation } from './types';
import { layoutAwnings } from './awnings';

const r = (id: string, check_in: string, check_out: string, status: Reservation['status'] = 'confirmada') =>
  ({ id, check_in, check_out, status }) as Reservation;

describe('layoutAwnings', () => {
  it('coloca el toldo de tarde de llegada a mañana de salida', () => {
    const { segments, lanes } = layoutAwnings([r('a', '2026-10-12', '2026-10-14')], '2026-10-11', 7);
    expect(segments[0]).toMatchObject({ start: 3, end: 7, lane: 0, cutStart: false, cutEnd: false, conflict: false });
    expect(lanes).toBe(1);
  });
  it('salida y llegada el mismo día comparten carril', () => {
    const { segments, lanes } = layoutAwnings([r('a', '2026-10-12', '2026-10-14'), r('b', '2026-10-14', '2026-10-15')], '2026-10-11', 7);
    expect(segments.map((s) => s.lane)).toEqual([0, 0]);
    expect(lanes).toBe(1);
  });
  it('un choque abre otro carril y se marca', () => {
    const { segments, lanes } = layoutAwnings([r('a', '2026-10-12', '2026-10-15'), r('b', '2026-10-13', '2026-10-14', 'tentativa')], '2026-10-11', 7);
    expect(lanes).toBe(2);
    expect(segments.every((s) => s.conflict)).toBe(true);
  });
  it('recorta en los bordes y omite canceladas', () => {
    const { segments } = layoutAwnings(
      [r('a', '2026-10-08', '2026-10-12'), r('b', '2026-10-16', '2026-10-25'), r('c', '2026-10-12', '2026-10-13', 'cancelada')],
      '2026-10-11',
      7,
    );
    expect(segments.map((s) => [s.r.id, s.start, s.end, s.cutStart, s.cutEnd])).toEqual([
      ['a', 0, 3, true, false],
      ['b', 11, 14, false, true],
    ]);
  });
});
