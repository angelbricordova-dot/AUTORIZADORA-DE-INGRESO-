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

test('más personas que la capacidad: avisa y busca alternativas', async ({ page }) => {
  await page.goto('/');
  for (let i = 0; i < 6; i++) await page.getByRole('button', { name: 'Una persona más' }).click();
  await expect(page.getByText('máximo 7 personas')).toBeVisible();
});

test('el panel tiene enlace desde la página', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Administración' }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: /^Hola, Oniris/ })).toBeVisible();
});
