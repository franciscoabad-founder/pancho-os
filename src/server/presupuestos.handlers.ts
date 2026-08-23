// Logica pura de presupuestos (tabla `presupuestos`).
//
// Extraida de src/pages/api/presupuestos.ts (Astro) para reusarse desde la
// server route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabasePresupuestos(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface PresupuestoInput {
  categoria?: string;
  limite_mensual?: unknown;
}

export async function listarPresupuestos(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('presupuestos').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearPresupuesto(body: PresupuestoInput): Promise<unknown> {
  if (!body.categoria?.trim()) throw new Error('categoria requerida');
  const sb = clienteActual();
  const { data, error } = await sb
    .from('presupuestos')
    .insert([{
      categoria: body.categoria.trim(),
      limite_mensual: Number(body.limite_mensual) || 0,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarPresupuesto(id: string, body: Record<string, unknown>): Promise<unknown> {
  const sb = clienteActual();
  const { data, error } = await sb.from('presupuestos').update(body).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarPresupuesto(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('presupuestos').delete().eq('id', id);
  if (error) throw error;
}
