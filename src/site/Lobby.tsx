// Inicio público: presenta la marca, busca fechas en todos los apartamentos y lleva a cada uno.
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import type { PublicData, PublicListing } from '../lib/types';
import { formatDayMonth, nightsBetween, todayISO, weekdayShort } from '../lib/dates';
import { formatUSD } from '../lib/money';
import { isRangeFree, whatsappUrl } from '../lib/publicAvailability';
import { Icon, type IconName } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { BottomSheet } from '../components/BottomSheet';
import { RangeCalendar, type Range } from './RangeCalendar';
import { Facts, ListingCard, aptPath, listingName } from './parts';

const HIGHLIGHTS = ['Piscina', 'WiFi de fibra óptica', 'Aire acondicionado', 'A 5 min de los muelles', 'Tanque de agua propio', 'Estacionamiento', 'Hasta 7 personas', 'Cayos de Morrocoy'];

const TUCACAS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'waves', title: 'Los cayos de Morrocoy', text: 'Cayo Sombrero, Cayo Sal, Playuela y muchos más, en lancha desde los muelles de Tucacas.' },
  { icon: 'mapPin', title: 'Los muelles a 5 minutos', text: 'Sales temprano a los cayos sin perder la mañana en el carro.' },
  { icon: 'sun', title: 'Playa, pueblo y piscina', text: 'Playa y comercios a pocos minutos, y piscina y áreas recreativas dentro del conjunto.' },
];

const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'calendar', title: 'Elige tus fechas', text: 'Ves al momento qué apartamentos están libres y cuánto cuesta.' },
  { icon: 'send', title: 'Escríbenos por WhatsApp', text: 'El mensaje sale listo con tus fechas y cuántas personas son.' },
  { icon: 'key', title: 'Te esperamos con las llaves', text: 'Al llegar te entregamos el apartamento limpio y listo. Aceptamos efectivo, pago móvil, transferencia y Zelle.' },
];

