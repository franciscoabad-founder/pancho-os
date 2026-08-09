export const prerender = false;

// Backend de os_priority_stack + os_no_hacer: las 3 prioridades de la semana y la
// lista de "no hacer" (metodología priority stack semanal). No hay demo estático
// previo para esto; es una superficie nueva del OS manager real.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg, hoyGuayaquil } from '../../lib/salud/apiHelpers';

function pgCode(err: unknown): string | undefined {
  return (err as { code?: string })?.code;
}

// Lunes (YYYY-MM-DD) de la semana que contiene `fecha`, calculado en zona horaria de
// Guayaquil (evita drift de UTC al construir el Date a partir del string).
function lunesDeSemana(fecha: string): string {
  const [y, m, d] = fecha.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.getUTCDay(); // 0=domingo..6=sabado
  const offset = dow === 0 ? -6 : 1 - dow;
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt.toISOString().slice(0, 10);
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const semana = context.url.searchParams.get('semana') || lunesDeSemana(hoyGuayaquil());
    const sb = getSupabaseServer();

    const { data: prioridades, error: errP } = await sb
      .from('os_priority_stack')
      .select('*')
      .eq('semana_inicio', semana)
      .order('orden', { ascending: true });
    if (errP) throw errP;

    const { data: noHacer, error: errN } = await sb
      .from('os_no_hacer')
      .select('*')
      .eq('semana_inicio', semana)
      .order('created_at', { ascending: true });
    if (errN) throw errN;

    return json({ semana_inicio: semana, prioridades: prioridades ?? [], no_hacer: noHacer ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const sb = getSupabaseServer();

    if ('no_hacer' in body) {
      const texto = typeof body.no_hacer === 'string' ? body.no_hacer.trim() : '';
      if (!texto) return json({ error: 'no_hacer requerido' }, 400);
      const semana = body.semana_inicio || lunesDeSemana(hoyGuayaquil());
      const { data, error } = await sb
        .from('os_no_hacer')
        .insert([{ semana_inicio: semana, texto }])
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, no_hacer: data }, 201);
    }

    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    if (!titulo) return json({ error: 'titulo requerido' }, 400);
    const orden = Number(body.orden);
    if (!Number.isInteger(orden) || orden < 1 || orden > 3) {
      return json({ error: 'orden debe ser 1, 2 o 3' }, 400);
    }
    const semana = body.semana_inicio || lunesDeSemana(hoyGuayaquil());

    const { data, error } = await sb
      .from('os_priority_stack')
      .insert([{
        semana_inicio: semana,
        orden,
        titulo,
        objetivo_id: body.objetivo_id || null,
        hecho: body.hecho === true,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, prioridad: data }, 201);
  } catch (err) {
    if (pgCode(err) === '23505') {
      return json({ error: 'Ya existe una prioridad en esa posicion' }, 400);
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
    const patch: Record<string, unknown> = {};
    const campos = ['titulo', 'orden', 'objetivo_id', 'hecho'];
    for (const c of campos) if (c in body) patch[c] = body[c];

    if ('titulo' in patch && !(patch.titulo as string)?.toString().trim()) {
      return json({ error: 'titulo requerido' }, 400);
    }
    if ('orden' in patch) {
      const orden = Number(patch.orden);
      if (!Number.isInteger(orden) || orden < 1 || orden > 3) {
        return json({ error: 'orden debe ser 1, 2 o 3' }, 400);
      }
      patch.orden = orden;
    }
    if (!Object.keys(patch).length) return json({ error: 'sin campos para actualizar' }, 400);

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_priority_stack')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, prioridad: data });
  } catch (err) {
    if (pgCode(err) === '23505') {
      return json({ error: 'Ya existe una prioridad en esa posicion' }, 400);
    }
    return json({ error: errMsg(err) }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = context.url.searchParams.get('id');
  const noHacerId = context.url.searchParams.get('no_hacer_id');
  if (!id && !noHacerId) return json({ error: 'id o no_hacer_id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    if (noHacerId) {
      const { error } = await sb.from('os_no_hacer').delete().eq('id', noHacerId);
      if (error) throw error;
    } else {
      const { error } = await sb.from('os_priority_stack').delete().eq('id', id as string);
      if (error) throw error;
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
