import type { AwningSegment } from '../lib/awnings';
import { channelLabel } from '../lib/types';
import { href } from '../router';
import { Icon } from './Icon';

export function stayLabel(seg: AwningSegment): string {
  const r = seg.r;
  const status = r.status === 'tentativa' ? ' (tentativa)' : '';
  const conflict = seg.conflict ? ' — choca con otra reserva' : '';
  return `${r.contact_name}, ${channelLabel(r.channel)}${status}${conflict}`;
}

/** Una estadía dibujada sobre sus noches, en el color de su canal. */
export function StayBar({ seg, compact = false }: { seg: AwningSegment; compact?: boolean }) {
  const r = seg.r;
  const cls = ['stay', seg.cutStart ? 'stay-cut-start' : '', seg.cutEnd ? 'stay-cut-end' : ''].join(' ');
  return (
    <a className={cls} href={href(`/reserva/${r.id}`)} data-channel={r.channel} data-status={r.status} data-conflict={seg.conflict} aria-label={stayLabel(seg)} title={stayLabel(seg)}>
      {seg.conflict ? <Icon name="alert" /> : null}
      <span className="stay-label">{compact ? r.contact_name.split(' ')[0] : r.contact_name}</span>
    </a>
  );
}
