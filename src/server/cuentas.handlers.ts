// Logica pura de cuentas (tabla `cuentas`).
//
// Extraida de src/pages/api/cuentas.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseCuentas(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface CuentaInput {
  nombre?: string;
  tipo?: string;
  saldo?: unknown;
  moneda?: string;
  notas?: string;
}

export async function listarCuentas(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('cuentas').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearCuenta(body: CuentaInput): Promise<unknown> {
  if (!body.nombre?.trim()) throw new Error('nombre requerido');
  const sb = clienteActual();
  const { data, error } = await sb
    .from('cuentas')
    .insert([{
      nombre: body.nombre.trim(),
      tipo: body.tipo?.trim() || null,
      saldo: Number(body.saldo) || 0,
      moneda: body.moneda?.trim() || 'MXN',
      notas: body.notas?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarCuenta(id: string, body: Record<string, unknown>): Promise<unknown> {
  const sb = clienteActual();
  const { data, error } = await sb.from('cuentas').update(body).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarCuenta(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('cuentas').delete().eq('id', id);
  if (error) throw error;
}
