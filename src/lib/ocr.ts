// Lectura local (gratis y privada): Tesseract corre dentro del teléfono.
// El motor y el idioma se sirven desde /ocr (mismo dominio), sin CDNs externos.
import type { Worker } from 'tesseract.js';
import { binarize, toCanvas } from './image';
import { findPlate, parseCedulaOcr, parseCedulasOcr } from './cedula';

let workerPromise: Promise<Worker> | null = null;

async function getWorker(): Promise<Worker> {
  workerPromise ??= (async () => {
    const { createWorker, OEM } = await import('tesseract.js');
    return createWorker('spa', OEM.LSTM_ONLY, {
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr',
      langPath: '/ocr',
      workerBlobURL: false,
      gzip: true,
    });
  })();
  try {
    return await workerPromise;
  } catch (e) {
    workerPromise = null;
    throw e;
  }
}

async function recognize(canvas: HTMLCanvasElement, whitelist: string, psm: string): Promise<string> {
  const w = await getWorker();
  await w.setParameters({ tessedit_char_whitelist: whitelist, tessedit_pageseg_mode: psm as never });
  const { data } = await w.recognize(canvas);
  return data?.text ?? '';
}

const LETRAS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZÁÉÍÓÚ abcdefghijklmnñopqrstuvwxyzáéíóú';

type Read = { full_name: string; cedula: string };

/** Lee una foto y completa nombre o número con una pasada en blanco y negro si faltan. */
async function readOne(photo: HTMLCanvasElement): Promise<Read[]> {
  const found = parseCedulasOcr(await recognize(photo, '', '3'));
  if (found.length > 1 || (found[0]?.full_name && found[0]?.cedula)) return found;
  const bw = binarize(photo);
  const first = found[0] ?? { full_name: '', cedula: '' };
  const cedula = first.cedula || parseCedulaOcr(await recognize(bw, '', '11')).cedula;
  const full_name = first.full_name || parseCedulaOcr(await recognize(bw, LETRAS, '4')).full_name;
  return full_name || cedula ? [{ full_name, cedula }] : [];
}

function half(src: HTMLCanvasElement, part: 'top' | 'bottom' | 'left' | 'right'): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const vertical = part === 'top' || part === 'bottom';
  // un poco de solape por si la línea de corte pasa por encima de un texto
  c.width = vertical ? src.width : Math.round(src.width * 0.54);
  c.height = vertical ? Math.round(src.height * 0.54) : src.height;
  const sx = part === 'right' ? src.width - c.width : 0;
  const sy = part === 'bottom' ? src.height - c.height : 0;
  c.getContext('2d')?.drawImage(src, sx, sy, c.width, c.height, 0, 0, c.width, c.height);
  return c;
}

/**
 * Lee todas las cédulas de una foto (una o dos). Si la foto parece tener dos
 * cédulas (apiladas o lado a lado) y la primera lectura solo encontró una,
 * lee cada mitad por separado.
 */
export async function readCedulasLocal(file: Blob, onProgress?: (msg: string) => void): Promise<Read[]> {
  const photo = await toCanvas(file, 2000);
  const found = await readOne(photo);
  if (found.length > 1) return found;
  const ratio = photo.height / photo.width;
  const parts: ['top', 'bottom'] | ['left', 'right'] | null = ratio >= 0.95 ? ['top', 'bottom'] : ratio <= 0.45 ? ['left', 'right'] : null;
  if (!parts) return found;
  onProgress?.('Buscando una segunda cédula en la foto…');
  const halves = [...(await readOne(half(photo, parts[0]))), ...(await readOne(half(photo, parts[1])))];
  const valid = halves.filter((r, i, a) => r.cedula && a.findIndex((x) => x.cedula === r.cedula) === i);
  if (valid.length >= 2) {
    // completa el nombre con la lectura completa si una mitad no lo trajo
    return valid.map((r) => (r.full_name ? r : { ...r, full_name: found.find((f) => f.cedula === r.cedula)?.full_name ?? '' }));
  }
  return found;
}

export async function readPlateLocal(file: Blob): Promise<string> {
  const photo = await toCanvas(file, 1600);
  return findPlate(await recognize(photo, '', '11')) || findPlate(await recognize(binarize(photo), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -', '11'));
}

export function warmUpOcr() {
  getWorker().catch(() => {
    /* se reintentará al leer */
  });
}
