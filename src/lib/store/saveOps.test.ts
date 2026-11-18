// Regresión: al devolver una garantía ya recibida la base rechazaba el guardado ("Algún dato no tiene
// el formato correcto"), porque un upsert arma la fila completa sin la fecha de recibida.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Call = { op: string; values?: Record<string, unknown> };
const calls: Call[] = [];
let existing = true;

function table() {
  return {
    update(values: Record<string, unknown>) {
      calls.push({ op: 'update', values });
      return { eq: () => ({ select: async () => ({ data: existing ? [{ reservation_id: 'r1' }] : [], error: null }) }) };
    },
    insert: async (values: Record<string, unknown>) => {
      calls.push({ op: 'insert', values });
      return { error: null };
    },
    upsert: async (values: Record<string, unknown>) => {
      calls.push({ op: 'upsert', values });
      return { error: null };
    },
  };
}

vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: () => table() }) }));

describe('guardar tareas y garantía (Supabase)', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.stubEnv('VITE_SUPABASE_URL', 'https://demo.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'sb_publishable_xxxxxxxxxxxxxxxxxxxx');
    vi.resetModules();
  });

  it('devolver una garantía ya recibida actualiza la fila, sin upsert', async () => {
    existing = true;
    const { supabaseStore } = await import('./supabase');
    await supabaseStore.saveOps('r1', { deposit_returned_usd: 100, deposit_returned_at: '2026-11-18T15:00:00Z', note: '' });
    expect(calls.map((c) => c.op)).toEqual(['update']);
    expect(calls[0].values).toMatchObject({ deposit_returned_usd: 100 });
  });

  it('la primera tarea de una estadía crea la fila', async () => {
    existing = false;
    const { supabaseStore } = await import('./supabase');
    await supabaseStore.saveOps('r1', { deposit_usd: 100, keys_at: '2026-11-18T15:00:00Z' });
    expect(calls.map((c) => c.op)).toEqual(['update', 'insert']);
    expect(calls[1].values).toMatchObject({ reservation_id: 'r1', keys_at: '2026-11-18T15:00:00Z' });
  });
});
