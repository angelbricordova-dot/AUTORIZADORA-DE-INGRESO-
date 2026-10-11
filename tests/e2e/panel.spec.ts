import { expect, test } from '@playwright/test';
import ExcelJS from 'exceljs';
import { readFileSync } from 'node:fs';
import { cedulaPhoto, iso, noErrors, resetDemo, watchErrors } from './helpers';

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = watchErrors(page);
  await resetDemo(page);
});
test.afterEach(() => noErrors(errors));

async function readXlsx(path: string) {
  const bytes = readFileSync(path);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  return wb.getWorksheet('Hoja1')!;
}

test('inicio del panel: hoy, pendientes y choques; no se indexa', async ({ page }) => {
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /^Hola, Oniris/ })).toBeVisible();
  await expect(page.getByText('Fechas que chocan')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
});

test('los enlaces viejos con # llevan al panel', async ({ page }) => {
  await page.goto('/#/reservas');
  await expect(page).toHaveURL(/\/admin\/reservas$/);
  await expect(page.getByRole('heading', { name: 'Estadías' })).toBeVisible();
});

test('nueva autorización rápida: solo fechas y cédulas, la estadía se crea sola', async ({ page }) => {
  await page.goto('/admin');
  await page.getByRole('link', { name: 'Nueva autorización' }).click();
  await expect(page).toHaveURL(/\/admin\/autorizacion$/);
  await page.getByLabel('Entrada').fill(iso(40));
  await page.getByLabel('Salida').fill(iso(42));
  await page.getByRole('button', { name: 'Pegar texto de WhatsApp' }).click();
  await page.getByLabel('Pega aquí el mensaje').fill('1. Juan Pérez V-12.345.678\n2. María José Gómez 23456789\n3. Sofía Pérez (niña)\nToyota Corolla vinotinto placa AA046KT');
  await page.getByRole('button', { name: 'Leer el texto' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Solo descargar el Excel' }).click()]);
  const ws = await readXlsx((await download.path())!);
  expect(ws.getCell('C14').value).toBe('Juan Pérez');
  expect(ws.getCell('D16').value).toBe('Menor de edad');
  const d = iso(40);
  expect(String(ws.getCell('B30').value)).toContain(`Fecha Ingreso: ${d.slice(8)}-${d.slice(5, 7)}-${d.slice(2, 4)}`);
  await expect(page).toHaveURL(/\/admin\/autorizacion\/[^/]+$/);
  await page.goto('/admin/reservas');
  await expect(page.getByRole('link', { name: /Juan Pérez y 2 más/ }).getByText('Planilla lista')).toBeVisible();
});

test('autorización de una estadía ya registrada genera el Excel oficial', async ({ page }) => {
  await page.goto('/admin/autorizacion/demo-3');
  await page.getByRole('button', { name: 'Pegar texto de WhatsApp' }).click();
  await page.getByLabel('Pega aquí el mensaje').fill('Ana Karina Lopez\n15.678.901');
  await page.getByRole('button', { name: 'Leer el texto' }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Solo descargar el Excel' }).click()]);
  expect(download.suggestedFilename()).toMatch(/^Autorizacion_Pescadores_\d\d-\d\d-\d\d_Lopez\.xlsx$/);
  const ws = await readXlsx((await download.path())!);
  expect(ws.getCell('D14').value).toBe('15.678.901');
  expect(ws.getCell('B11').value).toBe('Yo Oniris Rojas  CI: 17.571.156');
  expect(ws.getImages()).toHaveLength(1);
});

test('no deja enviar a un adulto sin cédula', async ({ page }) => {
  await page.goto('/admin/autorizacion/demo-5');
  await page.getByRole('button', { name: 'Agregar a mano' }).click();
  await page.getByLabel('Nombre completo de la persona 1').fill('Pedro Sin Cédula');
  await page.getByRole('button', { name: 'Solo descargar el Excel' }).click();
  await expect(page.locator('#errores')).toContainText('Falta la cédula');
});

test('registrar estadía: solo fechas obligatorias; choque detectado', async ({ page }) => {
  await page.goto('/admin/reserva/nueva');
  await page.getByLabel('Entrada').fill(iso(3));
  await page.getByLabel('Salida').fill(iso(4));
  await expect(page.getByRole('alert')).toContainText('Choca con');
  await page.getByRole('button', { name: 'Guardar estadía' }).click();
  await expect(page.getByRole('alert').last()).toContainText('chocan con otra reserva confirmada');
  await page.getByText('Canal, pago y notas').click();
  const tentativa = page.getByRole('radio', { name: 'Tentativa' });
  await tentativa.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await tentativa.check();
  await page.getByRole('button', { name: 'Guardar estadía' }).click();
  await expect(page.getByText('Estadía registrada')).toBeVisible();
});

test('apartamento aliado: la comisión se calcula sola', async ({ page }) => {
  await page.goto('/admin/apartamento/demo-12');
  const box = page.getByRole('status').filter({ hasText: 'Tu comisión por noche' });
  await expect(box).toContainText('$20');
  await page.getByLabel('Precio público por noche').fill('135');
  await expect(box).toContainText('$35');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Apartamento guardado')).toBeVisible();
});

test('rechaza archivos que no son fotos', async ({ page }) => {
  await page.goto('/admin/autorizacion/demo-6');
  await page.locator('input[type=file][multiple]').first().setInputFiles({ name: 'virus.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4') });
  await expect(page.getByText('no es una foto')).toBeVisible();
});

test.describe('lector de cédulas en el teléfono (bajo la CSP real)', () => {
  test.beforeEach(() => {
    test.skip(test.info().project.name !== 'desktop', 'el OCR se prueba una vez');
    test.setTimeout(240_000);
  });

  for (const layout of ['una', 'apiladas', 'lado'] as const) {
    const title = layout === 'una' ? 'una cédula' : `dos cédulas ${layout === 'lado' ? 'lado a lado' : 'apiladas'}`;
    test(`foto con ${title}`, async ({ page }) => {
      const png = await cedulaPhoto(page, layout);
      await page.goto('/admin/autorizacion/demo-6');
      await page.locator('input[type=file][multiple]').first().setInputFiles({ name: 'cedulas.png', mimeType: 'image/png', buffer: png });
      await expect(page.getByLabel('Cédula de la persona 1')).toHaveValue('12.816.045', { timeout: 200_000 });
      await expect(page.getByLabel('Nombre completo de la persona 1')).toHaveValue(/Neyluz.*Marquez/i);
      if (layout !== 'una') {
        await expect(page.getByLabel('Cédula de la persona 2')).toHaveValue('23.456.789');
        await expect(page.getByLabel('Nombre completo de la persona 2')).toHaveValue(/Maria.*Gomez/i);
      } else {
        await expect(page.getByLabel('Cédula de la persona 2')).toHaveCount(0);
      }
    });
  }
});
