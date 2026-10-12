import { describe, expect, it } from 'vitest';
import { importFormsCsv, parseCsv, parseNights, parseStamp } from './formsImport';

// Encabezados reales del formulario anterior (columna M al final, como lo exporta Google)
const CSV = [
  'Marca temporal,¿Cuántas noches te quedaste con nosotros?,"En una escala del 1 al 5 ¿Qué tan limpio encontraste el apartamento al llegar?",¿Qué tan cómodas fueron las camas?,¿Cómo estuvo la temperatura y funcionamiento de los A/C?,¿La cocina tenía todo lo que necesitaste?,¿Cómo estuvo el wifi?,¿Qué tan clara fue la comunicación con nosotros antes y durante tu estadía?,¿qué tan probable es que recomiendes el apto a un familiar o amigo?,¿Qué fue lo que MÁS te gustó?,"¿Qué mejorarías? Sé directo, no te preocupes por herirnos — así crecemos.",¿Nos das permiso de usar tu respuesta anterior como testimonio en nuestras redes?,"Si faltó algo, cuéntanos qué"',
  '17/9/2026 12:36:15,1,5,5,5,"Si, todo",5,5,10,"La temática del lugar, la decoración",Nos gustó todo,Si,Nada',
  '12/10/2026 16:58:36,Dos noches,5,4,5,"Si, todo",5,5,10,La comodidad,Todo súper bien,Si,',
].join('\n');

describe('importar respuestas del Google Form', () => {
  it('lee las respuestas con sus notas, fecha y permiso', () => {
    const out = importFormsCsv(CSV);
    expect(out).toHaveLength(2);
    expect(out[0].created_at).toBe('2026-09-17T12:36:15-04:00');
    expect(out[0].input).toMatchObject({
      nights: 1, cleanliness: 5, beds: 5, ac: 5, wifi: 5, communication: 5, kitchen_ok: true, kitchen_missing: '', recommend: 10,
      liked: 'La temática del lugar, la decoración', improve: 'Nos gustó todo', permission: 'si',
    });
    expect(out[1].input).toMatchObject({ nights: 2, beds: 4, liked: 'La comodidad', improve: 'Todo súper bien', permission: 'si' });
  });
  it('entiende noches escritas y fechas día/mes/año', () => {
    expect(parseNights('Dos noches')).toBe(2);
    expect(parseNights('3')).toBe(3);
    expect(parseNights('')).toBeNull();
    expect(parseStamp('5/1/2027 9:05:00')).toBe('2027-01-05T09:05:00-04:00');
  });
  it('soporta comillas y saltos de línea dentro de un campo', () => {
    expect(parseCsv('a,"b, c","d\n e"\n1,2,3')).toEqual([['a', 'b, c', 'd\n e'], ['1', '2', '3']]);
  });
  it('si no es el archivo del formulario, no importa nada', () => {
    expect(importFormsCsv('nombre,edad\nAna,3')).toEqual([]);
  });
});
