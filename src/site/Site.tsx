// Página pública: el apartamento N°30, su disponibilidad y, si está ocupado, otros apartamentos del conjunto.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { store } from '../lib/store';
import type { PublicData, PublicListing } from '../lib/types';
import { addDays, formatDayMonth, formatLong, nightsBetween, todayISO, weekdayShort } from '../lib/dates';
import { formatUSD } from '../lib/money';
import { alternatives, bookingMessage, isBusyNight, isRangeFree, quote, whatsappUrl } from '../lib/publicAvailability';
import { ADMIN } from '../router';
import { Icon, type IconName } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { RangeCalendar, nextFreeRange, type Range } from './RangeCalendar';
import './site.css';

const AMENITY_ICON: Record<string, IconName> = {
  Piscina: 'waves',
  'Áreas recreativas': 'sun',
  WiFi: 'wifi',
  Seguridad: 'shield',
  'Servicio de agua': 'droplet',
  'Aire acondicionado': 'snow',
  Estacionamiento: 'car',
  'Cocina equipada': 'home',
  Parrillera: 'flame',
  'A minutos de la playa': 'mapPin',
};

const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Conjunto%20Residencial%20Pescadores%20I%20Tucacas%20Falc%C3%B3n';

function usePublicData() {
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const today = todayISO();
    store
      .loadPublic(today, addDays(today, 370))
      .then(setData)
      .catch((e: Error) => setError(e.message));
  }, []);
  return { data, error };
}

