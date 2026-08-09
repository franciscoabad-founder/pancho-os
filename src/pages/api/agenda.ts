export const prerender = false;

// Backend de agenda: antes usaba webhooks de n8n (AGENDA_LIST_WEBHOOK_URL /
// AGENDA_WRITE_WEBHOOK_URL) con auth propia solo por cookie. Ahora lee/escribe
// directamente en la tabla pre-existente `reuniones` y usa el helper compartido
// isOsAuthorized (cookie u os_auth O Bearer token, para que n8n pueda escribir con
// OS_API_TOKEN). `reuniones` ahora tiene columnas `fin` (timestamptz) y `ubicacion`
// (text) ademas de `fecha`, asi que el rango inicio/fin y la ubicacion persisten.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg, hoyGuayaquil } from '../../lib/salud/apiHelpers';

const CAMPOS = ['titulo', 'fecha', 'fin', 'ubicacion', 'resumen', 'brain_slug'];

// El UI de /os/agenda (agenda.astro) espera objetos con inicio/fin ISO. `reuniones`
// mapea fecha -> inicio, fin -> fin (null si no esta seteado) y resumen -> descripcion.
function toEvento(reunion: Record<string, unknown>) {
  return {
    id: reunion.id,
    titulo: reunion.titulo,
    inicio: reunion.fecha,
    fin: reunion.fin ?? null,
    ubicacion: reunion.ubicacion ?? undefined,
    descripcion: reunion.resumen ?? undefined,
    brain_slug: reunion.brain_slug,
    fuente: reunion.fuente,
  };
}

function defaultRango(context: Parameters<APIRoute>[0]) {
  const hoy = hoyGuayaquil();
  const enUnaSemana = new Date();
  enUnaSemana.setDate(enUnaSemana.getDate() + 7);
  return {
    desde: context.url.searchParams.get('desde') || hoy,
    hasta: context.url.searchParams.get('hasta') || enUnaSemana.toISOString().slice(0, 10),
  };
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const { desde, hasta } = defaultRango(context);
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('reuniones')
      .select('*')
      .gte('fecha', `${desde}T00:00:00`)
      .lte('fecha', `${hasta}T23:59:59`)
      .order('fecha', { ascending: true });
    if (error) throw error;
    return json({ eventos: (data ?? []).map(toEvento) });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : '';
    if (!titulo) return json({ error: 'titulo requerido' }, 400);
    // Acepta `fecha` (nombre de columna) o `inicio` (nombre usado por el form de
    // agenda.astro) como el timestamp del evento.
    const fecha = body.fecha || body.inicio;
    if (!fecha) return json({ error: 'fecha requerida' }, 400);

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('reuniones')
      .insert([{
        titulo,
        fecha,
        fin: body.fin ?? null,
        ubicacion: body.ubicacion ?? null,
        resumen: body.resumen ?? body.descripcion ?? null,
        brain_slug: body.brain_slug ?? null,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, evento: toEvento(data) }, 201);
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
    const sb = getSupabaseServer();
    const patch: Record<string, unknown> = {};
    for (const c of CAMPOS) if (c in body) patch[c] = body[c];
    const { data, error } = await sb.from('reuniones').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ ok: true, evento: toEvento(data) });
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
    const { error } = await sb.from('reuniones').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
