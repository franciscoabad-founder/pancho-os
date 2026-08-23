// Logica pura de por cobrar (tabla `por_cobrar`).
//
// Extraida de src/pages/api/por-cobrar.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabasePorCobrar(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const ESTADOS_POR_COBRAR = ['aplicando', 'esperando', 'aprobado_sin_pagar', 'cobrado'];

export interface PorCobrarInput {
  cliente?: string;
  proyecto?: string;
  monto?: unknown;
  moneda?: string;
  estado?: string;
  fecha_esperada?: string | null;
  notas?: string;
}

export async function listarPorCobrar(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('por_cobrar').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearPorCobrar(body: PorCobrarInput): Promise<unknown> {
  if (!body.cliente?.trim()) throw new Error('cliente requerido');
  const estado = ESTADOS_POR_COBRAR.includes(body.estado as string) ? body.estado : 'aplicando';
  const sb = clienteActual();
  const { data, error } = await sb
    .from('por_cobrar')
    .insert([{
      cliente: body.cliente.trim(),
      proyecto: body.proyecto?.trim() || null,
      monto: Number(body.monto) || 0,
      moneda: body.moneda?.trim() || 'USD',
      estado,
      fecha_esperada: body.fecha_esperada || null,
      notas: body.notas?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarPorCobrar(id: string, body: Record<string, unknown>): Promise<unknown> {
  if (body.estado !== undefined && !ESTADOS_POR_COBRAR.includes(body.estado as string)) {
    throw new Error('estado invalido');
  }
  const sb = clienteActual();
  const { data, error } = await sb.from('por_cobrar').update(body).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarPorCobrar(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('por_cobrar').delete().eq('id', id);
  if (error) throw error;
}
