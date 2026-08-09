export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';

const FUENTES = ['manual', 'descripcion', 'voz', 'foto'];
const TZ = 'America/Guayaquil';

function hoyEnGuayaquil(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function numOrNull(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  try {
    const sb = getSupabaseServer();

    if (url.searchParams.get('historial') === '1') {
      const { data, error } = await sb
        .from('comidas')
        .select('*')
        .order('fecha', { ascending: false });
      if (error) throw error;
      return json({ comidas: data ?? [] });
    }

    const dia = url.searchParams.get('dia') || hoyEnGuayaquil();
    const desde = `${dia}T00:00:00`;
    const hasta = `${dia}T23:59:59.999`;

    const [{ data: comidas, error: comidasError }, { data: metas, error: metasError }] = await Promise.all([
      sb
        .from('comidas')
        .select('*')
        .gte('fecha', desde)
        .lte('fecha', hasta)
        .order('fecha', { ascending: true }),
      sb
        .from('comidas_metas')
        .select('*')
        .order('vigente_desde', { ascending: false })
        .limit(1),
    ]);
    if (comidasError) throw comidasError;
    if (metasError) throw metasError;

    const entradas = comidas ?? [];
    const totales = entradas.reduce(
      (acc, c) => {
        acc.kcal += Number(c.kcal) || 0;
        acc.proteina_g += Number(c.proteina_g) || 0;
        acc.carbos_g += Number(c.carbos_g) || 0;
        acc.grasa_g += Number(c.grasa_g) || 0;
        return acc;
      },
      { kcal: 0, proteina_g: 0, carbos_g: 0, grasa_g: 0 }
    );

    const meta = metas?.[0] ?? null;
    const restante_kcal = meta?.kcal_objetivo != null ? meta.kcal_objetivo - totales.kcal : null;

    return json({ dia, comidas: entradas, totales, meta, restante_kcal });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    if (!body.descripcion?.trim() && !body.momento?.trim() && body.kcal == null) {
      return json({ error: 'descripcion, momento o kcal requerido' }, 400);
    }
    const fuente = body.fuente?.trim() || 'manual';
    if (!FUENTES.includes(fuente)) {
      return json({ error: `fuente debe ser una de: ${FUENTES.join(', ')}` }, 400);
    }
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('comidas')
      .insert([{
        fecha: body.fecha || new Date().toISOString(),
        momento: body.momento?.trim() || null,
        descripcion: body.descripcion?.trim() || null,
        foto_url: body.foto_url?.trim() || null,
        notas: body.notas?.trim() || null,
        kcal: numOrNull(body.kcal),
        proteina_g: numOrNull(body.proteina_g),
        carbos_g: numOrNull(body.carbos_g),
        grasa_g: numOrNull(body.grasa_g),
        items: Array.isArray(body.items) ? body.items : [],
        fuente,
        confianza: numOrNull(body.confianza),
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ comida: data }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { request, url } = context;
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const body = await request.json();
    if ('fuente' in body && !FUENTES.includes(body.fuente)) {
      return json({ error: `fuente debe ser una de: ${FUENTES.join(', ')}` }, 400);
    }
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('comidas')
      .update(body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ comida: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('comidas').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};
