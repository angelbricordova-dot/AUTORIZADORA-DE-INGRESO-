import { describe, expect, it } from 'vitest';
import type { CashMovement, Payment, StaffStay, StayOps } from './types';
import { agenda, cashBalance, staffCanFix, cashLedger, depositsHeld, emptyOps, paymentsByMethod, pendingToday, retainedDeposit, withdrawHint } from './ops';

const stay = (id: string, check_in: string, check_out: string, total = 200, paid = 0): StaffStay => ({
  id, unit: '30', property_name: 'N°30', check_in, check_out, status: 'confirmada', contact_name: `Grupo ${id}`, contact_phone: '', people: 3, minors: 1, total_usd: total, paid_usd: paid,
});
const pay = (id: string, reservation_id: string, amount_usd: number, method: Payment['method'], received_by: Payment['received_by'], paid_on = '2026-10-10'): Payment => ({
  id, reservation_id, amount_usd, method, received_by, paid_on, reference: '', note: '',
});

describe('caja de Zuleika', () => {
  const payments = [
    pay('1', 'a', 150, 'efectivo_usd', 'staff'),
    pay('2', 'a', 50, 'pago_movil', 'staff'), // no es efectivo: no entra en la caja
    pay('3', 'b', 200, 'efectivo_usd', 'owner'), // lo recibió Oniris: no entra
    pay('4', 'b', 90, 'efectivo_usd', 'staff', '2026-10-12'),
  ];
  const ops: StayOps[] = [
    { ...emptyOps('a', 100), deposit_received_at: '2026-10-09T15:00:00Z', deposit_returned_at: '2026-10-11T12:00:00Z', deposit_returned_usd: 70, note: 'Vaso roto' },
    { ...emptyOps('b', 100), deposit_received_at: '2026-10-12T15:00:00Z' },
  ];
  const cash: CashMovement[] = [
    { id: 'c1', kind: 'gasto', amount_usd: 15, happened_on: '2026-10-11', note: 'Detergente' },
    { id: 'c2', kind: 'retiro', amount_usd: 100, happened_on: '2026-10-11', note: '' },
    { id: 'c3', kind: 'ajuste', amount_usd: -5, happened_on: '2026-10-12', note: 'Cambio' },
  ];

  it('suma cobros en efectivo y garantías retenidas; resta gastos y retiros', () => {
    expect(retainedDeposit(ops[0])).toBe(30);
    expect(retainedDeposit(ops[1])).toBe(0);
    expect(cashBalance(payments, ops, cash)).toBe(150 + 90 + 30 - 15 - 100 - 5);
  });

  it('historial con saldo acumulado, lo más reciente primero', () => {
    const l = cashLedger(payments, ops, cash, [stay('a', '2026-10-09', '2026-10-11'), stay('b', '2026-10-12', '2026-10-14')]);
    expect(l[0].balance).toBe(150);
    expect(l[l.length - 1]).toMatchObject({ kind: 'cobro', amount: 150, balance: 150, detail: 'Grupo a' });
    expect(l.find((e) => e.kind === 'garantia')).toMatchObject({ amount: 30, detail: 'Vaso roto' });
  });

  it('efectivo que le entregaron a Zuleika suma a la caja y dice de quién', () => {
    const extra: CashMovement[] = [...cash, { id: 'c4', kind: 'ingreso', amount_usd: 60, happened_on: '2026-10-13', note: 'María González · adelanto' }];
    expect(cashBalance(payments, ops, extra)).toBe(150 + 90 + 30 - 15 - 100 - 5 + 60);
    const l = cashLedger(payments, ops, extra, []);
    expect(l[0]).toMatchObject({ kind: 'ingreso', label: 'Efectivo recibido', detail: 'María González · adelanto', amount: 60, balance: 210 });
  });

  it('Zuleika corrige solo lo que anotó en las últimas 24 horas', () => {
    const now = Date.parse('2026-10-13T12:00:00Z');
    expect(staffCanFix('2026-10-13T08:00:00Z', now)).toBe(true);
    expect(staffCanFix('2026-10-12T11:00:00Z', now)).toBe(false);
    expect(staffCanFix(undefined, now)).toBe(false);
  });

  it('garantías en su poder y cuáles ya toca devolver', () => {
    const held = depositsHeld([stay('a', '2026-10-09', '2026-10-11'), stay('b', '2026-10-12', '2026-10-14')], ops, '2026-10-14');
    expect(held).toHaveLength(1);
    expect(held[0]).toMatchObject({ amount: 100, due: true });
    expect(depositsHeld([stay('b', '2026-10-12', '2026-10-14')], ops, '2026-10-13')[0].due).toBe(false);
  });

  it('avisa cuándo vale la pena ir a retirar', () => {
    expect(withdrawHint(0, 300).ready).toBe(false);
    expect(withdrawHint(120, 300)).toMatchObject({ ready: false, progress: 0.4 });
    expect(withdrawHint(120, 300).text).toContain('$180');
    expect(withdrawHint(320, 300).ready).toBe(true);
  });

  it('resume lo cobrado por método', () => {
    const m = paymentsByMethod(payments, '2026-10-01', '2026-10-11');
    expect(m.get('efectivo_usd')).toBe(350);
    expect(m.get('pago_movil')).toBe(50);
  });
});

