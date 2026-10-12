import { useState, type CSSProperties, type FormEvent } from 'react';
import { useApp } from '../context';
import { AMENITIES, commission, propertyLabel, type Property, type PropertyInput } from '../lib/types';
import { OWN_DEFAULTS } from '../lib/store/types';
import { canvasToBlob, checkImageFile, toCanvas } from '../lib/image';
import { formatUSD, parseMoney } from '../lib/money';
import { go, href } from '../router';
import { Icon } from '../components/Icon';
import { LogoMark } from '../components/Logo';
import { useToast } from '../components/Toast';

export function PropertiesPage() {
  const { data } = useApp();
  const list = [...data.properties].sort((a, b) => Number(b.kind === 'propio') - Number(a.kind === 'propio') || a.sort - b.sort);
  return (
    <div className="page">
      <div className="page-head">
        <a className="icon-btn" href={href('/mas')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <div className="grow">
          <h1>Apartamentos</h1>
          <div className="sub">Lo que se muestra en la página pública</div>
        </div>
      </div>

      <div className="stack stagger">
        {list.map((p, i) => (
          <a key={p.id} className="panel list-item" href={href(`/apartamento/${p.id}`)} style={{ '--i': i, borderBottom: 0 } as CSSProperties}>
            <PropertyThumb p={p} />
            <span className="grow">
              <span className="title">{p.kind === 'propio' ? p.title || p.name : propertyLabel(p)}</span>
              <span className="sub">
                {p.nightly_usd != null ? `${formatUSD(p.nightly_usd)} / noche` : 'Sin precio'} · hasta {p.capacity}
              </span>
              <span className="row-wrap" style={{ marginTop: 6 }}>
                <span className={`badge ${p.kind === 'propio' ? 'badge-brand' : 'badge-sun'}`}>{p.kind === 'propio' ? 'Propio' : 'Aliado'}</span>
                {p.published ? (
                  <span className="badge badge-ok">
                    <Icon name="eye" /> Publicado
                  </span>
                ) : (
                  <span className="badge">Oculto</span>
                )}
                {p.kind === 'aliado' && commission(p) != null ? <span className="badge badge-sun">Comisión {formatUSD(commission(p)!)}</span> : null}
              </span>
            </span>
            <Icon name="chevronRight" className="chev" />
          </a>
        ))}
      </div>

      <a className="btn btn-primary btn-block" href={href('/apartamento/nuevo')}>
        <Icon name="plus" /> Agregar apartamento aliado
      </a>
      <p className="hint">
        Los aliados son apartamentos de otros dueños del conjunto. Se ofrecen en la página cuando el N°30 está ocupado. Tú pones el precio público; la diferencia con lo que
        cobra el dueño es tu comisión.
      </p>
    </div>
  );
}

function PropertyThumb({ p }: { p: Pick<Property, 'photos'> }) {
  return p.photos[0] ? (
    <img src={p.photos[0]} alt="" style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'cover', flex: 'none' }} />
  ) : (
    <span className="lead-icon" style={{ width: 64, height: 64, borderRadius: 14, background: 'linear-gradient(150deg, var(--brand), var(--brand-2))', color: '#fff' }}>
      <LogoMark style={{ width: 44, height: 'auto' }} />
    </span>
  );
}

const NEW_PARTNER: PropertyInput = {
  ...OWN_DEFAULTS,
  kind: 'aliado',
  name: '',
  title: '',
  unit: '',
  summary: '',
  description: '',
  bedrooms: null,
  beds: null,
  bathrooms: null,
  nightly_usd: null,
  partner_cost_usd: null,
  promo: '',
  amenities: ['Piscina', 'Áreas recreativas'],
  photos: [],
  published: false,
  sort: 10,
  contact_whatsapp: '',
  airbnb_url: '',
  instagram_url: '',
  tiktok_url: '',
  google_review_url: '',
};

