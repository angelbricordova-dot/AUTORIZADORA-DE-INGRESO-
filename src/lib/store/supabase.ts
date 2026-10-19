// Modo real: Supabase con RLS. Solo se usa la llave pública (anon); la seguridad la ponen las políticas.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { PublicReview, Review, BusyRange, CashMovement, Payment, Property, PropertyInput, PublicData, PublicListing, Reservation, StaffStay, StayOps, TeamMember } from '../types';
import { cleanText } from '../sanitize';
import { formatCedula } from '../cedula';
import { cleanSupabaseKey, cleanSupabaseUrl } from '../supabaseConfig';
import type { AppData, DataStore } from './types';
import { DEFAULT_SETTINGS, OWN_DEFAULTS, friendlyError, nameFromEmail, type Me } from './types';
import { sanitizeReview, sanitizeCash, sanitizeGuests, sanitizeOpsPatch, sanitizePayment, sanitizePaymentPatch, sanitizeProperty, sanitizeReservation, sanitizeVehicles } from './validate';
import { addDays } from '../dates';
import { notifyNewStay } from '../../push';

const url = cleanSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const anon = cleanSupabaseKey(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export const supabaseConfigured = !!(url && anon);
/** Proyecto al que apunta la app (es público; sirve para verificar la configuración). */
export const supabaseHost = url ? new URL(url).host : '';

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured) throw new Error('Supabase no está configurado');
  client ??= createClient(url!, anon!, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, flowType: 'pkce' },
  });
  return client;
}

// Punto 17: pedir solo las columnas necesarias, nunca select('*')
const RES_COLUMNS =
  'id, property_id, contact_name, contact_phone, channel, check_in, check_out, stay_type, status, total_usd, paid_usd, auth_status, auth_sent_at, notes, ' +
  'guests(position, full_name, cedula, is_minor), vehicles(position, description, plate)';

type Row = Omit<Reservation, 'guests' | 'vehicles' | 'total_usd' | 'paid_usd'> & {
  total_usd: number | string;
  paid_usd: number | string;
  guests: { position: number; full_name: string; cedula: string | null; is_minor: boolean }[];
  vehicles: { position: number; description: string; plate: string }[];
};

function mapRow(r: Row): Reservation {
  return {
    ...r,
    total_usd: Number(r.total_usd) || 0,
    paid_usd: Number(r.paid_usd) || 0,
    notes: r.notes ?? '',
    contact_phone: r.contact_phone ?? '',
    guests: [...(r.guests ?? [])].sort((a, b) => a.position - b.position).map((g) => ({ full_name: g.full_name, cedula: g.cedula ?? '', is_minor: g.is_minor })),
    vehicles: [...(r.vehicles ?? [])].sort((a, b) => a.position - b.position).map((v) => ({ description: v.description, plate: v.plate })),
  };
}

const PROP_COLUMNS_V2 =
  'id, kind, name, title, conjunto, unit, summary, description, capacity, bedrooms, nightly_usd, partner_cost_usd, promo, amenities, photos, published, sort, owner_name, owner_cedula, contact_whatsapp, airbnb_url, instagram_url';
const PROP_COLUMNS_V3 = `${PROP_COLUMNS_V2}, beds, bathrooms`;
const PROP_COLUMNS_V4 = `${PROP_COLUMNS_V3}, tiktok_url`;
const PROP_COLUMNS = `${PROP_COLUMNS_V4}, google_review_url`;

type PropRow = Omit<Property, 'nightly_usd' | 'partner_cost_usd' | 'beds' | 'bathrooms' | 'tiktok_url' | 'google_review_url'> & {
  tiktok_url?: string | null;
  google_review_url?: string | null;
  nightly_usd: number | string | null;
  partner_cost_usd: number | string | null;
  beds?: number | null;
  bathrooms?: number | null;
};

function mapProp(r: PropRow): Property {
  const num = (v: number | string | null) => (v == null ? null : Number(v));
  return {
    ...r,
    nightly_usd: num(r.nightly_usd),
    partner_cost_usd: num(r.partner_cost_usd),
    amenities: r.amenities ?? [],
    photos: r.photos ?? [],
    beds: r.beds ?? null,
    bathrooms: r.bathrooms ?? null,
    tiktok_url: r.tiktok_url ?? '',
    google_review_url: r.google_review_url ?? '',
  };
}

