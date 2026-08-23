// Logica pura de por pagar (tabla `por_pagar`).
//
// Por que una tabla nueva y no extender `deudas`:
//
// `deudas` modela deuda de largo plazo amortizada: tiene `acreedor`, `tasa`,
// `cuota` y `fecha_limite`, y su ciclo de vida es activa/pagada durante meses o
// anos. Meter ahi un "le debo 80 USD a Juan por la cena" ensucia el total de
// deuda (que alimenta el patrimonio neto) con obligaciones puntuales, y deja
// `tasa` y `cuota` siempre vacias.
//
// `por_pagar` es el espejo exacto de `por_cobrar`: montos puntuales a personas
// o servicios, con moneda propia y un estado corto. Al ser simetrica, el
// handler, la ruta y el UI se copian del patron ya probado de por_cobrar en vez
// de inventar un tercer modelo. En el resumen, `por_cobrar` es dinero por
// entrar y `por_pagar` dinero por salir; `deudas` sigue siendo el pasivo
// estructural.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { normalizarMoneda } from '../lib/finanzas/monedas.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabasePorPagar(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const ESTADOS_POR_PAGAR = ['pendiente', 'comprometido', 'pagado'];

export interface PorPagarInput {
  beneficiario?: string;
  concepto?: string;
  monto?: unknown;
  moneda?: string;
  estado?: string;
  fecha_limite?: string | null;
  notas?: string;
}

export async function listarPorPagar(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('por_pagar').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearPorPagar(body: PorPagarInput): Promise<unknown> {
  if (!body.beneficiario?.trim()) throw new Error('beneficiario requerido');
  const estado = ESTADOS_POR_PAGAR.includes(body.estado as string) ? body.estado : 'pendiente';
  const sb = clienteActual();
  const { data, error } = await sb
    .from('por_pagar')
    .insert([{
      beneficiario: body.beneficiario.trim(),
      concepto: body.concepto?.trim() || null,
      monto: Number(body.monto) || 0,
      moneda: normalizarMoneda(body.moneda),
      estado,
      fecha_limite: body.fecha_limite || null,
      notas: body.notas?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarPorPagar(id: string, body: Record<string, unknown>): Promise<unknown> {
  if (body.estado !== undefined && !ESTADOS_POR_PAGAR.includes(body.estado as string)) {
    throw new Error('estado invalido');
  }
  const sb = clienteActual();
  const { data, error } = await sb.from('por_pagar').update(body).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarPorPagar(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('por_pagar').delete().eq('id', id);
  if (error) throw error;
}
