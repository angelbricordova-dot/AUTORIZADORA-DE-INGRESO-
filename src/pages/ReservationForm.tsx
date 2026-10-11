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
import { PropertyChips } from '../components/PropertyChips';

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
  }));
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
  const paid = parseMoney(f.paid);

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
            <div className="field">
              <label htmlFor="paid">Pagado (USD)</label>
              <input id="paid" className="input" inputMode="decimal" placeholder="0" value={f.paid} onChange={(e) => set('paid', e.target.value)} />
            </div>
          </div>
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