export function Lobby({ data, own, phone }: { data: PublicData | null; own?: PublicListing; phone: string }) {
  const today = todayISO();
  const [range, setRange] = useState<Range>({ from: null, to: null });
  const [guests, setGuests] = useState(2);
  const [picking, setPicking] = useState(false);
  const complete = !!(range.from && range.to);

  useEffect(() => {
    document.title = 'Tu Día en Tucacas · Alquiler por día en Tucacas';
  }, []);

  const results = useMemo(() => {
    const list = data?.listings ?? [];
    if (!complete || !data) return list;
    const ok = (l: PublicListing) => l.capacity >= guests && isRangeFree(data.busy, l.id, range.from!, range.to!);
    return [...list].sort((a, b) => Number(ok(b)) - Number(ok(a)));
  }, [data, complete, range, guests]);
  const freeCount = complete && data ? results.filter((l) => l.capacity >= guests && isRangeFree(data.busy, l.id, range.from!, range.to!)).length : 0;
  const partners = (data?.listings ?? []).filter((l) => l.id !== own?.id);

  return (
    <>
      <section className="lobby-hero" aria-labelledby="h-lobby">
        <span className="lobby-sun" aria-hidden="true">
          <span className="sunlight" />
          <span className="sun-halo" />
          <span className="sun-disc" />
        </span>
        <Palm className="lobby-palm" />
        <Palm className="lobby-palm small" />
        <LogoMark className="lobby-logo" draw />
        <div className="lobby-copy">
          <h1 id="h-lobby">
            Tu día en Tucacas <span className="lobby-accent">empieza aquí</span>
          </h1>
          <p>Apartamentos por día en el Conjunto Residencial Pescadores I, a minutos de la playa y de los cayos de Morrocoy.</p>
          <div className="lobby-actions">
            <a className="btn btn-sun" href="#buscar">
              <Icon name="calendar" /> Buscar fechas
            </a>
            {own ? (
              <a className="btn btn-glass" href={aptPath(own)}>
                Ver el N°{own.unit}
              </a>
            ) : null}
          </div>
        </div>
        <svg className="lobby-waves" viewBox="0 0 1440 160" preserveAspectRatio="none" aria-hidden="true">
          <path className="w1" d="M0 58c120 34 240 34 360 0s240-34 360 0 240 34 360 0 240-34 360 0v102H0z" />
          <path className="w2" d="M0 86c120-30 240-30 360 0s240 30 360 0 240-30 360 0 240 30 360 0v74H0z" />
          <path className="w3" d="M0 112c120 24 240 24 360 0s240-24 360 0 240 24 360 0 240-24 360 0v48H0z" />
        </svg>
      </section>

      <div className="marquee" aria-label="Lo que ofrecemos">
        <div className="marquee-track">
          {[...HIGHLIGHTS, ...HIGHLIGHTS].map((h, i) => (
            <span key={i} aria-hidden={i >= HIGHLIGHTS.length}>
              {h}
            </span>
          ))}
        </div>
      </div>

      <main className="site-main">
        <section id="buscar" className="search-card" aria-labelledby="h-buscar" data-reveal>
          <h2 id="h-buscar">¿Cuándo vienes?</h2>
          <div className="search-fields">
            <button className="search-field" type="button" onClick={() => setPicking(true)}>
              <span className="tiny muted">Entrada</span>
              <strong>{range.from ? `${weekdayShort(range.from)} ${formatDayMonth(range.from)}` : 'Elegir'}</strong>
            </button>
            <button className="search-field" type="button" onClick={() => setPicking(true)}>
              <span className="tiny muted">Salida</span>
              <strong>{range.to ? `${weekdayShort(range.to)} ${formatDayMonth(range.to)}` : 'Elegir'}</strong>
            </button>
          </div>
          <div className="guests-row">
            <strong>Personas</strong>
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
          <p className="search-summary" role="status">
            {complete
              ? freeCount
                ? `${freeCount} ${freeCount === 1 ? 'apartamento libre' : 'apartamentos libres'} · ${nightsBetween(range.from!, range.to!)} noches`
                : 'Nada libre en esas fechas: escríbenos y buscamos opciones.'
              : 'Elige las fechas para ver qué está libre.'}
          </p>
        </section>

        <section className="site-section" aria-labelledby="h-aptos" data-reveal>
          <h2 id="h-aptos">{complete ? 'Apartamentos para tus fechas' : 'Nuestros apartamentos'}</h2>
          {data ? (
            <div className="listing-grid">
              {own && !complete ? <Featured l={own} /> : null}
              {(complete ? results : partners).map((l, i) => (
                <ListingCard
                  key={l.id}
                  l={l}
                  i={i}
                  from={complete ? range.from : null}
                  to={complete ? range.to : null}
                  guests={guests}
                  phone={phone}
                  busy={data.busy}
                />
              ))}
            </div>
          ) : (
            <div className="skeleton" style={{ height: 380 }} />
          )}
        </section>

        <section className="site-section" aria-labelledby="h-pasos" data-reveal>
          <h2 id="h-pasos">Reservar es así de fácil</h2>
          <ol className="steps-cards">
            {STEPS.map((s, i) => (
              <li key={s.title} style={{ '--i': i } as CSSProperties}>
                <span className="step-num num">{i + 1}</span>
                <span className="step-icon">
                  <Icon name={s.icon} />
                </span>
                <strong>{s.title}</strong>
                <span className="muted small">{s.text}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="site-section" aria-labelledby="h-tucacas" data-reveal>
          <h2 id="h-tucacas">Tucacas, puerta de Morrocoy</h2>
          <div className="place-cards">
            {TUCACAS.map((t, i) => (
              <article key={t.title} className="place-card" style={{ '--i': i } as CSSProperties}>
                <span className="amenity-icon">
                  <Icon name={t.icon} />
                </span>
                <h3>{t.title}</h3>
                <p className="muted small">{t.text}</p>
              </article>
            ))}
          </div>
        </section>

        {phone ? (
          <section className="contact-card" aria-labelledby="h-contacto" data-reveal>
            <LogoMark className="contact-art" />
            <h2 id="h-contacto">¿Tienes preguntas?</h2>
            <p>Escríbenos y te respondemos por WhatsApp: fechas, precios, grupos grandes o lo que necesites.</p>
            <a className="btn btn-whatsapp" href={whatsappUrl(phone, 'Hola, quiero información para alquilar en Tucacas.')} target="_blank" rel="noopener noreferrer">
              <Icon name="send" /> Escribir por WhatsApp
            </a>
          </section>
        ) : null}
      </main>

      <BottomSheet open={picking} onClose={() => setPicking(false)} label="Elegir fechas">
        <div className="stack">
          <h2>Elige tus fechas</h2>
          <RangeCalendar value={range} onChange={setRange} today={today} isBusy={() => false} />
          <button className="btn btn-primary btn-block" type="button" onClick={() => setPicking(false)} disabled={!complete}>
            <Icon name="check" /> {complete ? `Ver lo libre del ${formatDayMonth(range.from!)} al ${formatDayMonth(range.to!)}` : 'Elige la fecha de salida'}
          </button>
        </div>
      </BottomSheet>
    </>
  );
}

function Featured({ l }: { l: PublicListing }) {
  const name = listingName(l);
  return (
    <article className="featured">
      <div className="featured-media">
        {l.photos[0] ? <img src={l.photos[0]} alt="" /> : <LogoMark className="listing-art" />}
        <span className="badge badge-sun featured-badge">
          <Icon name="star" /> Nuestro apartamento
        </span>
      </div>
      <div className="featured-body">
        <h3>
          <a className="stretched" href={aptPath(l)}>
            {name}
          </a>
        </h3>
        {l.summary ? <p className="muted">{l.summary}</p> : null}
        <Facts l={l} />
        <div className="featured-foot">
          {l.nightly_usd != null ? (
            <span>
              <span className="small muted">desde </span>
              <span className="num price">{formatUSD(l.nightly_usd)}</span>
              <span className="small muted"> la noche</span>
            </span>
          ) : null}
          <span className="btn btn-primary btn-small" aria-hidden="true">
            Ver <Icon name="chevronRight" />
          </span>
        </div>
      </div>
    </article>
  );
}

/** Palmera que se mece con la brisa: el tronco se inclina y las hojas se mueven cada una a su ritmo. */
function Palm({ className }: { className: string }) {
  const fronds = [
    'M100 92C70 70 34 72 4 102C36 84 68 84 100 98Z',
    'M100 92C78 56 46 42 16 50C48 56 74 70 98 98Z',
    'M100 92C102 54 120 26 146 12C130 40 118 66 104 98Z',
    'M100 92C132 66 168 66 196 90C166 80 134 84 104 100Z',
    'M100 92C134 92 162 110 176 142C152 118 126 106 102 100Z',
    'M100 92C72 98 48 118 40 150C58 124 78 110 98 100Z',
  ];
  return (
    <svg className={className} viewBox="0 0 200 420" aria-hidden="true">
      <g className="palm-tree">
        <path className="palm-trunk" d="M100 96C104 170 116 260 112 420" />
        {fronds.map((d, i) => (
          <path key={i} className="palm-frond" d={d} style={{ '--i': i } as CSSProperties} />
        ))}
        <circle cx="100" cy="98" r="7" className="palm-coco" />
      </g>
    </svg>
  );
}
