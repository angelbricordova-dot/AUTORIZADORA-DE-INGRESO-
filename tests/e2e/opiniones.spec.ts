import { expect, test, type Page } from '@playwright/test';
import { noErrors, resetDemo, watchErrors } from './helpers';

let errors: string[] = [];
test.beforeEach(async ({ page }) => {
  errors = watchErrors(page);
  await resetDemo(page);
});
test.afterEach(() => noErrors(errors));

async function answer(page: Page, o: { liked: string; improve: string; name?: string; permiso?: 'Sí' | 'No' | 'Solo si me consultan antes' }) {
  await page.goto('/opinion?apto=30');
  await expect(page.getByRole('heading', { name: 'Ayúdanos a mejorar tu próxima estadía' })).toBeVisible();
  await page.getByRole('button', { name: 'Una noche más' }).click();
  await page.getByRole('button', { name: 'Una noche más' }).click();
  for (const a of ['Limpieza', 'Camas', 'Aire acondicionado', 'WiFi', 'Comunicación']) {
    await page.getByRole('radiogroup', { name: a }).getByRole('radio', { name: '5 de 5' }).click();
  }
  await page.getByRole('radio', { name: 'Sí, todo' }).check();
  await page.getByRole('radiogroup', { name: 'Del 1 al 10' }).getByRole('radio', { name: '10' }).click();
  await page.getByLabel('¿Qué fue lo que MÁS te gustó?').fill(o.liked);
  await page.getByLabel(/¿Qué mejorarías\?/).fill(o.improve);
  await page.getByRole('radio', { name: o.permiso ?? 'Sí', exact: true }).check();
  if (o.name) await page.getByLabel(/Tu nombre/).fill(o.name);
  await page.waitForTimeout(3100); // la encuesta ignora envíos de robots hechos en menos de 3 s
  await page.getByRole('button', { name: 'Enviar mi opinión' }).click();
  await expect(page.getByRole('heading', { name: '¡Gracias por contarnos!' })).toBeVisible();
}

test('encuesta: el huésped opina, el panel la publica y aparece en la página sin lo privado', async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Dejar mi opinión' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lo que dicen nuestros huéspedes' })).toHaveCount(0);

  await answer(page, { liked: 'La decoración y la piscina', improve: 'Más toallas de playa', name: 'María Gómez' });

  await page.goto('/admin/mas');
  await page.getByRole('link', { name: /Opiniones de huéspedes/ }).click();
  const card = page.getByRole('article', { name: 'Opinión de María Gómez' });
  await expect(card.getByText('Más toallas de playa')).toBeVisible();
  await expect(card.getByText('Dio permiso para publicarla')).toBeVisible();
  await card.getByLabel('Respuesta pública (opcional)').fill('¡Gracias María! Te esperamos.');
  await card.getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Publicada en la página')).toBeVisible();

  await page.goto('/');
  const resenas = page.getByRole('region', { name: 'Lo que dicen nuestros huéspedes' });
  await expect(resenas.getByText('La decoración y la piscina')).toBeVisible();
  await expect(resenas.getByText('María G.')).toBeVisible();
  await expect(resenas.getByText('¡Gracias María! Te esperamos.')).toBeVisible();
  await expect(page.getByText('Más toallas de playa')).toHaveCount(0);
  await expect(page.getByText('María Gómez')).toHaveCount(0);
});

test('sin permiso del huésped no se puede publicar', async ({ page }) => {
  test.setTimeout(60_000);
  await answer(page, { liked: 'Todo', improve: 'El agua caliente', permiso: 'No' });
  await page.goto('/admin/opiniones');
  const card = page.getByRole('article', { name: 'Opinión de un huésped' });
  await expect(card.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  await expect(card.getByText('el huésped no dio permiso')).toBeVisible();
});

test('la única pregunta obligatoria es qué mejorarías', async ({ page }) => {
  await page.goto('/opinion');
  await page.waitForTimeout(3100);
  await page.getByLabel(/Tu nombre/).fill('Ana');
  await page.getByRole('button', { name: 'Enviar mi opinión' }).click();
  await expect(page.getByRole('alert')).toContainText('qué mejorarías');
});

test('importar las respuestas del Google Form anterior', async ({ page }) => {
  const csv = [
    'Marca temporal,¿Cuántas noches te quedaste con nosotros?,En una escala del 1 al 5 ¿Qué tan limpio encontraste el apartamento al llegar?,¿Qué tan cómodas fueron las camas?,¿Cómo estuvo la temperatura y funcionamiento de los A/C?,¿La cocina tenía todo lo que necesitaste?,¿Cómo estuvo el wifi?,¿Qué tan clara fue la comunicación con nosotros antes y durante tu estadía?,¿qué tan probable es que recomiendes el apto a un familiar o amigo?,¿Qué fue lo que MÁS te gustó?,¿Qué mejorarías?,¿Nos das permiso de usar tu respuesta anterior como testimonio en nuestras redes?,"Si faltó algo, cuéntanos qué"',
    '17/9/2026 12:36:15,1,5,5,5,"Si, todo",5,5,10,La temática del lugar,Nos gustó todo,Si,Nada',
    '12/10/2026 16:58:36,Dos noches,5,4,5,"Si, todo",5,5,10,La comodidad,Todo súper bien,Si,',
  ].join('\n');
  await page.goto('/admin/opiniones');
  await page.getByText('Importar del formulario anterior (Google)').click();
  await page.locator('input[type=file][accept*=csv]').setInputFiles({ name: 'respuestas.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await expect(page.getByText('Encontré 2 respuestas, 2 con permiso para publicar.')).toBeVisible();
  await page.getByRole('button', { name: 'Importar' }).click();
  await expect(page.getByText('Importé 2 respuestas', { exact: false })).toBeVisible();
  const cards = page.getByRole('article', { name: 'Opinión de un huésped' });
  await expect(cards).toHaveCount(2);
  await cards.filter({ hasText: 'La comodidad' }).getByRole('button', { name: 'Publicar' }).click();
  await expect(page.getByText('Publicada en la página')).toBeVisible();
  await page.goto('/apartamento/30');
  const resenas = page.getByRole('region', { name: 'Opiniones de quienes se quedaron aquí' });
  await expect(resenas.getByText('La comodidad')).toBeVisible();
  await expect(resenas.getByText('Huésped', { exact: true })).toBeVisible();
});
