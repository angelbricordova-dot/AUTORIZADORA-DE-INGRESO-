// Modo real: Supabase con RLS. Solo se usa la llave pública (anon); la seguridad la ponen las políticas.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BusyRange, Property, PropertyInput, PublicData, PublicListing, Reservation } from '../types';
import { cleanText } from '../sanitize';
import { formatCedula } from '../cedula';
import { cleanSupabaseKey, cleanSupabaseUrl } from '../supabaseConfig';
import type { AppData, DataStore } from './types';
import { DEFAULT_SETTINGS, OWN_DEFAULTS, friendlyError } from './types';
import { sanitizeGuests, sanitizeProperty, sanitizeReservation, sanitizeVehicles } from './validate';

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

const PROP_COLUMNS =
  'id, kind, name, title, conjunto, unit, summary, description, capacity, bedrooms, nightly_usd, partner_cost_usd, promo, amenities, photos, published, sort, owner_name, owner_cedula, contact_whatsapp, airbnb_url, instagram_url';

type PropRow = Omit<Property, 'nightly_usd' | 'partner_cost_usd'> & { nightly_usd: number | string | null; partner_cost_usd: number | string | null };

function mapProp(r: PropRow): Property {
  const num = (v: number | string | null) => (v == null ? null : Number(v));
  return { ...r, nightly_usd: num(r.nightly_usd), partner_cost_usd: num(r.partner_cost_usd), amenities: r.amenities ?? [], photos: r.photos ?? [] };
}

function propFields(p: PropertyInput) {
  const { id: _id, ...rest } = p;
  return rest;
}

async function loadProperties(sb: SupabaseClient): Promise<Property[]> {
  const { data, error } = await sb.from('properties').select(PROP_COLUMNS).order('sort').order('created_at');
  if (error) throw friendlyError(error);
  let list = ((data ?? []) as unknown as PropRow[]).map(mapProp);
  if (!list.some((p) => p.kind === 'propio')) {
    const { data: created, error: e2 } = await sb.from('properties').insert(propFields(sanitizeProperty(OWN_DEFAULTS))).select(PROP_COLUMNS).single();
    if (e2) throw friendlyError(e2);
    list = [mapProp(created as unknown as PropRow), ...list];
  }
  return list;
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
    const [{ data: profile, error: pe }, { data: rows, error: re }] = await Promise.all([
      sb.from('profiles').select('full_name, cedula, admin_whatsapp').maybeSingle(),
      sb.from('reservations').select(RES_COLUMNS).order('check_in'),
    ]);
    if (pe) throw friendlyError(pe);
    if (re) throw friendlyError(re);
    return {
      properties,
      settings: {
        owner_name: profile?.full_name || DEFAULT_SETTINGS.owner_name,
        owner_cedula: profile?.cedula || DEFAULT_SETTINGS.owner_cedula,
        admin_whatsapp: profile?.admin_whatsapp ?? '',
        conjunto: own.conjunto,
        unit: own.unit,
      },
      reservations: ((rows ?? []) as unknown as Row[]).map(mapRow),
    };
  },

  async saveSettings(s) {
    const sb = getSupabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) throw new Error('Tu sesión venció. Vuelve a entrar.');
    const id = await ownId(sb);
    const cedulaDigits = formatCedula(s.owner_cedula).replace(/[^0-9.]/g, '');
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      sb.from('profiles').update({ full_name: cleanText(s.owner_name, 120), cedula: cedulaDigits, admin_whatsapp: s.admin_whatsapp.replace(/[^0-9+ ]/g, '').slice(0, 20) }).eq('id', auth.user.id),
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
      paid_usd: clean.paid_usd,
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
};
