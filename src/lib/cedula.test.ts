import { describe, expect, it } from 'vitest';
import { findCedulaNumber, findPlate, formatCedula, isValidCedula, isValidPlate, parseCedulaOcr, parseGuestText } from './cedula';

describe('formatCedula', () => {
  it('agrupa con puntos', () => {
    expect(formatCedula('12345678')).toBe('12.345.678');
    expect(formatCedula('V-9876543')).toBe('9.876.543');
    expect(formatCedula('v 17.571.156')).toBe('17.571.156');
    expect(formatCedula('C.I: 30.111.222')).toBe('30.111.222');
  });
  it('marca extranjeros', () => {
    expect(formatCedula('E-84123456')).toBe('E-84.123.456');
    expect(formatCedula('84123456')).toBe('E-84.123.456');
  });
  it('valida longitud', () => {
    expect(isValidCedula('12.345.678')).toBe(true);
    expect(isValidCedula('123')).toBe(false);
    expect(isValidCedula('=HYPERLINK("x")')).toBe(false);
    expect(isValidCedula('04141234567')).toBe(false);
  });
});

describe('findCedulaNumber', () => {
  it('encuentra el número en texto libre', () => {
    expect(findCedulaNumber('Mi cédula es V-12.345.678 gracias')).toBe('12.345.678');
    expect(findCedulaNumber('CI 23456789')).toBe('23.456.789');
    expect(findCedulaNumber('V 9 876 543')).toBe('9.876.543');
  });
  it('ignora teléfonos', () => {
    expect(findCedulaNumber('llámame al 04141234567')).toBe('');
  });
});

describe('parseCedulaOcr', () => {
  it('lee una cédula típica', () => {
    const ocr = `REPUBLICA BOLIVARIANA DE VENEZUELA
CEDULA DE IDENTIDAD
V 12.816.045
APELLIDOS MARQUEZ CONTRERAS
NOMBRES NEYLUZ MARYORYE
F. NACIMIENTO 12/03/1975   EDO. CIVIL SOLTERA
F. EXPEDICION 05/2018  F. VENCIMIENTO 05/2028
VENEZOLANA        DIRECTOR`;
    expect(parseCedulaOcr(ocr)).toEqual({ full_name: 'Neyluz Maryorye Marquez Contreras', cedula: '12.816.045' });
  });
  it('tolera errores de OCR en las etiquetas y valores en la línea siguiente', () => {
    const ocr = `REPUBL1CA BOLIVARIANA
V-27.111.333
APELLIDCS
GARCIA DE LA ROSA
NOMBRFS
JOSE LUIS`;
    expect(parseCedulaOcr(ocr)).toEqual({ full_name: 'Jose Luis Garcia de la Rosa', cedula: '27.111.333' });
  });
});

describe('placas', () => {
  it('reconoce formatos venezolanos', () => {
    expect(findPlate('AA046KT')).toBe('AA046KT');
    expect(findPlate('placa: AB 123 CD')).toBe('AB123CD');
    expect(findPlate('ABC12D')).toBe('ABC12D');
    expect(isValidPlate('ab-123-cd')).toBe(true);
    expect(isValidPlate('HOLA')).toBe(false);
  });
});

describe('parseGuestText (mensaje de WhatsApp)', () => {
  it('convierte una lista típica', () => {
    const msg = `Buenas! Aquí van los datos:
1. Juan Pérez V-12.345.678
2. María José Gómez 23456789
3- Pedro Luis Rodríguez C.I: 18.234.567
4. Sofía Pérez (niña de 8 años)
Toyota Corolla vinotinto placa AA046KT`;
    const r = parseGuestText(msg);
    expect(r.guests).toEqual([
      { full_name: 'Juan Pérez', cedula: '12.345.678', is_minor: false },
      { full_name: 'María José Gómez', cedula: '23.456.789', is_minor: false },
      { full_name: 'Pedro Luis Rodríguez', cedula: '18.234.567', is_minor: false },
      { full_name: 'Sofía Pérez', cedula: '', is_minor: true },
    ]);
    expect(r.vehicles).toEqual([{ description: 'Toyota Corolla vinotinto', plate: 'AA046KT' }]);
  });

  it('une nombre y número en líneas separadas', () => {
    const r = parseGuestText(`Ana Karina Lopez\n15.678.901\nLuis Lopez\n16789012`);
    expect(r.guests).toEqual([
      { full_name: 'Ana Karina Lopez', cedula: '15.678.901', is_minor: false },
      { full_name: 'Luis Lopez', cedula: '16.789.012', is_minor: false },
    ]);
  });

  it('acepta solo números (el nombre se completa luego)', () => {
    const r = parseGuestText(`12345678\n9876543`);
    expect(r.guests.map((g) => g.cedula)).toEqual(['12.345.678', '9.876.543']);
    expect(r.guests[0].full_name).toBe('');
  });

  it('no deja pasar fórmulas ni HTML', () => {
    const r = parseGuestText(`=cmd|' /C calc'!A0 12345678\n<script>alert(1)</script> Juan 9876543`);
    for (const g of r.guests) {
      expect(g.full_name).not.toMatch(/[=<>|!]/);
    }
  });
});