/** Columna o tabla que todavía no existe: falta ejecutar la última migración. */
const missingSchema = (e: { code?: string } | null) => !!e && ['42703', '42P01', 'PGRST204', 'PGRST205', 'PGRST202'].includes(e.code ?? '');
let schemaV3: boolean | null = null;
/** ¿Ya existe la columna de TikTok (migración 20261015000000_tiktok.sql)? */
let schemaTiktok: boolean | null = null;
/** ¿Ya existe la columna del enlace de Google (migración de reseñas)? */
let schemaGoogle: boolean | null = null;

function propFields(p: PropertyInput): Record<string, unknown> {
  const { id: _id, ...rest } = p;
  if (schemaV3 === false) {
    const { beds: _b, bathrooms: _ba, tiktok_url: _t, ...v2 } = rest;
    return v2;
  }
  if (schemaTiktok === false) {
    const { tiktok_url: _t, google_review_url: _g, ...v3 } = rest;
    return v3;
  }
  if (schemaGoogle === false) {
    const { google_review_url: _g, ...v4 } = rest;
    return v4;
  }
  return rest;
}

async function loadProperties(sb: SupabaseClient): Promise<Property[]> {
  const select = (cols: string) => sb.from('properties').select(cols).order('sort').order('created_at');
  let res = await select(PROP_COLUMNS);
  if (!res.error) {
    schemaV3 = true;
    schemaTiktok = true;
    schemaGoogle = true;
  } else if (missingSchema(res.error) && !(res = await select(PROP_COLUMNS_V4)).error) {
    schemaV3 = true;
    schemaTiktok = true;
    schemaGoogle = false;
  } else if (missingSchema(res.error)) {
    schemaGoogle = false;
    schemaTiktok = false;
    res = await select(PROP_COLUMNS_V3);
    if (!res.error) schemaV3 = true;
    else if (missingSchema(res.error)) {
      schemaV3 = false;
      res = await select(PROP_COLUMNS_V2);
    }
  }
  if (res.error) throw friendlyError(res.error);
  let list = ((res.data ?? []) as unknown as PropRow[]).map(mapProp);
  if (!list.some((p) => p.kind === 'propio')) {
    const { data: created, error: e2 } = await sb
      .from('properties')
      .insert(propFields(sanitizeProperty(OWN_DEFAULTS)))
      .select(schemaV3 === false ? PROP_COLUMNS_V2 : schemaTiktok === false ? PROP_COLUMNS_V3 : schemaGoogle === false ? PROP_COLUMNS_V4 : PROP_COLUMNS)
      .single();
    if (e2) throw friendlyError(e2);
    list = [mapProp(created as unknown as PropRow), ...list];
  }
  return list;
}

const num = (v: unknown) => Number(v) || 0;

/**
 * Panel al que pertenece quien entró: el suyo, o el de la dueña si es administradora.
 * Sin la migración de varias administradoras, es siempre el propio.
 */
async function ownerId(sb: SupabaseClient): Promise<string> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) throw new Error('Tu sesión venció. Vuelve a entrar.');
  const { data, error } = await sb.rpc('acting_owner');
  return !error && typeof data === 'string' ? data : auth.user.id;
}
const PAY_COLUMNS = 'id, reservation_id, amount_usd, method, received_by, paid_on, reference, note, created_at';
const OPS_COLUMNS =
  'reservation_id, clean_before_at, keys_at, clean_after_at, linens_at, deposit_usd, deposit_received_at, deposit_returned_at, deposit_returned_usd, note';
/** Las políticas no dejan tocar ese movimiento (0 filas): es de otra persona o de hace más de un día. */
const CANT_FIX = 'No se pudo corregir: solo puedes cambiar lo que anotaste tú en las últimas 24 horas. Pídele a quien administra el panel que lo corrija.';
const CASH_COLUMNS = 'id, kind, amount_usd, happened_on, note, created_at';

const mapPayment = (p: Payment): Payment => ({ ...p, amount_usd: num(p.amount_usd), reference: p.reference ?? '', note: p.note ?? '' });
const mapOps = (o: StayOps): StayOps => ({
  ...o,
  deposit_usd: num(o.deposit_usd),
  deposit_returned_usd: o.deposit_returned_usd == null ? null : num(o.deposit_returned_usd),
  note: o.note ?? '',
});
const mapCash = (m: CashMovement): CashMovement => ({ ...m, amount_usd: num(m.amount_usd), note: m.note ?? '' });

