export const prerender = false;

// Backend de os_dia + os_wins: el One Domino + Discomfort First del día y los wins
// registrados (reemplaza el demo estático en apps/web/src/os/data/hoy.ts). GET nunca
// crea la fila del día (evita filas vacías por curiosidad); el PUT/PATCH hace upsert
// por `fecha` (PK), que es la forma correcta de "crear si no existe, si no actualizar".

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized, json } from '../../os/lib/osAuth';
import { errMsg, hoyGuayaquil } from '../../lib/salud/apiHelpers';

const CAMPOS_DIA = [
  'domino_titulo', 'domino_linea', 'domino_razon', 'domino_hecho',
  'discomfort_titulo', 'discomfort_hecho', 'nota',
];

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const fecha = context.url.searchParams.get('fecha') || hoyGuayaquil();
    const sb = getSupabaseServer();

    const { data: dia, error: errDia } = await sb
      .from('os_dia')
      .select('*')
      .eq('fecha', fecha)
      .maybeSingle();
    if (errDia) throw errDia;

    const { data: wins, error: errWins } = await sb
      .from('os_wins')
      .select('*')
      .eq('fecha', fecha)
      .order('created_at', { ascending: true });
    if (errWins) throw errWins;

    return json({ dia: dia ?? null, wins: wins ?? [] });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

async function upsertDia(context: Parameters<APIRoute>[0]) {
  const body = await context.request.json();
  const fecha = body.fecha || hoyGuayaquil();
  const patch: Record<string, unknown> = { fecha, updated_at: new Date().toISOString() };
  for (const c of CAMPOS_DIA) if (c in body) patch[c] = body[c];

  const sb = getSupabaseServer();
  const { data, error } = await sb
    .from('os_dia')
    .upsert(patch, { onConflict: 'fecha' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export const PUT: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const dia = await upsertDia(context);
    return json({ dia });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const PATCH: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const dia = await upsertDia(context);
    return json({ dia });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    const win = body.win ?? {};
    const texto = typeof win.texto === 'string' ? win.texto.trim() : '';
    if (!texto) return json({ error: 'win.texto requerido' }, 400);
    const fecha = body.fecha || hoyGuayaquil();

    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('os_wins')
      .insert([{
        fecha,
        texto,
        categoria: win.categoria ?? null,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ ok: true, win: data }, 201);
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const winId = context.url.searchParams.get('win_id');
  if (!winId) return json({ error: 'win_id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('os_wins').delete().eq('id', winId);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    return json({ error: errMsg(err) }, 502);
  }
};
