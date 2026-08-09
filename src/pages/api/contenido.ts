export const prerender = false;

// Backend de os_contenido_ideas: pipeline editorial (ideas, formato, repurposing,
// plataformas y estado) que reemplaza el demo estatico en os/data/contenido.ts.

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg } from '../../lib/salud/apiHelpers';

const CAMPOS = ['titulo', 'formato', 'idea_madre', 'repurposing', 'status', 'plataformas', 'fecha_target', 'url_referencia', 'transcript'];

function asArray(v: unknown): string[] | undefined {
  if (v === undefined) return undefined;
  if (Array.isArray(v)) return v.map((x) => String(x));
  return [];
}

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    let query = sb.from('os_contenido_ideas').select('*').order('created_at', { ascending: false });
    const status = context.url.searchParams.get('status');
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return json({ ideas: data ?? [] });
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
    const sb = getSupabaseServer();
    const fila: Record<string, unknown> = {
      titulo,
      formato: body.formato ?? null,
      idea_madre: body.idea_madre ?? null,
      repurposing: asArray(body.repurposing) ?? [],
      status: body.status ?? 'idea',
      plataformas: asArray(body.plataformas) ?? [],
      fecha_target: body.fecha_target || null,
    };
    // Solo si vienen: asi el POST sigue funcionando aunque la migracion
    // 20260722 (url_referencia/transcript) no este aplicada todavia.
    if (typeof body.url_referencia === 'string' && body.url_referencia.trim()) fila.url_referencia = body.url_referencia.trim();
    if (typeof body.transcript === 'string' && body.transcript.trim()) fila.transcript = body.transcript.trim();
    const { data, error } = await sb
      .from('os_contenido_ideas')
      .insert([fila])
      .select()
      .single();
    if (error) throw error;
    return json({ idea: data }, 201);
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
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const c of CAMPOS) {
      if (!(c in body)) continue;
      if (c === 'repurposing' || c === 'plataformas') {
        patch[c] = asArray(body[c]);
      } else {
        patch[c] = body[c];
      }
    }
    const { data, error } = await sb.from('os_contenido_ideas').update(patch).eq('id', id).select().single();
    if (error) throw error;
    return json({ idea: data });
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
    const { error } = await sb.from('os_contenido_ideas').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
