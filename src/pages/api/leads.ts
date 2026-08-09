export const prerender = false;

import type { APIRoute } from 'astro';
import { getSupabaseServer } from '../../lib/supabase';
import { isOsAuthorized } from '../../os/lib/osAuth';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const GET: APIRoute = async (context) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('crm_leads')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return json({ leads: data ?? [] });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const POST: APIRoute = async ({ request, ...context }) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  try {
    const body = await request.json();
    if (!body.nombre?.trim()) return json({ error: 'nombre requerido' }, 400);
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('crm_leads')
      .insert([{
        nombre: body.nombre.trim(),
        empresa: body.empresa?.trim() || null,
        proyecto: body.proyecto?.trim() || null,
        etapa: body.etapa ?? 'nuevo',
        probabilidad: Number(body.probabilidad) || 0,
        scoring: Number(body.scoring) || 0,
        valor: Number(body.valor) || 0,
        etiquetas: body.etiquetas ?? [],
        notas: body.notas ?? null,
      }])
      .select()
      .single();
    if (error) throw error;
    return json({ lead: data }, 201);
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const PATCH: APIRoute = async ({ request, url, ...context }) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const body = await request.json();
    const sb = getSupabaseServer();
    const { data, error } = await sb
      .from('crm_leads')
      .update(body)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return json({ lead: data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};

export const DELETE: APIRoute = async ({ url, ...context }) => {
  if (!isOsAuthorized(context)) return json({ error: 'Unauthorized' }, 401);
  const id = url.searchParams.get('id');
  if (!id) return json({ error: 'id requerido' }, 400);
  try {
    const sb = getSupabaseServer();
    const { error } = await sb.from('crm_leads').delete().eq('id', id);
    if (error) throw error;
    return json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : (err as any)?.message ?? JSON.stringify(err);
    return json({ error: msg }, 502);
  }
};
