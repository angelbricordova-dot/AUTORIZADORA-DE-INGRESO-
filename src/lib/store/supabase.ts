// Modo real: Supabase con RLS. Solo se usa la llave pública (anon); la seguridad la ponen las políticas.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BusyRange, CashMovement, Payment, Property, PropertyInput, PublicData, PublicListing, Reservation, StaffStay, StayOps, TeamMember } from '../types';
import { cleanText } from '../sanitize';
import { formatCedula } from '../cedula';
import { cleanSupabaseKey, cleanSupabaseUrl } from '../supabaseConfig';
import type { AppData, DataStore } from './types';
import { DEFAULT_SETTINGS, OWN_DEFAULTS, friendlyError } from './types';
import { sanitizeCash, sanitizeGuests, sanitizeOpsPatch, sanitizePayment, sanitizeProperty, sanitizeReservation, sanitizeVehicles } from './validate';
import { addDays } from '../dates';

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
const PROP_COLUMNS = `${PROP_COLUMNS_V2}, beds, bathrooms`;

type PropRow = Omit<Property, 'nightly_usd' | 'partner_cost_usd' | 'beds' | 'bathrooms'> & {
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
  };
}

/** Columna o tabla que todavía no existe: falta ejecutar la última migración. */
const missingSchema = (e: { code?: string } | null) => !!e && ['42703', '42P01', 'PGRST204', 'PGRST205', 'PGRST202'].includes(e.code ?? '');
let schemaV3: boolean | null = null;

function propFields(p: PropertyInput) {
  const { id: _id, ...rest } = p;
  if (schemaV3 === false) {
    const { beds: _b, bathrooms: _ba, ...v2 } = rest;
    return v2;
  }
  return rest;
}

async function loadProperties(sb: SupabaseClient): Promise<Property[]> {
  const select = (cols: string) => sb.from('properties').select(cols).order('sort').order('created_at');
  let res = await select(PROP_COLUMNS);
  if (missingSchema(res.error)) {
    schemaV3 = false;
    res = await select(PROP_COLUMNS_V2);
  } else if (!res.error) schemaV3 = true;
  if (res.error) throw friendlyError(res.error);
  let list = ((res.data ?? []) as unknown as PropRow[]).map(mapProp);
  if (!list.some((p) => p.kind === 'propio')) {
    const { data: created, error: e2 } = await sb
      .from('properties')
      .insert(propFields(sanitizeProperty(OWN_DEFAULTS)))
      .select(schemaV3 === false ? PROP_COLUMNS_V2 : PROP_COLUMNS)
      .single();
    if (e2) throw friendlyError(e2);
    list = [mapProp(created as unknown as PropRow), ...list];
  }
  return list;
}

const num = (v: unknown) => Number(v) || 0;
const PAY_COLUMNS = 'id, reservation_id, amount_usd, method, received_by, paid_on, reference, note';
const OPS_COLUMNS =
  'reservation_id, clean_before_at, keys_at, clean_after_at, linens_at, deposit_usd, deposit_received_at, deposit_returned_at, deposit_returned_usd, note';
const CASH_COLUMNS = 'id, kind, amount_usd, happened_on, note';