export function PropertyForm({ id }: { id?: string }) {
  const { data, store, reload } = useApp();
  const toast = useToast();
  const existing = id ? data.properties.find((p) => p.id === id) : undefined;
  const [f, setF] = useState<PropertyInput>(() => (existing ? { ...existing } : { ...NEW_PARTNER }));
  const [price, setPrice] = useState(existing?.nightly_usd != null ? String(existing.nightly_usd) : '');
  const [cost, setCost] = useState(existing?.partner_cost_usd != null ? String(existing.partner_cost_usd) : '');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof PropertyInput>(k: K, v: PropertyInput[K]) => setF((x) => ({ ...x, [k]: v }));
  const own = f.kind === 'propio';

  if (id && !existing) {
    return (
      <div className="page">
        <h1>No encontramos ese apartamento</h1>
        <a className="btn btn-secondary" href={href('/apartamentos')}>
          Ver apartamentos
        </a>
      </div>
    );
  }

  const priceN = price.trim() ? parseMoney(price) : null;
  const costN = cost.trim() ? parseMoney(cost) : null;
  const gain = commission({ nightly_usd: priceN, partner_cost_usd: costN });

  async function save(next: PropertyInput): Promise<string> {
    const savedId = await store.saveProperty(next);
    await reload();
    return savedId;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const savedId = await save({ ...f, nightly_usd: priceN, partner_cost_usd: own ? null : costN });
      toast('Apartamento guardado');
      if (!id) go(`/apartamento/${savedId}`, { replace: true });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onPhotos(files: File[]) {
    if (!files.length) return;
    let pid = id;
    setUploading(true);
    try {
      // para subir fotos el apartamento tiene que existir
      if (!pid) {
        pid = await save({ ...f, nightly_usd: priceN, partner_cost_usd: own ? null : costN });
      }
      const urls: string[] = [];
      for (const file of files.slice(0, 12 - f.photos.length)) {
        const problem = checkImageFile(file);
        if (problem) {
          toast(problem, 'bad');
          continue;
        }
        const jpeg = await canvasToBlob(await toCanvas(file, 1600), 'image/jpeg', 0.82);
        urls.push(await store.uploadPhoto(pid, jpeg));
      }
      const photos = [...f.photos, ...urls].slice(0, 12);
      setF((x) => ({ ...x, photos }));
      await save({ ...f, id: pid, photos, nightly_usd: priceN, partner_cost_usd: own ? null : costN });
      toast(urls.length === 1 ? 'Foto agregada' : `${urls.length} fotos agregadas`);
      if (!id) go(`/apartamento/${pid}`, { replace: true });
    } catch (err) {
      toast((err as Error).message, 'bad');
    } finally {
      setUploading(false);
    }
  }

  async function removePhoto(url: string) {
    const photos = f.photos.filter((u) => u !== url);
    setF((x) => ({ ...x, photos }));
    if (id) {
      try {
        await save({ ...f, photos, nightly_usd: priceN, partner_cost_usd: own ? null : costN });
      } catch (err) {
        toast((err as Error).message, 'bad');
      }
    }
  }

  async function onDelete() {
    if (!id || own || !window.confirm('¿Eliminar este apartamento aliado y sus estadías? No se puede deshacer.')) return;
    try {
      await store.deleteProperty(id);
      await reload();
      toast('Apartamento eliminado');
      go('/apartamentos');
    } catch (err) {
      toast((err as Error).message, 'bad');
    }
  }

  const toggleAmenity = (a: string) => set('amenities', f.amenities.includes(a) ? f.amenities.filter((x) => x !== a) : [...f.amenities, a]);

  return (
    <form className="page" onSubmit={onSubmit} noValidate>
      <div className="page-head">
        <a className="icon-btn" href={href('/apartamentos')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <div className="grow">
          <h1>{existing ? (own ? 'Tu apartamento' : propertyLabel(existing)) : 'Nuevo aliado'}</h1>
          <div className="sub">{own ? 'Así se ve en la página pública' : 'Apartamento de otro dueño del conjunto'}</div>
        </div>
      </div>

      <div className="panel panel-pad">
        <label className="switch">
          <input type="checkbox" checked={f.published} onChange={(e) => set('published', e.target.checked)} />
          <span className="track" />
          <span>
            {f.published ? 'Publicado en la página' : 'Oculto en la página'}
            <span className="hint" style={{ display: 'block', fontWeight: 400 }}>
              {f.published ? 'Cualquiera puede verlo y consultar fechas.' : 'Solo tú lo ves.'}
            </span>
          </span>
        </label>
      </div>

      <section className="section" aria-labelledby="h-fotos">
        <div className="section-head">
          <h2 id="h-fotos">Fotos</h2>
          <span className="muted small num">{f.photos.length} / 12</span>
        </div>
        <div className="photo-grid">
          {f.photos.map((u, i) => (
            <figure key={u}>
              <img src={u} alt={`Foto ${i + 1}`} loading="lazy" />
              <button type="button" onClick={() => removePhoto(u)} aria-label={`Quitar foto ${i + 1}`}>
                <Icon name="x" />
              </button>
            </figure>
          ))}
          {f.photos.length < 12 ? (
            <label className="photo-add" aria-label="Agregar fotos">
              {uploading ? <span className="spinner" /> : <Icon name="plus" />}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                multiple
                disabled={uploading}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = '';
                  onPhotos(files);
                }}
              />
            </label>
          ) : null}
        </div>
        <p className="hint">La primera foto es la portada. Se reducen en el teléfono antes de subirlas y se les borra la ubicación.</p>
      </section>

      <section className="section" aria-labelledby="h-datos">
        <h2 id="h-datos">Datos</h2>
        <div className="field">
          <label htmlFor="title">Título en la página</label>
          <input id="title" className="input" maxLength={80} placeholder={own ? 'Tu Día en Tucacas · Apartamento N°30' : 'Apartamento con vista a la piscina'} value={f.title} onChange={(e) => set('title', e.target.value)} />
        </div>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="unit">Número</label>
            <input id="unit" className="input" maxLength={20} placeholder="12" value={f.unit} onChange={(e) => set('unit', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cap">Personas máx.</label>
            <input id="cap" className="input" inputMode="numeric" value={String(f.capacity)} onChange={(e) => set('capacity', Number(e.target.value.replace(/\D/g, '')) || 1)} />
          </div>
        </div>
        <div className="grid-3">
          {(
            [
              ['bedrooms', 'Habitaciones'],
              ['beds', 'Camas'],
              ['bathrooms', 'Baños'],
            ] as const
          ).map(([k, label]) => (
            <div className="field" key={k}>
              <label htmlFor={`f-${k}`}>{label}</label>
              <input
                id={`f-${k}`}
                className="input"
                inputMode="numeric"
                maxLength={2}
                value={f[k] == null ? '' : String(f[k])}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '');
                  set(k, v === '' ? null : Number(v));
                }}
              />
            </div>
          ))}
        </div>
        {!own ? (
          <div className="field">
            <label htmlFor="name">Nombre interno (solo tú lo ves)</label>
            <input id="name" className="input" maxLength={80} placeholder="Apto 12 · Sra. Carmen" value={f.name} onChange={(e) => set('name', e.target.value)} />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="summary">Descripción corta</label>
          <textarea id="summary" className="textarea" maxLength={280} style={{ minHeight: 80 }} value={f.summary} onChange={(e) => set('summary', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="description">Descripción completa</label>
          <textarea
            id="description"
            className="textarea"
            maxLength={2000}
            style={{ minHeight: 140 }}
            placeholder="Lo que hace especial al apartamento. Deja una línea en blanco para separar párrafos."
            value={f.description}
            onChange={(e) => set('description', e.target.value)}
          />
        </div>
      </section>

      <section className="section" aria-labelledby="h-precio">
        <h2 id="h-precio">Precio</h2>
        <div className="money-row">
          <div className="field">
            <label htmlFor="price">Precio público por noche</label>
            <input id="price" className="input" inputMode="decimal" placeholder="90" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {!own ? (
            <div className="field">
              <label htmlFor="cost">Lo que cobra el dueño</label>
              <input id="cost" className="input" inputMode="decimal" placeholder="100" value={cost} onChange={(e) => setCost(e.target.value)} />
            </div>
          ) : null}
        </div>
        {!own && gain != null ? (
          <div className="commission" role="status">
            <span>Tu comisión por noche</span>
            <span className="num">{gain >= 0 ? formatUSD(gain) : 'Revisa los montos'}</span>
          </div>
        ) : null}
        {own ? (
          <div className="field">
            <label htmlFor="promo">Promoción (opcional)</label>
            <input id="promo" className="input" maxLength={140} placeholder="Entre semana: 3 días y 2 noches por $165" value={f.promo} onChange={(e) => set('promo', e.target.value)} />
          </div>
        ) : null}
      </section>

      <section className="section" aria-labelledby="h-serv">
        <h2 id="h-serv">Servicios</h2>
        <div className="segmented">
          {AMENITIES.map((a) => (
            <label key={a} className="chip">
              <input type="checkbox" checked={f.amenities.includes(a)} onChange={() => toggleAmenity(a)} />
              <span>{a}</span>
            </label>
          ))}
        </div>
      </section>

      {own ? (
        <details className="disclosure">
          <summary>
            <Icon name="send" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
            Contacto y redes
            <Icon name="chevronRight" className="chev" />
          </summary>
          <div className="disclosure-body">
            <div className="field">
              <label htmlFor="wa">WhatsApp de reservas</label>
              <input id="wa" className="input" inputMode="tel" placeholder="584242703482" value={f.contact_whatsapp} onChange={(e) => set('contact_whatsapp', e.target.value.replace(/\D/g, '').slice(0, 15))} />
              <span className="hint">Con código de país, sin + ni espacios (58 para Venezuela).</span>
            </div>
            <div className="field">
              <label htmlFor="air">Enlace de Airbnb</label>
              <input id="air" className="input" inputMode="url" value={f.airbnb_url} onChange={(e) => set('airbnb_url', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ig">Enlace de Instagram</label>
              <input id="ig" className="input" inputMode="url" value={f.instagram_url} onChange={(e) => set('instagram_url', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="tt">Enlace de TikTok</label>
              <input
                id="tt"
                className="input"
                inputMode="url"
                placeholder="https://www.tiktok.com/@tu_cuenta"
                value={f.tiktok_url ?? ''}
                onChange={(e) => set('tiktok_url', e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="gr">Enlace para opinar en Google</label>
              <input
                id="gr"
                className="input"
                inputMode="url"
                placeholder="https://g.page/r/…/review"
                value={f.google_review_url ?? ''}
                onChange={(e) => set('google_review_url', e.target.value)}
              />
              <span className="hint">En tu perfil de Google: “Solicita opiniones” → copiar enlace. Se le ofrece a quien termina la encuesta contento.</span>
            </div>
          </div>
        </details>
      ) : (
        <details className="disclosure">
          <summary>
            <Icon name="idcard" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
            Dueño (para su planilla de autorización)
            <Icon name="chevronRight" className="chev" />
          </summary>
          <div className="disclosure-body">
            <div className="field">
              <label htmlFor="oname">Nombre del dueño</label>
              <input id="oname" className="input" maxLength={120} value={f.owner_name} onChange={(e) => set('owner_name', e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="oced">Cédula del dueño</label>
              <input id="oced" className="input" inputMode="numeric" maxLength={14} value={f.owner_cedula} onChange={(e) => set('owner_cedula', e.target.value)} />
            </div>
          </div>
        </details>
      )}

      {error ? (
        <div className="notice notice-bad" role="alert">
          <Icon name="alert" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="actionbar">
        <button className="btn btn-primary btn-block" type="submit" disabled={saving || uploading}>
          {saving ? <span className="spinner" /> : <Icon name="check" />} Guardar
        </button>
        {id && !own ? (
          <button className="btn btn-ghost btn-block btn-small" style={{ color: 'var(--bad)' }} type="button" onClick={onDelete}>
            <Icon name="trash" /> Eliminar apartamento
          </button>
        ) : null}
      </div>
    </form>
  );
}
