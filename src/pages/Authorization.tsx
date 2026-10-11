import { useEffect, useMemo, useState, type ChangeEvent, type CSSProperties, type DragEvent } from 'react';
import { useApp } from '../context';
import type { Guest, Reservation, StayType, Vehicle } from '../lib/types';
import { MAX_GUESTS, MAX_VEHICLES, STAY_TYPES, propertyLabel } from '../lib/types';
import { addDays, compareISO, formatDMY, formatDayMonth, formatLong, isValidISO, nightsBetween, todayISO } from '../lib/dates';
import { formatCedula, isValidCedula, isValidPlate, normalizePlate, parseGuestText } from '../lib/cedula';
import { checkImageFile, thumbnail } from '../lib/image';
import { readCedulasLocal, readPlateLocal, warmUpOcr } from '../lib/ocr';
import { readCedulaAI } from '../lib/ai';
import { conflictsFor } from '../lib/availability';
import { settingsFor } from '../lib/store/types';
import { authorizationFileName, buildAuthorizationXlsx, validateSheet, type AuthorizationSheet } from '../lib/excel';
import { whatsappMessage } from '../lib/message';
import { XLSX_TYPE, downloadBlob, shareFile, whatsappLink } from '../lib/share';
import { go, href } from '../router';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { StayRow, stayDates } from '../components/StayRow';
import { BottomSheet } from '../components/BottomSheet';
import { PropertyChips } from '../components/PropertyChips';
import { defaultStayName } from './ReservationForm';
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

/** "Juan Pérez y 3 más" a partir de las personas cargadas. */
export function groupName(guests: Guest[]): string {
  const named = guests.filter((g) => g.full_name.trim());
  if (!named.length) return '';
  const first = named.find((g) => !g.is_minor) ?? named[0];
  return named.length > 1 ? `${first.full_name.trim()} y ${named.length - 1} más` : first.full_name.trim();
}

/* ------------------------------------------------------------------ */
/* Nueva autorización: fechas + cédulas, sin formularios previos       */
/* ------------------------------------------------------------------ */

export function NewAuthorizationPage({ query }: { query: URLSearchParams }) {
  const qApto = query.get('apto');
  return <AuthorizationEditor r={null} initialProperty={qApto ?? undefined} />;
}

export function AuthorizationPage({ id }: { id: string }) {
  const { data } = useApp();
  const r = data.reservations.find((x) => x.id === id);
  if (!r) {
    return (
      <div className="page">
        <h1>No encontramos esa estadía</h1>
        <a className="btn btn-secondary" href={href('/autorizacion')}>
          Nueva autorización
        </a>
      </div>
    );
  }
  return <AuthorizationEditor key={r.id} r={r} />;
}

type ReadMode = 'local' | 'ia';

