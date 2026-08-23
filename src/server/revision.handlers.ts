// Logica pura de os_revisiones: contenido jsonb libre para weekly/monthly review
// y el reset de 90 dias, indexado por (tipo, periodo).
//
// Extraida de src/pages/api/revision.ts (Astro) para reusarse desde la server
// route de TanStack Start. No depende de Astro ni del framework: nada de
// APIContext, Request ni Response.
//
// Los errores de validacion viajan como ErrorRevision con su status HTTP para
// que src/routes/api/revision.ts reproduzca exactamente los mismos codigos que
// devolvia la version Astro (400 de validacion, 502 para fallos de Supabase).

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';

// Seam para tests: en produccion siempre resuelve a getSupabaseServer.
let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseRevision(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const TIPOS = ['semanal', 'mensual', 'reset90'];

export class ErrorRevision extends Error {
  status: number;
  constructor(mensaje: string, status: number) {
    super(mensaje);
    this.status = status;
    this.name = 'ErrorRevision';
  }
}

function validarTipo(tipo: unknown): string {
  const t = typeof tipo === 'string' ? tipo.trim() : '';
  if (!t || !TIPOS.includes(t)) {
    throw new ErrorRevision(`tipo debe ser uno de: ${TIPOS.join(', ')}`, 400);
  }
  return t;
}

/** GET con ?periodo=: la revision exacta, o null si no existe. */
export async function obtenerRevision(tipo: string | null, periodo: string): Promise<unknown> {
  const t = validarTipo(tipo);
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_revisiones')
    .select('*')
    .eq('tipo', t)
    .eq('periodo', periodo)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/** GET sin ?periodo=: todas las revisiones de ese tipo, de la mas nueva a la mas vieja. */
export async function listarRevisiones(tipo: string | null): Promise<unknown[]> {
  const t = validarTipo(tipo);
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_revisiones')
    .select('*')
    .eq('tipo', t)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export interface RevisionInput {
  tipo?: unknown;
  periodo?: unknown;
  contenido?: unknown;
}

export async function guardarRevision(body: RevisionInput): Promise<unknown> {
  const tipo = validarTipo(body.tipo);
  const periodo = typeof body.periodo === 'string' ? body.periodo.trim() : '';
  if (!periodo) throw new ErrorRevision('periodo requerido', 400);

  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_revisiones')
    .upsert(
      [{ tipo, periodo, contenido: body.contenido ?? {}, updated_at: new Date().toISOString() }],
      { onConflict: 'tipo,periodo' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
