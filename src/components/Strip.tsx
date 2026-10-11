// Las próximas 14 noches de un apartamento, con cada estadía tendida sobre sus noches.
import type { CSSProperties } from 'react';
import type { Reservation } from '../lib/types';
import { addDays, parseISO, weekdayShort } from '../lib/dates';
import { layoutAwnings } from '../lib/awnings';
import { StayBar } from './StayBar';

const DAYS = 14;

export function Strip({ reservations, today }: { reservations: Reservation[]; today: string }) {
  const { segments, lanes } = layoutAwnings(reservations, today, DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  return (
    <div className="strip-scroller" aria-label="Próximas dos semanas">
      <div className="strip-grid" style={{ '--cols': DAYS * 2, '--lanes': lanes } as CSSProperties}>
        {days.map((d, i) => (
          <div key={d} className="strip-day" data-today={d === today} style={{ gridColumn: `${i * 2 + 1} / span 2` }}>
            <span className="dow">{d === today ? 'hoy' : weekdayShort(d)}</span>
            <span className="num">{parseISO(d).getDate()}</span>
          </div>
        ))}
        {days.map((d, i) => (
          <div key={`s${d}`} className="strip-sand" style={{ gridColumn: `${i * 2 + 1} / span 2` }} />
        ))}
        {segments.map((seg) => (
          <div key={seg.r.id} className="strip-stay" style={{ gridColumn: `${seg.start + 1} / ${seg.end + 1}`, '--row': seg.lane + 2 } as CSSProperties}>
            <StayBar seg={seg} compact={seg.end - seg.start < 4} />
          </div>
        ))}
      </div>
    </div>
  );
}
