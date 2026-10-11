// Firma: las próximas 14 noches como una fila de toldos sobre la arena.
import type { CSSProperties } from 'react';
import type { Reservation } from '../lib/types';
import { addDays, parseISO, weekdayShort } from '../lib/dates';
import { layoutAwnings } from '../lib/awnings';
import { Awning } from './Awning';

const DAYS = 14;

export function Strip({ reservations, today }: { reservations: Reservation[]; today: string }) {
  const start = today;
  const { segments, lanes } = layoutAwnings(reservations, start, DAYS);
  const days = Array.from({ length: DAYS }, (_, i) => addDays(start, i));
  const style = { '--cols': DAYS * 2, '--lanes': lanes } as CSSProperties;
  return (
    <section className="strip" aria-label="Próximas dos semanas">
      <div className="strip-scroller">
        <div className="strip-grid" style={style}>
          {days.map((d) => (
            <div key={d} className="strip-day" data-today={d === today}>
              <span className="dow">{d === today ? 'hoy' : weekdayShort(d)}</span>
              <span className="num">{parseISO(d).getDate()}</span>
            </div>
          ))}
          {days.map((d, i) => (
            <div key={`s${d}`} className="strip-sand" style={{ gridColumn: `${i * 2 + 1} / span 2` }} />
          ))}
          {segments.map((seg) => (
            <div
              key={seg.r.id}
              className="strip-awning"
              style={{ gridColumn: `${seg.start + 1} / ${seg.end + 1}`, '--row': seg.lane + 2 } as CSSProperties}
            >
              <Awning seg={seg} compact={seg.end - seg.start < 4} />
            </div>
          ))}
        </div>
      </div>
      <div className="strip-legend" aria-hidden="true">
        <span className="key">
          <i /> ocupado
        </span>
        <span className="key">
          <i className="free" /> libre
        </span>
      </div>
    </section>
  );
}
