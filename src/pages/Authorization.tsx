import { useEffect, useState, type ChangeEvent, type DragEvent } from 'react';
import { useApp } from '../context';
import type { Guest, Reservation, StayType, Vehicle } from '../lib/types';
import { MAX_GUESTS, MAX_VEHICLES, STAY_TYPES } from '../lib/types';
import { compareISO, formatDMY, formatLong, nightsBetween, todayISO } from '../lib/dates';
import { formatCedula, isValidCedula, isValidPlate, normalizePlate, parseGuestText } from '../lib/cedula';
import { checkImageFile, thumbnail } from '../lib/image';
import { readCedulaLocal, readPlateLocal, warmUpOcr } from '../lib/ocr';
import { readCedulaAI } from '../lib/ai';
import { authorizationFileName, buildAuthorizationXlsx, validateSheet, type AuthorizationSheet } from '../lib/excel';
import { whatsappMessage } from '../lib/message';
import { XLSX_TYPE, downloadBlob, shareFile, whatsappLink } from '../lib/share';
import { href } from '../router';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { StayRow, stayDates } from '../components/StayRow';
import templateUrl from '../assets/plantilla-pescadores.xlsx?url';

interface GuestRow extends Guest {
  key: number;
  thumb?: string;
  review?: boolean;
}
interface VehicleRow extends Vehicle {
  key: number;
  thumb?: string;
  review?: boolean;
}

const SHEET_ORDER: StayType[] = ['Familiar', 'Alquiler Fijo', 'Alquiler Vacacional', 'Mantenimiento', 'Otros'];

let seq = 0;
const nextKey = () => ++seq;

/* ------------------------------------------------------------------ */
/* Elegir estadía                                                      */
/* ------------------------------------------------------------------ */

