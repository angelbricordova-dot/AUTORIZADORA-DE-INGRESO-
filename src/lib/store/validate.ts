// Punto 14: validación antes de enviar a la base de datos (la base vuelve a validar con CHECKs).
import type { Guest, PropertyInput, ReservationInput, Vehicle } from '../types';
import { CHANNELS, MAX_GUESTS, MAX_VEHICLES, STAY_TYPES } from '../types';
import { isValidISO, nightsBetween } from '../dates';
import { cleanPersonName, cleanPhone, cleanText } from '../sanitize';
import { formatCedula, isValidCedula, isValidPlate, normalizePlate } from '../cedula';

export function sanitizeReservation(input: ReservationInput): ReservationInput {
  const out: ReservationInput = {
    ...input,
    contact_name: cleanText(input.contact_name, 120),
    contact_phone: cleanPhone(input.contact_phone),
    notes: cleanText(input.notes, 1000),
    total_usd: Math.max(0, Math.min(100000, Math.round((Number(input.total_usd) || 0) * 100) / 100)),
    paid_usd: Math.max(0, Math.min(100000, Math.round((Number(input.paid_usd) || 0) * 100) / 100)),
  };
  if (!out.contact_name) throw new Error('Escribe el nombre de quien reserva.');
  if (!CHANNELS.some((c) => c.id === out.channel)) throw new Error('Canal inválido.');
  if (!STAY_TYPES.includes(out.stay_type)) throw new Error('Tipo de estadía inválido.');
  if (!['tentativa', 'confirmada', 'cancelada'].includes(out.status)) throw new Error('Estado inválido.');
  if (!isValidISO(out.check_in) || !isValidISO(out.check_out)) throw new Error('Revisa las fechas.');
  const nights = nightsBetween(out.check_in, out.check_out);
  if (nights < 1) throw new Error('La salida debe ser al menos un día después del ingreso.');
  if (nights > 180) throw new Error('La estadía no puede pasar de 180 noches.');
  return out;
}

export function sanitizeGuests(guests: Guest[]): Guest[] {
  const list = guests
    .map((g) => ({
      full_name: cleanPersonName(g.full_name),
      cedula: g.cedula.trim() ? formatCedula(g.cedula) : '',
      is_minor: !!g.is_minor,
    }))
    .filter((g) => g.full_name || g.cedula);
  if (list.length > MAX_GUESTS) throw new Error(`Máximo ${MAX_GUESTS} personas por planilla.`);
  list.forEach((g, i) => {
    if (g.full_name.length < 2) throw new Error(`Falta el nombre de la persona ${i + 1}.`);
    if (g.cedula && !isValidCedula(g.cedula)) throw new Error(`La cédula de ${g.full_name} no parece válida.`);
    if (!g.cedula && !g.is_minor) throw new Error(`Falta la cédula de ${g.full_name}. Si es menor, márcala como menor.`);
  });
  return list;
}

export function sanitizeVehicles(vehicles: Vehicle[]): Vehicle[] {
  const list = vehicles
    .map((v) => ({ description: cleanText(v.description, 80), plate: normalizePlate(v.plate) }))
    .filter((v) => v.description || v.plate);
  if (list.length > MAX_VEHICLES) throw new Error(`Máximo ${MAX_VEHICLES} vehículos por planilla.`);
  list.forEach((v, i) => {
    if (!isValidPlate(v.plate)) throw new Error(`La placa del vehículo ${i + 1} no parece válida.`);
    if (v.description.length < 2) throw new Error(`Escribe modelo y color del vehículo ${i + 1}.`);
  });
  return list;
}

const PHOTO_URL = /^(\/fotos\/[A-Za-z0-9._-]+|https:\/\/[a-z0-9]+\.supabase\.co\/storage\/v1\/object\/public\/fotos\/[A-Za-z0-9/._-]+|data:image\/jpeg;base64,[A-Za-z0-9+/=]+)$/;

export function sanitizeProperty(p: PropertyInput): PropertyInput {
  const money = (v: number | null) => (v == null || Number.isNaN(Number(v)) ? null : Math.max(0, Math.min(100000, Math.round(Number(v) * 100) / 100)));
  const out: PropertyInput = {
    ...p,
    kind: p.kind === 'aliado' ? 'aliado' : 'propio',
    name: cleanText(p.name, 80),
    title: cleanText(p.title, 80),
    conjunto: cleanText(p.conjunto, 80) || 'JDC Pescadores I',
    unit: cleanText(p.unit, 20),
    summary: cleanText(p.summary, 280),
    description: (p.description || '').normalize('NFC').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim().slice(0, 2000),
    capacity: Math.max(1, Math.min(30, Math.round(Number(p.capacity) || 1))),
    bedrooms: p.bedrooms == null || (p.bedrooms as unknown) === '' ? null : Math.max(0, Math.min(20, Math.round(Number(p.bedrooms)))),
    nightly_usd: money(p.nightly_usd),
    partner_cost_usd: p.kind === 'aliado' ? money(p.partner_cost_usd) : null,
    promo: cleanText(p.promo, 140),
    amenities: p.amenities.map((a) => cleanText(a, 40)).filter(Boolean).slice(0, 20),
    photos: p.photos.filter((u) => PHOTO_URL.test(u)).slice(0, 12),
    published: !!p.published,
    sort: Math.max(-100, Math.min(100, Math.round(Number(p.sort) || 0))),
    owner_name: cleanText(p.owner_name, 120),
    owner_cedula: p.owner_cedula.trim() ? formatCedula(p.owner_cedula).replace(/[^0-9.]/g, '') : '',
    contact_whatsapp: (p.contact_whatsapp || '').replace(/\D/g, '').slice(0, 15),
    airbnb_url: cleanText(p.airbnb_url, 300),
    instagram_url: cleanText(p.instagram_url, 300),
  };
  if (!out.unit) throw new Error('Escribe el número del apartamento.');
  if (!out.name) out.name = out.kind === 'propio' ? `Apartamento N°${out.unit}` : `Apto ${out.unit}`;
  if (out.airbnb_url && !/^https:\/\/(www\.)?airbnb\.[a-z.]+\//.test(out.airbnb_url)) throw new Error('El enlace de Airbnb no es válido.');
  if (out.instagram_url && !/^https:\/\/(www\.)?instagram\.com\//.test(out.instagram_url)) throw new Error('El enlace de Instagram no es válido.');
  if (out.kind === 'aliado' && out.nightly_usd != null && out.partner_cost_usd != null && out.nightly_usd < out.partner_cost_usd)
    throw new Error('El precio público no puede ser menor a lo que cobra el dueño.');
  return out;
}