function AuthorizationEditor({ r, initialProperty }: { r: Reservation | null; initialProperty?: string }) {
  const { data, store, reload, aiEnabled, getAccessToken, today, ownId } = useApp();
  const toast = useToast();

  // estadía (solo editable cuando es nueva)
  const [checkIn, setCheckIn] = useState(r?.check_in ?? addDays(today, 1));
  const [checkOut, setCheckOut] = useState(r?.check_out ?? addDays(today, 2));
  const [propertyId, setPropertyId] = useState(
    r?.property_id ?? (initialProperty && data.properties.some((p) => p.id === initialProperty) ? initialProperty : ownId),
  );
  const [pickOpen, setPickOpen] = useState(false);

  const [guests, setGuests] = useState<GuestRow[]>(() => (r?.guests ?? []).map((g) => ({ ...g, key: nextKey() })));
  const [vehicles, setVehicles] = useState<VehicleRow[]>(() => (r?.vehicles ?? []).map((v) => ({ ...v, key: nextKey() })));
  const [stayType, setStayType] = useState<StayType>(r?.stay_type ?? 'Alquiler Vacacional');
  const [notes, setNotes] = useState('');
  const [mode, setMode] = useState<ReadMode>(aiEnabled ? 'ia' : 'local');
  const [reading, setReading] = useState<string | null>(null);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [sentState, setSentState] = useState<'idle' | 'downloaded' | 'shared'>(r?.auth_status === 'enviada' ? 'shared' : 'idle');
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (mode === 'local') warmUpOcr();
  }, [mode]);

  const property = data.properties.find((p) => p.id === propertyId);
  const settings = settingsFor(data.settings, property);
  const people = guests.filter((g) => g.full_name.trim() || g.cedula.trim());
  const room = MAX_GUESTS - guests.length;
  const nights = isValidISO(checkIn) && isValidISO(checkOut) ? nightsBetween(checkIn, checkOut) : 0;

  // Si ya hay una estadía registrada en esas fechas, se ofrece usarla en vez de crear otra.
  const sameDates = useMemo(
    () =>
      r || nights < 1
        ? []
        : conflictsFor({ id: '__new', property_id: propertyId, check_in: checkIn, check_out: checkOut, status: 'confirmada' }, data.reservations),
    [r, nights, propertyId, checkIn, checkOut, data.reservations],
  );
  const pendingStays = data.reservations
    .filter((x) => x.status !== 'cancelada' && x.check_out >= today && x.auth_status !== 'enviada')
    .sort((a, b) => compareISO(a.check_in, b.check_in));

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
      return merged;
    });
  }

  const updateGuest = (key: number, patch: Partial<GuestRow>) => setGuests((cur) => cur.map((g) => (g.key === key ? { ...g, ...patch, review: false } : g)));
  const removeGuest = (key: number) => setGuests((cur) => cur.filter((g) => g.key !== key));
  const updateVehicle = (key: number, patch: Partial<VehicleRow>) => setVehicles((cur) => cur.map((v) => (v.key === key ? { ...v, ...patch, review: false } : v)));
  const removeVehicle = (key: number) => setVehicles((cur) => cur.filter((v) => v.key !== key));

  async function readPhotos(files: File[]) {
    const ok: File[] = [];
    for (const f of files) {
      const problem = checkImageFile(f);
      if (problem) toast(problem, 'bad');
      else ok.push(f);
    }
    if (!ok.length) return;
    if (room <= 0) return toast(`La planilla admite ${MAX_GUESTS} personas.`, 'bad');
    let total = 0;
    for (let i = 0; i < ok.length; i++) {
      const file = ok[i];
      setReading(`Leyendo foto ${i + 1} de ${ok.length}${mode === 'ia' ? ' con IA' : ''}…`);
      const thumb = await thumbnail(file).catch(() => undefined);
      try {
        let found: { full_name: string; cedula: string }[];
        if (mode === 'ia') {
          const token = await getAccessToken();
          if (!token) throw new Error('Inicia sesión para usar la lectura con IA.');
          found = await readCedulaAI(file, token);
        } else {
          found = await readCedulasLocal(file, (msg) => setReading(msg));
        }
        total += found.length;
        addGuests(found.length ? found.map((g) => ({ ...g, is_minor: false, thumb, review: true })) : [{ full_name: '', cedula: '', thumb, review: true }]);
      } catch (e) {
        toast((e as Error).message || 'No se pudo leer la foto. Escribe los datos.', 'bad');
        addGuests([{ full_name: '', cedula: '', thumb, review: true }]);
      }
    }
    setReading(null);
    if (total > ok.length) toast(`Encontré ${total} cédulas en ${ok.length === 1 ? 'la foto' : `${ok.length} fotos`}. Revísalas.`);
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
    checkIn,
    checkOut,
    notes,
  };

  /** Crea la estadía si es nueva y guarda personas y vehículos. Devuelve el id. */
  async function persist(): Promise<string> {
    let id = r?.id;
    if (!id) {
      id = await store.saveReservation({
        property_id: propertyId,
        contact_name: groupName(sheet.guests) || defaultStayName(checkIn),
        contact_phone: '',
        channel: 'whatsapp',
        check_in: checkIn,
        check_out: checkOut,
        stay_type: stayType,
        status: 'confirmada',
        total_usd: 0,
        paid_usd: 0,
        notes: '',
      });
    } else if (stayType !== r!.stay_type) {
      await store.saveReservation({ ...r!, stay_type: stayType });
    }
    await store.saveAuthorization(id, sheet.guests, sheet.vehicles);
    return id;
  }

  async function buildFile(): Promise<{ file: File; id: string } | null> {
    const errs = validateSheet(sheet);
    sheet.guests.forEach((g) => {
      if (g.cedula && !isValidCedula(g.cedula)) errs.push(`La cédula de ${g.full_name || 'una persona'} no parece válida (${g.cedula}).`);
      if (!g.full_name) errs.push(`Falta el nombre de quien tiene la cédula ${g.cedula}.`);
    });
    sheet.vehicles.forEach((v, i) => {
      if (!isValidPlate(v.plate)) errs.push(`Revisa la placa del vehículo ${i + 1}.`);
      if (v.description.length < 2) errs.push(`Escribe modelo y color del vehículo ${i + 1}.`);
    });
    if (!r && sameDates.some((c) => c.status === 'confirmada'))
      errs.push('Ya hay una estadía confirmada en esas fechas. Usa esa estadía (botón de arriba) o cambia las fechas.');
    setErrors(errs);
    if (errs.length) {
      requestAnimationFrame(() => document.getElementById('errores')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
      return null;
    }
    const id = await persist();
    const template = await fetch(templateUrl).then((res) => {
      if (!res.ok) throw new Error('No se pudo cargar la planilla.');
      return res.arrayBuffer();
    });
    const buf = await buildAuthorizationXlsx(template, sheet);
    return { file: new File([buf], authorizationFileName(sheet), { type: XLSX_TYPE }), id };
  }

  const msg = whatsappMessage({ settings, checkIn, checkOut, guests: sheet.guests, vehicles: sheet.vehicles });

  async function finish(id: string) {
    await reload();
    if (!r) go(`/autorizacion/${id}`, { replace: true });
  }

  async function onSend() {
    setBusy(true);
    try {
      const built = await buildFile();
      if (!built) return;
      const result = await shareFile(built.file, msg);
      if (result === 'shared') {
        await store.markSent(built.id);
        setSentState('shared');
        toast('Autorización enviada');
      } else if (result === 'downloaded') {
        setSentState('downloaded');
        toast('Excel descargado. Adjúntalo en el chat de la administradora.');
      }
      await finish(built.id);
    } catch (e) {
      toast((e as Error).message || 'No se pudo generar la planilla.', 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function onDownload() {
    setBusy(true);
    try {
      const built = await buildFile();
      if (!built) return;
      downloadBlob(built.file, built.file.name);
      setSentState((s) => (s === 'shared' ? s : 'downloaded'));
      toast('Excel descargado');
      await finish(built.id);
    } catch (e) {
      toast((e as Error).message || 'No se pudo generar la planilla.', 'bad');
    } finally {
      setBusy(false);
    }
  }

  async function onMarkSent() {
    if (!r) return;
    try {
      await store.markSent(r.id);
      setSentState('shared');
      await reload();
      toast('Marcada como enviada');
    } catch (e) {
      toast((e as Error).message, 'bad');
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <a className="icon-btn" href={href(r ? `/reserva/${r.id}` : '/')} aria-label="Volver">
          <Icon name="arrowLeft" />
        </a>
        <div className="grow">
          <h1>{r ? 'Autorización' : 'Nueva autorización'}</h1>
          {r ? (
            <div className="sub">
              {r.contact_name} · {stayDates(r)}
              {property && property.id !== ownId ? ` · ${propertyLabel(property)}` : ''}
            </div>
          ) : null}
        </div>
      </div>

      {r?.status === 'tentativa' ? (
        <div className="notice notice-warn">
          <Icon name="info" />
          <span>Esta estadía está como tentativa. Confírmala antes de enviar la autorización.</span>
        </div>
      ) : null}

      {/* ---------------- ¿Cuándo llegan? (solo si es nueva) ---------------- */}
      {!r ? (
        <section className="section" aria-labelledby="h-cuando">
          <div className="section-head">
            <h2 id="h-cuando">¿Cuándo llegan?</h2>
            {pendingStays.length ? (
              <button className="btn btn-ghost btn-small" type="button" onClick={() => setPickOpen(true)}>
                Ya la registré
              </button>
            ) : null}
          </div>
          <div className="date-pair">
            <div className="field">
              <label htmlFor="a-in">Entrada</label>
              <input id="a-in" className="input" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <span className="arrow" aria-hidden="true">
              <Icon name="arrowLeft" />
            </span>
            <div className="field">
              <label htmlFor="a-out">Salida</label>
              <input id="a-out" className="input" type="date" min={checkIn} value={checkOut} aria-invalid={nights < 1} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>
          <p className="hint">
            {nights >= 1 ? `${nights} ${nights === 1 ? 'noche' : 'noches'} · ${formatLong(checkIn)}` : 'La salida debe ser después de la entrada.'}
          </p>
          <PropertyChips properties={data.properties} value={propertyId} onChange={setPropertyId} name="auth-apto" />
          {sameDates.length ? (
            <div className="notice notice-warn">
              <Icon name="info" />
              <div className="stack" style={{ gap: 8 }}>
                <span>
                  Ya hay {sameDates.length === 1 ? 'una estadía' : 'estadías'} en esas fechas: <strong>{sameDates.map((c) => c.contact_name).join(', ')}</strong>.
                </span>
                <div className="row-wrap">
                  {sameDates.map((c) => (
                    <a key={c.id} className="btn btn-secondary btn-small" href={href(`/autorizacion/${c.id}`)}>
                      Usar {c.contact_name.split(' ')[0]}
                    </a>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ---------------- Personas ---------------- */}
      <section className="section" aria-labelledby="h-personas">
        <div className="section-head">
          <h2 id="h-personas">Personas</h2>
          <span className="badge badge-brand num">
            {people.length} / {MAX_GUESTS}
          </span>
        </div>

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
          <span className="dz-icon">
            <Icon name="camera" />
          </span>
          <strong>Subir fotos de las cédulas</strong>
          <span className="small">Varias a la vez, o dos cédulas en una misma foto</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            multiple
            onChange={onFiles}
            disabled={!!reading || room <= 0}
            aria-label="Subir fotos de las cédulas"
          />
        </label>

        <div className="segmented" role="radiogroup" aria-label="Cómo leer las cédulas">
          <label className="chip">
            <input type="radio" name="mode" checked={mode === 'local'} onChange={() => setMode('local')} />
            <span>Leer en el teléfono</span>
          </label>
          <label className="chip" title={aiEnabled ? undefined : 'Requiere iniciar sesión y la API key configurada en Netlify'}>
            <input type="radio" name="mode" checked={mode === 'ia'} disabled={!aiEnabled} onChange={() => setMode('ia')} />
            <span>
              <Icon name="sparkle" style={{ width: 17, height: 17 }} /> Con IA
            </span>
          </label>
        </div>
        <p className="hint">
          {mode === 'ia' ? 'Más precisa. La foto se envía a la IA solo para leerla y no se guarda.' : 'Gratis y privada: la foto no sale del teléfono. Revisa siempre lo leído.'}
        </p>

        {reading ? (
          <div className="reading" role="status">
            <span className="spinner" /> {reading}
          </div>
        ) : null}

        <div className="row-wrap">
          <button className="btn btn-soft btn-small" type="button" onClick={() => setPasteOpen((o) => !o)} aria-expanded={pasteOpen}>
            <Icon name="clipboard" /> Pegar texto de WhatsApp
          </button>
          <button
            className="btn btn-soft btn-small"
            type="button"
            disabled={room <= 0}
            onClick={() => setGuests((cur) => [...cur, { key: nextKey(), full_name: '', cedula: '', is_minor: false }])}
          >
            <Icon name="plus" /> Agregar a mano
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
        ) : null}
      </section>

      {/* ---------------- Vehículos ---------------- */}
      <section className="section" aria-labelledby="h-veh">
        <div className="section-head">
          <h2 id="h-veh">Vehículos</h2>
          <span className="badge num">
            {vehicles.length} / {MAX_VEHICLES}
          </span>
        </div>
        {vehicles.length ? (
          <div className="panel">
            {vehicles.map((v, i) => (
              <VehicleEditor key={v.key} v={v} index={i} onChange={(p) => updateVehicle(v.key, p)} onRemove={() => removeVehicle(v.key)} />
            ))}
          </div>
        ) : (
          <p className="hint">Si llegan sin carro, deja esta parte vacía.</p>
        )}
        <div className="row-wrap">
          <button
            className="btn btn-soft btn-small"
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
      </section>

      {/* ---------------- Planilla ---------------- */}
      <details className="disclosure">
        <summary>
          <Icon name="file" style={{ width: 20, height: 20, color: 'var(--brand)' }} />
          Planilla: {stayType}
          <Icon name="chevronRight" className="chev" />
        </summary>
        <div className="disclosure-body">
          <div className="field">
            <label htmlFor="tipo">Tipo de estadía</label>
            <select id="tipo" className="input" value={stayType} onChange={(e) => setStayType(e.target.value as StayType)}>
              {STAY_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="obs">Observaciones (opcional)</label>
            <input id="obs" className="input" maxLength={300} placeholder="Ej: llegan después de las 6 pm" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <SheetPreview sheet={sheet} nights={nights} />
        </div>
      </details>

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
              {data.settings.admin_whatsapp ? (
                <a className="btn btn-whatsapp btn-small" href={whatsappLink(data.settings.admin_whatsapp, msg)} target="_blank" rel="noopener noreferrer">
                  <Icon name="send" /> Abrir chat
                </a>
              ) : (
                <a className="btn btn-secondary btn-small" href={href('/ajustes')}>
                  Guardar el WhatsApp de la administradora
                </a>
              )}
              {r ? (
                <button className="btn btn-secondary btn-small" type="button" onClick={onMarkSent}>
                  <Icon name="check" /> Ya la envié
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {people.length || r ? (
      <div className="actionbar">
        {sentState === 'shared' && r?.auth_sent_at ? (
          <p className="tiny muted" style={{ textAlign: 'center' }}>
            Enviada el {formatDayMonth(r.auth_sent_at.slice(0, 10))}. Si cambió algo, vuelve a enviarla.
          </p>
        ) : null}
        <button className="btn btn-whatsapp btn-block" type="button" onClick={onSend} disabled={busy || !!reading || !people.length || nights < 1}>
          {busy ? <span className="spinner" /> : <Icon name="send" />} Enviar a la administradora
        </button>
        <button className="btn btn-ghost btn-block btn-small" type="button" onClick={onDownload} disabled={busy || !!reading || !people.length || nights < 1}>
          <Icon name="download" /> Solo descargar el Excel
        </button>
      </div>
      ) : null}

      <BottomSheet open={pickOpen} onClose={() => setPickOpen(false)} label="Elegir estadía registrada">
        <h2>¿Para cuál estadía?</h2>
        <div className="panel list">
          {pendingStays.map((x, i) => {
            const p = data.properties.find((pp) => pp.id === x.property_id);
            return (
              <div key={x.id} style={{ '--i': i } as CSSProperties} onClick={() => setPickOpen(false)}>
                <StayRow r={x} to={`/autorizacion/${x.id}`} place={p && p.id !== ownId ? propertyLabel(p) : undefined} />
              </div>
            );
          })}
        </div>
      </BottomSheet>
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
      <button className="icon-btn flat remove" type="button" onClick={onRemove} aria-label={`Quitar a la persona ${index + 1}`}>
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
        <Icon name="car" style={{ width: 17, height: 17 }} />
      </span>
      <div className="person-fields">
        <div className="field">
          <label htmlFor={`v-${v.key}-d`} className="visually-hidden">
            Modelo y color del vehículo {index + 1}
          </label>
          <input
            id={`v-${v.key}-d`}
            className="input"
            placeholder="Modelo y color · Ej: Corolla vinotinto"
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
      <button className="icon-btn flat remove" type="button" onClick={onRemove} aria-label={`Quitar el vehículo ${index + 1}`}>
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
    <div className="sheet" aria-label="Vista previa de la planilla">
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
      <p className="sheet-line">{SHEET_ORDER.map((t) => `${t} ${t === sheet.stayType ? '[x]' : '[ ]'}`).join('   ')}</p>
      <p className="sheet-line">
        Fecha Ingreso: {formatDMY(sheet.checkIn)} · Fecha Egreso: {formatDMY(sheet.checkOut)} ({nights} {nights === 1 ? 'noche' : 'noches'})
      </p>
      {sheet.notes ? <p className="sheet-line">Observaciones: {sheet.notes}</p> : null}
    </div>
  );
}
