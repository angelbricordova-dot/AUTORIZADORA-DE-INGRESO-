import type { CSSProperties } from 'react';
import { useApp } from '../context';
import { monthStats, pendingItems, todayMovements, balance, nightsWithin, type PendingItem } from '../lib/availability';
import { addDays, formatDayMonth, formatLong, monthName, nightsBetween, weekdayShort } from '../lib/dates';
import { formatUSD } from '../lib/money';
import { commission, propertyLabel, type Property } from '../lib/types';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { Strip } from '../components/Strip';
import { cashBalance, depositsHeld, pendingToday, staffStaysFromApp, withdrawHint } from '../lib/ops';

function PendingRow({ item, today, prop }: { item: PendingItem; today: string; prop?: Property }) {
  const r = item.reservation;
  const where = prop && prop.kind === 'aliado' ? ` · ${propertyLabel(prop)}` : '';
  if (item.kind === 'conflicto') {
    const o = item.other!;
    const target = r.status === 'tentativa' ? r : o;
    return (
      <a className="list-item" href={href(`/reserva/${target.id}`)}>
        <span className="lead-icon lead-bad">
          <Icon name="alert" />
        </span>
        <span className="grow">
          <span className="title">Fechas que chocan{where}</span>
          <span className="sub">
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
        <span className={`lead-icon ${item.urgent ? 'lead-warn' : 'lead-brand'}`}>
          <Icon name="idcard" />
        </span>
        <span className="grow">
          <span className="title">
            {r.contact_name}
            {where}
          </span>
          <span className="sub">
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
        <span className="title">
          {r.contact_name}
          {where}
        </span>
        <span className="sub">
          Debe {formatUSD(balance(r))} de {formatUSD(r.total_usd)} · entra {formatDayMonth(r.check_in)}
        </span>
      </span>
      <Icon name="chevronRight" className="chev" />
    </a>
  );
}

export function HomePage() {
  const { data, today, ownId } = useApp();
  const props = new Map(data.properties.map((p) => [p.id, p]));
  const own = data.reservations.filter((r) => r.property_id === ownId);
  const items = pendingItems(data.reservations, today);
  const mv = todayMovements(own, today);
  const monthStart = today.slice(0, 8) + '01';
  const monthEnd = addDays(monthStart, 40).slice(0, 8) + '01';
  const stats = monthStats(own, monthStart);
  const m = Number(today.slice(5, 7)) - 1;
  // saluda a quien entró (Alejandro, Oniris, Angélica…), no a la dueña de la planilla
  const firstName = (data.me?.name ?? '').split(' ')[0];

  // Comisión del mes: noches vendidas en apartamentos aliados × (precio público − costo del dueño)
  const commissionMonth = data.reservations
    .filter((r) => r.status === 'confirmada' && r.property_id !== ownId && r.total_usd > 0)
    .reduce((sum, r) => {
      const c = commission(props.get(r.property_id) ?? { nightly_usd: null, partner_cost_usd: null });
      return c ? sum + c * nightsWithin(r, monthStart, monthEnd) : sum;
    }, 0);

  let label = 'Hoy en el N°' + data.settings.unit;
  let big = 'Libre hoy';
  let meta = mv.next ? `Próxima llegada: ${mv.next.contact_name}, ${formatLong(mv.next.check_in)}` : 'No hay llegadas próximas registradas';
  let target = mv.next ? `/autorizacion/${mv.next.id}` : '/autorizacion';
  if (mv.arrivals[0]) {
    big = `Entra ${mv.arrivals[0].contact_name}`;
    meta = mv.arrivals[0].auth_status === 'enviada' ? 'Autorización enviada' : 'Falta enviar la autorización';
    target = `/autorizacion/${mv.arrivals[0].id}`;
  } else if (mv.inHouse) {
    big = `En casa: ${mv.inHouse.contact_name}`;
    meta = `Salen el ${formatLong(mv.inHouse.check_out)}`;
    target = `/reserva/${mv.inHouse.id}`;
  }
  if (mv.departures[0] && !mv.arrivals[0]) label = `Hoy sale ${mv.departures[0].contact_name}`;

  // Zuleika: efectivo que guarda, tareas de hoy y garantías
  const staffStays = staffStaysFromApp(data.reservations, data.properties);
  const cash = cashBalance(data.payments, data.ops, data.cash);
  const hint = withdrawHint(cash, data.settings.cash_alert_usd);
  const tasks = pendingToday(staffStays, data.ops, today, data.settings.deposit_usd);
  const held = depositsHeld(staffStays, data.ops, today);
  const staffName = data.settings.staff_name || 'Zuleika';
  const staffSub = [
    tasks ? `${tasks} ${tasks === 1 ? 'tarea' : 'tareas'} hoy` : 'Sin tareas pendientes hoy',
    held.length ? `${held.length} ${held.length === 1 ? 'garantía' : 'garantías'} por devolver` : '',
    hint.ready ? 'ya conviene retirar' : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="page">
      <div className="hello">
        <h1>{firstName ? `Hola, ${firstName}` : 'Hola'}</h1>
        <p>{formatLong(today).replace(/^./, (c) => c.toUpperCase())}</p>
      </div>

      <section className="today-card" aria-label="Hoy">
        <LogoMark className="art" />
        <div className="label">{label}</div>
        <div className="big">{big}</div>
        <div className="meta">{meta}</div>
        <div className="actions">
          <a className="btn solid" href={href(target)}>
            {target.startsWith('/autorizacion') ? 'Autorización' : 'Ver estadía'}
          </a>
          <a className="btn" href={href('/calendario')}>
            Calendario
          </a>
        </div>
      </section>

      <a className={`panel staff-link ${hint.ready ? 'ready' : ''}`} href={href('/zuleika')}>
        <span className="lead-icon lead-brand">
          <Icon name="wallet" />
        </span>
        <span className="grow">
          <span className="title">
            {staffName} guarda <span className="amount">{formatUSD(cash)}</span>
          </span>
          <span className="sub">{staffSub}</span>
        </span>
        <Icon name="chevronRight" className="chev" />
      </a>

      <section className="section" aria-labelledby="h-noches">
        <div className="section-head">
          <h2 id="h-noches">Próximas noches</h2>
          <a className="link" href={href('/calendario')}>
            Ver mes
          </a>
        </div>
        <Strip reservations={own} today={today} />
      </section>

      <section className="section" aria-labelledby="h-pend">
        <div className="section-head">
          <h2 id="h-pend">Pendiente</h2>
          {items.length ? <span className="badge badge-warn">{items.length}</span> : null}
        </div>
        <div className="panel list stagger">
          {items.length ? (
            items.map((it, i) => (
              <div key={`${it.kind}-${it.reservation.id}-${i}`} style={{ '--i': i } as CSSProperties}>
                <PendingRow item={it} today={today} prop={props.get(it.reservation.property_id)} />
              </div>
            ))
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

      <section className="section" aria-labelledby="h-mes">
        <h2 id="h-mes" style={{ textTransform: 'capitalize' }}>
          {monthName(m)}
        </h2>
        <div className="stats">
          <div className="stat">
            <div className="v">{Math.round(stats.occupancy * 100)}%</div>
            <div className="k">
              {stats.occupied} de {stats.nights} noches
            </div>
            <div className="occupancy" aria-hidden="true">
              <div style={{ width: `${Math.round(stats.occupancy * 100)}%` }} />
            </div>
          </div>
          <div className="stat">
            <div className="v">{formatUSD(stats.revenue)}</div>
            <div className="k">Facturado N°{data.settings.unit}</div>
          </div>
          <div className="stat">
            <div className="v">{formatUSD(commissionMonth)}</div>
            <div className="k">Comisiones</div>
          </div>
        </div>
      </section>
    </div>
  );
}
