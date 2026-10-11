import { expect, test, type Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';

const errors: string[] = [];
function watch(page: Page) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Tesseract escribe su diagnóstico interno por stderr ("Estimating resolution…"): no es un error
    if (m.type() === 'error' && !/^Estimating resolution/.test(m.text())) errors.push(m.text());
  });
}

test.beforeEach(async ({ page }) => {
  errors.length = 0;
  watch(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
});

test.afterEach(() => {
  // incluye violaciones de la Content-Security-Policy
  expect(errors, errors.join('\n')).toEqual([]);
});

test('inicio muestra pendientes, choques y la tira de toldos', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Pendiente' })).toBeVisible();
  await expect(page.getByText('Fechas que chocan')).toBeVisible();
  await expect(page.getByRole('link', { name: /Grupo Rodríguez.*choca con otra reserva/ }).first()).toBeVisible();
  await expect(page.getByText('Modo demo')).toBeVisible();
});

test('registrar estadía que choca avisa y la base la rechaza como confirmada', async ({ page }) => {
  await page.goto('/#/reserva/nueva');
  const today = new Date();
  const iso = (d: number) => {
    const x = new Date(today.getFullYear(), today.getMonth(), today.getDate() + d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  };
  await page.getByLabel('Entrada').fill(iso(3));
  await page.getByLabel('Salida').fill(iso(4));
  await page.getByLabel('Nombre o grupo').fill('Prueba choque');
  await expect(page.getByRole('alert')).toContainText('Choca con');
  await page.getByRole('button', { name: 'Guardar estadía' }).click();
  await expect(page.getByRole('alert').last()).toContainText('chocan con otra reserva confirmada');
  await page.getByRole('radio', { name: 'Tentativa' }).check();
  await page.getByRole('button', { name: 'Guardar estadía' }).click();
  await expect(page.getByText('Estadía registrada')).toBeVisible();
});

test('pegar texto de WhatsApp y descargar el Excel oficial relleno', async ({ page }) => {
  await page.goto('/#/autorizacion/demo-3');
  await page.getByRole('button', { name: 'Pegar texto de WhatsApp' }).click();
  await page.getByLabel('Pega aquí el mensaje').fill(
    '1. Juan Pérez V-12.345.678\n2. María José Gómez 23456789\n3. Sofía Pérez (niña de 8 años)\nToyota Corolla vinotinto placa AA046KT',
  );
  await page.getByRole('button', { name: 'Leer el texto' }).click();
  await expect(page.getByLabel('Nombre completo de la persona 1')).toHaveValue('Juan Pérez');
  await expect(page.getByLabel('Cédula de la persona 2')).toHaveValue('23.456.789');
  await expect(page.getByLabel('Placa del vehículo 1')).toHaveValue('AA046KT');

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Solo descargar el Excel' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^Autorizacion_Pescadores_\d\d-\d\d-\d\d_Perez\.xlsx$/);
  const wb = new ExcelJS.Workbook();
  const bytes = readFileSync((await download.path())!);
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  const ws = wb.getWorksheet('Hoja1')!;
  expect(ws.getCell('C14').value).toBe('Juan Pérez');
  expect(ws.getCell('D14').value).toBe('12.345.678');
  expect(ws.getCell('D16').value).toBe('Menor de edad');
  expect(ws.getCell('C24').value).toBe('Toyota Corolla vinotinto');
  expect(ws.getCell('B11').value).toBe('Yo Oniris Rojas  CI: 17.571.156');
  expect(ws.getImages()).toHaveLength(1);

  // queda guardado y la estadía pasa a "planilla lista"
  await page.goto('/#/reservas');
  await expect(page.getByRole('link', { name: /Grupo Rodríguez/ }).getByText('Planilla lista')).toBeVisible();
});

test('no se puede enviar sin cédula de un adulto', async ({ page }) => {
  await page.goto('/#/autorizacion/demo-5');
  await page.getByRole('button', { name: 'Agregar persona' }).click();
  await page.getByLabel('Nombre completo de la persona 1').fill('Pedro Sin Cédula');
  await page.getByRole('button', { name: 'Solo descargar el Excel' }).click();
  await expect(page.locator('#errores')).toContainText('Falta la cédula');
});

test('lee una cédula desde una foto con el OCR del teléfono (bajo CSP estricta)', async ({ page, browserName }, info) => {
  test.skip(info.project.name !== 'desktop', 'el OCR se prueba una vez');
  test.setTimeout(180_000);
  // Genera una "foto" de cédula sintética en otra pestaña
  const scratch = await page.context().newPage();
  await scratch.setContent(`<div id="c" style="width:900px;height:560px;background:linear-gradient(135deg,#e9d98f,#cdb86a);font-family:Arial;padding:28px;box-sizing:border-box;color:#111">
    <div style="font-size:30px;font-weight:bold">REPUBLICA BOLIVARIANA DE VENEZUELA</div>
    <div style="font-size:30px;font-weight:bold;margin-bottom:18px">CEDULA DE IDENTIDAD</div>
    <div style="font-size:56px;font-weight:bold;margin-bottom:22px">V 12.816.045</div>
    <div style="font-size:30px">APELLIDOS <b>MARQUEZ CONTRERAS</b></div>
    <div style="font-size:30px;margin-top:10px">NOMBRES <b>NEYLUZ MARYORYE</b></div>
    <div style="font-size:22px;margin-top:18px">F. NACIMIENTO 12/03/1975 EDO. CIVIL SOLTERA</div></div>`);
  const png = await scratch.locator('#c').screenshot();
  await scratch.close();
  expect(browserName).toBe('chromium');

  await page.goto('/#/autorizacion/demo-6');
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'cedula.png', mimeType: 'image/png', buffer: png });
  await expect(page.getByLabel('Cédula de la persona 1')).toHaveValue('12.816.045', { timeout: 150_000 });
  await expect(page.getByLabel('Nombre completo de la persona 1')).toHaveValue(/Neyluz.*Marquez/i);
  await expect(page.getByText('Revisa lo leído')).toBeVisible();
});

test('rechaza archivos que no son fotos', async ({ page }) => {
  await page.goto('/#/autorizacion/demo-6');
  await page.locator('input[type=file][multiple]').setInputFiles({ name: 'virus.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(page.getByText('no es una foto')).toBeVisible();
});
