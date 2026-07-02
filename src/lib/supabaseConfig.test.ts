import { describe, expect, it } from 'vitest';
import { getSupabaseConfig } from './supabaseConfig';

describe('getSupabaseConfig', () => {
  it('accepts a valid Supabase URL and anon key', () => {
    expect(getSupabaseConfig('https://project.supabase.co', 'anon-key')).toEqual({
      isConfigured: true,
      url: 'https://project.supabase.co',
      anonKey: 'anon-key',
    });
  });

  it('trims values from deployment variables', () => {
    expect(getSupabaseConfig('  https://project.supabase.co  ', '  anon-key  ')).toEqual({
      isConfigured: true,
      url: 'https://project.supabase.co',
      anonKey: 'anon-key',
    });
  });

  it('falls back safely when deployment variables are missing', () => {
    expect(getSupabaseConfig(undefined, undefined)).toEqual({
      isConfigured: false,
      url: 'http://localhost:54321',
      anonKey: 'missing-anon-key',
    });
  });

  it('falls back safely instead of crashing on an invalid URL', () => {
    expect(getSupabaseConfig('not a url', 'anon-key')).toEqual({
      isConfigured: false,
      url: 'http://localhost:54321',
      anonKey: 'missing-anon-key',
    });
  });
});
