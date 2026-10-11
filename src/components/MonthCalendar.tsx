import type { CSSProperties } from 'react';
import type { Reservation } from '../lib/types';
import { addDays, parseISO, toISO } from '../lib/dates';
import { layoutAwnings } from '../lib/awnings';
import { isActive } from '../lib/availability';
import { Awning } from './Awning';

const DOWS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];

/** Semanas (lunes a domingo) que cubren el mes. */
function weeksOf(year: number, month: number): string[] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const start = toISO(new Date(year, month, 1 - offset, 12));
  const last = new Date(year, month + 1, 0, 12);
  const weeks: string[] = [];
  for (let w = start; parseISO(w) <= last; w = addDays(w, 7)) weeks.push(w);
  return weeks;
}

export function MonthCalendar({ reservations, year, month, today }: { reservations: Reservation[]; year: number; month: number; today: string }) {
  const active = reservations.filter(isActive);
  const occupied = (d: string) => active.some((r) => r.check_in <= d && r.check_out > d);
  return (
    <div className="panel cal" aria-label="Calendario del mes">
      <div className="cal-dows">
        {DOWS.map((d) => (
          <span key={d}>
            {d}
          </span>
        ))}
      </div>
      {weeksOf(year, month).map((weekStart) => {
        const { segments, lanes } = layoutAwnings(reservations, weekStart, 7);
        const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
        return (
          <div key={weekStart} className="cal-week" style={{ '--lanes': lanes } as CSSProperties}>
            {days.map((d, i) => {
              const out = parseISO(d).getMonth() !== month;
              return (
                <div
                  key={d}
                  className="cal-day"
                  style={{ gridColumn: `${i * 2 + 1} / span 2` }}
                  data-today={d === today}
                  data-out={out}
                  data-last={i === 6}
                  data-free={!out && !occupied(d)}
                  aria-label={`${parseISO(d).getDate()}${occupied(d) ? ', ocupado' : ', libre'}`}
                >
                  <span className="num">{parseISO(d).getDate()}</span>
                </div>
              );
            })}
            {segments.map((seg) => (
              <div
                key={seg.r.id}
                className="cal-awning"
                style={{ gridColumn: `${seg.start + 1} / ${seg.end + 1}`, '--row': seg.lane + 2 } as CSSProperties}
              >
                <Awning seg={seg} compact={seg.end - seg.start < 4} />
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
