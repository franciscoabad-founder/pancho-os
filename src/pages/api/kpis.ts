export const prerender = false;

// Backend de os_kpis / os_kpi_valores: tablero de KPIs del OS. Los valores se guardan
// como serie temporal (una fila por kpi_id+fecha); el GET expone el valor mas reciente y
// una tendencia calculada contra el valor anterior. El formato de presentacion (moneda,
// decimales, etc.) queda del lado del UI: aca solo viaja el numeric crudo.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg, hoyGuayaquil } from '../../lib/salud/apiHelpers';

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

const CAMPOS_KPI = ['label', 'unidad', 'meta', 'categoria', 'orden', 'fuente', 'activo'];

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const serieId = context.url.searchParams.get('serie');

    if (serieId) {
      const dias = Number(context.url.searchParams.get('dias')) || 30;
      const desde = new Date();
      desde.setDate(desde.getDate() - dias);
      const { data, error } = await sb
        .from('os_kpi_valores')
        .select('fecha, valor')
        .eq('kpi_id', serieId)
        .gte('fecha', desde.toISOString().slice(0, 10))
        .order('fecha', { ascending: true });
      if (error) throw error;
      return json({ serie: data ?? [] });
    }

    const { data: kpis, error } = await sb
      .from('os_kpis')
      .select('*')
      .eq('activo', true)
      .order('orden', { ascending: true });
    if (error) throw error;

    const kpisConValor = await Promise.all(
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
      })
    );

    return json({ kpis: kpisConValor });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();

    if (body.kpi_id) {
      // Registrar un valor de la serie (upsert por dia).
      const valor = Number(body.valor);
      if (!Number.isFinite(valor)) return json({ error: 'valor numerico requerido' }, 400);
      const fecha = body.fecha || hoyGuayaquil();
      const { data, error } = await sb
        .from('os_kpi_valores')
        .upsert([{ kpi_id: body.kpi_id, fecha, valor }], { onConflict: 'kpi_id,fecha' })
        .select()
        .single();
      if (error) throw error;
      return json({ valor: data }, 201);
    }

    // Crear un KPI nuevo.
    const label = typeof body.label === 'string' ? body.label.trim() : '';
    if (!label) return json({ error: 'label requerido' }, 400);
    const insert: Record<string, unknown> = { label };
    for (const c of ['unidad', 'meta', 'categoria', 'orden', 'fuente', 'activo']) {
      if (c in body) insert[c] = body[c];
    }
    const { data, error } = await sb.from('os_kpis').insert([insert]).select().single();
    if (error) throw error;
    return json({ kpi: data }, 201);
  } catch (err) {
    if (pgCode(err) === '23505') {
      return json({ error: 'Ya existe un KPI con ese label' }, 400);
    }
    return json({ error: errMsg(err) }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const c of CAMPOS_KPI) if (c in body) patch[c] = body[c];
    const { data, error } = await sb.from('os_kpis').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ kpi: data });
  } catch (err) {
    if (pgCode(err) === '23505') {
      return json({ error: 'Ya existe un KPI con ese label' }, 400);
    }
    return json({ error: errMsg(err) }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('os_kpis').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
