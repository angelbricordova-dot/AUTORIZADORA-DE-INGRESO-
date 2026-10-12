// Reseñas de huéspedes: promedio, tarjetas deslizables y la invitación a dejar la propia.
import type { CSSProperties } from 'react';
import type { PublicListing, PublicReview } from '../lib/types';
import { REVIEW_ASPECTS } from '../lib/types';
import { monthName } from '../lib/dates';
import { Icon } from '../components/Icon';

export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="stars" style={{ '--s': `${size}px` } as CSSProperties} role="img" aria-label={`${value.toLocaleString('es-VE')} de 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="star" style={{ '--fill': `${Math.max(0, Math.min(1, value - i + 1)) * 100}%` } as CSSProperties} />
      ))}
    </span>
  );
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number');
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};

export function ReviewsSection({ reviews, title = 'Lo que dicen nuestros huéspedes' }: { reviews: PublicReview[]; title?: string }) {
  if (!reviews.length) return null;
  const total = avg(reviews.map((r) => r.rating));
  const aspects = REVIEW_ASPECTS.map((a) => ({ ...a, value: avg(reviews.map((r) => r[a.key])) })).filter((a) => a.value != null);
  return (
    <section className="site-section" aria-labelledby="h-resenas" data-reveal>
      <h2 id="h-resenas">{title}</h2>
      {total != null ? (
        <div className="review-summary">
          <span className="review-big num">{total.toLocaleString('es-VE', { minimumFractionDigits: 1 })}</span>
          <span>
            <Stars value={total} size={20} />
            <span className="small muted" style={{ display: 'block' }}>
              {reviews.length} {reviews.length === 1 ? 'opinión' : 'opiniones'} de huéspedes
            </span>
          </span>
        </div>
      ) : null}
      {aspects.length ? (
        <ul className="aspect-bars" aria-label="Notas por aspecto">
          {aspects.map((a) => (
            <li key={a.key}>
              <span>{a.label}</span>
              <span className="bar" aria-hidden="true">
                <i style={{ '--p': a.value! / 5 } as CSSProperties} />
              </span>
              <span className="num small">{a.value!.toLocaleString('es-VE', { minimumFractionDigits: 1 })}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="review-track">
        {reviews.map((r, i) => (
          <article key={r.id} className="review-card" style={{ '--i': i } as CSSProperties}>
            {r.rating != null ? <Stars value={r.rating} /> : null}
            <blockquote>{r.liked}</blockquote>
            <footer className="small muted">
              <strong>{r.author}</strong>
              {r.nights ? ` · ${r.nights} ${r.nights === 1 ? 'noche' : 'noches'}` : ''} · {monthName(Number(r.created_at.slice(5, 7)) - 1)} {r.created_at.slice(0, 4)}
            </footer>
            {r.reply ? (
              <p className="review-reply small">
                <strong>Tu Día en Tucacas:</strong> {r.reply}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

/** "¿Te hospedaste con nosotros?" → encuesta. */
export function ReviewInvite({ l }: { l?: Pick<PublicListing, 'unit'> }) {
  return (
    <section className="invite-card" aria-labelledby="h-opina" data-reveal>
      <span className="invite-icon" aria-hidden="true">
        <Icon name="star" />
      </span>
      <span className="grow">
        <h2 id="h-opina">¿Te hospedaste con nosotros?</h2>
        <p className="small muted">Cuéntanos cómo te fue en 2 minutos. Nos ayuda a que tu próxima estadía sea aún mejor.</p>
      </span>
      <a className="btn btn-primary" href={l ? `/opinion?apto=${encodeURIComponent(l.unit)}` : '/opinion'}>
        Dejar mi opinión
      </a>
    </section>
  );
}
