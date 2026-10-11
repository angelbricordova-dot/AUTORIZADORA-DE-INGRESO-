// Cédulas venezolanas: formato, validación y lectura desde texto (OCR o WhatsApp).
import type { Guest, Vehicle } from './types';
import { cleanPersonName, cleanText, isValidPersonName, titleCase } from './sanitize';

export type Nationality = 'V' | 'E';

/** Extrae nacionalidad y dígitos de algo como "V-12.345.678", "e 84123456", "12345678". */
export function splitCedula(raw: string): { nat: Nationality; digits: string } | null {
  const s = cleanText(raw, 30).toUpperCase();
  const m = s.match(/^(?:C\.?\s*I\.?\s*:?\s*)?([VE])?\s*[-.]?\s*((?:\d[\s.]?){5,9})$/);
  if (!m) return null;
  const digits = m[2].replace(/\D/g, '').replace(/^0+/, '');
  if (digits.length < 6 || digits.length > 9) return null;
  return { nat: (m[1] as Nationality) || (Number(digits) >= 80_000_000 ? 'E' : 'V'), digits };
}

/** "12345678" → "12.345.678"; extranjeros → "E-84.123.456" */
export function formatCedula(raw: string): string {
  const parts = splitCedula(raw);
  if (!parts) return cleanText(raw, 20);
  const grouped = parts.digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return parts.nat === 'E' ? `E-${grouped}` : grouped;
}

export function isValidCedula(raw: string): boolean {
  const p = splitCedula(raw);
  return !!p && p.digits.length >= 6 && p.digits.length <= 8;
}

// ---------------------------------------------------------------------
// Lectura de la foto de la cédula (texto que devuelve el OCR)
// ---------------------------------------------------------------------

const ETIQUETAS =
  /^(APELLIDOS?|NOMBRES?|CEDULA|C[ÉE]DULA|IDENTIDAD|REP[ÚU]BLICA|BOLIVARIANA|VENEZUELA|VENEZOLANO|VENEZOLANA|EXTRANJERO|EXTRANJERA|FIRMA|TITULAR|NACIMIENTO|EXPEDICI[ÓO]N|VENCIMIENTO|SOLTERO|SOLTERA|CASADO|CASADA|DIVORCIADO|DIVORCIADA|VIUDO|VIUDA|DIRECTOR|DIRECTORA|EDO|CIVIL|FECHA|SAIME|MINISTERIO|PODER|POPULAR|PARA|INTERIOR|JUSTICIA|PAZ|RELACIONES|DE|DEL|LA|EL|F)$/;

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

function pareceEtiqueta(token: string, etiqueta: string): boolean {
  const t = token.replace(/[^A-ZÑ]/g, '');
  if (t.length < 4) return false;
  return levenshtein(t, etiqueta) <= Math.max(1, Math.floor(etiqueta.length * 0.34));
}

function esPalabraNombre(w: string): boolean {
  return /^[A-ZÁÉÍÓÚÑ]{2,}$/.test(w) && !ETIQUETAS.test(w);
}

const PARTICULA = /^(DE|DEL|LA|LAS|LOS|Y)$/;

/** Conserva "DE LA" entre palabras de nombre y descarta el resto de etiquetas. */
function palabrasDeNombre(toks: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (esPalabraNombre(t)) out.push(t);
    else if (PARTICULA.test(t) && out.length && toks.slice(i + 1).some(esPalabraNombre)) out.push(t);
    else if (out.length && !PARTICULA.test(t)) break;
  }
  while (out.length && PARTICULA.test(out[out.length - 1])) out.pop();
  return out;
}

function valorDeEtiqueta(lineas: string[], etiqueta: string): string {
  for (let i = 0; i < lineas.length; i++) {
    const toks = lineas[i].split(' ');
    const idx = toks.findIndex((t) => pareceEtiqueta(t, etiqueta));
    if (idx < 0) continue;
    const resto = palabrasDeNombre(toks.slice(idx + 1));
    if (resto.length) return resto.join(' ');
    for (let j = i + 1; j < Math.min(i + 3, lineas.length); j++) {
      const sig = palabrasDeNombre(lineas[j].split(' '));
      if (sig.length) return sig.join(' ');
    }
  }
  return '';
}

