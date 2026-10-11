// Calendario para elegir entrada y salida con el pulgar. Las noches ocupadas se ven tachadas.
import { useState } from 'react';
import { addDays, monthName, parseISO, toISO } from '../lib/dates';
import { Icon } from '../components/Icon';

const DOWS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export interface Range {
  from: string | null;
  to: string | null;
}

function monthDays(year: number, month: number): (string | null)[] {
  const first = new Date(year, month, 1, 12);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(year, month + 1, 0).getDate();
  return [...Array.from({ length: offset }, () => null), ...Array.from({ length: count }, (_, i) => toISO(new Date(year, month, i + 1, 12)))];
}

export function RangeCalendar({
  value,
  onChange,
  today,
  isBusy,
  maxMonths = 12,
}: {
  value: Range;
  onChange: (r: Range) => void;
  today: string;
  isBusy: (day: string) => boolean;
  maxMonths?: number;
}) {
  const start = parseISO(value.from ?? today);
  const [cursor, setCursor] = useState({ y: start.getFullYear(), m: start.getMonth() });
  const base = parseISO(today);
  const offset = (cursor.y - base.getFullYear()) * 12 + cursor.m - base.getMonth();

  function shift(d: number) {
    const dt = new Date(cursor.y, cursor.m + d, 1);
    setCursor({ y: dt.getFullYear(), m: dt.getMonth() });
  }

  function pick(day: string) {
    if (!value.from || (value.from && value.to) || day <= value.from) {
      onChange({ from: day, to: null });
    } else {
      onChange({ from: value.from, to: day });
    }
  }

  const days = monthDays(cursor.y, cursor.m);
  const inRange = (d: string) => !!value.from && !!value.to && d > value.from && d < value.to;

  return (
    <div className="rc">
      <div className="rc-head">
        <button type="button" className="icon-btn flat" onClick={() => shift(-1)} disabled={offset <= 0} aria-label="Mes anterior">
          <Icon name="chevronLeft" />
        </button>
        <span className="rc-title" aria-live="polite">
          {monthName(cursor.m)} <span className="num">{cursor.y}</span>
        </span>
        <button type="button" className="icon-btn flat" onClick={() => shift(1)} disabled={offset >= maxMonths - 1} aria-label="Mes siguiente">
          <Icon name="chevronRight" />
        </button>
      </div>
      <div className="rc-grid" role="group" aria-label={`${monthName(cursor.m)} ${cursor.y}`}>
        {DOWS.map((d, i) => (
          <span key={i} className="rc-dow" aria-hidden="true">
            {d}
          </span>
        ))}
        {days.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const past = d < today;
          const busy = !past && isBusy(d);
          const isStart = d === value.from;
          const isEnd = d === value.to;
          const label = `${parseISO(d).getDate()} de ${monthName(cursor.m)}${busy ? ', ocupado' : ''}${isStart ? ', entrada' : ''}${isEnd ? ', salida' : ''}`;
          return (
            <button
              key={d}
              type="button"
              className="rc-day"
              data-past={past}
              data-busy={busy}
              data-start={isStart}
              data-end={isEnd}
              data-range={inRange(d)}
              data-today={d === today}
              disabled={past}
              aria-label={label}
              aria-pressed={isStart || isEnd}
              onClick={() => pick(d)}
            >
              <span>{parseISO(d).getDate()}</span>
            </button>
          );
        })}
      </div>
      <div className="rc-legend" aria-hidden="true">
        <span>
          <i className="free" /> Libre
        </span>
        <span>
          <i className="busy" /> Ocupado
        </span>
        <span>
          <i className="sel" /> Tus fechas
        </span>
      </div>
    </div>
  );
}

/** Siguiente noche libre de dos noches a partir de hoy (para sugerir). */
export function nextFreeRange(today: string, isBusy: (d: string) => boolean, nights = 2, horizon = 120): Range {
  for (let i = 1; i < horizon; i++) {
    const from = addDays(today, i);
    let ok = true;
    for (let k = 0; k < nights; k++) if (isBusy(addDays(from, k))) ok = false;
    if (ok) return { from, to: addDays(from, nights) };
  }
  return { from: null, to: null };
}
