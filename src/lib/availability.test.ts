import { describe, expect, it } from 'vitest';
import type { Reservation } from './types';
import { allConflicts, balance, conflictsFor, monthStats, nightsWithin, overlaps, pendingItems, todayMovements } from './availability';
import { parseMoney, formatUSD } from './money';

let n = 0;
const r = (p: Partial<Reservation>): Reservation => ({
  id: `r${++n}`,
  property_id: 'p',
  contact_name: 'X',
  contact_phone: '',
  channel: 'airbnb',
  check_in: '2026-10-17',
  check_out: '2026-10-19',
  stay_type: 'Alquiler Vacacional',
  status: 'confirmada',
  total_usd: 200,
  paid_usd: 0,
  auth_status: 'pendiente',
  auth_sent_at: null,
  notes: '',
  guests: [],
  vehicles: [],
  ...p,
});

describe('choques de fechas', () => {
  it('salir y entrar el mismo día no choca', () => {
    expect(overlaps({ check_in: '2026-10-17', check_out: '2026-10-19' }, { check_in: '2026-10-19', check_out: '2026-10-20' })).toBe(false);
  });
  it('detecta el solape y descarta canceladas', () => {
    const a = r({ check_in: '2026-10-17', check_out: '2026-10-19' });
    const b = r({ check_in: '2026-10-18', check_out: '2026-10-20' });
    const c = r({ check_in: '2026-10-18', check_out: '2026-10-21', status: 'cancelada' });
    expect(conflictsFor(a, [a, b, c]).map((x) => x.id)).toEqual([b.id]);
    expect(allConflicts([a, b, c])).toHaveLength(1);
  });
});

describe('estadísticas del mes', () => {
  it('prorratea una estadía que cruza de mes', () => {
    const a = r({ check_in: '2026-10-30', check_out: '2026-11-02', total_usd: 300, paid_usd: 300 });
    expect(nightsWithin(a, '2026-10-01', '2026-11-01')).toBe(2);
    const s = monthStats([a], '2026-10-01');
    expect(s.occupied).toBe(2);
    expect(s.revenue).toBeCloseTo(200);
    expect(s.nights).toBe(31);
  });
});

describe('pendientes', () => {
  it('lista autorizaciones sin enviar, saldos y choques', () => {
    const a = r({ check_in: '2026-10-12', check_out: '2026-10-14', paid_usd: 50 });
    const b = r({ check_in: '2026-10-13', check_out: '2026-10-15', status: 'tentativa' });
    const c = r({ check_in: '2026-10-20', check_out: '2026-10-22', auth_status: 'enviada', paid_usd: 200 });
    const kinds = pendingItems([a, b, c], '2026-10-11').map((i) => `${i.kind}:${i.reservation.id}:${i.urgent}`);
    expect(kinds).toEqual([`conflicto:${a.id}:true`, `autorizacion:${a.id}:true`, `saldo:${a.id}:true`]);
    expect(balance(a)).toBe(150);
  });
  it('movimientos de hoy', () => {
    const a = r({ check_in: '2026-10-09', check_out: '2026-10-11' });
    const b = r({ check_in: '2026-10-11', check_out: '2026-10-13' });
    const m = todayMovements([a, b], '2026-10-11');
    expect(m.departures.map((x) => x.id)).toEqual([a.id]);
    expect(m.arrivals.map((x) => x.id)).toEqual([b.id]);
    expect(m.inHouse?.id).toBe(b.id);
  });
});

describe('dinero', () => {
  it('entiende formatos venezolanos', () => {
    expect(parseMoney('1.200,50')).toBe(1200.5);
    expect(parseMoney('$ 120')).toBe(120);
    expect(parseMoney('120.5')).toBe(120.5);
    expect(parseMoney('-50')).toBe(50);
    expect(parseMoney('abc')).toBe(0);
    expect(formatUSD(1200)).toBe('$1.200');
  });
});
