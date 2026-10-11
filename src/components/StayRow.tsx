import type { Reservation } from '../lib/types';
import { channelLabel } from '../lib/types';
import { formatDayMonth, nightsBetween } from '../lib/dates';
import { balance } from '../lib/availability';
import { formatUSD } from '../lib/money';
import { href } from '../router';
import { Icon } from './Icon';

export function AuthBadge({ r }: { r: Reservation }) {
  if (r.status === 'cancelada') return <span className="badge">Cancelada</span>;
  if (r.auth_status === 'enviada')
    return (
      <span className="badge badge-ok">
        <Icon name="check" /> Autorización enviada
      </span>
    );
  if (r.auth_status === 'generada') return <span className="badge badge-brand">Planilla lista</span>;
  return <span className="badge badge-warn">Sin autorización</span>;
}

export function stayDates(r: Reservation): string {
  const n = nightsBetween(r.check_in, r.check_out);
  return `${formatDayMonth(r.check_in)} → ${formatDayMonth(r.check_out)} · ${n} ${n === 1 ? 'noche' : 'noches'}`;
}

export function StayRow({ r, to, place }: { r: Reservation; to?: string; place?: string }) {
  const debt = balance(r);
  return (
    <a className="list-item" href={href(to ?? `/reserva/${r.id}`)}>
      <span className="flag" data-channel={r.channel} data-status={r.status} aria-hidden="true" />
      <span className="grow">
        <span className="title">{r.contact_name}</span>
        <span className="sub">
          {place ? `${place} · ` : ''}
          {stayDates(r)} · {channelLabel(r.channel)}
          {r.status === 'tentativa' ? ' · tentativa' : ''}
        </span>
        <span className="row-wrap" style={{ marginTop: 6 }}>
          <AuthBadge r={r} />
          {r.status !== 'cancelada' && debt > 0 ? <span className="badge badge-warn">Debe {formatUSD(debt)}</span> : null}
        </span>
      </span>
      <span className="amount">{formatUSD(r.total_usd)}</span>
      <Icon name="chevronRight" className="chev" />
    </a>
  );
}
