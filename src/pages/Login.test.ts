import { describe, expect, it } from 'vitest';
import { loginError } from './Login';

describe('loginError', () => {
  it('distingue los casos que el dueño puede arreglar', () => {
    expect(loginError({ status: 400, code: 'invalid_credentials' })).toBe('Correo o contraseña incorrectos.');
    expect(loginError({ status: 400, code: 'email_not_confirmed' })).toMatch(/no está confirmada/);
    expect(loginError({ status: 401, message: 'Invalid API key' })).toMatch(/llave de Supabase/);
    expect(loginError({ status: 429 })).toMatch(/Demasiados intentos/);
    expect(loginError({ message: 'Failed to fetch' })).toMatch(/conexión/);
  });
});
