import { describe, expect, it } from 'vitest';
import { fromBase64Url, generatePushSetup, sha256Hex, toBase64Url } from './pushKeys';

describe('llaves de los avisos', () => {
  it('base64url ida y vuelta', () => {
    const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
    const s = toBase64Url(bytes);
    expect(s).not.toMatch(/[+/=]/);
    expect(Array.from(fromBase64Url(s))).toEqual(Array.from(bytes));
  });
  it('huella SHA-256 igual a la de Postgres', async () => {
    expect(await sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('genera llaves con el formato que espera el servidor', async () => {
    const s = await generatePushSetup();
    expect(s.publicKey).toMatch(/^[A-Za-z0-9_-]{80,100}$/);
    expect(fromBase64Url(s.publicKey)[0]).toBe(4);
    expect(s.privateKey).toMatch(/^[A-Za-z0-9_-]{40,50}$/);
    expect(s.secret.length).toBeGreaterThanOrEqual(24);
    expect(s.sql).toContain(await sha256Hex(s.secret));
    expect(s.sql).not.toContain(s.secret);
  });
});
