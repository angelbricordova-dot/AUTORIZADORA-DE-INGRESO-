// Operación diaria: tareas de cada estadía, garantías y la caja de efectivo que guarda el equipo.
// Funciones puras: las usan el panel de Oniris y el de Zuleika con los mismos datos.
import type { CashMovement, Payment, Property, Reservation, StaffStay, StayOps } from './types';
import { addDays, compareISO } from './dates';
import { formatUSD } from './money';

const round = (n: number) => Math.round(n * 100) / 100;

export function emptyOps(reservationId: string, deposit: number): StayOps {
  return {
    reservation_id: reservationId,
    clean_before_at: null,
    keys_at: null,
    clean_after_at: null,
    linens_at: null,
    deposit_usd: deposit,
    deposit_received_at: null,
    deposit_returned_at: null,
    deposit_returned_usd: null,
    note: '',
  };
}

export function opsFor(ops: StayOps[], reservationId: string, deposit: number): StayOps {
  return ops.find((o) => o.reservation_id === reservationId) ?? emptyOps(reservationId, deposit);
}

/** Parte de la garantía que se quedó (por daños o faltantes): pasa a ser dinero de la dueña. */
export function retainedDeposit(o: StayOps): number {
  if (!o.deposit_received_at || !o.deposit_returned_at) return 0;
  return round(Math.max(0, o.deposit_usd - (o.deposit_returned_usd ?? o.deposit_usd)));
}

/** Cuánto mueve la caja un movimiento: ingreso suma, retiro y gasto restan, ajuste según su signo. */
export function cashSign(m: Pick<CashMovement, 'kind' | 'amount_usd'>): number {
  if (m.kind === 'ajuste') return m.amount_usd;
  return m.kind === 'ingreso' ? Math.abs(m.amount_usd) : -Math.abs(m.amount_usd);
}

/** Efectivo en dólares que tiene guardado el equipo. */
export function cashBalance(payments: Payment[], ops: StayOps[], cash: CashMovement[]): number {
  const cobros = payments.filter((p) => p.method === 'efectivo_usd' && p.received_by === 'staff').reduce((s, p) => s + p.amount_usd, 0);
  const retenido = ops.reduce((s, o) => s + retainedDeposit(o), 0);
  const movimientos = cash.reduce((s, m) => s + cashSign(m), 0);
  return round(cobros + retenido + movimientos);
}

export interface HeldDeposit {
  stay: StaffStay;
  amount: number;
  since: string;
  /** La estadía ya terminó: toca revisar el apartamento y devolverla */
  due: boolean;
}

/** Garantías cobradas que todavía no se devolvieron (dinero de los huéspedes). */
export function depositsHeld(stays: StaffStay[], ops: StayOps[], today: string): HeldDeposit[] {
  return ops
    .filter((o) => o.deposit_received_at && !o.deposit_returned_at && o.deposit_usd > 0)
    .map((o) => {
      const stay = stays.find((s) => s.id === o.reservation_id);
      return stay ? { stay, amount: o.deposit_usd, since: o.deposit_received_at!.slice(0, 10), due: compareISO(stay.check_out, today) <= 0 } : null;
    })
    .filter((x): x is HeldDeposit => !!x)
    .sort((a, b) => compareISO(a.stay.check_out, b.stay.check_out));
}

export type LedgerKind = 'cobro' | 'garantia' | 'retiro' | 'gasto' | 'ajuste' | 'ingreso';
export interface LedgerEntry {
  key: string;
  date: string;
  kind: LedgerKind;
  label: string;
  detail: string;
  amount: number;
  balance: number;
  /** id del pago o movimiento, para poder corregirlo */
  ref?: { type: 'payment' | 'cash'; id: string };
}

