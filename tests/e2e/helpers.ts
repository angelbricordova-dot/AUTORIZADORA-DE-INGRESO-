import { expect, type Page } from '@playwright/test';

export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    // Tesseract escribe su diagnóstico interno por stderr ("Estimating resolution…"): no es un error
    if (m.type() === 'error' && !/^Estimating resolution/.test(m.text())) errors.push(m.text());
  });
  return errors;
}

export function iso(daysFromToday: number): string {
  const t = new Date();
  const x = new Date(t.getFullYear(), t.getMonth(), t.getDate() + daysFromToday);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Toca un día en el calendario público, avanzando de mes si hace falta. */
export async function pickDay(page: Page, day: string) {
  const [, m, d] = day.split('-').map(Number);
  const name = new RegExp(`^${d} de ${MESES[m - 1]}`);
  for (let i = 0; i < 3; i++) {
    const btn = page.getByRole('button', { name });
    if (await btn.count()) {
      await btn.first().click();
      return;
    }
    await page.getByRole('button', { name: 'Mes siguiente' }).click();
  }
  throw new Error(`No encontré el día ${day}`);
}

export async function resetDemo(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
}

export function noErrors(errors: string[]) {
  expect(errors, errors.join('\n')).toEqual([]);
}

/** Genera la "foto" de una o dos cédulas sintéticas. */
export async function cedulaPhoto(page: Page, layout: 'una' | 'apiladas' | 'lado'): Promise<Buffer> {
  const card = (num: string, ap: string, no: string) => `<div style="width:900px;height:560px;background:linear-gradient(135deg,#e9d98f,#cdb86a);font-family:Arial;padding:28px;box-sizing:border-box;color:#111;flex:none">
    <div style="font-size:30px;font-weight:bold">REPUBLICA BOLIVARIANA DE VENEZUELA</div>
    <div style="font-size:30px;font-weight:bold;margin-bottom:18px">CEDULA DE IDENTIDAD</div>
    <div style="font-size:56px;font-weight:bold;margin-bottom:22px">V ${num}</div>
    <div style="font-size:30px">APELLIDOS <b>${ap}</b></div>
    <div style="font-size:30px;margin-top:10px">NOMBRES <b>${no}</b></div>
    <div style="font-size:22px;margin-top:18px">F. NACIMIENTO 12/03/1975 EDO. CIVIL SOLTERA</div></div>`;
  const a = card('12.816.045', 'MARQUEZ CONTRERAS', 'NEYLUZ MARYORYE');
  const b = card('23.456.789', 'GOMEZ PEREZ', 'MARIA JOSE');
  const html =
    layout === 'una'
      ? a
      : `<div style="display:flex;gap:40px;padding:30px;background:#777;flex-direction:${layout === 'apiladas' ? 'column' : 'row'};width:max-content">${a}${b}</div>`;
  const scratch = await page.context().newPage();
  await scratch.setContent(`<body style="margin:0"><div id="c" style="width:max-content">${html}</div></body>`);
  const png = await scratch.locator('#c').screenshot();
  await scratch.close();
  return png;
}
