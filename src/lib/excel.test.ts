import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { authorizationFileName, buildAuthorizationXlsx, stayTypeLine, validateSheet, type AuthorizationSheet } from './excel';

const template = () => {
  const b = readFileSync(new URL('../assets/plantilla-pescadores.xlsx', import.meta.url));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
};

const base: AuthorizationSheet = {
  emitted: '2026-10-11',
  settings: { owner_name: 'Oniris Rojas', owner_cedula: '17571156', conjunto: 'JDC Pescadores I', unit: '30', admin_whatsapp: '' },
  guests: [
    { full_name: 'Juan Pérez', cedula: '12345678', is_minor: false },
    { full_name: '=HYPERLINK("http://malo")', cedula: '9.876.543', is_minor: false },
    { full_name: 'Sofía Pérez', cedula: '', is_minor: true },
  ],
  vehicles: [{ description: 'Toyota Corolla vinotinto', plate: 'aa046kt' }],
  stayType: 'Alquiler Vacacional',
  checkIn: '2026-10-17',
  checkOut: '2026-10-19',
  notes: 'Llegan tarde',
};

async function read(buf: ArrayBuffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  return wb;
}

describe('buildAuthorizationXlsx', () => {
  it('rellena la planilla oficial conservando logo y formato', async () => {
    const wb = await read(await buildAuthorizationXlsx(template(), base));
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Hoja1']);
    const ws = wb.getWorksheet('Hoja1')!;
    const v = (c: string) => ws.getCell(c).value;
    expect(v('B6')).toBe('JDC Pescadores I');
    expect(v('D10')).toBe('N°30');
    expect(v('B11')).toBe('Yo Oniris Rojas  CI: 17.571.156');
    expect(v('D4')).toBe('     11   /     10   /      26');
    expect(v('C14')).toBe('Juan Pérez');
    expect(v('D14')).toBe('12.345.678');
    // fórmula neutralizada: se escribe como texto, nunca como fórmula
    expect(v('C15')).toBe(`'=HYPERLINK("http://malo")`);
    expect(v('C16')).toBe('Sofía Pérez');
    expect(v('D16')).toBe('Menor de edad');
    expect(v('C17')).toBeNull();
    expect(v('C24')).toBe('Toyota Corolla vinotinto');
    expect(v('D24')).toBe('AA046KT');
    expect(v('B27')).toBe('Familiar____ Alquiler Fijo____ Alquiler Vacacional__x__ Mantenimiento____ Otros____');
    expect(String(v('B30'))).toContain('Fecha Ingreso: 17-10-26');
    expect(String(v('B30'))).toContain('Fecha Egreso: 19-10-26');
    expect(v('B33')).toBe('Llegan tarde');
    expect(ws.getImages()).toHaveLength(1);
    expect(ws.getCell('B6').font?.name).toBe('Tahoma');
  });

  it('rechaza una planilla incompleta', async () => {
    await expect(buildAuthorizationXlsx(template(), { ...base, guests: [] })).rejects.toThrow(/al menos una persona/);
  });
});

describe('validateSheet', () => {
  it('exige cédula a los adultos', () => {
    const e = validateSheet({ ...base, guests: [{ full_name: 'Luis', cedula: '', is_minor: false }] });
    expect(e.join(' ')).toMatch(/Falta la cédula/);
  });
  it('limita a 7 personas', () => {
    const g = Array.from({ length: 8 }, (_, i) => ({ full_name: `Persona ${i}`, cedula: '12345678', is_minor: false }));
    expect(validateSheet({ ...base, guests: g }).join(' ')).toMatch(/máximo 7/);
  });
  it('fechas en orden', () => {
    expect(validateSheet({ ...base, checkOut: '2026-10-16' }).join(' ')).toMatch(/salida debe ser después/);
  });
});

describe('utilidades', () => {
  it('marca el tipo de estadía', () => {
    expect(stayTypeLine('Familiar')).toMatch(/^Familiar__x__ Alquiler Fijo____/);
  });
  it('nombre de archivo sin caracteres raros', () => {
    expect(authorizationFileName({ checkIn: '2026-10-17', guests: [{ full_name: 'José Núñez', cedula: '', is_minor: false }] })).toBe(
      'Autorizacion_Pescadores_17-10-26_Nunez.xlsx',
    );
  });
});
