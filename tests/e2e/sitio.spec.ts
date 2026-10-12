import { expect, test } from '@playwright/test';
import { iso, noErrors, pickDay, resetDemo, watchErrors } from './helpers';

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = watchErrors(page);
  await resetDemo(page);
});
test.afterEach(() => noErrors(errors));

test('inicio: presenta la marca y lleva a cada apartamento', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Tu día en Tucacas');
  await expect(page.getByRole('heading', { name: 'Nuestros apartamentos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Reservar es así de fácil' })).toBeVisible();
  await page.getByRole('link', { name: 'Apartamento N°30' }).click();
  await expect(page).toHaveURL(/\/apartamento\/30$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Apartamento N°30');
});

test('inicio: buscar fechas en todos los apartamentos', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Entrada/ }).click();
  const hoja = page.getByRole('dialog', { name: 'Elegir fechas' });
  await pickDay(page, iso(3));
  await pickDay(page, iso(5));
  await hoja.getByRole('button', { name: /Ver lo libre/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'libre' })).toContainText('2 noches');
  const card21 = page.getByRole('article').filter({ has: page.getByRole('link', { name: 'Apartamento 21', exact: true }) });
  await expect(card21.getByText('Libre en tus fechas')).toBeVisible();
  await card21.getByRole('link', { name: 'Apartamento 21', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/apartamento/21\\?entrada=${iso(3)}&salida=${iso(5)}`));
  await expect(page.getByText('Libre en esas fechas')).toBeVisible();
});

test('apartamento: precio, fechas sugeridas y reserva por WhatsApp', async ({ page }) => {
  await page.goto('/apartamento/30');
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
  await page.goto('/apartamento/30');
  await pickDay(page, iso(3));
  await pickDay(page, iso(5));
  await expect(page.getByText('ya está ocupado aquí')).toBeVisible();
  const alt = page.locator('#alternativas');
  await expect(alt.getByRole('heading', { name: 'Apartamento 21' })).toBeVisible();
  await expect(alt.getByRole('heading', { name: 'Apartamento 12' })).toHaveCount(0);
  const consultar = alt.getByRole('link', { name: 'Consultar el Apartamento 21 por WhatsApp' });
  expect(new URL((await consultar.getAttribute('href'))!).searchParams.get('text')).toContain('Apartamento 21');
});

test('más personas que la capacidad: primero ofrece pedir la excepción, luego otros apartamentos', async ({ page }) => {
  await page.goto('/apartamento/30');
  for (let i = 0; i < 7; i++) await page.getByRole('button', { name: 'Una persona más' }).click();
  await expect(page.getByText('Este apartamento es para')).toBeVisible();
  await page.getByRole('button', { name: 'Un niño más' }).click();
  await page.getByRole('button', { name: 'Un niño más' }).click();
  const pedir = page.getByRole('link', { name: 'Consultar excepción por WhatsApp' });
  const text = new URL((await pedir.getAttribute('href'))!).searchParams.get('text')!;
  expect(text).toContain('somos 9 personas');
  expect(text).toContain('7 adultos y 2 niños');
  expect(text).toContain('excepción');
  const alt = page.locator('#alternativas');
  await expect(alt).toBeVisible();
  const [yPedir, yAlt] = await Promise.all([pedir.boundingBox(), alt.boundingBox()]);
  expect(yPedir!.y).toBeLessThan(yAlt!.y);
});

test('fotos del N°30: portada, mosaico y fotos a pantalla completa', async ({ page }) => {
  await page.goto('/apartamento/30');
  await expect(page.getByRole('list', { name: 'Datos del apartamento' })).toContainText('2 baños');
  await expect(page.getByText('tanque de agua interno', { exact: false })).toBeVisible();
  const portada = page.locator('.hero-photos img').first();
  await expect(portada).toHaveAttribute('src', '/fotos/n30-01-sala-comedor.jpg');
  expect(await portada.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(960);
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

test('servicios: se ven tres y el resto se despliega', async ({ page }) => {
  await page.goto('/apartamento/30');
  const servicios = page.getByRole('region', { name: 'Lo que incluye' });
  await expect(servicios.locator('.amenities.top .amenity')).toHaveCount(3);
  const mas = servicios.getByRole('button', { name: 'Ver los 10 servicios' });
  await expect(mas).toHaveAttribute('aria-expanded', 'false');
  await expect(servicios.getByText('Televisión')).toBeHidden();
  await mas.click();
  await expect(servicios.getByText('Televisión')).toBeVisible();
  await expect(servicios.getByRole('button', { name: 'Ver menos' })).toHaveAttribute('aria-expanded', 'true');
});

test('el pie tiene WhatsApp, Instagram y Airbnb, y no muestra el acceso al panel', async ({ page }) => {
  for (const path of ['/', '/apartamento/30']) {
    await page.goto(path);
    const pie = page.locator('footer');
    await expect(pie.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', /wa\.me\/584242703482/);
    await expect(pie.getByRole('link', { name: 'Instagram' })).toBeVisible();
    await expect(pie.getByRole('link', { name: 'Ver en Airbnb' })).toBeVisible();
    await expect(page.locator('a[href^="/admin"]')).toHaveCount(0);
  }
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: /^Hola, Oniris/ })).toBeVisible();
});

test('modo noche: se cambia con el botón y se recuerda', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Cambiar a modo noche' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const fondo = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(fondo).toBe('rgb(10, 21, 19)');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.goto('/admin');
  await expect(page.getByRole('button', { name: 'Cambiar a modo día' })).toBeVisible();
});

test('una dirección que no existe muestra cómo volver', async ({ page }) => {
  await page.goto('/apartamento/999');
  await expect(page.getByRole('heading', { name: 'No encontramos esa página' })).toBeVisible();
});
