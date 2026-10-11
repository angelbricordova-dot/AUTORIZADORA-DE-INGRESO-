// Lectura local (gratis y privada): Tesseract corre dentro del teléfono.
// El motor y el idioma se sirven desde /ocr (mismo dominio), sin CDNs externos.
import type { Worker } from 'tesseract.js';
import { binarize, toCanvas } from './image';
import { findPlate, parseCedulaOcr } from './cedula';

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

export async function readCedulaLocal(file: Blob): Promise<{ full_name: string; cedula: string }> {
  const photo = await toCanvas(file, 1800);
  // 1) lectura completa de la foto: es la que mejor funciona con cédulas nítidas
  const first = parseCedulaOcr(await recognize(photo, '', '3'));
  let { full_name, cedula } = first;
  if (full_name && cedula) return first;
  // 2) respaldo con la foto en blanco y negro (reflejos, fondo dorado)
  const bw = binarize(photo);
  if (!cedula) cedula = parseCedulaOcr(await recognize(bw, '', '11')).cedula;
  if (!full_name) full_name = parseCedulaOcr(await recognize(bw, LETRAS, '4')).full_name;
  return { full_name, cedula };
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
