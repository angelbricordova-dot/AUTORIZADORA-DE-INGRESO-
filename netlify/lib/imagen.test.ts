import { describe, expect, it } from 'vitest';
import { bearerToken, checkImagePayload, cleanPersonas } from './imagen';

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]).toString('base64');
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47]), Buffer.alloc(400, 7)]).toString('base64');

describe('checkImagePayload', () => {
  it('acepta un JPEG real', () => {
    expect(checkImagePayload({ image: jpeg, media_type: 'image/jpeg' }).ok).toBe(true);
  });
  it('rechaza tipos no permitidos y archivos disfrazados', () => {
    expect(checkImagePayload({ image: jpeg, media_type: 'application/pdf' }).ok).toBe(false);
    expect(checkImagePayload({ image: png, media_type: 'image/jpeg' }).ok).toBe(false);
    expect(checkImagePayload({ image: 'not base64 !!', media_type: 'image/jpeg' }).ok).toBe(false);
    expect(checkImagePayload({ image: 'A'.repeat(6_000_000), media_type: 'image/jpeg' }).ok).toBe(false);
    expect(checkImagePayload(null).ok).toBe(false);
  });
});

describe('cleanPersonas', () => {
  it('limpia y limita lo que devuelve la IA', () => {
    const out = cleanPersonas({
      personas: [
        { nombre: 'Juan <script>Pérez</script>', cedula: 'V-12.345.678; DROP TABLE' },
        { nombre: 42, cedula: null },
        ...Array.from({ length: 10 }, () => ({ nombre: 'Ana', cedula: '1' })),
      ],
    });
    expect(out[0]).toEqual({ nombre: 'Juan script Pérez script', cedula: 'V-12.345.678E' });
    expect(out.length).toBe(6);
  });
  it('tolera basura', () => {
    expect(cleanPersonas('x')).toEqual([]);
  });
});

describe('bearerToken', () => {
  it('extrae el token', () => {
    expect(bearerToken('Bearer abc.def.ghijklmnopqrstuvwxyz')).toBe('abc.def.ghijklmnopqrstuvwxyz');
    expect(bearerToken('Basic xyz')).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
