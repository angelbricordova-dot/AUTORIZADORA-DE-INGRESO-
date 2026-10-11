import { useApp } from '../context';
import { monthStats, pendingItems, todayMovements, balance, type PendingItem } from '../lib/availability';
import { formatDayMonth, formatLong, monthName, nightsBetween, weekdayShort } from '../lib/dates';
import { formatUSD } from '../lib/money';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { stayDates } from '../components/StayRow';

function PendingRow({ item, today }: { item: PendingItem; today: string }) {
  const r = item.reservation;
  if (item.kind === 'conflicto') {
    const o = item.other!;
    const target = r.status === 'tentativa' ? r : o;
    return (
      <a className="list-item" href={href(`/reserva/${target.id}`)}>
        <span className="lead-icon lead-bad">
          <Icon name="alert" />
        </span>
        <span className="grow">
          <span className="title" style={{ display: 'block' }}>
            Fechas que chocan
          </span>
          <span className="sub" style={{ display: 'block' }}>
            {r.contact_name} y {o.contact_name} · {formatDayMonth(r.check_in > o.check_in ? r.check_in : o.check_in)}
          </span>
        </span>
        <Icon name="chevronRight" className="chev" />
      </a>
    );
  }
  if (item.kind === 'autorizacion') {
    const days = nightsBetween(today, r.check_in);
    const when = days <= 0 ? 'ya llegaron' : days === 1 ? 'llegan mañana' : `llegan el ${weekdayShort(r.check_in)} ${formatDayMonth(r.check_in)}`;
    return (
      <a className="list-item" href={href(`/autorizacion/${r.id}`)}>
        <span className={`lead-icon ${item.urgent ? 'lead-warn' : 'lead-ok'}`} style={item.urgent ? undefined : { background: 'var(--lona-soft)', color: 'var(--lona)' }}>
          <Icon name="idcard" />
        </span>
        <span className="grow">
          <span className="title" style={{ display: 'block' }}>
            {r.contact_name}
          </span>
          <span className="sub" style={{ display: 'block' }}>
            {r.auth_status === 'generada' ? 'Planilla lista, falta enviarla' : 'Falta la autorización'} · {when}
          </span>
        </span>
        <Icon name="chevronRight" className="chev" />
      </a>
    );
  }
  return (
    <a className="list-item" href={href(`/reserva/${r.id}`)}>
      <span className="lead-icon lead-warn">
        <Icon name="money" />
      </span>
      <span className="grow">
        <span className="title" style={{ display: 'block' }}>
          {r.contact_name}
        </span>
        <span className="sub" style={{ display: 'block' }}>
          Debe {formatUSD(balance(r))} de {formatUSD(r.total_usd)} · entra {formatDayMonth(r.check_in)}
        </span>
      </span>
      <Icon name="chevronRight" className="chev" />
    </a>
  );
}

export function HomePage() {
  const { data, today } = useApp();
  const all = data.reservations;
  const items = pendingItems(all, today);
  const mv = todayMovements(all, today);
  const monthStart = today.slice(0, 8) + '01';
  const stats = monthStats(all, monthStart);
  const owed = all.filter((r) => r.status === 'confirmada' && r.check_out > today).reduce((s, r) => s + balance(r), 0);
  const m = Number(today.slice(5, 7)) - 1;

  const movement: { when: string; text: string; id: string; sub: string }[] = [];
  mv.departures.forEach((r) => movement.push({ when: 'Sale hoy', text: r.contact_name, id: r.id, sub: 'Entrega antes del mediodía' }));
  mv.arrivals.forEach((r) => movement.push({ when: 'Entra hoy', text: r.contact_name, id: r.id, sub: `${r.guests.length || '¿?'} personas · ${stayDates(r)}` }));
  if (mv.inHouse && !mv.arrivals.includes(mv.inHouse))
    movement.push({ when: 'En casa', text: mv.inHouse.contact_name, id: mv.inHouse.id, sub: `Sale el ${formatLong(mv.inHouse.check_out)}` });
  if (mv.next) movement.push({ when: 'Próxima', text: mv.next.contact_name, id: mv.next.id, sub: `Entra el ${formatLong(mv.next.check_in)}` });

  return (
    <div className="page">
      <section className="section" aria-labelledby="h-pend">
        <div className="section-head">
          <h2 id="h-pend">Pendiente</h2>
          {items.length ? <span className="muted small">{items.length}</span> : null}
        </div>
        <div className="panel list">
          {items.length ? (
            items.map((it, i) => <PendingRow key={`${it.kind}-${it.reservation.id}-${i}`} item={it} today={today} />)
          ) : (
            <div className="empty">
              <span className="badge badge-ok">
                <Icon name="check" /> Todo al día
              </span>
              <p className="muted small">No hay autorizaciones por enviar, saldos por cobrar ni fechas que choquen en los próximos 30 días.</p>
            </div>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="h-hoy">
        <div className="section-head">
          <h2 id="h-hoy">Movimiento</h2>
          <a className="link" href={href('/calendario')}>
            Ver calendario
          </a>
        </div>
        <div className="panel today">
          {movement.length ? (
            movement.map((x) => (
              <a key={x.when + x.id} className="today-row" href={href(`/reserva/${x.id}`)}>
                <span className="when">{x.when}</span>
                <span className="grow" style={{ minWidth: 0, flex: 1 }}>
                  <span className="title" style={{ display: 'block', fontWeight: 650 }}>
                    {x.text}
                  </span>
                  <span className="sub muted small" style={{ display: 'block' }}>
                    {x.sub}
                  </span>
                </span>
                <Icon name="chevronRight" className="chev" style={{ width: 18, height: 18, color: 'var(--line-strong)' }} />
              </a>
            ))
          ) : (
            <div className="empty">
              <p className="muted">No hay estadías próximas. Cuando alguien reserve, regístrala para ver aquí quién entra y quién sale.</p>
              <a className="btn btn-secondary btn-small" href={href('/reserva/nueva')}>
                <Icon name="plus" /> Registrar estadía
              </a>
            </div>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="h-mes">
        <h2 id="h-mes" style={{ textTransform: 'capitalize' }}>
          {monthName(m)}
        </h2>
        <div className="panel panel-pad stack" style={{ gap: 12 }}>
          <div className="occupancy" role="img" aria-label={`Ocupación ${Math.round(stats.occupancy * 100)}%`}>
            <div style={{ width: `${Math.round(stats.occupancy * 100)}%` }} />
          </div>
          <div className="month-line">
            <span>
              <b>{stats.occupied}</b> de {stats.nights} noches ocupadas
            </span>
            <span>
              <b>{formatUSD(stats.revenue)}</b> facturado
            </span>
            <span>
              <b>{formatUSD(owed)}</b> por cobrar
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
