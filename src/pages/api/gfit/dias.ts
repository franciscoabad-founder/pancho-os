export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../../lib/supabase';
import { isOsAuthorized, json } from '../../../os/lib/osAuth';
import { errMsg } from '../../../lib/salud/apiHelpers';

const TIPOS = ['weekday', 'orden', 'descanso'];

const SEL =
  '*, gfit_dia_ejercicios(*, ejercicio:ejercicios_catalogo(slug,nombre_en,nombre_es,imagenes,equipo,patron,musculos_primarios), gfit_series_plan(*))';

type SupabaseServer = ReturnType<typeof getSupabaseServer>;

async function cargarDia(sb: SupabaseServer, id: string) {
  const { data, error } = await sb
    .from('gfit_dias')
    .select(SEL)
    .eq('id', id)
    .order('orden', { foreignTable: 'gfit_dia_ejercicios', ascending: true })
    .order('orden', { foreignTable: 'gfit_dia_ejercicios.gfit_series_plan', ascending: true })
    .single();
  if (error) throw error;
  return data;
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  try {
    const sb = getSupabaseServer();
    const rutinaId = url.searchParams.get('rutina_id');
    if (!rutinaId) return json({ error: 'rutina_id requerido' }, 400);
    const { data, error } = await sb
      .from('gfit_dias')
      .select(SEL)
      .eq('rutina_id', rutinaId)
      .order('weekday', { ascending: true, nullsFirst: false })
      .order('orden', { ascending: true })
      .order('orden', { foreignTable: 'gfit_dia_ejercicios', ascending: true })
      .order('orden', { foreignTable: 'gfit_dia_ejercicios.gfit_series_plan', ascending: true });
    if (error) throw error;
    return json({ dias: data ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

// Duplica un dÃ­a completo (ejercicios + series) dentro de la misma rutina (o de otra,
// si se pasa rutina_id). Inserta de forma secuencial: si algo falla a mitad de camino
// puede quedar una copia parcial (no hay transacciÃ³n atÃ³mica desde el cliente); se
// devuelve 502 y el llamador puede revisar/borrar el dÃ­a parcial manualmente.
async function copiarDia(sb: SupabaseServer, diaId: string, overrides: Record<string, unknown>) {
  const original = await cargarDia(sb, diaId);
  if (!original) throw new Error('dÃ­a origen no encontrado');

  const { data: nuevoDia, error: errDia } = await sb
    .from('gfit_dias')
    .insert([{
      rutina_id: overrides.rutina_id || original.rutina_id,
      nombre: (overrides.nombre as string | undefined)?.trim() || `${original.nombre} (copia)`,
      tipo: original.tipo,
      weekday: original.weekday,
      orden: original.orden,
    }])
    .select()
    .single();
  if (errDia) throw errDia;

  const ejerciciosOriginal = (original as any).gfit_dia_ejercicios ?? [];
  for (const de of ejerciciosOriginal) {
    const { data: nuevoDe, error: errDe } = await sb
      .from('gfit_dia_ejercicios')
      .insert([{
        dia_id: nuevoDia.id,
        ejercicio_id: de.ejercicio_id,
        orden: de.orden,
        superset_grupo: de.superset_grupo,
        notas: de.notas,
      }])
      .select()
      .single();
    if (errDe) throw errDe;

    const series = de.gfit_series_plan ?? [];
    if (series.length) {
      const filas = series.map((s: Record<string, unknown>) => ({
        dia_ejercicio_id: nuevoDe.id,
        orden: s.orden,
        tipo: s.tipo,
        peso_kg: s.peso_kg,
        reps: s.reps,
        descanso_s: s.descanso_s,
      }));
      const { error: errSeries } = await sb.from('gfit_series_plan').insert(filas);
      if (errSeries) throw errSeries;
    }
  }

  return cargarDia(sb, nuevoDia.id);
}

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();

    if (body.copiar_de) {
      const dia = await copiarDia(sb, body.copiar_de, body);
      return json({ ok: true, dia }, 201);
    }

    if (!body.rutina_id) return json({ error: 'rutina_id requerido' }, 400);
    if (!body.nombre?.trim()) return json({ error: 'nombre requerido' }, 400);
    const tipo = TIPOS.includes(body.tipo) ? body.tipo : (body.weekday ? 'weekday' : 'orden');
    if (tipo === 'weekday') {
      const wd = Number(body.weekday);
      if (!Number.isInteger(wd) || wd < 1 || wd > 7) return json({ error: 'weekday invÃ¡lido (1-7)' }, 400);
    }

    const { data, error } = await sb
      .from('gfit_dias')
      .insert([{
        rutina_id: body.rutina_id,
        nombre: body.nombre.trim(),
        tipo,
        weekday: tipo === 'weekday' ? Number(body.weekday) : null,
        orden: typeof body.orden === 'number' ? body.orden : null,
      }])
      .select()
      .single();
    if (error) throw error;
    const dia = await cargarDia(sb, data.id);
    return json({ ok: true, dia }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const body = await context.request.json();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if ('nombre' in body) {
      const nombre = body.nombre?.toString().trim();
      if (!nombre) return json({ error: 'nombre requerido' }, 400);
      patch.nombre = nombre;
    }
    if ('tipo' in body) {
      if (!TIPOS.includes(body.tipo)) return json({ error: 'tipo invÃ¡lido' }, 400);
      patch.tipo = body.tipo;
    }
    if ('weekday' in body) patch.weekday = body.weekday == null ? null : Number(body.weekday);
    if ('orden' in body) patch.orden = body.orden == null ? null : Number(body.orden);
    const sb = getSupabaseServer();
    const { error } = await sb.from('gfit_dias').update(patch).eq('id', id);
    if (error) throw error;
    const dia = await cargarDia(sb, id);
    return json({ ok: true, dia });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('gfit_dias').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
