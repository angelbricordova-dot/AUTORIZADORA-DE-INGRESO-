import { beforeEach, describe, expect, it, vi } from 'vitest';

// La IA y Supabase se simulan: aquí se prueba el camino completo de la función.
const create = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  class APIError extends Error {
    status = 500;
  }
  class RateLimitError extends APIError {}
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = RateLimitError;
    beta = { messages: { create } };
  }
  return { default: Anthropic };
});
const rpc = vi.fn();
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: async (t: string) => (t.startsWith('ok') ? { data: { user: { id: 'u1' } }, error: null } : { data: { user: null }, error: new Error('x') }) },
    rpc,
  }),
}));

// la ruta va en una variable porque TypeScript no permite importar ".mts" directamente
const modulePath = '../functions/leer-cedula.mts';
const { default: handler } = (await import(/* @vite-ignore */ modulePath)) as { default: (req: Request, ctx: never) => Promise<Response> };

const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(400, 7)]).toString('base64');
const TOKEN = 'ok.' + 'a'.repeat(40);

function post(body: unknown, token = TOKEN) {
  return new Request('https://tudia.example/api/leer-cedula', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, Origin: 'https://tudia.example' },
    body: JSON.stringify(body),
  });
}
const answer = (obj: unknown) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(obj) }] });

beforeEach(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-test';
  process.env.SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'sb_publishable_abcdefghijklmnopqrstuv';
  create.mockReset();
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

describe('función leer-cedula', () => {
  it('lee vehículos: placa, marca, modelo y color, con su propio esquema', async () => {
    create.mockResolvedValue(answer({ vehiculos: [{ placa: 'ab 123 cd', marca: 'Toyota', modelo: 'Corolla', color: 'Vinotinto' }] }));
    const res = await handler(post({ image: jpeg, media_type: 'image/jpeg', kind: 'vehiculo' }), {} as never);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ vehiculos: [{ placa: 'AB123CD', marca: 'Toyota', modelo: 'Corolla', color: 'vinotinto' }] });
    const req = create.mock.calls[0][0];
    expect(req.system).toContain('vehículos');
    expect(Object.keys(req.output_config.format.schema.properties)).toEqual(['vehiculos']);
  });

  it('lee cédulas por defecto', async () => {
    create.mockResolvedValue(answer({ personas: [{ nombre: 'Ana Gil', cedula: 'V-12.345.678' }] }));
    const res = await handler(post({ image: jpeg, media_type: 'image/jpeg' }), {} as never);
    expect(await res.json()).toEqual({ personas: [{ nombre: 'Ana Gil', cedula: 'V-12.345.678' }] });
    expect(Object.keys(create.mock.calls[0][0].output_config.format.schema.properties)).toEqual(['personas']);
  });

  it('exige sesión válida, respeta el límite y valida la imagen', async () => {
    expect((await handler(post({ image: jpeg, media_type: 'image/jpeg' }, 'bad.' + 'a'.repeat(40)), {} as never)).status).toBe(401);
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect((await handler(post({ image: jpeg, media_type: 'image/jpeg', kind: 'vehiculo' }), {} as never)).status).toBe(429);
    expect((await handler(post({ image: 'x', media_type: 'image/jpeg', kind: 'vehiculo' }), {} as never)).status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('si la IA se niega o responde basura, devuelve la lista vacía', async () => {
    create.mockResolvedValue({ stop_reason: 'refusal', content: [] });
    expect(await (await handler(post({ image: jpeg, media_type: 'image/jpeg', kind: 'vehiculo' }), {} as never)).json()).toEqual({ vehiculos: [] });
    create.mockResolvedValue({ stop_reason: 'end_turn', content: [{ type: 'text', text: 'no json' }] });
    expect(await (await handler(post({ image: jpeg, media_type: 'image/jpeg', kind: 'vehiculo' }), {} as never)).json()).toEqual({ vehiculos: [] });
  });
});
