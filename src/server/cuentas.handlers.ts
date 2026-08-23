// Logica pura de cuentas (tabla `cuentas`).
//
// Extraida de src/pages/api/cuentas.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { normalizarMoneda } from '../lib/finanzas/monedas.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseCuentas(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

/**
 * Tipos de cuenta que maneja Pancho. `compartida` cubre las cuentas con su
 * mama: no es un banco distinto, es una cuenta cuyo saldo no es 100% suyo,
 * asi que se marca aparte y se acompana de `compartida_con`.
 */
export const TIPOS_CUENTA = ['banco', 'wallet_crypto', 'exchange', 'fintech', 'efectivo', 'compartida'] as const;

/**
 * `bloqueada` existe por el banco en Ecuador congelado por una coactiva: la
 * cuenta sigue existiendo y hay que verla, pero su saldo no es dinero
 * disponible.
 */
export const ESTADOS_CUENTA = ['activa', 'bloqueada', 'cerrada'] as const;

export interface CuentaInput {
  nombre?: string;
  tipo?: string;
  saldo?: unknown;
  moneda?: string;
  notas?: string;
  estado?: string;
  compartida_con?: string;
}

export async function listarCuentas(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data, error } = await sb.from('cuentas').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function crearCuenta(body: CuentaInput): Promise<unknown> {
  if (!body.nombre?.trim()) throw new Error('nombre requerido');
  const tipo = body.tipo?.trim().toLowerCase() || null;
  if (tipo && !(TIPOS_CUENTA as readonly string[]).includes(tipo)) throw new Error('tipo invalido');
  const estado = body.estado?.trim().toLowerCase() || 'activa';
  if (!(ESTADOS_CUENTA as readonly string[]).includes(estado)) throw new Error('estado invalido');

  const sb = clienteActual();
  const { data, error } = await sb
    .from('cuentas')
    .insert([{
      nombre: body.nombre.trim(),
      tipo,
      // El saldo es y sigue siendo manual: Pancho no quiere sincronizacion
      // automatica con Metamask, Binance ni ningun banco.
      saldo: Number(body.saldo) || 0,
      moneda: normalizarMoneda(body.moneda),
      estado,
      compartida_con: body.compartida_con?.trim() || null,
      notas: body.notas?.trim() || null,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function actualizarCuenta(id: string, body: Record<string, unknown>): Promise<unknown> {
  if (body.tipo !== undefined && body.tipo !== null && !(TIPOS_CUENTA as readonly string[]).includes(String(body.tipo))) {
    throw new Error('tipo invalido');
  }
  if (body.estado !== undefined && !(ESTADOS_CUENTA as readonly string[]).includes(String(body.estado))) {
    throw new Error('estado invalido');
  }
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
