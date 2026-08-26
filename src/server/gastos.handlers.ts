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
import { convertirAUsd, normalizarMoneda } from '../lib/finanzas/monedas.ts';
import { obtenerTasas } from './fxRates.ts';

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
  proyecto?: string;
  /** Moneda en la que se pago. Por defecto USD, la base del OS. */
  moneda?: string;
  /** Alias explicitos: si vienen, mandan sobre monto/moneda. */
  monto_original?: unknown;
  moneda_original?: string;
}

/**
 * Resuelve las columnas de moneda de un gasto.
 *
 * `monto` y `moneda` guardan lo que Pancho realmente pago (por ejemplo 370 MXN
 * en un viaje). `monto_usd` es el numero con el que se suma en todo el modulo.
 * Se conserva `monto` como la cifra original para no romper a los consumidores
 * viejos (MCP finanzas_log_gasto y el UI de Astro) que solo leen `monto`.
 */
async function columnasDeMoneda(
  monto: unknown,
  moneda: unknown,
): Promise<Record<string, unknown>> {
  const codigo = normalizarMoneda(moneda);
  const valor = Number(monto) || 0;
  const tasas = await obtenerTasas();
  const conv = convertirAUsd(valor, codigo, tasas);
  return {
    monto: valor,
    moneda: conv.moneda,
    monto_original: valor,
    moneda_original: conv.moneda,
    monto_usd: conv.monto_usd,
    tasa_usd: conv.tasa,
    conversion_aproximada: conv.aproximada,
  };
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
  const montoEntrada = body.monto_original !== undefined ? body.monto_original : body.monto;
  const monedaEntrada = body.moneda_original ?? body.moneda;
  const { data, error } = await sb
    .from('gastos')
    .insert([{
      fecha: body.fecha || new Date().toISOString().slice(0, 10),
      categoria: body.categoria?.trim() || null,
      descripcion: body.descripcion?.trim() || null,
      cuenta: body.cuenta?.trim() || null,
      proyecto: body.proyecto?.trim() || null,
      ...(await columnasDeMoneda(montoEntrada, monedaEntrada)),
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarGasto(id: string, body: Record<string, unknown>): Promise<unknown> {
  const sb = clienteActual();
  // Cambiar el monto o la moneda obliga a recalcular monto_usd: si no, el
  // resumen mensual seguiria sumando la conversion vieja.
  let parche = body;
  if (body.monto !== undefined || body.moneda !== undefined) {
    const sb0 = clienteActual();
    const { data: previo } = await sb0.from('gastos').select('monto, moneda').eq('id', id).maybeSingle();
    const monto = body.monto !== undefined ? body.monto : previo?.monto;
    const moneda = body.moneda !== undefined ? body.moneda : previo?.moneda;
    parche = { ...body, ...(await columnasDeMoneda(monto, moneda)) };
  }
  const { data, error } = await sb.from('gastos').update(parche).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarGasto(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('gastos').delete().eq('id', id);
  if (error) throw error;
}
