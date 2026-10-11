// Punto 15: sanitizar contenido antes de guardarlo o escribirlo en el Excel.

/** Quita caracteres de control, colapsa espacios y recorta a un máximo. */
export function cleanText(value: unknown, max = 120): string {
  if (typeof value !== 'string') return '';
  return value
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Evita la "inyección de fórmulas" en Excel: un texto que empieza con = + - @
 * se interpreta como fórmula al abrir el archivo. Se antepone un apóstrofo.
 */
export function excelSafe(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'do', 'dos', 'van', 'von']);

/** "MARIA DE LOS ANGELES PEREZ" → "Maria de los Angeles Perez" */
export function titleCase(s: string): string {
  return cleanText(s)
    .toLocaleLowerCase('es')
    .split(' ')
    .map((w, i) => (i > 0 && PARTICULAS.has(w) ? w : w.charAt(0).toLocaleUpperCase('es') + w.slice(1)))
    .join(' ');
}

/** Solo letras (con acentos), espacios, apóstrofo y guion. */
export function cleanPersonName(s: string): string {
  return titleCase(s.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, ' '));
}

export function isValidPersonName(s: string): boolean {
  const n = cleanText(s);
  return n.length >= 2 && n.length <= 120 && /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]+$/.test(n) && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]{2}/.test(n);
}

/** Teléfono: dígitos, espacios, + ( ) - */
export function cleanPhone(s: string): string {
  return cleanText(s, 20).replace(/[^0-9+ ()-]/g, '');
}

/** Teléfono para wa.me: solo dígitos, convierte 0414… a 58414… */
export function phoneForWhatsApp(s: string): string {
  let d = s.replace(/\D/g, '');
  if (d.startsWith('0') && d.length === 11) d = '58' + d.slice(1);
  return d;
}
