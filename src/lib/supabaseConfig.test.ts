import { describe, expect, it } from 'vitest';
import { cleanSupabaseKey, cleanSupabaseUrl } from './supabaseConfig';

describe('config de Supabase', () => {
  it('normaliza la URL pegada desde el panel', () => {
    expect(cleanSupabaseUrl(' https://abc.supabase.co/rest/v1/ \n')).toBe('https://abc.supabase.co');
    expect(cleanSupabaseUrl('"https://abc.supabase.co"')).toBe('https://abc.supabase.co');
    expect(cleanSupabaseUrl('abc.supabase.co')).toBeNull();
    expect(cleanSupabaseUrl('http://abc.supabase.co')).toBeNull();
    expect(cleanSupabaseUrl(undefined)).toBeNull();
  });
  it('limpia espacios y saltos de línea de la llave', () => {
    expect(cleanSupabaseKey(' sb_publishable_abcdefghijklmnopqrstuvwxyz \n')).toBe('sb_publishable_abcdefghijklmnopqrstuvwxyz');
    expect(cleanSupabaseKey('corta')).toBeNull();
  });
});
