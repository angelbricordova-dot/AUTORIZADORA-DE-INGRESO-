import { useMemo, useState, type FormEvent } from 'react';
import { useApp } from '../context';
import { CHANNELS, STAY_TYPES, type Channel, type ReservationInput, type ReservationStatus, type StayType } from '../lib/types';
import { addDays, formatDayMonth, isValidISO, nightsBetween } from '../lib/dates';
import { balance, conflictsFor } from '../lib/availability';
import { formatUSD, parseMoney } from '../lib/money';
import { go, href } from '../router';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { AuthBadge } from '../components/StayRow';

const STATUSES: { id: ReservationStatus; label: string }[] = [
  { id: 'confirmada', label: 'Confirmada' },
  { id: 'tentativa', label: 'Tentativa' },
  { id: 'cancelada', label: 'Cancelada' },
];

export function ReservationForm({ id, query }: { id?: string; query: URLSearchParams }) {
  const { data, store, reload, today } = useApp();
  const toast = useToast();
  const existing = id ? data.reservations.find((r) => r.id === id) : undefined;
  const qIn = query.get('in');
  const qOut = query.get('out');
  const thenAuth = query.get('then') === 'auth';

  const [f, setF] = useState(() => ({
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
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  const nights = isValidISO(f.check_in) && isValidISO(f.check_out) ? nightsBetween(f.check_in, f.check_out) : 0;
  const conflicts = useMemo(
    () => (nights > 0 ? conflictsFor({ id: id ?? '__new', check_in: f.check_in, check_out: f.check_out, status: f.status }, data.reservations) : []),
    [nights, id, f.check_in, f.check_out, f.status, data.reservations],
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
      contact_name: f.contact_name,
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
      await reload();
      toast(id ? 'Estadía actualizada' : 'Estadía registrada');
      go(thenAuth ? `/autorizacion/${savedId}` : id ? `/reserva/${savedId}` : '/reservas');
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
  const paid = parseMoney(f.paid);

  return (
    <form className="page" onSubmit={onSubmit} noValidate>
      <div className="row">
        <a className="icon-btn" href={href(id ? '/reservas' : '/')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <h1>{id ? existing!.contact_name : thenAuth ? 'Nueva estadía' : 'Registrar estadía'}</h1>
      </div>

      {existing ? (
        <div className="panel panel-pad spread" style={{ flexWrap: 'wrap' }}>
          <div className="stack" style={{ gap: 6, alignItems: 'flex-start' }}>
            <AuthBadge r={existing} />
            <span className="muted small">
              {existing.guests.length ? `${existing.guests.length} personas · ${existing.vehicles.length} vehículos` : 'Aún no hay personas cargadas'}
            </span>
          </div>
          <a className="btn btn-primary btn-small" href={href(`/autorizacion/${existing.id}`)}>
            <Icon name="idcard" /> {existing.auth_status === 'pendiente' ? 'Hacer autorización' : 'Ver autorización'}
          </a>
        </div>
      ) : thenAuth ? (
        <p className="muted">Primero los datos de la estadía; después cargas las cédulas.</p>
      ) : null}

      <section className="section" aria-labelledby="h-fechas">
        <h2 id="h-fechas">Fechas</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="in">Entrada</label>
            <input id="in" className="input" type="date" required value={f.check_in} onChange={(e) => set('check_in', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="out">Salida</label>
            <input
              id="out"
              className="input"
              type="date"
              required
              min={f.check_in}
              value={f.check_out}
              aria-invalid={nights < 1}
              onChange={(e) => set('check_out', e.target.value)}
            />
          </div>
        </div>
        <p className="hint">{nights >= 1 ? `${nights} ${nights === 1 ? 'noche' : 'noches'}` : 'La salida debe ser después de la entrada.'}</p>
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

      <section className="section" aria-labelledby="h-quien">
        <h2 id="h-quien">Quién reserva</h2>
        <div className="field">
          <label htmlFor="name">Nombre o grupo</label>
          <input
            id="name"
            className="input"
            autoComplete="off"
            maxLength={120}
            placeholder="Ej: Familia Rodríguez"
            value={f.contact_name}
            onChange={(e) => set('contact_name', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="phone">Teléfono</label>
          <input
            id="phone"
            className="input"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            maxLength={20}
            placeholder="0414 555 0000"
            value={f.contact_phone}
            onChange={(e) => set('contact_phone', e.target.value)}
          />
        </div>
        <div className="field">
          <span className="field-label" id="lbl-canal">
            Canal
          </span>
          <div className="segmented" role="radiogroup" aria-labelledby="lbl-canal">
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
      </section>

      <section className="section" aria-labelledby="h-estado">
        <h2 id="h-estado">Estado y pago</h2>
        <div className="segmented" role="radiogroup" aria-labelledby="h-estado">
          {STATUSES.map((s) => (
            <label key={s.id} className="chip">
              <input type="radio" name="status" checked={f.status === s.id} onChange={() => set('status', s.id)} />
              <span>{s.label}</span>
            </label>
          ))}
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="total">Total (USD)</label>
            <input id="total" className="input" inputMode="decimal" placeholder="0" value={f.total} onChange={(e) => set('total', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="paid">Pagado (USD)</label>
            <input id="paid" className="input" inputMode="decimal" placeholder="0" value={f.paid} onChange={(e) => set('paid', e.target.value)} />
          </div>
        </div>
        <p className="hint">
          {total > 0
            ? balance({ total_usd: total, paid_usd: paid }) > 0
              ? `Falta por cobrar ${formatUSD(balance({ total_usd: total, paid_usd: paid }))}${nights ? ` · ${formatUSD(total / nights)} por noche` : ''}`
              : `Pagado completo${nights ? ` · ${formatUSD(total / nights)} por noche` : ''}`
            : 'Anota el monto acordado para llevar la cuenta.'}
        </p>
        <div className="field">
          <label htmlFor="tipo">Tipo de estadía (para la planilla)</label>
          <select id="tipo" className="select input" value={f.stay_type} onChange={(e) => set('stay_type', e.target.value as StayType)}>
            {STAY_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="notes">Notas</label>
          <textarea
            id="notes"
            className="textarea"
            maxLength={1000}
            placeholder="Hora de llegada, mascotas, lo que haga falta recordar"
            value={f.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>
      </section>

      {error ? (
        <div className="notice notice-bad" role="alert">
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="actionbar">
        <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
          {saving ? <span className="spinner" /> : <Icon name="check" />}
          {thenAuth ? 'Guardar y seguir con las cédulas' : id ? 'Guardar cambios' : 'Guardar estadía'}
        </button>
        {id ? (
          <button className="btn btn-danger btn-block btn-small" type="button" onClick={onDelete}>
            <Icon name="trash" /> Eliminar estadía
          </button>
        ) : null}
      </div>
    </form>
  );
}
