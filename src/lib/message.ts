// Texto que acompaña la planilla en WhatsApp.
import type { Guest, Settings, Vehicle } from './types';
import { formatDMY } from './dates';
import { formatCedula } from './cedula';
import { cleanText } from './sanitize';

export function whatsappMessage(p: {
  settings: Settings;
  checkIn: string;
  checkOut: string;
  guests: Guest[];
  vehicles: Vehicle[];
}): string {
  const people = p.guests.filter((g) => g.full_name.trim());
  const lines = [
    `Buenas, le envío la autorización de ingreso para el inmueble N°${cleanText(p.settings.unit, 20)} (${cleanText(p.settings.conjunto, 80)}).`,
    `Ingreso: ${formatDMY(p.checkIn)} · Salida: ${formatDMY(p.checkOut)}`,
    '',
    ...people.map((g, i) => `${i + 1}. ${cleanText(g.full_name)} — ${g.is_minor && !g.cedula ? 'menor de edad' : 'C.I. ' + formatCedula(g.cedula)}`),
  ];
  const cars = p.vehicles.filter((v) => v.plate.trim() || v.description.trim());
  if (cars.length) {
    lines.push('', ...cars.map((v) => `Vehículo: ${cleanText(v.description, 80)} · Placa ${cleanText(v.plate, 15).toUpperCase()}`));
  }
  lines.push('', `Atentamente, ${cleanText(p.settings.owner_name, 80)}`);
  return lines.join('\n');
}