/** Historial de la caja con el saldo después de cada movimiento (lo más reciente primero). */
export function cashLedger(payments: Payment[], ops: StayOps[], cash: CashMovement[], stays: Pick<StaffStay, 'id' | 'contact_name'>[]): LedgerEntry[] {
  const who = (id: string) => stays.find((s) => s.id === id)?.contact_name ?? 'Estadía';
  const rows: Omit<LedgerEntry, 'balance'>[] = [
    ...payments
      .filter((p) => p.method === 'efectivo_usd' && p.received_by === 'staff')
      .map((p) => ({ key: `p-${p.id}`, date: p.paid_on, kind: 'cobro' as const, label: 'Cobro en efectivo', detail: [who(p.reservation_id), p.note].filter(Boolean).join(' · '), amount: p.amount_usd, ref: { type: 'payment' as const, id: p.id } })),
    ...ops
      .filter((o) => retainedDeposit(o) > 0)
      .map((o) => ({ key: `g-${o.reservation_id}`, date: o.deposit_returned_at!.slice(0, 10), kind: 'garantia' as const, label: 'Garantía retenida', detail: o.note || who(o.reservation_id), amount: retainedDeposit(o) })),
    ...cash.map((m) => ({
      key: `c-${m.id}`,
      date: m.happened_on,
      kind: m.kind,
      label: m.kind === 'retiro' ? 'Retiro' : m.kind === 'gasto' ? 'Gasto' : m.kind === 'ingreso' ? 'Efectivo recibido' : 'Ajuste',
      detail: m.note,
      amount: cashSign(m),
      ref: { type: 'cash' as const, id: m.id },
    })),
  ].sort((a, b) => compareISO(a.date, b.date) || a.key.localeCompare(b.key));
  let balance = 0;
  return rows.map((r) => ({ ...r, balance: (balance = round(balance + r.amount)) })).reverse();
}

export interface WithdrawHint {
  ready: boolean;
  text: string;
  /** 0 a 1: qué tan cerca está del monto para ir a retirar */
  progress: number;
}

export function withdrawHint(balance: number, alertAt: number): WithdrawHint {
  if (balance <= 0) return { ready: false, text: 'No hay efectivo guardado.', progress: 0 };
  if (alertAt <= 0 || balance >= alertAt) return { ready: true, text: 'Ya conviene ir a retirarlo.', progress: 1 };
  return { ready: false, text: `Faltan ${formatUSD(alertAt - balance)} para que valga la pena ir.`, progress: balance / alertAt };
}

export const balanceDue = (s: Pick<StaffStay, 'total_usd' | 'paid_usd'>) => round(Math.max(0, s.total_usd - s.paid_usd));

// ---------------------------------------------------------------------
// Tareas
// ---------------------------------------------------------------------
export type TaskId = 'clean_before' | 'deposit_in' | 'keys' | 'collect' | 'inspect' | 'clean_after' | 'linens';
export interface Task {
  id: TaskId;
  label: string;
  done: boolean;
}

export function arrivalTasks(s: StaffStay, o: StayOps): Task[] {
  const due = balanceDue(s);
  return [
    { id: 'clean_before', label: 'Limpieza antes de la llegada', done: !!o.clean_before_at },
    ...(o.deposit_usd > 0 ? [{ id: 'deposit_in' as const, label: `Cobrar garantía de ${formatUSD(o.deposit_usd)}`, done: !!o.deposit_received_at }] : []),
    { id: 'keys', label: 'Entregar las llaves', done: !!o.keys_at },
    ...(s.total_usd > 0 ? [{ id: 'collect' as const, label: due > 0 ? `Cobrar el saldo: ${formatUSD(due)}` : 'Estadía pagada', done: due <= 0 }] : []),
  ];
}

export function departureTasks(o: StayOps): Task[] {
  return [
    ...(o.deposit_received_at ? [{ id: 'inspect' as const, label: 'Revisar el apartamento y devolver la garantía', done: !!o.deposit_returned_at }] : []),
    { id: 'clean_after', label: 'Limpieza después de la salida', done: !!o.clean_after_at },
    { id: 'linens', label: 'Lavar sábanas y toallas', done: !!o.linens_at },
  ];
}

export interface AgendaItem {
  stay: StaffStay;
  event: 'llega' | 'sale';
  date: string;
  tasks: Task[];
  ops: StayOps;
}
export interface AgendaDay {
  date: string;
  items: AgendaItem[];
}

/**
 * Entradas y salidas de los próximos días con sus tareas. También trae lo atrasado
 * (días anteriores con tareas sin hacer) para que nada se quede olvidado.
 */
