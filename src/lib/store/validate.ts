// Punto 14: validación antes de enviar a la base de datos (la base vuelve a validar con CHECKs).
import type { Guest, ReservationInput, Vehicle } from '../types';
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
