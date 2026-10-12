// Importa las respuestas del Google Form anterior ("Ayúdanos a mejorar tu próxima estadía").
// En Google Sheets: Archivo → Descargar → Valores separados por comas (.csv).
import type { ReviewInput, ReviewPermission } from './types';

export interface ImportedReview {
  input: ReviewInput;
  /** Fecha y hora de la respuesta ("Marca temporal") en ISO, o null */
  created_at: string | null;
}

/** CSV con comillas, comas y saltos de línea dentro de los campos (como lo exporta Google). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === '\t') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim()));
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const WORDS: Record<string, number> = { una: 1, un: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 };

/** "2", "Dos noches", "1 noche" → número */
export function parseNights(v: string): number | null {
  const t = norm(v.trim());
  const d = t.match(/\d+/);
  if (d) return Math.min(60, Math.max(1, Number(d[0])));
  const w = t.split(/\s+/).find((x) => WORDS[x]);
  return w ? WORDS[w] : null;
}

const score = (v: string, max: number) => {
  const n = Number((v.match(/\d+/) ?? [''])[0]);
  return n >= 1 && n <= max ? n : null;
};

/** "17/9/2026 12:36:15" (día/mes/año) → ISO con la hora de Venezuela */
export function parseStamp(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (!m) return null;
  const [, d, mo, y, h = '12', mi = '00', se = '00'] = m;
  const p2 = (x: string) => x.padStart(2, '0');
  return `${y}-${p2(mo)}-${p2(d)}T${p2(h)}:${mi}:${se}-04:00`;
}

function permission(v: string): ReviewPermission {
  const t = norm(v.trim());
  if (t.startsWith('si') || t === 'yes') return 'si';
  if (t.includes('consult')) return 'consultar';
  return 'no';
}

/** Qué columna es cada pregunta, por las palabras del encabezado. */
const COLUMNS: [keyof ReviewInput | 'stamp', RegExp][] = [
  ['stamp', /marca temporal|timestamp/],
  ['nights', /noches/],
  ['cleanliness', /limpi/],
  ['beds', /camas/],
  ['ac', /temperatura|a\/c|aire/],
  ['kitchen_missing', /falto algo|que falto/],
  ['kitchen_ok', /cocina/],
  ['wifi', /wifi|wi-fi/],
  ['communication', /comunicacion/],
  ['recommend', /recomiend/],
  ['liked', /mas te gusto|lo que mas/],
  ['improve', /mejorarias|mejorar/],
  ['permission', /permiso|testimonio/],
  ['author_name', /nombre/],
];

export function importFormsCsv(text: string): ImportedReview[] {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0].map(norm);
  const col = new Map<string, number>();
  header.forEach((h, i) => {
    const hit = COLUMNS.find(([key, re]) => !col.has(key) && re.test(h));
    if (hit) col.set(hit[0], i);
  });
  if (!col.has('improve') && !col.has('liked')) return [];
  const get = (r: string[], k: string) => (col.has(k) ? (r[col.get(k)!] ?? '').trim() : '');
  return rows.slice(1).map((r) => {
    const missing = get(r, 'kitchen_missing');
    const kitchen = get(r, 'kitchen_ok');
    return {
      created_at: parseStamp(get(r, 'stamp')),
      input: {
        author_name: get(r, 'author_name').slice(0, 60),
        nights: parseNights(get(r, 'nights')),
        cleanliness: score(get(r, 'cleanliness'), 5),
        beds: score(get(r, 'beds'), 5),
        ac: score(get(r, 'ac'), 5),
        wifi: score(get(r, 'wifi'), 5),
        communication: score(get(r, 'communication'), 5),
        kitchen_ok: kitchen ? norm(kitchen).startsWith('si') : null,
        kitchen_missing: /^(nada|no|-|n\/a)?$/i.test(missing) ? '' : missing.slice(0, 300),
        recommend: score(get(r, 'recommend'), 10),
        liked: get(r, 'liked').slice(0, 1000),
        improve: get(r, 'improve').slice(0, 1000) || 'Sin comentarios',
        // en el formulario anterior, el permiso de publicar era sobre "lo que más te gustó"
        comment: get(r, 'liked').slice(0, 1000),
        permission: permission(get(r, 'permission')),
      },
    };
  });
}
