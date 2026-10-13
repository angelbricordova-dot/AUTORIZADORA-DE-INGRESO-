// Panel de operación: lo comparten Oniris (en /admin/zuleika) y Zuleika (cuando entra con su usuario).
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { CashInput, CashKind, PaymentInput, PayMethod, Receiver, Settings, StaffData, StaffStay, StayOps, StayOpsPatch } from '../lib/types';
import { PAY_METHODS, payMethodLabel } from '../lib/types';
import type { DataStore } from '../lib/store';
import { addDays, formatDayMonth, formatLong, weekdayShort } from '../lib/dates';
import { formatUSD, parseMoney } from '../lib/money';
import { agenda, agendaMessage, balanceDue, cashBalance, cashLedger, depositsHeld, paymentsByMethod, staffCanFix, withdrawHint, type AgendaItem, type LedgerEntry, type TaskId } from '../lib/ops';
import { href } from '../router';
import { Icon, type IconName } from './Icon';
import { BottomSheet } from './BottomSheet';
import { useToast } from './Toast';

type View = 'owner' | 'staff';
type OpsSettings = Pick<Settings, 'staff_name' | 'cash_alert_usd' | 'deposit_usd'>;

const TASK_ICON: Record<TaskId, IconName> = {
  clean_before: 'broom',
  deposit_in: 'shield',
  keys: 'key',
  collect: 'money',
  inspect: 'eye',
  clean_after: 'broom',
  linens: 'towel',
};

const STAMP_FIELD: Partial<Record<TaskId, keyof StayOps>> = {
  clean_before: 'clean_before_at',
  keys: 'keys_at',
  clean_after: 'clean_after_at',
  linens: 'linens_at',
};

const nowISO = () => new Date().toISOString();

export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Hoy';
  if (date === addDays(today, 1)) return 'Mañana';
  if (date === addDays(today, -1)) return 'Ayer';
  const w = weekdayShort(date);
  return `${w.charAt(0).toUpperCase()}${w.slice(1)} ${formatDayMonth(date)}`;
}