const REVIEW_COLUMNS =
  'id, property_id, author_name, nights, cleanliness, beds, ac, wifi, communication, kitchen_ok, kitchen_missing, recommend, liked, improve, permission, status, reply, created_at';
const REVIEW_COLUMNS_V8 = `${REVIEW_COLUMNS}, comment`;
const nOrNull = (v: unknown) => (v == null ? null : Number(v));
const mapReview = (r: Record<string, unknown>): Review =>
  ({
    ...r,
    nights: nOrNull(r.nights),
    cleanliness: nOrNull(r.cleanliness),
    beds: nOrNull(r.beds),
    ac: nOrNull(r.ac),
    wifi: nOrNull(r.wifi),
    communication: nOrNull(r.communication),
    recommend: nOrNull(r.recommend),
    // sin la migración del comentario, lo publicado era "lo que más le gustó"
    comment: typeof r.comment === 'string' ? r.comment : typeof r.liked === 'string' ? r.liked : '',
  }) as Review;

/** Quién entró: su nombre guardado, el que le dieron en Accesos o el de su correo. */
async function loadMe(sb: SupabaseClient): Promise<Me | undefined> {
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return undefined;
  const email = auth.user.email ?? '';
  const meta = cleanText((auth.user.user_metadata as { display_name?: unknown } | null)?.display_name, 40);
  const ws = await sb.rpc('my_workspace').maybeSingle();
  const w = (ws.error ? null : ws.data) as { role?: string; name?: string } | null;
  const role = w?.role === 'admin' || w?.role === 'staff' ? w.role : 'owner';
  return { email, role, name: meta || cleanText(w?.name, 40) || nameFromEmail(email) };
}

/** Pagos, tareas y caja. Si la migración de equipo no se ejecutó, devuelve listas vacías. */
async function loadOps(sb: SupabaseClient) {
  const [p, o, c] = await Promise.all([
    sb.from('payments').select(PAY_COLUMNS).order('paid_on'),
    sb.from('stay_ops').select(OPS_COLUMNS),
    sb.from('cash_movements').select(CASH_COLUMNS).order('happened_on'),
  ]);
  if (missingSchema(p.error) || missingSchema(o.error) || missingSchema(c.error)) return { payments: [], ops: [], cash: [], pending: true };
  for (const r of [p, o, c]) if (r.error) throw friendlyError(r.error);
  return {
    payments: ((p.data ?? []) as Payment[]).map(mapPayment),
    ops: ((o.data ?? []) as StayOps[]).map(mapOps),
    cash: ((c.data ?? []) as CashMovement[]).map(mapCash),
    pending: false,
  };
}

async function ownId(sb: SupabaseClient): Promise<string> {
  const props = await loadProperties(sb);
  return (props.find((p) => p.kind === 'propio') ?? props[0]).id;
}