describe('agenda de tareas', () => {
  it('ordena salidas antes que entradas el mismo día y marca lo cobrado', () => {
    const stays = [stay('a', '2026-10-10', '2026-10-12', 200, 200), stay('b', '2026-10-12', '2026-10-14', 300, 100)];
    const a = agenda(stays, [], '2026-10-12', 100);
    expect(a.days[0].date).toBe('2026-10-12');
    expect(a.days[0].items.map((i) => `${i.stay.id}:${i.event}`)).toEqual(['a:sale', 'b:llega']);
    const llegada = a.days[0].items[1].tasks;
    expect(llegada.map((t) => t.id)).toEqual(['clean_before', 'deposit_in', 'keys', 'collect']);
    expect(llegada.find((t) => t.id === 'collect')!.label).toContain('$200');
    // la llegada del grupo "a" quedó con tareas sin marcar: aparece como atrasada
    expect(a.overdue.map((i) => `${i.stay.id}:${i.event}`)).toEqual(['a:llega']);
  });

  it('sin garantía no pide cobrarla ni devolverla', () => {
    const o = { ...emptyOps('a', 0) };
    const a = agenda([stay('a', '2026-10-12', '2026-10-13', 0)], [o], '2026-10-12', 0);
    expect(a.days[0].items[0].tasks.map((t) => t.id)).toEqual(['clean_before', 'keys']);
    expect(a.days[1].items[0].tasks.map((t) => t.id)).toEqual(['clean_after', 'linens']);
  });

  it('un familiar de la dueña: solo entregar las llaves (sin limpieza, cobro ni garantía)', () => {
    const a = agenda([{ ...stay('f', '2026-10-12', '2026-10-14', 0), family: true }], [], '2026-10-12', 100);
    expect(a.days).toHaveLength(1);
    expect(a.days[0].items[0].tasks.map((t) => t.id)).toEqual(['keys']);
  });

  it('cuenta lo pendiente de hoy', () => {
    const done = { ...emptyOps('a', 100), clean_before_at: 'x', deposit_received_at: 'x', keys_at: 'x' };
    expect(pendingToday([stay('a', '2026-10-12', '2026-10-13', 200, 200)], [done], '2026-10-12', 100)).toBe(0);
    expect(pendingToday([stay('a', '2026-10-12', '2026-10-13', 200, 0)], [done], '2026-10-12', 100)).toBe(1);
  });
});

describe('agenda por WhatsApp', () => {
  it('resume entradas y salidas con lo que falta por hacer', async () => {
    const { agendaMessage } = await import('./ops');
    const a = agenda([stay('a', '2026-10-12', '2026-10-14', 300, 100)], [], '2026-10-12', 100, 7);
    const msg = agendaMessage(a.days, '2026-10-12', 'Zuleika', (d) => (d === '2026-10-12' ? 'Hoy' : d));
    expect(msg.split('\n')[0]).toBe('Hola Zuleika, esto es lo de los próximos días:');
    expect(msg).toContain('• Hoy: llega Grupo a (3 personas) — limpieza antes de la llegada, cobrar garantía de $100, entregar las llaves, cobrar el saldo: $200');
    expect(msg).toContain('• 2026-10-14: se va Grupo a');
  });
});
