// Logica pura de gastos (tabla `gastos`).
//
// Extraida de src/pages/api/gastos.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.
//
// Contrato sensible: el MCP expone finanzas_log_gasto y finanzas_listar_gastos
// contra /api/gastos (ver src/mcp/osTools.ts), asi que las claves de respuesta
// (`gastos`, `gasto`) y las validaciones se conservan literales.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseGastos(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface GastoInput {
  fecha?: string;
  categoria?: string;
  descripcion?: string;
  monto?: unknown;
  cuenta?: string;
}

export async function listarGastos(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb
    .from('gastos')
    .select('*')
    .order('fecha', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearGasto(body: GastoInput): Promise<unknown> {
  if (!body.descripcion?.trim() && !(Number(body.monto) > 0)) {
    throw new Error('descripcion o monto requerido');
  }
  const sb = clienteActual();
  const { data, error } = await sb
    .from('gastos')
    .insert([{
      fecha: body.fecha || new Date().toISOString().slice(0, 10),
      categoria: body.categoria?.trim() || null,
      descripcion: body.descripcion?.trim() || null,
      monto: Number(body.monto) || 0,
      cuenta: body.cuenta?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarGasto(id: string, body: Record<string, unknown>): Promise<unknown> {
  const sb = clienteActual();
  const { data, error } = await sb.from('gastos').update(body).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarGasto(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('gastos').delete().eq('id', id);
  if (error) throw error;
}
