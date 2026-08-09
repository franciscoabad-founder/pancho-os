export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized } from '../../os/lib/osAuth';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const ESTADOS = ['aplicando', 'esperando', 'aprobado_sin_pagar', 'cobrado'];

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('por_cobrar')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return json({ por_cobrar: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const POST: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await context.request.json();
    if (!body.cliente?.trim()) return json({ error: 'cliente requerido' }, 400);
    const estado = ESTADOS.includes(body.estado) ? body.estado : 'aplicando';
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('por_cobrar')
      .insert([{
        cliente: body.cliente.trim(),
        proyecto: body.proyecto?.trim() || null,
        monto: Number(body.monto) || 0,
        moneda: body.moneda?.trim() || 'USD',
        estado,
        fecha_esperada: body.fecha_esperada || null,
        notas: body.notas?.trim() || null,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ por_cobrar: data }, 201);
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
    if (body.estado !== undefined && !ESTADOS.includes(body.estado)) {
      return json({ error: 'estado invalido' }, 400);
    }
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('por_cobrar')
      .update(body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ por_cobrar: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const DELETE: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const { url } = context;
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('por_cobrar').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};