export function agenda(stays: StaffStay[], ops: StayOps[], today: string, deposit: number, days = 14, lookBack = 10): { overdue: AgendaItem[]; days: AgendaDay[] } {
  const items: AgendaItem[] = [];
  for (const s of stays) {
    if (s.status === 'cancelada') continue;
    const o = opsFor(ops, s.id, deposit);
    items.push({ stay: s, event: 'llega', date: s.check_in, tasks: arrivalTasks(s, o), ops: o });
    items.push({ stay: s, event: 'sale', date: s.check_out, tasks: departureTasks(o), ops: o });
  }
  const from = addDays(today, -lookBack);
  const until = addDays(today, days);
  const overdue = items
    .filter((i) => compareISO(i.date, today) < 0 && compareISO(i.date, from) >= 0 && i.tasks.some((t) => !t.done))
    .sort((a, b) => compareISO(a.date, b.date));
  const byDay = new Map<string, AgendaItem[]>();
  for (const i of items) {
    if (compareISO(i.date, today) < 0 || compareISO(i.date, until) > 0) continue;
    byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);
  }
  return {
    overdue,
    days: [...byDay.entries()]
      .sort(([a], [b]) => compareISO(a, b))
      // el mismo día primero se va un grupo y después llega el otro
      .map(([date, list]) => ({ date, items: list.sort((a, b) => (a.event === b.event ? 0 : a.event === 'sale' ? -1 : 1)) })),
  };
}

/** Tareas sin hacer de hoy y atrasadas (para el aviso en el menú). */
export function pendingToday(stays: StaffStay[], ops: StayOps[], today: string, deposit: number): number {
  const a = agenda(stays, ops, today, deposit, 0);
  return [...a.overdue, ...(a.days[0]?.items ?? [])].reduce((n, i) => n + i.tasks.filter((t) => !t.done).length, 0);
}

/**
 * Vista de equipo armada con los datos completos de la dueña (modo demo y panel de Oniris).
 * Solo el apartamento propio: los aliados tienen su propia limpieza y llaves.
 */
export function staffStaysFromApp(reservations: Reservation[], properties: Property[]): StaffStay[] {
  const own = new Set(properties.filter((p) => p.kind === 'propio').map((p) => p.id));
  return reservations
    .filter((r) => r.status !== 'cancelada' && own.has(r.property_id))
    .map((r) => {
      const p = properties.find((x) => x.id === r.property_id);
      return {
        id: r.id,
        unit: p?.unit ?? '',
        property_name: p ? (p.kind === 'propio' ? `N°${p.unit}` : p.name || p.title) : '',
        check_in: r.check_in,
        check_out: r.check_out,
        status: r.status,
        contact_name: r.contact_name,
        contact_phone: r.contact_phone,
        people: r.guests.length,
        minors: r.guests.filter((g) => g.is_minor).length,
        total_usd: r.total_usd,
        paid_usd: r.paid_usd,
      };
    })
    .sort((a, b) => compareISO(a.check_in, b.check_in));
}

/** Cuánto se cobró por cada método en un rango de fechas. */
export function paymentsByMethod(payments: Payment[], from: string, to: string): Map<Payment['method'], number> {
  const m = new Map<Payment['method'], number>();
  for (const p of payments) {
    if (compareISO(p.paid_on, from) < 0 || compareISO(p.paid_on, to) > 0) continue;
    m.set(p.method, round((m.get(p.method) ?? 0) + p.amount_usd));
  }
  return m;
}

/** Mensaje de WhatsApp con las entradas y salidas de los próximos días (para mandárselo a Zuleika). */
export function agendaMessage(days: AgendaDay[], today: string, name: string, dayLabel: (d: string) => string): string {
  const lines = [`Hola ${name}, esto es lo de los próximos días:`];
  for (const d of days) {
    for (const i of d.items) {
      const s = i.stay;
      const pending = i.tasks.filter((t) => !t.done).map((t) => t.label.charAt(0).toLowerCase() + t.label.slice(1));
      const who = `${s.contact_name}${s.people ? ` (${s.people} ${s.people === 1 ? 'persona' : 'personas'})` : ''}`;
      lines.push(`• ${dayLabel(d.date)}: ${i.event === 'llega' ? 'llega' : 'se va'} ${who}${pending.length ? ` — ${pending.join(', ')}` : ' — todo listo'}`);
    }
  }
  if (lines.length === 1) lines.push(`No hay entradas ni salidas desde el ${today.slice(8)}/${today.slice(5, 7)}.`);
  return lines.join('\n');
}
