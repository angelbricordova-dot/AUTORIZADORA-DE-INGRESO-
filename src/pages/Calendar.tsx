import type { CSSProperties } from 'react';
import { useApp } from '../context';
import { CHANNELS } from '../lib/types';
import { addDays, formatDayMonth, monthName, nightsBetween } from '../lib/dates';
import { freeRanges } from '../lib/freeNights';
import { go, href } from '../router';
import { Icon } from '../components/Icon';
import { MonthCalendar } from '../components/MonthCalendar';
import { PropertyChips } from '../components/PropertyChips';

export function CalendarPage({ query }: { query: URLSearchParams }) {
  const { data, today, ownId } = useApp();
  const ym = query.get('m') && /^\d{4}-\d{2}$/.test(query.get('m')!) ? query.get('m')! : today.slice(0, 7);
  const aptParam = query.get('apto');
  const apto = aptParam && data.properties.some((p) => p.id === aptParam) ? aptParam : ownId;
  const [y, m] = ym.split('-').map(Number);
  const setQuery = (next: { m?: string; apto?: string }) => {
    const q = new URLSearchParams({ m: next.m ?? ym });
    const a = next.apto ?? apto;
    if (a !== ownId) q.set('apto', a);
    go(`/calendario?${q}`, { replace: true });
  };
  const shift = (delta: number) => {
    const d = new Date(y, m - 1 + delta, 1);
    setQuery({ m: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}` });
  };
  const reservations = data.reservations.filter((r) => r.property_id === apto);
  const from = `${ym}-01`;
  const to = addDays(from, new Date(y, m, 0).getDate());
  const free = freeRanges(reservations, from < today ? today : from, to).filter((r) => r.start < to);
  const used = new Set(reservations.map((r) => r.channel));

  return (
    <div className="page">
      <div className="cal-head">
        <h1 className="cal-title">
          {monthName(m - 1)} <span className="muted num">{y}</span>
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

      <PropertyChips properties={data.properties} value={apto} onChange={(id) => setQuery({ apto: id })} name="cal-apto" />

      <MonthCalendar key={`${ym}-${apto}`} reservations={reservations} year={y} month={m - 1} today={today} />

      <div className="cal-legend" aria-label="Canales">
        {CHANNELS.filter((c) => used.has(c.id)).map((c) => (
          <span key={c.id} className="key" data-channel={c.id}>
            <span className="swatch" /> {c.label}
          </span>
        ))}
        <span className="key">
          <span className="swatch" style={{ background: 'var(--brand-soft)', boxShadow: 'inset 0 0 0 1px var(--line-strong)' }} /> Libre
        </span>
      </div>

      <section className="section" aria-labelledby="h-libres">
        <div className="section-head">
          <h2 id="h-libres">Noches libres</h2>
        </div>
        <div className="panel list stagger">
          {free.length ? (
            free.map((f, i) => {
              const n = nightsBetween(f.start, f.end);
              return (
                <a
                  key={f.start}
                  className="list-item"
                  style={{ '--i': i } as CSSProperties}
                  href={href(`/reserva/nueva?in=${f.start}&out=${f.end}${apto !== ownId ? `&apto=${apto}` : ''}`)}
                >
                  <span className="lead-icon lead-brand">
                    <Icon name="calendar" />
                  </span>
                  <span className="grow">
                    <span className="title">
                      {formatDayMonth(f.start)} → {formatDayMonth(f.end)}
                    </span>
                    <span className="sub">
                      {n} {n === 1 ? 'noche libre' : 'noches libres'}
                    </span>
                  </span>
                  <Icon name="plus" className="chev" style={{ color: 'var(--brand)' }} />
                </a>
              );
            })
          ) : (
            <div className="empty">
              <p className="muted">Este mes está completo. Si llega otro grupo, ofrécele un apartamento aliado desde la página pública.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
