// Piezas de la página pública: portada, datos, fotos, resultado de fechas y tarjetas de apartamentos.
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { PublicData, PublicListing } from '../lib/types';
import { formatDayMonth, formatLong, nightsBetween, weekdayShort } from '../lib/dates';
import { formatUSD } from '../lib/money';
import { bookingMessage, exceptionMessage, isRangeFree, quote, whatsappUrl } from '../lib/publicAvailability';
import { Icon, type IconName } from '../components/Icon';
import { LogoMark } from '../components/Logo';

export const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=Conjunto%20Residencial%20Pescadores%20I%20Tucacas%20Falc%C3%B3n';

export const AMENITY_ICON: Record<string, IconName> = {
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
  'Tanque de agua propio': 'droplet',
  Televisión: 'tv',
  'Cerca de los muelles': 'mapPin',
};

/** Dirección de la página de cada apartamento: /apartamento/30 */
export function slugUnit(unit: string): string {
  return (unit || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'apto';
}
export function aptPath(l: Pick<PublicListing, 'unit'>, q?: { from: string | null; to: string | null; guests?: number }): string {
  const base = `/apartamento/${slugUnit(l.unit)}`;
  if (!q?.from || !q.to) return base;
  const sp = new URLSearchParams({ entrada: q.from, salida: q.to });
  if (q.guests) sp.set('personas', String(q.guests));
  return `${base}?${sp}`;
}
/** "Tu Día en Tucacas · Apartamento N°30" → "Apartamento N°30" (la marca ya está arriba). */
export const listingName = (l: Pick<PublicListing, 'title' | 'unit'>) => l.title.split(' · ').pop()?.trim() || `Apartamento ${l.unit}`;

export function Hero({ own, loading, onOpen }: { own?: PublicListing; loading: boolean; onOpen: (i: number) => void }) {
  const photos = own?.photos ?? [];
  const [index, setIndex] = useState(0);
  return (
    <section className={`hero ${photos.length ? 'has-photo' : ''}`} aria-label="Presentación">
      {photos.length ? (
        <>
          <div
            className="hero-photos"
            onScroll={(e) => {
              const t = e.currentTarget;
              setIndex(Math.round(t.scrollLeft / t.clientWidth));
            }}
          >
            {photos.map((u, i) => (
              <img key={u} src={u} alt={`${own?.title ?? 'Apartamento'}, foto ${i + 1}`} loading={i ? 'lazy' : 'eager'} onClick={() => onOpen(i)} />
            ))}
          </div>
          {photos.length > 1 ? (
            <button className="hero-count" type="button" onClick={() => onOpen(index)} aria-label={`Ver las ${photos.length} fotos`}>
              <Icon name="image" /> <span className="num">{index + 1} / {photos.length}</span>
            </button>
          ) : null}
        </>
      ) : (
        <LogoMark className="hero-art" />
      )}
      <div className="hero-copy">
        <h1>{loading || !own ? 'Tu Día en Tucacas' : listingName(own)}</h1>
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

export function Facts({ l }: { l: Pick<PublicListing, 'bedrooms' | 'beds' | 'bathrooms' | 'capacity'> }) {
  const items: [IconName, string][] = [
    ['users', `${l.capacity} personas`],
    ...(l.bedrooms != null ? [['home', `${l.bedrooms} ${l.bedrooms === 1 ? 'habitación' : 'habitaciones'}`] as [IconName, string]] : []),
    ...(l.beds != null ? [['bed', `${l.beds} ${l.beds === 1 ? 'cama' : 'camas'}`] as [IconName, string]] : []),
    ...(l.bathrooms != null ? [['droplet', `${l.bathrooms} ${l.bathrooms === 1 ? 'baño' : 'baños'}`] as [IconName, string]] : []),
  ];
  return (
    <ul className="facts" aria-label="Datos del apartamento">
      {items.map(([icon, text]) => (
        <li key={text}>
          <Icon name={icon} /> {text}
        </li>
      ))}
    </ul>
  );
}

/** Mosaico de fotos: una grande y cuatro chicas; la última muestra cuántas faltan. */
export function Mosaic({ photos, title, onOpen }: { photos: string[]; title: string; onOpen: (i: number) => void }) {
  const shown = photos.slice(0, 5);
  const rest = photos.length - shown.length;
  return (
    <div className={`mosaic n${shown.length}`}>
      {shown.map((u, i) => (
        <button key={u} type="button" className="mosaic-tile" onClick={() => onOpen(i)} aria-label={`Ver foto ${i + 1} de ${photos.length}`}>
          <img src={u} alt={`${title}, foto ${i + 1}`} loading="lazy" />
          {i === shown.length - 1 && rest > 0 ? <span className="mosaic-more num">+{rest}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function ResultCard({
  own,
  from,
  to,
  guests,
  free,
  tooMany,
  phone,
  kids,
  onKids,
}: {
  own: PublicListing;
  from: string;
  to: string;
  guests: number;
  free: boolean;
  tooMany: boolean;
  phone: string;
  kids: number;
  onKids: (n: number) => void;
}) {
  const n = nightsBetween(from, to);
  const total = quote(own, n);
  const ok = free && !tooMany;
  return (
    <div className={`result ${ok ? 'ok' : 'busy'}`} role="status">
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
      {ok ? (
        <>
          <div className="result-total">
            <span>
              {n} {n === 1 ? 'noche' : 'noches'} · {guests} {guests === 1 ? 'persona' : 'personas'}
            </span>
            {total != null ? (
              <span className="num">
                <CountUp value={total} format={formatUSD} />
              </span>
            ) : null}
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
      ) : free && tooMany ? (
        <div className="exception">
          <span className="badge badge-ok">
            <Icon name="check" /> Libre en esas fechas
          </span>
          <p>
            Este apartamento es para <strong>{own.capacity} personas</strong> y ustedes son {guests}. Si algunos son niños, a veces se puede hacer una
            excepción: pregúntanos antes de buscar otro.
          </p>
          <div className="guests-row">
            <span>
              <strong>¿Cuántos son niños?</strong>
              <span className="hint" style={{ display: 'block' }}>
                {guests - kids} {guests - kids === 1 ? 'adulto' : 'adultos'}
              </span>
            </span>
            <div className="stepper">
              <button type="button" onClick={() => onKids(Math.max(0, kids - 1))} disabled={kids <= 0} aria-label="Un niño menos">
                −
              </button>
              <output aria-live="polite">{kids}</output>
              <button type="button" onClick={() => onKids(Math.min(guests - 1, kids + 1))} disabled={kids >= guests - 1} aria-label="Un niño más">
                +
              </button>
            </div>
          </div>
          {phone ? (
            <a className="btn btn-whatsapp btn-block" href={whatsappUrl(phone, exceptionMessage(own, from, to, guests, kids))} target="_blank" rel="noopener noreferrer">
              <Icon name="send" /> Consultar excepción por WhatsApp
            </a>
          ) : null}
          <p className="tiny muted">Si no se puede, abajo tienes otros apartamentos del conjunto para tu grupo.</p>
        </div>
      ) : (
        <div className="notice notice-warn">
          <Icon name="info" />
          <span>{`El ${formatLong(from).split(' ').slice(0, 3).join(' ')} ya está ocupado aquí. Mira abajo otros apartamentos libres en el mismo conjunto.`}</span>
        </div>
      )}
    </div>
  );
}

export function ListingCard({
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
  const name = listingName(l);
  const text = from && to ? bookingMessage(l, from, to, guests) : `Hola, me interesa el ${name} de Pescadores I que vi en su página. ¿Qué fechas tiene libres?`;
  return (
    <article className="listing" style={{ '--i': i } as CSSProperties}>
      <div className="listing-media">
        {l.photos[0] ? <img src={l.photos[0]} alt="" loading="lazy" /> : <LogoMark className="listing-art" />}
        {free != null ? <span className={`badge ${free ? 'badge-ok' : 'badge-bad'} listing-badge`}>{free ? 'Libre en tus fechas' : 'Ocupado en tus fechas'}</span> : null}
        {l.photos.length > 1 ? (
          <span className="listing-count num">
            <Icon name="image" /> {l.photos.length}
          </span>
        ) : null}
      </div>
      <div className="listing-body">
        <h3>
          <a className="stretched" href={aptPath(l, { from, to, guests })}>
            {name}
          </a>
        </h3>
        {l.summary ? <p className="small muted">{l.summary}</p> : null}
        <div className="listing-facts small">
          <span>
            <Icon name="users" /> Hasta {l.capacity}
          </span>
          {l.bedrooms != null ? (
            <span>
              <Icon name="home" /> {l.bedrooms} hab.
            </span>
          ) : null}
          {l.bathrooms != null ? (
            <span>
              <Icon name="droplet" /> {l.bathrooms} {l.bathrooms === 1 ? 'baño' : 'baños'}
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
          <span className="row" style={{ gap: 8 }}>
            {phone ? (
              <a className="icon-btn above wa" href={whatsappUrl(phone, text)} target="_blank" rel="noopener noreferrer" aria-label={`Consultar el ${name} por WhatsApp`}>
                <Icon name="send" />
              </a>
            ) : null}
            <span className="btn btn-soft btn-small" aria-hidden="true">
              Ver <Icon name="chevronRight" />
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}

/** Servicios: se ven los primeros tres y el resto se despliega. */
export function Amenities({ items, shown = 3 }: { items: string[]; shown?: number }) {
  const [open, setOpen] = useState(false);
  const rest = items.slice(shown);
  const tile = (a: string, i: number) => (
    <div key={a} className="amenity" style={{ '--i': i } as CSSProperties}>
      <span className="amenity-icon">
        <Icon name={AMENITY_ICON[a] ?? 'check'} />
      </span>
      <span>{a}</span>
    </div>
  );
  return (
    <div className="amenities-wrap">
      <div className="amenities top">{items.slice(0, shown).map(tile)}</div>
      {rest.length ? (
        <>
          <div className={`collapse ${open ? 'open' : ''}`} id="mas-servicios" aria-hidden={!open}>
            <div className="collapse-inner">
              <div className="amenities rest">{rest.map((a, i) => tile(a, i))}</div>
            </div>
          </div>
          <button className="btn btn-soft btn-small more-toggle" type="button" aria-expanded={open} aria-controls="mas-servicios" onClick={() => setOpen((o) => !o)}>
            {open ? 'Ver menos' : `Ver los ${items.length} servicios`}
            <Icon name="chevronRight" className={`more-chev ${open ? 'up' : ''}`} />
          </button>
        </>
      ) : null}
    </div>
  );
}

/** Número que sube hasta su valor (precio total). Sin animación si se pide menos movimiento. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const [shown, setShown] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    const a = last.current;
    last.current = value;
    if (a === value || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / 450);
      setShown(Math.round(a + (value - a) * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format(shown)}</>;
}
