import { expect, test, type Page } from '@playwright/test';
import { noErrors, resetDemo, watchErrors } from './helpers';

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = watchErrors(page);
  await resetDemo(page);
});
test.afterEach(() => noErrors(errors));

const caja = (page: Page) => page.locator('.cash-card .big');
const tarjeta = (page: Page, quien: RegExp) => page.getByRole('article', { name: quien });

test('inicio muestra cuánto efectivo guarda Zuleika', async ({ page }) => {
  await page.goto('/admin');
  const link = page.getByRole('link', { name: /Zuleika guarda \$248/ });
  await expect(link).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(/\/admin\/zuleika$/);
  await expect(caja(page)).toHaveText('$248');
  await expect(page.getByText('Faltan $52 para que valga la pena ir.')).toBeVisible();
});

test('Zuleika cobra el saldo en efectivo al llegar y la caja sube', async ({ page }) => {
  await page.goto('/admin/zuleika/vista');
  const llegada = tarjeta(page, /^Llega Grupo Rodríguez/);
  await llegada.getByRole('checkbox', { name: /Cobrar el saldo: \$240/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Anotar un pago' });
  await expect(hoja.getByLabel('Monto en dólares')).toHaveValue('240');
  await expect(hoja.getByRole('radio', { name: 'Efectivo $' })).toBeChecked();
  // Zuleika no elige quién lo recibió: queda a su nombre
  await expect(hoja.getByText('¿Quién lo recibió?')).toHaveCount(0);
  await hoja.getByRole('button', { name: /Anotar \$240/ }).click();
  await expect(caja(page)).toHaveText('$488');
  await expect(llegada.getByRole('checkbox', { name: 'Estadía pagada' })).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByText('Avísale a Oniris para que pase a retirarlo.')).toBeVisible();
});

test('tareas: limpieza, llaves y garantía recibida', async ({ page }) => {
  await page.goto('/admin/zuleika/vista');
  const llegada = tarjeta(page, /^Llega Grupo Rodríguez/);
  await expect(llegada.locator('.ops-count')).toHaveText('0/4');
  await llegada.getByRole('checkbox', { name: 'Limpieza antes de la llegada' }).click();
  await llegada.getByRole('checkbox', { name: 'Entregar las llaves' }).click();
  await llegada.getByRole('checkbox', { name: /Cobrar garantía de \$100/ }).click();
  await page.getByRole('dialog', { name: 'Recibir garantía' }).getByRole('button', { name: 'Recibí $100' }).click();
  await expect(llegada.locator('.ops-count')).toHaveText('3/4');
  await expect(page.getByRole('heading', { name: /Garantías en manos de Zuleika/ })).toBeVisible();
  await expect(page.locator('.cash-card')).toContainText('$200 de garantías por devolver');
  // se guarda: al recargar sigue marcado
  await page.reload();
  await expect(tarjeta(page, /^Llega Grupo Rodríguez/).getByRole('checkbox', { name: 'Entregar las llaves' })).toHaveAttribute('aria-checked', 'true');
});

test('devolver la garantía con un daño: lo retenido pasa a la caja', async ({ page }) => {
  await page.goto('/admin/zuleika/vista');
  const salida = tarjeta(page, /^Se va Luis Hernández/);
  await salida.getByRole('checkbox', { name: /devolver la garantía/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Devolver garantía' });
  await hoja.getByLabel('Monto que se devuelve').fill('80');
  await expect(hoja.getByText('Se quedan $20 en la caja por los daños.')).toBeVisible();
  await expect(hoja.getByRole('button', { name: 'Devolví $80' })).toBeDisabled();
  await hoja.getByLabel(/¿Qué pasó\?/).fill('Un vaso roto');
  await hoja.getByRole('button', { name: 'Devolví $80' }).click();
  await expect(caja(page)).toHaveText('$268');
  await expect(salida.getByText('Se retuvo $20')).toBeVisible();
  await page.getByText('Movimientos de la caja').click();
  await expect(page.locator('.ledger-row').first()).toContainText('Garantía retenida');
  await expect(page.locator('.ledger-row').first()).toContainText('Un vaso roto');
});

test('Oniris registra un retiro y anota un gasto', async ({ page }) => {
  await page.goto('/admin/zuleika');
  await page.getByRole('button', { name: 'Registrar retiro' }).click();
  const hoja = page.getByRole('dialog', { name: 'Registrar retiro' });
  await expect(hoja.getByLabel('Monto que retiraste')).toHaveValue('248');
  await hoja.getByRole('button', { name: 'Anotar retiro' }).click();
  await expect(caja(page)).toHaveText('$0');
  await page.getByRole('button', { name: 'Anotar gasto' }).click();
  const gasto = page.getByRole('dialog', { name: 'Anotar gasto' });
  await gasto.getByLabel('Monto gastado').fill('5');
  await expect(gasto.getByRole('button', { name: 'Anotar gasto' })).toBeDisabled();
  await gasto.getByLabel('¿En qué se gastó?').fill('Bombillo');
  await gasto.getByRole('button', { name: 'Anotar gasto' }).click();
  await expect(caja(page)).toHaveText('−$5');
  await expect(page.getByText('Zuleika puso $5 de su bolsillo: hay que reponérselo.')).toBeVisible();
});

test('pagos de una estadía: método, quién lo recibió y saldo', async ({ page }) => {
  await page.goto('/admin/reserva/demo-3');
  const pagos = page.getByRole('region', { name: 'Pagos' });
  await expect(pagos.getByText('Falta $240')).toBeVisible();
  await expect(pagos.getByText(/Transferencia · \$150/)).toBeVisible();
  await pagos.getByRole('button', { name: /Anotar un pago/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Anotar un pago' });
  await hoja.getByRole('radio', { name: 'Zelle' }).check();
  await hoja.getByLabel('Referencia').fill('ZL-889');
  await hoja.getByRole('button', { name: /Anotar \$240 en zelle/ }).click();
  await expect(pagos.getByText('Pagada')).toBeVisible();
  await expect(pagos.getByText(/ZL-889/)).toBeVisible();
  // lo recibió Oniris: la caja de Zuleika no cambia
  await page.goto('/admin/zuleika');
  await expect(caja(page)).toHaveText('$248');
});

test('estadía nueva con abono en efectivo que recibe Zuleika', async ({ page }) => {
  await page.goto('/admin/reserva/nueva');
  await page.getByText('Canal, pago y notas').click();
  await page.getByLabel('Total (USD)').fill('300');
  await page.getByLabel('Abono recibido').fill('100');
  await page.getByRole('radio', { name: 'Efectivo $' }).check();
  await page.getByRole('radio', { name: 'Lo recibió Zuleika' }).check();
  await page.getByLabel('Entrada').fill('2027-03-01');
  await page.getByLabel('Salida').fill('2027-03-03');
  await page.getByRole('button', { name: 'Guardar estadía' }).click();
  await expect(page.getByText('Estadía registrada')).toBeVisible();
  await page.goto('/admin/zuleika');
  await expect(caja(page)).toHaveText('$348');
});

test('accesos: dar acceso de administradora y de trabajo', async ({ page }) => {
  await page.goto('/admin/mas');
  await page.getByRole('link', { name: /Accesos al panel/ }).click();
  await expect(page).toHaveURL(/\/admin\/accesos$/);
  await page.getByRole('radio', { name: /Administradora/ }).check();
  await page.getByLabel('Nombre').fill('Angélica');
  await page.getByLabel('Correo').fill('angelica@ejemplo.com');
  await page.getByRole('button', { name: 'Dar acceso' }).click();
  const lista = page.getByRole('region', { name: 'Con acceso' });
  await expect(lista.getByText('angelica@ejemplo.com')).toBeVisible();
  await expect(lista.getByText('Administradora', { exact: true })).toBeVisible();
  await page.getByRole('radio', { name: /Trabajo/ }).check();
  await page.getByLabel('Correo').fill('zuleika@ejemplo.com');
  await page.getByRole('button', { name: 'Dar acceso' }).click();
  await expect(lista.getByText('zuleika@ejemplo.com')).toBeVisible();
  await expect(lista.getByText('Trabajo', { exact: true })).toBeVisible();
});

test('la app de trabajo de Zuleika tiene su propia puerta e ícono de llave', async ({ page, request }) => {
  await page.goto('/trabajo');
  await expect(page.getByText('Hola, Zuleika')).toBeVisible();
  await expect(page.locator('.cash-card .big')).toHaveText('$248');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', '/trabajo.webmanifest');
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute('href', '/icon-trabajo-180.png');
  const m = await (await request.get('/trabajo.webmanifest')).json();
  expect(m).toMatchObject({ start_url: '/trabajo', scope: '/trabajo', short_name: 'Trabajo Tu Día' });
  expect((await request.get('/icon-trabajo-180.png')).headers()['content-type']).toBe('image/png');
  // no muestra nada del panel completo
  await expect(page.getByRole('navigation', { name: 'Secciones' })).toHaveCount(0);
});

test('avisos: Zuleika ve la tarjeta para activarlos y el servicio de avisos se publica', async ({ page, request }) => {
  await page.goto('/trabajo');
  const card = page.getByRole('region', { name: /Avisos en este teléfono/ });
  await expect(card).toBeVisible();
  // sin llaves configuradas en el servidor, le dice a quién avisar en vez de un botón que falla
  await expect(card).toContainText('Todavía no están configurados');
  const sw = await request.get('/sw.js');
  expect(sw.ok()).toBe(true);
  expect(await sw.text()).toContain("addEventListener('push'");
});

test('avisos: el panel genera las llaves en el navegador sin mostrar la clave en el SQL', async ({ page }) => {
  await page.goto('/admin/mas');
  const card = page.getByRole('region', { name: /Avisos en este teléfono/ });
  await card.getByRole('button', { name: 'Generar llaves' }).click();
  const values = card.locator('.copy-value');
  await expect(values).toHaveCount(4);
  const [pub, priv, secret, sql] = await values.allTextContents();
  expect(pub).toMatch(/^[A-Za-z0-9_-]{87}$/);
  expect(priv).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(sql).toMatch(/insert into public\.app_secrets .*'[0-9a-f]{64}'/s);
  expect(sql).not.toContain(secret);
});
