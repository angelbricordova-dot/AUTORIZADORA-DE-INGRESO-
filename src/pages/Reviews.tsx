// Opiniones de huéspedes: todo lo que respondieron (también lo privado), publicar, responder e importar el Google Form anterior.
import { useMemo, useState, type ChangeEvent } from 'react';
import { useApp } from '../context';
import type { Review, ReviewStatus } from '../lib/types';
import { REVIEW_ASPECTS, reviewScore } from '../lib/types';
import { formatDayMonth } from '../lib/dates';
import { importFormsCsv, type ImportedReview } from '../lib/formsImport';
import { whatsappUrl } from '../lib/publicAvailability';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { PropertyChips } from '../components/PropertyChips';

type Filter = 'pendiente' | 'publicada' | 'todas';

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number');
  return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
};
const fmt = (n: number | null) => (n == null ? '—' : n.toLocaleString('es-VE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));

export function surveyLink(unit: string): string {
  return `${window.location.origin}/opinion?apto=${encodeURIComponent(unit)}`;
}

export function ReviewsPage() {
  const { data } = useApp();
  const reviews = data.reviews ?? [];
  const pending = reviews.filter((r) => r.status === 'pendiente').length;
  const [filter, setFilter] = useState<Filter>(pending ? 'pendiente' : 'todas');
  const list = reviews.filter((r) => filter === 'todas' || r.status === filter);
  const own = data.properties.find((p) => p.kind === 'propio');
  const link = surveyLink(own?.unit ?? '30');

  return (
    <div className="page">
      <div className="page-head">
        <a className="icon-btn" href={href('/mas')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <div className="grow">
          <h1>Opiniones de huéspedes</h1>
          <div className="sub">La encuesta de la estadía, ahora dentro de la página</div>
        </div>
      </div>

      <Summary reviews={reviews} />

      <section className="panel panel-pad stack" aria-labelledby="h-pedir">
        <h2 id="h-pedir" className="install-title">
          Pedir una opinión
        </h2>
        <p className="small muted">Mándale este enlace al huésped cuando se vaya. Lo que mejoraría y lo que más le gustó solo lo ven ustedes; su comentario se publica si da permiso y tú lo apruebas.</p>
        <div className="row-wrap">
          <a
            className="btn btn-whatsapp btn-small"
            href={whatsappUrl('', `¡Gracias por quedarte con nosotros en Tucacas! ¿Nos regalas 2 minutos para contarnos cómo te fue? ${link}`)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="send" /> Enviar por WhatsApp
          </a>
          <a className="btn btn-soft btn-small" href="/opinion" target="_blank" rel="noopener noreferrer">
            <Icon name="eye" /> Ver la encuesta
          </a>
        </div>
      </section>

      <section className="section" aria-labelledby="h-respuestas">
        <div className="section-head">
          <h2 id="h-respuestas">Respuestas</h2>
          {pending ? <span className="badge badge-warn">{pending} por revisar</span> : null}
        </div>
        <div className="segmented" role="radiogroup" aria-label="Mostrar">
          {(
            [
              ['pendiente', 'Por revisar'],
              ['publicada', 'Publicadas'],
              ['todas', 'Todas'],
            ] as const
          ).map(([id, label]) => (
            <label key={id} className="chip">
              <input type="radio" name="filtro" checked={filter === id} onChange={() => setFilter(id)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        {list.length ? (
          <div className="stack">
            {list.map((r) => (
              <ReviewCard key={r.id} r={r} />
            ))}
          </div>
        ) : (
          <p className="empty-line">{filter === 'pendiente' ? 'No hay respuestas por revisar.' : 'Todavía no hay respuestas.'}</p>
        )}
      </section>

      <ImportOld />
    </div>
  );
}

function Summary({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) return null;
  const score = avg(reviews.map(reviewScore));
  const rec = avg(reviews.map((r) => r.recommend));
  const kitchen = reviews.filter((r) => r.kitchen_ok != null);
  return (
    <section className="stats" aria-label="Resumen de opiniones">
      <div className="stat">
        <div className="v">{fmt(score)}</div>
        <div className="k">Nota promedio (de 5) · {reviews.length} respuestas</div>
      </div>
      <div className="stat">
        <div className="v">{fmt(rec)}</div>
        <div className="k">Nos recomendarían (de 10)</div>
      </div>
      <div className="stat">
        <div className="v">{kitchen.length ? `${Math.round((kitchen.filter((r) => r.kitchen_ok).length / kitchen.length) * 100)}%` : '—'}</div>
        <div className="k">Cocina completa</div>
      </div>
      {REVIEW_ASPECTS.map((a) => (
        <div key={a.key} className="stat">
          <div className="v">{fmt(avg(reviews.map((r) => r[a.key])))}</div>
          <div className="k">{a.label}</div>
        </div>
      ))}
    </section>
  );
}

const STATUS_LABEL: Record<ReviewStatus, string> = { pendiente: 'Por revisar', publicada: 'Publicada', oculta: 'Oculta' };
const PERMISSION_LABEL = { si: 'Dio permiso para publicar su comentario', no: 'No quiere que se publique', consultar: 'Publicar solo si le consultan antes' };

function ReviewCard({ r }: { r: Review }) {
  const { data, store, reload } = useApp();
  const toast = useToast();
  const [reply, setReply] = useState(r.reply);
  const [busy, setBusy] = useState(false);
  const score = reviewScore(r);
  const canPublish = r.permission !== 'no' && !!r.comment;
  const prop = data.properties.find((p) => p.id === r.property_id);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await fn();
      await reload();
      toast(ok);
    } catch (e) {
      toast((e as Error).message, 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="panel panel-pad stack review-admin" aria-label={`Opinión de ${r.author_name || 'un huésped'}`}>
      <div className="spread">
        <span>
          <strong>{r.author_name || 'Huésped sin nombre'}</strong>
          <span className="small muted" style={{ display: 'block' }}>
            {formatDayMonth(r.created_at.slice(0, 10))} {r.created_at.slice(0, 4)}
            {r.nights ? ` · ${r.nights} ${r.nights === 1 ? 'noche' : 'noches'}` : ''}
            {prop && prop.kind !== 'propio' ? ` · ${prop.name}` : ''}
          </span>
        </span>
        <span className={`badge ${r.status === 'publicada' ? 'badge-ok' : r.status === 'oculta' ? '' : 'badge-warn'}`}>{STATUS_LABEL[r.status]}</span>
      </div>

      <div className="review-scores small">
        {score != null ? (
          <span className="badge badge-sun">
            <Icon name="star" /> {fmt(score)}
          </span>
        ) : null}
        {REVIEW_ASPECTS.filter((a) => r[a.key] != null).map((a) => (
          <span key={a.key}>
            {a.label} <strong>{r[a.key]}</strong>
          </span>
        ))}
        {r.recommend != null ? (
          <span>
            Recomienda <strong>{r.recommend}/10</strong>
          </span>
        ) : null}
        {r.kitchen_ok != null ? <span>Cocina: {r.kitchen_ok ? 'tenía todo' : `faltó ${r.kitchen_missing || 'algo'}`}</span> : null}
      </div>

      {r.comment ? (
        <div>
          <span className="tiny muted">Comentario para la página</span>
          <p className="review-text review-public">{r.comment}</p>
        </div>
      ) : null}
      {r.liked ? (
        <div>
          <span className="tiny muted">Lo que más le gustó</span>
          <p className="review-text">{r.liked}</p>
        </div>
      ) : null}
      <div className="review-private">
        <span className="tiny muted">
          <Icon name="eye" /> Qué mejoraría · solo para ustedes
        </span>
        <p className="review-text">{r.improve}</p>
      </div>
      <span className={`small ${r.permission === 'no' ? 'muted' : ''}`}>{PERMISSION_LABEL[r.permission]}</span>

      <div className="field">
        <label htmlFor={`rep-${r.id}`}>Respuesta pública (opcional)</label>
        <textarea id={`rep-${r.id}`} className="textarea" rows={2} maxLength={500} placeholder="¡Gracias por venir! Te esperamos de nuevo." value={reply} onChange={(e) => setReply(e.target.value)} />
      </div>

      <div className="row-wrap">
        {r.status !== 'publicada' ? (
          <button
            className="btn btn-primary btn-small"
            type="button"
            disabled={busy || !canPublish}
            title={canPublish ? undefined : 'El huésped no dio permiso o no dejó un comentario'}
            onClick={() => run(() => store.moderateReview(r.id, { status: 'publicada', reply }), 'Publicada en la página')}
          >
            <Icon name="check" /> Publicar
          </button>
        ) : (
          <button className="btn btn-secondary btn-small" type="button" disabled={busy} onClick={() => run(() => store.moderateReview(r.id, { status: 'oculta' }), 'Ya no se muestra')}>
            Ocultar
          </button>
        )}
        {reply !== r.reply ? (
          <button className="btn btn-soft btn-small" type="button" disabled={busy} onClick={() => run(() => store.moderateReview(r.id, { reply }), 'Respuesta guardada')}>
            Guardar respuesta
          </button>
        ) : null}
        <button
          className="btn btn-ghost btn-small"
          type="button"
          disabled={busy}
          style={{ color: 'var(--bad)' }}
          onClick={() => window.confirm('¿Borrar esta respuesta? No se puede deshacer.') && run(() => store.deleteReview(r.id), 'Respuesta borrada')}
        >
          <Icon name="trash" /> Borrar
        </button>
      </div>
      {!canPublish ? <p className="hint">No se puede publicar: {r.permission === 'no' ? 'el huésped no dio permiso.' : 'no dejó un comentario para la página.'}</p> : null}
    </article>
  );
}

/** Importar las respuestas del Google Form anterior (CSV de Google Sheets). */
function ImportOld() {
  const { data, store, reload, ownId } = useApp();
  const toast = useToast();
  const [rows, setRows] = useState<ImportedReview[] | null>(null);
  const [text, setText] = useState('');
  const [propertyId, setPropertyId] = useState(ownId);
  const [busy, setBusy] = useState(false);
  const preview = useMemo(() => rows ?? (text.trim() ? importFormsCsv(text) : null), [rows, text]);

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2_000_000) return toast('El archivo es muy grande.', 'bad');
    const parsed = importFormsCsv(await file.text());
    if (!parsed.length) return toast('No reconocí el archivo. Descárgalo de Google Sheets como .csv.', 'bad');
    setRows(parsed);
  }

  async function onImport() {
    if (!preview?.length) return;
    setBusy(true);
    let ok = 0;
    try {
      for (const r of preview) {
        await store.importReview(propertyId, r.input, r.created_at);
        ok++;
      }
      await reload();
      toast(`Importé ${ok} ${ok === 1 ? 'respuesta' : 'respuestas'}. Revísalas y publica las que quieras.`);
      setRows(null);
      setText('');
    } catch (e) {
      toast(`${ok ? `Importé ${ok}. ` : ''}${(e as Error).message}`, 'bad');
      await reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="disclosure">
      <summary>
        <Icon name="download" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
        Importar del formulario anterior (Google)
        <Icon name="chevronRight" className="chev" />
      </summary>
      <div className="disclosure-body">
        <ol className="steps small">
          <li>Abre la hoja de respuestas del formulario en Google Sheets.</li>
          <li>
            <strong>Archivo → Descargar → Valores separados por comas (.csv)</strong>.
          </li>
          <li>Elige ese archivo aquí (o pega su contenido) y toca “Importar”.</li>
        </ol>
        {data.properties.length > 1 ? <PropertyChips properties={data.properties} value={propertyId} onChange={setPropertyId} name="import-apto" /> : null}
        <label className="btn btn-soft btn-small" style={{ alignSelf: 'flex-start' }}>
          <Icon name="file" /> Elegir el archivo .csv
          <input type="file" accept=".csv,text/csv,text/plain" className="visually-hidden" onChange={onFile} />
        </label>
        <div className="field">
          <label htmlFor="csv">O pega aquí el contenido</label>
          <textarea
            id="csv"
            className="textarea"
            rows={4}
            value={text}
            onChange={(e) => {
              setRows(null);
              setText(e.target.value);
            }}
          />
        </div>
        {preview ? (
          preview.length ? (
            <div className="notice notice-ok">
              <Icon name="check" />
              <span>
                Encontré {preview.length} {preview.length === 1 ? 'respuesta' : 'respuestas'}
                {preview.filter((p) => p.input.permission === 'si').length ? `, ${preview.filter((p) => p.input.permission === 'si').length} con permiso para publicar` : ''}.
              </span>
            </div>
          ) : (
            <div className="notice notice-warn">
              <Icon name="alert" />
              <span>No reconocí las columnas del formulario. Revisa que sea el CSV de las respuestas.</span>
            </div>
          )
        ) : null}
        <button className="btn btn-primary" type="button" disabled={busy || !preview?.length} onClick={onImport}>
          {busy ? <span className="spinner" /> : <Icon name="download" />} Importar
        </button>
      </div>
    </details>
  );
}