export function Site() {
  const { data, error } = usePublicData();
  const today = todayISO();
  const own = data?.listings.find((l) => l.kind === 'propio') ?? data?.listings[0];
  const partners = data?.listings.filter((l) => l.id !== own?.id) ?? [];
  const [range, setRange] = useState<Range>({ from: null, to: null });
  const [guests, setGuests] = useState(2);
  const [suggested, setSuggested] = useState(false);

  const busyOwn = useMemo(() => (day: string) => (own && data ? isBusyNight(data.busy, own.id, day) : false), [own, data]);

  // Al cargar, propone las próximas dos noches libres para que se vea el precio de inmediato
  useEffect(() => {
    if (own && data && !suggested) {
      setRange(nextFreeRange(today, busyOwn));
      setSuggested(true);
    }
  }, [own, data, suggested, today, busyOwn]);

  useEffect(() => {
    document.title = own ? `${own.title} · Tucacas` : 'Tu Día en Tucacas';
    document.querySelector('meta[name="robots"]')?.setAttribute('content', 'index, follow');
  }, [own]);

  const complete = !!(range.from && range.to);
  const ownFree = complete && own && data ? isRangeFree(data.busy, own.id, range.from!, range.to!) : false;
  const tooMany = own ? guests > own.capacity : false;
  const alts = complete && data ? alternatives(partners, data.busy, range.from!, range.to!, guests) : [];
  const phone = own?.contact_whatsapp ?? '';

  return (
    <div className="site">
      <header className="site-top">
        <a className="brand" href="/" aria-label="Tu Día en Tucacas, inicio">
          <span className="brand-mark">
            <LogoMark />
          </span>
          <span className="brand-text">
            <span className="brand-name">Tu Día en Tucacas</span>
            <span className="brand-sub">Alquiler por día · Pescadores I</span>
          </span>
        </a>
        {phone ? (
          <a className="icon-btn" href={whatsappUrl(phone, 'Hola, quiero información sobre el apartamento en Tucacas.')} target="_blank" rel="noopener noreferrer" aria-label="Escribir por WhatsApp">
            <Icon name="send" />
          </a>
        ) : null}
      </header>

      <Hero own={own} loading={!data && !error} />

      <main className="site-main">
        {error ? (
          <div className="notice notice-bad" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        ) : null}

        {own?.promo ? (
          <div className="promo reveal">
            <Icon name="star" />
            <span>{own.promo}</span>
          </div>
        ) : null}

        <section id="disponibilidad" className="site-section reveal" aria-labelledby="h-disp">
          <h2 id="h-disp">¿Qué fechas buscas?</h2>
          <p className="muted">Toca el día de entrada y luego el de salida.</p>
          <div className="panel site-card">
            {data && own ? (
              <RangeCalendar value={range} onChange={setRange} today={today} isBusy={busyOwn} />
            ) : (
              <div className="skeleton" style={{ height: 330 }} />
            )}
            <div className="guests-row">
              <span>
                <strong>Personas</strong>
                <span className="hint" style={{ display: 'block' }}>
                  Hasta {own?.capacity ?? 7} en este apartamento
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

          {own && complete ? (
            <ResultCard own={own} from={range.from!} to={range.to!} guests={guests} free={ownFree && !tooMany} tooMany={tooMany} phone={phone} />
          ) : own ? (
            <p className="hint">Elige la fecha de salida para ver el precio.</p>
          ) : null}
        </section>

        {complete && (!ownFree || tooMany) ? (
          <section id="alternativas" className="site-section reveal" aria-labelledby="h-alt">
            <h2 id="h-alt">{alts.length ? 'Libres en tus fechas, en el mismo conjunto' : 'Sin apartamentos libres en esas fechas'}</h2>
            {alts.length ? (
              <div className="listing-grid">
                {alts.map((l, i) => (
                  <ListingCard key={l.id} l={l} i={i} from={range.from!} to={range.to!} guests={guests} phone={phone} />
                ))}
              </div>
            ) : (
              <div className="panel panel-pad stack">
                <p>Prueba con otras fechas o escríbenos: a veces se libera algo que no aparece aquí.</p>
                {phone ? (
                  <a className="btn btn-whatsapp" href={whatsappUrl(phone, bookingMessage(own!, range.from!, range.to!, guests))} target="_blank" rel="noopener noreferrer">
                    <Icon name="send" /> Preguntar por WhatsApp
                  </a>
                ) : null}
              </div>
            )}
          </section>
        ) : null}

        {own?.amenities.length ? (
          <section className="site-section reveal" aria-labelledby="h-incluye">
            <h2 id="h-incluye">Lo que incluye</h2>
            <div className="amenities">
              {own.amenities.map((a, i) => (
                <div key={a} className="amenity" style={{ '--i': i } as CSSProperties}>
                  <span className="amenity-icon">
                    <Icon name={AMENITY_ICON[a] ?? 'check'} />
                  </span>
                  <span>{a}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {own && own.photos.length > 1 ? (
          <section className="site-section reveal" aria-labelledby="h-fotos">
            <h2 id="h-fotos">Fotos</h2>
            <div className="gallery">
              {own.photos.map((u, i) => (
                <img key={u} src={u} alt={`${own.title}, foto ${i + 1}`} loading="lazy" />
              ))}
            </div>
          </section>
        ) : null}

        {partners.length && !(complete && (!ownFree || tooMany)) ? (
          <section className="site-section reveal" aria-labelledby="h-mas">
            <h2 id="h-mas">Más apartamentos en Pescadores I</h2>
            <p className="muted">Si nuestras fechas ya están tomadas, también te ayudamos con estos.</p>
            <div className="listing-grid">
              {partners.map((l, i) => (
                <ListingCard key={l.id} l={l} i={i} from={complete ? range.from! : null} to={complete ? range.to! : null} guests={guests} phone={phone} busy={data?.busy ?? []} />
              ))}
            </div>
          </section>
        ) : null}

        <section className="site-section reveal" aria-labelledby="h-donde">
          <h2 id="h-donde">Dónde queda</h2>
          <a className="panel place" href={MAPS_URL} target="_blank" rel="noopener noreferrer">
            <span className="lead-icon lead-brand">
              <Icon name="mapPin" />
            </span>
            <span className="grow">
              <strong>Conjunto Residencial Pescadores I</strong>
              <span className="muted small" style={{ display: 'block' }}>
                Tucacas, Falcón · a minutos de la playa
              </span>
            </span>
            <Icon name="external" className="chev" />
          </a>
        </section>
      </main>

      <footer className="site-footer">
        <LogoMark className="footer-art" />
        <div className="row-wrap" style={{ justifyContent: 'center' }}>
          {own?.instagram_url ? (
            <a className="btn btn-soft btn-small" href={own.instagram_url} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          ) : null}
          {own?.airbnb_url ? (
            <a className="btn btn-soft btn-small" href={own.airbnb_url} target="_blank" rel="noopener noreferrer">
              Ver en Airbnb
            </a>
          ) : null}
        </div>
        <p className="tiny muted">© {new Date().getFullYear()} Tu Día en Tucacas · Tucacas, Venezuela</p>
        <a className="tiny admin-link" href={ADMIN}>
          Administración
        </a>
      </footer>

      {own ? (
        <div className="book-bar">
          <div className="book-bar-inner">
            <span>
              <span className="num price">{own.nightly_usd != null ? formatUSD(own.nightly_usd) : '—'}</span>
              <span className="small muted"> / noche</span>
              <span className="tiny muted" style={{ display: 'block' }}>
                {complete ? `${formatDayMonth(range.from!)} → ${formatDayMonth(range.to!)}` : `hasta ${own.capacity} personas`}
              </span>
            </span>
            {complete && ownFree && !tooMany && phone ? (
              <a className="btn btn-whatsapp" href={whatsappUrl(phone, bookingMessage(own, range.from!, range.to!, guests))} target="_blank" rel="noopener noreferrer">
                Reservar
              </a>
            ) : (
              <a className="btn btn-primary" href="#disponibilidad">
                Ver fechas
              </a>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Hero({ own, loading }: { own?: PublicListing; loading: boolean }) {
  const photos = own?.photos ?? [];
  return (
    <section className={`hero ${photos.length ? 'has-photo' : ''}`} aria-label="Presentación">
      {photos.length ? (
        <div className="hero-photos">
          {photos.map((u, i) => (
            <img key={u} src={u} alt={`${own?.title ?? 'Apartamento'}, foto ${i + 1}`} loading={i ? 'lazy' : 'eager'} />
          ))}
        </div>
      ) : (
        <LogoMark className="hero-art" />
      )}
      <div className="hero-copy">
        <h1>{loading ? 'Tu Día en Tucacas' : own?.title.replace(/ · .*$/, '') || 'Tu Día en Tucacas'}</h1>
        <p>{own?.summary || 'Hospedaje en el Conjunto Residencial Pescadores I, a minutos de la playa.'}</p>
        {own ? (
          <div className="hero-facts">
            <span>
              <Icon name="users" /> Hasta {own.capacity} personas
            </span>
            {own.nightly_usd != null ? (
              <span>
                <Icon name="money" /> {formatUSD(own.nightly_usd)} la noche
              </span>
            ) : null}
            <span>
              <Icon name="mapPin" /> Tucacas, Falcón
            </span>
          </div>
        ) : null}
        <a className="btn btn-sun hero-cta" href="#disponibilidad">
          <Icon name="calendar" /> Ver disponibilidad
        </a>
      </div>
    </section>
  );
}

function ResultCard({ own, from, to, guests, free, tooMany, phone }: { own: PublicListing; from: string; to: string; guests: number; free: boolean; tooMany: boolean; phone: string }) {
  const n = nightsBetween(from, to);
  const total = quote(own, n);
  return (
    <div className={`result ${free ? 'ok' : 'busy'}`} role="status">
      <div className="result-dates">
        <div>
          <span className="tiny muted">Entrada</span>
          <strong>
            {weekdayShort(from)} {formatDayMonth(from)}
          </strong>
        </div>
        <Icon name="arrowLeft" style={{ transform: 'rotate(180deg)', width: 18, height: 18, color: 'var(--muted)' }} />
        <div>
          <span className="tiny muted">Salida</span>
          <strong>
            {weekdayShort(to)} {formatDayMonth(to)}
          </strong>
        </div>
      </div>
      {free ? (
        <>
          <div className="result-total">
            <span>
              {n} {n === 1 ? 'noche' : 'noches'} · {guests} {guests === 1 ? 'persona' : 'personas'}
            </span>
            {total != null ? <span className="num">{formatUSD(total)}</span> : null}
          </div>
          <span className="badge badge-ok">
            <Icon name="check" /> Libre en esas fechas
          </span>
          {phone ? (
            <a className="btn btn-whatsapp btn-block" href={whatsappUrl(phone, bookingMessage(own, from, to, guests))} target="_blank" rel="noopener noreferrer">
              <Icon name="send" /> Reservar por WhatsApp
            </a>
          ) : null}
          <p className="tiny muted">El precio final se confirma por WhatsApp. No se cobra nada en esta página.</p>
        </>
      ) : (
        <div className="notice notice-warn">
          <Icon name="info" />
          <span>
            {tooMany
              ? `Este apartamento es para máximo ${own.capacity} personas. Mira las opciones de abajo.`
              : `El ${formatLong(from).split(' ').slice(0, 3).join(' ')} ya está ocupado aquí. Mira abajo otros apartamentos libres en el mismo conjunto.`}
          </span>
        </div>
      )}
    </div>
  );
}

function ListingCard({
  l,
  i,
  from,
  to,
  guests,
  phone,
  busy,
}: {
  l: PublicListing;
  i: number;
  from: string | null;
  to: string | null;
  guests: number;
  phone: string;
  busy?: PublicData['busy'];
}) {
  const n = from && to ? nightsBetween(from, to) : 0;
  const total = n ? quote(l, n) : null;
  const free = from && to && busy ? isRangeFree(busy, l.id, from, to) : from && to ? true : null;
  const text =
    from && to ? bookingMessage(l, from, to, guests) : `Hola, me interesa el ${l.title || `apartamento ${l.unit}`} de Pescadores I que vi en su página. ¿Qué fechas tiene libres?`;
  return (
    <article className="listing" style={{ '--i': i } as CSSProperties}>
      <div className="listing-media">
        {l.photos[0] ? <img src={l.photos[0]} alt={l.title} loading="lazy" /> : <LogoMark className="listing-art" />}
        {free != null ? <span className={`badge ${free ? 'badge-ok' : 'badge-bad'} listing-badge`}>{free ? 'Libre en tus fechas' : 'Ocupado en tus fechas'}</span> : null}
      </div>
      <div className="listing-body">
        <h3>{l.title || `Apartamento ${l.unit}`}</h3>
        {l.summary ? <p className="small muted">{l.summary}</p> : null}
        <div className="listing-facts small">
          <span>
            <Icon name="users" /> Hasta {l.capacity}
          </span>
          {l.bedrooms != null ? (
            <span>
              <Icon name="bed" /> {l.bedrooms} hab.
            </span>
          ) : null}
        </div>
        <div className="spread">
          <span>
            {l.nightly_usd != null ? (
              <>
                <span className="num price">{formatUSD(l.nightly_usd)}</span>
                <span className="small muted"> / noche</span>
              </>
            ) : null}
            {total != null ? <span className="tiny muted" style={{ display: 'block' }}>{formatUSD(total)} por {n} noches</span> : null}
          </span>
          {phone ? (
            <a className="btn btn-soft btn-small" href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer">
              Consultar
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
