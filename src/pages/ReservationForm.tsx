import { useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../context';
import { CHANNELS, PAY_METHODS, STAY_TYPES, payMethodLabel, type Channel, type PayMethod, type Receiver, type Reservation, type ReservationInput, type ReservationStatus, type StayType } from '../lib/types';
import { addDays, formatDayMonth, isValidISO, nightsBetween } from '../lib/dates';
import { balance, conflictsFor } from '../lib/availability';
import { formatUSD, parseMoney } from '../lib/money';
import { go, href } from '../router';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { AuthBadge } from '../components/StayRow';
import { PropertyChips } from '../components/PropertyChips';
import { PaymentSheet } from '../components/Ops';
import { surveyLink } from './Reviews';
import { whatsappUrl } from '../lib/publicAvailability';

const STATUSES: { id: ReservationStatus; label: string }[] = [
  { id: 'confirmada', label: 'Confirmada' },
  { id: 'tentativa', label: 'Tentativa' },
  { id: 'cancelada', label: 'Cancelada' },
];

export function defaultStayName(checkIn: string): string {
  return `Huéspedes del ${formatDayMonth(checkIn)}`;
}

export function ReservationForm({ id, query }: { id?: string; query: URLSearchParams }) {
  const { data, store, reload, today, ownId } = useApp();
  const toast = useToast();
  const existing = id ? data.reservations.find((r) => r.id === id) : undefined;
  const qIn = query.get('in');
  const qOut = query.get('out');
  const qApto = query.get('apto');

  const [f, setF] = useState(() => ({
    property_id: existing?.property_id ?? (qApto && data.properties.some((p) => p.id === qApto) ? qApto : ownId),
    contact_name: existing?.contact_name ?? '',
    contact_phone: existing?.contact_phone ?? '',
    channel: (existing?.channel ?? 'whatsapp') as Channel,
    check_in: existing?.check_in ?? (qIn && isValidISO(qIn) ? qIn : addDays(today, 1)),
    check_out: existing?.check_out ?? (qOut && isValidISO(qOut) ? qOut : addDays(today, 2)),
    stay_type: (existing?.stay_type ?? 'Alquiler Vacacional') as StayType,
    status: (existing?.status ?? 'confirmada') as ReservationStatus,
    total: existing ? String(existing.total_usd || '') : '',
    paid: existing ? String(existing.paid_usd || '') : '',
    notes: existing?.notes ?? '',
    // abono al registrar una estadía nueva
    deposit: '',
    method: 'pago_movil' as PayMethod,
    who: 'owner' as Receiver,
  }));
  const paymentsReady = !data.migrationPending;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const nights = isValidISO(f.check_in) && isValidISO(f.check_out) ? nightsBetween(f.check_in, f.check_out) : 0;
  const conflicts = useMemo(
    () =>
      nights > 0
        ? conflictsFor({ id: id ?? '__new', property_id: f.property_id, check_in: f.check_in, check_out: f.check_out, status: f.status }, data.reservations)
        : [],
    [nights, id, f.property_id, f.check_in, f.check_out, f.status, data.reservations],
  );

  if (id && !existing) {
    return (
      <div className="page">
        <h1>No encontramos esa estadía</h1>
        <a className="btn btn-secondary" href={href('/reservas')}>
          Ver estadías
        </a>
      </div>
    );
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const input: ReservationInput = {
      id,
      property_id: f.property_id,
      contact_name: f.contact_name.trim() || defaultStayName(f.check_in),
      contact_phone: f.contact_phone,
      channel: f.channel,
      check_in: f.check_in,
      check_out: f.check_out,
      stay_type: f.stay_type,
      status: f.status,
      total_usd: parseMoney(f.total),
      paid_usd: parseMoney(f.paid),
      notes: f.notes,
    };
    try {
      const savedId = await store.saveReservation(input);
      const abono = parseMoney(f.deposit);
      if (!id && paymentsReady && abono > 0) {
        await store.addPayment({ reservation_id: savedId, amount_usd: abono, method: f.method, received_by: f.who, paid_on: today, reference: '', note: 'Abono al reservar' });
      }
      await reload();
      toast(id ? 'Estadía actualizada' : 'Estadía registrada');
      go(id ? `/reserva/${savedId}` : '/reservas');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!id || !window.confirm('¿Eliminar esta estadía y su autorización? No se puede deshacer.')) return;
    try {
      await store.deleteReservation(id);
      await reload();
      toast('Estadía eliminada');
      go('/reservas');
    } catch (err) {
      toast((err as Error).message, 'bad');
    }
  }

  const total = parseMoney(f.total);
  const paid = paymentsReady ? (existing?.paid_usd ?? 0) + (id ? 0 : parseMoney(f.deposit)) : parseMoney(f.paid);

  return (
    <form className="page" onSubmit={onSubmit} noValidate>
      <div className="page-head">
        <a className="icon-btn" href={href(id ? '/reservas' : '/')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <div className="grow">
          <h1>{id ? existing!.contact_name : 'Registrar estadía'}</h1>
          {!id ? <div className="sub">Solo las fechas son obligatorias</div> : null}
        </div>
      </div>

      {existing ? (
        <a className="panel panel-pad spread" href={href(`/autorizacion/${existing.id}`)} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="stack" style={{ gap: 6, alignItems: 'flex-start' }}>
            <AuthBadge r={existing} />
            <span className="muted small">
              {existing.guests.length ? `${existing.guests.length} personas · ${existing.vehicles.length} vehículos` : 'Aún no hay personas cargadas'}
            </span>
          </div>
          <span className="btn btn-primary btn-small">
            <Icon name="idcard" /> {existing.auth_status === 'pendiente' ? 'Autorización' : 'Ver'}
          </span>
        </a>
      ) : null}

      {existing && paymentsReady ? <PaymentsSection r={existing} total={total} /> : null}

      {existing && existing.status !== 'cancelada' && existing.check_out <= today ? (
        <a
          className="panel panel-pad spread ask-review"
          href={whatsappUrl(
            existing.contact_phone.replace(/^0/, '58'),
            `¡Hola! Gracias por quedarte con nosotros en Tucacas. ¿Nos regalas 2 minutos para contarnos cómo te fue? ${surveyLink(data.properties.find((p) => p.id === existing.property_id)?.unit ?? '30')}`,
          )}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span>
            <strong>Pedir su opinión</strong>
            <span className="small muted" style={{ display: 'block' }}>
              Le llega la encuesta de la estadía por WhatsApp
            </span>
          </span>
          <span className="btn btn-whatsapp btn-small" aria-hidden="true">
            <Icon name="send" /> Enviar
          </span>
        </a>
      ) : null}

      <section className="section" aria-labelledby="h-fechas">
        <h2 id="h-fechas">Fechas</h2>
        <div className="date-pair">
          <div className="field">
            <label htmlFor="in">Entrada</label>
            <input id="in" className="input" type="date" required value={f.check_in} onChange={(e) => set('check_in', e.target.value)} />
          </div>
          <span className="arrow" aria-hidden="true">
            <Icon name="arrowLeft" />
          </span>
          <div className="field">
            <label htmlFor="out">Salida</label>
            <input id="out" className="input" type="date" required min={f.check_in} value={f.check_out} aria-invalid={nights < 1} onChange={(e) => set('check_out', e.target.value)} />
          </div>
        </div>
        <p className="hint">{nights >= 1 ? `${nights} ${nights === 1 ? 'noche' : 'noches'}` : 'La salida debe ser después de la entrada.'}</p>
        <PropertyChips properties={data.properties} value={f.property_id} onChange={(v) => set('property_id', v)} name="form-apto" />
        {conflicts.length ? (
          <div className={`notice ${f.status === 'confirmada' && conflicts.some((c) => c.status === 'confirmada') ? 'notice-bad' : 'notice-warn'}`} role="alert">
            <Icon name="alert" />
            <span>
              Choca con{' '}
              {conflicts.map((c, i) => (
                <span key={c.id}>
                  {i ? ' y ' : ''}
                  <strong>{c.contact_name}</strong> ({formatDayMonth(c.check_in)} → {formatDayMonth(c.check_out)}, {c.status})
                </span>
              ))}
              . {f.status === 'confirmada' ? 'Guárdala como tentativa o cambia las fechas.' : 'Queda como tentativa para ofrecerle otra opción.'}
            </span>
          </div>
        ) : null}
      </section>

      <div className="field">
        <label htmlFor="name">Nombre o grupo (opcional)</label>
        <input
          id="name"
          className="input"
          autoComplete="off"
          maxLength={120}
          placeholder={defaultStayName(f.check_in)}
          value={f.contact_name}
          onChange={(e) => set('contact_name', e.target.value)}
        />
      </div>

      <details className="disclosure" open={!!existing}>
        <summary>
          <Icon name="money" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
          Canal, pago y notas
          <Icon name="chevronRight" className="chev" />
        </summary>
        <div className="disclosure-body">
          <div className="field">
            <span className="field-label" id="lbl-canal">
              Canal
            </span>
            <div className="segmented scroll" role="radiogroup" aria-labelledby="lbl-canal">
              {CHANNELS.map((c) => (
                <label key={c.id} className="chip" data-channel={c.id}>
                  <input type="radio" name="channel" checked={f.channel === c.id} onChange={() => set('channel', c.id)} />
                  <span>
                    <span className="swatch" /> {c.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div className="field">
            <span className="field-label" id="lbl-estado">
              Estado
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="lbl-estado">
              {STATUSES.map((s) => (
                <label key={s.id} className="chip">
                  <input type="radio" name="status" checked={f.status === s.id} onChange={() => set('status', s.id)} />
                  <span>{s.label}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="total">Total (USD)</label>
              <input id="total" className="input" inputMode="decimal" placeholder="0" value={f.total} onChange={(e) => set('total', e.target.value)} />
            </div>
            {!paymentsReady ? (
              <div className="field">
                <label htmlFor="paid">Pagado (USD)</label>
                <input id="paid" className="input" inputMode="decimal" placeholder="0" value={f.paid} onChange={(e) => set('paid', e.target.value)} />
              </div>
            ) : !id ? (
              <div className="field">
                <label htmlFor="abono">Abono recibido</label>
                <input id="abono" className="input" inputMode="decimal" placeholder="0" value={f.deposit} onChange={(e) => set('deposit', e.target.value)} />
              </div>
            ) : null}
          </div>
          {paymentsReady && !id && parseMoney(f.deposit) > 0 ? (
            <div className="field">
              <span className="field-label" id="lbl-abono">
                ¿Cómo pagó el abono?
              </span>
              <div className="segmented wrap" role="radiogroup" aria-labelledby="lbl-abono">
                {PAY_METHODS.map((m) => (
                  <label key={m.id} className="chip">
                    <input type="radio" name="abono-method" checked={f.method === m.id} onChange={() => set('method', m.id)} />
                    <span>{m.label}</span>
                  </label>
                ))}
              </div>
              <div className="segmented" role="radiogroup" aria-label="¿Quién recibió el abono?">
                <label className="chip">
                  <input type="radio" name="abono-who" checked={f.who === 'owner'} onChange={() => set('who', 'owner')} />
                  <span>Lo recibí yo</span>
                </label>
                <label className="chip">
                  <input type="radio" name="abono-who" checked={f.who === 'staff'} onChange={() => set('who', 'staff')} />
                  <span>Lo recibió {data.settings.staff_name}</span>
                </label>
              </div>
            </div>
          ) : null}
          {total > 0 ? (
            <p className="hint">
              {balance({ total_usd: total, paid_usd: paid }) > 0 ? `Falta por cobrar ${formatUSD(balance({ total_usd: total, paid_usd: paid }))}` : 'Pagado completo'}
              {nights ? ` · ${formatUSD(total / nights)} por noche` : ''}
            </p>
          ) : null}
          <div className="field">
            <label htmlFor="phone">Teléfono</label>
            <input id="phone" className="input" type="tel" inputMode="tel" autoComplete="off" maxLength={20} placeholder="0414 555 0000" value={f.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="tipo">Tipo de estadía (para la planilla)</label>
            <select id="tipo" className="input" value={f.stay_type} onChange={(e) => set('stay_type', e.target.value as StayType)}>
              {STAY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="notes">Notas</label>
            <textarea id="notes" className="textarea" maxLength={1000} placeholder="Hora de llegada, mascotas, lo que haga falta recordar" value={f.notes} onChange={(e) => set('notes', e.target.value)} />
          </div>
        </div>
      </details>

      {error ? (
        <div className="notice notice-bad" role="alert">
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="actionbar">
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? <span className="spinner" /> : <Icon name="check" />}
          {id ? 'Guardar cambios' : 'Guardar estadía'}
        </button>
        {id ? (
          <button className="btn btn-ghost btn-block btn-small" style={{ color: 'var(--bad)' }} type="button" onClick={onDelete}>
            <Icon name="trash" /> Eliminar estadía
          </button>
        ) : null}
      </div>
    </form>
  );
}

function PaymentsSection({ r, total }: { r: Reservation; total: number }) {
  const { data, store, reload, today } = useApp();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const list = data.payments.filter((p) => p.reservation_id === r.id).sort((a, b) => a.paid_on.localeCompare(b.paid_on));
  const due = Math.max(0, Math.round((total - r.paid_usd) * 100) / 100);
  const staff = data.settings.staff_name;
  return (
    <section className="section" aria-labelledby="h-pagos">
      <div className="section-head">
        <h2 id="h-pagos">Pagos</h2>
        {total > 0 ? <span className={`badge ${due > 0 ? 'badge-warn' : 'badge-ok'}`}>{due > 0 ? `Falta ${formatUSD(due)}` : 'Pagada'}</span> : null}
      </div>
      <div className="panel list">
        {list.map((p) => (
          <div key={p.id} className="list-item">
            <span className={`lead-icon ${p.method === 'efectivo_usd' ? 'lead-ok' : 'lead-brand'}`}>
              <Icon name={p.method === 'efectivo_usd' ? 'wallet' : 'money'} />
            </span>
            <span className="grow">
              <span className="title">
                {payMethodLabel(p.method)} · <span className="amount">{formatUSD(p.amount_usd)}</span>
              </span>
              <span className="sub">
                {formatDayMonth(p.paid_on)} · {p.received_by === 'staff' ? `lo tiene ${staff}` : 'lo recibiste tú'}
                {p.reference ? ` · ${p.reference}` : ''}
              </span>
            </span>
            <button
              className="icon-btn flat"
              type="button"
              aria-label={`Borrar el pago de ${formatUSD(p.amount_usd)}`}
              onClick={async () => {
                if (!window.confirm('¿Borrar este pago?')) return;
                try {
                  await store.deletePayment(p.id);
                  await reload();
                  toast('Pago borrado');
                } catch (e) {
                  toast((e as Error).message, 'bad');
                }
              }}
            >
              <Icon name="trash" />
            </button>
          </div>
        ))}
        <button className="list-item add-row" type="button" onClick={() => setOpen(true)}>
          <span className="lead-icon lead-brand">
            <Icon name="plus" />
          </span>
          <span className="grow">
            <span className="title">Anotar un pago</span>
            <span className="sub">Efectivo, pago móvil, transferencia, Zelle…</span>
          </span>
        </button>
      </div>
      <PaymentSheet
        stay={open ? { id: r.id, contact_name: r.contact_name, total_usd: total, paid_usd: r.paid_usd } : null}
        today={today}
        receiver="choose"
        staffName={staff}
        onClose={() => setOpen(false)}
        onSave={async (p) => {
          try {
            await store.addPayment(p);
            await reload();
            toast('Pago anotado');
            return true;
          } catch (e) {
            toast((e as Error).message, 'bad');
            return false;
          }
        }}
      />
    </section>
  );
}
