// Modo real: Supabase con RLS. Solo se usa la llave pública (anon); la seguridad la ponen las políticas.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Reservation } from '../types';
import { cleanText } from '../sanitize';
import { formatCedula } from '../cedula';
import type { AppData, DataStore } from './types';
import { DEFAULT_SETTINGS, friendlyError } from './types';
import { sanitizeGuests, sanitizeReservation, sanitizeVehicles } from './validate';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = !!(url && anon && /^https:\/\//.test(url));

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

async function ensureProperty(sb: SupabaseClient) {
  const { data, error } = await sb.from('properties').select('id, name, conjunto, unit').order('created_at').limit(1);
  if (error) throw friendlyError(error);
  if (data && data.length) return data[0];
  const { data: created, error: e2 } = await sb
    .from('properties')
    .insert({ name: `Apartamento N°${DEFAULT_SETTINGS.unit}`, conjunto: DEFAULT_SETTINGS.conjunto, unit: DEFAULT_SETTINGS.unit })
    .select('id, name, conjunto, unit')
    .single();
  if (e2) throw friendlyError(e2);
  return created;
}

export const supabaseStore: DataStore = {
  mode: 'supabase',
  async load(): Promise<AppData> {
    const sb = getSupabase();
    const property = await ensureProperty(sb);
    const [{ data: profile, error: pe }, { data: rows, error: re }] = await Promise.all([
      sb.from('profiles').select('full_name, cedula, admin_whatsapp').maybeSingle(),
      sb.from('reservations').select(RES_COLUMNS).eq('property_id', property.id).order('check_in'),
    ]);
    if (pe) throw friendlyError(pe);
    if (re) throw friendlyError(re);
    return {
      property,
      settings: {
        owner_name: profile?.full_name || DEFAULT_SETTINGS.owner_name,
        owner_cedula: profile?.cedula || DEFAULT_SETTINGS.owner_cedula,
        admin_whatsapp: profile?.admin_whatsapp ?? '',
        conjunto: property.conjunto,
        unit: property.unit,
      },
      reservations: ((rows ?? []) as unknown as Row[]).map(mapRow),
    };
  },

  async saveSettings(s) {
    const sb = getSupabase();
    const { data: auth } = await sb.auth.getUser();
    if (!auth.user) throw new Error('Tu sesión venció. Vuelve a entrar.');
    const property = await ensureProperty(sb);
    const cedulaDigits = formatCedula(s.owner_cedula).replace(/[^0-9.]/g, '');
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      sb.from('profiles').update({ full_name: cleanText(s.owner_name, 120), cedula: cedulaDigits, admin_whatsapp: s.admin_whatsapp.replace(/[^0-9+ ]/g, '').slice(0, 20) }).eq('id', auth.user.id),
      sb.from('properties').update({ conjunto: cleanText(s.conjunto, 80), unit: cleanText(s.unit, 20), name: `Apartamento N°${cleanText(s.unit, 20)}` }).eq('id', property.id),
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
      const { error } = await sb.from('reservations').update(fields).eq('id', clean.id);
      if (error) throw friendlyError(error);
      return clean.id;
    }
    const property = await ensureProperty(sb);
    const { data, error } = await sb.from('reservations').insert({ ...fields, property_id: property.id }).select('id').single();
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
};
