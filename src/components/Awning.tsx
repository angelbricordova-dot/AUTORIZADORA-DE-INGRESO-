import type { AwningSegment } from '../lib/awnings';
import { channelLabel } from '../lib/types';
import { href } from '../router';
import { Icon } from './Icon';

export function awningLabel(seg: AwningSegment): string {
  const r = seg.r;
  const who = r.contact_name;
  const status = r.status === 'tentativa' ? ' (tentativa)' : '';
  const conflict = seg.conflict ? ' — choca con otra reserva' : '';
  return `${who}, ${channelLabel(r.channel)}${status}${conflict}`;
}

export function Awning({ seg, compact = false }: { seg: AwningSegment; compact?: boolean }) {
  const r = seg.r;
  const cls = ['awning', seg.cutStart ? 'awning-cut-start' : '', seg.cutEnd ? 'awning-cut-end' : ''].join(' ');
  return (
    <a
      className={cls}
      href={href(`/reserva/${r.id}`)}
      data-channel={r.channel}
      data-status={r.status}
      data-conflict={seg.conflict}
      aria-label={awningLabel(seg)}
      title={awningLabel(seg)}
    >
      <span className="awning-body">
        {seg.conflict ? <Icon name="alert" /> : null}
        <span className="awning-label">{compact ? r.contact_name.split(' ')[0] : r.contact_name}</span>
      </span>
    </a>
  );
}
