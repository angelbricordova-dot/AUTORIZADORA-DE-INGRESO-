import { useApp } from '../context';
import { CHANNELS } from '../lib/types';
import { addDays, formatDayMonth, monthName, nightsBetween } from '../lib/dates';
import { freeRanges } from '../lib/freeNights';
import { go, href } from '../router';
import { Icon } from '../components/Icon';
import { MonthCalendar } from '../components/MonthCalendar';

export function CalendarPage({ query }: { query: URLSearchParams }) {
  const { data, today } = useApp();
  const ym = query.get('m') && /^\d{4}-\d{2}$/.test(query.get('m')!) ? query.get('m')! : today.slice(0, 7);
  const [y, m] = ym.split('-').map(Number);
  const shift = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    go(`/calendario?m=${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const from = `${ym}-01`;
  const to = addDays(`${y}-${String(m).padStart(2, '0')}-01`, new Date(y, m, 0).getDate());
  const free = freeRanges(data.reservations, from < today ? today : from, to).filter((r) => r.start < to);
  const used = new Set(data.reservations.map((r) => r.channel));

  return (
    <div className="page">
      <div className="cal-head">
        <h1 className="cal-title">
          {monthName(m - 1)} {y}
        </h1>
        <div className="cal-nav">
          <button className="icon-btn" onClick={() => shift(-1)} aria-label="Mes anterior">
            <Icon name="chevronLeft" />
          </button>
          <button className="icon-btn" onClick={() => shift(1)} aria-label="Mes siguiente">
            <Icon name="chevronRight" />
          </button>
        </div>
      </div>

      <MonthCalendar reservations={data.reservations} year={y} month={m - 1} today={today} />

      <div className="cal-legend" aria-label="Canales">
        {CHANNELS.filter((c) => used.has(c.id)).map((c) => (
          <span key={c.id} className="key" data-channel={c.id}>
            <span className="swatch" /> {c.label}
          </span>
        ))}
        <span className="key">
          <span className="swatch" style={{ background: 'var(--sand)' }} /> Libre
        </span>
      </div>

      <section className="section" aria-labelledby="h-libres">
        <div className="section-head">
          <h2 id="h-libres">Noches libres</h2>
          <a className="link" href={href('/reserva/nueva')}>
            Registrar estadía
          </a>
        </div>
        <div className="panel list">
          {free.length ? (
            free.map((f) => {
              const n = nightsBetween(f.start, f.end);
              return (
                <a key={f.start} className="list-item" href={href(`/reserva/nueva?in=${f.start}&out=${f.end}`)}>
                  <span className="grow">
                    <span className="title" style={{ display: 'block' }}>
                      {formatDayMonth(f.start)} → {formatDayMonth(f.end)}
                    </span>
                    <span className="sub" style={{ display: 'block' }}>
                      {n} {n === 1 ? 'noche libre' : 'noches libres'}
                    </span>
                  </span>
                  <Icon name="plus" className="chev" style={{ color: 'var(--lona)' }} />
                </a>
              );
            })
          ) : (
            <div className="empty">
              <p className="muted">Este mes está completo. Si llega otro grupo, ofrécele un apartamento aliado (próximamente).</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
