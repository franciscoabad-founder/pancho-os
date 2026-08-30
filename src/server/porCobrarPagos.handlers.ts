import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;
export function setClienteSupabasePorCobrarPagos(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export interface PagoPorCobrarInput { por_cobrar_id?: string; monto?: unknown; moneda?: string; fecha?: string; notas?: string; }

export async function listarPagosPorCobrar(id?: string): Promise<unknown[]> {
  const query = clienteActual().from('por_cobrar_pagos').select('*').order('fecha', { ascending: false });
  const { data, error } = id ? await query.eq('por_cobrar_id', id) : await query;
  if (error) throw error;
  return data ?? [];
}

export async function crearPagoPorCobrar(body: PagoPorCobrarInput): Promise<unknown> {
  if (!body.por_cobrar_id) throw new Error('por_cobrar_id requerido');
  const monto = Number(body.monto);
  if (!Number.isFinite(monto) || monto <= 0) throw new Error('monto invalido');
  const sb = clienteActual();
  const { data: cuenta, error: cuentaError } = await sb.from('por_cobrar').select('id,monto,moneda,estado').eq('id', body.por_cobrar_id).single();
  if (cuentaError) throw cuentaError;
  const { data: pagos, error: pagosError } = await sb.from('por_cobrar_pagos').select('monto,moneda').eq('por_cobrar_id', body.por_cobrar_id);
  if (pagosError) throw pagosError;
  const moneda = (body.moneda?.trim() || cuenta.moneda || 'USD').toUpperCase();
  const total = (pagos ?? []).filter((p) => String(p.moneda || 'USD').toUpperCase() === moneda).reduce((s, p) => s + Number(p.monto || 0), 0);
  if (total + monto > Number(cuenta.monto || 0) + 0.000001) throw new Error('pago excede saldo');
  const { data, error } = await sb.from('por_cobrar_pagos').insert([{ por_cobrar_id: body.por_cobrar_id, monto, moneda, fecha: body.fecha || new Date().toISOString().slice(0, 10), notas: body.notas?.trim() || null }]).select().single();
  if (error) throw error;
  if (total + monto >= Number(cuenta.monto || 0) && cuenta.estado !== 'cobrado') {
    await sb.from('por_cobrar').update({ estado: 'cobrado' }).eq('id', body.por_cobrar_id);
  }
  return data;
}

export async function eliminarPagoPorCobrar(id: string): Promise<void> {
  const { error } = await clienteActual().from('por_cobrar_pagos').delete().eq('id', id);
  if (error) throw error;
}
