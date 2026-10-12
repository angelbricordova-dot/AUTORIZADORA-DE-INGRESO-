import { describe, expect, it } from 'vitest';
import { nameFromEmail } from './types';

describe('nameFromEmail', () => {
  it('saca un nombre legible del correo', () => {
    expect(nameFromEmail('alejandro.rojas93@gmail.com')).toBe('Alejandro');
    expect(nameFromEmail('ONIRIS_r@hotmail.com')).toBe('Oniris');
    expect(nameFromEmail('123@x.com')).toBe('');
  });
});