// ---------------------------------------------------------------------
// Tablero completo
// ---------------------------------------------------------------------
export function OpsBoard({
  view,
  data,
  settings,
  today,
  store,
  reload,
  extra,
}: {
  view: View;
  data: StaffData;
  settings: OpsSettings;
  today: string;
  store: DataStore;
  reload: () => Promise<void>;
  /** Secciones solo para la dueña (ajustes y acceso), al final */
  extra?: ReactNode;
}) {
  const toast = useToast();
  const [payFor, setPayFor] = useState<StaffStay | null>(null);
  const [depositFor, setDepositFor] = useState<{ item: AgendaItem; mode: 'in' | 'out' } | null>(null);
  const [cashKind, setCashKind] = useState<CashKind | null>(null);
  const [incomeOpen, setIncomeOpen] = useState(false);
  const [fixing, setFixing] = useState<LedgerEntry | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const balance = cashBalance(data.payments, data.ops, data.cash);
  const hint = withdrawHint(balance, settings.cash_alert_usd);
  const held = depositsHeld(data.stays, data.ops, today);
  const heldTotal = held.reduce((s, d) => s + d.amount, 0);
  const plan = useMemo(() => agenda(data.stays, data.ops, today, settings.deposit_usd, view === 'staff' ? 7 : 14), [data, today, settings.deposit_usd, view]);
  const ledger = useMemo(() => cashLedger(data.payments, data.ops, data.cash, data.stays), [data]);
  const todays = plan.days.find((d) => d.date === today);
  const later = plan.days.filter((d) => d.date !== today);
  const name = settings.staff_name || 'Zuleika';

  async function run(key: string, fn: () => Promise<void>, ok?: string): Promise<boolean> {
    setBusyKey(key);
    try {
      await fn();
      await reload();
      if (ok) toast(ok);
      return true;
    } catch (e) {
      toast((e as Error).message, 'bad');
      return false;
    } finally {
      setBusyKey(null);
    }
  }

  const saveOps = (item: AgendaItem, patch: StayOpsPatch) =>
    // si la fila no existía, se crea con la garantía de los ajustes
    store.saveOps(item.stay.id, data.ops.some((o) => o.reservation_id === item.stay.id) ? patch : { deposit_usd: item.ops.deposit_usd, ...patch });

  function onTask(item: AgendaItem, id: TaskId) {
    const key = `${item.stay.id}-${id}`;
    if (id === 'collect') return setPayFor(item.stay);
    if (id === 'deposit_in') {
      if (item.ops.deposit_received_at && !item.ops.deposit_returned_at) {
        if (!window.confirm('¿Desmarcar la garantía como recibida?')) return;
        return run(key, () => saveOps(item, { deposit_received_at: null }));
      }
      return setDepositFor({ item, mode: 'in' });
    }
    if (id === 'inspect') {
      if (item.ops.deposit_returned_at) {
        if (!window.confirm('¿Desmarcar la devolución de la garantía?')) return;
        return run(key, () => saveOps(item, { deposit_returned_at: null, deposit_returned_usd: null }));
      }
      return setDepositFor({ item, mode: 'out' });
    }
    const field = STAMP_FIELD[id]!;
    const done = !!item.ops[field];
    return run(key, () => saveOps(item, { [field]: done ? null : nowISO() } as StayOpsPatch));
  }

  const card = (item: AgendaItem, i: number) => (
    <StayCard key={`${item.stay.id}-${item.event}`} item={item} i={i} view={view} today={today} busyKey={busyKey} onTask={(id) => onTask(item, id)} />
  );

  return (
    <>
      <CashCard
        name={name}
        view={view}
        balance={balance}
        hint={hint}
        heldTotal={heldTotal}
        onWithdraw={view === 'owner' ? () => setCashKind('retiro') : undefined}
        onExpense={() => setCashKind('gasto')}
        onIncome={() => setIncomeOpen(true)}
      />

      {plan.overdue.length ? (
        <section className="section" aria-labelledby="h-atrasado">
          <div className="section-head">
            <h2 id="h-atrasado">Quedó pendiente</h2>
            <span className="badge badge-warn">{plan.overdue.length}</span>
          </div>
          <div className="stack">{plan.overdue.map(card)}</div>
        </section>
      ) : null}

      <section className="section" aria-labelledby="h-hoy">
        <h2 id="h-hoy">Hoy · {formatLong(today)}</h2>
        {todays ? <div className="stack">{todays.items.map(card)}</div> : <p className="empty-line">Hoy no llega ni se va nadie.</p>}
        {view === 'owner' && plan.days.length ? (
          <a
            className="btn btn-whatsapp btn-small share-agenda"
            href={`https://wa.me/?text=${encodeURIComponent(agendaMessage(plan.days.filter((d) => d.date <= addDays(today, 7)), today, name, (d) => dayLabel(d, today)))}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="send" /> Mandarle la agenda de la semana
          </a>
        ) : null}
      </section>

      {held.length ? (
        <section className="section" aria-labelledby="h-garantias">
          <div className="section-head">
            <h2 id="h-garantias">Garantías en manos de {name}</h2>
            <span className="badge num">{formatUSD(heldTotal)}</span>
          </div>
          <p className="hint">Es dinero de los huéspedes: se devuelve al revisar el apartamento cuando se van.</p>
          <div className="panel list">
            {held.map((d) => (
              <div key={d.stay.id} className="list-item">
                <span className={`lead-icon ${d.due ? 'lead-warn' : 'lead-brand'}`}>
                  <Icon name="shield" />
                </span>
                <span className="grow">
                  <span className="title">{d.stay.contact_name}</span>
                  <span className="sub">
                    {d.due ? 'Ya salieron: toca revisar y devolver' : `Sale el ${dayLabel(d.stay.check_out, today).toLowerCase()}`} · {d.stay.property_name}
                  </span>
                </span>
                <span className="amount">{formatUSD(d.amount)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {later.length ? (
        <section className="section" aria-labelledby="h-proximos">
          <h2 id="h-proximos">Próximos días</h2>
          {later.map((d) => (
            <div key={d.date} className="stack day-block">
              <h3 className="day-head">{dayLabel(d.date, today)}</h3>
              {d.items.map(card)}
            </div>
          ))}
        </section>
      ) : null}

      {view === 'owner' ? <MethodsSummary data={data} today={today} /> : null}

      <details className="disclosure" id="movimientos">
        <summary>
          <Icon name="wallet" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
          Movimientos de la caja
          <Icon name="chevronRight" className="chev" />
        </summary>
        <div className="disclosure-body">
          {ledger.length ? (
            <div className="ledger">
              {ledger.map((e) => (
                <div key={e.key} className="ledger-row">
                  <span className="grow">
                    <span className="title">{e.label}</span>
                    <span className="sub">
                      {formatDayMonth(e.date)}
                      {e.detail ? ` · ${e.detail}` : ''}
                    </span>
                  </span>
                  <span className="ledger-amounts">
                    <span className={`amount ${e.amount < 0 ? 'neg' : 'pos'}`}>
                      {e.amount < 0 ? '−' : '+'}
                      {formatUSD(Math.abs(e.amount))}
                    </span>
                    <span className="tiny muted">queda {formatUSD(e.balance)}</span>
                  </span>
                  {e.ref && (view === 'owner' || staffCanFix(e.ref.created_at)) ? (
                    <button className="icon-btn flat" type="button" aria-label={`Corregir ${e.label.toLowerCase()} del ${formatDayMonth(e.date)}`} onClick={() => setFixing(e)}>
                      <Icon name="edit" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted small">Todavía no hay movimientos.</p>
          )}
        </div>
      </details>

      {extra}

      <PaymentSheet
        stay={payFor}
        today={today}
        receiver={view === 'staff' ? 'staff' : 'choose'}
        staffName={name}
        onClose={() => setPayFor(null)}
        onSave={(p) => run('pay', () => store.addPayment(p), p.method === 'efectivo_usd' && p.received_by === 'staff' ? `Cobro anotado: ${formatUSD(p.amount_usd)} en la caja` : 'Pago anotado')}
      />
      <DepositSheet
        target={depositFor}
        onClose={() => setDepositFor(null)}
        onSave={(patch) => run('dep', () => saveOps(depositFor!.item, patch), depositFor?.mode === 'in' ? 'Garantía recibida' : 'Garantía devuelta')}
      />
      <IncomeSheet
        open={incomeOpen}
        view={view}
        name={name}
        stays={data.stays}
        today={today}
        onClose={() => setIncomeOpen(false)}
        onSave={(r) =>
          run(
            'income',
            () =>
              r.type === 'stay'
                ? store.addPayment({ reservation_id: r.stayId, amount_usd: r.amount, method: 'efectivo_usd', received_by: 'staff', paid_on: r.date, reference: '', note: r.reason })
                : store.addCash({ kind: 'ingreso', amount_usd: r.amount, happened_on: r.date, note: r.reason ? `${r.name} · ${r.reason}` : r.name }),
            `Anotado: ${formatUSD(r.amount)} en la caja`,
          )
        }
      />
      <FixSheet
        entry={fixing}
        data={data}
        today={today}
        onClose={() => setFixing(null)}
        onSave={(ref, v) =>
          run(
            'fix',
            () => {
              if (ref.type === 'payment') return store.updatePayment(ref.id, { amount_usd: v.amount, paid_on: v.date, note: v.note });
              const m = data.cash.find((c) => c.id === ref.id)!;
              // un ajuste conserva su signo; lo demás siempre es positivo
              return store.updateCash(ref.id, { kind: m.kind, amount_usd: m.kind === 'ajuste' && m.amount_usd < 0 ? -v.amount : v.amount, happened_on: v.date, note: v.note });
            },
            `Corregido: ${formatUSD(v.amount)}`,
          )
        }
        onDelete={(ref) => run('fix', () => (ref.type === 'payment' ? store.deletePayment(ref.id) : store.deleteCash(ref.id)), 'Movimiento borrado')}
      />
      <CashSheet
        kind={cashKind}
        today={today}
        balance={balance}
        onClose={() => setCashKind(null)}
        onSave={(m) => run('cash', () => store.addCash(m), m.kind === 'retiro' ? `Retiro de ${formatUSD(m.amount_usd)} anotado` : 'Gasto anotado')}
      />
    </>
  );
}

// ---------------------------------------------------------------------
// Caja
// ---------------------------------------------------------------------
function CashCard({
  name,
  view,
  balance,
  hint,
  heldTotal,
  onWithdraw,
  onExpense,
  onIncome,
}: {
  name: string;
  view: View;
  balance: number;
  hint: ReturnType<typeof withdrawHint>;
  heldTotal: number;
  onWithdraw?: () => void;
  onExpense: () => void;
  onIncome: () => void;
}) {
  return (
    <section className={`cash-card ${hint.ready ? 'ready' : ''}`} aria-labelledby="h-caja">
      <span className="label" id="h-caja">
        {view === 'staff' ? 'Efectivo que guardas de Oniris' : `Efectivo que guarda ${name}`}
      </span>
      <span className="big num">{balance < 0 ? `−${formatUSD(-balance)}` : formatUSD(balance)}</span>
      <div className="meter" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(hint.progress * 100)} aria-label="Cerca del monto para retirar">
        <i style={{ '--p': hint.progress } as CSSProperties} />
      </div>
      <span className="meta">
        {balance < 0
          ? view === 'staff'
            ? `Pusiste ${formatUSD(-balance)} de tu bolsillo: Oniris te lo repone.`
            : `${name} puso ${formatUSD(-balance)} de su bolsillo: hay que reponérselo.`
          : view === 'staff'
            ? hint.ready
              ? 'Avísale a Oniris para que pase a retirarlo.'
              : 'Cuenta solo los dólares en efectivo.'
            : hint.text}
      </span>
      {heldTotal > 0 ? (
        <span className="meta small">
          Aparte: {formatUSD(heldTotal)} de garantías por devolver
        </span>
      ) : null}
      <div className="actions">
        <button className={`btn btn-small ${view === 'staff' ? 'btn-sun' : 'btn-glass'}`} type="button" onClick={onIncome}>
          <Icon name="plus" /> {view === 'staff' ? 'Recibí efectivo' : 'Efectivo recibido'}
        </button>
        {onWithdraw ? (
          <button className="btn btn-sun btn-small" type="button" onClick={onWithdraw} disabled={balance <= 0}>
            <Icon name="wallet" /> Registrar retiro
          </button>
        ) : null}
        <button className="btn btn-glass btn-small" type="button" onClick={onExpense}>
          <Icon name="minus" /> Anotar gasto
        </button>
      </div>
      <button
        className="cash-link"
        type="button"
        onClick={() => {
          const d = document.getElementById('movimientos') as HTMLDetailsElement | null;
          if (!d) return;
          d.open = true;
          d.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }}
      >
        Ver y corregir movimientos
      </button>
    </section>
  );
}

// ---------------------------------------------------------------------
// Una entrada o salida con su lista de tareas
// ---------------------------------------------------------------------
function StayCard({
  item,
  i,
  view,
  today,
  busyKey,
  onTask,
}: {
  item: AgendaItem;
  i: number;
  view: View;
  today: string;
  busyKey: string | null;
  onTask: (id: TaskId) => void;
}) {
  const s = item.stay;
  const done = item.tasks.filter((t) => t.done).length;
  const people = s.people ? `${s.people} ${s.people === 1 ? 'persona' : 'personas'}${s.minors ? ` (${s.minors} ${s.minors === 1 ? 'menor' : 'menores'})` : ''}` : '';
  const late = item.date < today;
  return (
    <article className={`ops-card ${item.event}`} style={{ '--i': i } as CSSProperties} aria-label={`${item.event === 'llega' ? 'Llega' : 'Se va'} ${s.contact_name}`}>
      <header className="ops-head">
        <span className={`ops-event ${item.event}`}>{item.event === 'llega' ? 'Llega' : 'Se va'}</span>
        <span className="grow">
          {view === 'owner' ? (
            <a className="title" href={href(`/reserva/${s.id}`)}>
              {s.contact_name}
            </a>
          ) : (
            <span className="title">{s.contact_name}</span>
          )}
          <span className="sub">
            {[s.property_name, late ? dayLabel(item.date, today) : '', people].filter(Boolean).join(' · ')}
          </span>
        </span>
        <span className={`ops-count ${done === item.tasks.length ? 'all' : ''}`} aria-label={`${done} de ${item.tasks.length} tareas hechas`}>
          {done}/{item.tasks.length}
        </span>
      </header>
      <ul className="tasks">
        {item.tasks.map((t) => {
          const key = `${s.id}-${t.id}`;
          return (
            <li key={t.id}>
              <button className={`task ${t.done ? 'done' : ''}`} type="button" role="checkbox" aria-checked={t.done} disabled={busyKey === key} onClick={() => onTask(t.id)}>
                <span className="task-box" aria-hidden="true">
                  {busyKey === key ? <span className="spinner" /> : t.done ? <Icon name="check" /> : <Icon name={TASK_ICON[t.id]} />}
                </span>
                <span className="task-label">{t.label}</span>
                {t.id === 'inspect' && item.ops.deposit_returned_at && (item.ops.deposit_returned_usd ?? item.ops.deposit_usd) < item.ops.deposit_usd ? (
                  <span className="badge badge-warn">Se retuvo {formatUSD(item.ops.deposit_usd - (item.ops.deposit_returned_usd ?? 0))}</span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      {s.contact_phone ? (
        <a className="ops-call" href={`tel:${s.contact_phone.replace(/[^0-9+]/g, '')}`}>
          <Icon name="phone" /> Llamar · {s.contact_phone}
        </a>
      ) : null}
    </article>
  );
}

function MethodsSummary({ data, today }: { data: StaffData; today: string }) {
  const from = `${today.slice(0, 8)}01`;
  const by = paymentsByMethod(data.payments, from, today);
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  if (!total) return null;
  return (
    <section className="section" aria-labelledby="h-metodos">
      <div className="section-head">
        <h2 id="h-metodos">Cobrado este mes</h2>
        <span className="badge num">{formatUSD(total)}</span>
      </div>
      <div className="panel panel-pad">
        {PAY_METHODS.filter((m) => by.get(m.id)).map((m) => (
          <div key={m.id} className="kv">
            <span>{m.label}</span>
            <span className="amount">{formatUSD(by.get(m.id)!)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Hojas: cobrar, garantía, caja
// ---------------------------------------------------------------------
export function PaymentSheet({
  stay,
  today,
  receiver,
  staffName,
  onClose,
  onSave,
}: {
  stay: Pick<StaffStay, 'id' | 'contact_name' | 'total_usd' | 'paid_usd'> | null;
  today: string;
  receiver: Receiver | 'choose';
  staffName: string;
  onClose: () => void;
  onSave: (p: PaymentInput) => Promise<boolean>;
}) {
  return (
    <BottomSheet open={!!stay} onClose={onClose} label="Anotar un pago">
      {stay ? <PaymentForm key={stay.id} stay={stay} today={today} receiver={receiver} staffName={staffName} onClose={onClose} onSave={onSave} /> : null}
    </BottomSheet>
  );
}

function PaymentForm({
  stay,
  today,
  receiver,
  staffName,
  onClose,
  onSave,
}: {
  stay: Pick<StaffStay, 'id' | 'contact_name' | 'total_usd' | 'paid_usd'>;
  today: string;
  receiver: Receiver | 'choose';
  staffName: string;
  onClose: () => void;
  onSave: (p: PaymentInput) => Promise<boolean>;
}) {
  const due = balanceDue(stay);
  const [amount, setAmount] = useState(due ? String(due) : '');
  const [method, setMethod] = useState<PayMethod>(receiver === 'staff' ? 'efectivo_usd' : 'pago_movil');
  const [who, setWho] = useState<Receiver>(receiver === 'choose' ? 'owner' : receiver);
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const needsRef = ['pago_movil', 'transferencia', 'zelle', 'binance'].includes(method);
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaving(true);
        const ok = await onSave({ reservation_id: stay.id, amount_usd: parseMoney(amount), method, received_by: who, paid_on: date, reference, note: '' });
        setSaving(false);
        if (ok) onClose();
      }}
    >
      <h2>Anotar un pago</h2>
      <p className="muted small">
        {stay.contact_name}
        {stay.total_usd ? ` · total ${formatUSD(stay.total_usd)} · ${due ? `falta ${formatUSD(due)}` : 'ya está pagada'}` : ''}
      </p>
      <div className="field">
        <label htmlFor="pay-amount">Monto en dólares</label>
        <input id="pay-amount" className="input input-big" inputMode="decimal" autoComplete="off" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <span className="field-label" id="lbl-metodo">
          ¿Cómo pagó?
        </span>
        <div className="segmented wrap" role="radiogroup" aria-labelledby="lbl-metodo">
          {PAY_METHODS.map((m) => (
            <label key={m.id} className="chip">
              <input type="radio" name="pay-method" checked={method === m.id} onChange={() => setMethod(m.id)} />
              <span>{m.label}</span>
            </label>
          ))}
        </div>
      </div>
      {receiver === 'choose' ? (
        <div className="field">
          <span className="field-label" id="lbl-quien">
            ¿Quién lo recibió?
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="lbl-quien">
            <label className="chip">
              <input type="radio" name="pay-who" checked={who === 'owner'} onChange={() => setWho('owner')} />
              <span>Yo</span>
            </label>
            <label className="chip">
              <input type="radio" name="pay-who" checked={who === 'staff'} onChange={() => setWho('staff')} />
              <span>{staffName}</span>
            </label>
          </div>
          {who === 'staff' && method === 'efectivo_usd' ? <span className="hint">Se suma al efectivo que guarda {staffName}.</span> : null}
        </div>
      ) : null}
      <div className="grid-2">
        <div className="field">
          <label htmlFor="pay-date">Fecha</label>
          <input id="pay-date" className="input" type="date" value={date} max={addDays(today, 1)} onChange={(e) => setDate(e.target.value)} />
        </div>
        {needsRef ? (
          <div className="field">
            <label htmlFor="pay-ref">Referencia</label>
            <input id="pay-ref" className="input" maxLength={60} autoComplete="off" placeholder="Opcional" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
        ) : null}
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={saving || !(parseMoney(amount) > 0)}>
        {saving ? <span className="spinner" /> : <Icon name="check" />} Anotar {parseMoney(amount) > 0 ? formatUSD(parseMoney(amount)) : 'pago'} en {payMethodLabel(method).toLowerCase()}
      </button>
    </form>
  );
}

function DepositSheet({
  target,
  onClose,
  onSave,
}: {
  target: { item: AgendaItem; mode: 'in' | 'out' } | null;
  onClose: () => void;
  onSave: (patch: StayOpsPatch) => Promise<boolean>;
}) {
  return (
    <BottomSheet open={!!target} onClose={onClose} label={target?.mode === 'in' ? 'Recibir garantía' : 'Devolver garantía'}>
      {target ? <DepositForm key={`${target.item.stay.id}-${target.mode}`} target={target} onClose={onClose} onSave={onSave} /> : null}
    </BottomSheet>
  );
}

function DepositForm({ target, onClose, onSave }: { target: { item: AgendaItem; mode: 'in' | 'out' }; onClose: () => void; onSave: (patch: StayOpsPatch) => Promise<boolean> }) {
  const o = target.item.ops;
  const [amount, setAmount] = useState(String(o.deposit_usd));
  const [note, setNote] = useState(o.note);
  const [saving, setSaving] = useState(false);
  const value = parseMoney(amount);
  const retained = target.mode === 'out' ? Math.max(0, o.deposit_usd - value) : 0;
  const invalid = target.mode === 'out' ? value > o.deposit_usd || (retained > 0 && !note.trim()) : false;
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaving(true);
        const ok = await onSave(
          target.mode === 'in'
            ? { deposit_usd: value, deposit_received_at: new Date().toISOString() }
            : { deposit_returned_usd: value, deposit_returned_at: new Date().toISOString(), note: note.trim() },
        );
        setSaving(false);
        if (ok) onClose();
      }}
    >
      <h2>{target.mode === 'in' ? 'Recibir la garantía' : 'Revisar y devolver la garantía'}</h2>
      <p className="muted small">
        {target.item.stay.contact_name}
        {target.mode === 'out' ? ` · dejaron ${formatUSD(o.deposit_usd)}` : ''}
      </p>
      <div className="field">
        <label htmlFor="dep-amount">{target.mode === 'in' ? 'Monto recibido' : 'Monto que se devuelve'}</label>
        <input id="dep-amount" className="input input-big" inputMode="decimal" autoComplete="off" value={amount} aria-invalid={invalid} onChange={(e) => setAmount(e.target.value)} />
        {target.mode === 'out' ? (
          <span className="hint">{retained > 0 ? `Se quedan ${formatUSD(retained)} en la caja por los daños.` : 'Todo en orden: se devuelve completa.'}</span>
        ) : (
          <span className="hint">Se devuelve al revisar el apartamento cuando se vayan.</span>
        )}
      </div>
      {target.mode === 'out' ? (
        <div className="field">
          <label htmlFor="dep-note">{retained > 0 ? '¿Qué pasó? (obligatorio)' : 'Nota (opcional)'}</label>
          <input id="dep-note" className="input" maxLength={500} autoComplete="off" placeholder="Ej: un vaso roto, toalla manchada" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      ) : null}
      <button className="btn btn-primary btn-block" type="submit" disabled={saving || invalid || value < 0}>
        {saving ? <span className="spinner" /> : <Icon name="check" />} {target.mode === 'in' ? `Recibí ${formatUSD(value)}` : `Devolví ${formatUSD(value)}`}
      </button>
    </form>
  );
}

function CashSheet({
  kind,
  today,
  balance,
  onClose,
  onSave,
}: {
  kind: CashKind | null;
  today: string;
  balance: number;
  onClose: () => void;
  onSave: (m: CashInput) => Promise<boolean>;
}) {
  return (
    <BottomSheet open={!!kind} onClose={onClose} label={kind === 'retiro' ? 'Registrar retiro' : 'Anotar gasto'}>
      {kind ? <CashForm key={kind} kind={kind} today={today} balance={balance} onClose={onClose} onSave={onSave} /> : null}
    </BottomSheet>
  );
}

function CashForm({ kind, today, balance, onClose, onSave }: { kind: CashKind; today: string; balance: number; onClose: () => void; onSave: (m: CashInput) => Promise<boolean> }) {
  const [amount, setAmount] = useState(kind === 'retiro' && balance > 0 ? String(balance) : '');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const value = parseMoney(amount);
  const tooMuch = value > balance && balance >= 0;
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setSaving(true);
        const ok = await onSave({ kind, amount_usd: value, happened_on: date, note });
        setSaving(false);
        if (ok) onClose();
      }}
    >
      <h2>{kind === 'retiro' ? 'Registrar retiro' : 'Anotar gasto'}</h2>
      <p className="muted small">En la caja hay {formatUSD(balance)}.</p>
      <div className="field">
        <label htmlFor="cash-amount">{kind === 'retiro' ? 'Monto que retiraste' : 'Monto gastado'}</label>
        <input id="cash-amount" className="input input-big" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
        {tooMuch ? <span className="hint">Es más de lo que hay en la caja; revisa el monto.</span> : null}
      </div>
      <div className="field">
        <label htmlFor="cash-note">{kind === 'gasto' ? '¿En qué se gastó?' : 'Nota (opcional)'}</label>
        <input
          id="cash-note"
          className="input"
          maxLength={200}
          autoComplete="off"
          placeholder={kind === 'gasto' ? 'Ej: detergente, cloro, bombillo' : ''}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="cash-date">Fecha</label>
        <input id="cash-date" className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={saving || !(value > 0) || (kind === 'gasto' && !note.trim())}>
        {saving ? <span className="spinner" /> : <Icon name="check" />} {kind === 'retiro' ? 'Anotar retiro' : 'Anotar gasto'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------
// Recibí efectivo: de un huésped de la agenda (cuenta como pago de su estadía)
// o de otra persona (queda en la caja con su nombre)
// ---------------------------------------------------------------------
type IncomeInput = { amount: number; date: string; reason: string } & ({ type: 'stay'; stayId: string } | { type: 'other'; name: string });

function IncomeSheet({
  open,
  view,
  name,
  stays,
  today,
  onClose,
  onSave,
}: {
  open: boolean;
  view: View;
  name: string;
  stays: StaffStay[];
  today: string;
  onClose: () => void;
  onSave: (r: IncomeInput) => Promise<boolean>;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} label="Recibí efectivo">
      {open ? <IncomeForm view={view} name={name} stays={stays} today={today} onClose={onClose} onSave={onSave} /> : null}
    </BottomSheet>
  );
}

/** Huéspedes que pueden estar entregando efectivo: los que llegan pronto, están o se fueron hace poco. */
export function incomeCandidates(stays: StaffStay[], today: string): StaffStay[] {
  const from = addDays(today, -10);
  const to = addDays(today, 30);
  const dist = (s: StaffStay) => Math.abs(Date.parse(s.check_in) - Date.parse(today));
  return stays
    .filter((s) => s.status !== 'cancelada' && s.check_out >= from && s.check_in <= to)
    .sort((a, b) => dist(a) - dist(b))
    .slice(0, 6);
}

function IncomeForm({
  view,
  name,
  stays,
  today,
  onClose,
  onSave,
}: {
  view: View;
  name: string;
  stays: StaffStay[];
  today: string;
  onClose: () => void;
  onSave: (r: IncomeInput) => Promise<boolean>;
}) {
  const options = useMemo(() => incomeCandidates(stays, today), [stays, today]);
  // nadie marcado de entrada: que Zuleika elija a conciencia de quién es el dinero
  const [who, setWho] = useState<string>('');
  const [amount, setAmount] = useState('');
  const [other, setOther] = useState('');
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(today);
  const [saving, setSaving] = useState(false);
  const value = parseMoney(amount);
  const stay = options.find((s) => s.id === who);
  const due = stay ? balanceDue(stay) : 0;
  const when = (s: StaffStay) =>
    s.check_in > today ? `llega ${formatDayMonth(s.check_in)}` : s.check_out < today ? `se fue ${formatDayMonth(s.check_out)}` : `hasta ${formatDayMonth(s.check_out)}`;
  const isOther = who === 'otra';
  const ready = value > 0 && (!!stay || (isOther && other.trim().length >= 2));
  return (
    <form
      className="stack"
      onSubmit={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!ready) return;
        setSaving(true);
        const base = { amount: value, date, reason: reason.trim() };
        const ok = await onSave(stay ? { ...base, type: 'stay', stayId: stay.id } : { ...base, type: 'other', name: other.trim() });
        setSaving(false);
        if (ok) onClose();
      }}
    >
      <h2>Recibí efectivo</h2>
      <p className="muted small">
        {view === 'staff'
          ? 'Dólares en efectivo que te entregaron para Oniris. Se suman a lo que guardas.'
          : `Dólares en efectivo que le entregaron a ${name}. Se suman a lo que guarda.`}
      </p>
      <div className="field">
        <label htmlFor="inc-amount">Monto en dólares</label>
        <input id="inc-amount" className="input input-big" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <span className="field-label" id="lbl-entrego">
          ¿Quién te lo entregó?
        </span>
        <div className="segmented wrap" role="radiogroup" aria-labelledby="lbl-entrego">
          {options.map((s) => (
            <label key={s.id} className="chip">
              <input type="radio" name="inc-who" checked={who === s.id} onChange={() => setWho(s.id)} />
              <span>
                {s.contact_name} <span className="tiny muted">· {when(s)}</span>
              </span>
            </label>
          ))}
          <label className="chip">
            <input type="radio" name="inc-who" checked={isOther} onChange={() => setWho('otra')} />
            <span>Otra persona</span>
          </label>
        </div>
        {stay ? (
          <span className="hint">{due > 0 ? `Se anota como pago de su estadía (le falta ${formatUSD(due)}).` : 'Se anota como pago de su estadía.'}</span>
        ) : null}
      </div>
      {isOther ? (
        <div className="field">
          <label htmlFor="inc-name">Nombre de quien lo entregó</label>
          <input id="inc-name" className="input" maxLength={60} autoComplete="off" placeholder="Ej: María González" value={other} onChange={(e) => setOther(e.target.value)} />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="inc-reason">¿Por qué? (opcional)</label>
        <input id="inc-reason" className="input" maxLength={120} autoComplete="off" placeholder="Ej: saldo de la estadía, adelanto" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="inc-date">Fecha</label>
        <input id="inc-date" className="input" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={saving || !ready}>
        {saving ? <span className="spinner" /> : <Icon name="check" />} Anotar {value > 0 ? formatUSD(value) : 'efectivo'} recibido
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------
// Corregir un movimiento de la caja (monto, fecha, nota) o borrarlo
// ---------------------------------------------------------------------
type FixValues = { amount: number; date: string; note: string };
type LedgerRef = NonNullable<LedgerEntry['ref']>;

function FixSheet({
  entry,
  data,
  today,
  onClose,
  onSave,
  onDelete,
}: {
  entry: LedgerEntry | null;
  data: StaffData;
  today: string;
  onClose: () => void;
  onSave: (ref: LedgerRef, v: FixValues) => Promise<boolean>;
  onDelete: (ref: LedgerRef) => Promise<boolean>;
}) {
  return (
    <BottomSheet open={!!entry?.ref} onClose={onClose} label="Corregir movimiento">
      {entry?.ref ? <FixForm key={entry.key} entry={entry} refx={entry.ref} data={data} today={today} onClose={onClose} onSave={onSave} onDelete={onDelete} /> : null}
    </BottomSheet>
  );
}

function FixForm({
  entry,
  refx,
  data,
  today,
  onClose,
  onSave,
  onDelete,
}: {
  entry: LedgerEntry;
  refx: LedgerRef;
  data: StaffData;
  today: string;
  onClose: () => void;
  onSave: (ref: LedgerRef, v: FixValues) => Promise<boolean>;
  onDelete: (ref: LedgerRef) => Promise<boolean>;
}) {
  const pay = refx.type === 'payment' ? data.payments.find((p) => p.id === refx.id) : undefined;
  const cash = refx.type === 'cash' ? data.cash.find((c) => c.id === refx.id) : undefined;
  const [amount, setAmount] = useState(String(Math.abs(pay?.amount_usd ?? cash?.amount_usd ?? 0)));
  const [date, setDate] = useState(pay?.paid_on ?? cash?.happened_on ?? today);
  const [note, setNote] = useState(pay?.note ?? cash?.note ?? '');
  const [saving, setSaving] = useState(false);
  const value = parseMoney(amount);
  const needsNote = cash?.kind === 'gasto' || cash?.kind === 'ingreso';
  const noteLabel = cash?.kind === 'gasto' ? '¿En qué se gastó?' : cash?.kind === 'ingreso' ? 'Quién lo entregó (y por qué)' : 'Nota (opcional)';
  const stayName = pay ? (data.stays.find((s) => s.id === pay.reservation_id)?.contact_name ?? '') : '';
  async function done(p: Promise<boolean>) {
    setSaving(true);
    const ok = await p;
    setSaving(false);
    if (ok) onClose();
  }
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        e.stopPropagation();
        done(onSave(refx, { amount: value, date, note: note.trim() }));
      }}
    >
      <h2>Corregir movimiento</h2>
      <p className="muted small">
        {entry.label}
        {stayName ? ` · ${stayName}` : ''} · anotado {formatUSD(Math.abs(entry.amount))}
      </p>
      <div className="field">
        <label htmlFor="fix-amount">Monto correcto en dólares</label>
        <input id="fix-amount" className="input input-big" inputMode="decimal" autoComplete="off" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="fix-note">{noteLabel}</label>
        <input id="fix-note" className="input" maxLength={200} autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="fix-date">Fecha</label>
        <input id="fix-date" className="input" type="date" value={date} max={addDays(today, 1)} onChange={(e) => setDate(e.target.value)} />
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={saving || !(value > 0) || (needsNote && note.trim().length < 2)}>
        {saving ? <span className="spinner" /> : <Icon name="check" />} Guardar {value > 0 ? formatUSD(value) : 'corrección'}
      </button>
      <button
        className="btn btn-ghost btn-block"
        type="button"
        disabled={saving}
        onClick={() => {
          if (!window.confirm('¿Borrar este movimiento de la caja?')) return;
          done(onDelete(refx));
        }}
      >
        <Icon name="trash" /> Borrar este movimiento
      </button>
    </form>
  );
}
