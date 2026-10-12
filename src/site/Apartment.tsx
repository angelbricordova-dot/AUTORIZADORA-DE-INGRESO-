// Página de un apartamento: fotos, disponibilidad, reservar por WhatsApp y, si no se puede, alternativas.
import { useEffect, useMemo, useState } from 'react';
import type { PublicData, PublicListing } from '../lib/types';
import { formatDayMonth, isValidISO, todayISO } from '../lib/dates';
import { formatUSD } from '../lib/money';
import { alternatives, bookingMessage, exceptionMessage, isBusyNight, isRangeFree, whatsappUrl } from '../lib/publicAvailability';
import { Icon } from '../components/Icon';
import { RangeCalendar, nextFreeRange, type Range } from './RangeCalendar';
import { Lightbox } from './Lightbox';
import { Amenities, Facts, Hero, ListingCard, MAPS_URL, Mosaic, ResultCard, listingName } from './parts';

export function ApartmentPage({ l, data, phone, query }: { l: PublicListing; data: PublicData; phone: string; query: URLSearchParams }) {
  const today = todayISO();
  const others = data.listings.filter((x) => x.id !== l.id);
  const qIn = query.get('entrada');
  const qOut = query.get('salida');
  const qGuests = Number(query.get('personas'));
  const [range, setRange] = useState<Range>(() =>
    qIn && qOut && isValidISO(qIn) && isValidISO(qOut) && qOut > qIn && qIn >= today ? { from: qIn, to: qOut } : { from: null, to: null },
  );
  const [guests, setGuests] = useState(qGuests >= 1 && qGuests <= 20 ? Math.round(qGuests) : 2);
  const [kids, setKids] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const name = listingName(l);

  const busy = useMemo(() => (day: string) => isBusyNight(data.busy, l.id, day), [data, l.id]);

  // Si no llegó con fechas, propone las próximas dos noches libres para que se vea el precio de inmediato
  useEffect(() => {
    if (!range.from && !range.to) setRange(nextFreeRange(today, busy));
    // solo al entrar a la página
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [l.id]);

  useEffect(() => {
    document.title = `${name} · Tu Día en Tucacas`;
  }, [name]);

  const complete = !!(range.from && range.to);
  const free = complete ? isRangeFree(data.busy, l.id, range.from!, range.to!) : false;
  const tooMany = guests > l.capacity;
  const kidsShown = Math.min(kids, guests - 1);
  const alts = complete ? alternatives(others, data.busy, range.from!, range.to!, guests) : [];

  return (
    <>
      <Hero own={l} loading={false} onOpen={setViewer} />

      <main className="site-main">
        {l.promo ? (
          <div className="promo" data-reveal>
            <Icon name="star" />
            <span>{l.promo}</span>
          </div>
        ) : null}

        <section id="disponibilidad" className="site-section" aria-labelledby="h-disp" data-reveal>
          <h2 id="h-disp">¿Qué fechas buscas?</h2>
          <p className="muted">Toca el día de entrada y luego el de salida.</p>
          <div className="panel site-card">
            <RangeCalendar value={range} onChange={setRange} today={today} isBusy={busy} />
            <div className="guests-row">
              <span>
                <strong>Personas</strong>
                <span className="hint" style={{ display: 'block' }}>
                  Hasta {l.capacity} en este apartamento
                </span>
              </span>
              <div className="stepper">
                <button type="button" onClick={() => setGuests((g) => Math.max(1, g - 1))} disabled={guests <= 1} aria-label="Una persona menos">
                  −
                </button>
                <output aria-live="polite">{guests}</output>
                <button type="button" onClick={() => setGuests((g) => Math.min(20, g + 1))} disabled={guests >= 20} aria-label="Una persona más">
                  +
                </button>
              </div>
            </div>
          </div>

          {complete ? (
            <ResultCard own={l} from={range.from!} to={range.to!} guests={guests} free={free} tooMany={tooMany} phone={phone} kids={kidsShown} onKids={setKids} />
          ) : (
            <p className="hint">Elige la fecha de salida para ver el precio.</p>
          )}
        </section>

        {complete && (!free || tooMany) ? (
          <section id="alternativas" className="site-section" aria-labelledby="h-alt">
            <h2 id="h-alt">
              {!alts.length
                ? 'Sin apartamentos libres en esas fechas'
                : tooMany && free
                  ? `Si no se puede, otros apartamentos para ${guests} personas`
                  : 'Libres en tus fechas, en el mismo conjunto'}
            </h2>
            {alts.length ? (
              <div className="listing-grid">
                {alts.map((x, i) => (
                  <ListingCard key={x.id} l={x} i={i} from={range.from!} to={range.to!} guests={guests} phone={phone} />
                ))}
              </div>
            ) : (
              <div className="panel panel-pad stack">
                <p>Prueba con otras fechas o escríbenos: a veces se libera algo que no aparece aquí.</p>
                {phone ? (
                  <a className="btn btn-whatsapp" href={whatsappUrl(phone, bookingMessage(l, range.from!, range.to!, guests))} target="_blank" rel="noopener noreferrer">
                    <Icon name="send" /> Preguntar por WhatsApp
                  </a>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {l.description || l.photos.length > 1 ? (
          <section className="site-section" aria-labelledby="h-apto" data-reveal>
            <h2 id="h-apto">El apartamento</h2>
            <Facts l={l} />
            {l.photos.length > 1 ? <Mosaic photos={l.photos} title={name} onOpen={setViewer} /> : null}
            {l.description ? (
              <div className="about">
                {l.description.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>
                    {para.split('\n').map((line, j) => (
                      <span key={j} className="about-line">
                        {line}
                      </span>
                    ))}
                  </p>
                ))}
              </div>
            ) : null}
            {l.airbnb_url ? (
              <a className="btn btn-soft btn-small reviews-link" href={l.airbnb_url} target="_blank" rel="noopener noreferrer">
                <Icon name="star" /> Ver reseñas de huéspedes en Airbnb
              </a>
            ) : null}
          </section>
        ) : null}

        {l.amenities.length ? (
          <section className="site-section" aria-labelledby="h-incluye" data-reveal>
            <h2 id="h-incluye">Lo que incluye</h2>
            <Amenities items={l.amenities} />
          </section>
        ) : null}

        {others.length && !(complete && (!free || tooMany)) ? (
          <section className="site-section" aria-labelledby="h-mas" data-reveal>
            <h2 id="h-mas">Más apartamentos en Pescadores I</h2>
            <p className="muted">Si estas fechas ya están tomadas, también te ayudamos con estos.</p>
            <div className="listing-grid">
              {others.map((x, i) => (
                <ListingCard
                  key={x.id}
                  l={x}
                  i={i}
                  from={complete ? range.from! : null}
                  to={complete ? range.to! : null}
                  guests={guests}
                  phone={phone}
                  busy={data.busy}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="site-section" aria-labelledby="h-donde" data-reveal>
          <h2 id="h-donde">Dónde queda</h2>
          <a className="panel place" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
            <span className="lead-icon lead-brand">
              <Icon name="mapPin" />
            </span>
            <span className="grow">
              <strong>Conjunto Residencial Pescadores I</strong>
              <span className="muted small" style={{ display: 'block' }}>
                Tucacas, Falcón · a minutos de la playa y de los muelles
              </span>
            </span>
            <Icon name="external" className="chev" />
          </a>
        </section>
      </main>

      {viewer != null ? <Lightbox photos={l.photos} start={viewer} title={name} onClose={() => setViewer(null)} /> : null}

      <div className="book-bar">
        <div className="book-bar-inner">
          <span>
            <span className="num price">{l.nightly_usd != null ? formatUSD(l.nightly_usd) : '—'}</span>
            <span className="small muted"> / noche</span>
            <span className="tiny muted" style={{ display: 'block' }}>
              {complete ? `${formatDayMonth(range.from!)} → ${formatDayMonth(range.to!)}` : `hasta ${l.capacity} personas`}
            </span>
          </span>
          {complete && free && !tooMany && phone ? (
            <a className="btn btn-whatsapp" href={whatsappUrl(phone, bookingMessage(l, range.from!, range.to!, guests))} target="_blank" rel="noopener noreferrer">
              Reservar
            </a>
          ) : complete && free && tooMany && phone ? (
            <a className="btn btn-whatsapp" href={whatsappUrl(phone, exceptionMessage(l, range.from!, range.to!, guests, kidsShown))} target="_blank" rel="noopener noreferrer">
              Consultar
            </a>
          ) : (
            <a className="btn btn-primary" href="#disponibilidad">
              Ver fechas
            </a>
          )}
        </div>
      </div>
    </>
  );
}
