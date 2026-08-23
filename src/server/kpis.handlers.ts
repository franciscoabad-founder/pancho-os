// Logica pura del tablero de KPIs (tablas `os_kpis` y `os_kpi_valores`).
//
// Extraida de src/pages/api/kpis.ts (Astro) para reusarse desde la server route
// de TanStack Start. No depende de Astro ni del framework.
//
// Los valores se guardan como serie temporal (una fila por kpi_id+fecha); el
// listado expone el valor mas reciente y una tendencia calculada contra el valor
// anterior. El formato de presentacion queda del lado del UI: aca solo viaja el
// numeric crudo.

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseServer } from './supabase.ts';
import { hoyGuayaquil } from './helpers.ts';

let clienteActual: () => SupabaseClient = getSupabaseServer;

export function setClienteSupabaseKpis(fn: (() => SupabaseClient) | null): void {
  clienteActual = fn ?? getSupabaseServer;
}

export const CAMPOS_KPI = ['label', 'unidad', 'meta', 'categoria', 'orden', 'fuente', 'activo'];

export async function listarSerie(serieId: string, diasRaw: string | null): Promise<unknown[]> {
  const dias = Number(diasRaw) || 30;
  const desde = new Date();
  desde.setDate(desde.getDate() - dias);
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_kpi_valores')
    .select('fecha, valor')
    .eq('kpi_id', serieId)
    .gte('fecha', desde.toISOString().slice(0, 10))
    .order('fecha', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listarKpis(): Promise<unknown[]> {
  const sb = clienteActual();
  const { data: kpis, error } = await sb
    .from('os_kpis')
    .select('*')
    .eq('activo', true)
    .order('orden', { ascending: true });
  if (error) throw error;

  return Promise.all(
    (kpis ?? []).map(async (kpi) => {
      const { data: valores, error: valErr } = await sb
        .from('os_kpi_valores')
        .select('fecha, valor')
        .eq('kpi_id', kpi.id)
        .order('fecha', { ascending: false })
        .limit(2);
      if (valErr) throw valErr;
      const actual = valores?.[0] ?? null;
      const previo = valores?.[1] ?? null;
      let tendencia: 'up' | 'down' | 'flat' = 'flat';
      if (actual && previo) {
        if (Number(actual.valor) > Number(previo.valor)) tendencia = 'up';
        else if (Number(actual.valor) < Number(previo.valor)) tendencia = 'down';
      }
      return {
        ...kpi,
        valor_actual: actual ? actual.valor : null,
        fecha_actual: actual ? actual.fecha : null,
        tendencia,
      };
    }),
  );
}

/** Registrar un valor de la serie (upsert por dia). */
export async function registrarValorKpi(body: Record<string, unknown>): Promise<unknown> {
  const valor = Number(body.valor);
  if (!Number.isFinite(valor)) throw new Error('valor numerico requerido');
  const fecha = (body.fecha as string | undefined) || hoyGuayaquil();
  const sb = clienteActual();
  const { data, error } = await sb
    .from('os_kpi_valores')
    .upsert([{ kpi_id: body.kpi_id, fecha, valor }], { onConflict: 'kpi_id,fecha' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function crearKpi(body: Record<string, unknown>): Promise<unknown> {
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) throw new Error('label requerido');
  const insert: Record<string, unknown> = { label };
  for (const c of ['unidad', 'meta', 'categoria', 'orden', 'fuente', 'activo']) {
    if (c in body) insert[c] = body[c];
  }
  const sb = clienteActual();
  const { data, error } = await sb.from('os_kpis').insert([insert]).select().single();
  if (error) throw error;
  return data;
}

export async function actualizarKpi(id: string, body: Record<string, unknown>): Promise<unknown> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const c of CAMPOS_KPI) if (c in body) patch[c] = body[c];
  const sb = clienteActual();
  const { data, error } = await sb.from('os_kpis').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function eliminarKpi(id: string): Promise<void> {
  const sb = clienteActual();
  const { error } = await sb.from('os_kpis').delete().eq('id', id);
  if (error) throw error;
}
