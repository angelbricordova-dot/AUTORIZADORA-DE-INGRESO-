import { describe, expect, it } from 'vitest';
import { avisoDelDia, avisoNuevaEstadia, avisoPrueba, diaCorto, hoyEnCaracas } from './avisos';

describe('avisos para Zuleika', () => {
  it('estadía nueva: cuándo llega, noches y personas', () => {
    expect(avisoNuevaEstadia({ unit: '30', check_in: '2026-10-15', check_out: '2026-10-17', people: 3 }, '2026-10-12')).toEqual({
      title: 'Nuevo huésped en el N°30',
      body: 'Llega jue 15 oct · 2 noches · 3 personas. Toca para ver tus tareas.',
      url: '/trabajo',
      tag: 'estadia-2026-10-15',
    });
    expect(avisoNuevaEstadia({ unit: '30', check_in: '2026-10-12', check_out: '2026-10-13', people: 0 }, '2026-10-12').body).toBe('Llega hoy · 1 noche. Toca para ver tus tareas.');
    expect(avisoNuevaEstadia({ unit: '30', check_in: '2026-10-13', check_out: '2026-10-15', people: 1 }, '2026-10-12').body).toBe('Llega mañana · 2 noches · 1 persona. Toca para ver tus tareas.');
    expect(avisoPrueba().url).toBe('/trabajo');
  });
  it('recordatorio de la mañana', () => {
    expect(avisoDelDia({ unit: '30', arrivals: 1, departures: 1, arrivals_tomorrow: 0 }, '2026-10-12')!.body).toBe(
      'Se va 1 grupo y llega 1 grupo. Toca para ver: revisar y devolver la garantía, limpiar y lavar la lencería; dejar todo limpio y entregar las llaves.',
    );
    expect(avisoDelDia({ unit: '30', arrivals: 0, departures: 0, arrivals_tomorrow: 1 }, '2026-10-12')!.title).toBe('Mañana llega un grupo al N°30');
    expect(avisoDelDia({ unit: '30', arrivals: 0, departures: 0, arrivals_tomorrow: 0 }, '2026-10-12')).toBeNull();
    // un familiar de Oniris: solo entregar las llaves, sin limpieza
    expect(avisoDelDia({ unit: '30', arrivals: 0, departures: 0, arrivals_tomorrow: 0, family_arrivals: 1 }, '2026-10-12')!.body).toBe(
      'Llega un familiar de Oniris. Toca para ver: entregar las llaves.',
    );
  });
  it('fechas en hora de Venezuela', () => {
    expect(diaCorto('2026-10-15')).toBe('jue 15 oct');
    // 2 a. m. UTC del 13 = 10 p. m. del 12 en Caracas
    expect(hoyEnCaracas(new Date('2026-10-13T02:00:00Z'))).toBe('2026-10-12');
  });
});
