// Logica pura de deudas (tabla `deudas`).
//
// Extraida de src/pages/api/deudas.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseDeudas(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface DeudaInput {
  acreedor?: string;
  monto?: unknown;
  tasa?: unknown;
  cuota?: unknown;
  fecha_limite?: string | null;
  estado?: string;
  notas?: string;
}

export async function listarDeudas(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('deudas').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearDeuda(body: DeudaInput): Promise<unknown> {
  if (!body.acreedor?.trim()) throw new Error('acreedor requerido');
  const sb = clienteActual();
  const { data, error } = await sb
    .from('deudas')
    .insert([{
      acreedor: body.acreedor.trim(),
      monto: Number(body.monto) || 0,
      tasa: body.tasa === '' || body.tasa == null ? null : Number(body.tasa),
      cuota: body.cuota === '' || body.cuota == null ? null : Number(body.cuota),
      fecha_limite: body.fecha_limite || null,
      estado: body.estado?.trim() || 'activa',
      notas: body.notas?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarDeuda(id: string, body: Record<string, unknown>): Promise<unknown> {
  const sb = clienteActual();
  const { data, error } = await sb.from('deudas').update(body).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarDeuda(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('deudas').delete().eq('id', id);
  if (error) throw error;
}
