// Tasas de cambio del dia, cacheadas en la tabla `fx_rates`.
//
// Fuente: open.er-api.com (gratuita, sin API key, actualiza una vez al dia).
// Politica de cache: una fila por fecha. El primer gasto del dia dispara el
// fetch y guarda la tabla completa en jsonb; el resto del dia se sirve desde
// Postgres. Si la API falla, obtenerTasas devuelve null y quien convierte cae
// al respaldo estatico de src/lib/finanzas/monedas.ts marcando la conversion
// como aproximada. Nunca se lanza: registrar un gasto no puede romperse porque
// una API externa este caida.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { MONEDA_BASE } from '../lib/finanzas/monedas.ts';

const FUENTE = 'open.er-api.com';
const URL_API = `https://open.er-api.com/v6/latest/${MONEDA_BASE}`;
const TIMEOUT_MS = 4000;

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseFx(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

/** Memoria de proceso: evita ir a Postgres en cada gasto dentro del mismo dia. */
let memoria: { fecha: string; tasas: Record<string, number> } | null = null;

export function limpiarCacheFx(): void {
  memoria = null;
}

const hoyISO = (): string => new Date().toISOString().slice(0, 10);

async function traerDeApi(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(URL_API, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (data.result !== 'success' || !data.rates || typeof data.rates !== 'object') return null;
    // Sanidad minima: la tabla debe traer la base en 1 y varias monedas.
    if (data.rates[MONEDA_BASE] !== 1 || Object.keys(data.rates).length < 10) return null;
    return data.rates;
  } catch {
    return null;
  }
}

/**
 * Devuelve la tabla de tasas (unidades por USD) del dia, o null si no hay
 * ninguna disponible. Quien llama decide el respaldo estatico.
 */
export async function obtenerTasas(): Promise<Record<string, number> | null> {
  const fecha = hoyISO();
  if (memoria && memoria.fecha === fecha) return memoria.tasas;

  const sb = clienteActual();

  try {
    const { data } = await sb.from('fx_rates').select('tasas').eq('fecha', fecha).maybeSingle();
    const guardadas = data?.tasas as Record<string, number> | undefined;
    if (guardadas && Object.keys(guardadas).length) {
      memoria = { fecha, tasas: guardadas };
      return guardadas;
    }
  } catch {
    // Tabla ausente o Postgres caido: seguimos al fetch directo.
  }

  const frescas = await traerDeApi();
  if (!frescas) return null;

  try {
    await sb.from('fx_rates').upsert({ fecha, base: MONEDA_BASE, tasas: frescas, fuente: FUENTE }, { onConflict: 'fecha' });
  } catch {
    // Cachear es una optimizacion, no un requisito: si falla igual devolvemos.
  }

  memoria = { fecha, tasas: frescas };
  return frescas;
}
