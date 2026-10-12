import { expect, test } from '@playwright/test';
import { iso, noErrors, pickDay, resetDemo, watchErrors } from './helpers';

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = watchErrors(page);
  await resetDemo(page);
});
test.afterEach(() => noErrors(errors));

test('página pública: precio, fechas sugeridas y reserva por WhatsApp', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu Día en Tucacas');
  await expect(page.getByText('Hasta 7 personas').first()).toBeVisible();
  const reservar = page.getByRole('link', { name: 'Reservar por WhatsApp' });
  await expect(reservar).toBeVisible();
  const url = new URL((await reservar.getAttribute('href'))!);
  expect(url.hostname).toBe('wa.me');
  expect(url.pathname).toBe('/584242703482');
  expect(url.searchParams.get('text')).toContain('Personas: 2');
  // no expone datos de huéspedes
  await expect(page.getByText('Grupo Rodríguez')).toHaveCount(0);
  await expect(page.getByText('Luis Hernández')).toHaveCount(0);
});

test('fechas ocupadas: ofrece otros apartamentos libres del conjunto', async ({ page }) => {
  await page.goto('/');
  await pickDay(page, iso(3));
  await pickDay(page, iso(5));
  await expect(page.getByText('ya está ocupado aquí')).toBeVisible();
  const alt = page.locator('#alternativas');
  await expect(alt.getByRole('heading', { name: 'Apartamento 21' })).toBeVisible();
  await expect(alt.getByRole('heading', { name: 'Apartamento 12' })).toHaveCount(0);
  const consultar = alt.getByRole('link', { name: 'Consultar' });
  expect(new URL((await consultar.getAttribute('href'))!).searchParams.get('text')).toContain('Apartamento 21');
});

test('más personas que la capacidad: primero ofrece pedir la excepción, luego otros apartamentos', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Una persona más' }).click();
  await expect(page.getByText('Este apartamento es para')).toBeVisible();
  await page.getByRole('button', { name: 'Un niño más' }).click();
  await page.getByRole('button', { name: 'Un niño más' }).click();
  const pedir = page.getByRole('link', { name: 'Consultar excepción por WhatsApp' });
  const text = new URL((await pedir.getAttribute('href'))!).searchParams.get('text')!;
  expect(text).toContain('somos 9 personas');
  expect(text).toContain('7 adultos y 2 niños');
  expect(text).toContain('excepción');
  // la consulta de excepción aparece antes que la lista de otros apartamentos
  const alt = page.locator('#alternativas');
  await expect(alt).toBeVisible();
  const [yPedir, yAlt] = await Promise.all([pedir.boundingBox(), alt.boundingBox()]);
  expect(yPedir!.y).toBeLessThan(yAlt!.y);
});

test('fotos reales del N°30: portada, mosaico y fotos a pantalla completa', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('list', { name: 'Datos del apartamento' })).toContainText('2 baños');
  await expect(page.getByText('tanque de agua interno', { exact: false })).toBeVisible();
  const portada = page.locator('.hero-photos img').first();
  await expect(portada).toHaveAttribute('src', '/fotos/n30-01-sala-comedor.jpg');
  expect(await portada.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Ver las 12 fotos' }).click();
  const visor = page.getByRole('dialog', { name: /^Fotos de/ });
  await expect(visor).toContainText('1 / 12');
  await page.keyboard.press('ArrowRight');
  await expect(visor).toContainText('2 / 12');
  await page.keyboard.press('Escape');
  await expect(visor).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver foto 5 de 12' }).click();
  await expect(page.getByRole('dialog', { name: /^Fotos de/ })).toContainText('5 / 12');
});

test('el panel tiene enlace desde la página', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Administración' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: /^Hola, Oniris/ })).toBeVisible();
});