export const supabaseStore: DataStore = {
  mode: 'supabase',
  async load(): Promise<AppData> {
    const sb = getSupabase();
    const owner = await ownerId(sb);
    const properties = await loadProperties(sb);
    const own = properties.find((p) => p.kind === 'propio') ?? properties[0];
    const [profileRes, { data: rows, error: re }, ops, team, me, reviews] = await Promise.all([
      sb.from('profiles').select('full_name, cedula, admin_whatsapp, staff_name, cash_alert_usd, deposit_usd').eq('id', owner).maybeSingle(),
      sb.from('reservations').select(RES_COLUMNS).order('check_in'),
      loadOps(sb),
      sb.rpc('my_team'),
      loadMe(sb),
      sb
        .from('reviews')
        .select(REVIEW_COLUMNS_V8)
        .order('created_at', { ascending: false })
        .then((r) => (missingSchema(r.error) ? sb.from('reviews').select(REVIEW_COLUMNS).order('created_at', { ascending: false }) : r)),
    ]);
    let profile = profileRes.data as Record<string, unknown> | null;
    if (missingSchema(profileRes.error)) {
      const old = await sb.from('profiles').select('full_name, cedula, admin_whatsapp').eq('id', owner).maybeSingle();
      if (old.error) throw friendlyError(old.error);
      profile = old.data as Record<string, unknown> | null;
    } else if (profileRes.error) throw friendlyError(profileRes.error);
    if (re) throw friendlyError(re);
    return {
      me,
      properties,
      settings: {
        owner_name: (profile?.full_name as string) || DEFAULT_SETTINGS.owner_name,
        owner_cedula: (profile?.cedula as string) || DEFAULT_SETTINGS.owner_cedula,
        admin_whatsapp: (profile?.admin_whatsapp as string) ?? '',
        conjunto: own.conjunto,
        unit: own.unit,
        staff_name: (profile?.staff_name as string) || DEFAULT_SETTINGS.staff_name,
        cash_alert_usd: profile?.cash_alert_usd == null ? DEFAULT_SETTINGS.cash_alert_usd : num(profile.cash_alert_usd),
        deposit_usd: profile?.deposit_usd == null ? DEFAULT_SETTINGS.deposit_usd : num(profile.deposit_usd),
      },
      reservations: ((rows ?? []) as unknown as Row[]).map(mapRow),
      payments: ops.payments,
      ops: ops.ops,
      cash: ops.cash,
      team: team.error ? [] : ((team.data ?? []) as TeamMember[]).map((m) => ({ ...m, role: m.role === 'admin' ? 'admin' : 'staff' })),
      migrationPending: ops.pending || schemaV3 === false,
      reviews: reviews.error ? [] : (reviews.data ?? []).map(mapReview),
    };
  },

  async saveSettings(s) {
    const sb = getSupabase();
    const owner = await ownerId(sb);
    const id = await ownId(sb);
    const cedulaDigits = formatCedula(s.owner_cedula).replace(/[^0-9.]/g, '');
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      sb
        .from('profiles')
        .update({
          full_name: cleanText(s.owner_name, 120),
          cedula: cedulaDigits,
          admin_whatsapp: s.admin_whatsapp.replace(/[^0-9+ ]/g, '').slice(0, 20),
          ...(schemaV3 === false
            ? {}
            : {
                staff_name: cleanText(s.staff_name, 40) || 'Zuleika',
                cash_alert_usd: Math.max(0, Math.min(100000, Math.round(Number(s.cash_alert_usd) || 0))),
                deposit_usd: Math.max(0, Math.min(10000, Math.round(Number(s.deposit_usd) || 0))),
              }),
        })
        .eq('id', owner),
      sb.from('properties').update({ conjunto: cleanText(s.conjunto, 80), unit: cleanText(s.unit, 20) }).eq('id', id),
    ]);
    if (e1) throw friendlyError(e1);
    if (e2) throw friendlyError(e2);
  },

  async saveReservation(input) {
    const sb = getSupabase();
    const clean = sanitizeReservation(input);
    const fields = {
      contact_name: clean.contact_name,
      contact_phone: clean.contact_phone,
      channel: clean.channel,
      check_in: clean.check_in,
      check_out: clean.check_out,
      stay_type: clean.stay_type,
      status: clean.status,
      total_usd: clean.total_usd,
      // con la migración de pagos, lo pagado lo calcula la base sumando los pagos
      ...(schemaV3 === false ? { paid_usd: clean.paid_usd } : {}),
      notes: clean.notes,
    };
    if (clean.id) {
      const { error } = await sb
        .from('reservations')
        .update(clean.property_id ? { ...fields, property_id: clean.property_id } : fields)
        .eq('id', clean.id);
      if (error) throw friendlyError(error);
      return clean.id;
    }
    const propertyId = clean.property_id ?? (await ownId(sb));
    const { data, error } = await sb.from('reservations').insert({ ...fields, property_id: propertyId }).select('id').single();
    if (error) throw friendlyError(error);
    // avisa a Zuleika en su teléfono (si los avisos están activos); nunca frena el guardado
    if (clean.status !== 'cancelada') notifyNewStay(data.id as string);
    return data.id as string;
  },

  async deleteReservation(id) {
    const { error } = await getSupabase().from('reservations').delete().eq('id', id);
    if (error) throw friendlyError(error);
  },

  async saveAuthorization(id, guests, vehicles) {
    const g = sanitizeGuests(guests);
    const v = sanitizeVehicles(vehicles);
    const { error } = await getSupabase().rpc('save_authorization', {
      p_reservation_id: id,
      p_guests: g.map((x) => ({ full_name: x.full_name, cedula: x.cedula || null, is_minor: x.is_minor })),
      p_vehicles: v,
    });
    if (error) throw friendlyError(error);
  },

  async markSent(id) {
    const { error } = await getSupabase()
      .from('reservations')
      .update({ auth_status: 'enviada', auth_sent_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw friendlyError(error);
  },

  async saveProperty(input) {
    const sb = getSupabase();
    const clean = sanitizeProperty(input);
    if (clean.id) {
      const { error } = await sb.from('properties').update(propFields(clean)).eq('id', clean.id);
      if (error) throw friendlyError(error);
      return clean.id;
    }
    const { data, error } = await sb.from('properties').insert(propFields(clean)).select('id').single();
    if (error) throw friendlyError(error);
    return data.id as string;
  },

  async deleteProperty(id) {
    const sb = getSupabase();
    const { data } = await sb.from('properties').select('kind').eq('id', id).maybeSingle();
    if (data?.kind === 'propio') throw new Error('El apartamento propio no se puede borrar.');
    const { error } = await sb.from('properties').delete().eq('id', id);
    if (error) throw friendlyError(error);
  },

  async uploadPhoto(propertyId, jpeg) {
    const sb = getSupabase();
    const path = `${await ownerId(sb)}/${propertyId}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from('fotos').upload(path, jpeg, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
    if (error) throw new Error('No se pudo subir la foto. ¿Ejecutaste la migración de fotos en Supabase?');
    return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
  },

  async loadPublic(from, to): Promise<PublicData> {
    const sb = getSupabase();
    const [{ data: listings, error: e1 }, { data: busy, error: e2 }, reviews] = await Promise.all([
      sb.rpc('public_listings'),
      sb.rpc('public_busy', { p_from: from, p_to: to }),
      sb.rpc('public_reviews'),
    ]);
    if (e1 || e2) throw new Error('No se pudo cargar la disponibilidad. Inténtalo de nuevo.');
    return {
      listings: ((listings ?? []) as PublicListing[]).map((l) => ({ ...l, nightly_usd: l.nightly_usd == null ? null : Number(l.nightly_usd), tiktok_url: l.tiktok_url ?? '', google_review_url: l.google_review_url ?? '' })),
      busy: (busy ?? []) as BusyRange[],
      // sin la migración de reseñas, simplemente no hay reseñas
      reviews: reviews.error ? [] : ((reviews.data ?? []) as Record<string, unknown>[]).map((r) => ({ ...(mapReview(r) as unknown as PublicReview), rating: nOrNull(r.rating) })),
    };
  },

  async addPayment(input) {
    const p = sanitizePayment(input);
    const { error } = await getSupabase().from('payments').insert(p);
    if (error) throw friendlyError(error);
  },

  async deletePayment(id) {
    const { data, error } = await getSupabase().from('payments').delete().eq('id', id).select('id');
    if (error) throw friendlyError(error);
    if (!data?.length) throw new Error(CANT_FIX);
  },

  async updatePayment(id, patch) {
    const clean = sanitizePaymentPatch(patch);
    const { data, error } = await getSupabase().from('payments').update(clean).eq('id', id).select('id');
    if (error) throw friendlyError(error);
    if (!data?.length) throw new Error(CANT_FIX);
  },

  async saveOps(reservationId, patch) {
    const clean = sanitizeOpsPatch(patch);
    const { error } = await getSupabase().from('stay_ops').upsert({ reservation_id: reservationId, ...clean }, { onConflict: 'reservation_id' });
    if (error) throw friendlyError(error);
  },

  async addCash(input) {
    const m = sanitizeCash(input);
    const { error } = await getSupabase().from('cash_movements').insert(m);
    // sin la migración de efectivo recibido, la base no conoce ese tipo de movimiento
    if (error && m.kind === 'ingreso' && ['23514', '42501'].includes(error.code ?? ''))
      throw new Error('Para anotar efectivo recibido falta correr en Supabase la migración 20261019000000_caja_efectivo_recibido.sql.');
    if (error) throw friendlyError(error);
  },

  async deleteCash(id) {
    const { data, error } = await getSupabase().from('cash_movements').delete().eq('id', id).select('id');
    if (error) throw friendlyError(error);
    if (!data?.length) throw new Error(CANT_FIX);
  },

  async updateCash(id, input) {
    const m = sanitizeCash(input);
    const { data, error } = await getSupabase().from('cash_movements').update(m).eq('id', id).select('id');
    // sin la migración de corregir, Zuleika no tiene permiso de editar
    if (error) throw friendlyError(error);
    if (!data?.length) throw new Error(CANT_FIX);
  },

  async addTeamMember(email, name, role) {
    const { error } = await getSupabase().rpc('add_team_member', { p_email: cleanText(email, 200), p_name: cleanText(name, 40), p_role: role });
    if (error) {
      if (error.code === 'PGRST202') throw new Error('Falta ejecutar en Supabase la migración 20261014000000_varias_administradoras.sql.');
      // los mensajes de esta función están pensados para Oniris
      if (['P0002', '22023', '42501'].includes(error.code ?? '')) throw new Error(error.message);
      throw friendlyError(error);
    }
  },

  async removeTeamMember(memberId) {
    const { error } = await getSupabase().from('team_members').delete().eq('member_id', memberId);
    if (error) throw friendlyError(error);
  },

  async saveMyName(name) {
    const { error } = await getSupabase().auth.updateUser({ data: { display_name: cleanText(name, 40) } });
    if (error) throw new Error('No se pudo guardar tu nombre. Inténtalo de nuevo.');
  },

  async staffRole() {
    const sb = getSupabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return null;
    const q = (cols: string) => sb.from('team_members').select(cols).eq('member_id', auth.user!.id).maybeSingle();
    let res = await q('name, role');
    if (missingSchema(res.error)) res = await q('name');
    const { data, error } = res as { data: { name: string; role?: string } | null; error: unknown };
    if (error || !data) return null;
    // las administradoras ven el panel completo; solo "trabajo" ve el panel de Zuleika
    if ((data as { role?: string }).role === 'admin') return null;
    return { name: data.name as string };
  },

  async loadStaff(today) {
    const sb = getSupabase();
    const role = await this.staffRole();
    const [board, ops, conf] = await Promise.all([
      sb.rpc('staff_board', { p_from: addDays(today, -30), p_to: addDays(today, 120) }),
      loadOps(sb),
      sb.rpc('staff_settings').maybeSingle(),
    ]);
    if (board.error) throw friendlyError(board.error);
    const c = (conf.data ?? {}) as { deposit_usd?: unknown; cash_alert_usd?: unknown };
    return {
      name: role?.name ?? 'Equipo',
      deposit_usd: c.deposit_usd == null ? DEFAULT_SETTINGS.deposit_usd : num(c.deposit_usd),
      cash_alert_usd: c.cash_alert_usd == null ? DEFAULT_SETTINGS.cash_alert_usd : num(c.cash_alert_usd),
      stays: ((board.data ?? []) as StaffStay[]).map((s) => ({
        ...s,
        contact_phone: s.contact_phone ?? '',
        total_usd: num(s.total_usd),
        paid_usd: num(s.paid_usd),
        people: num(s.people),
        minors: num(s.minors),
        family: s.family === true,
      })),
      payments: ops.payments,
      ops: ops.ops,
      cash: ops.cash,
    };
  },

  async submitReview(propertyId, input) {
    const clean = sanitizeReview(input);
    const { error } = await getSupabase().rpc('submit_review', { p_property: propertyId, p_data: clean });
    if (error) {
      if (['22023', '54000', '23505'].includes(error.code ?? '')) throw new Error(error.message);
      if (error.code === 'PGRST202') throw new Error('Por ahora no se pueden recibir opiniones. Escríbenos por WhatsApp.');
      throw new Error('No se pudo enviar. Revisa tu conexión e inténtalo de nuevo.');
    }
  },

  async moderateReview(id, patch) {
    const fields: { status?: string; reply?: string } = {};
    if (patch.status) fields.status = patch.status;
    if (patch.reply != null) fields.reply = cleanText(patch.reply, 500);
    const { error } = await getSupabase().from('reviews').update(fields).eq('id', id);
    if (error) {
      if (error.code === '23514') throw new Error('El huésped no dio permiso para publicarla.');
      throw friendlyError(error);
    }
  },

  async importReview(propertyId, input, createdAt) {
    const { error } = await getSupabase().rpc('import_review', { p_property: propertyId, p_data: input, p_created_at: createdAt });
    if (error) {
      if (error.code === 'PGRST202') throw new Error('Falta ejecutar en Supabase la migración 20261016000000_resenas.sql.');
      throw friendlyError(error);
    }
  },

  async deleteReview(id) {
    const { error } = await getSupabase().from('reviews').delete().eq('id', id);
    if (error) throw friendlyError(error);
  },
};
