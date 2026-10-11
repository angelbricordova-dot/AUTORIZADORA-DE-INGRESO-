// Rellena la planilla oficial "Autorización · JDC Pescadores I" (Hoja1 del Excel original).
import type { Guest, Settings, StayType, Vehicle } from './types';
import { MAX_GUESTS, MAX_VEHICLES, STAY_TYPES } from './types';
import { formatShort } from './dates';
import { cleanText, excelSafe } from './sanitize';
import { formatCedula } from './cedula';

export interface AuthorizationSheet {
  /** Fecha de emisión YYYY-MM-DD */
  emitted: string;
  settings: Settings;
  guests: Guest[];
  vehicles: Vehicle[];
  stayType: StayType;
  checkIn: string;
  checkOut: string;
  notes?: string;
  authNumber?: string;
}

const safe = (v: string, max = 120) => excelSafe(cleanText(v, max));

function emissionCell(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `     ${d}   /     ${m}   /      ${y.slice(2)}`;
}

export function stayTypeLine(type: StayType): string {
  const mark = (t: StayType) => (t === type ? '__x__' : '____');
  // el orden y los textos son los de la planilla oficial
  const order: StayType[] = ['Familiar', 'Alquiler Fijo', 'Alquiler Vacacional', 'Mantenimiento', 'Otros'];
  return order.map((t) => `${t}${mark(t)}`).join(' ');
}

export function datesLine(checkIn: string, checkOut: string): string {
  return ` Fecha Ingreso: ${formatShort(checkIn)}                  Fecha Egreso: ${formatShort(checkOut)} `;
}

export function authorizationFileName(sheet: Pick<AuthorizationSheet, 'checkIn' | 'guests'>): string {
  const first = sheet.guests.find((g) => g.full_name.trim());
  const apellido = first ? first.full_name.trim().split(' ').slice(-1)[0] : '';
  const slug = apellido
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]/g, '');
  return `Autorizacion_Pescadores_${formatShort(sheet.checkIn)}${slug ? '_' + slug : ''}.xlsx`;
}

export function validateSheet(sheet: AuthorizationSheet): string[] {
  const errors: string[] = [];
  const people = sheet.guests.filter((g) => g.full_name.trim());
  if (!people.length) errors.push('Agrega al menos una persona con nombre.');
  if (people.length > MAX_GUESTS) errors.push(`La planilla admite máximo ${MAX_GUESTS} personas.`);
  people.forEach((g, i) => {
    if (!g.is_minor && !g.cedula.trim()) errors.push(`Falta la cédula de la persona ${i + 1} (${g.full_name}). Si es menor, márcala como menor.`);
  });
  if (sheet.vehicles.filter((v) => v.plate.trim() || v.description.trim()).length > MAX_VEHICLES)
    errors.push(`La planilla admite máximo ${MAX_VEHICLES} vehículos.`);
  if (!sheet.checkIn || !sheet.checkOut) errors.push('Coloca las fechas de ingreso y salida.');
  else if (sheet.checkOut <= sheet.checkIn) errors.push('La salida debe ser después del ingreso.');
  if (!STAY_TYPES.includes(sheet.stayType)) errors.push('Tipo de estadía inválido.');
  return errors;
}

/** Devuelve el .xlsx relleno. `template` es el archivo plantilla-pescadores.xlsx. */
export async function buildAuthorizationXlsx(template: ArrayBuffer, sheet: AuthorizationSheet): Promise<ArrayBuffer> {
  const errors = validateSheet(sheet);
  if (errors.length) throw new Error(errors[0]);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(template);
  const ws = wb.getWorksheet('Hoja1') ?? wb.worksheets[0];
  if (!ws) throw new Error('La plantilla no tiene la hoja de autorización.');

  const s = sheet.settings;
  ws.getCell('D4').value = emissionCell(sheet.emitted);
  ws.getCell('B6').value = safe(s.conjunto, 80);
  if (sheet.authNumber?.trim()) ws.getCell('D7').value = `  N° ${safe(sheet.authNumber, 20)}`;
  ws.getCell('D10').value = `N°${safe(s.unit, 20)}`;
  ws.getCell('B11').value = `Yo ${safe(s.owner_name, 80)}  CI: ${safe(formatCedula(s.owner_cedula), 20)}`;

  const people = sheet.guests.filter((g) => g.full_name.trim());
  for (let i = 0; i < MAX_GUESTS; i++) {
    const g = people[i];
    ws.getCell(`C${14 + i}`).value = g ? safe(g.full_name) : null;
    ws.getCell(`D${14 + i}`).value = g ? (g.is_minor && !g.cedula ? 'Menor de edad' : safe(formatCedula(g.cedula), 20)) : null;
  }

  const cars = sheet.vehicles.filter((v) => v.plate.trim() || v.description.trim());
  for (let i = 0; i < MAX_VEHICLES; i++) {
    const v = cars[i];
    ws.getCell(`C${24 + i}`).value = v ? safe(v.description, 80) : null;
    ws.getCell(`D${24 + i}`).value = v ? safe(v.plate.toUpperCase(), 15) : null;
  }

  ws.getCell('B27').value = stayTypeLine(sheet.stayType);
  ws.getCell('B30').value = datesLine(sheet.checkIn, sheet.checkOut);
  ws.getCell('B33').value = sheet.notes?.trim() ? safe(sheet.notes, 300) : null;

  wb.creator = 'Pescadores I · Autorizaciones';
  wb.lastModifiedBy = 'Pescadores I · Autorizaciones';
  wb.created = new Date();
  wb.modified = new Date();

  const buf = await wb.xlsx.writeBuffer();
  return buf as ArrayBuffer;
}