/** Busca un número de cédula en texto libre. Devuelve "12.345.678" o "". */
export function findCedulaNumber(text: string): string {
  const t = (text || '').toUpperCase();
  // 1) con prefijo V/E: "V 12.345.678", "V-12345678"
  const pref = t.match(/(?:^|[^A-Z0-9])([VE])\s*[-.:]?\s*(\d{1,2}[.\s,]?\d{3}[.\s,]?\d{3})(?!\d)/);
  if (pref) return formatCedula(`${pref[1]}${pref[2].replace(/[\s,]/g, '')}`);
  // 2) con puntos: "12.345.678" o "9.876.543"
  const dots = t.match(/(?<![\d.])(\d{1,2})[.,](\d{3})[.,](\d{3})(?![\d.])/);
  if (dots) return formatCedula(dots[1] + dots[2] + dots[3]);
  // 3) 7 u 8 dígitos seguidos, que no sean parte de un teléfono
  const plain = t.match(/(?<!\d)(\d{7,8})(?!\d)/);
  if (plain) return formatCedula(plain[1]);
  return '';
}

/** Interpreta el texto OCR del frente de una cédula venezolana. */
export function parseCedulaOcr(text: string): { full_name: string; cedula: string } {
  const lineas = (text || '')
    .toUpperCase()
    .split(/\n/)
    .map((l) => l.replace(/[^A-ZÁÉÍÓÚÑ0-9.\- ]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const soloLetras = lineas.map((l) => l.replace(/[^A-ZÁÉÍÓÚÑ ]/g, ' ').replace(/\s+/g, ' ').trim());
  const apellidos = valorDeEtiqueta(soloLetras, 'APELLIDOS');
  const nombres = valorDeEtiqueta(soloLetras, 'NOMBRES');
  const full = titleCase(`${nombres} ${apellidos}`.trim());
  return { full_name: full, cedula: findCedulaNumber(text) };
}

// ---------------------------------------------------------------------
// Placas venezolanas
// ---------------------------------------------------------------------

/** Formatos: AB123CD (actual), ABC12D, ABC123 y variantes de motos. */
const PLACA_EXACTA =
  /^(?:[A-Z]{2}\d{3}[A-Z]{2}|[A-Z]{3}\d{2}[A-Z]|[A-Z]{3}\d{3}|[A-Z]\d{2}[A-Z]{2}\d[A-Z]|[A-Z]{2}\d[A-Z]\d{2}[A-Z]|\d{2}[A-Z]{2}\d[A-Z]{2})$/;

export function normalizePlate(raw: string): string {
  return cleanText(raw, 15).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function isValidPlate(raw: string): boolean {
  const p = normalizePlate(raw);
  return /^[A-Z0-9]{5,8}$/.test(p) && /[A-Z]/.test(p) && /\d/.test(p);
}

/** Busca una placa en texto libre; tolera espacios o guiones dentro ("AB 123 CD"). */
export function findPlate(text: string): string {
  const tokens = (text || '').toUpperCase().replace(/[^A-Z0-9\s-]/g, ' ').split(/[\s-]+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i++) {
    for (let len = 1; len <= 3 && i + len <= tokens.length; len++) {
      const cand = tokens.slice(i, i + len).join('');
      if (PLACA_EXACTA.test(cand)) return cand;
    }
  }
  return '';
}

// ---------------------------------------------------------------------
// Texto pegado desde WhatsApp
// ---------------------------------------------------------------------

const MENOR = /\b(menor|niñ[oa]s?|nin[oa]s?|beb[ée]s?|hij[oa] menor|sin c[ée]dula|\d{1,2} años)\b/i;
const VEHICULO = /\b(placa|carro|camioneta|veh[ií]culo|auto|moto|toyota|ford|chevrolet|chery|hyundai|kia|mitsubishi|nissan|jeep|fiat|renault|volkswagen|honda|mazda|suzuki|peugeot|dodge|chrysler|great wall|jac)\b/i;

function stripListPrefix(l: string): string {
  return l.replace(/^\s*(?:[-*•·]\s*|\d{1,2}\s*[).:-]\s*(?=\D)|\d{1,2}\s+(?=[A-Za-zÁÉÍÓÚÑáéíóúñ]))/, '');
}

export interface ParsedText {
  guests: Guest[];
  vehicles: Vehicle[];
}

/**
 * Convierte un mensaje como
 *   "1. Juan Pérez V-12.345.678\n2. María Gómez 23456789\n3. Sofía (niña)\nToyota Corolla blanco placa AB123CD"
 * en personas y vehículos.
 */
export function parseGuestText(text: string): ParsedText {
  const lines = (text || '')
    .split(/\r?\n/)
    .map((l) => cleanText(l, 200))
    .filter(Boolean);

  const guests: Guest[] = [];
  const vehicles: Vehicle[] = [];
  let pendingName = '';

  const flushPending = (minor: boolean) => {
    if (pendingName && isValidPersonName(pendingName)) {
      guests.push({ full_name: cleanPersonName(pendingName), cedula: '', is_minor: minor });
    }
    pendingName = '';
  };

  for (const raw of lines) {
    const line = stripListPrefix(raw);
    const upper = line.toUpperCase();

    const plate = findPlate(upper.replace(/\bPLACAS?\b[:.\s]*/g, ' '));
    if (plate && (VEHICULO.test(line) || normalizePlate(line) === plate)) {
      flushPending(false);
      const desc = cleanText(
        line
          .replace(new RegExp(plate.split('').join('[\\s-]?'), 'i'), ' ')
          .replace(/\b(placas?|veh[ií]culo|color)\b[:.]?/gi, ' ')
          .replace(/[,:;]+/g, ' ')
          .replace(/\s-\s|\s-$|^-\s/g, ' '),
        80,
      );
      vehicles.push({ description: desc ? desc.charAt(0).toUpperCase() + desc.slice(1) : '', plate });
      continue;
    }

    const ced = findCedulaNumber(line);
    const namePart = cleanText(
      line
        .replace(/\b(?:C\.?\s*I\.?|c[ée]dula|ced|nro|n[°º])\b[:.]?/gi, ' ')
        .replace(/[VE]\s*[-.:]?\s*\d[\d.\s,]{5,}/gi, ' ')
        .replace(/\d[\d.,\s]*/g, ' ')
        .replace(/\(.*?\)/g, ' ')
        .replace(/\b(menor|niñ[oa]|nin[oa]|beb[ée]|años|sin c[ée]dula)\b/gi, ' '),
    );
    const hasName = isValidPersonName(namePart);

    if (ced && hasName) {
      flushPending(false);
      guests.push({ full_name: cleanPersonName(namePart), cedula: ced, is_minor: false });
    } else if (ced && !hasName) {
      if (pendingName) {
        guests.push({ full_name: cleanPersonName(pendingName), cedula: ced, is_minor: false });
        pendingName = '';
      } else {
        guests.push({ full_name: '', cedula: ced, is_minor: false });
      }
    } else if (hasName) {
      if (MENOR.test(line)) {
        flushPending(false);
        guests.push({ full_name: cleanPersonName(namePart), cedula: '', is_minor: true });
      } else {
        flushPending(false);
        pendingName = namePart;
      }
    }
  }
  flushPending(false);
  return { guests, vehicles };
}

// ---------------------------------------------------------------------
// Varias cédulas en una misma foto
// ---------------------------------------------------------------------

const NUM_EN_LINEA = /(?:^|[^A-Z0-9])([VE])\s*[-.:]?\s*\d{1,2}[.\s,]?\d{3}[.\s,]?\d{3}(?!\d)|(?<![\d.])\d{1,2}[.,]\d{3}[.,]\d{3}(?![\d.])/i;

/**
 * Interpreta el texto OCR de una foto que puede traer una o varias cédulas.
 * Corta el texto en bloques que empiezan en cada número de cédula (en la cédula
 * venezolana el número va arriba y los nombres debajo) y lee cada bloque.
 */
export function parseCedulasOcr(text: string): { full_name: string; cedula: string }[] {
  const lines = (text || '').split(/\n/);
  const starts: number[] = [];
  lines.forEach((l, i) => {
    if (NUM_EN_LINEA.test(l.toUpperCase())) starts.push(i);
  });
  if (starts.length < 2) {
    const one = parseCedulaOcr(text);
    return one.full_name || one.cedula ? [one] : [];
  }
  const out: { full_name: string; cedula: string }[] = [];
  const seen = new Set<string>();
  starts.forEach((s, k) => {
    const end = k + 1 < starts.length ? starts[k + 1] : lines.length;
    const block = lines.slice(s, end).join('\n');
    const r = parseCedulaOcr(block);
    if (!r.cedula || seen.has(r.cedula)) return;
    seen.add(r.cedula);
    out.push(r);
  });
  return out.length ? out : [parseCedulaOcr(text)];
}
