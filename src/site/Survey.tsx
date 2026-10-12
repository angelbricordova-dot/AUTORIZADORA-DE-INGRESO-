// Encuesta "Ayúdanos a mejorar tu próxima estadía" (reemplaza el Google Form).
import { useEffect, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import type { PublicData, PublicListing, ReviewInput, ReviewPermission } from '../lib/types';
import { REVIEW_ASPECTS, reviewScore } from '../lib/types';
import { store } from '../lib/store';
import { whatsappUrl } from '../lib/publicAvailability';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { listingName, slugUnit } from './parts';

const EMPTY: ReviewInput = {
  author_name: '',
  nights: null,
  cleanliness: null,
  beds: null,
  ac: null,
  wifi: null,
  communication: null,
  kitchen_ok: null,
  kitchen_missing: '',
  recommend: null,
  liked: '',
  improve: '',
  comment: '',
  permission: 'si',
};

const PERMISSIONS: { id: ReviewPermission; label: string }[] = [
  { id: 'si', label: 'Sí' },
  { id: 'no', label: 'No' },
  { id: 'consultar', label: 'Solo si me consultan antes' },
];

/** Cinco estrellas grandes para tocar con el pulgar. */
function StarPick({ value, onChange, label }: { value: number | null; onChange: (n: number) => void; label: string }) {
  return (
    <div className="star-pick" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} de 5`}
          className={value != null && n <= value ? 'on' : ''}
          style={{ '--n': n } as CSSProperties}
          onClick={() => onChange(n)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function SurveyPage({ data, own, phone, query }: { data: PublicData | null; own?: PublicListing; phone: string; query: URLSearchParams }) {
  const listings = data?.listings ?? [];
  const wanted = query.get('apto');
  const initial = (wanted && listings.find((l) => slugUnit(l.unit) === slugUnit(wanted))) || own;
  const [propertyId, setPropertyId] = useState(initial?.id ?? '');
  const [f, setF] = useState<ReviewInput>(EMPTY);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [trap, setTrap] = useState('');
  const started = useRef(Date.now());
  const set = <K extends keyof ReviewInput>(k: K, v: ReviewInput[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    document.title = 'Tu opinión · Tu Día en Tucacas';
  }, []);
  useEffect(() => {
    if (!propertyId && initial) setPropertyId(initial.id);
  }, [initial, propertyId]);

  const listing = listings.find((l) => l.id === propertyId) ?? initial;
  const happy = (reviewScore(f) ?? 0) >= 4.5 && (f.recommend ?? 10) >= 9;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // trampa para robots: un campo oculto que una persona nunca llena, y un mínimo de tiempo
    if (trap || Date.now() - started.current < 3000) {
      setDone(true);
      return;
    }
    if (!propertyId) return setError('Elige el apartamento donde te quedaste.');
    setSending(true);
    try {
      await store.submitReview(propertyId, f);
      setDone(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <main className="site-main">
        <section className="thanks-card" aria-labelledby="h-gracias">
          <span className="thanks-check" aria-hidden="true">
            <Icon name="check" />
          </span>
          <h1 id="h-gracias">¡Gracias por contarnos!</h1>
          <p>Leemos cada respuesta. Lo que nos dijiste nos ayuda a que tu próxima estadía sea aún mejor.</p>
          {happy && listing?.google_review_url ? (
            <div className="google-ask">
              <p className="small">¿Nos ayudas con 10 segundos más? Tu opinión en Google hace que más familias nos encuentren.</p>
              <a className="btn btn-sun btn-block" href={listing.google_review_url} target="_blank" rel="noopener noreferrer">
                <Icon name="star" /> Dejar mi opinión en Google
              </a>
            </div>
          ) : null}
          <div className="row-wrap">
            <a className="btn btn-primary" href="/">
              Volver al inicio
            </a>
            {phone ? (
              <a className="btn btn-soft" href={whatsappUrl(phone, 'Hola, acabo de responder la encuesta de mi estadía.')} target="_blank" rel="noopener noreferrer">
                <Icon name="send" /> WhatsApp
              </a>
            ) : null}
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="site-main survey">
      <header className="survey-head">
        <LogoMark className="survey-art" />
        <h1>Ayúdanos a mejorar tu próxima estadía</h1>
        <p>2 minutos. Lo que nos cuentes para mejorar solo lo vemos nosotros.</p>
      </header>

      <form className="stack survey-form" onSubmit={onSubmit} noValidate>
        {listings.length > 1 ? (
          <fieldset className="q">
            <legend>¿Dónde te quedaste?</legend>
            <div className="segmented wrap">
              {listings.map((l) => (
                <label key={l.id} className="chip">
                  <input type="radio" name="apto" checked={propertyId === l.id} onChange={() => setPropertyId(l.id)} />
                  <span>{listingName(l)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <fieldset className="q">
          <legend>¿Cuántas noches te quedaste con nosotros?</legend>
          <div className="stepper">
            <button type="button" aria-label="Una noche menos" disabled={!f.nights || f.nights <= 1} onClick={() => set('nights', Math.max(1, (f.nights ?? 1) - 1))}>
              −
            </button>
            <output aria-live="polite">{f.nights ?? '—'}</output>
            <button type="button" aria-label="Una noche más" onClick={() => set('nights', Math.min(60, (f.nights ?? 0) + 1))}>
              +
            </button>
          </div>
        </fieldset>

        {REVIEW_ASPECTS.map((a) => (
          <fieldset key={a.key} className="q">
            <legend>{a.question}</legend>
            <StarPick value={f[a.key]} onChange={(n) => set(a.key, n)} label={a.label} />
          </fieldset>
        ))}

        <fieldset className="q">
          <legend>¿La cocina tenía todo lo que necesitaste?</legend>
          <div className="segmented">
            <label className="chip">
              <input type="radio" name="cocina" checked={f.kitchen_ok === true} onChange={() => set('kitchen_ok', true)} />
              <span>Sí, todo</span>
            </label>
            <label className="chip">
              <input type="radio" name="cocina" checked={f.kitchen_ok === false} onChange={() => set('kitchen_ok', false)} />
              <span>Faltó algo</span>
            </label>
          </div>
          {f.kitchen_ok === false ? (
            <div className="field">
              <label htmlFor="falto">Si faltó algo, cuéntanos qué</label>
              <input id="falto" className="input" maxLength={300} value={f.kitchen_missing} onChange={(e) => set('kitchen_missing', e.target.value)} />
            </div>
          ) : null}
        </fieldset>

        <fieldset className="q">
          <legend>¿Qué tan probable es que recomiendes el apartamento a un familiar o amigo?</legend>
          <div className="nps" role="radiogroup" aria-label="Del 1 al 10">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" role="radio" aria-checked={f.recommend === n} className={f.recommend === n ? 'on' : ''} onClick={() => set('recommend', n)}>
                {n}
              </button>
            ))}
          </div>
          <div className="nps-legend tiny muted">
            <span>Nada probable</span>
            <span>Muy probable</span>
          </div>
        </fieldset>

        <fieldset className="q">
          <legend>
            <label htmlFor="gusto">¿Qué fue lo que MÁS te gustó?</label>
          </legend>
          <textarea id="gusto" className="textarea" maxLength={1000} rows={3} value={f.liked} onChange={(e) => set('liked', e.target.value)} />
        </fieldset>

        <fieldset className="q">
          <legend>
            <label htmlFor="mejora">
              ¿Qué mejorarías? Sé directo, no te preocupes por herirnos: así crecemos. <span className="req">*</span>
            </label>
          </legend>
          <textarea id="mejora" className="textarea" maxLength={1000} rows={3} required value={f.improve} onChange={(e) => set('improve', e.target.value)} />
          <span className="hint">Esto solo lo vemos nosotros.</span>
        </fieldset>

        <fieldset className="q q-public">
          <legend>
            <label htmlFor="comentario">Deja un comentario sobre tu estadía</label>
          </legend>
          <span className="hint">Es lo que verán otros huéspedes en nuestra página.</span>
          <textarea
            id="comentario"
            className="textarea"
            maxLength={1000}
            rows={4}
            placeholder="Ej.: Pasamos un fin de semana increíble en familia. El apartamento estaba impecable, la piscina es genial y quedamos a pocos minutos de los muelles para ir a los cayos. ¡Volveremos!"
            value={f.comment}
            onChange={(e) => set('comment', e.target.value)}
          />
        </fieldset>

        <fieldset className="q">
          <legend>¿Nos das permiso de publicar tu comentario en nuestra página y redes?</legend>
          <div className="segmented wrap">
            {PERMISSIONS.map((p) => (
              <label key={p.id} className="chip">
                <input type="radio" name="permiso" checked={f.permission === p.id} onChange={() => set('permission', p.id)} />
                <span>{p.label}</span>
              </label>
            ))}
          </div>
          {f.permission !== 'no' && f.comment.trim() ? (
            <div className="field">
              <label htmlFor="nombre">Tu nombre (se muestra como “María G.”)</label>
              <input id="nombre" className="input" maxLength={60} autoComplete="name" value={f.author_name} onChange={(e) => set('author_name', e.target.value)} />
            </div>
          ) : null}
        </fieldset>

        <div className="hp" aria-hidden="true">
          <label htmlFor="sitio">Sitio web</label>
          <input id="sitio" tabIndex={-1} autoComplete="off" value={trap} onChange={(e) => setTrap(e.target.value)} />
        </div>

        {error ? (
          <div className="notice notice-bad" role="alert">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        ) : null}

        <button className="btn btn-primary btn-block" type="submit" disabled={sending}>
          {sending ? <span className="spinner" /> : <Icon name="send" />} Enviar mi opinión
        </button>
      </form>
    </main>
  );
}
