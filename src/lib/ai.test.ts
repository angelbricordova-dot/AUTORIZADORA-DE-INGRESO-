import { describe, expect, it } from 'vitest';
import { vehiclesFromAI } from './ai';

describe('vehiclesFromAI', () => {
  it('arma la descripción "marca modelo color" y valida la placa', () => {
    expect(vehiclesFromAI({ vehiculos: [{ placa: 'AB123CD', marca: 'Toyota', modelo: 'Corolla', color: 'Vinotinto' }] })).toEqual([
      { description: 'Toyota Corolla vinotinto', plate: 'AB123CD', complete: true },
    ]);
  });
  it('deja la placa vacía si no es válida y conserva el modelo', () => {
    expect(vehiclesFromAI({ vehiculos: [{ placa: '12', marca: 'Chevrolet', modelo: 'Aveo', color: 'blanco' }] })).toEqual([
      { description: 'Chevrolet Aveo blanco', plate: '', complete: false },
    ]);
  });
  it('tolera respuestas vacías o raras', () => {
    expect(vehiclesFromAI(null)).toEqual([]);
    expect(vehiclesFromAI({ vehiculos: [{}] })).toEqual([]);
  });
});