const mapPayment = (p: Payment): Payment => ({ ...p, amount_usd: num(p.amount_usd), reference: p.reference ?? '', note: p.note ?? '' });
const mapOps = (o: StayOps): StayOps => ({
  ...o,
  deposit_usd: num(o.deposit_usd),
  deposit_returned_usd: o.deposit_returned_usd == null ? null : num(o.deposit_returned_usd),
  note: o.note ?? '',
});
const mapCash = (m: CashMovement): CashMovement => ({ ...m, amount_usd: num(m.amount_usd), note: m.note ?? '' });

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
    const properties = await loadProperties(sb);
    const own = properties.find((p) => p.kind === 'propio') ?? properties[0];
    const [profileRes, { data: rows, error: re }, ops, team] = await Promise.all([
      sb.from('profiles').select('full_name, cedula, admin_whatsapp, staff_name, cash_alert_usd, deposit_usd').maybeSingle(),
      sb.from('reservations').select(RES_COLUMNS).order('check_in'),
      loadOps(sb),
      sb.rpc('my_team'),
    ]);
    let profile = profileRes.data as Record<string, unknown> | null;
    if (missingSchema(profileRes.error)) {
      const old = await sb.from('profiles').select('full_name, cedula, admin_whatsapp').maybeSingle();
      if (old.error) throw friendlyError(old.error);
      profile = old.data as Record<string, unknown> | null;
    } else if (profileRes.error) throw friendlyError(profileRes.error);
    if (re) throw friendlyError(re);
    return {
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
      team: team.error ? [] : ((team.data ?? []) as TeamMember[]),
      migrationPending: ops.pending || schemaV3 === false,
    };
  },

  async saveSettings(s) {
    const sb = getSupabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) throw new Error('Tu sesión venció. Vuelve a entrar.');
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
        .eq('id', auth.user.id),
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
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) throw new Error('Tu sesión venció. Vuelve a entrar.');
    const path = `${auth.user.id}/${propertyId}/${crypto.randomUUID()}.jpg`;
    const { error } = await sb.storage.from('fotos').upload(path, jpeg, { contentType: 'image/jpeg', upsert: false, cacheControl: '31536000' });
    if (error) throw new Error('No se pudo subir la foto. ¿Ejecutaste la migración de fotos en Supabase?');
    return sb.storage.from('fotos').getPublicUrl(path).data.publicUrl;
  },

  async loadPublic(from, to): Promise<PublicData> {
    const sb = getSupabase();
    const [{ data: listings, error: e1 }, { data: busy, error: e2 }] = await Promise.all([
      sb.rpc('public_listings'),
      sb.rpc('public_busy', { p_from: from, p_to: to }),
    ]);
    if (e1 || e2) throw new Error('No se pudo cargar la disponibilidad. Inténtalo de nuevo.');
    return {
      listings: ((listings ?? []) as PublicListing[]).map((l) => ({ ...l, nightly_usd: l.nightly_usd == null ? null : Number(l.nightly_usd) })),
      busy: (busy ?? []) as BusyRange[],
    };
  },

  async addPayment(input) {
    const p = sanitizePayment(input);
    const { error } = await getSupabase().from('payments').insert(p);
    if (error) throw friendlyError(error);
  },

  async deletePayment(id) {
    const { error } = await getSupabase().from('payments').delete().eq('id', id);
    if (error) throw friendlyError(error);
  },

  async saveOps(reservationId, patch) {
    const clean = sanitizeOpsPatch(patch);
    const { error } = await getSupabase().from('stay_ops').upsert({ reservation_id: reservationId, ...clean }, { onConflict: 'reservation_id' });
    if (error) throw friendlyError(error);
  },

  async addCash(input) {
    const m = sanitizeCash(input);
    const { error } = await getSupabase().from('cash_movements').insert(m);
    if (error) throw friendlyError(error);
  },

  async deleteCash(id) {
    const { error } = await getSupabase().from('cash_movements').delete().eq('id', id);
    if (error) throw friendlyError(error);
  },

  async addTeamMember(email, name) {
    const { error } = await getSupabase().rpc('add_team_member', { p_email: cleanText(email, 200), p_name: cleanText(name, 40) });
    if (error) {
      // los mensajes de esta función están pensados para Oniris
      if (['P0002', '22023', '42501'].includes(error.code ?? '')) throw new Error(error.message);
      throw friendlyError(error);
    }
  },

  async removeTeamMember(memberId) {
    const { error } = await getSupabase().from('team_members').delete().eq('member_id', memberId);
    if (error) throw friendlyError(error);
  },

  async staffRole() {
    const sb = getSupabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) return null;
    const { data, error } = await sb.from('team_members').select('name, owner_id').eq('member_id', auth.user.id).maybeSingle();
    if (error || !data) return null;
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
      })),
      payments: ops.payments,
      ops: ops.ops,
      cash: ops.cash,
    };
  },
};
