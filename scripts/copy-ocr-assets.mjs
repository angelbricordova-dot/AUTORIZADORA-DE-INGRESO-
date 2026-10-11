// Copia el motor OCR (Tesseract) y el idioma español a public/ocr para
// servirlos desde nuestro propio dominio: sin CDNs externos y con una CSP estricta.
import { cpSync, mkdirSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const out = 'public/ocr';
mkdirSync(out, { recursive: true });

cpSync('node_modules/tesseract.js/dist/worker.min.js', join(out, 'worker.min.js'));

const coreDir = 'node_modules/tesseract.js-core';
for (const f of readdirSync(coreDir)) {
  if (f.includes('lstm') && (f.endsWith('.js') || f.endsWith('.wasm'))) {
    cpSync(join(coreDir, f), join(out, f));
  }
}

const lang = 'node_modules/@tesseract.js-data/spa/4.0.0_best_int/spa.traineddata.gz';
if (!existsSync(lang)) {
  console.error('Falta el idioma español para OCR. Ejecuta npm install.');
  process.exit(1);
}
cpSync(lang, join(out, 'spa.traineddata.gz'));
console.log('OCR listo en', out);