export function PickStayPage() {
  const { data, today } = useApp();
  const upcoming = data.reservations
    .filter((r) => r.status !== 'cancelada' && r.check_out >= today)
    .sort((a, b) => compareISO(a.check_in, b.check_in));
  const pending = upcoming.filter((r) => r.auth_status !== 'enviada');
  const sent = upcoming.filter((r) => r.auth_status === 'enviada');
  return (
    <div className="page">
      <div className="row">
        <a className="icon-btn" href={href('/')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <h1>¿Para cuál estadía?</h1>
      </div>
      <a className="btn btn-primary btn-block" href={href('/reserva/nueva?then=auth')}>
        <Icon name="plus" /> Estadía nueva
      </a>
      <section className="section" aria-labelledby="h-sin">
        <h2 id="h-sin">Sin autorización enviada</h2>
        <div className="panel list">
          {pending.length ? (
            pending.map((r) => <StayRow key={r.id} r={r} to={`/autorizacion/${r.id}`} />)
          ) : (
            <div className="empty">
              <p className="muted">Todas las estadías próximas ya tienen su autorización enviada.</p>
            </div>
          )}
        </div>
      </section>
      {sent.length ? (
        <section className="section" aria-labelledby="h-env">
          <h2 id="h-env">Ya enviadas</h2>
          <div className="panel list">
            {sent.map((r) => (
              <StayRow key={r.id} r={r} to={`/autorizacion/${r.id}`} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Autorización de una estadía                                         */
/* ------------------------------------------------------------------ */

type ReadMode = 'local' | 'ia';

export function AuthorizationPage({ id }: { id: string }) {
  const { data } = useApp();
  const r = data.reservations.find((x) => x.id === id);
  if (!r) {
    return (
      <div className="page">
        <h1>No encontramos esa estadía</h1>
        <a className="btn btn-secondary" href={href('/autorizacion')}>
          Elegir otra
        </a>
      </div>
    );
  }
  return <AuthorizationEditor key={r.id} r={r} />;
}

function AuthorizationEditor({ r }: { r: Reservation }) {
  const { data, store, reload, aiEnabled, getAccessToken } = useApp();
  const toast = useToast();
  const settings = data.settings;

  const [guests, setGuests] = useState<GuestRow[]>(() =>
    r.guests.length ? r.guests.map((g) => ({ ...g, key: nextKey() })) : [],
  );
  const [vehicles, setVehicles] = useState<VehicleRow[]>(() => r.vehicles.map((v) => ({ ...v, key: nextKey() })));
  const [stayType, setStayType] = useState<StayType>(r.stay_type);
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<ReadMode>(aiEnabled ? 'ia' : 'local');
  const [reading, setReading] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [sentState, setSentState] = useState<'idle' | 'downloaded' | 'shared'>(r.auth_status === 'enviada' ? 'shared' : 'idle');
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (mode === 'local') warmUpOcr();
  }, [mode]);

  const people = guests.filter((g) => g.full_name.trim() || g.cedula.trim());
  const room = MAX_GUESTS - guests.length;

  function addGuests(list: Partial<GuestRow>[]) {
    setGuests((cur) => {
      const merged = cur.map((x) => ({ ...x }));
      for (const g of list) {
        // si la cédula ya está, se completa el nombre en vez de duplicar
        const dup = g.cedula ? merged.find((x) => x.cedula && x.cedula === g.cedula) : undefined;
        if (dup) {
          if (!dup.full_name && g.full_name) dup.full_name = g.full_name;
          continue;
        }
        const blank = merged.find((x) => !x.full_name.trim() && !x.cedula.trim());
        const row: GuestRow = { key: nextKey(), full_name: '', cedula: '', is_minor: false, ...g } as GuestRow;
        if (blank) Object.assign(blank, row, { key: blank.key });
        else if (merged.length < MAX_GUESTS) merged.push(row);
      }
      return [...merged];
    });
  }

  const updateGuest = (key: number, patch: Partial<GuestRow>) =>
    setGuests((cur) => cur.map((g) => (g.key === key ? { ...g, ...patch, review: false } : g)));
  const removeGuest = (key: number) => setGuests((cur) => cur.filter((g) => g.key !== key));
  const updateVehicle = (key: number, patch: Partial<VehicleRow>) =>
    setVehicles((cur) => cur.map((v) => (v.key === key ? { ...v, ...patch, review: false } : v)));
  const removeVehicle = (key: number) => setVehicles((cur) => cur.filter((v) => v.key !== key));

  async function readPhotos(files: File[]) {
    const ok: File[] = [];
    for (const f of files) {
      const problem = checkImageFile(f);
      if (problem) toast(problem, 'bad');
      else ok.push(f);
    }
    if (!ok.length) return;
    if (ok.length > room) toast(`La planilla admite ${MAX_GUESTS} personas; se leerán las primeras ${Math.max(room, 0)}.`, 'bad');
    const batch = ok.slice(0, Math.max(room, 0));
    for (let i = 0; i < batch.length; i++) {
      const file = batch[i];
      setReading(`Leyendo cédula ${i + 1} de ${batch.length}${mode === 'ia' ? ' con IA' : ''}…`);
      const thumb = await thumbnail(file).catch(() => undefined);
      try {
        if (mode === 'ia') {
          const token = await getAccessToken();
          if (!token) throw new Error('Inicia sesión para usar la lectura con IA.');
          const found = await readCedulaAI(file, token);
          if (found.length) addGuests(found.map((g) => ({ ...g, thumb, review: true })));
          else addGuests([{ full_name: '', cedula: '', thumb, review: true }]);
        } else {
          const res = await readCedulaLocal(file);
          addGuests([{ full_name: res.full_name, cedula: res.cedula, thumb, review: true }]);
        }
      } catch (e) {
        toast((e as Error).message || 'No se pudo leer la foto. Escribe los datos.', 'bad');
        addGuests([{ full_name: '', cedula: '', thumb, review: true }]);
      }
    }
    setReading(null);
  }

  async function readPlatePhoto(file: File) {
    const problem = checkImageFile(file);
    if (problem) return toast(problem, 'bad');
    if (vehicles.length >= MAX_VEHICLES) return toast(`La planilla admite ${MAX_VEHICLES} vehículos.`, 'bad');
    setReading('Leyendo la placa…');
    const thumb = await thumbnail(file).catch(() => undefined);
    let plate = '';
    try {
      plate = await readPlateLocal(file);
    } catch {
      /* se escribe a mano */
    }
    setVehicles((cur) => [...cur, { key: nextKey(), description: '', plate, thumb, review: true }]);
    setReading(null);
    if (!plate) toast('No se leyó la placa. Escríbela a mano.', 'bad');
  }

  function onFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    readPhotos(files);
  }
  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDrag(false);
    readPhotos(Array.from(e.dataTransfer.files));
  }

  function applyPaste() {
    const parsed = parseGuestText(pasteText);
    if (!parsed.guests.length && !parsed.vehicles.length) {
      toast('No encontré nombres ni cédulas en ese texto.', 'bad');
      return;
    }
    addGuests(parsed.guests.map((g) => ({ ...g, review: !g.full_name || (!g.cedula && !g.is_minor) })));
    if (parsed.vehicles.length)
      setVehicles((cur) => [...cur, ...parsed.vehicles.map((v) => ({ ...v, key: nextKey(), review: !v.description }))].slice(0, MAX_VEHICLES));
    setPasteText('');
    setPasteOpen(false);
    toast(`Agregué ${parsed.guests.length} ${parsed.guests.length === 1 ? 'persona' : 'personas'}${parsed.vehicles.length ? ' y el vehículo' : ''}. Revisa los datos.`);
  }

  const sheet: AuthorizationSheet = {
    emitted: todayISO(),
    settings,
    guests: people.map((g) => ({ full_name: g.full_name.trim(), cedula: g.cedula.trim(), is_minor: g.is_minor })),
    vehicles: vehicles.filter((v) => v.plate.trim() || v.description.trim()).map((v) => ({ description: v.description.trim(), plate: normalizePlate(v.plate) })),
    stayType,
    checkIn: r.check_in,
    checkOut: r.check_out,
    notes,
  };

  async function buildFile(): Promise<File | null> {
    const errs = validateSheet(sheet);
    sheet.guests.forEach((g) => {
      if (g.cedula && !isValidCedula(g.cedula)) errs.push(`La cédula de ${g.full_name || 'una persona'} no parece válida (${g.cedula}).`);
      if (!g.full_name) errs.push(`Falta el nombre de quien tiene la cédula ${g.cedula}.`);
    });
    sheet.vehicles.forEach((v, i) => {
      if (!isValidPlate(v.plate)) errs.push(`Revisa la placa del vehículo ${i + 1}.`);
      if (v.description.length < 2) errs.push(`Escribe modelo y color del vehículo ${i + 1}.`);
    });
    setErrors(errs);
    if (errs.length) {
      document.getElementById('errores')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return null;
    }
    await store.saveAuthorization(r.id, sheet.guests, sheet.vehicles);
    if (stayType !== r.stay_type) {
      await store.saveReservation({ ...r, stay_type: stayType });
    }
    const template = await fetch(templateUrl).then((res) => {
      if (!res.ok) throw new Error('No se pudo cargar la planilla.');
      return res.arrayBuffer();
    });
    const buf = await buildAuthorizationXlsx(template, sheet);
    return new File([buf], authorizationFileName(sheet), { type: XLSX_TYPE });
  }

  async function onSend() {
    setBusy(true);
    try {
      const file = await buildFile();
      if (!file) return;
      const result = await shareFile(file, whatsappMessage({ settings, checkIn: r.check_in, checkOut: r.check_out, guests: sheet.guests, vehicles: sheet.vehicles }));
      if (result === 'shared') {
        await store.markSent(r.id);
        setSentState('shared');
        toast('Autorización enviada');
      } else if (result === 'downloaded') {
        setSentState('downloaded');
        toast('Excel descargado. Adjúntalo en el chat de la administradora.');
      }
      await reload();
    } catch (e) {
      toast((e as Error).message || 'No se pudo generar la planilla.', 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    setBusy(true);
    try {
      const file = await buildFile();
      if (!file) return;
      downloadBlob(file, file.name);
      setSentState((s) => (s === 'shared' ? s : 'downloaded'));
      await reload();
      toast('Excel descargado');
    } catch (e) {
      toast((e as Error).message || 'No se pudo generar la planilla.', 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function onMarkSent() {
    try {
      await store.markSent(r.id);
      setSentState('shared');
      await reload();
      toast('Marcada como enviada');
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
  }

  const n = nightsBetween(r.check_in, r.check_out);
  const msg = whatsappMessage({ settings, checkIn: r.check_in, checkOut: r.check_out, guests: sheet.guests, vehicles: sheet.vehicles });

  return (
    <div className="page">
      <div className="row">
        <a className="icon-btn" href={href(`/reserva/${r.id}`)} aria-label="Volver a la estadía">
          <Icon name="arrowLeft" />
        </a>
        <div style={{ minWidth: 0 }}>
          <h1>Autorización</h1>
          <p className="muted small">
            {r.contact_name} · {stayDates(r)}
          </p>
        </div>
      </div>

      {r.status === 'tentativa' ? (
        <div className="notice notice-warn">
          <Icon name="info" />
          <span>Esta estadía está como tentativa. Confírmala antes de enviar la autorización.</span>
        </div>
      ) : null}

      {/* ---------------- Personas ---------------- */}
      <section className="section" aria-labelledby="h-personas">
        <div className="section-head">
          <h2 id="h-personas">Personas</h2>
          <span className="muted small">
            {people.length} de {MAX_GUESTS}
          </span>
        </div>

        <div className="segmented" role="radiogroup" aria-label="Cómo leer las cédulas">
          <label className="chip">
            <input type="radio" name="mode" checked={mode === 'local'} onChange={() => setMode('local')} />
            <span>
              <Icon name="camera" style={{ width: 18, height: 18 }} /> Leer en el teléfono
            </span>
          </label>
          <label className="chip" title={aiEnabled ? undefined : 'Requiere iniciar sesión y la API key configurada en Netlify'}>
            <input type="radio" name="mode" checked={mode === 'ia'} disabled={!aiEnabled} onChange={() => setMode('ia')} />
            <span>
              <Icon name="sparkle" style={{ width: 18, height: 18 }} /> Leer con IA
            </span>
          </label>
        </div>
        <p className="hint">
          {mode === 'ia'
            ? 'Más precisa. La foto se envía a la IA solo para leerla y no se guarda.'
            : 'Gratis y privada: la foto no sale del teléfono. Con fotos movidas o con reflejo puede fallar; revisa siempre.'}
          {!aiEnabled ? ' La lectura con IA se activa al configurar la API key en Netlify.' : ''}
        </p>

        <label
          className="dropzone"
          data-drag={drag}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={onDrop}
        >
          <Icon name="idcard" />
          <strong>Subir fotos de las cédulas</strong>
          <span className="small">Puedes elegir varias a la vez desde la galería o WhatsApp</span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple onChange={onFiles} disabled={!!reading || room <= 0} aria-label="Subir fotos de las cédulas" />
        </label>

        {reading ? (
          <div className="reading" role="status">
            <span className="spinner" /> {reading}
          </div>
        ) : null}

        <div className="row-wrap">
          <button className="btn btn-secondary btn-small" type="button" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}>
            <Icon name="clipboard" /> Pegar texto de WhatsApp
          </button>
          <button
            className="btn btn-secondary btn-small"
            type="button"
            disabled={room <= 0}
            onClick={() => setGuests((cur) => [...cur, { key: nextKey(), full_name: '', cedula: '', is_minor: false }])}
          >
            <Icon name="plus" /> Agregar persona
          </button>
        </div>

        {pasteOpen ? (
          <div className="panel panel-pad stack">
            <div className="field">
              <label htmlFor="paste">Pega aquí el mensaje con nombres y cédulas</label>
              <textarea
                id="paste"
                className="textarea"
                rows={6}
                maxLength={4000}
                placeholder={'1. Juan Pérez V-12.345.678\n2. María Gómez 23456789\n3. Sofía Pérez (niña)\nToyota Corolla vinotinto placa AA046KT'}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
            </div>
            <button className="btn btn-primary btn-small" type="button" onClick={applyPaste} disabled={!pasteText.trim()}>
              <Icon name="check" /> Leer el texto
            </button>
          </div>
        ) : null}

        {guests.length ? (
          <div className="panel" aria-label="Personas autorizadas">
            {guests.map((g, i) => (
              <GuestEditor key={g.key} g={g} index={i} onChange={(p) => updateGuest(g.key, p)} onRemove={() => removeGuest(g.key)} />
            ))}
          </div>
        ) : (
          <div className="panel empty">
            <p className="muted">
              Sube las fotos que te mandaron, pega el mensaje con los datos o agrégalos a mano. Para los niños sin cédula basta el nombre.
            </p>
          </div>
        )}
      </section>

      {/* ---------------- Vehículos ---------------- */}
      <section className="section" aria-labelledby="h-veh">
        <div className="section-head">
          <h2 id="h-veh">Vehículos</h2>
          <span className="muted small">
            {vehicles.length} de {MAX_VEHICLES}
          </span>
        </div>
        {vehicles.length ? (
          <div className="panel">
            {vehicles.map((v, i) => (
              <VehicleEditor key={v.key} v={v} index={i} onChange={(p) => updateVehicle(v.key, p)} onRemove={() => removeVehicle(v.key)} />
            ))}
          </div>
        ) : null}
        <div className="row-wrap">
          <button
            className="btn btn-secondary btn-small"
            type="button"
            disabled={vehicles.length >= MAX_VEHICLES}
            onClick={() => setVehicles((cur) => [...cur, { key: nextKey(), description: '', plate: '' }])}
          >
            <Icon name="car" /> Agregar vehículo
          </button>
          <label className={`btn btn-ghost btn-small ${vehicles.length >= MAX_VEHICLES ? 'is-disabled' : ''}`}>
            <Icon name="camera" /> Foto de la placa
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              className="visually-hidden"
              disabled={vehicles.length >= MAX_VEHICLES || !!reading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) readPlatePhoto(f);
              }}
            />
          </label>
        </div>
        {!vehicles.length ? <p className="hint">Si llegan sin carro, deja esta parte vacía.</p> : null}
      </section>

      {/* ---------------- Planilla ---------------- */}
      <section className="section" aria-labelledby="h-plan">
        <h2 id="h-plan">Planilla</h2>
        <div className="grid-2">
          <div className="field">
            <label htmlFor="tipo">Tipo de estadía</label>
            <select id="tipo" className="input" value={stayType} onChange={(e) => setStayType(e.target.value as StayType)}>
              {STAY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Fechas</span>
            <a className="input" href={href(`/reserva/${r.id}`)} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
              {formatDMY(r.check_in)} → {formatDMY(r.check_out)}
            </a>
          </div>
        </div>
        <div className="field">
          <label htmlFor="obs">Observaciones (opcional)</label>
          <input id="obs" className="input" maxLength={300} placeholder="Ej: llegan después de las 6 pm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <details className="panel panel-pad">
          <summary style={{ cursor: 'pointer', fontWeight: 650 }}>Ver cómo queda la planilla</summary>
          <SheetPreview sheet={sheet} nights={n} />
        </details>
      </section>

      {errors.length ? (
        <div id="errores" className="notice notice-bad" role="alert">
          <Icon name="alert" />
          <div className="stack" style={{ gap: 4 }}>
            <strong>Antes de enviar, corrige:</strong>
            {errors.map((e) => (
              <span key={e}>{e}</span>
            ))}
          </div>
        </div>
      ) : null}

      {sentState === 'downloaded' ? (
        <div className="notice notice-ok">
          <Icon name="download" />
          <div className="stack" style={{ gap: 10 }}>
            <span>El Excel quedó en Descargas. Adjúntalo en el chat de la administradora y luego márcala como enviada.</span>
            <div className="row-wrap">
              {settings.admin_whatsapp ? (
                <a className="btn btn-whatsapp btn-small" href={whatsappLink(settings.admin_whatsapp, msg)} target="_blank" rel="noopener noreferrer">
                  <Icon name="send" /> Abrir chat de la administradora
                </a>
              ) : (
                <a className="btn btn-secondary btn-small" href={href('/ajustes')}>
                  Guardar el WhatsApp de la administradora
                </a>
              )}
              <button className="btn btn-secondary btn-small" type="button" onClick={onMarkSent}>
                <Icon name="check" /> Ya la envié
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="actionbar">
        {sentState === 'shared' ? (
          <div className="notice notice-ok" style={{ padding: '8px 12px' }}>
            <Icon name="check" />
            <span>
              Enviada{r.auth_sent_at ? ` el ${formatLong(r.auth_sent_at.slice(0, 10))}` : ''}. Si cambió algo, vuelve a enviarla.
            </span>
          </div>
        ) : null}
        <button className="btn btn-whatsapp btn-block" type="button" onClick={onSend} disabled={busy || !!reading || !people.length}>
          {busy ? <span className="spinner" /> : <Icon name="send" />} Enviar a la administradora
        </button>
        <button className="btn btn-ghost btn-block btn-small" type="button" onClick={onDownload} disabled={busy || !!reading || !people.length}>
          <Icon name="download" /> Solo descargar el Excel
        </button>
      </div>
    </div>
  );
}

function GuestEditor({ g, index, onChange, onRemove }: { g: GuestRow; index: number; onChange: (p: Partial<GuestRow>) => void; onRemove: () => void }) {
  const idName = `g-${g.key}-name`;
  const idCed = `g-${g.key}-ced`;
  const cedBad = !!g.cedula.trim() && !isValidCedula(g.cedula);
  return (
    <div className="person">
      <span className="person-num" aria-hidden="true">
        {index + 1}
      </span>
      <div className="person-fields">
        <div className="field">
          <label htmlFor={idName} className="visually-hidden">
            Nombre completo de la persona {index + 1}
          </label>
          <input
            id={idName}
            className="input"
            placeholder="Nombres y apellidos"
            autoComplete="off"
            autoCapitalize="words"
            maxLength={120}
            value={g.full_name}
            onChange={(e) => onChange({ full_name: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={idCed} className="visually-hidden">
            Cédula de la persona {index + 1}
          </label>
          <input
            id={idCed}
            className="input"
            placeholder={g.is_minor ? 'Menor sin cédula' : 'Cédula'}
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            disabled={g.is_minor && !g.cedula}
            aria-invalid={cedBad}
            value={g.cedula}
            onChange={(e) => onChange({ cedula: e.target.value })}
            onBlur={() => g.cedula.trim() && isValidCedula(g.cedula) && onChange({ cedula: formatCedula(g.cedula) })}
          />
        </div>
      </div>
      <button className="icon-btn remove" type="button" onClick={onRemove} aria-label={`Quitar a la persona ${index + 1}`}>
        <Icon name="x" />
      </button>
      <div className="person-meta">
        <label className="check">
          <input type="checkbox" checked={g.is_minor} onChange={(e) => onChange({ is_minor: e.target.checked, cedula: e.target.checked ? '' : g.cedula })} />
          Menor sin cédula
        </label>
        {g.thumb ? <img className="thumb" src={g.thumb} alt="Foto leída" /> : null}
        {g.review ? <span className="badge badge-warn">Revisa lo leído</span> : null}
        {cedBad ? <span className="badge badge-bad">Cédula incompleta</span> : null}
      </div>
    </div>
  );
}

function VehicleEditor({ v, index, onChange, onRemove }: { v: VehicleRow; index: number; onChange: (p: Partial<VehicleRow>) => void; onRemove: () => void }) {
  const plateBad = !!v.plate.trim() && !isValidPlate(v.plate);
  return (
    <div className="person">
      <span className="person-num" aria-hidden="true">
        <Icon name="car" style={{ width: 22, height: 22 }} />
      </span>
      <div className="person-fields">
        <div className="field">
          <label htmlFor={`v-${v.key}-d`} className="visually-hidden">
            Modelo y color del vehículo {index + 1}
          </label>
          <input
            id={`v-${v.key}-d`}
            className="input"
            placeholder="Modelo y color · Ej: Toyota Corolla vinotinto"
            autoComplete="off"
            maxLength={80}
            value={v.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
        <div className="field">
          <label htmlFor={`v-${v.key}-p`} className="visually-hidden">
            Placa del vehículo {index + 1}
          </label>
          <input
            id={`v-${v.key}-p`}
            className="input input-upper"
            placeholder="Placa"
            autoComplete="off"
            autoCapitalize="characters"
            maxLength={10}
            aria-invalid={plateBad}
            value={v.plate}
            onChange={(e) => onChange({ plate: e.target.value.toUpperCase() })}
          />
        </div>
      </div>
      <button className="icon-btn remove" type="button" onClick={onRemove} aria-label={`Quitar el vehículo ${index + 1}`}>
        <Icon name="x" />
      </button>
      {v.thumb || v.review || plateBad ? (
        <div className="person-meta">
          {v.thumb ? <img className="thumb" src={v.thumb} alt="Foto de la placa" /> : null}
          {v.review ? <span className="badge badge-warn">Revisa y agrega modelo y color</span> : null}
          {plateBad ? <span className="badge badge-bad">Placa inválida</span> : null}
        </div>
      ) : null}
    </div>
  );
}

function SheetPreview({ sheet, nights }: { sheet: AuthorizationSheet; nights: number }) {
  const s = sheet.settings;
  const rows = Array.from({ length: MAX_GUESTS }, (_, i) => sheet.guests[i]);
  const cars = Array.from({ length: MAX_VEHICLES }, (_, i) => sheet.vehicles[i]);
  return (
    <div className="sheet" style={{ marginTop: 12 }} aria-label="Vista previa de la planilla">
      <div className="spread">
        <span className="sheet-title">{s.conjunto}</span>
        <span>Fecha: {formatDMY(sheet.emitted)}</span>
      </div>
      <div className="sheet-title">Autorización</div>
      <div className="spread">
        <span>
          Yo {s.owner_name} CI: {formatCedula(s.owner_cedula)}
        </span>
        <span>Inmueble N°{s.unit}</span>
      </div>
      <p className="sheet-line">Por medio de la presente autorizo suficientemente a:</p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 28 }} />
            <th>Nombres y Apellidos</th>
            <th>Cédulas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{g?.full_name ?? ''}</td>
              <td>{g ? (g.is_minor && !g.cedula ? 'Menor de edad' : formatCedula(g.cedula)) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sheet-line" style={{ textAlign: 'center', fontWeight: 700 }}>
        Vehículos
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: 28 }} />
            <th>Tipo</th>
            <th>Placas</th>
          </tr>
        </thead>
        <tbody>
          {cars.map((v, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td>{v?.description ?? ''}</td>
              <td>{v?.plate ?? ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="sheet-line">
        {SHEET_ORDER.map((t) => `${t} ${t === sheet.stayType ? '[x]' : '[ ]'}`).join('   ')}
      </p>
      <p className="sheet-line">
        Fecha Ingreso: {formatDMY(sheet.checkIn)} · Fecha Egreso: {formatDMY(sheet.checkOut)} ({nights} {nights === 1 ? 'noche' : 'noches'})
      </p>
      {sheet.notes ? <p className="sheet-line">Observaciones: {sheet.notes}</p> : null}
    </div>
  );
}
