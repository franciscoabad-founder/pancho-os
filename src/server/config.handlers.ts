// Logica pura de configuracion generica del OS (tabla `os_config`,
// clave-valor). Primer consumidor: `bottom_nav`, el array de hrefs que Pancho
// elige para el bottom-nav movil de OSLayout.tsx.
//
// Mismo molde que notas.handlers.ts: handler puro + seam de test via
// setClienteSupabaseConfig.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseConfig(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

// Formato reservado a texto simple: kebab-case, sin espacios. Evita que la
// key termine siendo una ruta de ataque hacia otra tabla (esto va directo a
// un .eq('key', ...), no a SQL crudo, pero igual vale la pena no aceptar
// cualquier cosa).
const KEY_VALIDA = /^[a-z][a-z0-9_-]{0,63}$/;

export function normalizarConfigKey(key: string | undefined | null): string {
  const k = (key ?? '').trim();
  if (!KEY_VALIDA.test(k)) throw new Error('key invalida');
  return k;
}

export interface ConfigRow {
  key: string;
  value: unknown;
  updated_at: string;
}

export async function obtenerConfig(key: string): Promise<ConfigRow | null> {
  const k = normalizarConfigKey(key);
  const sb = clienteActual();
  const { data, error } = await sb.from('os_config').select('*').eq('key', k).maybeSingle();
  if (error) throw error;
  return (data as ConfigRow | null) ?? null;
}

export async function guardarConfig(key: string, value: unknown): Promise<ConfigRow> {
  const k = normalizarConfigKey(key);
  if (value === undefined) throw new Error('value requerido');
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_config')
    .upsert({ key: k, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .single();
  if (error) throw error;
  return data as ConfigRow;
}
